// ============================================================================
// "Your synth (MIDI)" lessons (v2, docs/PEDAGOGY.md)
//
// Every lesson works without gear: the built-in Practice synth stands in for a
// hardware synth at the end of a MIDI cable (bass on channel 1, keys on 2,
// drums on 10), on any browser, including iPad. Steps that need real gear say
// so in their instruction and can be skipped with Skip.
//
//   foundations  1 ports and channels  2 velocity  3 CCs and program changes
//                4 mapping: templates and MIDI learn
//   sequencing   5 sequence it from the studio  6 MIDI clock
//   studio       two synths in one studio (spare capacity)
//
// Checks read the instance's data and values (s.data, s.values), the rack
// (s.instances) and the MIDI settings (learned mappings), so steps complete
// by themselves. Lessons that need a known knob map start from the Practice
// synth setup; the learner's own setup is saved and comes back with Restore.
// Orders below 1 keep these before the shared studio curriculum (1-5).
// ============================================================================

import type { Lesson, LessonCheckState } from '@/types';
import { useMidiStore } from '@/store/midi';
import {
  DEFAULT_NAME, PRACTICE_KNOBS, PRACTICE_PORT, asData, defaultSteps, initialData,
  type MidiSynthData, type SeqStep,
} from './config';

const O = (n: number) => n / 100;
const SOURCE = 'Synth Studio · MIDI 1.0 specification';

// ---------------------------------------------------------------- helpers

const md = (s: LessonCheckState) => asData(s.data);
const num = (s: LessonCheckState, id: string) => Number(s.values[id] ?? 0);
const on = (st: SeqStep[]) => st.filter(x => x.on);

/** Full data for solutions: the Practice synth setup plus a change */
const practice = (patch: Partial<MidiSynthData> = {}): MidiSynthData => ({ ...initialData(), port: { ...PRACTICE_PORT }, ...patch });
/** The default pattern with a change */
const steps = (fn: (s: SeqStep[]) => void): SeqStep[] => {
  const s = defaultSteps().map(x => ({ ...x }));
  fn(s);
  return s;
};
/** Practice synth with its full knob map (Cutoff, Resonance, Attack, Decay, ... Arp on/off = knob 11) */
const practiceKit = (patch: Partial<MidiSynthData> = {}) => practice({ name: 'Practice synth', knobs: PRACTICE_KNOBS.map(k => ({ ...k })), ...patch });

/** Other "Your synth" instruments in the studio */
const otherSynths = (s: LessonCheckState) =>
  Object.values(s.instances).filter(i => i.device === 'midi-synth' && i.data !== s.data).map(i => asData(i.data));

/** A controller knob is MIDI-learned to one of a Your synth's panel knobs */
const learnedPanelKnob = (s: LessonCheckState) =>
  useMidiStore.getState().mappings.some(m => /^k\d+$/.test(m.control) && s.instances[m.instance]?.device === 'midi-synth');

const BEATS = [0, 4, 8, 12];

// ============================================================================
// 1. Ports and channels
// ============================================================================

const l1: Lesson = {
  id: 'midi-synth-1-connect', device: 'midi-synth', path: 'foundations', order: O(1), difficulty: 'beginner',
  name: 'Connect a synth: ports and channels',
  description: 'Where MIDI goes: an output port, then one of 16 channels. Why channels exist, heard on the Practice synth.',
  objective: 'Send MIDI to a synth on the right output and channel, and explain why MIDI has 16 channels.',
  source: SOURCE, estimatedMinutes: 7,
  concepts: ['signal-routing'],
  start: { values: { play: false } },
  steps: [
    {
      kind: 'info', concept: 'signal-routing', focus: ['monitor'],
      instruction: 'MIDI carries messages, not sound: "play this note", "turn this knob". This panel sends them; a synth turns them into sound.',
      principle: 'MIDI carries instructions, not audio: the synth at the other end makes the sound.',
      explanation: 'A MIDI cable (or USB) runs one way, from an output on your computer to the synth. The sound comes back on a separate audio cable.',
    },
    {
      kind: 'info', concept: 'signal-routing', focus: ['setup'],
      instruction: 'Press Setup… and look at MIDI output. Choose your synth there, or keep Practice synth (built in) if you have no gear. Save.',
      principle: 'An output port is one cable\'s worth of messages leaving the computer.',
      explanation: 'A USB synth shows its own name; a synth on a 5-pin MIDI cable shows your MIDI interface\'s port. On iPad and in Safari there is no Web MIDI, so the Practice synth is the output there.',
    },
    {
      kind: 'info', concept: 'signal-routing', focus: ['monitor'],
      instruction: 'Play a few keys on the on-screen keyboard, or A to K on your computer. Watch the MIDI monitor.',
      principle: 'A key sends a note-on when pressed and a note-off when released.',
      explanation: 'Each line in the monitor is one message: its channel, what it is, and its bytes. "Note on ch1 C3 (48)" is three bytes: 90 30 64.',
    },
    {
      kind: 'predict', concept: 'signal-routing', focus: ['setup', 'monitor'],
      instruction: 'In Setup, set Channel to 3, Save, and play a few keys.',
      predict: {
        question: 'The Practice synth has parts on channels 1, 2 and 10. What will you hear on channel 3?',
        options: ['Nothing: no part listens on channel 3', 'The same sound, quieter', 'The keys part'], answer: 0,
        explain: 'Every message carries its channel, and each part only reacts to its own. Nothing listens on 3, so it stays silent, although the monitor shows the notes going out. A hardware synth in "omni" mode would play every channel.',
      },
      check: s => md(s).channel === 2,
      solution: { data: practice({ channel: 2 }) },
      principle: 'A synth only reacts to messages on the channel it listens to.',
    },
    {
      kind: 'do', concept: 'signal-routing', focus: ['setup'],
      instruction: 'Now set Channel to 2 and play again.',
      check: s => md(s).channel === 1,
      solution: { data: practice({ channel: 1 }) },
      principle: 'One MIDI cable carries 16 channels, so up to 16 synths or parts can share it.',
      explanation: 'On the Practice synth, channel 2 is a different part (keys): the same notes, a different sound. Multitimbral synths, and synths chained with MIDI THRU, work this way.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Why does MIDI have 16 channels?',
        options: ['So one cable can address up to 16 instruments or parts separately', 'So you can play 16 notes at once', 'To carry 16 audio tracks'], answer: 0,
        explain: 'Channels are addresses. One channel already carries chords (many notes at once), and MIDI never carries audio.',
      },
    },
    {
      kind: 'challenge', concept: 'signal-routing', focus: ['setup'],
      instruction: 'Set this panel up for a second synth on the same cable: its own channel, and a name you will recognise in the studio.',
      checklist: [
        { text: 'A channel other than 1', check: s => md(s).channel !== 0 },
        { text: 'Its own name (not "My synth")', check: s => !!md(s).name.trim() && md(s).name.trim() !== DEFAULT_NAME },
      ],
      hints: ['Two synths on one cable must not share a channel.', 'In Setup: Channel 2, and a name such as "Lead".', 'The name also labels its tab and every routing menu in the studio.'],
      solution: { data: practice({ channel: 1, name: 'Lead synth' }) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence: what is a MIDI channel for?',
        model: 'It addresses each message to one instrument or part, so several can share one cable and each reacts only to its own channel.',
      },
    },
  ],
  review: [
    { question: 'How many channels does one MIDI connection carry?', options: ['16', '8', '128'], answer: 0, explain: 'Channels 1 to 16 (0 to 15 inside the message).' },
    { question: 'A synth listening on channel 1 receives notes on channel 3. It…', options: ['Stays silent', 'Plays them quieter', 'Plays them an octave higher'], answer: 0, explain: 'It ignores other channels, unless it is in omni mode.' },
    { question: 'What does a MIDI cable carry?', options: ['Messages such as notes and knob moves', 'The synth\'s audio', 'Power for the synth'], answer: 0, explain: 'MIDI is control data; the sound comes back on an audio cable.' },
    { question: 'A synth in "omni" mode…', options: ['Responds on every channel', 'Only plays drums', 'Ignores velocity'], answer: 0, explain: 'Omni means it listens to all 16 channels.' },
  ],
};

// ============================================================================
// 2. Velocity
// ============================================================================

const l2: Lesson = {
  id: 'midi-synth-2-velocity', device: 'midi-synth', path: 'foundations', order: O(2), difficulty: 'beginner',
  name: 'Velocity: how hard you play',
  description: 'Every note carries how hard it was played. Read it in the monitor, play it on the keys and accent a pattern with it.',
  objective: 'Play soft and hard notes, read velocity in the MIDI monitor, and use it to accent a pattern.',
  source: SOURCE, estimatedMinutes: 6,
  prerequisites: ['midi-synth-1-connect'],
  concepts: ['velocity-dynamics', 'sequencer-pattern'],
  start: { values: { play: false, seq: true, gate: 50, length: 16, transpose: 0 } },
  steps: [
    {
      kind: 'info', concept: 'velocity-dynamics', focus: ['monitor'], autoplay: true,
      instruction: 'Listen: four notes from soft to hard. Watch the vel numbers in the MIDI monitor, then press Hear it again.',
      principle: 'Velocity, from 1 to 127, says how hard a key was struck.',
      explanation: 'A real keyboard measures how fast each key goes down. The synth decides what that changes: on the Practice synth, harder notes are louder and brighter.',
    },
    {
      kind: 'predict', concept: 'velocity-dynamics', focus: ['steps'],
      instruction: 'Tap step 3\'s note name, then tap a key near its bottom edge. That records a hard note into step 3.',
      predict: {
        question: 'On the on-screen keys, where do you tap to play louder?',
        options: ['Near the bottom of the key', 'Near the top of the key', 'It makes no difference'], answer: 0,
        explain: 'Like striking a real key harder, tapping lower sends a higher velocity: the step\'s bar grows and the monitor shows it. Computer keys always send 127.',
      },
      check: s => (md(s).steps[2]?.vel ?? 0) >= 110,
      solution: { data: practice({ steps: steps(s => { s[2] = { ...s[2], on: true, vel: 122 }; }) }) },
      principle: 'Lower on an on-screen key means a harder strike and a higher velocity.',
    },
    {
      kind: 'do', concept: 'velocity-dynamics', focus: ['steps'],
      instruction: 'Now select step 4 and drag vel down to about 40: a soft note.',
      check: s => (md(s).steps[3]?.vel ?? 127) <= 60,
      solution: { data: practice({ steps: steps(s => { s[2] = { ...s[2], on: true, vel: 122 }; s[3] = { ...s[3], on: true, vel: 40 }; }) }) },
      principle: 'Soft notes between loud ones give a pattern light and shade.',
    },
    {
      kind: 'do', control: 'play', targetValue: true, concept: 'velocity-dynamics',
      instruction: 'Press PLAY and listen to the loud and the soft step against the others.',
      principle: 'Dynamics, the contrast of loud and soft, make a part sound played rather than typed.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'velocity-dynamics',
      quiz: {
        question: 'A note-on message with velocity 0 means…',
        options: ['Note off', 'The loudest note', 'A silent note that keeps playing'], answer: 0,
        explain: 'MIDI treats a note-on with velocity 0 as a note-off, which is why a played note runs from 1 to 127.',
      },
    },
    {
      kind: 'challenge', concept: 'velocity-dynamics', focus: ['steps'],
      instruction: 'Make an accent pattern: the first 16th of every beat loud, the notes in between softer.',
      checklist: [
        { text: 'Steps 1, 5, 9 and 13 on and loud (vel 110 or more)', check: s => BEATS.every(i => md(s).steps[i]?.on && md(s).steps[i].vel >= 110) },
        { text: 'At least four other steps on and softer (vel 90 or less)', check: s => md(s).steps.filter((x, i) => !BEATS.includes(i) && x.on && x.vel <= 90).length >= 4 },
      ],
      hints: ['The beats fall on steps 1, 5, 9 and 13.', 'Select a step (tap its note name), then drag vel. Tap a pad to switch a step on.', 'Loud is 110 to 127; soft is 40 to 90.'],
      solution: { data: practice({ steps: steps(s => s.forEach((x, i) => { x.on = BEATS.includes(i) || x.on; x.vel = BEATS.includes(i) ? 120 : 72; })) }) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does velocity tell a synth, and who decides what it changes?',
        model: 'How hard a key was struck, from 1 to 127. The synth decides what to do with it: usually louder and often brighter, and some synths ignore it.',
      },
    },
  ],
  review: [
    { question: 'Velocity in a note-on runs…', options: ['From 1 to 127 (0 means note off)', 'From 0 to 100 %', 'From 1 to 16'], answer: 0, explain: 'Seven bits, with 0 reserved for note-off.' },
    { question: 'Velocity usually changes…', options: ['How loud, and often how bright, a note is', 'Its pitch', 'Its MIDI channel'], answer: 0, explain: 'What it changes is up to the synth.' },
    { question: 'On the on-screen keys, tapping lower on a key…', options: ['Plays louder: a higher velocity', 'Plays a lower note', 'Sends a CC'], answer: 0, explain: 'Lower on the key is a harder strike.' },
    { question: 'Accents on the first 16th of each beat make a pattern…', options: ['Easier to feel: the beat stands out', 'Slower', 'Out of tune'], answer: 0, explain: 'Contrast in loudness marks the beat.' },
  ],
};

// ============================================================================
// 3. CCs and program changes
// ============================================================================

const l3: Lesson = {
  id: 'midi-synth-3-cc', device: 'midi-synth', path: 'foundations', order: O(3), difficulty: 'beginner',
  name: 'Change the sound: CCs and program changes',
  description: 'Knobs send control changes (CCs) that move one parameter; program changes load a whole stored sound.',
  objective: 'Change a synth\'s sound over MIDI: move parameters with CC messages and recall whole sounds with program changes.',
  source: SOURCE, estimatedMinutes: 9,
  prerequisites: ['midi-synth-1-connect'],
  concepts: ['filter-cutoff', 'filter-resonance', 'signal-routing'],
  start: { values: { play: false, seq: true, program: 0 }, data: practiceKit({ name: 'Practice bass' }) },
  steps: [
    {
      kind: 'info', concept: 'signal-routing', focus: ['monitor'],
      instruction: 'A knob here sends a control change (CC): a number that names the parameter, and a value from 0 to 127.',
      principle: 'A CC message is a number naming a parameter, plus a value from 0 to 127.',
      explanation: 'This lesson starts on the Practice synth with its own knob map, so the numbers match what you hear. Your own setup comes back with Restore at the end.',
    },
    {
      kind: 'predict', control: 'k1', targetValue: 20, tolerance: 10, concept: 'filter-cutoff',
      instruction: 'Play some keys and turn Cutoff (knob 1) slowly down to about 20.',
      predict: {
        question: 'Cutoff sends CC 74. What will turning it down do to the Practice synth?',
        options: ['Make it darker and duller', 'Lower the pitch', 'Move it to another channel'], answer: 0,
        explain: 'CC 74 is the General MIDI "brightness" controller: the synth closes its filter, so the sound gets darker. Pitch comes from the notes, and the channel is part of every message.',
      },
      principle: 'Each CC number controls one parameter; the value sets where it is.',
    },
    {
      kind: 'listen', concept: 'filter-cutoff', focus: ['k1'],
      instruction: 'Compare the filter open and closed.',
      listen: {
        a: { k1: 115 }, b: { k1: 22 }, labels: ['Cutoff open', 'Cutoff closed'],
        question: {
          question: 'Which one sounds brighter?',
          options: ['Cutoff open', 'Cutoff closed', 'They sound the same'], answer: 0,
          explain: 'A higher CC value opens the filter and lets more harmonics through. The monitor shows each move as "CC 74 Cutoff = value".',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'The monitor shows "CC 74 Cutoff = 87". What does 87 tell the synth?',
        options: ['Where to set the cutoff, on a scale of 0 to 127', 'Which parameter to change', 'Which channel to use'], answer: 0,
        explain: '74 names the parameter and 87 is its new position. In bytes it is B0 4A 57: B0 means "control change on channel 1", 4A is 74 and 57 is 87, in hexadecimal.',
      },
    },
    {
      kind: 'match', concept: 'filter-resonance', instruction: 'Ear challenge: recreate the target sound with Cutoff and Resonance.',
      match: { target: { k1: 34, k2: 112 }, controls: ['k1', 'k2'], tolerance: 0.12 },
      hints: ['Does the target sound bright or dark? Does it ring?', 'It is darker than now, and it rings: that is resonance.', 'Cutoff about a quarter of the way up, Resonance near the top.'],
    },
    {
      kind: 'predict', control: 'program', targetValue: 2, concept: 'signal-routing', focus: ['program'],
      instruction: 'Press PROGRAM + until it shows 003, then play a few keys.',
      predict: {
        question: 'A CC moves one parameter. What will a program change do?',
        options: ['Load a whole different stored sound', 'Move one knob', 'Change the tempo'], answer: 0,
        explain: 'A program change recalls a complete patch stored in the synth. Program 3 of the Practice synth\'s bass part is an acid bass: every setting changes at once.',
      },
      principle: 'A program change recalls a complete stored sound in one message.',
    },
    {
      kind: 'do', control: 'k1', targetValue: 100, tolerance: 15, concept: 'filter-cutoff',
      instruction: 'Turn Cutoff up to about 100 on the new sound.',
      principle: 'Load the patch first, then tweak: a program change resets the sound, CCs adjust it.',
      explanation: 'That is why Send all sends the program before the knobs, and why changing programs makes the panel\'s knobs out of date until you move them.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Your synth\'s screen shows program 1. What number travels in the MIDI message?',
        options: ['0', '1', '127'], answer: 0,
        explain: 'The message counts from 0 to 127, and most synths display 1 to 128. Some show banks and letters instead (A01). The panel shows both.',
      },
    },
    {
      kind: 'challenge', concept: 'filter-cutoff', focus: ['program', 'k1', 'k4'],
      instruction: 'Make a dark, plucky bass: load a bass program you like, then shape it with Cutoff and Decay.',
      checklist: [
        { text: 'A program other than 1 loaded', check: s => num(s, 'program') !== 0 },
        { text: 'Cutoff below the middle (under 64)', check: s => num(s, 'k1') < 64 },
        { text: 'Decay short (knob 4 under 50)', check: s => num(s, 'k4') < 50 },
      ],
      hints: ['Programs first, then the knobs.', 'Try program 2 or 4, then turn Cutoff down.', 'Decay is knob 4: lower means shorter notes.'],
      solution: { values: { program: 1, k1: 38, k4: 30 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between a CC and a program change?',
        model: 'A CC moves one parameter to a value from 0 to 127; a program change loads a whole stored sound at once.',
      },
    },
  ],
  review: [
    { question: 'A CC message carries…', options: ['A controller number and a value from 0 to 127', 'A note and a velocity', 'Audio'], answer: 0, explain: 'Number = which parameter, value = where.' },
    { question: 'On synths that follow General MIDI, CC 74 controls…', options: ['Brightness (filter cutoff)', 'Volume', 'Pitch bend'], answer: 0, explain: 'CC 7 is volume; pitch bend is its own message.' },
    { question: 'A program change…', options: ['Recalls a whole stored sound', 'Moves one knob', 'Starts the sequencer'], answer: 0, explain: 'It loads a complete patch.' },
    { question: 'Program 1 on the synth\'s screen is sent as…', options: ['0', '1', '128'], answer: 0, explain: 'Messages count from 0.' },
  ],
};

// ============================================================================
// 4. Mapping: templates, typing CC numbers, Learn and MIDI learn
// ============================================================================

const minilogue = {
  id: 'korg-minilogue-xd', manufacturer: 'KORG', device: 'minilogue xd',
  source: 'https://github.com/pencilresearch/midi/blob/main/KORG/minilogue%20xd.csv',
};

const l4: Lesson = {
  id: 'midi-synth-4-mapping', device: 'midi-synth', path: 'foundations', order: O(4), difficulty: 'intermediate',
  name: 'Mapping: templates and MIDI learn',
  description: 'Give each knob the CC number your synth expects: from a midi.guide template, its manual, or by learning it. Then map a controller.',
  objective: 'Map panel knobs to the CC numbers your synth uses, from a template, the manual or by learning them, and map a controller knob to a panel knob.',
  source: 'Synth Studio · MIDI Guide by Pencil Research (midi.guide)', estimatedMinutes: 9,
  prerequisites: ['midi-synth-3-cc'],
  concepts: ['signal-routing'],
  start: { values: { play: false } },
  steps: [
    {
      kind: 'info', concept: 'signal-routing',
      instruction: 'Every synth picks its own CC numbers. Cutoff is CC 19 on a Moog Subsequent 37, CC 43 on a Korg minilogue and CC 23 on an Arturia MicroFreak.',
      principle: 'A CC number only means something to the synth that defines it.',
      explanation: 'CC 74 darkens the Practice synth, but on your synth it may do nothing or something else. A knob map, from a template or the manual\'s MIDI chart, makes the panel match the synth.',
    },
    {
      kind: 'do', concept: 'signal-routing', focus: ['setup'],
      instruction: 'Press Setup… and search the templates for your synth, or browse By manufacturer. Pick it and press Use.',
      check: s => md(s).template !== null,
      solution: { data: practice({ template: minilogue, name: 'minilogue xd', knobs: [{ label: 'Cutoff', cc: 43, min: 0, max: 127 }, { label: 'Resonance', cc: 44, min: 0, max: 127 }] }) },
      hints: ['Type part of the name: "minilogue", "Sub 37", "Digitone".', 'No match? Try By manufacturer.', 'No synth of your own? Pick one you would like to own, to see a real map.'],
      principle: 'A template is a synth\'s MIDI chart turned into ready-made knobs.',
      explanation: 'Templates come from midi.guide by Pencil Research: CC maps for over 450 instruments. Firmware versions differ, so check the numbers against your manual.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'A knob shows "CC19/51". Why two numbers?',
        options: ['It is a 14-bit control: CC 19 carries the coarse part, CC 51 the fine part', 'It controls two synths', 'It is a typing mistake'], answer: 0,
        explain: 'Fine-grained parameters such as the Subsequent 37\'s cutoff use two CCs 32 apart (MSB and LSB): 16,384 steps instead of 128, so sweeps are smooth.',
      },
    },
    {
      kind: 'predict', concept: 'signal-routing', focus: ['setup'],
      instruction: 'Map a knob by hand: in Setup, label knob 1 "Brightness", set its CC to 74 and Save.',
      predict: {
        question: 'Your synth\'s manual says cutoff is CC 43. What will knob 1 on CC 74 do on that synth?',
        options: ['Whatever that synth uses CC 74 for, or nothing', 'Cutoff anyway: the label says Brightness', 'Change its MIDI channel'], answer: 0,
        explain: 'The label is only for you: the synth reads the number. On the Practice synth CC 74 is brightness; on a synth that uses CC 43 for cutoff, CC 74 is something else or nothing.',
      },
      check: s => md(s).knobs[0]?.cc === 74 && /bright/i.test(md(s).knobs[0]?.label ?? ''),
      solution: { data: practice({ knobs: [{ label: 'Brightness', cc: 74, min: 0, max: 127 }, ...PRACTICE_KNOBS.slice(1).map(k => ({ ...k }))] }) },
      principle: 'Any panel knob can send any CC: the synth\'s MIDI chart says which number does what.',
      explanation: 'Typing numbers from the manual works for every synth, including ones without a template. Min and Max set the range the knob sweeps; swap them to turn it backwards.',
    },
    {
      kind: 'info', concept: 'signal-routing', focus: ['setup'],
      instruction: 'Needs a synth connected over MIDI: in Setup, press Learn next to a knob, then turn that knob on the synth. Skip it if you have none.',
      principle: 'Most synths send a CC when you turn their own knobs: Learn copies that number.',
      explanation: 'If nothing arrives, turn on "CC out" (sometimes called "MIDI out: CC" or "Local") in the synth\'s MIDI menu.',
    },
    {
      kind: 'challenge', concept: 'signal-routing',
      instruction: 'Needs a MIDI controller: press MIDI in the header, Start MIDI learn, touch a panel knob here, then move a knob on your controller.',
      checklist: [{ text: 'A controller knob mapped to one of this panel\'s knobs', check: learnedPanelKnob }],
      hints: ['No controller? Press Skip: the idea is in the next step.', 'Touch the knob on screen first, then move the controller knob.', 'The banner at the bottom shows what was mapped. Press Done when you are finished.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Your controller knob sends CC 21; your synth\'s cutoff is CC 43. What does MIDI learn do?',
        options: ['Links CC 21 to the panel knob, which sends CC 43 to the synth', 'Changes your synth to listen on CC 21', 'Nothing: the numbers must match'], answer: 0,
        explain: 'The panel knob sits in the middle: MIDI learn ties your controller\'s CC to it, and the knob map turns it into the CC your synth expects. Neither device needs reprogramming.',
      },
    },
    {
      kind: 'challenge', concept: 'signal-routing', focus: ['setup'],
      instruction: 'Make the panel fit a synth: at least six knobs, every one named, and no CC number used twice.',
      checklist: [
        { text: 'At least six knobs', check: s => md(s).knobs.length >= 6 },
        { text: 'Every knob has a name (not just "CC 12")', check: s => md(s).knobs.length > 0 && md(s).knobs.every(k => !/^CC \d+$/.test(k.label.trim())) },
        { text: 'No CC number used twice', check: s => new Set(md(s).knobs.map(k => k.cc)).size === md(s).knobs.length },
      ],
      hints: ['A template gives you named knobs at once.', 'Typing your own? Rename each knob after its parameter.', 'Two knobs on one CC fight each other: give each its own number.'],
      solution: { data: practiceKit() },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why can\'t one knob map work for every synth?',
        model: 'Each manufacturer chooses its own CC numbers, so a number that is cutoff on one synth is something else, or nothing, on another. A map per synth makes the knobs match.',
      },
    },
  ],
  review: [
    { question: 'Where do you find which CC a synth uses for cutoff?', options: ['Its MIDI chart: in the manual or a template', 'It is always CC 74', 'In the audio interface settings'], answer: 0, explain: 'Each synth defines its own numbers.' },
    { question: 'A 14-bit control uses…', options: ['Two CCs, 32 apart (MSB and LSB)', 'Fourteen CCs', 'A program change'], answer: 0, explain: 'MSB + LSB give 16,384 steps.' },
    { question: 'MIDI learn on a controller knob…', options: ['Ties its CC to a control on screen', 'Reprograms the controller', 'Changes the synth\'s CC numbers'], answer: 0, explain: 'The mapping lives in Synth Studio.' },
  ],
};

// ============================================================================
// 5. Sequence it from the studio
// ============================================================================

const l5: Lesson = {
  id: 'midi-synth-5-sequence', device: 'midi-synth', path: 'sequencing', order: O(5), difficulty: 'intermediate',
  name: 'Sequence it from the studio',
  description: 'Write a pattern that plays your synth in time with the studio, then shape it with GATE, LENGTH and TRANSPOSE.',
  objective: 'Program a 16-step pattern that plays a synth in time with the studio, and shape it with GATE, LENGTH and TRANSPOSE.',
  source: SOURCE, estimatedMinutes: 9,
  prerequisites: ['midi-synth-2-velocity'],
  concepts: ['sequencer-pattern', 'timing-tempo'],
  start: { values: { play: false, seq: true, gate: 50, length: 16, transpose: 0 } },
  steps: [
    {
      kind: 'do', concept: 'sequencer-pattern', focus: ['starters'],
      instruction: 'Press Starters and choose Sequence / Empty pattern: every step switches off.',
      check: s => md(s).steps.every(x => !x.on),
      solution: { data: practice({ steps: defaultSteps().map(x => ({ ...x, on: false })) }) },
      principle: 'Starting from silence makes every note a decision.',
      explanation: 'The notes stay in the steps, so tapping a pad brings one back.',
    },
    {
      kind: 'do', control: 'play', targetValue: true, concept: 'timing-tempo',
      instruction: 'Press PLAY. The studio starts; the lit outline shows the step that is playing.',
      principle: 'A step sequencer plays one step per 16th note, locked to the studio clock.',
      explanation: 'PLAY here and ▶ in the top bar are the same while "Sync to studio clock" is ticked in the Studio tab. Notes leave a little early with exact timestamps, so the synth plays when you hear the twins.',
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', focus: ['steps'],
      instruction: 'Write a bass line: switch steps on, tap a note name and play a key to set its note. Use at least three notes.',
      checklist: [
        { text: 'At least six steps on', check: s => on(md(s).steps).length >= 6 },
        { text: 'At least three different notes', check: s => new Set(on(md(s).steps).map(x => x.note)).size >= 3 },
        { text: 'Some room to breathe: at least three steps off', check: s => md(s).steps.filter(x => !x.on).length >= 3 },
      ],
      hints: ['Tap a pad to switch a step on.', 'Tap a step\'s note name, then play a key: the note goes in and the next step is selected.', 'Root note on the beats (steps 1, 5, 9, 13), others in between.'],
      solution: { data: practice({ steps: defaultSteps() }) },
    },
    {
      kind: 'predict', control: 'gate', targetValue: 15, tolerance: 6, concept: 'sequencer-pattern',
      instruction: 'Turn GATE down to about 15%.',
      predict: {
        question: 'GATE sets how long each note is held. What will 15% do?',
        options: ['Make short, clipped notes', 'Slow the steps down', 'Make the notes quieter'], answer: 0,
        explain: 'Each note-off now comes after 15% of a 16th. The steps keep their timing, which the tempo sets, and loudness comes from velocity.',
      },
      principle: 'Gate length is how long a note is held, separate from when it starts.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'At 120 BPM, how long is one step?',
        options: ['0.125 s, a 16th note', '0.5 s, a beat', '1 second'], answer: 0,
        explain: 'A beat is 0.5 s at 120 BPM, and a step is a 16th note: a quarter of a beat.',
      },
    },
    {
      kind: 'predict', control: 'length', targetValue: 12, concept: 'sequencer-pattern',
      instruction: 'Set LENGTH to 12 steps.',
      predict: {
        question: 'The studio\'s bar is 16 steps. What happens with a 12-step loop?',
        options: ['It starts at a different place in the bar each time round', 'It plays slower', 'It stops after 12 steps'], answer: 0,
        explain: 'Twelve against sixteen lines up again only every three bars: a polymeter. It keeps a short pattern moving.',
      },
      principle: 'Loops of different lengths drift against each other and meet again later.',
    },
    {
      kind: 'do', control: 'transpose', targetValue: 5, concept: 'sequencer-pattern',
      instruction: 'Turn TRANSPOSE to +5: the whole pattern moves up a fourth.',
      principle: 'Transposing shifts every note by the same interval, so the melody keeps its shape.',
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does the sequencer send each note a little ahead of time?',
        model: 'So the timestamp tells the synth exactly when to play: the note lands on the beat you hear, not whenever the computer gets round to sending it.',
      },
    },
  ],
  review: [
    { question: 'Each step of this sequencer is…', options: ['A 16th note', 'A beat', 'A bar'], answer: 0, explain: 'Four steps per beat.' },
    { question: 'GATE controls…', options: ['How long each note is held', 'When the next step starts', 'How loud the notes are'], answer: 0, explain: 'Length, not timing or loudness.' },
    { question: 'A 12-step loop against a 16-step bar…', options: ['Shifts against the bar each time round', 'Plays slower', 'Plays louder'], answer: 0, explain: 'A polymeter: they realign every 48 steps.' },
    { question: 'TRANSPOSE +12 moves the pattern…', options: ['Up an octave', '12 steps later', 'To channel 12'], answer: 0, explain: '12 semitones is an octave.' },
  ],
};

// ============================================================================
// 6. MIDI clock
// ============================================================================

const l6: Lesson = {
  id: 'midi-synth-6-clock', device: 'midi-synth', path: 'sequencing', order: O(6), difficulty: 'intermediate',
  name: 'MIDI clock: the synth\'s arpeggiator follows',
  description: 'Hear a synth\'s own arpeggiator drift from the studio, then lock it with MIDI clock.',
  objective: 'Send MIDI clock so a synth\'s own arpeggiator or sequencer locks to the studio tempo, and hear what happens without it.',
  source: SOURCE, estimatedMinutes: 9,
  prerequisites: ['midi-synth-5-sequence'],
  concepts: ['timing-tempo', 'sequencer-pattern'],
  // No knob values here: they would be sent before the new knob map arrives
  start: { values: { play: false, seq: false }, data: practiceKit({ name: 'Practice keys', channel: 1, clock: false }) },
  steps: [
    {
      kind: 'info', concept: 'timing-tempo', focus: ['clock'],
      instruction: 'Many synths have their own arpeggiator or sequencer. MIDI clock lets them follow the studio. This lesson uses the Practice synth\'s.',
      principle: 'MIDI clock is 24 pulses per beat: the synth counts them to find the tempo.',
      explanation: 'The lesson starts on the Practice synth\'s keys part (channel 2) with the step sequencer off. Your own setup comes back with Restore at the end.',
    },
    {
      kind: 'do', control: 'k11', targetValue: 127, tolerance: 60, concept: 'sequencer-pattern',
      instruction: 'Turn Arp on/off (knob 11) all the way up, then play a chord on the keys and let go.',
      principle: 'An arpeggiator plays the notes you hold one after another, in time.',
      explanation: 'The Practice synth\'s arpeggiator latches: the notes keep cycling after you let go, until you play a new chord. Knob 11 sends CC 80; above the middle is on.',
    },
    {
      kind: 'predict', control: 'play', targetValue: true, concept: 'timing-tempo',
      instruction: 'Turn on Click in the top bar, then press ▶ there (or PLAY here). Listen to the arpeggio against the click.',
      predict: {
        question: 'No clock is sent yet. Will the arpeggio stay in time with the click?',
        options: ['No: it runs at its own tempo and drifts', 'Yes: it hears the studio anyway', 'It stops'], answer: 0,
        explain: 'Without clock the synth only knows its own tempo (the Practice synth\'s is 104 BPM) and has no idea where the studio\'s beat is, so the two drift apart.',
      },
      principle: 'Two separate clocks never stay together for long.',
    },
    {
      kind: 'do', concept: 'timing-tempo', focus: ['setup', 'clock'],
      instruction: 'Open Setup, tick Send MIDI clock to this synth, and Save. Listen to the arpeggio snap to the click.',
      check: s => md(s).clock,
      solution: { data: practiceKit({ name: 'Practice keys', channel: 1, clock: true }) },
      principle: 'With clock, the follower takes both its tempo and its beat from the leader.',
      explanation: 'The studio sends 24 pulses per beat with Start and Stop, so the arpeggio steps on the studio\'s 16ths. The clock light in the header flashes on every beat.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'How many MIDI clock pulses make one beat?',
        options: ['24', '4', '96'], answer: 0,
        explain: '24 pulses per quarter note (PPQN). A 16th note is 6 pulses, so a 16th-note arpeggiator steps every sixth pulse.',
      },
    },
    {
      kind: 'info', concept: 'timing-tempo',
      instruction: 'Change the tempo in the top bar while it plays: the arpeggio follows at once. Then press stop and ▶ again: it restarts on the beat.',
      principle: 'Start, Stop and Continue messages make followers start together, on the downbeat.',
      explanation: 'On hardware, set the synth\'s clock source to External or Auto (look for Sync or MIDI clock in its menu). Swing is not sent in the clock, so set swing on the synth itself.',
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', focus: ['setup', 'clock'],
      instruction: 'Set the synth up to play its own arpeggio in time: clock on, arpeggiator on, and the studio\'s step sequencer off.',
      checklist: [
        { text: 'MIDI clock sent to this synth', check: s => md(s).clock },
        { text: 'Arp on/off (knob 11) up', check: s => num(s, 'k11') >= 64 },
        { text: 'SEQ off, so only the arpeggio plays', check: s => s.values.seq === false },
      ],
      hints: ['Three switches: one in Setup, one knob, one button.', 'Send MIDI clock is in Setup; Arp is knob 11.', 'SEQ is the button next to PLAY.'],
      solution: { values: { seq: false, k11: 127 }, data: practiceKit({ name: 'Practice keys', channel: 1, clock: true }) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'When would you send notes from the studio, and when only clock?',
        model: 'Send notes when the studio should play the part; send only clock when the synth plays its own arpeggiator or sequence and just needs the studio\'s tempo, start and stop.',
      },
    },
  ],
  review: [
    { question: 'MIDI clock sends…', options: ['24 pulses per beat, plus Start and Stop', 'The notes to play', 'Audio'], answer: 0, explain: 'Timing only, no notes.' },
    { question: 'Without clock, a synth\'s arpeggiator…', options: ['Runs at its own tempo and drifts from the studio', 'Stops', 'Follows the studio anyway'], answer: 0, explain: 'It has no way to know the studio\'s tempo.' },
    { question: 'At 24 PPQN, one 16th note is…', options: ['6 clock pulses', '24 pulses', '1 pulse'], answer: 0, explain: '24 / 4 = 6.' },
    { question: 'To make a hardware synth follow clock, set it to…', options: ['External or auto clock', 'Omni mode', 'Local off'], answer: 0, explain: 'Clock source, usually in a Sync or MIDI menu.' },
  ],
};

// ============================================================================
// Studio: two synths in one studio (spare capacity)
// ============================================================================

const st1: Lesson = {
  id: 'midi-synth-studio-1-two-synths', device: 'midi-synth', path: 'studio', order: 6, difficulty: 'intermediate',
  name: 'Two synths in one studio',
  description: 'A bass and a lead on one MIDI cable: separate channels, clear names and their own patterns, playing together.',
  objective: 'Run two synths side by side: each on its own channel, named so the studio tells them apart, playing together from one ▶.',
  source: SOURCE, estimatedMinutes: 10,
  prerequisites: ['midi-synth-1-connect'],
  concepts: ['signal-routing', 'sequencer-pattern'],
  start: { values: { play: false, seq: true } },
  steps: [
    {
      kind: 'info', concept: 'signal-routing',
      instruction: 'Studios often run several synths from one MIDI interface. Each needs its own channel (or its own output) and a name you can recognise.',
      principle: 'Separate channels keep parts apart on a shared cable.',
      explanation: 'With the Practice synth, channel 1 plays its bass part and channel 2 its keys part: two "synths" on one virtual cable.',
    },
    {
      kind: 'do', concept: 'signal-routing', focus: ['setup'],
      instruction: 'In Setup, name this synth Bass and set it to channel 1. Save.',
      check: s => /bass/i.test(md(s).name) && md(s).channel === 0,
      solution: { data: practice({ name: 'Bass', channel: 0 }) },
      principle: 'A clear name follows the synth into the rack, routing menus and MIDI settings.',
    },
    {
      kind: 'challenge', concept: 'signal-routing',
      instruction: 'Add a second one: Instruments… → Your synth (MIDI) → Add another. Then come back to this tab.',
      checklist: [{ text: 'Two "Your synth" instruments in the studio', check: s => otherSynths(s).length >= 1 }],
      hints: ['Instruments… is next to the instrument tabs at the top.', 'Choose "Add another", not "Open".', 'The lesson waits on this tab: click "Bass" to come back.'],
    },
    {
      kind: 'challenge', concept: 'signal-routing',
      instruction: 'On the second one (its own tab), open Setup: name it Lead, channel 2. Then come back to this tab.',
      checklist: [
        { text: 'A second synth named Lead', check: s => otherSynths(s).some(d => /lead/i.test(d.name)) },
        { text: 'On a different channel from Bass', check: s => otherSynths(s).some(d => /lead/i.test(d.name) && d.channel !== md(s).channel) },
      ],
      hints: ['Its tab says "Your synth (MIDI) 2" until you name it.', 'Channel 2 is the Practice synth\'s keys part.', 'If both were on channel 1, both parts would play every note.'],
    },
    {
      kind: 'predict', control: 'play', targetValue: true, concept: 'sequencer-pattern',
      instruction: 'Press PLAY: both synths play their own patterns from one transport.',
      predict: {
        question: 'Both panels send to the same output. Why don\'t their notes mix up?',
        options: ['Each message carries its channel, and each part listens to one channel', 'They take turns', 'The second panel is ignored'], answer: 0,
        explain: 'The bass part only answers channel 1 and the keys part channel 2, so one cable carries both parts cleanly. Watch each panel\'s monitor: ch1 and ch2.',
      },
      principle: 'One transport, many instruments: every sequencer follows the same clock.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Two synths share an output and both listen on channel 1. What happens?',
        options: ['Both play every note from both panels', 'Only the first one plays', 'MIDI picks one at random'], answer: 0,
        explain: 'Each synth reacts to everything on its channel, so both play both parts. Setup warns you when two panels share an output and channel.',
      },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do you keep two synths on one MIDI cable from playing each other\'s parts?',
        model: 'Give each its own receive channel and send each part on that channel; name them so the studio\'s menus show which is which.',
      },
    },
  ],
  review: [
    { question: 'Two synths on one cable need…', options: ['Different channels', 'Different tempos', 'Different velocities'], answer: 0, explain: 'Channels address each one.' },
    { question: 'Naming a Your synth…', options: ['Labels it in the rack and every routing menu', 'Changes its MIDI channel', 'Changes the synth\'s own patch name'], answer: 0, explain: 'The name is for you and the studio.' },
    { question: 'One ▶ starts…', options: ['Every instrument that follows the studio clock', 'Only the focused one', 'Only the drums'], answer: 0, explain: 'They all share the transport.' },
  ],
};

export const MIDI_SYNTH_LESSONS: Lesson[] = [l1, l2, l3, l4, l5, l6, st1];
