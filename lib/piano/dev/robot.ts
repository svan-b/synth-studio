/**
 * A robot pianist for development and automated checks. It plays whatever
 * the running session expects, through the same MIDI path a real piano
 * uses, optionally with mistakes. It can also play as sound, into the
 * listening input, the way a microphone would hear a real piano.
 */

import { piano } from '../audio/engine';
import { activeFlow, type FlowSession } from '../engine/flow';
import { listener } from '../input/listen';
import { midi } from '../input/midi';

export interface RobotOptions {
  /** Play a wrong key before every Nth step. 0 for none. */
  wrongEvery?: number;
  /** Milliseconds between steps in wait mode. */
  gapMs?: number;
  /** Shift every note by this many milliseconds in tempo mode. */
  offsetMs?: number;
  /** Skip every Nth note in tempo mode. 0 for none. */
  missEvery?: number;
  /** Key velocity, 1 to 127. */
  velocity?: number;
}

function key(note: number, velocity: number, holdMs = 70): void {
  midi.handleBytes(new Uint8Array([0x90, note, velocity]), performance.now(), 'robot');
  setTimeout(() => midi.handleBytes(new Uint8Array([0x80, note, 0]), performance.now(), 'robot'), holdMs);
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

/** Play the session that is running now. Resolves when it has finished. */
export async function playCurrent(opts: RobotOptions = {}): Promise<string> {
  const found = await waitFor(() => activeFlow.current !== null && activeFlow.current.phase !== 'ready', 6000);
  const session: FlowSession | null = activeFlow.current;
  if (!found || !session) return 'no session';
  const velocity = opts.velocity ?? 80;

  if (session.mode === 'wait') {
    const gap = opts.gapMs ?? 110;
    for (let i = 0; i < session.steps.length; i++) {
      if (session.phase !== 'playing') break;
      if (opts.wrongEvery && (i + 1) % opts.wrongEvery === 0) {
        key(session.steps[i].notes[0].midi + 1, velocity);
        await new Promise((r) => setTimeout(r, gap));
      }
      for (const n of session.steps[i].notes) key(n.midi, velocity);
      await new Promise((r) => setTimeout(r, gap));
    }
  } else {
    await waitFor(() => session.phase !== 'ready', 4000);
    const notes = session.steps.flatMap((s) => s.notes);
    const delay = piano.outputLatency() + session.latencyFor('midi') + (opts.offsetMs ?? 0) / 1000;
    notes.forEach((n, i) => {
      if (opts.missEvery && (i + 1) % opts.missEvery === 0) return;
      const at = session.targetTime(n) + delay;
      setTimeout(() => key(n.midi, velocity), Math.max(0, (at - piano.now()) * 1000));
    });
  }
  await waitFor(() => session.phase === 'done' || session.phase === 'stopped', 120000);
  return session.phase;
}

/** The listening input, for looking inside it from a test. */
export function ears(): typeof listener {
  return listener;
}

export interface SoundOptions {
  /** Shift every note by this many milliseconds in tempo mode. Positive is late. */
  offsetMs?: number;
  /** Random spread of each note's time, in milliseconds either way. */
  jitterMs?: number;
  /** How loudly the microphone hears the app's own sound, the metronome included. 0 for not at all. */
  bleed?: number;
  /** Delay of the microphone path in milliseconds. */
  micDelayMs?: number;
  /** Skip every Nth note in tempo mode. 0 for none. */
  missEvery?: number;
  /** Loudness of the playing, 0 to 1. */
  level?: number;
  /** Milliseconds a person takes between steps in wait mode. */
  gapMs?: number;
}

const SAMPLE_ROOTS = Array.from({ length: 30 }, (_, i) => 21 + i * 3);
const samples = new Map<number, { buffer: AudioBuffer; offset: number }>();

async function sample(root: number): Promise<{ buffer: AudioBuffer; offset: number }> {
  const hit = samples.get(root);
  if (hit) return hit;
  const ctx = piano.ctx!;
  const data = await (await fetch(`/piano/samples/${root}.mp3`)).arrayBuffer();
  const buffer = await ctx.decodeAudioData(data);
  // Skip the silence before the hammer strikes, so notes start when asked.
  const ch = buffer.getChannelData(0);
  const limit = Math.min(ch.length, Math.floor(buffer.sampleRate * 0.25));
  let peak = 0;
  for (let i = 0; i < limit; i++) peak = Math.max(peak, Math.abs(ch[i]));
  let start = 0;
  for (let i = 0; i < limit; i++) {
    if (Math.abs(ch[i]) > peak * 0.02) {
      start = i;
      break;
    }
  }
  const made = { buffer, offset: start / buffer.sampleRate };
  samples.set(root, made);
  return made;
}

let room: { mix: GainNode; inlet: AudioNode } | null = null;

/** Wire up a pretend room: the robot's piano, and the app's own sound, both reaching the microphone. */
function openRoom(bleed: number, micDelay: number): GainNode | null {
  const ctx = piano.ctx;
  const inlet = listener.inlet;
  if (!ctx || !inlet) return null;
  if (room && room.inlet === inlet) return room.mix;
  const mix = ctx.createGain();
  const mic = ctx.createDelay(1);
  mic.delayTime.value = micDelay;
  mix.connect(mic);
  mic.connect(inlet);
  if (bleed > 0 && piano.outlet) {
    // What the iPad plays leaves its speaker a moment after it is scheduled.
    const out = ctx.createDelay(1);
    out.delayTime.value = piano.outputLatency();
    const g = ctx.createGain();
    g.gain.value = bleed;
    piano.outlet.connect(out);
    out.connect(g);
    g.connect(mix);
  }
  room = { mix, inlet };
  return mix;
}

async function sound(mix: GainNode, note: number, when: number, seconds: number, level: number): Promise<void> {
  const ctx = piano.ctx!;
  const root = SAMPLE_ROOTS.reduce((a, b) => (Math.abs(b - note) < Math.abs(a - note) ? b : a));
  const s = await sample(root);
  const src = ctx.createBufferSource();
  src.buffer = s.buffer;
  src.playbackRate.value = Math.pow(2, (note - root) / 12);
  const g = ctx.createGain();
  const t = Math.max(when, ctx.currentTime + 0.005);
  g.gain.setValueAtTime(level, t);
  g.gain.setValueAtTime(level, t + seconds);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.25);
  src.connect(g);
  g.connect(mix);
  src.start(t, s.offset);
  src.stop(t + seconds + 0.3);
}

/**
 * Play the session that is running now as sound, for the listening input.
 * Resolves when the session has finished.
 */
export async function playCurrentAloud(opts: SoundOptions = {}): Promise<string> {
  const found = await waitFor(() => activeFlow.current !== null && activeFlow.current.phase !== 'ready', 6000);
  const session: FlowSession | null = activeFlow.current;
  if (!found || !session) return 'no session';
  const mix = openRoom(opts.bleed ?? 0, (opts.micDelayMs ?? 70) / 1000);
  if (!mix) return 'not listening';
  const level = opts.level ?? 0.5;
  const all = session.steps.flatMap((s) => s.notes);
  await Promise.all(Array.from(new Set(all.map((n) => SAMPLE_ROOTS.reduce((a, b) => (Math.abs(b - n.midi) < Math.abs(a - n.midi) ? b : a))))).map(sample));

  if (session.mode === 'wait') {
    const gap = opts.gapMs ?? 250;
    let reached = 0;
    const off = session.events.subscribe((e) => {
      if (e.type === 'step') reached = e.index;
    });
    for (let i = 0; i < session.steps.length; i++) {
      if (session.phase !== 'playing') break;
      for (const n of session.steps[i].notes) void sound(mix, n.midi, piano.now() + 0.03, 0.4, level);
      await waitFor(() => reached > i || session.phase !== 'playing', 2500);
      await new Promise((r) => setTimeout(r, gap));
    }
    off();
  } else {
    const beat = 60 / session.options.bpm;
    // A person plays to the click they hear, which leaves the speaker a moment after it is scheduled.
    const delay = piano.outputLatency() + (opts.offsetMs ?? 0) / 1000;
    const jitter = (opts.jitterMs ?? 0) / 1000;
    all.forEach((n, i) => {
      if (opts.missEvery && (i + 1) % opts.missEvery === 0) return;
      const at = session.targetTime(n) + delay + (Math.random() * 2 - 1) * jitter;
      void sound(mix, n.midi, at, Math.max(0.12, n.dur * beat * 0.85), level);
    });
  }
  await waitFor(() => session.phase === 'done' || session.phase === 'stopped', 120000);
  return session.phase;
}
