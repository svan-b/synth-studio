'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ControlValue, DeviceSpec, KnobSpec, LessonStep, PatchConnection, PatchPoint, SliderSpec, SwitchSpec, ButtonSpec, PatternSpec } from '@/types';
import type {
  CustomElement, EngineState, PanelContext, PanelElement, PanelLayout, PanelTheme, Values, ButtonElement, KnobElement, LedElement,
  SliderElement, SwitchElement, JackElement, LabelElement, SectionElement, DisplayElement, StepGridElement,
} from '@/types/panel';
import Knob from '@/components/controls/Knob';
import Slider from '@/components/controls/Slider';
import Switch from '@/components/controls/Switch';
import Button from '@/components/controls/Button';
import { isValueOnTarget } from '@/lib/controls/mapping';
import { FONTS, fitTransform, floorPx, resetTextMeasureCache, type TextFit } from '@/lib/controls/textFit';
import { analyseLayout, computeTextFits, elementLabel, type ElementInfo, type PanelTextFits } from './layoutAnalysis';
import Keyboard from './Keyboard';
import StepGrid from './StepGrid';
import styles from './panel.module.css';

/**
 * Live engine state without re-rendering the whole panel: the elements that show it
 * (LEDs, lit buttons, screens, playheads, custom pieces) subscribe themselves.
 */
export interface EngineSource {
  get: () => EngineState;
  subscribe: (onChange: () => void) => () => void;
}

export interface SynthPanelProps {
  spec: DeviceSpec;
  layout: PanelLayout;
  values: Values;
  engineState: EngineState;
  onChange: (id: string, value: ControlValue) => void;
  onEvent: (name: string, payload?: unknown) => void;
  onNoteOn: (note: number, velocity?: number) => void;
  onNoteOff: (note: number) => void;
  heldNotes: Set<number>;
  patches: PatchConnection[];
  onPatch: (from: string, to: string) => void;
  onUnpatch: (from: string, to: string) => void;
  teaching: boolean;
  step: LessonStep | null;
  // v2: structured device data + ephemeral UI state for custom elements
  instance?: string;
  data?: unknown;
  ui?: Record<string, unknown>;
  updateData?: (fn: (draft: unknown) => unknown) => void;
  setUi?: (patch: Record<string, unknown>) => void;
  /** Spotlight: when set, elements not in the set are dimmed - with their printed legends (focus mode in lessons) */
  focus?: Set<string> | null;
  /** Studio patching: when set, jack taps go to the studio (cables between instruments) */
  patchController?: PatchController;
  // ---- v3 (all optional) ----
  /** Current on-screen zoom of the panel: small text is raised so it renders legibly at this zoom */
  scale?: number;
  /** A press on the panel: button control id and/or event, custom-element events (lessons count them) */
  onPress?: (ids: string[]) => void;
  /** The lesson step's action is complete (press targets turn green) */
  stepDone?: boolean;
  /** "Show me": a cable the coach is demonstrating */
  demoPatch?: { from: string; to: string } | null;
  /** Live engine state; when given, `engineState` changes no longer re-render the panel */
  engineSource?: EngineSource;
}

/** Studio-wide patching: tap a jack on one instrument, then a jack on another */
export interface PatchController {
  active: { instance: string; jack: string } | null;
  tap: (instance: string, jack: string) => void;
}

const NOOP = () => undefined;
const NO_SUBSCRIBE = () => NOOP;
const EMPTY_UI: Record<string, unknown> = {};
/** For elements that don't read the panel's values: a stable stand-in, so a value change elsewhere doesn't re-render them */
const NO_BASE: Base = { values: {}, data: undefined, ui: EMPTY_UI };
/** Touch target the panel aims for, in rendered CSS px */
const TOUCH_PX = 44;
/** A tap may move this far (CSS px) and still count as a tap */
const TAP_SLOP = 8;

const CABLE_PALETTE = ['#22c55e', '#f97316', '#ef4444', '#06b6d4', '#a855f7', '#eab308', '#ec4899', '#3b82f6', '#14b8a6', '#f43f5e'];

export function cableColor(index: number) {
  return CABLE_PALETTE[index % CABLE_PALETTE.length];
}

/** Re-render on every engine update (screens, custom pieces) */
function useEngine(src: EngineSource): EngineState {
  return useSyncExternalStore(src.subscribe, src.get, src.get);
}

/** Re-render only when the selected value changes (LED brightness, a playhead) */
function useEngineValue<T extends number | string | boolean | undefined | null>(src: EngineSource, select: (e: EngineState) => T): T {
  const pick = () => {
    try { return select(src.get()); } catch { return undefined as T; }
  };
  return useSyncExternalStore(src.subscribe, pick, pick);
}

const quantize = (v: number | boolean) => (typeof v === 'boolean' ? (v ? 1 : 0) : Math.round(Math.max(0, Math.min(1, v)) * 50) / 50);

/** Re-measure text when web fonts arrive (Roboto Condensed stands in for Arial Narrow on iPad) */
function useFontsVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) return;
    let alive = true;
    const bump = () => {
      if (!alive) return;
      resetTextMeasureCache();
      setV(x => x + 1);
    };
    fonts.ready.then(bump).catch(NOOP);
    fonts.addEventListener?.('loadingdone', bump);
    return () => {
      alive = false;
      fonts.removeEventListener?.('loadingdone', bump);
    };
  }, []);
  return v;
}

/**
 * Renders any instrument from (spec, layout). Elements are positioned in mm and
 * multiplied by layout.pxPerMm. Patch cables live in an SVG overlay that uses the
 * same coordinate space, so they stay glued to their jacks at any zoom level.
 *
 * Every element is its own memoised component: turning one knob re-renders that
 * knob, and an LED blinking re-renders that LED - not the panel.
 */
function SynthPanel(props: SynthPanelProps) {
  const { spec, layout, values, engineState } = props;
  const k = layout.pxPerMm;
  const px = useCallback((mm: number) => mm * k, [k]);
  const theme = layout.theme;

  // Without an engine source, the engineState prop drives it (as before)
  const fallbackSrc = useMemo<EngineSource>(() => ({ get: () => engineState, subscribe: NO_SUBSCRIBE }), [engineState]);
  const src = props.engineSource ?? fallbackSrc;
  const base = useMemo(() => ({ values, data: props.data, ui: props.ui ?? EMPTY_UI }), [values, props.data, props.ui]);

  const jacks = useMemo(() => {
    const all: Record<string, PatchPoint> = {};
    spec.patchBay?.inputs.forEach(j => (all[j.id] = j));
    spec.patchBay?.outputs.forEach(j => (all[j.id] = j));
    return all;
  }, [spec]);

  const jackPos = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    layout.elements.forEach(el => {
      if (el.kind === 'jack') pos[el.jack] = { x: el.x * k, y: el.y * k };
    });
    return pos;
  }, [layout, k]);

  const geo = useMemo(() => analyseLayout(layout, spec), [layout, spec]);

  // Encoders bound by a function follow the selected track/page (they read values, not engine state)
  const ctxNow: PanelContext = { ...base, engine: src.get() };
  const resolved = layout.elements.map(el =>
    (el.kind === 'knob' || el.kind === 'stepgrid') && typeof el.control === 'function' ? el.control(ctxNow) : null);
  const resolvedSig = resolved.join('\u0001');
  const scale = Math.round((props.scale ?? 1) * 50) / 50;
  const fontsVersion = useFontsVersion();
  const fits = useMemo(() => {
    const labels = layout.elements.map((el, i) => elementLabel(el, spec, resolved[i]));
    const valueSpecs = layout.elements.map((el, i) => {
      if (el.kind === 'knob') {
        const id = resolved[i] ?? (typeof el.control === 'string' ? el.control : null);
        const s = id ? spec.controls[id] : undefined;
        return s && s.type === 'knob' ? (s as KnobSpec) : undefined;
      }
      return undefined;
    });
    const f = computeTextFits(layout, spec, geo, scale, { labels, valueSpecs });
    // Legibility tooling: the fit decisions of the last panel drawn
    if (f.debug) (window as unknown as { __panelFits?: unknown }).__panelFits = f.debug;
    return f;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, spec, geo, scale, resolvedSig, fontsVersion]);

  const cheek = theme.cheeks ? px(theme.cheeks.width) : 0;
  const frame = theme.frame ? px(theme.frame.padding) : 0;
  const faceW = px(layout.width);
  const faceH = px(layout.height);

  return (
    <div
      className="relative"
      style={{
        width: faceW + cheek * 2 + frame * 2,
        height: faceH + frame * 2,
        background: theme.frame?.background ?? 'transparent',
        borderRadius: theme.frame?.radius !== undefined ? px(theme.frame.radius) : 10,
        boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
        fontFamily: theme.font ?? FONTS.sans,
      }}
    >
      {theme.cheeks && (
        <>
          <div className="absolute left-0 top-0 rounded-l-lg" style={{ width: cheek, height: faceH + frame * 2, background: theme.cheeks.background, boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.5)' }} />
          <div className="absolute right-0 top-0 rounded-r-lg" style={{ width: cheek, height: faceH + frame * 2, background: theme.cheeks.background, boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.5)' }} />
        </>
      )}
      <Faceplate
        {...props}
        src={src}
        base={base}
        ctxNow={ctxNow}
        jacks={jacks}
        jackPos={jackPos}
        left={cheek + frame}
        top={frame}
        width={faceW}
        height={faceH}
        px={px}
        geo={geo}
        fits={fits}
        resolved={resolved}
        scaleNow={scale}
      />
    </div>
  );
}

type Base = { values: Values; data: unknown; ui: Record<string, unknown> };

interface FaceplateProps extends SynthPanelProps {
  src: EngineSource;
  base: Base;
  ctxNow: PanelContext;
  jacks: Record<string, PatchPoint>;
  jackPos: Record<string, { x: number; y: number }>;
  left: number;
  top: number;
  width: number;
  height: number;
  px: (mm: number) => number;
  geo: ElementInfo[];
  fits: PanelTextFits;
  resolved: (string | null)[];
  scaleNow: number;
}

function Faceplate(p: FaceplateProps) {
  const { layout, spec, values, src, base, teaching, step, px, width, height, geo, fits, resolved, scaleNow } = p;
  const theme = layout.theme;
  const focus = p.focus ?? null;
  const touchNative = TOUCH_PX / Math.max(0.35, scaleNow || 1);

  // --- helpers ---------------------------------------------------------------
  const target = (id: string | null): ControlValue | undefined =>
    teaching && step && id && step.control === id ? step.targetValue : undefined;
  const isTarget = (id: string | null) => !!(teaching && step && id && step.control === id);
  const spotOf = (id: string | null | undefined): 'focus' | null => (focus && id && focus.has(id) && !isTarget(id) ? 'focus' : null);
  /** Touch target: 44 CSS px where the neighbours leave room, never smaller than drawn */
  const hitFor = (i: number, visual: number) => Math.max(visual, Math.min(touchNative, geo[i].nearest * 0.95));
  const resolvedKey = resolved.join('\u0001');

  // Focus mode: which elements stay lit
  const lit = useMemo(() => {
    if (!focus) return null;
    const on: boolean[] = layout.elements.map((el, i) => {
      switch (el.kind) {
        case 'knob': case 'stepgrid': {
          const id = resolved[i] ?? (typeof el.control === 'string' ? el.control : null);
          return !!id && focus.has(id);
        }
        case 'slider': case 'switch': return focus.has(el.control);
        case 'button': return !!((el.control && focus.has(el.control)) || (el.event && focus.has(el.event)));
        case 'jack': return focus.has(el.jack);
        case 'keyboard': return focus.has('keyboard');
        default: return true; // sections, screens, LEDs, custom pieces stay as they are
      }
    });
    // Printed legends follow their control
    layout.elements.forEach((el, i) => {
      if (el.kind === 'label') on[i] = geo[i].owner >= 0 && on[geo[i].owner];
    });
    // A section title stays lit when something lit sits inside the section
    layout.elements.forEach((el, i) => {
      if (el.kind !== 'section' || !el.title) return;
      const x0 = px(el.x), y0 = px(el.y), x1 = px(el.x + el.w), y1 = px(el.y + el.h);
      on[i] = geo.some((g, j) => j !== i && on[j] && ['knob', 'slider', 'switch', 'button', 'jack', 'stepgrid'].includes(g.kind)
        && g.cx >= x0 && g.cx <= x1 && g.cy >= y0 && g.cy <= y1);
    });
    return on;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, layout, geo, resolvedKey]);
  const dimmed = (i: number) => !!lit && !lit[i];

  // Custom elements' events count as presses too (trig keys, pads drawn by the device)
  const onPress = p.onPress;
  const onEvent = p.onEvent;
  const sendEvent = useCallback((name: string, payload?: unknown) => {
    onEvent(name, payload);
    if (onPress && !name.endsWith(':up')) onPress([name]);
  }, [onEvent, onPress]);

  const highlightedJacks = teaching && step?.patchFrom && step?.patchTo ? [step.patchFrom, step.patchTo] : [];
  const targetPatchDone = highlightedJacks.length === 2 && p.patches.some(
    c => (c.from === step!.patchFrom && c.to === step!.patchTo) || (c.from === step!.patchTo && c.to === step!.patchFrom),
  );
  const instanceId = p.instance ?? p.spec.id;

  // --- element renderers ----------------------------------------------------
  const renderElement = (el: PanelElement, i: number) => {
    switch (el.kind) {
      case 'section':
        return <SectionEl key={i} el={el} px={px} theme={theme} fit={fits.title[i]} dim={dimmed(i)} />;

      case 'label':
        return <LabelEl key={i} el={el} px={px} theme={theme} fit={fits.label[i]} dim={dimmed(i)} />;

      case 'knob': {
        const id = resolved[i] ?? (typeof el.control === 'string' ? el.control : null);
        const s = id ? (spec.controls[id] as KnobSpec | undefined) : undefined;
        const d = px(el.diameter ?? 12);
        return (
          <KnobEl
            key={i}
            el={el}
            id={id}
            spec={s && s.type === 'knob' ? s : undefined}
            value={id ? (values[id] as number | undefined) : undefined}
            onChange={p.onChange}
            x={px(el.x)}
            y={px(el.y)}
            d={d}
            labelColor={theme.text}
            highlighted={isTarget(id)}
            targetValue={target(id) as number | undefined}
            showTarget={teaching}
            dim={dimmed(i)}
            spot={spotOf(id)}
            labelFit={fits.label[i]}
            valueFit={fits.value[i]}
            hitSize={hitFor(i, d)}
            travel={layout.knobTravel}
          />
        );
      }

      case 'slider': {
        const s = spec.controls[el.control] as SliderSpec | undefined;
        if (!s || s.type !== 'slider') return null;
        return (
          <SliderEl
            key={i}
            el={el}
            spec={s}
            value={values[el.control] as number | undefined}
            onChange={p.onChange}
            x={px(el.x)}
            y={px(el.y)}
            length={px(el.length)}
            labelColor={theme.text}
            highlighted={isTarget(el.control)}
            targetValue={target(el.control) as number | undefined}
            dim={dimmed(i)}
            spot={spotOf(el.control)}
            labelFit={fits.label[i]}
            hitSize={Math.max(30, Math.min(touchNative, geo[i].nearest * 0.95))}
          />
        );
      }

      case 'switch': {
        const s = spec.controls[el.control] as SwitchSpec | undefined;
        if (!s || s.type !== 'switch') return null;
        return (
          <SwitchEl
            key={i}
            el={el}
            spec={s}
            value={values[el.control] as number | undefined}
            onChange={p.onChange}
            x={px(el.x)}
            y={px(el.y) + (fits.shift[i] ?? 0)}
            labelColor={theme.muted ?? theme.text}
            highlighted={isTarget(el.control)}
            targetValue={target(el.control) as number | undefined}
            dim={dimmed(i)}
            spot={spotOf(el.control)}
            labelFit={fits.label[i]}
            legendFit={fits.legend[i]}
          />
        );
      }

      case 'button': {
        const controlSpec = el.control ? spec.controls[el.control] : undefined;
        const isRadio = el.setValue !== undefined;
        const current = el.control ? values[el.control] : undefined;
        const staticLit = el.lit ? 0 : quantize(isRadio ? current === el.setValue : !!(el.control && current));
        const pressTarget = !!(teaching && step && ((el.event && step.event === el.event) || (el.control && step.control === el.control && controlSpec?.type === 'button' && ((controlSpec as ButtonSpec).momentary || step.presses !== undefined))));
        const highlighted = pressTarget || !!(teaching && step && el.control && step.control === el.control && (!isRadio || step.targetValue === el.setValue));
        const correct = highlighted && (pressTarget ? !!p.stepDone : isValueOnTarget(controlSpec, current, step!.targetValue));
        const w = px(el.w ?? 7);
        const hgt = el.shape === 'rect' ? (el.h !== undefined ? px(el.h) : w * 0.6) : w;
        return (
          <ButtonEl
            key={i}
            el={el}
            controlSpec={controlSpec}
            current={current}
            staticLit={staticLit}
            src={src}
            base={el.lit ? base : NO_BASE}
            onChange={p.onChange}
            onEvent={p.onEvent}
            onPress={onPress}
            x={px(el.x)}
            y={px(el.y)}
            w={w}
            h={hgt}
            labelColor={theme.muted ?? theme.text}
            highlighted={highlighted}
            correct={correct}
            dim={dimmed(i)}
            spot={spotOf(el.control) ?? spotOf(el.event)}
            labelFit={fits.label[i]}
            capFit={fits.legend[i]}
            hitSize={hitFor(i, Math.max(w, hgt))}
          />
        );
      }

      case 'jack': {
        const j = p.jacks[el.jack];
        if (!j) return null;
        const isHl = highlightedJacks.includes(el.jack);
        const studioActive = !!p.patchController && p.patchController.active?.instance === instanceId && p.patchController.active?.jack === el.jack;
        return (
          <JackEl
            key={i}
            el={el}
            jack={j}
            x={px(el.x)}
            y={px(el.y)}
            d={px(6.2)}
            theme={theme}
            highlighted={isHl}
            done={targetPatchDone}
            active={studioActive}
            dim={dimmed(i)}
            spot={spotOf(el.jack)}
            fit={fits.label[i]}
          />
        );
      }

      case 'led':
        return <LedEl key={i} el={el} src={src} base={base} x={px(el.x)} y={px(el.y)} d={px(el.size ?? 2.5)} />;

      case 'display':
        return <DisplayEl key={i} el={el} px={px} src={src} base={base} floor={floorPx(9, scaleNow)} />;

      case 'keyboard':
        return (
          <div key={i} className={`absolute ${styles.dimmable}`} style={{ left: px(el.x), top: px(el.y), width: px(el.w), height: px(el.h), ...dimStyle(dimmed(i)) }}>
            <Keyboard
              lowNote={el.lowNote}
              numKeys={el.numKeys}
              style={el.style}
              held={p.heldNotes}
              onNoteOn={p.onNoteOn}
              onNoteOff={p.onNoteOff}
            />
          </div>
        );

      case 'stepgrid': {
        const id = resolved[i] ?? (typeof el.control === 'string' ? el.control : null);
        const s = id ? (spec.controls[id] as PatternSpec | undefined) : undefined;
        const pattern = id ? ((values[id] as string) ?? s?.default ?? '') : '';
        const tgt = target(id);
        return (
          <StepGridEl
            key={i}
            el={el}
            id={id}
            pattern={pattern}
            src={src}
            base={base}
            target={typeof tgt === 'string' ? tgt : undefined}
            highlighted={isTarget(id)}
            onChange={p.onChange}
            px={px}
            dim={dimmed(i)}
            numberSize={floorPx(9, scaleNow)}
          />
        );
      }

      case 'custom':
        return (
          <CustomEl
            key={i}
            el={el}
            px={px}
            src={src}
            base={base}
            setValue={p.onChange}
            sendEvent={sendEvent}
            teaching={teaching}
            step={step}
            updateData={p.updateData ?? NOOP}
            setUi={p.setUi ?? NOOP}
            instance={instanceId}
          />
        );
    }
  };

  // Draw sections first, then everything else in declaration order
  const ordered = useMemo(() => {
    const idx = layout.elements.map((e, i) => ({ e, i }));
    return [...idx.filter(x => x.e.kind === 'section'), ...idx.filter(x => x.e.kind !== 'section')];
  }, [layout]);

  const jackHits = useMemo(() => layout.elements
    .map((el, i) => (el.kind === 'jack' && p.jacks[el.jack]
      ? { jack: el.jack, x: px(el.x), y: px(el.y), d: Math.max(px(7.5), Math.min(touchNative, geo[i].nearest * 0.95)) }
      : null))
    .filter((x): x is { jack: string; x: number; y: number; d: number } => !!x),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [layout, p.jacks, px, touchNative, geo]);

  return (
    <div
      className="absolute"
      style={{ left: p.left, top: p.top, width, height, background: theme.background, borderRadius: 4, overflow: 'visible', color: theme.text }}
    >
      {ordered.map(({ e, i }) => renderElement(e, i))}
      <PatchLayer
        jacks={p.jacks}
        jackPos={p.jackPos}
        hits={jackHits}
        patches={p.patches}
        onPatch={p.onPatch}
        onUnpatch={p.onUnpatch}
        patchController={p.patchController}
        instanceId={instanceId}
        width={width}
        height={height}
        jackRadius={px(3.1)}
        demo={p.demoPatch ?? null}
      />
    </div>
  );
}

// ---- element components (memoised: they re-render only when their own props change) ----

// Opacity only: a filter on dozens of elements is expensive to composite on iPad
const dimStyle = (dim: boolean): React.CSSProperties => ({ opacity: dim ? 0.28 : 1 });

function Anchor({ x, y, children, dim }: { x: number; y: number; children: React.ReactNode; dim?: boolean }) {
  return (
    // max-content stops elements near the panel's right edge from being squeezed (and their text wrapping)
    <div
      className={`absolute ${styles.dimmable}`}
      style={{ left: x, top: y, width: 'max-content', transform: 'translate(-50%, -50%)', ...dimStyle(!!dim) }}
    >
      {children}
    </div>
  );
}

const SectionEl = memo(function SectionEl({ el, px, theme, fit, dim }: { el: SectionElement; px: (mm: number) => number; theme: PanelTheme; fit?: TextFit; dim: boolean }) {
  const size = fit?.size ?? 8;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: px(el.x), top: px(el.y), width: px(el.w), height: px(el.h),
        border: el.border ?? 'none', background: el.background ?? 'transparent',
        borderRadius: el.radius !== undefined ? px(el.radius) : 4,
      }}
    >
      {el.title && (
        <div
          className={`absolute left-1/2 font-bold whitespace-nowrap px-1 ${styles.dimmable}`}
          title={fit?.title}
          style={{
            top: -Math.round(size * 0.75), fontSize: size, lineHeight: 1.15,
            transform: fitTransform(fit, 'translateX(-50%)'),
            color: fit?.color ?? el.titleColor ?? theme.muted ?? theme.text, background: el.background ?? 'transparent', letterSpacing: '0.6px',
            ...dimStyle(dim),
          }}
        >
          {fit?.text ?? el.title}
        </div>
      )}
    </div>
  );
});

const LabelEl = memo(function LabelEl({ el, px, theme, fit, dim }: { el: LabelElement; px: (mm: number) => number; theme: PanelTheme; fit?: TextFit; dim: boolean }) {
  const base = `translate(${el.align === 'left' ? '0' : el.align === 'right' ? '-100%' : '-50%'}, -50%)${el.rotate ? ` rotate(${el.rotate}deg)` : ''}`;
  return (
    <div
      className={`absolute whitespace-pre pointer-events-none leading-none ${styles.dimmable}`}
      title={fit?.title}
      style={{
        left: px(el.x), top: px(el.y) + (fit?.dy ?? 0),
        transform: fitTransform(fit, base),
        transformOrigin: el.align === 'left' ? 'left center' : el.align === 'right' ? 'right center' : 'center',
        fontSize: fit?.size ?? el.size ?? 8,
        color: fit?.color ?? (el.invert ? theme.jack?.outputLabelText ?? '#000' : el.color ?? theme.text),
        background: el.invert ? theme.jack?.outputLabelBg ?? '#fff' : undefined,
        padding: el.invert ? '1px 3px' : undefined,
        borderRadius: el.invert ? 2 : undefined,
        fontWeight: el.weight ?? 700,
        fontFamily: el.font ? FONTS[el.font] : undefined,
        fontStyle: el.italic ? 'italic' : undefined,
        letterSpacing: el.letterSpacing !== undefined ? `${el.letterSpacing}px` : undefined,
        textAlign: el.align ?? 'center',
        ...dimStyle(dim),
      }}
    >
      {fit?.text ?? el.text}
    </div>
  );
});

interface KnobElProps {
  el: KnobElement;
  id: string | null;
  spec?: KnobSpec;
  value?: number;
  onChange: (id: string, v: ControlValue) => void;
  x: number;
  y: number;
  d: number;
  labelColor: string;
  highlighted: boolean;
  targetValue?: number;
  showTarget: boolean;
  dim: boolean;
  spot: 'focus' | null;
  labelFit?: TextFit;
  valueFit?: TextFit;
  hitSize: number;
  travel?: number;
}

const KnobEl = memo(function KnobEl({ el, id, spec, value, onChange, x, y, d, labelColor, highlighted, targetValue, showTarget, dim, spot, labelFit, valueFit, hitSize, travel }: KnobElProps) {
  const change = useCallback((v: number) => { if (id) onChange(id, v); }, [id, onChange]);
  return (
    <Anchor x={x} y={y} dim={dim}>
      {spec && id ? (
        <Knob
          id={id}
          spec={spec}
          value={value ?? spec.default}
          onChange={change}
          diameter={d}
          variant={el.variant}
          capColor={el.capColor}
          label={el.label}
          labelText={el.labelText}
          labelColor={labelColor}
          valueDisplay={el.value}
          highlighted={highlighted}
          targetValue={targetValue}
          showTarget={showTarget}
          labelFit={labelFit}
          valueFit={valueFit}
          hitSize={hitSize}
          spot={spot}
          travel={travel}
        />
      ) : (
        // Unbound encoder (nothing on this page) - draw an inert cap
        <div className="rounded-full opacity-50" style={{ width: d, height: d, background: 'repeating-conic-gradient(#202020 0deg 6deg, #2e2e2e 6deg 12deg)', border: '1px solid #444' }} />
      )}
    </Anchor>
  );
});

interface SliderElProps {
  el: SliderElement;
  spec: SliderSpec;
  value?: number;
  onChange: (id: string, v: ControlValue) => void;
  x: number;
  y: number;
  length: number;
  labelColor: string;
  highlighted: boolean;
  targetValue?: number;
  dim: boolean;
  spot: 'focus' | null;
  labelFit?: TextFit;
  hitSize: number;
}

const SliderEl = memo(function SliderEl({ el, spec, value, onChange, x, y, length, labelColor, highlighted, targetValue, dim, spot, labelFit, hitSize }: SliderElProps) {
  const change = useCallback((v: number) => onChange(el.control, v), [el.control, onChange]);
  return (
    <Anchor x={x} y={y} dim={dim}>
      <Slider
        id={el.control}
        spec={spec}
        value={value ?? spec.default}
        onChange={change}
        length={length}
        orientation={el.orientation}
        capColor={el.capColor}
        label={el.label}
        labelText={el.labelText}
        labelColor={labelColor}
        valueDisplay={el.value}
        highlighted={highlighted}
        targetValue={targetValue}
        labelFit={labelFit}
        hitSize={hitSize}
        spot={spot}
      />
    </Anchor>
  );
});

interface SwitchElProps {
  el: SwitchElement;
  spec: SwitchSpec;
  value?: number;
  onChange: (id: string, v: ControlValue) => void;
  x: number;
  y: number;
  labelColor: string;
  highlighted: boolean;
  targetValue?: number;
  dim: boolean;
  spot: 'focus' | null;
  labelFit?: TextFit;
  legendFit?: TextFit;
}

const SwitchEl = memo(function SwitchEl({ el, spec, value, onChange, x, y, labelColor, highlighted, targetValue, dim, spot, labelFit, legendFit }: SwitchElProps) {
  const change = useCallback((v: number) => onChange(el.control, v), [el.control, onChange]);
  return (
    <Anchor x={x} y={y} dim={dim}>
      <Switch
        id={el.control}
        spec={spec}
        value={value ?? spec.default}
        onChange={change}
        orientation={el.orientation}
        style={el.style}
        label={el.label}
        labelText={el.labelText}
        labelColor={labelColor}
        scale={el.scale}
        highlighted={highlighted}
        targetValue={targetValue}
        labelFit={labelFit}
        legendFit={legendFit}
        spot={spot}
      />
    </Anchor>
  );
});

interface ButtonElProps {
  el: ButtonElement;
  controlSpec: DeviceSpec['controls'][string] | undefined;
  /** The control's own value (toggle state) */
  current: ControlValue | undefined;
  /** Light from the control's value (used when the layout gives no `lit`) */
  staticLit: number;
  src: EngineSource;
  base: Base;
  onChange: (id: string, v: ControlValue) => void;
  onEvent: (name: string, payload?: unknown) => void;
  onPress?: (ids: string[]) => void;
  x: number;
  y: number;
  w: number;
  h: number;
  labelColor: string;
  highlighted: boolean;
  correct: boolean;
  dim: boolean;
  spot: 'focus' | null;
  labelFit?: TextFit;
  capFit?: TextFit;
  hitSize: number;
}

const ButtonEl = memo(function ButtonEl({ el, controlSpec, current, staticLit, src, base, onChange, onEvent, onPress, x, y, w, h, labelColor, highlighted, correct, dim, spot, labelFit, capFit, hitSize }: ButtonElProps) {
  const isRadio = el.setValue !== undefined;
  const momentary = controlSpec?.type === 'button' && !!(controlSpec as ButtonSpec).momentary;
  // A layout `lit` may follow the engine (RUN lit while playing): only this button re-renders
  const lit = useEngineValue(src, e => (el.lit ? quantize(el.lit({ ...base, engine: e })) : staticLit)) ?? 0;
  // The control's own value, read at press time (its light may show engine state instead)
  const currentRef = useRef(current);
  currentRef.current = current;

  const press = useCallback(() => {
    if (el.control) {
      if (isRadio) onChange(el.control, el.setValue!);
      else if (momentary) onChange(el.control, true);
      else onChange(el.control, !currentRef.current);
    }
    if (el.event) onEvent(el.event);
    const ids = [el.control, el.event].filter((v, i, a): v is string => !!v && a.indexOf(v) === i);
    if (ids.length) onPress?.(ids);
  }, [el, isRadio, momentary, onChange, onEvent, onPress]);
  const release = useCallback(() => {
    if (el.control && momentary && !isRadio) onChange(el.control, false);
    if (el.event) onEvent(`${el.event}:up`);
  }, [el, isRadio, momentary, onChange, onEvent]);

  const radioLabel = isRadio && controlSpec?.type === 'switch' ? (controlSpec as SwitchSpec).options[el.setValue as number] : undefined;
  const label = el.labelText ?? radioLabel ?? (controlSpec ? controlSpec.label : undefined);
  return (
    <Anchor x={x} y={y} dim={dim}>
      <Button
        id={el.control ?? el.event ?? 'button'}
        label={label}
        description={controlSpec?.description}
        lit={lit as number}
        onPress={press}
        onRelease={release}
        shape={el.shape}
        width={w}
        height={el.shape === 'rect' ? h : undefined}
        color={el.color}
        ledColor={el.ledColor}
        labelPosition={el.label ?? (el.labelText || controlSpec ? 'above' : 'none')}
        labelColor={labelColor}
        capText={el.capText}
        highlighted={highlighted}
        correct={correct}
        labelFit={labelFit}
        capFit={capFit}
        hitSize={hitSize}
        spot={spot}
        momentary={momentary || (!el.control && !!el.event)}
      />
    </Anchor>
  );
});

interface JackElProps {
  el: JackElement;
  jack: PatchPoint;
  x: number;
  y: number;
  d: number;
  theme: PanelTheme;
  highlighted: boolean;
  done: boolean;
  active: boolean;
  dim: boolean;
  spot: 'focus' | null;
  fit?: TextFit;
}

const JackEl = memo(function JackEl({ el, jack, x, y, d, theme, highlighted, done, active, dim, spot, fit }: JackElProps) {
  const isOut = jack.jackType === 'output';
  const lp = el.label ?? 'above';
  const ring = active ? '#fff' : highlighted ? (done ? '#22c55e' : '#f97316') : theme.jack?.ring ?? '#555';
  const size = fit?.size ?? 6.5;
  const placement: React.CSSProperties = lp === 'below'
    ? { top: '100%', marginTop: 2, left: '50%', transform: 'translateX(-50%)' }
    : lp === 'left'
    ? { right: '100%', marginRight: 3, top: '50%', transform: 'translateY(-50%)', transformOrigin: 'right center' }
    : lp === 'right'
    ? { left: '100%', marginLeft: 3, top: '50%', transform: 'translateY(-50%)', transformOrigin: 'left center' }
    : { bottom: '100%', marginBottom: 2, left: '50%', transform: 'translateX(-50%)' };
  return (
    <Anchor x={x} y={y} dim={dim}>
      <div className="relative" style={{ width: d, height: d }}>
        {lp !== 'none' && (
          <div
            className="absolute whitespace-nowrap font-bold leading-none pointer-events-none"
            title={fit?.title}
            style={{
              ...placement,
              transform: fitTransform(fit, placement.transform as string | undefined),
              fontSize: size,
              color: fit?.color ?? (isOut ? theme.jack?.outputLabelText ?? '#fff' : theme.muted ?? '#999'),
              background: isOut ? theme.jack?.outputLabelBg ?? '#000' : 'transparent',
              border: isOut ? '1px solid #444' : '1px solid transparent',
              // Input legends have no box, so no side padding: more room for legible text
              padding: isOut ? '1px 3px' : '1px 1px',
              borderRadius: 2,
            }}
          >
            {fit?.text ?? el.labelText ?? jack.label}
          </div>
        )}
        {(highlighted && !done) || spot ? (
          <div className={`${styles.ring} ${highlighted && !done ? styles.ringTarget : styles.ringFocus}`} style={{ inset: -4 }} />
        ) : null}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          title={`${jack.label} (${isOut ? 'output' : 'input'}, ${jack.signalType})`}
          style={{
            background: 'radial-gradient(circle at 30% 30%, #3a3a3a 0%, #111 100%)',
            border: `2px solid ${ring}`,
            boxShadow: highlighted ? `0 0 10px ${done ? '#22c55e' : '#f97316'}, inset 0 2px 4px rgba(0,0,0,0.7)` : 'inset 0 2px 4px rgba(0,0,0,0.7)',
            transform: active || (highlighted && !done) ? 'scale(1.18)' : undefined,
            transition: 'transform 100ms',
          }}
        >
          <div className="absolute rounded-full" style={{ inset: '30%', background: '#000' }} />
        </div>
      </div>
    </Anchor>
  );
});

const LedEl = memo(function LedEl({ el, src, base, x, y, d }: { el: LedElement; src: EngineSource; base: Base; x: number; y: number; d: number }) {
  const amount = (useEngineValue(src, e => quantize(el.on({ ...base, engine: e }))) as number | undefined) ?? 0;
  const color = el.color ?? '#ff3333';
  return (
    <div className="absolute" style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}>
      <div
        className="rounded-full pointer-events-none"
        style={{
          width: d, height: d,
          background: amount > 0.02 ? color : '#2a1212',
          opacity: amount > 0.02 ? 0.35 + 0.65 * amount : 1,
          boxShadow: amount > 0.02 ? `0 0 ${4 + 6 * amount}px ${color}` : 'inset 0 1px 2px #000',
        }}
      />
    </div>
  );
});

const DisplayEl = memo(function DisplayEl({ el, px, src, base, floor }: { el: DisplayElement; px: (mm: number) => number; src: EngineSource; base: Base; floor: number }) {
  const engine = useEngine(src);
  const content = el.render({ ...base, engine });
  const isLines = Array.isArray(content);
  const style = el.style ?? 'oled';
  const w = px(el.w);
  const h = px(el.h);
  // Screens of text lines: as large as legible, within the screen's room
  let fontSize = 9;
  if (isLines) {
    const lines = content as string[];
    const chars = Math.max(1, ...lines.map(l => l.length));
    fontSize = Math.max(7, Math.min(Math.max(9, floor), (h - 10) / (Math.max(1, lines.length) * 1.25), (w - 10) / (chars * 0.62)));
  }
  return (
    <div
      className="absolute overflow-hidden font-mono"
      style={{
        left: px(el.x), top: px(el.y), width: w, height: h,
        background: style === 'lcd' ? 'linear-gradient(#9fb56a, #8aa257)' : '#050805',
        color: style === 'lcd' ? '#1b2410' : style === 'led-segment' ? '#ff3b2f' : '#e8f0ff',
        border: '2px solid #222',
        borderRadius: 3,
        boxShadow: 'inset 0 0 8px rgba(0,0,0,0.8)',
        padding: 4,
        fontSize,
        lineHeight: 1.25,
        textShadow: style === 'oled' ? '0 0 3px rgba(200,220,255,0.6)' : undefined,
      }}
    >
      {isLines ? (content as string[]).map((l, li) => <div key={li} className="whitespace-pre truncate">{l}</div>) : content}
    </div>
  );
});

interface CustomElProps {
  el: CustomElement;
  px: (mm: number) => number;
  src: EngineSource;
  base: Base;
  setValue: (id: string, v: ControlValue) => void;
  sendEvent: (e: string, payload?: unknown) => void;
  teaching: boolean;
  step: LessonStep | null;
  updateData: (fn: (draft: unknown) => unknown) => void;
  setUi: (patch: Record<string, unknown>) => void;
  instance: string;
}

/** A device-drawn piece: it re-renders with the engine (screens, meters) without re-rendering the panel */
const CustomEl = memo(function CustomEl({ el, px, src, base, setValue, sendEvent, teaching, step, updateData, setUi, instance }: CustomElProps) {
  const engine = useEngine(src);
  return (
    <div data-panel-custom="" className="absolute pointer-events-none [&>*]:pointer-events-auto" style={{ left: px(el.x), top: px(el.y), width: px(el.w), height: px(el.h) }}>
      {el.render({ ...base, engine, setValue, sendEvent, teaching, step, data: base.data, ui: base.ui, updateData, setUi, instance })}
    </div>
  );
});

interface StepGridElProps {
  el: StepGridElement;
  id: string | null;
  pattern: string;
  src: EngineSource;
  base: Base;
  target?: string;
  highlighted: boolean;
  onChange: (id: string, v: ControlValue) => void;
  px: (mm: number) => number;
  dim: boolean;
  numberSize: number;
}

const StepGridEl = memo(function StepGridEl({ el, id, pattern, src, base, target, highlighted, onChange, px, dim, numberSize }: StepGridElProps) {
  const playhead = useEngineValue(src, e => (el.playhead ? el.playhead({ ...base, engine: e }) : undefined)) as number | undefined;
  const padded = pattern.padEnd(el.steps, '0');
  const toggle = useCallback((idx: number) => {
    if (!id) return;
    const arr = padded.split('');
    arr[idx] = arr[idx] === '0' ? '1' : '0';
    onChange(id, arr.join(''));
  }, [id, padded, onChange]);
  // Step numbers: legible, but never taller than about 40% of a key
  const keyH = px(el.h) / Math.max(1, el.rows ?? 1) - 3;
  const num = Math.min(numberSize, Math.max(7, keyH * 0.42));
  return (
    <div className={`absolute ${styles.dimmable}`} style={{ left: px(el.x), top: px(el.y), width: px(el.w), height: px(el.h), ...dimStyle(dim) }}>
      <StepGrid
        steps={el.steps}
        rows={el.rows ?? 1}
        pattern={padded}
        playhead={playhead}
        color={el.color}
        numbered={el.numbered}
        target={target}
        highlighted={highlighted}
        onToggle={toggle}
        numberSize={num}
      />
    </div>
  );
});

// ---- patching: cables, jack targets and the cable being drawn (its own component, so a
//      cable drag re-renders this layer only) -------------------------------------------

interface PatchLayerProps {
  jacks: Record<string, PatchPoint>;
  jackPos: Record<string, { x: number; y: number }>;
  hits: { jack: string; x: number; y: number; d: number }[];
  patches: PatchConnection[];
  onPatch: (from: string, to: string) => void;
  onUnpatch: (from: string, to: string) => void;
  patchController?: PatchController;
  instanceId: string;
  width: number;
  height: number;
  jackRadius: number;
  demo: { from: string; to: string } | null;
}

const PatchLayer = memo(function PatchLayer(p: PatchLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<{ from: string; pointer: { x: number; y: number }; color: string } | null>(null);
  // Drag state lives in a ref: pointer events can arrive faster than React re-renders
  const drag = useRef<{ from: string; moved: boolean } | null>(null);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const el = rootRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const scale = r.width / p.width || 1;
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
  }, [p.width]);

  // A cable "in hand" (tapped, not dragged) follows the pointer; a press anywhere but a jack drops it
  const holding = active !== null;
  useEffect(() => {
    if (!holding) return;
    const move = (e: PointerEvent) => {
      if (drag.current?.moved) return;
      const pt = toLocal(e.clientX, e.clientY);
      setActive(a => (a ? { ...a, pointer: pt } : a));
    };
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.('[data-jack]') && rootRef.current?.contains(t)) return;
      drag.current = null;
      setActive(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', down, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down, true);
    };
  }, [holding, toLocal]);

  const jackUnder = (clientX: number, clientY: number): string | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const j = el?.closest('[data-jack]') as HTMLElement | null;
    return j && rootRef.current?.contains(j) ? j.dataset.jack ?? null : null;
  };

  const startOrFinish = (jackId: string, e: React.PointerEvent | null) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (active && active.from !== jackId) {
      p.onPatch(active.from, jackId);
      setActive(null);
      drag.current = null;
      return;
    }
    if (active && active.from === jackId) {
      setActive(null);
      drag.current = null;
      return;
    }
    if (e) { try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    drag.current = { from: jackId, moved: false };
    const origin = p.jackPos[jackId] ?? { x: 0, y: 0 };
    setActive({ from: jackId, pointer: e ? toLocal(e.clientX, e.clientY) : origin, color: cableColor(p.patches.length) });
  };

  const onJackMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const pt = toLocal(e.clientX, e.clientY);
    const origin = p.jackPos[d.from];
    if (!d.moved && origin && Math.hypot(pt.x - origin.x, pt.y - origin.y) > 12) d.moved = true;
    setActive(a => (a ? { ...a, pointer: pt } : a));
  };

  const onJackUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved) return; // tap: keep the cable "in hand" until the next tap
    drag.current = null;
    const over = jackUnder(e.clientX, e.clientY);
    if (over && over !== d.from) p.onPatch(d.from, over);
    setActive(null);
  };

  const tapJack = (jackId: string, e: React.PointerEvent | null) => {
    if (p.patchController) {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      p.patchController.tap(p.instanceId, jackId);
      return;
    }
    startOrFinish(jackId, e);
  };

  return (
    <>
      <Cables
        patches={p.patches}
        jackPos={p.jackPos}
        active={active ? { from: active.from, to: active.pointer, color: active.color } : null}
        onRemove={p.onUnpatch}
        width={p.width}
        height={p.height}
        jackRadius={p.jackRadius}
        demo={p.demo}
      />
      {/* Jack hit targets sit above the cables, so a patched jack can still start another cable */}
      <div ref={rootRef} className="absolute left-0 top-0 pointer-events-none" style={{ width: p.width, height: p.height, zIndex: 40 }}>
        {p.hits.map(h => {
          const j = p.jacks[h.jack];
          const name = `${j.label} ${j.jackType === 'output' ? 'output' : 'input'} jack (${j.signalType})`;
          return (
            <div
              key={h.jack}
              data-jack={h.jack}
              role="button"
              tabIndex={0}
              aria-label={name}
              onPointerDown={e => tapJack(h.jack, e)}
              onPointerMove={p.patchController ? undefined : onJackMove}
              onPointerUp={p.patchController ? undefined : onJackUp}
              onKeyDown={e => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); tapJack(h.jack, null); } }}
              title={name}
              className={`absolute rounded-full cursor-pointer pointer-events-auto ${styles.jackHit}`}
              style={{ left: h.x - h.d / 2, top: h.y - h.d / 2, width: h.d, height: h.d, touchAction: 'none' }}
            />
          );
        })}
      </div>
    </>
  );
});

function cablePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const sag = Math.min(dist * 0.35, 60) + 8;
  const midX = (a.x + b.x) / 2;
  const midY = Math.max(a.y, b.y) + sag;
  return `M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`;
}

const Cables = memo(function Cables({
  patches, jackPos, active, onRemove, width, height, jackRadius, demo,
}: {
  patches: PatchConnection[];
  jackPos: Record<string, { x: number; y: number }>;
  active: { from: string; to: { x: number; y: number }; color: string } | null;
  onRemove: (from: string, to: string) => void;
  width: number;
  height: number;
  jackRadius: number;
  demo: { from: string; to: string } | null;
}) {
  const plug = Math.max(5, jackRadius * 0.9);
  // A tap unplugs (press and release without moving): a finger resting on a cable does not
  const tap = useRef<{ id: number; x: number; y: number; key: string } | null>(null);
  return (
    <svg className="absolute left-0 top-0 pointer-events-none" width={width} height={height} style={{ overflow: 'visible', zIndex: 30 }}>
      {patches.map((c, i) => {
        const a = jackPos[c.from];
        const b = jackPos[c.to];
        if (!a || !b) return null;
        const d = cablePath(a, b);
        const color = c.color ?? cableColor(i);
        const key = `${c.from}-${c.to}`;
        return (
          <g key={key}>
            <path d={d} stroke="rgba(0,0,0,0.55)" strokeWidth={8} fill="none" strokeLinecap="round" transform="translate(1.5,3)" />
            <path d={d} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.95} />
            <path d={d} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} fill="none" strokeLinecap="round" transform="translate(-1,-1)" />
            {/* Wide invisible hit area - tap a cable to unplug it */}
            <path
              d={d}
              stroke="transparent"
              strokeWidth={18}
              fill="none"
              data-cable={key}
              style={{ pointerEvents: 'stroke', cursor: 'pointer', touchAction: 'none' }}
              onPointerDown={e => {
                e.stopPropagation();
                try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
                tap.current = { id: e.pointerId, x: e.clientX, y: e.clientY, key };
              }}
              onPointerUp={e => {
                const t = tap.current;
                tap.current = null;
                if (t && t.id === e.pointerId && t.key === key && Math.hypot(e.clientX - t.x, e.clientY - t.y) < TAP_SLOP) onRemove(c.from, c.to);
              }}
              onPointerCancel={() => { tap.current = null; }}
            >
              <title>Tap to unplug</title>
            </path>
            <circle cx={a.x} cy={a.y} r={plug} fill="#1a1a1a" stroke={color} strokeWidth={2.5} />
            <circle cx={b.x} cy={b.y} r={plug} fill="#1a1a1a" stroke={color} strokeWidth={2.5} />
          </g>
        );
      })}
      {active && jackPos[active.from] && (
        <g>
          <path d={cablePath(jackPos[active.from], active.to)} stroke={active.color} strokeWidth={5} fill="none" opacity={0.85} strokeDasharray="10,5" strokeLinecap="round" />
          {/* The jack the cable comes from */}
          <circle cx={jackPos[active.from].x} cy={jackPos[active.from].y} r={jackRadius + 3} fill="none" stroke="#fff" strokeWidth={2} />
          <circle cx={jackPos[active.from].x} cy={jackPos[active.from].y} r={plug} fill="#1a1a1a" stroke={active.color} strokeWidth={2.5} />
          <circle cx={active.to.x} cy={active.to.y} r={4} fill={active.color} />
        </g>
      )}
      {/* "Show me": a ghost cable drawn from one jack to the other */}
      {demo && jackPos[demo.from] && jackPos[demo.to] && (
        <g data-demo-cable="">
          <path d={cablePath(jackPos[demo.from], jackPos[demo.to])} className={styles.ghostCable} stroke="#fde68a" strokeWidth={5} fill="none" strokeLinecap="round" />
          <circle cx={jackPos[demo.from].x} cy={jackPos[demo.from].y} r={plug + 2} fill="none" stroke="#fde68a" strokeWidth={2.5} />
          <circle cx={jackPos[demo.to].x} cy={jackPos[demo.to].y} r={plug + 2} fill="none" stroke="#fde68a" strokeWidth={2.5} />
        </g>
      )}
    </svg>
  );
});

export default memo(SynthPanel);
