// ============================================================================
// Analog Four MKII panel layout (mm from the faceplate's top-left)
//
// The MKII Black edition: midnight panel, dark backlit keys with white
// legends, grey underlined FUNC legends, black encoders. Every element's
// position comes from geometry.ts (REFERENCE.md lists the sources):
//   left      MAIN VOLUME, QUICK PERF, TRACK LEVEL; GLOBAL QPER TEMPO; FUNC,
//             KIT SND MIX; PERF TRK PTN SONG; PATTERN MODE LEDs; BANK A-H
//   centre    the screen window; YES/NO and the arrows; SONG MODE, CHAIN;
//             REC PLAY STOP
//   right     DATA ENTRY A-J; ARP NOTE OSC 1 OSC 2 FILTER AMP ENV LFO; OCT-,
//             OCTAVE LEDs, OCT+, TRNS; the 13-key keyboard
//   far right T1-T4, FX, CV; FILL; PATTERN PAGE LEDs; PAGE
//   bottom    the 16 trig keys
// ============================================================================

import { createElement } from 'react';
import type { CustomElement, PanelElement, PanelLayout } from '@/types/panel';
import { encoderControl, levelControl, V } from './params';
import {
  ENC_D, KEYBOARD, KEYS, KNOBS, OLED, PANEL_H, PANEL_W, PX_PER_MM, SCREEN_WINDOW, TRIGS, encPos,
} from './geometry';
import { COL, Helpers, LedStrips, Menus, MiniKeyboard, PanelKey, Screen, SoundBrowserLegend, TrigArea } from './ui';

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : d);

const keyElement = (name: string): CustomElement => {
  const b = KEYS[name];
  return { kind: 'custom', x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h, render: ctx => createElement(PanelKey, { ctx, name }) };
};

const label = (text: string, x: number, y: number, opts: Partial<Extract<PanelElement, { kind: 'label' }>> = {}): PanelElement => ({
  kind: 'label', text, x, y, size: 9, weight: 700, color: COL.label, letterSpacing: 0.5, ...opts,
});

const elements: PanelElement[] = [
  // --- Screen window: black glass with the tag line and the name ------------------
  { kind: 'section', x: SCREEN_WINDOW.x, y: SCREEN_WINDOW.y, w: SCREEN_WINDOW.w, h: SCREEN_WINDOW.h, background: 'linear-gradient(180deg, #050506 0%, #0a0b0d 100%)', border: '1px solid #2c2f35', radius: 2.4 },
  label('4 VOICE ANALOG TABLETOP SYNTHESIZER', SCREEN_WINDOW.x + SCREEN_WINDOW.w / 2, SCREEN_WINDOW.y + 4.6, { size: 8, color: '#b9bcc2', letterSpacing: 1.1 }),
  label('ANALOG FOUR MKII', SCREEN_WINDOW.x + SCREEN_WINDOW.w / 2, SCREEN_WINDOW.y + SCREEN_WINDOW.h - 6.2, { size: 15, weight: 800, color: '#f1f2f4', letterSpacing: 2.4, font: 'condensed' }),
  { kind: 'display', x: OLED.x, y: OLED.y, w: OLED.w, h: OLED.h, style: 'oled', render: ctx => createElement(Screen, ctx) },

  // --- Pots and TRACK LEVEL ------------------------------------------------------
  { kind: 'knob', control: 'main_volume', x: KNOBS.MAIN_VOLUME.x, y: KNOBS.MAIN_VOLUME.y, diameter: KNOBS.MAIN_VOLUME.d, variant: 'elektron', label: 'none', value: 'hover' },
  label('MAIN VOLUME', KNOBS.MAIN_VOLUME.x, 32.2),
  {
    kind: 'knob', x: KNOBS.QUICK_PERF.x, y: KNOBS.QUICK_PERF.y, diameter: KNOBS.QUICK_PERF.d, variant: 'elektron', label: 'none', value: 'hover',
    control: ({ values }) => `perf_${'abcdefghij'[Math.max(0, Math.min(9, Math.round(num(values.qper_sel))))]}`,
  },
  label('QUICK PERF', KNOBS.QUICK_PERF.x, 32.2),
  {
    kind: 'knob', x: KNOBS.TRACK_LEVEL.x, y: KNOBS.TRACK_LEVEL.y, diameter: KNOBS.TRACK_LEVEL.d, variant: 'elektron', label: 'none', value: 'hover',
    control: ({ values }) => (Math.round(num(values.page, V.OSC1)) === V.TEMPO ? 'tempo' : levelControl(Math.round(num(values.track)))),
  },
  label('TRACK LEVEL', KNOBS.TRACK_LEVEL.x, 33.0),
  { kind: 'custom', x: KNOBS.TRACK_LEVEL.x - 13, y: 35.0, w: 26, h: 4.6, render: ctx => createElement(SoundBrowserLegend, { ctx }) },

  // --- DATA ENTRY A-J (follow the track and the page) ------------------------------
  ...Array.from({ length: 10 }, (_, slot): PanelElement[] => {
    const p = encPos(slot);
    return [
      {
        kind: 'knob', x: p.x, y: p.y, diameter: ENC_D, variant: 'elektron', label: 'none', value: 'hover',
        control: ({ values }) => encoderControl(Math.round(num(values.track)), Math.round(num(values.page, V.OSC1)), slot),
      },
      label('ABCDEFGHIJ'[slot], p.x, p.y + ENC_D / 2 + 3.2, { size: 10, weight: 800, color: '#d7d9dd' }),
    ];
  }).flat(),

  // --- Keys ----------------------------------------------------------------------------
  ...Object.keys(KEYS).map(keyElement),
  { kind: 'custom', x: 0, y: 0, w: 1, h: 1, render: ctx => createElement(LedStrips, { ctx }) },
  label('OCTAVE', (KEYS.OCT_DOWN.x + KEYS.OCT_UP.x) / 2, 124.2, { size: 8, color: COL.legend }),
  label('PATTERN MODE', 52.4, 128.6, { size: 7.5, color: COL.legend, letterSpacing: 1 }),

  // --- Keyboard, trig keys ----------------------------------------------------------
  {
    kind: 'custom', x: KEYBOARD.x, y: KEYBOARD.y, w: 7 * KEYBOARD.whitePitch + KEYBOARD.whiteW, h: KEYBOARD.whiteH,
    render: ctx => createElement(MiniKeyboard, { ctx }),
  },
  { kind: 'custom', x: TRIGS.x, y: TRIGS.y, w: TRIGS.w, h: TRIGS.h, render: ctx => createElement(TrigArea, { ctx }) },
  // bar marks under trig keys 1, 5, 9 and 13
  ...[0, 4, 8, 12].map((i): PanelElement => label('▴', TRIGS.x + i * TRIGS.pitch + TRIGS.keyW / 2, TRIGS.y + TRIGS.h + 2.8, { size: 8, color: COL.legend })),

  // --- Branding ------------------------------------------------------------------------
  label('elektron', 363.5, 9.2, { size: 14, weight: 700, color: '#c7cad0', letterSpacing: 0.3 }),

  // --- Menus (portals) and helpers ------------------------------------------------------
  { kind: 'custom', x: 0, y: 0, w: 1, h: 1, render: ctx => createElement('div', null, createElement(Menus, { ctx }), createElement(Helpers, { ctx })) },
];

export const ANALOG_FOUR_LAYOUT: PanelLayout = {
  width: PANEL_W,
  height: PANEL_H,
  pxPerMm: PX_PER_MM,
  theme: {
    background: 'radial-gradient(120% 140% at 30% 0%, #1c1f25 0%, #15171b 55%, #111317 100%)',
    text: '#e6e8eb',
    muted: COL.legend,
    accent: COL.red,
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    frame: { padding: 2, background: 'linear-gradient(180deg, #0b0c0e, #050506)', radius: 3 },
  },
  elements,
};
