// ============================================================================
// Audio input engine: your gear (through an audio interface or a mic) as a
// studio instrument.
//
//   source  -> splitter -> mode matrix (IN 1, IN 2, L+R, STEREO) -> GAIN -> MUTE -> out + jacks
//   sources: getUserMedia (echoCancellation / noiseSuppression / autoGainControl
//            OFF - those are for voice calls and would mangle a synth),
//            the built-in Practice synth, or a 1 kHz line-up tone at -18 dBFS
//   meters:  at the input (before GAIN: clipping here happens in your
//            interface) and after GAIN (what the studio and a take receive);
//            CLIP latches until you clear it, like a mixing desk
//   takes:   records this input alone (after GAIN, before MUTE) to a WAV file
//
// A device input is only opened after you press Connect, or on load when the
// browser already granted access (so a project never pops a permission prompt).
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine } from '@/lib/audio/engine';
import { encodeWav } from '@/lib/audio/recorder';
import { practiceSynth } from '@/lib/midi/practice-synth';
import { TONE_DBFS, asInputData, toDb, type AudioInData } from './config';

export type InputStatus = 'off' | 'connecting' | 'live' | 'needs-permission' | 'error';

/** [L->L, R->L, L->R, R->R] per MODE option */
const MATRIX: Record<number, [number, number, number, number]> = {
  0: [1, 0, 1, 0],         // IN 1: input 1 to both sides
  1: [0, 1, 0, 1],         // IN 2
  2: [0.5, 0.5, 0.5, 0.5], // L+R summed to mono
  3: [1, 0, 0, 1],         // STEREO
};

const dbToGain = (db: number) => Math.pow(10, db / 20);
const RECORDER_URL = '/worklets/studio-processors.js';
const recorderModules = new WeakMap<BaseAudioContext, Promise<void>>();
/** Full scale: a sample this close to 1.0 means the converter (or the studio gain) ran out of room */
const CLIP = 0.999;

// ----------------------------------------------------------------------------
// iPad / Safari audio session while capturing. WebKit's 'playback' session has
// no microphone input, and lib/audio/context.ts sets 'playback' on every tap so
// music plays through the silent switch. While any input captures we ask for
// 'play-and-record' (WebKit keeps the output on the iPad speakers), and count
// open inputs in globalThis.__synthCaptureCount so resumeAudio() leaves the
// session alone until the last one closes.
// ----------------------------------------------------------------------------

type SessionNavigator = Navigator & { audioSession?: { type: string } };
type CaptureGlobal = typeof globalThis & { __synthCaptureCount?: number };

function setSession(type: 'play-and-record' | 'playback') {
  try {
    const s = typeof navigator !== 'undefined' ? (navigator as SessionNavigator).audioSession : undefined;
    if (s && s.type !== type) s.type = type;
  } catch { /* not supported */ }
}

/** Call before getUserMedia */
function captureStarted() {
  const g = globalThis as CaptureGlobal;
  g.__synthCaptureCount = (g.__synthCaptureCount ?? 0) + 1;
  setSession('play-and-record');
}

/** Call when an input that called captureStarted() closes */
function captureEnded() {
  const g = globalThis as CaptureGlobal;
  g.__synthCaptureCount = Math.max(0, (g.__synthCaptureCount ?? 0) - 1);
  if (g.__synthCaptureCount === 0) setSession('playback');
}

/** Channels of a captured track. Safari reports no channelCount and ignores the constraint: assume mono there. */
function trackChannels(settings: MediaTrackSettings): number {
  if (typeof settings.channelCount === 'number' && settings.channelCount > 0) return settings.channelCount;
  try {
    return (navigator.mediaDevices.getSupportedConstraints?.() as MediaTrackSupportedConstraints | undefined)?.channelCount ? 2 : 1;
  } catch {
    return 1;
  }
}

export interface InputLevels {
  /** After GAIN, 0..1+ linear */
  l: number;
  r: number;
  /** Before GAIN (what arrives from the interface) */
  inL: number;
  inR: number;
  /** Latched until clearClip(): after GAIN / at the input */
  clip: boolean;
  inputClip: boolean;
}

export class AudioInEngine extends BaseEngine {
  private cfg: AudioInData = asInputData(undefined);
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stopPractice: (() => void) | null = null;
  private tone: OscillatorNode | null = null;
  private splitIn!: ChannelSplitterNode;
  private matrix!: GainNode[];
  private merge!: ChannelMergerNode;
  private gain!: GainNode;
  private mute!: GainNode;
  private meterL!: AnalyserNode;
  private meterR!: AnalyserNode;
  private preL!: AnalyserNode;
  private preR!: AnalyserNode;
  private meterBuf = new Float32Array(1024);
  private channels = 0;
  private connectSeq = 0;
  private wantKey = '';
  private clipped = false;
  private inputClipped = false;
  private take: { node: AudioWorkletNode; chunks: { l: Float32Array; r: Float32Array }[]; startedAt: number } | null = null;
  /** This input counts towards __synthCaptureCount (getUserMedia asked or open) */
  private capturing = false;
  private monoProbe: ReturnType<typeof setInterval> | null = null;
  private onDeviceChange = () => { if (this.cfg.enabled && this.cfg.source === 'device' && !this.stream) void this.connect(true); };

  protected build(): void {
    const ctx = this.ctx;
    this.splitIn = ctx.createChannelSplitter(2);
    this.merge = ctx.createChannelMerger(2);
    this.matrix = [0, 1, 2, 3].map(() => ctx.createGain());
    // in L -> out L, in R -> out L, in L -> out R, in R -> out R
    this.splitIn.connect(this.matrix[0], 0); this.matrix[0].connect(this.merge, 0, 0);
    this.splitIn.connect(this.matrix[1], 1); this.matrix[1].connect(this.merge, 0, 0);
    this.splitIn.connect(this.matrix[2], 0); this.matrix[2].connect(this.merge, 0, 1);
    this.splitIn.connect(this.matrix[3], 1); this.matrix[3].connect(this.merge, 0, 1);
    this.gain = ctx.createGain();
    this.mute = ctx.createGain();
    this.merge.connect(this.gain);
    this.gain.connect(this.mute);
    this.mute.connect(this.out);

    const analyser = () => { const a = ctx.createAnalyser(); a.fftSize = 1024; return a; };
    // Input meters: straight from the source, before MODE and GAIN
    this.preL = analyser();
    this.preR = analyser();
    this.splitIn.connect(this.preL, 0);
    this.splitIn.connect(this.preR, 1);
    // Meters read the signal after GAIN, before MUTE (so you can set levels while muted)
    const meterSplit = ctx.createChannelSplitter(2);
    this.meterL = analyser();
    this.meterR = analyser();
    this.gain.connect(meterSplit);
    meterSplit.connect(this.meterL, 0);
    meterSplit.connect(this.meterR, 1);

    // Patchable outputs (post-mute), e.g. into a twin's external input or a plugin's IN
    const outSplit = ctx.createChannelSplitter(2);
    const outL = ctx.createGain();
    const outR = ctx.createGain();
    this.mute.connect(outSplit);
    outSplit.connect(outL, 0);
    outSplit.connect(outR, 1);
    this.outputs = { out_l: { node: outL }, out_r: { node: outR } };

    if (typeof navigator !== 'undefined') navigator.mediaDevices?.addEventListener?.('devicechange', this.onDeviceChange);
    this.onDispose(() => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', this.onDeviceChange);
      this.discardTake();
      this.release();
    });
    this.emit({ status: 'off' as InputStatus, channels: 0, recording: false });
  }

  protected onParam(id: string, value: ControlValue): void {
    const now = this.ctx.currentTime;
    if (id === 'gain') this.gain.gain.setTargetAtTime(dbToGain(Number(value)), now, 0.01);
    if (id === 'mute') this.mute.gain.setTargetAtTime(value ? 0 : 1, now, 0.008);
    if (id === 'mode') this.applyMode();
  }

  private applyMode() {
    // A mono input has nothing on input 2: every mode plays input 1
    const mode = this.channels === 1 ? 0 : Math.round(this.num('mode', 0));
    const m = MATRIX[mode] ?? MATRIX[0];
    const now = this.ctx.currentTime;
    this.matrix.forEach((g, i) => g.gain.setTargetAtTime(m[i], now, 0.01));
  }

  protected onData(data: unknown): void {
    this.cfg = asInputData(data);
    const key = `${this.cfg.enabled}|${this.cfg.source}|${this.cfg.deviceId ?? ''}`;
    if (key === this.wantKey) return;
    this.wantKey = key;
    if (!this.cfg.enabled) {
      this.release();
      this.emit({ status: 'off' as InputStatus, error: null, deviceLabel: null, channels: 0, inputLatency: null, source: this.cfg.source });
    } else if (this.cfg.source === 'practice') this.connectPractice();
    else if (this.cfg.source === 'tone') this.connectTone();
    else void this.connect(true);
  }

  /** Panel buttons and lesson auditions */
  event(name: string): void {
    if (name === 'connect') {
      if (this.cfg.source === 'practice') this.connectPractice();
      else if (this.cfg.source === 'tone') this.connectTone();
      else void this.connect(false);
    }
    if (name === 'clear-clip') { this.clipped = false; this.inputClipped = false; }
    // "Hear it": a phrase from the Practice synth when that is what this input plays
    if ((name === 'audition' || name === 'trigger') && this.cfg.enabled && this.cfg.source === 'practice') practiceSynth.demo(0);
  }

  // --------------------------------------------------------------------------
  // Meters
  // --------------------------------------------------------------------------

  private peak(a: AnalyserNode) {
    a.getFloatTimeDomainData(this.meterBuf);
    let p = 0;
    for (let i = 0; i < this.meterBuf.length; i++) { const v = Math.abs(this.meterBuf[i]); if (v > p) p = v; }
    return p;
  }

  /** Peak levels of the last ~20 ms, for the meters (0..1 linear) */
  levels(): InputLevels {
    if (!this.started || !this.live) return { l: 0, r: 0, inL: 0, inR: 0, clip: this.clipped, inputClip: this.inputClipped };
    const l = this.peak(this.meterL);
    const r = this.peak(this.meterR);
    const inL = this.peak(this.preL);
    const inR = this.channels === 1 ? inL : this.peak(this.preR);
    if (l >= CLIP || r >= CLIP) this.clipped = true;
    if (inL >= CLIP || inR >= CLIP) this.inputClipped = true;
    return { l, r, inL, inR, clip: this.clipped, inputClip: this.inputClipped };
  }

  clearClip() {
    this.clipped = false;
    this.inputClipped = false;
  }

  private get live() {
    return !!(this.stream || this.stopPractice || this.tone);
  }

  // --------------------------------------------------------------------------
  // Takes: record this input to a WAV file
  // --------------------------------------------------------------------------

  get recording() {
    return !!this.take;
  }

  async startTake(): Promise<void> {
    if (this.take || !this.started) return;
    const ctx = this.ctx;
    let mod = recorderModules.get(ctx);
    if (!mod) {
      mod = ctx.audioWorklet.addModule(RECORDER_URL);
      recorderModules.set(ctx, mod);
      mod.catch(() => recorderModules.delete(ctx));
    }
    await mod;
    const node = new AudioWorkletNode(ctx, 'recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
    const take = { node, chunks: [] as { l: Float32Array; r: Float32Array }[], startedAt: ctx.currentTime };
    node.port.onmessage = e => { if (e.data?.type === 'chunk') take.chunks.push({ l: e.data.l, r: e.data.r }); };
    // After GAIN, before MUTE: a muted (direct-monitored) input still records
    this.gain.connect(node);
    const sink = ctx.createGain();
    sink.gain.value = 0;
    node.connect(sink).connect(ctx.destination);
    node.port.postMessage('start');
    this.take = take;
    this.emit({ recording: true, takeStartedAt: performance.now() });
  }

  /** Stop and return the WAV, its length and its loudest peak */
  stopTake(): Promise<{ blob: Blob; seconds: number; peakDb: number } | null> {
    const take = this.take;
    if (!take) return Promise.resolve(null);
    this.take = null;
    return new Promise(resolve => {
      take.node.port.onmessage = e => {
        if (e.data?.type === 'chunk') take.chunks.push({ l: e.data.l, r: e.data.r });
        if (e.data?.type !== 'done') return;
        try { this.gain.disconnect(take.node); } catch { /* */ }
        take.node.disconnect();
        let peak = 0;
        let frames = 0;
        take.chunks.forEach(c => {
          frames += c.l.length;
          for (let i = 0; i < c.l.length; i++) {
            const v = Math.max(Math.abs(c.l[i]), Math.abs(c.r[i]));
            if (v > peak) peak = v;
          }
        });
        this.emit({ recording: false });
        resolve({ blob: encodeWav(take.chunks, this.ctx.sampleRate), seconds: frames / this.ctx.sampleRate, peakDb: toDb(peak) });
      };
      take.node.port.postMessage('stop');
    });
  }

  private discardTake() {
    const take = this.take;
    this.take = null;
    if (!take) return;
    try { this.gain.disconnect(take.node); } catch { /* */ }
    take.node.disconnect();
  }

  // --------------------------------------------------------------------------
  // Sources
  // --------------------------------------------------------------------------

  private connectPractice() {
    ++this.connectSeq;
    this.release();
    this.stopPractice = practiceSynth.listen(this.splitIn);
    this.channels = 2;
    this.applyMode();
    this.emit({
      status: 'live' as InputStatus, error: null, source: 'practice', deviceLabel: 'Practice synth (built in)', channels: 2,
      inputLatency: 0, sampleRate: this.ctx.sampleRate,
    });
  }

  private connectTone() {
    ++this.connectSeq;
    this.release();
    const osc = this.ctx.createOscillator();
    osc.frequency.value = 1000;
    const level = this.ctx.createGain();
    level.gain.value = dbToGain(TONE_DBFS);
    osc.connect(level).connect(this.splitIn);
    osc.start();
    this.tone = osc;
    this.channels = 1;
    this.applyMode();
    this.emit({
      status: 'live' as InputStatus, error: null, source: 'tone', deviceLabel: `Test tone · 1 kHz at ${TONE_DBFS} dBFS`, channels: 1,
      inputLatency: 0, sampleRate: this.ctx.sampleRate,
    });
  }

  private async connect(auto: boolean) {
    const seq = ++this.connectSeq;
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md?.getUserMedia) {
      this.emit({
        status: 'error' as InputStatus,
        source: 'device',
        error: typeof window !== 'undefined' && window.isSecureContext === false
          ? 'Audio input needs a secure page: open Synth Studio over https:// (or localhost). The Practice synth and the test tone work anyway.'
          : 'This browser cannot open audio inputs. The Practice synth and the test tone still work.',
      });
      return;
    }
    if (auto) {
      const granted = await microphoneGranted();
      if (seq !== this.connectSeq) return; // a Connect press took over
      if (!granted) {
        this.emit({ status: 'needs-permission' as InputStatus, error: null, source: 'device' });
        return;
      }
    }
    this.emit({ status: 'connecting' as InputStatus, error: null, source: 'device' });
    // iPad: the audio session must allow recording before the input opens
    this.beginCapture();
    // A newer request (seq moved on) owns the capture now: only the latest one may end it
    const gaveUp = () => { if (!this.stream && seq === this.connectSeq) this.endCapture(); };
    let stream: MediaStream | null = null;
    try {
      stream = await md.getUserMedia({ audio: constraints(this.cfg.deviceId), video: false });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if ((name === 'OverconstrainedError' || name === 'NotFoundError') && this.cfg.deviceId) {
        // The saved device is gone (or has a new id): try the same name, then the default input
        try {
          const id = await findByLabel(this.cfg.label);
          stream = await md.getUserMedia({ audio: constraints(id), video: false });
        } catch (e2) {
          gaveUp();
          if (seq === this.connectSeq) this.fail(e2);
          return;
        }
      } else {
        gaveUp();
        if (seq === this.connectSeq) this.fail(e);
        return;
      }
    }
    if (seq !== this.connectSeq || !this.started || !this.cfg.enabled || this.cfg.source !== 'device') {
      stream.getTracks().forEach(t => t.stop());
      gaveUp();
      return;
    }
    this.releaseSources();
    try {
      this.source = this.ctx.createMediaStreamSource(stream);
    } catch (e) {
      stream.getTracks().forEach(t => t.stop());
      gaveUp();
      this.fail(e);
      return;
    }
    this.stream = stream;
    const track = stream.getAudioTracks()[0];
    const settings = (track?.getSettings?.() ?? {}) as MediaTrackSettings & { latency?: number };
    // Not source.channelCount: that is the node's mixing count (2), not the track's
    this.channels = trackChannels(settings);
    this.source.connect(this.splitIn);
    this.applyMode();
    if (typeof settings.channelCount !== 'number' && this.channels > 1) this.probeMono(stream);
    track?.addEventListener('ended', () => {
      if (this.stream !== stream) return;
      this.release();
      this.emit({ status: 'error' as InputStatus, error: 'The input disconnected. Plug it back in - it reconnects automatically.' });
    });
    this.emit({
      status: 'live' as InputStatus,
      source: 'device',
      error: null,
      deviceLabel: track?.label || 'Audio input',
      deviceId: settings.deviceId ?? null,
      channels: this.channels,
      inputLatency: typeof settings.latency === 'number' ? settings.latency : null,
      sampleRate: settings.sampleRate ?? null,
      // Voice-call processing the browser actually applied (should all be false)
      processing: {
        echoCancellation: settings.echoCancellation ?? null,
        noiseSuppression: settings.noiseSuppression ?? null,
        autoGainControl: settings.autoGainControl ?? null,
      },
    });
  }

  private fail(e: unknown) {
    this.emit({ status: 'error' as InputStatus, error: friendlyError(e) });
  }

  /** Close whatever feeds the input (keeps the capture count: connect() reuses it) */
  private releaseSources() {
    if (this.monoProbe) { clearInterval(this.monoProbe); this.monoProbe = null; }
    try { this.source?.disconnect(); } catch { /* */ }
    this.source = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.stopPractice?.();
    this.stopPractice = null;
    if (this.tone) {
      try { this.tone.stop(); this.tone.disconnect(); } catch { /* */ }
      this.tone = null;
    }
  }

  private release() {
    this.releaseSources();
    this.endCapture();
  }

  private beginCapture() {
    if (this.capturing) return;
    this.capturing = true;
    captureStarted();
  }

  private endCapture() {
    if (!this.capturing) return;
    this.capturing = false;
    captureEnded();
  }

  /**
   * A track that claims two channels but sends digital silence on the second
   * (a mono mic, or Safari, which ignores channelCount) is mono: IN 2 and
   * STEREO would play nothing on one side. Only used when the browser did not
   * report the channel count itself.
   */
  private probeMono(stream: MediaStream) {
    let tries = 0;
    let silentR = 0;
    this.monoProbe = setInterval(() => {
      if (this.stream !== stream || ++tries > 60) {
        if (this.monoProbe) clearInterval(this.monoProbe);
        this.monoProbe = null;
        return;
      }
      const l = this.peak(this.preL);
      const r = this.peak(this.preR);
      if (l > 1e-4 && r === 0) silentR++;
      else if (r > 0) silentR = -1000;
      if (silentR >= 15) {
        if (this.monoProbe) clearInterval(this.monoProbe);
        this.monoProbe = null;
        this.channels = 1;
        this.applyMode();
        this.emit({ channels: 1 });
      }
    }, 50);
  }
}

function constraints(deviceId: string | null | undefined): MediaTrackConstraints {
  const c: MediaTrackConstraints & { latency?: ConstrainDouble } = {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    // Voice-call processing off: a synth needs the raw signal
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 2 },
    // Ask for the smallest input buffer the browser offers (Chrome; ignored elsewhere)
    latency: { ideal: 0 },
  };
  return c;
}

async function findByLabel(label: string | null): Promise<string | null> {
  if (!label) return null;
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.find(d => d.kind === 'audioinput' && d.label === label)?.deviceId ?? null;
  } catch {
    return null;
  }
}

/** True only when the browser says access is already granted (never prompts) */
async function microphoneGranted(): Promise<boolean> {
  try {
    const st = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    return st?.state === 'granted';
  } catch {
    return false;
  }
}

export function friendlyError(e: unknown): string {
  const name = (e as { name?: string })?.name ?? '';
  const msg = e instanceof Error ? e.message : String(e);
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Access to audio inputs was blocked. Allow the microphone for this site (the icon next to the address), then press Connect.';
    case 'NotFoundError':
      return 'No audio input found. Plug in your audio interface (or allow a microphone) and press Connect.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The input is busy or failed to start - another app may be using it exclusively.';
    case 'OverconstrainedError':
      return 'That input is no longer available. Pick another one.';
    case 'NotSupportedError':
      if (/sample.?rate/i.test(msg)) {
        return 'This browser cannot mix an input running at a different sample rate. Set your interface and your output to the same rate (e.g. 48 kHz) and reconnect.';
      }
      return `This browser cannot use that input: ${msg}`;
    default:
      return `Could not open the input: ${msg}`;
  }
}
