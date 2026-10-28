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
