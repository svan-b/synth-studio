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
 */

import { CLICK_FREQS } from '../audio/click';
import { guitar } from '../audio/engine';
import { PitchDetector, type PitchReading } from '../dsp/pitch';
import { GuitarTracker } from '../dsp/tracker';
import { Emitter } from '../util/emitter';
import { emitNote, emitStrike } from './bus';

export interface ListenStatus {
  state: 'idle' | 'starting' | 'listening' | 'denied' | 'error';
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
  private starting: Promise<boolean> | null = null;
  /** Listening was asked for and not stopped on purpose, so it comes back after an interruption. */
  private wanted = false;

  getStatus(): ListenStatus {
    return this.current;
  }

  get active(): boolean {
    return this.current.state === 'listening';
  }

  /** Where sound enters the detector. The development robot plays straight into it. */
  get inlet(): AudioNode | null {
    return this.node;
  }

  private set(patch: Partial<ListenStatus>): void {
    this.current = { ...this.current, ...patch };
    this.status.emit(this.current);
  }

  /** Start listening. In a browser, call it from a tap. */
  start(): Promise<boolean> {
    this.wanted = true;
    if (this.active) return Promise.resolve(true);
    if (!this.starting) this.starting = this.open().finally(() => (this.starting = null));
    return this.starting;
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
    try {
      // Voice processing is for speech. It would cut and squash a guitar, so ask for the plain signal.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
    } catch (err) {
      guitar.setSessionType('playback');
      const name = (err as { name?: string })?.name ?? '';
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      this.set({ state: denied ? 'denied' : 'error', error: err instanceof Error ? err.message : String(err) });
      return false;
    }
    await guitar.resume();
    this.tracker = new GuitarTracker(ctx.sampleRate);
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
        await ctx.audioWorklet.addModule('/guitar/capture-worklet.js');
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
    const track = this.stream.getAudioTracks()[0];
    // A phone call, another app or the iPad going to sleep can take the microphone away.
    if (track) track.onended = () => this.close();
    this.set({ state: 'listening', heard: 0, source: track?.label ?? '' });
    return true;
  }

  /** Stop listening, on purpose. */
  stop(): void {
    this.wanted = false;
    this.close();
  }

  /**
   * After the app comes back to the front. If the microphone was taken away
   * meanwhile and listening was still wanted, open it again.
   */
  revive(): void {
    if (!this.wanted || this.starting) return;
    const track = this.stream?.getAudioTracks()[0];
    if (this.active && track && track.readyState === 'live' && !track.muted) return;
    this.close();
    void this.start();
  }

  private close(): void {
    void this.stopRecording();
    try {
      this.source?.disconnect();
      this.node?.disconnect();
      this.sink?.disconnect();
    } catch {
      /* already disconnected */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.source = null;
    this.node = null;
    this.sink = null;
    this.tracker = null;
    guitar.setSessionType('playback');
    this.set({ state: 'idle', level: -100 });
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
