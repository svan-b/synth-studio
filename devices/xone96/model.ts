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

/**
 * Studio alignment: the Xone's own digital line-up, 0 dBu = -14 dBFS (guide p.35, the USB
 * soundcards), for everything digital that meets the mixer: studio instruments in, the
 * studio output, files on USB. +14 dBu is full scale, 6 dB under the channels' +20 dBu
 * clip. An instrument normalised to -18 LUFS arrives a few dB under the guide's meter
 * target, so GAIN does its job. In and out scale cancel: the Xone at unity is unity overall.
 */
export const STUDIO_IN = dbuToLin(14);
/** Files play on the USB positions at the same line-up: 0 dBFS arrives at +14 dBu */
export const FILE_IN = STUDIO_IN;
/** LR MIX at 0 dBu leaves the mixer at -14 dBFS with MASTER 1 at its unity mark */
export const OUT_SCALE = 1 / STUDIO_IN;
/** Clip points (soft knee from 80 %): channel +20 dBu, LR MIX +21 dBu, MASTER 1 output +24 dBu */
export const CH_CLIP = dbuToLin(20);
export const MIX_CLIP = dbuToLin(21);
export const MST_CLIP = dbuToLin(24);

/** Channel meter: 9 LEDs, -20 .. +10 dBu, post-GAIN / post-EQ / pre-fader (guide p.9, p.35) */
export const CH_METER_DBU = [-20, -15, -10, -6, -3, 0, 3, 6, 10];
export const CH_METER_LABELS = ['-20', '-15', '-10', '-6', '-3', '0', '+3', '+6', '+10'];
/** LR MIX meters: 11 LEDs, -35 .. +10 dBu; the top one is printed PK! (guide p.7, p.35) */
export const MASTER_METER_DBU = [-35, -25, -20, -15, -10, -6, -3, 0, 3, 6, 10];
export const MASTER_METER_LABELS = ['-35', '-25', '-20', '-15', '-10', '-6', '-3', '0', '+3', '+6', 'PK!'];
/** LED colours as on the panel render (guide p.7): green up to -3, blue at 0 and +3, red from +6 */
export const meterColor = (db: number) => (db >= 6 ? '#ff3b30' : db >= 0 ? '#38b6ff' : '#2fd158');
/** The channel PK! LED beside GAIN reads after GAIN, before the EQ (block diagram); it lights 5 dB below the +20 dBu clip */
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

/** SEND 1 / SEND 2: 0..10 on the dial, off to +6 dB (legend on the panel, guide p.7); 0 dB at 7.1 */
export const sendLaw = (v: number) => 2 * Math.pow(Math.max(0, v) / 10, 2);

/**
 * Fader and crossfader responses as breakpoints [travel 0..1, dB], read off the curve graphs in
 * the guide (p.12) to within about 1 dB. dB is interpolated linearly between breakpoints; the
 * first segment rises from silence. Our own measurement of the published graphs, nothing copied.
 */
type Breakpoints = readonly (readonly [number, number])[];

function breakpointGain(bp: Breakpoints, pos: number): number {
  const p = Math.max(0, Math.min(1, pos));
  let i = 1;
  while (i < bp.length - 1 && bp[i][0] < p) i++;
  const [p0, d0] = bp[i - 1], [p1, d1] = bp[i];
  const t = p1 > p0 ? (p - p0) / (p1 - p0) : 1;
  if (d0 === -Infinity) return t * Math.pow(10, d1 / 20);
  return Math.pow(10, (d0 + (d1 - d0) * t) / 20);
}

export type Curve = 'const' | 'dipped' | 'cut';
export const FADER_CURVES: Curve[] = ['const', 'dipped', 'cut'];
export const FADER_CURVE_NAMES = ['CONST PWR', 'DIPPED', 'FAST CUT'];

/** CHANNEL FADER curves for CH 1-4 (guide p.12): constant power (curve 1), dipped (2), fast-cut (3) */
export const FADER_TABLES: Record<Curve, Breakpoints> = {
  const: [[0, -Infinity], [0.05, -82], [0.1, -76], [0.15, -64.5], [0.2, -53.5], [0.25, -45], [0.3, -38], [0.35, -32], [0.4, -28.5],
    [0.45, -25], [0.5, -22], [0.55, -20], [0.6, -18], [0.65, -16], [0.7, -14.5], [0.75, -12.5], [0.8, -10], [0.85, -8], [0.9, -4.5], [0.95, -2], [1, 0]],
  dipped: [[0, -Infinity], [0.05, -81], [0.1, -70], [0.15, -50.5], [0.2, -39], [0.25, -31], [0.3, -25.5], [0.35, -21.5], [0.4, -19],
    [0.45, -16.5], [0.5, -14], [0.55, -12.5], [0.6, -11.5], [0.65, -11], [0.7, -10], [0.75, -9], [0.8, -8], [0.85, -6], [0.9, -3.5], [0.95, -1.5], [1, 0]],
  cut: [[0, -Infinity], [0.05, -80.5], [0.1, -68], [0.15, -47], [0.2, -33.5], [0.25, -25], [0.3, -19], [0.35, -15], [0.4, -12],
    [0.45, -10], [0.5, -8.5], [0.55, -7], [0.6, -5.5], [0.65, -4.5], [0.7, -3.5], [0.75, -3], [0.8, -2], [0.85, -1], [0.9, -0.5], [0.95, 0], [1, 0]],
};

/** Channel fader law: position 0..1 -> gain, off at the bottom, unity at the top */
export function faderLaw(pos: number, curve: Curve): number {
  return breakpointGain(FADER_TABLES[curve] ?? FADER_TABLES.const, pos);
}

export type XCurve = 'const' | 'transition' | 'cut';
export const XFADER_CURVES: XCurve[] = ['const', 'transition', 'cut'];
export const XFADER_CURVE_NAMES = ['CONST PWR', 'TRANSITION', 'FAST CUT'];

/**
 * XFADER curves (guide p.12): the level of one side against the distance travelled from its own
 * closed end. CONST PWR: -3 dB each in the middle, full from about 3/4 of the way. TRANSITION:
 * both sides full over the middle 60 %, fading in the last fifth. FAST CUT: full within the first
 * 7 % (about 3 mm of the 45 mm innoFADER).
 */
export const XFADER_TABLES: Record<XCurve, Breakpoints> = {
  const: [[0, -Infinity], [0.025, -64], [0.05, -51], [0.075, -41], [0.1, -31.5], [0.125, -22], [0.15, -17.5], [0.175, -13.5], [0.2, -10.5],
    [0.25, -8], [0.3, -7], [0.35, -5.8], [0.4, -5], [0.45, -4], [0.5, -3], [0.55, -2.4], [0.6, -1.8], [0.65, -0.9], [0.7, -0.5], [0.75, 0], [1, 0]],
  transition: [[0, -Infinity], [0.025, -47], [0.05, -17.5], [0.075, -6.5], [0.1, -4.5], [0.125, -2.5], [0.15, -1.2], [0.175, -0.6], [0.2, 0], [1, 0]],
  cut: [[0, -Infinity], [0.025, -51], [0.05, -20], [0.075, 0], [1, 0]],
};

/** Crossfader law: position 0 (X) .. 1 (Y) -> [gain X, gain Y] */
export function xfaderLaw(pos: number, curve: XCurve): [number, number] {
  const t = XFADER_TABLES[curve] ?? XFADER_TABLES.const;
  const p = Math.max(0, Math.min(1, pos));
  return [breakpointGain(t, 1 - p), breakpointGain(t, p)];
}

// ---------------------------------------------------------------------------
// Output section
// ---------------------------------------------------------------------------

/** MASTER 1, MASTER 2 and BOOTH: unity at 8 on the dial (about 3 o'clock), +6 dB at 10 */
export const MASTER_UNITY = 8;
const MASTER_K = Math.log(2) / Math.log(10 / MASTER_UNITY);
export const masterLaw = (v: number) => (v <= 0 ? 0 : Math.pow(v / MASTER_UNITY, MASTER_K));
/** MONITOR and PHONES 2 LEVEL (dial 0..11, guide p.7): 7.5 = unity, 11 = +6.7 dB */
export const phonesLaw = (v: number) => Math.pow(Math.max(0, v) / 7.5, 2);
/** CUE/MST is an ADD MIX control (block diagram): the cue stays, the LR MIX is added up to unity */
export const addMixLaw = (v: number) => Math.pow(Math.max(0, Math.min(10, v)) / 10, 2);
/** RTN C/D LEVEL: -40 (off) .. +10 dB, like GAIN */
export const returnLevelLin = gainLin;

/** PHONES 2 9-way source select (guide p.7, p.16): the LR MIX or one channel's post-EQ, pre-fader signal */
export const PHONES2_SOURCES = ['MST', '1', '2', '3', '4', 'A', 'B', 'C', 'D'];

// ---------------------------------------------------------------------------
// Xone:VCF filter sections
// ---------------------------------------------------------------------------

/**
 * f*_type options. The filters are state-variable with three simultaneous outputs, and any
 * combination of the HPF / BPF / LPF switches can be pressed together (guide p.14):
 * HPF+LPF is a notch, all three an all-pass.
 */
export const FILTER_TYPES = ['HPF', 'BPF', 'LPF', 'HPF+BPF', 'BPF+LPF', 'NOTCH', 'ALL PASS'];
/** Bit mask of lit switches per option: HPF 1, BPF 2, LPF 4 */
export const TYPE_MASK = [1, 2, 4, 3, 6, 5, 7];
export const typeOfMask = (mask: number) => Math.max(0, TYPE_MASK.indexOf(mask));

/**
 * RES 0 (MILD) .. 10 (WILD) -> Q of the 2-pole filter, fitted to the response graphs (guide p.14):
 * MILD about Q 0.5 (-6 dB at FREQ), 12 o'clock Q 1 (all three switches on = flat), WILD Q 2.4
 * (a +7.6 dB peak). The guide's "just short of self-oscillation" describes the sound; the graphs
 * show the size of the peak.
 */
export const resToQ = (res: number) => {
  const r = Math.max(0, Math.min(10, res)) / 10;
  return 0.5 * Math.exp(1.204 * r + 0.365 * r * r);
};

/** CRUNCH 0..10: drive into the pre-filter saturator, 0 to +24 dB (2.4 dB a step); 0 is clean (guide p.13) */
export const crunchDriveDb = (c: number) => 2.4 * Math.max(0, Math.min(10, c));

// ---------------------------------------------------------------------------
// Twin-only: the built-in decks and the stand-in FX unit
// ---------------------------------------------------------------------------

/** Deck sources. FULL MIX (every stem at once, full range from bar 1) is for EQ and filter work. */
export const SOURCE_NAMES = ['TRACK A', 'TRACK B', 'DRUMS', 'BASS', 'STABS', 'PERC', 'PAD', 'VOX LEAD', 'NONE', 'FULL MIX'] as const;
export const SRC = { TRACK_A: 0, TRACK_B: 1, DRUMS: 2, BASS: 3, STABS: 4, PERC: 5, PAD: 6, LEAD: 7, NONE: 8, FULL: 9 } as const;
/** Menu order of the deck sources (NONE last) */
export const SOURCE_MENU = [SRC.TRACK_A, SRC.TRACK_B, SRC.FULL, SRC.DRUMS, SRC.BASS, SRC.STABS, SRC.PERC, SRC.PAD, SRC.LEAD, SRC.NONE];
/**
 * Output trim per deck source (dB), before the deck's +8 dBu ceiling (a CDJ's full scale; the
 * worklet's deckOut), so each one reads around 0 on the channel meter with its loudest peaks
 * around +6 to +8 at GAIN 0 dB, as the guide asks (measured offline). At unity a full track then
 * leaves the mixer near -18 LUFS. TRACK B is ~1.5 dB hotter than TRACK A on purpose: matching
 * them with GAIN is a DJ's first move.
 */
export const SOURCE_TRIM_DB = [-2, -2.5, -1, -1.5, -4, 2.5, -4, 6.5, 0, -4.5];
/** Bars in the TRACK A / TRACK B arrangement (four 8-bar phrases) */
export const ARRANGEMENT_BARS = 32;
/** Lesson auditions start at bar 17: every element of the tracks is playing */
export const AUDITION_START_16TH = 16 * 16;

export const FX_TIMES = ['1/8', '3/16', '1/4'];
export const FX_BEATS = [0.5, 0.75, 1];

/** YOU HEAR (twin only): which output the browser plays. Index 0-2 kept from earlier versions. */
export const MONITOR_OUTS = ['MASTER', 'BOOTH', 'PHONES', 'PHONES 2', 'MST 2'];
export const MON = { MST1: 0, BOOTH: 1, PHONES: 2, PHONES2: 3, MST2: 4 } as const;
