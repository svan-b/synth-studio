// ============================================================================
// MOOG DFAM - Drummer From Another Mother
// Complete hardware specification based on official Moog manual
// https://api.moogmusic.com/sites/default/files/2018-04/DFAM_Manual.pdf
// ============================================================================

import type { DeviceSpec, Lesson } from '@/types';

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
      options: ['TRI', 'SQR'],
      default: 0,
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
      options: ['TRI', 'SQR'],
      default: 0,
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
      options: ['LP', 'HP'],
      default: 0,  // LP default
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
        vco1_wave: 0,
        vco2_wave: 0,
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
        vcf_mode: 0,
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
        vco1_wave: 0,  // Triangle
        vco2_wave: 0,  // Triangle
        fm_amount: 0,
        hard_sync: 1,  // OFF
        vco_decay: 150,
        vco1_level: 100,
        vco2_level: 70,
        noise_level: 5,
        vcf_cutoff: 800,
        vcf_resonance: 20,
        vcf_eg_amount: 60,
        vcf_mode: 0,  // LP
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
        vco1_wave: 1,  // Square
        vco2_wave: 1,  // Square
        fm_amount: 20,
        hard_sync: 1,  // OFF
        vco_decay: 80,
        vco1_level: 50,
        vco2_level: 40,
        noise_level: 80,
        vcf_cutoff: 4000,
        vcf_resonance: 30,
        vcf_eg_amount: 40,
        vcf_mode: 0,  // LP
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
        vco1_wave: 0,  // Triangle
        vco2_wave: 0,  // Triangle
        fm_amount: 10,
        hard_sync: 1,  // OFF
        vco_decay: 400,
        vco1_level: 90,
        vco2_level: 60,
        noise_level: 10,
        vcf_cutoff: 600,
        vcf_resonance: 40,
        vcf_eg_amount: 50,
        vcf_mode: 0,  // LP
        vcf_decay: 350,
        vca_decay: 500,
        vca_attack_mode: 0,  // FAST
        volume: 80,
      },
    },
  },
};

// =============================================================================
// DFAM LESSONS
// =============================================================================

export const DFAM_LESSONS: Lesson[] = [
  // ===== BEGINNER LESSONS =====
  {
    id: 'dfam-classic-kick',
    device: 'dfam',
    name: 'Classic Kick Drum',
    description: 'Learn to create a punchy, 909-style kick drum by understanding pitch envelopes and filter sweeps.',
    difficulty: 'beginner',
    source: 'Moog DFAM Manual - Patch Ideas',
    estimatedMinutes: 5,
    tags: ['kick', 'bass', 'percussion', 'beginner'],
    steps: [
      {
        control: 'vco1_frequency',
        targetValue: -2,
        instruction: 'Set VCO 1 FREQ to -2 octaves for a low fundamental tone',
        explanation: 'Kick drums need a low base pitch. The -2 octave setting gives us a deep, subby foundation.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'vco1_eg_amount',
        targetValue: 80,
        instruction: 'Set VCO 1 EG AMT to +80%',
        explanation: 'This is the secret to a punchy kick! The envelope sweeps the pitch from high to low, creating that classic "thump" attack.',
        manualReference: 'Page 7 - VCO EG AMOUNT',
      },
      {
        control: 'vco_decay',
        targetValue: 150,
        instruction: 'Set VCO DECAY to 150ms',
        explanation: 'A short decay makes the pitch sweep quick and punchy. Longer decays create more "laser" sounds.',
        manualReference: 'Page 8 - VCO DECAY',
      },
      {
        control: 'vco1_level',
        targetValue: 100,
        instruction: 'Set VCO 1 level to 100%',
        explanation: 'We want Oscillator 1 to be the dominant sound source.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 800,
        instruction: 'Set filter CUTOFF to around 800 Hz',
        explanation: 'This rolls off the high frequencies, keeping the kick deep and controlled.',
        manualReference: 'Page 9 - FILTER CUTOFF',
      },
      {
        control: 'vcf_eg_amount',
        targetValue: 60,
        instruction: 'Set VCF EG AMT to +60%',
        explanation: 'The filter envelope adds a "click" to the attack by briefly opening the filter.',
        manualReference: 'Page 10 - VCF EG AMOUNT',
      },
      {
        control: 'vcf_decay',
        targetValue: 200,
        instruction: 'Set VCF DECAY to 200ms',
        explanation: 'Slightly longer than the VCO decay for a smooth, natural envelope.',
        manualReference: 'Page 10 - VCF DECAY',
      },
      {
        control: 'vca_decay',
        targetValue: 300,
        instruction: 'Set VCA DECAY to 300ms',
        explanation: 'This controls how long the kick rings out. 300ms gives a tight, controlled sound.',
        manualReference: 'Page 11 - VCA DECAY',
      },
      {
        control: 'vca_attack_mode',
        targetValue: 0,
        instruction: 'Set VCA EG to FAST',
        explanation: 'Fast attack (1ms) gives the kick an immediate, punchy transient.',
        manualReference: 'Page 11 - VCA ATTACK',
      },
    ],
  },
  {
    id: 'dfam-snare-basics',
    device: 'dfam',
    name: 'Electronic Snare',
    description: 'Create a snappy electronic snare using noise and dual oscillators.',
    difficulty: 'beginner',
    source: 'Moog DFAM Manual - Patch Ideas',
    estimatedMinutes: 7,
    tags: ['snare', 'percussion', 'noise', 'beginner'],
    steps: [
      {
        control: 'vco1_frequency',
        targetValue: 1,
        instruction: 'Set VCO 1 FREQ to +1 octave',
        explanation: 'Snares have a higher fundamental than kicks.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'noise_level',
        targetValue: 80,
        instruction: 'Set NOISE level to 80%',
        explanation: 'The noise is essential for snare character - it creates the "snap" and "rattle" of a snare.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vco1_level',
        targetValue: 50,
        instruction: 'Set VCO 1 level to 50%',
        explanation: 'Balance the oscillator with the noise.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vco1_eg_amount',
        targetValue: 50,
        instruction: 'Set VCO 1 EG AMT to +50%',
        explanation: 'A moderate pitch sweep adds body to the snare attack.',
        manualReference: 'Page 7 - VCO EG AMOUNT',
      },
      {
        control: 'vco_decay',
        targetValue: 80,
        instruction: 'Set VCO DECAY to 80ms',
        explanation: 'Short and snappy for a tight snare sound.',
        manualReference: 'Page 8 - VCO DECAY',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 4000,
        instruction: 'Set filter CUTOFF to 4000 Hz',
        explanation: 'Higher than a kick to let the noise brightness through.',
        manualReference: 'Page 9 - FILTER CUTOFF',
      },
      {
        control: 'vca_decay',
        targetValue: 150,
        instruction: 'Set VCA DECAY to 150ms',
        explanation: 'Short decay keeps the snare tight and punchy.',
        manualReference: 'Page 11 - VCA DECAY',
      },
    ],
  },
  {
    id: 'dfam-hi-hat-closed',
    device: 'dfam',
    name: 'Closed Hi-Hat',
    description: 'Create a tight, sizzling closed hi-hat using noise and high-pass filtering.',
    difficulty: 'beginner',
    source: 'Moog DFAM Manual - Patch Ideas',
    estimatedMinutes: 5,
    tags: ['hi-hat', 'cymbal', 'noise', 'beginner'],
    steps: [
      {
        control: 'noise_level',
        targetValue: 100,
        instruction: 'Set NOISE level to 100%',
        explanation: 'Hi-hats are primarily noise-based - pure white noise gives us the metallic sizzle.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vco1_level',
        targetValue: 0,
        instruction: 'Set VCO 1 level to 0%',
        explanation: 'We want pure noise for a clean hi-hat sound.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vco2_level',
        targetValue: 0,
        instruction: 'Set VCO 2 level to 0%',
        explanation: 'No oscillators needed for a basic hi-hat.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vcf_mode',
        targetValue: 1,
        instruction: 'Set VCF MODE to HP (High Pass)',
        explanation: 'High-pass filtering removes the low frequencies, leaving only the bright, sizzly top end.',
        manualReference: 'Page 9 - FILTER MODE',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 6000,
        instruction: 'Set CUTOFF to 6000 Hz',
        explanation: 'A high cutoff lets through only the brightest frequencies.',
        manualReference: 'Page 9 - FILTER CUTOFF',
      },
      {
        control: 'vca_decay',
        targetValue: 50,
        instruction: 'Set VCA DECAY to 50ms',
        explanation: 'Very short decay for a tight, closed hi-hat "tick".',
        manualReference: 'Page 11 - VCA DECAY',
      },
      {
        control: 'vca_attack_mode',
        targetValue: 0,
        instruction: 'Set VCA EG to FAST',
        explanation: 'Fast attack for immediate transient response.',
        manualReference: 'Page 11 - VCA ATTACK',
      },
    ],
  },
  {
    id: 'dfam-open-hi-hat',
    device: 'dfam',
    name: 'Open Hi-Hat',
    description: 'Create an open, splashy hi-hat with longer decay and filter sweep.',
    difficulty: 'beginner',
    source: 'Moog DFAM Manual - Patch Ideas',
    estimatedMinutes: 5,
    tags: ['hi-hat', 'cymbal', 'noise', 'beginner'],
    steps: [
      {
        control: 'noise_level',
        targetValue: 100,
        instruction: 'Set NOISE level to 100%',
        explanation: 'Full noise for maximum hi-hat sizzle.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vco1_level',
        targetValue: 0,
        instruction: 'Set VCO 1 level to 0%',
        explanation: 'Pure noise sound.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vcf_mode',
        targetValue: 1,
        instruction: 'Set VCF MODE to HP (High Pass)',
        explanation: 'High-pass for bright cymbal character.',
        manualReference: 'Page 9 - FILTER MODE',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 4000,
        instruction: 'Set CUTOFF to 4000 Hz',
        explanation: 'Slightly lower than closed hi-hat for fuller body.',
        manualReference: 'Page 9 - FILTER CUTOFF',
      },
      {
        control: 'vcf_eg_amount',
        targetValue: 30,
        instruction: 'Set VCF EG AMT to +30%',
        explanation: 'A small filter sweep adds movement to the decay.',
        manualReference: 'Page 10 - VCF EG AMOUNT',
      },
      {
        control: 'vcf_decay',
        targetValue: 300,
        instruction: 'Set VCF DECAY to 300ms',
        explanation: 'Longer filter decay for open hat character.',
        manualReference: 'Page 10 - VCF DECAY',
      },
      {
        control: 'vca_decay',
        targetValue: 400,
        instruction: 'Set VCA DECAY to 400ms',
        explanation: 'Long decay lets the hi-hat "breathe" and ring out.',
        manualReference: 'Page 11 - VCA DECAY',
      },
    ],
  },

  // ===== INTERMEDIATE LESSONS =====
  {
    id: 'dfam-fm-percussion',
    device: 'dfam',
    name: 'FM Metallic Sounds',
    description: 'Use frequency modulation to create bell-like, metallic percussion.',
    difficulty: 'intermediate',
    source: 'Moog DFAM Manual - FM Section',
    estimatedMinutes: 8,
    prerequisites: ['dfam-classic-kick'],
    tags: ['fm', 'metallic', 'bell', 'intermediate'],
    steps: [
      {
        control: 'vco1_frequency',
        targetValue: 2,
        instruction: 'Set VCO 1 FREQ to +2 octaves',
        explanation: 'Higher pitches work better for metallic sounds.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'vco2_frequency',
        targetValue: 2.7,
        instruction: 'Set VCO 2 FREQ to +2.7 octaves',
        explanation: 'A non-integer ratio between oscillators creates inharmonic, metallic tones.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'fm_amount',
        targetValue: 60,
        instruction: 'Set 1→2 FM AMT to 60%',
        explanation: 'FM creates complex sidebands that give bells and cymbals their shimmering quality.',
        manualReference: 'Page 7 - FM AMOUNT',
      },
      {
        control: 'vco1_level',
        targetValue: 0,
        instruction: 'Set VCO 1 level to 0%',
        explanation: 'We only want to hear VCO 2 (the modulated oscillator).',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vco2_level',
        targetValue: 100,
        instruction: 'Set VCO 2 level to 100%',
        explanation: 'VCO 2 carries all the FM character.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 8000,
        instruction: 'Set CUTOFF to 8000 Hz',
        explanation: 'Let the high harmonics through for that metallic shimmer.',
        manualReference: 'Page 9 - FILTER CUTOFF',
      },
      {
        control: 'vca_decay',
        targetValue: 400,
        instruction: 'Set VCA DECAY to 400ms',
        explanation: 'Longer decay lets the bell-like tone ring out.',
        manualReference: 'Page 11 - VCA DECAY',
      },
    ],
  },
  {
    id: 'dfam-cowbell',
    device: 'dfam',
    name: 'Analog Cowbell',
    description: 'Create a classic 808-style cowbell using two detuned oscillators.',
    difficulty: 'intermediate',
    source: 'Moog DFAM Manual - Patch Ideas',
    estimatedMinutes: 8,
    tags: ['cowbell', 'percussion', '808', 'intermediate'],
    steps: [
      {
        control: 'vco1_frequency',
        targetValue: 3,
        instruction: 'Set VCO 1 FREQ to +3 octaves',
        explanation: 'Cowbells live in the high-mid frequency range.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'vco2_frequency',
        targetValue: 3.2,
        instruction: 'Set VCO 2 FREQ slightly higher at +3.2 octaves',
        explanation: 'The slight detuning creates the characteristic "clanky" cowbell tone.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'vco1_wave',
        targetValue: 1,
        instruction: 'Set VCO 1 WAVE to SQR (Square)',
        explanation: 'Square waves give cowbells their hollow, metallic character.',
        manualReference: 'Page 6 - WAVEFORM SELECT',
      },
      {
        control: 'vco2_wave',
        targetValue: 1,
        instruction: 'Set VCO 2 WAVE to SQR (Square)',
        explanation: 'Both oscillators as squares for maximum cowbell tone.',
        manualReference: 'Page 6 - WAVEFORM SELECT',
      },
      {
        control: 'vco1_level',
        targetValue: 80,
        instruction: 'Set VCO 1 level to 80%',
        explanation: 'Balance both oscillators for the right mix.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vco2_level',
        targetValue: 80,
        instruction: 'Set VCO 2 level to 80%',
        explanation: 'Equal levels let both oscillators contribute.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 2000,
        instruction: 'Set CUTOFF to 2000 Hz',
        explanation: 'Bandpass the cowbell frequencies, removing extreme highs and lows.',
        manualReference: 'Page 9 - FILTER CUTOFF',
      },
      {
        control: 'vcf_resonance',
        targetValue: 50,
        instruction: 'Set RESONANCE to 50%',
        explanation: 'Resonance emphasizes the cowbell frequency for a more focused tone.',
        manualReference: 'Page 9 - RESONANCE',
      },
      {
        control: 'vca_decay',
        targetValue: 200,
        instruction: 'Set VCA DECAY to 200ms',
        explanation: 'Medium decay for the characteristic cowbell ring.',
        manualReference: 'Page 11 - VCA DECAY',
      },
    ],
  },
  {
    id: 'dfam-clap',
    device: 'dfam',
    name: 'Electronic Clap',
    description: 'Create a snappy handclap using filtered noise with specific envelope shapes.',
    difficulty: 'intermediate',
    source: 'Moog DFAM Manual - Patch Ideas',
    estimatedMinutes: 6,
    tags: ['clap', 'percussion', 'noise', 'intermediate'],
    steps: [
      {
        control: 'noise_level',
        targetValue: 100,
        instruction: 'Set NOISE level to 100%',
        explanation: 'Claps are essentially shaped noise bursts.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vco1_level',
        targetValue: 0,
        instruction: 'Set VCO 1 level to 0%',
        explanation: 'Pure noise for the clap body.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 3000,
        instruction: 'Set CUTOFF to 3000 Hz',
        explanation: 'Mid-high frequency focus for hand-clap character.',
        manualReference: 'Page 9 - FILTER CUTOFF',
      },
      {
        control: 'vcf_eg_amount',
        targetValue: 40,
        instruction: 'Set VCF EG AMT to +40%',
        explanation: 'Filter sweep adds snap to the clap attack.',
        manualReference: 'Page 10 - VCF EG AMOUNT',
      },
      {
        control: 'vcf_decay',
        targetValue: 100,
        instruction: 'Set VCF DECAY to 100ms',
        explanation: 'Quick filter decay for snappy response.',
        manualReference: 'Page 10 - VCF DECAY',
      },
      {
        control: 'vca_decay',
        targetValue: 200,
        instruction: 'Set VCA DECAY to 200ms',
        explanation: 'Medium-short decay for the natural clap tail.',
        manualReference: 'Page 11 - VCA DECAY',
      },
      {
        control: 'vca_attack_mode',
        targetValue: 1,
        instruction: 'Set VCA EG to SLOW',
        explanation: 'Slower attack softens the initial transient for a more realistic clap.',
        manualReference: 'Page 11 - VCA ATTACK',
      },
    ],
  },
  {
    id: 'dfam-deep-tom',
    device: 'dfam',
    name: 'Deep Floor Tom',
    description: 'Create a boomy, resonant floor tom with pitch sweep.',
    difficulty: 'intermediate',
    source: 'Moog DFAM Manual - Patch Ideas',
    estimatedMinutes: 6,
    tags: ['tom', 'percussion', 'beginner'],
    steps: [
      {
        control: 'vco1_frequency',
        targetValue: -1,
        instruction: 'Set VCO 1 FREQ to -1 octave',
        explanation: 'Floor toms sit between kicks and mid toms in pitch.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'vco1_wave',
        targetValue: 0,
        instruction: 'Set VCO 1 WAVE to TRI (Triangle)',
        explanation: 'Triangle waves give a softer, more natural tom tone.',
        manualReference: 'Page 6 - WAVEFORM SELECT',
      },
      {
        control: 'vco1_eg_amount',
        targetValue: 60,
        instruction: 'Set VCO 1 EG AMT to +60%',
        explanation: 'Moderate pitch sweep for tom attack without being too "laser-y".',
        manualReference: 'Page 7 - VCO EG AMOUNT',
      },
      {
        control: 'vco_decay',
        targetValue: 300,
        instruction: 'Set VCO DECAY to 300ms',
        explanation: 'Longer pitch sweep than a kick for that tom character.',
        manualReference: 'Page 8 - VCO DECAY',
      },
      {
        control: 'vco1_level',
        targetValue: 100,
        instruction: 'Set VCO 1 level to 100%',
        explanation: 'Full oscillator level for a powerful tom.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 1200,
        instruction: 'Set CUTOFF to 1200 Hz',
        explanation: 'Allow some harmonics through for body.',
        manualReference: 'Page 9 - FILTER CUTOFF',
      },
      {
        control: 'vcf_resonance',
        targetValue: 30,
        instruction: 'Set RESONANCE to 30%',
        explanation: 'Some resonance adds boom to the tom.',
        manualReference: 'Page 9 - RESONANCE',
      },
      {
        control: 'vca_decay',
        targetValue: 600,
        instruction: 'Set VCA DECAY to 600ms',
        explanation: 'Long decay for a resonant, boomy tom.',
        manualReference: 'Page 11 - VCA DECAY',
      },
    ],
  },
  {
    id: 'dfam-hard-sync-lead',
    device: 'dfam',
    name: 'Hard Sync Percussion',
    description: 'Use hard sync to create aggressive, harmonically rich percussion.',
    difficulty: 'intermediate',
    source: 'Moog DFAM Manual - Hard Sync',
    estimatedMinutes: 8,
    tags: ['hard-sync', 'aggressive', 'intermediate'],
    steps: [
      {
        control: 'hard_sync',
        targetValue: 1,
        instruction: 'Enable HARD SYNC (set to ON)',
        explanation: 'Hard sync forces VCO 2 to restart its cycle whenever VCO 1 completes a cycle, creating harmonically rich tones.',
        manualReference: 'Page 7 - HARD SYNC',
      },
      {
        control: 'vco1_frequency',
        targetValue: 0,
        instruction: 'Set VCO 1 FREQ to 0 (center)',
        explanation: 'VCO 1 sets the fundamental pitch of the synced sound.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'vco2_frequency',
        targetValue: 2,
        instruction: 'Set VCO 2 FREQ to +2 octaves',
        explanation: 'Higher VCO 2 creates more harmonic content through sync.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'vco2_eg_amount',
        targetValue: 70,
        instruction: 'Set VCO 2 EG AMT to +70%',
        explanation: 'Sweeping VCO 2 while synced creates the classic sync sweep sound.',
        manualReference: 'Page 7 - VCO EG AMOUNT',
      },
      {
        control: 'vco_decay',
        targetValue: 400,
        instruction: 'Set VCO DECAY to 400ms',
        explanation: 'Moderate decay lets you hear the sync sweep develop.',
        manualReference: 'Page 8 - VCO DECAY',
      },
      {
        control: 'vco1_level',
        targetValue: 0,
        instruction: 'Set VCO 1 level to 0%',
        explanation: 'Only listen to VCO 2 for pure sync sound.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vco2_level',
        targetValue: 100,
        instruction: 'Set VCO 2 level to 100%',
        explanation: 'Full VCO 2 level.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 5000,
        instruction: 'Set CUTOFF to 5000 Hz',
        explanation: 'Higher cutoff lets the sync harmonics shine.',
        manualReference: 'Page 9 - FILTER CUTOFF',
      },
      {
        control: 'vca_decay',
        targetValue: 500,
        instruction: 'Set VCA DECAY to 500ms',
        explanation: 'Medium-long decay to enjoy the sync character.',
        manualReference: 'Page 11 - VCA DECAY',
      },
    ],
  },

  // ===== ADVANCED LESSONS =====
  {
    id: 'dfam-bass-sequence',
    device: 'dfam',
    name: 'Sequenced Bass Line',
    description: 'Program a driving bass sequence using the 8-step sequencer.',
    difficulty: 'advanced',
    source: 'Moog DFAM Manual - Sequencer',
    estimatedMinutes: 10,
    prerequisites: ['dfam-classic-kick'],
    tags: ['bass', 'sequencer', 'advanced'],
    steps: [
      {
        control: 'vco1_frequency',
        targetValue: -3,
        instruction: 'Set VCO 1 FREQ to -3 octaves for deep bass',
        explanation: 'We want a subby bass foundation.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'seq_pitch_mod',
        targetValue: 0,
        instruction: 'Set SEQ PITCH MOD to VCO1',
        explanation: 'Route sequencer pitch CV to only VCO 1.',
        manualReference: 'Page 9 - SEQ PITCH MOD',
      },
      {
        control: 'pitch_1',
        targetValue: 0,
        instruction: 'Set Pitch 1 to 0V (root note)',
        explanation: 'First step is our root note.',
        manualReference: 'Page 12 - SEQUENCER',
      },
      {
        control: 'pitch_2',
        targetValue: 0,
        instruction: 'Set Pitch 2 to 0V (root)',
        explanation: 'Repeat root for emphasis.',
        manualReference: 'Page 12 - SEQUENCER',
      },
      {
        control: 'pitch_3',
        targetValue: 1,
        instruction: 'Set Pitch 3 to +1V (up an octave)',
        explanation: 'Jump up for variation.',
        manualReference: 'Page 12 - SEQUENCER',
      },
      {
        control: 'pitch_4',
        targetValue: 0.5,
        instruction: 'Set Pitch 4 to +0.5V',
        explanation: 'A fifth interval.',
        manualReference: 'Page 12 - SEQUENCER',
      },
      {
        control: 'tempo',
        targetValue: 120,
        instruction: 'Set TEMPO to 120 BPM',
        explanation: 'Standard tempo for bass lines.',
        manualReference: 'Page 12 - TEMPO',
      },
      {
        control: 'vca_decay',
        targetValue: 200,
        instruction: 'Set VCA DECAY to 200ms',
        explanation: 'Punchy, tight bass notes.',
        manualReference: 'Page 11 - VCA DECAY',
      },
    ],
  },
  {
    id: 'dfam-noise-modulation',
    device: 'dfam',
    name: 'Noise Filter Modulation',
    description: 'Use noise to modulate the filter for gritty, textured percussion.',
    difficulty: 'advanced',
    source: 'Moog DFAM Manual - Noise/VCF Mod',
    estimatedMinutes: 7,
    prerequisites: ['dfam-snare-basics'],
    tags: ['noise', 'modulation', 'experimental', 'advanced'],
    steps: [
      {
        control: 'vco1_frequency',
        targetValue: 0,
        instruction: 'Set VCO 1 FREQ to center',
        explanation: 'Mid-range starting point.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'vco1_level',
        targetValue: 100,
        instruction: 'Set VCO 1 level to 100%',
        explanation: 'Full oscillator to hear the filter modulation effect.',
        manualReference: 'Page 8 - MIXER',
      },
      {
        control: 'noise_vcf_mod',
        targetValue: 70,
        instruction: 'Set NOISE/VCF MOD to 70%',
        explanation: 'This routes noise to modulate the filter cutoff, creating random, gritty movement.',
        manualReference: 'Page 10 - NOISE/VCF MOD',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 2000,
        instruction: 'Set CUTOFF to 2000 Hz',
        explanation: 'Starting cutoff for the noise modulation.',
        manualReference: 'Page 9 - FILTER CUTOFF',
      },
      {
        control: 'vcf_resonance',
        targetValue: 60,
        instruction: 'Set RESONANCE to 60%',
        explanation: 'Higher resonance emphasizes the filter movement.',
        manualReference: 'Page 9 - RESONANCE',
      },
      {
        control: 'vca_decay',
        targetValue: 500,
        instruction: 'Set VCA DECAY to 500ms',
        explanation: 'Long enough to hear the noise modulation character.',
        manualReference: 'Page 11 - VCA DECAY',
      },
    ],
  },
  {
    id: 'dfam-velocity-accents',
    device: 'dfam',
    name: 'Velocity Accents',
    description: 'Program dynamic patterns using per-step velocity.',
    difficulty: 'advanced',
    source: 'Moog DFAM Manual - Sequencer Velocity',
    estimatedMinutes: 8,
    tags: ['sequencer', 'velocity', 'dynamics', 'advanced'],
    steps: [
      {
        control: 'tempo',
        targetValue: 140,
        instruction: 'Set TEMPO to 140 BPM',
        explanation: 'Faster tempo to hear the accent pattern clearly.',
        manualReference: 'Page 12 - TEMPO',
      },
      {
        control: 'velocity_1',
        targetValue: 100,
        instruction: 'Set Velocity 1 to 100% (accent)',
        explanation: 'First beat accent.',
        manualReference: 'Page 12 - SEQUENCER',
      },
      {
        control: 'velocity_2',
        targetValue: 40,
        instruction: 'Set Velocity 2 to 40% (ghost note)',
        explanation: 'Soft ghost note.',
        manualReference: 'Page 12 - SEQUENCER',
      },
      {
        control: 'velocity_3',
        targetValue: 60,
        instruction: 'Set Velocity 3 to 60%',
        explanation: 'Medium level.',
        manualReference: 'Page 12 - SEQUENCER',
      },
      {
        control: 'velocity_4',
        targetValue: 40,
        instruction: 'Set Velocity 4 to 40%',
        explanation: 'Another ghost note.',
        manualReference: 'Page 12 - SEQUENCER',
      },
      {
        control: 'velocity_5',
        targetValue: 100,
        instruction: 'Set Velocity 5 to 100% (accent)',
        explanation: 'Second accent on the "and" of 2.',
        manualReference: 'Page 12 - SEQUENCER',
      },
      {
        control: 'velocity_6',
        targetValue: 40,
        instruction: 'Set Velocity 6 to 40%',
        explanation: 'Ghost note.',
        manualReference: 'Page 12 - SEQUENCER',
      },
      {
        control: 'velocity_7',
        targetValue: 80,
        instruction: 'Set Velocity 7 to 80%',
        explanation: 'Slightly accented.',
        manualReference: 'Page 12 - SEQUENCER',
      },
      {
        control: 'velocity_8',
        targetValue: 40,
        instruction: 'Set Velocity 8 to 40%',
        explanation: 'Ghost note before the loop.',
        manualReference: 'Page 12 - SEQUENCER',
      },
    ],
  },
  {
    id: 'dfam-zap-laser',
    device: 'dfam',
    name: 'Zap/Laser Effect',
    description: 'Create dramatic pitch-sweeping laser and zap sounds.',
    difficulty: 'intermediate',
    source: 'Moog DFAM Manual - Patch Ideas',
    estimatedMinutes: 5,
    tags: ['sfx', 'laser', 'zap', 'intermediate'],
    steps: [
      {
        control: 'vco1_frequency',
        targetValue: 3,
        instruction: 'Set VCO 1 FREQ to +3 octaves',
        explanation: 'Start high for dramatic downward sweep.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'vco1_eg_amount',
        targetValue: -100,
        instruction: 'Set VCO 1 EG AMT to -100%',
        explanation: 'Negative envelope sweeps pitch DOWN over time for the classic laser effect.',
        manualReference: 'Page 7 - VCO EG AMOUNT',
      },
      {
        control: 'vco_decay',
        targetValue: 500,
        instruction: 'Set VCO DECAY to 500ms',
        explanation: 'Medium decay for a satisfying sweep length.',
        manualReference: 'Page 8 - VCO DECAY',
      },
      {
        control: 'vco1_wave',
        targetValue: 1,
        instruction: 'Set VCO 1 WAVE to SQR (Square)',
        explanation: 'Square wave for a more aggressive, buzzier laser.',
        manualReference: 'Page 6 - WAVEFORM SELECT',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 10000,
        instruction: 'Set CUTOFF to 10000 Hz',
        explanation: 'Wide open filter to let all frequencies through.',
        manualReference: 'Page 9 - FILTER CUTOFF',
      },
      {
        control: 'vca_decay',
        targetValue: 600,
        instruction: 'Set VCA DECAY to 600ms',
        explanation: 'Match the pitch sweep duration.',
        manualReference: 'Page 11 - VCA DECAY',
      },
    ],
  },
  {
    id: 'dfam-conga',
    device: 'dfam',
    name: 'Analog Conga',
    description: 'Create warm, resonant conga drums with pitch bend.',
    difficulty: 'intermediate',
    source: 'Moog DFAM Manual - Patch Ideas',
    estimatedMinutes: 7,
    tags: ['conga', 'percussion', 'world', 'intermediate'],
    steps: [
      {
        control: 'vco1_frequency',
        targetValue: 1,
        instruction: 'Set VCO 1 FREQ to +1 octave',
        explanation: 'Congas sit in the mid-frequency range.',
        manualReference: 'Page 6 - VCO FREQUENCY',
      },
      {
        control: 'vco1_wave',
        targetValue: 0,
        instruction: 'Set VCO 1 WAVE to TRI (Triangle)',
        explanation: 'Triangle wave for a warm, round conga tone.',
        manualReference: 'Page 6 - WAVEFORM SELECT',
      },
      {
        control: 'vco1_eg_amount',
        targetValue: 40,
        instruction: 'Set VCO 1 EG AMT to +40%',
        explanation: 'Subtle pitch bend for natural conga attack.',
        manualReference: 'Page 7 - VCO EG AMOUNT',
      },
      {
        control: 'vco_decay',
        targetValue: 200,
        instruction: 'Set VCO DECAY to 200ms',
        explanation: 'Quick pitch bend.',
        manualReference: 'Page 8 - VCO DECAY',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 2500,
        instruction: 'Set CUTOFF to 2500 Hz',
        explanation: 'Allow warm harmonics through.',
        manualReference: 'Page 9 - FILTER CUTOFF',
      },
      {
        control: 'vcf_resonance',
        targetValue: 40,
        instruction: 'Set RESONANCE to 40%',
        explanation: 'Adds body and warmth to the conga.',
        manualReference: 'Page 9 - RESONANCE',
      },
      {
        control: 'vcf_eg_amount',
        targetValue: 30,
        instruction: 'Set VCF EG AMT to +30%',
        explanation: 'Small filter sweep for attack definition.',
        manualReference: 'Page 10 - VCF EG AMOUNT',
      },
      {
        control: 'vca_decay',
        targetValue: 350,
        instruction: 'Set VCA DECAY to 350ms',
        explanation: 'Natural conga sustain.',
        manualReference: 'Page 11 - VCA DECAY',
      },
    ],
  },
];
