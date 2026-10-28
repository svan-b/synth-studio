// ============================================================================
// Audio input engine: an audio interface input (or mic) as a studio instrument.
//
//   getUserMedia (echoCancellation / noiseSuppression / autoGainControl OFF -
//   those are for voice calls and would mangle a synth) -> splitter -> mode
//   matrix (IN 1, IN 2, L+R, STEREO) -> gain -> mute -> main output + jacks.
//
// The stream is only opened after you press Connect, or on load when the
// browser already granted access (so a project never pops a permission prompt).
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine } from '@/lib/audio/engine';
import { asInputData, type AudioInData } from './config';

export type InputStatus = 'off' | 'connecting' | 'live' | 'needs-permission' | 'error';

/** [L->L, R->L, L->R, R->R] per MODE option */
const MATRIX: Record<number, [number, number, number, number]> = {
  0: [1, 0, 1, 0],         // IN 1: input 1 to both sides
  1: [0, 1, 0, 1],         // IN 2
  2: [0.5, 0.5, 0.5, 0.5], // L+R summed to mono
  3: [1, 0, 0, 1],         // STEREO
};

const dbToGain = (db: number) => Math.pow(10, db / 20);

export class AudioInEngine extends BaseEngine {
  private cfg: AudioInData = asInputData(undefined);
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private splitIn!: ChannelSplitterNode;
  private matrix!: GainNode[];
  private merge!: ChannelMergerNode;
  private gain!: GainNode;
  private mute!: GainNode;
  private meterL!: AnalyserNode;
  private meterR!: AnalyserNode;
  private meterBuf = new Float32Array(1024);
  private channels = 0;
  private connectSeq = 0;
  private wantKey = '';
  private clipUntil = 0;
  private onDeviceChange = () => { if (this.cfg.enabled && !this.stream) void this.connect(true); };

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

    // Meters read the signal after GAIN, before MUTE (so you can set levels while muted)
    const meterSplit = ctx.createChannelSplitter(2);
    this.meterL = ctx.createAnalyser();
    this.meterR = ctx.createAnalyser();
    [this.meterL, this.meterR].forEach(a => { a.fftSize = 1024; });
    this.gain.connect(meterSplit);
    meterSplit.connect(this.meterL, 0);
    meterSplit.connect(this.meterR, 1);

    // Patchable outputs (post-mute), e.g. into a twin's external input
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
      this.release();
    });
    this.emit({ status: 'off' as InputStatus, channels: 0 });
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
    const key = `${this.cfg.enabled}|${this.cfg.deviceId ?? ''}`;
    if (key === this.wantKey) return;
    this.wantKey = key;
    if (this.cfg.enabled) void this.connect(true);
    else {
      this.release();
      this.emit({ status: 'off' as InputStatus, error: null, deviceLabel: null, channels: 0, inputLatency: null });
    }
  }

  /** The Connect button (a user gesture, so the browser may ask for permission) */
  event(name: string): void {
    if (name === 'connect') void this.connect(false);
  }

  /** Peak levels since the last call, for the meter (0..1 linear) */
  levels(): { l: number; r: number; clip: boolean } {
    if (!this.started || !this.stream) return { l: 0, r: 0, clip: false };
    const peak = (a: AnalyserNode) => {
      a.getFloatTimeDomainData(this.meterBuf);
      let p = 0;
      for (let i = 0; i < this.meterBuf.length; i++) { const v = Math.abs(this.meterBuf[i]); if (v > p) p = v; }
      return p;
    };
    const l = peak(this.meterL);
    const r = peak(this.meterR);
    const now = performance.now();
    if (l >= 0.99 || r >= 0.99) this.clipUntil = now + 1200;
    return { l, r, clip: now < this.clipUntil };
  }

  private async connect(auto: boolean) {
    const seq = ++this.connectSeq;
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md?.getUserMedia) {
      this.emit({
        status: 'error' as InputStatus,
        error: typeof window !== 'undefined' && window.isSecureContext === false
          ? 'Audio input needs a secure page: open Synth Studio over https:// (or localhost).'
          : 'This browser cannot open audio inputs.',
      });
      return;
    }
    if (auto) {
      const granted = await microphoneGranted();
      if (seq !== this.connectSeq) return; // a Connect press took over
      if (!granted) {
        this.emit({ status: 'needs-permission' as InputStatus, error: null });
        return;
      }
    }
    this.emit({ status: 'connecting' as InputStatus, error: null });
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
          if (seq === this.connectSeq) this.fail(e2);
          return;
        }
      } else {
        if (seq === this.connectSeq) this.fail(e);
        return;
      }
    }
    if (seq !== this.connectSeq || !this.started || !this.cfg.enabled) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }
    this.release();
    try {
      this.source = this.ctx.createMediaStreamSource(stream);
    } catch (e) {
      stream.getTracks().forEach(t => t.stop());
      this.fail(e);
      return;
    }
    this.stream = stream;
    const track = stream.getAudioTracks()[0];
    const settings = (track?.getSettings?.() ?? {}) as MediaTrackSettings & { latency?: number };
    this.channels = settings.channelCount ?? this.source.channelCount ?? 2;
    this.source.connect(this.splitIn);
    this.applyMode();
    track?.addEventListener('ended', () => {
      if (this.stream !== stream) return;
      this.release();
      this.emit({ status: 'error' as InputStatus, error: 'The input disconnected. Plug it back in - it reconnects automatically.' });
    });
    this.emit({
      status: 'live' as InputStatus,
      error: null,
      deviceLabel: track?.label || 'Audio input',
      deviceId: settings.deviceId ?? null,
      channels: this.channels,
      inputLatency: typeof settings.latency === 'number' ? settings.latency : null,
      sampleRate: settings.sampleRate ?? null,
    });
  }

  private fail(e: unknown) {
    this.emit({ status: 'error' as InputStatus, error: friendlyError(e) });
  }

  private release() {
    try { this.source?.disconnect(); } catch { /* */ }
    this.source = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }
}

function constraints(deviceId: string | null | undefined): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    // Voice-call processing off: a synth needs the raw signal
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 2 },
  };
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
