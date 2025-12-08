'use client';

import { useState, useRef, useEffect } from 'react';
import type { KnobSpec, Units } from '@/types';

export interface KnobProps {
  id: string;
  spec: KnobSpec;
  value: number;
  onChange: (value: number) => void;
  highlighted?: boolean;
  targetValue?: number;
  showTarget?: boolean;
  showLabel?: boolean;  // Whether to show label above knob
  showValueOnHover?: boolean;  // Only show value on hover (for sequencer knobs)
}

/**
 * Knob Component - Anchor-Based Positioning
 *
 * The wrapper div is exactly the size of the knob circle (28/42/56px).
 * This means when you position this component, the CENTER of the wrapper
 * is the CENTER of the knob. Labels and value displays are absolutely
 * positioned relative to the knob, not stacked in a flex column.
 */
export default function Knob({
  id,
  spec,
  value,
  onChange,
  highlighted = false,
  targetValue,
  showTarget = false,
  showLabel = false,
  showValueOnHover = false,
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(value);
  const knobRef = useRef<HTMLDivElement>(null);

  const { min, max, bipolar = false, units = '%', size = 'medium', label } = spec;

  // Calculate rotation angle (-135deg to +135deg, 270deg total range)
  const valueToRotation = (val: number): number => {
    const normalized = (val - min) / (max - min);
    return -135 + normalized * 270;
  };

  const rotation = valueToRotation(value);
  const targetRotation = targetValue !== undefined ? valueToRotation(targetValue) : undefined;

  // Size in pixels - matching DFAM hardware proportions
  const sizePx = {
    small: 28,
    medium: 42,
    large: 56,
  };

  // Format display value
  const formatValue = (val: number, units: Units): string => {
    if (bipolar && val === 0) return '0';

    if (units === 'Hz') {
      if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
      return val.toFixed(0);
    }
    if (units === 'ms') {
      if (val >= 1000) return `${(val / 1000).toFixed(1)}s`;
      return val.toFixed(0);
    }
    if (units === 'BPM') {
      if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
      return val.toFixed(0);
    }
    if (units === 'octaves' || units === 'V') {
      const formatted = val.toFixed(1);
      return bipolar && val > 0 ? `+${formatted}` : formatted;
    }
    if (units === '%') {
      return Math.round(val).toString();
    }

    return bipolar && val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
  };

  // Mouse drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setStartValue(value);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaY = startY - e.clientY;
      const sensitivity = 0.5;
      const range = max - min;
      const delta = (deltaY * sensitivity * range) / 100;

      let newValue = startValue + delta;
      newValue = Math.max(min, Math.min(max, newValue));

      // Snap to step if defined
      if (spec.step) {
        newValue = Math.round(newValue / spec.step) * spec.step;
      }

      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startY, startValue, min, max, spec.step, onChange]);

  // Check if value is close to target (5% tolerance)
  const tolerance = Math.abs(max - min) * 0.05;
  const isCloseToTarget = targetValue !== undefined && Math.abs(value - targetValue) <= tolerance;

  // Determine teaching class
  const getTeachingClass = () => {
    if (!highlighted) return '';
    if (isCloseToTarget) return 'ring-2 ring-green-500 ring-opacity-80';
    return 'ring-2 ring-orange-500 ring-opacity-80 animate-pulse';
  };

  const currentPx = sizePx[size];

  // Determine if value should be visible
  // For hover-only mode: show when hovered or dragging
  // Otherwise: always show
  const shouldShowValue = showValueOnHover ? (isHovered || isDragging) : true;

  // Generate tick marks around the knob (from -135° to +135°, 270° range)
  // More ticks for larger knobs
  const tickCount = size === 'large' ? 11 : size === 'medium' ? 9 : 7;
  const tickMarks = Array.from({ length: tickCount }, (_, i) => {
    const angle = -135 + (i * 270) / (tickCount - 1);
    return angle;
  });

  return (
    // Wrapper is exactly the knob size - position this at center
    <div
      ref={knobRef}
      className={`relative cursor-pointer select-none ${getTeachingClass()}`}
      style={{ width: currentPx, height: currentPx }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={spec.description}
    >
      {/* Label - positioned absolutely above the knob */}
      {showLabel && label && (
        <div
          className="absolute left-1/2 -translate-x-1/2 text-center text-white font-bold whitespace-nowrap"
          style={{
            bottom: '100%',
            marginBottom: '2px',
            fontSize: size === 'large' ? '7px' : '6px',
            opacity: 0.9,
          }}
        >
          {label}
        </div>
      )}

      {/* Tick marks around the knob edge */}
      <div
        className="absolute"
        style={{
          width: currentPx + 12,
          height: currentPx + 12,
          left: -6,
          top: -6,
        }}
      >
        {tickMarks.map((angle, i) => {
          const isEndTick = i === 0 || i === tickCount - 1;
          const isCenterTick = i === Math.floor(tickCount / 2);
          return (
            <div
              key={angle}
              className="absolute"
              style={{
                width: '100%',
                height: '100%',
                transform: `rotate(${angle}deg)`,
              }}
            >
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  top: 0,
                  width: isEndTick || isCenterTick ? '2px' : '1px',
                  height: isEndTick ? '4px' : isCenterTick ? '3px' : '2px',
                  background: isEndTick ? '#888' : '#555',
                  borderRadius: '1px',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Knob - DFAM style silver metallic */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'linear-gradient(135deg, #888 0%, #444 50%, #666 100%)',
          padding: '2px',
          boxShadow: '0 3px 6px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.2)',
        }}
      >
        {/* Main knob body - silver metallic */}
        <div
          className="w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(ellipse at 30% 30%, #ccc 0%, #999 30%, #666 70%, #444 100%)',
            boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3)',
          }}
        >
          {/* Indicator line */}
          <div
            className="absolute w-full h-full transition-transform duration-50"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div
              className="absolute left-1/2 bg-black rounded-full transform -translate-x-1/2"
              style={{
                top: '3px',
                width: '3px',
                height: `${currentPx * 0.28}px`,
                boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.8)',
              }}
            />
          </div>

          {/* Target indicator (if teaching mode) */}
          {showTarget && targetRotation !== undefined && !isCloseToTarget && (
            <div
              className="absolute w-full h-full opacity-60"
              style={{ transform: `rotate(${targetRotation}deg)` }}
            >
              <div
                className="absolute top-0 left-1/2 w-1 h-3 bg-orange-500 transform -translate-x-1/2 rounded-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* Value display - positioned below knob normally, ABOVE knob for hover-only mode */}
      {shouldShowValue && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 font-mono text-[9px] text-green-400 bg-black/90 px-1 py-0.5 rounded min-w-[32px] text-center ${showValueOnHover ? 'z-50 shadow-lg border border-green-900' : ''}`}
          style={showValueOnHover ? {
            // For hover mode: show ABOVE the knob to avoid LED overlap
            bottom: '100%',
            marginBottom: '4px',
            textShadow: '0 0 4px rgba(0,255,0,0.5)',
          } : {
            // Normal mode: show below
            top: '100%',
            marginTop: '2px',
            textShadow: '0 0 4px rgba(0,255,0,0.5)',
          }}
        >
          {formatValue(value, units)}
        </div>
      )}

      {/* Target value hint (if teaching mode) */}
      {showTarget && targetValue !== undefined && !isCloseToTarget && (
        <div
          className="absolute left-1/2 -translate-x-1/2 text-[7px] text-orange-400 font-mono"
          style={{ top: '100%', marginTop: '18px' }}
        >
          → {formatValue(targetValue, units)}
        </div>
      )}
    </div>
  );
}
