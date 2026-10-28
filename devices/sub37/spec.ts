// ============================================================================
// MOOG SUB 37 TRIBUTE EDITION
// Paraphonic (2-note) analog synthesizer: two VCOs + sub oscillator, noise,
// mixer feedback, 20 Hz-20 kHz Moog ladder filter with 6/12/18/24 dB slopes and
// Multidrive, two DAHDSR envelopes, two modulation busses, glide, arpeggiator,
// 37-key keyboard with pitch and mod wheels.
//
// Control names follow the Sub 37 User Manual v1.1 (Moog Music, 2014). Page
// numbers ("p.NN") use that manual's PDF pagination.
//
// Simplifications (honest, see also `tips` in index.ts):
//  - The preset/menu system is reduced to a 16-button preset bank (bank 1) that
//    recalls the factory-style patches below; SAVE, BANK and the LCD menus are
//    not modelled. The LCD shows the preset and the last parameter you touched.
//  - Each mod bus's programmable destination (PGM DEST, chosen in the Sub 37's
//    menu from ~100 targets) is offered as a short panel selector with four
//    representative targets. The programmable source (PGM SRC) is not modelled.
//  - Envelope SYNC, the step sequencer, arpeggiator INVERT and clock-sync are
//    not modelled. The arpeggiator plays one note per beat at RATE (BPM).
//  - HEADPHONE VOLUME is not modelled (there is one output).
// ============================================================================

import type { ControlSpec, DeviceSpec, KnobSpec, PresetSpec } from '@/types';

export const MANUAL = 'Sub 37 Manual v1.1';
const P = {
  overview: `${MANUAL} p.9 – Overview`,
  presets: `${MANUAL} p.11 – Presets & LCD`,
  arp: `${MANUAL} p.15 – Arpeggiator`,
  wheels: `${MANUAL} p.20 – Pitch & Mod Wheels`,
  glide: `${MANUAL} p.21 – Glide`,
  mod: `${MANUAL} p.22 – Modulation (Mod 1 / Mod 2)`,
  modDest: `${MANUAL} p.23 – Mod destinations`,
  osc: `${MANUAL} p.24 – Oscillators`,
  osc2: `${MANUAL} p.25 – Oscillator 2, Hard Sync, Duo`,
  mixer: `${MANUAL} p.26 – Mixer`,
  filter: `${MANUAL} p.27 – Filter`,
  feg: `${MANUAL} p.30 – Filter Envelope`,
  fegShift: `${MANUAL} p.31 – Filter EG (Knob Shift)`,
  aeg: `${MANUAL} p.32 – Amplifier Envelope`,
  aegShift: `${MANUAL} p.33 – Amp EG (Knob Shift)`,
  output: `${MANUAL} p.34 – Output`,
  pgm: `${MANUAL} p.51 – PGM DEST menu`,
};
export const MANUAL_PAGES = P;

export const MOD_SOURCES = ['TRI', 'SQR', 'SAW', 'RAMP', 'S&H', 'FILT EG'];
export const PGM_DESTS = ['WAVE', 'RES', 'EG TIME', 'AMP'];
export const OCTAVES = ["16'", "8'", "4'", "2'"];

const pct = (label: string, description: string, manualReference: string, def = 0, extra: Partial<KnobSpec> = {}): KnobSpec => ({
  type: 'knob', label, description, manualReference, min: 0, max: 100, default: def, units: '%', ...extra,
});
const timeMs = (label: string, description: string, manualReference: string, def: number, min = 1): KnobSpec => ({
  type: 'knob', label, description, manualReference, min, max: 10000, default: def, units: 'ms', curve: 'logarithmic',
});
const zeroTimeMs = (label: string, description: string, manualReference: string): KnobSpec => ({
  type: 'knob', label, description, manualReference, min: 0, max: 10000, default: 0, units: 'ms', curve: 'exponential',
});
const btn = (label: string, description: string, manualReference: string, def = false): ControlSpec => ({
  type: 'button', label, description, manualReference, default: def, ledColor: '#ff3b30',
});

/** WAVE knob readout: 0 TRI · 33 SAW · 67 SQR · 100 narrow PULSE */
export const formatWave = (v: number): string => {
  if (v < 3) return 'TRI';
  if (v < 30) return `TRI>SAW`;
  if (v <= 36) return 'SAW';
  if (v < 64) return 'SAW>SQR';
  if (v <= 70) return 'SQR';
  if (v < 97) return `PW ${Math.round(50 - 42 * ((v - 66.67) / 33.33))}%`;
  return 'PULSE';
};

function modBus(n: 1 | 2): Record<string, ControlSpec> {
  const mw = n === 1 ? ' Mod 1 depth follows the MOD wheel (as on the init patch).' : ' Mod 2 is always fully on.';
  return {
    [`mod${n}_source`]: {
      type: 'switch', label: 'SOURCE', options: MOD_SOURCES, default: 0,
      description: `Mod ${n} source: the LFO shape (triangle, square, saw, ramp, sample & hold) or the Filter Envelope.`,
      manualReference: P.mod,
    },
    [`mod${n}_rate`]: {
      type: 'knob', label: 'RATE', min: 0.1, max: 100, default: n === 1 ? 5 : 1, units: 'Hz', curve: 'logarithmic',
      description: `Mod ${n} LFO rate, 0.1–100 Hz (x10 with HI RANGE, up to 1 kHz).`,
      manualReference: P.mod,
    },
    [`mod${n}_hi_range`]: btn('HI RANGE', 'Multiplies the LFO range by 10 (1 Hz–1 kHz) – audio-rate modulation, FM-like tones.', P.mod),
    [`mod${n}_pitch_amt`]: pct('PITCH AMT', `How much Mod ${n} moves oscillator pitch.${mw}`, P.mod),
    [`mod${n}_pitch_dest`]: {
      type: 'switch', label: 'PITCH', options: ['OSC 1+2', 'OSC 1', 'OSC 2'], default: 0,
      description: 'Which oscillator(s) the pitch modulation reaches.', manualReference: P.modDest,
    },
    [`mod${n}_filter_amt`]: pct('FILTER AMT', `How much Mod ${n} moves the filter cutoff.${mw}`, P.mod),
    [`mod${n}_pgm_amt`]: pct('PGM AMT', `How much Mod ${n} reaches its programmable destination.${mw}`, P.mod),
    [`mod${n}_pgm_dest`]: {
      type: 'switch', label: 'PGM DEST', options: PGM_DESTS, default: 0,
      description: 'Programmable destination (a menu item on the hardware): WAVE of both oscillators, filter RESonance, EG TIME of both envelopes, or AMP level.',
      manualReference: P.pgm,
    },
  };
}

function envelope(prefix: 'feg' | 'aeg', name: string, ref: string, refShift: string, d: { a: number; d: number; s: number; r: number }): Record<string, ControlSpec> {
  return {
    [`${prefix}_attack`]: timeMs('ATTACK', `${name}: time to rise from its current level to the peak.`, ref, d.a),
    [`${prefix}_decay`]: timeMs('DECAY', `${name}: time to fall from the peak to the sustain level.`, ref, d.d),
    [`${prefix}_sustain`]: pct('SUSTAIN', `${name}: level held while the key is down.`, ref, d.s),
    [`${prefix}_release`]: timeMs('RELEASE', `${name}: time to fall to zero after the key is released.`, ref, d.r),
    [`${prefix}_delay`]: zeroTimeMs('DELAY', `${name} (KNOB SHIFT + ATTACK): wait before the attack starts.`, refShift),
    [`${prefix}_hold`]: zeroTimeMs('HOLD', `${name} (KNOB SHIFT + DECAY): time held at the peak before the decay.`, refShift),
    [`${prefix}_vel_amt`]: pct('VEL AMT', `${name} (KNOB SHIFT + SUSTAIN): how much key velocity scales the envelope.`, refShift, 50),
    [`${prefix}_kb_amt`]: pct('KB AMT', `${name} (KNOB SHIFT + RELEASE): higher notes make the envelope faster.`, refShift),
    [`${prefix}_multi_trig`]: btn('MULTI TRIG', 'Lit: every new key restarts the envelope, even when playing legato. Unlit: legato notes do not retrigger (single trigger).', ref),
    [`${prefix}_reset`]: btn('RESET', 'Lit: the attack always starts from zero. Unlit: it starts from wherever the envelope is.', ref),
    [`${prefix}_loop`]: btn('LOOP', 'Lit: while a key is held the envelope repeats its cycle, becoming a multi-stage LFO.', ref),
    [`${prefix}_latch`]: btn('LATCH', 'Lit: the envelope stays at its sustain level as if the gate were still on.', ref),
  };
}

const controls: Record<string, ControlSpec> = {
  // ===== MODULATION ==========================================================
  ...modBus(1),
  ...modBus(2),

  // ===== OSCILLATORS =========================================================
  osc1_octave: { type: 'switch', label: 'OCTAVE', options: OCTAVES, default: 1, description: 'Oscillator 1 footage: 16\' is an octave below 8\', 4\' an octave above.', manualReference: P.osc },
  osc1_wave: { type: 'knob', label: 'WAVE', min: 0, max: 100, default: 33, units: 'none', format: formatWave, description: 'Continuously variable: triangle → sawtooth → square → narrow pulse.', manualReference: P.osc },
  osc2_octave: { type: 'switch', label: 'OCTAVE', options: OCTAVES, default: 1, description: 'Oscillator 2 footage.', manualReference: P.osc2 },
  osc2_wave: { type: 'knob', label: 'WAVE', min: 0, max: 100, default: 33, units: 'none', format: formatWave, description: 'Oscillator 2 waveshape: triangle → sawtooth → square → narrow pulse.', manualReference: P.osc2 },
  osc2_frequency: {
    type: 'knob', label: 'FREQUENCY', min: -7, max: 7, default: 0, units: 'semitones', bipolar: true,
    format: v => `${v > 0 ? '+' : ''}${v.toFixed(2)}`,
    description: 'Tunes Oscillator 2 ±7 semitones against Oscillator 1 (detune, fifths, fourths).', manualReference: P.osc2,
  },
  beat_freq: {
    type: 'knob', label: 'BEAT FREQ', min: -3, max: 3, default: 0, units: 'Hz', bipolar: true,
    format: v => `${v > 0 ? '+' : ''}${v.toFixed(2)}Hz`,
    description: 'Detunes Oscillator 2 by a fixed number of Hz, so the beating rate stays the same across the keyboard.', manualReference: P.osc2,
  },
  hard_sync: btn('HARD SYNC', 'Oscillator 2 restarts its cycle every time Oscillator 1 starts one.', P.osc2),
  duo_mode: btn('DUO MODE', 'Paraphonic duo: with two keys held, Oscillator 1 plays the lowest and Oscillator 2 the highest.', P.osc2),
  kb_reset: btn('KB RESET', 'Every new note restarts both oscillators at the start of their cycle – a consistent, punchy attack.', P.osc),
  osc2_kb_ctrl: btn('KB CTRL', 'Lit: Oscillator 2 follows the keyboard. Unlit: it drones at a fixed pitch.', P.osc2, true),

  // ===== MIXER ===============================================================
  mix_osc1: pct('OSC 1', 'Oscillator 1 level into the filter.', P.mixer, 80),
  mix_sub: pct('SUB OSC', 'Square wave one octave below Oscillator 1.', P.mixer),
  mix_osc2: pct('OSC 2', 'Oscillator 2 level into the filter.', P.mixer),
  mix_noise: pct('NOISE', 'White noise level.', P.mixer),
  mix_feedback: pct('FDBK/EXT', 'Feedback: the mixer output fed back into itself for grit and growl (EXT IN not modelled).', P.mixer),

  // ===== FILTER ==============================================================
  cutoff: { type: 'knob', label: 'CUTOFF', min: 20, max: 20000, default: 1200, units: 'Hz', curve: 'logarithmic', size: 'large', description: 'Moog ladder filter cutoff, 20 Hz–20 kHz. Harmonics above it are attenuated.', manualReference: P.filter },
  resonance: pct('RESONANCE', 'Feeds the filter output back to its input: a peak at the cutoff, self-oscillation near maximum.', P.filter),
  multidrive: pct('MULTIDRIVE', 'Overdrives the OTA and FET stages after the filter: warm tube-like grit to hard clipping.', P.filter),
  filter_kb_amt: pct('KB AMT', 'Keyboard tracking: how far the cutoff follows the note you play (100% = one octave per octave).', P.filter, 50),
  filter_eg_amt: { type: 'knob', label: 'EG AMT', min: -100, max: 100, default: 40, units: '%', bipolar: true, description: 'How far the Filter Envelope sweeps the cutoff (up to ±6 octaves). Negative sweeps down.', manualReference: P.filter },
  filter_slope: { type: 'switch', label: 'SLOPE', options: ['-6dB', '-12dB', '-18dB', '-24dB'], default: 3, description: 'Ladder filter slope per octave above cutoff: 1, 2, 3 or 4 poles.', manualReference: P.filter },

  // ===== ENVELOPES ===========================================================
  ...envelope('feg', 'Filter EG', P.feg, P.fegShift, { a: 5, d: 400, s: 30, r: 300 }),
  ...envelope('aeg', 'Amp EG', P.aeg, P.aegShift, { a: 2, d: 300, s: 80, r: 200 }),

  // ===== GLIDE ===============================================================
  glide_time: timeMs('TIME', 'How long the pitch takes to slide from one note to the next.', P.glide, 150),
  glide_on: btn('ON', 'Turns glide (portamento) on.', P.glide),
  glide_type: { type: 'switch', label: 'TYPE', options: ['LCR', 'LCT', 'EXP'], default: 1, description: 'LCR: constant rate (bigger intervals take longer). LCT: constant time. EXP: fast then slowing into the note.', manualReference: P.glide },
  glide_legato: btn('LEGATO', 'Glide only when you press a key while still holding the previous one.', P.glide),
  glide_gated: btn('GATED', 'Glide only progresses while a key is held.', P.glide),
  glide_osc: { type: 'switch', label: 'OSC', options: ['1+2', '1', '2'], default: 0, description: 'Which oscillators glide.', manualReference: P.glide },

  // ===== ARPEGGIATOR =========================================================
  arp_on: btn('ON/OFF', 'Arpeggiator: held keys are played one after another.', P.arp),
  arp_rate: { type: 'knob', label: 'RATE', min: 2, max: 280, default: 120, units: 'BPM', curve: 'logarithmic', description: 'Arpeggiator tempo, 2–280 BPM (one note per beat).', manualReference: P.arp },
  arp_latch: btn('LATCH', 'The arpeggio keeps playing after you let go; new chords replace it.', P.arp),
  arp_mode: { type: 'switch', label: 'MODE', options: ['UP', 'DOWN', 'ORDER', 'RAND'], default: 0, description: 'Note order: up, down, the order you played them, or random.', manualReference: P.arp },
  arp_range: { type: 'switch', label: 'RANGE', options: ['-2', '-1', '0', '+1', '+2'], default: 2, description: 'Octave range the arpeggio spans (±2 octaves).', manualReference: P.arp },
  arp_back_fwd: btn('BACK/FWD', 'Plays the pattern forwards then backwards.', P.arp),

  // ===== OUTPUT & PERFORMANCE ================================================
  master_volume: pct('MASTER VOL', 'Main output level.', P.output, 70),
  knob_shift: btn('KNOB SHIFT', 'Envelope knobs switch to their second function: ATTACK→DELAY, DECAY→HOLD, SUSTAIN→VEL AMT, RELEASE→KB AMT.', P.fegShift),
  pitch_bend: { type: 'knob', label: 'PITCH', min: -100, max: 100, default: 0, units: '%', bipolar: true, description: 'Pitch wheel: ±2 semitones, springs back to centre.', manualReference: P.wheels },
  mod_wheel: { type: 'knob', label: 'MOD', min: 0, max: 100, default: 0, units: '%', description: 'Mod wheel: scales the depth of Mod 1.', manualReference: P.wheels },
  preset_number: { type: 'knob', label: 'PRESET', min: 0, max: 16, default: 0, step: 1, units: 'none', description: 'Selected preset slot in bank 1 (0 = panel).', manualReference: P.presets },
};

// ----------------------------------------------------------------------------
// Presets (patches in the spirit of classic Sub 37 sounds; programmed here)
// ----------------------------------------------------------------------------

// The host's preset loader leaves toggle buttons untouched (it treats buttons as
// performance actions), so every preset spells out all of its toggle states.
const TOGGLE_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  Object.entries(controls)
    .filter(([id, c]) => c.type === 'button' && id !== 'knob_shift')
    .map(([id, c]) => [id, c.type === 'button' ? c.default : false]),
);

const preset = (slot: number, name: string, description: string, settings: Record<string, number | boolean>): PresetSpec => ({
  name, description, source: 'community', settings: { ...TOGGLE_DEFAULTS, preset_number: slot, ...settings },
});

const presets: Record<string, PresetSpec> = {
  fat_bass: preset(1, 'Fat Bass', 'Two detuned 16\' saws plus the sub, a 24 dB filter and a touch of Multidrive.', {
    osc1_octave: 0, osc2_octave: 0, osc1_wave: 33, osc2_wave: 33, beat_freq: 1.2,
    mix_osc1: 85, mix_osc2: 70, mix_sub: 70, cutoff: 320, resonance: 18, multidrive: 30,
    filter_eg_amt: 45, filter_kb_amt: 40, feg_attack: 2, feg_decay: 380, feg_sustain: 15, feg_release: 200,
    aeg_attack: 2, aeg_decay: 600, aeg_sustain: 90, aeg_release: 120,
  }),
  acid_squelch: preset(2, 'Acid Squelch', 'Resonant saw with a short filter envelope and legato glide – play overlapping notes.', {
    osc1_octave: 0, osc1_wave: 33, mix_osc1: 90, mix_osc2: 0, mix_sub: 25, cutoff: 260, resonance: 78,
    multidrive: 50, filter_eg_amt: 70, filter_kb_amt: 40, feg_attack: 1, feg_decay: 180, feg_sustain: 0, feg_release: 120,
    aeg_attack: 1, aeg_decay: 300, aeg_sustain: 85, aeg_release: 60, glide_on: true, glide_legato: true, glide_time: 70, glide_type: 1,
  }),
  sync_lead: preset(3, 'Sync Lead', 'Hard-synced Osc 2 swept by the Filter EG through Mod 2 – the classic tearing lead. Mod wheel adds vibrato.', {
    hard_sync: true, osc2_octave: 2, osc2_frequency: 5, osc1_wave: 33, osc2_wave: 33, mix_osc1: 25, mix_osc2: 95,
    mod2_source: 5, mod2_pitch_amt: 70, mod2_pitch_dest: 2, mod1_source: 0, mod1_rate: 5.5, mod1_pitch_amt: 14,
    cutoff: 3500, resonance: 15, filter_eg_amt: 25, feg_attack: 2, feg_decay: 900, feg_sustain: 20, feg_release: 400,
    aeg_attack: 3, aeg_decay: 500, aeg_sustain: 90, aeg_release: 250, glide_on: true, glide_time: 60,
  }),
  warm_pad: preset(4, 'Warm Pad', 'Slow envelopes, two beating oscillators and slow pulse-width shimmer from Mod 2.', {
    osc1_wave: 50, osc2_wave: 50, beat_freq: 0.7, osc2_frequency: 0.05, mix_osc1: 75, mix_osc2: 75, mix_sub: 20,
    cutoff: 900, resonance: 25, filter_slope: 1, filter_eg_amt: 30, filter_kb_amt: 50,
    feg_attack: 1400, feg_decay: 2500, feg_sustain: 50, feg_release: 2000,
    aeg_attack: 900, aeg_decay: 1500, aeg_sustain: 90, aeg_release: 1800,
    mod2_source: 0, mod2_rate: 0.3, mod2_pgm_dest: 0, mod2_pgm_amt: 30,
  }),
  pluck: preset(5, 'Pluck', 'Short percussive envelopes and strong keyboard tracking – bright up high, round down low.', {
    osc1_wave: 60, osc2_octave: 2, osc2_wave: 33, mix_osc1: 85, mix_osc2: 40, cutoff: 420, resonance: 35,
    filter_eg_amt: 65, filter_kb_amt: 80, feg_attack: 1, feg_decay: 230, feg_sustain: 0, feg_release: 250,
    aeg_attack: 1, aeg_decay: 450, aeg_sustain: 0, aeg_release: 350, aeg_multi_trig: true, feg_multi_trig: true, kb_reset: true,
  }),
  wobble_bass: preset(6, 'Wobble Bass', 'Mod 2 triangle LFO on the cutoff of a resonant, driven bass.', {
    osc1_octave: 0, osc2_octave: 0, osc1_wave: 33, osc2_wave: 67, mix_osc1: 80, mix_osc2: 50, mix_sub: 80,
    cutoff: 230, resonance: 55, multidrive: 45, filter_eg_amt: 10, filter_kb_amt: 30,
    mod2_source: 0, mod2_rate: 3, mod2_filter_amt: 60, aeg_attack: 2, aeg_sustain: 100, aeg_release: 120,
  }),
  duo_lead: preset(7, 'Duo Lead', 'DUO MODE with glide: hold two keys and each oscillator takes one.', {
    duo_mode: true, osc1_wave: 40, osc2_wave: 40, mix_osc1: 80, mix_osc2: 80, cutoff: 2400, resonance: 20,
    filter_eg_amt: 30, glide_on: true, glide_time: 120, glide_type: 2, aeg_attack: 5, aeg_sustain: 90, aeg_release: 300,
    mod1_source: 0, mod1_rate: 5, mod1_pitch_amt: 12,
  }),
  arp_pulse: preset(8, 'Arp Pulse', 'Arpeggiator on, one octave up – hold a chord.', {
    arp_on: true, arp_rate: 200, arp_range: 3, arp_mode: 0, osc1_wave: 75, mix_osc1: 85, osc2_octave: 2, mix_osc2: 30,
    cutoff: 600, resonance: 40, filter_eg_amt: 55, feg_attack: 1, feg_decay: 160, feg_sustain: 0,
    aeg_attack: 1, aeg_decay: 250, aeg_sustain: 20, aeg_release: 120, feg_multi_trig: true, aeg_multi_trig: true,
  }),
  sh_bleeps: preset(9, 'S&H Bleeps', 'Sample & hold on the cutoff of a resonant filter – random computer chatter.', {
    osc1_wave: 67, mix_osc1: 80, mix_noise: 10, cutoff: 700, resonance: 72, filter_eg_amt: 10,
    mod2_source: 4, mod2_rate: 8, mod2_filter_amt: 55, aeg_sustain: 100,
  }),
  feedback_growl: preset(10, 'Feedback Growl', 'Mixer feedback and heavy Multidrive for an aggressive, distorted bass.', {
    osc1_octave: 0, osc1_wave: 33, mix_osc1: 85, mix_sub: 60, mix_feedback: 70, multidrive: 75,
    cutoff: 650, resonance: 30, filter_eg_amt: 35, feg_decay: 500, feg_sustain: 20, aeg_sustain: 90,
  }),
  looping_filter: preset(11, 'Looping Filter', 'Filter EG LOOP turns the envelope into a rhythmic multi-stage LFO.', {
    osc1_wave: 33, osc2_wave: 33, beat_freq: 0.9, mix_osc1: 80, mix_osc2: 60, cutoff: 300, resonance: 50,
    filter_eg_amt: 60, feg_loop: true, feg_attack: 1, feg_decay: 140, feg_sustain: 0, feg_release: 90,
    aeg_sustain: 100, aeg_release: 300,
  }),
};

export const SUB37: DeviceSpec = {
  id: 'sub37',
  name: 'Sub 37',
  manufacturer: 'Moog',
  year: 2014,
  description: 'Sub 37 Tribute Edition – paraphonic analog synthesizer with two VCOs, sub oscillator, Moog ladder filter with Multidrive, two DAHDSR envelopes and two mod busses.',
  manualUrl: 'https://cdn.inmusicbrands.com/Moog/BackOffice/SUB_37_MANUAL_v1.1_0.pdf',
  // 26.375" W x 14.75" D x 6.75" H, 22 lb (manual p.61 – Specifications)
  dimensions: { width: 670, height: 375, depth: 171 },
  display: { width: 1290, height: 600, scale: 2 },
  signalFlow: [
    { id: 'modulation', name: 'Modulation', order: 1, description: 'Two mod busses: one source each, three simultaneous destinations.', controls: Object.keys(modBus(1)).concat(Object.keys(modBus(2))) },
    { id: 'oscillators', name: 'Oscillators', order: 2, controls: ['osc1_octave', 'osc1_wave', 'osc2_octave', 'osc2_wave', 'osc2_frequency', 'beat_freq', 'hard_sync', 'duo_mode', 'kb_reset', 'osc2_kb_ctrl'] },
    { id: 'mixer', name: 'Mixer', order: 3, controls: ['mix_osc1', 'mix_sub', 'mix_osc2', 'mix_noise', 'mix_feedback'] },
    { id: 'filter', name: 'Filter', order: 4, controls: ['cutoff', 'resonance', 'multidrive', 'filter_kb_amt', 'filter_eg_amt', 'filter_slope'] },
    { id: 'envelopes', name: 'Envelopes', order: 5, controls: Object.keys(controls).filter(k => k.startsWith('feg_') || k.startsWith('aeg_')).concat('knob_shift') },
    { id: 'glide', name: 'Glide', order: 6, controls: ['glide_time', 'glide_on', 'glide_type', 'glide_legato', 'glide_gated', 'glide_osc'] },
    { id: 'arp', name: 'Arpeggiator', order: 7, controls: ['arp_on', 'arp_rate', 'arp_latch', 'arp_mode', 'arp_range', 'arp_back_fwd'] },
    { id: 'output', name: 'Output & Performance', order: 8, controls: ['master_volume', 'pitch_bend', 'mod_wheel', 'preset_number'] },
  ],
  controls,
  presets,
};
