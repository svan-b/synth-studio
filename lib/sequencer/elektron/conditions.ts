// ============================================================================
// Trig conditions: parsing to compact numeric codes (compiled once per edit, so
// the scheduler never touches strings) and human-readable descriptions.
//
//   0           none
//   1..8        FILL !FILL PRE !PRE NEI !NEI 1ST !1ST
//   101..200    X%  (100 + X)
//   1000 + A*16 + B   A:B
// ============================================================================

export const C_NONE = 0;
export const C_FILL = 1;
export const C_NOT_FILL = 2;
export const C_PRE = 3;
export const C_NOT_PRE = 4;
export const C_NEI = 5;
export const C_NOT_NEI = 6;
export const C_FIRST = 7;
export const C_NOT_FIRST = 8;
const PCT_BASE = 100;
const AB_BASE = 1000;

const LOGIC: Record<string, number> = {
  FILL: C_FILL, '!FILL': C_NOT_FILL,
  PRE: C_PRE, '!PRE': C_NOT_PRE,
  NEI: C_NEI, '!NEI': C_NOT_NEI,
  '1ST': C_FIRST, '!1ST': C_NOT_FIRST,
};
const LOGIC_NAMES = ['', 'FILL', '!FILL', 'PRE', '!PRE', 'NEI', '!NEI', '1ST', '!1ST'];

/** Condition string -> code (unknown strings count as no condition) */
export function compileCondition(c: unknown): number {
  if (typeof c !== 'string' || !c) return C_NONE;
  const s = c.trim().toUpperCase().replace(/^NOT\s*/, '!');
  const logic = LOGIC[s];
  if (logic) return logic;
  let m = /^(\d{1,3})\s*%$/.exec(s);
  if (m) {
    const p = Number(m[1]);
    return p >= 1 && p <= 100 ? PCT_BASE + p : C_NONE;
  }
  m = /^([1-8])\s*:\s*([1-8])$/.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return a <= b ? AB_BASE + a * 16 + b : C_NONE;
  }
  return C_NONE;
}

/** Canonical display string for a code ('' for none) */
export function conditionString(code: number): string {
  if (code >= AB_BASE) return `${Math.floor((code - AB_BASE) / 16)}:${(code - AB_BASE) % 16}`;
  if (code > PCT_BASE) return `${code - PCT_BASE}%`;
  return LOGIC_NAMES[code] ?? '';
}

/** Canonical form of a condition string, or undefined when it isn't one */
export function normalizeCondition(c: unknown): string | undefined {
  const code = compileCondition(c);
  return code === C_NONE ? undefined : conditionString(code);
}

export const isProbability = (code: number) => code > PCT_BASE && code < AB_BASE;
export const probabilityOf = (code: number) => code - PCT_BASE;
export const isAB = (code: number) => code >= AB_BASE;
export const abOf = (code: number): [number, number] => [Math.floor((code - AB_BASE) / 16), (code - AB_BASE) % 16];
export const abCode = (a: number, b: number) => AB_BASE + a * 16 + b;
export const probabilityCode = (p: number) => PCT_BASE + p;

/** Conditions whose result does not update the track's "previous condition" state */
export const isPreCondition = (code: number) => code === C_PRE || code === C_NOT_PRE;

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/** One-line explanation for the trig editor */
export function describeCondition(c: unknown): string {
  const code = compileCondition(c);
  if (code === C_NONE) return 'Plays every time';
  if (isAB(code)) {
    const [a, b] = abOf(code);
    return b === 1 ? 'Plays every loop' : `Plays on the ${ORD[a - 1]} of every ${b} loops`;
  }
  if (isProbability(code)) return `${probabilityOf(code)}% chance on each pass`;
  switch (code) {
    case C_FILL: return 'Plays only while FILL is active';
    case C_NOT_FILL: return 'Plays only while FILL is off';
    case C_PRE: return 'Plays if the previous condition on this track was true';
    case C_NOT_PRE: return 'Plays if the previous condition on this track was false';
    case C_NEI: return 'Plays if the latest condition on the track before was true';
    case C_NOT_NEI: return 'Plays if the latest condition on the track before was false';
    case C_FIRST: return 'Plays only the first time the pattern plays';
    case C_NOT_FIRST: return 'Plays every loop except the first';
  }
  return '';
}
