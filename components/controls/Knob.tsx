'use client';

import { useRef, useState, useCallback } from 'react';
import type { KnobSpec } from '@/types';
import type { KnobVariant, LabelPosition, ValueDisplay } from '@/types/panel';
import { valueToNorm, normToValue, formatValue, isValueOnTarget } from '@/lib/controls/mapping';

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
}

const DRAG_PX_FULL_TRAVEL = 220;   // pixels of drag for the full 270° sweep
const DOUBLE_TAP_MS = 320;

/**
 * Knob - anchor-based: the wrapper is exactly the knob circle, so positioning the
 * wrapper's centre positions the knob's centre. Labels/values are absolutely
 * positioned around it.
 *
 * Interaction (mouse, pen and touch via Pointer Events):
 *   drag up/down (or right/left)   adjust
 *   Shift + drag                   fine adjust
 *   double-click / double-tap      reset to default
 *   arrow keys (when focused)      nudge, Shift for bigger steps
 */
export default function Knob({
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
}: KnobProps) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const drag = useRef<{ x: number; y: number; norm: number; moved: boolean; pointer: number } | null>(null);
  const lastTap = useRef(0);

  const norm = valueToNorm(spec, value);
  const rotation = -135 + norm * 270;
  const onTarget = targetValue !== undefined && isValueOnTarget(spec, value, targetValue);
  const targetRotation = targetValue !== undefined ? -135 + valueToNorm(spec, targetValue) * 270 : undefined;

  const commit = useCallback((n: number) => {
    const v = normToValue(spec, n);
    if (v !== value) onChange(v);
  }, [spec, value, onChange]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      onChange(spec.default);
      return;
    }
    lastTap.current = now;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, norm, moved: false, pointer: e.pointerId };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const dy = d.y - e.clientY;
    const dx = e.clientX - d.x;
    const delta = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
    if (Math.abs(delta) > 2) d.moved = true;
    const fine = e.shiftKey ? 0.2 : 1;
    let n = d.norm + (delta / DRAG_PX_FULL_TRAVEL) * fine;
    if (spec.endless) n = Math.min(1, Math.max(0, n));
    commit(n);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    if (d.moved) lastTap.current = 0;
    drag.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    const stepN = spec.step ? Math.max(spec.step / (spec.max - spec.min), 0.001) : 0.01;
    const amount = e.shiftKey ? stepN * 10 : stepN;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); commit(norm + amount); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); commit(norm - amount); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(spec.default); }
  };

  const ring = highlighted
    ? onTarget
      ? '0 0 0 3px rgba(34,197,94,0.9), 0 0 14px rgba(34,197,94,0.6)'
      : '0 0 0 3px rgba(249,115,22,0.95), 0 0 16px rgba(249,115,22,0.7)'
    : undefined;

  const labelSize = diameter >= 50 ? 10 : diameter >= 36 ? 9 : diameter >= 26 ? 8 : 7;
  const shownLabel = labelText ?? spec.label;
  const showValue = valueDisplay === 'always' || (valueDisplay === 'hover' && (hovered || dragging));
  const valueAbove = valueDisplay === 'hover' && label !== 'above';

  return (
    <div
      className={`relative select-none outline-none ${highlighted && !onTarget ? 'animate-pulse' : ''}`}
      style={{ width: diameter, height: diameter, touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onKeyDown={handleKey}
      tabIndex={0}
      role="slider"
      aria-label={shownLabel}
      aria-valuemin={spec.min}
      aria-valuemax={spec.max}
      aria-valuenow={value}
      data-control={id}
      title={spec.description}
    >
      {label !== 'none' && shownLabel && (
        <div
          className="absolute text-center font-bold whitespace-nowrap pointer-events-none"
          style={{
            ...labelPlacement(label, variant === 'moog-silver' ? 2 : 4),
            fontSize: labelSize,
            color: labelColor,
            opacity: 0.92,
            letterSpacing: '0.3px',
            lineHeight: 1.05,
          }}
        >
          {shownLabel}
        </div>
      )}

      {!spec.endless && <Ticks diameter={diameter} variant={variant} bipolar={!!spec.bipolar} />}

      <div className="absolute inset-0 rounded-full" style={{ boxShadow: ring, transition: 'box-shadow 120ms' }}>
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
          className={`absolute left-1/2 -translate-x-1/2 font-mono text-green-400 bg-black/90 px-1 py-px rounded text-center pointer-events-none ${valueDisplay === 'hover' ? 'z-50 shadow-lg border border-green-900' : ''}`}
          style={{
            ...(valueAbove ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 3 }),
            fontSize: diameter >= 30 ? 9 : 8,
            minWidth: 30,
            textShadow: '0 0 4px rgba(0,255,0,0.5)',
          }}
        >
          {formatValue(spec, value)}
        </div>
      )}

      {showTarget && highlighted && targetValue !== undefined && !onTarget && (
        <div
          className="absolute left-1/2 -translate-x-1/2 font-mono text-orange-400 font-bold whitespace-nowrap pointer-events-none bg-black/80 px-1 rounded z-40"
          style={{ top: '100%', marginTop: showValue && !valueAbove ? 19 : 3, fontSize: 9 }}
        >
          → {formatValue(spec, targetValue)}
        </div>
      )}
    </div>
  );
}

function labelPlacement(pos: LabelPosition, gap: number): React.CSSProperties {
  switch (pos) {
    case 'below': return { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: gap + 14 };
    case 'left': return { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: gap + 4 };
    case 'right': return { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: gap + 4 };
    default: return { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: gap };
  }
}

function Ticks({ diameter, variant, bipolar }: { diameter: number; variant: KnobVariant; bipolar: boolean }) {
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
}

function Cap({ variant, capColor, rotation, diameter, endless }: { variant: KnobVariant; capColor?: string; rotation: number; diameter: number; endless: boolean }) {
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
}
