'use client';

import { memo, useRef } from 'react';
import type { LabelPosition } from '@/types/panel';
import { fitTransform, type TextFit } from '@/lib/controls/textFit';
import styles from './controlStyles';

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
  // ---- optional, set by the panel ----
  labelFit?: TextFit;
  capFit?: TextFit;
  /** Minimum hit area (px) - touch targets bigger than the drawn button */
  hitSize?: number;
  spot?: 'target' | 'focus' | null;
  /** Momentary (trigger) buttons have no on/off state for assistive tech */
  momentary?: boolean;
}

/**
 * Hardware button. Press fires on pointer-down (no 300ms click delay on iPad),
 * release on pointer-up/cancel - so pads and momentary buttons feel immediate.
 * Enter presses it from the keyboard (Space stays the transport key).
 */
function Button({
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
  labelFit,
  capFit,
  hitSize,
  spot,
  momentary,
}: ButtonProps) {
  const pressed = useRef(false);
  const amount = typeof lit === 'boolean' ? (lit ? 1 : 0) : Math.max(0, Math.min(1, lit));
  const w = width;
  const h = shape === 'rect' ? height ?? width * 0.6 : width;
  const radius = shape === 'round' ? '50%' : shape === 'square' ? 4 : 3;
  const padX = hitSize && hitSize > w ? (hitSize - w) / 2 : 0;
  const padY = hitSize && hitSize > h ? (hitSize - h) / 2 : 0;

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    if (pressed.current) return; // a second finger on the same pad
    pressed.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    onPress();
  };
  const up = () => {
    if (!pressed.current) return;
    pressed.current = false;
    onRelease?.();
  };

  const ringState = spot === 'focus' ? 'focus' : spot === 'target' || highlighted ? (correct ? 'done' : 'target') : null;
  const ringClass = ringState === 'done' ? styles.spotDone : ringState === 'target' ? styles.spotTarget : ringState === 'focus' ? styles.spotFocus : '';
  const labelPos = labelStyle(labelPosition);
  const shownLabel = labelFit?.text ?? label;

  return (
    <div className="relative select-none" style={{ width: w, height: h }} title={labelFit?.title ? `${labelFit.title}${description ? `\n${description}` : ''}` : description}>
      {labelPosition !== 'none' && label && (
        <div
          className="absolute font-bold uppercase whitespace-pre pointer-events-none leading-none"
          style={{
            ...labelPos,
            transform: fitTransform(labelFit, labelPos.transform as string | undefined),
            fontSize: labelFit?.size ?? (w >= 30 ? 8 : 7),
            color: labelFit?.color ?? labelColor,
            letterSpacing: '0.4px',
          }}
        >
          {shownLabel}
        </div>
      )}
      {ringClass && <div className={`${styles.spot} ${ringClass}`} style={{ inset: -3, borderRadius: shape === 'round' ? '50%' : 6 }} />}
      <button
        data-control={id}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
        onContextMenu={e => e.preventDefault()}
        onKeyDown={e => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); onPress(); } }}
        onKeyUp={e => { if (e.key === 'Enter') onRelease?.(); }}
        className={`absolute inset-0 border-2 border-[#3a3a3a] active:scale-95 motion-reduce:active:scale-100 transition-transform ${styles.control} ${styles.focusable}`}
        style={{
          borderRadius: radius,
          touchAction: 'none',
          background: amount > 0
            ? `radial-gradient(circle at 50% 40%, ${ledColor} 0%, ${mix(ledColor, color, 1 - amount)} 75%)`
            : color,
          boxShadow: amount > 0 ? `0 0 ${6 + 8 * amount}px ${ledColor}` : 'inset 0 2px 4px rgba(0,0,0,0.6)',
        }}
        aria-label={labelFit?.title ?? label ?? capText ?? id}
        aria-pressed={momentary ? undefined : amount > 0}
      >
        {(padX > 0 || padY > 0) && <span className={styles.hit} style={{ left: -padX, right: -padX, top: -padY, bottom: -padY, borderRadius: shape === 'round' ? '50%' : 6 }} />}
        {capText && (
          <span
            className="absolute inset-0 flex items-center justify-center font-bold leading-none whitespace-nowrap"
            style={{ fontSize: capFit?.size ?? Math.max(6, Math.min(10, w * 0.22)), color: amount > 0.5 ? '#000' : '#d4d4d4' }}
          >
            <span style={{ display: 'inline-block', transform: fitTransform(capFit) }}>{capFit?.text ?? capText}</span>
          </span>
        )}
      </button>
    </div>
  );
}

export default memo(Button);

function labelStyle(pos: LabelPosition): React.CSSProperties {
  switch (pos) {
    case 'below': return { top: '100%', marginTop: 4, left: '50%', transform: 'translateX(-50%)' };
    case 'left': return { right: '100%', marginRight: 6, top: '50%', transform: 'translateY(-50%)', transformOrigin: 'right center' };
    case 'right': return { left: '100%', marginLeft: 6, top: '50%', transform: 'translateY(-50%)', transformOrigin: 'left center' };
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
