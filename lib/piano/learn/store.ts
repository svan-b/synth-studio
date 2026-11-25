'use client';

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { saveCopy, savedCopy } from '../native/bridge';
import { dayKey, daysBetween } from '../util/emitter';
import { newCard, review, type Outcome, type StoredCard } from './srs';
import type { PieceState } from './coach';
import type { Take } from '../engine/flow';

export type Experience = 'new' | 'some' | 'returning';
export type ThemeChoice = 'auto' | 'light' | 'dark';

export interface Profile {
  onboarded: boolean;
  experience: Experience;
  /** Target length of a daily session in minutes. */
  minutes: number;
  startedOn: string;
}

export interface Settings {
  theme: ThemeChoice;
  /** Play demonstrations on the connected piano instead of the iPad. Read only once the learner has chosen. */
  demoOnPiano: boolean;
  /** The learner has said where demonstrations should sound. Until then they go to the piano when it can play them. */
  demoChosen?: boolean;
  /** How firmly the learner tends to play, 0 to 1, so that the app can play as loudly on their piano. */
  touchLevel?: number;
  remoteKeys: boolean;
  remotePedals: boolean;
  metronome: boolean;
  pianoVolume: number;
  clickVolume: number;
  /** Extra input delay found by calibration, in milliseconds. */
  latencyMs: number;
  /** Show letter names under the notes while reading is new. */
  noteNames: boolean;
  /** Reconnect to MIDI on launch without asking again. Set once a piano has been connected by hand. */
  autoMidi: boolean;
}

export interface LessonProgress {
  done: boolean;
  doneOn?: string;
  /** Marked as known without being taken. */
  skipped?: boolean;
  /** Step to resume at: the furthest one reached. */
  step: number;
}

export interface DayLog {
  seconds: number;
  notes: number;
  activities: number;
}

/** The learner's own playing of a piece, kept to be heard again. */
export interface Recording {
  /** The day it was played. */
  on: string;
  take: Take;
}

/** The first time a piece was played through as learned, and the most recent time since. */
export interface PieceRecordings {
  first: Recording;
  latest?: Recording;
}

export interface DrillState {
  level: number;
  /** Recent results, newest last: 1 right, 0 wrong. */
  recent: number[];
  best?: number;
  /** The day it was last practised. */
  lastOn?: string;
}

/** A part of a session, as the planner lays it out. Kept as plain data. */
/**
 * The version of the course that progress is kept against. It goes up when
 * lessons are split or moved, so that progress from before can be carried over.
 */
export const COURSE = 2;

/**
 * Bring lesson progress from an earlier course up to this one. The lesson on
 * arpeggios became two, one hand and then both. Whoever finished it as it was
 * has had both.
 */
export function carryOver(lessons: Record<string, LessonProgress>): Record<string, LessonProgress> {
  const out = { ...lessons };
  if (out['arpeggios']?.done && !out['arpeggios-two-hands']) out['arpeggios-two-hands'] = { ...out['arpeggios'] };
  return out;
}

export interface SessionPart {
  kind: 'lesson' | 'piece' | 'drill';
  id: string;
  minutes: number;
  title: string;
  detail: string;
}

export interface SavedSession {
  /** The day it was begun. A session from an earlier day is not picked up. */
  on: string;
  blocks: SessionPart[];
  /** The part that comes next. */
  index: number;
  /** Parts that were passed over, by their place in the list. They are behind, and they are not done. */
  skipped?: number[];
  /** How the session's lessons and pieces stood when it began, so its closing account covers all of it. */
  base?: SessionBase;
}

export interface SessionBase {
  lessons: Record<string, boolean>;
  pieces: Record<string, PieceState | null>;
}

interface State {
  profile: Profile;
  settings: Settings;
  lessons: Record<string, LessonProgress>;
  pieces: Record<string, PieceState>;
  cards: Record<string, StoredCard>;
  days: Record<string, DayLog>;
  drills: Record<string, DrillState>;
  recordings: Record<string, PieceRecordings>;
  /** Day the daily session was last finished. */
  sessionDoneOn: string | null;
  /**
   * The day's session while it is under way: its parts and which comes next.
   * Kept so that a session left part way, or cut off by the app closing, is
   * picked up where it stopped.
   */
  session: SavedSession | null;

  setProfile: (patch: Partial<Profile>) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setLessonStep: (id: string, step: number) => void;
  completeLesson: (id: string) => void;
  /** Mark a lesson as known without taking it. */
  skipLesson: (id: string) => void;
  /** Take back a mark of "known", so the lesson is to be taken after all. */
  unskipLesson: (id: string) => void;
  keepSession: (session: SavedSession | null) => void;
  setPiece: (id: string, state: PieceState) => void;
  /** Keep a take of a learned piece. The first is kept for good, later ones replace each other. */
  keepRecording: (id: string, take: Take) => void;
  addCards: (ids: string[]) => void;
  /** Take review cards out again, where they have never been reviewed. */
  dropCards: (ids: string[]) => void;
  reviewCard: (id: string, outcome: Outcome) => void;
  logPractice: (seconds: number, notes: number, activities?: number) => void;
  recordDrill: (id: string, correct: boolean, level?: number) => void;
  setDrillLevel: (id: string, level: number) => void;
  finishSession: () => void;
  importData: (json: string) => boolean;
  resetAll: () => void;
}

const defaultProfile: Profile = { onboarded: false, experience: 'new', minutes: 20, startedOn: dayKey() };

const defaultSettings: Settings = {
  theme: 'auto',
  demoOnPiano: false,
  remoteKeys: true,
  remotePedals: true,
  metronome: true,
  pianoVolume: 0.9,
  clickVolume: 0.6,
  latencyMs: 0,
  noteNames: false,
  autoMidi: false,
};

/**
 * Where progress is kept. In a browser that is the browser's own storage.
 * Inside the iPad app it is also written to a file the app owns, so progress
 * survives the web view's storage being cleared. Each copy carries the time
 * it was written, and the newer one is read back.
 */
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
      /* storage full or switched off: the app's own file still has it */
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

export const usePiano = create<State>()(
  persist(
    (set, get) => ({
      profile: defaultProfile,
      settings: defaultSettings,
      lessons: {},
      pieces: {},
      cards: {},
      days: {},
      drills: {},
      recordings: {},
      sessionDoneOn: null,
      session: null,

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setLessonStep: (id, step) =>
        set((s) => {
          const had = s.lessons[id];
          // A lesson already done, or marked as known, can be looked through again without changing that.
          if (had?.done) return {};
          // The place kept is the furthest step reached, so turning back to look at something does not lose it.
          return { lessons: { ...s.lessons, [id]: { done: false, step: Math.max(had?.step ?? 0, step) } } };
        }),
      completeLesson: (id) =>
        set((s) => ({ lessons: { ...s.lessons, [id]: { done: true, doneOn: s.lessons[id]?.doneOn ?? dayKey(), step: 0 } } })),
      skipLesson: (id) =>
        set((s) => (s.lessons[id]?.done ? {} : { lessons: { ...s.lessons, [id]: { done: true, skipped: true, step: 0 } } })),
      setPiece: (id, state) => set((s) => ({ pieces: { ...s.pieces, [id]: state } })),
      keepRecording: (id, take) =>
        set((s) => {
          const made: Recording = { on: dayKey(), take };
          const had = s.recordings[id];
          return { recordings: { ...s.recordings, [id]: had ? { first: had.first, latest: made } : { first: made } } };
        }),
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
      dropCards: (ids) =>
        set((s) => {
          const cards = { ...s.cards };
          let changed = false;
          for (const id of ids) {
            if (cards[id] && cards[id].reps === 0) {
              delete cards[id];
              changed = true;
            }
          }
          return changed ? { cards } : {};
        }),
      reviewCard: (id, outcome) => set((s) => ({ cards: { ...s.cards, [id]: review(s.cards[id], outcome) } })),
      logPractice: (seconds, notes, activities = 0) =>
        set((s) => {
          const day = dayKey();
          const prev = s.days[day] ?? { seconds: 0, notes: 0, activities: 0 };
          return {
            days: {
              ...s.days,
              [day]: { seconds: prev.seconds + Math.max(0, seconds), notes: prev.notes + notes, activities: prev.activities + activities },
            },
          };
        }),
      recordDrill: (id, correct, level) =>
        set((s) => {
          const prev = s.drills[id] ?? { level: 1, recent: [] };
          const recent = [...prev.recent, correct ? 1 : 0].slice(-20);
          return { drills: { ...s.drills, [id]: { ...prev, level: level ?? prev.level, recent, lastOn: dayKey() } } };
        }),
      setDrillLevel: (id, level) =>
        set((s) => ({ drills: { ...s.drills, [id]: { ...(s.drills[id] ?? { recent: [] }), level, recent: [] } } })),
      finishSession: () => set({ sessionDoneOn: dayKey(), session: null }),
      keepSession: (session) => set({ session }),
      unskipLesson: (id) =>
        set((s) => {
          if (!s.lessons[id]?.skipped) return {};
          const lessons = { ...s.lessons };
          delete lessons[id];
          return { lessons };
        }),
      importData: (json) => {
        try {
          const parsed = JSON.parse(json) as Partial<State> & { state?: Partial<State> };
          // The daily copies the iPad app keeps hold the same things one level down.
          const data: Partial<State> = parsed?.state?.profile ? parsed.state : parsed;
          if (!data || typeof data !== 'object' || !data.profile) return false;
          // A copy made before the course changed is brought up to the course as it is now.
          const made = (parsed as { course?: number; version?: number }).course ?? (parsed as { version?: number }).version ?? 0;
          if (made < COURSE) data.lessons = carryOver(data.lessons ?? {});
          set({
            profile: { ...defaultProfile, ...data.profile },
            settings: { ...defaultSettings, ...(data.settings ?? {}) },
            lessons: data.lessons ?? {},
            pieces: data.pieces ?? {},
            cards: data.cards ?? {},
            days: data.days ?? {},
            drills: data.drills ?? {},
            recordings: data.recordings ?? {},
            sessionDoneOn: data.sessionDoneOn ?? null,
            session: null,
          });
          return true;
        } catch {
          return false;
        }
      },
      resetAll: () =>
        set({
          // What the learner told the app about themselves is kept, with their settings.
          profile: { ...get().profile, startedOn: dayKey() },
          settings: get().settings,
          lessons: {},
          pieces: {},
          cards: {},
          days: {},
          drills: {},
          recordings: {},
          sessionDoneOn: null,
          session: null,
        }),
    }),
    {
      name: 'middle-c-v1',
      version: COURSE,
      // Without this, progress kept by an earlier version would be thrown away.
      migrate: (kept, version) => {
        const state = (kept ?? {}) as Partial<State>;
        if (version < COURSE && state.lessons) state.lessons = carryOver(state.lessons);
        // A session saved against the old list of lessons is not picked up.
        if (version < COURSE) state.session = null;
        return state as State;
      },
      storage: createJSONStorage(() => progressStorage),
      partialize: (s) => ({
        profile: s.profile,
        settings: s.settings,
        lessons: s.lessons,
        pieces: s.pieces,
        cards: s.cards,
        days: s.days,
        drills: s.drills,
        recordings: s.recordings,
        sessionDoneOn: s.sessionDoneOn,
        session: s.session,
      }),
    },
  ),
);

/** Everything worth backing up, as text. */
export function exportData(): string {
  const s = usePiano.getState();
  return JSON.stringify(
    {
      app: 'middle-c',
      course: COURSE,
      exportedAt: new Date().toISOString(),
      profile: s.profile,
      settings: s.settings,
      lessons: s.lessons,
      pieces: s.pieces,
      cards: s.cards,
      days: s.days,
      drills: s.drills,
      recordings: s.recordings,
      sessionDoneOn: s.sessionDoneOn,
    },
    null,
    2,
  );
}

/** Days in a row with practice, counting today or yesterday as the latest. */
export function streak(days: Record<string, DayLog>, today: string = dayKey()): number {
  const practised = (d: string) => (days[d]?.seconds ?? 0) >= 60;
  let cursor = new Date(today + 'T12:00:00');
  if (!practised(today)) cursor = new Date(cursor.getTime() - 86400000);
  let count = 0;
  for (;;) {
    const key = dayKey(cursor);
    if (!practised(key)) break;
    count++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return count;
}

export function totalMinutes(days: Record<string, DayLog>): number {
  return Math.round(Object.values(days).reduce((a, d) => a + d.seconds, 0) / 60);
}

export function daysSince(day: string | undefined, today: string = dayKey()): number {
  return day ? daysBetween(day, today) : Infinity;
}
