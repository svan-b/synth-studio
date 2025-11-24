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
      options: ['OFF', 'ON'],
      default: 0,
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
      options: ['VCO1', 'BOTH', 'VCO2'],
      default: 1,  // BOTH is default
      manualReference: 'Page 9 - SEQ PITCH MOD',
    },

    // =========================================================================
    // MIXER SECTION
    // =========================================================================

    vco1_level: {
      type: 'knob',
      label: 'VCO 1',
      description: 'Level of Oscillator 1 in the mix',
      min: 0,
      max: 100,
      default: 75,
      units: '%',
      size: 'medium',
      manualReference: 'Page 8 - MIXER',
    },

    vco2_level: {
      type: 'knob',
      label: 'VCO 2',
      description: 'Level of Oscillator 2 in the mix',
      min: 0,
      max: 100,
      default: 50,
      units: '%',
      size: 'medium',
      manualReference: 'Page 8 - MIXER',
    },

    noise_level: {
      type: 'knob',
      label: 'NOISE',
      description: 'Level of white noise generator in the mix. Essential for snares and hi-hats.',
      min: 0,
      max: 100,
      default: 0,
      units: '%',
      size: 'medium',
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
  // Patch Bay Configuration
  // 24 points total: 15 inputs + 9 outputs (per Moog manual)
  // ---------------------------------------------------------------------------
  patchBay: {
    inputs: [
      // Column 0 (Left)
      { id: 'in_trigger', label: 'TRIGGER', jackType: 'input', signalType: 'trigger', column: 0, row: 0 },
      { id: 'in_vca_cv', label: 'VCA CV', jackType: 'input', signalType: 'cv', column: 0, row: 1 },
      { id: 'in_velocity', label: 'VELOCITY', jackType: 'input', signalType: 'cv', column: 0, row: 2 },
      { id: 'in_vca_decay', label: 'VCA DECAY', jackType: 'input', signalType: 'cv', column: 0, row: 3 },
      { id: 'in_ext_audio', label: 'EXT AUDIO', jackType: 'input', signalType: 'audio', column: 0, row: 4 },

      // Column 1 (Middle)
      { id: 'in_vcf_decay', label: 'VCF DECAY', jackType: 'input', signalType: 'cv', column: 1, row: 0 },
      { id: 'in_noise_level', label: 'NOISE LEVEL', jackType: 'input', signalType: 'cv', column: 1, row: 1 },
      { id: 'in_vco_decay', label: 'VCO DECAY', jackType: 'input', signalType: 'cv', column: 1, row: 2 },
      { id: 'in_vcf_mod', label: 'VCF MOD', jackType: 'input', signalType: 'cv', column: 1, row: 3 },
      { id: 'in_vco1_cv', label: 'VCO 1 CV', jackType: 'input', signalType: 'cv', column: 1, row: 4 },

      // Column 2 (Right inputs)
      { id: 'in_fm_amount', label: '1→2 FM AMT', jackType: 'input', signalType: 'cv', column: 2, row: 0 },
      { id: 'in_vco2_cv', label: 'VCO 2 CV', jackType: 'input', signalType: 'cv', column: 2, row: 1 },
      { id: 'in_tempo', label: 'TEMPO', jackType: 'input', signalType: 'cv', column: 2, row: 2 },
      { id: 'in_run_stop', label: 'RUN/STOP', jackType: 'input', signalType: 'gate', column: 2, row: 3 },
      { id: 'in_adv_clock', label: 'ADV/CLOCK', jackType: 'input', signalType: 'clock', column: 2, row: 4 },
    ],
    outputs: [
      // Column 3 (Outputs)
      { id: 'out_vca', label: 'VCA', jackType: 'output', signalType: 'audio', column: 3, row: 0 },
      { id: 'out_vca_eg', label: 'VCA EG', jackType: 'output', signalType: 'cv', column: 3, row: 1 },
      { id: 'out_vcf_eg', label: 'VCF EG', jackType: 'output', signalType: 'cv', column: 3, row: 2 },
      { id: 'out_vco_eg', label: 'VCO EG', jackType: 'output', signalType: 'cv', column: 3, row: 3 },
      { id: 'out_vco1', label: 'VCO 1', jackType: 'output', signalType: 'audio', column: 3, row: 4 },
      { id: 'out_vco2', label: 'VCO 2', jackType: 'output', signalType: 'audio', column: 3, row: 5 },
      { id: 'out_trigger', label: 'TRIGGER', jackType: 'output', signalType: 'trigger', column: 3, row: 6 },
      { id: 'out_velocity', label: 'VELOCITY', jackType: 'output', signalType: 'cv', column: 3, row: 7 },
      { id: 'out_pitch', label: 'PITCH', jackType: 'output', signalType: 'cv', column: 3, row: 8 },
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
        hard_sync: 0,
        vco_decay: 300,
        seq_pitch_mod: 1,
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
        hard_sync: 0,
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
        hard_sync: 0,
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
        hard_sync: 0,
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
  {
    id: 'dfam-classic-kick',
    device: 'dfam',
    name: 'Classic Kick Drum',
    description: 'Learn to create a punchy, 909-style kick drum by understanding pitch envelopes and filter sweeps.',
    difficulty: 'beginner',
    source: 'manual',
    estimatedMinutes: 5,
    tags: ['kick', 'bass', 'percussion', 'beginner'],
    steps: [
      {
        control: 'vco1_frequency',
        targetValue: -2,
        instruction: 'Set VCO 1 FREQ to -2 octaves for a low fundamental tone',
        explanation: 'Kick drums need a low base pitch. The -2 octave setting gives us a deep, subby foundation.',
      },
      {
        control: 'vco1_eg_amount',
        targetValue: 80,
        instruction: 'Set VCO 1 EG AMT to +80%',
        explanation: 'This is the secret to a punchy kick! The envelope sweeps the pitch from high to low, creating that classic "thump" attack.',
      },
      {
        control: 'vco_decay',
        targetValue: 150,
        instruction: 'Set VCO DECAY to 150ms',
        explanation: 'A short decay makes the pitch sweep quick and punchy. Longer decays create more "laser" sounds.',
      },
      {
        control: 'vco1_level',
        targetValue: 100,
        instruction: 'Set VCO 1 level to 100%',
        explanation: 'We want Oscillator 1 to be the dominant sound source.',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 800,
        instruction: 'Set filter CUTOFF to around 800 Hz',
        explanation: 'This rolls off the high frequencies, keeping the kick deep and controlled.',
      },
      {
        control: 'vcf_eg_amount',
        targetValue: 60,
        instruction: 'Set VCF EG AMT to +60%',
        explanation: 'The filter envelope adds a "click" to the attack by briefly opening the filter.',
      },
      {
        control: 'vcf_decay',
        targetValue: 200,
        instruction: 'Set VCF DECAY to 200ms',
        explanation: 'Slightly longer than the VCO decay for a smooth, natural envelope.',
      },
      {
        control: 'vca_decay',
        targetValue: 300,
        instruction: 'Set VCA DECAY to 300ms',
        explanation: 'This controls how long the kick rings out. 300ms gives a tight, controlled sound.',
      },
      {
        control: 'vca_attack_mode',
        targetValue: 0,
        instruction: 'Set VCA EG to FAST',
        explanation: 'Fast attack (1ms) gives the kick an immediate, punchy transient.',
      },
    ],
  },
  {
    id: 'dfam-snare-basics',
    device: 'dfam',
    name: 'Electronic Snare',
    description: 'Create a snappy electronic snare using noise and dual oscillators.',
    difficulty: 'beginner',
    source: 'manual',
    estimatedMinutes: 7,
    tags: ['snare', 'percussion', 'noise', 'beginner'],
    steps: [
      {
        control: 'vco1_frequency',
        targetValue: 1,
        instruction: 'Set VCO 1 FREQ to +1 octave',
        explanation: 'Snares have a higher fundamental than kicks.',
      },
      {
        control: 'noise_level',
        targetValue: 80,
        instruction: 'Set NOISE level to 80%',
        explanation: 'The noise is essential for snare character - it creates the "snap" and "rattle" of a snare.',
      },
      {
        control: 'vco1_level',
        targetValue: 50,
        instruction: 'Set VCO 1 level to 50%',
        explanation: 'Balance the oscillator with the noise.',
      },
      {
        control: 'vco1_eg_amount',
        targetValue: 50,
        instruction: 'Set VCO 1 EG AMT to +50%',
        explanation: 'A moderate pitch sweep adds body to the snare attack.',
      },
      {
        control: 'vco_decay',
        targetValue: 80,
        instruction: 'Set VCO DECAY to 80ms',
        explanation: 'Short and snappy for a tight snare sound.',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 4000,
        instruction: 'Set filter CUTOFF to 4000 Hz',
        explanation: 'Higher than a kick to let the noise brightness through.',
      },
      {
        control: 'vca_decay',
        targetValue: 150,
        instruction: 'Set VCA DECAY to 150ms',
        explanation: 'Short decay keeps the snare tight and punchy.',
      },
    ],
  },
  {
    id: 'dfam-fm-percussion',
    device: 'dfam',
    name: 'FM Metallic Sounds',
    description: 'Use frequency modulation to create bell-like, metallic percussion.',
    difficulty: 'intermediate',
    source: 'community',
    estimatedMinutes: 8,
    prerequisites: ['dfam-classic-kick'],
    tags: ['fm', 'metallic', 'bell', 'hi-hat', 'intermediate'],
    steps: [
      {
        control: 'vco1_frequency',
        targetValue: 2,
        instruction: 'Set VCO 1 FREQ to +2 octaves',
        explanation: 'Higher pitches work better for metallic sounds.',
      },
      {
        control: 'vco2_frequency',
        targetValue: 2.7,
        instruction: 'Set VCO 2 FREQ to +2.7 octaves',
        explanation: 'A non-integer ratio between oscillators creates inharmonic, metallic tones.',
      },
      {
        control: 'fm_amount',
        targetValue: 60,
        instruction: 'Set 1→2 FM AMT to 60%',
        explanation: 'FM creates complex sidebands that give bells and cymbals their shimmering quality.',
      },
      {
        control: 'vco1_level',
        targetValue: 0,
        instruction: 'Set VCO 1 level to 0%',
        explanation: 'We only want to hear VCO 2 (the modulated oscillator).',
      },
      {
        control: 'vco2_level',
        targetValue: 100,
        instruction: 'Set VCO 2 level to 100%',
        explanation: 'VCO 2 carries all the FM character.',
      },
      {
        control: 'vcf_cutoff',
        targetValue: 8000,
        instruction: 'Set CUTOFF to 8000 Hz',
        explanation: 'Let the high harmonics through for that metallic shimmer.',
      },
      {
        control: 'vca_decay',
        targetValue: 400,
        instruction: 'Set VCA DECAY to 400ms',
        explanation: 'Longer decay lets the bell-like tone ring out.',
      },
    ],
  },
];
