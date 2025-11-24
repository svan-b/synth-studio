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
  const { options } = spec;
  const currentIndex = value;

  const handleClick = () => {
    const nextIndex = (currentIndex + 1) % options.length;
    onChange(nextIndex);
  };

  const isCorrect = targetValue !== undefined && value === targetValue;

  // 3-position toggle switch (like SEQ PITCH MOD: VCO1 / BOTH / VCO2)
  if (options.length === 3) {
    return (
      <div className="flex flex-col items-center" title={spec.description}>
        {/* Option labels */}
        <div className="flex justify-between w-full mb-1 px-0.5">
          <span className="text-[6px] text-gray-500">{options[0]}</span>
          <span className="text-[6px] text-gray-500">{options[2]}</span>
        </div>

        {/* Toggle track */}
        <button
          onClick={handleClick}
          className={`
            relative w-10 h-5 rounded-sm
            bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a]
            border border-[#3a3a3a]
            ${highlighted ? (isCorrect ? 'ring-2 ring-green-500' : 'ring-2 ring-orange-500 animate-pulse') : ''}
          `}
          style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }}
        >
          {/* Metal toggle lever */}
          <div
            className="absolute top-0.5 w-3 h-4 rounded-sm transition-all duration-150"
            style={{
              left: currentIndex === 0 ? '2px' : currentIndex === 1 ? 'calc(50% - 6px)' : 'calc(100% - 14px)',
              background: 'linear-gradient(180deg, #888 0%, #555 50%, #888 100%)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.3)',
            }}
          />
        </button>

        {/* Center label */}
        <span className="text-[6px] text-gray-500 mt-0.5">{options[1]}</span>

        {/* Current value display */}
        <div className="text-[8px] text-green-400 mt-1 font-mono">
          {options[currentIndex]}
        </div>

        {/* Target hint */}
        {highlighted && targetValue !== undefined && !isCorrect && (
          <div className="text-[7px] text-orange-400 font-mono">→ {options[targetValue]}</div>
        )}
      </div>
    );
  }

  // 2-position toggle switch (like VCO WAVE: TRI/SQR, VCF MODE: LP/HP)
  return (
    <div className="flex flex-col items-center" title={spec.description}>
      {/* Top option label */}
      <span className="text-[6px] text-gray-500 mb-0.5">{options[0]}</span>

      {/* Toggle track */}
      <button
        onClick={handleClick}
        className={`
          relative w-4 h-8 rounded-sm
          bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a]
          border border-[#3a3a3a]
          ${highlighted ? (isCorrect ? 'ring-2 ring-green-500' : 'ring-2 ring-orange-500 animate-pulse') : ''}
        `}
        style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }}
      >
        {/* Metal toggle lever */}
        <div
          className="absolute left-0.5 w-3 h-4 rounded-sm transition-all duration-150"
          style={{
            top: currentIndex === 0 ? '2px' : 'calc(100% - 18px)',
            background: 'linear-gradient(180deg, #888 0%, #555 50%, #888 100%)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.3)',
          }}
        />
      </button>

      {/* Bottom option label */}
      <span className="text-[6px] text-gray-500 mt-0.5">{options[1]}</span>

      {/* Target hint */}
      {highlighted && targetValue !== undefined && !isCorrect && (
        <div className="text-[7px] text-orange-400 font-mono mt-1">→ {options[targetValue]}</div>
      )}
    </div>
  );
}
