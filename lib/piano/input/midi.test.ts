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

  it('releases held keys when the piano says all notes off', () => {
    send(0x90, 60, 90);
    send(0x90, 67, 90);
    send(0xb0, 123, 0);
    expect(notes.filter((n) => n.type === 'off').map((n) => n.midi).sort()).toEqual([60, 67]);
  });
});
