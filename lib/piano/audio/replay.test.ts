import { describe, expect, it } from 'vitest';
import type { Take } from '../engine/flow';
import { playbackSeconds, playbackTimes } from './replay';

const take = (bpm: number, notes: Array<[number, number, number, number]>): Take => ({ bpm, lead: 0.3, notes, pedal: [], seconds: 10 });

describe('playing a take back', () => {
  it('keeps the timing of a take made with a beat exactly', () => {
    const t = take(80, [
      [60, 0.3, 0.5, 0.6],
      [62, 4.3, 0.5, 0.6],
      [64, 4.8, 0.5, 0.6],
    ]);
    expect(playbackTimes(t)).toEqual([0.3, 4.3, 4.8]);
    expect(playbackSeconds(t)).toBeCloseTo(5.3, 5);
  });

  it('shortens long pauses when the music waited, and keeps the rest', () => {
    // A note, a quick second note, then five seconds of searching, then two more.
    const t = take(0, [
      [60, 0, 0.4, 0.6],
      [62, 0.5, 0.4, 0.6],
      [64, 5.5, 0.4, 0.6],
      [65, 6.1, 0.4, 0.6],
    ]);
    const times = playbackTimes(t);
    expect(times[0]).toBe(0);
    expect(times[1]).toBe(0.5);
    expect(times[2]).toBeCloseTo(1.9, 5);
    expect(times[3] - times[2]).toBeCloseTo(0.6, 5);
  });

  it('copes with keys recorded out of order, as when a chord is rolled', () => {
    const t = take(0, [
      [64, 0.02, 0.5, 0.6],
      [60, 0, 0.5, 0.6],
      [67, 0.04, 0.5, 0.6],
    ]);
    expect(playbackTimes(t)).toEqual([0.02, 0, 0.04]);
  });
});
