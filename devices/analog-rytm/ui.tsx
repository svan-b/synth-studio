'use client';
// ============================================================================
// Analog Rytm MKII - panel components (rendered from `custom` layout elements)
//
//   Pads         the 12 velocity pads: PLAY / MUTE / CHRO / SCNE / PERF modes,
//                RTRG, FIX, TRK, live recording; LEDs follow the voices
//   Key          a hardware key: label on the cap, secondary (FUNC) label below
//   Screen       the OLED: page, eight parameters, footer; DataSync and
//                PresetLoader live in it so they run while the panel is shown
//   Menus        KIT, SOUND (machine + settings), TEMPO, SCENE / PERF edit,
//                RETRIG, FIXED VELOCITY, messages
// ============================================================================

import React, { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ControlValue } from '@/types';
import type { CustomRenderContext } from '@/types/panel';
import {
  CHANGE_MODES, asProject, clearTrack, getPattern, setActive, setChangeMode, setMasterMute, setMasterMutes, setPlayMode, setStep,
  setTrigMute, trackLength, updatePatternSettings, updateSteps, withTrack, type Project, type Step, type Track,
} from '@/lib/sequencer/elektron';
import { isLocked } from '@/lib/sequencer/elektron/locks';
import { C, Frame, FONT, Group, MONO, Overlay, SeqButton, Stepper } from '@/components/sequencer/shared';
import { useStudioStore } from '@/store/studio';
import { hub } from '@/lib/studio/hub';
import {
  FX_PAGE_TITLES, FX_TRACK, LEN_TEXT, MACHINES, PAGE, PAGE_TITLES, RETRIG_MENU, SAMPLES, SEQ_TRACKS, SHARED_PAIRS, TRACKS,
  describe, filterHz, hzText, machineOf, pageControls, paramMeta, soundDefaults,
} from './model';
import { ANALOG_RYTM, KIT_CONTROL_IDS } from './spec';
import { KIT_PRESETS, buildPattern, kitIdOf, kitPatternOf, type RytmKit, type RytmProject } from './presets';
import type { RytmOp } from './engine';
import { LOCKS } from './locks';

const T = SEQ_TRACKS;
const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : d);
const projectOf = (ctx: CustomRenderContext) => asProject(ctx.data, T) as RytmProject;

/** Spec defaults of the kit controls */
const KIT_DEFAULTS: Record<string, ControlValue> = {};
for (const id of KIT_CONTROL_IDS) {
  const c = ANALOG_RYTM.controls[id];
  if (c && 'default' in c && c.default !== undefined) KIT_DEFAULTS[id] = c.default as ControlValue;
}

export const RY = {
  panel: '#121314',
  key: '#2a2b2e',
  keyHi: '#3a3c40',
  keyEdge: '#0b0b0c',
  legend: '#ededed',
  sub: '#a9acb1',
  led: '#ff3b2a',
  green: '#3fd65a',
  amber: '#ffb000',
  yellow: '#ffd84a',
  blue: '#4aa8ff',
  purple: '#c07bff',
  cyan: '#36e0d0',
  sky: '#5ec8ff',
  navy: '#3a55e0',
  pad: '#e7e8e9',
};

// ----------------------------------------------------------------------------
// UI state helpers (ctx.ui is per instance and not saved)
// ----------------------------------------------------------------------------

export const funcOn = (ctx: CustomRenderContext) => !!ctx.ui.func || !!ctx.ui.funcLatch;
/** A key used FUNC: drop the latch (and mark a held FUNC as used) */
export const consumeFunc = (ctx: CustomRenderContext) => ctx.setUi({ funcLatch: false, funcUsed: true });
export const openMenu = (ctx: CustomRenderContext, menu: string | null) => ctx.setUi({ rytmMenu: menu });
export const flash = (ctx: CustomRenderContext, text: string) => ctx.setUi({ message: { text, at: Date.now() } });

function teachFocus(ctx: CustomRenderContext): Set<string> | null {
  if (!ctx.teaching || !ctx.step) return null;
  const s = new Set<string>(ctx.step.focus ?? []);
  if (ctx.step.control) s.add(ctx.step.control);
  return s;
}

function useFocusMode(): boolean {
  return useStudioStore(s => s.focusMode);
}

/** Lesson spotlight for a custom part: highlighted, dimmed or normal */
function spotlight(ctx: CustomRenderContext, ids: string[], focusMode: boolean): { hl: boolean; dim: boolean } {
  const f = teachFocus(ctx);
  if (!f || !f.size) return { hl: false, dim: false };
  const hl = ids.some(id => f.has(id));
  return { hl, dim: focusMode && !hl };
}

// ----------------------------------------------------------------------------
// Key
// ----------------------------------------------------------------------------

export interface KeyProps {
  ctx: CustomRenderContext;
  id: string;
  label?: ReactNode;
  sub?: string;
  /** Second line under `sub` (FX track page names over the FUNC function) */
  sub2?: string;
  /** Underline the secondary label (a FUNC function) */
  funcSub?: boolean;
  lit?: number | boolean;
  ledColor?: string;
  blink?: boolean;
  onDown?: (e: React.PointerEvent) => void;
  onUp?: () => void;
  big?: boolean;
  /** Radio control this key writes (lesson highlighting) */
  control?: string;
  value?: ControlValue;
  focusIds?: string[];
  title?: string;
  capStyle?: CSSProperties;
}

export function Key(p: KeyProps) {
  const { ctx } = p;
  const focusMode = useFocusMode();
  const ids = [p.id, ...(p.focusIds ?? [])];
  const step = ctx.step;
  const radioTarget = !!(ctx.teaching && step && p.control && step.control === p.control && (p.value === undefined || step.targetValue === p.value));
  const sp = spotlight(ctx, ids, focusMode);
  const hl = sp.hl || radioTarget;
  const correct = radioTarget && ctx.values[p.control!] === step!.targetValue;
  const dim = sp.dim && !radioTarget && !(ctx.teaching && step?.control && p.control === step.control);
  const lit = typeof p.lit === 'boolean' ? (p.lit ? 1 : 0) : p.lit ?? 0;
  const pressed = useRef(false);
  const color = p.ledColor ?? RY.led;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: dim ? 0.3 : 1, transition: 'opacity 200ms' }}>
      <button
        type="button"
        data-control={p.id}
        aria-label={typeof p.label === 'string' ? p.label : p.title ?? p.id}
        aria-pressed={lit > 0}
        title={p.title}
        onPointerDown={e => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          e.preventDefault();
          e.stopPropagation();
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
          pressed.current = true;
          p.onDown?.(e);
        }}
        onPointerUp={() => { if (pressed.current) { pressed.current = false; p.onUp?.(); } }}
        onPointerCancel={() => { if (pressed.current) { pressed.current = false; p.onUp?.(); } }}
        onContextMenu={e => e.preventDefault()}
        className={`${p.blink ? 'rytm-blink' : ''} ${hl && !correct ? 'rytm-target' : ''}`}
        style={{
          width: '100%', flex: '0 0 auto', aspectRatio: p.big ? '1 / 1' : undefined, height: p.big ? undefined : '62%',
          borderRadius: '18%', border: `1px solid ${correct ? '#22c55e' : RY.keyEdge}`, padding: 0,
          background: lit > 0 ? `radial-gradient(circle at 50% 35%, ${mix(RY.keyHi, color, 0.25 + 0.5 * lit)} 0%, ${RY.key} 85%)` : `linear-gradient(180deg, ${RY.keyHi} 0%, ${RY.key} 55%, #222326 100%)`,
          boxShadow: [
            '0 2px 0 #000, inset 0 1px 0 rgba(255,255,255,0.08)',
            lit > 0 ? `0 0 ${4 + 8 * lit}px ${color}` : '',
            correct ? '0 0 0 2px #22c55e' : '',
          ].filter(Boolean).join(', '),
          color: lit > 0.5 ? '#fff' : RY.legend, fontFamily: FONT, fontWeight: 700, fontSize: 'var(--rytm-key-font, 10px)', letterSpacing: 0.3,
          cursor: 'pointer', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, ...p.capStyle,
        }}
      >
        <span style={{ position: 'relative', textShadow: lit > 0 ? `0 0 6px ${color}` : undefined }}>{p.label}</span>
        {lit > 0 && <span style={{ position: 'absolute', left: '50%', bottom: '12%', width: '28%', height: 2, marginLeft: '-14%', borderRadius: 1, background: color, opacity: 0.4 + 0.6 * lit }} />}
      </button>
      {(p.sub || p.sub2) && (
        <div style={{ marginTop: '6%', textAlign: 'center', lineHeight: 1.05, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {p.sub2 && <div style={{ fontSize: 'var(--rytm-sub-font, 10px)', color: RY.sub, fontFamily: FONT }}>{p.sub2}</div>}
          {p.sub && <div style={{ fontSize: 'var(--rytm-sub-font, 10px)', color: RY.sub, fontFamily: FONT, textDecoration: p.funcSub ? 'underline' : undefined, textUnderlineOffset: 2 }}>{p.sub}</div>}
        </div>
      )}
    </div>
  );
}

function mix(a: string, b: string, t: number): string {
  const pa = a.match(/[0-9a-f]{2}/gi)!.map(h => parseInt(h, 16));
  const pb = b.match(/[0-9a-f]{2}/gi)!.map(h => parseInt(h, 16));
  const c = pa.map((v, i) => Math.round(v * (1 - t) + pb[i] * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function RytmStyles() {
  return (
    <style>{`
@keyframes rytmBlink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: .35 } }
@keyframes rytmPulse { 0%, 100% { box-shadow: 0 0 0 2px #ff9f1c, 0 2px 0 #000 } 50% { box-shadow: 0 0 0 5px #ff9f1c88, 0 2px 0 #000 } }
.rytm-blink { animation: rytmBlink .6s linear infinite }
.rytm-target { animation: rytmPulse 1.1s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .rytm-blink { animation-duration: 1.6s } .rytm-target { animation: none; box-shadow: 0 0 0 3px #ff9f1c } }
.rytm-trigs > div > div { gap: var(--rytm-trig-gap, 3px) !important }
.rytm-trigs [data-tmute] { outline: 2px dashed ${RY.green}; outline-offset: -4px }
`}</style>
  );
}

// ----------------------------------------------------------------------------
// Pads
// ----------------------------------------------------------------------------

/** Pad grid order: top row CH OH CY CB, middle BT LT MT HT, bottom BD SD RS CP */
export const PAD_ROWS = [[8, 9, 10, 11], [4, 5, 6, 7], [0, 1, 2, 3]];
const PAD_MODE = { PLAY: 0, MUTE: 1, CHRO: 2, SCNE: 3, PERF: 4 } as const;

export function Pads({ ctx }: { ctx: CustomRenderContext }) {
  const mode = Math.round(num(ctx.values.pad_mode));
  const active = Math.round(num(ctx.values.track));
  const st = ctx.engine.seq as { mutes?: boolean[]; playing?: boolean; pattern?: string } | undefined;
  const scene = num(ctx.engine.scene, -1);
  const perf = (ctx.engine.perf as number[] | undefined) ?? [];
  const quick = (ctx.engine.perfQuick as number[] | undefined) ?? [];
  const project = projectOf(ctx);
  const pat = getPattern(project, project.active);
  const kit = project.kits?.[kitOf(ctx)];
  const focusMode = useFocusMode();
  const faces = useRef<(HTMLDivElement | null)[]>([]);
  const held = useRef(new Map<number, { pad: number; track: number; note?: number; perf?: boolean; y0: number; h: number }>());
  const live = useRef(ctx);
  live.current = ctx;

  // LED loop: every hit flashes its pad white (no React renders)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const l = live.current.engine.padLv as Float32Array | undefined;
      if (!l) return;
      for (let i = 0; i < 12; i++) {
        const el = faces.current[i];
        if (!el) continue;
        const a = Math.min(1, l[i] * 1.4);
        el.style.setProperty('--glow', a.toFixed(3));
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** Strike velocity: higher on the pad = harder; [FIX] plays a fixed velocity (AUTO = the track's VEL) */
  const velocityOf = (e: React.PointerEvent<HTMLElement>, track: number) => {
    const c = live.current;
    if (num(c.values.fix) > 0) {
      const f = Math.round(num(c.values.fix_vel, 100));
      return f > 0 ? f : trackVel(c, track);
    }
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / Math.max(1, r.height);
    return Math.max(20, Math.min(127, Math.round(127 - Math.max(0, y - 0.08) * 120)));
  };
  const amountOf = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / Math.max(1, r.height)));
  };

  const down = (pad: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
    const c = live.current;
    const m = Math.round(num(c.values.pad_mode));
    const r = e.currentTarget.getBoundingClientRect();
    const h: { pad: number; track: number; note?: number; perf?: boolean; y0: number; h: number } = { pad, track: pad, y0: e.clientY, h: r.height };
    // [QPER] held (or latched): pads choose the macros of the QUICK PERF AMOUNT knob
    if (c.ui.qperHeld || c.ui.qperLatch) {
      const list = ((c.ui.qperList as number[] | undefined) ?? []).slice();
      const k = list.indexOf(pad);
      if (k >= 0) list.splice(k, 1); else list.push(pad);
      c.setUi({ qperList: list });
      flash(c, `QUICK PERF: ${list.length ? list.map(x => x + 1).join(' ') : 'NONE'}`);
      return;
    }
    // [TRK] + pad: select the track
    if (c.ui.trkHeld || c.ui.trkLatch) {
      c.setValue('track', pad);
      if (c.ui.trkLatch) c.setUi({ trkLatch: false });
      return;
    }
    const func = funcOn(c);
    if (func) {
      const heldFunc = !!c.ui.func && !c.ui.funcLatch;
      consumeFunc(c);
      if (m === PAD_MODE.MUTE) {
        // [FUNC] + pads preselect mutes; they apply when [FUNC] is released
        if (heldFunc) {
          const pre = ((c.ui.mutePre as number[] | undefined) ?? []).slice();
          const k = pre.indexOf(pad);
          if (k >= 0) pre.splice(k, 1); else pre.push(pad);
          c.setUi({ mutePre: pre });
        } else toggleMasterMute(c, pad);
        return;
      }
      if (m === PAD_MODE.SCNE) { c.setUi({ sceneEdit: pad, perfEdit: null }); flash(c, `SCENE ${pad + 1} EDIT: TURN THE ENCODERS`); return; }
    }
    if (m === PAD_MODE.MUTE && (c.ui.rtrgHeld || c.ui.rtrgLatch)) { toggleSolo(c, pad); return; }
    switch (m) {
      case PAD_MODE.MUTE:
        toggleMasterMute(c, pad);
        return;
      case PAD_MODE.CHRO: {
        const tr = Math.min(11, active);
        const note = 60 + pad + Math.round(num(c.ui.octave)) * 12;
        h.track = tr; h.note = note;
        held.current.set(e.pointerId, h);
        c.sendEvent('pad', { track: tr, vel: func ? trackVel(c, tr) : velocityOf(e, tr), note, rtrg: rtrgOn(c), rec: recLive(c), quantize: num(c.values.quantize) > 0 });
        return;
      }
      case PAD_MODE.SCNE:
        if (typeof c.ui.sceneEdit === 'number') { c.setUi({ sceneEdit: pad }); return; }
        c.sendEvent('scene', { index: pad });
        return;
      case PAD_MODE.PERF:
        if (typeof c.ui.perfEdit === 'number') { c.setUi({ perfEdit: pad }); return; }
        h.perf = true;
        held.current.set(e.pointerId, h);
        c.sendEvent('perf', { index: pad, amount: amountOf(e) });
        return;
      default:
        held.current.set(e.pointerId, h);
        if (num(c.values.auto_trk) > 0) c.setValue('track', pad);   // AUTO TRK SWITCH (SEQUENCER CONFIG); off, [TRK] + pad selects
        c.sendEvent('pad', { track: pad, vel: func ? trackVel(c, pad) : velocityOf(e, pad), rtrg: rtrgOn(c), rec: recLive(c), quantize: num(c.values.quantize) > 0 });
        // lessons count which pad was played ('pad:bd', 'pad:oh' ...)
        if (c.teaching) c.sendEvent(`pad:${TRACKS[pad].id}`);
    }
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const h = held.current.get(e.pointerId);
    if (!h) return;
    if (h.perf) { live.current.sendEvent('perf', { index: h.pad, amount: amountOf(e) }); return; }
    // pressing on after the hit: sliding the finger up reads as more pressure (retrig velocity, or aftertouch)
    const press = Math.max(0, Math.min(1, (h.y0 - e.clientY) / Math.max(1, h.h * 0.6)));
    live.current.sendEvent('pad:pressure', { track: h.track, amount: press, vel: Math.round(40 + press * 87) });
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const h = held.current.get(e.pointerId);
    if (!h) return;
    held.current.delete(e.pointerId);
    const c = live.current;
    if (h.perf) { c.sendEvent('perf:up', { index: h.pad }); return; }
    c.sendEvent('pad:up', { track: h.track });
  };

  const master = project.mutes ?? [];
  const solos = (st as { solos?: boolean[] } | undefined)?.solos ?? [];
  const pre = (ctx.ui.mutePre as number[] | undefined) ?? [];
  const octave = Math.round(num(ctx.ui.octave));
  /** Mode colours (manual pp.19-30): base colour and brightness 0..1 */
  const padColor = (i: number): { color: string; base: number } => {
    switch (mode) {
      case PAD_MODE.MUTE: {
        if (pre.includes(i)) return { color: RY.blue, base: 0.8 };
        if (solos[i]) return { color: RY.cyan, base: 0.85 };
        const muted = master.includes(i) || !!pat.tracks[i]?.mute;
        return muted ? { color: RY.pad, base: 0 } : { color: RY.green, base: 0.6 };
      }
      case PAD_MODE.CHRO:
        return { color: octave >= 1 ? RY.yellow : octave === 0 ? RY.sky : octave === -1 ? RY.purple : RY.navy, base: i === 0 ? 0.75 : 0.45 };
      case PAD_MODE.SCNE: {
        const has = !!kit?.scenes?.[i] && Object.keys(kit.scenes[i]).length > 0;
        if (scene === i) return { color: RY.blue, base: 0.95 };
        if (has && i === active) return { color: RY.purple, base: 0.5 };
        return { color: RY.blue, base: has ? 0.3 : 0 };
      }
      case PAD_MODE.PERF: {
        const has = !!kit?.perfs?.[i] && Object.keys(kit.perfs[i]).length > 0;
        return { color: RY.green, base: has ? Math.max(0.28, (perf[i] ?? 0) * 0.95, quick[i] ? 0.5 : 0) : 0 };
      }
      default:
        return { color: RY.led, base: active === i ? 0.5 : 0 };
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {PAD_ROWS.map((row, r) => row.map((pad, c) => {
        const t = TRACKS[pad];
        const { color, base } = padColor(pad);
        const sp = spotlight(ctx, [`pad:${t.id}`, 'pads'], focusMode);
        const face = mix(RY.pad, color, base * 0.72);
        const edge = mix('#cfd1d3', color, base * 0.5);
        return (
          <div key={pad} style={{ position: 'absolute', left: `${c * 25.2}%`, top: `${r * 34}%`, width: '21.4%', height: '28%', opacity: sp.dim ? 0.3 : 1 }}>
            <div
              ref={el => { faces.current[pad] = el; }}
              data-control={`pad:${t.id}`}
              role="button"
              aria-label={`${t.name} pad (${t.full})`}
              onPointerDown={e => down(pad, e)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onLostPointerCapture={up}
              onContextMenu={e => e.preventDefault()}
              className={sp.hl ? 'rytm-target' : undefined}
              style={{
                position: 'absolute', inset: 0, borderRadius: '9%', cursor: 'pointer', touchAction: 'none',
                userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent',
                background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, #ffffff calc(var(--glow, 0) * 92%), ${face}) 0%, color-mix(in srgb, #ffffff calc(var(--glow, 0) * 60%), ${edge}) 100%)`,
                boxShadow: `0 3px 0 #050505, inset 0 -2px 4px rgba(0,0,0,0.18), 0 0 calc(var(--glow, 0) * 18px + ${base * 10}px) color-mix(in srgb, ${base > 0 ? color : '#ffffff'} 70%, transparent)`,
                border: '1px solid #9ea1a4',
              }}
            />
            <div style={{ position: 'absolute', top: '106%', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '12%', pointerEvents: 'none', fontFamily: FONT, color: RY.legend, userSelect: 'none', WebkitUserSelect: 'none' }}>
              <span style={{ fontStyle: 'italic', fontWeight: 600, fontSize: 'var(--rytm-pad-font, 10px)', opacity: 0.85 }}>{pad + 1}</span>
              <span style={{ fontWeight: 800, fontSize: 'var(--rytm-pad-font, 10px)' }}>{t.name}</span>
            </div>
          </div>
        );
      }))}
      {/* "||": the pairs that share one voice (the right-hand track wins and cuts the left) */}
      {SHARED_PAIRS.map(([a]) => {
        const r = PAD_ROWS.findIndex(row => row.includes(a));
        const c = PAD_ROWS[r].indexOf(a);
        return (
          <div key={a} aria-hidden style={{ position: 'absolute', left: `${c * 25.2 + 21.4 + 0.9}%`, width: '2%', top: `${r * 34 + 9}%`, height: '10%', display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
            <span style={{ width: 2, height: '100%', background: '#8d9095', borderRadius: 1 }} />
            <span style={{ width: 2, height: '100%', background: '#8d9095', borderRadius: 1 }} />
          </div>
        );
      })}
    </div>
  );
}

/** The track's VEL on the TRIG page (what [FUNC] + pad, the trig keys and FIX AUTO play) */
const trackVel = (c: CustomRenderContext, track: number) => Math.round(num(c.values[`${TRACKS[track].id}_trig_vel`], 100));

/** [RTRG] + pad in MUTE mode: solo (every other track is muted); again to release (manual p.23) */
function toggleSolo(c: CustomRenderContext, pad: number) {
  const solos = ((c.engine.seq as { solos?: boolean[] } | undefined)?.solos ?? []).slice(0, 12);
  const on = !solos[pad];
  c.sendEvent('seq:solo', { track: pad, on });
  solos[pad] = on;
  const list = TRACKS.filter((_, t) => solos[t]).map(t => t.name);
  flash(c, list.length ? `SOLO ${list.join(' ')}` : 'SOLO OFF');
}

/**
 * MUTE mode: the master mutes. They stay when the pattern or the kit changes and
 * win over trig mutes and song mutes (manual p.23); the project keeps them.
 */
export function toggleMasterMute(c: CustomRenderContext, track: number) {
  c.updateData(d => {
    const p = asProject(d, T);
    return setMasterMute(p, track, !(p.mutes ?? []).includes(track));
  });
}

/** [FUNC] released in MUTE mode: the preselected mutes come into effect together */
export function applyMutePreselect(c: CustomRenderContext) {
  const pre = (c.ui.mutePre as number[] | undefined) ?? [];
  if (!pre.length) return;
  c.updateData(d => {
    const p = asProject(d, T);
    const cur = new Set(p.mutes ?? []);
    for (const t of pre) { if (cur.has(t)) cur.delete(t); else cur.add(t); }
    return setMasterMutes(p, [...cur]);
  });
  c.setUi({ mutePre: [] });
}

/**
 * Trig keys with GRID RECORDING off: keys 1-12 play the tracks at their VEL (manual p.34),
 * the LEDs follow the sequencer over the active track's trigs. With [QPER] held they choose macros.
 */
export function PlayTrigs({ ctx }: { ctx: CustomRenderContext }) {
  const p = projectOf(ctx);
  const track = Math.round(num(ctx.values.track));
  const st = ctx.engine.seq as { playing?: boolean; pattern?: string | null; steps?: number[] } | undefined;
  const pid = (st?.playing && st.pattern) || p.active;
  const tr = getPattern(p, pid).tracks[track];
  const page = Math.round(num(ctx.ui.stepPage));
  const step = st?.playing ? st.steps?.[track] ?? -1 : -1;
  const focusMode = useFocusMode();
  const live = useRef(ctx);
  live.current = ctx;
  const down = (k: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
    const c = live.current;
    if (c.ui.qperHeld || c.ui.qperLatch) {
      if (k > 11) return;
      const list = ((c.ui.qperList as number[] | undefined) ?? []).slice();
      const i = list.indexOf(k);
      if (i >= 0) list.splice(i, 1); else list.push(k);
      c.setUi({ qperList: list });
      flash(c, `QUICK PERF: ${list.length ? list.map(x => x + 1).join(' ') : 'NONE'}`);
      return;
    }
    if (c.ui.trkHeld || c.ui.trkLatch) { if (k <= 12) { c.setValue('track', k); c.setUi({ trkLatch: false }); } return; }
    if (k > 11) return;
    if (num(c.values.auto_trk) > 0) c.setValue('track', k);
    c.sendEvent('pad', { track: k, vel: trackVel(c, k) });
  };
  const up = (k: number) => { if (k <= 11) live.current.sendEvent('pad:up', { track: k }); };
  const sp = spotlight(ctx, ['seq:trigs', ...Array.from({ length: 16 }, (_, i) => `trig:${i + 1}`)], focusMode);
  return (
    <div className={sp.hl ? 'rytm-target' : undefined} style={{ position: 'absolute', inset: 0, display: 'flex', gap: 'var(--rytm-trig-gap, 3px)', opacity: sp.dim ? 0.3 : 1 }}>
      {Array.from({ length: 16 }, (_, k) => {
        const s = page * 16 + k;
        const has = !!tr?.steps[s];
        const on = s === step;
        const lv = on ? 1 : has ? 0.3 : 0;
        return (
          <button key={k} type="button" data-control={`trig:${k + 1}`} aria-label={k < 12 ? `Trig key ${k + 1}: play ${TRACKS[k].name}` : `Trig key ${k + 1}`}
            onPointerDown={e => down(k, e)} onPointerUp={() => up(k)} onPointerCancel={() => up(k)} onContextMenu={e => e.preventDefault()}
            style={{
              flex: 1, minWidth: 0, height: '100%', padding: 0, borderRadius: '14%', cursor: 'pointer', touchAction: 'none',
              userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent',
              border: `${k % 4 === 0 ? 2 : 1}px solid ${k % 4 === 0 ? '#55585d' : RY.keyEdge}`,
              background: lv > 0 ? `radial-gradient(circle at 50% 40%, ${mix(RY.keyHi, RY.led, 0.3 + 0.6 * lv)} 0%, ${RY.key} 90%)` : `linear-gradient(180deg, ${RY.keyHi} 0%, ${RY.key} 60%)`,
              boxShadow: lv > 0 ? `0 2px 0 #000, 0 0 ${3 + 9 * lv}px ${RY.led}` : '0 2px 0 #000',
              color: RY.sub, fontFamily: FONT, fontSize: 'var(--rytm-sub-font, 10px)', fontWeight: 700,
            }}>{k + 1}</button>
        );
      })}
    </div>
  );
}

/** Held trig + [BANK E]: trig mute on / off for the held trigs (manual p.49) */
export function toggleHeldMute(ctx: CustomRenderContext) {
  const held = Array.isArray(ctx.ui.heldSteps) ? (ctx.ui.heldSteps as number[]) : [];
  if (!held.length) return false;
  const p = projectOf(ctx);
  const track = typeof ctx.ui.heldTrack === 'number' ? ctx.ui.heldTrack : Math.round(num(ctx.values.track));
  const pid = typeof ctx.ui.heldPattern === 'string' ? ctx.ui.heldPattern : p.active;
  const first = getPattern(p, pid).tracks[track]?.steps[held[0]];
  const on = !first?.mute;
  ctx.updateData(d => setTrigMute(asProject(d, T), pid, track, held, on));
  ctx.setUi({ heldEdited: true });
  flash(ctx, `TRIG MUTE ${on ? 'ON' : 'OFF'}`);
  return true;
}

/** SWING menu: [UP] / [DOWN] set the pattern's swing 50-80 % (manual p.50) */
export function nudgeSwing(ctx: CustomRenderContext, dir: number) {
  const p = projectOf(ctx);
  const cur = getPattern(p, p.active).swing;
  const next = Math.max(50, Math.min(80, cur + dir));
  ctx.updateData(d => updatePatternSettings(asProject(d, T), p.active, { swing: next }));
  flash(ctx, `SWING ${next}%`);
}

const rtrgOn = (c: CustomRenderContext) => !!(c.ui.rtrgHeld || c.ui.rtrgLatch);
const recLive = (c: CustomRenderContext) => Math.round(num(c.values.rec)) === 2 && !!(c.engine.seq as { playing?: boolean } | undefined)?.playing;
const kitOf = (c: CustomRenderContext) => (c.engine.kit as string | undefined) || projectOf(c).kit || '01';

// ----------------------------------------------------------------------------
// PAGE LEDs (1:4 .. 4:4): bright = the page the trig keys show, dim = the
// pattern's other pages, the green dot = the page that is playing. Tap to show a page.
// ----------------------------------------------------------------------------

export function PageLeds({ ctx }: { ctx: CustomRenderContext }) {
  const p = projectOf(ctx);
  const track = Math.round(num(ctx.values.track));
  const st = ctx.engine.seq as { playing?: boolean; pattern?: string | null; steps?: number[] } | undefined;
  const pid = (st?.playing && st.pattern) || p.active;
  const pages = Math.max(1, Math.ceil(trackLength(getPattern(p, pid), track) / 16));
  const shown = Math.min(pages - 1, Math.round(num(ctx.ui.stepPage)));
  const playStep = st?.playing ? st.steps?.[track] ?? -1 : -1;
  const playPage = playStep >= 0 ? Math.floor(playStep / 16) : -1;
  const focusMode = useFocusMode();
  const sp = spotlight(ctx, ['seq:pages', 'seq:page:1', 'seq:page:2', 'seq:page:3', 'seq:page:4'], focusMode);
  return (
    <div className={sp.hl ? 'rytm-target' : undefined} style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: sp.dim ? 0.3 : 1 }}>
      {[0, 1, 2, 3].map(i => {
        const exists = i < pages;
        const on = i === shown;
        return (
          <button key={i} type="button" aria-label={`Show step page ${i + 1}`} data-page={i + 1}
            onPointerDown={e => { e.stopPropagation(); if (exists) ctx.setUi({ stepPage: i }); }}
            style={{ width: '22%', height: '100%', padding: 0, border: 'none', background: 'transparent', cursor: exists ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}>
            <span style={{
              width: '62%', aspectRatio: '1 / 1', borderRadius: '50%', position: 'relative',
              background: on ? '#ff3b2a' : exists ? '#6b1d16' : '#2a1414',
              boxShadow: on ? '0 0 6px #ff3b2a' : 'inset 0 1px 2px #000',
            }}>
              {playPage === i && <span style={{ position: 'absolute', right: '-35%', top: '-35%', width: '45%', height: '45%', borderRadius: '50%', background: RY.green, boxShadow: `0 0 4px ${RY.green}` }} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Screen
// ----------------------------------------------------------------------------

function Dial({ frac, bipolar, locked }: { frac: number; bipolar?: boolean; locked?: boolean }) {
  const a0 = -135, a1 = 135;
  const ang = a0 + (a1 - a0) * Math.max(0, Math.min(1, frac));
  const pt = (deg: number, r: number) => [12 + r * Math.sin((deg * Math.PI) / 180), 12 - r * Math.cos((deg * Math.PI) / 180)];
  const arc = (from: number, to: number) => {
    const [x0, y0] = pt(from, 9), [x1, y1] = pt(to, 9);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `M ${x0} ${y0} A 9 9 0 ${large} ${to > from ? 1 : 0} ${x1} ${y1}`;
  };
  const [px, py] = pt(ang, 9);
  const fg = locked ? '#050805' : '#e8f0ff';
  return (
    <svg viewBox="0 0 24 24" style={{ width: '1.9em', height: '1.9em', display: 'block', margin: '0 auto' }}>
      <path d={arc(a0, a1)} stroke={fg} strokeOpacity={0.35} strokeWidth={2} fill="none" />
      <path d={bipolar ? arc(Math.min(0, ang), Math.max(0, ang)) : arc(a0, ang)} stroke={fg} strokeWidth={2.4} fill="none" />
      <line x1={12} y1={12} x2={px} y2={py} stroke={fg} strokeWidth={2} />
    </svg>
  );
}

function cellFor(id: string | null, ctx: CustomRenderContext, flags: { locked: boolean; machine?: number }) {
  if (!id) return null;
  const meta = paramMeta(id);
  const v = num(ctx.values[id], num((ANALOG_RYTM.controls[id] as { default?: number } | undefined)?.default));
  const d = describe(id, v, flags.machine);
  if (!meta || !d) return null;
  const p = meta.p as { min: number; max: number; bipolar?: boolean; options?: readonly string[] };
  const frac = (v - p.min) / Math.max(1e-9, p.max - p.min);
  const textual = !!p.options || (meta.kind === 'page' && /trig_note|trig_len|trig_prob|flt_frq/.test(meta.p.key));
  return { label: d.abbr, name: d.name, text: d.text, frac, bipolar: !!p.bipolar, textual, locked: flags.locked };
}

/** Kit that the panel shows (engine state, else data) */
function kitName(ctx: CustomRenderContext): string {
  const p = projectOf(ctx);
  const id = kitOf(ctx);
  return `K${id} ${p.kits?.[id]?.name ?? ''}`.trim();
}

export function Screen({ ctx }: { ctx: CustomRenderContext }) {
  const track = Math.round(num(ctx.values.track));
  const page = Math.max(0, Math.min(5, Math.round(num(ctx.values.page, 1))));
  const isFx = track === FX_TRACK;
  const ids = pageControls(track, page, ctx.values, ctx.ui);
  const st = ctx.engine.seq as { playing?: boolean; pattern?: string | null; bpm?: number; mode?: string; songRow?: number; queued?: string | null; fill?: boolean } | undefined;
  const project = projectOf(ctx);
  const bpm = st?.bpm ?? num(ctx.values.bpm, 120);
  const playing = !!st?.playing;
  const patId = (playing && st?.pattern) || project.active;
  const mode = Math.round(num(ctx.values.pad_mode));
  const heldSteps = Array.isArray(ctx.ui.heldSteps) ? (ctx.ui.heldSteps as number[]) : [];
  const api = { values: ctx.values, data: ctx.data, ui: ctx.ui };
  const machine = isFx ? -1 : machineOf(ctx.values, track);

  // The header shows the last turned parameter's long name for a moment (as the hardware does)
  const prev = useRef<Record<string, ControlValue>>({});
  const [touched, setTouched] = useState<{ name: string; text: string; at: number } | null>(null);
  const shownIds = ids.filter((x): x is string => !!x).join(',');
  const values = ctx.values;
  useEffect(() => {
    for (const id of shownIds.split(',')) {
      if (!id) continue;
      const v = values[id];
      if (prev.current[id] !== undefined && prev.current[id] !== v) {
        const d = describe(id, num(v), machine >= 0 ? machine : undefined);
        if (d) setTouched({ name: d.name.toUpperCase(), text: d.text, at: Date.now() });
      }
      prev.current[id] = v;
    }
  }, [shownIds, values, machine]);
  useEffect(() => {
    if (!touched) return;
    const t = setTimeout(() => setTouched(null), 1400);
    return () => clearTimeout(t);
  }, [touched]);
  const message = ctx.ui.message as { text: string; at: number } | undefined;
  const [, force] = useState(0);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => force(x => x + 1), 2300);
    return () => clearTimeout(t);
  }, [message]);
  const showMsg = message && Date.now() - message.at < 2200;

  const title = isFx ? FX_PAGE_TITLES[page] : page === PAGE.SRC ? MACHINES[machine].name : PAGE_TITLES[page];
  const header = touched ? touched.name : title;
  const trackLev = isFx ? num(ctx.values.fx_trk_lev, 100) : num(ctx.values[`${TRACKS[track].id}_trk_lev`], 100);
  const trackName = isFx ? 'FX' : TRACKS[track].name;

  const cells = ids.map(id => cellFor(id, ctx, { locked: !!id && heldSteps.length > 0 && isLocked(api, LOCKS, id), machine: machine >= 0 ? machine : undefined }));
  const oled: CSSProperties = { position: 'absolute', inset: 0, background: '#030403', color: '#e8f0ff', fontFamily: '"Menlo", "DejaVu Sans Mono", ui-monospace, monospace', textTransform: 'uppercase', display: 'flex', flexDirection: 'column', padding: '3% 3.5%', boxSizing: 'border-box', textShadow: '0 0 2px rgba(200,220,255,0.55)', letterSpacing: 0.3, fontSize: 'var(--rytm-oled-font, 10px)' };
  // drawn inside the inverted (light) footer box, so it is dark
  const bar = (frac: number) => (
    <span style={{ display: 'inline-block', width: '3.6em', height: '0.75em', border: '1px solid #030403', position: 'relative', verticalAlign: '-1px', marginLeft: 3, overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 1, top: 1, bottom: 1, right: 1, background: '#030403', transformOrigin: 'left center', transform: `scaleX(${Math.max(0, Math.min(1, frac)).toFixed(3)})` }} />
    </span>
  );

  let body: ReactNode;
  if (showMsg) {
    body = <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: '1.1em', lineHeight: 1.35, padding: '0 4%' }}>{message!.text}</div>;
  } else if (mode === PAD_MODE.MUTE) {
    const master = project.mutes ?? [];
    const solos = (ctx.engine.seq as { solos?: boolean[] } | undefined)?.solos ?? [];
    const anySolo = solos.some(Boolean);
    const pat = getPattern(project, patId);
    body = (
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4%', alignContent: 'center', padding: '2% 0' }}>
        {TRACKS.map((t, i) => {
          const m = master.includes(i) || !!pat.tracks[i]?.mute || (anySolo && !solos[i]);
          return <div key={t.id} style={{ textAlign: 'center', border: '1px solid #e8f0ff', padding: '6% 0', background: m ? 'transparent' : '#e8f0ff', color: m ? '#e8f0ff' : '#030403', fontWeight: 700 }}>{t.name}</div>;
        })}
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: '0.85em', opacity: 0.8 }}>MUTE MODE: TAP PADS</div>
      </div>
    );
  } else {
    body = (
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: '1fr 1fr', columnGap: '3%', rowGap: '4%', padding: '3% 0 2%' }}>
        {cells.map((c, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', background: c?.locked ? '#e8f0ff' : 'transparent', color: c?.locked ? '#030403' : undefined, borderRadius: 2, minWidth: 0 }}>
            {c ? (
              <>
                {c.textual ? <div style={{ fontSize: c.text.length > 5 ? '0.95em' : '1.15em', fontWeight: 700, height: '1.9em', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{c.text}</div> : <Dial frac={c.frac} bipolar={c.bipolar} locked={c.locked} />}
                <div style={{ fontWeight: 700, marginTop: '0.15em' }}>{c.label}</div>
              </>
            ) : <div style={{ opacity: 0.25 }}>-</div>}
          </div>
        ))}
      </div>
    );
  }

  const sceneN = num(ctx.engine.scene, -1);
  const edit = typeof ctx.ui.sceneEdit === 'number' ? `SCENE ${num(ctx.ui.sceneEdit) + 1} EDIT` : typeof ctx.ui.perfEdit === 'number' ? `PERF ${num(ctx.ui.perfEdit) + 1} EDIT` : '';
  const right = edit || (mode === PAD_MODE.SCNE ? `SCN ${sceneN >= 0 ? sceneN + 1 : '-'}` : mode === PAD_MODE.PERF ? 'PERF' : mode === PAD_MODE.CHRO ? `CHRO ${num(ctx.ui.octave) >= 0 ? '+' : ''}${num(ctx.ui.octave)}` : st?.mode === 'chain' ? 'CHAIN' : '');
  return (
    <div style={oled}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '2%', height: '1.45em' }}>
        <div style={{ flex: 1.4, background: '#e8f0ff', color: '#030403', fontWeight: 800, padding: '0 3px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textShadow: 'none' }}>
          {header}{touched ? `: ${touched.text}` : ''}
        </div>
        <div style={{ flex: 1, border: '1px solid #e8f0ff', padding: '0 3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', whiteSpace: 'nowrap' }}>
          <span>BPM:{bpm.toFixed(1)}</span>
          <span style={{ fontSize: '0.9em' }}>{playing ? '▶' : '■'}</span>
        </div>
      </div>
      {body}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2%', height: '1.4em', whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <div style={{ flex: 1.4, background: '#e8f0ff', color: '#030403', fontWeight: 700, padding: '0 3px', display: 'flex', alignItems: 'center', textShadow: 'none', overflow: 'hidden' }}>
          {trackName} LEV:{bar(trackLev / 127)}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <span style={{ whiteSpace: 'nowrap' }}>
            {st?.mode === 'song' ? `${String((st?.songRow ?? 0) + 1).padStart(2, '0')}:` : '__:'}
            <span style={{ border: '1px solid #e8f0ff', padding: '0 2px', fontWeight: 700, marginLeft: 2 }} className={st?.queued ? 'rytm-blink' : undefined}>{st?.queued ?? patId}</span>
          </span>
          <span style={{ fontSize: '0.85em', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis' }}>{right || kitName(ctx)}</span>
        </div>
      </div>
      <DataSync ctx={ctx} />
      <PresetLoader ctx={ctx} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Kits: the engine switches them on pattern changes; the panel mirrors it
// ----------------------------------------------------------------------------

/** Kit values that differ from the defaults */
function sparseKit(values: Record<string, ControlValue>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of KIT_CONTROL_IDS) {
    const v = values[id];
    if (typeof v === 'number' && v !== KIT_DEFAULTS[id]) out[id] = v;
  }
  return out;
}

function fullKit(kit: RytmKit | undefined): Record<string, ControlValue> {
  const out: Record<string, ControlValue> = { ...KIT_DEFAULTS };
  if (kit) for (const id in kit.values) if (id in out) out[id] = kit.values[id];
  return out;
}

/** Applies the engine's operations (kit switches, live-recorded trigs) to the project and the panel */
function DataSync({ ctx }: { ctx: CustomRenderContext }) {
  const ops = ctx.engine.ops as { sid: string; n: number; list: RytmOp[] } | undefined;
  useEffect(() => {
    if (!ops || !ops.n) return;
    const p0 = projectOf(ctx);
    const applied = p0.opsApplied;
    const from = applied && applied.sid === ops.sid ? applied.n : 0;
    const todo = ops.list.filter(o => o.n > from);
    if (!todo.length) return;
    const raw = hub.valuesFor(ctx.instance);
    let working: Record<string, ControlValue> = {};
    for (const id of KIT_CONTROL_IDS) working[id] = raw[id];
    let kitChanged = false;
    let kits = { ...(p0.kits ?? {}) };
    let currentKit = p0.kit;
    let p: RytmProject = p0;
    for (const op of todo) {
      if (op.type === 'kit') {
        if (op.from) kits[op.from] = { ...(kits[op.from] ?? { name: `KIT ${op.from}` }), values: sparseKit(working) };
        working = fullKit(kits[op.to]);
        currentKit = op.to;
        kitChanged = true;
      } else if (op.type === 'rec') {
        const cur = getPattern(p, op.pattern).tracks[op.track]?.steps[op.step];
        const step: Step = { ...(cur ?? {}), vel: op.vel };
        if (op.micro) step.micro = op.micro; else delete step.micro;
        delete step.trigless;
        p = setStep(p, op.pattern, op.track, op.step, step) as RytmProject;
      }
    }
    const last = todo[todo.length - 1].n;
    ctx.updateData(d => {
      const base = { ...(asProject(d, T) as RytmProject) };
      const merged: RytmProject = { ...base, patterns: p === p0 ? base.patterns : p.patterns, opsApplied: { sid: ops.sid, n: last } };
      if (kitChanged) { merged.kits = kits; merged.kit = currentKit; }
      return merged;
    });
    if (kitChanged) {
      const diff: Record<string, ControlValue> = {};
      for (const id of KIT_CONTROL_IDS) if (raw[id] !== working[id]) diff[id] = working[id];
      if (Object.keys(diff).length) useStudioStore.getState().setControlValues(ctx.instance, diff);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops?.sid, ops?.n]);
  return null;
}

/** A factory kit chosen from the preset menu also selects its demo pattern (bank B) */
function PresetLoader({ ctx }: { ctx: CustomRenderContext }) {
  const demo = Math.round(num(ctx.values.kit_demo));
  useEffect(() => {
    const p = projectOf(ctx);
    const applied = (p as RytmProject & { demo?: number }).demo ?? 0;
    if (demo === applied) return;
    ctx.updateData(d => {
      let q = { ...(asProject(d, T) as RytmProject & { demo?: number }) };
      q.demo = demo;
      if (demo > 0 && demo <= KIT_PRESETS.length) {
        const i = demo - 1;
        const kid = kitIdOf(i), pid = kitPatternOf(i);
        const kits = { ...(q.kits ?? {}) };
        kits[kid] = { ...(kits[kid] ?? { name: KIT_PRESETS[i].name.split('/').pop()!.trim().toUpperCase().slice(0, 15) }), values: { ...KIT_PRESETS[i].values } };
        const pat = q.patterns[pid];
        const empty = !pat || pat.tracks.every(t => !Object.keys(t.steps).length);
        if (empty) q = { ...q, patterns: { ...q.patterns, [pid]: buildPattern(KIT_PRESETS[i].pattern, kid) } };
        q.kits = kits;
        q.kit = kid;
        q = setPlayMode(setActive(q, pid), 'pattern') as typeof q;
      }
      return q;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);
  return null;
}

// ----------------------------------------------------------------------------
// Menus (portals)
// ----------------------------------------------------------------------------

function MenuFrame({ ctx, title, children, sub }: { ctx: CustomRenderContext; title: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <Overlay portal portalSize={{ w: 640, h: 460 }}>
      <Frame title={title} sub={sub} onClose={() => openMenu(ctx, null)}>{children}</Frame>
    </Overlay>
  );
}

export function Menus({ ctx }: { ctx: CustomRenderContext }) {
  const menu = ctx.ui.rytmMenu as string | undefined;
  const sceneEdit = ctx.ui.sceneEdit as number | null | undefined;
  const perfEdit = ctx.ui.perfEdit as number | null | undefined;
  return (
    <>
      {menu === 'kit' && <KitMenu ctx={ctx} />}
      {menu === 'sound' && <SoundMenu ctx={ctx} />}
      {menu === 'samples' && <SampleMenu ctx={ctx} />}
      {menu === 'tempo' && <TempoMenu ctx={ctx} />}
      {menu === 'retrig' && <RetrigMenu ctx={ctx} />}
      {menu === 'fix' && <FixMenu ctx={ctx} />}
      {typeof sceneEdit === 'number' && <MacroEdit ctx={ctx} kind="scene" index={sceneEdit} />}
      {typeof perfEdit === 'number' && <MacroEdit ctx={ctx} kind="perf" index={perfEdit} />}
      {(ctx.ui.trkHeld || ctx.ui.trkLatch) ? <TrackSelect ctx={ctx} /> : null}
    </>
  );
}

function KitMenu({ ctx }: { ctx: CustomRenderContext }) {
  const p = projectOf(ctx);
  const kits = p.kits ?? {};
  const cur = kitOf(ctx);
  const pat = p.patterns[p.active];
  const link = pat?.kit || '';
  const ids = Object.keys(kits).sort();
  const nextId = () => { for (let i = 1; i <= 128; i++) { const id = String(i).padStart(2, '0'); if (!kits[id]) return id; } return '99'; };
  const saveAsNew = () => {
    const id = nextId();
    const raw = hub.valuesFor(ctx.instance);
    ctx.updateData(d => {
      const q = { ...(asProject(d, T) as RytmProject) };
      const cv = q.kits?.[q.kit ?? '01'];
      q.kits = { ...(q.kits ?? {}), [id]: { name: `KIT ${id}`, values: sparseKit(raw), scenes: cv?.scenes, perfs: cv?.perfs } };
      q.kit = id;
      if (q.patterns[q.active]) q.patterns = { ...q.patterns, [q.active]: { ...q.patterns[q.active], kit: id } };
      return q;
    });
    flash(ctx, `SAVED AS K${id}`);
  };
  return (
    <MenuFrame ctx={ctx} title="KIT" sub={`${kitName(ctx)} · pattern ${p.active} ${link ? `links K${link}` : 'has no kit link'}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: FONT }}>
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.4 }}>
          A kit holds every sound, the FX settings, scenes and performance macros. Each pattern can link a kit: when the pattern starts, its kit loads.
          Your edits are kept with the kit when another kit loads.
        </div>
        <Group label="LINK THE SELECTED PATTERN TO A KIT (LOADS IT)">
          {ids.map(id => (
            <SeqButton key={id} active={id === cur} color={C.white} onPress={() => {
              ctx.updateData(d => {
                const q = asProject(d, T) as RytmProject;
                const pt = getPattern(q, q.active);
                return { ...q, patterns: { ...q.patterns, [q.active]: { ...pt, kit: id } } };
              });
            }} title={kits[id].name}>
              {`K${id} ${kits[id].name}`}
            </SeqButton>
          ))}
        </Group>
        <Group label="SAVE">
          <SeqButton onPress={saveAsNew} color={C.green}>SAVE AS NEW KIT</SeqButton>
          <SeqButton onPress={() => {
            ctx.updateData(d => {
              const q = asProject(d, T) as RytmProject;
              const pt = getPattern(q, q.active);
              return { ...q, patterns: { ...q.patterns, [q.active]: { ...pt, kit: '' } } };
            });
          }}>UNLINK PATTERN</SeqButton>
          <SeqButton onPress={() => reloadKit(ctx)} title="Back to the kit as it was last stored">RELOAD KIT</SeqButton>
        </Group>
      </div>
    </MenuFrame>
  );
}

/** [YES] + [PLAY MODE]: store the kit as it is now (what RELOAD goes back to) */
export function saveKit(ctx: CustomRenderContext) {
  const raw = hub.valuesFor(ctx.instance);
  const kid = kitOf(ctx);
  ctx.updateData(d => {
    const q = { ...(asProject(d, T) as RytmProject) };
    q.kits = { ...(q.kits ?? {}), [kid]: { ...(q.kits?.[kid] ?? { name: `KIT ${kid}` }), values: sparseKit(raw) } };
    return q;
  });
  flash(ctx, `KIT K${kid} SAVED`);
}

/** [NO] + [MUTE]: the active track's sound back to the stored kit */
export function reloadSound(ctx: CustomRenderContext) {
  const track = Math.min(11, Math.round(num(ctx.values.track)));
  const k = fullKit(projectOf(ctx).kits?.[kitOf(ctx)]);
  const pre = `${TRACKS[track].id}_`;
  const vals: Record<string, ControlValue> = {};
  for (const id in k) if (id.startsWith(pre)) vals[id] = k[id];
  useStudioStore.getState().setControlValues(ctx.instance, vals);
  flash(ctx, `${TRACKS[track].name} SOUND RELOADED`);
}

/** [PARAMETER] + [NO]: the page back to the stored kit; + [YES]: random values (not the TRIG page) */
export function pageReloadOrRandom(ctx: CustomRenderContext, page: number, random: boolean) {
  const track = Math.round(num(ctx.values.track));
  const ids = pageControls(track, page, ctx.values).filter((x): x is string => !!x);
  if (random && page === PAGE.TRIG) { flash(ctx, 'THE TRIG PAGE CANNOT BE RANDOMIZED'); return; }
  const k = fullKit(projectOf(ctx).kits?.[kitOf(ctx)]);
  const vals: Record<string, ControlValue> = {};
  for (const id of ids) {
    const c = ANALOG_RYTM.controls[id] as { min?: number; max?: number; options?: string[]; default?: ControlValue } | undefined;
    if (!c) continue;
    if (random) {
      const lo = c.options ? 0 : num(c.min), hi = c.options ? c.options.length - 1 : num(c.max, 127);
      vals[id] = Math.round(lo + Math.random() * (hi - lo));
    } else if (id in k) vals[id] = k[id];
  }
  useStudioStore.getState().setControlValues(ctx.instance, vals);
  flash(ctx, random ? 'PAGE RANDOMIZED' : 'PAGE RELOADED');
}

/** [FUNC] + [LEFT] / [RIGHT] in GRID RECORDING: every trig of the track one step earlier / later */
export function shiftTrack(ctx: CustomRenderContext, dir: number) {
  const p = projectOf(ctx);
  const track = Math.round(num(ctx.values.track));
  const len = trackLength(getPattern(p, p.active), track);
  ctx.updateData(d => withTrack(asProject(d, T), p.active, track, tr => {
    const steps: Track['steps'] = {};
    for (const k in tr.steps) { const n = ((Number(k) + dir) % len + len) % len; steps[n] = tr.steps[k]; }
    return { ...tr, steps };
  }));
  flash(ctx, `TRIGS ${dir > 0 ? '>>' : '<<'}`);
}

/** Held trig + [BANK F] / [BANK H]: toggle its accent / parameter slide */
export function toggleHeldFlag(ctx: CustomRenderContext, flag: 'accent' | 'pslide') {
  const held = Array.isArray(ctx.ui.heldSteps) ? (ctx.ui.heldSteps as number[]) : [];
  if (!held.length) return false;
  const p = projectOf(ctx);
  const track = typeof ctx.ui.heldTrack === 'number' ? ctx.ui.heldTrack : Math.round(num(ctx.values.track));
  const pid = typeof ctx.ui.heldPattern === 'string' ? ctx.ui.heldPattern : p.active;
  const first = getPattern(p, pid).tracks[track]?.steps[held[0]];
  const on = !first?.[flag];
  ctx.updateData(d => updateSteps(asProject(d, T), pid, track, held, { [flag]: on ? true : null } as Parameters<typeof updateSteps>[4]));
  ctx.setUi({ heldEdited: true });
  flash(ctx, `${flag === 'accent' ? 'ACCENT' : 'PARAMETER SLIDE'} ${on ? 'ON' : 'OFF'}`);
  return true;
}

/** [FUNC] + [NO]: back to the stored kit */
export function reloadKit(ctx: CustomRenderContext) {
  const p = projectOf(ctx);
  const k = p.kits?.[kitOf(ctx)];
  const values = fullKit(k);
  useStudioStore.getState().setControlValues(ctx.instance, values);
  flash(ctx, `RELOADED K${kitOf(ctx)}`);
}

function SoundMenu({ ctx }: { ctx: CustomRenderContext }) {
  const track = Math.min(11, Math.round(num(ctx.values.track)));
  const t = TRACKS[track];
  const cur = machineOf(ctx.values, track);
  const setMachine = (m: number) => {
    const idx = t.machines.indexOf(m);
    const vals: Record<string, ControlValue> = { [`${t.id}_machine`]: idx };
    for (const [k, v] of Object.entries(soundDefaults(track, m))) if (`${t.id}_${k}` in ANALOG_RYTM.controls) vals[`${t.id}_${k}`] = v;
    useStudioStore.getState().setControlValues(ctx.instance, vals);
    ctx.setValue('page', PAGE.SRC);
  };
  return (
    <MenuFrame ctx={ctx} title={`SOUND · ${t.name} ${t.full}`} sub={`voice ${t.voice + 1}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: FONT }}>
        <Group label="MACHINE (the analog sound generator of this track)">
          {t.machines.map(m => (
            <SeqButton key={m} active={m === cur} color={C.white} onPress={() => setMachine(m)} title={MACHINES[m].desc}>{MACHINES[m].name}</SeqButton>
          ))}
        </Group>
        <div style={{ fontSize: 12, color: C.dim, minHeight: 32 }}>{MACHINES[cur].desc}</div>
        <Group label="SOUND SETTINGS">
          <SeqButton active={num(ctx.values[`${t.id}_vel_vol`], 1) > 0} color={C.green} onPress={() => ctx.setValue(`${t.id}_vel_vol`, num(ctx.values[`${t.id}_vel_vol`], 1) > 0 ? 0 : 1)}>VELOCITY TO VOL</SeqButton>
          <Stepper label="ACCENT LEVEL" value={num(ctx.values[`${t.id}_acc_lev`], 32)} min={0} max={127} onChange={v => ctx.setValue(`${t.id}_acc_lev`, v)} />
          <Stepper label="TRACK LEVEL" value={num(ctx.values[`${t.id}_trk_lev`], 100)} min={0} max={127} onChange={v => ctx.setValue(`${t.id}_trk_lev`, v)} />
        </Group>
        <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.4 }}>
          Fixed in this twin: CHROMATIC = SYN+SMP, ENV RESET = FILTER, AFTERTOUCH = +16 FLT FRQ (slide up on a held pad), no velocity mod slots, LEGACY FX SEND off.
        </div>
      </div>
    </MenuFrame>
  );
}

function SampleMenu({ ctx }: { ctx: CustomRenderContext }) {
  const track = Math.min(11, Math.round(num(ctx.values.track)));
  const t = TRACKS[track];
  const cur = Math.round(num(ctx.values[`${t.id}_smp_slot`]));
  return (
    <MenuFrame ctx={ctx} title={`SAMPLES · ${t.name}`} sub="synthesized one-shots (the twin ships no recordings)">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {SAMPLES.map((name, i) => (
          <SeqButton key={i} active={i === cur} color={C.white} minWidth={96} onPress={() => { ctx.setValue(`${t.id}_smp_slot`, i); ctx.setValue('page', PAGE.SMPL); ctx.sendEvent('pad', { track, vel: 100 }); setTimeout(() => ctx.sendEvent('pad:up', { track }), 300); }}>
            {i === 0 ? 'OFF' : `${String(i).padStart(2, '0')} ${name}`}
          </SeqButton>
        ))}
      </div>
    </MenuFrame>
  );
}

function TempoMenu({ ctx }: { ctx: CustomRenderContext }) {
  const p = projectOf(ctx);
  const pat = getPattern(p, p.active);
  const synced = !!(ctx.engine.seq as { following?: boolean } | undefined)?.following;
  return (
    <MenuFrame ctx={ctx} title="TEMPO" sub={synced ? 'following the studio clock' : undefined}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', fontFamily: FONT }}>
        <Stepper label="BPM" value={num(ctx.values.bpm, 120)} min={30} max={300} step={1} width={72} format={v => v.toFixed(1)} onChange={v => ctx.setValue('bpm', v)} />
        <Stepper label={`SWING (${p.active})`} value={pat.swing} min={50} max={80} format={v => `${v}%`} onChange={v => ctx.updateData(d => updatePatternSettings(asProject(d, T), p.active, { swing: v }))} />
        <TapTempo ctx={ctx} />
      </div>
      {synced && <div style={{ marginTop: 10, fontSize: 12, color: C.dim }}>Synced to the studio: the studio tempo drives the sequencer. Change it in the top bar.</div>}
    </MenuFrame>
  );
}

function TapTempo({ ctx }: { ctx: CustomRenderContext }) {
  const taps = useRef<number[]>([]);
  return (
    <SeqButton minWidth={90} height={44} onPress={() => {
      const now = performance.now();
      taps.current = [...taps.current.filter(t => now - t < 2500), now].slice(-5);
      if (taps.current.length >= 2) {
        const d = (taps.current[taps.current.length - 1] - taps.current[0]) / (taps.current.length - 1);
        ctx.setValue('bpm', Math.max(30, Math.min(300, Math.round(600000 / d) / 10)));
      }
    }}>TAP</SeqButton>
  );
}

/** RETRIG menu of the active track (shown while [RTRG] is held, manual p.41) */
function RetrigMenu({ ctx }: { ctx: CustomRenderContext }) {
  const track = Math.min(11, Math.round(num(ctx.values.track)));
  const t = TRACKS[track];
  const [rate, len, vcr, on] = RETRIG_MENU.map(p => `${t.id}_${p.key}`);
  const opts = RETRIG_MENU[0].options ?? [];
  return (
    <MenuFrame ctx={ctx} title={`RETRIG · ${t.name}`} sub="hold [RTRG] and a pad to roll; stored in the kit">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: FONT }}>
        <Group label="RETRIG (RATE)">
          {opts.map((o, i) => <SeqButton key={o} active={Math.round(num(ctx.values[rate], 9)) === i} color={C.white} onPress={() => ctx.setValue(rate, i)}>{o}</SeqButton>)}
        </Group>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Stepper label="LENGTH" value={num(ctx.values[len], 14)} min={0} max={127} width={78} format={v => LEN_TEXT(v)} onChange={v => ctx.setValue(len, v)} />
          <Stepper label="VEL. CURVE" value={num(ctx.values[vcr])} min={-128} max={127} onChange={v => ctx.setValue(vcr, v)} />
          <SeqButton active={num(ctx.values[on]) > 0} color={C.green} onPress={() => ctx.setValue(on, num(ctx.values[on]) > 0 ? 0 : 1)}>ALWAYS ON</SeqButton>
        </div>
      </div>
    </MenuFrame>
  );
}

function FixMenu({ ctx }: { ctx: CustomRenderContext }) {
  return (
    <MenuFrame ctx={ctx} title="FIXED VELOCITY">
      <Stepper label="VELOCITY" value={num(ctx.values.fix_vel, 100)} min={0} max={127} format={v => (v <= 0 ? 'AUTO' : `${v}`)} onChange={v => ctx.setValue('fix_vel', v)} />
      <div style={{ marginTop: 8, fontSize: 12, color: C.dim }}>With [FIX] on every pad hit plays at this velocity (AUTO: the track&apos;s VEL on the TRIG page). Off, tapping higher on a pad plays harder.</div>
    </MenuFrame>
  );
}

/** Scene / performance macro editor: while open, turning an encoder assigns that parameter */
function MacroEdit({ ctx, kind, index }: { ctx: CustomRenderContext; kind: 'scene' | 'perf'; index: number }) {
  const p = projectOf(ctx);
  const kid = kitOf(ctx);
  const macro = (kind === 'scene' ? p.kits?.[kid]?.scenes?.[index] : p.kits?.[kid]?.perfs?.[index]) ?? {};
  const entries = Object.entries(macro);
  const close = () => ctx.setUi({ sceneEdit: null, perfEdit: null });
  const remove = (id: string) => ctx.updateData(d => editMacro(asProject(d, T) as RytmProject, kid, kind, index, m => { const n = { ...m }; delete n[id]; return n; }));
  return (
    <Overlay portal portalSize={{ w: 560, h: 380 }}>
      <Frame title={`${kind === 'scene' ? 'SCENE' : 'PERFORMANCE'} ${index + 1} EDIT`} sub={`K${kid}`} onClose={close}>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, fontFamily: FONT, lineHeight: 1.4 }}>
          {kind === 'scene'
            ? 'Turn any encoder (any track, any page: [TRK] + pad picks the track, [FX] the FX track): the value is stored in the scene. Tap a pad to edit another scene; [SCNE] ends the edit.'
            : 'Turn any encoder: how far you turn it is the depth the macro adds at full pressure (shown as an offset). Tap a pad to edit another macro; [PERF] ends the edit.'}
          {` (${totalLocks(p, kid, kind)}/48 locks in this kit)`}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {entries.length === 0 && <span style={{ fontSize: 12, color: C.faint, fontFamily: FONT }}>No parameters yet.</span>}
          {entries.map(([id, v]) => {
            const d = describe(id, v);
            const pi = paramMeta(id);
            const tn = pi ? (pi.track === FX_TRACK ? 'FX' : TRACKS[pi.track].name) : '';
            const text = kind === 'perf' ? `${v > 0 ? '+' : ''}${Math.round(v)}` : d?.text ?? `${v}`;
            return <SeqButton key={id} onPress={() => remove(id)} title="Remove">{`${tn} ${d?.abbr ?? id} ${text} ✕`}</SeqButton>;
          })}
        </div>
      </Frame>
    </Overlay>
  );
}

/** Locks used by the kit's scenes or macros: 48 in all (manual pp.29-30) */
export function totalLocks(p: RytmProject, kid: string, kind: 'scene' | 'perf'): number {
  const list = (kind === 'scene' ? p.kits?.[kid]?.scenes : p.kits?.[kid]?.perfs) ?? [];
  return list.reduce((n, m) => n + Object.keys(m ?? {}).length, 0);
}

export function editMacro(p: RytmProject, kid: string, kind: 'scene' | 'perf', index: number, fn: (m: Record<string, number>) => Record<string, number>): RytmProject {
  const kits = { ...(p.kits ?? {}) };
  const k = { ...(kits[kid] ?? { name: `KIT ${kid}`, values: {} }) };
  const list = [...((kind === 'scene' ? k.scenes : k.perfs) ?? Array.from({ length: 12 }, () => ({})))];
  while (list.length < 12) list.push({});
  const before = Object.keys(list[index] ?? {}).length;
  const next = fn(list[index] ?? {});
  if (totalLocks(p, kid, kind) - before + Object.keys(next).length > 48) return p;
  list[index] = next;
  if (kind === 'scene') k.scenes = list; else k.perfs = list;
  kits[kid] = k;
  return { ...p, kits };
}

/** [TRK] held: the trig keys select tracks (13 = FX) */
function TrackSelect({ ctx }: { ctx: CustomRenderContext }) {
  const cur = Math.round(num(ctx.values.track));
  return (
    <Overlay portal portalPlacement="bottom" portalSize={{ w: 760, h: 120 }}>
      <Frame title="TRACK SELECT" sub="tap a track (13 = FX)" onClose={() => ctx.setUi({ trkLatch: false, trkHeld: false })}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[...TRACKS.map(t => t.name), 'FX'].map((n, i) => (
            <SeqButton key={n} active={cur === i} color={C.white} minWidth={44} onPress={() => { ctx.setValue('track', i); ctx.setUi({ trkLatch: false }); }}>{`${i + 1} ${n}`}</SeqButton>
          ))}
        </div>
      </Frame>
    </Overlay>
  );
}

// ----------------------------------------------------------------------------
// Track copy / clear / paste ([FUNC] + [REC] / [PLAY] / [STOP])
// ----------------------------------------------------------------------------

export function trackCopy(ctx: CustomRenderContext) {
  const p = projectOf(ctx);
  const track = Math.round(num(ctx.values.track));
  const tr = getPattern(p, p.active).tracks[track];
  ctx.setUi({ rytmClip: tr ? JSON.parse(JSON.stringify(tr)) : null });
  flash(ctx, `TRACK ${track + 1} COPIED`);
}
export function trackClear(ctx: CustomRenderContext) {
  const p = projectOf(ctx);
  const track = Math.round(num(ctx.values.track));
  ctx.updateData(d => clearTrack(asProject(d, T), p.active, track));
  flash(ctx, `TRACK ${track + 1} CLEARED`);
}
export function trackPaste(ctx: CustomRenderContext) {
  const clip = ctx.ui.rytmClip as Track | null | undefined;
  if (!clip) { flash(ctx, 'NOTHING TO PASTE'); return; }
  const p = projectOf(ctx);
  const track = Math.round(num(ctx.values.track));
  ctx.updateData(d => withTrack(asProject(d, T), p.active, track, () => JSON.parse(JSON.stringify(clip))));
  flash(ctx, `PASTED TO TRACK ${track + 1}`);
}

/** [FUNC] + arrows with trigs held: micro timing and retrig rate */
export function nudgeHeld(ctx: CustomRenderContext, what: 'micro' | 'retrig', dir: number) {
  const held = Array.isArray(ctx.ui.heldSteps) ? (ctx.ui.heldSteps as number[]) : [];
  if (!held.length) return false;
  const p = projectOf(ctx);
  const track = typeof ctx.ui.heldTrack === 'number' ? ctx.ui.heldTrack : Math.round(num(ctx.values.track));
  const pid = typeof ctx.ui.heldPattern === 'string' ? ctx.ui.heldPattern : p.active;
  ctx.updateData(d => {
    let q: Project = asProject(d, T);
    for (const s of held) {
      const cur = getPattern(q, pid).tracks[track]?.steps[s];
      if (!cur) continue;
      if (what === 'micro') {
        const m = Math.max(-23, Math.min(23, (cur.micro ?? 0) + dir));
        q = updateSteps(q, pid, track, [s], { micro: m || null });
      } else {
        const r = cur.retrig ? Math.max(-1, Math.min(16, cur.retrig.rate + dir)) : dir > 0 ? 9 : -1;
        q = updateSteps(q, pid, track, [s], { retrig: r < 0 ? null : { rate: r, len: cur.retrig?.len ?? 14, vel: cur.retrig?.vel ?? 0 } });
      }
    }
    return q;
  });
  ctx.setUi({ heldEdited: true });
  return true;
}

export { CHANGE_MODES, setChangeMode, setPlayMode, trackLength, filterHz, hzText };

void React;
