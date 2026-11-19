// ============================================================================
// DFAM model: how panel controls and patch points map onto the 'dfam' worklet
// (public/worklets/dfam-processors.js). Pure data and functions - no Web Audio -
// so the engine and offline tests share one source of truth.
// ============================================================================

import type { ControlValue, PatchConnection } from '@/types';

/** Worklet knob slots (keep in sync with K_* in dfam-processors.js) */
export const SLOT = {
  vco1Freq: 0, vco2Freq: 1, vco1Eg: 2, vco2Eg: 3, vco1Wave: 4, vco2Wave: 5,
  fm: 6, sync: 7, vcoDecay: 8, seqMod: 9, vco1Level: 10, vco2Level: 11,
  noiseLevel: 12, cutoff: 13, res: 14, vcfEg: 15, vcfMode: 16, vcfDecay: 17,
  noiseVcf: 18, vcaDecay: 19, vcaSlow: 20, volume: 21, tempo: 22, run: 23,
  pitch: 24, vel: 32,
} as const;

const num = (v: ControlValue) => (typeof v === 'number' ? v : v ? 1 : 0);
const pct = (v: ControlValue) => num(v) / 100;
const ms = (v: ControlValue) => num(v) / 1000;

/** TEMPO is shown as BPM with each step a 16th note; the clock runs at bpm * 4 / 60 Hz */
export const bpmToHz = (bpm: number) => (bpm * 4) / 60;

/** control id -> [worklet slot, value in engine units] */
export function knobMessage(id: string, value: ControlValue): [number, number] | null {
  switch (id) {
    case 'vco1_frequency': return [SLOT.vco1Freq, num(value)];          // octaves from C3
    case 'vco2_frequency': return [SLOT.vco2Freq, num(value)];
    case 'vco1_eg_amount': return [SLOT.vco1Eg, pct(value)];            // -1..1
    case 'vco2_eg_amount': return [SLOT.vco2Eg, pct(value)];
    case 'vco1_wave': return [SLOT.vco1Wave, num(value) === 1 ? 1 : 0];  // ['SQR','TRI'] -> 1 = triangle
    case 'vco2_wave': return [SLOT.vco2Wave, num(value) === 1 ? 1 : 0];
    case 'fm_amount': return [SLOT.fm, pct(value)];
    case 'hard_sync': return [SLOT.sync, num(value) === 0 ? 1 : 0];      // ['ON','OFF']
    case 'vco_decay': return [SLOT.vcoDecay, ms(value)];
    case 'seq_pitch_mod': return [SLOT.seqMod, num(value)];             // ['VCO 1&2','OFF','VCO 2']
    case 'vco1_level': return [SLOT.vco1Level, pct(value)];
    case 'vco2_level': return [SLOT.vco2Level, pct(value)];
    case 'noise_level': return [SLOT.noiseLevel, pct(value)];
    case 'vcf_cutoff': return [SLOT.cutoff, num(value)];                // Hz
    case 'vcf_resonance': return [SLOT.res, pct(value)];
    case 'vcf_eg_amount': return [SLOT.vcfEg, pct(value)];
    case 'vcf_mode': return [SLOT.vcfMode, num(value)];                 // ['HP','LP'] -> 0 = HP
    case 'vcf_decay': return [SLOT.vcfDecay, ms(value)];
    case 'noise_vcf_mod': return [SLOT.noiseVcf, pct(value)];
    case 'vca_decay': return [SLOT.vcaDecay, ms(value)];
    case 'vca_attack_mode': return [SLOT.vcaSlow, num(value)];          // ['FAST','SLOW'] -> 1 = slow
    case 'volume': return [SLOT.volume, pct(value)];
    case 'tempo': return [SLOT.tempo, bpmToHz(num(value))];
    case 'run_stop': return [SLOT.run, value ? 1 : 0];
  }
  const m = /^(pitch|velocity)_([1-8])$/.exec(id);
  if (m) {
    const i = Number(m[2]) - 1;
    return m[1] === 'pitch' ? [SLOT.pitch + i, num(value)] : [SLOT.vel + i, pct(value)];
  }
  return null;
}

/** Input jack -> worklet input index (keep in sync with I_* in the worklet) */
export const INPUTS: Record<string, number> = {
  in_trigger: 0, in_vca_cv: 1, in_velocity: 2, in_vca_decay: 3, in_ext_audio: 4,
  in_vcf_decay: 5, in_noise_level: 6, in_vco_decay: 7, in_vcf_mod: 8, in_vco1_cv: 9,
  in_fm_amount: 10, in_vco2_cv: 11, in_tempo: 12, in_run_stop: 13, in_adv_clock: 14,
};

/** Output jack -> worklet output channel (keep in sync with O_* in the worklet) */
export const OUTPUTS: Record<string, number> = {
  out_vca: 0, out_vca_eg: 1, out_vcf_eg: 2, out_vco_eg: 3, out_vco1: 4, out_vco2: 5,
  out_trigger: 6, out_velocity: 7, out_pitch: 8,
};

export const NUM_INPUTS = 15;
export const NUM_OUTPUTS = 9;

/** Inputs that also take timed events (EventBus cables from other instruments) */
export const EVENT_INPUTS: Record<string, 'trig' | 'adv' | 'run'> = {
  in_trigger: 'trig', in_adv_clock: 'adv', in_run_stop: 'run',
};

/**
 * Self-patches (a DFAM output into a DFAM input) run inside the worklet as a
 * patch matrix, in volts, one sample late - no Web Audio cycles, no latency.
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
