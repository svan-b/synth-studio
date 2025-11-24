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
}

export default function Knob({
  id,
  spec,
  value,
  onChange,
  highlighted = false,
  targetValue,
  showTarget = false,
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
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

  // Size classes
  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-14 h-14',
    large: 'w-18 h-18',
  };

  const sizePx = {
    small: 40,
    medium: 56,
    large: 72,
  };

  const labelSizeClasses = {
    small: 'text-[8px]',
    medium: 'text-[9px]',
    large: 'text-[10px]',
  };

  const valueSizeClasses = {
    small: 'text-[10px]',
    medium: 'text-[11px]',
    large: 'text-[12px]',
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

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* Label */}
      <div className={`font-label text-hardware-label uppercase tracking-wider text-center leading-tight ${labelSizeClasses[size]}`}>
        {label}
      </div>

      {/* Knob */}
      <div
        ref={knobRef}
        className={`relative cursor-pointer rounded-full ${getTeachingClass()}`}
        style={{ width: currentPx, height: currentPx }}
        onMouseDown={handleMouseDown}
        title={spec.description}
      >
        {/* Knob body */}
        <div
          className="w-full h-full rounded-full bg-gradient-to-b from-hardware-panel to-[#1a1a1a] border-2 border-[#3a3a3a]"
          style={{
            boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.1)',
          }}
        >
          {/* Indicator line */}
          <div
            className="absolute w-full h-full transition-transform duration-50"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div
              className="absolute top-1 left-1/2 w-0.5 bg-hardware-led-on transform -translate-x-1/2 rounded-full"
              style={{
                height: `${currentPx * 0.25}px`,
                boxShadow: '0 0 4px rgba(0,255,0,0.8)'
              }}
            />
          </div>

          {/* Target indicator (if teaching mode) */}
          {showTarget && targetRotation !== undefined && !isCloseToTarget && (
            <div
              className="absolute w-full h-full"
              style={{ transform: `rotate(${targetRotation}deg)` }}
            >
              <div className="absolute top-0 left-1/2 w-1 h-2 bg-teaching-target transform -translate-x-1/2 rounded-full opacity-70" />
            </div>
          )}

          {/* Center dot for bipolar */}
          {bipolar && (
            <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-hardware-label rounded-full transform -translate-x-1/2 -translate-y-1/2" />
          )}
        </div>
      </div>

      {/* Value display */}
      <div
        className={`font-mono ${valueSizeClasses[size]} bg-black text-green-400 px-1.5 py-0.5 rounded border border-[#1a1a1a] min-w-[40px] text-center`}
        style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 6px rgba(0,255,0,0.15)' }}
      >
        {formatValue(value, units)}
        <span className="text-hardware-label ml-0.5 text-[8px]">{units}</span>
      </div>

      {/* Target value hint (if teaching mode) */}
      {showTarget && targetValue !== undefined && !isCloseToTarget && (
        <div className="text-[8px] text-teaching-target font-mono">
          → {formatValue(targetValue, units)}{units}
        </div>
      )}
    </div>
  );
}
