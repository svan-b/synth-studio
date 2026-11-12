'use client';

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type { Score, Step } from '@/lib/piano/music/score';
import { diatonicIndex, pitchLabel } from '@/lib/piano/music/theory';
import type { NoteMark, ScoreViewHandle } from './ScoreView';

export interface ContourViewProps {
  score: Score;
  steps?: Step[];
  /** What to write on each note: the letter, the letter with its finger number, or nothing. */
  label?: 'finger' | 'letter' | 'none';
  className?: string;
}

/**
 * Music before the staff: each note is a bar, higher on the page for a
 * higher pitch and longer for a longer note. It shows the shape of a tune
 * without asking the learner to read notation yet.
 */
const ContourView = forwardRef<ScoreViewHandle, ContourViewProps>(function ContourView({ score, steps, label = 'finger', className }, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  const active = steps ?? score.steps;

  const layout = useMemo(() => {
    const notes = score.notes.filter((n) => !n.tied);
    const ds = notes.map((n) => diatonicIndex(n.pitch));
    const lo = Math.min(...ds);
    const hi = Math.max(...ds);
    const rows = Math.max(4, hi - lo + 1);
    const W = 1000;
    const padX = 30;
    const rowH = Math.min(46, 300 / rows);
    const H = rows * rowH + 60;
    const beatW = (W - padX * 2) / Math.max(1, score.totalBeats);
    const boxes = notes.map((n) => {
      const d = diatonicIndex(n.pitch);
      const w = Math.max(rowH * (label === 'finger' && n.finger ? 1.9 : 1.1), n.dur * beatW - 6);
      return {
        id: n.id,
        x: padX + n.start * beatW,
        y: 30 + (hi - d) * rowH + (rows - (hi - lo + 1)) * rowH * 0.5,
        w,
        h: rowH - 6,
        hand: n.hand,
        text: label === 'none' ? '' : pitchLabel(n.pitch),
        finger: label === 'finger' && n.finger ? String(n.finger) : '',
      };
    });
    const bars = score.measureStarts.slice(1).map((b) => padX + b * beatW - 3);
    return { W, H, boxes, bars, rowH };
  }, [score, label]);

  useImperativeHandle(ref, () => ({
    setCursor(stepIndex) {
      const svg = svgRef.current;
      if (!svg) return;
      svg.querySelectorAll('.mc-contour-now').forEach((el) => el.classList.remove('mc-contour-now'));
      if (stepIndex === null || stepIndex < 0 || stepIndex >= active.length) return;
      for (const n of active[stepIndex].notes) {
        svg.querySelector(`[data-note="${n.id}"]`)?.classList.add('mc-contour-now');
      }
    },
    mark(noteId: string, state: NoteMark | null) {
      const el = svgRef.current?.querySelector(`[data-note="${noteId}"]`);
      if (!el) return;
      el.classList.remove('mc-contour-ok', 'mc-contour-warn', 'mc-contour-bad');
      if (state) el.classList.add(`mc-contour-${state}`);
    },
    clearMarks() {
      svgRef.current
        ?.querySelectorAll('.mc-contour-ok, .mc-contour-warn, .mc-contour-bad')
        .forEach((el) => el.classList.remove('mc-contour-ok', 'mc-contour-warn', 'mc-contour-bad'));
    },
  }));

  return (
    <div className={`flex h-full w-full items-center justify-center ${className ?? ''}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.W} ${layout.H}`}
        className="mc-contour max-h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="The shape of the melody"
      >
        {layout.bars.map((x, i) => (
          <line key={i} x1={x} x2={x} y1={18} y2={layout.H - 18} stroke="rgb(var(--mc-line))" strokeWidth={2} />
        ))}
        {layout.boxes.map((b) => (
          <g key={b.id} data-note={b.id} className={`mc-contour-note ${b.hand === 'L' ? 'mc-contour-left' : ''}`}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.h / 2} />
            {b.finger && (
              <>
                <circle className="mc-contour-finger" cx={b.x + b.h / 2} cy={b.y + b.h / 2} r={b.h * 0.34} />
                <text className="mc-contour-finger-text" x={b.x + b.h / 2} y={b.y + b.h / 2 + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={b.h * 0.44}>
                  {b.finger}
                </text>
              </>
            )}
            {b.text && (
              <text
                x={b.finger ? b.x + b.h * 1.28 : b.x + Math.min(b.w / 2, b.h / 2 + 2)}
                y={b.y + b.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={b.h * 0.56}
              >
                {b.text}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
});

export default ContourView;
