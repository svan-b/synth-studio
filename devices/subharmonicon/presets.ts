// ============================================================================
// Subharmonicon presets. Named "Category / Name" - the preset menu groups by
// category. Sources and what could be read of each: REFERENCE.md "Presets".
//
//  - manual: the ten patch sheets on printed pp.45-49 (AQUATIC CHORDS, MELLOW
//    HARMONIES, SLIP & FALL, POINT ZERO, THREE HANDS ON THE WHEEL, BATERIA,
//    SPIRAL WAYS, STAR-GATE, POLY ROCK, CLOUD PATH). Their knob positions are
//    drawings we could not see; cables and notes that could be read are used,
//    so every one is a recreation and says so.
//  - Patching with Intention (Moog, 2022): its exercise chain, one step each.
//  - Moog Sound Studio Exploration Patchbook: DFAM + Subharmonicon patches known
//    only by title; these Subharmonicon halves carry our own names and credit
//    the original.
//  - community: well-known Subharmonicon techniques.
// Pitches in Hz; STEP values via st(semitones, SEQ OCT); divisors via D(n).
// ============================================================================

import type { PatchConnection, PresetSpec } from '@/types';
import { semis } from './theory';

type Values = Record<string, number | boolean>;

/** Divisor n (1..16) -> stored knob value */
const D = (n: number) => -n;
/** Equal-tempered note frequencies used below */
const HZ = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.26, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, E6: 1318.51, G6: 1567.98, C7: 2093.0,
};
// SEQ OCT index: 0 = ±1, 1 = ±2, 2 = ±5; QUANTIZE index: 0 off, 1 12-ET, 2 8-ET, 3 12-JI, 4 8-JI
const OCT1 = 0, OCT2 = 1, OCT5 = 2;
const Q_OFF = 0, Q_12ET = 1, Q_8ET = 2, Q_12JI = 3, Q_8JI = 4;
const SQR = 0, PWM = 1, SAW = 2;
const EG_OFF = 0, EG_ON = 1, EG_HELD = 2;

/** The spec defaults: every preset starts from here */
const BASE: Values = {
  vco1_freq: HZ.C4, vco1_sub1_freq: D(2), vco1_sub2_freq: D(4), vco1_wave: SAW,
  vco2_freq: HZ.G4, vco2_sub1_freq: D(3), vco2_sub2_freq: D(4), vco2_wave: SAW,
  vco1_level: 60, vco1_sub1_level: 50, vco1_sub2_level: 35, vco2_level: 40, vco2_sub1_level: 0, vco2_sub2_level: 0,
  seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
  seq_oct: OCT1, quantize: Q_12ET,
  seq1_step1: 0, seq1_step2: 58, seq1_step3: 33, seq1_step4: 83,
  seq2_step1: 0, seq2_step2: 25, seq2_step3: 42, seq2_step4: -42,
  rhythm1: D(4), rhythm2: D(3), rhythm3: D(2), rhythm4: D(5),
  rhythm1_seq1: true, rhythm1_seq2: false, rhythm2_seq1: false, rhythm2_seq2: true,
  rhythm3_seq1: false, rhythm3_seq2: false, rhythm4_seq1: false, rhythm4_seq2: false,
  rhythm_logic: 0, tempo: 240, eg_mode: EG_ON,
  cutoff: 1800, resonance: 15, vcf_eg_amt: 35, volume: 70,
  vcf_attack: 5, vcf_decay: 350, vca_attack: 3, vca_decay: 450,
};

/** Four STEP values for a sequencer from semitones (rounded to the knob's 0.1 resolution) */
function steps(seq: 1 | 2, st: [number, number, number, number], seqOct = OCT1): Values {
  const v: Values = {};
  st.forEach((n, i) => { v[`seq${seq}_step${i + 1}`] = Math.max(-100, Math.min(100, semis(n, seqOct))); });
  return v;
}

/** Rhythm generator assignments: { 1: [toSeq1, toSeq2], ... } (unlisted generators drive nothing) */
function rhythms(divs: [number, number, number, number], assign: Partial<Record<1 | 2 | 3 | 4, [boolean, boolean]>>): Values {
  const v: Values = {};
  for (let r = 1 as 1 | 2 | 3 | 4; r <= 4; r = (r + 1) as 1 | 2 | 3 | 4) {
    v[`rhythm${r}`] = D(divs[r - 1]);
    const a = assign[r] ?? [false, false];
    v[`rhythm${r}_seq1`] = a[0];
    v[`rhythm${r}_seq2`] = a[1];
  }
  return v;
}

function preset(name: string, description: string, source: PresetSpec['source'], settings: Values, patchConnections?: PatchConnection[]): PresetSpec {
  return { name, description, source, settings: { ...BASE, ...settings }, ...(patchConnections ? { patchConnections } : {}) };
}

const cable = (from: string, to: string): PatchConnection => ({ from, to });

export const SUBHARMONICON_PRESETS: Record<string, PresetSpec> = {
  init: preset('Init / Default patch',
    'The starting point: VCO 1 on Middle C with SUB 1 an octave down and SUB 2 two octaves down, VCO 2 a fifth up, Rhythm 1 (÷4) stepping Sequencer 1 and Rhythm 2 (÷3) stepping Sequencer 2 - four notes against three. Press PLAY.',
    'factory', {}),

  // ----------------------------------------------------------------- the manual's ten patch sheets
  aquatic_chords: preset('Chords / Aquatic Chords',
    'Recreation of the manual\'s AQUATIC CHORDS (p.45): an undertone Fmaj7 (VCO 1 on C5 over ÷3 and ÷4, VCO 2 on E5 over ÷3 and ÷4) with Sequencer 1 also patched into CUTOFF and CLOCK into TRIGGER, EG off - every clock count re-gates the envelopes, so the chords ripple. "Sequencer pitches are suggestions; adjust to taste."',
    'manual', {
      vco1_freq: HZ.C5, vco1_sub1_freq: D(3), vco1_sub2_freq: D(4), vco1_wave: PWM,
      vco2_freq: HZ.E5, vco2_sub1_freq: D(3), vco2_sub2_freq: D(4), vco2_wave: PWM,
      vco1_level: 45, vco1_sub1_level: 55, vco1_sub2_level: 45, vco2_level: 35, vco2_sub1_level: 45, vco2_sub2_level: 35,
      ...steps(1, [0, 5, 3, 7]), ...steps(2, [0, 3, 5, -2]),
      ...rhythms([4, 6, 2, 5], { 1: [true, false], 2: [false, true] }),
      tempo: 480, eg_mode: EG_OFF,
      cutoff: 650, resonance: 40, vcf_eg_amt: 30, vcf_attack: 4, vcf_decay: 220, vca_attack: 4, vca_decay: 320, volume: 70,
    }, [cable('out_seq1', 'in_cutoff'), cable('out_clock', 'in_trigger')]),

  mellow_harmonies: preset('Chords / Mellow Harmonies',
    'Recreation of the manual\'s MELLOW HARMONIES (p.45), the slow sibling of Aquatic Chords: Sequencer 1\'s voltage also opens the filter step by step, the chords are tuned in 12-JI so every interval is a whole-number ratio, and soft attacks round each change.',
    'manual', {
      vco1_freq: HZ.C5, vco1_sub1_freq: D(2), vco1_sub2_freq: D(5), vco1_wave: SAW,
      vco2_freq: HZ.G5, vco2_sub1_freq: D(3), vco2_sub2_freq: D(4), vco2_wave: SAW,
      vco1_level: 30, vco1_sub1_level: 55, vco1_sub2_level: 45, vco2_level: 25, vco2_sub1_level: 45, vco2_sub2_level: 40,
      quantize: Q_12JI, ...steps(1, [0, -3, 2, 5]), ...steps(2, [0, 2, -5, 4]),
      ...rhythms([2, 3, 4, 8], { 1: [true, false], 2: [false, true] }),
      tempo: 140,
      cutoff: 520, resonance: 20, vcf_eg_amt: 25, vcf_attack: 120, vcf_decay: 900, vca_attack: 70, vca_decay: 1200, volume: 72,
    }, [cable('out_seq1', 'in_cutoff')]),

  slip_and_fall: preset('Rhythm / Slip & Fall',
    'Recreation of the manual\'s SLIP & FALL (p.46): short resonant blips whose own filter envelope is patched back into RHYTHM 1, so each hit briefly speeds up Rhythm 1 and the pattern slips and catches itself.',
    'manual', {
      vco1_freq: HZ.G4, vco1_sub1_freq: D(2), vco1_sub2_freq: D(3), vco1_wave: SQR,
      vco2_freq: HZ.D5, vco2_sub1_freq: D(4), vco2_sub2_freq: D(6), vco2_wave: SQR,
      vco1_level: 55, vco1_sub1_level: 40, vco1_sub2_level: 25, vco2_level: 35, vco2_sub1_level: 30, vco2_sub2_level: 0,
      ...steps(1, [0, 7, 3, 10]), ...steps(2, [0, -5, 2, 5]),
      ...rhythms([9, 4, 5, 3], { 1: [true, false], 2: [false, true], 3: [true, false] }),
      tempo: 600,
      cutoff: 380, resonance: 55, vcf_eg_amt: 62, vcf_attack: 1, vcf_decay: 140, vca_attack: 1, vca_decay: 130, volume: 72,
    }, [cable('out_vcf_eg', 'in_rhythm1')]),

  point_zero: preset('Ambient / Point Zero',
    'Recreation of the manual\'s POINT ZERO (p.46; only its name is documented): every STEP sits a hair either side of 12 o\'clock (0 V) with QUANTIZE off, so the two VCOs drift in and out of unison and their undertones beat slowly. Rhythms at ÷16 and ÷12 make it breathe.',
    'manual', {
      vco1_freq: 440, vco1_sub1_freq: D(2), vco1_sub2_freq: D(3), vco1_wave: SAW,
      vco2_freq: 441.5, vco2_sub1_freq: D(2), vco2_sub2_freq: D(4), vco2_wave: SAW,
      vco1_level: 45, vco1_sub1_level: 60, vco1_sub2_level: 50, vco2_level: 45, vco2_sub1_level: 55, vco2_sub2_level: 45,
      quantize: Q_OFF, seq1_step1: 0, seq1_step2: 2, seq1_step3: -1.5, seq1_step4: 1, seq2_step1: 0, seq2_step2: -2, seq2_step3: 1.5, seq2_step4: -1,
      ...rhythms([16, 12, 8, 16], { 1: [true, false], 2: [false, true] }),
      tempo: 360,
      cutoff: 900, resonance: 25, vcf_eg_amt: 30, vcf_attack: 2200, vcf_decay: 3000, vca_attack: 1800, vca_decay: 4500, volume: 70,
    }),

  three_hands: preset('Polyrhythm / Three Hands on the Wheel',
    'Recreation of the manual\'s THREE HANDS ON THE WHEEL (p.46; only its name is documented): three rhythm generators (÷3, ÷4, ÷5) all turn Sequencer 1, combined by OR, while ÷7 turns Sequencer 2 - a pattern that only repeats every 420 counts. 8-ET keeps it in C major.',
    'manual', {
      vco1_freq: HZ.C5, vco1_sub1_freq: D(2), vco1_sub2_freq: D(4), vco1_wave: SAW,
      vco2_freq: HZ.G4, vco2_sub1_freq: D(2), vco2_sub2_freq: D(3), vco2_wave: PWM,
      vco1_level: 55, vco1_sub1_level: 35, vco1_sub2_level: 25, vco2_level: 40, vco2_sub1_level: 35, vco2_sub2_level: 0,
      quantize: Q_8ET, ...steps(1, [0, 4, 7, 11]), ...steps(2, [0, -3, 2, 5]),
      ...rhythms([3, 4, 5, 7], { 1: [true, false], 2: [true, false], 3: [true, false], 4: [false, true] }),
      tempo: 540,
      cutoff: 1400, resonance: 30, vcf_eg_amt: 40, vcf_attack: 2, vcf_decay: 180, vca_attack: 2, vca_decay: 220, volume: 70,
    }),

  bateria: preset('Percussion / Bateria',
    'Recreation of the manual\'s BATERIA (p.47) from its drawn cables: every mixer level down and RESONANCE full, so the sound is the filter\'s own sine, struck by SEQ 1 CLK into CUTOFF and opened by SEQ 2 CLK into the VCA. SEQ 1 and SEQ 2 bend their own rhythms. "Kick drum tuning is controlled via filter CUTOFF. Adjust VCF DECAY and EG AMT knobs for different kick drum flavors."',
    'manual', {
      vco1_level: 0, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
      seq1_osc: false, seq2_osc: false,
      seq1_step1: -40, seq1_step2: 0, seq1_step3: 30, seq1_step4: -10, seq2_step1: 20, seq2_step2: -30, seq2_step3: 0, seq2_step4: 50,
      ...rhythms([4, 3, 1, 8], { 1: [true, false], 2: [false, true], 4: [true, false] }),
      tempo: 480,
      cutoff: 55, resonance: 100, vcf_eg_amt: 60, vcf_attack: 1, vcf_decay: 95, vca_attack: 1, vca_decay: 160, volume: 100,
    }, [cable('out_seq2_clk', 'in_vca'), cable('out_seq1_clk', 'in_cutoff'), cable('out_seq1', 'in_rhythm1'), cable('out_seq2', 'in_rhythm2')]),

  spiral_ways: preset('Chords / Spiral Ways',
    'Recreation of the manual\'s SPIRAL WAYS (p.48) from its levels, cable and notes: "Tune SUB VCO 1 FREQ 1 to a Fifth. Tune SUB VCO 2 SUB 2 to a Major 3rd. Adjust VCF ATTACK for crescendo depth." Long filter swells, and the filter envelope patched into RHYTHM 1 re-voices the chord as it swells.',
    'manual', {
      vco1_freq: HZ.E4, vco1_sub1_freq: D(3), vco1_sub2_freq: D(4), vco1_wave: SAW,
      vco2_freq: HZ.G4, vco2_sub1_freq: D(2), vco2_sub2_freq: D(5), vco2_wave: SAW,
      vco1_level: 60, vco1_sub1_level: 60, vco1_sub2_level: 60, vco2_level: 64, vco2_sub1_level: 100, vco2_sub2_level: 100,
      quantize: Q_8ET, ...steps(1, [0, 4, -3, 2]), ...steps(2, [0, -5, 3, 7]),
      ...rhythms([12, 16, 1, 1], { 1: [true, false], 2: [false, true] }),
      tempo: 300,
      cutoff: 420, resonance: 35, vcf_eg_amt: 72, vcf_attack: 2400, vcf_decay: 1600, vca_attack: 900, vca_decay: 4800, volume: 80,
    }, [cable('out_vcf_eg', 'in_rhythm1')]),

  star_gate: preset('FX / Star-Gate',
    'Recreation of the manual\'s STAR-GATE (p.48; only its name is documented): SEQ OCT ±5 throws VCO 1 across five octaves while Sequencer 2 walks VCO 2\'s subharmonic dividers, and VCO 2 SUB 2 frequency-modulates the resonant filter at audio rate. Science fiction.',
    'manual', {
      vco1_freq: HZ.C4, vco1_sub1_freq: D(3), vco1_sub2_freq: D(7), vco1_wave: SQR,
      vco2_freq: HZ.C6, vco2_sub1_freq: D(5), vco2_sub2_freq: D(11), vco2_wave: SAW,
      vco1_level: 45, vco1_sub1_level: 35, vco1_sub2_level: 0, vco2_level: 20, vco2_sub1_level: 50, vco2_sub2_level: 40,
      seq_oct: OCT5, quantize: Q_OFF, seq2_osc: false, seq2_sub1: true, seq2_sub2: true,
      seq1_step1: 0, seq1_step2: 46, seq1_step3: 18, seq1_step4: 72, seq2_step1: 0, seq2_step2: -40, seq2_step3: 35, seq2_step4: -70,
      ...rhythms([3, 5, 2, 7], { 1: [true, false], 2: [false, true] }),
      tempo: 420,
      cutoff: 900, resonance: 70, vcf_eg_amt: 50, vcf_attack: 30, vcf_decay: 400, vca_attack: 8, vca_decay: 600, volume: 62,
    }, [cable('out_vco2_sub2', 'in_cutoff')]),

  poly_rock: preset('Percussion / Poly Rock',
    'Recreation of the manual\'s POLY ROCK (p.49): chords plus plucky percussion, ±1 and 8-ET, with CLOCK patched into the VCA so every master count adds a click on top of the plucked chord sequence. "Tune SUB OSC 1, 2, 3, and 4 to desired chord shapes."',
    'manual', {
      vco1_freq: HZ.C5, vco1_sub1_freq: D(2), vco1_sub2_freq: D(3), vco1_wave: SQR,
      vco2_freq: HZ.E5, vco2_sub1_freq: D(2), vco2_sub2_freq: D(5), vco2_wave: SQR,
      vco1_level: 50, vco1_sub1_level: 45, vco1_sub2_level: 35, vco2_level: 40, vco2_sub1_level: 35, vco2_sub2_level: 30,
      quantize: Q_8ET, ...steps(1, [0, 5, 7, 3]), ...steps(2, [0, 2, -3, 4]),
      ...rhythms([2, 3, 4, 6], { 1: [true, false], 2: [false, true] }),
      tempo: 480,
      cutoff: 900, resonance: 30, vcf_eg_amt: 55, vcf_attack: 1, vcf_decay: 110, vca_attack: 1, vca_decay: 180, volume: 70,
    }, [cable('out_clock', 'in_vca')]),

  cloud_path: preset('Arp / Cloud Path',
    'Recreation of the manual\'s CLOUD PATH (p.49): blippy arpeggiated chords in 12-ET, ±1. Tune with VCO 1 LEVEL alone, then bring VCO 2 and the subs in slowly. "Press RHYTHM 3 SEQ 1 for double-time feels."',
    'manual', {
      vco1_freq: HZ.G4, vco1_sub1_freq: D(2), vco1_sub2_freq: D(3), vco1_wave: SAW,
      vco2_freq: HZ.D5, vco2_sub1_freq: D(3), vco2_sub2_freq: D(4), vco2_wave: PWM,
      vco1_level: 55, vco1_sub1_level: 35, vco1_sub2_level: 30, vco2_level: 35, vco2_sub1_level: 30, vco2_sub2_level: 25,
      ...steps(1, [0, 7, 12, 3]), ...steps(2, [0, 5, -2, 9]),
      ...rhythms([4, 2, 2, 8], { 1: [true, false], 2: [false, true] }),
      tempo: 600,
      cutoff: 1300, resonance: 35, vcf_eg_amt: 45, vcf_attack: 1, vcf_decay: 160, vca_attack: 2, vca_decay: 260, volume: 70,
    }),

  // ----------------------------------------------------------------- Patching with Intention (Moog, 2022)
  pwi_init: preset('Patching with Intention / 1 Initialized patch',
    'Recreation of the guide\'s starting point: one VCO droning (EG held, blinking), nothing assigned - the sequencers run but are "not currently connected to anything". Every exercise builds from here.',
    'manual', {
      vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco1_level: 70,
      seq1_osc: false, seq2_osc: false, ...steps(1, [0, 0, 0, 0]), ...steps(2, [0, 0, 0, 0]),
      ...rhythms([4, 3, 2, 5], {}),
      eg_mode: EG_HELD, cutoff: 2500, resonance: 10, vcf_eg_amt: 0,
    }),
  pwi_first_steps: preset('Patching with Intention / 2 First steps',
    'Recreation of "First Steps": RHYTHM 1 lights SEQ 1, and a patch cable from SEQ 1 to the VCO 1 input plays the four steps on VCO 1 (instead of the OSC 1 button). Turn the STEP knobs and hear each one.',
    'manual', {
      vco1_sub1_level: 30, vco1_sub2_level: 0, vco2_level: 0, vco1_level: 70,
      seq1_osc: false, seq2_osc: false, ...steps(1, [0, 4, 7, 12]), ...steps(2, [0, 0, 0, 0]),
      ...rhythms([4, 3, 2, 5], { 1: [true, false] }),
      cutoff: 2500, resonance: 10, vcf_eg_amt: 20,
    }, [cable('out_seq1', 'in_vco1')]),
  pwi_intertwining: preset('Patching with Intention / 3 Intertwining sequencers',
    'Recreation of "Intertwining Sequencers": SEQ 1 and SEQ 2 both patched into VCO 1. With Sequencer 2 at 12 o\'clock nothing changes; turn its knobs and the two melodies add together, at two different rhythms.',
    'manual', {
      vco1_sub1_level: 30, vco1_sub2_level: 0, vco2_level: 0, vco1_level: 70,
      seq1_osc: false, seq2_osc: false, ...steps(1, [0, 4, 7, 12]), ...steps(2, [0, 5, 0, -5]),
      ...rhythms([4, 3, 2, 5], { 1: [true, false], 2: [false, true] }),
      cutoff: 2500, resonance: 10, vcf_eg_amt: 20,
    }, [cable('out_seq1', 'in_vco1'), cable('out_seq2', 'in_vco1')]),
  pwi_melody_to_rhythm: preset('Patching with Intention / 4 From melody to rhythm',
    'Recreation of "From Melody to Rhythm": the same sequence with RESONANCE near maximum and short filter envelopes - "you will start to get very percussive sounds", the melody becoming a pitched drum pattern.',
    'manual', {
      vco1_sub1_level: 40, vco1_sub2_level: 30, vco2_level: 30, vco1_level: 60,
      seq1_osc: false, seq2_osc: true, ...steps(1, [0, 4, 7, 12]), ...steps(2, [0, 5, 0, -5]),
      ...rhythms([2, 3, 4, 5], { 1: [true, false], 2: [false, true] }),
      tempo: 480, cutoff: 260, resonance: 88, vcf_eg_amt: 70, vcf_attack: 1, vcf_decay: 120, vca_attack: 1, vca_decay: 180,
    }, [cable('out_seq1', 'in_vco1')]),
  pwi_envelopes: preset('Patching with Intention / 5 Fun with envelopes',
    'Recreation of "Fun with Envelopes": EG off and CLOCK patched into TRIGGER, so the envelopes fire on every clock count, independent of the sequencers. A slow VCF ATTACK against a short VCA DECAY makes notes that brighten as they fade.',
    'manual', {
      vco1_sub1_level: 45, vco1_sub2_level: 35, vco2_level: 35, vco1_level: 55,
      ...steps(1, [0, 3, 7, 10]), ...steps(2, [0, -2, 3, 5]),
      ...rhythms([4, 6, 2, 5], { 1: [true, false], 2: [false, true] }),
      tempo: 360, eg_mode: EG_OFF, cutoff: 400, resonance: 30, vcf_eg_amt: 60, vcf_attack: 300, vcf_decay: 400, vca_attack: 2, vca_decay: 260,
    }, [cable('out_clock', 'in_trigger')]),
  pwi_drum_machine: preset('Patching with Intention / 6 Intermingled drum machine',
    'Recreation of "Intermingled Drum Machine": VCO 1 SUB 1 patched into RHYTHM 2 - a subharmonic "can function in much the same way" as an LFO - so Rhythm 2 keeps changing its division, and Sequencer 2 drives CUTOFF for the drum tones.',
    'manual', {
      vco1_freq: 300, vco1_sub1_freq: D(16), vco1_sub2_freq: D(4),
      vco1_sub1_level: 0, vco1_sub2_level: 35, vco2_level: 45, vco1_level: 40, vco2_sub1_level: 30,
      ...steps(1, [0, 12, 5, -7]), ...steps(2, [-12, 12, 0, 24], OCT2),
      seq_oct: OCT2, seq2_osc: false,
      ...rhythms([2, 3, 4, 5], { 1: [true, false], 2: [false, true] }),
      tempo: 600, cutoff: 300, resonance: 75, vcf_eg_amt: 55, vcf_attack: 1, vcf_decay: 90, vca_attack: 1, vca_decay: 140,
    }, [cable('out_vco1_sub1', 'in_rhythm2'), cable('out_seq2', 'in_cutoff')]),

  // ----------------------------------------------------------------- Moog Sound Studio (DFAM + Subharmonicon)
  velvet_bass: preset('Sound Studio / Velvet sub bass',
    'Inspired by Moog\'s Sound Studio patch "Plush Leather" (only its title is published): a soft, round sub-bass line - VCO 1 muted, its SUB 1 and SUB 2 carrying the notes two and three octaves down. Pair it with the DFAM: patch CLOCK into the DFAM\'s ADV / CLOCK.',
    'community', {
      vco1_freq: HZ.C4, vco1_sub1_freq: D(4), vco1_sub2_freq: D(8), vco1_wave: SQR,
      vco1_level: 0, vco1_sub1_level: 85, vco1_sub2_level: 40, vco2_level: 0,
      ...steps(1, [0, 0, 3, 7]), ...rhythms([2, 8, 16, 16], { 1: [true, false] }),
      tempo: 440, cutoff: 260, resonance: 18, vcf_eg_amt: 25, vcf_attack: 3, vcf_decay: 260, vca_attack: 4, vca_decay: 300, volume: 78,
    }),
  bubbling: preset('Sound Studio / Bubbling undertones',
    'Inspired by Moog\'s Sound Studio patch "Ali\'s Bubblin\'" (title only): Sequencer 1 changes VCO 1\'s SUB 1 and SUB 2 dividers instead of its pitch, so the undertones bubble up and down the series under a fixed VCO, through a resonant pluck.',
    'community', {
      vco1_freq: HZ.C6, vco1_sub1_freq: D(6), vco1_sub2_freq: D(9), vco1_wave: SAW,
      vco1_level: 10, vco1_sub1_level: 70, vco1_sub2_level: 55, vco2_level: 0,
      seq_oct: OCT5, quantize: Q_OFF, seq1_osc: false, seq1_sub1: true, seq1_sub2: true,
      seq1_step1: 0, seq1_step2: 30, seq1_step3: -25, seq1_step4: 55,
      ...rhythms([2, 3, 2, 5], { 1: [true, false] }),
      tempo: 520, cutoff: 600, resonance: 60, vcf_eg_amt: 50, vcf_attack: 1, vcf_decay: 150, vca_attack: 1, vca_decay: 200, volume: 72,
    }),
  arcade: preset('Sound Studio / Game chirps',
    'Inspired by Moog\'s Sound Studio patch "Arcade Blasts" (described as chimy, sing-songy chirps like a classic video game): bright square waves in 8-ET with fast filter blips, two sequencers chasing each other at ÷1 and ÷3.',
    'community', {
      vco1_freq: HZ.C6, vco1_sub1_freq: D(2), vco1_sub2_freq: D(4), vco1_wave: SQR,
      vco2_freq: HZ.G5, vco2_sub1_freq: D(2), vco2_sub2_freq: D(3), vco2_wave: SQR,
      vco1_level: 55, vco1_sub1_level: 30, vco1_sub2_level: 0, vco2_level: 40, vco2_sub1_level: 25, vco2_sub2_level: 0,
      quantize: Q_8ET, ...steps(1, [0, 12, 7, 4]), ...steps(2, [0, 5, 9, 12]),
      ...rhythms([1, 3, 2, 5], { 1: [true, false], 2: [false, true] }),
      tempo: 420, cutoff: 2600, resonance: 45, vcf_eg_amt: 45, vcf_attack: 1, vcf_decay: 70, vca_attack: 1, vca_decay: 110, volume: 62,
    }),
  stacked: preset('Sound Studio / Stacked undertones',
    'Inspired by Moog\'s Sound Studio patch "Stack \'Em Up" (title only): all six oscillators up and stacked as one undertone chord, near the top of the mixer so it saturates warmly, with slow swells.',
    'community', {
      vco1_freq: HZ.A4, vco1_sub1_freq: D(2), vco1_sub2_freq: D(3), vco1_wave: SAW,
      vco2_freq: HZ.E5, vco2_sub1_freq: D(4), vco2_sub2_freq: D(5), vco2_wave: SAW,
      vco1_level: 80, vco1_sub1_level: 85, vco1_sub2_level: 80, vco2_level: 70, vco2_sub1_level: 80, vco2_sub2_level: 75,
      ...steps(1, [0, -2, 3, 5]), ...steps(2, [0, 2, -3, 0]),
      ...rhythms([8, 12, 4, 4], { 1: [true, false], 2: [false, true] }),
      tempo: 480, cutoff: 700, resonance: 30, vcf_eg_amt: 35, vcf_attack: 600, vcf_decay: 1800, vca_attack: 400, vca_decay: 2500, volume: 62,
    }),
  sub_funk: preset('Sound Studio / Sub funk',
    'Inspired by Moog\'s Sound Studio patch "Subfunkicon" (title only): a syncopated bass from two rhythm generators on one sequencer with XOR logic - steps land only where the ÷2 and ÷3 rhythms disagree.',
    'community', {
      vco1_freq: HZ.E4, vco1_sub1_freq: D(2), vco1_sub2_freq: D(4), vco1_wave: PWM,
      vco1_level: 40, vco1_sub1_level: 80, vco1_sub2_level: 35, vco2_level: 0,
      ...steps(1, [0, 12, 7, 10]), ...rhythms([2, 3, 4, 8], { 1: [true, false], 2: [true, false] }),
      rhythm_logic: 1, tempo: 600,
      cutoff: 320, resonance: 45, vcf_eg_amt: 55, vcf_attack: 1, vcf_decay: 160, vca_attack: 2, vca_decay: 200, volume: 76,
    }),

  // ----------------------------------------------------------------- community techniques
  undertone_triad: preset('Drone / Undertone minor triad',
    'EG held: one VCO and its subs at ÷4, ÷5 and ÷6 - the undertone series turned into a minor triad (the mirror of the major triad in the harmonic series), perfectly in tune because every note divides the same oscillator.',
    'community', {
      vco1_freq: HZ.C6, vco1_sub1_freq: D(4), vco1_sub2_freq: D(5), vco1_wave: SAW,
      vco2_freq: HZ.C6, vco2_sub1_freq: D(6), vco2_sub2_freq: D(8), vco2_wave: SAW,
      vco1_level: 0, vco1_sub1_level: 65, vco1_sub2_level: 60, vco2_level: 0, vco2_sub1_level: 60, vco2_sub2_level: 40,
      quantize: Q_OFF, eg_mode: EG_HELD, ...rhythms([4, 3, 2, 5], {}),
      cutoff: 1100, resonance: 20, vcf_eg_amt: 0, volume: 72,
    }),
  just_fifths: preset('Drone / Just fifths',
    'EG held, 12-JI: VCO 2 a just fifth (3/2) above VCO 1, both with subs at ÷2 and ÷3 - a stack of perfect fifths and octaves with no beating at all. Switch QUANTIZE to 12-ET and listen to the fifth start to shimmer.',
    'community', {
      vco1_freq: HZ.C5, vco1_sub1_freq: D(2), vco1_sub2_freq: D(3), vco1_wave: SAW,
      vco2_freq: HZ.G5, vco2_sub1_freq: D(2), vco2_sub2_freq: D(3), vco2_wave: SAW,
      vco1_level: 45, vco1_sub1_level: 55, vco1_sub2_level: 45, vco2_level: 40, vco2_sub1_level: 45, vco2_sub2_level: 35,
      quantize: Q_12JI, eg_mode: EG_HELD, ...rhythms([4, 3, 2, 5], {}),
      cutoff: 1500, resonance: 15, vcf_eg_amt: 0, volume: 70,
    }),
  three_four: preset('Polyrhythm / 3 against 4',
    'Rhythm 3 (÷3) turns Sequencer 1 and Rhythm 4 (÷4) turns Sequencer 2: two four-note figures at different speeds that meet again every 12 clock counts. Count along with the step lights.',
    'community', {
      vco1_freq: HZ.C4, vco1_sub1_freq: D(2), vco1_sub2_freq: D(4), vco2_freq: HZ.C5, vco2_sub1_freq: D(2), vco2_sub2_freq: D(3),
      vco1_level: 55, vco1_sub1_level: 40, vco1_sub2_level: 0, vco2_level: 45, vco2_sub1_level: 30, vco2_sub2_level: 0,
      quantize: Q_8ET, ...steps(1, [0, 4, 7, 5]), ...steps(2, [0, -3, 4, 7]),
      ...rhythms([1, 1, 3, 4], { 3: [true, false], 4: [false, true] }),
      tempo: 420, cutoff: 1500, vcf_eg_amt: 45, vcf_decay: 220, vca_decay: 300,
    }),
  phasing: preset('Polyrhythm / Phasing 5 against 7',
    '÷5 against ÷7: the two sequences line up only every 35 counts, so the melody keeps rearranging itself - Steve Reich-style phasing from two integer dividers. 12-JI keeps the intervals pure.',
    'community', {
      vco1_freq: HZ.D5, vco1_sub1_freq: D(2), vco1_sub2_freq: D(3), vco2_freq: HZ.A4, vco2_sub1_freq: D(2), vco2_sub2_freq: D(4),
      vco1_wave: PWM, vco2_wave: SAW,
      vco1_level: 50, vco1_sub1_level: 35, vco1_sub2_level: 25, vco2_level: 45, vco2_sub1_level: 35, vco2_sub2_level: 20,
      quantize: Q_12JI, ...steps(1, [0, 3, 7, 10]), ...steps(2, [0, 5, 7, 12]),
      ...rhythms([5, 7, 2, 4], { 1: [true, false], 2: [false, true] }),
      tempo: 900, cutoff: 1700, resonance: 25, vcf_eg_amt: 40, vcf_attack: 2, vcf_decay: 200, vca_attack: 2, vca_decay: 260,
    }),
  xor_gates: preset('Polyrhythm / XOR gates',
    'Rhythm 1 (÷2) and Rhythm 2 (÷3) both turn Sequencer 1, with the rhythm logic on XOR: it steps only when exactly one of them fires, so every sixth count - where they coincide - drops out. Flip to OR to hear the difference.',
    'community', {
      vco1_freq: HZ.A4, vco1_sub1_freq: D(2), vco1_sub2_freq: D(4), vco1_wave: SQR,
      vco1_level: 55, vco1_sub1_level: 45, vco1_sub2_level: 20, vco2_level: 0,
      quantize: Q_8ET, ...steps(1, [0, 7, 3, 12]),
      ...rhythms([2, 3, 4, 5], { 1: [true, false], 2: [true, false] }),
      rhythm_logic: 1, tempo: 600, cutoff: 1200, resonance: 35, vcf_eg_amt: 45, vcf_attack: 1, vcf_decay: 120, vca_attack: 1, vca_decay: 150,
    }),
  divider_bass: preset('Bass / Divider bass',
    'A punchy square bass: VCO 1 low with SUB 1 at ÷2 doing most of the work, a resonant filter pluck and short decays. The sequence walks root, octave, fifth and seventh.',
    'community', {
      vco1_freq: HZ.C4, vco1_sub1_freq: D(2), vco1_sub2_freq: D(4), vco1_wave: SQR,
      vco1_level: 45, vco1_sub1_level: 85, vco1_sub2_level: 30, vco2_level: 0,
      ...steps(1, [0, 12, 7, 10]), ...rhythms([2, 3, 4, 8], { 1: [true, false] }),
      tempo: 480, cutoff: 420, resonance: 50, vcf_eg_amt: 50, vcf_attack: 1, vcf_decay: 180, vca_attack: 2, vca_decay: 220, volume: 76,
    }),
  undertone_melody: preset('Sequence / Undertone melody',
    'Sequencer 1 changes only VCO 1\'s SUB 1 divider (OSC off), with SEQ OCT ±5 so the four steps reach right across the series: the melody walks down the undertones of a fixed note - intervals no keyboard has.',
    'community', {
      vco1_freq: HZ.C6, vco1_sub1_freq: D(8), vco1_sub2_freq: D(4), vco1_wave: SAW,
      vco1_level: 15, vco1_sub1_level: 80, vco1_sub2_level: 25, vco2_level: 0,
      seq_oct: OCT5, quantize: Q_OFF, seq1_osc: false, seq1_sub1: true,
      seq1_step1: 0, seq1_step2: 40, seq1_step3: -20, seq1_step4: 60,
      ...rhythms([3, 4, 2, 5], { 1: [true, false] }),
      tempo: 480, cutoff: 2200, resonance: 20, vcf_eg_amt: 25, vcf_decay: 300, vca_decay: 380,
    }),
  filter_fm: preset('FX / Sub-audio filter FM',
    'VCO 2 SUB 2 into CUTOFF: a subharmonic at audio rate frequency-modulates the ladder filter, growling sidebands on every note. Change VCO 2 SUB 2 FREQ to change the growl.',
    'community', {
      vco2_freq: HZ.C5, vco2_sub2_freq: D(7), vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0, seq2_osc: false,
      vco1_sub1_level: 60, ...rhythms([4, 3, 2, 5], { 1: [true, false] }),
      cutoff: 900, resonance: 50, vcf_eg_amt: 30,
    }, [cable('out_vco2_sub2', 'in_cutoff')]),
  pwm_lead: preset('Lead / Envelope PWM',
    'VCO 1 in the middle (square) position with the VCF envelope patched into its PWM jack, replacing the SUB 1 normal: each note sweeps the pulse width as it opens. A singing lead in 12-ET.',
    'community', {
      vco1_freq: HZ.C5, vco1_wave: PWM, vco1_level: 75, vco1_sub1_level: 30, vco1_sub2_level: 0, vco2_level: 0,
      ...steps(1, [0, 7, 3, 10]), ...rhythms([2, 3, 2, 5], { 1: [true, false] }),
      tempo: 300, cutoff: 2600, resonance: 25, vcf_eg_amt: 20, vcf_attack: 20, vcf_decay: 700, vca_attack: 10, vca_decay: 650,
    }, [cable('out_vcf_eg', 'in_vco1_pwm')]),
  pad_swells: preset('Ambient / Slow swells',
    'Long attacks on both envelopes, longer than the steps: since an envelope ignores new triggers while it rises, the swells set their own slow rhythm across the polyrhythm. 8-JI chords.',
    'community', {
      vco1_freq: HZ.E5, vco1_sub1_freq: D(3), vco1_sub2_freq: D(4), vco2_freq: HZ.B5, vco2_sub1_freq: D(3), vco2_sub2_freq: D(5),
      vco1_level: 40, vco1_sub1_level: 55, vco1_sub2_level: 45, vco2_level: 35, vco2_sub1_level: 45, vco2_sub2_level: 40,
      quantize: Q_8JI, ...steps(1, [0, 3, -2, 5]), ...steps(2, [0, -3, 2, 4]),
      ...rhythms([2, 3, 4, 5], { 1: [true, false], 2: [false, true] }),
      tempo: 360, cutoff: 600, resonance: 25, vcf_eg_amt: 40, vcf_attack: 1600, vcf_decay: 2500, vca_attack: 1200, vca_decay: 3000, volume: 72,
    }),
};
