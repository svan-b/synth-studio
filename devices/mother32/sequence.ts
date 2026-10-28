// ============================================================================
// Mother-32 sequencer data helpers (shared by spec, engine and panel UI)
//
// A pattern is stored in two hidden `pattern` controls, one character per step:
//   seq_notes   '.' = past the end of the pattern (pattern length = steps before
//               the first '.'), '0' = REST, any other char = a note (see ALPHABET)
//   seq_accent  '1' = accent on that step, '0' = no accent
// ============================================================================

export const STEPS = 32;
/** MIDI note of the lowest key (C) at octave 0 - and 0 V on the KB output */
export const KB_LOW = 48;
/** Lowest note a pattern can store */
const NOTE_BASE = 24;
// '0' and '.' are reserved, so notes use letters then digits 1-9 (61 notes: C1..C6)
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

export const REST = '0';
export const END = '.';

export function encodeNote(note: number): string {
  const i = Math.max(0, Math.min(ALPHABET.length - 1, Math.round(note) - NOTE_BASE));
  return ALPHABET[i];
}

/** MIDI note for a step char, or null for a rest / end */
export function decodeNote(ch: string | undefined): number | null {
  if (!ch || ch === REST || ch === END) return null;
  const i = ALPHABET.indexOf(ch);
  return i < 0 ? null : NOTE_BASE + i;
}

/** Number of steps before the first END marker */
export function patternLength(notes: string): number {
  const i = notes.indexOf(END);
  return i < 0 ? Math.min(STEPS, notes.length) : i;
}

/** Build a pattern string from MIDI notes (null = rest), padded with END */
export function makePattern(notes: (number | null)[]): string {
  return notes.slice(0, STEPS).map(n => (n === null ? REST : encodeNote(n))).join('').padEnd(STEPS, END);
}

/** Accent string from step numbers (1-based) */
export function makeAccents(steps: number[]): string {
  return Array.from({ length: STEPS }, (_, i) => (steps.includes(i + 1) ? '1' : '0')).join('');
}

export const EMPTY_PATTERN = ''.padEnd(STEPS, END);
export const NO_ACCENTS = ''.padEnd(STEPS, '0');
