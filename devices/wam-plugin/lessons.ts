// ============================================================================
// Web Audio plugin lessons (v2, docs/PEDAGOGY.md)
//
// They use the two built-in plugins (Studio Mono, Studio Echo), which load with
// no network and nothing to trust, so every lesson works offline and on any
// school network. The same steps apply to WAM plugins from the web.
//
//   foundations  1 load a plugin (instrument or effect, and trust)
//                2 play a plugin instrument (window, state saved with the project)
//                3 effects: put a sound through a plugin (bypass, tempo sync)
//                4 plugins and hardware
//
// Checks read the slot's data (which plugin, and the plugin's saved settings),
// its values (LEVEL, BYPASS), sync and studio cables.
// ============================================================================

import type { Lesson, LessonCheckState } from '@/types';
import { BUILTIN_ECHO, BUILTIN_MONO } from '@/lib/wam/builtin';
import { asWamData, type WamData } from './config';

const O = (n: number) => n / 100;
const SOURCE = 'Synth Studio · Web Audio Modules (WAM 2) API';

// ---------------------------------------------------------------- helpers

const w = (s: LessonCheckState) => asWamData(s.data);
const state = (s: LessonCheckState) => (w(s).state && typeof w(s).state === 'object' ? w(s).state as Record<string, unknown> : {});
const st = (s: LessonCheckState, id: string, fallback: number) => {
  const v = state(s)[id];
  return typeof v === 'number' ? v : fallback;
};
const num = (s: LessonCheckState, id: string) => Number(s.values[id] ?? 0);
const selfId = (s: LessonCheckState) => Object.entries(s.instances).find(([, i]) => i.data === s.data && i.device === 'wam-plugin')?.[0] ?? 'wam-plugin';
const synced = (s: LessonCheckState) => s.sync[selfId(s)] !== false;
const cableIn = (s: LessonCheckState) => {
  const id = selfId(s);
  return s.studioCables.some(c => (c.to.instance === id && c.to.jack === 'in') || (c.from.instance === id && c.from.jack === 'in'));
};

const mono = (stateObj?: Record<string, unknown>): WamData => ({ v: 1, url: BUILTIN_MONO, name: 'Studio Mono', ...(stateObj ? { state: stateObj } : {}) });
const echo = (stateObj?: Record<string, unknown>): WamData => ({ v: 1, url: BUILTIN_ECHO, name: 'Studio Echo', ...(stateObj ? { state: stateObj } : {}) });
const MONO_DEFAULT = { wave: 'sawtooth', cutoff: 900, resonance: 8, envAmount: 0.55, decay: 0.35, glide: 0, level: 0.8 };
const ECHO_DEFAULT = { division: '3/16', sync: true, timeMs: 375, feedback: 0.42, tone: 5000, mix: 0.35 };

// ============================================================================
// 1. Load a plugin
// ============================================================================

const l1: Lesson = {
  id: 'wam-plugin-1-load', device: 'wam-plugin', path: 'foundations', order: O(1), difficulty: 'beginner',
  name: 'Load a plugin',
  description: 'What a plugin is, the difference between instruments and effects, and which plugins to trust.',
  objective: 'Load a plugin into the host, tell an instrument from an effect, and decide which plugins to trust.',
  source: SOURCE, estimatedMinutes: 6,
  concepts: ['signal-routing', 'effects'],
  start: { values: { level: 0, bypass: false } },
  steps: [
    {
      kind: 'info', concept: 'signal-routing', focus: ['choose'],
      instruction: 'A plugin is an instrument or effect made of code that runs inside a host: a DAW, or here, this panel.',
      principle: 'A plugin is software that runs inside a host, the way a cartridge runs in a console.',
      explanation: 'Web Audio Modules (WAM 2) are plugins for the browser, like VST or AU plugins for a DAW. This panel is the host: it gives the plugin notes, audio and the studio tempo.',
    },
    {
      kind: 'do', concept: 'signal-routing', focus: ['choose'],
      instruction: 'Press Choose plugin… and load Studio Mono (built in).',
      check: s => w(s).url === BUILTIN_MONO,
      solution: { data: mono() },
      principle: 'Loading a plugin creates one instance of it, with its own settings.',
      explanation: 'The built-in plugins load instantly and work offline. Web plugins load from their site the same way.',
    },
    {
      kind: 'info', concept: 'signal-routing',
      instruction: 'Play a few keys, here or A to K on your computer. Studio Mono is an instrument: it turns notes into sound.',
      principle: 'An instrument plugin makes sound from the notes it receives.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'You paste the URL of a plugin from a site you don\'t know. What do you think about first?',
        options: ['Whether you trust that site: its code runs with the same access as this page', 'Whether it is free', 'Nothing: browser plugins are sandboxed'], answer: 0,
        explain: 'A web plugin is JavaScript running inside this page, and Synth Studio cannot sandbox it: it could read your projects in this browser. Built-in plugins need no trust.',
      },
    },
    {
      kind: 'predict', concept: 'effects', focus: ['choose'],
      instruction: 'Load Studio Echo instead (Change…), then play the keys.',
      predict: {
        question: 'Studio Echo is an effect. What will the keys do now?',
        options: ['Nothing: an effect needs sound coming in, not notes', 'Play a synth with an echo', 'Play Studio Mono'], answer: 0,
        explain: 'An instrument turns notes into sound; an effect changes sound that arrives on its IN. With nothing patched into IN, an effect is silent.',
      },
      check: s => w(s).url === BUILTIN_ECHO,
      solution: { data: echo() },
      principle: 'Instruments make sound from notes; effects change sound that comes in.',
    },
    {
      kind: 'info', concept: 'effects', focus: ['test-sound'],
      instruction: 'Press Test sound: a short groove goes into IN and through the echo.',
      principle: 'An effect is heard only through the sound it processes.',
      explanation: 'In the studio you feed an effect by patching another instrument\'s output into IN. Test sound is a quick way to hear it alone.',
    },
    {
      kind: 'challenge', concept: 'signal-routing', focus: ['choose', 'level'],
      instruction: 'Set this slot up as a synth you can play, at a sensible level.',
      checklist: [
        { text: 'An instrument plugin loaded', check: s => w(s).url === BUILTIN_MONO || /synth101|modal/i.test(w(s).url ?? '') },
        { text: 'LEVEL between -12 and +3 dB', check: s => num(s, 'level') >= -12 && num(s, 'level') <= 3 },
      ],
      hints: ['Effects make no sound from the keys.', 'Studio Mono is the built-in instrument.', 'LEVEL is the knob in the middle of the panel.'],
      solution: { data: mono(), values: { level: -3 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between an instrument plugin and an effect plugin?',
        model: 'An instrument turns notes (from keys or MIDI) into sound; an effect changes sound that is fed into it, so it is silent until something is patched into its input.',
      },
    },
  ],
  review: [
    { question: 'A plugin runs…', options: ['Inside a host such as a DAW or this panel', 'On its own, without a host', 'Inside your audio interface'], answer: 0, explain: 'The host feeds it notes, audio and tempo.' },
    { question: 'An effect plugin with nothing patched into IN…', options: ['Is silent', 'Plays its own notes', 'Plays the keys'], answer: 0, explain: 'It needs sound to process.' },
    { question: 'Before loading a plugin from an unknown site you should…', options: ['Decide whether you trust that site', 'Turn the volume down', 'Nothing'], answer: 0, explain: 'Its code runs inside this page.' },
  ],
};

// ============================================================================
// 2. Play a plugin instrument
// ============================================================================

const l2: Lesson = {
  id: 'wam-plugin-2-play', device: 'wam-plugin', path: 'foundations', order: O(2), difficulty: 'beginner',
  name: 'Play a plugin instrument',
  description: 'Play a plugin from the keys and MIDI, shape it in its own window, and keep its sound with the project.',
  objective: 'Play a plugin instrument, shape it in its own window, and keep its settings with the project.',
  source: SOURCE, estimatedMinutes: 7,
  prerequisites: ['wam-plugin-1-load'],
  concepts: ['filter-cutoff', 'envelope-decay'],
  start: { values: { level: 0, bypass: false } },
  steps: [
    {
      kind: 'do', concept: 'filter-cutoff', focus: ['choose'],
      instruction: 'Load Studio Mono (Choose plugin… or Change…, then the built-in instrument).',
      check: s => w(s).url === BUILTIN_MONO,
      solution: { data: mono() },
      principle: 'An instrument plugin is a synth that lives in software.',
    },
    {
      kind: 'info', concept: 'filter-cutoff',
      instruction: 'Play the keys, A to K on your computer, or a MIDI keyboard. Notes reach the plugin as MIDI events.',
      principle: 'A plugin instrument receives the same MIDI messages a hardware synth does.',
      explanation: 'The host turns each key into a note-on and note-off with an exact time, and the plugin plays it inside the audio engine.',
    },
    {
      kind: 'predict', concept: 'filter-cutoff', focus: ['window'],
      instruction: 'Press Open plugin window, turn Cutoff down below 500 Hz, then press Close.',
      predict: {
        question: 'You close the plugin window. What happens to the settings you changed?',
        options: ['They are saved with the project', 'They are lost', 'They go back to the factory sound'], answer: 0,
        explain: 'The host asks the plugin for its state when the window closes and keeps it in the project, so the next load sounds the same. A hardware synth needs its own patch memory for that.',
      },
      check: s => w(s).url === BUILTIN_MONO && st(s, 'cutoff', 900) < 500,
      solution: { data: mono({ ...MONO_DEFAULT, cutoff: 380 }) },
      principle: 'Total recall: a host can save and restore every plugin setting with the project.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-cutoff',
      quiz: {
        question: 'Studio Mono follows CC 74. A controller knob sending CC 74 changes…',
        options: ['Its cutoff', 'Its volume', 'The tempo'], answer: 0,
        explain: 'MIDI input reaches the plugin like the keys: notes play it, CC 74 moves its cutoff and CC 71 its resonance. Plugins publish which CCs they follow, like a hardware MIDI chart.',
      },
    },
    {
      kind: 'challenge', concept: 'envelope-decay', focus: ['window'],
      instruction: 'Make a dark, short bass in the plugin window: a low cutoff and a short decay. Close the window to keep it.',
      checklist: [
        { text: 'Cutoff below 500 Hz', check: s => st(s, 'cutoff', 900) < 500 },
        { text: 'Decay under 250 ms', check: s => st(s, 'decay', 0.35) < 0.25 },
      ],
      hints: ['Both are sliders in the plugin window.', 'Dark means less of the high harmonics: Cutoff down.', 'Short means Decay down; close the window to save.'],
      solution: { data: mono({ ...MONO_DEFAULT, cutoff: 320, decay: 0.15 }) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does a host save for a plugin that a hardware synth needs a patch memory for?',
        model: 'Every setting of the plugin: the host stores its state with the project and restores it on load, while a hardware synth keeps its sound in its own memory and needs it saved or recalled there.',
      },
    },
  ],
  review: [
    { question: 'Notes reach a plugin instrument as…', options: ['MIDI events from the host', 'Audio', 'Clock pulses'], answer: 0, explain: 'The same messages a hardware synth gets.' },
    { question: 'Closing the plugin window here…', options: ['Saves its settings with the project', 'Resets the plugin', 'Unloads it'], answer: 0, explain: 'Total recall.' },
    { question: 'A plugin\'s settings come back when…', options: ['The project is opened again', 'You restart the computer', 'Never'], answer: 0, explain: 'The host restores the saved state.' },
  ],
};

// ============================================================================
// 3. Effects
// ============================================================================

const l3: Lesson = {
  id: 'wam-plugin-3-effects', device: 'wam-plugin', path: 'foundations', order: O(3), difficulty: 'intermediate',
  name: 'Effects: put a sound through a plugin',
  description: 'Feed audio through an effect, compare it with BYPASS, and lock a delay to the studio tempo.',
  objective: 'Feed audio through an effect plugin, compare it with BYPASS, and lock a delay to the studio tempo.',
  source: SOURCE, estimatedMinutes: 8,
  prerequisites: ['wam-plugin-1-load'],
  concepts: ['effects', 'timing-tempo'],
  start: { values: { level: 0, bypass: false } },
  steps: [
    {
      kind: 'do', concept: 'effects', focus: ['choose'],
      instruction: 'Load Studio Echo (built in).',
      check: s => w(s).url === BUILTIN_ECHO,
      solution: { data: echo() },
      principle: 'An effect sits in the signal path: sound goes in, changed sound comes out.',
    },
    {
      kind: 'listen', concept: 'effects', focus: ['bypass'],
      instruction: 'Compare the groove through the echo and with BYPASS on.',
      listen: {
        a: { bypass: false }, b: { bypass: true }, labels: ['Echo on', 'Bypassed'],
        question: {
          question: 'What does BYPASS do?',
          options: ['Passes the sound through untouched, so you can compare', 'Silences the plugin', 'Doubles the echo'], answer: 0,
          explain: 'Bypass skips the effect but keeps the sound flowing. Comparing with and without is how engineers judge whether an effect really helps.',
        },
      },
    },
    {
      kind: 'predict', concept: 'timing-tempo',
      instruction: 'Keep "Sync to studio clock" ticked (Studio tab), then change the tempo in the top bar and press Test sound.',
      predict: {
        question: 'The echo is set to a dotted 8th, synced. What happens to the repeats when the tempo goes up?',
        options: ['They get closer together and stay on the beat', 'They stay the same length', 'They stop'], answer: 0,
        explain: 'A synced delay takes its time from the tempo: a dotted 8th is three quarters of a beat, so a faster beat means shorter gaps. The host sends the tempo to the plugin as transport events.',
      },
      check: synced,
      principle: 'A synced delay sets its time from the tempo, so the repeats always fit the beat.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'At 120 BPM, an echo set to 1/8 repeats every…',
        options: ['250 ms', '500 ms', '125 ms'], answer: 0,
        explain: 'A beat is 500 ms at 120 BPM, and an 8th note is half a beat. A 1/16 echo would repeat every 125 ms.',
      },
    },
    {
      kind: 'challenge', concept: 'effects', focus: ['window'],
      instruction: 'Make a subtle echo for a lead: a few quiet repeats under a mostly dry sound. Close the plugin window to keep it.',
      checklist: [
        { text: 'Feedback 35% or less (a few repeats)', check: s => w(s).url === BUILTIN_ECHO && st(s, 'feedback', 0.42) <= 0.35 },
        { text: 'Mix 30% or less (mostly dry)', check: s => w(s).url === BUILTIN_ECHO && st(s, 'mix', 0.35) <= 0.3 },
      ],
      hints: ['Open plugin window: Feedback and Mix are sliders.', 'Feedback sets how many repeats; Mix how loud they are.', 'Close the window to save it with the project.'],
      solution: { data: echo({ ...ECHO_DEFAULT, feedback: 0.28, mix: 0.22 }) },
    },
    {
      kind: 'challenge', concept: 'signal-routing',
      instruction: 'Put a real instrument through it: in the Studio tab, tap another instrument\'s output, then this plugin\'s IN.',
      checklist: [{ text: 'A cable into this plugin\'s IN', check: cableIn }],
      hints: ['An Audio input\'s OUT L, a twin\'s output, or another plugin\'s OUT all work.', 'Tap a jack, then the other jack: the cable appears.', 'No other instrument? Press Skip: Test sound did the same job.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why sync a delay to the studio tempo?',
        model: 'So its repeats fall on notes of the beat, like 8ths or dotted 8ths, and stay in time when the tempo changes, instead of clashing with the groove.',
      },
    },
  ],
  review: [
    { question: 'BYPASS on an effect…', options: ['Passes the sound through unchanged', 'Mutes it', 'Doubles it'], answer: 0, explain: 'For before/after comparisons.' },
    { question: 'A 1/8 echo at 120 BPM repeats every…', options: ['250 ms', '500 ms', '1 s'], answer: 0, explain: 'Half of a 500 ms beat.' },
    { question: 'Feedback on a delay sets…', options: ['How many repeats you hear', 'The delay time', 'The pitch'], answer: 0, explain: 'More feedback, more repeats.' },
  ],
};

// ============================================================================
// 4. Plugins and hardware
// ============================================================================

const l4: Lesson = {
  id: 'wam-plugin-4-hardware', device: 'wam-plugin', path: 'foundations', order: O(4), difficulty: 'intermediate',
  name: 'Plugins and hardware',
  description: 'The same signal flow in software and hardware, and where each one wins: latency, recall, instances, hands-on control.',
  objective: 'Compare plugins with hardware: signal flow, latency, recall and how many you can run.',
  source: SOURCE, estimatedMinutes: 6,
  prerequisites: ['wam-plugin-3-effects'],
  concepts: ['signal-routing', 'effects'],
  start: { values: { bypass: false } },
  steps: [
    {
      kind: 'info', concept: 'signal-routing',
      instruction: 'A plugin and a hardware box do the same jobs, so the signal flow is the same: notes into an instrument, its sound into effects, then the mixer.',
      principle: 'Signal flow is the same in software and hardware: source, processing, mixer.',
      explanation: 'A delay pedal and Studio Echo both take audio in and send audio out; a hardware synth and Studio Mono both take notes in.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Which one makes its sound with no round trip through your audio interface?',
        options: ['A plugin: its sound is made inside the computer', 'A hardware synth monitored through the studio', 'Both the same'], answer: 0,
        explain: 'A plugin\'s audio is already in the computer, so only the output latency remains. A hardware synth\'s sound must come back in through the interface first.',
      },
    },
    {
      kind: 'predict', concept: 'effects', focus: ['choose'],
      instruction: 'Load Studio Echo here (Change… if something is loaded).',
      predict: {
        question: 'You need an echo on three different instruments. With plugins you…',
        options: ['Load three instances, each with its own settings', 'Need three computers', 'Can only use one'], answer: 0,
        explain: 'Each Web Audio plugin slot is its own instance: add more from Instruments… and each keeps its own settings. With hardware you would need three boxes, or a mixer\'s send.',
      },
      check: s => w(s).url === BUILTIN_ECHO,
      solution: { data: echo() },
      principle: 'Software instances are as many copies as your computer can run.',
    },
    {
      kind: 'info', concept: 'effects',
      instruction: 'Save the project and open it again: the plugin comes back exactly as you left it. A hardware synth needs its patch saved on the synth, or a program change.',
      principle: 'Plugins give total recall; hardware recalls only what it stores itself.',
      explanation: 'Hardware has its own strengths: knobs under your hands, no load on the computer, and the character of its circuits.',
    },
    {
      kind: 'challenge', concept: 'effects', focus: ['window'],
      instruction: 'Set this slot up like a hardware delay on MIDI clock: Studio Echo, synced to the studio, with repeats you can clearly hear.',
      checklist: [
        { text: 'Studio Echo loaded', check: s => w(s).url === BUILTIN_ECHO },
        { text: 'Sync to studio clock on (Studio tab)', check: synced },
        { text: 'Feedback at least 30% and Mix at least 20%', check: s => st(s, 'feedback', 0.42) >= 0.3 && st(s, 'mix', 0.35) >= 0.2 },
      ],
      hints: ['Its settings are in the plugin window: close it to save them.', 'Sync is the tick box next to it in the Studio tab.', 'The default settings already pass; try a dotted 8th.'],
      solution: { data: echo({ ...ECHO_DEFAULT, feedback: 0.45, mix: 0.35 }) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Name one thing hardware does better and one thing plugins do better.',
        model: 'Hardware: hands-on controls, its own sound and no load on the computer. Plugins: as many instances as you like, total recall with the project, and no round trip through the interface.',
      },
    },
  ],
  review: [
    { question: 'Signal flow in software and hardware is…', options: ['The same: source, processing, mixer', 'Completely different', 'Reversed'], answer: 0, explain: 'The jobs are the same.' },
    { question: 'Plugins have no input round trip because…', options: ['Their audio is made inside the computer', 'They are faster', 'They use MIDI'], answer: 0, explain: 'Only hardware audio has to come back in.' },
    { question: 'Total recall means…', options: ['Every setting comes back with the project', 'The plugin remembers your playing', 'Undo works'], answer: 0, explain: 'The host saves the plugin\'s state.' },
    { question: 'Running three echoes on three instruments takes…', options: ['Three plugin instances', 'Three computers', 'One echo only'], answer: 0, explain: 'Each instance has its own settings.' },
  ],
};

export const WAM_PLUGIN_LESSONS: Lesson[] = [l1, l2, l3, l4];
