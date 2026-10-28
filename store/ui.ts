import { create } from 'zustand';

// Ephemeral per-instance UI state (held trigs, open menus, selected step page...).
// Never persisted - it describes what the learner's hands are doing right now.

interface UiStore {
  ui: Record<string, Record<string, unknown>>;
  setUi: (instance: string, patch: Record<string, unknown>) => void;
  clearUi: (instance: string) => void;
}

const EMPTY: Record<string, unknown> = {};

export const useUiStore = create<UiStore>(set => ({
  ui: {},
  setUi: (instance, patch) =>
    set(s => ({ ui: { ...s.ui, [instance]: { ...(s.ui[instance] ?? EMPTY), ...patch } } })),
  clearUi: instance =>
    set(s => {
      const ui = { ...s.ui };
      delete ui[instance];
      return { ui };
    }),
}));

export const selectUi = (instance: string) => (s: UiStore) => s.ui[instance] ?? EMPTY;
