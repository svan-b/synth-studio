// ============================================================================
// Studio sets - ready-wired studios you can load in one click.
//
// Two build paths walk through how a real studio grows, one stage at a time:
//   1 one instrument -> 2 + a clock -> 3 + a mixer -> 4 + a second instrument -> 5 the full set
// Each stage is complete: rack, cables, routing, sync, tempo and a starting mix
// (faders, pans, sends). Loading a stage keeps every instrument's own settings
// and patterns, so the track you started in stage 1 carries on into stage 5.
// ============================================================================

import type { RackSlot, StudioCable } from '@/devices/types';
import { useStudioStore } from '@/store/studio';
import { MIN_DB, type ChannelDoc, type MixerDoc } from './mixerDoc';

export interface StudioSet {
  id: string;
  name: string;
  description: string;
  /** What you will learn or make with it */
  goal: string;
  rack: RackSlot[];
  routes?: Record<string, string>;
  sync?: Record<string, boolean>;
  cables?: StudioCable[];
  bpm?: number;
  focus?: string;
  /** Starting mix: channel settings per instance (others start at 0 dB, centre, no sends) */
  channels?: Record<string, Partial<ChannelDoc>>;
  /** Build path and stage (1-5) */
  path?: 'elektron' | 'moog';
  stage?: number;
  /** One line: what this stage adds and why */
  adds?: string;
}

const slot = (device: string): RackSlot => ({ id: device, device });
const CLOCK_TO_DFAM: StudioCable = { from: { instance: 'studio-clock', jack: 'out_clock' }, to: { instance: 'dfam', jack: 'in_adv_clock' }, color: '#38bdf8' };

const ch = (gain: number, pan = 0, sendA = MIN_DB, sendB = MIN_DB): Partial<ChannelDoc> => ({ gain, pan, sendA, sendB });

// ---- Elektron track: drums, clock, mixer, bass & chords, full set -----------------

const ELEKTRON: StudioSet[] = [
  {
    id: 'elektron-1-drums',
    path: 'elektron', stage: 1,
    name: 'Drums',
    adds: 'One drum machine. Program a beat first: every track starts with the groove.',
    description: 'The Analog Rytm on its own, straight to the master.',
    goal: 'Make a 1-bar beat you like: kick, snare or clap, hats.',
    rack: [slot('analog-rytm')],
    channels: { 'analog-rytm': ch(0, 0, MIN_DB, -24) },
    bpm: 124,
    focus: 'analog-rytm',
  },
  {
    id: 'elektron-2-clock',
    path: 'elektron', stage: 2,
    name: '+ Clock',
    adds: 'A master clock. The Rytm now follows the studio tempo like MIDI clock, so anything added later locks to it.',
    description: 'Studio Clock as the master; the Rytm synced to it.',
    goal: 'Change the tempo in the top bar and hear the Rytm follow. Try Swing.',
    rack: [slot('studio-clock'), slot('analog-rytm')],
    sync: { 'analog-rytm': true },
    channels: { 'analog-rytm': ch(0, 0, MIN_DB, -24) },
    bpm: 124,
    focus: 'analog-rytm',
  },
  {
    id: 'elektron-3-mixer',
    path: 'elektron', stage: 3,
    name: '+ Mixer',
    adds: 'A DJ mixer. The drums run into Xone:96 channel 1: gain, 3-band EQ and a fader to shape them.',
    description: 'Rytm routed into the Xone:96, clocked from the studio.',
    goal: 'Set the channel GAIN so the meter peaks in the yellow, then cut the LOW EQ and bring it back.',
    rack: [slot('studio-clock'), slot('analog-rytm'), slot('xone96')],
    routes: { 'analog-rytm': 'xone96:studio_1' },
    sync: { 'analog-rytm': true, xone96: true },
    channels: { 'analog-rytm': ch(0, 0, MIN_DB, -24) },
    bpm: 124,
    focus: 'xone96',
  },
  {
    id: 'elektron-live',
    path: 'elektron', stage: 4,
    name: '+ Bass & chords',
    adds: 'A second instrument. The Analog Four plays bass and chords on Xone channel 2, with delay and reverb sends.',
    description: 'Analog Rytm on drums, Analog Four on bass and chords, both into the Xone:96.',
    goal: 'Build and perform a full track: patterns, parameter locks, song mode and DJ-style mixing.',
    rack: [slot('studio-clock'), slot('analog-rytm'), slot('analog-four'), slot('xone96')],
    routes: { 'analog-rytm': 'xone96:studio_1', 'analog-four': 'xone96:studio_2' },
    sync: { 'analog-rytm': true, 'analog-four': true, xone96: true },
    channels: {
      'analog-rytm': ch(0, 0, MIN_DB, -24),
      'analog-four': ch(-3, 0, -20, -14),
    },
    bpm: 124,
    focus: 'analog-four',
  },
  {
    id: 'elektron-5-full',
    path: 'elektron', stage: 5,
    name: 'Full set',
    adds: 'The whole rig: a Sub 37 bassline and DFAM percussion join, the DFAM clocked by cable from the Studio Clock.',
    description: 'Rytm, Analog Four, Sub 37 and DFAM into the Xone:96, one clock for all.',
    goal: 'Arrange it: intro, build, drop, break. Bounce the song when it works.',
    rack: [slot('studio-clock'), slot('analog-rytm'), slot('analog-four'), slot('sub37'), slot('dfam'), slot('xone96')],
    routes: { 'analog-rytm': 'xone96:studio_1', 'analog-four': 'xone96:studio_2', sub37: 'xone96:studio_3', dfam: 'xone96:studio_4' },
    sync: { 'analog-rytm': true, 'analog-four': true, sub37: true, xone96: true },
    cables: [CLOCK_TO_DFAM],
    channels: {
      'analog-rytm': ch(0, 0, MIN_DB, -24),
      'analog-four': ch(-4, 0, -20, -14),
      sub37: ch(-3, 0),
      dfam: ch(-6, -0.3, MIN_DB, -18),
    },
    bpm: 124,
    focus: 'analog-rytm',
  },
];

// ---- Moog studio: patchable clock, cables, semi-modulars ----------------------------

const MOOG: StudioSet[] = [
  {
    id: 'moog-1-dfam',
    path: 'moog', stage: 1,
    name: 'Percussion',
    adds: 'One semi-modular drum voice running its own 8-step sequencer.',
    description: 'The DFAM on its own, on its internal clock.',
    goal: 'Tune the 8 steps into a rhythm with PITCH and VELOCITY.',
    rack: [slot('dfam')],
    channels: { dfam: ch(0, 0, MIN_DB, -22) },
    bpm: 110,
    focus: 'dfam',
  },
  {
    id: 'moog-2-clock',
    path: 'moog', stage: 2,
    name: '+ Clock',
    adds: 'A clock by cable. No MIDI here: the Studio Clock sends one pulse per step into ADV/CLOCK.',
    description: 'Studio Clock CLOCK OUT patched into DFAM ADV/CLOCK.',
    goal: 'Change CLOCK DIV on the Studio Clock and hear the DFAM speed up or slow down.',
    rack: [slot('studio-clock'), slot('dfam')],
    cables: [CLOCK_TO_DFAM],
    channels: { dfam: ch(0, 0, MIN_DB, -22) },
    bpm: 110,
    focus: 'studio-clock',
  },
  {
    id: 'moog-3-mixer',
    path: 'moog', stage: 3,
    name: '+ Mixer',
    adds: 'A mixer channel for the DFAM: EQ and a fader, ready for more instruments.',
    description: 'DFAM into Xone:96 channel 1, clocked by cable.',
    goal: 'Use the channel EQ to make the kick deeper without making it louder.',
    rack: [slot('studio-clock'), slot('dfam'), slot('xone96')],
    routes: { dfam: 'xone96:studio_1' },
    sync: { xone96: true },
    cables: [CLOCK_TO_DFAM],
    channels: { dfam: ch(0, 0, MIN_DB, -22) },
    bpm: 110,
    focus: 'xone96',
  },
  {
    id: 'moog-4-mother32',
    path: 'moog', stage: 4,
    name: '+ Bassline',
    adds: 'A second instrument: the Mother-32 sequencer synced to the studio, on Xone channel 2 with a delay send.',
    description: 'DFAM and Mother-32 into the Xone:96, one clock.',
    goal: 'Write a 16-step bassline that leaves room for the DFAM kick.',
    rack: [slot('studio-clock'), slot('dfam'), slot('mother32'), slot('xone96')],
    routes: { dfam: 'xone96:studio_1', mother32: 'xone96:studio_2' },
    sync: { mother32: true, xone96: true },
    cables: [CLOCK_TO_DFAM],
    channels: { dfam: ch(0, 0, MIN_DB, -22), mother32: ch(-3, 0.15, -18, MIN_DB) },
    bpm: 110,
    focus: 'mother32',
  },
  {
    id: 'moog-sound-studio',
    path: 'moog', stage: 5,
    name: 'Moog Sound Studio',
    adds: 'The 3-tier rack: the Subharmonicon adds polyrhythmic drones, all three clocked together.',
    description: 'DFAM, Mother-32 and Subharmonicon stacked like the 3-tier rack, clocked from one source.',
    goal: 'Patch three semi-modulars into one groove - percussion, bass and polyrhythmic drones in sync.',
    rack: [slot('studio-clock'), slot('dfam'), slot('mother32'), slot('subharmonicon'), slot('xone96')],
    routes: { dfam: 'xone96:studio_1', mother32: 'xone96:studio_2', subharmonicon: 'xone96:studio_3' },
    sync: { mother32: true, subharmonicon: true, xone96: true },
    cables: [CLOCK_TO_DFAM],
    channels: {
      dfam: ch(0, 0, MIN_DB, -22),
      mother32: ch(-3, 0.15, -18, MIN_DB),
      subharmonicon: ch(-6, -0.25, MIN_DB, -12),
    },
    bpm: 110,
    focus: 'dfam',
  },
];

// ---- More sets -------------------------------------------------------------------

const MORE: StudioSet[] = [
  {
    id: 'bass-and-drums',
    name: 'Bass & drums',
    description: 'Rytm drums with a Sub 37 bassline on the arpeggiator, mixed on the Xone:96.',
    goal: 'Lock a bassline to a beat: kick vs bass, EQ and sidechain-style ducking by hand.',
    rack: [slot('analog-rytm'), slot('sub37'), slot('xone96')],
    routes: { 'analog-rytm': 'xone96:studio_1', sub37: 'xone96:studio_2' },
    sync: { 'analog-rytm': true, sub37: true, xone96: true },
    channels: { 'analog-rytm': ch(0), sub37: ch(-3) },
    bpm: 122,
    focus: 'sub37',
  },
  {
    id: 'everything',
    name: 'The whole studio',
    description: 'Every instrument in one rack, with drums and synths routed into the mixer.',
    goal: 'Your playground. Heavy on CPU - close instruments you are not using on older iPads.',
    rack: ['studio-clock', 'analog-rytm', 'analog-four', 'sub37', 'dfam', 'mother32', 'subharmonicon', 'xone96'].map(slot),
    routes: {
      'analog-rytm': 'xone96:studio_1',
      'analog-four': 'xone96:studio_2',
      sub37: 'xone96:studio_3',
      dfam: 'xone96:studio_4',
      mother32: 'xone96:studio_a',
      subharmonicon: 'xone96:studio_b',
    },
    sync: { 'analog-rytm': true, 'analog-four': true, sub37: true, mother32: true, subharmonicon: true, xone96: true },
    cables: [CLOCK_TO_DFAM],
    channels: {
      'analog-rytm': ch(0, 0, MIN_DB, -24),
      'analog-four': ch(-4, 0, -20, -14),
      sub37: ch(-3),
      dfam: ch(-6, -0.3, MIN_DB, -18),
      mother32: ch(-5, 0.3, -18, MIN_DB),
      subharmonicon: ch(-8, -0.25, MIN_DB, -12),
    },
    bpm: 120,
    focus: 'analog-rytm',
  },
];

export const BUILD_PATHS: { id: 'elektron' | 'moog'; name: string; blurb: string; stages: StudioSet[] }[] = [
  { id: 'elektron', name: 'Elektron track', blurb: 'Drum machine first, then sync, a mixer, synths - the way most electronic tracks are built.', stages: ELEKTRON },
  { id: 'moog', name: 'Moog studio', blurb: 'Semi-modulars clocked by patch cables, no MIDI: see every connection.', stages: MOOG },
];

export const STUDIO_SETS: StudioSet[] = [...ELEKTRON, ...MOOG, ...MORE];
export const MORE_SETS = MORE;

/** The build stage whose rack matches the studio's rack exactly (same devices), if any */
export function currentStage(rack: RackSlot[]): StudioSet | undefined {
  const key = (r: RackSlot[]) => r.map(x => x.device).sort().join(',');
  const k = key(rack);
  return [...ELEKTRON, ...MOOG].find(s => key(s.rack) === k);
}

/**
 * Load a set: replaces the rack, routing, sync, studio cables and the mix of
 * the set's instruments; keeps every instrument's own settings and patterns.
 * Returns are left as they are (your delay and reverb settings carry over).
 */
export function loadStudioSet(set: StudioSet) {
  const store = useStudioStore.getState();
  store.resetLesson();
  useStudioStore.setState(s => {
    const mixer: MixerDoc = { ...(s.studio.mixer ?? {}) };
    const channels: NonNullable<MixerDoc['channels']> = {};
    set.rack.forEach(r => { channels[r.id] = { ...(set.channels?.[r.id] ?? {}) }; });
    mixer.channels = channels;
    return {
      studio: {
        ...s.studio,
        rack: set.rack,
        routes: set.routes ?? {},
        sync: set.sync ?? {},
        cables: set.cables ?? [],
        bpm: set.bpm ?? s.studio.bpm,
        off: {},
        mixer,
      },
      currentDevice: set.focus ?? set.rack[0].id,
    };
  });
  if (set.bpm) store.setBpm(set.bpm);
}
