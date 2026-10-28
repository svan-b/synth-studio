// ============================================================================
// MOOG SUBHARMONICON
// Semi-modular polyrhythmic analog synthesizer (2020), 60HP Eurorack, 3U.
// Control names, ranges, switch positions and the 32-point patchbay follow the
// Moog Subharmonicon user manual. Page numbers are those printed in Moog's PDF
// (Oscillators p.18, Mixer p.21, Filter p.23, EGs p.24, Sequencers p.26,
// Transport p.28-29, Polyrhythm Generators p.30, Patchbay p.31-35,
// Global Parameters p.41, MIDI p.44).
//
// Value conventions used in this twin:
//   * SUB FREQ and RHYTHM knobs store the NEGATED divisor (-16..-1) so that
//     the knob reads ÷16 fully counter-clockwise and ÷1 fully clockwise, which
//     is how the hardware is marked. Use D(n) below to write "divide by n".
//   * Sequencer STEP knobs are -100..+100 (% of the SEQ OCT range).
//   * TEMPO is shown in BPM; the hardware range 0.333-50 Hz = 20-3000 BPM.
// ============================================================================

import type { ControlSpec, DeviceSpec, PresetSpec } from '@/types';

/** Divisor n (1..16) → stored knob value */
export const D = (n: number) => -n;

const divFormat = (v: number) => `÷${Math.round(-v)}`;
const stepFormat = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}`;

export const QUANTIZE_OPTIONS = ['OFF', '12-ET', '8-ET', '12-JI', '8-JI'];
export const SEQ_OCT_OPTIONS = ['±1', '±2', '±5'];
export const EG_OPTIONS = ['OFF', 'ON', 'HELD'];
export const WAVE_OPTIONS = ['SQR', 'SQ/SAW', 'SAW'];

const controls: Record<string, ControlSpec> = {};

// ---------------------------------------------------------------------------
// Oscillators (p.18-20)
// ---------------------------------------------------------------------------
for (const v of [1, 2]) {
  controls[`vco${v}_freq`] = {
    type: 'knob',
    label: `VCO ${v} FREQ`,
    description: `Initial pitch of VCO ${v}. Four octaves: fully counter-clockwise is Middle C (262 Hz), fully clockwise the highest piano C (4186 Hz). The subharmonics divide this frequency.`,
    min: 261.63,
    max: 4186,
    default: v === 1 ? 261.63 : 392,
    units: 'Hz',
    curve: 'logarithmic',
    size: 'large',
    manualReference: 'p.18 – VCO FREQ',
  };
  controls[`vco${v}_sub1_freq`] = {
    type: 'knob',
    label: 'SUB 1 FREQ',
    description: `Subharmonic 1 of VCO ${v}: the VCO frequency divided by a whole number from 1 (fully clockwise) to 16 (fully counter-clockwise). f/2 is an octave down, f/3 an octave and a fifth down.`,
    min: -16,
    max: -1,
    step: 1,
    default: v === 1 ? D(2) : D(3),
    units: 'none',
    format: divFormat,
    manualReference: 'p.18 – SUB 1 FREQ',
  };
  controls[`vco${v}_sub2_freq`] = {
    type: 'knob',
    label: 'SUB 2 FREQ',
    description: `Subharmonic 2 of VCO ${v}: VCO frequency ÷ 1..16.`,
    min: -16,
    max: -1,
    step: 1,
    default: v === 1 ? D(4) : D(4),
    units: 'none',
    format: divFormat,
    manualReference: 'p.19 – SUB 2 FREQ',
  };
  controls[`vco${v}_wave`] = {
    type: 'switch',
    label: `VCO ${v} WAVE`,
    description: `Top: square from VCO ${v}, SUB 1 and SUB 2. Middle: VCO square (pulse-width modulated by SUB 1's sawtooth unless the VCO ${v} PWM jack is patched), subs sawtooth. Bottom: sawtooth from all three.`,
    options: WAVE_OPTIONS,
    default: 2,
    manualReference: 'p.19 – Waveform switch',
  };
  // Mixer (p.21)
  controls[`vco${v}_level`] = {
    type: 'knob', label: `VCO ${v} LEVEL`, description: `Level of VCO ${v} into the filter.`,
    min: 0, max: 100, default: v === 1 ? 60 : 40, units: '%', manualReference: 'p.21 – Mixer',
  };
  controls[`vco${v}_sub1_level`] = {
    type: 'knob', label: 'SUB 1 LEVEL', description: `Level of VCO ${v} SUB 1 into the filter.`,
    min: 0, max: 100, default: v === 1 ? 50 : 0, units: '%', manualReference: 'p.21 – Mixer',
  };
  controls[`vco${v}_sub2_level`] = {
    type: 'knob', label: 'SUB 2 LEVEL', description: `Level of VCO ${v} SUB 2 into the filter.`,
    min: 0, max: 100, default: v === 1 ? 35 : 0, units: '%', manualReference: 'p.21 – Mixer',
  };
}

// SEQ ASSIGN (p.26): which oscillators each sequencer controls
for (const s of [1, 2]) {
  controls[`seq${s}_osc`] = {
    type: 'button', label: 'OSC', default: true,
    description: `Sequencer ${s} transposes VCO ${s} (its subharmonics follow, because they divide it).`,
    manualReference: 'p.26 – SEQ ASSIGN',
  };
  controls[`seq${s}_sub1`] = {
    type: 'button', label: 'SUB 1', default: false,
    description: `Sequencer ${s} changes the SUB 1 divisor of VCO ${s}, so the sub walks the undertone series.`,
    manualReference: 'p.26 – SEQ ASSIGN',
  };
  controls[`seq${s}_sub2`] = {
    type: 'button', label: 'SUB 2', default: false,
    description: `Sequencer ${s} changes the SUB 2 divisor of VCO ${s}.`,
    manualReference: 'p.26 – SEQ ASSIGN',
  };
}

controls.seq_oct = {
  type: 'switch', label: 'SEQ OCT', options: SEQ_OCT_OPTIONS, default: 0,
  description: 'Range of the sequencer STEP knobs around the VCO FREQ setting: ±1, ±2 or ±5 octaves. Shared by both sequencers. For full ±5 use, set VCO FREQ fully counter-clockwise.',
  manualReference: 'p.27 – SEQ OCT',
};
controls.quantize = {
  type: 'switch', label: 'QUANTIZE', options: QUANTIZE_OPTIONS, default: 1,
  description: 'Snaps sequencer pitch to a scale built on the VCO FREQ: 12-ET chromatic or 8-ET diatonic in equal temperament, 12-JI / 8-JI the same in just intonation. All LEDs dark = off (continuous pitch).',
  manualReference: 'p.27 – QUANTIZE',
};

// ---------------------------------------------------------------------------
// Sequencers (p.26)
// ---------------------------------------------------------------------------
const STEP_DEFAULTS = [[0, 58, 33, 83], [0, 25, 42, -42]];
for (const s of [1, 2]) {
  for (let i = 1; i <= 4; i++) {
    controls[`seq${s}_step${i}`] = {
      type: 'knob',
      label: `STEP ${i}`,
      description: `Sequencer ${s} step ${i} pitch offset (−100..+100 % of the SEQ OCT range, then quantized).`,
      min: -100, max: 100, default: STEP_DEFAULTS[s - 1][i - 1], units: 'none', bipolar: true,
      format: stepFormat,
      manualReference: 'p.26 – Sequencer STEP knobs',
    };
  }
}

// ---------------------------------------------------------------------------
// Polyrhythm generators (p.30)
// ---------------------------------------------------------------------------
const RHYTHM_DEFAULTS = [4, 3, 2, 5];
for (let r = 1; r <= 4; r++) {
  controls[`rhythm${r}`] = {
    type: 'knob',
    label: `RHYTHM ${r}`,
    description: `Rhythm generator ${r}: divides TEMPO by a whole number, ÷1 (fully clockwise) to ÷16 (fully counter-clockwise).`,
    min: -16, max: -1, step: 1, default: D(RHYTHM_DEFAULTS[r - 1]), units: 'none', format: divFormat,
    manualReference: 'p.30 – Polyrhythm Generators',
  };
  for (const s of [1, 2]) {
    controls[`rhythm${r}_seq${s}`] = {
      type: 'button', label: `SEQ ${s}`,
      default: (r === 1 && s === 1) || (r === 2 && s === 2),
      description: `Clock Sequencer ${s} from Rhythm ${r}. Several rhythms on one sequencer combine by the RHYTHM LOGIC.`,
      manualReference: 'p.30 – Rhythm SEQ 1 / SEQ 2 buttons',
    };
  }
}
controls.rhythm_logic = {
  type: 'switch', label: 'RHYTHM LOGIC', options: ['OR', 'XOR'], default: 0,
  description: 'How several rhythm generators assigned to one sequencer combine. OR: advance when any fires. XOR: advance only when exactly one fires (coincident hits cancel). A global parameter on the hardware (MIDI CC 113), shown here as a switch.',
  manualReference: 'p.41 – Global Parameters: Rhythm Generator Logic',
};

// ---------------------------------------------------------------------------
// Tempo & transport (p.28-29)
// ---------------------------------------------------------------------------
controls.tempo = {
  type: 'knob', label: 'TEMPO', min: 20, max: 3000, default: 240, units: 'BPM', curve: 'logarithmic', size: 'large',
  description: 'Master clock that the four rhythm generators divide. 0.333 Hz to 50 Hz (20 to 3000 BPM).',
  manualReference: 'p.28 – TEMPO',
};
controls.play = {
  type: 'button', label: 'PLAY', default: false, ledColor: '#ff3b30',
  description: 'Starts / stops the sequencers, the rhythm generators and the CLOCK output.',
  manualReference: 'p.28 – PLAY',
};
controls.reset = {
  type: 'button', label: 'RESET', momentary: true, default: false,
  description: 'Returns both sequencers to step 1 and realigns the rhythm generators. Hold it to keep the sequencers on step 1 while the rhythms keep triggering the EGs.',
  manualReference: 'p.28 – RESET',
};
controls.next = {
  type: 'button', label: 'NEXT', momentary: true, default: false,
  description: 'Advances both sequencers one step, stopped or running - handy for tuning steps.',
  manualReference: 'p.28 – NEXT',
};
controls.trigger = {
  type: 'button', label: 'TRIGGER', momentary: true, default: false,
  description: 'EG ON: restarts the envelopes. EG OFF: acts as a gate, holding the envelopes at maximum while pressed. EG HELD: no effect.',
  manualReference: 'p.29 – TRIGGER',
};
controls.eg_mode = {
  type: 'switch', label: 'EG', options: EG_OPTIONS, default: 1,
  description: 'ON (lit): the sequencers trigger the VCF and VCA envelopes. OFF (unlit): only TRIGGER / the TRIGGER jack fire them. HELD (blinking, hold the button): envelopes sit at maximum - a drone.',
  manualReference: 'p.29 – EG button',
};

// ---------------------------------------------------------------------------
// Filter, envelopes, VCA (p.23-25)
// ---------------------------------------------------------------------------
Object.assign(controls, {
  cutoff: {
    type: 'knob', label: 'CUTOFF', min: 20, max: 20000, default: 1800, units: 'Hz', curve: 'logarithmic', size: 'large',
    description: 'Cutoff frequency of the 24 dB/octave Moog ladder low-pass filter.',
    manualReference: 'p.23 – CUTOFF',
  },
  resonance: {
    type: 'knob', label: 'RESONANCE', min: 0, max: 100, default: 15, units: '%',
    description: 'Feeds the filter output back to its input, emphasising the cutoff. Near maximum the filter rings; like any ladder it thins the bass as it rises.',
    manualReference: 'p.23 – RESONANCE',
  },
  vcf_eg_amt: {
    type: 'knob', label: 'VCF EG AMT', min: -100, max: 100, default: 35, units: '%', bipolar: true,
    description: 'How far the VCF EG (or whatever is patched into the CUTOFF jack) moves the cutoff - up or, below centre, down.',
    manualReference: 'p.23 – VCF EG AMT',
  },
  volume: {
    type: 'knob', label: 'VOLUME', min: 0, max: 100, default: 70, units: '%',
    description: 'Output level.',
    manualReference: 'p.25 – VOLUME',
  },
  vcf_attack: {
    type: 'knob', label: 'VCF ATTACK', min: 1, max: 10000, default: 5, units: 'ms', curve: 'logarithmic',
    description: 'Time for the VCF EG to rise from the CUTOFF setting to the maximum set by EG AMT.',
    manualReference: 'p.24 – VCF ATTACK',
  },
  vcf_decay: {
    type: 'knob', label: 'VCF DECAY', min: 1, max: 10000, default: 350, units: 'ms', curve: 'logarithmic',
    description: 'Time for the VCF EG to fall back to the CUTOFF setting.',
    manualReference: 'p.24 – VCF DECAY',
  },
  vca_attack: {
    type: 'knob', label: 'VCA ATTACK', min: 1, max: 10000, default: 3, units: 'ms', curve: 'logarithmic',
    description: 'Fade-in time of each note.',
    manualReference: 'p.24 – VCA ATTACK',
  },
  vca_decay: {
    type: 'knob', label: 'VCA DECAY', min: 1, max: 10000, default: 450, units: 'ms', curve: 'logarithmic',
    description: 'Fade-out time of each note.',
    manualReference: 'p.24 – VCA DECAY',
  },
} satisfies Record<string, ControlSpec>);

// ---------------------------------------------------------------------------
// Patchbay: 32 points, 17 inputs + 15 outputs, 4 columns × 8 rows (p.31-35)
//   row 1  VCO 1 in   VCO 1 SUB in   VCO 1 PWM in   VCA out
//   row 2  VCO 1 out  VCO 1 SUB 1    VCO 1 SUB 2    VCA in
//   row 3  VCO 2 in   VCO 2 SUB in   VCO 2 PWM in   VCA EG out
//   row 4  VCO 2 out  VCO 2 SUB 1    VCO 2 SUB 2    CUTOFF in
//   row 5  PLAY in    RESET in       TRIGGER in     VCF EG out
//   row 6  RHYTHM 1   RHYTHM 2       RHYTHM 3       RHYTHM 4 (inputs)
//   row 7  SEQ 1      SEQ 1 CLK      SEQ 2          SEQ 2 CLK (outputs)
//   row 8  MIDI IN    CLOCK in       CLOCK out      TRIGGER out
// ---------------------------------------------------------------------------
type Pt = { id: string; label: string; signalType: 'audio' | 'cv' | 'gate' | 'trigger' | 'clock'; column: number; row: number; normalled?: string };
const IN: Pt[] = [
  { id: 'in_vco1', label: 'VCO 1', signalType: 'cv', column: 0, row: 0 },
  { id: 'in_vco1_sub', label: 'VCO 1 SUB', signalType: 'cv', column: 1, row: 0 },
  { id: 'in_vco1_pwm', label: 'VCO 1 PWM', signalType: 'cv', column: 2, row: 0, normalled: 'out_vco1_sub1' },
  { id: 'in_vca', label: 'VCA', signalType: 'cv', column: 3, row: 1, normalled: 'out_vca_eg' },
  { id: 'in_vco2', label: 'VCO 2', signalType: 'cv', column: 0, row: 2, normalled: 'in_vco1' },
  { id: 'in_vco2_sub', label: 'VCO 2 SUB', signalType: 'cv', column: 1, row: 2 },
  { id: 'in_vco2_pwm', label: 'VCO 2 PWM', signalType: 'cv', column: 2, row: 2, normalled: 'out_vco2_sub1' },
  { id: 'in_cutoff', label: 'CUTOFF', signalType: 'cv', column: 3, row: 3, normalled: 'out_vcf_eg' },
  { id: 'in_play', label: 'PLAY', signalType: 'gate', column: 0, row: 4 },
  { id: 'in_reset', label: 'RESET', signalType: 'gate', column: 1, row: 4 },
  { id: 'in_trigger', label: 'TRIGGER', signalType: 'trigger', column: 2, row: 4 },
  { id: 'in_rhythm1', label: 'RHYTHM 1', signalType: 'cv', column: 0, row: 5 },
  { id: 'in_rhythm2', label: 'RHYTHM 2', signalType: 'cv', column: 1, row: 5 },
  { id: 'in_rhythm3', label: 'RHYTHM 3', signalType: 'cv', column: 2, row: 5 },
  { id: 'in_rhythm4', label: 'RHYTHM 4', signalType: 'cv', column: 3, row: 5 },
  { id: 'in_midi', label: 'MIDI IN', signalType: 'gate', column: 0, row: 7 },
  { id: 'in_clock', label: 'CLOCK', signalType: 'clock', column: 1, row: 7 },
];
const OUT: Pt[] = [
  { id: 'out_vca', label: 'VCA', signalType: 'audio', column: 3, row: 0 },
  { id: 'out_vco1', label: 'VCO 1', signalType: 'audio', column: 0, row: 1 },
  { id: 'out_vco1_sub1', label: 'VCO 1 SUB 1', signalType: 'audio', column: 1, row: 1 },
  { id: 'out_vco1_sub2', label: 'VCO 1 SUB 2', signalType: 'audio', column: 2, row: 1 },
  { id: 'out_vca_eg', label: 'VCA EG', signalType: 'cv', column: 3, row: 2 },
  { id: 'out_vco2', label: 'VCO 2', signalType: 'audio', column: 0, row: 3 },
  { id: 'out_vco2_sub1', label: 'VCO 2 SUB 1', signalType: 'audio', column: 1, row: 3 },
  { id: 'out_vco2_sub2', label: 'VCO 2 SUB 2', signalType: 'audio', column: 2, row: 3 },
  { id: 'out_vcf_eg', label: 'VCF EG', signalType: 'cv', column: 3, row: 4 },
  { id: 'out_seq1', label: 'SEQ 1', signalType: 'cv', column: 0, row: 6 },
  { id: 'out_seq1_clk', label: 'SEQ 1 CLK', signalType: 'clock', column: 1, row: 6 },
  { id: 'out_seq2', label: 'SEQ 2', signalType: 'cv', column: 2, row: 6 },
  { id: 'out_seq2_clk', label: 'SEQ 2 CLK', signalType: 'clock', column: 3, row: 6 },
  { id: 'out_clock', label: 'CLOCK', signalType: 'clock', column: 2, row: 7 },
  { id: 'out_trigger', label: 'TRIGGER', signalType: 'trigger', column: 3, row: 7 },
];

/** Patchbay grid in panel order, for the layout */
export const PATCH_GRID = [...IN, ...OUT].map(p => ({ id: p.id, col: p.column, row: p.row }));

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
const presets: Record<string, PresetSpec> = {
  init: {
    name: 'Init: two sequences, 4 against 3',
    description: 'Rhythm 1 (÷4) clocks Sequencer 1, Rhythm 2 (÷3) clocks Sequencer 2.',
    source: 'factory',
    settings: {},
  },
  undertone_drone: {
    name: 'Undertone Drone',
    description: 'EG HELD, no sequencing: VCO 1 with SUB 1 ÷3 and SUB 2 ÷5, VCO 2 a fifth up with its own subs - a slow-beating undertone chord.',
    source: 'community',
    settings: {
      eg_mode: 2, vco1_freq: 523.25, vco1_sub1_freq: D(3), vco1_sub2_freq: D(5),
      vco2_freq: 784, vco2_sub1_freq: D(4), vco2_sub2_freq: D(6),
      vco1_level: 45, vco1_sub1_level: 70, vco1_sub2_level: 55, vco2_level: 30, vco2_sub1_level: 50, vco2_sub2_level: 45,
      vco1_wave: 2, vco2_wave: 1, cutoff: 1400, resonance: 25, vcf_eg_amt: 0, volume: 65,
    },
  },
  three_against_four: {
    name: '3 Against 4',
    description: 'Rhythm 3 (÷3) drives Sequencer 1, Rhythm 4 (÷4) drives Sequencer 2: the two lines meet every 12 clocks.',
    source: 'community',
    settings: {
      tempo: 420, rhythm1: D(1), rhythm2: D(1), rhythm3: D(3), rhythm4: D(4),
      rhythm1_seq1: false, rhythm2_seq2: false, rhythm3_seq1: true, rhythm4_seq2: true,
      vco1_freq: 261.63, vco2_freq: 523.25, vco2_level: 45, vco2_sub1_level: 30, vco2_sub1_freq: D(2),
      seq1_step1: 0, seq1_step2: 25, seq1_step3: 58, seq1_step4: 42,
      seq2_step1: 0, seq2_step2: -17, seq2_step3: 33, seq2_step4: 58,
      quantize: 2, cutoff: 1500, vcf_eg_amt: 45, vcf_decay: 220, vca_decay: 300,
    },
  },
  just_arp: {
    name: 'Just Intonation Arp',
    description: '12-JI quantize with the subs on simple ratios, so the sequence and the undertones share one harmonic grid - no beating.',
    source: 'community',
    settings: {
      quantize: 3, seq_oct: 0, tempo: 600, rhythm1: D(2), rhythm2: D(3),
      vco1_sub1_freq: D(2), vco1_sub2_freq: D(3), vco1_level: 50, vco1_sub1_level: 45, vco1_sub2_level: 40,
      vco2_freq: 392, vco2_level: 35, vco2_sub1_freq: D(2), vco2_sub1_level: 35,
      seq1_step1: 0, seq1_step2: 33, seq1_step3: 58, seq1_step4: 83,
      seq2_step1: 0, seq2_step2: 42, seq2_step3: 25, seq2_step4: 58,
      vco1_wave: 1, cutoff: 2200, resonance: 30, vcf_eg_amt: 30, vca_decay: 250,
    },
  },
  sub_melody: {
    name: 'Undertone Melody',
    description: 'Sequencer 1 changes only the SUB 1 divisor (OSC off): the melody walks down the undertone series while VCO 1 stays put.',
    source: 'community',
    settings: {
      seq1_osc: false, seq1_sub1: true, vco1_freq: 1046.5, vco1_level: 20, vco1_sub1_level: 80, vco1_sub2_level: 0,
      vco1_sub1_freq: D(8), seq1_step1: 0, seq1_step2: 100, seq1_step3: 50, seq1_step4: -60, seq_oct: 1, quantize: 0,
      tempo: 360, rhythm1: D(2), rhythm2_seq2: false, cutoff: 2500, vcf_eg_amt: 25, vca_decay: 380,
    },
  },
  pwm_envelope: {
    name: 'Envelope PWM (cable)',
    description: 'VCF EG patched into VCO 1 PWM in the SQ/SAW wave position: every note sweeps the pulse width.',
    source: 'manual',
    settings: {
      vco1_wave: 1, vco1_level: 75, vco1_sub1_level: 30, vco1_sub2_level: 0, vcf_decay: 700, vcf_eg_amt: 20, cutoff: 2600,
      tempo: 300, rhythm1: D(2), rhythm2_seq2: false, vca_decay: 650,
    },
    patchConnections: [{ from: 'out_vcf_eg', to: 'in_vco1_pwm' }],
  },
  seq_filter: {
    name: 'Sequenced Filter (cable)',
    description: 'SEQ 2 drives the CUTOFF jack (replacing the VCF EG, scaled by EG AMT) while Sequencer 1 plays the notes - two different rhythms in pitch and tone.',
    source: 'community',
    settings: {
      seq2_osc: false, vco2_level: 0, rhythm2: D(3), rhythm1: D(2), vcf_eg_amt: 70, cutoff: 500, resonance: 55,
      seq2_step1: -80, seq2_step2: 20, seq2_step3: 90, seq2_step4: -10, seq_oct: 1, quantize: 0, tempo: 480,
    },
    patchConnections: [{ from: 'out_seq2', to: 'in_cutoff' }],
  },
  clock_chaos: {
    name: 'Shifting Rhythms (cables)',
    description: 'EG OFF with CLOCK patched into TRIGGER: every tempo beat articulates a note while the pitches change at the rhythm rates, and SEQ 1 modulates the RHYTHM 3 division - a generative polyrhythm.',
    source: 'community',
    settings: {
      tempo: 540, rhythm1: D(3), rhythm2: D(4), rhythm3: D(5), rhythm3_seq1: true, rhythm2_seq2: false, rhythm4_seq2: true, rhythm4: D(7),
      vco2_level: 40, vco2_sub1_level: 25, quantize: 2, cutoff: 1600, vcf_eg_amt: 40, vca_decay: 120, vcf_decay: 120, eg_mode: 0,
    },
    patchConnections: [
      { from: 'out_seq1', to: 'in_rhythm3' },
      { from: 'out_clock', to: 'in_trigger' },
    ],
  },
  filter_fm: {
    name: 'Sub-Audio Filter FM (cable)',
    description: 'VCO 2 SUB 2 into CUTOFF: an audio-rate subharmonic frequency-modulates the ladder filter for growling sidebands.',
    source: 'community',
    settings: {
      vco2_freq: 523.25, vco2_sub2_freq: D(7), vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0, seq2_osc: false,
      cutoff: 900, resonance: 50, vcf_eg_amt: 30, vco1_sub1_level: 60, rhythm2_seq2: false,
    },
    patchConnections: [{ from: 'out_vco2_sub2', to: 'in_cutoff' }],
  },
};

export const SUBHARMONICON: DeviceSpec = {
  id: 'subharmonicon',
  name: 'Subharmonicon',
  manufacturer: 'Moog',
  year: 2020,
  description: 'Semi-modular polyrhythmic analog synthesizer: two VCOs, four subharmonic oscillators, two 4-step sequencers, four rhythm generators and a Moog ladder filter.',
  manualUrl: 'https://www.moogmusic.com/products/subharmonicon',
  dimensions: { width: 319, height: 128.5, depth: 133, eurorackHP: 60 },
  display: { width: 1220, height: 514, scale: 4 },
  signalFlow: [
    { id: 'oscillators', name: 'Oscillators & Subharmonics', order: 1, controls: ['vco1_freq', 'vco1_sub1_freq', 'vco1_sub2_freq', 'vco1_wave', 'vco2_freq', 'vco2_sub1_freq', 'vco2_sub2_freq', 'vco2_wave'] },
    { id: 'mixer', name: 'Mixer', order: 2, controls: ['vco1_level', 'vco1_sub1_level', 'vco1_sub2_level', 'vco2_level', 'vco2_sub1_level', 'vco2_sub2_level'] },
    { id: 'filter', name: 'Filter', order: 3, controls: ['cutoff', 'resonance', 'vcf_eg_amt', 'vcf_attack', 'vcf_decay'] },
    { id: 'vca', name: 'VCA', order: 4, controls: ['vca_attack', 'vca_decay', 'volume'] },
    { id: 'sequencers', name: 'Sequencers', order: 5, controls: ['seq_oct', 'quantize', 'seq1_osc', 'seq1_sub1', 'seq1_sub2', 'seq2_osc', 'seq2_sub1', 'seq2_sub2', ...[1, 2].flatMap(s => [1, 2, 3, 4].map(i => `seq${s}_step${i}`))] },
    { id: 'rhythm', name: 'Polyrhythm', order: 6, controls: ['tempo', 'rhythm_logic', ...[1, 2, 3, 4].flatMap(r => [`rhythm${r}`, `rhythm${r}_seq1`, `rhythm${r}_seq2`]), 'play', 'reset', 'next', 'trigger', 'eg_mode'] },
  ],
  controls,
  patchBay: {
    inputs: IN.map(p => ({ ...p, jackType: 'input' as const })),
    outputs: OUT.map(p => ({ ...p, jackType: 'output' as const })),
  },
  presets,
};
