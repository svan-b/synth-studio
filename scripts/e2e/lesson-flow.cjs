// ============================================================================
// The learning flow in the real app:   node scripts/e2e/lesson-flow.cjs <baseUrl>
//   1. Questions show their options in a shuffled order (components/teaching/optionOrder.ts):
//      the right answer is not always the first button, tapping it still counts as right,
//      A/B side labels keep their order and "Both" stays last.
//   2. "Next lesson" goes to the next lesson that is open (lib/studio/lessonSequence.ts):
//      after the Subharmonicon's first lesson that is its second foundations lesson, not a
//      lesson of another path whose prerequisites are still to do.
//   3. A step waits for the learner: the DFAM acid lesson's "+3 st" step (a small turn on a
//      ten-octave knob) is not done before the knob has moved.
//   4. On an iPad (landscape, touch) a question fits the floating coach: every answer and the
//      Next button are on screen, uncovered and at least 44 px tall, and taps answer and move on.
//      The same holds for the longest answers in the lessons (three options of about 90 characters).
// ============================================================================
const { chromium } = require('playwright');

(async () => {
  const [, , base = 'http://localhost:3100'] = process.argv;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const open = async device => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    page.on('pageerror', e => errs.push(String(e)));
    await page.addInitScript(d => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('synth-studio-welcomed', '1');
      localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: d, devices: {}, completedLessons: [] }, version: 3 }));
    }, device);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__synthStudio, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    return page;
  };
  const coach = page => page.locator('aside[aria-label="Lesson coach"]');
  const r = {};
  try {
    // ---- 1. shuffled options ---------------------------------------------------------------
    let page = await open('dfam');
    const N = 8;
    await page.evaluate(n => {
      const quiz = i => ({ kind: 'quiz', instruction: 'Quick check.', quiz: { question: `Question ${i}?`, options: [`Right ${i}`, `Wrong one ${i}`, `Wrong two ${i}`], answer: 0, explain: 'Because.' } });
      window.__synthStudio.store.getState().startLesson({
        id: 'dfam-e2e-options', device: 'dfam', name: 'Option order', description: 'e2e', difficulty: 'beginner', source: 'scripts/e2e/lesson-flow.cjs',
        steps: [
          ...Array.from({ length: n }, (_, i) => quiz(i + 1)),
          { kind: 'quiz', instruction: 'Sides.', quiz: { question: 'Which side?', options: ['A', 'B', 'Neither'], answer: 1 } },
          { kind: 'quiz', instruction: 'Summing.', quiz: { question: 'Which of them?', options: ['Both', 'The filter', 'The envelope'], answer: 0 } },
        ],
      }, 'dfam');
    }, N);
    await coach(page).waitFor({ timeout: 5000 });
    const options = async () => (await coach(page).locator('[role="group"][aria-label="Your answer"] button').allInnerTexts()).map(t => t.replace(/^\s*[A-D✓✗]\s+/, '').trim());
    const shownFirst = [];
    let rightCounted = 0;
    let permutations = 0;
    for (let i = 1; i <= N; i++) {
      const opts = await options();
      if ([...opts].sort().join('|') === [`Right ${i}`, `Wrong one ${i}`, `Wrong two ${i}`].sort().join('|')) permutations++;
      shownFirst.push(opts.indexOf(`Right ${i}`));
      await coach(page).getByRole('button', { name: new RegExp(`Right ${i}$`) }).click();
      await page.waitForTimeout(120);
      const st = await page.evaluate(() => { const s = window.__synthStudio.store.getState(); return { answer: s.session[s.currentStep]?.answer, text: document.querySelector('aside[aria-label="Lesson coach"]')?.innerText ?? '' }; });
      if (st.answer === 0 && /Right\. /.test(st.text)) rightCounted++;
      await page.evaluate(() => window.__synthStudio.store.getState().nextStep());
      await page.waitForTimeout(120);
    }
    const sides = await options();
    await page.evaluate(() => window.__synthStudio.store.getState().nextStep());
    await page.waitForTimeout(120);
    const summing = await options();
    r.options = { permutations, rightCounted, shownFirst, notAlwaysFirst: shownFirst.some(p => p > 0), sides, bothLast: summing[summing.length - 1] === 'Both' };
    await page.close();

    // ---- 2. "Next lesson" follows the recommended sequence -------------------------------
    page = await open('subharmonicon');
    await page.waitForFunction(() => window.__synthStudio.hub.loadModule, null, { timeout: 10000 });
    r.next = await page.evaluate(async () => {
      const S = window.__synthStudio;
      const mod = await S.hub.loadModule('subharmonicon');
      const first = [...mod.lessons].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))[0];
      S.store.getState().startLesson(first, 'subharmonicon');
      S.store.setState({ lessonFinished: true, stepSatisfied: true });
      return { first: first.id };
    });
    await coach(page).getByRole('button', { name: /Next lesson/ }).click({ timeout: 8000 });
    await page.waitForTimeout(500);
    Object.assign(r.next, await page.evaluate(async () => {
      const S = window.__synthStudio;
      const st = S.store.getState();
      const l = st.currentLesson;
      return { then: l?.id, path: l?.path, unlocked: (l?.prerequisites ?? []).every(p => st.completedLessons.includes(p)), done: st.completedLessons };
    }));
    await page.close();

    // ---- 3. a small turn is still the learner's to make ---------------------------------------
    page = await open('dfam');
    r.waits = await page.evaluate(async () => {
      const S = window.__synthStudio;
      const mod = await S.hub.loadModule('dfam');
      const lesson = mod.lessons.find(l => l.id === 'dfam-sq1-acid');
      const i = lesson.steps.findIndex(s => s.control === 'pitch_5');
      S.store.getState().startLesson(lesson, 'dfam');
      S.store.getState().goToStep(i);
      await new Promise(res => setTimeout(res, 1600)); // twice the auto-advance delay
      const before = { step: S.store.getState().currentStep, satisfied: S.store.getState().stepSatisfied };
      return { index: i, before };
    });
    await page.close();

    // ---- 4. iPad: a question by touch ------------------------------------------------------------
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e)));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('synth-studio-welcomed', '1');
      localStorage.setItem('synth-studio-storage', JSON.stringify({ state: { currentDevice: 'dfam', devices: {}, completedLessons: [] }, version: 3 }));
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__synthStudio, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(async () => {
      const S = window.__synthStudio;
      const mod = await S.hub.loadModule('dfam');
      const lesson = mod.lessons.find(l => l.id === 'dfam-f3-filter');
      window.__quiz = lesson.steps.findIndex(s => s.kind === 'quiz');
      S.store.getState().startLesson(lesson, 'dfam');
      S.store.getState().goToStep(window.__quiz);
    });
    await coach(page).waitFor({ timeout: 5000 });
    await page.waitForTimeout(900);
    // every answer and the Next button: on screen, on top, big enough for a finger
    const measure = () => page.evaluate(() => {
      const c = document.querySelector('aside[aria-label="Lesson coach"]');
      const answers = [...c.querySelectorAll('[role="group"][aria-label="Your answer"] button')];
      const next = [...c.querySelectorAll('button')].find(b => /Next →|Skip →/.test(b.innerText));
      const seen = el => {
        const q = el.getBoundingClientRect();
        const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        return { h: Math.round(q.height), onScreen: q.top >= 0 && q.bottom <= innerHeight, onTop: !!top && (top === el || el.contains(top)) };
      };
      return { answers: answers.map(seen), next: next ? seen(next) : null, quiz: window.__quiz, right: (() => { const s = window.__synthStudio.store.getState(); const mc = s.currentLesson.steps[s.currentStep].quiz; return mc.options[mc.answer]; })() };
    });
    const m = await measure();
    const fits = x => !!x && x.h >= 44 && x.onScreen && x.onTop;
    const rightBtn = coach(page).locator('[role="group"][aria-label="Your answer"] button', { hasText: m.right });
    await rightBtn.tap();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => { const s = window.__synthStudio.store.getState(); const mc = s.currentLesson.steps[s.currentStep].quiz; return { right: s.session[s.currentStep]?.answer === mc.answer, satisfied: s.stepSatisfied }; });
    const m2 = await measure();
    await coach(page).getByRole('button', { name: /Next →/ }).tap();
    await page.waitForTimeout(400);
    const moved = await page.evaluate(() => window.__synthStudio.store.getState().currentStep === window.__quiz + 1);
    r.ipad = { answers: m.answers, next: m.next, fits: m.answers.length >= 3 && m.answers.every(fits) && fits(m.next), nextAfterAnswer: fits(m2.next), ...after, moved };
    // the longest answers in the lessons (about 90 characters each, three lines in the coach) still fit
    await page.evaluate(() => {
      window.__quiz = 0;
      window.__synthStudio.store.getState().startLesson({
        id: 'dfam-e2e-long-options', device: 'dfam', name: 'Long options', description: 'e2e', difficulty: 'beginner', source: 'scripts/e2e/lesson-flow.cjs',
        steps: [
          { kind: 'quiz', instruction: 'Quick check.', quiz: { question: 'Your track sounds great in headphones, but the bass vanishes on a phone speaker. What do you check first?', answer: 2, explain: 'Small speakers can\'t play below about 100 Hz.',
            options: ['The bass\'s reverb send: a wetter bass spreads out and carries further on small speakers', 'The pattern\'s swing: a looser groove leaves the bass more room to be heard between the hits', 'The bass\'s harmonics: a little brightness or a higher octave so it is heard on small speakers'] } },
          { kind: 'info', instruction: 'Done.' },
        ],
      }, 'dfam');
    });
    await page.waitForTimeout(900);
    const ml = await measure();
    r.ipad.longFits = ml.answers.length === 3 && ml.answers.every(fits) && fits(ml.next);
    r.ipad.longHeights = ml.answers.map(a => a.h);
    await ctx.close();
  } catch (e) {
    errs.push('test: ' + String(e).split('\n')[0]);
  }
  const o = r.options ?? {};
  const ok = o.permutations === 8 && o.rightCounted === 8 && o.notAlwaysFirst && (o.sides ?? []).join('|') === 'A|B|Neither' && o.bothLast
    && r.next?.then === 'subharmonicon-f2-waves-mixer' && r.next?.unlocked
    && r.waits?.before?.step === r.waits?.index && r.waits?.before?.satisfied === false
    && r.ipad?.fits && r.ipad?.nextAfterAnswer && r.ipad?.right && r.ipad?.satisfied && r.ipad?.moved && r.ipad?.longFits
    && errs.length === 0;
  console.log(JSON.stringify({ ok, ...r, errs: errs.slice(0, 5) }));
  await browser.close();
})();
