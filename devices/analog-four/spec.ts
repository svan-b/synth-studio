// ============================================================================
// Elektron Analog Four MKII - specification
// Four-voice analog synthesizer with a 16-step parameter-lock sequencer.
//
// Every sound parameter exists once per track (t1_osc1_tune ... t4_lfo2_depth_b)
// and is reached through the ten DATA ENTRY encoders A-J, which follow the
// selected track (TRACK keys) and page (PARAMETER keys) - see params.ts.
// Hidden pattern-like controls per track hold the trigs (tN_pattern), the
// per-step notes (tN_notes) and the parameter locks (tN_locks).
//
// Sources: Elektron Analog Four MKII User Manual (OS 1.4x, 108 pp.),
// Appendix A "Synth track parameters" p.82-87, Appendix B "FX track
// parameters" p.88-92; elektron.se product specifications (385 x 225 x 82 mm
// including knobs and feet, 2.4 kg, 128 x 64 OLED).
// ============================================================================

import type { ControlSpec, DeviceSpec, PresetSpec } from '@/types';
import {
  EMPTY_LOCKS, EMPTY_NOTES, FX_PARAMS, FX_PAGE_NAMES, LOCK_STRING_LEN, NUM_TRACKS, PAGES, STEPS, SYNTH_PARAMS, TRACKS,
  fxid, locks, locksId, notes, notesId, pat, patternId, tid,
  type ParamDef,
} from './params';

const PAGE_SHORT = ['TRIG', 'OSC1', 'OSC2', 'NOISE', 'FLTR', 'ENV', 'AMP', 'LFO1', 'LFO2', 'TEMPO'];

function knobFor(p: ParamDef, label: string): ControlSpec {
  return {
    type: 'knob',
    label,
    description: `${p.name}: ${p.desc}`,
    manualReference: p.manual,
    min: p.min,
    max: p.max,
    default: p.def,
    step: p.step,
    units: p.units ?? 'none',
    bipolar: p.bipolar,
    endless: true,
    format: p.fmt,
  };
}

const controls: Record<string, ControlSpec> = {};

for (let t = 0; t < NUM_TRACKS; t++) {
  SYNTH_PARAMS.forEach(p => {
    controls[tid(t, p.key)] = knobFor(p, `T${t + 1} ${PAGE_SHORT[p.page]} ${p.short}`);
  });
  controls[patternId(t)] = {
    type: 'pattern', label: `T${t + 1} TRIGS`, steps: STEPS,
    default: t === 0 ? pat('x...x...x...x...') : pat(''),
    description: `Track ${t + 1} trigs - one per [TRIG] key`,
    manualReference: 'Manual - Sequencer, GRID RECORDING mode',
  };
  controls[notesId(t)] = {
    type: 'pattern', label: `T${t + 1} STEP NOTES`, steps: STEPS * 2, default: EMPTY_NOTES,
    description: 'Per-step note locks (hold a trig, turn NOTE)',
    manualReference: 'Manual - Sequencer, Parameter locks',
  };
  controls[locksId(t)] = {
    type: 'pattern', label: `T${t + 1} P-LOCKS`, steps: LOCK_STRING_LEN, default: EMPTY_LOCKS,
    description: 'Parameter locks (hold a trig, turn an encoder)',
    manualReference: 'Manual - Sequencer, Parameter locks',
  };
}

FX_PARAMS.forEach(p => {
  controls[fxid(p.key)] = knobFor(p, `FX ${FX_PAGE_NAMES[p.fxPage]} ${p.short}`);
});

Object.assign(controls, {
  tempo: {
    type: 'knob', label: 'TEMPO BPM', min: 30, max: 300, default: 120, step: 1, units: 'BPM', endless: true,
    description: 'Project tempo. Press [TEMPO], then turn DATA ENTRY knob A.', manualReference: 'Manual - Quick start, Tempo',
  },
  main_volume: {
    type: 'knob', label: 'MAIN VOLUME', min: 0, max: 127, default: 100, step: 1, units: 'none',
    description: 'Volume of the main and headphone outputs', manualReference: 'Manual - Front panel, MAIN VOLUME',
  },
  track: {
    type: 'switch', label: 'TRACK', options: [...TRACKS], default: 0,
    description: 'Selected track - the encoders, screen and trig keys follow it', manualReference: 'Manual - Front panel, [TRACK] keys',
  },
  page: {
    type: 'switch', label: 'PAGE', options: [...PAGES], default: 1,
    description: 'Selected PARAMETER page', manualReference: 'Manual - Front panel, [PARAMETER] keys',
  },
  lock_step: {
    type: 'switch', label: 'HELD TRIG', options: ['OFF', ...Array.from({ length: STEPS }, (_, i) => String(i + 1))], default: 0,
    description: 'Trig being held for parameter locking', manualReference: 'Manual - Sequencer, Parameter locks',
  },
  play: { type: 'button', label: 'PLAY', default: false, description: 'Start / stop the sequencer (Space bar)', manualReference: 'Manual - Front panel, [PLAY] / [STOP]' },
  grid_rec: { type: 'button', label: 'REC', default: true, description: 'GRID RECORDING: when lit the trig keys enter trigs; when off they audition steps', manualReference: 'Manual - Sequencer, GRID RECORDING mode' },
  func: { type: 'button', label: 'FUNC', default: false, description: 'FUNC (latching here): while lit, [TRIG] keys 1-4 mute / unmute tracks 1-4', manualReference: 'Manual - Front panel, [FUNC]; Sequencer, track mutes' },
  mutes: { type: 'pattern', label: 'MUTES', steps: 4, default: '0000', description: 'Track mutes, 1 = muted', manualReference: 'Manual - Sequencer, track mutes' },
} satisfies Record<string, ControlSpec>);

// ----------------------------------------------------------------------------
// Presets (kits + patterns). Settings are diffs from the defaults.
// ----------------------------------------------------------------------------

type Sets = Record<string, number | string | boolean>;
const T = (track: number, s: Record<string, number | string>): Sets =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [`t${track}_${k}`, v]));
const clearAll = (): Sets => {
  const s: Sets = {};
  for (let t = 0; t < NUM_TRACKS; t++) {
    s[patternId(t)] = pat('');
    s[notesId(t)] = EMPTY_NOTES;
    s[locksId(t)] = EMPTY_LOCKS;
  }
  s.mutes = '0000';
  return s;
};
const preset = (name: string, description: string, ...parts: Sets[]): PresetSpec => ({
  name, description, source: 'community', author: 'Synth Studio', settings: Object.assign(clearAll(), ...parts),
});

// Reusable sounds
const KICK = (t: number) => T(t, {
  osc1_wave: 3, osc1_level: 120, osc1_track: 0, osc1_tune: -12, flt1_freq: 70, flt1_res: 0, flt2_freq: 0,
  amp_attack: 0, amp_decay: 52, amp_sustain: 0, amp_release: 30, amp_volume: 120,
  lfo1_mode: 3, lfo1_wave: 4, lfo1_speed: 63, lfo1_mult: 3, lfo1_dest_a: 1, lfo1_depth_a: 63,
});
const HAT = (t: number) => T(t, {
  osc1_level: 0, noise_level: 120, flt1_freq: 127, flt2_type: 4, flt2_freq: 112, flt2_res: 20,
  amp_decay: 22, amp_sustain: 0, amp_release: 18, amp_volume: 80, amp_pan: 12,
});

export const ANALOG_FOUR: DeviceSpec = {
  id: 'analog-four',
  name: 'Analog Four MKII',
  manufacturer: 'Elektron',
  year: 2017,
  description: 'Four-voice analog synthesizer and sequencer: per voice 2 VCOs with sub oscillators, noise, a 4-pole ladder low-pass and a 2-pole multimode filter, 2 envelopes, 2 LFOs; FX track with chorus, delay and reverb; 16-step sequencer with parameter locks.',
  manualUrl: 'https://www.elektron.se/support-downloads/analog-four-mkii',
  dimensions: { width: 385, height: 225, depth: 82 },
  display: { width: 1300, height: 760, scale: 3.38 },

  signalFlow: [
    { id: 'sequencer', name: 'Sequencer', order: 1, description: '16 trig keys per track, per-step notes and parameter locks', controls: ['play', 'tempo', ...Array.from({ length: NUM_TRACKS }, (_, t) => patternId(t))] },
    { id: 'oscillators', name: 'Oscillators', order: 2, description: 'OSC 1 / OSC 2 with sub oscillators, NOISE', controls: SYNTH_PARAMS.filter(p => p.page >= 1 && p.page <= 3).map(p => tid(0, p.key)) },
    { id: 'filters', name: 'Filters', order: 3, description: '4-pole ladder low-pass into a 2-pole multimode filter, ENV F', controls: SYNTH_PARAMS.filter(p => p.page === 4 || p.page === 5).map(p => tid(0, p.key)) },
    { id: 'amp', name: 'Amp', order: 4, description: 'Amplitude envelope, FX sends, pan, volume', controls: SYNTH_PARAMS.filter(p => p.page === 6).map(p => tid(0, p.key)) },
    { id: 'lfo', name: 'LFOs', order: 5, description: 'Two assignable LFOs per track', controls: SYNTH_PARAMS.filter(p => p.page === 7 || p.page === 8).map(p => tid(0, p.key)) },
    { id: 'fx', name: 'FX track', order: 6, description: 'Chorus, delay, reverb', controls: FX_PARAMS.map(p => fxid(p.key)) },
  ],

  controls,

  presets: {
    pulse: preset('Init: bass pulse', 'Track 1 plays a plain saw on every beat - the starting point for the lessons',
      { [patternId(0)]: pat('x...x...x...x...') }),

    techno: preset('Techno bassline + pad', 'Rolling off-beat bass, a slow-filtered pad, kick and hats', { tempo: 128 },
      KICK(1), { [patternId(0)]: pat('x...x...x...x...') },
      T(2, {
        trig_note: 33, osc1_wave: 0, osc1_sub: 1, osc1_level: 100, flt1_freq: 46, flt1_res: 45, flt1_depth: 30,
        envf_decay: 38, amp_decay: 40, amp_sustain: 0, amp_release: 20, trig_len: 0.5,
      }),
      { [patternId(1)]: pat('..x...x...x...xx'), [notesId(1)]: notes([null, null, 33, null, null, null, 33, null, null, null, 36, null, null, null, 33, 45]) },
      T(3, {
        trig_note: 57, osc1_wave: 0, osc2_wave: 0, osc2_level: 90, osc2_detune: 14, osc1_level: 90,
        flt1_freq: 60, flt1_res: 30, amp_attack: 80, amp_decay: 90, amp_sustain: 110, amp_release: 90, amp_volume: 80,
        amp_reverb: 80, amp_chorus: 70, trig_len: 16, lfo1_speed: 8, lfo1_mult: 2, lfo1_dest_a: 8, lfo1_depth_a: 20,
      }),
      { [patternId(2)]: pat('x...............') },
      HAT(4), { [patternId(3)]: pat('..x...x...x...x.') },
    ),

    acid: preset('Acid line', 'Transistor-pulse bass through a screaming ladder, with filter and note locks', { tempo: 126, fx_del_time: 24, fx_del_fb: 60 },
      T(1, {
        trig_note: 36, osc1_wave: 1, osc1_level: 110, flt1_freq: 38, flt1_res: 104, flt1_overdrive: 60, flt1_depth: 36,
        envf_decay: 42, envf_sustain: 0, amp_decay: 50, amp_sustain: 30, amp_release: 20, trig_len: 0.75, amp_delay: 30,
      }),
      {
        [patternId(0)]: pat('xx.x.xx.x.xxx.x.'),
        [notesId(0)]: notes([36, 48, null, 36, null, 39, 36, null, 46, null, 36, 48, 51, null, 34, null]),
        [locksId(0)]: locks({ 6: { flt1_freq: 70 }, 12: { flt1_freq: 64, trig_vel: 127 }, 13: { flt1_res: 120 } }),
      },
      KICK(2), { [patternId(1)]: pat('x...x...x...x...') },
      HAT(4), { [patternId(3)]: pat('..x...x...x...x.') },
    ),

    arp: preset('Arpeggio', 'A minor arpeggio with PWM, dotted-eighth delay and a root bass', { tempo: 112, fx_del_time: 24, fx_del_fb: 70, fx_del_lpf: 80 },
      T(1, {
        osc1_wave: 2, osc1_pwm: 60, osc1_pwm_speed: 30, osc1_level: 100, flt1_freq: 80, flt1_res: 30, flt1_depth: 20,
        envf_decay: 45, amp_decay: 48, amp_sustain: 0, amp_release: 40, amp_delay: 70, amp_reverb: 30, amp_volume: 95,
      }),
      {
        [patternId(0)]: pat('xxxxxxxxxxxxxxxx'),
        [notesId(0)]: notes([57, 60, 64, 69, 72, 69, 64, 60, 55, 59, 62, 67, 71, 67, 62, 59]),
      },
      T(2, { trig_note: 33, osc1_wave: 0, osc1_sub: 2, flt1_freq: 50, amp_decay: 80, amp_sustain: 80, trig_len: 7 }),
      { [patternId(1)]: pat('x.......x.......'), [notesId(1)]: notes([33, null, null, null, null, null, null, null, 31, null, null, null, null, null, null, null]) },
    ),

    ambient: preset('Ambient drift', 'Slow detuned pad with LFO filter drift and sparse reverb bells', { tempo: 84, fx_rev_decay: 110, fx_rev_lpf: 70, fx_del_time: 48, fx_del_fb: 75 },
      T(1, {
        trig_note: 52, osc1_wave: 3, osc2_wave: 0, osc2_level: 70, osc2_tune: 12, osc2_detune: 9, osc1_sub: 1,
        flt1_freq: 58, flt1_res: 40, amp_attack: 96, amp_decay: 100, amp_sustain: 120, amp_release: 100, trig_len: 16,
        amp_reverb: 110, amp_chorus: 90, amp_volume: 85,
        lfo1_speed: 4, lfo1_mult: 2, lfo1_wave: 1, lfo1_dest_a: 8, lfo1_depth_a: 26, lfo2_speed: 3, lfo2_mult: 1, lfo2_dest_a: 13, lfo2_depth_a: 40,
      }),
      { [patternId(0)]: pat('x...............') },
      T(2, {
        trig_note: 76, osc1_wave: 3, osc2_wave: 3, osc2_tune: 19, osc2_level: 60, flt1_freq: 100,
        amp_decay: 70, amp_sustain: 0, amp_release: 70, amp_reverb: 120, amp_delay: 70, amp_volume: 70, amp_pan: -20,
      }),
      { [patternId(1)]: pat('..x.....x..x....'), [notesId(1)]: notes([null, null, 76, null, null, null, null, null, 79, null, null, 71, null, null, null, null]) },
    ),

    groove: preset('Four-track groove', 'Kick, bass, chord stab with p-locked filter, hats - every track doing one job', { tempo: 122 },
      KICK(1), { [patternId(0)]: pat('x...x...x...x...') },
      T(2, { trig_note: 31, osc1_wave: 2, osc1_pw: 40, osc1_sub: 1, flt1_freq: 44, flt1_res: 50, flt1_depth: 24, envf_decay: 34, amp_decay: 36, amp_sustain: 0, trig_len: 0.5 }),
      { [patternId(1)]: pat('..x..x.x..x..x.x'), [notesId(1)]: notes([null, null, 31, null, null, 31, null, 43, null, null, 34, null, null, 31, null, 38]) },
      T(3, {
        trig_note: 60, osc1_wave: 0, osc2_wave: 0, osc2_tune: 7, osc2_level: 90, flt1_freq: 58, flt1_res: 60, flt1_depth: 28,
        envf_decay: 40, amp_decay: 44, amp_sustain: 0, amp_release: 36, amp_delay: 55, amp_reverb: 40, amp_volume: 80,
      }),
      { [patternId(2)]: pat('...x.....x....x.'), [locksId(2)]: locks({ 4: { flt1_freq: 46 }, 10: { flt1_freq: 72, osc2_tune: 5 }, 15: { flt1_freq: 84 } }) },
      HAT(4), { [patternId(3)]: pat('..x...x...x...xx'), [locksId(3)]: locks({ 16: { amp_decay: 40, trig_vel: 70 } }) },
    ),

    supersaw: preset('Detuned saw lead', 'Two detuned saws plus sub through LP then HP - a bright, wide lead', { tempo: 120 },
      T(1, {
        trig_note: 60, osc1_wave: 0, osc2_wave: 0, osc2_detune: 20, osc2_level: 100, osc1_sub: 1, flt1_freq: 92, flt1_res: 24,
        flt2_type: 4, flt2_freq: 40, amp_attack: 10, amp_decay: 70, amp_sustain: 90, amp_release: 50, amp_chorus: 80, amp_delay: 40, trig_len: 2,
        lfo1_speed: 24, lfo1_mult: 4, lfo1_wave: 1, lfo1_dest_a: 1, lfo1_depth_a: 1, lfo1_fade: -24,
      }),
      { [patternId(0)]: pat('x..x..x...x.x...'), [notesId(0)]: notes([60, null, null, 63, null, null, 67, null, null, null, 70, null, 67, null, null, null]) },
      KICK(2), { [patternId(1)]: pat('x...x...x...x...') },
    ),
  },
};
