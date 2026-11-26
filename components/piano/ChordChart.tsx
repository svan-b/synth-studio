'use client';

import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import type { Score, Step } from '@/lib/piano/music/score';
import type { NoteMark, ScoreViewHandle } from './ScoreView';
import { Icon } from './ui';

export interface ChordChartProps {
  score: Score;
  steps?: Step[];
  className?: string;
}

/**
 * Music as a chord chart: one large symbol for each measure and nothing else.
 * This is how songs are written down for anyone who plays from chords, and
 * what to play for each symbol is left to the player.
 */
const ChordChart = forwardRef<ScoreViewHandle, ChordChartProps>(function ChordChart({ score, steps, className }, ref) {
  const active = steps ?? score.steps;
  const [now, setNow] = useState<number | null>(null);
  const [marks, setMarks] = useState<Record<string, NoteMark>>({});

  const cells = useMemo(
    () =>
      Array.from({ length: score.measureCount }, (_, measure) => ({
        measure,
        symbols: score.chords.filter((c) => c.measure === measure).map((c) => c.symbol),
        notes: score.notes.filter((n) => n.measure === measure && !n.tied).map((n) => n.id),
        // Played one note at a time, as against all together.
        broken: new Set(score.notes.filter((n) => n.measure === measure && !n.tied).map((n) => n.start)).size > 1,
      })),
    [score],
  );

  useImperativeHandle(ref, () => ({
    setCursor(stepIndex) {
      setNow(stepIndex === null || stepIndex < 0 || stepIndex >= active.length ? null : active[stepIndex].measure);
    },
    mark(noteId, state) {
      setMarks((m) => {
        const next = { ...m };
        if (state) next[noteId] = state;
        else delete next[noteId];
        return next;
      });
    },
    clearMarks() {
      setMarks({});
    },
  }));

  return (
    <div className={`flex h-full w-full items-center justify-center ${className ?? ''}`} role="img" aria-label="Chord chart">
      <div className="grid w-full max-w-4xl gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(4, cells.length)}, minmax(0, 1fr))` }}>
        {cells.map((cell) => {
          const states = cell.notes.map((id) => marks[id]);
          const done = cell.notes.length > 0 && states.every((s) => s !== undefined);
          const slipped = states.some((s) => s === 'warn' || s === 'bad');
          const current = now === cell.measure && !done;
          return (
            <div
              key={cell.measure}
              className={`relative flex aspect-[4/3] flex-col items-center justify-center rounded-3xl border-2 transition-colors ${
                done
                  ? slipped
                    ? 'border-mc-hint/60 bg-mc-hint/10'
                    : 'border-mc-ok/60 bg-mc-ok/10'
                  : current
                    ? 'border-mc-ink bg-mc-surface'
                    : 'border-mc-line bg-mc-surface'
              }`}
            >
              <span className={`font-mc-serif text-[4rem] leading-none ${done ? (slipped ? 'text-mc-hint-ink' : 'text-mc-ok-ink') : current ? 'text-mc-ink' : 'text-mc-muted'}`}>
                {cell.symbols.join(' ') || ' '}
              </span>
              {/* A chord played one note at a time shows how far through it the learner is. */}
              {cell.broken && (
                <span className="mt-3 flex gap-2" aria-hidden="true">
                  {cell.notes.map((id) => (
                    <span key={id} className={`h-2.5 w-2.5 rounded-full ${marks[id] === 'ok' ? 'bg-mc-ok' : marks[id] ? 'bg-mc-hint' : 'bg-mc-line'}`} />
                  ))}
                </span>
              )}
              {done && !slipped && (
                <span className="absolute right-3 top-3 text-mc-ok-ink">
                  <Icon.Check size={22} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default ChordChart;
