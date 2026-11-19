// ============================================================================
// Subharmonicon model: how panel controls and patch points map onto the
// 'subharmonicon' worklet (public/worklets/subharmonicon-processors.js).
// Pure data and functions - no Web Audio - so the engine, presets and tests
// share one source of truth.
// ============================================================================

import type { ControlValue, PatchConnection } from '@/types';
import { SEQ_RANGE } from './theory';

/** Worklet knob slots (keep in sync with K_* in subharmonicon-processors.js) */
export const SLOT = {
  vco1Freq: 0, vco2Freq: 1, div11: 2, div12: 3, div21: 4, div22: 5, wave1: 6, wave2: 7,
  lvVco1: 8, lvSub11: 9, lvSub12: 10, lvVco2: 11, lvSub21: 12, lvSub22: 13,
  assign: 14, // seq1 osc, sub1, sub2, seq2 osc, sub1, sub2 (6)
  seqOct: 20, quantize: 21,
  step: 22, // seq1 steps 1-4, seq2 steps 1-4 (8)
  rhythm: 30, // divisors (4)
  rhythmAssign: 34, // r1 seq1, r1 seq2, r2 seq1 ... (8)
  logic: 42, tempo: 43, play: 44, egMode: 45,
  cutoff: 46, resonance: 47, egAmt: 48, volume: 49,
  vcfAttack: 50, vcfDecay: 51, vcaAttack: 52, vcaDecay: 53,
  // SEQ OCT / QUANTIZE held until the LED flashes: the SEQ jacks stop following them (manual pp.21, 28)
  seqOctHeld: 54, quantizeHeld: 55,
} as const;

const num = (v: ControlValue) => (typeof v === 'number' ? v : v ? 1 : 0);
const pct = (v: ControlValue) => num(v) / 100;
const sec = (v: ControlValue) => num(v) / 1000;
const div = (v: ControlValue) => Math.max(1, Math.min(16, Math.round(-num(v))));

/** TEMPO knob (BPM, 1 PPQ: one master count per beat) -> master clock in Hz */
export const bpmToHz = (bpm: number) => bpm / 60;

/** control id -> [worklet slot, value in engine units] */
export function knobMessage(id: string, value: ControlValue): [number, number] | null {
  switch (id) {
    case 'vco1_freq': return [SLOT.vco1Freq, num(value)];                // Hz
    case 'vco2_freq': return [SLOT.vco2Freq, num(value)];
    case 'vco1_sub1_freq': return [SLOT.div11, div(value)];              // stored as -divisor
    case 'vco1_sub2_freq': return [SLOT.div12, div(value)];
    case 'vco2_sub1_freq': return [SLOT.div21, div(value)];
    case 'vco2_sub2_freq': return [SLOT.div22, div(value)];
    case 'vco1_wave': return [SLOT.wave1, num(value)];                   // 0 SQR (up), 1 SQ/SAW, 2 SAW (down)
    case 'vco2_wave': return [SLOT.wave2, num(value)];
    case 'vco1_level': return [SLOT.lvVco1, pct(value)];
    case 'vco1_sub1_level': return [SLOT.lvSub11, pct(value)];
    case 'vco1_sub2_level': return [SLOT.lvSub12, pct(value)];
    case 'vco2_level': return [SLOT.lvVco2, pct(value)];
    case 'vco2_sub1_level': return [SLOT.lvSub21, pct(value)];
    case 'vco2_sub2_level': return [SLOT.lvSub22, pct(value)];
    case 'seq1_osc': return [SLOT.assign, num(value)];
    case 'seq1_sub1': return [SLOT.assign + 1, num(value)];
    case 'seq1_sub2': return [SLOT.assign + 2, num(value)];
    case 'seq2_osc': return [SLOT.assign + 3, num(value)];
    case 'seq2_sub1': return [SLOT.assign + 4, num(value)];
    case 'seq2_sub2': return [SLOT.assign + 5, num(value)];
    case 'seq_oct': return [SLOT.seqOct, SEQ_RANGE[num(value)] ?? 1];   // octaves
    case 'quantize': return [SLOT.quantize, num(value)];               // 0 off, 1 12-ET, 2 8-ET, 3 12-JI, 4 8-JI
    case 'seq_oct_held': return [SLOT.seqOctHeld, value ? 1 : 0];      // SEQ jacks always ±5 V
    case 'quantize_held': return [SLOT.quantizeHeld, value ? 1 : 0];   // SEQ jacks unquantized
    case 'rhythm_logic': return [SLOT.logic, num(value)];              // 0 OR, 1 XOR
    case 'tempo': return [SLOT.tempo, bpmToHz(num(value))];
    case 'play': return [SLOT.play, value ? 1 : 0];
    case 'eg_mode': return [SLOT.egMode, num(value)];                  // 0 OFF, 1 ON, 2 HELD
    case 'cutoff': return [SLOT.cutoff, num(value)];                   // Hz
    case 'resonance': return [SLOT.resonance, pct(value)];
    case 'vcf_eg_amt': return [SLOT.egAmt, pct(value)];               // -1..1
    case 'volume': return [SLOT.volume, pct(value)];
    case 'vcf_attack': return [SLOT.vcfAttack, sec(value)];
    case 'vcf_decay': return [SLOT.vcfDecay, sec(value)];
    case 'vca_attack': return [SLOT.vcaAttack, sec(value)];
    case 'vca_decay': return [SLOT.vcaDecay, sec(value)];
  }
  let m = /^seq([12])_step([1-4])$/.exec(id);
  if (m) return [SLOT.step + (Number(m[1]) - 1) * 4 + Number(m[2]) - 1, Math.max(-1, Math.min(1, pct(value)))];
  m = /^rhythm([1-4])$/.exec(id);
  if (m) return [SLOT.rhythm + Number(m[1]) - 1, div(value)];
  m = /^rhythm([1-4])_seq([12])$/.exec(id);
  if (m) return [SLOT.rhythmAssign + (Number(m[1]) - 1) * 2 + Number(m[2]) - 1, num(value)];
  return null;
}

/** Input jack -> worklet input channel (keep in sync with I_* in the worklet). MIDI IN has none. */
export const INPUTS: Record<string, number> = {
  in_vco1: 0, in_vco1_sub: 1, in_vco1_pwm: 2, in_vca: 3,
  in_vco2: 4, in_vco2_sub: 5, in_vco2_pwm: 6, in_cutoff: 7,
  in_play: 8, in_reset: 9, in_trigger: 10,
  in_rhythm1: 11, in_rhythm2: 12, in_rhythm3: 13, in_rhythm4: 14,
  in_clock: 15,
};
export const NUM_INPUTS = 16;

/** Output jack -> worklet jack-output channel (output 1); the main VCA output is also output 0 */
export const OUTPUTS: Record<string, number> = {
  out_vca: 0, out_vco1: 1, out_vco1_sub1: 2, out_vco1_sub2: 3, out_vca_eg: 4,
  out_vco2: 5, out_vco2_sub1: 6, out_vco2_sub2: 7, out_vcf_eg: 8,
  out_seq1: 9, out_seq1_clk: 10, out_seq2: 11, out_seq2_clk: 12,
  out_clock: 13, out_trigger: 14,
};
export const NUM_OUTPUTS = 15;

/** Inputs that also take timed events (EventBus cables from other instruments) */
export const EVENT_INPUTS: Record<string, 'clock' | 'trig' | 'reset' | 'play'> = {
  in_clock: 'clock', in_trigger: 'trig', in_reset: 'reset', in_play: 'play',
};

/**
 * Self-patches (a Subharmonicon output into one of its own inputs) run inside
 * the worklet as a patch matrix, in volts, one sample late - no Web Audio
 * cycles and no latency. The MIDI IN jack has no internal signal and is skipped.
 */
export function internalRoutes(connections: PatchConnection[]): { routes: [number, number, number][]; counts: number[] } {
  const counts = new Array(NUM_INPUTS).fill(0);
  const routes: [number, number, number][] = [];
  const seen = new Set<string>();
  for (const c of connections) {
    let from = c.from, to = c.to;
    if (OUTPUTS[from] === undefined && OUTPUTS[to] !== undefined) [from, to] = [to, from];
    const o = OUTPUTS[from];
    const i = INPUTS[to];
    if (o === undefined || i === undefined) continue;
    const key = `${o}>${i}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push([o, i, 1]);
    counts[i]++;
  }
  return { routes, counts };
}
