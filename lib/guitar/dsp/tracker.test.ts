/**
 * The listening chain on synthesised guitar: strums and notes made by the
 * app's own string model, with a guitar body, a little room noise, and the
 * metronome. The real test is against recordings (tracker.eval.test.ts).
 * This one keeps the chain from breaking.
 */

import { describe, expect, it } from 'vitest';
import { CLICK_FREQS, CLICK_HZ } from '../audio/click';
import { applyBody, pluck, strumTiming } from '../audio/synth';
import { chordPitchClasses, shapeFor, shapeMidis } from '../music/chords';
import { mulberry32 } from '../util/emitter';
import { judgeChord } from './chordmatch';
import { GuitarTracker, type Detected, type Strike } from './tracker';

const RATE = 44100;

interface Sound {
  at: number;
  midis: number[];
  dir?: 'down' | 'up';
}

function render(sounds: Sound[], seconds: number, opts: { noiseDb?: number; clicks?: number[] } = {}): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (const s of sounds) {
    const timing = s.midis.length > 1 ? strumTiming(s.midis, s.dir ?? 'down', 0.75, 0.012, Math.round(s.at * 100)) : [{ midi: s.midis[0], offset: 0, velocity: 0.75 }];
    for (const t of timing) {
      const note = pluck(t.midi, RATE, { velocity: t.velocity, seconds: Math.min(2.5, seconds - s.at - t.offset), seed: t.midi + Math.round(s.at * 1000) });
      const start = Math.round((s.at + t.offset) * RATE);
      for (let i = 0; i < note.length && start + i < out.length; i++) out[start + i] += note[i] * 0.5;
    }
  }
  applyBody(out, RATE);
  for (const at of opts.clicks ?? []) {
    const start = Math.round(at * RATE);
    for (let i = 0; i < 0.05 * RATE && start + i < out.length; i++) out[start + i] += 0.3 * Math.exp(-i / (0.012 * RATE)) * Math.sin((2 * Math.PI * CLICK_HZ.beat * i) / RATE);
  }
  const rnd = mulberry32(5);
  const noise = Math.pow(10, (opts.noiseDb ?? -50) / 20);
  for (let i = 0; i < out.length; i++) out[i] += (rnd() * 2 - 1) * noise;
  return out;
}

function listen(audio: Float32Array, expected?: (t: number) => number[] | null, clicks = false): { notes: Detected[]; strikes: Strike[] } {
  const tracker = new GuitarTracker(RATE);
  if (clicks) tracker.clicks = CLICK_FREQS;
  const strikes: Strike[] = [];
  tracker.onStrike = (s) => strikes.push(s);
  const notes: Detected[] = [];
  for (let i = 0; i + 1024 <= audio.length; i += 1024) {
    const t = i / RATE;
    if (expected) {
      const e = expected(t);
      tracker.expected = e ? new Set(e) : null;
    }
    notes.push(...tracker.process(audio.subarray(i, i + 1024), t));
  }
  return { notes, strikes };
}

const CHORDS = ['Em', 'G', 'C', 'D', 'A', 'E', 'Am', 'D7', 'A7'];

describe('the listening chain on synthesised guitar', () => {
  it('hears each strum of a chord progression once, on time', () => {
    const seq = ['G', 'C', 'D', 'G', 'Em', 'Am', 'D', 'G'];
    const sounds = seq.map((c, i) => ({ at: 0.5 + i * 0.9, midis: shapeMidis(shapeFor(c)) }));
    const { strikes } = listen(render(sounds, 8.5));
    expect(strikes).toHaveLength(seq.length);
    strikes.forEach((s, i) => expect(Math.abs(s.time - sounds[i].at)).toBeLessThan(0.03));
  });

  it('tells each open chord from the chord before it', () => {
    let right = 0;
    let wrongPassed = 0;
    let n = 0;
    const order = [...CHORDS, ...CHORDS.slice().reverse()];
    const sounds = order.map((c, i) => ({ at: 0.5 + i * 1.1, midis: shapeMidis(shapeFor(c)) }));
    const { strikes } = listen(render(sounds, 0.5 + order.length * 1.1 + 1.5));
    expect(strikes.length).toBe(order.length);
    strikes.forEach((s, i) => {
      if (i === 0) return;
      n++;
      const want = order[i];
      const before = order[i - 1];
      const others = CHORDS.filter((c) => c !== want).map((c) => ({ symbol: c, pcs: chordPitchClasses(c) }));
      if (judgeChord(s.chroma, chordPitchClasses(want), [{ symbol: before, pcs: chordPitchClasses(before) }]).ok) right++;
      // Judged as the chord before it, which is the usual mistake, it should not pass.
      if (judgeChord(s.chroma, chordPitchClasses(before), [{ symbol: want, pcs: chordPitchClasses(want) }, ...others.filter((o) => o.symbol !== before)]).ok) wrongPassed++;
    });
    expect(right / n).toBeGreaterThanOrEqual(0.9);
    expect(wrongPassed / n).toBeLessThanOrEqual(0.1);
  });

  it('does not hear a chord as its seventh', () => {
    const pairs: Array<[string, string]> = [
      ['A', 'A7'],
      ['E', 'E7'],
      ['D', 'D7'],
      ['G', 'G7'],
      ['C', 'C7'],
    ];
    const order = pairs.flatMap(([plain, seventh]) => [plain, seventh]);
    const sounds = order.map((c, i) => ({ at: 0.5 + i * 1.2, midis: shapeMidis(shapeFor(c)) }));
    const { strikes } = listen(render(sounds, 0.5 + order.length * 1.2 + 1.5));
    expect(strikes.length).toBe(order.length);
    pairs.forEach(([plain, seventh], k) => {
      // The plain chord, asked for, with its seventh as the likely mistake, passes.
      expect(judgeChord(strikes[2 * k].chroma, chordPitchClasses(plain), [{ symbol: seventh, pcs: chordPitchClasses(seventh) }]).ok).toBe(true);
      // And the seventh, asked for after the plain chord, passes too.
      expect(judgeChord(strikes[2 * k + 1].chroma, chordPitchClasses(seventh), [{ symbol: plain, pcs: chordPitchClasses(plain) }]).ok).toBe(true);
    });
  });

  it('hears a melody note by note when it knows what comes next', () => {
    const tune = [64, 62, 60, 62, 64, 64, 64, 62, 62, 62, 64, 67, 67];
    const sounds = tune.map((m, i) => ({ at: 0.4 + i * 0.5, midis: [m] }));
    const { notes } = listen(render(sounds, 0.4 + tune.length * 0.5 + 1), (t) => {
      const i = Math.round((t - 0.4) / 0.5);
      return tune.slice(Math.max(0, i - 1), i + 2);
    });
    let hit = 0;
    sounds.forEach((s) => {
      if (notes.some((d) => d.midi === s.midis[0] && Math.abs(d.time - s.at) < 0.06)) hit++;
    });
    expect(hit / tune.length).toBeGreaterThanOrEqual(0.9);
  });

  it('does not take the metronome for a strum', () => {
    const clicks = [0.5, 1.2, 1.9, 2.6, 3.3, 4.0];
    const sounds = [{ at: 1.2, midis: shapeMidis(shapeFor('Em')) }];
    const { strikes } = listen(render(sounds, 5, { clicks }), undefined, true);
    expect(strikes).toHaveLength(1);
    // A strum crosses six strings in about a twentieth of a second. Its time is somewhere in that.
    expect(Math.abs(strikes[0].time - 1.2)).toBeLessThan(0.06);
  });
});
