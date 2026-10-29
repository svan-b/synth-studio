// ============================================================================
// Undo / redo for the studio.
//
// A separate subscriber to the store: it never sits between a knob and the
// engine (the hub subscribed first and has already pushed the value). Each store
// change is diffed at the granularity people think in - one control value, an
// instrument's cables, its pattern data, the rack, the studio cables, routing,
// sync, tempo, the arrangement, one mixer channel, a return, the master - and
// only the before/after values of what changed are kept. The store is immutable,
// so those values are shared with it (structural sharing): a step costs a few
// references, and the history holds the last 100.
//
// What is not recorded:
// - lesson state, and any change made in the same tick as a lesson step change
//   (lesson set-up values, restoring the learner's patch)
// - performance actions: transport/RUN buttons, momentary buttons and UI
//   navigation controls (Elektron track/page), the metronome
// - changes made by the app itself, wrapped in withoutHistory() (engine data
//   initialisation, the arranger's knob snapshots)
// - loading or starting a project clears the history (like a DAW)
//
// Coalescing: everything during one pointer gesture (a knob or fader drag, a
// pattern swipe) is one step. Repeated edits of the same thing within 0.8 s
// without a pointer (arrow keys, MIDI knobs, typing a tempo) are one step too.
// ============================================================================

import type { ControlValue, PatchConnection } from '@/types';
import { useStudioStore, getSpec, type InstanceState, type StudioDoc } from '@/store/studio';
import { DEVICES } from '@/devices';
import { hub } from './hub';
import { historyPaused } from './historyGate';

const LIMIT = 100;
const MERGE_MS = 800;

type StudioKey = 'rack' | 'cables' | 'routes' | 'sync' | 'off' | 'bpm' | 'swing' | 'arrangement';
const STUDIO_KEYS: StudioKey[] = ['rack', 'cables', 'routes', 'sync', 'off', 'bpm', 'swing', 'arrangement'];

type Target =
  | { kind: 'cv'; instance: string; control: string }
  | { kind: 'patches'; instance: string }
  | { kind: 'data'; instance: string }
  | { kind: 'studio'; key: StudioKey }
  | { kind: 'channel'; instance: string }
  | { kind: 'mixer'; key: 'delay' | 'reverb' | 'master' };

interface Change {
  target: Target;
  before: unknown;
  after: unknown;
}

interface Entry {
  changes: Map<string, Change>;
  gesture: number;
  last: number;
  pointer: boolean;
}

type S = ReturnType<typeof useStudioStore.getState>;
const EMPTY: Record<string, ControlValue> = {};

const keyOf = (t: Target): string => {
  switch (t.kind) {
    case 'cv': return `cv\u0001${t.instance}\u0001${t.control}`;
    case 'patches': return `p\u0001${t.instance}`;
    case 'data': return `d\u0001${t.instance}`;
    case 'studio': return `s\u0001${t.key}`;
    case 'channel': return `c\u0001${t.instance}`;
    case 'mixer': return `m\u0001${t.key}`;
  }
};

class StudioHistory {
  private past: Entry[] = [];
  private future: Entry[] = [];
  private pending: Map<string, Change> | null = null;
  private pendingLesson = false;
  private scheduled = false;
  private pendingPointer = false;
  private applying = false;
  private gesture = 0;
  private pointerDown = false;
  private listeners = new Set<() => void>();
  private transient = new Map<string, Set<string>>();
  private started = false;
  /** Main-thread time spent diffing store changes (for the latency check) */
  stats = { changes: 0, totalMs: 0, maxMs: 0 };

  init() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    useStudioStore.subscribe((s, prev) => this.onChange(s, prev));
    // Gestures: a drag is one undo step
    window.addEventListener('pointerdown', () => { this.gesture++; this.pointerDown = true; }, true);
    const up = () => { setTimeout(() => { this.pointerDown = false; }, 0); };
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    window.addEventListener('keydown', e => this.onKey(e));
    (window as unknown as { __synthHistory?: StudioHistory }).__synthHistory = this;
  }

  // --------------------------------------------------------------------------

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  get depth() { return { undo: this.past.length, redo: this.future.length }; }

  subscribe(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Bumped on every change of the stacks (for useSyncExternalStore) */
  version = 0;

  private emit() {
    this.version++;
    this.listeners.forEach(l => l());
  }

  /** Forget everything (project loaded, new project) */
  clear() {
    this.flush();
    this.past = [];
    this.future = [];
    this.emit();
  }

  undo() {
    this.flush();
    const e = this.past.pop();
    if (!e) return;
    this.apply(e, 'before');
    this.future.push(e);
    this.emit();
  }

  redo() {
    this.flush();
    const e = this.future.pop();
    if (!e) return;
    this.apply(e, 'after');
    this.past.push(e);
    this.emit();
  }

  /** Short description of the next undo / redo ("DFAM CUTOFF", "Studio cables") */
  describe(which: 'undo' | 'redo'): string | null {
    const e = which === 'undo' ? this.past[this.past.length - 1] : this.future[this.future.length - 1];
    if (!e) return null;
    return describeEntry(e);
  }

  // --------------------------------------------------------------------------

  private onKey(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k !== 'z' && k !== 'y') return;
    const t = e.target as HTMLElement | null;
    // Text fields keep their own undo
    if (t && t.closest('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]), textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    if (k === 'y' || e.shiftKey) this.redo();
    else this.undo();
  }

  private transientControls(device: string): Set<string> {
    let set = this.transient.get(device);
    if (set) return set;
    set = new Set<string>();
    const mod = hub.getModule(device);
    if (mod) {
      if (mod.transportControl) set.add(mod.transportControl);
      mod.uiControls?.forEach(id => set!.add(id));
    }
    const spec = mod?.spec ?? getSpec(device);
    if (spec) {
      Object.entries(spec.controls).forEach(([id, c]) => { if (c.type === 'button' && c.momentary) set!.add(id); });
    }
    // Only cache once the module is known (it loads asynchronously)
    if (mod) this.transient.set(device, set);
    return set;
  }

  private onChange(s: S, prev: S) {
    if (this.applying) return;
    const lesson = s.currentLesson !== prev.currentLesson || s.currentStep !== prev.currentStep ||
      s.isTeachingMode !== prev.isTeachingMode || s.lessonSnapshot !== prev.lessonSnapshot;
    const edit = s.devices !== prev.devices || s.studio !== prev.studio;
    if (!lesson && !edit) return;
    // One commit per tick. A lesson step change anywhere in the tick (before or after
    // the values it sets up) keeps the whole tick out of the history.
    if (!this.scheduled) {
      this.scheduled = true;
      this.pendingLesson = false;
      this.pendingPointer = false;
      queueMicrotask(() => this.flush());
    }
    if (lesson) this.pendingLesson = true;
    if (!edit || historyPaused()) return;
    const t0 = performance.now();
    if (!this.pending) this.pending = new Map();
    if (this.pointerDown) this.pendingPointer = true;
    diff(prev, s, this.pending, d => this.transientControls(d));
    const dt = performance.now() - t0;
    this.stats.changes++;
    this.stats.totalMs += dt;
    if (dt > this.stats.maxMs) this.stats.maxMs = dt;
  }

  /** Commit the changes of the current tick as an undo step (or merge them into the last) */
  private flush() {
    const changes = this.pending;
    this.pending = null;
    this.scheduled = false;
    if (!changes || !changes.size || this.pendingLesson) return;
    const now = performance.now();
    const top = this.past[this.past.length - 1];
    const sameGesture = top && this.pendingPointer && top.pointer && top.gesture === this.gesture;
    const sameTargets = top && !this.pendingPointer && !top.pointer && now - top.last < MERGE_MS &&
      top.changes.size === changes.size && [...changes.keys()].every(k => top.changes.has(k));
    if (top && (sameGesture || sameTargets) && this.future.length === 0) {
      changes.forEach((c, k) => {
        const old = top.changes.get(k);
        if (old) {
          old.after = c.after;
          if (old.after === old.before) top.changes.delete(k);
        } else top.changes.set(k, c);
      });
      top.last = now;
      if (!top.changes.size) this.past.pop();
    } else {
      this.past.push({ changes, gesture: this.gesture, last: now, pointer: this.pendingPointer });
      if (this.past.length > LIMIT) this.past.shift();
    }
    if (this.future.length) this.future = [];
    this.emit();
  }

  private apply(e: Entry, which: 'before' | 'after') {
    this.applying = true;
    try {
      useStudioStore.setState(state => applyChanges(state, [...e.changes.values()], which));
    } finally {
      this.applying = false;
    }
    // Lesson checks look at the restored values
    useStudioStore.getState().reevaluate();
  }
}

// ----------------------------------------------------------------------------
// Diff and apply
// ----------------------------------------------------------------------------

function deviceOfInstance(s: S, instance: string): string {
  return s.studio.rack.find(r => r.id === instance)?.device ?? instance.split('#')[0];
}

function add(out: Map<string, Change>, target: Target, before: unknown, after: unknown) {
  const k = keyOf(target);
  const old = out.get(k);
  if (old) {
    old.after = after;
    if (old.after === old.before) out.delete(k);
  } else if (before !== after) out.set(k, { target, before, after });
}

function diff(prev: S, next: S, out: Map<string, Change>, transient: (device: string) => Set<string>) {
  if (prev.devices !== next.devices) {
    const ids = new Set([...Object.keys(prev.devices), ...Object.keys(next.devices)]);
    ids.forEach(id => {
      const a = prev.devices[id], b = next.devices[id];
      if (a === b) return;
      const ca = a?.controlValues ?? EMPTY, cb = b?.controlValues ?? EMPTY;
      if (ca !== cb) {
        const skip = transient(deviceOfInstance(next, id));
        for (const k in cb) if (ca[k] !== cb[k] && !skip.has(k)) add(out, { kind: 'cv', instance: id, control: k }, ca[k], cb[k]);
        for (const k in ca) if (!(k in cb) && !skip.has(k)) add(out, { kind: 'cv', instance: id, control: k }, ca[k], undefined);
      }
      if (a?.patchConnections !== b?.patchConnections) add(out, { kind: 'patches', instance: id }, a?.patchConnections, b?.patchConnections);
      if (a?.data !== b?.data) add(out, { kind: 'data', instance: id }, a?.data, b?.data);
    });
  }
  if (prev.studio !== next.studio) {
    STUDIO_KEYS.forEach(key => {
      if (prev.studio[key] !== next.studio[key]) add(out, { kind: 'studio', key }, prev.studio[key], next.studio[key]);
    });
    const ma = prev.studio.mixer, mb = next.studio.mixer;
    if (ma !== mb) {
      const ca = ma?.channels ?? {}, cb = mb?.channels ?? {};
      if (ca !== cb) {
        new Set([...Object.keys(ca), ...Object.keys(cb)]).forEach(id => {
          if (ca[id] !== cb[id]) add(out, { kind: 'channel', instance: id }, ca[id], cb[id]);
        });
      }
      (['delay', 'reverb', 'master'] as const).forEach(key => {
        if (ma?.[key] !== mb?.[key]) add(out, { kind: 'mixer', key }, ma?.[key], mb?.[key]);
      });
    }
  }
}

function applyChanges(state: S, changes: Change[], which: 'before' | 'after'): Partial<S> {
  const devices: Record<string, InstanceState> = { ...state.devices };
  let studio: StudioDoc = { ...state.studio };
  const touched = new Set<string>();
  const instance = (id: string): InstanceState => {
    if (!touched.has(id)) {
      const cur = devices[id] ?? { controlValues: {}, patchConnections: [] };
      devices[id] = { ...cur, controlValues: { ...cur.controlValues } };
      touched.add(id);
    }
    return devices[id];
  };
  let mixer = studio.mixer;
  let channels: Record<string, unknown> | null = null;
  changes.forEach(c => {
    const v = c[which];
    const t = c.target;
    switch (t.kind) {
      case 'cv': {
        const inst = instance(t.instance);
        if (v === undefined) delete inst.controlValues[t.control];
        else inst.controlValues[t.control] = v as ControlValue;
        break;
      }
      case 'patches': instance(t.instance).patchConnections = (v as PatchConnection[] | undefined) ?? []; break;
      case 'data': instance(t.instance).data = v; break;
      case 'studio': studio = { ...studio, [t.key]: v }; break;
      case 'channel': {
        if (!channels) channels = { ...(mixer?.channels ?? {}) };
        if (v === undefined) delete channels[t.instance];
        else channels[t.instance] = v;
        break;
      }
      case 'mixer': mixer = { ...(mixer ?? {}), [t.key]: v }; break;
    }
  });
  if (channels) mixer = { ...(mixer ?? {}), channels: channels as NonNullable<StudioDoc['mixer']>['channels'] };
  if (mixer !== studio.mixer) studio = { ...studio, mixer };
  return { devices, studio };
}

// ----------------------------------------------------------------------------
// Labels
// ----------------------------------------------------------------------------

function nameOf(instance: string): string {
  const st = useStudioStore.getState();
  const r = st.studio.rack.find(x => x.id === instance);
  const entry = DEVICES.find(d => d.id === (r?.device ?? instance.split('#')[0]));
  return r?.label ?? entry?.name ?? instance;
}

function describeEntry(e: Entry): string {
  const changes = [...e.changes.values()];
  const kinds = new Set(changes.map(c => c.target.kind));
  const first = changes[0]?.target;
  if (!first) return 'change';
  if (kinds.size === 1 && first.kind === 'cv') {
    const instances = new Set(changes.map(c => (c.target as { instance: string }).instance));
    if (changes.length === 1) {
      const dev = useStudioStore.getState().deviceOf(first.instance);
      const label = getSpec(dev)?.controls[first.control]?.label ?? first.control;
      return `${nameOf(first.instance)} ${label}`;
    }
    if (instances.size === 1) return `${nameOf(first.instance)} settings`;
    return 'settings';
  }
  if (first.kind === 'studio') {
    const labels: Record<StudioKey, string> = {
      rack: 'rack', cables: 'studio cables', routes: 'routing', sync: 'sync', off: 'power',
      bpm: 'tempo', swing: 'swing', arrangement: 'arrangement',
    };
    if (kinds.size === 1 && changes.length === 1) return labels[first.key];
    if (changes.some(c => c.target.kind === 'studio' && c.target.key === 'rack')) return 'rack';
  }
  if (kinds.has('channel') || kinds.has('mixer')) {
    if (changes.length === 1 && first.kind === 'channel') return `${nameOf(first.instance)} channel`;
    return 'mixer';
  }
  if (first.kind === 'patches') return `${nameOf(first.instance)} cables`;
  if (first.kind === 'data') return `${nameOf(first.instance)} pattern`;
  return 'changes';
}

export const history = new StudioHistory();
