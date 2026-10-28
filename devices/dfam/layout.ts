// ============================================================================
// DFAM panel layout
// All x/y in millimetres from the top-left of the black 60 HP panel (wooden
// cheeks excluded). Control x/y = control centre. Positions follow the panel
// diagram in the DFAM manual as read for the first build; sizes follow the
// knob-cap evidence in REFERENCE.md (14 large caps, 3 small mixer caps,
// 16 small sequencer caps). Long legends are printed on two lines, as on the
// hardware, so neighbouring labels never collide on an iPad.
// ============================================================================

import type { PanelElement, PanelLayout } from '@/types/panel';

// Knob cap diameters (mm)
const LARGE = 17.8;
const MIXER = 8.9;
const SEQ = 9.4;

const ROW1_Y = 18;
const ROW2_Y = 48;
const SEQ_PITCH_Y = 79;
const SEQ_LED_Y = 86.2;
const SEQ_VEL_Y = 93.4;
const STEP_X = (i: number) => 105 + i * 15;

const LEGEND = 7.6;   // px, two-line knob legends

type KnobOpts = Partial<Extract<PanelElement, { kind: 'knob' }>>;
const knob = (control: string, x: number, y: number, diameter = LARGE, extra: KnobOpts = {}): PanelElement => ({
  kind: 'knob', control, x, y, diameter, variant: 'moog-silver', ...extra,
});

/** A large knob with its printed legend above it (one or two lines) */
const main = (control: string, legend: string, x: number, y: number): PanelElement[] => {
  const lines = legend.split('\n').length;
  return [
    knob(control, x, y, LARGE, { label: 'none' }),
    { kind: 'label', text: legend, x, y: y - LARGE / 2 - (lines === 2 ? 3.3 : 2.1), size: LEGEND, letterSpacing: 0.3 },
  ];
};

const sw = (control: string, x: number, y: number, labelText?: string): PanelElement => ({
  kind: 'switch', control, x, y, scale: 1.3, ...(labelText ? { labelText } : {}),
});

// Patch bay: 3 columns x 8 rows - IN | IN | OUT on rows 1-6, three inputs on row 7, three outputs on row 8
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

  // --- Row 1: VCO EG, VCO 1, mixer, VCF, VCA --------------------------------------
  ...main('vco_decay', 'VCO\nDECAY', 20, ROW1_Y),
  sw('seq_pitch_mod', 36, 35.5),
  ...main('vco1_eg_amount', 'VCO 1\nEG AMOUNT', 52, ROW1_Y),
  ...main('vco1_frequency', 'VCO 1\nFREQUENCY', 84, ROW1_Y),
  sw('vco1_wave', 104, 27, 'VCO 1'),
  knob('vco1_level', 124, 20, MIXER),
  knob('noise_level', 124, 38, MIXER),
  sw('vcf_mode', 140, 27, 'VCF'),
  ...main('vcf_cutoff', 'CUTOFF', 154, ROW1_Y),
  ...main('vcf_resonance', 'RESONANCE', 177.3, ROW1_Y),
  sw('vca_attack_mode', 200.7, 22),
  ...main('volume', 'VOLUME', 224, ROW1_Y),

  // --- Row 2: FM, VCO 2, mixer, VCF EG, VCA EG ------------------------------------
  ...main('fm_amount', '1→2 FM\nAMOUNT', 20, ROW2_Y),
  sw('hard_sync', 36, 64),
  ...main('vco2_eg_amount', 'VCO 2\nEG AMOUNT', 52, ROW2_Y),
  ...main('vco2_frequency', 'VCO 2\nFREQUENCY', 84, ROW2_Y),
  sw('vco2_wave', 104, 57, 'VCO 2'),
  knob('vco2_level', 124, 56, MIXER),
  ...main('vcf_decay', 'VCF\nDECAY', 154, ROW2_Y),
  ...main('vcf_eg_amount', 'VCF EG\nAMOUNT', 177.3, ROW2_Y),
  ...main('noise_vcf_mod', 'NOISE /\nVCF MOD', 200.7, ROW2_Y),
  ...main('vca_decay', 'VCA\nDECAY', 224, ROW2_Y),

  // --- Transport ----------------------------------------------------------------
  { kind: 'button', control: 'trigger', event: 'trigger', x: 15, y: 76, w: 8.6, color: '#0f2a12', ledColor: '#22c55e', label: 'right' },
  ...main('tempo', 'TEMPO', 50, 78),
  { kind: 'button', control: 'run_stop', x: 35, y: 96, w: 12.7, color: '#3a0909', ledColor: '#ef4444', label: 'none',
    lit: ({ engine }) => !!engine.playing },
  { kind: 'button', control: 'advance', event: 'advance', x: 65, y: 96, w: 10.2, color: '#0f2a12', ledColor: '#22c55e', label: 'above' },
  { kind: 'led', x: 26.5, y: 88.6, size: 2.6, color: '#ff3333', on: ({ engine }) => !!engine.playing },
  { kind: 'label', text: 'RUN / STOP', x: 35, y: 88.6, size: 6.5, color: '#9ca3af' },

  // --- Sequencer ----------------------------------------------------------------
  ...Array.from({ length: 8 }, (_, i): PanelElement => ({ kind: 'label', text: String(i + 1), x: STEP_X(i), y: 69.6, size: 9 })),
  { kind: 'label', text: 'PITCH', x: 98, y: SEQ_PITCH_Y, size: 7, align: 'right', color: '#9ca3af' },
  { kind: 'label', text: 'VELOCITY', x: 98, y: SEQ_VEL_Y, size: 6.5, align: 'right', color: '#9ca3af' },
  ...Array.from({ length: 8 }, (_, i) => knob(`pitch_${i + 1}`, STEP_X(i), SEQ_PITCH_Y, SEQ, { label: 'none', value: 'hover' })),
  ...Array.from({ length: 8 }, (_, i) => knob(`velocity_${i + 1}`, STEP_X(i), SEQ_VEL_Y, SEQ, { label: 'none' })),
  // Step LEDs: the current step is always shown (so ADVANCE can be seen); it flashes on each hit
  ...Array.from({ length: 8 }, (_, i): PanelElement => ({
    kind: 'led', x: STEP_X(i), y: SEQ_LED_Y, size: 3.6, color: '#ff3333',
    on: ({ engine }) => (engine.step === i ? ((engine.flash as number) > 0 ? 1 : engine.playing ? 0.7 : 0.35) : 0),
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
