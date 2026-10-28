// ============================================================================
// Engine hub - owns every instrument engine in the studio.
//
// React views never create engines. The hub:
//   - loads device modules (code-split) and creates one engine per rack slot
//   - pushes store changes (knobs, internal cables, device data) into engines
//   - starts audio once (iOS unlock, worklets) and starts every engine
//   - routes each instrument's output to the master bus or into a mixer input
//   - applies cables *between* instruments
//   - makes MIDI-syncable instruments follow the studio transport
//   - plays lesson auditions (target sounds) without touching the store
// Because engines live here, the drum machine keeps playing while you edit
// the synth - which is what makes building a full track possible.
// ============================================================================

import type { ControlValue, PatchConnection } from '@/types';
import type { EngineState } from '@/types/panel';
import type { DeviceModule, StudioCable } from '@/devices/types';
import type { SynthEngine } from '@/lib/audio/engine';
import { DEVICES } from '@/devices';
import { useStudioStore, specDefaults } from '@/store/studio';
import {
  getAudioContext, getMasterBus, installAudioUnlock, loadExtraWorklet, loadWorklets, onAudioStateChange, resumeAudio,
} from '@/lib/audio/context';
import { transport } from '@/lib/audio/transport';

export type AudioStatus = 'off' | 'starting' | 'on' | 'error';

interface Slot {
  instance: string;
  device: string;
  module: DeviceModule;
  engine: SynthEngine;
  started: boolean;
  values: Record<string, ControlValue>;
  patches: PatchConnection[];
  data: unknown;
  state: EngineState;
  listeners: Set<(s: EngineState) => void>;
  unsubEngine: () => void;
  routeKey: string;
  routeTeardown: (() => void) | null;
  /** Per-instrument output stage (arranger mutes) between the engine and its route */
  outGain: GainNode | null;
  /** Audition in progress: engine values are overridden until restore */
  auditioning: boolean;
}

type Listener = () => void;

class EngineHub {
  private modules = new Map<string, Promise<DeviceModule>>();
  private loaded = new Map<string, DeviceModule>();
  private slots = new Map<string, Slot>();
  private pending = new Set<string>();
  private cableTeardowns = new Map<string, () => void>();
  private statusListeners = new Set<Listener>();
  private slotListeners = new Set<Listener>();
  private _status: AudioStatus = 'off';
  private _error: string | null = null;
  private starting: Promise<void> | null = null;
  private initialised = false;
  private auditionStop: (() => void) | null = null;
  private auditionTimers: ReturnType<typeof setTimeout>[] = [];

  get status() { return this._status; }
  get error() { return this._error; }

  /** Call once on the client (HubProvider does) */
  init() {
    if (this.initialised || typeof window === 'undefined') return;
    this.initialised = true;
    // Test/automation hook (lesson runner, smoke tests)
    (window as unknown as { __synthStudio?: unknown }).__synthStudio = { store: useStudioStore, hub: this, transport };
    installAudioUnlock();
    const st = useStudioStore.getState();
    transport.attach(getAudioContext());
    transport.setBpm(st.studio.bpm);
    transport.setSwing(st.studio.swing);
    this.reconcileRack();
    useStudioStore.subscribe((s, prev) => {
      if (s.studio.rack !== prev.studio.rack || s.studio.off !== prev.studio.off) this.reconcileRack();
      if (s.devices !== prev.devices) this.pushAll();
      if (s.studio.routes !== prev.studio.routes || s.studio.rack !== prev.studio.rack) this.applyRouting();
      if (s.studio.cables !== prev.studio.cables) this.applyCables();
      if (s.studio.sync !== prev.studio.sync) this.applySync();
    });
    onAudioStateChange(running => {
      if (running && this._status !== 'on' && !this.starting) void this.startAudio();
      if (!running && this._status === 'on') this.setStatus('off');
    });
    // Mirror the studio transport into synced instruments' own play buttons
    transport.onEvent(e => {
      if (e.type !== 'start' && e.type !== 'stop') return;
      const playing = e.type === 'start';
      const store = useStudioStore.getState();
      this.slots.forEach(slot => {
        const tc = slot.module.transportControl;
        if (tc && this.isSynced(slot) && store.devices[slot.instance]?.controlValues[tc] !== playing) {
          store.setControlValue(slot.instance, tc, playing);
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Modules and instances
  // --------------------------------------------------------------------------

  loadModule(device: string): Promise<DeviceModule> {
    let p = this.modules.get(device);
    if (!p) {
      const entry = DEVICES.find(d => d.id === device);
      if (!entry) return Promise.reject(new Error(`Unknown device ${device}`));
      p = entry.load().then(m => {
        const mod = m.default;
        useStudioStore.getState().registerDevice(mod.spec);
        this.loaded.set(device, mod);
        return mod;
      });
      p.catch(() => this.modules.delete(device));
      this.modules.set(device, p);
    }
    return p;
  }

  getModule(device: string): DeviceModule | undefined {
    return this.loaded.get(device);
  }

  private reconcileRack() {
    const studio = useStudioStore.getState().studio;
    const off = studio.off ?? {};
    // Powered-off instruments keep their settings but free their engine
    const rack = studio.rack.filter(r => !off[r.id]);
    const ids = new Set(rack.map(r => r.id));
    // Remove engines for slots that left the rack
    this.slots.forEach((slot, id) => {
      if (!ids.has(id)) this.disposeSlot(id);
    });
    rack.forEach(r => {
      if (this.slots.has(r.id) || this.pending.has(r.id)) return;
      this.pending.add(r.id);
      this.loadModule(r.device)
        .then(mod => {
          this.pending.delete(r.id);
          const now = useStudioStore.getState().studio;
          if (!now.rack.some(x => x.id === r.id) || now.off?.[r.id]) return;
          this.createSlot(r.id, r.device, mod);
        })
        .catch(err => {
          this.pending.delete(r.id);
          console.error('[hub] failed to load', r.device, err);
        });
    });
  }

  private createSlot(instance: string, device: string, module: DeviceModule) {
    const store = useStudioStore.getState();
    // Initialise structured data the first time this instance is seen
    const saved = store.devices[instance]?.data;
    if (module.data && saved === undefined) {
      store.setDeviceData(instance, module.data.initial());
    } else if (module.data?.migrate && saved !== undefined) {
      const migrated = module.data.migrate(saved);
      if (migrated !== saved) store.setDeviceData(instance, migrated);
    }
    const engine = module.createEngine();
    const slot: Slot = {
      instance,
      device,
      module,
      engine,
      started: false,
      values: {},
      patches: [],
      data: undefined,
      state: {},
      listeners: new Set(),
      unsubEngine: () => undefined,
      routeKey: '',
      routeTeardown: null,
      outGain: null,
      auditioning: false,
    };
    let frame = 0;
    let latest: EngineState | null = null;
    const unsub = engine.subscribe(s => {
      latest = s;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!latest) return;
        slot.state = latest;
        slot.listeners.forEach(l => l(latest!));
      });
    });
    slot.unsubEngine = () => {
      unsub();
      if (frame) cancelAnimationFrame(frame);
    };
    this.slots.set(instance, slot);
    this.push(slot);
    if (this._status === 'on') this.startSlot(slot);
    this.slotListeners.forEach(l => l());
  }

  private disposeSlot(instance: string) {
    const slot = this.slots.get(instance);
    if (!slot) return;
    slot.routeTeardown?.();
    try { slot.outGain?.disconnect(); } catch { /* */ }
    // Cables touching this instance
    this.cableTeardowns.forEach((t, key) => {
      if (key.includes(`${instance}|`)) {
        t();
        this.cableTeardowns.delete(key);
      }
    });
    slot.unsubEngine();
    slot.engine.dispose();
    this.slots.delete(instance);
    this.slotListeners.forEach(l => l());
  }

  isPowered(instance: string) {
    return !useStudioStore.getState().studio.off?.[instance];
  }

  hasInstance(instance: string) {
    return this.slots.has(instance);
  }

  onSlotsChange(l: Listener): () => void {
    this.slotListeners.add(l);
    return () => this.slotListeners.delete(l);
  }

  // --------------------------------------------------------------------------
  // Store -> engine
  // --------------------------------------------------------------------------

  /** Defaults merged with the stored values */
  valuesFor(instance: string): Record<string, ControlValue> {
    const st = useStudioStore.getState();
    const device = st.deviceOf(instance);
    return { ...specDefaults(device), ...(st.devices[instance]?.controlValues ?? {}) };
  }

  private pushAll() {
    this.slots.forEach(slot => this.push(slot));
  }

  private push(slot: Slot) {
    if (slot.auditioning) return;
    const st = useStudioStore.getState();
    const inst = st.devices[slot.instance];
    const values = this.valuesFor(slot.instance);
    for (const k in values) {
      if (slot.values[k] !== values[k]) slot.engine.setParam(k, values[k]);
    }
    slot.values = values;
    const patches = inst?.patchConnections ?? [];
    if (patches !== slot.patches) {
      slot.patches = patches;
      slot.engine.setPatches(patches);
    }
    const data = inst?.data;
    if (data !== slot.data) {
      slot.data = data;
      slot.engine.setData(data);
    }
  }

  // --------------------------------------------------------------------------
  // Audio
  // --------------------------------------------------------------------------

  onStatusChange(l: Listener): () => void {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }

  private setStatus(s: AudioStatus, err: string | null = null) {
    this._status = s;
    this._error = err;
    this.statusListeners.forEach(l => l());
  }

  /** Call from any user gesture. Unlocks audio and starts every engine. */
  ensureAudio() {
    resumeAudio().catch(() => undefined);
    if (this._status !== 'on') void this.startAudio();
  }

  startAudio(): Promise<void> {
    if (this.starting) return this.starting;
    this.setStatus('starting');
    this.starting = (async () => {
      try {
        await resumeAudio();
        await loadWorklets();
        const ctx = getAudioContext();
        transport.attach(ctx);
        // Wait for every rack module so all worklets are loaded before starting
        const rack = useStudioStore.getState().studio.rack;
        await Promise.all(rack.map(r => this.loadModule(r.device).catch(() => undefined)));
        const urls = new Set<string>();
        this.loaded.forEach(m => m.worklets?.forEach(u => urls.add(u)));
        await Promise.all([...urls].map(loadExtraWorklet));
        this.setStatus('on');
        this.slots.forEach(slot => this.startSlot(slot));
        this.applyRouting();
        this.applyCables();
        this.applySync();
      } catch (e) {
        console.error('[hub] audio failed to start', e);
        this.setStatus('error', e instanceof Error ? e.message : String(e));
      } finally {
        this.starting = null;
      }
    })();
    return this.starting;
  }

  private startSlot(slot: Slot) {
    if (slot.started) return;
    const ctx = getAudioContext();
    const run = async () => {
      if (slot.module.worklets?.length) await Promise.all(slot.module.worklets.map(loadExtraWorklet));
      if (!this.slots.has(slot.instance)) return;
      slot.outGain = ctx.createGain();
      slot.engine.start(ctx, slot.outGain);
      slot.started = true;
      this.applyRouting();
      this.applyCables();
      this.applySync();
    };
    void run().catch(e => console.error('[hub] engine start failed', slot.instance, e));
  }

  // --------------------------------------------------------------------------
  // Routing, cables, sync
  // --------------------------------------------------------------------------

  private applyRouting() {
    if (this._status !== 'on') return;
    const routes = useStudioStore.getState().studio.routes;
    const master = getMasterBus();
    this.slots.forEach(slot => {
      if (!slot.started) return;
      let route = routes[slot.instance] ?? 'master';
      let target: { mixer: Slot; input: string } | null = null;
      if (route !== 'master') {
        const [mixerId, input] = route.split(':');
        const mixer = this.slots.get(mixerId);
        if (mixer && mixer.started && mixer !== slot) target = { mixer, input };
        else route = 'master';
      }
      const key = target ? `${target.mixer.instance}:${target.input}` : 'master';
      if (key === slot.routeKey) return;
      slot.routeTeardown?.();
      slot.routeTeardown = null;
      const out = slot.outGain!;
      try { out.disconnect(); } catch { /* not connected */ }
      if (target) {
        const teardown = target.mixer.engine.connectExternal(target.input, { node: out });
        if (teardown) slot.routeTeardown = teardown;
        else out.connect(master);
      } else {
        out.connect(master);
      }
      slot.routeKey = key;
    });
  }

  private cableKey(c: StudioCable) {
    return `${c.from.instance}|${c.from.jack}>${c.to.instance}|${c.to.jack}`;
  }

  private applyCables() {
    if (this._status !== 'on') return;
    const cables = useStudioStore.getState().studio.cables;
    const wanted = new Map(cables.map(c => [this.cableKey(c), c]));
    this.cableTeardowns.forEach((t, key) => {
      if (!wanted.has(key)) {
        t();
        this.cableTeardowns.delete(key);
      }
    });
    wanted.forEach((c, key) => {
      if (this.cableTeardowns.has(key)) return;
      const a = this.slots.get(c.from.instance);
      const b = this.slots.get(c.to.instance);
      if (!a?.started || !b?.started) return;
      // Work out which end is the output
      let src = a.engine.getOutput(c.from.jack);
      let teardown: (() => void) | null = null;
      if (src) teardown = b.engine.connectExternal(c.to.jack, src);
      if (!teardown) {
        src = b.engine.getOutput(c.to.jack);
        if (src) teardown = a.engine.connectExternal(c.from.jack, src);
      }
      if (teardown) this.cableTeardowns.set(key, teardown);
    });
  }

  isSynced(slot: Slot | string): boolean {
    const s = typeof slot === 'string' ? this.slots.get(slot) : slot;
    if (!s?.module.studio?.midiSync) return false;
    return useStudioStore.getState().studio.sync[s.instance] !== false;
  }

  private applySync() {
    this.slots.forEach(slot => {
      if (!slot.started) return;
      slot.engine.followTransport(this.isSynced(slot) ? transport : null);
    });
  }

  // --------------------------------------------------------------------------
  // Playing
  // --------------------------------------------------------------------------

  noteOn(instance: string, note: number, velocity = 1) {
    this.slots.get(instance)?.engine.noteOn(note, velocity);
  }

  noteOff(instance: string, note: number) {
    this.slots.get(instance)?.engine.noteOff(note);
  }

  event(instance: string, name: string, payload?: unknown) {
    this.slots.get(instance)?.engine.event(name, payload);
  }

  /** User changed a control. Synced transport buttons drive the studio transport. */
  setControl(instance: string, id: string, value: ControlValue) {
    const slot = this.slots.get(instance);
    const store = useStudioStore.getState();
    if (slot && slot.module.transportControl === id && this.isSynced(slot)) {
      this.ensureAudio();
      if (value && !transport.playing) transport.start();
      else if (!value && transport.playing) transport.stop();
      store.setControlValue(instance, id, value);
      return;
    }
    store.setControlValue(instance, id, value);
  }

  getState(instance: string): EngineState {
    return this.slots.get(instance)?.state ?? {};
  }

  subscribeState(instance: string, l: (s: EngineState) => void): () => void {
    let slot = this.slots.get(instance);
    let unsubSlot: (() => void) | null = null;
    const attach = () => {
      slot = this.slots.get(instance);
      if (slot) {
        slot.listeners.add(l);
        l(slot.state);
      }
    };
    if (slot) attach();
    else unsubSlot = this.onSlotsChange(() => { if (!slot) attach(); });
    return () => {
      unsubSlot?.();
      slot?.listeners.delete(l);
    };
  }

  /** Mute/unmute an instrument's output at an audio time (arranger) */
  setMuted(instance: string, muted: boolean, time?: number) {
    const slot = this.slots.get(instance);
    if (!slot?.outGain) return;
    const ctx = getAudioContext();
    const t = Math.max(ctx.currentTime, time ?? ctx.currentTime);
    slot.outGain.gain.setTargetAtTime(muted ? 0 : 1, t, 0.004);
  }

  getEngine(instance: string): SynthEngine | undefined {
    return this.slots.get(instance)?.engine;
  }

  // --------------------------------------------------------------------------
  // Auditions (lessons: "listen to the target")
  // --------------------------------------------------------------------------

  /**
   * Temporarily play `values` (and optionally `patches`) on an instrument without
   * changing what the store - and therefore the panel - says. Restores afterwards.
   */
  audition(instance: string, values: Record<string, ControlValue> | null, opts: { patches?: PatchConnection[]; ms?: number } = {}) {
    this.stopAudition();
    const slot = this.slots.get(instance);
    if (!slot) return;
    this.ensureAudio();
    const ms = opts.ms ?? 2600;
    if (values) {
      slot.auditioning = true;
      Object.entries(values).forEach(([k, v]) => slot.engine.setParam(k, v));
      if (opts.patches) slot.engine.setPatches(opts.patches);
    }
    const timers = this.auditionTimers;
    const api = {
      noteOn: (n: number, v = 1) => slot.engine.noteOn(n, v),
      noteOff: (n: number) => slot.engine.noteOff(n),
      event: (name: string, payload?: unknown) => slot.engine.event(name, payload),
      after: (t: number, fn: () => void) => { timers.push(setTimeout(fn, t)); },
    };
    const stopPhrase = (slot.module.audition ?? defaultAudition(slot.module, slot.instance))(api) || undefined;
    const restore = () => {
      stopPhrase?.();
      if (values) {
        slot.auditioning = false;
        // Push the real values back
        const real = this.valuesFor(instance);
        Object.keys(values).forEach(k => slot.engine.setParam(k, real[k]));
        slot.values = real;
        if (opts.patches) slot.engine.setPatches(slot.patches);
      }
    };
    this.auditionStop = restore;
    timers.push(setTimeout(() => this.stopAudition(), ms));
  }

  stopAudition() {
    this.auditionTimers.forEach(t => clearTimeout(t));
    this.auditionTimers = [];
    const stop = this.auditionStop;
    this.auditionStop = null;
    stop?.();
  }
}

/** Fallback demo phrase: a short riff for keyboards, a few bars for sequenced gear */
function defaultAudition(mod: DeviceModule, instance: string) {
  return (api: { noteOn: (n: number, v?: number) => void; noteOff: (n: number) => void; event: (e: string) => void; after: (ms: number, fn: () => void) => void }) => {
    if (mod.keyboard) {
      const root = mod.keyboard.lowNote + 12;
      const riff = [0, 7, 12, 7, 3, 10];
      riff.forEach((iv, i) => {
        api.after(i * 380, () => api.noteOn(root + iv, 0.9));
        api.after(i * 380 + 300, () => api.noteOff(root + iv));
      });
      return;
    }
    if (mod.transportControl) {
      const tc = mod.transportControl;
      const hubRef = hub;
      const wasPlaying = !!useStudioStore.getState().devices[instance]?.controlValues[tc];
      if (!wasPlaying) {
        hubRef.getEngine(instance)?.setParam(tc, true);
        return () => hubRef.getEngine(instance)?.setParam(tc, false);
      }
      return;
    }
    api.event('trigger');
  };
}

export const hub = new EngineHub();
