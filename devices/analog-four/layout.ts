// ============================================================================
// Analog Four MKII panel layout (mm from the faceplate's top-left)
//
// The black finish. Positions from the manual's front-panel drawing (A4 MKII
// manual p.12), checked against a top-down image of the unit (geometry.ts;
// REFERENCE.md lists every element and its source):
//   top edge  the rear connectors' names
//   left      Main Volume, Quick Perf Amount, Track Level; GLOBAL QPER TEMPO;
//             FUNC, KIT SND MIX; PERF TRK PTN SONG; PATTERN MODE LEDs; BANK A-H
//   centre    the screen window; YES/NO and the arrows; CHAIN, SONG MODE;
//             RECORD PLAY STOP
//   right     DATA ENTRY A-J; ARP NOTE OSC1 OSC2 FLTR AMP ENV LFO; OCT-,
//             OCTAVE LEDs, OCT+, TRNS; the 13-key keyboard
//   far right logo; T1-T4, FX, CV; FILL; PATTERN PAGE LEDs; PAGE
//   bottom    the 16 trig keys with A-P, T1-CV and the Quick Performance bracket
// Legends are in the panel's own title case; FUNC legends are underlined.
// ============================================================================

import { createElement } from 'react';
import type { CustomElement, PanelElement, PanelLayout } from '@/types/panel';
import { encoderControl, V } from './params';
import {
  ENC_D, HEADPHONE_X, KEYBOARD, KEYS, KNOBS, LOGO, OLED, PANEL_H, PANEL_W, PX_PER_MM, REAR_LEGENDS, REAR_Y, SCREEN_WINDOW, TRIGS, encPos,
} from './geometry';
import {
  COL, Helpers, Legend, LedStrips, LogoMark, Menus, MiniKeyboard, PanelKey, RearIcons, Screen, SoundBrowserLegend, TrigArea, TrigLegends, trackLevelControl,
} from './ui';

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : d);

/** The knob names sit about 4 mm under the caps (manual p.12 drawing) */
const KNOB_NAME_Y = KNOBS.MAIN_VOLUME.y + KNOBS.MAIN_VOLUME.d / 2 + 4.4;

const keyElement = (name: string): CustomElement => {
  const b = KEYS[name];
  return { kind: 'custom', x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h, render: ctx => createElement(PanelKey, { ctx, name }) };
};

const label = (text: string, x: number, y: number, opts: Partial<Extract<PanelElement, { kind: 'label' }>> = {}): PanelElement => ({
  kind: 'label', text, x, y, size: 8, weight: 500, color: COL.legend, ...opts,
});

/** A knob name in two tones, as printed: "Main" grey, "Volume" white */
const knobName = (x: number, y: number, a: string, b: string): CustomElement => ({
  kind: 'custom', x: x - 18, y: y - 2.2, w: 36, h: 4.4,
  render: () => createElement(Legend, { parts: [{ text: a }, { text: b, strong: true }] }),
});

const elements: PanelElement[] = [
  // --- Rear connectors' names along the top edge -------------------------------------
  ...REAR_LEGENDS.map(r => label(r.text, r.x, REAR_Y + (r.text.includes('\n') ? 1.4 : 0), { size: 7.5, color: COL.legendDim, weight: 500 })),
  { kind: 'custom', x: HEADPHONE_X - 2, y: REAR_Y - 2, w: 4, h: 4, render: () => createElement(RearIcons) },

  // --- Screen window: black glass, the tag line, the OLED, the name ---------------------
  { kind: 'section', x: SCREEN_WINDOW.x, y: SCREEN_WINDOW.y, w: SCREEN_WINDOW.w, h: SCREEN_WINDOW.h, background: 'linear-gradient(160deg, #0b0c0e 0%, #040405 55%, #08090b 100%)', border: '1px solid #2a2c31', radius: 2.6 },
  label('4 Voice Analog Tabletop Synthesizer', OLED.x, SCREEN_WINDOW.y + 4.4, { size: 8, color: '#c4c7cc', align: 'left', weight: 500 }),
  { kind: 'display', x: OLED.x, y: OLED.y, w: OLED.w, h: OLED.h, style: 'oled', render: ctx => createElement(Screen, ctx) },
  {
    kind: 'custom', x: OLED.x, y: OLED.y + OLED.h + 2.2, w: 60, h: 6.6,
    render: () => createElement(Legend, { parts: [{ text: 'Analog Four ', strong: true }, { text: 'MKII' }], size: 17, align: 'left', light: true }),
  },

  // --- Pots and TRACK LEVEL ------------------------------------------------------
  // The pots have a white mark and no printed scale; TRACK LEVEL is an endless encoder
  { kind: 'knob', control: 'main_volume', x: KNOBS.MAIN_VOLUME.x, y: KNOBS.MAIN_VOLUME.y, diameter: KNOBS.MAIN_VOLUME.d, variant: 'elektron', capColor: '#f4f4f4', label: 'none', value: 'hover' },
  knobName(KNOBS.MAIN_VOLUME.x, KNOB_NAME_Y, 'Main ', 'Volume'),
  {
    kind: 'knob', x: KNOBS.QUICK_PERF.x, y: KNOBS.QUICK_PERF.y, diameter: KNOBS.QUICK_PERF.d, variant: 'elektron', capColor: '#f4f4f4', label: 'none', value: 'hover',
    control: ({ values }) => `perf_${'abcdefghij'[Math.max(0, Math.min(9, Math.round(num(values.qper_sel))))]}`,
  },
  knobName(KNOBS.QUICK_PERF.x, KNOB_NAME_Y, 'Quick Perf ', 'Amount'),
  {
    kind: 'knob', x: KNOBS.TRACK_LEVEL.x, y: KNOBS.TRACK_LEVEL.y, diameter: KNOBS.TRACK_LEVEL.d, variant: 'elektron', capColor: 'transparent', label: 'none', value: 'hover',
    // the track's level; the tempo / swing while their menus are open; the accent in the ACCENT menu
    control: ctx => trackLevelControl(ctx),
  },
  knobName(KNOBS.TRACK_LEVEL.x, KNOB_NAME_Y, 'Track ', 'Level'),
  { kind: 'custom', x: KNOBS.TRACK_LEVEL.x - 12, y: KNOB_NAME_Y + 2, w: 24, h: 4, render: ctx => createElement(SoundBrowserLegend, { ctx }) },

  // --- DATA ENTRY A-J (follow the track and the page) ------------------------------
  ...Array.from({ length: 10 }, (_, slot): PanelElement[] => {
    const p = encPos(slot);
    return [
      {
        kind: 'knob', x: p.x, y: p.y, diameter: ENC_D, variant: 'elektron', capColor: 'transparent', label: 'none', value: 'hover',
        control: ({ values, ui }) => encoderControl(Math.round(num(values.track)), Math.round(num(values.page, V.OSC1)), slot, false, Array.isArray(ui?.heldSteps) && (ui?.heldSteps as unknown[]).length > 0),
      },
      label('ABCDEFGHIJ'[slot], p.x, p.y + ENC_D / 2 + 4.6, { size: 10, weight: 600, color: COL.legend }),
    ];
  }).flat(),

  // --- Keys ----------------------------------------------------------------------------
  ...Object.keys(KEYS).map(keyElement),
  { kind: 'custom', x: 0, y: 0, w: 1, h: 1, render: ctx => createElement(LedStrips, { ctx }) },

  // --- Keyboard, trig keys ----------------------------------------------------------
  { kind: 'custom', x: KEYBOARD.x, y: KEYBOARD.y, w: KEYBOARD.w, h: KEYBOARD.h, render: ctx => createElement(MiniKeyboard, { ctx }) },
  { kind: 'custom', x: TRIGS.x, y: TRIGS.y, w: TRIGS.w, h: TRIGS.h, render: ctx => createElement(TrigArea, { ctx }) },
  { kind: 'custom', x: TRIGS.x, y: TRIGS.y + TRIGS.h, w: TRIGS.w, h: PANEL_H - TRIGS.y - TRIGS.h - 1, render: () => createElement(TrigLegends) },

  // --- Logo ------------------------------------------------------------------------------
  { kind: 'custom', x: LOGO.x - LOGO.w / 2, y: LOGO.y - LOGO.h / 2, w: LOGO.w, h: LOGO.h, render: () => createElement(LogoMark) },

  // --- Menus (portals) and helpers ------------------------------------------------------
  { kind: 'custom', x: 0, y: 0, w: 1, h: 1, render: ctx => createElement('div', null, createElement(Menus, { ctx }), createElement(Helpers, { ctx })) },
];

export const ANALOG_FOUR_LAYOUT: PanelLayout = {
  width: PANEL_W,
  height: PANEL_H,
  pxPerMm: PX_PER_MM,
  theme: {
    background: 'linear-gradient(180deg, #19191b 0%, #151517 60%, #121214 100%)',
    text: '#e6e8eb',
    muted: COL.legend,
    accent: COL.red,
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    frame: { padding: 2, background: 'linear-gradient(180deg, #0c0c0d, #060607)', radius: 3 },
  },
  elements,
};
