// ============================================================================
// MOOG DFAM - Drummer From Another Mother (2017)
// Semi-modular analog percussion synthesizer: 2 VCOs, noise / EXT AUDIO, mixer,
// 4-pole ladder (LP/HP), VCA, three decay envelopes, 8-step sequencer, 24 jacks.
// Every control, range and normal is documented with sources and confidence in
// devices/dfam/REFERENCE.md. Presets live in ./presets.ts.
// ============================================================================

import type { DeviceSpec, KnobSpec } from '@/types';
import { DFAM_PRESETS } from './presets';

const step = (n: number) => String(n);

/** Sequencer PITCH knobs: volts (1 V = 1 octave), shown in semitones so steps can be tuned by eye */
const formatPitch = (v: number) => {
  const st = v * 12;
  const r = Math.round(st);
  const shown = Math.abs(st - r) < 0.05 ? String(r) : st.toFixed(1);
  return `${st > 0.04 ? '+' : ''}${shown === '-0' ? '0' : shown} st`;
};

const pitchKnob = (n: number): KnobSpec => ({
  type: 'knob', label: `PITCH ${step(n)}`, min: -5, max: 5, default: 0, units: 'V', bipolar: true, size: 'small',
  format: formatPitch,
  description: `Step ${n} pitch: -5 V to +5 V (1 V = 1 octave, 12 semitones). Sent to the VCOs by SEQ PITCH MOD and always to the PITCH output.`,
  manualReference: 'Sequencer - PITCH 1-8',
});

const velocityKnob = (n: number): KnobSpec => ({
  type: 'knob', label: `VELOCITY ${step(n)}`, min: 0, max: 100, default: 100, units: '%', size: 'small',
  description: `Step ${n} velocity: 0-5 V. Sets how hard all three envelopes hit (level, and a little of their length). 0 silences the step.`,
  manualReference: 'Sequencer - VELOCITY 1-8',
});

export const DFAM: DeviceSpec = {
  id: 'dfam',
  name: 'DFAM',
  manufacturer: 'Moog',
  year: 2017,
  description: 'Drummer From Another Mother - semi-modular analog percussion synthesizer',
  manualUrl: 'https://www.moogmusic.com/synthesizers/dfam/',

  // 60 HP Eurorack panel (304.8 x 128.5 mm) in wooden end cheeks
  dimensions: { width: 319, height: 107, depth: 133, eurorackHP: 60 },
  display: { width: 960, height: 400, scale: 3.0 },

  signalFlow: [
    { id: 'oscillators', name: 'VCO 1 & VCO 2', description: 'Two oscillators (square or triangle) with 1→2 FM and hard sync', order: 1,
      controls: ['vco1_frequency', 'vco1_wave', 'vco2_frequency', 'vco2_wave', 'fm_amount', 'hard_sync'] },
    { id: 'vco_eg', name: 'VCO EG', description: 'Decay envelope that sweeps the pitch of both VCOs', order: 2,
      controls: ['vco_decay', 'vco1_eg_amount', 'vco2_eg_amount', 'seq_pitch_mod'] },
    { id: 'mixer', name: 'Mixer', description: 'VCO 1, VCO 2 and white noise (or EXT AUDIO) into the filter', order: 3,
      controls: ['vco1_level', 'noise_level', 'vco2_level'] },
    { id: 'filter', name: 'VCF', description: '4-pole transistor ladder, low-pass or high-pass, 20 Hz - 20 kHz', order: 4,
      controls: ['vcf_mode', 'vcf_cutoff', 'vcf_resonance', 'vcf_decay', 'vcf_eg_amount', 'noise_vcf_mod'] },
    { id: 'vca', name: 'VCA', description: 'Output amplifier with its own decay envelope (FAST or SLOW attack)', order: 5,
      controls: ['vca_attack_mode', 'vca_decay', 'volume'] },
    { id: 'sequencer', name: '8-step sequencer', description: 'Pitch and velocity per step, clocked by TEMPO or ADV/CLOCK', order: 6,
      controls: ['tempo', 'trigger', 'run_stop', 'advance',
        'pitch_1', 'pitch_2', 'pitch_3', 'pitch_4', 'pitch_5', 'pitch_6', 'pitch_7', 'pitch_8',
        'velocity_1', 'velocity_2', 'velocity_3', 'velocity_4', 'velocity_5', 'velocity_6', 'velocity_7', 'velocity_8'] },
  ],

  controls: {
    // ---- VCO EG ---------------------------------------------------------------
    vco_decay: {
      type: 'knob', label: 'VCO DECAY', min: 10, max: 10000, default: 100, units: 'ms', size: 'large', curve: 'logarithmic',
      description: 'Decay time of the VCO envelope (about 10 ms to 10 s). How fast the pitch sweep falls back. No effect while both VCO EG AMOUNT knobs are at noon.',
      manualReference: 'VCO EG - VCO DECAY',
    },
    seq_pitch_mod: {
      type: 'switch', label: 'SEQ PITCH MOD', options: ['VCO 1&2', 'OFF', 'VCO 2'], default: 0,
      description: 'Where the sequencer PITCH knobs go: both VCOs, nowhere (PITCH output only), or VCO 2 only - handy with FM or sync, so VCO 1 holds the root.',
      manualReference: 'VCO EG - SEQ PITCH MOD',
    },
    vco1_eg_amount: {
      type: 'knob', label: 'VCO 1 EG AMOUNT', min: -100, max: 100, default: 0, units: '%', bipolar: true, size: 'large',
      description: 'How far the VCO envelope bends VCO 1\'s pitch. Noon = none, clockwise = the pitch jumps up and falls (kick thump), counter-clockwise = it dips down and rises.',
      manualReference: 'VCO EG - VCO EG AMOUNT',
    },
    vco2_eg_amount: {
      type: 'knob', label: 'VCO 2 EG AMOUNT', min: -100, max: 100, default: 0, units: '%', bipolar: true, size: 'large',
      description: 'How far the VCO envelope bends VCO 2\'s pitch (bipolar, noon = none).',
      manualReference: 'VCO EG - VCO EG AMOUNT',
    },

    // ---- VCOs -------------------------------------------------------------------
    vco1_frequency: {
      type: 'knob', label: 'VCO 1 FREQUENCY', min: -5, max: 5, default: 0, units: 'octaves', bipolar: true, size: 'large',
      description: 'Starting pitch of VCO 1 over ten octaves (noon is about C3, 131 Hz). The VCO EG, sequencer and VCO 1 CV add to it.',
      manualReference: 'VCO section - VCO FREQUENCY',
    },
    vco1_wave: {
      type: 'switch', label: 'VCO 1 WAVE', options: ['SQR', 'TRI'], default: 1,
      description: 'VCO 1 waveform: square (up - hollow, buzzy, louder) or triangle (down - soft, nearly a sine).',
      manualReference: 'VCO section - waveform switch',
    },
    fm_amount: {
      type: 'knob', label: '1→2 FM AMOUNT', min: 0, max: 100, default: 0, units: '%', size: 'large',
      description: 'Linear frequency modulation of VCO 2 by VCO 1 at audio rate: sidebands for bells, clangs and metal. Clearest with HARD SYNC off.',
      manualReference: 'VCO section - 1→2 FM AMOUNT',
    },
    hard_sync: {
      type: 'switch', label: 'HARD SYNC', options: ['ON', 'OFF'], default: 1,
      description: 'ON resets VCO 2\'s cycle every time VCO 1 starts one: VCO 2 FREQUENCY then changes the tone, not the pitch. VCO 2 may go quiet if tuned below VCO 1.',
      manualReference: 'VCO section - HARD SYNC',
    },
    vco2_frequency: {
      type: 'knob', label: 'VCO 2 FREQUENCY', min: -5, max: 5, default: 0, units: 'octaves', bipolar: true, size: 'large',
      description: 'Starting pitch of VCO 2 over ten octaves. With HARD SYNC on it sets the timbre instead.',
      manualReference: 'VCO section - VCO FREQUENCY',
    },
    vco2_wave: {
      type: 'switch', label: 'VCO 2 WAVE', options: ['SQR', 'TRI'], default: 1,
      description: 'VCO 2 waveform: square (up) or triangle (down).',
      manualReference: 'VCO section - waveform switch',
    },

    // ---- Mixer ----------------------------------------------------------------------
    vco1_level: {
      type: 'knob', label: 'VCO 1 LEVEL', min: 0, max: 100, default: 75, units: '%', size: 'small',
      description: 'VCO 1 into the filter. High levels drive the ladder into warm saturation.',
      manualReference: 'Mixer - VCO 1 LEVEL',
    },
    noise_level: {
      type: 'knob', label: 'NOISE / EXT LEVEL', min: 0, max: 100, default: 0, units: '%', size: 'small',
      description: 'White noise into the filter - or the EXT AUDIO jack\'s signal when something is patched there. The NOISE LEVEL jack adds CV to this knob.',
      manualReference: 'Mixer - NOISE / EXT LEVEL',
    },
    vco2_level: {
      type: 'knob', label: 'VCO 2 LEVEL', min: 0, max: 100, default: 0, units: '%', size: 'small',
      description: 'VCO 2 into the filter.',
      manualReference: 'Mixer - VCO 2 LEVEL',
    },

    // ---- VCF ---------------------------------------------------------------------------
    vcf_mode: {
      type: 'switch', label: 'VCF MODE', options: ['HP', 'LP'], default: 1,
      description: 'Ladder filter mode: HP (up) keeps what is above CUTOFF (hats, snares), LP (down) keeps what is below (kicks, bass, toms).',
      manualReference: 'VCF - HP / LP switch',
    },
    vcf_cutoff: {
      type: 'knob', label: 'CUTOFF', min: 20, max: 20000, default: 2000, units: 'Hz', size: 'large', curve: 'logarithmic',
      description: 'Filter cutoff, 20 Hz to 20 kHz. The VCF EG, NOISE / VCF MOD and the VCF MOD jack add to it.',
      manualReference: 'VCF - CUTOFF',
    },
    vcf_resonance: {
      type: 'knob', label: 'RESONANCE', min: 0, max: 100, default: 0, units: '%', size: 'large',
      description: 'Feedback around the ladder: a ringing peak at the cutoff. Past about 3 o\'clock the filter self-oscillates into a sine wave - a third sound source. Lows thin out as it rises.',
      manualReference: 'VCF - RESONANCE',
    },
    vcf_decay: {
      type: 'knob', label: 'VCF DECAY', min: 10, max: 10000, default: 300, units: 'ms', size: 'large', curve: 'logarithmic',
      description: 'Decay time of the VCF envelope (10 ms to 10 s): how quickly the brightness of each hit closes.',
      manualReference: 'VCF EG - VCF DECAY',
    },
    vcf_eg_amount: {
      type: 'knob', label: 'VCF EG AMOUNT', min: -100, max: 100, default: 0, units: '%', bipolar: true, size: 'large',
      description: 'How far the VCF envelope moves the cutoff on each hit. Clockwise opens it (a pluck), counter-clockwise closes it. Velocity scales it per step.',
      manualReference: 'VCF EG - VCF EG AMOUNT',
    },
    noise_vcf_mod: {
      type: 'knob', label: 'NOISE / VCF MOD', min: 0, max: 100, default: 0, units: '%', size: 'large',
      description: 'Noise shaking the cutoff for grit and lo-fi crunch. With a cable in VCF MOD that signal replaces the noise and this knob sets its depth (fully clockwise = full CV control).',
      manualReference: 'VCF - NOISE / VCF MOD',
    },

    // ---- VCA -----------------------------------------------------------------------------
    vca_attack_mode: {
      type: 'switch', label: 'VCA EG', options: ['FAST', 'SLOW'], default: 0,
      description: 'VCA envelope attack: FAST = 1 ms (snap and punch: kicks, hats), SLOW = 100 ms (soft mallets, brushes, shakers, a hint of glide on basslines).',
      manualReference: 'VCA - VCA EG FAST / SLOW',
    },
    vca_decay: {
      type: 'knob', label: 'VCA DECAY', min: 10, max: 10000, default: 300, units: 'ms', size: 'large', curve: 'logarithmic',
      description: 'How long each hit rings (10 ms to 10 s). Fully counter-clockwise is a click; fully clockwise is a drone.',
      manualReference: 'VCA - VCA DECAY',
    },
    volume: {
      type: 'knob', label: 'VOLUME', min: 0, max: 100, default: 75, units: '%', size: 'large',
      description: 'Output level (the VCA jack and the main output).',
      manualReference: 'VCA - VOLUME',
    },

    // ---- Sequencer --------------------------------------------------------------------------
    tempo: {
      type: 'knob', label: 'TEMPO', min: 10.5, max: 10500, default: 120, units: 'BPM', size: 'large', curve: 'logarithmic',
      description: 'Sequencer clock, 0.7 Hz to 700 Hz (into audio rate). Shown as BPM with each step a 16th note: 120 BPM = 8 steps a second. Ignored while ADV/CLOCK has a cable.',
      manualReference: 'Sequencer - TEMPO',
    },
    trigger: {
      type: 'button', label: 'TRIGGER', momentary: true, default: false,
      description: 'Fires all three envelopes at the current step\'s velocity without moving the sequencer - audition one step.',
      manualReference: 'Sequencer - TRIGGER',
    },
    run_stop: {
      type: 'button', label: 'RUN / STOP', momentary: false, ledColor: '#ff2a2a', default: false,
      description: 'Starts and stops the sequencer from the current step. With a clock in ADV/CLOCK, press it first: the DFAM then waits and plays one step per pulse.',
      manualReference: 'Sequencer - RUN / STOP',
    },
    advance: {
      type: 'button', label: 'ADVANCE', momentary: true, default: false,
      description: 'Moves the sequencer one step without playing it. Park it on step 8 so the next RUN or clock pulse starts on step 1.',
      manualReference: 'Sequencer - ADVANCE',
    },
    pitch_1: pitchKnob(1), pitch_2: pitchKnob(2), pitch_3: pitchKnob(3), pitch_4: pitchKnob(4),
    pitch_5: pitchKnob(5), pitch_6: pitchKnob(6), pitch_7: pitchKnob(7), pitch_8: pitchKnob(8),
    velocity_1: velocityKnob(1), velocity_2: velocityKnob(2), velocity_3: velocityKnob(3), velocity_4: velocityKnob(4),
    velocity_5: velocityKnob(5), velocity_6: velocityKnob(6), velocity_7: velocityKnob(7), velocity_8: velocityKnob(8),
  },

  // 24 patch points: 3 columns x 8 rows. Rows 1-6 read IN | IN | OUT, row 7 is three
  // inputs and row 8 three outputs. Normals per the manual; see REFERENCE.md.
  patchBay: {
    inputs: [
      { id: 'in_trigger', label: 'TRIGGER', jackType: 'input', signalType: 'trigger', column: 0, row: 0 },
      { id: 'in_vca_cv', label: 'VCA CV', jackType: 'input', signalType: 'cv', column: 1, row: 0 },
      { id: 'in_velocity', label: 'VELOCITY', jackType: 'input', signalType: 'cv', column: 0, row: 1 },
      { id: 'in_vca_decay', label: 'VCA DECAY', jackType: 'input', signalType: 'cv', column: 1, row: 1 },
      { id: 'in_ext_audio', label: 'EXT AUDIO', jackType: 'input', signalType: 'audio', column: 0, row: 2 },
      { id: 'in_vcf_decay', label: 'VCF DECAY', jackType: 'input', signalType: 'cv', column: 1, row: 2 },
      { id: 'in_noise_level', label: 'NOISE LEVEL', jackType: 'input', signalType: 'cv', column: 0, row: 3 },
      { id: 'in_vco_decay', label: 'VCO DECAY', jackType: 'input', signalType: 'cv', column: 1, row: 3 },
      { id: 'in_vcf_mod', label: 'VCF MOD', jackType: 'input', signalType: 'cv', column: 0, row: 4 },
      { id: 'in_vco1_cv', label: 'VCO 1 CV', jackType: 'input', signalType: 'cv', column: 1, row: 4 },
      { id: 'in_fm_amount', label: '1→2 FM AMT', jackType: 'input', signalType: 'cv', column: 0, row: 5 },
      { id: 'in_vco2_cv', label: 'VCO 2 CV', jackType: 'input', signalType: 'cv', column: 1, row: 5 },
      { id: 'in_tempo', label: 'TEMPO', jackType: 'input', signalType: 'cv', column: 0, row: 6 },
      { id: 'in_run_stop', label: 'RUN / STOP', jackType: 'input', signalType: 'gate', column: 1, row: 6 },
      { id: 'in_adv_clock', label: 'ADV / CLOCK', jackType: 'input', signalType: 'clock', column: 2, row: 6 },
    ],
    outputs: [
      { id: 'out_vca', label: 'VCA', jackType: 'output', signalType: 'audio', column: 2, row: 0 },
      { id: 'out_vca_eg', label: 'VCA EG', jackType: 'output', signalType: 'cv', column: 2, row: 1 },
      { id: 'out_vcf_eg', label: 'VCF EG', jackType: 'output', signalType: 'cv', column: 2, row: 2 },
      { id: 'out_vco_eg', label: 'VCO EG', jackType: 'output', signalType: 'cv', column: 2, row: 3 },
      { id: 'out_vco1', label: 'VCO 1', jackType: 'output', signalType: 'audio', column: 2, row: 4 },
      { id: 'out_vco2', label: 'VCO 2', jackType: 'output', signalType: 'audio', column: 2, row: 5 },
      { id: 'out_trigger', label: 'TRIGGER', jackType: 'output', signalType: 'trigger', column: 0, row: 7 },
      { id: 'out_velocity', label: 'VELOCITY', jackType: 'output', signalType: 'cv', column: 1, row: 7 },
      { id: 'out_pitch', label: 'PITCH', jackType: 'output', signalType: 'cv', column: 2, row: 7 },
    ],
  },

  presets: DFAM_PRESETS,
};
