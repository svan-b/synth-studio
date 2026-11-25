import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guitar } from '../audio/engine';
import { emitNote, emitStrike, recentNotes, recentStrikes } from '../input/bus';
import { chordPitchClasses } from '../music/chords';
import { parseScore } from '../music/score';
import { Follower, hardestChange, notAttempted, type FollowEvent, type FollowResult } from './follow';

function run(f: Follower) {
  const events: FollowEvent[] = [];
  let result: FollowResult | null = null;
  f.events.subscribe((e) => {
    events.push(e);
    if (e.type === 'done') result = e.result;
  });
  f.start();
  return { events, result: () => result };
}

/** A chroma with all its weight on these notes of the scale. */
function chroma(pcs: number[], spill = 0.06): number[] {
  const out = new Array(12).fill(spill / 12);
  for (const pc of pcs) out[pc] += (1 - spill) / pcs.length;
  return out;
}

const of = (chord: string) => chroma(chordPitchClasses(chord));

function note(midi: number, at = guitar.now()) {
  emitNote({ midi, velocity: 0.7, time: at, source: 'mic', assisted: true });
}

function strike(c: number[], at = guitar.now()) {
  emitStrike({ time: at, strength: 0.6, novelty: 0.5, chroma: c, source: 'mic' });
}

beforeEach(() => {
  recentNotes.length = 0;
  recentStrikes.length = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the follower, with the music waiting', () => {
  it('moves on only on the right notes and calls a clean run clean', () => {
    const f = new Follower(parseScore({ line: 'E4q F4q G4h' }), { mode: 'wait', hintDelayMs: Infinity });
    const { events, result } = run(f);
    note(64);
    vi.advanceTimersByTime(400);
    note(65);
    vi.advanceTimersByTime(400);
    note(67);
    expect(result()!.clean).toBe(true);
    expect(result()!.accuracy).toBe(1);
    expect(events.filter((e) => e.type === 'step')).toHaveLength(3);
  });

  it('counts a wrong note, shows help after two tries, and ignores an octave the microphone mistook', () => {
    const f = new Follower(parseScore({ line: 'E4q F4q G4h' }), { mode: 'wait', hintDelayMs: Infinity });
    const { events, result } = run(f);
    note(76); // an octave up: not counted
    expect(events.some((e) => e.type === 'wrong')).toBe(false);
    note(62);
    note(60);
    expect(events.filter((e) => e.type === 'wrong')).toHaveLength(2);
    expect(events.some((e) => e.type === 'hint')).toBe(true);
    note(64);
    note(65);
    note(67);
    expect(result()!.wrongTries).toBe(2);
    expect(result()!.clean).toBe(false);
    expect(result()!.detail[0].state).toBe('off');
  });

  it('says a string did not ring when a pluck brings no note', () => {
    const f = new Follower(parseScore({ line: 'B3q G3q' }), { mode: 'wait', hintDelayMs: Infinity });
    const { events } = run(f);
    strike([], guitar.now());
    vi.advanceTimersByTime(400);
    expect(events.some((e) => e.type === 'unclear')).toBe(true);
    // A pluck whose note was heard is not unclear.
    const before = events.filter((e) => e.type === 'unclear').length;
    const t = guitar.now();
    note(59, t);
    strike(chroma([11]), t);
    vi.advanceTimersByTime(400);
    expect(events.filter((e) => e.type === 'unclear').length).toBe(before);
    f.stop();
  });

  it('takes a strum of the right chord, and names the chord when it was the last one', () => {
    const f = new Follower(parseScore({ chart: 'G | C | G', strum: 'D.D.D.D.' }), { mode: 'wait', hintDelayMs: Infinity });
    const { events, result } = run(f);
    // One strum for each new chord.
    expect(f.steps.map((s) => s.strum!.chord)).toEqual(['G', 'C', 'G']);
    strike(of('G'));
    vi.advanceTimersByTime(1500);
    strike(of('G'));
    const wrong = events.find((e) => e.type === 'wrong') as { heard?: string } | undefined;
    expect(wrong?.heard).toBe('G');
    vi.advanceTimersByTime(800);
    strike(of('C'));
    vi.advanceTimersByTime(900);
    strike(of('G'));
    const r = result()!;
    expect(r.wrongTries).toBe(1);
    expect(r.changes.map((c) => `${c.from}-${c.to}`)).toEqual(['G-C', 'C-G']);
    expect(r.changes[0].seconds).toBeGreaterThan(2);
  });

  it('calls a dead strum unclear, not wrong', () => {
    const f = new Follower(parseScore({ line: '[Em]w' }), { mode: 'wait', hintDelayMs: Infinity });
    const { events, result } = run(f);
    strike([]);
    expect(events.some((e) => e.type === 'unclear')).toBe(true);
    strike(of('Em'));
    expect(result()!.unclearTries).toBe(1);
    expect(result()!.wrongTries).toBe(0);
  });

  it('accepts a strum when the detector named most of the chord, even if its picture was unclear', () => {
    const f = new Follower(parseScore({ line: '[Em]w' }), { mode: 'wait', hintDelayMs: Infinity });
    const { result } = run(f);
    const t = guitar.now();
    note(40, t);
    note(47, t);
    note(55, t);
    strike(chroma([4, 7, 11, 2, 9], 0.3), t);
    expect(result()!.clean).toBe(true);
  });
});

describe('the follower, with a beat', () => {
  function playAll(f: Follower, chords: (i: number) => number[] | null, offset = 0) {
    for (let i = 0; i < f.steps.length; i++) {
      const due = f.timeOfStep(i) + offset;
      vi.advanceTimersByTime(Math.max(0, (due - guitar.now()) * 1000));
      const c = chords(i);
      if (c) strike(c, due);
    }
    vi.advanceTimersByTime(3000);
  }

  it('times every strum and judges the chords', () => {
    const score = parseScore({ chart: 'G | C', strum: 'D.D.D.D.', tempo: 80 });
    const f = new Follower(score, { mode: 'tempo', inputDelay: 0, metronome: false });
    const { result } = run(f);
    playAll(f, (i) => of(f.steps[i].strum!.chord));
    const r = result()!;
    expect(r.accuracy).toBe(1);
    expect(r.onTime).toBe(1);
    expect(r.chordsRight).toBe(1);
    expect(r.changes).toEqual([{ from: 'G', to: 'C', measure: 1, state: 'ok' }]);
  });

  it('finds the change that comes late: still on the old chord at the first strum', () => {
    const score = parseScore({ chart: 'G | C | G | C | G', strum: 'D.D.D.D.', tempo: 90 });
    const f = new Follower(score, { mode: 'tempo', inputDelay: 0, metronome: false });
    const { result } = run(f);
    playAll(f, (i) => {
      const step = f.steps[i];
      const first = i > 0 && f.steps[i - 1].strum!.chord !== step.strum!.chord;
      // Every move to C is late: the first strum of each C measure is still G.
      return first && step.strum!.chord === 'C' ? of('G') : of(step.strum!.chord);
    });
    const r = result()!;
    expect(r.changes.filter((c) => c.to === 'C').every((c) => c.state === 'late')).toBe(true);
    expect(hardestChange(r)).toEqual({ from: 'G', to: 'C', times: 2 });
  });

  it('takes the bass note of a waltz pattern as a strike on its beat, not an extra strum', () => {
    const score = parseScore({ chart: 'A | D', strum: 'B.D.D.', time: [3, 4], tempo: 84 });
    const f = new Follower(score, { mode: 'tempo', inputDelay: 0, metronome: false });
    const { result } = run(f);
    expect(f.steps.some((s) => s.strum === null)).toBe(true);
    playAll(f, (i) => {
      const step = f.steps[i];
      // A plucked bass note is heard as its own note of the scale.
      return step.strum ? of(step.strum.chord) : chroma([step.notes[0].midi % 12]);
    });
    const r = result()!;
    expect(r.extraStrikes).toBe(0);
    expect(r.missedSteps).toBe(0);
    expect(r.accuracy).toBe(1);
  });

  it('counts missed and extra strums, and lateness', () => {
    const score = parseScore({ chart: 'Em | Em', strum: 'D.D.D.D.', tempo: 70 });
    const f = new Follower(score, { mode: 'tempo', inputDelay: 0, metronome: false });
    const { result } = run(f);
    // A sixteenth of a second late is still on the beat at this pace. A sixth of a second is not.
    playAll(f, (i) => (i === 3 ? null : of('Em')), 0.15);
    const r = result()!;
    expect(r.missedSteps).toBe(1);
    expect(r.biasMs).toBeGreaterThan(100);
    expect(r.onTime).toBe(0);
  });

  it('follows single notes with a beat', () => {
    const score = parseScore({ line: 'E4q F4q G4q E4q', tempo: 80 });
    const f = new Follower(score, { mode: 'tempo', inputDelay: 0, metronome: false });
    const { result } = run(f);
    for (let i = 0; i < f.steps.length; i++) {
      const due = f.timeOfStep(i);
      vi.advanceTimersByTime(Math.max(0, (due - guitar.now()) * 1000));
      note(f.steps[i].notes[0].midi, due);
    }
    vi.advanceTimersByTime(2500);
    expect(result()!.accuracy).toBe(1);
  });

  it('does not judge a run where nothing was played', () => {
    const score = parseScore({ chart: 'G | G', strum: 'D.D.D.D.', tempo: 100 });
    const f = new Follower(score, { mode: 'tempo', inputDelay: 0, metronome: false });
    const { result } = run(f);
    vi.advanceTimersByTime(10000);
    expect(notAttempted(result()!)).toBe('nothing');
  });
});
