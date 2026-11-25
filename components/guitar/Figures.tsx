'use client';

import { useMemo } from 'react';
import { resolveMusic } from '@/lib/guitar/content/catalog';
import type { Figure } from '@/lib/guitar/content/types';
import { STRING_LETTER, STRING_NAME, isCompound, measureBeats, type StringNo, type TimeSig } from '@/lib/guitar/music/theory';
import { ChordDiagram } from './ChordDiagram';
import { TabView } from './TabView';

/** The neck lying down, as you look down at it: the thin string at the top, frets left to right. */
export function Neck({ marks, frets = 5, highlight }: { marks: Array<{ string: StringNo; fret: number; label?: string }>; frets?: number; highlight?: { string: StringNo; fret: number } | null }) {
  const W = 520;
  const left = 54;
  const right = 20;
  const top = 22;
  const gap = 26;
  const fw = (W - left - right) / frets;
  const H = top * 2 + gap * 5 + 18;
  const y = (s: StringNo) => top + (s - 1) * gap;
  const x = (f: number) => (f === 0 ? left - 22 : left + (f - 0.5) * fw);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }} role="img" aria-label="The neck">
      <rect x={left} y={y(1) - 6} width={W - left - right} height={gap * 5 + 12} rx={4} fill="rgb(var(--os-wood) / 0.12)" />
      {Array.from({ length: frets + 1 }, (_, i) => (
        <line key={i} x1={left + i * fw} x2={left + i * fw} y1={y(1) - 6} y2={y(6) + 6} stroke="rgb(var(--os-ink))" strokeOpacity={i === 0 ? 0.9 : 0.3} strokeWidth={i === 0 ? 5 : 2} />
      ))}
      {[3, 5].filter((f) => f <= frets).map((f) => (
        <circle key={f} cx={left + (f - 0.5) * fw} cy={(y(3) + y(4)) / 2} r={5} fill="rgb(var(--os-ink))" fillOpacity={0.12} />
      ))}
      {([1, 2, 3, 4, 5, 6] as StringNo[]).map((s) => (
        <g key={s}>
          <text x={8} y={y(s) + 5} fontSize={14} fontWeight={700} fill="rgb(var(--os-faint))">
            {STRING_LETTER[s]}
          </text>
          <line x1={left - 30} x2={W - right} y1={y(s)} y2={y(s)} stroke="rgb(var(--os-string))" strokeWidth={1 + (s - 1) * 0.45} />
        </g>
      ))}
      {Array.from({ length: frets }, (_, i) => (
        <text key={i} x={left + (i + 0.5) * fw} y={H - 4} textAnchor="middle" fontSize={12} fill="rgb(var(--os-faint))">
          {i + 1}
        </text>
      ))}
      {marks.map((m, i) => {
        const lit = highlight && highlight.string === m.string && highlight.fret === m.fret;
        return (
          <g key={i}>
            <circle cx={x(m.fret)} cy={y(m.string)} r={12} fill={lit ? 'rgb(var(--os-hint))' : m.fret === 0 ? 'rgb(var(--os-bg))' : 'rgb(var(--os-ink))'} stroke="rgb(var(--os-ink))" strokeWidth={m.fret === 0 ? 2 : 0} />
            {m.label && (
              <text x={x(m.fret)} y={y(m.string) + 5} textAnchor="middle" fontSize={m.label.length > 1 ? 11 : 13} fontWeight={800} fill={m.fret === 0 && !lit ? 'rgb(var(--os-ink))' : 'rgb(var(--os-bg))'}>
                {m.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** The six strings by number and name, standing up as in a chord picture. */
export function StringsFigure({ highlight }: { highlight?: StringNo[] }) {
  const W = 360;
  const H = 230;
  const xs = (s: StringNo) => 40 + (6 - s) * 56;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }} role="img" aria-label="The six strings">
      {([6, 5, 4, 3, 2, 1] as StringNo[]).map((s) => {
        const lit = !highlight || highlight.includes(s);
        return (
          <g key={s} opacity={lit ? 1 : 0.3}>
            <text x={xs(s)} y={22} textAnchor="middle" fontSize={20} fontWeight={800} fill="rgb(var(--os-ink))">
              {STRING_LETTER[s].toUpperCase()}
            </text>
            <line x1={xs(s)} x2={xs(s)} y1={36} y2={176} stroke="rgb(var(--os-wood))" strokeWidth={1.5 + (s - 1) * 0.8} strokeLinecap="round" />
            <circle cx={xs(s)} cy={196} r={13} fill={lit && highlight ? 'rgb(var(--os-accent))' : 'rgb(var(--os-raised))'} />
            <text x={xs(s)} y={201} textAnchor="middle" fontSize={14} fontWeight={800} fill={lit && highlight ? 'rgb(var(--os-bg))' : 'rgb(var(--os-ink))'}>
              {s}
            </text>
            <title>{`String ${s}, ${STRING_NAME[s]}`}</title>
          </g>
        );
      })}
      <text x={40} y={226} fontSize={12} fill="rgb(var(--os-muted))">
        thickest
      </text>
      <text x={W - 28} y={226} textAnchor="end" fontSize={12} fill="rgb(var(--os-muted))">
        thinnest
      </text>
    </svg>
  );
}

/** How a strum pattern is counted, with a mark under each count for what the hand does. */
export function PatternView({ pattern, time = [4, 4], now = null }: { pattern: string; time?: TimeSig; now?: number | null }) {
  const slots = pattern.replace(/\s+/g, '').split('');
  const compound = isCompound(time);
  const counts = slots.map((_, i) => (compound ? String(i + 1) : i % 2 === 0 ? String(i / 2 + 1) : 'and'));
  void measureBeats;
  return (
    <div className="flex items-end gap-1.5" role="img" aria-label={`Strum pattern ${pattern}`}>
      {slots.map((c, i) => {
        const lit = now === i;
        return (
          <div key={i} className={`flex w-12 flex-col items-center rounded-xl py-1.5 ${lit ? 'bg-os-accent/15' : ''}`}>
            <span className={`h-9 ${c === '.' ? 'text-os-line' : 'text-os-ink'}`}>
              {c === 'D' && (
                <svg width="26" height="34" viewBox="0 0 26 34" aria-label="down">
                  <path d="M13 3v26M5 21l8 9 8-9" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {c === 'U' && (
                <svg width="26" height="34" viewBox="0 0 26 34" aria-label="up">
                  <path d="M13 31V5M5 13l8-9 8 9" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
                </svg>
              )}
              {(c === 'B' || c === 'A') && <span className="flex h-9 w-9 items-center justify-center rounded-full bg-os-ink text-sm font-bold text-os-bg">{c === 'B' ? 'bass' : 'alt'}</span>}
              {c === 'x' && <span className="text-2xl font-bold">x</span>}
              {c === '.' && <span className="block pt-3 text-2xl leading-none">.</span>}
            </span>
            <span className={`text-sm font-semibold ${counts[i] === 'and' ? 'text-os-faint' : 'text-os-muted'}`}>{counts[i] === 'and' ? '&' : counts[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** An acoustic guitar with its parts named. */
export function GuitarFigure() {
  return (
    <svg width="100%" viewBox="0 0 640 260" style={{ maxWidth: 640 }} role="img" aria-label="The parts of a guitar">
      <g fill="rgb(var(--os-wood) / 0.22)" stroke="rgb(var(--os-wood))" strokeWidth={3}>
        <path d="M40 130c0-62 40-98 92-98 40 0 58 22 84 22s44-22 84-22c52 0 92 36 92 98s-40 98-92 98c-40 0-58-22-84-22s-44 22-84 22c-52 0-92-36-92-98z" />
      </g>
      <circle cx={228} cy={130} r={36} fill="rgb(var(--os-ink) / 0.85)" stroke="rgb(var(--os-wood))" strokeWidth={6} />
      <rect x={96} y={118} width={20} height={24} rx={3} fill="rgb(var(--os-wood))" />
      <rect x={380} y={113} width={190} height={34} rx={4} fill="rgb(var(--os-wood) / 0.5)" stroke="rgb(var(--os-wood))" strokeWidth={2} />
      {[400, 425, 450, 475, 500, 525, 550].map((x) => (
        <line key={x} x1={x} x2={x} y1={113} y2={147} stroke="rgb(var(--os-ink))" strokeOpacity={0.5} strokeWidth={2} />
      ))}
      <path d="M570 108h46l12 10v24l-12 10h-46z" fill="rgb(var(--os-wood) / 0.6)" stroke="rgb(var(--os-wood))" strokeWidth={2} />
      {[586, 604].map((x) => (
        <g key={x}>
          <circle cx={x} cy={100} r={6} fill="rgb(var(--os-ink))" />
          <circle cx={x} cy={160} r={6} fill="rgb(var(--os-ink))" />
        </g>
      ))}
      {[118, 123, 128, 133, 138, 143].map((y) => (
        <line key={y} x1={106} x2={590} y1={y} y2={y} stroke="rgb(var(--os-string))" strokeWidth={1.2} />
      ))}
      <g fontSize={15} fontWeight={700} fill="rgb(var(--os-ink))" textAnchor="middle">
        <text x={140} y={250}>body</text>
        <text x={228} y={196}>soundhole</text>
        <text x={106} y={104}>bridge</text>
        <text x={470} y={176}>neck and frets</text>
        <text x={596} y={190}>tuning pegs</text>
        <text x={596} y={84}>headstock</text>
      </g>
    </svg>
  );
}

/** The hand that presses the strings, with its fingers numbered. */
export function HandFigure() {
  const fingers = [
    { n: 1, x: 118, y: 40, h: 92 },
    { n: 2, x: 162, y: 24, h: 108 },
    { n: 3, x: 206, y: 34, h: 98 },
    { n: 4, x: 248, y: 62, h: 72 },
  ];
  return (
    <svg width="100%" viewBox="0 0 360 260" style={{ maxWidth: 360 }} role="img" aria-label="Finger numbers">
      <g fill="rgb(var(--os-raised))" stroke="rgb(var(--os-ink))" strokeOpacity={0.4} strokeWidth={2}>
        <path d="M96 128h176v62c0 34-30 58-70 58h-34c-40 0-72-24-72-58z" />
        <path d="M96 150c-26-6-50-28-58-56-4-14 12-22 22-10l34 40z" />
        {fingers.map((f) => (
          <rect key={f.n} x={f.x - 19} y={f.y} width={38} height={f.h + 20} rx={19} />
        ))}
      </g>
      {fingers.map((f) => (
        <g key={f.n}>
          <circle cx={f.x} cy={f.y + 22} r={16} fill="rgb(var(--os-accent))" />
          <text x={f.x} y={f.y + 28} textAnchor="middle" fontSize={17} fontWeight={800} fill="rgb(var(--os-bg))">
            {f.n}
          </text>
        </g>
      ))}
      <text x={60} y={86} textAnchor="middle" fontSize={14} fontWeight={700} fill="rgb(var(--os-muted))">
        thumb
      </text>
    </svg>
  );
}

export default function FigureView({ figure }: { figure: Figure }) {
  const tabScore = useMemo(() => (figure.kind === 'tab' ? resolveMusic(figure.music) : null), [figure]);
  let body: JSX.Element;
  switch (figure.kind) {
    case 'chord':
      body = <ChordDiagram chord={figure.chord} variant={figure.variant} width={200} strings={figure.strings} />;
      break;
    case 'chords':
      body = (
        <div className="flex flex-wrap justify-center gap-6">
          {figure.chords.map((c) => (
            <ChordDiagram key={c} chord={c} width={150} />
          ))}
        </div>
      );
      break;
    case 'neck':
      body = <Neck marks={figure.marks} frets={figure.frets} />;
      break;
    case 'strings':
      body = <StringsFigure highlight={figure.highlight} />;
      break;
    case 'pattern':
      body = <PatternView pattern={figure.pattern} time={figure.time} />;
      break;
    case 'tab':
      body = <div className="h-[200px] w-full">{tabScore && <TabView score={tabScore} compact />}</div>;
      break;
    case 'guitar':
      body = <GuitarFigure />;
      break;
    case 'hand':
      body = <HandFigure />;
      break;
  }
  return (
    <figure className="flex flex-col items-center gap-3 rounded-3xl bg-os-surface px-5 py-6">
      {body}
      {figure.caption && <figcaption className="text-center text-[15px] text-os-muted">{figure.caption}</figcaption>}
    </figure>
  );
}
