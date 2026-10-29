// ============================================================================
// Measuring the studio from inside the page (used by scripts/e2e/demos.cjs).
//
//   initScript    before any app code: skips the welcome screen, records the nodes
//                 the app connects to the AudioDestination (the master output) and
//                 catches AudioWorklet processor errors. Observes only.
//   installTap    window.__demoTap.start(ids) / stop(): one AudioWorklet node taps
//                 instrument channel strips (post-fader, before any mixer device they
//                 are routed into), a mixer device's strip ('xone96') or the master
//                 ('master'), sample-aligned. Per render quantum (128 frames) and tap
//                 it keeps the K-weighted power (BS.1770), the sample peak and, for
//                 the master and the Xone, the 4x true peak.
//   startPolling  window.__demoLog: the demo caption, the transport's bar ticks
//                 (real audio times, so a resync after a stalled page is seen), the
//                 master meter and the Xone:96 channel meters and PK! LEDs.
//   makeTap       Node side: loudness (gated, BS.1770), short-term maximum, peaks,
//                 onsets over audio-time ranges.
// ============================================================================

function initScript() {
  try { localStorage.setItem('synth-studio-welcomed', '1'); } catch (e) { /* */ }
  if (window.__demoQA) return;
  const QA = { feeds: new Set(), own: new WeakSet(), errors: [] };
  window.__demoQA = QA;
  const proto = AudioNode.prototype;
  const connect = proto.connect;
  const disconnect = proto.disconnect;
  QA.connect = (src, ...a) => connect.apply(src, a);
  proto.connect = function (dest, ...rest) {
    const r = connect.call(this, dest, ...rest);
    try { if (dest instanceof AudioDestinationNode && !QA.own.has(this)) QA.feeds.add(this); } catch (e) { /* */ }
    return r;
  };
  proto.disconnect = function (...a) {
    const r = disconnect.apply(this, a);
    try { if (!a.length || a[0] instanceof AudioDestinationNode) QA.feeds.delete(this); } catch (e) { /* */ }
    return r;
  };
  const AWN = window.AudioWorkletNode;
  if (AWN) {
    window.AudioWorkletNode = class AudioWorkletNode extends AWN {
      constructor(c, name, o) {
        super(c, name, o);
        this.addEventListener('processorerror', () => QA.errors.push(`processorerror: ${name}`));
      }
    };
  }
}

// K-weighted power, sample peak and (where asked) the 4x true peak of every input, per render quantum
const TAP_PROCESSOR = String.raw`
function kw(fs) {
  let f0 = 1681.974450955533; const G = 3.999843853973347; let Q = 0.7071752369554196;
  let K = Math.tan(Math.PI * f0 / fs); const Vh = Math.pow(10, G / 20); const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const s = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / fs); a0 = 1 + K / Q + K * K;
  const h = [1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  return s.concat(h);
}
const PH = [
  [0.0017089843750, 0.0109863281250, -0.0196533203125, 0.0332031250000, -0.0594482421875, 0.1373291015625, 0.9721679687500, -0.1022949218750, 0.0476074218750, -0.0266113281250, 0.0148925781250, -0.0083007812500],
  [-0.0291748046875, 0.0292968750000, -0.0517578125000, 0.0891113281250, -0.1665039062500, 0.4650878906250, 0.7797851562500, -0.2003173828125, 0.1015625000000, -0.0582275390625, 0.0330810546875, -0.0189208984375],
  [-0.0189208984375, 0.0330810546875, -0.0582275390625, 0.1015625000000, -0.2003173828125, 0.7797851562500, 0.4650878906250, -0.1665039062500, 0.0891113281250, -0.0517578125000, 0.0292968750000, -0.0291748046875],
  [-0.0083007812500, 0.0148925781250, -0.0266113281250, 0.0476074218750, -0.1022949218750, 0.9721679687500, 0.1373291015625, -0.0594482421875, 0.0332031250000, -0.0196533203125, 0.0109863281250, 0.0017089843750],
];
class DemoTap extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.n = options.numberOfInputs;
    this.tp = o.tp || [];
    this.c = kw(sampleRate);
    this.z = new Float64Array(this.n * 2 * 4);
    this.h = new Float64Array(this.n * 2 * 12);
    this.B = 172;
    this.on = false;
    this.alloc();
    this.port.onmessage = e => {
      const m = e.data || {};
      if (m.type === 'start') { this.on = true; this.alloc(); this.port.postMessage({ type: 'started', frame: currentFrame, time: currentTime }); }
      if (m.type === 'stop') { this.flush(); this.on = false; this.port.postMessage({ type: 'stopped', frame: currentFrame }); }
    };
  }
  alloc() { this.pw = new Float32Array(this.n * this.B); this.pk = new Float32Array(this.n * this.B); this.tq = new Float32Array(this.n * this.B); this.fill = 0; }
  flush() {
    if (!this.fill) return;
    this.port.postMessage({ type: 'q', fill: this.fill, pw: this.pw, pk: this.pk, tq: this.tq }, [this.pw.buffer, this.pk.buffer, this.tq.buffer]);
    this.alloc();
  }
  process(inputs) {
    if (!this.on) return true;
    const c = this.c;
    for (let i = 0; i < this.n; i++) {
      const inp = inputs[i];
      let pw = 0, pk = 0, tp = 0;
      if (inp && inp.length) {
        for (let ch = 0; ch < 2; ch++) {
          const x = inp[ch] || inp[0];
          const zo = (i * 2 + ch) * 4, ho = (i * 2 + ch) * 12;
          let a1 = this.z[zo], a2 = this.z[zo + 1], b1 = this.z[zo + 2], b2 = this.z[zo + 3];
          const h = this.h, doTp = this.tp[i];
          for (let k = 0; k < x.length; k++) {
            const xn = x[k];
            const ax = xn < 0 ? -xn : xn;
            if (ax > pk) pk = ax;
            const y1 = c[0] * xn + a1; a1 = c[1] * xn - c[3] * y1 + a2; a2 = c[2] * xn - c[4] * y1;
            const y2 = c[5] * y1 + b1; b1 = c[6] * y1 - c[8] * y2 + b2; b2 = c[7] * y1 - c[9] * y2;
            pw += y2 * y2;
            if (doTp) {
              for (let m = 11; m > 0; m--) h[ho + m] = h[ho + m - 1];
              h[ho] = xn;
              for (let p = 0; p < 4; p++) {
                const f = PH[p];
                let acc = 0;
                for (let m = 0; m < 12; m++) acc += f[m] * h[ho + m];
                const aa = acc < 0 ? -acc : acc;
                if (aa > tp) tp = aa;
              }
            }
          }
          this.z[zo] = a1; this.z[zo + 1] = a2; this.z[zo + 2] = b1; this.z[zo + 3] = b2;
        }
      }
      const q = i * this.B + this.fill;
      this.pw[q] = pw; this.pk[q] = pk; this.tq[q] = Math.max(tp, pk);
    }
    if (++this.fill >= this.B) this.flush();
    return true;
  }
}
registerProcessor('demo-tap', DemoTap);
`;

/** Install window.__demoTap: taps on strip outputs ('<instance>'), a mixer device's output ('xone96'), the master ('master') */
async function installTap(page) {
  await page.evaluate(async src => {
    if (window.__demoTap) return;
    const S = window.__synthStudio;
    const ctx = S.audio.getAudioContext();
    const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    await ctx.audioWorklet.addModule(url);
    window.__demoTap = {
      start(ids) {
        const QA = window.__demoQA;
        const n = ids.length;
        const node = new AudioWorkletNode(ctx, 'demo-tap', {
          numberOfInputs: n, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers',
          processorOptions: { tp: ids.map(id => id === 'master' || id === 'xone96') },
        });
        QA.own.add(node);
        const sink = ctx.createGain();
        sink.gain.value = 0;
        QA.own.add(sink);
        node.connect(sink);
        QA.connect(sink, ctx.destination);
        const st = { ids, n, chunks: [], started: null, node, sink };
        ids.forEach((id, i) => {
          if (id === 'master') QA.feeds.forEach(f => { try { f.connect(node, 0, i); } catch (e) { /* */ } });
          else { const o = S.hub.getStripOutput(id); if (o) o.connect(node, 0, i); }
        });
        node.port.onmessage = e => {
          const m = e.data;
          if (m.type === 'started') st.started = { frame: m.frame, time: m.time };
          if (m.type === 'q') st.chunks.push(m);
        };
        node.port.postMessage({ type: 'start' });
        this.cur = st;
        return true;
      },
      async stop() {
        const st = this.cur;
        st.node.port.postMessage({ type: 'stop' });
        await new Promise(r => setTimeout(r, 300));
        try { st.node.disconnect(); st.sink.disconnect(); } catch (e) { /* */ }
        const total = st.chunks.reduce((a, c) => a + c.fill, 0);
        const enc = f => { const u = new Uint8Array(f.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
        const out = st.ids.map((id, i) => {
          const pw = new Float32Array(total), pk = new Float32Array(total), tq = new Float32Array(total);
          let o = 0;
          st.chunks.forEach(c => { const B = c.pw.length / st.n; for (let k = 0; k < c.fill; k++) { pw[o + k] = c.pw[i * B + k]; pk[o + k] = c.pk[i * B + k]; tq[o + k] = c.tq[i * B + k]; } o += c.fill; });
          return { id, pw: enc(pw), pk: enc(pk), tq: enc(tq) };
        });
        this.cur = null;
        return { started: st.started, sampleRate: ctx.sampleRate, quanta: total, taps: out };
      },
    };
  }, TAP_PROCESSOR);
}

/** Poll the app while it plays: captions, bar ticks, the master meter, the Xone's meters, the transport */
async function startPolling(page) {
  await page.evaluate(() => {
    const S = window.__synthStudio;
    const ctx = S.audio.getAudioContext();
    const log = { captions: [], bars: [], meter: { tp: 0, gr: 0, inPeak: 0, i: null }, xone: {}, starts: [], stops: [] };
    window.__demoLog = log;
    let lastCap = null;
    const offEvent = S.transport.onEvent(e => {
      if (e.type === 'start') log.starts.push(e.time);
      if (e.type === 'stop') log.stops.push({ at: ctx.currentTime, time: e.time });
    });
    // bar ticks: [0-based bar, audio time]
    const offTick = S.transport.onTick(t => { if (t.tick % 96 === 0) log.bars.push([t.bar, t.time]); });
    let lastFrame = null;
    const poll = setInterval(() => {
      const el = document.querySelector('[data-demo-caption]');
      const cap = el ? el.getAttribute('data-demo-caption') : null;
      if (cap !== lastCap) { log.captions.push({ t: ctx.currentTime, id: cap }); lastCap = cap; }
      const f = S.audio.getLastMasterMeter();
      if (f && f !== lastFrame && S.transport.playing) {
        lastFrame = f;
        log.meter.tp = Math.max(log.meter.tp, f.tp || 0);
        log.meter.gr = Math.max(log.meter.gr, f.gr || 0);
        log.meter.inPeak = Math.max(log.meter.inPeak, f.inPeak || 0);
        if (f.i !== null && f.i !== undefined) log.meter.i = f.i;
      }
      const x = S.hub.getEngine('xone96');
      if (x && x.meterSnapshot) {
        const ms = x.meterSnapshot().meters;
        for (const k in ms) {
          const m = log.xone[k] ?? (log.xone[k] = { max: -120, pk: 0 });
          m.max = Math.max(m.max, ms[k].db);
          if (ms[k].pk) m.pk++;
        }
      }
    }, 40);
    window.__demoStopPolling = () => { clearInterval(poll); offEvent(); offTick(); return log; };
  });
}

// ---------------------------------------------------------------------------
// Node side
// ---------------------------------------------------------------------------

const dec = b64 => { const buf = Buffer.from(b64, 'base64'); return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4); };
const lufsOf = p => (p > 0 ? -0.691 + 10 * Math.log10(p) : -Infinity);
const db = a => (a > 0 ? 20 * Math.log10(a) : -Infinity);
const r1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

function makeTap(t, sr, t0Audio) {
  const pw = dec(t.pw), pk = dec(t.pk), tq = dec(t.tq);
  const Q = 128;
  const qAt = time => Math.max(0, Math.min(pw.length, Math.round(((time - t0Audio) * sr) / Q)));
  const timeOf = q => t0Audio + (q * Q) / sr;
  return {
    id: t.id, pw, pk, tq, qAt, timeOf,
    /** Integrated loudness (BS.1770 gating) over [a, b) seconds of audio time */
    lufs(a, b) {
      const qa = qAt(a), qb = qAt(b);
      const block = Math.round((0.4 * sr) / Q), hop = Math.max(1, Math.round((0.1 * sr) / Q));
      const blocks = [];
      for (let s = qa; s + block <= qb; s += hop) { let sum = 0; for (let k = s; k < s + block; k++) sum += pw[k]; blocks.push(sum / (block * Q)); }
      const abs = blocks.filter(p => lufsOf(p) > -70);
      if (!abs.length) return -Infinity;
      const rel = lufsOf(abs.reduce((x, y) => x + y, 0) / abs.length) - 10;
      const g = abs.filter(p => lufsOf(p) > rel);
      return g.length ? lufsOf(g.reduce((x, y) => x + y, 0) / g.length) : -Infinity;
    },
    /** Max short-term (3 s) loudness over [a, b) */
    shortTermMax(a, b) {
      const qa = qAt(a), qb = qAt(b), len = Math.round((3 * sr) / Q), hop = Math.round((0.1 * sr) / Q);
      let best = 0;
      for (let s = qa; s + len <= qb; s += hop) { let sum = 0; for (let k = s; k < s + len; k++) sum += pw[k]; best = Math.max(best, sum / (len * Q)); }
      return lufsOf(best);
    },
    peak(a, b) { let m = 0; for (let k = qAt(a); k < qAt(b); k++) m = Math.max(m, pk[k]); return m; },
    truePeak(a, b) { let m = 0; for (let k = qAt(a); k < qAt(b); k++) m = Math.max(m, tq[k]); return m; },
    /** Mean power over [a, b) */
    meanPower(a, b) { const qa = qAt(a), qb = qAt(b); let s = 0; for (let k = qa; k < qb; k++) s += pw[k]; return qb > qa ? s / ((qb - qa) * Q) : 0; },
    /** First quantum after `from` with sound, when the 50 ms before `from` were silent (an entry), as audio time */
    entryAfter(from, until) {
      const qa = qAt(from), qb = qAt(until);
      for (let k = qa; k < qb; k++) if (pw[k] / Q > 1e-9) return timeOf(k);
      return null;
    },
    /**
     * A hit near `at`: the largest jump in power within [at - 10 ms, at + 25 ms] over the mean of the
     * 60 ms before it, in dB, and when it happens (ms from `at`)
     */
    hitAt(at) {
      const qT = qAt(at);
      const per = (0.001 * sr) / Q;
      const a0 = Math.max(0, Math.round(qT - 60 * per)), a1 = Math.max(0, Math.round(qT - 12 * per));
      let pre = 0; for (let k = a0; k < a1; k++) pre += pw[k];
      pre = Math.max(1e-12, pre / Math.max(1, a1 - a0));
      let best = -Infinity, bq = qT;
      for (let k = Math.round(qT - 10 * per); k <= Math.round(qT + 25 * per); k++) {
        if (k < 0 || k >= pw.length) continue;
        const r = pw[k] / pre;
        if (r > best) { best = r; bq = k; }
      }
      return { db: r1(10 * Math.log10(best)), ms: Math.round((timeOf(bq) - at) * 1000) };
    },
  };
}

module.exports = { initScript, TAP_PROCESSOR, installTap, startPolling, makeTap, dec, lufsOf, db, r1 };
