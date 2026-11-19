// ============================================================================
// Producer path on an iPad (touch, 1180×820): a learner with a studio of their
// own opens Lessons, finds the Producer path, and takes "Frequency slots" by
// touch: the lesson loads its own studio (theirs is saved), the loudness-matched
// A/B plays recordings of the demo track (not the studio), answers and Next are tapped, the knob moves happen
// on the real instruments, the live challenge checklist turns green, and at the
// end "Bring back the studio I had before this lesson" restores their studio
// (the lesson's is kept as a copy). Prints one JSON object; exits non-zero on a
// failed check.
//   node scripts/e2e/producer.cjs <baseUrl> [outPrefix]
// ============================================================================
const { chromium } = require('playwright');
const { serveDemoRecordings } = require('./demoRecordings.cjs');

const LESSON = 'studio-producer-07-frequency-slots';

(async () => {
  const [, , url = 'http://localhost:3000', out = '/tmp/producer'] = process.argv;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 1 });
  await serveDemoRecordings(ctx);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  // The learner's own studio: a DFAM they have been working on
  await p.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('synth-studio-storage', JSON.stringify({ state: {
      currentDevice: 'dfam', devices: { dfam: { controlValues: { vcf_cutoff: 777, tempo: 96 }, patchConnections: [] } }, completedLessons: [], review: {}, focusMode: true,
      studio: { rack: [{ id: 'dfam', device: 'dfam' }], cables: [], routes: {}, sync: {}, bpm: 96, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } },
    }, version: 6 }));
    localStorage.setItem('synth-studio-welcomed', '1');
    sessionStorage.setItem('seeded', '1');
  });
  const wait = ms => p.waitForTimeout(ms);
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, ...(detail !== undefined ? { detail } : {}) });
  const log = {};

  const tap = async locator => {
    const el = locator.first();
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    if (!box) throw new Error('not on screen: ' + locator);
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await wait(120);
  };
  const coach = () => p.locator('aside[aria-label="Lesson coach"]');
  const S = fn => p.evaluate(fn);
  const step = () => S(() => window.__synthStudio.store.getState().currentStep);
  const satisfied = () => S(() => window.__synthStudio.store.getState().stepSatisfied);
  const waitFor = async (fn, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(150); }
    return false;
  };
  /** Tap an option of the current step's multiple-choice question by its text */
  const answer = async text => tap(coach().getByRole('button', { name: new RegExp(text) }));
  const next = async () => tap(coach().getByRole('button', { name: /Next →|Skip →/ }));
  /** Set a control the way the panel does (knob gestures are covered by touch.cjs) */
  const setControl = (inst, id, v) => p.evaluate(([i, c, x]) => window.__synthStudio.hub.setControl(i, c, x), [inst, id, v]);

  try {
    await p.goto(url, { waitUntil: 'networkidle' });
    await wait(1200);
    await tap(p.getByRole('button', { name: /tap for sound/i })).catch(() => undefined);

    // ---- find the Producer path ------------------------------------------------
    await tap(p.getByRole('button', { name: /^Lessons/ }));
    await p.getByText('Producer path', { exact: true }).waitFor({ timeout: 15000 });
    await wait(400);
    await p.screenshot({ path: `${out}-01-lessons.png` });
    log.pathListed = await p.getByText('Producer path', { exact: true }).count();
    const card = p.getByRole('button', { name: /Frequency slots/ });
    log.cardTag = await card.first().getByText('loads its own studio').count();
    check('lessons: the Producer path is listed, its lessons say they load a studio', log.pathListed >= 1 && log.cardTag === 1, log);
    await tap(card);

    // ---- the lesson's studio, the learner's saved --------------------------------
    await coach().waitFor({ timeout: 15000 });
    await waitFor(() => S(() => window.__synthStudio.hub.instances().length >= 3), 20000);
    await wait(800);
    const st = await S(() => {
      const s = window.__synthStudio.store.getState();
      return {
        lesson: s.currentLesson && s.currentLesson.id, rack: s.studio.rack.map(r => r.id), bpm: s.studio.bpm,
        backups: s.lessonBackups.map(b => ({ label: b.label, pinned: b.pinned, rack: b.studio.rack.map(r => r.id), cutoff: b.devices.dfam && b.devices.dfam.controlValues.vcf_cutoff })),
      };
    });
    log.start = st;
    check('start: the lesson loads Tide Pool (clock, DFAM, Xone:96) at 124 BPM', st.lesson === LESSON && st.rack.join() === 'studio-clock,dfam,xone96' && st.bpm === 124, st);
    check('start: the learner\'s own studio is saved first', st.backups.length === 1 && st.backups[0].pinned && st.backups[0].rack.join() === 'dfam' && st.backups[0].cutoff === 777, st.backups);
    log.banner = await coach().getByText(/This lesson set up its own studio/).count();
    check('coach: says the lesson set up its own studio and theirs is saved', log.banner === 1);
    await p.screenshot({ path: `${out}-02-coach.png` });
    const fit = await S(() => {
      const a = document.querySelector('aside[aria-label="Lesson coach"]').getBoundingClientRect();
      return { left: a.left, right: a.right, top: a.top, bottom: a.bottom, w: innerWidth, h: innerHeight, overflowX: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    check('iPad: the coach fits the screen, no horizontal page scroll', fit.left >= 0 && fit.right <= fit.w && fit.top >= 0 && fit.bottom <= fit.h && !fit.overflowX, fit);

    // ---- 1 · loudness-matched A/B of two recordings of the demo ---------------------
    await tap(coach().getByRole('button', { name: /Mix A/ }));
    await waitFor(() => S(() => window.__synthDemoAudio.getPlayback()?.status === 'playing'), 8000);
    await wait(1200);
    const a = await S(() => ({ studioPlaying: window.__synthStudio.transport.playing, demo: window.__synthDemoAudio.getPlayback()?.status, level: window.__synthLevel() }));
    await tap(coach().getByRole('button', { name: /Mix B/ }));
    await wait(1500);
    const ab = await S(() => ({ side: window.__synthDemoAudio.getPlayback()?.side, text: document.querySelector('aside[aria-label="Lesson coach"] [aria-live="polite"].text-\\[10px\\]')?.textContent ?? '' }));
    log.ab = { a, ab };
    check('A/B: pressing a side plays the demo\'s recording, not the studio', !a.studioPlaying && a.demo === 'playing' && a.level > 0.02, a);
    check('A/B: B switches sides; the coach says both play at the same loudness', ab.side === 'b' && /same loudness/.test(ab.text), ab);
    await p.screenshot({ path: `${out}-03-ab.png` });
    await tap(coach().getByRole('button', { name: /Mix B/ })); // stop
    await answer('Too many parts pile up');
    await wait(300);
    log.revealed = await coach().getByText(/In B every high-pass is off/).count();
    check('A/B: the answer is revealed with its explanation', log.revealed === 1);
    await next();

    // ---- 2 · warm-up quiz, 3 · ▶ in the top bar ----------------------------------------
    await answer('Clock pulses from the Studio Clock');
    await next();
    await tap(p.getByRole('button', { name: 'Play studio' }));
    check('step 3: ▶ completes the step and moves on', await waitFor(async () => (await step()) === 3, 5000), await step());

    // ---- 4 · the DFAM's VCF MODE: "Open DFAM perc" takes the learner there ----------------
    await tap(coach().getByRole('button', { name: /Open DFAM perc/ }));
    await wait(600);
    log.dfamOnScreen = await p.locator('[data-instance="dfam"]').count();
    check('step 4: "Open DFAM perc" shows the DFAM', log.dfamOnScreen >= 1);
    await setControl('dfam', 'vcf_mode', 0);
    check('step 4: VCF MODE HP completes the step', await waitFor(async () => (await step()) === 4, 5000));

    // ---- 5 · predict, then CUTOFF ------------------------------------------------------------
    await answer('Thinner on its own');
    await setControl('dfam', 'vcf_cutoff', 230);
    check('step 5: a committed prediction plus the move completes it', await waitFor(async () => (await step()) === 5, 6000));

    // ---- 6 · Xone channel 3 LO -----------------------------------------------------------------
    await tap(coach().getByRole('button', { name: /Open Xone:96/ }));
    await wait(500);
    await setControl('xone96', 'ch3_lo', -0.3);
    check('step 6: channel 3 LO at about −6 dB completes it', await waitFor(async () => (await step()) === 6, 5000));

    // ---- 7 · a single-instrument A/B (matched), 8 · LO MID ---------------------------------------
    await tap(coach().getByRole('button', { name: /LO MID −6 dB/ }));
    await wait(1800);
    await answer('B, with the cut');
    await tap(coach().getByRole('button', { name: /LO MID −6 dB/ }));
    await next();
    await setControl('xone96', 'ch3_lomid', -0.11);
    check('step 8: LO MID cut completes it', await waitFor(async () => (await step()) === 8, 5000));

    // ---- 9 · quiz, 10 · info, 11 · ear match -------------------------------------------------------
    await answer('Let them take turns');
    await next();
    await next();
    await setControl('xone96', 'ch2_lomid', -0.407);
    await setControl('xone96', 'ch2_himid', 0.45);
    await tap(coach().getByRole('button', { name: /Check my sound/ }));
    // (screen readers hear it too: the live region repeats the text)
    log.matched = await coach().locator('p:visible', { hasText: /Matched by ear/ }).count();
    check('step 11: the ear match accepts the target', log.matched >= 1);
    await next();

    // ---- 12 · the challenge's live checklist ------------------------------------------------------------
    const ticks = () => coach().locator('li span.bg-green-600').count();
    const before = await ticks();
    // Undo one move: its check goes dark; redo it: green again
    await setControl('dfam', 'vcf_mode', 1);
    const broken = await waitFor(async () => (await ticks()) === before - 1, 4000);
    await setControl('dfam', 'vcf_mode', 0);
    await setControl('xone96', 'ch2_lomid', -0.07);
    const after = await waitFor(async () => (await ticks()) === 5, 4000);
    log.checklist = { before, broken, after: await ticks() };
    check('step 12: the checklist updates live and every check passes', broken && after, log.checklist);
    await p.screenshot({ path: `${out}-04-challenge.png` });
    check('step 12: the challenge is satisfied', await satisfied());
    await next();

    // ---- 13 · reflect, the summary -------------------------------------------------------------------
    await tap(coach().getByRole('button', { name: /Write a sentence first|Compare with a model answer/ }));
    await tap(coach().getByRole('button', { name: 'Got it' }));
    await next();
    await coach().locator('p:visible', { hasText: /Lesson complete/ }).first().waitFor({ timeout: 5000 });
    await p.screenshot({ path: `${out}-05-summary.png` });
    const restoreBtn = coach().getByRole('button', { name: /Bring back the studio I had before this lesson/ });
    check('summary: offers to bring back the learner\'s studio', (await restoreBtn.count()) === 1);
    await tap(restoreBtn);
    await wait(1500);
    const back = await S(() => {
      const s = window.__synthStudio.store.getState();
      return { rack: s.studio.rack.map(r => r.id), bpm: s.studio.bpm, cutoff: s.devices.dfam.controlValues.vcf_cutoff, backups: s.lessonBackups.map(b => b.label) };
    });
    log.back = back;
    check('restore: the learner\'s own studio is back, untouched', back.rack.join() === 'dfam' && back.bpm === 96 && back.cutoff === 777, back);
    check('restore: the lesson\'s studio is kept as a copy', back.backups.length === 1 && /Frequency slots/.test(back.backups[0]), back.backups);
    await tap(coach().getByRole('button', { name: 'Finish' }));
    const done = await S(() => window.__synthStudio.store.getState().completedLessons);
    check('finish: the lesson is completed', done.includes(LESSON), done);

    // ---- the saved studio is listed under Lessons -------------------------------------------------------
    await tap(p.getByRole('button', { name: /^Lessons/ }));
    await p.getByText('Saved studios').waitFor({ timeout: 5000 });
    log.saved = await p.getByRole('button', { name: 'Bring it back' }).count();
    check('lessons: the saved studio is listed with "Bring it back"', log.saved === 1, log.saved);
    await p.screenshot({ path: `${out}-06-saved.png` });

    // ---- a reload keeps the backup --------------------------------------------------------------------
    await p.reload({ waitUntil: 'networkidle' });
    await wait(1500);
    const persisted = await S(() => JSON.parse(localStorage.getItem('synth-studio-storage')).state.lessonBackups.length);
    check('reload: the saved studio survives a reload', persisted === 1, persisted);
  } catch (e) {
    errs.push('test: ' + String(e).split('\n')[0]);
  }
  check('no page errors', errs.length === 0, errs.slice(0, 5));
  const failed = results.filter(r => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, failed, log, errs: errs.slice(0, 5) }, null, 1));
  await b.close();
  process.exit(failed.length ? 1 : 0);
})();
