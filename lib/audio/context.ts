// ============================================================================
// Shared AudioContext
// One context for the whole app, a master bus with a soft limiter, worklet
// loading, and the iOS / Safari unlock dance (audio may only start inside a
// user gesture, and the silent switch mutes Web Audio unless we ask for the
// 'playback' audio session).
// ============================================================================

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let levelBuf: Float32Array<ArrayBuffer> | null = null;
let workletPromise: Promise<void> | null = null;
let unlockInstalled = false;
const readyListeners = new Set<(running: boolean) => void>();

export const WORKLET_URL = '/worklets/synth-processors.js';

function createContext(): AudioContext {
  const AC: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const c = new AC({ latencyHint: 'interactive' });

  // Soft limiter so stacked voices and resonant filters never clip harshly
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.15;

  master = c.createGain();
  master.gain.value = 0.8;
  master.connect(limiter);
  limiter.connect(c.destination);

  // Output tap for the level meter (and automated audio tests)
  analyser = c.createAnalyser();
  analyser.fftSize = 2048;
  levelBuf = new Float32Array(analyser.fftSize);
  limiter.connect(analyser);
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

export function getMasterBus(): AudioNode {
  getAudioContext();
  return master!;
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

/** Load the AudioWorklet processors once per context */
export function loadWorklets(): Promise<void> {
  const c = getAudioContext();
  if (!workletPromise) {
    workletPromise = c.audioWorklet.addModule(WORKLET_URL).catch(err => {
      workletPromise = null;
      throw err;
    });
  }
  return workletPromise;
}

const extraWorklets = new Map<string, Promise<void>>();

/** Load a device-specific worklet module once */
export function loadExtraWorklet(url: string): Promise<void> {
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
    // iOS 16.4+: play through the ringer/silent switch like a music app
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback';
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
