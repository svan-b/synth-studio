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
  /**
   * Links to a piano that is already being heard another way, and so are left
   * alone: the Bluetooth link of a piano that is also plugged in by cable.
   */
  aside: MidiPort[];
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
  /** "bluetooth" or "cable", where the system says. The iPad app does. */
  transport?: string;
  onmidimessage: ((e: { data: Uint8Array | null; timeStamp: number }) => void) | null;
};
type WebMidiOutput = {
  id: string;
  name?: string | null;
  state?: string;
  transport?: string;
  send: (data: number[] | Uint8Array, timestamp?: number) => void;
  /** Withdraw messages sent with a time that has not come yet. Not every system offers it. */
  clear?: () => void;
};
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
    aside: [],
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
  /**
   * Notes handed to the system with their times: when each sounds and when it
   * is let go, on the page's clock in milliseconds. Kept until it is let go,
   * so that stopping can release whatever is sounding or still to come.
   */
  private scheduled: Array<{ midi: number; on: number; off: number }> = [];
  /** How firmly the learner tends to strike, 0 to 1, as a running average of their own playing. */
  private touch: number | null = null;
  private touchCount = 0;
  /** Milliseconds each of the last keys took to reach the app. */
  private lateness: number[] = [];
  /** Ports not listened to: a second link to a piano that is already heard. */
  private muted = new Set<string>();
  /** Ports found, from what they send, to repeat what another port has just sent. */
  private shadow = new Set<string>();
  private echoes = new Map<string, number>();
  /** The port each key last went down on and when, and the port holding it now. */
  private lastOn = new Map<number, { port: string; at: number }>();
  private owner = new Map<number, string>();

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

  /** How firmly the learner tends to play, 0 to 1. Null until enough keys have been heard to say. */
  get typicalTouch(): number | null {
    return this.touchCount >= 12 ? this.touch : null;
  }

  /** How long keys have been taking to reach the app, in milliseconds: the usual figure and the worst, or null with too few to say. */
  get keyDelay(): { usual: number; worst: number; keys: number } | null {
    if (this.lateness.length < 5) return null;
    const sorted = this.lateness.slice().sort((a, b) => a - b);
    return { usual: Math.round(sorted[Math.floor(sorted.length / 2)]), worst: Math.round(sorted[sorted.length - 1]), keys: sorted.length };
  }

  /** Start from what was learned on an earlier day. */
  rememberTouch(level: number | null | undefined): void {
    if (this.touch === null && typeof level === 'number' && level > 0) {
      this.touch = level;
      this.touchCount = 12;
    }
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
    const ins: WebMidiInput[] = [];
    const allOuts: WebMidiOutput[] = [];
    this.access.inputs.forEach((port) => {
      if (port.state !== 'disconnected') ins.push(port);
    });
    this.access.outputs.forEach((port) => {
      if (port.state !== 'disconnected') allOuts.push(port);
    });

    // A piano plugged in by cable and joined over Bluetooth as well shows up
    // twice. Heard on both, every key would arrive twice, and every note the
    // app sends would be played twice. One link is used: the cable, which is
    // the quicker and steadier of the two. The other is left alone.
    const wireless = (p: { name?: string | null; transport?: string }) => p.transport === 'bluetooth' || /bluetooth|\bble\b/i.test(p.name ?? '');
    const both = ins.some(wireless) && ins.some((p) => !wireless(p));
    const setAside = (p: WebMidiInput) => this.shadow.has(p.id) || (both && wireless(p));
    const used = ins.filter((p) => !setAside(p));
    const asideIn = ins.filter(setAside);
    this.muted = new Set(asideIn.map((p) => p.id));
    for (const port of ins) {
      // Assigning the handler also opens the port.
      port.onmidimessage = (e) => {
        if (e.data && !this.muted.has(port.id)) this.handleBytes(e.data, e.timeStamp, port.name || 'MIDI', port.id);
      };
    }
    // The same for the way out: a note goes to the piano once, by the link that is listened to.
    const asideNames = new Set(asideIn.map((p) => p.name ?? ''));
    const outsBoth = allOuts.some(wireless) && allOuts.some((p) => !wireless(p));
    const outs = allOuts.filter((p) => !(outsBoth && wireless(p)) && !(this.shadow.size > 0 && asideNames.has(p.name ?? '') && allOuts.length > 1));
    this.outputs = outs.length > 0 ? outs : allOuts.slice(0, 1);

    const inputs = used.map((p) => ({ id: p.id, name: p.name || 'MIDI device' }));
    const outputs = this.outputs.map((p) => ({ id: p.id, name: p.name || 'MIDI device' }));
    const aside = asideIn.map((p) => ({ id: p.id, name: p.name || 'MIDI device' }));
    const ids = (list: MidiPort[]) => list.map((p) => p.id).join();
    if (ids(inputs) !== ids(this.current.inputs) || ids(outputs) !== ids(this.current.outputs) || ids(aside) !== ids(this.current.aside)) {
      if (inputs.length === 0) this.releaseAll();
      this.set({ inputs, outputs, aside });
    }
  }

  /**
   * A key that arrived a moment ago on one port has arrived again on another.
   * After a few of these the second port is plainly a second link to the same
   * piano, and is left alone from then on.
   */
  private noteEcho(portId: string): void {
    const n = (this.echoes.get(portId) ?? 0) + 1;
    this.echoes.set(portId, n);
    if (n >= 3 && !this.shadow.has(portId)) {
      this.shadow.add(portId);
      this.refreshPorts();
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
    this.muted.clear();
    this.shadow.clear();
    this.echoes.clear();
    this.lastOn.clear();
    this.owner.clear();
    this.set({ state: 'idle', transport: null, inputs: [], outputs: [], aside: [], error: null });
  }

  // ------------------------------------------------------------- incoming

  /**
   * Raw bytes from a Web MIDI port. The standard promises one message per
   * event, but browsers that add MIDI on an iPad can hand over a whole
   * packet: several messages at once, as when a chord is struck, sometimes
   * with the status byte left out of all but the first. Every one is read.
   */
  handleBytes(data: Uint8Array, timeStamp: number, port: string, portId?: string): void {
    let status = 0;
    let i = 0;
    while (i < data.length) {
      const b = data[i];
      if (b >= 0xf8) {
        i++; // clock and active sensing, which may fall anywhere
        continue;
      }
      if (b >= 0xf0) {
        status = 0;
        if (b === 0xf0) {
          while (i < data.length && data[i] !== 0xf7) i++;
          i++;
        } else {
          i += b === 0xf2 ? 3 : b === 0xf1 || b === 0xf3 ? 2 : 1;
        }
        continue;
      }
      if (b & 0x80) {
        status = b;
        i++;
      }
      if (status === 0) {
        i++; // a data byte with nothing to belong to
        continue;
      }
      const type = status & 0xf0;
      const need = type === 0xc0 || type === 0xd0 ? 1 : 2;
      if (i + need > data.length) break;
      if (data[i] & 0x80 || (need === 2 && data[i + 1] & 0x80)) continue; // cut short by a new status
      this.handleMessage(status, data[i], need === 2 ? data[i + 1] : 0, timeStamp, port, portId);
      i += need;
    }
  }

  private handleMessage(status: number, d1: number, d2: number, timeStamp: number, port: string, portId?: string): void {
    const type = status & 0xf0;
    if (portId !== undefined && this.shadow.has(portId)) return;
    if (portId !== undefined && (type === 0x90 || type === 0x80)) {
      const down = type === 0x90 && d2 > 0;
      if (down) {
        // The same key, a moment ago, from another port: a second link to the same piano repeating it.
        const last = this.lastOn.get(d1);
        const now = performance.now();
        if (last && last.port !== portId && now - last.at < 150) {
          this.noteEcho(portId);
          return;
        }
        this.lastOn.set(d1, { port: portId, at: now });
        this.owner.set(d1, portId);
      } else {
        // A key comes up on the port it went down on. The other port's word for it is the echo.
        const own = this.owner.get(d1);
        if (own !== undefined && own !== portId) return;
        this.owner.delete(d1);
      }
    }
    const time = toAudioTime(timeStamp);
    if (type === 0x90 && d2 > 0) {
      // How long the key took to reach the app, for the connection report.
      const late = performance.now() - timeStamp;
      if (Number.isFinite(late) && late >= 0 && late < 2000) {
        this.lateness.push(late);
        if (this.lateness.length > 60) this.lateness.shift();
      }
      this.count(`Key down  ${d1}  velocity ${d2}`, port);
      // A layered voice sends the same key on two channels. Count it once.
      if (this.held.has(d1)) return;
      this.held.add(d1);
      const strength = velocityCurve(d2);
      // The top and bottom keys are buttons for the app, so they say nothing about how the learner plays.
      if (d1 !== 21 && d1 !== 108) {
        this.touch = this.touch === null ? strength : this.touch + (strength - this.touch) * 0.04;
        this.touchCount++;
      }
      emitNoteOn(d1, strength, time, 'midi');
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

  /**
   * Have the piano itself play a note, at an audio clock time. The strength
   * is sent as it is, on the same scale the piano uses for the learner's own
   * keys, so a note sent at 0.7 is as loud as a key struck at 0.7.
   */
  playNote(midi: number, seconds: number, velocity = 0.7, when?: number): void {
    const vel = Math.max(1, Math.min(127, Math.round(velocity * 127)));
    const delay = when === undefined ? 0 : (when - piano.now()) * 1000;
    if (delay > 1 && delay < 2000 && this.outputs.length > 0 && !this.bleCharacteristic) {
      // The key down and the key up are both handed over now, each stamped with its time, and the
      // system's MIDI clock plays them. A timer in a busy page can be late, and a late key up lands
      // after the next press of the same key and cuts it short. Nor can a page that has stopped running
      // leave a note sounding.
      const now = performance.now();
      const on = now + delay;
      const off = on + Math.max(50, seconds * 1000);
      for (const out of this.outputs) {
        try {
          out.send([0x90, midi, vel], on);
          out.send([0x80, midi, 0], off);
        } catch {
          /* a port that went away */
        }
      }
      this.scheduled = this.scheduled.filter((n) => n.off > now);
      this.scheduled.push({ midi, on, off });
      return;
    }
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
    // Notes handed over with a time to come are withdrawn where the system allows it.
    for (const out of this.outputs) {
      try {
        out.clear?.();
      } catch {
        /* not offered */
      }
    }
    // Whether or not they were withdrawn, each is let go: one sounding now at once, one still to
    // come just after it would sound. A key up for a note that never sounded does no harm.
    const now = performance.now();
    for (const { midi, on, off } of this.scheduled) {
      if (off <= now) continue;
      for (const out of this.outputs) {
        try {
          if (on <= now) out.send([0x80, midi, 0]);
          else out.send([0x80, midi, 0], on + 40);
        } catch {
          /* a port that went away */
        }
      }
    }
    this.scheduled = [];
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
