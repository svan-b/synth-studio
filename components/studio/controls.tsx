'use client';

// Touch-first mixer controls: a vertical dB fader with a DAW taper and a marked
// unity point, a compact horizontal slider (pan, sends, effect settings), and a
// shared meter animation loop. All drag relatively (no jumps under a finger),
// double-tap resets, arrow keys step, and every control is an ARIA slider.

import { useCallback, useEffect, useRef } from 'react';
import { MIN_DB, MAX_DB, dbToFader, faderToDb, formatDb } from '@/lib/studio/mixerDoc';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function useDoubleTap(onDouble: () => void) {
  const last = useRef(0);
  return () => {
    const now = performance.now();
    if (now - last.current < 320) { last.current = 0; onDouble(); return true; }
    last.current = now;
    return false;
  };
}

// ----------------------------------------------------------------------------
// Fader
// ----------------------------------------------------------------------------

export const FADER_MARKS = [6, 0, -6, -12, -20, -30, -48];

export function Fader({ value, onChange, height = 168, label, resetTo = 0, children }: {
  value: number;
  onChange: (db: number) => void;
  height?: number;
  label: string;
  resetTo?: number;
  /** Rendered inside the track area (the meter) */
  children?: React.ReactNode;
}) {
  const drag = useRef<{ y: number; pos: number; id: number } | null>(null);
  const double = useDoubleTap(() => onChange(resetTo));
  const pos = dbToFader(value);
  const capH = 30;
  const travel = height - capH;

  const set = useCallback((p: number) => {
    const db = faderToDb(clamp(p, 0, 1));
    // snap to unity when close (it's where most faders live)
    onChange(Math.abs(db) < 0.25 ? 0 : Math.round(db * 10) / 10);
  }, [onChange]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (double()) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const capY = rect.top + (1 - pos) * travel;
    let start = pos;
    // A mouse click on the track (not the cap) jumps there; fingers always drag relatively
    if (e.pointerType === 'mouse' && (e.clientY < capY - 2 || e.clientY > capY + capH + 2)) {
      start = clamp(1 - (e.clientY - rect.top - capH / 2) / travel, 0, 1);
      set(start);
    }
    drag.current = { y: e.clientY, pos: start, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const fine = e.shiftKey || e.altKey ? 0.2 : 1;
    set(d.pos - ((e.clientY - d.y) / travel) * fine);
  };
  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.5;
    let db = value <= MIN_DB ? MIN_DB : value;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') db += step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') db -= step;
    else if (e.key === 'PageUp') db += 3;
    else if (e.key === 'PageDown') db -= 3;
    else if (e.key === 'Home') db = resetTo;
    else if (e.key === 'End') db = MIN_DB;
    else return;
    e.preventDefault();
    onChange(db <= MIN_DB + 0.01 ? MIN_DB : clamp(Math.round(db * 10) / 10, MIN_DB, MAX_DB));
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={MIN_DB}
      aria-valuemax={MAX_DB}
      aria-valuenow={value}
      aria-valuetext={`${formatDb(value)} dB`}
      className="relative select-none touch-none outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
      style={{ height, width: 46 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      title="Drag to set the level · double-tap for 0 dB (unity) · shift-drag for fine moves"
    >
      {/* scale */}
      {FADER_MARKS.map(m => {
        const y = capH / 2 + (1 - dbToFader(m)) * travel;
        const unity = m === 0;
        return (
          <div key={m} className="absolute left-0 flex items-center pointer-events-none" style={{ top: y - 6, height: 12 }}>
            <span className={`text-[8px] w-[14px] text-right tabular-nums leading-none ${unity ? 'text-amber-300 font-bold' : 'text-gray-500'}`}>{m > 0 ? `+${m}` : m}</span>
            <span className={`ml-[2px] h-px ${unity ? 'w-[10px] bg-amber-300' : 'w-[6px] bg-gray-600'}`} />
          </div>
        );
      })}
      {/* track */}
      <div className="absolute rounded-full bg-black/70 border border-[#333]" style={{ left: 27, width: 6, top: capH / 2, height: travel }} />
      {/* meter goes here (right of the track) */}
      <div className="absolute pointer-events-none" style={{ left: 36, top: capH / 2, height: travel, width: 9 }}>{children}</div>
      {/* cap */}
      <div
        className="absolute rounded-[4px] border border-[#666] shadow-[0_2px_4px_rgba(0,0,0,0.6)] pointer-events-none"
        style={{
          left: 18, width: 24, height: capH, top: (1 - pos) * travel,
          background: 'linear-gradient(180deg,#d8d8d8 0%,#9a9a9a 45%,#5c5c5c 50%,#a7a7a7 55%,#cfcfcf 100%)',
        }}
      >
        <div className="absolute left-[3px] right-[3px] top-1/2 h-[2px] -mt-px bg-black/80" />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Horizontal mini slider
// ----------------------------------------------------------------------------

export function HSlider({ value, min, max, onChange, label, format, resetTo, width = 72, centered = false, accent = '#38bdf8', toPos, fromPos, step }: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  format: (v: number) => string;
  resetTo: number;
  width?: number;
  /** Fill from the middle (pan) */
  centered?: boolean;
  accent?: string;
  /** Custom taper (0..1) */
  toPos?: (v: number) => number;
  fromPos?: (p: number) => number;
  step?: number;
}) {
  const drag = useRef<{ x: number; pos: number; id: number } | null>(null);
  const double = useDoubleTap(() => onChange(resetTo));
  const tp = toPos ?? ((v: number) => (v - min) / (max - min));
  const fp = fromPos ?? ((p: number) => min + p * (max - min));
  const pos = clamp(tp(value), 0, 1);
  const quant = (v: number) => (step ? Math.round(v / step) * step : v);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (double()) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    let start = pos;
    if (e.pointerType === 'mouse') {
      const r = e.currentTarget.getBoundingClientRect();
      start = clamp((e.clientX - r.left) / r.width, 0, 1);
      onChange(clamp(quant(fp(start)), min, max));
    }
    drag.current = { x: e.clientX, pos: start, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const fine = e.shiftKey || e.altKey ? 0.2 : 1;
    // relative: a full slider width of travel = the full range (x1.5 for fingers)
    const p = clamp(d.pos + ((e.clientX - d.x) / (width * (e.pointerType === 'touch' ? 1.5 : 1))) * fine, 0, 1);
    let v = clamp(quant(fp(p)), min, max);
    if (centered && Math.abs(p - 0.5) < 0.02) v = resetTo;
    onChange(v);
  };
  const end = (e: React.PointerEvent<HTMLDivElement>) => { if (drag.current?.id === e.pointerId) drag.current = null; };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = (e.shiftKey ? 0.01 : 0.05);
    let p = pos;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') p += s;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') p -= s;
    else if (e.key === 'Home') { onChange(resetTo); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    onChange(clamp(quant(fp(clamp(p, 0, 1))), min, max));
  };
  const fillLeft = centered ? Math.min(pos, 0.5) : 0;
  const fillW = centered ? Math.abs(pos - 0.5) : pos;
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      className="relative select-none touch-none outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded h-[22px] bg-black/60 border border-[#333] overflow-hidden cursor-ew-resize"
      style={{ width }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      title={`${label}: drag · double-tap to reset`}
    >
      <div className="absolute inset-y-0" style={{ left: `${fillLeft * 100}%`, width: `${fillW * 100}%`, background: `${accent}55` }} />
      {centered && <div className="absolute inset-y-0 left-1/2 w-px bg-gray-500" />}
      <div className="absolute inset-y-0 w-[3px] -ml-[1.5px]" style={{ left: `${pos * 100}%`, background: accent }} />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white tabular-nums pointer-events-none" style={{ textShadow: '0 1px 2px #000' }}>
        {format(value)}
      </span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// One animation loop for everything that moves (meters, the position readout)
// ----------------------------------------------------------------------------

const frameCallbacks = new Set<(t: number) => void>();
let raf = 0;

function frame(t: number) {
  frameCallbacks.forEach(cb => cb(t));
  raf = frameCallbacks.size ? requestAnimationFrame(frame) : 0;
}

/** Run `cb` on every animation frame (shared requestAnimationFrame loop) */
export function onFrame(cb: (t: number) => void): () => void {
  frameCallbacks.add(cb);
  if (!raf) raf = requestAnimationFrame(frame);
  return () => { frameCallbacks.delete(cb); };
}

// ----------------------------------------------------------------------------
// Meters (GPU-friendly: transforms only, no layout)
// ----------------------------------------------------------------------------

type Reader = () => { l: number; r: number } | null;
interface MeterEl {
  bars: [HTMLElement, HTMLElement];
  holds: [HTMLElement, HTMLElement];
  read: Reader;
  clip?: HTMLElement;
  state: { v: [number, number]; hold: [number, number]; holdT: [number, number]; clipT: number; shown: string[]; colour: string[] };
}

const meters = new Set<MeterEl>();
let lastT = 0;
let meterCb: (() => void) | null = null;

/** Level (linear) -> 0..1 on the fader's scale, so meter and fader line up */
export const levelToPos = (lin: number) => (lin <= 0.001 ? 0 : dbToFader(Math.min(MAX_DB, 20 * Math.log10(lin))));

function tickMeters(t: number) {
  const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0.016;
  lastT = t;
  meters.forEach(m => {
    const v = m.read();
    for (let c = 0; c < 2; c++) {
      const lin = v ? (c === 0 ? v.l : v.r) : 0;
      const db = lin > 0 ? 20 * Math.log10(lin) : -90;
      // fast attack, 24 dB/s fall
      const cur = Math.max(db, m.state.v[c] - 24 * dt);
      m.state.v[c] = cur;
      if (cur >= m.state.hold[c] || t - m.state.holdT[c] > 1500) { m.state.hold[c] = cur; m.state.holdT[c] = t; }
      const p = cur <= -60 ? 0 : dbToFader(Math.min(MAX_DB, cur));
      // Whole-percent steps (well under a pixel here) and the colour only when its band
      // changes: fewer writes and repaints while the user plays and drags on an iPad.
      const tf = `scaleY(${p.toFixed(2)})`;
      if (tf !== m.state.shown[c]) {
        m.state.shown[c] = tf;
        m.bars[c].style.transform = tf;
      }
      const colour = cur > -1 ? '#ef4444' : cur > -9 ? '#eab308' : '#22c55e';
      if (colour !== m.state.colour[c]) {
        m.state.colour[c] = colour;
        m.bars[c].style.background = colour;
      }
      const hp = m.state.hold[c] <= -60 ? 0 : dbToFader(Math.min(MAX_DB, m.state.hold[c]));
      const ht = hp > 0.02 ? `translateY(${((1 - hp) * 100).toFixed(1)}%)` : 'translateY(100%)';
      if (ht !== m.state.shown[c + 2]) { m.state.shown[c + 2] = ht; m.holds[c].style.transform = ht; }
      if (lin >= 0.999) m.state.clipT = t;
    }
    if (m.clip) m.clip.style.opacity = t - m.state.clipT < 2000 ? '1' : '0.15';
  });
}

export function useMeter(read: Reader) {
  const ref = useRef<HTMLDivElement>(null);
  const readRef = useRef(read);
  readRef.current = read;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bars = el.querySelectorAll<HTMLElement>('[data-bar]');
    const holds = el.querySelectorAll<HTMLElement>('[data-hold]');
    const m: MeterEl = {
      bars: [bars[0], bars[1]],
      holds: [holds[0], holds[1]],
      read: () => readRef.current(),
      clip: el.querySelector<HTMLElement>('[data-clip]') ?? undefined,
      state: { v: [-90, -90], hold: [-90, -90], holdT: [0, 0], clipT: -1e9, shown: ['', '', '', ''], colour: ['', ''] },
    };
    meters.add(m);
    if (!meterCb) { lastT = 0; meterCb = onFrame(tickMeters); }
    return () => {
      meters.delete(m);
      if (!meters.size && meterCb) { meterCb(); meterCb = null; }
    };
  }, []);
  return ref;
}

/** Stereo bar meter (fills its parent), on the fader scale */
export function StereoMeter({ read, showClip = false }: { read: Reader; showClip?: boolean }) {
  const ref = useMeter(read);
  return (
    <div ref={ref} className="absolute inset-0 flex gap-[1px]" aria-hidden>
      {[0, 1].map(c => (
        <div key={c} className="relative flex-1 bg-black/70 rounded-[1px] overflow-hidden">
          <div data-bar className="absolute inset-0 origin-bottom" style={{ transform: 'scaleY(0)' }} />
          <div data-hold className="absolute inset-0" style={{ transform: 'translateY(100%)' }}>
            <div className="h-[2px] bg-white/80" />
          </div>
        </div>
      ))}
      {showClip && <div data-clip className="absolute -top-2 left-0 right-0 h-1.5 rounded-sm bg-red-500" style={{ opacity: 0.15 }} />}
    </div>
  );
}
