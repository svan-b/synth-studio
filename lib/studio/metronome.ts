// ============================================================================
// Metronome and count-in. Clicks go to the monitor bus - straight to the
// speakers, never into the master, the meters or a recording (like a DAW's
// click). Scheduled on the audio clock from transport ticks.
// ============================================================================

import { transport, PPQN } from '@/lib/audio/transport';
import { getAudioContext, getMonitorBus } from '@/lib/audio/context';
import { useStudioStore } from '@/store/studio';

class Metronome {
  private started = false;
  private pending: { osc: OscillatorNode; time: number }[] = [];
  private countInEnd = 0;
  private countInListeners = new Set<() => void>();

  init() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    transport.onTick(t => {
      if (t.tick % PPQN !== 0) return;
      if (!useStudioStore.getState().studio.metronome?.click) return;
      this.click(t.time, t.tick % (PPQN * 4) === 0);
    });
    transport.onEvent(e => { if (e.type === 'stop') this.cancel(e.time); });
  }

  /** One bar of clicks ending at `downbeat` (audio time) */
  countIn(downbeat: number, bpm: number, beats = 4) {
    const beat = 60 / bpm;
    for (let i = 0; i < beats; i++) this.click(downbeat - (beats - i) * beat, i === 0, true);
    this.countInEnd = downbeat;
    this.countInListeners.forEach(l => l());
  }

  /** Audio time the running count-in ends (0 if none) */
  get countInUntil() {
    return this.countInEnd > getAudioContext().currentTime ? this.countInEnd : 0;
  }

  onCountIn(l: () => void): () => void {
    this.countInListeners.add(l);
    return () => this.countInListeners.delete(l);
  }

  /** Stop clicks that haven't sounded yet, or only those at/after `from` (a song's end) */
  cancel(from?: number) {
    const t = Math.max(getAudioContext().currentTime, from ?? 0);
    this.pending.forEach(p => { if (p.time >= t) { try { p.osc.stop(); } catch { /* */ } } });
    this.pending = this.pending.filter(p => p.time < t);
    if (!from) this.countInEnd = 0;
    this.countInListeners.forEach(l => l());
  }

  private click(time: number, accent: boolean, countIn = false) {
    const ctx = getAudioContext();
    if (time < ctx.currentTime) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = accent ? 1760 : 1320;
    const level = countIn ? (accent ? 0.4 : 0.28) : accent ? 0.35 : 0.22;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(level, time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    o.connect(g).connect(getMonitorBus());
    o.start(time);
    o.stop(time + 0.06);
    this.pending.push({ osc: o, time });
    if (this.pending.length > 64) this.pending = this.pending.filter(p => p.time > ctx.currentTime);
  }
}

export const metronome = new Metronome();
