/**
 * Listening mode: hears a piano through the microphone when MIDI is not
 * available. Works in any browser, including Safari on iPad.
 */

import { piano } from '../audio/engine';
import { PitchTracker } from '../dsp/tracker';
import { Emitter } from '../util/emitter';
import { emitNoteOn } from './bus';

export interface ListenStatus {
  state: 'idle' | 'starting' | 'listening' | 'denied' | 'error';
  /** Input level in dBFS, updated a few times a second. */
  level: number;
  error: string | null;
  /** How far the piano is from concert pitch, in cents, as heard so far. */
  tuning: number;
  /** Notes heard since listening began. */
  heard: number;
}

class Listener {
  readonly status = new Emitter<ListenStatus>();
  private current: ListenStatus = { state: 'idle', level: -100, error: null, tuning: 0, heard: 0 };
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioNode | null = null;
  private sink: GainNode | null = null;
  private tracker: PitchTracker | null = null;
  private expected: Set<number> | null = null;
  private suppressUntil = -Infinity;
  private lastStatusAt = 0;

  getStatus(): ListenStatus {
    return this.current;
  }

  get active(): boolean {
    return this.current.state === 'listening';
  }

  private set(patch: Partial<ListenStatus>): void {
    this.current = { ...this.current, ...patch };
    this.status.emit(this.current);
  }

  /** Start listening. Call from a tap, after sound has been unlocked. */
  async start(): Promise<boolean> {
    if (this.active) return true;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.set({ state: 'error', error: 'This browser cannot use the microphone.' });
      return false;
    }
    this.set({ state: 'starting', error: null });
    await piano.unlock();
    const ctx = piano.ctx;
    if (!ctx) {
      this.set({ state: 'error', error: 'Sound is not available.' });
      return false;
    }
    piano.setSessionType('play-and-record');
    try {
      // Voice processing would mangle piano tone, so ask for the raw signal.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
    } catch (err) {
      piano.setSessionType('playback');
      const name = (err as { name?: string })?.name ?? '';
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      this.set({ state: denied ? 'denied' : 'error', error: err instanceof Error ? err.message : String(err) });
      return false;
    }
    await piano.resume();
    this.tracker = new PitchTracker(ctx.sampleRate);
    this.tracker.expected = this.expected;
    this.tracker.suppressUntil = this.suppressUntil;
    this.source = ctx.createMediaStreamSource(this.stream);
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(ctx.destination);

    const onBlock = (samples: Float32Array, time: number) => this.onBlock(samples, time);
    let node: AudioNode | null = null;
    try {
      if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
        await ctx.audioWorklet.addModule('/piano/capture-worklet.js');
        const worklet = new AudioWorkletNode(ctx, 'mc-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        worklet.port.onmessage = (e: MessageEvent<{ samples: Float32Array; time: number }>) => onBlock(e.data.samples, e.data.time);
        node = worklet;
      }
    } catch {
      node = null;
    }
    if (!node) {
      // Older browsers: the same job on the main thread.
      const legacy = ctx.createScriptProcessor(1024, 1, 1);
      legacy.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        onBlock(new Float32Array(data), ctx.currentTime - data.length / ctx.sampleRate);
      };
      node = legacy;
    }
    this.source.connect(node);
    node.connect(this.sink);
    this.node = node;
    this.set({ state: 'listening', heard: 0 });
    return true;
  }

  stop(): void {
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
    piano.setSessionType('playback');
    this.set({ state: 'idle', level: -100 });
  }

  /** Tell the listener which notes the music expects next. */
  expect(notes: number[] | null): void {
    this.expected = notes && notes.length > 0 ? new Set(notes) : null;
    if (this.tracker) this.tracker.expected = this.expected;
  }

  /** Ignore sound until this audio time, used while the app itself is playing. */
  suppress(until: number): void {
    if (until > this.suppressUntil) this.suppressUntil = until;
    if (this.tracker) this.tracker.suppressUntil = this.suppressUntil;
  }

  private onBlock(samples: Float32Array, time: number): void {
    const tracker = this.tracker;
    if (!tracker) return;
    const found = tracker.process(samples, time);
    for (const d of found) emitNoteOn(d.midi, d.strength, d.time, 'mic');
    const now = performance.now();
    if (found.length > 0 || now - this.lastStatusAt > 150) {
      this.lastStatusAt = now;
      this.set({ level: tracker.levelDb, tuning: tracker.tuningCents, heard: this.current.heard + found.length });
    }
  }
}

export const listener = new Listener();
