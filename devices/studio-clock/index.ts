// ============================================================================
// Studio Clock - the studio transport as patchable voltages.
// CLOCK OUT pulses at the chosen division, BEAT OUT on every quarter note,
// RESET OUT once when the transport starts, RUN OUT is high while playing.
// Patch CLOCK into DFAM ADV/CLOCK or Subharmonicon CLOCK IN to sync them -
// gear without MIDI is synced with clock pulses like this in real studios.
// ============================================================================

import type { ControlValue, DeviceSpec } from '@/types';
import type { PanelLayout } from '@/types/panel';
import type { DeviceModule } from '../types';
import { BaseEngine, EventBus } from '@/lib/audio/engine';
import { createConstant, pulse } from '@/lib/audio/dsp';
import { transport, PPQN, type Transport, type TransportTick } from '@/lib/audio/transport';

const DIVISIONS = ['1/4', '1/8', '1/16', '1/32', '1/8T', '1/16T'];
const TICKS_PER = [PPQN, PPQN / 2, PPQN / 4, PPQN / 8, PPQN / 3, PPQN / 6];

const spec: DeviceSpec = {
  id: 'studio-clock',
  name: 'Studio Clock',
  manufacturer: 'Synth Studio',
  description: 'The studio transport as clock, reset and run voltages',
  dimensions: { width: 101.6, height: 128.5 },
  display: { width: 300, height: 380, scale: 3 },
  signalFlow: [],
  controls: {
    division: {
      type: 'switch', label: 'CLOCK DIV', options: DIVISIONS, default: 2,
      description: 'How often CLOCK OUT pulses. 1/16 = four pulses per beat, the usual step clock.',
    },
    pulse_width: {
      type: 'knob', label: 'PULSE', min: 1, max: 50, default: 5, units: 'ms', size: 'small',
      description: 'Length of each clock pulse',
    },
  },
  patchBay: {
    inputs: [],
    outputs: [
      { id: 'out_clock', label: 'CLOCK', jackType: 'output', signalType: 'clock', column: 0, row: 0 },
      { id: 'out_beat', label: 'BEAT', jackType: 'output', signalType: 'clock', column: 1, row: 0 },
      { id: 'out_reset', label: 'RESET', jackType: 'output', signalType: 'trigger', column: 0, row: 1 },
      { id: 'out_run', label: 'RUN', jackType: 'output', signalType: 'gate', column: 1, row: 1 },
    ],
  },
};

class StudioClockEngine extends BaseEngine {
  private clockCv!: ConstantSourceNode;
  private beatCv!: ConstantSourceNode;
  private resetCv!: ConstantSourceNode;
  private runCv!: ConstantSourceNode;
  private clockBus = new EventBus();
  private beatBus = new EventBus();
  private resetBus = new EventBus();
  private runBus = new EventBus();
  private unsub: (() => void)[] = [];
  private first = false;

  protected build(): void {
    this.clockCv = createConstant(this.ctx, 0);
    this.beatCv = createConstant(this.ctx, 0);
    this.resetCv = createConstant(this.ctx, 0);
    this.runCv = createConstant(this.ctx, 0);
    this.outputs = {
      out_clock: { node: this.clockCv, event: this.clockBus },
      out_beat: { node: this.beatCv, event: this.beatBus },
      out_reset: { node: this.resetCv, event: this.resetBus },
      out_run: { node: this.runCv, event: this.runBus },
    };
    this.attach(transport);
    this.onDispose(() => {
      this.unsub.forEach(u => u());
      [this.clockCv, this.beatCv, this.resetCv, this.runCv].forEach(n => { try { n.stop(); } catch { /* */ } });
    });
    this.emit({ playing: transport.playing, beat: 0 });
  }

  // The clock always follows the studio transport, synced or not
  protected onTransport(_t: Transport | null): void {}

  private attach(t: Transport) {
    this.unsub.push(t.onTick(tick => this.onTick(tick)));
    this.unsub.push(t.onEvent(e => {
      if (e.type === 'start') {
        this.first = true;
        this.runCv.offset.setValueAtTime(1, e.time);
        this.runBus.emit(e.time, 1);
        pulse(this.resetCv.offset, e.time, 0.005, 1);
        this.resetBus.emit(e.time, 1);
        this.emitAt(e.time, { playing: true });
      } else if (e.type === 'stop') {
        this.runCv.offset.setValueAtTime(0, this.ctx.currentTime);
        this.runBus.emit(this.ctx.currentTime, 0);
        this.emit({ playing: false, beatLed: 0 });
      }
    }));
  }

  private onTick(t: TransportTick) {
    const div = TICKS_PER[this.num('division', 2)] ?? PPQN / 4;
    const width = this.num('pulse_width', 5) / 1000;
    if (t.tick % div === 0) {
      pulse(this.clockCv.offset, t.time, width, 1);
      this.clockBus.emit(t.time, 1);
    }
    if (t.tick % PPQN === 0) {
      pulse(this.beatCv.offset, t.time, width, 1);
      this.beatBus.emit(t.time, 1);
      const downbeat = t.tick % (PPQN * 4) === 0;
      this.emitAt(t.time, { beatLed: downbeat ? 1 : 0.6, beat: Math.floor(t.beat % 4) });
      this.atTime(t.time + 0.07, () => this.emit({ beatLed: 0 }));
    }
    this.first = false;
  }

  protected onParam(_id: string, _v: ControlValue): void {}
}

const layout: PanelLayout = {
  width: 101.6,
  height: 128.5,
  pxPerMm: 3,
  theme: {
    background: 'linear-gradient(180deg, #1d2430 0%, #141922 100%)',
    text: '#e7ecf5',
    muted: '#8b97ab',
    jack: { ring: '#5b6b85', outputLabelBg: '#e7ecf5', outputLabelText: '#141922' },
  },
  elements: [
    { kind: 'label', text: 'STUDIO CLOCK', x: 50.8, y: 9, size: 13, weight: 800, letterSpacing: 1.5 },
    { kind: 'label', text: 'transport → voltages', x: 50.8, y: 15, size: 7, color: '#8b97ab', weight: 500 },
    {
      kind: 'display', x: 14, y: 21, w: 73.6, h: 20, style: 'led-segment',
      render: ({ engine }) => [
        `${transport.bpm.toFixed(1)} BPM`,
        engine.playing ? `▶ beat ${(Number(engine.beat) || 0) + 1}` : '■ stopped',
      ],
    },
    { kind: 'led', x: 50.8, y: 48, size: 4, color: '#38bdf8', on: ({ engine }) => Number(engine.beatLed) || 0 },
    { kind: 'switch', control: 'division', x: 33, y: 66, style: 'rotary', scale: 1.2 },
    { kind: 'knob', control: 'pulse_width', x: 76, y: 66, diameter: 11, variant: 'moog-black' },
    { kind: 'jack', jack: 'out_clock', x: 30, y: 96 },
    { kind: 'jack', jack: 'out_beat', x: 71.6, y: 96 },
    { kind: 'jack', jack: 'out_reset', x: 30, y: 116 },
    { kind: 'jack', jack: 'out_run', x: 71.6, y: 116 },
  ],
};

const clock: DeviceModule = {
  spec,
  layout,
  lessons: [],
  createEngine: () => new StudioClockEngine(),
  studio: { midiSync: true },
  tips: [
    'Press the studio Play button (top bar) to start the clock.',
    'Patch CLOCK into a clock or advance input to make that instrument step in time with the studio.',
    'RESET fires once on Play - patch it into a sequencer reset so everything starts on step 1 together.',
  ],
};

export default clock;
