// ============================================================================
// Xone:96 model: the laws and constants that the engine, the panel, the presets
// and the lessons share, so a readout, a lesson target and the audio always
// agree. Pure data and functions - no Web Audio. Sources and confidence levels
// for every number are in devices/xone96/REFERENCE.md.
// ============================================================================

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

/** Panel order, left to right: aux channels A and B, then stereo channels 1-4 */
export const CHANNELS = ['a', 'b', '1', '2', '3', '4'] as const;
export type ChannelId = (typeof CHANNELS)[number];
/** Auxiliary return channels in the master section (level, ON, CUE only) */
export const RETURNS = ['c', 'd'] as const;
export type ReturnId = (typeof RETURNS)[number];

export const isAux = (ch: string) => ch === 'a' || ch === 'b';
export const chName = (ch: string) => (/^[a-d]$/.test(ch) ? ch.toUpperCase() : ch);

/** Studio routing targets (DeviceModule.studio.mixerInputs) and the channel each one feeds */
export const STUDIO_INPUTS: { id: string; ch: ChannelId | ReturnId; label: string }[] = [
  { id: 'studio_1', ch: '1', label: 'CH 1 (LINE)' },
  { id: 'studio_2', ch: '2', label: 'CH 2 (LINE)' },
  { id: 'studio_3', ch: '3', label: 'CH 3 (LINE)' },
  { id: 'studio_4', ch: '4', label: 'CH 4 (LINE)' },
  { id: 'studio_a', ch: 'a', label: 'CH A (RTN A)' },
  { id: 'studio_b', ch: 'b', label: 'CH B (RTN B)' },
  { id: 'studio_c', ch: 'c', label: 'RTN C' },
  { id: 'studio_d', ch: 'd', label: 'RTN D' },
];

/** Which INPUT position hears a routed studio instrument: LINE on 1-4, RTN on A/B */
export const STUDIO_POSITION = 2;

// ---------------------------------------------------------------------------
// Levels. Internally 0.1 = 0 dBu; the channel amplifiers clip at +20 dBu (1.0).
// ---------------------------------------------------------------------------

export const REF = 0.1;
export const dbuToLin = (dbu: number) => REF * Math.pow(10, dbu / 20);
export const linToDbu = (a: number | undefined) => (a && a > 1e-7 ? 20 * Math.log10(a / REF) : -120);

/** A studio instrument at 0 dBFS arrives at +12 dBu (so the mixer at unity is unity overall) */
export const STUDIO_IN = 0.4;
/** A loaded file at 0 dBFS arrives at +8 dBu, like a CDJ line output (2 V rms) */
export const FILE_IN = 0.25;
/** LR MIX at 0 dBu leaves the mixer at -12 dBFS (0.25) with MASTER at its unity mark */
export const OUT_SCALE = 2.5;
/** Clip points (soft knee from 80 %): channel +20 dBu, LR MIX +21 dBu, MASTER 1 output +24 dBu */
export const CH_CLIP = dbuToLin(20);
export const MIX_CLIP = dbuToLin(21);
export const MST_CLIP = dbuToLin(24);

/** Channel meter: 9 LEDs, -20 .. +10 dBu, the ninth is PK! (5 dB below clipping) */
export const CH_METER_DBU = [-20, -12, -6, -3, 0, 3, 6, 10, 15];
export const CH_METER_LABELS = ['-20', '-12', '-6', '-3', '0', '+3', '+6', '+10', 'PK!'];
/** LR MIX meters: 11 LEDs, -35 .. +10 dBu */
export const MASTER_METER_DBU = [-35, -25, -20, -15, -10, -6, -3, 0, 3, 6, 10];
export const MASTER_METER_LABELS = ['-35', '-25', '-20', '-15', '-10', '-6', '-3', '0', '+3', '+6', '+10'];
export const PK_DBU = 15;
/** RTN C/D SIG LED: green above -30 dBu, red above +15 dBu */
export const SIG_DBU = -30;

// ---------------------------------------------------------------------------
// Channel controls
// ---------------------------------------------------------------------------

/** GAIN knob: -40 on the knob means -inf (fully anticlockwise) */
export const GAIN_MIN = -40;
export const gainDb = (v: number) => (v <= GAIN_MIN + 0.01 ? -Infinity : v);
export const gainLin = (v: number) => (v <= GAIN_MIN + 0.01 ? 0 : Math.pow(10, v / 20));

/** HI / LO: centre 0 dB, clockwise +6 dB, anticlockwise to a full kill */
export function killBandGain(v: number): number {
  if (v >= 0) return Math.pow(10, (6 * v) / 20);
  return Math.pow(1 + v, 2);
}
/** Mid bands: centre 0 dB, +10 dB boost, -27 dB (1-4) or -24 dB (A/B) cut */
export function midBandDb(v: number, cut: number): number {
  return v >= 0 ? 10 * v : cut * -v;
}
export const MID_CUT_MAIN = -27;
export const MID_CUT_AUX = -24;

/** EQ turnover / centre frequencies (Hz) */
export const EQ = { lo: 180, loMid: 350, hiMid: 1100, hi: 3000, midQ: 0.9, auxMidQ: 1.0 };

/** SEND 1 / SEND 2: 0..10, unity at 10 */
export const sendLaw = (v: number) => Math.pow(Math.max(0, v) / 10, 2);

export type Curve = 'const' | 'dipped' | 'cut';
export const FADER_CURVES: Curve[] = ['const', 'dipped', 'cut'];
export const FADER_CURVE_NAMES = ['CONST PWR', 'DIPPED', 'FAST CUT'];

/**
 * Channel fader law (position 0..1 -> gain, unity at the top).
 * CONST PWR: the smooth Xone:92-style taper, most of the change near the top.
 * DIPPED: more linear. FAST CUT: full level within the first 5 mm of travel.
 */
export function faderLaw(pos: number, curve: Curve): number {
  const p = Math.max(0, Math.min(1, pos));
  if (curve === 'cut') return p >= 0.08 ? 1 : Math.sin((p / 0.08) * (Math.PI / 2));
  if (curve === 'dipped') return Math.pow(p, 1.5);
  return Math.pow(p, 2.5);
}

export type XCurve = 'const' | 'transition' | 'cut';
export const XFADER_CURVES: XCurve[] = ['const', 'transition', 'cut'];
export const XFADER_CURVE_NAMES = ['CONST PWR', 'TRANSITION', 'FAST CUT'];

/**
 * Crossfader law: position 0 (X) .. 1 (Y) -> [gain X, gain Y].
 * CONST PWR: equal-power blend, -3 dB each in the middle.
 * TRANSITION: both sides stay at full level up to the middle, then fade out.
 * FAST CUT: both full until the last ~1.4 mm at each end (cutting and scratching).
 */
export function xfaderLaw(pos: number, curve: XCurve): [number, number] {
  const p = Math.max(0, Math.min(1, pos));
  if (curve === 'cut') return [Math.min(1, (1 - p) / 0.03), Math.min(1, p / 0.03)];
  if (curve === 'transition') {
    const fade = (q: number) => (q <= 0.5 ? 1 : Math.cos(((q - 0.5) / 0.5) * (Math.PI / 2)));
    return [fade(p), fade(1 - p)];
  }
  return [Math.cos((p * Math.PI) / 2), Math.sin((p * Math.PI) / 2)];
}

// ---------------------------------------------------------------------------
// Output section
// ---------------------------------------------------------------------------

/** MASTER 1 and BOOTH: unity at 8 on the dial (about 3 o'clock), +6 dB at 10 */
export const MASTER_UNITY = 8;
const MASTER_K = Math.log(2) / Math.log(10 / MASTER_UNITY);
export const masterLaw = (v: number) => (v <= 0 ? 0 : Math.pow(v / MASTER_UNITY, MASTER_K));
/** MONITOR headphones LEVEL: 7.5 = unity, 10 = +5 dB */
export const phonesLaw = (v: number) => Math.pow(Math.max(0, v) / 7.5, 2);
/** RTN C/D LEVEL: -40 (off) .. +10 dB, like GAIN */
export const returnLevelLin = gainLin;

// ---------------------------------------------------------------------------
// Xone:VCF filter sections
// ---------------------------------------------------------------------------

/** f*_type options. HPF/BPF/LPF are the switches; pressing two or three together combines them. */
export const FILTER_TYPES = ['HPF', 'BPF', 'LPF', 'HPF+BPF', 'BPF+LPF', 'NOTCH', 'ALL PASS'];
/** Bit mask of lit switches per option: HPF 1, BPF 2, LPF 4 */
export const TYPE_MASK = [1, 2, 4, 3, 6, 5, 7];
export const typeOfMask = (mask: number) => Math.max(0, TYPE_MASK.indexOf(mask));
/**
 * The shared Svf modes (lib/audio/dsp.ts order) that sum the same state-variable taps
 * as the hardware's switch combinations: LP2 0, LP1 1 (low+band), BP 2, HP1 3 (high+band),
 * HP2 4, notch 5 (high+low), peak 6 (stands in for high+band+low, see REFERENCE.md)
 */
export const SVF_MODE_OF_TYPE = [4, 2, 0, 3, 1, 5, 6];

/** RES 0 (MILD, Butterworth: FREQ is the -3 dB point) .. 10 (WILD, Q 20, just short of oscillation) */
export const resToQ = (res: number) => 0.7071 * Math.pow(28, Math.max(0, Math.min(10, res)) / 10);
/** Q -> the shared Svf's resonance param (k = 2 - 1.96 r, Q = 1/k) */
export const qToSvf = (q: number) => Math.max(0, Math.min(1, (2 - 1 / q) / 1.96));

/** The filter buses run 14 dB hot so CRUNCH bites around 0 dBu, as the manual asks (+/-6 dB) */
export const FILTER_BUS = 5;
/** CRUNCH 0..10 -> the Svf's input drive (0..10) */
export const crunchDrive = (c: number) => Math.max(0, Math.min(10, c));
/** Level make-up after CRUNCH (the saturator adds gain at low drive and squashes at high drive) */
export const crunchMakeup = (c: number) => {
  const d = crunchDrive(c);
  return 1 / (1 + 0.32 * d) + 0.1 * Math.min(1, d);
};

// ---------------------------------------------------------------------------
// Twin-only: the built-in decks and the stand-in FX unit
// ---------------------------------------------------------------------------

/** Deck sources. FULL MIX (every stem at once, full range from bar 1) is for EQ and filter work. */
export const SOURCE_NAMES = ['TRACK A', 'TRACK B', 'DRUMS', 'BASS', 'STABS', 'PERC', 'PAD', 'VOX LEAD', 'NONE', 'FULL MIX'] as const;
export const SRC = { TRACK_A: 0, TRACK_B: 1, DRUMS: 2, BASS: 3, STABS: 4, PERC: 5, PAD: 6, LEAD: 7, NONE: 8, FULL: 9 } as const;
/** Menu order of the deck sources (NONE last) */
export const SOURCE_MENU = [SRC.TRACK_A, SRC.TRACK_B, SRC.FULL, SRC.DRUMS, SRC.BASS, SRC.STABS, SRC.PERC, SRC.PAD, SRC.LEAD, SRC.NONE];
/**
 * Output trim per deck source (dB) so each one reads about 0 on the channel meter with peaks
 * near +3..+6 at GAIN 0 dB (measured offline). TRACK B is ~1.5 dB hotter than TRACK A on purpose:
 * matching them with GAIN is the first thing a DJ does.
 */
export const SOURCE_TRIM_DB = [-6.5, -7.5, -3.5, -4, -6.5, 0, -6.5, 4, 0, -8];
/** Bars in the TRACK A / TRACK B arrangement (four 8-bar phrases) */
export const ARRANGEMENT_BARS = 32;
/** Lesson auditions start at bar 17: every element of the tracks is playing */
export const AUDITION_START_16TH = 16 * 16;

export const FX_TIMES = ['1/8', '3/16', '1/4'];
export const FX_BEATS = [0.5, 0.75, 1];

export const MONITOR_OUTS = ['MASTER', 'BOOTH', 'PHONES'];
