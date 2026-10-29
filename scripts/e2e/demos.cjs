// ============================================================================
// Demo tracks: load each one from the Demo tracks section, play it from bar 1
// to the end with the studio ▶, and bounce it.
//   node scripts/e2e/demos.cjs <baseUrl> [--demo low-tide-lights,copper-wire] [--out <dir>]
//                              [--no-bounce] [--parts] [--bars N] [--headed]
//
// Per demo it checks that:
//   - the demo loads (rack, routes, sync, tempo, song sections) and every engine starts
//   - every instrument makes sound, and none clips (instrument outputs < 0 dBFS, no Xone PK!)
//   - the song plays through its sections; section changes land on bar lines: the caption
//     follows the arranger, the kick grid stays on the beat across changes, and an instrument
//     the arranger unmutes comes in exactly on its section's first bar line
//   - the transport stops by itself at the end of the song (song mode on, loop off)
//   - the master integrated loudness is near the demo's target, with no true peak over -1 dBTP
//   - the bounce downloads a WAV whose length is the song plus its tails
// --parts also measures parts against each other in the busiest section (kick vs bass ...).
// --bars N plays only the first N bars (a quick run; the loudness check is skipped).
// Prints one JSON object (the last line) and exits 1 if a check fails.
// ============================================================================
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const base = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a) && !args[args.indexOf(a) - 1]?.match(/^--(demo|out|bars)$/)) ?? 'http://localhost:3000';
const opt = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const DEMO_IDS = (opt('demo') ?? 'low-tide-lights,three-clocks,copper-wire').split(',');
const outDir = path.resolve(opt('out') ?? fs.mkdtempSync('/tmp/synth-demos-'));
const BOUNCE = !args.includes('--no-bounce');
const PARTS = args.includes('--parts');
const MAX_BARS = opt('bars') ? Number(opt('bars')) : 0;
fs.mkdirSync(outDir, { recursive: true });

// What each demo is expected to be (the design's numbers; lib/studio/demos/meta.ts)
const EXPECT = {
  'low-tide-lights': {
    title: 'Low Tide Lights', bpm: 124, bars: 80, lufs: -10.5, rack: ['studio-clock', 'analog-rytm', 'analog-four', 'xone96'],
    sections: [8, 8, 16, 8, 4, 4, 16, 8, 8],
    kick: { instance: 'analog-rytm', track: 0 },
    // the A4 is muted in the intro: its bass comes in on bar 9, first note on step 3
    entries: [{ instance: 'analog-four', bar: 9, step: 3 }],
    parts: { section: 6, solos: [
      { name: 'kick', instance: 'analog-rytm', tracks: [0] },
      { name: 'bass', instance: 'analog-four', tracks: [0] },
      { name: 'stabs', instance: 'analog-four', tracks: [1, 2] },
      { name: 'hook', instance: 'analog-four', tracks: [3] },
      { name: 'clap', instance: 'analog-rytm', tracks: [3] },
      { name: 'hats', instance: 'analog-rytm', tracks: [8, 9] },
    ] },
  },
  'three-clocks': {
    title: 'Three Clocks', bpm: 110, bars: 72, lufs: -13, rack: ['studio-clock', 'dfam', 'mother32', 'subharmonicon', 'xone96'],
    sections: [8, 8, 16, 8, 8, 16, 8],
    kick: { instance: 'dfam' },
    // the DFAM is muted in CLOCKWORK and its kick lands on bar 9; the bass comes in on bar 17
    entries: [{ instance: 'dfam', bar: 9, step: 1 }, { instance: 'mother32', bar: 17, step: 1 }],
    parts: { section: 5, solos: [
      { name: 'dfam', instance: 'dfam' }, { name: 'bass (Mother-32)', instance: 'mother32' }, { name: 'Subharmonicon', instance: 'subharmonicon' },
    ] },
  },
  'copper-wire': {
    title: 'Copper Wire', bpm: 122, bars: 80, lufs: -11, rack: ['analog-rytm', 'sub37', 'xone96'],
    sections: [8, 16, 8, 16, 8, 16, 8],
    kick: { instance: 'analog-rytm', track: 0 },
    // the Sub 37 is muted in the intro: the bassline comes in on bar 9, first note on step 3
    entries: [{ instance: 'sub37', bar: 9, step: 3 }],
    parts: { section: 5, solos: [
      { name: 'kick', instance: 'analog-rytm', tracks: [0] },
      { name: 'bass', instance: 'sub37' },
      { name: 'snare + clap', instance: 'analog-rytm', tracks: [1, 3] },
      { name: 'zaps', instance: 'analog-rytm', tracks: [2] },
      { name: 'hats', instance: 'analog-rytm', tracks: [8, 9] },
    ] },
  },
};

// ---------------------------------------------------------------------------
// In the page
// ---------------------------------------------------------------------------

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

/** Install window.__demoTap: taps on strip outputs ('id'), the Xone's output, and the master ('master') */
async function installTap(page) {
  await page.evaluate(async src => {
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
        // per input: Float32 arrays of power / peak / true peak, base64
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

/** Poll the app while it plays: captions, the master meter, the Xone's meters, the transport */
async function startPolling(page) {
  await page.evaluate(() => {
    const S = window.__synthStudio;
    const ctx = S.audio.getAudioContext();
    const log = { captions: [], meter: { tp: 0, gr: 0, inPeak: 0, i: null }, xone: {}, starts: [], stops: [] };
    window.__demoLog = log;
    let lastCap = null;
    S.transport.onEvent(e => { if (e.type === 'start') log.starts.push(e.time); if (e.type === 'stop') log.stops.push({ at: ctx.currentTime, time: e.time }); });
    let lastFrame = null;
    window.__demoPoll = setInterval(() => {
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
  });
}

// ---------------------------------------------------------------------------
// Analysis (Node)
// ---------------------------------------------------------------------------

const dec = b64 => { const buf = Buffer.from(b64, 'base64'); return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4); };
const lufsOf = p => (p > 0 ? -0.691 + 10 * Math.log10(p) : -Infinity);
const db = a => (a > 0 ? 20 * Math.log10(a) : -Infinity);
const r1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

function makeTap(t, sr, t0Audio) {
  const pw = dec(t.pw), pk = dec(t.pk), tq = dec(t.tq);
  const Q = 128;
  const qAt = time => Math.max(0, Math.min(pw.length, Math.round(((time - t0Audio) * sr) / Q)));
  return {
    id: t.id, pw, pk, tq, qAt,
    timeOf: q => t0Audio + (q * Q) / sr,
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
    /** Mean power (unweighted by gating) over [a, b): for "is it making sound" */
    meanPower(a, b) { const qa = qAt(a), qb = qAt(b); let s = 0; for (let k = qa; k < qb; k++) s += pw[k]; return qb > qa ? s / ((qb - qa) * Q) : 0; },
    /** First quantum after `from` whose power rises 12 dB over the quiet before it (an onset), as audio time */
    onsetAfter(from, until) {
      const qa = qAt(from), qb = qAt(until);
      const floor = Math.max(1e-12, ...Array.from(pw.subarray(Math.max(0, qa - 8), qa)));
      for (let k = qa; k < qb; k++) if (pw[k] > floor * 16 && pw[k] / Q > 1e-8) return this.timeOf(k);
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

(async () => {
  const browser = await chromium.launch({ headless: !args.includes('--headed'), args: ['--autoplay-policy=no-user-gesture-required'] });
  const report = { base, demos: {} };
  const failures = [];
  const check = (demo, name, ok, detail) => {
    const d = report.demos[demo] ?? (report.demos[demo] = { checks: [] });
    d.checks.push({ name, ok: !!ok, detail });
    if (!ok) failures.push(`${demo}: ${name}`);
    console.error(`${ok ? 'PASS' : 'FAIL'}  ${demo}: ${name}${detail !== undefined ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`);
  };

  for (const id of DEMO_IDS) {
    const exp = EXPECT[id];
    if (!exp) { failures.push(`unknown demo ${id}`); continue; }
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.addInitScript(initScript);
    const R = report.demos[id] = { checks: [] };
    try {
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await page.getByRole('button', { name: /tap for sound/i }).click().catch(() => page.mouse.click(4, 4));
      await page.getByRole('button', { name: /Studio/ }).first().click();
      await page.getByText('Opening the studio…').waitFor({ state: 'detached', timeout: 20000 }).catch(() => undefined);
      await page.getByRole('button', { name: `Load the demo track ${exp.title}` }).click();
      await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^(Load ${exp.title}|Replace without saving)$`) }).click();
      // every engine running
      const ready = await page.waitForFunction(rack => {
        const S = window.__synthStudio;
        const st = S.store.getState().studio;
        return S.hub.status === 'on' && st.rack.length === rack.length && rack.every(r => st.rack.some(x => x.id === r)) && st.rack.every(r => !!S.hub.getStripOutput(r.id));
      }, exp.rack, { timeout: 30000 }).then(() => true).catch(() => false);
      const st = await page.evaluate(() => {
        const s = window.__synthStudio.store.getState().studio;
        return { rack: s.rack.map(r => r.id), routes: s.routes, sync: s.sync, bpm: s.bpm, swing: s.swing, cables: s.cables.length, sections: s.arrangement.sections.map(x => x.bars), enabled: s.arrangement.enabled, loop: s.arrangement.loop };
      });
      check(id, 'loads: every engine starts', ready, st.rack);
      check(id, 'loads: tempo, song and routing', st.bpm === exp.bpm && st.enabled && !st.loop && JSON.stringify(st.sections) === JSON.stringify(exp.sections) && Object.keys(st.routes).length >= 2,
        { bpm: st.bpm, sections: st.sections, routes: st.routes });
      await page.screenshot({ path: path.join(outDir, `${id}-loaded.png`) });
      await page.waitForTimeout(1500);

      await installTap(page);
      await startPolling(page);
      const audible = exp.rack.filter(r => r !== 'studio-clock');
      const taps = [...audible, 'master'];
      await page.evaluate(ids => window.__demoTap.start(ids), taps);
      await page.waitForTimeout(400);

      // ▶ the studio transport, from bar 1
      await page.getByRole('button', { name: 'Play studio' }).click();
      const barDur = 240 / exp.bpm;
      const bars = MAX_BARS || exp.bars;
      const songDur = bars * barDur;
      if (MAX_BARS) {
        await page.waitForTimeout(songDur * 1000 + 300);
        await page.getByRole('button', { name: 'Stop studio' }).click();
        await page.waitForTimeout(3000);
      } else {
        // the song stops by itself on its last bar line; wait for it plus the tails
        await page.waitForFunction(() => window.__demoLog.stops.length > 0, null, { timeout: (songDur + 30) * 1000 }).catch(() => undefined);
        await page.waitForTimeout(4500);
      }
      const cap = await page.evaluate(() => window.__demoTap.stop());
      const log = await page.evaluate(() => { clearInterval(window.__demoPoll); return window.__demoLog; });
      await page.screenshot({ path: path.join(outDir, `${id}-played.png`) });

      const t0 = log.starts[0];
      const sr = cap.sampleRate;
      const T = Object.fromEntries(cap.taps.map(t => [t.id, makeTap(t, sr, cap.started.time)]));
      const barT = b => t0 + (b - 1) * barDur;   // audio time of bar b's first beat (1-based)
      const end = t0 + songDur;

      // sections from the arrangement: [startBar, bars]
      const secs = [];
      exp.sections.reduce((b, n) => { secs.push({ start: b, bars: n }); return b + n; }, 1);
      const inSong = secs.filter(s => s.start <= bars);

      // every instrument makes sound, and nothing clips at an instrument's output
      const sound = {};
      for (const inst of audible) {
        const tp = T[inst];
        let best = -Infinity;
        inSong.forEach(s => { best = Math.max(best, tp.lufs(barT(s.start), Math.min(end, barT(s.start + s.bars)))); });
        sound[inst] = { lufs: r1(best), peakDb: r1(db(tp.peak(t0, end + 2))) };
      }
      check(id, 'every instrument makes sound', audible.every(i => sound[i].lufs > -45), sound);
      check(id, 'nothing clips at an instrument output (< 0 dBFS)', audible.filter(i => i !== 'xone96').every(i => sound[i].peakDb < 0), sound);
      const pkLit = Object.entries(log.xone).filter(([k, m]) => m.pk > 0 && /^[1-4ab]$/.test(k)).map(([k]) => k);
      check(id, 'no Xone channel PK! lit', pkLit.length === 0, { pk: pkLit, maxDbu: Object.fromEntries(Object.entries(log.xone).map(([k, m]) => [k, r1(m.max)])) });

      // the captions follow the arranger: each section's note appears within 0.4 s of its first bar line
      const sectionIds = await page.evaluate(() => window.__synthStudio.store.getState().studio.arrangement.sections.map(s => s.id));
      const capOk = inSong.map((s, i) => {
        const tStart = barT(s.start);
        const c = log.captions.find(x => x.id === sectionIds[i] && x.t >= tStart - 0.15);
        return c ? Math.round((c.t - tStart) * 1000) : null;
      });
      check(id, 'the song plays through its sections (caption ms after each bar line)', capOk.every(v => v !== null && v >= -150 && v < 400), capOk);

      // the kick grid holds through every section change: an onset on each section's first beat
      const k = exp.kick;
      const kickOn = inSong.map(s => {
        const tb = barT(s.start);
        const on = T[k.instance].onsetAfter(tb - 0.02, tb + barDur);
        return on === null ? null : Math.round((on - tb) * 1000);
      });
      R.kickOnsetMs = kickOn;
      // an instrument the arranger unmutes comes in on its section's bar line (its first note on its step)
      const stepDur = barDur / 16;
      const entries = exp.entries.filter(e => e.bar <= bars).map(e => {
        const tb = barT(e.bar) + (e.step - 1) * stepDur;
        const before = T[e.instance].meanPower(barT(e.bar) - 1.0, barT(e.bar) - 0.02);
        const on = T[e.instance].onsetAfter(barT(e.bar) - 0.02, barT(e.bar) + barDur);
        return { instance: e.instance, bar: e.bar, silentBefore: lufsOf(before) < -60, onsetMs: on === null ? null : Math.round((on - tb) * 1000) };
      });
      check(id, 'unmuted parts enter on their section\'s bar line', entries.every(e => e.silentBefore && e.onsetMs !== null && Math.abs(e.onsetMs) <= 12), entries);

      // the transport stops by itself at the end of the song
      if (!MAX_BARS) {
        const stop = log.stops[0];
        check(id, 'the song stops on its last bar line', !!stop && Math.abs(stop.time - end) < 0.05, stop ? { stopMs: Math.round((stop.time - end) * 1000) } : 'no stop');
        const mi = T.master.lufs(t0, end + 3);
        const tp = db(T.master.truePeak(t0, end + 4));
        R.master = { integrated: r1(mi), appMeterIntegrated: r1(log.meter.i), truePeakDbtp: r1(tp), maxGainReductionDb: r1(log.meter.gr), preLimiterPeakDb: r1(db(log.meter.inPeak)), shortTermMax: r1(T.master.shortTermMax(t0, end)) };
        check(id, `master loudness near ${exp.lufs} LUFS`, Math.abs(mi - exp.lufs) <= 1.0, R.master);
        check(id, 'no overs: true peak <= -1.0 dBTP', tp <= -0.95, r1(tp));
        // per section loudness (energy curve)
        R.sectionLufs = inSong.map(s => r1(T.master.lufs(barT(s.start), barT(s.start + s.bars))));
      }
      check(id, 'no page errors', errs.length === 0 && (await page.evaluate(() => window.__demoQA.errors)).length === 0, errs.slice(0, 5));

      // ---- parts against each other (solo instruments / Elektron tracks in the busiest section) ----
      if (PARTS && exp.parts) {
        const sec = secs[exp.parts.section];
        const levels = {};
        for (const solo of exp.parts.solos) {
          const pre = await page.evaluate(({ solo, sec, all }) => {
            const S = window.__synthStudio;
            // mute every other instrument at its strip (like the arranger does), solo Elektron tracks
            all.forEach(i => S.hub.setMuted(i, i !== solo.instance));
            if (solo.tracks) solo.tracks.forEach((t, n) => S.hub.event(solo.instance, 'seq:solo', { track: t, on: true }));
            S.hub.startAll({ fromTick: (sec.start - 1) * 96, countIn: false });
            return true;
          }, { solo, sec, all: audible.filter(i => i !== 'xone96') });
          void pre;
          await page.evaluate(ids => window.__demoTap.start(ids), ['xone96']);
          const t = await page.evaluate(() => window.__synthStudio.audio.getAudioContext().currentTime);
          const dur = Math.min(sec.bars, 8) * barDur;
          await page.waitForTimeout(dur * 1000 + 300);
          const c2 = await page.evaluate(() => window.__demoTap.stop());
          await page.evaluate(({ solo }) => {
            const S = window.__synthStudio;
            S.hub.stopAll();
            if (solo.tracks) solo.tracks.forEach(t => S.hub.event(solo.instance, 'seq:solo', { track: t, on: false }));
          }, { solo });
          const tap = makeTap(c2.taps[0], c2.sampleRate, c2.started.time);
          levels[solo.name] = { lufs: r1(tap.lufs(t + 0.5, t + dur)), shortTerm: r1(tap.shortTermMax(t + 0.5, t + dur)), peakDb: r1(db(tap.peak(t + 0.5, t + dur))) };
          await page.waitForTimeout(1500);
        }
        await page.evaluate(all => all.forEach(i => window.__synthStudio.hub.setMuted(i, false)), audible);
        const ref = levels[exp.parts.solos[0].name].shortTerm;
        R.parts = Object.fromEntries(Object.entries(levels).map(([n, v]) => [n, { ...v, vsFirst: r1(v.shortTerm - ref) }]));
        console.error(`parts ${id}: ${JSON.stringify(R.parts)}`);
      }

      // ---- bounce: the song from bar 1 plus its tails, to WAV ----
      if (BOUNCE && !MAX_BARS) {
        await page.getByRole('button', { name: /Bounce…/ }).click();
        const dl = page.waitForEvent('download', { timeout: (songDur + 60) * 1000 });
        await page.getByRole('dialog').getByRole('button', { name: /^Bounce$/ }).click();
        const download = await dl;
        const file = path.join(outDir, `${id}.wav`);
        await download.saveAs(file);
        const wav = fs.readFileSync(file);
        const channels = wav.readUInt16LE(22), rate = wav.readUInt32LE(24), bits = wav.readUInt16LE(34);
        let off = 12, dataBytes = 0;
        while (off < wav.length - 8) { const tag = wav.toString('ascii', off, off + 4); const size = wav.readUInt32LE(off + 4); if (tag === 'data') { dataBytes = size; break; } off += 8 + size; }
        const seconds = dataBytes / (channels * (bits / 8)) / rate;
        const status = await page.getByRole('dialog').getByRole('status').innerText().catch(() => '');
        R.bounce = { seconds: r1(seconds), songSeconds: r1(songDur), rate, bits, channels, dialog: status.replace(/\s+/g, ' ').slice(0, 200) };
        check(id, 'the bounce is a WAV of the song plus its tails', seconds >= songDur + 0.4 && seconds <= songDur + 13, R.bounce);
        const m = /(-?\d+\.\d) LUFS integrated, true peak (-?\d+\.\d) dBTP/.exec(status);
        if (m) {
          R.bounce.lufs = Number(m[1]);
          R.bounce.truePeak = Number(m[2]);
          check(id, 'the bounce meets the loudness target with no overs', Math.abs(R.bounce.lufs - exp.lufs) <= 1.0 && R.bounce.truePeak <= -0.95, { lufs: R.bounce.lufs, truePeak: R.bounce.truePeak });
        }
      }
      R.sound = sound;
      R.captionsMs = capOk;
    } catch (e) {
      check(id, 'runs', false, String(e).split('\n')[0]);
    }
    await ctx.close();
  }
  await browser.close();
  report.ok = failures.length === 0;
  report.failures = failures;
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  process.exit(failures.length ? 1 : 0);
})();
