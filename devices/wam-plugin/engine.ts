// ============================================================================
// Web Audio plugin engine: hosts one WAM 2 plugin as a studio instrument.
//
//   IN jack -> [plugin audioNode] -> LEVEL -> main output (routable) + OUT jack
//   notes / MIDI input -> audioNode.scheduleEvents({ type: 'wam-midi', ... })
//   studio transport   -> 'wam-transport' events (tempo-synced plugins)
//
// Loading is guarded: a newer URL (or dispose) wins over a slow older load,
// and plugins from sites this browser hasn't trusted wait for a yes.
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine } from '@/lib/audio/engine';
import { PPQN, type Transport } from '@/lib/audio/transport';
import { isChannelMessage } from '@/lib/midi/bytes';
import type { MidiReceiver } from '@/lib/midi/router';
import { destroyWam, loadWam, wamMidi, wamTransport, type LoadedWam } from '@/lib/wam/host';
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
  private gui: Element | null = null;
  private held = new Set<number>();
  private transportUnsubs: (() => void)[] = [];
  private bypassed = false;

  protected build(): void {
    this.input = this.ctx.createGain();
    this.level = this.ctx.createGain();
    this.level.connect(this.out);
    this.inputs = { in: { node: this.input } };
    this.outputs = { out: { node: this.level } };
    this.onDispose(() => {
      this.loadSeq++;
      this.closeGui();
      this.unload();
      this.transportUnsubs.forEach(u => u());
    });
    this.emit({ status: 'empty' as PluginStatus });
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

  /** Panel buttons: 'load' retries (or loads after you trusted the site) */
  event(name: string): void {
    if (name === 'load') void this.load();
    if (name === 'panic') this.allNotesOff();
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
      this.wam = w;
      this.wire();
      this.emit({
        status: 'ready' as PluginStatus,
        url,
        error: null,
        plugin: { name: w.name, vendor: w.vendor, description: w.description, isInstrument: w.isInstrument, hasAudioInput: w.hasAudioInput, hasMidiInput: w.hasMidiInput },
      });
      if (this.transport) this.sendTransport(this.transport, this.ctx.currentTime);
    } catch (e) {
      if (seq !== this.loadSeq) return;
      this.emit({ status: 'error' as PluginStatus, error: e instanceof Error ? e.message : String(e), plugin: null, url });
    }
  }

  /** (Re)connect input -> plugin -> level, or input -> level when bypassed / no plugin */
  private wire() {
    if (!this.started) return;
    try { this.input.disconnect(); } catch { /* */ }
    const w = this.wam;
    if (w) { try { w.node.disconnect(); } catch { /* */ } }
    if (!w || this.bypassed) {
      // An effect with nothing loaded (or bypassed) passes its input straight through
      if (!w || w.hasAudioInput) this.input.connect(this.level);
      return;
    }
    try {
      if (w.hasAudioInput) this.input.connect(w.node);
    } catch { /* the plugin's node takes no audio after all */ }
    w.node.connect(this.level);
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
