'use client';
// ============================================================================
// Signal path: the instrument's flow chart, above its panel.
//
// Every manual opens with one of these and then leaves the learner to map it on
// to the front panel alone. Here the map is live: choose a block and its controls
// light up on the panel (an Elektron opens the block's page on its screen), touch
// a control and its block lights up here. Solid lines carry sound, dashed lines
// carry control, as the manuals draw them.
//
// The drawing comes from `spec.signalFlow` (lib/signalPath.ts lays it out).
// ============================================================================

import { memo, useMemo } from 'react';
import type { SignalFlowSection } from '@/types';
import { arrowHead, layoutSignalPath, type PathBlock, type PathWire } from '@/lib/signalPath';
import { blockLinks } from '@/lib/signalPathBlocks';

const AUDIO = '#cbd5e1';
const CONTROL = '#7dd3fc';
/** The panel's spotlight ring colour (controlStyles: ssc-spot-focus), so the eye ties the two together */
const CHOSEN = '#fde68a';

interface SignalPathProps {
  flow: SignalFlowSection[];
  deviceName: string;
  /** The block the learner chose: its controls are lit on the panel */
  selected: string | null;
  /** The block of the control last touched (or of the lesson step): "you are here" */
  here: string | null;
  onSelect: (id: string | null) => void;
  /** A lesson is running: the diagram shows where the step is, the panel and its pages follow the lesson */
  inLesson?: boolean;
}

function SignalPath({ flow, deviceName, selected, here, onSelect, inLesson }: SignalPathProps) {
  const layout = useMemo(() => layoutSignalPath(flow), [flow]);
  const chosen = selected && layout.byId[selected] ? layout.byId[selected] : null;
  // The chosen block's neighbours stay bright, the rest step back
  const near = useMemo(() => {
    if (!chosen) return null;
    const s = new Set<string>([chosen.id]);
    layout.wires.forEach(w => {
      if (w.from === chosen.id) s.add(w.to);
      if (w.to === chosen.id) s.add(w.from);
    });
    return s;
  }, [chosen, layout]);
  const links = useMemo(() => (chosen ? blockLinks(flow, chosen.id) : []), [flow, chosen]);
  const hereBlock = here && layout.byId[here] ? layout.byId[here] : null;

  if (!layout.blocks.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mb-2 select-none" data-signal-path={chosen?.id ?? ''}>
      <div className="max-w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="relative" style={{ width: layout.width, height: layout.height }} role="group" aria-label={`${deviceName} signal path`}>
          <svg width={layout.width} height={layout.height} className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {layout.wires.map((w, i) => <Wire key={i} w={w} lit={!chosen ? null : w.from === chosen.id || w.to === chosen.id} />)}
            {layout.labels.map(l => (
              <text key={`${l.from}|${l.text}`} x={l.x} y={l.y} dominantBaseline="central" fill={AUDIO} opacity={!chosen ? 0.9 : l.from === chosen.id ? 1 : 0.3}
                style={{ font: '700 10px "Arial Narrow", "Roboto Condensed", Arial, sans-serif', letterSpacing: '0.06em' }}>
                {l.text}
              </text>
            ))}
            {layout.dots.map(d => (
              <circle key={`${d.x}|${d.y}`} cx={d.x} cy={d.y} r={2.6} fill={AUDIO} opacity={!chosen ? 0.9 : d.from === chosen.id ? 1 : 0.18} />
            ))}
          </svg>
          {layout.blocks.map(b => (
            <Block
              key={b.id}
              b={b}
              chosen={chosen?.id === b.id}
              here={hereBlock?.id === b.id}
              far={!!near && !near.has(b.id)}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      <div className="basis-[260px] grow max-w-[440px] min-w-0 min-h-[72px] text-[12px] leading-snug text-gray-300" aria-live="polite" data-signal-path-info>
        {chosen ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-white">{chosen.section.name}</span>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: chosen.role === 'control' ? CONTROL : AUDIO }}>
                {chosen.role === 'control' ? 'control' : 'sound'}
              </span>
              <button
                type="button"
                onClick={() => onSelect(null)}
                className="ml-auto shrink-0 px-2.5 py-1 rounded-full border border-[#3a3a3a] text-[11px] text-gray-300 hover:text-white coarse:min-h-[44px] coarse:min-w-[44px]"
              >
                Show all
              </button>
            </div>
            {chosen.section.description && <p className="mt-0.5">{chosen.section.description}</p>}
            {links.length > 0 && (
              <p className="mt-0.5 text-[11px] text-gray-400">
                {links.map((l, i) => (
                  <span key={l.label}>
                    {i > 0 && <span className="mx-1.5 text-gray-600">|</span>}
                    <span className="text-gray-500">{l.label} </span>{l.text}
                  </span>
                ))}
              </p>
            )}
            {inLesson && <p className="mt-0.5 text-[11px] text-gray-500">During a lesson the panel follows the lesson step.</p>}
          </>
        ) : (
          <>
            <div className="font-bold text-white">Signal path</div>
            <p className="mt-0.5">
              Sound runs left to right along the <Key kind="audio" /> solid lines. <Key kind="control" /> Dashed lines are control: they move a block and make no sound themselves.
            </p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {hereBlock
                ? <>{inLesson ? 'This step is at' : 'You are at'} <span className="text-white font-bold">{hereBlock.section.name}</span>. Choose a block to {inLesson ? 'read what it does' : 'light its controls on the panel'}.</>
                : 'Choose a block to light its controls on the panel. Touch a control and its block lights up here.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(SignalPath);

/** A short sample of a line style, inside the legend sentence */
function Key({ kind }: { kind: 'audio' | 'control' }) {
  return (
    <svg width="20" height="8" className="inline-block align-middle mx-0.5" aria-hidden="true">
      <line x1="1" y1="4" x2="19" y2="4" stroke={kind === 'audio' ? AUDIO : CONTROL} strokeWidth={kind === 'audio' ? 2 : 1.6} strokeDasharray={kind === 'audio' ? undefined : '4 3'} strokeLinecap="round" />
    </svg>
  );
}

const Wire = memo(function Wire({ w, lit }: { w: PathWire; lit: boolean | null }) {
  const color = w.kind === 'audio' ? AUDIO : CONTROL;
  const opacity = lit === null ? (w.kind === 'audio' ? 0.9 : 0.75) : lit ? 1 : 0.18;
  return (
    <g opacity={opacity} style={{ transition: 'opacity 150ms' }} data-wire={`${w.from}>${w.to}`} data-wire-kind={w.kind}>
      <path
        d={w.d}
        fill="none"
        stroke={color}
        strokeWidth={w.kind === 'audio' ? 2 : 1.6}
        strokeDasharray={w.kind === 'audio' ? undefined : '4 3'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {w.to === '*'
        ? <circle cx={w.tip[0]} cy={w.tip[1]} r={2.4} fill="none" stroke={color} strokeWidth={1.4} />
        : <polygon points={arrowHead(w)} fill={color} />}
      {w.tail && <polygon points={arrowHead(w.tail)} fill={color} />}
    </g>
  );
});

interface BlockProps {
  b: PathBlock;
  chosen: boolean;
  here: boolean;
  far: boolean;
  onSelect: (id: string | null) => void;
}

const Block = memo(function Block({ b, chosen, here, far, onSelect }: BlockProps) {
  const control = b.role === 'control';
  const label = b.section.label ?? b.section.name;
  return (
    <button
      type="button"
      data-path-block={b.id}
      data-here={here ? '' : undefined}
      aria-pressed={chosen}
      aria-label={`${b.section.name}${control ? ' (control)' : ''}`}
      title={b.section.description}
      onClick={() => onSelect(chosen ? null : b.id)}
      className="absolute flex items-center justify-center text-center font-label font-bold uppercase whitespace-pre-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
      style={{
        left: b.x, top: b.y, width: b.w, height: b.h, padding: '0 3px',
        fontSize: 11, lineHeight: 1.12, letterSpacing: '0.04em',
        borderRadius: control ? 14 : 4,
        border: `${chosen ? 2 : 1}px ${control && !chosen ? 'dashed' : 'solid'} ${chosen ? CHOSEN : control ? '#4b9cc7' : '#6b7280'}`,
        background: chosen ? CHOSEN : control ? '#132331' : '#23262c',
        color: chosen ? '#111' : control ? '#cfeeff' : '#f1f5f9',
        boxShadow: chosen ? '0 0 10px 1px rgba(253,230,138,.35)' : here ? '0 0 0 2px rgba(253,230,138,.8)' : undefined,
        opacity: far ? 0.45 : 1,
        transition: 'opacity 150ms, background-color 150ms',
        touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
      {here && !chosen && (
        <span aria-hidden="true" className="absolute rounded-full" style={{ right: 3, top: 3, width: 6, height: 6, background: CHOSEN }} />
      )}
    </button>
  );
});
