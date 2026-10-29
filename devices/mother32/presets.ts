// ============================================================================
// Mother-32 presets. Named "Category / Name" - the preset menu groups by category.
//
// Sources (see REFERENCE.md "Presets"):
//  - "manual": the Mother-32 manual v2. Its default panel (p.9) is "Init", and its nine patch
//    sheets (pp.64-66) are recreated from the drawings: every knob read from its pointer angle
//    and converted through this twin's knob laws, every switch and cable as drawn, the keyboard
//    octave from the lit OCTAVE / LOCATION LED. The sheets show no pattern, so each one carries a
//    short demo pattern of ours (said so in the description); the names are our own.
//  - "community": Moog's Mother-32 patch-examples chart, the Sweetwater / Moog patch-sheet
//    series (2017), VoltPages' patch ideas and well-known Mother-32 techniques. Our own names;
//    the description credits the original.
// Sequences use MIDI notes (C2 = 36, C3 = 48). Every preset that plays the sequencer sets its
// pattern, clock division, swing and direction; presets that patch ASSIGN or TEMPO set those
// Setup pages. Volumes are set for about -18 LUFS (scripts/audio-qa.cjs).
// ============================================================================

import type { PatchConnection, PresetSpec } from '@/types';
import { DIV_DEFAULT } from './model';
import { sequence, type PatternValues, type StepSpec } from './sequence';

type Values = Record<string, number | boolean | string>;

/** The power-up pattern: a 16-step C minor bass line with an accent, a glide and a ratchet */
export const DEFAULT_SEQUENCE: PatternValues = sequence(defaultSteps());

// ASSIGN sources (model.ts ASSIGN_SOURCES) and TEMPO modes (TEMPO_MODES)
const A = { accent: 0, clock: 1, clock2: 2, clock4: 3, ramp: 4, saw: 5, triangle: 6, random: 7, step1: 8, velocity: 9 } as const;
const T = { cv: 0, advance: 1, analog: 2, address: 3 } as const;

const c = (from: string, to: string): PatchConnection => ({ from, to });

function preset(
  name: string,
  description: string,
  source: PresetSpec['source'],
  settings: Values,
  opts: { cables?: PatchConnection[]; seq?: StepSpec[]; length?: number } = {},
): PresetSpec {
  const pattern = opts.seq ? sequence(opts.seq, { length: opts.length }) : null;
  return {
    name,
    description,
    source,
    settings: {
      ...(pattern ? {
        ...pattern, step_div: DIV_DEFAULT, div_type: 0, swing: 50, swing_div: DIV_DEFAULT, swing_type: 0, seq_direction: 0,
      } : {}),
      ...settings,
    },
    ...(opts.cables ? { patchConnections: opts.cables } : {}),
  };
}

// Notes
const C1 = 24, C2 = 36, D2 = 38, Eb2 = 39, E2 = 40, F2 = 41, G2 = 43, Ab2 = 44, A2 = 45, Bb2 = 46;
const C3 = 48, D3 = 50, Eb3 = 51, F3 = 53, G3 = 55, Ab3 = 56, Bb3 = 58, C4 = 60, D4 = 62, Eb4 = 63, F4 = 65, G4 = 67;
const C5 = 72, C6 = 84, A3 = 57, C7 = 96, G7 = 103;

// The manual's default panel (p.9): basic sawtooth, MIX on VCO, CUTOFF about 11 o'clock, VCF MOD
// at noon from the EG, SUSTAIN ON, DECAY just before noon, LFO RATE at noon, VOLUME at noon
const MANUAL_DEFAULTS: Values = {
  frequency: 0, vco_wave: 1, pulse_width: 50, mix: 0, cutoff: 340, resonance: 5, vca_mode: 1, volume: 50,
  glide: 0, vco_mod_source: 1, vco_mod_amount: 0, vco_mod_dest: 1, vcf_mode: 1, vcf_mod_source: 0, vcf_mod_amount: 50,
  vcf_mod_polarity: 0, lfo_rate: 5.9, lfo_wave: 1, attack: 1.25, sustain: 0, decay: 60, vc_mix: 0, kb_octave: 3,
};

export const MOTHER32_PRESETS: Record<string, PresetSpec> = {
  init: preset('Init / Basic patch',
    'The manual\'s default panel settings (p.9), the starting point of its tutorials: the saw into the low-pass, opened by the envelope on every note, no cables. Plays the power-up pattern.',
    'manual', { ...MANUAL_DEFAULTS, tempo: 120, volume: 45 }, { seq: defaultSteps() }),

  // ---------------------------------------------------------------- Bass
  bass_sequencer: preset('Bass / Pulse sequencer bass',
    'Based on the manual\'s "Sequencer Bass" patch sheet (p.65): a 32 % pulse whose width the EG sweeps, the low-pass at noon tracking the keyboard (KB into VCF CUTOFF), short AD envelope, glide, octave 2. Demo pattern ours.',
    'manual', {
      ...MANUAL_DEFAULTS, vco_wave: 0, pulse_width: 32.4, cutoff: 632, resonance: 20, glide: 180, vco_mod_source: 0, vco_mod_amount: 40,
      vco_mod_dest: 0, vcf_mod_amount: 30, tempo: 175, lfo_rate: 2.1, sustain: 1, decay: 93.5, kb_octave: 1, volume: 74,
    }, {
      cables: [c('out_kb', 'in_vcf_cutoff')],
      seq: [{ note: C1, accent: true }, C1, C2, C1, Eb2 - 12, C1, { note: G2 - 12, glide: true }, Bb2 - 12, { note: C1, accent: true }, C1, C2, { note: F2 - 12, glide: true }, Eb2 - 12, null, G2 - 12, Bb2 - 12],
    }),
  bass_acid: preset('Bass / Acid line',
    'The squelch of acid house: a high-resonance low-pass, a strong envelope sweep and a short decay, with slides (glide + tie) and accents that open the filter further.',
    'community', {
      vco_wave: 1, cutoff: 220, resonance: 74, vcf_mod_amount: 62, attack: 1.25, decay: 190, sustain: 0, glide: 70, tempo: 126, volume: 44,
    }, { seq: [
      { note: C2, accent: true }, C2, { note: C3, gate: 8 }, { note: C3, glide: true }, Eb2, { note: C2, accent: true }, { note: Eb3, gate: 2 }, C2,
      { note: G2, accent: true, gate: 8 }, { note: Bb2, glide: true }, C2, { note: C3, accent: true }, null, { note: F2, gate: 2 }, { note: G2, gate: 8 }, { note: C2, glide: true },
    ] }),
  bass_ratchet_acid: preset('Bass / Ratchet acid',
    'Based on VoltPages\' "ratcheting acid line": eight steps with 4-note ratchets on steps 3 and 7, glide between steps, GLIDE around 9 o\'clock, a short decay and VCF MOD from the EG at 3 o\'clock - a 303-style roll with slides and bursts.',
    'community', {
      vco_wave: 1, cutoff: 260, resonance: 68, vcf_mod_amount: 70, attack: 1.25, decay: 160, sustain: 0, glide: 45, tempo: 124, volume: 52,
    }, { seq: [
      { note: C2, accent: true }, { note: C3, glide: true }, { note: Eb2, ratchet: 4 }, { note: C2, gate: 2 },
      { note: G2, glide: true, accent: true }, { note: F2, glide: true }, { note: C3, ratchet: 4 }, { note: Bb2, gate: 3 },
    ] }),
  bass_sub: preset('Bass / Sub bass',
    'A deep, clean sub: the square wave through a low-pass at about 110 Hz with no resonance leaves little more than the fundamental. Root-and-fifth line two octaves down, long gates.',
    'community', {
      vco_wave: 0, pulse_width: 50, cutoff: 110, resonance: 0, vcf_mod_amount: 20, attack: 4, decay: 300, sustain: 0, tempo: 122, volume: 53,
    }, { seq: [
      { note: C1, gate: 6 }, null, { note: C1, gate: 2 }, null, { note: G2 - 12, gate: 6 }, null, { note: C1, gate: 3 }, { note: Bb2 - 12, gate: 3 },
    ] }),
  bass_rubber: preset('Bass / Rubber bass',
    'The EG also pushes the pitch up a little (VCO MOD = EG to FREQUENCY): every note starts with a bouncy "boing". A bright pulse keeps it funky.',
    'community', {
      vco_wave: 0, pulse_width: 35, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 22, cutoff: 500, resonance: 35, vcf_mod_amount: 45,
      attack: 1.25, decay: 230, sustain: 1, tempo: 108, volume: 72,
    }, { seq: [C2, null, C2, C3, null, Eb2, F2, null, G2, null, Bb2, C3, G2, null, F2, Eb2] }),
  bass_modulated: preset('Bass / Modulated bass',
    'Based on Sweetwater\'s "Modulated Bass" (a Moog chart with Daniel Fisher\'s variation): ASSIGN (step triangle) through VC MIX into VCF CUTOFF, so the filter rises over one pass of the pattern and falls over the next; VC MIX sets how much reaches the filter.',
    'community', {
      vco_wave: 1, cutoff: 180, resonance: 50, vcf_mod_amount: 35, decay: 300, sustain: 0, vc_mix: 15, tempo: 116, volume: 49, assign_source: A.triangle,
    }, {
      cables: [c('out_assign', 'in_mix2'), c('out_vc_mix', 'in_vcf_cutoff')],
      seq: [C2, C2, C3, C2, Eb2, C2, G2, C2, C2, Bb2, C2, C3, F2, Eb2, G2, C2],
    }),
  bass_tracked_fm: preset('Bass / Tracked FM',
    'Based on Moog\'s TRACKED FM patch example: KB into LFO RATE makes the audio-rate LFO follow the keyboard, so the FM keeps the same ratio on every note. LFO RATE sets the ratio, VCO MOD AMOUNT the depth.',
    'community', {
      vco_wave: 1, vco_mod_source: 1, vco_mod_dest: 1, vco_mod_amount: 26, lfo_rate: 262, lfo_wave: 1,
      cutoff: 1400, resonance: 20, vcf_mod_amount: 40, attack: 1.25, decay: 420, sustain: 0, tempo: 110, volume: 50,
    }, { cables: [c('out_kb', 'in_lfo_rate')], seq: [C2, null, C3, C2, Eb2, null, G2, Bb2] }),

  // ---------------------------------------------------------------- Leads and brass
  lead_gate_jump: preset('Lead / Gate pitch jump',
    'Based on the manual\'s "Octave Bounce Back" patch sheet (p.64): GATE into MIX 2 and VC MIX into VCO LIN FM, so every held note jumps up and falls back on release - VC MIX sets the interval. Slow LFO on pulse width and cutoff. Demo pattern ours.',
    'manual', {
      ...MANUAL_DEFAULTS, vco_wave: 0, cutoff: 1288, resonance: 30, vco_mod_amount: 50, vco_mod_dest: 0, vcf_mod_source: 1, vcf_mod_amount: 11,
      tempo: 54.5, lfo_rate: 0.74, attack: 5.93, sustain: 1, decay: 558, vc_mix: 70, volume: 52,
    }, {
      cables: [c('out_vc_mix', 'in_vco_lin_fm'), c('out_gate', 'in_mix2')],
      seq: [{ note: C3, gate: 3 }, { note: G3, gate: 2 }, { note: Eb3, gate: 4 }, { note: C4, gate: 2 }],
    }),
  lead_two_osc: preset('Lead / Two oscillators',
    'Based on Moog\'s 2 OSC SYNTH patch example: the LFO at audio rate becomes a second oscillator. KB into MIX 1 and VC MIX into LFO RATE make it track the keyboard; LFO SQ into EXT. AUDIO lets MIX blend it with the VCO. Tracks best in octaves 2-4.',
    'community', {
      vco_wave: 1, mix: 45, lfo_rate: 130.8, lfo_wave: 0, vc_mix: 0, cutoff: 2600, resonance: 25, vcf_mod_amount: 30,
      attack: 6, decay: 700, sustain: 0, glide: 40, tempo: 112, volume: 54,
    }, {
      cables: [c('out_kb', 'in_mix1'), c('out_vc_mix', 'in_lfo_rate'), c('out_lfo_sq', 'in_ext_audio')],
      seq: [{ note: C3, gate: 6 }, { note: Eb3, gate: 6 }, { note: G3, gate: 8 }, { note: G3, gate: 4 }, { note: F3, gate: 6, glide: true }, { note: Eb3, gate: 6 }, { note: D3, gate: 8 }, { note: D3, gate: 4 }],
    }),
  lead_pwm: preset('Lead / PWM lead',
    'The LFO sweeps the pulse width (VCO MOD: LFO to PULSE WIDTH): the harmonics shift all the time, a chorus-like shimmer from one oscillator. Glide and a gentle filter envelope.',
    'community', {
      vco_wave: 0, pulse_width: 50, vco_mod_source: 1, vco_mod_dest: 0, vco_mod_amount: 62, lfo_rate: 1.2, lfo_wave: 1,
      cutoff: 2200, resonance: 22, vcf_mod_amount: 32, attack: 8, decay: 900, sustain: 0, glide: 90, tempo: 100, volume: 36,
    }, { seq: [{ note: C4, gate: 8 }, { note: C4, gate: 6 }, { note: Eb4, gate: 6, glide: true }, { note: G4, gate: 8 }, { note: G4, gate: 4 }, { note: F4, gate: 6, glide: true }, { note: Eb4, gate: 6 }, { note: D4, gate: 6 }] }),
  lead_vibrato: preset('Lead / Vibrato lead',
    'Vibrato through VCO LIN FM (LFO TRI patched in), which leaves VCO MOD free for an envelope pitch blip on every note. Bright saw, resonant low-pass, glide.',
    'community', {
      vco_wave: 1, lfo_rate: 5.4, lfo_wave: 1, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 8,
      cutoff: 1800, resonance: 40, vcf_mod_amount: 38, attack: 12, decay: 800, sustain: 0, glide: 80, tempo: 96, volume: 51,
    }, {
      cables: [c('out_lfo_tri', 'in_vco_lin_fm')],
      seq: [{ note: G3, gate: 8 }, { note: G3, gate: 6 }, { note: Bb3, gate: 6, glide: true }, { note: C4, gate: 8 }, { note: C4, gate: 6 }, { note: Eb4, gate: 4, glide: true }, { note: D4, gate: 6 }, { note: Bb3, gate: 6 }],
    }),
  lead_play_filter: preset('Lead / Play the filter',
    'The manual\'s sine-source tip (p.14), as in Moog\'s PLAY THE FILTER example: RESONANCE and MIX up, KB into VCF CUTOFF so the self-oscillating ladder tracks 1 V/oct, and a dead cable in EXT. AUDIO (here MULT 1, which carries nothing) to break the noise normal.',
    'manual', {
      vco_wave: 1, mix: 100, cutoff: 261.6, resonance: 100, vcf_mod_amount: 0, attack: 3, decay: 600, sustain: 0, glide: 30, tempo: 100, volume: 34,
    }, {
      cables: [c('out_kb', 'in_vcf_cutoff'), c('out_mult1', 'in_ext_audio')],
      seq: [{ note: C3, gate: 6 }, { note: G3, gate: 6 }, { note: Eb3, gate: 6 }, { note: Bb3, gate: 6 }, { note: C4, gate: 8 }, { note: G3, gate: 6, glide: true }, { note: F3, gate: 6 }, { note: Eb3, gate: 6 }],
    }),
  brass_short: preset('Brass / Saw and pulse stabs',
    'Based on the manual\'s "Short Brass" patch sheet (p.66): VCO SAW into EXT. AUDIO so MIX blends saw and a 26 % pulse whose width the EG sweeps hard, KB into VCF CUTOFF, a short AD envelope and a touch of glide. Demo pattern ours.',
    'manual', {
      ...MANUAL_DEFAULTS, vco_wave: 0, pulse_width: 25.8, mix: 60, cutoff: 324, resonance: 0, glide: 80, vco_mod_source: 0, vco_mod_amount: 80,
      vco_mod_dest: 0, vcf_mod_amount: 50, tempo: 152, lfo_rate: 1.26, attack: 2.72, sustain: 1, decay: 93.5, volume: 93,
    }, {
      cables: [c('out_vco_saw', 'in_ext_audio'), c('out_kb', 'in_vcf_cutoff')],
      seq: [{ note: C3, gate: 3 }, null, null, { note: C3, gate: 2 }, null, { note: Eb3, gate: 3 }, null, null, { note: F3, gate: 3 }, null, { note: G3, gate: 5 }, null, null, null, { note: Eb3, gate: 2 }, null],
    }),

  // ---------------------------------------------------------------- Bells and FM
  bell_vc_mix_fm: preset('Bell / Envelope FM bell',
    'VC MIX as a VCA (manual p.51): the LFO (at audio rate, tracking the keyboard through LFO RATE) goes into MIX 2, the EG into VC MIX CTRL, and VC MIX into VCO LIN FM. The FM depth follows the envelope, so each note starts metallic and settles into a pure tone - a bell.',
    'community', {
      vco_wave: 1, mix: 0, frequency: -0.1, lfo_rate: 344, lfo_wave: 1, vc_mix: 0, cutoff: 6000, resonance: 0, vcf_mod_amount: 20,
      attack: 1.25, decay: 1500, sustain: 1, tempo: 92, volume: 44,
    }, {
      cables: [c('out_lfo_tri', 'in_mix2'), c('out_eg', 'in_vc_mix_ctrl'), c('out_vc_mix', 'in_vco_lin_fm'), c('out_kb', 'in_lfo_rate')],
      seq: [{ note: C4, gate: 2 }, null, { note: G4, gate: 2 }, null, { note: Eb4, gate: 2 }, null, { note: C5, gate: 2 }, null, { note: Bb3, gate: 2 }, null, { note: G4, gate: 2 }, null, { note: F4, gate: 2 }, null, { note: D4, gate: 2 }, null],
    }),
  bell_am: preset('Bell / Ring bell',
    'VC MIX as a ring modulator: the saw goes into MIX 2 and the LFO square, at audio rate, into VC MIX CTRL, so the saw is switched on and off hundreds of times a second. The sidebands are clangorous; VC MIX into EXT. AUDIO brings them into the filter.',
    'community', {
      vco_wave: 1, mix: 100, lfo_rate: 310, lfo_wave: 0, vc_mix: 50, cutoff: 4200, resonance: 30, vcf_mod_amount: 25,
      attack: 1.25, decay: 900, sustain: 1, tempo: 90, volume: 83,
    }, {
      cables: [c('out_vco_saw', 'in_mix2'), c('out_lfo_sq', 'in_vc_mix_ctrl'), c('out_vc_mix', 'in_ext_audio')],
      seq: [{ note: C4, gate: 2 }, null, null, { note: G3, gate: 2 }, null, null, { note: Bb3, gate: 2 }, null],
    }),

  // ---------------------------------------------------------------- Drums
  drum_kick_snare: preset('Drums / Kick and snare',
    'Based on Moog\'s SIMPLEST KICK & SNARE patch example: KB into MULT, MULT 1 into MIX CV and MULT 2 into VCF CUTOFF. Low notes are dark and mostly VCO with a pitch drop (kick); high notes are bright and mostly noise (snare).',
    'community', {
      vco_wave: 1, mix: 35, cutoff: 900, resonance: 20, vcf_mod_amount: 45, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 42,
      attack: 1.25, decay: 230, sustain: 1, frequency: 0, tempo: 104, volume: 89,
    }, {
      cables: [c('out_kb', 'in_mult'), c('out_mult1', 'in_mix_cv'), c('out_mult2', 'in_vcf_cutoff')],
      seq: [C1, null, null, C1, C6, null, null, C1, null, C1, null, null, C6, null, C1, C6],
    }),
  drum_kick_snare_random: preset('Drums / Analog kick and snare',
    'Based on Sweetwater\'s "Analog Kick and Snare" variation: the same KB-to-MULT routing as Moog\'s kick and snare, plus ASSIGN on STEP RANDOM into VCF RES. for a different ring on every hit.',
    'community', {
      vco_wave: 1, mix: 35, cutoff: 900, resonance: 20, vcf_mod_amount: 45, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 40,
      attack: 1.25, decay: 210, sustain: 1, tempo: 98, volume: 83, assign_source: A.random,
    }, {
      cables: [c('out_kb', 'in_mult'), c('out_mult1', 'in_mix_cv'), c('out_mult2', 'in_vcf_cutoff'), c('out_assign', 'in_vcf_res')],
      seq: [C1, null, C1, null, C6, null, null, C1, C1, null, C1, null, C6, null, C6, null],
    }),
  drum_lfo_kick: preset('Drums / LFO kick',
    'Based on the "synthesized kick drum" of Sweetwater\'s patch sheets: the triangle LFO (not normally in the audio path) is patched into EXT. AUDIO, and the EG into LFO RATE pushes its frequency up on every hit, so each one falls back like a kick.',
    'community', {
      mix: 100, lfo_rate: 38, lfo_wave: 1, cutoff: 2200, resonance: 0, vcf_mod_amount: 0, attack: 1.25, decay: 320, sustain: 1, tempo: 120, volume: 68,
    }, { cables: [c('out_lfo_tri', 'in_ext_audio'), c('out_eg', 'in_lfo_rate')], seq: [C2, null, null, null, C2, null, null, null, C2, null, null, null, C2, null, null, { note: C2, accent: true }] }),
  drum_filter_kick: preset('Drums / Feedback filter kick',
    'Based on the manual\'s "Filter Kick" patch sheet (p.66): HI PASS with RESONANCE up and VCF fed back into EXT. AUDIO with MIX fully clockwise - the filter loop rings, KB into VCF CUTOFF tunes it and the EG drops it on every hit. Octave 3. Demo pattern ours.',
    'manual', {
      ...MANUAL_DEFAULTS, vco_wave: 0, pulse_width: 2, mix: 100, cutoff: 79.6, resonance: 100, vcf_mode: 0, tempo: 152, lfo_rate: 0.1,
      sustain: 1, decay: 40.5, kb_octave: 2, volume: 62,
    }, {
      cables: [c('out_vcf', 'in_ext_audio'), c('out_kb', 'in_vcf_cutoff')],
      seq: [C2, null, null, null, C2, null, null, C2, C2, null, null, null, C2, null, null, null],
    }),
  drum_noise_snare: preset('Drums / Noise snare',
    'Based on the manual\'s "Metal Snare" patch sheet (p.64): MIX fully on noise into a dark low-pass that the EG opens and the keyboard tunes (KB into VCF CUTOFF), and the EG patched into VCA CV as well for a harder hit. Octave 6. Demo pattern ours.',
    'manual', {
      ...MANUAL_DEFAULTS, vco_wave: 0, pulse_width: 55.6, mix: 100, cutoff: 159, resonance: 0, vcf_mod_amount: 70, tempo: 20, lfo_rate: 350,
      lfo_wave: 0, sustain: 1, decay: 240, kb_octave: 5, volume: 77,
    }, {
      cables: [c('out_eg', 'in_vca_cv'), c('out_kb', 'in_vcf_cutoff')],
      seq: [null, null, null, null, C5, null, null, { note: C5, ratchet: 2 }, null, null, null, null, C5, null, null, { note: C6, gate: 2 }],
    }),
  drum_80s_toms: preset('Drums / Electronic toms',
    'Based on the manual\'s "\'80s Toms" patch sheet (p.66): a pulse half mixed with noise, the EG sweeping the pitch down hard (VCO MOD: EG to FREQUENCY at 2 o\'clock) and the low-pass fully, KB into VCF CUTOFF, glide between notes. Octave 2. Demo fill ours.',
    'manual', {
      ...MANUAL_DEFAULTS, vco_wave: 0, mix: 50, cutoff: 1236, resonance: 0, glide: 180, vco_mod_source: 0, vco_mod_amount: 80,
      vcf_mod_amount: 100, tempo: 152, lfo_rate: 1.26, sustain: 1, decay: 222, kb_octave: 1, volume: 66,
    }, {
      cables: [c('out_kb', 'in_vcf_cutoff')],
      seq: [C2, null, A2 - 12, null, F2 - 12, F2 - 12, D2 - 12, null, C2, A2 - 12, F2 - 12, D2 - 12, C1, null, null, null],
    }),
  drum_noise_transient: preset('Drums / Noise-attack pluck',
    'Based on the manual\'s "Noise Transient" patch sheet (p.64): the EG into MIX 2 and VC MIX into MIX CV push the mixer to noise at the start of every note, so each short pluck begins with a burst of noise. Slow PWM. Octave 5. Demo pattern ours.',
    'manual', {
      ...MANUAL_DEFAULTS, vco_wave: 0, pulse_width: 38.2, cutoff: 340, resonance: 0, vco_mod_amount: 40, vco_mod_dest: 0,
      vcf_mod_amount: 70, tempo: 77.5, lfo_rate: 0.77, sustain: 1, decay: 43, vc_mix: 70, kb_octave: 4, volume: 77,
    }, {
      cables: [c('out_vc_mix', 'in_mix_cv'), c('out_eg', 'in_mix2')],
      seq: [C4, null, G4, null, Eb4, null, C4, Bb3, null, G3, null, C4, null, Eb4, F4, null],
    }),
  drum_bit_crunch: preset('Drone / Bit-crunch bed',
    'Based on the manual\'s "8-Bit Percussion" patch sheet (p.65): noise into a closed, resonant low-pass whose cutoff the VCO saw modulates at audio rate (VCO SAW into VCF CUTOFF). VCA MODE is ON, so a gritty bed keeps sounding; the EG (also into VCA CV) opens the filter for each crunchy hit. Octave 8. Demo pattern ours.',
    'manual', {
      ...MANUAL_DEFAULTS, vco_wave: 1, pulse_width: 62.6, mix: 100, cutoff: 20, resonance: 30, vca_mode: 0, vco_mod_dest: 1,
      vcf_mod_amount: 94, tempo: 155, lfo_rate: 0.76, sustain: 1, decay: 558, kb_octave: 7, volume: 52,
    }, {
      cables: [c('out_eg', 'in_vca_cv'), c('out_vco_saw', 'in_vcf_cutoff')],
      seq: [C7, null, { note: C6, ratchet: 2 }, null, C7, C6, null, { note: G7, ratchet: 3 }, C7, null, C6, null, { note: C7, ratchet: 4 }, null, C6, G7],
    }),
  drum_ping: preset('Drums / Ping filter',
    'Based on VoltPages\' "ping-filter drum": VCA MODE EG, resonance at about 3 o\'clock and a short decay, with ASSIGN (CLOCK) patched into GATE so the envelope pings the filter on every step; KB into VCF CUTOFF tunes each ping from the pattern.',
    'community', {
      mix: 0, vco_wave: 1, cutoff: 180, resonance: 82, vcf_mod_amount: 55, vcf_mod_source: 0, attack: 1.25, decay: 120, sustain: 1,
      tempo: 116, volume: 73, assign_source: A.clock,
    }, {
      cables: [c('out_assign', 'in_gate'), c('out_kb', 'in_vcf_cutoff'), c('out_mult1', 'in_ext_audio')],
      seq: [C2, C3, G2, C3, Eb3, C3, G2, Bb2, C2, C3, G2, C3, F3, Eb3, D3, Bb2],
    }),
  drum_and_bass: preset('Drums / Drums and bass',
    'Based on Moog\'s EVERYTHING! patch example: a drum-and-bass patch. The audio-rate LFO, kicked up by the EG, is the bass drum and noise the snare; KB sets VC MIX between them; ASSIGN on ACCENT switches MIX from the VCO melody to the drums on accented steps.',
    'community', {
      vco_wave: 1, mix: 0, lfo_rate: 42, lfo_wave: 1, vc_mix: 0, cutoff: 1500, resonance: 30, vcf_mod_amount: 40,
      attack: 1.25, decay: 220, sustain: 1, tempo: 112, volume: 75, assign_source: A.accent,
    }, {
      cables: [c('out_lfo_tri', 'in_mix1'), c('out_noise', 'in_mix2'), c('out_kb', 'in_vc_mix_ctrl'), c('out_vc_mix', 'in_ext_audio'), c('out_assign', 'in_mix_cv'), c('out_eg', 'in_lfo_rate')],
      seq: [
        { note: C1, accent: true }, C3, Eb3, C3, { note: C6, accent: true }, G3, C3, { note: C1, accent: true },
        { note: C1, accent: true }, Bb2, C3, Eb3, { note: C6, accent: true }, G3, F3, Eb3,
      ],
    }),

  // ---------------------------------------------------------------- Sequences and rhythm
  seq_octave_bounce: preset('Sequence / Octave bounce',
    'The LFO square into VCO MOD (FREQUENCY) at exactly one octave, so held notes bounce between two octaves; with GLIDE the jump bends.',
    'community', {
      vco_wave: 1, vco_mod_source: 1, vco_mod_dest: 1, vco_mod_amount: 44.7, lfo_wave: 0, lfo_rate: 4, glide: 25,
      cutoff: 1500, resonance: 35, vcf_mod_amount: 30, attack: 2, decay: 600, sustain: 0, tempo: 120, volume: 50,
    }, { seq: [{ note: C3, gate: 8 }, { note: C3, gate: 7 }, { note: Eb3, gate: 8 }, { note: Eb3, gate: 7 }, { note: G2, gate: 8 }, { note: G2, gate: 7 }, { note: Bb2, gate: 8 }, { note: Bb2, gate: 7 }] }),
  seq_sequenced_filter: preset('Sequence / Clocked filter',
    'Based on Sweetwater\'s "Sequenced Filter" (a Moog chart): ASSIGN on CLOCK into VCF CUTOFF opens the filter for the first half of every step, a rhythmic chop on top of the envelope.',
    'community', {
      vco_wave: 1, cutoff: 260, resonance: 55, vcf_mod_amount: 30, decay: 500, sustain: 0, tempo: 120, volume: 51, assign_source: A.clock,
    }, { cables: [c('out_assign', 'in_vcf_cutoff')], seq: [{ note: C2, gate: 8 }, { note: C2, gate: 8 }, { note: Eb2, gate: 8 }, { note: C2, gate: 8 }, { note: G2, gate: 8 }, { note: F2, gate: 8 }, { note: Eb2, gate: 8 }, { note: Bb2 - 12, gate: 8 }] }),
  seq_random_filter: preset('Sequence / Random filter',
    'Daniel Fisher\'s variation of the sequenced filter: ASSIGN on STEP RANDOM (-5 to +5 V) into VCF CUTOFF - a new filter setting on every step.',
    'community', {
      vco_wave: 1, cutoff: 500, resonance: 60, vcf_mod_amount: 35, decay: 280, sustain: 1, tempo: 124, volume: 80, assign_source: A.random,
    }, { cables: [c('out_assign', 'in_vcf_cutoff')], seq: [C2, C2, C3, C2, C2, Eb3, C2, Bb2, C2, C2, C3, C2, G2, C2, F2, Eb2] }),
  seq_accented_filter: preset('Sequence / Accented filter',
    'Based on Sweetwater\'s "Accented Filter": ASSIGN on ACCENT into VCF CUTOFF, so accented steps open the filter much further than the built-in accent does.',
    'community', {
      vco_wave: 1, cutoff: 200, resonance: 58, vcf_mod_amount: 42, decay: 230, sustain: 1, tempo: 122, volume: 75, assign_source: A.accent,
    }, {
      cables: [c('out_assign', 'in_vcf_cutoff')],
      seq: [{ note: C2, accent: true }, C2, C3, C2, { note: Eb2, accent: true }, C2, G2, C2, { note: C2, accent: true }, Bb2, C2, C3, { note: F2, accent: true }, Eb2, G2, { note: C2, accent: true }],
    }),
  seq_chugging: preset('Sequence / Chugging along',
    'Based on Sweetwater\'s "Chugging Along": ASSIGN on STEP TRIANGLE into VCF CUTOFF sweeps the filter up over one pass of a chugging 16th-note riff and down over the next, while the LFO gently moves the pulse width.',
    'community', {
      vco_wave: 0, pulse_width: 42, vco_mod_source: 1, vco_mod_dest: 0, vco_mod_amount: 22, lfo_rate: 0.7, lfo_wave: 1,
      cutoff: 400, resonance: 40, vcf_mod_amount: 30, decay: 160, sustain: 0, tempo: 132, volume: 44, assign_source: A.triangle,
    }, {
      cables: [c('out_assign', 'in_vcf_cutoff')],
      seq: [E2, E2, E2, E2, E2, E2, G2, E2, E2, E2, E2, E2, A2, E2, G2, E2].map(n => ({ note: n, gate: 3 })),
    }),
  seq_gallop: preset('Sequence / Gallop',
    'Based on Sweetwater\'s "Gallop": ASSIGN on CLOCK / 2 sends a pulse on every second step; through VC MIX into VCA CV it lifts alternate steps, and ratchets add the galloping triplets. Turn VC MIX for other rhythms.',
    'community', {
      vco_wave: 1, cutoff: 600, resonance: 30, vcf_mod_amount: 40, decay: 200, sustain: 1, vc_mix: 30, tempo: 112, volume: 75, assign_source: A.clock2,
    }, {
      cables: [c('out_assign', 'in_mix2'), c('out_vc_mix', 'in_vca_cv')],
      seq: [{ note: A2, ratchet: 3 }, A2, { note: A2, ratchet: 3 }, A2, { note: C3, ratchet: 3 }, C3, { note: G2, ratchet: 3 }, G2],
    }),
  seq_randomnation: preset('Sequence / Randomnation',
    'Based on Sweetwater\'s "Randomnation": ASSIGN on STEP RANDOM, split by the MULT, moves the filter and - through VC MIX into the TEMPO jack (set to CV INPUT) - the tempo itself, while the playback order is RANDOM. Every pass is different.',
    'community', {
      vco_wave: 0, pulse_width: 30, cutoff: 400, resonance: 50, vcf_mod_amount: 40, decay: 250, sustain: 1, vc_mix: 22, tempo: 110, volume: 69,
      assign_source: A.random, tempo_mode: T.cv, seq_direction: 3,
    }, {
      cables: [c('out_assign', 'in_mult'), c('out_mult1', 'in_vcf_cutoff'), c('out_mult2', 'in_mix2'), c('out_vc_mix', 'in_tempo')],
      seq: [C3, G2, Eb3, C3, Bb2, C3, F3, G2],
    }),
  seq_random_krell: preset('Sequence / Random melody',
    'Based on VoltPages\' "random Krell with VC MIX": NOISE into MIX 1, KB into MIX 2, the EG into VC MIX CTRL and VC MIX into VCO 1V/OCT. The envelope crossfades every note between the sequence and a noisy, random pitch - generative and never quite the same.',
    'community', {
      vco_wave: 1, vc_mix: 0, cutoff: 900, resonance: 45, vcf_mod_amount: 40, attack: 1.25, decay: 260, sustain: 1, tempo: 96, volume: 80,
    }, {
      cables: [c('out_noise', 'in_mix1'), c('out_kb', 'in_mix2'), c('out_eg', 'in_vc_mix_ctrl'), c('out_vc_mix', 'in_vco_1voct')],
      seq: [C2, Eb2, G2, Bb2, C3, G2, F2, Eb2],
    }),
  seq_step_scanner: preset('Sequence / Step scanner',
    'The TEMPO jack set to STEP ADDRESS CV (manual p.55), with the slow LFO triangle patched in, picks the step by voltage - the pattern is scanned up and down instead of clocked. Based on VoltPages\' "step-address scanner".',
    'community', {
      vco_wave: 1, lfo_rate: 0.35, lfo_wave: 1, cutoff: 1000, resonance: 40, vcf_mod_amount: 35, decay: 300, sustain: 1, tempo: 120, volume: 81, tempo_mode: T.address,
    }, { cables: [c('out_lfo_tri', 'in_tempo')], seq: [C3, D3, Eb3, F3, G3, Ab3, Bb3, C4] }),
  seq_pendulum: preset('Sequence / Pendulum arpeggio',
    'An arpeggio played in PENDULUM order (KB + STEP + step 3, manual p.40): up the chord and back down, with a gentle swing on the 16ths and an echo-like glide.',
    'community', {
      vco_wave: 1, cutoff: 900, resonance: 45, vcf_mod_amount: 45, attack: 1.25, decay: 300, sustain: 1, glide: 30, tempo: 118, volume: 76,
      seq_direction: 2, swing: 58,
    }, { seq: [C3, Eb3, G3, Bb3, C4, { note: Eb4, glide: true }, G4, { note: Bb3, accent: true }] }),
  seq_swing_house: preset('Sequence / Swing house',
    'A deep-house bass with SWING AMOUNT at 62 % (SHIFT + TEMPO): every second 16th is late, the shuffle of house music. Short gates and an organ-like filter.',
    'community', {
      vco_wave: 0, pulse_width: 38, cutoff: 420, resonance: 30, vcf_mod_amount: 35, decay: 180, sustain: 0, tempo: 122, volume: 46, swing: 62,
    }, { seq: [{ note: C2, gate: 3 }, null, { note: C3, gate: 2 }, { note: C2, gate: 2 }, null, { note: Eb2, gate: 3 }, null, { note: G2, gate: 2 }, { note: C2, gate: 3 }, null, { note: Bb2, gate: 2 }, { note: C2, gate: 2 }, null, { note: F2, gate: 3 }, { note: G2, gate: 2 }, null] }),
  seq_triplet_swing: preset('Sequence / Triplet swing interval',
    'Eighth-note steps swung over an eighth-note triplet interval (manual p.20): the steps drift against the beat in a lopsided, rolling groove. Clock division 1/8, swing interval 1/8T, SWING AMOUNT 66 %.',
    'community', {
      vco_wave: 0, pulse_width: 44, cutoff: 520, resonance: 38, vcf_mod_amount: 42, decay: 220, sustain: 1, tempo: 104, volume: 70,
      step_div: 4, div_type: 0, swing: 66, swing_div: 4, swing_type: 2,
    }, { seq: [C2, { note: C3, accent: true }, Eb2, G2, C2, Bb2, { note: C3, accent: true }, G2] }),

  // ---------------------------------------------------------------- Pads, drones and FX
  pad_slow: preset('Pad / Slow PWM pad',
    'A slow pad from one voice: long attack and decay with SUSTAIN ON, the LFO sweeping the pulse width and the triangle (patched into VCF CUTOFF) slowly moving the filter. Tied notes at 1/4 steps.',
    'community', {
      vco_wave: 0, pulse_width: 46, vco_mod_source: 1, vco_mod_dest: 0, vco_mod_amount: 55, lfo_rate: 0.35, lfo_wave: 1,
      cutoff: 900, resonance: 18, vcf_mod_amount: 22, attack: 1400, decay: 1100, sustain: 0, tempo: 90, volume: 41, step_div: 3, swing_div: 3,
    }, {
      cables: [c('out_lfo_tri', 'in_vcf_cutoff')],
      seq: [{ note: C3, gate: 8 }, { note: C3, gate: 8 }, { note: C3, gate: 8 }, { note: C3, gate: 6 }, { note: Ab2, gate: 8 }, { note: Ab2, gate: 8 }, { note: Bb2, gate: 8 }, { note: Bb2, gate: 6 }],
    }),
  drone_wind: preset('Drone / Wind',
    'VCA MODE ON makes it a drone that needs no gate: noise through a resonant low-pass, with the slow LFO sweeping it through VCF MOD - wind and surf.',
    'community', {
      mix: 100, cutoff: 700, resonance: 82, vcf_mod_source: 1, vcf_mod_amount: 55, lfo_rate: 0.12, lfo_wave: 1, vca_mode: 0, volume: 39,
    }),
  drone_beating: preset('Drone / Filter and VCO',
    'Two voices, no gate: VCA ON, the VCO saw plus the self-oscillating filter tuned a fifth above it. The two drift against each other like two analog oscillators; turn CUTOFF to retune the filter voice.',
    'community', {
      vco_wave: 1, mix: 0, frequency: -1, cutoff: 196.5, resonance: 88, vcf_mod_amount: 0, vca_mode: 0, volume: 30,
    }),
  hp_resonant: preset('FX / High-pass feedback',
    'Based on the manual\'s "Resonant High Pass Filter" patch sheet (p.65), the manual\'s own trick (p.14): in HI PASS the filter does not resonate, so VCF goes back into EXT. AUDIO and MIX becomes the resonance (RESONANCE fully counter-clockwise); the slow LFO sweeps it. Octave 3. Demo pattern ours.',
    'manual', {
      ...MANUAL_DEFAULTS, vco_wave: 0, mix: 50, cutoff: 356, resonance: 0, vco_mod_dest: 1, vcf_mode: 0, vcf_mod_source: 1, vcf_mod_amount: 50,
      tempo: 118, lfo_rate: 0.76, sustain: 0, decay: 240, kb_octave: 2, volume: 33,
    }, { cables: [c('out_vcf', 'in_ext_audio')], seq: [{ note: C2, gate: 6 }, null, { note: C2, gate: 3 }, { note: Eb2, gate: 6 }, null, { note: G2, gate: 6 }, null, { note: Bb2 - 12, gate: 3 }] }),
  fx_laser: preset('FX / Laser zap',
    'VCO MOD: EG to FREQUENCY near the top, with a medium decay: every note dives from very high - pew. Pure arcade.',
    'community', {
      vco_wave: 0, pulse_width: 30, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 85, cutoff: 6000, resonance: 30, vcf_mod_amount: 20,
      attack: 1.25, decay: 300, sustain: 1, tempo: 120, volume: 58,
    }, { seq: [C3, null, null, G3, null, null, C3, null, Eb3, null, null, C4, null, G3, null, null] }),
};

/** The power-up pattern as step specs (Init plays it too) */
function defaultSteps(): StepSpec[] {
  return [
    { note: 36, accent: true }, 36, 48, 36, null, 39, { note: 36, gate: 2 }, { note: 43, glide: true },
    { note: 36, accent: true }, 36, 46, 36, { note: 41, ratchet: 2 }, null, 43, 39,
  ];
}
