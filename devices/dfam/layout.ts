// ============================================================================
// DFAM panel layout
// All x/y in millimetres from the top-left of the black panel (wooden cheeks
// excluded), matching the Moog DFAM manual panel diagram (p.5) and the patch
// bay chart (p.15-16). Control x/y = control centre.
// Reference: https://api.moogmusic.com/sites/default/files/2018-04/DFAM_Manual.pdf
// ============================================================================

import type { PanelElement, PanelLayout } from '@/types/panel';

// Knob cap diameters (mm) - the hardware uses three sizes
const LARGE = 17.8;
const MEDIUM = 13.3;
const SMALL = 8.9;

const ROW1_Y = 18;
const ROW2_Y = 48;
const SWITCH_Y1 = 35;
const SWITCH_Y2 = 63;
const SEQ_PITCH_Y = 79;
const SEQ_LED_Y = 86;
const SEQ_VEL_Y = 93;
const STEP_X = (i: number) => 105 + i * 15;

const knob = (control: string, x: number, y: number, diameter = LARGE, extra: Partial<Extract<PanelElement, { kind: 'knob' }>> = {}): PanelElement => ({
  kind: 'knob', control, x, y, diameter, variant: 'moog-silver', ...extra,
});
const sw = (control: string, x: number, y: number): PanelElement => ({ kind: 'switch', control, x, y });

// Patch bay: 3 columns x 8 rows, IN | IN | OUT on rows 1-6
const PB_X = (col: number) => 253 + col * 18;
const PB_Y = (row: number) => 21.5 + row * 11;
const PATCH_GRID: [string, number, number][] = [
  ['in_trigger', 0, 0], ['in_vca_cv', 1, 0], ['out_vca', 2, 0],
  ['in_velocity', 0, 1], ['in_vca_decay', 1, 1], ['out_vca_eg', 2, 1],
  ['in_ext_audio', 0, 2], ['in_vcf_decay', 1, 2], ['out_vcf_eg', 2, 2],
  ['in_noise_level', 0, 3], ['in_vco_decay', 1, 3], ['out_vco_eg', 2, 3],
  ['in_vcf_mod', 0, 4], ['in_vco1_cv', 1, 4], ['out_vco1', 2, 4],
  ['in_fm_amount', 0, 5], ['in_vco2_cv', 1, 5], ['out_vco2', 2, 5],
  ['in_tempo', 0, 6], ['in_run_stop', 1, 6], ['in_adv_clock', 2, 6],
  ['out_trigger', 0, 7], ['out_velocity', 1, 7], ['out_pitch', 2, 7],
];

const elements: PanelElement[] = [
  // --- Patch bay frame --------------------------------------------------------
  { kind: 'section', x: 240, y: 8, w: 62, h: 98, background: '#0a0a0a', radius: 1.5 },
  ...[0, 1, 2].map((c): PanelElement => ({ kind: 'section', x: PB_X(c) - 8.5, y: 14, w: 17, h: 89, background: '#0d0d0d', radius: 1.2 })),
  { kind: 'label', text: 'IN', x: 268.5, y: 10.8, size: 8, color: '#9ca3af' },
  { kind: 'label', text: '/', x: 271.5, y: 11, size: 8, color: '#6b7280' },
  { kind: 'label', text: 'OUT', x: 276, y: 11, size: 8, invert: true },
  ...PATCH_GRID.map(([jack, col, row]): PanelElement => ({ kind: 'jack', jack, x: PB_X(col), y: PB_Y(row) })),

  // --- Row 1 -------------------------------------------------------------------
  knob('vco_decay', 20, ROW1_Y),
  sw('seq_pitch_mod', 36, SWITCH_Y1),
  knob('vco1_eg_amount', 52, ROW1_Y),
  knob('vco1_frequency', 84, ROW1_Y),
  sw('vco1_wave', 104, 28),
  knob('vco1_level', 124, 20, SMALL),
  knob('noise_level', 124, 38, SMALL),
  sw('vcf_mode', 140, 28),
  knob('vcf_cutoff', 154, ROW1_Y),
  knob('vcf_resonance', 180, ROW1_Y),
  sw('vca_attack_mode', 202, 22),
  knob('volume', 224, ROW1_Y),

  // --- Row 2 -------------------------------------------------------------------
  knob('fm_amount', 20, ROW2_Y),
  sw('hard_sync', 36, SWITCH_Y2),
  knob('vco2_eg_amount', 52, ROW2_Y),
  knob('vco2_frequency', 84, ROW2_Y),
  sw('vco2_wave', 104, 58),
  knob('vco2_level', 124, 56, SMALL),
  knob('vcf_decay', 154, ROW2_Y),
  knob('vcf_eg_amount', 180, ROW2_Y),
  knob('noise_vcf_mod', 200, ROW2_Y, MEDIUM),
  knob('vca_decay', 224, ROW2_Y),

  // --- Transport ----------------------------------------------------------------
  { kind: 'button', control: 'trigger', event: 'trigger', x: 15, y: 76, w: 7.6, color: '#0f2a12', ledColor: '#22c55e', label: 'right' },
  knob('tempo', 50, 76),
  { kind: 'button', control: 'run_stop', x: 35, y: 94, w: 12.7, color: '#3a0909', ledColor: '#ef4444', label: 'none' },
  { kind: 'button', control: 'advance', event: 'advance', x: 65, y: 94, w: 10.2, color: '#0f2a12', ledColor: '#22c55e', label: 'above' },
  { kind: 'led', x: 27, y: 87, size: 2.6, color: '#ff3333', on: ({ values }) => !!values.run_stop },
  { kind: 'label', text: 'RUN / STOP', x: 35, y: 88, size: 6, color: '#9ca3af' },

  // --- Sequencer ----------------------------------------------------------------
  ...Array.from({ length: 8 }, (_, i): PanelElement => ({ kind: 'label', text: String(i + 1), x: STEP_X(i), y: 69.6, size: 9 })),
  { kind: 'label', text: 'PITCH', x: 98, y: 78.2, size: 7, align: 'right', color: '#9ca3af' },
  { kind: 'label', text: 'VELOCITY', x: 98, y: 92, size: 6, align: 'right', color: '#9ca3af' },
  ...Array.from({ length: 8 }, (_, i) => knob(`pitch_${i + 1}`, STEP_X(i), SEQ_PITCH_Y, SMALL, { label: 'none', value: 'hover' })),
  ...Array.from({ length: 8 }, (_, i) => knob(`velocity_${i + 1}`, STEP_X(i), SEQ_VEL_Y, SMALL, { label: 'none' })),
  ...Array.from({ length: 8 }, (_, i): PanelElement => ({
    kind: 'led', x: STEP_X(i), y: SEQ_LED_Y, size: 3.8, color: '#ff3333',
    on: ({ engine }) => (engine.step === i && (engine.playing || (engine.flash as number) > 0) ? 1 : 0),
  })),

  // --- Branding -------------------------------------------------------------------
  { kind: 'label', text: 'DFAM', x: 8, y: 110.3, size: 18, weight: 900, align: 'left', letterSpacing: -0.5 },
  { kind: 'label', text: 'DRUMMER FROM ANOTHER MOTHER', x: 8, y: 114.6, size: 4.5, align: 'left', color: '#4b5563', letterSpacing: 1.5 },
  { kind: 'label', text: 'SEMI-MODULAR ANALOG\nPERCUSSION SYNTHESIZER', x: 120.5, y: 111.8, size: 5, color: '#4b5563', weight: 400 },
  { kind: 'label', text: 'moog', x: 233, y: 111, size: 18, align: 'right', font: 'serif', italic: true, weight: 400 },
];

export const DFAM_LAYOUT: PanelLayout = {
  width: 305,
  height: 116.5,
  pxPerMm: 960 / 305,
  theme: {
    background: '#111',
    text: '#ffffff',
    muted: '#9ca3af',
    cheeks: { width: 7.15, background: 'linear-gradient(90deg, #3d2b1f 0%, #5C4033 50%, #3d2b1f 100%)' },
    frame: { padding: 0, background: '#1a1a1a', radius: 2.5 },
    jack: { ring: '#444', outputLabelBg: '#000', outputLabelText: '#fff' },
  },
  elements,
};
