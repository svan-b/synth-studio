// ============================================================================
// Display helpers (screen / trig editor readouts), hardware-style
// ============================================================================

import { MICRO_PER_STEP, NOTE_LENGTHS, RETRIG_RATES, SPEED_TICKS, type Speed } from './types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI note -> "C4" (60 = C4, the app-wide convention of lib/audio/dsp noteName) */
export function formatNote(n: number): string {
  const r = Math.round(n);
  return `${NOTE_NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
}

/** Steps for a LEN index (Infinity for INF) */
export function lengthSteps(idx: number): number {
  return NOTE_LENGTHS[Math.max(0, Math.min(NOTE_LENGTHS.length - 1, Math.round(idx)))];
}

const LEN_FRACTIONS: Record<number, string> = { 0.25: '1/64', 0.5: '1/32', 1: '1/16', 2: '1/8', 4: '1/4', 8: '1/2', 16: '1/1' };

/** LEN index -> "1/16", "0.188", "3.50", "INF" (note values for the exact powers of two, like the hardware) */
export function formatLength(idx: number): string {
  const s = lengthSteps(idx);
  if (s === Infinity) return 'INF';
  const f = LEN_FRACTIONS[s];
  if (f) return f;
  if (s < 1) return s.toFixed(3);
  if (s < 16) return s.toFixed(2).replace(/\.?0+$/, '') || '0';
  return String(Math.round(s * 100) / 100);
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Micro timing units -> "+1/384", "-1/32", "0" (fractions of a whole note at 1x) */
export function formatMicro(m: number): string {
  const v = Math.round(m);
  if (!v) return '0';
  const den = MICRO_PER_STEP * 16; // 384
  const g = gcd(Math.abs(v), den);
  return `${v > 0 ? '+' : '-'}${Math.abs(v) / g}/${den / g}`;
}

export function formatRetrigRate(idx: number): string {
  return `1/${RETRIG_RATES[Math.max(0, Math.min(RETRIG_RATES.length - 1, Math.round(idx)))]}`;
}

export function formatSigned(v: number): string {
  const r = Math.round(v);
  return r > 0 ? `+${r}` : String(r);
}

export function formatCondition(c: string | undefined): string {
  return c ? c : 'NONE';
}

export const formatMaster = (n: number) => (n > 0 ? String(n) : 'INF');
export const formatChange = (n: number) => (n > 0 ? String(n) : 'OFF');
/** "3/4x" -> "3/4X" (screen style) */
export const formatSpeed = (s: Speed) => s.toUpperCase();

/** Seconds per step for a speed at a tempo */
export function stepSeconds(speed: Speed, bpm: number): number {
  return (SPEED_TICKS[speed] * 60) / (bpm * 24);
}
