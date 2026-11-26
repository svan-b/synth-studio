/**
 * Was that the right chord?
 *
 * Naming every note of a strum through a microphone is unreliable: strings
 * share harmonics, and a chord's notes mask each other. But the app always
 * knows which chord should sound, and that is a far easier question. The
 * newly struck sound is folded onto the twelve notes of the scale (its
 * chroma), and a right chord puts much of it on its own notes, with each of
 * them present.
 *
 * The app also knows what a learner is likely to play by mistake: the chord
 * they have just left, or another chord they know. So the strum is compared
 * with those too, and it passes only when the chord asked for fits better.
 *
 * Measured on real acoustic guitar recordings (GuitarSet, mostly busy
 * strumming and jazz voicings, see tracker.eval.test.ts), the right chord
 * beat every wrong alternative about four times in five, and a wrong chord
 * passed the share test rarely. Slow strums of open chords, which is what a
 * beginner plays, are an easier case. Even so the app treats this as a
 * guide: in a timed run a few misjudged strums do not fail it, and when the
 * music waits there is always a way to move on.
 */

import { pitchClass } from '../music/theory';

export interface ChordFit {
  /** Share of the struck sound that sits on the chord's notes, 0 to 1. */
  share: number;
  /** Share of the chord's notes that are clearly present. */
  coverage: number;
  /** The chord's notes that were faint or missing. */
  missing: number[];
}

/** A chord note counts as present when it holds at least this share of the sound. */
const PRESENT = 0.05;
/** Share of the sound a right chord is expected to hold, at the least. */
const SHARE = 0.45;
/** How much better a likely mistake must fit than the chord asked for, to be named. */
export const MARGIN = 0.04;
/**
 * The same, for a chord that is possible but less likely than the one just
 * left, such as any other chord the learner knows. The more chords are
 * compared, the likelier one of them fits a right strum a little better by
 * chance, so each must win more clearly.
 */
export const OTHER_MARGIN = 0.1;
/** The same, for a chord a fifth above, which the right chord's own harmonics favour. */
const SHADOW_MARGIN = 0.15;

export function chordFit(chroma: number[], pcs: number[]): ChordFit {
  if (chroma.length !== 12) return { share: 0, coverage: 0, missing: pcs.slice() };
  const set = Array.from(new Set(pcs.map(pitchClass)));
  let share = 0;
  for (const pc of set) share += chroma[pc];
  const missing = set.filter((pc) => chroma[pc] < PRESENT);
  return { share, coverage: (set.length - missing.length) / Math.max(1, set.length), missing };
}

export interface ChordVerdict {
  ok: boolean;
  fit: ChordFit;
  /** The chord it sounded more like, when one of the likely mistakes fit better. */
  heard: string | null;
  /** Nothing pitched was heard: a muted or dead strum. */
  dead: boolean;
}

/**
 * Judge a strum against the chord it should be, and against the chords it is
 * likely to be mistaken for, given as symbol and notes. A three note chord may
 * lose one note to a quiet string. Larger chords may lose a little more.
 */
export function judgeChord(chroma: number[], pcs: number[], confusers: Array<{ symbol: string; pcs: number[]; margin?: number }> = []): ChordVerdict {
  const fit = chordFit(chroma, pcs);
  if (chroma.length !== 12) return { ok: false, fit, heard: null, dead: true };
  const size = new Set(pcs.map(pitchClass)).size;
  const need = size <= 2 ? 0.5 : size === 3 ? 2 / 3 : 0.7;
  let heard: string | null = null;
  let best = fit.share;
  const own = new Set(pcs.map(pitchClass));
  const fifths = new Set(Array.from(own).map((pc) => pitchClass(pc + 7)));
  for (const c of confusers) {
    // A chord with the very same notes is no mistake.
    const theirs = new Set(c.pcs.map(pitchClass));
    if (theirs.size === own.size && Array.from(theirs).every((pc) => own.has(pc))) continue;
    // A chord that only adds one note to the one asked for, such as A7 for A,
    // is not counted as a mistake. It always holds at least as much of the
    // sound, and on real guitars the added note is often there anyway: the
    // seventh harmonic of a low string falls close to it, and other strings
    // ring on. Measured on GuitarSet, plain chords would be taken for their
    // seventh far too often. The two sound close, so letting it pass costs little.
    const added = Array.from(theirs).filter((pc) => !own.has(pc));
    const contains = Array.from(own).every((pc) => theirs.has(pc));
    if (contains && added.length <= 1) continue;
    // The third harmonic of every string sounds a fifth above it, so the
    // harmonics of a chord fall on the notes of the chord a fifth above:
    // those of G on D, of C on G, of A on E. A chord whose own notes all lie
    // there gets a share of the sound from the right chord's harmonics alone,
    // so it must win more clearly to count as the mistake.
    const shadow = added.length > 0 && added.every((pc) => fifths.has(pc));
    const s = chordFit(chroma, c.pcs).share;
    if (s > best + Math.max(c.margin ?? MARGIN, shadow ? SHADOW_MARGIN : 0)) {
      best = s;
      heard = c.symbol;
    }
  }
  const ok = heard === null && fit.share >= SHARE && fit.coverage >= need - 1e-9;
  return { ok, fit, heard, dead: false };
}
