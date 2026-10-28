'use client';
// ============================================================================
// Sequencer UI kit - shared look, touch primitives and context helpers.
// Every control works with a mouse and with touch: buttons fire on click/tap
// (touch-action: manipulation, no 300 ms delay), steppers repeat while held and
// can be dragged or scrolled. Text >= 9 px, touch targets >= 28 px.
// ============================================================================

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { CustomRenderContext, EngineState } from '@/types/panel';
import {
  asProject, getPattern, isPatternId, trackLength,
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
} as const;

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
.seq-blink { animation: seqBlink .6s linear infinite }
.seq-target { animation: seqPulse 1.1s ease-in-out infinite }
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

/** Pattern the trig keys edit: the playing one in CHAIN / SONG mode, else the selected one */
export function viewPattern(ctx: CustomRenderContext, project: Project, pattern?: PatternId): PatternId {
  if (pattern && isPatternId(pattern)) return pattern;
  const st = seqStateOf(ctx.engine);
  if (st?.playing && st.mode !== 'pattern' && st.pattern) return st.pattern;
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
}

/** Elektron-style key: dark cap, coloured when lit. Fires on click/tap. */
export function SeqButton({ children, onPress, active, color = C.red, blink, dim, disabled, title, highlight, minWidth = 32, height = 30, style }: SeqButtonProps) {
  return (
    <button
      type="button"
      title={title}
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
        lineHeight: 1, whiteSpace: 'nowrap', touchAction: 'manipulation', userSelect: 'none',
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
}

const REPEAT_DELAY = 380;
const REPEAT_EVERY = 70;

/**
 * [−] value [+]. Hold a button to repeat, drag the value up/down (or left/right),
 * or use the mouse wheel over it.
 */
export function Stepper({ value, min, max, step = 1, onChange, format, label, muted, width = 64, title, highlight, dragPx = 7 }: StepperProps) {
  const latest = useLatest({ value, onChange, min, max, step });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ y: number; x: number; v: number; pointer: number } | null>(null);

  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => stop, []);

  const nudge = (dir: number) => {
    const l = latest.current;
    const next = clampN(Math.round((l.value + dir * l.step) / l.step) * l.step, l.min, l.max);
    if (next !== l.value) l.onChange(next);
  };
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
      aria-label={dir < 0 ? `decrease ${label ?? ''}` : `increase ${label ?? ''}`}
      onPointerDown={press(dir)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={e => e.preventDefault()}
      style={{
        width: 30, height: 30, borderRadius: 4, border: `1px solid ${C.border}`, background: C.key, color: C.text,
        fontSize: 15, fontWeight: 700, lineHeight: 1, touchAction: 'none', userSelect: 'none', cursor: 'pointer', flex: 'none',
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
          role="spinbutton"
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-label={label}
          onPointerDown={e => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            e.preventDefault();
            e.stopPropagation();
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            drag.current = { y: e.clientY, x: e.clientX, v: latest.current.value, pointer: e.pointerId };
          }}
          onPointerMove={e => {
            const d = drag.current;
            if (!d || d.pointer !== e.pointerId) return;
            const delta = Math.round(((d.y - e.clientY) + (e.clientX - d.x)) / dragPx);
            const l = latest.current;
            const next = clampN(d.v + delta * l.step, l.min, l.max);
            if (next !== l.value) l.onChange(next);
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onWheel={e => { e.stopPropagation(); nudge(e.deltaY < 0 ? 1 : -1); }}
          style={{
            width, height: 30, borderRadius: 4, background: '#0b0c0d', border: `1px solid ${C.border}`,
            color: muted ? C.dim : C.text, fontFamily: MONO, fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', cursor: 'ns-resize',
            userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
          }}
        >
          {format ? format(value) : String(value)}
        </div>
        {btn(1, '+')}
      </div>
    </div>
  );
}

/** Section frame used by the overlay-style components */
export function Frame({ title, right, children, style }: { title: string; right?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, color: C.text,
        border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: FONT, overflow: 'hidden', boxSizing: 'border-box', ...style,
      }}
    >
      <SeqStyles />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: `1px solid ${C.border}`, background: C.panel, flexWrap: 'wrap', minHeight: 40 }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2 }}>{title}</span>
        <div style={{ flex: 1 }} />
        {right}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 8, touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}
