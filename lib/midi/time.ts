// ============================================================================
// Audio clock -> MIDI timestamps.
//
// Everything musical in the studio is scheduled on the AudioContext clock
// (transport ticks carry `time` in ctx seconds). Web MIDI schedules in
// performance.now() milliseconds. So:
//
//   timestamp = performance.now() + (audioTime - ctx.currentTime) * 1000
//             + (ctx.baseLatency + ctx.outputLatency) * 1000     <- you HEAR audio this late
//             + user offset
//
// Adding the output latency makes hardware sound together with the twins you
// hear through your speakers. If you monitor the hardware back *through* the
// studio (Audio input), use a negative offset of about the input latency.
// ============================================================================

export interface LatencyOptions {
  /** Add the context's base + output latency (default true) */
  compensate?: boolean;
  /** Extra milliseconds (+ later, - earlier) */
  offsetMs?: number;
}

type Ctx = Pick<BaseAudioContext, 'currentTime'> & { baseLatency?: number; outputLatency?: number };

/** Seconds of audio output latency the browser reports (0 where it doesn't) */
export function outputLatency(ctx: Ctx): number {
  const base = Number.isFinite(ctx.baseLatency) ? Number(ctx.baseLatency) : 0;
  const out = Number.isFinite(ctx.outputLatency) ? Number(ctx.outputLatency) : 0;
  return Math.max(0, base) + Math.max(0, out);
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
