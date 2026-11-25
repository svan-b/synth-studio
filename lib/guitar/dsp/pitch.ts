/**
 * The pitch of one string, for the tuner.
 *
 * This is the YIN method (de Cheveigné and Kawahara, 2002). It looks for the
 * delay at which the sound best matches a copy of itself: that delay is one
 * period of the note. It reads the period directly, so it stays accurate to
 * a fraction of a cent, and it still works when the fundamental itself is
 * faint, as it often is from a low string through a small microphone.
 *
 * Its one known weakness on a guitar is the octave: a bass string with a weak
 * fundamental can look like the note an octave up. So the result is checked
 * for the odd harmonics a note an octave lower would have, and moved down
 * when they are there.
 */

export interface PitchReading {
  /** Frequency in Hz. */
  freq: number;
  /** 0 to 1: how clearly periodic the sound is. Above about 0.85 is a clean note. */
  clarity: number;
  /** Level of the window in dB below full scale. */
  levelDb: number;
}

export interface PitchOptions {
  minHz?: number;
  maxHz?: number;
  /** YIN's threshold. Lower is stricter. */
  threshold?: number;
  /** Look for, and correct, a reading an octave too high. */
  octaveCheck?: boolean;
}

/** Energy of a signal at one frequency, by the Goertzel method. */
export function goertzel(buf: Float32Array, freq: number, sampleRate: number): number {
  const w = (2 * Math.PI * freq) / sampleRate;
  const c = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < buf.length; i++) {
    // A Hann window keeps neighbouring partials from leaking in.
    const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (buf.length - 1));
    const s0 = buf[i] * win + c * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2);
}

export class PitchDetector {
  private diff: Float32Array;
  private cmnd: Float32Array;

  constructor(
    readonly sampleRate: number,
    readonly size: number,
  ) {
    this.diff = new Float32Array(size);
    this.cmnd = new Float32Array(size);
  }

  /** Read the pitch of a window of samples, or null when there is no clear note. */
  detect(buf: Float32Array, opts: PitchOptions = {}): PitchReading | null {
    const rate = this.sampleRate;
    const minHz = opts.minHz ?? 60;
    const maxHz = opts.maxHz ?? 1100;
    const threshold = opts.threshold ?? 0.15;
    const W = Math.floor(buf.length / 2);
    const tauMin = Math.max(2, Math.floor(rate / maxHz));
    const tauMax = Math.min(W - 1, Math.ceil(rate / minHz), this.size - 1);
    if (tauMax <= tauMin + 2) return null;

    let energy = 0;
    for (let i = 0; i < buf.length; i++) energy += buf[i] * buf[i];
    const levelDb = 10 * Math.log10(energy / buf.length + 1e-12);
    if (energy <= 1e-10) return null;

    // Difference function, then its cumulative mean normalised form.
    const d = this.diff;
    const c = this.cmnd;
    d[0] = 0;
    c[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      let sum = 0;
      for (let j = 0; j < W; j++) {
        const delta = buf[j] - buf[j + tau];
        sum += delta * delta;
      }
      d[tau] = sum;
      running += sum;
      c[tau] = running > 0 ? (sum * tau) / running : 1;
    }

    // The first dip below the threshold, followed down to its lowest point.
    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (c[t] < threshold) {
        while (t + 1 <= tauMax && c[t + 1] < c[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) {
      // No dip clears the threshold: take the deepest one, and let clarity say how good it is.
      let best = tauMin;
      for (let t = tauMin; t <= tauMax; t++) if (c[t] < c[best]) best = t;
      tau = best;
    }
    const clarity = Math.max(0, Math.min(1, 1 - c[tau]));
    if (clarity < 0.5) return null;

    // Parabolic interpolation around the dip, for a fraction of a sample.
    let refined = tau;
    if (tau > 1 && tau < tauMax) {
      const a = c[tau - 1];
      const b = c[tau];
      const e = c[tau + 1];
      const denom = a - 2 * b + e;
      if (denom !== 0) refined = tau + Math.max(-0.5, Math.min(0.5, (0.5 * (a - e)) / denom));
    }
    let freq = rate / refined;

    if (opts.octaveCheck !== false && freq / 2 >= minHz) {
      // A note an octave down has odd harmonics at 1.5 and 2.5 times this pitch. This one would have none.
      const at1 = goertzel(buf, freq, rate);
      const odd = goertzel(buf, freq * 1.5, rate) + goertzel(buf, freq * 0.5, rate);
      if (odd > 0.25 * at1) {
        const half = 2 * refined;
        if (half <= tauMax && c[Math.round(half)] < 0.35) freq = rate / half;
      }
    }
    return { freq, clarity, levelDb };
  }
}

/** Median of the last few readings, which keeps a tuner's needle steady. */
export class Smoother {
  private values: number[] = [];

  constructor(private readonly size = 5) {}

  push(v: number): number {
    this.values.push(v);
    if (this.values.length > this.size) this.values.shift();
    const sorted = this.values.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  reset(): void {
    this.values = [];
  }

  get count(): number {
    return this.values.length;
  }
}
