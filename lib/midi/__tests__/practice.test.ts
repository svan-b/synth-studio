// npx tsx lib/midi/__tests__/practice.test.ts
// The Practice synth's pure parts: which part listens where, programs, CC
// curves, the latched arpeggiator and the MIDI clock follower.
import assert from 'node:assert/strict';
import { done, near, test } from './harness';
import {
  ArpCore, CLOCKS_PER_16TH, ClockFollower, INTERNAL_BPM, PARTS, ccAttackS, ccCutoffHz, ccGlideS, ccPan, ccReleaseS, ccVolumeGain,
  drumFor, partFor, programIndex, programName, velocityGain, velocityOctaves,
} from '../practice-core';

test('parts listen on channels 1, 2 and 10 only (0-based 0, 1, 9)', () => {
  assert.equal(partFor(0)?.kind, 'bass');
  assert.equal(partFor(1)?.kind, 'keys');
  assert.equal(partFor(9)?.kind, 'drums');
  for (const ch of [2, 3, 4, 5, 6, 7, 8, 10, 11, 15]) assert.equal(partFor(ch), undefined, `nothing on channel ${ch + 1}`);
  assert.deepEqual(PARTS.map(p => p.channel), [0, 1, 9]);
});

test('program numbers wrap around each part\'s programs; names are per channel', () => {
  assert.equal(programIndex('bass', 0), 0);
  assert.equal(programIndex('bass', 5), 1);
  assert.equal(programIndex('drums', 3), 1);
  assert.equal(programName(0, 2), 'Acid bass');
  assert.equal(programName(1, 2), 'Soft pad');
  assert.equal(programName(9, 0), 'Analog kit');
  assert.equal(programName(4, 0), null);
});

test('General MIDI drum notes map to drum voices', () => {
  assert.equal(drumFor(36), 'kick');
  assert.equal(drumFor(38), 'snare');
  assert.equal(drumFor(39), 'clap');
  assert.equal(drumFor(42), 'hat');
  assert.equal(drumFor(46), 'open');
  assert.equal(drumFor(45), 'tom');
  assert.equal(drumFor(49), 'cymbal');
  assert.equal(drumFor(60), null);
});

test('CC curves: exponential, in range, monotonic', () => {
  near(ccCutoffHz(0), 30, 1e-9, 'cutoff at 0');
  assert.ok(ccCutoffHz(127) > 16000 && ccCutoffHz(127) < 19000, `cutoff at 127: ${ccCutoffHz(127)}`);
  near(ccAttackS(0), 0.001, 1e-9, 'attack 0');
  near(ccAttackS(127), 3, 1e-9, 'attack 127');
  near(ccReleaseS(127), 5, 1e-9, 'release 127');
  assert.equal(ccGlideS(0), 0);
  near(ccVolumeGain(100), 1, 1e-9, 'volume 100 is unity');
  near(ccPan(64), 0, 1e-9, 'pan centre');
  for (let v = 1; v <= 127; v++) {
    assert.ok(ccCutoffHz(v) > ccCutoffHz(v - 1), 'cutoff rises');
    assert.ok(velocityGain(v) >= velocityGain(v - 1), 'velocity louder');
  }
  near(velocityGain(127), 1, 1e-9, 'full velocity');
  assert.ok(velocityGain(40) < 0.2, 'soft notes are clearly softer');
  assert.ok(velocityOctaves(127) > 0 && velocityOctaves(40) < 0, 'harder is brighter');
});

test('arpeggiator: latched, up, a new chord after release replaces the old one', () => {
  const a = new ArpCore();
  assert.equal(a.next(), null, 'off: nothing');
  a.on = true;
  [67, 60, 64].forEach(n => a.noteOn(n));
  assert.deepEqual(a.notes, [60, 64, 67], 'sorted low to high');
  [67, 60, 64].forEach(n => a.noteOff(n));
  assert.deepEqual([a.next(), a.next(), a.next(), a.next()], [60, 64, 67, 60], 'keeps cycling after release (latch)');
  a.noteOn(62);
  assert.deepEqual(a.notes, [62], 'a new chord replaces the latched one');
  a.noteOn(65);
  assert.deepEqual(a.notes, [62, 65], 'notes held together join');
  a.restart();
  assert.equal(a.next(), 62, 'restart goes back to the first note');
  a.clear();
  assert.equal(a.next(), null);
});

test('clock follower: 16ths every 6 pulses after Start; Stop halts; SPP moves; tempo from the pulses', () => {
  const c = new ClockFollower();
  const ms = 60000 / 120 / 24; // 120 BPM
  let t = 1000;
  // Clock before Start: measured, but no steps
  for (let i = 0; i < 12; i++) assert.equal(c.clock(t += ms), false);
  c.start();
  const steps: number[] = [];
  for (let i = 0; i < 48; i++) if (c.clock(t += ms)) steps.push(i);
  assert.deepEqual(steps, [0, 6, 12, 18, 24, 30, 36, 42], 'a 16th every 6 pulses, from the first one');
  near(c.bpm()!, 120, 0.01, 'tempo');
  assert.ok(c.present(t + 100) && !c.present(t + 400), 'clock presence times out');
  c.stop();
  assert.ok(!c.running && c.halted);
  assert.equal(c.clock(t += ms), false, 'stopped: no steps');
  c.position(4);
  assert.equal(c.count, 4 * CLOCKS_PER_16TH);
  c.continue();
  assert.equal(c.clock(t += ms), true, 'continue at a 16th boundary');
  assert.notEqual(INTERNAL_BPM as number, 120, 'the internal tempo differs from the default studio tempo, so drift is audible');
});

void done('Practice synth core');
