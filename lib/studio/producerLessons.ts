// ============================================================================
// The Producer path (docs/research/producer-path/curriculum.md), the lessons that
// run on instruments already in Synth Studio: the Studio Clock, the DFAM, the
// Xone:96 (its built-in decks play the stems of the session "Tide Pool"), the
// studio mixer, the master and Bounce. The lessons that need the Elektrons or
// the Sub 37 come once those instruments are rebuilt.
//
// Every lesson starts from a checkpoint of the Tide Pool studio
// (lib/studio/producerStudio.ts). The learner's own studio is saved first and
// comes back with one press. Checks use lib/studio/checks.ts and the live studio
// state (meters, takes, history) of Lesson API v3 (docs/PEDAGOGY.md).
//
// Loaded on demand (lib/studio/producerIndex.ts lists the ids up front).
// ============================================================================

import type { Lesson } from '@/types';
import { between, killDb, killKnob, midKnob, num, xdb, xHighPassed } from './checks';
import { CP_MUDDY, CP_SLOTTED, producerStudio } from './producerStudio';

const XONE = 'xone96';

// ============================================================================
// L7 · Frequency slots
// ============================================================================

const frequencySlots: Lesson = {
  id: 'studio-producer-07-frequency-slots',
  device: 'studio',
  path: 'producer',
  order: 7,
  difficulty: 'intermediate',
  name: 'Frequency slots',
  description: 'Clean up a muddy mix part by part: high-pass the DFAM perc, cut the stabs\' lows and low mids, and judge every move in the full mix.',
  objective: 'Give every part its own frequency slot: kick and bass keep the deep lows, and everything else is high-passed or cut out of their way.',
  source: 'Synth Studio · Producer path (curriculum L7)',
  estimatedMinutes: 16,
  prerequisites: ['studio-producer-04-one-clock'],
  concepts: ['equalization', 'filter-cutoff', 'mixing'],
  start: { studio: producerStudio({ xone: CP_MUDDY.xone, dfam: CP_MUDDY.dfam }) },
  steps: [
    {
      kind: 'listen', concept: 'mixing', scope: 'spectrum',
      instruction: 'Same parts, same levels. One mix is clear, one is muddy. Play A, then B, and switch a few times.',
      explanation: 'The coach plays both at the same loudness, so the difference you hear is the balance of frequencies, not level. "Tide Pool" is this lesson\'s session: drums, bass and stabs on Xone:96 channels 1 to 3, and your DFAM percussion on channel 4.',
      listen: {
        a: {}, b: {},
        labels: ['Mix A', 'Mix B'],
        matchLoudness: true,
        parts: {
          a: { [XONE]: CP_SLOTTED.xone, dfam: { vcf_mode: 0, vcf_cutoff: 220 } },
          b: { [XONE]: CP_MUDDY.xone, dfam: { vcf_mode: 1, vcf_cutoff: 6000 } },
        },
        question: {
          question: 'What makes B muddy?',
          options: ['Too many parts pile up in the low end and the low mids', 'The tempo is slower', 'The DFAM plays more notes'],
          answer: 0,
          explain: 'In B the stabs keep their lows and have boosted low mids, and the DFAM rings like a low tom: all of it lands on top of the kick and bass. The tempo and the notes are identical in both mixes.',
        },
      },
    },
    {
      kind: 'quiz', concept: 'timing-tempo',
      instruction: 'Warm-up from the clock lesson.',
      quiz: {
        question: 'The DFAM has no MIDI. What keeps it in time with the drums in this studio?',
        options: ['Its TEMPO knob set to 124', 'Clock pulses from the Studio Clock on a cable', 'The Xone:96 crossfader'],
        answer: 1,
        explain: 'The Studio Clock sends one pulse per 16th into DFAM ADV/CLOCK, so the DFAM steps exactly with the studio. A TEMPO knob set to the same number would still drift, because two clocks never run at exactly the same speed.',
      },
    },
    {
      kind: 'do', concept: 'mixing', scope: 'spectrum', area: 'transport',
      instruction: 'Press ▶ in the top bar and watch the spectrum while the mix plays.',
      check: s => s.transport.playing,
      solution: { transport: 'play' },
      principle: 'Sounds that share a frequency range compete; the louder one hides the quieter one.',
      explanation: 'A rough map: sub 20–60 Hz, bass 60–250 Hz, low mids 250–500 Hz, mids 500 Hz–2 kHz, presence 2–6 kHz, air above. When two sounds share a range, the louder one hides the quieter one: that is masking. You fix it by giving each part a range where it is the main thing.',
    },
    {
      kind: 'do', concept: 'filter-cutoff', instance: 'dfam', control: 'vcf_mode', targetValue: 0, scope: 'spectrum',
      instruction: 'Open the DFAM and switch VCF MODE to HP.',
      principle: 'A high-pass filter removes the lows a part doesn\'t need, leaving room for kick and bass.',
      explanation: 'Your perc loop rings like a low tom: its body sits between 100 and 250 Hz, right on the bass. HP keeps what is above CUTOFF and drops what is below. Fixing it at the source, on the instrument, is the cleanest move.',
    },
    {
      kind: 'predict', concept: 'filter-cutoff', instance: 'dfam', control: 'vcf_cutoff', targetValue: 220, tolerance: 90, scope: 'spectrum',
      instruction: 'Raise CUTOFF to about 220 Hz.',
      check: s => num(s, 'dfam', 'vcf_mode') === 0,
      predict: {
        question: 'Played alone, the high-passed perc will sound…',
        options: [
          'Thinner on its own, but in the full mix the low end gets clearer and you barely miss it',
          'Louder and fuller',
          'Exactly the same, only quieter',
        ],
        answer: 0,
        explain: 'Solo, a high-passed part loses weight. In the mix the kick and bass supply the weight, and the perc is heard by its knock and its tone, which live above 250 Hz. That is why you judge EQ in the mix, not in solo.',
      },
      principle: 'Judge a filter in the mix: other parts supply the weight a high-pass takes away.',
    },
    {
      kind: 'do', concept: 'equalization', instance: XONE, control: 'ch3_lo', targetValue: killKnob(-6), scope: 'spectrum',
      instruction: 'On the Xone:96, turn channel 3 (STABS) LO down to about −6 dB.',
      principle: 'Chords are heard by their mids; their lows only add mud under the bass.',
      explanation: 'LO is a shelf at 180 Hz: it turns everything below it up or down, and fully anticlockwise it kills the band. Someone had boosted it by 6 dB, so this is a 12 dB swing.',
      manualReference: 'Xone:96 User Guide p.10 – 4-band EQ: LO 180 Hz, kill to +6 dB',
    },
    {
      kind: 'listen', concept: 'equalization', instance: XONE, scope: 'spectrum',
      instruction: 'Hear a low-mid cut on the stabs, at the same loudness.',
      listen: {
        a: { ch3_lomid: midKnob(5) }, b: { ch3_lomid: midKnob(-6) },
        labels: ['LO MID +5 dB', 'LO MID −6 dB'],
        matchLoudness: true,
        question: {
          question: 'Which one sounds clearer and less boxy?',
          options: ['A, with the boost', 'B, with the cut', 'They sound the same'],
          answer: 1,
          explain: '350 Hz is where the stabs\' body, the bass\'s harmonics and the perc overlap. A cut there opens the mix without making any part sound thin; the boost made it boxy. With the loudness matched, the boost can\'t win by being louder.',
        },
      },
    },
    {
      kind: 'do', concept: 'equalization', instance: XONE, control: 'ch3_lomid', targetValue: midKnob(-3), tolerance: 0.07, scope: 'spectrum',
      instruction: 'Now set channel 3 LO MID to a cut of about 3 dB.',
      principle: 'Small cuts where parts overlap clear a mix more naturally than big boosts.',
      explanation: 'LO MID is a bell around 350 Hz: +10 dB of boost to −27 dB of cut. Cutting where parts collide removes the clash; boosting adds level, and level fools the ear into thinking "better".',
      manualReference: 'Xone:96 User Guide p.10 – HI MID 1.1 kHz, LO MID 350 Hz, −27 to +10 dB',
    },
    {
      kind: 'quiz', concept: 'mixing',
      instruction: 'Quick check.',
      quiz: {
        question: 'The kick and the bass both live below 120 Hz. Which plan is best?',
        options: [
          'Boost both with LO so they are heard',
          'High-pass the kick at 200 Hz',
          'Let them take turns: the kick owns the beat, the bass plays between the kicks',
        ],
        answer: 2,
        explain: 'Boosting both adds mud, and a 200 Hz high-pass removes the kick\'s punch. In Tide Pool the kick hits every beat around 50 Hz and the bass plays the off-beats, so they share the lowest octave by taking turns in time. Neither needs cutting.',
      },
    },
    {
      kind: 'info', concept: 'equalization', scope: 'spectrum',
      instruction: 'Watch the spectrum on a kick hit, then on a bass note: the same low peak, taking turns.',
      explanation: 'The kick (channel 1) peaks around 50 Hz on every beat; the bass (channel 2) peaks around 45–65 Hz between the beats. Frequency slots are about time as well as pitch: two parts can share a range if they never play at once.',
      principle: 'Two parts can share a frequency range if they take turns in time.',
    },
    {
      kind: 'match', concept: 'equalization', instance: XONE, scope: 'spectrum',
      instruction: 'A mystery EQ is on the bass channel. Recreate it by ear: LO MID and HI MID on channel 2.',
      setup: { ch2_lomid: 0, ch2_himid: 0 },
      match: { target: { ch2_lomid: midKnob(-11), ch2_himid: midKnob(4.5) }, controls: ['ch2_lomid', 'ch2_himid'] },
      hints: ['One band is cut, one is boosted.', 'The boxiness is gone and the bass plucks a little more.', 'LO MID well down, HI MID a little up.'],
    },
    {
      kind: 'challenge', concept: 'mixing', scope: 'spectrum',
      instruction: 'Clean up the rest of the muddy mix: only kick and bass keep their deep lows.',
      checklist: [
        { text: 'DFAM perc high-passed: VCF MODE HP, CUTOFF 150 Hz or more', check: s => num(s, 'dfam', 'vcf_mode') === 0 && num(s, 'dfam', 'vcf_cutoff') >= 150 },
        { text: 'Stabs (channel 3): LO cut by 3 dB or more, or a high-pass filter on the channel', check: s => xdb(s, '3', 'LO') <= -3 || xHighPassed(s, '3', 100) },
        { text: 'Stabs: LO MID cut by 1.5 dB or more', check: s => xdb(s, '3', 'LO MID') <= -1.5 },
        { text: 'Bass (channel 2): LO MID not boosted', check: s => xdb(s, '2', 'LO MID') <= 0.5 },
        {
          text: 'Kick and bass keep their lows: channel 1 and 2 LO not cut, and no channel\'s LO boosted above +1 dB',
          check: s => killDb(num(s, XONE, 'ch1_lo')) >= -1.5 && killDb(num(s, XONE, 'ch2_lo')) >= -1.5 && ['1', '2', '3', '4'].every(c => xdb(s, c, 'LO') <= 1),
        },
      ],
      hints: [
        'Ask each part: does it need anything below 150 Hz?',
        'Only the kick (channel 1) and the bass (channel 2) do.',
        'DFAM: VCF MODE HP, CUTOFF about 220 Hz. Channel 3: LO about −6 dB, LO MID about −3 dB. Channel 2: LO MID at 0 or below.',
      ],
      solution: { parts: { dfam: { vcf_mode: 0, vcf_cutoff: 220 }, [XONE]: { ...CP_SLOTTED.xone, ch2_lomid: midKnob(-2) } } },
    },
    {
      kind: 'reflect',
      instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why judge EQ in the full mix rather than solo?',
        model: 'Masking only happens between parts. A sound that seems thin alone can be right in context, where other parts supply the lows, and a cut that looks drastic solo may be exactly what lets the bass through.',
      },
      explanation: 'Go further: the Xone\'s LO kill is how DJs swap basslines. Kill channel 2 LO for eight bars and bring it back on a bar line: the drop you hear is the bass returning to its slot.',
    },
  ],
  review: [
    { question: 'A high-pass filter…', options: ['Removes highs', 'Removes the lows below its cutoff', 'Boosts bass'], answer: 1, explain: 'It lets the highs pass.' },
    { question: 'Which parts usually keep their deepest lows?', options: ['Kick and bass', 'Hi-hats', 'Chord stabs'], answer: 0, explain: 'They carry the low end; everything else gets out of their way.' },
    { question: 'Masking means…', options: ['A stereo effect', 'One sound hiding another in the same range', 'A mute button'], answer: 1, explain: 'The louder sound covers the quieter one where they overlap.' },
    { question: 'The Xone:96\'s LO MID band sits at about…', options: ['50 Hz', '350 Hz', '3 kHz'], answer: 1, explain: 'LO is a 180 Hz shelf, LO MID 350 Hz, HI MID 1.1 kHz, HI 3 kHz.' },
    { question: 'A good first EQ move is usually…', options: ['A big boost', 'Boosting everything a little', 'A small cut where parts overlap'], answer: 2, explain: 'Cuts remove the clash instead of adding level.' },
  ],
};

export const PRODUCER_LESSONS: Lesson[] = [frequencySlots];

void between;
