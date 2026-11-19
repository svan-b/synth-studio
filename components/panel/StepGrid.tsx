'use client';

import { memo } from 'react';

interface StepGridProps {
  steps: number;
  rows: number;
  pattern: string;
  playhead?: number;
  color?: string;
  numbered?: boolean;
  target?: string;
  highlighted?: boolean;
  onToggle: (index: number) => void;
  /** Step-number font size (native px) from the panel's legibility pass */
  numberSize?: number;
}

/**
 * Trig keys / step buttons. Lit = step on, white outline = playhead,
 * orange dot = the lesson wants this step on, red dot = the lesson wants it off.
 */
function StepGrid({ steps, rows, pattern, playhead, color = '#ff5a36', numbered = true, target, highlighted, onToggle, numberSize }: StepGridProps) {
  const perRow = Math.ceil(steps / rows);
  const num = Math.max(7, numberSize ?? 7);
  return (
    <div className="w-full h-full flex flex-col gap-[3px] select-none" role="group" aria-label="Steps">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex-1 flex gap-[3px]">
          {Array.from({ length: perRow }, (_, c) => {
            const i = r * perRow + c;
            if (i >= steps) return <div key={c} className="flex-1" />;
            const on = pattern[i] !== '0' && pattern[i] !== undefined;
            const isHead = playhead === i;
            const want = target !== undefined ? target[i] !== '0' && target[i] !== undefined : undefined;
            const mismatch = highlighted && want !== undefined && want !== on;
            return (
              <button
                key={c}
                onPointerDown={e => { e.preventDefault(); onToggle(i); }}
                onKeyDown={e => { if ((e.key === 'Enter') && !e.repeat) { e.preventDefault(); onToggle(i); } }}
                className="flex-1 relative rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                style={{
                  touchAction: 'none',
                  background: on ? color : '#1e1e1e',
                  boxShadow: [
                    on ? `0 0 8px ${color}` : 'inset 0 2px 3px #000',
                    isHead ? '0 0 0 2px #ffffff' : '',
                    mismatch ? '0 0 0 2px #f97316' : '',
                  ].filter(Boolean).join(', '),
                  border: '1px solid #3a3a3a',
                  filter: isHead && !on ? 'brightness(2)' : undefined,
                }}
                aria-label={`Step ${i + 1}`}
                aria-pressed={on}
              >
                {numbered && (
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-[2px] font-bold leading-none" style={{ fontSize: num, color: on ? '#000' : '#8a8a8a' }}>
                    {i + 1}
                  </span>
                )}
                {mismatch && (
                  <span className={`absolute top-[2px] right-[2px] w-[5px] h-[5px] rounded-full ${want ? 'bg-orange-400' : 'bg-red-500'} motion-safe:animate-pulse`} />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default memo(StepGrid);
