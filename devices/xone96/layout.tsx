// ============================================================================
// Xone:96 panel layouts (all x/y in mm; controls centred on x/y, boxes top-left)
//
// FULL view: the hardware top panel, 339 mm wide (Xone:96 User Guide p.37),
// with every control where the guide's top-panel overview (p.7) puts it:
// channels A and B on the left, then the RTN C/D returns above FILTER 1,
// channels 1-4, the LR MIX meters above FILTER 2, and the master / booth /
// monitor column on the right; the crossfader under channels 1-4 and PHONES 2
// under A and B. Positions were measured from that drawing; the drawing
// itself is not reproduced. A dark strip above the faceplate (twin only)
// holds the built-in decks, file loading, PLAY, tempo, YOU HEAR, LATCH CUE
// and the stand-in FX unit.
//
// COMPACT view (iPad landscape): the same controls in the same left-to-right
// order, folded into a wide 372 x 236 mm panel so the EQ, the faders and the
// crossfader fit on one screen. It is chosen automatically on touch screens
// and short windows, or with the COMPACT VIEW button (remembered here).
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
  SOURCE_NAMES, SOURCE_MENU, SRC, STUDIO_INPUTS, STUDIO_POSITION, TYPE_MASK, SIG_DBU, ARRANGEMENT_BARS, meterColor,
  PHONES2_SOURCES,
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
const LINE = '1px solid #8e949a';
const KNOB = '#f4f4f4'; // white pointer line on the black caps
const CAP = '#202326';  // black button caps
const TWIN_INK = '#b9c8d6'; // legends in the dark twin-only deck strip
const LED_OFF = '#2a2e32';
const RED = '#ff3b30', AMBER = '#ffb020', GREEN = '#34d058', BLUE = '#3b9dff';

type Ctx = CustomRenderContext;
type KnobEl = Extract<PanelElement, { kind: 'knob' }>;
type LabelEl = Extract<PanelElement, { kind: 'label' }>;

const knob = (control: string, x: number, y: number, diameter: number, extra: Partial<KnobEl> = {}): PanelElement => ({
  kind: 'knob', control, x, y, diameter, variant: 'moog-black', capColor: KNOB, value: 'hover', label: 'none', ...extra,
});
const label = (text: string, x: number, y: number, size = 6.5, extra: Partial<LabelEl> = {}): PanelElement => ({
  kind: 'label', text, x, y, size, color: INK, weight: 700, ...extra,
});
const small = (text: string, x: number, y: number, extra: Partial<LabelEl> = {}) => label(text, x, y, 5, { color: MUTED, ...extra });
const buttons = (control: string, x: number, y: number, scale = 1, extra: Partial<Extract<PanelElement, { kind: 'switch' }>> = {}): PanelElement => ({
  kind: 'switch', control, x, y, style: 'buttons', orientation: 'horizontal', scale, label: 'none', ...extra,
});
/** A round panel button with an LED (CUE, ON, filter types...) */
const round = (control: string, x: number, y: number, w: number, led: string, extra: Partial<Extract<PanelElement, { kind: 'button' }>> = {}): PanelElement => ({
  kind: 'button', control, x, y, shape: 'round', w, color: CAP, ledColor: led, label: 'none', ...extra,
});
/** Legends at a knob's ends (7 and 5 o'clock) */
const ends = (x: number, y: number, d: number, lo: string, hi: string, size = 4.6): PanelElement[] => {
  const r = d / 2 + 2.6, s = Math.SQRT1_2;
  return [
    label(lo, x - r * s, y + r * s + 0.6, size, { color: MUTED, align: 'right' }),
    label(hi, x + r * s, y + r * s + 0.6, size, { color: MUTED, align: 'left' }),
  ];
};

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
    if (lit === last.current) return;
    last.current = lit;
    refs.current.forEach((el, i) => {
      if (!el) return;
      const c = meterColor(steps[i]);
      const on = i < lit;
      el.style.background = on ? c : LED_OFF;
      el.style.boxShadow = on ? `0 0 5px ${c}` : 'inset 0 1px 1px #000';
    });
  }, [instance, k, steps]);
  useFrame(update);
  const n = steps.length, seg = height / n;
  const d = Math.min(width, seg - 2);
  return (
    <div role="meter" aria-label={aria} style={{ position: 'relative', width, height, pointerEvents: 'none' }}>
      {steps.map((s, i) => (
        <div
          key={s}
          ref={el => { refs.current[i] = el; }}
          style={{ position: 'absolute', left: (width - d) / 2, top: (n - 1 - i) * seg + (seg - d) / 2, width: d, height: d, borderRadius: '50%', background: LED_OFF, boxShadow: 'inset 0 1px 1px #000' }}
        />
      ))}
    </div>
  );
}

function ladderScale(labels: string[], height: number, align: 'left' | 'right' | 'center', size = 5.5, width = 14) {
  const n = labels.length, seg = height / n;
  return (
    <div style={{ position: 'relative', height, width, pointerEvents: 'none' }}>
      {labels.map((l, i) => (
        <div
          key={l}
          style={{
            position: 'absolute', [align === 'center' ? 'left' : align]: align === 'center' ? '50%' : 0, top: (n - 1 - i + 0.5) * seg,
            transform: align === 'center' ? 'translate(-50%, -50%)' : 'translateY(-50%)',
            fontSize: size, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap', color: MUTED,
          }}
        >
          {l}
        </div>
      ))}
    </div>
  );
}

/** Channel meter: the legends left of 9 round LEDs, -20 .. +10 (post-EQ, pre-fader) */
const channelMeter = (ch: string, x: number, top: number, h: number, scale = true): PanelElement => ({
  kind: 'custom', x: x - (scale ? 8.5 : 1.6), y: top, w: scale ? 10.5 : 3.2, h,
  render: c => (
    <div style={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', pointerEvents: 'none' }}>
      {scale && ladderScale(CH_METER_LABELS, h * K, 'right', 5, 17)}
      <Ladder instance={c.instance} k={ch} steps={CH_METER_DBU} height={h * K} width={3.2 * K} aria={`Channel ${chName(ch)} meter`} />
    </div>
  ),
});

/** The LR MIX meters: L and R columns with the legends between, L-MIX-R / CUE-SPLIT-PRG below */
const lrMeters = (cx: number, top: number, h: number, gap = 20): PanelElement => ({
  kind: 'custom', x: cx - gap / 2 - 2, y: top, w: gap + 4, h: h + 9,
  render: c => <LrMeters c={c} h={h} gap={gap} />,
});

function LrMeters({ c, h, gap }: { c: Ctx; h: number; gap: number }) {
  const split = !!c.values.split_cue;
  const cueOn = CHANNELS.some(ch => !!c.values[`ch${ch}_cue`]) || !!c.values.rtnc_cue || !!c.values.rtnd_cue;
  const hp = h * K, wl = 4 * K;
  const legend = (on: boolean, text: string) => (
    <span style={{ color: on ? '#c0261c' : MUTED, fontWeight: 800 }}>{text}</span>
  );
  return (
    <div style={{ width: (gap + 4) * K, pointerEvents: 'none' }} aria-label="LR MIX meters">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Ladder instance={c.instance} k="L" steps={MASTER_METER_DBU} height={hp} width={wl} aria="Left meter" />
        {ladderScale(MASTER_METER_LABELS, hp, 'center', 5, (gap - 4) * K)}
        <Ladder instance={c.instance} k="R" steps={MASTER_METER_DBU} height={hp} width={wl} aria="Right meter" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 5.5, marginTop: 3, lineHeight: 1.3 }}>
        {legend(cueOn, cueOn && !split ? 'CUE' : 'L')}{legend(false, 'MIX')}{legend(cueOn && !split, cueOn && !split ? 'CUE' : 'R')}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 5, lineHeight: 1.2 }}>
        {legend(cueOn && split, 'CUE')}{legend(false, '· SPLIT ·')}{legend(false, 'PRG')}
      </div>
    </div>
  );
}

/** An LED that follows the engine snapshot: 'sig' (RTN C/D: green with signal, red near clipping) or 'pk' (PK!: red) */
function MeterLed({ instance, k, mode, size }: { instance: string; k: string; mode: 'sig' | 'pk'; size: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const last = useRef('');
  const update = useCallback(() => {
    const m = engineOf(instance)?.meterSnapshot?.().meters[k];
    const state = !m ? 'off' : m.pk ? 'red' : mode === 'sig' && m.db >= SIG_DBU ? 'green' : 'off';
    if (state === last.current || !ref.current) return;
    last.current = state;
    const c = state === 'red' ? RED : state === 'green' ? '#2fd158' : LED_OFF;
    ref.current.style.background = c;
    ref.current.style.boxShadow = state === 'off' ? 'inset 0 1px 1px #000' : `0 0 6px ${c}`;
  }, [instance, k, mode]);
  useFrame(update);
  return <div ref={ref} aria-hidden style={{ width: size * K, height: size * K, borderRadius: '50%', background: LED_OFF, pointerEvents: 'none' }} />;
}

const meterLed = (k: string, mode: 'sig' | 'pk', x: number, y: number, size = 2.6): PanelElement => ({
  kind: 'custom', x: x - size / 2, y: y - size / 2, w: size, h: size, render: c => <MeterLed instance={c.instance} k={k} mode={mode} size={size} />,
});

/** A decorative selector knob (INPUT, PHONES 2) that points at the chosen position; a tap steps it on */
function SelectorKnob({ c, control, d, angles }: { c: Ctx; control: string; d: number; angles: number[] }) {
  const v = Math.max(0, Math.min(angles.length - 1, Math.round(Number(c.values[control] ?? 0))));
  const px = d * K;
  return (
    <div
      role="presentation"
      onPointerDown={e => { e.preventDefault(); c.setValue(control, (v + 1) % angles.length); }}
      style={{
        width: px, height: px, borderRadius: '50%', position: 'relative', cursor: 'pointer', touchAction: 'manipulation',
        background: 'radial-gradient(circle at 45% 35%, #3a3a3a 0%, #0d0d0d 78%)', border: '1px solid #3a3a3a', boxShadow: '0 2px 4px rgba(0,0,0,0.55)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, transform: `rotate(${angles[v]}deg)`, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: '50%', top: '8%', width: Math.max(2, px * 0.09), height: px * 0.36, transform: 'translateX(-50%)', background: '#e8231b', borderRadius: 2 }} />
      </div>
    </div>
  );
}

const selectorKnob = (control: string, x: number, y: number, d: number, angles: number[]): PanelElement => ({
  kind: 'custom', x: x - d / 2, y: y - d / 2, w: d, h: d, render: c => <SelectorKnob c={c} control={control} d={d} angles={angles} />,
});

/** INPUT positions: the knob points at its legend (USB 1 top right ... USB 2 bottom right) */
const INPUT_ANGLES = [50, 78, 106, 134];

/** Fader slot ticks and the infinity mark */
function faderTicks(x: number, top: number, len: number): JSX.Element {
  return (
    <g stroke={PRINT} strokeLinecap="round">
      {Array.from({ length: 11 }, (_, i) => {
        const y = (top + (i * len) / 10) * K;
        const big = i === 0 || i === 10;
        return <line key={i} x1={(x - 8.5) * K} y1={y} x2={(x - (big ? 4 : 5.5)) * K} y2={y} strokeWidth={big ? 1.6 : 1} />;
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Printed marks: the knob component draws light ticks for dark panels, so the
// faceplate gets its own dark ones, plus fader scales, the FREQ dots and the
// strip lines (one SVG for the whole panel).
// ---------------------------------------------------------------------------

interface Marks { faders: { x: number; top: number; len: number }[]; dots: { x: number; y: number; d: number }[]; lines: [number, number, number, number][] }

function printed(elements: PanelElement[], w: number, h: number, y0: number, marks: Marks): PanelElement {
  const knobs = elements.filter((e): e is KnobEl => e.kind === 'knob' && e.y >= y0);
  return {
    kind: 'custom', x: 0, y: 0, w, h,
    render: () => (
      <svg width={w * K} height={h * K} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} aria-hidden>
        {marks.lines.map(([x1, y1, x2, y2], i) => <line key={`l${i}`} x1={x1 * K} y1={y1 * K} x2={x2 * K} y2={y2 * K} stroke="#7d838a" strokeWidth={1} />)}
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
        {marks.faders.map((f, i) => <g key={`f${i}`}>{faderTicks(f.x, f.top, f.len)}</g>)}
        {marks.dots.map((f, i) => (
          <g key={`d${i}`} fill="#15171a">
            {Array.from({ length: 7 }, (_, j) => {
              const a = ((-135 + (j * 270) / 6) * Math.PI) / 180;
              const r = (f.d / 2 + 4.2) * K;
              return <circle key={j} cx={f.x * K + Math.sin(a) * r} cy={f.y * K - Math.cos(a) * r} r={(0.5 + j * 0.28) * K} />;
            })}
          </g>
        ))}
      </svg>
    ),
  };
}

// ---------------------------------------------------------------------------
// Decorations: parts of the panel the twin doesn't model (they do nothing)
// ---------------------------------------------------------------------------

function Deco({ kind, d, text }: { kind: 'midi' | 'led' | 'small' | 'jack' | 'mini'; d: number; text?: string }) {
  const px = d * K;
  if (kind === 'jack' || kind === 'mini') {
    return <div aria-hidden style={{ width: px, height: px, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #555 0%, #0b0b0b 70%)', border: `${kind === 'jack' ? 3 : 2}px solid #8a8f94`, boxShadow: 'inset 0 2px 3px #000' }} />;
  }
  if (kind === 'led') return <div aria-hidden style={{ width: px, height: px, borderRadius: '50%', background: LED_OFF, boxShadow: 'inset 0 1px 1px #000' }} />;
  return (
    <div aria-hidden style={{ width: px, height: px, borderRadius: '50%', background: 'radial-gradient(circle at 50% 40%, #33383d 0%, #17191b 75%)', border: '2px solid #3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8d969e', fontSize: kind === 'midi' ? 9 : 5, fontWeight: 800 }}>
      {text}
    </div>
  );
}

const deco = (kind: 'midi' | 'led' | 'small' | 'jack' | 'mini', x: number, y: number, d: number, text?: string): PanelElement => ({
  kind: 'custom', x: x - d / 2, y: y - d / 2, w: d, h: d, render: () => <Deco kind={kind} d={d} text={text} />,
});

/** Curve icons over a curve switch: CHANNEL FADER (three tapers) or XFADER (blend, transition, cut) */
function CurveIcons({ type, pitch }: { type: 'fader' | 'xfader'; pitch: number }) {
  const w = 5 * K, h = 3 * K, sp = pitch * K;
  const paths = type === 'fader'
    ? ['M0,9 L15,0', 'M0,9 Q9,8 15,0', 'M0,9 Q2,0 15,0']
    : ['M0,0 L15,9 M0,9 L15,0', 'M0,9 L3,0 L12,0 L15,9', 'M0,9 L0,0 L15,0 L15,9'];
  return (
    <svg width={sp * 2 + w} height={h} aria-hidden style={{ pointerEvents: 'none', overflow: 'visible' }}>
      {paths.map((d, i) => (
        <path key={i} d={d} transform={`translate(${i * sp},0) scale(${w / 15},${h / 9})`} fill="none" stroke={INK} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

const curveIcons = (type: 'fader' | 'xfader', x: number, y: number, pitch: number): PanelElement => ({
  kind: 'custom', x: x - pitch - 2.5, y: y - 1.5, w: pitch * 2 + 5, h: 3, render: () => <CurveIcons type={type} pitch={pitch} />,
});

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
      style={{
        width: w * K, boxSizing: 'border-box', padding: '1px 3px', borderRadius: 3, fontSize: 7, fontWeight: 800, lineHeight: 1.25,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center', pointerEvents: 'auto',
        background: onInput ? '#0f5132' : '#6b4a00', color: '#fff', border: `1px solid ${onInput ? '#1f8a56' : '#c08a00'}`,
      }}
    >
      {onInput ? text : `${text} · INPUT → ${isAux(ch) ? 'RTN' : 'LN'}`}
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
  const via = isAux(ch) ? 'MIC' : input === 1 ? 'PH' : 'LN';
  if (src === SRC.NONE) return `${via}: no deck`;
  return isAux(ch) ? `MIC: ${SOURCE_NAMES[src]} · clean feed` : `${via}: ${SOURCE_NAMES[src]}`;
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
          style={{ fontSize: 8.5, fontWeight: 800, color: '#dfe6ec', background: '#24303b', border: '1px solid #3b4652', borderRadius: 4, padding: compact ? '4px 3px' : '5px 4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          aria-label={`Load an audio file onto channel ${chName(ch)} USB`}
        >
          FILE
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
      <div style={{ fontSize: 8.5, fontWeight: 700, color: isStudio ? '#7ef0a8' : '#b9c8d6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {!isStudio && <span style={{ color: '#6f8090' }}>hears </span>}{status}
      </div>
    </div>
  );
}

/** What RTN C and RTN D hear (the deck strip, above their column) */
function ReturnsStatus({ c, compact }: { c: Ctx; compact: boolean }) {
  const cNames = useRoutedNames(c.instance, 'c');
  const dNames = useRoutedNames(c.instance, 'd');
  const row = (r: string, names: string[]) => (
    <div style={{ fontSize: 8, fontWeight: 700, color: names.length ? '#7ef0a8' : '#6f8090', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      RTN {r}: {names.length ? `STUDIO: ${names.join(' + ')}` : 'nothing routed'}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 1 : 3 }}>
      {!compact && <div style={{ fontSize: 8, fontWeight: 800, color: '#8fd3ff', letterSpacing: 0.5 }}>RETURNS</div>}
      {row('C', cNames)}
      {row('D', dNames)}
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
      aria-label={compact ? 'Compact view on: switch back to the full hardware layout' : 'Switch to the compact view (EQ, faders and crossfader on one screen)'}
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
function typeButtons(f: 1 | 2, x: number, y0: number, pitch: number, w: number, vertical = true): PanelElement[] {
  return (['HPF', 'BPF', 'LPF'] as const).map((t, i): PanelElement => ({
    kind: 'button', control: `f${f}_type`, setValue: i, x: vertical ? x : x + i * pitch, y: vertical ? y0 + i * pitch : y0, shape: 'round', w,
    color: CAP, ledColor: AMBER, label: 'none', labelText: t,
    lit: ({ values }) => ((TYPE_MASK[Number(values[`f${f}_type`] ?? 0)] ?? 0) & (1 << i)) !== 0,
  }));
}

const crunchLed = (f: 1 | 2, x: number, y: number): PanelElement => ({
  kind: 'led', x, y, size: 2.6, color: RED,
  on: ({ values }) => (values[`f${f}_on`] ? Math.min(1, Number(values[`f${f}_crunch`] ?? 0) / 6) : 0),
});

const cueActiveLed = (x: number, y: number, size = 2.8): PanelElement => ({
  kind: 'led', x, y, size, color: RED,
  on: ({ values }) => CHANNELS.some(c => !!values[`ch${c}_cue`]) || !!values.rtnc_cue || !!values.rtnd_cue,
});

/** PHONES 2: the 9-way selector with its positions around the knob */
function phones2Selector(x: number, y: number, d: number, r: number, bw: number): PanelElement[] {
  const angles = PHONES2_SOURCES.map((_, i) => -135 + (i * 270) / (PHONES2_SOURCES.length - 1));
  return [
    selectorKnob('phones2_src', x, y, d, angles),
    ...PHONES2_SOURCES.map((s, i): PanelElement => {
      const a = (angles[i] * Math.PI) / 180;
      return { kind: 'button', control: 'phones2_src', setValue: i, x: x + Math.sin(a) * r, y: y - Math.cos(a) * r, shape: 'round', w: bw, color: CAP, ledColor: AMBER, capText: s, label: 'none' };
    }),
  ];
}

// ============================================================================
// FULL view (positions measured from the guide's top-panel overview, p.7)
// ============================================================================

const DECK_H = 50;
const MY = DECK_H;
const W = 339;
const FACE_H = 396;
const H = DECK_H + FACE_H;
/** Knob column of each strip; the fader sits 3.3 mm right of it, the meter 11.5 mm left */
const KX: Record<ChannelId, number> = { a: 26, b: 61.5, '1': 133.5, '2': 169, '3': 204.5, '4': 240 };
const CD = 97.5;   // RTN C/D and FILTER 1 column
const F2 = 276.5;  // LR MIX meters and FILTER 2 column
const RX = 315.5;  // MASTER, BOOTH and MONITOR column
const XF_X = 187;  // crossfader centre

const fullMarks: Marks = { faders: [], dots: [], lines: [] };

function fullStrip(ch: ChannelId): PanelElement[] {
  const x = KX[ch];
  const y = (v: number) => MY + v;
  const p = `ch${ch}_`;
  const aux = isAux(ch);
  const mx = x - 11.5, fx = x + 3.3;
  const cueY = aux ? 234.6 : 244.6, fadY = aux ? 291.9 : 302, mTop = aux ? 261 : 270.5, nameY = aux ? 321 : 330.7;
  fullMarks.faders.push({ x: fx, top: y(fadY - 30), len: 60 });
  fullMarks.lines.push([x - 15.5, y(19), x - 15.5, y(aux ? 226 : 236)]);
  const els: PanelElement[] = [
    // channel label box, studio chip
    { kind: 'section', x: x - 15.5, y: y(18.5), w: 5, h: 5, border: '1px solid #2b2f33', radius: 0.8 },
    label(chName(ch), x - 13, y(21.1), 7.5, { weight: 800 }),
    studioChip(ch, x + 1, y(4), 31),
    // SEND 1, PRE, SEND 2
    small('SEND', x - 6.5, y(20.5), { align: 'right' }), small('1', x - 7.6, y(23.4), { align: 'right' }),
    knob(`${p}snd1`, x + 3.5, y(25), 10.5),
    ...ends(x + 3.5, y(25), 10.5, '∞', '+6'),
    round(`${p}pre`, x - 3.5, y(38.9), 5, AMBER),
    small('PRE', x + 0.2, y(38.9), { align: 'left' }),
    small('SEND', x - 6.5, y(45.8), { align: 'right' }), small('2', x - 7.6, y(48.7), { align: 'right' }),
    knob(`${p}snd2`, x + 3.5, y(50.3), 10.5),
    ...ends(x + 3.5, y(50.3), 10.5, '∞', '+6'),
    // INPUT select: the knob points at the lit position
    selectorKnob(`${p}input`, x - 1, y(71.8), 10, INPUT_ANGLES),
    { kind: 'switch', control: `${p}input`, x: x + 12.2, y: y(71.8), style: 'buttons', orientation: 'vertical', scale: 0.78, label: 'none' },
    small('USB', x - 11.5, y(70.2), { size: 4.6, color: INK }), small(aux ? (ch === 'a' ? '9-10' : '11-12') : `${2 * Number(ch) - 1}-${2 * Number(ch)}`, x - 11.5, y(74.5), { size: 4.6 }),
    // PK! and GAIN
    meterLed(ch, 'pk', mx, y(88.5)),
    small('PK!', mx + 2.3, y(88.5), { align: 'left', color: INK }),
    label('GAIN', x + 8.5, y(88.5), 6),
    knob(`${p}gain`, x, y(97.2), 11),
    ...ends(x, y(97.2), 11, '∞', '+10'),
    // EQ
    label('HI', x - 11.5, y(112.5), 6.5, { align: 'left' }),
    knob(`${p}hi`, x, y(118.7), 14),
    ...ends(x, y(118.7), 14, '∞', '+6'),
    knob(`${p}lo`, x, y(195), 14),
    label('LO', x - 11.5, y(188.8), 6.5, { align: 'left' }),
    ...ends(x, y(195), 14, '∞', '+6'),
  ];
  if (aux) {
    els.push(
      label('FREQ', x - 11.5, y(136.5), 5.5, { align: 'left', invert: true }),
      small('650Hz', x, y(135.4)),
      knob(`${p}midf`, x, y(143.3), 11),
      ...ends(x, y(143.3), 11, '190Hz', '2.75k', 4.2),
      label('MID', x - 11.5, y(161.8), 5.5, { align: 'left', invert: true }),
      knob(`${p}mid`, x, y(168.3), 14),
      ...ends(x, y(168.3), 14, '-24', '+10'),
      label('PARAMETRIC EQ', x - 14.8, y(156), 4.6, { rotate: -90, color: MUTED }),
    );
    fullMarks.lines.push([x - 13.2, y(131), x - 13.2, y(181)]);
  } else {
    els.push(
      label('HI', x - 11.5, y(135.8), 6, { align: 'left' }), label('MID', x - 11.5, y(138.3), 6, { align: 'left' }),
      knob(`${p}himid`, x, y(143.3), 14),
      ...ends(x, y(143.3), 14, '-27', '+10'),
      label('LO', x - 11.5, y(160.8), 6, { align: 'left' }), label('MID', x - 11.5, y(163.3), 6, { align: 'left' }),
      knob(`${p}lomid`, x, y(168.3), 14),
      ...ends(x, y(168.3), 14, '-27', '+10'),
    );
  }
  els.push(
    // FILTER assign (and XFADER assign on 1-4)
    buttons(`${p}filter`, x, y(212.7), 0.82),
    ...(aux ? [] : [buttons(`${p}xf`, x, y(222.9), 0.82)]),
    // CUE, meter, fader
    label('CUE', x - 8, y(cueY - 7.6), 6.5),
    round(`${p}cue`, x + 3, y(cueY), 13.5, RED),
    channelMeter(ch, mx, y(mTop), 46),
    { kind: 'slider', control: `${p}fader`, x: fx, y: y(fadY), length: 60, capColor: '#1d1f21', label: 'none', value: 'hover' },
    label('∞', fx - 6.2, y(fadY + 33), 7, { color: MUTED }),
    label(chName(ch), mx, y(nameY), 15, { weight: 500 }),
  );
  return els;
}

function fullReturns(): PanelElement[] {
  const x = CD, y = (v: number) => MY + v;
  const one = (r: 'c' | 'd', top: number): PanelElement[] => [
    { kind: 'section', x: x - 13, y: y(top - 10.5), w: 5, h: 5, border: '1px solid #2b2f33', radius: 0.8 },
    label(r.toUpperCase(), x - 10.5, y(top - 7.9), 7.5, { weight: 800 }),
    small('ON/OFF', x, y(top - 7.8), { color: INK }),
    round(`rtn${r}_on`, x, y(top), 11.5, GREEN),
    meterLed(r, 'sig', x - 11.5, y(top + 12.8)),
    small('SIG', x - 9.4, y(top + 12.8), { align: 'left', color: INK }),
    label('LEVEL', x + 7.5, y(top + 13.5), 5.5),
    knob(`rtn${r}_level`, x, y(top + 21.9), 10.5),
    ...ends(x, y(top + 21.9), 10.5, '∞', '+10'),
    label('CUE', x - 8.5, y(top + 39.5), 6.5),
    round(`rtn${r}_cue`, x, y(top + 47.9), 13.5, RED),
  ];
  fullMarks.lines.push([x - 13, y(24), x - 13, y(163)]);
  return [...one('c', 29.5), ...one('d', 102.4), studioChip('c', x + 1, y(2.5), 30), studioChip('d', x + 1, y(8), 30)];
}

function fullFilter(f: 1 | 2): PanelElement[] {
  const x = f === 1 ? CD : F2, y = (v: number) => MY + v;
  const p = `f${f}_`;
  fullMarks.dots.push({ x, y: y(319.2), d: 15.5 });
  fullMarks.lines.push([x - 13, y(167), x - 13, y(362)]);
  return [
    crunchLed(f, x - 11.5, y(170)),
    label('CRUNCH', x - 8.5, y(170), 6.5, { align: 'left' }),
    knob(`${p}crunch`, x, y(184), 10.5),
    ...ends(x, y(184), 10.5, '0', '10'),
    label('RES', x + 7.8, y(201), 5.5, { align: 'left' }),
    knob(`${p}res`, x, y(210), 14.5),
    ...ends(x, y(210), 14.5, 'MILD', 'WILD', 4.2),
    label('HPF', x - 11.5, y(230.5), 6, { align: 'left' }),
    label('BPF', x - 11.5, y(253.4), 6, { align: 'left' }),
    label('LPF', x - 11.5, y(276.7), 6, { align: 'left' }),
    ...typeButtons(f, x + 0.5, y(240.1), 23.1, 14),
    label('FREQ', x - 11.5, y(306), 6, { align: 'left' }),
    knob(`${p}freq`, x, y(319.2), 15.5),
    round(`${p}on`, x + 0.5, y(349.4), 14, BLUE),
    label(`FILTER ${f}`, x + 0.5, y(363.3), 6.5),
  ];
}

function fullMeters(): PanelElement[] {
  const x = F2 - 2.2, y = (v: number) => MY + v;
  return [
    // USB ACTIVE and MIDI 1/2 (not modelled: the twin has no USB or MIDI)
    small('USB 1', x - 9.9, y(17), { rotate: -90 }), small('USB 2', x + 9.9, y(17), { rotate: -90 }),
    small('ACTIVE', x, y(25.6), { color: INK }),
    deco('led', x - 9.9, y(29.5), 2.4), deco('led', x + 9.9, y(29.5), 2.4),
    small('MIDI', x, y(35.8), { color: INK }),
    deco('midi', x - 9.9, y(43), 12, '1'), deco('midi', x + 9.9, y(43), 12, '2'),
    label('XONE:96', x, y(66.5), 11, { weight: 900, font: 'condensed', letterSpacing: 0.5 }),
    small('6+2 ANALOGUE', x, y(72), { size: 4.4 }),
    lrMeters(x, y(84.6), 58),
  ];
}

function fullRight(): PanelElement[] {
  const x = RX, y = (v: number) => MY + v;
  return [
    label('MASTER 1', x, y(20.6), 6),
    knob('master', x, y(29.5), 12), ...ends(x, y(29.5), 12, '0', '10'),
    label('MASTER 2', x, y(44.2), 6),
    knob('master2', x, y(53.1), 12), ...ends(x, y(53.1), 12, '0', '10'),
    small('USB 11/12', x - 4, y(71.6), { color: INK }),
    deco('small', x - 4, y(77.4), 5),
    small('MST/SEND2', x - 4, y(82.6), { size: 4.4 }),
    // BOOTH
    round('booth_mono', x - 4, y(90), 5, AMBER),
    small('STEREO/MONO', x - 4, y(95.2), { color: INK, size: 4.4 }),
    label('HI', x - 9.5, y(105.5), 5.5, { align: 'left' }),
    knob('booth_hi', x, y(111.7), 11), ...ends(x, y(111.7), 11, '-8', '+8'),
    label('MID', x - 9.5, y(124.3), 5.5, { align: 'left' }),
    knob('booth_mid', x, y(130.5), 11), ...ends(x, y(130.5), 11, '-8', '+8'),
    label('LO', x - 9.5, y(143.3), 5.5, { align: 'left' }),
    knob('booth_lo', x, y(149.5), 11), ...ends(x, y(149.5), 11, '-8', '+8'),
    knob('booth', x, y(172.5), 11), ...ends(x, y(172.5), 11, '0', '10'),
    round('booth_mute', x, y(193.5), 11.5, RED),
    small('MUTE', x + 8.4, y(198.2), { align: 'left', color: INK }),
    label('BOOTH', x + 19.4, y(145), 5.5, { rotate: 90 }),
    // fader curve switches (icons as on the panel)
    curveIcons('fader', x, y(205.5), 11.5),
    buttons('fader_curve', x, y(210.7), 0.62),
    small('CHANNEL FADER', x, y(215.6), { color: INK, size: 4.4 }),
    curveIcons('xfader', x, y(220.2), 11.5),
    buttons('xf_curve', x, y(225.4), 0.62),
    small('XFADER', x, y(230.3), { color: INK, size: 4.4 }),
    // MONITOR
    cueActiveLed(x - 10, y(239.8)),
    small('ACTIVE', x - 10, y(244.2), { color: INK, size: 4.4 }),
    round('cue_post_eq', x - 4, y(252.2), 5, AMBER),
    small('POST', x + 0.4, y(251), { align: 'left', color: INK }), small('EQ', x + 0.4, y(253.6), { align: 'left', color: INK }),
    round('split_cue', x - 4, y(264.2), 5, AMBER),
    small('SPLIT', x + 0.4, y(263), { align: 'left', color: INK }), small('CUE', x + 0.4, y(265.6), { align: 'left', color: INK }),
    knob('cue_mix', x, y(283.8), 11), ...ends(x, y(283.8), 11, 'CUE', 'MST', 4.2),
    knob('phones', x, y(310.5), 12), ...ends(x, y(310.5), 12, '0', '11'),
    deco('jack', x - 1.5, y(337), 9),
    deco('mini', x - 9, y(356.5), 4.4),
    small('PHONES', x - 4.5, y(356.6), { align: 'left', color: INK }),
    label('MONITOR', x + 19.4, y(290), 5.5, { rotate: 90 }),
  ];
}

function fullBottom(): PanelElement[] {
  const y = (v: number) => MY + v;
  return [
    // crossfader under channels 1-4
    { kind: 'slider', control: 'xfader', x: XF_X, y: y(368.8), length: 45, orientation: 'horizontal', capColor: '#1d1f21', label: 'none', value: 'hover' },
    label('X', XF_X - 34.5, y(368.8), 10, { weight: 800 }),
    label('Y', XF_X + 34.5, y(368.8), 10, { weight: 800 }),
    small('CROSSFADER · innoFADER', XF_X, y(380.5), { italic: true }),
    // PHONES 2 under channels A and B
    label('ALLEN & HEATH · XONE', 40, y(348.6), 8.5, { weight: 800, letterSpacing: 0.8 }),
    ...phones2Selector(22.5, y(369.5), 8, 8.6, 4.4),
    knob('phones2_mix', 46.5, y(369.5), 10.5), ...ends(46.5, y(369.5), 10.5, 'CUE', 'MST', 4.2),
    knob('phones2', 69, y(369.5), 10.5), ...ends(69, y(369.5), 10.5, '0', '11'),
    label('PHONES 2', 46.5, y(386.6), 6),
    deco('mini', 60, y(391.5), 3.4),
  ];
}

function deckStripFull(): PanelElement[] {
  const deckCol = (ch: ChannelId): PanelElement => ({
    kind: 'custom', x: KX[ch] - 15.5, y: 6, w: 33, h: 32,
    render: c => <DeckColumn c={c} ch={ch} w={33} compact={false} />,
  });
  return [
    { kind: 'section', x: 1.5, y: 1.5, w: W - 3, h: DECK_H - 4, background: '#0f1316', border: '1px solid #26313b', radius: 2, title: 'BUILT-IN DECKS · TWIN ONLY, NOT PART OF THE MIXER', titleColor: '#8fd3ff' },
    ...CHANNELS.map(deckCol),
    { kind: 'custom', x: CD - 13, y: 6, w: 26, h: 20, render: c => <ReturnsStatus c={c} compact={false} /> },
    { kind: 'custom', x: CD - 13, y: 40, w: 30, h: 6, render: c => <ViewToggle c={c} compact={false} /> },
    { kind: 'button', control: 'play', x: 264, y: 13, shape: 'round', w: 10, color: '#13261a', ledColor: '#22c55e', capText: 'PLAY', label: 'none', lit: ({ engine, values }) => (engine.synced ? !!engine.playing : !!values.play) },
    knob('bpm', 277, 14, 7.5, { value: 'always' }),
    label('BPM', 277, 7.5, 5.5, { color: TWIN_INK }),
    { kind: 'custom', x: 285, y: 5, w: 49, h: 17, render: c => <DeckDisplay c={c} compact={false} /> },
    label('YOU HEAR (TWIN)', 299, 25.5, 5.5, { color: TWIN_INK }),
    buttons('monitor_out', 299, 30.5, 0.72),
    { kind: 'button', control: 'cue_latch', x: 262, y: 30.5, shape: 'rect', w: 14, h: 5, color: '#26292c', ledColor: RED, capText: 'LATCH CUE', label: 'none' },
    label('STAND-IN FX UNIT', 268, 38.5, 5.5, { color: '#8fd3ff' }),
    buttons('fx_time', 268, 43.8, 0.8),
    knob('fx_fdbk', 305, 43, 6.5),
    label('FDBK', 305, 37.8, 5.5, { color: TWIN_INK }),
    knob('fx_size', 324, 43, 6.5),
    label('REVERB', 324, 37.8, 5.5, { color: TWIN_INK }),
  ];
}

function buildFull(): PanelLayout {
  fullMarks.faders.length = 0; fullMarks.dots.length = 0; fullMarks.lines.length = 0;
  const elements: PanelElement[] = [
    ...deckStripFull(),
    // faceplate
    { kind: 'section', x: 0, y: MY, w: W, h: FACE_H, background: FACE, radius: 3 },
    ...CHANNELS.flatMap(fullStrip),
    ...fullReturns(),
    ...fullFilter(1),
    ...fullFilter(2),
    ...fullMeters(),
    ...fullRight(),
    ...fullBottom(),
    label('FILTER', (KX.a + KX.b) / 2 + 1.5, MY + 212.7, 5.2, { color: MUTED }),
    label('FILTER', (KX['1'] + KX['2']) / 2 + 1.5, MY + 212.7, 5.2, { color: MUTED }),
    label('FILTER', (KX['3'] + KX['4']) / 2 + 1.5, MY + 212.7, 5.2, { color: MUTED }),
    label('XFADER', (KX['1'] + KX['2']) / 2 + 1.5, MY + 222.9, 5.2, { color: MUTED }),
    label('XFADER', (KX['3'] + KX['4']) / 2 + 1.5, MY + 222.9, 5.2, { color: MUTED }),
  ];
  fullMarks.lines.push([F2 + 13.5, MY + 24, F2 + 13.5, MY + 362], [RX - 13, MY + 87, RX - 13, MY + 233]);
  return {
    width: W,
    height: H,
    pxPerMm: K,
    theme: { background: '#0c0d0e', text: INK, muted: MUTED, font: '"Helvetica Neue", Helvetica, Arial, sans-serif', frame: { padding: 2, background: '#0c0d0e', radius: 3 } },
    elements: [printed(elements, W, H, MY, { faders: [...fullMarks.faders], dots: [...fullMarks.dots], lines: [...fullMarks.lines] }), ...elements],
  };
}

// ============================================================================
// COMPACT view (iPad landscape): the same order, folded to 372 x 236 mm
// ============================================================================

const CW = 372;
const CH = 236;
const TOP = 26;          // top of the faceplate
const CX: Record<ChannelId, number> = { a: 20, b: 56, '1': 130, '2': 166, '3': 202, '4': 238 };
const CCD = 93;          // returns + FILTER 1
const CF2 = 273;         // meters + FILTER 2
const RA = 306, RB = 330, RC = 354; // master / booth / monitor / PHONES 2 sub-columns

const compactMarks: Marks = { faders: [], dots: [], lines: [] };

function compactStrip(ch: ChannelId): PanelElement[] {
  const x = CX[ch];
  const p = `ch${ch}_`;
  const aux = isAux(ch);
  const l = x - 8.5, r = x + 8.5;
  const y = (v: number) => TOP + v;
  compactMarks.faders.push({ x: x + 4, top: y(118), len: 50 });
  compactMarks.lines.push([x - 17.5, y(4), x - 17.5, y(176)]);
  return [
    label(chName(ch), x - 13.8, y(4.2), 7, { weight: 800 }),
    studioChip(ch, x + 2.5, y(1.6), 27),
    // sends
    knob(`${p}snd1`, l, y(15), 8.8, { label: 'above', labelText: 'SEND 1' }),
    knob(`${p}snd2`, r, y(15), 8.8, { label: 'above', labelText: 'SEND 2' }),
    round(`${p}pre`, x, y(22.5), 4.6, AMBER),
    small('PRE', x, y(26.4), { size: 4.4 }),
    // INPUT
    selectorKnob(`${p}input`, l - 1, y(36), 7.5, INPUT_ANGLES),
    { kind: 'switch', control: `${p}input`, x: x + 6.5, y: y(36), style: 'buttons', orientation: 'vertical', scale: 0.7, label: 'none' },
    // GAIN + PK!
    knob(`${p}gain`, l, y(53.5), 9.5, { label: 'above', labelText: 'GAIN' }),
    meterLed(ch, 'pk', r + 1, y(46.2)), small('PK!', r + 3.3, y(46.2), { align: 'left', color: INK }),
    // EQ: two columns, top to bottom as on the panel
    knob(`${p}hi`, r, y(57), 9.5, { label: 'above', labelText: 'HI' }),
    ...(aux
      ? [knob(`${p}midf`, l, y(72), 9, { label: 'above', labelText: 'FREQ' }), knob(`${p}mid`, r, y(75), 9.5, { label: 'above', labelText: 'MID' })]
      : [knob(`${p}himid`, l, y(72), 9.5, { label: 'above', labelText: 'HI MID' }), knob(`${p}lomid`, r, y(75), 9.5, { label: 'above', labelText: 'LO MID' })]),
    knob(`${p}lo`, l, y(90), 9.5, { label: 'above', labelText: 'LO' }),
    // assigns
    small('FILTER', r + 0.5, y(84.6), { size: 4.2 }),
    buttons(`${p}filter`, r + 0.5, y(88.5), 0.72),
    ...(aux ? [] : [buttons(`${p}xf`, r + 0.5, y(95.5), 0.72), small('XFADER', r + 0.5, y(99.6), { size: 4.2 })]),
    // CUE, meter, fader
    round(`${p}cue`, x + 4, y(107), 10, RED),
    small('CUE', x - 2, y(107), { color: INK, align: 'right' }),
    channelMeter(ch, x - 10, y(119.5), 42),
    { kind: 'slider', control: `${p}fader`, x: x + 4, y: y(143), length: 50, capColor: '#1d1f21', label: 'none', value: 'hover' },
  ];
}

function compactFilterColumn(f: 1 | 2, x: number): PanelElement[] {
  const y = (v: number) => TOP + v;
  const p = `f${f}_`;
  const t = 70; // top of the filter block
  compactMarks.dots.push({ x: x - 2, y: y(t + 79), d: 12 });
  compactMarks.lines.push([x - 17, y(t - 4), x - 17, y(176)]);
  return [
    label(`FILTER ${f}`, x, y(t - 1), 6.5),
    crunchLed(f, x - 14.5, y(t + 6)),
    knob(`${p}crunch`, x - 6.5, y(t + 13), 9, { label: 'above', labelText: 'CRUNCH' }),
    knob(`${p}res`, x + 7.5, y(t + 13), 10, { label: 'above', labelText: 'RES' }),
    ...typeButtons(f, x - 10, y(t + 31), 10, 9, false),
    small('HPF', x - 10, y(t + 37.2)), small('BPF', x, y(t + 37.2)), small('LPF', x + 10, y(t + 37.2)),
    round(`${p}on`, x + 10, y(t + 56), 10, BLUE),
    small('ON', x + 10, y(t + 62.6), { color: INK }),
    knob(`${p}freq`, x - 2, y(t + 79), 12, { label: 'above', labelText: 'FREQ' }),
  ];
}

function compactReturns(): PanelElement[] {
  const x = CCD, y = (v: number) => TOP + v;
  const one = (r: 'c' | 'd', cx: number): PanelElement[] => [
    label(r.toUpperCase(), cx - 4.5, y(4.2), 7, { weight: 800 }),
    round(`rtn${r}_on`, cx + 2, y(13.5), 8.5, GREEN),
    small('ON', cx + 2, y(19.5), { color: INK }),
    meterLed(r, 'sig', cx - 5, y(24.5)), small('SIG', cx - 3, y(24.5), { align: 'left', color: INK }),
    knob(`rtn${r}_level`, cx, y(34.5), 9),
    small('LEVEL', cx, y(41.8)),
    round(`rtn${r}_cue`, cx, y(52), 9.5, RED),
    small('CUE', cx, y(58.4), { color: INK }),
    studioChip(r, cx, y(61), 15),
  ];
  compactMarks.lines.push([x - 17, y(4), x - 17, y(66)]);
  return [...one('c', x - 8), ...one('d', x + 8)];
}

function compactMetersColumn(): PanelElement[] {
  const x = CF2, y = (v: number) => TOP + v;
  return [
    label('LR MIX', x, y(3), 5.5, { color: MUTED }),
    lrMeters(x, y(6), 44, 19),
    label('XONE:96', x, y(64), 9, { weight: 900, font: 'condensed' }),
  ];
}

function compactRight(): PanelElement[] {
  const y = (v: number) => TOP + v;
  compactMarks.lines.push([RA - 12, y(4), RA - 12, y(176)], [RA - 12, y(60.5), RC + 8, y(60.5)], [RA - 12, y(118), RC + 8, y(118)]);
  return [
    // MASTER and BOOTH
    knob('master', RA, y(12), 10.5, { label: 'above', labelText: 'MASTER 1' }),
    knob('master2', RB, y(12), 10.5, { label: 'above', labelText: 'MASTER 2' }),
    small('BOOTH', RC, y(5.5), { color: INK, size: 5.5 }),
    round('booth_mono', RC - 4, y(11), 4.6, AMBER), small('MONO', RC - 1, y(11), { align: 'left', color: INK }),
    round('booth_mute', RC, y(21), 7.5, RED), small('MUTE', RC, y(26.4), { color: INK }),
    knob('booth_hi', RA, y(34), 9, { label: 'above', labelText: 'HI' }),
    knob('booth_mid', RB, y(34), 9, { label: 'above', labelText: 'MID' }),
    knob('booth_lo', RC, y(37), 9, { label: 'above', labelText: 'LO' }),
    knob('booth', RB, y(51), 9, { label: 'above', labelText: 'BOOTH' }),
    // curves
    curveIcons('fader', RB, y(64.5), 11.5),
    buttons('fader_curve', RB, y(69.2), 0.56),
    small('CHANNEL FADER', RB, y(73.6), { size: 4.2, color: INK }),
    curveIcons('xfader', RB, y(78.5), 11.5),
    buttons('xf_curve', RB, y(83.2), 0.56),
    small('XFADER', RB, y(87.6), { size: 4.2, color: INK }),
    // MONITOR
    small('MONITOR', RA - 1, y(93), { color: INK, size: 5.5 }),
    cueActiveLed(RA + 9, y(93)), small('ACTIVE', RA + 11.5, y(93), { align: 'left', color: INK, size: 4.2 }),
    round('cue_post_eq', RB + 8, y(93), 4.6, AMBER), small('POST EQ', RB + 11, y(93), { align: 'left', color: INK, size: 4.2 }),
    round('split_cue', RB + 8, y(99.5), 4.6, AMBER), small('SPLIT', RB + 11, y(99.5), { align: 'left', color: INK, size: 4.2 }),
    knob('cue_mix', RA, y(108), 9, { label: 'above', labelText: 'CUE/MST' }),
    knob('phones', RB - 4, y(110), 9.5, { label: 'above', labelText: 'LEVEL' }),
    deco('jack', RC, y(110), 6),
    // PHONES 2
    small('PHONES 2', RB, y(123), { color: INK, size: 5.5 }),
    ...phones2Selector(RA, y(139), 7, 7.6, 4.2),
    knob('phones2_mix', RB + 1, y(139), 8.5, { label: 'above', labelText: 'CUE/MST' }),
    knob('phones2', RC, y(139), 8.5, { label: 'above', labelText: 'LEVEL' }),
    small('ALLEN & HEATH', RB, y(160), { color: INK, size: 6 }),
    label('COMPACT VIEW', RB, y(166), 5.5, { color: MUTED, letterSpacing: 1 }),
  ];
}

function deckStripCompact(): PanelElement[] {
  const deckCol = (ch: ChannelId): PanelElement => ({
    kind: 'custom', x: CX[ch] - 17, y: 4, w: 34, h: 18,
    render: c => <DeckColumn c={c} ch={ch} w={34} compact />,
  });
  return [
    { kind: 'section', x: 1, y: 1, w: CW - 2, h: 23.5, background: '#0f1316', border: '1px solid #26313b', radius: 2, title: 'BUILT-IN DECKS · TWIN ONLY', titleColor: '#8fd3ff' },
    ...CHANNELS.map(deckCol),
    { kind: 'custom', x: CCD - 17, y: 4, w: 34, h: 18, render: c => <ReturnsStatus c={c} compact /> },
    { kind: 'button', control: 'play', x: 262, y: 12.5, shape: 'round', w: 9.5, color: '#13261a', ledColor: '#22c55e', capText: 'PLAY', label: 'none', lit: ({ engine, values }) => (engine.synced ? !!engine.playing : !!values.play) },
    knob('bpm', 274, 14, 6.5, { value: 'always' }),
    label('BPM', 274, 8, 5, { color: TWIN_INK }),
    { kind: 'custom', x: 280, y: 4, w: 36, h: 12, render: c => <DeckDisplay c={c} compact /> },
    label('YOU HEAR', 281, 20.5, 5, { color: TWIN_INK, align: 'right' }),
    buttons('monitor_out', 305, 20.5, 0.62),
    label('FX', 333, 5.5, 5, { color: TWIN_INK }),
    buttons('fx_time', 333, 10.5, 0.62),
    knob('fx_fdbk', 350, 13, 6, { label: 'above', labelText: 'FDBK' }),
    knob('fx_size', 363, 13, 6, { label: 'above', labelText: 'REVERB' }),
    { kind: 'button', control: 'cue_latch', x: 339, y: 20.5, shape: 'rect', w: 12, h: 4.5, color: '#26292c', ledColor: RED, capText: 'LATCH CUE', label: 'none' },
    { kind: 'custom', x: 347, y: 17.6, w: 23, h: 6, render: c => <ViewToggle c={c} compact /> },
  ];
}

function buildCompact(): PanelLayout {
  compactMarks.faders.length = 0; compactMarks.dots.length = 0; compactMarks.lines.length = 0;
  const xfx = (CX['2'] + CX['3']) / 2;
  const elements: PanelElement[] = [
    ...deckStripCompact(),
    { kind: 'section', x: 0, y: TOP - 1, w: CW, h: CH - TOP + 1, background: FACE, radius: 3 },
    ...CHANNELS.flatMap(compactStrip),
    ...compactReturns(),
    ...compactFilterColumn(1, CCD),
    ...compactMetersColumn(),
    ...compactFilterColumn(2, CF2),
    ...compactRight(),
    // crossfader under channels 1-4
    { kind: 'slider', control: 'xfader', x: xfx, y: TOP + 195, length: 45, orientation: 'horizontal', capColor: '#1d1f21', label: 'none', value: 'hover' },
    label('X', xfx - 33, TOP + 195, 9, { weight: 800 }),
    label('Y', xfx + 33, TOP + 195, 9, { weight: 800 }),
    small('CROSSFADER', xfx, TOP + 205),
  ];
  return {
    width: CW,
    height: CH,
    pxPerMm: K,
    theme: { background: '#0c0d0e', text: INK, muted: MUTED, font: '"Helvetica Neue", Helvetica, Arial, sans-serif', frame: { padding: 2, background: '#0c0d0e', radius: 3 } },
    elements: [printed(elements, CW, CH, TOP, { faders: [...compactMarks.faders], dots: [...compactMarks.dots], lines: [...compactMarks.lines] }), ...elements],
  };
}

export const XONE96_LAYOUT_FULL = buildFull();
export const XONE96_LAYOUT_COMPACT = buildCompact();

/** The layout to show now (DeviceModule.layout is a getter that calls this) */
export function currentLayout(): PanelLayout {
  return isCompact() ? XONE96_LAYOUT_COMPACT : XONE96_LAYOUT_FULL;
}
