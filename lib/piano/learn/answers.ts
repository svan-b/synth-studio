/**
 * Answering a question from the piano. Where every choice names a note, the
 * answer is given by playing that note: asked which note is on the page, the
 * learner plays it. Anything else is answered by position, with the keys C,
 * D, E and F standing for the first four choices.
 */

/** The white keys that answer by position. */
export const ANSWER_KEYS: Array<{ pc: number; name: string }> = [
  { pc: 0, name: 'C' },
  { pc: 2, name: 'D' },
  { pc: 4, name: 'E' },
  { pc: 5, name: 'F' },
];

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** The key a choice names, where the choice is a note or a chord named after one: "Middle C", "F sharp", "E minor". */
export function namedKey(choice: string): number | null {
  const m = /^(?:Middle )?([A-G])(?: (sharp|flat))?(?: (?:major|minor))?$/.exec(choice.trim());
  if (!m) return null;
  return (LETTER_PC[m[1]] + (m[2] === 'sharp' ? 1 : m[2] === 'flat' ? 11 : 0)) % 12;
}

/** Which key answers which choice, as pitch classes, or null where the piano cannot answer. */
export function answerKeys(choices: string[]): { byNote: boolean; pcs: number[] } | null {
  const named = choices.map(namedKey);
  if (named.every((pc) => pc !== null) && new Set(named).size === named.length) return { byNote: true, pcs: named as number[] };
  if (choices.length <= ANSWER_KEYS.length) return { byNote: false, pcs: choices.map((_, i) => ANSWER_KEYS[i].pc) };
  return null;
}
