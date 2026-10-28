'use strict';
// ============================================================================
// Audio QA - measurement core (pure functions over Float32Array channels).
//
//   loudness()    ITU-R BS.1770-4: K-weighting, 400 ms blocks with 75 % overlap,
//                 absolute (-70 LKFS) and relative (-10 LU) gates; max momentary
//                 (400 ms) and max short-term (3 s) loudness
//   truePeak()    BS.1770-4 Annex 2: 4x oversampling with the Recommendation's
//                 48-tap interpolator; never reported below the sample peak
//   detectClicks  isolated sample-difference spikes against the local context
//   analyzeTap()  everything the QA report needs for one captured tap
//
// Channel convention: a tap is always two channels, exactly as the stereo bus
// receives it (a mono source is up-mixed L = R, like Web Audio's 'speakers'
// up-mix into the destination). BS.1770 sums the channels, so a mono source
// heard on both speakers reads 3 dB above the same signal measured as a single
// channel. The 1 kHz BS.1770 reference (-20 dBFS sine in one channel =
// -23.0 LUFS) is checked by the calibration and the self-test.
// ============================================================================

/** dB of an amplitude; below -200 dB is numerical silence (denormals) and reads -inf */
const toDb = a => (a > 1e-10 ? 20 * Math.log10(a) : -Infinity);
const powToDb = p => (p > 0 ? 10 * Math.log10(p) : -Infinity);
const lufsOf = p => (p > 0 ? -0.691 + 10 * Math.log10(p) : -Infinity);

// ---------------------------------------------------------------------------
// K-weighting (BS.1770-4 section 2.1): stage 1 high shelf (head effects),
// stage 2 RLB high-pass. Derived from the analog prototypes for any sample
// rate (libebur128 parametrisation); at 48 kHz this reproduces the table in
// the Recommendation (b0 = 1.53512485958697 ... a2 = 0.99007225036621).
// ---------------------------------------------------------------------------
function kWeighting(fs) {
  let f0 = 1681.974450955533;
  const G = 3.999843853973347;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / fs);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = {
    b: [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0],
    a: [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
  };
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / fs);
  a0 = 1 + K / Q + K * K;
  const highpass = { b: [1, -2, 1], a: [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0] };
  return [shelf, highpass];
}

/** Biquad (transposed direct form II, double precision) from x into out */
function biquad(x, c, out) {
  const b0 = c.b[0], b1 = c.b[1], b2 = c.b[2], a1 = c.a[1], a2 = c.a[2];
  let z1 = 0, z2 = 0;
  for (let n = 0; n < x.length; n++) {
    const xn = x[n];
    const y = b0 * xn + z1;
    z1 = b1 * xn - a1 * y + z2;
    z2 = b2 * xn - a2 * y;
    out[n] = y;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Loudness (BS.1770-4 / EBU R128 / EBU Tech 3341)
// ---------------------------------------------------------------------------

/**
 * @param {Float32Array[]} channels  loudspeaker channels (L, R ...), equal length
 * @param {number} fs
 * @param {{ weights?: number[] }} [opts]  per-channel weights (1.0 for L/R/C, 1.41 surrounds)
 */
function loudness(channels, fs, opts = {}) {
  const N = channels.length ? channels[0].length : 0;
  const out = { integrated: -Infinity, maxMomentary: -Infinity, maxShortTerm: -Infinity, shortTermPartial: false, blocks: 0, gatedBlocks: 0 };
  const blockLen = Math.round(0.4 * fs);
  const hop = Math.round(0.1 * fs);
  if (N < blockLen) return out;
  const [shelf, highpass] = kWeighting(fs);
  const t1 = new Float64Array(N);
  const t2 = new Float64Array(N);
  const power = new Float64Array(N);
  channels.forEach((x, i) => {
    const g = opts.weights ? opts.weights[i] : 1;
    biquad(x, shelf, t1);
    biquad(t1, highpass, t2);
    for (let n = 0; n < N; n++) power[n] += g * t2[n] * t2[n];
  });
  const cum = new Float64Array(N + 1);
  for (let n = 0; n < N; n++) cum[n + 1] = cum[n] + power[n];
  const mean = (s, len) => (cum[s + len] - cum[s]) / len;

  // Gating blocks: 400 ms, 75 % overlap
  const blocks = [];
  for (let s = 0; s + blockLen <= N; s += hop) blocks.push(mean(s, blockLen));
  out.blocks = blocks.length;
  let maxBlock = 0;
  for (const p of blocks) if (p > maxBlock) maxBlock = p;
  out.maxMomentary = lufsOf(maxBlock);

  const absGated = blocks.filter(p => lufsOf(p) > -70);
  if (absGated.length) {
    const relGate = lufsOf(absGated.reduce((a, b) => a + b, 0) / absGated.length) - 10;
    const gated = absGated.filter(p => lufsOf(p) > relGate);
    out.gatedBlocks = gated.length;
    if (gated.length) out.integrated = lufsOf(gated.reduce((a, b) => a + b, 0) / gated.length);
  }

  // Short-term: 3 s window every 100 ms (the whole signal if it is shorter)
  const stLen = Math.round(3 * fs);
  let maxSt = 0;
  if (N >= stLen) {
    for (let s = 0; s + stLen <= N; s += hop) maxSt = Math.max(maxSt, mean(s, stLen));
  } else {
    maxSt = mean(0, N);
    out.shortTermPartial = true;
  }
  out.maxShortTerm = lufsOf(maxSt);
  return out;
}

// ---------------------------------------------------------------------------
// True peak (BS.1770-4 Annex 2): 4x polyphase interpolator, 12 taps per phase.
// The four phases sit at 1/8, 3/8, 5/8 and 7/8 of a sample, so the result is
// combined with the sample peak (a true peak is never below the sample peak).
// ---------------------------------------------------------------------------
const TP_PHASES = [
  [0.0017089843750, 0.0109863281250, -0.0196533203125, 0.0332031250000, -0.0594482421875, 0.1373291015625,
    0.9721679687500, -0.1022949218750, 0.0476074218750, -0.0266113281250, 0.0148925781250, -0.0083007812500],
  [-0.0291748046875, 0.0292968750000, -0.0517578125000, 0.0891113281250, -0.1665039062500, 0.4650878906250,
    0.7797851562500, -0.2003173828125, 0.1015625000000, -0.0582275390625, 0.0330810546875, -0.0189208984375],
  [-0.0189208984375, 0.0330810546875, -0.0582275390625, 0.1015625000000, -0.2003173828125, 0.7797851562500,
    0.4650878906250, -0.1665039062500, 0.0891113281250, -0.0517578125000, 0.0292968750000, -0.0291748046875],
  [-0.0083007812500, 0.0148925781250, -0.0266113281250, 0.0476074218750, -0.1022949218750, 0.9721679687500,
    0.1373291015625, -0.0594482421875, 0.0332031250000, -0.0196533203125, 0.0109863281250, 0.0017089843750],
];
const TP_TAPS = 12;
const TP_GAIN_BOUND = Math.max(...TP_PHASES.map(h => h.reduce((s, c) => s + Math.abs(c), 0)));

/** Max |x| (sample peak) and 4x-oversampled true peak of one channel, linear */
function peaks(x) {
  const N = x.length;
  let sp = 0;
  for (let n = 0; n < N; n++) {
    const a = Math.abs(x[n]);
    if (a > sp) sp = a;
  }
  let tp = sp;
  // Blocks whose neighbourhood cannot exceed the running peak are skipped
  const B = 64;
  for (let start = 0; start < N; start += B) {
    const end = Math.min(N, start + B);
    let local = 0;
    for (let n = Math.max(0, start - TP_TAPS + 1); n < end; n++) {
      const a = Math.abs(x[n]);
      if (a > local) local = a;
    }
    if (local * TP_GAIN_BOUND <= tp) continue;
    for (let n = start; n < end; n++) {
      for (let k = 0; k < 4; k++) {
        const h = TP_PHASES[k];
        let acc = 0;
        const mMax = Math.min(TP_TAPS - 1, n);
        for (let m = 0; m <= mMax; m++) acc += h[m] * x[n - m];
        const a = Math.abs(acc);
        if (a > tp) tp = a;
      }
    }
  }
  return { samplePeak: sp, truePeak: tp };
}

// ---------------------------------------------------------------------------
// Basic statistics on [from, to)
// ---------------------------------------------------------------------------
function clampRange(N, from = 0, to = N) {
  const a = Math.max(0, Math.min(N, Math.round(from)));
  const b = Math.max(a, Math.min(N, Math.round(to)));
  return [a, b];
}

function meanOf(x, from, to) {
  const [a, b] = clampRange(x.length, from, to);
  if (b <= a) return 0;
  let s = 0;
  for (let n = a; n < b; n++) s += x[n];
  return s / (b - a);
}

function sumSquares(x, from, to) {
  const [a, b] = clampRange(x.length, from, to);
  let s = 0;
  for (let n = a; n < b; n++) s += x[n] * x[n];
  return s;
}

function peakOf(x, from, to) {
  const [a, b] = clampRange(x.length, from, to);
  let p = 0;
  for (let n = a; n < b; n++) {
    const v = Math.abs(x[n]);
    if (v > p) p = v;
  }
  return p;
}

/** RMS over several channels (power averaged across channels) */
function rmsMulti(chs, from, to) {
  const [a, b] = clampRange(chs[0].length, from, to);
  if (b <= a) return 0;
  let s = 0;
  chs.forEach(x => { s += sumSquares(x, a, b); });
  return Math.sqrt(s / ((b - a) * chs.length));
}

function peakMulti(chs, from, to) {
  return Math.max(...chs.map(x => peakOf(x, from, to)));
}

/** Pearson-style correlation of L and R (no mean removal: audio is AC) */
function correlation(L, R, from, to) {
  const [a, b] = clampRange(L.length, from, to);
  let lr = 0, ll = 0, rr = 0;
  for (let n = a; n < b; n++) {
    lr += L[n] * R[n];
    ll += L[n] * L[n];
    rr += R[n] * R[n];
  }
  if (ll <= 1e-20 || rr <= 1e-20) return null;
  return lr / Math.sqrt(ll * rr);
}

/** Side / mid energy ratio in dB (-inf = mono) */
function widthDb(L, R, from, to) {
  const [a, b] = clampRange(L.length, from, to);
  let m = 0, s = 0;
  for (let n = a; n < b; n++) {
    const mid = 0.5 * (L[n] + R[n]);
    const side = 0.5 * (L[n] - R[n]);
    m += mid * mid;
    s += side * side;
  }
  if (m <= 1e-20) return null;
  return powToDb(s / m);
}

/** Samples at or above full scale and the number of separate overs */
function clipping(chs, threshold = 1.0) {
  let samples = 0, events = 0;
  chs.forEach(x => {
    let inRun = false;
    for (let n = 0; n < x.length; n++) {
      const over = Math.abs(x[n]) >= threshold;
      if (over) {
        samples++;
        if (!inRun) events++;
      }
      inRun = over;
    }
  });
  return { samples, events };
}

/** Replace NaN / Infinity by 0 (in place) and count them */
function sanitize(x) {
  let bad = 0;
  for (let n = 0; n < x.length; n++) {
    if (!Number.isFinite(x[n])) {
      x[n] = 0;
      bad++;
    }
  }
  return bad;
}

// ---------------------------------------------------------------------------
// Clicks / discontinuities
//
// A click is a step in the waveform's value. For every sample n a "step
// estimate" s[n] compares two short lines: one through x[n-3], x[n-2] (the
// signal just before) and one through x[n+1], x[n+2] (just after). If the lines
// cross anywhere over the 3-sample gap the signal only bent there (a corner, a
// steep but smooth transient, curvature) and s = 0; otherwise s is their
// smallest distance over the gap, which is the height of the step, also when
// it is spread over 2-3 samples by band-limiting. A step counts as a click when
//   - s is above an absolute floor (default -50 dBFS, and 2 % of the capture peak),
//   - the signal is locally straight on both sides: s is at least `straightness` x
//     the second difference there (a sharp but smooth edge curves into the gap),
//   - s is at least `isolation` x every other s within +-30 ms (outside the
//     +-3 samples a step occupies): saw / square / sync edges repeat every
//     period, and noise bursts or bright transients put several step-like
//     values within a few samples, so they never count; and
//   - s is at least `rmsRatio` x the RMS of s over the same context.
// Each click is classified: onset (silence before it), cutoff (silence after
// it) or mid (inside a sound: glitches, zipper steps, voice steals, dropouts).
// detectCutoffs() adds sounds that stop dead (full level, then silence), which
// a step test misses in bright or noisy material.
// ---------------------------------------------------------------------------
function slidingMax(a, S) {
  const N = a.length;
  const M = new Float32Array(Math.max(0, N - S + 1));
  if (S <= 0 || N < S) return M;
  const dq = new Int32Array(N);
  let head = 0, tail = 0;
  for (let i = 0; i < N; i++) {
    while (tail > head && a[dq[tail - 1]] <= a[i]) tail--;
    dq[tail++] = i;
    if (dq[head] <= i - S) head++;
    if (i >= S - 1) M[i - S + 1] = a[dq[head]];
  }
  return M;
}

function detectClicksChannel(x, fs, opts) {
  const N = x.length;
  const events = [];
  if (N < 8) return events;
  const W = Math.round((opts.contextMs / 1000) * fs);
  const E = Math.max(3, opts.guardSamples | 0);
  const S = W - E;
  const a = new Float32Array(N);
  for (let n = 3; n < N - 2; n++) {
    const base = x[n + 1] - x[n - 2];
    const d0 = base - 3 * (x[n + 2] - x[n + 1]); // right line minus left line at n-2
    const d1 = base - 3 * (x[n - 2] - x[n - 3]); // ... at n+1
    a[n] = (d0 > 0) !== (d1 > 0) ? 0 : Math.min(Math.abs(d0), Math.abs(d1));
  }
  const cum2 = new Float64Array(N + 1);
  for (let n = 0; n < N; n++) cum2[n + 1] = cum2[n] + a[n] * a[n];
  const M = slidingMax(a, S);
  const rangeMax = (lo, hi) => { // inclusive, clipped
    lo = Math.max(0, lo); hi = Math.min(N - 1, hi);
    if (hi < lo) return 0;
    if (hi - lo + 1 === S) return M[lo];
    let m = 0;
    for (let i = lo; i <= hi; i++) if (a[i] > m) m = a[i];
    return m;
  };
  const rangeSq = (lo, hi) => {
    lo = Math.max(0, lo); hi = Math.min(N - 1, hi);
    return hi < lo ? [0, 0] : [cum2[hi + 1] - cum2[lo], hi - lo + 1];
  };
  const thr = opts.threshold;
  const quietWin = Math.round(0.005 * fs);
  const quietLevel = opts.quietLevel;
  for (let n = 4; n < N - 3; n++) {
    const v = a[n];
    if (v < thr || v < a[n - 1] || v < a[n + 1]) continue;
    // A step sits between locally straight signal; a fast but smooth edge (a
    // band-limited wrap behind a resonant filter) curves on both sides of it
    const curve = Math.max(Math.abs(x[n - 2] - 2 * x[n - 3] + x[n - 4]), Math.abs(x[n + 3] - 2 * x[n + 2] + x[n + 1]));
    if (v <= opts.straightness * curve) continue;
    const m2 = Math.max(rangeMax(n - W, n - E - 1), rangeMax(n + E + 1, n + W));
    if (v <= opts.isolation * m2) continue;
    const [s1, c1] = rangeSq(n - W, n - E - 1);
    const [s2, c2] = rangeSq(n + E + 1, n + W);
    const ctxRms = c1 + c2 > 0 ? Math.sqrt((s1 + s2) / (c1 + c2)) : 0;
    if (v <= opts.rmsRatio * ctxRms) continue;
    const before = Math.sqrt(sumSquares(x, n - quietWin - 1, n - 1) / quietWin);
    const after = Math.sqrt(sumSquares(x, n + 1, n + 1 + quietWin) / quietWin);
    const kind = before < quietLevel ? 'onset' : after < quietLevel ? 'cutoff' : 'mid';
    events.push({ index: n, jump: v, ratio: m2 > 0 ? v / m2 : Infinity, kind });
    n += E; // one discontinuity, one event
  }
  return events;
}

/**
 * Sounds that stop dead: silence (every channel below cutSilentDb for
 * cutPostMs) right after a sound whose last cutRecentMs is still within
 * cutDropDb of the cutEarlierMs before it, i.e. a fade shorter than about
 * 1 ms. Catches hard note cuts in bright or noisy material, where the
 * waveform's own edges would mask the step itself. A 2 ms fade passes.
 */
function detectCutoffs(chs, fs, threshold, opts) {
  const N = chs[0].length;
  const post = Math.round((opts.cutPostMs / 1000) * fs);
  const recent = Math.max(4, Math.round((opts.cutRecentMs / 1000) * fs));
  const earlier = Math.max(8, Math.round((opts.cutEarlierMs / 1000) * fs));
  const silent = Math.pow(10, opts.cutSilentDb / 20);
  const keep = Math.pow(10, -opts.cutDropDb / 20);
  const events = [];
  const quietAhead = new Int32Array(N + 1); // silent samples from n on (all channels)
  for (let n = N - 1; n >= 0; n--) quietAhead[n] = chs.every(x => Math.abs(x[n]) < silent) ? quietAhead[n + 1] + 1 : 0;
  for (let n = recent + earlier; n < N - post; n++) {
    if (quietAhead[n] < post || quietAhead[n - 1] > 0) continue; // n = first silent sample after a sound
    const last = rmsMulti(chs, n - recent, n);
    if (last <= threshold) continue;
    const before = rmsMulti(chs, n - recent - earlier, n - recent);
    if (last >= keep * before) events.push({ index: n, jump: last, ratio: null, kind: 'cutoff', ch: 0 });
  }
  return events;
}

function detectClicks(chs, fs, opts = {}) {
  const o = {
    contextMs: 30, guardSamples: 3, isolation: 2.5, rmsRatio: 10, straightness: 4,
    floorDb: -50, relative: 0.02, quietDb: -60, maxEvents: 40,
    cutRecentMs: 0.5, cutEarlierMs: 5, cutDropDb: 12, cutPostMs: 10, cutSilentDb: -80, ...opts,
  };
  const peak = peakMulti(chs, 0, chs[0].length);
  o.threshold = Math.max(Math.pow(10, o.floorDb / 20), o.relative * peak);
  o.quietLevel = Math.pow(10, o.quietDb / 20);
  const merged = [];
  const guard = Math.round(0.001 * fs);
  chs.forEach((x, ch) => {
    detectClicksChannel(x, fs, o).forEach(e => {
      const near = merged.find(m => Math.abs(m.index - e.index) <= guard);
      if (near) {
        if (e.jump > near.jump) Object.assign(near, e, { ch });
      } else merged.push({ ...e, ch });
    });
  });
  detectCutoffs(chs, fs, o.threshold, o).forEach(e => {
    if (!merged.some(m => Math.abs(m.index - e.index) <= 2 * guard)) merged.push(e);
  });
  merged.sort((p, q) => p.index - q.index);
  const kinds = { onset: 0, cutoff: 0, mid: 0 };
  merged.forEach(e => { kinds[e.kind]++; });
  const worst = merged.reduce((m, e) => Math.max(m, e.jump), 0);
  return {
    count: merged.length,
    kinds,
    worstJumpDb: merged.length ? toDb(worst) : null,
    thresholdDb: toDb(o.threshold),
    events: merged.slice(0, o.maxEvents).map(e => ({
      t: +(e.index / fs).toFixed(4), jumpDb: +toDb(e.jump).toFixed(1),
      ratio: Number.isFinite(e.ratio) ? +e.ratio.toFixed(1) : null, kind: e.kind, ch: e.ch,
    })),
  };
}

// ---------------------------------------------------------------------------
// Dropouts: runs of exact zeros (all channels) inside a sound
// ---------------------------------------------------------------------------
function detectDropouts(chs, fs, opts = {}) {
  const minRun = opts.minRun ?? 32;
  const maxRun = Math.round((opts.maxMs ?? 250) * fs / 1000);
  const ctx = Math.round(0.01 * fs);
  const level = Math.pow(10, (opts.aroundDb ?? -40) / 20);
  const N = chs[0].length;
  const events = [];
  let start = -1;
  for (let n = 0; n <= N; n++) {
    const zero = n < N && chs.every(x => x[n] === 0);
    if (zero) {
      if (start < 0) start = n;
      continue;
    }
    if (start >= 0) {
      const len = n - start;
      if (len >= minRun && len <= maxRun && start > ctx && n + ctx < N) {
        const before = rmsMulti(chs, start - ctx, start);
        const after = rmsMulti(chs, n, n + ctx);
        if (before > level && after > level) events.push({ t: +(start / fs).toFixed(4), ms: +((len / fs) * 1000).toFixed(2) });
      }
      start = -1;
    }
  }
  return { count: events.length, events: events.slice(0, 20) };
}

// ---------------------------------------------------------------------------
// Tail after stop
// ---------------------------------------------------------------------------
function tailStats(chs, fs, stopIdx, opts = {}) {
  const N = chs[0].length;
  const after = opts.afterSec ?? 2;
  const start = stopIdx + Math.round(after * fs);
  const minWin = Math.round(0.1 * fs);
  if (!(stopIdx >= 0) || start > N - minWin) return null;
  const win = Math.round(0.02 * fs);
  // 20 ms RMS envelope after stop -> release time to `releaseDb`
  const rel = Math.pow(10, (opts.releaseDb ?? -60) / 20);
  let lastLoud = -1;
  for (let s = stopIdx; s + win <= N; s += win) {
    if (rmsMulti(chs, s, s + win) >= rel || peakMulti(chs, s, s + win) >= rel) lastLoud = s + win;
  }
  const releaseSec = lastLoud < 0 ? 0 : lastLoud >= N - win ? null : (lastLoud - stopIdx) / fs;
  // Decay rate between 1.0-1.5 s and 2.0-2.5 s after stop (or the last 0.5 s)
  const half = Math.round(0.5 * fs);
  const lateA = Math.min(start, N - half);
  const earlyA = lateA - Math.round(1.0 * fs);
  let decayDbPerSec = null;
  if (earlyA >= stopIdx) {
    const e = rmsMulti(chs, earlyA, earlyA + half);
    const l = rmsMulti(chs, lateA, lateA + half);
    if (e > 1e-7 && l > 1e-7) decayDbPerSec = (toDb(l) - toDb(e)) / ((lateA - earlyA) / fs);
    else if (e > 1e-7) decayDbPerSec = -Infinity;
  }
  return {
    afterSec: after,
    windowSec: +((N - start) / fs).toFixed(3),
    peakDb: toDb(peakMulti(chs, start, N)),
    rmsDb: toDb(rmsMulti(chs, start, N)),
    decayDbPerSec,
    releaseSec,
  };
}

// ---------------------------------------------------------------------------
// Everything for one tap
// ---------------------------------------------------------------------------

/**
 * @param {Float32Array[]} chs   [L, R] (mono sources already up-mixed)
 * @param {number} fs
 * @param {{ excite?: number, stop?: number }} marks  sample indices
 * @param {object} [opts] { stereo, full (clicks/dc/tail), thresholds }
 */
function analyzeTap(chs, fs, marks = {}, opts = {}) {
  const N = chs[0].length;
  const nonFinite = chs.reduce((s, x) => s + sanitize(x), 0);
  const ex = Number.isFinite(marks.excite) ? marks.excite : 0;
  const stop = Number.isFinite(marks.stop) ? marks.stop : N;
  const L = loudness(chs, fs);
  const pk = chs.map(peaks);
  const samplePeak = Math.max(...pk.map(p => p.samplePeak));
  const truePeak = Math.max(...pk.map(p => p.truePeak));
  const silentDb = opts.silentDb ?? -70;
  const r = {
    frames: N,
    seconds: +(N / fs).toFixed(3),
    silent: toDb(samplePeak) < silentDb,
    lufs: L.integrated,
    maxShortTermLufs: L.maxShortTerm,
    maxMomentaryLufs: L.maxMomentary,
    samplePeakDb: toDb(samplePeak),
    truePeakDb: toDb(truePeak),
    clip: clipping(chs),
    nonFinite,
  };
  if (opts.full === false) return r;
  // RMS and crest factor per channel over the excitation window (the louder channel)
  let rmsMax = 0, crest = null;
  chs.forEach(x => {
    const rms = Math.sqrt(sumSquares(x, ex, stop) / Math.max(1, stop - ex));
    if (rms > rmsMax) rmsMax = rms;
    if (rms > 1e-7) crest = Math.max(crest ?? -Infinity, toDb(peakOf(x, ex, stop) / rms));
  });
  r.rmsDb = toDb(rmsMax);
  r.crestDb = crest;
  r.dc = Math.max(...chs.map(x => Math.abs(meanOf(x, ex, stop))));
  const tail0 = Math.max(stop, N - Math.round(0.5 * fs));
  r.dcTail = N - tail0 > fs * 0.1 ? Math.max(...chs.map(x => Math.abs(meanOf(x, tail0, N)))) : null;
  r.idlePeakDb = ex > fs * 0.02 ? toDb(peakMulti(chs, 0, ex)) : null;
  r.clicks = detectClicks(chs, fs, opts.clicks);
  r.dropouts = detectDropouts(chs, fs);
  r.tail = Number.isFinite(marks.stop) ? tailStats(chs, fs, stop, opts.tail) : null;
  if (opts.stereo) {
    r.correlation = correlation(chs[0], chs[1], ex, N);
    r.widthDb = widthDb(chs[0], chs[1], ex, N);
  } else {
    r.correlation = null;
    r.widthDb = null;
  }
  return r;
}

module.exports = {
  toDb, powToDb, lufsOf, kWeighting, biquad, loudness, peaks, TP_PHASES,
  meanOf, rmsMulti, peakMulti, correlation, widthDb, clipping, sanitize,
  detectClicks, detectCutoffs, detectDropouts, tailStats, analyzeTap, slidingMax,
};
