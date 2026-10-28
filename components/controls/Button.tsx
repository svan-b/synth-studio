'use client';

import { useRef } from 'react';
import type { LabelPosition } from '@/types/panel';

export interface ButtonProps {
  id: string;
  label?: string;
  description?: string;
  /** Lit amount 0..1 (or boolean) */
  lit: number | boolean;
  onPress: () => void;
  onRelease?: () => void;
  shape?: 'round' | 'square' | 'rect';
  width: number;            // px (diameter for round)
  height?: number;          // px (rect)
  color?: string;           // cap colour when unlit
  ledColor?: string;
  labelPosition?: LabelPosition;
  labelColor?: string;
  capText?: string;
  highlighted?: boolean;
  correct?: boolean;
}

/**
 * Hardware button. Press fires on pointer-down (no 300ms click delay on iPad),
 * release on pointer-up/cancel - so pads and momentary buttons feel immediate.
 */
export default function Button({
  id,
  label,
  description,
  lit,
  onPress,
  onRelease,
  shape = 'round',
  width,
  height,
  color = '#1f2b1f',
  ledColor = '#22c55e',
  labelPosition = 'above',
  labelColor = '#9ca3af',
  capText,
  highlighted = false,
  correct = false,
}: ButtonProps) {
  const pressed = useRef(false);
  const amount = typeof lit === 'boolean' ? (lit ? 1 : 0) : Math.max(0, Math.min(1, lit));
  const w = width;
  const h = shape === 'rect' ? height ?? width * 0.6 : width;
  const radius = shape === 'round' ? '50%' : shape === 'square' ? 4 : 3;

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    pressed.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    onPress();
  };
  const up = () => {
    if (!pressed.current) return;
    pressed.current = false;
    onRelease?.();
  };

  const ring = highlighted
    ? correct
      ? '0 0 0 3px rgba(34,197,94,0.9)'
      : '0 0 0 3px rgba(249,115,22,0.95), 0 0 14px rgba(249,115,22,0.7)'
    : '';

  return (
    <div className={`relative select-none ${highlighted && !correct ? 'animate-pulse' : ''}`} style={{ width: w, height: h }} title={description}>
      {labelPosition !== 'none' && label && (
        <div
          className="absolute font-bold uppercase whitespace-nowrap pointer-events-none leading-none"
          style={{ ...labelStyle(labelPosition), fontSize: w >= 30 ? 8 : 7, color: labelColor, letterSpacing: '0.4px' }}
        >
          {label}
        </div>
      )}
      <button
        data-control={id}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onContextMenu={e => e.preventDefault()}
        onKeyDown={e => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); onPress(); } }}
        onKeyUp={e => { if (e.key === 'Enter') onRelease?.(); }}
        className="absolute inset-0 border-2 border-[#3a3a3a] active:scale-95 transition-transform"
        style={{
          borderRadius: radius,
          touchAction: 'none',
          background: amount > 0
            ? `radial-gradient(circle at 50% 40%, ${ledColor} 0%, ${mix(ledColor, color, 1 - amount)} 75%)`
            : color,
          boxShadow: [
            amount > 0 ? `0 0 ${6 + 8 * amount}px ${ledColor}` : 'inset 0 2px 4px rgba(0,0,0,0.6)',
            ring,
          ].filter(Boolean).join(', '),
        }}
        aria-label={label ?? capText ?? id}
        aria-pressed={amount > 0}
      >
        {capText && (
          <span className="absolute inset-0 flex items-center justify-center font-bold leading-none" style={{ fontSize: Math.max(6, Math.min(10, w * 0.22)), color: amount > 0.5 ? '#000' : '#ccc' }}>
            {capText}
          </span>
        )}
      </button>
    </div>
  );
}

function labelStyle(pos: LabelPosition): React.CSSProperties {
  switch (pos) {
    case 'below': return { top: '100%', marginTop: 4, left: '50%', transform: 'translateX(-50%)' };
    case 'left': return { right: '100%', marginRight: 6, top: '50%', transform: 'translateY(-50%)' };
    case 'right': return { left: '100%', marginLeft: 6, top: '50%', transform: 'translateY(-50%)' };
    default: return { bottom: '100%', marginBottom: 4, left: '50%', transform: 'translateX(-50%)' };
  }
}

// Blend two hex colours (for partially lit LEDs)
function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a), pb = parseHex(b);
  if (!pa || !pb) return b;
  const c = pa.map((v, i) => Math.round(v * (1 - t) + pb[i] * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function parseHex(h: string): number[] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(h.trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
}
