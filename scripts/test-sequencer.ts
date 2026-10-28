// ============================================================================
// Elektron sequencer tests:  npm run test:seq   (npx tsx scripts/test-sequencer.ts)
//
// Runs the scheduler on a fake audio clock (internal mode) and a fake studio
// transport (follow mode), plus one pass over the real Transport class with a
// fake AudioContext. Exits non-zero on failure.
// ============================================================================

import {
  ElektronSequencer, LockTracker, NOTE_LENGTHS, LEN_INF, LEN_1_STEP, SPEED_TICKS, SPEEDS, TRIG_CONDITIONS,
  asProject, chainAdd, clearLock, createProject, displayWithLocks, formatLength, formatMicro, heldSteps,
  interceptForLocks, migrateProject, patchStep, setChain, setLock, setPlayMode, setStep, songAddRow, toggleTrig,
  trigSteps, updatePatternSettings, updateSteps, setTrackScale, setTrackMute, compileCondition, conditionString,
  setChangeMode, getStep, setTrackDefault, mulberry32, clearPattern, copyPattern, pastePattern, songUpdateRow,
  setTrackProb, projectData, arrangerPatterns, isProject,
  type LockOptions, type Pattern, type PatternId, type Project, type SequencerOptions, type Step, type TimerApi,
  type TransportLike, type TrigEvent,
} from '../lib/sequencer/elektron';
import { Transport, type TransportEvent, type TransportTick } from '../lib/audio/transport';
import type { DeviceUiApi } from '../devices/types';
import type { ControlValue } from '../types';
import type { CustomRenderContext } from '../types/panel';
import * as ReactNS from 'react';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ChainBuilder, MenuKey, PagePicker, PatternPicker, ScaleMenu, SongEditor, TrigEditor, TrigKeys,
} from '../components/sequencer';

// The UI kit's .tsx files use Next's automatic JSX runtime; tsx compiles them with
// the classic one here (tsconfig has jsx: preserve), which needs a global React.
(globalThis as unknown as { React: typeof ReactNS }).React = ReactNS;

// ----------------------------------------------------------------------------
// Tiny harness
// ----------------------------------------------------------------------------

let passed = 0;
const failures: string[] = [];
let group = '';

function section(name: string) {
  group = name;
  console.log(`\n${name}`);
}

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`${group} > ${name}: ${msg}`);
    console.log(`  FAIL  ${name}\n        ${msg}`);
  }
}

function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
function eq<T>(a: T, b: T, msg = '') {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg} expected ${sb}, got ${sa}`);
}
function near(a: number, b: number, eps = 1e-6, msg = '') {
  if (!(Math.abs(a - b) <= eps)) throw new Error(`${msg} expected ${b}, got ${a} (±${eps})`);
}
function nearAll(a: number[], b: number[], eps = 1e-6, msg = '') {
  if (a.length !== b.length) throw new Error(`${msg} expected ${b.length} values [${b.map(x => x.toFixed(4))}], got ${a.length} [${a.map(x => x.toFixed(4))}]`);
  a.forEach((x, i) => near(x, b[i], eps, `${msg}[${i}]`));
}

// ----------------------------------------------------------------------------
// Fakes
// ----------------------------------------------------------------------------

/** Fake AudioContext clock + timers: advance() moves time and fires due timers in order */
class FakeClock implements TimerApi {
  currentTime = 0;
  private seq = 0;
  private timers = new Map<number, { at: number; fn: () => void; every: number }>();
  setInterval(fn: () => void, ms: number) {
    const id = ++this.seq;
    this.timers.set(id, { at: this.currentTime + ms / 1000, fn, every: Math.max(0.001, ms / 1000) });
    return id;
  }
  clearInterval(h: unknown) { this.timers.delete(h as number); }
  setTimeout(fn: () => void, ms: number) {
    const id = ++this.seq;
    this.timers.set(id, { at: this.currentTime + ms / 1000, fn, every: 0 });
    return id;
  }
  clearTimeout(h: unknown) { this.timers.delete(h as number); }
  advance(sec: number) {
    const end = this.currentTime + sec;
    for (let guard = 0; guard < 1e6; guard++) {
      let id = -1;
      let at = Infinity;
      this.timers.forEach((t, k) => { if (t.at < at) { at = t.at; id = k; } });
      if (id < 0 || at > end) break;
      this.currentTime = Math.max(this.currentTime, at);
      const t = this.timers.get(id)!;
      if (t.every > 0) t.at += t.every;
      else this.timers.delete(id);
      t.fn();
    }
    this.currentTime = end;
  }
}

/** Studio-transport stand-in: emits 24-PPQN ticks with exact times on demand */
class FakeTransport implements TransportLike {
  bpm = 120;
  swing = 0;
  playing = false;
  tick = 0;
  private t0 = 0;
  private startTick = 0;
  private tl = new Set<(t: TransportTick) => void>();
  private el = new Set<(e: TransportEvent) => void>();
  onTick(l: (t: TransportTick) => void) { this.tl.add(l); return () => { this.tl.delete(l); }; }
  onEvent(l: (e: TransportEvent) => void) { this.el.add(l); return () => { this.el.delete(l); }; }
  get dur() { return 60 / this.bpm / 24; }
  timeOf(tick: number) {
    const base = this.t0 + (tick - this.startTick) * this.dur;
    return base + (tick % 12 >= 6 ? this.swing * 6 * this.dur : 0);
  }
  start(time = 0, fromTick = 0) {
    this.playing = true;
    this.t0 = time;
    this.tick = fromTick;
    this.startTick = fromTick;
    this.el.forEach(l => l({ type: 'start', time }));
  }
  stop(time = this.timeOf(this.tick)) {
    this.playing = false;
    this.el.forEach(l => l({ type: 'stop', time }));
  }
  run(n: number) {
    for (let i = 0; i < n; i++) {
      const tick = this.tick;
      const ev: TransportTick = {
        time: this.timeOf(tick), tick, tickDuration: this.dur,
        beat: tick / 24, bar: Math.floor(tick / 96), sixteenth: Math.floor(tick / 6),
      };
      this.tl.forEach(l => l(ev));
      this.tick++;
    }
  }
}

interface Rig {
  seq: ElektronSequencer;
  clock: FakeClock;
  trigs: TrigEvent[];
  offs: { track: number; note: number; time: number }[];
  steps: { track: number; step: number; time: number }[];
  patterns: { id: PatternId; time: number }[];
  rows: { row: number; repeat: number; time: number }[];
  plays: { playing: boolean; time: number }[];
  tempos: { bpm: number; time: number }[];
  /** clock time when each trig was emitted (must not be after the trig's time) */
  emittedAt: number[];
}

function rig(project: Project, extra: Partial<SequencerOptions> = {}): Rig {
  const clock = new FakeClock();
  const r: Rig = { seq: null as unknown as ElektronSequencer, clock, trigs: [], offs: [], steps: [], patterns: [], rows: [], plays: [], tempos: [], emittedAt: [] };
  r.seq = new ElektronSequencer({
    ctx: clock,
    timers: clock,
    tracks: project.tracks,
    seed: 1234,
    onTrig: e => { r.trigs.push(e); r.emittedAt.push(clock.currentTime); },
    onNoteOff: (track, note, time) => r.offs.push({ track, note, time }),
    onStep: (track, step, time) => r.steps.push({ track, step, time }),
    onPattern: (id, time) => r.patterns.push({ id, time }),
    onSongRow: (row, repeat, time) => r.rows.push({ row, repeat, time }),
    onPlay: (playing, time) => r.plays.push({ playing, time }),
    onTempo: (bpm, time) => r.tempos.push({ bpm, time }),
    ...extra,
  });
  r.seq.setProject(project);
  return r;
}

/** Project builder: steps per track as { stepIndex: Step } */
function proj(tracks: number, spec: Record<number, Record<number, Step>> = {}, pattern: Partial<Pattern> = {}, id: PatternId = 'A01'): Project {
  let p = createProject({ tracks });
  for (const [t, steps] of Object.entries(spec)) {
    for (const [s, st] of Object.entries(steps)) p = setStep(p, id, Number(t), Number(s), st);
  }
  if (Object.keys(pattern).length) p = updatePatternSettings(p, id, pattern);
  if (!p.patterns[id]) p = updatePatternSettings(p, id, { name: '' });
  return p;
}

const STEP120 = 0.125; // 16th at 120 BPM
const T0 = 0.05; // internal clock's first tick (start() at time 0)
const times = (r: Rig, track = 0, f: (e: TrigEvent) => boolean = () => true) => r.trigs.filter(e => e.track === track && f(e)).map(e => e.time);

// ============================================================================
section('Data model');

test('note length table: 128 hardware positions, 1/16 at 14, INF at 127', () => {
  eq(NOTE_LENGTHS.length, 128);
  eq(NOTE_LENGTHS[0], 0.125);
  near(NOTE_LENGTHS[1], 0.1875);
  eq(NOTE_LENGTHS[LEN_1_STEP], 1);
  eq(NOTE_LENGTHS[30], 2);
  eq(NOTE_LENGTHS[126], 128);
  eq(NOTE_LENGTHS[LEN_INF], Infinity);
  for (let i = 1; i < 127; i++) ok(NOTE_LENGTHS[i] > NOTE_LENGTHS[i - 1], `lengths increase at ${i}`);
  eq([formatLength(0), formatLength(1), formatLength(14), formatLength(30), formatLength(LEN_INF)], ['0.125', '0.188', '1/16', '1/8', 'INF']);
});

test('speeds: ticks per step', () => {
  eq(SPEEDS.map(s => SPEED_TICKS[s]), [3, 4, 6, 8, 12, 24, 48]);
});

test('conditions: every encoder value round-trips, invalid strings are none', () => {
  eq(TRIG_CONDITIONS.length, 1 + 22 + 8 + 35);
  for (const c of TRIG_CONDITIONS.slice(1)) eq(conditionString(compileCondition(c)), c, c);
  eq(compileCondition('9:2'), 0);
  eq(compileCondition('banana'), 0);
  eq(conditionString(compileCondition('not fill')), '!FILL');
});

test('micro timing display', () => {
  eq([formatMicro(1), formatMicro(-2), formatMicro(12), formatMicro(23), formatMicro(0)], ['+1/384', '-1/192', '+1/32', '+23/384', '0']);
});

test('edits are immutable with structural sharing', () => {
  const a = proj(4, { 0: { 0: {} } });
  const b = toggleTrig(a, 'A01', 1, 3);
  ok(a !== b && a.patterns.A01 !== b.patterns.A01, 'new objects on the edited path');
  ok(a.patterns.A01.tracks[0] === b.patterns.A01.tracks[0], 'untouched track keeps identity');
  eq(trigSteps(b, 'A01', 1), [3]);
  eq(trigSteps(a, 'A01', 1), []);
  const c = toggleTrig(b, 'A01', 1, 3);
  eq(trigSteps(c, 'A01', 1), []);
});

test('steps are stored sparsely and survive a JSON round trip', () => {
  let p = proj(12, { 3: { 5: { note: 64, micro: -4, cond: '1:4', retrig: { rate: 12, len: 30, vel: -64 }, locks: { decay: 40 } } } });
  p = setStep(p, 'A01', 0, 0, { trigless: true, locks: { tune: 12 } });
  const json = JSON.stringify(p);
  ok(json.length < 1400, `compact JSON (${json.length} bytes)`);
  const back = migrateProject(JSON.parse(json), 12);
  eq(back, p);
  eq(Object.keys(back.patterns.A01.tracks[3].steps), ['5']);
});

test('migrateProject repairs garbage and clamps values', () => {
  const m = migrateProject({ v: 1, tracks: 4, active: 'Z99', patterns: { A02: { length: 999, swing: 5, tracks: [{ steps: { 0: { vel: 900, micro: -80, cond: 'nope' }, 99: {} } }] }, bad: {} } }, 4);
  eq(m.active, 'A01');
  eq(Object.keys(m.patterns), ['A02']);
  eq(m.patterns.A02.length, 64);
  eq(m.patterns.A02.swing, 50);
  eq(m.patterns.A02.tracks.length, 4);
  eq(m.patterns.A02.tracks[0].steps[0], { vel: 127, micro: -23 });
  eq(Object.keys(m.patterns.A02.tracks[0].steps), ['0']);
  eq(asProject(undefined, 4).tracks, 4);
});

test('patchStep drops empty fields', () => {
  eq(patchStep({ micro: 3, cond: '1:2', slide: true, locks: { a: 1 } }, { micro: 0, cond: '', slide: false, locks: {} }), {});
});

test('module helpers: projectData keeps valid saves, arrangerPatterns lists patterns with trigs', () => {
  const pd = projectData({ tracks: 12, defaults: { note: 36 } });
  const init = pd.initial() as Project;
  eq([init.tracks, init.defaults[11].note, init.active], [12, 36, 'A01']);
  ok(pd.migrate(init) === init, 'a valid project is returned as is (no store write)');
  const fixed = pd.migrate({ tracks: 12, patterns: { A03: { tracks: [{ steps: { 2: {} } }] } } }) as Project;
  ok(isProject(fixed) && fixed.tracks === 12, 'old data is migrated');
  let p = setStep(init, 'C05', 3, 0, {});
  p = updatePatternSettings(p, 'C05', { name: 'BREAK' });
  p = setStep(p, 'A02', 0, 4, {});
  p = updatePatternSettings(p, 'H16', { name: 'EMPTY' });
  eq(arrangerPatterns(p, 12), [{ id: 'A02' }, { id: 'C05', label: 'C05 BREAK' }]);
});

test('copy / paste / clear pattern', () => {
  const p = proj(4, { 0: { 0: {}, 4: { note: 50 } } });
  const clip = copyPattern(p, 'A01');
  const q = pastePattern(p, 'B03', clip);
  eq(trigSteps(q, 'B03', 0), [0, 4]);
  ok(q.patterns.B03 !== q.patterns.A01, 'deep copy');
  eq(Object.keys(clearPattern(q, 'A01').patterns), ['B03']);
});

// ============================================================================
section('Step timing (internal clock)');

test('120 BPM 1x: four-on-the-floor lands on the beat and loops after 16 steps', () => {
  const r = rig(proj(1, { 0: { 0: {}, 4: {}, 8: {}, 12: {} } }));
  r.seq.start();
  r.clock.advance(2.2);
  nearAll(times(r), [0, 0.5, 1, 1.5, 2].map(t => T0 + t));
  eq(r.trigs.slice(0, 4).map(e => e.step), [0, 4, 8, 12]);
  eq(r.trigs[4].loop, 1);
  r.emittedAt.forEach((at, i) => ok(at <= r.trigs[i].time, 'scheduled ahead of its time'));
});

test('onStep fires every step with the grid time', () => {
  const r = rig(proj(1, {}));
  r.seq.start();
  r.clock.advance(0.6);
  const st = r.steps.filter(s => s.track === 0);
  eq(st.slice(0, 5).map(s => s.step), [0, 1, 2, 3, 4]);
  nearAll(st.slice(0, 5).map(s => s.time), [0, 1, 2, 3, 4].map(i => T0 + i * STEP120));
});

for (const bpm of [90, 133, 174]) {
  test(`${bpm} BPM, every speed: step interval = ticks x 60/bpm/24`, () => {
    for (const speed of SPEEDS) {
      const r = rig(proj(1, { 0: { 0: {}, 1: {}, 2: {}, 3: {} } }, { speed, length: 4 }), { bpm });
      r.seq.start();
      const stepSec = (SPEED_TICKS[speed] * 60) / bpm / 24;
      r.clock.advance(T0 + stepSec * 4 + 0.2);
      const t = times(r).slice(0, 4);
      nearAll(t, [0, 1, 2, 3].map(i => T0 + i * stepSec), 1e-6, speed);
    }
  });
}

test('tempo change while running takes effect on the next tick', () => {
  const r = rig(proj(1, { 0: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} } }));
  r.seq.start();
  r.clock.advance(0.1); // steps 0 (0.05) scheduled; look-ahead to 0.22
  r.seq.setTempo(60);
  r.clock.advance(2);
  const t = times(r);
  near(t[1] - t[0], STEP120, 1e-6, 'already scheduled at 120');
  near(t[4] - t[3], 0.25, 1e-6, 'at 60 BPM a 16th is 0.25 s');
});

test('PER TRACK scale: each track has its own length and speed', () => {
  let p = proj(2, { 0: { 0: {}, 1: {}, 2: {}, 3: {} }, 1: { 0: {}, 1: {}, 2: {} } }, { scaleMode: 'track', length: 16, master: 0, change: 16 });
  p = setTrackScale(p, 'A01', 0, { length: 4 });
  p = setTrackScale(p, 'A01', 1, { length: 3, speed: '2x' });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 1.0);
  nearAll(times(r, 0).slice(0, 6), [0, 1, 2, 3, 4, 5].map(i => T0 + i * STEP120), 1e-6, 'track 1 (4 steps at 1x)');
  nearAll(times(r, 1).slice(0, 7), [0, 1, 2, 3, 4, 5, 6].map(i => T0 + i * STEP120 / 2), 1e-6, 'track 2 (3 steps at 2x)');
  eq(r.trigs.filter(e => e.track === 1).slice(0, 7).map(e => e.step), [0, 1, 2, 0, 1, 2, 0]);
  eq(r.trigs.filter(e => e.track === 1).slice(0, 7).map(e => e.loop), [0, 0, 0, 1, 1, 1, 2]);
});

test('PER TRACK master length restarts every track together', () => {
  let p = proj(1, { 0: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} } }, { scaleMode: 'track', master: 8, change: 8 });
  p = setTrackScale(p, 'A01', 0, { length: 5 });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 16 * STEP120 + 0.01);
  // 0 1 2 3 4 | 0 1 2 (master 8) | 0 1 2 3 4 | 0 1 2
  eq(r.trigs.map(e => e.step), [0, 1, 2, 3, 4, 0, 1, 2, 0, 1, 2, 3, 4, 0, 1, 2, 0]);
  eq(r.trigs.map(e => e.loop).slice(0, 9), [0, 0, 0, 0, 0, 1, 1, 1, 2]);
});

test('pattern length below the current step wraps immediately', () => {
  const p = proj(1, { 0: { 0: {}, 10: {} } });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 12 * STEP120); // past step 10
  r.seq.setProject(updatePatternSettings(p, 'A01', { length: 8 }));
  r.clock.advance(1.0);
  eq(r.trigs.map(e => e.step).slice(0, 3), [0, 10, 0]);
});

// ============================================================================
section('Swing and micro timing');

test('swing delays every even 16th by (swing-50)/50 of a 16th', () => {
  const r = rig(proj(1, { 0: { 0: {}, 1: {}, 2: {}, 3: {} } }, { swing: 66 }));
  r.seq.start();
  r.clock.advance(0.6);
  const d = ((66 - 50) / 50) * STEP120;
  nearAll(times(r).slice(0, 4), [T0, T0 + STEP120 + d, T0 + 2 * STEP120, T0 + 3 * STEP120 + d]);
});

test('swing follows the track\'s own steps: at 2x every second 32nd moves by a share of a 32nd', () => {
  // Hardware: swing trigs are step positions (default 2, 4, 6...), not the 16th grid
  const r = rig(proj(1, { 0: { 0: {}, 1: {}, 2: {}, 3: {} } }, { swing: 75, speed: '2x' }));
  r.seq.start();
  r.clock.advance(0.4);
  const h = STEP120 / 2;
  const d = 0.5 * h;
  nearAll(times(r).slice(0, 4), [T0, T0 + h + d, T0 + 2 * h, T0 + 3 * h + d]);
});

test('swing counts steps across loops: with an odd length the swung steps shift every loop', () => {
  const r = rig(proj(1, { 0: { 0: {}, 1: {}, 2: {} } }, { swing: 60, length: 3 }));
  r.seq.start();
  r.clock.advance(T0 + 6 * STEP120 - STEP120);
  const d = 0.2 * STEP120;
  const late = r.trigs.map((e, i) => Math.abs(e.time - (T0 + i * STEP120 + d)) < 1e-9);
  eq(r.trigs.map(e => e.step), [0, 1, 2, 0, 1, 2]);
  eq(late, [false, true, false, true, false, true]);
});

test('positive micro timing: +12 = half a step later', () => {
  const r = rig(proj(1, { 0: { 1: { micro: 12 }, 2: { micro: 1 } } }));
  r.seq.start();
  r.clock.advance(0.6);
  nearAll(times(r).slice(0, 2), [T0 + STEP120 * 1.5, T0 + STEP120 * (2 + 1 / 24)]);
});

test('negative micro timing is scheduled early (before its time), even near a whole step', () => {
  const r = rig(proj(1, { 0: { 4: { micro: -23 }, 8: { micro: -6 } } }));
  r.seq.start();
  r.clock.advance(1.5);
  nearAll(times(r).slice(0, 2), [T0 + STEP120 * (4 - 23 / 24), T0 + STEP120 * (8 - 0.25)]);
  r.emittedAt.forEach((at, i) => ok(at <= r.trigs[i].time + 1e-9, `trig ${i} emitted at ${at} after its time ${r.trigs[i].time}`));
});

test('negative micro on step 1 plays at the start, then before the loop point', () => {
  const r = rig(proj(1, { 0: { 0: { micro: -12 } } }));
  r.seq.start();
  r.clock.advance(T0 + 16 * STEP120 + 0.2);
  nearAll(times(r).slice(0, 2), [T0, T0 + 16 * STEP120 - STEP120 / 2]);
  eq(r.trigs[1].loop, 1, 'second hit belongs to loop 2');
});

test('negative micro timing in follow mode is emitted on the latest tick at or before it', () => {
  const p = proj(1, { 0: { 4: { micro: -20 } } }, { speed: '1/8x' }); // 1/8x: a step is 48 ticks, -20/24 = 40 ticks early
  const tr = new FakeTransport();
  const r = rig(p);
  const emitTicks: number[] = [];
  r.seq.follow(tr);
  const seq2 = new ElektronSequencer({ ctx: r.clock, timers: r.clock, tracks: 1, onTrig: () => emitTicks.push(tr.tick) });
  seq2.setProject(p);
  seq2.follow(tr);
  tr.start(1);
  tr.run(48 * 5);
  near(times(r)[0], 1 + (4 * 48 - 40) * tr.dur);
  eq(emitTicks, [4 * 48 - 40]);
});

// ============================================================================
section('Trig conditions');

/** Loops (0-based) on which track `t`'s trig at step 0 played, over `loops` loops of a 1-step pattern */
function playedLoops(p: Project, loops: number, track = 0, before?: (r: Rig) => void): number[] {
  const p1 = updatePatternSettings(p, 'A01', { length: 1 });
  const r = rig(p1);
  before?.(r);
  r.seq.start();
  r.clock.advance(T0 + loops * STEP120 - STEP120); // look-ahead 0.12 s: exactly `loops` loops scheduled
  return r.trigs.filter(e => e.track === track && e.conditionPassed).map(e => e.loop);
}

test('A:B - plays on loop A of every B', () => {
  eq(playedLoops(proj(1, { 0: { 0: { cond: '1:2' } } }), 7), [0, 2, 4, 6]);
  eq(playedLoops(proj(1, { 0: { 0: { cond: '2:3' } } }), 9), [1, 4, 7]);
  eq(playedLoops(proj(1, { 0: { 0: { cond: '8:8' } } }), 17), [7, 15]);
  eq(playedLoops(proj(1, { 0: { 0: { cond: '3:4' } } }), 12), [2, 6, 10]);
});

test('A:B counts the track loop, not the pattern loop (PER TRACK)', () => {
  let p = proj(1, { 0: { 0: { cond: '1:2' } } }, { scaleMode: 'track', length: 4, master: 0, change: 4 });
  p = setTrackScale(p, 'A01', 0, { length: 2 });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 8 * STEP120 - STEP120);
  nearAll(times(r), [0, 4].map(i => T0 + i * STEP120));
});

test('1ST and !1ST', () => {
  eq(playedLoops(proj(1, { 0: { 0: { cond: '1ST' } } }), 5), [0]);
  eq(playedLoops(proj(1, { 0: { 0: { cond: '!1ST' } } }), 5), [1, 2, 3, 4]);
});

test('FILL / !FILL with momentary fill', () => {
  const p = updatePatternSettings(proj(2, { 0: { 0: { cond: 'FILL' } }, 1: { 0: { cond: '!FILL' } } }), 'A01', { length: 1 });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(0.15); // loops 0,1 scheduled (look-ahead to 0.27)
  r.seq.setFill(true);
  r.clock.advance(3 * STEP120);
  r.seq.setFill(false);
  r.clock.advance(2 * STEP120);
  const fillLoops = r.trigs.filter(e => e.track === 0).map(e => e.loop);
  const notLoops = r.trigs.filter(e => e.track === 1).map(e => e.loop);
  eq(fillLoops, [2, 3, 4]);
  eq(notLoops, [0, 1, 5, 6]);
  ok(r.trigs.filter(e => e.track === 0).every(e => e.fill), 'fill flag set');
});

test('latched fill stays on until unlatched', () => {
  const p = updatePatternSettings(proj(1, { 0: { 0: { cond: 'FILL' } } }), 'A01', { length: 1 });
  const r = rig(p);
  r.seq.latchFill(true);
  r.seq.start();
  r.clock.advance(0.3); // loops 0..2 scheduled
  r.seq.latchFill(false);
  r.clock.advance(3 * STEP120);
  eq(r.trigs.map(e => e.loop), [0, 1, 2]);
  eq(r.seq.getState().fillLatched, false);
});

test('cued fill is active for exactly the next pattern cycle', () => {
  const p = proj(1, { 0: { 0: { cond: 'FILL' }, 8: { cond: 'FILL' } } });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 3 * STEP120); // in loop 0
  r.seq.cueFill();
  r.clock.advance(4 * 16 * STEP120);
  eq(r.trigs.map(e => `${e.loop}:${e.step}`), ['1:0', '1:8']);
});

test('PRE / !PRE follow the most recent non-PRE condition on the track', () => {
  // step 0: 1:2 (true on even loops); step 4: PRE; step 8: !PRE (still about step 0 - PRE does not update)
  const p = proj(1, { 0: { 0: { cond: '1:2' }, 4: { cond: 'PRE' }, 8: { cond: '!PRE' } } });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 4 * 16 * STEP120 - STEP120);
  eq(r.trigs.map(e => `${e.loop}:${e.step}`), ['0:0', '0:4', '1:8', '2:0', '2:4', '3:8']);
});

test('PRE with no earlier condition is false, !PRE too', () => {
  eq(playedLoops(proj(1, { 0: { 0: { cond: 'PRE' } } }), 3), []);
  eq(playedLoops(proj(1, { 0: { 0: { cond: '!PRE' } } }), 3), []);
});

test('NEI / !NEI read the track before; NEI results chain', () => {
  // t0: 50% ; t1: NEI (plays with t0) ; t2: !NEI (plays when t1 did not) ; t3: !NEI of t2
  const p = updatePatternSettings(proj(4, { 0: { 0: { cond: '50%' } }, 1: { 0: { cond: 'NEI' } }, 2: { 0: { cond: '!NEI' } }, 3: { 0: { cond: '!NEI' } } }), 'A01', { length: 1 });
  const r = rig(p, { emitFailed: true });
  r.seq.start();
  r.clock.advance(T0 + 64 * STEP120 - STEP120);
  const byLoop = (t: number) => r.trigs.filter(e => e.track === t).map(e => e.conditionPassed);
  const a = byLoop(0), b = byLoop(1), c = byLoop(2), d = byLoop(3);
  eq(a.length, 64);
  ok(a.some(x => x) && a.some(x => !x), 'probability produced both outcomes');
  eq(b, a, 'NEI follows the neighbour');
  eq(c, a.map(x => !x), '!NEI is the opposite');
  eq(d, c.map(x => !x), 'chains through NEI results');
});

test('NEI with no condition on the neighbour is false; track 1 is its own neighbour', () => {
  eq(playedLoops(proj(2, { 0: { 0: {} }, 1: { 0: { cond: 'NEI' } } }), 3, 1), []);
  eq(playedLoops(proj(2, { 0: { 0: {} }, 1: { 0: { cond: '!NEI' } } }), 3, 1), []);
  // track 0: step 0 1:2 then step... NEI on track 0 reads its own state
  const p = proj(1, { 0: { 0: { cond: '1:2' }, 1: { cond: 'NEI' } } }, { length: 2 });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 8 * STEP120 - STEP120);
  eq(r.trigs.map(e => `${e.loop}:${e.step}`), ['0:0', '0:1', '2:0', '2:1']);
});

test('probability: seeded, deterministic, roughly right', () => {
  const p = proj(1, { 0: { 0: { cond: '25%' } } });
  const a = playedLoops(p, 400);
  const b = playedLoops(p, 400);
  eq(a, b, 'same seed, same result');
  ok(a.length > 60 && a.length < 140, `25% of 400 ~ 100 (got ${a.length})`);
  eq(playedLoops(proj(1, { 0: { 0: { cond: '100%' } } }), 20).length, 20);
  const rng = mulberry32(7);
  const xs = Array.from({ length: 1000 }, rng);
  ok(xs.every(x => x >= 0 && x < 1), 'rng range');
});

test('track probability: thins out trigs without a condition, leaves conditional trigs and PRE alone', () => {
  let p = proj(1, { 0: { 0: {}, 1: { cond: '1:2' }, 2: { cond: 'PRE' } } }, { length: 4 });
  p = setTrackProb(p, 'A01', 0, 30);
  eq(p.patterns.A01.tracks[0].prob, 30);
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 400 * 4 * STEP120 - STEP120);
  const plain = r.trigs.filter(e => e.step === 0).length;
  const ab = r.trigs.filter(e => e.step === 1).map(e => e.loop);
  const pre = r.trigs.filter(e => e.step === 2).map(e => e.loop);
  ok(plain > 80 && plain < 160, `30% of 400 ~ 120 (got ${plain})`);
  eq(ab.length, 200, 'A:B trigs ignore the track probability');
  eq(pre, ab, 'PRE reads the 1:2 result, not the probability roll');
  eq(setTrackProb(p, 'A01', 0, 100).patterns.A01.tracks[0].prob, undefined, '100 % is stored as nothing');
});

test('conditions are evaluated on muted tracks (NEI keeps working), but nothing plays', () => {
  let p = updatePatternSettings(proj(2, { 0: { 0: { cond: '1:2' } }, 1: { 0: { cond: 'NEI' } } }), 'A01', { length: 1 });
  p = setTrackMute(p, 'A01', 0, true);
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 4 * STEP120 - STEP120);
  eq(r.trigs.filter(e => e.track === 0).length, 0);
  eq(r.trigs.filter(e => e.track === 1).map(e => e.loop), [0, 2]);
});

// ============================================================================
section('Retrig');

test('retrig 1/32 over 1/8 with a fade-out: 4 hits, falling velocity', () => {
  const r = rig(proj(1, { 0: { 0: { vel: 100, retrig: { rate: 12, len: 30, vel: -128 } } } }));
  r.seq.start();
  r.clock.advance(1);
  const hits = r.trigs.filter(e => e.step === 0 && e.loop === 0);
  nearAll(hits.map(e => e.time), [0, 1, 2, 3].map(i => T0 + i * STEP120 / 2));
  eq(hits.map(e => e.retrigIndex), [0, 1, 2, 3]);
  eq(hits.map(e => e.velocity), [100, 75, 50, 25]);
  ok(hits.every(e => e.retrig), 'retrig flag');
  near(hits[0].duration, STEP120 / 2, 1e-9, 'each hit ends before the next');
});

test('retrig fade-in and triplet rate (1/12 = 3 per 4 steps)', () => {
  const r = rig(proj(1, { 0: { 0: { vel: 120, retrig: { rate: 8, len: 46, vel: 64 } } } })); // 1/12, LEN 4 steps
  r.seq.start();
  r.clock.advance(1);
  const hits = r.trigs.filter(e => e.loop === 0);
  nearAll(hits.map(e => e.time), [0, 1, 2].map(i => T0 + (i * 4 * STEP120) / 3));
  eq(hits.map(e => e.velocity), [60, 80, 100]);
});

test('a new trig on the track cuts the retrig', () => {
  const r = rig(proj(1, { 0: { 0: { retrig: { rate: 12, len: 46, vel: 0 } }, 1: {} } }));
  r.seq.start();
  r.clock.advance(0.5);
  nearAll(times(r).slice(0, 3), [T0, T0 + STEP120 / 2, T0 + STEP120]);
  eq(r.trigs[2].retrigIndex, 0);
  eq(r.trigs[2].step, 1);
});

test('retrig LEN INF runs until the next trig', () => {
  const r = rig(proj(1, { 0: { 0: { retrig: { rate: 9, len: LEN_INF, vel: 0 } }, 6: {} } }));
  r.seq.start();
  r.clock.advance(1.2);
  eq(r.trigs.filter(e => e.loop === 0).map(e => e.step + ':' + e.retrigIndex), ['0:0', '0:1', '0:2', '0:3', '0:4', '0:5', '6:0']);
});

// ============================================================================
section('Length and note-off');

test('note-off after LEN (1/16, 1/8, 0.5 step)', () => {
  const r = rig(proj(1, { 0: { 0: { len: 14 }, 4: { len: 30 }, 8: { len: 6 } } }));
  r.seq.start();
  r.clock.advance(2);
  const offs = r.offs.slice(0, 3).map(o => o.time);
  nearAll(offs, [T0 + STEP120, T0 + 4 * STEP120 + 2 * STEP120, T0 + 8 * STEP120 + 0.5 * STEP120]);
  near(r.trigs[1].duration, 2 * STEP120);
});

test('note-offs are released ahead of time and never before their note', () => {
  const r = rig(proj(2, { 0: { 0: { len: 62 } }, 1: { 3: {} } })); // 8 steps
  r.seq.start();
  r.clock.advance(3);
  ok(r.offs.length >= 2, 'offs emitted');
  for (const o of r.offs) {
    const on = r.trigs.filter(e => e.track === o.track && e.time <= o.time + 1e-9).pop();
    ok(on, 'off belongs to a note');
  }
});

test('overlapping notes on a track: the next trig cuts the previous gate', () => {
  const r = rig(proj(1, { 0: { 0: { len: 46, note: 60 }, 2: { note: 62 } } }));
  r.seq.start();
  r.clock.advance(0.6);
  eq(r.offs[0].note, 60);
  near(r.offs[0].time, T0 + 2 * STEP120, 1e-9, 'cut at the next trig');
});

test('LEN INF holds until the next trig (or stop)', () => {
  const r = rig(proj(1, { 0: { 0: { len: LEN_INF } } }));
  r.seq.start();
  r.clock.advance(1);
  eq(r.offs.length, 0);
  eq(r.trigs[0].duration, Infinity);
  r.clock.advance(1.2); // loop -> step 0 again cuts the INF note
  eq(r.offs.length, 1);
  near(r.offs[0].time, T0 + 16 * STEP120);
  r.seq.stop();
  eq(r.offs.length, 2, 'stop releases the sounding note');
});

test('slide keeps the previous gate open (legato into the slide note)', () => {
  const r = rig(proj(1, { 0: { 0: { len: 46, note: 48 }, 2: { slide: true, note: 55, len: 14 } } }));
  r.seq.start();
  r.clock.advance(0.8);
  eq(r.offs.map(o => o.note), [55], 'no off for the first note; the slide note ends the phrase');
  near(r.offs[0].time, T0 + 3 * STEP120);
  ok(r.trigs[1].slide, 'slide flag');
});

test('parameter slide: the slide trig carries the next trig\'s time and locks (gaps skipped, wraps)', () => {
  const r = rig(proj(1, { 0: { 0: { pslide: true, locks: { cutoff: 10 } }, 3: { trigless: true, locks: { cutoff: 90 } }, 6: { pslide: true } } }, { length: 8, swing: 60 }));
  r.seq.start();
  r.clock.advance(T0 + 8 * STEP120 - STEP120);
  const [a, b, c] = r.trigs;
  ok(a.paramSlide && a.slideTo !== null, 'slide target present');
  near(a.slideTo!.time, b.time, 1e-9, 'arrives at the next trig (swing included)');
  eq(a.slideTo!.locks, { cutoff: 90 });
  eq(b.slideTo, null, 'no slide on a plain trig');
  near(c.slideTo!.time, T0 + 8 * STEP120, 1e-9, 'wraps to step 1 of the next loop');
  eq(c.slideTo!.locks, { cutoff: 10 });
});

test('lock trigs carry locks without notes or note-offs', () => {
  const r = rig(proj(1, { 0: { 0: {}, 2: { trigless: true, locks: { cutoff: 20 } } } }));
  r.seq.start();
  r.clock.advance(0.5);
  const lock = r.trigs.find(e => e.trigless)!;
  ok(lock && lock.locks.cutoff === 20, 'lock trig emitted');
  eq(r.offs.length, 1, 'only the note trig has an off');
});

// ============================================================================
section('Pattern changes');

function twoPatterns(extra: Partial<Pattern> = {}): Project {
  let p = proj(1, { 0: { 0: { note: 1 }, 4: { note: 1 }, 8: { note: 1 }, 12: { note: 1 } } }, extra);
  for (const s of [0, 2, 4, 6, 8, 10, 12, 14]) p = setStep(p, 'A02', 0, s, { note: 2 });
  if (Object.keys(extra).length) p = updatePatternSettings(p, 'A02', extra);
  return p;
}

test('SEQUENTIAL: the queued pattern starts at the end of the playing one', () => {
  const p = twoPatterns();
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 5 * STEP120);
  r.seq.queuePattern('A02');
  eq(r.seq.getState().queued, 'A02');
  r.clock.advance(16 * STEP120);
  eq(r.patterns.map(x => x.id), ['A01', 'A02']);
  near(r.patterns[1].time, T0 + 16 * STEP120);
  eq(r.trigs.map(e => `${e.note}@${e.step}`).slice(0, 6), ['1@0', '1@4', '1@8', '1@12', '2@0', '2@2']);
  eq(r.seq.getState().queued, null);
});

test('SEQUENTIAL via data: selecting a pattern (project.active) while playing queues it', () => {
  const p = twoPatterns();
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 3 * STEP120);
  r.seq.setProject({ ...p, active: 'A02' });
  r.clock.advance(16 * STEP120);
  eq(r.patterns.map(x => x.id), ['A01', 'A02']);
  near(r.patterns[1].time, T0 + 16 * STEP120);
});

test('SEQUENTIAL honours the master change length (PER TRACK, CHNG 8)', () => {
  const p = twoPatterns({ scaleMode: 'track', master: 16, change: 8 });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 2 * STEP120);
  r.seq.queuePattern('A02');
  r.clock.advance(10 * STEP120);
  near(r.patterns[1].time, T0 + 8 * STEP120);
});

test('DIRECT JUMP: switches now and continues from the same position', () => {
  const p = setChangeMode(twoPatterns(), 'direct-jump');
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 4 * STEP120 + 0.01); // step 4 (and look-ahead) scheduled
  r.seq.queuePattern('A02');
  r.clock.advance(1);
  const first2 = r.trigs.find(e => e.note === 2)!;
  ok(first2.step > 4 && first2.step <= 8, `continues mid-pattern (step ${first2.step})`);
  near(first2.time, T0 + first2.step * STEP120, 1e-9, 'on its grid position');
  ok(r.patterns[1].time < T0 + 8 * STEP120, 'switched before the pattern end');
});

test('DIRECT START: switches now and starts from step 1', () => {
  const p = setChangeMode(twoPatterns(), 'direct-start');
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 5 * STEP120);
  r.seq.queuePattern('A02');
  r.clock.advance(0.3);
  const first2 = r.trigs.find(e => e.note === 2)!;
  eq(first2.step, 0);
  ok(first2.time < T0 + 7 * STEP120, 'immediately');
});

test('TEMP JUMP: plays the new pattern until its end, then returns', () => {
  const p = setChangeMode(twoPatterns(), 'temp-jump');
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 4 * STEP120 + 0.01);
  r.seq.queuePattern('A02');
  r.clock.advance(16 * STEP120);
  eq(r.patterns.map(x => x.id), ['A01', 'A02', 'A01']);
  near(r.patterns[2].time, T0 + 16 * STEP120);
});

test('negative micro on the next pattern\'s step 1 is scheduled before the switch', () => {
  let p = twoPatterns();
  p = setStep(p, 'A02', 0, 0, { note: 2, micro: -12 });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 3 * STEP120);
  r.seq.queuePattern('A02');
  r.clock.advance(16 * STEP120);
  const first2 = r.trigs.find(e => e.note === 2)!;
  near(first2.time, T0 + 16 * STEP120 - STEP120 / 2);
  eq(first2.pattern, 'A02');
  const i = r.trigs.indexOf(first2);
  ok(r.emittedAt[i] <= first2.time, 'emitted ahead');
  eq(r.trigs.filter(e => e.note === 2 && e.step === 0).length, 1, 'only once');
});

test('changing the play mode while playing takes effect at the end of the pattern', () => {
  let p = threePatterns();
  p = setChain(p, ['A02', 'B03']);
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 3 * STEP120);
  r.seq.setProject(setPlayMode(p, 'chain'));
  r.clock.advance(16 * STEP120 + 8 * STEP120);
  eq(r.patterns.map(x => x.id), ['A01', 'A02', 'B03']);
  near(r.patterns[1].time, T0 + 16 * STEP120);
  eq(r.seq.getState().mode, 'chain');
});

test('handleEvent routes the UI kit events', () => {
  const r = rig(twoPatterns());
  ok(r.seq.handleEvent('seq:fill'), 'fill');
  eq(r.seq.getState().fill, true);
  r.seq.handleEvent('seq:fill:up');
  eq(r.seq.getState().fill, false);
  r.seq.handleEvent('seq:fill-latch');
  eq(r.seq.getState().fillLatched, true);
  r.seq.handleEvent('seq:mute', { track: 0 });
  eq(r.seq.getState().mutes, [true]);
  r.seq.handleEvent('seq:queue', { id: 'A02' });
  eq(r.seq.getState().queued, 'A02', 'queued while stopped plays on start');
  r.seq.handleEvent('seq:mute', { track: 0 });
  r.seq.start();
  r.clock.advance(0.2);
  eq(r.patterns[0].id, 'A02');
  ok(!r.seq.handleEvent('something-else'), 'unknown events are not handled');
});

test('DIRECT START waits for the next step, so the new pattern stays on the step grid', () => {
  const p = setChangeMode(twoPatterns(), 'direct-start');
  const tr = new FakeTransport();
  const r = rig(p);
  r.seq.follow(tr);
  tr.start(0);
  tr.run(6 * 5 + 2); // mid-step 5
  r.seq.queuePattern('A02');
  tr.run(20);
  eq(r.patterns.map(x => x.id), ['A01', 'A02']);
  near(r.patterns[1].time, tr.timeOf(36), 1e-9, 'on the step 7 boundary');
  const first2 = r.trigs.find(e => e.note === 2)!;
  eq(first2.step, 0);
  near(first2.time, tr.timeOf(36));
});

test('PER TRACK with master length INF and CHG OFF: a SEQUENTIAL change never happens, DIRECT still does', () => {
  let p = twoPatterns({ scaleMode: 'track', master: 0, change: 0 });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 2 * STEP120);
  r.seq.queuePattern('A02');
  r.clock.advance(64 * STEP120);
  eq(r.patterns.map(x => x.id), ['A01'], 'still the first pattern');
  eq(r.seq.getState().queued, 'A02', 'the cued pattern keeps blinking');
  eq(r.trigs.filter(e => e.note === 1).map(e => e.loop).slice(-1), [4], 'tracks loop on their own');
  p = setChangeMode(p, 'direct-jump');
  r.seq.setProject(p);
  r.seq.queuePattern('A02');
  r.clock.advance(0.3);
  eq(r.patterns.map(x => x.id), ['A01', 'A02']);
});

test('entering PER TRACK keeps playback: master length and change start at the pattern length', () => {
  let p = proj(1, { 0: { 0: {} } }, { length: 32 });
  p = updatePatternSettings(p, 'A01', { scaleMode: 'track' });
  eq([p.patterns.A01.master, p.patterns.A01.change], [32, 32]);
  p = updatePatternSettings(p, 'A01', { scaleMode: 'pattern' });
  p = updatePatternSettings(p, 'A01', { scaleMode: 'track', master: 0 });
  eq([p.patterns.A01.master, p.patterns.A01.change], [0, 32]);
});

test('preview (REC off trig keys): plays a step now with its locks; empty steps play the track default', () => {
  const r = rig(proj(2, { 0: { 3: { note: 67, vel: 50, len: 30, cond: '1:8', locks: { cutoff: 7 } } } }));
  r.clock.advance(1);
  ok(r.seq.handleEvent('seq:preview', { track: 0, step: 3 }), 'handled');
  const e = r.trigs[0];
  eq([e.note, e.velocity, e.locks.cutoff, e.time, e.trigless], [67, 50, 7, 1, false]);
  near(e.duration, 2 * STEP120);
  r.seq.handleEvent('seq:preview:up', { track: 0 });
  eq(r.offs, [{ track: 0, note: 67, time: 1 }]);
  r.seq.handleEvent('seq:preview', { track: 1, step: 9 });
  eq(r.trigs[1].note, 60, 'track default note');
  r.seq.handleEvent('seq:preview:up', { track: 1 });
  r.seq.handleEvent('seq:preview:up', { track: 1 });
  eq(r.offs.length, 2, 'one note-off per preview');
});

test('a lock trig with a condition only applies its locks when the condition passes', () => {
  const p = updatePatternSettings(proj(1, { 0: { 0: { trigless: true, cond: '1:2', locks: { x: 1 } } } }), 'A01', { length: 1 });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 4 * STEP120 - STEP120);
  eq(r.trigs.map(e => `${e.loop}:${e.trigless}`), ['0:true', '2:true']);
});

// ============================================================================
section('Chains and songs');

function threePatterns(): Project {
  let p = createProject({ tracks: 2 });
  p = setStep(p, 'A01', 0, 0, { note: 1 });
  p = setStep(p, 'A02', 0, 0, { note: 2 });
  p = setStep(p, 'B03', 0, 0, { note: 3 });
  p = updatePatternSettings(p, 'A02', { length: 8 });
  return p;
}

test('chain plays its patterns in order and loops', () => {
  let p = threePatterns();
  p = setChain(p, ['A01', 'A02', 'B03']);
  p = setPlayMode(p, 'chain');
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + (16 + 8 + 16 + 16) * STEP120 - STEP120);
  eq(r.patterns.map(x => x.id), ['A01', 'A02', 'B03', 'A01']);
  nearAll(r.patterns.map(x => x.time), [0, 16, 24, 40].map(s => T0 + s * STEP120));
  eq(r.trigs.map(e => e.note), [1, 2, 3, 1]);
});

test('chain: playChain jumps to an entry at the next change', () => {
  let p = threePatterns();
  p = setPlayMode(setChain(p, ['A01', 'A02', 'B03']), 'chain');
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 2 * STEP120);
  r.seq.playChain(2);
  r.clock.advance(16 * STEP120);
  eq(r.patterns.map(x => x.id), ['A01', 'B03']);
  eq(r.seq.getState().chainIndex, 2);
});

test('song: rows with repeats, row length, tempo and mutes, then stop', () => {
  let p = threePatterns();
  p = setStep(p, 'A01', 1, 0, { note: 9 });
  p = songAddRow(p, { pattern: 'A01', repeats: 2, mutes: [1] });
  p = songAddRow(p, { pattern: 'A02', repeats: 1, length: 4 });
  p = songAddRow(p, { pattern: 'B03', repeats: 1, tempo: 60 });
  p = { ...p, song: { ...p.song, loop: false } };
  p = setPlayMode(p, 'song');
  const r = rig(p);
  r.seq.start();
  r.clock.advance(12);
  eq(r.rows.map(x => `${x.row}.${x.repeat}`), ['0.0', '0.1', '1.0', '2.0']);
  nearAll(r.rows.map(x => x.time), [0, 16, 32, 36].map(s => T0 + s * STEP120));
  eq(r.patterns.map(x => x.id), ['A01', 'A02', 'B03']);
  eq(r.trigs.filter(e => e.track === 1).length, 0, 'row mutes silence track 2');
  eq(r.trigs.map(e => e.note), [1, 1, 2, 3]);
  eq(r.tempos.map(x => x.bpm), [60]);
  const end = T0 + 36 * STEP120 + 16 * 0.25;
  eq(r.plays.map(x => x.playing), [true, false], 'stops at the end');
  near(r.plays[1].time, end, 1e-6);
  eq(r.seq.playing, false);
});

test('song: row length shorter than the pattern restarts it on every repeat', () => {
  let p = threePatterns();
  p = setStep(p, 'A01', 0, 2, { note: 5 });
  p = songAddRow(p, { pattern: 'A01', repeats: 3, length: 4 });
  p = setPlayMode(p, 'song');
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 12 * STEP120 - STEP120);
  eq(r.trigs.map(e => `${e.step}`), ['0', '2', '0', '2', '0', '2']);
  eq(r.trigs.map(e => e.loop), [0, 0, 1, 1, 2, 2]);
});

test('song: loop back to loopRow, and play from a row', () => {
  let p = threePatterns();
  p = songAddRow(p, { pattern: 'A01', repeats: 1 });
  p = songAddRow(p, { pattern: 'A02', repeats: 1 });
  p = songAddRow(p, { pattern: 'B03', repeats: 1 });
  p = { ...p, song: { ...p.song, loop: true, loopRow: 1 } };
  p = setPlayMode(p, 'song');
  const r = rig(p);
  r.seq.playSong(1);
  r.seq.start();
  r.clock.advance(T0 + (8 + 16 + 8 + 16) * STEP120 + 0.05);
  eq(r.rows.map(x => x.row), [1, 2, 1, 2, 1]);
});

test('song row transpose shifts the notes of that row only', () => {
  let p = threePatterns();
  p = songAddRow(p, { pattern: 'A02', repeats: 1, transpose: 5 });
  p = songAddRow(p, { pattern: 'A02', repeats: 1 });
  p = setPlayMode(p, 'song');
  eq(p.song.rows[0].transpose, 5);
  eq(songUpdateRow(p, 0, { transpose: 0 }).song.rows[0].transpose, undefined);
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 16 * STEP120 - STEP120);
  eq(r.trigs.map(e => e.note), [7, 2]);
});

test('song rows still advance when a pattern\'s change length is INF', () => {
  let p = threePatterns();
  p = updatePatternSettings(p, 'A02', { scaleMode: 'track', master: 0, change: 0 });
  p = songAddRow(p, { pattern: 'A02', repeats: 2 });
  p = songAddRow(p, { pattern: 'B03', repeats: 1 });
  p = setPlayMode(p, 'song');
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 16 * STEP120 + 0.05);
  eq(r.rows.map(x => `${x.row}.${x.repeat}`), ['0.0', '0.1', '1.0']);
  near(r.rows[2].time, T0 + 16 * STEP120, 1e-9, 'rows fall back to the pattern length');
});

test('song row patch: repeats edited while playing', () => {
  let p = threePatterns();
  p = songAddRow(p, { pattern: 'A01', repeats: 4 });
  p = songAddRow(p, { pattern: 'A02', repeats: 1 });
  p = setPlayMode(p, 'song');
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 20 * STEP120);
  r.seq.setProject(songUpdateRow(p, 0, { repeats: 2 }));
  r.clock.advance(20 * STEP120);
  eq(r.rows.map(x => `${x.row}.${x.repeat}`).slice(0, 3), ['0.0', '0.1', '1.0']);
  near(r.rows[2].time, T0 + 32 * STEP120);
});

// ============================================================================
section('Mutes');

test('pattern track mute and runtime mute', () => {
  let p = proj(2, { 0: { 0: {} }, 1: { 0: {} } }, { length: 1 });
  p = setTrackMute(p, 'A01', 1, true);
  const r = rig(p);
  r.seq.start();
  r.clock.advance(0.15); // loops 0,1 scheduled
  r.seq.setMute(0, true);
  r.clock.advance(2 * STEP120);
  eq(r.trigs.map(e => `${e.track}:${e.loop}`), ['0:0', '0:1']);
  eq(r.seq.getState().mutes, [true, false]);
});

// ============================================================================
section('Follow mode (studio transport)');

test('ticks drive steps: 6 ticks per 16th, times taken from the ticks', () => {
  const tr = new FakeTransport();
  tr.bpm = 100;
  const r = rig(proj(1, { 0: { 0: {}, 1: {}, 5: {} } }));
  r.seq.follow(tr);
  ok(!r.seq.start(), 'internal start ignored while following');
  tr.start(2);
  tr.run(6 * 8);
  nearAll(times(r), [0, 6, 30].map(t => tr.timeOf(t)));
  eq(r.seq.getState().bpm, 100);
});

test('transport swing passes through and pattern swing adds on top', () => {
  const tr = new FakeTransport();
  tr.swing = 0.25;
  const r = rig(proj(1, { 0: { 0: {}, 1: {}, 2: {}, 3: {} } }, { swing: 60 }));
  r.seq.follow(tr);
  tr.start(0);
  tr.run(30);
  const d16 = 6 * tr.dur;
  nearAll(times(r), [0, d16 * (1 + 0.25 + 0.2), d16 * 2, d16 * (3 + 0.25 + 0.2)]);
});

test('stop releases notes; start plays from the top again', () => {
  const tr = new FakeTransport();
  const r = rig(proj(1, { 0: { 0: { len: LEN_INF }, 8: {} } }));
  r.seq.follow(tr);
  tr.start(0);
  tr.run(20);
  tr.stop(tr.timeOf(20));
  eq(r.offs.length, 1);
  eq(r.seq.playing, false);
  tr.start(5);
  tr.run(10);
  eq(r.trigs.map(e => e.step), [0, 0]);
  near(r.trigs[1].time, 5);
  eq(r.plays.map(x => x.playing), [true, false, true]);
});

test('joining a running transport lines the pattern up with tick 0', () => {
  const tr = new FakeTransport();
  const r = rig(proj(1, { 0: { 0: {}, 8: {} } }));
  tr.start(0);
  tr.run(30); // transport already at step 5
  r.seq.follow(tr);
  tr.run(96 - 30 + 1);
  eq(r.trigs.map(e => e.step), [8, 0]);
  nearAll(times(r), [tr.timeOf(48), tr.timeOf(96)]);
});

test('continue from a song position (start fromTick) is aligned too', () => {
  const tr = new FakeTransport();
  const r = rig(proj(1, { 0: { 4: {} } }));
  r.seq.follow(tr);
  tr.start(0, 96 + 12); // bar 2, step 3
  tr.run(20);
  eq(r.trigs.map(e => e.step), [4]);
  near(r.trigs[0].time, tr.timeOf(96 + 24));
});

test('song mode on the transport: rows advance on ticks, row tempo is left to the transport', () => {
  let p = threePatterns();
  p = songAddRow(p, { pattern: 'A02', repeats: 2, tempo: 90 });
  p = songAddRow(p, { pattern: 'B03', repeats: 1 });
  p = setPlayMode(p, 'song');
  const tr = new FakeTransport();
  const r = rig(p);
  r.seq.follow(tr);
  tr.start(0);
  tr.run(96 + 96); // ticks 0..191 (the song loops at 192)
  eq(r.rows.map(x => `${x.row}.${x.repeat}`), ['0.0', '0.1', '1.0']);
  nearAll(r.rows.map(x => x.time), [0, 48, 96].map(t => tr.timeOf(t)));
  eq(r.tempos.length, 0);
});

test('audition: plays on the internal clock while following a stopped transport, then follows again', () => {
  const tr = new FakeTransport();
  const r = rig(proj(1, { 0: { 0: {}, 4: {} } }));
  r.seq.follow(tr);
  ok(r.seq.handleEvent('seq:audition'), 'handled');
  r.clock.advance(0.7);
  eq(r.trigs.map(e => e.step), [0, 4], 'played on the internal clock');
  eq(r.seq.following, false);
  r.seq.handleEvent('seq:audition:stop');
  eq([r.seq.playing, r.seq.following], [false, true]);
  tr.start(5);
  tr.run(3);
  eq(r.trigs.length, 3, 'the transport drives it again');
  const noop = r.seq.audition();
  noop();
  eq(r.seq.playing, true, 'already playing: the audition leaves it alone');
});

/** Song-arranger stand-in: on bar ticks it picks each section's pattern, like lib/studio/arranger.ts */
function arrangerOn(tr: FakeTransport, seq: ElektronSequencer, sections: PatternId[], viaEvent = false) {
  return tr.onTick(t => {
    if (t.tick % 96 !== 0) return;
    const id = sections[t.bar % sections.length];
    if (viaEvent) seq.handleEvent('arranger:pattern', { id, time: t.time });
    else seq.selectPattern(id, t.time);
  });
}

test('selectPattern (arranger): each bar line starts its section\'s pattern from step 1, overriding song mode', () => {
  let p = threePatterns();
  p = songAddRow(p, { pattern: 'A01', repeats: 4 });
  p = setPlayMode(p, 'song');
  const tr = new FakeTransport();
  const r = rig(p);
  arrangerOn(tr, r.seq, ['A02', 'B03', 'A02'], true); // registered first, as at app start
  r.seq.follow(tr);
  tr.start(0);
  tr.run(96 * 3);
  eq(r.patterns.map(x => x.id), ['A02', 'B03', 'A02']);
  nearAll(r.patterns.map(x => x.time), [0, 96, 192].map(t => tr.timeOf(t)));
  // A02 is 8 steps long: it loops inside its bar, then B03 starts on the bar line
  eq(r.trigs.map(e => `${e.note}@${e.step}`), ['2@0', '2@0', '3@0', '2@0', '2@0']);
  nearAll(r.trigs.map(e => e.time), [0, 48, 96, 192, 240].map(t => tr.timeOf(t)));
  eq(r.rows.length, 0, 'the song does not run while arranged');
  const s = r.seq.getState();
  eq([s.arranged, s.mode], [true, 'pattern']);
});

test('selectPattern: a section starting mid-song (play from here) and a stop hand control back', () => {
  const p = setPlayMode(songAddRow(threePatterns(), { pattern: 'A01', repeats: 1 }), 'song');
  const tr = new FakeTransport();
  const r = rig(p);
  const off = arrangerOn(tr, r.seq, ['A01', 'B03']);
  r.seq.follow(tr);
  tr.start(0, 96 * 5); // "play from" bar 6 (a B03 section)
  tr.run(10);
  eq(r.trigs.map(e => e.note), [3], 'the section pattern starts from step 1, not aligned to tick 0');
  near(r.trigs[0].time, tr.timeOf(96 * 5));
  tr.stop();
  off();
  eq(r.seq.getState().arranged, false);
  tr.start(0);
  tr.run(10);
  eq(r.rows.map(x => x.row), [0], 'without the arranger the song plays again');
});

test('selectPattern called late (after its tick was scheduled) stays lined up with the bar', () => {
  let p = threePatterns();
  p = setStep(p, 'B03', 0, 1, { note: 31 });
  const tr = new FakeTransport();
  const r = rig(p);
  r.seq.follow(tr);
  const off = arrangerOn(tr, r.seq, ['A01', 'B03']); // registered after the sequencer: always late
  tr.start(0);
  tr.run(96 + 20);
  off();
  const b = r.trigs.filter(e => e.pattern === 'B03');
  eq(b.map(e => e.step), [1], 'step 1 was lost, step 2 plays on its grid position');
  near(b[0].time, tr.timeOf(96 + 6));
});

test('selectPattern on the internal clock: switches on the tick at the given time; stopped = plays on start', () => {
  const r = rig(threePatterns());
  r.seq.selectPattern('B03');
  r.seq.start();
  r.clock.advance(0.2);
  eq(r.patterns.map(x => x.id), ['B03']);
  eq(r.seq.getState().arranged, true);
  const at = T0 + 4 * STEP120;
  r.seq.selectPattern('A02', at);
  r.clock.advance(1);
  eq(r.patterns.map(x => x.id), ['B03', 'A02']);
  near(r.patterns[1].time, at, 1e-9);
  r.seq.stop();
  r.seq.start();
  r.clock.advance(0.2);
  eq(r.patterns[2].id, 'A01', 'after a stop the project\'s own selection plays');
});

test('works with the real studio Transport class (fake AudioContext, manual pump)', () => {
  const ctx = { currentTime: 10 };
  const transport = new Transport();
  transport.attach(ctx as unknown as BaseAudioContext);
  transport.setBpm(120);
  const realSetInterval = globalThis.setInterval;
  const realClear = globalThis.clearInterval;
  globalThis.setInterval = ((() => 0) as unknown) as typeof setInterval;
  globalThis.clearInterval = ((() => undefined) as unknown) as typeof clearInterval;
  try {
    const r = rig(proj(1, { 0: { 0: {}, 4: {}, 8: {}, 12: {} } }));
    r.seq.follow(transport);
    transport.start();
    const pump = (transport as unknown as { pump(): void }).pump.bind(transport);
    for (let i = 0; i < 120; i++) { ctx.currentTime += 0.02; pump(); }
    transport.stop();
    const t0 = transport.startedAt;
    nearAll(times(r).slice(0, 5), [0, 0.5, 1, 1.5, 2].map(x => t0 + x), 1e-9);
    eq(r.offs.length >= 4, true);
  } finally {
    globalThis.setInterval = realSetInterval;
    globalThis.clearInterval = realClear;
  }
});

// ============================================================================
section('Playhead state');

test('getState reports the audible step, not the scheduled one', () => {
  const r = rig(proj(2, {}));
  r.seq.start();
  r.clock.advance(T0 + 3 * STEP120 + 0.01);
  const s = r.seq.getState();
  eq(s.playing, true);
  eq(s.pattern, 'A01');
  eq(s.steps, [3, 3]);
  ok(s === r.seq.getState(), 'same object while nothing changed');
});

test('subscribers are notified as steps become audible (one timer, coalesced)', () => {
  const r = rig(proj(4, {}));
  const seen: number[] = [];
  r.seq.subscribe(s => { if (s.steps[0] >= 0 && seen[seen.length - 1] !== s.steps[0]) seen.push(s.steps[0]); });
  r.seq.start();
  r.clock.advance(T0 + 6 * STEP120 + 0.001);
  eq(seen.slice(0, 7), [0, 1, 2, 3, 4, 5, 6]);
  r.seq.stop();
  eq(r.seq.getState().steps, [-1, -1, -1, -1]);
  eq(r.seq.getState().playing, false);
});

test('queued pattern shows until the switch is audible', () => {
  const r = rig(twoPatterns());
  r.seq.start();
  r.clock.advance(T0 + 14 * STEP120);
  r.seq.queuePattern('A02');
  r.clock.advance(2 * STEP120 - 0.03); // switch scheduled (look-ahead) but not audible yet
  const s = r.seq.getState();
  eq(s.pattern, 'A01');
  eq(s.queued, 'A02');
  r.clock.advance(0.05);
  eq(r.seq.getState().pattern, 'A02');
  eq(r.seq.getState().queued, null);
});

// ============================================================================
section('Parameter-lock interception');

function fakeApi(project: Project, values: Record<string, ControlValue>, ui: Record<string, unknown> = {}) {
  const api: DeviceUiApi & { project(): Project } = {
    values,
    data: project,
    ui,
    setValue: (id, v) => { api.values = { ...api.values, [id]: v }; },
    updateData: fn => { api.data = fn(api.data); },
    setUi: patch => { api.ui = { ...api.ui, ...patch }; },
    project: () => asProject(api.data, 4),
  };
  return api;
}

const LOCKS: LockOptions = {
  lockKey: id => {
    const m = /^t(\d+)_(.+)$/.exec(id);
    if (!m) return null;
    if (m[2] === 'trig_note') return 'note';
    if (m[2] === 'trig_vel') return 'vel';
    if (m[2] === 'mode') return null;
    return m[2];
  },
  currentTrack: v => Number(v.track) || 0,
  currentPattern: d => asProject(d, 4).active,
  tracks: 4,
};

test('nothing held: the change goes through', () => {
  const api = fakeApi(proj(4, { 0: { 0: {} } }), { track: 0, t1_cutoff: 64 });
  eq(interceptForLocks('t1_cutoff', 30, api, LOCKS), false);
  eq(displayWithLocks(api, LOCKS) === api.values, true);
});

test('held empty step: encoder turn places a lock trig', () => {
  const api = fakeApi(proj(4, { 0: { 0: {} } }), { track: 0, t1_cutoff: 64 }, { heldSteps: [2] });
  eq(interceptForLocks('t1_cutoff', 30, api, LOCKS), true);
  eq(getStep(api.project(), 'A01', 0, 2), { trigless: true, locks: { cutoff: 30 } });
  eq(api.ui.heldEdited, true);
});

test('held note trig: lock added, trig stays a note trig; NOTE writes the trig note', () => {
  const api = fakeApi(proj(4, { 0: { 0: { vel: 90 } } }), { track: 0, t1_cutoff: 64, t1_trig_note: 60 }, { heldSteps: [0] });
  interceptForLocks('t1_cutoff', 12, api, LOCKS);
  interceptForLocks('t1_trig_note', 67, api, LOCKS);
  eq(getStep(api.project(), 'A01', 0, 0), { vel: 90, locks: { cutoff: 12 }, note: 67 });
});

test('range of held steps, held track/pattern from the trig keys win', () => {
  const api = fakeApi(proj(4, {}), { track: 0, t2_decay: 10 }, { heldSteps: [4, 5, 6], heldTrack: 1, heldPattern: 'B02' });
  interceptForLocks('t2_decay', 99, api, LOCKS);
  eq(Object.keys(api.project().patterns.B02.tracks[1].steps), ['4', '5', '6']);
});

test('non-lockable controls and string values pass through', () => {
  const api = fakeApi(proj(4, {}), { track: 0, t1_mode: 1, name: 'x' }, { heldSteps: [0] });
  eq(interceptForLocks('t1_mode', 2, api, LOCKS), false);
  eq(interceptForLocks('t1_name', 'abc', api, LOCKS), false);
});

test('displayWithLocks overlays the held step, clearLock removes it (and the empty lock trig)', () => {
  const api = fakeApi(proj(4, {}), { track: 0, t1_cutoff: 64, t1_res: 10 }, { heldSteps: [3] });
  interceptForLocks('t1_cutoff', 20, api, LOCKS);
  const shown = displayWithLocks(api, LOCKS);
  eq(shown.t1_cutoff, 20);
  eq(shown.t1_res, 10);
  ok(displayWithLocks(api, LOCKS) === shown, 'memoised');
  clearLock(api, LOCKS, 't1_cutoff');
  eq(getStep(api.project(), 'A01', 0, 3), undefined);
});

test('trackDefaults: TRIG page encoders edit the track defaults when nothing is held', () => {
  const opts: LockOptions = { ...LOCKS, trackDefaults: true };
  const api = fakeApi(proj(4, {}), { track: 2, t3_trig_note: 60 });
  eq(interceptForLocks('t3_trig_note', 48, api, opts), true);
  eq(api.project().patterns.A01.tracks[2].note, 48);
  eq(displayWithLocks(api, opts).t3_trig_note, 48);
});

test('TRIG page COND and PROB encoders: condition of the held trig, probability of the track', () => {
  const api = fakeApi(proj(4, { 0: { 0: {} } }), { track: 0, t1_cond: 0, t1_prob: 100, t1_micro: 0 }, { heldSteps: [0] });
  const fiftyPct = TRIG_CONDITIONS.indexOf('50%');
  eq(interceptForLocks('t1_cond', fiftyPct, api, LOCKS), true);
  eq(getStep(api.project(), 'A01', 0, 0), { cond: '50%' });
  eq(displayWithLocks(api, LOCKS).t1_cond, fiftyPct);
  eq(displayWithLocks(api, LOCKS).t1_micro, 0, 'held trig without micro timing shows 0');
  interceptForLocks('t1_cond', 0, api, LOCKS);
  eq(getStep(api.project(), 'A01', 0, 0), {}, 'index 0 removes the condition');
  // A condition alone doesn't make a lock trig on an empty step
  api.setUi({ heldSteps: [5] });
  interceptForLocks('t1_cond', fiftyPct, api, LOCKS);
  eq(getStep(api.project(), 'A01', 0, 5), undefined);
  // PROB is a track setting, held or not
  api.setUi({ heldSteps: [] });
  eq(interceptForLocks('t1_prob', 40, api, LOCKS), true);
  eq(api.project().patterns.A01.tracks[0].prob, 40);
  eq(displayWithLocks(api, LOCKS).t1_prob, 40);
  eq(interceptForLocks('t1_micro', 5, api, LOCKS), false, 'micro with nothing held passes through');
});

test('the scheduler plays the lock for that step only (LockTracker reverts on the next trig)', () => {
  const api = fakeApi(proj(1, { 0: { 0: {}, 1: {}, 2: {} } }), { track: 0, t1_cutoff: 64 }, { heldSteps: [1] });
  interceptForLocks('t1_cutoff', 5, api, LOCKS);
  const r = rig(api.project());
  const applied: string[] = [];
  const lt = new LockTracker(1);
  r.seq.start();
  r.clock.advance(T0 + 3 * STEP120 - 0.01);
  for (const e of r.trigs) lt.apply(e.track, e.locks, (k, v) => applied.push(`${e.step}:${k}=${v}`), k => applied.push(`${e.step}:${k}=base`));
  eq(applied, ['1:cutoff=5', '2:cutoff=base']);
  eq(heldSteps(api.ui), [1]);
});

test('setLock / updateSteps helpers: create rules', () => {
  let p = proj(4, {});
  p = setLock(p, 'A01', 0, [0], 'x', 1, { create: false });
  eq(getStep(p, 'A01', 0, 0), undefined);
  p = updateSteps(p, 'A01', 0, [0, 1], { accent: true }, { create: 'note' });
  eq(trigSteps(p, 'A01', 0), [0, 1]);
  p = setTrackDefault(p, 'A01', 0, 'vel', 300);
  eq(p.patterns.A01.tracks[0].vel, 127);
  p = chainAdd(p, 'H16');
  eq(p.chain, ['H16']);
});

// ============================================================================
section('UI kit (server render)');

function uiCtx(data: unknown, ui: Record<string, unknown> = {}, engine: Record<string, unknown> = {}, values: Record<string, ControlValue> = { track: 0 }): CustomRenderContext {
  return {
    values, engine, data, ui, teaching: false, step: null, instance: 'test',
    setValue: () => undefined, sendEvent: () => undefined, updateData: () => undefined, setUi: () => undefined,
  };
}
const html = <P,>(c: ComponentType<P>, props: P) => renderToStaticMarkup(createElement(c as ComponentType<object>, props as object));

/** A project with every kind of content, and a playing snapshot of it */
function busyProject(): { p: Project; seqState: unknown } {
  let p = proj(4, {
    0: { 0: { cond: '1:4', micro: -3 }, 2: { trigless: true, locks: { cutoff: 3 } }, 5: { retrig: { rate: 12, len: 30, vel: -20 }, accent: true, slide: true } },
    1: { 1: { note: 70, len: 127, locks: { decay: 9 } } },
  }, { length: 32, name: 'BUSY' });
  p = setChain(p, ['A01', 'A02']);
  p = songAddRow(p, { pattern: 'A01', repeats: 2, mutes: [1], tempo: 99, transpose: 3 });
  p = songAddRow(p, { pattern: 'B02', repeats: 1, length: 8 });
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 3 * STEP120 + 0.01);
  return { p, seqState: r.seq.getState() };
}

test('every component renders empty, busy and playing projects (open, in its box)', () => {
  const { p, seqState } = busyProject();
  const cases: [string, CustomRenderContext][] = [
    ['missing data', uiCtx(undefined)],
    ['busy', uiCtx(p)],
    ['playing', uiCtx(p, {}, { seq: seqState, playing: true })],
  ];
  for (const [name, ctx] of cases) {
    const parts = [
      html(TrigKeys, { ctx }), html(TrigKeys, { ctx, mode: 'mute' as const, rows: 2 as const }), html(PagePicker, { ctx }),
      html(PatternPicker, { ctx, open: true }), html(ChainBuilder, { ctx, open: true }), html(SongEditor, { ctx, open: true, transpose: true }),
      html(ScaleMenu, { ctx, open: true }), html(MenuKey, { ctx, menu: 'pattern' as const }),
      html(TrigEditor, { ctx: { ...ctx, ui: { trigEditor: { track: 0, pattern: 'A01', steps: [5] } } } }),
    ];
    parts.forEach((h, i) => ok(h.length > 20, `${name}: component ${i} rendered`));
  }
});

test('TrigKeys: LED states for trigs, lock trigs, playhead, held keys, conditions and pages', () => {
  const { p, seqState } = busyProject();
  const h = html(TrigKeys, { ctx: uiCtx(p, { heldSteps: [5], heldTrack: 0, heldPattern: 'A01' }, { seq: seqState }) });
  ok(h.includes('data-step="0" data-trig="note"'), 'note trig');
  ok(h.includes('data-step="2" data-trig="lock"'), 'lock trig');
  ok(/data-step="3" data-trig="none" data-playhead="1"/.test(h), 'playhead on step 4');
  ok(/data-step="5" data-trig="note" data-held="1"/.test(h), 'held step');
  ok(h.includes('>1:4<'), 'condition label');
  const page2 = html(TrigKeys, { ctx: uiCtx(p, { stepPage: 1 }) });
  ok(page2.includes('data-step="16"') && !page2.includes('data-step="15"'), 'page 2 shows steps 17-32');
  ok(html(TrigKeys, { ctx: uiCtx(p, { stepPage: 3 }) }).includes('data-step="16"'), 'a page beyond the length clamps to the last page');
});

test('overlays render only when open (prop or ui.seqMenu); TrigEditor only with a target', () => {
  const ctx = uiCtx(createProject({ tracks: 4 }));
  eq(html(PatternPicker, { ctx }), '');
  eq(html(SongEditor, { ctx }), '');
  eq(html(TrigEditor, { ctx }), '');
  ok(html(ChainBuilder, { ctx: uiCtx(ctx.data, { seqMenu: 'chain' }) }).includes('CHAIN'), 'ui.seqMenu opens it');
  eq(html(ScaleMenu, { ctx: uiCtx(ctx.data, { seqMenu: 'scale' }), portal: true }), '', 'a portal waits for the client');
});

test('PatternPicker / SongEditor reflect playing, cued and song state', () => {
  const { p } = busyProject();
  const r = rig(p);
  r.seq.start();
  r.clock.advance(T0 + 2 * STEP120);
  r.seq.queuePattern('A02');
  r.clock.advance(0.01);
  const picker = html(PatternPicker, { ctx: uiCtx(p, {}, { seq: r.seq.getState() }), open: true });
  ok(picker.includes('data-pattern="A01" data-state="playing"'), 'playing pattern');
  ok(picker.includes('data-pattern="A02" data-state="queued"') && picker.includes('seq-blink'), 'cued pattern blinks');
  const song = html(SongEditor, { ctx: uiCtx(p), open: true, transpose: true });
  ok(song.includes('×2') && song.includes('>99<') && song.includes('+3') && song.includes('>8<'), 'row values');
  ok(song.includes('aria-label="Unmute T2 in row 1"'), 'row mutes');
});

// ============================================================================
section('Load');

test('12 tracks x 64 steps of retrigs and p-locks for 5 minutes at 180 BPM: fast and steady', () => {
  let p = createProject({ tracks: 12 });
  for (let t = 0; t < 12; t++) {
    for (let s = 0; s < 64; s++) {
      p = setStep(p, 'A01', t, s, { locks: { a: s }, micro: (s % 5) - 2, cond: s % 3 ? '50%' : 'PRE', retrig: s % 8 === 0 ? { rate: 13, len: 14, vel: -40 } : undefined });
    }
  }
  p = updatePatternSettings(p, 'A01', { length: 64, swing: 61 });
  let count = 0;
  const clock = new FakeClock();
  const seq = new ElektronSequencer({ ctx: clock, timers: clock, tracks: 12, seed: 9, bpm: 180, onTrig: () => count++ });
  seq.setProject(p);
  const t = Date.now();
  seq.start();
  clock.advance(300);
  const ms = Date.now() - t;
  ok(count > 20000, `played ${count} hits`);
  ok(ms < 4000, `took ${ms} ms`);
  console.log(`        (${count} hits in ${ms} ms)`);
});

// ============================================================================

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
