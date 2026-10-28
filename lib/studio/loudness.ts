// ============================================================================
// Offline loudness tools for bounces: a streaming BS.1770-4 meter (integrated
// loudness with gating, true peak) and the same true-peak look-ahead limiter
// the live master runs (public/worklets/studio-processors.js, 'master-bus'),
// used to normalise a bounce to -14 LUFS / -1 dBTP.
// ============================================================================

const TP_FIR = [
  [0.0017089843750, 0.0109863281250, -0.0196533203125, 0.0332031250000, -0.0594482421875, 0.1373291015625, 0.9721679687500, -0.1022949218750, 0.0476074218750, -0.0266113281250, 0.0148925781250, -0.0083007812500],
  [-0.0291748046875, 0.0292968750000, -0.0517578125000, 0.0891113281250, -0.1665039062500, 0.4650878906250, 0.7797851562500, -0.2003173828125, 0.1015625000000, -0.0582275390625, 0.0330810546875, -0.0189208984375],
  [-0.0189208984375, 0.0330810546875, -0.0582275390625, 0.1015625000000, -0.2003173828125, 0.7797851562500, 0.4650878906250, -0.1665039062500, 0.0891113281250, -0.0517578125000, 0.0292968750000, -0.0291748046875],
  [-0.0083007812500, 0.0148925781250, -0.0266113281250, 0.0476074218750, -0.1022949218750, 0.9721679687500, 0.1373291015625, -0.0594482421875, 0.0332031250000, -0.0196533203125, 0.0109863281250, 0.0017089843750],
].map(p => Float64Array.from(p));
const TP_BOUND = Math.max(...TP_FIR.map(p => p.reduce((s, h) => s + Math.abs(h), 0)));

function tpAt(ring: Float64Array, w: number, mask: number): number {
  const [h0, h1, h2, h3] = TP_FIR;
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
  for (let k = 0; k < 12; k++) {
    const x = ring[(w - k) & mask];
    s0 += h0[k] * x; s1 += h1[k] * x; s2 += h2[k] * x; s3 += h3[k] * x;
  }
  return Math.max(Math.abs(s0), Math.abs(s1), Math.abs(s2), Math.abs(s3));
}

function kWeighting(fs: number): [number[], number[]] {
  let f0 = 1681.974450955533, Q = 0.7071752369554196;
  const G = 3.999843853973347;
  let K = Math.tan(Math.PI * f0 / fs);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const s1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / fs);
  a0 = 1 + K / Q + K * K;
  const s2 = [1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  return [s1, s2];
}

const lufs = (z: number) => (z > 0 ? -0.691 + 10 * Math.log10(z) : -Infinity);

/** Streaming BS.1770-4 meter: integrated loudness (gated), max momentary / short-term, true peak */
export class LoudnessMeter {
  private k1: number[];
  private k2: number[];
  private st = new Float64Array(8);
  private blockLen: number;
  private pos = 0;
  private acc = 0;
  private blocks: number[] = [];
  private ring = [new Float64Array(16), new Float64Array(16)];
  private w = 0;
  private hot = [0, 0];
  peak = 0;
  truePeak = 0;

  constructor(readonly sampleRate: number) {
    [this.k1, this.k2] = kWeighting(sampleRate);
    this.blockLen = Math.round(0.1 * sampleRate);
  }

  push(l: Float32Array, r: Float32Array) {
    const [p0, p1, p2, p3, p4] = this.k1, [q0, q1, q2, q3, q4] = this.k2, s = this.st;
    const [rl, rr] = this.ring;
    let w = this.w, acc = this.acc, pos = this.pos, peak = this.peak, tp = this.truePeak;
    for (let i = 0; i < l.length; i++) {
      for (let c = 0; c < 2; c++) {
        const x = c === 0 ? l[i] : r[i];
        const o = c * 4;
        const y = p0 * x + s[o]; s[o] = p1 * x - p3 * y + s[o + 1]; s[o + 1] = p2 * x - p4 * y;
        const z = q0 * y + s[o + 2]; s[o + 2] = q1 * y - q3 * z + s[o + 3]; s[o + 3] = q2 * y - q4 * z;
        acc += z * z;
        const a = Math.abs(x);
        if (a > peak) peak = a;
        const ring = c === 0 ? rl : rr;
        ring[w] = x;
        // exact over the whole file: a sample this big may have an interpolated value
        // above tp in any of the 12 windows that contain it
        if (a * TP_BOUND > tp) this.hot[c] = 12;
        if (this.hot[c] > 0) {
          this.hot[c]--;
          const v = tpAt(ring, w, 15);
          if (v > tp) tp = v;
        }
        if (a > tp) tp = a;
      }
      w = (w + 1) & 15;
      if (++pos === this.blockLen) {
        this.blocks.push(acc / this.blockLen);
        acc = 0;
        pos = 0;
      }
    }
    this.w = w; this.acc = acc; this.pos = pos; this.peak = peak; this.truePeak = tp;
  }

  /** Integrated loudness, LUFS (-Infinity for silence) */
  integrated(): number {
    const b = this.blocks;
    const gates: number[] = [];
    for (let i = 3; i < b.length; i++) gates.push((b[i] + b[i - 1] + b[i - 2] + b[i - 3]) / 4);
    const abs = gates.filter(z => lufs(z) > -70);
    if (!abs.length) return -Infinity;
    const rel = lufs(abs.reduce((a, z) => a + z, 0) / abs.length) - 10;
    const g = abs.filter(z => lufs(z) > rel);
    return g.length ? lufs(g.reduce((a, z) => a + z, 0) / g.length) : -Infinity;
  }

  maxShortTerm(): number {
    const b = this.blocks;
    let m = -Infinity;
    for (let i = 29; i < b.length; i++) {
      let s = 0;
      for (let k = 0; k < 30; k++) s += b[i - k];
      m = Math.max(m, lufs(s / 30));
    }
    return m;
  }
}

/** The master's true-peak limiter (same algorithm and constants as the worklet), streaming */
export class TruePeakLimiter {
  readonly latency: number;
  private A: number;
  private W: number;
  private mask: number;
  private dl: Float64Array;
  private dr: Float64Array;
  private w = 0;
  private n = 0;
  private hotL = 0;
  private hotR = 0;
  private dqv: Float64Array;
  private dqi: Float64Array;
  private dqm: number;
  private head = 0;
  private tail = 0;
  private box: Float64Array;
  private bp = 0;
  private sum: number;
  private env = 1;
  private ones: number;
  private thr: number;
  private relCoef: number;
  grMax = 0;

  constructor(sampleRate: number, ceilingDb = -1, release = 0.06, lookahead = 0.0015) {
    this.latency = Math.max(16, Math.round(lookahead * sampleRate));
    this.A = this.latency - 5;
    this.W = this.A + 1;
    let size = 1;
    while (size < this.latency + 16) size <<= 1;
    this.mask = size - 1;
    this.dl = new Float64Array(size);
    this.dr = new Float64Array(size);
    let dq = 1;
    while (dq < this.W + 4) dq <<= 1;
    this.dqm = dq - 1;
    this.dqv = new Float64Array(dq);
    this.dqi = new Float64Array(dq);
    this.box = new Float64Array(this.A).fill(1);
    this.sum = this.A;
    this.ones = this.W;
    this.thr = Math.pow(10, (ceilingDb - 0.02) / 20);
    this.relCoef = Math.exp(-1 / (release * sampleRate));
  }

  /** Process in -> out (same length); the output lags by `latency` samples */
  process(L: Float32Array, R: Float32Array, oL: Float32Array, oR: Float32Array, gain = 1) {
    const { dl, dr, mask, A, W, thr, dqv, dqi, dqm, box, relCoef } = this;
    const tpThr = thr / TP_BOUND;
    const LT = this.latency;
    let { w, n, hotL, hotR, head, tail, bp, sum, env, ones } = this;
    let minG = 1;
    for (let i = 0; i < L.length; i++) {
      const xl = L[i] * gain, xr = R[i] * gain;
      dl[w] = xl; dr[w] = xr;
      if (Math.abs(xl) >= tpThr) hotL = 12;
      if (Math.abs(xr) >= tpThr) hotR = 12;
      let ri = 1;
      if (hotL > 0 || hotR > 0) {
        let tp = 0;
        if (hotL > 0) { hotL--; tp = Math.max(tpAt(dl, w, mask), Math.abs(dl[(w - 5) & mask]), Math.abs(dl[(w - 6) & mask])); }
        if (hotR > 0) { hotR--; tp = Math.max(tp, tpAt(dr, w, mask), Math.abs(dr[(w - 5) & mask]), Math.abs(dr[(w - 6) & mask])); }
        if (tp > thr) ri = thr / tp;
      }
      while (tail !== head && dqv[(tail - 1) & dqm] >= ri) tail = (tail - 1) & dqm;
      dqv[tail] = ri; dqi[tail] = n; tail = (tail + 1) & dqm;
      if (dqi[head] <= n - W) head = (head + 1) & dqm;
      const held = dqv[head];
      if (held < env) env = held;
      else { env = held + (env - held) * relCoef; if (held === 1 && env > 0.999999) env = 1; }
      if (env === 1) ones++; else ones = 0;
      sum += env - box[bp]; box[bp] = env; bp++; if (bp === A) bp = 0;
      if (ones >= A) sum = A;
      const g = sum / A;
      if (g < minG) minG = g;
      const r = (w - LT) & mask;
      oL[i] = dl[r] * g; oR[i] = dr[r] * g;
      w = (w + 1) & mask; n++;
    }
    Object.assign(this, { w, n, hotL, hotR, head, tail, bp, sum, env, ones });
    if (minG < 1) this.grMax = Math.max(this.grMax, -20 * Math.log10(minG));
  }
}

export interface LoudnessStats {
  integrated: number;
  truePeak: number;
  samplePeak: number;
  maxShortTerm: number;
}

export function measureChunks(chunks: { l: Float32Array; r: Float32Array }[], sampleRate: number): LoudnessStats {
  const m = new LoudnessMeter(sampleRate);
  chunks.forEach(c => m.push(c.l, c.r));
  return { integrated: m.integrated(), truePeak: toDb(m.truePeak), samplePeak: toDb(m.peak), maxShortTerm: m.maxShortTerm() };
}

const toDb = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity);

/**
 * Normalise to `target` LUFS with a true-peak limiter at `ceiling` dBTP. Returns the new
 * chunks (latency-compensated, same length) and before/after measurements. Limiting
 * costs loudness, so a second pass makes up for it (within 0.3 LU).
 */
export function normalizeChunks(
  chunks: { l: Float32Array; r: Float32Array }[], sampleRate: number, target = -14, ceiling = -1,
): { chunks: { l: Float32Array; r: Float32Array }[]; before: LoudnessStats; after: LoudnessStats; gainDb: number; limiterDb: number } {
  const before = measureChunks(chunks, sampleRate);
  if (!Number.isFinite(before.integrated)) return { chunks, before, after: before, gainDb: 0, limiterDb: 0 };
  let gainDb = target - before.integrated;
  let result = render(chunks, sampleRate, gainDb, ceiling);
  for (let pass = 0; pass < 2; pass++) {
    const miss = target - result.stats.integrated;
    if (!(Math.abs(miss) > 0.3) || gainDb > 24) break;
    gainDb += miss;
    result = render(chunks, sampleRate, gainDb, ceiling);
  }
  return { chunks: result.chunks, before, after: result.stats, gainDb, limiterDb: result.gr };
}

function render(chunks: { l: Float32Array; r: Float32Array }[], sampleRate: number, gainDb: number, ceiling: number) {
  const lim = new TruePeakLimiter(sampleRate, ceiling);
  const gain = Math.pow(10, gainDb / 20);
  const out: { l: Float32Array; r: Float32Array }[] = [];
  let skip = lim.latency;
  const emit = (l: Float32Array, r: Float32Array) => {
    if (skip >= l.length) { skip -= l.length; return; }
    out.push({ l: l.subarray(skip), r: r.subarray(skip) });
    skip = 0;
  };
  chunks.forEach(c => {
    const l = new Float32Array(c.l.length), r = new Float32Array(c.r.length);
    lim.process(c.l, c.r, l, r, gain);
    emit(l, r);
  });
  // flush the look-ahead with silence
  const z = new Float32Array(lim.latency);
  const l = new Float32Array(lim.latency), r = new Float32Array(lim.latency);
  lim.process(z, z, l, r, gain);
  emit(l, r);
  return { chunks: out, stats: measureChunks(out, sampleRate), gr: lim.grMax };
}
