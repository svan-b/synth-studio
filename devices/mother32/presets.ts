// ============================================================================
// Mother-32 presets. Named "Category / Name" - the preset menu groups by category.
//
// Sources (see REFERENCE.md):
//  - "manual": the manual's Presets section / Moog "Patch Examples" chart (INIT, 2 OSC SYNTH,
//    TRACKED FM, PLAY THE FILTER, SIMPLEST KICK & SNARE, EVERYTHING!), whose notes and cable lists
//    are public; and the nine patch sheets of the v2 manual (pp.64-66), of which only the titles
//    could be read. Knob positions are drawings we could not read, so every one is a recreation.
//  - "community": the Sweetwater / Moog patch-sheet series (Daniel Fisher, 2017), VoltPages'
//    patch ideas and well-known Mother-32 techniques. Our own names; the description credits
//    the original.
// Sequences use MIDI notes (C2 = 36, C3 = 48). Every preset that plays the sequencer sets its
// pattern, step division and swing; presets that patch ASSIGN or TEMPO set those Setup pages.
// ============================================================================

import type { PatchConnection, PresetSpec } from '@/types';
import { DIV_DEFAULT } from './model';
import { sequence, type PatternValues, type StepSpec } from './sequence';

type Values = Record<string, number | boolean | string>;

/** The power-up pattern: a 16-step C minor bass line with an accent, a glide and a ratchet */
export const DEFAULT_SEQUENCE: PatternValues = sequence([
  { note: 36, accent: true }, 36, 48, 36, null, 39, { note: 36, gate: 2 }, { note: 43, glide: true },
  { note: 36, accent: true }, 36, 46, 36, { note: 41, ratchet: 2 }, null, 43, 39,
]);

// ASSIGN sources (model.ts ASSIGN_SOURCES) and TEMPO modes (TEMPO_MODES)
const A = { accent: 0, clock: 1, clock2: 2, clock4: 3, ramp: 4, saw: 5, triangle: 6, random: 7, step1: 8, velocity: 9 } as const;
const T = { cv: 0, advance: 1, ppqn: 2, address: 3 } as const;

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
      ...(pattern ? { ...pattern, step_div: DIV_DEFAULT, swing: 50 } : {}),
      ...settings,
    },
    ...(opts.cables ? { patchConnections: opts.cables } : {}),
  };
}

// Notes
const C1 = 24, C2 = 36, D2 = 38, Eb2 = 39, E2 = 40, F2 = 41, G2 = 43, Ab2 = 44, A2 = 45, Bb2 = 46;
const C3 = 48, D3 = 50, Eb3 = 51, F3 = 53, G3 = 55, Ab3 = 56, Bb3 = 58, C4 = 60, D4 = 62, Eb4 = 63, F4 = 65, G4 = 67;
const C5 = 72, C6 = 84, A3 = 57;

export const MOTHER32_PRESETS: Record<string, PresetSpec> = {
  init: preset('Init / Basic patch',
    'Recreation of the manual\'s INIT preset: the basic normalled single-oscillator patch, a starting point that gets the Mother-32 back to a known state. Saw into a gently resonant low-pass opened by the envelope; no cables.',
    'manual', {
      vco_wave: 1, mix: 0, cutoff: 1200, resonance: 15, vcf_mode: 1, vcf_mod_source: 0, vcf_mod_amount: 40, vcf_mod_polarity: 0,
      attack: 2, decay: 400, sustain: 0, vca_mode: 1, glide: 0, vco_mod_amount: 0, tempo: 120, volume: 70,
    }, { seq: DEFAULT_SEQ_STEPS() }),

  // ---------------------------------------------------------------- Bass
  bass_sequencer: preset('Bass / Sequencer bass',
    'Recreation of "SEQUENCER BASS" from the manual\'s patch sheets: a round saw bass through a resonant low-pass with a short envelope sweep, gate lengths and a glide in the pattern. SUSTAIN ON so the gate lengths are heard.',
    'manual', {
      vco_wave: 1, cutoff: 320, resonance: 42, vcf_mod_amount: 55, attack: 1.25, decay: 260, sustain: 0, glide: 60, tempo: 118, volume: 74,
    }, { seq: [
      { note: C2, gate: 3, accent: true }, { note: C2, gate: 2 }, { note: C3, gate: 3 }, { note: C2, gate: 2 },
      { note: Eb2, gate: 5 }, { note: G2, gate: 3, glide: true }, { note: C2, gate: 2 }, { note: Bb2, gate: 3 },
      { note: C2, gate: 3, accent: true }, { note: C2, gate: 2 }, { note: C3, gate: 3 }, { note: F2, gate: 3, glide: true },
      { note: Eb2, gate: 4 }, null, { note: G2, gate: 3 }, { note: Bb2, gate: 2 },
    ] }),
  bass_acid: preset('Bass / Acid line',
    'The squelch of acid house: a high-resonance low-pass, a strong envelope sweep and a short decay, with slides (glide + tie) and accents that open the filter further.',
    'community', {
      vco_wave: 1, cutoff: 220, resonance: 74, vcf_mod_amount: 62, attack: 1.25, decay: 190, sustain: 0, glide: 70, tempo: 126, volume: 70,
    }, { seq: [
      { note: C2, accent: true }, C2, { note: C3, gate: 8 }, { note: C3, glide: true }, Eb2, { note: C2, accent: true }, { note: Eb3, gate: 2 }, C2,
      { note: G2, accent: true, gate: 8 }, { note: Bb2, glide: true }, C2, { note: C3, accent: true }, null, { note: F2, gate: 2 }, { note: G2, gate: 8 }, { note: C2, glide: true },
    ] }),
  bass_ratchet_acid: preset('Bass / Ratchet acid',
    'Recreation of VoltPages\' "ratcheting acid line": eight steps with 4-note ratchets on steps 3 and 7, glide between steps, GLIDE around 9 o\'clock, a short decay and VCF MOD from the EG at 3 o\'clock - a 303-style roll with slides and bursts.',
    'community', {
      vco_wave: 1, cutoff: 260, resonance: 68, vcf_mod_amount: 70, attack: 1.25, decay: 160, sustain: 0, glide: 45, tempo: 124, volume: 70,
    }, { seq: [
      { note: C2, accent: true }, { note: C3, glide: true }, { note: Eb2, ratchet: 4 }, { note: C2, gate: 2 },
      { note: G2, glide: true, accent: true }, { note: F2, glide: true }, { note: C3, ratchet: 4 }, { note: Bb2, gate: 3 },
    ] }),
  bass_sub: preset('Bass / Sub bass',
    'A deep, clean sub: the square wave through a low-pass at about 110 Hz with no resonance leaves little more than the fundamental. Root-and-fifth line two octaves down, long gates.',
    'community', {
      vco_wave: 0, pulse_width: 50, cutoff: 110, resonance: 0, vcf_mod_amount: 20, attack: 4, decay: 300, sustain: 0, tempo: 122, volume: 85,
    }, { seq: [
      { note: C1, gate: 6 }, null, { note: C1, gate: 2 }, null, { note: G2 - 12, gate: 6 }, null, { note: C1, gate: 3 }, { note: Bb2 - 12, gate: 3 },
    ] }),
  bass_rubber: preset('Bass / Rubber bass',
    'The EG also pushes the pitch up a little (VCO MOD = EG to FREQUENCY): every note starts with a bouncy "boing". A bright pulse with moving width keeps it funky.',
    'community', {
      vco_wave: 0, pulse_width: 35, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 22, cutoff: 500, resonance: 35, vcf_mod_amount: 45,
      attack: 1.25, decay: 230, sustain: 1, tempo: 108, volume: 76,
    }, { seq: [C2, null, C2, C3, null, Eb2, F2, null, G2, null, Bb2, C3, G2, null, F2, Eb2] }),
  bass_modulated: preset('Bass / Modulated bass',
    'Recreation of Sweetwater\'s "Modulated Bass" (a Moog chart with Daniel Fisher\'s variation): ASSIGN (step triangle) through VC MIX into VCF CUTOFF, so the filter rises and falls across the pattern; the VC MIX knob sets how much of the ASSIGN CV reaches the filter.',
    'community', {
      vco_wave: 1, cutoff: 180, resonance: 50, vcf_mod_amount: 35, decay: 300, sustain: 0, vc_mix: 15, tempo: 116, volume: 72, assign_source: A.triangle,
    }, {
      cables: [c('out_assign', 'in_mix1'), c('out_vc_mix', 'in_vcf_cutoff')],
      seq: [C2, C2, C3, C2, Eb2, C2, G2, C2, C2, Bb2, C2, C3, F2, Eb2, G2, C2],
    }),
  bass_tracked_fm: preset('Bass / Tracked FM',
    'Recreation of the manual\'s TRACKED FM: KB into LFO RATE makes the audio-rate LFO follow the keyboard, so the FM keeps the same ratio on every note. LFO RATE sets the ratio, VCO MOD AMOUNT the depth.',
    'manual', {
      vco_wave: 1, vco_mod_source: 1, vco_mod_dest: 1, vco_mod_amount: 26, lfo_rate: 262, lfo_wave: 1,
      cutoff: 1400, resonance: 20, vcf_mod_amount: 40, attack: 1.25, decay: 420, sustain: 0, tempo: 110, volume: 68,
    }, { cables: [c('out_kb', 'in_lfo_rate')], seq: [C2, null, C3, C2, Eb2, null, G2, Bb2] }),

  // ---------------------------------------------------------------- Leads
  lead_two_osc: preset('Lead / Two oscillators',
    'Recreation of the manual\'s 2 OSC SYNTH: the LFO at audio rate becomes a second oscillator. KB into MIX 1 and VC MIX into LFO RATE make it track the keyboard; LFO SQ into EXT. AUDIO lets MIX blend it with the VCO. Tracks best in octaves 2-4.',
    'manual', {
      vco_wave: 1, mix: 45, lfo_rate: 130.8, lfo_wave: 0, vc_mix: 0, cutoff: 2600, resonance: 25, vcf_mod_amount: 30,
      attack: 6, decay: 700, sustain: 0, glide: 40, tempo: 112, volume: 66,
    }, {
      cables: [c('out_kb', 'in_mix1'), c('out_vc_mix', 'in_lfo_rate'), c('out_lfo_sq', 'in_ext_audio')],
      seq: [{ note: C3, gate: 6 }, { note: Eb3, gate: 6 }, { note: G3, gate: 8 }, { note: G3, gate: 4 }, { note: F3, gate: 6, glide: true }, { note: Eb3, gate: 6 }, { note: D3, gate: 8 }, { note: D3, gate: 4 }],
    }),
  lead_pwm: preset('Lead / PWM lead',
    'The LFO sweeps the pulse width (VCO MOD: LFO to PW): the harmonics shift all the time, a chorus-like shimmer from one oscillator. Glide and a gentle filter envelope.',
    'community', {
      vco_wave: 0, pulse_width: 50, vco_mod_source: 1, vco_mod_dest: 0, vco_mod_amount: 62, lfo_rate: 1.2, lfo_wave: 1,
      cutoff: 2200, resonance: 22, vcf_mod_amount: 32, attack: 8, decay: 900, sustain: 0, glide: 90, tempo: 100, volume: 66,
    }, { seq: [{ note: C4, gate: 8 }, { note: C4, gate: 6 }, { note: Eb4, gate: 6, glide: true }, { note: G4, gate: 8 }, { note: G4, gate: 4 }, { note: F4, gate: 6, glide: true }, { note: Eb4, gate: 6 }, { note: D4, gate: 6 }] }),
  lead_vibrato: preset('Lead / Vibrato lead',
    'Vibrato through VCO LIN FM (LFO TRI patched in), which leaves VCO MOD free for an envelope pitch blip on every note. Bright saw, resonant low-pass, glide.',
    'community', {
      vco_wave: 1, lfo_rate: 5.4, lfo_wave: 1, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 8,
      cutoff: 1800, resonance: 40, vcf_mod_amount: 38, attack: 12, decay: 800, sustain: 0, glide: 80, tempo: 96, volume: 64,
    }, {
      cables: [c('out_lfo_tri', 'in_vco_lin_fm')],
      seq: [{ note: G3, gate: 8 }, { note: G3, gate: 6 }, { note: Bb3, gate: 6, glide: true }, { note: C4, gate: 8 }, { note: C4, gate: 6 }, { note: Eb4, gate: 4, glide: true }, { note: D4, gate: 6 }, { note: Bb3, gate: 6 }],
    }),
  lead_play_filter: preset('Lead / Play the filter',
    'Recreation of the manual\'s PLAY THE FILTER: the self-oscillating ladder is the oscillator. KB into VCF CUTOFF tunes it 1 V/oct; CUTOFF tunes the filter voice and MIX blends it with the VCO. MULT 1 into EXT. AUDIO stands in for the manual\'s dummy plug: it breaks the noise normal.',
    'manual', {
      vco_wave: 1, mix: 85, cutoff: 261.6, resonance: 92, vcf_mod_amount: 0, attack: 3, decay: 600, sustain: 0, glide: 30, tempo: 100, volume: 60,
    }, {
      cables: [c('out_kb', 'in_vcf_cutoff'), c('out_mult1', 'in_ext_audio')],
      seq: [{ note: C3, gate: 6 }, { note: G3, gate: 6 }, { note: Eb3, gate: 6 }, { note: Bb3, gate: 6 }, { note: C4, gate: 8 }, { note: G3, gate: 6, glide: true }, { note: F3, gate: 6 }, { note: Eb3, gate: 6 }],
    }),
  brass_short: preset('Brass / Short brass',
    'Recreation of "SHORT BRASS" from the manual\'s patch sheets: a saw through a low-pass that the envelope opens with a slight attack - the "blat" of a brass section - on short stabs.',
    'manual', {
      vco_wave: 1, cutoff: 380, resonance: 18, vcf_mod_amount: 62, attack: 28, decay: 260, sustain: 0, tempo: 112, volume: 66,
    }, { seq: [{ note: C3, gate: 3 }, null, null, { note: C3, gate: 2 }, null, { note: Eb3, gate: 3 }, null, null, { note: F3, gate: 3 }, null, { note: G3, gate: 5 }, null, null, null, { note: Eb3, gate: 2 }, null] }),

  // ---------------------------------------------------------------- Bells and FM
  bell_vc_mix_fm: preset('Bell / Envelope FM bell',
    'VC MIX as a VCA: the LFO (at audio rate, tracking the keyboard through LFO RATE) goes into MIX 2, the EG into VC MIX CTRL, and VC MIX into VCO LIN FM. The FM depth follows the envelope, so each note starts metallic and settles into a pure tone - a bell.',
    'community', {
      vco_wave: 1, mix: 0, frequency: -0.1, lfo_rate: 344, lfo_wave: 1, vc_mix: 0, cutoff: 6000, resonance: 0, vcf_mod_amount: 20,
      attack: 1.25, decay: 1500, sustain: 1, tempo: 92, volume: 62,
    }, {
      cables: [c('out_lfo_tri', 'in_mix2'), c('out_eg', 'in_vc_mix_ctrl'), c('out_vc_mix', 'in_vco_lin_fm'), c('out_kb', 'in_lfo_rate')],
      seq: [{ note: C4, gate: 2 }, null, { note: G4, gate: 2 }, null, { note: Eb4, gate: 2 }, null, { note: C5, gate: 2 }, null, { note: Bb3, gate: 2 }, null, { note: G4, gate: 2 }, null, { note: F4, gate: 2 }, null, { note: D4, gate: 2 }, null],
    }),
  bell_am: preset('Bell / Ring bell',
    'VC MIX as a ring modulator: the saw goes into MIX 2 and the LFO square, at audio rate, into VC MIX CTRL, so the saw is switched on and off hundreds of times a second. The sidebands are clangorous; VC MIX EXT. AUDIO brings them into the filter.',
    'community', {
      vco_wave: 1, mix: 100, lfo_rate: 310, lfo_wave: 0, vc_mix: 50, cutoff: 4200, resonance: 30, vcf_mod_amount: 25,
      attack: 1.25, decay: 900, sustain: 1, tempo: 90, volume: 66,
    }, {
      cables: [c('out_vco_saw', 'in_mix2'), c('out_lfo_sq', 'in_vc_mix_ctrl'), c('out_vc_mix', 'in_ext_audio')],
      seq: [{ note: C4, gate: 2 }, null, null, { note: G3, gate: 2 }, null, null, { note: Bb3, gate: 2 }, null],
    }),

  // ---------------------------------------------------------------- Drums
  drum_kick_snare: preset('Drums / Kick and snare',
    'Recreation of the manual\'s SIMPLEST KICK & SNARE: KB into MULT, MULT 1 into MIX CV and MULT 2 into VCF CUTOFF. Low notes are dark and mostly VCO with a pitch drop (kick); high notes are bright and mostly noise (snare).',
    'manual', {
      vco_wave: 1, mix: 35, cutoff: 900, resonance: 20, vcf_mod_amount: 45, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 42,
      attack: 1.25, decay: 230, sustain: 1, frequency: 0, tempo: 104, volume: 82,
    }, {
      cables: [c('out_kb', 'in_mult'), c('out_mult1', 'in_mix_cv'), c('out_mult2', 'in_vcf_cutoff')],
      seq: [C1, null, null, C1, C6, null, null, C1, null, C1, null, null, C6, null, C1, C6],
    }),
  drum_kick_snare_random: preset('Drums / Analog kick and snare',
    'Recreation of Sweetwater\'s "Analog Kick and Snare" variation: the same KB-to-MULT routing as the manual\'s kick and snare, plus ASSIGN on STEP RANDOM into VCF RES. for a different ring on every hit.',
    'community', {
      vco_wave: 1, mix: 35, cutoff: 900, resonance: 20, vcf_mod_amount: 45, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 40,
      attack: 1.25, decay: 210, sustain: 1, tempo: 98, volume: 80, assign_source: A.random,
    }, {
      cables: [c('out_kb', 'in_mult'), c('out_mult1', 'in_mix_cv'), c('out_mult2', 'in_vcf_cutoff'), c('out_assign', 'in_vcf_res')],
      seq: [C1, null, C1, null, C6, null, null, C1, C1, null, C1, null, C6, null, C6, null],
    }),
  drum_lfo_kick: preset('Drums / LFO kick',
    'Recreation of the "synthesized kick drum" from Sweetwater\'s patch sheets: the triangle LFO (not normally in the audio path) is patched into EXT. AUDIO, and the EG into LFO RATE pushes its frequency up on every hit, so each one falls back like a kick.',
    'community', {
      mix: 100, lfo_rate: 38, lfo_wave: 1, cutoff: 2200, resonance: 0, vcf_mod_amount: 0, attack: 1.25, decay: 320, sustain: 1, tempo: 120, volume: 92,
    }, { cables: [c('out_lfo_tri', 'in_ext_audio'), c('out_eg', 'in_lfo_rate')], seq: [C2, null, null, null, C2, null, null, null, C2, null, null, null, C2, null, null, { note: C2, accent: true }] }),
  drum_filter_kick: preset('Drums / Filter kick',
    'Recreation of "FILTER KICK" from the manual\'s patch sheets: the ladder rings at 50 Hz on the edge of self-oscillation and the envelope sweeps it down on every hit - a deep, clean kick from the filter alone. MULT 1 into EXT. AUDIO silences the noise.',
    'manual', {
      mix: 100, cutoff: 48, resonance: 86, vcf_mod_amount: 46, vcf_mod_source: 0, attack: 1.25, decay: 380, sustain: 1, tempo: 122, volume: 95,
    }, { cables: [c('out_mult1', 'in_ext_audio')], seq: [C2, null, null, null, C2, null, null, C2, C2, null, null, null, C2, null, null, null] }),
  drum_metal_snare: preset('Drums / Metal snare',
    'Recreation of "METAL SNARE" from the manual\'s patch sheets: noise and a pulse body with the LFO square, at audio rate, in VCO LIN FM for a metallic, inharmonic ring; a short envelope and a pitch drop.',
    'manual', {
      vco_wave: 0, pulse_width: 30, mix: 62, frequency: -0.2, lfo_rate: 337, lfo_wave: 0, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 25,
      cutoff: 2400, resonance: 45, vcf_mod_amount: 38, attack: 1.25, decay: 170, sustain: 1, tempo: 100, volume: 80,
    }, { cables: [c('out_lfo_sq', 'in_vco_lin_fm')], seq: [null, null, null, null, C3, null, null, { note: C3, ratchet: 2 }, null, null, null, null, C3, null, null, null] }),
  drum_80s_toms: preset('Drums / \'80s toms',
    'Recreation of "\'80S TOMS" from the manual\'s patch sheets: a pulse with a fast downward pitch sweep (VCO MOD: EG to FREQUENCY) through a resonant low-pass - the electronic toms of 1980s drum machines - playing a fill down the drums.',
    'manual', {
      vco_wave: 0, pulse_width: 45, mix: 10, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 38, cutoff: 700, resonance: 40, vcf_mod_amount: 40,
      attack: 1.25, decay: 340, sustain: 1, tempo: 110, volume: 82,
    }, { seq: [C3, null, A2, null, F2, F2, D2, null, C3, A2, F2, D2, C2, null, null, null] }),
  drum_noise_transient: preset('Drums / Noise transient',
    'Recreation of "NOISE TRANSIENT" from the manual\'s patch sheets: the EG patched into MIX CV swings the mixer to noise at the start of every note, so each one begins with a breath or click of noise and settles into the tone - a mallet or a plucked string.',
    'manual', {
      vco_wave: 1, mix: 0, cutoff: 1800, resonance: 25, vcf_mod_amount: 35, attack: 1.25, decay: 480, sustain: 1, tempo: 104, volume: 74,
    }, { cables: [c('out_eg', 'in_mix_cv')], seq: [C3, null, G3, null, Eb3, null, C3, Bb2, null, G2, null, C3, null, Eb3, F3, null] }),
  drum_8bit: preset('Drums / 8-bit percussion',
    'Recreation of "8-BIT PERCUSSION" from the manual\'s patch sheets: a narrow pulse with a very fast pitch sweep and a tiny decay - the blips and booms of game consoles - with ratchets for rolls.',
    'manual', {
      vco_wave: 0, pulse_width: 12, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 55, cutoff: 9000, resonance: 0, vcf_mod_amount: 0,
      attack: 1.25, decay: 70, sustain: 1, tempo: 128, volume: 70,
    }, { seq: [C2, null, { note: C5, ratchet: 2 }, null, C4, C2, null, { note: C5, ratchet: 3 }, C2, null, C4, null, { note: C5, ratchet: 4 }, null, C4, C2] }),
  drum_ping: preset('Drums / Ping filter',
    'Recreation of VoltPages\' "ping-filter drum": VCA MODE ON, resonance at about 3 o\'clock and a short decay, with ASSIGN (CLOCK) patched into GATE so the envelope pings the filter on every step; KB into VCF CUTOFF tunes each ping from the pattern.',
    'community', {
      mix: 0, vco_wave: 1, cutoff: 180, resonance: 82, vcf_mod_amount: 55, vcf_mod_source: 0, vca_mode: 0, attack: 1.25, decay: 120, sustain: 1,
      tempo: 116, volume: 54, assign_source: A.clock,
    }, {
      cables: [c('out_assign', 'in_gate'), c('out_kb', 'in_vcf_cutoff'), c('out_mult1', 'in_ext_audio')],
      seq: [C2, C3, G2, C3, Eb3, C3, G2, Bb2, C2, C3, G2, C3, F3, Eb3, D3, Bb2],
    }),
  drum_and_bass: preset('Drums / Drums and bass',
    'Recreation of the manual\'s EVERYTHING!: a drum-and-bass patch. The audio-rate LFO, kicked up by the EG, is the bass drum and noise the snare; KB sets VC MIX between them; ASSIGN on ACCENT switches MIX from the VCO melody to the drums on accented steps.',
    'manual', {
      vco_wave: 1, mix: 0, lfo_rate: 42, lfo_wave: 1, vc_mix: 0, cutoff: 1500, resonance: 30, vcf_mod_amount: 40,
      attack: 1.25, decay: 220, sustain: 1, tempo: 112, volume: 78, assign_source: A.accent,
    }, {
      cables: [c('out_lfo_tri', 'in_mix1'), c('out_noise', 'in_mix2'), c('out_kb', 'in_vc_mix_ctrl'), c('out_vc_mix', 'in_ext_audio'), c('out_assign', 'in_mix_cv'), c('out_eg', 'in_lfo_rate')],
      seq: [
        { note: C1, accent: true }, C3, Eb3, C3, { note: C6, accent: true }, G3, C3, { note: C1, accent: true },
        { note: C1, accent: true }, Bb2, C3, Eb3, { note: C6, accent: true }, G3, F3, Eb3,
      ],
    }),

  // ---------------------------------------------------------------- Sequences and rhythm
  seq_octave_bounce: preset('Sequence / Octave bounce',
    'Recreation of "OCTAVE BOUNCE BACK" from the manual\'s patch sheets: the LFO square into VCO MOD (FREQUENCY) at exactly one octave, so held notes bounce between two octaves; with GLIDE the jump bends.',
    'manual', {
      vco_wave: 1, vco_mod_source: 1, vco_mod_dest: 1, vco_mod_amount: 44.7, lfo_wave: 0, lfo_rate: 4, glide: 25,
      cutoff: 1500, resonance: 35, vcf_mod_amount: 30, attack: 2, decay: 600, sustain: 0, tempo: 120, volume: 66,
    }, { seq: [{ note: C3, gate: 8 }, { note: C3, gate: 7 }, { note: Eb3, gate: 8 }, { note: Eb3, gate: 7 }, { note: G2, gate: 8 }, { note: G2, gate: 7 }, { note: Bb2, gate: 8 }, { note: Bb2, gate: 7 }] }),
  seq_sequenced_filter: preset('Sequence / Clocked filter',
    'Recreation of Sweetwater\'s "Sequenced Filter" (a Moog chart): ASSIGN on CLOCK into VCF CUTOFF opens the filter for the first half of every step, a rhythmic chop on top of the envelope.',
    'community', {
      vco_wave: 1, cutoff: 260, resonance: 55, vcf_mod_amount: 30, decay: 500, sustain: 0, tempo: 120, volume: 70, assign_source: A.clock,
    }, { cables: [c('out_assign', 'in_vcf_cutoff')], seq: [{ note: C2, gate: 8 }, { note: C2, gate: 8 }, { note: Eb2, gate: 8 }, { note: C2, gate: 8 }, { note: G2, gate: 8 }, { note: F2, gate: 8 }, { note: Eb2, gate: 8 }, { note: Bb2 - 12, gate: 8 }] }),
  seq_random_filter: preset('Sequence / Random filter',
    'Daniel Fisher\'s variation of the sequenced filter: ASSIGN on STEP RANDOM into VCF CUTOFF - a new filter setting on every step.',
    'community', {
      vco_wave: 1, cutoff: 240, resonance: 60, vcf_mod_amount: 35, decay: 280, sustain: 1, tempo: 124, volume: 70, assign_source: A.random,
    }, { cables: [c('out_assign', 'in_vcf_cutoff')], seq: [C2, C2, C3, C2, C2, Eb3, C2, Bb2, C2, C2, C3, C2, G2, C2, F2, Eb2] }),
  seq_accented_filter: preset('Sequence / Accented filter',
    'Recreation of Sweetwater\'s "Accented Filter": ASSIGN on ACCENT into VCF CUTOFF, so accented steps open the filter much further than the built-in accent does.',
    'community', {
      vco_wave: 1, cutoff: 200, resonance: 58, vcf_mod_amount: 42, decay: 230, sustain: 1, tempo: 122, volume: 70, assign_source: A.accent,
    }, {
      cables: [c('out_assign', 'in_vcf_cutoff')],
      seq: [{ note: C2, accent: true }, C2, C3, C2, { note: Eb2, accent: true }, C2, G2, C2, { note: C2, accent: true }, Bb2, C2, C3, { note: F2, accent: true }, Eb2, G2, { note: C2, accent: true }],
    }),
  seq_chugging: preset('Sequence / Chugging along',
    'Recreation of Sweetwater\'s "Chugging Along": ASSIGN on STEP TRIANGLE into VCF CUTOFF sweeps the filter up and down across a chugging 16th-note riff, while the LFO gently moves the pulse width for a livelier texture.',
    'community', {
      vco_wave: 0, pulse_width: 42, vco_mod_source: 1, vco_mod_dest: 0, vco_mod_amount: 22, lfo_rate: 0.7, lfo_wave: 1,
      cutoff: 240, resonance: 40, vcf_mod_amount: 30, decay: 160, sustain: 0, tempo: 132, volume: 72, assign_source: A.triangle,
    }, {
      cables: [c('out_assign', 'in_vcf_cutoff')],
      seq: [E2, E2, E2, E2, E2, E2, G2, E2, E2, E2, E2, E2, A2, E2, G2, E2].map(n => ({ note: n, gate: 3 })),
    }),
  seq_gallop: preset('Sequence / Gallop',
    'Recreation of Sweetwater\'s "Gallop": ASSIGN on CLOCK / 2 sends a voltage on every second step; through VC MIX into VCA CV it lifts alternate steps, and ratchets add the galloping triplets. Turn VC MIX for other rhythms.',
    'community', {
      vco_wave: 1, cutoff: 600, resonance: 30, vcf_mod_amount: 40, decay: 200, sustain: 1, vc_mix: 30, tempo: 112, volume: 70, assign_source: A.clock2,
    }, {
      cables: [c('out_assign', 'in_mix2'), c('out_vc_mix', 'in_vca_cv')],
      seq: [{ note: A2, ratchet: 3 }, A2, { note: A2, ratchet: 3 }, A2, { note: C3, ratchet: 3 }, C3, { note: G2, ratchet: 3 }, G2],
    }),
  seq_randomnation: preset('Sequence / Randomnation',
    'Recreation of Sweetwater\'s "Randomnation": ASSIGN on STEP RANDOM, split by the MULT, moves the filter and - through VC MIX into the TEMPO jack (set to TEMPO CV) - the tempo itself. Every pass is different.',
    'community', {
      vco_wave: 0, pulse_width: 30, cutoff: 300, resonance: 50, vcf_mod_amount: 40, decay: 250, sustain: 1, vc_mix: 22, tempo: 110, volume: 70,
      assign_source: A.random, tempo_mode: T.cv,
    }, {
      cables: [c('out_assign', 'in_mult'), c('out_mult1', 'in_vcf_cutoff'), c('out_mult2', 'in_mix2'), c('out_vc_mix', 'in_tempo')],
      seq: [C3, G2, Eb3, C3, Bb2, C3, F3, G2],
    }),
  seq_random_krell: preset('Sequence / Random melody',
    'Recreation of VoltPages\' "random Krell with VC MIX": NOISE into MIX 1, KB into MIX 2, the EG into VC MIX CTRL and VC MIX into VCO 1V/OCT. The envelope crossfades every note between the sequence and a noisy, random pitch - generative and never quite the same.',
    'community', {
      vco_wave: 1, vc_mix: 0, cutoff: 900, resonance: 45, vcf_mod_amount: 40, attack: 1.25, decay: 260, sustain: 1, tempo: 96, volume: 66,
    }, {
      cables: [c('out_noise', 'in_mix1'), c('out_kb', 'in_mix2'), c('out_eg', 'in_vc_mix_ctrl'), c('out_vc_mix', 'in_vco_1voct')],
      seq: [C2, Eb2, G2, Bb2, C3, G2, F2, Eb2],
    }),
  seq_step_scanner: preset('Sequence / Step scanner',
    'Recreation of VoltPages\' "step-address scanner": the TEMPO jack set to STEP ADDRESS, with the slow LFO triangle patched in, picks the step by voltage - the pattern is scanned up and down like a wavetable instead of clocked.',
    'community', {
      vco_wave: 1, lfo_rate: 0.35, lfo_wave: 1, cutoff: 1000, resonance: 40, vcf_mod_amount: 35, decay: 300, sustain: 1, tempo: 120, volume: 66, tempo_mode: T.address,
    }, { cables: [c('out_lfo_tri', 'in_tempo')], seq: [C3, D3, Eb3, F3, G3, Ab3, Bb3, C4] }),
  seq_swing_house: preset('Sequence / Swing house',
    'A deep-house bass with SWING at 62 % (SHIFT + TEMPO): every second 16th is late, the shuffle of house music. Short gates and an organ-like filter.',
    'community', {
      vco_wave: 0, pulse_width: 38, cutoff: 420, resonance: 30, vcf_mod_amount: 35, decay: 180, sustain: 0, tempo: 122, volume: 74,
    }, { seq: [{ note: C2, gate: 3 }, null, { note: C3, gate: 2 }, { note: C2, gate: 2 }, null, { note: Eb2, gate: 3 }, null, { note: G2, gate: 2 }, { note: C2, gate: 3 }, null, { note: Bb2, gate: 2 }, { note: C2, gate: 2 }, null, { note: F2, gate: 3 }, { note: G2, gate: 2 }, null] }),

  // ---------------------------------------------------------------- Pads, drones and FX
  pad_slow: preset('Pad / Slow PWM pad',
    'A slow pad from one voice: long attack and decay with SUSTAIN ON, the LFO sweeping the pulse width and the triangle (patched into VCF CUTOFF) slowly moving the filter. Whole-bar tied notes at 1/4 steps.',
    'community', {
      vco_wave: 0, pulse_width: 46, vco_mod_source: 1, vco_mod_dest: 0, vco_mod_amount: 55, lfo_rate: 0.35, lfo_wave: 1,
      cutoff: 900, resonance: 18, vcf_mod_amount: 22, attack: 1400, decay: 2600, sustain: 0, tempo: 90, volume: 66, step_div: 13,
    }, {
      cables: [c('out_lfo_tri', 'in_vcf_cutoff')],
      seq: [{ note: C3, gate: 8 }, { note: C3, gate: 8 }, { note: C3, gate: 8 }, { note: C3, gate: 6 }, { note: Ab2, gate: 8 }, { note: Ab2, gate: 8 }, { note: Bb2, gate: 8 }, { note: Bb2, gate: 6 }],
    }),
  drone_wind: preset('Drone / Wind',
    'VCA MODE ON makes it a drone that needs no gate: noise through a resonant low-pass, with the slow LFO sweeping it through VCF MOD - wind and surf.',
    'community', {
      mix: 100, cutoff: 700, resonance: 82, vcf_mod_source: 1, vcf_mod_amount: 55, lfo_rate: 0.12, lfo_wave: 1, vca_mode: 0, volume: 52,
    }),
  drone_beating: preset('Drone / Filter and VCO',
    'Two voices, no gate: VCA ON, the VCO saw plus the self-oscillating filter tuned a fifth above it. The two drift against each other like two analog oscillators; turn CUTOFF to retune the filter voice.',
    'community', {
      vco_wave: 1, mix: 0, frequency: -1, cutoff: 196.5, resonance: 88, vcf_mod_amount: 0, vca_mode: 0, volume: 52,
    }),
  hp_resonant: preset('FX / Resonant high-pass',
    'Recreation of "RESONANT HIGH PASS FILTER" from the manual\'s patch sheets, using the manual\'s own trick: in HI PASS the filter does not resonate, so VCF is patched back into EXT. AUDIO and MIX becomes the resonance (RESONANCE fully counter-clockwise). The LFO sweeps it.',
    'manual', {
      vco_wave: 1, mix: 62, vcf_mode: 0, cutoff: 900, resonance: 0, vcf_mod_source: 1, vcf_mod_amount: 40, lfo_rate: 0.25, lfo_wave: 1,
      decay: 450, sustain: 0, tempo: 110, volume: 60,
    }, { cables: [c('out_vcf', 'in_ext_audio')], seq: [C3, null, C3, Eb3, null, G3, null, Bb2] }),
  fx_laser: preset('FX / Laser zap',
    'VCO MOD: EG to FREQUENCY near the top, with a medium decay: every note dives from very high - pew. Pure arcade.',
    'community', {
      vco_wave: 0, pulse_width: 30, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 85, cutoff: 6000, resonance: 30, vcf_mod_amount: 20,
      attack: 1.25, decay: 300, sustain: 1, tempo: 120, volume: 62,
    }, { seq: [C3, null, null, G3, null, null, C3, null, Eb3, null, null, C4, null, G3, null, null] }),
};

/** The default pattern as step specs (Init plays it too) */
function DEFAULT_SEQ_STEPS(): StepSpec[] {
  return [
    { note: 36, accent: true }, 36, 48, 36, null, 39, { note: 36, gate: 2 }, { note: 43, glide: true },
    { note: 36, accent: true }, 36, 46, 36, { note: 41, ratchet: 2 }, null, 43, 39,
  ];
}
