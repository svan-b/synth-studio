// ============================================================================
// MIDI in the studio - wiring. initMidi() is idempotent and runs on the client
// the first time the MIDI button or a DeviceHost mounts.
//
//   midi          Web MIDI access, ports, hot-plug          (access.ts)
//   midiRouter    notes / bend / mod / learned CCs -> instruments (router.ts)
//   midiClockOut  studio transport -> 24 PPQN clock out     (clock-out.ts)
//   midiClockIn   follow an external clock (optional)       (clock-in.ts)
// ============================================================================

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { hub } from '@/lib/studio/hub';
import { transport } from '@/lib/audio/transport';
import { getAudioContext } from '@/lib/audio/context';
import { useStudioStore, getSpec } from '@/store/studio';
import { useMidiLearn, useMidiStore } from '@/store/midi';
import { midi, type MidiSnapshot } from './access';
import { MidiRouter, isMidiReceiver, type FocusSink } from './router';
import { MidiClockOut } from './clock-out';
import { MidiClockIn } from './clock-in';
import { ControlWriter, applyControlValues } from './apply';
import { audioClock } from './time';

export { midi } from './access';
export type { MidiSnapshot, MidiPortInfo, IncomingMidi } from './access';
export { midiLearnTouch, instanceLabel, controlLabel } from './learn';
export { isMidiReceiver, type MidiReceiver } from './router';

const inRack = (instance: string) => useStudioStore.getState().studio.rack.some(r => r.id === instance);
const specOf = (instance: string, control: string) => getSpec(useStudioStore.getState().deviceOf(instance))?.controls[control];

/** Coalesces MIDI-driven control writes to one store update per instrument per frame */
export const controlWriter = new ControlWriter(applyControlValues);

export const midiRouter = new MidiRouter({
  settings: () => useMidiStore.getState(),
  noteOn: (instance, note, velocity) => {
    if (hub.status !== 'on') hub.ensureAudio();
    hub.noteOn(instance, note, velocity);
  },
  noteOff: (instance, note) => hub.noteOff(instance, note),
  receiver: instance => {
    const engine = hub.getEngine(instance);
    return isMidiReceiver(engine) ? engine : null;
  },
  spec: specOf,
  value: (instance, control) => hub.valuesFor(instance)[control],
  apply: (instance, control, value) => controlWriter.write(instance, control, value),
  inRack,
  fallbackFocus: () => useStudioStore.getState().currentDevice ?? null,
  learn: () => useMidiLearn.getState(),
  addMapping: m => useMidiStore.getState().addMapping(m),
  onLearned: m => {
    const l = useMidiLearn.getState();
    l.setLast(m);
    l.setTarget(null);
  },
});

export const midiClockOut = new MidiClockOut({
  transport,
  ctx: () => (typeof window === 'undefined' ? null : getAudioContext()),
  settings: () => {
    const { clockOut, clockIn } = useMidiStore.getState();
    // Never send clock back to the device we follow (MIDI thru would loop it)
    if (!clockIn.enabled || !clockIn.port) return clockOut;
    return { ...clockOut, targets: clockOut.targets.filter(t => t.name !== clockIn.port) };
  },
  resolve: ref => midi.findOutput(ref),
});

export const midiClockIn = new MidiClockIn({
  transport,
  ctx: () => (typeof window === 'undefined' ? null : getAudioContext()),
  setDisplayBpm: bpm => useStudioStore.getState().setBpm(bpm),
  beforeStart: () => hub.ensureAudio(),
});

/** Last message time per input port id (activity LEDs) */
export const midiActivity = new Map<string, number>();

let initialised = false;

export function initMidi() {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;
  const allowed = () => {
    const disabled = new Set(useMidiStore.getState().disabledInputs);
    return (name: string) => !disabled.has(name);
  };
  midi.setInputFilter(allowed());
  useMidiStore.subscribe((s, prev) => {
    if (s.disabledInputs !== prev.disabledInputs) midi.setInputFilter(allowed());
    if (s.clockIn.enabled !== prev.clockIn.enabled || s.clockIn.port !== prev.clockIn.port) {
      midiClockIn.detach();
      if (s.clockIn.enabled) midiClockIn.attach();
    }
  });
  midi.onGranted(() => {
    useMidiStore.getState().setAutoConnect(true);
    // Keep the audio -> MIDI clock mapping settled, so the first beat after Play is exact
    audioClock.sampleEvery(() => getAudioContext());
  });
  midi.onMessage(m => {
    midiActivity.set(m.port.id, performance.now());
    const msg = midiRouter.handle(m.port.name, m.data, m.timeStamp);
    const ci = useMidiStore.getState().clockIn;
    if (msg && !('channel' in msg) && ci.enabled && ci.port === m.port.name) midiClockIn.handle(msg, m.timeStamp);
  });
  midiClockOut.start();
  if (useMidiStore.getState().clockIn.enabled) midiClockIn.attach();
  if (useMidiStore.getState().autoConnect) void midi.autoConnect();
}

// ----------------------------------------------------------------------------
// React hooks
// ----------------------------------------------------------------------------

let serverSnapshot: MidiSnapshot | null = null;
const getServerSnapshot = () => (serverSnapshot ??= midi.getSnapshot());

/** Live MIDI status and port lists */
export function useMidiSnapshot(): MidiSnapshot {
  return useSyncExternalStore(midi.subscribe, midi.getSnapshot, getServerSnapshot);
}

/**
 * Mounted by the focused DeviceHost: MIDI notes play this instrument through
 * the host's own note handlers (so on-screen keys light up too).
 */
export function useMidiFocus(
  instance: string,
  active: boolean,
  noteOn: (note: number, velocity?: number) => void,
  noteOff: (note: number) => void,
) {
  const handlers = useRef({ noteOn, noteOff });
  handlers.current = { noteOn, noteOff };
  useEffect(() => {
    initMidi();
    if (!active) return;
    const sink: FocusSink = {
      instance,
      noteOn: (n, v) => handlers.current.noteOn(n, v),
      noteOff: n => handlers.current.noteOff(n),
    };
    return midiRouter.pushFocus(sink);
  }, [instance, active]);
}
