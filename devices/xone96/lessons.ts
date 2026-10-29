// ============================================================================
// Xone:96 lessons (v2, docs/PEDAGOGY.md) - DJ mixing and studio mixing from
// first principles.
//
// Paths: foundations (signal flow -> gain -> EQ -> filters -> crossfader ->
// sends -> cue), performance (phrasing, transitions, a full blend), ear
// training (graded: one band wide -> mid bands finer -> filter type and cutoff
// -> over-gain interleaved with EQ), studio (route instruments in, balance a
// full track, mix down your jam).
//
// Order: Xone lessons use orders below 1 so the device path comes before the
// shared studio curriculum (orders 1-5); the Xone studio lessons (orders 6-8)
// follow "Into the mixer".
//
// EQ knob values: -1 = full kill / max cut, 0 = flat (centre), +1 = max boost.
// HI / LO -6 dB = -0.29. Mid bands: -0.5 = -13.5 dB, +1 = +10 dB.
// ============================================================================

import type { Lesson, LessonCheckState, LessonStep } from '@/types';
import { SRC } from './model';

const O = (n: number) => n / 100;

const REF = {
  inputs: 'User Guide p.8, p.10 – Input select',
  gain: 'User Guide p.8, p.10 – Channel GAIN and PK!',
  eq: 'User Guide p.8, p.10 – Channel EQ',
  meters: 'User Guide p.9, p.11 – Channel meters',
  fader: 'User Guide p.11–12 – Channel faders and the CHANNEL FADER curve',
  xfader: 'User Guide p.11–12 – XFADER assign and curve',
  filter: 'User Guide p.13–14 – Xone:VCF filter sections',
  sends: 'User Guide p.8, p.10 – SEND 1 / SEND 2',
  master: 'User Guide p.16 – LR MIX meters, MASTER 1 / MASTER 2',
  cue: 'User Guide p.9, p.17 – CUE and the MONITOR section',
  twin: 'Twin only – the deck strip above the mixer',
  studio: 'Synth Studio – Studio tab, instrument Output',
};

// ---------------------------------------------------------------- helpers

const num = (s: LessonCheckState, id: string) => Number(s.values[id] ?? 0);
const NO_BOOST = ['ch1_hi', 'ch1_himid', 'ch1_lomid', 'ch1_lo', 'ch2_hi', 'ch2_himid', 'ch2_lomid', 'ch2_lo'];

/** Instances of a device in the rack */
const instancesOf = (s: LessonCheckState, device: string) => Object.entries(s.instances).filter(([, i]) => i.device === device).map(([id]) => id);
/** Is some instance of `device` routed into input `input` of a Xone:96? */
const routedTo = (s: LessonCheckState, device: string, input: string) =>
  instancesOf(s, device).some(id => {
    const r = s.routes[id];
    if (!r || r === 'master') return false;
    const [mixer, inp] = r.split(':');
    return inp === input && s.instances[mixer]?.device === 'xone96';
  });
/** Is some instance of `device` routed into any Xone:96 channel? */
const routedAnywhere = (s: LessonCheckState, device: string) =>
  instancesOf(s, device).some(id => {
    const r = s.routes[id];
    return !!r && r !== 'master' && s.instances[r.split(':')[0]]?.device === 'xone96';
  });
/** How many instruments feed a Xone:96 */
const routedCount = (s: LessonCheckState) =>
  Object.entries(s.routes).filter(([id, r]) => !!r && r !== 'master' && !!s.instances[id] && s.instances[r.split(':')[0]]?.device === 'xone96').length;

const play = (principle = 'A mixer only shapes and routes sound; something upstream has to make it.'): LessonStep => ({
  kind: 'do', control: 'play', targetValue: true, concept: 'signal-routing',
  instruction: 'Press PLAY in the deck strip above the mixer (or the Space bar).',
  principle,
  explanation: 'The built-in decks start together on one clock, in time and in the same key (A minor). If the Xone follows the studio clock, PLAY is the studio ▶.',
  manualReference: REF.twin,
});

const studioPlay: LessonStep = {
  kind: 'challenge', concept: 'timing-tempo',
  instruction: 'Press ▶ (Play studio) in the top bar so every instrument plays.',
  checklist: [{ text: 'Studio transport playing', check: s => s.transport.playing }],
  hints: ['The ▶ button sits in the top bar, next to the tempo.', 'Space works too while an instrument with a PLAY button is focused.'],
  solution: { transport: 'play' },
};

// ============================================================================
// FOUNDATIONS
// ============================================================================

const f1: Lesson = {
  id: 'xone96-signal-flow', device: 'xone96', path: 'foundations', order: O(1), difficulty: 'beginner',
  name: 'Signal flow: from deck to master',
  description: 'Follow one source through INPUT, the channel fader and MASTER 1, and see why the channel meter moves with the fader down.',
  objective: 'Send a deck through a channel to the master and read the pre-fader channel meter.',
  source: 'Synth Studio · Xone:96 User Guide, channel and master sections', estimatedMinutes: 6,
  concepts: ['signal-routing', 'mixing', 'gain-staging'],
  start: { reset: true, values: { ch1_src: SRC.TRACK_A, ch1_fader: 0 } },
  steps: [
    {
      ...play('A meter shows how strong a signal is; it can move before you hear anything.'),
      instruction: 'Press PLAY in the deck strip (or Space). Watch the channel 1 meter.',
      explanation: 'TRACK A is playing into channel 1, but its fader is down, so you hear nothing yet. The meter beside the EQ still moves.',
    },
    {
      kind: 'predict', control: 'ch1_fader', targetValue: 10, concept: 'mixing',
      instruction: 'Push the channel 1 fader all the way up.',
      predict: {
        question: 'The channel meter is already moving. What happens when the fader goes up?',
        options: ['You hear TRACK A, and the channel meter stays the same', 'The channel meter jumps higher', 'Nothing: the master is off'], answer: 0,
        explain: 'The channel meter reads before the fader (after GAIN and EQ), so it does not change. The fader decides how much reaches the LR MIX, and the LR MIX meters on the right jump up.',
      },
      principle: 'A fader is a variable attenuator after the meter: fully up is unity, fully down is silence.',
      manualReference: REF.meters,
    },
    {
      kind: 'predict', control: 'ch1_input', targetValue: 0, concept: 'signal-routing',
      instruction: 'Set channel 1 INPUT to USB 1.',
      predict: {
        question: 'No audio file is loaded on USB 1. What will you hear?',
        options: ['Silence: nothing is plugged into that input', 'TRACK A, as before', 'The deck on channel 2'], answer: 0,
        explain: 'The input switch picks which socket feeds the channel. USB 1 is the computer input, and nothing is playing on it, so the channel goes quiet however high the fader is.',
      },
      principle: 'An input selector is the first switch in the chain: wrong position, no signal.',
      manualReference: REF.inputs,
    },
    {
      kind: 'do', control: 'ch1_input', targetValue: 2, concept: 'signal-routing',
      instruction: 'Set INPUT back to LINE.',
      principle: 'Every stage in a path multiplies the signal; one stage at zero silences the whole path.',
      explanation: 'LINE hears the built-in deck here. In the studio, an instrument routed to this channel arrives on LINE instead.',
      manualReference: REF.inputs,
    },
    {
      kind: 'predict', control: 'master', targetValue: 6, concept: 'gain-staging',
      instruction: 'Turn MASTER 1 down to about 6. Watch the LR MIX meters.',
      predict: {
        question: 'Will the LR MIX meters drop when you turn MASTER 1 down?',
        options: ['No: they read the mix before MASTER 1', 'Yes, by the same amount', 'They switch off'], answer: 0,
        explain: 'On the Xone:96 the LR MIX meters show the mix bus before the master control. MASTER 1 only sets how hard the mix drives the amplifier, so it gets quieter while the meters stay put.',
      },
      principle: 'The master sets the output level, not the balance inside the mix.',
      manualReference: REF.master,
    },
    {
      kind: 'do', control: 'master', targetValue: 8, concept: 'gain-staging',
      instruction: 'Set MASTER 1 back to 8, its unity mark.',
      principle: 'Unity gain means the level out equals the level in.',
      explanation: 'On Xone mixers MASTER 1 reaches unity at about 3 o\'clock, two notches below the top (8 on this dial). Fully up adds 6 dB.',
      manualReference: REF.master,
    },
    {
      kind: 'listen', concept: 'mixing', focus: ['ch1_fader'],
      instruction: 'Compare the fader fully up with the fader halfway.',
      listen: {
        a: { ch1_fader: 10 }, b: { ch1_fader: 5 }, labels: ['Fader at 10', 'Fader at 5'],
        question: {
          question: 'How much quieter is halfway on the CONST PWR fader curve?',
          options: ['Much quieter: about -22 dB', 'Exactly half as loud (-6 dB)', 'The same'], answer: 0,
          explain: 'The CONST PWR channel curve spreads its change over the whole travel, a few dB per step: 7.5 is already about -12 dB and halfway about -22 dB (the guide\'s curve graph). That is why DJs match loudness with GAIN and ride the faders near the top.',
        },
      },
      manualReference: REF.fader,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'gain-staging',
      quiz: {
        question: 'Where does a Xone:96 channel meter read the signal?',
        options: ['After GAIN and EQ, before the fader', 'After the fader', 'After MASTER 1'], answer: 0,
        explain: 'Post-GAIN, post-EQ, pre-fader: you can set and check a channel before anyone hears it. The LR MIX meters read the summed mix, also before MASTER 1.',
      },
    },
    {
      kind: 'challenge', concept: 'mixing', focus: ['ch2_fader'],
      instruction: 'Add a second channel: put DRUMS on channel 2 (deck strip) and set its fader so the drums sit under TRACK A.',
      checklist: [
        { text: 'Channel 2 plays DRUMS', check: s => num(s, 'ch2_src') === SRC.DRUMS },
        { text: 'Channel 2 fader between 4 and 9', check: s => num(s, 'ch2_fader') >= 4 && num(s, 'ch2_fader') <= 9 },
        { text: 'Channel 2 INPUT on LINE or PHONO', check: s => num(s, 'ch2_input') === 1 || num(s, 'ch2_input') === 2 },
      ],
      hints: ['The DECK → CH 2 menu is in the dark strip above channel 2.', 'Pick DRUMS, then raise the channel 2 fader.', 'Try the fader at about 7.'],
      solution: { values: { ch2_src: SRC.DRUMS, ch2_fader: 7 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does the channel meter keep moving when the fader is down?',
        model: 'Because it reads the signal before the fader, so you can check and set a channel\'s level before anyone hears it.',
      },
    },
  ],
  review: [
    { question: 'A Xone:96 channel meter reads…', options: ['After GAIN and EQ, before the fader', 'After the fader', 'After MASTER 1'], answer: 0, explain: 'Pre-fader, so you can set levels silently.' },
    { question: 'INPUT is on USB 1 with no file loaded. You hear…', options: ['Silence', 'The built-in deck', 'The master'], answer: 0, explain: 'Wrong input, no signal.' },
    { question: 'Turning MASTER 1 down changes…', options: ['The output level, not the LR MIX meters', 'The LR MIX meters', 'The channel meters'], answer: 0, explain: 'The meters read before MASTER 1.' },
    { question: 'A channel fader fully up means…', options: ['Unity gain', '+10 dB', 'Mute'], answer: 0, explain: 'Off at the bottom, unity at the top.' },
  ],
};

const f2: Lesson = {
  id: 'xone96-gain-staging', device: 'xone96', path: 'foundations', order: O(2), difficulty: 'beginner',
  name: 'Gain staging: GAIN first, then the fader',
  description: 'Set input gain with the meters before the fader comes up, find the headroom, and hear what clipping does.',
  objective: 'Set GAIN so a channel averages around 0 with peaks near +6, and match two tracks by meter.',
  source: 'Synth Studio · Xone:96 User Guide, GAIN and metering', estimatedMinutes: 7,
  prerequisites: ['xone96-signal-flow'],
  concepts: ['gain-staging', 'mixing'],
  start: { reset: true, values: { ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, ch2_fader: 0 } },
  steps: [
    play('Gain staging means setting a healthy level at every stage, starting at the input.'),
    {
      kind: 'predict', control: 'ch2_gain', targetValue: -40, concept: 'gain-staging',
      instruction: 'TRACK B plays into channel 2 with its fader down. Turn channel 2 GAIN fully anticlockwise (-∞).',
      predict: {
        question: 'Where is GAIN in the channel?',
        options: ['First, right after the input switch', 'After the fader', 'On the master'], answer: 0,
        explain: 'GAIN is the first stage after the input. The channel 2 meter goes dark because nothing passes GAIN at -∞, even though TRACK B is still playing.',
      },
      principle: 'Gain is multiplication: at zero, nothing reaches the rest of the channel.',
      manualReference: REF.gain,
    },
    {
      kind: 'do', control: 'ch2_gain', targetValue: 0, concept: 'gain-staging',
      instruction: 'Bring channel 2 GAIN back to 0 dB. Its meter averages around 0, with peaks near +6.',
      principle: 'Decibels are logarithmic: +6 dB roughly doubles the amplitude, -6 dB halves it.',
      explanation: 'That is the level the manual asks for: average around 0 and peaks around +6, leaving room above for EQ boosts and loud moments.',
      manualReference: REF.meters,
    },
    {
      kind: 'predict', control: 'ch2_gain', targetValue: 10, concept: 'gain-staging',
      instruction: 'Turn channel 2 GAIN up to +10 dB and watch the top of its meter and the PK! LED beside GAIN.',
      predict: {
        question: 'What will the meter show?',
        options: ['The +10 LED and the PK! LED flash: little headroom is left', 'It stays the same', 'It switches off'], answer: 0,
        explain: '+10 dB of gain lifts the peaks to around +16 dBu, close to the channel\'s +20 dBu ceiling. PK! sits right after GAIN and warns you (the twin lights it from +15 dBu); the guide\'s fix for a lit PK! is to turn that channel\'s GAIN down.',
      },
      principle: 'Headroom is the space between your normal level and the point where the circuit clips.',
      manualReference: REF.gain,
    },
    {
      kind: 'do', control: 'ch2_lo', targetValue: 1, concept: 'gain-staging',
      instruction: 'With GAIN still at +10, turn channel 2 LO fully clockwise (+6 dB).',
      principle: 'EQ boosts add energy, so they raise the level just as gain does.',
      explanation: 'The meter reads after the EQ, so the bass boost pushes the kick peaks into the +20 dBu ceiling. They get squashed flat: that is clipping. PK! reads before the EQ, so it doesn\'t change - the meter\'s +10 LED is the one that shows the boost.',
      manualReference: REF.eq,
    },
    {
      kind: 'listen', concept: 'gain-staging', focus: ['ch2_gain', 'ch2_lo'],
      instruction: 'Compare clean and over-driven at the same loudness (B has MASTER 1 turned down to make up).',
      listen: {
        a: { ch2_gain: 0, ch2_lo: 0, ch2_fader: 10, ch1_fader: 0, master: 8 },
        b: { ch2_gain: 10, ch2_lo: 1, ch2_fader: 10, ch1_fader: 0, master: 5.3 },
        labels: ['Clean', 'Over-driven'],
        question: {
          question: 'Apart from loudness, what gives the over-driven one away?',
          options: ['A harsh, crunchy edge on the kick and bass', 'More reverb', 'A lower pitch'], answer: 0,
          explain: 'Clipping flattens the tops of the loudest waves, which adds harmonics that were never in the music. Matching the loudness lets you hear the damage instead of just "louder".',
        },
      },
    },
    {
      kind: 'do', control: 'ch2_lo', targetValue: 0, concept: 'equalization',
      instruction: 'Return channel 2 LO to the centre.',
      principle: 'A flat EQ, with every knob centred, passes the sound unchanged.',
      manualReference: REF.eq,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'gain-staging',
      quiz: {
        question: 'Why match two tracks\' meters with GAIN before you blend?',
        options: ['So the same fader position means the same loudness and the blend stays even', 'It makes their tempos match', 'It stops the EQ working'], answer: 0,
        explain: 'Records are mastered at different levels. Matching them at GAIN means you can blend with the faders fully up, and neither track jumps out. Tempo is set by the decks, not GAIN.',
      },
    },
    {
      kind: 'challenge', concept: 'gain-staging', focus: ['ch2_gain', 'ch2_fader'],
      instruction: 'TRACK B is a little hotter than TRACK A. Match channel 2 to channel 1 by meter, then bring its fader up.',
      checklist: [
        { text: 'Channel 2 GAIN between -4 and 0 dB', check: s => num(s, 'ch2_gain') >= -4 && num(s, 'ch2_gain') <= 0 },
        { text: 'Channel 2 fader up (8 or more)', check: s => num(s, 'ch2_fader') >= 8 },
        { text: 'No EQ boosts on channel 2', check: s => ['ch2_hi', 'ch2_himid', 'ch2_lomid', 'ch2_lo'].every(c => num(s, c) <= 0.05) },
      ],
      hints: ['Compare the two channel meters with both playing.', 'TRACK B reads about 1.5 dB higher.', 'Set channel 2 GAIN to about -1.5 dB, then its fader to 10.'],
      solution: { values: { ch2_gain: -1.5, ch2_fader: 10, ch2_lo: 0 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why set GAIN before touching the fader?',
        model: 'GAIN sets how hot the signal runs inside the mixer. Setting it first, by the meter, leaves headroom and makes every fader position mean the same loudness.',
      },
    },
  ],
  review: [
    { question: 'The manual\'s target for a channel meter is…', options: ['Average about 0, peaks about +6', 'Always on +10', 'As low as possible'], answer: 0, explain: 'Room for peaks and boosts.' },
    { question: 'The PK! LED beside a channel\'s GAIN lights. You turn down…', options: ['That channel\'s GAIN', 'Its fader', 'MASTER 1'], answer: 0, explain: 'PK! reads right after GAIN, before the EQ. If the meter\'s +10 LED stays lit, take back GAIN or an EQ boost.' },
    { question: 'EQ boosts…', options: ['Raise the level, just like gain', 'Never change the level', 'Lower the level'], answer: 0, explain: 'They add energy.' },
    { question: 'Clipping sounds…', options: ['Harsh and crunchy', 'Muffled', 'Slower'], answer: 0, explain: 'Flattened peaks add harmonics.' },
  ],
};

const f3: Lesson = {
  id: 'xone96-eq-fundamentals', device: 'xone96', path: 'foundations', order: O(3), difficulty: 'beginner',
  name: 'The four EQ bands',
  description: 'What lives in LO, LO MID, HI MID and HI - and what a kill takes away.',
  objective: 'Name what each of the four EQ bands holds and hear it go with a kill or a cut.',
  source: 'Synth Studio · Xone:96 User Guide, 4-band EQ', estimatedMinutes: 7,
  prerequisites: ['xone96-gain-staging'],
  concepts: ['equalization'],
  start: { reset: true, values: { ch1_src: SRC.FULL } },
  steps: [
    play('Every sound is a mix of frequencies, from low rumbles to high sizzle.'),
    {
      kind: 'predict', control: 'ch1_lo', targetValue: -1, concept: 'equalization', scope: 'spectrum',
      instruction: 'Turn channel 1 LO fully anticlockwise, to KILL. Watch the left end of the spectrum.',
      predict: {
        question: 'FULL MIX is a whole band. Which parts will disappear?',
        options: ['The kick\'s thump and the bassline', 'The hi-hats', 'The chords'], answer: 0,
        explain: 'LO covers everything below about 180 Hz: the kick and the bass notes. Hats and chords live higher, so they stay.',
      },
      principle: 'Pitch is frequency: drum thumps and low notes sit below about 180 Hz.',
      manualReference: REF.eq,
    },
    {
      kind: 'do', control: 'ch1_lo', targetValue: 0, concept: 'equalization',
      instruction: 'Bring LO back to the centre.',
      principle: 'A kill is a filter at the band\'s edge: what it removes comes straight back when you open it.',
    },
    {
      kind: 'predict', control: 'ch1_hi', targetValue: -1, concept: 'equalization', scope: 'spectrum',
      instruction: 'Now kill HI (fully anticlockwise).',
      predict: {
        question: 'What goes this time?',
        options: ['The hats, the shaker and the sparkle on top', 'The kick', 'Everything'], answer: 0,
        explain: 'HI covers above about 3 kHz: hats, shakers and the air and edge of every sound. What is left sounds dull, as if a door were shut.',
      },
      principle: 'High frequencies carry sizzle, air and the sharp starts of sounds.',
      manualReference: REF.eq,
    },
    {
      kind: 'do', control: 'ch1_hi', targetValue: 0, concept: 'equalization',
      instruction: 'Bring HI back to the centre.',
      principle: 'Centre is 0 dB on every band of the Xone EQ.',
    },
    {
      kind: 'do', control: 'ch1_lomid', targetValue: -1, concept: 'equalization', scope: 'spectrum',
      instruction: 'Cut LO MID (350 Hz) all the way: -27 dB.',
      principle: 'Low mids give a sound body and warmth; too much of them sounds muddy.',
      explanation: 'The bass and chords get thinner but stay. The mid bands cut -27 dB but never fully kill, and they can boost +10 dB: the "asymmetric" Xone EQ.',
      manualReference: REF.eq,
    },
    {
      kind: 'do', control: 'ch1_lomid', targetValue: 0, concept: 'equalization',
      instruction: 'Bring LO MID back to the centre.',
      principle: 'Cuts are easier on the ear than boosts: they remove clutter instead of adding level.',
    },
    {
      kind: 'listen', concept: 'equalization', focus: ['ch1_himid'], scope: 'spectrum',
      instruction: 'Compare flat with HI MID (1.1 kHz) cut.',
      listen: {
        a: { ch1_himid: 0 }, b: { ch1_himid: -1 }, labels: ['Flat', 'HI MID cut'],
        question: {
          question: 'What did the HI MID cut take away?',
          options: ['The crack of the clap and the bite of the chords', 'The kick\'s thump', 'The hi-hat sizzle'], answer: 0,
          explain: 'Around 1 kHz is where presence lives: snare crack, vocal clarity and the attack of synths. The kick sits much lower and the hats much higher.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'equalization',
      quiz: {
        question: 'A kick drum\'s thump is mostly in which band?',
        options: ['LO, below 180 Hz', 'HI MID, around 1.1 kHz', 'HI, above 3 kHz'], answer: 0,
        explain: 'The thump is 40-100 Hz. The click of the beater is higher (2-4 kHz), which is why a kick with HI killed still thumps.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: one band is killed in the target. Recreate it.', concept: 'equalization',
      setup: { ch1_hi: 0, ch1_lo: 0 },
      match: { target: { ch1_hi: -1, ch1_lo: 0 }, controls: ['ch1_hi', 'ch1_lo'] },
      hints: ['Listen for the kick, then for the hats.', 'The kick is there; the sizzle is not.', 'Kill HI, leave LO.'],
    },
    {
      kind: 'challenge', concept: 'equalization', scope: 'spectrum',
      instruction: 'Make channel 1 sound like it is playing in the next room: dull and muffled, but with the bass still there.',
      checklist: [
        { text: 'The top is gone (HI at -12 dB or lower)', check: s => num(s, 'ch1_hi') <= -0.5 },
        { text: 'The bass is still there (LO no lower than -3 dB)', check: s => num(s, 'ch1_lo') >= -0.15 },
      ],
      hints: ['Which band holds the "air"?', 'Turn HI well down; keep LO near the centre.', 'HI fully down, HI MID a little down too.'],
      solution: { values: { ch1_hi: -1, ch1_himid: -0.4, ch1_lo: 0 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What lives in LO, LO MID, HI MID and HI?',
        model: 'LO: kick and bass. LO MID: body and warmth. HI MID: crack, bite and voices. HI: hats and air.',
      },
    },
  ],
  review: [
    { question: 'LO on the Xone:96 covers…', options: ['Below 180 Hz', 'Around 1.1 kHz', 'Above 3 kHz'], answer: 0, explain: 'Kick and bass.' },
    { question: 'Killing HI removes…', options: ['Hats and air', 'The kick', 'Nothing'], answer: 0, explain: 'Everything above about 3 kHz.' },
    { question: 'The Xone:96 mid bands can…', options: ['Cut -27 dB and boost +10 dB', 'Kill completely', 'Only boost'], answer: 0, explain: 'The asymmetric EQ.' },
    { question: 'A muddy blend usually has too much…', options: ['LO MID', 'HI', 'Reverb'], answer: 0, explain: 'Body piles up around 200-500 Hz.' },
  ],
};

const f4: Lesson = {
  id: 'xone96-low-end-clash', device: 'xone96', path: 'foundations', order: O(4), difficulty: 'intermediate',
  name: 'Cut, don\'t boost: kick vs bass',
  description: 'Two sounds in the same band mask each other. Make room with cuts instead of boosts.',
  objective: 'Give a kick and a bassline their own space by cutting, not boosting.',
  source: 'Synth Studio · mixing practice', estimatedMinutes: 7,
  prerequisites: ['xone96-eq-fundamentals'],
  concepts: ['equalization', 'mixing', 'gain-staging'],
  start: { reset: true, values: { ch1_src: SRC.DRUMS, ch2_src: SRC.BASS } },
  steps: [
    play('Two sounds in the same frequency range compete, and the louder one masks the other.'),
    {
      kind: 'listen', concept: 'mixing', focus: ['ch2_fader'],
      instruction: 'Compare the drums alone with drums and bass together.',
      listen: {
        a: { ch2_fader: 0 }, b: { ch2_fader: 10 }, labels: ['Drums alone', 'Drums + bass'],
        question: {
          question: 'With the bass added, what happens to the kick\'s thump?',
          options: ['It blurs: both fight for the low end', 'It gets brighter', 'Nothing changes'], answer: 0,
          explain: 'The kick and the bass notes both sit below about 180 Hz. Your ear cannot separate two loud sounds in the same band - that is masking.',
        },
      },
    },
    {
      kind: 'predict', control: 'ch2_lo', targetValue: 1, concept: 'equalization',
      instruction: 'Try the obvious fix: turn channel 2 LO up to +6 dB to make the bass stand out.',
      predict: {
        question: 'What will boosting the bass do?',
        options: ['The low end gets boomier and the kick blurs even more', 'The kick gets clearer', 'The bass gets quieter'], answer: 0,
        explain: 'A boost adds even more energy exactly where the clash is. It also eats headroom: watch channel 2\'s meter climb.',
      },
      principle: 'Boosting adds level where the clash is; it rarely creates space.',
      manualReference: REF.eq,
    },
    {
      kind: 'do', control: 'ch2_lo', targetValue: -0.29, concept: 'equalization', scope: 'spectrum',
      instruction: 'Now cut instead: set channel 2 LO to about -6 dB.',
      principle: 'Cutting a clashing band makes room without adding level or distortion.',
      explanation: 'The bass keeps its notes (the harmonics above 180 Hz) but gives the kick\'s thump room.',
      manualReference: REF.eq,
    },
    {
      kind: 'do', control: 'ch1_lomid', targetValue: -0.5, concept: 'equalization',
      instruction: 'Cut channel 1 LO MID to about -14 dB, so the drums leave the bass its warmth.',
      principle: 'Give each sound its own band: cut each one where the other lives.',
      manualReference: REF.eq,
    },
    {
      kind: 'listen', concept: 'equalization', focus: ['ch2_lo', 'ch1_lomid'], scope: 'spectrum',
      instruction: 'Compare the boosted version with the carved one.',
      listen: {
        a: { ch2_lo: 1, ch1_lomid: 0 }, b: { ch2_lo: -0.29, ch1_lomid: -0.5 }, labels: ['Boosted', 'Carved'],
        question: {
          question: 'Which one lets you hear both the kick and the bass clearly?',
          options: ['Carved: the cuts made room for both', 'Boosted: louder is clearer', 'They are the same'], answer: 0,
          explain: 'Carving gives each part its own frequency range. The boosted one is louder, and louder always sounds "better" for a moment, but the kick and bass are still smeared together.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'gain-staging',
      quiz: {
        question: 'Why do DJs and mix engineers cut more often than they boost?',
        options: ['Cuts make room without eating headroom; boosts add level and can clip', 'Boosting is impossible on the Xone:96', 'Cuts keep the tracks in time'], answer: 0,
        explain: 'The Xone can boost, +6 dB on HI/LO and +10 dB on the mids, but every boost uses up headroom. A cut solves masking by removing the clash instead of shouting over it.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: in the target only one channel carries the low end. Which one?', concept: 'equalization',
      setup: { ch1_lo: 0, ch2_lo: 0, ch1_lomid: 0 },
      match: { target: { ch1_lo: 0, ch2_lo: -1, ch1_lomid: 0 }, controls: ['ch1_lo', 'ch2_lo'] },
      hints: ['Is the kick still thumping?', 'The bassline has lost its bottom.', 'Channel 2 LO is killed; channel 1 LO is flat.'],
    },
    {
      kind: 'challenge', concept: 'equalization',
      instruction: 'Make the kick punch through the bass without boosting anything.',
      checklist: [
        { text: 'The kick keeps its low end (channel 1 LO at 0 dB or near)', check: s => num(s, 'ch1_lo') >= -0.1 },
        { text: 'The bass gives up some lows (channel 2 LO cut)', check: s => num(s, 'ch2_lo') <= -0.2 },
        { text: 'No boosts on either channel', check: s => NO_BOOST.every(c => num(s, c) <= 0.05) },
      ],
      hints: ['Which channel should give up its lowest lows?', 'Cut channel 2 LO; leave channel 1 LO flat.', 'Channel 2 LO about -6 dB, channel 1 LO MID a little down.'],
      solution: { values: { ch1_lo: 0, ch2_lo: -0.35, ch1_lomid: -0.4, ch2_lomid: 0, ch1_himid: 0, ch2_himid: 0, ch1_hi: 0, ch2_hi: 0 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do you give a kick and a bassline their own space?',
        model: 'Cut the bass\'s lowest lows (or the drums\' low mids) so each sits in its own band, instead of boosting either one.',
      },
    },
  ],
  review: [
    { question: 'Kick and bass blur together because…', options: ['They share the low frequencies', 'Their tempos differ', 'The filter is on'], answer: 0, explain: 'Masking in the same band.' },
    { question: 'LO at -6 dB means…', options: ['Half the amplitude below 180 Hz', 'A full kill', 'A boost'], answer: 0, explain: '-6 dB is about half.' },
    { question: 'Boosting the bass to fix a clash usually…', options: ['Makes the low end boomier and eats headroom', 'Makes the kick clearer', 'Changes the key'], answer: 0, explain: 'More energy in the clash.' },
    { question: 'Carving means…', options: ['Cutting one sound where another needs space', 'Boosting everything', 'Raising MASTER 1'], answer: 0, explain: 'Each part gets its own band.' },
  ],
};

const f5: Lesson = {
  id: 'xone96-filter-sweeps', device: 'xone96', path: 'foundations', order: O(5), difficulty: 'intermediate',
  name: 'The Xone:VCF filters',
  description: 'Assign a channel to FILTER 1, switch it ON, and sweep HPF, BPF and LPF with FREQ, RES and CRUNCH.',
  objective: 'Route a channel through a Xone:VCF and shape it with type, FREQ, RES and CRUNCH.',
  source: 'Synth Studio · Xone:96 User Guide, Xone:VCF sections', estimatedMinutes: 8,
  prerequisites: ['xone96-eq-fundamentals'],
  concepts: ['filter-type', 'filter-cutoff', 'filter-resonance'],
  start: { reset: true, values: { ch1_src: SRC.FULL } },
  steps: [
    play(),
    {
      kind: 'do', control: 'ch1_filter', targetValue: 0, concept: 'signal-routing',
      instruction: 'Set channel 1\'s FILTER switch to 1.',
      principle: 'An assign switch routes a channel through a shared processor.',
      explanation: 'Nothing changes yet: FILTER 1 is OFF, and an assigned channel passes straight through until it is switched on.',
      manualReference: REF.filter,
    },
    {
      kind: 'do', control: 'f1_on', targetValue: true, concept: 'filter-type',
      instruction: 'Press FILTER 1 ON. It lights blue.',
      principle: 'A high-pass filter at its lowest setting lets everything through.',
      explanation: 'FILTER 1 starts as a high-pass (HPF) at 20 Hz, below anything you can hear, so it still sounds the same.',
      manualReference: REF.filter,
    },
    {
      kind: 'predict', control: 'f1_freq', targetValue: 800, concept: 'filter-cutoff', scope: 'spectrum',
      instruction: 'Turn FILTER 1 FREQ up to about 800 Hz.',
      predict: {
        question: 'FILTER 1 is a high-pass. What will turning FREQ up do?',
        options: ['Remove the lows: the kick and bass thin out', 'Remove the highs', 'Lower the pitch'], answer: 0,
        explain: 'A high-pass passes what is above its cutoff and removes what is below. At 800 Hz the kick and bass are gone and the track sounds thin, like a phone.',
      },
      principle: 'A high-pass filter removes frequencies below its cutoff.',
      manualReference: REF.filter,
    },
    {
      kind: 'do', control: 'f1_res', targetValue: 8, concept: 'filter-resonance', scope: 'spectrum',
      instruction: 'Turn RES up towards WILD.',
      principle: 'Resonance feeds some of the filter\'s output back to its input, which boosts a band right at the cutoff.',
      explanation: 'A resonant peak rises at FREQ - about +7.6 dB at WILD on the guide\'s graphs, a strong colour but never a whistle. Sweep FREQ a little and the peak follows it: the classic Xone filter sweep.',
      manualReference: REF.filter,
    },
    {
      kind: 'do', control: 'f1_type', targetValue: 2, concept: 'filter-type',
      instruction: 'Press LPF.',
      principle: 'A low-pass filter removes frequencies above its cutoff, so the sound gets darker.',
      explanation: 'Same 800 Hz, opposite job: now the bass stays and the top is gone.',
      manualReference: REF.filter,
    },
    {
      kind: 'listen', concept: 'filter-type', focus: ['f1_type'], scope: 'spectrum',
      instruction: 'Compare HPF and LPF at the same FREQ.',
      listen: {
        a: { f1_type: 0, f1_res: 3 }, b: { f1_type: 2, f1_res: 3 }, labels: ['HPF at 800 Hz', 'LPF at 800 Hz'],
        question: {
          question: 'Which one sounds thin, like a phone speaker?',
          options: ['The HPF: only the top is left', 'The LPF', 'Neither'], answer: 0,
          explain: 'A phone speaker cannot reproduce bass, so a high-pass sounds like it. The low-pass keeps the bass and sounds muffled, like music through a wall.',
        },
      },
    },
    {
      kind: 'do', control: 'f1_crunch', targetValue: 5, concept: 'filter-type',
      instruction: 'Turn CRUNCH up to 5. Its red LED lights as it bites.',
      principle: 'Distortion adds new harmonics, so a sound gets grittier and seems louder.',
      explanation: 'CRUNCH drives the signal before the filter. It works only while the filter is ON.',
      manualReference: REF.filter,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-cutoff',
      quiz: {
        question: 'You want to build tension before the drop. Which filter, and which way?',
        options: ['HPF, FREQ slowly up', 'LPF, FREQ slowly up', 'BPF, FREQ fully down'], answer: 0,
        explain: 'A rising high-pass takes away more and more bass, so the track gets thin and tense. Snapping it back to 20 Hz on the downbeat brings the full track back: the drop. A rising low-pass does the opposite - it opens up.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: set the filter type and FREQ by ear.', concept: 'filter-type',
      setup: { f1_type: 2, f1_freq: 800, f1_res: 3, f1_crunch: 0 },
      match: { target: { f1_type: 0, f1_freq: 2000, f1_res: 3, f1_crunch: 0 }, controls: ['f1_type', 'f1_freq'] },
      hints: ['Is the bass there in the target?', 'It is a high-pass - and very thin.', 'HPF with FREQ around 2 kHz.'],
    },
    {
      kind: 'challenge', concept: 'filter-resonance',
      instruction: 'Build a dramatic riser: a singing high-pass with a little crunch that has cut most of the bass.',
      checklist: [
        { text: 'Channel 1 on FILTER 1, FILTER 1 ON', check: s => num(s, 'ch1_filter') === 0 && !!s.values.f1_on },
        { text: 'HPF', check: s => num(s, 'f1_type') === 0 },
        { text: 'FREQ at 300 Hz or higher', check: s => num(s, 'f1_freq') >= 300 },
        { text: 'RES at 5 or more', check: s => num(s, 'f1_res') >= 5 },
        { text: 'CRUNCH between 1 and 6', check: s => num(s, 'f1_crunch') >= 1 && num(s, 'f1_crunch') <= 6 },
      ],
      hints: ['Which filter type removes the bass?', 'HPF, then FREQ up and RES up.', 'HPF, FREQ about 600 Hz, RES 7, CRUNCH 3.'],
      solution: { values: { ch1_filter: 0, f1_on: true, f1_type: 0, f1_freq: 600, f1_res: 7, f1_crunch: 3 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What do FREQ and RES each do?',
        model: 'FREQ chooses where the filter cuts; RES boosts a narrow band right at that point, so the filter rings.',
      },
    },
  ],
  review: [
    { question: 'A channel assigned to FILTER 1 while FILTER 1 is OFF…', options: ['Passes through unfiltered', 'Goes silent', 'Gets distorted'], answer: 0, explain: 'OFF means not affected.' },
    { question: 'A high-pass filter…', options: ['Removes the lows', 'Removes the highs', 'Changes the tempo'], answer: 0, explain: 'It passes the highs.' },
    { question: 'RES near WILD…', options: ['Adds a resonant peak at the cutoff', 'Removes everything', 'Adds reverb'], answer: 0, explain: 'Output fed back to the input: about +7.6 dB at FREQ.' },
    { question: 'CRUNCH is…', options: ['Distortion before the filter', 'A delay', 'A second fader'], answer: 0, explain: 'Harmonic distortion, pre-filter.' },
  ],
};

const f6: Lesson = {
  id: 'xone96-crossfader', device: 'xone96', path: 'foundations', order: O(6), difficulty: 'beginner',
  name: 'The crossfader: assign and curves',
  description: 'Put channels on X and Y and choose the curve for smooth blends or sharp cuts.',
  objective: 'Assign channels to X and Y and pick the crossfader curve that suits blends or cuts.',
  source: 'Synth Studio · Xone:96 User Guide, XFADER', estimatedMinutes: 6,
  prerequisites: ['xone96-signal-flow'],
  concepts: ['dj-mixing', 'mixing'],
  start: { reset: true, values: { ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, xfader: 0 } },
  steps: [
    {
      ...play('Two full tracks at once clash; DJs bring one in while the other goes out.'),
      instruction: 'Press PLAY. Both tracks play at once - a mess, for now.',
    },
    {
      kind: 'do', control: 'ch1_xf', targetValue: 0, concept: 'dj-mixing',
      instruction: 'Set channel 1\'s XFADER switch to X.',
      principle: 'An assign switch connects a channel to one side of the crossfader.',
      explanation: 'The crossfader is hard left (X), so channel 1 plays at full level.',
      manualReference: REF.xfader,
    },
    {
      kind: 'predict', control: 'ch2_xf', targetValue: 2, concept: 'dj-mixing',
      instruction: 'Set channel 2\'s XFADER switch to Y.',
      predict: {
        question: 'The crossfader is fully on X. What happens to TRACK B?',
        options: ['It goes silent: the Y side is closed', 'It gets louder', 'Nothing'], answer: 0,
        explain: 'A crossfader is two linked faders: X fully open means Y fully closed. Channels on OFF ignore it.',
      },
      principle: 'A crossfader is a pair of linked faders: as one side opens, the other closes.',
      manualReference: REF.xfader,
    },
    {
      kind: 'do', control: 'xfader', targetValue: 5, concept: 'dj-mixing',
      instruction: 'Move the crossfader to the middle.',
      principle: 'A constant-power blend keeps the total loudness steady as two sounds swap.',
      explanation: 'On CONST PWR both sides are at -3 dB in the middle, so two tracks together are about as loud as one alone.',
      manualReference: REF.xfader,
    },
    {
      kind: 'listen', concept: 'dj-mixing', focus: ['xf_curve'],
      instruction: 'Compare two curves with the crossfader in the middle.',
      listen: {
        a: { xf_curve: 0, xfader: 5 }, b: { xf_curve: 1, xfader: 5 }, labels: ['CONST PWR', 'TRANSITION'],
        question: {
          question: 'In the middle, the TRANSITION curve sounds…',
          options: ['Louder: both tracks stay at full level', 'Quieter', 'Muted'], answer: 0,
          explain: 'TRANSITION holds both sides at full level across the middle; each side only fades in the last stretch of travel, close to the far end (the guide\'s curve graph). CONST PWR dips each side to about -3 dB in the middle.',
        },
      },
      manualReference: REF.xfader,
    },
    {
      kind: 'do', control: 'xf_curve', targetValue: 2, concept: 'dj-mixing',
      instruction: 'Set XFADER CURVE to FAST CUT.',
      principle: 'A sharp curve turns the crossfader into an on/off switch for cuts and scratching.',
      explanation: 'Both sides now stay at full level until the last few millimetres of travel, where the closing side cuts out almost at once.',
      manualReference: REF.xfader,
    },
    {
      kind: 'do', control: 'xfader', targetValue: 9.2, concept: 'dj-mixing',
      instruction: 'Slide the crossfader to about 9. Both tracks still play at full level.',
      principle: 'Cut-in distance is how far the fader travels before the far side opens.',
      explanation: 'Flick from 10 to 0 and back to chop a track in and out on the beat.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'dj-mixing',
      quiz: {
        question: 'You want long, smooth blends between two house tracks. Which curve?',
        options: ['CONST PWR', 'FAST CUT', 'It does not matter'], answer: 0,
        explain: 'CONST PWR keeps the blend level through the middle. FAST CUT jumps between all and nothing - great for cuts and scratching, harsh for a long blend.',
      },
    },
    {
      kind: 'challenge', concept: 'dj-mixing',
      instruction: 'Set up for cut mixing: channel 1 on X, channel 2 on Y, the sharp curve, and only channel 1 heard.',
      checklist: [
        { text: 'Channel 1 on X, channel 2 on Y', check: s => num(s, 'ch1_xf') === 0 && num(s, 'ch2_xf') === 2 },
        { text: 'XFADER CURVE: FAST CUT', check: s => num(s, 'xf_curve') === 2 },
        { text: 'Crossfader parked on X', check: s => num(s, 'xfader') <= 0.2 },
      ],
      hints: ['You already set the assigns.', 'Move the crossfader all the way left.', 'X fully left with FAST CUT.'],
      solution: { values: { ch1_xf: 0, ch2_xf: 2, xf_curve: 2, xfader: 0 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'When would you use CONST PWR, and when FAST CUT?',
        model: 'CONST PWR for smooth blends, because the loudness stays even through the middle; FAST CUT for cuts and scratching, because each side opens almost instantly.',
      },
    },
  ],
  review: [
    { question: 'A channel with its XFADER switch on OFF…', options: ['Ignores the crossfader', 'Is muted', 'Follows X'], answer: 0, explain: 'It goes straight to the LR MIX.' },
    { question: 'CONST PWR in the middle puts each side at about…', options: ['-3 dB', '-20 dB', '+6 dB'], answer: 0, explain: 'Equal power.' },
    { question: 'TRANSITION in the middle puts each side at…', options: ['Full level', '-3 dB', 'Silence'], answer: 0, explain: 'It fades each side only near the far end.' },
    { question: 'FAST CUT is for…', options: ['Cuts and scratching', 'Long blends', 'Recording'], answer: 0, explain: 'Almost instant cut-in.' },
    { question: 'The crossfader sits after the channel fader, so it also sets…', options: ['The level into the filters', 'The GAIN', 'The cue level'], answer: 0, explain: 'It is a VCA before the FILTER assign.' },
  ],
};

const f7: Lesson = {
  id: 'xone96-fx-send', device: 'xone96', path: 'foundations', order: O(7), difficulty: 'intermediate',
  name: 'FX sends and returns',
  description: 'Send a channel to the delay and the reverb, and ride the returns on channels A and B.',
  objective: 'Use SEND 1 and SEND 2 to add delay and reverb, and control them on the returns.',
  source: 'Synth Studio · Xone:96 User Guide, SEND 1 / SEND 2', estimatedMinutes: 8,
  prerequisites: ['xone96-gain-staging'],
  concepts: ['effects', 'signal-routing'],
  start: { reset: true, values: { ch1_src: SRC.DRUMS, ch3_src: SRC.STABS, ch1_fader: 8 } },
  steps: [
    play('A dry signal has no effect on it; a wet one is the effect\'s output.'),
    {
      kind: 'predict', control: 'ch3_snd1', targetValue: 6, concept: 'effects',
      instruction: 'Turn channel 3 SEND 1 up to 6.',
      predict: {
        question: 'SEND 1 feeds the delay, which returns on channel A. What will you hear?',
        options: ['Echoes of the stabs, in time with the beat', 'The stabs get louder', 'Nothing: channel A is off'], answer: 0,
        explain: 'A send copies part of the channel to the effect. The delay\'s repeats come back on channel A, whose INPUT is on RTN and whose fader is up. The dry stabs keep playing on channel 3.',
      },
      principle: 'A send copies part of a channel to an effect; the effect comes back on a return.',
      manualReference: REF.sends,
    },
    {
      kind: 'do', control: 'cha_fader', targetValue: 5, concept: 'effects',
      instruction: 'Pull channel A\'s fader down to 5: the echoes get quieter, the dry stabs do not.',
      principle: 'The send sets how much goes into the effect; the return sets how much you hear.',
      explanation: 'Because the return is a full channel, you can also EQ or filter the echoes. Cutting LO on channel A is a classic dub trick.',
      manualReference: REF.sends,
    },
    {
      kind: 'do', control: 'ch3_snd2', targetValue: 5, concept: 'effects',
      instruction: 'Turn channel 3 SEND 2 up to 5: the reverb, returned on channel B.',
      principle: 'Reverb is thousands of fading reflections: it puts a sound in a room.',
      manualReference: REF.sends,
    },
    {
      kind: 'predict', control: 'ch3_fader', targetValue: 0, concept: 'effects',
      instruction: 'Pull channel 3\'s fader all the way down.',
      predict: {
        question: 'Channel 3\'s PRE is off, and SEND 2 is always post-fader. What happens to the echoes and the reverb?',
        options: ['Their input stops, so they ring out and fade', 'They keep going at full level', 'They get louder'], answer: 0,
        explain: 'Post-fader sends are taken after the channel fader. Fader down means nothing new goes in, and the tails die away naturally.',
      },
      principle: 'A post-fader send follows the channel fader.',
      manualReference: REF.sends,
    },
    {
      kind: 'do', control: 'ch3_pre', targetValue: true, concept: 'effects',
      instruction: 'Press channel 3\'s PRE button, beside SEND 1.',
      principle: 'A pre-fader send keeps feeding the effect when the channel fader is down.',
      explanation: 'Now the delay hears the stabs even with their fader down, so you hear only the echoes - a dub-style "ghost" of the part. Each channel has its own PRE.',
      manualReference: REF.sends,
    },
    {
      kind: 'listen', concept: 'effects', focus: ['ch3_pre'],
      instruction: 'Compare PRE off and on with the channel 3 fader down.',
      listen: {
        a: { ch3_pre: false, ch3_fader: 0 }, b: { ch3_pre: true, ch3_fader: 0 }, labels: ['POST', 'PRE'],
        question: {
          question: 'Why do you hear echoes only with PRE?',
          options: ['PRE taps the channel before its fader', 'PRE turns the fader up', 'PRE adds reverb'], answer: 0,
          explain: 'With PRE the send sits before the fader, so the delay still gets the stabs. With POST the fader is the gate.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Channel A\'s INPUT is on RTN. What is playing on it?',
        options: ['The delay\'s output (the return of SEND 1)', 'Channel 1\'s dry signal', 'A microphone'], answer: 0,
        explain: 'RTN is the return input. In the twin, SEND 1 drives the stand-in delay and its output comes back on RTN A; SEND 2 drives the reverb, back on RTN B.',
      },
    },
    {
      kind: 'challenge', concept: 'effects',
      instruction: 'Set up a dub throw: the stabs play dry, a post-fader send feeds the delay, and channel A carries the echoes.',
      checklist: [
        { text: 'Channel 3 fader up (7 or more)', check: s => num(s, 'ch3_fader') >= 7 },
        { text: 'Channel 3 SEND 1 between 3 and 9', check: s => num(s, 'ch3_snd1') >= 3 && num(s, 'ch3_snd1') <= 9 },
        { text: 'Channel 3 SEND 1 post-fader (PRE off)', check: s => !s.values.ch3_pre },
        { text: 'Channel A up (6 or more), INPUT on RTN', check: s => num(s, 'cha_fader') >= 6 && num(s, 'cha_input') === 2 },
      ],
      hints: ['Bring channel 3 back up.', 'Switch channel 3\'s PRE off again.', 'Channel 3 fader 9, SEND 1 6, PRE off, channel A fader 8.'],
      solution: { values: { ch3_fader: 9, ch3_snd1: 6, ch3_pre: false, cha_fader: 8, cha_input: 2 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Trace an echo from channel 3 to your ears.',
        model: 'SEND 1 copies channel 3 into the delay; the delay\'s output comes back on channel A\'s RTN input, and channel A\'s fader sets how loud the echoes are in the mix.',
      },
    },
  ],
  review: [
    { question: 'A send…', options: ['Copies part of a channel to an effect', 'Moves a channel to the other side', 'Mutes a channel'], answer: 0, explain: 'The dry signal keeps playing.' },
    { question: 'SEND 2 on the Xone:96 is…', options: ['Always post-fader', 'Always pre-fader', 'Switchable'], answer: 0, explain: 'Only SEND 1 has PRE.' },
    { question: 'SEND 1 on PRE with the fader down, the delay…', options: ['Still gets signal', 'Gets nothing', 'Doubles'], answer: 0, explain: 'PRE is before the fader.' },
    { question: 'In the twin the effects return on…', options: ['Channels A and B (RTN)', 'The master only', 'The headphones only'], answer: 0, explain: 'RTN A and RTN B.' },
  ],
};

const f8: Lesson = {
  id: 'xone96-cue', device: 'xone96', path: 'foundations', order: O(8), difficulty: 'beginner',
  name: 'Cueing in the headphones',
  description: 'Listen to the next track before the crowd hears it, with CUE, CUE/MST and SPLIT CUE.',
  objective: 'Preview a track in the headphones and check it against the live mix.',
  source: 'Synth Studio · Xone:96 User Guide, Monitor section', estimatedMinutes: 6,
  prerequisites: ['xone96-crossfader'],
  concepts: ['dj-mixing', 'signal-routing'],
  start: { reset: true, values: { ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, ch1_xf: 0, ch2_xf: 2, xfader: 0 } },
  steps: [
    {
      ...play('The crowd hears the master; the DJ also hears the headphones.'),
      instruction: 'Press PLAY. The room hears TRACK A; TRACK B plays on Y, closed by the crossfader.',
    },
    {
      kind: 'do', control: 'monitor_out', targetValue: 2, concept: 'signal-routing',
      instruction: 'Set YOU HEAR to PHONES. You are now listening to the DJ\'s headphones.',
      principle: 'Headphones let a DJ hear a track before it goes out to the room.',
      explanation: 'Twin only: a browser has one output, so YOU HEAR picks which mixer output plays. Nothing is cued yet, so the headphones carry the program - the LR MIX, TRACK A, the same as the room.',
      manualReference: REF.twin,
    },
    {
      kind: 'predict', control: 'ch2_cue', targetValue: true, concept: 'dj-mixing',
      instruction: 'Press channel 2\'s CUE.',
      predict: {
        question: 'What do you hear in the headphones now?',
        options: ['TRACK B, even though the room cannot hear it', 'TRACK A, as before', 'Nothing'], answer: 0,
        explain: 'Once a CUE is on, the headphones switch from the program to the cue. CUE taps the channel before its fader and the crossfader, so you hear TRACK B while the room still hears only TRACK A. The CUE ACTIVE LED in the MONITOR section lights.',
      },
      principle: 'Cue listens to a channel before its fader, so you can preview it silently.',
      manualReference: REF.cue,
    },
    {
      kind: 'do', control: 'cue_mix', targetValue: 5, concept: 'dj-mixing',
      instruction: 'Turn CUE / MST to the middle: the LR MIX joins the cue in the headphones.',
      principle: 'Hearing the cue and the mix together shows whether two tracks line up.',
      explanation: 'CUE/MST adds the mix to the cue: the cue stays at full level, and turning clockwise brings in more and more of the LR MIX alongside it. Fully anticlockwise is the cue alone.',
      manualReference: REF.cue,
    },
    {
      kind: 'do', control: 'split_cue', targetValue: true, concept: 'dj-mixing',
      instruction: 'Press SPLIT CUE: cue in your left ear, the master mix in your right.',
      principle: 'Separate ears let you compare two sounds without them blurring together.',
      explanation: 'SPLIT CUE overrides CUE/MST. The left main meter now shows the cue and the right one the mix (CUE and PRG on the legend).',
      manualReference: REF.cue,
    },
    {
      kind: 'listen', concept: 'dj-mixing', focus: ['split_cue'],
      instruction: 'Compare cue only with split cue.',
      listen: {
        a: { split_cue: false, cue_mix: 0 }, b: { split_cue: true }, labels: ['Cue only', 'Split cue'],
        question: {
          question: 'In split cue, where is TRACK A?',
          options: ['In the right ear (the master mix)', 'In both ears', 'Nowhere'], answer: 0,
          explain: 'SPLIT CUE sends the cued channel to the left and the LR MIX to the right. TRACK A is the live mix, so it sits on the right.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'gain-staging',
      quiz: {
        question: 'While a CUE is on (no split), what do the LR MIX meters show?',
        options: ['The cued channel\'s level', 'The master only', 'Nothing'], answer: 0,
        explain: 'Cueing switches the main meters to the cued channels (their sum, if several are cued), so you can check the incoming level before it goes out. With nothing cued they read the LR MIX before MASTER 1; SPLIT CUE shows both, cue left and mix right.',
      },
      manualReference: REF.master,
    },
    {
      kind: 'do', control: 'monitor_out', targetValue: 0, concept: 'signal-routing',
      instruction: 'Set YOU HEAR back to MASTER: what the room hears.',
      principle: 'Always check what the audience hears after previewing.',
    },
    {
      kind: 'challenge', concept: 'dj-mixing',
      instruction: 'Get TRACK B ready: cue it in split cue while the room keeps hearing only TRACK A.',
      checklist: [
        { text: 'Channel 2 cued', check: s => !!s.values.ch2_cue },
        { text: 'SPLIT CUE on', check: s => !!s.values.split_cue },
        { text: 'The crossfader keeps TRACK B out of the room', check: s => num(s, 'xfader') <= 1 && num(s, 'ch2_xf') === 2 },
      ],
      hints: ['You set most of this already.', 'Check the crossfader is still on X.', 'CUE 2 on, SPLIT CUE on, crossfader fully left.'],
      solution: { values: { ch2_cue: true, split_cue: true, xfader: 0, ch2_xf: 2 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does CUE listen before the fader?',
        model: 'So you can hear and line up a track while its fader or the crossfader keeps it away from the crowd.',
      },
    },
  ],
  review: [
    { question: 'CUE sends a channel to…', options: ['The headphones (MONITOR)', 'The master', 'The booth'], answer: 0, explain: 'Preview only.' },
    { question: 'SPLIT CUE puts…', options: ['The cue in one ear, the mix in the other', 'Both tracks in both ears', 'The booth in the headphones'], answer: 0, explain: 'Left cue, right mix.' },
    { question: 'Pressing a new CUE on the Xone:96 (AUTO-CUE)…', options: ['Cancels the previous one', 'Adds to it', 'Mutes the master'], answer: 0, explain: 'One cue at a time by default.' },
    { question: 'CUE/MST turned fully clockwise plays…', options: ['The cue and the LR MIX together', 'Only the LR MIX', 'Only the cue'], answer: 0, explain: 'It adds the mix to the cue; the cue never fades out.' },
    { question: 'With no CUE pressed, the MONITOR headphones play…', options: ['The LR MIX (the program)', 'Silence', 'Channel 1'], answer: 0, explain: 'The cue takes over only while a CUE is on.' },
  ],
};

// ============================================================================
// PERFORMANCE
// ============================================================================

const p1: Lesson = {
  id: 'xone96-phrasing', device: 'xone96', path: 'performance', order: O(9), difficulty: 'intermediate',
  name: 'Phrasing: mix on the 8-bar line',
  description: 'Count beats, bars and phrases, and start a blend where the music expects a change.',
  objective: 'Count bars and phrases, and start a blend on the first bar of a phrase.',
  source: 'Synth Studio · DJ practice', estimatedMinutes: 7,
  prerequisites: ['xone96-crossfader'],
  concepts: ['timing-tempo', 'dj-mixing'],
  start: { reset: true, values: { ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, ch1_xf: 0, ch2_xf: 2, xfader: 0 } },
  steps: [
    {
      ...play('Dance music is built in phrases: groups of 8 bars, each bar 4 beats.'),
      instruction: 'Press PLAY and watch the display in the deck strip: BAR, BEAT and PHRASE.',
    },
    {
      kind: 'info', concept: 'timing-tempo',
      instruction: 'Listen across bar 8 into bar 9. Something new arrives on the "1".',
      principle: 'A new phrase brings a change: a new part, a fill or a crash cymbal.',
      explanation: 'TRACK A adds its bassline and claps at bar 9, the chord stabs at bar 17, and drops the kick for bars 31-32. A crash marks the start of every phrase.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'On which bars does a new phrase start in a 32-bar track?',
        options: ['1, 9, 17 and 25', 'Every bar', '4, 12, 20 and 28'], answer: 0,
        explain: 'Phrases are 8 bars long, so they start on bars 1, 9, 17 and 25. Bar 4 is the end of a 4-bar group, not a new phrase.',
      },
    },
    {
      kind: 'predict', control: 'ch2_lo', targetValue: -1, concept: 'equalization',
      instruction: 'Before the blend, kill channel 2\'s LO.',
      predict: {
        question: 'Why kill TRACK B\'s bass before it comes in?',
        options: ['Two basslines and kicks at once clash and boom', 'It makes TRACK B louder', 'It changes the tempo'], answer: 0,
        explain: 'Both tracks have a kick and a bass in the same band. Bringing B in without its lows keeps the low end clean until you swap them.',
      },
      principle: 'Only one track should own the low end at a time.',
      manualReference: REF.eq,
    },
    {
      kind: 'do', control: 'xfader', targetValue: 5, concept: 'dj-mixing',
      instruction: 'Watch for PHRASE x · 1 of 8, then move the crossfader to the middle on that first beat.',
      principle: 'Changes that land on a phrase boundary sound intentional.',
      explanation: 'Both decks follow one clock, so their bars line up. On real decks, beat-matching gets you to this point.',
      manualReference: REF.xfader,
    },
    {
      kind: 'listen', concept: 'dj-mixing', focus: ['xfader', 'ch2_lo'],
      instruction: 'Compare TRACK A alone with the blend.',
      listen: {
        a: { xfader: 0, ch2_lo: -1 }, b: { xfader: 5, ch2_lo: -1 }, labels: ['TRACK A', 'Blend, B\'s bass killed'],
        question: {
          question: 'In the blend, where does the low end come from?',
          options: ['TRACK A only', 'TRACK B only', 'Both'], answer: 0,
          explain: 'TRACK B adds its hats, rims and acid line on top, but its LO is killed, so the kick and bass are TRACK A\'s alone.',
        },
      },
    },
    {
      kind: 'challenge', concept: 'dj-mixing',
      instruction: 'On the next phrase, finish the move: give TRACK B the low end, take it from TRACK A, then open the crossfader to Y.',
      checklist: [
        { text: 'Channel 1 LO killed', check: s => num(s, 'ch1_lo') <= -0.9 },
        { text: 'Channel 2 LO back at 0', check: s => Math.abs(num(s, 'ch2_lo')) <= 0.1 },
        { text: 'Crossfader on Y (9 or more)', check: s => num(s, 'xfader') >= 9 },
      ],
      hints: ['It is a swap: one LO down, the other up, on the "1".', 'Then slide the crossfader over during the phrase.', 'Channel 1 LO to KILL, channel 2 LO to centre, crossfader to 10.'],
      solution: { values: { ch1_lo: -1, ch2_lo: 0, xfader: 10 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why do DJs start transitions on the first bar of a phrase?',
        model: 'Because the music changes on phrase boundaries; a transition that starts there sounds deliberate and keeps the structure the dancers expect.',
      },
    },
  ],
  review: [
    { question: 'A bar of 4/4 has…', options: ['4 beats', '8 beats', '16 beats'], answer: 0, explain: 'Four quarter notes.' },
    { question: 'A phrase in house music is usually…', options: ['8 bars', '2 beats', '100 bars'], answer: 0, explain: '32 beats.' },
    { question: 'TRACK A marks each phrase with…', options: ['A crash cymbal', 'Silence', 'A tempo change'], answer: 0, explain: 'On the first beat.' },
    { question: 'Start a blend…', options: ['On the first bar of a phrase', 'Halfway through a bar', 'Anywhere'], answer: 0, explain: 'Where the music changes.' },
  ],
};

const p2: Lesson = {
  id: 'xone96-bass-swap', device: 'xone96', path: 'performance', order: O(10), difficulty: 'intermediate',
  name: 'Transitions: the bass swap and the filter out',
  description: 'Two classic transitions: swap the bass between tracks, then filter the old one away.',
  objective: 'Perform a bass swap and a high-pass filter exit between two tracks.',
  source: 'Synth Studio · DJ practice', estimatedMinutes: 8,
  prerequisites: ['xone96-low-end-clash', 'xone96-phrasing'],
  concepts: ['dj-mixing', 'equalization', 'filter-cutoff'],
  start: { reset: true, values: { ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, ch2_lo: -1 } },
  steps: [
    {
      ...play('A transition hands the dance floor from one track to the next.'),
      instruction: 'Press PLAY. Both tracks are up, with TRACK B\'s LO killed.',
    },
    {
      kind: 'do', control: 'ch1_lo', targetValue: -1, concept: 'equalization',
      instruction: 'On the "1" of a phrase, kill channel 1\'s LO...',
      principle: 'A bass swap moves the low end from one track to the other in one beat.',
      manualReference: REF.eq,
    },
    {
      kind: 'do', control: 'ch2_lo', targetValue: 0, concept: 'equalization',
      instruction: '...and straight away open channel 2\'s LO to the centre.',
      principle: 'Two hands, one beat: one LO down, the other up.',
      explanation: 'With two hands it happens on the same beat. With one mouse, do it as fast as you can on the downbeat.',
    },
    {
      kind: 'listen', concept: 'dj-mixing', focus: ['ch1_lo', 'ch2_lo'], scope: 'spectrum',
      instruction: 'Compare before and after the swap.',
      listen: {
        a: { ch1_lo: 0, ch2_lo: -1 }, b: { ch1_lo: -1, ch2_lo: 0 }, labels: ['Before', 'After'],
        question: {
          question: 'What moved from one track to the other?',
          options: ['The kick and the bassline', 'The hi-hats', 'The tempo'], answer: 0,
          explain: 'Only the LO band swapped. Above 180 Hz both tracks still play.',
        },
      },
    },
    {
      kind: 'do', control: 'ch1_filter', targetValue: 0, concept: 'filter-cutoff',
      instruction: 'Now the exit: set channel 1\'s FILTER switch to 1.',
      principle: 'A filter on the outgoing track lets it fade out in colour, not only in level.',
      manualReference: REF.filter,
    },
    {
      kind: 'do', control: 'f1_on', targetValue: true, concept: 'filter-cutoff',
      instruction: 'Press FILTER 1 ON (blue). It is a high-pass at 20 Hz, so nothing changes yet.',
      principle: 'A high-pass at its lowest setting is transparent.',
    },
    {
      kind: 'predict', control: 'f1_freq', targetValue: 1500, concept: 'filter-cutoff',
      instruction: 'Over a phrase, sweep FILTER 1 FREQ up to about 1.5 kHz.',
      predict: {
        question: 'What does a rising high-pass do to TRACK A?',
        options: ['Thins it out until only the top is left', 'Makes it bassier', 'Speeds it up'], answer: 0,
        explain: 'The cutoff climbs through the mids, so less and less of TRACK A is left, while TRACK B keeps playing in full.',
      },
      principle: 'Sweeping a high-pass up removes more and more of a sound, starting from the bottom.',
      manualReference: REF.filter,
    },
    {
      kind: 'do', control: 'ch1_fader', targetValue: 0, concept: 'dj-mixing',
      instruction: 'Pull channel 1\'s fader down to finish the exit.',
      principle: 'End a transition cleanly: the old track fully gone, the new one in full.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'equalization',
      quiz: {
        question: 'Why swap the bass instead of letting both tracks play it?',
        options: ['Two basslines at once clash and overload the low end', 'The mixer requires it', 'It keeps the hats in time'], answer: 0,
        explain: 'Two kicks and two bass parts pile up below 180 Hz: boomy, muddy and hot on the meters. One owner at a time keeps it clean.',
      },
    },
    {
      kind: 'challenge', concept: 'dj-mixing',
      instruction: 'Tidy up for the next mix: TRACK B alone in full, and FILTER 1 reset and off.',
      checklist: [
        { text: 'TRACK B has its bass (channel 2 LO at 0)', check: s => Math.abs(num(s, 'ch2_lo')) <= 0.1 },
        { text: 'Channel 1 out (fader down)', check: s => num(s, 'ch1_fader') <= 0.5 },
        { text: 'FILTER 1 OFF, FREQ back at the bottom', check: s => !s.values.f1_on && num(s, 'f1_freq') <= 40 },
      ],
      hints: ['Three things: bass, fader, filter.', 'Turn FILTER 1 FREQ fully anticlockwise and press ON to switch it off.', 'Channel 2 LO centre, channel 1 fader 0, FILTER 1 FREQ 20 Hz, ON off.'],
      solution: { values: { ch2_lo: 0, ch1_fader: 0, f1_freq: 20, f1_on: false } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Describe a bass swap in one sentence.',
        model: 'On a phrase boundary, kill the outgoing track\'s LO and open the incoming track\'s LO, so only one bassline plays at a time.',
      },
    },
  ],
  review: [
    { question: 'A bass swap moves…', options: ['The LO band from one track to the other', 'The tempo', 'The hats'], answer: 0, explain: 'Kick and bass change owner.' },
    { question: 'A filter exit on the old track usually uses…', options: ['A high-pass sweeping up', 'A low-pass sweeping up', 'No filter'], answer: 0, explain: 'It thins the track away.' },
    { question: 'The best moment for a bass swap is…', options: ['The first beat of a phrase', 'Any off-beat', 'The middle of a bar'], answer: 0, explain: 'Where the music changes.' },
  ],
};

const p3: Lesson = {
  id: 'xone96-full-blend', device: 'xone96', path: 'performance', order: O(11), difficulty: 'advanced',
  name: 'A full blend from A to B',
  description: 'Everything together: cue, match the gain, kill, blend on the phrase, swap and finish.',
  objective: 'Mix from TRACK A into TRACK B over a phrase using cue, GAIN, EQ and the crossfader.',
  source: 'Synth Studio · DJ practice', estimatedMinutes: 10,
  prerequisites: ['xone96-bass-swap', 'xone96-cue'],
  concepts: ['dj-mixing', 'gain-staging', 'equalization'],
  start: { reset: true, values: { ch1_src: SRC.TRACK_A, ch2_src: SRC.TRACK_B, ch1_xf: 0, ch2_xf: 2, xfader: 0, ch2_gain: 4 } },
  steps: [
    play('A blend is a sequence: prepare, bring in, swap, take out.'),
    {
      kind: 'do', control: 'ch2_cue', targetValue: true, concept: 'dj-mixing',
      instruction: 'Cue channel 2. The LR MIX meters now show TRACK B.',
      principle: 'Prepare the next track in the headphones before the crowd hears it.',
      manualReference: REF.cue,
    },
    {
      kind: 'predict', control: 'ch2_gain', targetValue: -1.5, concept: 'gain-staging',
      instruction: 'TRACK B reads too hot. Set channel 2 GAIN to about -1.5 dB, level with TRACK A.',
      predict: {
        question: 'What happens if you blend without fixing TRACK B\'s gain?',
        options: ['TRACK B jumps out, and the mix gets hot', 'Nothing', 'TRACK B gets quieter'], answer: 0,
        explain: 'At +4 dB of GAIN, TRACK B is about 5 dB hotter than TRACK A. Through the blend, the room would hear a jump in level instead of a smooth change.',
      },
      principle: 'Match levels before you mix, not during.',
      manualReference: REF.gain,
    },
    {
      kind: 'do', control: 'ch2_lo', targetValue: -1, concept: 'equalization',
      instruction: 'Kill channel 2\'s LO.',
      principle: 'Only one track owns the low end at a time.',
    },
    {
      kind: 'do', control: 'xfader', targetValue: 5, concept: 'dj-mixing',
      instruction: 'On the first bar of a phrase, move the crossfader to the middle.',
      principle: 'Bring the new track in where the music expects a change.',
    },
    {
      kind: 'do', control: 'ch1_lo', targetValue: -1, concept: 'equalization',
      instruction: 'Next phrase: kill channel 1\'s LO...',
      principle: 'The bass swap is the moment the floor changes track.',
    },
    {
      kind: 'do', control: 'ch2_lo', targetValue: 0, concept: 'equalization',
      instruction: '...and open channel 2\'s LO to the centre.',
      principle: 'Keep the low end continuous across the swap.',
    },
    {
      kind: 'listen', concept: 'dj-mixing', focus: ['xfader'],
      instruction: 'Compare the middle of the blend with the end of it.',
      listen: {
        a: { xfader: 5, ch1_lo: -1, ch2_lo: 0 }, b: { xfader: 10, ch1_lo: -1, ch2_lo: 0 }, labels: ['Mid-blend', 'Blend done'],
        question: {
          question: 'What is still left of TRACK A in the mid-blend?',
          options: ['Its hats and mids, without its low end', 'Everything', 'Nothing'], answer: 0,
          explain: 'Its LO is killed, so it contributes only the upper bands until the crossfader takes it out.',
        },
      },
    },
    {
      kind: 'do', control: 'xfader', targetValue: 10, concept: 'dj-mixing',
      instruction: 'Finish: slide the crossfader fully to Y.',
      principle: 'A finished blend leaves one track playing in full.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'dj-mixing',
      quiz: {
        question: 'In which order does a blend usually go?',
        options: ['Cue and match gain, kill the bass, bring in on a phrase, swap, take out', 'Fader up, then think about gain', 'Swap the bass first, then cue'], answer: 0,
        explain: 'Preparation (cue, gain, EQ) happens before the crowd hears anything; then the moves land on phrase boundaries.',
      },
    },
    {
      kind: 'challenge', concept: 'dj-mixing',
      instruction: 'Now mix back from TRACK B into TRACK A by yourself.',
      checklist: [
        { text: 'Crossfader back on X', check: s => num(s, 'xfader') <= 0.5 },
        { text: 'TRACK A owns the low end (channel 1 LO at 0)', check: s => Math.abs(num(s, 'ch1_lo')) <= 0.1 },
        { text: 'TRACK B\'s LO killed', check: s => num(s, 'ch2_lo') <= -0.9 },
      ],
      hints: ['Same moves, mirrored.', 'Swap the LOs back on a phrase, then move the crossfader.', 'Channel 2 LO to KILL, channel 1 LO to centre, crossfader to 0.'],
      solution: { values: { xfader: 0, ch1_lo: 0, ch2_lo: -1 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What did you prepare before the crowd heard TRACK B, and why?',
        model: 'I cued it, matched its GAIN to TRACK A and killed its LO, so it came in at the same loudness without two basslines clashing.',
      },
    },
  ],
  review: [
    { question: 'Gain-match the incoming track…', options: ['Before the blend, in the cue', 'During the blend', 'After the blend'], answer: 0, explain: 'Prepare first.' },
    { question: 'Mid-blend, the outgoing track keeps…', options: ['Its upper bands, with LO killed', 'Its bass only', 'Nothing'], answer: 0, explain: 'One low end at a time.' },
    { question: 'A finished blend means…', options: ['One track playing in full', 'Both at half', 'Silence'], answer: 0, explain: 'Clean hand-over.' },
  ],
};

// ============================================================================
// EAR TRAINING (graded, then interleaved)
// ============================================================================

const e1: Lesson = {
  id: 'xone96-e1-which-band', device: 'xone96', path: 'ear-training', order: O(12), difficulty: 'beginner',
  name: 'Ear training 1: lows or highs?',
  description: 'Wide differences first: was the LO or the HI killed?',
  objective: 'Hear whether the low or the high band was killed, and recreate it.',
  source: 'Synth Studio · ear training', estimatedMinutes: 6,
  prerequisites: ['xone96-eq-fundamentals'],
  concepts: ['equalization'],
  start: { reset: true, values: { ch1_src: SRC.FULL } },
  steps: [
    {
      kind: 'listen', concept: 'equalization', focus: ['ch1_lo', 'ch1_hi'], scope: 'spectrum',
      instruction: 'Warm up: compare the full band with LO killed. Listen to the kick.',
      listen: { a: {}, b: { ch1_lo: -1 }, labels: ['Full', 'LO killed'] },
    },
    {
      kind: 'match', instruction: 'Round 1: which band is gone in the target? Recreate it.', concept: 'equalization',
      setup: { ch1_hi: 0, ch1_lo: 0 },
      match: { target: { ch1_hi: 0, ch1_lo: -1 }, controls: ['ch1_hi', 'ch1_lo'] },
      hints: ['Is the kick there?', 'No thump at all.', 'Kill LO.'],
    },
    {
      kind: 'match', instruction: 'Round 2: and now?', concept: 'equalization',
      setup: { ch1_hi: 0, ch1_lo: 0 },
      match: { target: { ch1_hi: -1, ch1_lo: 0 }, controls: ['ch1_hi', 'ch1_lo'] },
      hints: ['Listen to the very top.', 'The hats have gone.', 'Kill HI.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'equalization',
      quiz: {
        question: 'What is the quickest way to tell a LO kill from a HI kill?',
        options: ['Listen for the kick (LO) and the hats (HI)', 'Look at the fader', 'Count the bars'], answer: 0,
        explain: 'The kick and the hats are the clearest landmarks at each end of the spectrum.',
      },
    },
    {
      kind: 'listen', concept: 'equalization', focus: ['ch1_hi', 'ch1_lo'],
      instruction: 'A and B differ in one band.',
      listen: {
        a: {}, b: { ch1_hi: -1, ch1_lo: -1 }, labels: ['A', 'B'],
        question: {
          question: 'What is B missing?',
          options: ['Both the lows and the highs', 'Only the lows', 'Only the highs'], answer: 0,
          explain: 'B has no thump and no sizzle: only the mids are left, like a small radio.',
        },
      },
    },
    {
      kind: 'match', instruction: 'Round 3: both ends.', concept: 'equalization',
      setup: { ch1_hi: 0, ch1_lo: 0 },
      match: { target: { ch1_hi: -1, ch1_lo: -1 }, controls: ['ch1_hi', 'ch1_lo'] },
      hints: ['Kick? Hats?', 'Neither is there.', 'Kill both LO and HI.'],
    },
    {
      kind: 'match', instruction: 'Round 4: not a kill this time - how far down is LO?', concept: 'equalization',
      setup: { ch1_hi: 0, ch1_lo: 0 },
      match: { target: { ch1_hi: 0, ch1_lo: -0.5 }, controls: ['ch1_lo'], tolerance: 0.1 },
      hints: ['The kick is there, but thinner.', 'About halfway between centre and KILL.', 'LO about -12 dB.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What did you listen for to find the cut band?',
        model: 'The kick for the lows and the hats for the highs: whichever landmark disappeared told me which band was cut.',
      },
    },
  ],
  review: [
    { question: 'No kick thump means…', options: ['LO is cut or killed', 'HI is killed', 'The fader is down'], answer: 0, explain: 'The thump lives below 180 Hz.' },
    { question: 'No hi-hat sizzle means…', options: ['HI is cut or killed', 'LO is killed', 'RES is up'], answer: 0, explain: 'Above 3 kHz.' },
    { question: 'Only the mids left sounds like…', options: ['A small radio', 'A club system', 'Silence'], answer: 0, explain: 'No lows, no highs.' },
  ],
};

const e2: Lesson = {
  id: 'xone96-e2-mid-bands', device: 'xone96', path: 'ear-training', order: O(13), difficulty: 'intermediate',
  name: 'Ear training 2: which mid?',
  description: 'Finer differences: LO MID or HI MID, cuts and boosts, then two bands at once.',
  objective: 'Tell LO MID from HI MID by ear and match partial cuts and boosts.',
  source: 'Synth Studio · ear training', estimatedMinutes: 8,
  prerequisites: ['xone96-e1-which-band'],
  concepts: ['equalization'],
  start: { reset: true, values: { ch1_src: SRC.FULL } },
  steps: [
    {
      kind: 'listen', concept: 'equalization', focus: ['ch1_lomid'], scope: 'spectrum',
      instruction: 'Warm up: flat against LO MID cut.',
      listen: {
        a: {}, b: { ch1_lomid: -1 }, labels: ['Flat', 'LO MID cut'],
        question: {
          question: 'What did the LO MID cut take away?',
          options: ['Body and warmth: the bass and chords sound thinner', 'The kick\'s thump', 'The air on top'], answer: 0,
          explain: 'Around 350 Hz is where the body of the bass and chords sits. The thump is lower and the air higher.',
        },
      },
    },
    {
      kind: 'listen', concept: 'equalization', focus: ['ch1_himid'],
      instruction: 'Now flat against HI MID cut.',
      listen: {
        a: {}, b: { ch1_himid: -1 }, labels: ['Flat', 'HI MID cut'],
        question: {
          question: 'And HI MID?',
          options: ['Bite and presence: the clap and stabs go soft', 'Deep bass', 'Nothing'], answer: 0,
          explain: 'Around 1.1 kHz is presence. Cutting it makes things sound distant and soft.',
        },
      },
    },
    {
      kind: 'match', instruction: 'Round 1: which mid is cut in the target?', concept: 'equalization',
      setup: { ch1_lomid: 0, ch1_himid: 0 },
      match: { target: { ch1_lomid: 0, ch1_himid: -1 }, controls: ['ch1_lomid', 'ch1_himid'] },
      hints: ['Thinner, or softer?', 'The clap has lost its crack.', 'Cut HI MID fully.'],
    },
    {
      kind: 'match', instruction: 'Round 2: and this one?', concept: 'equalization',
      setup: { ch1_lomid: 0, ch1_himid: 0 },
      match: { target: { ch1_lomid: -1, ch1_himid: 0 }, controls: ['ch1_lomid', 'ch1_himid'] },
      hints: ['Listen to the bass notes and chords.', 'They have lost their body.', 'Cut LO MID fully.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'equalization',
      quiz: {
        question: 'A mix sounds muddy and boxy. Which band do you reach for first?',
        options: ['LO MID, cut', 'HI, boost', 'LO, boost'], answer: 0,
        explain: 'Mud is too much energy around 200-500 Hz. Cutting LO MID clears it; boosting the top only adds harshness on top of the mud.',
      },
    },
    {
      kind: 'match', instruction: 'Round 3: a boost this time. Find how much.', concept: 'equalization',
      setup: { ch1_lomid: 0, ch1_himid: 0 },
      match: { target: { ch1_himid: 0.6 }, controls: ['ch1_himid'] },
      hints: ['It is brighter and more forward than flat.', 'HI MID is boosted.', 'About +6 dB (a little past halfway clockwise).'],
    },
    {
      kind: 'match', instruction: 'Round 4: two bands from different sections.', concept: 'equalization',
      setup: { ch1_lomid: 0, ch1_himid: 0, ch1_hi: 0 },
      match: { target: { ch1_lomid: -0.5, ch1_hi: -1 }, controls: ['ch1_lomid', 'ch1_hi'] },
      hints: ['Two things changed: one at the top, one in the body.', 'The hats are gone and the bass is a bit thinner.', 'HI killed, LO MID about -14 dB.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do you tell a LO MID cut from a HI MID cut?',
        model: 'A LO MID cut thins out the body of the bass and chords; a HI MID cut softens the attack and presence, like the music moved further away.',
      },
    },
  ],
  review: [
    { question: 'LO MID (350 Hz) carries…', options: ['Body and warmth', 'Air', 'Sub bass'], answer: 0, explain: 'And mud when overdone.' },
    { question: 'HI MID (1.1 kHz) carries…', options: ['Presence and bite', 'Sub bass', 'Room reverb'], answer: 0, explain: 'Claps, voices, attacks.' },
    { question: 'Muddy mix: first move?', options: ['Cut LO MID', 'Boost HI', 'Boost LO'], answer: 0, explain: 'Remove the build-up.' },
    { question: 'The Xone:96 mid bands boost up to…', options: ['+10 dB', '+6 dB', '+20 dB'], answer: 0, explain: 'HI and LO boost +6.' },
  ],
};

const FILTER_ON = { ch1_filter: 0, f1_on: true, f1_res: 3, f1_crunch: 0 };

const e3: Lesson = {
  id: 'xone96-e3-filter-type', device: 'xone96', path: 'ear-training', order: O(14), difficulty: 'intermediate',
  name: 'Ear training 3: hear the filter type',
  description: 'HPF, BPF or LPF? Then find the cutoff by ear.',
  objective: 'Recognise HPF, BPF and LPF by ear and match the filter frequency.',
  source: 'Synth Studio · ear training', estimatedMinutes: 8,
  prerequisites: ['xone96-filter-sweeps'],
  concepts: ['filter-type', 'filter-cutoff'],
  start: { reset: true, values: { ch1_src: SRC.FULL, ...FILTER_ON, f1_type: 2, f1_freq: 1000 } },
  steps: [
    {
      kind: 'listen', concept: 'filter-type', focus: ['f1_type'], scope: 'spectrum',
      instruction: 'Warm up: HPF against LPF, both at 1 kHz.',
      listen: {
        a: { f1_type: 0 }, b: { f1_type: 2 }, labels: ['HPF', 'LPF'],
        question: {
          question: 'Which one keeps the bass?',
          options: ['The LPF', 'The HPF', 'Both'], answer: 0,
          explain: 'A low-pass passes the lows and removes the highs. The high-pass does the reverse, so it loses the kick and bass.',
        },
      },
    },
    {
      kind: 'listen', concept: 'filter-type', focus: ['f1_type'],
      instruction: 'Now BPF against LPF.',
      listen: {
        a: { f1_type: 1 }, b: { f1_type: 2 }, labels: ['BPF', 'LPF'],
        question: {
          question: 'Which one sounds like a narrow telephone band, no lows and no highs?',
          options: ['The BPF', 'The LPF', 'Neither'], answer: 0,
          explain: 'A band-pass keeps only a band around FREQ, so both ends go. The LPF keeps everything below 1 kHz, bass included.',
        },
      },
    },
    {
      kind: 'match', instruction: 'Round 1: which type is the target?', concept: 'filter-type',
      setup: { f1_type: 2 },
      match: { target: { ...FILTER_ON, f1_type: 0, f1_freq: 1000 }, controls: ['f1_type'] },
      hints: ['Bass or no bass?', 'No bass, but the top is all there.', 'HPF.'],
    },
    {
      kind: 'match', instruction: 'Round 2: and this one?', concept: 'filter-type',
      setup: { f1_type: 2 },
      match: { target: { ...FILTER_ON, f1_type: 1, f1_freq: 1000 }, controls: ['f1_type'] },
      hints: ['Are both ends there?', 'Neither end: just a band.', 'BPF.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-type',
      quiz: {
        question: 'A low-pass sweeping down from 20 kHz to 200 Hz sounds like…',
        options: ['The track moving behind a wall, getting more muffled', 'The track getting thinner and brighter', 'The tempo slowing'], answer: 0,
        explain: 'Lowering a low-pass removes more and more of the top. A high-pass going up is the one that gets thinner.',
      },
    },
    {
      kind: 'match', instruction: 'Round 3: the type is LPF. Find the cutoff by ear.', concept: 'filter-cutoff',
      setup: { f1_type: 2, f1_freq: 3000 },
      match: { target: { ...FILTER_ON, f1_type: 2, f1_freq: 500 }, controls: ['f1_freq'] },
      hints: ['Darker or brighter than yours?', 'Much darker: only the bass and the lowest mids.', 'About 500 Hz.'],
    },
    {
      kind: 'match', instruction: 'Round 4: type and cutoff together.', concept: 'filter-type',
      setup: { f1_type: 2, f1_freq: 1000 },
      match: { target: { ...FILTER_ON, f1_type: 0, f1_freq: 2500 }, controls: ['f1_type', 'f1_freq'] },
      hints: ['First the type: is there any bass?', 'It is a high-pass, and very thin.', 'HPF around 2.5 kHz.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do you hear which filter type is on?',
        model: 'Check the ends: no bass means a high-pass, no top means a low-pass, neither end means a band-pass. Then FREQ is where the sound starts or stops.',
      },
    },
  ],
  review: [
    { question: 'No bass, full top means…', options: ['HPF', 'LPF', 'BPF'], answer: 0, explain: 'High-pass.' },
    { question: 'A narrow band with no lows and no highs means…', options: ['BPF', 'HPF', 'LPF'], answer: 0, explain: 'Band-pass.' },
    { question: 'Muffled, as if through a wall, means…', options: ['LPF', 'HPF', 'CRUNCH'], answer: 0, explain: 'Low-pass.' },
  ],
};

const e4: Lesson = {
  id: 'xone96-e4-over-gain', device: 'xone96', path: 'ear-training', order: O(15), difficulty: 'advanced',
  name: 'Ear training 4: hear over-gain',
  description: 'Clean or clipped? Hear distortion at matched loudness, then mix gain, EQ and filter clues.',
  objective: 'Hear when a channel is over-driven, set GAIN by ear, and tell clipping from a filter.',
  source: 'Synth Studio · ear training (interleaved)', estimatedMinutes: 8,
  prerequisites: ['xone96-gain-staging', 'xone96-e1-which-band'],
  concepts: ['gain-staging', 'equalization', 'filter-type'],
  start: { reset: true, values: { ch1_src: SRC.FULL } },
  steps: [
    {
      kind: 'listen', concept: 'gain-staging', focus: ['ch1_gain'],
      instruction: 'Compare clean with over-driven. B is turned down at MASTER 1 so both are equally loud.',
      listen: {
        a: { ch1_gain: 0 },
        b: { ch1_gain: 10, ch1_lo: 1, ch1_lomid: 1, ch1_himid: 1, master: 4.3 },
        labels: ['Clean', 'Over-driven'],
        question: {
          question: 'At the same loudness, what gives B away?',
          options: ['Flattened, crunchy hits and a buzzy edge', 'It is quieter', 'A slower tempo'], answer: 0,
          explain: 'B runs into the +20 dBu ceiling: the loudest waves are flattened, which adds harsh harmonics. At equal loudness that grit is the only difference.',
        },
      },
    },
    {
      kind: 'match', instruction: 'Round 1: the target is clipping. Recreate it with GAIN and LO.', concept: 'gain-staging',
      setup: { ch1_gain: 0, ch1_lo: 0 },
      match: { target: { ch1_gain: 10, ch1_lo: 1, ch1_lomid: 1, ch1_himid: 1, master: 4.3 }, controls: ['ch1_gain', 'ch1_lo'] },
      hints: ['How crunchy is the kick?', 'Gain is all the way up, and the lows are boosted.', 'GAIN +10 dB, LO +6 dB.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'gain-staging',
      quiz: {
        question: 'The channel meter sits on +10 and the PK! LED beside GAIN is flashing. What do you turn down first?',
        options: ['That channel\'s GAIN', 'MASTER 1', 'The channel fader'], answer: 0,
        explain: 'PK! reads right after GAIN, before the EQ, so GAIN is the fix the guide gives. If the meter\'s +10 LED still stays lit, take back an EQ boost too: the meter reads after the EQ. The fader and MASTER 1 come later in the chain.',
      },
      manualReference: REF.gain,
    },
    {
      kind: 'match', instruction: 'Round 2: level, not distortion. How much quieter is the target?', concept: 'gain-staging',
      setup: { ch1_gain: 0, ch1_lo: 0, ch1_lomid: 0, ch1_himid: 0, master: 8 },
      match: { target: { ch1_gain: -10, ch1_lo: 0, ch1_lomid: 0, ch1_himid: 0, master: 8 }, controls: ['ch1_gain'] },
      hints: ['Clean, just quieter.', 'Quite a lot quieter.', 'GAIN about -10 dB.'],
    },
    {
      kind: 'listen', concept: 'filter-type', focus: ['f1_crunch', 'ch1_gain'],
      instruction: 'Interleaved: A and B are both gritty. One is clipping, one is the filter\'s CRUNCH.',
      listen: {
        a: { ch1_gain: 10, ch1_lo: 1, ch1_lomid: 1, ch1_himid: 1, master: 4.3 },
        b: { ch1_filter: 0, f1_on: true, f1_type: 0, f1_freq: 20, f1_crunch: 8 },
        labels: ['A', 'B'],
        question: {
          question: 'Which one lights the PK! LED beside channel 1\'s GAIN?',
          options: ['A: it is the channel running out of headroom', 'B', 'Both'], answer: 0,
          explain: 'CRUNCH distorts inside the filter section, after the channel\'s GAIN, EQ and meter, so PK! stays dark. A is the channel itself driven too hot at GAIN, and PK! says so.',
        },
      },
    },
    {
      kind: 'challenge', concept: 'gain-staging',
      instruction: 'Set channel 1 hot but clean: GAIN up for more level, no boosts, and PK! never lit.',
      checklist: [
        { text: 'GAIN between 0 and +6 dB', check: s => num(s, 'ch1_gain') >= 0 && num(s, 'ch1_gain') <= 6 },
        { text: 'No EQ boosts', check: s => ['ch1_hi', 'ch1_himid', 'ch1_lomid', 'ch1_lo'].every(c => num(s, c) <= 0.05) },
        { text: 'MASTER 1 back at unity (8)', check: s => Math.abs(num(s, 'master') - 8) <= 0.3 },
      ],
      hints: ['Start with the EQ flat.', 'At 0 dB the FULL MIX peaks near +6; the twin\'s PK! lights from +15.', 'GAIN about +3 dB, all EQ centred, MASTER 1 at 8.'],
      solution: { values: { ch1_gain: 3, ch1_hi: 0, ch1_himid: 0, ch1_lomid: 0, ch1_lo: 0, master: 8 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why compare clean and distorted sounds at the same loudness?',
        model: 'Louder always sounds better at first, so matching loudness makes me judge the distortion itself, not the volume.',
      },
    },
  ],
  review: [
    { question: 'Over-gain on a channel sounds…', options: ['Crunchy and flattened on the loudest hits', 'Muffled', 'Delayed'], answer: 0, explain: 'Clipping adds harmonics.' },
    { question: 'A channel\'s PK! LED keeps lighting. Fix it with…', options: ['Its GAIN', 'MASTER 1', 'The crossfader'], answer: 0, explain: 'PK! reads right after GAIN, before the EQ.' },
    { question: 'CRUNCH distortion happens…', options: ['In the filter section, after the channel meter', 'Before GAIN', 'In the headphones'], answer: 0, explain: 'Pre-filter, post-fader.' },
    { question: 'Compare distortion at…', options: ['Matched loudness', 'Full volume', 'Any level'], answer: 0, explain: 'Loudness fools the ear.' },
  ],
};

// ============================================================================
// STUDIO
// ============================================================================

const st1: Lesson = {
  id: 'xone96-st1-route', device: 'xone96', path: 'studio', order: 6, difficulty: 'intermediate',
  name: 'Route instruments into the Xone:96',
  description: 'Plug the Analog Rytm and the DFAM into mixer channels, find them on the strips, and switch a channel back to its deck.',
  objective: 'Route two instruments into Xone:96 channels and control where each channel takes its sound from.',
  source: 'Synth Studio · studio routing', estimatedMinutes: 8,
  requires: ['analog-rytm', 'dfam'],
  prerequisites: ['xone96-gain-staging'],
  concepts: ['signal-routing', 'mixing', 'gain-staging'],
  start: { reset: true, values: { ch4_src: SRC.PERC } },
  steps: [
    {
      kind: 'info', concept: 'signal-routing',
      instruction: 'In a studio every instrument gets its own mixer channel: its own GAIN, EQ, filter and fader. That is where a track gets balanced.',
      principle: 'Routing decides where a signal goes; a mixer channel gives it independent control.',
      explanation: 'In Synth Studio each instrument\'s Output menu (Studio tab) picks the master or a Xone:96 channel. A routed instrument plugs into that channel\'s LINE input (RTN on A and B).',
      manualReference: REF.studio,
    },
    {
      kind: 'challenge', concept: 'signal-routing',
      instruction: 'In the Studio tab, set the Analog Rytm\'s Output to Xone:96 · CH 1 (LINE).',
      checklist: [{ text: 'Analog Rytm → CH 1 (LINE)', check: s => routedTo(s, 'analog-rytm', 'studio_1') }],
      hints: ['Open the Studio tab at the top of the page.', 'Find the Analog Rytm\'s header: it has an Output menu.', 'Choose "Xone:96 · CH 1 (LINE)". Channel 1 now shows STUDIO: Analog Rytm.'],
    },
    {
      kind: 'challenge', concept: 'signal-routing',
      instruction: 'Now set the DFAM\'s Output to Xone:96 · CH 4 (LINE).',
      checklist: [{ text: 'DFAM → CH 4 (LINE)', check: s => routedTo(s, 'dfam', 'studio_4') }],
      hints: ['Same place: the DFAM\'s Output menu in the Studio tab.', 'Choose "Xone:96 · CH 4 (LINE)".'],
    },
    studioPlay,
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'The Rytm is routed to CH 1. What now sets how loud its drums are in the mix?',
        options: ['Channel 1\'s GAIN and fader', 'Only the Rytm\'s own volume', 'The DFAM\'s VOLUME'], answer: 0,
        explain: 'Its output now feeds channel 1, so channel 1\'s GAIN, EQ, filter and fader shape it. The Rytm\'s own level still sets how hot it arrives - which is why you set GAIN by the meter.',
      },
    },
    {
      kind: 'predict', control: 'ch4_input', targetValue: 1, concept: 'signal-routing',
      instruction: 'Set channel 4 INPUT to PHONO.',
      predict: {
        question: 'The DFAM is plugged into CH 4\'s LINE input. What does channel 4 play on PHONO?',
        options: ['Its built-in deck (PERC) instead of the DFAM', 'The DFAM', 'Silence'], answer: 0,
        explain: 'INPUT picks the socket. The DFAM is on LINE; PHONO is the built-in deck here. The DFAM keeps running, you just are not listening to it on this channel.',
      },
      principle: 'The input selector picks which socket feeds the channel.',
      manualReference: REF.inputs,
    },
    {
      kind: 'do', control: 'ch4_input', targetValue: 2, concept: 'signal-routing',
      instruction: 'Set channel 4 INPUT back to LINE: the DFAM again.',
      principle: 'Routing plus the input switch decide what each channel hears.',
    },
    {
      kind: 'do', control: 'ch4_fader', targetValue: 7, concept: 'mixing',
      instruction: 'Set channel 4\'s fader to about 7 so the DFAM sits under the Rytm.',
      principle: 'Balance is relative: decide what leads, then set the rest under it.',
    },
    {
      kind: 'challenge', concept: 'signal-routing',
      instruction: 'Unroute the DFAM (its Output back to Master out) and watch channel 4 go back to its deck.',
      checklist: [{ text: 'DFAM no longer routed into the Xone:96', check: s => !routedAnywhere(s, 'dfam') }],
      hints: ['The DFAM\'s Output menu again.', 'Choose "Master out". Channel 4\'s STUDIO label disappears and PERC plays.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between routing an instrument and setting a channel\'s INPUT?',
        model: 'Routing plugs the instrument into a channel\'s input socket; INPUT chooses which socket the channel actually listens to.',
      },
    },
  ],
  review: [
    { question: 'A routed studio instrument arrives on channel 1-4\'s…', options: ['LINE input', 'PHONO input', 'USB 1 input'], answer: 0, explain: 'RTN on A and B.' },
    { question: 'Unrouting an instrument from CH 4 makes channel 4…', options: ['Play its built-in deck again', 'Go silent forever', 'Keep the instrument'], answer: 0, explain: 'The deck is the channel\'s own source.' },
    { question: 'Why route drums into the mixer instead of the master?', options: ['To control their level, EQ and filter separately', 'To change their tempo', 'Because it is louder'], answer: 0, explain: 'Independent control.' },
  ],
};

const st2: Lesson = {
  id: 'xone96-st2-balance', device: 'xone96', path: 'studio', order: 7, difficulty: 'advanced',
  name: 'Balance a full track',
  description: 'Gain-stage several instruments, carve their EQ and set the faders so the whole track is clear and below the red.',
  objective: 'Balance drums and synths on the Xone:96 so every part is clear and the LR MIX stays out of the red.',
  source: 'Synth Studio · mixing practice', estimatedMinutes: 10,
  requires: ['analog-rytm', 'analog-four'],
  prerequisites: ['xone96-st1-route', 'xone96-low-end-clash'],
  concepts: ['mixing', 'gain-staging', 'equalization'],
  start: { reset: true, values: { ch1_src: SRC.DRUMS, ch2_src: SRC.BASS } },
  steps: [
    {
      kind: 'info', concept: 'mixing',
      instruction: 'A balanced mix has a leader (usually the drums), parts that sit under it, and room for each in level and frequency.',
      principle: 'Mixing is balance: each part needs its own space in level and in frequency.',
      explanation: 'The order works on any desk: set each channel\'s GAIN by the meter, push up the leader, fit the others under it, then carve with EQ.',
    },
    {
      kind: 'challenge', concept: 'signal-routing',
      instruction: 'Route the Analog Rytm to CH 1 and the Analog Four to CH 2 (Studio tab, Output menus).',
      checklist: [
        { text: 'Analog Rytm → CH 1', check: s => routedTo(s, 'analog-rytm', 'studio_1') },
        { text: 'Analog Four → CH 2', check: s => routedTo(s, 'analog-four', 'studio_2') },
      ],
      hints: ['Or load the "Elektron live" studio set: it routes both for you.', 'Each instrument header in the Studio tab has an Output menu.'],
    },
    studioPlay,
    {
      kind: 'predict', control: 'ch2_fader', targetValue: 0, concept: 'gain-staging',
      instruction: 'Pull channel 2\'s fader down so you hear the drums alone.',
      predict: {
        question: 'Does channel 2\'s meter stop moving with its fader down?',
        options: ['No: it reads before the fader, so you can still set GAIN', 'Yes', 'It shows the drums instead'], answer: 0,
        explain: 'Pre-fader metering is what lets you gain-stage a part silently, then bring it in at the right level.',
      },
      principle: 'Set every channel\'s input level before you balance the faders.',
      manualReference: REF.meters,
    },
    {
      kind: 'challenge', concept: 'gain-staging',
      instruction: 'Set channel 1 and channel 2 GAIN so each meter averages around 0 with peaks near +6.',
      checklist: [
        { text: 'Channel 1 GAIN between -12 and +10 dB', check: s => num(s, 'ch1_gain') >= -12 && num(s, 'ch1_gain') <= 10 },
        { text: 'Channel 2 GAIN between -12 and +10 dB', check: s => num(s, 'ch2_gain') >= -12 && num(s, 'ch2_gain') <= 10 },
      ],
      hints: ['Watch each channel meter, not the master.', 'If PK! flashes, turn that GAIN down; if only the green LEDs light, turn it up.', 'Most instruments land within a few dB of 0.'],
      solution: { values: { ch1_gain: 0, ch2_gain: 0 } },
    },
    {
      kind: 'do', control: 'ch1_fader', targetValue: 10, concept: 'mixing',
      instruction: 'The drums lead: channel 1 fader fully up.',
      principle: 'Start the balance from the part that drives the track.',
    },
    {
      kind: 'do', control: 'ch2_fader', targetValue: 7.5, concept: 'mixing',
      instruction: 'Bring channel 2 up under the drums, to about 7.5.',
      principle: 'Supporting parts sit just under the leader, not level with it.',
      explanation: 'On the CONST PWR channel curve 7.5 is about -12 dB (the guide\'s curve graph): clearly under the drums, still easy to hear. The taper is gentle near the top, so small moves there are fine trims.',
      manualReference: REF.fader,
    },
    {
      kind: 'listen', concept: 'mixing', focus: ['ch2_lo'],
      instruction: 'Compare channel 2 flat with its LO trimmed.',
      listen: {
        a: { ch2_lo: 0 }, b: { ch2_lo: -0.29 }, labels: ['Flat', 'LO -6 dB'],
        question: {
          question: 'Which one lets the kick punch through?',
          options: ['LO trimmed: the synth leaves the kick its band', 'Flat', 'No difference'], answer: 0,
          explain: 'Synths often carry more low end than they need in a mix. Trimming it frees the band the kick lives in.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'gain-staging',
      quiz: {
        question: 'The LR MIX meters keep lighting their top LED, PK!. What do you turn down first?',
        options: ['Channel GAIN, EQ boosts or faders', 'MASTER 1', 'The booth'], answer: 0,
        explain: 'The LR MIX meters read before MASTER 1, so only the channels feeding the mix can bring them down: check that no channel is clipping at GAIN or EQ, then take the faders down if needed. MASTER 1 changes how loud the output is, not how hot the mix bus runs.',
      },
      manualReference: REF.master,
    },
    {
      kind: 'challenge', concept: 'mixing',
      instruction: 'Finish the balance: drums leading, the synth under them with its LO trimmed, and a touch of reverb on the synth.',
      checklist: [
        { text: 'Drums up (channel 1 fader 9 or more)', check: s => num(s, 'ch1_fader') >= 9 },
        { text: 'Synth under them (channel 2 fader 5 to 9)', check: s => num(s, 'ch2_fader') >= 5 && num(s, 'ch2_fader') <= 9 },
        { text: 'Channel 2 LO trimmed, not killed', check: s => num(s, 'ch2_lo') <= -0.1 && num(s, 'ch2_lo') >= -0.8 },
        { text: 'Channel 2 SEND 2 (reverb) between 1 and 4', check: s => num(s, 'ch2_snd2') >= 1 && num(s, 'ch2_snd2') <= 4 },
      ],
      hints: ['You set the faders already.', 'Trim channel 2 LO a little, then add SEND 2.', 'Channel 2 LO about -6 dB, SEND 2 about 2.5.'],
      solution: { values: { ch1_fader: 10, ch2_fader: 7.5, ch2_lo: -0.29, ch2_snd2: 2.5 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In what order do you balance a mix, and why?',
        model: 'GAIN first by the meters, then the leading part\'s fader, then the others under it, then EQ cuts to give each its band - so each step builds on a clean level.',
      },
    },
  ],
  review: [
    { question: 'Balance a mix starting from…', options: ['The leading part, usually the drums', 'The quietest part', 'The master'], answer: 0, explain: 'Fit the rest under it.' },
    { question: 'LR MIX on PK!: first fix?', options: ['Channel GAIN, EQ or faders', 'MASTER 1', 'Headphone level'], answer: 0, explain: 'The meters read before MASTER 1.' },
    { question: 'A synth masking the kick usually needs…', options: ['A LO cut', 'A LO boost', 'More reverb'], answer: 0, explain: 'Free the kick\'s band.' },
    { question: 'Gain-stage a channel with its fader…', options: ['Down, using the pre-fader meter', 'Fully up', 'At half'], answer: 0, explain: 'Silently, by the meter.' },
  ],
};

const st3: Lesson = {
  id: 'xone96-st3-mixdown', device: 'xone96', path: 'studio', order: 8, difficulty: 'advanced',
  name: 'Mix down your studio jam',
  description: 'Turn your own jam into a track: an intro, a filtered build, a drop and a reverb-washed ending, then record it.',
  objective: 'Perform a mix-down of your studio jam on the Xone:96: intro, build, drop and outro, recorded with REC.',
  source: 'Synth Studio · arranging and mixing', estimatedMinutes: 12,
  prerequisites: ['xone96-st2-balance', 'xone96-filter-sweeps'],
  concepts: ['mixing', 'dj-mixing', 'effects', 'filter-cutoff'],
  start: { reset: true, values: { ch1_src: SRC.DRUMS, ch2_src: SRC.BASS, ch3_src: SRC.STABS } },
  steps: [
    {
      kind: 'info', concept: 'mixing',
      instruction: 'A mix-down is a performance: you shape the arrangement with faders, filters and sends as it plays.',
      principle: 'Arrangement is contrast over time: parts enter, leave and change.',
      explanation: 'Route your own instruments into channels 1-3 (Studio tab). Until you do, the built-in DRUMS, BASS and STABS decks stand in. Any instrument works, including an Audio input or a Web Audio plugin.',
    },
    {
      kind: 'challenge', concept: 'signal-routing',
      instruction: 'Route at least two of your instruments into Xone:96 channels.',
      checklist: [{ text: 'Two or more instruments feed the Xone:96', check: s => routedCount(s) >= 2 }],
      hints: ['Studio tab: each instrument\'s Output menu.', 'Use CH 1-4 for your main parts and RTN C/D for extras.'],
    },
    studioPlay,
    {
      kind: 'do', control: 'ch2_fader', targetValue: 0, concept: 'mixing',
      instruction: 'Intro: pull channel 2 down so only the drums (channel 1) play.',
      principle: 'An intro starts sparse so later entries have impact.',
    },
    {
      kind: 'do', control: 'ch3_fader', targetValue: 0, concept: 'mixing',
      instruction: 'And channel 3 down too.',
      principle: 'Fewer parts leave room for each new part to be heard as it arrives.',
    },
    {
      kind: 'do', control: 'ch2_fader', targetValue: 8, concept: 'mixing',
      instruction: 'On the next phrase, bring channel 2 in (to about 8).',
      principle: 'Entries on phrase boundaries feel inevitable.',
    },
    {
      kind: 'challenge', concept: 'filter-cutoff',
      instruction: 'Build: put channel 1 through FILTER 1 as a rising high-pass with some resonance.',
      checklist: [
        { text: 'Channel 1 on FILTER 1, ON', check: s => num(s, 'ch1_filter') === 0 && !!s.values.f1_on },
        { text: 'HPF, FREQ 200 Hz or higher', check: s => num(s, 'f1_type') === 0 && num(s, 'f1_freq') >= 200 },
        { text: 'RES at 4 or more', check: s => num(s, 'f1_res') >= 4 },
      ],
      hints: ['FILTER switch on channel 1 to 1, then ON.', 'Sweep FREQ up slowly over a phrase.', 'HPF, FREQ around 500 Hz, RES 6.'],
      solution: { values: { ch1_filter: 0, f1_on: true, f1_type: 0, f1_freq: 500, f1_res: 6 } },
    },
    {
      kind: 'predict', control: 'f1_freq', targetValue: 20, concept: 'filter-cutoff',
      instruction: 'Drop: on the "1" of the next phrase, snap FILTER 1 FREQ back to 20 Hz.',
      predict: {
        question: 'Why does snapping the filter open feel like a drop?',
        options: ['The bass and kick return all at once after being held back', 'The tempo doubles', 'The track gets quieter'], answer: 0,
        explain: 'The build removed the low end bit by bit, so its sudden return is a big contrast - the release after the tension.',
      },
      principle: 'Tension and release: take something away, then give it back at once.',
    },
    {
      kind: 'do', control: 'ch3_fader', targetValue: 8, concept: 'mixing',
      instruction: 'Bring channel 3 in for the main section.',
      principle: 'The fullest section comes after the drop.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'effects',
      quiz: {
        question: 'For a washed-out ending, which send do you raise as you pull the faders down?',
        options: ['SEND 2 (reverb) - but it is post-fader, so raise it before the faders come down', 'SEND 1 on PRE only', 'No send: use MASTER 1'], answer: 0,
        explain: 'SEND 2 is post-fader: push it up while the fader is still up, then fade the fader and the reverb tail rings out. A PRE SEND 1 would keep feeding the delay with the fader down, which is a different effect.',
      },
    },
    {
      kind: 'challenge', concept: 'effects',
      instruction: 'Outro: give channel 3 a big reverb send, then fade channels 1 and 2 out.',
      checklist: [
        { text: 'Channel 3 SEND 2 at 5 or more', check: s => num(s, 'ch3_snd2') >= 5 },
        { text: 'Channels 1 and 2 faded out', check: s => num(s, 'ch1_fader') <= 1 && num(s, 'ch2_fader') <= 1 },
      ],
      hints: ['Send first, fade second.', 'Channel 3 SEND 2 to 6, then pull channels 1 and 2 down.'],
      solution: { values: { ch3_snd2: 6, ch1_fader: 0, ch2_fader: 0 } },
    },
    {
      kind: 'info', concept: 'mixing',
      instruction: 'Now do it for real: press REC in the top bar, play your mix-down from intro to outro, then press REC again to save the WAV.',
      principle: 'Recording a take makes you commit, and lets you listen back with fresh ears.',
      explanation: 'Tip: the song arranger (Studio tab) can store these fader moves per section as snapshots, so the mix-down plays itself.',
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Which move in your mix-down made the biggest contrast, and why?',
        model: 'The drop: the high-pass build took the low end away, so snapping it back made the kick and bass hit harder than if they had played all along.',
      },
    },
  ],
  review: [
    { question: 'A filter build that snaps open on the "1" creates…', options: ['A drop: tension then release', 'A tempo change', 'A key change'], answer: 0, explain: 'Contrast.' },
    { question: 'For a reverb-washed ending with a post-fader send…', options: ['Raise the send, then fade the fader', 'Fade first, then raise the send', 'Use MASTER 1'], answer: 0, explain: 'Post-fader sends follow the fader.' },
    { question: 'An intro usually starts…', options: ['Sparse', 'With everything', 'With the outro'], answer: 0, explain: 'Leave room for entries.' },
  ],
};

export const XONE96_LESSONS: Lesson[] = [f1, f2, f3, f4, f5, f6, f7, f8, p1, p2, p3, e1, e2, e3, e4, st1, st2, st3];
