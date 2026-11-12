/**
 * One place that knows how the learner is playing, and lets the piano
 * itself drive the app so hands can stay on the keys.
 */

import { Emitter } from '../util/emitter';
import { noteBus } from './bus';
import { listener } from './listen';
import { midi } from './midi';

export type InputMode = 'midi' | 'listen' | 'touch';

/** The very top and bottom keys of an 88 key piano act as buttons. */
export const REMOTE_PRIMARY = 108;
export const REMOTE_SECONDARY = 21;

export type RemoteAction = 'primary' | 'secondary';

export function isRemoteKey(note: number): boolean {
  return note === REMOTE_PRIMARY || note === REMOTE_SECONDARY;
}

class InputHub {
  /** "primary" means continue or start. "secondary" means again or back. */
  readonly remote = new Emitter<RemoteAction>();
  remoteKeys = true;
  remotePedals = true;
  private lastRemote = -Infinity;

  constructor() {
    noteBus.subscribe((ev) => {
      if (ev.type !== 'on' || ev.source !== 'midi' || !this.remoteKeys) return;
      if (ev.midi === REMOTE_PRIMARY) this.fire('primary');
      else if (ev.midi === REMOTE_SECONDARY) this.fire('secondary');
    });
    midi.pedals.subscribe((ev) => {
      if (!this.remotePedals || !ev.down) return;
      // Middle pedal continues, left pedal repeats. The right pedal stays a pedal.
      if (ev.pedal === 'sostenuto') this.fire('primary');
      else if (ev.pedal === 'soft') this.fire('secondary');
    });
  }

  private fire(action: RemoteAction): void {
    const now = performance.now();
    if (now - this.lastRemote < 350) return;
    this.lastRemote = now;
    this.remote.emit(action);
  }

  get mode(): InputMode {
    if (midi.connected) return 'midi';
    if (listener.active) return 'listen';
    return 'touch';
  }

  /** Tell the listening input which notes the music expects next. */
  expect(notes: number[] | null): void {
    listener.expect(notes);
  }
}

export const input = new InputHub();
