// ============================================================================
// Shared AudioContext and the studio master
//
// One context for the whole app, worklet loading, and the iOS / Safari unlock
// dance (audio may only start inside a user gesture, and the silent switch mutes
// Web Audio unless we ask for the 'playback' audio session).
//
// The master is transparent by default:
//
//   instruments / returns ─► masterIn (unity) ─► master-bus worklet ─► masterOut ─┬─► speakers
//                                                 optional EQ + glue (off)          ├─► analyser (__synthLevel, scope)
//                                                 master gain                       └─► recorder tap
//                                                 true-peak limiter -1 dBTP, 1.5 ms
//                                                 BS.1770-4 meter
//   metronome / count-in ─► monitor ─► speakers (never recorded)
//
// The limiter only acts on overs; below the ceiling the signal passes bit for bit,
// 1.5 ms late (its look-ahead). Until the worklet has loaded, masterIn feeds masterOut
// directly. There is no DynamicsCompressor anywhere on the path any more (the old one
// squashed every instrument and added 6 ms of pre-delay).
// ============================================================================

let ctx: AudioContext | null = null;
let masterIn: GainNode | null = null;
let masterNode: AudioWorkletNode | null = null;
let masterOut: GainNode | null = null;
let monitor: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let levelBuf: Float32Array<ArrayBuffer> | null = null;
let workletPromise: Promise<void> | null = null;
let studioWorkletPromise: Promise<void> | null = null;
let unlockInstalled = false;
let usedHint: LatencyPreference = 'interactive';
let limiterFrames = 0;
const readyListeners = new Set<(running: boolean) => void>();

export const WORKLET_URL = '/worklets/synth-processors.js';
export const STUDIO_WORKLET_URL = '/worklets/studio-processors.js';
/** Limiter look-ahead, seconds (the only buffering on the live path) */
export const LIMITER_LOOKAHEAD = 0.0015;
/** Limiter ceiling, dBTP */
export const LIMITER_CEILING_DB = -1;

// ---------------------------------------------------------------------------
// Latency preference (per browser; applied when the context is created)
// ---------------------------------------------------------------------------

export type LatencyPreference = 'interactive' | 'balanced';
const LATENCY_KEY = 'synth-studio-latency';

export function getLatencyPreference(): LatencyPreference {
  try {
    return localStorage.getItem(LATENCY_KEY) === 'balanced' ? 'balanced' : 'interactive';
  } catch {
    return 'interactive';
  }
}

/** Saved for the next page load: an AudioContext's buffer size can't change while it runs */
export function setLatencyPreference(p: LatencyPreference) {
  try { localStorage.setItem(LATENCY_KEY, p); } catch { /* private mode */ }
}

export interface LatencyInfo {
  /** The preference the running context was created with */
  hint: LatencyPreference;
  sampleRate: number;
  /** Processing latency of the audio graph's buffer, seconds */
  base: number;
  /** Device / OS output latency, seconds (0 where the browser doesn't report it) */
  output: number;
  /** Master limiter look-ahead, seconds */
  lookahead: number;
  /** Key or pad to speaker, seconds */
  total: number;
}

export function getLatencyInfo(): LatencyInfo | null {
  if (!ctx) return null;
  const base = ctx.baseLatency || 0;
  const output = (ctx as AudioContext & { outputLatency?: number }).outputLatency || 0;
  const lookahead = masterNode ? (limiterFrames || Math.round(LIMITER_LOOKAHEAD * ctx.sampleRate)) / ctx.sampleRate : 0;
  return { hint: usedHint, sampleRate: ctx.sampleRate, base, output, lookahead, total: base + output + lookahead };
}

// ---------------------------------------------------------------------------
// Context and master graph
// ---------------------------------------------------------------------------

/**
 * Why audio can't run here, or null. On plain http:// (an iPad opening a LAN address)
 * browsers hide AudioWorklet, which every instrument needs.
 */
export function audioSupportProblem(): string | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return 'This browser has no Web Audio, so it can\'t make sound. Use a current Safari, Chrome, Edge or Firefox.';
  if (typeof isSecureContext !== 'undefined' && !isSecureContext) {
    return 'Sound needs a secure page. Open Synth Studio with an https:// address (or http://localhost on this computer): on plain http:// the browser switches off the audio engine (AudioWorklet).';
  }
  if (!('audioWorklet' in AC.prototype)) {
    return 'This browser has no AudioWorklet, which every instrument needs. Update to iPadOS / Safari 14.5 or later, or use Chrome, Edge or Firefox.';
  }
  return null;
}

const processorErrorListeners = new Set<(processor: string) => void>();

/** An AudioWorklet processor threw (its node is silent from then on) */
export function onProcessorError(l: (processor: string) => void): () => void {
  processorErrorListeners.add(l);
  return () => processorErrorListeners.delete(l);
}

/** Every AudioWorkletNode created from here on reports 'processorerror' to onProcessorError */
function watchProcessorErrors() {
  const w = window as unknown as { AudioWorkletNode?: typeof AudioWorkletNode & { __watched?: boolean } };
  const Orig = w.AudioWorkletNode;
  if (!Orig || Orig.__watched) return;
  class Watched extends Orig {
    constructor(context: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions) {
      super(context, name, options);
      this.addEventListener('processorerror', () => {
        console.error(`[audio] processor '${name}' failed`);
        processorErrorListeners.forEach(l => l(name));
      });
    }
  }
  (Watched as unknown as { __watched: boolean }).__watched = true;
  w.AudioWorkletNode = Watched;
}

function createContext(): AudioContext {
  const AC: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  usedHint = getLatencyPreference();
  watchProcessorErrors();
  let c: AudioContext;
  try {
    c = new AC({ latencyHint: usedHint });
  } catch {
    c = new AC();
  }

  masterIn = c.createGain();
  masterIn.channelCount = 2;
  masterIn.channelCountMode = 'explicit';
  masterIn.channelInterpretation = 'speakers';
  masterOut = c.createGain();
  masterIn.connect(masterOut); // bypass until the master worklet is in
  masterOut.connect(c.destination);

  monitor = c.createGain();
  monitor.connect(c.destination);

  // Output tap for the level meter, the scope and automated audio tests
  analyser = c.createAnalyser();
  analyser.fftSize = 2048;
  levelBuf = new Float32Array(analyser.fftSize);
  masterOut.connect(analyser);
  (window as unknown as { __synthLevel?: () => number }).__synthLevel = getOutputLevel;

  c.addEventListener('statechange', () => notify(c.state === 'running'));
  return c;
}

function notify(running: boolean) {
  readyListeners.forEach(l => l(running));
}

export function getAudioContext(): AudioContext {
  if (!ctx) ctx = createContext();
  return ctx;
}

/** The studio master bus input (unity gain). Instruments are routed here by the hub. */
export function getMasterBus(): AudioNode {
  getAudioContext();
  return masterIn!;
}

/** Straight to the speakers, bypassing the master and every recording (metronome, count-in) */
export function getMonitorBus(): AudioNode {
  getAudioContext();
  return monitor!;
}

/** Post-limiter master signal (what you hear) - for recording */
export function getRecordTap(): AudioNode {
  getAudioContext();
  return masterOut!;
}

/** The master analyser - for scopes and meters */
export function getMasterAnalyser(): AnalyserNode | null {
  return analyser;
}

/** Peak output level (0..1) over the last ~40ms */
export function getOutputLevel(): number {
  if (!analyser || !levelBuf) return 0;
  analyser.getFloatTimeDomainData(levelBuf);
  let peak = 0;
  for (let i = 0; i < levelBuf.length; i++) {
    const a = Math.abs(levelBuf[i]);
    if (a > peak) peak = a;
  }
  return peak;
}

export function isAudioRunning(): boolean {
  return !!ctx && ctx.state === 'running';
}

export function onAudioStateChange(listener: (running: boolean) => void): () => void {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Master processor: settings and meter
// ---------------------------------------------------------------------------

export interface MasterEq {
  on: boolean;
  /** Low shelf at 100 Hz, dB */
  low: number;
  /** Tilt around 1 kHz: + brighter (highs up, lows down by the same amount), dB */
  tilt: number;
  /** High shelf at 10 kHz, dB */
  high: number;
}

export interface MasterGlue {
  on: boolean;
  threshold: number;
  ratio: number;
  /** seconds */
  attack: number;
  /** seconds (ignored when auto) */
  release: number;
  auto: boolean;
  makeup: number;
  /** 0..1 wet share (parallel compression below 1) */
  mix: number;
}

export interface MasterSettings {
  /** Master gain before the limiter, linear */
  gain: number;
  eq: MasterEq;
  glue: MasterGlue;
}

/** One meter frame from the master (every 50 ms). Linear peaks, LUFS or null below the gate. */
export interface MasterMeterFrame {
  peakL: number;
  peakR: number;
  /** True peak of the window (4x oversampled), linear */
  tp: number;
  /** Sample peak going into the limiter (after the master gain), linear */
  inPeak: number;
  /** Limiter gain reduction, dB (max over the window) */
  gr: number;
  /** Glue compressor gain reduction, dB */
  glue: number;
  m: number | null;
  s: number | null;
  i: number | null;
}

const meterListeners = new Set<(f: MasterMeterFrame) => void>();
let lastMeter: MasterMeterFrame | null = null;
let pendingSettings: Partial<MasterSettings> | null = null;

export function onMasterMeter(l: (f: MasterMeterFrame) => void): () => void {
  meterListeners.add(l);
  return () => meterListeners.delete(l);
}

export function getLastMasterMeter(): MasterMeterFrame | null {
  return lastMeter;
}

/** Restart the integrated loudness and the meter history */
export function resetMasterMeter() {
  masterNode?.port.postMessage({ type: 'reset' });
}

export function setMasterSettings(s: Partial<MasterSettings>) {
  if (!masterNode) {
    pendingSettings = { ...(pendingSettings ?? {}), ...s };
    return;
  }
  const msg: Record<string, unknown> = { type: 'set' };
  if (s.gain !== undefined) msg.gain = s.gain;
  if (s.eq) msg.eq = { ...s.eq, lowFreq: 100, tiltFreq: 1000, highFreq: 10000 };
  if (s.glue) msg.glue = { ...s.glue, knee: 6 };
  masterNode.port.postMessage(msg);
}

/** True once the limiter and meter are on the master (after loadWorklets) */
export function hasMasterProcessor(): boolean {
  return !!masterNode;
}

/** Limiter latency in frames (the recorder uses it to align the master with the stems) */
export function getMasterLatencyFrames(): number {
  return masterNode ? limiterFrames || Math.round(LIMITER_LOOKAHEAD * (ctx?.sampleRate ?? 48000)) : 0;
}

function installMaster(c: AudioContext) {
  if (masterNode || !masterIn || !masterOut) return;
  const node = new AudioWorkletNode(c, 'master-bus', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    channelCount: 2,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
    processorOptions: { ceiling: LIMITER_CEILING_DB, lookahead: LIMITER_LOOKAHEAD },
  });
  limiterFrames = Math.round(LIMITER_LOOKAHEAD * c.sampleRate);
  node.port.onmessage = e => {
    const d = e.data as { type: string; latency?: number } & MasterMeterFrame;
    if (d.type === 'meter') {
      lastMeter = d;
      meterListeners.forEach(l => l(d));
    } else if (d.type === 'ready' && d.latency) {
      limiterFrames = d.latency;
    }
  };
  // Make the new path before breaking the bypass (this runs before any engine starts)
  masterIn.connect(node);
  node.connect(masterOut);
  masterIn.disconnect(masterOut);
  masterNode = node;
  if (pendingSettings) {
    const s = pendingSettings;
    pendingSettings = null;
    setMasterSettings(s);
  }
}

/** The studio worklets (recorder, master bus, meter bank), once per context */
export function loadStudioWorklet(): Promise<void> {
  const c = getAudioContext();
  if (!studioWorkletPromise) {
    studioWorkletPromise = c.audioWorklet.addModule(STUDIO_WORKLET_URL).catch(err => {
      studioWorkletPromise = null;
      throw err;
    });
  }
  return studioWorkletPromise;
}

/** Load the AudioWorklet processors once per context, and put the limiter on the master */
export function loadWorklets(): Promise<void> {
  const c = getAudioContext();
  if (!workletPromise) {
    workletPromise = Promise.all([
      c.audioWorklet.addModule(WORKLET_URL),
      loadStudioWorklet().then(() => installMaster(c)),
    ]).then(() => undefined).catch(err => {
      workletPromise = null;
      throw err;
    });
  }
  return workletPromise;
}

const extraWorklets = new Map<string, Promise<void>>();

/** Load a device-specific worklet module once */
export function loadExtraWorklet(url: string): Promise<void> {
  if (url === STUDIO_WORKLET_URL) return loadStudioWorklet();
  const c = getAudioContext();
  let p = extraWorklets.get(url);
  if (!p) {
    p = c.audioWorklet.addModule(url).catch(err => {
      extraWorklets.delete(url);
      throw err;
    });
    extraWorklets.set(url, p);
  }
  return p;
}

/**
 * Resume audio. Must be called from (or synchronously within) a user gesture
 * on iOS - the unlock listeners below take care of that for every tap/click/key.
 */
export function resumeAudio(): Promise<void> {
  const c = getAudioContext();
  try {
    // iOS 16.4+: play through the ringer/silent switch like a music app. WebKit treats the
    // session type as process-wide, so never force 'playback' while something captures
    // audio (Audio input sets 'play-and-record' and counts its streams in __synthCaptureCount).
    const nav = navigator as unknown as { audioSession?: { type: string } };
    const capturing = ((globalThis as unknown as { __synthCaptureCount?: number }).__synthCaptureCount ?? 0) > 0;
    if (nav.audioSession && !capturing && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback';
  } catch {
    // not supported - ignore
  }
  if (c.state === 'running') return Promise.resolve();
  // Older iOS needs a buffer to be started inside the gesture
  try {
    const b = c.createBuffer(1, 1, c.sampleRate);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch {
    // ignore
  }
  return c.resume();
}

/** Attach one-time gesture listeners that unlock audio on the first interaction */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof window === 'undefined') return;
  unlockInstalled = true;
  const events = ['pointerdown', 'touchend', 'mousedown', 'keydown'];
  const handler = () => {
    resumeAudio().catch(() => undefined);
    if (ctx && ctx.state === 'running') {
      events.forEach(e => window.removeEventListener(e, handler, true));
    }
  };
  events.forEach(e => window.addEventListener(e, handler, true));
}
