/**
 * A plucked string, made from first principles.
 *
 * This is the extended Karplus-Strong model (Jaffe and Smith, 1983). A burst
 * of noise, shaped like a pluck, goes round a loop as long as one period of
 * the note. Each time round, a gentle low pass filter takes a little off the
 * top, so high harmonics die away first, the way a real string's do. A
 * fraction of a sample of extra delay keeps every note in tune.
 *
 * Everything here is plain arithmetic on arrays, so the same code makes the
 * app's guitar sound and the test recordings the note detector is checked
 * against.
 */

import { midiToFreq } from '../music/theory';
import { mulberry32 } from '../util/emitter';

export interface PluckOptions {
  /** 0 to 1. Louder is also brighter. */
  velocity?: number;
  /** Where the string is plucked, as a share of its length from the bridge. Over the soundhole is about 0.2. */
  position?: number;
  /** Seconds to render. */
  seconds?: number;
  /** Seconds for the fundamental to die away by 60 dB. Defaults to what a steel string acoustic guitar does in that register. */
  decay?: number;
  /** Seed for the pluck's noise, so a note can be made again exactly. */
  seed?: number;
  /** Tuning offset in cents. */
  detune?: number;
}

/** How long a note rings on an acoustic guitar, from long on the bass strings to short at the top. */
export function ringSeconds(midi: number): number {
  return Math.max(1.6, Math.min(7, 7 - (midi - 40) * 0.11));
}

/**
 * Render one plucked note. The result is not normalised: a note's level
 * follows from its velocity, so a strum can be made of several at once.
 */
export function pluck(midi: number, sampleRate: number, opts: PluckOptions = {}): Float32Array {
  const velocity = Math.max(0.05, Math.min(1, opts.velocity ?? 0.7));
  const seconds = opts.seconds ?? Math.min(4, ringSeconds(midi) * 0.7);
  const f0 = midiToFreq(midi) * Math.pow(2, (opts.detune ?? 0) / 1200);
  const length = Math.max(1, Math.round(seconds * sampleRate));
  const out = new Float32Array(length);

  // Loop: a delay of P samples in all, made of an integer delay line, the
  // half sample of the two point average, and a first order allpass for the rest.
  const P = sampleRate / f0;
  const avgDelay = 0.5;
  let L = Math.floor(P - avgDelay - 0.1);
  if (L < 2) L = 2;
  const frac = P - avgDelay - L;
  // Thiran first order allpass for the fractional part, kept in its accurate range.
  const d = Math.max(0.1, Math.min(1.1, frac));
  const apC = (1 - d) / (1 + d);
  const usedL = Math.max(2, Math.round(P - avgDelay - d));

  // Loop gain from the decay time wanted for the fundamental.
  const t60 = opts.decay ?? ringSeconds(midi);
  const hf0 = Math.cos((Math.PI * f0) / sampleRate);
  const rho = Math.min(0.99995, Math.pow(10, -3 / (t60 * f0)) / Math.max(0.5, hf0));

  // The pluck. A string pulled aside at one point and let go starts as a
  // triangle, with its corner where the pick was. That shape gives the
  // harmonics a natural fall in strength, and leaves out those with a node at
  // the pick. A softer touch rounds the corner, which darkens the tone. A
  // little noise gives each pluck its own small character.
  const pos = Math.max(0.05, Math.min(0.5, opts.position ?? 0.2));
  const apex = Math.max(1, Math.round(pos * usedL));
  const rnd = mulberry32(opts.seed ?? midi * 7919 + 17);
  const shaped = new Float32Array(usedL);
  for (let i = 0; i < usedL; i++) {
    const tri = i <= apex ? i / apex : (usedL - i) / (usedL - apex);
    shaped[i] = tri + 0.12 * (rnd() * 2 - 1);
  }
  // Rounding the corner: a gentle low pass, run forwards and back so the shape does not shift.
  const soft = 0.25 + 0.7 * velocity;
  for (let pass = 0; pass < 2; pass++) {
    let lp = shaped[usedL - 1];
    for (let i = 0; i < usedL; i++) {
      lp += soft * (shaped[i] - lp);
      shaped[i] = lp;
    }
    lp = shaped[0];
    for (let i = usedL - 1; i >= 0; i--) {
      lp += soft * (shaped[i] - lp);
      shaped[i] = lp;
    }
  }
  // Remove the average, so the string does not start bent to one side.
  let mean = 0;
  for (let i = 0; i < usedL; i++) mean += shaped[i];
  mean /= usedL;
  for (let i = 0; i < usedL; i++) shaped[i] -= mean;

  const line = new Float32Array(usedL);
  line.set(shaped);
  let idx = 0;
  let prevOut = 0;
  let apX1 = 0;
  let apY1 = 0;
  const amp = 0.5 * (0.35 + 0.65 * velocity);
  for (let n = 0; n < length; n++) {
    const x = line[idx];
    // Two point average, the loop's low pass, and the loop gain.
    const avg = rho * 0.5 * (x + prevOut);
    prevOut = x;
    // Fractional delay.
    const y = apC * avg + apX1 - apC * apY1;
    apX1 = avg;
    apY1 = y;
    line[idx] = y;
    idx = idx + 1 === usedL ? 0 : idx + 1;
    out[n] = x * amp;
  }
  // A short fade at the start keeps the click of the first sample out, and one at the end avoids a cut.
  const fadeIn = Math.min(length, Math.round(0.0015 * sampleRate));
  for (let i = 0; i < fadeIn; i++) out[i] *= i / fadeIn;
  const fadeOut = Math.min(length, Math.round(0.08 * sampleRate));
  for (let i = 0; i < fadeOut; i++) out[length - 1 - i] *= i / fadeOut;
  return out;
}

/** A biquad filter, as Web Audio defines them, for rendering outside a browser. */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  static peaking(sampleRate: number, freq: number, q: number, gainDb: number): Biquad {
    const f = new Biquad();
    const A = Math.pow(10, gainDb / 40);
    const w = (2 * Math.PI * freq) / sampleRate;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha / A;
    f.b0 = (1 + alpha * A) / a0;
    f.b1 = (-2 * Math.cos(w)) / a0;
    f.b2 = (1 - alpha * A) / a0;
    f.a1 = (-2 * Math.cos(w)) / a0;
    f.a2 = (1 - alpha / A) / a0;
    return f;
  }

  static highshelf(sampleRate: number, freq: number, gainDb: number): Biquad {
    const f = new Biquad();
    const A = Math.pow(10, gainDb / 40);
    const w = (2 * Math.PI * freq) / sampleRate;
    const s = Math.sin(w);
    const c = Math.cos(w);
    const alpha = (s / 2) * Math.SQRT2;
    const sq = 2 * Math.sqrt(A) * alpha;
    const a0 = A + 1 - (A - 1) * c + sq;
    f.b0 = (A * (A + 1 + (A - 1) * c + sq)) / a0;
    f.b1 = (-2 * A * (A - 1 + (A + 1) * c)) / a0;
    f.b2 = (A * (A + 1 + (A - 1) * c - sq)) / a0;
    f.a1 = (2 * (A - 1 - (A + 1) * c)) / a0;
    f.a2 = (A + 1 - (A - 1) * c - sq) / a0;
    return f;
  }

  static highpass(sampleRate: number, freq: number, q = Math.SQRT1_2): Biquad {
    const f = new Biquad();
    const w = (2 * Math.PI * freq) / sampleRate;
    const alpha = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    const a0 = 1 + alpha;
    f.b0 = (1 + c) / 2 / a0;
    f.b1 = -(1 + c) / a0;
    f.b2 = (1 + c) / 2 / a0;
    f.a1 = (-2 * c) / a0;
    f.a2 = (1 - alpha) / a0;
    return f;
  }

  process(buf: Float32Array): void {
    for (let i = 0; i < buf.length; i++) {
      const x = buf[i];
      const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
      this.x2 = this.x1;
      this.x1 = x;
      this.y2 = this.y1;
      this.y1 = y;
      buf[i] = y;
    }
  }
}

/**
 * The body of an acoustic guitar, as a handful of resonances: the air in
 * the box near 100 Hz, the top plate near 200 Hz and a broad one near 400
 * Hz, and a softer top end. The app applies the same filters live.
 */
export const BODY: Array<{ type: 'peaking'; freq: number; q: number; gain: number } | { type: 'highshelf'; freq: number; gain: number } | { type: 'highpass'; freq: number; q: number }> = [
  { type: 'highpass', freq: 55, q: 0.7 },
  { type: 'peaking', freq: 102, q: 2.2, gain: 6 },
  { type: 'peaking', freq: 205, q: 2.5, gain: 4 },
  { type: 'peaking', freq: 410, q: 1.4, gain: 2.5 },
  { type: 'peaking', freq: 2600, q: 0.9, gain: 2 },
  { type: 'highshelf', freq: 6000, gain: -7 },
];

export function applyBody(buf: Float32Array, sampleRate: number): void {
  for (const f of BODY) {
    const bq =
      f.type === 'peaking'
        ? Biquad.peaking(sampleRate, f.freq, f.q, f.gain)
        : f.type === 'highshelf'
          ? Biquad.highshelf(sampleRate, f.freq, f.gain)
          : Biquad.highpass(sampleRate, f.freq, f.q);
    bq.process(buf);
  }
}

/** Root mean square level of a stretch, in dB below full scale. */
export function rmsDb(buf: Float32Array, from = 0, to = buf.length): number {
  let sum = 0;
  const a = Math.max(0, from);
  const b = Math.min(buf.length, to);
  for (let i = a; i < b; i++) sum += buf[i] * buf[i];
  return 10 * Math.log10(sum / Math.max(1, b - a) + 1e-12);
}

export function peak(buf: Float32Array): number {
  let p = 0;
  for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i]));
  return p;
}

export interface StrumNote {
  midi: number;
  /** Seconds after the strum begins. */
  offset: number;
  velocity: number;
}

/**
 * When each string of a strum sounds. A pick crossing six strings takes a few
 * hundredths of a second, low to high going down and high to low coming up.
 */
export function strumTiming(midis: number[], dir: 'down' | 'up', velocity = 0.7, spread = 0.012, seed = 1): StrumNote[] {
  const rnd = mulberry32(seed);
  const order = dir === 'down' ? midis.slice().sort((a, b) => a - b) : midis.slice().sort((a, b) => b - a);
  return order.map((midi, i) => ({
    midi,
    offset: i * spread * (0.85 + 0.3 * rnd()),
    // The first strings met are struck a touch harder, and an up strum is lighter.
    velocity: Math.max(0.1, Math.min(1, velocity * (dir === 'up' ? 0.8 : 1) * (1 - i * 0.03) * (0.92 + 0.16 * rnd()))),
  }));
}

/** Render several plucks into one buffer, as a strum or a short phrase. */
export function mix(parts: Array<{ midi: number; at: number; velocity: number; seconds?: number; seed?: number }>, sampleRate: number, total: number): Float32Array {
  const out = new Float32Array(Math.round(total * sampleRate));
  for (const p of parts) {
    const note = pluck(p.midi, sampleRate, { velocity: p.velocity, seconds: p.seconds ?? Math.min(total - p.at, 3), seed: p.seed });
    const start = Math.round(p.at * sampleRate);
    for (let i = 0; i < note.length && start + i < out.length; i++) out[start + i] += note[i];
  }
  return out;
}
