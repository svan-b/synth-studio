// ============================================================================
// Engine hub - owns every instrument engine in the studio.
//
// React views never create engines. The hub:
//   - loads device modules (code-split) and creates one engine per rack slot
//   - pushes store changes (knobs, internal cables, device data) into engines
//   - starts audio once (iOS unlock, worklets) and starts every engine
//   - gives every instrument a mixer channel strip (calibrated level, fader,
//     pan, mute/solo, sends) and routes the strip to the master bus or into a
//     mixer device's input ("<mixer>:<input>" -> connectExternal)
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
import { useStudioStore, specDefaults, getSpec } from '@/store/studio';
import {
  getAudioContext, getMasterBus, installAudioUnlock, loadExtraWorklet, loadWorklets, onAudioStateChange, resumeAudio,
  resetMasterMeter, setMasterSettings,
} from '@/lib/audio/context';
import { transport } from '@/lib/audio/transport';
import { StudioMixer, type ChannelStrip } from './mixer';
import { masterOf, dbToGain } from './mixerDoc';
import { levelTrimDb } from './levels';
import { withoutHistory } from './historyGate';
import { metronome } from './metronome';

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
  /** The instrument's mixer channel (the engine's destination is strip.input) */
  strip: ChannelStrip | null;
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
  private _mixer: StudioMixer | null = null;
  private runTimer: ReturnType<typeof setTimeout> | null = null;

  get status() { return this._status; }
  get error() { return this._error; }
  /** The studio mixer (null until audio has started) */
  get mixer() { return this._mixer; }

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
    metronome.init();
    this.reconcileRack();
    useStudioStore.subscribe((s, prev) => {
      if (s.studio === prev.studio && s.devices === prev.devices) return;
      if (s.studio.rack !== prev.studio.rack || s.studio.off !== prev.studio.off) this.reconcileRack();
      if (s.devices !== prev.devices) this.pushAll();
      if (s.studio.routes !== prev.studio.routes || s.studio.rack !== prev.studio.rack) this.applyRouting();
      if (s.studio.cables !== prev.studio.cables) this.applyCables();
      if (s.studio.sync !== prev.studio.sync) this.applySync();
      // Undo, projects and sets change these without going through setBpm / setSwing
      if (s.studio.bpm !== prev.studio.bpm) transport.setBpm(s.studio.bpm);
      if (s.studio.swing !== prev.studio.swing) transport.setSwing(s.studio.swing);
      if (s.studio.mixer !== prev.studio.mixer || s.studio.routes !== prev.studio.routes ||
        s.studio.rack !== prev.studio.rack || s.studio.bpm !== prev.studio.bpm) this.applyMixer();
    });
    onAudioStateChange(running => {
      if (running && this._status !== 'on' && !this.starting) void this.startAudio();
      if (!running && this._status === 'on') this.setStatus('off');
    });
    transport.onEvent(e => {
      if (e.type !== 'start' && e.type !== 'stop') return;
      // Integrated loudness counts from Play
      if (e.type === 'start') resetMasterMeter();
      // Mirror the studio transport into synced instruments' own play buttons
      const playing = e.type === 'start';
      const store = useStudioStore.getState();
      withoutHistory(() => {
        this.slots.forEach(slot => {
          const tc = slot.module.transportControl;
          if (tc && this.isSynced(slot) && store.devices[slot.instance]?.controlValues[tc] !== playing) {
            store.setControlValue(slot.instance, tc, playing);
          }
        });
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
    // Initialising data and clearing stale performance buttons is the app's doing,
    // not an edit: keep it out of undo
    withoutHistory(() => {
      const store = useStudioStore.getState();
      // Initialise structured data the first time this instance is seen
      const saved = store.devices[instance]?.data;
      if (module.data && saved === undefined) {
        store.setDeviceData(instance, module.data.initial());
      } else if (module.data?.migrate && saved !== undefined) {
        const migrated = module.data.migrate(saved);
        if (migrated !== saved) store.setDeviceData(instance, migrated);
      }
      // Transport and momentary buttons are performance actions, not settings: an
      // instrument never comes back from a reload (or a switch back) already running.
      const stored = useStudioStore.getState().devices[instance]?.controlValues ?? {};
      const transient: Record<string, boolean> = {};
      Object.entries(module.spec.controls).forEach(([id, c]) => {
        if (c.type !== 'button') return;
        const isTransport = id === module.transportControl;
        if ((c.momentary || isTransport) && stored[id] !== undefined && stored[id] !== c.default) transient[id] = c.default;
      });
      if (Object.keys(transient).length) useStudioStore.getState().setControlValues(instance, transient);
    });

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
      strip: null,
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
    // Cables touching this instance
    this.cableTeardowns.forEach((t, key) => {
      if (key.includes(`${instance}|`)) {
        t();
        this.cableTeardowns.delete(key);
      }
    });
    slot.unsubEngine();
    slot.engine.dispose();
    // Let the engine's own 60 ms fade-out finish before the strip goes
    const mixer = this._mixer;
    if (slot.strip && mixer) {
      const strip = slot.strip;
      setTimeout(() => { if (mixer.get(instance) === strip) mixer.removeStrip(instance); else strip.dispose(); }, 90);
    }
    this.slots.delete(instance);
    this.slotListeners.forEach(l => l());
  }

  isPowered(instance: string) {
    return !useStudioStore.getState().studio.off?.[instance];
  }

  hasInstance(instance: string) {
    return this.slots.has(instance);
  }

  /** Instances with a running engine (for the mixer UI and stems) */
  instances(): string[] {
    return [...this.slots.keys()];
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
        if (!this._mixer) this._mixer = new StudioMixer(ctx, getMasterBus());
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
        this.applyMixer();
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
      if (!this.slots.has(slot.instance) || !this._mixer) return;
      slot.strip = this._mixer.createStrip(slot.instance, {
        trimDb: levelTrimDb(slot.device),
        stereo: !!slot.module.studio?.stereo,
      });
      slot.engine.start(ctx, slot.strip.input);
      slot.started = true;
      this.applyMixer();
      this.applyRouting();
      this.applyCables();
      this.applySync();
      this.slotListeners.forEach(l => l());
    };
    void run().catch(e => console.error('[hub] engine start failed', slot.instance, e));
  }

  // --------------------------------------------------------------------------
  // Routing, mixer, cables, sync
  // --------------------------------------------------------------------------

  private applyRouting() {
    if (this._status !== 'on') return;
    const routes = useStudioStore.getState().studio.routes;
    const master = getMasterBus();
    this.slots.forEach(slot => {
      if (!slot.started || !slot.strip) return;
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
      const out = slot.strip.output;
      try { out.disconnect(master); } catch { /* not connected */ }
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

  private applyMixer() {
    const mixer = this._mixer;
    if (!mixer) return;
    const st = useStudioStore.getState().studio;
    mixer.apply(st.mixer, st.rack, st.routes, st.bpm);
    const m = masterOf(st.mixer);
    setMasterSettings({ gain: dbToGain(m.gain), eq: m.eq, glue: m.glue });
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

  /** Is this instrument stepped by a clock/trigger cable from another instrument (DFAM from the Studio Clock)? */
  private clockedByCable(instance: string): boolean {
    const st = useStudioStore.getState();
    return st.studio.cables.some(c => {
      const ends = [[c.from, c.to], [c.to, c.from]] as const;
      return ends.some(([src, dst]) => {
        if (dst.instance !== instance || src.instance === instance) return false;
        const jack = getSpec(st.deviceOf(src.instance))?.patchBay?.outputs.find(j => j.id === src.jack);
        return !!jack && (jack.signalType === 'clock' || jack.signalType === 'trigger' || jack.signalType === 'gate');
      });
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
      if (value && !transport.playing) this.startAll();
      else if (!value && transport.playing) this.stopAll();
      store.setControlValue(instance, id, value);
      return;
    }
    store.setControlValue(instance, id, value);
  }

  /**
   * The big ▶: start the studio clock, and every instrument's own sequencer that
   * isn't already following the clock by MIDI-style sync. "Play" should mean
   * "everything plays".
   *
   * opts.countIn plays one bar of clicks first (default: the studio's count-in
   * setting); opts.at starts on an exact audio time (bounces); opts.fromTick
   * starts from a song position.
   */
  startAll(opts: { countIn?: boolean; at?: number; fromTick?: number } = {}) {
    this.ensureAudio();
    if (transport.playing) return;
    const st = useStudioStore.getState();
    const ctx = getAudioContext();
    transport.setBpm(st.studio.bpm);
    transport.setSwing(st.studio.swing);
    const countIn = opts.countIn ?? !!st.studio.metronome?.countIn;
    const lead = countIn ? (4 * 60) / transport.bpm : 0;
    const t0 = opts.at ?? ctx.currentTime + 0.06 + lead;
    if (countIn) metronome.countIn(t0, transport.bpm);
    // Press RUN on everything that isn't synced. Instruments stepped by a clock cable
    // only advance on pulses, so they must already be running when the first pulse is
    // scheduled (100 ms ahead): press now. Free-running ones start their own clock when
    // pressed: press just before the downbeat.
    const unsynced = [...this.slots.values()].filter(slot => slot.module.transportControl && !this.isSynced(slot));
    const press = (slots: Slot[]) => withoutHistory(() => {
      const store = useStudioStore.getState();
      slots.forEach(slot => {
        const tc = slot.module.transportControl!;
        if (!store.devices[slot.instance]?.controlValues[tc]) store.setControlValue(slot.instance, tc, true);
      });
    });
    const clocked = unsynced.filter(s => this.clockedByCable(s.instance));
    const free = unsynced.filter(s => !clocked.includes(s));
    press(clocked);
    const wait = (t0 - ctx.currentTime - 0.03) * 1000;
    if (this.runTimer) clearTimeout(this.runTimer);
    this.runTimer = null;
    if (wait > 15 && free.length) {
      this.runTimer = setTimeout(() => { this.runTimer = null; if (transport.playing) press(free); }, wait);
    } else press(free);
    transport.start(t0, opts.fromTick ?? 0);
  }

  /** The big ■: stop the clock and every instrument's own sequencer */
  stopAll() {
    if (this.runTimer) { clearTimeout(this.runTimer); this.runTimer = null; }
    metronome.cancel();
    transport.stop();
    const st = useStudioStore.getState();
    withoutHistory(() => {
      this.slots.forEach(slot => {
        const tc = slot.module.transportControl;
        if (!tc) return;
        if (st.devices[slot.instance]?.controlValues[tc]) st.setControlValue(slot.instance, tc, false);
      });
    });
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

  /** Mute/unmute an instrument's output at an audio time (arranger). Independent of the mixer's mute. */
  setMuted(instance: string, muted: boolean, time?: number) {
    const strip = this.slots.get(instance)?.strip;
    if (!strip) return;
    strip.setArrangerMute(muted, time ?? getAudioContext().currentTime);
  }

  getEngine(instance: string): SynthEngine | undefined {
    return this.slots.get(instance)?.engine;
  }

  /** The node an instrument's channel outputs (post-fader) - for stems and tests */
  getStripOutput(instance: string): AudioNode | null {
    return this.slots.get(instance)?.strip?.output ?? null;
  }

  /** The node feeding an instrument's channel (pre-fader) - tests inject signals here */
  getStripInput(instance: string): AudioNode | null {
    return this.slots.get(instance)?.strip?.input ?? null;
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
