'use client';

import { useRef, useState } from 'react';
import type { SliderSpec } from '@/types';
import type { LabelPosition, ValueDisplay } from '@/types/panel';
import { valueToNorm, normToValue, formatValue, isValueOnTarget } from '@/lib/controls/mapping';

export interface SliderProps {
  id: string;
  spec: SliderSpec;
  value: number;
  onChange: (value: number) => void;
  length: number;                 // px of travel
  orientation?: 'vertical' | 'horizontal';
  capColor?: string;
  label?: LabelPosition;
  labelText?: string;
  labelColor?: string;
  valueDisplay?: ValueDisplay;
  highlighted?: boolean;
  targetValue?: number;
}

const DOUBLE_TAP_MS = 320;

/**
 * Fader / crossfader. Anchored at its centre. Grab the cap or tap anywhere on the
 * track to jump; double-tap resets to default.
 */
export default function Slider({
  id,
  spec,
  value,
  onChange,
  length,
  orientation = 'vertical',
  capColor = '#d8d8d8',
  label = 'above',
  labelText,
  labelColor = '#fff',
  valueDisplay = 'hover',
  highlighted = false,
  targetValue,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const lastTap = useRef(0);
  const vertical = orientation === 'vertical';
  const norm = valueToNorm(spec, value);
  const onTarget = targetValue !== undefined && isValueOnTarget(spec, value, targetValue);
  const thickness = 30;
  const capLong = 22;
  const capShort = 36;

  const fromPointer = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const n = vertical ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    const v = normToValue(spec, n);
    if (v !== value) onChange(v);
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const now = performance.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      onChange(spec.default);
      return;
    }
    lastTap.current = now;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    fromPointer(e);
  };
  const move = (e: React.PointerEvent) => { if (dragging) fromPointer(e); };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const w = vertical ? thickness : length + capLong;
  const h = vertical ? length + capLong : thickness;
  const ring = highlighted ? (onTarget ? '0 0 0 3px rgba(34,197,94,0.9)' : '0 0 0 3px rgba(249,115,22,0.95)') : undefined;
  const pos = norm * length;
  const targetPos = targetValue !== undefined ? valueToNorm(spec, targetValue) * length : undefined;
  const shownLabel = labelText ?? spec.label;
  const showValue = valueDisplay === 'always' || (valueDisplay === 'hover' && dragging);

  return (
    <div
      className={`relative select-none ${highlighted && !onTarget ? 'animate-pulse' : ''}`}
      style={{ width: w, height: h, touchAction: 'none', borderRadius: 6, boxShadow: ring }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      data-control={id}
      title={spec.description}
      role="slider"
      aria-label={shownLabel}
      aria-valuenow={value}
    >
      {label !== 'none' && shownLabel && (
        <div
          className="absolute whitespace-nowrap font-bold text-center pointer-events-none"
          style={{
            ...(label === 'below'
              ? { top: '100%', marginTop: 4, left: '50%', transform: 'translateX(-50%)' }
              : label === 'left'
              ? { right: '100%', marginRight: 6, top: '50%', transform: 'translateY(-50%)' }
              : { bottom: '100%', marginBottom: 4, left: '50%', transform: 'translateX(-50%)' }),
            fontSize: 9,
            color: labelColor,
          }}
        >
          {shownLabel}
        </div>
      )}
      {/* Track */}
      <div
        ref={trackRef}
        className="absolute rounded-full"
        style={
          vertical
            ? { left: thickness / 2 - 2, top: capLong / 2, width: 4, height: length, background: '#050505', boxShadow: 'inset 0 1px 2px #000, 0 0 0 1px #333' }
            : { top: thickness / 2 - 2, left: capLong / 2, height: 4, width: length, background: '#050505', boxShadow: 'inset 0 1px 2px #000, 0 0 0 1px #333' }
        }
      />
      {/* Scale marks */}
      {Array.from({ length: 11 }, (_, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={
            vertical
              ? { left: 2, top: capLong / 2 + (i * length) / 10, width: 6, height: 1, background: i === 0 || i === 10 || i === 5 ? '#aaa' : '#555' }
              : { top: 2, left: capLong / 2 + (i * length) / 10, height: 6, width: 1, background: i === 0 || i === 10 || i === 5 ? '#aaa' : '#555' }
          }
        />
      ))}
      {targetPos !== undefined && highlighted && !onTarget && (
        <div
          className="absolute pointer-events-none"
          style={
            vertical
              ? { left: 0, width: thickness, top: capLong / 2 + (length - targetPos) - 1, height: 2, background: '#f97316', boxShadow: '0 0 6px #f97316' }
              : { top: 0, height: thickness, left: capLong / 2 + targetPos - 1, width: 2, background: '#f97316', boxShadow: '0 0 6px #f97316' }
          }
        />
      )}
      {/* Cap */}
      <div
        className="absolute rounded-sm pointer-events-none"
        style={{
          ...(vertical
            ? { left: (thickness - capShort) / 2, width: capShort, height: capLong, top: length - pos }
            : { top: (thickness - capShort) / 2, height: capShort, width: capLong, left: pos }),
          background: `linear-gradient(${vertical ? '180deg' : '90deg'}, ${capColor} 0%, #777 45%, #333 50%, #777 55%, ${capColor} 100%)`,
          boxShadow: '0 3px 5px rgba(0,0,0,0.7)',
          border: '1px solid #222',
        }}
      />
      {showValue && (
        <div className="absolute left-1/2 -translate-x-1/2 font-mono text-[9px] text-green-400 bg-black/90 px-1 rounded z-50 pointer-events-none" style={{ top: '100%', marginTop: 3 }}>
          {formatValue(spec, value)}
        </div>
      )}
    </div>
  );
}
