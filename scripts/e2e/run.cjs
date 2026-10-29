// ============================================================================
// End-to-end regression suite. Run against a production build:
//   npm run build && npx next start -p 3100
//   node scripts/e2e/run.cjs http://localhost:3100 [--out <dir>] [--full]
//
// Always: the iPad journey, the studio (clock cable, record, reload), rapid
// instrument switching, saved-settings upgrades and touch gestures (fine adjust,
// value bubble, double-tap reset, no page scroll, a momentary lesson step, the
// spectrum scope).
// --full: also scripts/smoke.cjs and scripts/lesson-runner.cjs for every
// instrument in devices/index.ts.
// Exits non-zero if anything fails, so it can gate merges.
// ============================================================================
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const base = args.find(a => !a.startsWith('--')) ?? 'http://localhost:3100';
const outIdx = args.indexOf('--out');
const outDir = path.resolve(outIdx >= 0 ? args[outIdx + 1] : fs.mkdtempSync('/tmp/synth-e2e-'));
const full = args.includes('--full');
fs.mkdirSync(outDir, { recursive: true });

const root = path.join(__dirname, '..', '..');
/** Run a test script and parse the JSON it prints (the last JSON object in stdout) */
function run(script, scriptArgs, timeoutMs = 240_000) {
  let stdout = '';
  try {
    stdout = execFileSync('node', [script, ...scriptArgs], { cwd: root, timeout: timeoutMs, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    stdout = e.stdout?.toString() ?? '';
    if (!stdout.trim()) return { __error: String(e.message).split('\n')[0] };
  }
  const start = stdout.lastIndexOf('\n{') >= 0 ? stdout.lastIndexOf('\n{') + 1 : stdout.indexOf('{');
  try { return JSON.parse(stdout.slice(start)); } catch { return { __error: 'unparseable output: ' + stdout.slice(-200) }; }
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`);
}
const loud = v => typeof v === 'number' && v > 0.02;
const quiet = v => typeof v === 'number' && v < 0.01;

// ---- iPad journey ------------------------------------------------------------
const j = run(path.join(__dirname, 'journey.cjs'), [base, path.join(outDir, 'journey')]);
const jl = j.log ?? {};
check('journey: runs without errors', !j.__error && (j.errs ?? []).length === 0, j.__error ?? j.errs);
check('journey: studio ▶ plays the on-screen instrument', loud(jl.bigPlayPeak), jl.bigPlayPeak);
check('journey: studio ■ silences it', quiet(jl.afterBigStop), jl.afterBigStop);
check('journey: DFAM TRIGGER by touch', loud(jl.dfamTrigger), jl.dfamTrigger);
check('journey: DFAM RUN by touch', loud(jl.dfamRunning), jl.dfamRunning);
check('journey: switching stops the previous instrument', quiet(jl.afterSwitchSilence), jl.afterSwitchSilence);
check('journey: a quick key tap sounds (Sub 37)', loud(jl.sub37Key), jl.sub37Key);
check('journey: lesson coach opens', jl.coach >= 1, jl.coach);
check('journey: nothing plays by itself after reload', quiet(jl.afterReloadSilence), jl.afterReloadSilence);
check('journey: header fits one row on iPad', typeof jl.headerHeight === 'number' && jl.headerHeight <= 64, jl.headerHeight);
check('journey: no horizontal page scroll', jl.overflowX === false, jl.overflowX);

// ---- Studio ------------------------------------------------------------------
const s = run(path.join(__dirname, 'studio.cjs'), [base, path.join(outDir, 'studio')]);
check('studio: runs without errors', !s.__error && (s.errs ?? []).length === 0, s.__error ?? s.errs);
check('studio: tapping two jacks makes a cable', (s.cables ?? []).length === 1, (s.cables ?? []).length);
check('studio: clocked DFAM plays on ▶', loud(s.playPeak), s.playPeak);
check('studio: recording downloads a WAV', s.wavBytes > 100_000, s.wavBytes);
check('studio: reload keeps rack and cable', s.after?.cables === 1 && (s.after?.rack ?? []).includes('studio-clock'), s.after);

// ---- Rapid switching ---------------------------------------------------------
const w = run(path.join(__dirname, 'switching.cjs'), [base]);
check('switching: no errors', !w.__error && (w.errors ?? []).length === 0, w.__error ?? w.errors);
check('switching: every tab shows its own instrument', w.mismatches === 0 && (w.tabsFound ?? []).length >= 5, { mismatches: w.mismatches, tabs: (w.tabsFound ?? []).length });
check('switching: ends on the last selected instrument', w.lastShown === w.expectedLast, w.lastShown);

// ---- Saved-settings upgrades -------------------------------------------------
const u = run(path.join(__dirname, 'upgrade.cjs'), [base]);
check('upgrade: no errors', !u.__error && (u.errs ?? []).length === 0, u.__error ?? u.errs);
check('upgrade: old DFAM TEMPO keeps its speed (120 -> 30)', u.first?.dfamTempo === 30 && u.first?.version >= 5, u.first);
check('upgrade: other values and instruments untouched', u.first?.vco1 === 220 && u.first?.m32Tempo === 120, u.first);
check('upgrade: runs only once', u.afterReload?.dfamTempo === 30, u.afterReload);
check('upgrade: an untouched Mother-32 DECAY keeps the time it had (400 ms)', u.first?.m32Decay === 400, u.first?.m32Decay);
check('upgrade: completed lessons carry over to their rebuilt successors', u.first?.lessonCarried === true, u.first?.lessonCarried);

// ---- Touch gestures (iPad) -----------------------------------------------------
const t = run(path.join(__dirname, 'touch.cjs'), [base, path.join(outDir, 'touch')]);
const tl = t.log ?? {};
/** Speed relative to a plain drag of the same distance */
const speed = (r, want, tol) => typeof r === 'number' && Math.abs(r - want) <= tol;
const tb = tl.bubble ?? {};
const sw = tl.sideways ?? {};
const tm = tl.momentary ?? {};
const sp = tl.spectrum ?? {};
check('touch: runs without errors', !t.__error && (t.errs ?? []).length === 0, t.__error ?? t.errs);
check('touch: a knob drag moves it at full speed', tl.coarse > 10, tl.coarse);
check('touch: value bubble shows name and value above the finger, then goes', !!tb.during?.label && tb.matchesKnob && tb.aboveFinger && tb.hiddenAfterRelease && !!tb.during?.hint,
  { label: tb.during?.label, value: tb.during?.value, knob: tb.knobText, above: tb.aboveFinger, hint: tb.during?.hint, hidden: tb.hiddenAfterRelease });
check('touch: second finger = fine adjust, lifting it = full speed', speed(tl.secondFinger?.ratio, 0.1, 0.05) && tl.secondFinger?.mode === 'Fine' && speed(tl.secondFinger?.afterLiftRatio, 1, 0.25), tl.secondFinger);
check('touch: long press, then drag = fine adjust', speed(tl.longPress?.ratio, 0.1, 0.05) && tl.longPress?.modeWhileHolding === 'Fine', tl.longPress);
check('touch: sliding sideways = half speed, further = fine', speed(sw.half?.ratio, 0.5, 0.12) && sw.half?.mode === 'Half speed' && speed(sw.fine?.ratio, 0.1, 0.05) && sw.fine?.mode === 'Fine' && sw.half?.sidewaysMoved === 0 && sw.fine?.sidewaysMoved === 0,
  { half: sw.half?.ratio, halfMode: sw.half?.mode, fine: sw.fine?.ratio, fineMode: sw.fine?.mode });
check('touch: double-tap resets to default, slow taps do not', tl.doubleTap?.after === 0 && tl.doubleTap?.mode === 'Reset to default' && tl.doubleTap?.slowTaps === 50, tl.doubleTap);
check('touch: no page scroll while dragging a knob (beside the panel scrolls)', tl.scroll?.duringKnobDrag === 0 && tl.scroll?.withSecondFinger === 0 && tl.scroll?.knobMoved > 10 && tl.scroll?.lockReleased === true && tl.scroll?.besidePanel > 100, tl.scroll);
check('touch: a momentary-button do-step counts taps and completes', tm.before?.presses === 0 && tm.before?.ring === 'ssc-spot-target' && tm.afterOne?.presses === 1 && !tm.afterOne?.satisfied && /1 of 2/.test(tm.afterOne?.counter ?? '')
  && tm.afterTwo?.satisfied && tm.afterTwo?.ring === 'ssc-spot-done' && tm.afterTwo?.gotIt && tm.advanced,
  { presses: [tm.before?.presses, tm.afterOne?.presses, tm.afterTwo?.presses], counter: tm.afterOne?.counter, ring: tm.afterTwo?.ring, advanced: tm.advanced });
check('touch: spectrum scope draws the output while it plays', sp.playing?.mode === 'spectrum' && sp.flippedTo === 'wave' && sp.playing?.sized && sp.quiet?.lit < 40 && sp.playing?.cols > 0.3 * (sp.playing?.W ?? 1e9),
  { quiet: sp.quiet?.lit, playingCols: sp.playing?.cols, width: sp.playing?.W, mode: sp.playing?.mode, flip: sp.flippedTo });

// ---- Producer path on iPad ---------------------------------------------------
const pp = run(path.join(__dirname, 'producer.cjs'), [base, path.join(outDir, 'producer')], 600_000);
check('producer path: iPad walkthrough of a whole-studio lesson', !pp.__error && pp.total > 0 && (pp.failed ?? []).length === 0 && (pp.errs ?? []).length === 0,
  pp.__error ?? { passed: pp.passed, total: pp.total, failed: pp.failed });

// ---- Every instrument (--full) -----------------------------------------------
if (full) {
  const registry = fs.readFileSync(path.join(root, 'devices', 'index.ts'), 'utf8');
  const devices = [...registry.matchAll(/^\s+id: '([^']+)'/gm)].map(m => m[1]);
  // Instruments that make no sound on their own (a clock, external gear)
  const silent = new Set(['studio-clock', 'midi-synth', 'audio-in', 'wam-plugin']);
  for (const d of devices) {
    const r = run(path.join(root, 'scripts', 'smoke.cjs'), [base, d, outDir]);
    const desk = r.sizes?.desktop ?? {};
    check(`smoke ${d}: no errors`, !r.__error && (r.errors ?? []).length === 0, r.__error ?? r.errors);
    check(`smoke ${d}: silent at rest`, quiet(desk.idlePeak ?? 0), desk.idlePeak);
    if (!silent.has(d)) check(`smoke ${d}: makes sound`, [desk.noteA, desk.transportPeak, desk.buttonPeak].some(loud), { note: desk.noteA, transport: desk.transportPeak, buttons: desk.buttonPeak });
    check(`smoke ${d}: fits without horizontal scroll`, desk.overflowX === false && r.sizes?.ipad?.overflowX === false, { desktop: desk.overflowX, ipad: r.sizes?.ipad?.overflowX });
    const l = run(path.join(root, 'scripts', 'lesson-runner.cjs'), [base, d], 900_000);
    if (l.lessons) check(`lessons ${d}: all ${l.lessons} complete`, l.failedLessons === 0 && (l.errors ?? []).length === 0, l.failedLessons ? l.details : l.errors);
  }
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed. Screenshots and files: ${outDir}`);
fs.writeFileSync(path.join(outDir, 'e2e-results.json'), JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
