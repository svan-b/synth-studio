'use client';

import type { ButtonProps } from '@/types';

export default function Button({
  id,
  label,
  value,
  position,
  led = false,
  ledColor = '#00ff00',
  onChange,
  highlighted = false,
}: ButtonProps) {
  const handleClick = () => {
    onChange(!value);
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
      {/* LED indicator */}
      {led && (
        <div className="flex justify-center">
          <div
            className={`w-2 h-2 rounded-full ${value ? 'led-on' : 'led-off'}`}
            style={{
              backgroundColor: value ? ledColor : '#333',
            }}
          />
        </div>
      )}

      {/* Button */}
      <button
        onClick={handleClick}
        className={`
          w-12 h-12 rounded-full border-2 transition-all
          ${value
            ? 'bg-hardware-panel border-hardware-led-on shadow-inner'
            : 'bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] border-[#4a4a4a] shadow-lg'
          }
          hover:brightness-110 active:scale-95
        `}
        style={value ? {
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
        } : {
          boxShadow: '0 4px 6px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.1)',
        }}
      >
        <span className="text-xs font-label text-hardware-label uppercase">
          {value ? 'ON' : 'OFF'}
        </span>
      </button>

      {/* Label */}
      <div className="font-label text-[9px] text-hardware-label uppercase tracking-wider text-center max-w-[60px]">
        {label}
      </div>
    </div>
  );
}
