// ============================================================================
// Producer path on an iPad (touch, 1180×820), the Elektron lessons. A learner
// takes "First beat" from start to finish by touch on the Analog Rytm: the
// lesson loads its studio, ▶ Hear it plays a recording of the demo's drums, the trig keys and pads are
// tapped on the real panel (and are not hidden under the coach), ▶ in the top bar
// starts the studio, the A/B, the quiz, the challenge's checklist, the reflect and
// the summary. Then "Groove": the A/B plays other pattern SWING settings on the
// Rytm without changing the learner's pattern, and the ear match is solved with
// the Rytm's own SWING menu ([FUNC] + [BANK G], then [UP]).
// Prints one JSON object; exits non-zero on a failed check.
//   node scripts/e2e/producer-elektron.cjs <baseUrl> [outPrefix]
// ============================================================================
const { chromium } = require('playwright');
const { serveDemoRecordings } = require('./demoRecordings.cjs');

const L1 = 'studio-producer-01-first-beat';
const L2 = 'studio-producer-02-groove';
const RYTM = 'analog-rytm';

(async () => {
  const [, , url = 'http://localhost:3000', out = '/tmp/producer-elektron'] = process.argv;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 1 });
  await serveDemoRecordings(ctx);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  // A learner with a DFAM studio of their own
  await p.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('synth-studio-storage', JSON.stringify({ state: {
      currentDevice: 'dfam', devices: { dfam: { controlValues: { vcf_cutoff: 777 }, patchConnections: [] } }, completedLessons: [], review: {}, focusMode: true,
      studio: { rack: [{ id: 'dfam', device: 'dfam' }], cables: [], routes: {}, sync: {}, bpm: 96, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } },
    }, version: 6 }));
    localStorage.setItem('synth-studio-welcomed', '1');
    sessionStorage.setItem('seeded', '1');
  });
  const wait = ms => p.waitForTimeout(ms);
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, ...(detail !== undefined ? { detail } : {}) });
  const log = {};

  const coach = () => p.locator('aside[aria-label="Lesson coach"]');
  const S = (fn, arg) => p.evaluate(fn, arg);
  const step = () => S(() => window.__synthStudio.store.getState().currentStep);
  const satisfied = () => S(() => window.__synthStudio.store.getState().stepSatisfied);
  const waitFor = async (fn, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(150); }
    return false;
  };
  /** Tap an element; with `uncovered`, first check nothing (the coach) lies over its centre */
  const covered = [];
  const tap = async (locator, opts = {}) => {
    const el = locator.first();
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    if (!box) throw new Error('not on screen: ' + locator);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (opts.uncovered) {
      const hit = await el.evaluate((node, [px, py]) => { const t = document.elementFromPoint(px, py); return !!t && (t === node || node.contains(t)); }, [x, y]);
      if (!hit) covered.push(opts.uncovered);
    }
    await p.touchscreen.tap(x, y);
    await wait(120);
  };
  const answer = async text => tap(coach().getByRole('button', { name: new RegExp(text) }));
  // a learner reads the new step first: the coach has moved out of the way by then
  const settle = () => wait(1400);
  const next = async () => { await tap(coach().getByRole('button', { name: /Next →|Skip →/ })); await settle(); };
  // (the visible panel: other views keep their own copy of an instrument mounted)
  const rytm = () => p.locator(`[data-instance="${RYTM}"]`);
  // in GRID RECORDING the trig keys are the sequencer's (data-step is the 0-based step)
  const trigKey = n => rytm().locator(`button[data-step="${n - 1}"]:visible`);
  const pad = id => rytm().locator(`[data-control="pad:${id}"]:visible`);
  const key = id => rytm().locator(`button[data-control="${id}"]:visible`);
  /** Trigs (1-based) of a Rytm track on the active pattern, from the store */
  const trigsOf = track => S(t => {
    const d = window.__synthStudio.store.getState().devices['analog-rytm'].data;
    const steps = d.patterns[d.active]?.tracks[t]?.steps ?? {};
    return Object.keys(steps).filter(k => !steps[k].trigless).map(k => Number(k) + 1).sort((a, b) => a - b);
  }, track);
  const swingOf = () => S(() => { const d = window.__synthStudio.store.getState().devices['analog-rytm'].data; return d.patterns[d.active].swing; });
  const engineSwing = () => S(() => { const e = window.__synthStudio.hub.getEngine('analog-rytm'); const pr = e && e.project; return pr ? pr.patterns[pr.active].swing : null; });

  try {
    await p.goto(url, { waitUntil: 'networkidle' });
    await wait(1200);
    await tap(p.getByRole('button', { name: /tap for sound/i })).catch(() => undefined);

    // ---- L1 · First beat, from the Lessons dialog ------------------------------------
    await tap(p.getByRole('button', { name: /^Lessons/ }));
    await p.getByText('Producer path', { exact: true }).waitFor({ timeout: 15000 });
    await wait(400);
    const card = p.getByRole('button', { name: /First beat/ });
    log.cardTag = await card.first().getByText('loads its own studio').count();
    check('lessons: "First beat" is listed and says it loads a studio', log.cardTag === 1, log.cardTag);
    await tap(card);
    await coach().waitFor({ timeout: 15000 });
    await settle();
    await waitFor(() => S(() => ['studio-clock', 'analog-rytm', 'analog-four', 'xone96'].every(id => window.__synthStudio.hub.instances().includes(id))), 30000);
    await wait(1000);
    log.start = await S(() => { const s = window.__synthStudio.store.getState(); return { lesson: s.currentLesson && s.currentLesson.id, rack: s.studio.rack.map(r => r.id), bpm: s.studio.bpm, backups: s.lessonBackups.length }; });
    check('start: the Elektron studio (clock, Rytm, A4, Xone) at 124 BPM, the learner\'s studio saved', log.start.lesson === L1 && log.start.rack.join() === 'studio-clock,analog-rytm,analog-four,xone96' && log.start.bpm === 124 && log.start.backups === 1, log.start);
    await p.screenshot({ path: `${out}-01-start.png` });

    // 1 · ▶ Hear it: a recording of the demo's drums
    await tap(coach().getByRole('button', { name: /Hear it/ }));
    log.hearLevel = 0;
    await waitFor(async () => { log.hearLevel = Math.max(log.hearLevel, await S(() => window.__synthLevel())); return log.hearLevel > 0.01; }, 6000);
    log.hearDemo = await S(() => window.__synthDemoAudio.getPlayback()?.clips.map(c => c.file).join());
    check('step 1: ▶ Hear it plays the demo\'s drums (a recording)', log.hearLevel > 0.01 && /drums/.test(log.hearDemo ?? ''), { level: log.hearLevel, file: log.hearDemo });
    await next();

    // 2 · the first win: four trigs on the kick, ▶
    await tap(coach().getByRole('button', { name: /Open Analog Rytm/ }));
    await trigKey(1).first().waitFor({ timeout: 8000 });
    await wait(600);
    await p.screenshot({ path: `${out}-02-rytm.png` });
    for (const n of [1, 5, 9, 13]) await tap(trigKey(n), { uncovered: `trig ${n}` });
    log.bd = await trigsOf(0);
    check('step 2: tapping trig keys 1, 5, 9 and 13 places the kick', log.bd.join() === '1,5,9,13', log.bd);
    await tap(p.getByRole('button', { name: 'Play studio' }));
    check('step 2: ▶ completes the first win', await waitFor(async () => (await step()) === 2, 5000), await step());
    await settle();

    // 3 · predict, then the clap
    await answer('On beats 2 and 4');
    await tap(pad('cp'), { uncovered: 'CP pad' });
    for (const n of [5, 13]) await tap(trigKey(n), { uncovered: `trig ${n}` });
    log.cp = await trigsOf(3);
    check('step 3: the CP pad selects the clap, trigs 5 and 13 place it', log.cp.join() === '5,13', log.cp);
    check('step 3: done', await waitFor(async () => (await step()) === 3, 5000));
    await settle();

    // 4 · off-beat hats
    await tap(pad('ch'), { uncovered: 'CH pad' });
    for (const n of [3, 7, 11, 15]) await tap(trigKey(n), { uncovered: `trig ${n}` });
    check('step 4: off-beat hats placed', await waitFor(async () => (await step()) === 4, 5000), await trigsOf(8));
    await settle();

    // 5 · A/B with and without the hats, 6 · quiz
    await tap(coach().getByRole('button', { name: /With hats/ }));
    await wait(1200);
    log.abPlaying = await S(() => window.__synthStudio.transport.playing);
    await tap(coach().getByRole('button', { name: /Without/ }));
    await wait(1200);
    await answer('Movement between the kicks');
    check('step 5: the A/B plays the studio and the answer counts', log.abPlaying && await waitFor(() => satisfied(), 3000));
    await next();
    await answer('124');
    await next();

    // 7 · the challenge: a rim on 12, checklist live
    await tap(pad('rs'), { uncovered: 'RS pad' });
    await tap(trigKey(12), { uncovered: 'trig 12' });
    const ticks = () => coach().locator('li span.bg-green-600').count();
    check('step 7: every check of the challenge passes', await waitFor(async () => (await ticks()) === 3 && await satisfied(), 5000), await ticks());
    await p.screenshot({ path: `${out}-03-challenge.png` });
    await next();

    // 8 · reflect, the summary, Finish
    await tap(coach().getByRole('button', { name: /Write a sentence first|Compare with a model answer/ }));
    await tap(coach().getByRole('button', { name: 'Got it' }));
    await next();
    await coach().locator('p:visible', { hasText: /Lesson complete/ }).first().waitFor({ timeout: 5000 });
    await tap(coach().getByRole('button', { name: 'Finish' }));
    log.done = await S(() => window.__synthStudio.store.getState().completedLessons);
    check('finish: First beat is completed', log.done.includes(L1), log.done);
    check('iPad: every trig key and pad the lesson asked for was free of the coach', covered.length === 0, covered);

    // ---- L2 · Groove: pattern SWING in the A/B and the ear match ------------------------
    await S(async id => { const all = await window.__synthStudioLessons(); window.__synthStudio.store.getState().startLesson(all.find(l => l.id === id)); }, L2);
    await coach().waitFor({ timeout: 15000 });
    await waitFor(() => S(() => ['analog-rytm', 'xone96'].every(id => window.__synthStudio.hub.instances().includes(id))), 30000);
    await wait(1000);
    // the learner has set 58 % (step 5)
    await S(() => window.__synthLesson.setPatternSettings('analog-rytm', { swing: 58 }));
    await S(() => window.__synthStudio.store.getState().goToStep(5));
    await settle();
    await tap(coach().getByRole('button', { name: '▶ B' }));
    await wait(700);
    log.abB = { engine: await engineSwing(), mine: await swingOf() };
    await tap(coach().getByRole('button', { name: '▶ A' }));
    await wait(700);
    log.abA = { engine: await engineSwing(), mine: await swingOf() };
    await tap(coach().getByRole('button', { name: '■ A' }));
    await wait(700);
    log.abOff = { engine: await engineSwing(), mine: await swingOf(), playing: await S(() => window.__synthStudio.transport.playing) };
    check('groove A/B: B plays 66 %, A 50 %, on the Rytm, the learner\'s pattern stays at 58 %',
      log.abB.engine === 66 && log.abA.engine === 50 && log.abB.mine === 58 && log.abA.mine === 58, { B: log.abB, A: log.abA });
    check('groove A/B: stopping puts the learner\'s swing back and stops the studio', log.abOff.engine === 58 && log.abOff.mine === 58 && !log.abOff.playing, log.abOff);
    await p.screenshot({ path: `${out}-04-groove-ab.png` });

    // 9 · the ear match: it starts at 50 %; the SWING menu by touch
    await S(() => window.__synthStudio.store.getState().goToStep(8));
    await settle();
    log.matchStart = await swingOf();
    check('groove match: the step starts the pattern at 50 %', log.matchStart === 50, log.matchStart);
    await tap(coach().getByRole('button', { name: /A · Target/ }));
    await wait(700);
    log.target = await engineSwing();
    check('groove match: A · Target plays 64 % on the Rytm', log.target === 64, log.target);
    await tap(coach().getByRole('button', { name: /Open Analog Rytm/ }));
    await wait(600);
    await tap(key('key:func'), { uncovered: 'FUNC' });
    await tap(key('key:bank:G'), { uncovered: 'BANK G' });
    for (let k = 0; k < 14; k++) await tap(key('key:up'), { uncovered: 'UP' });
    log.matchSet = await swingOf();
    check('groove match: [FUNC] + [BANK G] then [UP] x14 sets SWING to 64 %', log.matchSet === 64, log.matchSet);
    await tap(coach().getByRole('button', { name: /Check my sound/ }));
    log.matched = await coach().locator('p:visible', { hasText: /Matched by ear/ }).count();
    check('groove match: Check my sound accepts it', log.matched >= 1);
    await p.screenshot({ path: `${out}-05-groove-match.png` });
    check('iPad: the SWING keys were free of the coach', covered.length === 0, covered);
    await S(() => window.__synthStudio.store.getState().resetLesson());
  } catch (e) {
    errs.push('test: ' + String(e).split('\n')[0]);
    log.failedAtStep = await step().catch(() => null);
    await p.screenshot({ path: `${out}-failed.png` }).catch(() => undefined);
  }
  check('no page errors', errs.length === 0, errs.slice(0, 5));
  const failed = results.filter(r => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, failed, log, errs: errs.slice(0, 5) }, null, 1));
  await b.close();
  process.exit(failed.length ? 1 : 0);
})();
