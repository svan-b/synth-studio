import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildBlePacket, midi, parseBlePacket, type PedalEvent } from './midi';
import { noteBus, type NoteInput } from './bus';
import { input, type RemoteAction } from './hub';

describe('Bluetooth MIDI packets', () => {
  it('reads a single note on', () => {
    const msgs = parseBlePacket(new Uint8Array([0x80, 0x80, 0x90, 60, 100]));
    expect(msgs).toEqual([{ status: 0x90, data1: 60, data2: 100 }]);
  });

  it('reads several messages, each with its own timestamp', () => {
    const msgs = parseBlePacket(new Uint8Array([0x85, 0x81, 0x90, 60, 100, 0x82, 0x90, 64, 90, 0x83, 0x80, 60, 0]));
    expect(msgs.map((m) => [m.status, m.data1, m.data2])).toEqual([
      [0x90, 60, 100],
      [0x90, 64, 90],
      [0x80, 60, 0],
    ]);
  });

  it('handles running status, with and without a timestamp between messages', () => {
    const noStamp = parseBlePacket(new Uint8Array([0x80, 0x80, 0x90, 60, 100, 64, 90, 67, 80]));
    expect(noStamp.map((m) => m.data1)).toEqual([60, 64, 67]);
    expect(noStamp.every((m) => m.status === 0x90)).toBe(true);
    const withStamp = parseBlePacket(new Uint8Array([0x80, 0x80, 0x90, 60, 100, 0x81, 64, 90]));
    expect(withStamp.map((m) => [m.status, m.data1])).toEqual([
      [0x90, 60],
      [0x90, 64],
    ]);
  });

  it('reads pedal messages and skips real time bytes', () => {
    const msgs = parseBlePacket(new Uint8Array([0x80, 0x80, 0xb0, 64, 127, 0x81, 0xfe, 0x82, 0xb0, 64, 0]));
    expect(msgs.map((m) => [m.status, m.data1, m.data2])).toEqual([
      [0xb0, 64, 127],
      [0xb0, 64, 0],
    ]);
  });

  it('ignores packets without a header', () => {
    expect(parseBlePacket(new Uint8Array([0x10, 0x80, 0x90]))).toEqual([]);
    expect(parseBlePacket(new Uint8Array([]))).toEqual([]);
  });

  it('builds packets that parse back', () => {
    const packet = buildBlePacket([0x90, 72, 80], 1234);
    expect(packet[0] & 0x80).toBe(0x80);
    expect(parseBlePacket(packet)).toEqual([{ status: 0x90, data1: 72, data2: 80 }]);
  });
});

describe('MIDI messages from a piano', () => {
  let notes: NoteInput[] = [];
  let pedals: PedalEvent[] = [];
  let remote: RemoteAction[] = [];
  let unsubs: Array<() => void> = [];
  const send = (...bytes: number[]) => midi.handleBytes(new Uint8Array(bytes), performance.now(), 'test');

  beforeEach(() => {
    notes = [];
    pedals = [];
    remote = [];
    unsubs = [
      noteBus.subscribe((e) => notes.push(e)),
      midi.pedals.subscribe((e) => pedals.push(e)),
      input.remote.subscribe((a) => remote.push(a)),
    ];
  });
  afterEach(() => {
    send(0xb0, 123, 0);
    unsubs.forEach((u) => u());
  });

  it('turns key presses into note events with velocity', () => {
    send(0x90, 60, 100);
    send(0x80, 60, 64);
    expect(notes.map((n) => [n.type, n.midi, n.source])).toEqual([
      ['on', 60, 'midi'],
      ['off', 60, 'midi'],
    ]);
    expect(notes[0].velocity).toBeCloseTo(100 / 127, 3);
  });

  it('treats note on with velocity zero as note off', () => {
    send(0x90, 62, 80);
    send(0x90, 62, 0);
    expect(notes.map((n) => n.type)).toEqual(['on', 'off']);
  });

  it('counts a layered voice on two channels as one key', () => {
    send(0x90, 64, 90);
    send(0x91, 64, 90);
    send(0x80, 64, 0);
    send(0x81, 64, 0);
    expect(notes.map((n) => n.type)).toEqual(['on', 'off']);
  });

  it('ignores clock and active sensing', () => {
    send(0xf8);
    send(0xfe);
    expect(notes).toHaveLength(0);
  });

  it('reports the pedals', () => {
    send(0xb0, 64, 127);
    send(0xb0, 64, 40);
    expect(pedals.map((p) => [p.pedal, p.down])).toEqual([
      ['sustain', true],
      ['sustain', false],
    ]);
    expect(midi.isPedalDown('sustain')).toBe(false);
  });

  it('uses the top and bottom keys and the left and middle pedals as buttons', async () => {
    send(0x90, 108, 60);
    send(0x80, 108, 0);
    await new Promise((r) => setTimeout(r, 380));
    send(0x90, 21, 60);
    await new Promise((r) => setTimeout(r, 380));
    send(0xb0, 66, 127);
    await new Promise((r) => setTimeout(r, 380));
    send(0xb0, 67, 127);
    expect(remote).toEqual(['primary', 'secondary', 'primary', 'secondary']);
  });

  it('takes the right pedal as a button only when nothing is being played', async () => {
    // With a key held, or one just played, it is a pedal.
    send(0x90, 60, 80);
    send(0xb0, 64, 127);
    send(0xb0, 64, 0);
    send(0x80, 60, 0);
    send(0xb0, 64, 127);
    send(0xb0, 64, 0);
    expect(remote).toEqual([]);
    // Once the keys have been still for a moment, pressing it means continue.
    await new Promise((r) => setTimeout(r, 1300));
    send(0xb0, 64, 127);
    expect(remote).toEqual(['pedal']);
  });

  it('counts one press of a pedal that reports how far down it is as one press', async () => {
    send(0xb0, 64, 0);
    await new Promise((r) => setTimeout(r, 1300));
    // On the way down, held, and on the way up: a stream of values, and one press.
    for (const v of [40, 90, 127]) send(0xb0, 64, v);
    await new Promise((r) => setTimeout(r, 400));
    for (const v of [115, 96, 70, 64, 50]) send(0xb0, 64, v);
    expect(remote).toEqual(['pedal']);
    // A foot hovering around the middle does nothing more.
    for (const v of [60, 70, 62, 75, 58]) send(0xb0, 64, v);
    expect(remote).toEqual(['pedal']);
    // Let go, and the next press counts again.
    for (const v of [30, 0]) send(0xb0, 64, v);
    await new Promise((r) => setTimeout(r, 400));
    for (const v of [70, 110]) send(0xb0, 64, v);
    expect(remote).toEqual(['pedal', 'pedal']);
    send(0xb0, 64, 0);
  });

  it('releases held keys when the piano says all notes off', () => {
    send(0x90, 60, 90);
    send(0x90, 67, 90);
    send(0xb0, 123, 0);
    expect(notes.filter((n) => n.type === 'off').map((n) => n.midi).sort()).toEqual([60, 67]);
  });
});

describe('MIDI packets that carry more than one message', () => {
  const heard: NoteInput[] = [];
  let off: () => void;
  beforeEach(() => {
    heard.length = 0;
    off = noteBus.subscribe((e) => heard.push(e));
  });
  afterEach(() => {
    midi.handleBytes(new Uint8Array([0xb0, 123, 0]), 0, 'test');
    off();
  });

  it('hears every note of a chord sent as one packet', () => {
    midi.handleBytes(new Uint8Array([0x90, 60, 80, 0x90, 64, 80, 0x90, 67, 80]), 0, 'test');
    expect(heard.filter((e) => e.type === 'on').map((e) => e.midi)).toEqual([60, 64, 67]);
  });

  it('follows running status and steps over clock bytes', () => {
    midi.handleBytes(new Uint8Array([0x90, 60, 80, 0xf8, 64, 80, 0xfe, 67, 80]), 0, 'test');
    expect(heard.filter((e) => e.type === 'on').map((e) => e.midi)).toEqual([60, 64, 67]);
    midi.handleBytes(new Uint8Array([0x80, 60, 0, 64, 0, 0x90, 67, 0]), 0, 'test');
    expect(heard.filter((e) => e.type === 'off').map((e) => e.midi)).toEqual([60, 64, 67]);
  });

  it('reads a note that follows a pedal or a system message', () => {
    midi.handleBytes(new Uint8Array([0xb0, 64, 127, 0x90, 62, 70, 0xf0, 1, 2, 3, 0xf7, 0x90, 65, 70]), 0, 'test');
    expect(heard.filter((e) => e.type === 'on').map((e) => e.midi)).toEqual([62, 65]);
  });
});

describe('how firmly the learner plays', () => {
  it('is learned from their own keys, and leaves the keys that work as buttons out of it', () => {
    const before = midi.typicalTouch;
    // Too few keys to say anything yet, unless an earlier test has played some.
    for (let i = 0; i < 40; i++) {
      midi.handleBytes(new Uint8Array([0x90, 60 + (i % 5), 100]), performance.now(), 'test');
      midi.handleBytes(new Uint8Array([0x80, 60 + (i % 5), 0]), performance.now(), 'test');
    }
    const firm = midi.typicalTouch!;
    expect(firm).not.toBeNull();
    if (before !== null) expect(firm).toBeGreaterThan(Math.min(before, 0.5));
    // A run of the top key, pressed hard as a button, changes nothing.
    for (let i = 0; i < 20; i++) {
      midi.handleBytes(new Uint8Array([0x90, 108, 127]), performance.now(), 'test');
      midi.handleBytes(new Uint8Array([0x80, 108, 0]), performance.now(), 'test');
    }
    expect(midi.typicalTouch).toBe(firm);
    // Softer playing brings it down, gradually.
    for (let i = 0; i < 60; i++) {
      midi.handleBytes(new Uint8Array([0x90, 62, 50]), performance.now(), 'test');
      midi.handleBytes(new Uint8Array([0x80, 62, 0]), performance.now(), 'test');
    }
    expect(midi.typicalTouch!).toBeLessThan(firm);
    expect(midi.typicalTouch!).toBeGreaterThan(50 / 127);
  });
});

describe('a piano joined by cable and by Bluetooth at once', () => {
  type FakeIn = { id: string; name: string; state: string; transport?: string; onmidimessage: ((e: { data: Uint8Array; timeStamp: number }) => void) | null };
  type FakeOut = { id: string; name: string; state: string; transport?: string; send: (d: number[]) => void; sent: number[][] };
  const input = (id: string, name: string, transport?: string): FakeIn => ({ id, name, state: 'connected', transport, onmidimessage: null });
  const output = (id: string, name: string, transport?: string): FakeOut => {
    const o: FakeOut = { id, name, state: 'connected', transport, sent: [], send: (d) => void o.sent.push(Array.from(d)) };
    return o;
  };
  const plug = async (ins: FakeIn[], outs: FakeOut[]) => {
    const access = { inputs: { forEach: (fn: (p: FakeIn) => void) => ins.forEach(fn) }, outputs: { forEach: (fn: (p: FakeOut) => void) => outs.forEach(fn) }, onstatechange: null };
    Object.defineProperty(globalThis.navigator, 'requestMIDIAccess', { configurable: true, writable: true, value: () => Promise.resolve(access) });
    await midi.connect();
  };
  const key = (port: FakeIn, bytes: number[]) => port.onmidimessage?.({ data: new Uint8Array(bytes), timeStamp: performance.now() });
  let heard: NoteInput[] = [];
  let off: () => void = () => undefined;
  beforeEach(() => {
    heard = [];
    off = noteBus.subscribe((e) => heard.push(e));
  });
  afterEach(() => {
    off();
    midi.disconnect();
  });

  it('uses the cable and leaves the Bluetooth link alone, in and out', async () => {
    const usb = input('in:1', 'P-525', 'cable');
    const ble = input('in:2', 'P-525 MIDI', 'bluetooth');
    const usbOut = output('out:1', 'P-525', 'cable');
    const bleOut = output('out:2', 'P-525 MIDI', 'bluetooth');
    await plug([usb, ble], [usbOut, bleOut]);
    const status = midi.getStatus();
    expect(status.inputs.map((p) => p.name)).toEqual(['P-525']);
    expect(status.aside.map((p) => p.name)).toEqual(['P-525 MIDI']);
    expect(status.outputs.map((p) => p.name)).toEqual(['P-525']);
    // One key, reported by both links, is heard once.
    key(usb, [0x90, 60, 90]);
    key(ble, [0x90, 60, 90]);
    key(usb, [0x80, 60, 0]);
    key(ble, [0x80, 60, 0]);
    expect(heard.map((e) => e.type)).toEqual(['on', 'off']);
    // A note the app plays goes to the piano once.
    midi.send([0x90, 64, 80]);
    expect(usbOut.sent).toEqual([[0x90, 64, 80]]);
    expect(bleOut.sent).toEqual([]);
  });

  it('with Bluetooth alone, uses Bluetooth', async () => {
    const ble = input('in:2', 'P-525 MIDI', 'bluetooth');
    const bleOut = output('out:2', 'P-525 MIDI', 'bluetooth');
    await plug([ble], [bleOut]);
    expect(midi.getStatus().inputs.map((p) => p.name)).toEqual(['P-525 MIDI']);
    expect(midi.getStatus().aside).toEqual([]);
    key(ble, [0x90, 60, 90]);
    expect(heard.map((e) => e.type)).toEqual(['on']);
    midi.send([0x90, 64, 80]);
    expect(bleOut.sent).toHaveLength(1);
  });

  it('finds a second link by its echo where the system does not say which is which', async () => {
    const a = input('in:1', 'P-525');
    const b = input('in:2', 'Digital Piano');
    const outA = output('out:1', 'P-525');
    const outB = output('out:2', 'Digital Piano');
    await plug([a, b], [outA, outB]);
    expect(midi.getStatus().inputs).toHaveLength(2);
    // Each key arrives on one and then, a moment later, on the other. Even a short note is heard once.
    for (const note of [60, 62, 64, 65]) {
      key(a, [0x90, note, 90]);
      key(a, [0x80, note, 0]);
      key(b, [0x90, note, 90]);
      key(b, [0x80, note, 0]);
    }
    expect(heard.filter((e) => e.type === 'on').map((e) => e.midi)).toEqual([60, 62, 64, 65]);
    expect(heard.filter((e) => e.type === 'off')).toHaveLength(4);
    // After a few, the second link is left alone, and notes go out by the first only.
    expect(midi.getStatus().inputs.map((p) => p.name)).toEqual(['P-525']);
    expect(midi.getStatus().aside.map((p) => p.name)).toEqual(['Digital Piano']);
    midi.send([0x90, 64, 80]);
    expect(outA.sent).toHaveLength(1);
    expect(outB.sent).toHaveLength(0);
  });
});
