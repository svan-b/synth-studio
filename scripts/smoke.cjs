// ============================================================================
// Smoke test a device in a real browser:
//   node scripts/smoke.cjs <baseUrl> <deviceId> <outDir>
// Screenshots at desktop and iPad-landscape sizes, unlocks audio, then tries the
// transport (Space), the computer keyboard and every momentary button, measuring
// the real output level after each. Prints JSON and any console errors.
// ============================================================================
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const [, , base = 'http://localhost:3000', device = 'dfam', outDir = '.'] = process.argv;
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const report = { device, sizes: {}, errors: [] };

  for (const [name, w, h] of [['desktop', 1440, 900], ['ipad', 1180, 820]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: name === 'ipad' });
    page.on('console', m => { if (m.type() === 'error') report.errors.push(`[${name}] ${m.text()}`); });
    page.on('pageerror', e => report.errors.push(`[${name}] ${String(e)}`));
    await page.addInitScript(d => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: d, devices: {}, completedLessons: [] }, version: 3 }));
        sessionStorage.setItem('seeded', '1');
      localStorage.setItem('synth-studio-welcomed', '1');
      }
    }, device);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(outDir, `${device}-${name}.png`) });
    const info = { overflowX: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) };

    if (name === 'desktop') {
      const unlock = page.getByRole('button', { name: /enable audio|tap for sound/i });
      if (await unlock.count()) await unlock.click(); else await page.mouse.click(4, 4);
      await page.waitForTimeout(800);
      info.audio = (await page.getByRole('button', { name: /^(audio|tap for sound|starting|audio error)/i }).first().innerText()).trim();
      const peak = ms => page.evaluate(async ms => {
        let m = 0; const t0 = performance.now();
        while (performance.now() - t0 < ms) { m = Math.max(m, window.__synthLevel ? window.__synthLevel() : 0); await new Promise(r => setTimeout(r, 15)); }
        return +m.toFixed(3);
      }, ms);
      info.idlePeak = await peak(300);

      // Keyboard notes
      await page.keyboard.down('a'); info.noteA = await peak(500); await page.keyboard.up('a');
      await page.keyboard.down('g'); info.noteG = await peak(500); await page.keyboard.up('g');
      await page.waitForTimeout(300);

      // Transport
      await page.mouse.click(4, 4);
      await page.keyboard.press('Space');
      info.transportPeak = await peak(2000);
      await page.screenshot({ path: path.join(outDir, `${device}-playing.png`) });
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);

      // Every button on the panel (pads, trigs, momentary): press + release, record the loudest
      const buttons = page.locator('[data-control]:is(button)');
      const n = Math.min(await buttons.count(), 60);
      let loudest = 0;
      for (let i = 0; i < n; i++) {
        const b = buttons.nth(i);
        try {
          await b.dispatchEvent('pointerdown', { button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true });
          await page.waitForTimeout(30);
          await b.dispatchEvent('pointerup', { button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true });
          loudest = Math.max(loudest, await peak(120));
        } catch { /* hidden */ }
      }
      info.buttonsTried = n;
      info.buttonPeak = loudest;
    }
    report.sizes[name] = info;
    await page.close();
  }
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})();
