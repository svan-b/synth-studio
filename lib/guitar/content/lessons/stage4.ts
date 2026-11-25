import type { Lesson } from '../types';

/**
 * Stage 4. Single notes and tab: reading the six lines, the notes of the
 * first position, and melodies played note by note, including tunes you
 * already know from strumming them.
 */
export const STAGE4: Lesson[] = [
  {
    id: 'reading-tab',
    stage: 4,
    title: 'Reading tab',
    summary: 'Six lines for six strings, and a first melody.',
    minutes: 10,
    songs: ['ode-to-joy'],
    steps: [
      {
        kind: 'say',
        title: 'Six lines, six strings',
        text: 'Guitar music is often written as **tab**. Each of the six lines is a string, with the **thinnest string at the top**, the way you look down at the guitar.\n\nA number on a line is the fret to press on that string. **0** means play it open. You read it from left to right.',
        figure: { kind: 'tab', music: { line: 'E4q F4q G4q F4q | E4w' }, caption: 'The high E string: open, first fret, third fret, first fret, open' },
      },
      {
        kind: 'say',
        title: 'Notes on the top string',
        text: 'On the thin E string: **open is E**, the first fret is **F**, the third fret is **G**. Use the first finger for the first fret and the third finger for the third.',
        figure: {
          kind: 'neck',
          frets: 4,
          marks: [
            { string: 1, fret: 0, label: 'E' },
            { string: 1, fret: 1, label: 'F' },
            { string: 1, fret: 3, label: 'G' },
          ],
        },
      },
      {
        kind: 'play',
        text: 'Play these, reading the tab. The note to play lights up.',
        music: { line: 'E4q F4q:1 G4q:3 F4q:1 | E4w' },
        display: 'tab',
        hints: 'always',
      },
      {
        kind: 'play',
        text: 'Again, and this time the notes stay dark unless you pause.',
        music: { line: 'E4q F4q:1 G4q:3 F4q:1 | E4w' },
        display: 'tab',
        hints: 'delay',
        why: 'Help that fades as you improve leads to better playing without the help later. Notes that are always lit teach you to follow lights.',
      },
      {
        kind: 'say',
        title: 'The B string',
        text: 'On the B string: **open is B**, the first fret is **C**, the third fret is **D**. The same fingers as before.',
        figure: {
          kind: 'neck',
          frets: 4,
          marks: [
            { string: 2, fret: 0, label: 'B' },
            { string: 2, fret: 1, label: 'C' },
            { string: 2, fret: 3, label: 'D' },
          ],
        },
      },
      {
        kind: 'play',
        text: 'On the B string now.',
        music: { line: 'B3q C4q:1 D4q:3 C4q:1 | B3w' },
        display: 'tab',
        hints: 'delay',
      },
      {
        kind: 'echo',
        text: 'Hear three notes on these two strings, then play them back.',
        motifs: ['E4q F4q G4h', 'G4q F4q E4h', 'C4q D4q E4h', 'D4q C4q B3h'],
      },
      {
        kind: 'listen',
        text: '**Ode to Joy**, on the two top strings. Follow the tab as it plays.',
        music: { song: 'ode-to-joy' },
        display: 'tab',
      },
      {
        kind: 'play',
        text: 'Play it in your own time. The music waits for you.',
        music: { song: 'ode-to-joy' },
        display: 'tab',
        hints: 'always',
      },
    ],
  },
  {
    id: 'three-strings',
    stage: 4,
    title: 'Three strings',
    summary: 'The G string joins in, and two tunes.',
    minutes: 10,
    songs: ['twinkle', 'michael-row-tune'],
    steps: [
      {
        kind: 'say',
        title: 'The G string',
        text: 'On the G string: **open is G**, the second fret is **A**, played with the second finger. With the B and E strings that makes eight notes, a whole scale from G up to G.',
        figure: {
          kind: 'neck',
          frets: 4,
          marks: [
            { string: 3, fret: 0, label: 'G' },
            { string: 3, fret: 2, label: 'A' },
          ],
        },
      },
      {
        kind: 'play',
        text: 'Up the G scale, one note at a time.',
        music: { line: 'G3q A3q:2 B3q C4q:1 | D4q:3 E4q F#4q:2 G4q:3 | G4w:3' },
        display: 'tab',
        hints: 'always',
      },
      {
        kind: 'listen',
        text: '**Twinkle, Twinkle, Little Star**, on three strings.',
        music: { song: 'twinkle' },
        display: 'tab',
      },
      {
        kind: 'play',
        text: 'Your turn, in your own time.',
        music: { song: 'twinkle' },
        display: 'tab',
        hints: 'delay',
      },
    ],
  },
  {
    id: 'melody-in-three',
    stage: 4,
    title: 'A melody in three',
    summary: 'The D string, and Amazing Grace note by note.',
    minutes: 10,
    songs: ['amazing-grace-tune'],
    steps: [
      {
        kind: 'say',
        title: 'The D string',
        text: 'On the D string, the second fret is **E** and the fourth fret is **F sharp**, played with the little finger. Together with the open strings above, that covers the tune of Amazing Grace.',
        figure: {
          kind: 'neck',
          frets: 4,
          marks: [
            { string: 4, fret: 2, label: 'E' },
            { string: 4, fret: 4, label: 'F#' },
          ],
        },
      },
      {
        kind: 'play',
        text: 'Warm up: these notes from the tune.',
        music: { line: 'E3q:2 F#3q:4 A3q:2 B3q | C#4h:2 B3h', time: [4, 4] },
        display: 'tab',
        hints: 'always',
      },
      {
        kind: 'listen',
        text: '**Amazing Grace**, the tune you strummed in waltz time, now note by note.',
        music: { song: 'amazing-grace-tune' },
        display: 'tab',
      },
      {
        kind: 'play',
        text: 'Play it in your own time.',
        music: { song: 'amazing-grace-tune' },
        display: 'tab',
        hints: 'delay',
      },
    ],
  },
];
