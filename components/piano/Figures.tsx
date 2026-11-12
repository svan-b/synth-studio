'use client';

import { useMemo } from 'react';
import { resolveMusic } from '@/lib/piano/content/catalog';
import type { Figure } from '@/lib/piano/content/types';
import { useInputMode } from './hooks';
import { Keyboard, type KeyMark } from './Keyboard';
import ScoreView from './ScoreView';

function HandsFigure() {
  // One hand, palm down, seen from above. Mirrored for the other.
  const fingers = [
    { n: 1, x: 62, y: 116, len: 60, w: 27, rot: -48 },
    { n: 2, x: 96, y: 40, len: 96, w: 24, rot: -6 },
    { n: 3, x: 126, y: 24, len: 108, w: 25, rot: 0 },
    { n: 4, x: 156, y: 36, len: 98, w: 24, rot: 5 },
    { n: 5, x: 184, y: 64, len: 76, w: 22, rot: 12 },
  ];
  const hand = (mirror: boolean, label: string) => (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 224 232" className="h-52 w-auto" style={mirror ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
        <rect x="76" y="118" width="124" height="96" rx="38" fill="rgb(var(--mc-raised))" stroke="rgb(var(--mc-ink) / 0.35)" strokeWidth="2" />
        {fingers.map((f) => (
          <g key={f.n} transform={`rotate(${f.rot} ${f.x} ${f.y + f.len})`}>
            <rect
              x={f.x - f.w / 2}
              y={f.y}
              width={f.w}
              height={f.len + 26}
              rx={f.w / 2}
              fill="rgb(var(--mc-raised))"
              stroke="rgb(var(--mc-ink) / 0.35)"
              strokeWidth="2"
            />
            <circle cx={f.x} cy={f.y + f.w / 2 + 2} r={f.w / 2 - 3} fill="rgb(var(--mc-ink))" />
            <text
              x={f.x}
              y={f.y + f.w / 2 + 3}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fontWeight="700"
              fill="rgb(var(--mc-bg))"
              transform={mirror ? `translate(${2 * f.x} 0) scale(-1 1)` : undefined}
            >
              {f.n}
            </text>
          </g>
        ))}
        <rect x="82" y="128" width="112" height="60" rx="30" fill="rgb(var(--mc-raised))" />
      </svg>
      <div className="text-sm font-semibold text-mc-muted">{label}</div>
    </div>
  );
  return (
    <div className="flex items-end justify-center gap-10">
      {hand(true, 'Left hand')}
      {hand(false, 'Right hand')}
    </div>
  );
}

function KeysFigure({ fig }: { fig: Extract<Figure, { kind: 'keys' }> }) {
  const mode = useInputMode();
  const marks = useMemo(() => {
    const out: Record<number, KeyMark> = {};
    for (const [k, label] of Object.entries(fig.marks ?? {})) {
      out[Number(k)] = { kind: 'target', label: label || undefined, badge: 'ink' };
    }
    return out;
  }, [fig.marks]);
  return (
    <div className="overflow-hidden rounded-xl">
      <Keyboard low={fig.low} high={fig.high} height={150} marks={marks} labels={fig.labels ?? 'none'} interactive={mode === 'touch'} sound={mode === 'touch'} />
    </div>
  );
}

function StaffFigure({ fig }: { fig: Extract<Figure, { kind: 'staff' }> }) {
  const score = useMemo(() => resolveMusic(fig.music), [fig.music]);
  const height = score.hands.length === 2 ? 250 : 170;
  return (
    <div className="mx-auto w-full max-w-xl rounded-xl bg-mc-surface px-4 py-2" style={{ height }}>
      <ScoreView score={score} showFingering={false} showNames={fig.names} maxZoom={1.75} minZoom={1.2} showMeasureNumbers={false} />
    </div>
  );
}

export default function FigureView({ figure }: { figure: Figure }) {
  return (
    <figure className="my-2">
      {figure.kind === 'hands' && <HandsFigure />}
      {figure.kind === 'keys' && <KeysFigure fig={figure} />}
      {figure.kind === 'staff' && <StaffFigure fig={figure} />}
      {figure.caption && <figcaption className="mt-2 text-center text-sm text-mc-muted">{figure.caption}</figcaption>}
    </figure>
  );
}
