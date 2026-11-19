'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BubbleState } from './ValueBubble';
import {
  DOUBLE_TAP_MS, DOUBLE_TAP_PX, FINE_FACTOR, LONG_PRESS_MS, TAP_SLOP_PX,
  beginDrag, endDrag, scrubZone, secondFingerDown, takeScrubHint,
} from '@/lib/controls/gesture';

export interface ContinuousDragConfig {
  /** Current knob travel 0..1 */
  getNorm: () => number;
  /** Write a new travel 0..1 (called at most once per animation frame) */
  commit: (norm: number) => void;
  /** Double-tap / double-click */
  reset: () => void;
  /** Screen pixels of drag for the full travel (read when a drag starts) */
  travelPx: () => number;
  /**
   * knob       mouse: drag up/down or left/right (the first direction wins); touch: drag
   *            up/down, slide sideways away from the knob for finer control
   * vertical   fader: drag along it; touch: slide sideways away for finer control
   * horizontal crossfader: the same, turned 90 degrees
   */
  axis: 'knob' | 'vertical' | 'horizontal';
  /** Screen rectangle of the drawn control, for scrub distance and bubble placement (read when a drag starts) */
  bounds: () => DOMRect | null;
  /** Readout text for a travel value, with units */
  format: (norm: number) => string;
  label: string;
  /** Mouse down on a fader track (not its cap) jumps there: return the travel, or null */
  jumpTo?: (clientX: number, clientY: number) => number | null;
  disabled?: boolean;
}

interface DragState {
  id: number;
  touch: boolean;
  x0: number;
  y0: number;
  lastX: number;
  lastY: number;
  t0: number;
  acc: number;
  moved: boolean;
  axis: 'x' | 'y' | null;
  longFine: boolean;
  mode: string;
  hint?: string;
  timer: ReturnType<typeof setTimeout> | null;
  /**
   * The control's screen rectangle and drag travel, measured once at pointer-down: the
   * page can't scroll during a drag, and reading them on every move would force a
   * layout after each value change
   */
  rect: DOMRect | null;
  travel: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Pointer handling for knobs and faders. One finger (or the mouse) per control;
 * several controls can be dragged at once with several fingers.
 */
export function useContinuousDrag(cfg: ContinuousDragConfig) {
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const drag = useRef<DragState | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const raf = useRef(0);
  const pending = useRef<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = useState(false);
  const [bubble, setBubbleState] = useState<BubbleState | null>(null);
  // Most moves change nothing the bubble shows (a detented knob between detents, a mouse
  // drag whose bubble stays put): skip those renders
  const shownBubble = useRef<BubbleState | null>(null);
  const setBubble = (b: BubbleState | null) => {
    const a = shownBubble.current;
    if (a === b || (a && b && a.x === b.x && a.y === b.y && a.value === b.value && a.label === b.label && a.mode === b.mode && a.hint === b.hint)) return;
    shownBubble.current = b;
    setBubbleState(b);
  };

  const flush = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
    if (pending.current !== null) {
      const n = pending.current;
      pending.current = null;
      cfgRef.current.commit(n);
    }
  }, []);

  const schedule = (n: number) => {
    pending.current = n;
    if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; flush(); });
  };

  const place = (d: DragState | null, clientX?: number, clientY?: number): { x: number; y: number } => {
    const r = d ? d.rect : cfgRef.current.bounds();
    const cx = r ? r.left + r.width / 2 : clientX ?? 0;
    const top = r ? r.top : clientY ?? 0;
    // On touch the finger covers the control: lift the bubble above the finger
    if (d?.touch && clientY !== undefined) return { x: Math.round(clientX ?? cx), y: Math.round(Math.min(top - 10, clientY - 64)) };
    return { x: Math.round(cx), y: Math.round(top - 10) };
  };

  const show = (norm: number, d: DragState | null, clientX?: number, clientY?: number, mode?: string) => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    const p = place(d, clientX, clientY);
    setBubble({ ...p, label: cfgRef.current.label, value: cfgRef.current.format(norm), mode: mode ?? (d?.mode || undefined), hint: d?.hint });
  };

  const hideSoon = (ms = 450) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { hideTimer.current = null; setBubble(null); }, ms);
  };

  /** Show the bubble briefly (keyboard and wheel changes) */
  const flash = useCallback((norm: number) => {
    show(norm, null);
    hideSoon(900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (e: React.PointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.timer) clearTimeout(d.timer);
    flush();
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* already released */ }
    endDrag();
    setDragging(false);
    const now = performance.now();
    lastTap.current = !cancelled && !d.moved && now - d.t0 < 300 ? { t: now, x: e.clientX, y: e.clientY } : null;
    hideSoon(d.moved ? 450 : 250);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const c = cfgRef.current;
    if (c.disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (drag.current) return; // one pointer per control; other fingers can hold other controls
    e.preventDefault();
    const now = performance.now();
    const lt = lastTap.current;
    if (lt && now - lt.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < DOUBLE_TAP_PX) {
      lastTap.current = null;
      c.reset();
      // Show what it reset to (the value arrives with the next render)
      requestAnimationFrame(() => { show(cfgRef.current.getNorm(), null, undefined, undefined, 'Reset to default'); hideSoon(900); });
      return;
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    const touch = e.pointerType !== 'mouse';
    let acc = c.getNorm();
    const jumped = !touch && c.jumpTo ? c.jumpTo(e.clientX, e.clientY) : null;
    if (jumped !== null && jumped !== undefined) {
      acc = clamp01(jumped);
      c.commit(acc);
    }
    const d: DragState = {
      id: e.pointerId, touch, x0: e.clientX, y0: e.clientY, lastX: e.clientX, lastY: e.clientY, t0: now,
      acc, moved: false, axis: null, longFine: false, mode: '', timer: null,
      hint: touch && takeScrubHint() ? (c.axis === 'horizontal' ? 'Slide up or down for finer control' : 'Slide sideways for finer control') : undefined,
      rect: c.bounds(), travel: Math.max(40, c.travelPx()),
    };
    if (touch) {
      // Hold still, then drag: fine adjust for the whole drag
      d.timer = setTimeout(() => {
        d.timer = null;
        if (drag.current === d && !d.moved) {
          d.longFine = true;
          d.mode = 'Fine';
          show(d.acc, d, d.lastX, d.lastY);
        }
      }, LONG_PRESS_MS);
    }
    drag.current = d;
    beginDrag();
    setDragging(true);
    if (touch || jumped !== null) show(acc, d, e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const c = cfgRef.current;
    const totX = e.clientX - d.x0;
    const totY = e.clientY - d.y0;
    if (!d.moved) {
      if (Math.hypot(totX, totY) <= TAP_SLOP_PX) return;
      d.moved = true;
      if (d.timer) { clearTimeout(d.timer); d.timer = null; }
    }
    const ddx = e.clientX - d.lastX;
    const ddy = e.clientY - d.lastY;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    const r = d.rect;
    let delta: number;
    let zone = { factor: 1, label: '' };
    if (c.axis === 'horizontal') {
      delta = ddx;
      if (d.touch && r) zone = scrubZone(Math.abs(e.clientY - (r.top + r.height / 2)) - r.height / 2);
    } else if (c.axis === 'vertical') {
      delta = -ddy;
      if (d.touch && r) zone = scrubZone(Math.abs(e.clientX - (r.left + r.width / 2)) - r.width / 2);
    } else if (d.touch) {
      delta = -ddy;
      if (r) zone = scrubZone(Math.abs(e.clientX - (r.left + r.width / 2)) - r.width / 2);
    } else {
      if (!d.axis) d.axis = Math.abs(totY) >= Math.abs(totX) ? 'y' : 'x';
      delta = d.axis === 'y' ? -ddy : ddx;
    }
    const fine = e.shiftKey || d.longFine || secondFingerDown();
    const factor = Math.max(0.02, zone.factor * (fine ? FINE_FACTOR : 1));
    d.acc = clamp01(d.acc + (delta * factor) / d.travel);
    d.mode = fine ? 'Fine' : zone.label;
    schedule(d.acc);
    show(d.acc, d, e.clientX, e.clientY);
  };

  // Release the page lock if the control disappears mid-drag (an encoder rebinds, a lesson ends)
  useEffect(() => () => {
    if (drag.current) {
      if (drag.current.timer) clearTimeout(drag.current.timer);
      drag.current = null;
      endDrag();
    }
    if (raf.current) cancelAnimationFrame(raf.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  return {
    dragging,
    bubble,
    flash,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => finish(e, false),
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => finish(e, true),
      onLostPointerCapture: (e: React.PointerEvent<HTMLElement>) => { if (drag.current?.id === e.pointerId) finish(e, true); },
    },
  };
}
