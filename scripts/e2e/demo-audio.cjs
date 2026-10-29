// ============================================================================
// Demo recordings on an iPad (touch, 1180×820): the Producer path's hooks and
// demo A/Bs, and the demo cards' Listen (lib/studio/demoAudio.ts).
//   - First beat, step 1: ▶ Hear it plays the excerpt at the level the player
//     says (the manifest's loudness plus its trim, measured on its output, BS.1770),
//     and Next stops it
//   - Frequency slots, step 1, with the studio playing underneath: A and B play at
//     the same loudness, the speakers get the recording alone (the studio is held
//     back) while the studio keeps running and metering, the lit side again
//     stops, and the studio's ■ stops it
//   - the demo cards: Listen plays the whole song without loading it, ■ stops
//   - every new control is at least 44 px; screenshots of the step and the cards
// Prints one JSON object; exits non-zero on a failed check.
//   node scripts/e2e/demo-audio.cjs <baseUrl> [outPrefix]
// ============================================================================
const { chromium } = require('playwright');
const { initScript, installTap, makeTap, r1 } = require('./demoTap.cjs');
const { serveDemoRecordings } = require('./demoRecordings.cjs');

const L1 = 'studio-producer-01-first-beat';
const L7 = 'studio-producer-07-frequency-slots';

(async () => {
  const [, , url = 'http://localhost:3000', out = '/tmp/demo-audio'] = process.argv;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 2 });
  await serveDemoRecordings(ctx);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('synth-studio-storage', JSON.stringify({ state: {
      currentDevice: 'dfam', devices: {}, completedLessons: [], review: {}, focusMode: true,
      studio: { rack: [{ id: 'dfam', device: 'dfam' }], cables: [], routes: {}, sync: {}, bpm: 120, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } },
    }, version: 6 }));
    localStorage.setItem('synth-studio-welcomed', '1');
    sessionStorage.setItem('seeded', '1');
  });
  await p.addInitScript(initScript);
  const wait = ms => p.waitForTimeout(ms);
  const S = (fn, arg) => p.evaluate(fn, arg);
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, ...(detail !== undefined ? { detail } : {}) });
  const log = {};
  const coach = () => p.locator('aside[aria-label="Lesson coach"]');
  const waitFor = async (fn, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(100); }
    return false;
  };
  const tap = async locator => {
    const el = locator.first();
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    if (!box) throw new Error('not on screen: ' + locator);
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await wait(120);
    return box;
  };
  const size = async locator => { const bx = await locator.first().boundingBox(); return bx ? { w: Math.round(bx.width), h: Math.round(bx.height) } : null; };
  const big = sz => !!sz && sz.w >= 44 && sz.h >= 44;
  const playback = () => S(() => window.__synthDemoAudio.getPlayback());
  const now = () => S(() => window.__synthStudio.audio.getAudioContext().currentTime);
  const untilAudio = async t => { while ((await now()) < t) await wait(50); };
  const startLesson = async id => {
    await S(async lid => { const all = await window.__synthStudioLessons(); window.__synthStudio.store.getState().startLesson(all.find(l => l.id === lid)); }, id);
    await coach().waitFor({ timeout: 15000 });
    await waitFor(() => S(() => { const st = window.__synthStudio.store.getState().studio; return st.rack.every(r => window.__synthStudio.hub.instances().includes(r.id)); }), 30000);
    await wait(1400);
  };
  /** Integrated loudness of a tap over [a, b) audio seconds */
  const lufs = (cap, id, a, z) => {
    const t = cap.taps.find(x => x.id === id);
    return r1(makeTap(t, cap.sampleRate, cap.started.time).lufs(a, z));
  };

  try {
    await p.goto(url, { waitUntil: 'networkidle' });
    await wait(1200);
    await tap(p.getByRole('button', { name: /tap for sound/i })).catch(() => undefined);
    await waitFor(() => S(() => window.__synthStudio.hub.status === 'on'), 15000);
    await installTap(p);

    // ---- 1 · an info step: First beat's hook ------------------------------------------
    await startLesson(L1);
    const hear = coach().getByRole('button', { name: /Hear it/ });
    await hear.first().scrollIntoViewIfNeeded();
    log.hearSize = await size(hear);
    log.caption = (await coach().getByText(/Low Tide Lights · bars 17–20/).count()) > 0;
    check('hook: ▶ Hear it is at least 44 × 44 px, with the demo and bars it plays', big(log.hearSize) && log.caption, { size: log.hearSize, caption: log.caption });
    await p.screenshot({ path: `${out}-01-hook.png` });
    log.rackBefore = await S(() => window.__synthStudio.store.getState().studio.rack.map(r => r.id).join());
    await tap(hear);
    check('hook: it plays', await waitFor(async () => (await playback())?.status === 'playing', 10000), await playback());
    await S(() => window.__demoTap.start(['demo', 'master']));
    const pb1 = await playback();
    await untilAudio(pb1.startedAt + pb1.clips[0].loop + 0.05);
    await p.screenshot({ path: `${out}-02-hook-playing.png` });
    let cap = await S(() => window.__demoTap.stop());
    const clip = pb1.clips[0];
    const expected = clip.lufs + pb1.gainDb[0];
    log.hook = {
      file: clip.file, manifestLufs: clip.lufs, trimDb: r1(pb1.gainDb[0]), target: r1(pb1.targetLufs), expected: r1(expected),
      measured: lufs(cap, 'demo', pb1.startedAt + 0.03, pb1.startedAt + clip.loop),
      speakers: lufs(cap, 'master', pb1.startedAt + 0.03, pb1.startedAt + clip.loop),
    };
    check('hook: it plays at the expected level (manifest loudness + trim, ±1 LU), -20 LUFS before the studio has played',
      Math.abs(log.hook.measured - expected) <= 1 && Math.abs(pb1.targetLufs + 20) < 0.01 && Math.abs(expected + 20) < 0.01, log.hook);
    check('hook: the speakers get the recording (the studio is stopped)', Math.abs(log.hook.speakers - log.hook.measured) <= 0.5, log.hook);
    // it ends by itself; then again, and Next: leaving the step stops it
    log.endsByItself = await waitFor(async () => (await playback()) === null, 5000);
    check('hook: it ends by itself', log.endsByItself);
    await tap(hear);
    await waitFor(async () => (await playback())?.status === 'playing', 10000);
    await S(() => window.__demoTap.start(['demo']));
    await wait(600);
    const tNext = await now();
    await tap(p.locator('aside[aria-label="Lesson coach"] button', { hasText: /Next →|Skip →/ }));
    await wait(500);
    cap = await S(() => window.__demoTap.stop());
    const t = makeTap(cap.taps[0], cap.sampleRate, cap.started.time);
    log.afterNext = {
      playback: await playback(), step: await S(() => window.__synthStudio.store.getState().currentStep),
      peakBefore: Math.round(t.peak(tNext - 0.4, tNext) * 1e4) / 1e4, peakAfter: Math.round(t.peak(tNext + 0.3, tNext + 0.55) * 1e5) / 1e5,
    };
    check('hook: Next stops it (silent within 300 ms of the press)', log.afterNext.playback === null && log.afterNext.peakBefore > 0.01 && log.afterNext.peakAfter < 0.001 && log.afterNext.step === 1, log.afterNext);
    check('hook: the studio was not touched', (await S(() => window.__synthStudio.store.getState().studio.rack.map(r => r.id).join())) === log.rackBefore);

    // ---- 2 · a demo A/B over the learner's studio: Frequency slots ----------------------
    await startLesson(L7);
    // the learner's studio plays first (Tide Pool): the recordings then play at its level
    await tap(p.getByRole('button', { name: 'Play studio' }));
    const tStudio = await now();
    await S(() => window.__demoTap.start(['master']));
    await wait(8000);
    cap = await S(() => window.__demoTap.stop());
    log.studio = await S(() => ({ lufs: window.__synthDemoAudio.studioLoudness(), target: window.__synthDemoAudio.targetLufs() }));
    log.studio.measured = lufs(cap, 'master', tStudio + 1, tStudio + 7.9);
    const mixA = coach().getByRole('button', { name: /Mix A/ }), mixB = coach().getByRole('button', { name: /Mix B/ });
    await mixA.first().scrollIntoViewIfNeeded();
    log.abSize = { a: await size(mixA), b: await size(mixB) };
    await tap(mixA);
    check('A/B: A plays', await waitFor(async () => (await playback())?.status === 'playing', 10000), await playback());
    await S(() => window.__demoTap.start(['demo', 'master']));
    const pbA = await playback();
    const loop = pbA.seconds;
    // A for one whole loop, then B for one whole loop (from wherever it is: the same bars)
    await untilAudio(pbA.startedAt + loop + 0.05);
    await tap(mixB);
    const tB = await now();
    log.meterDuringDemo = await S(() => window.__synthStudio.audio.getLastMasterMeter()?.m);
    await untilAudio(tB + loop + 0.1);
    await p.screenshot({ path: `${out}-03-ab.png` });
    cap = await S(() => window.__demoTap.stop());
    const pbB = await playback();
    log.ab = {
      sizes: log.abSize, files: pbA.clips.map(c => c.file), manifestLufs: pbA.clips.map(c => c.lufs), trimDb: pbA.gainDb.map(r1), target: r1(pbA.targetLufs),
      a: lufs(cap, 'demo', pbA.startedAt + 0.03, pbA.startedAt + loop), b: lufs(cap, 'demo', tB + 0.08, tB + 0.08 + loop),
      speakersA: lufs(cap, 'master', pbA.startedAt + 0.03, pbA.startedAt + loop), speakersB: lufs(cap, 'master', tB + 0.08, tB + 0.08 + loop),
      side: pbB?.side, studio: log.studio, studioPlaying: await S(() => window.__synthStudio.transport.playing), meterDuringDemo: r1(log.meterDuringDemo ?? -Infinity),
    };
    check('A/B: both sides are at least 44 px tall', big(log.abSize.a) && big(log.abSize.b), log.abSize);
    check('A/B: A and B play at the same loudness (±1 LU), at the trim the player set', Math.abs(log.ab.a - log.ab.b) <= 1 &&
      Math.abs(log.ab.a - (pbA.clips[0].lufs + pbA.gainDb[0])) <= 1 && Math.abs(log.ab.b - (pbA.clips[1].lufs + pbA.gainDb[1])) <= 1, log.ab);
    check('A/B: it plays near the level the studio played at (its loudness at the speakers, ±1.5 LU)',
      log.studio.lufs !== null && Math.abs(log.ab.a - log.studio.measured) <= 1.5 && Math.abs(log.ab.b - log.studio.measured) <= 1.5, { studio: log.studio, a: log.ab.a, b: log.ab.b });
    check('A/B: the speakers get the recording alone while the studio keeps running and metering',
      Math.abs(log.ab.speakersA - log.ab.a) <= 0.5 && Math.abs(log.ab.speakersB - log.ab.b) <= 0.5 && log.ab.studioPlaying && log.ab.meterDuringDemo > -40, log.ab);
    // the lit side again stops it; the studio plays on
    await tap(coach().getByRole('button', { name: /Mix B/ }));
    await wait(300);
    log.secondPress = { playback: await playback(), studioPlaying: await S(() => window.__synthStudio.transport.playing) };
    check('A/B: pressing the lit side again stops it, the studio plays on', log.secondPress.playback === null && log.secondPress.studioPlaying, log.secondPress);
    // the studio's ■ stops it
    await tap(mixA);
    await waitFor(async () => (await playback())?.status === 'playing', 10000);
    await tap(p.getByRole('button', { name: 'Stop studio' }));
    await wait(300);
    log.studioStop = { playback: await playback(), studioPlaying: await S(() => window.__synthStudio.transport.playing) };
    check('A/B: the studio\'s ■ stops it', log.studioStop.playback === null && !log.studioStop.studioPlaying, log.studioStop);
    // and the studio's ▶
    await tap(mixA);
    await waitFor(async () => (await playback())?.status === 'playing', 10000);
    await tap(p.getByRole('button', { name: 'Play studio' }));
    await wait(300);
    log.studioPlay = { playback: await playback(), studioPlaying: await S(() => window.__synthStudio.transport.playing) };
    check('A/B: the studio\'s ▶ stops it', log.studioPlay.playback === null && log.studioPlay.studioPlaying, log.studioPlay);
    await tap(p.getByRole('button', { name: 'Stop studio' }));
    await S(() => window.__synthStudio.store.getState().resetLesson());
    await wait(500);

    // ---- 3 · the demo cards: Listen ------------------------------------------------------
    await tap(p.getByRole('button', { name: /Studio/ }));
    await p.getByText('Opening the studio…').waitFor({ state: 'detached', timeout: 20000 }).catch(() => undefined);
    const cards = p.locator('section[aria-label="Demo tracks"]');
    await cards.waitFor({ timeout: 15000 });
    await cards.scrollIntoViewIfNeeded();
    await wait(600);
    await p.screenshot({ path: `${out}-04-cards.png` });
    const listen = cards.getByRole('button', { name: /Listen to a recording of the demo track/ });
    log.cards = { listen: await listen.count(), sizes: [] };
    for (let k = 0; k < log.cards.listen; k++) log.cards.sizes.push(await size(listen.nth(k)));
    log.cards.load = await size(cards.getByRole('button', { name: /^Load the demo track/ }));
    log.cards.note = await cards.getByText(/Listen plays a recording/).count();
    check('cards: every demo has a Listen button (44 px) and says it is a recording, Load the real instruments',
      log.cards.listen === 3 && log.cards.sizes.every(big) && big(log.cards.load) && log.cards.note === 3, log.cards);
    const before = await S(() => { const st = window.__synthStudio.store.getState().studio; return { rack: st.rack.map(r => r.id).join(), sections: st.arrangement.sections.length }; });
    await tap(cards.getByRole('button', { name: 'Listen to a recording of the demo track Low Tide Lights' }));
    check('cards: Listen plays the whole song', await waitFor(async () => (await playback())?.status === 'playing', 30000), await playback());
    await S(() => window.__demoTap.start(['demo']));
    await wait(2500);
    await p.screenshot({ path: `${out}-05-cards-listening.png` });
    cap = await S(() => window.__demoTap.stop());
    const pbC = await playback();
    const tc = makeTap(cap.taps[0], cap.sampleRate, cap.started.time);
    log.listen = { file: pbC?.clips[0].file, seconds: pbC?.seconds, peak: Math.round(tc.peak(cap.started.time, cap.started.time + 2.4) * 1000) / 1000 };
    const after = await S(() => { const st = window.__synthStudio.store.getState().studio; return { rack: st.rack.map(r => r.id).join(), sections: st.arrangement.sections.length, playing: window.__synthStudio.transport.playing }; });
    check('cards: it sounds, and the studio is not loaded or started', log.listen.peak > 0.01 && after.rack === before.rack && after.sections === before.sections && !after.playing, { listen: log.listen, before, after });
    await tap(cards.getByRole('button', { name: /Stop the recording of Low Tide Lights/ }));
    await wait(300);
    check('cards: ■ Stop stops it', (await playback()) === null);
  } catch (e) {
    errs.push('test: ' + String(e).split('\n')[0]);
    await p.screenshot({ path: `${out}-failed.png` }).catch(() => undefined);
  }
  check('no page errors', errs.length === 0, errs.slice(0, 5));
  const failed = results.filter(r => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, failed, log, errs: errs.slice(0, 5) }, null, 1));
  await b.close();
  process.exit(failed.length ? 1 : 0);
})();
