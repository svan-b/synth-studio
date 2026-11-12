/** Radix 2 FFT for real signals, returning magnitudes. Sizes must be powers of two. */
export class FFT {
  readonly n: number;
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;
  private readonly rev: Uint32Array;
  private readonly re: Float32Array;
  private readonly im: Float32Array;

  constructor(n: number) {
    if (n < 2 || (n & (n - 1)) !== 0) throw new Error('FFT size must be a power of two');
    this.n = n;
    this.cos = new Float32Array(n / 2);
    this.sin = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((2 * Math.PI * i) / n);
    }
    this.rev = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.re = new Float32Array(n);
    this.im = new Float32Array(n);
  }

  /**
   * Magnitude spectrum of `input` (length up to n, zero padded beyond).
   * `out` receives n/2 + 1 values.
   */
  magnitudes(input: Float32Array, out: Float32Array): void {
    const { n, re, im, rev, cos, sin } = this;
    const len = Math.min(input.length, n);
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      re[j] = i < len ? input[i] : 0;
      im[j] = 0;
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0, t = 0; k < half; k++, t += step) {
          const a = start + k;
          const b = a + half;
          const wr = cos[t];
          const wi = -sin[t];
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
    const bins = n / 2 + 1;
    for (let k = 0; k < bins; k++) out[k] = Math.hypot(re[k], im[k]);
  }
}

export function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}
