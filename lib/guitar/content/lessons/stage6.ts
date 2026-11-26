import type { Lesson } from '../types';

/**
 * Stage 6. Going further: the first barre chord, the blues, finding chords
 * by ear, and a song of your own.
 */
export const STAGE6: Lesson[] = [
  {
    id: 'f-chord',
    stage: 6,
    title: 'F, the first barre',
    summary: 'One finger across two strings, then across all six.',
    minutes: 12,
    chords: ['F'],
    songs: ['hillside'],
    steps: [
      {
        kind: 'say',
        title: 'A small barre',
        text: 'For F, the **first finger lies flat** across the B and high E strings at the first fret. The second finger goes on the G string at the second fret, the third on the D string at the third fret. Strum the top four strings.\n\nRoll the first finger slightly onto its side, since the bony edge presses better than the soft middle.',
        figure: { kind: 'chord', chord: 'F', variant: 'small' },
      },
      {
        kind: 'strings',
        text: 'Pick each string of F on its own. The two under the barre are the ones to listen for.',
        chord: 'F',
        variant: 'small',
      },
      {
        kind: 'changes',
        text: 'Change between C and F. Your first finger stays near the first fret.',
        from: 'C',
        to: 'F',
        times: 6,
      },
      {
        kind: 'say',
        title: 'The full barre, when you are ready',
        text: 'The full F lays the first finger across **all six strings**, with the E shape above it. It takes most people a few weeks. The small F does the job while your hand grows into it.',
        figure: { kind: 'chord', chord: 'F', variant: 'full' },
      },
      {
        kind: 'listen',
        text: '**Hillside**, with C, A minor, F and G.',
        music: { song: 'hillside' },
        display: 'chart',
      },
      {
        kind: 'play',
        text: 'Play each new chord once, in your own time.',
        music: { song: 'hillside' },
        display: 'chart',
      },
    ],
  },
  {
    id: 'blues',
    stage: 6,
    title: 'The blues',
    summary: 'Twelve bars, three chords, and a shuffle.',
    minutes: 12,
    songs: ['twelve-bar-blues'],
    steps: [
      {
        kind: 'say',
        title: 'Twelve bars',
        text: 'The blues has a shape of its own, twelve bars long: **four bars of A7, two of D7, two of A7, then E7, D7, A7, E7**. Then round again. Thousands of songs follow it.',
        figure: { kind: 'chords', chords: ['A7', 'D7', 'E7'] },
      },
      {
        kind: 'changes',
        text: 'Change between A7 and D7.',
        from: 'A7',
        to: 'D7',
        times: 6,
      },
      {
        kind: 'changes',
        text: 'And between E7 and D7.',
        from: 'E7',
        to: 'D7',
        times: 6,
      },
      {
        kind: 'listen',
        text: 'The **twelve bar blues** in A.',
        music: { song: 'twelve-bar-blues' },
        display: 'chart',
      },
      {
        kind: 'play',
        text: 'Play each new chord once, in your own time, all twelve bars.',
        music: { song: 'twelve-bar-blues' },
        display: 'chart',
      },
    ],
  },
  {
    id: 'by-ear',
    stage: 6,
    title: 'Chords by ear',
    summary: 'One, four and five, and finding the chords of a song yourself.',
    minutes: 10,
    steps: [
      {
        kind: 'say',
        title: 'One, four and five',
        text: 'In any key, three chords do most of the work. Musicians call them **one, four and five**. In G they are **G, C and D**. In A they are **A, D and E**. In D they are **D, G and A**.\n\nThe one chord is home. Five pulls hardest back toward it.',
      },
      {
        kind: 'quiz',
        question: 'A song is in G. Which chord is it most likely to end on?',
        choices: ['G', 'C', 'D'],
        answer: 0,
        explain: 'Songs nearly always end on the home chord, the one chord.',
      },
      {
        kind: 'quiz',
        question: 'Listen. Does this end at home, or does it sound unfinished?',
        choices: ['At home', 'Unfinished'],
        answer: 1,
        hear: { line: '[G]h [C]h | [G]h [D]h', tempo: 72 },
        explain: 'It stopped on D, the five chord, which leans back toward G.',
      },
      {
        kind: 'quiz',
        question: 'And this one?',
        choices: ['At home', 'Unfinished'],
        answer: 0,
        hear: { line: '[G]h [C]h | [D]h [G]h', tempo: 72 },
        explain: 'It came back to G, home.',
      },
      {
        kind: 'say',
        title: 'Finding a song\'s chords',
        text: 'Hum the song and find its last note on the guitar. That is usually the home chord. Then try the four and five chords where the tune seems to move away, and listen for which one fits. It is slow at first, and it is one of the most rewarding things a guitar can do.',
      },
    ],
  },
  {
    id: 'your-song',
    stage: 6,
    title: 'A song of your own',
    summary: 'Pick four chords, a pattern, and make something up.',
    minutes: 8,
    steps: [
      {
        kind: 'say',
        title: 'Your turn to write',
        text: 'Choose **four chords** you like, a bar each. Pick a strum pattern you know. Go round and round, and hum a tune over the top. That is how a great many songs begin.\n\nThere is no wrong answer here.',
        figure: { kind: 'chords', chords: ['G', 'C', 'Am', 'D'] },
      },
      {
        kind: 'play',
        text: 'Here are four to start with. Play them round twice with the beat, and hum along.',
        music: { chart: 'G | C | Am | D | G | C | Am | D', strum: 'D.DU.UDU', tempo: 72 },
        display: 'chart',
        mode: 'tempo',
        tempoPct: 90,
      },
      {
        kind: 'say',
        title: 'Keep going',
        text: 'You have come all the way through the course. From here, the best teacher is the music you love. Keep your songs in your fingers, add new ones, and play for the people around you.',
      },
    ],
  },
];
