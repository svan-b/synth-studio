// npx tsx lib/midi/__tests__/router.test.ts
import assert from 'node:assert/strict';
import type { ControlSpec, ControlValue } from '@/types';
import { MidiRouter, ccToValue, type FocusSink, type MidiReceiver } from '../router';
import type { LearnTarget, MidiMapping, MidiSettingsState } from '@/store/midi';
import { normToValue } from '@/lib/controls/mapping';
import { done, test } from './harness';

const SPECS: Record<string, Record<string, ControlSpec>> = {
  sub37: {
    pitch_bend: { type: 'knob', label: 'PITCH', min: -100, max: 100, default: 0, units: '%', bipolar: true },
    mod_wheel: { type: 'knob', label: 'MOD', min: 0, max: 100, default: 0, units: '%' },
    cutoff: { type: 'knob', label: 'CUTOFF', min: 20, max: 20000, default: 1000, units: 'Hz', curve: 'logarithmic' },
    wave: { type: 'switch', label: 'WAVE', options: ['TRI', 'SAW', 'SQR', 'PULSE'], default: 0 },
    play: { type: 'button', label: 'PLAY', default: false },
    hold: { type: 'button', label: 'HOLD', default: false, momentary: true },
  },
  dfam: { decay: { type: 'knob', label: 'DECAY', min: 0, max: 10, default: 5, units: 'none' } },
};

function setup() {
  const calls: string[] = [];
  const values: Record<string, Record<string, ControlValue>> = { sub37: {}, dfam: {}, synth: {} };
  const settings: Pick<MidiSettingsState, 'inputChannel' | 'inputTargets' | 'mappings'> = { inputChannel: 'omni', inputTargets: {}, mappings: [] };
  const learn: { armed: boolean; target: LearnTarget | null } = { armed: false, target: null };
  const rack = new Set(['sub37', 'dfam', 'synth']);
  const raw: { instance: string; data: number[] }[] = [];
  const receiver = (instance: string): MidiReceiver => ({ receiveMidi: d => { raw.push({ instance, data: Array.from(d) }); } });
  let focus = 'sub37';
  let seq = 0;
  const learned: MidiMapping[] = [];
  const router = new MidiRouter({
    settings: () => settings,
    noteOn: (i, n, v) => calls.push(`on ${i} ${n} ${v.toFixed(3)}`),
    noteOff: (i, n) => calls.push(`off ${i} ${n}`),
    receiver: i => (i === 'synth' ? receiver(i) : null),
    spec: (i, c) => SPECS[i]?.[c],
    value: (i, c) => values[i]?.[c],
    apply: (i, c, v) => { values[i][c] = v; calls.push(`set ${i}.${c}=${typeof v === 'number' ? +v.toFixed(3) : v}`); },
    inRack: i => rack.has(i),
    fallbackFocus: () => focus,
    learn: () => learn,
    addMapping: m => {
      const mapping = { ...m, id: `m${seq++}`, createdAt: 0 };
      settings.mappings = [...settings.mappings.filter(x => !(x.cc === m.cc && x.channel === m.channel) && !(x.instance === m.instance && x.control === m.control)), mapping];
      return mapping;
    },
    onLearned: m => { learned.push(m); learn.target = null; },
  });
  return { router, calls, values, settings, learn, rack, raw, learned, setFocus: (f: string) => { focus = f; } };
}

test('notes go to the focused instrument with velocity 0..1', () => {
  const { router, calls } = setup();
  router.handle('Keys', [0x90, 60, 127]);
  router.handle('Keys', [0x80, 60, 0]);
  router.handle('Keys', [0x90, 62, 64]);
  router.handle('Keys', [0x90, 62, 0]); // note-on velocity 0 = note-off
  assert.deepEqual(calls, ['on sub37 60 1.000', 'off sub37 60', 'on sub37 62 0.504', 'off sub37 62']);
});

test('note-off follows its note-on after focus changes (no hanging notes)', () => {
  const { router, calls, setFocus } = setup();
  router.handle('Keys', [0x90, 48, 100]);
  setFocus('dfam');
  router.handle('Keys', [0x80, 48, 0]);
  router.handle('Keys', [0x90, 50, 100]);
  assert.deepEqual(calls, ['on sub37 48 0.787', 'off sub37 48', 'on dfam 50 0.787']);
});

test('the focused DeviceHost sink receives notes so its keys light up; releasing it frees held notes', () => {
  const { router, calls } = setup();
  const got: string[] = [];
  const sink: FocusSink = { instance: 'dfam', noteOn: (n, v) => got.push(`sink on ${n} ${v.toFixed(2)}`), noteOff: n => got.push(`sink off ${n}`) };
  const release = router.pushFocus(sink);
  router.handle('Keys', [0x90, 36, 127]);
  router.handle('Keys', [0x90, 38, 127]);
  router.handle('Keys', [0x80, 36, 0]);
  release();
  assert.deepEqual(got, ['sink on 36 1.00', 'sink on 38 1.00', 'sink off 36']);
  assert.deepEqual(calls, ['off dfam 38'], 'held note released through the hub when the view went away');
});

test('per-input target and channel filter', () => {
  const { router, calls, settings } = setup();
  settings.inputTargets = { Pads: 'dfam' };
  router.handle('Pads', [0x99, 36, 127]);
  router.handle('Keys', [0x90, 60, 127]);
  settings.inputChannel = 1; // channel 2
  router.handle('Keys', [0x90, 61, 127]); // ch 1 -> filtered
  router.handle('Keys', [0x91, 62, 127]);
  assert.deepEqual(calls, ['on dfam 36 1.000', 'on sub37 60 1.000', 'on sub37 62 1.000']);
});

test('pitch bend drives a pitch_bend control through its spec', () => {
  const { router, values } = setup();
  router.handle('Keys', [0xe0, 0, 64]); // centre
  assert.equal(values.sub37.pitch_bend, 0);
  router.handle('Keys', [0xe0, 127, 127]); // full up
  assert.equal(values.sub37.pitch_bend, 100);
  router.handle('Keys', [0xe0, 0, 0]); // full down
  assert.equal(values.sub37.pitch_bend, -100);
  router.handle('Keys', [0xe0, 0, 96]); // 3/4 up
  assert.equal(values.sub37.pitch_bend, normToValue(SPECS.sub37.pitch_bend as never, (0.5 + 1) / 2));
});

test('mod wheel (CC 1) drives mod_wheel; instruments without one ignore it', () => {
  const { router, values, setFocus, calls } = setup();
  router.handle('Keys', [0xb0, 1, 127]);
  assert.equal(values.sub37.mod_wheel, 100);
  setFocus('dfam');
  const n = calls.length;
  router.handle('Keys', [0xb0, 1, 64]);
  router.handle('Keys', [0xe0, 0, 100]);
  assert.equal(calls.length, n, 'no control for the DFAM');
});

test('MIDI-aware devices receive bend / CC / aftertouch raw; notes still via noteOn', () => {
  const { router, raw, calls, setFocus } = setup();
  setFocus('synth');
  router.handle('Keys', [0x90, 60, 100]);
  router.handle('Keys', [0xe0, 0, 80]);
  router.handle('Keys', [0xb0, 74, 30]);
  router.handle('Keys', [0xd0, 50]);
  assert.deepEqual(calls, ['on synth 60 0.787']);
  assert.deepEqual(raw.map(r => r.data), [[0xe0, 0, 80], [0xb0, 74, 30], [0xd0, 50]]);
});

test('MIDI learn: armed + touched control + CC = mapping, scaled through normToValue', () => {
  const { router, learn, learned, values, settings } = setup();
  learn.armed = true;
  router.handle('Knobs', [0xb2, 74, 10]); // no target yet: nothing learned
  assert.equal(learned.length, 0);
  learn.target = { instance: 'sub37', control: 'cutoff' };
  router.handle('Knobs', [0xb2, 74, 127]);
  assert.equal(learned.length, 1);
  assert.deepEqual({ ...learned[0], id: undefined, createdAt: undefined }, { id: undefined, createdAt: undefined, port: 'Knobs', channel: 2, cc: 74, instance: 'sub37', control: 'cutoff', toggle: undefined });
  assert.equal(values.sub37.cutoff, 20000, 'learning CC applies it at once');
  learn.armed = false;
  router.handle('Knobs', [0xb2, 74, 0]);
  assert.equal(values.sub37.cutoff, 20);
  router.handle('Knobs', [0xb2, 74, 64]);
  assert.equal(values.sub37.cutoff, normToValue(SPECS.sub37.cutoff as never, 64 / 127));
  // other port / channel don't match
  router.handle('Other', [0xb2, 74, 127]);
  router.handle('Knobs', [0xb0, 74, 127]);
  assert.equal(values.sub37.cutoff, normToValue(SPECS.sub37.cutoff as never, 64 / 127));
  // removing the mapping stops it
  settings.mappings = [];
  router.handle('Knobs', [0xb2, 74, 127]);
  assert.equal(values.sub37.cutoff, normToValue(SPECS.sub37.cutoff as never, 64 / 127));
});

test('learned CC beats the mod wheel default; protocol CCs are never learned', () => {
  const { router, learn, learned, values } = setup();
  learn.armed = true;
  learn.target = { instance: 'dfam', control: 'decay' };
  router.handle('Keys', [0xb0, 99, 1]); // NRPN select - ignored
  router.handle('Keys', [0xb0, 6, 1]);  // data entry - ignored
  assert.equal(learned.length, 0);
  router.handle('Keys', [0xb0, 1, 127]);
  assert.equal(learned.length, 1);
  assert.equal(values.dfam.decay, 10);
  assert.equal(values.sub37.mod_wheel, undefined, 'CC 1 consumed by the mapping');
});

test('switches step through options; toggle buttons flip on press; momentary follows', () => {
  const { router, learn, values } = setup();
  learn.armed = true;
  learn.target = { instance: 'sub37', control: 'wave' };
  router.handle('K', [0xb0, 20, 0]);
  assert.equal(values.sub37.wave, 0);
  router.handle('K', [0xb0, 20, 127]);
  assert.equal(values.sub37.wave, 3);
  router.handle('K', [0xb0, 20, 64]);
  assert.equal(values.sub37.wave, 2);
  learn.target = { instance: 'sub37', control: 'play' };
  router.handle('K', [0xb0, 21, 127]); // learn + first press: on
  assert.equal(values.sub37.play, true);
  router.handle('K', [0xb0, 21, 0]);   // release: no change
  assert.equal(values.sub37.play, true);
  router.handle('K', [0xb0, 21, 127]); // second press: off
  assert.equal(values.sub37.play, false);
  learn.target = { instance: 'sub37', control: 'hold' };
  router.handle('K', [0xb0, 22, 127]);
  assert.equal(values.sub37.hold, true);
  router.handle('K', [0xb0, 22, 0]);
  assert.equal(values.sub37.hold, false);
});

test('mappings to instruments not in the rack are ignored', () => {
  const { router, settings, rack, values } = setup();
  settings.mappings = [{ id: 'x', channel: 0, cc: 7, instance: 'dfam', control: 'decay', createdAt: 0 }];
  rack.delete('dfam');
  router.handle('K', [0xb0, 7, 127]);
  assert.equal(values.dfam.decay, undefined);
});

test('echo guard: a device refusing a port gets nothing from it; other ports still play it', () => {
  const calls: string[] = [];
  const raw: string[] = [];
  const settings: Pick<MidiSettingsState, 'inputChannel' | 'inputTargets' | 'mappings'> = { inputChannel: 'omni', inputTargets: {}, mappings: [] };
  const router = new MidiRouter({
    settings: () => settings,
    noteOn: (i, n) => calls.push(`on ${i} ${n}`),
    noteOff: (i, n) => calls.push(`off ${i} ${n}`),
    // "Your synth" sends to the hardware called "Sub 37": notes from the Sub 37's own keys must not echo back
    receiver: () => ({ receiveMidi: d => { raw.push(Array.from(d).join(',')); }, ignoresInput: port => port === 'Sub 37' }),
    spec: () => undefined,
    value: () => undefined,
    apply: () => undefined,
    inRack: () => true,
    fallbackFocus: () => 'midi-synth',
    learn: () => ({ armed: false, target: null }),
    addMapping: m => ({ ...m, id: 'x', createdAt: 0 }),
  });
  router.handle('Sub 37', [0x90, 60, 100]);
  router.handle('Sub 37', [0x80, 60, 0]);
  router.handle('Sub 37', [0xe0, 0, 80]);
  router.handle('Sub 37', [0xb0, 74, 10]);
  assert.deepEqual(calls, []);
  assert.deepEqual(raw, []);
  router.handle('Keystep', [0x90, 62, 100]);
  router.handle('Keystep', [0x80, 62, 0]);
  router.handle('Keystep', [0xb0, 74, 10]);
  assert.deepEqual(calls, ['on midi-synth 62', 'off midi-synth 62']);
  assert.deepEqual(raw, ['176,74,10']);
});

test('ccToValue covers every control kind', () => {
  assert.equal(ccToValue(SPECS.dfam.decay, 0), 0);
  assert.equal(ccToValue(SPECS.dfam.decay, 127), 10);
  assert.equal(ccToValue(SPECS.sub37.wave, 42), 1);
  assert.equal(ccToValue(SPECS.sub37.hold, 64), true);
  assert.equal(ccToValue({ type: 'pattern', label: 'P', steps: 16, default: '0' }, 64), undefined);
});

void done('MIDI input router');
