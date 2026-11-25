'use client';

import { fretSpan, playedStrings, shapeFor, type Shape } from '@/lib/guitar/music/chords';
import { STRINGS, STRING_LETTER, type StringNo } from '@/lib/guitar/music/theory';
import { useGuitar } from '@/lib/guitar/learn/store';

export type StringMark = 'ok' | 'bad' | 'now' | 'muted';

/**
 * A chord picture, the way chord books draw them: the neck standing up, the
 * thick string on the left, frets across, a dot for each finger with its
 * number. Drawn the other way round for a left handed player.
 */
export function ChordDiagram({
  chord,
  variant,
  shape: given,
  width = 180,
  name = true,
  strings,
  letters = true,
  dim = false,
}: {
  chord?: string;
  variant?: string;
  shape?: Shape;
  width?: number;
  /** Show the chord's name above it. */
  name?: boolean;
  /** Marks on strings, as for a string by string check. */
  strings?: Partial<Record<StringNo, StringMark>>;
  /** String letters under the picture. */
  letters?: boolean;
  dim?: boolean;
}) {
  const leftHanded = useGuitar((s) => s.settings.leftHanded);
  const shape = given ?? shapeFor(chord as string, variant);
  const span = fretSpan(shape);
  const base = span.high <= 4 ? 1 : span.low;
  const frets = Math.max(4, span.high - base + 1);
  const W = width;
  const mx = W * 0.16;
  const top = W * (name ? 0.34 : 0.16);
  const sx = (W - 2 * mx) / 5;
  const fy = sx * 1.25;
  const gridH = fy * frets;
  const H = top + gridH + (letters ? W * 0.16 : W * 0.06);
  const order: StringNo[] = leftHanded ? STRINGS.slice().reverse() : STRINGS;
  const x = (s: StringNo) => mx + order.indexOf(s) * sx;
  const yFret = (f: number) => top + (f - base + 0.5) * fy;
  const played = new Set(playedStrings(shape));
  const r = sx * 0.38;
  const colour = (m: StringMark | undefined) =>
    m === 'ok' ? 'rgb(var(--os-ok))' : m === 'bad' ? 'rgb(var(--os-bad))' : m === 'now' ? 'rgb(var(--os-accent))' : 'rgb(var(--os-string))';

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={dim ? 'opacity-40' : undefined} role="img" aria-label={`${shape.chord} chord`}>
      {name && (
        <text x={W / 2} y={W * 0.15} textAnchor="middle" fontSize={W * 0.15} fontWeight={700} fill="rgb(var(--os-ink))" fontFamily="ui-serif, Georgia, serif">
          {shape.chord}
        </text>
      )}
      {/* Frets. The nut is the thick line at the top when the shape starts at the first fret. */}
      {Array.from({ length: frets + 1 }, (_, i) => (
        <line
          key={`f${i}`}
          x1={mx}
          x2={W - mx}
          y1={top + i * fy}
          y2={top + i * fy}
          stroke="rgb(var(--os-ink))"
          strokeOpacity={i === 0 && base === 1 ? 0.9 : 0.35}
          strokeWidth={i === 0 && base === 1 ? W * 0.03 : 1.5}
          strokeLinecap="round"
        />
      ))}
      {base > 1 && (
        <text x={mx - sx * 0.35} y={top + fy * 0.62} textAnchor="end" fontSize={W * 0.075} fill="rgb(var(--os-muted))" fontWeight={600}>
          {base}fr
        </text>
      )}
      {/* Strings, thicker toward the bass. */}
      {STRINGS.map((s) => (
        <line
          key={`s${s}`}
          x1={x(s)}
          x2={x(s)}
          y1={top}
          y2={top + gridH}
          stroke={colour(strings?.[s])}
          strokeOpacity={played.has(s) ? 1 : 0.45}
          strokeWidth={strings?.[s] && strings[s] !== 'muted' ? 4 : 1 + (s - 1) * 0.35}
        />
      ))}
      {/* Open and silent strings above the nut. */}
      {STRINGS.map((s) => {
        const f = shape.frets[STRINGS.indexOf(s)];
        const cy = top - sx * 0.55;
        const mark = strings?.[s];
        if (f === null) {
          const d = sx * 0.2;
          return (
            <g key={`m${s}`} stroke="rgb(var(--os-muted))" strokeWidth={2} strokeLinecap="round">
              <line x1={x(s) - d} x2={x(s) + d} y1={cy - d} y2={cy + d} />
              <line x1={x(s) - d} x2={x(s) + d} y1={cy + d} y2={cy - d} />
            </g>
          );
        }
        if (f === 0) {
          return (
            <circle
              key={`o${s}`}
              cx={x(s)}
              cy={cy}
              r={sx * 0.2}
              fill={mark && mark !== 'muted' ? colour(mark) : 'none'}
              stroke={mark && mark !== 'muted' ? colour(mark) : 'rgb(var(--os-ink))'}
              strokeWidth={2}
            />
          );
        }
        return null;
      })}
      {/* A barre: one finger flat across several strings. */}
      {shape.barre && (
        <rect
          x={Math.min(x(shape.barre.from), x(shape.barre.to)) - r}
          y={yFret(shape.barre.fret) - r}
          width={Math.abs(x(shape.barre.to) - x(shape.barre.from)) + 2 * r}
          height={2 * r}
          rx={r}
          fill="rgb(var(--os-ink))"
        />
      )}
      {/* Fingers. */}
      {STRINGS.map((s) => {
        const i = STRINGS.indexOf(s);
        const f = shape.frets[i];
        const finger = shape.fingers[i];
        if (f === null || f === 0) return null;
        const onBarre = shape.barre && f === shape.barre.fret && finger === shape.barre.finger;
        const mark = strings?.[s];
        const fill = mark === 'ok' ? 'rgb(var(--os-ok))' : mark === 'bad' ? 'rgb(var(--os-bad))' : mark === 'now' ? 'rgb(var(--os-accent))' : 'rgb(var(--os-ink))';
        if (onBarre && !mark) return null;
        return (
          <g key={`d${s}`}>
            <circle cx={x(s)} cy={yFret(f)} r={r} fill={fill} />
            {finger !== null && finger > 0 && (
              <text x={x(s)} y={yFret(f) + r * 0.42} textAnchor="middle" fontSize={r * 1.15} fontWeight={700} fill="rgb(var(--os-bg))">
                {finger}
              </text>
            )}
          </g>
        );
      })}
      {letters &&
        STRINGS.map((s) => (
          <text key={`l${s}`} x={x(s)} y={top + gridH + W * 0.11} textAnchor="middle" fontSize={W * 0.075} fill={strings?.[s] ? colour(strings[s]) : 'rgb(var(--os-faint))'} fontWeight={600}>
            {STRING_LETTER[s]}
          </text>
        ))}
    </svg>
  );
}
