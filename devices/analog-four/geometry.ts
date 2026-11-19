// ============================================================================
// Analog Four MKII panel geometry, in mm from the faceplate's top-left.
//
// Element centres and sizes from the manual's front-panel drawing (A4 MKII
// manual p.12, a 385 x 224 mm top plate), cross-checked within 3 mm against a
// top-down image of the black unit (research/analog-four panel.md). The 2 mm
// unit edge is drawn as the frame: faceplate 381 x 220 mm.
//
// Deliberate deviation, for legibility: the OLED is drawn about 1.2x its real
// 56 x 27 mm inside the real-size window. Keys: centre (x, y) and size (w, h).
// ============================================================================

export const PANEL_W = 381;
export const PANEL_H = 220;
export const PX_PER_MM = 3.1;

export interface Box { x: number; y: number; w: number; h: number }

const SMALL = { w: 11, h: 11 };
const BANK = { w: 18, h: 11 };
const TRACK = { w: 17, h: 11 };
const BIG = { w: 18, h: 18 };

/** Every key on the panel (centre + size), manual p.12 numbering in REFERENCE.md */
export const KEYS: Record<string, Box> = {
  GLOBAL: { x: 22, y: 54, ...SMALL },
  QPER: { x: 60, y: 54, w: 18, h: 10 },
  TEMPO: { x: 99, y: 54, ...SMALL },
  FUNC: { x: 22, y: 89, w: 18, h: 17 },
  KIT: { x: 54, y: 92, ...SMALL },
  SND: { x: 71, y: 92, ...SMALL },
  MIX: { x: 88, y: 92, ...SMALL },
  PERF: { x: 22, y: 114, ...SMALL },
  TRK: { x: 54, y: 114, ...SMALL },
  PTN: { x: 71, y: 114, ...SMALL },
  SONG: { x: 88, y: 114, ...SMALL },
  BANK_A: { x: 22, y: 145, ...BANK },
  BANK_B: { x: 43, y: 145, ...BANK },
  BANK_C: { x: 64, y: 145, ...BANK },
  BANK_D: { x: 85, y: 145, ...BANK },
  BANK_E: { x: 22, y: 162, ...BANK },
  BANK_F: { x: 43, y: 162, ...BANK },
  BANK_G: { x: 64, y: 162, ...BANK },
  BANK_H: { x: 85, y: 162, ...BANK },
  YES: { x: 134, y: 92, ...SMALL },
  NO: { x: 134, y: 110, ...SMALL },
  UP: { x: 167, y: 92, ...SMALL },
  LEFT: { x: 150, y: 110, ...SMALL },
  DOWN: { x: 167, y: 110, ...SMALL },
  RIGHT: { x: 183, y: 110, ...SMALL },
  CHAIN: { x: 150, y: 132, ...SMALL },
  SONGMODE: { x: 167, y: 132, ...SMALL },
  RECORD: { x: 137, y: 158, ...BIG },
  PLAY: { x: 159, y: 158, ...BIG },
  STOP: { x: 180, y: 158, ...BIG },
  ARP: { x: 219, y: 92, ...SMALL },
  NOTE: { x: 235, y: 92, ...SMALL },
  OSC1: { x: 251, y: 92, ...SMALL },
  OSC2: { x: 267, y: 92, ...SMALL },
  FLTR: { x: 284, y: 92, ...SMALL },
  AMP: { x: 300, y: 92, ...SMALL },
  ENV: { x: 317, y: 92, ...SMALL },
  LFO: { x: 333, y: 92, ...SMALL },
  OCT_DOWN: { x: 235, y: 114, ...SMALL },
  OCT_UP: { x: 300, y: 114, ...SMALL },
  TRNS: { x: 333, y: 114, ...SMALL },
  T1: { x: 359, y: 36, ...TRACK },
  T2: { x: 359, y: 55, ...TRACK },
  T3: { x: 359, y: 74, ...TRACK },
  T4: { x: 359, y: 92, ...TRACK },
  FX: { x: 359, y: 114, ...TRACK },
  CV: { x: 359, y: 132, ...TRACK },
  FILL: { x: 359, y: 161, ...SMALL },
  PAGE: { x: 359, y: 194, ...TRACK },
};

/** DATA ENTRY encoders A-J (centre): two rows of five at a 28.5 mm pitch; cap diameter */
export const ENC_D = 12;
export const encPos = (slot: number) => ({ x: [219, 247, 276, 304, 333][slot % 5], y: slot < 5 ? 36 : 64 });

/** Pots (MAIN VOLUME, QUICK PERF AMOUNT) and the TRACK LEVEL encoder */
export const KNOBS = {
  MAIN_VOLUME: { x: 22, y: 30, d: 12 },
  QUICK_PERF: { x: 60, y: 30, d: 12 },
  TRACK_LEVEL: { x: 99, y: 30, d: 12 },
};

/** Screen window (black glass, x 120-198, y 25-80) and the OLED inside it (top-left boxes) */
export const SCREEN_WINDOW = { x: 120, y: 25, w: 78, h: 55 };
export const OLED = { x: 126, y: 33, w: 66, h: 34 };

/** LED strips (centres) */
export const MODE_LEDS = [22, 43, 64, 85].map(x => ({ x, y: 131 }));
export const OCT_LEDS = Array.from({ length: 7 }, (_, i) => ({ x: 253 + i * 5, y: 114 }));
export const PAGE_LEDS = [351, 356, 361, 367].map(x => ({ x, y: 184 }));

/** The keyboard: 13 discrete keys; the lower row sits under ARP..LFO, sharps in the upper row */
export const KB_KEY = { w: 11, h: 17 };
export const KB_KEYS: { offset: number; name: string; x: number; y: number }[] = [
  { offset: 0, name: 'C', x: 219, y: 158 },
  { offset: 1, name: 'C#', x: 227, y: 135 },
  { offset: 2, name: 'D', x: 235, y: 158 },
  { offset: 3, name: 'D#', x: 243, y: 135 },
  { offset: 4, name: 'E', x: 251, y: 158 },
  { offset: 5, name: 'F', x: 267, y: 158 },
  { offset: 6, name: 'F#', x: 276, y: 135 },
  { offset: 7, name: 'G', x: 284, y: 158 },
  { offset: 8, name: 'G#', x: 292, y: 135 },
  { offset: 9, name: 'A', x: 300, y: 158 },
  { offset: 10, name: 'A#', x: 308, y: 135 },
  { offset: 11, name: 'B', x: 317, y: 158 },
  { offset: 12, name: 'C', x: 333, y: 158 },
];
/** The keyboard's box (all 13 keys) */
export const KEYBOARD = { x: 212.5, y: 126, w: 127, h: 41 };

/** Trig keys: 16 across the bottom at a 21 mm pitch (left edge of key 1, total width, pitch, key size) */
export const TRIGS = { x: 13, y: 181, w: 333, h: 18, pitch: 21, keyW: 18 };
/** Legends under the trig keys: A-P, the track names under 1-6, the Quick Performance bracket under 1-10 */
export const TRIG_LEGENDS = { letterY: 202.5, bracketY: 206, trackY: 211 };

/** Rear-panel connector names printed along the top edge (centre x) */
export const REAR_LEGENDS: { x: number; text: string }[] = [
  { x: 54, text: 'Main Out' },
  { x: 71, text: 'Track 1/2' },
  { x: 88, text: 'Track 3/4' },
  { x: 106, text: 'Ext In' },
  { x: 140, text: 'CV Out A/B' },
  { x: 160, text: 'CV Out C/D' },
  { x: 207, text: 'MIDI In' },
  { x: 227, text: 'MIDI Out\nSync A' },
  { x: 248, text: 'MIDI Thru\nSync B' },
  { x: 272, text: 'Control In' },
  { x: 293, text: 'USB' },
  { x: 316, text: 'DC In' },
  { x: 340, text: 'Power' },
];
export const HEADPHONE_X = 36;
export const REAR_Y = 3;

/** The maker's mark (top right) */
export const LOGO = { x: 359, y: 14, w: 11, h: 8 };
