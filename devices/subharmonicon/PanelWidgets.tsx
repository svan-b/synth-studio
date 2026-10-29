'use client';

// ============================================================================
// Subharmonicon panel widgets the generic panel has no element for:
//  - CycleButton: SEQ OCT and QUANTIZE are each ONE backlit button that steps
//    through its settings; their LEDs (radio buttons in layout.tsx, so they can
//    also be tapped and are highlighted by lessons) show the current one.
//  - EgButton: tap toggles ON / OFF, press and hold until it blinks = HELD.
//  - WaveGlyphs: the waveform symbols printed beside each WAVE switch.
// Both buttons spotlight themselves when a lesson step targets their control.
// ============================================================================

import { useRef } from 'react';
import type { ControlValue, LessonStep } from '@/types';

type SetValue = (id: string, v: ControlValue) => void;

const CAP = '#2b2b2b';
const LIT = '#ff3b30';

function ring(step: LessonStep | null, teaching: boolean, control: string, value: number): string | undefined {
  if (!teaching || !step || step.control !== control) return undefined;
  return step.targetValue === value ? '0 0 0 3px rgba(34,197,94,0.9)' : '0 0 0 3px rgba(249,115,22,0.95), 0 0 14px rgba(249,115,22,0.7)';
}

/** Rectangular push button that advances a switch control to its next setting */
export function CycleButton({ control, label, value, next, setValue, w, h, teaching, step, description }: {
  control: string;
  label: string;
  value: number;
  next: (v: number) => number;
  setValue: SetValue;
  /** px */
  w: number;
  h: number;
  teaching: boolean;
  step: LessonStep | null;
  description?: string;
}) {
  const hl = ring(step, teaching, control, value);
  return (
    <button
      type="button"
      data-control={control}
      title={description}
      onPointerDown={e => { e.preventDefault(); setValue(control, next(value)); }}
      onContextMenu={e => e.preventDefault()}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setValue(control, next(value)); } }}
      className={`absolute left-0 top-0 rounded-[3px] border-2 border-[#3a3a3a] active:scale-95 transition-transform ${hl && step?.targetValue !== value ? 'animate-pulse' : ''}`}
      style={{ width: w, height: h, touchAction: 'none', background: CAP, boxShadow: [hl, 'inset 0 2px 4px rgba(0,0,0,0.6)'].filter(Boolean).join(', ') }}
      aria-label={label}
    >
      <span className="absolute inset-0 flex items-center justify-center font-bold leading-none whitespace-nowrap" style={{ fontSize: Math.min(9, (w / label.length) * 1.45), color: '#d8d8d8', letterSpacing: '0.2px' }}>
        {label}
      </span>
    </button>
  );
}

const LONG_PRESS_MS = 450;

/**
 * EG button (manual p.29): a quick press toggles ON / OFF; press and hold until
 * it blinks selects HELD; a press while HELD returns to ON. Values: 0 OFF, 1 ON, 2 HELD.
 */
export function EgButton({ value, setValue, w, h, teaching, step }: { value: number; setValue: SetValue; w: number; h: number; teaching: boolean; step: LessonStep | null }) {
  const down = useRef<{ consumed: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);
  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const st = { consumed: false, timer: setTimeout(() => { st.consumed = true; setValue('eg_mode', 2); }, LONG_PRESS_MS) };
    down.current = st;
  };
  const onUp = () => {
    const st = down.current;
    if (!st) return;
    clearTimeout(st.timer);
    down.current = null;
    if (!st.consumed) setValue('eg_mode', value === 0 ? 1 : value === 1 ? 0 : 1);
  };
  const lit = value !== 0;
  const hl = ring(step, teaching, 'eg_mode', value);
  return (
    <button
      type="button"
      data-control="eg_mode"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={e => e.preventDefault()}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setValue('eg_mode', value === 0 ? 1 : value === 1 ? 0 : 1); } }}
      className={`absolute left-0 top-0 rounded-[3px] border-2 border-[#3a3a3a] ${value === 2 ? 'subh-blink' : ''} ${hl && step?.targetValue !== value ? 'animate-pulse' : ''}`}
      style={{
        width: w, height: h, touchAction: 'none',
        background: lit ? `radial-gradient(circle at 50% 40%, ${LIT} 0%, #7a1410 80%)` : CAP,
        boxShadow: [lit ? `0 0 10px ${LIT}` : 'inset 0 2px 4px rgba(0,0,0,0.6)', hl].filter(Boolean).join(', '),
      }}
      title="EG - tap: ON / OFF (sequencer steps fire the envelopes). Press and hold until it blinks: HELD, both envelopes held open (a drone)."
      aria-label={`EG ${['OFF', 'ON', 'HELD'][value] ?? ''}`}
      aria-pressed={lit}
    >
      <span className="absolute inset-0 flex items-center justify-center font-bold leading-none" style={{ fontSize: Math.min(9, w * 0.3), color: lit ? '#1a0000' : '#d8d8d8' }}>EG</span>
      <style>{'@keyframes subh-blink{0%,49%{opacity:1}50%,100%{opacity:.35}}.subh-blink{animation:subh-blink .5s linear infinite}'}</style>
    </button>
  );
}

/** Square (up), pulse-width (middle) and sawtooth (down) glyphs, as printed beside the WAVE switch */
export function WaveGlyphs({ w, h, color = '#e8e8e8' }: { w: number; h: number; color?: string }) {
  const row = h / 3;
  const gw = w, gh = row * 0.6;
  const y = (i: number) => row * i + (row - gh) / 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: 'block' }}>
      <g fill="none" stroke={color} strokeWidth={1.1} strokeLinejoin="miter">
        {/* square */}
        <path d={`M0 ${y(0) + gh} H${gw * 0.12} V${y(0)} H${gw * 0.5} V${y(0) + gh} H${gw * 0.88} V${y(0)} H${gw}`} />
        {/* pulse-width modulated square */}
        <path d={`M0 ${y(1) + gh} H${gw * 0.08} V${y(1)} H${gw * 0.28} V${y(1) + gh} H${gw * 0.5} V${y(1)} H${gw * 0.84} V${y(1) + gh} H${gw}`} />
        {/* sawtooth */}
        <path d={`M0 ${y(2) + gh} L${gw * 0.45} ${y(2)} V${y(2) + gh} L${gw * 0.92} ${y(2)} V${y(2) + gh}`} />
      </g>
    </svg>
  );
}
