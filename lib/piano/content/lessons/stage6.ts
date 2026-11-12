import type { Lesson } from '../types';

/**
 * Stage 6. Musicianship: richer chords, making music up, playing by ear,
 * and three pieces worth keeping for life.
 */
export const STAGE6: Lesson[] = [
  {
    id: 'seventh-chords',
    stage: 6,
    title: 'Seventh chords',
    summary: 'One more note on the stack, and the sound of jazz.',
    minutes: 9,
    steps: [
      {
        kind: 'say',
        title: 'Four notes',
        text: 'Add one more skip to the top of a triad and you get a **seventh chord**, named for the distance from its bottom note to its top.\n\nOn C that gives C, E, G, B, called **C major seven**. On G it gives G, B, D, F, called **G seven**. On D it gives D, F, A, C, called **D minor seven**.',
        figure: { kind: 'staff', music: { rh: 'C4+E4+G4+B4h D4+F4+A4+C5h | G3+B3+D4+F4w' }, caption: 'C major seven, D minor seven, G seven' },
      },
      {
        kind: 'play',
        text: 'Play each one. Four notes, fingers 1, 2, 3 and 5.',
        music: { rh: 'C4+E4+G4+B4w:1235 | D4+F4+A4+C5w:1235 | G3+B3+D4+F4w:1235 | C4+E4+G4+B4w:1235', tempo: 60, chords: 'Cmaj7 | Dm7 | G7 | Cmaj7' },
        hints: 'always',
      },
      {
        kind: 'say',
        title: 'Two, five, one',
        text: 'Put those three in the order **D minor seven, G seven, C major seven** and you have the most important progression in jazz, called two five one after the scale steps it is built on.\n\nPlayed with smooth movement between the chords, only two notes change each time.',
      },
      {
        kind: 'play',
        text: 'Two five one. Watch how little the right hand moves.',
        music: {
          rh: 'D4+F4+A4+C5w:1235 | D4+F4+G4+B4w:1235 | C4+E4+G4+B4w:1235',
          lh: 'D3w:1 | G2w:5 | C3w:2',
          chords: 'Dm7 | G7 | Cmaj7',
          tempo: 60,
        },
        hints: 'delay',
      },
      {
        kind: 'say',
        title: 'Where you will meet them',
        text: 'Seventh chords are everywhere in jazz, soul and film music. The Gymnopédie by Satie at the end of this stage rocks between two of them for its whole length.',
      },
    ],
  },
  {
    id: 'prelude',
    stage: 6,
    title: 'A prelude by Bach',
    summary: 'A whole piece made of rippling chords.',
    minutes: 11,
    pieces: ['prelude-c'],
    steps: [
      {
        kind: 'say',
        title: 'One chord in each measure',
        text: 'The first prelude from the Well Tempered Clavier looks like a stream of fast notes. It is really a slow walk through a series of chords, with each chord opened out into a ripple.\n\nSee it that way and it becomes far easier.',
      },
      {
        kind: 'say',
        title: 'Learn the chords first',
        text: 'Before playing a note as written, play each measure as a single held chord. Your hands learn the shapes, and the ripple is then only a matter of releasing the notes in order.\n\nMusicians call this blocking.',
      },
      {
        kind: 'play',
        text: 'The four chords of the opening, blocked. The left hand takes the bottom two notes.',
        music: {
          rh: 'G4+C5+E5w:124 | A4+D5+F5w:124 | G4+D5+F5w:135 | G4+C5+E5w:124',
          lh: 'C4+E4w:31 | C4+D4w:32 | B3+D4w:42 | C4+E4w:31',
          chords: 'C | Dm7 | G7 | C',
          tempo: 60,
        },
        hints: 'delay',
      },
      { kind: 'listen', text: 'Now hear how Bach wrote it.', music: { piece: 'prelude-c', from: 1, to: 2 } },
      { kind: 'play', text: 'The right hand ripple. Three notes, played twice, in each half measure.', music: { piece: 'prelude-c', from: 1, to: 2 }, hands: ['R'], hints: 'delay' },
      { kind: 'play', text: 'Both hands. The left hand plays two notes, then the right hand takes over.', music: { piece: 'prelude-c', from: 1, to: 2 }, hints: 'delay' },
      {
        kind: 'say',
        title: 'Even, not fast',
        text: 'This piece is beautiful slow. What matters is that every note is the same length and nearly the same loudness, like water running. Speed can wait.',
      },
    ],
  },
  {
    id: 'improvise',
    stage: 6,
    title: 'Making it up',
    summary: 'Five notes that cannot clash, and a few habits of good improvisers.',
    minutes: 9,
    steps: [
      {
        kind: 'say',
        title: 'Start where nothing sounds wrong',
        text: 'Improvising means making up music as you go. It feels daunting until you limit the choices.\n\nTake just five notes, **C, D, E, G and A**. This set is called a pentatonic scale, and whatever order you play them in, they sound good together.',
        figure: { kind: 'keys', low: 60, high: 72, marks: { 60: 'C', 62: 'D', 64: 'E', 67: 'G', 69: 'A', 72: 'C' }, labels: 'none' },
      },
      {
        kind: 'play',
        text: 'First get the five notes under your fingers.',
        music: { rh: 'C4q:1 D4q:2 E4q:3 G4q:1 | A4q:2 G4q:1 E4q:3 D4q:2 | C4w:1', tempo: 80 },
        hints: 'always',
      },
      { kind: 'listen', text: 'Here is the sort of thing you can do with them, over a held fifth in the left hand.', music: { rh: 'E4q G4q A4h | G4q E4q D4h | E4e G4e A4q G4q E4q | D4q C4h.', lh: 'C3+G3w | C3+G3w | C3+G3w | C3+G3w', tempo: 84 } },
      {
        kind: 'check',
        title: 'Now you',
        text: 'Hold C and G with your left hand, and let your right hand wander over those five notes. Nothing is being checked. Try each of these in turn.',
        items: [
          'Play a short idea of three or four notes, then stop and leave a gap.',
          'Play the same idea again, then change just its last note.',
          'Use a rhythm you could say out loud, like a spoken phrase.',
          'End on C when you want it to sound finished.',
        ],
      },
      {
        kind: 'say',
        title: 'Why bother',
        text: 'Improvising is not a separate talent. It uses the same link between ear and hand that you have been building since the first lesson, and people who improvise tend to be better readers too.',
        why: 'In an analysis of what goes with good sight reading, improvising and ear skills were among the strongest companions, alongside technical fluency.',
      },
    ],
  },
  {
    id: 'by-ear',
    stage: 6,
    title: 'Playing by ear',
    summary: 'Working out a tune, and then its chords, with no page.',
    minutes: 10,
    steps: [
      {
        kind: 'say',
        title: 'A method, not magic',
        text: 'People who play by ear are not guessing. They ask the same two questions of every note.\n\nIs the next note **higher, lower or the same**? And is it a **step or a jump**?\n\nYou have been answering those questions in the listening exercises since the first lesson. Now the patterns get longer.',
      },
      {
        kind: 'echo',
        text: 'Longer patterns. Each starts on **C**. Hum it first if that helps.',
        motifs: ['C4q D4q E4q C4q | E4q F4q G4h', 'C4q C4q G4q G4q | A4q A4q G4h', 'C4q E4q G4q E4q | F4q D4q C4h'],
      },
      {
        kind: 'say',
        title: 'Finding the chords',
        text: 'Once you have a tune, the chords are usually easier than you would think. In the key of C, try **C** first. Keep it until it starts to sound wrong, then try **G** or **F**.\n\nA good clue is the melody note on the strong beat. It is very often one of the notes of the chord.',
      },
      {
        kind: 'quiz',
        question: 'A melody in C lands on the note E on a strong beat. Which chord is the most likely?',
        choices: ['C', 'G', 'F'],
        answer: 0,
        explain: 'E is one of the notes of the C chord, C, E, G. It is not in G or F.',
      },
      {
        kind: 'quiz',
        question: 'The same melody then lands on B. Which chord fits now?',
        choices: ['C', 'F', 'G'],
        answer: 2,
        explain: 'B belongs to the G chord, G, B, D.',
      },
      {
        kind: 'say',
        title: 'Your own tune',
        text: 'Pick a song you know well and can sing. Find its first note, work out the tune a few notes at a time, then try the three chords under it.\n\nThis is slow the first few times and it gets quicker with every song. It is one of the most useful things a pianist can do.',
      },
    ],
  },
  {
    id: 'capstone',
    stage: 6,
    title: 'Two pieces to keep',
    summary: 'Für Elise and the first Gymnopédie, and where to go from here.',
    minutes: 12,
    pieces: ['fur-elise', 'gymnopedie'],
    steps: [
      {
        kind: 'say',
        title: 'Für Elise',
        text: 'The opening of this piece by Beethoven is one of the best known melodies there is. The two hands share a single line, passing it back and forth, so the join between them must not be heard.\n\nIt is written with three eighth notes to the measure.',
      },
      { kind: 'listen', text: 'Listen to the first phrase.', music: { piece: 'fur-elise', from: 1, to: 5 } },
      { kind: 'play', text: 'The right hand. It rocks between E and the black key just below it.', music: { piece: 'fur-elise', from: 1, to: 5 }, hands: ['R'], hints: 'delay' },
      { kind: 'play', text: 'Both hands. The left hand answers in the gaps.', music: { piece: 'fur-elise', from: 1, to: 5 }, hints: 'delay' },
      {
        kind: 'say',
        title: 'Gymnopédie No. 1',
        text: 'This piece by Erik Satie is slow, quiet and spacious. The left hand plays a low note and then leaps up to a chord, again and again, while a melody floats above.\n\nThe leap is the whole difficulty. Practise it until your hand knows the distance without your eyes.',
      },
      { kind: 'listen', text: 'Listen to the opening.', music: { piece: 'gymnopedie', from: 1, to: 8 } },
      { kind: 'play', text: 'The left hand alone. Low note, then the chord.', music: { piece: 'gymnopedie', from: 1, to: 4 }, hints: 'delay' },
      {
        kind: 'say',
        title: 'Where you are now',
        text: 'You can read music in both clefs, keep time, play with independent hands, build chords and scales in several keys, use the pedal, play by ear and make music up.\n\nThat is a real foundation. From here, learning a piece is mostly a matter of choosing one you love and practising it the way you now know how.',
      },
      {
        kind: 'say',
        title: 'What an app cannot do',
        text: 'This app hears which keys you press and when. It cannot see your hands, your wrists or your posture, and those matter more as the music gets harder.\n\nA few lessons with a good teacher, even now and then, will catch habits that no software can. Keep the daily session going alongside. Short and regular is still the rule.',
      },
    ],
  },
];
