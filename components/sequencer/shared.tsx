'use client';
// ============================================================================
// Sequencer UI kit - shared look, touch primitives and context helpers.
// Every control works with a mouse and with touch: buttons fire on click/tap
// (touch-action: manipulation, no 300 ms delay), steppers repeat while held and
// can be dragged or scrolled. Text >= 9 px, touch targets >= 28 px.
// ============================================================================

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CustomRenderContext, EngineState } from '@/types/panel';
import {
  BANKS, PATTERNS_PER_BANK, asProject, getPattern, isPatternId, parsePatternId, patternHasContent, patternId, trackLength,
  type PatternId, type Project, type SeqState,
} from '@/lib/sequencer/elektron';

export const C = {
  bg: '#121315',
  panel: '#1a1b1e',
  panel2: '#222428',
  key: '#2e3034',
  keyHi: '#3b3e43',
  border: '#33363b',
  text: '#eceef1',
  dim: '#9096a0',
  faint: '#5d626b',
  red: '#ff3b30',
  amber: '#ffb347',
  green: '#4ade80',
  cyan: '#5ec8ff',
  pink: '#ff6fae',
  yellow: '#ffd84a',
  white: '#f4f4f4',
  target: '#ff9f1c',
};

export const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
export const MONO = 'ui-monospace, Menlo, monospace';

/** UI-state keys used by the kit (ephemeral, per device instance) */
export const UI = {
  heldSteps: 'heldSteps',
  heldTrack: 'heldTrack',
  heldPattern: 'heldPattern',
  heldEdited: 'heldEdited',
  stepPage: 'stepPage',
  trigEditor: 'trigEditor',
  bank: 'seqBank',
  clipboard: 'seqClipboard',
  /** Open overlay menu: 'pattern' | 'chain' | 'song' | 'scale' | null */
  menu: 'seqMenu',
} as const;

export type SeqMenu = 'pattern' | 'chain' | 'song' | 'scale';

export interface TrigEditorTarget {
  track: number;
  pattern: PatternId;
  steps: number[];
}

/** Keyframes for blinking LEDs (rendered once per kit component; duplicates are harmless) */
export function SeqStyles() {
  return (
    <style>{`
@keyframes seqBlink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: .28 } }
@keyframes seqPulse { 0%, 100% { box-shadow: 0 0 0 2px ${C.target} } 50% { box-shadow: 0 0 0 4px ${C.target}66 } }
@keyframes seqArm { 0% { box-shadow: 0 0 0 2px ${C.amber} } 100% { box-shadow: 0 0 0 5px ${C.amber}55 } }
.seq-blink { animation: seqBlink .6s linear infinite }
.seq-target { animation: seqPulse 1.1s ease-in-out infinite }
.seq-armed { animation: seqArm .45s ease-in-out infinite alternate }
@media (prefers-reduced-motion: reduce) {
  .seq-blink { animation-duration: 1.6s }
  .seq-target, .seq-armed { animation: none; box-shadow: 0 0 0 3px ${C.target} }
}
`}</style>
  );
}

// ----------------------------------------------------------------------------
// Context helpers
// ----------------------------------------------------------------------------

export function projectOf(ctx: CustomRenderContext, tracks = 4): Project {
  return asProject(ctx.data, tracks);
}

/** Sequencer snapshot the engine publishes as engine state `seq` (ElektronSequencer.getState()) */
export function seqStateOf(engine: EngineState | undefined): SeqState | undefined {
  const s = engine?.seq as SeqState | undefined;
  return s && typeof s === 'object' && Array.isArray(s.steps) ? s : undefined;
}

/** Track shown by the kit: explicit prop, else the device's `track` control */
export function trackOf(ctx: CustomRenderContext, project: Project, track?: number): number {
  const t = track ?? Math.round(Number(ctx.values.track) || 0);
  return Math.max(0, Math.min(project.tracks - 1, t));
}

/**
 * Pattern the trig keys edit: while playing, the audible one (a cued pattern
 * only takes over the keys when it starts, as on the hardware); stopped, the
 * selected one.
 */
export function viewPattern(ctx: CustomRenderContext, project: Project, pattern?: PatternId): PatternId {
  if (pattern && isPatternId(pattern)) return pattern;
  const st = seqStateOf(ctx.engine);
  if (st?.playing && st.pattern) return st.pattern;
  return project.active;
}

export function pageOf(ctx: CustomRenderContext, project: Project, pattern: PatternId, track: number, page?: number): number {
  const len = trackLength(getPattern(project, pattern), track);
  const pages = Math.max(1, Math.ceil(len / 16));
  const p = page ?? Math.round(Number(ctx.ui[UI.stepPage]) || 0);
  return Math.max(0, Math.min(pages - 1, p));
}

/** Apply a project edit through updateData (functional, never mutates) */
export function editProject(ctx: CustomRenderContext, tracks: number, fn: (p: Project) => Project): void {
  ctx.updateData(d => fn(asProject(d, tracks)));
}

/** Lesson focus ids for the current step ('seq:trig:5', 'seq:patterns'...), or null */
export function lessonFocus(ctx: CustomRenderContext): Set<string> | null {
  if (!ctx.teaching || !ctx.step) return null;
  const s = new Set<string>(ctx.step.focus ?? []);
  if (ctx.step.control) s.add(ctx.step.control);
  return s.size ? s : null;
}

export function useLatest<T>(value: T) {
  const r = useRef(value);
  r.current = value;
  return r;
}

export const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ----------------------------------------------------------------------------
// Primitives
// ----------------------------------------------------------------------------

export interface SeqButtonProps {
  children: ReactNode;
  onPress?: () => void;
  /** Lit (selected) */
  active?: boolean;
  /** LED colour when lit */
  color?: string;
  blink?: boolean;
  dim?: boolean;
  disabled?: boolean;
  title?: string;
  highlight?: boolean;
  minWidth?: number;
  height?: number;
  style?: CSSProperties;
  ariaLabel?: string;
}

/** Elektron-style key: dark cap, coloured when lit. Fires on click/tap. */
export function SeqButton({ children, onPress, active, color = C.red, blink, dim, disabled, title, highlight, minWidth = 32, height = 30, style, ariaLabel }: SeqButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={e => { e.stopPropagation(); onPress?.(); }}
      onPointerDown={e => e.stopPropagation()}
      className={`${blink ? 'seq-blink' : ''} ${highlight ? 'seq-target' : ''}`}
      style={{
        minWidth, height, padding: '0 8px', borderRadius: 4,
        border: `1px solid ${active ? color : C.border}`,
        background: active ? color : C.key,
        color: active ? '#111' : dim ? C.faint : C.text,
        fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
        lineHeight: 1, whiteSpace: 'nowrap', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
        boxShadow: active ? `0 0 8px ${color}88` : 'inset 0 -2px 0 rgba(0,0,0,0.35)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export interface StepperProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  label?: string;
  /** Value shown dimmed (e.g. a track default rather than a lock) */
  muted?: boolean;
  width?: number;
  title?: string;
  highlight?: boolean;
  /** Drag pixels per step on the value (default 7) */
  dragPx?: number;
  /** Accessible name (default: the label) */
  name?: string;
}

const REPEAT_DELAY = 380;
const REPEAT_EVERY = 70;

/**
 * [−] value [+]. Hold a button to repeat, drag the value up/down (or left/right),
 * or use the mouse wheel over it.
 */
export function Stepper({ value, min, max, step = 1, onChange, format, label, muted, width = 64, title, highlight, dragPx = 7, name }: StepperProps) {
  const aname = name ?? label ?? title ?? 'value';
  const latest = useLatest({ value, onChange, min, max, step });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ y: number; x: number; applied: number; pointer: number } | null>(null);
  const valueEl = useRef<HTMLDivElement | null>(null);

  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => stop, []);

  const nudge = (dir: number) => {
    const l = latest.current;
    const next = clampN(Math.round((l.value + dir * l.step) / l.step) * l.step, l.min, l.max);
    if (next !== l.value) l.onChange(next);
  };

  // Wheel over the value: React's wheel listener is passive, so register our own to stop the page scrolling
  useEffect(() => {
    const el = valueEl.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.deltaY) return;
      e.preventDefault();
      e.stopPropagation();
      nudge(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const press = (dir: number) => (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    nudge(dir);
    stop();
    const rep = () => { nudge(dir); timer.current = setTimeout(rep, REPEAT_EVERY); };
    timer.current = setTimeout(rep, REPEAT_DELAY);
  };

  const btn = (dir: number, glyph: string) => (
    <button
      type="button"
      aria-label={`${dir < 0 ? 'decrease' : 'increase'} ${aname}`}
      onPointerDown={press(dir)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={e => e.preventDefault()}
      style={{
        width: 30, height: 30, borderRadius: 4, border: `1px solid ${C.border}`, background: C.key, color: C.text,
        fontSize: 15, fontWeight: 700, lineHeight: 1, touchAction: 'none', WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer', flex: 'none',
      }}
    >
      {glyph}
    </button>
  );

  return (
    <div title={title} className={highlight ? 'seq-target' : undefined} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch', gap: 2, borderRadius: 5 }}>
      {label && <span style={{ fontSize: 9, color: C.dim, fontWeight: 700, letterSpacing: 0.8, textAlign: 'center', fontFamily: FONT }}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {btn(-1, '−')}
        <div
          ref={valueEl}
          role="spinbutton"
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-label={aname}
          onPointerDown={e => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            e.preventDefault();
            e.stopPropagation();
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            drag.current = { y: e.clientY, x: e.clientX, applied: 0, pointer: e.pointerId };
          }}
          onPointerMove={e => {
            const d = drag.current;
            if (!d || d.pointer !== e.pointerId) return;
            // Steps since the last move, applied to the current value (it may have been changed by the owner)
            const total = Math.trunc(((d.y - e.clientY) + (e.clientX - d.x)) / dragPx);
            const steps = total - d.applied;
            if (!steps) return;
            d.applied = total;
            const l = latest.current;
            const next = clampN(l.value + steps * l.step, l.min, l.max);
            if (next !== l.value) l.onChange(next);
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          style={{
            width, height: 30, borderRadius: 4, background: '#0b0c0d', border: `1px solid ${C.border}`,
            color: muted ? C.dim : C.text, fontFamily: MONO, fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', cursor: 'ns-resize',
            userSelect: 'none', WebkitUserSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
          }}
        >
          {format ? format(value) : String(value)}
        </div>
        {btn(1, '+')}
      </div>
    </div>
  );
}

/** Inside a portal overlays size to their content (up to the portal's max); inside a box they fill it */
const OverlayMode = createContext<'box' | 'portal'>('box');

/** Root sizing for an overlay's outer element */
export function useOverlayFill(): CSSProperties {
  return useContext(OverlayMode) === 'portal' ? { flex: '0 1 auto', minHeight: 0 } : { height: '100%' };
}

/** Outer element of an overlay that isn't a Frame (sizes itself like one; swallows pointer and wheel events) */
export function OverlayRoot({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  const fill = useOverlayFill();
  return (
    <div onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()} style={{ width: '100%', ...fill, ...style }}>
      {children}
    </div>
  );
}

/** Section frame used by the overlay-style components */
export function Frame({ title, right, children, style, onClose, sub }: {
  title: string; right?: ReactNode; children: ReactNode; style?: CSSProperties; onClose?: () => void; sub?: ReactNode;
}) {
  const fill = useOverlayFill();
  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      style={{
        width: '100%', ...fill, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text,
        border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: FONT, overflow: 'hidden', boxSizing: 'border-box',
        boxShadow: '0 10px 30px rgba(0,0,0,0.55)', ...style,
      }}
    >
      <SeqStyles />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: `1px solid ${C.border}`, background: C.panel, flexWrap: 'wrap', minHeight: 40 }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2 }}>{title}</span>
        {sub && <span style={{ fontSize: 11, color: C.dim, fontFamily: MONO }}>{sub}</span>}
        <div style={{ flex: 1 }} />
        {right}
        {onClose && <SeqButton onPress={onClose} title="Close" minWidth={32} ariaLabel="Close">✕</SeqButton>}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 8, touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch' } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

/** Small caps label for a group of controls */
export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: C.dim, fontFamily: FONT, ...style }}>{children}</span>;
}

/** Label + controls, wrapping */
export function Group({ label, children, highlight, style }: { label?: ReactNode; children: ReactNode; highlight?: boolean; style?: CSSProperties }) {
  return (
    <div className={highlight ? 'seq-target' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 5, ...style }}>
      {label !== undefined && <Label>{label}</Label>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>{children}</div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Overlays (PatternPicker, ChainBuilder, SongEditor, ScaleMenu)
// ----------------------------------------------------------------------------

export interface OverlayProps {
  /** Visible? Default: ui.seqMenu is this menu. Pass true to show it permanently inside its custom element. */
  open?: boolean;
  /** Float over the page at full size (document.body) instead of filling the custom element's box */
  portal?: boolean;
  /** Portal size in px (default 640 x 440, clamped to the viewport) */
  portalSize?: { w: number; h: number };
  /**
   * Where the portal floats: 'top' (default - the trig keys sit at the bottom of
   * Elektron panels and stay reachable) or 'bottom'
   */
  portalPlacement?: 'top' | 'bottom';
}

/** Is this overlay open (prop wins, else ui.seqMenu)? */
export function menuOpen(ctx: CustomRenderContext, menu: SeqMenu, open?: boolean): boolean {
  return open ?? ctx.ui[UI.menu] === menu;
}

export function closeMenu(ctx: CustomRenderContext): void {
  ctx.setUi({ [UI.menu]: null });
}

/** Renders `children` inside the custom element's box, or floating over the page with `portal` */
export function Overlay({ portal, portalSize, portalPlacement, children }: Pick<OverlayProps, 'portal' | 'portalSize' | 'portalPlacement'> & { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (portal) {
    if (!mounted || typeof document === 'undefined') return null;
    const w = portalSize?.w ?? 640;
    const h = portalSize?.h ?? 440;
    const at = portalPlacement === 'bottom' ? { bottom: 12 } : { top: 12 };
    return createPortal(
      <div
        style={{
          position: 'fixed', left: '50%', ...at, transform: 'translateX(-50%)', zIndex: 60,
          width: `min(${w}px, calc(100vw - 24px))`, maxHeight: `min(${h}px, calc(100vh - 24px))`, display: 'flex', flexDirection: 'column',
        }}
      >
        <OverlayMode.Provider value="portal">{children}</OverlayMode.Provider>
      </div>,
      document.body,
    );
  }
  return <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>{children}</div>;
}

/** Opens / closes one of the kit's menus (place it where the hardware's PTN / CHAIN / SONG / SCALE key is) */
export function MenuKey({ ctx, menu, label, color = C.white, style, title }: {
  ctx: CustomRenderContext; menu: SeqMenu; label?: ReactNode; color?: string; style?: CSSProperties; title?: string;
}) {
  const open = ctx.ui[UI.menu] === menu;
  const focus = lessonFocus(ctx);
  const st = seqStateOf(ctx.engine);
  const blink = menu === 'pattern' && !!st?.queued && !open;
  return (
    <SeqButton
      active={open}
      color={color}
      blink={blink}
      highlight={!!focus?.has(`seq:menu:${menu}`)}
      onPress={() => ctx.setUi({ [UI.menu]: open ? null : menu })}
      title={title ?? `${open ? 'Close' : 'Open'} the ${menu} menu`}
      style={{ width: '100%', height: '100%', ...style }}
    >
      {label ?? menu.toUpperCase()}
    </SeqButton>
  );
}

// ----------------------------------------------------------------------------
// Bank / pattern grid (PatternPicker, ChainBuilder)
// ----------------------------------------------------------------------------

export interface PatternGridProps {
  ctx: CustomRenderContext;
  project: Project;
  /** Bank shown (0..7) */
  bank: number;
  onBank: (bank: number) => void;
  onPattern: (id: PatternId) => void;
  /** Outlined slot (the selected pattern) */
  selected?: PatternId | null;
  /** Number of banks offered (default 8: A-H) */
  banks?: number;
  /** Pattern keys per row (8 = two rows, 16 = one) */
  perRow?: 8 | 16;
}

export function PatternGrid({ ctx, project, bank, onBank, onPattern, selected, banks = BANKS.length, perRow = 8 }: PatternGridProps) {
  const st = seqStateOf(ctx.engine);
  const playing = st?.playing ? st.pattern : null;
  const queued = st?.queued ?? null;
  const focus = lessonFocus(ctx);
  const bankHas = (b: number) => {
    for (let i = 0; i < PATTERNS_PER_BANK; i++) if (patternHasContent(project.patterns[patternId(b, i)])) return true;
    return false;
  };
  const playingBank = playing ? parsePatternId(playing)?.bank : undefined;
  const ids = Array.from({ length: PATTERNS_PER_BANK }, (_, i) => patternId(bank, i));
  const key = (id: PatternId) => {
    const has = patternHasContent(project.patterns[id]);
    const isPlaying = id === playing;
    const isQueued = id === queued && !isPlaying;
    const isSel = id === selected;
    const name = project.patterns[id]?.name;
    return (
      <button
        key={id}
        type="button"
        aria-label={`Pattern ${id}${name ? ` ${name}` : ''}${isPlaying ? ' playing' : ''}${isQueued ? ' queued' : ''}`}
        aria-pressed={isSel}
        data-pattern={id}
        data-state={isPlaying ? 'playing' : isQueued ? 'queued' : has ? 'content' : 'empty'}
        onClick={e => { e.stopPropagation(); onPattern(id); }}
        onPointerDown={e => e.stopPropagation()}
        className={`${isQueued ? 'seq-blink' : ''} ${focus?.has(`seq:pattern:${id}`) || focus?.has('seq:patterns') ? 'seq-target' : ''}`}
        style={{
          position: 'relative', flex: `1 0 ${perRow === 16 ? 34 : 44}px`, minWidth: 0, height: 34, borderRadius: 4, padding: 0,
          border: `2px solid ${isSel ? C.white : isQueued ? C.amber : C.border}`,
          background: isPlaying ? C.green : isQueued ? '#5a3d12' : has ? '#3a2422' : C.key,
          color: isPlaying ? '#0d1a10' : has ? C.text : C.dim,
          fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none',
          boxShadow: isPlaying ? `0 0 8px ${C.green}88` : undefined,
        }}
      >
        {id.slice(1)}
        {has && !isPlaying && <span style={{ position: 'absolute', right: 3, top: 3, width: 5, height: 5, borderRadius: 3, background: C.red }} />}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <Label style={{ width: 34 }}>BANK</Label>
        {BANKS.slice(0, banks).map((b, i) => (
          <SeqButton
            key={b}
            active={i === bank}
            color={C.white}
            minWidth={34}
            onPress={() => onBank(i)}
            highlight={!!focus?.has(`seq:bank:${b}`)}
            title={`Bank ${b}`}
            style={{ position: 'relative' }}
          >
            {b}
            {(bankHas(i) || playingBank === i) && (
              <span style={{ position: 'absolute', right: 2, top: 2, width: 5, height: 5, borderRadius: 3, background: playingBank === i ? C.green : C.red }} />
            )}
          </SeqButton>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {perRow === 16 ? ids.map(key) : (
          <>
            <div style={{ display: 'flex', gap: 4, width: '100%' }}>{ids.slice(0, 8).map(key)}</div>
            <div style={{ display: 'flex', gap: 4, width: '100%' }}>{ids.slice(8).map(key)}</div>
          </>
        )}
      </div>
    </div>
  );
}

/** Bank shown by a grid: ui.seqBank, else the bank of `fallback` */
export function bankOf(ctx: CustomRenderContext, fallback: PatternId): number {
  const b = ctx.ui[UI.bank];
  if (typeof b === 'number' && b >= 0 && b < BANKS.length) return b;
  return parsePatternId(fallback)?.bank ?? 0;
}
