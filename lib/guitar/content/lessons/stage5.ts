import type { Lesson } from '../types';

/**
 * Stage 5. Picking with the fingers: the thumb on the bass, the fingers on
 * the top strings, broken chords in six eight, and an old English tune.
 */
export const STAGE5: Lesson[] = [
  {
    id: 'thumb-and-fingers',
    stage: 5,
    title: 'Thumb and fingers',
    summary: 'Picking the strings of a chord one at a time.',
    minutes: 10,
    songs: ['evening-song-picked'],
    steps: [
      {
        kind: 'say',
        title: 'Each finger has a string',
        text: 'Put the pick down. Your **thumb** plays the bass string of each chord. The **first finger** plays the G string, the **middle finger** the B string, the **ring finger** the high E string.\n\nRest the fingers lightly on their strings, and let them pluck by curling in toward your palm.',
        figure: { kind: 'strings', highlight: [3, 2, 1], caption: 'First, middle and ring fingers, one string each' },
      },
      {
        kind: 'play',
        text: 'Hold E minor. Thumb on the low E string, then G, B, G, high E, G, B, G. In your own time.',
        music: { chart: 'Em', pick: 'p 3 2 3 1 3 2 3', tempo: 66 },
        display: 'tab',
        hints: 'always',
      },
      {
        kind: 'play',
        text: 'Now on C. The thumb moves to the A string, the bass of C.',
        music: { chart: 'C', pick: 'p 3 2 3 1 3 2 3', tempo: 66 },
        display: 'tab',
        hints: 'delay',
      },
      {
        kind: 'play',
        text: 'The four chords, slowly, with the beat.',
        music: { chart: 'G | Em | C | D', pick: 'p 3 2 3 1 3 2 3', tempo: 66 },
        display: 'tab',
        mode: 'tempo',
        tempoPct: 75,
      },
      {
        kind: 'listen',
        text: '**Evening Song**, picked.',
        music: { song: 'evening-song-picked' },
        display: 'tab',
      },
    ],
  },
  {
    id: 'rising-sun',
    stage: 5,
    title: 'Broken chords in six eight',
    summary: 'An easy F, and the famous rising pattern.',
    minutes: 12,
    chords: ['Fmaj7'],
    songs: ['rising-sun'],
    steps: [
      {
        kind: 'say',
        title: 'Six eight',
        text: 'Six eight time has two big beats in a bar, each split in three: **ONE** two three **FOUR** five six. It rolls, like a boat on water.',
        figure: { kind: 'pattern', pattern: 'D..D..', time: [6, 8] },
      },
      {
        kind: 'say',
        title: 'An easy F',
        text: '**Fmaj7** stands in for F until F itself comes later: the third finger on the D string at the third fret, the second finger on the G string at the second fret, the first finger on the B string at the first fret. The high E rings open.',
        figure: { kind: 'chord', chord: 'Fmaj7' },
      },
      {
        kind: 'strings',
        text: 'Pick each string of Fmaj7 on its own, from the D string down.',
        chord: 'Fmaj7',
      },
      {
        kind: 'changes',
        text: 'Change between D and Fmaj7.',
        from: 'D',
        to: 'Fmaj7',
        times: 6,
      },
      {
        kind: 'play',
        text: 'Hold A minor. Thumb on the A string, then up G, B, high E, and back down B, G.',
        music: { chart: 'Am', pick: 'p 3 2 1 2 3', time: [6, 8], tempo: 72 },
        display: 'tab',
        hints: 'always',
      },
      {
        kind: 'listen',
        text: 'The **Rising Sun** broken chords, round the whole sequence.',
        music: { song: 'rising-sun' },
        display: 'tab',
      },
      {
        kind: 'play',
        text: 'Play it in your own time, chord by chord.',
        music: { song: 'rising-sun', from: 1, to: 8 },
        display: 'tab',
        hints: 'delay',
      },
    ],
  },
  {
    id: 'greensleeves',
    stage: 5,
    title: 'Greensleeves',
    summary: 'A tune four centuries old, in A minor.',
    minutes: 10,
    songs: ['greensleeves'],
    steps: [
      {
        kind: 'say',
        title: 'A minor melody',
        text: 'Greensleeves uses the notes you know, with two new ones: **G sharp** on the G string at the first fret, and **F sharp** on the D string at the fourth. Let each note ring into the next.',
        figure: {
          kind: 'neck',
          frets: 4,
          marks: [
            { string: 3, fret: 1, label: 'G#' },
            { string: 4, fret: 4, label: 'F#' },
          ],
        },
      },
      {
        kind: 'listen',
        text: '**Greensleeves**.',
        music: { song: 'greensleeves' },
        display: 'tab',
      },
      {
        kind: 'play',
        text: 'The first line, in your own time.',
        music: { song: 'greensleeves', from: 1, to: 9 },
        display: 'tab',
        hints: 'delay',
      },
    ],
  },
];
