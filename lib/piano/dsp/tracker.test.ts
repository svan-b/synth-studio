import { describe, expect, it } from 'vitest';
import { PitchTracker, type Detected } from './tracker';
import { FFT, hann } from './fft';
import { mulberry32 } from '../util/emitter';

const SR = 44100;

/** A simple piano like tone: a decaying, slightly stretched harmonic series. */
function tone(midi: number, seconds: number, amp = 0.3): Float32Array {
  const f0 = 440 * Math.pow(2, (midi - 69) / 12);
  const out = new Float32Array(Math.floor(seconds * SR));
  const b = 2e-4;
  for (let h = 1; h <= 12; h++) {
    const f = h * f0 * Math.sqrt(1 + b * h * h);
    if (f > 9000) break;
    const a = amp / Math.pow(h, 1.1);
    const decay = 1.2 / (1 + 0.25 * h);
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const attack = Math.min(1, t / 0.004);
      out[i] += a * attack * Math.exp(-t / decay) * Math.sin(2 * Math.PI * f * t);
    }
  }
  return out;
}

function place(parts: Array<{ at: number; data: Float32Array }>, seconds: number): Float32Array {
  const out = new Float32Array(Math.floor(seconds * SR));
  for (const p of parts) {
    const start = Math.floor(p.at * SR);
    for (let i = 0; i < p.data.length && start + i < out.length; i++) out[start + i] += p.data[i];
  }
  return out;
}

function run(sig: Float32Array, expected?: number[], rate = SR): Detected[] {
  const tr = new PitchTracker(rate);
  if (expected) tr.expected = new Set(expected);
  const out: Detected[] = [];
  for (let i = 0; i < sig.length; i += 1024) out.push(...tr.process(sig.subarray(i, Math.min(sig.length, i + 1024)), i / rate));
  return out;
}

describe('fft', () => {
  it('finds a sine at the right bin', () => {
    const n = 1024;
    const fft = new FFT(n);
    const w = hann(n);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = Math.sin((2 * Math.PI * 50 * i) / n) * w[i];
    const mag = new Float32Array(n / 2 + 1);
    fft.magnitudes(x, mag);
    let best = 0;
    for (let k = 1; k < mag.length; k++) if (mag[k] > mag[best]) best = k;
    expect(best).toBe(50);
    expect(mag[50]).toBeCloseTo(n / 4, 0);
  });
});

describe('pitch tracker on synthetic tones', () => {
  it('hears single notes with the right pitch and time', () => {
    const notes = [48, 55, 60, 64, 67, 72, 76, 81];
    const sig = place(
      notes.map((m, i) => ({ at: 0.5 + i * 0.7, data: tone(m, 0.6) })),
      0.5 + notes.length * 0.7 + 0.5,
    );
    const got = run(sig);
    expect(got.map((d) => d.midi)).toEqual(notes);
    got.forEach((d, i) => expect(Math.abs(d.time - (0.5 + i * 0.7))).toBeLessThan(0.03));
  });

  it('hears the notes of a chord', () => {
    const sig = place(
      [60, 64, 67].map((m) => ({ at: 0.5, data: tone(m, 0.8) })),
      1.6,
    );
    const got = run(sig)
      .map((d) => d.midi)
      .sort((a, b) => a - b);
    expect(got).toEqual([60, 64, 67]);
  });

  it('confirms expected notes quickly and reports others too', () => {
    const sig = place(
      [
        { at: 0.5, data: tone(48, 0.6) },
        { at: 0.5, data: tone(64, 0.6) },
        { at: 1.3, data: tone(65, 0.6) },
      ],
      2.2,
    );
    const got = run(sig, [48, 64]);
    expect(got.filter((d) => d.assisted).map((d) => d.midi).sort()).toEqual([48, 64]);
    // The F was not expected. It is still heard, and flagged as unassisted.
    expect(got.find((d) => d.midi === 65)?.assisted).toBe(false);
  });

  it('does not credit an expected note an octave away from what was played', () => {
    const sig = place([{ at: 0.5, data: tone(60, 0.6) }], 1.5);
    expect(run(sig, [72]).some((d) => d.midi === 72)).toBe(false);
    expect(run(sig, [48]).some((d) => d.midi === 48)).toBe(false);
    const high = place([{ at: 0.5, data: tone(72, 0.6) }], 1.5);
    expect(run(high, [60]).some((d) => d.midi === 60)).toBe(false);
  });

  it('follows a piano that is tuned flat', () => {
    const flat = Math.pow(2, -22 / 1200);
    const notes = [60, 62, 64, 65, 67, 69];
    const parts = notes.map((m, i) => {
      const base = tone(m, 0.5);
      // Resample to lower the pitch by 22 cents.
      const data = new Float32Array(Math.floor(base.length / flat));
      for (let j = 0; j < data.length; j++) {
        const pos = j * flat;
        const k = Math.floor(pos);
        data[j] = base[k] * (1 - (pos - k)) + (base[k + 1] ?? 0) * (pos - k);
      }
      return { at: 0.5 + i * 0.6, data };
    });
    const got = run(place(parts, 0.5 + notes.length * 0.6 + 0.5));
    expect(got.map((d) => d.midi)).toEqual(notes);
  });

  it('stays quiet for noise and clicks', () => {
    const rnd = mulberry32(9);
    const sig = new Float32Array(SR * 4);
    for (let k = 0; k < 4; k++) {
      const s = Math.floor((0.5 + k * 0.7) * SR);
      for (let i = 0; i < 5000; i++) sig[s + i] += (rnd() * 2 - 1) * 0.3 * Math.exp(-i / 1000);
    }
    sig[Math.floor(3.4 * SR)] = 0.9;
    expect(run(sig)).toHaveLength(0);
  });

  it('works at 48 kHz, the usual rate on an iPad', () => {
    const rate = 48000;
    const f0 = 440 * Math.pow(2, (64 - 69) / 12);
    const sig = new Float32Array(rate * 2);
    for (let h = 1; h <= 8; h++) {
      for (let i = 0; i < rate; i++) {
        const t = i / rate;
        sig[rate / 2 + i] += (0.3 / h) * Math.min(1, t / 0.004) * Math.exp(-t / 0.8) * Math.sin(2 * Math.PI * h * f0 * t);
      }
    }
    expect(run(sig, undefined, rate).map((d) => d.midi)).toEqual([64]);
  });
});
