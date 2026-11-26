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

/**
 * "primary" means continue, "secondary" means again or back. "pedal" is the
 * right pedal going down: on a screen with no music it means continue too,
 * since that pedal is the one every piano has. While music is on the stand it
 * stays a pedal.
 */
export type RemoteAction = 'primary' | 'secondary' | 'pedal';

/** How long the keys must have been still before the right pedal counts as a button. */
const QUIET_MS = 1200;

/** The longest a key is taken to be held down. Past this, its release is taken to have been lost. */
const HELD_AT_MOST = 20_000;

/** How far down a pedal must go to count as pressed, and how far up to count as let go, from 0 to 1. */
const PEDAL_DOWN = 80 / 127;
const PEDAL_UP = 40 / 127;

export function isRemoteKey(note: number): boolean {
  return note === REMOTE_PRIMARY || note === REMOTE_SECONDARY;
}

class InputHub {
  /** "primary" means continue or start. "secondary" means again or back. */
  readonly remote = new Emitter<RemoteAction>();
  remoteKeys = true;
  remotePedals = true;
  private lastRemote = -Infinity;
  /** Keys held down now, and when one last went down: the right pedal is a button only away from playing. */
  private held = new Map<number, number>();
  private lastKey = -Infinity;
  /** Keys played since music went on the stand to be played. While there are some, every pedal is a pedal. */
  private keysThisRun = 0;
  private pedalDown: Record<string, boolean> = {};

  constructor() {
    noteBus.subscribe((ev) => {
      if (ev.source === 'midi' && !isRemoteKey(ev.midi)) {
        if (ev.type === 'on') {
          this.held.set(ev.midi, performance.now());
          this.lastKey = performance.now();
          if (this.expected !== null) this.keysThisRun += 1;
        } else this.held.delete(ev.midi);
      }
      if (ev.type !== 'on' || ev.source !== 'midi' || !this.remoteKeys) return;
      if (ev.midi === REMOTE_PRIMARY) this.fire('primary');
      else if (ev.midi === REMOTE_SECONDARY) this.fire('secondary');
    });
    midi.pedals.subscribe((ev) => {
      // A pedal that reports how far down it is sends a stream of values on the way down and
      // on the way up. One press is one press: it counts when the pedal passes well down, and
      // not again until it has come well up. A foot resting half way does nothing.
      const was = this.pedalDown[ev.pedal] === true;
      const now = was ? ev.value > PEDAL_UP : ev.value >= PEDAL_DOWN;
      this.pedalDown[ev.pedal] = now;
      if (!this.remotePedals || was || !now) return;
      // In the middle of playing something, a pedal is a pedal: the soft pedal in a quiet passage must not
      // start the music again, nor the middle one skip it. Before the first note and after the last they are buttons.
      if (this.holding() || (this.expected !== null && this.keysThisRun > 0)) return;
      // Middle pedal continues, left pedal repeats.
      if (ev.pedal === 'sostenuto') this.fire('primary');
      else if (ev.pedal === 'soft') this.fire('secondary');
      // Someone trying a few notes with the pedal down is playing, not turning the page.
      else if (ev.pedal === 'sustain' && performance.now() - this.lastKey > QUIET_MS) this.fire('pedal');
    });
    // A Bluetooth page turning pedal, the kind used with sheet music readers,
    // is a keyboard to the iPad: it sends arrow or page keys. Forward means
    // continue and back means again, so such a pedal works with nothing to set up.
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName ?? '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
        const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown';
        const backward = e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp';
        // Space and Return also mean continue, unless a button has the focus and will take them itself.
        const plain = (e.key === ' ' || e.key === 'Enter') && (tag === 'BODY' || tag === 'HTML' || tag === '');
        if (!forward && !backward && !plain) return;
        // On a page where these keys do nothing for the app, they scroll it as they always do.
        if (this.remote.size === 0) return;
        e.preventDefault();
        this.fire(backward ? 'secondary' : 'primary');
      });
    }
  }

  /**
   * Whether a key is down. A key whose release never arrived, as when a Bluetooth message is lost,
   * is not taken to be held for ever: that would switch the pedals off as buttons for good.
   */
  private holding(): boolean {
    const now = performance.now();
    this.held.forEach((since, key) => {
      if (now - since > HELD_AT_MOST) this.held.delete(key);
    });
    return this.held.size > 0;
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

  /** The notes the current activity is waiting for, if any. */
  expected: number[] | null = null;

  /** Tell the listening input which notes the music expects next. */
  expect(notes: number[] | null): void {
    // Music going on the stand, or coming off it, starts the count of keys played to it afresh.
    if ((notes === null) !== (this.expected === null)) this.keysThisRun = 0;
    this.expected = notes;
    listener.expect(notes);
  }
}

export const input = new InputHub();
