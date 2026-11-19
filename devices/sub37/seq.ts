// ============================================================================
// Sub 37 step sequencer editing (Subsequent 37 manual pp.16-20), as pure
// functions over the three 64-character pattern strings (see model.ts):
// step recording with REST and TIE, DUO steps, and the STEP EDIT operations
// (rest toggle, tie groups, skip, ratchet, first / last step, rotate).
// The panel applies the results with setValue; nothing here touches audio.
// ============================================================================

import {
  EMPTY_FLAGS, EMPTY_PITCHES, F_RATCHET, F_REST, F_SKIP, F_TIE, NO_NOTE, SEQ_STEPS,
  charFlags, charNote, flagChar, noteChar, setChar,
} from './model';

export interface SeqStrings {
  arp_seq: string;
  arp_seq2: string;
  arp_seq_flags: string;
  /** LAST STEP (1-64) */
  seq_len: number;
  /** FIRST STEP (1-64) */
  seq_first: number;
}

const pad = (s: string, fill: string) => (s.length === SEQ_STEPS ? s : (s + fill.repeat(SEQ_STEPS)).slice(0, SEQ_STEPS));

export function readSeq(v: Record<string, unknown>): SeqStrings {
  return {
    arp_seq: pad(String(v.arp_seq ?? EMPTY_PITCHES), NO_NOTE),
    arp_seq2: pad(String(v.arp_seq2 ?? EMPTY_PITCHES), NO_NOTE),
    arp_seq_flags: pad(String(v.arp_seq_flags ?? EMPTY_FLAGS), '0'),
    seq_len: clampStep(Number(v.seq_len ?? 16)),
    seq_first: clampStep(Number(v.seq_first ?? 1)),
  };
}

const clampStep = (n: number) => Math.max(1, Math.min(SEQ_STEPS, Math.round(Number.isFinite(n) ? n : 1)));
const flagsAt = (s: SeqStrings, i: number) => charFlags(s.arp_seq_flags[i]);
const withFlags = (s: SeqStrings, i: number, f: number): SeqStrings => ({ ...s, arp_seq_flags: setChar(s.arp_seq_flags, i, flagChar(f)) });

/** The empty sequence REC starts from (p.17: the first key erases the old one) */
export const blankSeq = (): SeqStrings => ({ arp_seq: EMPTY_PITCHES, arp_seq2: EMPTY_PITCHES, arp_seq_flags: EMPTY_FLAGS, seq_len: 1, seq_first: 1 });

export interface RecState {
  /** Next step to record (0 = the next key starts a new sequence) */
  pos: number;
  /** TIE was pressed: the next note is tied from the previous step */
  tie: boolean;
}

/**
 * A key in step record (p.17). `legato`: another key was still held; `duo`: DUO MODE is lit.
 * Legato keys tie (single mode) or become the step's second pitch (DUO MODE, p.17).
 */
export function recNote(s: SeqStrings, r: RecState, note: number, legato: boolean, duo: boolean): { seq: SeqStrings; rec: RecState } {
  if (r.pos === 0) {
    const seq = { ...blankSeq(), arp_seq: setChar(EMPTY_PITCHES, 0, noteChar(note)) };
    return { seq, rec: { pos: 1, tie: false } };
  }
  if (legato && duo) {
    // a second key while the first is held: two pitches on the same step
    const i = r.pos - 1;
    return { seq: { ...s, arp_seq2: setChar(s.arp_seq2, i, noteChar(note)) }, rec: r };
  }
  if (r.pos >= SEQ_STEPS) return { seq: s, rec: r };
  let seq = s;
  if (r.tie || legato) seq = withFlags(seq, r.pos - 1, flagsAt(seq, r.pos - 1) | F_TIE);
  seq = {
    ...seq,
    arp_seq: setChar(seq.arp_seq, r.pos, noteChar(note)),
    arp_seq2: setChar(seq.arp_seq2, r.pos, NO_NOTE),
    arp_seq_flags: setChar(seq.arp_seq_flags, r.pos, '0'),
    seq_len: r.pos + 1,
  };
  return { seq, rec: { pos: r.pos + 1, tie: false } };
}

/** ON [REST] in step record: a silent step, and advance (p.16) */
export function recRest(s: SeqStrings, r: RecState): { seq: SeqStrings; rec: RecState } {
  if (r.pos >= SEQ_STEPS) return { seq: s, rec: r };
  const base = r.pos === 0 ? blankSeq() : s;
  const seq = {
    ...base,
    arp_seq: setChar(base.arp_seq, r.pos, NO_NOTE),
    arp_seq2: setChar(base.arp_seq2, r.pos, NO_NOTE),
    arp_seq_flags: setChar(base.arp_seq_flags, r.pos, flagChar(F_REST)),
    seq_len: r.pos + 1,
  };
  return { seq, rec: { pos: r.pos + 1, tie: false } };
}

/** LATCH [TIE] in step record: the previous note ties into the next one played (p.17) */
export function recTie(r: RecState): RecState {
  return r.pos > 0 ? { ...r, tie: true } : r;
}

// ---- STEP EDIT (pp.18-20) ------------------------------------------------------

/** Tap a step: toggle its rest (p.19) */
export function toggleRest(s: SeqStrings, i: number): SeqStrings {
  const f = flagsAt(s, i);
  return withFlags(s, i, f & F_REST ? f & ~F_REST : (f | F_REST) & ~F_TIE);
}

export function toggleTie(s: SeqStrings, i: number): SeqStrings {
  return withFlags(s, i, flagsAt(s, i) ^ F_TIE);
}

export function toggleSkip(s: SeqStrings, i: number): SeqStrings {
  return withFlags(s, i, flagsAt(s, i) ^ F_SKIP);
}

export function toggleRatchet(s: SeqStrings, i: number): SeqStrings {
  return withFlags(s, i, flagsAt(s, i) ^ F_RATCHET);
}

/**
 * Hold one step and press another: tie them and every step between; the same pair again
 * unties the group (p.19). Ties sit on every step of the group but the last.
 */
export function tieGroup(s: SeqStrings, a: number, b: number): SeqStrings {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (lo === hi) return s;
  let tied = true;
  for (let i = lo; i < hi; i++) if (!(flagsAt(s, i) & F_TIE)) tied = false;
  let out = s;
  for (let i = lo; i < hi; i++) {
    const f = flagsAt(out, i);
    out = withFlags(out, i, tied ? f & ~F_TIE : (f | F_TIE) & ~F_REST);
  }
  if (!tied) out = withFlags(out, hi, flagsAt(out, hi) & ~F_TIE);
  return out;
}

/** A key while a step is selected: non-legato sets pitch 1 and clears rest, tie and ratchet; legato sets pitch 2 */
export function setStepPitch(s: SeqStrings, i: number, note: number, second: boolean): SeqStrings {
  if (second) return { ...s, arp_seq2: setChar(s.arp_seq2, i, noteChar(note)) };
  return {
    ...s,
    arp_seq: setChar(s.arp_seq, i, noteChar(note)),
    arp_seq_flags: setChar(s.arp_seq_flags, i, flagChar(flagsAt(s, i) & F_SKIP)),
  };
}

export function setFirstStep(s: SeqStrings, i: number): SeqStrings {
  const first = i + 1;
  return { ...s, seq_first: first, seq_len: Math.max(first, s.seq_len) };
}

export function setLastStep(s: SeqStrings, i: number): SeqStrings {
  const last = i + 1;
  return { ...s, seq_len: last, seq_first: Math.min(s.seq_first, last) };
}

/** BANK + RANGE < / >: shift every step one place left (-1) or right (+1) within FIRST..LAST (p.19) */
export function rotate(s: SeqStrings, dir: -1 | 1): SeqStrings {
  const a = s.seq_first - 1, b = s.seq_len - 1;
  if (b <= a) return s;
  const rot = (str: string) => {
    const mid = str.slice(a, b + 1);
    const r = dir < 0 ? mid.slice(1) + mid[0] : mid[mid.length - 1] + mid.slice(0, -1);
    return str.slice(0, a) + r + str.slice(b + 1);
  };
  return { ...s, arp_seq: rot(s.arp_seq), arp_seq2: rot(s.arp_seq2), arp_seq_flags: rot(s.arp_seq_flags) };
}

/** Quick erase while running: keep the length, blank every step (p.20) */
export function blankSteps(s: SeqStrings): SeqStrings {
  let flags = EMPTY_FLAGS;
  for (let i = 0; i < SEQ_STEPS; i++) flags = setChar(flags, i, flagChar(F_REST));
  return { ...s, arp_seq: EMPTY_PITCHES, arp_seq2: EMPTY_PITCHES, arp_seq_flags: flags };
}

/** For the step LEDs (p.18): 0 dark (rest, or after the last step), 1 dim (active) */
export function stepLit(s: SeqStrings, i: number): number {
  if (i + 1 > s.seq_len || i + 1 < s.seq_first) return 0;
  const f = flagsAt(s, i);
  if (f & (F_REST | F_SKIP)) return 0;
  return charNote(s.arp_seq[i]) === null ? 0 : 1;
}

/** Only the changed controls, for setValue */
export function seqDiff(before: SeqStrings, after: SeqStrings): Partial<SeqStrings> {
  const d: Partial<SeqStrings> = {};
  (Object.keys(after) as (keyof SeqStrings)[]).forEach(k => {
    if (before[k] !== after[k]) (d as Record<string, unknown>)[k] = after[k];
  });
  return d;
}
