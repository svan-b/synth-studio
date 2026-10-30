// ============================================================================
// DFAM audio engine
//
// The whole instrument runs in one AudioWorklet ('dfam', public/worklets/
// dfam-processors.js): two VCOs with linear FM and hard sync, noise / EXT AUDIO,
// mixer, 4-pole ladder (LP/HP), VCA, three velocity-scaled decay envelopes and
// the 8-step sequencer with its oscillator clock. This class only translates:
//
//   panel controls  -> port messages (model.ts knobMessage)
//   self-patches    -> the worklet's internal patch matrix (no Web Audio cycles)
//   other devices   -> a-rate params 'in0'..'in14' (1.0 = 5 V) and timed events
//   worklet reports -> UI state { step, playing, flash }
//
// Normals (hardware): sequencer clock -> TRIGGER in; VELOCITY 1-8 knobs ->
// VELOCITY in; noise -> EXT AUDIO (mixer) and -> VCF MOD (NOISE/VCF MOD);
// internal clock -> ADV/CLOCK. A cable in any of those jacks replaces the normal.
// ============================================================================

import type { ControlValue, PatchConnection } from '@/types';
import { BaseEngine } from '@/lib/audio/engine';
import { EVENT_INPUTS, INPUTS, NUM_INPUTS, NUM_OUTPUTS, OUTPUTS, internalRoutes, knobMessage } from './model';

type WorkletReport = { t: 's'; step: number; run: number; trig: number; time: number };

export class DfamEngine extends BaseEngine {
  private node!: AudioWorkletNode;
  private taps: GainNode[] = [];
  private split!: ChannelSplitterNode;
  /** Cables from other instruments per input (internal self-patches are counted separately) */
  private extCount = new Array<number>(NUM_INPUTS).fill(0);
  private intCount = new Array<number>(NUM_INPUTS).fill(0);
  private sentPatched = new Array<number>(NUM_INPUTS).fill(-1);
  private flashOffAt = 0;

  protected build(): void {
    const ctx = this.ctx;
    this.node = new AudioWorkletNode(ctx, 'dfam', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [NUM_OUTPUTS],
    });
    this.split = ctx.createChannelSplitter(NUM_OUTPUTS);
    this.node.connect(this.split);
    for (let o = 0; o < NUM_OUTPUTS; o++) {
      const g = ctx.createGain();
      this.split.connect(g, o);
      this.taps.push(g);
    }
    this.taps[OUTPUTS.out_vca].connect(this.out);
    this.node.port.onmessage = (e: MessageEvent<WorkletReport>) => this.onReport(e.data);

    this.outputs = {};
    Object.entries(OUTPUTS).forEach(([jack, ch]) => { this.outputs[jack] = { node: this.taps[ch] }; });

    this.inputs = {};
    Object.entries(INPUTS).forEach(([jack, j]) => {
      const ev = EVENT_INPUTS[jack];
      this.inputs[jack] = {
        params: [this.node.parameters.get(`in${j}`)!],
        onConnect: () => this.countExternal(j, 1),
        onDisconnect: () => this.countExternal(j, -1),
        // Clock / trigger / gate cables from other instruments may carry timed events too;
        // the worklet merges an event and an audio pulse that arrive together
        onEvent: ev ? (time, value) => this.post({ t: 'ev', ch: ev, time, v: value }) : undefined,
      };
    });

    this.onDispose(() => {
      this.node.port.onmessage = null;
      try { this.node.disconnect(); } catch { /* */ }
      try { this.split.disconnect(); } catch { /* */ }
      this.taps.forEach(t => { try { t.disconnect(); } catch { /* */ } });
    });
    this.emit({ playing: false, step: 7, flash: 0 });
  }

  private post(m: Record<string, unknown>) {
    this.node?.port.postMessage(m);
  }

  // --------------------------------------------------------------------------
  // Patching: self-patches become internal routes; normals follow the counts
  // --------------------------------------------------------------------------

  setPatches(connections: PatchConnection[]): void {
    // Before start the base class keeps them and calls us again from start()
    if (!this.started) { super.setPatches(connections); return; }
    const { routes, counts } = internalRoutes(connections);
    this.intCount = counts;
    this.post({ t: 'routes', routes });
    this.syncPatched();
  }

  private countExternal(j: number, delta: number) {
    this.extCount[j] = Math.max(0, this.extCount[j] + delta);
    this.syncPatched();
  }

  private syncPatched() {
    for (let j = 0; j < NUM_INPUTS; j++) {
      const on = this.extCount[j] + this.intCount[j] > 0 ? 1 : 0;
      if (on !== this.sentPatched[j]) {
        this.sentPatched[j] = on;
        this.post({ t: 'patched', i: j, v: on });
      }
    }
  }

  // --------------------------------------------------------------------------

  private onReport(m: WorkletReport) {
    if (m.t !== 's') return;
    const patch: Record<string, unknown> = { step: m.step, playing: !!m.run };
    if (m.trig) {
      patch.flash = 1;
      const off = this.ctx.currentTime + 0.07;
      this.flashOffAt = off;
      this.atTime(off, () => { if (this.flashOffAt === off) this.emit({ flash: 0 }); });
    }
    this.emit(patch);
  }

  event(name: string): void {
    if (!this.started) return;
    switch (name) {
      case 'trigger': this.post({ t: 'trig' }); break;
      case 'advance': this.post({ t: 'adv' }); break;
      case 'audition': this.post({ t: 'audition', v: 1 }); break;
      case 'audition:stop': this.post({ t: 'audition', v: 0 }); break;
    }
  }

  protected onParam(id: string, value: ControlValue): void {
    const msg = knobMessage(id, value);
    if (msg) this.post({ t: 'k', i: msg[0], v: msg[1] });
    if (id === 'run_stop') this.emit({ playing: !!value });
  }
}
