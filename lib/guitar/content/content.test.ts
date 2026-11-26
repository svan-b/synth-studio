import { describe, expect, it } from 'vitest';
import { hasShape } from '../music/chords';
import { parseChart, parseScore } from '../music/score';
import { allLessons, allSongs, allStages, chordsKnown, getLesson, getSong, lessonOrder, resolveMusic, songChords, songInfo, songScore } from './catalog';
import { NOT_USED, PRINCIPLES, TIPS } from './method';
import type { Music, Step } from './types';

const order = lessonOrder();
const lessonIndex = (id: string) => order.indexOf(id);
/** Chords known once a lesson is done. */
const knownAfter = (id: string) => chordsKnown((l) => lessonIndex(l) <= lessonIndex(id));

function chordsOfMusic(m: Music): string[] {
  const s = resolveMusic(m);
  const out = new Set<string>();
  for (const e of s.events) {
    if (e.kind === 'strum') out.add(e.chord);
    if (e.kind === 'note' && e.chord) out.add(e.chord);
  }
  return Array.from(out);
}

describe('the songbook', () => {
  it('parses every song, with sensible tempos and phrases', () => {
    for (const song of allSongs()) {
      const score = songScore(song.id);
      expect(score.measureCount, song.id).toBeGreaterThan(0);
      expect(song.tempo, song.id).toBeGreaterThanOrEqual(50);
      expect(song.tempo, song.id).toBeLessThanOrEqual(130);
      const info = songInfo(song.id);
      for (const [a, b] of info.sections) {
        expect(a, song.id).toBeGreaterThanOrEqual(0);
        expect(b, song.id).toBeLessThan(score.measureCount);
        expect(a <= b, song.id).toBe(true);
      }
      // Phrases cover the song once, in order.
      expect(info.sections[0][0]).toBe(0);
      expect(info.sections[info.sections.length - 1][1]).toBe(score.measureCount - 1);
      for (let i = 1; i < info.sections.length; i++) expect(info.sections[i][0]).toBe(info.sections[i - 1][1] + 1);
    }
  });

  it('has ids that are unique', () => {
    const ids = allSongs().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives strummed songs a chart, and tunes a line', () => {
    for (const s of allSongs()) {
      if (s.kind === 'melody') expect(s.line, s.id).toBeTruthy();
      else expect(s.chart, s.id).toBeTruthy();
      if (s.kind === 'pick') expect(s.pick, s.id).toBeTruthy();
    }
  });

  it('keeps every melody the learner plays in the first position, with each finger on its own fret', () => {
    for (const s of allSongs().filter((x) => x.kind === 'melody')) {
      for (const e of songScore(s.id).events) {
        if (e.kind !== 'note') continue;
        expect(e.place.fret, `${s.id} note ${e.midi}`).toBeLessThanOrEqual(4);
        if (e.finger !== undefined && e.place.fret > 0) expect(e.finger, `${s.id} note ${e.midi}`).toBe(e.place.fret);
        if (e.place.fret === 0) expect(e.finger ?? 0, `${s.id} open note ${e.midi}`).toBe(0);
      }
    }
  });

  it('lines a demo melody up with the chart, bar for bar', () => {
    for (const s of allSongs().filter((x) => x.melody)) {
      const tune = parseScore({ line: s.melody, time: s.time, pickup: s.pickup });
      const chart = songScore(s.id);
      const bars = tune.measureCount - (s.pickup ? 1 : 0);
      expect(bars, s.id).toBe(chart.measureCount);
    }
  });

  it('has lyrics that agree with the chart, line by line', () => {
    for (const s of allSongs().filter((x) => x.lyrics)) {
      const bars = parseChart(s.chart!, s.time);
      const total = s.lyrics!.reduce((a, [n]) => a + n, 0);
      expect(total, `${s.id} lyric bars`).toBe(bars.length);
      let at = 0;
      for (const [n, text] of s.lyrics!) {
        const inChart: string[] = [];
        for (const bar of bars.slice(at, at + n)) for (const c of bar) if (inChart[inChart.length - 1] !== c.symbol) inChart.push(c.symbol);
        const marked = Array.from(text.matchAll(/\[([^\]]+)\]/g)).map((m) => m[1]);
        for (const c of marked) expect(hasShape(c), `${s.id}: ${c}`).toBe(true);
        // The marks are the chart's chords for these bars, perhaps without the one carried over from the line before.
        const tail = inChart.slice(inChart.length - marked.length);
        expect(marked, `${s.id}: "${text}"`).toEqual(tail);
        expect(inChart.length - marked.length, `${s.id}: "${text}"`).toBeLessThanOrEqual(1);
        at += n;
      }
    }
  });
});

describe('the course', () => {
  it('has unique lessons, each in a stage', () => {
    const ids = allLessons().map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(order).toHaveLength(ids.length);
    for (const st of allStages()) expect(st.lessons.length, `stage ${st.id}`).toBeGreaterThan(0);
  });

  it('brings each song in from one lesson of its own stage', () => {
    const seen = new Map<string, string>();
    for (const l of allLessons()) {
      for (const id of l.songs ?? []) {
        expect(seen.has(id), `${id} brought twice`).toBe(false);
        seen.set(id, l.id);
        expect(getSong(id).stage, id).toBe(l.stage);
      }
    }
    for (const s of allSongs()) expect(seen.has(s.id), `${s.id} is never brought in`).toBe(true);
  });

  it('never asks for a chord before it is taught', () => {
    for (const l of allLessons()) {
      const known = knownAfter(l.id);
      for (const id of l.songs ?? []) for (const c of songChords(id)) expect(known, `${l.id} brings ${id}, which needs ${c}`).toContain(c);
      for (const step of l.steps) {
        const need: string[] = [];
        if (step.kind === 'strings') need.push(step.chord);
        if (step.kind === 'changes') need.push(step.from, step.to);
        if (step.kind === 'play') need.push(...chordsOfMusic(step.music));
        for (const c of need) expect(known, `${l.id}, ${step.kind} step, needs ${c}`).toContain(c);
      }
    }
  });

  it('builds every piece of music a lesson plays', () => {
    for (const l of allLessons()) {
      for (const step of l.steps as Step[]) {
        if (step.kind === 'listen' || step.kind === 'play') expect(() => resolveMusic(step.music), `${l.id}`).not.toThrow();
        if (step.kind === 'quiz' && step.hear) expect(() => resolveMusic(step.hear!)).not.toThrow();
        if (step.kind === 'echo') for (const m of step.motifs) expect(() => parseScore({ line: m }), `${l.id}`).not.toThrow();
        if (step.kind === 'quiz') expect(step.answer).toBeLessThan(step.choices.length);
      }
    }
  });

  it('opens with a lesson that needs nothing, and a first chord on the first day', () => {
    expect(order[0]).toBe('meet-guitar');
    expect(getLesson(order[1]).chords).toContain('Em');
  });
});

describe('the words', () => {
  it('uses no long dashes anywhere a learner reads', () => {
    const texts: string[] = [];
    for (const l of allLessons()) {
      texts.push(l.title, l.summary);
      for (const s of l.steps) texts.push(JSON.stringify(s));
    }
    for (const s of allSongs()) texts.push(s.title, s.origin, s.note ?? '', ...(s.lyrics ?? []).map(([, t]) => t));
    for (const p of PRINCIPLES) texts.push(p.title, p.what, p.evidence);
    for (const n of NOT_USED) texts.push(n.title, n.why);
    texts.push(...TIPS);
    for (const t of texts) {
      expect(t.includes('—'), t.slice(0, 60)).toBe(false);
      expect(t.includes(' -- '), t.slice(0, 60)).toBe(false);
    }
  });
});
