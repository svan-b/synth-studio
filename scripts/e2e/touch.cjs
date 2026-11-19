// ============================================================================
// Touch gestures on the panel, iPad landscape (1180×820, hasTouch). Fingers are
// real touch points sent through the DevTools protocol - the path a finger takes
// (touch -> pointer events, touch-action, scroll gestures) - not synthetic DOM
// events. Prints one JSON line; run.cjs checks it.
//   node scripts/e2e/touch.cjs <baseUrl> <outPrefix>
//
//   value bubble  while dragging: the control's name and value with units, above
//                 the finger (first drags: the "slide sideways" hint); gone after
//   fine adjust   a second finger off the controls, a long press before dragging,
//                 and sliding sideways away from the knob each slow the knob down
//   double-tap    resets a knob to its default; two slow taps change nothing
//   no scroll     dragging a knob (with a second finger moving meanwhile) never
//                 scrolls the page; the same drag beside the panel does
//   momentary     a lesson step "tap TRIGGER twice" counts real taps on the panel's
//                 button, completes on the second and moves on
//   spectrum      a step with scope: 'spectrum' switches the coach's scope, which
//                 draws the output's spectrum while the DFAM plays
// ============================================================================
const { chromium } = require('playwright');

const KNOB = 'vcf_resonance'; // DFAM RESONANCE: linear 0..100 %, default 0
const DRAG_PX = 60;

(async () => {
  const [, , url = 'http://localhost:3000', out = 'touch'] = process.argv;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('synth-studio-storage', JSON.stringify({ state: {
      currentDevice: 'dfam', devices: {}, completedLessons: [], review: {}, focusMode: true,
      studio: { rack: [{ id: 'dfam', device: 'dfam' }], cables: [], routes: {}, sync: {}, bpm: 120, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } },
    }, version: 5 }));
    localStorage.setItem('synth-studio-welcomed', '1');
    localStorage.removeItem('synth-studio-scrub-hints'); // first touch drags show the hint
    sessionStorage.setItem('seeded', '1');
  });
  const wait = ms => p.waitForTimeout(ms);
  const log = {};

  // ---- fingers ---------------------------------------------------------------
  // Every touchStart / touchMove lists all fingers still down; touchEnd names the one that lifts
  const cdp = await ctx.newCDPSession(p);
  const down = new Map();
  const points = () => [...down].map(([id, q]) => ({ id, x: q.x, y: q.y, radiusX: 6, radiusY: 6, force: 1 }));
  const touchDown = async (id, x, y) => { down.set(id, { x, y }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points() }); };
  const touchMove = async (id, x, y) => { down.set(id, { x, y }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points() }); };
  const touchUp = async id => {
    const q = down.get(id);
    down.delete(id);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id, x: q.x, y: q.y }] });
  };
  /** Slide a finger to (x, y) in `steps` moves, one per frame */
  const slide = async (id, x, y, steps = 10) => {
    const { x: x0, y: y0 } = down.get(id);
    for (let i = 1; i <= steps; i++) {
      await touchMove(id, x0 + ((x - x0) * i) / steps, y0 + ((y - y0) * i) / steps);
      await wait(16);
    }
  };
  const tap = async (x, y, id = 9) => { await touchDown(id, x, y); await wait(40); await touchUp(id); };
  const center = async sel => {
    const box = await p.locator(sel).first().boundingBox();
    if (!box) throw new Error('not on screen: ' + sel);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, w: box.width, h: box.height };
  };

  // ---- page state ------------------------------------------------------------------
  const setKnob = v => p.evaluate(([id, v]) => window.__synthStudio.store.getState().setControlValue('dfam', id, v), [KNOB, v]);
  const knobValue = () => p.evaluate(id => {
    const v = window.__synthStudio.store.getState().devices.dfam?.controlValues?.[id];
    return typeof v === 'number' ? v : 0;
  }, KNOB);
  const bubble = () => p.evaluate(() => {
    const el = document.querySelector('[data-value-bubble]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const text = cls => el.querySelector(cls)?.textContent ?? null;
    return { label: text('.ssc-bubble-label'), value: text('.ssc-bubble-value'), mode: text('.ssc-bubble-mode'), hint: text('.ssc-bubble-hint'), top: Math.round(r.top), bottom: Math.round(r.bottom), visible: getComputedStyle(el).position === 'fixed' };
  });
  const knobSel = `[data-instance="dfam"] [role="slider"][data-control="${KNOB}"]`;
  const ratio = (d, coarse) => +(d / coarse).toFixed(3);

  try {
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.__synthStudio, null, { timeout: 15000 });
    await p.waitForSelector(knobSel, { timeout: 15000 });
    await wait(800);
    const k = await center(knobSel);
    log.knob = { id: KNOB, size: Math.round(k.w) };

    // ---- 1. value bubble on a plain drag (also the full-speed reference) ------------
    await setKnob(50);
    await touchDown(0, k.x, k.y);
    await slide(0, k.x, k.y - DRAG_PX);
    await wait(80);
    const during = await bubble();
    const knobText = await p.locator(knobSel).getAttribute('aria-valuetext');
    await p.screenshot({ path: `${out}-bubble.png` });
    await touchUp(0);
    await wait(80);
    const coarse = +((await knobValue()) - 50).toFixed(2);
    log.coarse = coarse;
    await wait(800);
    const after = await bubble();
    log.bubble = {
      during, knobText, fingerY: Math.round(k.y - DRAG_PX),
      matchesKnob: !!during && during.value === knobText,
      aboveFinger: !!during && during.bottom <= k.y - DRAG_PX - 40,
      hiddenAfterRelease: after === null,
    };

    // ---- 2. fine adjust: a second finger resting off the controls -----------------------
    const spot = await p.evaluate(() => {
      // Somewhere beside the panel that is not a control, link or button
      const tries = [[24, 760], [24, 640], [1160, 780], [24, 420], [590, 805]];
      for (const [x, y] of tries) {
        const el = document.elementFromPoint(x, y);
        if (el && !el.closest('[data-control], [data-jack], button, input, select, textarea, a, summary, label')) return { x, y, tag: el.tagName };
      }
      return null;
    });
    if (!spot) throw new Error('no empty spot for a second finger');
    log.restingFinger = spot;
    await setKnob(50);
    await touchDown(0, k.x, k.y);
    await wait(30);
    await touchDown(1, spot.x, spot.y);
    await wait(30);
    await slide(0, k.x, k.y - DRAG_PX);
    await wait(80);
    const secondBubble = await bubble();
    await p.screenshot({ path: `${out}-second-finger.png` });
    const fineDelta = +((await knobValue()) - 50).toFixed(2);
    // Lift the resting finger: back to full speed for the rest of the drag
    await touchUp(1);
    await wait(30);
    const v0 = await knobValue();
    await slide(0, k.x, k.y - DRAG_PX * 1.5, 5);
    await wait(80);
    const backDelta = +((await knobValue()) - v0).toFixed(2);
    await touchUp(0);
    await wait(500);
    log.secondFinger = { delta: fineDelta, ratio: ratio(fineDelta, coarse), mode: secondBubble?.mode ?? null, afterLiftRatio: ratio(backDelta, coarse / 2) };

    // ---- 3. fine adjust: hold still, then drag ------------------------------------------------
    await setKnob(50);
    await touchDown(0, k.x, k.y);
    await wait(700);
    const holding = await bubble();
    await slide(0, k.x, k.y - DRAG_PX);
    await wait(80);
    await touchUp(0);
    await wait(80);
    const longDelta = +((await knobValue()) - 50).toFixed(2);
    await wait(500);
    log.longPress = { delta: longDelta, ratio: ratio(longDelta, coarse), modeWhileHolding: holding?.mode ?? null };

    // ---- 4. fine adjust: slide sideways away from the knob, then up --------------------------------
    const sideways = async offset => {
      const dir = k.x + k.w / 2 + offset < 1170 ? 1 : -1;
      await setKnob(50);
      await touchDown(0, k.x, k.y);
      await slide(0, k.x + dir * (k.w / 2 + offset), k.y, 8);
      const v = await knobValue();
      await slide(0, k.x + dir * (k.w / 2 + offset), k.y - DRAG_PX);
      await wait(80);
      const bb = await bubble();
      await touchUp(0);
      await wait(80);
      const d = +((await knobValue()) - v).toFixed(2);
      await wait(500);
      return { offset, delta: d, ratio: ratio(d, coarse), mode: bb?.mode ?? null, sidewaysMoved: +(v - 50).toFixed(2) };
    };
    log.sideways = { half: await sideways(80), fine: await sideways(220) };

    // ---- 5. double-tap resets to the default; slow taps don't --------------------------------------
    await setKnob(50);
    await tap(k.x, k.y);
    await wait(90);
    await tap(k.x, k.y);
    await wait(120);
    const resetBubble = await bubble();
    const afterDouble = await knobValue();
    await wait(900);
    await setKnob(50);
    await tap(k.x, k.y);
    await wait(700);
    await tap(k.x, k.y);
    await wait(150);
    log.doubleTap = { after: afterDouble, mode: resetBubble?.mode ?? null, slowTaps: await knobValue() };
    await wait(900);

    // ---- 6. dragging a knob never scrolls the page ------------------------------------------------------
    await p.evaluate(() => {
      const s = document.createElement('div');
      s.id = 'e2e-spacer';
      s.style.height = '1600px';
      document.body.appendChild(s);
      window.scrollTo(0, 0);
    });
    await wait(200);
    const scrollY = () => p.evaluate(() => Math.round(window.scrollY));
    // A knob drag, with a second finger sliding beside the panel meanwhile
    await setKnob(20);
    await touchDown(0, k.x, k.y);
    await slide(0, k.x, k.y - 120, 8);
    const knobOnly = await scrollY();
    await touchDown(1, spot.x, 600);
    await slide(1, spot.x, 300, 8);
    await wait(150);
    const withSecond = await scrollY();
    await touchUp(1);
    await touchUp(0);
    await wait(400);
    const knobMoved = +((await knobValue()) - 20).toFixed(2);
    const lockReleased = await p.evaluate(() => document.documentElement.style.touchAction !== 'none' && !document.documentElement.dataset.controlDrag);
    // The same drag beside the panel scrolls (the check can see a scroll), so the lock is gone again
    await touchDown(2, spot.x, 600);
    await slide(2, spot.x, 300, 8);
    await touchUp(2);
    await wait(600);
    const besidePanel = await scrollY();
    await p.evaluate(() => { document.getElementById('e2e-spacer')?.remove(); window.scrollTo(0, 0); });
    await wait(300);
    log.scroll = { duringKnobDrag: knobOnly, withSecondFinger: withSecond, knobMoved, lockReleased, besidePanel };

    // ---- 7. a momentary-button do-step completes on real taps ------------------------------------------
    await p.evaluate(() => window.__synthStudio.store.getState().startLesson({
      id: 'dfam-e2e-touch', device: 'dfam', name: 'Touch check', description: 'e2e', difficulty: 'beginner', source: 'scripts/e2e/touch.cjs',
      steps: [
        { instruction: 'Tap TRIGGER twice.', control: 'trigger', presses: 2, principle: 'A trigger starts the envelopes without moving the sequencer.' },
        { kind: 'info', instruction: 'Watch the spectrum while the DFAM plays.', scope: 'spectrum' },
      ],
    }, 'dfam'));
    await p.waitForSelector('aside[aria-label="Lesson coach"]', { timeout: 5000 });
    await wait(700); // the coach takes room beside the panel: the panel refits
    const trig = await center('[data-instance="dfam"] button[data-control="trigger"]');
    const momentary = async () => p.evaluate(() => {
      const s = window.__synthStudio.store.getState();
      const btn = document.querySelector('[data-instance="dfam"] button[data-control="trigger"]');
      const ring = btn?.parentElement?.querySelector('.ssc-spot');
      const coach = document.querySelector('aside[aria-label="Lesson coach"]')?.innerText ?? '';
      return {
        step: s.currentStep, satisfied: s.stepSatisfied,
        presses: s.session[0]?.events?.dfam?.trigger ?? 0,
        ring: ring ? [...ring.classList].find(c => c.startsWith('ssc-spot-')) ?? 'ssc-spot' : null,
        ringPositioned: ring ? getComputedStyle(ring).position === 'absolute' : null,
        counter: (coach.match(/Press TRIGGER[^\n]*/) || [null])[0],
        gotIt: coach.includes('Got it'),
      };
    });
    const m0 = await momentary();
    await tap(trig.x, trig.y);
    await wait(150);
    const m1 = await momentary();
    await tap(trig.x, trig.y);
    await wait(120);
    const m2 = await momentary();
    await p.screenshot({ path: `${out}-momentary-done.png` });
    await p.waitForFunction(() => window.__synthStudio.store.getState().currentStep === 1, null, { timeout: 4000 }).catch(() => undefined);
    const m3 = await momentary();
    log.momentary = { before: m0, afterOne: m1, afterTwo: m2, advanced: m3.step === 1 };

    // ---- 8. the spectrum scope ---------------------------------------------------------------------------------
    const scan = () => p.evaluate(() => {
      const wrap = document.querySelector('aside [data-scope-mode]');
      const c = wrap?.querySelector('canvas');
      if (!c) return null;
      const dpr = window.devicePixelRatio || 1;
      const W = c.width, H = c.height;
      const img = c.getContext('2d').getImageData(0, 0, W, H).data;
      // The plot above the floor line and the frequency labels (spectrum mode: floor at h - 11 CSS px)
      const limit = Math.floor((c.clientHeight - 16) * dpr);
      let lit = 0, cols = 0;
      for (let x = 0; x < W; x++) {
        let col = false;
        for (let y = 0; y < limit; y++) {
          const i = (y * W + x) * 4;
          if (img[i + 2] > 90 && img[i + 2] - img[i] > 50 && img[i + 1] > 60) { lit++; col = true; }
        }
        if (col) cols++;
      }
      return { mode: wrap.dataset.scopeMode, label: c.getAttribute('aria-label'), sized: W === Math.round(c.clientWidth * dpr) && H === Math.round(c.clientHeight * dpr), W, H, lit, cols };
    });
    await wait(1500); // the triggered hits die away
    const quiet = await scan();
    // The learner can flip the view by touch: wave, then back to spectrum
    const viewBtn = name => center(`aside [aria-label="Scope view"] button:text-is("${name}")`);
    const wv = await viewBtn('wave');
    await tap(wv.x, wv.y);
    await wait(200);
    const flipped = await p.evaluate(() => document.querySelector('aside [data-scope-mode]')?.dataset.scopeMode);
    const sv = await viewBtn('spectrum');
    await tap(sv.x, sv.y);
    await wait(200);
    // Run the sequencer by touch and look again
    const run = await center('[data-instance="dfam"] button[data-control="run_stop"]');
    await tap(run.x, run.y);
    await wait(1000);
    // Hits come and go: keep the fullest of a few looks
    let playing = null;
    for (let i = 0; i < 6; i++) {
      const s = await scan();
      if (!playing || (s && s.cols > playing.cols)) playing = s;
      await wait(150);
    }
    await p.screenshot({ path: `${out}-spectrum.png` });
    await tap(run.x, run.y);
    await wait(300);
    log.spectrum = { quiet, playing, flippedTo: flipped };
    await p.evaluate(() => window.__synthStudio.store.getState().resetLesson());
  } catch (e) {
    errs.push('test: ' + String(e).split('\n')[0]);
  }
  console.log(JSON.stringify({ log, errs: errs.slice(0, 12) }));
  await b.close();
})();
