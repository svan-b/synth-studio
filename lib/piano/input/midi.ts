/**
 * MIDI connection to a digital piano.
 *
 * Two transports feed the same message handler:
 *   Web MIDI       USB or Bluetooth MIDI devices known to the system. Present
 *                  in Chrome, Edge and Firefox on computers and Android, and
 *                  on iPad inside browsers that add it, since Safari has none.
 *   Web Bluetooth  A direct Bluetooth LE MIDI link, for browsers that offer
 *                  Bluetooth but not MIDI.
 *
 * MIDI is exact: which key, how hard, when it went down and came up, and
 * what the pedals are doing. Everything arrives on the shared note bus.
 */

import { piano } from '../audio/engine';
import { Emitter } from '../util/emitter';
import { emitNoteOff, emitNoteOn } from './bus';

export type PedalName = 'sustain' | 'sostenuto' | 'soft';

export interface PedalEvent {
  pedal: PedalName;
  down: boolean;
  /** 0 to 1. Pianos with half pedalling send the values between. */
  value: number;
  time: number;
}

export interface MidiPort {
  id: string;
  name: string;
}

export interface MidiStatus {
  /** Whether this browser has any way to reach MIDI. */
  webMidi: boolean;
  bluetooth: boolean;
  state: 'idle' | 'connecting' | 'connected' | 'denied' | 'error';
  transport: 'webmidi' | 'bluetooth' | null;
  inputs: MidiPort[];
  outputs: MidiPort[];
  error: string | null;
  /** Count of note and pedal messages received, so the UI can show a live signal. */
  messages: number;
}

export interface MonitorLine {
  time: number;
  text: string;
  port: string;
}

const BLE_SERVICE = '03b80e5a-ede8-4b33-a751-6ce34ec4c700';
const BLE_CHARACTERISTIC = '7772e5db-3868-4112-a1a9-f2669d106bf3';
const CC_PEDAL: Record<number, PedalName> = { 64: 'sustain', 66: 'sostenuto', 67: 'soft' };

/** A parsed channel message. */
export interface MidiMessage {
  status: number;
  data1: number;
  data2: number;
}

/**
 * Split a Bluetooth LE MIDI packet into messages. A packet starts with a
 * header byte, then each message is led by a timestamp byte. A message may
 * leave out its status byte and reuse the previous one (running status).
 */
export function parseBlePacket(bytes: Uint8Array): MidiMessage[] {
  const out: MidiMessage[] = [];
  if (bytes.length < 3 || (bytes[0] & 0x80) === 0) return out;
  let i = 1;
  let running = 0;
  let inSysex = false;
  while (i < bytes.length) {
    let status = running;
    if (bytes[i] & 0x80) {
      // Timestamp byte, then either a status byte or running status data.
      i++;
      if (i >= bytes.length) break;
      if (bytes[i] & 0x80) {
        status = bytes[i];
        i++;
      }
    }
    if (inSysex) {
      if (status === 0xf7) inSysex = false;
      else {
        while (i < bytes.length && (bytes[i] & 0x80) === 0) i++;
      }
      continue;
    }
    if (status === 0xf0) {
      inSysex = true;
      while (i < bytes.length && (bytes[i] & 0x80) === 0) i++;
      continue;
    }
    if (status >= 0xf8) {
      continue; // clock, active sensing and other real time messages carry no data
    }
    if (status === 0) {
      i++;
      continue;
    }
    const type = status & 0xf0;
    const need = type === 0xc0 || type === 0xd0 || status === 0xf1 || status === 0xf3 ? 1 : status >= 0xf4 ? 0 : 2;
    if (i + need > bytes.length) break;
    const d1 = need >= 1 ? bytes[i] : 0;
    const d2 = need >= 2 ? bytes[i + 1] : 0;
    if ((d1 & 0x80) !== 0 || (d2 & 0x80) !== 0) {
      // Malformed. Resynchronise at the next byte.
      i++;
      continue;
    }
    i += need;
    out.push({ status, data1: d1, data2: d2 });
    if (status < 0xf0) running = status;
  }
  return out;
}

/** Wrap one channel message in a Bluetooth LE MIDI packet. */
export function buildBlePacket(message: number[], timeMs: number): Uint8Array {
  const t = Math.floor(timeMs) & 0x1fff;
  return new Uint8Array([0x80 | ((t >> 7) & 0x3f), 0x80 | (t & 0x7f), ...message]);
}

type WebMidiInput = {
  id: string;
  name?: string | null;
  state?: string;
  onmidimessage: ((e: { data: Uint8Array | null; timeStamp: number }) => void) | null;
};
type WebMidiOutput = { id: string; name?: string | null; state?: string; send: (data: number[] | Uint8Array, timestamp?: number) => void };
type WebMidiAccess = {
  inputs: { forEach: (fn: (port: WebMidiInput) => void) => void };
  outputs: { forEach: (fn: (port: WebMidiOutput) => void) => void };
  onstatechange: ((e: unknown) => void) | null;
};

class MidiManager {
  readonly status = new Emitter<MidiStatus>();
  readonly pedals = new Emitter<PedalEvent>();
  readonly monitor = new Emitter<MonitorLine>();

  private current: MidiStatus = {
    webMidi: false,
    bluetooth: false,
    state: 'idle',
    transport: null,
    inputs: [],
    outputs: [],
    error: null,
    messages: 0,
  };
  private access: WebMidiAccess | null = null;
  private outputs: WebMidiOutput[] = [];
  private poll: ReturnType<typeof setInterval> | null = null;
  private bleCharacteristic: {
    writeValueWithoutResponse?: (data: Uint8Array) => Promise<void>;
    writeValue?: (data: Uint8Array) => Promise<void>;
  } | null = null;
  private bleDevice: { gatt?: { connected: boolean; disconnect: () => void }; name?: string } | null = null;
  /** Keys currently down, so layered voices on several channels count once. */
  private held = new Set<number>();
  private pedalDown: Record<PedalName, boolean> = { sustain: false, sostenuto: false, soft: false };
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private sounding = new Set<number>();

  constructor() {
    if (typeof navigator !== 'undefined') {
      const nav = navigator as Navigator & { requestMIDIAccess?: unknown; bluetooth?: { requestDevice?: unknown } };
      this.current.webMidi = typeof nav.requestMIDIAccess === 'function';
      this.current.bluetooth = typeof nav.bluetooth?.requestDevice === 'function';
    }
  }

  getStatus(): MidiStatus {
    return this.current;
  }

  get connected(): boolean {
    return this.current.state === 'connected' && this.current.inputs.length > 0;
  }

  get hasOutput(): boolean {
    return this.current.state === 'connected' && (this.outputs.length > 0 || this.bleCharacteristic !== null);
  }

  isPedalDown(pedal: PedalName): boolean {
    return this.pedalDown[pedal];
  }

  private set(patch: Partial<MidiStatus>): void {
    this.current = { ...this.current, ...patch };
    this.status.emit(this.current);
  }

  // ------------------------------------------------------------- Web MIDI

  /** Ask the browser for MIDI access. Call from a tap. */
  async connect(): Promise<boolean> {
    const request = (navigator as unknown as { requestMIDIAccess?: (opts?: { sysex?: boolean }) => Promise<unknown> }).requestMIDIAccess;
    if (typeof request !== 'function') {
      this.set({ state: 'error', error: 'This browser has no MIDI support.' });
      return false;
    }
    this.set({ state: 'connecting', error: null });
    let access: WebMidiAccess;
    try {
      access = (await request.call(navigator, { sysex: false })) as WebMidiAccess;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const denied = /denied|not allowed|permission|security/i.test(message);
      this.set({ state: denied ? 'denied' : 'error', error: message });
      return false;
    }
    this.access = access;
    access.onstatechange = () => this.refreshPorts();
    this.refreshPorts();
    // Some browsers do not announce devices plugged in later, so look again now and then.
    if (this.poll) clearInterval(this.poll);
    this.poll = setInterval(() => this.refreshPorts(), 2500);
    this.set({ state: 'connected', transport: 'webmidi' });
    return true;
  }

  private refreshPorts(): void {
    if (!this.access) return;
    const inputs: MidiPort[] = [];
    const outputs: MidiPort[] = [];
    const outs: WebMidiOutput[] = [];
    this.access.inputs.forEach((port) => {
      if (port.state === 'disconnected') return;
      inputs.push({ id: port.id, name: port.name || 'MIDI device' });
      // Assigning the handler also opens the port.
      port.onmidimessage = (e) => {
        if (e.data) this.handleBytes(e.data, e.timeStamp, port.name || 'MIDI');
      };
    });
    this.access.outputs.forEach((port) => {
      if (port.state === 'disconnected') return;
      outputs.push({ id: port.id, name: port.name || 'MIDI device' });
      outs.push(port);
    });
    this.outputs = outs;
    const changed =
      inputs.map((p) => p.id).join() !== this.current.inputs.map((p) => p.id).join() ||
      outputs.map((p) => p.id).join() !== this.current.outputs.map((p) => p.id).join();
    if (changed) {
      if (inputs.length === 0) this.releaseAll();
      this.set({ inputs, outputs });
    }
  }

  // -------------------------------------------------------- Web Bluetooth

  /** Pair directly with a Bluetooth MIDI piano. Call from a tap. */
  async connectBluetooth(): Promise<boolean> {
    type Characteristic = {
      startNotifications: () => Promise<unknown>;
      addEventListener: (type: string, fn: (e: { target: { value: DataView } }) => void) => void;
      writeValueWithoutResponse?: (data: Uint8Array) => Promise<void>;
      writeValue?: (data: Uint8Array) => Promise<void>;
    };
    type Device = {
      name?: string;
      gatt?: {
        connected: boolean;
        connect: () => Promise<{ getPrimaryService: (id: string) => Promise<{ getCharacteristic: (id: string) => Promise<Characteristic> }> }>;
        disconnect: () => void;
      };
      addEventListener: (type: string, fn: () => void) => void;
    };
    const nav = navigator as Navigator & {
      bluetooth?: { requestDevice: (opts: unknown) => Promise<Device> };
    };
    if (!nav.bluetooth || typeof nav.bluetooth.requestDevice !== 'function') {
      this.set({ state: 'error', error: 'This browser has no Bluetooth support.' });
      return false;
    }
    this.set({ state: 'connecting', error: null });
    try {
      const device = await nav.bluetooth.requestDevice({ filters: [{ services: [BLE_SERVICE] }] });
      if (!device.gatt) throw new Error('The device does not accept connections.');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE_SERVICE);
      const ch = await service.getCharacteristic(BLE_CHARACTERISTIC);
      await ch.startNotifications();
      const name = device.name || 'Bluetooth piano';
      ch.addEventListener('characteristicvaluechanged', (e) => {
        const view = e.target.value;
        const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        const now = performance.now();
        for (const m of parseBlePacket(bytes)) this.handleMessage(m.status, m.data1, m.data2, now, name);
      });
      device.addEventListener('gattserverdisconnected', () => {
        this.bleCharacteristic = null;
        this.releaseAll();
        this.set({ state: 'idle', transport: null, inputs: [], outputs: [], error: 'The Bluetooth link was lost.' });
      });
      this.bleDevice = device;
      this.bleCharacteristic = ch;
      const port = { id: 'ble', name };
      this.set({ state: 'connected', transport: 'bluetooth', inputs: [port], outputs: [port] });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Closing the device chooser is not an error worth showing.
      const cancelled = /cancel|chooser|NotFoundError/i.test(message) || (err as { name?: string })?.name === 'NotFoundError';
      this.set({ state: cancelled ? 'idle' : 'error', error: cancelled ? null : message });
      return false;
    }
  }

  disconnect(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    if (this.access) {
      this.access.inputs.forEach((port) => {
        port.onmidimessage = null;
      });
      this.access.onstatechange = null;
    }
    this.access = null;
    this.outputs = [];
    try {
      this.bleDevice?.gatt?.disconnect();
    } catch {
      /* already gone */
    }
    this.bleDevice = null;
    this.bleCharacteristic = null;
    this.releaseAll();
    this.set({ state: 'idle', transport: null, inputs: [], outputs: [], error: null });
  }

  // ------------------------------------------------------------- incoming

  /** Raw bytes from a Web MIDI port. One event may carry one message. */
  handleBytes(data: Uint8Array, timeStamp: number, port: string): void {
    if (data.length === 0) return;
    const status = data[0];
    if (status >= 0xf0) return; // system messages: clock, active sensing, sysex
    this.handleMessage(status, data[1] ?? 0, data[2] ?? 0, timeStamp, port);
  }

  private handleMessage(status: number, d1: number, d2: number, timeStamp: number, port: string): void {
    const type = status & 0xf0;
    const time = toAudioTime(timeStamp);
    if (type === 0x90 && d2 > 0) {
      this.count(`Key down  ${d1}  velocity ${d2}`, port);
      // A layered voice sends the same key on two channels. Count it once.
      if (this.held.has(d1)) return;
      this.held.add(d1);
      emitNoteOn(d1, velocityCurve(d2), time, 'midi');
    } else if (type === 0x80 || (type === 0x90 && d2 === 0)) {
      this.count(`Key up    ${d1}`, port);
      if (!this.held.has(d1)) return;
      this.held.delete(d1);
      emitNoteOff(d1, time, 'midi');
    } else if (type === 0xb0) {
      const pedal = CC_PEDAL[d1];
      if (pedal) {
        const down = d2 >= 64;
        if (down !== this.pedalDown[pedal]) this.count(`${pedal} pedal ${down ? 'down' : 'up'}`, port);
        this.pedalDown[pedal] = down;
        this.pedals.emit({ pedal, down, value: d2 / 127, time });
      } else if (d1 === 123 || d1 === 120) {
        this.releaseAll();
      }
    }
  }

  private count(text: string, port: string): void {
    this.current = { ...this.current, messages: this.current.messages + 1 };
    if (this.monitor.size > 0) this.monitor.emit({ time: performance.now(), text, port });
    // Status listeners only need to know that a signal is arriving, not every message.
    if (this.current.messages <= 2 || this.current.messages % 16 === 0) this.status.emit(this.current);
  }

  private releaseAll(): void {
    const t = piano.now();
    this.held.forEach((midi) => emitNoteOff(midi, t, 'midi'));
    this.held.clear();
    this.pedalDown = { sustain: false, sostenuto: false, soft: false };
  }

  // ------------------------------------------------------------- outgoing

  /** Send a channel message to the piano now. */
  send(message: number[]): void {
    for (const out of this.outputs) {
      try {
        out.send(message);
      } catch {
        /* a port that went away */
      }
    }
    const ch = this.bleCharacteristic;
    if (ch) {
      const packet = buildBlePacket(message, performance.now());
      const write = ch.writeValueWithoutResponse ?? ch.writeValue;
      if (write) void write.call(ch, packet).catch(() => undefined);
    }
  }

  private at(when: number | undefined, fn: () => void): void {
    const delay = when === undefined ? 0 : (when - piano.now()) * 1000;
    if (delay <= 1) {
      fn();
      return;
    }
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, delay);
    this.timers.add(t);
  }

  /** Have the piano itself play a note, at an audio clock time. */
  playNote(midi: number, seconds: number, velocity = 0.7, when?: number): void {
    const vel = Math.max(1, Math.min(127, Math.round(velocity * 110 + 8)));
    this.at(when, () => {
      this.sounding.add(midi);
      this.send([0x90, midi, vel]);
    });
    this.at((when ?? piano.now()) + Math.max(0.05, seconds), () => {
      this.sounding.delete(midi);
      this.send([0x80, midi, 0]);
    });
  }

  /** Stop anything the app asked the piano to play. */
  silence(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.sounding.forEach((midi) => this.send([0x80, midi, 0]));
    this.sounding.clear();
  }
}

/** MIDI velocity 1 to 127 as 0 to 1. Digital pianos rarely send the extremes. */
function velocityCurve(v: number): number {
  return Math.max(0.02, Math.min(1, v / 127));
}

/**
 * Turn a browser event time into audio clock time. Browsers that add MIDI
 * through an app do not always use the same clock, so fall back to "now"
 * when the stamp looks wrong.
 */
function toAudioTime(timeStamp: number): number {
  const now = performance.now();
  const lag = Number.isFinite(timeStamp) ? now - timeStamp : 0;
  const usable = lag >= -5 && lag < 250 ? lag : 0;
  return piano.now() - usable / 1000;
}

export const midi = new MidiManager();
