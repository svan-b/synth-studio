// ============================================================================
// DFAM lessons (v2, docs/PEDAGOGY.md)
//
// Paths: foundations (signal flow: VCOs -> mixer -> filter -> VCA -> envelopes
// -> sequencer -> patching), sound design, ear training (graded: one control
// wide -> one control fine -> two controls -> three mixed), sequencing,
// performance and studio.
//
// Order: DFAM lessons use orders below 1 so the device path is recommended
// before the shared studio curriculum (orders 1-5); the DFAM studio lessons
// (orders 6+) come after it and build on it.
// ============================================================================

import type { ControlValue, Lesson, LessonCheckState, LessonStep } from '@/types';

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
const semis = (v: number) => Math.round(v * 12);

/** 8 step pitches (semitones) and/or velocities as control values */
function seq(pitchSt?: number[], vel?: number[]): Record<string, ControlValue> {
  const v: Record<string, ControlValue> = {};
  for (let i = 0; i < 8; i++) {
    if (pitchSt) v[`pitch_${i + 1}`] = Math.round((pitchSt[i] / 12) * 1000) / 1000;
    if (vel) v[`velocity_${i + 1}`] = vel[i];
  }
  return v;
}
const BEATS = [100, 0, 0, 0, 100, 0, 0, 0];

const run = (principle = 'A sequencer loops a list of steps, and every step plays the drum once.'): LessonStep => ({
  kind: 'do', control: 'run_stop', targetValue: true, concept: 'sequencer-pattern',
  instruction: 'Press RUN / STOP to start the 8-step sequence.',
  principle,
  explanation: 'You will hear the DFAM loop its eight steps. Leave it running while you turn knobs - every change is audible on the next hit.',
  manualReference: 'Manual: Sequencer - RUN / STOP',
});

// ============================================================================
// FOUNDATIONS
// ============================================================================

const f1: Lesson = {
  id: 'dfam-f1-oscillators', device: 'dfam', path: 'foundations', order: O(1), difficulty: 'beginner',
  name: 'Two oscillators: pitch and wave',
  description: 'Where every DFAM sound starts: two oscillators, their pitch and their waveform.',
  objective: 'Set the pitch and waveform of each VCO and hear how two oscillators combine.',
  source: 'Synth Studio · DFAM manual, VCO section', estimatedMinutes: 6,
  concepts: ['oscillator-pitch', 'oscillator-waveform', 'mixing'],
  start: { reset: true, values: { vca_decay: 450, tempo: 60 } },
  steps: [
    run('An oscillator makes a repeating wave; repeated fast enough, the ear hears a pitch.'),
    {
      kind: 'predict', control: 'vco1_frequency', targetValue: 1, concept: 'oscillator-pitch',
      instruction: 'Turn VCO 1 FREQUENCY up to +1 (one octave).',
      predict: {
        question: 'What will turning VCO 1 FREQUENCY up do?',
        options: ['Raise the pitch', 'Make it louder', 'Make each hit longer'], answer: 0,
        explain: 'FREQUENCY sets how many cycles the oscillator makes each second, and more cycles sound higher. One octave up doubles it, from 131 Hz to 262 Hz. Loudness and length belong to the VCA, not the oscillator.',
      },
      principle: 'Pitch is frequency: doubling the cycles per second raises a note by one octave.',
      manualReference: 'Manual: VCO section - VCO FREQUENCY',
    },
    {
      kind: 'do', control: 'vco1_wave', targetValue: 0, concept: 'oscillator-waveform',
      instruction: 'Flip the VCO 1 wave switch up to SQR (square).',
      principle: 'A square wave has strong odd harmonics, so it sounds hollow and buzzy.',
      explanation: 'Harmonics are the quieter, higher pitches inside a sound that give it its colour. A triangle has only weak harmonics, so it is close to a pure, flute-like tone.',
      manualReference: 'Manual: VCO section - waveform switch',
    },
    {
      kind: 'listen', concept: 'oscillator-waveform', focus: ['vco1_wave'],
      instruction: 'Compare the triangle and the square at the same pitch. Watch the spectrum in the scope.',
      listen: {
        a: { vco1_wave: 1 }, b: { vco1_wave: 0 }, labels: ['Triangle', 'Square'],
        question: {
          question: 'Which one has more bright, buzzy harmonics?',
          options: ['The square', 'The triangle', 'They have the same harmonics'], answer: 0,
          explain: 'The spectrum shows a tall line for each harmonic. The square has many strong ones, while the triangle\'s fade away quickly. Same pitch, different colour.',
        },
      },
    },
    {
      kind: 'do', control: 'vco2_level', targetValue: 60, concept: 'mixing',
      instruction: 'Turn VCO 2 LEVEL up to about 60%.',
      principle: 'A mixer adds waves together: two oscillators give a tone with the harmonics of both.',
      explanation: 'VCO 2 is still at noon, an octave below VCO 1. The mixer adds the two waves together before the filter.',
      manualReference: 'Manual: Mixer',
    },
    {
      kind: 'do', control: 'vco2_frequency', targetValue: 1.583, concept: 'oscillator-pitch',
      instruction: 'Turn VCO 2 FREQUENCY to about +1.6, a fifth above VCO 1.',
      principle: 'Pitches at a simple ratio (3:2, a fifth) blend into one rich tone; odd ratios sound metallic.',
      explanation: 'A fifth is 7 semitones, and 7/12 of an octave is about 0.58. So +1.58 sits a fifth above VCO 1\'s +1. Move the knob slowly and listen for the point where the beating stops.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'oscillator-pitch',
      quiz: {
        question: 'VCO 1 plays 131 Hz. You raise FREQUENCY by exactly one octave. What does it play now?',
        options: ['262 Hz', '144 Hz', '196 Hz'], answer: 0,
        explain: 'An octave always doubles the frequency: 131 × 2 = 262 Hz. 196 Hz is a fifth above 131 Hz, which is a ratio of 3:2, not 2:1.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target sound.', concept: 'oscillator-waveform',
      match: { target: { vco1_frequency: 1, vco1_wave: 1, vco2_level: 0 }, controls: ['vco1_wave', 'vco2_level'] },
      hints: ['Is the target soft and round, or buzzy?', 'The target has only one oscillator.', 'VCO 1 wave on TRI, VCO 2 LEVEL all the way down.'],
    },
    {
      kind: 'challenge', concept: 'oscillator-pitch',
      instruction: 'Make a fuller tone: add VCO 2 exactly one octave above VCO 1, loud enough to hear.',
      checklist: [
        { text: 'VCO 2 LEVEL at least 40%', check: s => num(s, 'vco2_level') >= 40 },
        { text: 'VCO 2 FREQUENCY one octave above VCO 1 (about +1 more)', check: s => Math.abs(num(s, 'vco2_frequency') - num(s, 'vco1_frequency') - 1) < 0.15 },
      ],
      hints: ['An octave on these knobs is 1.0.', 'VCO 1 is at +1, so where should VCO 2 go?', 'VCO 2 FREQUENCY at about +2, VCO 2 LEVEL around 60%.'],
      solution: { values: { vco1_frequency: 1, vco2_frequency: 2, vco2_level: 60 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence: what does the FREQUENCY knob change, and what does the wave switch change?',
        model: 'FREQUENCY changes the pitch (how many cycles per second); the wave switch changes the tone colour (which harmonics are present) without changing the pitch.',
      },
    },
  ],
  review: [
    { question: 'Raising an oscillator one octave…', options: ['Doubles its frequency', 'Adds 12 Hz', 'Makes it louder'], answer: 0, explain: 'An octave is a 2:1 frequency ratio.' },
    { question: 'Square versus triangle at the same pitch: the square…', options: ['Has stronger harmonics and sounds buzzier', 'Is an octave higher', 'Has no harmonics'], answer: 0, explain: 'Same fundamental, more and stronger harmonics.' },
    { question: 'Two oscillators a fifth apart have a frequency ratio of…', options: ['3:2', '2:1', '5:1'], answer: 0, explain: 'A fifth is 3:2; an octave is 2:1.' },
  ],
};

const f2: Lesson = {
  id: 'dfam-f2-mixer-noise', device: 'dfam', path: 'foundations', order: O(2), difficulty: 'beginner',
  name: 'The mixer: tone and noise',
  description: 'Blend the oscillators with white noise - the raw material of snares and hats.',
  objective: 'Balance oscillators and noise in the mixer and hear what noise adds.',
  source: 'Synth Studio · DFAM manual, Mixer section', estimatedMinutes: 5,
  prerequisites: ['dfam-f1-oscillators'],
  concepts: ['mixing', 'noise', 'oscillator-waveform'],
  start: { reset: true, values: { vca_decay: 250, tempo: 90, vcf_cutoff: 8000 } },
  steps: [
    run(),
    {
      kind: 'predict', control: 'noise_level', targetValue: 70, concept: 'noise',
      instruction: 'Turn NOISE / EXT LEVEL up to about 70%.',
      predict: {
        question: 'Noise contains every frequency at once. What will adding it do?',
        options: ['Add a hiss, like a snare or a breath', 'Raise the pitch', 'Make the hits longer'], answer: 0,
        explain: 'White noise is random, with all frequencies at equal strength, so it has no pitch. Mixed with a tone it adds hiss: the "wires" of a snare. Pitch and length do not change.',
      },
      principle: 'Noise has energy at every frequency and no pitch: the raw material of snares, hats and breath.',
      manualReference: 'Manual: Mixer - NOISE / EXT LEVEL',
    },
    {
      kind: 'do', control: 'vco1_level', targetValue: 0, concept: 'mixing',
      instruction: 'Turn VCO 1 LEVEL all the way down.',
      principle: 'A mixer sets how much of each source reaches the filter; at zero, that source is gone.',
      explanation: 'Now only noise is left: a burst of hiss on every step.',
      manualReference: 'Manual: Mixer - VCO 1 LEVEL',
    },
    {
      kind: 'listen', concept: 'noise', focus: ['vco1_level', 'noise_level'],
      instruction: 'Compare a pure tone with pure noise.',
      listen: {
        a: { vco1_level: 75, noise_level: 0 }, b: { vco1_level: 0, noise_level: 75 }, labels: ['Tone', 'Noise'],
        question: {
          question: 'Which one has a pitch you could sing?',
          options: ['The tone', 'The noise', 'Both'], answer: 0,
          explain: 'A tone repeats, so its energy sits on one note and its harmonics. Noise never repeats, so its energy is spread everywhere and you cannot hum it.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'mixing',
      quiz: {
        question: 'A snare is a drum body plus rattling wires. Which mix makes one?',
        options: ['Some VCO plus some noise', 'Only noise', 'Only a VCO'], answer: 0,
        explain: 'The VCO gives the drum its body and the noise copies the wires. Noise alone sounds like a hi-hat or a clap, and a VCO alone sounds like a tom.',
      },
    },
    {
      kind: 'do', control: 'vco1_level', targetValue: 60, concept: 'mixing',
      instruction: 'Bring VCO 1 LEVEL back up to about 60%.',
      principle: 'Balance is relative: the same noise sounds bigger next to a quiet tone.',
    },
    {
      kind: 'predict', control: 'vco1_wave', targetValue: 0, concept: 'oscillator-waveform',
      instruction: 'Flip the VCO 1 wave switch up to SQR.',
      predict: {
        question: 'At the same LEVEL, will the square sound louder or quieter than the triangle?',
        options: ['Louder', 'Quieter', 'Exactly the same'], answer: 0,
        explain: 'A square spends all its time at full height, so it carries more energy than a triangle with the same peaks. On the DFAM the square is clearly louder, so you rebalance the mixer after switching.',
      },
      principle: 'Waveforms with the same peak can carry different energy; a square is the loudest simple wave.',
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target mix.', concept: 'mixing',
      match: { target: { vco1_level: 90, noise_level: 25, vco1_wave: 1 }, controls: ['vco1_level', 'noise_level'] },
      hints: ['Listen to the hiss first. Is there more or less than now?', 'The target is mostly tone with a little hiss.', 'VCO 1 LEVEL near the top, NOISE / EXT LEVEL about a quarter.'],
    },
    {
      kind: 'challenge', concept: 'mixing',
      instruction: 'Make a breathy tone: you can still hear the pitch, but a clear hiss sits on top.',
      checklist: [
        { text: 'VCO 1 LEVEL at least 40%', check: s => num(s, 'vco1_level') >= 40 },
        { text: 'NOISE / EXT LEVEL between 20% and 60%', check: s => num(s, 'noise_level') >= 20 && num(s, 'noise_level') <= 60 },
      ],
      hints: ['Start from the tone, then add noise until it just starts to hiss.', 'Too much noise and the pitch disappears.', 'Try VCO 1 LEVEL 70% and NOISE / EXT LEVEL 35%.'],
      solution: { values: { vco1_level: 70, noise_level: 35 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does a snare need both an oscillator and noise?',
        model: 'The oscillator gives the pitched body of the drum and the noise gives the hiss of the wires; together they sound like one drum.',
      },
    },
  ],
  review: [
    { question: 'White noise has…', options: ['Energy at all frequencies and no pitch', 'One pitch', 'Only low frequencies'], answer: 0, explain: 'It is random, so it has no repeating pitch.' },
    { question: 'To make a snare from a tom sound, you add…', options: ['Noise', 'More VCO DECAY', 'A slower tempo'], answer: 0, explain: 'Noise supplies the wires.' },
    { question: 'Switching a VCO from triangle to square at the same level makes it…', options: ['Louder and buzzier', 'Quieter', 'Lower in pitch'], answer: 0, explain: 'The square carries more energy and harmonics.' },
  ],
};

const f3: Lesson = {
  id: 'dfam-f3-filter', device: 'dfam', path: 'foundations', order: O(3), difficulty: 'beginner',
  name: 'The filter: brightness and ring',
  description: 'The Moog ladder filter: CUTOFF, RESONANCE, low-pass and high-pass.',
  objective: 'Use CUTOFF, RESONANCE and the HP / LP switch to make a sound darker, brighter or ringing.',
  source: 'Synth Studio · DFAM manual, VCF section', estimatedMinutes: 7,
  prerequisites: ['dfam-f2-mixer-noise'],
  concepts: ['filter-cutoff', 'filter-resonance', 'filter-type'],
  start: { reset: true, values: { vco1_wave: 0, vco1_frequency: -1, vca_decay: 450, tempo: 60, vcf_cutoff: 8000 } },
  steps: [
    run(),
    {
      kind: 'predict', control: 'vcf_cutoff', targetValue: 300, concept: 'filter-cutoff',
      instruction: 'Turn CUTOFF down to about 300 Hz.',
      predict: {
        question: 'What will turning CUTOFF down do?',
        options: ['Make it darker and duller', 'Lower the pitch', 'Make each hit shorter'], answer: 0,
        explain: 'The pitch stays the same. The low-pass filter removes the upper harmonics, so the tone gets darker. It also gets a little quieter because energy is removed, but that is a side effect.',
      },
      principle: 'A low-pass filter removes harmonics above the cutoff; the oscillator, not the filter, sets the pitch.',
      manualReference: 'Manual: VCF - CUTOFF',
    },
    {
      kind: 'listen', concept: 'filter-cutoff', focus: ['vcf_cutoff'],
      instruction: 'Compare the open and the closed filter. Watch the harmonics vanish in the spectrum.',
      listen: { a: { vcf_cutoff: 8000 }, b: { vcf_cutoff: 300 }, labels: ['Open (8 kHz)', 'Closed (300 Hz)'] },
    },
    {
      kind: 'do', control: 'vcf_resonance', targetValue: 70, concept: 'filter-resonance',
      instruction: 'Turn RESONANCE up to about 70%.',
      principle: 'Resonance feeds the filter output back to its input, boosting a narrow band at the cutoff.',
      explanation: 'That boosted band rings like a struck glass. On a Moog ladder the lows also thin out a little as resonance rises.',
      manualReference: 'Manual: VCF - RESONANCE',
    },
    {
      kind: 'do', control: 'vcf_cutoff', targetValue: 1500, concept: 'filter-cutoff',
      instruction: 'Slowly sweep CUTOFF up to about 1500 Hz and listen to the ringing peak move.',
      principle: 'Moving a resonant peak through the harmonics makes a vowel-like "wow" sweep.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-cutoff',
      quiz: {
        question: 'A square wave through a low-pass filter set below its second harmonic sounds…',
        options: ['Almost like a sine wave', 'Brighter', 'An octave higher'], answer: 0,
        explain: 'Only the fundamental gets through, and a lone fundamental is a sine. The pitch stays the same.',
      },
    },
    {
      kind: 'predict', control: 'vcf_mode', targetValue: 0, concept: 'filter-type',
      instruction: 'Flip the VCF switch up to HP (high-pass).',
      predict: {
        question: 'High-pass keeps what is above CUTOFF. What happens to this low note?',
        options: ['It goes thin - the body disappears', 'It gets deeper', 'Nothing changes'], answer: 0,
        explain: 'With CUTOFF at 1.5 kHz, high-pass throws away the fundamental and the lower harmonics, the body of the sound. What is left is the thin, buzzy top. That is why hats and snares often use HP.',
      },
      principle: 'A high-pass filter removes everything below the cutoff, keeping only the bright top.',
      manualReference: 'Manual: VCF - HP / LP switch',
    },
    {
      kind: 'do', control: 'vcf_mode', targetValue: 1, concept: 'filter-type',
      instruction: 'Flip the VCF switch back down to LP.',
      principle: 'Low-pass is the classic Moog sound: warm lows, adjustable top.',
    },
    {
      kind: 'predict', control: 'vcf_resonance', targetValue: 100, concept: 'filter-resonance',
      instruction: 'Turn RESONANCE fully clockwise.',
      predict: {
        question: 'Past about 3 o\'clock the filter starts to whistle on its own. What is it doing?',
        options: ['Oscillating - it has become a sine-wave source', 'Distorting the VCO', 'Echoing the last hit'], answer: 0,
        explain: 'With enough feedback the filter feeds itself and oscillates at the cutoff frequency, even with no input. The DFAM manual uses this as a third sound source in its preset "Filter As An Oscillator".',
      },
      principle: 'With enough feedback a filter oscillates by itself, producing a sine wave at the cutoff.',
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target filter.', concept: 'filter-resonance',
      match: { target: { vcf_mode: 1, vcf_cutoff: 600, vcf_resonance: 70 }, controls: ['vcf_cutoff', 'vcf_resonance'] },
      hints: ['First, find how bright it is - then how much it rings.', 'The target rings, but does not whistle on its own.', 'CUTOFF in the low-mids, around 600 Hz; RESONANCE around 70%.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence: what does RESONANCE add to the filter?',
        model: 'It boosts a narrow band around the cutoff frequency, so the filter rings at that pitch - and at the top of its range it rings on its own.',
      },
    },
  ],
  review: [
    { question: 'Turning CUTOFF down on a low-pass filter…', options: ['Removes high harmonics (darker)', 'Lowers the pitch', 'Adds distortion'], answer: 0, explain: 'Pitch is set by the VCO.' },
    { question: 'Which filter mode suits a thin hi-hat?', options: ['High-pass', 'Low-pass', 'Either - mode does not matter'], answer: 0, explain: 'HP removes the low body.' },
    { question: 'A self-oscillating filter produces…', options: ['A sine wave at the cutoff frequency', 'White noise', 'A square wave'], answer: 0, explain: 'Feedback makes it ring by itself.' },
    { question: 'Raising RESONANCE on a Moog ladder also tends to…', options: ['Thin out the lows', 'Raise the pitch', 'Lengthen the decay'], answer: 0, explain: 'The classic ladder bass loss.' },
  ],
};

const f4: Lesson = {
  id: 'dfam-f4-vca', device: 'dfam', path: 'foundations', order: O(4), difficulty: 'beginner',
  name: 'The VCA envelope: how long a hit lasts',
  description: 'VCA DECAY and the FAST / SLOW attack switch: the shape of every hit.',
  objective: 'Shape how long and how sharply each hit sounds with VCA DECAY and the VCA EG switch.',
  source: 'Synth Studio · DFAM manual, VCA section', estimatedMinutes: 6,
  prerequisites: ['dfam-f3-filter'],
  concepts: ['envelope-decay', 'envelope-attack', 'timing-tempo'],
  start: { reset: true, values: { vco1_frequency: -0.5, vco1_eg_amount: 20, vco_decay: 40, vca_decay: 300, tempo: 60, ...seq(undefined, BEATS) } },
  steps: [
    run('An envelope is a shape over time; the VCA envelope is the loudness of each hit.'),
    {
      kind: 'predict', control: 'vca_decay', targetValue: 2000, concept: 'envelope-decay',
      instruction: 'Turn VCA DECAY up to about 2 seconds.',
      predict: {
        question: 'What will a longer VCA DECAY do?',
        options: ['Each hit rings longer', 'The hits come closer together', 'The pitch drops'], answer: 0,
        explain: 'DECAY is how long a hit takes to fade away. When does the next hit come? That is TEMPO\'s job, not DECAY\'s.',
      },
      principle: 'The decay of an amplitude envelope is how long a sound takes to fade out.',
      manualReference: 'Manual: VCA - VCA DECAY',
    },
    {
      kind: 'do', control: 'vca_decay', targetValue: 40, concept: 'envelope-decay',
      instruction: 'Now turn VCA DECAY right down to about 40 ms.',
      principle: 'Very short decays become clicks and ticks: you hear the attack but hardly any tone.',
      explanation: 'Fully counter-clockwise, the DFAM gives almost no sound at all. That is useful for tight hats.',
    },
    {
      kind: 'listen', concept: 'envelope-decay', focus: ['vca_decay'],
      instruction: 'Compare a short and a long VCA DECAY.',
      listen: {
        a: { vca_decay: 60 }, b: { vca_decay: 1500 }, labels: ['Short', 'Long'],
        question: {
          question: 'Which one would suit a closed hi-hat?',
          options: ['Short', 'Long', 'Both equally'], answer: 0,
          explain: 'A closed hat is choked almost instantly, so it needs a short decay. A long decay rings like an open hat or a gong.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'Which control decides how far apart the hits are?',
        options: ['TEMPO', 'VCA DECAY', 'VOLUME'], answer: 0,
        explain: 'TEMPO sets when hits happen and VCA DECAY sets how long each one lasts. If the decay is longer than the gap, the hits overlap into a drone.',
      },
    },
    {
      kind: 'do', control: 'vca_decay', targetValue: 300, concept: 'envelope-decay',
      instruction: 'Set VCA DECAY back to about 300 ms.',
      principle: 'Medium decays let a drum ring just long enough to have a pitch.',
    },
    {
      kind: 'predict', control: 'vca_attack_mode', targetValue: 1, concept: 'envelope-attack',
      instruction: 'Flip the VCA EG switch to SLOW.',
      predict: {
        question: 'SLOW gives the VCA a 100 ms attack instead of 1 ms. How will each hit start?',
        options: ['It fades in softly instead of snapping', 'It starts louder', 'It starts later, but just as sharp'], answer: 0,
        explain: 'Attack is the fade-in time. One millisecond is an instant snap, like a stick. A hundred milliseconds is a swell, like a brush, a soft mallet or a shaker.',
      },
      principle: 'Attack is the fade-in: fast snaps like a stick, slow swells like a brush.',
      manualReference: 'Manual: VCA - VCA EG FAST / SLOW',
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target hit.', concept: 'envelope-decay',
      match: { target: { vca_decay: 900, vca_attack_mode: 0 }, controls: ['vca_decay', 'vca_attack_mode'] },
      hints: ['Two questions: does it snap or swell, and how long does it ring?', 'The target snaps.', 'VCA EG on FAST and VCA DECAY just under a second.'],
    },
    {
      kind: 'challenge', concept: 'envelope-decay',
      instruction: 'Make a tight, ticking hit: very short, with a sharp start - like a closed hi-hat.',
      checklist: [
        { text: 'VCA DECAY under 100 ms', check: s => num(s, 'vca_decay') < 100 },
        { text: 'VCA EG on FAST', check: s => num(s, 'vca_attack_mode') === 0 },
      ],
      hints: ['Which switch decides how sharply it starts?', 'Then make it ring for less than a tenth of a second.', 'VCA EG on FAST, VCA DECAY around 50 ms.'],
      solution: { values: { vca_decay: 50, vca_attack_mode: 0 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between TEMPO and VCA DECAY?',
        model: 'TEMPO decides when each hit starts (how far apart they are); VCA DECAY decides how long each hit keeps sounding.',
      },
    },
  ],
  review: [
    { question: 'A closed hi-hat needs a…', options: ['Short VCA DECAY', 'Long VCA DECAY', 'SLOW attack'], answer: 0, explain: 'It is choked quickly.' },
    { question: 'The DFAM\'s VCA EG switch changes…', options: ['The attack (1 ms or 100 ms)', 'The decay', 'The tempo'], answer: 0, explain: 'FAST = 1 ms, SLOW = 100 ms.' },
    { question: 'If VCA DECAY is longer than the gap between steps…', options: ['The hits overlap', 'Steps are skipped', 'The tempo slows down'], answer: 0, explain: 'Each hit is still ringing when the next starts.' },
  ],
};

const f5: Lesson = {
  id: 'dfam-f5-envelopes', device: 'dfam', path: 'foundations', order: O(5), difficulty: 'beginner',
  name: 'Envelopes as modulation: from beep to drum',
  description: 'The VCO EG and VCF EG move pitch and brightness on every hit.',
  objective: 'Use the VCO EG and VCF EG to sweep pitch and brightness on every hit.',
  source: 'Synth Studio · DFAM manual, VCO EG and VCF EG sections', estimatedMinutes: 7,
  prerequisites: ['dfam-f4-vca'],
  concepts: ['modulation-depth', 'envelope-decay', 'modulation-source', 'filter-cutoff'],
  start: { reset: true, values: { vco1_frequency: -1, vco1_level: 85, vca_decay: 500, vcf_cutoff: 600, vcf_decay: 120, tempo: 60, ...seq(undefined, BEATS) } },
  steps: [
    run('Every hit fires three envelopes at once: one for the VCA, one for pitch and one for the filter.'),
    {
      kind: 'predict', control: 'vco1_eg_amount', targetValue: 50, concept: 'modulation-depth',
      instruction: 'Turn VCO 1 EG AMOUNT up to about +50%.',
      predict: {
        question: 'The VCO envelope jumps up on every hit and then decays. What will VCO 1\'s pitch do?',
        options: ['Start high and fall quickly - a drum thump', 'Rise slowly', 'Nothing - envelopes only change volume'], answer: 0,
        explain: 'The amount knob sends the envelope to VCO 1\'s pitch. Each hit starts high and falls back to the note, and that fast fall is the "thump" of a drum. The same kind of envelope that shapes loudness can shape anything.',
      },
      principle: 'An envelope routed to pitch makes each note start sharp and fall: the classic drum thump.',
      manualReference: 'Manual: VCO EG - VCO EG AMOUNT',
    },
    {
      kind: 'do', control: 'vco_decay', targetValue: 400, concept: 'envelope-decay',
      instruction: 'Turn VCO DECAY up to about 400 ms.',
      principle: 'The envelope\'s decay sets how fast the sweep falls: short is a punch, long is a zap.',
      explanation: 'With a slow sweep you hear the pitch slide as a "pew", the laser sound of 80s drum machines.',
      manualReference: 'Manual: VCO EG - VCO DECAY',
    },
    {
      kind: 'do', control: 'vco_decay', targetValue: 50, concept: 'envelope-decay',
      instruction: 'Bring VCO DECAY back down to about 50 ms.',
      principle: 'A sweep faster than about 50 ms stops sounding like a slide and becomes punch.',
    },
    {
      kind: 'listen', concept: 'modulation-depth', focus: ['vco1_eg_amount'],
      instruction: 'Compare no pitch sweep with a pitch sweep.',
      listen: {
        a: { vco1_eg_amount: 0 }, b: { vco1_eg_amount: 50 }, labels: ['No sweep', 'Sweep'],
        question: {
          question: 'Which one sounds more like a drum?',
          options: ['The sweep', 'No sweep', 'They sound the same'], answer: 0,
          explain: 'Real drum skins are tighter, and so higher, at the moment they are struck. The fast pitch drop tells your ear "something was hit".',
        },
      },
    },
    {
      kind: 'predict', control: 'vco1_eg_amount', targetValue: -50, concept: 'modulation-depth',
      instruction: 'Turn VCO 1 EG AMOUNT counter-clockwise to about -50%.',
      predict: {
        question: 'A negative amount flips the envelope upside down. What will each hit do?',
        options: ['Dip below the note and rise back', 'Get quieter', 'Jump even higher'], answer: 0,
        explain: 'The same envelope, inverted, pulls the pitch down first and lets it rise back. That gives a "bloop" or a reversed-sounding hit.',
      },
      principle: 'A negative modulation amount inverts the envelope, so the pitch dips and recovers.',
    },
    {
      kind: 'do', control: 'vco1_eg_amount', targetValue: 40, concept: 'modulation-depth',
      instruction: 'Set VCO 1 EG AMOUNT back to about +40%.',
      principle: 'Small positive amounts give punch without an obvious slide.',
    },
    {
      kind: 'do', control: 'vcf_eg_amount', targetValue: 50, concept: 'filter-cutoff',
      instruction: 'Turn VCF EG AMOUNT up to about +50%.',
      principle: 'An envelope on the cutoff opens the filter at each hit\'s start: bright attack, dark tail.',
      explanation: 'The VCF EG has its own VCF DECAY. Short decays give a click, longer ones a "pluck", as on an acid bassline.',
      manualReference: 'Manual: VCF EG - VCF EG AMOUNT',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'modulation-source',
      quiz: {
        question: 'You want a bright click at the start of a kick but a dark tail. Which control does it?',
        options: ['VCF EG AMOUNT with a short VCF DECAY', 'A longer VCA DECAY', 'More RESONANCE'], answer: 0,
        explain: 'The filter envelope opens the filter only for an instant, giving brightness at the start and darkness afterwards. A longer VCA DECAY only makes the whole hit longer.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: how fast is the pitch sweep?', concept: 'envelope-decay',
      match: { target: { vco1_eg_amount: 40, vco_decay: 220 }, controls: ['vco_decay'] },
      hints: ['Is the target a punch or a slide?', 'It slides, but not as far as a laser.', 'VCO DECAY around 200 ms.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What changes when an envelope goes to pitch or to the filter instead of to the volume?',
        model: 'The same rise-and-fall shape now moves the pitch (a thump or a zap) or the brightness (a click or a pluck) on every hit, instead of the loudness.',
      },
    },
  ],
  review: [
    { question: 'A kick\'s "thump" comes mainly from…', options: ['A fast pitch drop from the VCO EG', 'A long VCA DECAY', 'High RESONANCE'], answer: 0, explain: 'VCO EG AMOUNT plus a short VCO DECAY.' },
    { question: 'A long VCO DECAY with a big EG AMOUNT sounds like…', options: ['A laser zap', 'A closed hi-hat', 'Silence'], answer: 0, explain: 'You hear the slide.' },
    { question: 'A negative EG AMOUNT makes the pitch…', options: ['Dip down and rise back', 'Jump up and fall', 'Stay still'], answer: 0, explain: 'The envelope is inverted.' },
    { question: 'Which envelope adds a bright click without changing pitch?', options: ['VCF EG', 'VCO EG', 'None'], answer: 0, explain: 'It opens the filter briefly.' },
  ],
};

const f6: Lesson = {
  id: 'dfam-f6-sequencer', device: 'dfam', path: 'foundations', order: O(6), difficulty: 'beginner',
  name: 'The sequencer: steps, TEMPO and VELOCITY',
  description: 'Program the 8 steps: tempo, pitch, accents, rests - and ADVANCE vs TRIGGER.',
  objective: 'Program the 8 steps: set the tempo, change pitches and use velocity for accents and rests.',
  source: 'Synth Studio · DFAM manual, Sequencer section', estimatedMinutes: 7,
  prerequisites: ['dfam-f5-envelopes'],
  concepts: ['sequencer-pattern', 'timing-tempo', 'velocity-dynamics'],
  start: { reset: true, values: { vco1_frequency: -0.5, vco1_eg_amount: 30, vco_decay: 40, vca_decay: 200, tempo: 120 } },
  steps: [
    run(),
    {
      kind: 'predict', control: 'tempo', targetValue: 60, concept: 'timing-tempo',
      instruction: 'Turn TEMPO down to about 60 BPM.',
      predict: {
        question: 'The DFAM counts each step as a 16th note. At 60 BPM, how many steps play each second?',
        options: ['4', '1', '8'], answer: 0,
        explain: '60 beats a minute is one beat a second, and a beat holds four 16th notes. So 4 steps a second, and the 8-step loop lasts 2 seconds.',
      },
      principle: 'A clock divides time into equal steps; halve the tempo and every step lasts twice as long.',
      manualReference: 'Manual: Sequencer - TEMPO',
    },
    {
      kind: 'do', control: 'pitch_5', targetValue: 1, concept: 'sequencer-pattern',
      instruction: 'Turn PITCH 5 up to +12 st (one octave up).',
      principle: 'Each step stores a pitch voltage; the sequencer plays the list in order and loops.',
      explanation: 'The PITCH knobs span ten octaves. The readout shows semitones (st): 12 st is one octave. Hover over a knob to see its value.',
      manualReference: 'Manual: Sequencer - PITCH 1-8',
    },
    {
      kind: 'do', control: 'velocity_2', targetValue: 0, concept: 'velocity-dynamics',
      instruction: 'Turn VELOCITY 2 all the way down.',
      principle: 'A velocity of zero is a rest: the step still passes in time, but nothing sounds.',
      manualReference: 'Manual: Sequencer - VELOCITY 1-8',
    },
    {
      kind: 'do', control: 'velocity_4', targetValue: 40, concept: 'velocity-dynamics',
      instruction: 'Turn VELOCITY 4 to about 40%.',
      principle: 'Quiet "ghost" steps make the loud ones feel stronger; groove is a pattern of strong and weak.',
      explanation: 'On the DFAM, velocity scales all three envelopes. A soft step is quieter, but it also gets a smaller pitch thump and a darker filter, like a lighter hit on a real drum.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: {
        question: 'VELOCITY 1 and 5 are at 100% and the rest at 30%. Where do the accents fall?',
        options: ['On each beat', 'Between the beats', 'Nowhere - all steps are equal'], answer: 0,
        explain: 'Eight 16th steps make two beats. Steps 1 and 5 start each beat, so the accents mark the pulse.',
      },
    },
    {
      kind: 'predict', control: 'run_stop', targetValue: false, concept: 'sequencer-pattern',
      instruction: 'Press RUN / STOP to stop the sequencer.',
      predict: {
        question: 'When you start it again, where will it carry on from?',
        options: ['The step it stopped on', 'Always step 1', 'A random step'], answer: 0,
        explain: 'The DFAM carries on from wherever it is. To start on step 1, park it on step 8 with ADVANCE: the first clock moves it to step 1 and then plays it.',
      },
      principle: 'A step sequencer remembers its position; starting moves to the next step and plays it.',
    },
    {
      kind: 'info', concept: 'sequencer-pattern', focus: ['advance', 'trigger'],
      instruction: 'Press ADVANCE until step 8\'s light is on, then press TRIGGER a few times.',
      principle: 'ADVANCE moves without playing and TRIGGER plays without moving, so you can tune one step at a time.',
      explanation: 'This is how you tune a DFAM pattern while it is stopped. Pick a step with ADVANCE, then TRIGGER it while you turn that step\'s PITCH knob.',
      manualReference: 'Manual: Sequencer - ADVANCE and TRIGGER',
    },
    {
      kind: 'challenge', concept: 'velocity-dynamics',
      instruction: 'Program a beat: hits on steps 1, 3, 5 and 7, rests on 2, 4, 6 and 8 - and make step 1 the loudest.',
      checklist: [
        { text: 'Steps 2, 4, 6 and 8 silent', check: s => [2, 4, 6, 8].every(i => num(s, `velocity_${i}`) <= 5) },
        { text: 'Steps 3, 5 and 7 audible', check: s => [3, 5, 7].every(i => num(s, `velocity_${i}`) >= 20) },
        { text: 'Step 1 louder than 3, 5 and 7', check: s => [3, 5, 7].every(i => num(s, 'velocity_1') > num(s, `velocity_${i}`)) },
      ],
      hints: ['Velocity 0 is a rest.', 'Start with all odd steps at about 70% and the even ones at 0.', 'Then push VELOCITY 1 to 100%.'],
      solution: { values: seq(undefined, [100, 0, 70, 0, 70, 0, 70, 0]) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between a step\'s PITCH and its VELOCITY?',
        model: 'PITCH sets which note the step plays; VELOCITY sets how hard it is hit - loudness, sweep and brightness - and 0 makes it a rest.',
      },
    },
  ],
  review: [
    { question: 'At 120 BPM with 16th-note steps, how many steps play per second?', options: ['8', '2', '16'], answer: 0, explain: '2 beats per second × 4 sixteenths.' },
    { question: 'A step with VELOCITY 0…', options: ['Is a rest', 'Plays at full volume', 'Is skipped and shortens the loop'], answer: 0, explain: 'It still takes its time slot.' },
    { question: 'ADVANCE versus TRIGGER:', options: ['ADVANCE moves without playing; TRIGGER plays without moving', 'They do the same thing', 'ADVANCE plays; TRIGGER moves'], answer: 0, explain: 'Use them together to tune one step.' },
  ],
};

const f7: Lesson = {
  id: 'dfam-f7-patching', device: 'dfam', path: 'foundations', order: O(7), difficulty: 'intermediate',
  name: 'Patching: normals and your first cables',
  description: 'Hidden connections, how a cable replaces them, and the manual\'s Talking Drum.',
  objective: 'Explain what a normal is, and patch the sequencer and VCO 2 into new destinations.',
  source: 'Synth Studio · DFAM manual, Patch bay and preset "Talking Drum"', estimatedMinutes: 8,
  prerequisites: ['dfam-f6-sequencer'],
  concepts: ['signal-routing', 'modulation-source', 'filter-cutoff'],
  start: { reset: true, values: { vco1_frequency: -1, vco1_eg_amount: 20, vco_decay: 60, vco1_level: 60, vca_decay: 300, tempo: 90, seq_pitch_mod: 1, vcf_cutoff: 630, vcf_resonance: 25, ...seq([0, 3, 7, 5, 0, 10, 7, 12]) } },
  steps: [
    run('Semi-modular synths play with no cables, because the main path is wired inside.'),
    {
      kind: 'info', concept: 'signal-routing', focus: ['in_trigger', 'in_velocity', 'in_vcf_mod', 'out_pitch'],
      instruction: 'No cables, yet it plays: hidden wires called normals connect the clock to TRIGGER, the VELOCITY knobs to VELOCITY, and noise to VCF MOD.',
      principle: 'A normal is a default internal connection; a cable in that jack replaces it.',
      explanation: 'SEQ PITCH MOD is OFF, so the PITCH knobs are only reaching the PITCH output jack. Every hit is on the same note. Let\'s patch them somewhere.',
      manualReference: 'Manual: Patch bay',
    },
    {
      kind: 'predict', patchFrom: 'out_pitch', patchTo: 'in_vco1_cv', concept: 'signal-routing',
      instruction: 'Patch PITCH (bottom-right output) into VCO 1 CV.',
      predict: {
        question: 'PITCH carries each step\'s voltage. What will VCO 1 do?',
        options: ['Play the melody - its pitch follows the voltage', 'Get louder on high steps', 'Nothing - it is a drum'], answer: 0,
        explain: 'VCO 1 CV is a 1 volt-per-octave pitch input. Each step\'s voltage now transposes VCO 1, so the drum plays the PITCH knobs as a melody.',
      },
      principle: '1 V per octave: each extra volt into a pitch input raises the oscillator one octave.',
      manualReference: 'Manual: Patch bay - VCO 1 CV',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'What does "1 V per octave" mean?',
        options: ['Each extra volt raises the pitch one octave', 'The input needs exactly 1 volt', 'Each volt adds one semitone'], answer: 0,
        explain: 'It is a scale: +1 V is one octave up and +1/12 V is one semitone. That is why the PITCH readout can show semitones.',
      },
    },
    {
      kind: 'do', control: 'noise_vcf_mod', targetValue: 40, concept: 'modulation-source',
      instruction: 'Turn NOISE / VCF MOD up to about 40% and listen to the grit.',
      principle: 'Noise shaking a filter\'s cutoff makes the tone rough and unstable - lo-fi crunch.',
      explanation: 'The knob sets how much of the noise normal reaches the cutoff.',
      manualReference: 'Manual: VCF - NOISE / VCF MOD',
    },
    {
      kind: 'predict', patchFrom: 'out_vco2', patchTo: 'in_vcf_mod', concept: 'signal-routing',
      instruction: 'Patch VCO 2 (output) into VCF MOD.',
      predict: {
        question: 'A cable in VCF MOD replaces its normal. What happens to the grit?',
        options: ['It stops - VCO 2 replaces the noise', 'It gets twice as gritty', 'Nothing changes'], answer: 0,
        explain: 'VCF MOD is normalled to the noise. With VCO 2 plugged in, the knob sets how hard VCO 2\'s wave moves the cutoff instead. At audio rate that sweeps out vowel-like tones.',
      },
      principle: 'Plugging into a normalled input disconnects the internal signal it was receiving.',
    },
    {
      kind: 'do', control: 'noise_vcf_mod', targetValue: 100, concept: 'filter-cutoff',
      instruction: 'Turn NOISE / VCF MOD fully up to hear the drum "talk".',
      principle: 'An oscillator moving a filter\'s cutoff very fast creates vowel-like formants.',
      explanation: 'This is the DFAM manual\'s preset "Talking Drum". The higher the knob, the more vocal the drum sounds.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Why did patching VCO 2 into VCF MOD remove the noise grit?',
        options: ['The cable replaced the normalled noise', 'VCO 2 is louder than the noise', 'The cable switched the noise off in the mixer'], answer: 0,
        explain: 'Only the VCF MOD normal was broken. Noise in the mixer, set by NOISE / EXT LEVEL, is a separate path and is still there.',
      },
    },
    {
      kind: 'challenge', concept: 'modulation-source',
      instruction: 'Give every step its own vowel: send the sequencer to VCO 2 only, keeping the VCO 2 to VCF MOD cable.',
      checklist: [
        { text: 'SEQ PITCH MOD on VCO 2', check: s => num(s, 'seq_pitch_mod') === 2 },
        { text: 'VCO 2 → VCF MOD cable', check: s => cable(s, 'out_vco2', 'in_vcf_mod') },
        { text: 'NOISE / VCF MOD at least 60%', check: s => num(s, 'noise_vcf_mod') >= 60 },
      ],
      hints: ['The vowel follows VCO 2\'s pitch.', 'Which switch decides where the PITCH knobs go?', 'SEQ PITCH MOD down to VCO 2.'],
      solution: { values: { seq_pitch_mod: 2, noise_vcf_mod: 100 }, patches: [{ from: 'out_vco2', to: 'in_vcf_mod' }] },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is a normal, and what happens when you plug a cable into a normalled jack?',
        model: 'A normal is a hidden default connection inside the synth; plugging a cable into that input breaks it, so the cable\'s signal replaces the internal one.',
      },
    },
  ],
  review: [
    { question: 'A normalled input with a cable in it…', options: ['Uses the cable instead of its internal signal', 'Adds both signals', 'Ignores the cable'], answer: 0, explain: 'The cable breaks the normal.' },
    { question: 'The DFAM\'s VCF MOD jack is normalled to…', options: ['The noise generator', 'VCO 1', 'The VCA EG'], answer: 0, explain: 'NOISE / VCF MOD sets its depth.' },
    { question: '+1 V into a 1 V/oct input raises the pitch by…', options: ['One octave', 'One semitone', 'Nothing'], answer: 0, explain: '1 V per octave.' },
    { question: 'An oscillator moving the filter cutoff at audio rate makes…', options: ['Vowel-like, talking tones', 'A slower tempo', 'Pure silence'], answer: 0, explain: 'That is the Talking Drum.' },
  ],
};

// ============================================================================
// SOUND DESIGN
// ============================================================================

const sd1: Lesson = {
  id: 'dfam-sd1-kick', device: 'dfam', path: 'sound-design', order: O(8), difficulty: 'beginner',
  name: 'Design a kick drum',
  description: 'The DFAM kick: pitch-sweep depth, sweep speed and length.',
  objective: 'Build a punchy kick from three controls: sweep depth, sweep speed and length.',
  source: 'Synth Studio · community DFAM kick technique', estimatedMinutes: 6,
  prerequisites: ['dfam-f5-envelopes'],
  concepts: ['modulation-depth', 'envelope-decay', 'filter-cutoff'],
  start: { reset: true, values: { vco1_frequency: -1.5, vco1_level: 90, vcf_cutoff: 900, vcf_decay: 50, vca_decay: 300, tempo: 120, ...seq(undefined, BEATS) } },
  steps: [
    {
      kind: 'listen', concept: 'modulation-depth', focus: ['vco1_eg_amount', 'vco_decay', 'vca_decay'],
      instruction: 'Here is where you are going. Compare the plain low beep with the finished kick.',
      listen: { a: {}, b: { vco1_eg_amount: 45, vco_decay: 45, vca_decay: 420, vcf_eg_amount: 25 }, labels: ['Now', 'Goal'] },
    },
    run('A kick is a low oscillator plus a very fast pitch drop and a medium tail.'),
    {
      kind: 'predict', control: 'vco1_eg_amount', targetValue: 45, concept: 'modulation-depth',
      instruction: 'Turn VCO 1 EG AMOUNT up to about +45%.',
      predict: {
        question: 'What turns this low beep into a kick?',
        options: ['A fast pitch drop at the start - the thump', 'A longer tail', 'More volume'], answer: 0,
        explain: 'The drop from high to low at the start of the note is what the ear reads as the beater hitting the skin. The tail only adds length.',
      },
      principle: 'Kick punch is a fast downward pitch sweep at the start of a low note.',
    },
    {
      kind: 'do', control: 'vco_decay', targetValue: 45, concept: 'envelope-decay',
      instruction: 'Set VCO DECAY to about 45 ms.',
      principle: 'The shorter the sweep, the harder the thud; a long sweep becomes a zap.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: {
        question: 'Your kick sounds like a laser "pew". Which knob is too high?',
        options: ['VCO DECAY', 'VCA DECAY', 'CUTOFF'], answer: 0,
        explain: 'A slow pitch sweep is heard as a slide. Shorten VCO DECAY. VCA DECAY only changes how long the tail rings.',
      },
    },
    {
      kind: 'do', control: 'vca_decay', targetValue: 420, concept: 'envelope-decay',
      instruction: 'Set VCA DECAY to about 420 ms for a full, round tail.',
      principle: 'The tail\'s length decides whether a kick is tight (house, techno) or booming (808, hip-hop).',
    },
    {
      kind: 'do', control: 'vcf_eg_amount', targetValue: 25, concept: 'filter-cutoff',
      instruction: 'Turn VCF EG AMOUNT to about +25% for the beater click.',
      principle: 'A quick filter envelope adds attack brightness - the click - without changing the pitch.',
      explanation: 'VCF DECAY is already short (50 ms), so the filter opens for just an instant on each hit.',
    },
    {
      kind: 'match', instruction: 'Ear challenge: match this 808-style boom.', concept: 'envelope-decay',
      match: { target: { vco1_eg_amount: 22, vco_decay: 110, vca_decay: 1500 }, controls: ['vco_decay', 'vca_decay'] },
      hints: ['Two questions: how fast does the pitch fall, and how long does it ring?', 'It rings far longer than your kick, and the sweep is slower.', 'VCO DECAY around 110 ms, VCA DECAY around 1.5 s.'],
    },
    {
      kind: 'challenge', concept: 'modulation-depth',
      instruction: 'Make a kick for fast techno: short enough not to boom between beats, with a clear punch.',
      checklist: [
        { text: 'VCA DECAY 450 ms or less', check: s => num(s, 'vca_decay') <= 450 },
        { text: 'VCO 1 EG AMOUNT at least +30%', check: s => num(s, 'vco1_eg_amount') >= 30 },
        { text: 'VCO DECAY 80 ms or less', check: s => num(s, 'vco_decay') <= 80 },
      ],
      hints: ['Punch needs a big, fast pitch drop.', 'Shorten the tail so it ends before the next beat.', 'VCO 1 EG AMOUNT about +45%, VCO DECAY about 45 ms, VCA DECAY about 350 ms.'],
      solution: { values: { vco1_eg_amount: 45, vco_decay: 45, vca_decay: 350 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Which two controls make the kick\'s punch, and what does each do?',
        model: 'VCO 1 EG AMOUNT sets how far the pitch drops (the size of the thump) and VCO DECAY sets how fast it drops (punch when short, zap when long).',
      },
    },
  ],
  review: [
    { question: 'The size of a kick\'s thump is set by…', options: ['VCO 1 EG AMOUNT', 'VOLUME', 'TEMPO'], answer: 0, explain: 'How far the pitch drops.' },
    { question: 'An 808-style boom has…', options: ['A long VCA DECAY', 'A very short VCA DECAY', 'High-pass filtering'], answer: 0, explain: 'It rings for a second or more.' },
    { question: 'The click of a kick can come from…', options: ['A short VCF EG', 'A long VCO DECAY', 'SLOW attack'], answer: 0, explain: 'A brief filter opening.' },
  ],
};

const sd2: Lesson = {
  id: 'dfam-sd2-snare-clap', device: 'dfam', path: 'sound-design', order: O(9), difficulty: 'intermediate',
  name: 'Snares and claps: tone plus noise',
  description: 'Balance a drum tone against noise, then patch an envelope into NOISE LEVEL for a clap.',
  objective: 'Balance a drum tone against noise for a snare, and patch the VCA EG into NOISE LEVEL for a clap.',
  source: 'Synth Studio · community DFAM snare and clap techniques', estimatedMinutes: 7,
  prerequisites: ['dfam-f2-mixer-noise', 'dfam-sd1-kick'],
  concepts: ['noise', 'mixing', 'signal-routing', 'envelope-decay'],
  start: { reset: true, values: { vco1_frequency: 0.25, vco1_eg_amount: 28, vco_decay: 35, vco1_level: 70, vco2_frequency: 0.85, vco2_eg_amount: 20, vcf_cutoff: 6500, vcf_eg_amount: 25, vcf_decay: 80, vca_decay: 170, tempo: 100, ...seq(undefined, [0, 0, 0, 0, 100, 0, 0, 0]) } },
  steps: [
    run('A snare sits on the backbeat: here step 5, the second beat of the loop.'),
    {
      kind: 'predict', control: 'noise_level', targetValue: 75, concept: 'noise',
      instruction: 'Turn NOISE / EXT LEVEL up to about 75%.',
      predict: {
        question: 'Which part of a real snare does the noise copy?',
        options: ['The rattling wires under the drum', 'The wooden shell', 'The drummer\'s stick'], answer: 0,
        explain: 'Snare wires buzz against the bottom skin with a noisy hiss. The shell and skin give the pitched body, which is VCO 1 here.',
      },
      principle: 'Noise copies the buzz of snare wires; the oscillator copies the drum\'s body.',
    },
    {
      kind: 'do', control: 'vco2_level', targetValue: 40, concept: 'mixing',
      instruction: 'Turn VCO 2 LEVEL up to about 40% for a second body tone.',
      principle: 'Two tones that are not an octave apart sound like the overtones of a real drum shell.',
      explanation: 'Classic drum-machine snares use two tones around 180 and 330 Hz for the same reason.',
    },
    {
      kind: 'listen', concept: 'noise', focus: ['vco1_level', 'vco2_level', 'noise_level'],
      instruction: 'Compare the snare with the noise alone.',
      listen: {
        a: {}, b: { vco1_level: 0, vco2_level: 0 }, labels: ['Tone + noise', 'Noise only'],
        question: {
          question: 'Which one sounds like a drum rather than a hiss?',
          options: ['Tone + noise', 'Noise only'], answer: 0,
          explain: 'Without the tone there is nothing for the ear to hear as a drum body, so the noise alone sounds like a burst of air.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'mixing',
      quiz: {
        question: 'Your snare sounds like a tom with a little hiss. What do you turn up?',
        options: ['NOISE / EXT LEVEL', 'VCO 1 LEVEL', 'VCO DECAY'], answer: 0,
        explain: 'More noise moves the balance from tom to snare. More VCO 1 would make it even more tom-like.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: match this snare\'s balance and length.', concept: 'mixing',
      match: { target: { noise_level: 40, vca_decay: 400 }, controls: ['noise_level', 'vca_decay'] },
      hints: ['Is there more or less hiss than yours, and does it ring longer?', 'Less noise, longer tail: a fatter, rounder snare.', 'NOISE / EXT LEVEL around 40%, VCA DECAY around 400 ms.'],
    },
    {
      kind: 'patch', patchFrom: 'out_vca_eg', patchTo: 'in_noise_level', concept: 'signal-routing',
      setup: { vco1_level: 0, vco2_level: 0, noise_level: 25, vcf_cutoff: 1800, vcf_resonance: 40, vcf_eg_amount: 30, vcf_decay: 60, vca_decay: 190 },
      instruction: 'Now a clap: noise only, filtered. Patch VCA EG into NOISE LEVEL.',
      principle: 'An envelope patched into a level control makes that sound fade faster - a sharp slap.',
      explanation: 'Now the noise level falls along with the VCA envelope, as well as being shaped by it. The burst dies fast, like the slap of hands, and the resonant filter centres it around 1.8 kHz.',
      manualReference: 'Manual: Patch bay - NOISE LEVEL, VCA EG',
    },
    {
      kind: 'challenge', concept: 'noise',
      instruction: 'Tune the clap: noise only, centred between about 800 Hz and 3 kHz, with a ringing body.',
      checklist: [
        { text: 'VCA EG → NOISE LEVEL cable', check: s => cable(s, 'out_vca_eg', 'in_noise_level') },
        { text: 'VCO 1 and VCO 2 LEVEL at 0', check: s => num(s, 'vco1_level') <= 3 && num(s, 'vco2_level') <= 3 },
        { text: 'CUTOFF between 800 Hz and 3 kHz', check: s => num(s, 'vcf_cutoff') >= 800 && num(s, 'vcf_cutoff') <= 3000 },
        { text: 'RESONANCE at least 25%', check: s => num(s, 'vcf_resonance') >= 25 },
      ],
      hints: ['A clap\'s energy sits in the upper mids.', 'Resonance gives the band a "body".', 'CUTOFF about 1.5 kHz, RESONANCE about 45%.'],
      solution: { values: { vco1_level: 0, vco2_level: 0, vcf_cutoff: 1500, vcf_resonance: 45 }, patches: [{ from: 'out_vca_eg', to: 'in_noise_level' }] },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does patching the VCA EG into NOISE LEVEL change about the noise?',
        model: 'The noise level now follows the envelope too, so the noise is loudest at the start and dies away faster than the VCA - a short, sharp slap.',
      },
    },
  ],
  review: [
    { question: 'In a snare patch, noise copies…', options: ['The wires', 'The shell', 'The room'], answer: 0, explain: 'Noise is the buzz of the wires.' },
    { question: 'Two VCOs that are not an octave apart give a snare…', options: ['A more drum-like body', 'More hiss', 'A longer decay'], answer: 0, explain: 'Like a drum\'s inharmonic overtones.' },
    { question: 'An envelope patched into NOISE LEVEL makes the noise…', options: ['Fade along with the envelope', 'Stay constant', 'Change pitch'], answer: 0, explain: 'The level follows the CV.' },
  ],
};

const sd3: Lesson = {
  id: 'dfam-sd3-hats', device: 'dfam', path: 'sound-design', order: O(10), difficulty: 'intermediate',
  name: 'Hi-hats and the Quick Hats patch',
  description: 'High-pass noise for closed and open hats, then the manual\'s PITCH to VCA DECAY trick.',
  objective: 'Make closed and open hats with high-pass noise, then let the PITCH knobs set each hat\'s length.',
  source: 'Synth Studio · DFAM manual preset "Quick Hats"', estimatedMinutes: 7,
  prerequisites: ['dfam-f3-filter', 'dfam-f4-vca'],
  concepts: ['filter-type', 'noise', 'envelope-decay', 'signal-routing'],
  start: { reset: true, values: { vco1_level: 0, noise_level: 100, vcf_cutoff: 2000, vcf_resonance: 25, vca_decay: 45, tempo: 120, ...seq(undefined, [100, 55, 80, 55, 100, 55, 80, 55]) } },
  steps: [
    run('Hats are short bursts of bright noise, usually on every 8th or 16th note.'),
    {
      kind: 'predict', control: 'vcf_mode', targetValue: 0, concept: 'filter-type',
      instruction: 'Flip the VCF switch up to HP.',
      predict: {
        question: 'High-pass removes everything below CUTOFF. What happens to the noise bursts?',
        options: ['Thinner and sizzlier - like a hi-hat', 'Deeper and boomier', 'They become pitched'], answer: 0,
        explain: 'Removing the lows leaves only the bright sizzle. Cymbals and hats have almost no low end, and that is why they cut through a mix.',
      },
      principle: 'High-passed noise sounds like metal: all sizzle, no body.',
    },
    {
      kind: 'do', control: 'vcf_cutoff', targetValue: 7500, concept: 'filter-cutoff',
      instruction: 'Raise CUTOFF to about 7.5 kHz.',
      principle: 'In high-pass mode the cutoff is a floor: the higher it is, the thinner and smaller the hat.',
    },
    {
      kind: 'listen', concept: 'envelope-decay', focus: ['vca_decay'],
      instruction: 'Compare a closed and an open hat.',
      listen: {
        a: { vca_decay: 45 }, b: { vca_decay: 600 }, labels: ['Closed', 'Open'],
        question: {
          question: 'What makes the open hat "open"?',
          options: ['It rings longer', 'It is higher', 'It is louder'], answer: 0,
          explain: 'An open hat\'s two cymbals ring freely; closing them chokes the ring almost at once. The tone is the same and only the decay changes.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: {
        question: 'On the DFAM, closed and open hats differ mainly in…',
        options: ['VCA DECAY', 'CUTOFF', 'TEMPO'], answer: 0,
        explain: 'Same noise, same filter, different length. Next you will give each step its own length.',
      },
    },
    {
      kind: 'do', control: 'seq_pitch_mod', targetValue: 1, concept: 'signal-routing',
      instruction: 'Set SEQ PITCH MOD to OFF (middle).',
      principle: 'With SEQ PITCH MOD off, the PITCH row becomes a free voltage you can patch anywhere.',
      explanation: 'The VCOs are silent here anyway. With the switch OFF, the PITCH knobs only reach the PITCH output jack.',
      manualReference: 'Manual: VCO EG - SEQ PITCH MOD',
    },
    {
      kind: 'patch', patchFrom: 'out_pitch', patchTo: 'in_vca_decay', concept: 'signal-routing',
      setup: { vca_decay: 320, ...seq([-36, -36, -36, -36, -36, -36, -36, -36]) },
      instruction: 'Patch PITCH into VCA DECAY. (The PITCH knobs are now all turned low.)',
      principle: 'A different voltage on every step into a decay input gives every step its own length.',
      explanation: 'This is the manual\'s Quick Hats preset. A low PITCH knob shortens that step\'s VCA DECAY and a high one lengthens it. Each volt doubles or halves the time.',
      manualReference: 'Manual: preset "Quick Hats" (p.33)',
    },
    {
      kind: 'do', control: 'pitch_3', targetValue: 1, concept: 'envelope-decay',
      instruction: 'Turn PITCH 3 up to about +12 st: step 3 becomes an open hat.',
      principle: 'Voltage is voltage: a "pitch" knob can just as well set a length.',
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Make the classic off-beat open hat: steps 3 and 7 open, every other step tight.',
      checklist: [
        { text: 'PITCH → VCA DECAY cable', check: s => cable(s, 'out_pitch', 'in_vca_decay') },
        { text: 'PITCH 3 and PITCH 7 high (open)', check: s => num(s, 'pitch_3') >= 0.5 && num(s, 'pitch_7') >= 0.5 },
        { text: 'All other PITCH knobs low (closed)', check: s => [1, 2, 4, 5, 6, 8].every(i => num(s, `pitch_${i}`) <= -1.5) },
      ],
      hints: ['Steps 3 and 7 are the "and" between beats.', 'Turn PITCH 7 up like PITCH 3.', 'PITCH 3 and 7 at about +12 st; leave the rest low.'],
      solution: { values: { pitch_3: 1, pitch_7: 1 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How did one cable give each step its own hi-hat length?',
        model: 'The PITCH output sends a different voltage on each step, and patched into VCA DECAY that voltage lengthens or shortens the decay of that step.',
      },
    },
  ],
  review: [
    { question: 'Hi-hats are usually made from…', options: ['High-passed noise', 'Low-passed square waves', 'A self-oscillating filter'], answer: 0, explain: 'All sizzle, no body.' },
    { question: 'An open hat differs from a closed one mainly in…', options: ['Decay length', 'Pitch', 'Filter mode'], answer: 0, explain: 'It rings longer.' },
    { question: 'In Quick Hats, the PITCH knobs control…', options: ['Each step\'s decay length', 'Each step\'s pitch', 'The tempo'], answer: 0, explain: 'PITCH is patched into VCA DECAY.' },
  ],
};

const sd4: Lesson = {
  id: 'dfam-sd4-metal', device: 'dfam', path: 'sound-design', order: O(11), difficulty: 'intermediate',
  name: 'Metal: FM and hard sync',
  description: 'Bells, clangs and sync zaps from two oscillators.',
  objective: 'Use 1→2 FM AMOUNT and HARD SYNC to turn two oscillators into bells, clangs and zaps.',
  source: 'Synth Studio · DFAM manual, VCO section and preset "FM Toys"', estimatedMinutes: 8,
  prerequisites: ['dfam-f1-oscillators', 'dfam-f5-envelopes'],
  concepts: ['frequency-modulation', 'oscillator-sync', 'signal-routing'],
  start: { reset: true, values: { vco1_frequency: 0.4, vco1_level: 0, vco2_frequency: 1.15, vco2_level: 90, vco_decay: 300, vcf_cutoff: 6000, vca_decay: 450, tempo: 60, ...seq(undefined, [100, 0, 100, 0, 100, 0, 100, 0]) } },
  steps: [
    run('FM and sync are two ways for one oscillator to reshape another\'s wave.'),
    {
      kind: 'predict', control: 'fm_amount', targetValue: 40, concept: 'frequency-modulation',
      instruction: 'Turn 1→2 FM AMOUNT up to about 40%.',
      predict: {
        question: 'VCO 1 now wobbles VCO 2\'s frequency hundreds of times a second. What will you hear?',
        options: ['New metallic overtones, like a bell', 'A slow vibrato', 'Two separate notes'], answer: 0,
        explain: 'When the wobble is too fast to hear as vibrato, it creates sidebands: new frequencies above and below VCO 2. They are rarely in tune with each other, so the tone sounds metallic.',
      },
      principle: 'Audio-rate frequency modulation creates sidebands, new partials that make tones metallic or bell-like.',
      manualReference: 'Manual: VCO section - 1→2 FM AMOUNT',
    },
    {
      kind: 'do', control: 'vco1_frequency', targetValue: 1, concept: 'frequency-modulation',
      instruction: 'Sweep VCO 1 FREQUENCY slowly up to about +1 and listen to the overtones change.',
      principle: 'FM timbre depends on the ratio between the two frequencies: simple ratios ring, odd ones clang.',
    },
    {
      kind: 'listen', concept: 'frequency-modulation', focus: ['fm_amount'],
      instruction: 'Compare no FM with a lot of FM.',
      listen: {
        a: { fm_amount: 0 }, b: { fm_amount: 70 }, labels: ['No FM', 'FM 70%'],
        question: {
          question: 'Which one has more clangy, bell-like partials?',
          options: ['FM 70%', 'No FM'], answer: 0,
          explain: 'More FM depth spreads energy into more sidebands, so the sound gets brighter and more metallic.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'frequency-modulation',
      quiz: {
        question: '1→2 FM AMOUNT controls…',
        options: ['How hard VCO 1 modulates VCO 2\'s frequency', 'The volume of VCO 1', 'The speed of the sequencer'], answer: 0,
        explain: 'VCO 1 is the modulator and VCO 2 is the carrier you hear. VCO 1 LEVEL is at 0, so you never hear VCO 1 directly.',
      },
    },
    {
      kind: 'do', control: 'fm_amount', targetValue: 0, concept: 'frequency-modulation',
      instruction: 'Turn 1→2 FM AMOUNT back down to 0.',
      principle: 'Turn off one effect before adding another, so you hear exactly what each does.',
    },
    {
      kind: 'predict', control: 'hard_sync', targetValue: 0, concept: 'oscillator-sync',
      instruction: 'Flip HARD SYNC to ON.',
      predict: {
        question: 'With sync on, VCO 2 restarts its wave every time VCO 1 starts a cycle. What sets the pitch now?',
        options: ['VCO 1 - VCO 2 only changes the tone', 'VCO 2 alone', 'Both - you hear two notes'], answer: 0,
        explain: 'VCO 2 is forced to repeat at VCO 1\'s rate, so VCO 1 sets the pitch. VCO 2\'s own frequency now decides how much of its wave fits into each cycle, and that changes the harmonics.',
      },
      principle: 'Hard sync locks the slave oscillator to the master\'s pitch; the slave\'s frequency becomes a timbre control.',
      manualReference: 'Manual: VCO section - HARD SYNC',
    },
    {
      kind: 'do', control: 'vco2_frequency', targetValue: 2.5, concept: 'oscillator-sync',
      instruction: 'Sweep VCO 2 FREQUENCY up to about +2.5: the pitch stays, the tone tears.',
      principle: 'Sweeping a synced oscillator gives the classic "tearing" sync sound.',
    },
    {
      kind: 'match', instruction: 'Ear challenge: is it FM, sync, or both?', concept: 'frequency-modulation',
      match: { target: { hard_sync: 1, fm_amount: 50 }, controls: ['hard_sync', 'fm_amount'] },
      hints: ['Does the target tear like sync, or ring like a bell?', 'The target is a clangy bell: no tearing.', 'HARD SYNC OFF and 1→2 FM AMOUNT about 50%.'],
    },
    {
      kind: 'patch', patchFrom: 'out_vco_eg', patchTo: 'in_vco2_cv', concept: 'signal-routing',
      setup: { hard_sync: 0, fm_amount: 0 },
      instruction: 'Sync is back on. Patch VCO EG into VCO 2 CV for a sync sweep on every hit.',
      principle: 'An envelope on the synced oscillator sweeps its harmonics on every hit: the sync zap.',
      explanation: 'VCO DECAY sets how long the sweep takes. Try it short for a "dzzt" and long for a siren.',
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do FM and hard sync each change VCO 2\'s sound?',
        model: 'FM wobbles VCO 2\'s frequency at audio rate and adds metallic sidebands; hard sync restarts VCO 2 with VCO 1, so VCO 2\'s frequency changes its harmonics instead of its pitch.',
      },
    },
  ],
  review: [
    { question: 'Audio-rate FM adds…', options: ['Sidebands - new metallic partials', 'A slower tempo', 'Noise'], answer: 0, explain: 'Frequencies above and below the carrier.' },
    { question: 'With hard sync on, VCO 2 FREQUENCY changes…', options: ['The tone, not the pitch', 'The pitch, not the tone', 'Nothing'], answer: 0, explain: 'VCO 1 sets the pitch.' },
    { question: 'FM clearest when HARD SYNC is…', options: ['Off', 'On', 'It makes no difference'], answer: 0, explain: 'Sync resets the phase every cycle and masks the FM.' },
  ],
};

// ============================================================================
// EAR TRAINING (graded difficulty, interleaved sections)
// ============================================================================

const EAR_BASE = { vco1_frequency: -0.5, vco1_eg_amount: 30, vco_decay: 40, vco1_level: 85, vcf_cutoff: 2000, vca_decay: 300, tempo: 60 };

const e1: Lesson = {
  id: 'dfam-e1-length', device: 'dfam', path: 'ear-training', order: O(12), difficulty: 'beginner',
  name: 'Ear training 1: long or short?',
  description: 'One control at a time, big differences: how long does it ring?',
  objective: 'Judge decay lengths by ear and set VCA DECAY and VCO DECAY to match.',
  source: 'Synth Studio · ear training', estimatedMinutes: 6,
  prerequisites: ['dfam-f5-envelopes'],
  concepts: ['envelope-decay'],
  start: { reset: true, values: { ...EAR_BASE, ...seq(undefined, BEATS) } },
  steps: [
    {
      kind: 'listen', concept: 'envelope-decay', focus: ['vca_decay'],
      instruction: 'Warm up your ears: compare a short hit with a long one. Listen to the tail, not the start.',
      listen: { a: { vca_decay: 80 }, b: { vca_decay: 1500 }, labels: ['Short', 'Long'] },
    },
    {
      kind: 'match', instruction: 'Round 1: how long does the target ring? Set VCA DECAY.', concept: 'envelope-decay',
      setup: { vca_decay: 300 },
      match: { target: { vca_decay: 1500 }, controls: ['vca_decay'], tolerance: 0.1 },
      hints: ['Count how long the tail lasts after each hit.', 'It rings far longer than yours.', 'VCA DECAY well over a second.'],
    },
    {
      kind: 'match', instruction: 'Round 2: set VCA DECAY to match the target.', concept: 'envelope-decay',
      setup: { vca_decay: 1000 },
      match: { target: { vca_decay: 70 }, controls: ['vca_decay'], tolerance: 0.1 },
      hints: ['Is there any tail at all?', 'It is a tick.', 'VCA DECAY under 100 ms.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: {
        question: 'Matching length by ear, what is the most reliable thing to listen to?',
        options: ['When the tail disappears', 'How loud the attack is', 'The pitch'], answer: 0,
        explain: 'Every hit starts the same, so compare when the sound fades into silence. Turning the VOLUME up can help you hear the very end of the tail.',
      },
    },
    {
      kind: 'match', instruction: 'Round 3: now the pitch sweep. Set VCO DECAY.', concept: 'envelope-decay',
      setup: { vco1_eg_amount: 60, vco_decay: 40, vca_decay: 600 },
      match: { target: { vco1_eg_amount: 60, vca_decay: 600, vco_decay: 400 }, controls: ['vco_decay'], tolerance: 0.1 },
      hints: ['Punch or laser?', 'You can hear the slide: it is slow.', 'VCO DECAY around 400 ms.'],
    },
    {
      kind: 'match', instruction: 'Round 4: VCA DECAY again, somewhere in the middle.', concept: 'envelope-decay',
      setup: { vca_decay: 1500 },
      match: { target: { vca_decay: 300 }, controls: ['vca_decay'], tolerance: 0.1 },
      hints: ['Shorter than yours, but not a tick.', 'About a third of a second.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What did you listen for to tell a VCO DECAY change from a VCA DECAY change?',
        model: 'VCO DECAY changes how fast the pitch slides at the start; VCA DECAY changes how long the whole sound keeps ringing.',
      },
    },
  ],
  review: [
    { question: 'A laser "pew" means VCO DECAY is…', options: ['Long', 'Short', 'At zero'], answer: 0, explain: 'You hear the slow slide.' },
    { question: 'To compare two decays by ear, listen to…', options: ['When each tail fades out', 'The attack', 'The tempo'], answer: 0, explain: 'The attacks are identical.' },
    { question: 'A tick with no tail has a VCA DECAY of about…', options: ['Under 100 ms', 'About 1 s', 'About 5 s'], answer: 0, explain: 'Very short.' },
  ],
};

const e2: Lesson = {
  id: 'dfam-e2-brightness', device: 'dfam', path: 'ear-training', order: O(13), difficulty: 'intermediate',
  name: 'Ear training 2: brightness, finer',
  description: 'One control, smaller differences: find the filter cutoff by ear.',
  objective: 'Set CUTOFF to within a small margin of a target by ear.',
  source: 'Synth Studio · ear training', estimatedMinutes: 6,
  prerequisites: ['dfam-e1-length', 'dfam-f3-filter'],
  concepts: ['filter-cutoff', 'filter-resonance'],
  start: { reset: true, values: { ...EAR_BASE, vco1_wave: 0, vco1_eg_amount: 15, vca_decay: 500, ...seq(undefined, BEATS) } },
  steps: [
    {
      kind: 'listen', concept: 'filter-cutoff', focus: ['vcf_cutoff'],
      instruction: 'Warm up: compare a cutoff of 800 Hz with 2.5 kHz. Listen to the top of the sound.',
      listen: {
        a: { vcf_cutoff: 800 }, b: { vcf_cutoff: 2500 }, labels: ['800 Hz', '2.5 kHz'],
        question: {
          question: 'How do the two differ?',
          options: ['B is brighter and more buzzy', 'B is higher in pitch', 'B is longer'], answer: 0,
          explain: 'The pitch is the same in both. The higher cutoff lets more harmonics through, so the tone is brighter.',
        },
      },
    },
    {
      kind: 'match', instruction: 'Round 1: set CUTOFF to match the target.', concept: 'filter-cutoff',
      setup: { vcf_cutoff: 4000 },
      match: { target: { vcf_cutoff: 900 }, controls: ['vcf_cutoff'] },
      hints: ['Darker or brighter than yours?', 'Much darker - just below 1 kHz.'],
    },
    {
      kind: 'match', instruction: 'Round 2: closer this time. Set CUTOFF.', concept: 'filter-cutoff',
      setup: { vcf_cutoff: 900 },
      match: { target: { vcf_cutoff: 2200 }, controls: ['vcf_cutoff'] },
      hints: ['Brighter than yours.', 'Around 2 kHz.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-cutoff',
      quiz: {
        question: 'Why does the CUTOFF knob feel "even" even though it goes from 20 Hz to 20 kHz?',
        options: ['It is logarithmic: each step of travel multiplies the frequency', 'It only uses the middle of the range', 'The filter ignores high frequencies'], answer: 0,
        explain: 'Hearing works in ratios. Each octave doubles the frequency, so the knob gives every octave the same amount of travel.',
      },
    },
    {
      kind: 'match', instruction: 'Round 3: with RESONANCE up the cutoff sings - match it.', concept: 'filter-resonance',
      setup: { vcf_resonance: 60, vcf_cutoff: 3000 },
      match: { target: { vcf_resonance: 60, vcf_cutoff: 600 }, controls: ['vcf_cutoff'] },
      hints: ['Listen for the ringing pitch of the resonance.', 'The target\'s ring is low.', 'Around 600 Hz.'],
    },
    {
      kind: 'match', instruction: 'Round 4: the finest one. Set CUTOFF.', concept: 'filter-cutoff',
      setup: { vcf_resonance: 60, vcf_cutoff: 600 },
      match: { target: { vcf_resonance: 60, vcf_cutoff: 1100 }, controls: ['vcf_cutoff'], tolerance: 0.07 },
      hints: ['A little brighter than yours.', 'Just above 1 kHz.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What helped you find the cutoff more precisely?',
        model: 'Comparing target and mine back to back, and listening to the resonant ring - it acts like a pitch I can match.',
      },
    },
  ],
  review: [
    { question: 'Raising CUTOFF changes…', options: ['Brightness', 'Pitch', 'Length'], answer: 0, explain: 'More harmonics pass.' },
    { question: 'With resonance up, the cutoff…', options: ['Rings at its own pitch', 'Stops working', 'Lowers the VCO'], answer: 0, explain: 'The ring is easy to hear and match.' },
    { question: 'The CUTOFF knob is logarithmic because…', options: ['We hear frequency in ratios', 'It saves power', 'Filters need it'], answer: 0, explain: 'Each octave gets equal travel.' },
  ],
};

const e3: Lesson = {
  id: 'dfam-e3-kick-space', device: 'dfam', path: 'ear-training', order: O(14), difficulty: 'intermediate',
  name: 'Ear training 3: two controls - the kick space',
  description: 'Pitch-sweep depth and speed together: recreate kicks, toms and zaps.',
  objective: 'Recreate drum hits by ear with VCO 1 EG AMOUNT and VCO DECAY together.',
  source: 'Synth Studio · ear training', estimatedMinutes: 7,
  prerequisites: ['dfam-e1-length', 'dfam-sd1-kick'],
  concepts: ['modulation-depth', 'envelope-decay'],
  start: { reset: true, values: { vco1_frequency: -1.4, vco1_level: 90, vcf_cutoff: 1200, vca_decay: 500, tempo: 60, ...seq(undefined, BEATS) } },
  steps: [
    {
      kind: 'listen', concept: 'modulation-depth', focus: ['vco1_eg_amount', 'vco_decay'],
      instruction: 'Two dimensions: compare a small fast sweep with a big slow one.',
      listen: {
        a: { vco1_eg_amount: 25, vco_decay: 30 }, b: { vco1_eg_amount: 70, vco_decay: 300 }, labels: ['Small and fast', 'Big and slow'],
        question: {
          question: 'Which knob made B sound like a laser?',
          options: ['VCO DECAY - the sweep is slow enough to hear', 'VCA DECAY', 'CUTOFF'], answer: 0,
          explain: 'EG AMOUNT is how far the pitch falls and VCO DECAY is how fast it falls. When the fall is slow, your ear hears it as a slide, a "pew".',
        },
      },
    },
    {
      kind: 'match', instruction: 'Round 1: a classic kick. Set both knobs.', concept: 'modulation-depth',
      setup: { vco1_eg_amount: 0, vco_decay: 300 },
      match: { target: { vco1_eg_amount: 45, vco_decay: 45 }, controls: ['vco1_eg_amount', 'vco_decay'] },
      hints: ['Find the speed first: punch or slide?', 'It is a punch, so the sweep is fast.', 'VCO 1 EG AMOUNT about +45%, VCO DECAY about 45 ms.'],
    },
    {
      kind: 'match', instruction: 'Round 2: a tom with a gentle bend.', concept: 'modulation-depth',
      setup: { vco1_eg_amount: 70, vco_decay: 30 },
      match: { target: { vco1_eg_amount: 20, vco_decay: 150 }, controls: ['vco1_eg_amount', 'vco_decay'] },
      hints: ['The bend is small but slow.', 'Less amount than yours, more decay.', 'About +20% and 150 ms.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'modulation-depth',
      quiz: {
        question: 'You hear a slide that drops a long way, slowly. Which settings?',
        options: ['Big EG AMOUNT, long VCO DECAY', 'Small EG AMOUNT, short VCO DECAY', 'Big EG AMOUNT, short VCO DECAY'], answer: 0,
        explain: 'Distance is EG AMOUNT and speed is VCO DECAY. Big plus short gives a hard punch; big plus long gives the slow dive.',
      },
    },
    {
      kind: 'match', instruction: 'Round 3: a zap.', concept: 'modulation-depth',
      setup: { vco1_eg_amount: 20, vco_decay: 40 },
      match: { target: { vco1_eg_amount: 85, vco_decay: 350 }, controls: ['vco1_eg_amount', 'vco_decay'] },
      hints: ['It starts very high.', 'A long, deep dive.', 'EG AMOUNT near +85%, VCO DECAY around 350 ms.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do you tell "how far" the pitch falls from "how fast" it falls?',
        model: 'How far is how high the hit starts above the note (EG AMOUNT); how fast is whether I hear a punch or a slide (VCO DECAY).',
      },
    },
  ],
  review: [
    { question: 'Kick punch = …', options: ['Moderate EG AMOUNT + short VCO DECAY', 'Big EG AMOUNT + long VCO DECAY', 'No EG'], answer: 0, explain: 'A fast drop.' },
    { question: 'EG AMOUNT sets…', options: ['How far the pitch moves', 'How fast it moves', 'How loud it is'], answer: 0, explain: 'Depth of the sweep.' },
    { question: 'VCO DECAY sets…', options: ['How fast the pitch sweep falls', 'The filter brightness', 'The tempo'], answer: 0, explain: 'Speed of the sweep.' },
  ],
};

const e4: Lesson = {
  id: 'dfam-e4-mixed', device: 'dfam', path: 'ear-training', order: O(15), difficulty: 'advanced',
  name: 'Ear training 4: what changed?',
  description: 'Three controls from different sections at once: filter, envelopes and mixer.',
  objective: 'Tell filter, envelope and mixer changes apart by ear and recreate a three-control target.',
  source: 'Synth Studio · ear training (interleaved)', estimatedMinutes: 8,
  prerequisites: ['dfam-e2-brightness', 'dfam-e3-kick-space'],
  concepts: ['filter-cutoff', 'envelope-decay', 'noise', 'filter-resonance'],
  start: { reset: true, values: { ...EAR_BASE, vco1_wave: 0, vco1_eg_amount: 35, vca_decay: 400, ...seq(undefined, BEATS) } },
  steps: [
    {
      kind: 'listen', concept: 'filter-cutoff', focus: ['vcf_cutoff', 'vca_decay'],
      instruction: 'A and B differ in ONE control. Listen carefully.',
      listen: {
        a: {}, b: { vca_decay: 1200 }, labels: ['A', 'B'],
        question: {
          question: 'What changed from A to B?',
          options: ['The length (VCA DECAY)', 'The brightness (CUTOFF)', 'The pitch sweep (VCO DECAY)'], answer: 0,
          explain: 'The start of each hit is identical and only the tail is longer, so that is an envelope change, not a filter change.',
        },
      },
    },
    {
      kind: 'listen', concept: 'filter-resonance', focus: ['vcf_resonance', 'vcf_cutoff'],
      instruction: 'Again: A and B differ in one control.',
      listen: {
        a: {}, b: { vcf_resonance: 75 }, labels: ['A', 'B'],
        question: {
          question: 'What changed from A to B?',
          options: ['RESONANCE - B rings at one pitch', 'CUTOFF - B is darker', 'NOISE - B hisses'], answer: 0,
          explain: 'B has a whistling ring that A lacks: that is resonance. A pure CUTOFF change would make the whole tone darker or brighter, with no ring.',
        },
      },
    },
    {
      kind: 'match', instruction: 'Round 1: three controls - brightness, length and hiss.', concept: 'filter-cutoff',
      setup: { vcf_cutoff: 4000, vca_decay: 150, noise_level: 0 },
      match: { target: { vcf_cutoff: 900, vca_decay: 700, noise_level: 40 }, controls: ['vcf_cutoff', 'vca_decay', 'noise_level'] },
      hints: ['Take them one at a time: hiss first, then length, then brightness.', 'The target has some hiss, rings longer and is darker.', 'NOISE about 40%, VCA DECAY about 700 ms, CUTOFF about 900 Hz.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: {
        question: 'A hit has a brighter START but the same tail. Which control most likely changed?',
        options: ['VCF EG AMOUNT', 'VCA DECAY', 'TEMPO'], answer: 0,
        explain: 'Brightness that only lasts for the start of the hit comes from the filter envelope. VCA DECAY would change the tail.',
      },
    },
    {
      kind: 'match', instruction: 'Round 2: ring, click and punch.', concept: 'filter-resonance',
      setup: { vcf_resonance: 0, vcf_eg_amount: 0, vco_decay: 150, noise_level: 0 },
      match: { target: { vcf_resonance: 55, vcf_eg_amount: 50, vco_decay: 40, vcf_decay: 80 }, controls: ['vcf_resonance', 'vcf_eg_amount', 'vco_decay'] },
      hints: ['Does the target ring? Does it click? Is the sweep a punch?', 'It rings a little, clicks at the start and punches.', 'RESONANCE about 55%, VCF EG AMOUNT about +50%, VCO DECAY about 40 ms.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How can you tell a filter change from an envelope change by ear?',
        model: 'A filter change alters the tone colour the whole time; an envelope change alters how the sound moves over time - the start (attack, sweep) or the tail (decay).',
      },
    },
  ],
  review: [
    { question: 'Same attack, longer tail means…', options: ['Longer VCA DECAY', 'Higher CUTOFF', 'More FM'], answer: 0, explain: 'An envelope change.' },
    { question: 'A new whistling ring at one pitch means…', options: ['More RESONANCE', 'More NOISE', 'Longer VCO DECAY'], answer: 0, explain: 'Resonance rings at the cutoff.' },
    { question: 'Brighter only at the start of each hit means…', options: ['More VCF EG AMOUNT', 'Higher CUTOFF', 'More VOLUME'], answer: 0, explain: 'The filter envelope.' },
    { question: 'The best order to match several controls is…', options: ['One at a time, the most obvious first', 'All at once', 'Randomly'], answer: 0, explain: 'Isolate and compare.' },
  ],
};

// ============================================================================
// SEQUENCING
// ============================================================================

const sq1: Lesson = {
  id: 'dfam-sq1-acid', device: 'dfam', path: 'sequencing', order: O(16), difficulty: 'intermediate',
  name: 'Melody and accents: an acid line',
  description: 'Program intervals in semitones and accents that open the filter.',
  objective: 'Program an 8-step bassline with intervals and accents that open the filter.',
  source: 'Synth Studio · DFAM manual, Sequencer (and the acid-house tradition)', estimatedMinutes: 8,
  prerequisites: ['dfam-f6-sequencer', 'dfam-f3-filter'],
  concepts: ['sequencer-pattern', 'velocity-dynamics', 'filter-resonance', 'oscillator-pitch'],
  start: { reset: true, values: { vco1_frequency: -1, vco1_wave: 0, vco1_level: 80, vco2_frequency: -0.985, vco2_wave: 0, vco2_level: 35, vcf_cutoff: 280, vcf_resonance: 72, vcf_eg_amount: 55, vcf_decay: 170, vca_decay: 260, tempo: 126 } },
  steps: [
    run('A bassline is rhythm plus intervals; the same note repeated is the starting point.'),
    {
      kind: 'predict', control: 'pitch_3', targetValue: 1, concept: 'oscillator-pitch',
      instruction: 'Turn PITCH 3 up to +12 st.',
      predict: {
        question: '+12 semitones is…',
        options: ['One octave up', 'Twelve octaves up', 'A fifth up'], answer: 0,
        explain: 'There are 12 semitones in an octave, and octave jumps are the backbone of acid and disco basslines. A fifth is 7 semitones.',
      },
      principle: 'Twelve semitones make an octave: the same note name, twice the frequency.',
    },
    {
      kind: 'do', control: 'pitch_5', targetValue: 0.25, concept: 'oscillator-pitch',
      instruction: 'Turn PITCH 5 to +3 st (a minor third).',
      principle: 'Intervals set the mood: a minor third (3 semitones) sounds dark, a major third (4) bright.',
      explanation: 'The knob covers ten octaves, so 3 semitones is a small turn. Watch the readout, and hold Shift on a desktop for fine moves.',
    },
    {
      kind: 'do', control: 'pitch_7', targetValue: 0.833, concept: 'oscillator-pitch',
      instruction: 'Turn PITCH 7 to +10 st (a minor seventh).',
      principle: 'A minor seventh pulls back toward the root, which is why basslines love it.',
    },
    {
      kind: 'predict', control: 'velocity_4', targetValue: 50, concept: 'velocity-dynamics',
      instruction: 'Turn VELOCITY 4 down to about 50%.',
      predict: {
        question: 'Velocity also scales the filter envelope. What happens to step 4 besides getting quieter?',
        options: ['It gets darker - less filter sweep', 'It gets brighter', 'Its pitch drops'], answer: 0,
        explain: 'On the DFAM velocity scales all three envelopes. A soft step gets a smaller filter sweep, so it is darker. Accents are louder and brighter, like a real accent.',
      },
      principle: 'An accent is louder and brighter; velocity scaling the filter envelope gives both at once.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'velocity-dynamics',
      quiz: {
        question: 'Why does an acid line need some quiet steps?',
        options: ['Contrast makes the loud, bright steps squelch', 'Quiet steps are faster', 'Quiet steps change the key'], answer: 0,
        explain: 'If every step is accented, nothing stands out. Groove comes from the difference between strong and weak steps.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: how far up is step 6 in the target? Set PITCH 6.', concept: 'oscillator-pitch',
      match: { target: { pitch_6: 1 }, controls: ['pitch_6'], tolerance: 0.03 },
      hints: ['Is step 6 higher or lower than the root?', 'It is the same note, higher.', 'An octave: +12 st.'],
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Write your own acid line: at least three different notes, one octave jump, and accents among quieter steps.',
      checklist: [
        { text: 'At least three different pitches', check: s => new Set([1, 2, 3, 4, 5, 6, 7, 8].map(i => semis(num(s, `pitch_${i}`)))).size >= 3 },
        { text: 'An octave jump (some step 11-13 st above another)', check: s => { const p = [1, 2, 3, 4, 5, 6, 7, 8].map(i => semis(num(s, `pitch_${i}`))); return p.some(a => p.some(b => a - b >= 11 && a - b <= 13)); } },
        { text: 'At least two loud steps (90% or more)', check: s => [1, 2, 3, 4, 5, 6, 7, 8].filter(i => num(s, `velocity_${i}`) >= 90).length >= 2 },
        { text: 'At least two quieter steps (70% or less)', check: s => [1, 2, 3, 4, 5, 6, 7, 8].filter(i => num(s, `velocity_${i}`) <= 70).length >= 2 },
      ],
      hints: ['Keep step 1 on the root so the line has a home.', 'Use +12, +3, +7 or +10 st for classic acid intervals.', 'Accent 1 and 5 at 100%, put the others around 55%.'],
      solution: { values: seq([0, 0, 12, 0, 3, 0, 10, 7], [100, 55, 90, 55, 100, 55, 85, 60]) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does velocity make the DFAM line squelch, not just get louder?',
        model: 'Velocity scales the VCF envelope too, so loud steps open the resonant filter further - brighter and more "squelchy" than the quiet ones.',
      },
    },
  ],
  review: [
    { question: 'An octave is how many semitones?', options: ['12', '7', '8'], answer: 0, explain: 'Twelve.' },
    { question: 'On the DFAM, a lower velocity step is…', options: ['Quieter and darker', 'Only quieter', 'Higher in pitch'], answer: 0, explain: 'Velocity scales every envelope.' },
    { question: 'A minor third is…', options: ['3 semitones', '4 semitones', '7 semitones'], answer: 0, explain: 'Major third is 4.' },
  ],
};

const sq2: Lesson = {
  id: 'dfam-sq2-modulation', device: 'dfam', path: 'sequencing', order: O(17), difficulty: 'advanced',
  name: 'The sequencer as a modulation source',
  description: 'One voice, whole beat: PITCH into NOISE LEVEL, then PITCH into TEMPO for swing.',
  objective: 'Patch the PITCH row into other inputs to make a kit from one voice and to swing the rhythm.',
  source: 'Synth Studio · Moog support FAQ "Can I change DFAM\'s note length?" and community kit patches', estimatedMinutes: 9,
  prerequisites: ['dfam-f7-patching', 'dfam-sd1-kick'],
  concepts: ['signal-routing', 'sequencer-pattern', 'timing-tempo', 'noise'],
  start: { reset: true, values: { vco1_frequency: -1.4, vco1_eg_amount: 45, vco_decay: 45, vco1_level: 90, vcf_cutoff: 3500, vcf_eg_amount: 20, vcf_decay: 60, vca_decay: 220, tempo: 110, ...seq(undefined, [100, 0, 55, 0, 100, 0, 70, 40]) } },
  steps: [
    run('Eight steps of one drum voice can still be a whole beat, if every step is different.'),
    {
      kind: 'predict', patchFrom: 'out_pitch', patchTo: 'in_noise_level', concept: 'signal-routing',
      instruction: 'Patch PITCH into NOISE LEVEL.',
      predict: {
        question: 'Which steps will get noise now?',
        options: ['Steps whose PITCH knob is turned up', 'Every step equally', 'Only step 1'], answer: 0,
        explain: 'NOISE LEVEL adds the incoming voltage to the knob. A step with a high PITCH knob opens the noise, and a step at 0 V adds none.',
      },
      principle: 'One voltage can do two jobs: raise the pitch and open the noise at the same time.',
      manualReference: 'Manual: Patch bay - NOISE LEVEL',
    },
    {
      kind: 'do', control: 'pitch_5', targetValue: 2.5, concept: 'sequencer-pattern',
      instruction: 'Turn PITCH 5 up to about +30 st (+2.5 V): step 5 becomes a snare.',
      principle: 'High steps get a higher drum body plus noise - a snare; low steps stay kicks.',
    },
    {
      kind: 'listen', concept: 'noise', focus: ['pitch_5'],
      instruction: 'Compare step 5 as a kick and as a snare.',
      listen: { a: { pitch_5: 0 }, b: { pitch_5: 2.5 }, labels: ['Kick on 5', 'Snare on 5'] },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Why does step 5 get noise but step 1 does not?',
        options: ['PITCH 5 is high, and PITCH now also sets NOISE LEVEL', 'Step 5 is louder', 'Noise only plays on odd steps'], answer: 0,
        explain: 'The cable carries each step\'s PITCH voltage into NOISE LEVEL, and step 1\'s knob is at 0 V.',
      },
    },
    {
      kind: 'patch', patchFrom: 'out_pitch', patchTo: 'in_tempo', concept: 'timing-tempo',
      setupPatches: [],
      setup: { seq_pitch_mod: 1, noise_level: 70, vco1_level: 40, vco1_frequency: 1, vcf_mode: 0, vcf_cutoff: 3000, vca_decay: 70, ...seq([0, 0, 0, 0, 0, 0, 0, 0], [100, 55, 80, 55, 100, 55, 80, 65]) },
      instruction: 'New patch: a hat groove. Patch PITCH into TEMPO.',
      principle: 'A voltage into a clock\'s rate speeds it up or slows it down; from a sequencer, per step.',
      explanation: 'SEQ PITCH MOD is OFF now, so the PITCH knobs no longer move the VCOs. Into TEMPO, each step\'s knob sets how fast the clock runs during that step, which is how long the step lasts.',
      manualReference: 'Moog support: "Can I change DFAM\'s note length?"',
    },
    {
      kind: 'predict', control: 'pitch_2', targetValue: 0.417, concept: 'timing-tempo',
      instruction: 'Turn PITCH 2 up to +5 st (about +0.4 V).',
      predict: {
        question: 'PITCH now sets the clock speed during each step. What happens to step 2?',
        options: ['It gets shorter - the next step comes sooner', 'It gets longer', 'It gets louder'], answer: 0,
        explain: 'A positive voltage speeds the clock up, so the step ends sooner. Moog\'s FAQ puts it this way: the higher the knob, the shorter the step.',
      },
      principle: 'Swing is unequal step lengths: long-short, long-short.',
    },
    {
      kind: 'challenge', concept: 'timing-tempo',
      instruction: 'Make it swing: every odd step long, every even step short.',
      checklist: [
        { text: 'PITCH → TEMPO cable', check: s => cable(s, 'out_pitch', 'in_tempo') },
        { text: 'Odd steps slower (PITCH 1, 3, 5, 7 below -0.2 V)', check: s => [1, 3, 5, 7].every(i => num(s, `pitch_${i}`) <= -0.2) },
        { text: 'Even steps faster (PITCH 2, 4, 6, 8 above +0.2 V)', check: s => [2, 4, 6, 8].every(i => num(s, `pitch_${i}`) >= 0.2) },
      ],
      hints: ['Negative voltage slows the clock; positive speeds it up.', 'Mirror them: about -5 st on odd steps and +5 st on even steps.', 'Try -5 st and +5 st (about ±0.4 V) for a triplet-like shuffle.'],
      solution: { values: seq([-5, 5, -5, 5, -5, 5, -5, 5]) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does it mean that "the sequencer is just a voltage source"?',
        model: 'Each step outputs a voltage, and a voltage can control anything - pitch, noise level, decay or even the tempo - so the same 8 knobs can shape any part of the sound.',
      },
    },
  ],
  review: [
    { question: 'PITCH into TEMPO lets the PITCH knobs set…', options: ['Each step\'s length', 'Each step\'s pitch only', 'The volume'], answer: 0, explain: 'Higher knob = faster clock = shorter step.' },
    { question: 'Swing is…', options: ['Alternating long and short steps', 'A faster tempo', 'Louder off-beats only'], answer: 0, explain: 'Unequal step lengths.' },
    { question: 'With PITCH patched into NOISE LEVEL, high steps get…', options: ['More noise', 'Less noise', 'No sound'], answer: 0, explain: 'The voltage adds to the knob.' },
  ],
};

// ============================================================================
// PERFORMANCE
// ============================================================================

const p1: Lesson = {
  id: 'dfam-p1-live', device: 'dfam', path: 'performance', order: O(18), difficulty: 'intermediate',
  name: 'Play it live: build-ups, breaks and fills',
  description: 'Perform over a running pattern: filter rides, decay washes, mutes and tempo rolls.',
  objective: 'Shape a running pattern live with filter rides, decay washes, velocity mutes and tempo rolls.',
  source: 'Synth Studio · performance techniques', estimatedMinutes: 7,
  prerequisites: ['dfam-f6-sequencer'],
  concepts: ['filter-cutoff', 'envelope-decay', 'velocity-dynamics', 'timing-tempo'],
  start: { reset: true, values: { vco1_frequency: -1.4, vco1_eg_amount: 45, vco_decay: 45, vco1_level: 90, vcf_cutoff: 3500, vcf_eg_amount: 20, vcf_decay: 60, vca_decay: 220, tempo: 120, ...seq([0, 0, 0, 0, 30, 0, 0, 30], [100, 0, 55, 0, 100, 0, 70, 40]) }, patches: [{ from: 'out_pitch', to: 'in_noise_level' }] },
  steps: [
    run('Performing is changing the sound over time while the pattern keeps going.'),
    {
      kind: 'do', control: 'vcf_cutoff', targetValue: 300, concept: 'filter-cutoff',
      instruction: 'Ride CUTOFF slowly down to about 300 Hz: the beat goes dull and far away.',
      principle: 'Closing a filter removes energy; it sounds like the music moved away or behind a wall.',
    },
    {
      kind: 'predict', control: 'vcf_cutoff', targetValue: 5000, concept: 'filter-cutoff',
      instruction: 'Now sweep CUTOFF back up to about 5 kHz.',
      predict: {
        question: 'Why does opening the filter after a dark section feel like a lift?',
        options: ['Contrast: the brightness comes back', 'It plays faster', 'It adds more notes'], answer: 0,
        explain: 'Our ears judge energy relative to what came before. The filter sweep is the oldest build-up in dance music for that reason.',
      },
      principle: 'Energy is relative: taking something away makes its return hit harder.',
    },
    {
      kind: 'do', control: 'vca_decay', targetValue: 1500, concept: 'envelope-decay',
      instruction: 'Push VCA DECAY up to about 1.5 s for a washed-out break.',
      principle: 'Long decays blur hits into a wash - a break from the groove without stopping it.',
    },
    {
      kind: 'do', control: 'vca_decay', targetValue: 220, concept: 'envelope-decay',
      instruction: 'Snap VCA DECAY back to about 220 ms: the groove returns.',
      principle: 'A sudden change back on a downbeat feels like a drop.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'velocity-dynamics',
      quiz: {
        question: 'You want to mute some steps live without stopping. Which knobs?',
        options: ['VELOCITY - 0 is a rest', 'PITCH', 'TEMPO'], answer: 0,
        explain: 'Velocity at 0 silences a step and keeps the time. Bring it back up on a later pass to unmute.',
      },
    },
    {
      kind: 'challenge', concept: 'velocity-dynamics',
      instruction: 'Make a breakdown: strip the beat to just steps 1 and 5, then listen to the space.',
      checklist: [
        { text: 'Steps 1 and 5 playing (60% or more)', check: s => num(s, 'velocity_1') >= 60 && num(s, 'velocity_5') >= 60 },
        { text: 'All other steps silent', check: s => [2, 3, 4, 6, 7, 8].every(i => num(s, `velocity_${i}`) <= 5) },
      ],
      hints: ['Turn the other VELOCITY knobs down to 0.', 'Steps 3, 7 and 8 are the ones still playing.'],
      solution: { values: seq(undefined, [100, 0, 0, 0, 100, 0, 0, 0]) },
    },
    {
      kind: 'do', control: 'tempo', targetValue: 240, concept: 'timing-tempo',
      instruction: 'Fill: push TEMPO up to about 240 BPM for a roll...',
      principle: 'Doubling the step rate squeezes the pattern into a drum roll - an instant fill.',
    },
    {
      kind: 'do', control: 'tempo', targetValue: 120, concept: 'timing-tempo',
      instruction: '...and pull TEMPO back to about 120 BPM.',
      principle: 'Fills work because they return: tension, then release on the downbeat.',
      explanation: 'With the studio clock patched, TEMPO is ignored. Use velocity mutes and filter rides instead, and try changing CLOCK DIV on the Studio Clock for rolls.',
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Name two ways to build energy on the DFAM without changing the pattern.',
        model: 'Open the filter after keeping it dark, and bring muted steps back with VELOCITY - or shorten a washed-out VCA DECAY on the downbeat.',
      },
    },
  ],
  review: [
    { question: 'A classic build-up is…', options: ['Slowly opening the filter', 'Stopping the clock', 'Lowering VOLUME to 0'], answer: 0, explain: 'Brightness returns.' },
    { question: 'To mute a step live, turn its…', options: ['VELOCITY to 0', 'PITCH to 0', 'TEMPO down'], answer: 0, explain: 'A rest keeps the time.' },
    { question: 'Doubling the tempo briefly makes…', options: ['A roll / fill', 'A longer decay', 'A key change'], answer: 0, explain: 'Twice as many hits.' },
  ],
};

// ============================================================================
// STUDIO
// ============================================================================

const st1: Lesson = {
  id: 'dfam-st1-clock', device: 'dfam', path: 'studio', order: 6, difficulty: 'intermediate',
  name: 'Clock the DFAM from the studio',
  description: 'Sync the DFAM to the studio transport the hardware way: a clock cable into ADV / CLOCK.',
  objective: 'Sync the DFAM to the studio with a clock cable, start it on step 1 and try clock divisions.',
  source: 'Synth Studio · Moog "Syncing DFAM with Mother-32" and DFAM manual, ADV / CLOCK', estimatedMinutes: 7,
  requires: ['studio-clock'],
  prerequisites: ['dfam-f6-sequencer'],
  concepts: ['timing-tempo', 'signal-routing', 'sequencer-pattern'],
  start: { reset: true, values: { vco1_frequency: -1.4, vco1_eg_amount: 45, vco_decay: 45, vco1_level: 90, vcf_cutoff: 3500, vcf_eg_amount: 20, vcf_decay: 60, vca_decay: 220, ...seq([0, 0, 0, 0, 30, 0, 0, 30], [100, 0, 55, 0, 100, 0, 70, 40]) }, patches: [{ from: 'out_pitch', to: 'in_noise_level' }] },
  steps: [
    {
      kind: 'info', concept: 'timing-tempo', focus: ['in_adv_clock'],
      instruction: 'The DFAM has no MIDI. In a studio it follows a clock: one short pulse per step, on a cable into ADV / CLOCK.',
      principle: 'A clock pulse is a short voltage that says "next step, now".',
      explanation: 'The Studio Clock turns the studio tempo into pulses. CLOCK DIV 1/16 gives one pulse per 16th note, so one per DFAM step.',
      manualReference: 'Manual: Patch bay - ADV / CLOCK',
    },
    {
      kind: 'challenge', instance: 'studio-clock', focus: ['out_clock'], concept: 'signal-routing',
      instruction: 'In the Studio tab, patch Studio Clock CLOCK into the DFAM\'s ADV / CLOCK.',
      checklist: [{ text: 'CLOCK → ADV / CLOCK cable', check: s => studioCable(s, 'out_clock', 'in_adv_clock', 'studio-clock', 'dfam') }],
      hints: ['Open the Studio tab at the top of the page.', 'Tap CLOCK on the Studio Clock, then tap ADV / CLOCK on the DFAM.'],
    },
    {
      kind: 'predict', control: 'run_stop', targetValue: true, concept: 'timing-tempo',
      instruction: 'Press RUN / STOP on the DFAM.',
      predict: {
        question: 'ADV / CLOCK is patched but the studio is not playing yet. What will the DFAM do?',
        options: ['Wait silently for clock pulses', 'Play at its own TEMPO', 'Play one step and stop'], answer: 0,
        explain: 'A cable in ADV / CLOCK replaces the internal clock, so TEMPO is ignored. RUN arms it, and it plays one step per pulse once the clock runs. Moog\'s sync instructions say to press RUN / STOP on the DFAM first.',
      },
      principle: 'An external clock replaces the internal one; the follower must be armed before the leader starts.',
    },
    {
      kind: 'info', concept: 'sequencer-pattern', focus: ['advance'],
      instruction: 'Press ADVANCE until step 8\'s light is on.',
      principle: 'The first pulse advances before it plays, so a sequencer parked on its last step starts on step 1.',
      explanation: 'The DFAM has no reset input. Parking it on step 8 is how you make its step 1 land on the studio\'s downbeat.',
    },
    {
      kind: 'challenge', concept: 'timing-tempo',
      instruction: 'Press ▶ in the top bar. The DFAM now plays in time with the studio.',
      checklist: [{ text: 'Studio transport playing', check: s => s.transport.playing }],
      hints: ['The play button is at the top of the page, next to the tempo.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'CLOCK DIV is 1/16 at 120 BPM. How long is one 8-step DFAM loop?',
        options: ['2 beats (1 second)', '1 bar (2 seconds)', '8 bars'], answer: 0,
        explain: 'Eight 16th notes make two beats. At 120 BPM a beat lasts half a second, so the loop is one second.',
      },
    },
    {
      kind: 'challenge', instance: 'studio-clock', focus: ['division'], concept: 'timing-tempo',
      instruction: 'Set the Studio Clock\'s CLOCK DIV to 1/8T. Hear the DFAM play triplets against the studio\'s beat.',
      checklist: [{ text: 'CLOCK DIV on 1/8T', check: s => Number(deviceValues(s, 'studio-clock').division) === 4 }],
      hints: ['CLOCK DIV is the selector on the Studio Clock.', 'Tap 1/8T: three pulses per beat instead of four.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why press RUN / STOP on the DFAM before starting the studio clock?',
        model: 'With a clock in ADV / CLOCK the DFAM only plays while it is running, so it has to be armed first - then every pulse that arrives plays the next step, in time.',
      },
    },
  ],
  review: [
    { question: 'With a cable in ADV / CLOCK, the DFAM\'s TEMPO knob…', options: ['Is ignored', 'Sets the clock speed', 'Sets the volume'], answer: 0, explain: 'The external clock replaces it.' },
    { question: 'To start the DFAM on step 1 with an external clock, first…', options: ['Park it on step 8', 'Turn TEMPO to zero', 'Unplug the cable'], answer: 0, explain: 'The first pulse advances to step 1.' },
    { question: 'CLOCK DIV 1/8T gives the DFAM…', options: ['Three steps per beat (triplets)', 'Four steps per beat', 'One step per bar'], answer: 0, explain: 'Triplet 8ths.' },
  ],
};

const st2: Lesson = {
  id: 'dfam-st2-mother32', device: 'dfam', path: 'studio', order: 7, difficulty: 'advanced',
  name: 'The DFAM plays the Mother-32',
  description: 'Send the DFAM\'s PITCH and TRIGGER to a Mother-32: drums and bass from one sequence.',
  objective: 'Use the DFAM\'s PITCH and TRIGGER outputs to play a Mother-32 bassline in time with the drums.',
  source: 'Synth Studio · Moog Sound Studio pairing (DFAM + Mother-32)', estimatedMinutes: 8,
  requires: ['mother32'],
  prerequisites: ['dfam-f7-patching'],
  concepts: ['signal-routing', 'sequencer-pattern', 'oscillator-pitch'],
  start: { reset: true, values: { vco1_frequency: -1.4, vco1_eg_amount: 45, vco_decay: 45, vco1_level: 90, vcf_cutoff: 1500, vca_decay: 300, tempo: 110, ...seq([0, 0, 12, 0, 7, 0, 10, 3], [100, 60, 80, 60, 100, 60, 80, 60]) } },
  steps: [
    run('A sequencer\'s outputs are just voltages: any synth with CV inputs can follow them.'),
    {
      kind: 'challenge', instance: 'mother32', focus: ['in_vco_1voct'], concept: 'signal-routing',
      instruction: 'In the Studio tab, patch the DFAM\'s PITCH into the Mother-32\'s VCO 1V/OCT.',
      checklist: [{ text: 'DFAM PITCH → Mother-32 VCO 1V/OCT', check: s => studioCable(s, 'out_pitch', 'in_vco_1voct', 'dfam', 'mother32') }],
      hints: ['Tap PITCH on the DFAM, then VCO 1V/OCT on the Mother-32.', 'Both use 1 volt per octave, so the notes match.'],
    },
    {
      kind: 'challenge', instance: 'mother32', focus: ['in_gate'], concept: 'signal-routing',
      instruction: 'Now patch the DFAM\'s TRIGGER output into the Mother-32\'s GATE.',
      checklist: [{ text: 'DFAM TRIGGER → Mother-32 GATE', check: s => studioCable(s, 'out_trigger', 'in_gate', 'dfam', 'mother32') }],
      hints: ['TRIGGER is the bottom-left output on the DFAM.', 'GATE replaces the Mother-32\'s own keyboard and sequencer gate.'],
    },
    {
      kind: 'predict', control: 'pitch_3', targetValue: 0.583, concept: 'oscillator-pitch',
      instruction: 'On the DFAM, turn PITCH 3 to +7 st.',
      predict: {
        question: 'Which instruments change pitch on step 3?',
        options: ['Both - one voltage drives both', 'Only the DFAM', 'Only the Mother-32'], answer: 0,
        explain: 'SEQ PITCH MOD sends PITCH to the DFAM\'s VCOs, and the same voltage leaves the PITCH jack for the Mother-32. One knob moves both.',
      },
      principle: 'One control voltage can drive several instruments at once, keeping them in key.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Why does the Mother-32 play exactly in time with the DFAM?',
        options: ['Its GATE is the DFAM\'s TRIGGER output', 'They share a TEMPO knob', 'Over MIDI'], answer: 0,
        explain: 'Every DFAM step sends a trigger pulse, and the Mother-32\'s envelope fires on it. No MIDI and no shared clock are needed.',
      },
    },
    {
      kind: 'do', control: 'seq_pitch_mod', targetValue: 1, concept: 'sequencer-pattern',
      instruction: 'Set SEQ PITCH MOD to OFF: the DFAM keeps one drum pitch while the Mother-32 plays the melody.',
      principle: 'Split one sequence between two voices: one plays the rhythm, the other the notes.',
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Make it a groove: DFAM kicks only on steps 1 and 5, while the Mother-32 plays at least three different notes.',
      checklist: [
        { text: 'DFAM VELOCITY 1 and 5 at 60% or more', check: s => num(s, 'velocity_1') >= 60 && num(s, 'velocity_5') >= 60 },
        { text: 'Other DFAM steps silent', check: s => [2, 3, 4, 6, 7, 8].every(i => num(s, `velocity_${i}`) <= 5) },
        { text: 'At least three different PITCH values', check: s => new Set([1, 2, 3, 4, 5, 6, 7, 8].map(i => semis(num(s, `pitch_${i}`)))).size >= 3 },
      ],
      hints: ['TRIGGER still fires on silent DFAM steps, so the Mother-32 keeps playing all eight.', 'Turn VELOCITY 2, 3, 4, 6, 7 and 8 to 0.'],
      solution: { values: seq([0, 0, 12, 0, 7, 0, 10, 3], [100, 0, 0, 0, 100, 0, 0, 0]) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How can one 8-step sequencer play both drums and a bassline?',
        model: 'Its PITCH and TRIGGER outputs are voltages: the trigger fires the other synth\'s envelope and the pitch sets its note, while velocity decides which steps the DFAM itself plays.',
      },
    },
  ],
  review: [
    { question: 'DFAM PITCH into Mother-32 1V/OCT works because…', options: ['Both use 1 volt per octave', 'They are made by Moog', 'It is MIDI'], answer: 0, explain: 'The same pitch standard.' },
    { question: 'The Mother-32 GATE input fed by DFAM TRIGGER…', options: ['Fires its envelope on every DFAM step', 'Changes its tempo', 'Mutes it'], answer: 0, explain: 'A trigger per step.' },
    { question: 'With SEQ PITCH MOD off, the DFAM PITCH jack…', options: ['Still outputs the step pitches', 'Goes silent', 'Outputs noise'], answer: 0, explain: 'The jack is always live.' },
  ],
};

export const DFAM_LESSONS: Lesson[] = [f1, f2, f3, f4, f5, f6, f7, sd1, sd2, sd3, sd4, e1, e2, e3, e4, sq1, sq2, p1, st1, st2];
