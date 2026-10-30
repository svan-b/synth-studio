// ============================================================================
// Web Audio plugin engine: hosts one WAM 2 plugin (or a built-in plugin) as a
// studio instrument.
//
//   IN jack (+ test sound) -> [plugin] -> LEVEL -> main output (routable) + OUT jack
//   notes / MIDI input -> audioNode.scheduleEvents({ type: 'wam-midi', ... })
//   studio transport   -> 'wam-transport' events (tempo-synced plugins)
//
// Loading is guarded: a newer URL (or dispose) wins over a slow older load,
// and plugins from sites this browser hasn't trusted wait for a yes. Built-in
// plugins (lib/wam/builtin.ts) load instantly, offline, with nothing to trust.
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine } from '@/lib/audio/engine';
import { getNoiseBuffer } from '@/lib/audio/dsp';
import { PPQN, transport as studioTransport, type Transport } from '@/lib/audio/transport';
import { isChannelMessage } from '@/lib/midi/bytes';
import type { MidiReceiver } from '@/lib/midi/router';
import { destroyWam, loadWam, wamMidi, wamTransport, type LoadedWam } from '@/lib/wam/host';
import { createBuiltin, isBuiltin } from '@/lib/wam/builtin';
import { isTrusted, originOf } from '@/lib/wam/trust';
import { asWamData, initialWamData, jsonState, type WamData } from './config';

export type PluginStatus = 'empty' | 'untrusted' | 'loading' | 'ready' | 'error';

const dbToGain = (db: number) => Math.pow(10, db / 20);

export class WamPluginEngine extends BaseEngine implements MidiReceiver {
  private cfg: WamData = initialWamData();
  private wam: LoadedWam | null = null;
  private loadSeq = 0;
  private loadedUrl: string | null = null;
  private input!: GainNode;
  private level!: GainNode;
  private meter!: AnalyserNode;
  private meterBuf = new Float32Array(1024);
  private gui: Element | null = null;
  private held = new Set<number>();
  private transportUnsubs: (() => void)[] = [];
  private bypassed = false;
  private testTimers: ReturnType<typeof setTimeout>[] = [];
  private testUntil = 0;
  private riffTimers: ReturnType<typeof setTimeout>[] = [];

  protected build(): void {
    this.input = this.ctx.createGain();
    this.level = this.ctx.createGain();
    this.level.connect(this.out);
    this.meter = this.ctx.createAnalyser();
    this.meter.fftSize = 1024;
    this.level.connect(this.meter);
    this.inputs = { in: { node: this.input } };
    this.outputs = { out: { node: this.level } };
    this.onDispose(() => {
      this.loadSeq++;
      this.stopTestSound();
      this.stopRiff();
      this.closeGui();
      this.unload();
      this.transportUnsubs.forEach(u => u());
    });
    this.emit({ status: 'empty' as PluginStatus, testing: false });
  }

  protected onParam(id: string, value: ControlValue): void {
    if (id === 'level') this.level.gain.setTargetAtTime(dbToGain(Number(value)), this.ctx.currentTime, 0.01);
    if (id === 'bypass') {
      this.bypassed = !!value;
      this.wire();
    }
  }

  protected onData(data: unknown): void {
    this.cfg = asWamData(data);
    if (this.cfg.url !== this.loadedUrl) void this.load();
  }

  /** Panel buttons: 'load' retries (or loads after you trusted the site); auditions and the test sound */
  event(name: string): void {
    if (name === 'load') void this.load();
    if (name === 'panic') this.allNotesOff();
    if (name === 'test-sound') {
      if (this.testUntil > this.ctx.currentTime) this.stopTestSound();
      else this.playTestSound(4);
    }
    if (name === 'audition') {
      // Instruments play a riff; effects (or nothing loaded) get the test sound into IN
      if (this.wam?.isInstrument) this.playRiff();
      else this.playTestSound(2);
    }
    if (name === 'audition:stop') { this.stopTestSound(); this.stopRiff(); }
  }

  /** Output peak (0..1) of the last ~20 ms, for the panel meter */
  levels(): number {
    if (!this.started) return 0;
    this.meter.getFloatTimeDomainData(this.meterBuf);
    let p = 0;
    for (let i = 0; i < this.meterBuf.length; i++) { const v = Math.abs(this.meterBuf[i]); if (v > p) p = v; }
    return p;
  }

  // --------------------------------------------------------------------------
  // Loading
  // --------------------------------------------------------------------------

  private async load() {
    const url = this.cfg.url;
    const seq = ++this.loadSeq;
    this.loadedUrl = url;
    this.closeGui();
    this.unload();
    if (!url) {
      this.emit({ status: 'empty' as PluginStatus, error: null, plugin: null, url: null });
      return;
    }
    if (isBuiltin(url)) {
      const w = createBuiltin(url, this.ctx, this.cfg.state);
      this.ready(w, url);
      return;
    }
    if (!isTrusted(url)) {
      this.emit({ status: 'untrusted' as PluginStatus, error: null, plugin: null, origin: originOf(url), url });
      return;
    }
    this.emit({ status: 'loading' as PluginStatus, error: null, plugin: null, url });
    try {
      const w = await loadWam(url, this.ctx, { state: this.cfg.state });
      if (seq !== this.loadSeq || !this.started) {
        destroyWam(w);
        return;
      }
      this.ready(w, url);
    } catch (e) {
      if (seq !== this.loadSeq) return;
      this.emit({ status: 'error' as PluginStatus, error: e instanceof Error ? e.message : String(e), plugin: null, url });
    }
  }

  private ready(w: LoadedWam, url: string) {
    this.wam = w;
    this.wire();
    this.emit({
      status: 'ready' as PluginStatus,
      url,
      error: null,
      plugin: {
        name: w.name, vendor: w.vendor, description: w.description, isInstrument: w.isInstrument,
        hasAudioInput: w.hasAudioInput, hasMidiInput: w.hasMidiInput, builtin: !!w.builtin,
      },
    });
    if (this.transport) this.sendTransport(this.transport, this.ctx.currentTime);
  }

  /** (Re)connect input -> plugin -> level, or input -> level when bypassed / no plugin */
  private wire() {
    if (!this.started) return;
    try { this.input.disconnect(); } catch { /* */ }
    const w = this.wam;
    const out = w ? w.output ?? w.node : null;
    if (out) { try { out.disconnect(); } catch { /* */ } }
    if (!w || !out || this.bypassed) {
      // An effect with nothing loaded (or bypassed) passes its input straight through
      if (!w || w.hasAudioInput) this.input.connect(this.level);
      return;
    }
    try {
      if (w.hasAudioInput) this.input.connect(w.input ?? w.node);
    } catch { /* the plugin's node takes no audio after all */ }
    out.connect(this.level);
  }

  private unload() {
    this.allNotesOff();
    if (this.wam) {
      destroyWam(this.wam);
      this.wam = null;
    }
    this.wire();
  }

  // --------------------------------------------------------------------------
  // MIDI
  // --------------------------------------------------------------------------

  private schedule(bytes: ArrayLike<number>, time = this.ctx?.currentTime ?? 0) {
    if (!this.wam) return;
    try { this.wam.node.scheduleEvents(wamMidi(bytes, time)); } catch { /* plugin without MIDI */ }
  }

  noteOn(note: number, velocity = 1): void {
    this.held.add(note);
    this.schedule([0x90, note & 0x7f, Math.max(1, Math.min(127, Math.round(velocity * 127)))]);
  }

  noteOff(note: number): void {
    this.held.delete(note);
    this.schedule([0x80, note & 0x7f, 0]);
  }

  /** MIDI input routed here: bend, CCs, aftertouch... go to the plugin as they are */
  receiveMidi(data: number[] | Uint8Array): void {
    if (isChannelMessage(data)) this.schedule(data);
  }

  private allNotesOff() {
    this.held.forEach(n => this.schedule([0x80, n, 0]));
    this.held.clear();
  }

  private playRiff() {
    this.stopRiff();
    const notes = [48, 55, 60, 63, 60, 55];
    notes.forEach((n, i) => {
      this.riffTimers.push(setTimeout(() => this.noteOn(n, 0.9), i * 300));
      this.riffTimers.push(setTimeout(() => this.noteOff(n), i * 300 + 230));
    });
  }

  private stopRiff() {
    this.riffTimers.forEach(t => clearTimeout(t));
    this.riffTimers = [];
    this.allNotesOff();
  }

  // --------------------------------------------------------------------------
  // Test sound: a short groove into IN, so an effect can be heard with nothing patched
  // --------------------------------------------------------------------------

  private playTestSound(bars: number) {
    this.stopTestSound();
    const ctx = this.ctx;
    const beat = 60 / studioTransport.bpm;
    const t0 = ctx.currentTime + 0.05;
    const noise = getNoiseBuffer(ctx);
    const hit = (t: number, kind: 'kick' | 'hat' | 'stab', note = 60) => {
      if (kind === 'kick') {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
        g.gain.setValueAtTime(0.32, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.connect(g).connect(this.input);
        o.start(t);
        o.stop(t + 0.4);
        o.onended = () => g.disconnect();
      } else if (kind === 'hat') {
        const s = ctx.createBufferSource();
        s.buffer = noise;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 7500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        s.connect(hp).connect(g).connect(this.input);
        s.start(t, Math.random(), 0.08);
        s.onended = () => { hp.disconnect(); g.disconnect(); };
      } else {
        [0, 3, 7].forEach(iv => {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = 440 * Math.pow(2, (note + iv - 69) / 12);
          const lp = ctx.createBiquadFilter();
          lp.frequency.setValueAtTime(3200, t);
          lp.frequency.exponentialRampToValueAtTime(500, t + 0.2);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.04, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          o.connect(lp).connect(g).connect(this.input);
          o.start(t);
          o.stop(t + 0.25);
          o.onended = () => { lp.disconnect(); g.disconnect(); };
        });
      }
    };
    for (let b = 0; b < bars * 4; b++) {
      const t = t0 + b * beat;
      hit(t, 'kick');
      hit(t + beat / 2, 'hat');
      if (b % 4 === 0) hit(t, 'stab', 60);
      if (b % 4 === 2) hit(t + beat * 0.75, 'stab', 58);
    }
    this.testUntil = t0 + bars * 4 * beat;
    this.emit({ testing: true });
    this.testTimers.push(setTimeout(() => { this.testUntil = 0; this.emit({ testing: false }); }, (this.testUntil - ctx.currentTime) * 1000 + 300));
  }

  private stopTestSound() {
    this.testTimers.forEach(t => clearTimeout(t));
    this.testTimers = [];
    if (this.testUntil) {
      // Scheduled hits still play out; cut them at the input
      const t = this.ctx.currentTime;
      this.input.gain.cancelScheduledValues(t);
      this.input.gain.setTargetAtTime(0, t, 0.01);
      this.input.gain.setTargetAtTime(1, t + 0.6, 0.01);
    }
    this.testUntil = 0;
    this.emit({ testing: false });
  }

  // --------------------------------------------------------------------------
  // Studio transport -> wam-transport
  // --------------------------------------------------------------------------

  private transportEvent(bar: number, barStarted: number, tempo: number, playing: boolean, time: number) {
    if (!this.wam) return;
    try {
      this.wam.node.scheduleEvents(wamTransport({
        currentBar: bar, currentBarStarted: barStarted, tempo, timeSigNumerator: 4, timeSigDenominator: 4, playing,
      }, time));
    } catch { /* plugin ignores transport */ }
  }

  /** Current studio state, e.g. right after a plugin loads */
  private sendTransport(t: Transport, time: number) {
    const bar = Math.floor(t.position / (PPQN * 4));
    this.transportEvent(bar, t.playing ? t.timeOfTick(bar * PPQN * 4) : time, t.bpm, t.playing, time);
  }

  protected onTransport(t: Transport | null): void {
    this.transportUnsubs.forEach(u => u());
    this.transportUnsubs = [];
    if (!t) return;
    this.transportUnsubs.push(t.onEvent(e => {
      if (e.type === 'start') this.transportEvent(Math.floor(t.position / (PPQN * 4)), e.time, t.bpm, true, e.time);
      else if (e.type === 'stop') this.transportEvent(Math.floor(t.position / (PPQN * 4)), e.time, t.bpm, false, e.time);
      else if (e.type === 'tempo') this.sendTransport(t, this.ctx.currentTime);
    }));
    // Every bar line keeps the plugin's idea of the position exact
    this.transportUnsubs.push(t.onTick(tick => {
      if (tick.tick % (PPQN * 4) === 0) this.transportEvent(tick.bar, tick.time, t.bpm, true, tick.time);
    }));
    this.sendTransport(t, this.ctx.currentTime);
  }

  // --------------------------------------------------------------------------
  // Plugin window and state
  // --------------------------------------------------------------------------

  get loaded(): boolean {
    return !!this.wam;
  }

  /** Put the plugin's own GUI into `host` */
  async openGui(host: HTMLElement): Promise<void> {
    const w = this.wam;
    if (!w) throw new Error('No plugin is loaded.');
    this.closeGui();
    const gui = await w.instance.createGui();
    if (!gui) throw new Error('This plugin has no window of its own.');
    if (this.wam !== w) { try { w.instance.destroyGui(gui); } catch { /* */ } return; }
    host.appendChild(gui);
    this.gui = gui;
  }

  closeGui() {
    const gui = this.gui;
    this.gui = null;
    if (!gui) return;
    try { this.wam?.instance.destroyGui(gui); } catch { /* */ }
    gui.remove();
  }

  /** The plugin's state if it is plain JSON (saved with the project) */
  async saveState(): Promise<unknown | undefined> {
    if (!this.wam) return undefined;
    try {
      return jsonState(await this.wam.node.getState());
    } catch {
      return undefined;
    }
  }
}
