// ============================================================================
// MOOG SUBHARMONICON (2020)
// Semi-modular polyrhythmic analog synthesizer, 60 HP: two VCOs with four
// subharmonic oscillators, a six-channel mixer, a 4-pole ladder filter, two
// AD envelopes, two 4-step sequencers, four rhythm generators and a 32-point
// patchbay. Every control, range and normal is documented with sources and
// confidence in devices/subharmonicon/REFERENCE.md; manual page numbers below
// are the Owner's Manual's printed folios (printed page = PDF page + 1).
// Presets live in ./presets.ts.
//
// Stored-value conventions (kept from v1 saves):
//   * SUB FREQ and RHYTHM knobs store the NEGATED divisor (-16..-1), so the knob
//     reads ÷16 fully counter-clockwise and ÷1 fully clockwise, as on the panel.
//     Use D(n) to write "divide by n".
//   * STEP knobs are -100..+100 % of the SEQ OCT range (12 o'clock = 0 V).
//   * TEMPO is BPM at the internal clock's 1 PPQ (manual p.25: .333-50 Hz =
//     20-3000 BPM). The knob is linear in Hz, so 12 o'clock is about 1510 BPM:
//     the only taper under which Moog's 20 patch sheets step at musical rates.
// ============================================================================

import type { ControlSpec, DeviceSpec, PatchPoint } from '@/types';
import { QUANTIZE_OPTIONS, SEQ_OCT_OPTIONS, VCO_MAX_HZ, VCO_MIN_HZ, noteOf } from './theory';
import { SUBHARMONICON_PRESETS } from './presets';

export { QUANTIZE_OPTIONS, SEQ_OCT_OPTIONS };

/** Divisor n (1..16) -> stored knob value */
export const D = (n: number) => -n;

const divFormat = (v: number) => `÷${Math.round(-v)}`;
const freqFormat = (v: number) => `${v >= 1000 ? `${(v / 1000).toFixed(2)}k` : Math.round(v)} ${noteOf(v)}`;

export const EG_OPTIONS = ['OFF', 'ON', 'HELD'];
/** Wave switch, top to bottom: UP square, MIDDLE pulse VCO with PWM from the SUB 1 saw (saw subs), DOWN saw */
export const WAVE_OPTIONS = ['SQR', 'PWM', 'SAW'];

const controls: Record<string, ControlSpec> = {};

// ---------------------------------------------------------------------------
// Oscillators (manual pp.18-20)
// ---------------------------------------------------------------------------
for (const v of [1, 2]) {
  controls[`vco${v}_freq`] = {
    type: 'knob',
    label: `VCO ${v} FREQ`,
    description: `Initial pitch of VCO ${v}, over four octaves: fully counter-clockwise is Middle C (262 Hz), fully clockwise the top C of a piano (4186 Hz). With QUANTIZE on it steps through the scale. Its two subharmonics divide this frequency, so they follow it.`,
    min: VCO_MIN_HZ,
    max: VCO_MAX_HZ,
    default: v === 1 ? VCO_MIN_HZ : 392,
    units: 'Hz',
    curve: 'logarithmic',
    size: 'large',
    format: freqFormat,
    manualReference: `p.${v === 1 ? 18 : 19} – VCO ${v} FREQ`,
  };
  for (const s of [1, 2]) {
    controls[`vco${v}_sub${s}_freq`] = {
      type: 'knob',
      label: `SUB ${s} FREQ`,
      description: `Subharmonic ${s} of VCO ${v}: the VCO's frequency divided by a whole number, from ÷1 (fully clockwise, unison) to ÷16 (fully counter-clockwise, four octaves down). ÷2 is an octave down, ÷3 an octave and a fifth, ÷4 two octaves, ÷5 two octaves and a major third. It counts the VCO's cycles, so it is always exactly in tune with it.`,
      min: -16,
      max: -1,
      step: 1,
      default: D(v === 1 ? (s === 1 ? 2 : 4) : s === 1 ? 3 : 4),
      units: 'none',
      format: divFormat,
      manualReference: `p.${v === 1 ? (s === 1 ? 18 : 19) : 20} – SUB ${s} FREQ`,
    };
  }
  controls[`vco${v}_wave`] = {
    type: 'switch',
    label: `VCO ${v} WAVE`,
    description: `Waveform of VCO ${v} and its subs. Up: square on all three (hollow, odd harmonics). Middle: the VCO is a square whose pulse width is swept by SUB 1's sawtooth (or the VCO ${v} PWM jack), the subs are sawtooths. Down: sawtooth on all three (bright, every harmonic).`,
    options: WAVE_OPTIONS,
    default: 2,
    manualReference: `p.${v === 1 ? 19 : 20} – Waveform switch`,
  };
  // Mixer (pp.21-22)
  controls[`vco${v}_level`] = {
    type: 'knob', label: `VCO ${v} LEVEL`, min: 0, max: 100, default: v === 1 ? 60 : 40, units: '%', size: 'medium',
    description: `Level of VCO ${v} in the mixer. Several sources near the top push the mixer into a warm distortion; moderate levels stay clean.`,
    manualReference: `p.${v === 1 ? 21 : 22} – Mixer`,
  };
  for (const s of [1, 2]) {
    controls[`vco${v}_sub${s}_level`] = {
      type: 'knob', label: `SUB ${s} LEVEL`, min: 0, max: 100, default: v === 1 ? (s === 1 ? 50 : 35) : 0, units: '%', size: 'medium',
      description: `Level of VCO ${v}'s SUB ${s} in the mixer.`,
      manualReference: 'p.22 – Mixer',
    };
  }
}

// SEQ ASSIGN (p.26-27): what each sequencer's four steps move
for (const s of [1, 2]) {
  controls[`seq${s}_osc`] = {
    type: 'button', label: `OSC ${s}`, default: true,
    description: `Sequencer ${s} plays VCO ${s}'s pitch. Its subharmonics follow, because they divide it.`,
    manualReference: `p.${s === 1 ? 26 : 27} – SEQ ${s} ASSIGN`,
  };
  controls[`seq${s}_sub1`] = {
    type: 'button', label: 'SUB 1', default: false,
    description: `Sequencer ${s} changes the whole-number value of VCO ${s}'s SUB 1 FREQ knob, so SUB 1 walks the undertone series while the VCO stays put.`,
    manualReference: `p.${s === 1 ? 26 : 27} – SEQ ${s} ASSIGN`,
  };
  controls[`seq${s}_sub2`] = {
    type: 'button', label: 'SUB 2', default: false,
    description: `Sequencer ${s} changes the whole-number value of VCO ${s}'s SUB 2 FREQ knob.`,
    manualReference: `p.${s === 1 ? 26 : 27} – SEQ ${s} ASSIGN`,
  };
}

controls.seq_oct = {
  type: 'switch', label: 'SEQ OCT', options: SEQ_OCT_OPTIONS, default: 0,
  description: 'How far each STEP knob reaches above and below the VCO FREQ setting: ±1, ±2 or ±5 octaves, shared by both sequencers. For the full ±5, set both VCO FREQ knobs fully counter-clockwise. Press to cycle; press and hold until the LED flashes to free the SEQ jacks (OUT ±5 beside it does the same).',
  manualReference: 'p.28 – SEQ OCT',
};
controls.quantize = {
  type: 'switch', label: 'QUANTIZE', options: QUANTIZE_OPTIONS, default: 1,
  description: 'Snaps the VCO FREQ knobs and the sequencer steps to a scale on C: 12-ET chromatic or 8-ET major in equal temperament, 12-JI and 8-JI the same in just intonation (whole-number ratios, like the subharmonics). All LEDs dark = off: continuous pitch. Press to cycle; press and hold until the LED flashes to unquantize the SEQ jacks (OUT UNQ beside it does the same).',
  manualReference: 'p.21 – QUANTIZE',
};
// The two "held" modes (no separate panel control on the hardware: hold the button until its LED flashes)
controls.seq_oct_held = {
  type: 'button', label: 'SEQ OUT ±5', default: false,
  description: 'SEQ OCT held (its LED flashes): the SEQ 1 and SEQ 2 jacks always put out the full ±5 V range, whatever SEQ OCT is set to. The oscillators keep following SEQ OCT. Press and hold SEQ OCT again, or tap here, to return.',
  manualReference: 'p.28 – SEQ OCT (hold)',
};
controls.quantize_held = {
  type: 'button', label: 'SEQ OUT UNQ', default: false,
  description: 'QUANTIZE held (its LED flashes): the SEQ 1 and SEQ 2 jacks put out unquantized voltages, while the oscillators stay quantized. Press and hold QUANTIZE again, or tap here, to return.',
  manualReference: 'p.21 – QUANTIZE (hold)',
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
      description: `Sequencer ${s}, step ${i}: an offset from the VCO FREQ setting. 12 o'clock is 0 V; fully clockwise is the whole SEQ OCT range up (+100), fully counter-clockwise the whole range down. With SEQ OCT ±1 one semitone is about 8.3.`,
      min: -100, max: 100, default: STEP_DEFAULTS[s - 1][i - 1], units: '%', bipolar: true, size: 'small',
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
    description: `Rhythm generator ${r}: divides the clock by a whole number, ÷1 (fully clockwise, every count) to ÷16 (fully counter-clockwise). Its SEQ 1 and SEQ 2 buttons choose which sequencer it steps.`,
    min: -16, max: -1, step: 1, default: D(RHYTHM_DEFAULTS[r - 1]), units: 'none', size: 'small', format: divFormat,
    manualReference: 'p.30 – Polyrhythm Generators',
  };
  for (const s of [1, 2]) {
    controls[`rhythm${r}_seq${s}`] = {
      type: 'button', label: `SEQ ${s}`,
      default: (r === 1 && s === 1) || (r === 2 && s === 2),
      description: `Lit: rhythm generator ${r} steps Sequencer ${s}. Several generators on one sequencer combine by the rhythm logic (OR, or XOR).`,
      manualReference: 'p.30 – Rhythm SEQ 1 / SEQ 2 buttons',
    };
  }
}
controls.rhythm_logic = {
  type: 'switch', label: 'RHYTHM LOGIC', options: ['OR', 'XOR'], default: 0,
  description: 'How several rhythm generators on one sequencer combine. OR: it steps when any of them fires (once, even if several coincide). XOR: only when exactly one fires - coinciding hits cancel. A global setting on the hardware (MIDI CC 113).',
  manualReference: 'p.44 – MIDI CC 113: Rhythm Generator Logic',
};

// ---------------------------------------------------------------------------
// Tempo and transport (pp.25, 28-30)
// ---------------------------------------------------------------------------
controls.tempo = {
  type: 'knob', label: 'TEMPO', min: 20, max: 3000, default: 480, units: 'BPM', curve: 'linear', size: 'large',
  format: v => `${Math.round(v)} BPM`,
  description: 'The master clock the four rhythm generators divide: .333 Hz to 50 Hz, one count per beat (20 to 3000 BPM). The knob is linear, so 12 o\'clock is about 1510 BPM and musical tempos sit in its first quarter: 480 BPM counts 16th notes at 120. Ignored while a cable is in CLOCK or the studio clock runs (the studio clock counts 16th notes).',
  manualReference: 'p.25 – TEMPO',
};
controls.play = {
  type: 'button', label: 'PLAY', default: false, ledColor: '#ff3b30',
  description: 'Starts and stops the sequencers, the rhythm generators and the CLOCK output. In the studio it starts the studio clock.',
  manualReference: 'p.28 – PLAY',
};
controls.reset = {
  type: 'button', label: 'RESET', momentary: true, default: false,
  description: 'Returns both sequencers to step 1 and the rhythm generators to their starting point; the next clock count plays step 1. Hold it to keep the sequencers on step 1 while the rhythms keep firing the envelopes (NEXT while holding picks the held step).',
  manualReference: 'p.29 – RESET',
};
controls.next = {
  type: 'button', label: 'NEXT', momentary: true, default: false,
  description: 'Moves to the next step at once, without firing the envelopes - with PLAY off and EG held (blinking) it lets you tune each step by ear. It advances the rhythm generators until Sequencer 1 steps, so Sequencer 2 keeps its place in the polyrhythm.',
  manualReference: 'p.29 – NEXT',
};
controls.trigger = {
  type: 'button', label: 'TRIGGER', momentary: true, default: false,
  description: 'EG lit: restarts both envelopes at once, without waiting for the next step. EG unlit: a gate - the envelopes rise and hold at their maximum while you press it (a key held while the sequencers are stopped does the same). EG blinking: no effect.',
  manualReference: 'p.29 – TRIGGER',
};
controls.eg_mode = {
  type: 'switch', label: 'EG', options: EG_OPTIONS, default: 1,
  description: 'ON (lit): every sequencer step fires the VCF and VCA envelopes. OFF (unlit): only TRIGGER, the TRIGGER jack and keys fire them - and TRIGGER or a held key is then a gate, so the sound stays at full VOLUME until you let go, much louder than the short steps. HELD (press and hold until it blinks): both envelopes held open at maximum - a drone for tuning.',
  manualReference: 'p.29 – EG',
};

// ---------------------------------------------------------------------------
// Filter, envelopes, VCA (pp.23-25)
// ---------------------------------------------------------------------------
Object.assign(controls, {
  cutoff: {
    type: 'knob', label: 'CUTOFF', min: 20, max: 20000, default: 1800, units: 'Hz', curve: 'logarithmic', size: 'large',
    description: 'Cutoff of the 4-pole (24 dB/octave) Moog ladder low-pass filter, 20 Hz to 20 kHz. Harmonics above it are removed, so lower is darker.',
    manualReference: 'p.23 – CUTOFF',
  },
  resonance: {
    type: 'knob', label: 'RESONANCE', min: 0, max: 100, default: 15, units: '%', size: 'large',
    description: 'Feeds the filter output back to its input, boosting a narrow band at the cutoff. From about 2 o\'clock the filter rings and chirps; from about 3 o\'clock it sings a sine of its own, even with every mixer level down. Like any ladder, the bass thins as it rises.',
    manualReference: 'p.23 – RESONANCE',
  },
  vcf_eg_amt: {
    type: 'knob', label: 'VCF EG AMT', min: -100, max: 100, default: 35, units: '%', bipolar: true, size: 'large',
    description: 'How far the VCF envelope moves the cutoff. Centre: no effect. (+) opens the filter on the attack and closes it on the decay; (–) closes it on the attack.',
    manualReference: 'p.24 – VCF EG AMT',
  },
  volume: {
    type: 'knob', label: 'VOLUME', min: 0, max: 100, default: 70, units: '%', size: 'large',
    description: 'Output level: the VCA envelope rises to this level. It sets both the main output and the VCA jack.',
    manualReference: 'p.23 – VOLUME',
  },
  vcf_attack: {
    type: 'knob', label: 'VCF ATTACK', min: 1, max: 10000, default: 5, units: 'ms', curve: 'logarithmic', size: 'large',
    description: 'Time for the VCF envelope to rise from the CUTOFF setting to the peak set by VCF EG AMT: 1 ms to 10 s. While it rises, new triggers are ignored.',
    manualReference: 'p.24 – VCF ATTACK',
  },
  vcf_decay: {
    type: 'knob', label: 'VCF DECAY', min: 5, max: 10000, default: 350, units: 'ms', curve: 'logarithmic', size: 'large',
    description: 'Time for the VCF envelope to fall back to the CUTOFF setting: 5 ms to 10 s.',
    manualReference: 'p.24 – VCF DECAY',
  },
  vca_attack: {
    type: 'knob', label: 'VCA ATTACK', min: 1, max: 10000, default: 3, units: 'ms', curve: 'logarithmic', size: 'large',
    description: 'Fade-in of each note: 1 ms to 10 s. While it rises, new triggers are ignored - a long attack thins out the rhythm.',
    manualReference: 'p.24 – VCA ATTACK',
  },
  vca_decay: {
    type: 'knob', label: 'VCA DECAY', min: 5, max: 10000, default: 450, units: 'ms', curve: 'logarithmic', size: 'large',
    description: 'Fade-out of each note: 5 ms to 10 s. With EG off, a gate (TRIGGER held, or a key held while the sequencers are stopped) holds the note at full level until it ends.',
    manualReference: 'p.25 – VCA DECAY',
  },
} satisfies Record<string, ControlSpec>);

// ---------------------------------------------------------------------------
// Patchbay: 32 points, 17 inputs + 15 outputs, 4 columns x 8 rows (pp.31-37)
//   row 1  VCO 1 in    VCO 1 SUB in   VCO 1 PWM in   VCA out
//   row 2  VCO 1 out   SUB 1 out      SUB 2 out      VCA in
//   row 3  VCO 2 in    VCO 2 SUB in   VCO 2 PWM in   VCA EG out
//   row 4  VCO 2 out   SUB 1 out      SUB 2 out      CUTOFF in
//   row 5  PLAY in     RESET in       TRIGGER in     VCF EG out
//   row 6  RHYTHM 1    RHYTHM 2       RHYTHM 3       RHYTHM 4   (inputs)
//   row 7  SEQ 1       SEQ 1 CLK      SEQ 2          SEQ 2 CLK  (outputs)
//   row 8  MIDI IN     CLOCK in       CLOCK out      TRIGGER out
// ---------------------------------------------------------------------------
type Pt = Omit<PatchPoint, 'jackType'>;
const IN: Pt[] = [
  { id: 'in_vco1', label: 'VCO 1', signalType: 'cv', column: 0, row: 0 },
  { id: 'in_vco1_sub', label: 'VCO 1 SUB', signalType: 'cv', column: 1, row: 0 },
  { id: 'in_vco1_pwm', label: 'VCO 1 PWM', signalType: 'cv', column: 2, row: 0, normalled: 'out_vco1_sub1' },
  { id: 'in_vca', label: 'VCA', signalType: 'cv', column: 3, row: 1 },
  { id: 'in_vco2', label: 'VCO 2', signalType: 'cv', column: 0, row: 2, normalled: 'in_vco1' },
  { id: 'in_vco2_sub', label: 'VCO 2 SUB', signalType: 'cv', column: 1, row: 2 },
  { id: 'in_vco2_pwm', label: 'VCO 2 PWM', signalType: 'cv', column: 2, row: 2, normalled: 'out_vco2_sub1' },
  { id: 'in_cutoff', label: 'CUTOFF', signalType: 'cv', column: 3, row: 3 },
  { id: 'in_play', label: 'PLAY', signalType: 'gate', column: 0, row: 4 },
  { id: 'in_reset', label: 'RESET', signalType: 'trigger', column: 1, row: 4 },
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

export const SUBHARMONICON: DeviceSpec = {
  id: 'subharmonicon',
  name: 'Subharmonicon',
  manufacturer: 'Moog',
  year: 2020,
  description: 'Semi-modular polyrhythmic analog synthesizer: two VCOs with four subharmonic oscillators, two 4-step sequencers, four rhythm generators and a Moog ladder filter.',
  manualUrl: 'https://www.moogmusic.com/synthesizers/subharmonicon/',
  // 60 HP Eurorack panel (304.8 x 128.5 mm) between wood side pieces; the unit is 319.3 x 133 mm
  dimensions: { width: 319.3, height: 133, depth: 107, eurorackHP: 60 },
  display: { width: 1133, height: 456, scale: 3.55 },
  signalFlow: [
    { id: 'oscillators', name: 'Oscillators & subharmonics', description: 'Two VCOs, each with two integer-divider subharmonic oscillators', order: 1,
      controls: ['vco1_freq', 'vco1_sub1_freq', 'vco1_sub2_freq', 'vco1_wave', 'vco2_freq', 'vco2_sub1_freq', 'vco2_sub2_freq', 'vco2_wave'] },
    { id: 'mixer', name: 'Mixer', description: 'Six levels into the filter; warm distortion near the top', order: 2,
      controls: ['vco1_level', 'vco1_sub1_level', 'vco1_sub2_level', 'vco2_level', 'vco2_sub1_level', 'vco2_sub2_level'] },
    { id: 'filter', name: 'Filter', description: '4-pole Moog ladder low-pass with its own attack/decay envelope', order: 3,
      controls: ['cutoff', 'resonance', 'vcf_eg_amt', 'vcf_attack', 'vcf_decay'] },
    { id: 'vca', name: 'VCA', description: 'Amplifier with its own attack/decay envelope', order: 4,
      controls: ['vca_attack', 'vca_decay', 'volume'] },
    { id: 'sequencers', name: 'Sequencers', description: 'Two 4-step sequencers, assignable to each VCO and its subs', order: 5,
      controls: ['seq_oct', 'quantize', 'seq_oct_held', 'quantize_held', 'seq1_osc', 'seq1_sub1', 'seq1_sub2', 'seq2_osc', 'seq2_sub1', 'seq2_sub2', ...[1, 2].flatMap(s => [1, 2, 3, 4].map(i => `seq${s}_step${i}`))] },
    { id: 'rhythm', name: 'Polyrhythm & transport', description: 'Four tempo dividers that step the sequencers', order: 6,
      controls: ['tempo', 'rhythm_logic', ...[1, 2, 3, 4].flatMap(r => [`rhythm${r}`, `rhythm${r}_seq1`, `rhythm${r}_seq2`]), 'play', 'reset', 'next', 'trigger', 'eg_mode'] },
  ],
  controls,
  patchBay: {
    inputs: IN.map(p => ({ ...p, jackType: 'input' as const })),
    outputs: OUT.map(p => ({ ...p, jackType: 'output' as const })),
  },
  presets: SUBHARMONICON_PRESETS,
};
