'use client';

import type { SwitchProps } from '@/types';

export default function Switch({
  id,
  label,
  value,
  options,
  position,
  onChange,
  highlighted = false,
}: SwitchProps) {
  const currentIndex = options.indexOf(value);

  const handleClick = () => {
    const nextIndex = (currentIndex + 1) % options.length;
    onChange(options[nextIndex]);
  };

  const getTeachingClass = () => {
    if (!highlighted) return '';
    return 'teaching-current';
  };

  return (
    <div
      className={`flex flex-col items-center gap-2 select-none ${getTeachingClass()}`}
      style={position ? { position: 'absolute', left: position.x, top: position.y } : {}}
    >
      {/* Label */}
      <div className="font-label text-[9px] text-hardware-label uppercase tracking-wider text-center max-w-[80px]">
        {label}
      </div>

      {/* Switch toggle */}
      <button
        onClick={handleClick}
        className="relative w-16 h-8 bg-hardware-panel border-2 border-[#3a3a3a] rounded-full shadow-inner transition-all hover:brightness-110"
        style={{ boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8)' }}
      >
        {/* Switch slider */}
        <div
          className={`absolute top-0.5 h-6 w-6 bg-gradient-to-b from-[#4a4a4a] to-[#2a2a2a] rounded-full border border-[#5a5a5a] shadow-lg transition-all duration-200`}
          style={{
            left: options.length === 2
              ? (currentIndex === 0 ? '2px' : 'calc(100% - 26px)')
              : `calc(${(currentIndex / (options.length - 1)) * 100}% - ${currentIndex === 0 ? 2 : currentIndex === options.length - 1 ? 26 : 12}px)`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
          }}
        />

        {/* Position markers */}
        <div className="absolute inset-0 flex items-center justify-between px-2">
          {options.map((_, idx) => (
            <div
              key={idx}
              className={`w-1 h-1 rounded-full ${idx === currentIndex ? 'bg-hardware-led-on' : 'bg-hardware-label opacity-30'}`}
            />
          ))}
        </div>
      </button>

      {/* Value display */}
      <div className="font-mono text-[11px] bg-black text-teaching-current px-3 py-0.5 rounded border border-[#1a1a1a] min-w-[60px] text-center"
           style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,255,0,0.2)' }}>
        {value}
      </div>
    </div>
  );
}
