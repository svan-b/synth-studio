// ============================================================================
// Sub 37 arpeggiator note order and sequencer step order (Subsequent 37 manual
// pp.15-17, 40). No timing and no audio, so it can be tested offline; the engine
// asks for one step at a time.
//
//  PATTERN     UP · DWN · ORDR (order played) · RND · SEQ (play the step sequence) · REC
//  RANGE       0&-2 · -2 · -1 · 0 · +1 · +2 · 0&+2: one press past either end lights 0 and +-2
//              and plays the original, 2nd and 3rd octaves, then the 2nd again (p.15)
//  BACK/FORTH  UP plays up then down, DWN down then up, ORDR in order then reversed; no
//              effect on RND. END NOTES ONCE: C-E-G-E-C, TWICE: C-E-G-G-E-C-C (pp.16, 40)
//  INVERT      each note plays in every octave of the RANGE before the next note:
//              RANGE +1, C-E-G -> C, C+12, E, E+12, G, G+12; no effect at RANGE 0 (p.16)
// ============================================================================

import { F_SKIP, SEQ_STEPS, charFlags } from './model';

/** Octave offsets of each RANGE position, in the order they are played */
export const RANGE_PASSES: number[][] = [
  [0, -1, -2, -1],
  [0, -1, -2],
  [0, -1],
  [0],
  [0, 1],
  [0, 1, 2],
  [0, 1, 2, 1],
];

export interface ArpOptions {
  pattern: number;      // 0 UP, 1 DWN, 2 ORDR, 3 RND
  range: number;        // index into RANGE_PASSES
  backFwd: boolean;
  invert: boolean;
  /** END NOTES: false ONCE, true TWICE */
  twice?: boolean;
}

/** One full cycle of the arpeggio for the notes held (in the order they were played) */
export function arpCycle(notes: number[], o: ArpOptions): number[] {
  if (!notes.length) return [];
  const asc = [...notes].sort((a, b) => a - b);
  const base = o.pattern === 2 ? [...notes] : asc;
  const passes = RANGE_PASSES[o.range] ?? [0];
  let cycle: number[] = [];
  if (o.invert && passes.length > 1) {
    // INVERT: every octave of one note before moving to the next
    base.forEach(n => passes.forEach(oct => cycle.push(n + 12 * oct)));
  } else {
    passes.forEach(oct => base.forEach(n => cycle.push(n + 12 * oct)));
  }
  if (o.pattern === 1) cycle.reverse();
  if (o.backFwd && o.pattern !== 3 && cycle.length > 1) {
    const back = [...cycle].reverse();
    // ONCE: the turn-around notes are not repeated; TWICE: both ends play twice
    cycle = o.twice ? cycle.concat(back) : cycle.concat(back.slice(1, -1));
  }
  return cycle.filter(n => n >= 0 && n <= 127);
}

export function isSeqPattern(pattern: number) {
  return Math.round(pattern) === 4;
}

/**
 * Arpeggiator state machine: keeps the note list (with LATCH rules) and hands out
 * the next note.
 *  - without LATCH the list is the keys held, in the order they went down
 *  - with LATCH it keeps playing after release; keys added while others are held join
 *    the list; once every key is up, the next key starts a new list (p.15)
 */
export class Arp {
  notes: number[] = [];
  private index = 0;
  private cycle: number[] = [];
  private dirty = true;
  private held = 0;
  /** The note just handed out was the first of the pattern (STEP 1 RESET, p.40) */
  first = false;

  keyDown(note: number, latch: boolean) {
    if (latch && this.held === 0) this.notes = [];
    if (!this.notes.includes(note)) this.notes.push(note);
    this.held++;
    this.dirty = true;
  }

  keyUp(note: number, latch: boolean) {
    this.held = Math.max(0, this.held - 1);
    if (!latch) { this.notes = this.notes.filter(n => n !== note); this.dirty = true; }
  }

  /** LATCH switched off: keep only what is still held */
  unlatch(held: number[]) {
    this.notes = this.notes.filter(n => held.includes(n));
    this.held = held.length;
    this.dirty = true;
  }

  clear() {
    this.notes = [];
    this.held = 0;
    this.index = 0;
    this.dirty = true;
  }

  reset() {
    this.index = 0;
  }

  invalidate() {
    this.dirty = true;
  }

  /** Next note, or null when there is nothing to play */
  next(o: ArpOptions, random: () => number = Math.random): number | null {
    if (this.dirty) {
      this.cycle = arpCycle(this.notes, o);
      this.dirty = false;
      if (this.index >= this.cycle.length) this.index = 0;
    }
    if (!this.cycle.length) return null;
    this.first = this.index === 0;
    if (o.pattern === 3) {
      this.index = (this.index + 1) % this.cycle.length;
      return this.cycle[Math.floor(random() * this.cycle.length)];
    }
    const n = this.cycle[this.index % this.cycle.length];
    this.index = (this.index + 1) % this.cycle.length;
    return n;
  }

  get position() {
    return this.index;
  }
}

// ---------------------------------------------------------------------------
// Step order of the sequencer: FIRST..LAST STEP, SKIP steps passed over (pp.19-20)
// ---------------------------------------------------------------------------

/** The step to play at or after `i` (wrapping LAST -> FIRST, passing SKIP steps), or -1 */
export function seqStepFrom(flags: string, first: number, last: number, i: number): number {
  const a = Math.max(0, Math.min(SEQ_STEPS - 1, first - 1));
  const b = Math.max(a, Math.min(SEQ_STEPS - 1, last - 1));
  const len = b - a + 1;
  let k = i < a || i > b ? a : i;
  for (let tries = 0; tries < len; tries++) {
    if (!(charFlags(flags[k]) & F_SKIP)) return k;
    k = k >= b ? a : k + 1;
  }
  return -1;
}

/** The step after `i` in play order */
export function seqNextStep(flags: string, first: number, last: number, i: number): number {
  const a = Math.max(0, first - 1), b = Math.max(a, Math.min(SEQ_STEPS - 1, last - 1));
  return seqStepFrom(flags, first, last, i >= b ? a : i + 1);
}
