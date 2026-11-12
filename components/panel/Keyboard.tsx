'use client';

import { useRef } from 'react';

interface KeyboardProps {
  lowNote: number;
  numKeys: number;
  style?: 'piano' | 'membrane';
  held: Set<number>;
  /** velocity 0..1 - pressing lower on a key plays louder, like striking it harder */
  onNoteOn: (note: number, velocity: number) => void;
  onNoteOff: (note: number) => void;
}

const BLACK = new Set([1, 3, 6, 8, 10]);

/**
 * Multi-touch keyboard. Each finger (pointer) owns one note; sliding a finger
 * across keys glides to the new note, so chords and glissandi work on iPad.
 */
export default function Keyboard({ lowNote, numKeys, style = 'piano', held, onNoteOn, onNoteOff }: KeyboardProps) {
  const fingers = useRef(new Map<number, number>());
  const notes = Array.from({ length: numKeys }, (_, i) => lowNote + i);
  const whites = notes.filter(n => !BLACK.has(((n % 12) + 12) % 12));
  const whiteW = 100 / whites.length;

  const noteAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const k = el?.closest('[data-note]') as HTMLElement | null;
    return k ? Number(k.dataset.note) : null;
  };
  const velocityAt = (x: number, y: number): number => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-note]') as HTMLElement | null;
    if (!el) return 0.8;
    const r = el.getBoundingClientRect();
    return Math.max(0.25, Math.min(1, 0.3 + 0.7 * ((y - r.top) / r.height)));
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const n = noteAt(e.clientX, e.clientY);
    if (n === null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    fingers.current.set(e.pointerId, n);
    onNoteOn(n, velocityAt(e.clientX, e.clientY));
  };
  const move = (e: React.PointerEvent) => {
    const cur = fingers.current.get(e.pointerId);
    if (cur === undefined) return;
    const n = noteAt(e.clientX, e.clientY);
    if (n !== null && n !== cur) {
      fingers.current.set(e.pointerId, n);
      onNoteOff(cur);
      onNoteOn(n, velocityAt(e.clientX, e.clientY));
    }
  };
  const up = (e: React.PointerEvent) => {
    const cur = fingers.current.get(e.pointerId);
    if (cur === undefined) return;
    fingers.current.delete(e.pointerId);
    onNoteOff(cur);
  };

  let whiteIndex = -1;
  return (
    <div
      className="relative w-full h-full select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={e => e.preventDefault()}
    >
      {notes.map(n => {
        const black = BLACK.has(((n % 12) + 12) % 12);
        if (!black) whiteIndex++;
        const on = held.has(n);
        if (style === 'membrane') {
          return null;
        }
        if (black) {
          return (
            <div
              key={n}
              data-note={n}
              className="absolute top-0 rounded-b"
              style={{
                left: `${(whiteIndex + 1) * whiteW - whiteW * 0.32}%`,
                width: `${whiteW * 0.64}%`,
                height: '60%',
                zIndex: 2,
                background: on ? 'linear-gradient(#555, #333)' : 'linear-gradient(#222, #050505)',
                boxShadow: on ? 'inset 0 0 6px #f97316' : '0 3px 4px rgba(0,0,0,0.6)',
                border: '1px solid #000',
              }}
            />
          );
        }
        return (
          <div
            key={n}
            data-note={n}
            className="absolute top-0 bottom-0 rounded-b"
            style={{
              left: `${whiteIndex * whiteW}%`,
              width: `${whiteW}%`,
              background: on ? 'linear-gradient(#ffe2c7, #f5b27a)' : 'linear-gradient(#fdfdfd, #dcdcdc)',
              border: '1px solid #444',
              boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.15)',
            }}
          />
        );
      })}
      {style === 'membrane' && (
        <div className="absolute inset-0 flex gap-[2px]">
          {notes.map(n => {
            const black = BLACK.has(((n % 12) + 12) % 12);
            const on = held.has(n);
            return (
              <div
                key={n}
                data-note={n}
                className="flex-1 rounded-sm"
                style={{
                  marginTop: black ? 0 : '18%',
                  marginBottom: black ? '18%' : 0,
                  background: on ? '#f97316' : black ? '#1c1c1c' : '#3c3c3c',
                  border: '1px solid #555',
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
