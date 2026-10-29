// ============================================================================
// Mother-32 lessons (v2, docs/PEDAGOGY.md)
//
// Paths: foundations (signal flow: VCO -> mixer -> filter -> EG / VCA ->
// modulation -> sequencer -> patching), sound design, ear training (graded:
// one control wide -> one control fine -> two controls -> three mixed),
// sequencing, performance and studio.
//
// Order: device lessons use orders below 1 so the device path is recommended
// before the shared studio curriculum (orders 1-5); the Mother-32 studio
// lessons (orders 8+) come after it and build on it.
//
// In the studio the Mother-32 follows the studio clock (like MIDI clock), so
// RUN / STOP also starts the studio, and the TEMPO knob selects the step
// division. Lessons teach that rather than the internal tempo.
// ============================================================================

import type { ControlValue, Lesson, LessonCheckState, LessonStep } from '@/types';
import { type StepSpec, lengthOf, patternOf, sequence, stepAt } from './sequence';
import { DIVISIONS } from './model';

const O = (n: number) => n / 100;

// ---------------------------------------------------------------- helpers

const num = (s: LessonCheckState, id: string) => Number(s.values[id] ?? 0);
const cable = (s: LessonCheckState, from: string, to: string) =>
  s.patches.some(c => (c.from === from && c.to === to) || (c.from === to && c.to === from));
const studioCable = (s: LessonCheckState, fromJack: string, toJack: string, fromDevice: string, toDevice: string) =>
  s.studioCables.some(c => {
    const dev = (inst: string) => s.instances[inst]?.device;
    return (c.from.jack === fromJack && c.to.jack === toJack && dev(c.from.instance) === fromDevice && dev(c.to.instance) === toDevice) ||
      (c.to.jack === fromJack && c.from.jack === toJack && dev(c.to.instance) === fromDevice && dev(c.from.instance) === toDevice);
  });
const deviceValues = (s: LessonCheckState, device: string) => Object.values(s.instances).find(i => i.device === device)?.values ?? {};
const step = (s: LessonCheckState, i: number) => stepAt(s.values, i);
const recorded = (s: LessonCheckState) => {
  const n = typeof s.values.seq_notes === 'string' ? s.values.seq_notes.indexOf('.') : -1;
  return n < 0 ? lengthOf(s.values) : n;
};
const div = (name: string) => DIVISIONS.findIndex(d => d.name === name);

/** Pattern lanes as control values */
const seq = (steps: StepSpec[], length?: number): Record<string, ControlValue> => ({ ...sequence(steps, { length }) });

// Patterns used by several lessons
const C2 = 36, Eb2 = 39, F2 = 41, G2 = 43, Bb2 = 46, C3 = 48, Eb3 = 51, G3 = 55, C4 = 60;
const BASS = seq([C2, C2, C3, C2, Eb2, C2, G2, Bb2]);
const ROOT8 = seq([C2, C2, C2, C2, C2, C2, C2, C2].map(n => ({ note: n, gate: 3 })));

const run = (principle = 'A step sequencer plays a list of notes in time, one per step, and loops.'): LessonStep => ({
  kind: 'do', control: 'run_stop', targetValue: true, concept: 'sequencer-pattern',
  instruction: 'Press RUN / STOP to start the pattern.',
  principle,
  explanation: 'In the studio the Mother-32 follows the studio clock, so RUN / STOP also starts ▶ in the top bar. Leave it running while you turn knobs - every change is heard on the next note.',
  manualReference: 'Manual v2 p.54 - RUN / STOP',
});

// ============================================================================
// FOUNDATIONS
// ============================================================================

const f1: Lesson = {
  id: 'mother32-f1-vco', device: 'mother32', path: 'foundations', order: O(1), difficulty: 'beginner',
  name: 'The VCO: pitch, wave and width',
  description: 'Where every Mother-32 sound starts: one oscillator, its pitch, its two waves and the pulse width.',
  objective: 'Set the VCO\'s pitch, choose saw or pulse, and shape the pulse width by ear.',
  source: 'Synth Studio · Mother-32 manual v2 p.11 (VCO)', estimatedMinutes: 6,
  concepts: ['oscillator-pitch', 'oscillator-waveform'],
  start: { reset: true, values: { cutoff: 5000, resonance: 0, vcf_mod_amount: 15, decay: 300, sustain: 0, ...BASS } },
  steps: [
    run('An oscillator makes a repeating wave; repeated fast enough, the ear hears it as a pitch.'),
    {
      kind: 'predict', control: 'frequency', targetValue: 1, concept: 'oscillator-pitch',
      instruction: 'Turn FREQUENCY fully clockwise (+1 octave).',
      predict: {
        question: 'What will turning FREQUENCY up do to the pattern?',
        options: ['Every note goes up in pitch', 'It gets louder', 'The notes get longer'], answer: 0,
        explain: 'FREQUENCY sets how many cycles the VCO makes each second, and more cycles sound higher. Fully clockwise is one octave up: twice the frequency. Loudness and length belong to the VCA and envelope, not the oscillator.',
      },
      principle: 'Doubling a wave\'s frequency raises its pitch by one octave.',
      manualReference: 'Manual v2 p.11 - FREQUENCY',
    },
    {
      kind: 'do', control: 'frequency', targetValue: 0, concept: 'oscillator-pitch',
      instruction: 'Return FREQUENCY to the centre (0).',
      principle: 'The keyboard and sequencer add 1 volt per octave on top of the FREQUENCY knob.',
      explanation: 'At the centre, 0 V from the keyboard is middle C. Each step of the pattern adds its own voltage, which is why the line moves.',
    },
    {
      kind: 'listen', concept: 'oscillator-waveform', focus: ['vco_wave'],
      instruction: 'Compare the two waves at the same pitch. Watch the spectrum.',
      listen: {
        a: { vco_wave: 1 }, b: { vco_wave: 0 }, labels: ['SAW', 'PULSE'],
        question: {
          question: 'Which wave sounds hollow, a little like a clarinet?',
          options: ['The saw', 'The pulse (a square at 50 %)'], answer: 1,
          explain: 'A square wave has only the odd harmonics (1, 3, 5...), and that gap is what the ear hears as hollow. A saw has every harmonic, so it sounds bright and buzzy, like brass.',
        },
      },
    },
    {
      kind: 'do', control: 'vco_wave', targetValue: 0, concept: 'oscillator-waveform',
      instruction: 'Flip VCO WAVE up to PULSE.',
      principle: 'Harmonics are quieter, higher pitches inside a tone; which ones are present sets its colour.',
      explanation: 'Both waves always come out of the VCO SAW and VCO PULSE jacks. The switch only picks the one that goes to the mixer.',
      manualReference: 'Manual v2 p.11 - VCO WAVE',
    },
    {
      kind: 'predict', control: 'pulse_width', targetValue: 10, concept: 'oscillator-waveform',
      instruction: 'Turn PULSE WIDTH down to about 10 %.',
      predict: {
        question: 'A thinner pulse moves energy into the upper harmonics. How will it sound?',
        options: ['Thinner and more nasal', 'An octave lower', 'Exactly the same, just quieter'], answer: 0,
        explain: 'The pitch stays put. A narrow pulse has strong upper harmonics and a weak fundamental, so it sounds thin and reedy. It is a little quieter too, but the colour change is what you hear first.',
      },
      principle: 'Narrowing a pulse weakens the fundamental and brightens the upper harmonics.',
      manualReference: 'Manual v2 p.11 - PULSE WIDTH',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'oscillator-waveform',
      quiz: {
        question: 'At 50 % PULSE WIDTH (the centre) the pulse is a…',
        options: ['Square wave', 'Sawtooth', 'Sine wave'], answer: 0,
        explain: 'Half up, half down is a square: odd harmonics only. The saw is the other wave on the switch, and the VCO has no sine.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: set PULSE WIDTH to match the target.', concept: 'oscillator-waveform',
      setup: { pulse_width: 10 },
      match: { target: { vco_wave: 0, pulse_width: 50 }, controls: ['pulse_width'] },
      hints: ['Is the target thin and nasal, or round and hollow?', 'It is the most hollow pulse there is.', 'PULSE WIDTH at the centre: a square.'],
    },
    {
      kind: 'challenge', concept: 'oscillator-pitch',
      instruction: 'Make the pattern bright and buzzy, and one octave lower.',
      checklist: [
        { text: 'VCO WAVE on SAW', check: s => num(s, 'vco_wave') === 1 },
        { text: 'FREQUENCY one octave down (about -1)', check: s => num(s, 'frequency') <= -0.85 },
      ],
      hints: ['Which wave has every harmonic?', 'FREQUENCY covers one octave each way.', 'VCO WAVE down to SAW, FREQUENCY fully counter-clockwise.'],
      solution: { values: { vco_wave: 1, frequency: -1 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence each: what do FREQUENCY, VCO WAVE and PULSE WIDTH change?',
        model: 'FREQUENCY changes the pitch; VCO WAVE picks which harmonics are there (saw: all, pulse: odd); PULSE WIDTH changes the balance of the pulse\'s harmonics, from hollow to thin.',
      },
    },
  ],
  review: [
    { question: 'Raising an oscillator one octave…', options: ['Doubles its frequency', 'Adds 12 Hz', 'Makes it louder'], answer: 0, explain: 'An octave is a 2:1 frequency ratio.' },
    { question: 'Which wave has every harmonic and sounds brightest?', options: ['Sawtooth', 'Square', 'Narrow pulse'], answer: 0, explain: 'The saw has harmonics 1, 2, 3, 4...' },
    { question: 'A square wave sounds hollow because it…', options: ['Has only odd harmonics', 'Has no harmonics', 'Is an octave lower'], answer: 0, explain: 'The missing even harmonics make the hollowness.' },
    { question: 'Turning PULSE WIDTH from 50 % to 10 % makes the sound…', options: ['Thinner and more nasal', 'Lower', 'Longer'], answer: 0, explain: 'Energy moves to the upper harmonics.' },
  ],
};

const f2: Lesson = {
  id: 'mother32-f2-mixer', device: 'mother32', path: 'foundations', order: O(2), difficulty: 'beginner',
  name: 'The mixer: VCO, noise and EXT. AUDIO',
  description: 'One knob crossfades the oscillator against noise - and a cable swaps the noise for anything else.',
  objective: 'Blend the oscillator with noise, and use EXT. AUDIO to replace the noise with another signal.',
  source: 'Synth Studio · Mother-32 manual v2 pp.11, 47-48 (MIX, EXT. AUDIO)', estimatedMinutes: 6,
  prerequisites: ['mother32-f1-vco'],
  concepts: ['mixing', 'noise', 'signal-routing'],
  start: { reset: true, values: { cutoff: 5000, resonance: 0, vcf_mod_amount: 15, decay: 300, sustain: 0, ...BASS } },
  steps: [
    run(),
    {
      kind: 'predict', control: 'mix', targetValue: 100, concept: 'noise',
      instruction: 'Turn MIX fully clockwise.',
      predict: {
        question: 'MIX crossfades the VCO against NOISE. What will you hear at the far right?',
        options: ['A hiss with no pitch', 'A brighter VCO', 'Silence'], answer: 0,
        explain: 'White noise is random: every frequency at once and no repeating pattern, so you cannot sing it. Fully clockwise, MIX passes only the noise, so the notes keep their rhythm but lose their pitch.',
      },
      principle: 'White noise has energy at every frequency and no pitch: the raw material of snares and wind.',
      manualReference: 'Manual v2 p.48 - NOISE, MIX',
    },
    {
      kind: 'do', control: 'mix', targetValue: 50, concept: 'mixing',
      instruction: 'Set MIX to the middle (50 %).',
      principle: 'A crossfader trades one source for another; halfway is an even blend.',
    },
    {
      kind: 'listen', concept: 'mixing', focus: ['mix'],
      instruction: 'Compare the pure VCO with a little noise mixed in.',
      listen: {
        a: { mix: 0 }, b: { mix: 25 }, labels: ['VCO only', 'VCO + noise'],
        question: {
          question: 'Which one could be a breathy flute or the body of a snare?',
          options: ['VCO only', 'VCO + noise'], answer: 1,
          explain: 'A little hiss on top of a tone sounds like breath, or like the wires on a snare drum. The pure VCO has none of that air.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'mixing',
      quiz: {
        question: 'MIX fully counter-clockwise gives you…',
        options: ['Only the VCO', 'Only noise', 'Both equally'], answer: 0,
        explain: 'Left is the VCO side, right the noise side, and the middle an even blend.',
      },
    },
    {
      kind: 'patch', patchFrom: 'out_vco_pulse', patchTo: 'in_ext_audio', concept: 'signal-routing',
      setup: { vco_wave: 1, mix: 50 },
      instruction: 'Patch VCO PULSE into EXT. AUDIO.',
      principle: 'A cable into a normalled input replaces the signal wired there inside.',
      explanation: 'EXT. AUDIO is normalled to the noise. With the pulse patched in and VCO WAVE on SAW, MIX now blends saw against pulse - a tip from the manual for a richer tone.',
      manualReference: 'Manual v2 p.11 - TIP, p.47 - EXT. AUDIO',
    },
    {
      kind: 'listen', concept: 'mixing', focus: ['mix'],
      instruction: 'Compare the saw alone with saw plus pulse.',
      listen: { a: { mix: 0 }, b: { mix: 50 }, labels: ['Saw', 'Saw + pulse'] },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Why did the hiss disappear when you patched EXT. AUDIO?',
        options: ['The cable replaced the normalled noise', 'MIX was turned down', 'The filter removed it'], answer: 0,
        explain: 'The noise reaches the mixer through EXT. AUDIO\'s normal. A cable there breaks that link. MIX was still in the middle the whole time.',
      },
    },
    {
      kind: 'challenge', concept: 'mixing',
      instruction: 'Make the blend mostly pulse with a little saw underneath.',
      checklist: [
        { text: 'VCO PULSE patched into EXT. AUDIO', check: s => cable(s, 'out_vco_pulse', 'in_ext_audio') },
        { text: 'MIX between 60 % and 85 %', check: s => num(s, 'mix') >= 60 && num(s, 'mix') <= 85 },
      ],
      hints: ['Which side of MIX is EXT. AUDIO now?', 'Turn MIX toward the right, but not all the way.', 'MIX at about 70 %.'],
      solution: { values: { mix: 70 }, patches: [{ from: 'out_vco_pulse', to: 'in_ext_audio' }] },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does EXT. AUDIO replace when you patch it, and what does MIX then blend?',
        model: 'It replaces the noise that is normalled there, so MIX crossfades the VCO wave against whatever is patched into EXT. AUDIO.',
      },
    },
  ],
  review: [
    { question: 'White noise has…', options: ['Energy at all frequencies and no pitch', 'One pitch', 'Only bass'], answer: 0, explain: 'It is random.' },
    { question: 'EXT. AUDIO on the Mother-32 is normalled to…', options: ['NOISE', 'The VCO saw', 'The EG'], answer: 0, explain: 'A cable there replaces the noise.' },
    { question: 'MIX at 50 % gives…', options: ['An even blend of the two sources', 'Only the VCO', 'Silence'], answer: 0, explain: 'It is a crossfader.' },
  ],
};

const f3: Lesson = {
  id: 'mother32-f3-filter', device: 'mother32', path: 'foundations', order: O(3), difficulty: 'beginner',
  name: 'The ladder filter: brightness, ring and HI PASS',
  description: 'CUTOFF and RESONANCE on the Moog ladder, the filter singing by itself, and the Mother-32\'s unusual high-pass.',
  objective: 'Use CUTOFF and RESONANCE to shape the tone, make the filter sing by itself, and know when HI PASS helps.',
  source: 'Synth Studio · Mother-32 manual v2 p.14 (VCF) and the preset PLAY THE FILTER', estimatedMinutes: 8,
  prerequisites: ['mother32-f2-mixer'],
  concepts: ['filter-cutoff', 'filter-resonance', 'filter-type'],
  start: { reset: true, values: { vco_wave: 1, cutoff: 8000, resonance: 0, vcf_mod_amount: 0, decay: 500, sustain: 0, ...BASS } },
  steps: [
    run(),
    {
      kind: 'predict', control: 'cutoff', targetValue: 300, concept: 'filter-cutoff',
      instruction: 'Turn CUTOFF down to about 300 Hz.',
      predict: {
        question: 'What will turning CUTOFF down do?',
        options: ['Make it darker and duller', 'Lower the pitch', 'Make the notes shorter'], answer: 0,
        explain: 'The pitch stays the same. The low-pass removes the harmonics above the cutoff, so the tone gets darker. It also gets a little quieter because energy is removed, but that is a side effect.',
      },
      principle: 'A low-pass filter removes harmonics above the cutoff; the oscillator, not the filter, sets the pitch.',
      manualReference: 'Manual v2 p.14 - CUTOFF',
    },
    {
      kind: 'listen', concept: 'filter-cutoff', focus: ['cutoff'],
      instruction: 'Compare the open and the closed filter. Watch the harmonics vanish in the spectrum.',
      listen: { a: { cutoff: 8000 }, b: { cutoff: 300 }, labels: ['Open (8 kHz)', 'Closed (300 Hz)'] },
    },
    {
      kind: 'do', control: 'resonance', targetValue: 60, concept: 'filter-resonance',
      instruction: 'Turn RESONANCE up to about 60 %.',
      principle: 'Resonance feeds the filter\'s output back to its input, boosting a narrow band at the cutoff.',
      explanation: 'That boosted band rings like a wet finger on a glass. On a Moog ladder the bass also thins out a little as resonance rises.',
      manualReference: 'Manual v2 p.14 - RESONANCE',
    },
    {
      kind: 'do', control: 'cutoff', targetValue: 1200, concept: 'filter-cutoff',
      instruction: 'Sweep CUTOFF slowly up to about 1.2 kHz and listen to the ringing peak move.',
      principle: 'Moving a resonant peak through the harmonics makes a vowel-like "wow".',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-cutoff',
      quiz: {
        question: 'A square wave through a low-pass set below its second harmonic sounds…',
        options: ['Almost like a sine wave', 'Brighter', 'An octave higher'], answer: 0,
        explain: 'Only the fundamental gets through, and a lone fundamental is a sine. The pitch stays the same.',
      },
    },
    {
      kind: 'predict', control: 'resonance', targetValue: 90, concept: 'filter-resonance',
      setup: { mix: 100, cutoff: 440, resonance: 40, vca_mode: 0 },
      setupPatches: [{ from: 'out_mult1', to: 'in_ext_audio' }],
      instruction: 'The VCO and noise are now muted (MIX right over, a silent cable in EXT. AUDIO). Turn RESONANCE to about 90 %.',
      predict: {
        question: 'Past about 3 o\'clock the filter whistles on its own. What is it doing?',
        options: ['Oscillating - it has become a sine-wave source', 'Distorting the VCO', 'Echoing the last note'], answer: 0,
        explain: 'With enough feedback the ladder feeds itself and oscillates at the cutoff frequency with no input at all. The manual\'s preset PLAY THE FILTER uses it as a second oscillator.',
      },
      principle: 'With enough feedback a filter oscillates by itself, producing a sine at the cutoff frequency.',
      manualReference: 'Manual v2 p.14 - TIP: the VCF as a sine source',
    },
    {
      kind: 'do', control: 'cutoff', targetValue: 880, concept: 'filter-cutoff',
      instruction: 'Turn CUTOFF to about 880 Hz: the whistle rises an octave.',
      principle: 'A self-oscillating filter is a sine oscillator tuned by its cutoff.',
      explanation: 'Patch KB into VCF CUTOFF and it would follow the keyboard at 1 V per octave, like a second VCO.',
    },
    {
      kind: 'predict', control: 'vcf_mode', targetValue: 0, concept: 'filter-type',
      setup: { mix: 0, resonance: 0, vca_mode: 1, cutoff: 600 },
      setupPatches: [],
      instruction: 'Back to the bass line. Flip VCF MODE up to HI PASS.',
      predict: {
        question: 'High-pass keeps what is above CUTOFF. What happens to this bass line?',
        options: ['It gets thinner - the lows drop away', 'It gets deeper', 'Nothing changes'], answer: 0,
        explain: 'High-pass throws away the fundamental and the lowest harmonics, the body of the sound. On the Mother-32 it is a gentle slope, so some bass always remains.',
      },
      principle: 'A high-pass filter removes what is below the cutoff, leaving the thin, bright top.',
      manualReference: 'Manual v2 p.14 - VCF MODE',
    },
    {
      kind: 'predict', control: 'resonance', targetValue: 80, concept: 'filter-resonance',
      instruction: 'Still in HI PASS, turn RESONANCE up to about 80 %.',
      predict: {
        question: 'What will RESONANCE do in HI PASS on the Mother-32?',
        options: ['Bring the bass back instead of ringing', 'Ring like the low-pass', 'Make it silent'], answer: 0,
        explain: 'The manual warns that HI PASS is non-resonant: turning RESONANCE up "reintroduces bottom end", so the filter stops working as a high-pass. For a ringing high-pass the manual patches VCF back into EXT. AUDIO and uses MIX as the resonance.',
      },
      principle: 'Every filter design has its own character; read the manual, then trust your ears.',
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target low-pass sound.', concept: 'filter-resonance',
      setup: { vcf_mode: 1, cutoff: 3000, resonance: 5 },
      match: { target: { vcf_mode: 1, cutoff: 600, resonance: 70 }, controls: ['cutoff', 'resonance'] },
      hints: ['First, how bright is it? Then, how much does it ring?', 'The target rings, but does not whistle on its own.', 'CUTOFF in the low mids, about 600 Hz; RESONANCE about 70 %.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does RESONANCE do in LOW PASS, and what does it do in HI PASS on the Mother-32?',
        model: 'In LOW PASS it boosts and rings at the cutoff, and past 3 o\'clock the filter sings by itself; in HI PASS it does not ring but lets the bass back in.',
      },
    },
  ],
  review: [
    { question: 'Turning CUTOFF down on a low-pass filter…', options: ['Removes high harmonics (darker)', 'Lowers the pitch', 'Adds distortion'], answer: 0, explain: 'Pitch is set by the VCO.' },
    { question: 'A self-oscillating ladder filter produces…', options: ['A sine wave at the cutoff frequency', 'White noise', 'A square wave'], answer: 0, explain: 'Feedback makes it ring by itself.' },
    { question: 'On the Mother-32, RESONANCE in HI PASS mode…', options: ['Brings the bass back', 'Makes it ring', 'Mutes it'], answer: 0, explain: 'The HI PASS mode is non-resonant.' },
    { question: 'Raising RESONANCE on a Moog low-pass also tends to…', options: ['Thin out the lows', 'Raise the pitch', 'Lengthen the notes'], answer: 0, explain: 'The classic ladder bass loss.' },
  ],
};

const f4: Lesson = {
  id: 'mother32-f4-eg-vca', device: 'mother32', path: 'foundations', order: O(4), difficulty: 'beginner',
  name: 'The envelope and VCA: when a note starts and stops',
  description: 'ATTACK, DECAY, the SUSTAIN switch, and VCA MODE for drones.',
  objective: 'Shape each note with ATTACK, DECAY and the SUSTAIN switch, and use VCA MODE for drones.',
  source: 'Synth Studio · Mother-32 manual v2 pp.15-16 (EG, VCA)', estimatedMinutes: 7,
  prerequisites: ['mother32-f3-filter'],
  concepts: ['envelope-attack', 'envelope-decay', 'envelope-sustain', 'gain-staging'],
  start: { reset: true, values: { cutoff: 2500, resonance: 10, vcf_mod_amount: 20, attack: 2, decay: 300, sustain: 0, ...seq([{ note: C3, gate: 6 }, null, { note: Eb3, gate: 2 }, null, { note: G3, gate: 6 }, null, { note: Bb2, gate: 2 }, null]) } },
  steps: [
    run('An envelope is a shape over time; through the VCA it becomes the loudness of each note.'),
    {
      kind: 'predict', control: 'decay', targetValue: 2000, concept: 'envelope-decay',
      instruction: 'Turn DECAY up to about 2 seconds.',
      predict: {
        question: 'With SUSTAIN ON, DECAY is how long a note fades after its gate ends. What will you hear?',
        options: ['The notes ring on and blur together', 'The notes come faster', 'The pitch drops'], answer: 0,
        explain: 'Each note now fades for two seconds after its gate closes, so it is still sounding when the next one starts. When the notes happen is the sequencer\'s job, not DECAY\'s.',
      },
      principle: 'A decay or release stage sets how long a sound takes to fade out.',
      manualReference: 'Manual v2 p.16 - DECAY',
    },
    {
      kind: 'do', control: 'decay', targetValue: 80, concept: 'envelope-decay',
      instruction: 'Now turn DECAY right down to about 80 ms.',
      principle: 'With a fast release each note stops almost as soon as its gate ends.',
      explanation: 'Listen to the long and short steps: with SUSTAIN ON the gate length now decides how long each note lasts.',
    },
    {
      kind: 'predict', control: 'sustain', targetValue: 1, concept: 'envelope-sustain',
      instruction: 'Flip SUSTAIN down to OFF.',
      predict: {
        question: 'With SUSTAIN OFF the envelope falls as soon as it reaches the top, even while the gate is high. What happens to the long notes?',
        options: ['They become short plucks like the others', 'They get longer', 'They get louder'], answer: 0,
        explain: 'SUSTAIN OFF makes an attack-decay envelope, so the gate length no longer matters. That is why the manual says SUSTAIN must be ON for gate lengths to sound.',
      },
      principle: 'An attack-decay envelope ignores how long the key is held; a sustaining one follows it.',
      manualReference: 'Manual v2 p.16 - SUSTAIN',
    },
    {
      kind: 'listen', concept: 'envelope-sustain', focus: ['sustain'],
      instruction: 'Compare SUSTAIN ON and OFF with a medium DECAY.',
      listen: {
        a: { sustain: 0, decay: 300 }, b: { sustain: 1, decay: 300 }, labels: ['SUSTAIN ON', 'SUSTAIN OFF'],
        question: {
          question: 'Which one holds each note for its whole gate?',
          options: ['SUSTAIN ON', 'SUSTAIN OFF'], answer: 0,
          explain: 'ON holds the envelope at its peak while the gate is high, like an organ; OFF lets it fall straight away.',
        },
      },
    },
    {
      kind: 'do', control: 'attack', targetValue: 600, concept: 'envelope-attack',
      instruction: 'Turn ATTACK up to about 600 ms.',
      principle: 'Attack is the fade-in time: fast snaps like a pluck, slow swells like a bowed string.',
      manualReference: 'Manual v2 p.15 - ATTACK',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-attack',
      quiz: {
        question: 'Which control sets how quickly a note fades in?',
        options: ['ATTACK', 'DECAY', 'VCA MODE'], answer: 0,
        explain: 'ATTACK is the rise; DECAY is the fall. VCA MODE decides whether the envelope controls the volume at all.',
      },
    },
    {
      kind: 'predict', control: 'vca_mode', targetValue: 0, concept: 'gain-staging',
      instruction: 'Flip VCA MODE up to ON.',
      predict: {
        question: 'ON holds the VCA fully open. What will you hear between the notes?',
        options: ['A continuous drone', 'Silence', 'Only the attacks'], answer: 0,
        explain: 'The VCA no longer waits for the envelope, so the oscillator is heard all the time - a drone. The envelope still moves the filter and anything else it is patched to.',
      },
      principle: 'A VCA is a volume control worked by voltage; held open, nothing silences the oscillator.',
      manualReference: 'Manual v2 p.16 - VCA MODE',
    },
    {
      kind: 'do', control: 'vca_mode', targetValue: 1, concept: 'gain-staging',
      instruction: 'Flip VCA MODE back down to EG.',
      principle: 'Silence between notes is as important as the notes; the envelope and VCA make it.',
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target note shape.', concept: 'envelope-decay',
      setup: { attack: 2, decay: 80, sustain: 0 },
      match: { target: { attack: 2, decay: 900, sustain: 1 }, controls: ['decay', 'sustain'] },
      hints: ['Two questions: does each note hold, and how long does it ring?', 'The notes never hold, but they ring for nearly a second.', 'SUSTAIN OFF, DECAY just under a second.'],
    },
    {
      kind: 'challenge', concept: 'envelope-decay',
      instruction: 'Make a plucked sound: an instant start, a quick fade, and no holding.',
      checklist: [
        { text: 'ATTACK under 10 ms', check: s => num(s, 'attack') < 10 },
        { text: 'DECAY under 400 ms', check: s => num(s, 'decay') < 400 },
        { text: 'SUSTAIN OFF', check: s => num(s, 'sustain') === 1 },
        { text: 'VCA MODE on EG', check: s => num(s, 'vca_mode') === 1 },
      ],
      hints: ['Which switch stops the note holding?', 'Then make the attack instant and the decay short.', 'ATTACK fully left, DECAY about 250 ms, SUSTAIN OFF.'],
      solution: { values: { attack: 2, decay: 250, sustain: 1, vca_mode: 1 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does the SUSTAIN switch change about DECAY?',
        model: 'With SUSTAIN ON the envelope holds while the gate is high and DECAY is the release afterwards; with it OFF, DECAY starts right after the attack whatever the gate does.',
      },
    },
  ],
  review: [
    { question: 'For gate lengths to sound on the Mother-32, SUSTAIN must be…', options: ['ON', 'OFF', 'Either'], answer: 0, explain: 'OFF makes every note an attack-decay pluck.' },
    { question: 'A slow ATTACK makes notes…', options: ['Swell in', 'Snap in', 'Repeat'], answer: 0, explain: 'Attack is the fade-in.' },
    { question: 'VCA MODE ON gives…', options: ['A drone that needs no gate', 'Silence', 'A shorter decay'], answer: 0, explain: 'The VCA is held open.' },
  ],
};

const f5: Lesson = {
  id: 'mother32-f5-modulation', device: 'mother32', path: 'foundations', order: O(5), difficulty: 'intermediate',
  name: 'Modulation: VCO MOD, VCF MOD and the LFO',
  description: 'Source, amount and destination: vibrato, PWM, filter sweeps and the POLARITY switch.',
  objective: 'Route the LFO and the EG to pitch, pulse width and cutoff with the MOD switches, amounts and polarity.',
  source: 'Synth Studio · Mother-32 manual v2 pp.12-15 (VCO MOD, LFO, VCF MOD)', estimatedMinutes: 8,
  prerequisites: ['mother32-f4-eg-vca'],
  concepts: ['modulation-source', 'modulation-depth', 'lfo'],
  start: { reset: true, values: { vco_wave: 0, cutoff: 2000, resonance: 20, vcf_mod_amount: 0, decay: 800, sustain: 0, lfo_rate: 6, ...seq([{ note: C3, gate: 8 }, { note: C3, gate: 7 }, { note: Eb3, gate: 8 }, { note: Eb3, gate: 7 }, { note: G2, gate: 8 }, { note: G2, gate: 7 }, { note: Bb2, gate: 8 }, { note: Bb2, gate: 7 }]) } },
  steps: [
    run('Modulation is one signal turning a knob for you, automatically and much faster than a hand.'),
    {
      kind: 'predict', control: 'vco_mod_amount', targetValue: 12, concept: 'modulation-depth',
      instruction: 'Turn VCO MOD AMOUNT up to about 12 %.',
      predict: {
        question: 'VCO MOD SOURCE is on LFO and VCO MOD DEST on FREQ. What will a little AMOUNT do?',
        options: ['A wobble in pitch - vibrato', 'A "wah" in the tone', 'A tremolo in volume'], answer: 0,
        explain: 'The LFO\'s slow wave now moves the VCO\'s pitch up and down a little, six times a second: vibrato. The filter and the VCA are not involved.',
      },
      principle: 'A small, slow modulation of pitch is heard as vibrato.',
      manualReference: 'Manual v2 p.12 - VCO MOD',
    },
    {
      kind: 'do', control: 'vco_mod_dest', targetValue: 0, concept: 'modulation-source',
      instruction: 'Flip VCO MOD DEST up to PW (pulse width).',
      principle: 'The same modulator on a different destination is a different effect.',
      explanation: 'Now the LFO moves the pulse width instead of the pitch: the harmonics shift while the pitch stays still.',
    },
    {
      kind: 'do', control: 'vco_mod_amount', targetValue: 60, concept: 'modulation-depth',
      instruction: 'Turn VCO MOD AMOUNT up to about 60 %.',
      principle: 'Pulse-width modulation constantly moves the harmonics, which sounds wide and chorus-like.',
    },
    {
      kind: 'listen', concept: 'modulation-depth', focus: ['vco_mod_amount'],
      instruction: 'Compare a plain pulse with the moving one.',
      listen: {
        a: { vco_mod_amount: 0 }, b: { vco_mod_amount: 60 }, labels: ['Plain pulse', 'PWM'],
        question: {
          question: 'Which one sounds wider, almost like two oscillators?',
          options: ['Plain pulse', 'PWM'], answer: 1,
          explain: 'The moving width makes the harmonics drift against each other, a little like two detuned oscillators. That is the classic PWM string sound.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'modulation-source',
      quiz: {
        question: 'VCO MOD SOURCE on EG with VCO MOD DEST on FREQ gives…',
        options: ['A pitch sweep on every note', 'A steady vibrato', 'Pulse-width movement'], answer: 0,
        explain: 'The envelope rises and falls once per note, so the pitch jumps up and falls back each time: a drum thump or a zap. Vibrato needs the LFO.',
      },
    },
    {
      kind: 'do', control: 'vcf_mod_amount', targetValue: 50, concept: 'modulation-depth',
      instruction: 'Turn VCF MOD AMOUNT up to about 50 % (source EG, polarity +).',
      principle: 'An envelope on the cutoff opens the filter at the start of each note: a bright attack, a darker tail.',
      manualReference: 'Manual v2 p.15 - VCF MOD',
    },
    {
      kind: 'predict', control: 'vcf_mod_polarity', targetValue: 1, concept: 'modulation-source',
      instruction: 'Flip VCF MOD POLARITY down to −.',
      predict: {
        question: 'The envelope now pushes the cutoff down instead of up. How will each note change?',
        options: ['It starts dark and opens as the note fades', 'It gets brighter at the start', 'Nothing - polarity only affects the LFO'], answer: 0,
        explain: 'With − the envelope subtracts from CUTOFF: darkest at the peak, back to the knob\'s brightness as it falls. That backwards sweep sounds like a "bwow" or a reversed note.',
      },
      principle: 'Inverting a modulation flips its shape: up-sweeps become down-sweeps.',
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target filter envelope.', concept: 'modulation-depth',
      setup: { vcf_mod_amount: 20, vcf_mod_polarity: 1 },
      match: { target: { vcf_mod_source: 0, vcf_mod_amount: 70, vcf_mod_polarity: 0 }, controls: ['vcf_mod_amount', 'vcf_mod_polarity'] },
      hints: ['Does the target open or close at the start of each note?', 'It opens a lot at the start.', 'POLARITY +, VCF MOD AMOUNT about 70 %.'],
    },
    {
      kind: 'challenge', concept: 'lfo',
      instruction: 'Make a slow filter wobble: the LFO moves the cutoff up and down about twice a second.',
      checklist: [
        { text: 'VCF MOD SOURCE on LFO', check: s => num(s, 'vcf_mod_source') === 1 },
        { text: 'VCF MOD AMOUNT at least 30 %', check: s => num(s, 'vcf_mod_amount') >= 30 },
        { text: 'LFO RATE between 1 and 4 Hz', check: s => num(s, 'lfo_rate') >= 1 && num(s, 'lfo_rate') <= 4 },
      ],
      hints: ['Which switch picks what moves the filter?', 'Then set the depth and the speed.', 'VCF MOD SOURCE down to LFO, AMOUNT about 45 %, LFO RATE about 2 Hz.'],
      solution: { values: { vcf_mod_source: 1, vcf_mod_amount: 45, lfo_rate: 2 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do SOURCE, AMOUNT and DEST (or POLARITY) share the job of a modulation?',
        model: 'SOURCE picks what moves (the EG or the LFO), AMOUNT how far it moves, and DEST - or for the filter POLARITY - what it moves and in which direction.',
      },
    },
  ],
  review: [
    { question: 'A little LFO on pitch is heard as…', options: ['Vibrato', 'Tremolo', 'Distortion'], answer: 0, explain: 'A pitch wobble.' },
    { question: 'Pulse-width modulation sounds…', options: ['Wide and chorus-like', 'Lower', 'Shorter'], answer: 0, explain: 'The harmonics keep shifting.' },
    { question: 'VCF MOD POLARITY − makes the envelope…', options: ['Close the filter instead of opening it', 'Faster', 'Louder'], answer: 0, explain: 'It inverts the sweep.' },
  ],
};

const f6: Lesson = {
  id: 'mother32-f6-sequencer', device: 'mother32', path: 'foundations', order: O(6), difficulty: 'beginner',
  name: 'The sequencer: record, play and transpose',
  description: 'Record a pattern in KB mode, hear it loop and transpose it from the keyboard.',
  objective: 'Record a pattern in KB mode, play it, and transpose it from the keyboard.',
  source: 'Synth Studio · Mother-32 manual v2 pp.19-26 (Creating a pattern in KB mode)', estimatedMinutes: 8,
  prerequisites: ['mother32-f4-eg-vca'],
  concepts: ['sequencer-pattern', 'timing-tempo'],
  start: { reset: true, values: { cutoff: 600, resonance: 35, vcf_mod_amount: 45, decay: 250, sustain: 1 } },
  steps: [
    run(),
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'The studio runs at 120 BPM and each step is a 16th note. How many steps play every second?',
        options: ['8', '2', '16'], answer: 0,
        explain: '120 beats a minute is 2 beats a second, and a beat holds four 16ths. In the studio the TEMPO knob picks this step length (the readout shows 1/16), just like a Mother-32 under MIDI clock.',
      },
    },
    {
      kind: 'do', control: 'run_stop', targetValue: false, concept: 'sequencer-pattern',
      instruction: 'Press RUN / STOP again to stop.',
      principle: 'Recording on the Mother-32 happens with the sequencer stopped, one step at a time.',
    },
    {
      kind: 'do', control: 'rec', targetValue: true, concept: 'sequencer-pattern',
      instruction: 'Start recording: tap (SHIFT), then RUN / STOP. The RUN / STOP light blinks.',
      principle: 'Step recording stores one note per key press, in order, so you never have to play in time.',
      explanation: 'The old pattern is cleared and the record position starts at step 1. The readout under the keys counts the steps.',
      manualReference: 'Manual v2 p.19 - Creating a pattern in KB mode',
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Play four keys - C, E♭, G and the high C - then add a rest with HOLD / REST.',
      checklist: [
        { text: 'At least 5 steps recorded', check: s => recorded(s) >= 5 },
        { text: 'At least three different notes', check: s => new Set(Array.from({ length: recorded(s) }, (_, i) => step(s, i)).filter(x => !x.rest).map(x => x.note)).size >= 3 },
        { text: 'A rest in the pattern', check: s => Array.from({ length: recorded(s) }, (_, i) => step(s, i)).some(x => x.rest) },
      ],
      hints: ['Each key press is one step.', 'The black keys are on the upper row.', 'Press the C, E♭, G and high C pads, then HOLD / REST.'],
      solution: { values: { ...patternOf({ ...seq([C3, Eb3, G3, C4, null]) }), seq_notes: seq([C3, Eb3, G3, C4, null]).seq_notes.toString().slice(0, 5).padEnd(32, '.') } },
    },
    {
      kind: 'do', control: 'rec', targetValue: false, concept: 'sequencer-pattern',
      instruction: 'Press RUN / STOP to finish recording.',
      principle: 'The pattern is as long as the number of steps you recorded.',
    },
    {
      kind: 'predict', control: 'run_stop', targetValue: true, concept: 'sequencer-pattern',
      instruction: 'Press RUN / STOP to hear your pattern loop.',
      predict: {
        question: 'You recorded five steps: four notes and a rest. How long will the loop be?',
        options: ['Five steps - as many as I recorded', 'Always 32 steps', 'Four steps - the rest does not count'], answer: 0,
        explain: 'Recording sets the pattern length to the number of steps you entered, and a rest is a step too. SET END in STEP mode changes the length later.',
      },
      principle: 'A loop turns a short phrase into a groove: the same notes, again and again, in time.',
    },
    {
      kind: 'info', concept: 'sequencer-pattern', focus: ['run_stop'],
      instruction: 'While it plays, press the E♭ key: the whole pattern now starts on E♭. The lowest C takes it home.',
      principle: 'Transposing moves every note by the same interval, so the melody keeps its shape.',
      explanation: 'In KB mode the keys transpose the running pattern. The readout shows TRANSPOSE +3: three semitones up.',
      manualReference: 'Manual v2 p.34 - KB mode panel functions',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: {
        question: 'While the sequencer runs in KB mode, pressing a key…',
        options: ['Transposes the pattern', 'Records a new note', 'Stops the sequencer'], answer: 0,
        explain: 'Recording only happens in REC (SHIFT + RUN / STOP). While playing, a key moves the whole pattern to start on that note.',
      },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do you record a pattern on the Mother-32, and how long will it be?',
        model: 'SHIFT + RUN / STOP starts recording; each key press stores one note (HOLD / REST a rest) and RUN / STOP ends it. The pattern has as many steps as I recorded.',
      },
    },
  ],
  review: [
    { question: 'SHIFT + RUN / STOP on the Mother-32 starts…', options: ['Recording (REC)', 'Swing', 'Pattern save'], answer: 0, explain: 'REC is RUN / STOP\'s second function.' },
    { question: 'While recording, HOLD / REST…', options: ['Stores a rest', 'Repeats a step', 'Stops recording'], answer: 0, explain: 'It is the REST half of HOLD / REST.' },
    { question: 'At 120 BPM with 16th-note steps, a step lasts…', options: ['0.125 s', '0.5 s', '1 s'], answer: 0, explain: 'A beat is 0.5 s; a 16th is a quarter of it.' },
  ],
};

const f7: Lesson = {
  id: 'mother32-f7-patching', device: 'mother32', path: 'foundations', order: O(7), difficulty: 'intermediate',
  name: 'Patching: normals and your first cables',
  description: 'The hidden connections, what a cable replaces and what it adds, and VC MIX as a 0-5 V knob.',
  objective: 'Explain the Mother-32\'s normals and add modulation with your first cables.',
  source: 'Synth Studio · Mother-32 manual v2 pp.46-56 (Patchbay)', estimatedMinutes: 8,
  prerequisites: ['mother32-f5-modulation'],
  concepts: ['signal-routing', 'modulation-source', 'lfo'],
  start: { reset: true, values: { cutoff: 500, resonance: 45, vcf_mod_amount: 20, decay: 700, sustain: 0, lfo_rate: 2, ...BASS } },
  steps: [
    run('A semi-modular synth plays with no cables because its main path is wired inside.'),
    {
      kind: 'info', concept: 'signal-routing', focus: ['in_ext_audio', 'in_vco_mod', 'in_mix1', 'in_mix2'],
      instruction: 'Inside, NOISE feeds EXT. AUDIO, the EG feeds VCO MOD, and MIX 1 and MIX 2 sit at 0 V and +5 V. These are normals.',
      principle: 'A normal is a default internal connection; a cable in that jack replaces it.',
      explanation: 'Every other input simply adds its voltage to the knob next to it. Inputs print plain; outputs print reversed, in a white box.',
      manualReference: 'Manual v2 p.46 - Patchbay',
    },
    {
      kind: 'predict', patchFrom: 'out_lfo_tri', patchTo: 'in_vcf_cutoff', concept: 'signal-routing',
      instruction: 'Patch LFO TRI into VCF CUTOFF.',
      predict: {
        question: 'VCF CUTOFF adds the cable\'s voltage to the CUTOFF knob. What will the LFO do?',
        options: ['Sweep the filter up and down', 'Change the pitch', 'Nothing until VCF MOD AMOUNT is turned up'], answer: 0,
        explain: 'The jack sums straight into the cutoff at 1 V per octave, so the LFO\'s +/-5 V swings it several octaves. VCF MOD AMOUNT is a separate path inside, not needed for the jack.',
      },
      principle: 'A voltage patched into a control input moves that control, just like turning the knob.',
      manualReference: 'Manual v2 p.48 - VCF CUTOFF',
    },
    {
      kind: 'do', control: 'lfo_rate', targetValue: 0.5, concept: 'lfo',
      instruction: 'Slow LFO RATE down to about 0.5 Hz for a long, slow sweep.',
      principle: 'Slow modulation reads as movement; fast modulation reads as wobble or roughness.',
    },
    {
      kind: 'predict', patchFrom: 'out_lfo_sq', patchTo: 'in_vco_mod', concept: 'signal-routing',
      setup: { vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 30, lfo_rate: 4 },
      instruction: 'VCO MOD is on EG and FREQ with some AMOUNT. Patch LFO SQ into VCO MOD.',
      predict: {
        question: 'A cable in VCO MOD replaces the normalled EG. What will the square LFO do to the pitch?',
        options: ['Jump it between two notes - a trill', 'Add a pitch sweep to every note', 'Nothing - VCO MOD is only for the EG'], answer: 0,
        explain: 'Before the cable the EG swept the pitch on every note. Now the square wave replaces it at the EG position, so the pitch flips between two notes four times a second.',
      },
      principle: 'Plugging into a normalled input disconnects the internal signal it was receiving.',
      manualReference: 'Manual v2 p.49 - VCO MOD',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Which of these Mother-32 inputs is normalled - a cable replaces something?',
        options: ['VCO MOD (the EG)', 'VCF CUTOFF', 'LFO RATE'], answer: 0,
        explain: 'VCO MOD, EXT. AUDIO, MIX 1 and MIX 2 have normals. VCF CUTOFF and LFO RATE have none: a cable there adds to the knob.',
      },
    },
    {
      kind: 'challenge', concept: 'signal-routing',
      instruction: 'Use VC MIX as a 0-5 V knob: patch VC MIX into LFO RATE and turn VC MIX up to speed the LFO.',
      checklist: [
        { text: 'VC MIX patched into LFO RATE', check: s => cable(s, 'out_vc_mix', 'in_lfo_rate') },
        { text: 'VC MIX at 60 % or more', check: s => num(s, 'vc_mix') >= 60 },
      ],
      hints: ['With nothing in MIX 1 and MIX 2, VC MIX crossfades 0 V and +5 V.', 'More voltage into LFO RATE means a faster LFO.', 'Patch VC MIX into LFO RATE, then turn VC MIX to about 70 %.'],
      solution: { values: { vc_mix: 70 }, patches: [{ from: 'out_vc_mix', to: 'in_lfo_rate' }] },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between patching into VCO MOD and patching into VCF CUTOFF?',
        model: 'VCO MOD is normalled: the cable replaces the EG there. VCF CUTOFF has no normal: the cable\'s voltage adds to the CUTOFF knob.',
      },
    },
  ],
  review: [
    { question: 'A cable in a normalled input…', options: ['Replaces the internal signal', 'Adds to it', 'Is ignored'], answer: 0, explain: 'That is what a normal is.' },
    { question: 'With nothing patched into MIX 1 or MIX 2, VC MIX outputs…', options: ['0 to +5 V set by the knob', 'Noise', 'The LFO'], answer: 0, explain: 'MIX 1 is 0 V and MIX 2 is +5 V.' },
    { question: 'Patch-bay outputs on the Mother-32 are printed…', options: ['Reversed, in a box', 'In red', 'Inside a circle'], answer: 0, explain: 'Circles mark gate inputs.' },
  ],
};

// ============================================================================
// SOUND DESIGN
// ============================================================================

const ACID = seq([
  { note: C2, accent: true }, C2, { note: C3, gate: 8 }, { note: C3, glide: true }, Eb2, { note: C2, accent: true }, { note: Eb3, gate: 2 }, C2,
  { note: G2, accent: true, gate: 8 }, { note: Bb2, glide: true }, C2, { note: C3, accent: true }, null, { note: F2, gate: 2 }, { note: G2, gate: 8 }, { note: C2, glide: true },
]);

const sd1: Lesson = {
  id: 'mother32-sd1-acid', device: 'mother32', path: 'sound-design', order: O(8), difficulty: 'intermediate',
  name: 'Acid bass: resonance, accent and slide',
  description: 'The squelch of acid house from three things: a resonant low-pass, a fast filter envelope, and accents and slides in the pattern.',
  objective: 'Build a squelchy acid bass from RESONANCE, the filter envelope, accents and slides.',
  source: 'Synth Studio · the acid-house tradition, on the Mother-32\'s per-step accent and glide', estimatedMinutes: 8,
  prerequisites: ['mother32-f5-modulation'],
  concepts: ['filter-resonance', 'modulation-depth', 'glide', 'velocity-dynamics'],
  start: { reset: true, values: { vco_wave: 1, cutoff: 500, resonance: 20, vcf_mod_amount: 25, decay: 450, sustain: 1, glide: 0, ...ACID } },
  steps: [
    {
      kind: 'listen', concept: 'filter-resonance', focus: ['resonance', 'cutoff', 'vcf_mod_amount', 'decay'],
      instruction: 'Here is where you are going. Compare the plain bass with the finished acid line.',
      listen: { a: {}, b: { cutoff: 220, resonance: 74, vcf_mod_amount: 62, decay: 190, glide: 70 }, labels: ['Now', 'Goal'] },
    },
    run(),
    {
      kind: 'predict', control: 'resonance', targetValue: 74, concept: 'filter-resonance',
      instruction: 'Turn RESONANCE up to about 75 %.',
      predict: {
        question: 'What gives an acid line its squelch?',
        options: ['A ringing resonant peak that the envelope sweeps', 'A louder oscillator', 'A slow attack'], answer: 0,
        explain: 'The resonant peak "speaks" as the envelope sweeps it through the harmonics, like a vowel. Volume and attack do not add that rubbery bite.',
      },
      principle: 'A resonant peak swept quickly through the harmonics sounds like a vowel: the squelch.',
    },
    {
      kind: 'do', control: 'cutoff', targetValue: 220, concept: 'filter-cutoff',
      instruction: 'Turn CUTOFF down to about 220 Hz, so the filter starts nearly closed.',
      principle: 'A low starting cutoff gives the envelope room to sweep a long way.',
    },
    {
      kind: 'do', control: 'vcf_mod_amount', targetValue: 62, concept: 'modulation-depth',
      instruction: 'Turn VCF MOD AMOUNT up to about 60 %: each note opens and snaps shut.',
      principle: 'The more the envelope moves the cutoff, the bigger the "wow" on every note.',
    },
    {
      kind: 'do', control: 'decay', targetValue: 190, concept: 'envelope-decay',
      instruction: 'Set DECAY to about 190 ms.',
      principle: 'A short decay makes the sweep fast: a snap rather than a slow "wah".',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'velocity-dynamics',
      quiz: {
        question: 'Accented steps on the Mother-32…',
        options: ['Open the filter and the VCA a bit more', 'Play an octave higher', 'Are silent'], answer: 0,
        explain: 'Accent pushes the cutoff up and the VCA a little louder on that step, so accented notes squelch harder. The pitch is unchanged.',
      },
    },
    {
      kind: 'do', control: 'glide', targetValue: 70, concept: 'glide',
      instruction: 'Set GLIDE to about 70 ms: the steps marked for glide now slide into their notes.',
      principle: 'Glide on chosen steps bends one note into the next - the classic acid slide.',
      explanation: 'On the Mother-32 glide is switched on per step; GLIDE sets how long the slide takes. Steps without glide still jump.',
      manualReference: 'Manual v2 p.26 - Glide',
    },
    {
      kind: 'match', instruction: 'Ear challenge: match the target\'s squelch.', concept: 'filter-resonance',
      setup: { resonance: 30, vcf_mod_amount: 25 },
      match: { target: { cutoff: 220, decay: 190, glide: 70, resonance: 74, vcf_mod_amount: 62 }, controls: ['resonance', 'vcf_mod_amount'] },
      hints: ['How much does it ring? How far does each note open?', 'It rings a lot and opens wide.', 'RESONANCE about 75 %, VCF MOD AMOUNT about 60 %.'],
    },
    {
      kind: 'challenge', concept: 'filter-resonance',
      instruction: 'Make it meaner: the resonance right on the edge of whistling, and very short notes.',
      checklist: [
        { text: 'RESONANCE 70 % or more', check: s => num(s, 'resonance') >= 70 },
        { text: 'DECAY 200 ms or less', check: s => num(s, 'decay') <= 200 },
        { text: 'SUSTAIN OFF', check: s => num(s, 'sustain') === 1 },
      ],
      hints: ['Which knob rings? Which one shortens the notes?', 'Past 3 o\'clock the filter starts to whistle.', 'RESONANCE about 78 %, DECAY about 150 ms, SUSTAIN OFF.'],
      solution: { values: { resonance: 78, decay: 150, sustain: 1 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Which three things make this an acid line rather than a plain bass?',
        model: 'A high resonance, a fast filter envelope that sweeps it on every note, and accents and slides in the pattern.',
      },
    },
  ],
  review: [
    { question: 'Acid squelch comes mainly from…', options: ['Resonance swept by a fast filter envelope', 'A slow LFO', 'Noise'], answer: 0, explain: 'The peak sweeps through the harmonics.' },
    { question: 'On the Mother-32, glide is set…', options: ['Per step; GLIDE sets the time', 'Only for the whole pattern', 'With RESONANCE'], answer: 0, explain: 'A step glides only if glide is on for it.' },
    { question: 'An accent on the Mother-32 opens…', options: ['The VCF and the VCA', 'Only the VCA', 'Neither'], answer: 0, explain: 'Brighter and louder.' },
  ],
};

const KIT = seq([24, null, null, 24, 84, null, null, 24, null, 24, null, null, 84, null, 24, 84]);

const sd2: Lesson = {
  id: 'mother32-sd2-kick-snare', device: 'mother32', path: 'sound-design', order: O(9), difficulty: 'intermediate',
  name: 'Kick and snare from one voice',
  description: 'The manual\'s SIMPLEST KICK & SNARE: one keyboard voltage chooses between a kick and a snare.',
  objective: 'Turn one voice into a kick and a snare: low notes are pitch-swept tone, high notes are bright noise.',
  source: 'Synth Studio · Mother-32 manual Presets: SIMPLEST KICK & SNARE', estimatedMinutes: 8,
  prerequisites: ['mother32-f7-patching'],
  concepts: ['modulation-depth', 'noise', 'signal-routing', 'mixing'],
  start: { reset: true, values: { vco_wave: 1, mix: 35, cutoff: 900, resonance: 20, vcf_mod_amount: 45, attack: 1.25, decay: 230, sustain: 1, vco_mod_source: 0, vco_mod_dest: 1, vco_mod_amount: 0, ...KIT } },
  steps: [
    run('A drum is a short sound with a fast pitch drop or a burst of noise.'),
    {
      kind: 'predict', control: 'vco_mod_amount', targetValue: 42, concept: 'modulation-depth',
      instruction: 'Turn VCO MOD AMOUNT up to about 40 % (source EG, dest FREQ).',
      predict: {
        question: 'The EG now pushes the pitch up at the start of each note and lets it fall. What does that sound like on the low notes?',
        options: ['A drum thump', 'A slow siren', 'Nothing - the EG only controls volume'], answer: 0,
        explain: 'A fast fall from high to low pitch is what the ear reads as something being struck. The same kind of envelope that shapes loudness can shape anything.',
      },
      principle: 'A kick is a low tone with a very fast downward pitch sweep.',
    },
    {
      kind: 'patch', patchFrom: 'out_kb', patchTo: 'in_mult', concept: 'signal-routing',
      instruction: 'Patch KB into MULT.',
      principle: 'A mult copies one voltage to two outputs, so it can drive two things at once.',
      manualReference: 'Manual v2 p.51 - MULT',
    },
    {
      kind: 'predict', patchFrom: 'out_mult1', patchTo: 'in_mix_cv', concept: 'mixing',
      instruction: 'Patch MULT 1 into MIX CV.',
      predict: {
        question: 'Low notes send a negative KB voltage, high notes a positive one, and MIX CV adds it to MIX. What do the high notes become?',
        options: ['Mostly noise - a snare', 'Mostly VCO - a tom', 'Silent'], answer: 0,
        explain: 'Positive voltage pushes MIX toward the noise end, negative toward the VCO. The kick notes sit at the bottom of the keyboard, the snare notes near the top.',
      },
      principle: 'A voltage that rises with pitch can steer any control - here, the mixer.',
    },
    {
      kind: 'patch', patchFrom: 'out_mult2', patchTo: 'in_vcf_cutoff', concept: 'filter-cutoff',
      instruction: 'Patch MULT 2 into VCF CUTOFF.',
      principle: 'The same voltage into the cutoff makes the high notes bright and the low notes dark.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Why does one keyboard voltage make both a kick and a snare?',
        options: ['It moves MIX and CUTOFF together', 'It changes the envelope', 'It switches between two oscillators'], answer: 0,
        explain: 'Low notes: VCO side, dark filter - a kick. High notes: noise side, open filter - a snare. The envelope and oscillator are the same for both.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: how long do the drums ring in the target?', concept: 'envelope-decay',
      setup: { decay: 600 },
      match: { target: { decay: 150 }, controls: ['decay'], patches: [{ from: 'out_kb', to: 'in_mult' }, { from: 'out_mult1', to: 'in_mix_cv' }, { from: 'out_mult2', to: 'in_vcf_cutoff' }] },
      hints: ['Listen to the tail of each hit.', 'The target is tight and short.', 'DECAY about 150 ms.'],
    },
    {
      kind: 'challenge', concept: 'modulation-depth',
      instruction: 'Tune the kit: a punchy kick with a big pitch drop, and hits short enough to leave space.',
      checklist: [
        { text: 'VCO MOD AMOUNT 35 % or more', check: s => num(s, 'vco_mod_amount') >= 35 },
        { text: 'DECAY 300 ms or less', check: s => num(s, 'decay') <= 300 },
        { text: 'KB -> MULT -> MIX CV and VCF CUTOFF', check: s => cable(s, 'out_kb', 'in_mult') && cable(s, 'out_mult1', 'in_mix_cv') && cable(s, 'out_mult2', 'in_vcf_cutoff') },
      ],
      hints: ['Punch is a big, fast pitch drop.', 'Shorter hits leave space between them.', 'VCO MOD AMOUNT about 45 %, DECAY about 200 ms.'],
      solution: { values: { vco_mod_amount: 45, decay: 200 }, patches: [{ from: 'out_kb', to: 'in_mult' }, { from: 'out_mult1', to: 'in_mix_cv' }, { from: 'out_mult2', to: 'in_vcf_cutoff' }] },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How does this patch decide whether a step is a kick or a snare?',
        model: 'The step\'s keyboard voltage, split by the MULT, moves MIX toward noise and opens the filter on high notes (snare) and does the opposite on low notes (kick).',
      },
    },
  ],
  review: [
    { question: 'A kick\'s punch comes from…', options: ['A fast downward pitch sweep', 'Noise', 'A long attack'], answer: 0, explain: 'The EG on pitch.' },
    { question: 'A MULT…', options: ['Copies one signal to two outputs', 'Mixes two signals', 'Inverts a signal'], answer: 0, explain: 'The manual says: only as a CV splitter.' },
    { question: 'In this patch the snare is mostly…', options: ['Noise through an open filter', 'A low VCO', 'The LFO'], answer: 0, explain: 'High notes push MIX to noise.' },
  ],
};

const BELL = seq([{ note: C4, gate: 2 }, null, { note: 67, gate: 2 }, null, { note: 63, gate: 2 }, null, { note: 72, gate: 2 }, null]);

const sd3: Lesson = {
  id: 'mother32-sd3-fm-bell', device: 'mother32', path: 'sound-design', order: O(10), difficulty: 'advanced',
  name: 'An FM bell: VC MIX as a VCA',
  description: 'Audio-rate FM from the LFO, with the envelope - through VC MIX - controlling how much.',
  objective: 'Make a bell: the LFO at audio rate modulates the VCO, and the envelope controls the depth through VC MIX.',
  source: 'Synth Studio · Mother-32 manual v2 pp.13, 49-51 (audio-rate LFO, LIN FM, VC MIX)', estimatedMinutes: 9,
  prerequisites: ['mother32-f7-patching'],
  concepts: ['frequency-modulation', 'signal-routing', 'envelope-decay'],
  start: { reset: true, values: { vco_wave: 1, frequency: -0.1, mix: 0, cutoff: 6000, resonance: 0, vcf_mod_amount: 20, attack: 1.25, decay: 1500, sustain: 1, lfo_rate: 344, lfo_wave: 1, vc_mix: 0, ...BELL } },
  steps: [
    run('Frequency modulation at audio rate adds new partials, which is how bells and metal are made.'),
    {
      kind: 'patch', patchFrom: 'out_lfo_tri', patchTo: 'in_mix2', concept: 'signal-routing',
      instruction: 'Patch LFO TRI into MIX 2. The LFO is already at audio rate, 344 Hz.',
      principle: 'A crossfader with one input patched is an attenuator: VC MIX now scales the LFO.',
      explanation: 'MIX 1 stays at its 0 V normal, so VC MIX outputs LFO x the knob position.',
      manualReference: 'Manual v2 p.50 - MIX 1 / MIX 2',
    },
    {
      kind: 'patch', patchFrom: 'out_vc_mix', patchTo: 'in_vco_lin_fm', concept: 'frequency-modulation',
      instruction: 'Patch VC MIX into VCO LIN FM.',
      principle: 'Linear FM adds a signal straight to the oscillator\'s frequency.',
    },
    {
      kind: 'predict', control: 'vc_mix', targetValue: 60, concept: 'frequency-modulation',
      instruction: 'Turn VC MIX up to about 60 %.',
      predict: {
        question: 'VC MIX now sends the 344 Hz LFO into linear FM. What will you hear?',
        options: ['Clangy, metallic overtones', 'A slow vibrato', 'Silence'], answer: 0,
        explain: 'When the frequency wobbles hundreds of times a second you no longer hear a wobble. You hear sidebands: new partials above and below the note, rarely in tune with it, so it sounds like metal.',
      },
      principle: 'Audio-rate FM creates sidebands - new partials that make a tone metallic or bell-like.',
    },
    {
      kind: 'do', control: 'vc_mix', targetValue: 0, concept: 'frequency-modulation',
      instruction: 'Turn VC MIX back down to 0.',
      principle: 'Set the static depth to zero before handing the job to an envelope.',
    },
    {
      kind: 'predict', patchFrom: 'out_eg', patchTo: 'in_vc_mix_ctrl', concept: 'envelope-decay',
      instruction: 'Patch EG into VC MIX CTRL.',
      predict: {
        question: 'The envelope now turns VC MIX up on every note and lets it fall. What happens to the clang?',
        options: ['It rings at the start and fades to a pure tone - a bell', 'It gets louder all the time', 'Nothing changes'], answer: 0,
        explain: 'Real bells are richest at the strike and mellow as they ring. The envelope does that to the FM depth: lots of sidebands at the start, fewer and fewer as it decays.',
      },
      principle: 'A decaying FM depth makes the brightness fall over time, the signature of a struck bell.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'In this patch VC MIX acts as a…',
        options: ['VCA: the EG sets how much LFO passes', 'Filter', 'Second envelope'], answer: 0,
        explain: 'VC MIX crossfades 0 V (MIX 1) against the LFO (MIX 2), and the EG on VC MIX CTRL moves the crossfade. That is a voltage-controlled amplifier for the modulator.',
      },
    },
    {
      kind: 'patch', patchFrom: 'out_kb', patchTo: 'in_lfo_rate', concept: 'frequency-modulation',
      instruction: 'Patch KB into LFO RATE, so the LFO follows the notes.',
      principle: 'When the modulator tracks the carrier, the FM ratio - and the bell\'s colour - stays the same on every note.',
      explanation: 'LFO RATE responds at about 1 V per octave, like the VCO, so both move together.',
      manualReference: 'Manual v2 p.13 - TIP: KB into LFO RATE',
    },
    {
      kind: 'challenge', concept: 'frequency-modulation',
      instruction: 'Change the bell\'s metal: pick a different LFO RATE and keep a long ring.',
      checklist: [
        { text: 'LFO RATE between 100 and 330 Hz', check: s => num(s, 'lfo_rate') >= 100 && num(s, 'lfo_rate') <= 330 },
        { text: 'DECAY 800 ms or longer', check: s => num(s, 'decay') >= 800 },
        { text: 'EG -> VC MIX CTRL and VC MIX -> LIN FM', check: s => cable(s, 'out_eg', 'in_vc_mix_ctrl') && cable(s, 'out_vc_mix', 'in_vco_lin_fm') },
      ],
      hints: ['The ratio of the two frequencies decides the colour.', 'Simple ratios ring like chimes; odd ones clang.', 'Try LFO RATE about 200 Hz.'],
      solution: { values: { lfo_rate: 200, decay: 1500 }, patches: [{ from: 'out_lfo_tri', to: 'in_mix2' }, { from: 'out_vc_mix', to: 'in_vco_lin_fm' }, { from: 'out_eg', to: 'in_vc_mix_ctrl' }] },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What makes this sound like a bell rather than a steady metallic tone?',
        model: 'The envelope controls the FM depth through VC MIX, so the sound starts rich in clangy partials and fades to a purer tone, like a struck bell.',
      },
    },
  ],
  review: [
    { question: 'Audio-rate FM adds…', options: ['Sidebands - new partials', 'A slower tempo', 'Noise'], answer: 0, explain: 'Frequencies above and below the carrier.' },
    { question: 'VC MIX with one input patched works as…', options: ['An attenuator / VCA', 'A filter', 'An oscillator'], answer: 0, explain: 'It scales the signal.' },
    { question: 'Patching KB into LFO RATE in an FM patch keeps…', options: ['The same FM colour on every note', 'The LFO at one speed', 'The pitch fixed'], answer: 0, explain: 'The ratio stays constant.' },
  ],
};

// ============================================================================
// EAR TRAINING (graded, interleaved)
// ============================================================================

const EAR = { vco_wave: 1, resonance: 15, vcf_mod_amount: 20, decay: 400, sustain: 0, ...BASS };

const e1: Lesson = {
  id: 'mother32-e1-bright-dark', device: 'mother32', path: 'ear-training', order: O(11), difficulty: 'beginner',
  name: 'Ear training 1: bright or dark?',
  description: 'One control, big differences: find the cutoff by ear.',
  objective: 'Judge brightness by ear and set CUTOFF to match a target.',
  source: 'Synth Studio · ear training', estimatedMinutes: 5,
  prerequisites: ['mother32-f3-filter'],
  concepts: ['filter-cutoff'],
  start: { reset: true, values: { ...EAR } },
  steps: [
    {
      kind: 'listen', concept: 'filter-cutoff', focus: ['cutoff'],
      instruction: 'Warm up: compare a dark and a bright filter. Listen to the top of the sound.',
      listen: { a: { cutoff: 250 }, b: { cutoff: 4000 }, labels: ['250 Hz', '4 kHz'] },
    },
    {
      kind: 'match', instruction: 'Round 1: set CUTOFF to match the target.', concept: 'filter-cutoff',
      setup: { cutoff: 4000 },
      match: { target: { cutoff: 300 }, controls: ['cutoff'], tolerance: 0.1 },
      hints: ['Darker or brighter than yours?', 'Much darker: a muffled bass.', 'CUTOFF around 300 Hz.'],
    },
    {
      kind: 'match', instruction: 'Round 2: set CUTOFF again.', concept: 'filter-cutoff',
      setup: { cutoff: 300 },
      match: { target: { cutoff: 3000 }, controls: ['cutoff'], tolerance: 0.1 },
      hints: ['Brighter than yours.', 'Quite open: you hear the saw\'s buzz.', 'Around 3 kHz.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-cutoff',
      quiz: {
        question: 'Why does the CUTOFF knob feel even, though it spans 20 Hz to 20 kHz?',
        options: ['It is logarithmic: each bit of travel multiplies the frequency', 'It only uses the middle', 'The filter ignores high frequencies'], answer: 0,
        explain: 'Hearing works in ratios. The knob gives every octave the same amount of travel, which is why the printed scale reads 20 Hz, 200 Hz, 2 kHz, 20 kHz at even steps.',
      },
    },
    {
      kind: 'match', instruction: 'Round 3: somewhere in the middle.', concept: 'filter-cutoff',
      setup: { cutoff: 5000 },
      match: { target: { cutoff: 800 }, controls: ['cutoff'], tolerance: 0.1 },
      hints: ['Darker than yours, but not muffled.', 'Below 1 kHz.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What did you listen for to judge the cutoff?',
        model: 'How much buzz and top end there is: a low cutoff sounds muffled and round, a high one bright and buzzy, while the pitch stays the same.',
      },
    },
  ],
  review: [
    { question: 'Raising CUTOFF changes…', options: ['Brightness', 'Pitch', 'Length'], answer: 0, explain: 'More harmonics pass.' },
    { question: 'The CUTOFF knob is logarithmic because…', options: ['We hear frequency in ratios', 'It saves power', 'Filters need it'], answer: 0, explain: 'Each octave gets equal travel.' },
    { question: 'A muffled bass has a cutoff around…', options: ['A few hundred Hz', '10 kHz', '20 kHz'], answer: 0, explain: 'Most harmonics are removed.' },
  ],
};

const e2: Lesson = {
  id: 'mother32-e2-length', device: 'mother32', path: 'ear-training', order: O(12), difficulty: 'intermediate',
  name: 'Ear training 2: how long, finer',
  description: 'One control, smaller differences: find DECAY by ear.',
  objective: 'Set DECAY to within a small margin of a target by ear.',
  source: 'Synth Studio · ear training', estimatedMinutes: 6,
  prerequisites: ['mother32-e1-bright-dark', 'mother32-f4-eg-vca'],
  concepts: ['envelope-decay'],
  start: { reset: true, values: { ...EAR, sustain: 1, cutoff: 1500, ...seq([C3, null, null, null, G2, null, null, null]) } },
  steps: [
    {
      kind: 'listen', concept: 'envelope-decay', focus: ['decay'],
      instruction: 'Warm up: compare a short and a long DECAY. Listen to the tail, not the start.',
      listen: { a: { decay: 100 }, b: { decay: 1200 }, labels: ['Short', 'Long'] },
    },
    {
      kind: 'match', instruction: 'Round 1: set DECAY to match the target.', concept: 'envelope-decay',
      setup: { decay: 1500 },
      match: { target: { decay: 150 }, controls: ['decay'] },
      hints: ['Is there much tail at all?', 'It is a short pluck.', 'DECAY around 150 ms.'],
    },
    {
      kind: 'match', instruction: 'Round 2: a little closer this time.', concept: 'envelope-decay',
      setup: { decay: 150 },
      match: { target: { decay: 900 }, controls: ['decay'] },
      hints: ['Longer than yours.', 'Nearly a second.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: {
        question: 'Matching length by ear, what is the most reliable thing to listen to?',
        options: ['When the tail disappears', 'How loud the attack is', 'The pitch'], answer: 0,
        explain: 'Every note starts the same way, so compare when the sound fades into silence. Listening at a steady volume helps.',
      },
    },
    {
      kind: 'match', instruction: 'Round 3: the finest one.', concept: 'envelope-decay',
      setup: { decay: 900 },
      match: { target: { decay: 400 }, controls: ['decay'], tolerance: 0.07 },
      hints: ['Shorter than yours, but not a pluck.', 'Under half a second.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What helped you find the decay more precisely?',
        model: 'Comparing the target and mine back to back and listening to where each tail fades into silence.',
      },
    },
  ],
  review: [
    { question: 'To compare two decays, listen to…', options: ['When each tail fades out', 'The attack', 'The tempo'], answer: 0, explain: 'The attacks are the same.' },
    { question: 'With SUSTAIN OFF, DECAY sets…', options: ['How long each note rings', 'When notes start', 'The pitch'], answer: 0, explain: 'It is the fall after the attack.' },
    { question: 'A pluck has a DECAY of roughly…', options: ['100-200 ms', '2 s', '7 s'], answer: 0, explain: 'Short.' },
  ],
};

const e3: Lesson = {
  id: 'mother32-e3-pluck', device: 'mother32', path: 'ear-training', order: O(13), difficulty: 'intermediate',
  name: 'Ear training 3: two controls - ring and sweep',
  description: 'RESONANCE and VCF MOD AMOUNT together: how much it rings, and how far each note opens.',
  objective: 'Recreate a filter sound by ear with RESONANCE and VCF MOD AMOUNT together.',
  source: 'Synth Studio · ear training', estimatedMinutes: 7,
  prerequisites: ['mother32-e1-bright-dark', 'mother32-f5-modulation'],
  concepts: ['filter-resonance', 'modulation-depth'],
  start: { reset: true, values: { ...EAR, cutoff: 300, decay: 250, sustain: 1 } },
  steps: [
    {
      kind: 'listen', concept: 'filter-resonance', focus: ['resonance', 'vcf_mod_amount'],
      instruction: 'Two dimensions: compare a gentle, closed sound with a ringing, wide-open one.',
      listen: {
        a: { resonance: 10, vcf_mod_amount: 15 }, b: { resonance: 70, vcf_mod_amount: 65 }, labels: ['Gentle', 'Ringing sweep'],
        question: {
          question: 'Which knob makes B "ring" at one pitch?',
          options: ['RESONANCE', 'VCF MOD AMOUNT', 'DECAY'], answer: 0,
          explain: 'RESONANCE adds the ring; VCF MOD AMOUNT makes each note open wider. Together they make the "wow".',
        },
      },
    },
    {
      kind: 'match', instruction: 'Round 1: set both knobs to match the target.', concept: 'filter-resonance',
      setup: { resonance: 10, vcf_mod_amount: 15 },
      match: { target: { resonance: 65, vcf_mod_amount: 55 }, controls: ['resonance', 'vcf_mod_amount'] },
      hints: ['Find the ring first, then the sweep.', 'It rings clearly and opens wide.', 'RESONANCE about 65 %, VCF MOD AMOUNT about 55 %.'],
    },
    {
      kind: 'match', instruction: 'Round 2: a different corner.', concept: 'modulation-depth',
      setup: { resonance: 65, vcf_mod_amount: 55 },
      match: { target: { resonance: 15, vcf_mod_amount: 75 }, controls: ['resonance', 'vcf_mod_amount'] },
      hints: ['Does it still ring?', 'Hardly any ring, but a big bright snap on each note.', 'RESONANCE low (~15 %), VCF MOD AMOUNT high (~75 %).'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-resonance',
      quiz: {
        question: 'You hear a whistle at one pitch on every note, but the notes do not open much. Which settings?',
        options: ['High RESONANCE, low VCF MOD AMOUNT', 'Low RESONANCE, high VCF MOD AMOUNT', 'Both low'], answer: 0,
        explain: 'The whistle is resonance. How far the brightness moves at the start of each note is VCF MOD AMOUNT.',
      },
    },
    {
      kind: 'match', instruction: 'Round 3: the subtle one.', concept: 'filter-resonance',
      setup: { resonance: 15, vcf_mod_amount: 75 },
      match: { target: { resonance: 45, vcf_mod_amount: 35 }, controls: ['resonance', 'vcf_mod_amount'] },
      hints: ['Both are in the middle.', 'A little ring, a medium sweep.', 'RESONANCE about 45 %, VCF MOD AMOUNT about 35 %.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do you tell RESONANCE from VCF MOD AMOUNT by ear?',
        model: 'Resonance is a ringing, whistling peak at one pitch; VCF MOD AMOUNT is how much brighter each note gets at its start.',
      },
    },
  ],
  review: [
    { question: 'A ringing whistle at one pitch means…', options: ['RESONANCE', 'VCF MOD AMOUNT', 'GLIDE'], answer: 0, explain: 'The resonant peak.' },
    { question: 'A bright snap at the start of each note means…', options: ['VCF MOD AMOUNT', 'RESONANCE', 'ATTACK'], answer: 0, explain: 'The envelope opens the filter.' },
    { question: 'The best way to match two controls is…', options: ['One at a time, the most obvious first', 'Both at random', 'Always the left knob first'], answer: 0, explain: 'Isolate and compare.' },
  ],
};

const e4: Lesson = {
  id: 'mother32-e4-mixed', device: 'mother32', path: 'ear-training', order: O(14), difficulty: 'advanced',
  name: 'Ear training 4: what changed?',
  description: 'Three controls from three sections at once: oscillator, filter and envelope.',
  objective: 'Tell oscillator, filter and envelope changes apart by ear and recreate a three-control target.',
  source: 'Synth Studio · ear training (interleaved)', estimatedMinutes: 8,
  prerequisites: ['mother32-e2-length', 'mother32-e3-pluck'],
  concepts: ['oscillator-waveform', 'filter-cutoff', 'envelope-decay'],
  start: { reset: true, values: { ...EAR, vco_wave: 0, pulse_width: 50, cutoff: 1500, decay: 300, sustain: 1 } },
  steps: [
    {
      kind: 'listen', concept: 'envelope-decay', focus: ['decay', 'cutoff', 'pulse_width'],
      instruction: 'A and B differ in ONE control. Listen carefully.',
      listen: {
        a: {}, b: { decay: 1000 }, labels: ['A', 'B'],
        question: {
          question: 'What changed from A to B?',
          options: ['How long the notes ring (DECAY)', 'The brightness (CUTOFF)', 'The pulse width'], answer: 0,
          explain: 'The start of each note is identical and only the tail is longer, so that is the envelope, not the filter or the oscillator.',
        },
      },
    },
    {
      kind: 'listen', concept: 'oscillator-waveform', focus: ['pulse_width', 'cutoff'],
      instruction: 'Again: A and B differ in one control.',
      listen: {
        a: {}, b: { pulse_width: 12 }, labels: ['A', 'B'],
        question: {
          question: 'What changed from A to B?',
          options: ['PULSE WIDTH - B is thinner and nasal', 'CUTOFF - B is darker', 'DECAY - B is shorter'], answer: 0,
          explain: 'B sounds thin and reedy all the way through the note, which is the oscillator\'s colour. A cutoff change would make it duller or brighter without that nasal quality.',
        },
      },
    },
    {
      kind: 'match', instruction: 'Round 1: three controls - width, brightness and length.', concept: 'oscillator-waveform',
      setup: { pulse_width: 50, cutoff: 4000, decay: 120 },
      match: { target: { pulse_width: 20, cutoff: 700, decay: 700 }, controls: ['pulse_width', 'cutoff', 'decay'] },
      hints: ['One at a time: length first, then brightness, then width.', 'The target rings longer, is darker and thinner.', 'PULSE WIDTH about 20 %, CUTOFF about 700 Hz, DECAY about 700 ms.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: {
        question: 'A note is brighter only at its start; the tail is the same. Which control most likely changed?',
        options: ['VCF MOD AMOUNT', 'DECAY', 'PULSE WIDTH'], answer: 0,
        explain: 'Brightness that only lasts for the start of a note comes from the filter envelope. DECAY would change the tail; PULSE WIDTH would change the colour of the whole note.',
      },
    },
    {
      kind: 'match', instruction: 'Round 2: the hard one.', concept: 'filter-cutoff',
      setup: { pulse_width: 20, cutoff: 700, decay: 700 },
      match: { target: { pulse_width: 40, cutoff: 1800, decay: 250 }, controls: ['pulse_width', 'cutoff', 'decay'], tolerance: 0.09 },
      hints: ['It is shorter, brighter and fuller than yours.', 'Width near the middle, the filter fairly open, a short decay.', 'PULSE WIDTH about 40 %, CUTOFF about 1.8 kHz, DECAY about 250 ms.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How can you tell an oscillator, a filter and an envelope change apart by ear?',
        model: 'The oscillator changes the colour of the whole note, the filter changes how bright the whole note is, and the envelope changes how the note moves over time - its start or its tail.',
      },
    },
  ],
  review: [
    { question: 'Same start, longer tail means…', options: ['A longer DECAY', 'A higher CUTOFF', 'A thinner pulse'], answer: 0, explain: 'An envelope change.' },
    { question: 'A thin, nasal colour throughout the note means…', options: ['A narrow pulse width', 'A low cutoff', 'A short decay'], answer: 0, explain: 'The oscillator.' },
    { question: 'Brighter only at the start of each note means…', options: ['More VCF MOD AMOUNT', 'A higher CUTOFF', 'More VOLUME'], answer: 0, explain: 'The filter envelope.' },
  ],
};

// ============================================================================
// SEQUENCING
// ============================================================================

const sq1: Lesson = {
  id: 'mother32-sq1-step-edit', device: 'mother32', path: 'sequencing', order: O(15), difficulty: 'intermediate',
  name: 'Step mode: rests, gate lengths, ties and accents',
  description: 'Edit a pattern step by step: switch steps on and off, and set gate length, ties and accents.',
  objective: 'Edit steps in STEP mode: switch them on and off, and set gate length, ties and accents.',
  source: 'Synth Studio · Mother-32 manual v2 pp.24-31 (Step mode)', estimatedMinutes: 9,
  prerequisites: ['mother32-f6-sequencer'],
  concepts: ['sequencer-pattern', 'velocity-dynamics', 'envelope-sustain'],
  start: { reset: true, values: { cutoff: 500, resonance: 30, vcf_mod_amount: 40, decay: 200, sustain: 0, ...ROOT8 } },
  steps: [
    run(),
    {
      kind: 'do', control: 'seq_mode', targetValue: 1, concept: 'sequencer-pattern',
      instruction: 'Enter STEP mode: tap (SHIFT), then the (STEP) arrow.',
      principle: 'Step mode turns the keyboard into one button per step.',
      explanation: 'The eight lower pads are now steps 1-8; the 1-8, 9-16, 17-24 and 25-32 keys choose which page of steps they show.',
      manualReference: 'Manual v2 p.31 - Step mode',
    },
    {
      kind: 'do', concept: 'sequencer-pattern',
      instruction: 'Tap pads 2 and 6 to switch those steps off.',
      check: s => step(s, 1).rest && step(s, 5).rest && !step(s, 0).rest,
      principle: 'A rest keeps its place in time but plays nothing; rests are what make a rhythm.',
      hints: ['Each pad is one step.', 'Pads 2 and 6 are the second and sixth white pads.'],
      solution: { values: { seq_rest: '01000100'.padEnd(32, '0') } },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: {
        question: 'A step that is switched off…',
        options: ['Keeps its time slot but plays nothing', 'Shortens the pattern', 'Plays more quietly'], answer: 0,
        explain: 'The pattern still takes the same time; that step is simply silent. The pattern length only changes with SET END.',
      },
    },
    {
      kind: 'predict', concept: 'envelope-sustain',
      instruction: 'Edit step 3: tap (SHIFT), then pad 3 (its LED blinks). Turn TEMPO - now GATE LENGTH - fully clockwise.',
      predict: {
        question: 'Steps 3 and 4 play the same note. What will a gate of 8/8 on step 3 do?',
        options: ['Join them into one long note', 'Silence step 3', 'Play step 3 eight times'], answer: 0,
        explain: 'A gate that lasts the whole step is still open when step 4 begins, so the envelope never restarts: two steps of the same note sound as one long note. That is a tie.',
      },
      check: s => step(s, 2).gate === 8,
      principle: 'A gate as long as its step ties into the next one: two steps become one long note.',
      explanation: 'While a step is edited the OCTAVE / LOCATION LEDs show its gate length as a bar; all eight lit is a tie. SUSTAIN must be ON for gate lengths to be heard.',
      hints: ['First select the step: SHIFT, then the pad.', 'TEMPO becomes GATE LENGTH while a step blinks.', 'Turn it all the way up: the readout says TIE.'],
      solution: { values: { seq_gate: '33833333'.padEnd(32, '4') } },
      manualReference: 'Manual v2 p.25 - Gate Length',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-sustain',
      quiz: {
        question: 'Why must SUSTAIN be ON for gate lengths to matter?',
        options: ['With SUSTAIN OFF the envelope decays whatever the gate does', 'SUSTAIN sets the tempo', 'It doubles the gate length'], answer: 0,
        explain: 'With SUSTAIN OFF every note is an attack-decay pluck. Only a sustaining envelope follows the gate, so only then does its length change the note.',
      },
    },
    {
      kind: 'do', concept: 'velocity-dynamics',
      instruction: 'Step 3 is still blinking: press RESET / ACCENT to accent it.',
      check: s => step(s, 2).accent,
      principle: 'An accent makes one step louder and brighter, which gives a groove its push.',
      hints: ['RESET / ACCENT is on the lower row, far left.', 'Press it while step 3 is being edited.'],
      solution: { values: { seq_accent: '001'.padEnd(32, '0') } },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Make a groove: short notes on steps 1 and 5, a tie from step 7 into step 8, and an accent on step 5.',
      checklist: [
        { text: 'Steps 1 and 5 short (gate 2/8 or less)', check: s => step(s, 0).gate <= 2 && step(s, 4).gate <= 2 },
        { text: 'Step 7 tied (gate 8/8)', check: s => step(s, 6).gate === 8 },
        { text: 'Step 5 accented', check: s => step(s, 4).accent },
      ],
      hints: ['Edit each step with SHIFT + its pad.', 'TEMPO sets the gate; RESET / ACCENT the accent.', 'SHIFT + pad 1, TEMPO well down; the same for pad 5, then RESET / ACCENT; SHIFT + pad 7, TEMPO fully up.'],
      solution: { values: { seq_gate: '23832383'.padEnd(32, '4'), seq_accent: '00101000'.padEnd(32, '0') } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does a step\'s gate length change, and when can you hear it?',
        model: 'It sets how much of the step the note is held, from 1/8 to a tie into the next step; I hear it only with SUSTAIN ON.',
      },
    },
  ],
  review: [
    { question: 'In STEP mode, SHIFT + a step pad…', options: ['Edits that step', 'Deletes the pattern', 'Changes the octave'], answer: 0, explain: 'The step LED blinks while it is edited.' },
    { question: 'A gate length of 8/8 is…', options: ['A tie into the next step', 'A rest', 'A ratchet'], answer: 0, explain: 'The note is held into the next step.' },
    { question: 'While a step is edited, TEMPO sets…', options: ['Its gate length', 'The tempo', 'Swing'], answer: 0, explain: 'TEMPO / GATE LENGTH.' },
  ],
};

const SQ2 = seq([{ note: C2, accent: true }, C2, C3, C2, Eb2, C2, G2, Bb2]);

const sq2: Lesson = {
  id: 'mother32-sq2-ratchet-glide', device: 'mother32', path: 'sequencing', order: O(16), difficulty: 'advanced',
  name: 'Ratchets, glide, swing and pattern memory',
  description: 'Rolls inside a step, slides between steps, a swung groove, and saving it to one of 64 memories.',
  objective: 'Add a ratchet and a glide, swing the groove, and save the pattern to a memory slot.',
  source: 'Synth Studio · Mother-32 manual v2 pp.19, 24-26, 32 (ratchet, glide, swing, memory)', estimatedMinutes: 9,
  prerequisites: ['mother32-sq1-step-edit'],
  concepts: ['sequencer-pattern', 'glide', 'timing-tempo'],
  start: { reset: true, values: { vco_wave: 1, cutoff: 300, resonance: 60, vcf_mod_amount: 50, decay: 220, sustain: 1, glide: 80, seq_mode: 1, ...SQ2 } },
  steps: [
    run(),
    {
      kind: 'do', concept: 'sequencer-pattern',
      instruction: 'Edit step 3 (SHIFT, then pad 3). Then tap (SHIFT) and turn GLIDE up: a ratchet of 3.',
      check: s => step(s, 2).ratchet === 3,
      principle: 'A ratchet repeats a note inside one step: a quick roll that adds energy.',
      explanation: 'While a step is edited GLIDE turns its glide on and off; with SHIFT it sets the ratchet, 1-4 (yellow on the OCTAVE / LOCATION LEDs).',
      hints: ['The step must be blinking first.', 'SHIFT + GLIDE is the ratchet.', 'Turn GLIDE until the readout says RATCHET 3.'],
      solution: { values: { seq_ratchet: '113'.padEnd(32, '1') } },
      manualReference: 'Manual v2 p.26 - Ratchet',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: {
        question: 'A ratchet of 3 on a 16th-note step plays…',
        options: ['Three quick notes inside that step', 'The step three times as long', 'Three octaves higher'], answer: 0,
        explain: 'The step keeps its length; the note is re-triggered three times inside it. The pattern\'s timing does not change.',
      },
    },
    {
      kind: 'do', concept: 'glide',
      instruction: 'Edit step 5 (SHIFT + pad 5) and turn GLIDE clockwise: glide on.',
      check: s => step(s, 4).glide,
      principle: 'Glide on a step makes the pitch slide into that note instead of jumping.',
      hints: ['Select step 5 the same way as step 3.', 'Without SHIFT, GLIDE switches the step\'s glide.', 'Any clockwise position turns it on.'],
      solution: { values: { seq_glide: '00001'.padEnd(32, '0') } },
    },
    {
      kind: 'predict', control: 'glide', targetValue: 300, concept: 'glide',
      setup: { seq_mode: 0 },
      instruction: 'Back in KB mode, turn GLIDE up to about 300 ms.',
      predict: {
        question: 'Only step 5 has glide switched on. What changes when you turn GLIDE up?',
        options: ['Step 5 slides more slowly; the others still jump', 'Every step slides', 'Nothing - GLIDE only works on the keyboard'], answer: 0,
        explain: 'GLIDE sets the slide time; the per-step switch decides which steps slide. Played from the keyboard, every note slides.',
      },
      principle: 'The amount of glide and where it happens are separate decisions.',
    },
    {
      kind: 'do', control: 'swing', targetValue: 62, concept: 'timing-tempo',
      instruction: 'Tap (SHIFT), then turn TEMPO - now SWING - to about 62 %.',
      principle: 'Swing delays every second step: long-short pairs feel like a shuffle.',
      explanation: '50 % is straight. Around 66 % the second step lands on a triplet, the shuffle of house and hip-hop.',
      manualReference: 'Manual v2 p.19 - (SWING)',
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Save it to pattern 1-2: hold (SHIFT) on RUN / STOP for a second, tap pad 2, then SHIFT + RUN / STOP.',
      checklist: [
        { text: 'Pattern 1-2 holds this pattern', check: s => { const d = s.data as { bank?: unknown[] } | undefined; const p = d?.bank?.[1] as Record<string, unknown> | null | undefined; return !!p && p.seq_ratchet === patternOf(s.values).seq_ratchet && p.seq_glide === patternOf(s.values).seq_glide; } },
      ],
      hints: ['Save mode starts with SHIFT held on RUN / STOP for a second.', 'A blinking OCTAVE / LOCATION LED shows the slot; the pads pick it.', 'Pad 2, then SHIFT + RUN / STOP saves.'],
      solution: { data: { v: 1, loc: 1, bank: [null, { ...patternOf({ ...SQ2, seq_ratchet: '113'.padEnd(32, '1'), seq_glide: '00001'.padEnd(32, '0') }) }, ...new Array(62).fill(null)] } },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: {
        question: 'You load another pattern without saving. Your edits…',
        options: ['Are lost', 'Are saved automatically', 'Merge into the new pattern'], answer: 0,
        explain: 'Like the hardware (in its manual save mode), edits live in the working pattern until you save. PATTERN + RESET brings back the stored version.',
      },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What do a ratchet, a per-step glide and swing each do to a groove?',
        model: 'A ratchet rolls a note inside its step, glide slides into a chosen note, and swing delays every second step so the pairs feel long-short.',
      },
    },
  ],
  review: [
    { question: 'A ratchet…', options: ['Repeats a note inside one step', 'Lengthens a step', 'Transposes a step'], answer: 0, explain: '1-4 notes per step.' },
    { question: 'Swing at 50 % is…', options: ['Straight', 'A full triplet shuffle', 'Silent'], answer: 0, explain: 'No delay.' },
    { question: 'The Mother-32 stores…', options: ['64 patterns: 8 banks x 8', '8 patterns', 'One pattern'], answer: 0, explain: 'Plus the one you are editing.' },
    { question: 'To save on the Mother-32 you start with…', options: ['SHIFT held on RUN / STOP for a second', 'PATTERN + RESET', 'SHIFT + STEP'], answer: 0, explain: 'Then pick the slot and confirm with SHIFT + RUN / STOP.' },
  ],
};

// ============================================================================
// PERFORMANCE
// ============================================================================

const p1: Lesson = {
  id: 'mother32-p1-live', device: 'mother32', path: 'performance', order: O(17), difficulty: 'intermediate',
  name: 'Play it live: transpose, hold, accent and filter rides',
  description: 'Perform over a running pattern: key changes from the keyboard, holds, live accents and filter rides.',
  objective: 'Perform over a running pattern with transposition, HOLD, live accents and filter rides.',
  source: 'Synth Studio · Mother-32 manual v2 p.34 (KB mode while running) and performance practice', estimatedMinutes: 7,
  prerequisites: ['mother32-f6-sequencer'],
  concepts: ['sequencer-pattern', 'filter-cutoff', 'velocity-dynamics'],
  start: { reset: true, values: { vco_wave: 1, cutoff: 900, resonance: 45, vcf_mod_amount: 45, decay: 220, sustain: 1, ...ACID } },
  steps: [
    run('Performing is changing the music while it keeps playing.'),
    {
      kind: 'info', concept: 'sequencer-pattern',
      instruction: 'Press the F key, then the G key, then the low C: the pattern follows each key - a chord change.',
      principle: 'Moving a bass line to new roots outlines a chord progression.',
      explanation: 'In KB mode the keys transpose the running pattern and the readout shows TRANSPOSE. The lowest C (at the octave you are on) takes it home.',
      manualReference: 'Manual v2 p.34 - transposing',
    },
    {
      kind: 'do', control: 'kb_octave', targetValue: 2, concept: 'sequencer-pattern',
      instruction: 'Press the (KB) arrow once: the keyboard drops an octave (OCTAVE / LOCATION LED 3).',
      principle: 'The octave buttons shift the keyboard\'s range; the same key now transposes an octave lower.',
    },
    {
      kind: 'info', concept: 'sequencer-pattern', focus: ['m32_hold'],
      instruction: 'Press and hold HOLD / REST: the current step repeats until you let go.',
      principle: 'Repeating one step is a fill: it builds tension, and letting go releases it.',
      manualReference: 'Manual v2 p.56 - HOLD',
    },
    {
      kind: 'info', concept: 'velocity-dynamics',
      instruction: 'Tap (SHIFT), then hold RESET / ACCENT: every step is accented while you hold it.',
      principle: 'Accenting every step pushes the energy up for a moment, like a drummer leaning on every hit.',
    },
    {
      kind: 'do', control: 'cutoff', targetValue: 200, concept: 'filter-cutoff',
      instruction: 'Ride CUTOFF slowly down to about 200 Hz: the line goes dull and far away.',
      principle: 'Closing a filter removes energy; it sounds like the music moved behind a wall.',
    },
    {
      kind: 'predict', control: 'cutoff', targetValue: 2000, concept: 'filter-cutoff',
      instruction: 'Now sweep CUTOFF back up to about 2 kHz.',
      predict: {
        question: 'Why does opening the filter after a dark section feel like a lift?',
        options: ['Contrast: the brightness comes back', 'It plays faster', 'It adds more notes'], answer: 0,
        explain: 'Ears judge energy against what came just before. The filter sweep is the oldest build-up in dance music for exactly that reason.',
      },
      principle: 'Energy is relative: taking something away makes its return hit harder.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: {
        question: 'While the pattern runs, HOLD / REST…',
        options: ['Repeats the current step while held', 'Records a rest', 'Stops the sequencer'], answer: 0,
        explain: 'REST is its recording and editing function; while playing it is HOLD.',
      },
    },
    {
      kind: 'challenge', concept: 'filter-resonance',
      instruction: 'Build to a peak: bring the filter back open with more ring than you started with.',
      checklist: [
        { text: 'CUTOFF at 800 Hz or more', check: s => num(s, 'cutoff') >= 800 },
        { text: 'RESONANCE 55 % or more', check: s => num(s, 'resonance') >= 55 },
      ],
      hints: ['Two knobs: brightness and ring.', 'Open the filter, then add resonance.', 'CUTOFF about 1.2 kHz, RESONANCE about 60 %.'],
      solution: { values: { cutoff: 1200, resonance: 60 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Name two ways to build energy on the Mother-32 without changing the pattern.',
        model: 'Ride the filter up after keeping it dark, hold a step for a fill, or accent every step for a moment with SHIFT + ACCENT.',
      },
    },
  ],
  review: [
    { question: 'In KB mode while running, a key press…', options: ['Transposes the pattern', 'Records a note', 'Mutes the VCO'], answer: 0, explain: 'The whole pattern moves.' },
    { question: 'A classic build-up is…', options: ['Slowly opening the filter', 'Stopping the clock', 'Turning VOLUME to 0'], answer: 0, explain: 'Brightness returns.' },
    { question: 'SHIFT + RESET / ACCENT, held, gives…', options: ['Live accent on every step', 'A reset to step 1', 'Swing'], answer: 0, explain: 'Released, it goes back to normal.' },
  ],
};

// ============================================================================
// STUDIO
// ============================================================================

const st1: Lesson = {
  id: 'mother32-st1-studio-clock', device: 'mother32', path: 'studio', order: 8, difficulty: 'intermediate',
  name: 'Sync the Mother-32 to the studio',
  description: 'MIDI-style sync, the TEMPO knob as clock division, and an analog clock into the TEMPO jack.',
  objective: 'Run the Mother-32 from the studio clock: follow ▶ and ■, pick the step division with TEMPO, and clock it from a cable.',
  source: 'Synth Studio · Mother-32 manual v2 pp.54-55 (clock sources and priority), Moog support "half or double time"', estimatedMinutes: 8,
  requires: ['studio-clock'],
  prerequisites: ['mother32-f6-sequencer'],
  concepts: ['timing-tempo', 'signal-routing', 'sequencer-pattern'],
  start: { reset: true, values: { cutoff: 600, resonance: 35, vcf_mod_amount: 45, decay: 220, sustain: 1, ...BASS } },
  steps: [
    {
      kind: 'info', concept: 'timing-tempo',
      instruction: 'In the studio the Mother-32 follows the studio transport, as if MIDI clock were plugged into its MIDI IN.',
      principle: 'A shared clock keeps every instrument on the same beat.',
      explanation: '▶ in the top bar starts it on step 1 and ■ stops it. Its RUN / STOP button now starts and stops the whole studio.',
      manualReference: 'Manual v2 p.54 - Clock sources',
    },
    {
      kind: 'challenge', concept: 'timing-tempo',
      instruction: 'Press ▶ in the top bar.',
      checklist: [{ text: 'Studio transport playing', check: s => s.transport.playing }],
      hints: ['The play button is at the top of the page, next to the tempo.'],
    },
    {
      kind: 'predict', control: 'step_div', targetValue: div('1/8'), concept: 'timing-tempo',
      instruction: 'Turn TEMPO: under studio sync it picks the step length. Set it to 1/8.',
      predict: {
        question: 'The studio tempo stays the same. What happens to the Mother-32\'s pattern?',
        options: ['It plays at half speed - one step every 8th note', 'It plays twice as fast', 'It stops'], answer: 0,
        explain: 'Synced to an external clock, the Mother-32\'s TEMPO knob selects the clock division instead of the tempo. 1/8 steps are twice as long as 1/16. This is the reason Moog support gives for "half or double time" sync.',
      },
      principle: 'A clock division sets how many clock pulses make one step.',
      manualReference: 'Manual v2 p.54 - TEMPO when synced',
    },
    {
      kind: 'do', control: 'step_div', targetValue: div('1/16'), concept: 'timing-tempo',
      instruction: 'Set TEMPO back to 1/16.',
      principle: 'Sixteenth-note steps are the usual grid for bass lines and drums.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'Your synced Mother-32 plays at half speed against the drums. What is the likely cause?',
        options: ['TEMPO is selecting 1/8 instead of 1/16', 'The studio tempo is too low', 'A cable is loose'], answer: 0,
        explain: 'Under MIDI clock the TEMPO knob is a division selector, so its position decides the step length. The studio tempo would slow everything, not just the Mother-32.',
      },
    },
    {
      kind: 'challenge', instance: 'studio-clock', focus: ['out_clock'], concept: 'signal-routing',
      instruction: 'In the Studio tab, patch Studio Clock CLOCK into the Mother-32\'s TEMPO jack.',
      checklist: [{ text: 'CLOCK -> TEMPO cable', check: s => studioCable(s, 'out_clock', 'in_tempo', 'studio-clock', 'mother32') }],
      hints: ['Open the Studio tab at the top of the page.', 'Tap CLOCK on the Studio Clock, then TEMPO on the Mother-32 (bottom-left of its patch bay).'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'With a clock in TEMPO, which clock does the Mother-32 follow?',
        options: ['The pulses at TEMPO - an analog clock overrides MIDI clock', 'Only the studio transport', 'Its TEMPO knob'], answer: 0,
        explain: 'The manual ranks them: analog clock at TEMPO first, then MIDI clock, then the internal clock. In its default mode (CLOCK ADVANCE) each rising edge plays one step.',
      },
    },
    {
      kind: 'challenge', instance: 'studio-clock', focus: ['division'], concept: 'timing-tempo',
      instruction: 'Set the Studio Clock\'s CLOCK DIV to 1/8T and hear the Mother-32 step on every pulse - triplets.',
      checklist: [{ text: 'CLOCK DIV on 1/8T', check: s => Number(deviceValues(s, 'studio-clock').division) === 4 }],
      hints: ['CLOCK DIV is the selector on the Studio Clock.', 'Tap 1/8T: three pulses per beat.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does the TEMPO knob do when the Mother-32 is synced, and what does a clock in the TEMPO jack change?',
        model: 'Synced, TEMPO picks the step division instead of the tempo. A clock in the TEMPO jack overrides the MIDI-style clock: each pulse plays one step.',
      },
    },
  ],
  review: [
    { question: 'Under MIDI clock, the Mother-32\'s TEMPO knob…', options: ['Selects the step division', 'Sets the BPM', 'Does nothing'], answer: 0, explain: 'The tempo comes from the clock.' },
    { question: 'Which clock wins on the Mother-32?', options: ['An analog clock at TEMPO', 'MIDI clock', 'The internal clock'], answer: 0, explain: 'Analog, then MIDI, then internal.' },
    { question: 'In CLOCK ADVANCE mode, a pulse at TEMPO…', options: ['Plays the next step', 'Resets to step 1', 'Changes the tempo'], answer: 0, explain: 'One step per rising edge.' },
  ],
};

const st2: Lesson = {
  id: 'mother32-st2-dfam', device: 'mother32', path: 'studio', order: 9, difficulty: 'advanced',
  name: 'The Mother-32 clocks the DFAM',
  description: 'Moog\'s own recipe: ASSIGN (clock) into the DFAM\'s ADV / CLOCK, and the bass line tuning the drums.',
  objective: 'Clock the DFAM from the Mother-32\'s ASSIGN output, and let the bass line tune the drums through KB.',
  source: 'Synth Studio · Moog "Syncing DFAM with Mother-32" and Mother-32 manual v2 p.52 (ASSIGN)', estimatedMinutes: 9,
  requires: ['dfam'],
  prerequisites: ['mother32-st1-studio-clock'],
  concepts: ['signal-routing', 'timing-tempo', 'sequencer-pattern'],
  start: { reset: true, values: { cutoff: 600, resonance: 35, vcf_mod_amount: 45, decay: 220, sustain: 1, assign_source: 0, ...BASS } },
  steps: [
    {
      kind: 'info', concept: 'timing-tempo',
      instruction: 'Moog\'s recipe: the Mother-32\'s ASSIGN jack sends one clock pulse per step into the DFAM\'s ADV / CLOCK, so both step together.',
      principle: 'A clock pulse per step is all two sequencers need to stay locked.',
      explanation: 'ASSIGN can send 16 different things (Setup page 1). Its factory setting is the sequencer clock.',
      manualReference: 'Manual v2 p.52 - ASSIGN; Moog: Syncing DFAM with Mother-32',
    },
    {
      kind: 'do', control: 'assign_source', targetValue: 1, concept: 'signal-routing',
      instruction: 'Open SETUP (bottom right of the panel) and set ASSIGN OUTPUT to 2: CLOCK.',
      principle: 'An assignable output is one jack whose job you choose.',
      explanation: 'On the hardware Setup mode is SHIFT + RESET + SET END + STEP 8; the step pads then pick the value.',
    },
    {
      kind: 'challenge', instance: 'dfam', focus: ['in_adv_clock'], concept: 'signal-routing',
      instruction: 'In the Studio tab, patch the Mother-32\'s ASSIGN into the DFAM\'s ADV / CLOCK.',
      checklist: [{ text: 'Mother-32 ASSIGN -> DFAM ADV / CLOCK', check: s => studioCable(s, 'out_assign', 'in_adv_clock', 'mother32', 'dfam') }],
      hints: ['Tap ASSIGN on the Mother-32 (column 4, row 6), then ADV / CLOCK on the DFAM.'],
    },
    {
      kind: 'challenge', instance: 'dfam', focus: ['run_stop'], concept: 'timing-tempo',
      instruction: 'Press RUN / STOP on the DFAM first: with a cable in ADV / CLOCK it waits for pulses.',
      checklist: [{ text: 'DFAM running', check: s => deviceValues(s, 'dfam').run_stop === true }],
      hints: ['Moog\'s order: start the DFAM, then the Mother-32.'],
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Now start the Mother-32 (its RUN / STOP, or ▶): both sequencers play in step.',
      checklist: [{ text: 'Mother-32 playing', check: s => s.transport.playing || s.values.run_stop === true }],
      hints: ['In the studio, RUN / STOP and ▶ do the same thing.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'Why do the two now stay in step?',
        options: ['Every Mother-32 step sends a pulse that advances the DFAM', 'They share one TEMPO knob', 'Over MIDI'], answer: 0,
        explain: 'The DFAM has no MIDI; its ADV / CLOCK input moves it one step per pulse, and ASSIGN sends one pulse per Mother-32 step.',
      },
    },
    {
      kind: 'challenge', instance: 'dfam', focus: ['in_vco1_cv'], concept: 'oscillator-pitch',
      instruction: 'Patch the Mother-32\'s KB into the DFAM\'s VCO 1 CV: the drums now follow the bass line.',
      checklist: [{ text: 'Mother-32 KB -> DFAM VCO 1 CV', check: s => studioCable(s, 'out_kb', 'in_vco1_cv', 'mother32', 'dfam') }],
      hints: ['KB is on row 7 of the Mother-32\'s patch bay.', 'Both use 1 volt per octave.'],
    },
    {
      kind: 'predict', control: 'assign_source', targetValue: 2, concept: 'timing-tempo',
      instruction: 'In SETUP, set ASSIGN OUTPUT to 3: CLOCK / 2.',
      predict: {
        question: 'ASSIGN now pulses on every second step. What will the DFAM do?',
        options: ['Step half as often - one DFAM step per two Mother-32 steps', 'Play twice as fast', 'Stop'], answer: 0,
        explain: 'Half the pulses means half the steps: the DFAM\'s 8 steps now last as long as 16 Mother-32 steps, a slower drum pattern under the same bass line.',
      },
      principle: 'Dividing a clock between two sequencers makes patterns of different lengths line up.',
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do the two instruments stay together, and what does the KB cable add?',
        model: 'ASSIGN sends a clock pulse per Mother-32 step that advances the DFAM; the KB cable sends the bass line\'s pitch to the DFAM\'s VCO so the drums follow its notes.',
      },
    },
  ],
  review: [
    { question: 'To clock a DFAM from a Mother-32, patch…', options: ['ASSIGN (CLOCK) into ADV / CLOCK', 'GATE into TRIGGER', 'KB into TEMPO'], answer: 0, explain: 'Moog\'s sync sheet.' },
    { question: 'With a clock in ADV / CLOCK, the DFAM must…', options: ['Be started first and wait for pulses', 'Have its TEMPO at noon', 'Be in HOLD'], answer: 0, explain: 'Start it, then the master.' },
    { question: 'ASSIGN on CLOCK / 2 makes the DFAM…', options: ['Step half as often', 'Step twice as often', 'Stop'], answer: 0, explain: 'Half the pulses.' },
  ],
};

export const MOTHER32_LESSONS: Lesson[] = [f1, f2, f3, f4, f5, f6, f7, sd1, sd2, sd3, e1, e2, e3, e4, sq1, sq2, p1, st1, st2];
