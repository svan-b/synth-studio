import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlowSession, troubleSpots, type FlowEvent, type FlowResult } from './flow';
import { emitNoteOn } from '../input/bus';
import { parseScore, sliceScore } from '../music/score';
import { piano } from '../audio/engine';

function run(session: FlowSession) {
  const events: FlowEvent[] = [];
  let result: FlowResult | null = null;
  session.events.subscribe((e) => {
    events.push(e);
    if (e.type === 'done') result = e.result;
  });
  session.start();
  return { events, result: () => result };
}

const press = (midi: number, source: 'touch' | 'mic' = 'touch') => emitNoteOn(midi, 0.7, piano.now(), source);

describe('flow, wait mode', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances only on the right notes and reports a clean pass', () => {
    const score = parseScore({ rh: 'E4q D4q C4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const { events, result } = run(s);
    press(64);
    vi.advanceTimersByTime(500);
    press(62);
    vi.advanceTimersByTime(500);
    press(60);
    expect(result()).not.toBeNull();
    expect(result()!.clean).toBe(true);
    expect(result()!.accuracy).toBe(1);
    expect(events.filter((e) => e.type === 'step').map((e) => (e as { index: number }).index)).toEqual([0, 1, 2]);
    expect(s.phase).toBe('done');
  });

  it('counts wrong notes, marks rescued notes, and shows a hint after two misses', () => {
    const score = parseScore({ rh: 'E4q D4q C4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const { events, result } = run(s);
    press(64);
    press(65); // wrong
    press(67); // wrong, hint appears
    expect(events.some((e) => e.type === 'hint')).toBe(true);
    press(62);
    press(60);
    const r = result()!;
    expect(r.wrongNotes).toBe(2);
    expect(r.correctNotes).toBe(2);
    expect(r.clean).toBe(false);
    expect(r.hintedSteps).toBe(1);
    const states = events.filter((e) => e.type === 'note').map((e) => (e as { state: string }).state);
    expect(states).toEqual(['ok', 'warn', 'ok']);
    expect(r.perMeasure[0].errors).toBe(2);
  });

  it('reveals the hint after the delay', () => {
    const score = parseScore({ rh: 'C4w' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: 2000 });
    const { events } = run(s);
    vi.advanceTimersByTime(1900);
    expect(events.some((e) => e.type === 'hint')).toBe(false);
    vi.advanceTimersByTime(200);
    expect(events.some((e) => e.type === 'hint')).toBe(true);
  });

  it('needs every note of a chord and both hands', () => {
    const score = parseScore({ rh: 'E4+G4h C5h', lh: 'C3w' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R', 'L'], hintDelayMs: Infinity });
    const { events, result } = run(s);
    press(64);
    press(64); // repeated chord note is ignored
    press(48);
    expect(events.filter((e) => e.type === 'step')).toHaveLength(1);
    press(67);
    expect(events.filter((e) => e.type === 'step')).toHaveLength(2);
    press(72);
    expect(result()!.clean).toBe(true);
    expect(result()!.totalNotes).toBe(4);
  });

  it('follows one hand only when asked', () => {
    const score = parseScore({ rh: 'E4q E4q F4q G4q', lh: 'C3w' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const { result } = run(s);
    [64, 64, 65, 67].forEach((m) => press(m));
    expect(result()!.totalNotes).toBe(4);
    expect(result()!.clean).toBe(true);
  });

  it('forgives a ringing note reported twice by the microphone', () => {
    const score = parseScore({ rh: 'E4q D4q C4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const { result } = run(s);
    press(64, 'mic');
    vi.advanceTimersByTime(100);
    press(64, 'mic'); // echo of the same strike
    vi.advanceTimersByTime(400);
    press(62, 'mic');
    press(60, 'mic');
    expect(result()!.wrongNotes).toBe(0);
  });

  it('finds hesitations and trouble spots', () => {
    const score = parseScore({ rh: 'C4q D4q E4q F4q | G4q A4q B4q C5q' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const { result } = run(s);
    const notes = [60, 62, 64, 65, 67, 69, 71, 72];
    notes.forEach((m, i) => {
      vi.advanceTimersByTime(i === 5 ? 2500 : 500);
      press(m);
    });
    const r = result()!;
    expect(r.fluency).toBeLessThan(1);
    expect(troubleSpots(r)[0].measure).toBe(1);
  });

  it('reports measures relative to the whole piece for a slice', () => {
    const score = parseScore({ rh: 'C4w | D4w | E4w | F4w' });
    const part = sliceScore(score, 2, 3);
    const s = new FlowSession(part, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const { result } = run(s);
    press(60); // wrong
    press(64);
    press(65);
    expect(result()!.perMeasure.map((m) => m.measure)).toEqual([2, 3]);
    expect(result()!.perMeasure[0].errors).toBe(1);
  });
});

describe('flow, tempo mode', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Advance to a beat position, as the transport sees it. */
  function playAt(session: FlowSession, t0: number, bpm: number, countIn: number, beat: number, midi: number, offset = 0) {
    const target = t0 + 0.25 + ((beat + countIn) * 60) / bpm + offset + 0.045; // touch latency default
    const now = performance.now() / 1000;
    if (target > now) vi.advanceTimersByTime((target - now) * 1000);
    press(midi);
  }

  it('matches notes played in time after a one measure count in', () => {
    const score = parseScore({ rh: 'C4q D4q E4q F4q | G4w', tempo: 120 });
    const s = new FlowSession(score, { mode: 'tempo', hands: ['R'], bpm: 120 });
    const t0 = performance.now() / 1000;
    const { events, result } = run(s);
    expect(s.phase).toBe('countin');
    [60, 62, 64, 65].forEach((m, i) => playAt(s, t0, 120, 4, i, m));
    playAt(s, t0, 120, 4, 4, 67, 0.03);
    vi.advanceTimersByTime(4000);
    const r = result()!;
    expect(r).not.toBeNull();
    expect(r.correctNotes).toBe(5);
    expect(r.missedNotes).toBe(0);
    expect(r.accuracy).toBe(1);
    expect(r.onTime).toBe(1);
    expect(r.meanAbsMs).toBeLessThan(40);
    const pulses = events.filter((e) => e.type === 'pulse') as Array<{ countIn: boolean; number: number; accent: boolean }>;
    expect(pulses.filter((p) => p.countIn).map((p) => p.number)).toEqual([1, 2, 3, 4]);
    expect(pulses[0].accent).toBe(true);
  });

  it('marks missed, late and extra notes', () => {
    const score = parseScore({ rh: 'C4q D4q E4q F4q', tempo: 60 });
    const s = new FlowSession(score, { mode: 'tempo', hands: ['R'], bpm: 60 });
    const t0 = performance.now() / 1000;
    const { result } = run(s);
    playAt(s, t0, 60, 4, 0, 60);
    playAt(s, t0, 60, 4, 1, 62, 0.2); // late but inside the window
    playAt(s, t0, 60, 4, 2, 66); // wrong key
    vi.advanceTimersByTime(4000);
    const r = result()!;
    expect(r.correctNotes).toBe(2);
    expect(r.missedNotes).toBe(2);
    expect(r.wrongNotes).toBe(1);
    expect(r.onTime).toBe(0.5);
    expect(r.biasMs).toBeGreaterThan(50);
    expect(r.clean).toBe(false);
  });

  it('counts in correctly before a pickup', () => {
    const score = parseScore({ rh: 'G4q | C5q C5q D5q | E5h', time: [3, 4], pickup: 1, tempo: 120 });
    const s = new FlowSession(score, { mode: 'tempo', hands: ['R'], bpm: 120 });
    const { events } = run(s);
    vi.advanceTimersByTime(8000);
    const pulses = events.filter((e) => e.type === 'pulse') as Array<{ countIn: boolean; number: number; accent: boolean; beat: number }>;
    // One full measure, then two beats, then the pickup lands on beat three.
    expect(pulses.filter((p) => p.countIn).map((p) => p.number)).toEqual([1, 2, 3, 1, 2]);
    const pickupPulse = pulses.find((p) => Math.abs(p.beat) < 1e-6)!;
    expect(pickupPulse.number).toBe(3);
    expect(pickupPulse.accent).toBe(false);
    const firstBar = pulses.find((p) => Math.abs(p.beat - 1) < 1e-6)!;
    expect(firstBar.accent).toBe(true);
  });
});
