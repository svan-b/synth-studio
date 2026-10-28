// ============================================================================
// Mother-32 custom panel elements: the 13-key button keyboard (with key LEDs
// and KB-mode pattern recording), the HOLD/REST and RESET/ACCENT buttons and
// the SHIFT + RUN/STOP = REC overlay.
//
// These are `custom` layout elements because recording writes the pattern
// controls (seq_notes / seq_accent) - something only the UI can do - and the
// buttons change meaning while recording, as on the hardware.
// Written with createElement (no JSX) so the data validator can load the file.
// ============================================================================

import { createElement as h, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { ControlValue } from '@/types';
import type { PanelContext } from '@/types/panel';
import { EMPTY_PATTERN, KB_LOW, NO_ACCENTS, REST, STEPS, encodeNote, patternLength } from './sequence';
import { MOTHER32 } from './spec';

export type CustomCtx = PanelContext & { setValue: (id: string, v: ControlValue) => void; sendEvent: (e: string, payload?: unknown) => void };

const DEFAULT_NOTES = (MOTHER32.controls.seq_notes as { default: string }).default;
const DEFAULT_ACCENTS = (MOTHER32.controls.seq_accent as { default: string }).default;

const notesOf = (c: CustomCtx) => (typeof c.values.seq_notes === 'string' ? c.values.seq_notes : DEFAULT_NOTES).padEnd(STEPS, '.');
const accentsOf = (c: CustomCtx) => (typeof c.values.seq_accent === 'string' ? c.values.seq_accent : DEFAULT_ACCENTS).padEnd(STEPS, '0');

/** Store one step (a note char or REST) at the record position and advance */
function recordStep(c: CustomCtx, ch: string) {
  const notes = notesOf(c);
  const pos = patternLength(notes);
  if (pos >= STEPS) { c.setValue('rec', false); return; }
  const accent = !!c.engine.pendingAccent && ch !== REST;
  c.setValue('seq_notes', notes.slice(0, pos) + ch + notes.slice(pos + 1));
  const acc = accentsOf(c);
  c.setValue('seq_accent', acc.slice(0, pos) + (accent ? '1' : '0') + acc.slice(pos + 1));
  if (c.engine.pendingAccent) c.sendEvent('accent_clear');
  if (pos + 1 >= STEPS) c.setValue('rec', false);
}

// --- Shared button look (matches components/controls/Button rect caps) ---------

interface CapProps {
  id: string;
  w: number;
  h: number;
  lit: number;
  ledColor: string;
  text?: string;
  onDown: () => void;
  onUp?: () => void;
  title?: string;
}

function Cap({ id, w, h: ht, lit, ledColor, text, onDown, onUp, title }: CapProps) {
  const pressed = useRef(false);
  return h('button', {
    'data-control': id,
    title,
    'aria-label': title ?? id,
    'aria-pressed': lit > 0,
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      e.stopPropagation();
      pressed.current = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      onDown();
    },
    onPointerUp: () => { if (pressed.current) { pressed.current = false; onUp?.(); } },
    onPointerCancel: () => { if (pressed.current) { pressed.current = false; onUp?.(); } },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
    className: 'absolute active:scale-95 transition-transform select-none',
    style: {
      left: 0, top: 0, width: w, height: ht, touchAction: 'none', borderRadius: 3,
      border: '2px solid #3a3a3a',
      background: lit > 0 ? `radial-gradient(circle at 50% 40%, ${ledColor} 0%, #1c1c1c 85%)` : 'linear-gradient(#2a2a2a, #161616)',
      boxShadow: lit > 0 ? `0 0 ${6 + 8 * lit}px ${ledColor}` : 'inset 0 2px 4px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05)',
      color: lit > 0.5 ? '#000' : '#ddd',
      fontSize: 9, fontWeight: 700, lineHeight: 1,
    },
  }, text ?? null);
}

// --- 13-key keyboard -----------------------------------------------------------

const WHITE = [0, 2, 4, 5, 7, 9, 11, 12];
const BLACK: [number, number][] = [[1, 1], [3, 2], [6, 4], [8, 5], [10, 6]]; // semitone, boundary after white #n

function Keyboard({ c, w, h: ht, k }: { c: CustomCtx; w: number; h: number; k: number }) {
  const { values, engine, setValue, sendEvent } = c;
  const rec = !!values.rec;
  const latest = useRef(c);
  latest.current = c;

  // RUN/STOP while recording ends the recording (it does not start playback)
  useEffect(() => {
    if (values.rec && values.run_stop) {
      setValue('rec', false);
      setValue('run_stop', false);
    }
  }, [values.rec, values.run_stop, setValue]);

  const W = w * k, H = ht * k;
  const slot = W / 8;
  const whiteW = Math.min(slot - 3 * k, 13 * k), whiteH = 8 * k;
  const blackW = Math.min(slot - 4 * k, 11 * k), blackH = 7 * k;
  const lit = typeof engine.litKey === 'number' ? engine.litKey : -1;

  const press = (i: number) => {
    const cur = latest.current;
    if (cur.values.rec) {
      const octave = typeof cur.engine.octave === 'number' ? cur.engine.octave : 0;
      recordStep(cur, encodeNote(KB_LOW + 12 * octave + i));
    }
    cur.sendEvent('key', { i, on: true });
  };
  const release = (i: number) => latest.current.sendEvent('key', { i, on: false });

  const key = (i: number, x: number, y: number, kw: number, kh: number) =>
    h('div', { key: i, className: 'absolute', style: { left: x - kw / 2, top: y - kh / 2, width: kw, height: kh } },
      h(Cap, {
        id: `key_${i}`, w: kw, h: kh, lit: lit === i ? 1 : 0, ledColor: '#ff3b30',
        onDown: () => press(i), onUp: () => release(i), title: `Key ${i + 1}`,
      }));

  const notes = notesOf(c);
  const len = patternLength(notes);
  const step = typeof engine.step === 'number' ? engine.step : -1;
  const octave = typeof engine.octave === 'number' ? engine.octave : 0;
  const status = rec
    ? `REC ${String(Math.min(len + 1, STEPS)).padStart(2, '0')}/${STEPS}${engine.pendingAccent ? ' ACC' : ''}`
    : engine.playing
    ? `STEP ${String(step + 1).padStart(2, '0')}/${len}`
    : `${len} STEPS`;

  return h('div', { className: 'relative select-none', style: { width: W, height: H } },
    ...WHITE.map((s, j) => key(s, (j + 0.5) * slot, H - whiteH / 2 - 0.5 * k, whiteW, whiteH)),
    ...BLACK.map(([s, b]) => key(s, b * slot, blackH / 2 + 1 * k, blackW, blackH)),
    // Teaching readout (not on the hardware): pattern position, record state and octave
    h('div', {
      className: 'absolute font-mono pointer-events-none whitespace-nowrap text-center',
      style: { left: 3 * slot - slot * 0.5, width: slot, top: 1.5 * k, fontSize: 8, lineHeight: 1.25, color: rec ? '#ff6b5f' : '#8a8a8a' },
    }, status, h('br'), `OCT ${octave > 0 ? '+' : ''}${octave}${engine.transpose ? ` · TR ${(engine.transpose as number) > 0 ? '+' : ''}${engine.transpose}` : ''}`),
  );
}

export const renderKeyboard = (w: number, ht: number, k: number) => (c: CustomCtx) => h(Keyboard, { c, w, h: ht, k });

// --- HOLD/REST, RESET/ACCENT, REC overlay ---------------------------------------

function FnButton({ c, which, w, h: ht, k }: { c: CustomCtx; which: 'hold' | 'reset' | 'rec'; w: number; h: number; k: number }) {
  const latest = useRef(c);
  latest.current = c;
  const { values, engine } = c;
  const W = w * k, H = ht * k;

  if (which === 'rec') {
    // Only present while SHIFT is latched: RUN/STOP's second function
    if (!values.shift) return null;
    return h(Cap, {
      id: 'rec_overlay', w: W, h: H, lit: 0.55, ledColor: '#ff3b30', text: 'REC', title: 'SHIFT + RUN/STOP = REC: record a pattern from the keyboard',
      onDown: () => {
        const cur = latest.current;
        cur.setValue('run_stop', false);
        cur.setValue('seq_notes', EMPTY_PATTERN);
        cur.setValue('seq_accent', NO_ACCENTS);
        cur.sendEvent('accent_clear');
        cur.setValue('rec', true);
        cur.setValue('shift', false);
      },
    });
  }

  if (which === 'hold') {
    return h(Cap, {
      id: 'hold_rest', w: W, h: H, lit: values.rec ? 0 : engine.hold ? 1 : 0, ledColor: '#ffffff',
      title: 'HOLD (while running: repeat the current step) / REST (while recording: store a rest)',
      onDown: () => {
        const cur = latest.current;
        if (cur.values.rec) recordStep(cur, REST);
        else cur.sendEvent('hold');
      },
      onUp: () => { if (!latest.current.values.rec) latest.current.sendEvent('hold:up'); },
    });
  }

  return h(Cap, {
    id: 'reset_accent', w: W, h: H, lit: values.rec && engine.pendingAccent ? 1 : 0, ledColor: '#ffb020',
    title: 'RESET (while running: back to step 1) / ACCENT (while recording: accent the next note)',
    onDown: () => {
      const cur = latest.current;
      cur.sendEvent(cur.values.rec ? 'accent_toggle' : 'reset');
    },
  });
}

export const renderFn = (which: 'hold' | 'reset' | 'rec', w: number, ht: number, k: number) =>
  (c: CustomCtx) => h(FnButton, { c, which, w, h: ht, k });
