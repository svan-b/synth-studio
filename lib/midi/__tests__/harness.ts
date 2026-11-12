// Minimal test harness for `npx tsx lib/midi/__tests__/<file>.test.ts` (no test runner needed)
import { Transport } from '@/lib/audio/transport';

let failures = 0;
let passes = 0;

export function test(name: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      passes++;
      console.log(`  ok   ${name}`);
    } catch (e) {
      failures++;
      console.log(`  FAIL ${name}\n       ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    }
  };
  queue.push(run);
}

const queue: (() => Promise<void>)[] = [];

export async function done(suite: string) {
  console.log(suite);
  for (const q of queue) await q();
  console.log(`${passes} passed, ${failures} failed`);
  if (failures) process.exit(1);
}

/** An AudioContext stand-in whose clock the test advances by hand */
export class FakeClock {
  currentTime = 0;
  baseLatency = 0;
  outputLatency = 0;
  /** performance.now() stand-in, kept in lockstep with currentTime */
  nowMs = 1000;
  advance(seconds: number) {
    this.currentTime += seconds;
    this.nowMs += seconds * 1000;
  }
  now = () => this.nowMs;
}

/** A Transport driven by a FakeClock: no timers, the test pumps it */
export function manualTransport(clock: FakeClock) {
  const t = new Transport();
  t.attach(clock as unknown as BaseAudioContext);
  const internals = t as unknown as { timer: ReturnType<typeof setInterval> | null; pump: () => void };
  const start = t.start.bind(t);
  t.start = (atTime?: number, fromTick = 0) => {
    start(atTime, fromTick);
    if (internals.timer) clearInterval(internals.timer);
    internals.timer = null;
  };
  const stop = t.stop.bind(t);
  t.stop = () => {
    // stop() clears the (already cleared) timer itself; just keep it consistent
    stop();
  };
  /** Advance the clock in 20 ms steps (the transport's own interval), pumping each step */
  const run = (seconds: number, step = 0.02, each?: () => void) => {
    const n = Math.round(seconds / step);
    for (let i = 0; i < n; i++) {
      clock.advance(step);
      internals.pump();
      each?.();
    }
  };
  return { transport: t, run, pump: () => internals.pump() };
}

export function near(actual: number, expected: number, tol: number, what = 'value') {
  if (Math.abs(actual - expected) > tol) throw new Error(`${what}: expected ${expected} ± ${tol}, got ${actual}`);
}
