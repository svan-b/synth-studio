'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ControlValue, DeviceSpec, PatchConnection, PresetSpec } from '@/types';
import type { EngineState, Values } from '@/types/panel';
import type { DeviceModule, DeviceUiApi } from '@/devices/types';
import { useStudioStore, specDefaults, stepKind, registerLessons, setLessonEngineReader } from '@/store/studio';
import { useUiStore, selectUi } from '@/store/ui';
import { hub } from '@/lib/studio/hub';
import { useDeviceModule } from '@/lib/studio/useHub';
import { describeValue } from '@/lib/controls/mapping';
import SynthPanel, { type EngineSource, type PatchController } from '@/components/panel/SynthPanel';
import ResponsiveDeviceContainer from '@/components/ui/ResponsiveDeviceContainer';
import { prefetchTeaching } from '@/components/teaching/onDemand';
import { midiLearnTouch, useMidiFocus } from '@/lib/midi/lite'; // external gear: MIDI learn + MIDI input (stack loads after first paint)

const NO_ENGINE: EngineState = {};

// Computer keyboard → semitone offset (two rows like a DAW)
const KEYMAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17,
};

const EMPTY_PATCHES: PatchConnection[] = [];
/** Shortest note a tap can play (ms) */
const MIN_GATE_MS = 60;

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
  const stepSatisfied = useStudioStore(s => s.stepSatisfied);
  const lessonDemo = useStudioStore(s => s.lessonDemo);
  // Clock source, as on hardware with MIDI clock plugged in or not
  const canSync = !!mod.studio?.midiSync && !!mod.transportControl && device !== 'studio-clock';
  const synced = useStudioStore(s => s.studio.sync[instance] !== false);
  const studioBpm = useStudioStore(s => s.studio.bpm);
  const setSync = useStudioStore(s => s.setSync);
  const ui = useUiStore(selectUi(instance));
  const setUiStore = useUiStore(s => s.setUi);
  // Engine state goes straight to the elements that show it (LEDs, screens, playheads):
  // an LED blinking must not re-render this host and the whole panel
  const engineSource = useMemo<EngineSource>(() => ({
    get: () => (hub.hasInstance(instance) ? hub.getState(instance) : NO_ENGINE),
    subscribe: cb => hub.subscribeState(instance, () => cb()),
  }), [instance]);
  const [touched, setTouched] = useState<{ kind: 'control' | 'jack'; id: string } | null>(null);
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
    midiLearnTouch(instance, id); // MIDI learn: remember the control you touched (no-op unless learning)
    if (mod.interceptChange && apiRef.current && mod.interceptChange(id, v, apiRef.current)) return;
    hub.setControl(instance, id, v);
  }, [mod, instance]);
  const onEvent = useCallback((name: string, payload?: unknown) => hub.event(instance, name, payload), [instance]);
  const onPatch = useCallback((a: string, b: string) => addPatch(instance, a, b), [instance, addPatch]);
  const onUnpatch = useCallback((a: string, b: string) => removePatch(instance, a, b), [instance, removePatch]);
  // Lessons count presses (TRIGGER, ADVANCE, pads, trig keys) - a no-op outside a lesson
  const onPress = useCallback((ids: string[]) => useStudioStore.getState().lessonPress(instance, ids), [instance]);

  // Lesson checks can read live engine state (current step, LEDs); the review queue
  // learns this instrument's lessons so it can tell rebuilt questions from current ones
  useEffect(() => { setLessonEngineReader(id => hub.getState(id) as Record<string, unknown>); }, []);
  useEffect(() => { registerLessons(device, mod.lessons); }, [device, mod]);
  // The instrument is up: fetch the lesson UI (loaded on demand) while the page idles
  useEffect(() => { prefetchTeaching(); }, []);

  const heldRef = useRef(held);
  heldRef.current = held;
  // A very quick tap can release a key inside the same audio block it was pressed
  // in, so the envelope never opens. Give every note a minimum gate, like a real key.
  const noteStarted = useRef(new Map<number, number>());
  const handleNoteOn = useCallback((n: number, velocity = 1) => {
    setHeld(prev => new Set(prev).add(n));
    noteStarted.current.set(n, performance.now());
    hub.noteOn(instance, n, velocity);
    useStudioStore.getState().lessonNote(instance, n);
  }, [instance]);
  const handleNoteOff = useCallback((n: number) => {
    setHeld(prev => { const s = new Set(prev); s.delete(n); return s; });
    const startedAt = noteStarted.current.get(n);
    const release = () => {
      // Skip if the same key was pressed again in the meantime
      if (noteStarted.current.get(n) !== startedAt) return;
      noteStarted.current.delete(n);
      hub.noteOff(instance, n);
    };
    // No recorded note-on (e.g. a stray release): release at once, never drop it
    const wait = startedAt === undefined ? 0 : MIN_GATE_MS - (performance.now() - startedAt);
    if (wait > 0) setTimeout(release, wait);
    else release();
  }, [instance]);

  // MIDI input plays the focused instrument through the handlers above (keys light up)
  useMidiFocus(instance, keyboardActive, handleNoteOn, handleNoteOff);

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
    if (step.event) ids.add(step.event);
    if (step.play) ids.add('keyboard');
    if (step.patchFrom) ids.add(step.patchFrom);
    if (step.patchTo) ids.add(step.patchTo);
    if (stepKind(step) === 'match' && step.match) step.match.controls.forEach(c => ids.add(c));
    return ids.size ? ids : null;
  }, [step, focusMode]);

  // Checks that read the engine (the current step LED, a playing sequencer) re-run as it changes
  const engineChecks = !!step && (!!step.check || !!step.checklist?.length);
  useEffect(() => {
    if (!engineChecks) return;
    return hub.subscribeState(instance, () => useStudioStore.getState().reevaluate());
  }, [engineChecks, instance]);

  const demoPatch = lessonDemo && lessonDemo.instance === instance ? lessonDemo.patch ?? null : null;

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

  // The status strip follows the last control touched (iPad has no hover tooltips)
  const noteTouched = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.('[data-control], [data-jack]') as HTMLElement | null;
    if (!el) return;
    const next = el.dataset.jack ? { kind: 'jack' as const, id: el.dataset.jack } : el.dataset.control ? { kind: 'control' as const, id: el.dataset.control } : null;
    if (next) setTouched(t => (t && t.kind === next.kind && t.id === next.id ? t : next));
  };

  return (
    <div
      onPointerDownCapture={e => { hub.ensureAudio(); noteTouched(e.target); }}
      onFocusCapture={e => noteTouched(e.target)}
      data-instance={instance}
    >
      <div className={`flex flex-wrap items-center justify-center gap-2 ${compact ? 'mb-1.5' : 'mb-3 coarse-lg:mb-2'} text-sm`}>
        {presets.length > 0 && (
          <select
            value={preset}
            onChange={e => applyPreset(e.target.value)}
            className="bg-[#232323] border border-[#3a3a3a] text-white rounded-full px-3 py-1.5 text-xs max-w-[240px] coarse:min-h-[44px]"
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
        {!compact && canSync && (
          <ToolButton
            onClick={() => setSync(instance, !synced)}
            title={synced
              ? `Follows the studio clock (${studioBpm} BPM), like MIDI clock: Play keeps it in time with everything else. Tap to run it on its own tempo instead.`
              : 'Runs on its own tempo, like hardware with no clock plugged in. Tap to follow the studio clock again.'}
            pressed={!synced}
          >
            Clock: {synced ? `studio ${studioBpm}` : 'own tempo'}
          </ToolButton>
        )}
        {!zoomOverride && (
          <div className="flex items-center rounded-full border border-[#3a3a3a] overflow-hidden">
            <button className={`px-2.5 py-1.5 text-xs coarse:min-h-[44px] coarse:min-w-[44px] ${zoom === 'fit' ? 'bg-[#3a3a3a] text-white' : 'text-gray-400'}`} onClick={() => setZoom('fit')}>Fit</button>
            <button className="px-2.5 py-1.5 text-xs text-gray-300 border-l border-[#3a3a3a] coarse:min-h-[44px] coarse:min-w-[44px]" onClick={() => setZoom(Math.max(0.35, +(scaleInfo.scale - 0.15).toFixed(2)))} aria-label="Zoom out">−</button>
            <span className="px-1.5 text-[11px] text-gray-400 tabular-nums w-10 text-center">{Math.round(scaleInfo.scale * 100)}%</span>
            <button className="px-2.5 py-1.5 text-xs text-gray-300 border-l border-[#3a3a3a] coarse:min-h-[44px] coarse:min-w-[44px]" onClick={() => setZoom(Math.min(1.5, +(scaleInfo.scale + 0.15).toFixed(2)))} aria-label="Zoom in">+</button>
          </div>
        )}
        {!compact && mod.keyboard && keyboardActive && (
          <span className="text-[11px] text-gray-500 hidden md:inline coarse-lg:hidden">Keys A–K play · Z/X octave ({octave >= 0 ? '+' : ''}{octave})</span>
        )}
        {!compact && mod.transportControl && keyboardActive && <span className="text-[11px] text-gray-500 hidden md:inline coarse-lg:hidden">Space = play/stop</span>}
        {/* On an iPad the status shares the toolbar row, so the panel gets its line */}
        {!compact && <ControlStatus spec={spec} values={displayValues} touched={touched} inline />}
      </div>

      {!compact && <ControlStatus spec={spec} values={displayValues} touched={touched} />}

      <ResponsiveDeviceContainer zoom={zoomOverride ?? zoom} fitHeight={!compact} onScaleChange={onScaleChange}>
        <SynthPanel
          spec={spec}
          layout={layout}
          values={displayValues}
          engineState={engineSource.get()}
          engineSource={engineSource}
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
          scale={scaleInfo.scale}
          onPress={onPress}
          stepDone={!!step && stepSatisfied}
          demoPatch={demoPatch}
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

/** First sentence of a description (the strip has room for one line) */
function firstSentence(text: string | undefined): string {
  if (!text) return '';
  const i = text.search(/[.!?](\s|$)/);
  return i >= 0 ? text.slice(0, i + 1) : text;
}

/**
 * One line under the toolbar: the control you last touched, its value and what it
 * does. Touch screens have no hover tooltips, and naming the thing you just moved
 * (with its unit) is half of learning a new instrument.
 */
function ControlStatus({ spec, values, touched, inline = false }: { spec: DeviceSpec; values: Values; touched: { kind: 'control' | 'jack'; id: string } | null; inline?: boolean }) {
  let name = '';
  let value = '';
  let about = '';
  if (touched?.kind === 'control') {
    // Elektron lock encoders draw `<id>__lock`
    const id = touched.id.replace(/__lock$/, '');
    const c = spec.controls[id];
    if (c) {
      name = c.label;
      const v = values[id] ?? ('default' in c ? (c.default as ControlValue) : undefined);
      // A momentary button (TRIGGER, TAP) has no lasting state worth showing
      value = c.type === 'jack' || c.type === 'pattern' || (c.type === 'button' && c.momentary) ? '' : describeValue(c, v);
      about = firstSentence(c.description);
    }
  } else if (touched?.kind === 'jack') {
    const all = [...(spec.patchBay?.inputs ?? []), ...(spec.patchBay?.outputs ?? [])];
    const j = all.find(x => x.id === touched.id);
    if (j) {
      name = `${j.label} ${j.jackType === 'output' ? 'output' : 'input'}`;
      value = j.signalType;
      const normal = j.normalled ? all.find(x => x.id === j.normalled) : undefined;
      about = normal ? `With no cable it is connected inside to ${normal.label}.` : '';
    }
  }
  return (
    <div
      className={`h-6 px-2 items-center gap-2 text-[12px] leading-none min-w-0 max-w-full select-none ${
        inline ? 'hidden coarse-lg:flex basis-0 grow min-w-[240px] max-w-[520px] justify-start' : 'flex mb-1.5 justify-center coarse-lg:hidden'
      }`}
      data-control-status={inline ? 'inline' : ''}
    >
      {name ? (
        <>
          <span className="font-bold text-white shrink-0">{name}</span>
          {value && <span className="font-mono text-green-300 shrink-0 tabular-nums">{value}</span>}
          {about && <span className="text-gray-400 truncate min-w-0">{about}</span>}
        </>
      ) : (
        <span className="text-gray-500">Touch any control to see its name, value and what it does.</span>
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

function ToolButton({ children, onClick, title, disabled, pressed }: { children: React.ReactNode; onClick: () => void; title?: string; disabled?: boolean; pressed?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={pressed}
      className="px-3 py-1.5 text-xs bg-[#2d2d2d] hover:bg-[#3a3a3a] text-white rounded-full border border-[#3a3a3a] aria-pressed:border-amber-500/70 aria-pressed:text-amber-200 disabled:opacity-40 transition-colors coarse:min-h-[44px] coarse:min-w-[44px]"
    >
      {children}
    </button>
  );
}
