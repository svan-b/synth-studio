'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Score } from '@/lib/guitar/music/score';
import { measureBeats } from '@/lib/guitar/music/theory';
import type { StepMark } from './TabView';

/** How each measure went: the worst mark of its steps, or none yet. */
export function measureMarks(score: Score, marks: Map<number, StepMark> | undefined): Map<number, StepMark> {
  const out = new Map<number, StepMark>();
  if (!marks) return out;
  const rank = { ok: 0, warn: 1, bad: 2 } as const;
  for (const st of score.steps) {
    const m = marks.get(st.index);
    if (!m) continue;
    const had = out.get(st.measure);
    if (!had || rank[m] > rank[had]) out.set(st.measure, m);
  }
  return out;
}

/**
 * A chord chart: one box per measure, four to a row, each chord written at
 * the beat it starts on. The measure being played is outlined, and each
 * measure played is tinted by how it went.
 */
export function ChartView({ score, current = null, marks, perRow = 4 }: { score: Score; current?: number | null; marks?: Map<number, StepMark>; perRow?: number }) {
  const byMeasure = useMemo(() => {
    const out: Array<Array<{ symbol: string; at: number }>> = Array.from({ length: score.measureCount }, () => []);
    for (const c of score.chords) out[c.measure]?.push({ symbol: c.symbol, at: c.start - score.measureStarts[c.measure] });
    return out;
  }, [score]);
  const mm = useMemo(() => measureMarks(score, marks), [marks, score]);
  const nowMeasure = current !== null ? (score.steps[current]?.measure ?? null) : null;
  const beats = measureBeats(score.time);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (nowMeasure === null) return;
    const el = box.current?.querySelector(`[data-measure="${nowMeasure}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [nowMeasure]);

  return (
    <div ref={box} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}>
      {byMeasure.map((chords, m) => {
        const mark = mm.get(m);
        return (
          <div
            key={m}
            data-measure={m}
            className={`os-measure relative flex h-[5.4rem] items-center rounded-2xl border px-3 ${m === nowMeasure ? 'is-now' : 'border-os-line bg-os-surface'} ${mark ? `is-${mark}` : ''}`}
          >
            <span className="absolute left-2.5 top-1 text-[13px] font-semibold text-os-muted">{m + 1 + score.measureOffset}</span>
            {mark && m !== nowMeasure && (
              <span className={`os-mark absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white ${mark === 'ok' ? 'bg-os-ok' : mark === 'warn' ? 'bg-os-hint' : 'bg-os-bad'}`} aria-hidden>
                {mark === 'ok' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : mark === 'bad' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                ) : (
                  <span className="block h-1 w-3 rounded bg-white" />
                )}
              </span>
            )}
            {chords.map((c, i) => (
              <span
                key={i}
                className="absolute font-os-serif text-[2.1rem] font-semibold leading-none"
                style={{ left: `calc(${(c.at / beats) * 88}% + 0.75rem)` }}
              >
                {c.symbol}
              </span>
            ))}
            {chords.length === 0 && <span className="text-2xl text-os-faint">%</span>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Lyrics with their chords above the syllables they fall on. The line being
 * sung is large and dark, the chord being played sits on a dark pill, and the
 * lines to come wait below in a quieter size.
 */
export function WordsView({ lyrics, measure = null, score, beat = null }: { lyrics: Array<[number, string]>; measure?: number | null; score?: Score; beat?: number | null }) {
  const lines = useMemo(() => {
    let at = 0;
    return lyrics.map(([bars, text]) => {
      const from = at;
      at += bars;
      const parts = parseChordPro(text);
      return { from, to: at - 1, parts, chars: parts.reduce((n, p) => n + p.text.length, 0) };
    });
  }, [lyrics]);
  const box = useRef<HTMLDivElement>(null);
  const nowLine = measure === null ? -1 : lines.findIndex((l) => measure >= l.from && measure <= l.to);
  useEffect(() => {
    if (nowLine < 0) return;
    box.current?.querySelector(`[data-line="${nowLine}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [nowLine]);
  // Which chord of the line is being played: the chords written in the line are those of its measures, in order.
  const live = useMemo(() => {
    if (!score || beat === null || nowLine < 0) return -1;
    const l = lines[nowLine];
    const all = score.chords.filter((c) => c.measure + score.measureOffset >= l.from && c.measure + score.measureOffset <= l.to);
    const written = l.parts.filter((p) => p.chord !== null).length;
    // The chart names a chord in every measure. The words name it once, where it changes.
    const changes = all.filter((c, i) => i === 0 || c.symbol !== all[i - 1].symbol);
    const inLine = all.length === written ? all : changes.length === written ? changes : null;
    // A line that is only partly inside the passage played, or written more loosely than the chart, shows no single chord as live.
    if (!inLine) return -1;
    let k = -1;
    inLine.forEach((c, i) => {
      if (c.start <= beat + 1e-6) k = i;
    });
    return k;
  }, [beat, lines, nowLine, score]);
  return (
    <div ref={box} className="space-y-1" style={{ containerType: 'inline-size' }}>
      {lines.map((l, i) => {
        const now = i === nowLine;
        let chordIndex = -1;
        // The line being sung is set as large as fits on one row, and wraps only if it must.
        const fit = now ? { fontSize: `clamp(1.45rem, calc((100cqw - 2.5rem) / ${Math.max(10, l.chars) * 0.5}), 1.9rem)` } : undefined;
        return (
          <div key={i} data-line={i} className={`rounded-2xl px-4 py-2 transition-colors ${now ? 'bg-os-accent/15' : ''}`}>
            <div className="flex flex-wrap items-end">
              {l.parts.map((p, k) => {
                if (p.chord !== null) chordIndex++;
                const isLive = now && p.chord !== null && chordIndex === live;
                // Word by word, so a long line wraps and is never cut off. The chord stays over the word it belongs to.
                const words = (p.text || ' ').match(/\s*\S+\s*|\s+/g) ?? [' '];
                return words.map((w, j) => (
                  <span key={`${k}-${j}`} className="inline-flex flex-col">
                    {j === 0 && p.chord !== null && (
                      <span className={`font-os-serif font-bold ${now ? 'h-10 text-[1.75rem] leading-10' : 'h-8 text-[1.4rem] leading-8'}`}>
                        <span className={`mr-2 rounded-lg px-1.5 ${isLive ? 'bg-os-ink text-os-bg' : 'text-os-accent'}`}>{p.chord}</span>
                      </span>
                    )}
                    <span className={`whitespace-pre ${now ? 'text-[1.9rem] leading-[2.6rem] text-os-ink' : 'text-[1.45rem] leading-9 text-os-muted'}`} style={fit}>
                      {w}
                    </span>
                  </span>
                ));
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** "[G]Amazing [C]grace" into pieces, each a chord and the words it sits over. */
export function parseChordPro(text: string): Array<{ chord: string | null; text: string }> {
  const out: Array<{ chord: string | null; text: string }> = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let chord: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last || chord !== null) out.push({ chord, text: text.slice(last, m.index) });
    chord = m[1];
    last = m.index + m[0].length;
  }
  out.push({ chord, text: text.slice(last) });
  return out.filter((p) => p.chord !== null || p.text.length > 0);
}
