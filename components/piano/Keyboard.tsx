'use client';

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { emitNoteOff, emitNoteOn, noteBus } from '@/lib/piano/input/bus';
import { isBlackKey, midiLabel, pitchClass } from '@/lib/piano/music/theory';

export type KeyMarkKind = 'target' | 'ok' | 'bad' | 'scale';

export interface KeyMark {
  kind: KeyMarkKind;
  /** Short text shown in a badge on the key, such as a finger number. */
  label?: string;
  badge?: 'hint' | 'accent' | 'ok' | 'ink';
}

export interface KeyboardProps {
  low: number;
  high: number;
  height?: number;
  marks?: Record<number, KeyMark>;
  /** Which white keys carry a letter name. */
  labels?: 'none' | 'c' | 'all';
  preferFlats?: boolean;
  /** Touching the keys plays notes. */
  interactive?: boolean;
  /** Play the piano sound for touches. */
  sound?: boolean;
  className?: string;
}

interface KeyGeom {
  midi: number;
  black: boolean;
  /** Left edge and width as fractions of the keyboard width. */
  x: number;
  w: number;
}

const BLACK_HEIGHT = 0.62;
/** Where each black key sits relative to the gap it straddles. */
const BLACK_SHIFT: Record<number, number> = { 1: -0.08, 3: 0.08, 6: -0.1, 8: 0, 10: 0.1 };

function snapLow(m: number): number {
  let n = m;
  while (isBlackKey(n)) n--;
  return n;
}
function snapHigh(m: number): number {
  let n = m;
  while (isBlackKey(n)) n++;
  return n;
}

export function layoutKeys(low: number, high: number): KeyGeom[] {
  const lo = snapLow(low);
  const hi = snapHigh(high);
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlackKey(m)) whites.push(m);
  const ww = 1 / whites.length;
  const keys: KeyGeom[] = whites.map((midi, i) => ({ midi, black: false, x: i * ww, w: ww }));
  const bw = ww * 0.6;
  whites.forEach((midi, i) => {
    const next = midi + 1;
    if (next <= hi && isBlackKey(next)) {
      const centre = (i + 1) * ww + BLACK_SHIFT[pitchClass(next)] * ww;
      keys.push({ midi: next, black: true, x: centre - bw / 2, w: bw });
    }
  });
  return keys;
}

/** Choose a comfortable keyboard range around the notes being played. */
export function keyboardRange(low: number, high: number, minWhiteKeys = 12): { low: number; high: number } {
  let lo = snapLow(low);
  let hi = snapHigh(high);
  // Extend to a C or F on the left and a B or E on the right so black key groups stay whole.
  while (![0, 5].includes(pitchClass(lo))) lo--;
  while (![4, 11].includes(pitchClass(hi))) hi++;
  const count = () => {
    let c = 0;
    for (let m = lo; m <= hi; m++) if (!isBlackKey(m)) c++;
    return c;
  };
  let flip = false;
  while (count() < minWhiteKeys) {
    if (flip && lo > 21) {
      lo--;
      while (![0, 5].includes(pitchClass(lo)) && lo > 21) lo--;
    } else if (hi < 108) {
      hi++;
      while (![4, 11].includes(pitchClass(hi)) && hi < 108) hi++;
    }
    flip = !flip;
    if (lo <= 21 && hi >= 108) break;
  }
  return { low: lo, high: hi };
}

function KeyboardInner({
  low,
  high,
  height = 180,
  marks,
  labels = 'c',
  preferFlats = false,
  interactive = true,
  sound = true,
  className,
}: KeyboardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const keyEls = useRef(new Map<number, HTMLDivElement>());
  const pointers = useRef(new Map<number, number>());
  const keys = useMemo(() => layoutKeys(low, high), [low, high]);
  const blackKeys = useMemo(() => keys.filter((k) => k.black), [keys]);
  const whiteKeys = useMemo(() => keys.filter((k) => !k.black), [keys]);

  // Show notes from any source (touch, MIDI, microphone) as pressed keys.
  useEffect(() => {
    const els = keyEls.current;
    const unsub = noteBus.subscribe((ev) => {
      const el = els.get(ev.midi);
      if (!el) return;
      if (ev.type === 'on') {
        el.classList.add('is-down');
        if (ev.source === 'mic') {
          // The microphone cannot hear a key being released, so show a short press.
          window.setTimeout(() => el.classList.remove('is-down'), 320);
        }
      } else {
        el.classList.remove('is-down');
      }
    });
    return () => {
      unsub();
      els.forEach((el) => el.classList.remove('is-down'));
    };
  }, [keys]);

  const keyAt = useCallback(
    (clientX: number, clientY: number): number | null => {
      const root = rootRef.current;
      if (!root) return null;
      const r = root.getBoundingClientRect();
      const fx = (clientX - r.left) / r.width;
      const fy = (clientY - r.top) / r.height;
      if (fx < 0 || fx > 1 || fy < -0.15 || fy > 1.2) return null;
      if (fy < BLACK_HEIGHT) {
        for (const k of blackKeys) {
          if (fx >= k.x && fx <= k.x + k.w) return k.midi;
        }
      }
      const i = Math.min(whiteKeys.length - 1, Math.max(0, Math.floor(fx * whiteKeys.length)));
      return whiteKeys[i].midi;
    },
    [blackKeys, whiteKeys],
  );

  const press = useCallback(
    (midi: number, clientY: number) => {
      const root = rootRef.current;
      let velocity = 0.7;
      if (root) {
        // Lower on the key plays a little louder, like a real key's leverage.
        const r = root.getBoundingClientRect();
        const fy = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
        velocity = 0.56 + 0.3 * fy;
      }
      if (sound) piano.noteOn(midi, velocity);
      emitNoteOn(midi, velocity, piano.now(), 'touch');
    },
    [sound],
  );

  const release = useCallback(
    (midi: number) => {
      if (sound) piano.noteOff(midi);
      emitNoteOff(midi, piano.now(), 'touch');
    },
    [sound],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive) return;
      e.preventDefault();
      void piano.resume();
      const midi = keyAt(e.clientX, e.clientY);
      if (midi === null) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety */
      }
      pointers.current.set(e.pointerId, midi);
      press(midi, e.clientY);
    },
    [interactive, keyAt, press],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive) return;
      const current = pointers.current.get(e.pointerId);
      if (current === undefined) return;
      const midi = keyAt(e.clientX, e.clientY);
      if (midi === null || midi === current) return;
      // Sliding to another key plays it, so a finger can glide.
      release(current);
      pointers.current.set(e.pointerId, midi);
      press(midi, e.clientY);
    },
    [interactive, keyAt, press, release],
  );

  const onPointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const current = pointers.current.get(e.pointerId);
      if (current === undefined) return;
      pointers.current.delete(e.pointerId);
      release(current);
    },
    [release],
  );

  // Release anything still held if the keyboard goes away mid touch.
  useEffect(() => {
    const held = pointers.current;
    return () => {
      held.forEach((midi) => {
        piano.noteOff(midi);
        emitNoteOff(midi, piano.now(), 'touch');
      });
      held.clear();
    };
  }, []);

  const setRef = useCallback((midi: number) => {
    return (el: HTMLDivElement | null) => {
      if (el) keyEls.current.set(midi, el);
      else keyEls.current.delete(midi);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`mc-kb ${className ?? ''}`}
      style={{ height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onContextMenu={(e) => e.preventDefault()}
      role="group"
      aria-label="Piano keyboard"
    >
      {keys.map((k) => {
        const mark = marks?.[k.midi];
        const pc = pitchClass(k.midi);
        const showLabel = !k.black && (labels === 'all' || (labels === 'c' && pc === 0));
        const isMiddleC = k.midi === 60;
        return (
          <div
            key={k.midi}
            ref={setRef(k.midi)}
            data-midi={k.midi}
            className={`mc-key ${k.black ? 'mc-key-b' : 'mc-key-w'} ${mark ? `mark-${mark.kind}` : ''}`}
            style={{
              left: `${k.x * 100}%`,
              width: `${k.w * 100}%`,
              height: k.black ? `${BLACK_HEIGHT * 100}%` : undefined,
            }}
          >
            {mark?.label !== undefined && (
              <span className={`mc-key-badge ${mark.badge ? `badge-${mark.badge}` : ''}`}>{mark.label}</span>
            )}
            {showLabel && (
              <span className="mc-key-label" style={isMiddleC && labels === 'c' ? { color: 'rgb(var(--mc-accent))' } : undefined}>
                {labels === 'c' ? midiLabel(k.midi, preferFlats, true) : midiLabel(k.midi, preferFlats)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const Keyboard = memo(KeyboardInner);

/** Briefly colour a key green or red. Used for right and wrong notes. */
export function flashKey(root: HTMLElement | null, midi: number, kind: 'ok' | 'bad', ms = 380): void {
  if (!root) return;
  const el = root.querySelector<HTMLElement>(`[data-midi="${midi}"]`);
  if (!el) return;
  const cls = `flash-${kind}`;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), ms);
}
