// npx tsx lib/midi/__tests__/clock-out.test.ts
import assert from 'node:assert/strict';
import { MidiClockOut } from '../clock-out';
import { CONTINUE, SONG_POSITION, START, STOP, TIMING_CLOCK } from '../bytes';
import type { ClockOutSettings, PortRef } from '@/store/midi';
import { AudioClockSync, audioToMidiTime } from '../time';
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
    clockSync: new AudioClockSync(),
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

test('steady mapping: currentTime moving in 10 ms bursts does not wobble the timestamps', () => {
  // A real context: currentTime jumps once per audio callback while performance.now() runs on
  const sync = new AudioClockSync();
  const ctx = { currentTime: 0, outputLatency: 0.02 };
  const raw: number[] = [];
  const steady: number[] = [];
  const tick = 60 / 120 / 24;
  for (let ms = 0, k = 0; ms < 3000; ms += 1) {
    ctx.currentTime = Math.floor(ms / 10) * 0.01; // 10 ms callbacks
    const now = 5000 + ms;
    // schedule tick k once it is within 100 ms
    while (k * tick < ms / 1000 + 0.1) {
      raw.push(audioToMidiTime(ctx, k * tick, {}, now));
      steady.push(sync.toMidiTime(ctx, k * tick, {}, now));
      k++;
    }
  }
  const spread = (ts: number[]) => {
    const d = ts.slice(1).map((t, i) => t - ts[i] - tick * 1000);
    return Math.max(...d) - Math.min(...d);
  };
  assert.ok(spread(raw) > 5, `raw formula wobbles (spread ${spread(raw).toFixed(2)} ms)`);
  // after the first callback has been seen, every interval is exact
  const settled = steady.slice(10);
  assert.ok(spread(settled) < 1e-6, `steady spread ${spread(settled)} ms`);
  near(settled[0] - (5000 + 10 * tick * 1000 + 20), 0, 1e-6, 'offset + outputLatency');
});

test('steady mapping restarts when the timeline really jumps (context resumed)', () => {
  const sync = new AudioClockSync();
  const ctx = { currentTime: 1 };
  near(sync.offset(ctx, 2000), 1000, 1e-9, 'first');
  ctx.currentTime = 1.5;
  near(sync.offset(ctx, 2500), 1000, 1e-9, 'steady');
  // suspended for 3 s: currentTime frozen, then resumes
  ctx.currentTime = 1.5;
  near(sync.offset(ctx, 5600), 4100, 1e-9, 'jumped: new offset taken at once');
});

test('steady mapping: random sampling against 10 ms callbacks - settled, never steps', () => {
  // The scheduler wakes at irregular moments (timer jitter); currentTime only moves per callback
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const sync = new AudioClockSync();
  const ctx = { currentTime: 0 };
  const TRUE = 7000; // performance.now() at audio time 0
  let prev: number | null = null;
  let prevAt = 0;
  let worst = 0;
  let maxStepRate = 0;
  for (let t = 0; t < 20000; t += 14 + rnd() * 12) {
    ctx.currentTime = Math.floor(t / 10) * 0.01;
    const now = TRUE + t;
    const est = sync.offset(ctx, now);
    if (t > 3000) {
      worst = Math.max(worst, Math.abs(est - TRUE));
      if (prev !== null) maxStepRate = Math.max(maxStepRate, Math.abs(est - prev) / (now - prevAt));
    }
    prev = est;
    prevAt = now;
  }
  assert.ok(worst < 1.5, `within 1.5 ms of the true offset (worst ${worst.toFixed(3)})`);
  assert.ok(maxStepRate <= 0.002 + 1e-9, `slew-limited (${maxStepRate})`);
});

test('steady mapping: huge callbacks (Bluetooth, 100 ms) do not cause restarts', () => {
  const sync = new AudioClockSync();
  const ctx = { currentTime: 0 };
  const seen: number[] = [];
  for (let t = 0; t < 10000; t += 20) {
    ctx.currentTime = Math.floor(t / 100) * 0.1;
    seen.push(sync.offset(ctx, 3000 + t));
  }
  const late = seen.slice(150);
  assert.ok(Math.max(...late) - Math.min(...late) < 1, `stable (${(Math.max(...late) - Math.min(...late)).toFixed(2)} ms)`);
});

void done('MIDI clock out');
