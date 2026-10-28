// ============================================================================
// Analog Rytm MKII panel layout (mm from the faceplate's top-left)
//
// Left half: MAIN VOLUME, the mode keys and the 12 velocity pads (3 rows x 4),
// voice-sharing pairs marked with dashed lines (RS/CP, MT/HT, CH/OH, CY/CB).
// Right half: the screen, the eight DATA ENTRY encoders A-H (2 x 4), the
// PARAMETER page keys, LEVEL/DATA, [FX] / [TEMPO] and pattern keys.
// Bottom: [FUNC], transport and the 16 trig keys.
//
// The OLED is drawn larger than the real 128x64 screen so it stays legible on
// an iPad. The encoders are knob elements whose control follows track + page.
// ============================================================================

import { createElement as h, type ReactNode } from 'react';
import type { PanelContext, PanelElement, PanelLayout } from '@/types/panel';
import type { KnobSpec } from '@/types';
import { formatValue } from '@/lib/controls/mapping';
import {
  ENCODER_LETTERS, FX_PAGE_NAMES, FX_TRACK, PAD_MODES, PAGE, PAGES, TRACKS, pageAbbrs, pageControls,
} from './params';
import { ANALOG_RYTM } from './spec';

const W = 380;
const H = 184;

const PAD_X = [28, 66, 104, 142];
const PAD_Y = [48, 84, 120];
const PAD_W = 33;
const PAD_H = 29;

const ENC_X = [286, 309, 332, 355];
const ENC_Y = [28, 58];
const ENC_D = 13;

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : d);
const trackOf = ({ values }: PanelContext) => num(values.track);
const pageOf = ({ values }: PanelContext) => num(values.page, 1);

/** Which control encoder i (0..7) edits right now */
export const encoderBinding = (i: number) => (ctx: PanelContext) => pageControls(trackOf(ctx), pageOf(ctx))[i] ?? null;

const valueText = (id: string | null, ctx: PanelContext): string => {
  if (!id) return '';
  const s = ANALOG_RYTM.controls[id] as KnobSpec | undefined;
  if (!s || s.type !== 'knob') return '';
  const v = ctx.values[id];
  return formatValue(s, typeof v === 'number' ? v : s.default);
};

// ----------------------------------------------------------------------------
// Screen
// ----------------------------------------------------------------------------
function renderScreen(ctx: PanelContext): ReactNode {
  const track = trackOf(ctx);
  const page = pageOf(ctx);
  const isFx = track === FX_TRACK;
  const tr = TRACKS[track];
  const mode = num(ctx.values.pad_mode);
  const playing = !!ctx.engine.playing;
  const bpm = num(ctx.values.bpm, 120);
  const step = typeof ctx.engine.step === 'number' ? ctx.engine.step : -1;
  const pageName = isFx && page !== PAGE.TEMPO ? FX_PAGE_NAMES[page] : PAGES[page];
  const ids = pageControls(track, page);
  const abbrs = pageAbbrs(track, page);
  const mutes = (ctx.engine.mutes as Record<string, boolean> | undefined) ?? {};

  const row = (children: ReactNode[], style: Record<string, string | number> = {}) =>
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', ...style } }, ...children);
  const span = (text: string, style: Record<string, string | number> = {}) => h('span', { style }, text);

  let body: ReactNode;
  if (!isFx && page === PAGE.SMPL) {
    body = h('div', { style: { padding: '14px 4px', fontSize: 11, lineHeight: 1.4, opacity: 0.85, textAlign: 'center' } },
      'SAMPLE LAYER NOT MODELLED', h('br'), 'This twin plays the analog voice only.', h('br'), 'Choose SRC, FLTR or AMP.');
  } else if (isFx && (page === PAGE.TRIG || page === PAGE.LFO)) {
    body = h('div', { style: { padding: '14px 4px', fontSize: 11, lineHeight: 1.4, opacity: 0.85, textAlign: 'center' } },
      'FX TRACK', h('br'), 'SRC=DELAY  SMPL=REVERB', h('br'), 'FLTR=DIST  AMP=COMP');
  } else {
    const cell = (i: number) => {
      const active = !!ids[i];
      return h('div', {
        key: i,
        style: {
          flex: 1, textAlign: 'center', padding: '4px 0', margin: '0 2px',
          border: active ? '1px solid rgba(232,240,255,0.35)' : '1px solid rgba(232,240,255,0.08)', borderRadius: 2,
        },
      },
      h('div', { style: { fontSize: 10, opacity: 0.7, letterSpacing: 0.5 } }, active ? abbrs[i] ?? '' : ENCODER_LETTERS[i]),
      h('div', { style: { fontSize: 15, fontWeight: 700, minHeight: 18 } }, active ? valueText(ids[i], ctx) : '-'));
    };
    body = h('div', { style: { marginTop: 6 } },
      h('div', { style: { display: 'flex', marginBottom: 6 } }, ...[0, 1, 2, 3].map(cell)),
      h('div', { style: { display: 'flex' } }, ...[4, 5, 6, 7].map(cell)));
  }

  const muted = TRACKS.filter(t => mutes[t.id]).map(t => t.name).join(' ');
  const footer = mode === 1
    ? `MUTE MODE  ${muted ? `MUTED: ${muted}` : 'TAP PADS TO MUTE'}`
    : mode > 1
      ? `${PAD_MODES[mode]} MODE NOT MODELLED - PADS PLAY`
      : ctx.values.accent_edit ? `ACCENT EDIT  ${tr ? tr.name : ''}` : `PTN A01  STEP ${step >= 0 ? String(step + 1).padStart(2, '0') : '--'}/16`;

  return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', fontSize: 11 } },
    row([
      span(isFx ? 'FX  MASTER EFFECTS' : `T${track + 1}  ${tr.machine}`, { fontWeight: 700, fontSize: 12 }),
      span(`${playing ? '▶' : '■'} ${bpm.toFixed(0)} BPM`, { fontSize: 11 }),
    ], { borderBottom: '1px solid rgba(232,240,255,0.3)', paddingBottom: 2 }),
    row([
      span(pageName, { fontWeight: 700, fontSize: 11, background: '#e8f0ff', color: '#050805', padding: '0 4px', borderRadius: 1 }),
      span(isFx || page === PAGE.TEMPO ? (page === PAGE.TEMPO ? `SWING ${num(ctx.values.swing, 50)}%` : '') : tr.full, { fontSize: 10, opacity: 0.75 }),
    ], { marginTop: 3 }),
    body,
    h('div', { style: { marginTop: 'auto', fontSize: 10, opacity: 0.8, borderTop: '1px solid rgba(232,240,255,0.2)', paddingTop: 2, whiteSpace: 'nowrap', overflow: 'hidden' } }, footer),
  );
}

// ----------------------------------------------------------------------------
// Elements
// ----------------------------------------------------------------------------
const key = (x: number, y: number, extra: Partial<Extract<PanelElement, { kind: 'button' }>>): PanelElement => ({
  kind: 'button', x, y, shape: 'rect', w: 13, h: 6.5, color: '#2b2c2e', ledColor: '#ff5a3a', label: 'above', ...extra,
});

const padElements: PanelElement[] = TRACKS.flatMap((t, i): PanelElement[] => {
  const x = PAD_X[i % 4];
  const y = PAD_Y[Math.floor(i / 4)];
  return [
    {
      kind: 'button', x, y, shape: 'rect', w: PAD_W, h: PAD_H,
      control: 'track', setValue: i, event: `pad:${t.id}`,
      color: '#323335', ledColor: '#ff5a3a', label: 'none', labelText: t.name,
      lit: ({ values, engine }) => {
        const leds = (engine.leds as Record<string, number> | undefined) ?? {};
        const mutes = (engine.mutes as Record<string, boolean> | undefined) ?? {};
        if (num(values.pad_mode) === 1) return mutes[t.id] ? 0 : 0.55;
        if (leds[t.id]) return 1;
        return num(values.track) === i ? 0.32 : 0;
      },
    },
    { kind: 'label', text: t.name, x, y: y - 3, size: 15, color: '#e5e5e5', weight: 800, font: 'condensed' },
    { kind: 'label', text: `${i + 1}`, x: x - PAD_W / 2 + 3, y: y - PAD_H / 2 + 3.2, size: 8, color: '#9a9a9a', align: 'left' },
    { kind: 'label', text: t.full, x, y: y + 6, size: 7, color: '#a3a3a3', weight: 600, letterSpacing: 0.6 },
  ];
});

// Dashed lines between pads that share one analog voice
const share = (col: number, row: number): PanelElement => ({
  kind: 'section', x: (PAD_X[col] + PAD_X[col + 1]) / 2, y: PAD_Y[row] - 9, w: 0, h: 18, border: '1px dashed #8a8a8a', radius: 0,
});

const pageKeys: PanelElement[] = (['TRIG', 'SRC', 'SMPL', 'FLTR', 'AMP', 'LFO'] as const).map((name, i) =>
  key(178 + i * 18, 82, { control: 'page', setValue: i, labelText: name }));

const elements: PanelElement[] = [
  // --- Frames -------------------------------------------------------------------------
  { kind: 'section', x: 8, y: 30, w: 154, h: 112, background: '#151618', radius: 2 },
  { kind: 'section', x: 86, y: 150, w: 288, h: 28, background: '#151618', radius: 2 },
  share(2, 0), share(2, 1), share(0, 2), share(2, 2),

  // --- Top-left: volume, mode keys, branding -------------------------------------------
  { kind: 'knob', control: 'main_volume', x: 16, y: 16, diameter: 9, variant: 'elektron', value: 'hover', labelText: 'VOLUME' },
  ...PAD_MODES.map((m, i) => key(40 + i * 16, 18, { control: 'pad_mode', setValue: i, labelText: m, w: 12, h: 6, ledColor: '#ff5a3a' })),
  { kind: 'label', text: 'ANALOG RYTM', x: 122, y: 15.5, size: 15, weight: 800, align: 'left', letterSpacing: 1, font: 'condensed' },
  { kind: 'label', text: 'MKII  ·  ANALOG DRUM COMPUTER', x: 122, y: 21.5, size: 6.5, align: 'left', color: '#8a8a8a', letterSpacing: 0.8 },

  // --- Pads -------------------------------------------------------------------------------
  ...padElements,

  // --- Screen + encoders ----------------------------------------------------------------
  { kind: 'display', x: 170, y: 10, w: 102, h: 56, style: 'oled', render: renderScreen },
  ...ENC_Y.flatMap((y, r) => ENC_X.map((x, c): PanelElement => ({
    kind: 'knob', control: encoderBinding(r * 4 + c), x, y, diameter: ENC_D, variant: 'elektron',
  }))),
  ...ENC_Y.flatMap((y, r) => ENC_X.map((x, c): PanelElement => ({
    kind: 'label', text: ENCODER_LETTERS[r * 4 + c], x: x + ENC_D / 2 + 1.6, y: y - ENC_D / 2 + 1, size: 7, color: '#6b6b6b',
  }))),
  { kind: 'label', text: 'DATA ENTRY', x: 320.5, y: 7.5, size: 6.5, color: '#8a8a8a', letterSpacing: 1.2 },

  // --- PARAMETER keys + track / tempo -----------------------------------------------------
  { kind: 'label', text: 'PARAMETER', x: 223, y: 72.5, size: 6.5, color: '#8a8a8a', letterSpacing: 1.2 },
  ...pageKeys,
  key(296, 82, { control: 'track', setValue: FX_TRACK, labelText: 'FX', ledColor: '#f59e0b' }),
  key(314, 82, { control: 'page', setValue: PAGE.TEMPO, labelText: 'TEMPO' }),
  key(338, 82, { control: 'accent_edit', labelText: 'ACCENT', ledColor: '#f59e0b' }),
  key(360, 82, { event: 'func', labelText: 'FUNC', color: '#3a3b3e' }),

  // --- LEVEL/DATA and pattern keys -----------------------------------------------------
  {
    kind: 'knob', x: 188, y: 114, diameter: 17, variant: 'elektron', labelText: 'LEVEL/DATA',
    control: ctx => {
      const t = trackOf(ctx);
      return t === FX_TRACK ? 'fx_comp_volume' : `${TRACKS[t].id}_volume`;
    },
  },
  key(224, 112, { event: 'bank', labelText: 'BANK' }),
  key(242, 112, { event: 'ptn', labelText: 'PTN' }),
  key(260, 112, { event: 'kit', labelText: 'KIT' }),
  { kind: 'label', text: 'A01', x: 242, y: 123, size: 7, color: '#6b6b6b' },
  { kind: 'label', text: 'elektron', x: 372, y: 116, size: 17, weight: 800, align: 'right', letterSpacing: -0.5 },

  // --- Transport + trig keys ------------------------------------------------------------
  key(22, 166, { event: 'rec', labelText: 'REC', capText: '●', w: 13, h: 9, color: '#3a2020', lit: () => 0 }),
  key(41, 166, { control: 'play', setValue: true, labelText: 'PLAY', capText: '▶', w: 13, h: 9, ledColor: '#22c55e' }),
  key(60, 166, { control: 'play', setValue: false, labelText: 'STOP', capText: '■', w: 13, h: 9, lit: () => 0 }),
  {
    kind: 'stepgrid', x: 89, y: 155, w: 282, h: 19, steps: 16, rows: 1, numbered: true, color: '#ff3b2a',
    control: ({ values }) => {
      const t = num(values.track);
      if (t === FX_TRACK) return null;
      return `${TRACKS[t].id}_${values.accent_edit ? 'accent' : 'pattern'}`;
    },
    playhead: ({ engine }) => (engine.playing && typeof engine.step === 'number' && engine.step >= 0 ? engine.step : undefined),
  },
  { kind: 'label', text: 'TRIG', x: 89, y: 151.5, size: 6.5, align: 'left', color: '#8a8a8a', letterSpacing: 1.2 },
];

export const ANALOG_RYTM_LAYOUT: PanelLayout = {
  width: W,
  height: H,
  pxPerMm: 3.4,
  theme: {
    background: 'linear-gradient(180deg, #232427 0%, #1c1d20 100%)',
    text: '#e5e5e5',
    muted: '#9a9a9a',
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    frame: { padding: 3, background: '#0d0d0e', radius: 3 },
  },
  elements,
};
