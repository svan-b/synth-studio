import { describe, expect, it } from 'vitest';
import {
  chordPitches,
  diatonicTriads,
  keyInfo,
  midi,
  midiName,
  parseChordSymbol,
  parsePitch,
  pitchName,
  scaleRun,
  signatureAccidentals,
  transposePitch,
} from './theory';
import { handOnly, parseScore, sliceScore, stepsFor, transposeScore } from './score';

const names = (ps: ReturnType<typeof parsePitch>[]) => ps.map(pitchName).join(' ');

describe('theory', () => {
  it('converts pitches and midi numbers', () => {
    expect(midi('C4')).toBe(60);
    expect(midi('A4')).toBe(69);
    expect(midi('A0')).toBe(21);
    expect(midi('C8')).toBe(108);
    expect(midi('Bb3')).toBe(58);
    expect(midi('F#5')).toBe(78);
    expect(midi('Cb4')).toBe(59);
    expect(midiName(61)).toBe('C#4');
    expect(midiName(61, true)).toBe('Db4');
  });

  it('spells scales correctly', () => {
    expect(names(scaleRun(parsePitch('C4'), 'major'))).toBe('C4 D4 E4 F4 G4 A4 B4 C5');
    expect(names(scaleRun(parsePitch('F4'), 'major'))).toBe('F4 G4 A4 Bb4 C5 D5 E5 F5');
    expect(names(scaleRun(parsePitch('B3'), 'major'))).toBe('B3 C#4 D#4 E4 F#4 G#4 A#4 B4');
    expect(names(scaleRun(parsePitch('Gb3'), 'major'))).toBe('Gb3 Ab3 Bb3 Cb4 Db4 Eb4 F4 Gb4');
    expect(names(scaleRun(parsePitch('A3'), 'harmonicMinor'))).toBe('A3 B3 C4 D4 E4 F4 G#4 A4');
    expect(names(scaleRun(parsePitch('C4'), 'blues'))).toBe('C4 Eb4 F4 Gb4 G4 Bb4 C5');
    expect(names(scaleRun(parsePitch('D4'), 'dorian'))).toBe('D4 E4 F4 G4 A4 B4 C5 D5');
  });

  it('spells chords and inversions', () => {
    expect(names(chordPitches(parsePitch('C4'), 'maj'))).toBe('C4 E4 G4');
    expect(names(chordPitches(parsePitch('C4'), 'maj', 1))).toBe('E4 G4 C5');
    expect(names(chordPitches(parsePitch('C4'), 'maj', 2))).toBe('G4 C5 E5');
    expect(names(chordPitches(parsePitch('D4'), 'min'))).toBe('D4 F4 A4');
    expect(names(chordPitches(parsePitch('B3'), 'dim'))).toBe('B3 D4 F4');
    expect(names(chordPitches(parsePitch('G3'), '7'))).toBe('G3 B3 D4 F4');
    expect(names(chordPitches(parsePitch('Eb4'), 'maj'))).toBe('Eb4 G4 Bb4');
  });

  it('parses chord symbols', () => {
    expect(parseChordSymbol('Am').quality).toBe('min');
    expect(parseChordSymbol('G7').quality).toBe('7');
    expect(parseChordSymbol('Bbmaj7').label).toBe('B♭maj7');
    expect(parseChordSymbol('F/C').bass?.letter).toBe(0);
    expect(parseChordSymbol('Bdim').quality).toBe('dim');
    expect(parseChordSymbol('F#m7b5').quality).toBe('m7b5');
  });

  it('knows key signatures', () => {
    expect(keyInfo('G').signature).toBe(1);
    expect(keyInfo('Bb').signature).toBe(-2);
    expect(keyInfo('Am').signature).toBe(0);
    expect(keyInfo('F#m').signature).toBe(3);
    expect(signatureAccidentals('D')).toEqual([1, 0, 0, 1, 0, 0, 0]);
    expect(signatureAccidentals('Eb')).toEqual([0, 0, -1, 0, 0, -1, -1]);
  });

  it('builds diatonic triads', () => {
    expect(diatonicTriads('C').map((c) => c.symbol)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
    expect(diatonicTriads('C').map((c) => c.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(diatonicTriads('G').map((c) => c.symbol)).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F♯°']);
  });

  it('transposes with correct spelling', () => {
    expect(pitchName(transposePitch(parsePitch('C4'), 4, 7))).toBe('G4');
    expect(pitchName(transposePitch(parsePitch('E4'), 2, 4))).toBe('G#4');
    expect(pitchName(transposePitch(parsePitch('F4'), 3, 5))).toBe('Bb4');
    expect(pitchName(transposePitch(parsePitch('B4'), 1, 1))).toBe('C5');
    expect(pitchName(transposePitch(parsePitch('C4'), -1, -1))).toBe('B3');
  });
});

describe('score parser', () => {
  it('parses a simple melody into notes, steps and measures', () => {
    const s = parseScore({ rh: 'E4q:3 D4q:2 C4h:1 | E4q D4q C4h' });
    expect(s.measureCount).toBe(2);
    expect(s.totalBeats).toBe(8);
    expect(s.notes.map((n) => n.midi)).toEqual([64, 62, 60, 64, 62, 60]);
    expect(s.notes.map((n) => n.start)).toEqual([0, 1, 2, 4, 5, 6]);
    expect(s.notes[0].finger).toBe(3);
    expect(s.steps).toHaveLength(6);
    expect(s.hands).toEqual(['R']);
  });

  it('groups both hands into steps', () => {
    const s = parseScore({ rh: 'E4q E4q F4q G4q', lh: 'C3w' });
    expect(s.steps).toHaveLength(4);
    expect(s.steps[0].notes.map((n) => n.midi)).toEqual([48, 64]);
    expect(s.steps[1].notes.map((n) => n.midi)).toEqual([64]);
    expect(stepsFor(s, ['L'])).toHaveLength(1);
    expect(handOnly(s, 'R').steps[0].notes).toHaveLength(1);
  });

  it('handles chords, rests, dots and eighths', () => {
    const s = parseScore({ rh: 'C4+E4+G4h:135 rq E4e F4e | G4q. A4e G4h', time: [4, 4] });
    expect(s.steps[0].notes.map((n) => n.finger)).toEqual([1, 3, 5]);
    expect(s.staff.R[1].kind).toBe('rest');
    expect(s.notes.find((n) => n.midi === 69)?.start).toBe(5.5);
  });

  it('resolves ties into one sounding note', () => {
    const s = parseScore({ rh: 'C4h D4h~ | D4h E4h' });
    const d = s.notes.filter((n) => n.midi === 62);
    expect(d).toHaveLength(2);
    expect(d[0].tied).toBe(false);
    expect(d[0].dur).toBe(4);
    expect(d[1].tied).toBe(true);
    expect(s.steps).toHaveLength(3);
  });

  it('rejects measures that do not add up', () => {
    expect(() => parseScore({ rh: 'C4q D4q E4q' })).toThrow(/adds up to 3/);
    expect(() => parseScore({ rh: 'C4q D4q E4q', time: [3, 4] })).not.toThrow();
    expect(() => parseScore({ rh: 'C4e D4e E4e F4e G4e A4e', time: [6, 8] })).not.toThrow();
    expect(() => parseScore({ rh: 'C4x' })).toThrow(/Bad token/);
    expect(() => parseScore({ rh: 'C4w', lh: 'C3w | C3w' })).toThrow(/different measure counts/);
  });

  it('supports pickup measures', () => {
    const s = parseScore({ rh: 'G4q | C5q C5q D5q | E5h', time: [3, 4], pickup: 1 });
    expect(s.measureCount).toBe(3);
    expect(s.measureStarts).toEqual([0, 1, 4]);
    expect(s.totalBeats).toBe(6);
  });

  it('supports triplets', () => {
    const s = parseScore({ rh: 'C4et D4et E4et F4q G4h' });
    expect(s.totalBeats).toBeCloseTo(4, 6);
    expect(s.notes[3].start).toBeCloseTo(1, 6);
  });

  it('slices by measure and re-bases time', () => {
    const s = parseScore({ rh: 'C4w | D4w~ | D4w | E4w', lh: 'C3w | G3w | G3w | C3w' });
    const part = sliceScore(s, 2, 3);
    expect(part.measureCount).toBe(2);
    expect(part.measureOffset).toBe(2);
    expect(part.notes[0].start).toBe(0);
    // the tied D now starts the slice, so it must be struck
    expect(part.notes.find((n) => n.midi === 62)?.tied).toBe(false);
    expect(part.steps[0].notes.map((n) => n.midi)).toEqual([55, 62]);
    const first = sliceScore(s, 1, 2);
    expect(first.notes.filter((n) => n.midi === 62).map((n) => n.tied)).toEqual([false, true]);
    expect(first.notes.find((n) => n.midi === 62)?.dur).toBe(8);
  });

  it('transposes a score', () => {
    const s = parseScore({ rh: 'C4q E4q G4q B4q', key: 'C' });
    const g = transposeScore(s, 4, 7, 'G');
    expect(g.notes.map((n) => pitchName(n.pitch))).toEqual(['G4', 'B4', 'D5', 'F#5']);
    expect(g.key).toBe('G');
  });

  it('reads chord symbols per measure', () => {
    const s = parseScore({ rh: 'C4w | F4w', chords: 'C G | F' });
    expect(s.chords.map((c) => [c.symbol, c.start])).toEqual([
      ['C', 0],
      ['G', 2],
      ['F', 4],
    ]);
  });
});
