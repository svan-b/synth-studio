// ============================================================================
// Device module contract (v2)
// Each instrument lives in devices/<id>/ and default-exports a DeviceModule.
// The studio can run several instruments at once (each an *instance*), route
// their audio into a mixer, patch cables between them and sync them to the
// studio transport.
// ============================================================================

import type { ControlValue, DeviceSpec, Lesson, PatchConnection } from '@/types';
import type { PanelLayout, Values } from '@/types/panel';
import type { SynthEngine } from '@/lib/audio/engine';

/** What a device's interceptChange / displayValues hooks can see and do */
export interface DeviceUiApi {
  values: Values;
  /** Structured device data (patterns, songs, kits...) - see DeviceModule.data */
  data: unknown;
  /** Ephemeral UI state (held trig, selected page...). Not saved. */
  ui: Record<string, unknown>;
  setValue: (id: string, v: ControlValue) => void;
  updateData: (fn: (draft: unknown) => unknown) => void;
  setUi: (patch: Record<string, unknown>) => void;
}

/** Plays a short demo phrase - used by lessons ("listen to the target") */
export interface AuditionApi {
  noteOn: (note: number, velocity?: number) => void;
  noteOff: (note: number) => void;
  event: (name: string, payload?: unknown) => void;
  /** Run a callback after `ms` (cleared automatically when the audition stops) */
  after: (ms: number, fn: () => void) => void;
}

export interface DeviceModule {
  spec: DeviceSpec;
  layout: PanelLayout;
  lessons: Lesson[];
  createEngine: () => SynthEngine;
  /** Playable instruments: lowest MIDI note for the computer-keyboard mapping (A = lowNote) */
  keyboard?: { lowNote: number };
  /**
   * Controls that hold UI navigation state (selected track, page, mode) rather
   * than sound settings. Reset leaves them alone and presets don't need them.
   */
  uiControls?: string[];
  /** Short "how to play this thing" hints shown under the panel */
  tips?: string[];
  /** Extra AudioWorklet modules (URLs under /worklets/) loaded before the engine starts */
  worklets?: string[];
  /** Toggle control that the Space bar flips (e.g. RUN/STOP, PLAY) */
  transportControl?: string;

  // ---- v2 ------------------------------------------------------------------

  /**
   * Structured data that doesn't fit the knob model: Elektron patterns, songs,
   * kits, MIDI device config... Stored per instance, saved with the project,
   * pushed to the engine with engine.setData(). Keep it JSON-serialisable.
   */
  data?: {
    initial: () => unknown;
    /** Upgrade data saved by an older version of this device */
    migrate?: (saved: unknown) => unknown;
  };

  /**
   * Intercept a control change before it reaches the store. Return true when
   * handled - e.g. Elektron parameter locks: while a trig is held, an encoder
   * turn writes a lock into the step instead of changing the sound.
   */
  interceptChange?: (id: string, value: ControlValue, api: DeviceUiApi) => boolean;

  /** Values to *display* (e.g. the held step's locked values). Defaults to the stored values. */
  displayValues?: (api: DeviceUiApi) => Values;

  /** Short demo phrase for lessons and ear-training. Return a stop function. */
  audition?: (api: AuditionApi) => (() => void) | void;

  /** Studio integration */
  studio?: {
    /** Can follow the studio transport like MIDI clock (Elektrons, Sub 37, Mother-32, Subharmonicon) */
    midiSync?: boolean;
    /** Device is a mixer: names of external channel inputs other devices can be routed into */
    mixerInputs?: { id: string; label: string }[];
    /** Stereo/mono main output (default mono) */
    stereo?: boolean;
    /**
     * Separate outputs, like the hardware's individual outs (the Rytm's voice outputs). Each one
     * the learner turns on in the mixer gets its own channel, '<instance>/<id>', with its own
     * fader, sends and route (into the master or a mixer's input). While an output is connected
     * the engine takes that part out of its main output (SynthEngine.connectOutput).
     */
    outputs?: { id: string; label: string; stereo?: boolean }[];
    /**
     * Pattern-based instruments: list the patterns that have content, for the
     * song arranger. The engine must handle event('arranger:pattern', { id, time })
     * by switching to that pattern at audio time `time` (a bar boundary).
     */
    patterns?: (data: unknown) => { id: string; label?: string }[];
  };
}

export interface DeviceEntry {
  id: string;
  name: string;
  manufacturer: string;
  category: 'Percussion' | 'Synthesizer' | 'Groovebox' | 'DJ Mixer' | 'Studio' | 'External';
  tagline: string;
  /** Makes no sound of its own (the Studio Clock): no mixer strip */
  silent?: boolean;
  load: () => Promise<{ default: DeviceModule }>;
}

/** A device placed in the studio */
export interface RackSlot {
  /** Instance id. The first instance of a device uses the device id itself. */
  id: string;
  device: string;
  label?: string;
}

/** A patch cable between two instruments */
export interface StudioCable {
  from: { instance: string; jack: string };
  to: { instance: string; jack: string };
  color?: string;
}

export type { PatchConnection };
