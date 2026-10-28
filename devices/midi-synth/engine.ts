// ============================================================================
// "Your synth (MIDI)" engine - makes no sound itself; it plays real hardware.
//
//   knobs k1..k16   -> CC (or 14-bit MSB+LSB) on the configured port/channel
//   noteOn/noteOff  -> notes (on-screen keys, computer keys, MIDI input)
//   receiveMidi     -> MIDI thru: bend, CCs, aftertouch re-addressed to our channel
//   sequencer       -> studio transport ticks -> notes with exact MIDI timestamps
//
// Knob positions are NOT sent while the engine replays its stored values on
// start: opening the page must never overwrite the patch on your synth. Moving a
// knob sends; "Send all" pushes the whole panel on purpose.
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine, Clock } from '@/lib/audio/engine';
import { transport as studioTransport, type Transport, type TransportTick } from '@/lib/audio/transport';
import { midi, type MidiOutputLike } from '@/lib/midi/access';
import { audioToMidiTime } from '@/lib/midi/time';
import { CC_ALL_NOTES_OFF, CC_ALL_SOUND_OFF, isChannelMessage, withChannel } from '@/lib/midi/bytes';
import type { MidiReceiver } from '@/lib/midi/router';
import { useMidiStore } from '@/store/midi';
import { KNOB_IDS, asData, initialData, knobMessages, type MidiSynthData } from './config';
import { StepSequencer, stepTick, type SeqSettings } from './sequencer';

interface Held {
  out: MidiOutputLike | null;
  channel: number;
}

export class MidiSynthEngine extends BaseEngine implements MidiReceiver {
  private cfg: MidiSynthData = initialData();
  /** False while BaseEngine replays stored values right after build() */
  private live = false;
  /** Last bytes sent per knob (a 0.1 knob step often maps to the same CC value) */
  private lastSent = new Map<string, string>();
  /** Notes we started, and where they went - note-offs follow them even if the port changes */
  private held = new Map<number, Held>();
  private seq = new StepSequencer();
  private unsubs: (() => void)[] = [];
  private transportUnsubs: (() => void)[] = [];
  private clock: Clock | null = null;
  private portCache: MidiOutputLike | null | undefined = undefined;
  private noteCount = 0;
  private sent = 0;
  private ledTimer: ReturnType<typeof setTimeout> | null = null;

  protected build(): void {
    // Re-resolve the port when ports come and go (hot-plug) or access is granted
    this.unsubs.push(midi.subscribe(() => { this.portCache = undefined; }));
    // Internal clock follows the studio tempo too
    this.unsubs.push(studioTransport.onEvent(e => {
      if (e.type === 'tempo' && this.clock) this.clock.setInterval(this.stepSeconds());
    }));
    queueMicrotask(() => { this.live = true; });
    this.onDispose(() => {
      this.allNotesOff(false);
      this.unsubs.forEach(u => u());
      this.transportUnsubs.forEach(u => u());
      this.clock?.stop();
      if (this.ledTimer) clearTimeout(this.ledTimer);
    });
    this.emit({ playing: false, step: -1, out: 0, sent: 0 });
  }

  // --------------------------------------------------------------------------
  // Output
  // --------------------------------------------------------------------------

  private output(): MidiOutputLike | null {
    if (this.portCache === undefined) this.portCache = midi.findOutput(this.cfg.port);
    return this.portCache;
  }

  /** Send now */
  private send(bytes: number[], out = this.output()) {
    if (!out) return;
    if (midi.send(out, bytes)) this.activity();
  }

  /** Send at an audio-clock time (sequencer) */
  private sendAt(bytes: number[], audioTime: number, out = this.output()) {
    if (!out) return;
    const s = useMidiStore.getState().clockOut;
    const ts = audioToMidiTime(this.ctx, audioTime, { compensate: s.compensate, offsetMs: s.offsetMs + this.cfg.offsetMs });
    if (midi.send(out, bytes, ts)) this.activity();
  }

  private activity() {
    this.sent++;
    if (this.ledTimer) return;
    this.emit({ out: 1, sent: this.sent });
    this.ledTimer = setTimeout(() => {
      this.ledTimer = null;
      this.emit({ out: 0, sent: this.sent });
    }, 70);
  }

  // --------------------------------------------------------------------------
  // Data, knobs, notes
  // --------------------------------------------------------------------------

  protected onData(data: unknown): void {
    const next = asData(data);
    const prev = this.cfg;
    this.cfg = next;
    const portChanged = prev.port?.id !== next.port?.id || prev.port?.name !== next.port?.name;
    if (portChanged) this.portCache = undefined;
    if (portChanged || prev.channel !== next.channel) this.lastSent.clear();
  }

  protected onParam(id: string, value: ControlValue): void {
    const k = KNOB_IDS.indexOf(id);
    if (k >= 0) {
      if (this.live && typeof value === 'number') this.sendKnob(k, value);
      return;
    }
    if (id === 'play' && !this.transport) {
      // Not following the studio: run the internal clock at the studio tempo
      if (value) this.startClock();
      else this.stopClock();
    }
  }

  private sendKnob(index: number, pos: number, force = false) {
    const knob = this.cfg.knobs[index];
    if (!knob) return;
    const msgs = knobMessages(knob, pos, this.cfg.channel);
    const key = msgs.map(m => m.join(',')).join(';');
    const id = KNOB_IDS[index];
    if (!force && this.lastSent.get(id) === key) return;
    this.lastSent.set(id, key);
    msgs.forEach(m => this.send(m));
  }

  noteOn(note: number, velocity = 1): void {
    const out = this.output();
    const prev = this.held.get(note);
    if (prev) this.send([0x80 | prev.channel, note, 0], prev.out);
    const ch = this.cfg.channel;
    this.held.set(note, { out, channel: ch });
    this.send([0x90 | ch, note & 0x7f, Math.max(1, Math.min(127, Math.round(velocity * 127)))], out);
    // The step editor listens for this (tap a step, then play a key)
    this.emit({ lastNote: { note, velocity, n: ++this.noteCount } });
  }

  noteOff(note: number): void {
    const h = this.held.get(note);
    if (!h) return;
    this.held.delete(note);
    this.send([0x80 | h.channel, note & 0x7f, 0], h.out);
  }

  /** MIDI thru from an input routed here: bend, CCs, aftertouch, program change */
  receiveMidi(data: number[] | Uint8Array): void {
    if (!isChannelMessage(data)) return;
    this.send(withChannel(data, this.cfg.channel));
  }

  /** Don't echo the synth's own keys back to it (it would play every note twice) */
  ignoresInput(portName: string): boolean {
    return !!this.cfg.port?.name && this.cfg.port.name === portName;
  }

  private allNotesOff(panic: boolean) {
    this.held.forEach((h, note) => this.send([0x80 | h.channel, note & 0x7f, 0], h.out));
    this.held.clear();
    if (panic) {
      const ch = this.cfg.channel;
      this.send([0xb0 | ch, CC_ALL_NOTES_OFF, 0]);
      this.send([0xb0 | ch, CC_ALL_SOUND_OFF, 0]);
    }
  }

  event(name: string): void {
    if (name === 'send-all') {
      KNOB_IDS.forEach((id, i) => this.sendKnob(i, this.num(id, 64), true));
    } else if (name === 'panic') {
      this.allNotesOff(true);
    }
  }

  // --------------------------------------------------------------------------
  // Sequencer
  // --------------------------------------------------------------------------

  private seqSettings(swing: number): SeqSettings {
    return {
      enabled: this.bool('seq'),
      steps: this.cfg.steps,
      length: this.num('length', 16),
      gate: this.num('gate', 50) / 100,
      transpose: this.num('transpose', 0),
      swing,
      channel: this.cfg.channel,
    };
  }

  private onStepTick(t: TransportTick, swing: number) {
    const res = this.seq.tick(t, this.seqSettings(swing));
    if (!res) return;
    const out = this.output();
    res.events.forEach(e => this.sendAt(e.bytes, e.time, out));
    this.emitAt(res.time, { step: res.step });
  }

  protected onTransport(t: Transport | null): void {
    this.transportUnsubs.forEach(u => u());
    this.transportUnsubs = [];
    if (t) {
      this.stopClock();
      this.transportUnsubs.push(t.onTick(tick => this.onStepTick(tick, t.swing)));
      this.transportUnsubs.push(t.onEvent(e => {
        if (e.type === 'start') this.emitAt(e.time, { playing: true });
        if (e.type === 'stop') this.emit({ playing: false, step: -1 });
      }));
      this.emit({ playing: t.playing });
    } else if (this.bool('play')) {
      this.startClock();
    } else {
      this.emit({ playing: false, step: -1 });
    }
  }

  private stepSeconds() {
    return 60 / studioTransport.bpm / 4;
  }

  private startClock() {
    if (this.clock?.running) return;
    this.clock = new Clock(this.ctx, (time, n) => this.onStepTick(stepTick(time, n, this.stepSeconds()), 0), this.stepSeconds());
    this.clock.start();
    this.emit({ playing: true });
  }

  private stopClock() {
    if (!this.clock) return;
    this.clock.stop();
    this.clock = null;
    this.emit({ playing: false, step: -1 });
  }
}
