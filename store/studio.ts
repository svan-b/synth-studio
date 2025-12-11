import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lesson, PatchConnection } from '@/types';

interface DeviceState {
  controlValues: Record<string, number | string | boolean>;
  patchConnections: PatchConnection[];
}

interface StudioState {
  currentDevice: string;
  devices: Record<string, DeviceState>;
  currentLesson?: Lesson;
  currentStep: number;
  completedLessons: string[];
  isTeachingMode: boolean;
  _pendingStepAdvance: boolean; // Prevents multiple auto-advances
}

interface StudioStore extends StudioState {
  // Device management
  setCurrentDevice: (device: string) => void;

  // Control values
  setControlValue: (device: string, control: string, value: number | string | boolean) => void;
  getControlValue: (device: string, control: string) => number | string | boolean | undefined;
  resetDeviceToDefaults: (device: string) => void;
  resetControlsToSpec: (device: string, defaults: Record<string, number | string | boolean>) => void;

  // Patch connections
  addPatchConnection: (device: string, from: string, to: string, color?: string) => void;
  removePatchConnection: (device: string, from: string, to: string) => void;
  clearPatchConnections: (device: string) => void;

  // Teaching / Lessons
  startLesson: (lesson: Lesson) => void;
  completeStep: () => void;
  resetLesson: () => void;
  toggleTeachingMode: () => void;
  completeLesson: () => void;
  isStepComplete: () => boolean;
}

// Helper to initialize device state
const initDeviceState = (): DeviceState => ({
  controlValues: {},
  patchConnections: [],
});

export const useStudioStore = create<StudioStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentDevice: 'dfam',
      devices: {},
      currentLesson: undefined,
      currentStep: 0,
      completedLessons: [],
      isTeachingMode: false,
      _pendingStepAdvance: false,

      // Device management
      setCurrentDevice: (device) => set({ currentDevice: device }),

      // Control values
      setControlValue: (device, control, value) => {
        set((state) => {
          const deviceState = state.devices[device] || initDeviceState();
          return {
            devices: {
              ...state.devices,
              [device]: {
                ...deviceState,
                controlValues: {
                  ...deviceState.controlValues,
                  [control]: value,
                },
              },
            },
          };
        });

        // Auto-advance lesson step if value matches target
        // Use a flag to prevent multiple rapid advances (debounce)
        const state = get();
        if (state.isTeachingMode && state.currentLesson && !state._pendingStepAdvance) {
          const step = state.currentLesson.steps[state.currentStep];
          if (step && step.control === control) {
            // Check if value matches target (with tolerance for numbers)
            const target = step.targetValue;
            let isMatch = false;

            if (typeof target === 'number' && typeof value === 'number') {
              // 5% tolerance for numeric values
              const tolerance = Math.abs(target) * 0.05 || 0.5;
              isMatch = Math.abs(value - target) <= tolerance;
            } else {
              isMatch = value === target;
            }

            if (isMatch && state.currentStep < state.currentLesson.steps.length - 1) {
              // Set flag to prevent duplicate advances
              set({ _pendingStepAdvance: true });

              // Delay before advancing to give visual feedback
              setTimeout(() => {
                const currentState = get();
                // Only advance if we're still on the same step
                if (currentState._pendingStepAdvance) {
                  set({
                    currentStep: currentState.currentStep + 1,
                    _pendingStepAdvance: false
                  });
                }
              }, 800);
            }
          }
        }
      },

      getControlValue: (device, control) => {
        const state = get();
        return state.devices[device]?.controlValues[control];
      },

      resetDeviceToDefaults: (device) => {
        set((state) => ({
          devices: {
            ...state.devices,
            [device]: initDeviceState(),
          },
        }));
      },

      resetControlsToSpec: (device, defaults) => {
        set((state) => {
          const deviceState = state.devices[device] || initDeviceState();
          return {
            devices: {
              ...state.devices,
              [device]: {
                ...deviceState,
                controlValues: { ...defaults },
              },
            },
          };
        });
      },

      // Patch connections
      addPatchConnection: (device, from, to, color) => {
        set((state) => {
          const deviceState = state.devices[device] || initDeviceState();
          // Check if connection already exists
          const exists = deviceState.patchConnections.some(
            c => c.from === from && c.to === to
          );
          if (exists) return state;

          return {
            devices: {
              ...state.devices,
              [device]: {
                ...deviceState,
                patchConnections: [
                  ...deviceState.patchConnections,
                  { from, to, color },
                ],
              },
            },
          };
        });
      },

      removePatchConnection: (device, from, to) => {
        set((state) => {
          const deviceState = state.devices[device];
          if (!deviceState) return state;

          return {
            devices: {
              ...state.devices,
              [device]: {
                ...deviceState,
                patchConnections: deviceState.patchConnections.filter(
                  c => !(c.from === from && c.to === to)
                ),
              },
            },
          };
        });
      },

      clearPatchConnections: (device) => {
        set((state) => {
          const deviceState = state.devices[device];
          if (!deviceState) return state;

          return {
            devices: {
              ...state.devices,
              [device]: {
                ...deviceState,
                patchConnections: [],
              },
            },
          };
        });
      },

      // Teaching / Lessons
      startLesson: (lesson) => {
        set({
          currentLesson: lesson,
          currentStep: 0,
          isTeachingMode: true,
          _pendingStepAdvance: false,
        });
      },

      completeStep: () => {
        const state = get();
        if (state.currentLesson && state.currentStep < state.currentLesson.steps.length - 1) {
          set({ currentStep: state.currentStep + 1, _pendingStepAdvance: false });
        }
      },

      resetLesson: () => {
        set({
          currentLesson: undefined,
          currentStep: 0,
          isTeachingMode: false,
          _pendingStepAdvance: false,
        });
      },

      toggleTeachingMode: () => {
        set((state) => ({ isTeachingMode: !state.isTeachingMode }));
      },

      completeLesson: () => {
        const state = get();
        if (state.currentLesson) {
          const lessonId = state.currentLesson.id;
          set((state) => ({
            completedLessons: state.completedLessons.includes(lessonId)
              ? state.completedLessons
              : [...state.completedLessons, lessonId],
            currentLesson: undefined,
            currentStep: 0,
            isTeachingMode: false,
          }));
        }
      },

      isStepComplete: () => {
        const state = get();
        if (!state.currentLesson) return false;

        const step = state.currentLesson.steps[state.currentStep];
        if (!step) return false;

        const value = state.devices[state.currentDevice]?.controlValues[step.control];
        if (value === undefined) return false;

        const target = step.targetValue;
        if (typeof target === 'number' && typeof value === 'number') {
          const tolerance = Math.abs(target) * 0.05 || 0.5;
          return Math.abs(value - target) <= tolerance;
        }

        return value === target;
      },
    }),
    {
      name: 'synth-studio-storage',
      version: 2, // Bump version to handle migration from old format
      migrate: (persisted, version) => {
        // Handle migration from v1 (old deviceSettings format)
        if (version === 1 || version === 0) {
          const old = persisted as Record<string, unknown> & { deviceSettings?: Record<string, Record<string, number | string>> };
          if (old && old.deviceSettings) {
            const devices: Record<string, DeviceState> = {};
            Object.entries(old.deviceSettings).forEach(([device, settings]) => {
              devices[device.toLowerCase()] = {
                controlValues: settings as Record<string, number | string | boolean>,
                patchConnections: [],
              };
            });
            return {
              ...old,
              devices,
              deviceSettings: undefined,
            };
          }
        }
        return persisted;
      },
    }
  )
);
