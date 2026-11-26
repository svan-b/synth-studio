'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Score } from '@/lib/guitar/music/score';
import { STRING_LETTER, measureBeats, type StringNo } from '@/lib/guitar/music/theory';
import { useSize } from './hooks';

export type StepMark = 'ok' | 'warn' | 'bad';

const LINE = 26;
const PAD_Y = 30;

/**
 * Tab: six lines, the thinnest string at the top, a fret number for each
 * note. Measures run left to right and wrap into rows. The step being played
 * is ringed, each step played is coloured by how it went, and a step that has
 * been shown as a hint is lit in amber.
 */
export function TabView({
  score,
  current = null,
  marks,
  hint = null,
  compact = false,
  fingers = true,
}: {
  score: Score;
  current?: number | null;
  marks?: Map<number, StepMark>;
  hint?: number | null;
  compact?: boolean;
  fingers?: boolean;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const scroller = useRef<HTMLDivElement>(null);
  const mLen = measureBeats(score.time);
  const width = Math.max(320, size.w || 640);
  const perRow = compact ? Math.max(1, Math.min(score.measureCount, Math.floor(width / 190))) : Math.max(1, Math.min(4, Math.floor(width / 230)));
  const rows = Math.ceil(score.measureCount / perRow);
  const left = 34;
  const right = 12;
  const mW = (width - left - right) / perRow;
  const rowH = PAD_Y * 2 + LINE * 5 + 16;
  const y = (s: StringNo) => PAD_Y + (s - 1) * LINE;

  const placed = useMemo(
    () =>
      score.steps.map((st) => {
        const m = st.measure;
        const row = Math.floor(m / perRow);
        const col = m % perRow;
        const len = score.measureLengths[m] || mLen;
        const within = (st.start - score.measureStarts[m]) / len;
        const x = left + col * mW + 18 + within * (mW - 30);
        return { st, row, x };
      }),
    [left, mLen, mW, perRow, score],
  );

  // Keep the row being played in view.
  const currentRow = current !== null ? (placed[current]?.row ?? 0) : 0;
  useEffect(() => {
    const el = scroller.current;
    if (!el || current === null) return;
    const target = currentRow * rowH - rowH * 0.3;
    if (Math.abs(el.scrollTop - target) > rowH * 0.5) el.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [current, currentRow, rowH]);

  const colourOf = (i: number) => {
    const m = marks?.get(i);
    if (m === 'ok') return 'rgb(var(--os-ok))';
    if (m === 'warn') return 'rgb(var(--os-hint))';
    if (m === 'bad') return 'rgb(var(--os-bad))';
    if (hint === i) return 'rgb(var(--os-hint))';
    return 'rgb(var(--os-ink))';
  };

  return (
    <div ref={ref} className="h-full w-full">
      <div ref={scroller} className="os-scroll h-full w-full">
        <svg width={width} height={rows * rowH} role="img" aria-label="Tab">
          {Array.from({ length: rows }, (_, r) => (
            <g key={r} transform={`translate(0 ${r * rowH})`}>
              {([1, 2, 3, 4, 5, 6] as StringNo[]).map((s) => (
                <g key={s}>
                  <text x={8} y={y(s) + 5} fontSize={13} fontWeight={700} fill="rgb(var(--os-faint))">
                    {STRING_LETTER[s]}
                  </text>
                  <line x1={left} x2={width - right} y1={y(s)} y2={y(s)} stroke="rgb(var(--os-string))" strokeOpacity={0.55} strokeWidth={1 + (s - 1) * 0.25} />
                </g>
              ))}
              {Array.from({ length: perRow + 1 }, (_, c) => {
                const m = r * perRow + c;
                if (m > score.measureCount) return null;
                return <line key={c} x1={left + c * mW} x2={left + c * mW} y1={y(1)} y2={y(6)} stroke="rgb(var(--os-ink))" strokeOpacity={0.4} strokeWidth={1.5} />;
              })}
            </g>
          ))}
          {placed.map(({ st, row, x }) => {
            const oy = row * rowH;
            const isNow = current === st.index;
            const c = colourOf(st.index);
            if (st.strum) {
              const strings = st.strum.strings;
              const lo = Math.min(...strings);
              const hi = Math.max(...strings);
              return (
                <g key={st.index} transform={`translate(0 ${oy})`}>
                  {isNow && <rect x={x - 14} y={y(1) - 16} width={28} height={y(6) - y(1) + 32} rx={10} fill="rgb(var(--os-accent) / 0.14)" stroke="rgb(var(--os-accent) / 0.6)" />}
                  <line x1={x} x2={x} y1={y(lo as StringNo)} y2={y(hi as StringNo)} stroke={c} strokeWidth={3} strokeLinecap="round" />
                  <path
                    d={st.strum.dir === 'down' ? `M${x - 5} ${y(hi as StringNo) - 7} L${x} ${y(hi as StringNo)} L${x + 5} ${y(hi as StringNo) - 7}` : `M${x - 5} ${y(lo as StringNo) + 7} L${x} ${y(lo as StringNo)} L${x + 5} ${y(lo as StringNo) + 7}`}
                    fill="none"
                    stroke={c}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                  <text x={x} y={y(1) - 10} textAnchor="middle" fontSize={13} fontWeight={700} fill="rgb(var(--os-muted))">
                    {st.strum.chord}
                  </text>
                </g>
              );
            }
            return (
              <g key={st.index} transform={`translate(0 ${oy})`}>
                {isNow && <rect x={x - 15} y={y(1) - 15} width={30} height={y(6) - y(1) + 30} rx={10} fill="rgb(var(--os-accent) / 0.14)" stroke="rgb(var(--os-accent) / 0.6)" />}
                {st.notes.map((n, k) => (
                  <g key={k}>
                    <rect x={x - 11} y={y(n.place.string) - 11} width={22} height={22} rx={6} fill="rgb(var(--os-bg))" />
                    <text x={x} y={y(n.place.string) + 6} textAnchor="middle" fontSize={17} fontWeight={800} fill={c}>
                      {n.place.fret}
                    </text>
                    {fingers && n.finger !== undefined && n.finger > 0 && k === 0 && (
                      <text x={x} y={y(6) + 24} textAnchor="middle" fontSize={11} fontWeight={700} fill="rgb(var(--os-faint))">
                        {n.finger}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
