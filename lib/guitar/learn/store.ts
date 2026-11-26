'use client';

/**
 * Everything the app remembers about the learner. Kept in the browser's own
 * storage, and inside the iPad app also in a file the app owns, so progress
 * survives the web view's storage being cleared. Each copy carries the time
 * it was written, and the newer one is read back.
 */

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { hasSong } from '../content/catalog';
import { saveCopy, savedCopy } from '../native/bridge';
import { dayKey, daysBetween } from '../util/emitter';
import type { SongState } from './coach';
import type { Block } from './planner';
import { newCard, review, type Outcome, type StoredCard } from './srs';

export type Experience = 'new' | 'some' | 'returning';
export type ThemeChoice = 'auto' | 'light' | 'dark';

export interface Profile {
  onboarded: boolean;
  experience: Experience;
  /** Target length of a daily session, in minutes. */
  minutes: number;
  startedOn: string;
  /** The time of day the learner plans to play, as "HH:MM", or null. */
  playAt: string | null;
  /** Where the guitar lives between sessions, as the learner said. */
  guitarOut: boolean;
}

export interface Settings {
  theme: ThemeChoice;
  /** The app's guitar, 0 to 1. */
  volume: number;
  clickVolume: number;
  metronome: boolean;
  /** Extra delay found by the timing check, in milliseconds. */
  latencyMs: number;
  /** Chord pictures drawn for a guitar held the other way round. */
  leftHanded: boolean;
  /** Everything a size larger. Kept for progress saved before there were three sizes. */
  bigText: boolean;
  /** Text size, chosen from where the learner sits: 0 standard, 1 large, 2 largest. */
  textSize?: 0 | 1 | 2;
  /** Read the coach's words aloud. */
  speak?: boolean;
  /** A reminder at the time to play, inside the iPad app. */
  reminder: boolean;
}

export interface LessonProgress {
  done: boolean;
  doneOn?: string;
  /** Marked as known, or gone through without playing any of it. Counted as done, but not as taken. */
  skipped?: boolean;
  step: number;
  /** The steps with playing in them that were played through, by their place in the lesson. */
  passed?: number[];
}

/** Where today's session has got to, so it picks up there if it is left. */
export interface SessionPlace {
  day: string;
  /** The parts of the session as it was begun. */
  blocks: Block[];
  /** The part to do next. */
  index: number;
  /** Parts that were opened, not skipped. */
  opened: number;
}

export interface DayLog {
  seconds: number;
  /** Strums and notes heard. */
  played: number;
  activities: number;
}

export interface DrillState {
  level: number;
  recent: number[];
  best?: number;
  lastOn?: string;
}

/** One minute changes between two chords: the best count, and each day's. */
export interface ChangeRecord {
  best: number;
  /** Day and count, oldest first. */
  history: Array<[string, number]>;
}

/** A recording of the learner, kept in the browser's file store under `key`. */
export interface Recording {
  on: string;
  key: string;
  seconds: number;
}

export interface SongRecordings {
  first: Recording;
  latest?: Recording;
}

interface State {
  profile: Profile;
  settings: Settings;
  lessons: Record<string, LessonProgress>;
  songs: Record<string, SongState>;
  cards: Record<string, StoredCard>;
  days: Record<string, DayLog>;
  drills: Record<string, DrillState>;
  changes: Record<string, ChangeRecord>;
  recordings: Record<string, SongRecordings>;
  /** The day the guitar was last tuned with the app. */
  tunedOn: string | null;
  sessionDoneOn: string | null;
  sessionAt: SessionPlace | null;

  setProfile: (patch: Partial<Profile>) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setLessonStep: (id: string, step: number) => void;
  /** A step with playing in it was played through. */
  passLessonStep: (id: string, step: number) => void;
  /** The end of a lesson was reached. `played` is false when all its playing was skipped: it is then kept as known, not as taken. */
  completeLesson: (id: string, played?: boolean) => void;
  skipLesson: (id: string) => void;
  setSessionAt: (place: SessionPlace | null) => void;
  setSong: (id: string, state: SongState) => void;
  keepRecording: (id: string, rec: Recording) => Recording[];
  addCards: (ids: string[]) => void;
  reviewCard: (id: string, outcome: Outcome) => void;
  logPractice: (seconds: number, played: number, activities?: number) => void;
  recordDrill: (id: string, correct: boolean, level?: number) => void;
  setDrillLevel: (id: string, level: number) => void;
  recordChanges: (a: string, b: string, count: number) => { best: boolean; before: number };
  markTuned: () => void;
  finishSession: () => void;
  importData: (json: string) => boolean;
  resetAll: () => void;
}

const defaultProfile: Profile = { onboarded: false, experience: 'new', minutes: 15, startedOn: dayKey(), playAt: null, guitarOut: true };

const defaultSettings: Settings = {
  theme: 'auto',
  volume: 1,
  clickVolume: 0.7,
  metronome: true,
  latencyMs: 0,
  leftHanded: false,
  bigText: false,
  // Read from a chair with a guitar on the lap, so it starts a size up. The welcome screens ask.
  textSize: 1,
  speak: false,
  reminder: false,
};

/** The text size in use: the chosen one, or what the older setting meant. */
export function textSizeOf(settings: Settings): 0 | 1 | 2 {
  return settings.textSize ?? (settings.bigText ? 1 : 0);
}

/** The key a pair of chords is kept under, the same whichever way round. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/** Is this a saved copy the app can read? */
function readable(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as { state?: unknown } | null;
    return typeof parsed === 'object' && parsed !== null && typeof parsed.state === 'object' && parsed.state !== null;
  } catch {
    return false;
  }
}

/** A saved copy that could not be read is put to one side before anything is written over it, so it can still be looked at. */
function keepAside(name: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(`${name}:unread`, value);
  } catch {
    /* no room to keep it */
  }
}

function record<T>(value: Record<string, T> | undefined | null): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function only<T>(value: Record<string, T>, keep: (key: string) => boolean): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(value)) if (keep(key)) out[key] = value[key];
  return out;
}

/**
 * Read a backup file. It must be one of this app's: a file saved from
 * Settings, or one of the dated copies the iPad app keeps. The piano
 * teacher's backups look alike at a glance and are turned away.
 */
export function readBackup(json: string): Partial<State> | null {
  try {
    const parsed = JSON.parse(json) as (Partial<State> & { state?: Partial<State>; app?: string }) | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const wrapped = parsed.state && typeof parsed.state === 'object' ? parsed.state : null;
    const data: Partial<State> | null = wrapped ?? (parsed.app === 'open-string' ? parsed : null);
    if (!data || typeof data.profile !== 'object' || data.profile === null) return null;
    // The dated copies carry no name, so they are known by what only a guitar teacher keeps.
    if (wrapped && !('changes' in data) && !('tunedOn' in data)) return null;
    return data;
  } catch {
    return null;
  }
}

const progressStorage: StateStorage = {
  getItem: (name) => {
    let local: string | null = null;
    let localAt = 0;
    try {
      if (typeof localStorage !== 'undefined') {
        local = localStorage.getItem(name);
        localAt = Number(localStorage.getItem(`${name}:at`) ?? 0) || 0;
      }
    } catch {
      local = null;
    }
    const saved = savedCopy(name);
    // The newer copy is used, as long as it can be read. If it cannot, the other one is.
    const first = saved && (local === null || saved.at >= localAt) ? saved.value : local;
    const second = first === local ? (saved?.value ?? null) : local;
    if (first !== null && readable(first)) return first;
    if (first !== null) keepAside(name, first);
    if (second !== null && readable(second)) return second;
    return null;
  },
  setItem: (name, value) => {
    const at = Date.now();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(name, value);
        localStorage.setItem(`${name}:at`, String(at));
      }
    } catch {
      /* full or switched off: the app's own file still has it */
    }
    saveCopy(name, value, at);
  },
  removeItem: (name) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(name);
        localStorage.removeItem(`${name}:at`);
      }
    } catch {
      /* nothing to remove */
    }
  },
};

export const STORE_KEY = 'open-string-v1';

export const useGuitar = create<State>()(
  persist(
    (set, get) => ({
      profile: defaultProfile,
      settings: defaultSettings,
      lessons: {},
      songs: {},
      cards: {},
      days: {},
      drills: {},
      changes: {},
      recordings: {},
      tunedOn: null,
      sessionDoneOn: null,
      sessionAt: null,

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setLessonStep: (id, step) => set((s) => ({ lessons: { ...s.lessons, [id]: { ...(s.lessons[id] ?? { done: false }), step } } })),
      passLessonStep: (id, step) =>
        set((s) => {
          const prev = s.lessons[id] ?? { done: false, step: 0 };
          if (prev.passed?.includes(step)) return {};
          return { lessons: { ...s.lessons, [id]: { ...prev, passed: [...(prev.passed ?? []), step] } } };
        }),
      completeLesson: (id, played = true) =>
        set((s) => {
          const prev = s.lessons[id];
          // A lesson taken properly before stays so, whatever is done with it later.
          if (prev?.done && !prev.skipped) return { lessons: { ...s.lessons, [id]: { ...prev, step: 0 } } };
          if (!played) return { lessons: { ...s.lessons, [id]: { done: true, skipped: true, step: 0 } } };
          return { lessons: { ...s.lessons, [id]: { done: true, doneOn: dayKey(), step: 0, passed: prev?.passed } } };
        }),
      skipLesson: (id) => set((s) => (s.lessons[id]?.done ? {} : { lessons: { ...s.lessons, [id]: { done: true, skipped: true, step: 0 } } })),
      setSessionAt: (place) => set({ sessionAt: place }),
      setSong: (id, state) => set((s) => ({ songs: { ...s.songs, [id]: state } })),
      keepRecording: (id, rec) => {
        // The first recording of a learned song is kept for good. Later ones replace each other. Returns what was let go.
        const had = get().recordings[id];
        const dropped: Recording[] = had?.latest ? [had.latest] : [];
        set((s) => ({ recordings: { ...s.recordings, [id]: had ? { first: had.first, latest: rec } : { first: rec } } }));
        return dropped;
      },
      addCards: (ids) =>
        set((s) => {
          const cards = { ...s.cards };
          let changed = false;
          for (const id of ids) {
            if (!cards[id]) {
              cards[id] = newCard();
              changed = true;
            }
          }
          return changed ? { cards } : {};
        }),
      reviewCard: (id, outcome) => set((s) => ({ cards: { ...s.cards, [id]: review(s.cards[id], outcome) } })),
      logPractice: (seconds, played, activities = 0) =>
        set((s) => {
          const day = dayKey();
          const prev = s.days[day] ?? { seconds: 0, played: 0, activities: 0 };
          return { days: { ...s.days, [day]: { seconds: prev.seconds + Math.max(0, seconds), played: prev.played + played, activities: prev.activities + activities } } };
        }),
      recordDrill: (id, correct, level) =>
        set((s) => {
          const prev = s.drills[id] ?? { level: 1, recent: [] };
          const recent = [...prev.recent, correct ? 1 : 0].slice(-20);
          return { drills: { ...s.drills, [id]: { ...prev, level: level ?? prev.level, recent, lastOn: dayKey() } } };
        }),
      setDrillLevel: (id, level) => set((s) => ({ drills: { ...s.drills, [id]: { ...(s.drills[id] ?? { recent: [] }), level, recent: [] } } })),
      recordChanges: (a, b, count) => {
        const key = pairKey(a, b);
        const prev = get().changes[key];
        const before = prev?.best ?? 0;
        const today = dayKey();
        const history = (prev?.history ?? []).filter(([d]) => d !== today);
        const todayBest = Math.max(count, (prev?.history ?? []).find(([d]) => d === today)?.[1] ?? 0);
        history.push([today, todayBest]);
        set((s) => ({ changes: { ...s.changes, [key]: { best: Math.max(before, count), history: history.slice(-60) } } }));
        return { best: count > before && before > 0, before };
      },
      markTuned: () => set({ tunedOn: dayKey() }),
      finishSession: () => set({ sessionDoneOn: dayKey(), sessionAt: null }),
      importData: (json) => {
        const data = readBackup(json);
        if (!data) return false;
        const here = get().settings;
        set({
          profile: { ...defaultProfile, ...data.profile },
          // How this iPad hears and reminds belongs to this iPad, not to the one the backup came from.
          settings: { ...defaultSettings, ...(data.settings ?? {}), latencyMs: here.latencyMs, reminder: here.reminder },
          lessons: record(data.lessons),
          songs: only(record(data.songs), hasSong),
          cards: record(data.cards),
          days: record(data.days),
          drills: record(data.drills),
          changes: record(data.changes),
          recordings: only(record(data.recordings), hasSong),
          tunedOn: typeof data.tunedOn === 'string' ? data.tunedOn : null,
          sessionDoneOn: typeof data.sessionDoneOn === 'string' ? data.sessionDoneOn : null,
          sessionAt: null,
        });
        return true;
      },
      resetAll: () =>
        set({
          profile: { ...get().profile, startedOn: dayKey() },
          settings: get().settings,
          lessons: {},
          songs: {},
          cards: {},
          days: {},
          drills: {},
          changes: {},
          recordings: {},
          tunedOn: null,
          sessionDoneOn: null,
          sessionAt: null,
        }),
    }),
    {
      name: STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => progressStorage),
      // Progress saved by an older or a newer version is read as it stands, never thrown away.
      migrate: (saved) => saved as State,
      // Anything a saved copy lacks takes its usual value, so a setting added later is never missing.
      merge: (saved, current) => {
        const old = (saved ?? {}) as Partial<State>;
        return {
          ...current,
          ...old,
          profile: { ...current.profile, ...(old.profile ?? {}) },
          settings: { ...current.settings, ...(old.settings ?? {}) },
          lessons: record(old.lessons),
          songs: record(old.songs),
          cards: record(old.cards),
          days: record(old.days),
          drills: record(old.drills),
          changes: record(old.changes),
          recordings: record(old.recordings),
        };
      },
      partialize: (s) => ({
        profile: s.profile,
        settings: s.settings,
        lessons: s.lessons,
        songs: s.songs,
        cards: s.cards,
        days: s.days,
        drills: s.drills,
        changes: s.changes,
        recordings: s.recordings,
        tunedOn: s.tunedOn,
        sessionDoneOn: s.sessionDoneOn,
        sessionAt: s.sessionAt,
      }),
    },
  ),
);

// In a browser, another tab of the app may save progress. Take it in, so this tab does not later write over it with what it knew before.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY && e.newValue) void useGuitar.persist.rehydrate();
  });
}

export function exportData(): string {
  const s = useGuitar.getState();
  return JSON.stringify(
    {
      app: 'open-string',
      exportedAt: new Date().toISOString(),
      profile: s.profile,
      settings: s.settings,
      lessons: s.lessons,
      songs: s.songs,
      cards: s.cards,
      days: s.days,
      drills: s.drills,
      changes: s.changes,
      recordings: s.recordings,
      tunedOn: s.tunedOn,
      sessionDoneOn: s.sessionDoneOn,
    },
    null,
    2,
  );
}

/** A day counts as played with a minute or more at the guitar. */
export function played(days: Record<string, DayLog>, day: string): boolean {
  return (days[day]?.seconds ?? 0) >= 60;
}

/**
 * Days played in the seven days ending today. Used in place of a run of days
 * in a row: one missed day does not undo a habit forming, so it should not
 * look as if it does.
 */
export function daysThisWeek(days: Record<string, DayLog>, today: string = dayKey()): boolean[] {
  const out: boolean[] = [];
  const base = new Date(today + 'T12:00:00');
  for (let i = 6; i >= 0; i--) out.push(played(days, dayKey(new Date(base.getTime() - i * 86400000))));
  return out;
}

/** Days since the guitar was last played, counting from today. 0 when played today. */
export function daysAway(days: Record<string, DayLog>, today: string = dayKey()): number | null {
  const list = Object.keys(days)
    .filter((d) => played(days, d) && d <= today)
    .sort();
  if (list.length === 0) return null;
  return daysBetween(list[list.length - 1], today);
}

export function totalMinutes(days: Record<string, DayLog>): number {
  return Math.round(Object.values(days).reduce((a, d) => a + d.seconds, 0) / 60);
}

export function daysPlayed(days: Record<string, DayLog>): number {
  return Object.keys(days).filter((d) => played(days, d)).length;
}
