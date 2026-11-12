// ============================================================================
// The order a question's options are shown in.
//
// Lessons write the correct option wherever it reads best (most often first), so the
// order on screen is shuffled: recalling the answer must not turn into remembering its
// position (docs/PEDAGOGY.md, retrieval practice). The shuffle is seeded, so a question
// keeps its order while it is on screen and when the learner steps back to it, and gets
// a new one in the next session or the next Daily Review.
//
// Answers are still recorded as the option's index in the lesson, so checks, review
// scheduling and the lesson runner are unchanged.
// ============================================================================
import type { MultipleChoice } from '@/types';

/** "Both", "Neither", "None of them", "All of the above": they read last, after the options they refer to */
const SUMMING = /^(both|neither|none|all)\b(\s+(of|the)\b.*)?[.!]?$/i;
/** Options that name the sides of an A/B ("A", "B, with the cut", "A (12-JI)") keep the lesson's order: "A" must not be shown as option B */
const SIDE_A = /^A(?:$|[,:]| \()/;
const SIDE_B = /^B(?:$|[,:]| \()/;

/** FNV-1a, 32 bit */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** mulberry32: a small seeded generator, enough for shuffling a handful of options */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let sessionSalt: number | null = null;
/** One salt per page load: the same question is laid out the same way all session, differently next time */
export function sessionSeed(): number {
  if (sessionSalt === null) sessionSalt = Math.floor(Math.random() * 0x7fffffff);
  return sessionSalt;
}

/** Is this a question whose options must stay in the lesson's order? */
export function keepsOrder(mc: MultipleChoice): boolean {
  return mc.options.some(o => SIDE_A.test(o.trim())) && mc.options.some(o => SIDE_B.test(o.trim()));
}

/**
 * The option indices in the order to show them. `seed` picks the shuffle; the same
 * question with the same seed always gives the same order.
 */
export function optionOrder(mc: MultipleChoice, seed: number): number[] {
  const all = mc.options.map((_, i) => i);
  if (all.length < 2 || keepsOrder(mc)) return all;
  const last = all.filter(i => SUMMING.test(mc.options[i].trim()));
  const free = all.filter(i => !last.includes(i));
  const next = rng(hash(mc.question + '\u0001' + mc.options.join('\u0001')) ^ seed);
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  return [...free, ...last];
}
