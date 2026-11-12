import type { Lesson } from '../types';

/**
 * Stage 5. Fluency: the pedal, minor keys, quicker notes, two independent
 * lines, and broken chord patterns.
 */
export const STAGE5: Lesson[] = [
  {
    id: 'pedal',
    stage: 5,
    title: 'The pedal',
    summary: 'Letting notes ring on, and changing the pedal cleanly.',
    minutes: 9,
    steps: [
      {
        kind: 'say',
        title: 'What it does',
        text: 'The **right pedal** lifts the dampers off the strings, so notes keep sounding after you let go of the keys. It joins chords that your fingers cannot join and gives the piano its warmth.\n\nKeep your heel on the floor and press with the ball of your foot.',
      },
      {
        kind: 'say',
        title: 'Hands first, then foot',
        text: 'The skill is in **when** you change it. If the pedal stays down through a chord change, the two chords smear together.\n\nSo the foot moves just **after** the hands. Play the new chord, then let the pedal up and straight back down. The old sound clears and the new one is caught.\n\nSay it as you do it: play, change. Play, change.',
      },
      {
        kind: 'play',
        text: 'Four chords. Pedal down after the first, then change the pedal just after each new chord sounds.',
        music: {
          rh: 'C4+E4+G4w:135 | C4+F4+A4w:135 | B3+D4+G4w:125 | C4+E4+G4w:135',
          lh: 'C3w:1 | F2w:5 | G2w:4 | C3w:1',
          chords: 'C | F | G | C',
          tempo: 66,
        },
        hints: 'delay',
      },
      {
        kind: 'say',
        title: 'Listen for two faults',
        text: 'A **gap** between chords means the pedal came up too early, before the new chord was played.\n\nA **blur** means it came up too late, or not all the way.\n\nYour ear is the judge here. When it is right, the chords melt into each other with nothing lost and nothing left over.',
      },
      {
        kind: 'play',
        text: 'The melody by Dvořák, both hands, with a pedal change at the start of each measure.',
        music: { piece: 'largo', from: 1, to: 4 },
        hints: 'delay',
      },
      {
        kind: 'quiz',
        question: 'When should the pedal change?',
        choices: ['Just before the new chord', 'Just after the new chord is played', 'Exactly halfway through the measure'],
        answer: 1,
        explain: 'Play the new chord, then change. That clears the old harmony without leaving a gap.',
      },
      {
        kind: 'say',
        title: 'Use it lightly',
        text: 'The pedal is easy to overuse. Add it where it helps, and take your foot off for music that should be crisp. The Minuet later in this stage needs none at all.',
      },
    ],
  },
  {
    id: 'minor-keys',
    stage: 5,
    title: 'Minor keys',
    summary: 'A minor, its raised seventh, and Greensleeves.',
    minutes: 11,
    pieces: ['greensleeves'],
    cards: ['read:T:57', 'read:T:59', 'read:T:81'],
    steps: [
      {
        kind: 'say',
        title: 'The same notes, a new home',
        text: 'Play the white keys from **A to A** and you have the scale of **A minor**. It uses exactly the notes of C major, but it settles on A, and that changes its whole character.\n\nEvery major key has a minor partner like this, with the same key signature.',
      },
      {
        kind: 'play',
        text: 'A minor, right hand. The fingering is the one you know from C major.',
        music: { rh: 'A3q:1 B3q:2 C4q:3 D4q:1 | E4q:2 F4q:3 G4q:4 A4q:5', tempo: 80, key: 'Am' },
        hints: 'always',
      },
      {
        kind: 'say',
        title: 'One raised note',
        text: 'Composers found that minor music pulls home more strongly if the seventh note is raised a half step. In A minor that turns G into **G sharp**.\n\nThis version is called the **harmonic minor**. That one changed note gives it a slightly exotic sound.',
      },
      {
        kind: 'play',
        text: 'A harmonic minor. Finger 4 plays G sharp, the black key.',
        music: { rh: 'A3q:1 B3q:2 C4q:3 D4q:1 | E4q:2 F4q:3 G#4q:4 A4q:5', tempo: 80, key: 'Am' },
        hints: 'always',
      },
      {
        kind: 'play',
        text: 'The three main chords of A minor, moved smoothly. The last but one has that G sharp in it.',
        music: { rh: 'A3+C4+E4w:135 | A3+D4+F4w:135 | G#3+B3+E4w:125 | A3+C4+E4w:135', tempo: 66, key: 'Am', chords: 'Am | Dm | E | Am' },
        hints: 'delay',
      },
      {
        kind: 'say',
        title: 'Greensleeves',
        text: 'This English tune is more than four hundred years old. It is in A minor and in three time, and near its end it uses both F sharp and G sharp as it climbs home to A.',
      },
      { kind: 'listen', text: 'Listen to the first phrase.', music: { piece: 'greensleeves', from: 1, to: 5 } },
      { kind: 'play', text: 'The melody. It covers more ground than you are used to, so follow the fingering.', music: { piece: 'greensleeves', from: 1, to: 5 }, hands: ['R'], hints: 'delay' },
      { kind: 'play', text: 'Both hands. The left hand holds one note in each measure.', music: { piece: 'greensleeves', from: 1, to: 5 }, hints: 'delay' },
    ],
  },
  {
    id: 'sixteenths',
    stage: 5,
    title: 'Quicker notes',
    summary: 'Sixteenth notes, and time signatures with an eight underneath.',
    minutes: 9,
    steps: [
      {
        kind: 'say',
        title: 'Four to a beat',
        text: 'A **sixteenth note** is half as long as an eighth, so four fit in one beat. They have two beams.\n\nCount them **one e and a, two e and a**. The number lands on the click.',
        figure: { kind: 'staff', music: { rh: 'G4s G4s G4s G4s G4e G4e G4q G4q' }, caption: 'Four sixteenths, two eighths, two quarters' },
      },
      {
        kind: 'play',
        text: 'Tap it on any key. Keep the four quick notes even.',
        music: { rh: 'G4s G4s G4s G4s G4q G4e G4e G4q | G4q G4s G4s G4s G4s G4h', tempo: 60 },
        mode: 'tempo',
        anyKey: true,
      },
      {
        kind: 'play',
        text: 'A quick run up, and a quick run down.',
        music: { rh: 'C4s:1 D4s E4s F4s G4q:5 G4s F4s E4s D4s C4q:1 | C4w', tempo: 60 },
        hints: 'delay',
      },
      { kind: 'play', text: 'With the beat. Slow is fine.', music: { rh: 'C4s:1 D4s E4s F4s G4q:5 G4s F4s E4s D4s C4q:1 | C4w', tempo: 60 }, mode: 'tempo' },
      {
        kind: 'say',
        title: 'An eight underneath',
        text: 'So far the bottom number of the time signature has been 4, which means the quarter note is the beat. When the bottom number is **8**, the **eighth note** is the beat instead.\n\nThree over eight means three eighth notes in each measure. The opening of Für Elise is written this way.',
        figure: { kind: 'staff', music: { rh: 'G4e G4e G4e | G4q G4e | G4q.', time: [3, 8] }, caption: 'Three eighth notes to a measure' },
      },
      {
        kind: 'play',
        text: 'Tap it. Each click is now an eighth note.',
        music: { rh: 'G4e G4e G4e | G4q G4e | G4s G4s G4e G4e | G4q.', time: [3, 8], tempo: 56 },
        mode: 'tempo',
        anyKey: true,
      },
    ],
  },
  {
    id: 'two-lines',
    stage: 5,
    title: 'Two melodies at once',
    summary: 'A minuet in which each hand has a line of its own.',
    minutes: 12,
    pieces: ['minuet'],
    cards: ['read:T:83', 'read:B:43', 'read:B:64'],
    steps: [
      {
        kind: 'say',
        title: 'Not melody and accompaniment',
        text: 'In everything so far the left hand has supported the right. In music from the time of Bach the two hands are often **equals**, each with its own melody, answering one another.\n\nThis is the real test of independence, and it is deeply satisfying when it comes.',
      },
      {
        kind: 'say',
        title: 'How to learn it',
        text: 'Learn each line until you could sing it. Then put them together slowly, and notice three things as you go.\n\nWhere do the hands move **together**? Where does one **hold** while the other moves? Where do they move in **opposite** directions?\n\nKnowing which is which turns a tangle into a pattern.',
      },
      { kind: 'listen', text: 'The **Minuet in G**. Listen to both lines.', music: { piece: 'minuet', from: 1, to: 4 } },
      { kind: 'play', text: 'The right hand. The eighth notes run up by step.', music: { piece: 'minuet', from: 1, to: 4 }, hands: ['R'], hints: 'delay' },
      { kind: 'play', text: 'The left hand. Long notes, mostly.', music: { piece: 'minuet', from: 1, to: 4 }, hands: ['L'], hints: 'delay' },
      {
        kind: 'play',
        text: 'Together, very slowly. Get it right twice.',
        music: { piece: 'minuet', from: 1, to: 4 },
        hints: 'delay',
        passes: 2,
      },
      { kind: 'play', text: 'With the beat, well under speed.', music: { piece: 'minuet', from: 1, to: 4 }, mode: 'tempo', tempoPct: 60 },
      {
        kind: 'say',
        title: 'Patience pays here',
        text: 'This piece will take more days than anything so far. That is expected. The coach will keep the tempo low until both lines are secure, and that is the right place for it to be.',
      },
    ],
  },
  {
    id: 'broken-chords',
    stage: 5,
    title: 'Chords in motion',
    summary: 'Arpeggios and the rocking left hand of classical music.',
    minutes: 10,
    steps: [
      {
        kind: 'say',
        title: 'One note at a time',
        text: 'A chord played one note after another is an **arpeggio**. It gives harmony and movement at once.\n\nA very common left hand shape plays the notes of a chord in the order **bottom, top, middle, top**. It keeps a gentle rocking motion going under a tune.',
      },
      {
        kind: 'play',
        text: 'The rocking pattern on three chords. The hand stays in one place for each chord.',
        music: {
          lh: 'C3e:5 G3e:1 E3e:3 G3e:1 C3e G3e E3e G3e | C3e:5 A3e:1 F3e:2 A3e:1 C3e A3e F3e A3e | B2e:5 G3e:1 D3e:3 G3e:1 B2e G3e D3e G3e | C3+E3+G3w:531',
          chords: 'C | F | G | C',
          tempo: 72,
        },
        hints: 'always',
      },
      { kind: 'play', text: 'With the beat, slowly and evenly.', music: { lh: 'C3e:5 G3e:1 E3e:3 G3e:1 C3e G3e E3e G3e | C3e:5 A3e:1 F3e:2 A3e:1 C3e A3e F3e A3e | B2e:5 G3e:1 D3e:3 G3e:1 B2e G3e D3e G3e | C3+E3+G3w:531', chords: 'C | F | G | C', tempo: 72 }, mode: 'tempo', tempoPct: 80 },
      {
        kind: 'say',
        title: 'Under a tune',
        text: 'Here is the Ode to Joy for the last time, with that rocking left hand. Keep the left hand quieter than the right so the melody stays on top.',
      },
      {
        kind: 'play',
        text: 'Both hands. The left hand plays two notes for every one in the right.',
        music: {
          rh: 'E4q:3 E4q F4q G4q | G4q F4q E4q D4q | C4q:1 C4q D4q E4q | E4q D4q D4h',
          lh: 'C3e:5 G3e:1 E3e:3 G3e C3e G3e E3e G3e | B2e:5 G3e:1 D3e:3 G3e B2e G3e D3e G3e | C3e:5 G3e:1 E3e:3 G3e C3e G3e E3e G3e | B2e:5 G3e:1 D3e:3 G3e B2+D3+G3h:531',
          chords: 'C | G | C | G',
          tempo: 72,
        },
        hints: 'delay',
      },
      {
        kind: 'play',
        text: 'A right hand arpeggio, reaching across an octave. Fingers 1, 2, 3 and 5.',
        music: { rh: 'C4q:1 E4q:2 G4q:3 C5q:5 | G4q:3 E4q:2 C4h:1', tempo: 80 },
        hints: 'always',
      },
      {
        kind: 'quiz',
        question: 'What is an arpeggio?',
        choices: ['A chord played one note at a time', 'A very fast scale', 'Two notes a step apart'],
        answer: 0,
        explain: 'The notes of a chord, spread out in time.',
      },
      {
        kind: 'say',
        title: 'Stage five, done',
        text: 'You have the pedal, minor keys, quick notes, independent hands and moving chords. One stage remains, and it is about becoming a musician as well as a player.',
      },
    ],
  },
];
