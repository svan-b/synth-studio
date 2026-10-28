import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// MIDI settings (persisted in this browser - MIDI ports belong to the machine,
// not to a project): input routing, clock-out targets, learned CC mappings.
// The MIDI learn session itself is ephemeral (useMidiLearn below).
// ============================================================================

/** A port as remembered across sessions: ids are tried first, then names */
export interface PortRef {
  id: string;
  name: string;
}

export interface MidiMapping {
  id: string;
  /** Input port name; undefined = any port */
  port?: string;
  /** 0-15 */
  channel: number;
  cc: number;
  instance: string;
  control: string;
  /** Toggle buttons: flip on each press (CC rising past 64) instead of following the value */
  toggle?: boolean;
  createdAt: number;
}

export interface ClockOutSettings {
  targets: PortRef[];
  /** Delay MIDI by the audio output latency so hardware lines up with what you hear */
  compensate: boolean;
  /** Extra offset in ms: + sends later, - sends earlier */
  offsetMs: number;
  /** Starting mid-song: send Song Position + Continue instead of Start */
  spp: boolean;
}

export interface ClockInSettings {
  enabled: boolean;
  /** Input port name to follow */
  port: string | null;
}

export interface MidiSettingsState {
  /** MIDI was enabled before: reconnect on load if the browser still grants it (never prompts) */
  autoConnect: boolean;
  /** Input port names that are ignored (and closed, so other apps can use them on Windows) */
  disabledInputs: string[];
  /** 'omni' or a channel 0-15 */
  inputChannel: 'omni' | number;
  /** Input port name -> 'focused' (default) or an instance id */
  inputTargets: Record<string, string>;
  clockOut: ClockOutSettings;
  clockIn: ClockInSettings;
  mappings: MidiMapping[];
}

interface MidiStore extends MidiSettingsState {
  setAutoConnect: (on: boolean) => void;
  setInputEnabled: (portName: string, on: boolean) => void;
  setInputChannel: (ch: 'omni' | number) => void;
  setInputTarget: (portName: string, target: string) => void;
  setClockTarget: (port: PortRef, on: boolean) => void;
  setClockOut: (patch: Partial<ClockOutSettings>) => void;
  setClockIn: (patch: Partial<ClockInSettings>) => void;
  /** Adds a mapping, replacing any mapping with the same source (port/channel/CC) or the same target control */
  addMapping: (m: Omit<MidiMapping, 'id' | 'createdAt'>) => MidiMapping;
  removeMapping: (id: string) => void;
  clearMappings: (instance?: string) => void;
}

export const DEFAULT_MIDI_SETTINGS: MidiSettingsState = {
  autoConnect: false,
  disabledInputs: [],
  inputChannel: 'omni',
  inputTargets: {},
  clockOut: { targets: [], compensate: true, offsetMs: 0, spp: true },
  clockIn: { enabled: false, port: null },
  mappings: [],
};

export const samePort = (a: PortRef, b: PortRef) => a.id === b.id || (!!a.name && a.name === b.name);

let seq = 0;
const newId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export const useMidiStore = create<MidiStore>()(
  persist(
    set => ({
      ...DEFAULT_MIDI_SETTINGS,

      setAutoConnect: on => set({ autoConnect: on }),

      setInputEnabled: (portName, on) =>
        set(s => ({
          disabledInputs: on ? s.disabledInputs.filter(n => n !== portName) : [...new Set([...s.disabledInputs, portName])],
        })),

      setInputChannel: inputChannel => set({ inputChannel }),

      setInputTarget: (portName, target) =>
        set(s => {
          const inputTargets = { ...s.inputTargets };
          if (target === 'focused') delete inputTargets[portName];
          else inputTargets[portName] = target;
          return { inputTargets };
        }),

      setClockTarget: (port, on) =>
        set(s => {
          const rest = s.clockOut.targets.filter(t => !samePort(t, port));
          return { clockOut: { ...s.clockOut, targets: on ? [...rest, { id: port.id, name: port.name }] : rest } };
        }),

      setClockOut: patch => set(s => ({ clockOut: { ...s.clockOut, ...patch } })),

      setClockIn: patch => set(s => ({ clockIn: { ...s.clockIn, ...patch } })),

      addMapping: m => {
        const mapping: MidiMapping = { ...m, id: newId(), createdAt: Date.now() };
        set(s => ({
          mappings: [
            ...s.mappings.filter(x =>
              !(x.cc === m.cc && x.channel === m.channel && (x.port ?? '') === (m.port ?? '')) &&
              !(x.instance === m.instance && x.control === m.control)),
            mapping,
          ],
        }));
        return mapping;
      },

      removeMapping: id => set(s => ({ mappings: s.mappings.filter(m => m.id !== id) })),

      clearMappings: instance => set(s => ({ mappings: instance ? s.mappings.filter(m => m.instance !== instance) : [] })),
    }),
    {
      name: 'synth-studio-midi',
      version: 1,
      partialize: s => ({
        autoConnect: s.autoConnect,
        disabledInputs: s.disabledInputs,
        inputChannel: s.inputChannel,
        inputTargets: s.inputTargets,
        clockOut: s.clockOut,
        clockIn: s.clockIn,
        mappings: s.mappings,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<MidiSettingsState>;
        return {
          ...current,
          ...p,
          clockOut: { ...DEFAULT_MIDI_SETTINGS.clockOut, ...(p.clockOut ?? {}) },
          clockIn: { ...DEFAULT_MIDI_SETTINGS.clockIn, ...(p.clockIn ?? {}) },
          mappings: Array.isArray(p.mappings) ? p.mappings : [],
          disabledInputs: Array.isArray(p.disabledInputs) ? p.disabledInputs : [],
          inputTargets: p.inputTargets && typeof p.inputTargets === 'object' ? p.inputTargets : {},
        };
      },
    },
  ),
);

// ----------------------------------------------------------------------------
// MIDI learn session (not persisted)
// ----------------------------------------------------------------------------

export interface LearnTarget {
  instance: string;
  control: string;
}

interface MidiLearnState {
  armed: boolean;
  /** The on-screen control touched last while armed */
  target: LearnTarget | null;
  /** Feedback for the banner: the mapping just made */
  last: MidiMapping | null;
  arm: (on: boolean) => void;
  setTarget: (t: LearnTarget | null) => void;
  setLast: (m: MidiMapping | null) => void;
}

export const useMidiLearn = create<MidiLearnState>(set => ({
  armed: false,
  target: null,
  last: null,
  arm: on => set({ armed: on, target: null, last: null }),
  setTarget: target => set({ target }),
  setLast: last => set({ last }),
}));
