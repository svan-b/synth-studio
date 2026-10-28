// ============================================================================
// Studio sets - ready-wired studios you can load in one click.
// Each describes the rack, audio routing, sync and the cables between
// instruments. Loading a set keeps every instrument's own knob settings.
// ============================================================================

import type { RackSlot, StudioCable } from '@/devices/types';
import { useStudioStore } from '@/store/studio';

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
}

export const STUDIO_SETS: StudioSet[] = [
  {
    id: 'moog-sound-studio',
    name: 'Moog Sound Studio',
    description: 'DFAM, Mother-32 and Subharmonicon stacked like the 3-tier rack, clocked from one source.',
    goal: 'Patch three semi-modulars into one groove - percussion, bass and polyrhythmic drones in sync.',
    rack: [
      { id: 'studio-clock', device: 'studio-clock' },
      { id: 'dfam', device: 'dfam' },
      { id: 'mother32', device: 'mother32' },
      { id: 'subharmonicon', device: 'subharmonicon' },
    ],
    sync: { mother32: true, subharmonicon: true },
    cables: [
      { from: { instance: 'studio-clock', jack: 'out_clock' }, to: { instance: 'dfam', jack: 'in_adv_clock' }, color: '#38bdf8' },
    ],
    bpm: 110,
    focus: 'dfam',
  },
  {
    id: 'elektron-live',
    name: 'Elektron live set',
    description: 'Analog Rytm on drums, Analog Four on bass and chords, both into the Xone:96.',
    goal: 'Build and perform a full track: patterns, parameter locks, song mode and DJ-style mixing.',
    rack: [
      { id: 'analog-rytm', device: 'analog-rytm' },
      { id: 'analog-four', device: 'analog-four' },
      { id: 'xone96', device: 'xone96' },
    ],
    routes: { 'analog-rytm': 'xone96:studio_1', 'analog-four': 'xone96:studio_2' },
    sync: { 'analog-rytm': true, 'analog-four': true, xone96: true },
    bpm: 124,
    focus: 'analog-rytm',
  },
  {
    id: 'bass-and-drums',
    name: 'Bass & drums',
    description: 'Rytm drums with a Sub 37 bassline on the arpeggiator, mixed on the Xone:96.',
    goal: 'Lock a bassline to a beat: kick vs bass, EQ and sidechain-style ducking by hand.',
    rack: [
      { id: 'analog-rytm', device: 'analog-rytm' },
      { id: 'sub37', device: 'sub37' },
      { id: 'xone96', device: 'xone96' },
    ],
    routes: { 'analog-rytm': 'xone96:studio_1', sub37: 'xone96:studio_2' },
    sync: { 'analog-rytm': true, sub37: true, xone96: true },
    bpm: 122,
    focus: 'sub37',
  },
  {
    id: 'everything',
    name: 'The whole studio',
    description: 'Every instrument in one rack, with drums and synths routed into the mixer.',
    goal: 'Your playground. Heavy on CPU - close instruments you are not using on older iPads.',
    rack: [
      { id: 'studio-clock', device: 'studio-clock' },
      { id: 'analog-rytm', device: 'analog-rytm' },
      { id: 'analog-four', device: 'analog-four' },
      { id: 'sub37', device: 'sub37' },
      { id: 'dfam', device: 'dfam' },
      { id: 'mother32', device: 'mother32' },
      { id: 'subharmonicon', device: 'subharmonicon' },
      { id: 'xone96', device: 'xone96' },
    ],
    routes: {
      'analog-rytm': 'xone96:studio_1',
      'analog-four': 'xone96:studio_2',
      sub37: 'xone96:studio_3',
      dfam: 'xone96:studio_4',
      mother32: 'xone96:studio_a',
      subharmonicon: 'xone96:studio_b',
    },
    sync: { 'analog-rytm': true, 'analog-four': true, sub37: true, mother32: true, subharmonicon: true, xone96: true },
    cables: [
      { from: { instance: 'studio-clock', jack: 'out_clock' }, to: { instance: 'dfam', jack: 'in_adv_clock' }, color: '#38bdf8' },
    ],
    bpm: 120,
    focus: 'analog-rytm',
  },
];

/** Load a set: replaces the rack, routing, sync and studio cables; keeps instrument settings */
export function loadStudioSet(set: StudioSet) {
  const store = useStudioStore.getState();
  store.resetLesson();
  useStudioStore.setState(s => ({
    studio: {
      ...s.studio,
      rack: set.rack,
      routes: set.routes ?? {},
      sync: set.sync ?? {},
      cables: set.cables ?? [],
      bpm: set.bpm ?? s.studio.bpm,
    },
    currentDevice: set.focus ?? set.rack[0].id,
  }));
  if (set.bpm) store.setBpm(set.bpm);
}
