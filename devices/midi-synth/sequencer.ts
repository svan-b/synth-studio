// ============================================================================
// 16-step note sequencer for "Your synth (MIDI)". Pure logic, no browser APIs.
//
// Fed with studio transport ticks (24 PPQN, each carrying its audio-clock
// time). On every 16th note it returns the step's note-on at exactly the
// tick's time and the matching note-off after the gate. The engine turns those
// audio times into MIDI timestamps (lib/midi/time.ts), so the hardware plays
// with the twins, not with the main thread.
//
// Both messages are sent together, ahead of time, so a note can never hang:
// the note-off is always already queued. It is clamped to land just before the
// next step's note-on (swing moves off-beat 16ths later and the following
// on-beat earlier), so repeated notes retrigger instead of being cut short.
// ============================================================================

import { PPQN, type TransportTick } from '@/lib/audio/transport';
import type { SeqStep } from './config';

/** 16th notes */
export const TICKS_PER_STEP = PPQN / 4;

export interface SeqSettings {
  enabled: boolean;
  steps: SeqStep[];
  /** Active steps 1-16 */
  length: number;
  /** Note length as a fraction of a 16th (0.05 - 1) */
  gate: number;
  /** Semitones added to every step */
  transpose: number;
  /** Transport swing 0..0.75 (fraction of a 16th that off-beat 16ths are delayed by) */
  swing: number;
  /** MIDI channel 0-15 */
  channel: number;
}

export interface ScheduledMidi {
  bytes: number[];
  /** Audio-context time */
  time: number;
}

export interface StepResult {
  /** Step index 0-15 that plays at `time` */
  step: number;
  time: number;
  events: ScheduledMidi[];
}

/** Gap kept between a note-off and the next note-on (seconds) */
const RETRIGGER_GAP = 0.001;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class StepSequencer {
  /** Handle one transport tick. Returns null between 16ths. */
  tick(t: TransportTick, s: SeqSettings): StepResult | null {
    if (t.tick % TICKS_PER_STEP !== 0) return null;
    const length = clamp(Math.round(s.length) || 16, 1, 16);
    const index = Math.floor(t.tick / TICKS_PER_STEP);
    const step = ((index % length) + length) % length;
    const result: StepResult = { step, time: t.time, events: [] };
    const st = s.steps[step];
    if (!s.enabled || !st?.on) return result;

    const ch = clamp(Math.round(s.channel) || 0, 0, 15);
    const note = clamp(Math.round(st.note + s.transpose), 0, 127);
    const vel = clamp(Math.round(st.vel) || 100, 1, 127);
    const stepDur = TICKS_PER_STEP * t.tickDuration;
    // Time until the next step's note-on: swing delays off-beat 16ths (ticks 6, 18, 30...)
    const offbeat = t.tick % (PPQN / 2) >= TICKS_PER_STEP;
    const swing = clamp(s.swing || 0, 0, 0.75);
    const gap = stepDur * (offbeat ? 1 - swing : 1 + swing);
    const len = Math.max(0.002, Math.min(clamp(s.gate, 0.05, 1) * stepDur, gap - RETRIGGER_GAP));
    result.events.push(
      { bytes: [0x90 | ch, note, vel], time: t.time },
      { bytes: [0x80 | ch, note, 0], time: t.time + len },
    );
    return result;
  }
}

/** A transport-like tick for the internal clock (when not following the studio) */
export function stepTick(time: number, stepIndex: number, stepSeconds: number): TransportTick {
  const tick = stepIndex * TICKS_PER_STEP;
  return {
    time,
    tick,
    tickDuration: stepSeconds / TICKS_PER_STEP,
    beat: tick / PPQN,
    bar: Math.floor(tick / (PPQN * 4)),
    sixteenth: stepIndex,
  };
}
