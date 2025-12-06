'use client';

import type { ButtonSpec } from '@/types';

export interface ButtonProps {
  id: string;
  spec: ButtonSpec;
  value: boolean;
  onChange: (value: boolean) => void;
  highlighted?: boolean;
  labelPosition?: 'above' | 'below' | 'left' | 'right' | 'none';
  size?: 'small' | 'medium' | 'large';
}

/**
 * Button Component - Anchor-Based Positioning
 *
 * The wrapper div is exactly the size of the button circle.
 * This means when you position this component, the CENTER of the wrapper
 * is the CENTER of the button. Labels are absolutely positioned relative
 * to the button based on labelPosition prop.
 */
export default function Button({
  id,
  spec,
  value,
  onChange,
  highlighted = false,
  labelPosition = 'above',
  size = 'medium',
}: ButtonProps) {
  const { label, momentary = false, ledColor = '#00ff00' } = spec;

  // Button sizes in pixels
  const sizePx = {
    small: 24,
    medium: 32,
    large: 40,
  };

  const currentSize = sizePx[size];

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

  // Get label positioning styles based on labelPosition
  const getLabelStyle = (): React.CSSProperties => {
    switch (labelPosition) {
      case 'above':
        return { bottom: '100%', marginBottom: '4px', left: '50%', transform: 'translateX(-50%)' };
      case 'below':
        return { top: '100%', marginTop: '4px', left: '50%', transform: 'translateX(-50%)' };
      case 'left':
        return { right: '100%', marginRight: '6px', top: '50%', transform: 'translateY(-50%)' };
      case 'right':
        return { left: '100%', marginLeft: '6px', top: '50%', transform: 'translateY(-50%)' };
      default:
        return {};
    }
  };

  return (
    // Wrapper is exactly the button size
    <div
      className={`relative select-none ${getTeachingClass()}`}
      style={{ width: currentSize, height: currentSize }}
      title={spec.description}
    >
      {/* Label - positioned based on labelPosition prop */}
      {labelPosition !== 'none' && (
        <div
          className="absolute font-label text-[8px] text-hardware-label uppercase tracking-wider whitespace-nowrap"
          style={getLabelStyle()}
        >
          {label}
        </div>
      )}

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
