// ============================================================================
// Moog Subharmonicon panel layout
// 60 HP x 3U faceplate (304.8 x 128.5 mm) between wood side pieces. All x/y in
// millimetres from the faceplate's top-left; control x/y = centre.
//
// Knob, button, switch and jack positions and cap sizes are the manual's own
// panel drawing (the blank patch sheets, Owner's Manual printed p.50), measured
// off its vector paths by the patchscore project. The LEDs, headings, rules,
// screws, nameplate and logo were measured off a 400 dpi render of the same
// drawing (REFERENCE.md). The panel prints no boxes - only headings: SEQUENCER 1 /
// 2, POLYRHYTHM, OSCILLATORS (with rules to a boxed 1 and 2), the SEQ 1 / SEQ 2
// ASSIGN brackets, short lines joining each RHYTHM knob to its SEQ buttons and a
// centre divider broken by the SEQ OCT and QUANTIZE groups. Knobs: 11 large
// (19 mm), 10 medium (15 mm), 12 small; the small STEP and RHYTHM caps are drawn
// at 9 mm (hardware 6.3 mm) so they can be turned on an iPad.
//
// Twin aids (not on the hardware, marked in REFERENCE.md): the OFF / ON / HELD
// keys under EG, the SEQ OUT ±5 / SEQ OUT UNQ keys under SEQ OCT and QUANTIZE
// (their hold modes), and the rhythm LOGIC switch (MIDI CC 113 on the hardware).
// ============================================================================

import type { ButtonElement, KnobElement, PanelElement, PanelLayout } from '@/types/panel';
import { PATCH_GRID } from './spec';
import { CycleButton, EgButton, Screw, WaveGlyph } from './PanelWidgets';

const PX_PER_MM = 3.55;

// Cap diameters (mm)
const LARGE = 19;
const MEDIUM = 15;
const SMALL = 9;

const TEXT = '#f2f2f2';
const MUTED = '#c9c9c9';
const RULE = '#d9d9d9';
const LED = '#ff3b30';

type LabelOpts = Partial<Extract<PanelElement, { kind: 'label' }>>;
const knob = (control: string, x: number, y: number, diameter: number, extra: Partial<KnobElement> = {}): PanelElement => ({
  kind: 'knob', control, x, y, diameter, variant: 'moog-black', ...extra,
});
const label = (text: string, x: number, y: number, size = 8, extra: LabelOpts = {}): PanelElement => ({
  kind: 'label', text, x, y, size, color: TEXT, ...extra,
});
/** A thin printed rule (w x h mm, top-left) */
const rule = (x: number, y: number, w: number, h = 0.32): PanelElement => ({ kind: 'section', x, y, w, h, background: RULE, radius: 0 });
const vrule = (x: number, y0: number, y1: number): PanelElement => rule(x - 0.16, y0, 0.32, y1 - y0);
/** Backlit rectangular button with its legend on the cap */
const btn = (control: string, x: number, y: number, w: number, h: number, extra: Partial<ButtonElement> = {}): PanelElement => ({
  kind: 'button', control, x, y, shape: 'rect', w, h, color: '#2b2b2b', ledColor: LED, label: 'none', ...extra,
});
const ledsOf = (engine: Record<string, unknown>) => (engine.leds as Record<string, number> | undefined) ?? {};
const SCREW = 4.6;
const screw = (x: number, y: number): PanelElement => ({
  kind: 'custom', x: x - SCREW / 2, y: y - SCREW / 2, w: SCREW, h: SCREW,
  render: () => <Screw d={SCREW * PX_PER_MM} />,
});
const glyph = (kind: 'square' | 'pwm' | 'saw', x: number, y: number, w: number, h = 2.1): PanelElement => ({
  kind: 'custom', x: x - w / 2, y: y - h / 2, w, h,
  render: () => <WaveGlyph kind={kind} w={w * PX_PER_MM} h={h * PX_PER_MM} />,
});

// ---------------------------------------------------------------------------
// Left: sequencers, polyrhythm, tempo and transport
// ---------------------------------------------------------------------------
const COL = [12.13, 31.21, 50.29, 69.27];
const SEQ_Y = [16.61, 41.63];
const STEP_LED_Y = [26.95, 52.02];
const RHY_Y = 66.65;
const ASSIGN_Y = [79.36, 88.37];
const ASSIGN_H = 6.21;
const HEAD_X = 40.75;

const leftSection: PanelElement[] = [
  label('SEQUENCER 1', HEAD_X, 6.4, 8.5, { letterSpacing: 1.2 }),
  label('SEQUENCER 2', HEAD_X, 31.4, 8.5, { letterSpacing: 1.2 }),
  label('POLYRHYTHM', HEAD_X, 56.2, 8.5, { letterSpacing: 1.2 }),
  ...[0, 1].flatMap(s => COL.flatMap((x, i): PanelElement[] => [
    knob(`seq${s + 1}_step${i + 1}`, x, SEQ_Y[s], SMALL, { value: 'hover' }),
    {
      kind: 'led', x, y: STEP_LED_Y[s], size: 2.6, color: LED,
      on: ({ engine }) => {
        const steps = engine.steps as Record<string, number> | undefined;
        return steps && steps[`seq${s + 1}`] === i ? (engine.playing ? 1 : 0.55) : 0;
      },
    },
  ])),
  ...COL.flatMap((x, r): PanelElement[] => [
    knob(`rhythm${r + 1}`, x, RHY_Y, SMALL),
    // The printed lines joining each RHYTHM knob to its SEQ 1 and SEQ 2 buttons
    vrule(x, RHY_Y + SMALL / 2 + 0.6, ASSIGN_Y[0] - ASSIGN_H / 2),
    vrule(x, ASSIGN_Y[0] + ASSIGN_H / 2, ASSIGN_Y[1] - ASSIGN_H / 2),
    // The lit SEQ buttons brighten when their generator fires (a teaching aid; REFERENCE.md)
    ...[0, 1].map((s): PanelElement => btn(`rhythm${r + 1}_seq${s + 1}`, x, ASSIGN_Y[s], 9.4, ASSIGN_H, {
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
  // EG states in words, so OFF / ON / HELD can be chosen by touch without the long press (twin aid)
  label('EG', 48.6, 118.3, 6.5, { color: MUTED, align: 'right' }),
  { kind: 'switch', control: 'eg_mode', x: 58.4, y: 118.3, style: 'buttons', orientation: 'horizontal', label: 'none', scale: 0.85 },
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
const BRACKET = [[88.0, 125.9], [144.1, 182.0]];
const OSC_Y = 25.62, SUB_Y = 51.64, ASSIGN_ROW = 69.15, LEVEL_Y = 86.67, SUBLEVEL_Y = 109.69;
const MID_X = 135.0;
const LED_X = 134.8;
const SEQ_OCT_Y = 35.9, QUANT_Y = 86.1;
const HELD_W = 12.6, HELD_H = 3.1;

const oscSection: PanelElement[] = [
  // OSCILLATORS: rules out to a boxed 1 and 2 hanging from them
  label('OSCILLATORS', MID_X, 3.35, 8.5, { letterSpacing: 1.4 }),
  rule(87.35, 3.2, 122.3 - 87.35), rule(146.65, 3.2, 182.25 - 146.65),
  { kind: 'section', x: 81.6, y: 3.2, w: 5.4, h: 5.0, border: `1px solid ${RULE}`, radius: 0.4 },
  label('1', 84.3, 5.7, 8.5),
  { kind: 'section', x: 182.8, y: 3.2, w: 5.6, h: 5.0, border: `1px solid ${RULE}`, radius: 0.4 },
  label('2', 185.6, 5.7, 8.5),
  // Centre divider, broken by the SEQ OCT and QUANTIZE groups
  vrule(MID_X, 6.4, 14.1),
  vrule(MID_X, SEQ_OCT_Y + 3.1 + HELD_H + 2.6, 58.6),
  vrule(MID_X, QUANT_Y + 3.2 + HELD_H + 2.6, 117.5),
  ...[0, 1].flatMap((b): PanelElement[] => {
    const v = b + 1;
    const [bx0, bx1] = BRACKET[b];
    const side = b ? 1 : -1; // the pulse-width glyph sits on the outer side of the switch
    return [
      knob(`vco${v}_freq`, FREQ_X[b], OSC_Y, LARGE, { labelText: `VCO ${v} FREQ` }),
      label(`VCO ${v} WAVE`, WAVE_X[b], 17.0, 7),
      { kind: 'switch', control: `vco${v}_wave`, x: WAVE_X[b] + (b ? 1.6 : -1.6), y: OSC_Y + 1.2, scale: 1.35, label: 'none' },
      glyph('square', WAVE_X[b], 20.3, 3.0),
      glyph('pwm', WAVE_X[b] + side * 8.6, OSC_Y + 0.4, 6.2),
      glyph('saw', WAVE_X[b], 31.9, 3.0),
      knob(`vco${v}_sub1_freq`, SUB_X[b][0], SUB_Y, MEDIUM),
      knob(`vco${v}_sub2_freq`, SUB_X[b][1], SUB_Y, MEDIUM),
      // SEQ n ASSIGN: a word on a bracket that drops beside its three buttons
      label(`SEQ ${v} ASSIGN`, FREQ_X[b], 63.2, 7, { letterSpacing: 0.6 }),
      rule(bx0, 63.2, FREQ_X[b] - 9.6 - bx0), rule(FREQ_X[b] + 9.6, 63.2, bx1 - FREQ_X[b] - 9.6),
      vrule(bx0 + 0.16, 63.2, 69.6), vrule(bx1 - 0.16, 63.2, 69.6),
      btn(`seq${v}_osc`, ASSIGN_X[b][0], ASSIGN_ROW, 7.97, 7.91, { capText: `OSC ${v}` }),
      btn(`seq${v}_sub1`, ASSIGN_X[b][1], ASSIGN_ROW, 7.97, 7.91, { capText: 'SUB 1' }),
      btn(`seq${v}_sub2`, ASSIGN_X[b][2], ASSIGN_ROW, 7.97, 7.91, { capText: 'SUB 2' }),
      knob(`vco${v}_level`, FREQ_X[b], LEVEL_Y, MEDIUM),
      knob(`vco${v}_sub1_level`, SUB_X[b][0], SUBLEVEL_Y, MEDIUM),
      knob(`vco${v}_sub2_level`, SUB_X[b][1], SUBLEVEL_Y, MEDIUM),
    ];
  }),

  // SEQ OCT: three LEDs (±5 top) over one button that cycles; held = the lit LED flashes
  ...([[2, '±5'], [1, '±2'], [0, '±1']] as const).map(([v, t], i): PanelElement => (
    btn('seq_oct', LED_X, [16.93, 21.96, 26.97][i], 2.7, 2.7, {
      shape: 'round', setValue: v, label: 'right', labelText: t, color: '#2a1212',
      lit: ({ values, engine }) => (values.seq_oct === v ? (values.seq_oct_held && engine.blink ? 0.15 : 1) : 0),
    })
  )),
  {
    kind: 'custom', x: MID_X - 10.13 / 2, y: SEQ_OCT_Y - 6.21 / 2, w: 10.13, h: 6.21,
    render: ({ values, setValue, teaching, step }) => (
      <CycleButton control="seq_oct" label="SEQ OCT" value={(values.seq_oct as number) ?? 0} next={v => (v + 2) % 3}
        heldControl="seq_oct_held" held={!!values.seq_oct_held} setValue={setValue}
        w={10.13 * PX_PER_MM} h={6.21 * PX_PER_MM} teaching={teaching} step={step}
        description="SEQ OCT: press to step ±5 → ±2 → ±1 octaves. Press and hold until the LED flashes to keep the SEQ jacks at ±5 V (or tap SEQ OUT ±5)." />
    ),
  },
  btn('seq_oct_held', MID_X, SEQ_OCT_Y + 3.1 + 0.9 + HELD_H / 2, HELD_W, HELD_H, { capText: 'SEQ OUT ±5', color: '#161616' }),

  // QUANTIZE: four LEDs over one button; all dark = off; held = the lit LED flashes
  ...([[1, '12-ET'], [2, '8-ET'], [3, '12-JI'], [4, '8-JI']] as const).map(([v, t], i): PanelElement => (
    btn('quantize', LED_X, [62.01, 67.06, 72.05, 77.09][i], 2.7, 2.7, {
      shape: 'round', setValue: v, label: 'right', labelText: t, color: '#2a1212',
      lit: ({ values, engine }) => (values.quantize === v ? (values.quantize_held && engine.blink ? 0.15 : 1) : 0),
    })
  )),
  {
    kind: 'custom', x: MID_X - 10.82 / 2, y: QUANT_Y - 6.21 / 2, w: 10.82, h: 6.21,
    render: ({ values, setValue, teaching, step }) => (
      <CycleButton control="quantize" label="QUANTIZE" value={(values.quantize as number) ?? 1} next={v => (v === 4 ? 0 : v + 1)}
        heldControl="quantize_held" held={!!values.quantize_held} setValue={setValue}
        w={10.82 * PX_PER_MM} h={6.21 * PX_PER_MM} teaching={teaching} step={step}
        description="QUANTIZE: press to step 12-ET → 8-ET → 12-JI → 8-JI → off (all LEDs dark). Press and hold until the LED flashes to unquantize the SEQ jacks (or tap SEQ OUT UNQ)." />
    ),
  },
  btn('quantize_held', MID_X, QUANT_Y + 3.2 + 0.9 + HELD_H / 2, HELD_W, HELD_H, { capText: 'SEQ OUT UNQ', color: '#161616' }),
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
  label('IN', 271.6, 4.1, 7.5, { color: MUTED }),
  label('/', 274.9, 4.1, 7.5, { color: MUTED }),
  label('OUT', 279.0, 4.1, 7.5, { invert: true }),
  ...PATCH_GRID.map(({ id, col, row }): PanelElement => ({
    kind: 'jack', jack: id, x: PB_X(col), y: PB_Y(row), ...(SHORT[id] ? { labelText: SHORT[id] } : {}),
  })),
  // MIDI activity LED, printed just left of the MIDI IN legend (studio clock and keys light it)
  { kind: 'led', x: 248.4, y: PB_Y(7) - 5.6, size: 2.4, color: LED, on: ({ engine }) => ledsOf(engine).midi ?? 0 },
];

// ---------------------------------------------------------------------------
// Frame: eight black M3 screws (manual p.40), the nameplate and the logo
// ---------------------------------------------------------------------------
const frame: PanelElement[] = [
  ...[5.0, 75.9, 218.9, 300.0].map(x => screw(x, 3.0)),
  ...[5.0, 117.0, 218.9, 300.0].map(x => screw(x, 125.5)),
  label('SUBHARMONICON', 31.5, 124.0, 21, { align: 'left', font: 'condensed', weight: 700, letterSpacing: 0.2, fixed: true }),
  rule(75.3, 121.7, 0.3, 4.65),
  label('SEMI-MODULAR ANALOG', 77.1, 122.95, 9.5, { align: 'left', font: 'condensed', weight: 700, letterSpacing: 0.3, fixed: true }),
  label('POLYRHYTHMIC SYNTHESIZER', 77.1, 125.45, 9.5, { align: 'left', font: 'condensed', weight: 700, letterSpacing: 0.3, fixed: true }),
  label('moog', 152.6, 123.4, 22, { font: 'sans', weight: 500, letterSpacing: 0.4, fixed: true }),
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
  elements: [...frame, ...leftSection, ...oscSection, ...filterSection, ...patchbay],
};
