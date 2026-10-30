// ============================================================================
// Moog Subharmonicon audio engine
//
// The whole instrument runs in one AudioWorklet ('subharmonicon', public/
// worklets/subharmonicon-processors.js): two VCOs with four true-divider
// subharmonics, the six-input mixer, a 2x oversampled 4-pole ladder, the VCF
// and VCA envelopes, four rhythm generators and two 4-step sequencers. This
// class only translates:
//
//   panel controls     -> port messages (model.ts knobMessage)
//   self-patches       -> the worklet's internal patch matrix (no Web Audio cycles)
//   other instruments  -> a 16-channel input (1.0 = 5 V), connected only while
//                         something is patched in, plus timed events
//   studio transport   -> MIDI-style start / stop / 16th-note clock events
//   worklet reports    -> UI state { steps, playing, leds }
//
// Normals (hardware): VCO 1 jack -> VCO 2 pitch; SUB 1 saw -> VCO pulse width
// (MIDDLE wave position), replaced by the PWM jack. The VCA and CUTOFF jacks
// are summed with their envelopes, not normalled.
//
// Clocking (REFERENCE.md): TEMPO (1 PPQ) < a cable in CLOCK < studio MIDI clock
// (16ths) - except that a cable in CLOCK keeps the clock while the studio still
// starts and stops PLAY, because the studio's MIDI-style sync is always plugged in.
// ============================================================================

import type { ControlValue, PatchConnection } from '@/types';
import { BaseEngine, type OutputJack } from '@/lib/audio/engine';
import { PPQN, type Transport } from '@/lib/audio/transport';
import { EVENT_INPUTS, INPUTS, NUM_INPUTS, NUM_OUTPUTS, OUTPUTS, internalRoutes, knobMessage } from './model';

type WorkletReport = { t: 's'; s1: number; s2: number; run: number; trig: number; rhy: number; midi: number; aud: number };



export class SubharmoniconEngine extends BaseEngine {
  private node!: AudioWorkletNode;
  private merger!: ChannelMergerNode;
  private inGains: GainNode[] = [];
  private split: ChannelSplitterNode | null = null;
  private taps: GainNode[] = [];
  private mergerConnected = false;
  private jacksOn = false;
  /** Cables from other instruments per input (internal self-patches are separate) */
  private extCount = new Array<number>(NUM_INPUTS).fill(0);
  private routes: [number, number, number][] = [];
  private unsubTransport: (() => void)[] = [];
  private flashOff = new Map<string, number>();
  private leds: Record<string, number> = {};

  protected build(): void {
    const ctx = this.ctx;
    this.node = new AudioWorkletNode(ctx, 'subharmonicon', {
      numberOfInputs: 1,
      numberOfOutputs: 2,
      outputChannelCount: [1, NUM_OUTPUTS],
      channelCount: NUM_INPUTS,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete',
    });
    this.node.connect(this.out, 0);
    this.node.port.onmessage = (e: MessageEvent<WorkletReport>) => this.onReport(e.data);

    // Inputs: one gain per jack into a 16-channel merger; the merger feeds the
    // worklet only while at least one cable from another instrument is in
    this.merger = ctx.createChannelMerger(NUM_INPUTS);
    for (let j = 0; j < NUM_INPUTS; j++) {
      const g = ctx.createGain();
      g.connect(this.merger, 0, j);
      this.inGains.push(g);
    }
    this.inputs = {};
    Object.entries(INPUTS).forEach(([jack, j]) => {
      const ev = EVENT_INPUTS[jack];
      this.inputs[jack] = {
        node: this.inGains[j],
        onConnect: () => this.countExternal(j, 1),
        onDisconnect: () => this.countExternal(j, -1),
        // Clock / trigger / gate cables from other instruments may carry timed events too;
        // the worklet merges an event and an audio pulse that arrive together
        onEvent: ev ? (time, value) => this.post({ t: 'ev', ch: ev, time, v: value }) : undefined,
      };
    });

    // Jack outputs: output 1 is split into taps the first time another instrument asks for a jack
    this.outputs = {};
    for (let o = 0; o < NUM_OUTPUTS; o++) this.taps.push(ctx.createGain());
    Object.entries(OUTPUTS).forEach(([jack, ch]) => { this.outputs[jack] = { node: this.taps[ch] }; });

    this.onDispose(() => {
      if (this.blinkTimer) { clearInterval(this.blinkTimer); this.blinkTimer = null; }
      this.unsubTransport.forEach(u => u());
      this.unsubTransport = [];
      this.node.port.onmessage = null;
      try { this.node.disconnect(); } catch { /* */ }
      try { this.merger.disconnect(); } catch { /* */ }
      this.inGains.forEach(g => { try { g.disconnect(); } catch { /* */ } });
      try { this.split?.disconnect(); } catch { /* */ }
      this.taps.forEach(t => { try { t.disconnect(); } catch { /* */ } });
    });
    this.emit({ playing: false, steps: { seq1: 0, seq2: 0 }, leds: {} });
  }

  private post(m: Record<string, unknown>) {
    this.node?.port.postMessage(m);
  }

  // --------------------------------------------------------------------------
  // Patching
  // --------------------------------------------------------------------------

  getOutput(jackId: string): OutputJack | undefined {
    const out = super.getOutput(jackId);
    if (out && !this.jacksOn && this.started) {
      // Another instrument is about to take a cable from a jack: start filling output 1
      this.jacksOn = true;
      this.split = this.ctx.createChannelSplitter(NUM_OUTPUTS);
      this.node.connect(this.split, 1);
      this.taps.forEach((t, o) => this.split!.connect(t, o));
      this.post({ t: 'jacks', v: 1 });
    }
    return out;
  }

  setPatches(connections: PatchConnection[]): void {
    // Before start the base class keeps them and calls us again from start()
    if (!this.started) { super.setPatches(connections); return; }
    this.routes = internalRoutes(connections).routes;
    this.sendPatch();
  }

  private countExternal(j: number, delta: number) {
    this.extCount[j] = Math.max(0, this.extCount[j] + delta);
    const any = this.extCount.some(c => c > 0);
    if (any && !this.mergerConnected) { this.merger.connect(this.node); this.mergerConnected = true; }
    else if (!any && this.mergerConnected) { try { this.merger.disconnect(this.node); } catch { /* */ } this.mergerConnected = false; }
    this.sendPatch();
  }

  private sendPatch() {
    this.post({ t: 'patch', ext: this.extCount.map(c => (c > 0 ? 1 : 0)), routes: this.routes });
  }

  // --------------------------------------------------------------------------
  // Studio transport: start / stop and one master count per 16th note, like MIDI clock
  // --------------------------------------------------------------------------

  protected onTransport(t: Transport | null): void {
    this.unsubTransport.forEach(u => u());
    this.unsubTransport = [];
    if (!t) {
      // Sync off: like pulling the MIDI cable, the internal clock takes over at the panel's PLAY state
      this.post({ t: 'ev', ch: 'midi-stop', time: 0 });
      this.post({ t: 'k', i: knobMessage('play', false)![0], v: this.bool('play') ? 1 : 0 });
      return;
    }
    // The worklet counts the 16ths itself from the transport's grid (it keeps time when the
    // page's timers are throttled); the grid is re-sent every beat and on tempo / locate
    const anchor = () => this.post({ t: 'sync', time: t.timeOfTick(t.position), tick: t.position, dur: t.tickDuration(), swing: t.swing });
    anchor();
    this.unsubTransport.push(t.onTick(tick => {
      if (tick.tick % PPQN === 0) this.post({ t: 'sync', time: tick.time, tick: tick.tick, dur: tick.tickDuration, swing: t.swing });
    }));
    this.unsubTransport.push(t.onEvent(e => {
      if (e.type === 'start') {
        this.post({ t: 'sync', time: e.time, tick: t.position, dur: t.tickDuration(), swing: t.swing });
        this.post({ t: 'ev', ch: 'midi-start', time: e.time, v: t.position });
      } else if (e.type === 'stop') this.post({ t: 'ev', ch: 'midi-stop', time: e.time });
      else if (e.type === 'tempo' || e.type === 'locate') anchor();
    }));
    // Joining a transport that is already running: start with it on the next beat
    if (t.playing) {
      const tick = Math.ceil(t.position / PPQN) * PPQN;
      this.post({ t: 'ev', ch: 'midi-start', time: t.timeOfTick(tick) - 0.0005, v: tick });
    }
  }

  // --------------------------------------------------------------------------
  // UI state
  // --------------------------------------------------------------------------

  private flash(id: string, ms = 70) {
    this.leds[id] = 1;
    const at = this.ctx.currentTime + ms / 1000;
    this.flashOff.set(id, at);
    this.atTime(at, () => {
      if (this.flashOff.get(id) !== at) return;
      this.leds[id] = 0;
      this.emit({ leds: { ...this.leds } });
    });
  }

  private onReport(m: WorkletReport) {
    if (m.t !== 's') return;
    if (m.trig) this.flash('trig');
    if (m.midi) this.flash('midi', 50);
    for (let r = 0; r < 4; r++) if (m.rhy & (1 << r)) this.flash(`r${r + 1}`, 90);
    this.emit({ steps: { seq1: m.s1, seq2: m.s2 }, playing: !!m.run, audition: !!m.aud, leds: { ...this.leds } });
  }

  // --------------------------------------------------------------------------
  // Buttons, keyboard (the computer keyboard stands in for MIDI IN)
  // --------------------------------------------------------------------------

  event(name: string): void {
    if (!this.started) return;
    switch (name) {
      case 'trigger': this.post({ t: 'btn', b: 'trigger-down' }); break;
      case 'trigger:up': this.post({ t: 'btn', b: 'trigger-up' }); break;
      case 'reset': this.post({ t: 'btn', b: 'reset-down' }); break;
      case 'reset:up': this.post({ t: 'btn', b: 'reset-up' }); break;
      case 'next': this.post({ t: 'btn', b: 'next' }); break;
      case 'audition': this.post({ t: 'audition', v: 1 }); break;
      case 'audition:stop': this.post({ t: 'audition', v: 0 }); break;
    }
  }

  noteOn(note: number): void {
    if (!this.started) return;
    this.post({ t: 'note', on: 1, n: note });
  }

  noteOff(note: number): void {
    if (!this.started) return;
    this.post({ t: 'note', on: 0, n: note });
  }

  protected onParam(id: string, value: ControlValue): void {
    // While following a running studio transport, PLAY mirrors it: the transport's
    // start / stop events run the sequencers, not the button (no double start)
    if (id === 'play' && value && this.transport?.playing) return;
    if (id === 'seq_oct_held' || id === 'quantize_held') this.setHeld(id, !!value);
    const msg = knobMessage(id, value);
    if (msg) this.post({ t: 'k', i: msg[0], v: msg[1] });
  }

  // --------------------------------------------------------------------------
  // SEQ OCT / QUANTIZE held: their lit LED flashes (2 Hz) while the mode is on
  // --------------------------------------------------------------------------

  private held = new Set<string>();
  private blinkTimer: ReturnType<typeof setInterval> | null = null;

  private setHeld(id: string, on: boolean) {
    if (on) this.held.add(id); else this.held.delete(id);
    if (this.held.size && !this.blinkTimer) {
      let phase = false;
      this.blinkTimer = setInterval(() => { phase = !phase; this.emit({ blink: phase }); }, 250);
    } else if (!this.held.size) this.stopBlink();
  }

  private stopBlink() {
    if (this.blinkTimer) { clearInterval(this.blinkTimer); this.blinkTimer = null; }
    this.emit({ blink: false });
  }
}
