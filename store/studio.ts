import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ControlValue, DeviceSpec, Lesson, PatchConnection } from '@/types';
import { isStepSatisfied } from '@/lib/controls/mapping';

interface DeviceState {
  controlValues: Record<string, ControlValue>;
  patchConnections: PatchConnection[];
}

interface StudioState {
  currentDevice: string;
  devices: Record<string, DeviceState>;
  completedLessons: string[];

  // Teaching session (not persisted)
  currentLesson?: Lesson;
  currentStep: number;
  isTeachingMode: boolean;
  /** True once the final step is satisfied */
  lessonFinished: boolean;
  /** Current step is satisfied and about to auto-advance */
  stepSatisfied: boolean;
}

interface StudioStore extends StudioState {
  setCurrentDevice: (device: string) => void;
  /** Make a device spec known to the store (tolerances, jack directions) */
  registerDevice: (spec: DeviceSpec) => void;

  setControlValue: (device: string, control: string, value: ControlValue) => void;
  setControlValues: (device: string, values: Record<string, ControlValue>) => void;
  getControlValue: (device: string, control: string) => ControlValue | undefined;
  resetControlsToSpec: (device: string, defaults: Record<string, ControlValue>) => void;
  loadPreset: (device: string, values: Record<string, ControlValue>, patches?: PatchConnection[]) => void;

  addPatchConnection: (device: string, from: string, to: string, color?: string) => void;
  removePatchConnection: (device: string, from: string, to: string) => void;
  clearPatchConnections: (device: string) => void;

  startLesson: (lesson: Lesson) => void;
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetLesson: () => void;
  completeLesson: () => void;
  isStepComplete: () => boolean;
}

// Device specs registered at runtime (module scope - not persisted)
const specs: Record<string, DeviceSpec> = {};
let advanceTimer: ReturnType<typeof setTimeout> | null = null;

const ADVANCE_DELAY_MS = 750;

const initDeviceState = (): DeviceState => ({ controlValues: {}, patchConnections: [] });

const sameCable = (c: PatchConnection, a: string, b: string) =>
  (c.from === a && c.to === b) || (c.from === b && c.to === a);

/** Put the output first so engines and the UI see a consistent direction */
function orient(device: string, a: string, b: string): [string, string] {
  const pb = specs[device]?.patchBay;
  if (!pb) return [a, b];
  const isOut = (id: string) => pb.outputs.some(j => j.id === id);
  if (!isOut(a) && isOut(b)) return [b, a];
  return [a, b];
}

function clearAdvance() {
  if (advanceTimer) clearTimeout(advanceTimer);
  advanceTimer = null;
}

export const useStudioStore = create<StudioStore>()(
  persist(
    (set, get) => {
      /** Check the current lesson step against current state and advance when satisfied */
      const evaluate = () => {
        const s = get();
        if (!s.isTeachingMode || !s.currentLesson || s.lessonFinished) return;
        const lesson = s.currentLesson;
        const step = lesson.steps[s.currentStep];
        if (!step) return;
        const dev = s.devices[lesson.device] ?? initDeviceState();
        const spec = step.control ? specs[lesson.device]?.controls[step.control] : undefined;
        const ok = isStepSatisfied(step, spec, dev.controlValues, dev.patchConnections);

        if (!ok) {
          if (s.stepSatisfied) set({ stepSatisfied: false });
          clearAdvance();
          return;
        }
        if (s.stepSatisfied && advanceTimer) return;
        set({ stepSatisfied: true });
        // Informational steps (nothing to set) wait for the learner to press Next
        if (!step.control && !(step.patchFrom && step.patchTo)) return;
        clearAdvance();
        const lessonId = lesson.id;
        const stepIndex = s.currentStep;
        advanceTimer = setTimeout(() => {
          advanceTimer = null;
          const now = get();
          if (!now.isTeachingMode || now.currentLesson?.id !== lessonId || now.currentStep !== stepIndex) return;
          if (stepIndex >= lesson.steps.length - 1) {
            set({ lessonFinished: true, stepSatisfied: true });
          } else {
            set({ currentStep: stepIndex + 1, stepSatisfied: false });
            evaluate();
          }
        }, ADVANCE_DELAY_MS);
      };

      const updateDevice = (device: string, fn: (d: DeviceState) => DeviceState) => {
        set(state => ({
          devices: { ...state.devices, [device]: fn(state.devices[device] ?? initDeviceState()) },
        }));
        evaluate();
      };

      return {
        currentDevice: 'dfam',
        devices: {},
        completedLessons: [],
        currentLesson: undefined,
        currentStep: 0,
        isTeachingMode: false,
        lessonFinished: false,
        stepSatisfied: false,

        setCurrentDevice: device => {
          const s = get();
          if (s.currentLesson && s.currentLesson.device !== device) get().resetLesson();
          set({ currentDevice: device });
        },

        registerDevice: spec => {
          specs[spec.id] = spec;
        },

        setControlValue: (device, control, value) =>
          updateDevice(device, d => (d.controlValues[control] === value ? d : { ...d, controlValues: { ...d.controlValues, [control]: value } })),

        setControlValues: (device, values) =>
          updateDevice(device, d => ({ ...d, controlValues: { ...d.controlValues, ...values } })),

        getControlValue: (device, control) => get().devices[device]?.controlValues[control],

        resetControlsToSpec: (device, defaults) =>
          updateDevice(device, d => ({ ...d, controlValues: { ...d.controlValues, ...defaults } })),

        loadPreset: (device, values, patches) =>
          updateDevice(device, d => ({
            controlValues: { ...d.controlValues, ...values },
            patchConnections: patches
              ? patches.map((p, i) => {
                  const [from, to] = orient(device, p.from, p.to);
                  return { from, to, color: p.color ?? PRESET_COLORS[i % PRESET_COLORS.length] };
                })
              : d.patchConnections,
          })),

        addPatchConnection: (device, a, b, color) => {
          if (a === b) return;
          const [from, to] = orient(device, a, b);
          updateDevice(device, d => {
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

        removePatchConnection: (device, from, to) =>
          updateDevice(device, d => ({ ...d, patchConnections: d.patchConnections.filter(c => !sameCable(c, from, to)) })),

        clearPatchConnections: device => updateDevice(device, d => ({ ...d, patchConnections: [] })),

        startLesson: lesson => {
          clearAdvance();
          set({
            currentLesson: lesson,
            currentStep: 0,
            isTeachingMode: true,
            lessonFinished: false,
            stepSatisfied: false,
            currentDevice: lesson.device,
          });
          evaluate();
        },

        goToStep: index => {
          const s = get();
          if (!s.currentLesson) return;
          clearAdvance();
          const i = Math.max(0, Math.min(s.currentLesson.steps.length - 1, index));
          set({ currentStep: i, stepSatisfied: false, lessonFinished: false });
          evaluate();
        },

        nextStep: () => {
          const s = get();
          if (!s.currentLesson) return;
          if (s.currentStep >= s.currentLesson.steps.length - 1) {
            clearAdvance();
            set({ lessonFinished: true });
          } else {
            get().goToStep(s.currentStep + 1);
          }
        },

        prevStep: () => get().goToStep(get().currentStep - 1),

        resetLesson: () => {
          clearAdvance();
          set({ currentLesson: undefined, currentStep: 0, isTeachingMode: false, lessonFinished: false, stepSatisfied: false });
        },

        completeLesson: () => {
          const s = get();
          clearAdvance();
          if (!s.currentLesson) return;
          const id = s.currentLesson.id;
          set({
            completedLessons: s.completedLessons.includes(id) ? s.completedLessons : [...s.completedLessons, id],
            currentLesson: undefined,
            currentStep: 0,
            isTeachingMode: false,
            lessonFinished: false,
            stepSatisfied: false,
          });
        },

        isStepComplete: () => {
          const s = get();
          const lesson = s.currentLesson;
          if (!lesson) return false;
          const step = lesson.steps[s.currentStep];
          if (!step) return false;
          const dev = s.devices[lesson.device] ?? initDeviceState();
          const spec = step.control ? specs[lesson.device]?.controls[step.control] : undefined;
          return isStepSatisfied(step, spec, dev.controlValues, dev.patchConnections);
        },
      };
    },
    {
      name: 'synth-studio-storage',
      version: 3,
      partialize: s => ({ currentDevice: s.currentDevice, devices: s.devices, completedLessons: s.completedLessons }),
      migrate: (persisted, version) => {
        const old = (persisted ?? {}) as Record<string, unknown> & {
          deviceSettings?: Record<string, Record<string, ControlValue>>;
          devices?: Record<string, DeviceState>;
        };
        let devices = old.devices ?? {};
        if ((version === 0 || version === 1) && old.deviceSettings) {
          devices = {};
          Object.entries(old.deviceSettings).forEach(([device, settings]) => {
            devices[device.toLowerCase()] = { controlValues: settings, patchConnections: [] };
          });
        }
        return {
          currentDevice: (old.currentDevice as string) ?? 'dfam',
          devices,
          completedLessons: (old.completedLessons as string[]) ?? [],
        } as unknown as StudioStore;
      },
    },
  ),
);

const PRESET_COLORS = ['#22c55e', '#f97316', '#ef4444', '#06b6d4', '#a855f7', '#eab308', '#ec4899', '#3b82f6', '#14b8a6', '#f43f5e'];
