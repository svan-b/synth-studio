// ============================================================================
// Xone:96 behaviour check (Playwright):
//   node scripts/checks/xone96.cjs http://localhost:3106 <outDir>
// Plays the decks, then verifies with the real output level that
//   1. pulling channel 1's fader down drops the level,
//   2. the crossfader cuts a channel assigned to X when moved to Y (and back),
//   3. touch dragging works on the crossfader (iPad emulation, CDP touch events).
// Also saves full-page screenshots. Exits non-zero on failure.
// ============================================================================
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/** 16-bit mono WAV with a sine tone */
function makeWav(freq, seconds, rate = 44100) {
  const n = Math.floor(rate * seconds);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 0.5 * 32767), 44 + i * 2);
  return b;
}

(async () => {
  const [, , base = 'http://localhost:3106', outDir = '.'] = process.argv;
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const result = { errors: [], checks: {} };
  const fail = [];

  const open = async (viewport, touch) => {
    const page = await browser.newPage({ viewport, hasTouch: touch });
    page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
    page.on('pageerror', e => result.errors.push(String(e)));
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: 'xone96', devices: {}, completedLessons: [] }, version: 3 }));
        sessionStorage.setItem('seeded', '1');
      }
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    return page;
  };
  const peak = (page, ms) => page.evaluate(async ms => {
    let m = 0; const t0 = performance.now();
    while (performance.now() - t0 < ms) { m = Math.max(m, window.__synthLevel ? window.__synthLevel() : 0); await new Promise(r => setTimeout(r, 15)); }
    return +m.toFixed(4);
  }, ms);
  const box = async (page, sel) => {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    return el.boundingBox();
  };
  const value = (page, id) => page.locator(`[data-control="${id}"][role="slider"]`).first().getAttribute('aria-valuenow').then(Number);

  // ---------------- Desktop / mouse -------------------------------------------
  const page = await open({ width: 1440, height: 900 }, false);
  await page.screenshot({ path: path.join(outDir, 'xone96-full-desktop.png'), fullPage: true });
  const unlock = page.getByRole('button', { name: /enable audio/i });
  if (await unlock.count()) await unlock.click(); else await page.mouse.click(4, 4);
  await page.waitForTimeout(700);
  await page.mouse.click(4, 4);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  const playing = await peak(page, 2000);
  result.checks.playingPeak = playing;
  if (!(playing > 0.05)) fail.push('no output while playing');

  // 1. Mouse-drag channel 1 fader from the top to the bottom
  let b = await box(page, '[data-control="ch1_fader"][role="slider"]');
  const fx = b.x + b.width / 2;
  await page.mouse.move(fx, b.y + 12);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(fx, b.y + 12 + ((b.height - 12) * i) / 10);
  await page.mouse.move(fx, b.y + b.height + 20);
  await page.mouse.up();
  await page.waitForTimeout(400);
  result.checks.ch1FaderAfterDrag = await value(page, 'ch1_fader');
  const faderDown = await peak(page, 1500);
  result.checks.faderDownPeak = faderDown;
  if (!(faderDown < playing * 0.3)) fail.push(`fader down did not drop the level (${playing} -> ${faderDown})`);

  // back up (click near the top of the track jumps the fader there)
  await page.mouse.click(fx, b.y + 11);
  await page.waitForTimeout(500);
  result.checks.ch1FaderBackUp = await value(page, 'ch1_fader');
  const faderUp = await peak(page, 1500);
  result.checks.faderUpPeak = faderUp;
  if (!(faderUp > playing * 0.5)) fail.push('fader back up did not restore the level');

  // 2. Assign channel 1 to X, crossfader to Y (cut), then back to X
  await page.locator('[data-control="ch1_xf"] button', { hasText: /^X$/ }).first().click();
  b = await box(page, '[data-control="xfader"][role="slider"]');
  const xy = b.y + b.height / 2;
  await page.mouse.move(b.x + b.width / 2, xy);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 2, xy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  result.checks.xfaderAtY = await value(page, 'xfader');
  const atY = await peak(page, 1500);
  result.checks.xfaderYPeak = atY;
  await page.mouse.move(b.x + b.width - 2, xy);
  await page.mouse.down();
  await page.mouse.move(b.x + 2, xy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  result.checks.xfaderAtX = await value(page, 'xfader');
  const atX = await peak(page, 1500);
  result.checks.xfaderXPeak = atX;
  if (!(atY < atX * 0.3)) fail.push(`crossfader did not change the output (Y ${atY}, X ${atX})`);
  await page.screenshot({ path: path.join(outDir, 'xone96-full-playing.png'), fullPage: true });

  // 3. Load an audio file on channel 1 (it should switch to USB 1 and play the file)
  const wav = path.join(outDir, 'xone96-test-tone.wav');
  fs.writeFileSync(wav, makeWav(220, 2));
  await page.locator('input[type="file"]').nth(2).setInputFiles(wav); // columns: A, B, 1, ...
  await page.waitForTimeout(1500);
  const usb = page.locator('[data-control="ch1_input"] button', { hasText: 'USB 1' }).first();
  result.checks.fileSwitchedToUsb = await usb.evaluate(el => getComputedStyle(el).backgroundColor === 'rgb(229, 229, 229)');
  result.checks.filePeak = await peak(page, 1500);
  result.checks.fileStatus = await page.getByText(/xone96-test-tone\.wav/).first().innerText().catch(() => null);
  if (!result.checks.fileSwitchedToUsb || !(result.checks.filePeak > 0.05)) fail.push('loaded file did not play on channel 1');
  await page.close();

  // ---------------- iPad / touch -----------------------------------------------
  const ipad = await open({ width: 1180, height: 820 }, true);
  await ipad.screenshot({ path: path.join(outDir, 'xone96-full-ipad.png'), fullPage: true });
  const cdp = await ipad.context().newCDPSession(ipad);
  b = await box(ipad, '[data-control="xfader"][role="slider"]');
  const ty = b.y + b.height / 2;
  const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: ty }] });
  const before = await value(ipad, 'xfader');
  await touch('touchStart', b.x + b.width / 2);
  for (let i = 1; i <= 8; i++) await touch('touchMove', b.x + b.width / 2 - (b.width / 2 - 4) * (i / 8));
  await touch('touchEnd');
  await ipad.waitForTimeout(300);
  const after = await value(ipad, 'xfader');
  result.checks.touchXfader = { before, after };
  if (!(after < before - 3)) fail.push('touch drag did not move the crossfader');
  // touch-drag channel 3 fader up
  b = await box(ipad, '[data-control="ch3_fader"][role="slider"]');
  const tx = b.x + b.width / 2;
  const t2 = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: tx, y }] });
  await t2('touchStart', b.y + b.height - 12);
  for (let i = 1; i <= 8; i++) await t2('touchMove', b.y + b.height - 12 - (b.height - 30) * (i / 8));
  await t2('touchEnd');
  await ipad.waitForTimeout(300);
  result.checks.touchCh3Fader = await value(ipad, 'ch3_fader');
  if (!(result.checks.touchCh3Fader > 6)) fail.push('touch drag did not move channel 3 fader');
  await ipad.close();

  result.failures = fail;
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(fail.length || result.errors.length ? 1 : 0);
})();
