/**
 * A robot guitarist for development and automated checks. It plays whatever
 * the running session expects as sound, straight into the listening input,
 * the way a microphone hears a real guitar in the room. It can play late,
 * leave strums out, play the wrong chord, or play out of tune, and the app's
 * own sound can be let into the pretend microphone as well.
 *
 * Loaded only when the address asks for it, with ?osdebug=1.
 */

import { guitar } from '../audio/engine';
import { pluck as renderPluck, strumTiming } from '../audio/synth';
import { activeFollow, type Follower } from '../engine/follow';
import { listener } from '../input/listen';
import { playedStrings, shapeFor, shapeMidis } from '../music/chords';
import type { Step } from '../music/score';
import { OPEN_MIDI, type StringNo } from '../music/theory';

export interface RobotOptions {
  /** Shift every strum by this many milliseconds in tempo mode. Positive is late. */
  offsetMs?: number;
  /** Random spread of each strum's time, in milliseconds either way. */
  jitterMs?: number;
  /** Leave out every Nth step. 0 for none. */
  missEvery?: number;
  /** Play this chord in place of every Nth one, as a slip. */
  wrongChord?: string;
  wrongEvery?: number;
  /** How loudly the microphone hears the app's own sound, the click included. 0 for not at all. */
  bleed?: number;
  /** Delay of the microphone path in milliseconds. */
  micDelayMs?: number;
  /** Loudness of the playing, 0 to 1. */
  level?: number;
  /** Milliseconds a person takes between chords in wait mode. */
  gapMs?: number;
}

function waitFor(test: () => boolean, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      if (test()) resolve(true);
      else if (performance.now() - start > timeoutMs) resolve(false);
      else setTimeout(tick, 25);
    };
    tick();
  });
}

let room: { mix: GainNode; inlet: AudioNode; bleed: GainNode | null } | null = null;

/** Wire up a pretend room: the robot's guitar, and optionally the app's own sound, reaching the microphone. */
function openRoom(bleed: number, micDelay: number): GainNode | null {
  const ctx = guitar.ctx;
  const inlet = listener.inlet;
  if (!ctx || !inlet) return null;
  if (room && room.inlet === inlet) {
    if (room.bleed) room.bleed.gain.value = bleed;
    return room.mix;
  }
  const mix = ctx.createGain();
  const mic = ctx.createDelay(1);
  mic.delayTime.value = micDelay;
  mix.connect(mic);
  mic.connect(inlet);
  let bleedGain: GainNode | null = null;
  if (guitar.outlet) {
    // What the iPad plays leaves its speaker a moment after it is scheduled.
    const out = ctx.createDelay(1);
    out.delayTime.value = guitar.outputLatency();
    bleedGain = ctx.createGain();
    bleedGain.gain.value = bleed;
    guitar.outlet.connect(out);
    out.connect(bleedGain);
    bleedGain.connect(mix);
  }
  room = { mix, inlet, bleed: bleedGain };
  return mix;
}

/** The strings and notes of a chord shape, low string first. */
function chordNotes(chord: string): Array<{ string: StringNo; midi: number }> {
  const shape = shapeFor(chord);
  const strings = playedStrings(shape).slice().sort((a, b) => b - a);
  const midis = shapeMidis(shape).slice().sort((a, b) => a - b);
  return strings.map((s, i) => ({ string: s, midi: midis[i] }));
}

function stepNotes(step: Step, swap: string | null): Array<{ string: StringNo; midi: number }> {
  if (step.strum) {
    if (swap) return chordNotes(swap);
    const strings = step.strum.strings.slice().sort((a, b) => b - a);
    const midis = step.strum.midis.slice().sort((a, b) => a - b);
    return strings.map((s, i) => ({ string: s, midi: midis[i] }));
  }
  return step.notes.filter((n) => !n.tied).map((n) => ({ string: n.place.string, midi: swap ? n.midi + 1 : n.midi }));
}

/** The robot's own strings: a new note on a string stops the one before it, as on a real guitar. */
const voices = new Map<StringNo, GainNode>();

function voice(mix: GainNode, string: StringNo, at: number): GainNode {
  const ctx = guitar.ctx!;
  const old = voices.get(string);
  if (old) {
    old.gain.setTargetAtTime(0, Math.max(ctx.currentTime, at - 0.005), 0.01);
    setTimeout(() => old.disconnect(), Math.max(0, (at - ctx.currentTime) * 1000) + 300);
  }
  const g = ctx.createGain();
  g.connect(mix);
  voices.set(string, g);
  return g;
}

function play(mix: GainNode, step: Step, when: number, level: number, swap: string | null): void {
  const notes = stepNotes(step, swap);
  if (notes.length === 0) return;
  if (step.strum) {
    const dir = step.strum.dir === 'up' ? 'up' : 'down';
    const byMidi = new Map(notes.map((n) => [n.midi, n.string] as const));
    for (const s of strumTiming(notes.map((n) => n.midi), dir, level, 0.011, Math.floor(when * 1000))) {
      const string = byMidi.get(s.midi)!;
      guitar.pluck(s.midi, when + s.offset, { velocity: s.velocity, string, into: voice(mix, string, when + s.offset), seconds: 1.4 });
    }
  } else {
    for (const n of notes) guitar.pluck(n.midi, when, { velocity: level, string: n.string, into: voice(mix, n.string, when), seconds: 1.2 });
  }
}

function session(): Follower | null {
  return activeFollow.current;
}

/** Steps the robot had to play again because the first try was not taken, since the last time this was read. */
const tries: number[] = [];
export function retries(): number[] {
  return tries.splice(0);
}

/**
 * Play the session that is running now. In tempo mode the robot first strums
 * once, which is what starts a timed run, then plays in time with the click.
 * Resolves with how the session ended.
 */
export async function playCurrent(opts: RobotOptions = {}): Promise<string> {
  await guitar.unlock();
  if (!(await waitFor(() => listener.inlet !== null, 6000))) return 'not listening';
  const mix = openRoom(opts.bleed ?? 0, (opts.micDelayMs ?? 60) / 1000);
  if (!mix) return 'not listening';
  const level = opts.level ?? 0.8;

  // A timed run waits for one strum before it counts in.
  let f = session();
  if (!f) {
    await new Promise((r) => setTimeout(r, 600));
    play(mix, { index: 0, start: 0, measure: 0, notes: [], strum: { kind: 'strum', id: 'x', start: 0, dur: 1, measure: 0, chord: 'Em', shape: shapeFor('Em'), dir: 'down', strings: [6, 5, 4, 3, 2, 1], midis: chordNotes('Em').map((n) => n.midi) } }, guitar.now() + 0.05, level, null);
  }
  if (!(await waitFor(() => session() !== null && session()!.phase !== 'ready', 8000))) return 'no session';
  f = session()!;
  const wrongOn = (i: number) => (opts.wrongEvery && opts.wrongChord && (i + 1) % opts.wrongEvery === 0 ? opts.wrongChord : null);

  if (f.mode === 'wait') {
    const gap = opts.gapMs ?? 600;
    let reached = 0;
    const off = f.events.subscribe((e) => {
      if (e.type === 'step') reached = e.index;
    });
    for (let i = 0; i < f.steps.length; i++) {
      if (f.phase !== 'playing') break;
      if (opts.missEvery && (i + 1) % opts.missEvery === 0) {
        await new Promise((r) => setTimeout(r, 5000));
      }
      const swap = wrongOn(i);
      if (swap) {
        play(mix, f.steps[i], guitar.now() + 0.03, level, swap);
        await new Promise((r) => setTimeout(r, gap + 400));
      }
      // Like a person, the robot plays a step again when it was not taken, up to three times.
      for (let attempt = 0; attempt < 3; attempt++) {
        play(mix, f.steps[i], guitar.now() + 0.03, level, null);
        if (await waitFor(() => reached > i || f!.phase !== 'playing', 2500)) break;
        tries.push(i);
      }
      await new Promise((r) => setTimeout(r, gap));
    }
    off();
  } else {
    await waitFor(() => f!.phase === 'playing' || f!.phase === 'countin', 4000);
    // A person plays to the click they hear, which leaves the speaker a moment after it is scheduled.
    const delay = guitar.outputLatency() + (opts.offsetMs ?? 0) / 1000;
    const jitter = (opts.jitterMs ?? 0) / 1000;
    f.steps.forEach((step, i) => {
      if (opts.missEvery && (i + 1) % opts.missEvery === 0) return;
      const at = f!.timeOfStep(i) + delay + (Math.random() * 2 - 1) * jitter;
      // Notes are made a little ahead, so the sound is ready on time.
      setTimeout(() => play(mix, step, at, level, wrongOn(i)), Math.max(0, (at - guitar.now() - 0.25) * 1000));
    });
  }
  await waitFor(() => f!.phase === 'done' || f!.phase === 'stopped', 180000);
  return f.phase;
}

/** Strum a chord once into the microphone, as for a chord check or to start a timed run. */
export async function strum(chord: string, opts: { level?: number; bleed?: number } = {}): Promise<boolean> {
  await guitar.unlock();
  const mix = openRoom(opts.bleed ?? 0, 0.06);
  if (!mix) return false;
  const strings = chordNotes(chord).map((n) => n.string);
  const midis = chordNotes(chord).map((n) => n.midi);
  play(mix, { index: 0, start: 0, measure: 0, notes: [], strum: { kind: 'strum', id: 'x', start: 0, dur: 1, measure: 0, chord, shape: shapeFor(chord), dir: 'down', strings, midis } }, guitar.now() + 0.03, opts.level ?? 0.8, null);
  return true;
}

/** Pluck one note into the microphone. */
export async function note(midi: number, string: StringNo | null = null, level = 0.8): Promise<boolean> {
  await guitar.unlock();
  const mix = openRoom(0, 0.06);
  if (!mix) return false;
  guitar.pluck(midi, guitar.now() + 0.03, { velocity: level, string, into: mix, seconds: 1.5 });
  return true;
}

/** Pluck one open string for a while, out of tune by `cents`, for the tuner. */
export async function ring(string: StringNo, cents: number, seconds = 2.5, level = 0.7): Promise<boolean> {
  await guitar.unlock();
  const ctx = guitar.ctx;
  const mix = openRoom(0, 0.06);
  if (!ctx || !mix) return false;
  const data = renderPluck(OPEN_MIDI[string], ctx.sampleRate, { velocity: 0.8, seconds, decay: seconds * 3, detune: cents, seed: string * 13 });
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = level * 4;
  src.connect(g);
  g.connect(mix);
  src.start(guitar.now() + 0.02);
  return true;
}

/** The listening input and the session now running, for looking inside them from a test. */
export function ears(): { listener: typeof listener; follow: Follower | null } {
  return { listener, follow: session() };
}

// ------------------------------------------------------------------ tracing

const traceLog: Array<Array<string | number>> = [];
let tracing: (() => void) | null = null;

/** Keep a record of what is heard and how each session answers, for reading back from a test. */
export async function trace(on = true): Promise<void> {
  tracing?.();
  tracing = null;
  if (!on) return;
  const { noteBus, strikeBus } = await import('../input/bus');
  const t = () => +guitar.now().toFixed(2);
  let watched: Follower | null = null;
  let offEvents: (() => void) | null = null;
  const timer = setInterval(() => {
    const f = activeFollow.current;
    if (f === watched) return;
    offEvents?.();
    watched = f;
    if (f) {
      traceLog.push([t(), 'session', f.mode, f.steps.length]);
      offEvents = f.events.subscribe((e) => {
        if (e.type === 'pulse') return;
        const row: Array<string | number> = [t(), e.type];
        if ('index' in e) row.push(e.index);
        if (e.type === 'phase') row.push(e.phase);
        if (e.type === 'mark') row.push(e.state);
        if ((e.type === 'note' || e.type === 'wrong') && e.midi !== undefined) row.push(e.midi);
        if (e.type === 'wrong' && e.heard) row.push(e.heard);
        traceLog.push(row);
      });
    }
  }, 50);
  const offN = noteBus.subscribe((e) => traceLog.push([t(), 'heard', e.midi, e.assisted ? 'guided' : '']));
  const offS = strikeBus.subscribe((e) => traceLog.push([t(), 'strike', +e.strength.toFixed(2)]));
  tracing = () => {
    clearInterval(timer);
    offEvents?.();
    offN();
    offS();
  };
}

/** What the trace has recorded since it was last read. */
export function traced(): Array<Array<string | number>> {
  return traceLog.splice(0);
}
