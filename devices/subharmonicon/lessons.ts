// ============================================================================
// Moog Subharmonicon lessons (v2, docs/PEDAGOGY.md; lesson API v3 presses)
//
// Paths: foundations (oscillators and subharmonics -> waves and mixer -> filter
// -> envelopes -> sequencers -> rhythm generators), sound design, ear training
// (one divisor wide -> fine -> two controls -> just vs equal -> three mixed),
// sequencing (rhythm logic, intertwined and undertone sequences), performance and
// studio. Outlines: docs/research/subharmonicon/lessons.md.
//
// Conventions: SUB FREQ and RHYTHM knobs store the negated divisor (D(3) = ÷3);
// every match step that grades a divisor uses tolerance 0.03 (one detent is 1/15 of
// the travel). Start states build on Moog's initialized patch (Patching with
// Intention p.3). In the studio the Subharmonicon follows the studio clock like MIDI:
// PLAY starts the studio transport and the master pulse is a 16th note, so TEMPO is
// heard in the Listen comparisons and with sync off.
// ============================================================================

import type { ControlValue, Lesson, LessonCheckState, LessonStep, MultipleChoice } from '@/types';
import { INITIALIZED_PATCH, SUBHARMONICON_PRESETS } from './presets';

const DEV = 'subharmonicon';
const D = (n: number) => -n;
const SRC = 'Synth Studio · Moog Subharmonicon Owner\'s Manual';

// ---------------------------------------------------------------- helpers

const num = (s: LessonCheckState, id: string) => Number(s.values[id] ?? 0);
const bool = (s: LessonCheckState, id: string) => !!s.values[id];
const cable = (s: LessonCheckState, from: string, to: string) =>
  s.patches.some(c => (c.from === from && c.to === to) || (c.from === to && c.to === from));
const studioCable = (s: LessonCheckState, fromJack: string, toJack: string, fromDevice: string, toDevice: string) =>
  s.studioCables.some(c => {
    const dev = (inst: string) => s.instances[inst]?.device;
    return (c.from.jack === fromJack && c.to.jack === toJack && dev(c.from.instance) === fromDevice && dev(c.to.instance) === toDevice) ||
      (c.to.jack === fromJack && c.from.jack === toJack && dev(c.to.instance) === fromDevice && dev(c.from.instance) === toDevice);
  });
const deviceValues = (s: LessonCheckState, device: string) => Object.values(s.instances).find(i => i.device === device)?.values ?? {};
/** Nearest semitone of a VCO FREQ value above C4 */
const semitoneOf = (hz: number) => Math.round(12 * Math.log2(hz / 261.63));

type V = Record<string, ControlValue>;
/** Moog's initialized patch plus the lesson's own settings */
const init = (values: V = {}): Lesson['start'] => ({ reset: true, values: { ...INITIALIZED_PATCH, ...values } });
/** A preset's settings plus the lesson's own (presets list every setting) */
const fromPreset = (key: string, values: V = {}): Lesson['start'] => ({
  reset: true,
  values: { ...SUBHARMONICON_PRESETS[key].settings, ...values },
  patches: SUBHARMONICON_PRESETS[key].patchConnections ?? [],
});
const mc = (question: string, options: string[], answer: number, explain: string): MultipleChoice => ({ question, options, answer, explain });

const play = (instruction: string, principle: string): LessonStep => ({
  kind: 'do', control: 'play', targetValue: true, concept: 'sequencer-pattern',
  instruction, principle,
  explanation: 'In the studio PLAY also starts the studio clock: synced, the Subharmonicon counts the studio\'s 16th notes (MIDI clock, manual p.25).',
  manualReference: 'p.28 – PLAY',
});

// ============================================================================
// FOUNDATIONS
// ============================================================================

const f1: Lesson = {
  id: 'subharmonicon-f1-undertones', device: DEV, path: 'foundations', order: 1, difficulty: 'beginner',
  name: 'One oscillator, many undertones',
  description: 'What a subharmonic is: one oscillator divided by whole numbers - ÷2 an octave down, ÷3 a new note below.',
  objective: 'Set SUB 1 FREQ to a chosen divisor and name the interval it makes under VCO 1.',
  source: `${SRC}, Oscillators (pp.18-19)`, estimatedMinutes: 6,
  concepts: ['subharmonics', 'oscillator-pitch'],
  start: init({ eg_mode: 2, vco1_freq: 1046.5, vco1_level: 50, vco1_sub1_level: 0, vco1_sub1_freq: D(1), volume: 40, cutoff: 3000 }),
  steps: [
    {
      kind: 'listen', concept: 'subharmonics', focus: ['vco1_sub1_level', 'vco1_sub1_freq'], scope: 'spectrum',
      instruction: 'Here is where we are going: one oscillator, then the same oscillator with a new note growing underneath it.',
      listen: { a: { vco1_sub1_level: 0 }, b: { vco1_sub1_level: 70, vco1_sub1_freq: D(3) }, labels: ['VCO alone', 'VCO + an undertone'] },
    },
    {
      kind: 'do', control: 'vco1_sub1_level', targetValue: 70, concept: 'mixing',
      instruction: 'Raise SUB 1 LEVEL to about 70%. EG is held (blinking), so the sound is a steady drone.',
      principle: 'A divider set to ÷1 copies the oscillator in unison, so it only thickens the sound.',
      explanation: 'SUB 1 FREQ is fully clockwise, ÷1: the sub plays exactly the VCO\'s note. Every cycle of one lines up with a cycle of the other, so they merge.',
      manualReference: 'p.18 – SUB 1 FREQ',
    },
    {
      kind: 'predict', control: 'vco1_sub1_freq', targetValue: D(2), concept: 'subharmonics',
      instruction: 'Turn SUB 1 FREQ one click counter-clockwise, to ÷2.',
      predict: mc('SUB 1 goes from ÷1 to ÷2. What happens to its pitch?',
        ['It drops exactly one octave', 'It rises one octave', 'It drops a semitone', 'Only its volume changes'], 0,
        'Halving a frequency drops it one octave: 1046 Hz becomes 523 Hz. Undertones only ever sit below the oscillator, never above, and the first steps are much bigger than a semitone.'),
      principle: 'Dividing a frequency by 2 lowers it by exactly one octave.',
      manualReference: 'p.18 – SUB 1 FREQ',
    },
    {
      kind: 'do', control: 'vco1_sub1_freq', targetValue: D(3), concept: 'subharmonics', scope: 'spectrum',
      instruction: 'One more click, to ÷3.',
      principle: 'Dividing by 3 lands an octave and a fifth below: a new note, not a copy.',
      explanation: '1046.5 ÷ 3 ≈ 349 Hz, an F. Undertones bring new note names in underneath the oscillator\'s C - the mirror image of the overtones above it.',
    },
    {
      kind: 'listen', concept: 'subharmonics', focus: ['vco1_sub1_freq'],
      instruction: 'Compare ÷2 and ÷3 under the same C.',
      listen: {
        a: { vco1_sub1_freq: D(2) }, b: { vco1_sub1_freq: D(3) }, labels: ['÷2', '÷3'],
        question: mc('Which one sounds like the same note, only lower?', ['÷2', '÷3', 'Both equally'], 0,
          '÷2 is an octave, so it blends into the C like a deeper copy. ÷3 adds an F underneath - a different note name, which is why it stands out.'),
      },
    },
    {
      kind: 'do', control: 'vco1_sub1_freq', targetValue: D(4), concept: 'subharmonics',
      instruction: 'Step on to ÷4.',
      principle: 'Divisors that are powers of two (2, 4, 8, 16) always give octaves.',
      explanation: '÷4 halves the frequency twice: two octaves down, C again.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'subharmonics',
      quiz: mc('VCO 1 plays C6 (1046 Hz). Which SUB 1 FREQ gives C4 (262 Hz)?', ['÷2', '÷4', '÷6', '÷8'], 1,
        '1046 ÷ 4 ≈ 262 Hz, two octaves down. ÷2 is only one octave (523 Hz), and ÷8 would reach C3 (131 Hz).'),
    },
    {
      kind: 'match', instruction: 'Ear challenge: find the target - a new note an octave and a fifth below the C.', concept: 'subharmonics',
      setup: { vco1_sub1_freq: D(8) },
      match: { target: { vco1_sub1_freq: D(3), vco1_sub1_level: 70, vco1_level: 30 }, controls: ['vco1_sub1_freq'], tolerance: 0.03 },
      hints: ['It is not an octave: listen for a different note name.', 'Count clicks from fully clockwise: ÷1 is the first.', 'Try ÷3.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence: how is a subharmonic different from an overtone?',
        model: 'An overtone multiplies the frequency and sits above the note, while a subharmonic divides it and sits below, so the Subharmonicon builds notes underneath its oscillators.',
      },
    },
  ],
  review: [
    mc('SUB FREQ fully clockwise is…', ['÷1, in unison with the VCO', '÷16, the lowest undertone', 'The sub switched off'], 0, 'Clockwise is ÷1; counter-clockwise steps down to ÷16.'),
    mc('Which divisors always give octaves?', ['2, 4, 8, 16', '3, 6, 9, 12', '5, 10, 15'], 0, 'Repeated halving gives octaves; 3, 6 and 12 give fifths.'),
    mc('VCO at 600 Hz, SUB at ÷3. The sub plays…', ['200 Hz', '1800 Hz', '300 Hz'], 0, 'Divide, do not multiply: 1800 Hz would be the third overtone.'),
    mc('Why can a sub never beat against its own VCO?', ['It is an exact whole-number division of that VCO', 'The filter removes the beats', 'It is always quieter'], 0, 'Its cycles are counted from the VCO\'s cycles, so the ratio is locked.'),
  ],
};

const f2: Lesson = {
  id: 'subharmonicon-f2-waves-mixer', device: DEV, path: 'foundations', order: 2, difficulty: 'beginner',
  name: 'Waves, the hidden PWM and a hot mixer',
  description: 'The three WAVE positions - square, pulse swept by the sub, saw - and a mixer that saturates when pushed.',
  objective: 'Choose a WAVE position for a timbre, and use the mixer either clean or deliberately warm.',
  source: `${SRC}, Waveform and Mixer (pp.19-22)`, estimatedMinutes: 7,
  prerequisites: ['subharmonicon-f1-undertones'],
  concepts: ['oscillator-waveform', 'mixing', 'gain-staging'],
  start: init({ eg_mode: 2, vco1_freq: 523.25, vco1_level: 50, vco1_sub1_freq: D(2), vco1_sub1_level: 0, vco1_wave: 0, volume: 40, cutoff: 5000 }),
  steps: [
    {
      kind: 'listen', concept: 'oscillator-waveform', focus: ['vco1_wave'], scope: 'spectrum',
      instruction: 'Square and saw: the same pitch, a different colour.',
      listen: {
        a: { vco1_wave: 0 }, b: { vco1_wave: 2 }, labels: ['Square (UP)', 'Saw (DOWN)'],
        question: mc('Which one sounds hollower?', ['The square', 'The saw', 'Neither'], 0,
          'A square has only odd harmonics, which sounds hollow, like a clarinet. A saw has every harmonic, so it is brighter and buzzier.'),
      },
    },
    {
      kind: 'do', control: 'vco1_wave', targetValue: 2, concept: 'oscillator-waveform',
      instruction: 'Flip VCO 1 WAVE down to the saw.',
      principle: 'A sawtooth contains every harmonic, so it sounds brighter than a square.',
      manualReference: 'p.19 – Waveform switch',
    },
    {
      kind: 'do', control: 'vco1_sub1_level', targetValue: 50, concept: 'mixing',
      instruction: 'Raise SUB 1 LEVEL to about 50%: the octave-down sub joins in, also as a saw.',
      principle: 'One switch sets the waveform of an oscillator and both of its subharmonics.',
    },
    {
      kind: 'predict', control: 'vco1_wave', targetValue: 1, concept: 'oscillator-waveform', setup: { vco1_sub1_level: 0 },
      instruction: 'SUB 1 is muted again. Set VCO 1 WAVE to the middle position.',
      predict: mc('In MIDDLE, SUB 1\'s saw sweeps VCO 1\'s pulse width. With SUB 1 LEVEL at zero, what do you hear?',
        ['A plain square', 'A pulse whose shape repeats every second cycle, hinting at a lower pitch', 'Silence'], 1,
        'The internal PWM link works even with SUB 1 muted, so VCO 1\'s wave only repeats every two cycles and a lower pitch appears (manual p.19 tip). It is not a plain square, because the pulse width keeps moving.'),
      principle: 'Modulating a wave at a fraction of its own frequency adds lower pitches to it.',
      manualReference: 'p.19 – Waveform switch, MIDDLE',
    },
    {
      kind: 'do', control: 'vco1_sub1_freq', targetValue: D(4), concept: 'oscillator-waveform', scope: 'spectrum',
      instruction: 'Turn SUB 1 FREQ to ÷4 and listen to VCO 1 alone.',
      principle: 'A slower modulator makes the wave repeat less often, so the implied pitch drops.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'oscillator-waveform',
      quiz: mc('Which move replaces the built-in PWM source?', ['Patching a signal into VCO 1 PWM', 'Raising SUB 1 LEVEL', 'Turning VCF EG AMT'], 0,
        'A cable in VCO 1 PWM overrides the SUB 1 saw (manual p.32). SUB 1 LEVEL only sets how loud SUB 1 is in the mixer.'),
    },
    {
      kind: 'listen', concept: 'gain-staging', focus: ['vco1_level', 'vco1_sub1_level', 'vco1_sub2_level'],
      instruction: 'Compare moderate levels with everything pushed up.',
      listen: {
        a: { vco1_level: 40, vco1_sub1_level: 40, vco1_sub2_level: 0, volume: 40 },
        b: { vco1_level: 100, vco1_sub1_level: 100, vco1_sub2_level: 100, vco1_sub2_freq: D(3), volume: 22 },
        labels: ['Moderate', 'Pushed'],
        question: mc('Besides loudness, what changes?', ['It thickens and distorts warmly', 'The pitch drops', 'Nothing'], 0,
          'Several sources near maximum overdrive the mixer before the filter (manual p.21). B is turned down so the two play at a similar volume - the grit is the saturation, not loudness.'),
      },
    },
    {
      kind: 'challenge', concept: 'oscillator-waveform',
      instruction: 'Make a reedy, hollow lead with a hint of the octave below, and no audible overdrive.',
      checklist: [
        { text: 'WAVE up or in the middle', check: s => num(s, 'vco1_wave') <= 1 },
        { text: 'SUB 1 at ÷2', check: s => num(s, 'vco1_sub1_freq') === -2 },
        { text: 'Mixer kept moderate', check: s => num(s, 'vco1_level') + num(s, 'vco1_sub1_level') + num(s, 'vco1_sub2_level') <= 150 },
      ],
      hints: ['Hollow means square or pulse.', 'The octave below is SUB 1 at ÷2.', 'Keep the three levels together under about 150%.'],
      solution: { values: { vco1_wave: 1, vco1_sub1_freq: D(2), vco1_level: 60, vco1_sub1_level: 25, vco1_sub2_level: 0 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why can the MIDDLE position add a lower pitch even with SUB 1 muted?',
        model: 'SUB 1\'s saw keeps sweeping VCO 1\'s pulse width at the sub\'s frequency, so the VCO\'s wave only repeats every n cycles.',
      },
    },
  ],
  review: [
    mc('WAVE up gives…', ['Square on the VCO and both subs', 'Saw on the VCO only', 'Noise'], 0, 'One switch per VCO sets all three waves (manual p.19).'),
    mc('In MIDDLE, the subs put out…', ['Saws', 'Squares', 'Nothing'], 0, 'MIDDLE means a pulse VCO with saw subs.'),
    mc('For a cleaner sound, set the mixer…', ['At moderate levels', 'With everything at maximum', 'With only the subs at maximum'], 0, 'Hot levels drive the mixer into distortion.'),
    mc('A cable into VCO 1 PWM…', ['Replaces the SUB 1 saw as the PWM source', 'Changes VCO 1\'s pitch', 'Mutes SUB 1'], 0, 'It overrides the normal (manual p.32).'),
  ],
};

const f3: Lesson = {
  id: 'subharmonicon-f3-filter', device: DEV, path: 'foundations', order: 3, difficulty: 'beginner',
  name: 'The ladder filter and its envelope',
  description: 'CUTOFF, RESONANCE and VCF EG AMT on the Moog ladder: brightness, ring and movement.',
  objective: 'Use CUTOFF, RESONANCE and VCF EG AMT (both signs) to set brightness, ring and movement.',
  source: `${SRC}, Filter and VCF EG (pp.23-24)`, estimatedMinutes: 7,
  prerequisites: ['subharmonicon-f2-waves-mixer'],
  concepts: ['filter-cutoff', 'filter-resonance', 'modulation-depth'],
  start: init({
    rhythm1: D(4), rhythm1_seq1: true, tempo: 616,
    vco1_freq: 523.25, vco1_wave: 2, vco1_sub1_freq: D(2), vco1_sub1_level: 40,
    cutoff: 2000, resonance: 0, vcf_eg_amt: 0, vcf_decay: 300, vca_decay: 400, volume: 70,
  }),
  steps: [
    play('Press PLAY: a steady pulse of bright saw notes.', 'A low-pass filter passes frequencies below its cutoff and removes those above.'),
    {
      kind: 'predict', control: 'cutoff', targetValue: 250, concept: 'filter-cutoff', scope: 'spectrum',
      instruction: 'Turn CUTOFF down to about 250 Hz.',
      predict: mc('What will lowering CUTOFF do?', ['Make it darker and duller', 'Lower the pitch', 'Slow the rhythm'], 0,
        'The filter removes the upper harmonics, so the tone darkens. The pitch comes from the VCO, not the filter - it can seem lower only because the brightness is gone.'),
      principle: 'Lowering cutoff removes upper harmonics, so the same note sounds darker.',
      manualReference: 'p.23 – CUTOFF',
    },
    {
      kind: 'do', control: 'resonance', targetValue: 70, concept: 'filter-resonance', scope: 'spectrum',
      instruction: 'Raise RESONANCE to about 70%, then sweep CUTOFF slowly.',
      principle: 'Resonance boosts frequencies at the cutoff, so the filter rings at that pitch.',
      explanation: 'Near maximum, with a low cutoff, this ladder rings on its own - it self-oscillates (manual p.23). Like any ladder it also loses some bass as resonance rises.',
    },
    {
      kind: 'listen', concept: 'filter-resonance', focus: ['resonance'],
      instruction: 'Compare no resonance with high resonance.',
      listen: {
        a: { resonance: 0, cutoff: 400 }, b: { resonance: 85, cutoff: 400 }, labels: ['RES 0', 'RES 85%'],
        question: mc('Which one whistles or rings?', ['A', 'B'], 1, 'High resonance makes a narrow peak that rings at the cutoff.'),
      },
    },
    {
      kind: 'do', control: 'vcf_eg_amt', targetValue: 60, concept: 'modulation-depth', setup: { resonance: 20 },
      instruction: 'RESONANCE is back at 20%. Turn VCF EG AMT to about +60% (3 o\'clock).',
      principle: 'A positive envelope amount opens the filter at each note, then lets it close.',
      manualReference: 'p.24 – VCF EG AMT',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'modulation-depth',
      quiz: mc('VCF EG AMT is turned to about -60%. Each note now…', ['Starts dark and brightens as the envelope decays', 'Starts bright and closes', 'Has no filter movement'], 0,
        'Inverse amounts close the filter on the attack and open it again on the decay (manual p.24). "Starts bright" is what a positive amount does.'),
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target tone.', concept: 'filter-resonance', setup: { vcf_eg_amt: 40 },
      match: { target: { cutoff: 500, resonance: 60, vcf_eg_amt: 40 }, controls: ['cutoff', 'resonance'] },
      hints: ['It rings: which knob adds ringing?', 'RESONANCE is fairly high; CUTOFF sits in the low mids.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence: what does VCF EG AMT do, and what does its sign change?',
        model: 'It sets how far the envelope moves the cutoff: clockwise opens the filter on each note, counter-clockwise closes it.',
      },
    },
  ],
  review: [
    mc('Lowering CUTOFF on this low-pass filter…', ['Removes high harmonics', 'Lowers the pitch', 'Adds distortion'], 0, 'Pitch is set by the VCO.'),
    mc('The Subharmonicon\'s filter is a…', ['4-pole ladder low-pass', 'Switchable low-pass / high-pass', '2-pole band-pass'], 0, 'Low-pass only, 24 dB per octave (manual p.23).'),
    mc('VCF EG AMT at 12 o\'clock means…', ['No envelope effect', 'Full positive', 'Full negative'], 0, 'It is bipolar: centre is none.'),
    mc('To make the filter ring at its cutoff, raise…', ['RESONANCE', 'VOLUME', 'TEMPO'], 0, 'Resonance feeds the output back around the cutoff.'),
  ],
};

const f4: Lesson = {
  id: 'subharmonicon-f4-envelopes', device: DEV, path: 'foundations', order: 4, difficulty: 'beginner',
  name: 'Envelopes and the EG button',
  description: 'Attack and decay, the lock-out during the attack, and the EG button\'s OFF, ON and HELD.',
  objective: 'Shape notes with ATTACK and DECAY, and choose OFF, ON or HELD on the EG button.',
  source: `${SRC}, Envelope generators and EG (pp.24-30)`, estimatedMinutes: 8,
  prerequisites: ['subharmonicon-f3-filter'],
  concepts: ['envelope-attack', 'envelope-decay', 'envelope-shape'],
  start: init({
    rhythm1: D(4), rhythm1_seq1: true, tempo: 616,
    vco1_freq: 523.25, vco1_wave: 2, vco1_sub1_freq: D(2), vco1_sub1_level: 40,
    cutoff: 3000, resonance: 0, vcf_eg_amt: 40, vcf_decay: 300, vca_attack: 1, vca_decay: 200, volume: 75,
  }),
  steps: [
    play('Press PLAY: short plucks, one on every step.', 'An envelope shapes a note over time: rising in the attack, falling in the decay.'),
    {
      kind: 'predict', control: 'vca_decay', targetValue: 1500, concept: 'envelope-decay',
      instruction: 'Turn VCA DECAY up to about 1.5 s.',
      predict: mc('The notes still come at the same rate. What happens?', ['Notes ring into each other, smoother and longer', 'Notes get shorter', 'The pitch rises'], 0,
        'A longer decay lets each note fade slowly, so it overlaps the next. Decay changes length, not pitch.'),
      principle: 'A longer decay makes each note fade out more slowly.',
      manualReference: 'p.25 – VCA DECAY',
    },
    {
      kind: 'do', control: 'vca_attack', targetValue: 300, concept: 'envelope-attack',
      instruction: 'Set VCA ATTACK to about 0.3 s.',
      principle: 'A slow attack fades each note in, softening its start.',
      manualReference: 'p.24 – VCA ATTACK',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-attack',
      quiz: mc('VCA ATTACK is 1 s but notes arrive every 0.4 s. What happens to triggers that land during the attack?',
        ['They are ignored until the attack finishes', 'Each one restarts the attack', 'They double the volume'], 0,
        'On the Subharmonicon both envelopes ignore new triggers while they are in their attack (manual p.24). Many synths restart instead, which makes the second option tempting.'),
    },
    {
      kind: 'do', control: 'eg_mode', targetValue: 0, concept: 'envelope-shape', setup: { vca_attack: 1, vca_decay: 400 },
      instruction: 'The attack is short again. Tap EG so it goes dark (OFF).',
      principle: 'If nothing triggers the envelope, the amplifier stays closed and you hear silence.',
      explanation: 'The sequence keeps stepping, but with EG off its steps no longer fire the envelopes.',
      manualReference: 'p.29 – EG',
    },
    {
      kind: 'do', control: 'trigger', targetValue: true, concept: 'envelope-shape',
      instruction: 'Press and hold TRIGGER for a moment, then let go. With EG off it is a gate.',
      principle: 'A gate holds an envelope at its peak for as long as it lasts, then lets it decay.',
      explanation: 'With EG off the TRIGGER button is a gate: Attack, hold at maximum while pressed, Decay on release (manual p.29). The keys do the same while the sequencers are stopped: on an EG-off patch a held key keeps the sound at full VOLUME, much louder than the short steps, until you let go. Tap for short notes.',
      manualReference: 'p.29 – TRIGGER',
    },
    {
      kind: 'do', control: 'eg_mode', targetValue: 2, concept: 'envelope-sustain',
      instruction: 'Press and hold EG until it blinks (or tap HELD under it): a continuous drone.',
      principle: 'Holding an envelope at its peak turns repeating notes into a drone.',
      manualReference: 'p.30 – EG, HELD',
    },
    {
      kind: 'listen', concept: 'envelope-sustain', focus: ['eg_mode'],
      instruction: 'Compare ON and HELD.',
      listen: {
        a: { eg_mode: 1 }, b: { eg_mode: 2 }, labels: ['ON', 'HELD'],
        question: mc('Which setting would you use to tune a chord by ear?', ['ON', 'HELD'], 1, 'HELD keeps the sound steady, so you can tune pitches without the notes stopping.'),
      },
    },
    {
      kind: 'challenge', concept: 'envelope-shape',
      instruction: 'Make a soft pad: notes that swell in and overlap, with no clicks.',
      checklist: [
        { text: 'EG on (lit)', check: s => num(s, 'eg_mode') === 1 },
        { text: 'VCA ATTACK 150 ms or more', check: s => num(s, 'vca_attack') >= 150 },
        { text: 'VCA DECAY 0.8 s or more', check: s => num(s, 'vca_decay') >= 800 },
      ],
      hints: ['Swelling in means attack.', 'Overlapping means a long decay.', 'Try ATTACK about 0.3 s and DECAY about 1.5 s with EG lit.'],
      solution: { values: { eg_mode: 1, vca_attack: 300, vca_decay: 1500, vcf_attack: 200, vcf_decay: 1200 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'When would you choose EG OFF instead of ON?',
        model: 'When I want something other than the sequencer steps to fire the notes - the TRIGGER button, the TRIGGER input or a clock cable - while the sequencers still change the pitches.',
      },
    },
  ],
  review: [
    mc('The Subharmonicon\'s ATTACK and DECAY ranges are…', ['1 ms-10 s and 5 ms-10 s', 'Both 1 ms-1 s', '10 ms-100 s'], 0, 'Manual pp.24-25.'),
    mc('EG blinking means…', ['HELD: both envelopes held at maximum', 'OFF', 'An error'], 0, 'Hold the EG button to enter HELD.'),
    mc('With EG off, the TRIGGER button…', ['Acts as a gate', 'Does nothing', 'Resets the sequence'], 0, 'It holds the envelopes while pressed.'),
    mc('A trigger that arrives during the attack…', ['Is ignored', 'Restarts it', 'Inverts it'], 0, 'The attack cannot be retriggered on this instrument.'),
    mc('EG is off and the sequencers are stopped. You hold a key down. You hear…', ['The note rise and stay at full VOLUME until you let go', 'One short pluck', 'Nothing: keys need EG lit'], 0,
      'With EG off a key is a gate, like TRIGGER, so the envelopes hold at their peak while it is down. With EG lit a key plays a pluck.'),
  ],
};

const f5: Lesson = {
  id: 'subharmonicon-f5-sequencer', device: DEV, path: 'foundations', order: 5, difficulty: 'beginner',
  name: 'Two four-step sequencers',
  description: 'Assign a sequencer to a VCO, set its range with SEQ OCT and lock it to a scale with QUANTIZE.',
  objective: 'Program a 4-step melody, set its range with SEQ OCT and lock it to a scale with QUANTIZE.',
  source: `${SRC}, Sequencers and the tour (pp.13-15, 26-28)`, estimatedMinutes: 8,
  prerequisites: ['subharmonicon-f4-envelopes'],
  concepts: ['sequencer-pattern', 'oscillator-pitch'],
  start: init({ eg_mode: 2, vco1_freq: 523.25, vco1_level: 50, volume: 40 }),
  steps: [
    {
      kind: 'do', control: 'seq1_osc', targetValue: true, concept: 'sequencer-pattern',
      instruction: 'Light OSC 1 in SEQ 1 ASSIGN, so Sequencer 1 can change VCO 1\'s pitch.',
      principle: 'A sequencer puts out one voltage per step; routed to an oscillator, the voltages become notes.',
      manualReference: 'p.26 – SEQ 1 ASSIGN',
    },
    {
      kind: 'do', control: 'rhythm1_seq1', targetValue: true, concept: 'sequencer-pattern',
      instruction: 'Light SEQ 1 under RHYTHM 1, so Sequencer 1 has a clock.',
      principle: 'A step sequencer only moves when a clock tells it to.',
      explanation: 'A sequencer needs at least one rhythm generator assigned before it can play or be stepped with NEXT (manual pp.13, 26).',
    },
    {
      kind: 'predict', control: 'seq_oct', targetValue: 0, concept: 'oscillator-pitch',
      instruction: 'Press SEQ OCT until ±1 lights.',
      predict: mc('Each STEP knob can reach ±5 octaves right now. What does ±1 change?',
        ['Each knob covers one octave up or down, so tuning is easier', 'The sequence plays an octave higher', 'Only step 1 changes'], 0,
        'SEQ OCT sets the range of every STEP knob for both sequencers. It does not transpose anything: 12 o\'clock is still 0 V.'),
      principle: 'A smaller voltage range per knob gives finer control over pitch.',
      manualReference: 'p.28 – SEQ OCT',
    },
    {
      kind: 'do', control: 'quantize', targetValue: 1, concept: 'oscillator-pitch',
      instruction: 'Press QUANTIZE until 12-ET lights.',
      principle: 'Quantizing snaps a continuous voltage to the nearest note of a scale.',
      manualReference: 'p.21 – QUANTIZE',
    },
    {
      kind: 'do', control: 'next', targetValue: true, presses: 2, concept: 'sequencer-pattern', focus: ['next'],
      instruction: 'Press NEXT twice and watch the step light move along Sequencer 1.',
      principle: 'Stepping by hand lets you tune one note at a time.',
      explanation: 'NEXT moves to the next step at once without firing the envelopes (manual p.29), and EG is held, so the drone simply changes pitch.',
      manualReference: 'p.29 – NEXT',
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Tune a four-note phrase: use NEXT to visit each step, and make every step a different note.',
      checklist: [
        { text: 'Four different steps', check: s => new Set([1, 2, 3, 4].map(i => Math.round(num(s, `seq1_step${i}`) / 8.33))).size === 4 },
      ],
      hints: ['NEXT moves one step and does not fire the envelopes, so the held drone just changes pitch.', 'At ±1 one semitone is about 8% of a STEP knob.', 'Try 0, +3, +7 and +5 semitones: 0, 25, 58 and 42.'],
      solution: { values: { seq1_step1: 0, seq1_step2: 25, seq1_step3: 58, seq1_step4: 42 } },
    },
    {
      kind: 'do', control: 'eg_mode', targetValue: 1, concept: 'envelope-shape',
      instruction: 'Tap EG once so it stays lit.',
      principle: 'With the envelopes on, every sequencer step plays as a note of its own.',
    },
    play('Press PLAY.', 'A running clock loops the four steps.'),
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'oscillator-pitch',
      quiz: mc('QUANTIZE is on and you turn VCO 1 FREQ. What happens?', ['The pitch steps from note to note of the scale', 'The pitch sweeps smoothly', 'Nothing - FREQ is never quantized'], 0,
        'On the Subharmonicon the VCO FREQ knobs snap to the selected scale too (manual pp.18, 21). Many synths quantize only the sequencer, which makes the last option tempting.'),
    },
    {
      kind: 'listen', concept: 'oscillator-pitch', focus: ['quantize'], setup: { seq1_step2: 21, seq1_step3: 46 },
      instruction: 'The same STEP knobs, unquantized and then in the 8-ET major scale.',
      listen: {
        a: { quantize: 0 }, b: { quantize: 2 }, labels: ['QUANTIZE off', '8-ET'],
        question: mc('Which version sounds in key?', ['A', 'B'], 1, '8-ET pulls every step onto a note of C major; unquantized, steps 2 and 3 fall between the keys.'),
      },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What do SEQ OCT and QUANTIZE each do to the STEP knobs?',
        model: 'SEQ OCT sets how many octaves each knob can reach, and QUANTIZE snaps the result onto the notes of a scale.',
      },
    },
  ],
  review: [
    mc('SEQ OCT is…', ['Shared by both sequencers', 'Set per sequencer', 'Only for Sequencer 2'], 0, 'One setting for both (manual p.28).'),
    mc('A STEP knob at 12 o\'clock adds…', ['0 V - no change', '+1 octave', '-5 V'], 0, 'Centre means no offset.'),
    mc('NEXT…', ['Advances a step without firing the envelopes', 'Plays a note', 'Resets to step 1'], 0, 'Manual p.29.'),
    mc('8-ET is…', ['A diatonic (major) scale in equal temperament', 'Eight equal steps per octave', 'Just intonation'], 0, '"8 steps" counts the seven notes plus the octave.'),
  ],
};

const f6: Lesson = {
  id: 'subharmonicon-f6-rhythm', device: DEV, path: 'foundations', order: 6, difficulty: 'beginner',
  name: 'Rhythm generators: dividing time',
  description: 'TEMPO, the four RHYTHM dividers and how two of them on one sequencer make a polyrhythm.',
  objective: 'Set RHYTHM divisions, assign them to a sequencer, and build a first polyrhythm.',
  source: `${SRC}, TEMPO and Polyrhythm section (pp.15, 25, 30)`, estimatedMinutes: 8,
  prerequisites: ['subharmonicon-f5-sequencer'],
  concepts: ['timing-tempo', 'polyrhythm'],
  start: fromPreset('man_tutorial', { rhythm2_seq1: false, tempo: 616 }),
  steps: [
    {
      kind: 'listen', concept: 'timing-tempo', focus: ['tempo'],
      instruction: 'TEMPO sets the master clock the rhythm generators divide. Compare a slow and a fast TEMPO.',
      listen: {
        a: { tempo: 480 }, b: { tempo: 960 }, labels: ['480 BPM', '960 BPM'],
        question: mc('What did doubling TEMPO do?', ['The sequence plays twice as fast', 'The pitch went up an octave', 'Nothing'], 0,
          'TEMPO counts master pulses, one per beat (manual p.25). Every division follows it, so the whole pattern speeds up; pitch is the VCOs\' business.'),
      },
    },
    play('Press PLAY. In the studio the master pulse is now the studio clock\'s 16th note.', 'Every rhythm here is a whole-number division of one master clock.'),
    {
      kind: 'do', control: 'rhythm1', targetValue: D(2), concept: 'timing-tempo',
      instruction: 'Turn RHYTHM 1 clockwise to ÷2.',
      principle: 'Dividing a clock by a smaller number gives more pulses per second.',
      explanation: 'RHYTHM 1 fully clockwise is ÷1 - the master clock itself - and fully counter-clockwise ÷16 (manual p.30).',
      manualReference: 'p.30 – RHYTHM 1',
    },
    {
      kind: 'predict', control: 'rhythm2_seq1', targetValue: true, concept: 'polyrhythm', setup: { rhythm2: D(3) },
      instruction: 'RHYTHM 2 is at ÷3. Light SEQ 1 under RHYTHM 2.',
      predict: mc('Two generators now drive Sequencer 1: ÷2 and ÷3. What happens?',
        ['It steps whenever either fires: a lopsided, busier rhythm', 'It slows down to ÷6', 'Nothing until RESET'], 0,
        'With OR logic the sequencer steps on any hit, and ÷2 and ÷3 merge into x.xxx. - four steps every six pulses. Only the hits that coincide merge, so it does not become ÷6.'),
      principle: 'Merging two pulse streams creates a new, uneven rhythm.',
      manualReference: 'p.15 – Creating a polyrhythm',
    },
    {
      kind: 'do', control: 'reset', targetValue: true, presses: 2, concept: 'polyrhythm', focus: ['reset'],
      instruction: 'Tap RESET a couple of times: everything restarts together from step 1.',
      principle: 'Restarting every divider together puts them back on a shared downbeat.',
      explanation: 'RESET returns both sequencers to step 1 and every rhythm generator to its starting phase; while playing, it starts again on the next clock pulse (manual p.29).',
      manualReference: 'p.29 – RESET',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'polyrhythm',
      quiz: mc('RHYTHM ÷3 drives Sequencer 1 and ÷4 drives Sequencer 2. After how many master pulses do they land together again?', ['12', '7', '4'], 0,
        'They coincide at the least common multiple of 3 and 4. Seven is their sum, which is not when they meet.'),
    },
    {
      kind: 'challenge', concept: 'polyrhythm',
      instruction: 'Make Sequencer 2 step once for every four notes of Sequencer 1.',
      checklist: [
        { text: 'RHYTHM 2 drives SEQ 2 only', check: s => bool(s, 'rhythm2_seq2') && !bool(s, 'rhythm2_seq1') },
        { text: 'RHYTHM 1 drives SEQ 1', check: s => bool(s, 'rhythm1_seq1') },
        { text: 'A 4 : 1 ratio', check: s => -num(s, 'rhythm2') === 4 * -num(s, 'rhythm1') },
      ],
      hints: ['A slower division means a bigger number.', 'If RHYTHM 1 is ÷2, RHYTHM 2 needs ÷8.'],
      solution: { values: { rhythm1: D(2), rhythm2: D(8), rhythm1_seq1: true, rhythm2_seq1: false, rhythm2_seq2: true } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why do the rhythm generators always come back into line?',
        model: 'They all divide the same clock by whole numbers, so after the least common multiple of their divisions they hit together on the downbeat.',
      },
    },
  ],
  review: [
    mc('RHYTHM fully clockwise divides by…', ['1', '16', '8'], 0, 'Clockwise is ÷1 (manual p.30).'),
    mc('The internal clock runs at…', ['20-3000 BPM, one pulse per beat', 'Only 60-180 BPM', 'A fixed 120 BPM'], 0, 'Manual p.25: .333 Hz to 50 Hz.'),
    mc('÷2 and ÷3 on one sequencer (OR) give how many steps per 6 pulses?', ['4', '5', '6'], 0, 'The shared downbeat counts once.'),
    mc('One rhythm generator can drive…', ['SEQ 1, SEQ 2, both or neither', 'Only SEQ 1', 'Only one sequencer at a time'], 0, 'Two buttons per generator.'),
  ],
};

// ============================================================================
// SOUND DESIGN
// ============================================================================

const sd1: Lesson = {
  id: 'subharmonicon-sd1-sub-bass', device: DEV, path: 'sound-design', order: 1, difficulty: 'intermediate',
  name: 'Deep bass from undertones',
  description: 'The VCOs start at Middle C - the subharmonics take the riff down to real bass.',
  objective: 'Build a punchy bass from the SUB oscillators, a low filter and a short envelope.',
  source: `${SRC}, Oscillators (p.18) and Exploration Patchbook "Shuffled Subs" (p.2)`, estimatedMinutes: 7,
  prerequisites: ['subharmonicon-f6-rhythm'],
  concepts: ['subharmonics', 'filter-cutoff', 'envelope-decay'],
  start: init({
    vco1_freq: 261.63, vco1_wave: 0, vco1_level: 60, vco1_sub1_freq: D(4), vco1_sub2_freq: D(8),
    seq1_osc: true, seq_oct: 0, quantize: 1, seq1_step1: 0, seq1_step2: 0, seq1_step3: 25, seq1_step4: -17,
    rhythm1: D(2), rhythm1_seq1: true, tempo: 480,
    cutoff: 2000, vcf_eg_amt: 30, vcf_decay: 200, vca_decay: 220, volume: 85,
  }),
  steps: [
    play('Press PLAY: a riff on Middle C - too high for a bass.', 'A bass part usually lives between about 40 and 160 Hz; Middle C is 262 Hz.'),
    {
      kind: 'predict', control: 'vco1_sub1_level', targetValue: 75, concept: 'subharmonics', scope: 'spectrum',
      instruction: 'Raise SUB 1 LEVEL to about 75% (SUB 1 is at ÷4).',
      predict: mc('VCO FREQ cannot go below Middle C. How does this synth play two octaves lower?', ['With SUB 1 at ÷4', 'By turning VCO 1 FREQ further down', 'By lowering CUTOFF'], 0,
        '÷4 is two octaves down, 65 Hz. VCO FREQ bottoms out at C4 (manual p.18), and CUTOFF changes brightness, not pitch.'),
      principle: 'Dividing the oscillator by 4 plays the same riff two octaves lower.',
    },
    {
      kind: 'do', control: 'vco1_level', targetValue: 0, concept: 'mixing',
      instruction: 'Turn VCO 1 LEVEL down to zero.',
      principle: 'Removing the high fundamental leaves only the low voice.',
    },
    {
      kind: 'do', control: 'vco1_sub2_level', targetValue: 40, concept: 'subharmonics',
      instruction: 'Add SUB 2 (÷8) at about 40% for sub-bass weight.',
      principle: 'An octave below the bass adds weight you feel more than hear.',
    },
    {
      kind: 'do', control: 'cutoff', targetValue: 400, concept: 'filter-cutoff', scope: 'spectrum',
      instruction: 'Bring CUTOFF down to about 400 Hz.',
      principle: 'A lower cutoff keeps a bass round and leaves room for other parts.',
    },
    {
      kind: 'listen', concept: 'envelope-decay', focus: ['vca_decay'],
      instruction: 'Long tail or short tail?',
      listen: {
        a: { vca_decay: 600 }, b: { vca_decay: 150 }, labels: ['600 ms', '150 ms'],
        question: mc('Which one leaves space between the notes?', ['A', 'B'], 1, 'A short decay stops each note before the next one, so the groove breathes.'),
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'oscillator-waveform',
      quiz: mc('Why does WAVE up (square) suit a sub bass?', ['Square subs are strong in odd harmonics and stay defined when filtered', 'It raises the pitch', 'It switches the filter off'], 0,
        'Odd harmonics give a square bass its hollow punch. The pitch is set by the divisors, and the filter is always in the path.'),
    },
    {
      kind: 'challenge', concept: 'subharmonics',
      instruction: 'Make a bass that thumps but does not boom between notes.',
      checklist: [
        { text: 'A sub at ÷4 or lower is clearly audible', check: s => num(s, 'vco1_sub1_level') >= 40 && num(s, 'vco1_sub1_freq') <= -4 },
        { text: 'VCO 1 mostly out', check: s => num(s, 'vco1_level') <= 20 },
        { text: 'CUTOFF under 700 Hz', check: s => num(s, 'cutoff') <= 700 },
        { text: 'VCA DECAY under 0.3 s', check: s => num(s, 'vca_decay') <= 300 },
      ],
      hints: ['The body comes from a sub, not the VCO.', 'Short tails stop the boom.', 'Try SUB 1 ÷4 at 75%, CUTOFF 400 Hz, VCA DECAY 200 ms.'],
      solution: { values: { vco1_level: 0, vco1_sub1_level: 75, vco1_sub1_freq: D(4), cutoff: 400, vca_decay: 200 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why is a subharmonic synth good at bass even though its VCOs start at Middle C?',
        model: 'The dividers drop the oscillator by whole octaves or more, so ÷4 and ÷8 reach 65 and 33 Hz while staying locked to the riff.',
      },
    },
  ],
  review: [
    mc('The lowest VCO FREQ setting is…', ['C4 (262 Hz)', 'C0', '20 Hz'], 0, 'Manual p.18.'),
    mc('C4 ÷ 8 =', ['C1 (about 33 Hz)', 'C2', 'G1'], 0, 'Three octaves down.'),
    mc('A shorter VCA DECAY gives…', ['Tighter notes', 'A lower pitch', 'More resonance'], 0, 'It is the loudness tail.'),
  ],
};

const sd2: Lesson = {
  id: 'subharmonicon-sd2-just-chords', device: DEV, path: 'sound-design', order: 2, difficulty: 'intermediate',
  name: 'Beat-free chords in just intonation',
  description: 'Tune two VCOs a just fifth and third apart and their undertones lock into one lattice.',
  objective: 'Build a chord from two VCOs and their subs that does not beat, using 12-JI.',
  source: `${SRC}, tuning systems and QUANTIZE (pp.17, 21)`, estimatedMinutes: 9,
  prerequisites: ['subharmonicon-sd1-sub-bass'],
  concepts: ['subharmonics', 'mixing'],
  start: init({ eg_mode: 2, vco1_freq: 261.63, vco2_freq: 261.63, vco1_wave: 2, vco2_wave: 2, vco1_level: 25, cutoff: 2000, quantize: 0, volume: 45 }),
  steps: [
    {
      kind: 'do', control: 'quantize', targetValue: 3, concept: 'oscillator-pitch',
      instruction: 'Press QUANTIZE until 12-JI lights. VCO FREQ now snaps to just steps.',
      principle: 'Just intonation tunes intervals to small whole-number ratios, so they do not beat.',
      manualReference: 'p.17 – Just intonation',
    },
    {
      kind: 'do', control: 'vco1_freq', targetValue: 392.44, tolerance: 11, concept: 'oscillator-pitch',
      instruction: 'Turn VCO 1 FREQ up until it settles on G4, about 15% of the knob.',
      principle: 'A just fifth vibrates exactly 3 times for every 2 of its root.',
      explanation: 'In 12-JI the knob steps through C, C♯, D … with G at 3/2 of C4: 392.4 Hz.',
    },
    {
      kind: 'predict', control: 'vco1_sub1_freq', targetValue: D(3), concept: 'subharmonics', setup: { vco1_sub1_level: 55 },
      instruction: 'Set VCO 1 SUB 1 FREQ to ÷3.',
      predict: mc('VCO 1 is G4, a just fifth above C4. Which note is its ÷3?', ['C3', 'D3', 'G3'], 0,
        'G4 is C4 × 3/2, and dividing by 3 gives C4 ÷ 2 = C3: the fifth\'s undertone lands on the root. G3 would be ÷2.'),
      principle: 'Dividing a just fifth by 3 lands exactly on its root, an octave lower.',
    },
    {
      kind: 'do', control: 'vco2_freq', targetValue: 329.63, tolerance: 9, concept: 'oscillator-pitch', setup: { vco2_level: 25 },
      instruction: 'VCO 2 LEVEL is up. Turn VCO 2 FREQ to E4, about 8% of the knob.',
      principle: 'A just major third vibrates 5 times for every 4 of its root.',
      explanation: 'In 12-JI that E sounds at 327.0 Hz, a little flatter than the piano\'s 329.6.',
    },
    {
      kind: 'do', control: 'vco2_sub2_freq', targetValue: D(5), concept: 'subharmonics', setup: { vco2_sub2_level: 30 },
      instruction: 'Set VCO 2 SUB 2 FREQ to ÷5 and listen to the low C it makes.',
      principle: 'E4 ÷ 5 is C2 - the same note as VCO 1\'s G4 ÷ 6. The lattice locks.',
    },
    {
      kind: 'listen', concept: 'subharmonics', focus: ['quantize'], setup: { vco1_sub2_freq: D(6), vco1_sub2_level: 45 },
      instruction: 'The same knobs in two tunings. Listen to the lowest C.',
      listen: {
        a: { quantize: 3 }, b: { quantize: 1 }, labels: ['12-JI', '12-ET'],
        question: mc('In which one does the low C throb slowly?', ['A (12-JI)', 'B (12-ET)'], 1,
          'In 12-ET VCO 2\'s ÷5 is 65.93 Hz against 65.33 Hz from VCO 1\'s ÷6: a 0.6 Hz beat. In 12-JI both are exactly 65.41 Hz.'),
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'subharmonics',
      quiz: mc('Why does the equal-tempered major third beat here?', ['It is 13.7 cents wider than 5/4, so undertones that should coincide land slightly apart', 'Equal temperament is out of tune with itself', 'The filter adds beating'], 0,
        'ET thirds are a compromise that works in every key; the subs reveal the mismatch as a slow beat. ET is self-consistent - it just is not whole-number ratios.'),
    },
    {
      kind: 'challenge', concept: 'subharmonics',
      instruction: 'Turn it into C minor: VCO 1 on C4, VCO 2 a fifth up, and a ÷5 undertone of the fifth for the minor third.',
      checklist: [
        { text: 'QUANTIZE on 12-JI', check: s => num(s, 'quantize') === 3 },
        { text: 'VCO 1 on C4', check: s => semitoneOf(num(s, 'vco1_freq')) === 0 },
        { text: 'VCO 2 on G4', check: s => semitoneOf(num(s, 'vco2_freq')) === 7 },
        { text: 'A ÷5 sub of VCO 2 audible', check: s => (num(s, 'vco2_sub2_freq') === -5 && num(s, 'vco2_sub2_level') >= 25) || (num(s, 'vco2_sub1_freq') === -5 && num(s, 'vco2_sub1_level') >= 25) },
      ],
      hints: ['Swap roles: VCO 1 becomes the root and VCO 2 the fifth.', '(3/2) ÷ 5 = 3/10 of C4: a just minor third above C2.', 'VCO 1 C4 with ÷2 and ÷4; VCO 2 G4 with ÷2 and ÷5.'],
      solution: { values: { vco1_freq: 261.63, vco1_sub1_freq: D(2), vco1_sub2_freq: D(4), vco2_freq: 392.44, vco2_sub1_freq: D(2), vco2_sub2_freq: D(5), vco2_sub2_level: 45 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does just intonation suit the Subharmonicon in particular?',
        model: 'Its subs are exact whole-number divisions, so VCOs tuned to whole-number ratios make every sub line up; in equal temperament they land slightly apart and beat.',
      },
    },
  ],
  review: [
    mc('The just major third is…', ['5/4', '4/3', '6/5'], 0, '6/5 is the minor third.'),
    mc('With QUANTIZE on, VCO FREQ…', ['Snaps to scale steps', 'Sweeps smoothly', 'Is disabled'], 0, 'Manual p.18.'),
    mc('Just intonation removes…', ['Beating between notes that should coincide', 'All the harmonics', 'The need for a filter'], 0, 'The manual calls out the beating in minor chords (p.17).'),
    mc('E4 (5/4 of C4) ÷ 5 equals…', ['C2', 'E2', 'A1'], 0, '5/4 ÷ 5 = 1/4 of C4.'),
  ],
};

const sd3: Lesson = {
  id: 'subharmonicon-sd3-filter-drums', device: DEV, path: 'sound-design', order: 3, difficulty: 'intermediate',
  name: 'Drums from a ringing filter',
  description: 'Turn the mixer off and the resonance up: the ladder itself becomes a tuned kick.',
  objective: 'Turn the self-oscillating ladder into a tuned kick, then add clock-driven accents.',
  source: `${SRC}, "Bateria" patch sheet (p.47)`, estimatedMinutes: 9,
  prerequisites: ['subharmonicon-f4-envelopes'],
  concepts: ['filter-resonance', 'envelope-decay', 'signal-routing'],
  start: init({
    rhythm1: D(4), rhythm1_seq1: true, rhythm2: D(4), rhythm2_seq2: true, tempo: 516,
    vcf_decay: 20, vca_decay: 165, cutoff: 2000, vcf_eg_amt: 0, volume: 90,
  }),
  steps: [
    play('Press PLAY: plain blips on a steady beat.', 'Any sound with a fast pitch drop and a short tail can work as a drum.'),
    {
      kind: 'do', control: 'vco1_level', targetValue: 0, concept: 'mixing',
      instruction: 'Turn VCO 1 LEVEL to zero. Silence, for now.',
      principle: 'With nothing in the mixer, any sound must come from the filter itself.',
    },
    {
      kind: 'predict', control: 'resonance', targetValue: 99, concept: 'filter-resonance',
      instruction: 'Turn RESONANCE to maximum.',
      predict: mc('Nothing is feeding the filter. What will you hear?', ['A pitched note on each beat: the filter rings by itself', 'Nothing at all', 'White noise'], 0,
        'At maximum resonance the ladder self-oscillates (manual p.23) and the VCA envelope gates that sine-like tone. No input is needed.'),
      principle: 'Enough resonance makes a filter oscillate on its own, like a sine oscillator.',
      manualReference: 'p.23 – RESONANCE',
    },
    {
      kind: 'do', control: 'cutoff', targetValue: 80, concept: 'filter-cutoff', scope: 'spectrum',
      instruction: 'Set CUTOFF to about 80 Hz: that is the kick\'s pitch.',
      principle: 'A self-oscillating filter sings at its cutoff, so CUTOFF tunes the drum.',
    },
    {
      kind: 'do', control: 'vcf_eg_amt', targetValue: 22, concept: 'modulation-depth',
      instruction: 'Set VCF EG AMT to about +20% (1 o\'clock).',
      principle: 'A fast downward pitch sweep at the start turns a tone into a kick.',
    },
    {
      kind: 'listen', concept: 'envelope-decay', focus: ['vcf_decay'],
      instruction: 'Tight or boomy?',
      listen: {
        a: { vcf_decay: 20 }, b: { vcf_decay: 150 }, labels: ['VCF DECAY 20 ms', '150 ms'],
        question: mc('Which one has the longer pitch drop?', ['A', 'B'], 1, 'VCF DECAY sets how slowly the pitch falls; VCA DECAY sets how long it rings.'),
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: mc('Which knob mainly sets how long the kick booms?', ['VCA DECAY', 'CUTOFF', 'TEMPO'], 0,
        'The VCA envelope ends the sound. CUTOFF sets the pitch, and TEMPO how often it hits.'),
    },
    {
      kind: 'patch', patchFrom: 'out_seq2_clk', patchTo: 'in_vca', concept: 'signal-routing',
      instruction: 'Patch SEQ 2 CLK into VCA for an accent on Sequencer 2\'s beats.',
      principle: 'A short pulse added to an amplifier\'s control makes a click or an accent.',
      explanation: 'VCA IN is added to the VCA envelope; it does not replace it (manual p.33).',
    },
    {
      kind: 'challenge', concept: 'filter-resonance',
      instruction: 'Make a tight four-on-the-floor kick that does not smear into the next beat.',
      checklist: [
        { text: 'Mixer silent', check: s => ['vco1_level', 'vco1_sub1_level', 'vco1_sub2_level', 'vco2_level', 'vco2_sub1_level', 'vco2_sub2_level'].every(k => num(s, k) <= 5) },
        { text: 'RESONANCE 85% or more', check: s => num(s, 'resonance') >= 85 },
        { text: 'CUTOFF between 40 and 150 Hz', check: s => num(s, 'cutoff') >= 40 && num(s, 'cutoff') <= 150 },
        { text: 'VCA DECAY 0.3 s or less', check: s => num(s, 'vca_decay') <= 300 },
      ],
      hints: ['The tone is the filter, so keep it ringing.', 'CUTOFF is the drum\'s tuning.', 'Shorten VCA DECAY if it booms.'],
      solution: { values: { resonance: 99, cutoff: 80, vcf_eg_amt: 22, vcf_decay: 20, vca_decay: 200 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Explain how this kick works, from silence to thump.',
        model: 'The resonant filter oscillates at its cutoff; each trigger opens the VCA and briefly sweeps the cutoff up, so the tone falls in pitch quickly and the VCA decay ends it.',
      },
    },
  ],
  review: [
    mc('With every mixer level at 0, sound can still come from…', ['A self-oscillating filter', 'The VCA', 'The sequencer'], 0, 'Maximum resonance rings.'),
    mc('To tune the filter kick, turn…', ['CUTOFF', 'VCO 1 FREQ', 'TEMPO'], 0, 'The cutoff is its pitch.'),
    mc('SEQ CLK into VCA IN gives…', ['Short accents on that sequencer\'s steps', 'Silence', 'A pitch change'], 0, 'It is summed with the envelope.'),
  ],
};

// ============================================================================
// EAR TRAINING
// ============================================================================

const et1: Lesson = {
  id: 'subharmonicon-et1-octave-or-not', device: DEV, path: 'ear-training', order: 1, difficulty: 'beginner',
  name: 'Octave, twelfth or double octave?',
  description: 'Tell ÷2, ÷3 and ÷4 apart by ear: same note lower, a new note, or two octaves down.',
  objective: 'Tell ÷2, ÷3 and ÷4 apart by ear.',
  source: `${SRC}, Understanding subharmonics (p.11)`, estimatedMinutes: 6,
  prerequisites: ['subharmonicon-f1-undertones'],
  concepts: ['subharmonics'],
  start: init({ eg_mode: 2, vco1_freq: 523.25, vco1_level: 30, vco1_sub1_level: 70, vco1_sub1_freq: D(1), vco1_wave: 2, cutoff: 3000, volume: 40 }),
  steps: [
    {
      kind: 'listen', concept: 'subharmonics', focus: ['vco1_sub1_freq'],
      instruction: 'Two octave subs. Hear how B is the same note, deeper.',
      listen: { a: { vco1_sub1_freq: D(2) }, b: { vco1_sub1_freq: D(4) }, labels: ['÷2', '÷4'] },
    },
    {
      kind: 'listen', concept: 'subharmonics', focus: ['vco1_sub1_freq'],
      instruction: 'Now ÷2 against ÷3.',
      listen: {
        a: { vco1_sub1_freq: D(2) }, b: { vco1_sub1_freq: D(3) }, labels: ['÷2', '÷3'],
        question: mc('Which one adds a new note name?', ['A', 'B'], 1, '÷3 adds a fifth below the next C; ÷2 stays on C.'),
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'subharmonics',
      quiz: mc('÷3 below C5 sounds as…', ['An F, an octave and a fifth below', 'A C two octaves below', 'An E'], 0, '523 ÷ 3 ≈ 174 Hz, F3. Two octaves down would be ÷4.'),
    },
    {
      kind: 'match', instruction: 'Set SUB 1 by ear.', concept: 'subharmonics', setup: { vco1_sub1_freq: D(8) },
      match: { target: { vco1_sub1_freq: D(2) }, controls: ['vco1_sub1_freq'], tolerance: 0.03 },
      hints: ['The same note, only lower.', 'It is the first octave down.'],
    },
    {
      kind: 'match', instruction: 'Again, a different target.', concept: 'subharmonics', setup: { vco1_sub1_freq: D(6) },
      match: { target: { vco1_sub1_freq: D(3) }, controls: ['vco1_sub1_freq'], tolerance: 0.03 },
      hints: ['A different note: listen for a fifth.', 'Fewer clicks from clockwise than ÷4.'],
    },
    {
      kind: 'match', instruction: 'One more.', concept: 'subharmonics', setup: { vco1_sub1_freq: D(1) },
      match: { target: { vco1_sub1_freq: D(4) }, controls: ['vco1_sub1_freq'], tolerance: 0.03 },
      hints: ['The same note, two octaves down.', 'Halve it twice.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do you tell an octave sub from a twelfth sub by ear?',
        model: 'An octave blends into the note like a deeper copy; a twelfth adds a different, open fifth under it.',
      },
    },
  ],
  review: [
    mc('÷4 below a VCO is…', ['Two octaves down', 'A fourth down', 'Four semitones down'], 0, 'Halve twice.'),
    mc('Which one sounds like a new note?', ['÷3', '÷2', '÷8'], 0, '3 is not a power of 2.'),
    mc('÷6 is…', ['÷3 dropped one more octave', 'A sixth below', 'Unison'], 0, '6 = 3 × 2.'),
  ],
};

const et2: Lesson = {
  id: 'subharmonicon-et2-undertone-colours', device: DEV, path: 'ear-training', order: 2, difficulty: 'intermediate',
  name: 'Name the undertone: ÷5, ÷6 or ÷7',
  description: 'The colours of the higher undertones: a major third, a fifth and a note between the piano keys.',
  objective: 'Recognise ÷5 (a major third below), ÷6 (a fifth below) and ÷7 (septimal, between the keys) by ear.',
  source: `${SRC}, the undertone table (p.11)`, estimatedMinutes: 8,
  prerequisites: ['subharmonicon-et1-octave-or-not'],
  concepts: ['subharmonics'],
  start: init({ eg_mode: 2, vco1_freq: 1046.5, vco1_level: 20, vco1_sub1_freq: D(4), vco1_sub1_level: 55, vco1_sub2_freq: D(5), vco1_sub2_level: 0, vco1_wave: 2, cutoff: 3000, volume: 40 }),
  steps: [
    {
      kind: 'listen', concept: 'subharmonics', focus: ['vco1_sub2_level'], scope: 'spectrum',
      instruction: 'Add ÷5 under the C reference.',
      listen: {
        a: { vco1_sub2_level: 0 }, b: { vco1_sub2_level: 60, vco1_sub2_freq: D(5) }, labels: ['Reference', '+ ÷5'],
        question: mc('What did ÷5 add?', ['A note a major third below the C', 'A higher octave', 'Nothing'], 0, '1046.5 ÷ 5 ≈ 209 Hz, a slightly sharp A♭: a major third below C.'),
      },
    },
    {
      kind: 'listen', concept: 'subharmonics', focus: ['vco1_sub2_freq'],
      instruction: 'Compare ÷5 and ÷6 on SUB 2.',
      listen: {
        a: { vco1_sub2_freq: D(5), vco1_sub2_level: 60 }, b: { vco1_sub2_freq: D(6), vco1_sub2_level: 60 }, labels: ['÷5', '÷6'],
        question: mc('Which one sounds like the stable fifth (F under C)?', ['A', 'B'], 1, '÷6 is ÷3 an octave lower: a pure fifth relationship.'),
      },
    },
    {
      kind: 'listen', concept: 'subharmonics', focus: ['vco1_sub2_freq'],
      instruction: 'Now ÷6 and ÷7.',
      listen: {
        a: { vco1_sub2_freq: D(6), vco1_sub2_level: 60 }, b: { vco1_sub2_freq: D(7), vco1_sub2_level: 60 }, labels: ['÷6', '÷7'],
        question: mc('Which one sits between the piano keys?', ['A', 'B'], 1, '÷7 is about 31 cents sharp of D: the bluesy, septimal colour.'),
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'subharmonics',
      quiz: mc('Under a C oscillator, ÷5 is closest to…', ['A♭', 'E', 'G'], 0, 'Undertones mirror overtones: the 5th harmonic is the E above, the 5th undertone the A♭ below.'),
    },
    {
      kind: 'match', instruction: 'Find the major-third undertone by ear.', concept: 'subharmonics', setup: { vco1_sub2_freq: D(7), vco1_sub2_level: 60 },
      match: { target: { vco1_sub2_freq: D(5), vco1_sub2_level: 60 }, controls: ['vco1_sub2_freq'], tolerance: 0.03 },
      hints: ['Sweet and major-sounding.', 'Two clicks clockwise from ÷7.'],
    },
    {
      kind: 'match', instruction: 'Now the septimal one.', concept: 'subharmonics', setup: { vco1_sub2_freq: D(5), vco1_sub2_level: 60 },
      match: { target: { vco1_sub2_freq: D(7), vco1_sub2_level: 60 }, controls: ['vco1_sub2_freq'], tolerance: 0.03 },
      hints: ['Out of the piano\'s tuning.', 'Two clicks counter-clockwise from ÷5.'],
    },
    {
      kind: 'match', instruction: 'And the fifth.', concept: 'subharmonics', setup: { vco1_sub2_freq: D(8), vco1_sub2_level: 60 },
      match: { target: { vco1_sub2_freq: D(6), vco1_sub2_level: 60 }, controls: ['vco1_sub2_freq'], tolerance: 0.03 },
      hints: ['A stable fifth.', 'Two clicks clockwise from ÷8.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Describe the ÷7 undertone so someone else could find it.',
        model: 'It is the first undertone that does not fit the piano: a slightly sharp, bluesy note about a whole tone from the C.',
      },
    },
  ],
  review: [
    mc('The ÷5 undertone of C is near…', ['A♭', 'E', 'B'], 0, 'The mirror of the 5th harmonic.'),
    mc('÷6 relates to ÷3 as…', ['An octave lower', 'A fifth higher', 'Unrelated'], 0, '6 = 3 × 2.'),
    mc('÷7 is off the equal-tempered note by about…', ['31 cents', '0 cents', '50 cents'], 0, 'A septimal interval.'),
    mc('Which undertones are fifths of the VCO\'s note name?', ['÷3, ÷6 and ÷12', '÷5', '÷7'], 0, 'A factor of 3 means fifths.'),
  ],
};

const et3: Lesson = {
  id: 'subharmonicon-et3-polyrhythm-ears', device: DEV, path: 'ear-training', order: 3, difficulty: 'intermediate',
  name: 'Count the polyrhythm',
  description: 'Hear two rhythm divisions playing against each other, and set them by ear.',
  objective: 'Hear and set two rhythm divisions that play against each other.',
  source: `${SRC}, Polyrhythm section (p.30)`, estimatedMinutes: 8,
  prerequisites: ['subharmonicon-f6-rhythm'],
  concepts: ['polyrhythm', 'timing-tempo'],
  start: fromPreset('poly_34'),
  steps: [
    play('Press PLAY: one line on ÷3, one on ÷4.', 'Two pulse streams with different periods form a polyrhythm.'),
    {
      kind: 'listen', concept: 'polyrhythm', focus: ['rhythm3', 'rhythm4'],
      instruction: 'Compare two pairs.',
      listen: {
        a: { rhythm3: D(3), rhythm4: D(4) }, b: { rhythm3: D(2), rhythm4: D(3) }, labels: ['3 against 4', '2 against 3'],
        question: mc('Which pair lines up again sooner?', ['A (3 against 4)', 'B (2 against 3)'], 1, '2 and 3 meet every 6 pulses; 3 and 4 every 12.'),
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'polyrhythm',
      quiz: mc('÷3 against ÷4: in one shared cycle, how many notes does each line play?', ['4 on ÷3 and 3 on ÷4', '3 and 4', '12 each'], 0,
        'In 12 pulses ÷3 fires 4 times and ÷4 fires 3 times. The bigger divisor plays fewer notes.'),
    },
    {
      kind: 'match', instruction: 'Restore 3 against 4 by ear.', concept: 'polyrhythm', setup: { rhythm3: D(2), rhythm4: D(8) },
      match: { target: { rhythm3: D(3), rhythm4: D(4) }, controls: ['rhythm3', 'rhythm4'], tolerance: 0.03 },
      hints: ['One line is slightly faster than the other.', 'Count three hits of one against four of the other.'],
    },
    {
      kind: 'match', instruction: 'A new pair.', concept: 'polyrhythm', setup: { rhythm3: D(4), rhythm4: D(3) },
      match: { target: { rhythm3: D(2), rhythm4: D(5) }, controls: ['rhythm3', 'rhythm4'], tolerance: 0.03 },
      hints: ['One line is quick and even, the other slow.', 'The fast line is twice the clock period.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How can you find the length of a polyrhythm\'s cycle without listening?',
        model: 'Take the least common multiple of the two divisions: that many master pulses pass before they line up again.',
      },
    },
  ],
  review: [
    mc('÷2 and ÷5 line up again every…', ['10 pulses', '7 pulses', '5 pulses'], 0, 'lcm(2, 5) = 10.'),
    mc('Which plays more notes per cycle: ÷3 or ÷4?', ['÷3', '÷4'], 0, 'A smaller divisor fires more often.'),
    mc('Changing the master tempo changes a polyrhythm\'s…', ['Speed but not its ratio', 'Ratio', 'Pitch'], 0, 'Both lines scale together.'),
  ],
};

const et4: Lesson = {
  id: 'subharmonicon-et4-just-vs-equal', device: DEV, path: 'ear-training', order: 4, difficulty: 'intermediate',
  name: 'Just or equal? Listen for beats',
  description: 'Tell 12-JI from 12-ET by the slow throb of undertones that almost coincide.',
  objective: 'Tell 12-JI from 12-ET by listening for beats, and set QUANTIZE by ear.',
  source: `${SRC}, tuning systems (p.17)`, estimatedMinutes: 8,
  prerequisites: ['subharmonicon-sd2-just-chords'],
  concepts: ['subharmonics', 'oscillator-pitch'],
  start: fromPreset('ji_major_et'),
  steps: [
    {
      kind: 'listen', concept: 'subharmonics', focus: ['quantize'],
      instruction: 'Listen to the lowest note in each.',
      listen: {
        a: { quantize: 1 }, b: { quantize: 3 }, labels: ['12-ET', '12-JI'],
        question: mc('Which one is perfectly still?', ['A (12-ET)', 'B (12-JI)'], 1, 'In 12-JI the two low C undertones are exactly equal. In ET they are 0.6 Hz apart, and that throbs.'),
      },
    },
    {
      kind: 'predict', control: 'quantize', targetValue: 4, concept: 'oscillator-pitch', setup: { quantize: 3 },
      instruction: 'QUANTIZE is on 12-JI. Press it once more, to 8-JI.',
      predict: mc('The chord uses G and E over C. What changes in 8-JI?', ['Nothing: both notes are in the just major scale', 'It starts beating', 'It falls silent'], 0,
        '8-JI is just C major, which contains 5/4 and 3/2 (manual p.17). It only removes the chromatic notes.'),
      principle: 'A diatonic scale is a subset of the chromatic one, with the same ratios.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'subharmonics',
      quiz: mc('Beats come from…', ['Two nearly equal frequencies interfering', 'The filter\'s resonance', 'A fast envelope'], 0,
        'The beat rate is the difference between the frequencies: 65.93 - 65.33 ≈ 0.6 Hz.'),
    },
    {
      kind: 'challenge', concept: 'subharmonics', setup: { quantize: 1 },
      instruction: 'QUANTIZE is back on 12-ET. Choose a tuning that makes this chord beat-free.',
      checklist: [{ text: 'A just tuning (12-JI or 8-JI)', check: s => num(s, 'quantize') >= 3 }],
      hints: ['Listen to the bass: does it throb?', 'Just intonation removes the throb.', 'Press QUANTIZE until 12-JI lights.'],
      solution: { values: { quantize: 3 } },
    },
    {
      kind: 'challenge', concept: 'subharmonics',
      setup: { vco1_freq: 261.63, vco1_sub1_freq: D(2), vco1_sub2_freq: D(4), vco2_freq: 392.44, vco2_sub1_freq: D(2), vco2_sub2_freq: D(5), quantize: 3 },
      instruction: 'Now a C minor chord, in 12-JI. Find a tuning where it does beat.',
      checklist: [{ text: 'An equal-tempered tuning (12-ET or 8-ET)', check: s => num(s, 'quantize') === 1 || num(s, 'quantize') === 2 }],
      hints: ['Equal temperament beats.', 'Press QUANTIZE until 12-ET lights.'],
      solution: { values: { quantize: 1 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why are beats a useful clue for telling tuning systems apart?',
        model: 'Just ratios make the shared undertones land on exactly the same frequency, so they do not beat; equal temperament shifts them slightly, so you hear a slow throb.',
      },
    },
  ],
  review: [
    mc('A slow throb between two low notes means…', ['They are slightly mistuned', 'They are an octave apart', 'The VCA is closing'], 0, 'A beat is the frequency difference.'),
    mc('8-JI includes the ratios…', ['9/8, 5/4, 4/3, 3/2, 5/3, 15/8', 'Every semitone', 'Only octaves'], 0, 'The manual\'s just C major (p.17).'),
    mc('The equal-tempered major third is ___ than 5/4.', ['About 14 cents wider', 'Exactly equal', 'An octave lower'], 0, '400 cents against 386.3.'),
  ],
};

const et5: Lesson = {
  id: 'subharmonicon-et5-mixed', device: DEV, path: 'ear-training', order: 5, difficulty: 'advanced',
  name: 'Mixed ears: sub, filter or envelope?',
  description: 'Pitch, brightness or length? Identify the change, then recreate a sound that changed three ways.',
  objective: 'Identify and recreate a change made to SUB 1 FREQ, CUTOFF or VCA DECAY.',
  source: SRC, estimatedMinutes: 9,
  prerequisites: ['subharmonicon-et2-undertone-colours', 'subharmonicon-f3-filter'],
  concepts: ['subharmonics', 'filter-cutoff', 'envelope-decay'],
  start: fromPreset('bass_sub'),
  steps: [
    play('Press PLAY.', 'Pitch, brightness and length are three separate things a listener can hear.'),
    {
      kind: 'listen', concept: 'subharmonics', focus: ['vco1_sub1_freq'],
      instruction: 'What changed?',
      listen: {
        a: { vco1_sub1_freq: D(4) }, b: { vco1_sub1_freq: D(3) },
        question: mc('What changed between A and B?', ['Pitch', 'Brightness', 'Length'], 0, 'A new divisor is a new note.'),
      },
    },
    {
      kind: 'listen', concept: 'filter-cutoff', focus: ['cutoff'],
      instruction: 'And now?',
      listen: {
        a: { cutoff: 400 }, b: { cutoff: 1500 },
        question: mc('What changed between A and B?', ['Pitch', 'Brightness', 'Length'], 1, 'The note stays the same; only the harmonics change.'),
      },
    },
    {
      kind: 'listen', concept: 'envelope-decay', focus: ['vca_decay'],
      instruction: 'One more.',
      listen: {
        a: { vca_decay: 150 }, b: { vca_decay: 600 },
        question: mc('What changed between A and B?', ['Pitch', 'Brightness', 'Length'], 2, 'The tail gets longer; pitch and colour stay.'),
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-cutoff',
      quiz: mc('A bass plays the same note but duller. Which control most likely moved?', ['CUTOFF', 'SUB 1 FREQ', 'VCA DECAY'], 0,
        'Duller at the same pitch means a lower cutoff. SUB FREQ would change the note.'),
    },
    {
      kind: 'match', instruction: 'Recreate the target: it changed in three ways.', concept: 'subharmonics',
      match: { target: { vco1_sub1_freq: D(3), cutoff: 900, vca_decay: 500 }, controls: ['vco1_sub1_freq', 'cutoff', 'vca_decay'], tolerance: 0.03 },
      hints: ['Check the note first, then the brightness, then the tail.', 'The note is a fifth-type undertone.', 'It is brighter and longer than the start.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What order do you check things in when matching a sound, and why?',
        model: 'Pitch first, because it is the most obvious; then brightness; then the envelope length, which is easiest to hear once the note and tone are right.',
      },
    },
  ],
  review: [
    mc('Same note, longer tail →', ['VCA DECAY', 'CUTOFF', 'SUB FREQ'], 0, 'The amplitude envelope sets the length.'),
    mc('Different note, same tone →', ['SUB FREQ', 'RESONANCE', 'VOLUME'], 0, 'A divisor change is a pitch change.'),
    mc('Brighter, same note →', ['CUTOFF up', 'VCA ATTACK up', 'TEMPO up'], 0, 'More harmonics pass the filter.'),
  ],
};

// ============================================================================
// SEQUENCING
// ============================================================================

const sq1: Lesson = {
  id: 'subharmonicon-sq1-or-xor', device: DEV, path: 'sequencing', order: 1, difficulty: 'intermediate',
  name: 'Combining rhythms: OR and XOR',
  description: 'Two rhythm generators on one sequencer, combined by OR or by XOR - and the downbeat that XOR removes.',
  objective: 'Predict and hear how OR and XOR logic combine two rhythm generators on one sequencer.',
  source: `${SRC}, MIDI CC 113: Rhythm Generator Logic (p.44)`, estimatedMinutes: 8,
  prerequisites: ['subharmonicon-f6-rhythm'],
  concepts: ['polyrhythm', 'sequencer-pattern'],
  start: fromPreset('poly_or'),
  steps: [
    play('Press PLAY: ÷2 and ÷3 share Sequencer 1.', 'OR logic steps the sequencer whenever any assigned generator fires.'),
    {
      kind: 'info', concept: 'polyrhythm', focus: ['rhythm1_seq1', 'rhythm2_seq1'],
      instruction: 'The merged pattern is x.xxx.: four steps every six pulses, so the four-note riff locks to the cycle.',
      explanation: 'On the downbeat both generators fire together, and OR counts that as one step.',
    },
    {
      kind: 'predict', control: 'rhythm_logic', targetValue: 1, concept: 'polyrhythm',
      instruction: 'Switch LOGIC to XOR.',
      predict: mc('XOR steps only when exactly one generator fires. Which hit disappears?', ['The downbeat, where ÷2 and ÷3 coincide', 'Every ÷3 hit', 'None'], 0,
        'XOR rejects pulses where both fire (manual p.44), so the shared downbeat vanishes and the riff now takes 24 pulses to come round.'),
      principle: 'XOR keeps a hit only when exactly one source fires.',
      explanation: 'On the hardware this is a global setting sent as MIDI CC 113; the twin gives it a switch.',
    },
    {
      kind: 'listen', concept: 'polyrhythm', focus: ['rhythm_logic'],
      instruction: 'OR against XOR.',
      listen: {
        a: { rhythm_logic: 0 }, b: { rhythm_logic: 1 }, labels: ['OR', 'XOR'],
        question: mc('Which version loses the strong first beat?', ['A', 'B'], 1, 'The XOR version sounds syncopated: it starts off the beat.'),
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'polyrhythm',
      quiz: mc('÷2 and ÷4 on one sequencer with XOR give…', ['Only the off-beat 8ths', 'Every 8th', 'Nothing'], 0,
        'Every ÷4 hit coincides with a ÷2 hit and cancels, so only the ÷2 hits between them remain: ..x.'),
    },
    {
      kind: 'challenge', concept: 'polyrhythm',
      instruction: 'Use XOR to make an off-beat, hi-hat-like pulse on Sequencer 1.',
      checklist: [
        { text: 'LOGIC on XOR', check: s => num(s, 'rhythm_logic') === 1 },
        { text: 'Two generators on SEQ 1, one twice the other', check: s => bool(s, 'rhythm1_seq1') && bool(s, 'rhythm2_seq1') && (-num(s, 'rhythm2') === 2 * -num(s, 'rhythm1') || -num(s, 'rhythm1') === 2 * -num(s, 'rhythm2')) },
      ],
      hints: ['You need a division and its double.', '÷2 with ÷4.'],
      solution: { values: { rhythm_logic: 1, rhythm1: D(2), rhythm2: D(4), rhythm1_seq1: true, rhythm2_seq1: true } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'When would you pick XOR over OR?',
        model: 'When I want syncopation: XOR removes the coinciding, strong beats and leaves the hits in between.',
      },
    },
  ],
  review: [
    mc('OR logic steps when…', ['One or more generators fire', 'Exactly one fires', 'All of them fire'], 0, 'Manual p.44.'),
    mc('XOR removes…', ['Coinciding hits', 'The off-beats', 'Every hit'], 0, 'Only a single hit counts.'),
    mc('On the hardware, the rhythm logic is set by…', ['MIDI CC 113 (a global setting)', 'A front-panel switch', 'The TEMPO knob'], 0, 'The twin shows it as a switch for convenience.'),
  ],
};

const sq2: Lesson = {
  id: 'subharmonicon-sq2-intertwined', device: DEV, path: 'sequencing', order: 2, difficulty: 'intermediate',
  name: 'Two sequencers, one melody',
  description: 'Patch SEQ 2 into VCO 1: a slow sequencer transposes a fast one into a 16-step phrase.',
  objective: 'Patch SEQ 2 into VCO 1 so a slow sequencer transposes a fast one into a 16-step phrase.',
  source: 'Synth Studio · Moog Patching with Intention, "Intertwining Sequencers" (p.5)', estimatedMinutes: 8,
  prerequisites: ['subharmonicon-f5-sequencer'],
  concepts: ['sequencer-pattern', 'signal-routing'],
  start: fromPreset('pwi_first', { rhythm2: D(16), rhythm2_seq2: true, seq2_step1: 0, seq2_step2: -42, seq2_step3: -17, seq2_step4: 17 }),
  steps: [
    play('Press PLAY: a four-note loop.', 'A four-step loop repeats quickly, so changing it over time keeps it interesting.'),
    {
      kind: 'predict', patchFrom: 'out_seq2', patchTo: 'in_vco1', concept: 'signal-routing',
      instruction: 'Patch SEQ 2 into VCO 1\'s input.',
      predict: mc('What happens when SEQ 2 also feeds VCO 1?', ['Sequencer 1\'s loop is transposed each time Sequencer 2 steps', 'The two sequences take turns', 'Only Sequencer 2 is heard'], 0,
        'The VCO 1 input is summed with the FREQ knob and Sequencer 1 (manual p.31), so SEQ 2 shifts the whole loop.'),
      principle: 'Control voltages patched to the same input add together.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: mc('RHYTHM 1 is ÷1 and RHYTHM 2 is ÷16. How many times does Sequencer 1\'s loop play before Sequencer 2 steps?', ['4', '16', '1'], 0,
        'Sequencer 1 needs 4 pulses per loop and Sequencer 2 steps every 16 pulses. The full phrase is 64 pulses.'),
    },
    {
      kind: 'info', concept: 'signal-routing', focus: ['in_vco1', 'in_vco2'],
      instruction: 'VCO 1\'s input is normalled to VCO 2, so the cable reaches VCO 2 too - until something is patched into VCO 2.',
      explanation: 'Handy for a bass that follows the roots. VCO 2 is silent in this patch, but bring its LEVEL up and it moves with the cable.',
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Make a 16-step bassline: a four-note riff walked through four roots.',
      checklist: [
        { text: 'SEQ 2 → VCO 1 cable', check: s => cable(s, 'out_seq2', 'in_vco1') },
        { text: 'RHYTHM 2 four times slower than RHYTHM 1', check: s => -num(s, 'rhythm2') === 4 * -num(s, 'rhythm1') },
        { text: 'SEQ 2 steps not all the same', check: s => new Set([1, 2, 3, 4].map(i => num(s, `seq2_step${i}`))).size > 1 },
      ],
      hints: ['Sequencer 2 needs a division four times RHYTHM 1\'s.', 'Set the four roots on Sequencer 2\'s knobs.'],
      solution: { values: { rhythm1: D(2), rhythm2: D(8), seq2_step1: 0, seq2_step2: -42, seq2_step3: -17, seq2_step4: 17 }, patches: [{ from: 'out_seq2', to: 'in_vco1' }] },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How can two 4-step sequencers make a 16-step phrase?',
        model: 'One runs fast and plays the riff; the other steps four times slower and transposes it, so the combination only repeats after 16 notes.',
      },
    },
  ],
  review: [
    mc('Two CVs into one VCO input…', ['Add together', 'Take turns', 'Cancel out'], 0, 'Inputs are summed.'),
    mc('VCO 1 IN is normalled to…', ['VCO 2\'s pitch input', 'The filter', 'Nothing'], 0, 'Manual p.31.'),
    mc('To transpose a loop once per cycle, the transposing sequencer runs…', ['4 times slower', '4 times faster', 'At the same rate'], 0, 'Four steps of the riff per root.'),
  ],
};

const sq3: Lesson = {
  id: 'subharmonicon-sq3-undertone-melodies', device: DEV, path: 'sequencing', order: 3, difficulty: 'advanced',
  name: 'Sequencing the undertones',
  description: 'SEQ ASSIGN SUB: the sequencer walks the undertone series while the VCO stays put.',
  objective: 'Use SEQ ASSIGN SUB so the sequencer walks the undertone series instead of moving the VCO.',
  source: 'Synth Studio · Moog Exploration Patchbook, undertone sequencing (p.5) and SEQ ASSIGN (Owner\'s Manual p.26)', estimatedMinutes: 9,
  prerequisites: ['subharmonicon-et2-undertone-colours', 'subharmonicon-f5-sequencer'],
  concepts: ['subharmonics', 'sequencer-pattern'],
  start: init({
    rhythm1: D(2), rhythm1_seq1: true, tempo: 616,
    vco1_freq: 1046.5, vco1_level: 10, vco1_sub1_freq: D(8), vco1_sub1_level: 70, vco1_wave: 2,
    seq_oct: 2, quantize: 0, seq1_step1: 0, seq1_step2: 25, seq1_step3: 50, seq1_step4: -25,
    cutoff: 3000, vcf_eg_amt: 30, vcf_decay: 250, vca_decay: 300, volume: 85,
  }),
  steps: [
    {
      kind: 'do', control: 'seq1_sub1', targetValue: true, concept: 'subharmonics',
      instruction: 'Light SUB 1 in SEQ 1 ASSIGN, leaving OSC 1 dark.',
      principle: 'Sequencing a divider\'s whole number moves along the undertone series, not the keyboard.',
      manualReference: 'p.26 – SEQ 1 ASSIGN, SUB 1',
    },
    play('Press PLAY.', 'Whole-number steps make every note of the melody a ratio of one pitch.'),
    {
      kind: 'predict', control: 'seq1_step2', targetValue: 60, concept: 'subharmonics',
      instruction: 'Turn STEP 2 further clockwise, to about +60.',
      predict: mc('Turning a STEP clockwise makes SUB 1\'s divisor…', ['Smaller, so that note moves up the undertone series', 'Larger, so it drops', 'Unchanged - only OSC moves pitch'], 0,
        'Positive voltage raises the pitch, and for a divider that means a smaller divisor. SUB assign changes the whole number even with OSC dark (manual p.26).'),
      principle: 'Raising a divider\'s control lowers its divisor, so the sub\'s pitch rises.',
    },
    {
      kind: 'listen', concept: 'subharmonics', focus: ['seq1_osc', 'seq1_sub1'],
      instruction: 'The same knobs, two destinations.',
      listen: {
        a: { seq1_osc: true, seq1_sub1: false }, b: { seq1_osc: false, seq1_sub1: true }, labels: ['OSC 1', 'SUB 1'],
        question: mc('Which melody stays on one harmonic grid?', ['A (OSC)', 'B (SUB 1)'], 1, 'With SUB assign every note is VCO ÷ n, so all notes share the VCO as their common source.'),
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'subharmonics',
      quiz: mc('With only SUB 1 assigned, which part stays fixed?', ['VCO 1 and SUB 2', 'SUB 1', 'Nothing'], 0, 'Only SUB 1\'s divisor moves; the VCO and the other sub keep their settings.'),
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Write a four-step undertone melody in which VCO 1 never changes pitch.',
      checklist: [
        { text: 'OSC 1 dark', check: s => !bool(s, 'seq1_osc') },
        { text: 'SUB 1 or SUB 2 assigned', check: s => bool(s, 'seq1_sub1') || bool(s, 'seq1_sub2') },
        { text: 'At least three different steps', check: s => new Set([1, 2, 3, 4].map(i => Math.round(num(s, `seq1_step${i}`) / 10))).size >= 3 },
      ],
      hints: ['Keep OSC 1 dark.', 'Spread the STEP knobs widely: small moves barely change a divisor.'],
      solution: { values: { seq1_osc: false, seq1_sub1: true, seq1_step1: 0, seq1_step2: 40, seq1_step3: 60, seq1_step4: -30 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How does an undertone melody differ from a keyboard melody?',
        model: 'Its notes are whole-number divisions of one fixed pitch, so they come from the undertone series rather than the 12-note scale, and they stay locked together.',
      },
    },
  ],
  review: [
    mc('SEQ ASSIGN SUB 1 changes…', ['SUB 1\'s whole number', 'VCO 1\'s pitch', 'The filter'], 0, 'Manual p.26.'),
    mc('A smaller divisor means…', ['A higher sub pitch', 'A lower sub pitch', 'A quieter sub'], 0, 'f/2 is higher than f/3.'),
    mc('The SEQ ASSIGN buttons can be combined…', ['In any combination', 'Only one at a time', 'Only OSC with SUB 2'], 0, 'Manual p.26.'),
  ],
};

// ============================================================================
// PERFORMANCE
// ============================================================================

const pf1: Lesson = {
  id: 'subharmonicon-pf1-live', device: DEV, path: 'performance', order: 1, difficulty: 'intermediate',
  name: 'Live moves: RESET, hold and assignments',
  description: 'Perform an arrangement with the assign buttons, RESET tapped and held, and mixer rides.',
  objective: 'Perform a short arrangement using assign buttons, RESET (tap and hold) and mixer rides.',
  source: `${SRC}, RESET and NEXT (p.29)`, estimatedMinutes: 10,
  prerequisites: ['subharmonicon-sq1-or-xor'],
  concepts: ['polyrhythm', 'sequencer-pattern'],
  start: fromPreset('poly_or'),
  steps: [
    play('Press PLAY.', 'Live variation comes from changing routings, not only knob positions.'),
    {
      kind: 'predict', control: 'rhythm2_seq1', targetValue: false, concept: 'polyrhythm',
      instruction: 'Turn off RHYTHM 2\'s SEQ 1 button mid-phrase.',
      predict: mc('What happens?', ['The extra hits drop out, leaving the plain ÷2 pulse', 'The sequencer stops', 'It resets to step 1'], 0,
        'Assignments take effect on the next pulse. Only RESET returns the sequence to step 1.'),
      principle: 'Removing a pulse source thins a rhythm at once without stopping it.',
    },
    {
      kind: 'do', control: 'reset', targetValue: true, concept: 'sequencer-pattern', focus: ['reset'],
      instruction: 'Tap RESET on a strong beat to restart everything together, like a new section.',
      principle: 'Restarting a pattern on the downbeat marks the start of a new section.',
      explanation: 'With PLAY lit the restart begins on the next clock pulse (manual p.29).',
      manualReference: 'p.29 – RESET',
    },
    {
      kind: 'info', concept: 'sequencer-pattern', focus: ['reset', 'next'],
      instruction: 'Now hold RESET: the sequence freezes on step 1 while the notes keep firing. Tap NEXT while holding, then let go.',
      explanation: 'Holding RESET keeps the sequencers on one step, but the assigned rhythm generators still fire the envelopes; NEXT moves the held step (manual p.29). A stutter.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: mc('While RESET is held, the envelopes…', ['Keep firing from the assigned rhythms', 'Stop', 'Hold at maximum'], 0,
        'The hold only freezes the step position; the rhythm generators keep triggering notes, which is how you get the stutter.'),
    },
    {
      kind: 'do', control: 'vco2_sub1_level', targetValue: 0, concept: 'mixing',
      instruction: 'Ride VCO 2 SUB 1 LEVEL down to zero for a breakdown.',
      principle: 'Removing the low end makes a breakdown; bringing it back makes the drop.',
    },
    {
      kind: 'challenge', concept: 'polyrhythm',
      instruction: 'Bring the groove back: re-add RHYTHM 2 to SEQ 1 and the bass, then tap RESET on the downbeat.',
      checklist: [
        { text: 'RHYTHM 2 back on SEQ 1', check: s => bool(s, 'rhythm2_seq1') },
        { text: 'Bass back', check: s => num(s, 'vco2_sub1_level') >= 40 },
        { text: 'Still playing', check: s => s.transport.playing || !!s.engine.playing },
      ],
      hints: ['Undo the two moves you made.', 'Then tap RESET right on the beat.'],
      solution: { values: { rhythm2_seq1: true, vco2_sub1_level: 60 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Which three live moves on the Subharmonicon change the music most, and how?',
        model: 'Toggling rhythm assignments changes the groove, RESET (tapped or held) restarts or stutters the phrase, and mixer rides bring parts in and out.',
      },
    },
  ],
  review: [
    mc('Holding RESET…', ['Freezes on step 1 while notes keep firing', 'Stops everything', 'Mutes the VCA'], 0, 'Manual p.29.'),
    mc('Tapping RESET while playing restarts…', ['On the next clock pulse', 'After one bar', 'Only when stopped'], 0, 'Manual p.29.'),
    mc('A change of assignment takes effect…', ['On the next pulse', 'After RESET', 'At power-up'], 0, 'The generators are read on every pulse.'),
  ],
};

// ============================================================================
// STUDIO
// ============================================================================

const st1: Lesson = {
  id: 'subharmonicon-st1-studio-clock', device: DEV, path: 'studio', order: 1, difficulty: 'intermediate',
  name: 'Lock to the studio clock',
  description: 'MIDI-style sync makes the master pulse a 16th note; a Studio Clock cable into CLOCK takes over from it.',
  objective: 'Sync the Subharmonicon to the studio by MIDI-style sync and by a clock cable, and explain the 16th-note pulse.',
  source: `${SRC}, TEMPO (p.25) and CLOCK IN (p.37)`, estimatedMinutes: 9,
  requires: ['studio-clock'],
  prerequisites: ['subharmonicon-f6-rhythm'],
  concepts: ['timing-tempo', 'signal-routing'],
  start: fromPreset('poly_34'),
  steps: [
    {
      kind: 'info', concept: 'timing-tempo', focus: ['in_midi'],
      instruction: 'Synced, the Subharmonicon follows the studio like MIDI clock: one master pulse per 16th note of the studio tempo.',
      explanation: 'Moog: the internal clock is one pulse per beat, but with MIDI clock the pulse is a 16th note (manual p.25). The MIDI light beside MIDI IN flickers with it.',
    },
    {
      kind: 'predict', concept: 'timing-tempo', check: s => s.transport.playing,
      instruction: 'Press ▶ in the top bar.',
      predict: mc('Synced at 120 BPM, RHYTHM 4 is ÷4. How often does Sequencer 2 step?', ['Every quarter note, twice a second', 'Every 16th note', 'Once a bar'], 0,
        'A 16th-note pulse ÷4 is a quarter note. On the internal clock the same ÷4 would follow TEMPO, which counts beats.'),
      principle: 'A follower divides the leader\'s clock, so divisions turn straight into note values.',
      solution: { transport: 'play' },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: mc('Why does TEMPO do nothing now?', ['The studio\'s MIDI-style clock overrides the internal clock', 'PLAY is off', 'TEMPO only works with CLOCK IN'], 0,
        'MIDI clock outranks TEMPO (manual p.25). The last option is backwards: a CLOCK cable also overrides TEMPO.'),
    },
    {
      kind: 'challenge', instance: 'studio-clock', focus: ['out_clock'], concept: 'signal-routing',
      instruction: 'In the Studio tab, patch Studio Clock CLOCK into the Subharmonicon\'s CLOCK input (bottom row).',
      checklist: [{ text: 'Studio Clock CLOCK → Subharmonicon CLOCK', check: s => studioCable(s, 'out_clock', 'in_clock', 'studio-clock', DEV) }],
      hints: ['Open the Studio tab at the top of the page.', 'Tap CLOCK on the Studio Clock, then CLOCK (the input, plain legend) on the Subharmonicon.'],
      solution: { studioCables: [{ from: { device: 'studio-clock', jack: 'out_clock' }, to: { device: DEV, jack: 'in_clock' } }] },
    },
    {
      kind: 'info', concept: 'signal-routing', focus: ['in_clock'],
      instruction: 'Now every pulse on the cable is a master pulse. The studio\'s ▶ and ■ still start and stop PLAY.',
      explanation: 'On the hardware MIDI clock would outrank the cable (manual p.25); the twin lets the cable take over so analog clocking works without unplugging the studio sync.',
    },
    {
      kind: 'challenge', instance: 'studio-clock', focus: ['division'], concept: 'timing-tempo',
      instruction: 'Set the Studio Clock\'s CLOCK DIV to 1/8: the whole pattern plays at half speed.',
      checklist: [{ text: 'CLOCK DIV on 1/8', check: s => Number(deviceValues(s, 'studio-clock').division) === 1 }],
      hints: ['CLOCK DIV is the selector on the Studio Clock.', 'Tap 1/8: two pulses per beat instead of four.'],
      solution: { instance: 'studio-clock', values: { division: 1 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why do RHYTHM divisions feel faster under MIDI sync than on TEMPO at the same number?',
        model: 'TEMPO pulses once per beat, but MIDI clock drives the master pulse at 16th notes, so every division counts 16ths - four times as many pulses per beat.',
      },
    },
  ],
  review: [
    mc('Under MIDI clock the master pulse is…', ['A 16th note', 'A beat', 'A bar'], 0, 'Manual p.25.'),
    mc('On the hardware the clock priority is…', ['MIDI > CLOCK IN > TEMPO', 'TEMPO > MIDI', 'CLOCK IN > MIDI'], 0, 'Manual p.25.'),
    mc('CLOCK OUT sends pulses…', ['Only while playing', 'Always', 'Only when stopped'], 0, 'Manual p.37.'),
    mc('A gate into PLAY IN…', ['Plays while high and stops when it falls', 'Toggles on each edge', 'Resets the sequence'], 0, 'Rising edge = play, falling edge = stop (manual p.34).'),
  ],
};

const st2: Lesson = {
  id: 'subharmonicon-st2-clock-dfam', device: DEV, path: 'studio', order: 2, difficulty: 'advanced',
  name: 'The Subharmonicon clocks the DFAM',
  description: 'Moog\'s pairing: the Subharmonicon\'s clock outputs step the DFAM - steadily, or with a polyrhythm.',
  objective: 'Clock the DFAM from the Subharmonicon, and make it follow one of its sequencers\' rhythms.',
  source: `${SRC}, "Using Subharmonicon to clock your DFAM" (p.38)`, estimatedMinutes: 10,
  requires: ['dfam'],
  prerequisites: ['subharmonicon-st1-studio-clock', 'subharmonicon-sq1-or-xor'],
  concepts: ['timing-tempo', 'signal-routing', 'polyrhythm'],
  start: fromPreset('poly_or'),
  steps: [
    {
      kind: 'info', concept: 'timing-tempo', focus: ['out_clock', 'out_seq1_clk', 'out_seq2_clk', 'out_trigger'],
      instruction: 'The DFAM has no MIDI. The Subharmonicon can be its clock: one pulse per DFAM step.',
      explanation: 'Moog\'s recipe: Subharmonicon CLOCK into DFAM ADV/CLOCK. For a polyrhythmic DFAM use TRIGGER, SEQ 1 CLK or SEQ 2 CLK instead (manual p.38).',
    },
    {
      kind: 'challenge', focus: ['out_seq1_clk'], concept: 'signal-routing',
      instruction: 'In the Studio tab, patch the Subharmonicon\'s SEQ 1 CLK into the DFAM\'s ADV/CLOCK.',
      checklist: [{ text: 'SEQ 1 CLK → ADV/CLOCK', check: s => studioCable(s, 'out_seq1_clk', 'in_adv_clock', DEV, 'dfam') }],
      hints: ['SEQ 1 CLK is an output (reversed legend) in row 7.', 'It pulses each time Sequencer 1 moves (manual p.36).'],
      solution: { studioCables: [{ from: { device: DEV, jack: 'out_seq1_clk' }, to: { device: 'dfam', jack: 'in_adv_clock' } }] },
    },
    {
      kind: 'predict', instance: 'dfam', focus: ['run_stop'], concept: 'timing-tempo',
      check: s => !!deviceValues(s, 'dfam').run_stop,
      solution: { instance: 'dfam', values: { run_stop: true } },
      instruction: 'Press RUN / STOP on the DFAM.',
      predict: mc('The Subharmonicon is stopped. What does the DFAM do?', ['Waits: no pulses arrive yet', 'Plays at its own TEMPO', 'Plays one step'], 0,
        'SEQ 1 CLK only pulses while the Subharmonicon plays, and a cable in ADV/CLOCK replaces the DFAM\'s own tempo. Moog says to press the DFAM\'s RUN / STOP first (manual p.38).'),
      principle: 'Arm the follower first; it then moves only when the leader sends pulses.',
    },
    play('Now press the Subharmonicon\'s PLAY.', 'One leader clock keeps every instrument in time.'),
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'polyrhythm',
      quiz: mc('RHYTHM 1 (÷2) and RHYTHM 2 (÷3) both drive Sequencer 1 with OR. On which master pulses does the DFAM step?', ['On the merged x.xxx. pattern', 'On every pulse', 'Only on the downbeat'], 0,
        'SEQ 1 CLK pulses whenever Sequencer 1 moves, so the DFAM inherits its lopsided rhythm. CLOCK OUT would give every pulse.'),
    },
    {
      kind: 'challenge', concept: 'polyrhythm',
      instruction: 'Change the DFAM\'s groove from the Subharmonicon: add RHYTHM 3 at ÷4 to Sequencer 1.',
      checklist: [
        { text: 'RHYTHM 3 drives SEQ 1', check: s => bool(s, 'rhythm3_seq1') },
        { text: 'RHYTHM 3 at ÷4', check: s => num(s, 'rhythm3') === -4 },
      ],
      hints: ['Light SEQ 1 under RHYTHM 3.', 'Turn RHYTHM 3 to ÷4.'],
      solution: { values: { rhythm3_seq1: true, rhythm3: D(4) } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between clocking the DFAM from CLOCK and from SEQ 1 CLK?',
        model: 'CLOCK sends every master pulse, so the DFAM runs straight 16ths; SEQ 1 CLK only pulses when Sequencer 1 moves, so the DFAM inherits the Subharmonicon\'s polyrhythm.',
      },
    },
  ],
  review: [
    mc('Moog\'s order for syncing the DFAM is…', ['DFAM RUN/STOP first, then Subharmonicon PLAY', 'PLAY first, then RUN/STOP', 'Any order'], 0, 'Manual p.38.'),
    mc('For a polyrhythmic DFAM, clock it from…', ['SEQ 1 CLK, SEQ 2 CLK or TRIGGER', 'VCA', 'MIDI IN'], 0, 'Manual p.38 tip.'),
    mc('SEQ 1 CLK pulses…', ['Each time Sequencer 1 moves', 'On every master pulse', 'Once a bar'], 0, 'Manual p.36.'),
    mc('With a cable in the DFAM\'s ADV/CLOCK, its TEMPO knob…', ['Is ignored', 'Sets the speed', 'Sets the volume'], 0, 'The external clock replaces it.'),
  ],
};

export const SUBHARMONICON_LESSONS: Lesson[] = [f1, f2, f3, f4, f5, f6, sd1, sd2, sd3, et1, et2, et3, et4, et5, sq1, sq2, sq3, pf1, st1, st2];
