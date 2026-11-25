import { describe, expect, it } from 'vitest';
import { SHAPES, anchorFingers, chordPitchClasses, parseChord, sayChord, shapeFor, shapeMidis } from './chords';
import { bassStrings, changeSteps, changeTip, changesIn, parseChart, parseScore, sliceScore } from './score';
import { OPEN_MIDI, firstPosition, nearestString, noteName, parseNote, pitchClass } from './theory';

describe('the guitar', () => {
  it('tunes E A D G B E from the thick string to the thin one', () => {
    expect([6, 5, 4, 3, 2, 1].map((s) => noteName(OPEN_MIDI[s as 1]))).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
  });

  it('places notes in the first position the way a beginner plays them', () => {
    expect(firstPosition(parseNote('C4'))).toEqual({ string: 2, fret: 1 });
    expect(firstPosition(parseNote('B3'))).toEqual({ string: 2, fret: 0 });
    expect(firstPosition(parseNote('G#2'))).toEqual({ string: 6, fret: 4 });
    expect(firstPosition(parseNote('A3'))).toEqual({ string: 3, fret: 2 });
    expect(firstPosition(parseNote('E4'))).toEqual({ string: 1, fret: 0 });
    expect(firstPosition(parseNote('A4'))).toBeNull();
  });

  it('finds the string a tuner is hearing', () => {
    expect(nearestString(82)).toBe(6);
    expect(nearestString(112)).toBe(5);
    expect(nearestString(246)).toBe(2);
    expect(nearestString(330)).toBe(1);
  });
});

describe('chords', () => {
  it('reads chord symbols', () => {
    expect(parseChord('F#m')).toMatchObject({ root: 6, quality: 'm' });
    expect(parseChord('Bb7')).toMatchObject({ root: 10, quality: '7' });
    expect(chordPitchClasses('G/B')).toEqual([7, 11, 2]);
    expect(sayChord('Em')).toBe('E minor');
    expect(sayChord('A7')).toBe('A seven');
    expect(sayChord('F#m')).toBe('F sharp minor');
  });

  it('has every shape sound its own chord and nothing else', () => {
    for (const s of SHAPES) {
      const want = new Set(chordPitchClasses(s.chord));
      const got = new Set(shapeMidis(s).map(pitchClass));
      for (const pc of Array.from(got)) expect(want.has(pc), `${s.chord} ${s.variant ?? ''} sounds a note outside the chord`).toBe(true);
      // Every note of the chord is there, except that a seventh chord may leave out its fifth.
      const optional = new Set<number>();
      if (/7/.test(s.chord)) optional.add(pitchClass(parseChord(s.chord).root + 7));
      for (const pc of Array.from(want)) if (!optional.has(pc)) expect(got.has(pc), `${s.chord} ${s.variant ?? ''} is missing a note`).toBe(true);
    }
  });

  it('gives every fretted string a finger and every open or silent string none', () => {
    for (const s of SHAPES) {
      s.frets.forEach((f, i) => {
        const g = s.fingers[i];
        if (f === null) expect(g, `${s.chord} string ${6 - i}`).toBeNull();
        else if (f === 0) expect(g, `${s.chord} string ${6 - i}`).toBe(0);
        else expect(g !== null && g >= 1 && g <= 4, `${s.chord} string ${6 - i}`).toBe(true);
      });
    }
  });

  it('knows which fingers stay put through a change', () => {
    // From C to Am the first and second fingers stay where they are.
    const keep = anchorFingers(shapeFor('C'), shapeFor('Am'));
    expect(keep.map((k) => k.finger).sort()).toEqual([1, 2]);
    expect(changeTip('C', 'Am')).toMatch(/first and second fingers stay/);
    expect(changeTip('Em', 'E')).toMatch(/second and third fingers stay/);
  });

  it('picks bass notes for a boom chick pattern', () => {
    expect(bassStrings(shapeFor('G'), 'G')).toEqual({ root: 6, alt: 4 });
    expect(bassStrings(shapeFor('C'), 'C')).toEqual({ root: 5, alt: 3 });
    expect(bassStrings(shapeFor('D'), 'D')).toEqual({ root: 4, alt: 3 });
    expect(bassStrings(shapeFor('E'), 'E')).toEqual({ root: 6, alt: 5 });
    expect(bassStrings(shapeFor('A'), 'A')).toEqual({ root: 5, alt: 4 });
  });
});

describe('the notation', () => {
  it('reads a line of single notes in the first position, with strings and fingers when given', () => {
    const s = parseScore({ line: 'E4q F4q G4h | B3q C4q:1 D4h@2', tempo: 90 });
    expect(s.kind).toBe('notes');
    expect(s.measureCount).toBe(2);
    expect(s.steps).toHaveLength(6);
    const places = s.steps.map((st) => `${st.notes[0].place.string}:${st.notes[0].place.fret}`);
    expect(places).toEqual(['1:0', '1:1', '1:3', '2:0', '2:1', '2:3']);
    expect(s.steps[4].notes[0].finger).toBe(1);
  });

  it('puts a note on the string asked for', () => {
    const s = parseScore({ line: 'E4q@2 B3q@3 G3h' });
    expect(s.steps[0].notes[0].place).toEqual({ string: 2, fret: 5 });
    expect(s.steps[1].notes[0].place).toEqual({ string: 3, fret: 4 });
  });

  it('reads strums and rests in a line', () => {
    const s = parseScore({ line: '[Em]q [Em]q [Em]eu [Em]e rq' });
    expect(s.kind).toBe('strum');
    expect(s.steps.map((st) => st.strum?.dir)).toEqual(['down', 'down', 'up', 'down']);
    // A down strum of E minor sounds all six strings. An up strum catches the top four.
    expect(s.steps[0].strum?.midis).toHaveLength(6);
    expect(s.steps[2].strum?.strings).toEqual([1, 2, 3, 4]);
  });

  it('checks that measures add up', () => {
    expect(() => parseScore({ line: 'E4q F4q | G4h' })).toThrow(/Measure 1 has 2 beats/);
    expect(() => parseScore({ line: 'E4q F4q G4q', pickup: 3 })).not.toThrow();
    expect(() => parseScore({ line: '[Zz]q' })).toThrow();
  });

  it('reads a chart of chords per beat', () => {
    const bars = parseChart('G . . . | C . G . | D | Em D', [4, 4]);
    expect(bars[0]).toEqual([{ symbol: 'G', beats: 4 }]);
    expect(bars[1]).toEqual([
      { symbol: 'C', beats: 2 },
      { symbol: 'G', beats: 2 },
    ]);
    expect(bars[2]).toEqual([{ symbol: 'D', beats: 4 }]);
    expect(bars[3]).toEqual([
      { symbol: 'Em', beats: 2 },
      { symbol: 'D', beats: 2 },
    ]);
    expect(parseChart('Am | C', [6, 8])).toHaveLength(2);
    expect(() => parseChart('G . .', [4, 4])).toThrow();
  });

  it('turns a chart and a strum pattern into strums on the right beats', () => {
    const s = parseScore({ chart: 'G | C . G .', strum: 'D.DU.UDU', time: [4, 4], tempo: 80 });
    expect(s.kind).toBe('strum');
    const starts = s.steps.map((st) => st.start);
    expect(starts.slice(0, 6)).toEqual([0, 1, 1.5, 2.5, 3, 3.5]);
    // The chord changes halfway through the second measure.
    const second = s.steps.filter((st) => st.measure === 1).map((st) => st.strum!.chord);
    expect(second).toEqual(['C', 'C', 'C', 'G', 'G', 'G']);
    expect(s.chords.map((c) => c.symbol)).toEqual(['G', 'C', 'G']);
  });

  it('plays bass notes and strums in a waltz pattern', () => {
    const s = parseScore({ chart: 'G | D7', strum: 'B.D.D.', time: [3, 4], tempo: 100 });
    expect(s.steps[0].notes[0].midi).toBe(parseNote('G2'));
    expect(s.steps[1].strum?.chord).toBe('G');
    expect(s.steps[3].notes[0].midi).toBe(parseNote('D3'));
  });

  it('turns a picking pattern into notes on the chord strings', () => {
    const s = parseScore({ chart: 'Am | C', pick: 'p 3 2 1 2 3', time: [6, 8], tempo: 80 });
    expect(s.kind).toBe('pick');
    const first = s.steps.filter((st) => st.measure === 0).map((st) => st.notes[0].place.string);
    expect(first).toEqual([5, 3, 2, 1, 2, 3]);
    expect(s.steps[0].notes[0].midi).toBe(parseNote('A2'));
    expect(s.steps[6].notes[0].midi).toBe(parseNote('C3'));
  });

  it('lists chord changes and gives one step per change', () => {
    const s = parseScore({ chart: 'G | G | C | G . D . | G', strum: 'D.D.D.D.' });
    expect(changesIn(s)).toEqual([
      { from: 'G', to: 'C', count: 1 },
      { from: 'C', to: 'G', count: 1 },
      { from: 'G', to: 'D', count: 1 },
      { from: 'D', to: 'G', count: 1 },
    ]);
    expect(changeSteps(s).map((st) => st.strum!.chord)).toEqual(['G', 'C', 'G', 'D', 'G']);
  });

  it('slices measures out as a score of their own', () => {
    const s = parseScore({ chart: 'G | C | D | G', strum: 'D.D.D.D.' });
    const part = sliceScore(s, 1, 2);
    expect(part.measureCount).toBe(2);
    expect(part.measureOffset).toBe(1);
    expect(part.steps[0].start).toBe(0);
    expect(part.chords.map((c) => c.symbol)).toEqual(['C', 'D']);
  });
});
