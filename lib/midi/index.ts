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
import { useMidiLearn, useMidiStore, samePort, type PortRef } from '@/store/midi';
import { midi, type MidiSnapshot } from './access';
import { MidiRouter, isMidiReceiver, type FocusSink } from './router';
import { MidiClockOut } from './clock-out';
import { MidiClockIn } from './clock-in';
import { ControlWriter, applyControlValues } from './apply';
import { audioClock } from './time';
import { practiceSynth, type PracticeStatus } from './practice-synth';
import {
  asData as asSynthData, channelClashes, freeChannel, initialData as initialSynthData, type SynthUse,
} from '@/devices/midi-synth/config';

export { midi } from './access';
export type { MidiSnapshot, MidiPortInfo, IncomingMidi } from './access';
export { midiLearnTouch, instanceLabel, controlLabel } from './learn';
export { isMidiReceiver, type MidiReceiver } from './router';
export { practiceSynth, PRACTICE_PORT, isPracticePort } from './practice-synth';

// ----------------------------------------------------------------------------
// Clock targets: the ports ticked in MIDI settings, plus every "Your synth"
// with "Send MIDI clock" on. One port gets one clock, however many synths
// share it (two parts of a multitimbral synth on one cable).
// ----------------------------------------------------------------------------

interface SynthClockRef { instance: string; port: PortRef }

let synthTargetsCache: { rack: unknown; devices: unknown; off: unknown; refs: SynthClockRef[] } | null = null;

/** "Your synth" instances in the rack (powered on) that send clock to their port */
export function synthClockTargets(): SynthClockRef[] {
  const st = useStudioStore.getState();
  const { rack, off } = st.studio;
  if (synthTargetsCache && synthTargetsCache.rack === rack && synthTargetsCache.devices === st.devices && synthTargetsCache.off === off) {
    return synthTargetsCache.refs;
  }
  const refs: SynthClockRef[] = [];
  rack.forEach(r => {
    if (r.device !== 'midi-synth' || off?.[r.id]) return;
    const d = st.devices[r.id]?.data as { clock?: boolean; port?: PortRef | null } | undefined;
    if (d?.clock === true && d.port && typeof d.port.name === 'string') refs.push({ instance: r.id, port: d.port });
  });
  synthTargetsCache = { rack, devices: st.devices, off, refs };
  return refs;
}

/** Every port that gets MIDI clock (deduplicated), minus the port we follow */
export function clockTargets(): PortRef[] {
  const { clockOut, clockIn } = useMidiStore.getState();
  const out: PortRef[] = [];
  [...clockOut.targets, ...synthClockTargets().map(s => s.port)].forEach(p => {
    if (!out.some(q => samePort(q, p))) out.push(p);
  });
  // Never send clock back to the device we follow (MIDI thru would loop it)
  if (!clockIn.enabled || !clockIn.port) return out;
  return out.filter(t => t.name !== clockIn.port);
}

/** Does this port get MIDI clock? */
export const isClockTarget = (port: PortRef | null | undefined) => !!port && clockTargets().some(t => samePort(t, port));

// ----------------------------------------------------------------------------
// A second "Your synth" that nobody has set up yet starts on the next free
// channel, so two new ones never play the same part (on the Practice synth the
// second lands on channel 2, its keys part). Set-up instances are never touched.
// ----------------------------------------------------------------------------

const PRISTINE = JSON.stringify(initialSynthData());
let spreadSeen: unknown[] = [];

function spreadNewSynths() {
  const st = useStudioStore.getState();
  const synths = st.studio.rack.filter(r => r.device === 'midi-synth');
  const refs = synths.map(r => st.devices[r.id]?.data);
  if (synths.length < 2 || (refs.length === spreadSeen.length && refs.every((d, i) => d === spreadSeen[i]))) return;
  spreadSeen = refs;
  const uses: SynthUse[] = synths.map((r, i) => {
    const d = refs[i] === undefined ? null : asSynthData(refs[i]);
    return { instance: r.id, name: d?.name ?? '', port: d?.port ?? null, channel: d?.channel ?? 0 };
  });
  synths.forEach((r, i) => {
    const raw = refs[i];
    if (raw === undefined || JSON.stringify(raw) !== PRISTINE) return;
    const d = asSynthData(raw);
    // Only the later one moves: the first instance keeps channel 1
    const earlier = uses.slice(0, i);
    if (!channelClashes(r.id, d.port, d.channel, earlier).length) return;
    const channel = freeChannel(r.id, d.port, uses);
    uses[i] = { ...uses[i], channel };
    st.setDeviceData(r.id, { ...d, channel });
  });
}

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
  settings: () => ({ ...useMidiStore.getState().clockOut, targets: clockTargets() }),
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
let relessenQueued = false;

/** Re-check the running lesson step (state outside the studio store changed) */
function relessen() {
  if (relessenQueued) return;
  relessenQueued = true;
  setTimeout(() => {
    relessenQueued = false;
    const st = useStudioStore.getState();
    if (st.isTeachingMode) st.reevaluate();
  }, 0);
}

export function initMidi() {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;
  // Test/automation hook (browser checks), like window.__synthStudio
  (window as unknown as { __synthStudioMidi?: unknown }).__synthStudioMidi = { midi, practiceSynth, clockTargets, midiClockOut, useMidiStore, useMidiLearn };
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
    // Lesson steps can check MIDI settings (a learned mapping, a clock target)
    if (s.mappings !== prev.mappings || s.clockOut !== prev.clockOut) relessen();
  });
  midi.subscribe(relessen);
  useStudioStore.subscribe((s, prev) => {
    if (s.studio.rack !== prev.studio.rack || s.devices !== prev.devices) spreadNewSynths();
  });
  spreadNewSynths();
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

let practiceServer: PracticeStatus | null = null;
const getPracticeServer = () => (practiceServer ??= practiceSynth.getStatus());

/** What the Practice synth is doing (programs, arpeggiator, clock, who listens) */
export function usePracticeStatus(): PracticeStatus {
  return useSyncExternalStore(practiceSynth.subscribe, practiceSynth.getStatus, getPracticeServer);
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
