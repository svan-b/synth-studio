// ============================================================================
// Moog Subharmonicon panel layout
// 60 HP x 3U faceplate (304.8 x 128.5 mm) between wood side pieces. All x/y in
// millimetres from the faceplate's top-left; control x/y = centre.
//
// Positions and cap sizes are the manual's own panel drawing (printed p.50),
// measured off its vector paths by the patchscore project and converted to this
// faceplate (REFERENCE.md). The panel prints no boxes - only headings:
// SEQUENCER 1 / 2, POLYRHYTHM, OSCILLATORS (with rules to a boxed 1 and 2) and
// the SEQ 1 / SEQ 2 ASSIGN brackets. Knobs: 11 large (19 mm), 10 medium (15 mm),
// 12 small; the small STEP and RHYTHM caps are drawn at 9 mm (hardware 6.3 mm)
// so they can be turned on an iPad.
// ============================================================================

import type { ButtonElement, KnobElement, PanelElement, PanelLayout } from '@/types/panel';
import { PATCH_GRID } from './spec';
import { CycleButton, EgButton, WaveGlyphs } from './PanelWidgets';

const PX_PER_MM = 3.55;

// Cap diameters (mm)
const LARGE = 19;
const MEDIUM = 15;
const SMALL = 9;

const TEXT = '#f2f2f2';
const MUTED = '#c9c9c9';
const LED = '#ff3b30';

type LabelOpts = Partial<Extract<PanelElement, { kind: 'label' }>>;
const knob = (control: string, x: number, y: number, diameter: number, extra: Partial<KnobElement> = {}): PanelElement => ({
  kind: 'knob', control, x, y, diameter, variant: 'moog-black', ...extra,
});
const label = (text: string, x: number, y: number, size = 8, extra: LabelOpts = {}): PanelElement => ({
  kind: 'label', text, x, y, size, color: TEXT, ...extra,
});
/** A thin printed rule (w x h mm, top-left) */
const rule = (x: number, y: number, w: number, h = 0.32): PanelElement => ({ kind: 'section', x, y, w, h, background: '#d9d9d9', radius: 0 });
/** Backlit rectangular button with its legend on the cap */
const btn = (control: string, x: number, y: number, w: number, h: number, extra: Partial<ButtonElement> = {}): PanelElement => ({
  kind: 'button', control, x, y, shape: 'rect', w, h, color: '#2b2b2b', ledColor: LED, label: 'none', ...extra,
});
const ledsOf = (engine: Record<string, unknown>) => (engine.leds as Record<string, number> | undefined) ?? {};

// ---------------------------------------------------------------------------
// Left: sequencers, polyrhythm, tempo and transport
// ---------------------------------------------------------------------------
const COL = [12.13, 31.21, 50.29, 69.27];
const SEQ_Y = [16.61, 41.63];
const RHY_Y = 66.65;
const ASSIGN_Y = [79.36, 88.37];
const HEAD_X = 40.75;

const leftSection: PanelElement[] = [
  label('SEQUENCER 1', HEAD_X, 7.4, 8.5, { letterSpacing: 1.2 }),
  label('SEQUENCER 2', HEAD_X, 32.42, 8.5, { letterSpacing: 1.2 }),
  label('POLYRHYTHM', HEAD_X, 56.94, 8.5, { letterSpacing: 1.2 }),
  ...[0, 1].flatMap(s => COL.flatMap((x, i): PanelElement[] => [
    knob(`seq${s + 1}_step${i + 1}`, x, SEQ_Y[s], SMALL, { value: 'hover' }),
    {
      kind: 'led', x, y: SEQ_Y[s] + 7.2, size: 2.4, color: LED,
      on: ({ engine }) => {
        const steps = engine.steps as Record<string, number> | undefined;
        return steps && steps[`seq${s + 1}`] === i ? (engine.playing ? 1 : 0.55) : 0;
      },
    },
  ])),
  ...COL.flatMap((x, r): PanelElement[] => [
    knob(`rhythm${r + 1}`, x, RHY_Y, SMALL),
    // The lit SEQ buttons brighten when their generator fires (a teaching aid; REFERENCE.md)
    ...[0, 1].map((s): PanelElement => btn(`rhythm${r + 1}_seq${s + 1}`, x, ASSIGN_Y[s], 9.4, 6.21, {
      capText: `SEQ ${s + 1}`,
      lit: ({ values, engine }) => (values[`rhythm${r + 1}_seq${s + 1}`] ? (ledsOf(engine)[`r${r + 1}`] ? 1 : 0.72) : 0),
    })),
  ]),

  // Tempo and transport
  knob('tempo', 21.67, 109.69, LARGE),
  btn('reset', 44.49, 101.38, 7.97, 7.91, { event: 'reset', capText: 'RESET', ledColor: '#f5f5f5' }),
  {
    kind: 'custom', x: 57.47 - 7.97 / 2, y: 101.38 - 7.91 / 2, w: 7.97, h: 7.91,
    render: ({ values, setValue, teaching, step }) => (
      <EgButton value={(values.eg_mode as number) ?? 1} setValue={setValue} w={7.97 * PX_PER_MM} h={7.91 * PX_PER_MM} teaching={teaching} step={step} />
    ),
  },
  btn('next', 70.55, 101.38, 7.97, 7.91, { event: 'next', capText: 'NEXT', ledColor: '#f5f5f5' }),
  btn('play', 47.63, 111.69, 13.97, 8.21, { capText: 'PLAY', lit: ({ engine, values }) => (engine.playing !== undefined ? !!engine.playing : !!values.play) }),
  btn('trigger', 67.4, 111.69, 13.97, 8.21, { event: 'trigger', capText: 'TRIGGER', lit: ({ engine }) => ledsOf(engine).trig ?? 0 }),
  // EG states, so OFF / ON / HELD can be chosen by touch and shown in words (twin aid)
  ...(['OFF', 'ON', 'HELD'] as const).map((t, i): PanelElement => btn('eg_mode', 50.47 + i * 7, 120.7, 5.6, 3.2, { setValue: i, capText: t, color: '#161616' })),
  label('EG', 46.2, 120.7, 6.5, { color: MUTED, align: 'right' }),
  // Rhythm logic: a global (MIDI CC 113) setting on the hardware, given a small switch here
  { kind: 'switch', control: 'rhythm_logic', x: 80.2, y: 103.4, scale: 1.15, labelText: 'LOGIC' },
  label('CC 113', 80.2, 110.6, 5.5, { color: '#8a8a8a' }),
];

// ---------------------------------------------------------------------------
// Centre: oscillators, SEQ OCT, QUANTIZE, mixer
// ---------------------------------------------------------------------------
const FREQ_X = [106.84, 163.01];
const WAVE_X = [87.86, 181.99];
const SUB_X = [[92.88, 120.91], [148.94, 177.07]];
const ASSIGN_X = [[93.86, 106.84, 119.93], [149.92, 163.01, 175.99]];
const OSC_Y = 25.62, SUB_Y = 51.64, ASSIGN_ROW = 69.15, LEVEL_Y = 86.67, SUBLEVEL_Y = 109.69;
const MID_X = 134.9;

const oscSection: PanelElement[] = [
  // OSCILLATORS: rules out to a boxed 1 and 2
  label('OSCILLATORS', MID_X, 4.5, 8.5, { letterSpacing: 1.4 }),
  rule(91, 4.34, 29), rule(150, 4.34, 29),
  { kind: 'section', x: 85.6, y: 1.9, w: 5.2, h: 5.2, border: '1px solid #d9d9d9', radius: 0.6 },
  label('1', 88.2, 4.5, 8.5),
  { kind: 'section', x: 179.2, y: 1.9, w: 5.2, h: 5.2, border: '1px solid #d9d9d9', radius: 0.6 },
  label('2', 181.8, 4.5, 8.5),
  ...[0, 1].flatMap((b): PanelElement[] => {
    const v = b + 1;
    const [ax0, , ax2] = ASSIGN_X[b];
    return [
      knob(`vco${v}_freq`, FREQ_X[b], OSC_Y, LARGE, { labelText: `VCO ${v} FREQ` }),
      { kind: 'switch', control: `vco${v}_wave`, x: WAVE_X[b] + (b ? 1.6 : -1.6), y: OSC_Y + 1.2, scale: 1.35, label: 'none' },
      {
        kind: 'custom', x: WAVE_X[b] + (b ? -6.4 : 2.9) - (b ? 0 : 0), y: OSC_Y - 2.4, w: 3.6, h: 7.4,
        render: () => <WaveGlyphs w={3.6 * PX_PER_MM} h={7.4 * PX_PER_MM} />,
      },
      knob(`vco${v}_sub1_freq`, SUB_X[b][0], SUB_Y, MEDIUM),
      knob(`vco${v}_sub2_freq`, SUB_X[b][1], SUB_Y, MEDIUM),
      // SEQ n ASSIGN: a bracket dropping around its three buttons
      label(`SEQ ${v} ASSIGN`, FREQ_X[b], 63.6, 7, { letterSpacing: 0.6 }),
      rule(ax0 - 4, 63.45, FREQ_X[b] - 10.2 - (ax0 - 4)), rule(FREQ_X[b] + 10.2, 63.45, ax2 + 4 - FREQ_X[b] - 10.2),
      rule(ax0 - 4, 63.45, 0.32, 1.8), rule(ax2 + 3.7, 63.45, 0.32, 1.8),
      btn(`seq${v}_osc`, ASSIGN_X[b][0], ASSIGN_ROW, 7.97, 7.91, { capText: `OSC ${v}` }),
      btn(`seq${v}_sub1`, ASSIGN_X[b][1], ASSIGN_ROW, 7.97, 7.91, { capText: 'SUB 1' }),
      btn(`seq${v}_sub2`, ASSIGN_X[b][2], ASSIGN_ROW, 7.97, 7.91, { capText: 'SUB 2' }),
      knob(`vco${v}_level`, FREQ_X[b], LEVEL_Y, MEDIUM),
      knob(`vco${v}_sub1_level`, SUB_X[b][0], SUBLEVEL_Y, MEDIUM),
      knob(`vco${v}_sub2_level`, SUB_X[b][1], SUBLEVEL_Y, MEDIUM),
    ];
  }),

  // SEQ OCT: three LEDs (±5 top) over one button that cycles
  ...([[2, '±5'], [1, '±2'], [0, '±1']] as const).map(([v, t], i): PanelElement => (
    btn('seq_oct', MID_X - 3.2, 17.2 + i * 4.3, 2.6, 2.6, { shape: 'round', setValue: v, label: 'right', labelText: t, color: '#2a1212' })
  )),
  {
    kind: 'custom', x: MID_X - 10.13 / 2, y: 35.63 - 6.21 / 2, w: 10.13, h: 6.21,
    render: ({ values, setValue, teaching, step }) => (
      <CycleButton control="seq_oct" label="SEQ OCT" value={(values.seq_oct as number) ?? 0} next={v => (v + 2) % 3} setValue={setValue}
        w={10.13 * PX_PER_MM} h={6.21 * PX_PER_MM} teaching={teaching} step={step}
        description="SEQ OCT: press to cycle the STEP knob range ±5 → ±2 → ±1 octaves." />
    ),
  },
  // QUANTIZE: four LEDs over one button; all dark = off
  ...([[1, '12-ET'], [2, '8-ET'], [3, '12-JI'], [4, '8-JI']] as const).map(([v, t], i): PanelElement => (
    btn('quantize', MID_X - 4.6, 66.2 + i * 4.3, 2.6, 2.6, { shape: 'round', setValue: v, label: 'right', labelText: t, color: '#2a1212' })
  )),
  {
    kind: 'custom', x: MID_X - 10.82 / 2, y: 85.67 - 6.21 / 2, w: 10.82, h: 6.21,
    render: ({ values, setValue, teaching, step }) => (
      <CycleButton control="quantize" label="QUANTIZE" value={(values.quantize as number) ?? 1} next={v => (v === 4 ? 0 : v + 1)} setValue={setValue}
        w={10.82 * PX_PER_MM} h={6.21 * PX_PER_MM} teaching={teaching} step={step}
        description="QUANTIZE: press to cycle 12-ET → 8-ET → 12-JI → 8-JI → off (all LEDs dark)." />
    ),
  },
];

// ---------------------------------------------------------------------------
// Right: filter, envelopes, VCA - two columns, no heading on the panel
// ---------------------------------------------------------------------------
const COL_L = 205.1, COL_R = 235.2;
const ROWS = [16.61, 47.64, 78.66, 109.69];
const filterSection: PanelElement[] = [
  knob('cutoff', COL_L, ROWS[0], LARGE),
  knob('volume', COL_R, ROWS[0], LARGE),
  knob('resonance', COL_L, ROWS[1], LARGE),
  knob('vcf_eg_amt', COL_R, ROWS[1], LARGE),
  label('(–)', COL_R - 12.4, ROWS[1] + 8.4, 7, { color: MUTED }),
  label('(+)', COL_R + 12.4, ROWS[1] + 8.4, 7, { color: MUTED }),
  knob('vcf_attack', COL_L, ROWS[2], LARGE),
  knob('vcf_decay', COL_R, ROWS[2], LARGE),
  knob('vca_attack', COL_L, ROWS[3], LARGE),
  knob('vca_decay', COL_R, ROWS[3], LARGE),
];

// ---------------------------------------------------------------------------
// Patchbay: 4 columns x 8 rows, outputs in reversed lettering
// ---------------------------------------------------------------------------
const PB_X = (c: number) => 255.17 + c * 13.54;
const PB_Y = (r: number) => 16.61 + r * 13.51;
const SHORT: Record<string, string> = {
  out_vco1_sub1: 'SUB 1', out_vco1_sub2: 'SUB 2', out_vco2_sub1: 'SUB 1', out_vco2_sub2: 'SUB 2',
};
const patchbay: PanelElement[] = [
  label('IN', 271.2, 5.3, 7.5, { color: MUTED }),
  label('/', 274.7, 5.3, 7.5, { color: MUTED }),
  label('OUT', 279.2, 5.3, 7.5, { invert: true }),
  ...PATCH_GRID.map(({ id, col, row }): PanelElement => ({
    kind: 'jack', jack: id, x: PB_X(col), y: PB_Y(row), ...(SHORT[id] ? { labelText: SHORT[id] } : {}),
  })),
  // MIDI activity LED beside MIDI IN (studio clock and keys)
  { kind: 'led', x: 248.6, y: PB_Y(7), size: 2.2, color: LED, on: ({ engine }) => ledsOf(engine).midi ?? 0 },
];

// ---------------------------------------------------------------------------
const branding: PanelElement[] = [
  label('SUBHARMONICON', 31.2, 125.6, 9, { align: 'left', letterSpacing: 3, weight: 800 }),
  label('moog', 275.5, 121.5, 19, { font: 'serif', italic: true, weight: 400 }),
];

export const SUBHARMONICON_LAYOUT: PanelLayout = {
  width: 304.8,
  height: 128.5,
  pxPerMm: PX_PER_MM,
  theme: {
    background: 'linear-gradient(180deg, #121212 0%, #0b0b0b 100%)',
    text: TEXT,
    muted: MUTED,
    cheeks: { width: 7.25, background: 'linear-gradient(90deg, #3e2717 0%, #6e4a2c 38%, #8a5e38 52%, #5a3a22 100%)' },
    frame: { padding: 1.1, background: 'linear-gradient(180deg, #b9bcc0 0%, #8d9094 50%, #b4b7bb 100%)', radius: 1.5 },
    jack: { ring: '#5a5a5a', outputLabelBg: '#f2f2f2', outputLabelText: '#000' },
  },
  elements: [...leftSection, ...oscSection, ...filterSection, ...patchbay, ...branding],
};
