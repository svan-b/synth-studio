import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlowSession, notAttempted, troubleSpots, type FlowEvent, type FlowResult } from './flow';
import { emitNoteOff, emitNoteOn, recentNotes } from '../input/bus';
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
const release = (midi: number) => emitNoteOff(midi, piano.now(), 'touch');

describe('flow, wait mode', () => {
  beforeEach(() => {
    recentNotes.length = 0;
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

  it('takes in notes played a moment before the run began', () => {
    const score = parseScore({ rh: 'E4q D4q C4h' });
    press(67); // something older, not part of this
    vi.advanceTimersByTime(3000);
    press(64);
    vi.advanceTimersByTime(300);
    press(62);
    vi.advanceTimersByTime(300);
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity, catchUp: 2 });
    const { result } = run(s);
    expect(result()).toBeNull();
    press(60);
    expect(result()!.clean).toBe(true);
  });

  it('does not take in early notes heard by the microphone, or any without being asked', () => {
    const score = parseScore({ rh: 'E4q D4q C4h' });
    press(64, 'mic');
    const a = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity, catchUp: 2 });
    const first = run(a);
    press(62);
    expect(first.result()).toBeNull();
    expect(a.phase).toBe('playing');
    a.stop();
    press(64);
    const b = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    run(b);
    press(62);
    press(60);
    expect(b.phase).toBe('playing');
    b.stop();
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

  it('does not count the time taken to find the first note as a hesitation', () => {
    const score = parseScore({ rh: 'E4q D4q C4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: 2000 });
    const { events, result } = run(s);
    vi.advanceTimersByTime(5000); // reading, and finding the hand position
    expect(events.some((e) => e.type === 'hint')).toBe(true);
    press(64);
    vi.advanceTimersByTime(400);
    press(62);
    vi.advanceTimersByTime(400);
    press(60);
    const r = result()!;
    expect(r.hintedSteps).toBe(0);
    expect(r.clean).toBe(true);
    expect(r.detail[0].state).toBe('ok');
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

  it('takes a chord in any position when asked to go by note name', () => {
    const score = parseScore({ rh: 'C4+E4+G4w | F4+A4+C5w' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity, anyOctave: true });
    const { result } = run(s);
    // C major with E at the bottom, an octave down. Then F major spread wide.
    [52, 55, 60].forEach((m) => press(m));
    expect(result()).toBeNull();
    press(62); // D belongs to neither chord
    [41, 60, 69].forEach((m) => press(m));
    const r = result()!;
    expect(r.wrongNotes).toBe(1);
    expect(r.correctNotes).toBe(3);
    // Without the option the same keys are simply wrong.
    const strict = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const second = run(strict);
    [52, 55].forEach((m) => press(m));
    strict.stop();
    expect(second.result()).toBeNull();
    expect(second.events.filter((e) => e.type === 'wrong')).toHaveLength(2);
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

  it('says what became of every note, and which wrong keys were pressed', () => {
    const score = parseScore({ rh: 'E4q D4q C4h | E4q D4q C4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const { result } = run(s);
    press(64);
    press(65); // wrong, where D was wanted
    press(62);
    [60, 64, 62, 60].forEach((m) => press(m));
    const r = result()!;
    expect(r.detail.map((d) => d.state)).toEqual(['ok', 'off', 'ok', 'ok', 'ok', 'ok']);
    expect(r.detail[1]).toMatchObject({ measure: 0, midi: 62, hand: 'R' });
    expect(r.wrong).toEqual([{ measure: 0, midi: 65, expected: [62], hand: 'R' }]);
    expect(r.perMeasure.map((m) => m.played)).toEqual([3, 3]);
    expect(r.cutShort).toBe(false);
  });

  it('takes a pause to think for what it is, and not for a wrong note', () => {
    const score = parseScore({ rh: 'E4q D4q C4h | E4q D4q C4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: 3000 });
    const { events, result } = run(s);
    press(64);
    vi.advanceTimersByTime(400);
    press(62);
    // A long look at the next note. The key is shown, and then the right one is played.
    vi.advanceTimersByTime(3500);
    expect(events.filter((e) => e.type === 'hint')).toHaveLength(1);
    press(60);
    [64, 62, 60].forEach((m) => {
      vi.advanceTimersByTime(400);
      press(m);
    });
    const r = result()!;
    // Every key was right, so nothing is counted as wrong. The pause is counted as a pause.
    expect(r.accuracy).toBe(1);
    expect(r.correctNotes).toBe(6);
    expect(r.wrongNotes).toBe(0);
    expect(r.hintedSteps).toBe(1);
    expect(r.pausedSteps).toBe(1);
    // It is still not a spotless run, and the note that was shown is marked as such.
    expect(r.clean).toBe(false);
    expect(r.detail[2].state).toBe('off');
  });

  it('counts a key shown after wrong tries as shown, and not as a pause', () => {
    const score = parseScore({ rh: 'E4q D4q C4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: 3000 });
    const { result } = run(s);
    press(64);
    press(70);
    press(71); // two wrong tries, and the key is shown
    press(62);
    press(60);
    const r = result()!;
    expect(r.hintedSteps).toBe(1);
    expect(r.pausedSteps).toBe(0);
    expect(r.accuracy).toBeCloseTo(2 / 3, 5);
  });

  it('counts a chord as one step, so one wrong key on it is one slip', () => {
    const score = parseScore({ rh: 'C4+E4+G4h F4+A4+C5h | G4+B4+D5h C4+E4+G4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const { result } = run(s);
    [60, 64, 67].forEach((m) => press(m));
    press(66); // one wrong key on the way to the second chord
    [65, 69, 72, 67, 71, 74, 60, 64, 67].forEach((m) => press(m));
    const r = result()!;
    expect(r.wrongNotes).toBe(1);
    expect(r.accuracy).toBe(0.75);
    expect(r.correctNotes).toBe(9);
  });

  it('says which hand a wrong key belongs to', () => {
    const score = parseScore({ rh: 'E4q F4q G4h', lh: 'C3h G2h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R', 'L'], hintDelayMs: Infinity });
    const { result } = run(s);
    press(65); // near the right hand's E
    press(64);
    press(48);
    press(65);
    press(41); // near the left hand's G, where the right hand has already played
    press(67);
    press(43);
    expect(result()!.wrong.map((w) => w.hand)).toEqual(['R', 'L']);
  });

  it('shows the key at once for the right note in the wrong octave', () => {
    const score = parseScore({ rh: 'E4q D4q C4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const { events, result } = run(s);
    press(64);
    press(74); // D, an octave too high
    const wrong = events.filter((e) => e.type === 'wrong');
    expect(wrong).toEqual([{ type: 'wrong', midi: 74, octave: 'high' }]);
    expect(events.filter((e) => e.type === 'hint')).toHaveLength(1);
    press(62);
    press(48); // C, an octave too low
    expect(events.filter((e) => e.type === 'wrong')[1]).toEqual({ type: 'wrong', midi: 48, octave: 'low' });
    press(60);
    expect(result()!.wrongNotes).toBe(2);
  });

  it('follows a first play through that begins in another octave', () => {
    const score = parseScore({ rh: 'E4q D4q C4h | E4q D4q C4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: 3000, stopAfter: { hints: 2, wrong: 4 }, followOctave: true });
    const { events, result } = run(s);
    [76, 74, 72, 76, 74, 72].forEach((m) => {
      vi.advanceTimersByTime(400);
      press(m);
    });
    const r = result()!;
    expect(r.cutShort).toBe(false);
    expect(r.wrongNotes).toBe(0);
    expect(r.accuracy).toBe(1);
    expect(r.octaveShift).toBe(12);
    // The keys that light are the ones under the learner's hand.
    expect(events.filter((e) => e.type === 'note').map((e) => (e as { midi: number }).midi)).toEqual([76, 74, 72, 76, 74, 72]);
  });

  it('reads no octaves into what a microphone reports', () => {
    const score = parseScore({ rh: 'E4q D4q C4h' });
    // A microphone can hear a note an octave out by itself. That is a wrong note to it, with nothing said about octaves.
    const plain = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const first = run(plain);
    press(64, 'mic');
    vi.advanceTimersByTime(600);
    press(74, 'mic');
    expect(first.events.filter((e) => e.type === 'wrong')).toEqual([{ type: 'wrong', midi: 74 }]);
    expect(first.events.some((e) => e.type === 'hint')).toBe(false);
    plain.stop();
    // And a first play through is not followed to another octave on its word.
    const trial = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity, followOctave: true });
    const second = run(trial);
    press(76, 'mic');
    vi.advanceTimersByTime(600);
    [64, 62, 60].forEach((m) => {
      press(m, 'mic');
      vi.advanceTimersByTime(600);
    });
    expect(second.result()!.octaveShift).toBe(0);
    expect(second.result()!.wrongNotes).toBe(1);
  });

  it('does not follow into another octave unless asked, or when the first key is simply wrong', () => {
    const score = parseScore({ rh: 'E4q D4q C4h' });
    const plain = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const first = run(plain);
    press(76);
    expect(first.events.filter((e) => e.type === 'wrong')).toHaveLength(1);
    plain.stop();
    const asked = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity, followOctave: true });
    const second = run(asked);
    press(65); // not an E at all
    [64, 62, 60].forEach((m) => press(m));
    expect(second.result()!.octaveShift).toBe(0);
    expect(second.result()!.wrongNotes).toBe(1);
  });

  it('does not end a first play through for a pause, or for slips spread through a long piece', () => {
    const bar = 'E4q D4q C4q D4q';
    const score = parseScore({ rh: Array.from({ length: 10 }, () => bar).join(' | ') });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: 3000, stopAfter: { hints: 2, wrong: 4 } });
    const { result } = run(s);
    const keys = [64, 62, 60, 62];
    for (let i = 0; i < 40; i++) {
      // Two long pauses, far apart, each ending in the right key.
      vi.advanceTimersByTime(i === 9 || i === 30 ? 3500 : 300);
      // Five wrong keys, one in every other measure.
      if (i % 8 === 5) press(70);
      press(keys[i % 4]);
    }
    const r = result()!;
    expect(r.cutShort).toBe(false);
    expect(r.wrongNotes).toBe(5);
    expect(r.pausedSteps).toBe(2);
    expect(r.accuracy).toBeCloseTo(35 / 40, 5);
  });

  it('counts a shown first key where the first step is the question', () => {
    const score = parseScore({ rh: 'C4+E4+G4w' });
    const usual = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: 2000 });
    const a = run(usual);
    vi.advanceTimersByTime(2500);
    [60, 64, 67].forEach((m) => press(m));
    expect(a.result()!.hintedSteps).toBe(0);
    const asked = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: 2000, countFirstHint: true });
    const b = run(asked);
    vi.advanceTimersByTime(2500);
    [60, 64, 67].forEach((m) => press(m));
    expect(b.result()!.hintedSteps).toBe(1);
    expect(b.result()!.clean).toBe(false);
  });

  it('ends a first play through early once the learner is plainly stuck', () => {
    const score = parseScore({ rh: 'E4q D4q C4h | E4q D4q C4h | C4q C4q D4q D4q | E4q D4q C4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: 3000, stopAfter: { hints: 2, wrong: 4 } });
    const { result } = run(s);
    // The first measure is known.
    [64, 62, 60].forEach((m) => {
      vi.advanceTimersByTime(400);
      press(m);
    });
    // Then nothing comes: one hint, a note found, and a second hint.
    vi.advanceTimersByTime(3100);
    expect(result()).toBeNull();
    press(64);
    vi.advanceTimersByTime(3100);
    const r = result()!;
    expect(r.cutShort).toBe(true);
    expect(r.clean).toBe(false);
    expect(r.perMeasure.map((m) => m.played)).toEqual([3, 1, 0, 0]);
    expect(r.perMeasure[1].hints).toBe(2);
    expect(r.detail.filter((d) => d.state === 'missed')).toHaveLength(9);
  });

  it('ends it when a key that was shown is still not played', () => {
    const score = parseScore({ rh: 'E4q D4q C4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: 3000, stopAfter: { hints: 2, wrong: 4 } });
    const { result } = run(s);
    // However long the first note takes, the run waits: that is the learner getting ready.
    vi.advanceTimersByTime(20000);
    expect(result()).toBeNull();
    press(64);
    vi.advanceTimersByTime(3100); // the next key is shown
    expect(result()).toBeNull();
    vi.advanceTimersByTime(4100); // and nothing is played
    expect(result()!.cutShort).toBe(true);
    expect(result()!.perMeasure[0].played).toBe(1);
  });

  it('also ends it after a run of wrong keys', () => {
    const score = parseScore({ rh: 'E4q D4q C4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity, hintAfterWrong: 9, stopAfter: { hints: 2, wrong: 3 } });
    const { result } = run(s);
    [70, 71, 72].forEach((m) => press(m));
    expect(result()!.cutShort).toBe(true);
    expect(result()!.wrongNotes).toBe(3);
  });

  it('keeps a take of what was played, wrong keys and all, starting at the first key', () => {
    const score = parseScore({ rh: 'E4q D4q C4h', tempo: 60 });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const { result } = run(s);
    vi.advanceTimersByTime(5000); // a long look before starting
    press(64);
    vi.advanceTimersByTime(300);
    release(64);
    vi.advanceTimersByTime(200);
    press(65); // wrong
    vi.advanceTimersByTime(100);
    release(65);
    vi.advanceTimersByTime(400);
    press(62);
    vi.advanceTimersByTime(500);
    release(62);
    press(60);
    const take = result()!.take!;
    expect(take.bpm).toBe(0);
    expect(take.notes.map((n) => n[0])).toEqual([64, 65, 62, 60]);
    expect(take.notes[0][1]).toBe(0);
    expect(take.notes[0][2]).toBeCloseTo(0.3, 2);
    expect(take.notes[1][1]).toBeCloseTo(0.5, 2);
    expect(take.notes[2][1]).toBeCloseTo(1.0, 2);
    // The last key is still down as the run ends, so it gets its written length: a half note at 60.
    expect(take.notes[3][2]).toBeCloseTo(2, 1);
  });

  it('keeps no take of playing heard through the microphone', () => {
    const score = parseScore({ rh: 'E4h D4h' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const { result } = run(s);
    press(64, 'mic');
    vi.advanceTimersByTime(500);
    press(62, 'mic');
    expect(result()!.take).toBeNull();
    expect(result()!.byEar).toBe(true);
  });

  it('measures how fast a passage was played against its written tempo', () => {
    const score = parseScore({ rh: 'C4q D4q E4q F4q | G4q F4q E4q D4q', tempo: 120 });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R'], hintDelayMs: Infinity });
    const { result } = run(s);
    // One note a second where the music wants two: half speed.
    [60, 62, 64, 65, 67, 65, 64, 62].forEach((m) => {
      vi.advanceTimersByTime(1000);
      press(m);
    });
    expect(result()!.pace).toBeCloseTo(0.5, 2);
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

  it('judges a whole run against one figure for the delay of its own sound', () => {
    const score = parseScore({ rh: 'C4q D4q E4q F4q | G4w', tempo: 120 });
    // The browser says its sound takes 20 ms to be heard when the run starts.
    const delay = vi.spyOn(piano, 'outputLatency').mockReturnValue(0.02);
    const s = new FlowSession(score, { mode: 'tempo', hands: ['R'], bpm: 120 });
    const t0 = performance.now() / 1000;
    const { result } = run(s);
    expect(s.outputDelay).toBe(0.02);
    [60, 62].forEach((m, i) => playAt(s, t0, 120, 4, i, m, 0.02));
    // Part way through it changes its mind. The playing has not changed, and must not seem to.
    delay.mockReturnValue(0.062);
    [64, 65].forEach((m, i) => playAt(s, t0, 120, 4, i + 2, m, 0.02));
    playAt(s, t0, 120, 4, 4, 67, 0.02);
    vi.advanceTimersByTime(4000);
    const r = result()!;
    expect(r.correctNotes).toBe(5);
    const errs = r.detail.map((d) => d.errMs as number);
    expect(Math.max(...errs) - Math.min(...errs)).toBeLessThan(8);
    expect(Math.abs(r.biasMs)).toBeLessThan(8);
    delay.mockRestore();
  });

  it('stops a run that the learner begins to play during the count in', () => {
    const score = parseScore({ rh: 'C4q D4q E4q F4q | G4w', tempo: 60 });
    const s = new FlowSession(score, { mode: 'tempo', hands: ['R'], bpm: 60 });
    const { events, result } = run(s);
    expect(s.phase).toBe('countin');
    // One key in the count in is a stray, as when a hand is being put in place.
    vi.advanceTimersByTime(900);
    press(60);
    expect(s.phase).toBe('countin');
    // Three are someone playing the piece before the music has begun.
    vi.advanceTimersByTime(700);
    press(62);
    vi.advanceTimersByTime(700);
    press(64);
    expect(events.some((e) => e.type === 'false-start')).toBe(true);
    expect(s.phase).toBe('stopped');
    vi.advanceTimersByTime(12000);
    expect(result()).toBeNull();
  });

  it('lets a rhythm be tapped along with the count in', () => {
    const score = parseScore({ rh: 'C4q C4q C4q C4q', tempo: 60 });
    const s = new FlowSession(score, { mode: 'tempo', hands: ['R'], bpm: 60, anyPitch: true });
    const { events } = run(s);
    [900, 1000, 1000].forEach((ms) => {
      vi.advanceTimersByTime(ms);
      press(60);
    });
    expect(events.some((e) => e.type === 'false-start')).toBe(false);
    expect(s.phase).toBe('countin');
    s.stop();
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

  it('records how far each note fell from the beat, and whether long notes were held', () => {
    const score = parseScore({ rh: 'C4h D4h | E4h F4h', tempo: 60 });
    const s = new FlowSession(score, { mode: 'tempo', hands: ['R'], bpm: 60 });
    const t0 = performance.now() / 1000;
    const { result } = run(s);
    // Each half note lasts two seconds. The first two are held, the last two are let go at once.
    playAt(s, t0, 60, 4, 0, 60);
    vi.advanceTimersByTime(1800);
    release(60);
    playAt(s, t0, 60, 4, 2, 62, 0.2);
    vi.advanceTimersByTime(1500);
    release(62);
    playAt(s, t0, 60, 4, 4, 64);
    vi.advanceTimersByTime(300);
    release(64);
    playAt(s, t0, 60, 4, 6, 65);
    vi.advanceTimersByTime(300);
    release(65);
    vi.advanceTimersByTime(4000);
    const r = result()!;
    expect(r.detail.map((d) => d.state)).toEqual(['ok', 'off', 'ok', 'ok']);
    expect(r.detail[1].errMs).toBeGreaterThan(150);
    expect(r.detail[0].held).toBeCloseTo(0.9, 1);
    expect(r.detail[2].held).toBeCloseTo(0.15, 1);
    expect(r.held).toBe(0.5);
    const take = r.take!;
    expect(take.bpm).toBe(60);
    expect(take.notes).toHaveLength(4);
    // The first note sounds on the first beat, which is `lead` seconds into the take.
    expect(take.notes[0][1]).toBeCloseTo(take.lead, 1);
    expect(take.notes[2][1] - take.notes[0][1]).toBeCloseTo(4, 1);
  });

  it('takes a long note still down at the end as held', () => {
    const score = parseScore({ rh: 'C4h D4h | E4w', tempo: 120 });
    const s = new FlowSession(score, { mode: 'tempo', hands: ['R'], bpm: 120 });
    const t0 = performance.now() / 1000;
    const { result } = run(s);
    playAt(s, t0, 120, 4, 0, 60);
    vi.advanceTimersByTime(900);
    release(60);
    playAt(s, t0, 120, 4, 2, 62);
    vi.advanceTimersByTime(900);
    release(62);
    playAt(s, t0, 120, 4, 4, 64);
    vi.advanceTimersByTime(6000);
    const r = result()!;
    expect(r.detail[2].held).toBeGreaterThanOrEqual(1);
    expect(r.held).toBe(1);
  });

  it('does not take a run with nothing in it, or next to nothing, for an attempt', () => {
    const score = parseScore({ rh: 'C4q D4q E4q F4q | G4q F4q E4q D4q | C4q D4q E4q F4q | G4q F4q E4q D4q', tempo: 120 });
    const play = (count: number) => {
      const s = new FlowSession(score, { mode: 'tempo', hands: ['R'], bpm: 120 });
      const t0 = performance.now() / 1000;
      const { result } = run(s);
      [60, 62, 64, 65, 67, 65, 64, 62].slice(0, count).forEach((m, i) => playAt(s, t0, 120, 4, i, m));
      vi.advanceTimersByTime(12000);
      return result()!;
    };
    expect(notAttempted(play(0))).toBe('nothing');
    // Two notes of sixteen, then nothing: the learner began and stopped.
    expect(notAttempted(play(2))).toBe('barely');
    // Half of it is an attempt, whatever its faults.
    expect(notAttempted(play(8))).toBeNull();
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

describe('two hands written on the same key', () => {
  beforeEach(() => {
    recentNotes.length = 0;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('takes one press of the key for both notes when the music waits', () => {
    // Both thumbs share middle C at the start and at the end.
    const score = parseScore({ rh: 'C4q D4q E4q C4q', lh: 'C4q B3q A3q C4q' });
    const s = new FlowSession(score, { mode: 'wait', hands: ['R', 'L'], hintDelayMs: Infinity });
    const { events, result } = run(s);
    press(60);
    expect(events.filter((e) => e.type === 'step')).toHaveLength(2);
    [62, 59, 64, 57].forEach((m) => press(m));
    press(60);
    const r = result()!;
    expect(r.clean).toBe(true);
    expect(r.totalNotes).toBe(8);
    expect(r.detail.every((d) => d.state === 'ok')).toBe(true);
  });

  it('takes one press for both with the beat, and counts every note', () => {
    const score = parseScore({ rh: 'C4q D4q E4q C4q', lh: 'C4q B3q A3q C4q', tempo: 60 });
    const s = new FlowSession(score, { mode: 'tempo', hands: ['R', 'L'], bpm: 60 });
    const t0 = performance.now() / 1000;
    const { result } = run(s);
    const at = (beat: number, midi: number) => {
      const target = t0 + 0.25 + (beat + 4) + 0.045;
      const now = performance.now() / 1000;
      if (target > now) vi.advanceTimersByTime((target - now) * 1000);
      press(midi);
    };
    at(0, 60);
    at(1, 62);
    at(1, 59);
    at(2, 64);
    at(2, 57);
    at(3, 60);
    vi.advanceTimersByTime(4000);
    const r = result()!;
    expect(r.correctNotes).toBe(8);
    expect(r.missedNotes).toBe(0);
    expect(r.wrongNotes).toBe(0);
    expect(r.accuracy).toBe(1);
  });
});
