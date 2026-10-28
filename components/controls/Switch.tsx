'use client';

import type { SwitchSpec } from '@/types';
import type { LabelPosition } from '@/types/panel';

export interface SwitchProps {
  id: string;
  spec: SwitchSpec;
  value: number;
  onChange: (value: number) => void;
  highlighted?: boolean;
  targetValue?: number;
  orientation?: 'vertical' | 'horizontal';
  style?: 'toggle' | 'buttons' | 'rotary';
  label?: LabelPosition;
  labelText?: string;
  labelColor?: string;
  scale?: number;
}

/**
 * Multi-position switch.
 *  toggle  - bat lever (2 or 3 positions), tap cycles, or tap a position legend
 *  buttons - row/column of small radio buttons (Elektron/Xone style selectors)
 *  rotary  - stepped selector knob with position legends
 */
export default function Switch({
  id,
  spec,
  value,
  onChange,
  highlighted = false,
  targetValue,
  orientation = 'vertical',
  style = 'toggle',
  label = 'above',
  labelText,
  labelColor = '#9ca3af',
  scale = 1,
}: SwitchProps) {
  const { options } = spec;
  const current = Math.max(0, Math.min(options.length - 1, Math.round(value)));
  const isCorrect = targetValue !== undefined && current === targetValue;
  const ring = highlighted ? (isCorrect ? 'ring-2 ring-green-500' : 'ring-2 ring-orange-500 animate-pulse') : '';
  const shownLabel = labelText ?? spec.label;
  const title = `${spec.label}: ${options[current]}${spec.description ? `\n${spec.description}` : ''}`;
  const labelFont = Math.round(6 * scale);
  const legendFont = Math.max(5, Math.round(5 * scale));

  const header = label !== 'none' && shownLabel && (
    <div className="font-bold whitespace-nowrap leading-none mb-0.5" style={{ fontSize: labelFont, color: labelColor }}>
      {shownLabel}
    </div>
  );

  const hint = highlighted && targetValue !== undefined && !isCorrect && (
    <div className="font-mono text-orange-400 font-bold mt-0.5 whitespace-nowrap bg-black/80 px-1 rounded" style={{ fontSize: Math.max(7, legendFont + 2) }}>
      → {options[targetValue]}
    </div>
  );

  if (style === 'buttons') {
    const vertical = orientation === 'vertical';
    return (
      <div className="flex flex-col items-center select-none" title={title} data-control={id}>
        {header}
        <div className={`flex ${vertical ? 'flex-col' : 'flex-row'} gap-0.5 rounded p-0.5 ${ring}`}>
          {options.map((opt, i) => (
            <button
              key={opt + i}
              onClick={() => onChange(i)}
              className="rounded-sm font-bold leading-none transition-colors"
              style={{
                fontSize: legendFont + 1,
                padding: `${2 * scale}px ${4 * scale}px`,
                minWidth: 16 * scale,
                background: i === current ? '#e5e5e5' : '#222',
                color: i === current ? '#111' : '#aaa',
                border: '1px solid #444',
                boxShadow: i === current ? '0 0 6px rgba(255,255,255,0.35)' : 'inset 0 1px 2px #000',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
        {hint}
      </div>
    );
  }

  if (style === 'rotary') {
    const d = 22 * scale;
    const sweep = options.length > 1 ? 270 / (options.length - 1) : 0;
    const angle = -135 + current * sweep;
    return (
      <div className="flex flex-col items-center select-none" title={title} data-control={id}>
        {header}
        <div className="relative" style={{ width: d * 2.2, height: d * 2.0 }}>
          {options.map((opt, i) => {
            const a = ((-135 + i * sweep) * Math.PI) / 180;
            const r = d * 0.95;
            return (
              <button
                key={opt + i}
                onClick={() => onChange(i)}
                className="absolute font-bold leading-none whitespace-nowrap"
                style={{
                  left: d * 1.1 + Math.sin(a) * r,
                  top: d * 1.05 - Math.cos(a) * r,
                  transform: 'translate(-50%, -50%)',
                  fontSize: legendFont,
                  color: i === current ? '#fff' : '#888',
                }}
              >
                {opt}
              </button>
            );
          })}
          <button
            onClick={() => onChange((current + 1) % options.length)}
            className={`absolute rounded-full ${ring}`}
            style={{
              width: d,
              height: d,
              left: d * 0.6,
              top: d * 0.55,
              background: 'radial-gradient(circle at 45% 35%, #3a3a3a 0%, #0e0e0e 80%)',
              border: '1px solid #444',
              boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
              transform: `rotate(${angle}deg)`,
            }}
            aria-label={shownLabel}
          >
            <span className="absolute left-1/2 -translate-x-1/2 bg-white rounded-full" style={{ top: 2, width: 2, height: d * 0.35 }} />
          </button>
        </div>
        {hint}
      </div>
    );
  }

  // Bat-lever toggle
  const positions = options.length;
  const vertical = orientation === 'vertical';
  const trackLong = (positions === 3 ? 20 : 16) * scale;
  const trackShort = 12 * scale;
  const lever = 8 * scale;
  const frac = positions > 1 ? current / (positions - 1) : 0;
  const leverPos = 1 + frac * (trackLong - lever - 2);

  return (
    <div className="flex flex-col items-center select-none" title={title} data-control={id}>
      {header}
      <div className={`flex ${vertical ? 'flex-row' : 'flex-col'} items-center gap-0.5`}>
        <button
          onClick={() => onChange((current + 1) % positions)}
          className={`relative rounded-sm bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] border border-[#3a3a3a] ${ring}`}
          style={{
            width: vertical ? trackShort : trackLong,
            height: vertical ? trackLong : trackShort,
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
          }}
          aria-label={`${shownLabel}: ${options[current]}`}
        >
          <span
            className="absolute rounded-sm transition-all duration-150"
            style={{
              ...(vertical
                ? { left: (trackShort - lever) / 2 - 1, top: leverPos, width: lever, height: lever }
                : { top: (trackShort - lever) / 2 - 1, left: leverPos, width: lever, height: lever }),
              background: 'linear-gradient(180deg, #999 0%, #555 50%, #999 100%)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          />
        </button>
        <div
          className={`flex ${vertical ? 'flex-col' : 'flex-row gap-1'} justify-between font-bold leading-none`}
          style={vertical ? { height: trackLong, fontSize: legendFont } : { fontSize: legendFont }}
        >
          {options.map((opt, i) => (
            <span
              key={opt + i}
              onClick={() => onChange(i)}
              className="cursor-pointer whitespace-nowrap"
              style={{ color: i === current ? '#fff' : '#777' }}
            >
              {opt}
            </span>
          ))}
        </div>
      </div>
      {hint}
    </div>
  );
}
