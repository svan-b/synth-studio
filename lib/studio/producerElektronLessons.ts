// ============================================================================
// The Producer path on the Elektrons (docs/research/producer-path/curriculum.md):
// L1 First beat, L2 Groove, L3 Bass locked to the kick, L5 Chords and pads,
// L6 A hook, L8 Movement and L15 the Capstone. The learner builds "Low Tide", a
// deep-house track in A minor, on the Analog Rytm (drums) and the Analog Four
// (bass, chords, hook), with the Sub 37 as a guest and the Xone:96 as the mixer.
//
// Each lesson starts from a checkpoint of that studio (lib/studio/producerElektron.ts)
// or, with "Use my own studio", on the learner's own track: the checks read the
// patterns wherever they are. Trigs are numbered 1..64 like the trig keys, in the
// text, the checks (lib/studio/checks.ts) and the solutions.
//
// Demo excerpts (`info.play`, `listen.demo`) wait for the demo tracks
// (wip/demo-tracks): until they merge, the hooks play the instruments' own
// auditions and the A/B steps compare the learner's own track.
// ============================================================================

import type { Lesson, LessonCheckState, MultipleChoice } from '@/types';
import { LFO_MULTS, dest } from '@/devices/analog-four/params';
import {
  A_MINOR, A_MINOR_PENTA, barOf, between, busyTracks, conditions, has, hasTrigs, inst, lenOf, lockCount, lockedTrigs, master,
  noteOf, num, oneKey, pc, plen, proj, pswing, songSeconds, trig, trigs, val, velOf, xmeter, xv,
} from './checks';
import {
  A4, BASS_4, BASS_BAR, BD, CAPSTONE_DRIVE, CAPSTONE_GLUE, CAPSTONE_MIX, CH, CP, CP_00, CP_01, CP_02, CP_03, CP_05, CP_08, CP_CAPSTONE,
  HATS_GROOVE, HOOK_2, LEN, LT, OH, RS, RYTM, SD, STABS_4, SUB, SWING, T1, T2, T3, T4, XONE, capstoneSong,
  capstoneTransitions, elektronStudio, line, nn, on,
} from './producerElektron';

type S = LessonCheckState;
const mc = (question: string, options: string[], answer: number, explain: string): MultipleChoice => ({ question, options, answer, explain });
const playing = (s: S) => s.transport.playing;
const BEATS = [1, 5, 9, 13];

// ---- the Analog Four -------------------------------------------------------------------

/** An A4 track's control value, by key: a4(s, T2, 'amp_atk') */
const a4 = (s: S, track: number, key: string) => num(s, A4, `t${track + 1}_${key}`);

/** LFO 1 speed x tempo-synced multiplier (128 = one cycle a bar); 0 when the multiplier runs free of the tempo */
function lfoRate(s: S, track: number, lfo: 1 | 2 = 1): number {
  const mult = LFO_MULTS[Math.round(a4(s, track, `lfo${lfo}_mul`))] ?? '';
  const m = /^x(\d+)(K?)$/i.exec(mult);
  return m ? Math.abs(a4(s, track, `lfo${lfo}_spd`)) * Number(m[1]) * (m[2] ? 1024 : 1) : 0;
}
/** An LFO that moves something: a destination and a depth */
const lfoOn = (s: S, track: number, lfo: 1 | 2 = 1) =>
  a4(s, track, `lfo${lfo}_dsta`) > 0 && Math.abs(a4(s, track, `lfo${lfo}_depa`)) >= 4;
/** Slow: a cycle of four bars or longer, synced to the tempo */
const lfoSlow = (s: S, track: number, lfo: 1 | 2 = 1) => { const r = lfoRate(s, track, lfo); return r > 0 && r <= 32; };

/** The notes of a track's trigs in a bar (1-4), in order */
const barNotes = (s: S, dev: string, track: number, bar: number) =>
  trigs(s, dev, track).filter(n => barOf(n) === bar).map(n => noteOf(s, dev, track, n) ?? -1);

// ============================================================================
// L1 · First beat
// ============================================================================

const firstBeat: Lesson = {
  id: 'studio-producer-01-first-beat',
  device: 'studio',
  path: 'producer',
  order: 1,
  difficulty: 'beginner',
  name: 'First beat',
  description: 'Program a four-on-the-floor beat on the Analog Rytm: a kick on every beat, a clap on the backbeat and hi-hats between them.',
  objective: 'Program a four-on-the-floor beat with kick, clap and hi-hats, and play it in time.',
  source: 'Synth Studio · Producer path (curriculum L1) · Rytm MKII manual, GRID RECORDING (p.39)',
  estimatedMinutes: 10,
  concepts: ['timing-tempo', 'sequencer-pattern'],
  tags: ['beat', 'four on the floor', 'Analog Rytm'],
  start: { studio: elektronStudio(CP_00) },
  steps: [
    {
      kind: 'info', concept: 'timing-tempo', instance: RYTM,
      instruction: 'This path ends with a finished track of your own. It starts with the pulse: press ▶ Hear it for four kicks, one on every beat.',
      principle: 'A steady kick on every beat gives listeners a pulse to move to.',
      explanation: 'Your studio for the path: the Analog Rytm (drums) plays into channel 1 of the Xone:96 mixer, and the Analog Four waits on channel 2 for the bass and chords. Both follow the studio clock at 124 BPM.',
    },
    {
      kind: 'do', concept: 'timing-tempo', instance: RYTM, focus: ['seq:trig:1', 'seq:trig:5', 'seq:trig:9', 'seq:trig:13', 'key:play'],
      instruction: 'BD (the kick) is selected and GRID RECORDING is on. Tap trig keys 1, 5, 9 and 13, then press ▶.',
      check: s => hasTrigs(s, RYTM, BD, BEATS) && playing(s),
      solution: { sequence: [{ track: BD, trigs: on(BEATS) }], transport: 'play' },
      hints: ['Look at the numbers printed under the trig keys.', 'Tap keys 1, 5, 9 and 13 once each: they light up.', 'Then press ▶ in the top bar, or Space.'],
      principle: 'Four evenly spaced kicks per bar, called four on the floor, drive house and techno.',
      explanation: 'A bar is four beats. The Rytm splits each beat into four steps (16th notes), so a bar has 16 steps and the beats fall on steps 1, 5, 9 and 13. A lit trig key holds a trig: a note to play on that step.',
      manualReference: 'Rytm MKII manual p.39: GRID RECORDING',
    },
    {
      kind: 'predict', concept: 'sequencer-pattern', instance: RYTM, focus: ['pad:cp', 'seq:trig:5', 'seq:trig:13'],
      instruction: 'Tap the CP pad to select the clap, then tap trig keys 5 and 13.',
      check: s => hasTrigs(s, RYTM, CP, [5, 13]),
      solution: { values: { track: CP }, sequence: [{ track: CP, trigs: on([5, 13]) }] },
      predict: mc('The clap goes on steps 5 and 13. Where in the bar will you hear it?',
        ['On beats 2 and 4: the backbeat', 'On beats 1 and 3, with the kick', 'Between the beats'], 0,
        'Step 5 is beat 2 and step 13 is beat 4, where a crowd claps along. Beats 1 and 3 are steps 1 and 9; "between the beats" would be steps such as 3 or 7.'),
      principle: 'A snare or clap on beats 2 and 4, the backbeat, answers the kick.',
      explanation: 'AUTO TRK SWITCH is on in this studio, so tapping a pad also selects its track. With it off, the hardware\'s default, hold [TRK] and tap the pad.',
    },
    {
      kind: 'do', concept: 'timing-tempo', instance: RYTM, focus: ['pad:ch', 'seq:trig:3', 'seq:trig:7', 'seq:trig:11', 'seq:trig:15'],
      instruction: 'Tap the CH pad (the closed hi-hat), then trig keys 3, 7, 11 and 15.',
      check: s => hasTrigs(s, RYTM, CH, [3, 7, 11, 15]),
      solution: { values: { track: CH }, sequence: [{ track: CH, trigs: on([3, 7, 11, 15]) }] },
      principle: 'Off-beat hats fill the gaps between kicks and push the groove forward.',
      explanation: 'Steps 3, 7, 11 and 15 are the off-beats, halfway between the beats: the "and" when you count "one and two and". Kick, hat, kick, hat is the bounce of house music.',
    },
    {
      kind: 'listen', concept: 'timing-tempo', instance: RYTM,
      instruction: 'Compare the beat with and without the off-beat hats.',
      listen: {
        a: { ch_amp_vol: 80 }, b: { ch_amp_vol: 0 }, labels: ['With hats', 'Without'],
        question: mc('What do the off-beat hats add?', ['A faster tempo', 'Movement between the kicks', 'More bass'], 1,
          'The tempo is the same in both. The hats are high and short, so they add motion in the gaps, not weight: the weight comes from the kick.'),
      },
    },
    {
      kind: 'quiz', concept: 'timing-tempo', instruction: 'Quick check.',
      quiz: mc('At 124 BPM with four on the floor, how many kicks play in one minute?', ['31', '496', '124'], 2,
        'BPM counts beats per minute and there is one kick per beat. 31 is the number of bars (124 ÷ 4); 496 would be every 16th step.'),
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', instance: RYTM, focus: ['pads', 'seq:trigs'],
      instruction: 'Make the beat your own: add a hit that answers the clap, without moving the kick or the clap.',
      checklist: [
        { text: 'The kick is still on every beat (1, 5, 9, 13)', check: s => hasTrigs(s, RYTM, BD, BEATS) },
        { text: 'The clap is still on 5 and 13', check: s => hasTrigs(s, RYTM, CP, [5, 13]) },
        {
          text: 'A new hit off the beats: the rim (RS), low tom (LT), open hat (OH) or another closed hat',
          check: s => [RS, LT, OH].some(t => trigs(s, RYTM, t).some(n => !BEATS.includes(n))) || trigs(s, RYTM, CH).some(n => ![3, 7, 11, 15].includes(n)),
        },
      ],
      hints: ['Try a step just before a beat.', 'Steps 4, 8, 12 and 16 sit right before a beat.', 'Tap the RS pad, then trig key 12.'],
      solution: { values: { track: RS }, sequence: [{ track: RS, trigs: on([12]) }] },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence: why does the kick go on steps 1, 5, 9 and 13?',
        model: 'Those steps are the four beats of the bar, so the kick marks the pulse everyone feels.',
      },
      explanation: 'Go further: add a soft kick on step 16 (hold it, VEL about 50) and hear how one extra note pulls the bar line forward.',
    },
  ],
  review: [
    mc('Four on the floor means…', ['A kick on every beat', 'Four drums at once', 'Four kicks anywhere in the pattern'], 0, 'One kick per beat, four beats per bar.'),
    mc('In a 16-step bar, beat 3 is step…', ['3', '9', '12'], 1, 'The beats are steps 1, 5, 9 and 13.'),
    mc('The backbeat is…', ['Beats 2 and 4 (steps 5 and 13)', 'Beats 1 and 3', 'The last step'], 0, 'The clap or snare answers the kick on 2 and 4.'),
    mc('Off-beat hats sit…', ['On the beats', 'Halfway between the beats', 'Only at the end of the bar'], 1, 'Steps 3, 7, 11 and 15 are the "ands".'),
    mc('124 BPM means…', ['124 bars per minute', '124 steps per minute', '124 beats per minute'], 2, 'BPM is beats per minute.'),
  ],
};

// ============================================================================
// L2 · Groove
// ============================================================================

const groove: Lesson = {
  id: 'studio-producer-02-groove',
  device: 'studio',
  path: 'producer',
  order: 2,
  difficulty: 'beginner',
  name: 'Groove',
  description: 'Turn a stiff beat into a groove: 16th hats with ghost notes, swing, and a clap that sits a little behind the beat.',
  objective: 'Turn a stiff beat into a groove with 16th hats, ghost notes, swing and micro timing.',
  source: 'Synth Studio · Producer path (curriculum L2) · Rytm MKII manual, TRIG page and SWING (pp.39, 43, 50)',
  estimatedMinutes: 14,
  prerequisites: ['studio-producer-01-first-beat'],
  concepts: ['timing-tempo', 'velocity-dynamics', 'sequencer-pattern'],
  tags: ['groove', 'swing', 'ghost notes', 'Analog Rytm'],
  start: { studio: elektronStudio({ ...CP_01, ownStudio: 'your beat from First beat: a studio with an Analog Rytm' }) },
  steps: [
    {
      kind: 'info', concept: 'timing-tempo', instance: RYTM,
      instruction: 'Same drums, different feel: groove lives in the small notes between the beats, in how loud they are and exactly when they land.',
      principle: 'Groove is timing and loudness, not more notes.',
      explanation: 'Your beat from the last lesson is loaded. In this lesson you add 16th-note hats, make some of them quiet (ghost notes), swing the pattern and nudge the clap.',
    },
    {
      kind: 'quiz', concept: 'timing-tempo', instruction: 'Warm-up.',
      quiz: mc('In a 16-step bar, which steps are the beats?', ['1, 2, 3 and 4', '1, 5, 9 and 13', '4, 8, 12 and 16'], 1,
        'One beat every four steps. Steps 4, 8, 12 and 16 sit just before each beat.'),
    },
    {
      kind: 'do', concept: 'sequencer-pattern', instance: RYTM, focus: ['seq:trig:2', 'seq:trig:4', 'seq:trig:6', 'seq:trig:8', 'seq:trig:10', 'seq:trig:12', 'seq:trig:14', 'seq:trig:16'],
      instruction: 'The CH track is selected. Add trigs on 2, 4, 6, 8, 10, 12, 14 and 16.',
      check: s => hasTrigs(s, RYTM, CH, [2, 4, 6, 8, 10, 12, 14, 16]),
      solution: { values: { track: CH }, sequence: [{ track: CH, trigs: on([2, 4, 6, 8, 10, 12, 14, 16]) }] },
      principle: 'Sixteenth-note hats make the grid audible, so small timing changes become easy to feel.',
      explanation: 'Now the hat plays on every step, 16 per bar. All of them are equally loud, which sounds like a machine.',
    },
    {
      kind: 'do', concept: 'velocity-dynamics', instance: RYTM, focus: ['seq:trig:2', 'seq:trig:6', 'seq:trig:10', 'seq:trig:14', 'ch_trig_vel'],
      instruction: 'Hold CH trig 2 and turn VEL (TRIG page, encoder B) down to about 45. Repeat on 6, 10 and 14.',
      check: s => [2, 6, 10, 14].every(n => (velOf(s, RYTM, CH, n) ?? 127) <= 70),
      solution: { sequence: [{ track: CH, trigs: on([2, 6, 10, 14], { vel: 45 }) }] },
      hints: ['Hold the trig key down while you turn: the screen shows that trig.', 'VEL is encoder B on the TRIG page.', 'About a third of the way: 45.'],
      principle: 'Quiet in-between notes, ghost notes, add motion without clutter.',
      explanation: 'Velocity is how hard a note is played, 1 to 127. Drummers hit the beat hard and the notes between softly; the ear hears the loud ones as the rhythm and the soft ones as feel.',
      manualReference: 'Rytm MKII manual p.43: TRIG page',
    },
    {
      kind: 'predict', concept: 'timing-tempo', instance: RYTM, focus: ['key:func', 'key:bank:G', 'key:up'],
      instruction: 'Set the pattern\'s SWING to 58 %: [FUNC] + [BANK G], then [UP] until it reads 58. [FUNC] + [BANK G] again closes the menu.',
      check: s => between(pswing(s, RYTM), 55, 62),
      solution: { patterns: { [RYTM]: { swing: 58 } } },
      hints: ['SWING belongs to the pattern, not to a knob.', 'Tap [FUNC], then [BANK G]: the SWING menu opens. While it is open the trig keys pick the swing steps.', '[UP] raises it one percent at a time.'],
      predict: mc('Swing delays every second 16th. What will you hear?', ['The hats get louder', 'A bouncier, shuffled feel at the same tempo', 'A faster tempo'], 1,
        'Only the timing of steps 2, 4, 6… moves later, so the groove lopes while the beats stay put. Loudness is velocity, not swing.'),
      principle: 'Delaying every second 16th turns straight time into a shuffle.',
      explanation: 'SWING runs from 50 % (straight) to 80 %. At 58 % every even step plays 16 % of a step late: about 19 ms at 124 BPM. The SWING in the top bar is the studio\'s: it would swing every synced instrument on top of this, so leave it at 50 %.',
      manualReference: 'Rytm MKII manual p.50: SWING',
    },
    {
      kind: 'listen', concept: 'timing-tempo', instance: RYTM,
      instruction: 'Compare two swing settings on your groove.',
      listen: {
        a: {}, b: {}, labels: ['A', 'B'],
        patterns: { a: { [RYTM]: { swing: 50 } }, b: { [RYTM]: { swing: 66 } } },
        question: mc('Which one sounds like triplets, a heavy shuffle?', ['A', 'B', 'Neither'], 1,
          'At about 66 % the late 16th lands two-thirds of the way through each 8th note, the triplet position. A is 50 %: straight.'),
      },
    },
    {
      kind: 'do', concept: 'timing-tempo', instance: RYTM, focus: ['pad:cp', 'seq:trig:13', 'key:right'],
      instruction: 'Tap the CP pad. Hold trig 13 and press [RIGHT] three times: the clap moves a little late.',
      check: s => between(trig(s, RYTM, CP, 13)?.micro ?? 0, 1, 6),
      solution: { values: { track: CP }, sequence: [{ track: CP, trigs: { 13: { micro: 3 } } }] },
      principle: 'A note played slightly late relaxes the groove; slightly early pushes it.',
      explanation: 'Micro timing moves one trig off the grid in steps of 1/384 of a whole note, about 5 ms each at 124 BPM: +3 is about 15 ms late.',
      manualReference: 'Rytm MKII manual p.39: micro timing',
    },
    {
      kind: 'quiz', concept: 'timing-tempo', instruction: 'Quick check.',
      quiz: mc('What is the difference between swing and micro timing?',
        ['Swing changes velocity; micro timing changes pitch', 'Swing moves every second 16th by the same amount; micro timing moves one chosen trig', 'They are the same control'], 1,
        'Swing is a pattern-wide timing rule; micro timing is a per-trig nudge. Neither changes pitch or velocity.'),
    },
    {
      kind: 'match', concept: 'timing-tempo', instance: RYTM, focus: ['key:func', 'key:bank:G'],
      instruction: 'Recreate the target groove by ear with the SWING menu ([FUNC] + [BANK G], then [UP] and [DOWN]). Close it again when you are done.',
      match: { target: {}, controls: [], pattern: { target: { swing: 64 }, start: { swing: 50 } }, tolerance: 0.1 },
      hints: ['Is the target straighter or more shuffled than yours?', 'It is quite shuffled.', 'Try the low 60s.'],
    },
    {
      kind: 'challenge', concept: 'velocity-dynamics', instance: RYTM, focus: ['seq:trigs'],
      instruction: 'Humanize the hats: three levels of loudness, the off-beats loudest, and a house swing between 52 and 62 %.',
      checklist: [
        { text: 'Eight or more hat trigs', check: s => trigs(s, RYTM, CH).length >= 8 },
        { text: 'Three or more different hat velocities', check: s => new Set(trigs(s, RYTM, CH).map(n => velOf(s, RYTM, CH, n))).size >= 3 },
        {
          text: 'The off-beat hats (3, 7, 11, 15) are the loudest',
          check: s => {
            const off = trigs(s, RYTM, CH).filter(n => [3, 7, 11, 15].includes(n)).map(n => velOf(s, RYTM, CH, n) ?? 0);
            const rest = trigs(s, RYTM, CH).filter(n => ![3, 7, 11, 15].includes(n)).map(n => velOf(s, RYTM, CH, n) ?? 0);
            return off.length >= 2 && rest.length > 0 && Math.min(...off) > Math.max(...rest);
          },
        },
        { text: 'SWING between 52 and 62 %', check: s => between(pswing(s, RYTM), 52, 62) },
        { text: 'The kick is still on every beat', check: s => hasTrigs(s, RYTM, BD, BEATS) },
      ],
      hints: ['Loud on the off-beats, soft in between. The SWING menu must be closed so the trig keys hold trigs: [FUNC] + [BANK G].', 'Set 3, 7, 11 and 15 to about 96, 4, 8, 12 and 16 to about 60, and keep the ghosts at 45.', 'House usually swings 54-58 %.'],
      solution: { sequence: [{ track: CH, trigs: HATS_GROOVE }], patterns: { [RYTM]: { swing: SWING } } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence: what does swing change, and what does it leave alone?',
        model: 'Swing delays every second 16th to make a shuffle; it leaves the tempo and the beats where they are.',
      },
      explanation: 'Go further: swing only moves steps marked as swing trigs. In the SWING menu, take the mark off one step and hear that 16th go straight against the others.',
    },
  ],
  review: [
    mc('SWING 50 % means…', ['Straight timing', 'Maximum shuffle', 'Half tempo'], 0, 'Both 16ths of each pair are equal.'),
    mc('A ghost note is…', ['A muted track', 'A quiet in-between hit', 'A note with no sound'], 1, 'It is played softly, not silent.'),
    mc('Micro timing on one trig moves…', ['Every second step', 'Only that trig, a little early or late', 'The whole pattern'], 1, 'It is a per-trig offset.'),
    mc('Swing near 66 % sounds like…', ['Straight 16ths', 'Triplets, a heavy shuffle', 'Double tempo'], 1, 'The late 16th reaches the triplet position.'),
    mc('To make a clap feel laid back, nudge it…', ['Early', 'Late', 'Louder'], 1, 'Late notes relax a groove; early notes push it.'),
  ],
};

// ============================================================================
// L3 · Bass locked to the kick
// ============================================================================

/** The bassline challenge: notes, kick steps, key and lengths */
const bassNotes = (s: S) => trigs(s, A4, T1).map(n => noteOf(s, A4, T1, n) ?? -1);

const bassKick: Lesson = {
  id: 'studio-producer-03-bass-kick',
  device: 'studio',
  path: 'producer',
  order: 3,
  difficulty: 'beginner',
  name: 'Bass locked to the kick',
  description: 'Write a bassline on the Analog Four that locks to the Rytm\'s kick: notes in the gaps, short enough to clear the next kick, in the same key.',
  objective: 'Write a bassline that locks to the kick: notes in the gaps, short enough to clear the next kick, in the same key.',
  source: 'Synth Studio · Producer path (curriculum L3) · A4 MKII manual, NOTE menu (p.45)',
  estimatedMinutes: 15,
  prerequisites: ['studio-producer-02-groove'],
  concepts: ['sequencer-pattern', 'envelope-decay', 'oscillator-pitch'],
  tags: ['bass', 'kick', 'key', 'Analog Four'],
  start: { studio: elektronStudio({ ...CP_02, ownStudio: 'your groove: a studio with the Analog Rytm and the Analog Four' }) },
  steps: [
    {
      kind: 'info', concept: 'sequencer-pattern', instance: A4,
      instruction: 'Kick and bass take turns: boom, dum, boom, dum. That is the engine of a dance track. Press ▶ Hear it for the bass sound.',
      principle: 'In dance music the kick and the bass share the low end by taking turns.',
      explanation: 'The Analog Four is a four-voice analog synth with the same kind of sequencer as the Rytm. Its track 1 holds a deep bass: a saw wave with a sub-oscillator an octave below, through a low-pass filter. It plays into the Xone\'s channel 2.',
    },
    {
      kind: 'quiz', concept: 'timing-tempo', instruction: 'Warm-up.',
      quiz: mc('Swing moves…', ['The tempo up', 'Every second 16th a little later', 'The hats\' velocity'], 1, 'Swing is timing only: the even steps move late, the beats and the tempo stay.'),
    },
    {
      kind: 'do', concept: 'sequencer-pattern', instance: A4, focus: ['seq:trig:3', 'seq:trig:7', 'seq:trig:11', 'seq:trig:15'],
      instruction: 'On the Analog Four, TRACK 1 is selected. Tap trigs 3, 7, 11 and 15, then press ▶.',
      check: s => hasTrigs(s, A4, T1, [3, 7, 11, 15]) && playing(s),
      solution: { sequence: [{ track: T1, trigs: on([3, 7, 11, 15]) }], transport: 'play' },
      hints: ['The A4\'s trig keys are along its bottom edge.', 'Tap 3, 7, 11 and 15: the off-beats.', 'Then ▶ in the top bar.'],
      principle: 'A bass on the off-beats answers the kick instead of fighting it.',
      explanation: 'The kick owns the beat and the bass speaks in between. A bassline is the low melody that holds the harmony and the groove together. Each trig plays the NOTE page\'s note, A2. The A4\'s pattern swings 56 %, like the Rytm\'s, so the bass and the hats lean the same way.',
    },
    {
      kind: 'predict', concept: 'sequencer-pattern', instance: A4, focus: ['seq:trig:1'],
      instruction: 'Now add a bass trig on step 1, with the kick.',
      check: s => trigs(s, A4, T1).includes(1),
      solution: { sequence: [{ track: T1, trigs: { 1: {} } }] },
      predict: mc('Bass and kick both hit on step 1. What happens to the low end?',
        ['It just gets punchier, with no downside', 'Nothing: they are different instruments', 'The two low sounds blur and fight for the same space'], 2,
        'Both put most of their energy below about 100 Hz. On the same step they add up to a louder, muddier thump that can clip. Being different instruments doesn\'t help: frequency and time are what separate sounds.'),
      principle: 'Two low sounds at the same moment mask each other.',
    },
    {
      kind: 'do', concept: 'sequencer-pattern', instance: A4, focus: ['seq:trig:1'],
      instruction: 'Remove the trig on step 1 again, and listen to the kick come back into focus.',
      check: s => !trigs(s, A4, T1).includes(1) && hasTrigs(s, A4, T1, [3, 7, 11, 15]),
      solution: { sequence: [{ track: T1, trigs: { 1: null } }] },
      principle: 'Separate kick and bass in time and each one stays clear.',
    },
    {
      kind: 'do', concept: 'envelope-decay', instance: A4, focus: ['seq:trig:3', 'seq:trig:7', 'seq:trig:11', 'seq:trig:15'],
      instruction: 'Each bass note lasts 3 steps and runs into the next kick. Hold trig 3 and turn LEN (knob C) to 1/16. Do the same on 7, 11 and 15.',
      check: s => trigs(s, A4, T1).length >= 4 && trigs(s, A4, T1).every(n => (lenOf(s, A4, T1, n) ?? 99) <= 1.75),
      solution: { sequence: [{ track: T1, trigs: on([3, 7, 11, 15], { len: LEN.one }) }] },
      hints: ['LEN is knob C on the NOTE page.', 'Hold the trig key while you turn: the screen shows that trig\'s LEN.', '1/16 is one step.'],
      principle: 'Short bass notes leave silence for the kick, so both stay punchy.',
      explanation: 'LEN (note length) is how long the note is held. On the Analog Four every trig keeps the LEN it was placed with, so you change placed trigs one by one. Set the NOTE page\'s LEN first and new trigs take it.',
      manualReference: 'A4 MKII manual p.45: NOTE menu',
    },
    {
      kind: 'do', concept: 'oscillator-pitch', instance: RYTM, focus: ['pad:bd', 'key:src', 'bd_tun'], scope: 'spectrum',
      instruction: 'On the Rytm, tap the BD pad and press [SRC]. Turn TUN until the kick and the bass sound like the same note.',
      check: s => Math.round(num(s, RYTM, 'bd_tun')) === 0,
      solution: { values: { track: BD, page: 1, bd_tun: 0 } },
      hints: ['Listen to the kick\'s body against the bass: two low notes beating against each other.', 'Watch the spectrum: the kick\'s peak should sit on the bass\'s lowest peak, near 55 Hz.', 'TUN 0 puts this kick on A1, 55 Hz: an octave under the bass\'s A2.'],
      principle: 'When kick and bass share a key, the low end sounds like one instrument.',
      explanation: 'The kick is a tuned drum: BD HARD is a sine with a fast pitch sweep, and TUN moves its body in semitones. Tuned to the song\'s key it blends with the bass; a few semitones off, the two wobble against each other.',
    },
    {
      kind: 'do', concept: 'oscillator-pitch', instance: A4, focus: ['seq:trig:11', 'seq:trig:15'],
      instruction: 'Back on the Analog Four: hold trig 11 and set its NOTE to C3; hold trig 15 and set it to G2.',
      check: s => pc(noteOf(s, A4, T1, 11) ?? -1) === 0 && pc(noteOf(s, A4, T1, 15) ?? -1) === 7,
      solution: { sequence: [{ track: T1, trigs: { 11: { note: nn('C3') }, 15: { note: nn('G2') } } }] },
      hints: ['Hold the trig and turn NOTE (knob A), or play a key on the A4\'s keyboard.', 'C3 is three semitones above A2; G2 two below.'],
      principle: 'Roots on strong off-beats and passing notes on weaker ones keep a bassline solid but moving.',
      explanation: 'The root is the note the key is named after, here A. C and G belong to A minor, so they add movement without leaving the key.',
    },
    {
      kind: 'quiz', concept: 'envelope-decay', instruction: 'Quick check.',
      quiz: mc('Why end bass notes before the next kick?', ['To save CPU', 'Because the sequencer requires it', 'So the kick\'s attack isn\'t blurred by a ringing bass'], 2,
        'Overlap smears the kick\'s click and thump; the sequencer and the CPU don\'t care.'),
    },
    {
      kind: 'match', concept: 'envelope-decay', instance: A4, focus: ['key:AMP', 't1_amp_dec'],
      instruction: 'Press [AMP] and match the bass note\'s length by ear with DEC (knob B).',
      setup: { t1_amp_dec: 84 },
      match: { target: { t1_amp_sus: 0, t1_amp_dec: 60 }, controls: ['t1_amp_dec'] },
      hints: ['Is the target shorter or longer than yours?', 'Shorter: it stops well before the next kick.', 'Below the middle of the knob.'],
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', instance: A4, focus: ['seq:trigs'],
      instruction: 'Write your own one-bar bassline that locks to the kick.',
      checklist: [
        { text: 'At least four notes', check: s => trigs(s, A4, T1).length >= 4 },
        {
          text: 'None on the kick steps 1, 5, 9 and 13 (one is fine if it lasts a step or less)',
          check: s => { const k = trigs(s, A4, T1).filter(n => BEATS.includes(n)); return k.length === 0 || (k.length === 1 && (lenOf(s, A4, T1, k[0]) ?? 99) <= 1); },
        },
        { text: 'At least two different notes', check: s => new Set(bassNotes(s)).size >= 2 },
        { text: 'Every note in A minor (A B C D E F G)', check: s => bassNotes(s).length > 0 && bassNotes(s).every(n => A_MINOR.includes(pc(n))) },
        { text: 'Every note two steps long or shorter', check: s => trigs(s, A4, T1).length > 0 && trigs(s, A4, T1).every(n => (lenOf(s, A4, T1, n) ?? 99) <= 2) },
      ],
      hints: ['Start from the off-beats.', 'Use A for most notes and add C, D, E or G.', 'Try a quiet octave jump, A3, on step 8.'],
      solution: { sequence: [{ track: T1, clear: true, trigs: BASS_BAR }] },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Explain how you made the kick and the bass work together.',
        model: 'I put the bass in the gaps between kicks, kept its notes short so each kick is clean, and tuned the kick to the bass\'s key so the low end sounds like one instrument.',
      },
      explanation: 'Go further: load the Bass & drums set and write the same idea on the Sub 37\'s step sequencer. TIE two different notes to hear a legato glide.',
    },
  ],
  review: [
    mc('Bass notes on the off-beats…', ['Double the kick', 'Answer the kick instead of clashing', 'Slow the groove'], 1, 'They fill the gaps the kick leaves.'),
    mc('Two low sounds on the same step tend to…', ['Blur and fight for space', 'Cancel out completely', 'Get brighter'], 0, 'Both crowd the same frequencies at the same moment.'),
    mc('A trig\'s LEN sets…', ['Its loudness', 'How long the note is held', 'Its pitch'], 1, 'LEN is the gate time.'),
    mc('Tuning the kick to the song\'s key helps because…', ['It makes the kick louder', 'Kick and bass blend into one low end', 'It changes the tempo'], 1, 'Matched pitches stop them beating against each other.'),
    mc('Which note is NOT in A minor?', ['C', 'G', 'C#'], 2, 'A minor is A B C D E F G.'),
  ],
};

// ============================================================================
// L5 · Chords and pads
// ============================================================================

/** The chord trigs of T2 and T3 agree: same trig numbers and notes */
const chordsAgree = (s: S) => {
  const a = trigs(s, A4, T2), b = trigs(s, A4, T3);
  return a.length > 0 && a.join() === b.join() && a.every(n => noteOf(s, A4, T2, n) === noteOf(s, A4, T3, n));
};
/** The chord root (pitch class) of each bar: the first chord trig's note */
const barRoot = (s: S, bar: number) => { const n = barNotes(s, A4, T2, bar); return n.length ? pc(n[0]) : -1; };
const envOn = (s: S, atk: [number, number], rel: [number, number]) =>
  [T2, T3].every(t => between(a4(s, t, 'amp_atk'), atk[0], atk[1]) && between(a4(s, t, 'amp_rel'), rel[0], rel[1]));

const chords: Lesson = {
  id: 'studio-producer-05-chords',
  device: 'studio',
  path: 'producer',
  order: 5,
  difficulty: 'intermediate',
  name: 'Chords and pads',
  description: 'Build minor-seventh chords from two Analog Four tracks, write a four-bar progression with the bass on its roots, and shape the chord as a short stab or a slow pad.',
  objective: 'Build minor-seventh chords from two A4 tracks, program a four-bar progression, and shape the same chord as a short stab or a slow pad.',
  source: 'Synth Studio · Producer path (curriculum L5) · A4 MKII manual, SCALE menu (p.49)',
  estimatedMinutes: 18,
  prerequisites: ['studio-producer-03-bass-kick'],
  concepts: ['oscillator-pitch', 'envelope-attack', 'envelope-release'],
  tags: ['chords', 'progression', 'pad', 'Analog Four'],
  start: { studio: elektronStudio({ ...CP_03, ownStudio: 'your track with a bassline on the Analog Four' }) },
  steps: [
    {
      kind: 'info', concept: 'oscillator-pitch', instance: A4,
      instruction: 'Drums and bass make a groove. Chords give it a mood: the same groove can feel hopeful, dark or dreamy.',
      principle: 'Harmony is notes sounding together; chords set the emotional colour of a track.',
      explanation: 'Your groove and bassline are loaded. Tracks 2 and 3 of the Analog Four are set up for chords: two saw oscillators each, a little filter envelope, into the A4\'s chorus, delay and reverb.',
    },
    {
      kind: 'quiz', concept: 'timing-tempo', instruction: 'Warm-up.',
      quiz: mc('What keeps several instruments in time?', ['The same volume', 'One shared clock', 'The same key'], 1, 'Separate clocks drift; volume and key don\'t affect timing.'),
    },
    {
      kind: 'do', concept: 'oscillator-pitch', instance: A4, focus: ['key:T2', 'seq:trig:3'],
      instruction: 'Press [T2] on the Analog Four. Tap trig 3: it plays A3 and E4 together.',
      check: s => trigs(s, A4, T2).includes(3) && pc(noteOf(s, A4, T2, 3) ?? -1) === 9,
      solution: { values: { track: T2 }, sequence: [{ track: T2, trigs: { 3: {} } }] },
      principle: 'Two oscillators tuned seven semitones apart play a strong, open two-note chord.',
      explanation: 'TRACK 2\'s OSC 2 is tuned +7 semitones, a fifth, so one trig plays A and E together. A semitone is the smallest step on a keyboard, one key to the next.',
    },
    {
      kind: 'predict', concept: 'oscillator-pitch', instance: A4, focus: ['key:T3', 'seq:trig:3'],
      instruction: 'Press [T3] and tap trig 3 as well.',
      check: s => trigs(s, A4, T3).includes(3) && pc(noteOf(s, A4, T3, 3) ?? -1) === 9,
      solution: { values: { track: T3 }, sequence: [{ track: T3, trigs: { 3: {} } }] },
      predict: mc('Track 2 plays A and E. Track 3 is tuned +3 and +10, so it adds C and G. What chord is A–C–E–G?',
        ['A major', 'A minor seventh', 'A random cluster'], 1,
        'Root A, minor third C (+3), fifth E (+7) and minor seventh G (+10) make Am7, the warm chord of deep house and techno. A major would need C#, four semitones up.'),
      principle: 'Stacking thirds builds chords: root, third, fifth, seventh.',
    },
    {
      kind: 'info', concept: 'oscillator-pitch', instance: A4,
      instruction: 'Listen to your chord (▶ Hear it) while you read how it is built.',
      principle: 'Fixed intervals move as a block, so one note per track changes the whole chord.',
      explanation: 'A chord is notes played together. Three notes stacked in thirds make a triad; add a fourth and you get a seventh chord. Because both tracks keep their tuning, any NOTE you give them plays a minor-seventh chord on that note, like the chord-memory buttons on classic house synths.',
    },
    {
      kind: 'do', concept: 'sequencer-pattern', instance: A4, focus: ['key:FUNC', 'key:PAGE'],
      instruction: 'Make the pattern four bars long: [FUNC] + [PAGE] opens SCALE; set LENGTH to 64. The first bar is copied into the new pages.',
      check: s => plen(s, A4) === 64,
      solution: { patterns: { [A4]: { length: 64 } } },
      principle: 'Four bars is room for a chord progression, the usual length of a dance-music phrase.',
      explanation: 'Extending a pattern copies the existing pages into the new ones, so your bass and chord trigs now play in all four bars (A4 MKII manual p.49).',
    },
    {
      kind: 'do', concept: 'oscillator-pitch', instance: A4, focus: ['key:PAGE', 'seq:trig:3'],
      instruction: 'On page 3, hold trig 3 on T2 and set its NOTE to D3, then the same on T3. On page 4 set both to E3.',
      check: s => [T2, T3].every(t => barNotes(s, A4, t, 3).some(n => pc(n) === 2) && barNotes(s, A4, t, 4).some(n => pc(n) === 4)
        && [1, 2].every(b => barNotes(s, A4, t, b).every(n => pc(n) === 9))),
      solution: { sequence: [T2, T3].map(t => ({ track: t, trigs: { 35: { note: nn('D3') }, 51: { note: nn('E3') } } })) },
      hints: ['[PAGE] steps through the four pages: the LEDs show which one you see.', 'Hold the trig and turn NOTE (knob A).', 'D3 is five semitones under A3; E3 seven.'],
      principle: 'Moving the chord\'s root through the key makes a progression: home, away and back.',
      explanation: 'Am7 – Am7 – Dm7 – Em7 is a progression, a sequence of chords. Am7 is home in A minor; Dm7 and Em7 move away and pull back.',
    },
    {
      kind: 'quiz', concept: 'oscillator-pitch', instruction: 'Quick check.',
      quiz: mc('In A minor, which chord sounds most at rest?', ['Dm7', 'Em7', 'Am7'], 2,
        'The chord on the key\'s first note, the tonic, is home. Em7 leans back toward it, which is why it sounds unfinished at the end of the loop.'),
    },
    {
      kind: 'do', concept: 'oscillator-pitch', instance: A4, focus: ['key:T1'],
      instruction: 'Make the bass follow: on T1, set the first note of page 3 (trig 3) to D3 and the first note of page 4 to E3.',
      check: s => barNotes(s, A4, T1, 3).some(n => pc(n) === 2) && barNotes(s, A4, T1, 4).some(n => pc(n) === 4),
      solution: { values: { track: T1 }, sequence: [{ track: T1, trigs: { 35: { note: nn('D3') }, 51: { note: nn('E3') } } }] },
      principle: 'When the bass plays the chord\'s root, the harmony sounds solid and clear.',
      explanation: 'The lowest note decides how a chord is heard. Under Dm7 an A in the bass would turn it into a different, unsettled chord; a D grounds it.',
    },
    {
      kind: 'predict', concept: 'envelope-attack', instance: A4, focus: ['key:AMP', 't2_amp_atk', 't2_amp_rel'],
      instruction: 'On T2 and T3, press [AMP] and set ATK (knob A) to about 64 and REL (knob D) to about 100.',
      check: s => envOn(s, [50, 127], [85, 127]),
      solution: { values: { t2_amp_atk: 64, t2_amp_rel: 100, t3_amp_atk: 64, t3_amp_rel: 100 } },
      predict: mc('What will the slow attack and long release do to the chord?', ['Raise its pitch', 'Turn the short stab into a soft, swelling pad', 'Speed up the pattern'], 1,
        'The attack is how long a note takes to reach full level and the release is how long it fades after the note ends. Slow and long turns a hit into a swell. Pitch and tempo are untouched.'),
      principle: 'The envelope decides whether a sound hits or swells.',
    },
    {
      kind: 'listen', concept: 'envelope-release', instance: A4,
      instruction: 'Compare the stab and the pad in the groove.',
      listen: {
        a: { t2_amp_atk: 0, t2_amp_rel: 40, t3_amp_atk: 0, t3_amp_rel: 40 },
        b: { t2_amp_atk: 64, t2_amp_rel: 100, t3_amp_atk: 64, t3_amp_rel: 100 },
        labels: ['Stab', 'Pad'],
        question: mc('Which leaves more room for the drums in a busy groove?', ['The stab', 'The pad'], 0,
          'Short sounds leave silence between hits for the kick and hats. Pads fill every gap, which is why they suit breakdowns where the drums drop out.'),
      },
    },
    {
      kind: 'do', concept: 'envelope-attack', instance: A4, focus: ['t2_amp_atk', 't2_amp_rel'],
      instruction: 'Put the stab back: ATK 0 and REL about 40 on both tracks.',
      check: s => envOn(s, [0, 10], [0, 55]),
      solution: { values: { t2_amp_atk: 0, t2_amp_rel: 40, t3_amp_atk: 0, t3_amp_rel: 40 } },
      principle: 'A short envelope keeps a chord rhythmic: it becomes part of the groove.',
    },
    {
      kind: 'match', concept: 'envelope-attack', instance: A4, focus: ['key:T2', 'key:AMP', 't2_amp_atk', 't2_amp_rel'],
      instruction: 'Recreate the target chord by ear on T2: AMP ATK and REL.',
      setup: { t2_amp_atk: 0, t2_amp_rel: 40, track: T2 },
      match: { target: { t2_amp_atk: 56, t2_amp_rel: 96 }, controls: ['t2_amp_atk', 't2_amp_rel'] },
      hints: ['How long does it take to arrive, and how long does it hang on?', 'It swells in a little and rings on.', 'Both knobs are well past the middle.'],
    },
    {
      kind: 'challenge', concept: 'oscillator-pitch', instance: A4, focus: ['seq:trigs'],
      instruction: 'Write your own four-bar progression and stab rhythm. Keep the bass on the roots.',
      checklist: [
        { text: 'T2 and T3 have a chord in every bar', check: s => [1, 2, 3, 4].every(b => barNotes(s, A4, T2, b).length > 0 && barNotes(s, A4, T3, b).length > 0) },
        { text: 'On every chord, T2 and T3 play the same NOTE on the same trig', check: chordsAgree },
        { text: 'At least two different roots', check: s => new Set([1, 2, 3, 4].map(b => barRoot(s, b)).filter(x => x >= 0)).size >= 2 },
        { text: 'Every root is A, D or E', check: s => trigs(s, A4, T2).length > 0 && trigs(s, A4, T2).every(n => [9, 2, 4].includes(pc(noteOf(s, A4, T2, n) ?? -1))) },
        { text: 'T1 plays each bar\'s root at least once', check: s => [1, 2, 3, 4].every(b => barRoot(s, b) >= 0 && barNotes(s, A4, T1, b).some(n => pc(n) === barRoot(s, b))) },
      ],
      hints: [
        'Start and end your phrase on A.',
        'Try A, A, D, E, or A, D, A, E. With this two-track trick every chord is minor-seventh, and in A minor only A, D and E carry minor-seventh chords that stay in the key.',
        'Copy each bar\'s root into track 1, on a note that already plays.',
      ],
      solution: {
        sequence: [
          { track: T2, clear: true, trigs: STABS_4 },
          { track: T3, clear: true, trigs: STABS_4 },
          { track: T1, clear: true, trigs: BASS_4 },
        ],
      },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between a stab and a pad, in envelope terms?',
        model: 'A stab has a fast attack and a short release, so it is a quick hit; a pad has a slow attack and a long release, so it swells and sustains.',
      },
      explanation: 'Go further: on real hardware the A4 can also play chords from one track. Enable voices in POLY CONFIG ([FUNC] + [MIX]) and program overlapping notes (A4 MKII manual p.28). The two-track trick keeps four independent tracks.',
    },
  ],
  review: [
    mc('A minor-seventh chord on A is…', ['A C# E G#', 'A C E G', 'A B C D'], 1, 'Root, minor third, fifth, minor seventh.'),
    mc('A minor third is how many semitones?', ['3', '4', '7'], 0, '4 is a major third, 7 a fifth.'),
    mc('A pad differs from a stab mainly by…', ['Higher pitch', 'A slow attack and a long release', 'More distortion'], 1, 'The envelope makes the difference.'),
    mc('In A minor the home chord is…', ['Em7', 'Dm7', 'Am7'], 2, 'The tonic chord.'),
    mc('When the bass plays each chord\'s root…', ['The harmony sounds solid', 'The chord changes key', 'The kick disappears'], 0, 'The lowest note defines how the chord is heard.'),
  ],
};

// ============================================================================
// L6 · A hook
// ============================================================================

const hookNotes = (s: S, bars: number[]) => trigs(s, A4, T4).filter(n => bars.includes(barOf(n))).map(n => noteOf(s, A4, T4, n) ?? -1);

const hook: Lesson = {
  id: 'studio-producer-06-hook',
  device: 'studio',
  path: 'producer',
  order: 6,
  difficulty: 'intermediate',
  name: 'A hook',
  description: 'Write a short, memorable hook from the A minor pentatonic scale on the Analog Four, in a register of its own, then play it live on the Sub 37.',
  objective: 'Write a short, memorable hook from the A minor pentatonic scale that fits your chords, in a register of its own.',
  source: 'Synth Studio · Producer path (curriculum L6) · A4 MKII manual, NOTE menu (p.45)',
  estimatedMinutes: 18,
  prerequisites: ['studio-producer-05-chords'],
  concepts: ['oscillator-pitch', 'sequencer-pattern', 'effects'],
  tags: ['hook', 'melody', 'pentatonic', 'Analog Four', 'Sub 37'],
  start: { studio: elektronStudio({ ...CP_05, ownStudio: 'your track with chords on the Analog Four' }) },
  steps: [
    {
      kind: 'info', concept: 'sequencer-pattern', instance: A4,
      instruction: 'One short line, repeated with a twist. That is a hook: the part people hum on the way home.',
      principle: 'A hook is a short, memorable idea that repeats with a small change.',
      explanation: 'Your four bars of chords and bass are loaded. Track 4 of the Analog Four is a glass-like pluck, a pulse and a triangle an octave up, into the A4\'s delay. The Sub 37 waits on Xone channel 3 for later in the lesson.',
    },
    {
      kind: 'quiz', concept: 'oscillator-pitch', instruction: 'Warm-up.',
      quiz: mc('Which chord is home in A minor?', ['Dm7', 'Am7', 'Em7'], 1, 'The chord on A, the tonic. Dm7 and Em7 move away from it.'),
    },
    {
      kind: 'do', concept: 'sequencer-pattern', instance: A4, focus: ['key:T4', 'seq:trig:3', 'seq:trig:6', 'seq:trig:9', 'seq:trig:12'],
      instruction: 'Press [T4]. Tap trigs 3, 6, 9 and 12: every third step.',
      check: s => hasTrigs(s, A4, T4, [3, 6, 9, 12]),
      solution: { values: { track: T4 }, sequence: [{ track: T4, trigs: on([3, 6, 9, 12]) }] },
      principle: 'A rhythm that repeats every three steps against a four-step beat creates a catchy cross-rhythm.',
      explanation: 'Every trig plays T4\'s NOTE, E5, for now.',
    },
    {
      kind: 'do', concept: 'oscillator-pitch', instance: A4, focus: ['seq:trig:6', 'seq:trig:9', 'seq:trig:12'],
      instruction: 'Hold each trig and set its NOTE: 3 = E5, 6 = D5, 9 = C5, 12 = A4.',
      check: s => [[3, 4], [6, 2], [9, 0], [12, 9]].every(([n, p]) => { const x = noteOf(s, A4, T4, n); return x !== undefined && pc(x) === p && x >= nn('A4'); }),
      solution: { sequence: [{ track: T4, trigs: line([3, 6, 9, 12], ['E5', 'D5', 'C5', 'A4']) }] },
      hints: ['Hold a trig and turn NOTE (knob A), or press a key on the A4\'s keyboard.', 'Trig 3 is already E5.', 'Each note is two semitones under the last, then three: D5, C5, A4.'],
      principle: 'Notes from the current chord sound stable; other scale notes add colour.',
      explanation: 'A scale is the set of notes a key uses. The pentatonic scale is five of them, here A C D E G, with no notes a semitone apart, so it rarely clashes.',
    },
    {
      kind: 'predict', concept: 'oscillator-pitch', instance: A4,
      instruction: 'Press ▶ and listen across all four bars.',
      check: s => playing(s),
      solution: { transport: 'play' },
      predict: mc('The hook doesn\'t change, but the chords do. Why do E, D, C and A fit Am7, Dm7 and Em7?',
        ['Any notes fit any chord', 'They come from A minor pentatonic, which shares notes with all three chords', 'Because the hook is quieter than the chords'], 1,
        'Every pentatonic note is also in A minor, and with no semitone steps none of them grinds against these chords. Not every note fits: an F# or a Bb would clash.'),
      principle: 'A melody built from the key\'s pentatonic scale fits every chord in the key.',
    },
    {
      kind: 'info', concept: 'oscillator-pitch', instance: A4, scope: 'spectrum',
      instruction: 'Watch the spectrum while the bass, the chords and the hook play: each has its own register.',
      principle: 'Separate pitch ranges keep parts from masking each other.',
      explanation: 'A register is a pitch range. The bass lives below about 120 Hz, the chords around 150 to 500 Hz and the hook above 600 Hz, so none of them hides another.',
    },
    {
      kind: 'do', concept: 'sequencer-pattern', instance: A4, focus: ['key:PAGE', 'seq:trig:3', 'seq:trig:6', 'seq:trig:9', 'seq:trig:12'],
      instruction: 'Answer it: on page 2 tap trigs 3, 6, 9 and 12. Set 6 to D5 and 9 to C5, and leave 12 on E5, so the phrase ends rising.',
      check: s => {
        const b1 = barNotes(s, A4, T4, 1), b2 = barNotes(s, A4, T4, 2);
        return b2.length >= 3 && b1.length > 0 && b2.join() !== b1.join() && b2[b2.length - 1] > b1[b1.length - 1];
      },
      solution: { sequence: [{ track: T4, trigs: line([19, 22, 25, 28], ['E5', 'D5', 'C5', 'E5']) }] },
      hints: ['[PAGE] shows page 2: trig 3 there is step 19.', 'Keep the rhythm; change only the end.', 'E5, D5, C5, E5 on 3, 6, 9 and 12 of page 2.'],
      principle: 'Repetition makes a hook memorable; one changed note makes it interesting.',
      explanation: 'Call and response: bar 1 falls, bar 2 answers by rising. Bars 3 and 4 leave the chords room to answer both.',
    },
    {
      kind: 'quiz', concept: 'oscillator-pitch', instruction: 'Quick check.',
      quiz: mc('Your hook clashes with the Em7 chord in bar 4. What do you try first?',
        ['Turn the hook up', 'Move the clashing note to a chord tone: E, G, B or D', 'Add more reverb'], 1,
        'The clash is a pitch problem, so fix the pitch; volume and reverb only make it louder or blurrier.'),
    },
    {
      kind: 'listen', concept: 'effects', instance: A4,
      instruction: 'Hear the hook with and without its delay send.',
      listen: {
        a: { t4_amp_del: 0 }, b: { t4_amp_del: 70 }, labels: ['Dry', 'Delay'],
        question: mc('What does the delay add?', ['Echoes that fill the gaps between notes', 'More bass', 'A faster tempo'], 0,
          'Each echo arrives a dotted 8th later, three 16ths, and lands in the spaces of the three-step rhythm. Delay is covered properly in Space and depth.'),
      },
    },
    {
      kind: 'do', concept: 'oscillator-pitch', instance: SUB, focus: ['keys'],
      instruction: 'Play the call live on the Sub 37\'s keys: E, D, C, A. Any octave counts.',
      play: { notes: [nn('E5'), nn('D5'), nn('C5'), nn('A4')], anyOctave: true },
      solution: { notes: [nn('E5'), nn('D5'), nn('C5'), nn('A4')] },
      principle: 'Playing a part by hand is the fastest way to learn it, and to hear what to change.',
      explanation: 'The Sub 37 on Xone channel 3 is a monophonic analog synth with a bright octave lead. Its keys are shifted up an octave, so the hook\'s notes are under your fingers. Computer keys play it too.',
    },
    {
      kind: 'match', concept: 'filter-cutoff', instance: A4, focus: ['key:T4', 'key:FLTR', 'key:ENV', 't4_flt1_frq', 't4_envf_dec'],
      instruction: 'Recreate the hook\'s tone by ear on T4: FILTER 1 FREQ and ENV F DEC.',
      setup: { t4_flt1_frq: 52, t4_envf_dec: 64, track: T4 },
      match: { target: { t4_flt1_frq: 70, t4_envf_dec: 40 }, controls: ['t4_flt1_frq', 't4_envf_dec'] },
      hints: ['Brighter or darker? A longer or a shorter pluck?', 'Brighter, and a snappier pluck.', 'FREQ is on the FLTR page (knob A), DEC on the ENV page (knob B).'],
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', instance: A4, focus: ['seq:trigs'],
      instruction: 'Write your own two-bar hook on T4.',
      checklist: [
        { text: '4 to 10 notes in bars 1 and 2: short enough to hum', check: s => between(hookNotes(s, [1, 2]).length, 4, 10) },
        { text: 'Every note in A minor pentatonic (A C D E G)', check: s => trigs(s, A4, T4).length > 0 && trigs(s, A4, T4).every(n => A_MINOR_PENTA.includes(pc(noteOf(s, A4, T4, n) ?? -1))) },
        { text: 'Every note A4 or higher, above the chords', check: s => trigs(s, A4, T4).length > 0 && trigs(s, A4, T4).every(n => (noteOf(s, A4, T4, n) ?? 0) >= nn('A4')) },
        {
          text: 'Bar 2 repeats at least two of bar 1\'s rhythm positions',
          check: s => { const b1 = new Set(trigs(s, A4, T4).filter(n => barOf(n) === 1)); return trigs(s, A4, T4).filter(n => barOf(n) === 2 && b1.has(n - 16)).length >= 2; },
        },
        {
          text: 'Room to breathe: a gap of two steps or more',
          check: s => { const t = trigs(s, A4, T4).filter(n => n <= 32); return t.length > 1 && t.some((n, i) => i > 0 && n - t[i - 1] >= 3); },
        },
      ],
      hints: ['Sing a short phrase first, then find it.', 'Use the three-step rhythm and change only the ending.', 'Leave step 1 empty so the kick speaks.'],
      solution: { sequence: [{ track: T4, clear: true, trigs: HOOK_2 }] },
    },
    {
      kind: 'info', concept: 'mixing',
      instruction: 'Want to share your loop already? Press REC in the top bar, play eight bars, press REC again and save the WAV.',
      principle: 'Finishing small pieces early keeps you motivated: a loop you can play to a friend counts.',
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What makes a hook memorable?',
        model: 'A short idea repeated with a small change, in its own register, using notes that fit the chords, with space around it.',
      },
      explanation: 'Go further: add a counter-line on the Sub 37 an octave below the hook, and keep its rhythm in the hook\'s gaps.',
    },
  ],
  review: [
    mc('A minor pentatonic is…', ['A B C D E F G', 'A C D E G', 'A C# E'], 1, 'Five notes of A minor with no semitone steps.'),
    mc('A chord tone on a strong beat sounds…', ['Stable', 'Clashing', 'Quieter'], 0, 'It belongs to the chord underneath.'),
    mc('Why keep a hook above the chords?', ['So the parts don\'t mask each other', 'So it is louder', 'So it stays in key'], 0, 'Separate registers stay clear.'),
    mc('A rhythm repeating every three steps over a four-beat bar creates…', ['A slower tempo', 'A cross-rhythm', 'A chord'], 1, 'Three-step groups shift against the beat.'),
    mc('Most hooks are…', ['30 or more notes', 'One long note', '3-6 notes repeated with a variation'], 2, 'Short ideas are easy to remember.'),
  ],
};

// ============================================================================
// L8 · Movement
// ============================================================================

const MOVEMENT_RYTM_TRACKS = [BD, SD, RS, CP, CH];

const movement: Lesson = {
  id: 'studio-producer-08-movement',
  device: 'studio',
  path: 'producer',
  order: 8,
  difficulty: 'intermediate',
  name: 'Movement',
  description: 'Make your loop evolve without adding parts: parameter locks for one step, trig conditions for some loops, and a slow LFO for everything in between.',
  objective: 'Make a loop evolve without adding parts: parameter locks, trig conditions and a slow LFO.',
  source: 'Synth Studio · Producer path (curriculum L8) · Rytm MKII manual pp.47-49 · A4 MKII manual pp.45, 50',
  estimatedMinutes: 16,
  prerequisites: ['studio-producer-05-chords'],
  concepts: ['parameter-locks', 'lfo', 'sequencer-pattern'],
  tags: ['locks', 'trig conditions', 'LFO', 'Analog Rytm', 'Analog Four'],
  start: { studio: elektronStudio({ ...CP_08, ownStudio: 'your track: the Analog Rytm groove with Analog Four chords' }) },
  steps: [
    {
      kind: 'info', concept: 'sequencer-pattern', instance: A4,
      instruction: 'Eight bars of the same loop get tiring: in yours, every bar is exactly the same. Small changes every few bars keep it alive.',
      principle: 'The ear tires of exact repetition; small changes every few bars hold attention.',
      explanation: 'Three tools, three time scales: a parameter lock changes one step, a trig condition changes some loops, and a slow LFO changes everything a little, all the time. None of them adds a part.',
    },
    {
      kind: 'quiz', concept: 'filter-cutoff', instruction: 'Warm-up.',
      quiz: mc('A high-pass filter removes…', ['The highs', 'The lows below the cutoff', 'The middle'], 1, 'Highs pass through; everything below the cutoff is turned down.'),
    },
    {
      kind: 'do', concept: 'parameter-locks', instance: A4, focus: ['key:FLTR', 'seq:trig:11'],
      instruction: 'On T2, press [FLTR]. Hold trig 11 and turn FREQ (knob A) up by about 20. Do the same on T3.',
      check: s => [T2, T3].every(t => lockedTrigs(s, A4, t, 'flt1_frq').includes(11) && (trig(s, A4, t, 11)?.locks?.flt1_frq ?? 0) >= a4(s, t, 'flt1_frq') + 10),
      solution: { sequence: [T2, T3].map(t => ({ track: t, trigs: { 11: { locks: { flt1_frq: 85 } } } })) },
      hints: ['Hold the trig key while you turn: the screen shows the lock.', 'FREQ is knob A on the FLTR page.', 'From 65 to about 85.'],
      principle: 'A parameter lock changes a sound for one step only, so a loop varies without new notes.',
      explanation: 'Holding a trig while you turn a knob stores the new value on that trig alone. The next trig goes back to the track\'s own setting.',
      manualReference: 'A4 MKII manual p.50: parameter locks',
    },
    {
      kind: 'predict', concept: 'sequencer-pattern', instance: RYTM, focus: ['pad:ch', 'seq:trig:16', 'ch_trig_cond'],
      instruction: 'On the Rytm, tap the CH pad. Hold trig 16 and turn TRC (TRIG page, encoder D) to 1:2.',
      check: s => trig(s, RYTM, CH, 16)?.cond === '1:2',
      solution: { values: { track: CH }, sequence: [{ track: CH, trigs: { 16: { cond: '1:2' } } }] },
      predict: mc('What will trig 16 do now?', ['Play half as loud', 'Play on the first of every two loops', 'Play at half speed'], 1,
        'A:B conditions count loops of the pattern: 1:2 plays on loops 1, 3, 5… Loudness is velocity; speed is the pattern\'s scale.'),
      principle: 'An A:B condition plays a trig on loop A of every B loops.',
      manualReference: 'Rytm MKII manual p.48: trig conditions',
    },
    {
      kind: 'do', concept: 'sequencer-pattern', instance: RYTM, focus: ['pad:sd', 'seq:trig:14', 'seq:trig:15', 'seq:trig:16', 'sd_trig_cond'],
      instruction: 'Add a fill at the end of every four bars: tap the SD pad, add trigs 14, 15 and 16, and set each one\'s TRC to 4:4.',
      check: s => [14, 15, 16].every(n => trig(s, RYTM, SD, n)?.cond === '4:4'),
      solution: { values: { track: SD }, sequence: [{ track: SD, trigs: { 14: { vel: 70, cond: '4:4' }, 15: { vel: 86, cond: '4:4' }, 16: { vel: 104, cond: '4:4' } } }] },
      hints: ['Place the three trigs first, then hold each one.', 'TRC is encoder D while a trig is held.', 'Turn it until the screen reads 4:4.'],
      principle: 'Changes on the fourth or eighth bar mark the end of a phrase, which the ear expects.',
    },
    {
      kind: 'quiz', concept: 'sequencer-pattern', instruction: 'Quick check.',
      quiz: mc('Which condition plays only on the fourth bar of every four?', ['1:4', '4:4', '4:1'], 1,
        'A:B means "loop A of every B". 1:4 is the first bar of each four; 4:1 isn\'t a valid setting.'),
    },
    {
      kind: 'do', concept: 'lfo', instance: A4, focus: ['key:LFO', 't2_lfo1_spd', 't2_lfo1_mul', 't2_lfo1_depa'],
      instruction: 'On T2, press [LFO]: set SPD to 8, MUL to x1 and DEP to about +12 (the destination is already F1 FRQ). Then do the same on T3.',
      check: s => [T2, T3].every(t => a4(s, t, 'lfo1_dsta') === dest('F1 FRQ') && Math.abs(a4(s, t, 'lfo1_depa')) >= 6 && lfoSlow(s, t)),
      solution: { values: { t2_lfo1_spd: 8, t2_lfo1_mul: 0, t2_lfo1_depa: 12, t3_lfo1_spd: 8, t3_lfo1_mul: 0, t3_lfo1_depa: 12 } },
      hints: ['SPD is knob A, MUL knob B, DEP knob H on the LFO page.', 'MUL x1 is the lowest setting.', 'SPD 8 x MUL 1 = one cycle every 16 bars.'],
      principle: 'A slow LFO moves a sound over many bars, so a loop breathes on its own.',
      explanation: 'An LFO (low-frequency oscillator) is a slow wave that turns a knob for you. On the A4, SPD × MUL = 128 is one cycle a bar, so 8 × 1 takes 16 bars.',
    },
    {
      kind: 'listen', concept: 'lfo', instance: A4,
      instruction: 'Hear the LFO, sped up to one cycle every 4 bars so it is easy to notice. Give each side a few bars.',
      listen: {
        a: { t2_lfo1_depa: 0, t3_lfo1_depa: 0 },
        b: { t2_lfo1_depa: 24, t2_lfo1_spd: 32, t2_lfo1_mul: 0, t3_lfo1_depa: 24, t3_lfo1_spd: 32, t3_lfo1_mul: 0 },
        labels: ['Still', 'LFO'],
        question: mc('What is moving in the LFO side?', ['The pitch of the chords', 'The brightness of the chords, slowly up and down', 'The tempo'], 1,
          'The LFO is routed to the filter, so only the tone changes. Pitch would need an oscillator destination.'),
      },
    },
    {
      kind: 'predict', concept: 'sequencer-pattern', instance: RYTM, focus: ['pad:sd', 'seq:trig:13', 'key:rec', 'key:fill'],
      instruction: 'On the Rytm, tap SD, add trig 13 and set its TRC to FILL. Then press [RECORD] to leave GRID RECORDING and hold [FILL] for a bar.',
      check: s => trig(s, RYTM, SD, 13)?.cond === 'FILL',
      solution: { values: { track: SD }, sequence: [{ track: SD, trigs: { 13: { vel: 96, cond: 'FILL' } } }] },
      predict: mc('When does the snare on step 13 play now?', ['Only while FILL is held or latched', 'Every fourth bar', 'Never'], 0,
        'FILL is true only while fill mode is on, so you can perform fills by hand without changing the pattern.'),
      principle: 'Fill trigs wait for your signal, so the variation lands where you choose.',
      manualReference: 'Rytm MKII manual p.49: FILL',
    },
    {
      kind: 'match', concept: 'lfo', instance: A4, focus: ['key:T2', 'key:LFO', 't2_lfo1_depa'],
      instruction: 'Match the filter movement by ear on T2: LFO 1 DEP. It runs one cycle a bar here, so you hear it in a few seconds.',
      setup: { t2_lfo1_depa: 0, track: T2 },
      match: { target: { t2_lfo1_depa: 30, t2_lfo1_spd: 32, t2_lfo1_mul: 2 }, controls: ['t2_lfo1_depa'], tolerance: 0.06 },
      hints: ['More or less movement than yours?', 'More: the chords open and close clearly.', 'Between +20 and +40.'],
    },
    {
      kind: 'challenge', concept: 'parameter-locks', instance: A4,
      instruction: 'Make eight bars that never repeat exactly, with the parts you have: add a lock on the Rytm, a chance trig, and an LFO on one more track.',
      checklist: [
        { text: 'A parameter lock on a Rytm trig (a longer hat, a brighter rim…)', check: s => lockCount(s, RYTM) >= 1 },
        { text: 'A probability condition (%): variation that never repeats exactly', check: s => [...conditions(s, RYTM), ...conditions(s, A4)].some(([, , c]) => /%$/.test(c)) },
        { text: 'An LFO with a depth on T1 or T4 as well', check: s => [T1, T4].some(t => lfoOn(s, t, 1) || lfoOn(s, t, 2)) },
        { text: 'Every LFO on the A4 moves slowly: four bars or more per cycle', check: s => [T1, T2, T3, T4].every(t => !lfoOn(s, t, 1) || lfoSlow(s, t, 1)) },
        {
          text: 'No new parts: only the kick, snare, rim, clap and hats on the Rytm',
          check: s => busyTracks(s, RYTM).every(t => MOVEMENT_RYTM_TRACKS.includes(t)),
        },
      ],
      hints: [
        'One tool for one-step accents, one for every few bars, one for slow change.',
        'Lock a longer DEC on one hat; give a ghost hat a 50 % condition; put a slow LFO on T4\'s filter.',
        'Slow T2\'s LFO back down after the ear test: SPD 8, MUL x1.',
      ],
      solution: {
        values: { t2_lfo1_spd: 8, t2_lfo1_mul: 0, t4_lfo1_spd: 16, t4_lfo1_mul: 0, t4_lfo1_dsta: dest('F1 FRQ'), t4_lfo1_depa: 10 },
        sequence: [{ instance: RYTM, track: CH, trigs: { 8: { locks: { dec: 40 } }, 6: { cond: '50%' } } }],
      },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Name three ways to make a loop change over time on an Elektron, and when to use each.',
        model: 'Parameter locks for one-step accents, trig conditions for changes every few bars, and an LFO for slow, continuous movement.',
      },
      explanation: 'Go further: conditions NEI and PRE make tracks answer each other. Give the clap a 50 % trig, then a rim trig with NEI: the rim plays only when the clap before it did.',
    },
  ],
  review: [
    mc('A parameter lock affects…', ['The whole track', 'Only the trig it is on', 'Every pattern'], 1, 'The next trig reverts it.'),
    mc('Condition 1:2 plays…', ['On the first of every two loops', 'Half as loud', 'At half speed'], 0, 'A:B counts loops.'),
    mc('Condition 4:4 suits…', ['The first beat', 'Random hits', 'Fills on the last bar of a four-bar phrase'], 2, 'It fires on loop 4 of every 4.'),
    mc('A slow LFO is best for…', ['Gradual movement over many bars', 'A single accent', 'Changing the tempo'], 0, 'It moves continuously.'),
    mc('A trig with the FILL condition plays…', ['Every bar', 'Never', 'Only while FILL is active'], 2, 'The condition is true in fill mode only.'),
  ],
};

// ============================================================================
// L15 · Capstone: your track
// ============================================================================

/** Mixer channels in use: every Xone:96 channel an instrument is routed to */
const usedChannels = (s: S) => Object.entries(s.routes)
  .filter(([id, r]) => !!r && r !== 'master' && !!s.instances[id] && s.instances[r.split(':')[0]]?.device === XONE)
  .map(([, r]) => ({ studio_1: '1', studio_2: '2', studio_3: '3', studio_4: '4' } as Record<string, string>)[r.split(':')[1]])
  .filter((c): c is string => !!c);

/** The pattern an Elektron plays in a section: the last one a section chose, else its active pattern */
function sectionPattern(s: S, i: number, dev: string): string | undefined {
  const id = inst(s, dev);
  const p = proj(s, dev);
  if (!id || !p) return undefined;
  for (let k = i; k >= 0; k--) {
    const x = s.arrangement.sections[k]?.parts[id]?.pattern;
    if (x) return x;
  }
  return p.active;
}

/** The roles playing in section i: kick, other drums, bass, chords, hook, and any other instrument */
function rolesAt(s: S, i: number): Set<string> {
  const out = new Set<string>();
  const sec = s.arrangement.sections[i];
  if (!sec) return out;
  for (const [id, x] of Object.entries(s.instances)) {
    if (sec.parts[id]?.muted) continue;
    if (x.device === RYTM) {
      const p = sectionPattern(s, i, id);
      if (p && trigs(s, id, BD, p).length) out.add('kick');
      if (p && [SD, RS, CP, CH, OH, LT].some(t => trigs(s, id, t, p).length)) out.add('drums');
    } else if (x.device === A4) {
      const p = sectionPattern(s, i, id);
      if (!p) continue;
      if (trigs(s, id, T1, p).length) out.add('bass');
      if (trigs(s, id, T2, p).length || trigs(s, id, T3, p).length) out.add('chords');
      if (trigs(s, id, T4, p).length) out.add('hook');
    } else if (x.device === SUB) {
      if (x.values.arp_on === true) out.add('lead');
    } else if (!['studio-clock', XONE, 'audio-in'].includes(x.device) && s.routes[id]) {
      out.add(id);
    }
  }
  return out;
}

/** Does any stored pattern of an Elektron pass `fn`? */
const anyPattern = (s: S, dev: string, fn: (pattern: string) => boolean) => Object.keys(proj(s, dev)?.patterns ?? {}).some(fn);

const CORE_ROLES = ['kick', 'drums', 'bass', 'chords', 'hook', 'lead'];

/** The roles the loop has, over every stored pattern: kick, drums, bass, chords, hook, lead, other instruments */
function loopRoles(s: S): Set<string> {
  const out = new Set<string>();
  if (anyPattern(s, RYTM, p => trigs(s, RYTM, BD, p).length > 0)) out.add('kick');
  if (anyPattern(s, RYTM, p => [SD, RS, CP, CH, OH, LT].some(t => trigs(s, RYTM, t, p).length > 0))) out.add('drums');
  if (anyPattern(s, A4, p => trigs(s, A4, T1, p).length >= 2)) out.add('bass');
  if (anyPattern(s, A4, p => trigs(s, A4, T2, p).length > 0 || trigs(s, A4, T3, p).length > 0)) out.add('chords');
  if (anyPattern(s, A4, p => trigs(s, A4, T4, p).length >= 3)) out.add('hook');
  if (val(s, SUB, 'arp_on') === true) out.add('lead');
  for (const [id, x] of Object.entries(s.instances)) {
    if (![RYTM, A4, SUB, XONE, 'studio-clock', 'audio-in'].includes(x.device) && s.routes[id]) out.add(id);
  }
  return out;
}

/** Every note the melodic parts play (A4 tracks 1-4, every pattern the song uses) */
function melodicNotes(s: S): number[] {
  const a = inst(s, A4);
  if (!a) return [];
  const patterns = new Set<string>([proj(s, A4)?.active ?? 'A01', ...s.arrangement.sections.map((_, i) => sectionPattern(s, i, A4) ?? '')].filter(Boolean));
  const out: number[] = [];
  patterns.forEach(p => [T1, T2, T3, T4].forEach(t => trigs(s, A4, t, p).forEach(n => { const x = noteOf(s, A4, t, n, p); if (x !== undefined) out.push(x); })));
  return out;
}

const SYNCABLE = [RYTM, A4, SUB, XONE, 'midi-synth', 'subharmonicon'];
const CABLE_CLOCKED: Record<string, string> = { dfam: 'in_adv_clock', mother32: 'in_tempo' };

/** Every sequencer follows the studio: MIDI-style sync, or a clock cable into its clock input */
const allInTime = (s: S) => Object.entries(s.instances).every(([id, x]) => {
  if (SYNCABLE.includes(x.device)) return s.sync[id] !== false;
  const jack = CABLE_CLOCKED[x.device];
  if (!jack) return true;
  return s.studioCables.some(c => (c.to.instance === id && c.to.jack === jack) || (c.from.instance === id && c.from.jack === jack));
});

/** A section change the ear hears coming: after a 1-2 bar fill, a one-off pattern, or a snapshot that changes something */
function announced(s: S, i: number): boolean {
  const list = s.arrangement.sections;
  const prev = list[i - 1];
  if (!prev) return false;
  if (prev.bars <= 2) return true;
  if (Object.values(prev.parts).some(p => p.snapshot && Object.keys(p.snapshot as object).length)) return true;
  // a pattern only the section before plays: a build or a fill
  return Object.entries(prev.parts).some(([id, p]) => p.pattern && list.filter(x => x.parts[id]?.pattern === p.pattern).length === 1);
}

const capstone: Lesson = {
  id: 'studio-producer-15-capstone',
  device: 'studio',
  path: 'producer',
  order: 15,
  difficulty: 'advanced',
  name: 'Capstone: your track',
  description: 'Produce, arrange, mix, master and bounce a track of two minutes or more, then explain your decisions. Milestone by milestone, over several sessions if you like.',
  objective: 'Produce, arrange, mix, master and bounce an original two-minute track, then explain your decisions.',
  source: 'Synth Studio · Producer path (curriculum L15)',
  estimatedMinutes: 90,
  prerequisites: ['studio-producer-14-master-bounce'],
  concepts: ['sequencer-pattern', 'mixing', 'gain-staging', 'equalization', 'effects', 'timing-tempo'],
  tags: ['capstone', 'arrangement', 'mixdown', 'master', 'bounce'],
  start: { studio: elektronStudio({ ...CP_CAPSTONE, ownStudio: 'your own track: any instruments and any style' }) },
  steps: [
    {
      kind: 'info', concept: 'sequencer-pattern', area: 'arranger',
      instruction: 'The brief: two minutes or more, 100 to 140 BPM, one key, a clear energy curve, mixed and mastered. It can be any style.',
      principle: 'A finished track is many small decisions, made one at a time and checked by ear.',
      explanation: 'This studio holds the course track as a bank of patterns: Rytm A01 GROOVE, A02 BREAK (no kick), A03 FILL, A04 INTRO; Analog Four A01 FULL, A02 BASS, A03 BREAK. The Sub 37 is a guest on channel 3. Or press "Use my own studio" and bring your own track. Each milestone saves as you go: do one a session.',
    },
    {
      kind: 'reflect', instruction: 'Plan it.',
      reflect: {
        prompt: 'Write your plan: tempo, key, the instruments and the job of each, and your energy curve in one line.',
        model: '124 BPM, A minor. Rytm drums, A4 bass, stabs and hook, Sub 37 lead. Intro 8, groove 8, drop 16, break 8, build 8, drop 16, outro 8.',
      },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', area: 'rack',
      instruction: 'Milestone 1, the loop: a beat with a kick, a bass, chords or a pad, and a hook or lead, all in one key and in time.',
      checklist: [
        { text: 'Tempo between 100 and 140 BPM', check: s => between(s.transport.bpm, 100, 140) },
        { text: 'A beat with a kick (the Rytm\'s BD, or a DFAM in the mix)', check: s => anyPattern(s, RYTM, p => trigs(s, RYTM, BD, p).length >= 2) || (has(s, 'dfam') && !!s.routes[inst(s, 'dfam')!]) },
        { text: 'Four or more parts: drums, bass, chords, a hook, or other instruments in the mix', check: s => loopRoles(s).size >= 4 },
        { text: 'A bass, and chords or a hook over it', check: s => loopRoles(s).has('bass') && (loopRoles(s).has('chords') || loopRoles(s).has('hook') || loopRoles(s).has('lead')) },
        { text: 'Every melodic part in one key', check: s => melodicNotes(s).length === 0 || oneKey(melodicNotes(s)) },
        { text: 'A guest: the Sub 37 arpeggiates (ARP ON), or another instrument joins the mix', check: s => loopRoles(s).has('lead') || [...loopRoles(s)].some(r => !CORE_ROLES.includes(r)) },
        { text: 'Every sequencer in time: synced to the studio or clocked by cable', check: allInTime },
      ],
      hints: [
        'Reuse your best sounds from the path, and check the kick against the bass first.',
        'For the guest: on the Sub 37 press ARP ON, LATCH and SYNC, then play A, C and E. Any instrument from Instruments… works too.',
        'Keep the guest in the key: notes from A minor.',
      ],
      solution: {
        instance: SUB,
        values: { arp_on: true, arp_latch: true, arp_sync: true },
        notes: [nn('A3'), nn('C4'), nn('E4')],
        studio: { bpm: 124, sync: { [RYTM]: true, [A4]: true, [SUB]: true } },
        transport: 'play',
      },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', area: 'arranger',
      instruction: 'Milestone 2, the arrangement: sections in phrases, a break, and a song of two minutes or more.',
      checklist: [
        { text: 'The arranger is on', check: s => s.arrangement.enabled },
        { text: 'Five or more sections', check: s => s.arrangement.sections.length >= 5 },
        { text: 'Phrases of 4, 8, 16 or 32 bars (a 1- or 2-bar fill is fine)', check: s => s.arrangement.sections.length > 0 && s.arrangement.sections.every(x => [1, 2, 4, 8, 16, 32].includes(x.bars)) },
        { text: 'At least 2:00 of music', check: s => songSeconds(s) >= 120 },
        { text: 'A break: a section after the first without the kick', check: s => s.arrangement.sections.some((_, i) => i > 0 && !rolesAt(s, i).has('kick')) },
        {
          text: 'An energy curve: the first and the last sections play fewer parts than the fullest one',
          check: s => {
            const n = s.arrangement.sections.length;
            if (n < 3) return false;
            const size = (i: number) => rolesAt(s, i).size;
            const top = Math.max(...s.arrangement.sections.map((_, i) => size(i)));
            return size(0) < top && size(n - 1) < top;
          },
        },
      ],
      hints: ['Intro, groove, drop, break, drop, outro is a classic shape.', 'Pick patterns per section: the BREAK pattern has no kick.', 'Mute an instrument in a section to thin it out.'],
      solution: { arrangement: { enabled: true, loop: false, sections: capstoneSong() } },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', area: 'arranger',
      instruction: 'Milestone 3, transitions: announce at least three section changes, so the ear hears them coming.',
      checklist: [
        { text: 'Three or more changes announced by a fill section, a one-off build pattern or a snapshot', check: s => s.arrangement.sections.filter((_, i) => announced(s, i)).length >= 3 },
        { text: 'A short fill or breath: a 1- or 2-bar section', check: s => s.arrangement.sections.some(x => x.bars <= 2) },
        { text: 'The song is still 2:00 or longer', check: s => songSeconds(s) >= 120 },
      ],
      hints: ['A one-bar fill before a drop is the easiest announcement.', 'A snapshot can open a filter or pull a fader for the build.', 'Use the FILL pattern (Rytm A03) for one bar.'],
      solution: { arrangement: { enabled: true, loop: false, sections: capstoneTransitions() } },
    },
    {
      kind: 'predict', concept: 'mixing', instance: XONE, focus: ['booth_mono', 'monitor_out'],
      instruction: 'Before you mix, check the low end in mono: switch BOOTH MONO on and set YOU HEAR to BOOTH.',
      check: s => val(s, XONE, 'booth_mono') === true && num(s, XONE, 'monitor_out') === 1,
      solution: { parts: { [XONE]: { booth_mono: true, monitor_out: 1 } } },
      predict: mc('Some club systems and phone speakers play in mono. What should stay strong when you fold the mix to mono?',
        ['The kick and the bass', 'The reverb tails', 'The stereo width'], 0,
        'The low end carries the track on every system, and the kick and bass are centred, so they should hold up in mono. Wide effects get quieter in mono, which is fine.'),
      principle: 'A mix that works in mono works everywhere.',
    },
    {
      kind: 'do', concept: 'mixing', instance: XONE, focus: ['booth_mono', 'monitor_out'],
      instruction: 'Switch BOOTH MONO off and YOU HEAR back to MASTER.',
      check: s => val(s, XONE, 'booth_mono') === false && num(s, XONE, 'monitor_out') === 0,
      solution: { parts: { [XONE]: { booth_mono: false, monitor_out: 0 } } },
      principle: 'Check in mono, then mix in stereo.',
    },
    {
      kind: 'challenge', concept: 'gain-staging', instance: XONE, readout: ['channels', 'peaks', 'limiter'],
      instruction: 'Milestone 4, the mixdown: every channel clean, the drums leading, and headroom at the master. Judge it playing.',
      checklist: [
        { text: 'It is playing', check: s => playing(s) },
        { text: 'Every channel in use stays out of PK', check: s => usedChannels(s).length > 0 && usedChannels(s).every(c => { const m = xmeter(s, c); return !!m && !m.pk; }) },
        { text: 'The studio master peaks between −8 and −3 dBFS', check: s => { const m = master(s); return !!m && between(m.peakDb, -8, -3); } },
        { text: 'The limiter rests: under 1 dB of gain reduction', check: s => { const m = master(s); return !!m && m.grDb < 1; } },
        { text: 'The drums lead: channel 1 has the highest fader', check: s => usedChannels(s).every(c => xv(s, '1', 'FADER') >= xv(s, c, 'FADER')) },
        { text: 'You checked mono, and YOU HEAR is back on MASTER', check: s => !!s.history?.wasOn(XONE, 'booth_mono') && val(s, XONE, 'booth_mono') === false && num(s, XONE, 'monitor_out') === 0 },
      ],
      hints: ['GAIN first, by the channel meters; faders second. Judge it on the loudest section: ▶ from the Drop in the arranger.', 'MASTER 1 sets how hot the Xone feeds the studio master: lower it if the master runs hot.', 'The limiter should only catch the odd peak: your headroom for mastering.'],
      solution: { parts: { [XONE]: CAPSTONE_MIX }, play: { from: 'Drop', seconds: 6 } },
    },
    {
      kind: 'challenge', concept: 'gain-staging', area: 'master', readout: ['loudness', 'peaks', 'limiter'],
      instruction: 'Milestone 5, master and bounce: streaming (−14 LUFS) or club (−10 to −9) loudness, true peak at −1 dBTP or lower, with stems.',
      checklist: [
        { text: 'Integrated −15 to −13 LUFS (or −10 to −9 for a club master)', check: s => { const b = s.bounce?.last; return !!b && (between(b.lufsI, -15, -13) || between(b.lufsI, -10, -9)); } },
        { text: 'True peak −1.0 dBTP or lower', check: s => (s.bounce?.last?.truePeakDb ?? 0) <= -0.95 },
        { text: 'The limiter\'s largest gain reduction is 4 dB or less', check: s => { const b = s.bounce?.last; return !!b && b.maxGrDb <= 4; } },
        { text: 'Bounced from bar 1 to the end of the song', check: s => !!s.bounce?.last?.complete },
        { text: 'Stems bounced with it', check: s => (s.bounce?.last?.stems ?? 0) >= 2 },
      ],
      hints: ['Raise the master fader (DRIVE) a dB at a time, and play the loudest section.', 'If the limiter works too hard, switch on GLUE: 2:1, a slow attack, and it holds the mix together before the limiter.', 'Bounce (top bar) from bar 1 with stems on, then read its loudness in the readout.'],
      solution: { master: { gain: CAPSTONE_DRIVE, glue: CAPSTONE_GLUE }, bounce: { stems: true } },
    },
    {
      kind: 'reflect', instruction: 'Compare it with a track you love.',
      reflect: {
        prompt: 'Play your bounce next to a finished track in your style, at the same loudness. Where is the biggest difference: low end, mids, space or arrangement?',
        model: 'Name one, then revisit its lesson: low end in Bass locked to the kick and Frequency slots, mids in Chords and pads to Frequency slots, space in Space and depth, arrangement in Arrangement and Transitions.',
      },
    },
    {
      kind: 'quiz', concept: 'equalization', instruction: 'The final check.',
      quiz: mc('Your track sounds great in headphones, but the bass vanishes on a phone speaker. What do you check first?',
        ['The reverb send', 'The swing', 'The bass\'s harmonics: a little brightness or a higher octave so it is heard on small speakers'], 2,
        'Small speakers can\'t play below about 100 Hz, so the ear finds the bass through its harmonics. Reverb and swing don\'t affect that.'),
    },
    {
      kind: 'reflect', instruction: 'Look back on the whole track.',
      reflect: {
        prompt: 'Which decision made the biggest difference, and why? What would you do differently next time? Which lesson\'s idea did you use without thinking?',
        model: 'For example: "Locking the bass between the kicks made the groove; next time I\'d plan the break before the drop; I high-passed everything without being told." Then rate yourself 1-4 on groove, low end, harmony and hook, arrangement, transitions, mix and master.',
      },
      explanation: 'Rubric, 1 to 4: groove (stiff → makes you move), low end (fighting → locked and solid in mono), harmony and hook (clashes → memorable, in its own register), arrangement (one loop → a clear energy curve), transitions (none → seamless), mix (buried or clipping → every part clear), master (clipping or quiet → on target and still punchy).',
    },
  ],
  review: [
    mc('Kick and bass fight. The first fix to try…', ['More reverb on both', 'Put the bass between the kicks and shorten its notes', 'Raise the tempo'], 1, 'Separate them in time first (Bass locked to the kick).'),
    mc('A loop sounds boring after 16 bars. Try…', ['Trig conditions, locks and a slow LFO', 'A louder master', 'More swing only'], 0, 'Movement without new parts (Movement).'),
    mc('The break feels weak. Try…', ['Keeping the kick in', 'Removing the kick and bass so the drop brings them back', 'Making it 3 bars long'], 1, 'Contrast (Arrangement).'),
    mc('The mix is muddy. Start with…', ['Boosting LO on every channel', 'High-passing the parts that don\'t need lows', 'Adding reverb'], 1, 'Frequency slots.'),
    mc('Your master reads −7 LUFS for streaming. Do…', ['Nothing: louder is better', 'Lower the drive toward −14 LUFS and keep the punch', 'Raise the ceiling to 0 dBTP'], 1, 'Streaming turns loud masters down (Master and bounce).'),
  ],
};

export const PRODUCER_ELEKTRON_LESSONS: Lesson[] = [firstBeat, groove, bassKick, chords, hook, movement, capstone];

