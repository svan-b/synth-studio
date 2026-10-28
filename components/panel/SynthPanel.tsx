'use client';

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { ControlValue, DeviceSpec, KnobSpec, LessonStep, PatchConnection, PatchPoint, SliderSpec, SwitchSpec, ButtonSpec, PatternSpec } from '@/types';
import type { EngineState, PanelContext, PanelElement, PanelLayout, Values, ButtonElement } from '@/types/panel';
import Knob from '@/components/controls/Knob';
import Slider from '@/components/controls/Slider';
import Switch from '@/components/controls/Switch';
import Button from '@/components/controls/Button';
import { isValueOnTarget } from '@/lib/controls/mapping';
import Keyboard from './Keyboard';
import StepGrid from './StepGrid';

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
  /** Spotlight: when set, elements not in the set are dimmed (focus mode in lessons) */
  focus?: Set<string> | null;
}

const NOOP = () => undefined;
const EMPTY_UI: Record<string, unknown> = {};

const FONTS: Record<string, string> = {
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  condensed: '"Arial Narrow", "Roboto Condensed", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, Menlo, monospace',
};

const CABLE_PALETTE = ['#22c55e', '#f97316', '#ef4444', '#06b6d4', '#a855f7', '#eab308', '#ec4899', '#3b82f6', '#14b8a6', '#f43f5e'];

export function cableColor(index: number) {
  return CABLE_PALETTE[index % CABLE_PALETTE.length];
}

/**
 * Renders any instrument from (spec, layout). Elements are positioned in mm and
 * multiplied by layout.pxPerMm. Patch cables live in an SVG overlay that uses the
 * same coordinate space, so they stay glued to their jacks at any zoom level.
 */
function SynthPanel(props: SynthPanelProps) {
  const { spec, layout, values, engineState, teaching, step } = props;
  const k = layout.pxPerMm;
  const px = (mm: number) => mm * k;
  const theme = layout.theme;
  const ctx: PanelContext = useMemo(
    () => ({ values, engine: engineState, data: props.data, ui: props.ui ?? EMPTY_UI }),
    [values, engineState, props.data, props.ui],
  );

  const jacks = useMemo(() => {
    const all: Record<string, PatchPoint> = {};
    spec.patchBay?.inputs.forEach(j => (all[j.id] = j));
    spec.patchBay?.outputs.forEach(j => (all[j.id] = j));
    return all;
  }, [spec]);

  const jackPos = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    layout.elements.forEach(el => {
      if (el.kind === 'jack') pos[el.jack] = { x: px(el.x), y: px(el.y) };
    });
    return pos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

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
        ctx={ctx}
        jacks={jacks}
        jackPos={jackPos}
        left={cheek + frame}
        top={frame}
        width={faceW}
        height={faceH}
        px={px}
      />
    </div>
  );
}

interface FaceplateProps extends SynthPanelProps {
  ctx: PanelContext;
  jacks: Record<string, PatchPoint>;
  jackPos: Record<string, { x: number; y: number }>;
  left: number;
  top: number;
  width: number;
  height: number;
  px: (mm: number) => number;
}

function Faceplate(p: FaceplateProps) {
  const { layout, spec, values, ctx, teaching, step, px, width, height } = p;
  const theme = layout.theme;
  const faceRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<{ from: string; pointer: { x: number; y: number }; color: string; moved: boolean } | null>(null);

  // --- helpers ---------------------------------------------------------------
  const value = (id: string): ControlValue | undefined => values[id];
  const target = (id: string | null): ControlValue | undefined =>
    teaching && step && id && step.control === id ? step.targetValue : undefined;
  const isTarget = (id: string | null) => !!(teaching && step && id && step.control === id);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const el = faceRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const scale = r.width / width || 1;
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
  }, [width]);

  // --- patching --------------------------------------------------------------
  const jackUnder = (clientX: number, clientY: number): string | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const j = el?.closest('[data-jack]') as HTMLElement | null;
    return j?.dataset.jack ?? null;
  };

  // Drag state lives in a ref: pointer events can arrive faster than React re-renders
  const drag = useRef<{ from: string; moved: boolean } | null>(null);

  const startOrFinish = (jackId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
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
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    drag.current = { from: jackId, moved: false };
    setActive({ from: jackId, pointer: toLocal(e.clientX, e.clientY), color: cableColor(p.patches.length), moved: false });
  };

  const onJackMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const pt = toLocal(e.clientX, e.clientY);
    const origin = p.jackPos[d.from];
    if (!d.moved && origin && Math.hypot(pt.x - origin.x, pt.y - origin.y) > 12) d.moved = true;
    setActive(a => (a ? { ...a, pointer: pt, moved: d.moved } : a));
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

  const onFaceMove = (e: React.PointerEvent) => {
    if (active && !drag.current?.moved) {
      const pt = toLocal(e.clientX, e.clientY);
      setActive(a => (a ? { ...a, pointer: pt } : a));
    }
  };

  const highlightedJacks = teaching && step?.patchFrom && step?.patchTo ? [step.patchFrom, step.patchTo] : [];
  const targetPatchDone = highlightedJacks.length === 2 && p.patches.some(
    c => (c.from === step!.patchFrom && c.to === step!.patchTo) || (c.from === step!.patchTo && c.to === step!.patchFrom),
  );

  // --- element renderers ----------------------------------------------------
  const renderElement = (el: PanelElement, i: number) => {
    switch (el.kind) {
      case 'section':
        return (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: px(el.x), top: px(el.y), width: px(el.w), height: px(el.h),
              border: el.border ?? 'none', background: el.background ?? 'transparent',
              borderRadius: el.radius !== undefined ? px(el.radius) : 4,
            }}
          >
            {el.title && (
              <div className="absolute left-1/2 -translate-x-1/2 font-bold whitespace-nowrap px-1" style={{ top: -6, fontSize: 8, color: el.titleColor ?? theme.muted ?? theme.text, background: el.background ?? 'transparent', letterSpacing: '0.6px' }}>
                {el.title}
              </div>
            )}
          </div>
        );

      case 'label':
        return (
          <div
            key={i}
            className="absolute whitespace-pre pointer-events-none leading-none"
            style={{
              left: px(el.x), top: px(el.y),
              transform: `translate(${el.align === 'left' ? '0' : el.align === 'right' ? '-100%' : '-50%'}, -50%)${el.rotate ? ` rotate(${el.rotate}deg)` : ''}`,
              fontSize: el.size ?? 8,
              color: el.invert ? theme.jack?.outputLabelText ?? '#000' : el.color ?? theme.text,
              background: el.invert ? theme.jack?.outputLabelBg ?? '#fff' : undefined,
              padding: el.invert ? '1px 3px' : undefined,
              borderRadius: el.invert ? 2 : undefined,
              fontWeight: el.weight ?? 700,
              fontFamily: el.font ? FONTS[el.font] : undefined,
              fontStyle: el.italic ? 'italic' : undefined,
              letterSpacing: el.letterSpacing !== undefined ? `${el.letterSpacing}px` : undefined,
              textAlign: el.align ?? 'center',
            }}
          >
            {el.text}
          </div>
        );

      case 'knob': {
        const id = typeof el.control === 'function' ? el.control(ctx) : el.control;
        const s = id ? (spec.controls[id] as KnobSpec | undefined) : undefined;
        return (
          <Anchor key={i} x={px(el.x)} y={px(el.y)}>
            {s && s.type === 'knob' ? (
              <Knob
                id={id!}
                spec={s}
                value={(value(id!) as number) ?? s.default}
                onChange={v => p.onChange(id!, v)}
                diameter={px(el.diameter ?? 12)}
                variant={el.variant}
                capColor={el.capColor}
                label={el.label}
                labelText={el.labelText}
                labelColor={theme.text}
                valueDisplay={el.value}
                highlighted={isTarget(id)}
                targetValue={target(id) as number | undefined}
                showTarget={teaching}
              />
            ) : (
              // Unbound encoder (nothing on this page) - draw an inert cap
              <div className="rounded-full opacity-50" style={{ width: px(el.diameter ?? 12), height: px(el.diameter ?? 12), background: 'repeating-conic-gradient(#202020 0deg 6deg, #2e2e2e 6deg 12deg)', border: '1px solid #444' }} />
            )}
          </Anchor>
        );
      }

      case 'slider': {
        const s = spec.controls[el.control] as SliderSpec | undefined;
        if (!s || s.type !== 'slider') return null;
        return (
          <Anchor key={i} x={px(el.x)} y={px(el.y)}>
            <Slider
              id={el.control}
              spec={s}
              value={(value(el.control) as number) ?? s.default}
              onChange={v => p.onChange(el.control, v)}
              length={px(el.length)}
              orientation={el.orientation}
              capColor={el.capColor}
              label={el.label}
              labelText={el.labelText}
              labelColor={theme.text}
              valueDisplay={el.value}
              highlighted={isTarget(el.control)}
              targetValue={target(el.control) as number | undefined}
            />
          </Anchor>
        );
      }

      case 'switch': {
        const s = spec.controls[el.control] as SwitchSpec | undefined;
        if (!s || s.type !== 'switch') return null;
        return (
          <Anchor key={i} x={px(el.x)} y={px(el.y)}>
            <Switch
              id={el.control}
              spec={s}
              value={(value(el.control) as number) ?? s.default}
              onChange={v => p.onChange(el.control, v)}
              orientation={el.orientation}
              style={el.style}
              label={el.label}
              labelText={el.labelText}
              labelColor={theme.muted ?? theme.text}
              scale={el.scale}
              highlighted={isTarget(el.control)}
              targetValue={target(el.control) as number | undefined}
            />
          </Anchor>
        );
      }

      case 'button':
        return <PanelButton key={i} el={el} {...p} />;

      case 'jack': {
        const j = p.jacks[el.jack];
        if (!j) return null;
        const isOut = j.jackType === 'output';
        const connected = p.patches.filter(c => c.from === el.jack || c.to === el.jack);
        const isHl = highlightedJacks.includes(el.jack);
        const d = px(6.2);
        const isActive = active?.from === el.jack;
        const lp = el.label ?? 'above';
        const ring = isActive ? '#fff' : isHl ? (targetPatchDone ? '#22c55e' : '#f97316') : theme.jack?.ring ?? '#555';
        return (
          <Anchor key={i} x={px(el.x)} y={px(el.y)}>
            <div className="relative" style={{ width: d, height: d }}>
              {lp !== 'none' && (
                <div
                  className="absolute whitespace-nowrap font-bold leading-none pointer-events-none"
                  style={{
                    ...(lp === 'below'
                      ? { top: '100%', marginTop: 2, left: '50%', transform: 'translateX(-50%)' }
                      : lp === 'left'
                      ? { right: '100%', marginRight: 3, top: '50%', transform: 'translateY(-50%)' }
                      : lp === 'right'
                      ? { left: '100%', marginLeft: 3, top: '50%', transform: 'translateY(-50%)' }
                      : { bottom: '100%', marginBottom: 2, left: '50%', transform: 'translateX(-50%)' }),
                    fontSize: 6.5,
                    color: isOut ? theme.jack?.outputLabelText ?? '#fff' : theme.muted ?? '#999',
                    background: isOut ? theme.jack?.outputLabelBg ?? '#000' : 'transparent',
                    border: isOut ? '1px solid #444' : '1px solid transparent',
                    padding: '1px 3px',
                    borderRadius: 2,
                  }}
                >
                  {el.labelText ?? j.label}
                </div>
              )}
              <div
                className={`absolute inset-0 rounded-full pointer-events-none ${isHl && !targetPatchDone ? 'animate-pulse' : ''}`}
                title={`${j.label} (${isOut ? 'output' : 'input'}, ${j.signalType})`}
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #3a3a3a 0%, #111 100%)',
                  border: `2px solid ${ring}`,
                  boxShadow: isHl ? `0 0 10px ${targetPatchDone ? '#22c55e' : '#f97316'}, inset 0 2px 4px rgba(0,0,0,0.7)` : 'inset 0 2px 4px rgba(0,0,0,0.7)',
                  transform: isActive || (isHl && !targetPatchDone) ? 'scale(1.18)' : undefined,
                  transition: 'transform 100ms',
                }}
              >
                <div className="absolute rounded-full" style={{ inset: '30%', background: '#000' }} />
              </div>
            </div>
          </Anchor>
        );
      }

      case 'led': {
        const on = el.on(ctx);
        const amt = typeof on === 'boolean' ? (on ? 1 : 0) : Math.max(0, Math.min(1, on));
        const c = el.color ?? '#ff3333';
        const d = px(el.size ?? 2.5);
        return (
          <Anchor key={i} x={px(el.x)} y={px(el.y)}>
            <div
              className="rounded-full pointer-events-none"
              style={{
                width: d, height: d,
                background: amt > 0.02 ? c : '#2a1212',
                opacity: amt > 0.02 ? 0.35 + 0.65 * amt : 1,
                boxShadow: amt > 0.02 ? `0 0 ${4 + 6 * amt}px ${c}` : 'inset 0 1px 2px #000',
              }}
            />
          </Anchor>
        );
      }

      case 'display': {
        const content = el.render(ctx);
        const isLines = Array.isArray(content);
        const style = el.style ?? 'oled';
        return (
          <div
            key={i}
            className="absolute overflow-hidden font-mono"
            style={{
              left: px(el.x), top: px(el.y), width: px(el.w), height: px(el.h),
              background: style === 'lcd' ? 'linear-gradient(#9fb56a, #8aa257)' : '#050805',
              color: style === 'lcd' ? '#1b2410' : style === 'led-segment' ? '#ff3b2f' : '#e8f0ff',
              border: '2px solid #222',
              borderRadius: 3,
              boxShadow: 'inset 0 0 8px rgba(0,0,0,0.8)',
              padding: 4,
              fontSize: 9,
              lineHeight: 1.25,
              textShadow: style === 'oled' ? '0 0 3px rgba(200,220,255,0.6)' : undefined,
            }}
          >
            {isLines ? (content as string[]).map((l, li) => <div key={li} className="whitespace-pre truncate">{l}</div>) : content}
          </div>
        );
      }

      case 'keyboard':
        return (
          <div key={i} className="absolute" style={{ left: px(el.x), top: px(el.y), width: px(el.w), height: px(el.h) }}>
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
        const id = typeof el.control === 'function' ? el.control(ctx) : el.control;
        const s = id ? (spec.controls[id] as PatternSpec | undefined) : undefined;
        const pattern = id ? ((value(id) as string) ?? s?.default ?? '') : '';
        const tgt = target(id);
        return (
          <div key={i} className="absolute" style={{ left: px(el.x), top: px(el.y), width: px(el.w), height: px(el.h) }}>
            <StepGrid
              steps={el.steps}
              rows={el.rows ?? 1}
              pattern={pattern.padEnd(el.steps, '0')}
              playhead={el.playhead?.(ctx)}
              color={el.color}
              numbered={el.numbered}
              target={typeof tgt === 'string' ? tgt : undefined}
              highlighted={isTarget(id)}
              onToggle={idx => {
                if (!id) return;
                const arr = pattern.padEnd(el.steps, '0').split('');
                arr[idx] = arr[idx] === '0' ? '1' : '0';
                p.onChange(id, arr.join(''));
              }}
            />
          </div>
        );
      }

      case 'custom':
        return (
          <div key={i} className="absolute pointer-events-none [&>*]:pointer-events-auto" style={{ left: px(el.x), top: px(el.y), width: px(el.w), height: px(el.h) }}>
            {el.render({
              ...ctx,
              setValue: p.onChange,
              sendEvent: p.onEvent,
              teaching,
              step,
              data: p.data,
              ui: p.ui ?? EMPTY_UI,
              updateData: p.updateData ?? NOOP,
              setUi: p.setUi ?? NOOP,
              instance: p.instance ?? p.spec.id,
            })}
          </div>
        );
    }
  };

  // Draw sections first, then everything else in declaration order
  const ordered = useMemo(() => {
    const sections = layout.elements.filter(e => e.kind === 'section');
    const rest = layout.elements.filter(e => e.kind !== 'section');
    return [...sections, ...rest];
  }, [layout]);

  return (
    <div
      ref={faceRef}
      className="absolute"
      style={{ left: p.left, top: p.top, width, height, background: theme.background, borderRadius: 4, overflow: 'visible', color: theme.text }}
      onPointerMove={onFaceMove}
      onPointerDown={() => { if (active) { setActive(null); drag.current = null; } }}
    >
      {ordered.map(renderElement)}
      <Cables
        patches={p.patches}
        jackPos={p.jackPos}
        active={active ? { from: active.from, to: active.pointer, color: active.color } : null}
        onRemove={p.onUnpatch}
        width={width}
        height={height}
        jackRadius={px(3.1)}
      />
      {/* Jack hit targets sit above the cables, so a patched jack can still start another cable */}
      {layout.elements.map((el, i) => {
        if (el.kind !== 'jack' || !p.jacks[el.jack]) return null;
        const j = p.jacks[el.jack];
        const d = px(7.5);
        return (
          <div
            key={`hit-${i}`}
            data-jack={el.jack}
            onPointerDown={e => startOrFinish(el.jack, e)}
            onPointerMove={onJackMove}
            onPointerUp={onJackUp}
            title={`${j.label} (${j.jackType}, ${j.signalType})`}
            className="absolute rounded-full cursor-pointer"
            style={{ left: px(el.x) - d / 2, top: px(el.y) - d / 2, width: d, height: d, zIndex: 40, touchAction: 'none' }}
          />
        );
      })}
    </div>
  );
}

function PanelButton({ el, spec, layout, values, ctx, teaching, step, px, onChange, onEvent }: FaceplateProps & { el: ButtonElement }) {
  const controlSpec = el.control ? spec.controls[el.control] : undefined;
  const isRadio = el.setValue !== undefined;
  const current = el.control ? values[el.control] : undefined;
  const momentary = controlSpec?.type === 'button' && (controlSpec as ButtonSpec).momentary;

  let lit: number | boolean = false;
  if (el.lit) lit = el.lit(ctx);
  else if (isRadio) lit = current === el.setValue;
  else if (el.control) lit = !!current;

  const highlighted = !!(teaching && step && el.control && step.control === el.control && (!isRadio || step.targetValue === el.setValue));
  const correct = highlighted && isValueOnTarget(controlSpec, current, step!.targetValue);

  const press = () => {
    if (el.control) {
      if (isRadio) onChange(el.control, el.setValue!);
      else if (momentary) onChange(el.control, true);
      else onChange(el.control, !current);
    }
    if (el.event) onEvent(el.event);
  };
  const release = () => {
    if (el.control && momentary && !isRadio) onChange(el.control, false);
    if (el.event) onEvent(`${el.event}:up`);
  };

  // Radio keys on a switch control are named after the option they select
  const radioLabel = isRadio && controlSpec?.type === 'switch' ? (controlSpec as SwitchSpec).options[el.setValue as number] : undefined;
  const w = px(el.w ?? 7);
  return (
    <Anchor x={px(el.x)} y={px(el.y)}>
      <Button
        id={el.control ?? el.event ?? 'button'}
        label={el.labelText ?? radioLabel ?? (controlSpec ? controlSpec.label : undefined)}
        description={controlSpec?.description}
        lit={lit}
        onPress={press}
        onRelease={release}
        shape={el.shape}
        width={w}
        height={el.h !== undefined ? px(el.h) : undefined}
        color={el.color}
        ledColor={el.ledColor}
        labelPosition={el.label ?? (el.labelText || controlSpec ? 'above' : 'none')}
        labelColor={layout.theme.muted ?? layout.theme.text}
        capText={el.capText}
        highlighted={highlighted}
        correct={correct}
      />
    </Anchor>
  );
}

function Anchor({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    // max-content stops elements near the panel's right edge from being squeezed (and their text wrapping)
    <div className="absolute" style={{ left: x, top: y, width: 'max-content', transform: 'translate(-50%, -50%)' }}>
      {children}
    </div>
  );
}

function cablePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const sag = Math.min(dist * 0.35, 60) + 8;
  const midX = (a.x + b.x) / 2;
  const midY = Math.max(a.y, b.y) + sag;
  return `M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`;
}

const Cables = memo(function Cables({
  patches, jackPos, active, onRemove, width, height, jackRadius,
}: {
  patches: PatchConnection[];
  jackPos: Record<string, { x: number; y: number }>;
  active: { from: string; to: { x: number; y: number }; color: string } | null;
  onRemove: (from: string, to: string) => void;
  width: number;
  height: number;
  jackRadius: number;
}) {
  const plug = Math.max(5, jackRadius * 0.9);
  return (
    <svg className="absolute left-0 top-0 pointer-events-none" width={width} height={height} style={{ overflow: 'visible', zIndex: 30 }}>
      {patches.map((c, i) => {
        const a = jackPos[c.from];
        const b = jackPos[c.to];
        if (!a || !b) return null;
        const d = cablePath(a, b);
        const color = c.color ?? cableColor(i);
        return (
          <g key={`${c.from}-${c.to}`}>
            <path d={d} stroke="rgba(0,0,0,0.55)" strokeWidth={8} fill="none" strokeLinecap="round" transform="translate(1.5,3)" />
            <path d={d} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.95} />
            <path d={d} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} fill="none" strokeLinecap="round" transform="translate(-1,-1)" />
            {/* Wide invisible hit area - tap a cable to unplug it */}
            <path
              d={d}
              stroke="transparent"
              strokeWidth={18}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onPointerDown={e => { e.stopPropagation(); onRemove(c.from, c.to); }}
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
          <circle cx={jackPos[active.from].x} cy={jackPos[active.from].y} r={plug} fill="#1a1a1a" stroke={active.color} strokeWidth={2.5} />
          <circle cx={active.to.x} cy={active.to.y} r={4} fill={active.color} />
        </g>
      )}
    </svg>
  );
});

export default memo(SynthPanel);
