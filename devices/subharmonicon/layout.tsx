// ============================================================================
// Moog Subharmonicon panel layout
// 60HP × 3U Eurorack faceplate (304.8 × 128.5 mm) in a wooden case. All x/y in
// millimetres from the faceplate's top-left. Control x/y = centre.
//
// Arrangement follows the hardware (manual p.10 panel overview):
//   left    SEQUENCER 1 / SEQUENCER 2 (4 STEP knobs each), POLYRHYTHM
//           (RHYTHM 1-4 with SEQ 1 / SEQ 2 buttons), TEMPO and transport
//   centre  VCO 1 and VCO 2 (FREQ, SUB 1/2 FREQ, wave switch, SEQ ASSIGN
//           OSC/SUB 1/SUB 2, VCO and SUB levels) with SEQ OCT and QUANTIZE
//           between them
//   right   CUTOFF, VOLUME, RESONANCE, VCF EG AMT, VCF/VCA ATTACK/DECAY
//   far right  the 32-point patchbay, 4 columns × 8 rows
// Positions are measured from panel photos / diagrams, so they are close but
// not millimetre-exact.
// ============================================================================

import type { PanelElement, PanelLayout, KnobElement } from '@/types/panel';
import { PATCH_GRID } from './spec';
import { CycleButton, EgButton } from './CycleSelector';

const PX_PER_MM = 4;

const knob = (control: string, x: number, y: number, diameter: number, extra: Partial<KnobElement> = {}): PanelElement => ({
  kind: 'knob', control, x, y, diameter, variant: 'moog-black', ...extra,
});
const label = (text: string, x: number, y: number, size = 8, extra: Partial<Extract<PanelElement, { kind: 'label' }>> = {}): PanelElement => ({
  kind: 'label', text, x, y, size, ...extra,
});
const rule = (x: number, y: number, w: number, h: number): PanelElement => ({
  kind: 'section', x, y, w, h, border: '1px solid rgba(255,255,255,0.35)', radius: 1.2,
});

// --- Left: sequencers and polyrhythm --------------------------------------------
const COL = (i: number) => 19 + i * 16;
const SEQ_Y = [18.5, 43.5];
const RHY_Y = 72;
const ASSIGN_Y = [84.5, 92];

const leftSection: PanelElement[] = [
  rule(4, 4, 72, 52),
  rule(4, 58, 72, 39),
  label('SEQUENCER 1', 40, 7.2, 8, { letterSpacing: 1 }),
  label('SEQUENCER 2', 40, 32.2, 8, { letterSpacing: 1 }),
  label('POLYRHYTHM', 40, 61, 8, { letterSpacing: 1 }),
  label('RHYTHM', 4.8, RHY_Y, 6.5, { align: 'left', color: '#d4d4d4' }),
  ...[0, 1].flatMap(s => [0, 1, 2, 3].flatMap((i): PanelElement[] => [
    knob(`seq${s + 1}_step${i + 1}`, COL(i), SEQ_Y[s], 10.5, { value: 'hover' }),
    {
      kind: 'led', x: COL(i), y: SEQ_Y[s] + 8.2, size: 2.4, color: '#ff3b30',
      on: ({ engine }) => {
        const steps = engine.steps as Record<string, number> | undefined;
        return steps && steps[`seq${s + 1}`] === i ? 1 : 0;
      },
    },
  ])),
  ...[0, 1, 2, 3].flatMap((r): PanelElement[] => [
    knob(`rhythm${r + 1}`, COL(r), RHY_Y, 10.5, { labelText: String(r + 1) }),
    {
      kind: 'led', x: COL(r) + 6.6, y: RHY_Y - 6.2, size: 2, color: '#ff3b30',
      on: ({ engine }) => ((engine.leds as Record<string, number> | undefined)?.[`r${r + 1}`] ?? 0),
    },
    { kind: 'button', control: `rhythm${r + 1}_seq1`, x: COL(r), y: ASSIGN_Y[0], w: 5, color: '#1b1b1b', ledColor: '#ff3b30', label: 'none' },
    { kind: 'button', control: `rhythm${r + 1}_seq2`, x: COL(r), y: ASSIGN_Y[1], w: 5, color: '#1b1b1b', ledColor: '#ff3b30', label: 'none' },
  ]),
  label('SEQ 1', 12.5, ASSIGN_Y[0], 7, { align: 'right', color: '#d4d4d4' }),
  label('SEQ 2', 12.5, ASSIGN_Y[1], 7, { align: 'right', color: '#d4d4d4' }),

  // Tempo & transport
  knob('tempo', 15, 111.5, 15),
  { kind: 'button', control: 'reset', event: 'reset', x: 31, y: 103, w: 6, color: '#1b1b1b', ledColor: '#e5e5e5' },
  {
    kind: 'custom', x: 39, y: 96.6, w: 8, h: 10,
    render: ({ values, setValue }) => <EgButton value={(values.eg_mode as number) ?? 1} setValue={setValue} pxPerMm={PX_PER_MM} />,
  },
  // EG state legends (tap to select directly; the hardware shows the state on the button itself)
  ...(['OFF', 'ON', 'HELD'] as const).map((t, i): PanelElement => ({
    kind: 'button', control: 'eg_mode', setValue: i, x: 37.4 + i * 5.6, y: 110, shape: 'rect', w: 5.2, h: 3.2,
    color: '#151515', ledColor: '#ff3b30', capText: t, label: 'none',
  })),
  { kind: 'button', control: 'next', event: 'next', x: 55, y: 103, w: 6, color: '#1b1b1b', ledColor: '#e5e5e5' },
  {
    kind: 'button', control: 'play', x: 32, y: 117, w: 8, color: '#2b1010', ledColor: '#ff3b30', label: 'below',
    lit: ({ engine, values }) => (engine.playing !== undefined ? !!engine.playing : !!values.play),
  },
  { kind: 'button', control: 'trigger', event: 'trigger', x: 48, y: 117, w: 7, color: '#1b1b1b', ledColor: '#e5e5e5', label: 'below',
    lit: ({ engine }) => ((engine.leds as Record<string, number> | undefined)?.trig ?? 0) },
  { kind: 'switch', control: 'rhythm_logic', x: 66.5, y: 112, scale: 1.3, labelText: 'LOGIC' },
  label('GLOBAL', 66.5, 123.2, 6, { color: '#8a8a8a', letterSpacing: 0.6 }),
];

// --- Centre: oscillators ------------------------------------------------------------
const VCO_X = [107, 171];
const SUB_X = [[94, 120], [158, 184]];
const ASSIGN_X = [[96, 107, 118], [160, 171, 182]];

const oscSection: PanelElement[] = [
  rule(80, 4, 124, 120.5),
  ...[0, 1].flatMap((b): PanelElement[] => {
    const v = b + 1;
    const waveX = b === 0 ? 88.5 : 191.5;
    return [
      label(`VCO ${v}`, VCO_X[b], 7.2, 9, { letterSpacing: 1 }),
      knob(`vco${v}_freq`, VCO_X[b], 25, 17, { labelText: 'FREQ' }),
      { kind: 'switch', control: `vco${v}_wave`, x: waveX, y: 26, scale: 1.6, labelText: 'WAVE' },
      knob(`vco${v}_sub1_freq`, SUB_X[b][0], 51, 12.5),
      knob(`vco${v}_sub2_freq`, SUB_X[b][1], 51, 12.5),
      label(`SEQ ${v} ASSIGN`, VCO_X[b], 66.3, 7, { color: '#d4d4d4', letterSpacing: 0.6 }),
      { kind: 'button', control: `seq${v}_osc`, x: ASSIGN_X[b][0], y: 74, w: 5.5, color: '#1b1b1b', ledColor: '#ff3b30' },
      { kind: 'button', control: `seq${v}_sub1`, x: ASSIGN_X[b][1], y: 74, w: 5.5, color: '#1b1b1b', ledColor: '#ff3b30' },
      { kind: 'button', control: `seq${v}_sub2`, x: ASSIGN_X[b][2], y: 74, w: 5.5, color: '#1b1b1b', ledColor: '#ff3b30' },
      knob(`vco${v}_level`, VCO_X[b], 92, 11.5),
      knob(`vco${v}_sub1_level`, SUB_X[b][0], 112, 11.5),
      knob(`vco${v}_sub2_level`, SUB_X[b][1], 112, 11.5),
    ];
  }),
  // SEQ OCT and QUANTIZE between the oscillators: LED column + one push button
  ...([[2, '±5'], [1, '±2'], [0, '±1']] as const).map(([v, t], i): PanelElement => ({
    kind: 'button', control: 'seq_oct', setValue: v, x: 143, y: 13.5 + i * 4.6, w: 2.9, color: '#2a1212', ledColor: '#ff3b30', label: 'left', labelText: t,
  })),
  {
    kind: 'custom', x: 135, y: 26.5, w: 8, h: 10,
    render: ({ values, setValue }) => (
      <CycleButton control="seq_oct" label="SEQ OCT" value={(values.seq_oct as number) ?? 0} next={v => (v + 1) % 3} setValue={setValue} pxPerMm={PX_PER_MM}
        description="SEQ OCT: press to cycle the STEP knob range ±1 → ±2 → ±5 octaves." />
    ),
  },
  ...([[1, '12-ET'], [2, '8-ET'], [3, '12-JI'], [4, '8-JI']] as const).map(([v, t], i): PanelElement => ({
    kind: 'button', control: 'quantize', setValue: v, x: 143, y: 56 + i * 4.6, w: 2.9, color: '#2a1212', ledColor: '#ff3b30', label: 'left', labelText: t,
  })),
  {
    kind: 'custom', x: 135, y: 74, w: 8, h: 10,
    render: ({ values, setValue }) => (
      <CycleButton control="quantize" label="QUANTIZE" value={(values.quantize as number) ?? 1} next={v => (v + 1) % 5} setValue={setValue} pxPerMm={PX_PER_MM}
        description="QUANTIZE: press to cycle 12-ET → 8-ET → 12-JI → 8-JI → off (all LEDs dark)." />
    ),
  },
];

// --- Right: filter, envelopes, VCA ------------------------------------------------------
const F_X = [216, 241];
const filterSection: PanelElement[] = [
  rule(206, 4, 47, 120.5),
  knob('cutoff', F_X[0], 23, 15),
  knob('volume', F_X[1], 23, 11.5),
  knob('resonance', F_X[0], 51, 11.5),
  knob('vcf_eg_amt', F_X[1], 51, 11.5, { labelText: 'EG AMT' }),
  label('VCF EG', 228.5, 66.5, 7, { color: '#d4d4d4', letterSpacing: 0.8 }),
  knob('vcf_attack', F_X[0], 80, 11.5, { labelText: 'ATTACK' }),
  knob('vcf_decay', F_X[1], 80, 11.5, { labelText: 'DECAY' }),
  label('VCA EG', 228.5, 96, 7, { color: '#d4d4d4', letterSpacing: 0.8 }),
  knob('vca_attack', F_X[0], 109.5, 11.5, { labelText: 'ATTACK' }),
  knob('vca_decay', F_X[1], 109.5, 11.5, { labelText: 'DECAY' }),
];

// --- Patchbay -----------------------------------------------------------------------------
const PB_X = (c: number) => 262 + c * 10.6;
const PB_Y = (r: number) => 17 + r * 12.9;
const SHORT: Record<string, string> = {
  out_vco1_sub1: 'SUB 1', out_vco1_sub2: 'SUB 2', out_vco2_sub1: 'SUB 1', out_vco2_sub2: 'SUB 2',
};
const patchbay: PanelElement[] = [
  { kind: 'section', x: 255.5, y: 4, w: 46, h: 110, background: '#0b0b0b', border: '1px solid rgba(255,255,255,0.35)', radius: 1.2 },
  label('IN', 274.5, 7.3, 7, { color: '#d4d4d4' }),
  label('OUT', 284.5, 7.3, 7, { invert: true }),
  ...PATCH_GRID.map(({ id, col, row }): PanelElement => ({
    kind: 'jack', jack: id, x: PB_X(col), y: PB_Y(row), ...(SHORT[id] ? { labelText: SHORT[id] } : {}),
  })),
];

// --- Branding -------------------------------------------------------------------------------
const branding: PanelElement[] = [
  label('moog', 278.5, 118.6, 19, { font: 'serif', italic: true, weight: 400 }),
  label('subharmonicon', 278.5, 124.8, 7, { color: '#e5e5e5', letterSpacing: 1.4, weight: 600 }),
];

export const SUBHARMONICON_LAYOUT: PanelLayout = {
  width: 304.8,
  height: 128.5,
  pxPerMm: PX_PER_MM,
  theme: {
    background: 'linear-gradient(180deg, #161616 0%, #0e0e0e 100%)',
    text: '#ffffff',
    muted: '#d4d4d4',
    cheeks: { width: 9, background: 'linear-gradient(90deg, #4a2f1c 0%, #7a5233 45%, #5c3b24 100%)' },
    frame: { padding: 1.5, background: '#1c1c1c', radius: 2 },
    jack: { ring: '#5a5a5a', outputLabelBg: '#f2f2f2', outputLabelText: '#000' },
  },
  elements: [...leftSection, ...oscSection, ...filterSection, ...patchbay, ...branding],
};
