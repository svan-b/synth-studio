/** Lookups over the course, with scores parsed once and kept. */

import { defaultSections, type SongInfo } from '../learn/coach';
import { parseScore, sliceScore, chordsUsed, type Score, type ScoreSource } from '../music/score';
import { measureBeats, type TimeSig } from '../music/theory';
import { LESSONS, STAGES } from './lessons';
import { SONGS } from './songs';
import type { Lesson, Music, MusicRef, Song, Stage } from './types';

const songById = new Map(SONGS.map((s) => [s.id, s]));
const lessonById = new Map(LESSONS.map((l) => [l.id, l]));
const scoreCache = new Map<string, Score>();

export function getSong(id: string): Song {
  const s = songById.get(id);
  if (!s) throw new Error(`Unknown song: ${id}`);
  return s;
}

export function hasSong(id: string): boolean {
  return songById.has(id);
}

export function getLesson(id: string): Lesson {
  const l = lessonById.get(id);
  if (!l) throw new Error(`Unknown lesson: ${id}`);
  return l;
}

export function allSongs(): Song[] {
  return SONGS;
}

export function allLessons(): Lesson[] {
  return LESSONS;
}

export function allStages(): Stage[] {
  return STAGES;
}

/** One down strum on each counted beat: the first way any song is strummed. */
export function simpleStrum(time: TimeSig): string {
  const slots = Math.round(measureBeats(time) * 2);
  if (time[1] === 8 && time[0] % 3 === 0) return Array.from({ length: slots }, (_, i) => (i % 3 === 0 ? 'D' : '.')).join('');
  return Array.from({ length: slots }, (_, i) => (i % 2 === 0 ? 'D' : '.')).join('');
}

function songSource(song: Song, simple: boolean): ScoreSource {
  return {
    time: song.time,
    tempo: song.tempo,
    pickup: song.pickup,
    line: song.line,
    chart: song.chart,
    strum: simple && song.kind === 'strum' ? simpleStrum(song.time) : song.strum,
    pick: song.pick,
    variants: song.variants,
  };
}

/** A song as playable music. `simple` strums it once a beat. */
export function songScore(id: string, opts: { simple?: boolean } = {}): Score {
  const key = `${id}:${opts.simple ? 'simple' : 'song'}`;
  let s = scoreCache.get(key);
  if (!s) {
    s = parseScore(songSource(getSong(id), opts.simple === true));
    scoreCache.set(key, s);
  }
  return s;
}

export function songInfo(id: string): SongInfo {
  const song = getSong(id);
  const score = songScore(id);
  const sections: Array<[number, number]> = song.sections ? song.sections.map(([a, b]) => [a - 1, b - 1]) : defaultSections(score.measureCount, score.pickup > 0);
  return { id, title: song.title, kind: song.kind, sections, measures: score.measureCount };
}

/** The chords a song uses, in the order they first come. */
export function songChords(id: string): string[] {
  return chordsUsed(songScore(id));
}

function isRef(m: Music): m is MusicRef {
  return (m as MusicRef).song !== undefined;
}

/** A lesson's music, written inline or taken from a song. */
export function resolveMusic(m: Music): Score {
  if (isRef(m)) {
    const score = songScore(m.song);
    if (m.from === undefined && m.to === undefined) return score;
    return sliceScore(score, (m.from ?? 1) - 1, (m.to ?? score.measureCount) - 1);
  }
  const key = JSON.stringify(m);
  let s = scoreCache.get(key);
  if (!s) {
    s = parseScore(m);
    scoreCache.set(key, s);
  }
  return s;
}

/** Back and forth between two chords, one strum each, as many changes as asked. */
export function changeScore(from: string, to: string, changes: number, tempo = 60): Score {
  const chords = Array.from({ length: changes + 1 }, (_, i) => (i % 2 === 0 ? from : to));
  return parseScore({ line: chords.map((c) => `[${c}]w`).join(' | '), tempo, time: [4, 4] });
}

/** Lessons in course order. */
export function lessonOrder(): string[] {
  return STAGES.flatMap((s) => s.lessons);
}

export function nextLesson(done: (id: string) => boolean): Lesson | null {
  for (const id of lessonOrder()) if (!done(id)) return getLesson(id);
  return null;
}

/** A lesson opens once the one before it is done. */
export function lessonUnlocked(id: string, done: (id: string) => boolean): boolean {
  const order = lessonOrder();
  const i = order.indexOf(id);
  return i <= 0 || done(order[i - 1]);
}

export function currentStage(done: (id: string) => boolean): number {
  const next = nextLesson(done);
  return next ? next.stage : STAGES[STAGES.length - 1].id;
}

/** Chords the finished lessons have taught, in the order they were taught. */
export function chordsKnown(done: (id: string) => boolean): string[] {
  const out: string[] = [];
  for (const id of lessonOrder()) {
    if (!done(id)) continue;
    for (const c of getLesson(id).chords ?? []) if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** Songs whose every chord the learner knows: ones they could play today. */
export function playableSongs(known: string[]): Song[] {
  return SONGS.filter((s) => s.kind === 'strum' && songChords(s.id).every((c) => known.includes(c)));
}

/** The lesson that brings a song, if one does. */
export function lessonForSong(id: string): Lesson | null {
  return LESSONS.find((l) => l.songs?.includes(id)) ?? null;
}
