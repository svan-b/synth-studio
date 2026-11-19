'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Score, Step } from '@/lib/piano/music/score';
import { diatonicIndex, measureBeats, pitchLabel, type Hand } from '@/lib/piano/music/theory';
import type { NoteMark, ScoreViewHandle } from './ScoreView';

export interface ContourViewProps {
  score: Score;
  steps?: Step[];
  /** What to write on each note: the letter, the letter with its finger number, or nothing. */
  label?: 'finger' | 'letter' | 'none';
  className?: string;
}

/** The most beats drawn on one line before the tune wraps to the next. */
const LINE_BEATS = 20;

/**
 * Music before the staff: each note is a bar, higher on the page for a
 * higher pitch and longer for a longer note. It shows the shape of a tune
 * without asking the learner to read notation yet.
 *
 * A long tune wraps on to further lines, as text does, so the bars stay
 * large enough to read from the piano. Each hand has its own band.
 */
const ContourView = forwardRef<ScoreViewHandle, ContourViewProps>(function ContourView({ score, steps, label = 'finger', className }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const active = steps ?? score.steps;

  const layout = useMemo(() => {
    const notes = score.notes.filter((n) => !n.tied);
    const W = 1000;
    const padX = 30;

    // Lines break at measure starts.
    const starts = score.measureStarts;
    const total = Math.max(score.totalBeats, 1);
    // Whole phrases to a line where they fit: eight measures, or four, before falling back to what there is room for.
    const mLen = measureBeats(score.time);
    const perLine =
      total <= LINE_BEATS + 1e-6
        ? starts.length
        : 8 * mLen <= LINE_BEATS
          ? 8
          : 4 * mLen <= LINE_BEATS
            ? 4
            : Math.max(1, Math.floor(LINE_BEATS / mLen));
    const lineStarts: number[] = [];
    for (let i = 0; i < starts.length; i += perLine) lineStarts.push(starts[i]);
    if (lineStarts.length === 0) lineStarts.push(0);
    const lineEnd = (li: number) => (li + 1 < lineStarts.length ? lineStarts[li + 1] : total);
    const lineOf = (beat: number) => {
      let li = 0;
      for (let i = 0; i < lineStarts.length; i++) if (lineStarts[i] <= beat + 1e-6) li = i;
      return li;
    };
    const widest = Math.max(...lineStarts.map((s, li) => lineEnd(li) - s));
    const beatW = (W - padX * 2) / widest;

    // One band a hand, the right hand above the left.
    const hands = (['R', 'L'] as Hand[]).filter((h) => notes.some((n) => n.hand === h));
    const bands = hands.map((hand) => {
      const ds = notes.filter((n) => n.hand === hand).map((n) => diatonicIndex(n.pitch));
      const lo = Math.min(...ds);
      const hi = Math.max(...ds);
      return { hand, lo, hi, rows: Math.max(hands.length > 1 ? 2 : 4, hi - lo + 1), top: 0 };
    });
    const gapRows = 0.8;
    const totalRows = bands.reduce((a, b) => a + b.rows, 0) + gapRows * (bands.length - 1);
    const rowH = Math.min(46, 330 / totalRows);
    let acc = 0;
    for (const band of bands) {
      band.top = acc;
      acc += (band.rows + gapRows) * rowH;
    }
    const lineH = totalRows * rowH + 40;
    const H = lineStarts.length * lineH + 20;

    const boxes = notes.map((n) => {
      const band = bands.find((b) => b.hand === n.hand) ?? bands[0];
      const d = diatonicIndex(n.pitch);
      const li = lineOf(n.start);
      const x = padX + (n.start - lineStarts[li]) * beatW;
      const y = 26 + li * lineH + band.top + (band.hi - d) * rowH + (band.rows - (band.hi - band.lo + 1)) * rowH * 0.5;
      const h = rowH - 6;
      // Never wider than the room before the next note on the same row, or the end of the line.
      const after = notes
        .filter((m) => m.hand === n.hand && m.start > n.start + 1e-6 && lineOf(m.start) === li && diatonicIndex(m.pitch) === d)
        .reduce((best, m) => Math.min(best, m.start), lineEnd(li));
      const room = (after - n.start) * beatW - 4;
      const w = Math.max(h * 0.7, Math.min(Math.max(h * 1.1, n.dur * beatW - 6), room));
      const finger = label === 'finger' && n.finger ? String(n.finger) : '';
      return {
        id: n.id,
        x,
        y,
        w,
        h,
        line: li,
        hand: n.hand,
        text: label === 'none' ? '' : pitchLabel(n.pitch),
        finger,
        // The finger number sits inside the bar when there is room, and just above it when there is not.
        fingerInside: finger !== '' && w >= h * 1.9,
      };
    });
    const bars: Array<{ x: number; y1: number; y2: number }> = [];
    starts.forEach((b, i) => {
      const li = lineOf(b);
      if (i === 0 || Math.abs(b - lineStarts[li]) < 1e-6) return;
      bars.push({ x: padX + (b - lineStarts[li]) * beatW - 3, y1: 16 + li * lineH, y2: 16 + li * lineH + totalRows * rowH + 14 });
    });
    return { W, H, boxes, bars, lineH, lines: lineStarts.length };
  }, [score, label]);

  useImperativeHandle(ref, () => ({
    setCursor(stepIndex) {
      const svg = svgRef.current;
      if (!svg) return;
      svg.querySelectorAll('.mc-contour-now').forEach((el) => el.classList.remove('mc-contour-now'));
      if (stepIndex === null || stepIndex < 0 || stepIndex >= active.length) return;
      let line = -1;
      for (const n of active[stepIndex].notes) {
        const el = svg.querySelector(`[data-note="${n.id}"]`);
        if (!el) continue;
        el.classList.add('mc-contour-now');
        line = Number(el.getAttribute('data-line') ?? -1);
      }
      // When the tune is taller than the stand, bring the line being played to the top, with the next below it.
      const wrap = wrapRef.current;
      if (wrap && line >= 0 && layout.lines > 1 && wrap.scrollHeight > wrap.clientHeight + 4) {
        const scale = svg.getBoundingClientRect().height / layout.H;
        const top = Math.max(0, (line * layout.lineH + 6) * scale);
        const bottom = Math.min(layout.lines, line + 2) * layout.lineH * scale;
        if (top < wrap.scrollTop || bottom > wrap.scrollTop + wrap.clientHeight) wrap.scrollTo({ top, behavior: 'smooth' });
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

  // The tune is fitted to the stand when that costs little size. A longer
  // one keeps its full width and scrolls, a line at a time.
  const [stand, setStand] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setStand({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);
  const natural = (layout.H / layout.W) * stand.w;
  const single = layout.lines === 1 || (stand.w > 0 && natural <= stand.h * 1.25);

  return (
    <div ref={wrapRef} className={`mc-scroll flex h-full w-full justify-center ${single ? 'items-center' : 'items-start'} ${className ?? ''}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.W} ${layout.H}`}
        className={`mc-contour w-full ${single ? 'max-h-full' : ''}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="The shape of the melody"
      >
        {layout.bars.map((b, i) => (
          <line key={i} x1={b.x} x2={b.x} y1={b.y1} y2={b.y2} stroke="rgb(var(--mc-line))" strokeWidth={2} />
        ))}
        {layout.boxes.map((b) => (
          <g key={b.id} data-note={b.id} data-line={b.line} className={`mc-contour-note ${b.hand === 'L' ? 'mc-contour-left' : ''}`}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.h / 2} />
            {b.finger && (
              <>
                <circle
                  className="mc-contour-finger"
                  cx={b.x + b.h / 2}
                  cy={b.fingerInside ? b.y + b.h / 2 : b.y - b.h * 0.2}
                  r={b.h * (b.fingerInside ? 0.34 : 0.3)}
                />
                <text
                  className="mc-contour-finger-text"
                  x={b.x + b.h / 2}
                  y={(b.fingerInside ? b.y + b.h / 2 : b.y - b.h * 0.2) + 0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={b.h * (b.fingerInside ? 0.44 : 0.4)}
                >
                  {b.finger}
                </text>
              </>
            )}
            {b.text && (
              <text
                x={b.fingerInside ? b.x + b.h * 1.28 : b.x + Math.min(b.w / 2, b.h / 2 + 2)}
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
