'use client';
// ============================================================================
// Sub 37 custom panel parts (Subsequent 37 manual pages in brackets):
//   Wheel          PITCH (spring-loaded) and MOD wheels
//   Lcd            the 128 x 64 display: preset name / BNK / PRESET / CAT, the
//                  last control touched, PRESET EDIT / CONTROLLERS / GLOBAL menus,
//                  step record and step edit status; it also writes recorded notes
//                  into the sequence (step record and step edit, pp.17-19)
//   ProgButtons    < > CURSOR, COMPARE / SAVE, MIDI / GLOBAL, PRESET / PANEL (pp.13-14)
//   PresetRow      KB OCTAVE, BANK and PRESET 1-16, which double as the 16 step
//                  buttons in STEP EDIT (pp.12, 14, 18-20)
//   CycleButton    one button stepping through LED-marked positions
//   DestButton     MOD DEST: press cycles, hold + move a control assigns it (p.24)
//   RangeButtons   arpeggiator RANGE < > (and BANK + RANGE = rotate, p.19)
//   SyncTapButton  SYNC, or hold 1 s for tap tempo (p.15)
//   ShiftButton    KNOB SHIFT, blinking while shifted (p.30)
// Touch and mouse alike: pointer events only, no hover-only information. Button
// combinations (BANK + ..., a step + ..., MOD DEST + a control) work with two
// fingers; with a mouse, long-press the first button (half a second) and release
// it: it stays held for the next press (combos.ts).
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import type { ControlSpec, ControlValue, PresetSpec } from '@/types';
import type { CustomRenderContext } from '@/types/panel';
import { describeValue } from '@/lib/controls/mapping';
import { useStudioStore } from '@/store/studio';
import { useUiStore } from '@/store/ui';
import { MOD_DESTS, PATTERN_REC, PATTERN_SEQ, noteName } from './model';
import { SUB37 } from './spec';
import {
  readSeq, recNote, rotate, setFirstStep, setLastStep, setStepPitch, stepLit, tieGroup, toggleRest,
  type SeqStrings,
} from './seq';
import { LATCH_MS, UI_CONTROLS, applySeq, bankHeld, heldStep, selectedStep, usedBank, usedStep } from './combos';

export { UI_CONTROLS };
const UI = new Set(UI_CONTROLS);
const DOUBLE_TAP_MS = 320;
const HOLD_MS = 1000;
const RED = '#ff2d2d';

type Ctx = CustomRenderContext;
type Timer = ReturnType<typeof setTimeout>;

const uiOf = (instance: string) => useUiStore.getState().ui[instance] ?? {};
const noSelect: React.CSSProperties = { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'none' };

// ---------------------------------------------------------------------------
// Presets by bank and slot (16 banks x 16, p.12)
// ---------------------------------------------------------------------------

const BY_SLOT = new Map<string, [string, PresetSpec]>();
Object.entries(SUB37.presets ?? {}).forEach(([k, p]) => {
  const b = Number(p.settings.preset_bank ?? 1), n = Number(p.settings.preset_number ?? 0);
  if (n > 0) BY_SLOT.set(`${b}.${n}`, [k, p]);
});
export const presetAt = (bank: number, slot: number) => BY_SLOT.get(`${bank}.${slot}`)?.[1] ?? null;

/** Load bank / slot like the toolbar's preset menu: unspecified sound controls return to default */
export function loadSlot(instance: string, bank: number, slot: number) {
  const entry = BY_SLOT.get(`${bank}.${slot}`);
  const base: Record<string, ControlValue> = {};
  Object.entries(SUB37.controls).forEach(([id, c]) => {
    if (UI.has(id) || c.type === 'jack' || (c.type === 'button' && c.momentary)) return;
    base[id] = (c as Exclude<ControlSpec, { type: 'jack' }>).default as ControlValue;
  });
  const values = entry ? { ...base, ...entry[1].settings } : { ...base, preset_bank: bank, preset_number: slot };
  useStudioStore.getState().loadPreset(instance, values, entry?.[1].patchConnections ?? []);
}

/** PANEL / INIT held: every sound control back to its default (p.14) */
export function initPanel(instance: string) {
  const base: Record<string, ControlValue> = {};
  Object.entries(SUB37.controls).forEach(([id, c]) => {
    if (UI.has(id) || c.type === 'jack' || (c.type === 'button' && c.momentary)) return;
    base[id] = (c as Exclude<ControlSpec, { type: 'jack' }>).default as ControlValue;
  });
  base.preset_number = 0;
  useStudioStore.getState().loadPreset(instance, base);
}

const splitName = (p: PresetSpec | null) => {
  if (!p) return { cat: 'INIT', name: 'Init Preset' };
  const [cat, ...rest] = p.name.split(' / ');
  return rest.length ? { cat: cat.toUpperCase(), name: rest.join(' / ') } : { cat: 'MISC', name: p.name };
};

// ---------------------------------------------------------------------------
// Wheels
// ---------------------------------------------------------------------------

interface WheelProps {
  label: string;
  control: string;
  value: number;
  min: number;
  max: number;
  spring?: boolean;
  onChange: (v: number) => void;
  /** Called once per gesture when the wheel reaches its top or bottom ('up' / 'down') - lessons count it */
  onEnd?: (end: 'up' | 'down') => void;
}

/** A vertical performance wheel: drag up / down; the PITCH wheel springs back to centre; double-tap resets */
export function Wheel({ label, control, value, min, max, spring, onChange, onEnd }: WheelProps) {
  const drag = useRef<{ y: number; v: number; id: number; h: number; ends: Set<string> } | null>(null);
  const lastTap = useRef(0);
  const norm = (value - min) / (max - min);
  const offset = (norm - 0.5) * 2; // -1..1

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      onChange(spring ? 0 : min);
      return;
    }
    lastTap.current = now;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    drag.current = { y: e.clientY, v: value, id: e.pointerId, h: e.currentTarget.getBoundingClientRect().height, ends: new Set() };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const delta = ((d.y - e.clientY) / (d.h * 0.8)) * (max - min);
    const v = Math.round(Math.max(min, Math.min(max, d.v + delta)));
    if (v !== value) onChange(v);
    const end = v >= max ? 'up' : v <= min ? 'down' : null;
    if (end && !d.ends.has(end)) { d.ends.add(end); onEnd?.(end); }
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (spring) onChange(0);
  };

  return (
    <div style={{ ...noSelect, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', width: '100%' }}>
      <div
        role="slider"
        aria-label={`${label} wheel`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        data-wheel={label}
        data-control={control}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{
          ...noSelect,
          position: 'relative', flex: 1, width: '100%', borderRadius: 6, overflow: 'hidden', cursor: 'ns-resize',
          background: '#050505', border: '2px solid #2b2b2b', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.9)',
        }}
      >
        <div
          style={{
            position: 'absolute', left: '12%', right: '12%', top: '3%', bottom: '3%', borderRadius: 4,
            background: 'repeating-linear-gradient(180deg, #2a2a2a 0px, #2a2a2a 3px, #121212 3px, #121212 6px)',
            backgroundPositionY: `${-offset * 40}px`,
            boxShadow: 'inset 0 18px 18px -8px rgba(0,0,0,0.95), inset 0 -18px 18px -8px rgba(0,0,0,0.95)',
          }}
        />
        <div style={{ position: 'absolute', left: '12%', right: '12%', pointerEvents: 'none', top: `${50 - offset * 38}%`, height: 3, background: '#e5e5e5', boxShadow: '0 0 3px rgba(255,255,255,0.6)' }} />
      </div>
      <div style={{ fontWeight: 700, marginTop: 4, fontSize: 10.5, color: '#dcdcdc', letterSpacing: '0.6px' }}>{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

/**
 * Touch area beyond a cap's edges, native px: one number for every side, or [left, right, top,
 * bottom]. The caps are drawn hardware-small (8.5 x 5 mm), about 14 x 8 CSS px on an iPad, so
 * each one reaches out into the free panel around it (never into a neighbour's own touch area).
 */
export type Hit = number | [number, number, number, number];

interface CapProps {
  lit: number;
  blink?: boolean;
  label?: string;
  control?: string;
  preset?: number;
  title?: string;
  aria: string;
  onDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onUp?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  w?: number;
  h?: number;
  highlighted?: boolean;
  hit?: Hit;
  /** Font size of the cap's own legend (native px) */
  fontSize?: number;
}

/** The Sub 37's lit rectangular button cap (w / h in px) */
function Cap({ lit, blink, label, control, preset, title, aria, onDown, onUp, w = 17, h = 10, highlighted, hit, fontSize = 9 }: CapProps) {
  const on = lit > 0.02;
  const [hl, hr, ht, hb] = typeof hit === 'number' ? [hit, hit, hit, hit] : hit ?? [0, 0, 0, 0];
  return (
    <button
      type="button"
      data-control={control}
      data-preset={preset}
      title={title}
      aria-label={aria}
      aria-pressed={on}
      onPointerDown={e => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        onDown(e);
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={e => e.preventDefault()}
      className={blink ? 'animate-pulse' : undefined}
      style={{
        ...noSelect,
        position: 'relative', flexShrink: 0, pointerEvents: 'auto',
        width: w, height: h, borderRadius: 2, cursor: 'pointer', padding: 0,
        border: highlighted ? '2px solid #f97316' : '1px solid #4a4a4a',
        background: on ? `linear-gradient(${RED}, #b3201b)` : 'linear-gradient(#2c2c2c, #151515)',
        opacity: on ? 0.45 + 0.55 * Math.min(1, lit) : 1,
        boxShadow: on ? `0 0 ${3 + 5 * lit}px ${RED}` : 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 3px rgba(0,0,0,0.6)',
        color: on ? '#160303' : '#d8d8d8', fontSize, fontWeight: 800, lineHeight: 1,
      }}
    >
      {(hl || hr || ht || hb) ? <span aria-hidden style={{ position: 'absolute', left: -hl, right: -hr, top: -ht, bottom: -hb }} /> : null}
      {label}
    </button>
  );
}

const targeted = (ctx: Ctx, id: string) => !!(ctx.teaching && ctx.step?.control === id);

/** One button stepping a switch through its positions; the positions show on separate LEDs */
export function CycleButton({ ctx, control, order, reverse, hit }: { ctx: Ctx; control: string; order?: number[]; reverse?: boolean; hit?: Hit }) {
  const spec = SUB37.controls[control];
  const n = spec?.type === 'switch' ? spec.options.length : 1;
  const seq = order ?? Array.from({ length: n }, (_, i) => i);
  const cur = Math.round(Number(ctx.values[control] ?? (spec && 'default' in spec ? spec.default : 0)));
  const next = () => {
    const i = seq.indexOf(cur);
    const j = reverse ? (i - 1 + seq.length) % seq.length : (i + 1) % seq.length;
    ctx.setValue(control, seq[j < 0 ? 0 : j]);
  };
  const label = spec?.type === 'switch' ? spec.options[cur] : '';
  return <Cap lit={0} control={control} aria={`${spec?.label ?? control}: ${label}`} onDown={next} highlighted={targeted(ctx, control)} hit={hit} />;
}

/**
 * MOD DEST (pp.23-24): a press steps through the seven destinations; hold it and move a control
 * to make that control the destination (combos.ts). A long press and release keeps it held
 * for the next control you move (mouse).
 */
export function DestButton({ ctx, bus, hit }: { ctx: Ctx; bus: 1 | 2; hit?: Hit }) {
  const control = `mod${bus}_dest`;
  const timer = useRef<Timer | null>(null);
  const down = () => {
    const ui = uiOf(ctx.instance);
    // a press on the latched button lets go of it
    if (Number(ui.destLatched ?? 0) === bus) { ctx.setUi({ destHeld: 0, destLatched: 0, destArmed: 0, destCancel: true }); return; }
    ctx.setUi({ destHeld: bus, destLatched: 0, destAssigned: false, destArmed: 0, destCancel: false });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; ctx.setUi({ destArmed: bus }); }, LATCH_MS);
  };
  const up = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const ui = uiOf(ctx.instance);
    if (ui.destCancel) { ctx.setUi({ destCancel: false }); return; }
    if (ui.destAssigned) { ctx.setUi({ destHeld: 0, destArmed: 0 }); return; }
    if (Number(ui.destArmed ?? 0) === bus) {
      ctx.setUi({ destLatched: bus, destArmed: 0, note: `MOD ${bus} DEST: MOVE CONTROL`, noteAt: Date.now() });
      return;
    }
    ctx.setUi({ destHeld: 0 });
    const cur = Math.round(Number(ctx.values[control] ?? 1));
    ctx.setValue(control, (cur + 1) % MOD_DESTS.length);
  };
  const held = Number(ctx.ui.destHeld ?? 0) === bus;
  const latched = Number(ctx.ui.destLatched ?? 0) === bus;
  return <Cap lit={held ? 1 : 0} blink={latched} control={control} aria={`MOD ${bus} DEST: ${MOD_DESTS[Math.round(Number(ctx.values[control] ?? 1))]}`} onDown={down} onUp={up} highlighted={targeted(ctx, control)} hit={hit} />;
}

/** CONTROLLERS: opens the bus's MOD CONTROL menu on the LCD (p.50) */
export function ControllersButton({ ctx, bus, hit }: { ctx: Ctx; bus: 1 | 2; hit?: Hit }) {
  const open = ctx.ui.menu === `mod${bus}`;
  return (
    <Cap
      lit={open ? 1 : 0}
      control={`mod${bus}_controllers`}
      aria={`MOD ${bus} CONTROLLERS`}
      onDown={() => ctx.setUi(open ? { menu: null } : { menu: `mod${bus}`, menuRow: 0, menuEdit: false })}
      hit={hit}
    />
  );
}

/** Arpeggiator RANGE < and > (7 states, p.15); with BANK held they rotate the sequence (p.19) */
export function RangeButton({ ctx, dir, hit }: { ctx: Ctx; dir: -1 | 1; hit?: Hit }) {
  const press = () => {
    const ui = uiOf(ctx.instance);
    if (bankHeld(ui)) {
      const s = readSeq(ctx.values);
      applySeq(ctx.setValue, s, rotate(s, dir));
      ctx.setUi({ ...usedBank(ui), note: `ROTATE: ${dir < 0 ? 'LEFT' : 'RIGHT'}`, noteAt: Date.now() });
      return;
    }
    const cur = Math.round(Number(ctx.values.arp_oct_range ?? 3));
    ctx.setValue('arp_oct_range', Math.max(0, Math.min(6, cur + dir)));
  };
  return <Cap lit={0} control="arp_oct_range" aria={dir < 0 ? 'RANGE down' : 'RANGE up'} label={dir < 0 ? '◀' : '▶'} onDown={press} highlighted={targeted(ctx, 'arp_oct_range')} hit={hit} fontSize={10} />;
}

/** SYNC: press toggles; hold one second for TAP tempo, where taps set the internal clock (p.15) */
export function SyncTapButton({ ctx, hit }: { ctx: Ctx; hit?: Hit }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const taps = useRef<number[]>([]);
  const tapMode = !!ctx.ui.tapMode;
  const down = () => {
    held.current = false;
    timer.current = setTimeout(() => {
      held.current = true;
      const on = !uiOf(ctx.instance).tapMode;
      ctx.setUi({ tapMode: on });
      taps.current = [];
      if (on) ctx.setValue('arp_sync', false);
    }, HOLD_MS);
  };
  const up = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (held.current) return;
    if (uiOf(ctx.instance).tapMode) {
      const now = performance.now();
      const t = taps.current.filter(x => now - x < 5000);
      t.push(now);
      taps.current = t.slice(-8);
      if (taps.current.length >= 3) {
        const d = taps.current.slice(1).map((x, i) => x - taps.current[i]);
        const bpm = 60000 / (d.reduce((a, b) => a + b, 0) / d.length);
        ctx.setValue('arp_rate', Math.round(Math.max(2, Math.min(280, bpm))));
      }
      return;
    }
    ctx.setValue('arp_sync', !ctx.values.arp_sync);
  };
  return <Cap lit={ctx.values.arp_sync ? 1 : 0} blink={tapMode} control="arp_sync" aria={tapMode ? 'TAP tempo' : 'ARP SYNC'} onDown={down} onUp={up} highlighted={targeted(ctx, 'arp_sync')} hit={hit} />;
}

/** KNOB SHIFT: blinks while the envelope knobs are shifted (p.30) */
export function ShiftButton({ ctx, hit }: { ctx: Ctx; hit?: Hit }) {
  const on = !!ctx.values.knob_shift;
  return <Cap lit={on ? 1 : 0} blink={on} control="knob_shift" aria="KNOB SHIFT" onDown={() => ctx.setValue('knob_shift', !on)} highlighted={targeted(ctx, 'knob_shift')} hit={hit} />;
}

// ---------------------------------------------------------------------------
// Programming section (pp.13-14) and the LCD menus (pp.39-52)
// ---------------------------------------------------------------------------

type MenuItem = string | { header: string };
const MENUS: Record<string, { title: string; items: MenuItem[] }> = {
  preset: {
    title: 'PRESET EDIT',
    items: [
      { header: 'ARPEGGIATOR' }, 'arp_gate', 'arp_div', 'arp_swing', 'arp_step1_reset', 'arp_end_notes',
      { header: 'SEQUENCER' }, 'seq_ratchet', 'seq_first', 'seq_len',
      { header: 'FILTER EG' }, 'feg_gate_src', 'feg_attack_exp', 'feg_sync_div',
      { header: 'AMP EG' }, 'aeg_gate_src', 'aeg_attack_exp', 'aeg_sync_div',
      { header: 'KEYS / WHEELS' }, 'kb_transpose', 'key_priority', 'bend_up', 'bend_down', 'bend_dest', 'preset_volume',
    ],
  },
  mod1: { title: 'MOD 1 CONTROL', items: ['mod1_wheel', 'mod1_vel', { header: 'MOD 1 EDIT' }, 'mod1_pgm_src', 'mod1_pgm_dst', 'mod1_lfo_kb'] },
  mod2: { title: 'MOD 2 CONTROL', items: ['mod2_wheel', 'mod2_vel', { header: 'MOD 2 EDIT' }, 'mod2_pgm_src', 'mod2_pgm_dst', 'mod2_lfo_kb'] },
  global: { title: 'GLOBAL', items: [{ header: 'SEQ OPTIONS' }, 'seq_ref', 'latch_restart'] },
};
const menuRows = (menu: string) => (MENUS[menu]?.items ?? []).filter((x): x is string => typeof x === 'string');

/** One step of a menu value with < > (p.39) */
function stepValue(id: string, value: ControlValue | undefined, dir: -1 | 1): ControlValue | undefined {
  const s = SUB37.controls[id];
  if (!s) return undefined;
  if (s.type === 'button') return !value;
  if (s.type === 'switch') return Math.max(0, Math.min(s.options.length - 1, Math.round(Number(value ?? s.default)) + dir));
  if (s.type === 'knob') {
    const st = s.step ?? (s.max - s.min > 20 ? 1 : 0.1);
    const v = Number(value ?? s.default) + dir * st;
    return Math.max(s.min, Math.min(s.max, Math.round(v / st) * st));
  }
  return undefined;
}

function menuMove(ctx: Ctx, dir: -1 | 1) {
  const ui = uiOf(ctx.instance);
  const menu = ui.menu as string | null | undefined;
  if (!menu) {
    // outside the menus, < > step through the presets of the bank (p.12)
    const bank = Math.round(Number(ctx.values.preset_bank ?? 1));
    const slot = Math.round(Number(ctx.values.preset_number ?? 0));
    let b = bank, s = slot + dir;
    if (s > 16) { s = 1; b = bank >= 16 ? 1 : bank + 1; }
    if (s < 1) { s = 16; b = bank <= 1 ? 16 : bank - 1; }
    loadSlot(ctx.instance, b, s);
    return;
  }
  const rows = menuRows(menu);
  const row = Math.max(0, Math.min(rows.length - 1, Number(ui.menuRow ?? 0)));
  if (ui.menuEdit) {
    const id = rows[row];
    const v = stepValue(id, ctx.values[id], dir);
    if (v !== undefined) ctx.setValue(id, v);
  } else {
    ctx.setUi({ menuRow: Math.max(0, Math.min(rows.length - 1, row + dir)) });
  }
}

export function ProgButtons({ ctx }: { ctx: Ctx }) {
  const hold = useRef<{ id: string; timer: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);
  const menu = ctx.ui.menu as string | null | undefined;
  const flash = (msg: string) => ctx.setUi({ note: msg, noteAt: Date.now() });

  const press = (id: string) => {
    if (id === 'dec') return menuMove(ctx, -1);
    if (id === 'inc') return menuMove(ctx, 1);
    if (id === 'cursor') { if (menu) ctx.setUi({ menuEdit: !uiOf(ctx.instance).menuEdit }); return; }
    if (id === 'global') return ctx.setUi(menu === 'global' ? { menu: null } : { menu: 'global', menuRow: 0, menuEdit: false });
    if (id === 'compare') return flash('COMPARE: NOT MODELLED');
    if (id === 'save') return flash('SAVE: USE A PROJECT');
    if (id === 'midi') return flash('MIDI: IN THE STUDIO');
  };
  const holdable = (id: string, onHold: () => void, onTap: () => void) => ({
    onDown: () => {
      const st = { id, fired: false, timer: setTimeout(() => { st.fired = true; onHold(); }, HOLD_MS) };
      hold.current = st;
    },
    onUp: () => {
      const st = hold.current;
      hold.current = null;
      if (!st || st.id !== id) return;
      clearTimeout(st.timer);
      if (!st.fired) onTap();
    },
  });
  const presetBtn = holdable(
    'preset',
    () => ctx.setUi({ menu: 'preset', menuRow: 0, menuEdit: false }),
    () => ctx.setUi({ menu: null, bankMode: false }),
  );
  const panelBtn = holdable('panel', () => { initPanel(ctx.instance); flash('PANEL: INITIALIZED'); }, () => flash('PANEL: HOLD TO INIT'));
  // As the manual draws it (p.13): ▼ ▲ CURSOR in a row under the LCD, then COMPARE / SAVE,
  // MIDI / GLOBAL and PRESET (EDIT) / PANEL (INIT) in two columns; names under the buttons.
  // Positions are mm from this block's top-left corner (2 px per mm).
  const cell = (id: string, name: string, xMm: number, yMm: number, lit: boolean, h?: ReturnType<typeof holdable>, extra: { above?: string; invert?: boolean; aria?: string; hit?: Hit } = {}) => (
    <div key={id} style={{ position: 'absolute', left: xMm * 2, top: yMm * 2, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {extra.above && <span style={{ ...PROG_TAG, position: 'absolute', bottom: '100%', marginBottom: 1 }}>{extra.above}</span>}
      <Cap lit={lit ? 1 : 0} control={`prog_${id}`} aria={extra.aria ?? name} onDown={h ? h.onDown : () => press(id)} onUp={h?.onUp} w={20} h={12} hit={extra.hit} />
      <span style={{ ...PROG_NAME, ...(extra.invert ? PROG_INVERT : {}) }}>{name}</span>
    </div>
  );
  return (
    <div style={{ ...noSelect, position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' }}>
      {cell('dec', '▼', 10.5, 1, false, undefined, { aria: 'DEC ▼', hit: [10, 4, 5, 7] })}
      {cell('inc', '▲', 24.5, 1, false, undefined, { aria: 'INC ▲', hit: [4, 4, 5, 7] })}
      {cell('cursor', 'CURSOR', 38.5, 1, !!ctx.ui.menuEdit, undefined, { hit: [4, 10, 5, 7] })}
      {cell('compare', 'COMPARE', 12.5, 14, false, undefined, { hit: [14, 14, 7, 7] })}
      {cell('save', 'SAVE', 36.5, 14, false, undefined, { invert: true, hit: [14, 14, 7, 7] })}
      {cell('midi', 'MIDI', 12.5, 27, false, undefined, { hit: [14, 14, 7, 12] })}
      {cell('global', 'GLOBAL', 36.5, 27, menu === 'global', undefined, { hit: [14, 14, 7, 12] })}
      {cell('preset', 'PRESET', 12.5, 46, !menu || menu === 'preset', presetBtn, { above: 'EDIT', hit: [14, 14, 12, 16] })}
      {cell('panel', 'PANEL ▶', 36.5, 46, false, panelBtn, { above: 'INIT', aria: 'PANEL', hit: [14, 14, 12, 16] })}
    </div>
  );
}

// Condensed faces on every platform (iPadOS has no Arial Narrow: Avenir Next / Helvetica Neue condensed)
const PROG_FONT = '"Arial Narrow", "Roboto Condensed", "Avenir Next Condensed", "HelveticaNeue-CondensedBold", Arial, sans-serif';
const PROG_NAME: React.CSSProperties = { fontFamily: PROG_FONT, fontSize: 10.5, lineHeight: 1.1, fontWeight: 700, color: '#e8e8e8', letterSpacing: '0.3px', whiteSpace: 'nowrap', marginTop: 2, padding: '0 2px' };
const PROG_INVERT: React.CSSProperties = { background: '#e8e8e8', color: '#111', borderRadius: 2 };
const PROG_TAG: React.CSSProperties = { fontFamily: PROG_FONT, fontSize: 9.5, lineHeight: 1, fontStyle: 'italic', fontWeight: 700, color: '#bdbdbd', whiteSpace: 'nowrap' };

// ---------------------------------------------------------------------------
// LCD (128 x 64, blue backlight)
// ---------------------------------------------------------------------------

const TRUNC: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const recSeen = new Map<string, number>();

interface KeyNote { sid: string; n: number; note: number; legato: boolean }

/** Writes keys into the sequence: step record (PATTERN REC, p.17) and a selected step in step edit (p.19) */
function useNoteWriter(ctx: Ctx) {
  const key = ctx.engine.keyNote as KeyNote | null | undefined;
  const id = key ? `${key.sid}:${key.n}` : '';
  useEffect(() => {
    if (!key) return;
    const seen = recSeen.get(key.sid) ?? -1;
    if (key.n <= seen) return;
    recSeen.set(key.sid, key.n);
    const ui = uiOf(ctx.instance);
    const values = useStudioStore.getState().devices[ctx.instance]?.controlValues ?? ctx.values;
    if (ui.kbBoth) {
      // both KB OCTAVE buttons held: a key in the lower two octaves sets KB TRANSPOSE, middle C
      // (MIDI 48) for 0, the keys below it down and the keys above it up (p.14)
      const raw = key.note - Math.round(Number(values.kb_transpose ?? 0)) - 12 * Math.round(Number(values.kb_octave ?? 0));
      if (raw >= 36 && raw <= 60) {
        const tr = raw - 48;
        ctx.setValue('kb_transpose', tr);
        ctx.setUi({ note: `KB TRANSPOSE: ${tr > 0 ? '+' : ''}${tr}`, noteAt: Date.now() });
      }
      return;
    }
    const pattern = Math.round(Number(values.arp_pattern ?? 0));
    const s = readSeq(values);
    const sel = ui.stepEdit ? selectedStep(ui) : null;
    if (sel !== null && (pattern === PATTERN_SEQ || pattern === PATTERN_REC)) {
      // a non-legato key sets pitch 1 of the selected step, a legato key pitch 2
      applySeq(ctx.setValue, s, setStepPitch(s, sel, key.note, key.legato));
      return;
    }
    if (pattern !== PATTERN_REC) return;
    const r = { pos: Number(ui.recPos ?? 0), tie: !!ui.recTie };
    const out = recNote(s, r, key.note, key.legato, !!values.duo_mode);
    applySeq(ctx.setValue, s, out.seq);
    ctx.setUi({ recPos: out.rec.pos, recTie: out.rec.tie });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}

/** LCD text: a condensed face, so a 45 mm screen holds its lines at a legible size on an iPad */
const LCD_FONT = PROG_FONT;
const LCD_SMALL = 10.5;
const LCD_BIG = 12.5;
const LCD_ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 4, fontSize: LCD_SMALL, lineHeight: 1.15, whiteSpace: 'nowrap' };

function MenuView({ ctx, menu }: { ctx: Ctx; menu: string }) {
  const m = MENUS[menu];
  const rows = menuRows(menu);
  const row = Math.max(0, Math.min(rows.length - 1, Number(ctx.ui.menuRow ?? 0)));
  const edit = !!ctx.ui.menuEdit;
  // three lines around the selection
  const start = Math.max(0, Math.min(rows.length - 3, row - 1));
  return (
    <>
      <div style={{ ...LCD_ROW, fontWeight: 700, borderBottom: '1px solid rgba(232,240,255,0.35)' }}>
        <span style={TRUNC}>{m.title}</span>
        <span>{row + 1}/{rows.length}</span>
      </div>
      {rows.slice(start, start + 3).map((id, k) => {
        const i = start + k;
        const s = SUB37.controls[id];
        const sel = i === row;
        return (
          <div
            key={id}
            onPointerDown={e => { e.preventDefault(); ctx.setUi({ menuRow: i, menuEdit: sel ? !edit : true }); }}
            style={{ ...LCD_ROW, lineHeight: 1.22, padding: '0 2px', cursor: 'pointer',
              background: sel ? (edit ? '#e8f0ff' : 'rgba(232,240,255,0.25)') : undefined, color: sel && edit ? '#13307a' : undefined }}
          >
            <span style={TRUNC}>{s?.label ?? id}</span>
            <span style={{ fontWeight: 700 }}>{describeValue(s, ctx.values[id] ?? (s && 'default' in s ? s.default as ControlValue : undefined))}</span>
          </div>
        );
      })}
    </>
  );
}

/** Seconds a touched control (or a message) stays on the LCD before the preset screen returns */
const LCD_HOLD_MS = 2500;

/** True while `stamp` (a new object or time) is younger than LCD_HOLD_MS; re-renders when it expires */
function useFresh(stamp: unknown, at: number | null): boolean {
  const [until, setUntil] = useState(0);
  const last = useRef<unknown>(stamp);
  useEffect(() => {
    if (stamp && stamp !== last.current) setUntil((at ?? Date.now()) + LCD_HOLD_MS);
    last.current = stamp;
  }, [stamp, at]);
  const [, tick] = useState(0);
  useEffect(() => {
    const wait = until - Date.now();
    if (wait <= 0) return;
    const t = setTimeout(() => tick(x => x + 1), wait + 20);
    return () => clearTimeout(t);
  }, [until]);
  return !!stamp && Date.now() < until;
}

/**
 * PATTERN moved (by hand, a preset, a lesson or MIDI): turning to REC arms step record, so the
 * next key starts a new sequence at step 1 (p.17); leaving SEQ / REC ends STEP EDIT (p.18).
 */
function usePatternWatch(ctx: Ctx, pattern: number) {
  const prev = useRef(pattern);
  useEffect(() => {
    const was = prev.current;
    prev.current = pattern;
    if (was === pattern) return;
    const patch: Record<string, unknown> = {};
    if (pattern === PATTERN_REC) Object.assign(patch, { recPos: 0, recTie: false });
    const ui = uiOf(ctx.instance);
    if (pattern !== PATTERN_REC && pattern !== PATTERN_SEQ && ui.stepEdit) Object.assign(patch, { stepEdit: false, stepSel: null, stepHeld: null, stepLatched: false });
    if (Object.keys(patch).length) ctx.setUi(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern]);
}

export function Lcd({ ctx }: { ctx: Ctx }) {
  useNoteWriter(ctx);
  const v = ctx.values;
  const pattern = Math.round(Number(v.arp_pattern ?? 0));
  usePatternWatch(ctx, pattern);
  const bank = Math.round(Number(v.preset_bank ?? 1));
  const slot = Math.round(Number(v.preset_number ?? 0));
  const p = slot ? presetAt(bank, slot) : null;
  const { cat, name } = slot ? splitName(p) : { cat: 'PANEL', name: 'Panel' };
  const lcd = ctx.engine.lcd as { title: string; value: string } | null | undefined;
  const menu = ctx.ui.menu as string | null | undefined;
  const note = ctx.ui.note as string | undefined;
  const noteAt = Number(ctx.ui.noteAt ?? 0) || null;
  const noteFresh = useFresh(note ? noteAt : null, noteAt) && !!note;
  const lcdFresh = useFresh(lcd ?? null, null);
  const s = readSeq(v);
  const latchedStep = ctx.ui.stepLatched ? heldStep(ctx.ui) : null;
  let status = '';
  if (Number(ctx.ui.destLatched ?? 0)) {
    status = `MOD ${ctx.ui.destLatched} DEST: ASSIGN`;
  } else if (ctx.ui.bankLatched) {
    status = 'BANK HELD';
  } else if (latchedStep !== null) {
    status = `STEP ${latchedStep + 1} HELD`;
  } else if (ctx.ui.stepEdit) {
    const cur = Number(ctx.engine.seqStep ?? -1);
    const sel = ctx.ui.stepSel as number | null | undefined;
    const page = Number(ctx.ui.seqPage ?? 0) + 1;
    status = `${ctx.engine.gate ? '▶' : '■'} EDIT ${String((sel ?? Math.max(0, cur)) + 1).padStart(2, '0')}/${s.seq_len} P${page}`;
  } else if (pattern === PATTERN_REC) {
    const pos = Number(ctx.ui.recPos ?? 0);
    status = pos ? `REC ${String(pos).padStart(2, '0')} / ${String(s.seq_len).padStart(2, '0')}${ctx.ui.recTie ? ' TIE' : ''}` : 'REC: PLAY A KEY';
  } else if (ctx.engine.clockWait) {
    status = 'SYNC: WAIT FOR ▶';
  } else if (ctx.ui.tapMode) {
    status = `TAP ${Math.round(Number(v.arp_rate ?? 120))} BPM`;
  } else if (ctx.ui.bankMode) {
    status = 'BANK: PRESS 1-16';
  }
  const flags: string[] = [];
  if (v.knob_shift) flags.push('SHIFT');
  if (v.arp_on && pattern !== PATTERN_REC) flags.push(pattern === PATTERN_SEQ ? 'SEQ' : 'ARP');
  if (v.duo_mode) flags.push('DUO');
  // The middle of the screen: a message, else the control just touched (as the hardware shows
  // an edit), else the preset name on up to two lines
  const [noteTitle, noteValue] = note && note.includes(': ') ? [note.slice(0, note.indexOf(': ')), note.slice(note.indexOf(': ') + 2)] : ['', note ?? ''];
  const mid = noteFresh ? { title: noteTitle, value: noteValue } : lcdFresh && lcd ? lcd : null;
  const warn = status.startsWith('SYNC') || status.includes('HELD') || status.includes('ASSIGN');
  return (
    <div
      style={{
        ...noSelect,
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: LCD_FONT, letterSpacing: '0.2px', background: 'linear-gradient(180deg, #1b3d8f 0%, #13307a 100%)',
        color: '#e8f0ff', padding: '3px 4px', textShadow: '0 0 3px rgba(190,215,255,0.55)', boxShadow: 'inset 0 0 10px rgba(0,0,20,0.7)',
        border: '2px solid #111', borderRadius: 3,
      }}
      data-control="lcd"
    >
      {menu && MENUS[menu] ? (
        <MenuView ctx={ctx} menu={menu} />
      ) : (
        <>
          <div style={{ ...LCD_ROW, opacity: 0.92 }}>
            <span>BNK {String(bank).padStart(2, '0')}</span>
            <span>PRESET {slot ? String(slot).padStart(2, '0') : '--'}</span>
          </div>
          <div style={{ height: LCD_BIG * 2.1, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: '1px solid rgba(232,240,255,0.3)', borderBottom: '1px solid rgba(232,240,255,0.3)' }}>
            {mid ? (
              <>
                {mid.title && <div style={{ ...TRUNC, fontSize: LCD_SMALL, lineHeight: 1.1, opacity: 0.92 }}>{mid.title}</div>}
                <div style={{ ...TRUNC, fontSize: LCD_BIG + 0.5, lineHeight: 1.1, fontWeight: 700 }}>{mid.value}</div>
              </>
            ) : (
              <div style={{ fontSize: LCD_BIG, lineHeight: 1.05, fontWeight: 700, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                {name.toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ ...LCD_ROW, marginTop: 'auto', fontWeight: status ? 700 : 400, color: warn ? '#ffd27a' : undefined }}>
            {status ? <span style={TRUNC}>{status}</span> : (
              <>
                <span style={TRUNC}>CAT: {cat}</span>
                <span>{flags.join(' ')}</span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KB OCTAVE, BANK and PRESET 1-16 (pp.12, 14, 18-20)
// ---------------------------------------------------------------------------

export function KbOctave({ ctx }: { ctx: Ctx }) {
  const downs = useRef(new Set<number>());
  const both = useRef<{ timer: ReturnType<typeof setTimeout> | null; used: boolean }>({ timer: null, used: false });
  const oct = Math.round(Number(ctx.values.kb_octave ?? 0));
  const press = (dir: -1 | 1) => {
    downs.current.add(dir);
    if (downs.current.size === 2) {
      // both together: back to the standard octave; held for a second: MIDI panic; while both
      // are held, a key in the lower two octaves sets KB TRANSPOSE (p.14)
      both.current.used = true;
      ctx.setValue('kb_octave', 0);
      ctx.setUi({ kbBoth: true, note: 'KB TRANSPOSE: PLAY A KEY', noteAt: Date.now() });
      both.current.timer = setTimeout(() => { ctx.sendEvent('panic'); ctx.setUi({ note: 'MIDI: PANIC', noteAt: Date.now() }); }, HOLD_MS);
    }
  };
  const release = (dir: -1 | 1) => {
    const wasBoth = downs.current.size === 2 || both.current.used;
    downs.current.delete(dir);
    if (uiOf(ctx.instance).kbBoth) ctx.setUi({ kbBoth: false });
    if (both.current.timer) { clearTimeout(both.current.timer); both.current.timer = null; }
    if (wasBoth) { if (!downs.current.size) both.current.used = false; return; }
    const ui = uiOf(ctx.instance);
    const held = heldStep(ui);
    if (ui.stepEdit && held !== null) {
      // hold a step + KB OCTAVE down / up: FIRST / LAST step (p.19)
      const s = readSeq(ctx.values);
      applySeq(ctx.setValue, s, dir < 0 ? setFirstStep(s, held) : setLastStep(s, held));
      ctx.setUi({ ...usedStep(ui), note: `${dir < 0 ? 'FIRST' : 'LAST'} STEP: ${held + 1}`, noteAt: Date.now() });
      return;
    }
    if (bankHeld(ui) && ui.stepEdit) {
      // BANK + KB OCTAVE: sequence page (p.18)
      const page = Math.max(0, Math.min(3, Number(ui.seqPage ?? 0) + dir));
      ctx.setUi({ ...usedBank(ui), seqPage: page, pageChase: false, note: `PAGE: P${page + 1}`, noteAt: Date.now() });
      return;
    }
    ctx.setValue('kb_octave', Math.max(-2, Math.min(2, oct + dir)));
  };
  const lit = (dir: -1 | 1) => (Math.sign(oct) === dir ? (Math.abs(oct) === 2 ? 1 : 0.45) : 0);
  return (
    <div style={{ ...noSelect, display: 'flex', gap: 6, alignItems: 'flex-end', pointerEvents: 'none' }}>
      {([-1, 1] as const).map(d => (
        <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Cap lit={lit(d)} control={d < 0 ? 'kb_octave_down' : 'kb_octave_up'} aria={d < 0 ? 'KB OCTAVE down' : 'KB OCTAVE up'} label={d < 0 ? '▼' : '▲'} onDown={() => press(d)} onUp={() => release(d)} w={20} highlighted={targeted(ctx, 'kb_octave')} hit={d < 0 ? [6, 3, 12, 20] : [3, 8, 12, 20]} fontSize={10} />
        </div>
      ))}
    </div>
  );
}

/**
 * BANK (pp.12, 18): a press picks the bank-select mode (then PRESET 1-16), or in STEP EDIT
 * deselects the step. Held (or long-pressed and released), it combines with the next button:
 * LATCH (STEP EDIT), a step (select it), KB OCTAVE (page), RANGE (rotate), BACK/FORTH and
 * INVERT (ratchet count), PATTERN to REC (quick erase).
 */
export function BankButton({ ctx, hit }: { ctx: Ctx; hit?: Hit }) {
  const timer = useRef<Timer | null>(null);
  const down = () => {
    const ui = uiOf(ctx.instance);
    if (ui.bankLatched) { ctx.setUi({ bankLatched: false, bankCancel: true, bankArmed: false }); return; }
    ctx.setUi({ bankDown: true, bankUsed: false, bankArmed: false, bankCancel: false });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; ctx.setUi({ bankArmed: true }); }, LATCH_MS);
  };
  const up = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const ui = uiOf(ctx.instance);
    ctx.setUi({ bankDown: false, bankArmed: false });
    if (ui.bankCancel) { ctx.setUi({ bankCancel: false }); return; }
    if (ui.bankUsed) return;
    if (ui.bankArmed) { ctx.setUi({ bankLatched: true, bankMode: false, note: 'BANK: HELD', noteAt: Date.now() }); return; }
    if (ui.stepEdit) { ctx.setUi({ stepSel: null }); return; }   // deselect the step (p.18)
    ctx.setUi({ bankMode: !ui.bankMode, menu: null });
  };
  const held = bankHeld(ctx.ui);
  const lit = ctx.ui.bankMode || held ? 1 : ctx.ui.stepEdit && ctx.ui.stepSel == null ? 0.5 : 0;
  return <Cap lit={lit} blink={!!ctx.ui.bankLatched || (!!ctx.ui.stepEdit && ctx.ui.stepSel == null)} control="preset_bank" aria="BANK" onDown={down} onUp={up} w={22} hit={hit} />;
}

export function PresetRow({ ctx }: { ctx: Ctx }) {
  const v = ctx.values;
  const bank = Math.round(Number(v.preset_bank ?? 1));
  const slot = Math.round(Number(v.preset_number ?? 0));
  const stepEdit = !!ctx.ui.stepEdit;
  const playing = Number(ctx.engine.seqStep ?? -1);
  const chase = ctx.ui.pageChase !== false;
  const page = stepEdit ? (chase && playing >= 0 ? Math.floor(playing / 16) : Number(ctx.ui.seqPage ?? 0)) : 0;
  const s = readSeq(v);
  const timer = useRef<Timer | null>(null);

  const down = (i: number) => {
    const ui = uiOf(ctx.instance);
    if (!stepEdit) {
      // BANK then a PRESET button picks the bank; otherwise the button loads that preset (p.12)
      if (ui.bankMode || bankHeld(ui)) { ctx.setUi({ bankMode: false, ...usedBank(ui) }); ctx.setValue('preset_bank', i + 1); return; }
      loadSlot(ctx.instance, bank, i + 1);
      return;
    }
    const step = page * 16 + i;
    if (bankHeld(ui)) {
      // BANK + a step: select it for editing (p.18)
      ctx.setUi({ ...usedBank(ui), stepSel: step, stepHeld: null, stepLatched: false, note: `EDIT STEP: ${step + 1}`, noteAt: Date.now() });
      return;
    }
    const held = heldStep(ui);
    if (held !== null && held !== step) {
      // hold one step and press another: tie them and the steps between (p.19)
      applySeq(ctx.setValue, s, tieGroup(s, held, step));
      ctx.setUi({ ...usedStep(ui), note: `TIE: ${Math.min(held, step) + 1}-${Math.max(held, step) + 1}`, noteAt: Date.now() });
      return;
    }
    if (selectedStep(ui) !== null) { ctx.setUi({ stepSel: step, note: `EDIT STEP: ${step + 1}`, noteAt: Date.now() }); return; }
    if (held === step && ui.stepLatched) { ctx.setUi({ stepCancel: true }); return; }   // a press lets a latched step go
    ctx.setUi({ stepHeld: step, stepHeldUsed: false, stepLatched: false, stepArmed: null, stepCancel: false });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; ctx.setUi({ stepArmed: step }); }, LATCH_MS);
  };
  const up = (i: number) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const ui = uiOf(ctx.instance);
    if (!stepEdit) return;
    const step = page * 16 + i;
    if (heldStep(ui) !== step) return;
    if (ui.stepCancel) { ctx.setUi({ stepHeld: null, stepLatched: false, stepCancel: false, stepArmed: null }); return; }
    if (ui.stepLatched) return;
    if (ui.stepHeldUsed) { ctx.setUi({ stepHeld: null, stepHeldUsed: false, stepArmed: null }); return; }
    if (ui.stepArmed === step) {
      // long press and release: the step stays held for the next press (mouse)
      ctx.setUi({ stepLatched: true, stepArmed: null, note: `STEP ${step + 1}: HELD`, noteAt: Date.now() });
      return;
    }
    applySeq(ctx.setValue, s, toggleRest(s, step));   // a tap toggles the rest (p.19)
    ctx.setUi({ stepHeld: null, stepHeldUsed: false, stepArmed: null });
  };

  return (
    <div style={{ ...noSelect, display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 4, width: '100%', height: '100%', alignItems: 'end', pointerEvents: 'none' }}>
      {Array.from({ length: 16 }, (_, i) => {
        const step = page * 16 + i;
        let lit = 0, blink = false;
        if (stepEdit) {
          lit = playing === step ? 1 : stepLit(s, step) ? 0.4 : 0;
          blink = ctx.ui.stepSel === step || (!!ctx.ui.stepLatched && ctx.ui.stepHeld === step);
        } else if (ctx.ui.bankMode || bankHeld(ctx.ui)) lit = bank === i + 1 ? 1 : 0;
        else lit = slot === i + 1 ? 1 : 0;
        const p = !stepEdit ? presetAt(bank, i + 1) : null;
        const stepNote = stepEdit ? s.arp_seq[step] : '';
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Cap
              lit={lit}
              blink={blink}
              control={`preset_${i + 1}`}
              preset={i + 1}
              title={stepEdit ? `Step ${step + 1}` : p?.name ?? 'Init Preset'}
              aria={stepEdit ? `Step ${step + 1}` : `Preset ${i + 1}${p ? `: ${p.name}` : ''}`}
              label={String(i + 1)}
              onDown={() => down(i)}
              onUp={() => up(i)}
              w={26}
              h={12}
              hit={[19, 19, 7, 17]}
              fontSize={10.5}
            />
            <span style={{ fontFamily: LCD_FONT, fontSize: 10.5, color: '#b0b0b0', height: 11, lineHeight: 1, ...TRUNC, maxWidth: 60 }}>
              {stepEdit && stepNote ? stepLabel(s, step) : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function stepLabel(s: SeqStrings, i: number): string {
  if (!stepLit(s, i)) return i + 1 > s.seq_len ? '' : 'rest';
  const c = s.arp_seq.charCodeAt(i);
  return Number.isFinite(c) ? noteName(12 + (c - 34)) : '';
}

/** data-preset hooks for tests and lessons: the visible PRESET buttons */
export const PRESET_COUNT = 16;
