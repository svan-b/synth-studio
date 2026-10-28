'use strict';
// ============================================================================
// Audio QA - code that runs inside the app page.
//
//   initScript   (context.addInitScript, before any app code)
//     - skips the welcome screen and seeds a studio with only the device
//     - records every node the app connects to the AudioDestination (the master
//       output feeds) by wrapping AudioNode.prototype.connect/disconnect
//     - listens for 'processorerror' on every AudioWorkletNode the app creates
//     - optionally forces the AudioContext sample rate
//   CAPTURE_PROCESSOR  AudioWorklet source (loaded from a Blob URL): input 0 =
//     the instrument's own output (hub slot outGain), input 1 = the master
//     output feeds. Sample-aligned, chunked to the main thread, with frame-exact
//     marks and a level meter used to wait for silence between presets.
//   pageLib      installs window.__qa: setup / reset / waitQuiet / capture /
//     applyFallback / verify, driven by scripts/audio-qa.cjs.
// Nothing here changes what the app does: the wrappers only observe.
// ============================================================================

function initScript(cfg) {
  try { localStorage.setItem('synth-studio-welcomed', '1'); } catch (e) { /* private mode */ }
  try {
    if (cfg.device && !sessionStorage.getItem('audio-qa-seeded')) {
      localStorage.setItem('synth-studio-storage', JSON.stringify({
        state: {
          currentDevice: cfg.device, devices: {}, completedLessons: [], review: {}, focusMode: true,
          studio: {
            rack: [{ id: cfg.device, device: cfg.device }], cables: [], routes: {}, sync: {}, bpm: cfg.bpm || 120, swing: 0,
            arrangement: { enabled: false, loop: true, sections: [] },
          },
        },
        version: cfg.storeVersion,
      }));
      sessionStorage.setItem('audio-qa-seeded', '1');
    }
  } catch (e) { /* ignore */ }

  if (window.__audioQA) return;
  const QA = {
    feeds: new Set(), qaNodes: new WeakSet(), errors: [], stateLog: [], contexts: [], workletNodes: 0,
    OrigAudioWorkletNode: window.AudioWorkletNode,
  };
  window.__audioQA = QA;

  const proto = AudioNode.prototype;
  const origConnect = proto.connect;
  const origDisconnect = proto.disconnect;
  QA.connect = (src, ...args) => origConnect.apply(src, args);
  QA.disconnect = (src, ...args) => origDisconnect.apply(src, args);
  proto.connect = function connect(dest, ...rest) {
    const r = origConnect.call(this, dest, ...rest);
    try { if (dest instanceof AudioDestinationNode && !QA.qaNodes.has(this)) QA.feeds.add(this); } catch (e) { /* observe only */ }
    return r;
  };
  proto.disconnect = function disconnect(...args) {
    const r = origDisconnect.apply(this, args);
    try {
      if (!args.length || typeof args[0] === 'number' || args[0] instanceof AudioDestinationNode) QA.feeds.delete(this);
    } catch (e) { /* observe only */ }
    return r;
  };

  const AWN = window.AudioWorkletNode;
  if (AWN) {
    const Wrapped = class AudioWorkletNode extends AWN {
      constructor(context, name, options) {
        super(context, name, options);
        QA.workletNodes++;
        this.addEventListener('processorerror', ev => {
          QA.errors.push({ kind: 'processorerror', processor: String(name), message: (ev && ev.message) || `AudioWorklet processor '${name}' threw and went silent`, at: context.currentTime });
        });
      }
    };
    window.AudioWorkletNode = Wrapped;
  }

  const AC = window.AudioContext;
  if (AC) {
    const WrappedAC = class AudioContext extends AC {
      constructor(options) {
        const o = Object.assign({}, options || {});
        if (cfg.sampleRate) o.sampleRate = cfg.sampleRate;
        super(o);
        QA.contexts.push(this);
        this.addEventListener('statechange', () => QA.stateLog.push({ state: this.state, at: this.currentTime, wall: performance.now() }));
      }
    };
    window.AudioContext = WrappedAC;
    if (window.webkitAudioContext) window.webkitAudioContext = WrappedAC;
  }
}

// AudioWorklet capture processor (source text, loaded from a Blob URL)
const CAPTURE_PROCESSOR = String.raw`
class AudioQACapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.nIn = (options && options.numberOfInputs) || 2;
    this.chunkFrames = o.chunkFrames || 16384;
    this.meterQuanta = o.meterQuanta || 8;
    this.rec = false;
    this.fill = 0;
    this.total = 0;
    this.q = 0;
    this.peak = new Float32Array(this.nIn);
    this.resetStats();
    this.port.onmessage = e => {
      const m = e.data || {};
      if (m.type === 'start') {
        this.bufs = [];
        for (let i = 0; i < this.nIn; i++) this.bufs.push([new Float32Array(this.chunkFrames), new Float32Array(this.chunkFrames)]);
        this.fill = 0;
        this.total = 0;
        this.resetStats();
        this.rec = true;
        this.port.postMessage({ type: 'started', frame: currentFrame, time: currentTime });
      } else if (m.type === 'mark') {
        this.port.postMessage({ type: 'mark', name: m.name, frame: this.total, at: currentFrame });
      } else if (m.type === 'stop') {
        this.flush();
        this.rec = false;
        this.port.postMessage({ type: 'done', frames: this.total, layout: this.layout, nonFinite: this.nonFinite });
      }
    };
  }
  resetStats() {
    this.layout = [];
    this.nonFinite = [];
    for (let i = 0; i < this.nIn; i++) { this.layout.push([0, 0, 0]); this.nonFinite.push(0); }
  }
  flush() {
    if (!this.fill || !this.bufs) return;
    const data = [];
    const transfer = [];
    for (let i = 0; i < this.nIn; i++) {
      const l = this.bufs[i][0].slice(0, this.fill);
      const r = this.bufs[i][1].slice(0, this.fill);
      data.push([l, r]);
      transfer.push(l.buffer, r.buffer);
    }
    this.port.postMessage({ type: 'chunk', data, frames: this.fill }, transfer);
    this.fill = 0;
  }
  process(inputs, outputs) {
    let n = 128;
    if (outputs[0] && outputs[0][0]) n = outputs[0][0].length;
    for (let i = 0; i < this.nIn; i++) {
      const inp = inputs[i] || [];
      const ch = inp.length;
      const L = ch ? inp[0] : null;
      const R = ch > 1 ? inp[1] : L;
      let p = this.peak[i];
      if (L) {
        for (let k = 0; k < L.length; k++) { const a = Math.abs(L[k]); if (a > p) p = a; }
        if (R !== L) for (let k = 0; k < R.length; k++) { const a = Math.abs(R[k]); if (a > p) p = a; }
      }
      this.peak[i] = p;
      if (!this.rec) continue;
      this.layout[i][ch === 0 ? 0 : ch === 1 ? 1 : 2]++;
      const bl = this.bufs[i][0];
      const br = this.bufs[i][1];
      if (L) {
        bl.set(L, this.fill);
        br.set(R, this.fill);
        for (let k = 0; k < L.length; k++) if (!(L[k] - L[k] === 0) || !(R[k] - R[k] === 0)) this.nonFinite[i]++;
      } else {
        bl.fill(0, this.fill, this.fill + n);
        br.fill(0, this.fill, this.fill + n);
      }
    }
    if (++this.q >= this.meterQuanta) {
      this.port.postMessage({ type: 'level', peak: Array.from(this.peak) });
      this.peak.fill(0);
      this.q = 0;
    }
    if (this.rec) {
      this.fill += n;
      this.total += n;
      if (this.fill + n > this.chunkFrames) this.flush();
    }
    return true;
  }
}
registerProcessor('audio-qa-capture', AudioQACapture);
`;

/* eslint-disable no-undef */
function pageLib(args) {
  if (window.__qa) return { installed: false };
  const QA = window.__audioQA;
  if (!QA) throw new Error('audio-qa: the init script did not run (window.__audioQA missing)');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const S = () => {
    const s = window.__synthStudio;
    if (!s) throw new Error('window.__synthStudio is not exposed (hub not initialised)');
    return s;
  };
  const st = { instance: null, mod: null, ctx: null, node: null, sink: null, tap: null, level: [0, 0], levelAt: 0, chunks: [], marks: [], waiting: new Map() };

  function onMessage(e) {
    const m = e.data || {};
    if (m.type === 'level') { st.level = m.peak; st.levelAt = performance.now(); return; }
    if (m.type === 'chunk') { st.chunks.push(m.data); return; }
    if (m.type === 'mark') { st.marks.push({ name: m.name, frame: m.frame }); return; }
    const w = st.waiting.get(m.type);
    if (w) { st.waiting.delete(m.type); w(m); }
  }

  function request(type, reply, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { st.waiting.delete(reply); reject(new Error(`capture worklet did not answer '${type}' (audio thread stalled?)`)); }, timeoutMs);
      st.waiting.set(reply, m => { clearTimeout(timer); resolve(m); });
      st.node.port.postMessage({ type });
    });
  }

  const mark = name => st.node.port.postMessage({ type: 'mark', name });

  async function untilAudio(t) {
    const ctx = st.ctx;
    const deadline = performance.now() + Math.max(0, t - ctx.currentTime) * 4000 + 5000;
    while (ctx.currentTime < t) {
      if (ctx.state !== 'running') throw new Error(`AudioContext is ${ctx.state}`);
      if (performance.now() > deadline) throw new Error(`the audio clock stopped advancing (currentTime ${ctx.currentTime.toFixed(3)} s)`);
      await sleep(Math.max(1, Math.min(15, (t - ctx.currentTime) * 1000)));
    }
  }

  function toBase64(f32) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => { const s = String(fr.result); resolve(s.slice(s.indexOf(',') + 1)); };
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(new Blob([f32], { type: 'application/octet-stream' }));
    });
  }

  function join(parts) {
    const n = parts.reduce((s, p) => s + p.length, 0);
    const out = new Float32Array(n);
    let o = 0;
    parts.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  }

  function slot() {
    const s = S().hub.slots.get(st.instance);
    if (!s) throw new Error(`instrument slot '${st.instance}' disappeared`);
    return s;
  }

  /** (Re)connect the instrument tap and the master feeds - idempotent */
  function connectTaps() {
    const sl = slot();
    const tap = sl.outGain || sl.engine.getMainOutput();
    if (!tap) throw new Error('instrument has no output node to tap');
    st.tap = tap;
    QA.connect(tap, st.node, 0, 0);
    let master = 0;
    QA.feeds.forEach(f => {
      if (QA.qaNodes.has(f)) return;
      try { QA.connect(f, st.node, 0, 1); master++; } catch (e) { /* node from another context */ }
    });
    return { tap: sl.outGain ? 'outGain' : 'engine main output', masterFeeds: master };
  }

  async function setup(device, opts) {
    const { store, hub } = S();
    let s = store.getState();
    const rack = s.studio.rack;
    if (!(rack.length === 1 && rack[0].id === device && rack[0].device === device)) {
      s.loadProject({
        devices: {},
        studio: { rack: [{ id: device, device }], cables: [], routes: {}, sync: {}, bpm: opts.bpm, swing: 0, arrangement: { enabled: false, loop: true, sections: [] } },
        currentDevice: device,
      });
    }
    s = store.getState();
    if (s.studio.bpm !== opts.bpm) s.setBpm(opts.bpm);
    if (s.studio.swing) s.setSwing(0);
    const mod = await hub.loadModule(device);
    await hub.startAudio();
    const t0 = performance.now();
    let sl = hub.slots.get(device);
    while (!(sl && sl.started) && performance.now() - t0 < 20000) {
      await sleep(25);
      sl = hub.slots.get(device);
    }
    if (!(sl && sl.started)) throw new Error(`instrument '${device}' did not start (hub status ${hub.status}${hub.error ? ': ' + hub.error : ''})`);
    st.instance = device;
    st.mod = mod;
    const tap = sl.outGain || sl.engine.getMainOutput();
    const ctx = tap.context;
    if (!st.node || st.ctx !== ctx) {
      st.ctx = ctx;
      const url = URL.createObjectURL(new Blob([args.captureSrc], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      const AWN = QA.OrigAudioWorkletNode || window.AudioWorkletNode;
      st.node = new AWN(ctx, 'audio-qa-capture', {
        numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [1],
        channelCount: 2, channelCountMode: 'clamped-max', channelInterpretation: 'speakers',
        processorOptions: { chunkFrames: 16384, meterQuanta: 8 },
      });
      st.node.port.onmessage = onMessage;
      st.sink = ctx.createGain();
      st.sink.gain.value = 0;
      QA.qaNodes.add(st.node);
      QA.qaNodes.add(st.sink);
      QA.connect(st.node, st.sink);
      QA.connect(st.sink, ctx.destination);
    }
    const taps = connectTaps();
    const spec = mod.spec;
    const presets = Object.entries(spec.presets || {}).map(([key, p]) => ({
      key, name: String(p.name || key), source: p.source || null,
      cables: (p.patchConnections || []).length, settings: Object.keys(p.settings || {}).length,
    }));
    let buildId = null;
    const bm = [...document.scripts].map(x => x.src).find(src => /\/_next\/static\/[^/]+\/_(build|ssg)Manifest\.js/.test(src));
    if (bm) buildId = bm.match(/\/_next\/static\/([^/]+)\//)[1];
    return {
      device, name: spec.name, manufacturer: spec.manufacturer || null,
      sampleRate: ctx.sampleRate, baseLatency: ctx.baseLatency, outputLatency: ctx.outputLatency, state: ctx.state,
      keyboard: mod.keyboard || null, transportControl: mod.transportControl || null, audition: typeof mod.audition === 'function',
      midiSync: !!(mod.studio && mod.studio.midiSync), stereoDeclared: !!(mod.studio && mod.studio.stereo),
      presets, ...taps, hubStatus: hub.status, workletNodes: QA.workletNodes, buildId,
      presetSelect: !!document.querySelector(`[data-instance="${device}"] select[aria-label="Load preset"]`),
    };
  }

  /** Stop everything, release every note, unplug cables, momentary buttons back to default */
  function reset() {
    const { store, hub } = S();
    const inst = st.instance;
    try { hub.stopAudition(); } catch (e) { /* */ }
    try { hub.stopAll(); } catch (e) { /* */ }
    for (let n = 0; n < 128; n++) { try { hub.noteOff(inst, n); } catch (e) { /* */ } }
    let s = store.getState();
    if (((s.devices[inst] && s.devices[inst].patchConnections) || []).length) s.clearPatchConnections(inst);
    s = store.getState();
    if (s.studio.cables.length) s.clearStudioCables();
    const spec = st.mod.spec;
    const cv = (store.getState().devices[inst] || {}).controlValues || {};
    const back = {};
    Object.entries(spec.controls).forEach(([id, c]) => {
      if (c.type === 'button' && (c.momentary || id === st.mod.transportControl) && cv[id] !== undefined && cv[id] !== c.default) back[id] = c.default;
    });
    if (Object.keys(back).length) store.getState().setControlValues(inst, back);
    return { transportPlaying: S().transport.playing };
  }

  /** Wait until the instrument output is quiet (or settles on a constant floor) */
  async function waitQuiet(o) {
    const floor = Math.pow(10, o.floorDb / 20);
    const t0 = performance.now();
    let quietSince = null;
    const hist = [];
    while (performance.now() - t0 < o.timeoutMs) {
      await sleep(25);
      const lv = st.level[0] || 0;
      const now = performance.now();
      hist.push([now, lv]);
      while (hist.length && now - hist[0][0] > 1000) hist.shift();
      if (lv <= floor) {
        if (quietSince === null) quietSince = now;
        if (now - quietSince >= o.holdMs) return { quiet: true, waitedMs: Math.round(now - t0), levelDb: lv > 0 ? 20 * Math.log10(lv) : null };
      } else quietSince = null;
      // A constant idle floor (hum, noise) below -60 dBFS: stop waiting once it no longer falls
      if (now - t0 > 1500 && hist.length > 10 && lv < 1e-3) {
        const first = Math.max(hist[0][1], 1e-12);
        if (20 * Math.log10(Math.max(lv, 1e-12) / first) > -1) return { quiet: false, floor: true, waitedMs: Math.round(now - t0), levelDb: 20 * Math.log10(Math.max(lv, 1e-12)) };
      }
    }
    const lv = st.level[0] || 0;
    return { quiet: false, waitedMs: Math.round(performance.now() - t0), levelDb: lv > 0 ? 20 * Math.log10(lv) : null };
  }

  /** The UI's DeviceHost.applyPreset, replicated (used only if the preset menu is missing) */
  function applyFallback(key) {
    const { store } = S();
    const mod = st.mod;
    const spec = mod.spec;
    const p = spec.presets && spec.presets[key];
    if (!p) throw new Error(`no preset '${key}'`);
    const transient = new Set(mod.uiControls || []);
    Object.entries(spec.controls).forEach(([id, c]) => { if (c.type === 'button' && (c.momentary || id === mod.transportControl)) transient.add(id); });
    const base = {};
    Object.entries(spec.controls).forEach(([id, c]) => { if ('default' in c && c.default !== undefined && !transient.has(id)) base[id] = c.default; });
    store.getState().loadPreset(st.instance, Object.assign({}, base, p.settings), p.patchConnections || []);
  }

  /** Did the store end up with the preset's settings and cables? */
  function verify(key) {
    const { store } = S();
    const p = st.mod.spec.presets[key];
    const d = store.getState().devices[st.instance] || {};
    const cv = d.controlValues || {};
    const mismatched = Object.keys(p.settings || {}).filter(k => cv[k] !== p.settings[k]);
    return {
      mismatched: mismatched.slice(0, 10), mismatchCount: mismatched.length,
      cables: (d.patchConnections || []).length, expectedCables: (p.patchConnections || []).length,
      transportOn: st.mod.transportControl ? !!cv[st.mod.transportControl] : false,
    };
  }

  /** Build a calibration source connected into the instrument tap */
  function calibrationSource(sig) {
    const ctx = st.ctx;
    const nodes = [];
    const into = st.tap;
    let src = null;
    const amp = sig.amp == null ? 0.1 : sig.amp;
    if (sig.kind === 'sine' || sig.kind === 'sine-one-channel') {
      src = ctx.createOscillator();
      src.type = 'sine';
      src.frequency.value = sig.freq || 1000;
      const g = ctx.createGain();
      g.gain.value = amp;
      src.connect(g);
      nodes.push(src, g);
      if (sig.kind === 'sine-one-channel') {
        const m = ctx.createChannelMerger(2);
        g.connect(m, 0, 0);
        nodes.push(m);
        m.connect(into);
      } else g.connect(into);
    } else if (sig.kind === 'quarter-rate') {
      // fs/4 sine at 45 degrees: samples at +-0.707 amp, true peak = amp
      const b = ctx.createBuffer(1, 4, ctx.sampleRate);
      const s = amp * Math.SQRT1_2;
      b.getChannelData(0).set([s, s, -s, -s]);
      src = ctx.createBufferSource();
      src.buffer = b;
      src.loop = true;
      src.connect(into);
      nodes.push(src);
    } else if (sig.kind === 'dc') {
      src = ctx.createConstantSource();
      src.offset.value = sig.offset;
      src.connect(into);
      nodes.push(src);
    } else if (sig.kind === 'phase-jump') {
      const fs = ctx.sampleRate;
      const n = Math.round(fs * sig.seconds);
      const b = ctx.createBuffer(1, n, fs);
      const d = b.getChannelData(0);
      const fade = Math.round(0.005 * fs);
      for (let i = 0; i < n; i++) {
        const env = Math.min(1, i / fade, (n - 1 - i) / fade);
        d[i] = env * amp * Math.sin(2 * Math.PI * sig.freq * i / fs + (i >= n / 2 ? Math.PI / 2 : 0));
      }
      src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(into);
      nodes.push(src);
    }
    return {
      start: () => { if (src) src.start(); },
      stop: () => { try { if (src) src.stop(); } catch (e) { /* */ } nodes.forEach(x => { try { x.disconnect(); } catch (e) { /* */ } }); },
    };
  }

  /**
   * Capture one take: pre-roll, excitation, stop, tail.
   * o = { mode: 'keys'|'transport'|'audition'|'signal', seconds, tail, preroll, settleMs, velocity, events, signal }
   */
  async function capture(o) {
    const { hub, transport } = S();
    const ctx = st.ctx;
    const inst = st.instance;
    if (o.settleMs) await sleep(o.settleMs);
    const taps = connectTaps();
    QA.errors.length = 0;
    const stateLog0 = QA.stateLog.length;
    st.chunks = [];
    st.marks = [];
    const notes = { on: 0, off: 0 };
    let sig = null;
    if (o.mode === 'signal') {
      sig = calibrationSource(o.signal);
      if (o.signal.steady) { sig.start(); await sleep(300); }
    }
    const started = await request('start', 'started');
    const audio0 = ctx.currentTime;
    const wall0 = performance.now();
    let stopRet = null;
    try {
      await untilAudio(audio0 + o.preroll);
      const ex0 = ctx.currentTime;
      mark('excite');
      if (o.mode === 'keys') {
        for (const ev of o.events) {
          await untilAudio(ex0 + ev.t);
          if (ev.on) { hub.noteOn(inst, ev.note, o.velocity); notes.on++; } else { hub.noteOff(inst, ev.note); notes.off++; }
        }
        await untilAudio(ex0 + o.seconds);
      } else if (o.mode === 'transport') {
        hub.startAll();
        await untilAudio(ex0 + o.seconds);
        hub.stopAll();
      } else if (o.mode === 'audition') {
        hub.audition(inst, null, { ms: (o.seconds + 120) * 1000 });
        await untilAudio(ex0 + o.seconds);
        hub.stopAudition();
      } else if (o.mode === 'signal') {
        if (!o.signal.steady) sig.start();
        await untilAudio(ex0 + o.seconds);
        if (!o.signal.keepAfterStop && !o.signal.steady) sig.stop();
      } else {
        throw new Error(`unknown excitation mode '${o.mode}'`);
      }
      mark('stop');
      stopRet = { transportPlaying: transport.playing };
      await untilAudio(ctx.currentTime + o.tail);
    } finally {
      if (sig) sig.stop();
    }
    const done = await request('stop', 'done');
    const audio1 = ctx.currentTime;
    const wall1 = performance.now();
    const streams = [[], [], [], []];
    st.chunks.forEach(c => {
      streams[0].push(c[0][0]); streams[1].push(c[0][1]);
      streams[2].push(c[1][0]); streams[3].push(c[1][1]);
    });
    st.chunks = [];
    const pcm = await Promise.all(streams.map(s => toBase64(join(s))));
    return {
      sampleRate: ctx.sampleRate,
      frames: done.frames,
      startFrame: started.frame,
      marks: st.marks.slice(),
      layout: done.layout,
      nonFinite: done.nonFinite,
      pcm,
      taps,
      notes,
      afterStop: stopRet,
      errors: QA.errors.splice(0),
      stateChanges: QA.stateLog.slice(stateLog0),
      realtime: +((audio1 - audio0) / Math.max(1e-3, (wall1 - wall0) / 1000)).toFixed(3),
      wallMs: Math.round(wall1 - wall0),
      hubStatus: hub.status,
    };
  }

  function idleLevelDb() {
    const lv = st.level[0] || 0;
    return lv > 0 ? 20 * Math.log10(lv) : null;
  }

  window.__qa = { setup, reset, waitQuiet, applyFallback, verify, capture, idleLevelDb };
  return { installed: true };
}

module.exports = { initScript, pageLib, CAPTURE_PROCESSOR };
