// npx tsx lib/midi/__tests__/clock-in.test.ts
// Simulates a hardware clock source (with timestamp jitter) and checks that the
// studio transport follows its tempo, start/stop and phase.
import assert from 'node:assert/strict';
import { MidiClockIn, fitBpm } from '../clock-in';
import { parseMidi } from '../bytes';
import { PPQN } from '@/lib/audio/transport';
import { FakeClock, done, manualTransport, near, test } from './harness';

/** Deterministic jitter */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

interface Ev { ts: number; data: number[] }

/** External clock: Start at `startMs`, clocks at `bpm` with ±jitter ms, optional tempo change */
function external(opts: { bpm: number; startMs: number; seconds: number; jitter?: number; change?: { atMs: number; bpm: number } }) {
  const r = rng(7);
  const evs: Ev[] = [];
  let t = opts.startMs - 300;
  // clock runs before Start too (most gear sends clock continuously)
  let bpm = opts.bpm;
  let started = false;
  const beats: number[] = []; // true times of each beat after Start
  let tick = 0;
  while (t < opts.startMs + opts.seconds * 1000) {
    if (!started && t >= opts.startMs) {
      evs.push({ ts: t - 0.5, data: [0xfa] });
      started = true;
      tick = 0;
    }
    const j = opts.jitter ? (r() - 0.5) * 2 * opts.jitter : 0;
    evs.push({ ts: t + j, data: [0xf8] });
    if (started) {
      if (tick % PPQN === 0) beats.push(t);
      tick++;
    }
    if (opts.change && t >= opts.change.atMs) bpm = opts.change.bpm;
    t += 60000 / bpm / PPQN;
  }
  return { evs, beats };
}

function simulate(evs: Ev[], seconds: number) {
  const clock = new FakeClock();
  clock.nowMs = 0;
  const { transport, run } = manualTransport(clock);
  const shown: number[] = [];
  const ci = new MidiClockIn({ transport, ctx: () => clock, now: clock.now, setDisplayBpm: b => { shown.push(b); transport.setBpm(Math.round(b * 10) / 10); } });
  ci.attach();
  const studioBeats: number[] = [];
  transport.onTick(t => { if (t.tick % PPQN === 0) studioBeats.push(t.time * 1000); });
  let i = 0;
  run(seconds, 0.005, () => {
    // Messages reach the main thread a little late; their OS timestamps are exact
    while (i < evs.length && evs[i].ts <= clock.nowMs) {
      ci.handle(parseMidi(evs[i].data)!, evs[i].ts);
      i++;
    }
  });
  return { transport, ci, studioBeats, shown, clock };
}

test('fitBpm recovers tempo from clean and jittery stamps', () => {
  const clean = Array.from({ length: 72 }, (_, i) => i * (60000 / 128 / 24));
  near(fitBpm(clean)!, 128, 1e-9, 'clean');
  const r = rng(3);
  const noisy = clean.map(t => t + (r() - 0.5) * 2);
  near(fitBpm(noisy)!, 128, 0.15, 'with ±1 ms jitter');
  assert.equal(fitBpm([0]), null);
});

test('follows tempo, Start and holds phase over 90 s (±1 ms jitter)', () => {
  const { evs, beats } = external({ bpm: 133.3, startMs: 2000, seconds: 90, jitter: 1 });
  const { transport, studioBeats, ci, shown } = simulate(evs, 93);
  assert.ok(transport.playing, 'transport started from the external Start');
  near(transport.bpm, 133.3, 0.15, 'tempo');
  assert.ok(shown.length > 0 && Math.abs(shown.at(-1)! - 133.3) < 0.15, 'display tempo updated');
  // Studio beat k vs external beat k: constant offset (the reaction latency), no drift
  const n = Math.min(beats.length, studioBeats.length);
  assert.ok(n > 190, `beats compared: ${n}`);
  const offsets = beats.slice(0, n).map((b, k) => studioBeats[k] - b);
  const early = offsets.slice(4, 12).reduce((a, b) => a + b, 0) / 8;
  const late = offsets.slice(n - 9, n - 1).reduce((a, b) => a + b, 0) / 8;
  assert.ok(early > 0 && early < 120, `studio follows shortly after the external clock (${early.toFixed(1)} ms)`);
  near(late, early, 3, 'phase drift over 90 s (ms)');
  assert.ok(ci.status().running);
});

test('follows a tempo change within a few beats', () => {
  const { evs } = external({ bpm: 120, startMs: 1000, seconds: 30, jitter: 0.5, change: { atMs: 15000, bpm: 90 } });
  const { transport } = simulate(evs, 31);
  near(transport.bpm, 90, 0.2, 'tempo after change');
});

test('Stop stops; Song Position + Continue resumes at that position', () => {
  const clock = new FakeClock();
  const { transport, run } = manualTransport(clock);
  const ci = new MidiClockIn({ transport, ctx: () => clock, now: clock.now });
  ci.attach();
  ci.handle({ type: 'start' }, clock.nowMs);
  assert.ok(transport.playing);
  run(0.5);
  ci.handle({ type: 'stop' }, clock.nowMs);
  assert.ok(!transport.playing);
  ci.handle({ type: 'songposition', position: 32 }, clock.nowMs);
  assert.equal(transport.position, 32 * 6, 'located to 2 bars');
  let first = -1;
  transport.onTick(t => { if (first < 0) first = t.tick; });
  ci.handle({ type: 'continue' }, clock.nowMs);
  run(0.1);
  assert.equal(first, 192, 'resumed at the song position');
});

test('tempo follows even while stopped; clock loss keeps the last tempo', () => {
  const { evs } = external({ bpm: 100, startMs: 1e9, seconds: 0, jitter: 0 }); // never starts
  // only pre-start clocks: 300 ms worth is too short - make a long free-running clock instead
  const clocks: Ev[] = [];
  for (let k = 0; k < 24 * 10; k++) clocks.push({ ts: 500 + k * (60000 / 100 / 24), data: [0xf8] });
  void evs;
  const { transport, ci } = simulate(clocks, 12);
  assert.ok(!transport.playing, 'no Start - not playing');
  near(transport.bpm, 100, 0.1, 'tempo');
  assert.equal(ci.status().receiving, false, 'clock lost after it stopped');
});

void done('MIDI clock in');
