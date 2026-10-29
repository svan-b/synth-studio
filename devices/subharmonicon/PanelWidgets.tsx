'use client';

// ============================================================================
// Subharmonicon panel widgets the generic panel has no element for:
//  - CycleButton: SEQ OCT and QUANTIZE are each ONE backlit button. A press steps
//    to the next setting; press and hold until the LED flashes toggles the button's
//    "held" mode (manual pp.21, 28: the SEQ jacks stop following it). The LEDs are
//    radio buttons in layout.tsx (tappable, highlighted by lessons) and the held
//    modes have their own small toggles there, so nothing depends on the gesture.
//  - EgButton: tap toggles ON / OFF, press and hold until it blinks = HELD.
//  - WaveGlyph: the square, pulse-width and saw symbols printed around each WAVE switch.
//  - Screw: the eight black M3 panel screws (manual p.40).
// Both buttons spotlight themselves when a lesson step targets their control.
// Safari / iPad: no text selection or callout on long presses, pointer capture so a
// finger that slides off still releases, and every state is visible on the panel.
// ============================================================================

import { useRef } from 'react';
import type { CSSProperties } from 'react';
import type { ControlValue, LessonStep } from '@/types';

type SetValue = (id: string, v: ControlValue) => void;

const CAP = '#2b2b2b';
const LIT = '#ff3b30';
const LONG_PRESS_MS = 600;

/** No selection, magnifier or callout on long presses (iOS Safari) */
const NO_SELECT: CSSProperties = { WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'none' };

function ring(step: LessonStep | null, teaching: boolean, control: string, value: number): string | undefined {
  if (!teaching || !step || step.control !== control) return undefined;
  return step.targetValue === value ? '0 0 0 3px rgba(34,197,94,0.9)' : '0 0 0 3px rgba(249,115,22,0.95), 0 0 14px rgba(249,115,22,0.7)';
}

/** Press / long-press on one pointer: `tap` on a short press, `hold` once the press lasts LONG_PRESS_MS */
function usePress(tap: () => void, hold: () => void) {
  const st = useRef<{ fired: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);
  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (st.current) clearTimeout(st.current.timer);
    const s = { fired: false, timer: setTimeout(() => { s.fired = true; hold(); }, LONG_PRESS_MS) };
    st.current = s;
  };
  const up = () => {
    const s = st.current;
    if (!s) return;
    clearTimeout(s.timer);
    st.current = null;
    if (!s.fired) tap();
  };
  const cancel = () => {
    const s = st.current;
    if (!s) return;
    clearTimeout(s.timer);
    st.current = null;
  };
  return { onPointerDown: down, onPointerUp: up, onPointerCancel: cancel };
}

/**
 * SEQ OCT / QUANTIZE: a press advances the switch control to its next setting; press
 * and hold toggles the button's held mode (`heldControl`).
 */
export function CycleButton({ control, label, value, next, heldControl, held, setValue, w, h, teaching, step, description }: {
  control: string;
  label: string;
  value: number;
  next: (v: number) => number;
  /** Button control toggled by a long press */
  heldControl: string;
  held: boolean;
  setValue: SetValue;
  /** px */
  w: number;
  h: number;
  teaching: boolean;
  step: LessonStep | null;
  description?: string;
}) {
  const hl = ring(step, teaching, control, value);
  const press = usePress(() => setValue(control, next(value)), () => setValue(heldControl, !held));
  return (
    <button
      type="button"
      data-control={control}
      title={description}
      {...press}
      onContextMenu={e => e.preventDefault()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setValue(control, next(value)); } }}
      className={`absolute left-0 top-0 select-none rounded-[3px] border-2 border-[#3a3a3a] active:scale-95 transition-transform ${hl && step?.targetValue !== value ? 'animate-pulse' : ''}`}
      style={{ ...NO_SELECT, width: w, height: h, background: CAP, boxShadow: [hl, 'inset 0 2px 4px rgba(0,0,0,0.6)'].filter(Boolean).join(', ') }}
      aria-label={`${label}${held ? ' (held: SEQ jacks free)' : ''}`}
    >
      <span className="absolute inset-0 flex items-center justify-center font-bold leading-none whitespace-nowrap pointer-events-none" style={{ fontSize: Math.min(9, (w / label.length) * 1.45), color: '#d8d8d8', letterSpacing: '0.2px' }}>
        {label}
      </span>
    </button>
  );
}

/**
 * EG button (manual pp.29-30): a quick press toggles ON / OFF; press and hold until
 * it blinks selects HELD; a press while HELD returns to ON. Values: 0 OFF, 1 ON, 2 HELD.
 */
export function EgButton({ value, setValue, w, h, teaching, step }: { value: number; setValue: SetValue; w: number; h: number; teaching: boolean; step: LessonStep | null }) {
  const toggle = () => setValue('eg_mode', value === 0 ? 1 : value === 1 ? 0 : 1);
  const press = usePress(toggle, () => setValue('eg_mode', 2));
  const lit = value !== 0;
  const hl = ring(step, teaching, 'eg_mode', value);
  return (
    <button
      type="button"
      data-control="eg_mode"
      {...press}
      onContextMenu={e => e.preventDefault()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
      className={`absolute left-0 top-0 select-none rounded-[3px] border-2 border-[#3a3a3a] ${value === 2 ? 'subh-blink' : ''} ${hl && step?.targetValue !== value ? 'animate-pulse' : ''}`}
      style={{
        ...NO_SELECT, width: w, height: h,
        background: lit ? `radial-gradient(circle at 50% 40%, ${LIT} 0%, #7a1410 80%)` : CAP,
        boxShadow: [lit ? `0 0 10px ${LIT}` : 'inset 0 2px 4px rgba(0,0,0,0.6)', hl].filter(Boolean).join(', '),
      }}
      title="EG: tap for ON / OFF, press and hold until it blinks for HELD (the OFF / ON / HELD keys below it do the same)."
      aria-label={`EG ${['OFF', 'ON', 'HELD'][value] ?? ''}`}
      aria-pressed={lit}
    >
      <span className="absolute inset-0 flex items-center justify-center font-bold leading-none pointer-events-none" style={{ fontSize: Math.min(9, w * 0.3), color: lit ? '#1a0000' : '#d8d8d8' }}>EG</span>
      <style>{'@keyframes subh-blink{0%,49%{opacity:1}50%,100%{opacity:.35}}.subh-blink{animation:subh-blink .5s linear infinite}'}</style>
    </button>
  );
}

/** The symbols printed around a WAVE switch: square (up), pulse fed by the sub's saw (middle), saw (down) */
export function WaveGlyph({ kind, w, h, color = '#e8e8e8' }: { kind: 'square' | 'pwm' | 'saw'; w: number; h: number; color?: string }) {
  const sq = (x0: number, x1: number, y0: number, y1: number) =>
    `M${x0} ${y1} H${x0 + (x1 - x0) * 0.22} V${y0} H${x0 + (x1 - x0) * 0.58} V${y1} H${x1}`;
  const saw = (x0: number, x1: number, y0: number, y1: number) => `M${x0} ${y1} L${x1 - (x1 - x0) * 0.12} ${y0} V${y1}`;
  const pad = 1;
  const y0 = pad, y1 = h - pad;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <g fill="none" stroke={color} strokeWidth={1.15} strokeLinejoin="miter" strokeLinecap="butt">
        {kind === 'square' && <path d={sq(0, w, y0, y1)} />}
        {kind === 'saw' && <path d={saw(0, w, y0, y1)} />}
        {kind === 'pwm' && (
          <>
            <path d={sq(0, w * 0.38, y0, y1)} />
            <path d={`M${w * 0.6} ${y0 + (y1 - y0) * 0.2} L${w * 0.47} ${(y0 + y1) / 2} L${w * 0.6} ${y1 - (y1 - y0) * 0.2} Z`} fill={color} stroke="none" />
            <path d={saw(w * 0.68, w, y0, y1)} />
          </>
        )}
      </g>
    </svg>
  );
}

/** Black Phillips-head panel screw */
export function Screw({ d }: { d: number }) {
  const r = d / 2;
  const s = r * 0.52;
  return (
    <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} aria-hidden="true" style={{ display: 'block' }}>
      <circle cx={r} cy={r} r={r - 0.5} fill="#151515" stroke="#5c5c5c" strokeWidth={0.8} />
      <circle cx={r * 0.85} cy={r * 0.75} r={r * 0.55} fill="#2a2a2a" opacity={0.6} />
      <path d={`M${r - s} ${r} H${r + s} M${r} ${r - s} V${r + s}`} stroke="#000" strokeWidth={Math.max(1.2, d * 0.12)} strokeLinecap="round" />
      <path d={`M${r - s} ${r - 0.6} H${r + s} M${r - 0.6} ${r - s} V${r + s}`} stroke="#3c3c3c" strokeWidth={0.5} strokeLinecap="round" />
    </svg>
  );
}
