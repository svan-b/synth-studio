/**
 * Piano sound engine.
 *
 * Plays a sampled grand piano (Salamander Grand Piano by Alexander Holm,
 * CC BY 3.0) through the Web Audio API. One sample is stored every minor
 * third and shifted by at most one semitone to reach the notes between.
 */

import { Emitter, clamp } from '../util/emitter';
import { midiToFreq } from '../music/theory';

const SAMPLE_NOTES = [
  21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105,
  108,
];
const SAMPLE_BASE = '/piano/samples';
const MAX_VOICES = 40;

interface Sample {
  buffer: AudioBuffer;
  /** Seconds of silence before the hammer strike, skipped on playback. */
  offset: number;
}

interface Voice {
  midi: number;
  source: AudioBufferSourceNode | OscillatorNode;
  gain: GainNode;
  startedAt: number;
  released: boolean;
  /** Key is up but the sustain pedal is holding the note. */
  pedalHeld: boolean;
}

export interface AudioStatus {
  state: 'idle' | 'loading' | 'ready' | 'error';
  /** 0 to 1 while samples load. */
  progress: number;
  running: boolean;
}

type AnyAudioContext = AudioContext;

function getContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

class PianoEngine {
  ctx: AnyAudioContext | null = null;
  private master: GainNode | null = null;
  private pianoBus: GainNode | null = null;
  private clickBus: GainNode | null = null;
  private samples = new Map<number, Sample>();
  private voices: Voice[] = [];
  private loadPromise: Promise<void> | null = null;
  private pedalDown = false;
  private pianoVolume = 0.9;
  private clickVolume = 0.6;

  readonly status = new Emitter<AudioStatus>();
  private current: AudioStatus = { state: 'idle', progress: 0, running: false };

  getStatus(): AudioStatus {
    return this.current;
  }

  private setStatus(patch: Partial<AudioStatus>): void {
    this.current = { ...this.current, ...patch };
    this.status.emit(this.current);
  }

  /** Current audio clock in seconds. Falls back to wall time before unlock. */
  now(): number {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  /** How long after scheduling a sound actually leaves the speaker. */
  outputLatency(): number {
    if (!this.ctx) return 0;
    const c = this.ctx as AudioContext & { outputLatency?: number };
    const lat = (c.outputLatency ?? 0) + (c.baseLatency ?? 0);
    return Number.isFinite(lat) ? clamp(lat, 0, 0.25) : 0;
  }

  /**
   * Must be called from a user gesture (a tap). Creates and resumes the audio
   * context, then starts loading samples.
   */
  async unlock(): Promise<void> {
    const Ctor = getContextCtor();
    if (!Ctor) {
      this.setStatus({ state: 'error' });
      return;
    }
    if (!this.ctx) {
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.buildGraph();
      this.ctx.onstatechange = () => this.setStatus({ running: this.isRunning() });
    }
    this.setSessionType('playback');
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* resumed later by the next gesture */
      }
    }
    // A one sample buffer wakes the output on older iOS versions.
    try {
      const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
    this.setStatus({ running: this.isRunning() });
    void this.load();
  }

  private isRunning(): boolean {
    return (this.ctx?.state as string | undefined) === 'running';
  }

  /** Resume after the page was hidden or interrupted. Safe to call any time. */
  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* needs a gesture */
      }
      this.setStatus({ running: this.isRunning() });
    }
  }

  /** iOS: choose whether audio should also record, and ignore the mute switch. */
  setSessionType(type: 'playback' | 'play-and-record'): void {
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = type;
    } catch {
      /* not supported */
    }
  }

  private buildGraph(): void {
    const ctx = this.ctx!;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 14;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.pianoBus = ctx.createGain();
    this.pianoBus.gain.value = this.pianoVolume * 1.5;
    this.clickBus = ctx.createGain();
    this.clickBus.gain.value = this.clickVolume;
    this.pianoBus.connect(comp);
    comp.connect(this.master);
    this.clickBus.connect(this.master);
    this.master.connect(ctx.destination);
  }

  setPianoVolume(v: number): void {
    this.pianoVolume = clamp(v, 0, 1);
    if (this.pianoBus && this.ctx) this.pianoBus.gain.setTargetAtTime(this.pianoVolume * 1.5, this.ctx.currentTime, 0.02);
  }

  setClickVolume(v: number): void {
    this.clickVolume = clamp(v, 0, 1);
    if (this.clickBus && this.ctx) this.clickBus.gain.setTargetAtTime(this.clickVolume, this.ctx.currentTime, 0.02);
  }

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadSamples().catch(() => {
        // Keep whatever loaded. Missing notes fall back to a simple synth.
        this.setStatus({ state: this.samples.size > 0 ? 'ready' : 'error', progress: 1 });
      });
    }
    return this.loadPromise;
  }

  private async loadSamples(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    this.setStatus({ state: 'loading', progress: 0 });
    let done = 0;
    // Middle of the keyboard first, so early taps already sound right.
    const order = SAMPLE_NOTES.slice().sort((a, b) => Math.abs(a - 62) - Math.abs(b - 62));
    const queue = order.slice();
    const worker = async () => {
      while (queue.length > 0) {
        const note = queue.shift()!;
        try {
          const res = await fetch(`${SAMPLE_BASE}/${note}.mp3`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.arrayBuffer();
          const buffer = await decode(ctx, data);
          this.samples.set(note, { buffer, offset: findOnset(buffer) });
        } catch {
          /* this note falls back to its neighbours or the synth */
        }
        done++;
        this.setStatus({ progress: done / SAMPLE_NOTES.length });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    this.setStatus({ state: this.samples.size > 0 ? 'ready' : 'error', progress: 1 });
  }

  private nearestSample(midi: number): { sample: Sample; root: number } | null {
    let best: { sample: Sample; root: number } | null = null;
    let bestDist = Infinity;
    this.samples.forEach((sample, root) => {
      const d = Math.abs(root - midi);
      if (d < bestDist) {
        bestDist = d;
        best = { sample, root };
      }
    });
    // Further than a fourth sounds wrong, prefer the synth fallback then.
    return bestDist <= 5 ? best : null;
  }

  /**
   * Start a note. Velocity runs from 0 to 1. `when` is an audio clock time,
   * and defaults to now.
   */
  noteOn(midi: number, velocity = 0.7, when?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.pianoBus) return;
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
    const v = clamp(velocity, 0.02, 1);

    // Re-striking a key damps the previous strike of that key.
    for (const voice of this.voices) {
      if (voice.midi === midi && !voice.released) this.releaseVoice(voice, t, 0.03);
    }
    if (this.voices.length >= MAX_VOICES) {
      const oldest = this.voices[0];
      this.releaseVoice(oldest, t, 0.02);
    }

    const gain = ctx.createGain();
    const level = 0.12 + 1.0 * Math.pow(v, 1.7);
    let source: AudioBufferSourceNode | OscillatorNode;
    const hit = this.nearestSample(midi);

    if (hit) {
      const src = ctx.createBufferSource();
      src.buffer = hit.sample.buffer;
      src.playbackRate.value = Math.pow(2, (midi - hit.root) / 12);
      gain.gain.setValueAtTime(level, t);
      if (v < 0.55) {
        // Soft notes are mellower, so close a low pass filter as velocity drops.
        const f0 = midiToFreq(midi);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 0.3;
        filter.frequency.value = clamp(f0 * (3 + 60 * v * v), 700, 18000);
        src.connect(filter);
        filter.connect(gain);
      } else {
        src.connect(gain);
      }
      src.start(t, hit.sample.offset);
      source = src;
    } else {
      // Simple fallback voice so the app is never silent.
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midiToFreq(midi);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(level * 0.35, t + 0.008);
      gain.gain.setTargetAtTime(0.0001, t + 0.01, 0.9);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 6);
      source = osc;
    }
    gain.connect(this.pianoBus);

    const voice: Voice = { midi, source, gain, startedAt: t, released: false, pedalHeld: false };
    this.voices.push(voice);
    source.onended = () => {
      const i = this.voices.indexOf(voice);
      if (i >= 0) this.voices.splice(i, 1);
      try {
        gain.disconnect();
      } catch {
        /* already gone */
      }
    };
  }

  noteOff(midi: number, when?: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
    for (const voice of this.voices) {
      if (voice.midi !== midi || voice.released) continue;
      if (this.pedalDown && t <= ctx.currentTime + 0.05) {
        voice.pedalHeld = true;
      } else {
        this.releaseVoice(voice, t);
      }
    }
  }

  private releaseVoice(voice: Voice, t: number, tau?: number): void {
    if (voice.released) return;
    voice.released = true;
    // The top octave and a half of a piano has no dampers.
    const natural = voice.midi >= 90 ? 0.5 : 0.085;
    const timeConstant = tau ?? natural;
    try {
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setTargetAtTime(0, t, timeConstant);
      voice.source.stop(t + timeConstant * 8 + 0.05);
    } catch {
      /* already stopped */
    }
  }

  /** Play a note for a set length in seconds. */
  play(midi: number, seconds: number, velocity = 0.7, when?: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
    this.noteOn(midi, velocity, t);
    this.noteOff(midi, t + Math.max(0.05, seconds));
  }

  setPedal(down: boolean): void {
    this.pedalDown = down;
    if (!down && this.ctx) {
      const t = this.ctx.currentTime;
      for (const voice of this.voices) {
        if (voice.pedalHeld && !voice.released) this.releaseVoice(voice, t, 0.12);
      }
    }
  }

  /** Stop everything quickly, used when leaving an activity. */
  allOff(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.pedalDown = false;
    for (const voice of this.voices.slice()) this.releaseVoice(voice, t, 0.04);
  }

  /** Metronome click. Accent marks the first beat of a measure. */
  click(when?: number, accent = false, level = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.clickBus) return;
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 1760 : 1174.7, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime((accent ? 0.75 : 0.5) * level, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    osc.connect(gain);
    gain.connect(this.clickBus);
    osc.start(t);
    osc.stop(t + 0.08);
    osc.onended = () => {
      try {
        gain.disconnect();
      } catch {
        /* already gone */
      }
    };
  }

  /** A soft two note chime for finishing something. */
  chime(when?: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
    this.play(79, 0.5, 0.35, t);
    this.play(84, 0.9, 0.4, t + 0.12);
  }
}

function decode(ctx: AnyAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // The callback form works on every Safari version.
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
    if (p && typeof p.catch === 'function') p.catch(reject);
  });
}

/** Find where the sound really begins, to skip MP3 padding and room silence. */
function findOnset(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const limit = Math.min(data.length, Math.floor(buffer.sampleRate * 0.25));
  let peak = 0;
  for (let i = 0; i < limit; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
  }
  const threshold = peak * 0.02;
  for (let i = 0; i < limit; i++) {
    if (Math.abs(data[i]) > threshold) {
      return Math.max(0, i - Math.floor(buffer.sampleRate * 0.002)) / buffer.sampleRate;
    }
  }
  return 0;
}

export const piano = new PianoEngine();
