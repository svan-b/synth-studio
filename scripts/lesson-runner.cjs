// ============================================================================
// Lesson runner - plays every lesson of a device like a perfect student and
// reports any step that cannot be completed.
//   node scripts/lesson-runner.cjs <baseUrl> <deviceId> [lesson id filter]
// For each step it performs the intended action through the real store:
//   do/predict  -> answer the prediction correctly, then set the target value -
//                  or, for a momentary button / `event` step, PRESS it through the
//                  panel (pointer events on the real button, so the whole UI path is
//                  tested), and play `play` notes
//   patch       -> add the cable
//   quiz/listen -> pick the correct answer
//   match       -> set the target values, press Check
//   reflect     -> reveal + self-rate
//   challenge   -> apply `solution` (values, patches, data, presses, notes, studio
//                  cables, transport; and through the lesson runtime, in device lessons
//                  too: routes, the arranger, other instruments, the mixer, Elektron
//                  pattern settings and trigs) when the step has one
//   demo recordings (info.play, listen.demo) -> play them as the coach does (both sides
//                  of an A/B) and check each one sounds, decodes and stops; a silent or
//                  missing recording fails the step
// Any step still not satisfied is searched: single moves a learner could make
// (studio transport, a cable between instruments, an internal cable, a switch or
// button, a press) are tried one at a time and kept when they help. A step solved
// that way is reported as "auto" with the moves; one that cannot be solved fails.
//
// `studio` runs the cross-instrument lessons, the Producer path included (Lesson
// API v3): each lesson loads its own studio, and solutions may set other
// instruments, the mixer, the master, the song and its snapshots, and play,
// bounce or record for real - the runner waits for the meters, like a learner.
// ============================================================================
const { chromium } = require('playwright');
const { serveDemoRecordings } = require('./e2e/demoRecordings.cjs');

(async () => {
  // An optional third argument runs only the lessons whose id contains it
  const [, , base = 'http://localhost:3000', device = 'dfam', only = ''] = process.argv;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // The demo recordings are AAC; this Chromium can't decode it, so it gets them as WAV
  await serveDemoRecordings(page);
  await page.addInitScript(d => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: d, devices: {}, completedLessons: [], review: {}, focusMode: true,
        studio: { rack: [{ id: d, device: d }], cables: [], routes: {}, sync: {}, bpm: 120, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } } }, version: 4 }));
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('synth-studio-welcomed', '1');
    }
  }, device === 'studio' ? 'dfam' : device);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__synthStudio, null, { timeout: 15000 });
  await page.waitForTimeout(800);

  const report = await page.evaluate(async ([device, only]) => {
    const { store, hub } = window.__synthStudio;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const S = () => store.getState();
    const results = [];
    const studio = device === 'studio';
    // Studio lessons are not a device module: the app lists them (the Producer path loads on demand)
    const mod = studio ? { lessons: await window.__synthStudioLessons() } : await hub.loadModule(device);
    hub.ensureAudio();
    /** The lesson runtime (meters, A/B, studio solutions) */
    const runtime = async () => {
      for (let i = 0; i < 100 && !window.__synthLesson; i++) await wait(100);
      return window.__synthLesson;
    };
    /** A lesson that loaded its own studio: wait until every instrument's engine runs */
    const waitForStudio = async () => {
      for (let i = 0; i < 150 && hub.status !== 'on'; i++) await wait(100);
      const rack = () => S().studio.rack.map(r => r.id).filter(id => !(S().studio.off || {})[id]);
      for (let i = 0; i < 150 && !rack().every(id => hub.instances().includes(id)); i++) await wait(100);
      await wait(600);
    };

    const kindOf = step => step.kind || (step.patchFrom && step.patchTo ? 'patch'
      : (step.control || step.event || step.play) ? 'do'
      : (step.checklist && step.checklist.length) ? 'challenge' : 'info');
    const lessonInstanceOf = () => S().lessonInstance || device;
    /**
     * A step's demo recordings, played through the app's player like the coach's ▶ Hear it
     * and A/B: each must load, make sound and stop again. Returns what was heard, or why not.
     */
    const playDemos = async (lesson, i, step) => {
      const da = window.__synthDemoAudio;
      if (!da) return { error: 'no demo player in the page (window.__synthDemoAudio)' };
      const owner = `lesson:${lesson.id}:${i}`;
      const heard = [];
      // after the coach has moved to the step (leaving a step stops its recordings)
      await wait(200);
      const listen = async what => {
        let peak = 0, playing = false;
        for (let k = 0; k < 80; k++) {
          await wait(100);
          const pb = da.getPlayback();
          if (pb && pb.status === 'error') return { what, error: pb.error };
          if (pb && pb.status === 'playing') playing = true;
          peak = Math.max(peak, da.outputLevel());
          if (playing && peak > 0.02 && k >= 10) break;
        }
        return { what, peak: Math.round(peak * 1000) / 1000, playing };
      };
      if (step.info && step.info.play) {
        const clips = da.clipsOf(step.info.play);
        da.play(owner, step.info.play);
        heard.push(await listen(clips.map(c => c.file).join(' + ')));
      }
      const d = step.listen && step.listen.demo;
      if (d) {
        const a = { demo: d.demo, excerpt: d.excerpt, variation: d.a }, b = { demo: d.demo, excerpt: d.excerpt, variation: d.b };
        da.playSide(owner, a, b, 'a');
        heard.push(await listen(`A ${d.a}`));
        da.playSide(owner, a, b, 'b');
        heard.push(await listen(`B ${d.b}`));
      }
      da.stop();
      await wait(150);
      const after = da.getPlayback();
      const bad = heard.filter(h => h.error || !h.playing || !(h.peak > 0.02));
      return { heard, stopped: !after, error: bad.length ? `silent or failed: ${JSON.stringify(bad)}` : !after ? undefined : 'did not stop' };
    };
    /** A step's instance: an instance id, or a device's first instance in the rack */
    const resolveRef = ref => {
      const rack = S().studio.rack;
      if (rack.some(r => r.id === ref)) return ref;
      // '<device>#<n>': the n-th instance of a device
      const nth = /^(.+)#(\d+)$/.exec(ref);
      if (nth) { const r = rack.filter(x => x.device === nth[1])[Number(nth[2]) - 1]; return r ? r.id : ref; }
      const r = rack.find(x => x.device === ref);
      return r ? r.id : ref;
    };
    const instanceOfStep = step => (step.instance ? resolveRef(step.instance) : lessonInstanceOf());
    const deviceOfInstance = inst => S().deviceOf(inst);
    const specOf = inst => { const m = hub.getModule(deviceOfInstance(inst)); return m ? m.spec : null; };
    const layoutOf = inst => { const m = hub.getModule(deviceOfInstance(inst)); return m ? m.layout : null; };
    const pressTargetOf = (step, inst) => {
      if (step.event) return step.event;
      const c = step.control && specOf(inst) ? specOf(inst).controls[step.control] : null;
      if (c && c.type === 'button' && (c.momentary || step.presses !== undefined)) return step.control;
      return null;
    };
    const pressCount = (inst, id) => {
      const sess = S().session[S().currentStep] || {};
      return ((sess.events || {})[inst] || {})[id] || 0;
    };
    // Press a button the way a learner does: pointer down/up on the panel's own button.
    // Falls back to the store API when that instrument isn't on screen.
    const press = async (inst, id) => {
      const before = pressCount(inst, id);
      const el = document.querySelector(`[data-instance="${CSS.escape(inst)}"] button[data-control="${CSS.escape(id)}"]`);
      if (el) {
        const opts = { bubbles: true, cancelable: true, button: 0, buttons: 1, pointerId: 7, pointerType: 'mouse', isPrimary: true };
        el.dispatchEvent(new PointerEvent('pointerdown', opts));
        await wait(70);
        el.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 }));
        await wait(20);
      }
      if (pressCount(inst, id) === before) S().lessonPress(inst, [id]);
      return el ? 'ui' : 'store';
    };
    // Like the keys: the instrument plays the note and the lesson counts it
    const playNotes = async (inst, notes) => {
      for (const n of notes) { hub.noteOn(inst, n, 0.8); await wait(40); hub.noteOff(inst, n); S().lessonNote(inst, n); await wait(5); }
    };
    const resolveEnd = end => {
      if (end.instance) return end.instance;
      const r = S().studio.rack.find(x => x.device === end.device);
      return r ? r.id : end.device;
    };

    // ---- search: single learner moves, kept when they help ----------------------
    const satisfied = () => { S().reevaluate(); return S().stepSatisfied; };
    const score = step => {
      const cs = S().lessonCheckState();
      if (!cs) return 0;
      let n = 0;
      (step.checklist || []).forEach(c => { try { if (!c.check || c.check(cs)) n++; } catch { /* */ } });
      if (step.check) { try { if (step.check(cs)) n++; } catch { /* */ } }
      return n;
    };
    const movesFor = step => {
      const inst = instanceOfStep(step);
      const rack = S().studio.rack.map(r => r.id);
      const focus = new Set(step.focus || []);
      const moves = [];
      // Studio transport
      moves.push({ desc: 'studio transport: play', apply: () => hub.startAll(), undo: () => hub.stopAll() });
      // Cables between instruments (focused jacks first)
      const cableMoves = [];
      rack.forEach(a => rack.forEach(b => {
        if (a === b) return;
        const sa = specOf(a), sb = specOf(b);
        if (!sa || !sb || !sa.patchBay || !sb.patchBay) return;
        sa.patchBay.outputs.forEach(o => sb.patchBay.inputs.forEach(i => {
          const cable = { from: { instance: a, jack: o.id }, to: { instance: b, jack: i.id } };
          const rank = (focus.has(o.id) ? 0 : 1) + (focus.has(i.id) ? 0 : 1);
          cableMoves.push({ rank, desc: `studio cable ${a}.${o.id} -> ${b}.${i.id}`, apply: () => S().addStudioCable(cable), undo: () => S().removeStudioCable(cable) });
        }));
      }));
      cableMoves.sort((x, y) => x.rank - y.rank).forEach(m => moves.push(m));
      // Internal cables on the step's instrument
      const sp = specOf(inst);
      if (sp && sp.patchBay) {
        sp.patchBay.outputs.forEach(o => sp.patchBay.inputs.forEach(i => {
          const exists = () => (S().devices[inst]?.patchConnections || []).some(c => (c.from === o.id && c.to === i.id) || (c.from === i.id && c.to === o.id));
          moves.push({ desc: `cable ${inst}: ${o.id} -> ${i.id}`, apply: () => { if (!exists()) S().addPatchConnection(inst, o.id, i.id); }, undo: () => S().removePatchConnection(inst, o.id, i.id) });
        }));
      }
      // Switches, toggle buttons and focused knobs on every instrument (the step's first)
      const ordered = [inst, ...rack.filter(r => r !== inst)];
      ordered.forEach(id => {
        const spec = specOf(id);
        if (!spec) return;
        Object.entries(spec.controls).forEach(([cid, c]) => {
          const cur = () => hub.valuesFor(id)[cid];
          const setter = v => { let prev; return { apply: () => { prev = cur(); S().setControlValue(id, cid, v); }, undo: () => S().setControlValue(id, cid, prev) }; };
          if (c.type === 'switch') c.options.forEach((opt, k) => moves.push({ desc: `${id}.${cid} = ${opt}`, ...setter(k) }));
          else if (c.type === 'button' && !c.momentary) [true, false].forEach(v => moves.push({ desc: `${id}.${cid} = ${v}`, ...setter(v) }));
          else if ((c.type === 'knob' || c.type === 'slider') && focus.has(cid) && id === inst) {
            for (let k = 0; k <= 10; k++) moves.push({ desc: `${id}.${cid} = ${k * 10}%`, ...setter(c.min + ((c.max - c.min) * k) / 10) });
          }
        });
      });
      // Presses on the step's instrument
      const pressIds = new Set();
      if (sp) Object.entries(sp.controls).forEach(([cid, c]) => { if (c.type === 'button' && c.momentary) pressIds.add(cid); });
      const lay = layoutOf(inst);
      if (lay) lay.elements.forEach(el => { if (el.kind === 'button' && el.event) pressIds.add(el.event); });
      pressIds.forEach(pid => moves.push({ desc: `press ${inst}.${pid}`, apply: async () => { await press(inst, pid); }, undo: () => undefined }));
      return moves;
    };
    const search = async step => {
      const applied = [];
      let best = score(step);
      const moves = movesFor(step);
      for (let round = 0; round < 6; round++) {
        let improved = false;
        for (const m of moves) {
          await m.apply();
          await wait(2);
          if (satisfied()) { applied.push(m.desc); return applied; }
          const sc = score(step);
          if (sc > best) { best = sc; applied.push(m.desc); improved = true; continue; }
          await m.undo();
        }
        if (!improved) break;
      }
      return satisfied() ? applied : null;
    };

    for (const lesson of mod.lessons.filter(l => !only || l.id.includes(only))) {
      const t0 = performance.now();
      // A studio lesson starts in the current studio (or loads its own); a device lesson on its instrument
      S().startLesson(lesson, studio ? undefined : device);
      await wait(60);
      const ownStudio = !!(lesson.start && lesson.start.studio);
      // The lesson runtime applies studio-level solutions (routes, the arranger, other
      // instruments, Elektron patterns) in device lessons too; meters only matter in studio ones
      const rt = await runtime();
      const liveRt = studio ? rt : undefined;
      if (ownStudio) await waitForStudio();
      const stepResults = [];
      for (let i = 0; i < lesson.steps.length; i++) {
        if (S().currentStep !== i) S().goToStep(i);
        await wait(20);
        const step = lesson.steps[i];
        const kind = kindOf(step);
        const inst = instanceOfStep(step);
        let how = '';
        let demo = null;
        try {
          if ((step.info && step.info.play) || (step.listen && step.listen.demo)) demo = await playDemos(lesson, i, step);
          if (kind === 'predict' && step.predict) S().answerStep(step.predict.answer);
          if (kind === 'quiz' && step.quiz) S().answerStep(step.quiz.answer);
          if (kind === 'listen' && step.listen && step.listen.question) S().answerStep(step.listen.question.answer);
          const pt = pressTargetOf(step, inst);
          if (pt) {
            const n = Math.max(1, Math.round(step.presses || 1));
            for (let k = 0; k < n; k++) how = `pressed ${pt} via ${await press(inst, pt)}`;
          } else if (step.control && step.targetValue !== undefined) {
            S().setControlValue(inst, step.control, step.targetValue);
          }
          if (step.play) await playNotes(inst, step.play.notes && step.play.notes.length ? step.play.notes : Array.from({ length: Math.max(1, step.play.count || 1) }, (_, k) => 60 + k));
          if (step.patchFrom && step.patchTo) S().addPatchConnection(inst, step.patchFrom, step.patchTo);
          if (kind === 'match' && step.match) {
            const v = {};
            step.match.controls.forEach(c => { v[c] = step.match.target[c]; });
            S().setControlValues(inst, v);
            // An Elektron pattern setting (SWING) to match: set it like the SWING menu does
            if (step.match.pattern && rt) rt.setPatternSettings(inst, step.match.pattern.target);
            S().checkMatch();
          }
          if (kind === 'reflect') { S().revealStep(); S().rateReflection('got-it'); }
          // A studio step already done (an earlier bounce or play-through counts): don't redo it
          const already = studio && step.solution && kind !== 'reflect' && satisfied();
          const sol = already ? null : step.solution;
          if (already) how = 'already satisfied';
          if (sol) {
            const si = sol.instance ? resolveRef(sol.instance) : inst;
            if (sol.values) S().setControlValues(si, sol.values);
            if (sol.patches) sol.patches.forEach(p => S().addPatchConnection(si, p.from, p.to));
            if (sol.data !== undefined) S().setDeviceData(si, sol.data);
            if (sol.studioCables) sol.studioCables.forEach(c => S().addStudioCable({ from: { instance: resolveEnd(c.from), jack: c.from.jack }, to: { instance: resolveEnd(c.to), jack: c.to.jack } }));
            // v3: other instruments, the mixer, the master, tempo and routing, the song and its
            // snapshots, Elektron pattern settings and trigs (cables were added above)
            if (rt && (sol.parts || sol.channels || sol.master || sol.studio || sol.arrangement || sol.capture || sol.patterns || sol.sequence)) {
              rt.applyStudioSolution({ ...sol, studioCables: undefined }, si);
            }
            if (sol.transport === 'play') hub.startAll();
            if (sol.transport === 'stop') hub.stopAll();
            if (sol.presses) for (const p of sol.presses) await press(si, p);
            if (sol.notes) await playNotes(si, sol.notes);
            await wait(20);
            // Press until done (park a sequencer on its last step...)
            if (sol.pressUntilDone) {
              // Through the engine, like the panel button (which may be off screen)
              const id = sol.pressUntilDone;
              for (let k = 0; k < 16 && !satisfied(); k++) { hub.event(si, id); S().lessonPress(si, [id]); await wait(150); }
            }
            // Play, bounce or record for real, until the step is satisfied (meters need time)
            if (liveRt && liveRt.isTimedSolution(sol)) {
              how = `timed: ${['play', 'bounce', 'record'].filter(k => sol[k]).join(', ')}`;
              await liveRt.runTimedSolution(sol, { until: () => !sol.bounce && !sol.record && satisfied() });
            }
          }
        } catch (e) {
          stepResults.push({ i: i + 1, kind, ok: false, why: 'threw: ' + e });
          continue;
        }
        await wait(30);
        // Live checks (meters, takes) settle a moment later: give them a second
        if (liveRt) { liveRt.publish(); for (let k = 0; k < 8 && !satisfied(); k++) { await wait(150); liveRt.publish(); } }
        let ok = satisfied();
        if (demo && demo.error) {
          stepResults.push({ i: i + 1, kind, ok: false, why: `demo recording: ${demo.error}`, demo: demo.heard });
          continue;
        }
        // What a failing studio check saw, before any search moves change it
        let seen;
        if (!ok && studio) {
          const cs = S().lessonCheckState();
          const fails = [];
          (step.checklist || []).forEach(c => { try { if (c.check && !c.check(cs)) fails.push(c.text); } catch (e) { fails.push(`${c.text} (threw)`); } });
          const m = cs && cs.meters && cs.meters.master;
          const ch = cs && cs.meters ? Object.fromEntries(Object.entries(cs.meters.channels).filter(([k]) => /:[1-4ab]$/.test(k)).map(([k, v]) => [k, `${Math.round(v.peak * 10) / 10}${v.pk ? ' PK' : ''}`])) : undefined;
          seen = { failing: fails, meters: m ? { I: m.lufsI, S: m.lufsS, peak: m.peakDb, tp: m.maxTruePeakDb, gr: m.grDb, maxGr: m.maxGrDb, sec: m.measuredSec, fromStart: m.fromStart, steady: m.steady } : undefined, channels: ch, bounce: cs && cs.bounce && cs.bounce.last, arranger: cs && cs.arranger };
        }
        let auto = null;
        // Single learner moves can't fix a measurement: timed steps stand on their own solution
        if (!ok && !(liveRt && liveRt.isTimedSolution(step.solution))) {
          auto = await search(step);
          ok = !!auto;
        }
        // An open challenge with no `solution` that no single move solves needs a human
        const manual = !ok && kind === 'challenge' && !step.solution;
        stepResults.push({
          i: i + 1, kind, ok: ok || manual, manual, how, auto: auto && auto.length ? auto : undefined, seen, demo: demo ? demo.heard : undefined,
          why: ok ? '' : manual ? 'challenge needs a manual/solution check' : 'not satisfied after performing the action (and no single learner move solved it)',
        });
      }
      S().resetLesson();
      hub.stopAll();
      if (!studio) S().clearStudioCables();
      await wait(studio ? 400 : 0);
      results.push({
        id: lesson.id, steps: lesson.steps.length, seconds: Math.round((performance.now() - t0) / 100) / 10,
        failed: stepResults.filter(r => !r.ok),
        manual: stepResults.filter(r => r.manual).length,
        auto: stepResults.filter(r => r.auto).map(r => ({ step: r.i, kind: r.kind, moves: r.auto })),
        presses: stepResults.filter(r => r.how).map(r => ({ step: r.i, how: r.how })),
        demos: stepResults.filter(r => r.demo).map(r => ({ step: r.i, heard: r.demo })),
      });
    }
    return results;
  }, [device, only]);

  const failedLessons = report.filter(r => r.failed.length);
  const autoSteps = report.reduce((n, r) => n + r.auto.length, 0);
  console.log(JSON.stringify({
    device,
    lessons: report.length,
    failedLessons: failedLessons.length,
    details: failedLessons,
    manualSteps: report.reduce((n, r) => n + r.manual, 0),
    // Steps no scripted action completed, solved by a single learner move the runner found
    autoSteps,
    auto: report.filter(r => r.auto.length).map(r => ({ id: r.id, auto: r.auto })),
    presses: report.filter(r => r.presses.length).map(r => ({ id: r.id, presses: r.presses })),
    // Demo recordings played (info.play, listen.demo): every one sounded and stopped
    demoSteps: report.reduce((n, r) => n + r.demos.length, 0),
    demos: report.filter(r => r.demos.length).map(r => ({ id: r.id, demos: r.demos })),
    errors: errors.slice(0, 10),
  }, null, 2));
  await browser.close();
  process.exit(failedLessons.length || errors.length ? 1 : 0);
})();
