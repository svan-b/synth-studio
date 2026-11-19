// npx tsx devices/midi-synth/__tests__/sequencer.test.ts
// Drives the real studio Transport on a fake audio clock and checks that the
// step sequencer puts every note exactly on its 16th, with the note-off after
// the gate (and always before the next note-on), mapped to MIDI timestamps
// with performance.now() + (time - currentTime) * 1000 + outputLatency * 1000.
import assert from 'node:assert/strict';
import { FakeClock, done, manualTransport, near, test } from '@/lib/midi/__tests__/harness';
import { audioToMidiTime } from '@/lib/midi/time';
import { StepSequencer, TICKS_PER_STEP, stepTick, type ScheduledMidi, type SeqSettings } from '../sequencer';
import { defaultSteps, type SeqStep } from '../config';

const allOn = (note = 60): SeqStep[] => Array.from({ length: 16 }, (_, i) => ({ on: true, note: note + (i % 3), vel: 100 }));

function run(opts: Partial<SeqSettings> & { bpm?: number; seconds?: number; latency?: number } = {}) {
  const clock = new FakeClock();
  clock.outputLatency = opts.latency ?? 0;
  const { transport, run: pump } = manualTransport(clock);
  transport.setBpm(opts.bpm ?? 120);
  transport.setSwing(opts.swing ?? 0);
  const seq = new StepSequencer();
  const settings: SeqSettings = { enabled: true, steps: allOn(), length: 16, gate: 0.5, transpose: 0, swing: opts.swing ?? 0, channel: 0, ...opts };
  const events: (ScheduledMidi & { ts: number; step: number })[] = [];
  const steps: number[] = [];
  transport.onTick(t => {
    const r = seq.tick(t, settings);
    if (!r) return;
    steps.push(r.step);
    r.events.forEach(e => events.push({ ...e, step: r.step, ts: audioToMidiTime(clock, e.time, { compensate: true }, clock.now()) }));
  });
  transport.start();
  pump(opts.seconds ?? 2.2);
  return { events, steps, start: transport.startedAt, clock };
}

const ons = <T extends { bytes: number[] }>(ev: T[]) => ev.filter(e => (e.bytes[0] & 0xf0) === 0x90);
const offs = <T extends { bytes: number[] }>(ev: T[]) => ev.filter(e => (e.bytes[0] & 0xf0) === 0x80);

test('one note per 16th, exactly on the transport grid (120 BPM = 125 ms)', () => {
  const { events, start } = run();
  const on = ons(events);
  assert.ok(on.length >= 16, `expected a bar of notes, got ${on.length}`);
  on.forEach((e, i) => near(e.time, start + i * 0.125, 1e-9, `note-on ${i}`));
});

test('note-off = note-on + gate x 16th; every note-on has its note-off queued with it', () => {
  const { events } = run({ gate: 0.4 });
  const on = ons(events);
  const off = offs(events);
  assert.equal(on.length, off.length);
  on.forEach((e, i) => {
    assert.equal(off[i].bytes[1], e.bytes[1], 'same note');
    near(off[i].time - e.time, 0.4 * 0.125, 1e-9, `gate ${i}`);
  });
});

test('MIDI timestamps: performance.now() + (time - currentTime) * 1000 + outputLatency', () => {
  const { events, clock } = run({ latency: 0.025, seconds: 1 });
  // FakeClock keeps now() = 1000 ms + currentTime, so ts must be 1000 + time*1000 + 25
  events.forEach(e => near(e.ts, 1000 + e.time * 1000 + 25, 1e-6, 'timestamp'));
  assert.ok(events.every(e => e.ts > clock.now() - 1000), 'scheduled ahead');
});

test('swing: off-beat 16ths move later; gates never overlap the next note-on', () => {
  const { events, start } = run({ swing: 0.5, gate: 1 });
  const on = ons(events);
  const off = offs(events);
  on.forEach((e, i) => {
    const straight = start + i * 0.125;
    near(e.time, i % 2 ? straight + 0.5 * 0.125 : straight, 1e-9, `swung note-on ${i}`);
    if (i + 1 < on.length) assert.ok(off[i].time < on[i + 1].time, `off ${i} before next on`);
    assert.ok(off[i].time > e.time, 'off after on');
  });
});

test('length wraps the pattern; transpose and channel apply; disabled = silent', () => {
  const steps = defaultSteps();
  const { steps: played } = run({ length: 5, steps, seconds: 1.4 });
  assert.deepEqual(played.slice(0, 12), [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1]);
  const t = run({ transpose: 12, channel: 9, steps: allOn(48), seconds: 0.3 });
  assert.deepEqual(ons(t.events)[0].bytes, [0x99, 60, 100]);
  assert.deepEqual(offs(t.events)[0].bytes, [0x89, 60, 0]);
  assert.equal(run({ enabled: false }).events.length, 0);
});

test('rests send nothing; notes clamp to 0..127', () => {
  const steps = allOn(126).map((s, i) => ({ ...s, on: i % 2 === 0 }));
  const { events, steps: played } = run({ steps, transpose: 5, seconds: 0.6 });
  assert.ok(ons(events).every(e => e.bytes[1] === 127));
  // only the even (switched-on) steps sent anything
  assert.equal(ons(events).length, played.filter(s => s % 2 === 0).length);
});

test('internal clock ticks (not following the studio) land on the same grid', () => {
  const seq = new StepSequencer();
  const s: SeqSettings = { enabled: true, steps: allOn(), length: 16, gate: 0.5, transpose: 0, swing: 0, channel: 0 };
  const out = [0, 1, 2, 3].map(n => seq.tick(stepTick(10 + n * 0.125, n, 0.125), s)!);
  out.forEach((r, n) => {
    assert.equal(r.step, n);
    near(r.events[1].time - r.events[0].time, 0.0625, 1e-9, 'gate');
  });
  assert.equal(stepTick(0, 3, 0.125).tick, 3 * TICKS_PER_STEP);
});

void done('MIDI synth step sequencer');
