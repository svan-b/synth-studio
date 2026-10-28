// ============================================================================
// Studio lessons - the cross-instrument curriculum (device: 'studio').
// From one clock, to syncing gear, to mixing, to arranging and bouncing a
// finished track. Checks look at the studio itself (rack, cables, routes,
// transport, arrangement) so they keep working as instruments evolve.
// ============================================================================

import type { Lesson, LessonCheckState } from '@/types';

const has = (s: LessonCheckState, device: string) => Object.values(s.instances).some(i => i.device === device);
const instanceOf = (s: LessonCheckState, device: string) => Object.entries(s.instances).find(([, i]) => i.device === device)?.[0];
const cable = (s: LessonCheckState, fromDev: string, fromJack: string, toDev: string, toJack: string) => {
  const a = instanceOf(s, fromDev);
  const b = instanceOf(s, toDev);
  return s.studioCables.some(c =>
    (c.from.instance === a && c.from.jack === fromJack && c.to.instance === b && c.to.jack === toJack) ||
    (c.to.instance === a && c.to.jack === fromJack && c.from.instance === b && c.from.jack === toJack));
};
const routedToMixer = (s: LessonCheckState, device: string) => {
  const id = instanceOf(s, device);
  return !!id && (s.routes[id] ?? 'master') !== 'master';
};

export const STUDIO_LESSONS: Lesson[] = [
  {
    id: 'studio-1-one-clock',
    device: 'studio',
    path: 'studio',
    order: 1,
    difficulty: 'beginner',
    name: 'One clock for the whole studio',
    description: 'Tempo, the beat and why every instrument must share one clock.',
    objective: 'Start and stop the studio, set its tempo and hear the beat.',
    source: 'Synth Studio',
    estimatedMinutes: 4,
    requires: ['studio-clock'],
    concepts: ['timing-tempo'],
    steps: [
      {
        kind: 'info',
        instruction: 'A studio is many instruments playing as one. What makes them one is time: a shared clock.',
        principle: 'Music is organised time; a clock divides time into equal beats everything can agree on.',
        explanation: 'In a hardware studio one device is the master clock and every other device follows it - over MIDI or with clock pulses on a cable.',
      },
      {
        kind: 'predict',
        instruction: 'Press ▶ in the top bar.',
        predict: {
          question: 'The tempo reads 120 BPM. What does BPM count?',
          options: ['Beats per minute', 'Bars per minute', 'Notes per second'],
          answer: 0,
          explain: 'Beats (quarter notes) per minute. 120 BPM is two beats every second.',
        },
        check: s => s.transport.playing,
        principle: 'Tempo is the rate of the beat, measured in beats per minute.',
      },
      {
        kind: 'do',
        instruction: 'Turn on Click to hear every beat, then set the tempo to 90 BPM.',
        check: s => Math.abs(s.transport.bpm - 90) < 1,
        hints: ['Use the − button next to the BPM number, or type 90.'],
        principle: 'Lower BPM means a longer gap between beats; everything that follows the clock slows down together.',
      },
      {
        kind: 'quiz',
        instruction: 'Quick check.',
        quiz: {
          question: 'At 120 BPM, how long is one beat?',
          options: ['0.5 seconds', '1 second', '0.25 seconds'],
          answer: 0,
          explain: '60 seconds ÷ 120 beats = 0.5 s per beat. A 16th note is a quarter of that: 0.125 s.',
        },
      },
      {
        kind: 'reflect',
        instruction: 'Explain it.',
        reflect: {
          prompt: 'Why does every instrument in a studio need to follow the same clock?',
          model: 'So their notes land on the same beats. Two separate clocks drift apart, and the parts slide out of time with each other.',
        },
      },
    ],
    review: [
      { question: 'What does 120 BPM mean?', options: ['120 beats per minute', '120 bars per minute', '120 notes per second'], answer: 0, explain: 'Beats per minute - two beats each second at 120.' },
      { question: 'A 16th note at 120 BPM lasts…', options: ['0.125 s', '0.5 s', '0.016 s'], answer: 0, explain: 'One beat is 0.5 s; a 16th is a quarter of a beat.' },
      { question: 'What keeps several instruments in time?', options: ['A shared clock', 'The same volume', 'The same key'], answer: 0, explain: 'Every device follows one master clock.' },
    ],
  },
  {
    id: 'studio-2-clock-pulses',
    device: 'studio',
    path: 'studio',
    order: 2,
    difficulty: 'beginner',
    name: 'Sync gear without MIDI: clock pulses',
    description: 'Clock the DFAM from the studio with a patch cable, like real hardware.',
    objective: 'Patch a clock into a sequencer and control how fast it steps.',
    source: 'Synth Studio',
    estimatedMinutes: 6,
    requires: ['studio-clock', 'dfam'],
    prerequisites: ['studio-1-one-clock'],
    concepts: ['timing-tempo', 'signal-routing', 'sequencer-pattern'],
    steps: [
      {
        kind: 'info',
        instruction: 'The DFAM has no MIDI. Gear like this is synced with clock pulses: a short voltage spike for every step.',
        principle: 'A clock pulse is just a brief voltage; each one tells a sequencer "next step, now".',
      },
      {
        kind: 'predict',
        instruction: 'In the Studio tab, tap Studio Clock CLOCK OUT, then DFAM ADV/CLOCK.',
        instance: 'studio-clock',
        focus: ['out_clock'],
        predict: {
          question: 'CLOCK DIV is 1/16 and the tempo is 120 BPM. How many steps per second will the DFAM play?',
          options: ['8', '2', '4'],
          answer: 0,
          explain: '120 BPM is 2 beats per second, and 1/16 gives 4 pulses per beat: 2 × 4 = 8 steps per second.',
        },
        check: s => cable(s, 'studio-clock', 'out_clock', 'dfam', 'in_adv_clock'),
        principle: 'A patch cable carries the clock: whatever pulses arrive, the sequencer follows.',
      },
      {
        kind: 'do',
        instruction: 'Press ▶ in the top bar. The DFAM steps in time with the studio even though its own RUN is off.',
        check: s => s.transport.playing,
        principle: 'An external clock replaces the instrument\'s own tempo knob.',
      },
      {
        kind: 'challenge',
        instruction: 'Make the DFAM play half as fast without touching the tempo.',
        instance: 'studio-clock',
        focus: ['division'],
        checklist: [
          { text: 'CLOCK DIV set to 1/8', check: s => s.instances[instanceOf(s, 'studio-clock') ?? '']?.values.division === 1 },
        ],
        hints: ['Fewer pulses per beat means fewer steps.', 'Turn CLOCK DIV to 1/8.'],
        solution: { values: { division: 1 } },
      },
      {
        kind: 'quiz',
        instruction: 'Quick check.',
        quiz: {
          question: 'What is the RESET OUT jack for?',
          options: ['Starting sequencers on step 1 together', 'Making the clock louder', 'Changing the tempo'],
          answer: 0,
          explain: 'RESET fires once on Play; patched into a sequencer reset it makes every part start from the top together.',
        },
      },
      {
        kind: 'reflect',
        instruction: 'Explain it.',
        reflect: {
          prompt: 'How can two instruments with no MIDI play in time?',
          model: 'One sends clock pulses down a cable and the other advances a step on every pulse, so both follow the same clock.',
        },
      },
    ],
    review: [
      { question: 'A clock pulse tells a sequencer to…', options: ['Advance one step', 'Change pitch', 'Get louder'], answer: 0, explain: 'Each pulse = next step.' },
      { question: '1/16 at 120 BPM gives how many pulses per second?', options: ['8', '4', '16'], answer: 0, explain: '2 beats per second × 4 sixteenths.' },
      { question: 'Changing CLOCK DIV from 1/16 to 1/8 makes the sequence…', options: ['Half as fast', 'Twice as fast', 'Louder'], answer: 0, explain: 'Half as many pulses per beat.' },
    ],
  },
  {
    id: 'studio-3-midi-sync',
    device: 'studio',
    path: 'studio',
    order: 3,
    difficulty: 'intermediate',
    name: 'MIDI-style sync: one Play for everything',
    description: 'Make the Elektron drum machine and synth start, stop and keep tempo with the studio.',
    objective: 'Sync two sequencers so one Play starts both in time.',
    source: 'Synth Studio',
    estimatedMinutes: 5,
    requires: ['analog-rytm', 'analog-four'],
    prerequisites: ['studio-1-one-clock'],
    concepts: ['timing-tempo', 'sequencer-pattern'],
    steps: [
      {
        kind: 'info',
        instruction: 'Instruments with MIDI receive clock, start and stop as messages - 24 clock ticks for every beat.',
        principle: 'MIDI clock sends 24 ticks per quarter note plus start and stop, so followers lock to the leader\'s tempo.',
      },
      {
        kind: 'do',
        instruction: 'In the Studio tab, make sure "Sync to studio clock" is ticked for the Analog Rytm and the Analog Four.',
        check: s => ['analog-rytm', 'analog-four'].every(d => {
          const id = instanceOf(s, d);
          return !!id && s.sync[id] !== false;
        }),
        principle: 'A synced instrument ignores its own tempo and follows the leader.',
      },
      {
        kind: 'predict',
        instruction: 'Press ▶ in the top bar.',
        predict: {
          question: 'Both machines are synced. What happens when you change the studio tempo while they play?',
          options: ['Both speed up together', 'Only the drum machine changes', 'Nothing - they keep their own tempo'],
          answer: 0,
          explain: 'They follow the studio clock, so every tempo change reaches both at once.',
        },
        check: s => s.transport.playing,
      },
      {
        kind: 'quiz',
        instruction: 'Quick check.',
        quiz: {
          question: 'How many MIDI clock ticks make one beat?',
          options: ['24', '4', '96'],
          answer: 0,
          explain: '24 PPQN (pulses per quarter note) is the MIDI standard; a 16th note is 6 ticks.',
        },
      },
      {
        kind: 'reflect',
        instruction: 'Explain it.',
        reflect: {
          prompt: 'What is the difference between clock pulses on a cable and MIDI clock?',
          model: 'Both carry time. A pulse cable usually sends one pulse per step; MIDI sends 24 ticks per beat plus start, stop and song position, so followers can also start and stop together.',
        },
      },
    ],
    review: [
      { question: 'MIDI clock runs at…', options: ['24 ticks per quarter note', '1 tick per bar', '4 ticks per beat'], answer: 0, explain: '24 PPQN.' },
      { question: 'A synced instrument follows…', options: ["The leader's tempo and transport", 'Its own tempo knob', 'Whichever is faster'], answer: 0, explain: 'It locks to the master clock.' },
      { question: 'Besides ticks, MIDI sync sends…', options: ['Start and stop', 'Audio', 'Filter settings'], answer: 0, explain: 'Start/stop/continue and song position.' },
    ],
  },
  {
    id: 'studio-4-into-the-mixer',
    device: 'studio',
    path: 'studio',
    order: 4,
    difficulty: 'intermediate',
    name: 'Into the mixer',
    description: 'Route instruments into Xone:96 channels so you can balance, EQ and filter them.',
    objective: 'Route two instruments into mixer channels and balance them.',
    source: 'Synth Studio',
    estimatedMinutes: 6,
    requires: ['analog-rytm', 'xone96'],
    prerequisites: ['studio-1-one-clock'],
    concepts: ['mixing', 'gain-staging'],
    steps: [
      {
        kind: 'info',
        instruction: 'A mixer gives every instrument its own channel: gain, EQ, filter and a fader. That is where a track gets balanced.',
        principle: 'Mixing is balance: each part needs its own space in level and frequency.',
      },
      {
        kind: 'do',
        instruction: 'In the Studio tab, set the Analog Rytm\'s Output to a Xone:96 channel.',
        check: s => routedToMixer(s, 'analog-rytm'),
        principle: 'Routing sends an instrument\'s audio somewhere else; the mixer channel now controls it.',
      },
      {
        kind: 'predict',
        instruction: 'Press ▶ and watch that channel\'s meter on the Xone:96.',
        predict: {
          question: 'Before you touch the fader, what should you set first on a new channel?',
          options: ['The GAIN, so the meter peaks around 0', 'The crossfader', 'The master volume'],
          answer: 0,
          explain: 'Gain staging comes first: set each channel\'s input level, then balance with faders. Starting at the right level leaves headroom and keeps noise low.',
        },
        check: s => s.transport.playing,
      },
      {
        kind: 'quiz',
        instruction: 'Quick check.',
        quiz: {
          question: 'Why route the drums into the mixer instead of straight to the master?',
          options: ['To control their level, EQ and filter separately', 'Because it is louder', 'To change their tempo'],
          answer: 0,
          explain: 'A channel gives you independent control over that part of the track.',
        },
      },
      {
        kind: 'reflect',
        instruction: 'Explain it.',
        reflect: {
          prompt: 'What does "gain staging" mean?',
          model: 'Setting a healthy signal level at every stage - input gain first, then faders - so nothing clips and nothing is buried in noise.',
        },
      },
    ],
    review: [
      { question: 'Set first on a new mixer channel:', options: ['Input gain', 'Crossfader', 'FX send'], answer: 0, explain: 'Gain staging before balance.' },
      { question: 'A meter that hits the top constantly means…', options: ['Clipping - turn the gain down', 'Perfect level', 'Too quiet'], answer: 0, explain: 'Leave headroom.' },
      { question: 'Routing an instrument to a mixer channel lets you…', options: ['Shape it independently', 'Change its pitch', 'Sync it'], answer: 0, explain: 'Each channel has its own EQ, filter and fader.' },
    ],
  },
  {
    id: 'studio-5-arrange-and-bounce',
    device: 'studio',
    path: 'studio',
    order: 5,
    difficulty: 'intermediate',
    name: 'Arrange a song and bounce it',
    description: 'Turn a loop into a track: intro, build, drop, break - then record a WAV.',
    objective: 'Build a 4-section arrangement, play it through and record it.',
    source: 'Synth Studio',
    estimatedMinutes: 10,
    prerequisites: ['studio-1-one-clock'],
    concepts: ['sequencer-pattern', 'mixing'],
    steps: [
      {
        kind: 'info',
        instruction: 'A loop becomes a song when it changes over time. Most dance music moves in sections of 8 or 16 bars.',
        principle: 'Listeners feel structure in phrases - changes every 8 or 16 bars feel natural; random lengths feel wrong.',
      },
      {
        kind: 'challenge',
        instruction: 'In the Studio tab, use the Song arranger: add four sections - Intro, Build, Drop, Break.',
        checklist: [
          { text: 'At least four sections', check: s => s.arrangement.sections.length >= 4 },
          { text: 'Every section is 4, 8, 16 or 32 bars', check: s => s.arrangement.sections.length > 0 && s.arrangement.sections.every(x => [4, 8, 16, 32].includes(x.bars)) },
        ],
        hints: ['Press "+ Section" four times; the names fill in automatically.', 'Use 8 bars for each to start.'],
      },
      {
        kind: 'challenge',
        instruction: 'Give the sections contrast: mute something in the Intro and the Break, so the Drop hits harder.',
        checklist: [
          { text: 'Something muted in at least one section', check: s => s.arrangement.sections.some(x => Object.values(x.parts).some(p => p.muted)) },
          { text: 'Song mode turned on', check: s => s.arrangement.enabled },
        ],
        hints: ['Tick "mute" for the drums in the Intro.', 'Then tick "Song mode" at the top of the arranger.'],
      },
      {
        kind: 'quiz',
        instruction: 'Quick check.',
        quiz: {
          question: 'Why does muting the drums in the Break make the Drop feel bigger?',
          options: ['Contrast: the ear notices what returns', 'The drop gets louder automatically', 'It changes the tempo'],
          answer: 0,
          explain: 'Energy is relative. Taking something away and bringing it back is the oldest trick in dance music.',
        },
      },
      {
        kind: 'info',
        instruction: 'Press REC, then ▶ (or "▶ from here" on the Intro). Stop after the Break, then press the timer to save your WAV.',
        principle: 'Bouncing renders the mix to a file you can share or finish in a DAW.',
      },
      {
        kind: 'reflect',
        instruction: 'Explain it.',
        reflect: {
          prompt: 'In your own words: what turns a loop into a song?',
          model: 'Change over time in phrases: adding, removing and swapping parts every 8 or 16 bars to build and release energy.',
        },
      },
    ],
    review: [
      { question: 'Dance music sections are usually…', options: ['8 or 16 bars', '3 or 5 bars', 'Random lengths'], answer: 0, explain: 'Phrases of 8/16 bars.' },
      { question: 'A drop feels bigger after…', options: ['A break that removes parts', 'A louder intro', 'A tempo change'], answer: 0, explain: 'Contrast.' },
      { question: 'Bouncing a track means…', options: ['Recording the mix to an audio file', 'Making it louder', 'Speeding it up'], answer: 0, explain: 'Rendering to WAV.' },
    ],
  },
];
