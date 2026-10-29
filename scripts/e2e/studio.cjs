// ============================================================================
// Studio: DFAM + Studio Clock, patch CLOCK -> ADV/CLOCK by tapping the jacks,
// record while the studio plays, download the WAV, reload keeps rack + cable.
//   node scripts/e2e/studio.cjs <baseUrl> <outPrefix>
// ============================================================================
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const [, , url = 'http://localhost:3000', out = 'studio'] = process.argv;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('synth-studio-storage', JSON.stringify({ state: {
      currentDevice: 'dfam', devices: {}, completedLessons: [], review: {}, focusMode: true,
      studio: { rack: [{ id: 'dfam', device: 'dfam' }, { id: 'studio-clock', device: 'studio-clock' }], cables: [], routes: {}, sync: {}, bpm: 120, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } },
    }, version: 5 }));
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('synth-studio-welcomed', '1');
  });
  const result = {};
  try {
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    await p.getByRole('button', { name: /tap for sound/i }).click().catch(() => p.mouse.click(4, 4));
    await p.waitForTimeout(600);
    await p.getByRole('button', { name: /Studio/ }).first().click();
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${out}-studio.png`, fullPage: true });
    const tapJack = async (inst, jack) => {
      const el = p.locator(`[data-instance="${inst}"] [data-jack="${jack}"]`).first();
      await el.scrollIntoViewIfNeeded();
      const box = await el.boundingBox();
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await p.waitForTimeout(150);
    };
    await tapJack('studio-clock', 'out_clock');
    await tapJack('dfam', 'in_adv_clock');
    result.cables = await p.evaluate(() => JSON.parse(localStorage.getItem('synth-studio-storage')).state.studio.cables);
    const peak = ms => p.evaluate(async ms => {
      let m = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < ms) { m = Math.max(m, window.__synthLevel()); await new Promise(r => setTimeout(r, 15)); }
      return +m.toFixed(3);
    }, ms);
    await p.getByRole('button', { name: 'REC' }).click();
    await p.getByRole('button', { name: /Play studio/ }).click();
    result.playPeak = await peak(2500);
    result.pos = await p.getByLabel('Song position').innerText();
    await p.screenshot({ path: `${out}-studio-playing.png` });
    await p.getByRole('button', { name: /Stop studio/ }).click();
    const dl = p.waitForEvent('download');
    await p.getByRole('button', { name: /^\d+:\d\d$/ }).click();
    const download = await dl;
    const file = `${out}-bounce.wav`;
    await download.saveAs(file);
    result.wavBytes = fs.statSync(file).size;
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    result.after = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('synth-studio-storage')).state.studio; return { rack: s.rack.map(r => r.id), cables: s.cables.length }; });
  } catch (e) {
    errs.push('test: ' + String(e).split('\n')[0]);
  }
  console.log(JSON.stringify({ ...result, errs: errs.slice(0, 5) }));
  await b.close();
})();
