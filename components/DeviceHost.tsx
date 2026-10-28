'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ControlValue, PatchConnection, PresetSpec } from '@/types';
import type { DeviceModule, DeviceUiApi } from '@/devices/types';
import { useStudioStore, specDefaults, stepKind } from '@/store/studio';
import { useUiStore, selectUi } from '@/store/ui';
import { hub } from '@/lib/studio/hub';
import { useDeviceModule, useEngineState } from '@/lib/studio/useHub';
import SynthPanel, { type PatchController } from '@/components/panel/SynthPanel';
import ResponsiveDeviceContainer from '@/components/ui/ResponsiveDeviceContainer';

// Computer keyboard → semitone offset (two rows like a DAW)
const KEYMAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17,
};

const EMPTY_PATCHES: PatchConnection[] = [];

interface DeviceHostProps {
  instance: string;
  /** Studio rack view: slimmer toolbar, no tips */
  compact?: boolean;
  /** Only the focused instrument listens to the computer keyboard */
  keyboardActive?: boolean;
  /** Studio-level patching (cables between instruments) */
  patchController?: PatchController;
  /** Fixed zoom for the rack view; focus view uses the Fit / +/- controls */
  zoomOverride?: 'fit' | number;
  onModuleLoaded?: (module: DeviceModule) => void;
}

export default function DeviceHost(props: DeviceHostProps) {
  const device = useStudioStore(s => s.deviceOf(props.instance));
  const { module, error } = useDeviceModule(device);
  const onLoaded = props.onModuleLoaded;
  useEffect(() => { if (module) onLoaded?.(module); }, [module, onLoaded]);

  if (error) return <div className="text-red-400 p-8 text-center">Failed to load {device}: {error}</div>;
  if (!module) {
    return <div className="flex items-center justify-center h-64 text-hardware-label animate-pulse">Loading {device}…</div>;
  }
  return <LoadedDevice key={props.instance} {...props} device={device} mod={module} />;
}

function LoadedDevice({ instance, device, mod, compact, keyboardActive = true, patchController, zoomOverride }: DeviceHostProps & { device: string; mod: DeviceModule }) {
  const { spec, layout } = mod;
  const stored = useStudioStore(s => s.devices[instance]);
  const addPatch = useStudioStore(s => s.addPatchConnection);
  const removePatch = useStudioStore(s => s.removePatchConnection);
  const clearPatches = useStudioStore(s => s.clearPatchConnections);
  const resetControls = useStudioStore(s => s.resetControlsToSpec);
  const loadPreset = useStudioStore(s => s.loadPreset);
  const updateDeviceData = useStudioStore(s => s.updateDeviceData);
  const isTeaching = useStudioStore(s => s.isTeachingMode);
  const lesson = useStudioStore(s => s.currentLesson);
  const lessonInstance = useStudioStore(s => s.lessonInstance);
  const stepIndex = useStudioStore(s => s.currentStep);
  const focusMode = useStudioStore(s => s.focusMode);
  const ui = useUiStore(selectUi(instance));
  const setUiStore = useUiStore(s => s.setUi);
  const engineState = useEngineState(instance);
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [scaleInfo, setScaleInfo] = useState({ scale: 1, fit: 1 });
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [octave, setOctave] = useState(0);
  const [preset, setPreset] = useState('');

  const defaults = useMemo(() => specDefaults(device), [device]);
  const values = useMemo(() => ({ ...defaults, ...(stored?.controlValues ?? {}) }), [defaults, stored?.controlValues]);
  const patches = stored?.patchConnections ?? EMPTY_PATCHES;
  const data = stored?.data;

  const setUi = useCallback((patch: Record<string, unknown>) => setUiStore(instance, patch), [instance, setUiStore]);
  const updateData = useCallback((fn: (d: unknown) => unknown) => updateDeviceData(instance, fn), [instance, updateDeviceData]);

  // The API device hooks see (parameter locks etc.)
  const apiRef = useRef<DeviceUiApi | null>(null);
  apiRef.current = {
    values,
    data,
    ui,
    setValue: (id, v) => hub.setControl(instance, id, v),
    updateData,
    setUi,
  };

  const displayValues = useMemo(
    () => (mod.displayValues && apiRef.current ? mod.displayValues(apiRef.current) : values),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mod, values, data, ui],
  );

  const onChange = useCallback((id: string, v: ControlValue) => {
    if (mod.interceptChange && apiRef.current && mod.interceptChange(id, v, apiRef.current)) return;
    hub.setControl(instance, id, v);
  }, [mod, instance]);
  const onEvent = useCallback((name: string, payload?: unknown) => hub.event(instance, name, payload), [instance]);
  const onPatch = useCallback((a: string, b: string) => addPatch(instance, a, b), [instance, addPatch]);
  const onUnpatch = useCallback((a: string, b: string) => removePatch(instance, a, b), [instance, removePatch]);

  const heldRef = useRef(held);
  heldRef.current = held;
  const handleNoteOn = useCallback((n: number, velocity = 1) => {
    setHeld(prev => new Set(prev).add(n));
    hub.noteOn(instance, n, velocity);
  }, [instance]);
  const handleNoteOff = useCallback((n: number) => {
    setHeld(prev => { const s = new Set(prev); s.delete(n); return s; });
    hub.noteOff(instance, n);
  }, [instance]);

  // Computer keyboard: notes, Z/X octave, Space = transport (focused instrument only)
  useEffect(() => {
    if (!keyboardActive) return;
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === ' ' && mod.transportControl) {
        e.preventDefault();
        if (e.repeat) return;
        hub.ensureAudio();
        const cur = useStudioStore.getState().devices[instance]?.controlValues[mod.transportControl] ?? defaults[mod.transportControl];
        hub.setControl(instance, mod.transportControl, !cur);
        return;
      }
      if (!mod.keyboard || e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === 'z') { setOctave(o => Math.max(-3, o - 1)); return; }
      if (key === 'x') { setOctave(o => Math.min(3, o + 1)); return; }
      const off = KEYMAP[key];
      if (off === undefined) return;
      hub.ensureAudio();
      handleNoteOn(mod.keyboard.lowNote + octave * 12 + off);
    };
    const up = (e: KeyboardEvent) => {
      if (!mod.keyboard) return;
      const off = KEYMAP[e.key.toLowerCase()];
      if (off === undefined) return;
      const n = mod.keyboard.lowNote + octave * 12 + off;
      if (heldRef.current.has(n)) handleNoteOff(n);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [keyboardActive, mod, instance, octave, defaults, handleNoteOn, handleNoteOff]);

  // Lesson step that targets this instance
  const step = useMemo(() => {
    if (!isTeaching || !lesson) return null;
    const st = lesson.steps[stepIndex];
    if (!st) return null;
    const target = st.instance ?? lessonInstance ?? lesson.device;
    return target === instance ? st : null;
  }, [isTeaching, lesson, stepIndex, lessonInstance, instance]);

  // Spotlight (focus mode): dim everything the step isn't about
  const focus = useMemo(() => {
    if (!step || !focusMode) return null;
    const ids = new Set<string>(step.focus ?? []);
    if (step.control) ids.add(step.control);
    if (step.patchFrom) ids.add(step.patchFrom);
    if (step.patchTo) ids.add(step.patchTo);
    if (stepKind(step) === 'match' && step.match) step.match.controls.forEach(c => ids.add(c));
    return ids.size ? ids : null;
  }, [step, focusMode]);

  const presets = spec.presets ? Object.entries(spec.presets) : [];
  const transientIds = useMemo(() => {
    const s = new Set<string>(mod.uiControls ?? []);
    Object.entries(spec.controls).forEach(([id, c]) => {
      if (c.type === 'button' && (c.momentary || id === mod.transportControl)) s.add(id);
    });
    return s;
  }, [mod, spec]);

  const applyPreset = (key: string) => {
    setPreset(key);
    const p = spec.presets?.[key];
    if (!p) return;
    const base: Record<string, ControlValue> = {};
    Object.entries(defaults).forEach(([id, v]) => { if (!transientIds.has(id)) base[id] = v; });
    loadPreset(instance, { ...base, ...p.settings }, p.patchConnections ?? []);
  };

  const doReset = () => {
    const d: Record<string, ControlValue> = {};
    Object.entries(defaults).forEach(([id, v]) => { if (!transientIds.has(id)) d[id] = v; });
    resetControls(instance, d);
    setPreset('');
  };

  const onScaleChange = useCallback((scale: number, fit: number) => setScaleInfo({ scale, fit }), []);

  return (
    <div onPointerDownCapture={() => hub.ensureAudio()} data-instance={instance}>
      <div className={`flex flex-wrap items-center justify-center gap-2 ${compact ? 'mb-1.5' : 'mb-3'} text-sm`}>
        {presets.length > 0 && (
          <select
            value={preset}
            onChange={e => applyPreset(e.target.value)}
            className="bg-[#232323] border border-[#3a3a3a] text-white rounded-full px-3 py-1.5 text-xs max-w-[240px]"
            aria-label="Load preset"
          >
            <option value="">Presets ({presets.length})…</option>
            {groupPresets(presets).map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map(([k, p]) => (
                  <option key={k} value={k}>
                    {p.name}{p.patchConnections?.length ? ` · ${p.patchConnections.length} cable${p.patchConnections.length > 1 ? 's' : ''}` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
        <ToolButton onClick={doReset} title="Reset every knob and switch to its default">Reset</ToolButton>
        {spec.patchBay && (
          <ToolButton onClick={() => clearPatches(instance)} title="Remove this instrument's patch cables" disabled={!patches.length}>
            Clear cables{patches.length ? ` (${patches.length})` : ''}
          </ToolButton>
        )}
        {!zoomOverride && (
          <div className="flex items-center rounded-full border border-[#3a3a3a] overflow-hidden">
            <button className={`px-2.5 py-1.5 text-xs ${zoom === 'fit' ? 'bg-[#3a3a3a] text-white' : 'text-gray-400'}`} onClick={() => setZoom('fit')}>Fit</button>
            <button className="px-2.5 py-1.5 text-xs text-gray-300 border-l border-[#3a3a3a]" onClick={() => setZoom(Math.max(0.35, +(scaleInfo.scale - 0.15).toFixed(2)))} aria-label="Zoom out">−</button>
            <span className="px-1.5 text-[11px] text-gray-400 tabular-nums w-10 text-center">{Math.round(scaleInfo.scale * 100)}%</span>
            <button className="px-2.5 py-1.5 text-xs text-gray-300 border-l border-[#3a3a3a]" onClick={() => setZoom(Math.min(1.5, +(scaleInfo.scale + 0.15).toFixed(2)))} aria-label="Zoom in">+</button>
          </div>
        )}
        {!compact && mod.keyboard && keyboardActive && (
          <span className="text-[11px] text-gray-500 hidden md:inline">Keys A–K play · Z/X octave ({octave >= 0 ? '+' : ''}{octave})</span>
        )}
        {!compact && mod.transportControl && keyboardActive && <span className="text-[11px] text-gray-500 hidden md:inline">Space = play/stop</span>}
      </div>

      <ResponsiveDeviceContainer zoom={zoomOverride ?? zoom} onScaleChange={onScaleChange}>
        <SynthPanel
          spec={spec}
          layout={layout}
          values={displayValues}
          engineState={engineState}
          onChange={onChange}
          onEvent={onEvent}
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          heldNotes={held}
          patches={patches}
          onPatch={onPatch}
          onUnpatch={onUnpatch}
          teaching={isTeaching}
          step={step}
          instance={instance}
          data={data}
          ui={ui}
          updateData={updateData}
          setUi={setUi}
          focus={focus}
          patchController={patchController}
        />
      </ResponsiveDeviceContainer>

      {!compact && mod.tips && mod.tips.length > 0 && (
        <details className="mt-2 max-w-3xl mx-auto text-[12px] text-gray-500">
          <summary className="cursor-pointer text-gray-400 hover:text-white select-none">How to play this {spec.name}</summary>
          <ul className="list-disc pl-6 space-y-0.5 mt-1">
            {mod.tips.map(t => <li key={t}>{t}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

type PresetEntry = [string, PresetSpec];

/** Group presets by the prefix before " / " or by their source */
function groupPresets(presets: PresetEntry[]): [string, PresetEntry[]][] {
  const groups = new Map<string, PresetEntry[]>();
  presets.forEach(entry => {
    const p = entry[1];
    const group = p.name.includes(' / ') ? p.name.split(' / ')[0] : p.source === 'factory' ? 'Factory' : p.source === 'manual' ? 'From the manual' : 'Patches';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(entry);
  });
  return [...groups.entries()];
}

function ToolButton({ children, onClick, title, disabled }: { children: React.ReactNode; onClick: () => void; title?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="px-3 py-1.5 text-xs bg-[#2d2d2d] hover:bg-[#3a3a3a] text-white rounded-full border border-[#3a3a3a] disabled:opacity-40 transition-colors"
    >
      {children}
    </button>
  );
}
