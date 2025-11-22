'use client';

import { useState, useRef, useEffect } from 'react';
import type { KnobProps } from '@/types';

export default function Knob({
  id,
  value,
  min,
  max,
  defaultValue,
  bipolar = false,
  units = '%',
  size = 'medium',
  label,
  position,
  onChange,
  highlighted = false,
  targetValue,
  isCorrect = false,
  showTarget = false,
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(value);
  const knobRef = useRef<HTMLDivElement>(null);

  // Calculate rotation angle (-135deg to +135deg, 270deg total range)
  const valueToRotation = (val: number): number => {
    const normalized = (val - min) / (max - min);
    return -135 + normalized * 270;
  };

  const rotation = valueToRotation(value);
  const targetRotation = targetValue !== undefined ? valueToRotation(targetValue) : undefined;

  // Size classes
  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-16 h-16',
    large: 'w-20 h-20',
  };

  const labelSizeClasses = {
    small: 'text-[9px]',
    medium: 'text-[10px]',
    large: 'text-[11px]',
  };

  const valueSizeClasses = {
    small: 'text-[11px]',
    medium: 'text-[13px]',
    large: 'text-[14px]',
  };

  // Format display value
  const formatValue = (val: number): string => {
    if (bipolar && val === 0) return '0';
    if (bipolar && val > 0) return `+${val.toFixed(1)}`;
    if (bipolar) return val.toFixed(1);

    if (units === 'Hz') {
      if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
      return val.toFixed(0);
    }
    if (units === 'ms') {
      if (val >= 1000) return `${(val / 1000).toFixed(1)}s`;
      return val.toFixed(0);
    }
    if (units === 'octaves' || units === 'semitones') {
      return bipolar ? (val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)) : val.toFixed(1);
    }

    return Math.round(val).toString();
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
  }, [isDragging, startY, startValue, min, max, onChange]);

  // Check if value is close to target (5% tolerance)
  const isCloseToTarget = targetValue !== undefined && Math.abs(value - targetValue) <= Math.abs(max - min) * 0.05;

  // Determine teaching class
  const getTeachingClass = () => {
    if (!highlighted) return '';
    if (isCorrect || isCloseToTarget) return 'teaching-correct';
    if (showTarget && targetValue !== undefined) {
      return value < targetValue ? 'teaching-current' : 'teaching-wrong';
    }
    return 'teaching-current';
  };

  return (
    <div
      className="flex flex-col items-center gap-1 select-none"
      style={position ? { position: 'absolute', left: position.x, top: position.y } : {}}
    >
      {/* Label */}
      <div className={`font-label text-hardware-label uppercase tracking-wider text-center ${labelSizeClasses[size]}`}>
        {label}
      </div>

      {/* Knob */}
      <div
        ref={knobRef}
        className={`relative ${sizeClasses[size]} cursor-pointer ${getTeachingClass()}`}
        onMouseDown={handleMouseDown}
      >
        {/* Knob body */}
        <div
          className="w-full h-full rounded-full bg-gradient-to-b from-hardware-panel to-[#1a1a1a] shadow-lg border-2 border-[#3a3a3a]"
          style={{
            boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.1)',
          }}
        >
          {/* Indicator line */}
          <div
            className="absolute w-full h-full knob-rotate"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div className="absolute top-1 left-1/2 w-0.5 h-3 bg-hardware-led-on transform -translate-x-1/2 rounded-full shadow-lg"
                 style={{ boxShadow: '0 0 4px rgba(0,255,0,0.8)' }} />
          </div>

          {/* Target indicator (if teaching mode) */}
          {showTarget && targetRotation !== undefined && (
            <div
              className="absolute w-full h-full"
              style={{ transform: `rotate(${targetRotation}deg)` }}
            >
              <div className="absolute top-0 left-1/2 w-1 h-2 bg-teaching-target transform -translate-x-1/2 rounded-full opacity-70" />
            </div>
          )}

          {/* Center dot */}
          {bipolar && (
            <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-hardware-label rounded-full transform -translate-x-1/2 -translate-y-1/2" />
          )}
        </div>
      </div>

      {/* Value display */}
      <div className={`font-mono ${valueSizeClasses[size]} bg-black text-teaching-current px-2 py-0.5 rounded border border-[#1a1a1a] min-w-[48px] text-center`}
           style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,255,0,0.2)' }}>
        {formatValue(value)}
        <span className="text-hardware-label ml-0.5 text-[9px]">{units}</span>
      </div>

      {/* Target value (if teaching mode) */}
      {showTarget && targetValue !== undefined && !isCloseToTarget && (
        <div className="text-[9px] text-teaching-target font-mono">
          → {formatValue(targetValue)}{units}
        </div>
      )}
    </div>
  );
}
