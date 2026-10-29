/* eslint-disable */
// ============================================================================
// Studio worklets
//   'recorder'   - captures its stereo input between two exact audio frames and
//                  posts it to the main thread in chunks. Every recorder given the
//                  same start/stop time records the same frames, so stems are
//                  sample-aligned and the same length.
//   'master-bus' - the studio master: optional tilt/shelf EQ and glue compressor
//                  (both bypassed by default), master gain, a true-peak look-ahead
//                  brickwall limiter (-1 dBTP, 1.5 ms) and a BS.1770-4 meter
//                  (sample/true peak, momentary/short-term/integrated LUFS, gain
//                  reduction). One node, no AudioParams (settings are messages).
//
// CPU: with the EQ and glue off and the mix below the ceiling, the limiter is a
// delay line (its gain computer idles) and the meter costs two biquads per
// channel plus a true-peak search that only runs near the window's peaks.
// ============================================================================

// ITU-R BS.1770-4 Annex 2: 4x oversampling interpolator, 12 taps per phase
const TP_FIR = [
  [0.0017089843750, 0.0109863281250, -0.0196533203125, 0.0332031250000, -0.0594482421875, 0.1373291015625, 0.9721679687500, -0.1022949218750, 0.0476074218750, -0.0266113281250, 0.0148925781250, -0.0083007812500],
  [-0.0291748046875, 0.0292968750000, -0.0517578125000, 0.0891113281250, -0.1665039062500, 0.4650878906250, 0.7797851562500, -0.2003173828125, 0.1015625000000, -0.0582275390625, 0.0330810546875, -0.0189208984375],
  [-0.0189208984375, 0.0330810546875, -0.0582275390625, 0.1015625000000, -0.2003173828125, 0.7797851562500, 0.4650878906250, -0.1665039062500, 0.0891113281250, -0.0517578125000, 0.0292968750000, -0.0291748046875],
  [-0.0083007812500, 0.0148925781250, -0.0266113281250, 0.0476074218750, -0.1022949218750, 0.9721679687500, 0.1373291015625, -0.0594482421875, 0.0332031250000, -0.0196533203125, 0.0109863281250, 0.0017089843750],
];
// Largest possible gain of any phase: |interpolated| <= TP_BOUND * max|x| over the 12 taps
let TP_BOUND = 0;
for (const ph of TP_FIR) { let s = 0; for (const h of ph) s += Math.abs(h); if (s > TP_BOUND) TP_BOUND = s; }
const H = TP_FIR.map(p => Float64Array.from(p));
const H0 = H[0], H1 = H[1], H2 = H[2], H3 = H[3];

/** True-peak (max over the 4 phases) of the 12 samples ending at ring[w] */
function tpAt(ring, w, mask) {
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
  for (let k = 0; k < 12; k++) {
    const x = ring[(w - k) & mask];
    s0 += H0[k] * x; s1 += H1[k] * x; s2 += H2[k] * x; s3 += H3[k] * x;
  }
  let m = s0 < 0 ? -s0 : s0;
  if (s1 > m) m = s1; else if (-s1 > m) m = -s1;
  if (s2 > m) m = s2; else if (-s2 > m) m = -s2;
  if (s3 > m) m = s3; else if (-s3 > m) m = -s3;
  return m;
}

const dbToLin = db => Math.pow(10, db / 20);
const nextPow2 = n => { let p = 1; while (p < n) p <<= 1; return p; };

/** BS.1770-4 K-weighting (pre-filter shelf + RLB high-pass) for any sample rate */
function kWeighting(fs) {
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan(Math.PI * f0 / fs);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const s1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / fs);
  a0 = 1 + K / Q + K * K;
  const s2 = [1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  return [s1, s2];
}

/** RBJ shelf (S = 1). type 'low' | 'high' -> [b0,b1,b2,a1,a2] */
function shelf(type, f, db, fs) {
  const A = Math.pow(10, db / 40), w0 = 2 * Math.PI * f / fs, c = Math.cos(w0), al = Math.sin(w0) / Math.SQRT2;
  const sa = 2 * Math.sqrt(A) * al;
  let b0, b1, b2, a0, a1, a2;
  if (type === 'low') {
    b0 = A * ((A + 1) - (A - 1) * c + sa); b1 = 2 * A * ((A - 1) - (A + 1) * c); b2 = A * ((A + 1) - (A - 1) * c - sa);
    a0 = (A + 1) + (A - 1) * c + sa; a1 = -2 * ((A - 1) + (A + 1) * c); a2 = (A + 1) + (A - 1) * c - sa;
  } else {
    b0 = A * ((A + 1) + (A - 1) * c + sa); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - sa);
    a0 = (A + 1) - (A - 1) * c + sa; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - sa;
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

/** First-order tilt around fc: +db at the top end, -db at the bottom -> [b0,b1,a1] */
function tilt(fc, db, fs) {
  const G = Math.pow(10, (2 * db) / 20), sg = Math.sqrt(G), t = Math.tan(Math.PI * fc / fs);
  const kz = sg / t, kp = 1 / (sg * t), a0 = kp + 1, g = 1 / sg;
  return [g * (kz + 1) / a0, g * (1 - kz) / a0, (1 - kp) / a0];
}

class MasterBusProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    const sr = sampleRate;
    this.sr = sr;

    // ---- gain ---------------------------------------------------------------
    this.gain = 1; this.gainTarget = 1;
    this.gainK = 1 - Math.exp(-128 / (0.012 * sr)); // ~12 ms glide per quantum

    // ---- limiter --------------------------------------------------------------
    // Total latency LT samples (~1.5 ms). The true-peak detector sees sample n-5..n-6
    // at step n; a min-hold of W = A + 1 steps and a box filter of A = LT - 5 steps
    // bring the gain down exactly by the time both neighbours of an over reach the
    // output, as a linear-in-time ramp (no clicks, no overshoot).
    this.LT = Math.max(16, Math.round((o.lookahead ?? 0.0015) * sr));
    this.A = this.LT - 5;
    this.W = this.A + 1;
    this.mask = nextPow2(this.LT + 16) - 1;
    this.dl = new Float32Array(this.mask + 1);
    this.dr = new Float32Array(this.mask + 1);
    this.w = 0;
    this.n = 0;
    this.hot = 0; this.hotL = 0; this.hotR = 0;
    const dq = nextPow2(this.W + 4);
    this.dqMask = dq - 1;
    this.dqv = new Float64Array(dq);
    this.dqi = new Float64Array(dq);
    this.dqHead = 0; this.dqTail = 0;
    this.box = new Float64Array(this.A).fill(1);
    this.bp = 0;
    this.sum = this.A;
    this.env = 1;
    this.ones = this.W;
    this.zeroRun = 0;
    this.kZero = true;
    this.setCeiling(o.ceiling ?? -1);
    this.setRelease(o.release ?? 0.06);

    // ---- EQ (bypassed) --------------------------------------------------------
    this.eqOn = false;
    this.eq = { low: 0, tilt: 0, high: 0, lowFreq: 100, tiltFreq: 1000, highFreq: 10000 };
    this.lsC = [1, 0, 0, 0, 0]; this.hsC = [1, 0, 0, 0, 0]; this.tC = [1, 0, 0];
    this.eqS = new Float64Array(12); // [ls z1 z2, hs z1 z2] x 2ch + tilt z x2 (packed)

    // ---- glue compressor (bypassed) -----------------------------------------
    this.glueOn = false;
    this.glue = { threshold: -18, ratio: 2, attack: 0.01, release: 0.3, auto: true, makeup: 0, mix: 1, knee: 6 };
    this.gEnv = 0;        // smoothed gain reduction, dB (<= 0)
    this.gGain = 1;       // applied linear gain at the end of the last sub-block
    this.glueGrMax = 0;

    // ---- meter ----------------------------------------------------------------
    const [k1, k2] = kWeighting(sr);
    this.k1 = Float64Array.from(k1); this.k2 = Float64Array.from(k2);
    this.kS = new Float64Array(8); // 2 biquads x 2 states x 2 channels
    this.blockLen = Math.round(0.1 * sr);
    this.blockPos = 0; this.accL = 0; this.accR = 0;
    this.blocks = new Float64Array(30); this.nBlocks = 0; this.bHead = 0;
    this.hist = new Float64Array(760); this.histE = new Float64Array(760);
    this.histN = 0; this.histSum = 0;
    this.lufsM = -Infinity; this.lufsS = -Infinity; this.lufsI = -Infinity;
    this.om = 15;
    this.ol = new Float64Array(16); this.or = new Float64Array(16); this.ow = 0;
    this.reportLen = Math.round(0.05 * sr);
    this.reportPos = 0;
    this.pkL = 0; this.pkR = 0; this.tpWin = 0; this.inPk = 0; this.minG = 1;
    this.port.onmessage = e => this.onMessage(e.data);
    this.port.postMessage({ type: 'ready', latency: this.LT });
  }

  setCeiling(db) {
    this.ceilingDb = Math.max(-12, Math.min(0, db));
    // 0.02 dB of safety for the gain ramp's own (tiny) modulation of inter-sample peaks
    this.thr = dbToLin(this.ceilingDb - 0.02);
  }

  setRelease(s) {
    this.relCoef = Math.exp(-1 / (Math.max(0.005, s) * this.sr));
  }

  onMessage(d) {
    if (!d || typeof d !== 'object') return;
    if (d.type === 'reset') { this.resetMeter(); return; }
    if (d.type !== 'set') return;
    if (typeof d.gain === 'number' && isFinite(d.gain)) this.gainTarget = Math.max(0, Math.min(8, d.gain));
    if (typeof d.ceiling === 'number') this.setCeiling(d.ceiling);
    if (typeof d.release === 'number') this.setRelease(d.release);
    if (d.eq) {
      Object.assign(this.eq, d.eq);
      const wasOn = this.eqOn;
      this.eqOn = !!this.eq.on;
      if (this.eqOn && !wasOn) this.eqS.fill(0);
      this.lsC = shelf('low', this.eq.lowFreq, this.eq.low || 0, this.sr);
      this.hsC = shelf('high', this.eq.highFreq, this.eq.high || 0, this.sr);
      this.tC = tilt(this.eq.tiltFreq, this.eq.tilt || 0, this.sr);
    }
    if (d.glue) {
      Object.assign(this.glue, d.glue);
      const wasOn = this.glueOn;
      this.glueOn = !!this.glue.on;
      if (this.glueOn && !wasOn) { this.gEnv = 0; this.gGain = dbToLin(this.glue.makeup || 0); }
    }
  }

  resetMeter() {
    this.blocks.fill(0); this.nBlocks = 0; this.bHead = 0;
    this.hist.fill(0); this.histE.fill(0); this.histN = 0; this.histSum = 0;
    this.lufsM = -Infinity; this.lufsS = -Infinity; this.lufsI = -Infinity;
    this.blockPos = 0; this.accL = 0; this.accR = 0;
  }

  resetAll() {
    this.dl.fill(0); this.dr.fill(0); this.eqS.fill(0); this.kS.fill(0);
    this.ol.fill(0); this.or.fill(0);
    this.box.fill(1); this.sum = this.A; this.env = 1; this.ones = this.W; this.hot = 0; this.hotL = 0; this.hotR = 0;
    this.dqHead = 0; this.dqTail = 0;
    this.gEnv = 0; this.gGain = dbToLin(this.glue.makeup || 0);
    this.kZero = true;
    this.resetMeter();
  }

  // --------------------------------------------------------------------------

  processEq(L, R, n) {
    const ls = this.lsC, hs = this.hsC, t = this.tC, s = this.eqS;
    for (let c = 0; c < 2; c++) {
      const x = c === 0 ? L : R;
      const o = c * 6;
      let l1 = s[o], l2 = s[o + 1], h1 = s[o + 2], h2 = s[o + 3], tz = s[o + 4];
      for (let i = 0; i < n; i++) {
        let v = x[i];
        // tilt (first order, transposed direct form)
        const ty = t[0] * v + tz; tz = t[1] * v - t[2] * ty; v = ty;
        const ly = ls[0] * v + l1; l1 = ls[1] * v - ls[3] * ly + l2; l2 = ls[2] * v - ls[4] * ly; v = ly;
        const hy = hs[0] * v + h1; h1 = hs[1] * v - hs[3] * hy + h2; h2 = hs[2] * v - hs[4] * hy;
        x[i] = hy;
      }
      if (Math.abs(l1) < 1e-20) l1 = 0; if (Math.abs(l2) < 1e-20) l2 = 0;
      if (Math.abs(h1) < 1e-20) h1 = 0; if (Math.abs(h2) < 1e-20) h2 = 0; if (Math.abs(tz) < 1e-20) tz = 0;
      s[o] = l1; s[o + 1] = l2; s[o + 2] = h1; s[o + 3] = h2; s[o + 4] = tz;
    }
  }

  processGlue(L, R, n) {
    const g = this.glue, SB = 16, sr = this.sr;
    const thr = g.threshold, ratio = Math.max(1, g.ratio), knee = Math.max(0, g.knee);
    const slope = 1 / ratio - 1;
    const aA = Math.exp(-SB / (Math.max(0.0001, g.attack) * sr));
    const makeup = g.makeup || 0, mix = Math.max(0, Math.min(1, g.mix ?? 1)), dry = 1 - mix;
    let env = this.gEnv, gain = this.gGain, grMax = this.glueGrMax;
    for (let b = 0; b < n; b += SB) {
      const e = Math.min(n, b + SB);
      let pk = 0;
      for (let i = b; i < e; i++) {
        const a = L[i] < 0 ? -L[i] : L[i]; if (a > pk) pk = a;
        const c = R[i] < 0 ? -R[i] : R[i]; if (c > pk) pk = c;
      }
      const lvl = pk > 1e-9 ? 20 * Math.log10(pk) : -180;
      const over = lvl - thr;
      let gr;
      if (2 * over < -knee) gr = 0;
      else if (2 * Math.abs(over) <= knee && knee > 0) { const q = over + knee / 2; gr = slope * q * q / (2 * knee); }
      else gr = slope * over;
      if (gr < env) env = gr + (env - gr) * aA;
      else {
        const rel = g.auto ? Math.min(1.2, 0.1 + 0.12 * -env) : Math.max(0.01, g.release);
        env = gr + (env - gr) * Math.exp(-SB / (rel * sr));
      }
      if (-env > grMax) grMax = -env;
      const target = Math.pow(10, (env + makeup) / 20);
      const step = (target - gain) / (e - b);
      for (let i = b; i < e; i++) {
        gain += step;
        L[i] = L[i] * (dry + mix * gain);
        R[i] = R[i] * (dry + mix * gain);
      }
      gain = target;
    }
    this.gEnv = env; this.gGain = gain; this.glueGrMax = grMax;
  }

  /** Limiter + meter on L/R (already EQ'd, glued and gained), writing oL/oR */
  processLimiter(L, R, oL, oR, n) {
    const dl = this.dl, dr = this.dr, mask = this.mask, LT = this.LT, A = this.A, W = this.W;
    const thr = this.thr, tpThr = thr / TP_BOUND;
    // Quiet and idle: a pure delay line
    let idle = this.ones >= W && this.hot === 0;
    if (idle) {
      for (let i = 0; i < n; i++) {
        const a = L[i] < 0 ? -L[i] : L[i], b = R[i] < 0 ? -R[i] : R[i];
        if (a >= tpThr || b >= tpThr) { idle = false; break; }
      }
    }
    let w = this.w;
    if (idle) {
      for (let i = 0; i < n; i++) {
        dl[w] = L[i]; dr[w] = R[i];
        const r = (w - LT) & mask;
        oL[i] = dl[r]; oR[i] = dr[r];
        w = (w + 1) & mask;
      }
      this.w = w; this.n += n;
      return;
    }
    const dqv = this.dqv, dqi = this.dqi, dqm = this.dqMask, box = this.box, relCoef = this.relCoef;
    let head = this.dqHead, tail = this.dqTail, env = this.env, sum = this.sum, bp = this.bp, ones = this.ones;
    let hotL = this.hotL | 0, hotR = this.hotR | 0;
    let pos = this.n, minG = this.minG;
    for (let i = 0; i < n; i++) {
      const xl = L[i], xr = R[i];
      dl[w] = xl; dr[w] = xr;
      // A channel can only have a true peak above the ceiling within 12 samples of a
      // sample above ceiling / TP_BOUND (the interpolator's largest gain): rigorous skip.
      if ((xl < 0 ? -xl : xl) >= tpThr) hotL = 12;
      if ((xr < 0 ? -xr : xr) >= tpThr) hotR = 12;
      let ri = 1;
      if (hotL > 0 || hotR > 0) {
        // interval between samples n-6 and n-5: both sample values and the 4 interpolated phases
        let tp = 0;
        if (hotL > 0) {
          hotL--;
          tp = tpAt(dl, w, mask);
          let s = dl[(w - 5) & mask]; if (s < 0) s = -s; if (s > tp) tp = s;
          s = dl[(w - 6) & mask]; if (s < 0) s = -s; if (s > tp) tp = s;
        }
        if (hotR > 0) {
          hotR--;
          const t2 = tpAt(dr, w, mask); if (t2 > tp) tp = t2;
          let s = dr[(w - 5) & mask]; if (s < 0) s = -s; if (s > tp) tp = s;
          s = dr[(w - 6) & mask]; if (s < 0) s = -s; if (s > tp) tp = s;
        }
        if (tp > thr) ri = thr / tp;
      }
      // sliding minimum over the last W required gains (monotonic deque)
      while (tail !== head && dqv[(tail - 1) & dqm] >= ri) tail = (tail - 1) & dqm;
      dqv[tail] = ri; dqi[tail] = pos; tail = (tail + 1) & dqm;
      if (dqi[head] <= pos - W) head = (head + 1) & dqm;
      const held = dqv[head];
      // instant attack, exponential release
      if (held < env) env = held;
      else { env = held + (env - held) * relCoef; if (held === 1 && env > 0.999999) env = 1; }
      if (env === 1) ones++; else ones = 0;
      // box filter: a linear ramp of A samples that lands exactly on the held value
      sum += env - box[bp]; box[bp] = env; bp++; if (bp === A) bp = 0;
      if (ones >= A) sum = A;
      const g = sum / A;
      if (g < minG) minG = g;
      const r = (w - LT) & mask;
      oL[i] = dl[r] * g; oR[i] = dr[r] * g;
      w = (w + 1) & mask; pos++;
    }
    this.w = w; this.n = pos; this.dqHead = head; this.dqTail = tail;
    this.hotL = hotL; this.hotR = hotR; this.hot = hotL + hotR;
    this.env = env; this.sum = sum; this.bp = bp; this.ones = ones; this.minG = minG;
  }

  meter(oL, oR, n) {
    const k1 = this.k1, k2 = this.k2, s = this.kS, ol = this.ol, or = this.or, om = this.om;
    const p0 = k1[0], p1 = k1[1], p2 = k1[2], p3 = k1[3], p4 = k1[4];
    const q0 = k2[0], q1 = k2[1], q2 = k2[2], q3 = k2[3], q4 = k2[4];
    let a0 = s[0], a1 = s[1], a2 = s[2], a3 = s[3], b0 = s[4], b1 = s[5], b2 = s[6], b3 = s[7];
    let accL = this.accL, accR = this.accR, pkL = this.pkL, pkR = this.pkR, tpWin = this.tpWin, ow = this.ow;
    let blockPos = this.blockPos;
    const blockLen = this.blockLen;
    for (let i = 0; i < n; i++) {
      const xl = oL[i], xr = oR[i];
      // K-weighting, transposed direct form II, two stages per channel
      let y = p0 * xl + a0; a0 = p1 * xl - p3 * y + a1; a1 = p2 * xl - p4 * y;
      let z = q0 * y + a2; a2 = q1 * y - q3 * z + a3; a3 = q2 * y - q4 * z;
      accL += z * z;
      y = p0 * xr + b0; b0 = p1 * xr - p3 * y + b1; b1 = p2 * xr - p4 * y;
      z = q0 * y + b2; b2 = q1 * y - q3 * z + b3; b3 = q2 * y - q4 * z;
      accR += z * z;
      // sample peak
      const al = xl < 0 ? -xl : xl, ar = xr < 0 ? -xr : xr;
      if (al > pkL) pkL = al;
      if (ar > pkR) pkR = ar;
      // True peak (4x, BS.1770 interpolator). An inter-sample peak sits next to a local
      // maximum of |x|, so only the two intervals around each local maximum that could
      // beat this window's maximum are interpolated (sample n-6, now that n-5 is known).
      ol[ow] = xl; or[ow] = xr;
      let c = ol[(ow - 6) & om]; if (c < 0) c = -c;
      if (c * 1.42 > tpWin) {
        let u = ol[(ow - 7) & om]; if (u < 0) u = -u;
        let v = ol[(ow - 5) & om]; if (v < 0) v = -v;
        if (c >= u && c >= v) {
          const t1 = tpAt(ol, (ow - 1) & om, om); if (t1 > tpWin) tpWin = t1;
          const t2 = tpAt(ol, ow, om); if (t2 > tpWin) tpWin = t2;
        }
      }
      c = or[(ow - 6) & om]; if (c < 0) c = -c;
      if (c * 1.42 > tpWin) {
        let u = or[(ow - 7) & om]; if (u < 0) u = -u;
        let v = or[(ow - 5) & om]; if (v < 0) v = -v;
        if (c >= u && c >= v) {
          const t1 = tpAt(or, (ow - 1) & om, om); if (t1 > tpWin) tpWin = t1;
          const t2 = tpAt(or, ow, om); if (t2 > tpWin) tpWin = t2;
        }
      }
      if (al > tpWin) tpWin = al;
      if (ar > tpWin) tpWin = ar;
      ow = (ow + 1) & om;
      if (++blockPos === blockLen) {
        this.endBlock((accL + accR) / blockLen);
        accL = 0; accR = 0; blockPos = 0;
      }
    }
    const f = v => (Math.abs(v) < 1e-25 ? 0 : v);
    s[0] = f(a0); s[1] = f(a1); s[2] = f(a2); s[3] = f(a3); s[4] = f(b0); s[5] = f(b1); s[6] = f(b2); s[7] = f(b3);
    this.accL = accL; this.accR = accR; this.pkL = pkL; this.pkR = pkR; this.tpWin = tpWin; this.ow = ow;
    this.blockPos = blockPos;
  }

  endBlock(e) {
    const B = this.blocks;
    B[this.bHead] = e;
    this.bHead = (this.bHead + 1) % 30;
    if (this.nBlocks < 30) this.nBlocks++;
    const L = z => (z > 0 ? -0.691 + 10 * Math.log10(z) : -Infinity);
    if (this.nBlocks >= 4) {
      let m = 0;
      for (let k = 1; k <= 4; k++) m += B[(this.bHead - k + 30) % 30];
      m /= 4;
      this.lufsM = L(m);
      let st = 0;
      for (let k = 0; k < this.nBlocks; k++) st += B[k];
      this.lufsS = L(st / this.nBlocks);
      // gating block (400 ms, 75 % overlap) for the integrated loudness
      const lm = this.lufsM;
      if (lm > -70) {
        const bin = Math.min(759, Math.max(0, Math.floor((lm + 70) * 10)));
        this.hist[bin]++; this.histE[bin] += m;
        this.histN++; this.histSum += m;
        const rel = L(this.histSum / this.histN) - 10;
        const from = Math.max(0, Math.min(759, Math.floor((rel + 70) * 10)));
        let se = 0, sn = 0;
        // the bin holding the relative gate is split exactly by its own blocks' mean
        for (let b = from; b < 760; b++) {
          if (!this.hist[b]) continue;
          if (b === from && L(this.histE[b] / this.hist[b]) <= rel) continue;
          se += this.histE[b]; sn += this.hist[b];
        }
        this.lufsI = sn ? L(se / sn) : -Infinity;
      }
    }
  }

  report() {
    const glue = this.glueOn ? this.glueGrMax : 0;
    this.port.postMessage({
      type: 'meter',
      peakL: this.pkL, peakR: this.pkR, tp: this.tpWin, inPeak: this.inPk,
      gr: this.minG < 1 ? -20 * Math.log10(this.minG) : 0,
      glue,
      // below the -70 LUFS absolute gate a reading means nothing: report "no signal"
      m: this.lufsM > -70 ? this.lufsM : null,
      s: this.lufsS > -70 ? this.lufsS : null,
      i: this.lufsI > -70 ? this.lufsI : null,
    });
    this.pkL = 0; this.pkR = 0; this.tpWin = 0; this.inPk = 0; this.minG = 1; this.glueGrMax = 0;
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const oL = out[0], oR = out[1] || out[0];
    const n = oL.length;
    const inp = inputs[0];
    if (!this.L || this.L.length !== n) { this.L = new Float32Array(n); this.R = new Float32Array(n); }
    const L = this.L, R = this.R;
    if (inp && inp.length) { L.set(inp[0]); R.set(inp[1] || inp[0]); }
    else { L.fill(0); R.fill(0); }

    if (this.eqOn) this.processEq(L, R, n);
    if (this.glueOn) this.processGlue(L, R, n);
    // master gain, glided per quantum
    const g0 = this.gain;
    let g1 = g0 + (this.gainTarget - g0) * this.gainK;
    if (Math.abs(g1 - this.gainTarget) < 1e-6) g1 = this.gainTarget;
    let qPk = 0;
    if (g0 === 1 && g1 === 1) {
      for (let i = 0; i < n; i++) { const a = L[i] < 0 ? -L[i] : L[i], b = R[i] < 0 ? -R[i] : R[i]; if (a > qPk) qPk = a; if (b > qPk) qPk = b; }
    } else {
      const step = (g1 - g0) / n;
      let g = g0;
      for (let i = 0; i < n; i++) {
        g += step; L[i] *= g; R[i] *= g;
        const a = L[i] < 0 ? -L[i] : L[i], b = R[i] < 0 ? -R[i] : R[i]; if (a > qPk) qPk = a; if (b > qPk) qPk = b;
      }
    }
    this.gain = g1;
    if (qPk > this.inPk) this.inPk = qPk;

    // Silence (stopped studio): once the delay line has emptied, the limiter is idle and
    // the meter filters have decayed, the output is exact zeros - skip all the work.
    this.zeroRun = qPk === 0 ? this.zeroRun + n : 0;
    if (this.zeroRun > this.mask + 1 + n && this.ones >= this.W && this.hotL === 0 && this.hotR === 0 && this.kZero) {
      oL.fill(0); if (oR !== oL) oR.fill(0);
      this.w = (this.w + n) & this.mask; // the ring is all zeros already
      this.n += n;
      this.blockPos += n;
      if (this.blockPos >= this.blockLen) {
        this.blockPos -= this.blockLen;
        this.endBlock((this.accL + this.accR) / this.blockLen);
        this.accL = 0; this.accR = 0;
      }
      this.reportPos += n;
      if (this.reportPos >= this.reportLen) { this.reportPos -= this.reportLen; this.report(); }
      return true;
    }

    this.processLimiter(L, R, oL, oR, n);
    this.meter(oL, oR, n);
    const k = this.kS;
    this.kZero = k[0] === 0 && k[1] === 0 && k[2] === 0 && k[3] === 0 && k[4] === 0 && k[5] === 0 && k[6] === 0 && k[7] === 0;
    // A NaN/Infinity from any instrument would otherwise poison every filter state for good.
    // The K-weighting states see every output sample, so they are the canary.
    const ks = this.kS;
    if (!(Math.abs(ks[0]) + Math.abs(ks[4]) < 1e30) || !(this.accL + this.accR < Infinity) || this.sum !== this.sum || this.env !== this.env) {
      this.resetAll();
      oL.fill(0); if (oR !== oL) oR.fill(0);
    }
    this.reportPos += n;
    if (this.reportPos >= this.reportLen) { this.reportPos -= this.reportLen; this.report(); }
    return true;
  }
}

registerProcessor('master-bus', MasterBusProcessor);

// ----------------------------------------------------------------------------
// 'meter-bank': peak meters for many stereo inputs in one node (the mixer's channel
// strips and returns). Posts { type: 'levels', peak: Float32Array(inputs * 2) } every
// 50 ms. Unconnected inputs cost nothing.

class MeterBankProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.size = o.inputs || 16;
    this.pk = new Float32Array(this.size * 2);
    this.count = 0;
    this.reportLen = Math.round(0.05 * sampleRate);
  }

  process(inputs) {
    const pk = this.pk;
    for (let k = 0; k < inputs.length && k < this.size; k++) {
      const inp = inputs[k];
      if (!inp || !inp.length) continue;
      const l = inp[0], r = inp[1] || inp[0];
      let pl = pk[2 * k], pr = pk[2 * k + 1];
      for (let i = 0; i < l.length; i++) {
        const a = l[i] < 0 ? -l[i] : l[i]; if (a > pl) pl = a;
        const b = r[i] < 0 ? -r[i] : r[i]; if (b > pr) pr = b;
      }
      pk[2 * k] = pl; pk[2 * k + 1] = pr;
    }
    this.count += 128;
    if (this.count >= this.reportLen) {
      this.count = 0;
      const peak = pk.slice();
      this.port.postMessage({ type: 'levels', peak }, [peak.buffer]);
      pk.fill(0);
    }
    return true;
  }
}

registerProcessor('meter-bank', MeterBankProcessor);

// ----------------------------------------------------------------------------

class RecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.chunkFrames = o.chunkFrames || 8192;
    // 'int24': interleaved 24-bit little-endian PCM bytes, ready for a WAV file (stems: no
    // float buffering, no encoding on the main thread). 'float': two Float32Arrays.
    this.int24 = o.format === 'int24';
    if (this.int24) this.bytes = new Uint8Array(this.chunkFrames * 6);
    else { this.left = new Float32Array(this.chunkFrames); this.right = new Float32Array(this.chunkFrames); }
    this.fill = 0;
    this.start = -1;      // first frame to record
    this.stop = Infinity; // first frame not recorded
    this.frames = 0;
    this.done = true;
    this.port.onmessage = (e) => {
      const d = e.data;
      // Original string protocol: start on the next quantum, stop now
      if (d === 'start') this.arm(currentFrame, Infinity);
      else if (d === 'stop') this.stop = currentFrame;
      else if (d && d.type === 'start') this.arm(Math.round(d.time * sampleRate) + (d.offset | 0), Infinity);
      else if (d && d.type === 'stop') this.stop = d.time == null ? currentFrame : Math.max(this.start, Math.round(d.time * sampleRate) + (d.offset | 0));
    };
  }

  arm(start, stop) {
    this.start = start; this.stop = stop; this.fill = 0; this.frames = 0; this.done = false;
  }

  flush() {
    if (this.fill === 0) return;
    if (this.int24) {
      const b = this.bytes.slice(0, this.fill * 6);
      this.port.postMessage({ type: 'pcm', bytes: b, frames: this.fill }, [b.buffer]);
    } else {
      const l = this.left.slice(0, this.fill);
      const r = this.right.slice(0, this.fill);
      this.port.postMessage({ type: 'chunk', l, r }, [l.buffer, r.buffer]);
    }
    this.fill = 0;
  }

  /** Append frames [i, end) of l / r (null = silence) */
  put(l, r, i, end) {
    while (i < end) {
      const k = Math.min(end - i, this.chunkFrames - this.fill);
      if (this.int24) {
        const b = this.bytes;
        let o = this.fill * 6;
        for (let j = i; j < i + k; j++) {
          for (let c = 0; c < 2; c++) {
            let x = l ? (c === 0 ? l[j] : r[j]) : 0;
            if (!(x === x)) x = 0;
            x = x > 1 ? 1 : x < -1 ? -1 : x;
            const v = Math.round(x < 0 ? x * 8388608 : x * 8388607);
            b[o] = v & 255; b[o + 1] = (v >> 8) & 255; b[o + 2] = (v >> 16) & 255;
            o += 3;
          }
        }
      } else if (l) {
        this.left.set(l.subarray(i, i + k), this.fill);
        this.right.set(r.subarray(i, i + k), this.fill);
      } else {
        this.left.fill(0, this.fill, this.fill + k);
        this.right.fill(0, this.fill, this.fill + k);
      }
      this.fill += k; this.frames += k; i += k;
      if (this.fill === this.chunkFrames) this.flush();
    }
  }

  process(inputs) {
    if (this.done) return true;
    const f0 = currentFrame;
    const input = inputs[0];
    const n = 128;
    const a = Math.max(f0, this.start), b = Math.min(f0 + n, this.stop);
    if (b > a) {
      const l = input && input.length ? input[0] : null;
      const r = input && input.length ? input[1] || input[0] : null;
      this.put(l, r, a - f0, b - f0);
    }
    if (f0 + n >= this.stop) {
      this.flush();
      this.done = true;
      this.port.postMessage({ type: 'done', frames: this.frames, start: this.start });
    }
    return true;
  }
}

registerProcessor('recorder', RecorderProcessor);
