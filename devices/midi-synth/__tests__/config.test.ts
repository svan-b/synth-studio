// npx tsx devices/midi-synth/__tests__/config.test.ts
// "Your synth" data (new fields, old saves), program change bytes, starters,
// several synths on one output, and the template browser's grouping.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { done, test } from '@/lib/midi/__tests__/harness';
import type { GuideIndex } from '../guide';
import { byManufacturer, groupResults, manufacturers, searchGuide } from '../templates';
import {
  DEFAULT_NAME, PRACTICE_PORT, STARTERS, asData, channelClashes, freeChannel, initialData, isPractice, knobMessages, migrateData,
  programMessages, rackLabel, starterGroups, type SynthUse,
} from '../config';

test('a new Your synth plays the Practice synth on channel 1, no clock, no bank', () => {
  const d = initialData();
  assert.ok(isPractice(d.port));
  assert.equal(d.channel, 0);
  assert.equal(d.clock, false);
  assert.deepEqual(d.bank, { msb: null, lsb: null });
});

test('older saves gain clock and bank; "no output" stays no output; unchanged saves keep their identity', () => {
  const old = { v: 1, name: 'Minilogue', port: null, channel: 3, template: null, knobs: [{ label: 'Cutoff', cc: 43, min: 0, max: 127 }], steps: [], offsetMs: 0 };
  const m = migrateData(old);
  assert.equal(m.port, null);
  assert.equal(m.clock, false);
  assert.deepEqual(m.bank, { msb: null, lsb: null });
  assert.equal(m.channel, 3);
  assert.equal(m.steps.length, 16);
  const again = migrateData(m);
  assert.equal(again, m, 'migrating valid data returns the same object');
  // asData completes missing fields once and returns the same object every time (no React churn)
  const partial = { ...old, steps: m.steps };
  assert.equal(asData(partial), asData(partial));
  assert.equal(asData(partial).clock, false);
  assert.equal(asData('nonsense').name, DEFAULT_NAME);
});

test('program change bytes: bank select MSB, LSB, then the program, on the synth\'s channel', () => {
  assert.deepEqual(programMessages(4, 1, { msb: null, lsb: null }), [[0xc1, 4]]);
  assert.deepEqual(programMessages(0, 0, { msb: 2, lsb: 5 }), [[0xb0, 0, 2], [0xb0, 32, 5], [0xc0, 0]]);
  assert.deepEqual(programMessages(200, 15, undefined), [[0xcf, 127]], 'clamped');
});

test('14-bit knobs send MSB then LSB on their channel', () => {
  const msgs = knobMessages({ label: 'Cutoff', cc: 19, lsb: 51, min: 0, max: 127 }, 127, 1);
  assert.deepEqual(msgs, [[0xb1, 19, 127], [0xb1, 51, 127]]);
});

test('several synths: clashes need the same output and channel; a free channel is found; names tell twins apart', () => {
  const test1 = { id: 'out1', name: 'Test Synth' };
  const uses: SynthUse[] = [
    { instance: 'midi-synth', name: 'Bass', port: test1, channel: 0 },
    { instance: 'midi-synth#2', name: 'Lead', port: test1, channel: 1 },
    { instance: 'midi-synth#3', name: 'Pad', port: { ...PRACTICE_PORT }, channel: 0 },
  ];
  assert.deepEqual(channelClashes('midi-synth#2', test1, 0, uses).map(u => u.name), ['Bass']);
  assert.deepEqual(channelClashes('midi-synth#2', test1, 2, uses), []);
  assert.deepEqual(channelClashes('midi-synth#3', { id: 'other', name: 'Other' }, 0, uses), [], 'different output: no clash');
  assert.equal(freeChannel('midi-synth#4', test1, uses), 2);
  assert.equal(rackLabel('Bass', 0, 'midi-synth', uses), 'Bass');
  assert.equal(rackLabel(DEFAULT_NAME, 0, 'midi-synth', uses), undefined, 'unnamed: the default rack name');
  const twins: SynthUse[] = [...uses, { instance: 'midi-synth#4', name: 'Bass', port: test1, channel: 4 }];
  assert.equal(rackLabel('Bass', 4, 'midi-synth#4', twins), 'Bass · ch 5');
});

test('starters: grouped as Category / Name; each applies; hardware ones keep or pick a real output', () => {
  const groups = starterGroups().map(([g]) => g);
  assert.deepEqual(groups, ['Setup', 'Sequence', 'Knobs']);
  assert.ok(STARTERS.every(s => /^[A-Z][a-z]+ \/ ./.test(s.name)), 'names are "Category / Name"');
  const hw = { id: 'out1', name: 'Test Synth' };
  for (const s of STARTERS) {
    const r = s.apply(initialData(), { hardware: hw });
    assert.equal(r.data.v, 1, s.id);
    assert.equal(r.data.steps.length, 16, s.id);
  }
  const drums = STARTERS.find(s => s.id === 'practice-drums')!.apply(initialData(), { hardware: null }).data;
  assert.ok(isPractice(drums.port) && drums.channel === 9 && drums.clock);
  const hwStarter = STARTERS.find(s => s.id === 'hw-ch1-clock')!;
  assert.equal(hwStarter.apply(initialData(), { hardware: null }).data.port, null, 'no hardware: Setup will ask');
  assert.equal(hwStarter.apply(initialData(), { hardware: hw }).data.port?.name, 'Test Synth');
  const mine = { ...initialData(), port: { id: 'x', name: 'My Minilogue' } };
  assert.equal(hwStarter.apply(mine, { hardware: hw }).data.port?.name, 'My Minilogue', 'keeps the synth you chose');
  const cleared = STARTERS.find(s => s.id === 'seq-clear')!.apply(initialData(), { hardware: null }).data;
  assert.ok(cleared.steps.every(st => !st.on));
});

test('templates: manufacturers A-Z with counts, one maker\'s instruments, grouped search results', () => {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../public/midi-guide/index.json'), 'utf8')) as GuideIndex;
  const makers = manufacturers(index.devices);
  assert.ok(makers.length > 100, `${makers.length} makers`);
  const names = makers.map(m => m.name.toLowerCase());
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), 'A-Z');
  assert.equal(makers.reduce((n, m) => n + m.count, 0), index.devices.length);
  const moog = byManufacturer(index.devices, 'moog');
  assert.ok(moog.length >= 10 && moog.every(d => d.manufacturer === 'Moog'));
  assert.ok(moog.some(d => d.id === 'moog-subsequent-37'));
  const groups = groupResults(searchGuide(index.devices, 'volca'));
  assert.equal(groups[0][0], 'KORG');
  assert.ok(groups[0][1].length >= 5);
  assert.ok(searchGuide(index.devices, '').length > 10, 'popular list before typing');
});

void done('Your synth config, starters and templates');
