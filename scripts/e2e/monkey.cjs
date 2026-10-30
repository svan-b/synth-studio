// ============================================================================
// Monkey test of one instrument: random knob drags, button presses, switch taps,
// presets, play/stop and keys for N seconds; reports every page error with the
// actions just before it (seeded, so a failure can be replayed).
//   node scripts/e2e/monkey.cjs <baseUrl> <device> [seconds] [seed]      TOUCH=1 for iPad touch
// ============================================================================
const { chromium } = require('playwright');
(async () => {
  const [, , base, device, secs = '45', seedArg = '1'] = process.argv;
  let seed = Number(seedArg) >>> 0 || 1;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, hasTouch: process.env.TOUCH === '1' });
  const errs = []; const log = [];
  page.on('pageerror', e => errs.push({ err: String(e).slice(0, 300), after: log.slice(-6) }));
  page.on('console', m => { if (m.type() === 'error') errs.push({ err: m.text().slice(0, 300), after: log.slice(-6) }); });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.addInitScript(d => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('synth-studio-welcomed', '1');
    localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: d, devices: {}, completedLessons: [] }, version: 3 }));
  }, device);
  await page.goto(base, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /tap for sound/i }).click().catch(() => page.mouse.click(4, 4));
  await page.waitForTimeout(600);
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < Number(secs) * 1000) {
    n++;
    const kind = pick(['knob', 'knob', 'button', 'button', 'switch', 'preset', 'space', 'key', 'menu']);
    try {
      if (kind === 'knob') {
        const ks = page.locator('[data-instance] [data-control][role="slider"]');
        const c = await ks.count(); if (!c) continue;
        const k = ks.nth(Math.floor(rnd() * c)); const b = await k.boundingBox(); if (!b) continue;
        const x = b.x + b.width / 2, y = b.y + b.height / 2, dy = (rnd() - 0.5) * 160;
        log.push(`drag ${await k.getAttribute('data-control')} ${Math.round(dy)}`);
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + dy, { steps: 4 }); await page.mouse.up();
      } else if (kind === 'button') {
        const bs = page.locator('[data-instance] [data-control]:is(button)');
        const c = await bs.count(); if (!c) continue;
        const b = bs.nth(Math.floor(rnd() * c));
        log.push(`press ${await b.getAttribute('data-control')}`);
        await b.dispatchEvent('pointerdown', { button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }, { timeout: 500 });
        await page.waitForTimeout(20 + rnd() * 120);
        await b.dispatchEvent('pointerup', { button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }, { timeout: 500 });
      } else if (kind === 'switch') {
        const rs = page.locator('[data-instance] [role="radio"]');
        const c = await rs.count(); if (!c) continue;
        const r = rs.nth(Math.floor(rnd() * c)); log.push(`radio ${await r.getAttribute('aria-label')}`);
        await r.click({ timeout: 500 });
      } else if (kind === 'preset') {
        const sel = page.getByRole('combobox', { name: 'Load preset' });
        if (!(await sel.count())) continue;
        const opts = await sel.locator('option').evaluateAll(o => o.map(x => x.value).filter(Boolean));
        if (!opts.length) continue;
        const v = pick(opts); log.push(`preset ${v}`); await sel.selectOption(v, { timeout: 800 });
      } else if (kind === 'space') {
        log.push('space'); await page.mouse.click(4, 4); await page.keyboard.press('Space');
      } else if (kind === 'key') {
        const k = pick(['a', 's', 'd', 'f', 'g', 'h', 'j', 'z', 'x']); log.push(`key ${k}`);
        await page.keyboard.down(k); await page.waitForTimeout(30 + rnd() * 200); await page.keyboard.up(k);
      } else if (kind === 'menu') {
        log.push('escape'); await page.keyboard.press('Escape');
      }
    } catch (e) { /* element moved or vanished: skip */ }
    await page.waitForTimeout(15 + rnd() * 60);
  }
  await page.keyboard.press('Escape').catch(() => {});
  console.log(JSON.stringify({ device, actions: n, errors: errs.length, first: errs.slice(0, 3) }));
  await browser.close();
})();
