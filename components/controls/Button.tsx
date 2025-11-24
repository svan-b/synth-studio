'use client';

import type { ButtonSpec } from '@/types';

export interface ButtonProps {
  id: string;
  spec: ButtonSpec;
  value: boolean;
  onChange: (value: boolean) => void;
  highlighted?: boolean;
}

export default function Button({
  id,
  spec,
  value,
  onChange,
  highlighted = false,
}: ButtonProps) {
  const { label, momentary = false, ledColor = '#00ff00' } = spec;

  const handleClick = () => {
    if (momentary) {
      // Fire and release
      onChange(true);
      setTimeout(() => onChange(false), 100);
    } else {
      // Toggle
      onChange(!value);
    }
  };

  const getTeachingClass = () => {
    if (!highlighted) return '';
    return 'ring-2 ring-orange-500 ring-opacity-80 animate-pulse';
  };

  // Determine button color based on state and ledColor
  const getButtonStyle = () => {
    const isRed = ledColor === '#ff0000' || ledColor === 'red';

    if (value) {
      return {
        background: ledColor,
        boxShadow: `0 0 12px ${ledColor}, inset 0 -2px 4px rgba(0,0,0,0.3)`,
      };
    }

    return {
      background: isRed ? '#400000' : '#004000',
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
    };
  };

  return (
    <div
      className={`flex flex-col items-center gap-1.5 select-none ${getTeachingClass()}`}
      title={spec.description}
    >
      {/* Label */}
      <div className="font-label text-[8px] text-hardware-label uppercase tracking-wider text-center max-w-[60px] leading-tight">
        {label}
      </div>

      {/* Button */}
      <button
        onClick={handleClick}
        className="relative w-8 h-8 rounded-full border-2 border-[#3a3a3a] transition-all active:scale-95 hover:brightness-110"
        style={getButtonStyle()}
      >
        {/* LED glow when active */}
        {value && !momentary && (
          <div
            className="absolute inset-1 rounded-full"
            style={{
              background: `radial-gradient(circle, ${ledColor}88 0%, transparent 70%)`,
            }}
          />
        )}
      </button>

      {/* State indicator for toggle buttons */}
      {!momentary && (
        <div className="font-mono text-[9px] text-hardware-label">
          {value ? 'ON' : 'OFF'}
        </div>
      )}
    </div>
  );
}
