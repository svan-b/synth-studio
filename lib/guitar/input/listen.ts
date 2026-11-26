/**
 * Listening: hears the guitar through the microphone.
 *
 * Sound comes in raw, with the voice processing a phone call would use
 * switched off, since it would mangle a guitar. Three things are read from
 * it: notes and strikes for the lessons (see dsp/tracker.ts), a steady pitch
 * for the tuner (dsp/pitch.ts), and the input level.
 *
 * The app's own sound reaches the microphone too. Demonstrations are ignored
 * while they play (see `suppress`), and the detector knows the pitch of the
 * metronome click, which sits between frets.
 *
 * It can also record the learner's playing, so they can hear it back.
 *
 * On an iPad the microphone is held only while the learner is playing. While
 * a web page there holds the microphone, the iPad plays all of its sound the
 * way it would for a video call: at the call volume, which is lower and set
 * apart from the ordinary one, and with a thin tone made for voices. Nothing
 * the page or the app around it can do changes that (WebKit bugs 218012,
 * 236219 and 311451). So when the app is about to play something for the
 * learner to hear well, an example or a note to tune to, the microphone
 * steps aside until it has finished, and screens that do not listen at all
 * do not hold it. Only the click, the count in and the chime play while it
 * is open.
 */

import { CLICK_FREQS } from '../audio/click';
import { guitar } from '../audio/engine';
import { PitchDetector, type PitchReading } from '../dsp/pitch';
import { GuitarTracker } from '../dsp/tracker';
import { isNative } from '../native/bridge';
import { Emitter } from '../util/emitter';
import { emitNote, emitStrike } from './bus';

export interface ListenStatus {
  /**
   * `resting` is listening that has been agreed to and is wanted, with the
   * microphone set aside for a moment while the app itself plays.
   */
  state: 'idle' | 'starting' | 'listening' | 'resting' | 'denied' | 'error';
  /** Input level in dB below full scale, a few times a second. */
  level: number;
  error: string | null;
  /** Notes heard since listening began. */
  heard: number;
  /** The input the sound comes in through, as the device names it. */
  source: string;
}

export interface PitchEvent extends PitchReading {
  time: number;
}

/** Seconds of sound the tuner reads at once. Long enough for several periods of the low E string. */
const PITCH_SECONDS = 0.09;
/** How long after the last listening screen has gone the microphone is let go, so moving from one to the next does not open it twice. */
const IDLE_MS = 1500;

/** Is this a device that plays sound poorly while a page holds the microphone? iPads and iPhones do. */
function micDimsSound(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isNative()) return true;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}

class Listener {
  readonly status = new Emitter<ListenStatus>();
  /** A steady stream of pitch readings while the tuner wants them. */
  readonly pitch = new Emitter<PitchEvent | null>();
  private current: ListenStatus = { state: 'idle', level: -100, error: null, heard: 0, source: '' };
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioNode | null = null;
  private sink: GainNode | null = null;
  private tracker: GuitarTracker | null = null;
  private detector: PitchDetector | null = null;
  private expected: Set<number> | null = null;
  private suppressUntil = -Infinity;
  private lastStatusAt = 0;
  private pitchWanted = 0;
  private pitchBuf: Float32Array | null = null;
  private pitchFill = 0;
  private pitchRate = 0;
  private sinceReading = 0;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private opening: Promise<boolean> | null = null;
  /** The learner has agreed to listening: a tap in a browser, and at once inside the iPad app. */
  private agreed = false;
  /** Listening was started with no screen asking for it, as the checks do. It then stays until stopped. */
  private pinned = false;
  /** Screens up now that listen. */
  private users = 0;
  /** Examples the app is playing now. */
  private asides = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private workletFor: BaseAudioContext | null = null;
  private tuning = 0;
  /** For checks on a computer: behave as an iPad does, where the microphone steps aside for the app's own sound. */
  forceAside: boolean | null = null;

  getStatus(): ListenStatus {
    return this.current;
  }

  get active(): boolean {
    return this.current.state === 'listening';
  }

  /** Has the learner agreed to listening, so it can start again without a tap? */
  get agreedTo(): boolean {
    return this.agreed;
  }

  /** Does the microphone step aside for the app's own sound on this device? */
  get stepsAside(): boolean {
    return this.forceAside ?? micDimsSound();
  }

  /** Should the microphone be open right now? */
  private get wanted(): boolean {
    if (!this.agreed) return false;
    if (!this.stepsAside) return true;
    return this.asides === 0 && (this.users > 0 || this.pinned);
  }

  /** Where sound enters the detector. The development robot plays straight into it. */
  get inlet(): AudioNode | null {
    return this.node;
  }

  private set(patch: Partial<ListenStatus>): void {
    this.current = { ...this.current, ...patch };
    this.status.emit(this.current);
  }

  /**
   * Start listening. In a browser, call it from a tap the first time.
   *
   * Called with no screen asking to listen, as the checks do, the microphone
   * is held until `stop`. A screen calls it with `hold` false: it has said
   * what it wants through `use`, and this only records that the learner agreed.
   */
  start(hold = true): Promise<boolean> {
    this.agreed = true;
    if (hold && this.users === 0) this.pinned = true;
    return this.sync();
  }

  /**
   * A screen that listens is up. Returns a function to call when it goes
   * away. Once no screen listens, the microphone is let go.
   */
  use(): () => void {
    this.users++;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.agreed) void this.sync();
    let gone = false;
    return () => {
      if (gone) return;
      gone = true;
      this.users = Math.max(0, this.users - 1);
      if (this.users > 0) return;
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        this.idleTimer = null;
        void this.sync();
      }, IDLE_MS);
    };
  }

  /**
   * The app is about to play something for the learner to hear well. Where
   * the microphone would spoil it, the microphone steps aside first, and
   * this resolves once sound is back at full strength. Call what it returns
   * when the sound has finished, and listening picks up again.
   */
  async stepAside(): Promise<() => void> {
    this.asides++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.asides = Math.max(0, this.asides - 1);
      if (this.asides === 0) void this.sync();
    };
    if (!this.stepsAside) return release;
    if (this.opening) await this.opening.catch(() => false);
    if (this.stream) {
      this.shut();
      await guitar.toPlayback();
    }
    return release;
  }

  /** Open or close the microphone to match what is wanted now. */
  private sync(): Promise<boolean> {
    if (this.wanted) {
      if (this.stream && this.active) return Promise.resolve(true);
      if (!this.opening) {
        this.opening = this.open().finally(() => {
          this.opening = null;
          // What was wanted may have changed while the microphone was starting.
          if (!this.wanted && this.stream) this.shut();
        });
      }
      return this.opening;
    }
    if (this.stream && !this.opening) this.shut();
    else if (!this.stream && !this.opening) this.rest();
    return Promise.resolve(false);
  }

  /** The state to show while the microphone is closed. */
  private rest(): void {
    const state = this.current.state;
    if (state === 'denied' || state === 'error') return;
    const next = this.agreed && this.stepsAside && this.asides > 0 && (this.users > 0 || this.pinned) ? 'resting' : 'idle';
    if (state !== next || this.current.level !== -100) this.set({ state: next, level: -100 });
  }

  private async open(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.set({ state: 'error', error: 'This browser cannot use the microphone.' });
      return false;
    }
    this.set({ state: 'starting', error: null });
    await guitar.unlock();
    const ctx = guitar.ctx;
    if (!ctx) {
      this.set({ state: 'error', error: 'Sound is not available.' });
      return false;
    }
    guitar.setSessionType('play-and-record');
    let stream: MediaStream;
    try {
      // Voice processing is for speech. It would cut and squash a guitar, so ask for the plain signal.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
    } catch (err) {
      guitar.setSessionType('playback');
      const name = (err as { name?: string })?.name ?? '';
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      this.set({ state: denied ? 'denied' : 'error', error: err instanceof Error ? err.message : String(err) });
      return false;
    }
    this.stream = stream;
    await guitar.resume();
    this.tracker = new GuitarTracker(ctx.sampleRate);
    this.tracker.tuningCents = this.tuning;
    this.tracker.expected = this.expected;
    this.tracker.suppressUntil = this.suppressUntil;
    this.tracker.clicks = CLICK_FREQS;
    this.tracker.onStrike = (s) => emitStrike({ ...s, source: 'mic' });
    // The tuner reads a decimated copy, at half the rate, which is plenty for a guitar.
    this.pitchRate = ctx.sampleRate > 32000 ? ctx.sampleRate / 2 : ctx.sampleRate;
    this.pitchBuf = new Float32Array(Math.pow(2, Math.ceil(Math.log2(PITCH_SECONDS * this.pitchRate))));
    this.detector = new PitchDetector(this.pitchRate, this.pitchBuf.length);
    this.source = ctx.createMediaStreamSource(this.stream);
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(ctx.destination);

    const onBlock = (samples: Float32Array, time: number) => this.onBlock(samples, time);
    let node: AudioNode | null = null;
    try {
      if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
        // The capture code is loaded once. The microphone opens and closes many times.
        if (this.workletFor !== ctx) {
          await ctx.audioWorklet.addModule('/guitar/capture-worklet.js');
          this.workletFor = ctx;
        }
        const worklet = new AudioWorkletNode(ctx, 'os-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        // Blocks from a capture node this listener no longer uses, after a restart, are ignored.
        worklet.port.onmessage = (e: MessageEvent<{ samples: Float32Array; time: number }>) => {
          if (this.node === worklet) onBlock(e.data.samples, e.data.time);
        };
        node = worklet;
      }
    } catch {
      node = null;
    }
    if (!node) {
      const legacy = ctx.createScriptProcessor(1024, 1, 1);
      legacy.onaudioprocess = (e) => {
        if (this.node !== legacy) return;
        const data = e.inputBuffer.getChannelData(0);
        onBlock(new Float32Array(data), ctx.currentTime - data.length / ctx.sampleRate);
      };
      node = legacy;
    }
    this.source.connect(node);
    node.connect(this.sink);
    this.node = node;
    const track = stream.getAudioTracks()[0];
    // A phone call, another app or the iPad going to sleep can take the microphone away.
    if (track)
      track.onended = () => {
        if (this.stream === stream) this.shut();
      };
    this.set({ state: 'listening', heard: 0, source: track?.label ?? '' });
    return true;
  }

  /** Stop listening altogether, until it is asked for again. */
  stop(): void {
    this.agreed = false;
    this.pinned = false;
    this.shut();
  }

  /**
   * After the app comes back to the front. If the microphone was taken away
   * meanwhile and listening is still wanted, open it again.
   */
  revive(): void {
    if (this.opening) return;
    if (!this.wanted) {
      void this.sync();
      return;
    }
    const track = this.stream?.getAudioTracks()[0];
    if (this.active && track && track.readyState === 'live' && !track.muted) return;
    this.shut();
    void this.sync();
  }

  /** Let the microphone go. Whether it comes back is for `sync` to say. */
  private shut(): void {
    void this.stopRecording();
    try {
      this.source?.disconnect();
      this.node?.disconnect();
      this.sink?.disconnect();
    } catch {
      /* already disconnected */
    }
    const had = this.stream !== null;
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.stream = null;
    this.source = null;
    this.node = null;
    this.sink = null;
    if (this.tracker) this.tuning = this.tracker.tuningCents;
    this.tracker = null;
    if (had) guitar.setSessionType('playback');
    this.rest();
  }

  /** Tell the detector which notes the music expects next. */
  expect(notes: number[] | null): void {
    this.expected = notes && notes.length > 0 ? new Set(notes) : null;
    if (this.tracker) this.tracker.expected = this.expected;
  }

  /** Ignore what is heard until this audio time, while the app itself is playing. */
  suppress(until: number): void {
    if (until > this.suppressUntil) this.suppressUntil = until;
    if (this.tracker) this.tracker.suppressUntil = this.suppressUntil;
  }

  /** How far the guitar sits from concert pitch, in cents, as heard so far. */
  get tuningCents(): number {
    return this.tracker?.tuningCents ?? 0;
  }

  /** Start the steady pitch stream for the tuner. Returns a function that stops it. */
  wantPitch(): () => void {
    this.pitchWanted++;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.pitchWanted = Math.max(0, this.pitchWanted - 1);
    };
  }

  // ---------------------------------------------------------------- recording

  /** Can the learner's own playing be recorded here? */
  get canRecord(): boolean {
    return typeof MediaRecorder !== 'undefined' && this.stream !== null;
  }

  /** Begin recording what the microphone hears. */
  startRecording(): boolean {
    if (!this.canRecord || !this.stream) return false;
    this.stopRecording();
    try {
      const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported?.(t));
      this.recorder = new MediaRecorder(this.stream, type ? { mimeType: type, audioBitsPerSecond: 64000 } : undefined);
      this.chunks = [];
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };
      this.recorder.start(1000);
      return true;
    } catch {
      this.recorder = null;
      return false;
    }
  }

  /** Stop recording and hand over what was recorded, or null. */
  stopRecording(): Promise<Blob | null> {
    const rec = this.recorder;
    this.recorder = null;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = this.chunks.length > 0 ? new Blob(this.chunks, { type: rec.mimeType || 'audio/mp4' }) : null;
        this.chunks = [];
        resolve(blob);
      };
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });
  }

  // --------------------------------------------------------------- the stream

  private onBlock(samples: Float32Array, time: number): void {
    const tracker = this.tracker;
    if (!tracker) return;
    const found = tracker.process(samples, time);
    for (const d of found) emitNote({ midi: d.midi, velocity: d.strength, time: d.time, source: 'mic', assisted: d.assisted });
    if (this.pitchWanted > 0) this.feedPitch(samples, time);
    const now = performance.now();
    if (found.length > 0 || now - this.lastStatusAt > 120) {
      this.lastStatusAt = now;
      this.set({ level: tracker.levelDb, heard: this.current.heard + found.length });
    }
  }

  private feedPitch(samples: Float32Array, time: number): void {
    const buf = this.pitchBuf;
    const det = this.detector;
    if (!buf || !det) return;
    const step = this.pitchRate < (guitar.ctx?.sampleRate ?? this.pitchRate) ? 2 : 1;
    // Slide the window along, keeping the newest samples at the end.
    const fresh = Math.floor(samples.length / step);
    buf.copyWithin(0, fresh);
    for (let i = 0; i < fresh; i++) {
      // A two point average before taking every other sample keeps the top end from folding down.
      const j = i * step;
      buf[buf.length - fresh + i] = step === 2 ? 0.5 * (samples[j] + (samples[j + 1] ?? samples[j])) : samples[j];
    }
    this.pitchFill = Math.min(buf.length, this.pitchFill + fresh);
    this.sinceReading += fresh;
    // About twenty readings a second.
    if (this.pitchFill < buf.length || this.sinceReading < this.pitchRate * 0.045) return;
    this.sinceReading = 0;
    if (time < this.suppressUntil) {
      this.pitch.emit(null);
      return;
    }
    const r = det.detect(buf, { minHz: 60, maxHz: 1100 });
    this.pitch.emit(r && r.levelDb > -62 ? { ...r, time } : null);
  }
}

export const listener = new Listener();
