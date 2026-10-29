'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { KnobSpec } from '@/types';
import type { KnobVariant, LabelPosition, ValueDisplay } from '@/types/panel';
import { valueToNorm, normToValue, formatValue, isValueOnTarget, describeValue } from '@/lib/controls/mapping';
import { knobTravelPx, markPointerEnter, wheelBelongsToControl, wheelDelta } from '@/lib/controls/gesture';
import { fitTransform, type TextFit } from '@/lib/controls/textFit';
import { useContinuousDrag } from './useContinuousDrag';
import ValueBubble from './ValueBubble';
import styles from './controlStyles';

export interface KnobProps {
  id: string;
  spec: KnobSpec;
  value: number;
  onChange: (value: number) => void;
  diameter?: number;          // px
  variant?: KnobVariant;
  capColor?: string;
  label?: LabelPosition;
  labelText?: string;
  labelColor?: string;
  valueDisplay?: ValueDisplay;
  highlighted?: boolean;
  targetValue?: number;
  showTarget?: boolean;
  // ---- optional, set by the panel ----
  /** Legend size/condense/truncation from the panel's legibility pass */
  labelFit?: TextFit;
  /** Readout font size from the panel's legibility pass */
  valueFit?: TextFit;
  /** Minimum hit area (px, same units as diameter) - touch targets bigger than the cap */
  hitSize?: number;
  /** Lesson spotlight: the step's target, or context the step points at */
  spot?: 'target' | 'focus' | null;
}

/**
 * Knob - anchor-based: the wrapper is exactly the knob circle, so positioning the
 * wrapper's centre positions the knob's centre. Labels/values are absolutely
 * positioned around it.
 *
 * Interaction (mouse, pen and touch via Pointer Events, pointer capture, no page scroll):
 *   drag up/down (mouse: or left/right)   adjust - travel scales with the knob's size
 *   Shift + drag                          fine adjust (desktop)
 *   touch: slide sideways away, a second  finer and finer (half, quarter, fine)
 *     finger off the controls, or hold
 *     still before dragging
 *   double-click / double-tap             reset to default
 *   wheel / trackpad                      adjust (a page scroll passing over it keeps scrolling)
 *   arrows (Shift = x10), PageUp/Down     step when focused; Home/End = min/max; Delete = default
 */
function Knob({
  id,
  spec,
  value,
  onChange,
  diameter = 42,
  variant = 'moog-silver',
  capColor,
  label = 'above',
  labelText,
  labelColor = '#ffffff',
  valueDisplay = 'always',
  highlighted = false,
  targetValue,
  showTarget = false,
  labelFit,
  valueFit,
  hitSize,
  spot,
}: KnobProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const enteredAt = useRef(-1);
  const latest = useRef({ spec, value, onChange });
  latest.current = { spec, value, onChange };

  const norm = valueToNorm(spec, value);
  const rotation = -135 + norm * 270;
  const onTarget = targetValue !== undefined && isValueOnTarget(spec, value, targetValue);
  const targetRotation = targetValue !== undefined ? -135 + valueToNorm(spec, targetValue) * 270 : undefined;
  const shownLabel = labelText ?? spec.label;

  const commitNorm = useCallback((n: number) => {
    const { spec: s, value: v, onChange: change } = latest.current;
    const next = normToValue(s, n);
    if (next !== v) change(next);
  }, []);

  const format = useCallback((n: number) => describeValue(latest.current.spec, normToValue(latest.current.spec, n)), []);

  const { dragging, bubble, flash, handlers } = useContinuousDrag({
    getNorm: () => valueToNorm(latest.current.spec, latest.current.value),
    commit: commitNorm,
    reset: () => { if (latest.current.value !== latest.current.spec.default) latest.current.onChange(latest.current.spec.default); },
    travelPx: () => {
      const r = rootRef.current?.getBoundingClientRect();
      return knobTravelPx(r ? r.width : diameter, latest.current.spec);
    },
    axis: 'knob',
    bounds: () => rootRef.current?.getBoundingClientRect() ?? null,
    format,
    label: shownLabel,
  });

  // Wheel / trackpad: needs a non-passive listener to keep the page from scrolling
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!wheelBelongsToControl(enteredAt.current)) return;
      const d = wheelDelta(e);
      if (!d) return;
      e.preventDefault();
      const { spec: s, value: v } = latest.current;
      const r = el.getBoundingClientRect();
      const fine = e.shiftKey || e.altKey;
      let n: number;
      if (s.step && (s.max - s.min) / s.step <= 64) {
        // Detented: one detent per wheel notch
        const next = Math.min(s.max, Math.max(s.min, v + Math.sign(d) * s.step));
        n = valueToNorm(s, next);
      } else {
        n = valueToNorm(s, v) + (d / (knobTravelPx(r.width, s) * 2)) * (fine ? 0.1 : 1);
      }
      commitNorm(Math.min(1, Math.max(0, n)));
      flash(Math.min(1, Math.max(0, n)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [commitNorm, flash]);

  const handleKey = (e: React.KeyboardEvent) => {
    const s = spec;
    const detents = s.step ? (s.max - s.min) / s.step : 0;
    const coarse = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown';
    const sign = e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'PageUp' ? 1
      : e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'PageDown' ? -1 : 0;
    let next: number | null = null;
    if (sign) {
      if (detents && detents <= 200) next = Math.min(s.max, Math.max(s.min, value + sign * s.step! * (coarse ? Math.max(1, Math.round(detents / 10)) : 1)));
      else next = normToValue(s, norm + sign * (coarse ? 0.1 : e.altKey ? 0.002 : 0.01));
    } else if (e.key === 'Home') next = s.min;
    else if (e.key === 'End') next = s.max;
    else if (e.key === 'Delete' || e.key === 'Backspace') next = s.default;
    if (next === null) return;
    e.preventDefault();
    if (next !== value) onChange(next);
    flash(valueToNorm(s, next));
  };

  const ringState = spot ? (spot === 'target' && onTarget ? 'done' : spot) : highlighted ? (onTarget ? 'done' : 'target') : null;
  const ringClass = ringState === 'done' ? styles.spotDone : ringState === 'target' ? styles.spotTarget : ringState === 'focus' ? styles.spotFocus : '';

  const labelSize = labelFit?.size ?? (diameter >= 50 ? 10 : diameter >= 36 ? 9 : diameter >= 26 ? 8 : 7);
  const showValue = valueDisplay === 'always' || (valueDisplay === 'hover' && (hovered || dragging));
  const valueAbove = valueDisplay === 'hover' && label !== 'above';
  const valueSize = valueFit?.size ?? (diameter >= 30 ? 9 : 8);
  const pad = hitSize && hitSize > diameter ? (hitSize - diameter) / 2 : 0;
  const placement = labelPlacement(label, variant === 'moog-silver' ? 2 : 4, valueSize);

  return (
    <div
      ref={rootRef}
      className={`relative select-none ${styles.control} ${styles.round}`}
      style={{ width: diameter, height: diameter, touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
      {...handlers}
      onPointerEnter={() => { enteredAt.current = markPointerEnter(); setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onKeyDown={handleKey}
      tabIndex={0}
      role="slider"
      aria-roledescription="knob"
      aria-label={shownLabel}
      aria-valuemin={spec.min}
      aria-valuemax={spec.max}
      aria-valuenow={value}
      aria-valuetext={describeValue(spec, value)}
      data-control={id}
      title={labelFit?.title ? `${labelFit.title}${spec.description ? `\n${spec.description}` : ''}` : spec.description}
    >
      {pad > 0 && <div className={styles.hit} style={{ inset: -pad, borderRadius: '50%' }} />}

      {label !== 'none' && shownLabel && (
        <div
          className="absolute text-center font-bold whitespace-pre pointer-events-none"
          style={{
            ...placement,
            transform: fitTransform(labelFit, placement.transform as string | undefined),
            fontSize: labelSize,
            color: labelFit?.color ?? labelColor,
            opacity: labelFit?.color ? 1 : 0.92,
            letterSpacing: '0.3px',
            lineHeight: 1.05,
          }}
        >
          {labelFit?.text ?? shownLabel}
        </div>
      )}

      {!spec.endless && <Ticks diameter={diameter} variant={variant} bipolar={!!spec.bipolar} />}

      {ringClass && <div className={`${styles.spot} ${ringClass}`} style={{ inset: -3 }} />}
      <div className="absolute inset-0 rounded-full">
        <Cap variant={variant} capColor={capColor} rotation={rotation} diameter={diameter} endless={!!spec.endless} />
      </div>

      {showTarget && highlighted && targetRotation !== undefined && !onTarget && (
        <div className="absolute inset-0 pointer-events-none" style={{ transform: `rotate(${targetRotation}deg)` }}>
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{ top: -7, width: 4, height: 9, background: '#f97316', boxShadow: '0 0 6px #f97316' }}
          />
        </div>
      )}

      {showValue && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 font-mono text-green-400 bg-black/90 px-1 py-px rounded text-center pointer-events-none whitespace-nowrap ${valueDisplay === 'hover' ? 'z-50 shadow-lg border border-green-900' : ''}`}
          style={{
            ...(valueAbove ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 3 }),
            fontSize: valueSize,
            lineHeight: 1.15,
            minWidth: Math.max(30, valueSize * 3.3),
            textShadow: '0 0 4px rgba(0,255,0,0.5)',
          }}
        >
          {formatValue(spec, value)}
        </div>
      )}

      {showTarget && highlighted && targetValue !== undefined && !onTarget && (
        <div
          className="absolute left-1/2 -translate-x-1/2 font-mono text-orange-400 font-bold whitespace-nowrap pointer-events-none bg-black/80 px-1 rounded z-40"
          style={{ top: '100%', marginTop: showValue && !valueAbove ? valueSize * 1.15 + 8 : 3, fontSize: Math.max(9, valueSize) }}
        >
          → {formatValue(spec, targetValue)}
        </div>
      )}
      <ValueBubble state={bubble} />
    </div>
  );
}

export default memo(Knob);

function labelPlacement(pos: LabelPosition, gap: number, valueSize: number): React.CSSProperties {
  switch (pos) {
    // Below the knob, under its value readout
    case 'below': return { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: gap + valueSize * 1.15 + 5 };
    case 'left': return { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: gap + 4, transformOrigin: 'right center' };
    case 'right': return { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: gap + 4, transformOrigin: 'left center' };
    default: return { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: gap };
  }
}

const Ticks = memo(function Ticks({ diameter, variant, bipolar }: { diameter: number; variant: KnobVariant; bipolar: boolean }) {
  const count = diameter >= 50 ? 11 : diameter >= 36 ? 9 : 7;
  const pad = variant === 'moog-silver' ? 6 : 5;
  const color = variant === 'xone' ? '#bbb' : variant === 'moog-silver' ? '#555' : '#9a9a9a';
  const end = variant === 'moog-silver' ? '#888' : '#ddd';
  return (
    <div className="absolute pointer-events-none" style={{ width: diameter + pad * 2, height: diameter + pad * 2, left: -pad, top: -pad }}>
      {Array.from({ length: count }, (_, i) => {
        const angle = -135 + (i * 270) / (count - 1);
        const isEnd = i === 0 || i === count - 1;
        const isCenter = i === Math.floor(count / 2);
        return (
          <div key={i} className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: 0,
                width: isEnd || (bipolar && isCenter) ? 2 : 1,
                height: isEnd ? 4 : isCenter ? 3 : 2,
                background: isEnd || (bipolar && isCenter) ? end : color,
                borderRadius: 1,
              }}
            />
          </div>
        );
      })}
    </div>
  );
});

const Cap = memo(function Cap({ variant, capColor, rotation, diameter, endless }: { variant: KnobVariant; capColor?: string; rotation: number; diameter: number; endless: boolean }) {
  const pointer = (style: React.CSSProperties) => (
    <div className="absolute inset-0 pointer-events-none" style={{ transform: `rotate(${rotation}deg)` }}>
      <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={style} />
    </div>
  );

  switch (variant) {
    case 'moog-black':
      return (
        <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 50% 40%, #2b2b2b 0%, #0c0c0c 70%)', boxShadow: '0 3px 6px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.12)', border: '1px solid #3a3a3a' }}>
          <div className="absolute rounded-full" style={{ inset: '16%', background: 'radial-gradient(circle at 40% 35%, #3a3a3a 0%, #151515 80%)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.08)' }} />
          {pointer({ top: '6%', width: Math.max(2, diameter * 0.06), height: diameter * 0.32, background: capColor ?? '#f2f2f2' })}
        </div>
      );
    case 'moog-large':
      return (
        <div className="absolute inset-0 rounded-full" style={{ background: 'repeating-conic-gradient(#1a1a1a 0deg 4deg, #2c2c2c 4deg 8deg)', boxShadow: '0 4px 8px rgba(0,0,0,0.7)', border: '1px solid #444' }}>
          <div className="absolute rounded-full" style={{ inset: '12%', background: 'radial-gradient(circle at 45% 35%, #3b3b3b 0%, #121212 75%)', boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.1), 0 0 0 1px #555' }} />
          {pointer({ top: '8%', width: Math.max(2, diameter * 0.05), height: diameter * 0.3, background: capColor ?? '#ffffff' })}
        </div>
      );
    case 'elektron':
      return (
        <div className="absolute inset-0 rounded-full" style={{ background: 'repeating-conic-gradient(#202020 0deg 6deg, #2e2e2e 6deg 12deg)', boxShadow: '0 3px 6px rgba(0,0,0,0.7)', border: '1px solid #4a4a4a' }}>
          <div className="absolute rounded-full" style={{ inset: '18%', background: 'radial-gradient(circle at 45% 35%, #4a4a4a 0%, #222 80%)' }} />
          {pointer({ top: '22%', width: Math.max(3, diameter * 0.1), height: Math.max(3, diameter * 0.1), background: capColor ?? (endless ? '#d0d0d0' : '#fff') })}
        </div>
      );
    case 'xone':
      return (
        <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 50% 40%, #555 0%, #2a2a2a 75%)', boxShadow: '0 3px 6px rgba(0,0,0,0.6)', border: '1px solid #666' }}>
          <div className="absolute rounded-full" style={{ inset: '22%', background: capColor ?? '#9a9a9a', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.35)' }} />
          {pointer({ top: '4%', width: Math.max(2, diameter * 0.07), height: diameter * 0.3, background: '#ffffff' })}
        </div>
      );
    case 'chicken':
      return (
        <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 45% 35%, #3a3a3a 0%, #111 80%)', boxShadow: '0 3px 6px rgba(0,0,0,0.6)' }}>
          <div className="absolute inset-0" style={{ transform: `rotate(${rotation}deg)` }}>
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '-4%', width: '34%', height: '60%', background: capColor ?? '#222', borderRadius: '50% 50% 20% 20%', border: '1px solid #555' }}>
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 2, width: 2, height: '45%', background: '#fff' }} />
            </div>
          </div>
        </div>
      );
    default:
      // DFAM silver
      return (
        <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(135deg, #888 0%, #444 50%, #666 100%)', padding: 2, boxShadow: '0 3px 6px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.2)' }}>
          <div className="w-full h-full rounded-full relative" style={{ background: 'radial-gradient(ellipse at 30% 30%, #ccc 0%, #999 30%, #666 70%, #444 100%)', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3)' }}>
            {pointer({ top: 3, width: 3, height: diameter * 0.28, background: capColor ?? '#000', boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.8)' })}
          </div>
        </div>
      );
  }
});
