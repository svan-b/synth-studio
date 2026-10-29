import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ControlValue, DeviceSpec, Lesson, LessonCheckState, LessonStep, PatchConnection } from '@/types';
import type { RackSlot, StudioCable } from '@/devices/types';
import { isStepSatisfied, isValueOnTarget, valueToNorm, defaultOf } from '@/lib/controls/mapping';
import { transport } from '@/lib/audio/transport';
import { STORE_VERSION, upgradeDevices } from '@/lib/studio/upgrades';
import type { ChannelDoc, DelayDoc, MasterDoc, MixerDoc, ReverbDoc } from '@/lib/studio/mixerDoc';
import { throttledLocalStorage } from '@/lib/studio/persistStorage';

// ============================================================================
// Synth Studio store
//
//  devices   per *instance* state (knobs, internal patch cables, structured data).
//            The first instance of a device uses the device id as its instance id,
//            so single-instrument use and older saves map 1:1.
//  studio    the rack, cables between instruments, audio routing, sync, tempo,
//            and the song arrangement.
//  progress  completed lessons and the spaced-review queue.
//  lesson    the running lesson session (not persisted).
// ============================================================================

export interface InstanceState {
  controlValues: Record<string, ControlValue>;
  patchConnections: PatchConnection[];
  data?: unknown;
}

export interface SectionPart {
  /** Pattern id for pattern-based instruments (Elektron "A01") */
  pattern?: string;
  /** Knob snapshot for instruments without pattern memory */
  snapshot?: Record<string, ControlValue>;
  muted?: boolean;
}

export interface ArrangementSection {
  id: string;
  name: string;
  bars: number;
  color?: string;
  parts: Record<string, SectionPart>;
}

export interface Arrangement {
  enabled: boolean;
  loop: boolean;
  sections: ArrangementSection[];
}

export interface StudioDoc {
  rack: RackSlot[];
  cables: StudioCable[];
  /** instance -> 'master' | '<mixerInstance>:<inputId>' */
  routes: Record<string, string>;
  /** instance -> follows the studio transport (MIDI-clock style) */
  sync: Record<string, boolean>;
  bpm: number;
  swing: number;
  arrangement: Arrangement;
  /** instance -> powered off (engine freed to save CPU; settings kept) */
  off?: Record<string, boolean>;
  /** Mixer: channel strips, returns, master section. Optional on disk: lib/studio/mixerDoc.ts fills defaults. */
  mixer?: MixerDoc;
  /** Metronome click and 1-bar count-in (a working preference: not undoable) */
  metronome?: { click?: boolean; countIn?: boolean };
}

export interface ReviewItem {
  /** Leitner box 0..5 - higher = known better = longer interval */
  box: number;
  due: number;
  last: number;
  right: number;
  wrong: number;
  /** Where it came from, for display */
  lesson: string;
}

export interface StepSession {
  /** predict / listen-question / quiz: chosen option */
  answer?: number;
  /** match: number of Check presses and the last result */
  attempts?: number;
  match?: { score: number; off: { id: string; dir: 'higher' | 'lower' | 'different' }[] };
  /** reflect: self-rating once the model answer was shown */
  rating?: 'got-it' | 'partly' | 'not-yet';
  revealed?: boolean;
  hints?: number;
}

interface LessonSessionState {
  currentLesson?: Lesson;
  /** Instance the lesson runs on */
  lessonInstance?: string;
  currentStep: number;
  isTeachingMode: boolean;
  lessonFinished: boolean;
  stepSatisfied: boolean;
  session: Record<number, StepSession>;
  /** The learner's own patch from before the lesson, so it can be restored */
  lessonSnapshot?: { instance: string; state: InstanceState };
  /** Spotlight: dim everything except what the step is about */
  focusMode: boolean;
}

interface StudioStoreState extends LessonSessionState {
  /** Focused instance (the big panel) */
  currentDevice: string;
  devices: Record<string, InstanceState>;
  studio: StudioDoc;
  completedLessons: string[];
  review: Record<string, ReviewItem>;
}

interface StudioStore extends StudioStoreState {
  // ---- focus / rack ---------------------------------------------------------
  setCurrentDevice: (instanceOrDevice: string) => void;
  registerDevice: (spec: DeviceSpec) => void;
  addToRack: (device: string, opts?: { duplicate?: boolean; label?: string; focus?: boolean }) => string;
  /** Swap one instrument for another (single-instrument use, like the original app). Returns the new instance id. */
  replaceInRack: (instance: string, device: string) => string;
  removeFromRack: (instance: string) => void;
  moveInRack: (instance: string, delta: number) => void;
  renameInstance: (instance: string, label: string) => void;
  deviceOf: (instance: string) => string;

  // ---- per-instance state ---------------------------------------------------
  setControlValue: (instance: string, control: string, value: ControlValue) => void;
  setControlValues: (instance: string, values: Record<string, ControlValue>) => void;
  getControlValue: (instance: string, control: string) => ControlValue | undefined;
  resetControlsToSpec: (instance: string, defaults: Record<string, ControlValue>) => void;
  loadPreset: (instance: string, values: Record<string, ControlValue>, patches?: PatchConnection[]) => void;
  setDeviceData: (instance: string, data: unknown) => void;
  updateDeviceData: (instance: string, fn: (d: unknown) => unknown) => void;

  addPatchConnection: (instance: string, from: string, to: string, color?: string) => void;
  removePatchConnection: (instance: string, from: string, to: string) => void;
  clearPatchConnections: (instance: string) => void;

  // ---- studio ---------------------------------------------------------------
  addStudioCable: (cable: StudioCable) => void;
  removeStudioCable: (cable: StudioCable) => void;
  clearStudioCables: (instance?: string) => void;
  setRoute: (instance: string, route: string) => void;
  setSync: (instance: string, on: boolean) => void;
  setPowered: (instance: string, on: boolean) => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setArrangement: (fn: (a: Arrangement) => Arrangement) => void;
  /** Mixer channel of an instance (fader dB, pan, mute, solo, sends) */
  setChannel: (instance: string, patch: Partial<ChannelDoc>) => void;
  setReturn: (bus: 'delay' | 'reverb', patch: Partial<DelayDoc> | Partial<ReverbDoc>) => void;
  setMasterSection: (patch: { gain?: number; eq?: Partial<MasterDoc['eq']>; glue?: Partial<MasterDoc['glue']> }) => void;
  setMixer: (fn: (m: MixerDoc) => MixerDoc) => void;
  setMetronome: (patch: { click?: boolean; countIn?: boolean }) => void;
  loadProject: (p: { devices: Record<string, InstanceState>; studio: StudioDoc; currentDevice?: string }) => void;
  newProject: () => void;

  // ---- lessons --------------------------------------------------------------
  startLesson: (lesson: Lesson, instance?: string) => void;
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetLesson: () => void;
  completeLesson: () => void;
  restoreLessonSnapshot: () => void;
  isStepComplete: () => boolean;
  answerStep: (answer: number) => void;
  checkMatch: () => void;
  rateReflection: (rating: 'got-it' | 'partly' | 'not-yet') => void;
  revealStep: () => void;
  showHint: () => void;
  setFocusMode: (on: boolean) => void;
  reevaluate: () => void;

  // ---- spaced review --------------------------------------------------------
  recordReview: (itemId: string, correct: boolean, lesson: string) => void;
}

/** The browser save of the studio (throttled; see lib/studio/persistStorage.ts) */
export const studioStorage = throttledLocalStorage<unknown>();

// Device specs registered at runtime (module scope - not persisted)
const specs: Record<string, DeviceSpec> = {};
let advanceTimer: ReturnType<typeof setTimeout> | null = null;

const ADVANCE_DELAY_MS = 750;
const PREDICT_REVEAL_MS = 2200;
/** Leitner intervals per box (ms) */
const DAY = 86_400_000;
const BOX_INTERVALS = [0, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY];

const PRESET_COLORS = ['#22c55e', '#f97316', '#ef4444', '#06b6d4', '#a855f7', '#eab308', '#ec4899', '#3b82f6', '#14b8a6', '#f43f5e'];

const initInstance = (): InstanceState => ({ controlValues: {}, patchConnections: [] });

const defaultStudio = (focus = 'dfam'): StudioDoc => ({
  rack: [{ id: focus, device: focus }],
  cables: [],
  routes: {},
  sync: {},
  bpm: 120,
  swing: 0,
  arrangement: { enabled: false, loop: true, sections: [] },
});

const sameCable = (c: PatchConnection, a: string, b: string) =>
  (c.from === a && c.to === b) || (c.from === b && c.to === a);

const sameStudioCable = (c: StudioCable, d: StudioCable) =>
  (c.from.instance === d.from.instance && c.from.jack === d.from.jack && c.to.instance === d.to.instance && c.to.jack === d.to.jack) ||
  (c.from.instance === d.to.instance && c.from.jack === d.to.jack && c.to.instance === d.from.instance && c.to.jack === d.from.jack);

/** The mixer without an instance's channel (it left the rack) */
const withoutChannel = (m: MixerDoc | undefined, instance: string): MixerDoc | undefined => {
  if (!m?.channels?.[instance]) return m;
  const channels = { ...m.channels };
  delete channels[instance];
  return { ...m, channels };
};

/** Device type of an instance id when the rack doesn't know it ('mother32#2' -> 'mother32') */
const stripInstance = (instance: string) => instance.split('#')[0];

function clearAdvance() {
  if (advanceTimer) clearTimeout(advanceTimer);
  advanceTimer = null;
}

/** Defaults for a device from its registered spec */
export function specDefaults(device: string): Record<string, ControlValue> {
  const spec = specs[device];
  const d: Record<string, ControlValue> = {};
  if (!spec) return d;
  Object.entries(spec.controls).forEach(([id, c]) => {
    const v = defaultOf(c);
    if (v !== undefined) d[id] = v;
  });
  return d;
}

export function getSpec(device: string): DeviceSpec | undefined {
  return specs[device];
}

/** Implicit step kind */
export function stepKind(step: LessonStep): NonNullable<LessonStep['kind']> {
  if (step.kind) return step.kind;
  if (step.patchFrom && step.patchTo) return 'patch';
  if (step.control) return 'do';
  if (step.checklist?.length) return 'challenge';
  return 'info';
}

export const useStudioStore = create<StudioStore>()(
  persist(
    (set, get) => {
      const deviceOf = (instance: string) => get().studio.rack.find(r => r.id === instance)?.device ?? stripInstance(instance);

      /** Put the output first so engines and the UI see a consistent direction */
      const orient = (instance: string, a: string, b: string): [string, string] => {
        const pb = specs[deviceOf(instance)]?.patchBay;
        if (!pb) return [a, b];
        const isOut = (id: string) => pb.outputs.some(j => j.id === id);
        if (!isOut(a) && isOut(b)) return [b, a];
        return [a, b];
      };

      const valuesOf = (instance: string) => ({ ...specDefaults(deviceOf(instance)), ...(get().devices[instance]?.controlValues ?? {}) });

      const checkState = (instance: string, engine: Record<string, unknown> = {}): LessonCheckState => {
        const s = get();
        const instances: LessonCheckState['instances'] = {};
        s.studio.rack.forEach(r => {
          instances[r.id] = {
            device: r.device,
            values: valuesOf(r.id),
            patches: s.devices[r.id]?.patchConnections ?? [],
            data: s.devices[r.id]?.data,
          };
        });
        return {
          values: valuesOf(instance),
          patches: s.devices[instance]?.patchConnections ?? [],
          data: s.devices[instance]?.data,
          engine,
          instances,
          studioCables: s.studio.cables,
          routes: s.studio.routes,
          sync: s.studio.sync,
          transport: { playing: transport.playing, bpm: s.studio.bpm },
          arrangement: s.studio.arrangement,
        };
      };

      /** Is the current step's *action* done (ignores answer requirements) */
      const actionDone = (lesson: Lesson, step: LessonStep, instance: string): boolean => {
        const kind = stepKind(step);
        const st = get().devices[instance] ?? initInstance();
        const device = deviceOf(instance);
        let ok = true;
        if (step.control || (step.patchFrom && step.patchTo)) {
          const spec = step.control ? specs[device]?.controls[step.control] : undefined;
          ok = isStepSatisfied(step, spec, valuesOf(instance), st.patchConnections);
        }
        if (ok && step.check) {
          try { ok = step.check(checkState(instance)); } catch { ok = false; }
        }
        if (ok && kind === 'challenge' && step.checklist?.length) {
          ok = step.checklist.every(c => {
            if (!c.check) return true;
            try { return c.check(checkState(instance)); } catch { return false; }
          });
        }
        void lesson;
        return ok;
      };

      /** Evaluate the current step; auto-advance when appropriate */
      const evaluate = () => {
        const s = get();
        if (!s.isTeachingMode || !s.currentLesson || s.lessonFinished) return;
        const lesson = s.currentLesson;
        const instance = s.lessonInstance ?? lesson.device;
        const step = lesson.steps[s.currentStep];
        if (!step) return;
        const kind = stepKind(step);
        const sess = s.session[s.currentStep] ?? {};
        let ok: boolean;
        let auto = false;
        let delay = ADVANCE_DELAY_MS;
        switch (kind) {
          case 'do':
          case 'patch':
            ok = actionDone(lesson, step, instance);
            auto = true;
            break;
          case 'predict':
            // Must commit to a prediction before the action counts
            ok = sess.answer !== undefined && actionDone(lesson, step, instance);
            auto = true;
            delay = PREDICT_REVEAL_MS;
            break;
          case 'challenge':
            ok = actionDone(lesson, step, instance);
            break;
          case 'match':
            ok = (sess.match?.score ?? 0) >= 1;
            break;
          case 'quiz':
            ok = sess.answer !== undefined;
            break;
          case 'listen':
            ok = step.listen?.question ? sess.answer !== undefined : true;
            break;
          case 'reflect':
            ok = sess.rating !== undefined;
            break;
          default:
            ok = step.check ? actionDone(lesson, step, instance) : true;
            auto = !!step.check;
        }

        if (!ok) {
          if (s.stepSatisfied) set({ stepSatisfied: false });
          clearAdvance();
          return;
        }
        if (s.stepSatisfied && advanceTimer) return;
        set({ stepSatisfied: true });
        if (!auto) return;
        clearAdvance();
        const lessonId = lesson.id;
        const stepIndex = s.currentStep;
        advanceTimer = setTimeout(() => {
          advanceTimer = null;
          const now = get();
          if (!now.isTeachingMode || now.currentLesson?.id !== lessonId || now.currentStep !== stepIndex) return;
          if (stepIndex >= lesson.steps.length - 1) set({ lessonFinished: true, stepSatisfied: true });
          else enterStep(stepIndex + 1);
        }, delay);
      };

      /** Move to a step and apply its setup state */
      const enterStep = (index: number) => {
        const s = get();
        const lesson = s.currentLesson;
        if (!lesson) return;
        clearAdvance();
        const i = Math.max(0, Math.min(lesson.steps.length - 1, index));
        const step = lesson.steps[i];
        const instance = s.lessonInstance ?? lesson.device;
        set({ currentStep: i, stepSatisfied: false, lessonFinished: false });
        if (step?.setup || step?.setupPatches || (stepKind(step) === 'match' && step.match)) {
          const values: Record<string, ControlValue> = { ...(step.setup ?? {}) };
          // Ear training: everything except the controls being tested starts at the target
          if (step.match) {
            Object.entries(step.match.target).forEach(([k, v]) => {
              if (!step.match!.controls.includes(k)) values[k] = v;
            });
          }
          set(state => {
            const d = state.devices[instance] ?? initInstance();
            return {
              devices: {
                ...state.devices,
                [instance]: {
                  ...d,
                  controlValues: { ...d.controlValues, ...values },
                  patchConnections: step.setupPatches ?? step.match?.patches ?? d.patchConnections,
                },
              },
            };
          });
        }
        evaluate();
      };

      const updateInstance = (instance: string, fn: (d: InstanceState) => InstanceState) => {
        set(state => ({
          devices: { ...state.devices, [instance]: fn(state.devices[instance] ?? initInstance()) },
        }));
        evaluate();
      };

      const updateStudio = (fn: (st: StudioDoc) => StudioDoc) => {
        set(state => ({ studio: fn(state.studio) }));
        evaluate();
      };

      const setSession = (patch: StepSession) => {
        const s = get();
        set({ session: { ...s.session, [s.currentStep]: { ...(s.session[s.currentStep] ?? {}), ...patch } } });
      };

      // Re-evaluate lesson checks when the transport starts/stops (sequencer tasks)
      if (typeof window !== 'undefined') {
        transport.onEvent(e => { if (e.type === 'start' || e.type === 'stop') setTimeout(evaluate, 0); });
      }

      return {
        currentDevice: 'dfam',
        devices: {},
        studio: defaultStudio(),
        completedLessons: [],
        review: {},
        currentLesson: undefined,
        lessonInstance: undefined,
        currentStep: 0,
        isTeachingMode: false,
        lessonFinished: false,
        stepSatisfied: false,
        session: {},
        lessonSnapshot: undefined,
        focusMode: true,

        // ---- focus / rack -------------------------------------------------------
        setCurrentDevice: id => {
          const s = get();
          let instance = id;
          if (!s.studio.rack.some(r => r.id === id)) {
            // A device type: focus its first instance, adding one if needed
            const existing = s.studio.rack.find(r => r.device === id);
            instance = existing ? existing.id : get().addToRack(id, { focus: false });
          }
          if (s.currentLesson && deviceOf(instance) !== s.currentLesson.device && s.currentLesson.device !== 'studio') get().resetLesson();
          set({ currentDevice: instance });
        },

        registerDevice: spec => {
          specs[spec.id] = spec;
        },

        deviceOf,

        addToRack: (device, opts = {}) => {
          const s = get();
          let id = device;
          if (s.studio.rack.some(r => r.id === id)) {
            if (!opts.duplicate) {
              if (opts.focus) set({ currentDevice: id });
              return id;
            }
            let n = 2;
            while (s.studio.rack.some(r => r.id === `${device}#${n}`)) n++;
            id = `${device}#${n}`;
          }
          const slot: RackSlot = { id, device, label: opts.label };
          set(state => ({
            studio: { ...state.studio, rack: [...state.studio.rack, slot] },
            ...(opts.focus ? { currentDevice: id } : {}),
          }));
          return id;
        },

        replaceInRack: (instance, device) => {
          const s = get();
          const existing = s.studio.rack.find(r => r.device === device);
          if (existing) {
            set({ currentDevice: existing.id });
            return existing.id;
          }
          const id = s.studio.rack.some(r => r.id === device) ? `${device}#2` : device;
          const rack = s.studio.rack.some(r => r.id === instance)
            ? s.studio.rack.map(r => (r.id === instance ? { id, device } : r))
            : [...s.studio.rack, { id, device }];
          const routes = { ...s.studio.routes };
          delete routes[instance];
          set({
            studio: {
              ...s.studio,
              rack,
              routes,
              cables: s.studio.cables.filter(c => c.from.instance !== instance && c.to.instance !== instance),
              mixer: withoutChannel(s.studio.mixer, instance),
            },
            currentDevice: id,
          });
          if (s.currentLesson && s.lessonInstance === instance) get().resetLesson();
          return id;
        },

        removeFromRack: instance => {
          const s = get();
          if (s.studio.rack.length <= 1) return; // keep at least one instrument
          const rack = s.studio.rack.filter(r => r.id !== instance);
          const routes = { ...s.studio.routes };
          delete routes[instance];
          Object.keys(routes).forEach(k => { if (routes[k].startsWith(`${instance}:`)) routes[k] = 'master'; });
          set({
            studio: {
              ...s.studio,
              rack,
              routes,
              cables: s.studio.cables.filter(c => c.from.instance !== instance && c.to.instance !== instance),
              mixer: withoutChannel(s.studio.mixer, instance),
            },
            currentDevice: s.currentDevice === instance ? rack[0].id : s.currentDevice,
          });
        },

        moveInRack: (instance, delta) => {
          const rack = [...get().studio.rack];
          const i = rack.findIndex(r => r.id === instance);
          const j = i + delta;
          if (i < 0 || j < 0 || j >= rack.length) return;
          [rack[i], rack[j]] = [rack[j], rack[i]];
          updateStudio(st => ({ ...st, rack }));
        },

        renameInstance: (instance, label) =>
          updateStudio(st => ({ ...st, rack: st.rack.map(r => (r.id === instance ? { ...r, label } : r)) })),

        // ---- per-instance state ---------------------------------------------------
        setControlValue: (instance, control, value) =>
          updateInstance(instance, d => (d.controlValues[control] === value ? d : { ...d, controlValues: { ...d.controlValues, [control]: value } })),

        setControlValues: (instance, values) =>
          updateInstance(instance, d => ({ ...d, controlValues: { ...d.controlValues, ...values } })),

        getControlValue: (instance, control) => get().devices[instance]?.controlValues[control],

        resetControlsToSpec: (instance, defaults) =>
          updateInstance(instance, d => ({ ...d, controlValues: { ...d.controlValues, ...defaults } })),

        loadPreset: (instance, values, patches) =>
          updateInstance(instance, d => ({
            ...d,
            controlValues: { ...d.controlValues, ...values },
            patchConnections: patches
              ? patches.map((p, i) => {
                  const [from, to] = orient(instance, p.from, p.to);
                  return { from, to, color: p.color ?? PRESET_COLORS[i % PRESET_COLORS.length] };
                })
              : d.patchConnections,
          })),

        setDeviceData: (instance, data) => updateInstance(instance, d => ({ ...d, data })),

        updateDeviceData: (instance, fn) => updateInstance(instance, d => ({ ...d, data: fn(d.data) })),

        addPatchConnection: (instance, a, b, color) => {
          if (a === b) return;
          const [from, to] = orient(instance, a, b);
          updateInstance(instance, d => {
            if (d.patchConnections.some(c => sameCable(c, from, to))) return d;
            return {
              ...d,
              patchConnections: [
                ...d.patchConnections,
                { from, to, color: color ?? PRESET_COLORS[d.patchConnections.length % PRESET_COLORS.length] },
              ],
            };
          });
        },

        removePatchConnection: (instance, from, to) =>
          updateInstance(instance, d => ({ ...d, patchConnections: d.patchConnections.filter(c => !sameCable(c, from, to)) })),

        clearPatchConnections: instance => updateInstance(instance, d => ({ ...d, patchConnections: [] })),

        // ---- studio ---------------------------------------------------------------
        addStudioCable: cable => {
          if (cable.from.instance === cable.to.instance) {
            get().addPatchConnection(cable.from.instance, cable.from.jack, cable.to.jack, cable.color);
            return;
          }
          // Orient output -> input
          const isOut = (inst: string, jack: string) => !!specs[deviceOf(inst)]?.patchBay?.outputs.some(j => j.id === jack);
          let c = cable;
          if (!isOut(c.from.instance, c.from.jack) && isOut(c.to.instance, c.to.jack)) c = { ...c, from: c.to, to: c.from };
          updateStudio(st => {
            if (st.cables.some(x => sameStudioCable(x, c))) return st;
            return { ...st, cables: [...st.cables, { ...c, color: c.color ?? PRESET_COLORS[(st.cables.length + 3) % PRESET_COLORS.length] }] };
          });
        },

        removeStudioCable: cable => updateStudio(st => ({ ...st, cables: st.cables.filter(x => !sameStudioCable(x, cable)) })),

        clearStudioCables: instance =>
          updateStudio(st => ({
            ...st,
            cables: instance ? st.cables.filter(c => c.from.instance !== instance && c.to.instance !== instance) : [],
          })),

        setRoute: (instance, route) => updateStudio(st => ({ ...st, routes: { ...st.routes, [instance]: route } })),

        setSync: (instance, on) => updateStudio(st => ({ ...st, sync: { ...st.sync, [instance]: on } })),

        setPowered: (instance, on) => updateStudio(st => ({ ...st, off: { ...(st.off ?? {}), [instance]: !on } })),

        setBpm: bpm => {
          const b = Math.max(20, Math.min(300, Math.round(bpm * 10) / 10));
          transport.setBpm(b);
          updateStudio(st => ({ ...st, bpm: b }));
        },

        setSwing: swing => {
          transport.setSwing(swing);
          updateStudio(st => ({ ...st, swing }));
        },

        setArrangement: fn => updateStudio(st => ({ ...st, arrangement: fn(st.arrangement) })),

        setChannel: (instance, patch) =>
          updateStudio(st => {
            const m = st.mixer ?? {};
            const prev = m.channels?.[instance] ?? {};
            return { ...st, mixer: { ...m, channels: { ...(m.channels ?? {}), [instance]: { ...prev, ...patch } } } };
          }),

        setReturn: (bus, patch) =>
          updateStudio(st => {
            const m = st.mixer ?? {};
            return { ...st, mixer: { ...m, [bus]: { ...(m[bus] ?? {}), ...patch } } };
          }),

        setMasterSection: patch =>
          updateStudio(st => {
            const m = st.mixer ?? {};
            const master = m.master ?? {};
            return {
              ...st,
              mixer: {
                ...m,
                master: {
                  ...master,
                  ...(patch.gain !== undefined ? { gain: patch.gain } : {}),
                  ...(patch.eq ? { eq: { ...(master.eq ?? {}), ...patch.eq } } : {}),
                  ...(patch.glue ? { glue: { ...(master.glue ?? {}), ...patch.glue } } : {}),
                },
              },
            };
          }),

        setMixer: fn => updateStudio(st => ({ ...st, mixer: fn(st.mixer ?? {}) })),

        setMetronome: patch => set(state => ({ studio: { ...state.studio, metronome: { ...(state.studio.metronome ?? {}), ...patch } } })),

        loadProject: p => {
          get().resetLesson();
          const studio = { ...defaultStudio(), ...p.studio };
          if (!studio.rack.length) studio.rack = defaultStudio().rack;
          transport.setBpm(studio.bpm);
          transport.setSwing(studio.swing);
          set({ devices: p.devices ?? {}, studio, currentDevice: p.currentDevice ?? studio.rack[0].id });
        },

        newProject: () => {
          get().resetLesson();
          const focus = deviceOf(get().currentDevice);
          set({ devices: {}, studio: defaultStudio(focus), currentDevice: focus });
          transport.setBpm(120);
          transport.setSwing(0);
        },

        // ---- lessons --------------------------------------------------------------
        startLesson: (lesson, instanceArg) => {
          clearAdvance();
          const s = get();
          let instance = instanceArg;
          if (!instance) {
            if (lesson.device === 'studio') instance = s.currentDevice;
            else if (deviceOf(s.currentDevice) === lesson.device) instance = s.currentDevice;
            else instance = s.studio.rack.find(r => r.device === lesson.device)?.id ?? get().addToRack(lesson.device);
          }
          // Studio lessons need their instruments in the rack
          lesson.requires?.forEach(dev => {
            if (!get().studio.rack.some(r => r.device === dev)) get().addToRack(dev);
          });
          const snapshot = s.devices[instance] ? { instance, state: s.devices[instance] } : { instance, state: initInstance() };
          // Apply the lesson's starting point
          if (lesson.start && lesson.device !== 'studio') {
            const device = deviceOf(instance);
            const base = lesson.start.reset ? specDefaults(device) : {};
            set(state => {
              const d = state.devices[instance] ?? initInstance();
              return {
                devices: {
                  ...state.devices,
                  [instance!]: {
                    ...d,
                    controlValues: { ...(lesson.start!.reset ? {} : d.controlValues), ...base, ...(lesson.start!.values ?? {}) },
                    patchConnections: lesson.start!.patches ?? (lesson.start!.reset ? [] : d.patchConnections),
                    data: lesson.start!.data !== undefined ? structuredClone(lesson.start!.data) : d.data,
                  },
                },
              };
            });
          }
          set({
            currentLesson: lesson,
            lessonInstance: instance,
            currentStep: 0,
            isTeachingMode: true,
            lessonFinished: false,
            stepSatisfied: false,
            session: {},
            lessonSnapshot: snapshot,
            currentDevice: lesson.device === 'studio' ? s.currentDevice : instance,
          });
          enterStep(0);
        },

        goToStep: index => enterStep(index),

        nextStep: () => {
          const s = get();
          if (!s.currentLesson) return;
          if (s.currentStep >= s.currentLesson.steps.length - 1) {
            clearAdvance();
            set({ lessonFinished: true });
          } else {
            enterStep(s.currentStep + 1);
          }
        },

        prevStep: () => enterStep(get().currentStep - 1),

        resetLesson: () => {
          clearAdvance();
          set({ currentLesson: undefined, currentStep: 0, isTeachingMode: false, lessonFinished: false, stepSatisfied: false, session: {} });
        },

        completeLesson: () => {
          const s = get();
          clearAdvance();
          if (!s.currentLesson) return;
          const lesson = s.currentLesson;
          const review = { ...s.review };
          const now = Date.now();
          // Seed the spaced-review queue: due tomorrow
          (lesson.review ?? []).forEach((_, i) => {
            const id = `${lesson.id}:r${i}`;
            if (!review[id]) review[id] = { box: 1, due: now + BOX_INTERVALS[1], last: now, right: 0, wrong: 0, lesson: lesson.id };
          });
          lesson.steps.forEach((st, i) => {
            if (stepKind(st) === 'quiz' && st.quiz) {
              const id = `${lesson.id}:q${i}`;
              if (!review[id]) review[id] = { box: 1, due: now + BOX_INTERVALS[1], last: now, right: 0, wrong: 0, lesson: lesson.id };
            }
          });
          set({
            completedLessons: s.completedLessons.includes(lesson.id) ? s.completedLessons : [...s.completedLessons, lesson.id],
            review,
            currentLesson: undefined,
            currentStep: 0,
            isTeachingMode: false,
            lessonFinished: false,
            stepSatisfied: false,
            session: {},
          });
        },

        restoreLessonSnapshot: () => {
          const snap = get().lessonSnapshot;
          if (!snap) return;
          set(state => ({ devices: { ...state.devices, [snap.instance]: snap.state }, lessonSnapshot: undefined }));
        },

        isStepComplete: () => get().stepSatisfied,

        answerStep: answer => {
          const s = get();
          const lesson = s.currentLesson;
          if (!lesson) return;
          const step = lesson.steps[s.currentStep];
          const prev = s.session[s.currentStep]?.answer;
          if (prev !== undefined) return; // first answer counts (retrieval honesty)
          setSession({ answer });
          const mc = step.quiz ?? step.predict ?? step.listen?.question;
          if (mc && stepKind(step) === 'quiz') get().recordReview(`${lesson.id}:q${s.currentStep}`, answer === mc.answer, lesson.id);
          evaluate();
        },

        checkMatch: () => {
          const s = get();
          const lesson = s.currentLesson;
          if (!lesson) return;
          const step = lesson.steps[s.currentStep];
          if (!step.match) return;
          const instance = s.lessonInstance ?? lesson.device;
          const device = deviceOf(instance);
          const values = valuesOf(instance);
          const tol = step.match.tolerance ?? 0.08;
          const off: NonNullable<StepSession['match']>['off'] = [];
          step.match.controls.forEach(id => {
            const spec = specs[device]?.controls[id];
            const target = step.match!.target[id];
            const v = values[id];
            let ok: boolean;
            if (spec && (spec.type === 'knob' || spec.type === 'slider') && typeof v === 'number' && typeof target === 'number') {
              ok = Math.abs(valueToNorm(spec, v) - valueToNorm(spec, target)) <= tol;
              if (!ok) off.push({ id, dir: v < target ? 'higher' : 'lower' });
            } else {
              ok = isValueOnTarget(spec, v, target);
              if (!ok) off.push({ id, dir: 'different' });
            }
          });
          const score = (step.match.controls.length - off.length) / Math.max(1, step.match.controls.length);
          const attempts = (s.session[s.currentStep]?.attempts ?? 0) + 1;
          setSession({ attempts, match: { score, off } });
          if (attempts === 1) get().recordReview(`${lesson.id}:m${s.currentStep}`, score >= 1, lesson.id);
          evaluate();
        },

        rateReflection: rating => {
          setSession({ rating, revealed: true });
          evaluate();
        },

        revealStep: () => setSession({ revealed: true }),

        showHint: () => {
          const s = get();
          setSession({ hints: (s.session[s.currentStep]?.hints ?? 0) + 1 });
        },

        setFocusMode: on => set({ focusMode: on }),

        reevaluate: () => evaluate(),

        // ---- spaced review --------------------------------------------------------
        recordReview: (itemId, correct, lesson) => {
          const now = Date.now();
          set(state => {
            const prev = state.review[itemId] ?? { box: 0, due: now, last: now, right: 0, wrong: 0, lesson };
            const box = correct ? Math.min(5, prev.box + 1) : 1;
            return {
              review: {
                ...state.review,
                [itemId]: {
                  ...prev,
                  box,
                  due: now + BOX_INTERVALS[box],
                  last: now,
                  right: prev.right + (correct ? 1 : 0),
                  wrong: prev.wrong + (correct ? 0 : 1),
                  lesson,
                },
              },
            };
          });
        },
      };
    },
    {
      name: 'synth-studio-storage',
      version: STORE_VERSION,
      // Written at most every 600 ms (and on hide / close), not on every knob move
      storage: studioStorage,
      partialize: s => ({
        currentDevice: s.currentDevice,
        devices: s.devices,
        studio: s.studio,
        completedLessons: s.completedLessons,
        review: s.review,
        focusMode: s.focusMode,
      }),
      migrate: (persisted, version) => {
        const old = (persisted ?? {}) as Record<string, unknown> & {
          deviceSettings?: Record<string, Record<string, ControlValue>>;
          devices?: Record<string, InstanceState>;
          studio?: StudioDoc;
        };
        let devices = old.devices ?? {};
        if ((version === 0 || version === 1) && old.deviceSettings) {
          devices = {};
          Object.entries(old.deviceSettings).forEach(([device, settings]) => {
            devices[device.toLowerCase()] = { controlValues: settings, patchConnections: [] };
          });
        }
        const currentDevice = (old.currentDevice as string) ?? 'dfam';
        const studio = old.studio ?? defaultStudio(currentDevice);
        // Controls whose meaning changed since this was saved keep sounding the same
        devices = upgradeDevices(devices, studio.rack ?? [], 'store', version);
        return {
          currentDevice,
          devices,
          studio,
          completedLessons: (old.completedLessons as string[]) ?? [],
          review: (old.review as Record<string, ReviewItem>) ?? {},
          focusMode: (old.focusMode as boolean) ?? true,
        } as unknown as StudioStore;
      },
    },
  ),
);

/** Lesson check state for an instance (used by live checklists in the coach) */
export function buildCheckState(instance: string, engine: Record<string, unknown> = {}): LessonCheckState {
  const s = useStudioStore.getState();
  const valuesOf = (id: string) => ({ ...specDefaults(s.deviceOf(id)), ...(s.devices[id]?.controlValues ?? {}) });
  const instances: LessonCheckState['instances'] = {};
  s.studio.rack.forEach(r => {
    instances[r.id] = { device: r.device, values: valuesOf(r.id), patches: s.devices[r.id]?.patchConnections ?? [], data: s.devices[r.id]?.data };
  });
  return {
    values: valuesOf(instance),
    patches: s.devices[instance]?.patchConnections ?? [],
    data: s.devices[instance]?.data,
    engine,
    instances,
    studioCables: s.studio.cables,
    routes: s.studio.routes,
    sync: s.studio.sync,
    transport: { playing: transport.playing, bpm: s.studio.bpm },
    arrangement: s.studio.arrangement,
  };
}

/** Review items due now, oldest first */
export function dueReviewItems(review: Record<string, ReviewItem>, now = Date.now()) {
  return Object.entries(review)
    .filter(([, r]) => r.due <= now)
    .sort((a, b) => a[1].due - b[1].due);
}
