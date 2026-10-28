'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ControlValue, PatchConnection } from '@/types';
import type { DeviceEntry, DeviceModule } from '@/devices/types';
import { useStudioStore } from '@/store/studio';
import { useSynthEngine } from '@/lib/audio/useSynthEngine';
import { getOutputLevel } from '@/lib/audio/context';
import SynthPanel from '@/components/panel/SynthPanel';
import ResponsiveDeviceContainer from '@/components/ui/ResponsiveDeviceContainer';

// Computer keyboard → semitone offset (two rows like a DAW)
const KEYMAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17,
};

const EMPTY_PATCHES: PatchConnection[] = [];

interface DeviceHostProps {
  entry: DeviceEntry;
  onModuleLoaded?: (module: DeviceModule) => void;
}

export default function DeviceHost({ entry, onModuleLoaded }: DeviceHostProps) {
  const [mod, setMod] = useState<DeviceModule | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const device = entry.id;

  useEffect(() => {
    let alive = true;
    setMod(null);
    setLoadError(null);
    entry.load()
      .then(m => {
        if (!alive) return;
        useStudioStore.getState().registerDevice(m.default.spec);
        setMod(m.default);
        onModuleLoaded?.(m.default);
      })
      .catch(e => alive && setLoadError(String(e)));
    return () => { alive = false; };
  }, [entry, onModuleLoaded]);

  if (loadError) return <div className="text-red-400 p-8 text-center">Failed to load {entry.name}: {loadError}</div>;
  if (!mod) {
    return (
      <div className="flex items-center justify-center h-64 text-hardware-label animate-pulse">
        Loading {entry.manufacturer} {entry.name}…
      </div>
    );
  }
  return <LoadedDevice key={device} device={device} mod={mod} />;
}

function LoadedDevice({ device, mod }: { device: string; mod: DeviceModule }) {
  const { spec, layout } = mod;
  const stored = useStudioStore(s => s.devices[device]);
  const setControlValue = useStudioStore(s => s.setControlValue);
  const setControlValues = useStudioStore(s => s.setControlValues);
  const addPatch = useStudioStore(s => s.addPatchConnection);
  const removePatch = useStudioStore(s => s.removePatchConnection);
  const clearPatches = useStudioStore(s => s.clearPatchConnections);
  const resetControls = useStudioStore(s => s.resetControlsToSpec);
  const loadPreset = useStudioStore(s => s.loadPreset);
  const isTeaching = useStudioStore(s => s.isTeachingMode);
  const lesson = useStudioStore(s => s.currentLesson);
  const stepIndex = useStudioStore(s => s.currentStep);
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [scaleInfo, setScaleInfo] = useState({ scale: 1, fit: 1 });
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [octave, setOctave] = useState(0);
  const [preset, setPreset] = useState('');

  const defaults = useMemo(() => {
    const d: Record<string, ControlValue> = {};
    Object.entries(spec.controls).forEach(([id, c]) => {
      if ('default' in c && c.default !== undefined) d[id] = c.default as ControlValue;
    });
    return d;
  }, [spec]);

  // Momentary / transport buttons are performance actions, not saved settings:
  // never come back from a reload already "running".
  useEffect(() => {
    const reset: Record<string, ControlValue> = {};
    Object.entries(spec.controls).forEach(([id, c]) => {
      if (c.type === 'button' && stored?.controlValues[id] !== undefined && stored.controlValues[id] !== c.default) reset[id] = c.default;
    });
    if (Object.keys(reset).length) setControlValues(device, reset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device]);

  const values = useMemo(() => ({ ...defaults, ...(stored?.controlValues ?? {}) }), [defaults, stored?.controlValues]);
  const patches = stored?.patchConnections ?? EMPTY_PATCHES;

  const { status, error, engineState, ensureAudio, sendEvent, noteOn, noteOff } = useSynthEngine(mod.createEngine, values, patches);

  const onChange = useCallback((id: string, v: ControlValue) => setControlValue(device, id, v), [device, setControlValue]);
  const onPatch = useCallback((a: string, b: string) => addPatch(device, a, b), [device, addPatch]);
  const onUnpatch = useCallback((a: string, b: string) => removePatch(device, a, b), [device, removePatch]);

  const heldRef = useRef(held);
  heldRef.current = held;
  const handleNoteOn = useCallback((n: number) => {
    setHeld(prev => new Set(prev).add(n));
    noteOn(n, 1);
  }, [noteOn]);
  const handleNoteOff = useCallback((n: number) => {
    setHeld(prev => { const s = new Set(prev); s.delete(n); return s; });
    noteOff(n);
  }, [noteOff]);

  // Computer keyboard: notes (playable instruments), Z/X octave, Space = transport
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === ' ' && mod.transportControl) {
        if (t.closest('button, [role="slider"]')) return;
        e.preventDefault();
        ensureAudio();
        const cur = useStudioStore.getState().devices[device]?.controlValues[mod.transportControl] ?? defaults[mod.transportControl];
        setControlValue(device, mod.transportControl, !cur);
        return;
      }
      if (!mod.keyboard || e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === 'z') { setOctave(o => Math.max(-3, o - 1)); return; }
      if (key === 'x') { setOctave(o => Math.min(3, o + 1)); return; }
      const off = KEYMAP[key];
      if (off === undefined) return;
      ensureAudio();
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
  }, [mod, device, octave, defaults, ensureAudio, handleNoteOn, handleNoteOff, setControlValue]);

  const step = isTeaching && lesson && lesson.device === device ? lesson.steps[stepIndex] ?? null : null;
  const presets = spec.presets ? Object.entries(spec.presets) : [];

  const applyPreset = (key: string) => {
    setPreset(key);
    const p = spec.presets?.[key];
    if (!p) return;
    const ui = new Set(mod.uiControls ?? []);
    const base: Record<string, ControlValue> = {};
    Object.entries(defaults).forEach(([id, v]) => { if (!ui.has(id) && spec.controls[id].type !== 'button') base[id] = v; });
    loadPreset(device, { ...base, ...p.settings }, p.patchConnections ?? []);
  };

  const doReset = () => {
    const ui = new Set(mod.uiControls ?? []);
    const d: Record<string, ControlValue> = {};
    Object.entries(defaults).forEach(([id, v]) => { if (!ui.has(id)) d[id] = v; });
    resetControls(device, d);
    setPreset('');
  };

  const onScaleChange = useCallback((scale: number, fit: number) => setScaleInfo({ scale, fit }), []);

  return (
    <div onPointerDownCapture={ensureAudio} onKeyDownCapture={ensureAudio}>
      {/* Utility toolbar - outside the scaled panel so it stays finger-sized on iPad */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-3 text-sm">
        <AudioBadge status={status} error={error} onClick={ensureAudio} />
        {presets.length > 0 && (
          <select
            value={preset}
            onChange={e => applyPreset(e.target.value)}
            className="bg-[#232323] border border-[#3a3a3a] text-white rounded-full px-3 py-1.5 text-xs max-w-[220px]"
            aria-label="Load preset"
          >
            <option value="">Load preset…</option>
            {presets.map(([key, p]) => (
              <option key={key} value={key}>{p.name}{p.patchConnections?.length ? ` (${p.patchConnections.length} cable${p.patchConnections.length > 1 ? 's' : ''})` : ''}</option>
            ))}
          </select>
        )}
        <ToolButton onClick={doReset} title="Reset every knob and switch to its default">Reset</ToolButton>
        {spec.patchBay && (
          <ToolButton onClick={() => clearPatches(device)} title="Remove all patch cables" disabled={!patches.length}>
            Clear cables{patches.length ? ` (${patches.length})` : ''}
          </ToolButton>
        )}
        <div className="flex items-center rounded-full border border-[#3a3a3a] overflow-hidden">
          <button className={`px-2.5 py-1.5 text-xs ${zoom === 'fit' ? 'bg-[#3a3a3a] text-white' : 'text-gray-400'}`} onClick={() => setZoom('fit')}>Fit</button>
          <button className="px-2.5 py-1.5 text-xs text-gray-300 border-l border-[#3a3a3a]" onClick={() => setZoom(Math.max(0.35, +(scaleInfo.scale - 0.15).toFixed(2)))} aria-label="Zoom out">−</button>
          <span className="px-1.5 text-[11px] text-gray-400 tabular-nums w-10 text-center">{Math.round(scaleInfo.scale * 100)}%</span>
          <button className="px-2.5 py-1.5 text-xs text-gray-300 border-l border-[#3a3a3a]" onClick={() => setZoom(Math.min(1.5, +(scaleInfo.scale + 0.15).toFixed(2)))} aria-label="Zoom in">+</button>
        </div>
        {mod.keyboard && (
          <span className="text-[11px] text-gray-500 hidden md:inline">Keys A–K play · Z/X octave ({octave >= 0 ? '+' : ''}{octave})</span>
        )}
        {mod.transportControl && <span className="text-[11px] text-gray-500 hidden md:inline">Space = play/stop</span>}
      </div>

      <ResponsiveDeviceContainer zoom={zoom} onScaleChange={onScaleChange}>
        <SynthPanel
          spec={spec}
          layout={layout}
          values={values}
          engineState={engineState}
          onChange={onChange}
          onEvent={sendEvent}
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          heldNotes={held}
          patches={patches}
          onPatch={onPatch}
          onUnpatch={onUnpatch}
          teaching={isTeaching}
          step={step}
        />
      </ResponsiveDeviceContainer>

      {mod.tips && mod.tips.length > 0 && (
        <ul className="mt-2 max-w-3xl mx-auto text-[12px] text-gray-500 list-disc pl-6 space-y-0.5">
          {mod.tips.map(t => <li key={t}>{t}</li>)}
        </ul>
      )}
    </div>
  );
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

function AudioBadge({ status, error, onClick }: { status: string; error: string | null; onClick: () => void }) {
  const on = status === 'on';
  const label = on ? 'Audio on' : status === 'starting' ? 'Starting…' : status === 'error' ? 'Audio error' : 'Tap to enable audio';
  return (
    <button
      onClick={onClick}
      title={error ?? (on ? 'Audio engine running' : 'Browsers only allow sound after you touch the page')}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${on ? 'border-green-900 text-green-400 bg-green-950/40' : status === 'error' ? 'border-red-900 text-red-400' : 'border-orange-700 text-orange-300 bg-orange-950/40 animate-pulse'}`}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: on ? '#22c55e' : status === 'error' ? '#ef4444' : '#f97316', boxShadow: on ? '0 0 6px #22c55e' : undefined }} />
      {label}
      {on && <LevelMeter />}
    </button>
  );
}

function LevelMeter() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let held = 0;
    const tick = () => {
      const lvl = getOutputLevel();
      held = Math.max(lvl, held * 0.9);
      if (ref.current) {
        ref.current.style.width = `${Math.min(100, held * 100)}%`;
        ref.current.style.background = held > 0.95 ? '#ef4444' : held > 0.7 ? '#eab308' : '#22c55e';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span className="relative w-12 h-1.5 rounded-full bg-black/60 overflow-hidden" aria-hidden>
      <span ref={ref} className="absolute inset-y-0 left-0 rounded-full" style={{ width: 0 }} />
    </span>
  );
}
