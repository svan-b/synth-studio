import { describe, expect, it } from 'vitest';
import { Biquad, applyBody, pluck, rmsDb } from '../audio/synth';
import { OPEN_MIDI, cents, midiToFreq, type StringNo } from '../music/theory';
import { PitchDetector } from './pitch';

const RATE = 24000;

function tone(freq: number, seconds: number, partials: number[] = [1]): Float32Array {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  partials.forEach((amp, h) => {
    for (let i = 0; i < n; i++) out[i] += amp * Math.sin((2 * Math.PI * freq * (h + 1) * i) / RATE);
  });
  return out;
}

/** A stretch of a longer signal, as the tuner reads it. */
function window(buf: Float32Array, at: number, size = 2048): Float32Array {
  const from = Math.round(at * RATE);
  return buf.slice(from, from + size);
}

describe('the tuner pitch estimate', () => {
  const det = new PitchDetector(RATE, 2048);

  it('reads pure tones to within a fraction of a cent', () => {
    for (const f of [73.4, 82.41, 110, 146.83, 196, 246.94, 329.63, 440, 659.25]) {
      const r = det.detect(window(tone(f, 0.3), 0.05));
      expect(r, `${f} Hz`).not.toBeNull();
      expect(Math.abs(cents(r!.freq, f)), `${f} Hz`).toBeLessThan(0.5);
      expect(r!.clarity).toBeGreaterThan(0.95);
    }
  });

  it('is not fooled by a low string whose fundamental is faint', () => {
    // Low E with almost no fundamental and a strong second and third harmonic, as a small microphone hears it.
    const f = 82.41;
    const r = det.detect(window(tone(f, 0.3, [0.05, 1, 0.8, 0.5, 0.3]), 0.05));
    expect(r).not.toBeNull();
    expect(Math.abs(cents(r!.freq, f))).toBeLessThan(2);
  });

  it('hears every open string of the synthesised guitar in tune', () => {
    for (const s of [6, 5, 4, 3, 2, 1] as StringNo[]) {
      const midi = OPEN_MIDI[s];
      const note = pluck(midi, RATE, { seconds: 1.2, velocity: 0.8 });
      applyBody(note, RATE);
      const r = det.detect(window(note, 0.35));
      expect(r, `string ${s}`).not.toBeNull();
      expect(Math.abs(cents(r!.freq, midiToFreq(midi))), `string ${s}`).toBeLessThan(3);
    }
  });

  it('follows a string tuned off pitch', () => {
    const note = pluck(OPEN_MIDI[5], RATE, { seconds: 1, detune: -23 });
    const r = det.detect(window(note, 0.3));
    expect(cents(r!.freq, midiToFreq(OPEN_MIDI[5]))).toBeCloseTo(-23, 0);
  });

  it('says nothing about noise', () => {
    const n = new Float32Array(2048);
    let seed = 7;
    for (let i = 0; i < n.length; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      n[i] = (seed / 2147483648 - 0.5) * 0.2;
    }
    const r = det.detect(n);
    expect(r === null || r.clarity < 0.85).toBe(true);
  });
});

describe('the synthesised string', () => {
  it('rings longer on the bass strings and dies away', () => {
    const low = pluck(40, RATE, { seconds: 3 });
    const high = pluck(64, RATE, { seconds: 3 });
    const fall = (b: Float32Array) => rmsDb(b, 0, RATE * 0.2) - rmsDb(b, RATE * 2.5, RATE * 2.8);
    expect(fall(low)).toBeGreaterThan(5);
    expect(fall(high)).toBeGreaterThan(fall(low));
  });

  it('is brighter when plucked harder', () => {
    const bright = (b: Float32Array) => {
      const hp = b.slice(0, RATE * 0.3);
      Biquad.highpass(RATE, 2000).process(hp);
      return rmsDb(hp) - rmsDb(b, 0, RATE * 0.3);
    };
    expect(bright(pluck(52, RATE, { velocity: 1, seconds: 0.5 }))).toBeGreaterThan(bright(pluck(52, RATE, { velocity: 0.2, seconds: 0.5 })));
  });
});
