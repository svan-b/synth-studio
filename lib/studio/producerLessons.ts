// ============================================================================
// The Producer path (docs/research/producer-path/curriculum.md). This file holds
// the studio lessons (L4, L7, L9-L14) on the Studio Clock, the DFAM and the
// Xone:96 (its built-in decks play the stems of the session "Tide Pool"), the
// studio mixer, the master and Bounce; producerElektronLessons.ts holds the ones
// on the Analog Rytm, the Analog Four and the Sub 37 (L1-L3, L5, L6, L8, L15).
// PRODUCER_LESSONS is the whole path, in order.
//
// Every lesson starts from a checkpoint of the Tide Pool studio
// (lib/studio/producerStudio.ts). The learner's own studio is saved first and
// comes back with one press. Checks use lib/studio/checks.ts and the live studio
// state (meters, takes, history) of Lesson API v3 (docs/PEDAGOGY.md).
//
// The hooks play recordings of the demo tracks (`info.play`, `listen.demo`:
// public/demos, rendered by scripts/render-demos.cjs), never the studio.
//
// Loaded on demand (lib/studio/producerIndex.ts lists the ids up front).
// ============================================================================

import type { Lesson, LessonCheckState } from '@/types';
import { SRC } from '@/devices/xone96/model';
import {
  between, cable, killDb, killKnob, master, midKnob, num, sec, sectionMuted, sectionValue, snap, songBars, songSeconds,
  synced, val, xch, xdb, xHighPassed, xmeter, xv,
} from './checks';
import {
  CP_DRY, CP_MIXED, CP_MUDDY, CP_ROUGH, CP_SLOTTED, CP_SPACED, DFAM_KNOCK, producerStudio, songSections, songWithTransitions,
} from './producerStudio';
import { PRODUCER_ELEKTRON_LESSONS } from './producerElektronLessons';

const XONE = 'xone96';
const CLOCK = 'studio-clock';

// ============================================================================
// L4 · One clock for the whole studio
// ============================================================================

const oneClock: Lesson = {
  id: 'studio-producer-04-one-clock',
  device: 'studio',
  path: 'producer',
  order: 4,
  difficulty: 'intermediate',
  name: 'One clock for the whole studio',
  description: 'The Xone:96\'s decks follow the studio like MIDI-synced machines; the DFAM has no MIDI, so it gets clock pulses on a cable. Make them drift, lock them, and turn the DFAM into a polyrhythm.',
  objective: 'Run every instrument from one clock: synced gear by MIDI-style sync, the DFAM by clock pulses, so a percussion layer plays in time.',
  source: 'Synth Studio · Producer path (curriculum L4)',
  estimatedMinutes: 15,
  prerequisites: ['studio-producer-03-bass-kick'],
  concepts: ['timing-tempo', 'signal-routing', 'polyrhythm'],
  start: { studio: producerStudio({ noCable: true, alignClocked: false, dfam: DFAM_KNOCK }) },
  steps: [
    {
      kind: 'info', concept: 'timing-tempo',
      instruction: 'Three instruments with no shared brain, perfectly in time: press ▶ Hear it. The secret is one clock, and in this lesson you wire one.',
      principle: 'Music is organised time; one clock divides it into beats every instrument agrees on.',
      explanation: 'The recording is the demo "Three Clocks": a DFAM, a Mother-32 and a Subharmonicon stepped by one 16th-note clock, in loops of different lengths. In this lesson\'s studio the Xone:96\'s built-in decks play the drums, the bass and the stabs of "Tide Pool", a deep-house sketch in A minor. Your DFAM plays a knock-and-tick percussion loop on Xone channel 4.',
      info: { play: { demo: 'three-clocks', excerpt: 'low-end-17-20' } },
    },
    {
      kind: 'quiz', concept: 'timing-tempo',
      instruction: 'Warm-up.',
      quiz: {
        question: 'In a 16-step bar, which steps fall on the beats?',
        options: ['1, 2, 3 and 4', '1, 5, 9 and 13', '4, 8, 12 and 16'],
        answer: 1,
        explain: 'A bar has four beats and each beat has four 16th steps, so the beats are every fourth step: 1, 5, 9, 13. Steps 4, 8, 12 and 16 sit just before each beat.',
      },
    },
    {
      kind: 'do', concept: 'timing-tempo', area: 'rack',
      instruction: 'In the Studio tab, check that the Xone:96 has "Sync to studio clock" ticked, then press ▶ and listen to the DFAM.',
      check: s => synced(s, XONE) && s.transport.playing,
      solution: { studio: { sync: { [XONE]: true } }, transport: 'play' },
      principle: 'A synced instrument ignores its own tempo and follows the leader.',
      explanation: 'MIDI-style sync sends 24 clock ticks per beat plus start and stop, so a follower locks to the leader\'s tempo and position: the Xone\'s decks start on bar 1 with the studio. The DFAM has no MIDI: ▶ only presses its RUN/STOP, so it runs on its own TEMPO knob, 120 BPM against the studio\'s 124, and slides out of time.',
    },
    {
      kind: 'predict', concept: 'signal-routing', instance: CLOCK, focus: ['out_clock'],
      instruction: 'Patch the Studio Clock\'s CLOCK output into the DFAM\'s ADV/CLOCK input.',
      check: s => cable(s, CLOCK, 'out_clock', 'dfam', 'in_adv_clock'),
      solution: { studioCables: [{ from: { device: CLOCK, jack: 'out_clock' }, to: { device: 'dfam', jack: 'in_adv_clock' } }] },
      hints: ['Tap the CLOCK jack on the Studio Clock, then the ADV/CLOCK jack on the DFAM.', 'ADV/CLOCK is in the DFAM\'s bottom row of jacks.'],
      predict: {
        question: 'What will the cable do to the DFAM?',
        options: ['Make it louder', 'Lock it to the studio: from now on it takes one step per pulse', 'Nothing until you turn its TEMPO knob to 124'],
        answer: 1,
        explain: 'A cable in ADV/CLOCK replaces the DFAM\'s own clock: it steps only when a pulse arrives, so it follows the studio exactly. Its TEMPO knob is ignored from now on, and setting it to 124 would still drift.',
      },
      principle: 'A clock pulse is a short voltage; each one tells a sequencer to take one step.',
      explanation: 'Gear without MIDI is synced the way modular synths are: with pulses on a patch cable. CLOCK DIV on the Studio Clock is 1/16, so the DFAM takes one step per 16th note.',
    },
    {
      kind: 'predict', concept: 'sequencer-pattern', instance: 'dfam', focus: ['advance'],
      instruction: 'Press ■, then press the DFAM\'s ADVANCE until step 8 is lit.',
      check: s => !s.transport.playing && Number(s.engine.step) === 7,
      solution: { transport: 'stop', pressUntilDone: 'advance' },
      predict: {
        question: 'Why park the DFAM on its last step before pressing ▶?',
        options: ['So the first clock pulse plays step 1, on the downbeat', 'So it plays louder', 'So it skips step 1'],
        answer: 0,
        explain: 'Each pulse advances first, then plays. From step 8, the first pulse lands on step 1, exactly on bar 1 with the drums. Parked anywhere else, the loop starts in the wrong place and the accents fall off the beat.',
      },
      principle: 'Parking a sequencer on its last step makes the first clock pulse play step 1.',
      explanation: 'The DFAM has no reset input, so this is how DFAM players line it up. Stopping halfway leaves it halfway: park it again before each start.',
    },
    {
      kind: 'do', concept: 'timing-tempo', area: 'transport',
      instruction: 'Press ▶. The DFAM\'s loud knocks now sit on the "and" of each beat, against the kick.',
      check: s => s.transport.playing,
      solution: { transport: 'play' },
      principle: 'Two machines on one clock stay locked bar after bar.',
    },
    {
      kind: 'predict', concept: 'timing-tempo', instance: XONE, focus: ['bpm'], area: 'rack',
      instruction: 'Press ■. Untick the Xone\'s "Sync to studio clock", set its BPM knob to 123, press ▶ and listen for 30 seconds.',
      check: s => !synced(s, XONE) && Math.abs(num(s, XONE, 'bpm') - 123) < 0.5 && s.transport.playing,
      solution: { transport: 'stop', studio: { sync: { [XONE]: false } }, parts: { [XONE]: { bpm: 123 } }, play: { seconds: 2 } },
      predict: {
        question: 'The studio clock runs at 124 BPM and the Xone\'s decks at 123. What happens over half a minute?',
        options: ['Nothing: 1 BPM is too small to hear', 'The Xone speeds up to match', 'They drift apart until the drums land in the wrong place against the DFAM'],
        answer: 2,
        explain: 'One beat a minute is lost, so after 30 seconds the drums are half a beat behind the DFAM. Machines never correct each other unless they share a clock.',
      },
      principle: 'Two clocks set to "the same" tempo still drift apart.',
    },
    {
      kind: 'do', concept: 'timing-tempo', area: 'rack',
      instruction: 'Tick "Sync to studio clock" for the Xone:96 again.',
      check: s => synced(s, XONE),
      solution: { studio: { sync: { [XONE]: true } }, parts: { [XONE]: { bpm: 124 } } },
      principle: 'Only the leader\'s tempo matters; every follower inherits it.',
    },
    {
      kind: 'quiz', concept: 'sequencer-pattern',
      instruction: 'Quick check.',
      quiz: {
        question: 'The DFAM has 8 steps and takes one step per 16th note. How long is one turn of its loop?',
        options: ['Half a bar (2 beats)', 'One bar', 'Two bars'],
        answer: 0,
        explain: 'Eight 16ths are two beats, so the loop plays twice in every bar and stays lined up with a 4/4 beat. A whole bar would need 16 steps.',
      },
    },
    {
      kind: 'predict', concept: 'polyrhythm', instance: CLOCK, control: 'division', targetValue: 5,
      instruction: 'Switch the Studio Clock\'s CLOCK DIV to 1/16T (16th-note triplets).',
      predict: {
        question: 'The DFAM now steps 6 times per beat instead of 4. What happens against the drums?',
        options: ['It stops playing', 'A rolling cross-rhythm: its 8-step loop now fits three times into each bar', 'Nothing changes'],
        answer: 1,
        explain: '8 steps × 1/6 of a beat = 1⅓ beats, so three loops fill one 4-beat bar. Three loops against four beats is a polyrhythm: two pulse rates at once that meet again on every bar line.',
      },
      principle: 'A loop that doesn\'t divide the bar evenly makes a cross-rhythm that realigns on the bar line.',
    },
    {
      kind: 'listen', concept: 'polyrhythm',
      instruction: 'Compare the two clock divisions while the studio plays.',
      listen: {
        a: {}, b: {},
        labels: ['CLOCK DIV 1/16', '1/16T'],
        parts: { a: { [CLOCK]: { division: 2 } }, b: { [CLOCK]: { division: 5 } } },
        question: {
          question: 'Which one is the polyrhythm?',
          options: ['A', 'B'],
          answer: 1,
          explain: 'In B the loop lasts 1⅓ beats, so its loud knocks land in a different place on every beat and line up again each bar. A repeats every half bar.',
        },
      },
    },
    {
      kind: 'quiz', concept: 'timing-tempo',
      instruction: 'Quick check.',
      quiz: {
        question: 'How many MIDI clock ticks make one beat?',
        options: ['4', '96', '24'],
        answer: 2,
        explain: '24 pulses per quarter note is the MIDI standard, so a 16th is 6 ticks. 4 is the number of 16ths in a beat.',
      },
    },
    {
      kind: 'challenge', concept: 'mixing', instance: XONE,
      instruction: 'Make the DFAM a percussion layer that supports the beat: in time, and sitting behind the drums.',
      checklist: [
        { text: 'Clock patched: Studio Clock CLOCK → DFAM ADV/CLOCK', check: s => cable(s, CLOCK, 'out_clock', 'dfam', 'in_adv_clock') },
        { text: 'The Xone:96 follows the studio clock', check: s => synced(s, XONE) },
        { text: 'The DFAM plays through a Xone:96 channel', check: s => xch(s, 'dfam') !== null },
        { text: 'It sits under the drums: its channel fader is below channel 1\'s', check: s => xv(s, xch(s, 'dfam'), 'FADER') < xv(s, '1', 'FADER') },
        { text: 'CLOCK DIV 1/16 for a tight layer, or 1/16T for a rolling one', check: s => [2, 5].includes(num(s, CLOCK, 'division')) },
      ],
      hints: ['A layer supports; it shouldn\'t lead.', 'Keep channel 4\'s fader well below channel 1.', 'Try 1/16 for a tight groove and 1/16T for a rolling one, then choose.'],
      solution: {
        studioCables: [{ from: { device: CLOCK, jack: 'out_clock' }, to: { device: 'dfam', jack: 'in_adv_clock' } }],
        studio: { sync: { [XONE]: true } },
        parts: { [XONE]: { ch4_fader: 8.5, ch1_fader: 10 }, [CLOCK]: { division: 2 } },
      },
    },
    {
      kind: 'reflect',
      instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why can\'t two instruments just be set to the same BPM instead of sharing a clock?',
        model: 'Two separate clocks always run a little differently, so the parts slide apart over time. One shared clock keeps every step landing together, bar after bar.',
      },
      explanation: 'Go further: patch the Studio Clock\'s BEAT output (quarter notes) into the DFAM instead. The 8 steps now take two bars: slow clocks turn a drum sequencer into an evolving riff.',
    },
  ],
  review: [
    { question: 'Two machines set to 124 and 123 BPM…', options: ['Stay together', 'Play in a 4:3 ratio', 'Drift apart about a beat per minute'], answer: 2, explain: 'The 1 BPM difference adds up.' },
    { question: 'Gear with no MIDI is synced with…', options: ['Clock pulses on a cable', 'The same BPM number', 'A faster computer'], answer: 0, explain: 'Each pulse advances one step.' },
    { question: '8 steps at one per 16th last…', options: ['2 beats', '1 bar', '8 beats'], answer: 0, explain: 'Eight 16ths.' },
    { question: 'Clocking an 8-step loop at 1/16T against 4/4 gives…', options: ['Double time', 'A 3-against-4 cross-rhythm', 'Silence'], answer: 1, explain: 'Three loops fit in one bar.' },
    { question: 'Parking the DFAM on step 8 before starting makes…', options: ['The first pulse play step 1', 'It skip step 1', 'It play twice as fast'], answer: 0, explain: 'The next pulse advances to step 1.' },
  ],
};

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
  prerequisites: ['studio-producer-06-hook'],
  concepts: ['equalization', 'filter-cutoff', 'mixing'],
  start: { studio: producerStudio({ xone: CP_MUDDY.xone, dfam: CP_MUDDY.dfam }) },
  steps: [
    {
      kind: 'listen', concept: 'mixing', scope: 'spectrum',
      instruction: 'Same parts, same levels. One mix is clear, one is muddy. Play A, then B, and switch a few times.',
      explanation: 'Both are the first drop of the demo "Low Tide Lights", played at the same loudness, so the difference you hear is the balance of frequencies, not level: watch the spectrum below 300 Hz. This lesson\'s session is "Tide Pool": drums, bass and stabs on Xone:96 channels 1 to 3, and your DFAM percussion on channel 4.',
      listen: {
        a: {}, b: {},
        labels: ['Mix A', 'Mix B'],
        demo: { demo: 'low-tide-lights', excerpt: 'drop-17-20', a: 'as-made', b: 'muddy' },
        question: {
          question: 'What makes B muddy?',
          options: ['Too many parts pile up in the low end and the low mids', 'The tempo is slower', 'The hook is too loud'],
          answer: 0,
          explain: 'In B every high-pass is off and the low mids are boosted: the stabs, the clap, the hats and the effect returns keep their lows, and all of it lands on top of the kick and the bass. The tempo and the parts are identical, and both play at the same loudness.',
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
      instruction: 'Open the DFAM and switch VCF MODE to HP. With CUTOFF still at 6 kHz, only a click is left.',
      principle: 'A high-pass filter removes the lows a part doesn\'t need, leaving room for kick and bass.',
      explanation: 'Your perc loop rings like a low tom: its body sits between 130 and 260 Hz, right on the bass\'s harmonics. HP keeps what is above CUTOFF and drops what is below, so at 6 kHz almost nothing is left. Fixing it at the source, on the instrument, is the cleanest move.',
    },
    {
      kind: 'predict', concept: 'filter-cutoff', instance: 'dfam', control: 'vcf_cutoff', targetValue: 220, tolerance: 90, scope: 'spectrum',
      instruction: 'Bring CUTOFF down to about 220 Hz: the knock comes back, the boom stays out.',
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

// ============================================================================
// L9 · Space and depth
// ============================================================================

const spaceDepth: Lesson = {
  id: 'studio-producer-09-space-depth',
  device: 'studio',
  path: 'producer',
  order: 9,
  difficulty: 'intermediate',
  name: 'Space and depth',
  description: 'The Xone:96\'s sends and returns, used on purpose: a dotted-8th delay on the perc, the stabs pushed back into the reverb, EQ on the returns, and the drums and bass dry up front.',
  objective: 'Place sounds front to back: a tempo-synced delay for echoes, a reverb for depth, the returns kept out of the low end, and kick and bass dry up front.',
  source: 'Synth Studio · Producer path (curriculum L9)',
  estimatedMinutes: 18,
  prerequisites: ['studio-producer-07-frequency-slots'],
  concepts: ['effects', 'mixing', 'timing-tempo'],
  start: { studio: producerStudio({ xone: CP_DRY.xone, dfam: CP_DRY.dfam }) },
  steps: [
    {
      kind: 'listen', concept: 'effects',
      instruction: 'The same break twice, at the same loudness: once dry, once with space.',
      explanation: 'Both are the break of the demo "Low Tide Lights": pads and the hook over a few drums.',
      listen: {
        a: {}, b: {},
        labels: ['Mix A', 'Mix B'],
        demo: { demo: 'low-tide-lights', excerpt: 'break-33-36', a: 'dry', b: 'as-made' },
        question: {
          question: 'What does B add?',
          options: ['Depth: some parts sound further away than others', 'A faster tempo', 'More bass'],
          answer: 0,
          explain: 'B is the break as made: the pads and the hook go into reverb and delay, the one deep kick into a long reverb. Distance is mostly reflections, so the wet parts move back and the dry ones stay in front. The tempo and the low end are the same; A has every effect return off.',
        },
      },
    },
    {
      kind: 'quiz', concept: 'filter-cutoff',
      instruction: 'Warm-up from frequency slots.',
      quiz: {
        question: 'A high-pass filter removes…',
        options: ['The highs', 'The lows below its cutoff', 'The middle of the sound'],
        answer: 1,
        explain: 'It lets the highs pass and removes what is below the cutoff. You will use the same idea on the effect returns in this lesson.',
      },
    },
    {
      kind: 'info', concept: 'effects', instance: XONE, focus: ['ch4_snd1', 'ch3_snd2', 'cha_fader', 'chb_fader'],
      instruction: 'Find SEND 1 and SEND 2 at the top of each Xone channel, and channels A and B on the left.',
      principle: 'Sends add an effect alongside the dry sound, so one effect can serve many parts.',
      explanation: 'A send copies some of a channel to an effect; the effect\'s output, the return, comes back on a channel of its own. The original stays dry, so you choose how much space each part gets. On the Xone:96, SEND 1 feeds the delay, which returns on channel A, and SEND 2 feeds the reverb, which returns on channel B.',
      manualReference: 'Xone:96 User Guide p.8, p.10 – SEND 1 / SEND 2',
    },
    {
      kind: 'do', concept: 'effects', instance: XONE, control: 'ch4_snd1', targetValue: 5, tolerance: 1.5,
      instruction: 'Press ▶, and turn channel 4 (DFAM perc) SEND 1 up to about 5.',
      principle: 'Echoes in the gaps make a sparse part feel fuller without more notes.',
      explanation: 'SEND 1 is after the fader unless PRE is lit, so the echoes follow the channel\'s level. 5 on the dial is about −6 dB into the delay.',
    },
    {
      kind: 'predict', concept: 'timing-tempo', instance: XONE, control: 'fx_time', targetValue: 1,
      instruction: 'In the deck strip\'s STAND-IN FX UNIT, set DELAY to 3/16.',
      predict: {
        question: '3/16 is a dotted 8th. At 124 BPM, how long is that?',
        options: ['About 121 ms', 'About 363 ms', 'About 1 second'],
        answer: 1,
        explain: 'One beat is 60 000 ÷ 124 ≈ 484 ms. An 8th is half that, 242 ms, and dotted adds half again: 363 ms. 121 ms is a 16th.',
      },
      principle: 'A tempo-synced delay lands its echoes on the grid, so they groove instead of smearing.',
      explanation: 'A dotted-8th echo lands three 16ths after each note, in the gaps of a 16th-note groove: the classic dub and house delay.',
    },
    {
      kind: 'do', concept: 'effects', instance: XONE, focus: ['fx_fdbk', 'cha_lo'],
      instruction: 'Keep FDBK near 4, and turn channel A\'s LO down to about −12 dB: the echoes fade and stay out of the bass.',
      check: s => between(num(s, XONE, 'fx_fdbk'), 2.5, 6) && killDb(num(s, XONE, 'cha_lo')) <= -9,
      solution: { parts: { [XONE]: { fx_fdbk: 4, cha_lo: killKnob(-12) } } },
      principle: 'Filtering echoes keeps them behind the dry sound and out of the low end.',
      explanation: 'FDBK sets how many repeats you hear. Channel A is a full channel with its own EQ: cutting its LO keeps the echoes off the kick and bass, the job of a delay\'s own high-pass filter.',
    },
    {
      kind: 'do', concept: 'effects', instance: XONE, control: 'ch3_snd2', targetValue: 4.5, tolerance: 1.5,
      instruction: 'Send the stabs to the reverb: channel 3 SEND 2 to about 4.5.',
      principle: 'More reverb than its neighbours pushes a part further back.',
    },
    {
      kind: 'listen', concept: 'effects', instance: XONE,
      instruction: 'Compare a short and a long reverb on the stabs, at the same loudness.',
      listen: {
        a: { fx_size: 1 }, b: { fx_size: 4 },
        labels: ['REVERB 1 s', 'REVERB 4 s'],
        matchLoudness: true,
        question: {
          question: 'Which one pushes the stabs further back?',
          options: ['A, the short one', 'B, the long one', 'Neither: reverb time doesn\'t change distance'],
          answer: 1,
          explain: 'A longer reverb is a bigger room with more reflections, so the stabs seem further away. Too long and it fills the gaps the groove needs, which is why the drops in dance music stay fairly dry.',
        },
      },
    },
    {
      kind: 'quiz', concept: 'effects',
      instruction: 'Quick check.',
      quiz: {
        question: 'Which parts usually stay dry, with little or no reverb?',
        options: ['Pads', 'Hook echoes', 'Kick and bass'],
        answer: 2,
        explain: 'Reverb on low sounds smears the low end and blurs the groove. Keep them dry and centred, and put the space on the higher parts.',
      },
    },
    {
      kind: 'do', concept: 'effects', instance: XONE, focus: ['chb_lo'],
      instruction: 'Cut channel B\'s LO too, to about −12 dB: reverb in the lows smears the groove.',
      check: s => killDb(num(s, XONE, 'chb_lo')) <= -9,
      solution: { parts: { [XONE]: { chb_lo: killKnob(-12) } } },
      principle: 'Keep effect returns out of the low end: the dry kick and bass own it.',
    },
    {
      kind: 'match', concept: 'effects', instance: XONE,
      instruction: 'Recreate the depth by ear: channel 3 SEND 2 and the REVERB time.',
      setup: { ch3_snd2: 2, fx_size: 1.2 },
      match: { target: { ch3_snd2: 7, fx_size: 4.5 }, controls: ['ch3_snd2', 'fx_size'] },
      hints: ['Closer or further away than yours?', 'Further: more reverb, and a longer tail.', 'SEND 2 well past halfway; REVERB long.'],
    },
    {
      kind: 'challenge', concept: 'mixing', instance: XONE,
      instruction: 'Make three depths: drums and bass dry and close, one part in the delay, one far back in the reverb.',
      checklist: [
        { text: 'Drums and bass dry: channels 1 and 2 send 1 or less to both effects', check: s => ['1', '2'].every(c => xv(s, c, 'SEND 1') <= 1 && xv(s, c, 'SEND 2') <= 1) },
        { text: 'A part in the delay: channel 3 or 4 SEND 1 at 3 or more, with channel A up', check: s => (xv(s, '3', 'SEND 1') >= 3 || xv(s, '4', 'SEND 1') >= 3) && xv(s, 'a', 'FADER') >= 3 },
        { text: 'A part far back: channel 3 or 4 SEND 2 at 4 or more, with channel B up', check: s => (xv(s, '3', 'SEND 2') >= 4 || xv(s, '4', 'SEND 2') >= 4) && xv(s, 'b', 'FADER') >= 3 },
        { text: 'Both returns kept out of the low end: channels A and B LO at −6 dB or less', check: s => xdb(s, 'a', 'LO') <= -6 && xdb(s, 'b', 'LO') <= -6 },
      ],
      hints: [
        'Front means dry, loud and bright; back means wet, a little quieter and darker.',
        'Perc in the delay (SEND 1), stabs in the reverb (SEND 2), drums and bass dry.',
        'Channel 4 SEND 1 about 5, channel 3 SEND 2 about 4.5, channels A and B LO about −12 dB.',
      ],
      solution: { parts: { [XONE]: CP_SPACED.xone } },
    },
    {
      kind: 'reflect',
      instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do you push a sound further back in a mix?',
        model: 'Send more of it to the reverb, make it a little quieter and darker, and keep the returns\' lows cut so the dry parts in front stay clear.',
      },
      explanation: 'Go further: a dub throw. On the last beat of a phrase, flick channel 3 SEND 1 up to 8 and straight back: the echoes ring on into the next bar. Light PRE and the send keeps feeding the delay even with the fader down.',
    },
  ],
  review: [
    { question: 'A dotted-8th delay at 124 BPM is about…', options: ['242 ms', '363 ms', '484 ms'], answer: 1, explain: 'An 8th (242 ms) plus half of it.' },
    { question: 'A send is…', options: ['A mute', 'A copy of a channel sent to an effect', 'An EQ band'], answer: 1, explain: 'The dry sound stays as it is.' },
    { question: 'To push a sound back you…', options: ['Make it louder and brighter', 'Add reverb, lower it a little and darken it', 'Pan it to the centre'], answer: 1, explain: 'Distance sounds wetter, quieter and duller.' },
    { question: 'Why cut the lows of a delay or reverb return?', options: ['To keep echoes out of the low end', 'To make it louder', 'To change the tempo'], answer: 0, explain: 'Low echoes muddy the kick and bass.' },
    { question: 'On the Xone:96, SEND 2 feeds…', options: ['The delay, back on channel A', 'The reverb, back on channel B', 'The booth'], answer: 1, explain: 'SEND 1 is the delay on A; SEND 2 the reverb on B.' },
  ],
};

// ============================================================================
// L10 · Ear lab: what changed?
// ============================================================================

const EAR_DFAM = { ...DFAM_KNOCK };

const earLab: Lesson = {
  id: 'studio-producer-10-ear-lab',
  device: 'studio',
  path: 'producer',
  order: 10,
  difficulty: 'intermediate',
  name: 'Ear lab: what changed?',
  description: 'Five quick rounds that mix filter, swing, note length, sends and EQ, then two ear challenges: name the change first, then put it right.',
  objective: 'Tell apart, by ear, changes in filter, swing, note length, sends and EQ, and put each one right.',
  source: 'Synth Studio · Producer path (curriculum L10)',
  estimatedMinutes: 10,
  prerequisites: ['studio-producer-09-space-depth'],
  concepts: ['filter-cutoff', 'envelope-decay', 'effects', 'equalization', 'timing-tempo'],
  start: { studio: producerStudio({ xone: CP_SPACED.xone, dfam: EAR_DFAM }) },
  steps: [
    {
      kind: 'info', concept: 'mixing', area: 'transport',
      instruction: 'Five quick rounds. Each changes one thing you have learned. Name it first, then fix it.',
      principle: 'Hearing which tool changed comes before knowing how far to turn it.',
      explanation: 'The rounds mix ideas from the earlier lessons on purpose: deciding which tool changed is the hard part, and practising it mixed is what makes it stick. Every round plays the whole studio; your DFAM perc is the knock loop, brighter than in frequency slots.',
    },
    {
      kind: 'listen', concept: 'filter-cutoff',
      instruction: 'Round 1: listen to the perc.',
      listen: {
        a: {}, b: {},
        parts: { a: { dfam: { vcf_cutoff: 3000 } }, b: { dfam: { vcf_cutoff: 700 } } },
        question: {
          question: 'What changed between A and B?',
          options: ['Note length', 'Filter brightness', 'Swing', 'Reverb send'],
          answer: 1,
          explain: 'B is darker but just as long and in the same place in time: the cutoff came down.',
        },
      },
    },
    {
      kind: 'listen', concept: 'timing-tempo',
      instruction: 'Round 2: listen to the hats and the perc between the beats.',
      listen: {
        a: {}, b: {},
        studio: { a: { swing: 0 }, b: { swing: 0.2 } },
        question: {
          question: 'What changed?',
          options: ['Reverb', 'Volume', 'Swing'],
          answer: 2,
          explain: 'In B every second 16th arrives later, so the groove lopes. Nothing got louder or wetter.',
        },
      },
    },
    {
      kind: 'listen', concept: 'envelope-decay',
      instruction: 'Round 3: the perc again.',
      listen: {
        a: {}, b: {},
        parts: { a: { dfam: { vca_decay: 120 } }, b: { dfam: { vca_decay: 450 } } },
        question: {
          question: 'What changed?',
          options: ['Note length', 'Filter', 'Pitch'],
          answer: 0,
          explain: 'B rings on into the next hit: same pitch and tone, a longer tail. That is VCA DECAY.',
        },
      },
    },
    {
      kind: 'listen', concept: 'effects',
      instruction: 'Round 4: listen around the perc.',
      listen: {
        a: {}, b: {},
        parts: { a: { [XONE]: { ch4_snd1: 0 } }, b: { [XONE]: { ch4_snd1: 7 } } },
        question: {
          question: 'What changed?',
          options: ['Its reverb send', 'Its delay send', 'Its EQ'],
          answer: 1,
          explain: 'B repeats in rhythm, distinct echoes a dotted 8th apart. A reverb would be a smooth wash without repeats.',
        },
      },
    },
    {
      kind: 'listen', concept: 'equalization',
      instruction: 'Round 5: listen to the stabs.',
      listen: {
        a: {}, b: {},
        parts: { a: { [XONE]: { ch3_lomid: 0 } }, b: { [XONE]: { ch3_lomid: midKnob(-10) } } },
        matchLoudness: true,
        question: {
          question: 'What changed on the stabs channel?',
          options: ['A high cut', 'The fader', 'A low-mid cut'],
          answer: 2,
          explain: 'B lost its boxiness but kept its lows and its highs. A fader would move everything equally (and the loudness is matched anyway).',
        },
      },
    },
    {
      kind: 'match', concept: 'filter-cutoff', instance: 'dfam',
      instruction: 'Two changes this time: put the perc back by ear. CUTOFF and VCA DECAY.',
      setup: { vcf_cutoff: 700, vca_decay: 60 },
      match: { target: { vcf_cutoff: 3000, vca_decay: 250 }, controls: ['vcf_cutoff', 'vca_decay'] },
      hints: ['One control is tone, one is length.', 'It is brighter and rings longer.'],
    },
    {
      kind: 'match', concept: 'equalization', instance: XONE,
      instruction: 'Three changes on the stabs channel: LO MID, SEND 2 and HI.',
      setup: { ch3_lomid: 0, ch3_snd2: 1, ch3_hi: 0 },
      match: { target: { ch3_lomid: midKnob(-12), ch3_snd2: 6, ch3_hi: killKnob(3) }, controls: ['ch3_lomid', 'ch3_snd2', 'ch3_hi'] },
      hints: ['Listen to the body, then the space, then the top, one at a time.', 'Less boxy, further back, a little brighter.'],
    },
    {
      kind: 'quiz', concept: 'mixing',
      instruction: 'Quick check.',
      quiz: {
        question: 'A part sounds muddy and far away at the same time. Which change helps most?',
        options: ['Boost its LO and add reverb', 'Raise the swing', 'Cut its lows or low mids, and lower its reverb send'],
        answer: 2,
        explain: 'Mud is low-end build-up and distance is reverb. Boosting LO and adding reverb makes both worse; swing doesn\'t touch either.',
      },
    },
    {
      kind: 'reflect',
      instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Which change was hardest to hear, and what will you listen for next time?',
        model: 'For example: "Swing was hardest; next time I\'ll listen to the hats between the beats, not the kick."',
      },
    },
  ],
  review: [
    { question: 'A sound gets darker and duller. Most likely…', options: ['A longer decay', 'The filter cutoff came down', 'More swing'], answer: 1, explain: 'The cutoff removes upper harmonics.' },
    { question: 'The groove starts to lope but the tempo stays the same…', options: ['The swing went up', 'The delay feedback went up', 'The kick got shorter'], answer: 0, explain: 'Swing moves every second 16th.' },
    { question: 'A part sounds further away…', options: ['More reverb send', 'More high-pass', 'A shorter decay'], answer: 0, explain: 'Distance is mostly reflections.' },
    { question: 'The low mids sound boxy. Try…', options: ['Boosting 3 kHz', 'Raising the master', 'Cutting around 350 Hz'], answer: 2, explain: 'Boxiness lives in the low mids.' },
  ],
};

// ============================================================================
// L11 · Arrangement
// ============================================================================

const DECKS = ['ch1_src', 'ch2_src', 'ch3_src'];
/** What channel 1..3 plays in section i (its snapshot, held from earlier sections, or live) */
const srcIn = (s: LessonCheckState, i: number, ch: number) => Number(sectionValue(s, i, XONE, `ch${ch}_src`));
/** Every stem plays: the drums, the bass and the stabs */
const fullAt = (s: LessonCheckState, i: number) => !sectionMuted(s, i, XONE) && srcIn(s, i, 1) === SRC.DRUMS && srcIn(s, i, 2) === SRC.BASS && srcIn(s, i, 3) === SRC.STABS;
/** No bass and no stabs (or the whole Xone muted) */
const sparseAt = (s: LessonCheckState, i: number) => sectionMuted(s, i, XONE) || (srcIn(s, i, 2) === SRC.NONE && srcIn(s, i, 3) === SRC.NONE);
/** No kick: the drums deck is off or swapped (PERC), or the Xone muted */
const noKickAt = (s: LessonCheckState, i: number) => sectionMuted(s, i, XONE) || srcIn(s, i, 1) !== SRC.DRUMS;
const stemCount = (s: LessonCheckState, i: number) => (sectionMuted(s, i, XONE) ? 0 : [1, 2, 3].filter(c => srcIn(s, i, c) !== SRC.NONE).length) + (sectionMuted(s, i, 'dfam') ? 0 : 1);
const idx = (s: LessonCheckState) => s.arrangement.sections.map((_, i) => i);
/** A break: a section after the first that drops the kick and the bass */
const breakIndex = (s: LessonCheckState) => idx(s).find(i => i > 0 && noKickAt(s, i) && srcIn(s, i, 2) === SRC.NONE) ?? -1;

const arrangement: Lesson = {
  id: 'studio-producer-11-arrangement',
  device: 'studio',
  path: 'producer',
  order: 11,
  difficulty: 'intermediate',
  name: 'Arrangement',
  description: 'Turn the Tide Pool loop into a song: sections in the arranger that switch which stems play, like pattern changes. Hold parts back, take the kick away, and bring it all home.',
  objective: 'Turn the loop into a two-minute arrangement (intro, drop, break, build, drop, outro) in 8- and 16-bar phrases, with energy that rises and falls.',
  source: 'Synth Studio · Producer path (curriculum L11)',
  estimatedMinutes: 22,
  prerequisites: ['studio-producer-08-movement'],
  concepts: ['sequencer-pattern', 'mixing'],
  start: { studio: producerStudio({ xone: CP_MIXED.xone, dfam: CP_MIXED.dfam }) },
  steps: [
    {
      kind: 'listen', concept: 'mixing',
      instruction: 'The drop with everything, and the same drop with only the drums.',
      explanation: 'Both are the first drop of the demo "Low Tide Lights", at the same loudness.',
      listen: {
        a: {}, b: {},
        labels: ['Everything', 'Drums only'],
        demo: { demo: 'low-tide-lights', excerpt: 'drop-17-20', a: 'as-made', b: 'drums' },
        question: {
          question: 'A track plays B for 16 bars, then switches to A. How does A feel when it arrives?',
          options: ['Bigger: the bass and the chords arrive', 'Smaller', 'The same as if it had played all along'],
          answer: 0,
          explain: 'Energy is relative. After 16 bars without them, the bass and the chords arriving on a downbeat is an event; played all along they become wallpaper.',
        },
      },
    },
    {
      kind: 'quiz', concept: 'effects',
      instruction: 'Warm-up from space and depth.',
      quiz: {
        question: 'Which parts usually stay dry?',
        options: ['Pads', 'Kick and bass', 'Hook echoes'],
        answer: 1,
        explain: 'Reverb on the low end smears the groove; space goes on the higher parts.',
      },
    },
    {
      kind: 'info', concept: 'sequencer-pattern',
      instruction: 'Think of your track as a line of energy that rises and falls.',
      principle: 'Listeners feel structure through contrast: what leaves and returns matters more than what stays.',
      explanation: 'Energy is how many parts play, how loud, how bright and how busy. An arrangement is a plan for energy over time: sections that add, remove and swap parts. Here each section switches what the Xone\'s decks play, the way an Elektron switches patterns, and can mute the DFAM. Your mix stays as it is underneath.',
    },
    {
      kind: 'do', concept: 'sequencer-pattern', area: 'arranger',
      instruction: 'In the song arranger, add two sections: an Intro of 8 bars and a Drop of 16 bars (rename the second). Tick Song mode.',
      check: s => s.arrangement.sections.length >= 2 && s.arrangement.sections[0].bars === 8 && s.arrangement.sections[1].bars === 16 && s.arrangement.enabled,
      solution: { arrangement: { enabled: true, loop: true, sections: [{ name: 'Intro', bars: 8 }, { name: 'Drop', bars: 16 }] } },
      hints: ['"+ Section" adds one; − and + change its bars.', 'The second section starts at 8 bars: press + eight times, and type Drop over its name.'],
      principle: 'Sections switch on bar lines, so every change lands on a downbeat.',
    },
    {
      kind: 'predict', concept: 'sequencer-pattern', instance: XONE, focus: ['ch2_src', 'ch3_src'],
      instruction: 'In the Xone\'s deck strip, set DECK → CH 2 and DECK → CH 3 to NONE, then capture the decks into the Intro below.',
      capture: { instance: XONE, controls: DECKS, label: 'the deck sources (CH 1–3)' },
      check: s => s.arrangement.sections.length >= 1 && snap(s, sec(s, 0), XONE, 'ch2_src') === SRC.NONE && snap(s, sec(s, 0), XONE, 'ch3_src') === SRC.NONE,
      solution: { capture: [{ section: 'Intro', instance: XONE, controls: DECKS, values: { ch1_src: SRC.DRUMS, ch2_src: SRC.NONE, ch3_src: SRC.NONE } }] },
      predict: {
        question: 'Holding the bass and the stabs back in the Intro will make the Drop feel…',
        options: ['Smaller, because the intro is quieter', 'Bigger, because they arrive', 'The same'],
        answer: 1,
        explain: 'Holding parts back and bringing them in on a bar line is the oldest trick in dance music: the arrival is the event.',
      },
      principle: 'A part held back is a part that can arrive.',
      explanation: 'DECK picks what each channel\'s built-in record plays. A snapshot of it is a pattern change: at the section\'s first beat the deck switches. Capture stores only the deck sources, so your mix stays untouched.',
    },
    {
      kind: 'do', concept: 'sequencer-pattern', instance: XONE, focus: ['ch2_src', 'ch3_src'],
      instruction: 'Set channel 2 back to BASS and channel 3 to STABS, and capture the decks into the Drop.',
      capture: { instance: XONE, controls: DECKS, label: 'the deck sources (CH 1–3)' },
      check: s => s.arrangement.sections.length >= 2 && fullAt(s, 1) && snap(s, sec(s, 1), XONE, 'ch2_src') === SRC.BASS,
      solution: { parts: { [XONE]: { ch1_src: SRC.DRUMS, ch2_src: SRC.BASS, ch3_src: SRC.STABS } }, capture: [{ section: 'Drop', instance: XONE, controls: DECKS }] },
      principle: 'A snapshot holds until another one changes it: every section says what it plays.',
    },
    {
      kind: 'info', concept: 'sequencer-pattern',
      instruction: 'Plan your changes on multiples of 8 bars.',
      principle: 'Dance music moves in phrases of 8 and 16 bars; changes on those lines feel inevitable.',
      explanation: 'Listeners count phrases without knowing it, and the stems\' chords repeat every 4 bars (Am7, Fmaj7, C, G), so 4, 8 and 16-bar sections keep the harmony in place. DJs also like 8–16 bars of drums at the start and end to mix in and out.',
    },
    {
      kind: 'quiz', concept: 'timing-tempo',
      instruction: 'Quick check.',
      quiz: {
        question: 'At 124 BPM, how long is a 16-bar section?',
        options: ['About 16 seconds', 'About 31 seconds', 'About 2 minutes'],
        answer: 1,
        explain: '16 bars × 4 beats = 64 beats; 64 × 60 ÷ 124 ≈ 31 s. "16 seconds" confuses bars with seconds.',
      },
    },
    {
      kind: 'do', concept: 'sequencer-pattern', area: 'arranger',
      instruction: 'Add an 8-bar Break: CH 1 PERC (no kick), CH 2 NONE, CH 3 PAD. Capture the decks into it, and mute the DFAM there.',
      capture: { instance: XONE, controls: DECKS, label: 'the deck sources (CH 1–3)' },
      check: s => { const i = breakIndex(s); return i > 0 && s.arrangement.sections[i].bars === 8; },
      solution: {
        arrangement: {
          enabled: true, loop: true,
          sections: [
            { name: 'Intro', bars: 8, parts: { [XONE]: { snapshot: { ch1_src: SRC.DRUMS, ch2_src: SRC.NONE, ch3_src: SRC.NONE } } } },
            { name: 'Drop', bars: 16, parts: { [XONE]: { snapshot: { ch1_src: SRC.DRUMS, ch2_src: SRC.BASS, ch3_src: SRC.STABS } } } },
            { name: 'Break', bars: 8, parts: { [XONE]: { snapshot: { ch1_src: SRC.PERC, ch2_src: SRC.NONE, ch3_src: SRC.PAD } }, dfam: { muted: true } } },
          ],
        },
      },
      hints: ['"+ Section", rename it Break, keep it at 8 bars.', 'In the deck strip: CH 1 PERC, CH 2 NONE, CH 3 PAD, then tap Break in the coach to capture.'],
      principle: 'Removing the kick and bass resets the ear, so their return feels huge.',
    },
    {
      kind: 'do', concept: 'sequencer-pattern', area: 'arranger',
      instruction: 'Add Build (8 bars: drums and stabs), Drop 2 (16: everything) and Outro (8: drums only), capturing the decks into each.',
      capture: { instance: XONE, controls: DECKS, label: 'the deck sources (CH 1–3)' },
      check: s => {
        const n = s.arrangement.sections.length;
        const b = breakIndex(s);
        return n >= 6 && b > 0 && idx(s).some(i => i > b && fullAt(s, i)) && sparseAt(s, n - 1);
      },
      solution: { arrangement: { enabled: true, loop: true, sections: songSections().filter(x => x.name !== 'Groove' && x.name !== 'Fill').map(x => (x.name === 'Build' ? { ...x, bars: 8 } : x)) } },
      hints: ['Three more sections; each one captures what it plays.', 'Build: CH 1 DRUMS, CH 2 NONE, CH 3 STABS. Drop 2: DRUMS, BASS, STABS. Outro: DRUMS, NONE, NONE.'],
      principle: 'A song ends the way DJs need it to: sparse, so the next track can come in.',
    },
    {
      kind: 'predict', concept: 'sequencer-pattern', area: 'arranger',
      instruction: 'Press "▶ from here" on the Break and listen through to Drop 2.',
      check: s => { const b = breakIndex(s); const p = s.arranger?.section ?? -1; return s.transport.playing && b >= 0 && p > b && fullAt(s, p); },
      solution: { play: { from: 'Break', seconds: 36 } },
      predict: {
        question: 'What will make the moment Drop 2 arrives hit hardest?',
        options: ['The tempo speeds up', 'The kick and the bass return together on the downbeat after being away', 'The chords change key'],
        answer: 1,
        explain: 'The release comes from contrast: the low end was missing for 16 bars and returns on beat 1. Tempo and key stay the same.',
      },
      principle: 'A drop is a return: its power is the contrast with what came before.',
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', area: 'arranger',
      instruction: 'Build a two-minute arrangement with a clear energy curve.',
      checklist: [
        { text: 'At least 6 sections', check: s => s.arrangement.sections.length >= 6 },
        { text: 'Every section is 4, 8, 16 or 32 bars', check: s => s.arrangement.sections.length > 0 && s.arrangement.sections.every(x => [4, 8, 16, 32].includes(x.bars)) },
        { text: 'At least 1:55 long', check: s => (songBars(s) * 240) / s.transport.bpm >= 115 },
        { text: 'The first section is sparse: no bass and no stabs', check: s => s.arrangement.sections.length > 0 && sparseAt(s, 0) },
        { text: 'A break without the kick and the bass', check: s => breakIndex(s) > 0 },
        { text: 'At least two full sections (drums, bass and stabs): the drops', check: s => idx(s).filter(i => fullAt(s, i)).length >= 2 },
        { text: 'The last section has fewer parts than the drops', check: s => { const n = s.arrangement.sections.length; return n > 1 && idx(s).some(i => fullAt(s, i) && stemCount(s, n - 1) < stemCount(s, i)); } },
      ],
      hints: [
        'Draw the energy first: low, rising, high, low, rising, highest, falling.',
        'Intro 8 · Groove 8 · Drop 16 · Break 8 · Build 8 · Drop 2 16 · Outro 8 is 72 bars, about 2:19.',
        'Give the Groove the bass but not the stabs, so each section adds one thing.',
      ],
      solution: { arrangement: { enabled: true, loop: false, sections: songSections().filter(x => x.name !== 'Fill').map(x => (x.name === 'Build' ? { ...x, bars: 8 } : x)) } },
    },
    {
      kind: 'reflect',
      instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What makes the second drop feel bigger than the first?',
        model: 'The break takes the kick and the bass away, so their return is a release; and the build before it raises the tension, so Drop 2 is the peak.',
      },
      explanation: 'Go further: make Drop 2 different from Drop 1. A snapshot of the DFAM (its knobs captured into Drop 2) with a brighter CUTOFF and more NOISE adds energy without a single new note.',
    },
  ],
  review: [
    { question: 'A 16-bar section at 124 BPM lasts about…', options: ['16 s', '31 s', '64 s'], answer: 1, explain: '64 beats at 124 per minute.' },
    { question: 'DJ-friendly intros usually start with…', options: ['The full mix', 'The hook alone', 'Drums only'], answer: 2, explain: 'Simple drums are easy to mix over.' },
    { question: 'Section changes feel natural on…', options: ['Any bar', 'Every 3 bars', 'Multiples of 8 bars'], answer: 2, explain: 'Dance music phrases in 8s and 16s.' },
    { question: 'A drop hits hardest when…', options: ['The kick and bass return on the downbeat after a break', 'Everything always plays', 'The tempo rises'], answer: 0, explain: 'Contrast.' },
    { question: 'A section\'s snapshot holds…', options: ['Only for its first bar', 'Until another section changes the same setting', 'Until you press Stop'], answer: 1, explain: 'So every section should say what it plays.' },
  ],
};

// ============================================================================
// L12 · Transitions
// ============================================================================

const FILTER_CAPTURE = { instance: XONE, controls: ['ch1_filter', 'ch2_filter', 'f1_on', 'f1_type', 'f1_freq', 'f1_res'], label: 'the filter settings' };
/** Section index by name, -1 when missing */
const at = (s: LessonCheckState, name: string) => s.arrangement.sections.findIndex(x => x.name.toLowerCase().replace(/\s+/g, '') === name.toLowerCase().replace(/\s+/g, ''));
/** A channel (1 or 2) goes through an ON filter in section i */
const filteredAt = (s: LessonCheckState, i: number, ch: string) => {
  const a = Number(sectionValue(s, i, XONE, `ch${ch}_filter`));
  if (a !== 0 && a !== 2) return false;
  return sectionValue(s, i, XONE, a === 0 ? 'f1_on' : 'f2_on') === true;
};
const drumsAt = (s: LessonCheckState, i: number) => !sectionMuted(s, i, XONE) && srcIn(s, i, 1) === SRC.DRUMS;

const transitions: Lesson = {
  id: 'studio-producer-12-transitions',
  device: 'studio',
  path: 'producer',
  order: 12,
  difficulty: 'advanced',
  name: 'Transitions',
  description: 'Tell the listener the drop is coming: a high-pass build on the drums, a one-bar breath, a DFAM roll in 32nds, and a drop that puts everything back on beat 1.',
  objective: 'Glue sections together with a filter build, a roll, and a gap before the drop, and make the drop undo every one of them.',
  source: 'Synth Studio · Producer path (curriculum L12)',
  estimatedMinutes: 18,
  prerequisites: ['studio-producer-11-arrangement'],
  concepts: ['sequencer-pattern', 'filter-cutoff', 'timing-tempo'],
  start: { studio: producerStudio({ xone: CP_MIXED.xone, dfam: CP_MIXED.dfam, arrangement: { enabled: true, loop: false, sections: songSections() } }) },
  steps: [
    {
      kind: 'info', concept: 'sequencer-pattern', area: 'arranger',
      instruction: '▶ Hear it: a finished build tells you the drop is coming. Then press "▶ from here" on your Build: yours just changes.',
      principle: 'A transition tells the listener a change is near.',
      explanation: 'The recording is the end of the build into Drop 2 in the demo "Low Tide Lights": a denser, higher snare roll, a noise riser, the drums thinned out, a last bar without a kick. In your song the Build simply becomes Drop 2. The last bar of the Build is its own 1-bar section, Fill, ready for a transition. In this lesson you make the end of the Build rise, thin out and breathe.',
      info: { play: { demo: 'low-tide-lights', excerpt: 'build-45-49' } },
    },
    {
      kind: 'quiz', concept: 'sequencer-pattern',
      instruction: 'Warm-up from the arrangement lesson.',
      quiz: {
        question: 'Section changes feel natural on…',
        options: ['Any bar', 'Multiples of 8 bars', 'Every 3 bars'],
        answer: 1,
        explain: 'Dance music phrases in 8s and 16s, so changes on those lines feel inevitable. That is why the Fill is the eighth bar of the Build.',
      },
    },
    {
      kind: 'info', concept: 'filter-cutoff',
      instruction: 'Listen for three signals that a change is coming: rising density, thinning lows, and a breath.',
      principle: 'Tension rises with density and brightness; a moment of silence makes the return land.',
      explanation: 'The classic signals: more notes and more volume, rising pitch or brightness, low end taken away, and a short silence just before the change. The drop then gives everything back on beat 1.',
    },
    {
      kind: 'do', concept: 'filter-cutoff', instance: XONE, focus: ['ch1_filter', 'f1_on', 'f1_type', 'f1_freq', 'f1_res'], scope: 'spectrum',
      instruction: 'Send channel 1 to FILTER 1 (its FILTER switch on 1): ON, HPF, FREQ about 300 Hz, RES about 5. Capture it into the Build.',
      capture: FILTER_CAPTURE,
      check: s => { const i = at(s, 'Build'); return i >= 0 && filteredAt(s, i, '1') && Number(sectionValue(s, i, XONE, 'f1_type')) === 0 && between(Number(sectionValue(s, i, XONE, 'f1_freq')), 150, 1500); },
      solution: {
        parts: { [XONE]: { ch1_filter: 0, f1_on: true, f1_type: 0, f1_freq: 300, f1_res: 5 } },
        capture: [{ section: 'Build', instance: XONE, controls: FILTER_CAPTURE.controls }],
      },
      hints: ['The FILTER switch is at the bottom of channel 1: 1 sends it to FILTER 1.', 'FILTER 1 is left of the channels: ON, then HPF, then FREQ and RES.', 'Then tap Build in the coach\'s capture row.'],
      principle: 'Taking the low end away before a drop builds tension; giving it back releases it.',
      manualReference: 'Xone:96 User Guide p.13–14 – Xone:VCF filter sections',
    },
    {
      kind: 'predict', concept: 'sequencer-pattern', area: 'arranger',
      instruction: 'Press "▶ from here" on the Build and listen as Drop 2 arrives.',
      check: s => s.transport.playing && (s.arranger?.section ?? -1) === at(s, 'Drop 2'),
      solution: { play: { from: 'Build', seconds: 18 } },
      predict: {
        question: 'When Drop 2 starts, will the drums be thin or full?',
        options: ['Full: the filter switches off by itself at the next section', 'Still thin: a snapshot holds until another one changes it', 'Silent'],
        answer: 1,
        explain: 'Nothing has told the filter to switch off, so Drop 2 keeps the Build\'s thin drums. A transition needs two halves: the change, and the section that undoes it.',
      },
      principle: 'Every change needs a section that undoes it.',
    },
    {
      kind: 'do', concept: 'filter-cutoff', instance: XONE, focus: ['ch1_filter'],
      instruction: 'Set channel 1\'s FILTER to OFF and capture it into Drop 2.',
      capture: FILTER_CAPTURE,
      check: s => { const i = at(s, 'Drop 2'); return i >= 0 && !filteredAt(s, i, '1') && snap(s, sec(s, i), XONE, 'ch1_filter') === 1; },
      solution: { parts: { [XONE]: { ch1_filter: 1 } }, capture: [{ section: 'Drop 2', instance: XONE, controls: FILTER_CAPTURE.controls }] },
      principle: 'The drop resets: low end, full drums, on beat 1.',
      explanation: 'Snapshots apply on the section\'s first beat, so the drums snap back to full exactly on the drop. A live sweep (turning FREQ up by hand through the Build) works too: the snapshot then resets it for you.',
    },
    {
      kind: 'do', concept: 'sequencer-pattern', instance: XONE, focus: ['ch1_src'],
      instruction: 'Make the Fill bar a breath: set DECK → CH 1 to NONE and capture it into the Fill.',
      capture: { instance: XONE, controls: ['ch1_src'], label: 'DECK → CH 1' },
      check: s => { const f = at(s, 'Fill'), d = at(s, 'Drop 2'); return f >= 0 && d === f + 1 && !drumsAt(s, f) && drumsAt(s, d); },
      solution: { capture: [{ section: 'Fill', instance: XONE, controls: ['ch1_src'], values: { ch1_src: SRC.NONE } }], parts: { [XONE]: { ch1_src: SRC.DRUMS } } },
      principle: 'A short silence before the drop makes the returning kick feel louder by contrast.',
    },
    {
      kind: 'quiz', concept: 'sequencer-pattern',
      instruction: 'Quick check.',
      quiz: {
        question: 'Why leave a short gap just before the drop?',
        options: ['To rest the CPU', 'Silence makes the returning kick hit harder by contrast', 'To change the tempo'],
        answer: 1,
        explain: 'The ear judges loudness against what came just before. After a bar without drums, the kick on beat 1 sounds bigger than it is.',
      },
    },
    {
      kind: 'predict', concept: 'timing-tempo', instance: CLOCK, focus: ['division'],
      instruction: 'Set CLOCK DIV to 1/32 and capture it into the Fill; then set 1/16 again and capture it into Drop 2.',
      capture: { instance: CLOCK, controls: ['division'], label: 'CLOCK DIV' },
      check: s => snap(s, sec(s, at(s, 'Fill')), CLOCK, 'division') === 3 && snap(s, sec(s, at(s, 'Drop 2')), CLOCK, 'division') === 2,
      solution: {
        capture: [
          { section: 'Fill', instance: CLOCK, controls: ['division'], values: { division: 3 } },
          { section: 'Drop 2', instance: CLOCK, controls: ['division'], values: { division: 2 } },
        ],
        parts: { [CLOCK]: { division: 2 } },
      },
      predict: {
        question: 'In the Fill bar, the DFAM will…',
        options: ['Play twice as fast: a roll into the drop', 'Play at half speed', 'Stop'],
        answer: 0,
        explain: 'Twice as many pulses, twice as many steps: a 32nd-note roll, the DFAM\'s version of a snare roll. 32 pulses in one bar are exactly four turns of its 8 steps, so it lands back on step 1 for the drop.',
      },
      principle: 'Doubling the density for a bar pushes the music toward the next downbeat.',
    },
    {
      kind: 'listen', concept: 'timing-tempo',
      instruction: 'Hear the DFAM at 1/16 and at 1/32 under the drop.',
      listen: {
        a: {}, b: {},
        labels: ['CLOCK DIV 1/16', '1/32'],
        from: 'Drop',
        parts: { a: { [CLOCK]: { division: 2 } }, b: { [CLOCK]: { division: 3 } } },
        question: {
          question: 'What does the 1/32 roll do to the energy?',
          options: ['Doubles the density: it pushes toward the next downbeat', 'Lowers the pitch', 'Nothing you can hear'],
          answer: 0,
          explain: 'Twice the hits in the same time is more urgency. Held for a whole section it tires the ear; for one bar before a drop it is a signal.',
        },
      },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', area: 'arranger',
      instruction: 'Announce the drop with at least three transitions, and make the drop undo them.',
      checklist: [
        { text: 'A filter build: a section sends channel 1 or 2 through an ON filter', check: s => idx(s).some(i => filteredAt(s, i, '1') || filteredAt(s, i, '2')) },
        { text: 'The drop after it puts the filter back OFF', check: s => idx(s).some(i => (filteredAt(s, i, '1') || filteredAt(s, i, '2')) && idx(s).some(j => j > i && fullAt(s, j) && !filteredAt(s, j, '1') && !filteredAt(s, j, '2'))) },
        { text: 'A breath: a 1- or 2-bar section without drums, right before a section with them', check: s => idx(s).some(i => i + 1 < s.arrangement.sections.length && s.arrangement.sections[i].bars <= 2 && !drumsAt(s, i) && drumsAt(s, i + 1)) },
        { text: 'A roll: a section where the Studio Clock runs at 1/32, and a later one back at 1/16', check: s => idx(s).some(i => Number(sectionValue(s, i, CLOCK, 'division')) === 3 && idx(s).some(j => j > i && Number(sectionValue(s, j, CLOCK, 'division')) === 2)) },
        { text: 'The song is still 1:55 or longer', check: s => (songBars(s) * 240) / s.transport.bpm >= 115 },
      ],
      hints: [
        'Look at the last bar before each section starts.',
        'A filter build in the Build, a roll and a breath in the Fill, everything back in Drop 2.',
        'Try a low-pass on the bass in the Groove too (FILTER 2, LPF about 900 Hz): it enters muffled and opens in the Drop.',
      ],
      solution: { arrangement: { enabled: true, loop: false, sections: songWithTransitions() } },
    },
    {
      kind: 'reflect',
      instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Pick one transition in your track. What tension did you build, and how was it released?',
        model: 'For example: "The high-pass thinned the drums through the Build, the Fill dropped them out while the DFAM rolled, and Drop 2 gave the kick and the bass back on beat 1."',
      },
    },
  ],
  review: [
    { question: 'A high-pass sweep during a build…', options: ['Adds bass', 'Takes the low end away, building tension', 'Shortens the pattern'], answer: 1, explain: 'The low end leaves and returns at the drop.' },
    { question: 'The classic pre-drop move is…', options: ['A tempo drop', 'More reverb on the kick', 'A short gap of silence'], answer: 2, explain: 'Contrast makes the return louder.' },
    { question: 'Snapshots in the arranger apply…', options: ['Gradually across the section', 'On the section\'s first beat', 'Only while you hold a key'], answer: 1, explain: 'Sections switch on bar lines.' },
    { question: 'A section that switches a filter on needs…', options: ['A later section that switches it off', 'Nothing more', 'A faster tempo'], answer: 0, explain: 'A snapshot holds until another one changes it.' },
    { question: 'Doubling the clock for one bar makes the DFAM…', options: ['Roll twice as fast', 'Play an octave lower', 'Stop'], answer: 0, explain: 'Twice the pulses, twice the steps.' },
  ],
};

// ============================================================================
// L13 · Mixdown
// ============================================================================

/** The mixed balance (GAIN, faders, returns, MASTER 1) without the rest of the desk */
const MIX_LEVELS = Object.fromEntries(
  ['ch1_gain', 'ch2_gain', 'ch3_gain', 'ch4_gain', 'ch1_fader', 'ch2_fader', 'ch3_fader', 'ch4_fader', 'cha_fader', 'chb_fader', 'master']
    .map(k => [k, CP_MIXED.xone[k]]),
) as Record<string, number>;

/** A Xone channel meter is in the healthy window: peaks between lo and hi dBu, PK dark */
const healthy = (s: LessonCheckState, ch: string, lo = 1, hi = 8) => {
  const m = xmeter(s, ch);
  return !!m && s.transport.playing && between(m.peak, lo, hi) && !m.pk;
};

const mixdown: Lesson = {
  id: 'studio-producer-13-mixdown',
  device: 'studio',
  path: 'producer',
  order: 13,
  difficulty: 'advanced',
  name: 'Mixdown',
  description: 'A rough mix that clips: set every GAIN by its meter, build the balance up from the drums, check it in mono and land the master at about −6 dBFS peaks.',
  objective: 'Mix the track: gain-stage every channel, balance the parts against the drums, check it in mono, and leave about 6 dB of headroom for mastering.',
  source: 'Synth Studio · Producer path (curriculum L13)',
  estimatedMinutes: 22,
  prerequisites: ['studio-producer-12-transitions'],
  concepts: ['gain-staging', 'mixing', 'equalization'],
  start: { studio: producerStudio({ xone: CP_ROUGH.xone, dfam: CP_ROUGH.dfam, arrangement: { enabled: false, loop: false, sections: songWithTransitions() } }) },
  steps: [
    {
      kind: 'listen', concept: 'mixing',
      instruction: 'Two balances of the same drop, at the same loudness. Which one is wrong?',
      explanation: 'Both are the second drop of the demo "Low Tide Lights".',
      listen: {
        a: {}, b: {},
        labels: ['Mix A', 'Mix B'],
        demo: { demo: 'low-tide-lights', excerpt: 'drop2-49-52', a: 'as-made', b: 'drums-down' },
        question: {
          question: 'In B, what is wrong?',
          options: ['The chords are too quiet', 'The drums are buried, so the groove loses its push', 'The tempo dragged'],
          answer: 1,
          explain: 'Only the drums moved, 6 dB down. With the loudness matched everything else even sounds louder, yet the groove sags: a dance mix is built on the kick. The tempo can\'t change with a fader.',
        },
      },
    },
    {
      kind: 'quiz', concept: 'sequencer-pattern',
      instruction: 'Warm-up from the transitions lesson.',
      quiz: {
        question: 'Snapshots in the song arranger apply…',
        options: ['Gradually across the section', 'On the section\'s first beat, and hold until another snapshot changes them', 'Only while you hold a key'],
        answer: 1,
        explain: 'Sections switch on bar lines, so a snapshot lands on the downbeat and stays until a later section sets the same control. That is why the drums snap back to full exactly on Drop 2.',
      },
    },
    {
      kind: 'info', concept: 'gain-staging',
      instruction: 'Mix in order: gain first, then the faders, then the master.',
      principle: 'Set levels at the input first; balance with faders second.',
      explanation: 'Gain staging means a healthy level at every stage, from the instrument to the channel GAIN. A static mix is the faders and EQ with no moves, built up from the most important part. Song mode is off in this lesson, so the drop loops while you mix.',
    },
    {
      kind: 'do', concept: 'mixing', instance: XONE, focus: ['ch2_fader', 'ch3_fader', 'ch4_fader'],
      instruction: 'Press ▶, then pull Xone channels 2, 3 and 4 down to 0: only the drums are left.',
      check: s => s.transport.playing && ['2', '3', '4'].every(c => xv(s, c, 'FADER') <= 0.5),
      solution: { transport: 'play', parts: { [XONE]: { ch2_fader: 0, ch3_fader: 0, ch4_fader: 0 } } },
      principle: 'Start a mix from the drums; every other part is balanced against them.',
      explanation: 'The channel meters read before the faders, so you can still set each GAIN with its fader down. That is what the next steps do.',
    },
    {
      kind: 'do', concept: 'gain-staging', instance: XONE, focus: ['ch1_gain'], readout: ['channels'],
      instruction: 'Turn channel 1 GAIN down until its meter peaks between +3 and +6 and PK stays dark.',
      check: s => healthy(s, '1'),
      solution: { parts: { [XONE]: { ch1_gain: 0 } }, play: { seconds: 3 } },
      hints: ['PK is the LED beside GAIN: it lights when the signal after GAIN is too hot.', 'Watch the channel meter while you turn: the loudest LEDs should reach +3 or +6, never +10.', 'About 0 dB on GAIN.'],
      principle: 'A channel peaking near +6 has room above it and stays clear of the noise below.',
      explanation: 'The channel meter reads after GAIN and EQ, before the fader, from −20 to +10. Like the hardware\'s LED ladder it is quasi-peak: the sharpest hits read a few dB under their true peak. PK takes the true peaks: it lights when the signal after GAIN is hot enough to distort the channel. Someone had GAIN at +9 dB.',
      manualReference: 'Xone:96 User Guide p.9, p.11 – channel meters and PK!',
    },
    {
      kind: 'do', concept: 'gain-staging', instance: XONE, focus: ['ch2_gain', 'ch3_gain', 'ch4_gain'], readout: ['channels'],
      instruction: 'Set channels 2, 3 and 4 GAIN the same way: peaks between +1 and +6, PK dark. Short perc hits read lower than the decks.',
      check: s => ['2', '3', '4'].every(c => healthy(s, c)),
      solution: { parts: { [XONE]: { ch2_gain: MIX_LEVELS.ch2_gain, ch3_gain: MIX_LEVELS.ch3_gain, ch4_gain: MIX_LEVELS.ch4_gain } }, play: { seconds: 3 } },
      hints: ['One channel at a time: watch only its meter.', 'The stabs (3) are too hot; the perc (4) is too quiet.', 'Bass about −1 dB, stabs about +2 dB, perc fully up (+10 dB).'],
      principle: 'Matched input levels make the faders do the balancing, not rescue it.',
    },
    {
      kind: 'predict', concept: 'mixing', instance: XONE, focus: ['ch2_fader'], readout: ['peaks'],
      instruction: 'Raise channel 2 (bass) until it feels about as strong as the drums.',
      check: s => xv(s, '2', 'FADER') >= 8.5,
      solution: { parts: { [XONE]: { ch2_fader: 9.5 } } },
      predict: {
        question: 'When the bass is set right, the studio master meter will…',
        options: ['Stay the same', 'Rise by a few dB, because two loud parts add up', 'Drop'],
        answer: 1,
        explain: 'Two strong low parts sum, so the master peaks climb. That is why you balance first and set the overall level last. Nothing in this move can make the master quieter.',
      },
      principle: 'Parts add up: balance first, then set the overall level.',
    },
    {
      kind: 'info', concept: 'mixing',
      instruction: 'Use this level guide as a starting point, then trust your ears.',
      principle: 'A level guide is a starting point; the ears make the decision.',
      explanation: 'Measured against the drums in short-term loudness: bass 2–4 dB under, stabs 6–10 dB, perc 8–14 dB, the FX returns 12–20 dB. On the Xone\'s CONST PWR faders 9.5 is about −2 dB, 9 about −4.5 dB, 8.5 about −8 dB and 7.5 about −12 dB, so small moves near the top are big changes.',
    },
    {
      kind: 'do', concept: 'mixing', instance: XONE, focus: ['ch3_fader', 'ch4_fader'],
      instruction: 'Bring channel 3 (stabs) and channel 4 (perc) back in, under the drums and the bass.',
      check: s => between(xv(s, '3', 'FADER'), 7, 9.8) && between(xv(s, '4', 'FADER'), 6.5, 9.8) &&
        xv(s, '3', 'FADER') < xv(s, '1', 'FADER') && xv(s, '4', 'FADER') < xv(s, '1', 'FADER'),
      solution: { parts: { [XONE]: { ch3_fader: MIX_LEVELS.ch3_fader, ch4_fader: MIX_LEVELS.ch4_fader } } },
      hints: ['Push each one up until you can hear it clearly, then back off a touch.', 'Stabs about 8.5, perc about 7.5.'],
      principle: 'Supporting parts sit just under the leaders: heard clearly, never competing.',
    },
    {
      kind: 'predict', concept: 'mixing', instance: XONE, focus: ['booth_mono', 'monitor_out'],
      instruction: 'Press BOOTH STEREO/MONO, and set YOU HEAR to BOOTH.',
      check: s => val(s, XONE, 'booth_mono') === true && num(s, XONE, 'monitor_out') === 1,
      solution: { parts: { [XONE]: { booth_mono: true, monitor_out: 1 } } },
      predict: {
        question: 'In mono, what should you listen for?',
        options: ['The mix getting wider', 'Nothing important disappearing or getting much quieter', 'The tempo staying the same'],
        answer: 1,
        explain: 'Mono adds left and right together. Phones, club systems and many speakers play mono, so a part that only works in stereo can vanish. Mono is never wider, and it can\'t change the tempo.',
      },
      principle: 'A mix must survive mono: phones, clubs and many speakers sum left and right.',
      explanation: 'The booth output has its own STEREO/MONO switch, so DJs can check mono without touching the main output. YOU HEAR (twin only) chooses which output your speakers play. The booth is at unity here, so only the mono sum changes.',
      manualReference: 'Xone:96 User Guide p.17 – booth STEREO/MONO',
    },
    {
      kind: 'quiz', concept: 'mixing',
      instruction: 'Quick check.',
      quiz: {
        question: 'Why keep the kick and bass in the centre?',
        options: ['So the mix sounds wider', 'Because drums can\'t be panned', 'Because the low end carries most of the energy and must stay strong in mono'],
        answer: 2,
        explain: 'Off-centre lows lose power on mono systems and pull the speakers unevenly. Width belongs to the higher parts and the FX returns. Drums can be panned; the kick just shouldn\'t be.',
      },
    },
    {
      kind: 'do', concept: 'mixing', instance: XONE, focus: ['booth_mono', 'monitor_out'],
      instruction: 'Turn MONO off and set YOU HEAR back to MASTER.',
      check: s => val(s, XONE, 'booth_mono') === false && num(s, XONE, 'monitor_out') === 0,
      solution: { parts: { [XONE]: { booth_mono: false, monitor_out: 0 } } },
      principle: 'Check in mono, mix in stereo.',
    },
    {
      kind: 'do', concept: 'gain-staging', instance: XONE, focus: ['master'], readout: ['peaks', 'limiter'],
      instruction: 'Lower the Xone\'s MASTER 1 until the studio master peaks around −6 dBFS and the limiter rests.',
      check: s => {
        const m = master(s);
        return !!m && s.transport.playing && m.measuredSec >= 3 && between(m.peakDb, -8, -4) && m.grDb < 0.05;
      },
      solution: { parts: { [XONE]: { master: MIX_LEVELS.master } }, play: { seconds: 5 } },
      hints: ['Watch the peak number in the coach (or the master meter in the mixer): the loudest moments count.', 'MASTER 1 is unity at 8; each step below takes a few dB off.', 'Between 7.5 and 8.'],
      principle: 'Headroom, the space below 0 dBFS, keeps peaks clean and leaves room for mastering.',
      explanation: 'The studio master has a limiter that is always on at −1 dBTP. In a mixdown it should have nothing to do: its GR (gain reduction) reading is how you know. MASTER 1 had been fully up, +6 dB, so the limiter was squashing every kick.',
    },
    {
      kind: 'match', concept: 'mixing', instance: XONE,
      instruction: 'A reference balance is hidden. Match channel 2\'s fader to it by ear.',
      setup: { ch2_fader: 7 },
      match: { target: { ch2_fader: MIX_LEVELS.ch2_fader }, controls: ['ch2_fader'] },
      hints: ['Is the bass too loud or too quiet against the drums?', 'Raise it until the bass sits level with the kick.'],
    },
    {
      kind: 'challenge', concept: 'mixing', instance: XONE, readout: ['channels', 'peaks', 'limiter'],
      instruction: 'Finish a clean, balanced mixdown.',
      checklist: [
        { text: 'Every channel peaks between 0 and +7 on its meter, PK dark', check: s => ['1', '2', '3', '4'].every(c => healthy(s, c, 0, 7)) },
        { text: 'The studio master peaks between −8 and −4 dBFS, and the limiter rests', check: s => { const m = master(s); return !!m && s.transport.playing && between(m.peakDb, -8, -4) && m.grDb < 0.05; } },
        { text: 'The drums lead: channel 1 has the highest fader', check: s => ['2', '3', '4'].every(c => xv(s, '1', 'FADER') >= xv(s, c, 'FADER')) },
        { text: 'The FX returns (channels A and B) sit below the instruments', check: s => ['a', 'b'].every(c => xv(s, c, 'FADER') <= 8.5 && xv(s, c, 'FADER') < xv(s, '1', 'FADER')) },
        { text: 'You checked mono, and YOU HEAR is back on MASTER', check: s => !!s.history?.wasOn(XONE, 'booth_mono') && val(s, XONE, 'booth_mono') === false && num(s, XONE, 'monitor_out') === 0 },
      ],
      hints: [
        'Gain first, then faders, then the master.',
        'Drums 10, bass about 9.5, stabs about 9, perc about 8.5, returns about 7.5.',
        'If the master peaks too hot, lower MASTER 1, not the GAINs.',
      ],
      solution: { parts: { [XONE]: { ...MIX_LEVELS, booth_mono: false, monitor_out: 0 } }, play: { seconds: 6 } },
    },
    {
      kind: 'reflect',
      instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Describe your mixing order, and why it works.',
        model: 'Gain first, so every channel has a healthy level; then the drums, then the bass against them, then the other parts by importance; check in mono; and set the master last, leaving headroom for mastering.',
      },
      explanation: 'Go further: switch the Xone\'s CHANNEL FADER curve to DIPPED and redo the balance. The faders now change level more evenly across their travel, which some engineers prefer for mixing.',
    },
  ],
  review: [
    { question: 'Gain staging means…', options: ['Turning everything up', 'Setting healthy levels at each stage before balancing', 'Muting channels'], answer: 1, explain: 'Good input levels make every later stage easier.' },
    { question: 'Start a static mix from…', options: ['The reverb', 'The stabs', 'The drums'], answer: 2, explain: 'They are the reference everything else sits against.' },
    { question: 'A mono check reveals…', options: ['Parts that vanish or thin out when left and right are summed', 'Tempo problems', 'Tuning'], answer: 0, explain: 'Wide or out-of-phase parts cancel in mono.' },
    { question: 'Before mastering, mix peaks of about…', options: ['0 dBFS', '−6 dBFS', '−30 dBFS'], answer: 1, explain: 'Room for the limiter without wasting resolution.' },
    { question: 'The Xone\'s PK LED lights when…', options: ['The fader is at the top', 'The signal after GAIN is too hot', 'A channel is cued'], answer: 1, explain: 'Turn that channel\'s GAIN down.' },
  ],
};

// ============================================================================
// L14 · Master and bounce
// ============================================================================

/** Master fader for about -14 LUFS integrated on the mixed Tide Pool song */
const STREAMING_DRIVE = 5.5;

const songS = (s: LessonCheckState) => songSeconds(s);
/** The whole song measured live from bar 1, with nothing changed on the way, on target */
const liveMasterOnTarget = (s: LessonCheckState) => {
  const m = master(s);
  const len = songS(s);
  return !!m && len > 0 && m.fromStart && m.steady && m.measuredSec >= len - 3 && between(m.lufsI, -15, -13) && m.maxTruePeakDb <= -0.95;
};
/** The last bounce: the whole song, on a streaming (or club) target */
const bounceOnTarget = (s: LessonCheckState, club = false) => {
  const b = s.bounce?.last;
  return !!b && b.kind === 'bounce' && b.complete && b.truePeakDb <= -0.95 &&
    (between(b.lufsI, -15, -13) || (club && between(b.lufsI, -10, -9)));
};

const masterBounce: Lesson = {
  id: 'studio-producer-14-master-bounce',
  device: 'studio',
  path: 'producer',
  order: 14,
  difficulty: 'advanced',
  name: 'Master and bounce',
  description: 'Drive the mixed song into the studio limiter to a streaming loudness, measured over the whole song, then bounce the WAV and its stems.',
  objective: 'Master the track to a streaming level (about −14 LUFS integrated, true peak −1 dBTP or lower), then bounce a WAV and stems.',
  source: 'Synth Studio · Producer path (curriculum L14)',
  estimatedMinutes: 18,
  prerequisites: ['studio-producer-13-mixdown'],
  concepts: ['gain-staging', 'mixing'],
  start: {
    studio: producerStudio({
      xone: CP_MIXED.xone, dfam: CP_MIXED.dfam,
      arrangement: { enabled: true, loop: false, sections: songWithTransitions() },
      ownStudio: 'a mixed song or loop',
    }),
  },
  steps: [
    {
      kind: 'listen', concept: 'gain-staging',
      instruction: 'Two masters of the same drop, played at the same loudness, the way a streaming service plays them. Which hits harder?',
      explanation: 'Both are the second drop of the demo "Low Tide Lights": its own master, and the same mix pushed much harder into the limiter.',
      listen: {
        a: {}, b: {},
        labels: ['Master A', 'Master B'],
        demo: { demo: 'low-tide-lights', excerpt: 'drop2-49-52', a: 'as-made', b: 'crushed' },
        question: {
          question: 'Which one sounds punchier when both are equally loud?',
          options: ['A', 'B', 'They sound identical'],
          answer: 0,
          explain: 'B was driven 9 dB harder into the limiter: its extra loudness came from squashing every peak. Played at the same loudness, A keeps its kick transients and B sounds flat and tired.',
        },
      },
    },
    {
      kind: 'quiz', concept: 'gain-staging',
      instruction: 'Warm-up from the mixdown.',
      quiz: {
        question: 'Before mastering, the mix should peak at about…',
        options: ['0 dBFS', '−6 dBFS', '−30 dBFS'],
        answer: 1,
        explain: 'About 6 dB of headroom leaves the limiter room to work. 0 dBFS leaves none; −30 dBFS wastes resolution and needs a huge push.',
      },
    },
    {
      kind: 'info', concept: 'gain-staging', area: 'master', readout: ['loudness', 'peaks', 'limiter'],
      instruction: 'Find the master meter in the mixer: M, S and I are loudness, TP is true peak, GR is the limiter.',
      principle: 'Perceived loudness follows average energy, not the highest peak.',
      explanation: 'LUFS measures loudness the way ears hear it, averaged over time: momentary (0.4 s), short-term (3 s) and integrated (the whole song). True peak estimates the peaks between samples that appear after conversion and encoding. The coach shows the same numbers live.',
    },
    {
      kind: 'do', concept: 'gain-staging', area: 'arranger', readout: ['loudness'],
      instruction: 'In the song arranger, press "▶ from here" on the Drop.',
      // In a studio of your own without a Drop, any playing counts
      check: s => s.transport.playing && (/^drop$/i.test((s.arranger?.name ?? '').trim()) || !s.arrangement.sections.some(x => /^drop$/i.test(x.name.trim()))),
      solution: { play: { from: 'Drop', seconds: 2 } },
      principle: 'Set the level on the loudest part of the song: the drops decide it.',
    },
    {
      kind: 'info', concept: 'gain-staging', area: 'master',
      instruction: 'The studio master ends in a limiter that is always on, with its ceiling at −1 dBTP. The MASTER fader is the gain into it.',
      principle: 'A limiter stops peaks at a ceiling, so the whole mix can be turned up safely.',
      explanation: 'A limiter is a very fast compressor with an infinite ratio: no peak gets past the ceiling. Below the ceiling it does nothing. Push the MASTER fader and the average rises while the limiter catches more peaks; its GR meter shows how hard it works.',
    },
    {
      kind: 'predict', concept: 'gain-staging', area: 'master', readout: ['loudness', 'peaks', 'limiter'],
      instruction: 'While the Drop plays, raise the studio MASTER fader by about 6 dB.',
      check: s => (s.master?.gainDb ?? 0) >= 5,
      solution: { master: { gain: 6 } },
      predict: {
        question: 'What will happen to the loudness and the peaks?',
        options: ['The peaks go above the ceiling', 'Loudness rises; the peaks stay at the ceiling while the limiter works harder', 'Nothing changes'],
        answer: 1,
        explain: 'The fader is gain into the limiter. The ceiling holds, so the average rises and the GR meter shows the limiter working. No peak can pass the ceiling.',
      },
      principle: 'Gain into a limiter raises the average; the ceiling holds the peaks.',
    },
    {
      kind: 'listen', concept: 'gain-staging',
      instruction: 'Compare light and heavy limiting at the same loudness.',
      listen: {
        a: {}, b: {},
        labels: ['+3 dB into the limiter', '+12 dB'],
        matchLoudness: true,
        from: 'Drop',
        master: { a: { gain: 3 }, b: { gain: 12 } },
        question: {
          question: 'Which one keeps the kick punchier?',
          options: ['A, the light one', 'B, the heavy one'],
          answer: 0,
          explain: 'At +12 dB the limiter flattens every kick peak (watch GR in the meter); at +3 dB it only catches the loudest few. Matched in loudness, the difference is the punch.',
        },
      },
    },
    {
      kind: 'quiz', concept: 'gain-staging',
      instruction: 'Quick check.',
      quiz: {
        question: 'Spotify plays tracks at about −14 LUFS. Your master is −8 LUFS. What happens?',
        options: ['It plays louder than other tracks', 'It is rejected', 'It is turned down about 6 dB and keeps its squashed dynamics'],
        answer: 2,
        explain: 'Normalisation turns loud masters down, and the punch the limiter took doesn\'t come back. Apple Music normalises to about −16 LUFS, so −14 is a good all-round target.',
      },
    },
    {
      kind: 'do', concept: 'gain-staging', area: 'master', readout: ['loudness', 'peaks', 'limiter'],
      instruction: 'Set the MASTER fader, then play the whole song from bar 1 without touching anything: the integrated loudness should end at −14 LUFS, ±1.',
      check: s => liveMasterOnTarget(s) || bounceOnTarget(s),
      solution: { master: { gain: STREAMING_DRIVE }, play: { song: true } },
      hints: [
        'Integrated loudness needs the whole song: press ▶ in the top bar from the start and let it play to the end.',
        'Each dB of MASTER adds about a dB of loudness until the limiter works hard. Changing anything restarts the measurement.',
        'If GR shows more than 4 dB on the kicks, back off and lower the hottest part of the mix instead. About +5.5 dB works for this mix.',
      ],
      principle: 'Integrated loudness is the whole song\'s average: measure it from the top, hands off.',
      explanation: 'The intro and the break are quieter than the drops, so a whole song reads lower than its loudest part. The meter\'s gating ignores the near-silent moments, so the drops count the most.',
    },
    {
      kind: 'info', concept: 'gain-staging',
      instruction: 'Decide whether you also need a club master.',
      principle: 'Louder masters cost punch: make a separate club master only if you need one.',
      explanation: 'DJs and clubs don\'t normalise, so club masters often run −9 to −6 LUFS. Make it a separate master with true peak at −1 dBTP or lower; Spotify suggests −2 dBTP for masters louder than −14 LUFS, because lossy encoders overshoot more on loud material.',
    },
    {
      kind: 'do', concept: 'mixing', area: 'transport',
      instruction: 'Bounce the song: press Bounce…, tick Stems, leave Normalise off, and press Bounce.',
      check: s => bounceOnTarget(s, true) && (s.bounce?.last?.stems ?? 0) >= 2,
      solution: { bounce: { stems: true } },
      hints: ['Bounce… is in the top bar, next to REC.', 'It plays the song from bar 1 to the end, then waits for the reverb and delay tails.'],
      principle: 'Bouncing renders the mix to files you can share, release or finish elsewhere.',
      explanation: 'Stems are separate audio files that start together and add up to the mix. Here everything runs through the Xone:96, so its stem is the whole mix before the master section, and your DFAM gets a stem of its own (before the mixer), with the studio returns. Leave Normalise off: you are the mastering engineer.',
    },
    {
      kind: 'challenge', concept: 'gain-staging', readout: ['loudness', 'peaks', 'limiter'],
      instruction: 'Deliver a streaming master and its stems.',
      checklist: [
        { text: 'Integrated −15 to −13 LUFS (or −10 to −9 for a club master)', check: s => { const b = s.bounce?.last; return !!b && (between(b.lufsI, -15, -13) || between(b.lufsI, -10, -9)); } },
        { text: 'True peak −1.0 dBTP or lower', check: s => (s.bounce?.last?.truePeakDb ?? 0) <= -0.95 },
        { text: 'The limiter\'s largest gain reduction is 4 dB or less', check: s => { const b = s.bounce?.last; return !!b && b.maxGrDb <= 4; } },
        { text: 'Bounced from bar 1 to the end of the song', check: s => !!s.bounce?.last?.complete },
        { text: 'Stems bounced with it', check: s => (s.bounce?.last?.stems ?? 0) >= 2 },
      ],
      hints: [
        'Measure the whole song, not a loop.',
        'If you can\'t reach −14 without heavy limiting, revisit the mix: usually one part peaks far above the rest.',
        'MASTER about +5.5 dB, then Bounce… with Stems ticked.',
      ],
      solution: { master: { gain: STREAMING_DRIVE }, bounce: { stems: true } },
    },
    {
      kind: 'reflect',
      instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why is louder not better for streaming?',
        model: 'Streaming services turn loud masters down to the same loudness, so extra loudness only costs punch and clarity. A healthy level with headroom on the peaks sounds better once everything plays at the same level.',
      },
      explanation: 'Go further: open the master chain and switch on GLUE (2:1, slow attack, auto release) for 1–2 dB of reduction before the limiter. The parts move together, and the limiter has less to do.',
    },
  ],
  review: [
    { question: 'LUFS measures…', options: ['Peak level only', 'Perceived loudness over time', 'Tempo'], answer: 1, explain: 'It weights frequencies the way ears do and averages over time.' },
    { question: 'True peak catches…', options: ['Average loudness', 'The bass level', 'Peaks between samples that appear after conversion'], answer: 2, explain: 'The waveform can overshoot between samples.' },
    { question: 'A common streaming target is about…', options: ['−14 LUFS integrated', '0 LUFS', '−30 LUFS'], answer: 0, explain: 'Spotify, YouTube and others normalise near −14.' },
    { question: 'Keep the true peak at about…', options: ['+3 dBTP', '−1 dBTP or lower', '−20 dBTP'], answer: 1, explain: 'It leaves room for lossy encoding.' },
    { question: 'Stems are…', options: ['MIDI files', 'Separate audio files for groups of parts that add up to the mix', 'A louder master'], answer: 1, explain: 'They let others rebalance or remix the track.' },
  ],
};

/** The whole path in order: the Elektron lessons (L1-L3, L5, L6, L8, L15) and the studio ones */
export const PRODUCER_LESSONS: Lesson[] = [
  ...PRODUCER_ELEKTRON_LESSONS, oneClock, frequencySlots, spaceDepth, earLab, arrangement, transitions, mixdown, masterBounce,
].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

