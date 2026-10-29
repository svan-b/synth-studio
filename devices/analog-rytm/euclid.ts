// ============================================================================
// The Euclidean sequencer: TRIG menu page 2 (Rytm MKII manual p.44)
//
// Two pulse generators spread their trigs as evenly as they can over the track
// (PL1, PL2 pulses), each with its own rotation (RO1, RO2); a Boolean operator
// (OR, XOR, AND, SUB) combines them, and TRO rotates the result. LEN is the
// track length (ADVANCED scale mode only). EUC turns the mode on for a track.
//
// In the twin (the manual leaves the details open, so these are **design**):
// - Settings live on the pattern's track (`track.euc`), like the TRIG page.
// - The track's own trigs stay as they are, hidden, while EUC is on, and come
//   back when it goes off (manual p.44). A generated trig on a step that holds
//   one of them plays with that trig's settings and locks ("these trigs will be
//   distributed according to the settings").
// - Generated trigs can be parameter locked (and sound locked); those edits are
//   kept in `euc.steps`. Edited trigs stay when EUC goes off ("if you press any
//   already placed trigs, they will remain"). [FUNC] + EUC off keeps every
//   generated trig and removes the track's earlier ones (manual p.44).
// - A pulse generator spreads its pulses with Bjorklund's algorithm, the first
//   pulse on step 1 (bjorklund below); positive rotation moves trigs later.
//
// Everything that plays or shows the trigs reads the *view* of the project
// (euclidView): there, a Euclidean track's steps are the generated trigs. Edits
// made on the view are written back with euclidWriteBack: lock edits on
// generated trigs go to `euc.steps`, adding or removing trigs is ignored
// ("it is not possible to add note trigs manually"), everything else stays.
// ============================================================================

import {
  getPattern, trackLength, withTrack, type Pattern, type PatternId, type Project, type Step, type Track,
} from '@/lib/sequencer/elektron';

export const EUC_OPS = ['OR', 'XOR', 'AND', 'SUB'] as const;

export interface Euclid {
  /** EUC: the mode is on */
  on?: boolean;
  pl1: number;
  pl2: number;
  ro1: number;
  ro2: number;
  tro: number;
  /** Index into EUC_OPS */
  op: number;
  /** Edited (locked) generated trigs, by step */
  steps?: Record<number, Step>;
}

export type EucTrack = Track & { euc?: Euclid };

export const EUC_DEFAULT: Readonly<Euclid> = Object.freeze({ pl1: 4, pl2: 0, ro1: 0, ro2: 0, tro: 0, op: 0 });

const mod = (a: number, n: number) => ((a % n) + n) % n;
const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);

/**
 * `pulses` onsets spread as evenly as possible over `len` steps, the first on step 0:
 * Bjorklund's algorithm, which gives the familiar Euclidean rhythms (3 of 8 = x..x..x.,
 * 5 of 8 = x.xx.xx.; Toussaint, "The Euclidean algorithm generates traditional musical
 * rhythms", 2005)
 */
export function bjorklund(pulses: number, len: number): boolean[] {
  const n = Math.max(1, Math.round(len));
  const k = Math.max(0, Math.min(n, Math.round(pulses)));
  if (k === 0 || k === n) return Array.from({ length: n }, () => k === n);
  let a: number[][] = Array.from({ length: k }, () => [1]);
  let b: number[][] = Array.from({ length: n - k }, () => [0]);
  while (b.length > 1) {
    const m = Math.min(a.length, b.length);
    const joined: number[][] = [];
    for (let i = 0; i < m; i++) joined.push([...a[i], ...b[i]]);
    const rest = a.length > m ? a.slice(m) : b.slice(m);
    a = joined;
    b = rest;
  }
  return [...a.flat(), ...b.flat()].map(x => x === 1);
}

/** One pulse generator: its steps on a track of `len` steps, rotated by `rot` (positive = later) */
export function pulseSteps(pulses: number, len: number, rot = 0): Set<number> {
  const n = Math.max(1, Math.round(len));
  const out = new Set<number>();
  bjorklund(pulses, n).forEach((on, i) => { if (on) out.add(mod(i + Math.round(rot), n)); });
  return out;
}

/** The steps (sorted) the two generators and the operator give on a track of `len` steps */
export function euclidSteps(e: Euclid, len: number): number[] {
  const n = Math.max(1, Math.round(len));
  const a = pulseSteps(e.pl1, n, e.ro1);
  const b = pulseSteps(e.pl2, n, e.ro2);
  const out: number[] = [];
  for (let s = 0; s < n; s++) {
    const x = a.has(s), y = b.has(s);
    const on = e.op === 1 ? x !== y : e.op === 2 ? x && y : e.op === 3 ? x && !y : x || y;
    if (on) out.push(s);
  }
  return out.map(s => mod(s + Math.round(e.tro), n)).sort((p, q) => p - q);
}

/** A saved `euc`, repaired (or undefined) */
export function cleanEuclid(x: unknown): Euclid | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const o = x as Record<string, unknown>;
  const e: Euclid = {
    pl1: int(o.pl1, 0, 64, EUC_DEFAULT.pl1), pl2: int(o.pl2, 0, 64, EUC_DEFAULT.pl2),
    ro1: int(o.ro1, -63, 63, 0), ro2: int(o.ro2, -63, 63, 0), tro: int(o.tro, -63, 63, 0), op: int(o.op, 0, 3, 0),
  };
  if (o.on === true) e.on = true;
  if (o.steps && typeof o.steps === 'object') {
    const steps: Record<number, Step> = {};
    for (const [k, v] of Object.entries(o.steps as Record<string, unknown>)) {
      const i = Number(k);
      if (Number.isInteger(i) && i >= 0 && i < 64 && v && typeof v === 'object') steps[i] = v as Step;
    }
    if (Object.keys(steps).length) e.steps = steps;
  }
  return e;
}

export const euclidOf = (t: Track | undefined): Euclid | undefined => (t as EucTrack | undefined)?.euc;
export const euclidOn = (t: Track | undefined): boolean => !!euclidOf(t)?.on;

// ----------------------------------------------------------------------------
// The view: Euclidean tracks show and play their generated trigs
// ----------------------------------------------------------------------------

const EMPTY: Readonly<Step> = Object.freeze({}) as Step;
const trackViews = new WeakMap<Track, { len: number; view: Track }>();
const patternViews = new WeakMap<Pattern, Pattern>();
const projectViews = new WeakMap<Project, Project>();

/** The step a generated trig plays: an edit of it, else a note trig of the track's own on that step, else a plain trig */
function generatedStep(t: EucTrack, s: number): Step {
  const edited = t.euc?.steps?.[s];
  if (edited) return edited;
  const own = t.steps[s];
  return own && !own.trigless ? own : EMPTY;
}

/** A Euclidean track as it plays: its steps are the generated trigs */
export function trackView(t: Track, len: number): Track {
  const e = euclidOf(t);
  if (!e?.on) return t;
  const hit = trackViews.get(t);
  if (hit && hit.len === len) return hit.view;
  const steps: Record<number, Step> = {};
  for (const s of euclidSteps(e, len)) steps[s] = generatedStep(t as EucTrack, s);
  const view = { ...t, steps };
  trackViews.set(t, { len, view });
  return view;
}

function patternView(pat: Pattern): Pattern {
  if (!pat.tracks.some(euclidOn)) return pat;
  const hit = patternViews.get(pat);
  if (hit) return hit;
  const view = { ...pat, tracks: pat.tracks.map((t, i) => trackView(t, trackLength(pat, i))) };
  patternViews.set(pat, view);
  return view;
}

/** The project as it plays and shows: the same object when no track is in Euclidean mode */
export function euclidView<P extends Project>(p: P): P {
  const hit = projectViews.get(p);
  if (hit) return hit as P;
  let patterns: Record<PatternId, Pattern> | null = null;
  for (const id in p.patterns) {
    const v = patternView(p.patterns[id]);
    if (v !== p.patterns[id]) (patterns ??= { ...p.patterns })[id] = v;
  }
  const view = patterns ? { ...p, patterns } : p;
  projectViews.set(p, view);
  return view;
}

/**
 * Writes an edit made on the view back to the project. `next` is `edit(euclidView(real))`.
 * On a Euclidean track, changed generated trigs are kept in `euc.steps` and the track's
 * own steps don't change; trigs added or removed there are ignored. Other edits (other
 * tracks, the track's settings, the pattern) are taken as they are. A track that comes
 * back without its `euc` (cleared, pasted over) is taken as it is too.
 */
export function euclidWriteBack<P extends Project>(real: P, next: P): P {
  const view = euclidView(real);
  if (next === view) return real;
  if (view === real) return next;
  let patterns: Record<PatternId, Pattern> | null = null;
  for (const id in next.patterns) {
    const rp = real.patterns[id], vp = view.patterns[id], np = next.patterns[id];
    if (!rp || rp === vp) continue;
    if (np === vp) { (patterns ??= { ...next.patterns })[id] = rp; continue; }
    const tracks = np.tracks.map((nt, i) => {
      const rt = rp.tracks[i] as EucTrack | undefined, vt = vp.tracks[i] as EucTrack | undefined;
      if (!rt || !vt || !rt.euc?.on || rt === vt) return nt;
      if (nt === vt) return rt;
      if ((nt as EucTrack).euc !== vt.euc) return nt;
      let edited: Record<number, Step> | null = null;
      for (const k in vt.steps) {
        const s = Number(k);
        const ns = nt.steps[s];
        if (ns && ns !== vt.steps[s]) (edited ??= { ...(rt.euc.steps ?? {}) })[s] = ns;
      }
      const { steps: _s, euc: _e, ...fields } = nt as EucTrack;
      void _s; void _e;
      return { ...rt, ...fields, steps: rt.steps, euc: edited ? { ...rt.euc, steps: edited } : rt.euc } as Track;
    });
    (patterns ??= { ...next.patterns })[id] = { ...np, tracks };
  }
  const out = patterns ? { ...next, patterns } : next;
  // RELOAD's restore point is kept as the real data had it unless the edit set it
  if (next.restore === view.restore && real.restore !== out.restore) return { ...out, restore: real.restore };
  return out;
}

/** True when the edit on the view tried to add or remove a trig of a Euclidean track (it is ignored) */
export function euclidRefused(real: Project, next: Project): boolean {
  const view = euclidView(real);
  if (next === view || view === real) return false;
  for (const id in next.patterns) {
    const rp = real.patterns[id], vp = view.patterns[id], np = next.patterns[id];
    if (!rp || rp === vp || np === vp) continue;
    for (let i = 0; i < np.tracks.length; i++) {
      const rt = rp.tracks[i], vt = vp.tracks[i], nt = np.tracks[i];
      if (!rt || !vt || !euclidOn(rt) || nt === vt || euclidOf(nt) !== euclidOf(vt)) continue;
      const a = Object.keys(vt.steps), b = Object.keys(nt.steps);
      if (a.length !== b.length || a.some(k => !(k in nt.steps))) return true;
    }
  }
  return false;
}

// ----------------------------------------------------------------------------
// Edits
// ----------------------------------------------------------------------------

/** The settings of a track (the defaults when it has none yet) */
export const euclidSettings = (p: Project, pattern: PatternId, track: number): Euclid =>
  euclidOf(getPattern(p, pattern).tracks[track]) ?? { ...EUC_DEFAULT };

/**
 * Change a track's Euclidean settings. EUC on: the generated trigs play, the track's own
 * are hidden. EUC off: the edited generated trigs join the track's own (manual p.44);
 * with `convert` ([FUNC] held) the generated trigs replace them.
 */
export function setEuclid(p: Project, pattern: PatternId, track: number, patch: Partial<Euclid>, opts: { convert?: boolean } = {}): Project {
  return withTrack(p, pattern, track, t => {
    const cur: Euclid = euclidOf(t) ?? { ...EUC_DEFAULT };
    const next: Euclid = { ...cur, ...patch };
    if (next.on) next.on = true; else delete next.on;
    if (cur.on && !next.on) {
      const pat = getPattern(p, pattern);
      const len = trackLength(pat, track);
      const gen = euclidSteps(cur, len);
      let steps: Record<number, Step>;
      if (opts.convert) {
        steps = {};
        for (const s of gen) steps[s] = { ...generatedStep(t as EucTrack, s) };
      } else {
        steps = { ...t.steps };
        for (const s of gen) { const e = cur.steps?.[s]; if (e) steps[s] = e; }
      }
      delete next.steps;
      return { ...t, steps, euc: next } as Track;
    }
    if (!cur.on && next.on) delete next.steps;
    return { ...t, euc: next } as Track;
  });
}
