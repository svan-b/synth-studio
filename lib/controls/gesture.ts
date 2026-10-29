// ============================================================================
// Shared gesture logic for continuous controls (knobs, faders)
//
//   sensitivity    pixels of drag for the full travel, tuned to the control's size
//   fine adjust    Shift (desktop); on touch: a second finger anywhere off the
//                  controls, a long press before dragging, or sliding the finger
//                  sideways away from the control (iOS-style scrubbing)
//   wheel intent   a mouse wheel / trackpad scroll that started over the page keeps
//                  scrolling the page; one that starts over a control turns it
//   drag lock      while any control is dragged, the page cannot scroll or zoom
//
// All distances are screen (CSS) pixels, so the feel doesn't change with zoom.
// ============================================================================

import type { KnobSpec, SliderSpec } from '@/types';

type Continuous = Pick<KnobSpec, 'min' | 'max' | 'step'> | Pick<SliderSpec, 'min' | 'max' | 'step'>;

/** Pixels of drag for the full sweep of a knob `diameterPx` wide on screen */
export function knobTravelPx(diameterPx: number, spec: Continuous): number {
  // Bigger knobs get more travel (more precision), small ones stay quick to sweep
  let travel = Math.min(320, Math.max(180, 140 + diameterPx * 2.2));
  // Detented knobs: at least 12 px per detent so they never jitter between two values
  if (spec.step && spec.max > spec.min) {
    const detents = (spec.max - spec.min) / spec.step;
    if (detents <= 64) travel = Math.max(travel, detents * 12);
  }
  return travel;
}

/** Fine-adjust zones by how far the finger has slid sideways from the control's edge */
export const SCRUB_ZONES: { from: number; factor: number; label: string }[] = [
  { from: 0, factor: 1, label: '' },
  { from: 50, factor: 0.5, label: 'Half speed' },
  { from: 110, factor: 0.25, label: 'Quarter speed' },
  { from: 180, factor: 0.1, label: 'Fine' },
];

export function scrubZone(offsetPx: number): { factor: number; label: string } {
  let z = SCRUB_ZONES[0];
  for (const zone of SCRUB_ZONES) if (offsetPx >= zone.from) z = zone;
  return z;
}

export const FINE_FACTOR = 0.1;
export const LONG_PRESS_MS = 450;
export const TAP_SLOP_PX = 6;
export const DOUBLE_TAP_MS = 320;
export const DOUBLE_TAP_PX = 30;

// ---- second finger + page lock ----------------------------------------------

let activeDrags = 0;
const extraFingers = new Set<number>();
let installed = false;

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  // A finger that lands off the controls while a control is being dragged is a fine-adjust modifier
  window.addEventListener('pointerdown', e => {
    if (!activeDrags || e.pointerType === 'mouse') return;
    const t = e.target as Element | null;
    if (t && t.closest && t.closest('[data-control], [data-jack], button, input, select, textarea, a')) return;
    extraFingers.add(e.pointerId);
    e.preventDefault();
  }, { capture: true, passive: false });
  const lift = (e: PointerEvent) => { extraFingers.delete(e.pointerId); };
  window.addEventListener('pointerup', lift, true);
  window.addEventListener('pointercancel', lift, true);
  // Wheel gestures: remember when the current one started
  window.addEventListener('wheel', () => {
    const now = performance.now();
    if (now - lastWheel > WHEEL_GAP_MS) wheelGestureStart = now;
    lastWheel = now;
  }, { capture: true, passive: true });
}

let savedTouchAction: string | null = null;

/** A control drag started: lock the page (no scroll, no pinch) and watch for a second finger */
export function beginDrag(): void {
  install();
  activeDrags++;
  if (activeDrags === 1 && typeof document !== 'undefined') {
    // Touches that start while a control is held (a second finger) must not scroll or zoom
    const root = document.documentElement;
    savedTouchAction = root.style.touchAction;
    root.style.touchAction = 'none';
    root.dataset.controlDrag = '1';
  }
}

export function endDrag(): void {
  if (!activeDrags) return;
  activeDrags--;
  if (!activeDrags) {
    extraFingers.clear();
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.touchAction = savedTouchAction ?? '';
      delete root.dataset.controlDrag;
    }
  }
}

/** Is any control being dragged right now? */
export function isDragging(): boolean {
  return activeDrags > 0;
}

/** Is a second finger resting off the controls (fine adjust)? */
export function secondFingerDown(): boolean {
  return extraFingers.size > 0;
}

// ---- wheel intent -------------------------------------------------------------

const WHEEL_GAP_MS = 220;
let lastWheel = -1e9;
let wheelGestureStart = -1e9;

/** Call on pointerenter; returns the timestamp to pass to `wheelBelongsToControl` */
export function markPointerEnter(): number {
  install();
  return performance.now();
}

/**
 * Should a wheel event over a control turn it? Only when the scroll gesture began
 * while the pointer was already over it - a page scroll that sweeps across a knob
 * keeps scrolling the page.
 */
export function wheelBelongsToControl(enteredAt: number): boolean {
  install();
  return wheelGestureStart >= enteredAt;
}

/** Wheel delta in pixels (lines and pages converted), sign: positive = turn up */
export function wheelDelta(e: WheelEvent): number {
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  const dy = e.deltaY * unit;
  const dx = e.deltaX * unit;
  // Shift+wheel arrives as deltaX in some browsers
  return Math.abs(dy) >= Math.abs(dx) ? -dy : dx;
}

// ---- first-use hint ---------------------------------------------------------------

const HINT_KEY = 'synth-studio-scrub-hints';

/** Show the "slide sideways for fine" hint on the first few touch drags only */
export function takeScrubHint(): boolean {
  try {
    const n = Number(localStorage.getItem(HINT_KEY) ?? '0');
    if (n >= 3) return false;
    localStorage.setItem(HINT_KEY, String(n + 1));
    return true;
  } catch {
    return false;
  }
}
