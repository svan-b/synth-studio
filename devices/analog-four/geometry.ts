// ============================================================================
// Analog Four MKII panel geometry, in mm from the faceplate's top-left.
// Converted from the community drawing in analog-emu (src/gui/hw.rs,
// layout_a4: 1156 x 643 px) to a 381 x 221 mm faceplate (+ a 2 mm frame =
// the 385 x 225 mm unit). See REFERENCE.md for every element and its source.
// Keys: centre (x, y) and size (w, h).
// ============================================================================

export const PANEL_W = 381;
export const PANEL_H = 221;
export const PX_PER_MM = 3.1;

export interface Box { x: number; y: number; w: number; h: number }

const SMALL = { w: 16.5, h: 13.1 };

/** Every key on the panel (centre + size) */
export const KEYS: Record<string, Box> = {
  GLOBAL: { x: 25.0, y: 51.2, w: 18.5, h: 13.7 },
  QPER: { x: 60.6, y: 51.2, w: 18.5, h: 13.7 },
  TEMPO: { x: 96.2, y: 51.2, w: 18.5, h: 13.7 },
  FUNC: { x: 25.4, y: 87.3, w: 19.1, h: 17.2 },
  KIT: { x: 58.3, y: 85.2, ...SMALL },
  SND: { x: 78.1, y: 85.2, ...SMALL },
  MIX: { x: 97.9, y: 85.2, ...SMALL },
  PERF: { x: 25.0, y: 112.0, w: 17.1, h: 13.1 },
  TRK: { x: 58.3, y: 112.0, ...SMALL },
  PTN: { x: 78.1, y: 112.0, ...SMALL },
  SONG: { x: 97.9, y: 112.0, ...SMALL },
  BANK_A: { x: 23.7, y: 147.1, w: 17.1, h: 13.7 },
  BANK_B: { x: 42.8, y: 147.1, w: 17.1, h: 13.7 },
  BANK_C: { x: 62.0, y: 147.1, w: 17.1, h: 13.7 },
  BANK_D: { x: 81.1, y: 147.1, w: 17.1, h: 13.7 },
  BANK_E: { x: 23.7, y: 167.0, w: 17.1, h: 13.7 },
  BANK_F: { x: 42.8, y: 167.0, w: 17.1, h: 13.7 },
  BANK_G: { x: 62.0, y: 167.0, w: 17.1, h: 13.7 },
  BANK_H: { x: 81.1, y: 167.0, w: 17.1, h: 13.7 },
  YES: { x: 137.8, y: 95.2, w: 15.8, h: 13.1 },
  NO: { x: 137.8, y: 112.7, w: 15.8, h: 13.7 },
  UP: { x: 166.8, y: 95.2, w: 15.8, h: 13.1 },
  LEFT: { x: 155.6, y: 112.7, w: 15.8, h: 13.7 },
  DOWN: { x: 173.0, y: 112.7, w: 15.8, h: 13.7 },
  RIGHT: { x: 190.5, y: 112.7, w: 15.8, h: 13.7 },
  SONGMODE: { x: 138.1, y: 138.9, ...SMALL },
  CHAIN: { x: 157.2, y: 138.9, ...SMALL },
  RECORD: { x: 138.8, y: 164.6, w: 17.8, h: 16.5 },
  PLAY: { x: 159.2, y: 164.6, w: 17.8, h: 16.5 },
  STOP: { x: 179.6, y: 164.6, w: 17.8, h: 16.5 },
  ARP: { x: 214.6, y: 95.2, ...SMALL },
  NOTE: { x: 233.0, y: 95.2, ...SMALL },
  OSC1: { x: 251.5, y: 95.2, ...SMALL },
  OSC2: { x: 269.9, y: 95.2, ...SMALL },
  FLTR: { x: 288.4, y: 95.2, ...SMALL },
  AMP: { x: 306.8, y: 95.2, ...SMALL },
  ENV: { x: 325.3, y: 95.2, ...SMALL },
  LFO: { x: 343.8, y: 95.2, ...SMALL },
  OCT_DOWN: { x: 238.6, y: 116.2, w: 17.1, h: 13.1 },
  OCT_UP: { x: 313.4, y: 116.2, w: 17.1, h: 13.1 },
  TRNS: { x: 332.6, y: 116.2, w: 17.1, h: 13.1 },
  T1: { x: 363.5, y: 24.1, w: 17.8, h: 11.7 },
  T2: { x: 363.5, y: 41.9, w: 17.8, h: 11.7 },
  T3: { x: 363.5, y: 59.8, w: 17.8, h: 11.7 },
  T4: { x: 363.5, y: 77.7, w: 17.8, h: 11.7 },
  FX: { x: 363.5, y: 95.5, w: 17.8, h: 11.7 },
  CV: { x: 363.5, y: 113.4, w: 17.8, h: 11.7 },
  FILL: { x: 363.5, y: 171.2, w: 17.8, h: 13.7 },
  PAGE: { x: 363.5, y: 199.3, w: 17.8, h: 13.7 },
};

/** DATA ENTRY encoders A-J (centre), diameter */
export const ENC_D = 17.1;
export const encPos = (slot: number) => ({ x: [215.2, 246.5, 277.8, 309.2, 340.5][slot % 5], y: slot < 5 ? 22.7 : 55.3 });

export const KNOBS = {
  MAIN_VOLUME: { x: 25.7, y: 21.7, d: 14.5 },
  QUICK_PERF: { x: 61.0, y: 21.7, d: 14.5 },
  TRACK_LEVEL: { x: 94.3, y: 21.0, d: 17.8 },
};

/** Screen window (black glass) and the OLED inside it (top-left boxes) */
export const SCREEN_WINDOW = { x: 109.8, y: 7.2, w: 95.6, h: 72.9 };
export const OLED = { x: 113.0, y: 15.2, w: 89.2, h: 49.6 };

/** LED strips (centres) */
export const MODE_LEDS = [23.7, 42.8, 62.0, 81.1].map(x => ({ x, y: 133.0 }));
export const OCT_LEDS = Array.from({ length: 7 }, (_, i) => ({ x: 255.1 + i * 7.25, y: 116.2 }));
export const PAGE_LEDS = [345.1, 352.0, 358.9, 365.8].map(x => ({ x, y: 186.6 }));

/** Mini keyboard: white keys C..C (8), black keys C# D# F# G# A# on top */
export const KEYBOARD = { x: 206.3, y: 128.2, whiteW: 15.5, whitePitch: 16.48, whiteH: 43.3, blackW: 9.2, blackH: 25.4 };
export const BLACK_KEYS: { slot: number; offset: number }[] = [
  { slot: 0, offset: 1 }, { slot: 1, offset: 3 }, { slot: 3, offset: 6 }, { slot: 4, offset: 8 }, { slot: 5, offset: 10 },
];
export const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12];

/** Trig keys: 16 across the bottom */
export const TRIGS = { x: 9.25, y: 191.8, w: 334.9, h: 16.5, pitch: 21.1, keyW: 18.5 };
