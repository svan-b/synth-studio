// ============================================================================
// Xone:96 panel layouts (all x/y in mm; controls centred on x/y, boxes top-left)
//
// FULL view: the hardware top panel, 336 x 410 mm (User Guide p.35) - channels
// A, B, 1-4 left to right, the master / booth / monitor column on the right,
// the two Xone:VCF sections either side of the crossfader at the bottom. The
// light-grey faceplate and black knobs with white lines follow the hardware
// (REFERENCE.md). A dark strip above the faceplate (twin only) holds the
// built-in decks, file loading, PLAY, tempo, YOU HEAR and the stand-in FX unit.
//
// COMPACT view (iPad landscape): the same controls rearranged into a wide
// 420 x 236 mm panel so the EQ, the faders and the crossfader fit on one
// screen. It is chosen automatically on touch screens and short windows, or
// with the COMPACT VIEW button (remembered in this browser).
//
// Meters, the bar display and the LEDs that follow the audio update themselves
// on animation frames from the engine's snapshot, so a moving meter never
// re-renders the panel.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ControlValue } from '@/types';
import type { CustomRenderContext, PanelElement, PanelLayout } from '@/types/panel';
import { useStudioStore } from '@/store/studio';
import { hub } from '@/lib/studio/hub';
import { transport } from '@/lib/audio/transport';
import { DEVICES } from '@/devices';
import {
  CHANNELS, type ChannelId, chName, isAux, CH_METER_DBU, CH_METER_LABELS, MASTER_METER_DBU, MASTER_METER_LABELS,
  SOURCE_NAMES, SOURCE_MENU, SRC, STUDIO_INPUTS, STUDIO_POSITION, TYPE_MASK, SIG_DBU, ARRANGEMENT_BARS,
} from './model';
import type { MeterSnapshot } from './engine';

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------

const K = 3; // px per mm
const INK = '#17191b';
const MUTED = '#3d4247';
const PRINT = '#4a5056';
const FACE = 'linear-gradient(180deg, #d3d6d9 0%, #c8cbcf 55%, #bec2c6 100%)';
const LINE = '1px solid #9aa0a6';
const KNOB = '#f4f4f4'; // white pointer line on the black caps
const LED_ON = (db: number) => (db >= 10 ? '#ff3b30' : db >= 3 ? '#ffb020' : '#2fd158');
const LED_OFF = '#2a2e32';

type Ctx = CustomRenderContext;
type KnobEl = Extract<PanelElement, { kind: 'knob' }>;

const knob = (control: string, x: number, y: number, diameter: number, extra: Partial<KnobEl> = {}): PanelElement => ({
  kind: 'knob', control, x, y, diameter, variant: 'moog-black', capColor: KNOB, value: 'hover', ...extra,
});
const label = (text: string, x: number, y: number, size = 7, extra: Partial<Extract<PanelElement, { kind: 'label' }>> = {}): PanelElement => ({
  kind: 'label', text, x, y, size, color: INK, ...extra,
});
const buttons = (control: string, x: number, y: number, scale = 1, extra: Partial<Extract<PanelElement, { kind: 'switch' }>> = {}): PanelElement => ({
  kind: 'switch', control, x, y, style: 'buttons', orientation: 'horizontal', scale, ...extra,
});
const push = (control: string, x: number, y: number, w: number, h: number, text: string, led: string, extra: Partial<Extract<PanelElement, { kind: 'button' }>> = {}): PanelElement => ({
  kind: 'button', control, x, y, shape: 'rect', w, h, color: '#26292c', ledColor: led, capText: text, label: 'none', ...extra,
});

// ---------------------------------------------------------------------------
// Animation-frame updates (meters, LEDs, the bar display)
// ---------------------------------------------------------------------------

const frameFns = new Set<() => void>();
let frameId = 0;
function frameLoop() {
  frameFns.forEach(f => { try { f(); } catch { /* keep the loop alive */ } });
  frameId = frameFns.size ? requestAnimationFrame(frameLoop) : 0;
}
function useFrame(fn: () => void) {
  useEffect(() => {
    frameFns.add(fn);
    if (!frameId && typeof requestAnimationFrame !== 'undefined') frameId = requestAnimationFrame(frameLoop);
    return () => { frameFns.delete(fn); };
  }, [fn]);
}

type XoneEngineLike = { meterSnapshot?: () => MeterSnapshot; position?: () => number };
const engineOf = (instance: string) => hub.getEngine(instance) as unknown as XoneEngineLike | undefined;

/** A vertical LED ladder. `k` is the engine's meter key (channel id, 'L', 'R'). */
function Ladder({ instance, k, steps, height, width, aria }: { instance: string; k: string; steps: number[]; height: number; width: number; aria: string }) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const last = useRef(-1);
  const update = useCallback(() => {
    const m = engineOf(instance)?.meterSnapshot?.().meters[k];
    const db = m ? m.db : -120;
    let lit = 0;
    for (const s of steps) if (db >= s) lit++;
    const code = lit * 2 + (m?.pk ? 1 : 0);
    if (code === last.current) return;
    last.current = code;
    refs.current.forEach((el, i) => {
      if (!el) return;
      const on = i < lit || (i === steps.length - 1 && !!m?.pk);
      const c = LED_ON(steps[i]);
      el.style.background = on ? c : LED_OFF;
      el.style.boxShadow = on ? `0 0 5px ${c}` : 'inset 0 1px 1px #000';
    });
  }, [instance, k, steps]);
  useFrame(update);
  const n = steps.length, seg = height / n;
  return (
    <div role="meter" aria-label={aria} style={{ position: 'relative', width, height, background: '#141618', borderRadius: 2, pointerEvents: 'none' }}>
      {steps.map((s, i) => (
        <div
          key={s}
          ref={el => { refs.current[i] = el; }}
          style={{ position: 'absolute', left: 1.5, right: 1.5, top: (n - 1 - i) * seg + 1.5, height: seg - 3, borderRadius: 1.5, background: LED_OFF, boxShadow: 'inset 0 1px 1px #000' }}
        />
      ))}
    </div>
  );
}

function ladderScale(labels: string[], height: number, align: 'left' | 'right', size = 6.5) {
  const n = labels.length, seg = height / n;
  return (
    <div style={{ position: 'relative', height, width: 16, pointerEvents: 'none' }}>
      {labels.map((l, i) => (
        <div
          key={l}
          style={{
            position: 'absolute', [align]: 0, top: (n - 1 - i + 0.5) * seg, transform: 'translateY(-50%)',
            fontSize: size, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap', color: l === 'PK!' ? '#c0261c' : MUTED,
          }}
        >
          {l}
        </div>
      ))}
    </div>
  );
}

const channelMeter = (ch: string, x: number, y: number, h: number, scale = true): PanelElement => ({
  kind: 'custom', x, y, w: scale ? 9 : 4, h,
  render: c => (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-start', pointerEvents: 'none' }}>
      <Ladder instance={c.instance} k={ch} steps={CH_METER_DBU} height={h * K} width={4 * K} aria={`Channel ${chName(ch)} meter`} />
      {scale && ladderScale(CH_METER_LABELS, h * K, 'left')}
    </div>
  ),
});

const lrMeters = (x: number, y: number, h: number): PanelElement => ({
  kind: 'custom', x, y, w: 30, h: h + 6,
  render: c => <LrMeters c={c} h={h} />,
});

function LrMeters({ c, h }: { c: Ctx; h: number }) {
  const split = !!c.values.split_cue;
  const cueOn = CHANNELS.some(ch => !!c.values[`ch${ch}_cue`]) || !!c.values.rtnc_cue || !!c.values.rtnd_cue;
  const hp = h * K;
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-start', pointerEvents: 'none' }} aria-label="LR MIX meters">
      {ladderScale(MASTER_METER_LABELS, hp, 'right')}
      {(['L', 'R'] as const).map(side => (
        <div key={side} style={{ position: 'relative' }}>
          <Ladder instance={c.instance} k={side} steps={MASTER_METER_DBU} height={hp} width={4.2 * K} aria={`${side} meter`} />
          <div style={{ position: 'absolute', top: hp + 2, left: '50%', transform: 'translateX(-50%)', fontSize: 6.5, fontWeight: 800, color: cueOn && (side === 'L' || !split) ? '#c0261c' : INK }}>
            {cueOn && (side === 'L' || !split) ? 'CUE' : side}
          </div>
        </div>
      ))}
    </div>
  );
}

/** An LED driven by the engine snapshot (RTN C/D SIG: green with signal, red near clipping) */
function SigLed({ instance, k }: { instance: string; k: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const last = useRef('');
  const update = useCallback(() => {
    const m = engineOf(instance)?.meterSnapshot?.().meters[k];
    const state = !m ? 'off' : m.pk ? 'red' : m.db >= SIG_DBU ? 'green' : 'off';
    if (state === last.current || !ref.current) return;
    last.current = state;
    const c = state === 'red' ? '#ff3b30' : state === 'green' ? '#2fd158' : LED_OFF;
    ref.current.style.background = c;
    ref.current.style.boxShadow = state === 'off' ? 'inset 0 1px 1px #000' : `0 0 6px ${c}`;
  }, [instance, k]);
  useFrame(update);
  return <div ref={ref} aria-hidden style={{ width: 2.4 * K, height: 2.4 * K, borderRadius: '50%', background: LED_OFF, pointerEvents: 'none' }} />;
}

const sigLed = (k: string, x: number, y: number): PanelElement => ({
  kind: 'custom', x: x - 1.2, y: y - 1.2, w: 2.4, h: 2.4, render: c => <SigLed instance={c.instance} k={k} />,
});

// ---------------------------------------------------------------------------
// Printed scale marks: the knob component draws light ticks for dark panels,
// so the faceplate gets its own dark ones (one SVG for the whole panel).
// ---------------------------------------------------------------------------

function scaleMarks(elements: PanelElement[], w: number, h: number, y0: number): PanelElement {
  const knobs = elements.filter((e): e is KnobEl => e.kind === 'knob' && e.y >= y0);
  return {
    kind: 'custom', x: 0, y: 0, w, h,
    render: () => (
      <svg width={w * K} height={h * K} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} aria-hidden>
        {knobs.map((kn, i) => {
          const d = (kn.diameter ?? 12) * K;
          const r0 = d / 2 + 3, r1 = r0 + (d >= 40 ? 4 : 3);
          const n = d >= 45 ? 11 : 9;
          const cx = kn.x * K, cy = kn.y * K;
          return (
            <g key={i} stroke={PRINT} strokeLinecap="round">
              {Array.from({ length: n }, (_, j) => {
                const a = ((-135 + (j * 270) / (n - 1)) * Math.PI) / 180;
                const end = j === 0 || j === n - 1;
                const ri = end ? r0 - 1 : r0;
                return <line key={j} x1={cx + Math.sin(a) * ri} y1={cy - Math.cos(a) * ri} x2={cx + Math.sin(a) * r1} y2={cy - Math.cos(a) * r1} strokeWidth={end ? 1.6 : 1} />;
              })}
            </g>
          );
        })}
      </svg>
    ),
  };
}

// ---------------------------------------------------------------------------
// Studio routing: which instruments feed each channel
// ---------------------------------------------------------------------------

const INPUT_OF: Record<string, string> = Object.fromEntries(STUDIO_INPUTS.map(s => [s.ch, s.id]));

function instanceName(id: string, rack: { id: string; device: string; label?: string }[]): string {
  const r = rack.find(x => x.id === id);
  if (!r) return id;
  const entry = DEVICES.find(d => d.id === r.device);
  return r.label ?? (r.id.includes('#') ? `${entry?.name ?? r.device} ${r.id.split('#')[1]}` : entry?.name ?? r.device);
}

/** Names of the studio instruments routed into a channel of this Xone */
function useRoutedNames(instance: string, ch: string): string[] {
  const routes = useStudioStore(s => s.studio.routes);
  const rack = useStudioStore(s => s.studio.rack);
  const off = useStudioStore(s => s.studio.off);
  const target = `${instance}:${INPUT_OF[ch]}`;
  return Object.entries(routes)
    .filter(([inst, r]) => r === target && rack.some(x => x.id === inst))
    .map(([inst]) => `${instanceName(inst, rack)}${off?.[inst] ? ' (off)' : ''}`);
}

function StudioChip({ c, ch, w }: { c: Ctx; ch: ChannelId | 'c' | 'd'; w: number }) {
  const names = useRoutedNames(c.instance, ch);
  if (!names.length) return null;
  const onInput = ch === 'c' || ch === 'd' || Number(c.values[`ch${ch}_input`] ?? 2) === STUDIO_POSITION;
  const text = `STUDIO: ${names.join(' + ')}`;
  return (
    <div
      title={onInput ? `${text} - routed into this channel` : `${text} - on the ${isAux(ch) ? 'RTN' : 'LINE'} input, but INPUT is set elsewhere`}
      style={{
        width: w * K, boxSizing: 'border-box', padding: '1px 3px', borderRadius: 3, fontSize: 7, fontWeight: 800, lineHeight: 1.25,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center', pointerEvents: 'auto',
        background: onInput ? '#0f5132' : '#6b4a00', color: '#fff', border: `1px solid ${onInput ? '#1f8a56' : '#c08a00'}`,
      }}
    >
      {onInput ? text : `${text} · set INPUT to ${isAux(ch) ? 'RTN' : 'LINE'}`}
    </div>
  );
}

const studioChip = (ch: ChannelId | 'c' | 'd', x: number, y: number, w: number): PanelElement => ({
  kind: 'custom', x: x - w / 2, y, w, h: 4.5, render: c => <StudioChip c={c} ch={ch} w={w} />,
});

// ---------------------------------------------------------------------------
// Deck strip (twin only): source menu, file loader, what the channel hears
// ---------------------------------------------------------------------------

function hearsText(ch: ChannelId, values: Record<string, ControlValue>, files: Record<string, string>, studio: string[]): string {
  const input = Number(values[`ch${ch}_input`] ?? 2);
  if (input === 0 || input === 3) return files[ch] ? `USB: ${files[ch]}` : 'USB: load a file';
  if (input === STUDIO_POSITION && studio.length) return `STUDIO: ${studio.join(' + ')}`;
  if (isAux(ch) && input === 2) return ch === 'a' ? 'RTN: delay (SEND 1)' : 'RTN: reverb (SEND 2)';
  const src = Number(values[`ch${ch}_src`] ?? SRC.NONE);
  const via = isAux(ch) ? 'MIC' : input === 1 ? 'PHONO' : 'LINE';
  return src === SRC.NONE ? `${via}: no deck` : `${via}: ${SOURCE_NAMES[src]}`;
}

function DeckColumn({ c, ch, w, compact }: { c: Ctx; ch: ChannelId; w: number; compact: boolean }) {
  const files = (c.engine.files ?? {}) as Record<string, string>;
  const studio = useRoutedNames(c.instance, ch);
  const src = Number(c.values[`ch${ch}_src`] ?? SRC.NONE);
  const status = hearsText(ch, c.values, files, studio);
  const isStudio = status.startsWith('STUDIO');
  const focus = c.teaching && c.step?.control === `ch${ch}_src`;
  return (
    <div style={{ width: w * K, display: 'flex', flexDirection: 'column', gap: compact ? 2 : 3 }}>
      {!compact && <div style={{ fontSize: 8, fontWeight: 800, color: '#8fd3ff', letterSpacing: 0.5 }}>DECK → CH {chName(ch)}</div>}
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <select
          aria-label={`Deck source for channel ${chName(ch)}`}
          value={src}
          onChange={e => c.setValue(`ch${ch}_src`, Number(e.target.value))}
          style={{
            flex: 1, minWidth: 0, fontSize: compact ? 10 : 11, height: compact ? 22 : 24, background: '#101418', color: '#fff',
            border: `1px solid ${focus ? '#f97316' : '#3b4652'}`, boxShadow: focus ? '0 0 8px #f97316' : undefined, borderRadius: 4, padding: '0 3px',
            touchAction: 'manipulation',
          }}
        >
          {SOURCE_MENU.map(i => <option key={i} value={i}>{SOURCE_NAMES[i]}</option>)}
        </select>
        <label
          style={{ fontSize: 8.5, fontWeight: 800, color: '#dfe6ec', background: '#24303b', border: '1px solid #3b4652', borderRadius: 4, padding: compact ? '4px 4px' : '5px 6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          title="Load your own audio file: it loops on this channel's USB input"
        >
          {compact ? 'FILE' : 'LOAD FILE'}
          <input
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) { c.sendEvent(`load:${ch}`, f); c.setValue(`ch${ch}_input`, 0); }
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <div
        style={{ fontSize: 8.5, fontWeight: 700, color: isStudio ? '#7ef0a8' : '#b9c8d6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={status}
      >
        {!isStudio && <span style={{ color: '#6f8090' }}>hears </span>}{status}
      </div>
    </div>
  );
}

/** Bar / phrase display, updated on animation frames */
function DeckDisplay({ c, compact }: { c: Ctx; compact: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const last = useRef('');
  const synced = !!c.engine.synced;
  const bpm = synced ? transport.bpm : Number(c.values.bpm ?? 124);
  const update = useCallback(() => {
    const n = engineOf(c.instance)?.position?.() ?? -1;
    const playing = n >= 0;
    const bar = playing ? Math.floor(n / 16) % ARRANGEMENT_BARS : -1;
    const beat = playing ? Math.floor((n % 16) / 4) + 1 : 0;
    const lines = [
      `${playing ? '▶' : '■'} ${Math.round(bpm * 10) / 10} BPM${synced ? ' · STUDIO' : ''}`,
      playing ? `BAR ${String(bar + 1).padStart(2, '0')}/32 · BEAT ${beat}` : 'BAR --/32',
      playing ? `PHRASE ${Math.floor(bar / 8) + 1}/4 · ${(bar % 8) + 1} of 8` : synced ? 'STUDIO ▶ PLAYS' : 'PLAY / SPACE',
    ];
    const text = compact ? lines.slice(0, 2).join('\n') : lines.join('\n');
    if (text !== last.current && ref.current) { last.current = text; ref.current.textContent = text; }
  }, [c.instance, bpm, synced, compact]);
  useFrame(update);
  return (
    <div
      ref={ref}
      aria-live="off"
      style={{
        width: '100%', height: '100%', boxSizing: 'border-box', background: '#050805', color: '#e8f0ff', border: '2px solid #222', borderRadius: 3,
        padding: '3px 5px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: compact ? 8.5 : 9, lineHeight: 1.3, whiteSpace: 'pre',
        textShadow: '0 0 3px rgba(200,220,255,0.6)', overflow: 'hidden', pointerEvents: 'none',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// View preference: AUTO picks compact on touch screens and short windows
// ---------------------------------------------------------------------------

type View = 'auto' | 'full' | 'compact';
const VIEW_KEY = 'xone96-view';
let viewPref: View = 'auto';
try {
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'full' || v === 'compact') viewPref = v;
  }
} catch { /* private mode */ }

export function isCompact(): boolean {
  if (viewPref !== 'auto') return viewPref === 'compact';
  if (typeof window === 'undefined') return false;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return coarse || window.innerHeight < 860;
}

function ViewToggle({ c, compact }: { c: Ctx; compact: boolean }) {
  const [, force] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        viewPref = compact ? 'full' : 'compact';
        try { localStorage.setItem(VIEW_KEY, viewPref); } catch { /* */ }
        c.setUi({ view: viewPref });
        force(n => n + 1);
      }}
      aria-pressed={compact}
      title={compact ? 'Back to the full hardware layout' : 'Compact view: EQ, faders and crossfader on one screen (iPad landscape)'}
      style={{
        fontSize: 8, fontWeight: 800, letterSpacing: 0.4, padding: '2px 6px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap',
        border: `1px solid ${compact ? '#38bdf8' : '#3b4652'}`, background: compact ? '#0c4a6e' : '#1a222b', color: compact ? '#e0f2fe' : '#b9c8d6',
      }}
    >
      {compact ? '▣ COMPACT VIEW' : '▢ COMPACT VIEW'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Shared builders
// ---------------------------------------------------------------------------

/** Filter type switches: tap one to select it; press two together to combine (lit by mask) */
function typeButtons(f: 1 | 2, x0: number, y: number, pitch: number, w: number, h: number): PanelElement[] {
  return (['HPF', 'BPF', 'LPF'] as const).map((t, i): PanelElement => ({
    kind: 'button', control: `f${f}_type`, setValue: i, x: x0 + i * pitch, y, shape: 'rect', w, h,
    color: '#26292c', ledColor: '#ff5a3c', capText: t, label: 'none',
    lit: ({ values }) => ((TYPE_MASK[Number(values[`f${f}_type`] ?? 0)] ?? 0) & (1 << i)) !== 0,
  }));
}

const crunchLed = (f: 1 | 2, x: number, y: number): PanelElement => ({
  kind: 'led', x, y, size: 2.6, color: '#ff3b30',
  on: ({ values }) => (values[`f${f}_on`] ? Math.min(1, Number(values[`f${f}_crunch`] ?? 0) / 6) : 0),
});

const cueLed = (x: number, y: number): PanelElement => ({
  kind: 'led', x, y, size: 3, color: '#ff3b30',
  on: ({ values }) => CHANNELS.some(c => !!values[`ch${c}_cue`]) || !!values.rtnc_cue || !!values.rtnd_cue,
});

const faderScale = (cx: number, top: number, len: number, size = 6): PanelElement[] =>
  [10, 8, 6, 4, 2, 0].map(v => label(String(v), cx - 9.5, top + (1 - v / 10) * len, size, { color: MUTED, align: 'right' }));

// ============================================================================
// FULL view
// ============================================================================

const DECK_H = 50;
const MY = DECK_H;
const W = 336;
const H = DECK_H + 410;
const CX: Record<ChannelId, number> = { a: 23, b: 64, '1': 105, '2': 146, '3': 187, '4': 228 };
const MX0 = 250; // master column left edge

function fullStrip(ch: ChannelId): PanelElement[] {
  const cx = CX[ch];
  const p = `ch${ch}_`;
  const aux = isAux(ch);
  const kx = cx - 6;
  const els: PanelElement[] = [
    studioChip(ch, cx, MY + 3, 38),
    buttons(`${p}input`, cx, MY + 14, 0.95),
    knob(`${p}gain`, kx, MY + 30, 11),
    knob(`${p}hi`, kx, MY + 48, 10.5),
    ...(aux
      ? [knob(`${p}midf`, kx, MY + 65, 9.5), knob(`${p}mid`, kx, MY + 82, 10.5)]
      : [knob(`${p}himid`, kx, MY + 65, 10.5), knob(`${p}lomid`, kx, MY + 82, 10.5)]),
    knob(`${p}lo`, kx, MY + 99, 10.5),
    channelMeter(ch, cx + 5.5, MY + 37, 68),
    buttons(`${p}filter`, cx, MY + 133, 1.25),
    buttons(`${p}xf`, cx, MY + 146, 1.25),
    push(`${p}cue`, cx, MY + 159, 15, 7, 'CUE', '#ff3b30'),
    { kind: 'slider', control: `${p}fader`, x: cx, y: MY + 200, length: 60, capColor: '#1d1f21', label: 'none', value: 'hover' },
    ...faderScale(cx, MY + 170, 60),
    label(chName(ch), cx, MY + 240, 15, { weight: 900 }),
  ];
  if (aux) {
    els.push(label(ch === 'a' ? 'RTN A = SEND 1 RETURN' : 'RTN B = SEND 2 RETURN', cx, MY + 116, 5.5, { color: MUTED }));
  } else {
    els.push(knob(`${p}snd1`, cx - 9, MY + 119, 8.5, { labelText: 'SEND 1' }));
    els.push(knob(`${p}snd2`, cx + 9, MY + 119, 8.5, { labelText: 'SEND 2' }));
  }
  return els;
}

function fullFilter(f: 1 | 2): PanelElement[] {
  // FILTER 1 left of the crossfader, FILTER 2 mirrored on the right
  const x0 = f === 1 ? 4 : 160;
  const X = (x: number) => (f === 1 ? x0 + x : x0 + 88 - x);
  const p = `f${f}_`;
  const top = MY + 252;
  return [
    { kind: 'section', x: x0, y: top, w: 88, h: 92, border: LINE, radius: 2, title: `FILTER ${f}`, titleColor: INK, background: 'rgba(255,255,255,0.12)' },
    push(`${p}on`, X(14), top + 12, 13, 7, 'ON', '#3b9dff'),
    ...typeButtons(f, f === 1 ? X(34) : X(34) - 26, top + 12, 13, 11.5, 7),
    label('TYPE', f === 1 ? X(47) : X(47) - 0, top + 5.5, 6, { color: MUTED }),
    knob(`${p}freq`, X(66), top + 45, 18, { labelText: 'FREQ' }),
    knob(`${p}res`, X(18), top + 47, 11.5),
    label('MILD', X(18) - 8, top + 59, 5.5, { color: MUTED }),
    label('WILD', X(18) + 8, top + 59, 5.5, { color: MUTED }),
    knob(`${p}crunch`, X(18), top + 76, 11.5),
    crunchLed(f, X(30), top + 70),
    label('20 Hz', X(66) - 12, top + 61, 5.5, { color: MUTED }),
    label('20 kHz', X(66) + 12, top + 61, 5.5, { color: MUTED }),
  ];
}

function fullMaster(): PanelElement[] {
  const c0 = MX0, cx = MX0 + 42;
  return [
    { kind: 'section', x: c0, y: MY + 2, w: 84, h: 244, border: LINE, radius: 2 },
    label('LR MIX', c0 + 17, MY + 7, 6.5, { color: MUTED }),
    lrMeters(c0 + 3, MY + 11, 66),
    label('CUE', c0 + 43, MY + 8, 6, { color: MUTED }),
    cueLed(c0 + 43, MY + 13),
    knob('master', cx + 22, MY + 25, 15),
    knob('booth', cx + 22, MY + 55, 11),
    push('booth_mono', c0 + 52, MY + 72, 13, 6.5, 'MONO', '#ffb020'),
    push('booth_mute', c0 + 70, MY + 72, 13, 6.5, 'MUTE', '#ff3b30'),
    label('BOOTH EQ', cx, MY + 82, 6, { color: MUTED }),
    knob('booth_hi', c0 + 16, MY + 94, 8.5),
    knob('booth_mid', cx, MY + 94, 8.5),
    knob('booth_lo', c0 + 68, MY + 94, 8.5),
    // RTN C / RTN D
    { kind: 'section', x: c0 + 3, y: MY + 106, w: 78, h: 47, border: LINE, radius: 2, title: 'RETURNS', titleColor: INK, background: 'rgba(255,255,255,0.1)' },
    ...(['c', 'd'] as const).flatMap((r, i): PanelElement[] => {
      const x = c0 + 21 + i * 42;
      return [
        studioChip(r, x, MY + 109, 34),
        knob(`rtn${r}_level`, x - 5, MY + 126, 9, { labelText: `RTN ${r.toUpperCase()}` }),
        sigLed(r, x + 8, MY + 121),
        label('SIG', x + 8, MY + 117, 5, { color: MUTED }),
        push(`rtn${r}_on`, x - 7, MY + 144, 11, 6, 'ON', '#34d058'),
        push(`rtn${r}_cue`, x + 7, MY + 144, 11, 6, 'CUE', '#ff3b30'),
      ];
    }),
    // MONITOR (headphones)
    { kind: 'section', x: c0 + 3, y: MY + 158, w: 78, h: 54, border: LINE, radius: 2, title: 'MONITOR', titleColor: INK, background: 'rgba(255,255,255,0.1)' },
    knob('cue_mix', c0 + 20, MY + 176, 10.5),
    label('CUE ← → MST', c0 + 20, MY + 186.5, 5, { color: MUTED }),
    knob('phones', c0 + 64, MY + 176, 11.5),
    push('split_cue', c0 + 20, MY + 200, 20, 7, 'SPLIT CUE', '#ff3b30'),
    push('cue_post_eq', c0 + 64, MY + 200, 18, 7, 'POST EQ', '#ffb020'),
    buttons('send1_pre', c0 + 22, MY + 226, 1.1),
    label('SEND 2: POST', c0 + 62, MY + 226, 6, { color: MUTED }),
    buttons('fader_curve', cx, MY + 240, 1.0),
    label('XONE:96', cx, MY + 290, 23, { weight: 900, letterSpacing: 1, font: 'condensed' }),
    label('ANALOGUE DJ MIXER', cx, MY + 303, 6, { color: MUTED, letterSpacing: 1.5 }),
    label('6 + 2 CHANNELS · DUAL XONE:VCF', cx, MY + 310, 5.5, { color: MUTED, letterSpacing: 0.8 }),
  ];
}

function deckStripFull(): PanelElement[] {
  const deckCol = (ch: ChannelId): PanelElement => ({
    kind: 'custom', x: CX[ch] - 19.5, y: 6, w: 39, h: 32,
    render: c => <DeckColumn c={c} ch={ch} w={38} compact={false} />,
  });
  return [
    { kind: 'section', x: 1.5, y: 1.5, w: W - 3, h: DECK_H - 4, background: '#0f1316', border: '1px solid #26313b', radius: 2, title: 'BUILT-IN DECKS · TWIN ONLY, NOT PART OF THE MIXER', titleColor: '#8fd3ff' },
    ...CHANNELS.map(deckCol),
    { kind: 'custom', x: 4, y: 40, w: 40, h: 6, render: c => <ViewToggle c={c} compact={false} /> },
    { kind: 'button', control: 'play', x: 259, y: 13, shape: 'round', w: 11, color: '#13261a', ledColor: '#22c55e', capText: 'PLAY', label: 'none', lit: ({ engine, values }) => (engine.synced ? !!engine.playing : !!values.play) },
    knob('bpm', 275, 14, 8, { value: 'always', label: 'above', variant: 'moog-black' }),
    { kind: 'custom', x: 285, y: 5, w: 48, h: 17, render: c => <DeckDisplay c={c} compact={false} /> },
    buttons('monitor_out', 296, 29, 0.9, { labelText: 'YOU HEAR (TWIN)' }),
    label('STAND-IN FX UNIT', 268, 37, 5.5, { color: '#8fd3ff' }),
    buttons('fx_time', 268, 43, 0.85, { label: 'none' }),
    knob('fx_fdbk', 303, 42, 7),
    knob('fx_size', 323, 42, 7),
  ];
}

function buildFull(): PanelLayout {
  const elements: PanelElement[] = [
    ...deckStripFull(),
    // faceplate
    { kind: 'section', x: 0, y: MY, w: W, h: 410, background: FACE, radius: 3 },
    ...CHANNELS.map((ch): PanelElement => ({ kind: 'section', x: CX[ch] - 20, y: MY + 2, w: 40, h: 244, border: LINE, radius: 2 })),
    ...CHANNELS.flatMap(fullStrip),
    ...fullMaster(),
    ...fullFilter(1),
    ...fullFilter(2),
    buttons('xf_curve', 126, MY + 262, 1.05),
    { kind: 'slider', control: 'xfader', x: 126, y: MY + 300, length: 45, orientation: 'horizontal', capColor: '#1d1f21', label: 'none', value: 'hover' },
    label('X', 97, MY + 300, 11, { weight: 900 }),
    label('Y', 155, MY + 300, 11, { weight: 900 }),
    label('CROSSFADER', 126, MY + 314, 6.5, { color: MUTED }),
    label('innoFADER', 126, MY + 321, 5.5, { color: MUTED, italic: true }),
    // front lip
    { kind: 'section', x: 0, y: MY + 352, w: W, h: 58, background: 'linear-gradient(180deg, #b4b8bc 0%, #9fa4a9 100%)', radius: 3 },
    label('ALLEN&HEATH', 20, MY + 381, 16, { align: 'left', weight: 800, letterSpacing: 1.5 }),
    label('XONE SERIES', W - 16, MY + 381, 8, { align: 'right', color: MUTED, letterSpacing: 3 }),
  ];
  return {
    width: W,
    height: H,
    pxPerMm: K,
    theme: { background: '#0c0d0e', text: INK, muted: MUTED, font: '"Helvetica Neue", Helvetica, Arial, sans-serif', frame: { padding: 2, background: '#0c0d0e', radius: 3 } },
    elements: [scaleMarks(elements, W, H, MY), ...elements],
  };
}

// ============================================================================
// COMPACT view (iPad landscape)
// ============================================================================

const CW = 420;
const CH = 236;
const TOP = 28;          // top of the channel strips
const CCX: Record<ChannelId, number> = { a: 22, b: 62, '1': 102, '2': 142, '3': 182, '4': 222 };
const CM0 = 244;         // master column
const CF0 = 332;         // filter column

function compactStrip(ch: ChannelId): PanelElement[] {
  const cx = CCX[ch];
  const p = `ch${ch}_`;
  const aux = isAux(ch);
  const l = cx - 10, r = cx + 4;
  const y = (row: number) => TOP + 21 + row * 13.5;
  const els: PanelElement[] = [
    { kind: 'section', x: cx - 19.5, y: TOP, w: 39, h: 164, border: LINE, radius: 2 },
    studioChip(ch, cx, TOP + 2, 37),
    buttons(`${p}input`, cx, TOP + 11, 0.85),
    knob(`${p}gain`, l, y(0), 9.5),
    knob(`${p}hi`, r, y(0), 9.5),
    ...(aux
      ? [knob(`${p}midf`, l, y(1), 9), knob(`${p}mid`, r, y(1), 9.5)]
      : [knob(`${p}himid`, l, y(1), 9.5), knob(`${p}lomid`, r, y(1), 9.5)]),
    knob(`${p}lo`, l, y(2), 9.5),
    channelMeter(ch, cx + 12.5, TOP + 15, 43, false),
    buttons(`${p}filter`, cx - 2.5, TOP + 77, 1.1),
    buttons(`${p}xf`, cx - 2.5, TOP + 88, 1.1),
    push(`${p}cue`, cx + 13, TOP + 82.5, 10, 13, 'CUE', '#ff3b30'),
    { kind: 'slider', control: `${p}fader`, x: cx, y: TOP + 124, length: 46, capColor: '#1d1f21', label: 'none', value: 'hover' },
    ...faderScale(cx, TOP + 101, 46, 5.5),
    label(chName(ch), cx, TOP + 159, 11, { weight: 900 }),
  ];
  if (aux) els.push(label(ch === 'a' ? 'RTN A ← SEND 1' : 'RTN B ← SEND 2', r, y(2), 5.5, { color: MUTED }));
  else {
    els.push(knob(`${p}snd1`, r, y(2), 8.5, { labelText: 'SEND 1' }));
    els.push(knob(`${p}snd2`, r, y(3), 8.5, { labelText: 'SEND 2' }));
  }
  return els;
}

function compactMaster(): PanelElement[] {
  const x0 = CM0;
  return [
    { kind: 'section', x: x0, y: TOP, w: 86, h: 206, border: LINE, radius: 2 },
    label('LR MIX', x0 + 15, TOP + 4.5, 6, { color: MUTED }),
    lrMeters(x0 + 2, TOP + 8, 50),
    label('CUE', x0 + 39, TOP + 5, 5.5, { color: MUTED }),
    cueLed(x0 + 39, TOP + 9.5),
    knob('master', x0 + 56, TOP + 15, 12),
    knob('booth', x0 + 77, TOP + 15, 9),
    push('booth_mono', x0 + 56, TOP + 30, 12, 6, 'MONO', '#ffb020'),
    push('booth_mute', x0 + 74, TOP + 30, 12, 6, 'MUTE', '#ff3b30'),
    knob('booth_hi', x0 + 50, TOP + 46, 7.5),
    knob('booth_mid', x0 + 64, TOP + 46, 7.5),
    knob('booth_lo', x0 + 78, TOP + 46, 7.5),
    label('BOOTH EQ', x0 + 64, TOP + 54.5, 5, { color: MUTED }),
    // returns
    ...(['c', 'd'] as const).flatMap((rr, i): PanelElement[] => {
      const x = x0 + 21 + i * 43;
      return [
        studioChip(rr, x, TOP + 69, 36),
        knob(`rtn${rr}_level`, x - 8, TOP + 84, 8.5, { labelText: `RTN ${rr.toUpperCase()}` }),
        sigLed(rr, x + 4, TOP + 80),
        push(`rtn${rr}_cue`, x + 8, TOP + 79, 9, 6, 'CUE', '#ff3b30'),
        push(`rtn${rr}_on`, x + 8, TOP + 88, 9, 6, 'ON', '#34d058'),
      ];
    }),
    // monitor
    label('MONITOR', x0 + 43, TOP + 100, 6, { color: INK }),
    knob('cue_mix', x0 + 15, TOP + 113, 9),
    knob('phones', x0 + 43, TOP + 113, 10),
    buttons('send1_pre', x0 + 72, TOP + 110, 1.0),
    label('SEND 2: POST', x0 + 72, TOP + 119, 5, { color: MUTED }),
    push('split_cue', x0 + 17, TOP + 129, 20, 6.5, 'SPLIT CUE', '#ff3b30'),
    push('cue_post_eq', x0 + 45, TOP + 129, 18, 6.5, 'POST EQ', '#ffb020'),
    buttons('fader_curve', x0 + 43, TOP + 148, 0.95),
    label('XONE:96', x0 + 43, TOP + 178, 17, { weight: 900, letterSpacing: 1, font: 'condensed' }),
    label('COMPACT VIEW', x0 + 43, TOP + 189, 6, { color: MUTED, letterSpacing: 1.2 }),
  ];
}

function compactFilter(f: 1 | 2): PanelElement[] {
  const y0 = TOP + (f === 1 ? 0 : 104);
  const x0 = CF0;
  const p = `f${f}_`;
  return [
    { kind: 'section', x: x0, y: y0, w: 86, h: 100, border: LINE, radius: 2, title: `FILTER ${f}`, titleColor: INK, background: 'rgba(255,255,255,0.12)' },
    push(`${p}on`, x0 + 11, y0 + 10, 12, 7, 'ON', '#3b9dff'),
    ...typeButtons(f, x0 + 35, y0 + 10, 13, 11.5, 7),
    knob(`${p}freq`, x0 + 57, y0 + 45, 17, { labelText: 'FREQ' }),
    knob(`${p}res`, x0 + 14, y0 + 37, 10),
    knob(`${p}crunch`, x0 + 14, y0 + 66, 10),
    crunchLed(f, x0 + 25, y0 + 60),
    label('MILD ← → WILD', x0 + 14, y0 + 47.5, 5, { color: MUTED }),
    label('20 Hz', x0 + 45, y0 + 61, 5, { color: MUTED }),
    label('20 kHz', x0 + 69, y0 + 61, 5, { color: MUTED }),
  ];
}

function deckStripCompact(): PanelElement[] {
  const deckCol = (ch: ChannelId): PanelElement => ({
    kind: 'custom', x: CCX[ch] - 19.5, y: 4, w: 39, h: 18,
    render: c => <DeckColumn c={c} ch={ch} w={38} compact />,
  });
  return [
    { kind: 'section', x: 1, y: 1, w: CW - 2, h: 25, background: '#0f1316', border: '1px solid #26313b', radius: 2, title: 'BUILT-IN DECKS · TWIN ONLY', titleColor: '#8fd3ff' },
    ...CHANNELS.map(deckCol),
    { kind: 'button', control: 'play', x: 251, y: 13, shape: 'round', w: 10, color: '#13261a', ledColor: '#22c55e', capText: 'PLAY', label: 'none', lit: ({ engine, values }) => (engine.synced ? !!engine.playing : !!values.play) },
    knob('bpm', 265, 15, 7, { value: 'always', label: 'above' }),
    { kind: 'custom', x: 273, y: 4, w: 44, h: 13, render: c => <DeckDisplay c={c} compact /> },
    buttons('monitor_out', 297, 21.5, 0.75, { label: 'none' }),
    label('YOU HEAR', 280, 21.5, 5, { color: '#8fd3ff', align: 'right' }),
    buttons('fx_time', 337, 9, 0.75, { labelText: 'FX DELAY' }),
    knob('fx_fdbk', 361, 13, 6.5),
    knob('fx_size', 379, 13, 6.5),
    { kind: 'custom', x: 389, y: 4, w: 30, h: 6, render: c => <ViewToggle c={c} compact /> },
  ];
}

function buildCompact(): PanelLayout {
  const elements: PanelElement[] = [
    ...deckStripCompact(),
    { kind: 'section', x: 0, y: TOP - 1, w: CW, h: CH - TOP + 1, background: FACE, radius: 3 },
    ...CHANNELS.flatMap(compactStrip),
    ...compactMaster(),
    ...compactFilter(1),
    ...compactFilter(2),
    // crossfader row under the channel strips
    { kind: 'section', x: 2, y: TOP + 167, w: 240, h: 39, border: LINE, radius: 2 },
    buttons('xf_curve', 40, TOP + 186, 1.0),
    { kind: 'slider', control: 'xfader', x: 142, y: TOP + 185, length: 45, orientation: 'horizontal', capColor: '#1d1f21', label: 'none', value: 'hover' },
    label('X', 113, TOP + 185, 10, { weight: 900 }),
    label('Y', 171, TOP + 185, 10, { weight: 900 }),
    label('CROSSFADER', 142, TOP + 199, 6, { color: MUTED }),
    label('ALLEN&HEATH', 236, TOP + 199, 8, { align: 'right', weight: 800, letterSpacing: 1 }),
  ];
  return {
    width: CW,
    height: CH,
    pxPerMm: K,
    theme: { background: '#0c0d0e', text: INK, muted: MUTED, font: '"Helvetica Neue", Helvetica, Arial, sans-serif', frame: { padding: 2, background: '#0c0d0e', radius: 3 } },
    elements: [scaleMarks(elements, CW, CH, TOP), ...elements],
  };
}

export const XONE96_LAYOUT_FULL = buildFull();
export const XONE96_LAYOUT_COMPACT = buildCompact();

/** The layout to show now (DeviceModule.layout is a getter that calls this) */
export function currentLayout(): PanelLayout {
  return isCompact() ? XONE96_LAYOUT_COMPACT : XONE96_LAYOUT_FULL;
}
