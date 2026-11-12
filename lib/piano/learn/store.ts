'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dayKey, daysBetween } from '../util/emitter';
import { newCard, review, type Outcome, type StoredCard } from './srs';
import type { PieceState } from './coach';

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
  /** Play demonstrations on the connected piano instead of the iPad. */
  demoOnPiano: boolean;
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
  /** Step to resume at. */
  step: number;
}

export interface DayLog {
  seconds: number;
  notes: number;
  activities: number;
}

export interface DrillState {
  level: number;
  /** Recent results, newest last: 1 right, 0 wrong. */
  recent: number[];
  best?: number;
}

interface State {
  profile: Profile;
  settings: Settings;
  lessons: Record<string, LessonProgress>;
  pieces: Record<string, PieceState>;
  cards: Record<string, StoredCard>;
  days: Record<string, DayLog>;
  drills: Record<string, DrillState>;
  /** Day the daily session was last finished. */
  sessionDoneOn: string | null;

  setProfile: (patch: Partial<Profile>) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setLessonStep: (id: string, step: number) => void;
  completeLesson: (id: string) => void;
  setPiece: (id: string, state: PieceState) => void;
  addCards: (ids: string[]) => void;
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
      sessionDoneOn: null,

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setLessonStep: (id, step) =>
        set((s) => ({ lessons: { ...s.lessons, [id]: { done: s.lessons[id]?.done ?? false, doneOn: s.lessons[id]?.doneOn, step } } })),
      completeLesson: (id) =>
        set((s) => ({ lessons: { ...s.lessons, [id]: { done: true, doneOn: s.lessons[id]?.doneOn ?? dayKey(), step: 0 } } })),
      setPiece: (id, state) => set((s) => ({ pieces: { ...s.pieces, [id]: state } })),
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
          return { drills: { ...s.drills, [id]: { ...prev, level: level ?? prev.level, recent } } };
        }),
      setDrillLevel: (id, level) =>
        set((s) => ({ drills: { ...s.drills, [id]: { ...(s.drills[id] ?? { recent: [] }), level, recent: [] } } })),
      finishSession: () => set({ sessionDoneOn: dayKey() }),
      importData: (json) => {
        try {
          const data = JSON.parse(json) as Partial<State>;
          if (!data || typeof data !== 'object' || !data.profile) return false;
          set({
            profile: { ...defaultProfile, ...data.profile },
            settings: { ...defaultSettings, ...(data.settings ?? {}) },
            lessons: data.lessons ?? {},
            pieces: data.pieces ?? {},
            cards: data.cards ?? {},
            days: data.days ?? {},
            drills: data.drills ?? {},
            sessionDoneOn: data.sessionDoneOn ?? null,
          });
          return true;
        } catch {
          return false;
        }
      },
      resetAll: () =>
        set({
          profile: { ...defaultProfile, startedOn: dayKey() },
          settings: get().settings,
          lessons: {},
          pieces: {},
          cards: {},
          days: {},
          drills: {},
          sessionDoneOn: null,
        }),
    }),
    {
      name: 'middle-c-v1',
      version: 1,
      partialize: (s) => ({
        profile: s.profile,
        settings: s.settings,
        lessons: s.lessons,
        pieces: s.pieces,
        cards: s.cards,
        days: s.days,
        drills: s.drills,
        sessionDoneOn: s.sessionDoneOn,
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
      exportedAt: new Date().toISOString(),
      profile: s.profile,
      settings: s.settings,
      lessons: s.lessons,
      pieces: s.pieces,
      cards: s.cards,
      days: s.days,
      drills: s.drills,
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
