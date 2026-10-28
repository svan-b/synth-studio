// Panel geometry shared by the layout and the custom overlay components (mm).

export const PANEL_W = 377;
export const PANEL_H = 176;
export const PX_PER_MM = 1300 / 385; // frame included: 385 mm ≈ 1300 px

export const ENC_D = 15;
export const ENC_X = (col: number) => 232 + col * 29;
export const ENC_Y = (row: number) => 24 + row * 30;
/** Centre of encoder slot 0..9 (A-E top row, F-J bottom row) */
export const encPos = (slot: number) => ({ x: ENC_X(slot % 5), y: ENC_Y(Math.floor(slot / 5)) });

export const SCREEN = { x: 108, y: 11, w: 100, h: 52 };

export const KEY_ROW_Y = 88;
export const PKEY_X = (i: number) => 226 + i * 25.4;
export const PKEY_W = 15;
export const PKEY_H = 8;

export const TRIGS = { x: 74, y: 146, w: 294, h: 17 };
