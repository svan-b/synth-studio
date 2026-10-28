// ============================================================================
// MOOG MOTHER-32 (2015) - semi-modular analog synthesizer, 60 HP Eurorack.
// One VCO (saw / pulse), white noise, MIX, 4-pole ladder VCF (LP / HP), EG with
// a SUSTAIN switch, VCA (EG / ON), LFO (square / triangle), GLIDE, VC MIX, MULT,
// ASSIGN, a 13-key keyboard, a 32-step sequencer with 64 pattern memories and a
// 32-point patch bay (18 inputs, 14 outputs).
// Every control, range and normal is documented with sources and confidence in
// devices/mother32/REFERENCE.md. Presets live in ./presets.ts.
// ============================================================================

import type { DeviceSpec, KnobSpec, PatchPoint } from '@/types';
import { MOTHER32_PRESETS, DEFAULT_SEQUENCE } from './presets';
import { ASSIGN_SOURCES, DIVISIONS, DIV_DEFAULT, TEMPO_MODES } from './model';
import { STEPS } from './sequence';

const M = 'Manual v2';
const fmtGate = (v: number) => { const g = Math.round(v); return g >= 8 ? 'TIE' : `${g}/8`; };

const lane = (label: string, def: string, ref: string) => ({ type: 'pattern' as const, label, steps: STEPS, default: def, manualReference: ref });

const inp = (id: string, label: string, signalType: PatchPoint['signalType'], column: number, row: number, normalled?: string): PatchPoint =>
  ({ id, label, jackType: 'input', signalType, column, row, ...(normalled ? { normalled } : {}) });
const outp = (id: string, label: string, signalType: PatchPoint['signalType'], column: number, row: number): PatchPoint =>
  ({ id, label, jackType: 'output', signalType, column, row });

const knob = (k: Omit<KnobSpec, 'type'>): KnobSpec => ({ type: 'knob', ...k });

export const MOTHER32: DeviceSpec = {
  id: 'mother32',
  name: 'Mother-32',
  manufacturer: 'Moog',
  year: 2015,
  description: 'Semi-modular analog synthesizer with a 32-step sequencer and a 32-point patch bay',
  manualUrl: 'https://www.moogmusic.com/synthesizers/mother-32/',

  // 60 HP Eurorack panel (304.8 x 128.5 mm) in wooden end cheeks; the unit is 319.3 mm wide
  dimensions: { width: 319.3, height: 128.5, depth: 106.9, eurorackHP: 60 },
  display: { width: 1250, height: 527, scale: 4.1 },

  signalFlow: [
    { id: 'vco', name: 'VCO', order: 1, description: 'One oscillator: sawtooth and variable-width pulse, tuned by FREQUENCY and the keyboard CV (1 V/oct)',
      controls: ['frequency', 'vco_wave', 'pulse_width', 'glide'] },
    { id: 'vco_mod', name: 'VCO MOD', order: 2, description: 'The EG (or the VCO MOD jack) or the LFO, by an AMOUNT, to the pitch or the pulse width',
      controls: ['vco_mod_source', 'vco_mod_amount', 'vco_mod_dest'] },
    { id: 'mixer', name: 'Mixer', order: 3, description: 'MIX crossfades the VCO wave against NOISE (or EXT. AUDIO when patched)', controls: ['mix'] },
    { id: 'vcf', name: 'VCF', order: 4, description: '4-pole Moog ladder: resonant low-pass or (non-resonant) high-pass, 20 Hz - 20 kHz',
      controls: ['cutoff', 'resonance', 'vcf_mode', 'vcf_mod_source', 'vcf_mod_amount', 'vcf_mod_polarity'] },
    { id: 'eg', name: 'EG', order: 5, description: 'Attack and decay, with a SUSTAIN switch that holds the peak while the gate is high', controls: ['attack', 'decay', 'sustain'] },
    { id: 'vca', name: 'VCA', order: 6, description: 'Opened by the EG, or held ON for drones', controls: ['vca_mode', 'volume'] },
    { id: 'lfo', name: 'LFO', order: 7, description: 'Square and triangle, 0.1 Hz to 350 Hz', controls: ['lfo_rate', 'lfo_wave'] },
    { id: 'sequencer', name: 'Sequencer', order: 8, description: '32 steps with gate length, glide, ratchet, accent and rest per step; 64 patterns',
      controls: ['tempo', 'swing', 'run_stop', 'seq_mode', 'kb_octave'] },
    { id: 'utilities', name: 'Utilities', order: 9, description: 'VC MIX (crossfader, attenuator, VCA, offset), MULT and the ASSIGN output', controls: ['vc_mix', 'assign_source'] },
  ],

  controls: {
    // ---- Row 1 ----------------------------------------------------------------
    frequency: knob({
      label: 'FREQUENCY', min: -1, max: 1, default: 0, units: 'octaves', bipolar: true,
      description: 'Tunes the VCO up or down one octave from the centre. The keyboard, sequencer and 1V/OCT jack add their 1 V per octave on top: at the centre, 0 V is middle C (C4).',
      manualReference: `${M} p.11 - VCO FREQUENCY`,
    }),
    vco_wave: {
      type: 'switch', label: 'VCO WAVE', options: ['PULSE', 'SAW'], default: 1,
      description: 'Which wave goes to the mixer: PULSE (up) or SAW (down). Both are always at the VCO PULSE and VCO SAW jacks.',
      manualReference: `${M} p.11 - VCO WAVE`,
    },
    pulse_width: knob({
      label: 'PULSE WIDTH', min: 2, max: 98, default: 50, units: '%',
      description: 'Duty cycle of the pulse wave, about 2 % to 98 %. At the centre it is a square (odd harmonics only, hollow); thinner pulses are nasal and bright.',
      manualReference: `${M} p.11 - PULSE WIDTH`,
    }),
    mix: knob({
      label: 'MIX', min: 0, max: 100, default: 0, units: '%',
      description: 'Crossfades the VCO wave (fully left) against NOISE (fully right). A cable in EXT. AUDIO replaces the noise; MIX CV moves the crossfade.',
      manualReference: `${M} pp.47-48 - MIX`,
    }),
    cutoff: knob({
      label: 'CUTOFF', min: 20, max: 20000, default: 1200, units: 'Hz', curve: 'logarithmic',
      description: 'Filter cutoff, 20 Hz to 20 kHz. VCF MOD, accents and the VCF CUTOFF jack (1 V per octave) add to it.',
      manualReference: `${M} p.14 - CUTOFF`,
    }),
    resonance: knob({
      label: 'RESONANCE', min: 0, max: 100, default: 15, units: '%',
      description: 'Feedback around the ladder: a ringing peak at the cutoff. Past about 3 o\'clock the low-pass self-oscillates into a sine. In HI PASS mode there is no peak - turning it up brings the bass back instead.',
      manualReference: `${M} p.14 - RESONANCE`,
    }),
    vca_mode: {
      type: 'switch', label: 'VCA MODE', options: ['ON', 'EG'], default: 1,
      description: 'EG (down): the envelope opens the VCA for each note. ON (up): the VCA is held open - a drone that needs no gate.',
      manualReference: `${M} p.16 - VCA MODE`,
    },
    volume: knob({
      label: 'VOLUME', min: 0, max: 100, default: 70, units: '%',
      description: 'Output level, for the main output and the VCA jack.',
      manualReference: `${M} p.47 - VOLUME`,
    }),

    // ---- Row 2 ----------------------------------------------------------------
    glide: knob({
      label: 'GLIDE', min: 0, max: 2000, default: 0, units: 'ms', curve: 'exponential',
      description: 'Portamento: how long the pitch slides to a new note. Keyboard and MIDI notes always slide; sequencer steps slide only where glide is switched on for the step.',
      manualReference: `${M} p.26 - GLIDE`,
    }),
    vco_mod_source: {
      type: 'switch', label: 'VCO MOD SOURCE', options: ['EG', 'LFO'], default: 1,
      description: 'EG (up): the envelope - or whatever is patched into VCO MOD, which replaces it. LFO (down): the wave picked by LFO WAVE.',
      manualReference: `${M} p.12, p.49 - VCO MOD`,
    },
    vco_mod_amount: knob({
      label: 'VCO MOD AMOUNT', min: 0, max: 100, default: 0, units: '%',
      description: 'How much the selected source moves the pitch or the pulse width. Small amounts of LFO are vibrato; the EG at full is a big pitch sweep.',
      manualReference: `${M} p.12 - VCO MOD AMOUNT`,
    }),
    vco_mod_dest: {
      type: 'switch', label: 'VCO MOD DEST', options: ['PW', 'FREQ'], default: 1,
      description: 'Where VCO modulation goes: PULSE WIDTH (up) or FREQUENCY (down).',
      manualReference: `${M} p.12 - VCO MOD DEST`,
    },
    vcf_mode: {
      type: 'switch', label: 'VCF MODE', options: ['HP', 'LP'], default: 1,
      description: 'LOW PASS (down) removes highs and resonates; HI PASS (up) removes lows and does not resonate.',
      manualReference: `${M} p.14 - VCF MODE`,
    },
    vcf_mod_source: {
      type: 'switch', label: 'VCF MOD SOURCE', options: ['EG', 'LFO'], default: 0,
      description: 'Modulation for the cutoff: the envelope (up) or the LFO wave picked by LFO WAVE (down).',
      manualReference: `${M} p.15 - VCF MOD SOURCE`,
    },
    vcf_mod_amount: knob({
      label: 'VCF MOD AMOUNT', min: 0, max: 100, default: 40, units: '%',
      description: 'How far the source moves the cutoff. POLARITY sets the direction.',
      manualReference: `${M} p.15 - VCF MOD AMOUNT`,
    }),
    vcf_mod_polarity: {
      type: 'switch', label: 'VCF MOD POLARITY', options: ['+', '−'], default: 0,
      description: '+ (up): the modulation opens the filter. − (down): it closes it - the envelope then sweeps downward.',
      manualReference: `${M} p.15 - VCF MOD POLARITY`,
    },

    // ---- Row 3 ----------------------------------------------------------------
    tempo: knob({
      label: 'TEMPO', min: 20, max: 300, default: 120, units: 'BPM', curve: 'logarithmic',
      description: 'Sequencer tempo, 20-300 BPM (16th-note steps by default). While a step is edited it sets that step\'s GATE LENGTH; with SHIFT, SWING; when the studio clock drives the sequencer, the step division.',
      manualReference: `${M} p.54 - TEMPO / GATE LENGTH`,
    }),
    lfo_rate: knob({
      label: 'LFO RATE', min: 0.1, max: 350, default: 4, units: 'Hz', curve: 'logarithmic',
      description: 'LFO speed, about 0.1 Hz to 350 Hz - the top end is audio rate. The LFO RATE jack adds 1 V per octave, up to 600 Hz.',
      manualReference: `${M} p.13 - LFO RATE`,
    }),
    lfo_wave: {
      type: 'switch', label: 'LFO WAVE', options: ['SQ', 'TRI'], default: 1,
      description: 'Which LFO wave feeds both MOD SOURCE switches: square (up) or triangle (down). Both are always at the LFO SQ and LFO TRI jacks.',
      manualReference: `${M} p.13 - LFO WAVE`,
    },
    attack: knob({
      label: 'ATTACK', min: 1.25, max: 3000, default: 2, units: 'ms', curve: 'logarithmic',
      description: 'How long the envelope takes to rise to its peak after a gate starts.',
      manualReference: `${M} p.15 - ATTACK`,
    }),
    sustain: {
      type: 'switch', label: 'SUSTAIN', options: ['ON', 'OFF'], default: 0,
      description: 'ON (up): the envelope holds its peak while the gate is high, then DECAY releases it; legato notes do not retrigger. OFF (down): attack then decay at once (AD); every note retriggers.',
      manualReference: `${M} p.16 - SUSTAIN`,
    },
    decay: knob({
      label: 'DECAY', min: 1.25, max: 7000, default: 400, units: 'ms', curve: 'logarithmic',
      description: 'How long the envelope takes to fall: after the attack (SUSTAIN OFF) or after the gate ends (SUSTAIN ON).',
      manualReference: `${M} p.16 - DECAY`,
    }),
    vc_mix: knob({
      label: 'VC MIX', min: 0, max: 100, default: 50, units: '%',
      description: 'Crossfades MIX 1 (left) and MIX 2 (right). With nothing patched, MIX 1 is 0 V and MIX 2 is +5 V, so VC MIX is a 0-5 V knob; patch one input and it is an attenuator.',
      manualReference: `${M} pp.50-51 - VC MIX`,
    }),

    // ---- Sequencer --------------------------------------------------------------
    run_stop: {
      type: 'button', label: 'RUN / STOP', default: false, ledColor: '#ff3b30',
      description: 'Starts and stops the sequencer (Space bar). Synced to the studio, it starts and stops the studio. SHIFT + RUN / STOP = REC; SHIFT held on it for a second = save the pattern.',
      manualReference: `${M} p.19 - RUN / STOP (REC)`,
    },
    shift: {
      type: 'button', label: 'SHIFT', default: false, ledColor: '#ffffff',
      description: 'Second functions (printed in brackets). Tap to latch it here; it lets go after the next button.',
      manualReference: `${M} p.34 - (SHIFT)`,
    },
    rec: {
      type: 'button', label: 'REC', default: false, ledColor: '#ff3b30',
      description: 'KB-mode recording (SHIFT + RUN / STOP): each key stores a note and moves on; HOLD / REST stores a rest.',
      manualReference: `${M} p.19 - Creating a pattern in KB mode`,
    },
    seq_mode: {
      type: 'switch', label: 'MODE', options: ['KB', 'STEP'], default: 0,
      description: 'KB mode (SHIFT + KB): the keys play, record and transpose. STEP mode (SHIFT + STEP): the pads switch steps on and off; SHIFT + a pad edits that step.',
      manualReference: `${M} p.31 - Step mode`,
    },
    kb_octave: {
      type: 'switch', label: 'OCTAVE', options: ['1', '2', '3', '4', '5', '6', '7', '8'], default: 3,
      description: 'Keyboard octave, shown by the OCTAVE / LOCATION LEDs. Change it with the KB and STEP arrows.',
      manualReference: `${M} p.34 - (KB) / (STEP)`,
    },
    swing: knob({
      label: 'SWING', min: 25, max: 75, default: 50, units: '%',
      description: 'SHIFT + TEMPO: delays every second step. 50 % is straight; about 66 % is a triplet shuffle.',
      manualReference: `${M} p.19 - (SWING)`,
    }),
    step_div: knob({
      label: 'CLOCK DIV', min: 0, max: 23, default: DIV_DEFAULT, units: 'none',
      format: v => DIVISIONS[Math.max(0, Math.min(23, Math.round(v)))].name,
      description: 'How long each step is: 1/16 by default. When the studio clock drives the sequencer, the TEMPO knob selects it (24 straight, dotted and triplet values).',
      manualReference: 'Firmware 2.0 addendum - clock divisions',
    }),
    seq_length: knob({
      label: 'LENGTH', min: 1, max: STEPS, default: DEFAULT_SEQUENCE.seq_length, units: 'steps',
      format: v => `${Math.round(v)} steps`,
      description: 'Pattern length (STEP mode: SET END + a step).',
      manualReference: `${M} p.31 - SET END`,
    }),
    step_gate: knob({
      label: 'GATE LENGTH', min: 1, max: 8, default: 4, units: 'none', format: fmtGate,
      description: 'The edited step\'s gate length, in eighths of a step; 8/8 ties into the next step. Needs SUSTAIN ON to be heard.',
      manualReference: `${M} p.25 - Gate Length`,
    }),
    step_glide: knob({
      label: 'GLIDE ON/OFF', min: 0, max: 100, default: 0, units: '%', format: v => (v > 0.5 ? 'GLIDE ON' : 'OFF'),
      description: 'While a step is edited, any clockwise GLIDE setting turns glide on for it; fully counter-clockwise turns it off.',
      manualReference: `${M} p.26 - Glide`,
    }),
    step_ratchet: knob({
      label: 'RATCHET', min: 1, max: 4, default: 1, units: 'none', format: v => `${Math.round(v)}x`,
      description: 'SHIFT + GLIDE while a step is edited: how many notes the step plays (1-4).',
      manualReference: `${M} p.26 - Ratchet`,
    }),

    // ---- Setup mode (SHIFT + RESET + SET END + STEP 8 on the hardware) ------------
    assign_source: {
      type: 'switch', label: 'ASSIGN', options: ASSIGN_SOURCES, default: 1,
      description: 'Setup page 1: what the ASSIGN jack sends. Factory default: the sequencer CLOCK, one pulse per step.',
      manualReference: `${M} p.52, p.59 - Assignable output`,
    },
    tempo_mode: {
      type: 'switch', label: 'TEMPO IN', options: TEMPO_MODES, default: 1,
      description: 'Setup page 3: what the TEMPO jack does. CLOCK ADVANCE (default): one step per rising edge.',
      manualReference: `${M} p.55, p.59 - TEMPO input modes`,
    },

    // ---- The pattern (hidden lanes, one character per step; see sequence.ts) ------
    seq_notes: lane('Pattern notes', DEFAULT_SEQUENCE.seq_notes, `${M} p.19`),
    seq_accent: lane('Pattern accents', DEFAULT_SEQUENCE.seq_accent, `${M} p.24`),
    seq_gate: lane('Pattern gate lengths', DEFAULT_SEQUENCE.seq_gate, `${M} p.25`),
    seq_glide: lane('Pattern glides', DEFAULT_SEQUENCE.seq_glide, `${M} p.26`),
    seq_ratchet: lane('Pattern ratchets', DEFAULT_SEQUENCE.seq_ratchet, `${M} p.26`),
    seq_rest: lane('Pattern rests', DEFAULT_SEQUENCE.seq_rest, `${M} p.24`),
  },

  // The patch bay: 4 columns x 8 rows, in Moog's reading order ([boxed] = output).
  //   EXT. AUDIO   MIX CV      VCA CV       [VCA]
  //   [NOISE]      VCF CUTOFF  VCF RES.     [VCF]
  //   VCO 1V/OCT   VCO LIN FM  [VCO SAW]    [VCO PULSE]
  //   VCO MOD      LFO RATE    [LFO TRI]    [LFO SQ]
  //   MIX 1        MIX 2       VC MIX CTRL  [VC MIX]
  //   MULT         [MULT 1]    [MULT 2]     [ASSIGN]
  //   GATE         [EG]        [KB]         [GATE]
  //   TEMPO        RUN/STOP    RESET        HOLD
  patchBay: {
    inputs: [
      inp('in_ext_audio', 'EXT. AUDIO', 'audio', 0, 0, 'out_noise'),
      inp('in_mix_cv', 'MIX CV', 'cv', 1, 0),
      inp('in_vca_cv', 'VCA CV', 'cv', 2, 0),
      inp('in_vcf_cutoff', 'VCF CUTOFF', 'cv', 1, 1),
      inp('in_vcf_res', 'VCF RES.', 'cv', 2, 1),
      inp('in_vco_1voct', 'VCO 1V/OCT', 'cv', 0, 2),
      inp('in_vco_lin_fm', 'VCO LIN FM', 'cv', 1, 2),
      inp('in_vco_mod', 'VCO MOD', 'cv', 0, 3, 'out_eg'),
      inp('in_lfo_rate', 'LFO RATE', 'cv', 1, 3),
      inp('in_mix1', 'MIX 1', 'cv', 0, 4),
      inp('in_mix2', 'MIX 2', 'cv', 1, 4),
      inp('in_vc_mix_ctrl', 'VC MIX CTRL', 'cv', 2, 4),
      inp('in_mult', 'MULT', 'cv', 0, 5),
      inp('in_gate', 'GATE', 'gate', 0, 6),
      inp('in_tempo', 'TEMPO', 'clock', 0, 7),
      inp('in_run_stop', 'RUN/STOP', 'gate', 1, 7),
      inp('in_reset', 'RESET', 'trigger', 2, 7),
      inp('in_hold', 'HOLD', 'gate', 3, 7),
    ],
    outputs: [
      outp('out_vca', 'VCA', 'audio', 3, 0),
      outp('out_noise', 'NOISE', 'audio', 0, 1),
      outp('out_vcf', 'VCF', 'audio', 3, 1),
      outp('out_vco_saw', 'VCO SAW', 'audio', 2, 2),
      outp('out_vco_pulse', 'VCO PULSE', 'audio', 3, 2),
      outp('out_lfo_tri', 'LFO TRI', 'cv', 2, 3),
      outp('out_lfo_sq', 'LFO SQ', 'cv', 3, 3),
      outp('out_vc_mix', 'VC MIX', 'cv', 3, 4),
      outp('out_mult1', 'MULT 1', 'cv', 1, 5),
      outp('out_mult2', 'MULT 2', 'cv', 2, 5),
      outp('out_assign', 'ASSIGN', 'gate', 3, 5),
      outp('out_eg', 'EG', 'cv', 1, 6),
      outp('out_kb', 'KB', 'cv', 2, 6),
      outp('out_gate', 'GATE', 'gate', 3, 6),
    ],
  },

  presets: MOTHER32_PRESETS,
};
