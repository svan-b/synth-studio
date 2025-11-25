// ============================================================================
// DFAM Coordinate-Based Positioning System
// All coordinates based on Moog DFAM Manual and hardware measurements
// Reference: https://api.moogmusic.com/sites/default/files/2018-04/DFAM_Manual.pdf
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
const ROW1_Y = 20;      // Top row of main knobs (about 19% from top)
const ROW2_Y = 50;      // Second row of main knobs (about 47% from top)
const SWITCH_Y1 = 36;   // Switches under row 1 knobs
const SWITCH_Y2 = 66;   // Switches under row 2 knobs
const SEQ_LABEL_Y = 75; // Step numbers
const SEQ_PITCH_Y = 85; // Pitch knobs row
const SEQ_LED_Y = 94;   // LED row
const SEQ_VEL_Y = 102;  // Velocity knobs row

// Column X positions for main sections - based on 305mm panel width
// Controls section is about 215mm wide, patch bay is about 75mm on right
const VCO_SECTION_X = 18;
const VCO1_SECTION_X = 55;
const MIXER_SECTION_X = 100;
const FILTER_SECTION_X = 130;
const VCA_SECTION_X = 185;
const SEQ_SECTION_X = 18;
const PATCHBAY_X = 220;

export const CONTROL_POSITIONS: Record<string, ControlPosition> = {
  // =========================================================================
  // ROW 1: VCO DECAY, VCO1 EG, VCO1 FREQ, VCO1 LEVEL, NOISE, CUTOFF, RES, VCA EG, VOL
  // =========================================================================

  // VCO Envelope Section (leftmost)
  vco_decay: { id: 'vco_decay', x: VCO_SECTION_X, y: ROW1_Y },
  seq_pitch_mod: { id: 'seq_pitch_mod', x: VCO_SECTION_X, y: SWITCH_Y1 },

  // VCO 1 Section
  vco1_eg_amount: { id: 'vco1_eg_amount', x: VCO1_SECTION_X, y: ROW1_Y },
  vco1_frequency: { id: 'vco1_frequency', x: VCO1_SECTION_X + 25, y: ROW1_Y },
  vco1_wave: { id: 'vco1_wave', x: VCO1_SECTION_X + 25, y: SWITCH_Y1 },

  // Mixer Section (between VCO and VCF)
  vco1_level: { id: 'vco1_level', x: MIXER_SECTION_X, y: ROW1_Y },
  noise_level: { id: 'noise_level', x: MIXER_SECTION_X + 20, y: ROW1_Y },

  // Filter Section
  vcf_cutoff: { id: 'vcf_cutoff', x: FILTER_SECTION_X, y: ROW1_Y },
  vcf_mode: { id: 'vcf_mode', x: FILTER_SECTION_X, y: SWITCH_Y1 },
  vcf_resonance: { id: 'vcf_resonance', x: FILTER_SECTION_X + 30, y: ROW1_Y },

  // VCA Section (rightmost before patch bay)
  vca_attack_mode: { id: 'vca_attack_mode', x: VCA_SECTION_X, y: ROW1_Y },
  volume: { id: 'volume', x: VCA_SECTION_X + 22, y: ROW1_Y },

  // =========================================================================
  // ROW 2: FM, VCO2 EG, VCO2 FREQ, VCO2 LEVEL, VCF DECAY, VCF EG, NOISE MOD, VCA DECAY
  // =========================================================================

  // FM Section
  fm_amount: { id: 'fm_amount', x: VCO_SECTION_X, y: ROW2_Y },
  hard_sync: { id: 'hard_sync', x: VCO_SECTION_X, y: SWITCH_Y2 },

  // VCO 2 Section (aligned with VCO 1)
  vco2_eg_amount: { id: 'vco2_eg_amount', x: VCO1_SECTION_X, y: ROW2_Y },
  vco2_frequency: { id: 'vco2_frequency', x: VCO1_SECTION_X + 25, y: ROW2_Y },
  vco2_wave: { id: 'vco2_wave', x: VCO1_SECTION_X + 25, y: SWITCH_Y2 },
  vco2_level: { id: 'vco2_level', x: MIXER_SECTION_X, y: ROW2_Y },

  // VCF Envelope Section (aligned with VCF)
  vcf_decay: { id: 'vcf_decay', x: FILTER_SECTION_X, y: ROW2_Y },
  vcf_eg_amount: { id: 'vcf_eg_amount', x: FILTER_SECTION_X + 30, y: ROW2_Y },
  noise_vcf_mod: { id: 'noise_vcf_mod', x: FILTER_SECTION_X + 55, y: ROW2_Y },

  // VCA Envelope Section
  vca_decay: { id: 'vca_decay', x: VCA_SECTION_X + 22, y: ROW2_Y },

  // =========================================================================
  // SEQUENCER SECTION (bottom third of panel)
  // =========================================================================

  // Transport controls (left side)
  trigger: { id: 'trigger', x: SEQ_SECTION_X, y: SEQ_PITCH_Y },
  tempo: { id: 'tempo', x: SEQ_SECTION_X + 28, y: SEQ_PITCH_Y },
  run_stop: { id: 'run_stop', x: SEQ_SECTION_X + 10, y: SEQ_VEL_Y + 3 },
  advance: { id: 'advance', x: SEQ_SECTION_X + 35, y: SEQ_VEL_Y + 3 },

  // Step sequencer - 8 pitch knobs (evenly spaced starting after transport)
  // Spacing: each step is about 17mm apart
  pitch_1: { id: 'pitch_1', x: 68, y: SEQ_PITCH_Y },
  pitch_2: { id: 'pitch_2', x: 85, y: SEQ_PITCH_Y },
  pitch_3: { id: 'pitch_3', x: 102, y: SEQ_PITCH_Y },
  pitch_4: { id: 'pitch_4', x: 119, y: SEQ_PITCH_Y },
  pitch_5: { id: 'pitch_5', x: 136, y: SEQ_PITCH_Y },
  pitch_6: { id: 'pitch_6', x: 153, y: SEQ_PITCH_Y },
  pitch_7: { id: 'pitch_7', x: 170, y: SEQ_PITCH_Y },
  pitch_8: { id: 'pitch_8', x: 187, y: SEQ_PITCH_Y },

  // Step sequencer - 8 velocity knobs (aligned directly below pitch knobs)
  velocity_1: { id: 'velocity_1', x: 68, y: SEQ_VEL_Y },
  velocity_2: { id: 'velocity_2', x: 85, y: SEQ_VEL_Y },
  velocity_3: { id: 'velocity_3', x: 102, y: SEQ_VEL_Y },
  velocity_4: { id: 'velocity_4', x: 119, y: SEQ_VEL_Y },
  velocity_5: { id: 'velocity_5', x: 136, y: SEQ_VEL_Y },
  velocity_6: { id: 'velocity_6', x: 153, y: SEQ_VEL_Y },
  velocity_7: { id: 'velocity_7', x: 170, y: SEQ_VEL_Y },
  velocity_8: { id: 'velocity_8', x: 187, y: SEQ_VEL_Y },
};

// LED positions for sequencer (aligned with pitch/velocity knobs)
export const SEQUENCER_LED_POSITIONS = [
  { step: 1, x: 68, y: SEQ_LED_Y },
  { step: 2, x: 85, y: SEQ_LED_Y },
  { step: 3, x: 102, y: SEQ_LED_Y },
  { step: 4, x: 119, y: SEQ_LED_Y },
  { step: 5, x: 136, y: SEQ_LED_Y },
  { step: 6, x: 153, y: SEQ_LED_Y },
  { step: 7, x: 170, y: SEQ_LED_Y },
  { step: 8, x: 187, y: SEQ_LED_Y },
];

// ============================================================================
// PATCH BAY POSITIONS
// 3 columns × 8 rows maximum
// Based on DFAM Manual page 15-16
// ============================================================================

const PATCH_START_X = 230;  // Start of patch bay section (mm)
const PATCH_START_Y = 12;   // Top of patch bay (mm)
const PATCH_COL_SPACING = 20;  // mm between column centers
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
// Column 0: Left input column
// Column 1: Middle input column
// Column 2: Right output column
export const PATCH_JACK_POSITIONS: PatchJackPosition[] = [
  // Column 0 - Left Input Column (8 jacks)
  { id: 'in_trigger', label: 'TRIGGER', column: 0, row: 0, type: 'input', ...getJackPosition(0, 0) },
  { id: 'in_vca_cv', label: 'VCA CV', column: 0, row: 1, type: 'input', ...getJackPosition(0, 1) },
  { id: 'in_velocity', label: 'VELOCITY', column: 0, row: 2, type: 'input', ...getJackPosition(0, 2) },
  { id: 'in_vca_decay', label: 'VCA DECAY', column: 0, row: 3, type: 'input', ...getJackPosition(0, 3) },
  { id: 'in_ext_audio', label: 'EXT AUDIO', column: 0, row: 4, type: 'input', ...getJackPosition(0, 4) },
  { id: 'in_vcf_decay', label: 'VCF DECAY', column: 0, row: 5, type: 'input', ...getJackPosition(0, 5) },
  { id: 'in_noise_level', label: 'NOISE', column: 0, row: 6, type: 'input', ...getJackPosition(0, 6) },
  { id: 'in_vco_decay', label: 'VCO DECAY', column: 0, row: 7, type: 'input', ...getJackPosition(0, 7) },

  // Column 1 - Middle Input Column (7 jacks + 1 empty)
  { id: 'in_vcf_mod', label: 'VCF MOD', column: 1, row: 0, type: 'input', ...getJackPosition(1, 0) },
  { id: 'in_vco1_cv', label: 'VCO 1 CV', column: 1, row: 1, type: 'input', ...getJackPosition(1, 1) },
  { id: 'in_fm_amount', label: '1→2 FM', column: 1, row: 2, type: 'input', ...getJackPosition(1, 2) },
  { id: 'in_vco2_cv', label: 'VCO 2 CV', column: 1, row: 3, type: 'input', ...getJackPosition(1, 3) },
  { id: 'in_tempo', label: 'TEMPO', column: 1, row: 4, type: 'input', ...getJackPosition(1, 4) },
  { id: 'in_run_stop', label: 'RUN/STOP', column: 1, row: 5, type: 'input', ...getJackPosition(1, 5) },
  { id: 'in_adv_clock', label: 'ADV/CLK', column: 1, row: 6, type: 'input', ...getJackPosition(1, 6) },
  // Row 7 empty in column 1

  // Column 2 - Output Column (9 jacks, using rows 0-8)
  { id: 'out_vca', label: 'VCA', column: 2, row: 0, type: 'output', ...getJackPosition(2, 0) },
  { id: 'out_vca_eg', label: 'VCA EG', column: 2, row: 1, type: 'output', ...getJackPosition(2, 1) },
  { id: 'out_vcf_eg', label: 'VCF EG', column: 2, row: 2, type: 'output', ...getJackPosition(2, 2) },
  { id: 'out_vco_eg', label: 'VCO EG', column: 2, row: 3, type: 'output', ...getJackPosition(2, 3) },
  { id: 'out_vco1', label: 'VCO 1', column: 2, row: 4, type: 'output', ...getJackPosition(2, 4) },
  { id: 'out_vco2', label: 'VCO 2', column: 2, row: 5, type: 'output', ...getJackPosition(2, 5) },
  { id: 'out_trigger', label: 'TRIGGER', column: 2, row: 6, type: 'output', ...getJackPosition(2, 6) },
  { id: 'out_velocity', label: 'VELOCITY', column: 2, row: 7, type: 'output', ...getJackPosition(2, 7) },
  { id: 'out_pitch', label: 'PITCH', column: 2, row: 8, type: 'output', x: PATCH_START_X + 2 * PATCH_COL_SPACING, y: PATCH_START_Y + 8 * PATCH_ROW_SPACING },
];

// ============================================================================
// LABEL POSITIONS (for section headers)
// ============================================================================

export const SECTION_LABELS = {
  vcoEnvelope: { text: 'VCO\nENVELOPE', x: VCO_SECTION_X, y: 5 },
  vco1: { text: 'VCO 1', x: VCO_SECTION_X + 42, y: 5 },
  vco2: { text: 'VCO 2', x: VCO_SECTION_X + 42, y: 38 },
  mixer: { text: 'MIXER', x: MIXER_SECTION_X + 9, y: 5 },
  vcf: { text: 'VCF', x: FILTER_SECTION_X + 14, y: 5 },
  vcfEnvelope: { text: 'VCF\nENVELOPE', x: FILTER_SECTION_X + 28, y: 38 },
  vca: { text: 'VCA', x: VCA_SECTION_X + 11, y: 5 },
  sequencer: { text: 'SEQUENCER', x: SEQ_SECTION_X + 80, y: 68 },
  patchBay: { text: 'PATCH BAY', x: PATCH_START_X + 20, y: 3 },
};

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
 */
export function getKnobSize(controlId: string): 'large' | 'medium' | 'small' {
  const largeKnobs = ['vco_decay', 'vco1_frequency', 'vco2_frequency', 'vcf_cutoff', 'vcf_resonance', 'vcf_decay', 'vca_decay', 'volume', 'tempo', 'fm_amount'];
  const smallKnobs = ['vco1_eg_amount', 'vco2_eg_amount', 'vco1_level', 'vco2_level', 'noise_level', 'vcf_eg_amount', 'noise_vcf_mod',
    'pitch_1', 'pitch_2', 'pitch_3', 'pitch_4', 'pitch_5', 'pitch_6', 'pitch_7', 'pitch_8',
    'velocity_1', 'velocity_2', 'velocity_3', 'velocity_4', 'velocity_5', 'velocity_6', 'velocity_7', 'velocity_8'];

  if (largeKnobs.includes(controlId)) return 'large';
  if (smallKnobs.includes(controlId)) return 'small';
  return 'medium';
}
