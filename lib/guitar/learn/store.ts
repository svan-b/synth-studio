'use client';

/**
 * Everything the app remembers about the learner. Kept in the browser's own
 * storage, and inside the iPad app also in a file the app owns, so progress
 * survives the web view's storage being cleared. Each copy carries the time
 * it was written, and the newer one is read back.
 */

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { saveCopy, savedCopy } from '../native/bridge';
import { dayKey, daysBetween } from '../util/emitter';
import type { SongState } from './coach';
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
  skipped?: boolean;
  step: number;
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

  setProfile: (patch: Partial<Profile>) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setLessonStep: (id: string, step: number) => void;
  completeLesson: (id: string) => void;
  skipLesson: (id: string) => void;
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
    if (saved && (local === null || saved.at >= localAt)) return saved.value;
    return local;
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

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setLessonStep: (id, step) => set((s) => ({ lessons: { ...s.lessons, [id]: { done: s.lessons[id]?.done ?? false, doneOn: s.lessons[id]?.doneOn, step } } })),
      completeLesson: (id) => set((s) => ({ lessons: { ...s.lessons, [id]: { done: true, doneOn: s.lessons[id]?.doneOn ?? dayKey(), step: 0 } } })),
      skipLesson: (id) => set((s) => (s.lessons[id]?.done ? {} : { lessons: { ...s.lessons, [id]: { done: true, skipped: true, step: 0 } } })),
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
      finishSession: () => set({ sessionDoneOn: dayKey() }),
      importData: (json) => {
        try {
          const parsed = JSON.parse(json) as Partial<State> & { state?: Partial<State>; app?: string };
          const data: Partial<State> = parsed?.state?.profile ? parsed.state : parsed;
          if (!data || typeof data !== 'object' || !data.profile) return false;
          set({
            profile: { ...defaultProfile, ...data.profile },
            settings: { ...defaultSettings, ...(data.settings ?? {}) },
            lessons: data.lessons ?? {},
            songs: data.songs ?? {},
            cards: data.cards ?? {},
            days: data.days ?? {},
            drills: data.drills ?? {},
            changes: data.changes ?? {},
            recordings: data.recordings ?? {},
            tunedOn: data.tunedOn ?? null,
            sessionDoneOn: data.sessionDoneOn ?? null,
          });
          return true;
        } catch {
          return false;
        }
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
        }),
    }),
    {
      name: STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => progressStorage),
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
      }),
    },
  ),
);

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
