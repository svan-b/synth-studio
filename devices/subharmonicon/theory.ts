// ============================================================================
// Subharmonicon music theory: quantizer scales, SEQ OCT ranges, divider maths.
// Shared by the spec (readouts), presets, lessons and the tests. The worklet
// (public/worklets/subharmonicon-processors.js) carries identical copies of
// the tables - keep them in sync. Sources and confidence: REFERENCE.md.
//
// Pitch convention: semitones / octaves above Middle C (C4 = 261.63 Hz = a VCO
// FREQ knob fully counter-clockwise). 1 octave = 1 volt, as on the hardware.
// ============================================================================

export const C4 = 261.6256;
/** VCO FREQ knob: four octaves, Middle C to the top C of a piano (manual p.18) */
export const VCO_MIN_HZ = 261.63;
export const VCO_MAX_HZ = 4186;

/** SEQ OCT switch index -> STEP knob range in octaves (index order kept from v1 saves) */
export const SEQ_OCT_OPTIONS = ['±1', '±2', '±5'];
export const SEQ_RANGE = [1, 2, 5];

/** QUANTIZE switch index (order kept from v1 saves) */
export const QUANTIZE_OPTIONS = ['OFF', '12-ET', '8-ET', '12-JI', '8-JI'];
export const Q_OFF = 0, Q_12ET = 1, Q_8ET = 2, Q_12JI = 3, Q_8JI = 4;

/**
 * 12-JI: 5-limit chromatic just scale on C with a 7/5 tritone and 16/9 minor
 * seventh - the table the Tallent Edition firmware tests use for the stock
 * firmware's JI table (REFERENCE.md: likely).
 */
export const JI_12_RATIOS = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 7 / 5, 3 / 2, 8 / 5, 5 / 3, 16 / 9, 15 / 8];
/** 8-JI: the manual's own just C major (p.17): C 1/1, D 9/8, E 5/4, F 4/3, G 3/2, A 5/3, B 15/8 */
export const JI_8_RATIOS = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
/** 8-ET / 8-JI fold every chromatic note down to the white key below it (stock firmware) */
export const WHITE_KEY = [0, 0, 2, 2, 4, 5, 5, 7, 7, 9, 9, 11];

const log2 = (x: number) => Math.log(x) / Math.LN2;
const LOG2_JI_12 = JI_12_RATIOS.map(log2);

/**
 * Quantize a pitch given in semitones above C4 to the QUANTIZE scale; returns
 * octaves above C4. The digital part of the pitch (VCO FREQ knob + sequencer
 * step + MIDI note) goes through this as one sum. OFF passes it through.
 */
export function quantizeSemis(semis: number, mode: number): number {
  if (!mode) return semis / 12;
  const q = Math.round(semis);
  const o = Math.floor(q / 12);
  let n = q - o * 12;
  if (mode === Q_8ET || mode === Q_8JI) n = WHITE_KEY[n];
  if (mode === Q_12JI || mode === Q_8JI) return o + LOG2_JI_12[n];
  return o + n / 12;
}

/** Frequency of a VCO for a knob setting in Hz, a step in semitones and a quantize mode */
export function vcoHz(knobHz: number, stepSemis: number, mode: number, midiSemis = 0): number {
  const semis = 12 * log2(knobHz / C4) + stepSemis + midiSemis;
  return Math.min(10000, C4 * Math.pow(2, quantizeSemis(semis, mode)));
}

/** STEP knob (-100..+100 % of the SEQ OCT range) -> semitones */
export const stepSemis = (step: number, seqOct: number) => (step / 100) * (SEQ_RANGE[seqOct] ?? 1) * 12;

/** Semitones -> STEP knob value for a SEQ OCT range (preset and lesson helper) */
export const semis = (n: number, seqOct = 0) => Math.round(((n / 12) / (SEQ_RANGE[seqOct] ?? 1)) * 1000) / 10;

/** Subharmonic or rhythm divisor 1..16 */
export const clampDiv = (d: number) => Math.max(1, Math.min(16, Math.round(d)));

/**
 * A knob divisor moved by a control voltage. 10 V spans the knob's whole travel
 * (16 divisions), and positive volts turn it clockwise, toward ÷1 - so with the
 * knob centred, ±5 V reaches both ends (manual: "Centre both SUB FREQ knobs
 * first, for bipolar control"). The exact scaling is a guess (REFERENCE.md).
 */
export function divWithCv(base: number, volts: number): number {
  if (!volts) return clampDiv(base);
  const pos = (16 - clampDiv(base) + 0.5) / 16 + volts / 10;
  const idx = Math.max(0, Math.min(15, Math.floor(pos * 16)));
  return 16 - idx;
}

/** Least common multiple of rhythm divisors: how many clock counts before a polyrhythm repeats */
export function lcm(...ns: number[]): number {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  return ns.reduce((a, b) => (a * b) / gcd(a, b), 1);
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/** "C4", "G♯5"… for a frequency (nearest equal-tempered note) */
export function noteOf(hz: number): string {
  if (!(hz > 0)) return '';
  const midi = Math.round(69 + 12 * log2(hz / 440));
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Cents between two frequencies */
export const cents = (a: number, b: number) => 1200 * log2(a / b);

/** Interval name of a subharmonic f/n below its VCO (n = 1..16) */
export const UNDERTONE_NAMES: Record<number, string> = {
  1: 'unison',
  2: '1 octave down',
  3: 'octave + fifth down',
  4: '2 octaves down',
  5: '2 octaves + major 3rd down',
  6: '2 octaves + fifth down',
  7: '2 octaves + "septimal" 7th down',
  8: '3 octaves down',
  9: '3 octaves + whole tone down',
  10: '3 octaves + major 3rd down',
  11: '3 octaves + "undecimal" 4th down',
  12: '3 octaves + fifth down',
  13: '3 octaves + "tridecimal" 6th down',
  14: '3 octaves + septimal 7th down',
  15: '3 octaves + major 7th down',
  16: '4 octaves down',
};
