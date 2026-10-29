// ============================================================================
// Mother-32 panel: the sequencer section (13-key keyboard, function buttons,
// OCTAVE / LOCATION and step LEDs, the TEMPO and MIDI LEDs), the teaching
// readout and the Setup page. Behaviour follows the Mother-32 manual v2,
// pp.17-45 and pp.58-61 (page numbers as printed).
//
// These are `custom` elements because the buttons change meaning with the mode,
// SHIFT and the pending two-button gestures, exactly as on the hardware, and
// because editing writes the pattern lanes and the 64-pattern memory - something
// only the UI can do. State: control values (rec, seq_mode, shift, kb_octave, the
// lanes, the timing), device data (pattern memory) and ephemeral `ui` (selected
// step, page, record position, pending gesture, held arrows). Mouse users get
// latching SHIFT / PATTERN / SET END; on a touch screen they can also be held
// while pressing the second button, and the arrows work as hold-modifiers.
// Written with createElement (no JSX) so the data validator can load the file.
// ============================================================================

import { createElement as h, useEffect, useRef } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { ControlValue } from '@/types';
import type { CustomRenderContext } from '@/types/panel';
import {
  END, LANES, LOCATIONS, STEPS, TIMING_IDS, type Mother32Data, type PatternValues, type StoredPattern, asData, decodeNote,
  encodeNote, initPattern, lengthOf, locName, normalize, noteName, patternOf, rotate, samePattern, setLaneChar, stepAt, timingOf,
} from './sequence';
import { ASSIGN_SOURCES, DIRECTIONS, DIV_GROUPS, DIVISIONS, PPQN_VALUES, TEMPO_MODES, divIndex, divName, octaveLow } from './model';

type C = CustomRenderContext;

const RED = '#ff3b30', GREEN = '#22c55e', YELLOW = '#ffd000';

export interface M32Ui {
  sel?: number;              // the step selected for editing (-1 = none): STEP mode, or KB mode (SHIFT + step)
  page?: number;             // pattern page 0..3 (steps 1-8 ... 25-32)
  pagePinned?: boolean;      // a page button stopped the page following the playhead
  latch?: 'pattern' | 'bank' | 'setEnd' | 'save' | 'init' | null;
  saveLoc?: number;
  saveBank?: boolean;        // save mode: the pads / arrows pick the bank
  setup?: boolean;
  msg?: string;
  msgAt?: number;
  /** KB / STEP held down: modifiers for TEMPO (clock division), GLIDE (swing interval) and, both held, the direction pads */
  held?: { kb?: boolean; step?: boolean };
  /** A held KB / STEP was used as a modifier, so its release does not change the octave */
  heldUsed?: boolean;
  /** Record function: where the next note or rest is written (step-write) */
  recPos?: number;
  /** A knob just turned, for the temporary OCTAVE / LOCATION displays */
  touch?: { k: 'gate' | 'ratchet' | 'div' | 'swing'; at: number };
  /** Delay Pattern Change: the location that starts when the playing pattern ends */
  pendingLoc?: number;
  /** The pattern as it was loaded (AUTO save mode: PATTERN + RESET restores it) */
  origin?: StoredPattern;
}

export const ui = (c: { ui?: Record<string, unknown> }) => (c.ui ?? {}) as M32Ui;
const num = (v: ControlValue | undefined, d = 0) => (typeof v === 'number' ? v : v === true ? 1 : v === false ? 0 : d);
export const isStepMode = (values: Record<string, ControlValue>) => num(values.seq_mode) === 1;

/** The step the TEMPO / GLIDE knobs and ACCENT / REST edit right now, or -1 */
export function editTarget(values: Record<string, ControlValue>, u: M32Ui): number {
  if (typeof u.sel === 'number' && u.sel >= 0) return u.sel;
  if (values.rec) return Math.max(0, (u.recPos ?? 0) - 1);
  return -1;
}

export function dataOf(c: { data?: unknown }): Mother32Data {
  return asData(c.data) ?? { v: 1, loc: 0, bank: new Array(LOCATIONS).fill(null) };
}

/** The page the step buttons and LEDs show: the edited step's, the playhead's (page chasing) or the picked one */
function shownPage(c: C): number {
  const u = ui(c), v = c.values;
  const t = editTarget(v, u);
  if (t >= 0) return Math.floor(t / 8);
  const pos = typeof c.engine.step === 'number' ? (c.engine.step as number) : -1;
  if (!u.pagePinned && c.engine.playing && pos >= 0) return Math.floor(pos / 8);
  return u.page ?? 0;
}

// ----------------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------------

function setPattern(c: C, p: PatternValues) {
  for (const id of LANES) c.setValue(id, p[id]);
  c.setValue('seq_length', p.seq_length);
}

function flash(c: C, msg: string) {
  c.setUi({ msg, msgAt: Date.now() });
}

const stored = (c: C): StoredPattern => ({ ...normalize(c.values), ...timingOf(c.values) });

/** Load a stored pattern into the working pattern now (with its timing if Load Saved Timing is on) */
function commitLoad(c: C, loc: number, p: StoredPattern) {
  setPattern(c, p);
  if (num(c.values.load_timing, 1) === 1) {
    for (const id of TIMING_IDS) if (typeof p[id] === 'number') c.setValue(id, p[id] as number);
  }
  c.updateData(x => ({ ...dataOf({ data: x }), loc }));
  c.setUi({ origin: p, pendingLoc: undefined, sel: -1 });
}

/**
 * Select a pattern location. AUTO save keeps the edits of the pattern you leave; while playing,
 * Delay Pattern Change (on by default) waits for the current pattern to finish (manual pp.37-38).
 */
function loadLoc(c: C, loc: number) {
  const d = dataOf(c);
  if (num(c.values.save_mode) === 1) {
    const cur = d.bank[d.loc];
    if (!cur || !samePattern(cur, patternOf(c.values))) {
      const s = stored(c);
      c.updateData(x => { const dd = dataOf({ data: x }); const bank = dd.bank.slice(); bank[d.loc] = s; return { ...dd, bank }; });
    }
  }
  const p = d.bank[loc] ?? { ...initPattern() };
  if (c.engine.playing && num(c.values.delay_pattern, 1) === 1 && loc !== d.loc) {
    c.sendEvent('queue_pattern', { ...p });
    c.setUi({ pendingLoc: loc });
    flash(c, `Pattern ${locName(loc)} starts when this one ends`);
    return;
  }
  if (ui(c).pendingLoc !== undefined) c.sendEvent('unqueue');
  commitLoad(c, loc, p);
  flash(c, d.bank[loc] ? `Pattern ${locName(loc)}` : `Pattern ${locName(loc)} (empty - initialized)`);
}

function saveTo(c: C, loc: number) {
  if (num(c.values.save_mode) === 2) {
    c.setUi({ latch: null, saveBank: false });
    flash(c, 'Write protect is on (Setup page 6) - not saved');
    return;
  }
  const p = stored(c);
  c.updateData(x => {
    const d = dataOf({ data: x });
    const bank = d.bank.slice();
    bank[loc] = p;
    return { ...d, bank, loc };
  });
  c.setUi({ latch: null, saveBank: false, origin: p });
  flash(c, `Saved to ${locName(loc)}`);
}

/** PATTERN + RESET: back to the stored pattern (AUTO save: as first loaded) */
function restore(c: C) {
  const d = dataOf(c), u = ui(c);
  const p = num(c.values.save_mode) === 1 ? u.origin ?? d.bank[d.loc] : d.bank[d.loc];
  if (!p) { flash(c, 'Nothing stored here to restore'); return; }
  commitLoad(c, d.loc, p);
  flash(c, `Pattern ${locName(d.loc)} restored`);
}

/** SHIFT + RESET + PATTERN: one step of C3 at 50 % gate; swing back to 50 % (manual p.32, p.21) */
function initialize(c: C) {
  setPattern(c, initPattern());
  c.setValue('swing', 50);
  c.setValue('swing_div', num(c.values.step_div, 5));
  c.setValue('swing_type', num(c.values.div_type, 0));
  c.setUi({ latch: null, sel: -1, recPos: 0 });
  flash(c, 'Pattern initialized - one step; record or SET END to build it');
}

function startRec(c: C) {
  // Record pauses the sequencer and writes over the pattern from step 1 (manual p.24, p.30)
  c.setValue('run_stop', false);
  c.sendEvent('run', false);
  if (typeof c.values.seq_notes === 'string' && c.values.seq_notes.indexOf(END) >= 0) setPattern(c, normalize(c.values));
  c.setUi({ sel: -1, recPos: 0, latch: null, pagePinned: false });
  c.setValue('rec', true);
}

function endRec(c: C) {
  const n = ui(c).recPos ?? 0;
  c.setValue('rec', false);
  c.setUi({ sel: -1, recPos: 0 });
  flash(c, n ? `Recorded ${n} step${n > 1 ? 's' : ''} - the pattern is ${lengthOf(c.values)} long; SHIFT + hold RUN / STOP saves` : 'Record off');
}

/**
 * Step-write one note (or a rest) at the record position (manual pp.24-27): the new step takes
 * the previous step's gate length, a key still held when the next one is played ties the two,
 * and the pattern grows as you go. Takes and returns values / position so several notes that
 * arrive together are written one after another.
 */
function recordStep(c: C, note: number | null, legato: boolean, values: Record<string, ControlValue>, pos: number) {
  if (pos >= STEPS) { endRec(c); return { values, pos }; }
  const i = pos;
  const next: Record<string, ControlValue> = { ...values };
  const set = (lane: (typeof LANES)[number], ch: string) => { next[lane] = setLaneChar(next, lane, i, ch); };
  if (legato && i > 0) next.seq_gate = setLaneChar(next, 'seq_gate', i - 1, '8');
  const prev = i > 0 ? decodeNote(String(next.seq_notes)[i - 1]) : null;
  set('seq_notes', encodeNote(note ?? prev ?? 48));
  set('seq_rest', note === null ? '1' : '0');
  set('seq_accent', '0');
  set('seq_glide', '0');
  set('seq_ratchet', '1');
  if (i > 0) set('seq_gate', String(stepAt(next, i - 1).gate));
  next.seq_length = Math.max(lengthOf(values), i + 1);
  for (const id of LANES) c.setValue(id, next[id]);
  c.setValue('seq_length', next.seq_length);
  if (i + 1 >= STEPS) setTimeout(() => endRec(c), 0);
  return { values: next, pos: i + 1 };
}

/** Write one field of a step (normalising a legacy pattern first) */
function editStep(c: C, i: number, lane: (typeof LANES)[number], ch: string) {
  const v = c.values;
  let base: Record<string, ControlValue> = v;
  if (typeof v.seq_notes === 'string' && v.seq_notes.indexOf(END) >= 0) {
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
  c.setUi({ latch: null });
  flash(c, `Pattern length ${len}`);
}

/** Select a step for editing; the same step again ends editing (manual p.30, p.44) */
function selectStep(c: C, idx: number) {
  const u = ui(c);
  if (u.sel === idx) { c.setUi({ sel: -1 }); return; }
  c.setUi({ sel: idx });
  const s = stepAt(c.values, idx);
  if (!c.engine.playing && s.note !== null) c.sendEvent('preview', s.note);
}

/** A page button: pins that page; the pinned page again resumes page chasing (manual p.43-44) */
function pickPage(c: C, page: number) {
  const u = ui(c);
  if (u.pagePinned && (u.page ?? 0) === page) c.setUi({ pagePinned: false });
  else c.setUi({ page, pagePinned: true });
}

// ----------------------------------------------------------------------------
// SHIFT: tap = latch (lets go after the next button); hold = classic modifier
// ----------------------------------------------------------------------------

const live = new Map<string, { shiftHeld: boolean; used: boolean; snap: string }>();
const liveOf = (c: C) => { let x = live.get(c.instance); if (!x) { x = { shiftHeld: false, used: false, snap: '' }; live.set(c.instance, x); } return x; };
/** What a held SHIFT changes through a knob: SWING (TEMPO), live and step ratchets (GLIDE) */
const shiftSnap = (v: Record<string, ControlValue>) => `${v.swing}|${v.live_ratchet}|${v.seq_ratchet}`;

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
  const glow = lit > 0 ? `0 0 ${4 + 8 * lit}px ${color}` : 'none';
  const ring = target === 'off' ? '0 0 0 2px #f97316, 0 0 10px #f97316' : target === 'on' ? '0 0 0 2px #22c55e' : '';
  const face = lit > 0
    ? `radial-gradient(circle at 50% 45%, ${color} 0%, ${mixDark(color)} 75%)`
    : 'linear-gradient(180deg, #343434 0%, #1d1d1d 100%)';
  const base: CSSProperties = {
    position: 'absolute', left: 0, top: 0, width: w, height: ht, touchAction: 'none', padding: 0,
    cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
  };
  // The (KB) and (STEP) arrows are triangles (manual p.9). The triangle is an inner face, so the
  // button keeps its whole rectangle as the touch target; the glow and lesson ring follow the shape.
  const clip = shape === 'left' ? 'polygon(0 50%, 100% 0, 100% 100%)' : shape === 'right' ? 'polygon(0 0, 100% 50%, 0 100%)' : '';
  const style: CSSProperties = shape === 'pad'
    ? {
      ...base, borderRadius: 3, border: '1px solid #4a4a4a', background: face,
      boxShadow: [lit > 0 ? glow : 'inset 0 -2px 3px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 3px rgba(0,0,0,0.6)', ring].filter(Boolean).join(', '),
    }
    : {
      ...base, border: 'none', background: 'transparent',
      filter: target === 'off' ? 'drop-shadow(0 0 3px #f97316)' : target === 'on' ? 'drop-shadow(0 0 2px #22c55e)'
        : lit > 0 ? `drop-shadow(0 0 ${3 + 5 * lit}px ${color})` : 'drop-shadow(0 2px 2px rgba(0,0,0,0.6))',
    };
  const inner = shape === 'pad' ? null : h('span', {
    style: { position: 'absolute', inset: 0, clipPath: clip, WebkitClipPath: clip, background: face, pointerEvents: 'none' },
  });
  return h('button', {
    'data-control': id,
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
  }, inner);
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
  const pendingTap = useRef(false);
  const v = c.values, u = ui(c);
  const playing = !!c.engine.playing;

  const down = () => {
    const cur = latest.current;
    const cv = cur.values, cu = ui(cur);
    const running = !!cur.engine.playing;
    const target = editTarget(cv, cu);
    const editing = target >= 0;
    const held = cu.held ?? {};
    switch (kind) {
      case 'shift': {
        const l = liveOf(cur);
        if (cv.shift) { cur.setValue('shift', false); l.shiftHeld = false; return; }
        cur.setValue('shift', true);
        l.shiftHeld = true; l.used = false; l.snap = shiftSnap(cv);
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
        if (held.kb && held.step) {
          // KB + STEP + RUN / STOP: pre-arm for a clock at TEMPO (manual p.40)
          cur.setUi({ heldUsed: true });
          const mode = Math.round(num(cv.tempo_mode, 1));
          if (cur.engine.tempoPatched && (mode === 1 || mode === 2) && !cur.engine.synced) {
            cur.setValue('run_stop', true);
            cur.sendEvent('arm');
            flash(cur, 'Armed: the pattern starts on the next clock at TEMPO (RESET first to start from step 1)');
          } else flash(cur, 'Pre-arming needs a clock patched into TEMPO (Single Clock Advance or Analog Clock mode)');
          return;
        }
        if (cv.rec) { endRec(cur); return; }
        if (cu.latch === 'save') { cur.setUi({ latch: null, saveBank: false }); flash(cur, 'Save cancelled'); return; }
        if (cu.latch) cur.setUi({ latch: null });
        // RUN / STOP pauses and resumes (manual p.28)
        const want = !running;
        cur.setValue('run_stop', want);
        cur.sendEvent('run', want);
        return;
      }
      case 'hold': {
        if (cv.shift) { consumeShift(cur); if (running) { momentary.current = 'live_mute'; cur.sendEvent('live_mute'); } return; }
        if (cv.rec && (cu.sel ?? -1) < 0) {
          const r = recordStep(cur, null, false, cv, cu.recPos ?? 0);
          cur.setUi({ recPos: r.pos });
          return;
        }
        if (editing) { toggle(cur, target, 'seq_rest'); return; }
        if (running) { momentary.current = 'hold'; cur.sendEvent('hold'); }
        return;
      }
      case 'reset': {
        if (cv.shift) {
          consumeShift(cur);
          if (running) { momentary.current = 'live_accent'; cur.sendEvent('live_accent'); }
          // SHIFT + RESET + PATTERN initializes the pattern
          cur.setUi({ latch: 'init' });
          if (!running) flash(cur, 'SHIFT + RESET: press PATTERN to initialize the pattern');
          return;
        }
        if (cu.latch === 'pattern') { cur.setUi({ latch: null }); restore(cur); return; }
        if (editing) { toggle(cur, target, 'seq_accent'); return; }
        cur.sendEvent('reset');
        if (cu.latch === 'init') cur.setUi({ latch: null });
        return;
      }
      case 'pattern': {
        if (cu.latch === 'save') { consumeShift(cur); cur.setUi({ saveBank: !cu.saveBank }); return; }
        if (cu.latch === 'init') { consumeShift(cur); initialize(cur); return; }
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
          if (kind === 'step' && cv.rec) endRec(cur);   // entering STEP mode ends Record
          cur.setUi({ sel: -1, latch: null });
          flash(cur, kind === 'kb' ? 'KB mode: the keys play, record and transpose' : 'STEP mode: the step buttons switch steps on or off; SHIFT + step edits it; the arrows rotate');
          return;
        }
        const d = dataOf(cur);
        if (cu.latch === 'save') {
          const loc = cu.saveLoc ?? d.loc;
          const nl = cu.saveBank ? (((Math.floor(loc / 8) + dir + 8) % 8) * 8 + (loc % 8)) : (Math.floor(loc / 8) * 8 + ((loc % 8) + dir + 8) % 8);
          cur.setUi({ saveLoc: nl });
          return;
        }
        if (cu.latch === 'pattern') { loadLoc(cur, Math.floor(d.loc / 8) * 8 + ((d.loc % 8) + dir + 8) % 8); return; }
        if (cu.latch === 'bank') { loadLoc(cur, (((Math.floor(d.loc / 8) + dir + 8) % 8) * 8) + (d.loc % 8)); return; }
        // Held, KB and STEP are modifiers (TEMPO: clock division; GLIDE: swing interval; both
        // held: step buttons 1-4 pick the direction), so their own action happens on release
        const other = cu.held && (kind === 'kb' ? cu.held.step : cu.held.kb);
        cur.setUi({ held: { ...(cu.held ?? {}), [kind]: true }, heldUsed: other ? !!cu.heldUsed : false });
        pendingTap.current = true;
        return;
      }
    }
  };

  const up = () => {
    const cur = latest.current;
    if ((kind === 'kb' || kind === 'step') && pendingTap.current) {
      pendingTap.current = false;
      const cu = ui(cur);
      const held = { ...(cu.held ?? {}), [kind]: false };
      const used = !!cu.heldUsed;
      cur.setUi({ held, heldUsed: held.kb || held.step ? used : false });
      if (!used) arrowTap(cur, kind);
    }
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      if (!savedLong.current && kind === 'run') {
        consumeShift(cur);
        if (cur.values.rec) endRec(cur);
        else if (isStepMode(cur.values)) flash(cur, 'There is no Record function in STEP mode (manual p.36) - SHIFT + KB first');
        else startRec(cur);
      }
    }
    if (kind === 'shift') {
      const l = liveOf(cur);
      l.shiftHeld = false;
      // Held while another button was pressed or a knob was turned (SHIFT + TEMPO, SHIFT + GLIDE),
      // SHIFT lets go on release like the hardware's; a plain tap still latches it
      if (l.used || (cur.values.shift && l.snap !== shiftSnap(cur.values))) { l.used = false; cur.setValue('shift', false); }
    }
    if (momentary.current) { cur.sendEvent(`${momentary.current}:up`); momentary.current = null; }
  };

  let lit = 0, color = RED, blink = false, target: 'on' | 'off' | null = null;
  const label = { hold: 'HOLD / REST', pattern: 'PATTERN (BANK)', reset: 'RESET / ACCENT', shift: '(SHIFT)', run: 'RUN / STOP (REC)', kb: '(KB) octave down', step: '(STEP) octave up' }[kind];
  switch (kind) {
    case 'shift': lit = v.shift ? 1 : 0; color = '#f5f5f5'; target = targetOf(c, 'shift'); break;
    case 'run': lit = v.rec ? 0.8 : playing || c.engine.armed ? 1 : 0; blink = !!v.rec || u.latch === 'save' || !!c.engine.armed; target = targetOf(c, 'run_stop') ?? targetOf(c, 'rec'); break;
    case 'pattern': lit = u.latch === 'pattern' || u.latch === 'bank' || u.latch === 'init' || (u.latch === 'save' && u.saveBank) ? 0.9 : 0; color = u.latch === 'pattern' ? GREEN : YELLOW; blink = lit > 0; break;
    case 'kb': lit = u.held?.kb ? 0.5 : 0; color = YELLOW; target = targetOf(c, 'seq_mode', 0) ?? targetOf(c, 'kb_octave'); break;
    case 'step': lit = u.held?.step ? 0.5 : 0; color = YELLOW; target = targetOf(c, 'seq_mode', 1); break;
    default: break;
  }
  return h(Cap, {
    id: kind === 'run' ? 'run_stop' : kind === 'shift' ? 'shift' : `m32_${kind}`, w, h: ht, lit, color, label, blink, target,
    shape: kind === 'kb' ? 'left' : kind === 'step' ? 'right' : 'pad',
    onDown: down, onUp: up,
  });
}

/** A tap on KB / STEP: octave down / up, or in STEP mode (not editing) rotate the pattern (manual p.35, p.44) */
function arrowTap(c: C, kind: 'kb' | 'step') {
  const dir = kind === 'kb' ? -1 : 1;
  const v = c.values;
  if (isStepMode(v) && editTarget(v, ui(c)) < 0) {
    setPattern(c, rotate(normalize(v), dir as -1 | 1));
    flash(c, `Pattern rotated ${dir < 0 ? 'left' : 'right'}`);
    return;
  }
  c.setValue('kb_octave', Math.max(0, Math.min(7, Math.round(num(v.kb_octave, 3)) + dir)));
}

export const renderFn = (kind: FnKind, w: number, ht: number, k: number) => (c: C) => h(FnButton, { c, kind, w: w * k, h: ht * k });

// ----------------------------------------------------------------------------
// The 13 keys (white: step buttons 1-8; black: 1-8 / 9-16 / 17-24 / 25-32 / SET END)
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
    const sel = cu.sel ?? -1;
    const target = editTarget(cv, cu);
    const note = octaveLow(num(cv.kb_octave, 3)) + i;
    const page = shownPage(cur);
    // KB + STEP held: step buttons 1-4 choose the playback direction (manual p.40)
    if (cu.held?.kb && cu.held?.step) {
      if (white >= 0 && white < 4) {
        cur.setValue('seq_direction', white);
        cur.setUi({ heldUsed: true });
        flash(cur, `Direction: ${DIRECTIONS[white]}`);
      }
      return;
    }
    // Pending two-button gestures take the step buttons and page buttons first
    if (cu.latch && white >= 0) {
      if (cu.latch === 'pattern') { consumeShift(cur); cur.setUi({ latch: null }); loadLoc(cur, Math.floor(d.loc / 8) * 8 + white); return; }
      if (cu.latch === 'bank') { consumeShift(cur); cur.setUi({ latch: null }); loadLoc(cur, white * 8 + (d.loc % 8)); return; }
      if (cu.latch === 'save') {
        consumeShift(cur);
        const loc = cu.saveLoc ?? d.loc;
        cur.setUi({ saveLoc: cu.saveBank ? white * 8 + (loc % 8) : Math.floor(loc / 8) * 8 + white, saveBank: false });
        return;
      }
      if (cu.latch === 'setEnd') { consumeShift(cur); setEnd(cur, page * 8 + white + 1); return; }
    }
    if (cu.latch === 'setEnd' && black >= 0 && black < 4) { consumeShift(cur); cur.setUi({ page: black, pagePinned: true }); return; }
    if (cu.latch === 'init') cur.setUi({ latch: null });

    if (isStepMode(cv)) {
      if (cv.shift && white >= 0) { consumeShift(cur); selectStep(cur, page * 8 + white); return; }
      if (target >= 0) {
        // While a step is edited the 13 keys set its note (the arrows pick the octave)
        editStep(cur, target, 'seq_notes', encodeNote(note));
        if (stepAt(cv, target).rest) editStep(cur, target, 'seq_rest', '0');
        if (!cur.engine.playing) cur.sendEvent('preview', note);
        return;
      }
      if (white >= 0) {
        const idx = page * 8 + white;
        if (idx < lengthOf(cv)) toggle(cur, idx, 'seq_rest');
        else flash(cur, `Step ${idx + 1} is past the end - SET END + a step makes the pattern longer`);
        return;
      }
      if (black >= 0 && black < 4) { consumeShift(cur); pickPage(cur, black); return; }
      if (black === 4) { consumeShift(cur); cur.setUi({ latch: cu.latch === 'setEnd' ? null : 'setEnd' }); return; }
      return;
    }
    // KB mode: SHIFT + step selects it for editing, SHIFT + page / SET END (manual p.30, p.43)
    if (cv.shift) {
      consumeShift(cur);
      if (white >= 0) { selectStep(cur, page * 8 + white); return; }
      if (black >= 0 && black < 4) { pickPage(cur, black); return; }
      if (black === 4) { cur.setUi({ latch: cu.latch === 'setEnd' ? null : 'setEnd' }); return; }
    }
    if (sel >= 0) {
      editStep(cur, sel, 'seq_notes', encodeNote(note));
      if (stepAt(cv, sel).rest) editStep(cur, sel, 'seq_rest', '0');
      if (!cur.engine.playing) cur.sendEvent('preview', note);
      return;
    }
    // The keys play (and in Record write, when the engine reports the note)
    sounding.current = true;
    cur.sendEvent('key', { i, on: true });
  };
  const up = () => {
    if (sounding.current) { sounding.current = false; latest.current.sendEvent('key', { i, on: false }); }
  };

  // Lit state
  let lit = 0, color = RED, blink = false;
  const page = shownPage(c);
  if (!step) {
    const lk = typeof c.engine.litKey === 'number' ? c.engine.litKey : -1;
    lit = lk === i ? 1 : 0;
  } else if (black >= 0) {
    if (black < 4 && page === black) { lit = u.pagePinned ? 0.75 : 0.45; color = YELLOW; }
    if (black === 4 && u.latch === 'setEnd') { lit = 0.9; color = YELLOW; blink = true; }
  }
  const label = step
    ? white >= 0 ? `Step ${white + 1}` : black < 4 ? `Page ${['1-8', '9-16', '17-24', '25-32'][black]}` : 'SET END'
    : `Key ${noteName(octaveLow(num(v.kb_octave, 3)) + i)}`;
  return h(Cap, { id: `key_${i}`, w, h: ht, lit, color, label, blink, onDown: down, onUp: up });
}

export const renderKey = (i: number, w: number, ht: number, k: number) => (c: C) => h(KeyButton, { c, i, w: w * k, h: ht * k });

// ----------------------------------------------------------------------------
// LEDs
// ----------------------------------------------------------------------------

function Led({ on, color, size, blink, alt }: { on: number; color: string; size: number; blink?: boolean; alt?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Two indications on one LED alternate between their colours (manual p.27)
    const el = ref.current;
    if (!el || !alt || on <= 0.02 || typeof el.animate !== 'function') return;
    const a = el.animate([{ background: color }, { background: alt }], { duration: 420, iterations: Infinity, direction: 'alternate', easing: 'steps(1, end)' });
    return () => a.cancel();
  }, [alt, color, on]);
  return h('div', {
    ref,
    className: blink && on > 0 ? 'animate-pulse' : '',
    style: {
      width: size, height: size, borderRadius: '50%',
      background: on > 0.02 ? color : '#2a1616',
      opacity: on > 0.02 ? 0.4 + 0.6 * on : 1,
      boxShadow: on > 0.02 ? `0 0 ${3 + 6 * on}px ${alt ?? color}` : 'inset 0 1px 2px #000',
    },
  });
}

type LedState = { on: number; color: string; blink?: boolean; alt?: string };

/** The eight OCTAVE / LOCATION LEDs (manual pp.24-37, p.54) */
function OctLeds({ c, pitch, size }: { c: C; pitch: number; size: number }) {
  const v = c.values, u = ui(c), d = dataOf(c);
  const leds: LedState[] = Array.from({ length: 8 }, () => ({ on: 0, color: RED }));
  const t = editTarget(v, u);
  const step = isStepMode(v);
  const held = u.held ?? {};
  const touch = u.touch && Date.now() - u.touch.at < 1500 ? u.touch.k : null;
  const oct = Math.max(0, Math.min(7, Math.round(num(v.kb_octave, 3))));
  const put = (i: number, s: LedState) => {
    const cur = leds[i];
    leds[i] = cur.on > 0 && cur.color !== s.color ? { ...s, alt: cur.color } : s;
  };
  if (u.latch === 'save') {
    const loc = u.saveLoc ?? d.loc;
    put(u.saveBank ? Math.floor(loc / 8) : loc % 8, { on: 1, color: u.saveBank ? YELLOW : GREEN, blink: true });
  } else if (u.latch === 'pattern') {
    put(d.loc % 8, { on: 1, color: GREEN });
    if (u.pendingLoc !== undefined && Math.floor(u.pendingLoc / 8) === Math.floor(d.loc / 8)) put(u.pendingLoc % 8, { on: 1, color: GREEN, blink: true });
  } else if (u.latch === 'bank') {
    put(Math.floor(d.loc / 8), { on: 1, color: YELLOW });
  } else if (touch === 'swing') {
    put(Math.max(0, Math.min(7, Math.round(num(v.swing_div, 5)))), { on: 1, color: GREEN });
  } else if (touch === 'div' || ((held.kb || held.step) && t < 0)) {
    put(Math.max(0, Math.min(7, Math.round(num(v.step_div, 5)))), { on: 1, color: YELLOW });
  } else if (touch === 'gate' && t >= 0) {
    const g = stepAt(v, t).gate;
    for (let k = 0; k < g; k++) leds[k] = { on: 0.85, color: RED };
  } else if (touch === 'ratchet' && t >= 0) {
    const r = stepAt(v, t).ratchet;
    for (let k = 0; k < r; k++) leds[k] = { on: 0.9, color: YELLOW };
  } else if (t >= 0) {
    // Editing: the red octave LED (the keys set the note), the page, and LEDs 5-8 = glide,
    // ratchet, accent, rest of the step (green in KB mode, yellow in STEP mode)
    const s = stepAt(v, t);
    const flag = step ? YELLOW : GREEN;
    if (!step) put(Math.floor(t / 8), { on: 1, color: GREEN });
    if (s.glide) put(4, { on: 1, color: flag });
    if (s.ratchet > 1) put(5, { on: 1, color: flag });
    if (s.accent) put(6, { on: 1, color: flag });
    if (s.rest) put(7, { on: 1, color: flag });
    put(oct, { on: 1, color: RED });
  } else if (step) {
    // STEP mode: no octave LED; the page in yellow, and the flags of the step being played
    put(shownPage(c), { on: 1, color: YELLOW });
    const pos = typeof c.engine.step === 'number' ? (c.engine.step as number) : -1;
    if (c.engine.playing && pos >= 0) {
      const s = stepAt(v, pos);
      if (s.glide) put(4, { on: 0.8, color: YELLOW });
      if (s.ratchet > 1) put(5, { on: 0.8, color: YELLOW });
      if (s.accent) put(6, { on: 0.8, color: YELLOW });
      if (s.rest) put(7, { on: 0.8, color: YELLOW });
    }
  } else {
    put(oct, { on: 1, color: RED });
  }
  return h('div', { className: 'relative', style: { width: pitch * 8, height: size } },
    ...leds.map((l, k) => h('div', { key: k, className: 'absolute', style: { left: k * pitch + (pitch - size) / 2, top: 0 } }, h(Led, { on: l.on, color: l.color, size, blink: l.blink, alt: l.alt }))));
}

export const renderOctLeds = (pitch: number, size: number, k: number) => (c: C) => h(OctLeds, { c, pitch: pitch * k, size: size * k });

/** The eight step LEDs under the step buttons */
function StepLeds({ c, pitch, size }: { c: C; pitch: number; size: number }) {
  const v = c.values, u = ui(c);
  const playing = !!c.engine.playing;
  const pos = typeof c.engine.step === 'number' ? (c.engine.step as number) : -1;
  const len = lengthOf(v);
  const step = isStepMode(v);
  const page = shownPage(c);
  const t = editTarget(v, u);
  const sel = u.sel ?? -1;
  const leds = Array.from({ length: 8 }, (_, k) => {
    const idx = page * 8 + k;
    if (u.latch === 'setEnd' && idx === len - 1) return { on: 1, blink: true };
    if (v.rec && sel < 0) return idx === t ? { on: 1, blink: true } : { on: idx < Math.max(len, u.recPos ?? 0) ? 0.6 : 0, blink: false };
    if (sel >= 0) return { on: idx === sel ? 1 : 0, blink: idx === sel };
    if (step) {
      if (playing && pos === idx) return { on: 0.15, blink: false };   // the playhead dips the LED
      return { on: idx < len && !stepAt(v, idx).rest ? 0.75 : 0, blink: false };
    }
    return { on: playing && pos === idx ? 1 : 0, blink: false };
  });
  return h('div', { className: 'relative', style: { width: pitch * 8, height: size } },
    ...leds.map((l, k) => h('div', { key: k, className: 'absolute', style: { left: k * pitch + (pitch - size) / 2, top: 0 } }, h(Led, { on: l.on, color: RED, size, blink: l.blink }))));
}

export const renderStepLeds = (pitch: number, size: number, k: number) => (c: C) => h(StepLeds, { c, pitch: pitch * k, size: size * k });

/**
 * The Tempo LED above (SHIFT) (manual p.18, p.54): red for the internal clock, green for an
 * external one (MIDI / studio or a TEMPO-jack clock); solid yellow in Record; yellow and red in
 * turn while a step is edited; flashing yellow in Setup.
 */
function TempoLed({ c, size }: { c: C; size: number }) {
  const v = c.values, u = ui(c);
  const ref = useRef<HTMLDivElement>(null);
  const beat = !!c.engine.beat;
  const ext = !!c.engine.synced || !!c.engine.extClock;
  const playing = !!c.engine.playing;
  const editing = editTarget(v, u) >= 0 && !v.rec;
  const bpm = Math.max(20, Math.min(300, num(v.tempo, 120)));
  const freeRun = !playing && !ext && !v.rec && !u.setup && !editing;
  useEffect(() => {
    // The internal clock keeps blinking the LED at the tempo while the pattern is stopped
    const el = ref.current;
    if (!el || !freeRun || typeof el.animate !== 'function') return;
    const a = el.animate([{ opacity: 1 }, { opacity: 0.12 }], { duration: (60 / bpm) * 1000, iterations: Infinity, easing: 'steps(2, jump-none)' });
    return () => a.cancel();
  }, [freeRun, bpm]);
  let color = ext ? GREEN : RED, on = beat ? 1 : 0, blink = false;
  if (v.rec) { color = YELLOW; on = 1; }
  else if (u.setup) { color = YELLOW; on = 1; blink = true; }
  else if (editing) { color = beat ? RED : YELLOW; on = 1; }
  else if (freeRun) { on = 1; }
  return h('div', { ref, style: { width: size, height: size } }, h(Led, { on, color, size, blink }));
}

export const renderTempoLed = (size: number, k: number) => (c: C) => h(TempoLed, { c, size: size * k });

/** MIDI IN LED: flashes while MIDI messages arrive */
function MidiLed({ c, size }: { c: C; size: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const act = typeof c.engine.midiActivity === 'number' ? c.engine.midiActivity : 0;
  useEffect(() => {
    const el = ref.current;
    if (!el || !act || typeof el.animate !== 'function') return;
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out' });
  }, [act]);
  return h('div', { style: { position: 'relative', width: size, height: size } },
    h(Led, { on: 0, color: RED, size }),
    h('div', { ref, style: { position: 'absolute', inset: 0, borderRadius: '50%', background: RED, boxShadow: `0 0 6px ${RED}`, opacity: 0 } }));
}

export const renderMidiLed = (size: number, k: number) => (c: C) => h(MidiLed, { c, size: size * k });

// ----------------------------------------------------------------------------
// Teaching readout (not on the hardware): mode, position and what the keys do now.
// It also records notes that arrive from the computer keyboard or MIDI, commits a delayed
// pattern change when the engine reports the switch, follows MIDI program changes and tells
// the engine when a step is being edited.
// ----------------------------------------------------------------------------

function Readout({ c, w }: { c: C; w: number }) {
  const latest = useRef(c);
  latest.current = c;
  const v = c.values, u = ui(c), d = dataOf(c);
  const log = c.engine.noteLog as { note: number; n: number; legato?: boolean }[] | undefined;
  const lastN = useRef<number>(log && log.length ? log[log.length - 1].n : 0);
  useEffect(() => {
    if (!log || !log.length) return;
    const fresh = log.filter(e => e.n > lastN.current);
    if (!fresh.length) return;
    lastN.current = log[log.length - 1].n;
    const cur = latest.current;
    const cu = ui(cur);
    const sel = cu.sel ?? -1;
    if (cur.values.rec && sel < 0) {
      let vals = cur.values, pos = cu.recPos ?? 0;
      for (const e of fresh) ({ values: vals, pos } = recordStep(cur, e.note, !!e.legato, vals, pos));
      cur.setUi({ recPos: pos });
    } else if (sel >= 0) {
      const note = fresh[fresh.length - 1].note;
      editStep(cur, sel, 'seq_notes', encodeNote(note));
      if (stepAt(cur.values, sel).rest) editStep(cur, sel, 'seq_rest', '0');
    }
  }, [log]);

  // Delay Pattern Change: the engine switched patterns at the end of the old one
  const swapped = typeof c.engine.swapped === 'number' ? c.engine.swapped : 0;
  const lastSwap = useRef(swapped);
  useEffect(() => {
    if (swapped === lastSwap.current) return;
    lastSwap.current = swapped;
    const cur = latest.current;
    const cu = ui(cur);
    if (typeof cu.pendingLoc === 'number') {
      const dd = dataOf(cur);
      commitLoad(cur, cu.pendingLoc, dd.bank[cu.pendingLoc] ?? { ...initPattern() });
    }
  }, [swapped]);

  // MIDI program change (manual p.57): 1-64 pattern location, 71-86 ASSIGN mode
  const program = c.engine.program as { n: number; seq: number } | undefined;
  const lastProgram = useRef(program?.seq ?? 0);
  useEffect(() => {
    if (!program || program.seq === lastProgram.current) return;
    lastProgram.current = program.seq;
    const cur = latest.current;
    if (program.n >= 1 && program.n <= 64) loadLoc(cur, program.n - 1);
    else if (program.n >= 71 && program.n <= 86) { cur.setValue('assign_source', program.n - 71); flash(cur, `ASSIGN: ${ASSIGN_SOURCES[program.n - 71]}`); }
  }, [program]);

  // The engine needs to know when notes edit a step rather than transpose
  const t = editTarget(v, u);
  const editingNow = t >= 0 && (u.sel ?? -1) >= 0;
  useEffect(() => { latest.current.sendEvent('editing', editingNow); }, [editingNow]);

  // End temporary displays on time
  const touchAt = u.touch?.at ?? 0;
  useEffect(() => {
    if (!touchAt) return;
    const id = setTimeout(() => latest.current.setUi({ touch: undefined }), 1500);
    return () => clearTimeout(id);
  }, [touchAt]);

  const len = lengthOf(v);
  const pos = typeof c.engine.step === 'number' ? (c.engine.step as number) : -1;
  const st = d.bank[d.loc];
  const edited = st ? !samePattern(st, patternOf(v)) : true;
  const loc = `${locName(d.loc)}${edited ? '*' : ''}`;
  const held = u.held ?? {};
  let text = '';
  const fresh = u.msg && u.msgAt && Date.now() - u.msgAt < 2500;
  const dv = divName(v.step_div, v.div_type);
  const dir = Math.round(num(v.seq_direction, 0));
  if (fresh) text = u.msg!;
  else if (held.kb && held.step && t < 0) text = `KB + STEP · TEMPO = clock division (${divName(v.step_div, 0)}) · GLIDE = swing interval · steps 1-4 = ${DIRECTIONS.join(' / ')}`;
  else if (held.kb && t < 0) text = `KB held · TEMPO = dotted division (${divName(v.step_div, 1)}) · GLIDE = dotted swing interval · release = octave down`;
  else if (held.step && t < 0) text = `STEP held · TEMPO = triplet division (${divName(v.step_div, 2)}) · GLIDE = triplet swing interval · release = octave up`;
  else if (u.latch === 'save') text = `SAVE to ${locName(u.saveLoc ?? d.loc)}${u.saveBank ? ' · pick a BANK with a step button or the arrows' : ' · step buttons / arrows pick the slot, PATTERN the bank'} · SHIFT + RUN/STOP saves · RUN/STOP cancels`;
  else if (u.latch === 'pattern') text = `PATTERN ${locName(d.loc)}: a step button or the arrows pick 1-8 of bank ${Math.floor(d.loc / 8) + 1} · RESET restores it`;
  else if (u.latch === 'bank') text = `BANK ${Math.floor(d.loc / 8) + 1}: a step button or the arrows pick the bank`;
  else if (u.latch === 'setEnd') text = `SET END: (page button, then) the step button of the last step · now ${len} steps`;
  else if (u.latch === 'init') text = 'SHIFT + RESET: press PATTERN to initialize the pattern';
  else if (v.rec) {
    const s = stepAt(v, t);
    text = (u.sel ?? -1) >= 0
      ? `REC · EDIT STEP ${t + 1} (step-write paused) · ${s.rest ? 'REST' : noteName(s.note ?? 48)} · SHIFT + the step resumes`
      : `REC · step ${t + 1}${(u.recPos ?? 0) === 0 ? ' (next note goes here)' : ` ${s.rest ? 'REST' : noteName(s.note ?? 48)} · GATE ${s.gate >= 8 ? 'TIE' : `${s.gate}/8`}${s.glide ? ' · GLIDE' : ''}${s.ratchet > 1 ? ` · RATCHET ${s.ratchet}` : ''}${s.accent ? ' · ACCENT' : ''}`} · keys write · REST · RUN/STOP ends`;
  } else if (t >= 0) {
    const s = stepAt(v, t);
    text = `EDIT STEP ${t + 1} · ${s.rest ? 'REST' : s.note !== null ? noteName(s.note) : '-'} · GATE ${s.gate >= 8 ? 'TIE' : `${s.gate}/8`}${s.glide ? ' · GLIDE' : ''}${s.ratchet > 1 ? ` · RATCHET ${s.ratchet}` : ''}${s.accent ? ' · ACCENT' : ''} · keys set the note · SHIFT + step ${t + 1} ends`;
  } else if (isStepMode(v)) text = `STEP · ${loc} · ${len} steps · page ${['1-8', '9-16', '17-24', '25-32'][shownPage(c)]}${u.pagePinned ? ' (held)' : ''} · step = on/off · SHIFT + step = edit${c.engine.playing ? ` · ▶ ${String(pos + 1).padStart(2, '0')}` : ''}`;
  else {
    const tr = typeof c.engine.transpose === 'number' && c.engine.transpose !== 0 ? ` · TRANSPOSE ${(c.engine.transpose as number) > 0 ? '+' : ''}${c.engine.transpose}` : '';
    // A TEMPO-jack clock: each pulse is a step (SINGLE CLOCK ADVANCE), the division applies to an
    // ANALOG CLOCK at the Setup page 4 PPQN, and STEP ADDRESS CV picks steps by voltage (manual p.55)
    const tmode = Math.round(num(v.tempo_mode, 1));
    const clock = c.engine.extClock
      ? (tmode === 1 ? 'TEMPO CLOCK · ONE STEP PER PULSE' : tmode === 2 ? `TEMPO CLOCK ${dv} · ${PPQN_VALUES[Math.max(0, Math.min(15, Math.round(num(v.clock_in_ppqn, 3))))]} PPQN` : 'TEMPO CV · STEP ADDRESS')
      : c.engine.synced ? `STUDIO CLOCK ${dv}` : dv;
    const extras = `${dir ? ` · ${DIRECTIONS[dir]}` : ''}${num(v.swing, 50) !== 50 ? ` · SWING ${Math.round(num(v.swing, 50))}%` : ''}`;
    const pend = u.pendingLoc !== undefined ? ` · NEXT ${locName(u.pendingLoc)}` : '';
    text = c.engine.armed ? `ARMED · waiting for a clock at TEMPO · ${loc}`
      : c.engine.playing
        ? `▶ ${loc} · ${String(pos + 1).padStart(2, '0')}/${len} · ${clock}${extras}${tr}${pend} · keys transpose`
        : `KB · ${loc} · ${len} steps · ${clock}${extras} · octave ${Math.round(num(v.kb_octave, 3)) + 1}`;
  }
  // 10.5 px: at the iPad's fitted zoom (about 0.86) this still renders at the 9 px legibility floor
  return h('div', {
    className: 'whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none select-none',
    style: {
      width: w, fontSize: 10.5, lineHeight: '13px', fontFamily: '"Arial Narrow", "Roboto Condensed", Arial, sans-serif', fontWeight: 600,
      color: v.rec || u.latch === 'save' ? '#ff8a7d' : '#a3a3a3', letterSpacing: 0.2, WebkitUserSelect: 'none',
    },
    title: text,
  }, text);
}

export const renderReadout = (w: number, k: number) => (c: C) => h(Readout, { c, w: w * k });

// ----------------------------------------------------------------------------
// Setup mode (on the hardware: SHIFT + RESET + SET END + STEP 8; manual pp.58-61), plus the
// timing values the panel reaches with held buttons, for mouse users
// ----------------------------------------------------------------------------

const SETUP_CONTROLS = new Set([
  'assign_source', 'tempo_mode', 'clock_in_ppqn', 'save_mode', 'accent_cv_only', 'tempo_in_range', 'delay_pattern', 'load_timing',
  'step_div', 'div_type', 'swing_div', 'swing_type', 'seq_direction',
]);

function Setup({ c, k }: { c: C; k: number }) {
  const u = ui(c), v = c.values;
  const lessonWants = !!(c.teaching && c.step?.control && SETUP_CONTROLS.has(c.step.control));
  const open = !!u.setup || lessonWants;
  const targetVal = (id: string) => (c.teaching && c.step?.control === id ? c.step.targetValue : undefined);
  // Sizes: 10.5 px text and 30 px rows render at >= 9 px and about 26 px on a fitted iPad panel
  const btn = (label: string, active: boolean, onClick: () => void, target?: boolean, key?: string): ReactNode => h('button', {
    key: key ?? label,
    onClick,
    className: `rounded-sm font-bold leading-none select-none ${target ? 'animate-pulse' : ''}`,
    style: {
      fontSize: 10.5, padding: '5px 5px', minWidth: 26, minHeight: 30, textAlign: 'left', WebkitUserSelect: 'none',
      background: active ? '#e5e5e5' : '#222', color: active ? '#111' : '#bbb',
      border: target ? '2px solid #f97316' : '1px solid #444',
    },
  }, label);
  const header = h('button', {
    'data-control': 'm32_setup',
    onClick: () => c.setUi({ setup: !u.setup }),
    className: 'rounded-sm font-bold select-none',
    style: { fontSize: 10.5, minHeight: 24, padding: '3px 9px', background: open ? '#e5e5e5' : '#1f1f1f', color: open ? '#111' : '#bdbdbd', border: '1px solid #555', letterSpacing: 1, WebkitUserSelect: 'none' },
    'aria-label': 'Setup mode: ASSIGN output, TEMPO input, clock PPQN, save mode, on / off settings, clock division, swing interval and direction',
  }, open ? 'SETUP ✕' : 'SETUP');
  if (!open) return header;
  const val = (id: string, d: number) => Math.round(num(v[id], d));
  const div = divIndex(num(v.step_div, 5), num(v.div_type, 0));
  const swi = divIndex(num(v.swing_div, 5), num(v.swing_type, 0));
  const setDiv = (i: number) => {
    // Setting the clock division also resets the swing interval to it (manual p.21)
    c.setValue('div_type', Math.floor(i / 8)); c.setValue('step_div', i % 8);
    c.setValue('swing_type', Math.floor(i / 8)); c.setValue('swing_div', i % 8);
  };
  const setSwing = (i: number) => { c.setValue('swing_type', Math.floor(i / 8)); c.setValue('swing_div', i % 8); };
  const divTarget = (i: number) => {
    if (!c.teaching || !c.step) return false;
    if (c.step.control === 'step_div') return i === Number(c.step.targetValue) && val('div_type', 0) === 0;
    return c.step.control === 'div_type' && Math.floor(i / 8) === Number(c.step.targetValue) && i % 8 === val('step_div', 5);
  };
  const title = (t: string) => h('div', { key: t, style: { fontWeight: 700, margin: '8px 0 4px' } }, t);
  const grid = (cols: number, items: ReactNode[], key: string) => h('div', { key, className: 'grid gap-1', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } }, ...items);
  const onOff = (id: string, label: string, d: number) => btn(`${label}: ${val(id, d) ? 'ON' : 'OFF'}`, !!val(id, d), () => c.setValue(id, val(id, d) ? 0 : 1), targetVal(id) !== undefined, id);
  const divRows = (cur: number, set: (i: number) => void, prefix: string, isTarget: (i: number) => boolean) => DIV_GROUPS.map((g, gi) => h('div', { key: `${prefix}${g}`, className: 'grid gap-1', style: { gridTemplateColumns: '62px repeat(8, 1fr)', marginBottom: 3 } },
    h('div', { style: { fontSize: 10.5, color: '#a3a3a3', alignSelf: 'center' } }, g),
    ...DIVISIONS.slice(gi * 8, gi * 8 + 8).map((dv, k2) => btn(dv.name.replace(/[DT]$/, ''), cur === gi * 8 + k2, () => set(gi * 8 + k2), isTarget(gi * 8 + k2), `${prefix}${gi * 8 + k2}`))));
  return h('div', { className: 'relative' },
    header,
    h('div', {
      className: 'absolute z-[60] rounded shadow-2xl overflow-y-auto select-none',
      style: { right: 0, bottom: 30 * (k / 4.1), width: 410, maxHeight: 470, padding: 10, background: '#111', border: '1px solid #555', color: '#ddd', fontSize: 10.5, WebkitUserSelect: 'none' },
    },
      title('PAGE 1 · ASSIGN OUTPUT'),
      grid(2, ASSIGN_SOURCES.map((name, i) => btn(`${i + 1}: ${name}`, val('assign_source', 1) === i, () => c.setValue('assign_source', i), targetVal('assign_source') === i, `a${i}`)), 'g1'),
      title('PAGE 3 · TEMPO INPUT'),
      grid(2, TEMPO_MODES.map((name, i) => btn(`${i + 1}: ${name}`, val('tempo_mode', 1) === i, () => c.setValue('tempo_mode', i), targetVal('tempo_mode') === i, `t${i}`)), 'g3'),
      title('PAGE 4 · CLOCK INPUT PPQN (ANALOG CLOCK)'),
      grid(8, PPQN_VALUES.map((p, i) => btn(String(p), val('clock_in_ppqn', 3) === i, () => c.setValue('clock_in_ppqn', i), targetVal('clock_in_ppqn') === i, `p${i}`)), 'g4'),
      title('PAGE 6 · SAVE MODE'),
      grid(3, ['MANUAL', 'AUTO', 'WRITE PROTECT'].map((name, i) => btn(name, val('save_mode', 0) === i, () => c.setValue('save_mode', i), targetVal('save_mode') === i, `s${i}`)), 'g6'),
      title('PAGE 8 · ON / OFF'),
      grid(2, [
        onOff('accent_cv_only', 'ACCENT OUT CV ONLY', 0),
        btn(`TEMPO INPUT: ${val('tempo_in_range', 0) ? '0 TO +5 V' : '-5 TO +5 V'}`, false, () => c.setValue('tempo_in_range', val('tempo_in_range', 0) ? 0 : 1), targetVal('tempo_in_range') !== undefined, 'tir'),
        onOff('delay_pattern', 'DELAY PATTERN CHANGE', 1),
        onOff('load_timing', 'LOAD SAVED TIMING', 1),
      ], 'g8'),
      title('CLOCK DIVISION (TEMPO with an external clock, or KB / STEP held)'),
      ...divRows(div, setDiv, 'd', divTarget),
      title('SWING INTERVAL (GLIDE with KB / STEP held)'),
      ...divRows(swi, setSwing, 'w', i => targetVal('swing_div') === i % 8 && Math.floor(i / 8) === val('swing_type', 0)),
      title('DIRECTION (KB + STEP + step 1-4)'),
      grid(4, DIRECTIONS.map((name, i) => btn(name, val('seq_direction', 0) === i, () => c.setValue('seq_direction', i), targetVal('seq_direction') === i, `r${i}`)), 'gd'),
    ),
  );
}

export const renderSetup = (k: number) => (c: C) => h(Setup, { c, k });

// ----------------------------------------------------------------------------
// The printed scale ring of FREQUENCY, PULSE WIDTH, TEMPO and LFO RATE (decoration). Drawn as
// art, not as a bordered section: a section is a box that the knob's value text must stay in.
// ----------------------------------------------------------------------------

export const renderRing = (outerMm: number, innerMm: number, k: number) => () => {
  const D = outerMm * 2 * k;
  return h('svg', { width: D, height: D, viewBox: `0 0 ${D} ${D}`, 'aria-hidden': true, style: { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' } },
    h('circle', { cx: D / 2, cy: D / 2, r: outerMm * k - 0.5, fill: 'none', stroke: '#d9d9d9', strokeWidth: 1 }),
    h('circle', { cx: D / 2, cy: D / 2, r: innerMm * k - 0.5, fill: 'none', stroke: '#8a8a8a', strokeWidth: 1 }));
};

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
