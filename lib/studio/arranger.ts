// ============================================================================
// Song arranger playback.
// While the studio transport runs with song mode on, at every section start
// (always a bar boundary) it switches each instrument to its part: a pattern
// (Elektron-style instruments), a knob snapshot (analog gear without memory),
// or mute. Timing comes from the transport's audio-clock ticks.
// ============================================================================

import { transport, PPQN, type TransportTick } from '@/lib/audio/transport';
import { getAudioContext } from '@/lib/audio/context';
import { useStudioStore, type ArrangementSection } from '@/store/studio';
import { hub } from './hub';

type Listener = (state: { section: number; bar: number }) => void;

class ArrangementPlayer {
  private listeners = new Set<Listener>();
  private section = -1;
  private started = false;
  state = { section: -1, bar: 0 };

  init() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    transport.onEvent(e => {
      if (e.type === 'start') this.section = -1;
      if (e.type === 'stop') this.publish(-1, 0);
    });
    transport.onTick(t => this.onTick(t));
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    l(this.state);
    return () => this.listeners.delete(l);
  }

  private publish(section: number, bar: number) {
    this.state = { section, bar };
    this.listeners.forEach(l => l(this.state));
  }

  private onTick(t: TransportTick) {
    if (t.tick % (PPQN * 4) !== 0) return; // bar boundaries only
    const arr = useStudioStore.getState().studio.arrangement;
    if (!arr.enabled || !arr.sections.length) return;
    const total = arr.sections.reduce((n, s) => n + Math.max(1, s.bars), 0);
    let bar = t.bar;
    if (bar >= total) {
      if (!arr.loop) {
        const delay = Math.max(0, (t.time - getAudioContext().currentTime) * 1000);
        setTimeout(() => transport.stop(), delay);
        return;
      }
      bar %= total;
    }
    let acc = 0;
    let idx = 0;
    for (; idx < arr.sections.length; idx++) {
      const len = Math.max(1, arr.sections[idx].bars);
      if (bar < acc + len) break;
      acc += len;
    }
    if (idx !== this.section) {
      this.section = idx;
      this.applySection(arr.sections[idx], t.time);
    }
    const delay = Math.max(0, (t.time - getAudioContext().currentTime) * 1000);
    const barInSection = bar - acc;
    setTimeout(() => this.publish(idx, barInSection), delay);
  }

  /** Start playback at the top of a section */
  playFrom(sectionIndex: number) {
    if (transport.playing) transport.stop();
    this.section = -1;
    transport.start(undefined, this.barsBefore(sectionIndex) * PPQN * 4);
  }

  private applySection(section: ArrangementSection, time: number) {
    const store = useStudioStore.getState();
    store.studio.rack.forEach(slot => {
      const part = section.parts[slot.id];
      hub.setMuted(slot.id, !!part?.muted, time);
      if (!part) return;
      if (part.pattern) hub.event(slot.id, 'arranger:pattern', { id: part.pattern, time });
      if (part.snapshot) {
        const delay = Math.max(0, (time - getAudioContext().currentTime) * 1000 - 5);
        const snap = part.snapshot;
        setTimeout(() => useStudioStore.getState().setControlValues(slot.id, snap), delay);
      }
    });
  }

  /** Bars before a section starts (for "play from here") */
  barsBefore(sectionIndex: number): number {
    const arr = useStudioStore.getState().studio.arrangement;
    return arr.sections.slice(0, sectionIndex).reduce((n, s) => n + s.bars, 0);
  }
}

export const arranger = new ArrangementPlayer();
