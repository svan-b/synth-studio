'use client';

import type { ButtonSpec } from '@/types';

export interface ButtonProps {
  id: string;
  spec: ButtonSpec;
  value: boolean;
  onChange: (value: boolean) => void;
  highlighted?: boolean;
}

/**
 * Button Component - Anchor-Based Positioning
 *
 * The wrapper div is exactly the size of the button circle (32x32px).
 * This means when you position this component, the CENTER of the wrapper
 * is the CENTER of the button. Labels are absolutely positioned relative
 * to the button, not stacked in a flex column.
 */
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
    // Wrapper is exactly 32x32 - the button circle size
    // Position this wrapper at center, and the button will be centered
    <div
      className={`relative w-8 h-8 select-none ${getTeachingClass()}`}
      title={spec.description}
    >
      {/* Label - positioned absolutely above the button */}
      <div
        className="absolute left-1/2 -translate-x-1/2 font-label text-[8px] text-hardware-label uppercase tracking-wider text-center whitespace-nowrap"
        style={{ bottom: '100%', marginBottom: '4px' }}
      >
        {label}
      </div>

      {/* Button - fills the wrapper */}
      <button
        onClick={handleClick}
        className="absolute inset-0 rounded-full border-2 border-[#3a3a3a] transition-all active:scale-95 hover:brightness-110"
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
    </div>
  );
}
