// ============================================================================
// iPad user journey (touch, 1180×820): first visit -> DFAM -> studio Play/Stop
// -> TRIGGER and RUN by touch -> switch to the Sub 37 -> play a key -> start a
// lesson -> reload. Prints one JSON line; run.cjs checks it.
//   node scripts/e2e/journey.cjs <baseUrl> <outPrefix>
// ============================================================================
const { chromium } = require('playwright');

(async () => {
  const [, , url = 'http://localhost:3000', out = 'journey'] = process.argv;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const log = {};
  const peak = ms => p.evaluate(async ms => {
    let m = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { m = Math.max(m, window.__synthLevel ? window.__synthLevel() : 0); await new Promise(r => setTimeout(r, 15)); }
    return +m.toFixed(3);
  }, ms);
  const tapSel = async sel => {
    const el = p.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    if (!box) throw new Error('no box for ' + sel);
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  };
  try {
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1000);
    await p.screenshot({ path: `${out}-01-first-visit.png` });
    log.welcome = await p.getByRole('dialog').count();
    if (log.welcome) await p.getByRole('button', { name: /Just explore/ }).click();
    await p.waitForTimeout(400);
    const open = p.getByRole('dialog').getByRole('button', { name: /^(Open|Switch to this)$/ }).first();
    if (await open.count()) await open.click();
    await p.waitForTimeout(1200);
    const unlock = p.getByRole('button', { name: /tap for sound|enable audio/i });
    if (await unlock.count()) await unlock.first().click(); else await p.mouse.click(4, 4);
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${out}-02-dfam.png` });
    // The big Play plays the instrument on screen; Stop silences it
    await p.getByRole('button', { name: /Play studio/ }).click();
    log.bigPlayPeak = await peak(1500);
    await p.getByRole('button', { name: /Stop studio/ }).click();
    await p.waitForTimeout(800);
    log.afterBigStop = await peak(500);
    await tapSel('[data-control="trigger"]');
    log.dfamTrigger = await peak(500);
    await tapSel('[data-control="run_stop"]');
    log.dfamRunning = await peak(1500);
    // Switching instruments stops the previous one
    await p.getByRole('button', { name: /^(Instruments…|\+ Instrument)$/ }).click();
    await p.waitForTimeout(300);
    const card = p.getByRole('dialog').locator('div', { hasText: 'Sub 37' }).filter({ has: p.getByRole('button', { name: /^(Open|Switch to this)$/ }) }).last();
    await card.getByRole('button', { name: /^(Open|Switch to this)$/ }).click();
    await p.waitForTimeout(2000);
    log.afterSwitchSilence = await peak(1200);
    await p.screenshot({ path: `${out}-03-sub37.png` });
    const key = p.locator('[data-note]').nth(12);
    const kb = await key.boundingBox();
    if (kb) {
      await p.touchscreen.tap(kb.x + kb.width / 2, kb.y + kb.height * 0.8);
      log.sub37Key = await peak(400);
    }
    // Lessons: the instrument's own lessons first, one recommended
    await p.getByRole('button', { name: /start a lesson|lessons/i }).first().click();
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}-04-lessons.png` });
    log.lessonSections = await p.getByRole('dialog').locator('h4').allInnerTexts();
    log.recommended = await p.getByRole('dialog').locator('button', { hasText: 'Recommended next' }).innerText().catch(() => null);
    const firstLesson = p.getByRole('dialog').locator('section button').first();
    if (await firstLesson.count()) { await firstLesson.click(); await p.waitForTimeout(800); }
    await p.screenshot({ path: `${out}-05-lesson-running.png` });
    log.coach = await p.locator('aside').count();
    // Reload: nothing plays by itself, layout fits
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${out}-06-reload.png` });
    log.rackAfter = await p.evaluate(() => JSON.parse(localStorage.getItem('synth-studio-storage')).state.studio.rack.map(r => r.id));
    log.afterReloadSilence = await peak(1000);
    log.headerHeight = await p.evaluate(() => document.querySelector('header').getBoundingClientRect().height);
    log.overflowX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  } catch (e) {
    errs.push('test: ' + String(e).split('\n')[0]);
  }
  console.log(JSON.stringify({ log, errs: errs.slice(0, 12) }));
  await b.close();
})();
