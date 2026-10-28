'use client';
// ============================================================================
// Sub 37 custom panel parts: pitch & mod wheels, the 16-button preset bank and
// the LCD. Rendered through `custom` / `display` layout elements.
// ============================================================================

import { useRef } from 'react';
import type { ControlValue } from '@/types';
import type { PanelContext } from '@/types/panel';
import { SUB37 } from './spec';

const UI_CONTROLS = new Set(['knob_shift', 'pitch_bend', 'mod_wheel', 'preset_number']);

// ---------------------------------------------------------------------------
// Wheels
// ---------------------------------------------------------------------------

interface WheelProps {
  label: string;
  value: number;
  min: number;
  max: number;
  spring?: boolean;
  onChange: (v: number) => void;
}

/** A vertical performance wheel: drag up/down; the pitch wheel springs back to centre */
export function Wheel({ label, value, min, max, spring, onChange }: WheelProps) {
  const drag = useRef<{ y: number; v: number; id: number; h: number } | null>(null);
  const norm = (value - min) / (max - min);
  const offset = (norm - 0.5) * 2; // -1..1

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, v: value, id: e.pointerId, h: e.currentTarget.getBoundingClientRect().height };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const delta = ((d.y - e.clientY) / (d.h * 0.8)) * (max - min);
    const v = Math.round(Math.max(min, Math.min(max, d.v + delta)));
    if (v !== value) onChange(v);
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (spring) onChange(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', flex: 1, minWidth: 0, userSelect: 'none' }}>
      <div
        role="slider"
        aria-label={`${label} wheel`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        data-wheel={label}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={() => onChange(spring ? 0 : min)}
        style={{
          position: 'relative', flex: 1, width: '100%', borderRadius: 6, overflow: 'hidden',
          touchAction: 'none',
          cursor: 'ns-resize',
          background: '#050505',
          border: '2px solid #2b2b2b',
          boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.9)',
        }}
      >
        {/* Ridged rubber wheel; the ridges scroll with the value */}
        <div
          style={{
            position: 'absolute', left: '12%', right: '12%', top: '3%', bottom: '3%', borderRadius: 4,
            background: `repeating-linear-gradient(180deg, #2a2a2a 0px, #2a2a2a 3px, #121212 3px, #121212 6px)`,
            backgroundPositionY: `${-offset * 40}px`,
            boxShadow: 'inset 0 18px 18px -8px rgba(0,0,0,0.95), inset 0 -18px 18px -8px rgba(0,0,0,0.95)',
          }}
        />
        {/* White index line */}
        <div
          style={{ position: 'absolute', left: '12%', right: '12%', pointerEvents: 'none', top: `${50 - offset * 38}%`, height: 3, background: '#e5e5e5', boxShadow: '0 0 3px rgba(255,255,255,0.6)' }}
        />
      </div>
      <div style={{ fontWeight: 700, marginTop: 4, fontSize: 8, color: '#d4d4d4', letterSpacing: '0.6px' }}>{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preset bank (bank 1, buttons 1-16)
// ---------------------------------------------------------------------------

const PRESET_LIST = Object.values(SUB37.presets ?? {}).sort(
  (a, b) => Number(a.settings.preset_number) - Number(b.settings.preset_number),
);

export function presetName(slot: number): string | null {
  return PRESET_LIST.find(p => p.settings.preset_number === slot)?.name ?? null;
}

type SetValue = (id: string, v: ControlValue) => void;

function loadSlot(slot: number, values: PanelContext['values'], setValue: SetValue) {
  const p = PRESET_LIST.find(x => x.settings.preset_number === slot);
  if (!p) {
    setValue('preset_number', slot);
    return;
  }
  // Same rule as the toolbar's preset menu: unspecified sound controls return to default
  const next: Record<string, ControlValue> = {};
  Object.entries(SUB37.controls).forEach(([id, c]) => {
    if (UI_CONTROLS.has(id) || c.type === 'button' || !('default' in c)) return;
    next[id] = c.default as ControlValue;
  });
  Object.assign(next, p.settings);
  Object.entries(next).forEach(([id, v]) => { if (values[id] !== v) setValue(id, v); });
}

export function PresetBank({ values, setValue }: { values: PanelContext['values']; setValue: SetValue }) {
  const current = Number(values.preset_number ?? 0);
  return (
    <div style={{ display: 'grid', height: '100%', width: '100%', gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 4 }}>
      {Array.from({ length: 16 }, (_, i) => {
        const slot = i + 1;
        const lit = current === slot;
        const name = presetName(slot);
        return (
          <button
            key={slot}
            data-preset={slot}
            title={name ?? 'Empty slot'}
            aria-label={`Preset ${slot}${name ? `: ${name}` : ''}`}
            onPointerDown={e => { if (e.button !== 0 && e.pointerType === 'mouse') return; e.preventDefault(); loadSlot(slot, values, setValue); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadSlot(slot, values, setValue); } }}
            style={{
              position: 'relative', borderRadius: 3, fontWeight: 700, lineHeight: 1, cursor: 'pointer',
              touchAction: 'none',
              fontSize: 9,
              color: lit ? '#111' : name ? '#d4d4d4' : '#6b6b6b',
              background: lit ? 'radial-gradient(circle at 50% 40%, #ff6a5c 0%, #c0271b 85%)' : 'linear-gradient(#2a2a2a, #161616)',
              border: '1px solid #444',
              boxShadow: lit ? '0 0 8px #ff3b30' : 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 3px rgba(0,0,0,0.6)',
            }}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LCD (128 x 64 backlit)
// ---------------------------------------------------------------------------

const TRUNC: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

export function Lcd({ values, engine }: PanelContext) {
  const slot = Number(values.preset_number ?? 0);
  const name = slot ? presetName(slot) ?? 'EMPTY' : 'PANEL';
  const lcd = engine.lcd as { title: string; value: string } | null | undefined;
  const arp = values.arp_on ? 'ARP' : '';
  const shift = values.knob_shift ? 'SHIFT' : '';
  return (
    <div
      style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'ui-monospace, Menlo, monospace',
        background: 'linear-gradient(180deg, #1b3d8f 0%, #13307a 100%)',
        color: '#e8f0ff',
        padding: '4px 6px',
        textShadow: '0 0 3px rgba(190,215,255,0.55)',
        boxShadow: 'inset 0 0 10px rgba(0,0,20,0.7)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, opacity: 0.85 }}>
        <span>B01 P{String(slot).padStart(2, '0')}</span>
        <span>{[shift, arp].filter(Boolean).join(' ')}</span>
      </div>
      <div style={{ ...TRUNC, fontWeight: 700, fontSize: 10, borderBottom: '1px solid rgba(232,240,255,0.4)', paddingBottom: 2 }}>{name.toUpperCase()}</div>
      <div style={{ ...TRUNC, fontSize: 8, marginTop: 3, opacity: 0.9 }}>{lcd ? lcd.title : 'SUB 37 TRIBUTE'}</div>
      <div style={{ ...TRUNC, fontWeight: 700, fontSize: 13, lineHeight: 1.1 }}>{lcd ? lcd.value : 'READY'}</div>
    </div>
  );
}
