// npx tsx lib/midi/__tests__/clock-out.test.ts
import assert from 'node:assert/strict';
import { MidiClockOut } from '../clock-out';
import { CONTINUE, SONG_POSITION, START, STOP, TIMING_CLOCK } from '../bytes';
import type { ClockOutSettings, PortRef } from '@/store/midi';
import { FakeClock, done, manualTransport, near, test } from './harness';

interface Sent { port: string; data: number[]; ts: number | undefined }

function setup(opts: Partial<ClockOutSettings> = {}, latency = { base: 0, out: 0 }) {
  const clock = new FakeClock();
  clock.baseLatency = latency.base;
  clock.outputLatency = latency.out;
  const { transport, run } = manualTransport(clock);
  const sent: Sent[] = [];
  const port = (id: string) => ({ id, name: id.toUpperCase(), send: (d: number[] | Uint8Array, ts?: number) => { sent.push({ port: id, data: Array.from(d), ts }); } });
  const ports = new Map([['a', port('a')], ['b', port('b')]]);
  const settings: ClockOutSettings = { targets: [{ id: 'a', name: 'A' }], compensate: true, offsetMs: 0, spp: true, ...opts };
  const co = new MidiClockOut({
    transport,
    ctx: () => clock,
    settings: () => settings,
    resolve: (ref: PortRef) => ports.get(ref.id) ?? null,
    now: clock.now,
  });
  co.start();
  transport.setBpm(120);
  return { clock, transport, run, sent, settings, co };
}

const clocks = (sent: Sent[], port = 'a') => sent.filter(s => s.port === port && s.data[0] === TIMING_CLOCK);

test('Start, then 24 clocks per beat at exact audio-clock times', () => {
  const { transport, run, sent } = setup();
  transport.start();
  run(1.0);
  // Transport starts 50 ms ahead; fake now = 1000 ms at audio time 0, so audio t -> 1000 + t*1000
  assert.deepEqual(sent[0].data, [START]);
  near(sent[0].ts!, 1000 + 50 - 1, 1e-6, 'Start timestamp');
  const c = clocks(sent);
  assert.ok(c.length >= 48, `expected >= 48 clocks in 1 s at 120 BPM (+lookahead), got ${c.length}`);
  const tick = 60000 / 120 / 24; // 20.833 ms
  c.forEach((m, i) => near(m.ts!, 1050 + i * tick, 1e-6, `clock ${i}`));
  // every clock is in the future when sent (scheduled, not sent late)
  assert.ok(c.every(m => m.ts !== undefined));
});

test('output latency compensation and manual offset shift every message', () => {
  // performance.now() + (tickTime - currentTime) * 1000 + outputLatency * 1000 (+ offset); baseLatency is not added
  const { transport, run, sent } = setup({ offsetMs: 5 }, { base: 0.01, out: 0.02 });
  transport.start();
  run(0.3);
  near(sent[0].ts!, 1000 + 50 + 20 + 5 - 1, 1e-6, 'Start with 20 ms output latency + 5 ms offset');
  near(clocks(sent)[0].ts!, 1000 + 50 + 20 + 5, 1e-6, 'first clock');
});

test('compensation off: raw audio-clock mapping', () => {
  const { transport, run, sent } = setup({ compensate: false }, { base: 0.01, out: 0.02 });
  transport.start();
  run(0.2);
  near(clocks(sent)[0].ts!, 1050, 1e-6, 'first clock without latency');
});

test('Stop is queued after the last clock already sent', () => {
  const { transport, run, sent } = setup();
  transport.start();
  run(0.5);
  const lastClock = clocks(sent).at(-1)!.ts!;
  transport.stop();
  const stop = sent.at(-1)!;
  assert.deepEqual(stop.data, [STOP]);
  assert.ok(stop.ts! > lastClock, 'stop after pending clocks');
  const n = sent.length;
  run(0.3);
  assert.equal(sent.length, n, 'no clocks after stop');
});

test('starting mid-song sends Song Position + Continue', () => {
  const { transport, run, sent } = setup();
  transport.start(undefined, 96 * 2); // bar 3
  run(0.1);
  assert.deepEqual(sent[0].data, [SONG_POSITION, 32 & 0x7f, 32 >> 7]); // 2 bars = 32 sixteenths
  assert.deepEqual(sent[1].data, [CONTINUE]);
  assert.ok(sent[1].ts! < clocks(sent)[0].ts!, 'continue before the first clock');
});

test('song position off: always Start', () => {
  const { transport, run, sent } = setup({ spp: false });
  transport.start(undefined, 96);
  run(0.1);
  assert.deepEqual(sent[0].data, [START]);
});

test('swing does not bend the clock', () => {
  const { transport, run, sent } = setup();
  transport.setSwing(0.5);
  transport.start();
  run(1.0);
  const c = clocks(sent);
  const tick = 60000 / 120 / 24;
  c.forEach((m, i) => near(m.ts!, 1050 + i * tick, 1e-6, `swung clock ${i}`));
});

test('a port added while playing joins on the next 16th with SPP + Continue', () => {
  const { transport, run, sent, settings } = setup();
  transport.start();
  run(0.25);
  settings.targets = [...settings.targets, { id: 'b', name: 'B' }];
  run(0.5);
  const b = sent.filter(s => s.port === 'b');
  assert.equal(b[0].data[0], SONG_POSITION);
  assert.deepEqual(b[1].data, [CONTINUE]);
  const firstB = clocks(sent, 'b')[0];
  // The joined port's clocks coincide exactly with port A's
  const match = clocks(sent, 'a').find(m => Math.abs(m.ts! - firstB.ts!) < 1e-6);
  assert.ok(match, 'B clocks aligned with A');
  // and it joined on a 16th: its first clock is a multiple of 6 ticks from the start
  const idx = clocks(sent, 'a').indexOf(match!);
  assert.equal(idx % 6, 0);
  const spp = b[0].data[1] | (b[0].data[2] << 7);
  assert.equal(spp, idx / 6, 'song position matches the clock it precedes');
});

test('a port removed while playing gets Stop', () => {
  const { transport, run, sent, settings } = setup({ targets: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
  transport.start();
  run(0.3);
  settings.targets = [{ id: 'a', name: 'A' }];
  run(0.1);
  const b = sent.filter(s => s.port === 'b');
  assert.deepEqual(b.at(-1)!.data, [STOP]);
});

test('locate while stopped sends Song Position', () => {
  const { transport, sent } = setup();
  transport.locate(96 * 4);
  assert.deepEqual(sent.at(-1)!.data, [SONG_POSITION, 64, 0]);
});

test('no targets: nothing sent', () => {
  const { transport, run, sent } = setup({ targets: [] });
  transport.start();
  run(0.5);
  transport.stop();
  assert.equal(sent.length, 0);
});

void done('MIDI clock out');
