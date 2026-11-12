/**
 * A robot pianist for development and automated checks. It plays whatever
 * the running session expects, through the same MIDI path a real piano
 * uses, optionally with mistakes.
 */

import { piano } from '../audio/engine';
import { activeFlow, type FlowSession } from '../engine/flow';
import { midi } from '../input/midi';

export interface RobotOptions {
  /** Play a wrong key before every Nth step. 0 for none. */
  wrongEvery?: number;
  /** Milliseconds between steps in wait mode. */
  gapMs?: number;
  /** Shift every note by this many milliseconds in tempo mode. */
  offsetMs?: number;
  /** Skip every Nth note in tempo mode. 0 for none. */
  missEvery?: number;
  /** Key velocity, 1 to 127. */
  velocity?: number;
}

function key(note: number, velocity: number, holdMs = 70): void {
  midi.handleBytes(new Uint8Array([0x90, note, velocity]), performance.now(), 'robot');
  setTimeout(() => midi.handleBytes(new Uint8Array([0x80, note, 0]), performance.now(), 'robot'), holdMs);
}

function waitFor(test: () => boolean, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      if (test()) resolve(true);
      else if (performance.now() - start > timeoutMs) resolve(false);
      else setTimeout(tick, 25);
    };
    tick();
  });
}

/** Play the session that is running now. Resolves when it has finished. */
export async function playCurrent(opts: RobotOptions = {}): Promise<string> {
  const found = await waitFor(() => activeFlow.current !== null && activeFlow.current.phase !== 'ready', 6000);
  const session: FlowSession | null = activeFlow.current;
  if (!found || !session) return 'no session';
  const velocity = opts.velocity ?? 80;

  if (session.mode === 'wait') {
    const gap = opts.gapMs ?? 110;
    for (let i = 0; i < session.steps.length; i++) {
      if (session.phase !== 'playing') break;
      if (opts.wrongEvery && (i + 1) % opts.wrongEvery === 0) {
        key(session.steps[i].notes[0].midi + 1, velocity);
        await new Promise((r) => setTimeout(r, gap));
      }
      for (const n of session.steps[i].notes) key(n.midi, velocity);
      await new Promise((r) => setTimeout(r, gap));
    }
  } else {
    await waitFor(() => session.phase !== 'ready', 4000);
    const notes = session.steps.flatMap((s) => s.notes);
    const delay = piano.outputLatency() + session.latencyFor('midi') + (opts.offsetMs ?? 0) / 1000;
    notes.forEach((n, i) => {
      if (opts.missEvery && (i + 1) % opts.missEvery === 0) return;
      const at = session.targetTime(n) + delay;
      setTimeout(() => key(n.midi, velocity), Math.max(0, (at - piano.now()) * 1000));
    });
  }
  await waitFor(() => session.phase === 'done' || session.phase === 'stopped', 120000);
  return session.phase;
}
