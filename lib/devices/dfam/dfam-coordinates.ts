// ============================================================================
// DFAM Coordinate-Based Positioning System
// All coordinates based on Moog DFAM Manual and hardware measurements
// Reference: https://api.moogmusic.com/sites/default/files/2018-04/DFAM_Manual.pdf
// ============================================================================
//
// POSITIONING ARCHITECTURE:
// -------------------------
// All x,y coordinates specify the CENTER of each control in millimeters
// from the top-left corner of the black panel (not including wooden cheeks).
//
// The rendering system uses CSS transform: translate(-50%, -50%) to center
// each control at its coordinate. This means:
//   - Control x,y = center of the control element (knob circle, button, switch)
//   - Labels are positioned absolutely ABOVE the control (outside the wrapper)
//   - Value displays are positioned absolutely BELOW the control
//
// To move a control, simply change its x/y values - these directly represent
// where the control's visual center will appear.
// ============================================================================

export interface ControlPosition {
  id: string;
  x: number;  // mm from left edge of black panel
  y: number;  // mm from top edge of black panel
  labelX?: number;  // Optional label offset
  labelY?: number;
}

export interface PatchJackPosition {
  id: string;
  label: string;
  column: number;  // 0, 1, 2
  row: number;     // 0-7
  type: 'input' | 'output';
  x: number;  // mm
  y: number;  // mm
}

// ============================================================================
// PHYSICAL DIMENSIONS (from Moog specs)
// ============================================================================

export const DFAM_DIMENSIONS = {
  // Total unit dimensions
  totalWidth: 319.3,    // mm (including wooden cheeks)
  totalHeight: 133.1,   // mm (including top/bottom bezels)
  totalDepth: 109.2,    // mm

  // Black panel dimensions (the actual control surface)
  panelWidth: 305,      // mm
  panelHeight: 107,     // mm

  // Wooden side cheeks
  cheekWidth: 7.15,     // mm each side ((319.3 - 305) / 2)

  // Top/bottom bezels
  topBezel: 13,         // mm approximate
  bottomBezel: 13.1,    // mm approximate

  // Eurorack compatibility
  eurorackHP: 60,
};

// ============================================================================
// DISPLAY SCALING
// ============================================================================

export const DFAM_DISPLAY = {
  targetWidth: 960,     // px - our target render width for the black panel
  scale: 960 / 305,     // ≈3.148 px per mm

  // Calculate actual display dimensions
  get panelWidthPx() { return this.targetWidth; },
  get panelHeightPx() { return DFAM_DIMENSIONS.panelHeight * this.scale; },  // ≈337px
  get cheekWidthPx() { return DFAM_DIMENSIONS.cheekWidth * this.scale; },    // ≈22.5px
  get totalWidthPx() { return DFAM_DIMENSIONS.totalWidth * this.scale; },    // ≈1005px
};

// Helper to convert mm to pixels
export const mmToPx = (mm: number): number => mm * DFAM_DISPLAY.scale;

// ============================================================================
// KNOB SIZES (actual hardware dimensions in mm)
// ============================================================================

export const KNOB_SIZES = {
  large: {
    diameter: 18,    // mm
    get px() { return mmToPx(this.diameter); },
  },
  medium: {
    diameter: 14,    // mm
    get px() { return mmToPx(this.diameter); },
  },
  small: {
    diameter: 10,    // mm
    get px() { return mmToPx(this.diameter); },
  },
};

// ============================================================================
// CONTROL POSITIONS (in mm from top-left of black panel)
// Layout based on DFAM Manual page 5 panel diagram
// ============================================================================

// Row Y positions (center of controls) - based on 107mm panel height
// Recalculated to match DFAM manual proportions and avoid overlaps
const ROW1_Y = 18;      // Top row of main knobs
const ROW2_Y = 48;      // Second row of main knobs
const SWITCH_Y1 = 35;   // Switches under row 1 knobs (directly below)
const SWITCH_Y2 = 63;   // Switches under row 2 knobs (directly below)

// Sequencer section - compressed to fit within panel with space for branding
const SEQ_LABEL_Y = 73; // Step numbers
const SEQ_PITCH_Y = 79; // Pitch knobs row
const SEQ_LED_Y = 86;   // LED row (between pitch and velocity)
const SEQ_VEL_Y = 93;   // Velocity knobs row - moved up to leave room for value displays

// Column X positions - recalculated for even distribution across 240mm control area
// (Panel is 305mm, but patch bay takes rightmost ~65mm)
// Main knobs spaced ~28mm apart, mixer knobs closer together

export const CONTROL_POSITIONS: Record<string, ControlPosition> = {
  // =========================================================================
  // ROW 1: Evenly distributed across control area
  // =========================================================================

  // VCO DECAY - far left
  vco_decay: { id: 'vco_decay', x: 20, y: ROW1_Y },

  // SEQ PITCH MOD switch - to the right of VCO DECAY
  seq_pitch_mod: { id: 'seq_pitch_mod', x: 36, y: SWITCH_Y1 },

  // VCO1 EG AMOUNT
  vco1_eg_amount: { id: 'vco1_eg_amount', x: 52, y: ROW1_Y },

  // VCO1 FREQUENCY + VCO1 WAVE switch (directly below)
  vco1_frequency: { id: 'vco1_frequency', x: 84, y: ROW1_Y },
  vco1_wave: { id: 'vco1_wave', x: 84, y: SWITCH_Y1 },

  // Mixer section: VCO1 LEVEL, NOISE LEVEL (closer together)
  vco1_level: { id: 'vco1_level', x: 116, y: ROW1_Y },
  noise_level: { id: 'noise_level', x: 138, y: ROW1_Y },

  // VCF CUTOFF + VCF MODE switch (directly below)
  vcf_cutoff: { id: 'vcf_cutoff', x: 162, y: ROW1_Y },
  vcf_mode: { id: 'vcf_mode', x: 162, y: SWITCH_Y1 },

  // VCF RESONANCE
  vcf_resonance: { id: 'vcf_resonance', x: 190, y: ROW1_Y },

  // VCA ATTACK MODE switch (between row 1 and row 2, near VOLUME)
  vca_attack_mode: { id: 'vca_attack_mode', x: 218, y: 32 },

  // VOLUME
  volume: { id: 'volume', x: 218, y: ROW1_Y },

  // =========================================================================
  // ROW 2: Matching row 1 spacing where applicable
  // =========================================================================

  // FM AMOUNT - far left (aligned with VCO DECAY)
  fm_amount: { id: 'fm_amount', x: 20, y: ROW2_Y },

  // HARD SYNC switch - to the right of FM AMOUNT
  hard_sync: { id: 'hard_sync', x: 36, y: SWITCH_Y2 },

  // VCO2 EG AMOUNT (aligned with VCO1 EG AMOUNT)
  vco2_eg_amount: { id: 'vco2_eg_amount', x: 52, y: ROW2_Y },

  // VCO2 FREQUENCY + VCO2 WAVE switch (directly below)
  vco2_frequency: { id: 'vco2_frequency', x: 84, y: ROW2_Y },
  vco2_wave: { id: 'vco2_wave', x: 84, y: SWITCH_Y2 },

  // VCO2 LEVEL (aligned with VCO1 LEVEL)
  vco2_level: { id: 'vco2_level', x: 116, y: ROW2_Y },

  // VCF DECAY
  vcf_decay: { id: 'vcf_decay', x: 146, y: ROW2_Y },

  // VCF EG AMOUNT
  vcf_eg_amount: { id: 'vcf_eg_amount', x: 174, y: ROW2_Y },

  // NOISE VCF MOD
  noise_vcf_mod: { id: 'noise_vcf_mod', x: 200, y: ROW2_Y },

  // VCA DECAY
  vca_decay: { id: 'vca_decay', x: 226, y: ROW2_Y },

  // =========================================================================
  // SEQUENCER SECTION (bottom third of panel)
  // Transport layout based on DFAM Manual:
  //   - TRIGGER: small button at top-left, label to right
  //   - LED indicator below TRIGGER with "RUN/STOP" label to left
  //   - RUN/STOP: large button below the LED indicator
  //   - ADVANCE: positioned to the right, label above
  //   - TEMPO: large knob to the right of transport
  //   - Then 8 step knobs starting at 105mm with 15mm spacing
  // =========================================================================

  // Transport controls - matching DFAM manual layout
  // Layout: TEMPO centered at top, RUN/STOP and ADVANCE parallel below it

  // TRIGGER: small button at top-left
  trigger: { id: 'trigger', x: 15, y: 76 },

  // TEMPO: large knob centered above RUN/STOP and ADVANCE
  tempo: { id: 'tempo', x: 50, y: 76 },

  // RUN/STOP: large button below-left of TEMPO (LED at 10 o'clock rendered separately)
  run_stop: { id: 'run_stop', x: 35, y: 94 },

  // ADVANCE: button below-right of TEMPO, parallel with RUN/STOP
  advance: { id: 'advance', x: 65, y: 94 },

  // Step sequencer - 8 pitch knobs starting at 105mm, 15mm spacing
  pitch_1: { id: 'pitch_1', x: 105, y: SEQ_PITCH_Y },
  pitch_2: { id: 'pitch_2', x: 120, y: SEQ_PITCH_Y },
  pitch_3: { id: 'pitch_3', x: 135, y: SEQ_PITCH_Y },
  pitch_4: { id: 'pitch_4', x: 150, y: SEQ_PITCH_Y },
  pitch_5: { id: 'pitch_5', x: 165, y: SEQ_PITCH_Y },
  pitch_6: { id: 'pitch_6', x: 180, y: SEQ_PITCH_Y },
  pitch_7: { id: 'pitch_7', x: 195, y: SEQ_PITCH_Y },
  pitch_8: { id: 'pitch_8', x: 210, y: SEQ_PITCH_Y },

  // Step sequencer - 8 velocity knobs (aligned directly below pitch knobs)
  velocity_1: { id: 'velocity_1', x: 105, y: SEQ_VEL_Y },
  velocity_2: { id: 'velocity_2', x: 120, y: SEQ_VEL_Y },
  velocity_3: { id: 'velocity_3', x: 135, y: SEQ_VEL_Y },
  velocity_4: { id: 'velocity_4', x: 150, y: SEQ_VEL_Y },
  velocity_5: { id: 'velocity_5', x: 165, y: SEQ_VEL_Y },
  velocity_6: { id: 'velocity_6', x: 180, y: SEQ_VEL_Y },
  velocity_7: { id: 'velocity_7', x: 195, y: SEQ_VEL_Y },
  velocity_8: { id: 'velocity_8', x: 210, y: SEQ_VEL_Y },
};

// LED positions for sequencer (aligned with pitch/velocity knobs at 105mm, 15mm spacing)
export const SEQUENCER_LED_POSITIONS = [
  { step: 1, x: 105, y: SEQ_LED_Y },
  { step: 2, x: 120, y: SEQ_LED_Y },
  { step: 3, x: 135, y: SEQ_LED_Y },
  { step: 4, x: 150, y: SEQ_LED_Y },
  { step: 5, x: 165, y: SEQ_LED_Y },
  { step: 6, x: 180, y: SEQ_LED_Y },
  { step: 7, x: 195, y: SEQ_LED_Y },
  { step: 8, x: 210, y: SEQ_LED_Y },
];

// ============================================================================
// PATCH BAY POSITIONS
// 3 columns × 8 rows maximum
// Based on DFAM Manual page 15-16
// ============================================================================

const PATCH_START_X = 248;  // Start of patch bay section (mm) - right side of panel
const PATCH_START_Y = 12;   // Top of patch bay (mm)
const PATCH_COL_SPACING = 18;  // mm between column centers
const PATCH_ROW_SPACING = 11;  // mm between row centers
const JACK_DIAMETER = 7;    // mm (3.5mm jack visual size)

export const PATCHBAY_LAYOUT = {
  startX: PATCH_START_X,
  startY: PATCH_START_Y,
  columnSpacing: PATCH_COL_SPACING,
  rowSpacing: PATCH_ROW_SPACING,
  jackDiameter: JACK_DIAMETER,
  columns: 3,
  rows: 8,
};

// Calculate jack position from column and row
export const getJackPosition = (column: number, row: number): { x: number; y: number } => ({
  x: PATCH_START_X + column * PATCH_COL_SPACING,
  y: PATCH_START_Y + row * PATCH_ROW_SPACING,
});

// Complete patch jack positions with labels
// Layout from DFAM Manual - organized by ROWS, not columns!
// Rows 1-6: IN | IN | OUT pattern
// Row 7: IN | IN | IN (all inputs)
// Row 8: OUT | OUT | OUT (all outputs)
// Total: 15 inputs + 9 outputs = 24 jacks
export const PATCH_JACK_POSITIONS: PatchJackPosition[] = [
  // Row 0: TRIGGER (in) | VCA CV (in) | VCA (out)
  { id: 'in_trigger', label: 'TRIGGER', column: 0, row: 0, type: 'input', ...getJackPosition(0, 0) },
  { id: 'in_vca_cv', label: 'VCA CV', column: 1, row: 0, type: 'input', ...getJackPosition(1, 0) },
  { id: 'out_vca', label: 'VCA', column: 2, row: 0, type: 'output', ...getJackPosition(2, 0) },

  // Row 1: VELOCITY (in) | VCA DECAY (in) | VCA EG (out)
  { id: 'in_velocity', label: 'VELOCITY', column: 0, row: 1, type: 'input', ...getJackPosition(0, 1) },
  { id: 'in_vca_decay', label: 'VCA DECAY', column: 1, row: 1, type: 'input', ...getJackPosition(1, 1) },
  { id: 'out_vca_eg', label: 'VCA EG', column: 2, row: 1, type: 'output', ...getJackPosition(2, 1) },

  // Row 2: EXT AUDIO (in) | VCF DECAY (in) | VCF EG (out)
  { id: 'in_ext_audio', label: 'EXT AUDIO', column: 0, row: 2, type: 'input', ...getJackPosition(0, 2) },
  { id: 'in_vcf_decay', label: 'VCF DECAY', column: 1, row: 2, type: 'input', ...getJackPosition(1, 2) },
  { id: 'out_vcf_eg', label: 'VCF EG', column: 2, row: 2, type: 'output', ...getJackPosition(2, 2) },

  // Row 3: NOISE LEVEL (in) | VCO DECAY (in) | VCO EG (out)
  { id: 'in_noise_level', label: 'NOISE LEVEL', column: 0, row: 3, type: 'input', ...getJackPosition(0, 3) },
  { id: 'in_vco_decay', label: 'VCO DECAY', column: 1, row: 3, type: 'input', ...getJackPosition(1, 3) },
  { id: 'out_vco_eg', label: 'VCO EG', column: 2, row: 3, type: 'output', ...getJackPosition(2, 3) },

  // Row 4: VCF MOD (in) | VCO 1 CV (in) | VCO 1 (out)
  { id: 'in_vcf_mod', label: 'VCF MOD', column: 0, row: 4, type: 'input', ...getJackPosition(0, 4) },
  { id: 'in_vco1_cv', label: 'VCO 1 CV', column: 1, row: 4, type: 'input', ...getJackPosition(1, 4) },
  { id: 'out_vco1', label: 'VCO 1', column: 2, row: 4, type: 'output', ...getJackPosition(2, 4) },

  // Row 5: 1→2 FM AMT (in) | VCO 2 CV (in) | VCO 2 (out)
  { id: 'in_fm_amount', label: '1→2 FM AMT', column: 0, row: 5, type: 'input', ...getJackPosition(0, 5) },
  { id: 'in_vco2_cv', label: 'VCO 2 CV', column: 1, row: 5, type: 'input', ...getJackPosition(1, 5) },
  { id: 'out_vco2', label: 'VCO 2', column: 2, row: 5, type: 'output', ...getJackPosition(2, 5) },

  // Row 6: TEMPO (in) | RUN/STOP (in) | ADV/CLOCK (in) - ALL INPUTS
  { id: 'in_tempo', label: 'TEMPO', column: 0, row: 6, type: 'input', ...getJackPosition(0, 6) },
  { id: 'in_run_stop', label: 'RUN / STOP', column: 1, row: 6, type: 'input', ...getJackPosition(1, 6) },
  { id: 'in_adv_clock', label: 'ADV / CLOCK', column: 2, row: 6, type: 'input', ...getJackPosition(2, 6) },

  // Row 7: TRIGGER (out) | VELOCITY (out) | PITCH (out) - ALL OUTPUTS
  { id: 'out_trigger', label: 'TRIGGER', column: 0, row: 7, type: 'output', ...getJackPosition(0, 7) },
  { id: 'out_velocity', label: 'VELOCITY', column: 1, row: 7, type: 'output', ...getJackPosition(1, 7) },
  { id: 'out_pitch', label: 'PITCH', column: 2, row: 7, type: 'output', ...getJackPosition(2, 7) },
];

// ============================================================================
// BRANDING POSITIONS
// ============================================================================

export const BRANDING = {
  dfamLogo: { x: 15, y: SEQ_VEL_Y + 15, width: 50 },
  moogLogo: { x: 185, y: SEQ_VEL_Y + 15, width: 40 },
  subtitle: { text: 'DRUMMER FROM ANOTHER MOTHER', x: 100, y: SEQ_VEL_Y + 18 },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get control position in pixels
 */
export function getControlPositionPx(controlId: string): { x: number; y: number } | null {
  const pos = CONTROL_POSITIONS[controlId];
  if (!pos) return null;
  return {
    x: mmToPx(pos.x),
    y: mmToPx(pos.y),
  };
}

/**
 * Get all controls for a section
 */
export function getControlsInSection(sectionName: string): ControlPosition[] {
  const sections: Record<string, string[]> = {
    vcoEnvelope: ['vco_decay', 'seq_pitch_mod'],
    vco1: ['vco1_frequency', 'vco1_eg_amount', 'vco1_wave', 'vco1_level'],
    vco2: ['vco2_frequency', 'vco2_eg_amount', 'vco2_wave', 'vco2_level'],
    fm: ['fm_amount', 'hard_sync'],
    mixer: ['vco1_level', 'vco2_level', 'noise_level'],
    vcf: ['vcf_cutoff', 'vcf_resonance', 'vcf_mode'],
    vcfEnvelope: ['vcf_decay', 'vcf_eg_amount', 'noise_vcf_mod'],
    vca: ['vca_decay', 'vca_attack_mode', 'volume'],
    transport: ['trigger', 'tempo', 'run_stop', 'advance'],
    sequencer: [
      'pitch_1', 'pitch_2', 'pitch_3', 'pitch_4', 'pitch_5', 'pitch_6', 'pitch_7', 'pitch_8',
      'velocity_1', 'velocity_2', 'velocity_3', 'velocity_4', 'velocity_5', 'velocity_6', 'velocity_7', 'velocity_8',
    ],
  };

  const controlIds = sections[sectionName] || [];
  return controlIds.map(id => CONTROL_POSITIONS[id]).filter(Boolean);
}

/**
 * Get knob size for a control
 * Large knobs: main parameter knobs (VCO DECAY, FREQ, EG AMT, CUTOFF, etc.)
 * Medium knobs: mixer level knobs and some modulation knobs
 * Small knobs: sequencer pitch/velocity knobs
 */
export function getKnobSize(controlId: string): 'large' | 'medium' | 'small' {
  const largeKnobs = [
    'vco_decay',
    'vco1_eg_amount',
    'vco1_frequency',
    'vco2_eg_amount',
    'vco2_frequency',
    'fm_amount',
    'vcf_cutoff',
    'vcf_resonance',
    'vcf_decay',
    'vcf_eg_amount',
    'vca_decay',
    'volume',
    'tempo',
  ];

  const mediumKnobs = [
    'vco1_level',
    'vco2_level',
    'noise_level',
    'noise_vcf_mod',
  ];

  // Small knobs: sequencer pitch and velocity only
  const smallKnobs = [
    'pitch_1', 'pitch_2', 'pitch_3', 'pitch_4', 'pitch_5', 'pitch_6', 'pitch_7', 'pitch_8',
    'velocity_1', 'velocity_2', 'velocity_3', 'velocity_4', 'velocity_5', 'velocity_6', 'velocity_7', 'velocity_8',
  ];

  if (largeKnobs.includes(controlId)) return 'large';
  if (mediumKnobs.includes(controlId)) return 'medium';
  if (smallKnobs.includes(controlId)) return 'small';
  return 'medium';
}
