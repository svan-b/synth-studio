import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StudioState, Lesson } from '@/types';

interface StudioStore extends StudioState {
  setCurrentDevice: (device: string) => void;
  setControlValue: (device: string, control: string, value: number | string) => void;
  getControlValue: (device: string, control: string) => number | string | undefined;
  startLesson: (lesson: Lesson) => void;
  completeStep: () => void;
  resetLesson: () => void;
  toggleTeachingMode: () => void;
  completeLesson: () => void;
}

export const useStudioStore = create<StudioStore>()(
  persist(
    (set, get) => ({
      currentDevice: 'DFAM',
      deviceSettings: {},
      currentLesson: undefined,
      currentStep: 0,
      completedLessons: [],
      isTeachingMode: false,

      setCurrentDevice: (device) => set({ currentDevice: device }),

      setControlValue: (device, control, value) => {
        set((state) => ({
          deviceSettings: {
            ...state.deviceSettings,
            [device]: {
              ...state.deviceSettings[device],
              [control]: value,
            },
          },
        }));
      },

      getControlValue: (device, control) => {
        const state = get();
        return state.deviceSettings[device]?.[control];
      },

      startLesson: (lesson) => {
        set({
          currentLesson: lesson,
          currentStep: 0,
          isTeachingMode: true,
        });
      },

      completeStep: () => {
        const state = get();
        if (state.currentLesson && state.currentStep < state.currentLesson.steps.length - 1) {
          set({ currentStep: state.currentStep + 1 });
        }
      },

      resetLesson: () => {
        set({
          currentLesson: undefined,
          currentStep: 0,
          isTeachingMode: false,
        });
      },

      toggleTeachingMode: () => {
        set((state) => ({ isTeachingMode: !state.isTeachingMode }));
      },

      completeLesson: () => {
        const state = get();
        if (state.currentLesson) {
          const lessonId = `${state.currentLesson.device}-${state.currentLesson.name}`;
          set((state) => ({
            completedLessons: [...state.completedLessons, lessonId],
            currentLesson: undefined,
            currentStep: 0,
            isTeachingMode: false,
          }));
        }
      },
    }),
    {
      name: 'synth-studio-storage',
    }
  )
);
