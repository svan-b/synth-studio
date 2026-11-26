import type { ScoreSource } from '../music/score';
import type { StringNo, TimeSig } from '../music/theory';

/** A song or tune in the songbook: what the practice coach teaches. */
export interface Song {
  id: string;
  title: string;
  /** Where it comes from: "Traditional, American", "Stephen Foster, 1848", "Written for the course". */
  origin: string;
  /** The stage from which it is offered, 1 to 6. */
  stage: number;
  /** Strummed chords, a melody played note by note, or a picking pattern over chords. */
  kind: 'strum' | 'melody' | 'pick';
  key: string;
  time: TimeSig;
  /** Performance tempo in quarter notes per minute. */
  tempo: number;
  chart?: string;
  strum?: string;
  pick?: string;
  line?: string;
  pickup?: number;
  /** Chord shapes to use in place of the usual ones, such as { F: 'small' }. */
  variants?: Record<string, string>;
  /**
   * Words with chords, a line at a time, as [bars the line covers, text], each
   * chord in brackets before the syllable it falls on: "A[A]mazing grace". A
   * line that begins on the chord still sounding from the line before needs no
   * bracket at its start. Shown to sing along to, and checked against the
   * chart so the chords agree.
   */
  lyrics?: Array<[number, string]>;
  /** The tune, for the app to play over the chords when you listen. Never asked of the learner in a strummed song. */
  melody?: string;
  /** Phrases as 1 based measure numbers, inclusive. Defaults to groups of four. */
  sections?: Array<[number, number]>;
  /** What to listen for, one or two sentences. */
  note?: string;
  /** Written for the course, as against a song that already existed. */
  study?: boolean;
  /** Capo fret that puts it in an easier singing key, when there is one. */
  capo?: number;
}

/** Things a lesson can show: a chord, the neck with marks, a strum pattern, a line of tab, or the guitar itself. */
export type Figure =
  | { kind: 'chord'; chord: string; variant?: string; caption?: string; strings?: Partial<Record<StringNo, 'ok' | 'bad' | 'now'>> }
  | { kind: 'chords'; chords: string[]; caption?: string }
  | { kind: 'neck'; marks: Array<{ string: StringNo; fret: number; label?: string }>; frets?: number; caption?: string }
  | { kind: 'strings'; highlight?: StringNo[]; caption?: string }
  | { kind: 'pattern'; pattern: string; time?: TimeSig; caption?: string }
  | { kind: 'tab'; music: ScoreSource; caption?: string }
  | { kind: 'guitar'; caption?: string }
  | { kind: 'hand'; caption?: string };

/** How music is shown while it is played. */
export type Display = 'chord' | 'chart' | 'tab' | 'hidden';
export type Hints = 'always' | 'delay' | 'never';

export type Step =
  | { kind: 'say'; title?: string; text: string; figure?: Figure; why?: string }
  | { kind: 'check'; title: string; text?: string; items: string[] }
  /** Tune the guitar, with the tuner on screen. */
  | { kind: 'tune'; text: string }
  | { kind: 'listen'; text: string; music: Music; display?: Display }
  | {
      kind: 'play';
      text: string;
      music: Music;
      display?: Display;
      hints?: Hints;
      mode?: 'wait' | 'tempo';
      /** Percent of the written tempo, with a beat. */
      tempoPct?: number;
      /** Good runs needed in a row. */
      passes?: number;
      /** Any strum will do: only the timing is judged. */
      anyStrike?: boolean;
      /** One strum for each new chord, when the music waits. Default for strummed music. */
      changesOnly?: boolean;
      why?: string;
    }
  /** Pick each string of a chord, one at a time, and hear which ones ring. */
  | { kind: 'strings'; text: string; chord: string; variant?: string; why?: string }
  /** Play the strings asked for, by name. */
  | { kind: 'find'; text: string; strings: StringNo[]; why?: string }
  /** Hear a short pattern, then play it back. */
  | { kind: 'echo'; text: string; motifs: string[]; why?: string }
  /** Change between two chords a set number of times, in your own time, and see how quick the changes are. */
  | { kind: 'changes'; text: string; from: string; to: string; times: number; why?: string }
  | { kind: 'quiz'; question: string; choices: string[]; answer: number; explain?: string; figure?: Figure; hear?: Music };

export interface MusicRef {
  song: string;
  /** 1 based measure range, inclusive. */
  from?: number;
  to?: number;
}

export type Music = ScoreSource | MusicRef;

export interface Lesson {
  id: string;
  stage: number;
  title: string;
  /** One line for the lesson list. */
  summary: string;
  minutes: number;
  steps: Step[];
  /** Chords this lesson teaches, which then join the chord review. */
  chords?: string[];
  /** Songs this lesson brings, which then join the practice. */
  songs?: string[];
}

export interface Stage {
  id: number;
  title: string;
  goal: string;
  lessons: string[];
}
