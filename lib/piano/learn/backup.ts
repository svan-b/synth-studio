/**
 * Reading a backup before it replaces anything. A backup can come from this
 * app's Save a backup, from the dated copies the iPad app keeps, or from the
 * browser's own store. Whatever it is, nothing in it is trusted: each record
 * is checked, records that do not make sense are left out, and a file that
 * is not a backup of this app at all is turned away, so that a wrong file
 * can never wipe out progress or leave a screen that will not open.
 */

import { allPieces, lessonOrder, pieceInfo } from '../content/catalog';
import { newPieceState, type PieceState, type SectionState } from './coach';
import type { StoredCard } from './srs';
import type { DayLog, DrillState, LessonProgress, PieceRecordings, Profile, Recording, Settings } from './store';

type Obj = Record<string, unknown>;

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isDay = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
const count = (x: unknown, fallback = 0) => (isNum(x) && x >= 0 ? Math.floor(x) : fallback);

export interface Backup {
  /** The version of the course the backup was made under. */
  course: number;
  profile: Partial<Profile>;
  settings: Partial<Settings>;
  lessons: Record<string, LessonProgress>;
  pieces: Record<string, PieceState>;
  cards: Record<string, StoredCard>;
  days: Record<string, DayLog>;
  drills: Record<string, DrillState>;
  recordings: Record<string, PieceRecordings>;
  sessionDoneOn: string | null;
}

/**
 * The backup in some text, cleaned, or null when the text is not a backup of
 * this app. `current` is the course version of this build: a dated copy that
 * does not say its course was made by a build that did not record it, and
 * every such build is past course 1 only where it says so.
 */
export function readBackup(text: string, current: number): Backup | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(parsed)) return null;
  // The browser's own store wraps the state as { state, version }.
  const wrapped = isObj(parsed.state) && isObj((parsed.state as Obj).profile);
  const data = (wrapped ? parsed.state : parsed) as Obj;
  if (!isObj(data.profile)) return null;
  const profile = data.profile;
  // Something with a profile, but not this app's: a profile here always says how long a session is.
  if (!isNum(profile.minutes) && typeof profile.onboarded !== 'boolean') return null;
  // And it has at least some of what a backup of this app holds.
  const parts = ['lessons', 'pieces', 'cards', 'days', 'drills', 'settings'].filter((k) => isObj(data[k]));
  if (parsed.app !== 'middle-c' && parts.length < 2) return null;

  const course = isNum(parsed.course)
    ? parsed.course
    : isNum(data.course)
      ? (data.course as number)
      : wrapped && isNum(parsed.version)
        ? parsed.version
        : // A backup saved from the app before it recorded the course was made under the first one.
          parsed.app === 'middle-c'
          ? 1
          : // A dated copy from an iPad build that did not record the course. Under the first course the lesson
            // on arpeggios was reached without the lesson on sharps and flats, which did not exist yet.
            isObj(data.lessons) && isObj(data.lessons.arpeggios) && data.lessons.arpeggios.done === true && !data.lessons.accidentals
            ? 1
            : current;

  return {
    course,
    profile: cleanProfile(profile),
    settings: isObj(data.settings) ? (data.settings as Partial<Settings>) : {},
    lessons: cleanLessons(data.lessons),
    pieces: cleanPieces(data.pieces),
    cards: cleanCards(data.cards),
    days: cleanDays(data.days),
    drills: cleanDrills(data.drills),
    recordings: cleanRecordings(data.recordings),
    sessionDoneOn: isDay(data.sessionDoneOn) ? data.sessionDoneOn : null,
  };
}

/** What a backup holds, in a few words, so the learner can see it is the right one before it replaces anything. */
export function describeBackup(b: Backup): string {
  const taken = Object.values(b.lessons).filter((l) => l.done && !l.skipped).length;
  const learned = Object.values(b.pieces).filter((p) => p.learned).length;
  const days = Object.keys(b.days)
    .filter((d) => b.days[d].seconds >= 60)
    .sort();
  const last = days[days.length - 1];
  const lessons = taken === 0 ? 'no lessons' : taken === 1 ? 'one lesson' : `${taken} lessons`;
  const pieces = learned === 0 ? 'no pieces learned' : learned === 1 ? 'one piece learned' : `${learned} pieces learned`;
  const practised = days.length === 0 ? 'no days of practice' : days.length === 1 ? 'one day of practice' : `${days.length} days of practice`;
  return `${lessons} taken, ${pieces}, ${practised}${last ? `, the last on ${last}` : ''}`;
}

function cleanProfile(p: Obj): Partial<Profile> {
  const out: Partial<Profile> = {};
  if (typeof p.onboarded === 'boolean') out.onboarded = p.onboarded;
  if (p.experience === 'new' || p.experience === 'some' || p.experience === 'returning') out.experience = p.experience;
  if (isNum(p.minutes) && p.minutes >= 5 && p.minutes <= 120) out.minutes = Math.round(p.minutes);
  if (isDay(p.startedOn)) out.startedOn = p.startedOn;
  return out;
}

function cleanLessons(x: unknown): Record<string, LessonProgress> {
  const out: Record<string, LessonProgress> = {};
  if (!isObj(x)) return out;
  // Lessons of this course, and the one an earlier course had under a name still in use.
  const known = new Set(lessonOrder());
  for (const [id, v] of Object.entries(x)) {
    if (!known.has(id) || !isObj(v) || typeof v.done !== 'boolean') continue;
    const l: LessonProgress = { done: v.done, step: count(v.step) };
    if (isDay(v.doneOn)) l.doneOn = v.doneOn;
    if (v.skipped === true) l.skipped = true;
    out[id] = l;
  }
  return out;
}

function cleanSection(v: unknown): SectionState | null {
  if (!isObj(v) || !isNum(v.rung)) return null;
  const s: SectionState = { rung: count(v.rung), streak: count(v.streak), fails: count(v.fails) };
  if (isNum(v.tries)) s.tries = count(v.tries);
  return s;
}

function cleanPieces(x: unknown): Record<string, PieceState> {
  const out: Record<string, PieceState> = {};
  if (!isObj(x)) return out;
  const known = new Set(allPieces().map((p) => p.id));
  for (const [id, v] of Object.entries(x)) {
    if (!known.has(id) || !isObj(v)) continue;
    const info = pieceInfo(id);
    const startedOn = isDay(v.startedOn) ? v.startedOn : isDay(v.lastOn) ? v.lastOn : null;
    if (!startedOn) continue;
    const fresh = newPieceState(info, startedOn);
    const sections = Array.isArray(v.sections) ? v.sections.map(cleanSection) : [];
    // Phrases kept against a different division of the piece cannot be matched up, so they start again.
    const fits = sections.length === fresh.sections.length && sections.every((s) => s !== null);
    const learned = v.learned === true;
    const piece: PieceState = {
      ...fresh,
      lastOn: isDay(v.lastOn) ? v.lastOn : startedOn,
      sections: fits ? (sections as SectionState[]) : fresh.sections,
      joined: fits ? Math.min(count(v.joined), fresh.sections.length - 1) : 0,
      wholeRung: Math.min(count(v.wholeRung), 3),
      wholeStreak: count(v.wholeStreak),
      wholeFails: count(v.wholeFails),
      learned,
      tasksToday: count(v.tasksToday),
      bestAccuracy: isNum(v.bestAccuracy) ? Math.max(0, Math.min(1, v.bestAccuracy)) : 0,
      trial: v.trial === 'pending' || v.trial === 'done' ? v.trial : learned || !fits ? 'done' : undefined,
    };
    if (isDay(v.learnedOn)) piece.learnedOn = v.learnedOn;
    if (isNum(v.joinFails)) piece.joinFails = count(v.joinFails);
    const f = v.focus;
    if (isObj(f) && isNum(f.from) && isNum(f.to) && isNum(f.left) && Array.isArray(f.hands)) {
      const hands = f.hands.filter((h): h is 'R' | 'L' => h === 'R' || h === 'L');
      const from = count(f.from);
      const to = Math.min(count(f.to), info.measures - 1);
      if (hands.length > 0 && from <= to) piece.focus = { from, to, left: Math.max(1, count(f.left)), hands };
    }
    out[id] = piece;
  }
  return out;
}

function cleanCards(x: unknown): Record<string, StoredCard> {
  const out: Record<string, StoredCard> = {};
  if (!isObj(x)) return out;
  for (const [id, v] of Object.entries(x)) {
    if (!isObj(v) || typeof v.due !== 'string' || Number.isNaN(new Date(v.due).getTime())) continue;
    if (!isNum(v.stability) || !isNum(v.difficulty) || !isNum(v.state)) continue;
    out[id] = {
      due: v.due,
      stability: v.stability,
      difficulty: v.difficulty,
      scheduled_days: count(v.scheduled_days),
      reps: count(v.reps),
      lapses: count(v.lapses),
      learning_steps: count(v.learning_steps),
      state: v.state,
      ...(typeof v.last_review === 'string' ? { last_review: v.last_review } : {}),
    };
  }
  return out;
}

function cleanDays(x: unknown): Record<string, DayLog> {
  const out: Record<string, DayLog> = {};
  if (!isObj(x)) return out;
  for (const [day, v] of Object.entries(x)) {
    if (!isDay(day) || !isObj(v) || !isNum(v.seconds)) continue;
    // A day has no more than a day in it.
    out[day] = { seconds: Math.min(86_400, Math.max(0, v.seconds)), notes: count(v.notes), activities: count(v.activities) };
  }
  return out;
}

function cleanDrills(x: unknown): Record<string, DrillState> {
  const out: Record<string, DrillState> = {};
  if (!isObj(x)) return out;
  for (const [id, v] of Object.entries(x)) {
    if (!isObj(v) || !isNum(v.level)) continue;
    const recent = Array.isArray(v.recent) ? v.recent.filter((r): r is number => r === 0 || r === 1).slice(-20) : [];
    const d: DrillState = { level: Math.max(1, Math.min(12, Math.round(v.level))), recent };
    if (isNum(v.best)) d.best = v.best;
    if (isDay(v.lastOn)) d.lastOn = v.lastOn;
    out[id] = d;
  }
  return out;
}

function cleanRecording(v: unknown): Recording | null {
  if (!isObj(v) || !isDay(v.on) || !isObj(v.take)) return null;
  const t = v.take;
  if (!Array.isArray(t.notes) || !t.notes.every((n) => Array.isArray(n) && n.length === 4 && n.every(isNum))) return null;
  const pedal = Array.isArray(t.pedal) ? t.pedal.filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every(isNum)) : [];
  const notes = t.notes as Array<[number, number, number, number]>;
  const seconds = isNum(t.seconds) ? t.seconds : notes.reduce((a, n) => Math.max(a, n[1] + n[2]), 0);
  return { on: v.on, take: { bpm: isNum(t.bpm) ? t.bpm : 0, lead: isNum(t.lead) ? t.lead : 0, notes, pedal, seconds } };
}

function cleanRecordings(x: unknown): Record<string, PieceRecordings> {
  const out: Record<string, PieceRecordings> = {};
  if (!isObj(x)) return out;
  const known = new Set(allPieces().map((p) => p.id));
  for (const [id, v] of Object.entries(x)) {
    if (!known.has(id) || !isObj(v)) continue;
    const first = cleanRecording(v.first);
    if (!first) continue;
    const latest = cleanRecording(v.latest);
    out[id] = latest ? { first, latest } : { first };
  }
  return out;
}
