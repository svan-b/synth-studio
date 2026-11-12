import type { Hand, TimeSig } from '../music/theory';

export interface Piece {
  id: string;
  title: string;
  composer?: string;
  /** Curriculum stage from which the piece is offered, 1 to 6. */
  stage: number;
  key: string;
  time: TimeSig;
  /** Performance tempo in quarter notes per minute. */
  tempo: number;
  pickup?: number;
  rh?: string;
  lh?: string;
  chords?: string;
  /** Phrases as 1 based measure numbers, inclusive. Defaults to groups of four measures. */
  sections?: Array<[number, number]>;
  /** What to listen for, one or two sentences. */
  note?: string;
  /** Short piece written for the course, as opposed to repertoire. */
  study?: boolean;
}

export interface MusicInline {
  rh?: string;
  lh?: string;
  key?: string;
  time?: TimeSig;
  tempo?: number;
  pickup?: number;
  chords?: string;
}

export interface MusicRef {
  piece: string;
  /** 1 based measure range, inclusive. */
  from?: number;
  to?: number;
}

export type Music = MusicInline | MusicRef;

export type Display = 'staff' | 'contour' | 'hidden';
export type Hints = 'always' | 'delay' | 'never';

export type Figure =
  | { kind: 'keys'; low: number; high: number; marks?: Record<number, string>; labels?: 'none' | 'c' | 'all'; caption?: string }
  | { kind: 'staff'; music: MusicInline; names?: boolean; caption?: string }
  | { kind: 'hands'; caption?: string };

export type Step =
  | { kind: 'say'; title?: string; text: string; figure?: Figure; why?: string }
  | { kind: 'check'; title: string; text?: string; items: string[] }
  | { kind: 'listen'; text: string; music: Music; display?: Display; hands?: Hand[] }
  | {
      kind: 'play';
      text: string;
      music: Music;
      display?: Display;
      hints?: Hints;
      mode?: 'wait' | 'tempo';
      hands?: Hand[];
      /** Percent of the written tempo, for tempo mode. */
      tempoPct?: number;
      /** Good passes needed in a row. */
      passes?: number;
      fingering?: boolean;
      names?: boolean;
      /** Accept any key, for rhythm work. */
      anyKey?: boolean;
      why?: string;
    }
  | { kind: 'echo'; text: string; motifs: string[]; key?: string; hand?: Hand; why?: string }
  | { kind: 'find'; text: string; pitchClasses: number[]; count: number; low?: number; high?: number; labels?: 'none' | 'c' | 'all' }
  | { kind: 'quiz'; question: string; choices: string[]; answer: number; explain?: string; figure?: Figure };

export interface Lesson {
  id: string;
  stage: number;
  title: string;
  /** One line shown on the lesson list. */
  summary: string;
  minutes: number;
  steps: Step[];
  /** Review cards this lesson adds to the daily rotation. */
  cards?: string[];
  /** Piece this lesson introduces, which then joins the practice rotation. */
  piece?: string;
}

export interface Stage {
  id: number;
  title: string;
  goal: string;
  lessons: string[];
}
