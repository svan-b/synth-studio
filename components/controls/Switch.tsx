'use client';

import type { SwitchSpec } from '@/types';

export interface SwitchProps {
  id: string;
  spec: SwitchSpec;
  value: number;
  onChange: (value: number) => void;
  highlighted?: boolean;
  targetValue?: number;
}

export default function Switch({
  id,
  spec,
  value,
  onChange,
  highlighted = false,
  targetValue,
}: SwitchProps) {
  const { options, label } = spec;
  const currentIndex = value;

  const handleClick = () => {
    const nextIndex = (currentIndex + 1) % options.length;
    onChange(nextIndex);
  };

  const isCorrect = targetValue !== undefined && value === targetValue;

  // 3-position toggle switch (like SEQ PITCH MOD: VCO1&2 / OFF / VCO2)
  if (options.length === 3) {
    return (
      <div
        className="flex flex-col items-center"
        title={`${spec.label}: ${options[currentIndex]}\n${spec.description}`}
      >
        {/* Label above */}
        <div className="text-[6px] text-gray-400 font-bold mb-1 whitespace-nowrap">
          {label}
        </div>

        {/* Switch with position labels */}
        <div className="flex items-center gap-1">
          {/* Position labels - left side */}
          <div className="flex flex-col justify-between text-[5px] text-gray-500 font-bold" style={{ height: '28px' }}>
            <span className={currentIndex === 0 ? 'text-white' : ''}>{options[0]}</span>
            <span className={currentIndex === 1 ? 'text-white' : ''}>{options[1]}</span>
            <span className={currentIndex === 2 ? 'text-white' : ''}>{options[2]}</span>
          </div>

          {/* Toggle track - vertical 3-position */}
          <button
            onClick={handleClick}
            className={`
              relative w-4 h-7 rounded-sm
              bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a]
              border border-[#3a3a3a]
              ${highlighted ? (isCorrect ? 'ring-2 ring-green-500' : 'ring-2 ring-orange-500 animate-pulse') : ''}
            `}
            style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }}
          >
            {/* Metal toggle lever */}
            <div
              className="absolute left-0.5 w-3 h-2.5 rounded-sm transition-all duration-150"
              style={{
                top: currentIndex === 0 ? '2px' : currentIndex === 1 ? 'calc(50% - 5px)' : 'calc(100% - 12px)',
                background: 'linear-gradient(180deg, #888 0%, #555 50%, #888 100%)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.3)',
              }}
            />
          </button>
        </div>

        {/* Target hint - only show when teaching */}
        {highlighted && targetValue !== undefined && !isCorrect && (
          <div className="text-[6px] text-orange-400 font-mono mt-0.5">→ {options[targetValue]}</div>
        )}
      </div>
    );
  }

  // 2-position toggle switch (like HARD SYNC: ON/OFF, VCO WAVE: TRI/SQR)
  return (
    <div
      className="flex flex-col items-center"
      title={`${spec.label}: ${options[currentIndex]}\n${spec.description}`}
    >
      {/* Label above */}
      <div className="text-[6px] text-gray-400 font-bold mb-1 whitespace-nowrap">
        {label}
      </div>

      {/* Switch with position labels */}
      <div className="flex items-center gap-1">
        {/* Position labels - left side */}
        <div className="flex flex-col justify-between text-[5px] text-gray-500 font-bold" style={{ height: '24px' }}>
          <span className={currentIndex === 0 ? 'text-white' : ''}>{options[0]}</span>
          <span className={currentIndex === 1 ? 'text-white' : ''}>{options[1]}</span>
        </div>

        {/* Toggle track - vertical 2-position */}
        <button
          onClick={handleClick}
          className={`
            relative w-4 h-6 rounded-sm
            bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a]
            border border-[#3a3a3a]
            ${highlighted ? (isCorrect ? 'ring-2 ring-green-500' : 'ring-2 ring-orange-500 animate-pulse') : ''}
          `}
          style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }}
        >
          {/* Metal toggle lever */}
          <div
            className="absolute left-0.5 w-3 h-3 rounded-sm transition-all duration-150"
            style={{
              top: currentIndex === 0 ? '2px' : 'calc(100% - 14px)',
              background: 'linear-gradient(180deg, #888 0%, #555 50%, #888 100%)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.3)',
            }}
          />
        </button>
      </div>

      {/* Target hint - only show when teaching */}
      {highlighted && targetValue !== undefined && !isCorrect && (
        <div className="text-[6px] text-orange-400 font-mono mt-0.5">→ {options[targetValue]}</div>
      )}
    </div>
  );
}
