// ============================================================================
// Audio clock -> MIDI timestamps.
//
// Everything musical in the studio is scheduled on the AudioContext clock
// (transport ticks carry `time` in ctx seconds). Web MIDI schedules in
// performance.now() milliseconds. So:
//
//   timestamp = performance.now() + (audioTime - ctx.currentTime) * 1000
//             + ctx.outputLatency * 1000       <- you HEAR the twins this much later
//             + user offset
//
// Adding the output latency makes hardware sound together with the twins you
// hear through your speakers. ctx.baseLatency (the browser's own buffering) is
// shown in the MIDI settings but not added: put it in the offset if your
// hardware still sounds early. If you monitor the hardware back *through* the
// studio (Audio input), use a negative offset of about the input latency.
// ============================================================================

export interface LatencyOptions {
  /** Add the context's output latency (default true) */
  compensate?: boolean;
  /** Extra milliseconds (+ later, - earlier) */
  offsetMs?: number;
}

type Ctx = Pick<BaseAudioContext, 'currentTime'> & { baseLatency?: number; outputLatency?: number };

const seconds = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** Seconds of audio output latency the browser reports (0 where it doesn't, e.g. older Safari) */
export function outputLatency(ctx: Ctx): number {
  return seconds(ctx.outputLatency);
}

/** Seconds of processing latency inside the browser (shown for information) */
export function baseLatency(ctx: Ctx): number {
  return seconds(ctx.baseLatency);
}

/** Map an audio-context time to a performance.now() timestamp for MIDIOutput.send */
export function audioToMidiTime(ctx: Ctx, audioTime: number, opts: LatencyOptions = {}, now = performance.now()): number {
  const latency = opts.compensate === false ? 0 : outputLatency(ctx);
  return now + (audioTime - ctx.currentTime + latency) * 1000 + (opts.offsetMs ?? 0);
}

/** Map a performance.now() timestamp (e.g. MIDIMessageEvent.timeStamp) to audio-context time */
export function midiToAudioTime(ctx: Ctx, timeStamp: number, now = performance.now()): number {
  return ctx.currentTime + (timeStamp - now) / 1000;
}

// ----------------------------------------------------------------------------
// Steady clock mapping
//
// The formula above is   performance.now() - ctx.currentTime * 1000   (the
// offset between the two clocks) + audioTime * 1000 + latency. But currentTime
// does not move smoothly: browsers advance it once per audio callback, in
// steps of 128 frames up to ~20 ms. A raw sample of the offset is therefore
// late by anything between 0 and one callback, and MIDI timestamps computed
// from it wobble by that much.
//
//  - The smallest offset seen over the last 2 s is the sample taken right after
//    currentTime moved: the true offset.
//  - After a 1 s warm-up the estimate may only move 2 ms per second towards it:
//    enough to follow the drift between the audio and system clocks (well under
//    0.1 ms/s), too slow for a stray sample to bend the beat.
//  - If the offset jumps for real (context suspended and resumed, tab frozen),
//    we start over.
//  - sampleEvery() keeps it settled in the background, so the first beat after
//    Play is already exact.
// ----------------------------------------------------------------------------

const WINDOW_MS = 2000;
const WARMUP_MS = 1000;
/** ms of estimate change allowed per ms of real time after warm-up */
const SLEW = 0.002;
/** Bigger than any callback jitter: the timeline really moved (raised for outputs with huge callbacks) */
const JUMP_MS = 60;

export class AudioClockSync {
  private ctx: unknown = null;
  /** (time, offset) pairs with increasing offsets: the front is the window minimum */
  private q: { at: number; offset: number }[] = [];
  private est: number | null = null;
  private since = 0;
  private lastAt = 0;
  /** Typical distance of a sample above the minimum (about half a callback) */
  private spread = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  private restart(now: number) {
    this.q = [];
    this.est = null;
    this.since = now;
  }

  /** Smoothed performance.now() - ctx.currentTime * 1000 */
  offset(ctx: Ctx, now = performance.now()): number {
    const o = now - ctx.currentTime * 1000;
    if (ctx !== this.ctx) { this.ctx = ctx; this.restart(now); }
    if (this.q.length) {
      const d = o - this.q[0].offset;
      if (Math.abs(d) > Math.max(JUMP_MS, 4 * this.spread)) this.restart(now);
      else if (d > 0) this.spread += (d - this.spread) * 0.05;
    }
    while (this.q.length && this.q[this.q.length - 1].offset >= o) this.q.pop();
    this.q.push({ at: now, offset: o });
    while (this.q.length > 1 && this.q[0].at < now - WINDOW_MS) this.q.shift();
    const target = this.q[0].offset;
    if (this.est === null || now - this.since < WARMUP_MS) {
      this.est = target;
    } else {
      const step = Math.max(0, now - this.lastAt) * SLEW;
      this.est += Math.max(-step, Math.min(step, target - this.est));
    }
    this.lastAt = now;
    return this.est;
  }

  /** audioToMidiTime() with the steady offset */
  toMidiTime(ctx: Ctx, audioTime: number, opts: LatencyOptions = {}, now = performance.now()): number {
    const latency = opts.compensate === false ? 0 : outputLatency(ctx);
    return this.offset(ctx, now) + (audioTime + latency) * 1000 + (opts.offsetMs ?? 0);
  }

  /** Keep sampling in the background (while the context runs) so the estimate is settled before it is needed */
  sampleEvery(getCtx: () => (Ctx & { state?: string }) | null, ms = 20) {
    if (this.timer || typeof setInterval === 'undefined') return;
    this.timer = setInterval(() => {
      const c = getCtx();
      if (c && (c.state === undefined || c.state === 'running')) this.offset(c);
    }, ms);
  }

  stopSampling() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  reset() {
    this.restart(0);
    this.ctx = null;
  }
}

/** One mapping for the whole app, so clock out and sequencers agree to the microsecond */
export const audioClock = new AudioClockSync();
