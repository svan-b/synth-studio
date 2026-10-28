'use client';

// ============================================================================
// Subharmonicon single push buttons that step through settings.
// SEQ OCT, QUANTIZE and EG are each ONE button on the hardware; their LEDs
// (drawn in layout.tsx as radio buttons, so they can also be tapped and are
// highlighted by lessons) show the current setting. The generic panel has no
// "cycling" button, so these live in the device folder as `custom` elements.
// ============================================================================

import { useRef } from 'react';
import type { ControlValue } from '@/types';

type SetValue = (id: string, v: ControlValue) => void;

/** Round push button that advances a switch control to the next setting. */
export function CycleButton({ control, label, value, next, setValue, pxPerMm, description }: {
  control: string;
  label: string;
  value: number;
  next: (v: number) => number;
  setValue: SetValue;
  pxPerMm: number;
  description?: string;
}) {
  const d = 6.2 * pxPerMm;
  return (
    <div className="flex flex-col items-center select-none" title={description}>
      <button
        type="button"
        data-control={control}
        onPointerDown={e => { e.preventDefault(); setValue(control, next(value)); }}
        onContextMenu={e => e.preventDefault()}
        className="rounded-full border-2 border-[#3a3a3a] active:scale-95 transition-transform"
        style={{ width: d, height: d, touchAction: 'none', background: 'radial-gradient(circle at 45% 35%, #3a3a3a 0%, #111 80%)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }}
        aria-label={label}
      />
      <span className="font-bold leading-none whitespace-nowrap" style={{ fontSize: 7, color: '#d4d4d4', marginTop: 3, letterSpacing: '0.4px' }}>{label}</span>
    </div>
  );
}

const LONG_PRESS_MS = 450;

/**
 * EG button (manual p.29): quick press toggles ON / OFF, press and hold until
 * it blinks selects HELD. Values: 0 OFF, 1 ON (lit), 2 HELD (blinking).
 */
export function EgButton({ value, setValue, pxPerMm }: { value: number; setValue: SetValue; pxPerMm: number }) {
  const down = useRef<{ consumed: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);
  const d = 6.2 * pxPerMm;

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
    if (!st.consumed) setValue('eg_mode', value === 1 ? 0 : 1);
  };

  const lit = value !== 0;
  return (
    <div className="flex flex-col items-center select-none" title="EG - tap: ON / OFF (sequencers trigger the envelopes). Press and hold: HELD (blinking) - envelopes held open, a drone.">
      <span className="font-bold leading-none whitespace-nowrap" style={{ fontSize: 7, color: '#d4d4d4', marginBottom: 3, letterSpacing: '0.4px' }}>EG</span>
      <button
        type="button"
        data-control="eg_mode"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={e => e.preventDefault()}
        className={`rounded-full border-2 border-[#3a3a3a] ${value === 2 ? 'animate-pulse' : ''}`}
        style={{
          width: d, height: d, touchAction: 'none',
          background: lit ? 'radial-gradient(circle at 50% 40%, #ff3b30 0%, #7a1410 75%)' : '#2b1010',
          boxShadow: lit ? '0 0 10px #ff3b30' : 'inset 0 2px 4px rgba(0,0,0,0.6)',
        }}
        aria-label={`EG ${['OFF', 'ON', 'HELD'][value] ?? ''}`}
        aria-pressed={lit}
      />
    </div>
  );
}
