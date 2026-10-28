// ============================================================================
// Elektron Analog Rytm MKII - specification
// 8 analog voices on 12 drum tracks + an FX track, 16-step sequencer.
// Every parameter on every PARAMETER page is its own control (bd_tune,
// sd_snap, bd_flt_freq...). track/page/pad_mode/accent_edit hold UI state.
// Reference: Analog Rytm MKII User Manual (elektron.se), see params.ts.
// ============================================================================

import type { ControlSpec, DeviceSpec, PresetSpec } from '@/types';
import {
  AMP_PARAMS, FLTR_PARAMS, FX_ALL, LFO_PARAMS, MACHINE_PARAMS, PAD_MODES, PAGES, TRACKS, TRACK_DEFAULTS,
  TRACK_OPTIONS, TRIG_PARAMS, type ParamDef,
} from './params';

const knob = (label: string, d: ParamDef, def = d.def): ControlSpec => ({
  type: 'knob',
  label,
  description: d.desc,
  manualReference: d.ref,
  min: d.min,
  max: d.max,
  default: def,
  units: d.units ?? 'none',
  bipolar: d.bipolar,
  step: d.step ?? 1,
  endless: true,
  format: d.fmt,
});

export const DEFAULT_PATTERNS: Record<string, string> = {
  bd: '1000000010000000',
  sd: '0000100000001000',
  ch: '1010101010101010',
};
const EMPTY = '0000000000000000';

function buildControls(): Record<string, ControlSpec> {
  const c: Record<string, ControlSpec> = {};

  TRACKS.forEach((t, i) => {
    const pages = [TRIG_PARAMS, MACHINE_PARAMS[t.machine], FLTR_PARAMS, AMP_PARAMS, LFO_PARAMS];
    pages.forEach(defs => defs.forEach(d => {
      if (!d) return;
      const def = TRACK_DEFAULTS[t.id]?.[d.key] ?? d.def;
      c[`${t.id}_${d.key}`] = knob(`${t.name} ${d.label}`, d, def);
    }));
    c[`${t.id}_pattern`] = {
      type: 'pattern', label: `${t.name} TRIGS`, steps: 16, default: DEFAULT_PATTERNS[t.id] ?? EMPTY,
      description: `Track ${i + 1} (${t.full}) trigs - tap the trig keys to place them`,
      manualReference: 'p.37 – The sequencer: GRID RECORDING',
    };
    c[`${t.id}_accent`] = {
      type: 'pattern', label: `${t.name} ACCENTS`, steps: 16, default: EMPTY,
      description: `Accent trigs for ${t.full}: trigs on these steps play at full velocity`,
      manualReference: 'p.37 – The sequencer: accent trigs',
    };
  });

  FX_ALL.forEach(d => { c[d.key] = knob(d.label, d); });

  // --- Global ---------------------------------------------------------------
  c.bpm = {
    type: 'knob', label: 'TEMPO', min: 30, max: 300, default: 120, units: 'BPM', step: 1, endless: true,
    description: 'Project tempo in beats per minute ([TEMPO] key)', manualReference: 'p.37 – TEMPO menu',
  };
  c.swing = {
    type: 'knob', label: 'SWING', min: 50, max: 80, default: 50, units: '%', step: 1, endless: true,
    format: v => `${Math.round(v)}%`,
    description: 'Delays every second 16th note (50% = straight)', manualReference: 'p.37 – The sequencer: swing',
  };
  c.main_volume = {
    type: 'knob', label: 'MAIN VOLUME', min: 0, max: 127, default: 100, units: 'none', step: 1,
    description: 'Main output and headphones volume', manualReference: 'Ch.3 Panel layout – front panel: MAIN VOLUME',
  };
  c.play = {
    type: 'button', label: 'PLAY', default: false, ledColor: '#22c55e',
    description: 'Start / stop the sequencer (Space bar)', manualReference: 'p.37 – [PLAY] / [STOP]',
  };
  c.accent_edit = {
    type: 'button', label: 'ACCENT', default: false, ledColor: '#f59e0b',
    description: 'Trig keys edit the accent trigs of the active track instead of its normal trigs',
    manualReference: 'p.37 – Accent trigs',
  };

  // --- UI navigation state -------------------------------------------------
  c.track = {
    type: 'switch', label: 'TRACK', options: TRACK_OPTIONS, default: 0,
    description: 'Active track - tap a pad (or [FX] for the FX track)', manualReference: 'p.34 – Editing a sound',
  };
  c.page = {
    type: 'switch', label: 'PAGE', options: [...PAGES], default: 1,
    description: 'PARAMETER page shown on the screen and bound to the DATA ENTRY encoders',
    manualReference: 'p.34 – PARAMETER pages',
  };
  c.pad_mode = {
    type: 'switch', label: 'PAD MODE', options: PAD_MODES, default: 0,
    description: 'PLAY mode plays the pads, MUTE mode mutes/unmutes the sequencer of each track',
    manualReference: 'p.23 – Mode keys',
  };
  return c;
}

// ----------------------------------------------------------------------------
// Kits + patterns
// ----------------------------------------------------------------------------
type S = Record<string, number | string>;
const patterns = (p: Record<string, string>, acc: Record<string, string> = {}): S => {
  const s: S = {};
  TRACKS.forEach(t => {
    s[`${t.id}_pattern`] = p[t.id] ?? EMPTY;
    s[`${t.id}_accent`] = acc[t.id] ?? EMPTY;
  });
  return s;
};
const preset = (name: string, description: string, settings: S): PresetSpec => ({ name, description, source: 'community', settings });

const PRESETS: Record<string, PresetSpec> = {
  techno: preset('Techno - four on the floor', 'Driving 130 BPM kick on every beat, offbeat hats, clap backbeat, compressed and a touch distorted', {
    bpm: 130, swing: 50,
    ...patterns({
      bd: '1000100010001000', cp: '0000100000001000', ch: '0010001000100010', oh: '0000000000000010',
      rs: '0000001000000100', lt: '0000000000100000', cy: '1000000000000000',
    }, { ch: '0010000000100000' }),
    bd_tune: -3, bd_decay: 62, bd_sweep_depth: 80, bd_sweep_time: 35, bd_snap: 55, bd_overdrive: 30,
    cp_reverb_send: 35, cp_tone: 70, ch_velocity: 85, ch_decay: 22, oh_decay: 55, rs_delay_send: 50,
    lt_tune: -8, lt_delay_send: 40, cy_volume: 60,
    fx_delay_time: 24, fx_delay_feedback: 80, fx_reverb_decay: 60,
    fx_comp_threshold: 80, fx_comp_ratio: 1, fx_comp_makeup: 30, fx_comp_mix: 127, fx_dist_amount: 18,
  }),
  house: preset('House - open hats', '124 BPM four-on-the-floor with open hats on the offbeats and a light swing', {
    bpm: 124, swing: 56,
    ...patterns({
      bd: '1000100010001000', cp: '0000100000001000', oh: '0010001000100010', ch: '1000100010001000',
      cb: '0000000000010000', rs: '0001000000010010',
    }),
    bd_tune: 0, bd_decay: 55, bd_sweep_depth: 60, bd_snap: 35,
    oh_decay: 50, oh_color: 70, ch_velocity: 70, cp_reverb_send: 50, cp_number: 3, cb_volume: 70, cb_delay_send: 40, rs_velocity: 80,
    fx_reverb_decay: 55, fx_delay_time: 32, fx_comp_threshold: 95, fx_comp_makeup: 15,
  }),
  boombap: preset('Hip-hop boom bap', '90 BPM swung boom-bap: lazy kick, cracking snare with ghost notes, swung hats', {
    bpm: 90, swing: 62,
    ...patterns({
      bd: '1000000100100000', sd: '0000100100001001', ch: '1010101010101010', oh: '0000000000000010',
    }, { sd: '0000100000001000', ch: '1000100010001000' }),
    bd_tune: -2, bd_decay: 75, bd_sweep_depth: 55, bd_snap: 30, bd_overdrive: 20,
    sd_velocity: 45, sd_tune: -2, sd_noise_decay: 55, sd_reverb_send: 30, sd_flt_type: 0, sd_flt_freq: 105,
    ch_velocity: 70, ch_decay: 25, ch_flt_freq: 110,
    fx_reverb_decay: 45, fx_comp_threshold: 85, fx_comp_ratio: 1, fx_comp_makeup: 25,
  }),
  breakbeat: preset('Breakbeat', '132 BPM syncopated break: off-grid kicks, accented snare with ghosts, ride cymbal', {
    bpm: 132, swing: 54,
    ...patterns({
      bd: '1010000000100100', sd: '0000100101001001', ch: '1010101010101010', cy: '0000000010000000', ht: '0000000000000100',
    }, { sd: '0000100000001000' }),
    bd_tune: 1, bd_decay: 45, bd_sweep_depth: 65, bd_snap: 60,
    sd_velocity: 50, sd_snap: 80, sd_noise_level: 95, sd_tune: 3,
    ch_decay: 20, ch_velocity: 80, cy_decay: 80, cy_volume: 70, ht_tune: 4,
    fx_comp_threshold: 75, fx_comp_ratio: 2, fx_comp_makeup: 35, fx_dist_amount: 25, fx_reverb_decay: 35,
  }),
  electro: preset('Electro', '118 BPM electro funk: syncopated booming kick, claps, cowbell and toms', {
    bpm: 118, swing: 50,
    ...patterns({
      bd: '1000001000100000', cp: '0000100000001000', ch: '1010101010101010', cb: '0010010000100100',
      lt: '0000000000000010', mt: '0000000000001000',
    }, { ch: '0010001000100010' }),
    bd_tune: -5, bd_decay: 95, bd_hold: 30, bd_sweep_depth: 50, bd_sweep_time: 70, bd_snap: 20, bd_wave: 0,
    cp_number: 4, cp_reverb_send: 40, ch_decay: 18, cb_delay_send: 50, cb_volume: 75, lt_tune: -7, mt_tune: -2,
    lt_decay: 80, mt_decay: 75, fx_delay_time: 16, fx_delay_pingpong: 1, fx_delay_feedback: 70, fx_comp_threshold: 90,
  }),
  minimal: preset('Minimal', '126 BPM minimal: kick, rim clicks into the delay, sparse filtered hats, swung', {
    bpm: 126, swing: 55,
    ...patterns({
      bd: '1000100010001000', rs: '0000001000000010', ch: '0010001000100011', cb: '0000000000100000', bt: '0000000100000000',
    }),
    bd_tune: -1, bd_decay: 50, bd_snap: 25, bd_sweep_depth: 55,
    rs_delay_send: 80, rs_reverb_send: 40, rs_velocity: 90,
    ch_flt_type: 4, ch_flt_freq: 95, ch_flt_res: 30, ch_lfo_dest: 2, ch_lfo_depth: 25, ch_lfo_speed: 8, ch_lfo_mult: 3,
    cb_tune: -7, cb_delay_send: 70, cb_volume: 60, bt_decay: 70, bt_tune: 2,
    fx_delay_time: 24, fx_delay_feedback: 110, fx_delay_pingpong: 1, fx_reverb_decay: 70, fx_comp_threshold: 100,
  }),
};

export const ANALOG_RYTM: DeviceSpec = {
  id: 'analog-rytm',
  name: 'Analog Rytm MKII',
  manufacturer: 'Elektron',
  year: 2017,
  description: '8-voice analog drum computer with 12 velocity pads, 12 drum tracks + FX track and a 16-step sequencer',
  manualUrl: 'https://www.elektron.se/support-downloads/analog-rytm-mkii',
  // Elektron spec: W385 x D225 x H82 mm including knobs, jacks and feet
  dimensions: { width: 385, height: 225, depth: 82 },
  display: { width: 1300, height: 650, scale: 3.4 },
  signalFlow: [
    { id: 'voices', name: 'Analog voices', description: '8 analog voices on 12 tracks (RS/CP, MT/HT, CH/OH, CY/CB share)', order: 1, controls: TRACKS.map(t => `${t.id}_level`) },
    { id: 'track', name: 'Track: overdrive > filter > amp', description: 'Per-track overdrive, multimode filter with ADSR, amp envelope, pan, sends', order: 2, controls: TRACKS.flatMap(t => [`${t.id}_flt_freq`, `${t.id}_volume`]) },
    { id: 'fx', name: 'FX track', description: 'Send delay and reverb, master distortion and compressor', order: 3, controls: FX_ALL.map(d => d.key) },
    { id: 'seq', name: 'Sequencer', description: '16-step trigs and accents per track, tempo and swing', order: 4, controls: ['bpm', 'swing', 'play', ...TRACKS.map(t => `${t.id}_pattern`)] },
  ],
  controls: buildControls(),
  presets: PRESETS,
};
