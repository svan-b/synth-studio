import { describe, expect, it } from 'vitest';
import { FFT } from '../dsp/fft';
import { isStrum } from '../input/bus';
import { APP_PLUCK, BODY, VOICE, applyFilters, pluck, snapFor, strumTiming } from './synth';

const RATE = 44100;
const CHORDS: Record<string, number[]> = { G: [43, 47, 50, 55, 59, 67], C: [48, 52, 55, 60, 64], D: [50, 57, 62, 66], Em: [40, 47, 52, 55, 59, 64], A: [45, 52, 57, 61, 64] };

/** A strummed progression, plucked as the app plucks or as the bare model does, every note at the same level. */
function strummed(app: boolean): Float32Array {
  const eighth = 0.3;
  const pattern = 'D.DU.UDU';
  const out = new Float32Array(Math.round((5 * 8 * eighth + 2) * RATE));
  const notes = new Map<number, Float32Array>();
  let k = 0;
  for (const name of ['G', 'C', 'D', 'Em', 'A'])
    for (let i = 0; i < 8; i++, k++) {
      if (pattern[i] === '.') continue;
      for (const s of strumTiming(CHORDS[name], pattern[i] === 'U' ? 'up' : 'down', 0.75, 0.011, k + 1)) {
        let note = notes.get(s.midi);
        if (!note) {
          note = app ? pluck(s.midi, RATE, { velocity: APP_PLUCK.velocity, position: APP_PLUCK.position, snap: Math.min(1, snapFor(s.midi) + APP_PLUCK.snapLift), seconds: 2.5 }) : pluck(s.midi, RATE, { velocity: 0.75, seconds: 2.5 });
          let e = 0;
          for (let j = 0; j < 8820; j++) e += note[j] * note[j];
          const g = 0.1 / Math.sqrt(e / 8820);
          for (let j = 0; j < note.length; j++) note[j] *= g;
          notes.set(s.midi, note);
        }
        const start = Math.round((0.05 + k * eighth + s.offset) * RATE);
        for (let j = 0; j < note.length && start + j < out.length; j++) out[start + j] += note[j] * s.velocity * Math.exp(-j / (RATE * 0.9));
      }
    }
  applyFilters(out, RATE, BODY);
  if (app) applyFilters(out, RATE, VOICE);
  return out;
}

/** The share of the sound's energy in each band, in decibels. */
function shares(buf: Float32Array, edges: number[]): number[] {
  const n = 8192;
  const fft = new FFT(n);
  const frame = new Float32Array(n);
  const mags = new Float32Array(n / 2);
  const sums = new Float64Array(edges.length - 1);
  let total = 0;
  for (let at = 0; at + n <= buf.length; at += n / 2) {
    for (let i = 0; i < n; i++) frame[i] = buf[at + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
    fft.magnitudes(frame, mags);
    for (let b = 1; b < n / 2; b++) {
      const hz = (b * RATE) / n;
      const power = mags[b] * mags[b];
      total += power;
      for (let e = 0; e < edges.length - 1; e++) if (hz >= edges[e] && hz < edges[e + 1]) sums[e] += power;
    }
  }
  return Array.from(sums, (s) => 10 * Math.log10(s / total + 1e-12));
}

describe("the app's guitar, as the learner hears it", () => {
  // Strummed acoustic guitars in GuitarSet, as a microphone hears them, put these shares of their energy
  // in each band: below 100 Hz -19 dB, 800 to 1600 Hz -16, 1600 to 3200 Hz -18, 3200 to 6400 Hz -23.
  const edges = [0, 100, 800, 1600, 3200, 6400, 22050];

  it('has the presence of a real guitar, which the bare model lacks', () => {
    const [, , mid, high, top] = shares(strummed(true), edges);
    // Within a few decibels of the real thing where the ear hears a pick on a string, and a small speaker does its work.
    expect(mid).toBeGreaterThan(-19);
    expect(mid).toBeLessThan(-9);
    expect(high).toBeGreaterThan(-22);
    expect(high).toBeLessThan(-13);
    expect(top).toBeGreaterThan(-27);
    expect(top).toBeLessThan(-15);
    const [, , bareMid, bareHigh] = shares(strummed(false), edges);
    expect(mid - bareMid).toBeGreaterThan(4);
    expect(high - bareHigh).toBeGreaterThan(7);
  });

  it('does not spend its strength below what a small speaker can give', () => {
    const [lowApp] = shares(strummed(true), edges);
    const [lowBare] = shares(strummed(false), edges);
    expect(lowApp).toBeLessThan(-17);
    expect(lowBare - lowApp).toBeGreaterThan(5);
  });
});

describe('a strum, as against one string or a knock', () => {
  const chroma = (parts: Record<number, number>) => Array.from({ length: 12 }, (_, i) => parts[i] ?? 0);
  it('takes several notes sounding together for a strum', () => {
    expect(isStrum({ time: 0, strength: 0.6, novelty: 0.9, chroma: chroma({ 4: 0.4, 7: 0.3, 11: 0.3 }), source: 'mic' })).toBe(true);
  });
  it('does not take one plucked string for a strum', () => {
    expect(isStrum({ time: 0, strength: 0.6, novelty: 0.9, chroma: chroma({ 4: 0.85, 11: 0.15 }), source: 'mic' })).toBe(false);
  });
  it('does not take a knock or a muted strum for one', () => {
    expect(isStrum({ time: 0, strength: 0.7, novelty: 0.9, chroma: [], source: 'mic' })).toBe(false);
    expect(isStrum({ time: 0, strength: 0.1, novelty: 0.9, chroma: chroma({ 4: 0.4, 7: 0.3, 11: 0.3 }), source: 'mic' })).toBe(false);
  });
});
