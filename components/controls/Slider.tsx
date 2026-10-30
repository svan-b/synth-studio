'use client';

import { memo, useCallback, useEffect, useRef } from 'react';
import type { SliderSpec } from '@/types';
import type { LabelPosition, ValueDisplay } from '@/types/panel';
import { valueToNorm, normToValue, formatValue, isValueOnTarget, describeValue } from '@/lib/controls/mapping';
import { markPointerEnter, wheelBelongsToControl, wheelDelta } from '@/lib/controls/gesture';
import { fitTransform, type TextFit } from '@/lib/controls/textFit';
import { useContinuousDrag } from './useContinuousDrag';
import ValueBubble from './ValueBubble';
import styles from './controlStyles';

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
  // ---- optional, set by the panel ----
  labelFit?: TextFit;
  valueFit?: TextFit;
  /** Minimum thickness of the touch area (px) */
  hitSize?: number;
  spot?: 'target' | 'focus' | null;
}

/**
 * Fader / crossfader, anchored at its centre.
 *   drag the cap (or anywhere on the fader on touch) - it moves with your finger, it never jumps
 *   mouse: click the track to jump there, then drag
 *   Shift (desktop) / slide off to the side or hold still first (touch) - fine adjust
 *   double-tap - reset; wheel, arrows, PageUp/Down, Home/End when focused
 */
function Slider({
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
  labelFit,
  valueFit,
  hitSize,
  spot,
}: SliderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const enteredAt = useRef(-1);
  const latest = useRef({ spec, value, onChange });
  latest.current = { spec, value, onChange };
  const vertical = orientation === 'vertical';
  const norm = valueToNorm(spec, value);
  const onTarget = targetValue !== undefined && isValueOnTarget(spec, value, targetValue);
  const thickness = 30;
  const capLong = 22;
  const capShort = 36;
  const shownLabel = labelText ?? spec.label;

  const commitNorm = useCallback((n: number) => {
    const { spec: s, value: v, onChange: change } = latest.current;
    const next = normToValue(s, n);
    if (next !== v) change(next);
  }, []);

  const normAt = (clientX: number, clientY: number): number | null => {
    const el = trackRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return vertical ? 1 - (clientY - r.top) / r.height : (clientX - r.left) / r.width;
  };

  const { dragging, bubble, flash, handlers } = useContinuousDrag({
    getNorm: () => valueToNorm(latest.current.spec, latest.current.value),
    commit: commitNorm,
    reset: () => { if (latest.current.value !== latest.current.spec.default) latest.current.onChange(latest.current.spec.default); },
    // 1:1 with the finger: full travel = the fader's length on screen
    travelPx: () => {
      const r = trackRef.current?.getBoundingClientRect();
      return r ? (vertical ? r.height : r.width) : length;
    },
    axis: vertical ? 'vertical' : 'horizontal',
    bounds: () => rootRef.current?.getBoundingClientRect() ?? null,
    format: n => describeValue(latest.current.spec, normToValue(latest.current.spec, n)),
    label: shownLabel,
    // Mouse: a click on the track away from the cap jumps there
    jumpTo: (x, y) => {
      const n = normAt(x, y);
      if (n === null) return null;
      const cur = valueToNorm(latest.current.spec, latest.current.value);
      const r = trackRef.current!.getBoundingClientRect();
      const px = Math.abs(n - cur) * (vertical ? r.height : r.width);
      return px > capLong * 0.6 ? Math.min(1, Math.max(0, n)) : null;
    },
  });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!wheelBelongsToControl(enteredAt.current)) return;
      const d = wheelDelta(e);
      if (!d) return;
      e.preventDefault();
      const { spec: s, value: v } = latest.current;
      const r = trackRef.current?.getBoundingClientRect();
      const travel = r ? (vertical ? r.height : r.width) : length;
      const n = Math.min(1, Math.max(0, valueToNorm(s, v) + (d / (travel * 2.5)) * (e.shiftKey || e.altKey ? 0.1 : 1)));
      commitNorm(n);
      flash(n);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [commitNorm, flash, vertical, length]);

  const handleKey = (e: React.KeyboardEvent) => {
    const coarse = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown';
    const sign = e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'PageUp' ? 1
      : e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'PageDown' ? -1 : 0;
    let next: number | null = null;
    if (sign) next = spec.step && (spec.max - spec.min) / spec.step <= 200
      ? Math.min(spec.max, Math.max(spec.min, value + sign * spec.step * (coarse ? 10 : 1)))
      : normToValue(spec, norm + sign * (coarse ? 0.1 : e.altKey ? 0.002 : 0.01));
    else if (e.key === 'Home') next = spec.min;
    else if (e.key === 'End') next = spec.max;
    else if (e.key === 'Delete' || e.key === 'Backspace') next = spec.default;
    if (next === null) return;
    e.preventDefault();
    if (next !== value) onChange(next);
    flash(valueToNorm(spec, next));
  };

  const w = vertical ? thickness : length + capLong;
  const h = vertical ? length + capLong : thickness;
  const ringState = spot ? (spot === 'target' && onTarget ? 'done' : spot) : highlighted ? (onTarget ? 'done' : 'target') : null;
  const ringClass = ringState === 'done' ? styles.spotDone : ringState === 'target' ? styles.spotTarget : ringState === 'focus' ? styles.spotFocus : '';
  const pos = norm * length;
  const targetPos = targetValue !== undefined ? valueToNorm(spec, targetValue) * length : undefined;
  const showValue = valueDisplay === 'always' || (valueDisplay === 'hover' && dragging);
  const hitPad = hitSize && hitSize > thickness ? (hitSize - thickness) / 2 : 0;
  const labelPos: React.CSSProperties = label === 'below'
    ? { top: '100%', marginTop: 4, left: '50%', transform: 'translateX(-50%)' }
    : label === 'left'
    ? { right: '100%', marginRight: 6, top: '50%', transform: 'translateY(-50%)', transformOrigin: 'right center' }
    : label === 'right'
    ? { left: '100%', marginLeft: 6, top: '50%', transform: 'translateY(-50%)', transformOrigin: 'left center' }
    : { bottom: '100%', marginBottom: 4, left: '50%', transform: 'translateX(-50%)' };

  return (
    <div
      ref={rootRef}
      className={`relative select-none ${styles.control}`}
      style={{ width: w, height: h, touchAction: 'none', borderRadius: 6, cursor: dragging ? 'grabbing' : 'grab' }}
      {...handlers}
      onPointerEnter={() => { enteredAt.current = markPointerEnter(); }}
      onKeyDown={handleKey}
      data-control={id}
      title={labelFit?.title ? `${labelFit.title}${spec.description ? `\n${spec.description}` : ''}` : spec.description}
      tabIndex={0}
      role="slider"
      aria-label={shownLabel}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-valuemin={spec.min}
      aria-valuemax={spec.max}
      aria-valuenow={value}
      aria-valuetext={describeValue(spec, value)}
    >
      {hitPad > 0 && <div className={styles.hit} style={vertical ? { top: 0, bottom: 0, left: -hitPad, right: -hitPad } : { left: 0, right: 0, top: -hitPad, bottom: -hitPad }} />}
      {ringClass && <div className={`${styles.spot} ${ringClass}`} style={{ inset: -2, borderRadius: 8 }} />}
      {label !== 'none' && shownLabel && (
        <div
          className="absolute whitespace-pre font-bold text-center pointer-events-none leading-none"
          style={{
            ...labelPos,
            transform: fitTransform(labelFit, labelPos.transform as string | undefined),
            fontSize: labelFit?.size ?? 9,
            color: labelFit?.color ?? labelColor,
          }}
        >
          {labelFit?.text ?? shownLabel}
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
        <div className="absolute left-1/2 -translate-x-1/2 font-mono text-green-400 bg-black/90 px-1 rounded z-50 pointer-events-none whitespace-nowrap" style={{ top: '100%', marginTop: 3, fontSize: valueFit?.size ?? 9 }}>
          {formatValue(spec, value)}
        </div>
      )}
      <ValueBubble state={bubble} />
    </div>
  );
}

export default memo(Slider);
