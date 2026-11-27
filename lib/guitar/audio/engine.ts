/**
 * The app's guitar.
 *
 * Every note is a plucked string made by `synth.ts`, rendered once and kept.
 * Each string has one voice, so a new note on a string stops the old one, as
 * it does on a real guitar. Strums cross the strings a few hundredths of a
 * second apart, low to high going down and high to low coming up.
 *
 * The sound is meant to be heard across a room next to an acoustic guitar,
 * which is loud. So every note is brought to the same level before it is
 * played, and a limiter at the end lets the whole thing run hot without
 * distorting. The level actually leaving the app can be read, for the sound
 * check that compares it with the learner's guitar.
 */

import { firstPosition, type StringNo } from '../music/theory';
import { Emitter, clamp } from '../util/emitter';
import { CLICK_HZ } from './click';
import { APP_PLUCK, BODY, Biquad, VOICE, pluck, rmsDb, ringSeconds, snapFor, strumTiming } from './synth';

export interface AudioStatus {
  state: 'idle' | 'ready' | 'error';
  running: boolean;
}

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  ends: number;
}

type Ctx = AudioContext;

function contextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

/** Level each note is brought to before velocity, in dB below full scale, as a small speaker would give it. */
const NOTE_LEVEL_DB = -19;
/**
 * An iPad's speaker gives little below a couple of hundred hertz. A note's
 * level is read above that, so the low strings come out as loud to the ear
 * as the high ones. The lift this gives a low note is held to a few dB, so
 * through headphones the bass strings do not boom.
 */
const SPEAKER_HZ = 190;
const LOW_NOTE_LIFT_DB = 6;

/** Milliseconds an iPad takes to bring sound back to full strength once the microphone is let go. */
const SETTLE_MS = 280;
/** How hard the guitar is pushed into the stage that holds its level steady. */
const DRIVE = 1.6;

/** A curve that leaves quiet sound alone and rounds the loudest moments off below full scale, so the pick's first instant does not set the level for the whole note. */
function roundOff(knee = 0.8, top = 0.98): Float32Array {
  const n = 2049;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + (top - knee) * Math.tanh((a - knee) / (top - knee));
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}
/** Notes the course plays most, made ready ahead of time so the first strum is not late. */
const COMMON = [40, 42, 43, 45, 47, 48, 50, 52, 54, 55, 56, 57, 59, 60, 61, 62, 64, 65, 66, 67, 69];

class GuitarEngine {
  ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private guitarBus: GainNode | null = null;
  private clickBus: GainNode | null = null;
  private mix: GainNode | null = null;
  private meter: AnalyserNode | null = null;
  private meterBuf: Float32Array | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<StringNo | 'free', Voice[]>();
  private volume = 1;
  private clickVolume = 0.7;
  private knownLatency = 0;
  private warmed = false;
  private variant = 0;
  private recording = false;
  private pausing = false;
  private recovering: ReturnType<typeof setTimeout> | null = null;

  readonly status = new Emitter<AudioStatus>();
  private current: AudioStatus = { state: 'idle', running: false };

  getStatus(): AudioStatus {
    return this.current;
  }

  private setStatus(patch: Partial<AudioStatus>): void {
    this.current = { ...this.current, ...patch };
    this.status.emit(this.current);
  }

  /** Audio clock in seconds, or wall time before sound starts. */
  now(): number {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  /** Everything the app plays, just before the speaker. */
  get outlet(): AudioNode | null {
    return this.master;
  }

  /**
   * Seconds from scheduling a sound to hearing it. The last figure the
   * browser gave is kept, since it can report nothing for a moment.
   */
  outputLatency(): number {
    if (!this.ctx) return 0;
    const c = this.ctx as AudioContext & { outputLatency?: number };
    const lat = (c.outputLatency ?? 0) + (c.baseLatency ?? 0);
    if (Number.isFinite(lat) && lat > 0) this.knownLatency = clamp(lat, 0, 0.25);
    return this.knownLatency;
  }

  /** Start sound. Browsers allow it only in answer to a tap, except inside the iPad app. */
  async unlock(): Promise<void> {
    const Ctor = contextCtor();
    if (!Ctor) {
      this.setStatus({ state: 'error' });
      return;
    }
    if (!this.ctx) {
      // Before any sound: play as a music app does, at the ordinary volume and whatever the silent switch says.
      if (!this.recording) this.setSessionType('playback');
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.build();
      this.ctx.onstatechange = () => {
        this.setStatus({ running: this.running() });
        this.recover();
      };
    } else if (this.running()) {
      this.warm();
      return;
    }
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* the next tap will do it */
      }
    }
    // A one sample sound wakes the output on older iPads.
    try {
      const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const s = this.ctx.createBufferSource();
      s.buffer = b;
      s.connect(this.ctx.destination);
      s.start(0);
    } catch {
      /* not needed here */
    }
    this.setStatus({ state: 'ready', running: this.running() });
    this.warm();
  }

  private running(): boolean {
    return (this.ctx?.state as string | undefined) === 'running';
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* needs a tap */
      }
      this.setStatus({ running: this.running() });
    }
  }

  /**
   * The iPad stops sound for a moment when what it is used for changes, and
   * when another app or a call takes it. Unless the page was put away, start
   * it again without waiting for a tap.
   */
  private recover(): void {
    const ctx = this.ctx;
    if (!ctx || this.running() || this.pausing) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (this.recovering) return;
    this.recovering = setTimeout(() => {
      this.recovering = null;
      if (!this.ctx || this.running() || this.pausing) return;
      void this.ctx.resume().catch(() => undefined);
    }, 150);
  }

  /**
   * iPad: say whether the microphone is in use as well. With it, sound plays
   * and records at once. Without it, sound plays even with the silent switch on.
   * Returns whether the iPad could be told.
   */
  setSessionType(type: 'playback' | 'play-and-record'): boolean {
    this.recording = type === 'play-and-record';
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (!nav.audioSession) return false;
      if (nav.audioSession.type !== type) nav.audioSession.type = type;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * The microphone has just been let go, on a device that plays sound poorly
   * while it is held. Put sound back to its ordinary strength, and wait until
   * it has settled, so what plays next is not caught in the change.
   */
  async toPlayback(): Promise<void> {
    const told = this.setSessionType('playback');
    const ctx = this.ctx;
    if (!ctx) return;
    this.stopAll();
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    if (!told) {
      // An older iPad cannot be told. Stopping sound for an instant makes it look again at what the page is doing.
      this.pausing = true;
      try {
        await Promise.race([ctx.suspend(), wait(400)]);
        await wait(120);
        await Promise.race([ctx.resume(), wait(600)]);
      } catch {
        /* carry on as it is */
      }
      this.pausing = false;
    }
    await wait(SETTLE_MS);
    for (let i = 0; i < 8 && !this.running(); i++) {
      await this.resume();
      if (!this.running()) await wait(120);
    }
  }

  private build(): void {
    const ctx = this.ctx!;
    this.guitarBus = ctx.createGain();
    this.guitarBus.gain.value = this.volume * this.volume;
    let node: AudioNode = this.guitarBus;
    for (const f of [...BODY, ...VOICE]) {
      const bq = ctx.createBiquadFilter();
      bq.type = f.type;
      bq.frequency.value = f.freq;
      if (f.type === 'peaking') {
        bq.Q.value = f.q;
        bq.gain.value = f.gain;
      } else if (f.type === 'highpass') {
        bq.Q.value = f.q;
      } else {
        bq.gain.value = f.gain;
      }
      node.connect(bq);
      node = bq;
    }
    // Loudness. A plucked string is a sharp instant followed by a much quieter ring, and it is the ring the ear takes for
    // how loud a guitar is. So the sound is pushed up, a compressor evens the ring out, the first instant of each pick is
    // rounded off, and a limiter guards the top. A small speaker can then be driven close to its limit without distortion.
    const drive = ctx.createGain();
    drive.gain.value = DRIVE;
    node.connect(drive);
    const even = ctx.createDynamicsCompressor();
    even.threshold.value = -20;
    even.knee.value = 8;
    even.ratio.value = 4;
    even.attack.value = 0.005;
    even.release.value = 0.18;
    drive.connect(even);
    const round = ctx.createWaveShaper();
    round.curve = roundOff() as Float32Array<ArrayBuffer>;
    round.oversample = '4x';
    even.connect(round);
    this.mix = ctx.createGain();
    round.connect(this.mix);
    this.clickBus = ctx.createGain();
    this.clickBus.gain.value = Math.sqrt(this.clickVolume);
    this.clickBus.connect(this.mix);
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    this.mix.connect(limiter);
    this.master = ctx.createGain();
    // A little short of full scale, for the peaks that fall between samples.
    this.master.gain.value = 0.94;
    limiter.connect(this.master);
    this.meter = ctx.createAnalyser();
    this.meter.fftSize = 2048;
    this.meterBuf = new Float32Array(this.meter.fftSize);
    this.master.connect(this.meter);
    this.master.connect(ctx.destination);
  }

  /** The level leaving the app right now, in dB below full scale. */
  outputLevelDb(): number {
    if (!this.meter || !this.meterBuf) return -100;
    this.meter.getFloatTimeDomainData(this.meterBuf as Float32Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < this.meterBuf.length; i++) sum += this.meterBuf[i] * this.meterBuf[i];
    return 10 * Math.log10(sum / this.meterBuf.length + 1e-12);
  }

  setVolume(v: number): void {
    this.volume = clamp(v, 0, 1);
    if (this.guitarBus && this.ctx) this.guitarBus.gain.setTargetAtTime(this.volume * this.volume, this.ctx.currentTime, 0.02);
  }

  setClickVolume(v: number): void {
    this.clickVolume = clamp(v, 0, 1);
    if (this.clickBus && this.ctx) this.clickBus.gain.setTargetAtTime(Math.sqrt(this.clickVolume), this.ctx.currentTime, 0.02);
  }

  /** A rendered note, made the first time it is asked for. Two takes of each note keep repeated notes from sounding mechanical. */
  bufferFor(midi: number, take = 0): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const key = `${midi}:${take % 2}`;
    let buf = this.buffers.get(key);
    if (!buf) {
      const rate = ctx.sampleRate;
      const data = pluck(midi, rate, {
        velocity: APP_PLUCK.velocity,
        position: APP_PLUCK.position,
        snap: Math.min(1, snapFor(midi) + APP_PLUCK.snapLift),
        seconds: Math.min(4, ringSeconds(midi) * 0.75),
        seed: midi * 31 + (take % 2) * 7 + 1,
      });
      // Each note is brought to the same level over its first quarter of a second, as a small speaker would give it.
      const span = Math.round(0.25 * rate);
      const whole = rmsDb(data, 0, span);
      const heard = data.slice(0, span);
      Biquad.highpass(rate, SPEAKER_HZ, 0.6).process(heard);
      const level = Math.max(rmsDb(heard), whole - LOW_NOTE_LIFT_DB);
      const gain = Math.pow(10, (NOTE_LEVEL_DB - level) / 20);
      for (let i = 0; i < data.length; i++) data[i] *= gain;
      buf = ctx.createBuffer(1, data.length, rate);
      buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      this.buffers.set(key, buf);
    }
    return buf;
  }

  /** Make the common notes ready a few at a time, so nothing waits on the first strum. */
  private warm(): void {
    if (this.warmed || !this.ctx) return;
    this.warmed = true;
    const queue = COMMON.slice();
    const step = () => {
      for (let i = 0; i < 3 && queue.length > 0; i++) this.bufferFor(queue.shift()!);
      if (queue.length > 0) setTimeout(step, 30);
    };
    setTimeout(step, 50);
  }

  /**
   * Pluck one note. `string` says which string it is on, so the note before
   * it on that string stops. Returns when the note will end.
   */
  pluck(midi: number, when?: number, opts: { velocity?: number; string?: StringNo | null; seconds?: number; into?: AudioNode } = {}): number {
    const ctx = this.ctx;
    if (!ctx || !this.guitarBus) return 0;
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
    const buf = this.bufferFor(midi, this.variant++);
    if (!buf) return 0;
    const velocity = clamp(opts.velocity ?? 0.75, 0.05, 1);
    const str: StringNo | 'free' = opts.string === undefined ? (firstPosition(midi)?.string ?? 'free') : (opts.string ?? 'free');
    if (!opts.into) this.damp(str, t);
    const source = ctx.createBufferSource();
    source.buffer = buf;
    const gain = ctx.createGain();
    // Velocity sets level on a curve: soft notes are clearly softer, loud ones only a little louder.
    const level = Math.pow(velocity, 1.4) * 1.25;
    gain.gain.setValueAtTime(level, t);
    const seconds = opts.seconds ?? buf.duration;
    const ends = t + Math.min(seconds, buf.duration);
    if (seconds < buf.duration) {
      gain.gain.setValueAtTime(level, ends);
      gain.gain.exponentialRampToValueAtTime(0.0001, ends + 0.12);
    }
    source.connect(gain);
    gain.connect(opts.into ?? this.guitarBus);
    source.start(t);
    source.stop(Math.min(t + buf.duration, ends + 0.15));
    const voice: Voice = { source, gain, ends };
    if (!opts.into) {
      const list = this.voices.get(str) ?? [];
      list.push(voice);
      this.voices.set(str, list);
    }
    source.onended = () => {
      try {
        gain.disconnect();
      } catch {
        /* gone */
      }
      const list = this.voices.get(str);
      if (list) {
        const i = list.indexOf(voice);
        if (i >= 0) list.splice(i, 1);
      }
    };
    return ends;
  }

  /** A string is touched again: what it was sounding stops. */
  private damp(str: StringNo | 'free', t: number): void {
    if (str === 'free') return;
    for (const v of this.voices.get(str) ?? []) {
      if (v.ends <= t) continue;
      try {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setTargetAtTime(0, t, 0.012);
        v.source.stop(t + 0.08);
        v.ends = t;
      } catch {
        /* already stopped */
      }
    }
  }

  /**
   * Strum the given strings. `notes` pairs each string with the note it
   * sounds. The strum begins at `when`, and the last string sounds a few
   * hundredths of a second later. Returns when the strum will have died away.
   */
  strum(notes: Array<{ string: StringNo; midi: number }>, when?: number, opts: { dir?: 'down' | 'up'; velocity?: number; spread?: number; seconds?: number; into?: AudioNode } = {}): number {
    const ctx = this.ctx;
    if (!ctx || notes.length === 0) return 0;
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
    const dir = opts.dir ?? 'down';
    const byMidi = new Map<number, StringNo>();
    for (const n of notes) byMidi.set(n.midi, n.string);
    const timing = strumTiming(
      notes.map((n) => n.midi),
      dir,
      opts.velocity ?? 0.75,
      opts.spread ?? 0.011,
      Math.floor(t * 1000),
    );
    let ends = t;
    for (const s of timing) {
      ends = Math.max(ends, this.pluck(s.midi, t + s.offset, { velocity: s.velocity, string: byMidi.get(s.midi) ?? null, seconds: opts.seconds, into: opts.into }));
    }
    return ends;
  }

  /** Stop everything at once, as a hand laid across the strings. */
  stopAll(): void {
    const t = this.now();
    for (const key of Array.from(this.voices.keys())) this.damp(key, t);
  }

  /**
   * The metronome. Its pitch sits between frets, so the note detector can tell it from a string.
   * It has to be heard over the learner's own guitar, and it plays while the microphone is open,
   * when an iPad gives sound less volume, so it is as strong as a single tone can be.
   */
  click(when?: number, accent = false, level = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.clickBus) return;
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? CLICK_HZ.accent : CLICK_HZ.beat, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime((accent ? 1 : 0.8) * level, t + 0.0015);
    gain.gain.setValueAtTime((accent ? 1 : 0.8) * level, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
    osc.connect(gain);
    gain.connect(this.clickBus);
    osc.start(t);
    osc.stop(t + 0.1);
    osc.onended = () => {
      try {
        gain.disconnect();
      } catch {
        /* gone */
      }
    };
  }

  /** A small bright pair of notes for something done well. */
  chime(when?: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
    this.pluck(76, t, { velocity: 0.45, string: null, seconds: 0.6 });
    this.pluck(83, t + 0.11, { velocity: 0.5, string: null, seconds: 1.1 });
  }
}

export const guitar = new GuitarEngine();
