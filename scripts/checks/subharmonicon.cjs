// ============================================================================
// Subharmonicon behaviour check (Playwright):
//   node scripts/checks/subharmonicon.cjs http://localhost:3102 <outDir>
// 1. Changing a RHYTHM divider (by dragging the knob) changes how often the
//    sequencer advances and therefore the step pattern (engine state).
// 2. Patching a cable (VCO 2 SUB 2 → CUTOFF, tapping the two jacks) changes
//    the sound (spectral centroid / RMS of the engine output).
// Exits non-zero on failure.
// ============================================================================
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const [, , base = 'http://localhost:3102', outDir = '.'] = process.argv;
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: 'subharmonicon', devices: {}, completedLessons: [] }, version: 3 }));
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const unlock = page.getByRole('button', { name: /enable audio/i });
  if (await unlock.count()) await unlock.click(); else await page.mouse.click(4, 4);
  await page.waitForFunction(() => !!window.__subharmonicon, null, { timeout: 10000 });

  const state = () => page.evaluate(() => window.__subharmonicon.state());
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('synth-studio-storage')).state.devices.subharmonicon);
  // Record the sequence of SEQ 1 steps and count advances over `ms`
  const record = async ms => {
    const a0 = (await state()).advances?.seq1 ?? 0;
    const seen = [];
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const s = await state();
      const st = s.steps?.seq1;
      if (seen[seen.length - 1] !== st) seen.push(st);
      await page.waitForTimeout(25);
    }
    const a1 = (await state()).advances?.seq1 ?? 0;
    return { advances: a1 - a0, steps: seen.join('') };
  };

  const result = { errors };

  // --- 1. Rhythm divider changes the step pattern --------------------------------
  await page.mouse.click(4, 4);
  await page.keyboard.press('Space'); // PLAY
  await page.waitForTimeout(300);
  result.div4 = await record(3000); // default RHYTHM 1 = ÷4 at 240 BPM → ~1 step/s
  const knob = page.locator('[data-control="rhythm1"]');
  const box = await knob.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 260, { steps: 12 }); // fully clockwise → ÷1
  await page.mouse.up();
  result.rhythm1Value = (await stored()).controlValues.rhythm1;
  result.div1 = await record(3000); // ÷1 → ~4 steps/s
  const ratio = result.div1.advances / Math.max(1, result.div4.advances);
  result.rhythmOk = result.rhythm1Value === -1 && ratio > 2.5 && result.div1.steps !== result.div4.steps;
  await page.keyboard.press('Space'); // stop
  await page.waitForTimeout(300);

  // --- 2. A patch cable changes the sound ------------------------------------------
  await page.locator('[data-control="eg_mode"]', { hasText: 'HELD' })
    .dispatchEvent('pointerdown', { button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true });
  await page.waitForTimeout(800);
  const measure = () => page.evaluate(async () => {
    let c = 0, r = 0, n = 0;
    for (let i = 0; i < 20; i++) {
      const m = window.__subharmonicon.probe();
      c += m.centroid; r += m.rms; n++;
      await new Promise(res => setTimeout(res, 40));
    }
    return { centroid: Math.round(c / n), rms: +(r / n).toFixed(4) };
  });
  result.before = await measure();
  await page.locator('[data-jack="out_vco2_sub2"]').click();
  await page.locator('[data-jack="in_cutoff"]').click();
  await page.waitForTimeout(600);
  result.patches = (await stored()).patchConnections;
  result.after = await measure();
  await page.screenshot({ path: path.join(outDir, 'subharmonicon-patched.png') });
  const dc = Math.abs(result.after.centroid - result.before.centroid) / Math.max(1, result.before.centroid);
  const dr = Math.abs(result.after.rms - result.before.rms) / Math.max(1e-4, result.before.rms);
  result.patchOk = result.patches.length === 1 && result.before.rms > 0.005 && (dc > 0.1 || dr > 0.2);

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.rhythmOk && result.patchOk && !errors.length ? 0 : 1);
})();
