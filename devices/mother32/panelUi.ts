// ============================================================================
// Mother-32 panel: the sequencer section (13-key keyboard, function buttons,
// OCTAVE / LOCATION and step LEDs), the teaching readout and the Setup page.
//
// These are `custom` elements because the buttons change meaning with the mode,
// SHIFT and the pending two-button gestures, exactly as on the hardware, and
// because editing writes the pattern lanes and the 64-pattern memory - something
// only the UI can do. State: control values (rec, seq_mode, shift, kb_octave, the
// lanes), device data (pattern memory) and ephemeral `ui` (selected step, page,
// pending gesture). Mouse users get latching SHIFT / PATTERN / SET END; on a touch
// screen they can also be held while pressing the second button.
// Written with createElement (no JSX) so the data validator can load the file.
// ============================================================================

import { createElement as h, useEffect, useRef } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { ControlValue } from '@/types';
import type { CustomRenderContext } from '@/types/panel';
import {
  END, LOCATIONS, STEPS, type Mother32Data, type PatternValues, asData, blankPattern, decodeNote, encodeNote,
  lengthOf, locName, normalize, noteName, patternOf, rotate, samePattern, setLaneChar, stepAt,
} from './sequence';
import { ASSIGN_SOURCES, DIVISIONS, TEMPO_MODES, octaveLow } from './model';

type C = CustomRenderContext;

export interface M32Ui {
  sel?: number;              // STEP mode: the step being edited (-1 = none)
  page?: number;             // STEP mode: 0..3 (steps 1-8 ... 25-32)
  latch?: 'pattern' | 'bank' | 'setEnd' | 'save' | null;
  saveLoc?: number;
  saveBank?: boolean;        // save mode: the next pad picks the bank
  recBackup?: PatternValues;
  setup?: boolean;
  msg?: string;
  msgAt?: number;
}

export const ui = (c: { ui?: Record<string, unknown> }) => (c.ui ?? {}) as M32Ui;
const num = (v: ControlValue | undefined, d = 0) => (typeof v === 'number' ? v : v === true ? 1 : v === false ? 0 : d);
export const isStepMode = (values: Record<string, ControlValue>) => num(values.seq_mode) === 1;

/** Steps recorded so far in KB-mode recording (the record position) */
export const recCount = (values: Record<string, ControlValue>) => {
  const s = typeof values.seq_notes === 'string' ? values.seq_notes : '';
  const i = s.indexOf(END);
  return i < 0 ? STEPS : i;
};

/** The step the TEMPO / GLIDE knobs edit right now, or -1 */
export function editTarget(values: Record<string, ControlValue>, u: M32Ui): number {
  if (values.rec) return recCount(values) - 1;
  if (isStepMode(values) && typeof u.sel === 'number' && u.sel >= 0) return u.sel;
  return -1;
}

export function dataOf(c: { data?: unknown }): Mother32Data {
  return asData(c.data) ?? { v: 1, loc: 0, bank: new Array(LOCATIONS).fill(null) };
}

// ----------------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------------

function setPattern(c: C, p: PatternValues) {
  c.setValue('seq_notes', p.seq_notes);
  c.setValue('seq_accent', p.seq_accent);
  c.setValue('seq_gate', p.seq_gate);
  c.setValue('seq_glide', p.seq_glide);
  c.setValue('seq_ratchet', p.seq_ratchet);
  c.setValue('seq_rest', p.seq_rest);
  c.setValue('seq_length', p.seq_length);
}

function flash(c: C, msg: string) {
  c.setUi({ msg, msgAt: Date.now() });
}

function loadLoc(c: C, loc: number) {
  const d = dataOf(c);
  const p = d.bank[loc];
  if (p) setPattern(c, p);
  c.updateData(x => ({ ...dataOf({ data: x }), loc }));
  flash(c, p ? `Pattern ${locName(loc)} loaded` : `Pattern ${locName(loc)} is empty - record or save one there`);
}

function saveTo(c: C, loc: number) {
  const p = normalize(c.values);
  c.updateData(x => {
    const d = dataOf({ data: x });
    const bank = d.bank.slice();
    bank[loc] = p;
    return { ...d, bank, loc };
  });
  c.setUi({ latch: null, saveBank: false });
  flash(c, `Saved to ${locName(loc)}`);
}

function startRec(c: C) {
  c.setValue('run_stop', false);
  c.setUi({ recBackup: patternOf(c.values), sel: -1, latch: null });
  setPattern(c, blankPattern());
  c.setValue('seq_mode', 0);
  c.setValue('rec', true);
}

function endRec(c: C) {
  const n = recCount(c.values);
  c.setValue('rec', false);
  if (n === 0) {
    const b = ui(c).recBackup;
    if (b) setPattern(c, b);
    flash(c, 'Nothing recorded - pattern restored');
  } else {
    setPattern(c, { ...normalize(c.values), seq_length: n });
    flash(c, `Recorded ${n} step${n > 1 ? 's' : ''} - SHIFT + hold RUN / STOP to save`);
  }
}

/** Record one step (a note, or a rest) at the record position */
function recordStep(c: C, note: number | null) {
  const v = c.values;
  const i = recCount(v);
  if (i >= STEPS) { endRec(c); return; }
  const prev = i > 0 ? decodeNote(String(v.seq_notes)[i - 1]) : null;
  const n = note ?? prev ?? 48;
  c.setValue('seq_notes', setLaneChar(v, 'seq_notes', i, encodeNote(n)));
  c.setValue('seq_rest', setLaneChar(v, 'seq_rest', i, note === null ? '1' : '0'));
  c.setValue('seq_accent', setLaneChar(v, 'seq_accent', i, '0'));
  c.setValue('seq_glide', setLaneChar(v, 'seq_glide', i, '0'));
  c.setValue('seq_ratchet', setLaneChar(v, 'seq_ratchet', i, '1'));
  c.setValue('seq_length', Math.max(1, i + 1));
  if (i + 1 >= STEPS) { setTimeout(() => endRec(c), 0); }
}

/** Write one field of a step (normalising a legacy pattern first) */
function editStep(c: C, i: number, lane: 'seq_notes' | 'seq_accent' | 'seq_gate' | 'seq_glide' | 'seq_ratchet' | 'seq_rest', ch: string) {
  const v = c.values;
  let base: Record<string, ControlValue> = v;
  if (typeof v.seq_notes === 'string' && v.seq_notes.indexOf(END) >= 0 && !v.rec) {
    const p = normalize(v);
    setPattern(c, p);
    base = { ...v, ...p };
  }
  c.setValue(lane, setLaneChar(base, lane, i, ch));
}

function toggle(c: C, i: number, lane: 'seq_accent' | 'seq_rest' | 'seq_glide') {
  const s = stepAt(c.values, i);
  const on = lane === 'seq_accent' ? s.accent : lane === 'seq_rest' ? s.rest : s.glide;
  editStep(c, i, lane, on ? '0' : '1');
}

function setEnd(c: C, len: number) {
  const p = normalize(c.values);
  setPattern(c, { ...p, seq_length: Math.max(1, Math.min(STEPS, len)) });
  flash(c, `Pattern length ${len}`);
}

// ----------------------------------------------------------------------------
// SHIFT: tap = latch (lets go after the next button); hold = classic modifier
// ----------------------------------------------------------------------------

const live = new Map<string, { shiftHeld: boolean; used: boolean }>();
const liveOf = (c: C) => { let x = live.get(c.instance); if (!x) { x = { shiftHeld: false, used: false }; live.set(c.instance, x); } return x; };

function consumeShift(c: C): boolean {
  const on = !!c.values.shift;
  if (on) {
    const l = liveOf(c);
    if (l.shiftHeld) l.used = true;
    else c.setValue('shift', false);
  }
  return on;
}

// ----------------------------------------------------------------------------
// Button caps
// ----------------------------------------------------------------------------

interface CapProps {
  id: string;
  w: number;
  h: number;
  lit: number;
  color: string;
  label: string;
  shape?: 'pad' | 'left' | 'right';
  blink?: boolean;
  target?: 'on' | 'off' | null;   // lesson highlight: 'off' = still to do, 'on' = done
  onDown: () => void;
  onUp?: () => void;
}

function Cap({ id, w, h: ht, lit, color, label, shape = 'pad', blink, target, onDown, onUp }: CapProps) {
  const pressed = useRef(false);
  const clip = shape === 'left' ? 'polygon(32% 0, 100% 0, 100% 100%, 32% 100%, 0 50%)'
    : shape === 'right' ? 'polygon(0 0, 68% 0, 100% 50%, 68% 100%, 0 100%)' : undefined;
  const glow = lit > 0 ? `0 0 ${4 + 8 * lit}px ${color}` : 'none';
  const ring = target === 'off' ? '0 0 0 2px #f97316, 0 0 10px #f97316' : target === 'on' ? '0 0 0 2px #22c55e' : '';
  const style: CSSProperties = {
    position: 'absolute', left: 0, top: 0, width: w, height: ht, touchAction: 'none', padding: 0,
    borderRadius: shape === 'pad' ? 3 : 2, clipPath: clip,
    border: shape === 'pad' ? '1px solid #4a4a4a' : 'none',
    background: lit > 0
      ? `radial-gradient(circle at 50% 45%, ${color} 0%, ${mixDark(color)} 75%)`
      : 'linear-gradient(180deg, #343434 0%, #1d1d1d 100%)',
    boxShadow: [lit > 0 ? glow : 'inset 0 -2px 3px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 3px rgba(0,0,0,0.6)', ring].filter(Boolean).join(', '),
    opacity: blink ? undefined : 1,
    cursor: 'pointer',
  };
  return h('button', {
    'data-control': id,
    title: label,
    'aria-label': label,
    'aria-pressed': lit > 0,
    className: `select-none active:scale-95 transition-transform ${blink ? 'animate-pulse' : ''} ${target === 'off' ? 'animate-pulse' : ''}`,
    style,
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      e.stopPropagation();
      pressed.current = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
      onDown();
    },
    onPointerUp: () => { if (pressed.current) { pressed.current = false; onUp?.(); } },
    onPointerCancel: () => { if (pressed.current) { pressed.current = false; onUp?.(); } },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });
}

const mixDark = (c: string) => (c === '#ffffff' || c === '#f5f5f5' ? '#6b6b6b' : '#2a1010');

/** Lesson highlight for a cap bound to `control` */
function targetOf(c: C, control: string, value?: ControlValue): 'on' | 'off' | null {
  const st = c.step;
  if (!c.teaching || !st || st.control !== control) return null;
  if (value !== undefined && st.targetValue !== value) return null;
  return c.values[control] === st.targetValue ? 'on' : 'off';
}

// ----------------------------------------------------------------------------
// Function buttons
// ----------------------------------------------------------------------------

export type FnKind = 'hold' | 'pattern' | 'reset' | 'shift' | 'run' | 'kb' | 'step';

function FnButton({ c, kind, w, h: ht }: { c: C; kind: FnKind; w: number; h: number }) {
  const latest = useRef(c);
  latest.current = c;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const momentary = useRef<string | null>(null);
  const savedLong = useRef(false);
  const v = c.values, u = ui(c);
  const playing = !!c.engine.playing;
  const step = isStepMode(v);

  const down = () => {
    const cur = latest.current;
    const cv = cur.values, cu = ui(cur);
    const running = !!cur.engine.playing;
    const editing = editTarget(cv, cu) >= 0;
    switch (kind) {
      case 'shift': {
        const l = liveOf(cur);
        if (cv.shift) { cur.setValue('shift', false); l.shiftHeld = false; return; }
        cur.setValue('shift', true);
        l.shiftHeld = true; l.used = false;
        return;
      }
      case 'run': {
        if (cv.shift) {
          // SHIFT + RUN / STOP: REC on a tap, SAVE when held for a second; in save mode, confirm
          if (cu.latch === 'save') { consumeShift(cur); saveTo(cur, cu.saveLoc ?? dataOf(cur).loc); return; }
          savedLong.current = false;
          holdTimer.current = setTimeout(() => {
            savedLong.current = true;
            const c2 = latest.current;
            consumeShift(c2);
            if (c2.values.rec) endRec(c2);
            c2.setUi({ latch: 'save', saveLoc: dataOf(c2).loc, saveBank: false });
          }, 1000);
          return;
        }
        if (cv.rec) { endRec(cur); return; }
        if (cu.latch === 'save') { cur.setUi({ latch: null, saveBank: false }); flash(cur, 'Save cancelled'); return; }
        cur.setValue('run_stop', !cv.run_stop);
        return;
      }
      case 'hold': {
        if (cv.shift) { consumeShift(cur); if (running) { momentary.current = 'live_mute'; cur.sendEvent('live_mute'); } return; }
        if (cv.rec) { recordStep(cur, null); return; }
        if (editing) { toggle(cur, editTarget(cv, cu), 'seq_rest'); return; }
        if (running) { momentary.current = 'hold'; cur.sendEvent('hold'); }
        return;
      }
      case 'reset': {
        if (cv.shift) { consumeShift(cur); if (running) { momentary.current = 'live_accent'; cur.sendEvent('live_accent'); } return; }
        if (cu.latch === 'pattern') { cur.setUi({ latch: null }); loadLoc(cur, dataOf(cur).loc); flash(cur, `Pattern ${locName(dataOf(cur).loc)} restored`); return; }
        if (editing) { toggle(cur, editTarget(cv, cu), 'seq_accent'); return; }
        cur.sendEvent('reset');
        return;
      }
      case 'pattern': {
        if (cu.latch === 'save') { consumeShift(cur); cur.setUi({ saveBank: !cu.saveBank }); return; }
        const want = cv.shift ? 'bank' : 'pattern';
        consumeShift(cur);
        cur.setUi({ latch: cu.latch === want ? null : want });
        return;
      }
      case 'kb':
      case 'step': {
        const dir = kind === 'kb' ? -1 : 1;
        if (cv.shift) {
          consumeShift(cur);
          cur.setValue('seq_mode', kind === 'kb' ? 0 : 1);
          cur.setUi({ sel: -1, latch: null });
          flash(cur, kind === 'kb' ? 'KB mode: the keys play, record and transpose' : 'STEP mode: tap a pad to switch a step on or off; SHIFT + pad edits it');
          return;
        }
        if (cu.latch === 'save') {
          const d = dataOf(cur);
          const loc = cu.saveLoc ?? d.loc;
          const nl = cu.saveBank ? (((Math.floor(loc / 8) + dir + 8) % 8) * 8 + (loc % 8)) : (Math.floor(loc / 8) * 8 + ((loc % 8) + dir + 8) % 8);
          cur.setUi({ saveLoc: nl });
          return;
        }
        if (step && !editing) {
          // STEP mode: the arrows rotate the pattern (firmware 2.0)
          setPattern(cur, rotate(normalize(cur.values), dir as -1 | 1));
          flash(cur, `Pattern rotated ${dir < 0 ? 'left' : 'right'}`);
          return;
        }
        const o = Math.max(0, Math.min(7, Math.round(num(cv.kb_octave, 3)) + dir));
        cur.setValue('kb_octave', o);
        return;
      }
    }
  };

  const up = () => {
    const cur = latest.current;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      if (!savedLong.current && kind === 'run') {
        consumeShift(cur);
        if (cur.values.rec) endRec(cur); else startRec(cur);
      }
    }
    if (kind === 'shift') {
      const l = liveOf(cur);
      l.shiftHeld = false;
      if (l.used) { l.used = false; cur.setValue('shift', false); }
    }
    if (momentary.current) { cur.sendEvent(`${momentary.current}:up`); momentary.current = null; }
  };

  let lit = 0, color = '#ff3b30', blink = false, target: 'on' | 'off' | null = null;
  const label = { hold: 'HOLD / REST', pattern: 'PATTERN (BANK)', reset: 'RESET / ACCENT', shift: '(SHIFT)', run: 'RUN / STOP (REC)', kb: '(KB) octave down', step: '(STEP) octave up' }[kind];
  switch (kind) {
    case 'shift': lit = v.shift ? 1 : 0; color = '#f5f5f5'; target = targetOf(c, 'shift'); break;
    case 'run': lit = v.rec ? 0.8 : playing ? 1 : 0; blink = !!v.rec || u.latch === 'save'; target = targetOf(c, 'run_stop') ?? targetOf(c, 'rec'); break;
    case 'pattern': lit = u.latch === 'pattern' || u.latch === 'bank' || (u.latch === 'save' && u.saveBank) ? 0.9 : 0; color = '#ffb020'; blink = lit > 0; break;
    case 'kb': lit = !step ? 0.35 : 0; color = '#22c55e'; target = targetOf(c, 'seq_mode', 0) ?? targetOf(c, 'kb_octave'); break;
    case 'step': lit = step ? 0.6 : 0; color = '#22c55e'; target = targetOf(c, 'seq_mode', 1); break;
    default: break;
  }
  return h(Cap, {
    id: kind === 'run' ? 'run_stop' : kind === 'shift' ? 'shift' : `m32_${kind}`, w, h: ht, lit, color, label, blink, target,
    shape: kind === 'kb' ? 'left' : kind === 'step' ? 'right' : 'pad',
    onDown: down, onUp: up,
  });
}

export const renderFn = (kind: FnKind, w: number, ht: number, k: number) => (c: C) => h(FnButton, { c, kind, w: w * k, h: ht * k });

// ----------------------------------------------------------------------------
// The 13 keys (white: the step pads 1-8; black: 1-8 / 9-16 / 17-24 / 25-32 / SET END)
// ----------------------------------------------------------------------------

/** Keyboard index (0..12 semitones) of white pad n (0..7) and black key n (0..4) */
export const WHITE = [0, 2, 4, 5, 7, 9, 11, 12];
export const BLACK = [1, 3, 6, 8, 10];

function KeyButton({ c, i, w, h: ht }: { c: C; i: number; w: number; h: number }) {
  const latest = useRef(c);
  latest.current = c;
  const sounding = useRef(false);
  const white = WHITE.indexOf(i);
  const black = BLACK.indexOf(i);
  const v = c.values, u = ui(c);
  const step = isStepMode(v);

  const down = () => {
    const cur = latest.current;
    const cv = cur.values, cu = ui(cur);
    const d = dataOf(cur);
    const editing = isStepMode(cv) && typeof cu.sel === 'number' && cu.sel >= 0;
    const note = octaveLow(num(cv.kb_octave, 3)) + i;
    // Pending two-button gestures take the step pads first
    if (cu.latch && white >= 0) {
      if (cu.latch === 'pattern') { cur.setUi({ latch: null }); loadLoc(cur, Math.floor(d.loc / 8) * 8 + white); return; }
      if (cu.latch === 'bank') { cur.setUi({ latch: null }); loadLoc(cur, white * 8 + (d.loc % 8)); return; }
      if (cu.latch === 'save') {
        const loc = cu.saveLoc ?? d.loc;
        cur.setUi({ saveLoc: cu.saveBank ? white * 8 + (loc % 8) : Math.floor(loc / 8) * 8 + white, saveBank: false });
        return;
      }
      if (cu.latch === 'setEnd') { cur.setUi({ latch: null }); setEnd(cur, (cu.page ?? 0) * 8 + white + 1); return; }
    }
    if (isStepMode(cv)) {
      const page = cu.page ?? 0;
      if (cv.shift && white >= 0) {
        // SHIFT + pad: edit that step (SHIFT + the same pad again: stop editing)
        consumeShift(cur);
        const idx = page * 8 + white;
        if (cu.sel === idx) { cur.setUi({ sel: -1 }); return; }
        cur.setUi({ sel: idx });
        const s = stepAt(cv, idx);
        if (s.note !== null) cur.sendEvent('preview', s.note);
        return;
      }
      if (editing) {
        // While a step is edited the keyboard sets its note (the arrows pick the octave)
        const idx = cu.sel!;
        editStep(cur, idx, 'seq_notes', encodeNote(note));
        if (stepAt(cv, idx).rest) editStep(cur, idx, 'seq_rest', '0');
        cur.sendEvent('preview', note);
        return;
      }
      if (white >= 0) {
        const idx = page * 8 + white;
        if (idx < lengthOf(cv)) toggle(cur, idx, 'seq_rest');
        else flash(cur, `Step ${idx + 1} is past the end - SET END + a pad to make the pattern longer`);
        return;
      }
      if (black >= 0 && black < 4) { cur.setUi({ page: black }); return; }
      if (black === 4) { cur.setUi({ latch: cu.latch === 'setEnd' ? null : 'setEnd' }); return; }
      return;
    }
    // KB mode: the keys play (recording happens when the engine reports the note)
    sounding.current = true;
    cur.sendEvent('key', { i, on: true });
  };
  const up = () => {
    if (sounding.current) { sounding.current = false; latest.current.sendEvent('key', { i, on: false }); }
  };

  // Lit state
  let lit = 0, color = '#ff3b30', blink = false;
  if (!step) {
    const lk = typeof c.engine.litKey === 'number' ? c.engine.litKey : -1;
    lit = lk === i ? 1 : 0;
  } else if (black >= 0) {
    if (black < 4 && (u.page ?? 0) === black) { lit = 0.55; color = '#ffb020'; }
    if (black === 4 && u.latch === 'setEnd') { lit = 0.9; color = '#ffb020'; blink = true; }
  }
  const label = step
    ? white >= 0 ? `Step pad ${white + 1}` : black < 4 ? ['1-8', '9-16', '17-24', '25-32'][black] : 'SET END'
    : `Key ${noteName(octaveLow(num(v.kb_octave, 3)) + i)}`;
  return h(Cap, { id: `key_${i}`, w, h: ht, lit, color, label, blink, onDown: down, onUp: up });
}

export const renderKey = (i: number, w: number, ht: number, k: number) => (c: C) => h(KeyButton, { c, i, w: w * k, h: ht * k });

// ----------------------------------------------------------------------------
// LEDs
// ----------------------------------------------------------------------------

function Led({ on, color, size, blink }: { on: number; color: string; size: number; blink?: boolean }) {
  return h('div', {
    className: blink && on > 0 ? 'animate-pulse' : '',
    style: {
      width: size, height: size, borderRadius: '50%',
      background: on > 0.02 ? color : '#2a1616',
      opacity: on > 0.02 ? 0.4 + 0.6 * on : 1,
      boxShadow: on > 0.02 ? `0 0 ${3 + 6 * on}px ${color}` : 'inset 0 1px 2px #000',
    },
  });
}

/** The eight OCTAVE / LOCATION LEDs */
function OctLeds({ c, pitch, size }: { c: C; pitch: number; size: number }) {
  const v = c.values, u = ui(c), d = dataOf(c);
  const leds: { on: number; color: string; blink?: boolean }[] = Array.from({ length: 8 }, () => ({ on: 0, color: '#ff3b30' }));
  const t = editTarget(v, u);
  const playing = !!c.engine.playing;
  if (u.latch === 'save') {
    const loc = u.saveLoc ?? d.loc;
    leds[u.saveBank ? Math.floor(loc / 8) : loc % 8] = { on: 1, color: u.saveBank ? '#ffb020' : '#22c55e', blink: true };
  } else if (u.latch === 'pattern') {
    leds[d.loc % 8] = { on: 1, color: '#ffb020', blink: true };
  } else if (u.latch === 'bank') {
    leds[Math.floor(d.loc / 8)] = { on: 1, color: '#ffb020', blink: true };
  } else if (t >= 0) {
    // editing a step: gate length as a red bar graph (8 = tie), glide on LED 5 in green
    const s = stepAt(v, t);
    for (let k = 0; k < s.gate; k++) leds[k] = { on: 0.85, color: '#ff3b30' };
    if (s.ratchet > 1) for (let k = 0; k < s.ratchet; k++) leds[k] = { on: 0.9, color: '#ffd000' };
    if (s.glide) leds[4] = { on: 1, color: '#22c55e' };
  } else if (playing && typeof c.engine.step === 'number' && c.engine.step >= 0) {
    leds[Math.min(7, Math.floor((c.engine.step as number) / 4))] = { on: 1, color: '#ff3b30' };
  } else if (isStepMode(v)) {
    const p = u.page ?? 0;
    leds[p * 2] = { on: 0.8, color: '#ffb020' }; leds[p * 2 + 1] = { on: 0.8, color: '#ffb020' };
  } else {
    leds[Math.max(0, Math.min(7, Math.round(num(v.kb_octave, 3))))] = { on: 1, color: '#ff3b30' };
  }
  return h('div', { className: 'relative', style: { width: pitch * 8, height: size } },
    ...leds.map((l, k) => h('div', { key: k, className: 'absolute', style: { left: k * pitch + (pitch - size) / 2, top: 0 } }, h(Led, { on: l.on, color: l.color, size, blink: l.blink }))));
}

export const renderOctLeds = (pitch: number, size: number, k: number) => (c: C) => h(OctLeds, { c, pitch: pitch * k, size: size * k });

/** The eight step LEDs under the step pads */
function StepLeds({ c, pitch, size }: { c: C; pitch: number; size: number }) {
  const v = c.values, u = ui(c);
  const playing = !!c.engine.playing;
  const pos = typeof c.engine.step === 'number' ? (c.engine.step as number) : -1;
  const len = lengthOf(v);
  const step = isStepMode(v);
  const leds = Array.from({ length: 8 }, (_, k) => {
    if (v.rec) { const r = recCount(v); return { on: r % 8 === k ? 1 : 0, blink: true }; }
    if (step) {
      const page = u.page ?? 0;
      const idx = page * 8 + k;
      if (u.sel === idx) return { on: 1, blink: true };
      if (playing && pos === idx) return { on: 0.15, blink: false };   // the playhead dips the LED
      const s = stepAt(v, idx);
      return { on: idx < len && !s.rest ? 0.75 : 0, blink: false };
    }
    if (playing && pos >= 0) return { on: pos % 8 === k ? 1 : 0, blink: false };
    return { on: 0, blink: false };
  });
  return h('div', { className: 'relative', style: { width: pitch * 8, height: size } },
    ...leds.map((l, k) => h('div', { key: k, className: 'absolute', style: { left: k * pitch + (pitch - size) / 2, top: 0 } }, h(Led, { on: l.on, color: '#ff3b30', size, blink: l.blink }))));
}

export const renderStepLeds = (pitch: number, size: number, k: number) => (c: C) => h(StepLeds, { c, pitch: pitch * k, size: size * k });

// ----------------------------------------------------------------------------
// Teaching readout (not on the hardware): mode, position and what the keys do now.
// It also records notes that arrive from the computer keyboard or MIDI.
// ----------------------------------------------------------------------------

function Readout({ c, w }: { c: C; w: number }) {
  const latest = useRef(c);
  latest.current = c;
  const v = c.values, u = ui(c), d = dataOf(c);
  const ne = c.engine.noteEvent as { note: number; n: number } | undefined;
  const lastN = useRef<number | null>(ne?.n ?? null);
  useEffect(() => {
    if (!ne || ne.n === lastN.current) return;
    lastN.current = ne.n;
    const cur = latest.current;
    const cu = ui(cur);
    if (cur.values.rec) recordStep(cur, ne.note);
    else if (isStepMode(cur.values) && typeof cu.sel === 'number' && cu.sel >= 0) {
      editStep(cur, cu.sel, 'seq_notes', encodeNote(ne.note));
      if (stepAt(cur.values, cu.sel).rest) editStep(cur, cu.sel, 'seq_rest', '0');
    }
  }, [ne]);

  const len = lengthOf(v);
  const pos = typeof c.engine.step === 'number' ? (c.engine.step as number) : -1;
  const stored = d.bank[d.loc];
  const edited = stored ? !samePattern(stored, patternOf(v)) : true;
  const loc = `${locName(d.loc)}${edited ? '*' : ''}`;
  const t = editTarget(v, u);
  let text = '';
  const fresh = u.msg && u.msgAt && Date.now() - u.msgAt < 2500;
  if (fresh) text = u.msg!;
  else if (u.latch === 'save') text = `SAVE to ${locName(u.saveLoc ?? d.loc)}${u.saveBank ? ' · pick a BANK pad' : ' · a pad picks the slot, PATTERN then a pad the bank'} · SHIFT + RUN/STOP saves · RUN/STOP cancels`;
  else if (u.latch === 'pattern') text = `PATTERN: press step pad 1-8 to load (bank ${Math.floor(d.loc / 8) + 1}) · RESET restores ${locName(d.loc)}`;
  else if (u.latch === 'bank') text = 'BANK: press step pad 1-8';
  else if (u.latch === 'setEnd') text = 'SET END: press the pad of the last step';
  else if (v.rec) text = `REC ${String(recCount(v) + 1).padStart(2, '0')}/32 · keys record notes · HOLD/REST = rest · RESET/ACCENT = accent · TEMPO = gate · RUN/STOP ends`;
  else if (t >= 0) {
    const s = stepAt(v, t);
    text = `EDIT STEP ${t + 1} · ${s.rest ? 'REST' : s.note !== null ? noteName(s.note) : '-'} · GATE ${s.gate >= 8 ? 'TIE' : `${s.gate}/8`}${s.glide ? ' · GLIDE' : ''}${s.ratchet > 1 ? ` · RATCHET ${s.ratchet}` : ''}${s.accent ? ' · ACCENT' : ''} · keys set the note`;
  } else if (isStepMode(v)) text = `STEP · ${loc} · ${len} steps · page ${['1-8', '9-16', '17-24', '25-32'][u.page ?? 0]} · pad = on/off · SHIFT + pad = edit`;
  else {
    const tr = typeof c.engine.transpose === 'number' && c.engine.transpose !== 0 ? ` · TRANSPOSE ${(c.engine.transpose as number) > 0 ? '+' : ''}${c.engine.transpose}` : '';
    const sync = c.engine.synced ? ` · STUDIO CLOCK ${DIVISIONS[Math.round(num(v.step_div, 19))]?.name ?? ''}` : '';
    text = c.engine.playing
      ? `▶ ${loc} · step ${String(pos + 1).padStart(2, '0')}/${len}${tr}${sync} · keys transpose`
      : `KB · ${loc} · ${len} steps · octave ${Math.round(num(v.kb_octave, 3)) + 1}${sync}`;
  }
  return h('div', {
    className: 'font-mono whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none',
    style: { width: w, fontSize: 8, lineHeight: '10px', color: v.rec || u.latch === 'save' ? '#ff7a6b' : '#8f8f8f', letterSpacing: 0.2 },
  }, text);
}

export const renderReadout = (w: number, k: number) => (c: C) => h(Readout, { c, w: w * k });

// ----------------------------------------------------------------------------
// Setup page (on the hardware: SHIFT + RESET + SET END + STEP 8)
// ----------------------------------------------------------------------------

const SETUP_CONTROLS = new Set(['assign_source', 'tempo_mode', 'step_div']);

function Setup({ c, k }: { c: C; k: number }) {
  const u = ui(c), v = c.values;
  const lessonWants = !!(c.teaching && c.step?.control && SETUP_CONTROLS.has(c.step.control));
  const open = !!u.setup || lessonWants;
  const btn = (label: string, active: boolean, onClick: () => void, target?: boolean, key?: string): ReactNode => h('button', {
    key: key ?? label,
    onClick,
    className: `rounded-sm font-bold leading-none ${target ? 'animate-pulse' : ''}`,
    style: {
      fontSize: 8, padding: '3px 4px', minWidth: 22, textAlign: 'left',
      background: active ? '#e5e5e5' : '#222', color: active ? '#111' : '#bbb',
      border: target ? '2px solid #f97316' : '1px solid #444',
    },
  }, label);
  const targetVal = (id: string) => (c.teaching && c.step?.control === id ? c.step.targetValue : undefined);
  const header = h('button', {
    'data-control': 'm32_setup',
    onClick: () => c.setUi({ setup: !u.setup }),
    className: 'rounded-sm font-bold',
    style: { fontSize: 8, padding: '2px 6px', background: open ? '#e5e5e5' : '#1f1f1f', color: open ? '#111' : '#bdbdbd', border: '1px solid #555', letterSpacing: 1 },
    title: 'Setup mode: ASSIGN output, TEMPO input and clock division (on the hardware: SHIFT + RESET + SET END + STEP 8)',
  }, open ? 'SETUP ✕' : 'SETUP');
  if (!open) return header;
  const assign = Math.round(num(v.assign_source, 1));
  const tmode = Math.round(num(v.tempo_mode, 1));
  const div = Math.round(num(v.step_div, 19));
  return h('div', { className: 'relative' },
    header,
    h('div', {
      className: 'absolute z-[60] rounded shadow-2xl',
      style: { right: 0, bottom: 22 * (k / 4.1), width: 300, padding: 8, background: '#111', border: '1px solid #555', color: '#ddd', fontSize: 9 },
    },
      h('div', { style: { fontWeight: 700, marginBottom: 4 } }, 'PAGE 1 · ASSIGN OUTPUT'),
      h('div', { className: 'grid gap-1', style: { gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 6 } },
        ...ASSIGN_SOURCES.map((name, i) => btn(`${i + 1}: ${name}`, assign === i, () => c.setValue('assign_source', i), targetVal('assign_source') === i, `a${i}`))),
      h('div', { style: { fontWeight: 700, marginBottom: 4 } }, 'PAGE 3 · TEMPO INPUT'),
      h('div', { className: 'grid gap-1', style: { gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 6 } },
        ...TEMPO_MODES.map((name, i) => btn(`${i + 1}: ${name}`, tmode === i, () => c.setValue('tempo_mode', i), targetVal('tempo_mode') === i, `t${i}`))),
      h('div', { style: { fontWeight: 700, marginBottom: 4 } }, 'CLOCK DIVISION (KB + STEP + TEMPO)'),
      h('div', { className: 'grid gap-1', style: { gridTemplateColumns: 'repeat(6, 1fr)' } },
        ...DIVISIONS.map((dv, i) => btn(dv.name, div === i, () => c.setValue('step_div', i), targetVal('step_div') === i, `d${i}`))),
    ),
  );
}

export const renderSetup = (k: number) => (c: C) => h(Setup, { c, k });

// ----------------------------------------------------------------------------
// MIDI IN socket (decoration)
// ----------------------------------------------------------------------------

export const renderDin = (d: number, k: number) => () => {
  const D = d * k;
  const pins = [-60, -30, 0, 30, 60].map(a => {
    const r = D * 0.3, rad = ((a - 90) * Math.PI) / 180;
    return h('div', { key: a, className: 'absolute rounded-full', style: { width: D * 0.08, height: D * 0.08, background: '#0a0a0a', left: D / 2 + r * Math.cos(rad) - D * 0.04, top: D * 0.52 + r * Math.sin(rad) - D * 0.04 } });
  });
  return h('div', { className: 'relative rounded-full', style: { width: D, height: D, background: 'radial-gradient(circle at 40% 35%, #c9c9c9 0%, #7d7d7d 55%, #3d3d3d 100%)', boxShadow: '0 2px 4px rgba(0,0,0,0.7)' } },
    h('div', { className: 'absolute rounded-full', style: { inset: D * 0.12, background: 'radial-gradient(circle at 50% 50%, #2a2a2a 0%, #151515 100%)' } }),
    ...pins);
};
