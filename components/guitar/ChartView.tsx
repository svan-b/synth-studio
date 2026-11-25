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
            className={`os-measure relative flex h-[4.6rem] items-center rounded-2xl border px-3 ${m === nowMeasure ? 'is-now border-2' : 'border-os-line bg-os-surface'} ${mark ? `is-${mark}` : ''}`}
          >
            <span className="absolute left-2 top-1 text-[11px] font-semibold text-os-faint">{m + 1 + score.measureOffset}</span>
            {chords.map((c, i) => (
              <span
                key={i}
                className="absolute font-os-serif text-[1.65rem] font-semibold leading-none"
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

/** Lyrics with their chords above the syllables they fall on, one line at a time. */
export function WordsView({ lyrics, measure = null }: { lyrics: Array<[number, string]>; measure?: number | null }) {
  const lines = useMemo(() => {
    let at = 0;
    return lyrics.map(([bars, text]) => {
      const from = at;
      at += bars;
      return { from, to: at - 1, parts: parseChordPro(text) };
    });
  }, [lyrics]);
  const box = useRef<HTMLDivElement>(null);
  const nowLine = measure === null ? -1 : lines.findIndex((l) => measure >= l.from && measure <= l.to);
  useEffect(() => {
    if (nowLine < 0) return;
    box.current?.querySelector(`[data-line="${nowLine}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [nowLine]);
  return (
    <div ref={box} className="space-y-1">
      {lines.map((l, i) => (
        <div key={i} data-line={i} className={`rounded-2xl px-4 py-2 transition-colors ${i === nowLine ? 'bg-os-accent/10' : ''}`}>
          <div className="flex flex-wrap items-end">
            {l.parts.map((p, k) => (
              <span key={k} className="inline-flex flex-col">
                <span className="h-7 pr-2 font-os-serif text-[1.25rem] font-bold leading-7 text-os-accent">{p.chord ?? ''}</span>
                <span className={`whitespace-pre text-[1.35rem] leading-8 ${i === nowLine ? 'text-os-ink' : 'text-os-muted'}`}>{p.text || ' '}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
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
