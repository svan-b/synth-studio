// ============================================================================
// MOOG MOTHER-32 - Semi-modular analog synthesizer with 32-step sequencer
// 60 HP Eurorack, 3U. Single VCO (saw / pulse), white noise, 4-pole ladder
// VCF (LP / HP), AD(S) envelope, VCA, triangle / square LFO, glide,
// VC MIX and MULT utilities, assignable output, 13-key button keyboard and
// a 32-step sequencer. 32-point patch bay: 18 inputs, 14 outputs.
//
// Sources: Moog Mother-32 User's Manual (page numbers below follow the
// 60-page User's Manual: p.7 Setup & Connections, p.17 VC MIX / Patchbay
// overview, p.19 Creating a pattern in KB mode, p.31 Step mode, p.34 KB mode
// panel functions, p.36 Step mode panel functions, pp.39-42 Patchbay inputs
// and outputs, p.48 MIDI, p.49 Setup mode). Front-panel synthesis controls are
// described in the panel section (pp.8-17). Published specs: VCO 8 Hz-8 kHz,
// LFO 0.1-350 Hz, EG attack 1.25 ms-3 s, decay 1.25 ms-7 s, VCF 20 Hz-20 kHz.
// ============================================================================

import type { DeviceSpec, PatchPoint } from '@/types';
import { EMPTY_PATTERN, NO_ACCENTS, STEPS, makeAccents, makePattern } from './sequence';

const PANEL = 'pp.8–17 – Panel controls';
const PB = 'pp.39–42 – Patchbay';

// Default pattern: a 16-step bass line around C2 (null = rest)
const DEFAULT_NOTES = makePattern([36, 36, 48, 36, null, 39, 36, 43, 36, 36, 46, 36, 41, null, 43, 39]);
const DEFAULT_ACCENTS = makeAccents([1, 9]);

// The patch bay, in its 4 x 8 grid (column, row), reading left to right / top to bottom.
//   EXT AUDIO   MIX CV      VCA CV       [VCA]
//   [NOISE]     VCF CUTOFF  VCF RES      [VCF]
//   VCO 1V/OCT  VCO LIN FM  [VCO SAW]    [VCO PULSE]
//   VCO MOD     LFO RATE    [LFO TRI]    [LFO SQ]
//   MIX 1       MIX 2       VC MIX CTRL  [VC MIX]
//   MULT        [MULT 1]    [MULT 2]     [ASSIGN]
//   GATE        [EG]        [KB]         [GATE]
//   TEMPO       RUN/STOP    RESET        HOLD
// [boxed] = output. This order matches the manual's jack-by-jack listing of
// inputs (EXT AUDIO, MIX CV, VCA CV, VCF CUTOFF, VCF RES, VCO 1V/OCT ...) and
// outputs (VCA, NOISE, VCF, VCO SAW, VCO PULSE, LFO TRI, LFO SQ ...).
const inp = (id: string, label: string, signalType: PatchPoint['signalType'], column: number, row: number, normalled?: string): PatchPoint =>
  ({ id, label, jackType: 'input', signalType, column, row, ...(normalled ? { normalled } : {}) });
const outp = (id: string, label: string, signalType: PatchPoint['signalType'], column: number, row: number): PatchPoint =>
  ({ id, label, jackType: 'output', signalType, column, row });

export const MOTHER32: DeviceSpec = {
  id: 'mother32',
  name: 'Mother-32',
  manufacturer: 'Moog',
  year: 2015,
  description: 'Semi-modular analog synthesizer with a 32-step sequencer and 32-point patch bay',
  manualUrl: 'https://cdn.inmusicbrands.com/Moog/Mother32/Mother_32_Users_Manual.pdf',

  dimensions: { width: 304.8, height: 128.5, eurorackHP: 60 },
  display: { width: 1250, height: 527, scale: 4.1 },

  signalFlow: [
    { id: 'sequencer', name: 'Sequencer / Keyboard', order: 1, description: 'TEMPO, RUN/STOP, the 13-key keyboard and 32-step sequencer generate KB pitch CV and GATE',
      controls: ['tempo', 'gate_length', 'run_stop', 'shift', 'rec', 'seq_notes', 'seq_accent'] },
    { id: 'vco', name: 'VCO', order: 2, description: 'One VCO: sawtooth and variable-width pulse, with a modulation source/destination/amount section',
      controls: ['frequency', 'pulse_width', 'vco_wave', 'vco_mod_source', 'vco_mod_dest', 'vco_mod_amount', 'glide'] },
    { id: 'mixer', name: 'Mixer', order: 3, description: 'MIX crossfades between the selected VCO wave and NOISE (or EXT AUDIO)', controls: ['mix'] },
    { id: 'vcf', name: 'VCF', order: 4, description: '4-pole ladder filter, low-pass or high-pass', controls: ['cutoff', 'resonance', 'vcf_mode', 'vcf_mod_source', 'vcf_mod_amount'] },
    { id: 'vca', name: 'VCA / Output', order: 5, controls: ['vca_mode', 'volume'] },
    { id: 'eg', name: 'Envelope Generator', order: 6, controls: ['attack', 'decay', 'sustain'] },
    { id: 'lfo', name: 'LFO', order: 7, controls: ['lfo_rate', 'lfo_wave'] },
    { id: 'utilities', name: 'Utilities', order: 8, description: 'VC MIX (crossfader / attenuator / VCA), MULT, assignable output', controls: ['vc_mix', 'assign_source'] },
  ],

  controls: {
    // --- Sequencer / keyboard ----------------------------------------------
    tempo: {
      type: 'knob', label: 'TEMPO', min: 30, max: 300, default: 120, units: 'BPM', curve: 'logarithmic',
      description: 'Sequencer tempo (each step is a 16th note). Hold SHIFT to turn this knob into GATE LENGTH.',
      manualReference: 'p.34 – KB mode panel functions: TEMPO / GATE LENGTH',
    },
    gate_length: {
      type: 'knob', label: 'GATE LENGTH', min: 5, max: 100, default: 50, units: '%',
      description: 'SHIFT + TEMPO: how long each sequencer gate stays high, as a percentage of a step. 100% = legato.',
      manualReference: 'p.34 – KB mode panel functions: SHIFT + TEMPO',
    },
    run_stop: {
      type: 'button', label: 'RUN/STOP', default: false, ledColor: '#ff3b30',
      description: 'Starts and stops the sequencer (Space bar). SHIFT + RUN/STOP = REC (record a pattern from the keyboard).',
      manualReference: 'p.34 – KB mode panel functions: RUN/STOP',
    },
    shift: {
      type: 'button', label: 'SHIFT', default: false, ledColor: '#ffffff',
      description: 'Second functions: SHIFT + TEMPO = GATE LENGTH, SHIFT + RUN/STOP = REC. Latching here so it works with a mouse.',
      manualReference: 'p.34 – KB mode panel functions: SHIFT',
    },
    rec: {
      type: 'button', label: 'REC', default: false, ledColor: '#ff3b30',
      description: 'Pattern record (SHIFT + RUN/STOP): each key press stores a note and moves to the next step; HOLD/REST stores a rest.',
      manualReference: 'p.19 – Creating a pattern in KB mode',
    },
    seq_notes: { type: 'pattern', label: 'Pattern notes', steps: STEPS, default: DEFAULT_NOTES, manualReference: 'p.19 – Creating a pattern in KB mode' },
    seq_accent: { type: 'pattern', label: 'Pattern accents', steps: STEPS, default: DEFAULT_ACCENTS, manualReference: 'p.36 – Step mode panel functions: ACCENT' },

    // --- VCO ------------------------------------------------------------------
    frequency: {
      type: 'knob', label: 'FREQUENCY', min: -3, max: 3, default: 0, units: 'octaves', bipolar: true, size: 'large',
      description: 'VCO base pitch. The keyboard / sequencer CV (KB) is added to it at 1 V/octave.',
      manualReference: `${PANEL}: VCO FREQUENCY`,
    },
    pulse_width: {
      type: 'knob', label: 'PULSE WIDTH', min: 0, max: 100, default: 50, units: '%',
      description: 'Duty cycle of the pulse wave. 50% = square (odd harmonics only); narrow = thin and nasal.',
      manualReference: `${PANEL}: VCO PULSE WIDTH`,
    },
    vco_wave: {
      type: 'switch', label: 'VCO WAVE', options: ['SAW', 'PULSE'], default: 0,
      description: 'Which VCO waveform goes to the mixer. Both are always available at VCO SAW and VCO PULSE.',
      manualReference: `${PANEL}: VCO WAVE`,
    },
    vco_mod_source: {
      type: 'switch', label: 'VCO MOD SOURCE', options: ['EG', 'LFO'], default: 1,
      description: 'EG position: the envelope, or whatever is patched into VCO MOD. LFO position: the LFO wave selected by LFO WAVE.',
      manualReference: `${PANEL}: VCO MOD source; p.41 – VCO MOD input`,
    },
    vco_mod_dest: {
      type: 'switch', label: 'VCO MOD DEST', options: ['FREQ', 'PW'], default: 0,
      description: 'Where VCO modulation goes: pitch (FREQ) or pulse width (PW).',
      manualReference: `${PANEL}: VCO MOD destination`,
    },
    vco_mod_amount: {
      type: 'knob', label: 'VCO MOD AMOUNT', min: 0, max: 100, default: 0, units: '%',
      description: 'Depth of VCO modulation from the selected source.',
      manualReference: `${PANEL}: VCO MOD AMOUNT`,
    },
    glide: {
      type: 'knob', label: 'GLIDE', min: 0, max: 2000, default: 0, units: 'ms', curve: 'exponential',
      description: 'Portamento: how long the pitch takes to slide from one note to the next.',
      manualReference: `${PANEL}: GLIDE`,
    },

    // --- Mixer ----------------------------------------------------------------
    mix: {
      type: 'knob', label: 'MIX', min: 0, max: 100, default: 0, units: '%',
      description: 'Crossfade: fully left = VCO only, fully right = NOISE only (or EXT AUDIO when patched).',
      manualReference: `${PANEL}: MIX; p.39 – MIX CV input`,
    },

    // --- VCF ------------------------------------------------------------------
    cutoff: {
      type: 'knob', label: 'CUTOFF', min: 20, max: 20000, default: 1200, units: 'Hz', curve: 'logarithmic', size: 'large',
      description: 'Filter cutoff frequency (20 Hz – 20 kHz).',
      manualReference: `${PANEL}: VCF CUTOFF`,
    },
    resonance: {
      type: 'knob', label: 'RESONANCE', min: 0, max: 100, default: 15, units: '%',
      description: 'Feedback around the ladder: boosts frequencies at the cutoff. Near the top the filter self-oscillates.',
      manualReference: `${PANEL}: VCF RESONANCE`,
    },
    vcf_mode: {
      type: 'switch', label: 'VCF MODE', options: ['HP', 'LP'], default: 1,
      description: 'Low-pass (removes highs) or high-pass (removes lows).',
      manualReference: `${PANEL}: VCF MODE`,
    },
    vcf_mod_source: {
      type: 'switch', label: 'VCF MOD SOURCE', options: ['EG', 'LFO'], default: 0,
      description: 'Modulation source for the cutoff: the envelope or the LFO.',
      manualReference: `${PANEL}: VCF MOD source`,
    },
    vcf_mod_amount: {
      type: 'knob', label: 'VCF MOD AMOUNT', min: -100, max: 100, default: 40, units: '%', bipolar: true,
      description: 'Bipolar depth of cutoff modulation. Negative values sweep the cutoff down instead of up.',
      manualReference: `${PANEL}: VCF MOD AMOUNT`,
    },

    // --- VCA / output -----------------------------------------------------------
    vca_mode: {
      type: 'switch', label: 'VCA MODE', options: ['ON', 'EG'], default: 1,
      description: 'EG: the envelope opens the VCA for each note. ON: the VCA is fully open (drone).',
      manualReference: `${PANEL}: VCA MODE`,
    },
    volume: {
      type: 'knob', label: 'VOLUME', min: 0, max: 100, default: 70, units: '%',
      description: 'Output level.',
      manualReference: `${PANEL}: VOLUME`,
    },

    // --- EG -----------------------------------------------------------------------
    attack: {
      type: 'knob', label: 'ATTACK', min: 1.25, max: 3000, default: 2, units: 'ms', curve: 'logarithmic',
      description: 'Time for the envelope to rise to full level after a gate starts (1.25 ms – 3 s).',
      manualReference: `${PANEL}: EG ATTACK`,
    },
    decay: {
      type: 'knob', label: 'DECAY', min: 1.25, max: 7000, default: 400, units: 'ms', curve: 'logarithmic',
      description: 'With SUSTAIN OFF: time to fall back to zero. With SUSTAIN ON: the release time after the gate ends (1.25 ms – 7 s).',
      manualReference: `${PANEL}: EG DECAY`,
    },
    sustain: {
      type: 'switch', label: 'SUSTAIN', options: ['ON', 'OFF'], default: 0,
      description: 'ON: the envelope holds at full level while the gate is high, then decays when released. OFF: it decays even while held (AD).',
      manualReference: `${PANEL}: EG SUSTAIN`,
    },

    // --- LFO ------------------------------------------------------------------------
    lfo_rate: {
      type: 'knob', label: 'LFO RATE', min: 0.1, max: 350, default: 4, units: 'Hz', curve: 'logarithmic',
      description: 'LFO speed, 0.1 Hz – 350 Hz (the top of the range reaches audio rate).',
      manualReference: `${PANEL}: LFO RATE`,
    },
    lfo_wave: {
      type: 'switch', label: 'LFO WAVE', options: ['TRI', 'SQ'], default: 0,
      description: 'Which LFO wave the VCO MOD and VCF MOD sections use. Both are always at LFO TRI / LFO SQ.',
      manualReference: `${PANEL}: LFO WAVE`,
    },

    // --- Utilities -------------------------------------------------------------------
    vc_mix: {
      type: 'knob', label: 'VC MIX', min: 0, max: 100, default: 50, units: '%',
      description: 'Crossfades MIX 1 (left) to MIX 2 (right). With nothing patched MIX 1 = 0 V and MIX 2 = +5 V, so VC MIX outputs a 0–5 V offset.',
      manualReference: 'p.17 – VC MIX (voltage controlled mixer / attenuator)',
    },
    assign_source: {
      type: 'switch', label: 'ASSIGN', options: ['ACCENT', 'CLOCK'], default: 0,
      description: 'Stand-in for Setup mode: what the ASSIGN output sends. The hardware offers 16 sources; two sequencer sources are modelled.',
      manualReference: 'p.49 – Setup mode: Assignable output',
    },
  },

  patchBay: {
    inputs: [
      inp('in_ext_audio', 'EXT AUDIO', 'audio', 0, 0, 'out_noise'),
      inp('in_mix_cv', 'MIX CV', 'cv', 1, 0),
      inp('in_vca_cv', 'VCA CV', 'cv', 2, 0, 'out_eg'),
      inp('in_vcf_cutoff', 'VCF CUTOFF', 'cv', 1, 1),
      inp('in_vcf_res', 'VCF RES', 'cv', 2, 1),
      inp('in_vco_1voct', 'VCO 1V/OCT', 'cv', 0, 2, 'out_kb'),
      inp('in_vco_lin_fm', 'VCO LIN FM', 'audio', 1, 2),
      inp('in_vco_mod', 'VCO MOD', 'cv', 0, 3, 'out_eg'),
      inp('in_lfo_rate', 'LFO RATE', 'cv', 1, 3),
      inp('in_mix1', 'MIX 1', 'cv', 0, 4),
      inp('in_mix2', 'MIX 2', 'cv', 1, 4),
      inp('in_vc_mix_ctrl', 'VC MIX CTRL', 'cv', 2, 4),
      inp('in_mult', 'MULT', 'cv', 0, 5),
      inp('in_gate', 'GATE', 'gate', 0, 6, 'out_gate'),
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

  presets: {
    init: {
      name: 'Basic Patch (normalled)',
      description: 'The default patch: keyboard → VCO saw → ladder low-pass → VCA opened by the EG. No cables needed.',
      source: 'manual',
      settings: {},
    },
    pwm_lead: {
      name: 'PWM Lead',
      description: 'LFO sweeps the pulse width for a chorus-like, moving lead. Internal routing: VCO MOD = LFO → PW.',
      source: 'community',
      settings: {
        vco_wave: 1, pulse_width: 50, vco_mod_source: 1, vco_mod_dest: 1, vco_mod_amount: 55,
        lfo_rate: 0.9, lfo_wave: 0, cutoff: 2400, resonance: 20, vcf_mod_amount: 30, glide: 60,
        attack: 6, decay: 600, sustain: 0,
      },
    },
    acid_seq: {
      name: 'Acid Sequence',
      description: 'Resonant saw bass on the sequencer: short AD envelope on the filter, accents patched to the cutoff via ASSIGN.',
      source: 'community',
      settings: {
        vco_wave: 0, frequency: 0, cutoff: 260, resonance: 72, vcf_mod_amount: 55, vcf_mod_source: 0,
        sustain: 1, attack: 1.25, decay: 260, glide: 40, tempo: 124, gate_length: 55, assign_source: 0,
        seq_notes: makePattern([36, 36, 48, 36, 39, 36, 51, 36, 43, 36, 46, 48, 36, null, 41, 39]),
        seq_accent: makeAccents([3, 7, 11, 15]),
      },
      patchConnections: [{ from: 'out_assign', to: 'in_vcf_cutoff' }],
    },
    lfo_wobble: {
      name: 'LFO → Cutoff Wobble',
      description: 'LFO TRI patched to VCF CUTOFF adds a wobble on top of the envelope sweep (both modulate the filter at once).',
      source: 'community',
      settings: {
        vco_wave: 0, frequency: -1, cutoff: 500, resonance: 55, vcf_mod_source: 0, vcf_mod_amount: 20,
        lfo_rate: 3, sustain: 0, decay: 900,
      },
      patchConnections: [{ from: 'out_lfo_tri', to: 'in_vcf_cutoff' }],
    },
    eg_zap: {
      name: 'EG → Pitch Zaps',
      description: 'Envelope into the VCO 1V/OCT input replaces the keyboard CV: every note is a falling laser zap. Sequencer drives the gate.',
      source: 'community',
      settings: {
        vco_wave: 1, pulse_width: 30, frequency: 1, cutoff: 6000, resonance: 30, vcf_mod_amount: 20,
        sustain: 1, attack: 1.25, decay: 180, tempo: 100,
      },
      patchConnections: [{ from: 'out_eg', to: 'in_vco_1voct' }],
    },
    whistle_filter: {
      name: 'Self-Oscillating Filter (KB → MULT)',
      description: 'KB pitch CV is multed to both the VCO and the VCF CUTOFF, so the resonant filter tracks the keyboard and sings as a second oscillator.',
      source: 'community',
      settings: {
        vco_wave: 0, mix: 100, cutoff: 260, resonance: 98, vcf_mod_amount: 10, sustain: 0,
        attack: 30, decay: 1500, volume: 55,
      },
      patchConnections: [
        { from: 'out_kb', to: 'in_mult' },
        { from: 'out_mult1', to: 'in_vco_1voct' },
        { from: 'out_mult2', to: 'in_vcf_cutoff' },
      ],
    },
    delayed_vibrato: {
      name: 'Delayed Vibrato (VC MIX as VCA)',
      description: 'LFO into MIX 2 and the EG into VC MIX CTRL: the VC MIX output is LFO × EG, so vibrato fades in with the envelope. Patched into VCO MOD (source EG, dest FREQ).',
      source: 'community',
      settings: {
        vco_wave: 1, pulse_width: 40, vco_mod_source: 0, vco_mod_dest: 0, vco_mod_amount: 18,
        lfo_rate: 5.5, vc_mix: 0, attack: 1400, decay: 500, sustain: 0, cutoff: 3000, vcf_mod_amount: 10, glide: 80,
      },
      patchConnections: [
        { from: 'out_lfo_tri', to: 'in_mix2' },
        { from: 'out_eg', to: 'in_vc_mix_ctrl' },
        { from: 'out_vc_mix', to: 'in_vco_mod' },
      ],
    },
    audio_fm: {
      name: 'Audio-Rate LFO FM Bell',
      description: 'The LFO at audio rate into VCO LIN FM makes clangorous sidebands; the EG on the filter shapes it into a bell.',
      source: 'community',
      settings: {
        vco_wave: 0, lfo_rate: 262, lfo_wave: 0, cutoff: 900, resonance: 10, vcf_mod_amount: 65,
        sustain: 1, attack: 1.25, decay: 1800,
      },
      patchConnections: [{ from: 'out_lfo_tri', to: 'in_vco_lin_fm' }],
    },
    noise_drone: {
      name: 'Wind Drone (VCA ON)',
      description: 'VCA MODE ON makes a drone. Noise through a resonant filter, with the slow LFO sweeping it via VCF MOD.',
      source: 'community',
      settings: {
        mix: 100, cutoff: 700, resonance: 80, vcf_mod_source: 1, vcf_mod_amount: 45, lfo_rate: 0.15,
        vca_mode: 0, volume: 55,
      },
    },
    empty_pattern: {
      name: 'Blank Pattern (ready to record)',
      description: 'Clears the sequence so you can record your own with SHIFT + RUN/STOP.',
      source: 'manual',
      settings: { seq_notes: EMPTY_PATTERN, seq_accent: NO_ACCENTS },
    },
  },
};
