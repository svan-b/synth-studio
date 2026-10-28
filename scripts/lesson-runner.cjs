// ============================================================================
// Lesson runner - plays every lesson of a device like a perfect student and
// reports any step that cannot be completed.
//   node scripts/lesson-runner.cjs <baseUrl> <deviceId>
// For each step it performs the intended action through the real store:
//   do/predict  -> answer the prediction correctly, set the target value
//   patch       -> add the cable
//   quiz/listen -> pick the correct answer
//   match       -> set the target values, press Check
//   reflect     -> reveal + self-rate
//   challenge   -> needs a solver: provide `solution` values on the step if possible,
//                  otherwise reported as "manual" (checks still must not throw)
// ============================================================================
const { chromium } = require('playwright');

(async () => {
  const [, , base = 'http://localhost:3000', device = 'dfam'] = process.argv;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(d => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: d, devices: {}, completedLessons: [], review: {}, focusMode: true,
        studio: { rack: [{ id: d, device: d }], cables: [], routes: {}, sync: {}, bpm: 120, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } } }, version: 4 }));
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('synth-studio-welcomed', '1');
    }
  }, device);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__synthStudio, null, { timeout: 15000 });
  await page.waitForTimeout(800);

  const report = await page.evaluate(async device => {
    const { store, hub } = window.__synthStudio;
    const mod = await hub.loadModule(device);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const results = [];
    for (const lesson of mod.lessons) {
      const s0 = store.getState();
      s0.startLesson(lesson, device);
      await wait(50);
      const stepResults = [];
      for (let i = 0; i < lesson.steps.length; i++) {
        const st = store.getState();
        if (st.currentStep !== i) st.goToStep(i);
        await wait(20);
        const step = lesson.steps[i];
        const kind = step.kind || (step.patchFrom && step.patchTo ? 'patch' : step.control ? 'do' : (step.checklist && step.checklist.length) ? 'challenge' : 'info');
        const S = () => store.getState();
        try {
          if (kind === 'predict' && step.predict) S().answerStep(step.predict.answer);
          if ((kind === 'quiz') && step.quiz) S().answerStep(step.quiz.answer);
          if (kind === 'listen' && step.listen && step.listen.question) S().answerStep(step.listen.question.answer);
          if (step.control && step.targetValue !== undefined) S().setControlValue(device, step.control, step.targetValue);
          if (step.patchFrom && step.patchTo) S().addPatchConnection(device, step.patchFrom, step.patchTo);
          if (kind === 'match' && step.match) {
            const v = {};
            step.match.controls.forEach(c => { v[c] = step.match.target[c]; });
            S().setControlValues(device, v);
            S().checkMatch();
          }
          if (kind === 'reflect') { S().revealStep(); S().rateReflection('got-it'); }
          if (step.solution) {
            if (step.solution.values) S().setControlValues(device, step.solution.values);
            if (step.solution.patches) step.solution.patches.forEach(p => S().addPatchConnection(device, p.from, p.to));
            if (step.solution.data !== undefined) S().setDeviceData(device, step.solution.data);
          }
        } catch (e) {
          stepResults.push({ i: i + 1, kind, ok: false, why: 'threw: ' + e });
          continue;
        }
        S().reevaluate();
        await wait(30);
        const ok = S().stepSatisfied;
        const manual = !ok && kind === 'challenge' && !step.solution;
        stepResults.push({ i: i + 1, kind, ok: ok || manual, manual, why: ok ? '' : manual ? 'challenge needs a manual/solution check' : 'not satisfied after performing the action' });
      }
      S().resetLesson();
      results.push({ id: lesson.id, steps: lesson.steps.length, failed: stepResults.filter(r => !r.ok), manual: stepResults.filter(r => r.manual).length });
    }
    function S() { return store.getState(); }
    return results;
  }, device);

  const failedLessons = report.filter(r => r.failed.length);
  console.log(JSON.stringify({ device, lessons: report.length, failedLessons: failedLessons.length, details: failedLessons, manualSteps: report.reduce((n, r) => n + r.manual, 0), errors: errors.slice(0, 10) }, null, 2));
  await browser.close();
  process.exit(failedLessons.length || errors.length ? 1 : 0);
})();
