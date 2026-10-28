// Run: node scripts/checks/sub37.cjs http://localhost:3103 <outDir>   (after npm run build && npx next start -p 3103)
// Sub 37 interaction check:
//  1. play an on-screen key with the mouse pointer and confirm audio
//  2. drag the CUTOFF knob down / up and confirm the output spectrum changes
//  3. two-finger touch chord on the keyboard (iPad) + DUO MODE -> two held keys
const { chromium } = require('playwright');
const path = require('path');

const [, , base = 'http://localhost:3103', outDir = '.'] = process.argv;

const seed = d => {
  if (!sessionStorage.getItem('seeded')) {
    localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: d, devices: {}, completedLessons: [] }, version: 3 }));
    sessionStorage.setItem('seeded', '1');
  }
  // Tap the limiter so the test can compute a spectrum
  const orig = AudioContext.prototype.createDynamicsCompressor;
  AudioContext.prototype.createDynamicsCompressor = function () {
    const n = orig.call(this);
    window.__limiter = n; window.__ctx = this;
    return n;
  };
};

async function measure(page, ms = 600) {
  return page.evaluate(async ms => {
    if (!window.__an) { window.__an = window.__ctx.createAnalyser(); window.__an.fftSize = 4096; window.__limiter.connect(window.__an); }
    const an = window.__an;
    const bins = new Float32Array(an.frequencyBinCount);
    const td = new Float32Array(an.fftSize);
    let peak = 0, cSum = 0, n = 0;
    const t0 = performance.now();
    await new Promise(r => setTimeout(r, 120));
    while (performance.now() - t0 < ms) {
      an.getFloatTimeDomainData(td);
      for (const v of td) peak = Math.max(peak, Math.abs(v));
      an.getFloatFrequencyData(bins);
      let num = 0, den = 0;
      const hz = window.__ctx.sampleRate / an.fftSize;
      for (let i = 1; i < bins.length; i++) { const m = Math.pow(10, bins[i] / 20); num += m * i * hz; den += m; }
      if (den > 0) { cSum += num / den; n++; }
      await new Promise(r => setTimeout(r, 40));
    }
    return { peak: +peak.toFixed(3), centroid: Math.round(cSum / Math.max(1, n)) };
  }, ms);
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const result = { errors: [] };

  // ---------------- Desktop: mouse ----------------
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
  page.on('pageerror', e => result.errors.push(String(e)));
  await page.addInitScript(seed, 'sub37');
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const unlock = page.getByRole('button', { name: /enable audio/i });
  if (await unlock.count()) await unlock.click(); else { console.error('no unlock button; badge:', await page.getByRole('button', { name: /audio/i }).first().innerText().catch(e => String(e)), result.errors); await page.mouse.click(4, 4); }
  await page.waitForTimeout(800);

  const key = page.locator('[data-note="60"]');
  const kb = await key.boundingBox();
  const playKey = async () => {
    await page.mouse.move(kb.x + kb.width / 2, kb.y + kb.height * 0.85);
    await page.mouse.down();
    const m = await measure(page, 700);
    await page.mouse.up();
    await page.waitForTimeout(400);
    return m;
  };
  result.idle = await measure(page, 300);
  result.keyDefault = await playKey();

  const knob = page.locator('[data-control="cutoff"]');
  const drag = async dy => {
    const b = await knob.boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + dy, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(500); // past the knob's double-tap window
  };
  await drag(260);  // fully down → 20 Hz
  result.cutoffLowValue = await knob.getAttribute('aria-valuenow');
  result.keyCutoffLow = await playKey();
  await drag(-140); // up ~ 2/3 of travel
  result.cutoffMidValue = await knob.getAttribute('aria-valuenow');
  result.keyCutoffMid = await playKey();
  await drag(-260); // fully up → 20 kHz
  result.cutoffHighValue = await knob.getAttribute('aria-valuenow');
  result.keyCutoffHigh = await playKey();
  result.lcd = (await page.locator('text=FILTER CUTOFF').count()) > 0;

  // Preset button 1 (Fat Bass) then a note
  await page.locator('[data-preset="1"]').dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse', isPrimary: true });
  await page.waitForTimeout(300);
  result.presetLcd = (await page.locator('text=FAT BASS').count()) > 0;
  result.keyFatBass = await playKey();

  // Every preset slot must make sound when a key is held
  result.presets = {};
  for (let slot = 1; slot <= 11; slot++) {
    await page.locator(`[data-preset="${slot}"]`).dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse', isPrimary: true });
    await page.waitForTimeout(250);
    const name = await page.locator(`[data-preset="${slot}"]`).getAttribute('title');
    await page.mouse.move(kb.x + kb.width / 2, kb.y + kb.height * 0.85);
    await page.mouse.down();
    const m = await measure(page, 1200);
    await page.mouse.up();
    await page.waitForTimeout(300);
    result.presets[name] = m.peak;
  }
  await page.locator('[data-preset="1"]').dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse', isPrimary: true });
  await page.waitForTimeout(200);

  // Mod wheel drag changes mod_wheel value
  const wheel = page.locator('[data-wheel="MOD"]');
  const wb = await wheel.boundingBox();
  await page.mouse.move(wb.x + wb.width / 2, wb.y + wb.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(wb.x + wb.width / 2, wb.y + wb.height * 0.3, { steps: 8 });
  await page.mouse.up();
  result.modWheel = await wheel.getAttribute('aria-valuenow');
  await page.screenshot({ path: path.join(outDir, 'sub37-check-desktop.png') });
  await page.close();

  // ---------------- iPad: two-finger chord ----------------
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false });
  const ipad = await ctx.newPage();
  ipad.on('console', m => { if (m.type() === 'error') result.errors.push('[ipad] ' + m.text()); });
  await ipad.addInitScript(seed, 'sub37');
  await ipad.goto(base, { waitUntil: 'networkidle' });
  await ipad.waitForTimeout(1000);
  const unlock2 = ipad.getByRole('button', { name: /enable audio/i });
  if (await unlock2.count()) await unlock2.tap(); else await ipad.touchscreen.tap(4, 4);
  await ipad.waitForTimeout(800);
  await ipad.locator('[data-control="duo_mode"]').tap();
  await ipad.waitForTimeout(200);
  const k1 = await ipad.locator('[data-note="48"]').boundingBox();
  const k2 = await ipad.locator('[data-note="55"]').boundingBox();
  const cdp = await ctx.newCDPSession(ipad);
  const pts = [
    { x: k1.x + k1.width / 2, y: k1.y + k1.height * 0.85, id: 1 },
    { x: k2.x + k2.width / 2, y: k2.y + k2.height * 0.85, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts });
  const chord = await measure(ipad, 600);
  const heldKeys = await ipad.evaluate(() => [...document.querySelectorAll('[data-note]')].filter(e => /f5b27a|#555|rgb\(245, 178, 122\)|rgb\(85, 85, 85\)/.test(e.getAttribute('style') || '')).map(e => e.getAttribute('data-note')));
  await ipad.screenshot({ path: path.join(outDir, 'sub37-check-ipad-chord.png') });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  result.ipadChord = { ...chord, heldKeys };
  await ctx.close();

  // Verdict
  const c = result;
  c.pass = {
    keyMakesSound: c.keyDefault.peak > 0.02,
    cutoffChangesSpectrum: c.keyCutoffHigh.centroid > c.keyCutoffLow.centroid * 1.5 && c.keyCutoffHigh.centroid > c.keyCutoffMid.centroid,
    cutoffChangesLevel: c.keyCutoffHigh.peak > c.keyCutoffLow.peak,
    twoFingerChord: heldKeys.length === 2 && chord.peak > 0.02,
    noErrors: c.errors.length === 0,
    allPresetsSound: Object.values(c.presets).every(p => p > 0.02),
  };
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(Object.values(c.pass).every(Boolean) ? 0 : 1);
})();
