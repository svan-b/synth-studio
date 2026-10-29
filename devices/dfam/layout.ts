// ============================================================================
// DFAM panel layout
// 60 HP x 3U Eurorack faceplate: 304.8 x 128.5 mm in wooden end cheeks (the
// whole unit is 12.57" / 319 mm wide, DFAM manual p.40).
// All x/y in millimetres from the faceplate's top-left. Control x/y = control
// centre; boxes (section) use their top-left.
//
// Geometry: every position below was measured from the panel drawing in the
// DFAM manual (p.7) and converted to millimetres (4.16 drawing px per mm, the
// scale at which its 60 HP panel and Eurorack screw pitch both fit). REFERENCE.md
// lists the measured positions. The look is our own: legends, rings and
// markings are drawn from those facts, not traced.
//
// Controls: 14 capped knobs (17 mm) and 19 slim black "stalks" with a painted
// line - the 3 mixer controls and the 16 sequencer controls. The stalks are drawn
// 8.5 mm wide (the hardware shafts are about 7 mm) so they stay touchable.
// Legends are printed in one line above each control, as on the panel.
// ============================================================================

import type { PanelElement, PanelLayout } from '@/types/panel';

/** px per mm: the faceplate and cheeks fit an iPad in landscape at 100 % */
const K = 3.5;

// Control sizes (mm)
const LARGE = 17.2;
const STALK_D = 8.5;
const BUTTON = 9.4;
/** Black shaft with a white indicator line: the stock mixer and sequencer controls */
const STALK = 'moog-black' as const;

// Rows and columns (mm), measured from the manual's panel drawing (p.7)
const ROW1 = 23.4;
const ROW2 = 55.8;
const LEGEND_DY = 14;          // legend centre above a large knob's centre
const MIX_X = 131.2;
const MIX_Y = [18.0, 39.8, 61.5];
const SEQ_X = (i: number) => 79.9 + i * 23.94;
const SEQ_NUM_Y = 74.7;
const SEQ_PITCH_Y = 84.3;
const SEQ_LED_Y = 96.0;
const SEQ_VEL_Y = 108.0;

// Type sizes (px at native scale)
const LEGEND = 10;
const SMALL = 7.5;
const MUTED = '#c9c9c9';

type KnobOpts = Partial<Extract<PanelElement, { kind: 'knob' }>>;
const knob = (control: string, x: number, y: number, diameter: number, extra: KnobOpts = {}): PanelElement => ({
  kind: 'knob', control, x, y, diameter, variant: 'moog-silver', label: 'none', ...extra,
});
const text = (t: string, x: number, y: number, size = LEGEND, extra: Partial<Extract<PanelElement, { kind: 'label' }>> = {}): PanelElement => ({
  kind: 'label', text: t, x, y, size, letterSpacing: 0.2, ...extra,
});

/** A large knob with its one-line legend above it */
const main = (control: string, legend: string, x: number, y: number, extra: KnobOpts = {}): PanelElement[] => [
  knob(control, x, y, LARGE, extra),
  text(legend, x, y - LEGEND_DY),
];
/** The bipolar AMOUNT knobs have (-) and (+) printed under them */
const signs = (x: number, y: number): PanelElement[] => [
  text('(-)', x - 7.95, y + 12.9, SMALL, { color: MUTED }),
  text('(+)', x + 7.95, y + 12.9, SMALL, { color: MUTED }),
];
/** VCO FREQUENCY and TEMPO sit inside a printed scale ring */
const ring = (x: number, y: number): PanelElement => ({
  kind: 'section', x: x - 11.5, y: y - 11.5, w: 23, h: 23, radius: 11.5, border: '1px solid #8d8d8d',
});
/** A mixer or sequencer stalk; mixer stalks carry their legend above */
const stalk = (control: string, x: number, y: number, extra: KnobOpts = {}): PanelElement =>
  knob(control, x, y, STALK_D, { variant: STALK, ...extra });

const sw = (control: string, x: number, y: number, scale = 1.6, labelText?: string): PanelElement => ({
  kind: 'switch', control, x, y, scale, ...(labelText ? { labelText } : {}),
});

const screw = (x: number, y: number): PanelElement => ({
  kind: 'section', x: x - 2.1, y: y - 2.1, w: 4.2, h: 4.2, radius: 2.1,
  background: 'radial-gradient(circle at 40% 35%, #bdbdbd 0%, #7a7a7a 55%, #3a3a3a 100%)',
});

// Patch bay: 3 columns x 8 rows on a 13.6 x 13.46 mm grid (p.7, p.24). Rows 1-6 read
// IN | IN | OUT, row 7 is three inputs and row 8 three outputs. Outputs have reverse
// (boxed) lettering, inputs standard lettering (p.24).
const PB_X = [267.6, 281.2, 294.8];
const PB_Y = (row: number) => 16.5 + row * 13.46;
const PATCH_GRID: [string, string, number, number][] = [
  ['in_trigger', 'TRIGGER', 0, 0], ['in_vca_cv', 'VCA CV', 1, 0], ['out_vca', 'VCA', 2, 0],
  ['in_velocity', 'VELOCITY', 0, 1], ['in_vca_decay', 'VCA DECAY', 1, 1], ['out_vca_eg', 'VCA EG', 2, 1],
  ['in_ext_audio', 'EXT AUDIO', 0, 2], ['in_vcf_decay', 'VCF DECAY', 1, 2], ['out_vcf_eg', 'VCF EG', 2, 2],
  ['in_noise_level', 'NOISE LEVEL', 0, 3], ['in_vco_decay', 'VCO DECAY', 1, 3], ['out_vco_eg', 'VCO EG', 2, 3],
  ['in_vcf_mod', 'VCF MOD', 0, 4], ['in_vco1_cv', 'VCO 1 CV', 1, 4], ['out_vco1', 'VCO 1', 2, 4],
  ['in_fm_amount', '1→2 FM AMT', 0, 5], ['in_vco2_cv', 'VCO 2 CV', 1, 5], ['out_vco2', 'VCO 2', 2, 5],
  ['in_tempo', 'TEMPO', 0, 6], ['in_run_stop', 'RUN / STOP', 1, 6], ['in_adv_clock', 'ADV / CLOCK', 2, 6],
  ['out_trigger', 'TRIGGER', 0, 7], ['out_velocity', 'VELOCITY', 1, 7], ['out_pitch', 'PITCH', 2, 7],
];

const patchBay: PanelElement[] = PATCH_GRID.flatMap(([jack, label, col, row]): PanelElement[] => {
  const x = PB_X[col], y = PB_Y(row);
  return [
    text(label, x, y - 5.8, 7.2, { letterSpacing: -0.1, ...(jack.startsWith('out_') ? { invert: true } : { color: '#f2f2f2' }) }),
    { kind: 'jack', jack, x, y, label: 'none' },
  ];
});

// TRIGGER, RUN / STOP and ADVANCE are plain black push buttons; only RUN / STOP has an LED
const BUTTON_CAP = '#151515';
const BUTTON_PRESS = '#5a5a5a';

const elements: PanelElement[] = [
  // --- Frame: the eight M3 screws --------------------------------------------
  ...[13.2, 114.5, 190.8, 292.1].flatMap(x => [screw(x, 3), screw(x, 125.5)]),

  // --- Row 1: VCO EG, VCO 1, mixer, VCF, VCA ----------------------------------
  ...main('vco_decay', 'VCO DECAY', 18.9, ROW1),
  sw('seq_pitch_mod', 39.9, 23.7, 1.45),
  ...main('vco1_eg_amount', 'VCO 1 EG AMOUNT', 61.7, ROW1), ...signs(61.7, ROW1),
  ring(90.7, ROW1), ...main('vco1_frequency', 'VCO 1 FREQUENCY', 90.7, ROW1),
  sw('vco1_wave', 112.3, 23.7),
  text('VCO 1 LEVEL', MIX_X, MIX_Y[0] - 8.5), stalk('vco1_level', MIX_X, MIX_Y[0]),
  text('NOISE / EXT LEVEL', MIX_X, MIX_Y[1] - 8.2), stalk('noise_level', MIX_X, MIX_Y[1]),
  sw('vcf_mode', 151.5, 23.8, 1.6, 'VCF'),
  ...main('vcf_cutoff', 'CUTOFF', 173.8, ROW1),
  // CUTOFF's printed frequency marks
  text('200Hz', 160.2, 16.0, 6.5, { color: MUTED }), text('2kHz', 187.4, 16.0, 6.5, { color: MUTED }),
  text('20Hz', 165.3, 36.6, 6.5, { color: MUTED }), text('20kHz', 182.6, 36.6, 6.5, { color: MUTED }),
  ...main('vcf_resonance', 'RESONANCE', 202.8, ROW1),
  sw('vca_attack_mode', 225.3, 24.3),
  ...main('volume', 'VOLUME', 247.5, ROW1),

  // --- Row 2: FM, VCO 2, mixer, VCF EG, VCA EG --------------------------------
  ...main('fm_amount', '1→2 FM AMOUNT', 18.9, ROW2),
  sw('hard_sync', 40.3, 56.2),
  ...main('vco2_eg_amount', 'VCO 2 EG AMOUNT', 61.7, ROW2), ...signs(61.7, ROW2),
  ring(90.7, ROW2), ...main('vco2_frequency', 'VCO 2 FREQUENCY', 90.7, ROW2),
  sw('vco2_wave', 112.3, 56.0),
  text('VCO 2 LEVEL', MIX_X, MIX_Y[2] - 8.5), stalk('vco2_level', MIX_X, MIX_Y[2]),
  ...main('vcf_decay', 'VCF DECAY', 158.0, ROW2),
  ...main('vcf_eg_amount', 'VCF EG AMOUNT', 187.0, ROW2), ...signs(187.0, ROW2),
  ...main('noise_vcf_mod', 'NOISE / VCF MOD', 216.1, ROW2),
  ...main('vca_decay', 'VCA DECAY', 247.5, ROW2),

  // --- Transport ----------------------------------------------------------------
  text('TRIGGER', 18.9, 79.7, 8, { color: MUTED }),
  { kind: 'button', control: 'trigger', event: 'trigger', x: 18.9, y: 87.0, w: BUTTON, color: BUTTON_CAP, ledColor: BUTTON_PRESS, label: 'none' },
  // TEMPO's readout shows on hover / touch only: a permanent one would sit where the panel
  // prints RUN / STOP and ADVANCE, just under the TEMPO ring (p.7)
  ring(46.4, 87.1), ...main('tempo', 'TEMPO', 46.4, 87.1, { value: 'hover' }),
  // RUN LED left of the RUN / STOP legend (p.7). The legend is printed larger than on the
  // hardware (the legibility floor), so the LED sits 2.5 mm further left to stay visible
  { kind: 'led', x: 26.0, y: 100.6, size: 2.6, color: '#ff3333', on: ({ engine }) => !!engine.playing },
  text('RUN / STOP', 36.9, 100.6, SMALL, { color: MUTED }),
  { kind: 'button', control: 'run_stop', x: 36.9, y: 107.9, w: BUTTON, color: BUTTON_CAP, ledColor: BUTTON_PRESS, label: 'none', lit: () => false },
  text('ADVANCE', 55.9, 100.6, SMALL, { color: MUTED }),
  { kind: 'button', control: 'advance', event: 'advance', x: 55.9, y: 107.9, w: BUTTON, color: BUTTON_CAP, ledColor: BUTTON_PRESS, label: 'none' },

  // --- Sequencer ----------------------------------------------------------------
  ...Array.from({ length: 8 }, (_, i): PanelElement => text(String(i + 1), SEQ_X(i), SEQ_NUM_Y, LEGEND)),
  text('PITCH', 74.0, SEQ_PITCH_Y, SMALL, { align: 'right', color: MUTED }),
  text('VELOCITY', 74.0, SEQ_VEL_Y, SMALL, { align: 'right', color: MUTED }),
  ...Array.from({ length: 8 }, (_, i) => stalk(`pitch_${i + 1}`, SEQ_X(i), SEQ_PITCH_Y, { value: 'hover' })),
  ...Array.from({ length: 8 }, (_, i) => stalk(`velocity_${i + 1}`, SEQ_X(i), SEQ_VEL_Y)),
  // Step LEDs: the current step is always shown (so ADVANCE can be seen); it flashes on each hit
  ...Array.from({ length: 8 }, (_, i): PanelElement => ({
    kind: 'led', x: SEQ_X(i), y: SEQ_LED_Y, size: 2.8, color: '#ff3333',
    on: ({ engine }) => (engine.step === i ? ((engine.flash as number) > 0 ? 1 : engine.playing ? 0.7 : 0.35) : 0),
  })),

  // --- Patch bay ----------------------------------------------------------------
  text('IN', 275.6, 5.6, 8, { color: '#f2f2f2' }),
  text('/', 278.4, 5.6, 8, { color: '#f2f2f2' }),
  text('OUT', 282.6, 5.6, 8, { invert: true }),
  ...patchBay,

  // --- Branding (bottom rail, between the screws) -----------------------------------
  text('DFAM', 31.3, 122.0, 20, { weight: 900, letterSpacing: -0.4 }),
  { kind: 'section', x: 41.4, y: 119.0, w: 0.35, h: 6.0, background: '#f2f2f2' },
  text('DRUMMER FROM\nANOTHER MOTHER', 55.3, 121.9, 6.5, { align: 'center', weight: 700, letterSpacing: 0.1 }),
  { kind: 'section', x: 69.3, y: 119.0, w: 0.35, h: 6.0, background: '#f2f2f2' },
  text('SEMI-MODULAR ANALOG\nPERCUSSION SYNTHESIZER', 89.4, 121.9, 6.5, { align: 'center', weight: 700, letterSpacing: 0.1 }),
  text('moog', 152.3, 121.6, 22, { font: 'serif', italic: true, weight: 400, letterSpacing: -0.2 }),
];

export const DFAM_LAYOUT: PanelLayout = {
  width: 304.8,
  height: 128.5,
  pxPerMm: K,
  theme: {
    background: '#111',
    text: '#ffffff',
    muted: MUTED,
    // The unit is 319 mm wide: 7.25 mm of wood each side of the 60 HP panel (p.40)
    cheeks: { width: 7.25, background: 'linear-gradient(90deg, #3d2b1f 0%, #5C4033 50%, #3d2b1f 100%)' },
    frame: { padding: 0, background: '#1a1a1a', radius: 2.5 },
    // Reverse lettering for outputs: a white box with black text (p.24)
    jack: { ring: '#555', outputLabelBg: '#f2f2f2', outputLabelText: '#000' },
  },
  elements,
};
