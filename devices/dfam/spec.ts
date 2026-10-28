// ============================================================================
// MOOG DFAM - Drummer From Another Mother
// Complete hardware specification based on official Moog manual
// https://api.moogmusic.com/sites/default/files/2018-04/DFAM_Manual.pdf
// ============================================================================

import type { DeviceSpec } from '@/types';

export const DFAM: DeviceSpec = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  id: 'dfam',
  name: 'DFAM',
  manufacturer: 'Moog',
  year: 2017,
  description: 'Drummer From Another Mother - Semi-Modular Analog Percussion Synthesizer',
  manualUrl: 'https://api.moogmusic.com/sites/default/files/2018-04/DFAM_Manual.pdf',

  // ---------------------------------------------------------------------------
  // Physical Dimensions (from Moog specs)
  // ---------------------------------------------------------------------------
  dimensions: {
    width: 319,      // mm (12.57")
    height: 107,     // mm (4.21")
    depth: 133,      // mm (5.24")
    eurorackHP: 60,  // Eurorack compatible
  },

  // ---------------------------------------------------------------------------
  // Display Configuration
  // ---------------------------------------------------------------------------
  display: {
    width: 960,
    height: 400,
    scale: 3.0,  // ~3px per mm
  },

  // ---------------------------------------------------------------------------
  // Signal Flow Architecture
  // Organized to match actual DFAM signal path and panel layout
  // ---------------------------------------------------------------------------
  signalFlow: [
    {
      id: 'oscillators',
      name: 'Voltage Controlled Oscillators',
      description: 'Two VCOs with triangle/square waves, FM, and hard sync',
      order: 1,
      controls: [
        'vco1_frequency', 'vco1_eg_amount', 'vco1_wave',
        'vco2_frequency', 'vco2_eg_amount', 'vco2_wave',
        'fm_amount', 'hard_sync',
      ],
    },
    {
      id: 'vco_envelope',
      name: 'VCO Envelope',
      description: 'Dedicated envelope for pitch modulation',
      order: 2,
      controls: ['vco_decay', 'seq_pitch_mod'],
    },
    {
      id: 'mixer',
      name: 'Mixer',
      description: 'Mix VCO1, VCO2, and white noise',
      order: 3,
      controls: ['vco1_level', 'vco2_level', 'noise_level'],
    },
    {
      id: 'filter',
      name: 'Voltage Controlled Filter',
      description: '4-pole (-24dB/oct) Moog Ladder filter with LP/HP modes',
      order: 4,
      controls: ['vcf_cutoff', 'vcf_resonance', 'vcf_eg_amount', 'vcf_mode'],
    },
    {
      id: 'vcf_envelope',
      name: 'VCF Envelope',
      description: 'Dedicated envelope for filter modulation',
      order: 5,
      controls: ['vcf_decay', 'noise_vcf_mod'],
    },
    {
      id: 'vca',
      name: 'Voltage Controlled Amplifier',
      description: 'VCA with selectable fast/slow attack envelope',
      order: 6,
      controls: ['vca_decay', 'vca_attack_mode', 'volume'],
    },
    {
      id: 'sequencer',
      name: '8-Step Sequencer',
      description: 'Analog sequencer with per-step pitch and velocity',
      order: 7,
      controls: [
        'tempo',
        'pitch_1', 'pitch_2', 'pitch_3', 'pitch_4', 'pitch_5', 'pitch_6', 'pitch_7', 'pitch_8',
        'velocity_1', 'velocity_2', 'velocity_3', 'velocity_4', 'velocity_5', 'velocity_6', 'velocity_7', 'velocity_8',
        'trigger', 'run_stop', 'advance',
      ],
    },
  ],

  // ---------------------------------------------------------------------------
  // Control Specifications
  // All values verified against official Moog DFAM manual
  // ---------------------------------------------------------------------------
  controls: {
    // =========================================================================
    // OSCILLATOR SECTION
    // =========================================================================

    vco1_frequency: {
      type: 'knob',
      label: 'VCO 1 FREQ',
      description: 'Sets the base pitch of Oscillator 1 over a 10-octave range',
      min: -5,
      max: 5,
      default: 0,
      units: 'octaves',
      bipolar: true,
      size: 'medium',
      manualReference: 'Page 6 - VCO FREQUENCY',
    },

    vco1_eg_amount: {
      type: 'knob',
      label: 'VCO 1 EG AMT',
      description: 'Amount of VCO envelope applied to Oscillator 1 pitch. Essential for kick drums.',
      min: -100,
      max: 100,
      default: 0,
      units: '%',
      bipolar: true,
      size: 'small',
      manualReference: 'Page 7 - VCO EG AMOUNT',
    },

    vco1_wave: {
      type: 'switch',
      label: 'VCO 1 WAVE',
      description: 'Selects triangle or square waveform for Oscillator 1',
      options: ['SQR', 'TRI'],
      default: 1,  // TRI is default (position 1)
      manualReference: 'Page 6 - WAVEFORM SELECT',
    },

    vco2_frequency: {
      type: 'knob',
      label: 'VCO 2 FREQ',
      description: 'Sets the base pitch of Oscillator 2 over a 10-octave range',
      min: -5,
      max: 5,
      default: 0,
      units: 'octaves',
      bipolar: true,
      size: 'medium',
      manualReference: 'Page 6 - VCO FREQUENCY',
    },

    vco2_eg_amount: {
      type: 'knob',
      label: 'VCO 2 EG AMT',
      description: 'Amount of VCO envelope applied to Oscillator 2 pitch',
      min: -100,
      max: 100,
      default: 0,
      units: '%',
      bipolar: true,
      size: 'small',
      manualReference: 'Page 7 - VCO EG AMOUNT',
    },

    vco2_wave: {
      type: 'switch',
      label: 'VCO 2 WAVE',
      description: 'Selects triangle or square waveform for Oscillator 2',
      options: ['SQR', 'TRI'],
      default: 1,  // TRI is default (position 1)
      manualReference: 'Page 6 - WAVEFORM SELECT',
    },

    fm_amount: {
      type: 'knob',
      label: '1→2 FM AMT',
      description: 'Amount of frequency modulation from VCO 1 to VCO 2. Creates metallic and bell-like tones.',
      min: 0,
      max: 100,
      default: 0,
      units: '%',
      size: 'small',
      manualReference: 'Page 7 - FM AMOUNT',
    },

    hard_sync: {
      type: 'switch',
      label: 'HARD SYNC',
      description: 'Forces VCO 2 phase to reset with VCO 1. Creates aggressive, harmonically rich tones.',
      options: ['ON', 'OFF'],
      default: 1,  // OFF is default (position 1)
      manualReference: 'Page 7 - HARD SYNC',
    },

    // =========================================================================
    // VCO ENVELOPE SECTION
    // =========================================================================

    vco_decay: {
      type: 'knob',
      label: 'VCO DECAY',
      description: 'Decay time of the VCO envelope generator (10ms to 10s)',
      min: 10,
      max: 10000,
      default: 300,
      units: 'ms',
      size: 'medium',
      curve: 'logarithmic',
      manualReference: 'Page 8 - VCO DECAY',
    },

    seq_pitch_mod: {
      type: 'switch',
      label: 'SEQ PITCH MOD',
      description: 'Selects which oscillator(s) receive pitch CV from sequencer',
      options: ['VCO 1&2', 'OFF', 'VCO 2'],
      default: 0,  // VCO 1&2 is default (both oscillators)
      manualReference: 'Page 9 - SEQ PITCH MOD',
    },

    // =========================================================================
    // MIXER SECTION
    // =========================================================================

    vco1_level: {
      type: 'knob',
      label: 'VCO 1 LEVEL',
      description: 'Level of Oscillator 1 in the mix',
      min: 0,
      max: 100,
      default: 75,
      units: '%',
      size: 'small',
      manualReference: 'Page 8 - MIXER',
    },

    vco2_level: {
      type: 'knob',
      label: 'VCO 2 LEVEL',
      description: 'Level of Oscillator 2 in the mix',
      min: 0,
      max: 100,
      default: 50,
      units: '%',
      size: 'small',
      manualReference: 'Page 8 - MIXER',
    },

    noise_level: {
      type: 'knob',
      label: 'NOISE / EXT LEVEL',
      description: 'Level of white noise generator in the mix. Essential for snares and hi-hats.',
      min: 0,
      max: 100,
      default: 0,
      units: '%',
      size: 'small',
      manualReference: 'Page 8 - MIXER',
    },

    // =========================================================================
    // FILTER SECTION
    // =========================================================================

    vcf_cutoff: {
      type: 'knob',
      label: 'CUTOFF',
      description: 'Filter cutoff frequency (20Hz to 20kHz). The heart of Moog tone.',
      min: 20,
      max: 20000,
      default: 1000,
      units: 'Hz',
      size: 'large',
      curve: 'logarithmic',
      manualReference: 'Page 9 - FILTER CUTOFF',
    },

    vcf_resonance: {
      type: 'knob',
      label: 'RESONANCE',
      description: 'Filter resonance/emphasis. Self-oscillates at high settings.',
      min: 0,
      max: 100,
      default: 0,
      units: '%',
      size: 'medium',
      manualReference: 'Page 9 - RESONANCE',
    },

    vcf_eg_amount: {
      type: 'knob',
      label: 'VCF EG AMT',
      description: 'Amount of VCF envelope applied to filter cutoff. Positive or negative sweep.',
      min: -100,
      max: 100,
      default: 0,
      units: '%',
      bipolar: true,
      size: 'medium',
      manualReference: 'Page 10 - VCF EG AMOUNT',
    },

    vcf_mode: {
      type: 'switch',
      label: 'VCF MODE',
      description: 'Switches between Low Pass and High Pass filter modes',
      options: ['HP', 'LP'],
      default: 1,  // LP default (position 1)
      manualReference: 'Page 9 - FILTER MODE',
    },

    // =========================================================================
    // VCF ENVELOPE SECTION
    // =========================================================================

    vcf_decay: {
      type: 'knob',
      label: 'VCF DECAY',
      description: 'Decay time of the VCF envelope generator (10ms to 10s)',
      min: 10,
      max: 10000,
      default: 400,
      units: 'ms',
      size: 'medium',
      curve: 'logarithmic',
      manualReference: 'Page 10 - VCF DECAY',
    },

    noise_vcf_mod: {
      type: 'knob',
      label: 'NOISE VCF MOD',
      description: 'Amount of noise used to modulate filter cutoff. Creates rough, gritty textures.',
      min: 0,
      max: 100,
      default: 0,
      units: '%',
      size: 'small',
      manualReference: 'Page 10 - NOISE/VCF MOD',
    },

    // =========================================================================
    // VCA SECTION
    // =========================================================================

    vca_decay: {
      type: 'knob',
      label: 'VCA DECAY',
      description: 'Decay time of the VCA envelope generator (10ms to 10s)',
      min: 10,
      max: 10000,
      default: 500,
      units: 'ms',
      size: 'medium',
      curve: 'logarithmic',
      manualReference: 'Page 11 - VCA DECAY',
    },

    vca_attack_mode: {
      type: 'switch',
      label: 'VCA EG',
      description: 'Selects VCA envelope attack time: FAST (1ms exponential) or SLOW (linear)',
      options: ['FAST', 'SLOW'],
      default: 0,  // FAST default for punchy percussion
      manualReference: 'Page 11 - VCA ATTACK',
    },

    volume: {
      type: 'knob',
      label: 'VOLUME',
      description: 'Master output volume',
      min: 0,
      max: 100,
      default: 75,
      units: '%',
      size: 'large',
      manualReference: 'Page 11 - VOLUME',
    },

    // =========================================================================
    // SEQUENCER SECTION
    // =========================================================================

    tempo: {
      type: 'knob',
      label: 'TEMPO',
      description: 'Sequencer tempo from 10 to 10,000 BPM',
      min: 10,
      max: 10000,
      default: 120,
      units: 'BPM',
      size: 'large',
      curve: 'logarithmic',
      manualReference: 'Page 12 - TEMPO',
    },

    // Pitch knobs (8 steps)
    pitch_1: { type: 'knob', label: '1', description: 'Pitch CV for step 1', min: -5, max: 5, default: 0, units: 'V', bipolar: true, size: 'small' },
    pitch_2: { type: 'knob', label: '2', description: 'Pitch CV for step 2', min: -5, max: 5, default: 0, units: 'V', bipolar: true, size: 'small' },
    pitch_3: { type: 'knob', label: '3', description: 'Pitch CV for step 3', min: -5, max: 5, default: 0, units: 'V', bipolar: true, size: 'small' },
    pitch_4: { type: 'knob', label: '4', description: 'Pitch CV for step 4', min: -5, max: 5, default: 0, units: 'V', bipolar: true, size: 'small' },
    pitch_5: { type: 'knob', label: '5', description: 'Pitch CV for step 5', min: -5, max: 5, default: 0, units: 'V', bipolar: true, size: 'small' },
    pitch_6: { type: 'knob', label: '6', description: 'Pitch CV for step 6', min: -5, max: 5, default: 0, units: 'V', bipolar: true, size: 'small' },
    pitch_7: { type: 'knob', label: '7', description: 'Pitch CV for step 7', min: -5, max: 5, default: 0, units: 'V', bipolar: true, size: 'small' },
    pitch_8: { type: 'knob', label: '8', description: 'Pitch CV for step 8', min: -5, max: 5, default: 0, units: 'V', bipolar: true, size: 'small' },

    // Velocity knobs (8 steps)
    velocity_1: { type: 'knob', label: '1', description: 'Velocity/accent for step 1', min: 0, max: 100, default: 100, units: '%', size: 'small' },
    velocity_2: { type: 'knob', label: '2', description: 'Velocity/accent for step 2', min: 0, max: 100, default: 100, units: '%', size: 'small' },
    velocity_3: { type: 'knob', label: '3', description: 'Velocity/accent for step 3', min: 0, max: 100, default: 100, units: '%', size: 'small' },
    velocity_4: { type: 'knob', label: '4', description: 'Velocity/accent for step 4', min: 0, max: 100, default: 100, units: '%', size: 'small' },
    velocity_5: { type: 'knob', label: '5', description: 'Velocity/accent for step 5', min: 0, max: 100, default: 100, units: '%', size: 'small' },
    velocity_6: { type: 'knob', label: '6', description: 'Velocity/accent for step 6', min: 0, max: 100, default: 100, units: '%', size: 'small' },
    velocity_7: { type: 'knob', label: '7', description: 'Velocity/accent for step 7', min: 0, max: 100, default: 100, units: '%', size: 'small' },
    velocity_8: { type: 'knob', label: '8', description: 'Velocity/accent for step 8', min: 0, max: 100, default: 100, units: '%', size: 'small' },

    // Transport controls
    trigger: {
      type: 'button',
      label: 'TRIGGER',
      description: 'Manual trigger - fires all three envelope generators',
      momentary: true,
      default: false,
      manualReference: 'Page 12 - TRIGGER',
    },

    run_stop: {
      type: 'button',
      label: 'RUN/STOP',
      description: 'Starts or stops the sequencer',
      momentary: false,
      ledColor: '#ff0000',
      default: false,
      manualReference: 'Page 12 - RUN/STOP',
    },

    advance: {
      type: 'button',
      label: 'ADVANCE',
      description: 'Manually advances sequencer to next step',
      momentary: true,
      default: false,
      manualReference: 'Page 12 - ADVANCE',
    },
  },

  // ---------------------------------------------------------------------------
  // Patch Bay Configuration - Matches actual DFAM hardware exactly
  // Reference: Moog DFAM Manual Page 15-16
  // Layout by ROW (not column!):
  //   Rows 0-5: IN | IN | OUT pattern
  //   Row 6: IN | IN | IN (all inputs - TEMPO, RUN/STOP, ADV/CLOCK)
  //   Row 7: OUT | OUT | OUT (all outputs - TRIGGER, VELOCITY, PITCH)
  // Total: 15 inputs + 9 outputs = 24 jacks
  // ---------------------------------------------------------------------------
  patchBay: {
    inputs: [
      // Row 0: TRIGGER (in), VCA CV (in)
      { id: 'in_trigger', label: 'TRIGGER', jackType: 'input', signalType: 'trigger', column: 0, row: 0 },
      { id: 'in_vca_cv', label: 'VCA CV', jackType: 'input', signalType: 'cv', column: 1, row: 0 },
      // Row 1: VELOCITY (in), VCA DECAY (in)
      { id: 'in_velocity', label: 'VELOCITY', jackType: 'input', signalType: 'cv', column: 0, row: 1 },
      { id: 'in_vca_decay', label: 'VCA DECAY', jackType: 'input', signalType: 'cv', column: 1, row: 1 },
      // Row 2: EXT AUDIO (in), VCF DECAY (in)
      { id: 'in_ext_audio', label: 'EXT AUDIO', jackType: 'input', signalType: 'audio', column: 0, row: 2 },
      { id: 'in_vcf_decay', label: 'VCF DECAY', jackType: 'input', signalType: 'cv', column: 1, row: 2 },
      // Row 3: NOISE LEVEL (in), VCO DECAY (in)
      { id: 'in_noise_level', label: 'NOISE LEVEL', jackType: 'input', signalType: 'cv', column: 0, row: 3 },
      { id: 'in_vco_decay', label: 'VCO DECAY', jackType: 'input', signalType: 'cv', column: 1, row: 3 },
      // Row 4: VCF MOD (in), VCO 1 CV (in)
      { id: 'in_vcf_mod', label: 'VCF MOD', jackType: 'input', signalType: 'cv', column: 0, row: 4 },
      { id: 'in_vco1_cv', label: 'VCO 1 CV', jackType: 'input', signalType: 'cv', column: 1, row: 4 },
      // Row 5: 1→2 FM AMT (in), VCO 2 CV (in)
      { id: 'in_fm_amount', label: '1→2 FM AMT', jackType: 'input', signalType: 'cv', column: 0, row: 5 },
      { id: 'in_vco2_cv', label: 'VCO 2 CV', jackType: 'input', signalType: 'cv', column: 1, row: 5 },
      // Row 6: ALL INPUTS - TEMPO, RUN/STOP, ADV/CLOCK
      { id: 'in_tempo', label: 'TEMPO', jackType: 'input', signalType: 'cv', column: 0, row: 6 },
      { id: 'in_run_stop', label: 'RUN / STOP', jackType: 'input', signalType: 'gate', column: 1, row: 6 },
      { id: 'in_adv_clock', label: 'ADV / CLOCK', jackType: 'input', signalType: 'clock', column: 2, row: 6 },
    ],
    outputs: [
      // Rows 0-5: Output column (column 2)
      { id: 'out_vca', label: 'VCA', jackType: 'output', signalType: 'audio', column: 2, row: 0 },
      { id: 'out_vca_eg', label: 'VCA EG', jackType: 'output', signalType: 'cv', column: 2, row: 1 },
      { id: 'out_vcf_eg', label: 'VCF EG', jackType: 'output', signalType: 'cv', column: 2, row: 2 },
      { id: 'out_vco_eg', label: 'VCO EG', jackType: 'output', signalType: 'cv', column: 2, row: 3 },
      { id: 'out_vco1', label: 'VCO 1', jackType: 'output', signalType: 'audio', column: 2, row: 4 },
      { id: 'out_vco2', label: 'VCO 2', jackType: 'output', signalType: 'audio', column: 2, row: 5 },
      // Row 7: ALL OUTPUTS - TRIGGER, VELOCITY, PITCH
      { id: 'out_trigger', label: 'TRIGGER', jackType: 'output', signalType: 'trigger', column: 0, row: 7 },
      { id: 'out_velocity', label: 'VELOCITY', jackType: 'output', signalType: 'cv', column: 1, row: 7 },
      { id: 'out_pitch', label: 'PITCH', jackType: 'output', signalType: 'cv', column: 2, row: 7 },
    ],
  },

  // ---------------------------------------------------------------------------
  // Factory Presets
  // ---------------------------------------------------------------------------
  presets: {
    init: {
      name: 'Init Patch',
      description: 'Default initialization settings',
      source: 'factory',
      settings: {
        vco1_frequency: 0,
        vco2_frequency: 0,
        vco1_eg_amount: 0,
        vco2_eg_amount: 0,
        vco1_wave: 1,  // TRI
        vco2_wave: 1,  // TRI
        fm_amount: 0,
        hard_sync: 1,  // OFF
        vco_decay: 300,
        seq_pitch_mod: 0,  // VCO 1&2 (both)
        vco1_level: 75,
        vco2_level: 50,
        noise_level: 0,
        vcf_cutoff: 1000,
        vcf_resonance: 0,
        vcf_eg_amount: 0,
        vcf_mode: 1,  // LP
        vcf_decay: 400,
        noise_vcf_mod: 0,
        vca_decay: 500,
        vca_attack_mode: 0,
        volume: 75,
        tempo: 120,
      },
    },
    classic_kick: {
      name: 'Classic Kick',
      description: 'Punchy 909-style kick drum with pitch sweep',
      source: 'manual',
      settings: {
        vco1_frequency: -2,
        vco2_frequency: -2,
        vco1_eg_amount: 80,
        vco2_eg_amount: 60,
        vco1_wave: 1,  // Triangle
        vco2_wave: 1,  // Triangle
        fm_amount: 0,
        hard_sync: 1,  // OFF
        vco_decay: 150,
        vco1_level: 100,
        vco2_level: 70,
        noise_level: 5,
        vcf_cutoff: 800,
        vcf_resonance: 20,
        vcf_eg_amount: 60,
        vcf_mode: 1,  // LP
        vcf_decay: 200,
        vca_decay: 300,
        vca_attack_mode: 0,  // FAST
        volume: 80,
      },
    },
    snappy_snare: {
      name: 'Snappy Snare',
      description: 'Bright electronic snare with noise burst',
      source: 'manual',
      settings: {
        vco1_frequency: 1,
        vco2_frequency: 1.5,
        vco1_eg_amount: 50,
        vco2_eg_amount: 40,
        vco1_wave: 0,  // Square
        vco2_wave: 0,  // Square
        fm_amount: 20,
        hard_sync: 1,  // OFF
        vco_decay: 80,
        vco1_level: 50,
        vco2_level: 40,
        noise_level: 80,
        vcf_cutoff: 4000,
        vcf_resonance: 30,
        vcf_eg_amount: 40,
        vcf_mode: 1,  // LP
        vcf_decay: 100,
        vca_decay: 150,
        vca_attack_mode: 0,  // FAST
        volume: 75,
      },
    },
    deep_tom: {
      name: 'Deep Tom',
      description: 'Low, boomy tom with long decay',
      source: 'community',
      settings: {
        vco1_frequency: -1,
        vco2_frequency: -0.5,
        vco1_eg_amount: 70,
        vco2_eg_amount: 50,
        vco1_wave: 1,  // Triangle
        vco2_wave: 1,  // Triangle
        fm_amount: 10,
        hard_sync: 1,  // OFF
        vco_decay: 400,
        vco1_level: 90,
        vco2_level: 60,
        noise_level: 10,
        vcf_cutoff: 600,
        vcf_resonance: 40,
        vcf_eg_amount: 50,
        vcf_mode: 1,  // LP
        vcf_decay: 350,
        vca_decay: 500,
        vca_attack_mode: 0,  // FAST
        volume: 80,
      },
    },
  },
};
