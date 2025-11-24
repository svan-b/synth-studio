'use client';

import type { SwitchSpec } from '@/types';

export interface SwitchProps {
  id: string;
  spec: SwitchSpec;
  value: number;  // Index into options
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

  const getTeachingClass = () => {
    if (!highlighted) return '';
    if (isCorrect) return 'ring-2 ring-green-500 ring-opacity-80';
    return 'ring-2 ring-orange-500 ring-opacity-80 animate-pulse';
  };

  // Calculate slider position based on number of options
  const getSliderPosition = () => {
    if (options.length === 2) {
      return currentIndex === 0 ? '2px' : 'calc(100% - 26px)';
    }
    // For 3+ options
    const percent = (currentIndex / (options.length - 1)) * 100;
    if (currentIndex === 0) return '2px';
    if (currentIndex === options.length - 1) return 'calc(100% - 26px)';
    return `calc(${percent}% - 12px)`;
  };

  return (
    <div
      className={`flex flex-col items-center gap-1.5 select-none ${getTeachingClass()}`}
      title={spec.description}
    >
      {/* Label */}
      <div className="font-label text-[8px] text-hardware-label uppercase tracking-wider text-center max-w-[70px] leading-tight">
        {label}
      </div>

      {/* Switch toggle */}
      <button
        onClick={handleClick}
        className="relative w-14 h-7 bg-hardware-panel border-2 border-[#3a3a3a] rounded-full transition-all hover:brightness-110"
        style={{ boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8)' }}
      >
        {/* Switch slider */}
        <div
          className="absolute top-0.5 h-5 w-5 bg-gradient-to-b from-[#4a4a4a] to-[#2a2a2a] rounded-full border border-[#5a5a5a] transition-all duration-200"
          style={{
            left: getSliderPosition(),
            boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
          }}
        />

        {/* Position markers */}
        <div className="absolute inset-0 flex items-center justify-between px-2">
          {options.map((_, idx) => (
            <div
              key={idx}
              className={`w-1 h-1 rounded-full transition-colors ${
                idx === currentIndex ? 'bg-hardware-led-on' : 'bg-hardware-label opacity-30'
              }`}
            />
          ))}
        </div>
      </button>

      {/* Value display */}
      <div
        className="font-mono text-[10px] bg-black text-green-400 px-2 py-0.5 rounded border border-[#1a1a1a] min-w-[50px] text-center"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 6px rgba(0,255,0,0.15)' }}
      >
        {options[currentIndex]}
      </div>

      {/* Target hint */}
      {highlighted && targetValue !== undefined && !isCorrect && (
        <div className="text-[8px] text-teaching-target font-mono">
          → {options[targetValue]}
        </div>
      )}
    </div>
  );
}
