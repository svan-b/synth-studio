import { afterEach, describe, expect, it, vi } from 'vitest';
import { instrument } from './instrument';
import { piano } from './engine';
import { midi } from '../input/midi';

describe('where the app plays, and how loudly', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    instrument.where = 'auto';
  });

  it('plays on the piano whenever the piano can play, unless the learner chose the iPad', () => {
    const out = vi.spyOn(midi, 'hasOutput', 'get');
    out.mockReturnValue(false);
    expect(instrument.onPiano).toBe(false);
    out.mockReturnValue(true);
    expect(instrument.onPiano).toBe(true);
    instrument.where = 'ipad';
    expect(instrument.onPiano).toBe(false);
    instrument.where = 'piano';
    expect(instrument.onPiano).toBe(true);
  });

  it('plays on the piano as firmly as the learner does', () => {
    vi.spyOn(midi, 'hasOutput', 'get').mockReturnValue(true);
    const touch = vi.spyOn(midi, 'typicalTouch', 'get');
    const sent = vi.spyOn(midi, 'playNote').mockImplementation(() => undefined);
    vi.spyOn(piano, 'play').mockImplementation(() => undefined);
    // A learner who plays firmly, at 100 of 127.
    touch.mockReturnValue(100 / 127);
    instrument.play(60, 0.5, 0.68, 1);
    expect(sent.mock.calls[0][2]).toBeCloseTo(100 / 127, 3);
    // The tune a touch above the written strength, the bass below it, as written.
    instrument.play(60, 0.5, 0.74, 1);
    instrument.play(48, 0.5, 0.56, 1);
    expect(sent.mock.calls[1][2]).toBeGreaterThan(100 / 127);
    expect(sent.mock.calls[2][2]).toBeLessThan(100 / 127);
    // Nothing known yet: a firm, ordinary strength, not a timid one.
    touch.mockReturnValue(null);
    instrument.play(60, 0.5, 0.68, 1);
    expect(sent.mock.calls[3][2]).toBeCloseTo(0.75, 3);
    // The learner's own take is played back exactly as they played it.
    instrument.play(60, 0.5, 0.3, 1, true);
    expect(sent.mock.calls[4][2]).toBe(0.3);
  });

  it('sends a strength on the same scale the piano uses for keys', () => {
    const port = { id: 'o', send: vi.fn(), clear: vi.fn() };
    (midi as unknown as { outputs: unknown[] }).outputs = [port];
    vi.spyOn(piano, 'now').mockReturnValue(10);
    // A note a tenth of a second from now is handed over at once, stamped with its time.
    midi.playNote(60, 0.5, 100 / 127, 10.1);
    expect(port.send).toHaveBeenCalledTimes(1);
    expect(port.send.mock.calls[0][0]).toEqual([0x90, 60, 100]);
    expect(port.send.mock.calls[0][1]).toBeGreaterThan(performance.now() + 50);
    // Stopping withdraws it, and sends its key up for after it would have sounded.
    midi.silence();
    expect(port.clear).toHaveBeenCalled();
    expect(port.send.mock.calls.some((c) => c[0][0] === 0x80 && c[0][1] === 60 && c[1] > performance.now())).toBe(true);
    (midi as unknown as { outputs: unknown[] }).outputs = [];
  });
});
