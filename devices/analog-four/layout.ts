// ============================================================================
// Analog Four MKII panel layout (mm from the faceplate's top-left)
//
// Dark Elektron chassis: OLED top-centre, the ten DATA ENTRY encoders A-J to
// its right with the six PARAMETER keys beneath, TRACK keys, FUNC and the
// transport on the left, and the 16 trig keys along the bottom.
// Proportions follow the 385 mm wide unit; the key positions are drawn from
// product photos and the manual's front-panel overview, not measured.
// ============================================================================

import { createElement } from 'react';
import type { PanelElement, PanelLayout } from '@/types/panel';
import { CV_TRACK, FX_TRACK, PAGE, PARAM_KEYS, TRACKS, encoderControl, patternId } from './params';
import { ENC_D, KEY_ROW_Y, PANEL_H, PANEL_W, PKEY_H, PKEY_W, PKEY_X, PX_PER_MM, SCREEN, TRIGS, encPos } from './geometry';
import { LockEncoders, Screen, SubPageKeys, TrigKeys, keyLit } from './ui';

const KEY = '#4b4e53';      // grey Elektron key caps
const LED_RED = '#ff3b30';
const LED_WHITE = '#f4f4f4';
const MUTED = '#8a8f98';

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : d);

const rectKey = (x: number, y: number, extra: Partial<Extract<PanelElement, { kind: 'button' }>>): PanelElement => ({
  kind: 'button', shape: 'rect', x, y, w: PKEY_W, h: PKEY_H, color: KEY, ledColor: LED_WHITE, ...extra,
});

const elements: PanelElement[] = [
  // --- Bezels -------------------------------------------------------------------
  { kind: 'section', x: SCREEN.x - 3, y: SCREEN.y - 3, w: SCREEN.w + 6, h: SCREEN.h + 6, background: '#0b0b0c', border: '1px solid #2a2b2e', radius: 2 },
  { kind: 'section', x: TRIGS.x - 3, y: TRIGS.y - 3, w: TRIGS.w + 6, h: TRIGS.h + 6, background: '#121314', border: '1px solid #2a2b2e', radius: 1.5 },

  // --- Branding + main volume --------------------------------------------------------
  { kind: 'knob', control: 'main_volume', x: 24, y: 27, diameter: 15, variant: 'elektron', value: 'hover' },
  { kind: 'label', text: 'ANALOG FOUR', x: 44, y: 21, size: 13, weight: 800, align: 'left', letterSpacing: 1.2, font: 'condensed' },
  { kind: 'label', text: 'MKII', x: 44, y: 29, size: 9, weight: 700, align: 'left', color: MUTED, letterSpacing: 2 },
  { kind: 'label', text: 'elektron', x: PANEL_W - 8, y: PANEL_H - 6, size: 13, weight: 700, align: 'right', color: '#c9cdd3', letterSpacing: 0.5 },

  // --- TRACK keys (2 x 3) -----------------------------------------------------------
  { kind: 'label', text: 'TRACK', x: 30, y: 55, size: 8.5, color: MUTED, letterSpacing: 1 },
  ...TRACKS.map((name, i): PanelElement => rectKey(19 + (i % 2) * 22, 66 + Math.floor(i / 2) * 15, {
    control: 'track', setValue: i, w: 15, h: 9, capText: name, labelText: name, ledColor: i === FX_TRACK ? '#ffb347' : i === CV_TRACK ? '#7dd3fc' : LED_RED, label: 'none',
  })),

  // --- FUNC + transport -----------------------------------------------------------------
  rectKey(19, 120, { control: 'func', w: 15, h: 9, capText: 'FUNC', ledColor: '#ffb347', label: 'none' }),
  { kind: 'button', control: 'grid_rec', x: 14, y: 154.5, w: 11, shape: 'round', color: KEY, ledColor: LED_RED, capText: '●', label: 'below', labelText: 'REC' },
  { kind: 'button', control: 'play', x: 32, y: 154.5, w: 11, shape: 'round', color: KEY, ledColor: '#4ade80', capText: '▶', label: 'below', labelText: 'PLAY' },
  { kind: 'button', control: 'play', setValue: false, x: 50, y: 154.5, w: 11, shape: 'round', color: KEY, ledColor: LED_WHITE, capText: '■', label: 'below', labelText: 'STOP', lit: () => false },

  // --- Screen ---------------------------------------------------------------------------
  { kind: 'display', x: SCREEN.x, y: SCREEN.y, w: SCREEN.w, h: SCREEN.h, style: 'oled', render: ctx => createElement(Screen, ctx) },

  // --- Keys under the screen -----------------------------------------------------------
  rectKey(128, KEY_ROW_Y, { event: 'pattern', labelText: 'PATTERN', label: 'above' }),
  rectKey(152, KEY_ROW_Y, { event: 'bank', labelText: 'BANK', label: 'above' }),
  rectKey(188, KEY_ROW_Y, { control: 'page', setValue: PAGE.TEMPO, labelText: 'TEMPO', label: 'above' }),

  // --- DATA ENTRY encoders A-J (follow track + page) ------------------------------------
  { kind: 'label', text: 'DATA ENTRY', x: 290, y: 8, size: 8, color: MUTED, letterSpacing: 1.5 },
  ...Array.from({ length: 10 }, (_, slot): PanelElement => {
    const p = encPos(slot);
    return {
      kind: 'knob', x: p.x, y: p.y, diameter: ENC_D, variant: 'elektron', value: 'hover',
      labelText: 'ABCDEFGHIJ'[slot],
      control: ({ values }) => {
        if (num(values.lock_step) > 0 && num(values.track) < FX_TRACK && num(values.page, 1) !== PAGE.TEMPO) return null; // lock encoders on top
        return encoderControl(Math.round(num(values.track)), Math.round(num(values.page, 1)), slot);
      },
    };
  }),
  { kind: 'custom', x: 0, y: 0, w: 0, h: 0, render: ctx => createElement(LockEncoders, ctx) },

  // --- PARAMETER keys ---------------------------------------------------------------------
  { kind: 'label', text: 'PARAMETER', x: 289.5, y: KEY_ROW_Y - 12.5, size: 8, color: MUTED, letterSpacing: 1.5 },
  ...PARAM_KEYS.flatMap((k, i): PanelElement[] => [
    rectKey(PKEY_X(i), KEY_ROW_Y, {
      control: 'page', setValue: k.page, labelText: k.label, label: 'none',
      lit: ({ values }) => keyLit(i, Math.round(num(values.page, 1))),
    }),
    { kind: 'label', text: k.label, x: PKEY_X(i), y: KEY_ROW_Y - 7.2, size: 9.5, weight: 700 },
    { kind: 'label', text: k.fx || '–', x: PKEY_X(i), y: KEY_ROW_Y + 7.4, size: 8.5, weight: 600, color: MUTED },
  ]),
  { kind: 'custom', x: 0, y: 0, w: 0, h: 0, render: ctx => createElement(SubPageKeys, ctx) },
  { kind: 'label', text: 'press a lit key again: OSC 1 › NOISE · FILTER › ENV · LFO › LFO 2', x: 289.5, y: KEY_ROW_Y + 16, size: 9, weight: 500, color: '#7d838c' },

  // --- Trig keys ------------------------------------------------------------------------------
  { kind: 'label', text: 'tap = trig on/off · hold + turn encoder = parameter lock · FUNC lit = mutes (keys 1-4)', x: TRIGS.x, y: TRIGS.y - 8, size: 9.5, weight: 500, align: 'left', color: '#7d838c' },
  {
    kind: 'stepgrid', x: TRIGS.x, y: TRIGS.y, w: TRIGS.w, h: TRIGS.h, steps: 16, rows: 1, numbered: true, color: LED_RED,
    control: ({ values }) => (num(values.track) < FX_TRACK ? patternId(Math.round(num(values.track))) : null),
    playhead: ({ engine, values }) => {
      const s = engine.steps as Record<string, number> | undefined;
      const t = Math.round(num(values.track));
      const v = s?.[`t${t < FX_TRACK ? t + 1 : 1}`];
      return engine.playing && typeof v === 'number' && v >= 0 ? v : undefined;
    },
  },
  { kind: 'custom', x: TRIGS.x, y: TRIGS.y, w: TRIGS.w, h: TRIGS.h, render: ctx => createElement(TrigKeys, ctx) },
  ...[0, 4, 8, 12].map((s): PanelElement => ({ kind: 'label', text: '▾', x: TRIGS.x + (s + 0.5) * (TRIGS.w / 16), y: TRIGS.y + TRIGS.h + 4, size: 6, color: MUTED })),
];

export const ANALOG_FOUR_LAYOUT: PanelLayout = {
  width: PANEL_W,
  height: PANEL_H,
  pxPerMm: PX_PER_MM,
  theme: {
    background: 'linear-gradient(180deg, #242528 0%, #1c1d20 100%)',
    text: '#eceef1',
    muted: MUTED,
    accent: LED_RED,
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    frame: { padding: 4, background: 'linear-gradient(180deg, #111214, #08090a)', radius: 3 },
  },
  elements,
};
