// ============================================================================
// Mother-32 model: how panel controls and patch points map onto the 'mother32'
// worklet (public/worklets/mother32-processors.js). Pure data and functions - no
// Web Audio - so the engine, the panel and offline tests share one source of truth.
// ============================================================================

import type { ControlValue, PatchConnection } from '@/types';

/** Worklet knob slots (keep in sync with K_* in mother32-processors.js) */
export const SLOT = {
  freq: 0, wave: 1, pw: 2, mix: 3, cutoff: 4, res: 5, vcaMode: 6, volume: 7, glide: 8, vmodSrc: 9,
  vmodAmt: 10, vmodDest: 11, vcfMode: 12, fmodSrc: 13, fmodAmt: 14, fmodPol: 15, tempo: 16, lfoRate: 17,
  lfoWave: 18, attack: 19, sustain: 20, decay: 21, vcMix: 22, run: 23, swing: 24, div: 25, assign: 26,
  tempoMode: 27, mode: 28, rec: 29, quality: 30, dir: 31, swingDiv: 32, ppqn: 33, tempoRange: 34, accentCvOnly: 35,
} as const;

const num = (v: ControlValue) => (typeof v === 'number' ? v : v ? 1 : 0);
const pct = (v: ControlValue) => num(v) / 100;
const sec = (v: ControlValue) => num(v) / 1000;

/**
 * control id -> [worklet slot, value in engine units]. `values` (all current control values)
 * is needed for the clock division, which two controls share (note value and group).
 */
export function knobMessage(id: string, value: ControlValue, values: Record<string, ControlValue | undefined> = {}): [number, number] | null {
  switch (id) {
    case 'frequency': return [SLOT.freq, num(value)];                 // octaves from C4
    case 'vco_wave': return [SLOT.wave, num(value)];                  // ['PULSE', 'SAW']
    case 'pulse_width': return [SLOT.pw, pct(value)];
    case 'mix': return [SLOT.mix, pct(value)];
    case 'cutoff': return [SLOT.cutoff, num(value)];                  // Hz
    case 'resonance': return [SLOT.res, pct(value)];
    case 'vca_mode': return [SLOT.vcaMode, num(value)];               // ['ON', 'EG']
    case 'volume': return [SLOT.volume, pct(value)];
    case 'glide': return [SLOT.glide, sec(value)];
    case 'vco_mod_source': return [SLOT.vmodSrc, num(value)];         // ['EG', 'LFO']
    case 'vco_mod_amount': return [SLOT.vmodAmt, pct(value)];
    case 'vco_mod_dest': return [SLOT.vmodDest, num(value)];          // ['PW', 'FREQ']
    case 'vcf_mode': return [SLOT.vcfMode, num(value)];               // ['HP', 'LP']
    case 'vcf_mod_source': return [SLOT.fmodSrc, num(value)];         // ['EG', 'LFO']
    case 'vcf_mod_amount': return [SLOT.fmodAmt, pct(value)];
    case 'vcf_mod_polarity': return [SLOT.fmodPol, num(value)];       // ['+', '−']
    case 'tempo': return [SLOT.tempo, num(value)];                    // BPM
    case 'lfo_rate': return [SLOT.lfoRate, num(value)];               // Hz
    case 'lfo_wave': return [SLOT.lfoWave, num(value)];               // ['SQ', 'TRI']
    case 'attack': return [SLOT.attack, sec(value)];
    case 'sustain': return [SLOT.sustain, num(value)];                // ['ON', 'OFF']
    case 'decay': return [SLOT.decay, sec(value)];
    case 'vc_mix': return [SLOT.vcMix, pct(value)];
    case 'run_stop': return [SLOT.run, value ? 1 : 0];
    case 'swing': return [SLOT.swing, pct(value)];
    case 'step_div': return [SLOT.div, divIndex(num(value), num(values.div_type ?? 0))];
    case 'div_type': return [SLOT.div, divIndex(num(values.step_div ?? DIV_DEFAULT), num(value))];
    case 'swing_div': return [SLOT.swingDiv, divIndex(num(value), num(values.swing_type ?? 0))];
    case 'swing_type': return [SLOT.swingDiv, divIndex(num(values.swing_div ?? DIV_DEFAULT), num(value))];
    case 'seq_direction': return [SLOT.dir, Math.round(num(value))];
    case 'clock_in_ppqn': return [SLOT.ppqn, PPQN_VALUES[Math.max(0, Math.min(15, Math.round(num(value))))]];
    case 'tempo_in_range': return [SLOT.tempoRange, num(value)];       // ['-5 TO +5 V', '0 TO +5 V']
    case 'accent_cv_only': return [SLOT.accentCvOnly, num(value)];     // ['OFF', 'ON']
    case 'assign_source': return [SLOT.assign, Math.round(num(value))];
    case 'tempo_mode': return [SLOT.tempoMode, Math.round(num(value))];
    case 'seq_mode': return [SLOT.mode, num(value)];                  // ['KB', 'STEP']
    case 'rec': return [SLOT.rec, value ? 1 : 0];
  }
  return null;
}

/** Input jack -> worklet input index (keep in sync with I_* in the worklet) */
export const INPUTS: Record<string, number> = {
  in_ext_audio: 0, in_mix_cv: 1, in_vca_cv: 2, in_vcf_cutoff: 3, in_vcf_res: 4, in_vco_1voct: 5,
  in_vco_lin_fm: 6, in_vco_mod: 7, in_lfo_rate: 8, in_mix1: 9, in_mix2: 10, in_vc_mix_ctrl: 11,
  in_mult: 12, in_gate: 13, in_tempo: 14, in_run_stop: 15, in_reset: 16, in_hold: 17,
};

/** Output jack -> worklet output channel (keep in sync with O_* in the worklet). Both MULT jacks share one. */
export const OUTPUTS: Record<string, number> = {
  out_vca: 0, out_noise: 1, out_vcf: 2, out_vco_saw: 3, out_vco_pulse: 4, out_lfo_tri: 5, out_lfo_sq: 6,
  out_vc_mix: 7, out_mult1: 8, out_mult2: 8, out_assign: 9, out_eg: 10, out_kb: 11, out_gate: 12,
};

export const NUM_INPUTS = 18;
/** 13 jack channels plus the main bus (channel 13: the VCA at studio level, DC blocked) */
export const NUM_OUTPUTS = 14;
export const MAIN_CHANNEL = 13;

/** Inputs that also take timed events from EventBus cables (other instruments' clocks and gates) */
export const EVENT_INPUTS: Record<string, string> = {
  in_tempo: 'tempo', in_run_stop: 'run', in_reset: 'reset', in_hold: 'hold', in_gate: 'gate',
};

/**
 * Self-patches (a Mother-32 output into a Mother-32 input) run inside the worklet as a patch
 * matrix, in volts, one sample late - no Web Audio cycles and no extra latency.
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
    const key = `${from}>${i}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push([o, i, 1]);
    counts[i]++;
  }
  return { routes, counts };
}

// ----------------------------------------------------------------------------
// Sequencer tables
// ----------------------------------------------------------------------------

/**
 * Step divisions, firmware 2.0: three groups of eight note values, two whole notes to 1/64.
 * TEMPO alone picks a straight value (when clocked externally, or with KB + STEP held on the
 * internal clock); held KB picks a dotted one, held STEP a triplet. Ticks at 24 PPQN.
 * The worklet's DIV_TICKS uses the same order: index = group * 8 + value.
 */
const NOTE_VALUES = ['2/1', '1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64'];
const STRAIGHT_TICKS = [192, 96, 48, 24, 12, 6, 3, 1.5];
export const DIV_GROUPS = ['STRAIGHT', 'DOTTED', 'TRIPLET'] as const;
export const DIVISIONS: { name: string; ticks: number }[] = [
  ...NOTE_VALUES.map((name, i) => ({ name, ticks: STRAIGHT_TICKS[i] })),
  ...NOTE_VALUES.map((name, i) => ({ name: `${name}D`, ticks: STRAIGHT_TICKS[i] * 1.5 })),
  ...NOTE_VALUES.map((name, i) => ({ name: `${name}T`, ticks: (STRAIGHT_TICKS[i] * 2) / 3 })),
];
/** Note value within its group (0 = two whole notes ... 7 = 1/64); 5 = 1/16, the default */
export const DIV_DEFAULT = 5;
/** Index into DIVISIONS for a note value (0..7) in a group (0 straight, 1 dotted, 2 triplet) */
export const divIndex = (value: number, group: number) =>
  Math.max(0, Math.min(2, Math.round(group))) * 8 + Math.max(0, Math.min(7, Math.round(value)));
/** Name of the division for `step_div` + `div_type` values */
export const divName = (value: unknown, group: unknown) =>
  DIVISIONS[divIndex(typeof value === 'number' ? value : DIV_DEFAULT, typeof group === 'number' ? group : 0)].name;

/** ASSIGN output sources, Setup page 1, in the manual's order */
export const ASSIGN_SOURCES = [
  'ACCENT', 'CLOCK', 'CLOCK / 2', 'CLOCK / 4', 'STEP RAMP', 'STEP SAW', 'STEP TRIANGLE', 'STEP RANDOM',
  'STEP 1 TRIG', 'MIDI VELOCITY', 'MIDI PRESSURE', 'MIDI BEND', 'MIDI CC 1', 'MIDI CC 2', 'MIDI CC 4', 'MIDI CC 7',
];

/** TEMPO input modes, Setup page 3 (manual p.55, p.59) */
export const TEMPO_MODES = ['CV INPUT', 'SINGLE CLOCK ADVANCE', 'ANALOG CLOCK', 'STEP ADDRESS CV'];

/** Clock input PPQN, Setup page 4 (manual p.59): values 1-14, 24, 48; default 4 (sixteenth notes) */
export const PPQN_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 24, 48];

/** Playback order (manual p.40): KB + STEP + step 1-4 */
export const DIRECTIONS = ['FORWARD', 'REVERSE', 'PENDULUM', 'RANDOM'];

/** Panel keys: the lowest key's MIDI note for OCTAVE / LOCATION LED n (index 0..7): C0 .. C7 */
export const octaveLow = (oct: number) => 12 * (Math.max(0, Math.min(7, Math.round(oct))) + 1);
