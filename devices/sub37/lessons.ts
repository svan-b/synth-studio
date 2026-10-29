// ============================================================================
// Sub 37 lessons (v2/v3, docs/PEDAGOGY.md), from the 20 outlines in
// docs/research/sub37/lessons.md, written against the twin's real controls.
//
// Paths: foundations (signal-flow order: oscillators -> OSC 2 -> mixer -> filter
// -> envelopes -> envelope modes -> modulation -> DUO), sound design (Moog bass,
// sync lead, grit), ear training (one control wide -> one control fine -> two
// controls -> three sections mixed), sequencing (arpeggiator, step sequencer),
// performance (wheels, glide, latch) and studio (clock sync, a bassline under the
// Analog Rytm). The studio lessons check only studio state (transport, tempo,
// sync) and the Sub 37's own controls, never another instrument's.
//
// Values are written in the twin's units: the panel's 0-10 dials are stored x10
// (RESONANCE 6 = 60), the bipolar -5..+5 amounts x20 (EG AMT +3 = 60), times in
// ms, KB TRACK in % (1:1 = 100). Page numbers are the Subsequent 37 manual's.
// ============================================================================

import type { ControlValue, Lesson, LessonCheckState, LessonStep } from '@/types';
import {
  DIV_EIGHTH, DIV_SIXTEENTH, EMPTY_FLAGS, EMPTY_PITCHES, F_REST, F_SKIP, F_TIE, PATTERN_REC, PATTERN_SEQ,
  buildSeq, charFlags, charNote, glideMsFromDial,
} from './model';
import { SUB37_PRESETS } from './presets';
import { MANUAL_PAGES as P } from './spec';

const O = (n: number) => n / 100;
const DEVICE = 'sub37';
const SRC = 'Synth Studio · Subsequent 37 manual';
const GLIDE_2 = glideMsFromDial(2);
const DIV_EIGHTH_T = 15;

// ---------------------------------------------------------------- helpers

const num = (s: LessonCheckState, id: string) => Number(s.values[id] ?? 0);
const lit = (s: LessonCheckState, id: string) => !!s.values[id];
const between = (s: LessonCheckState, id: string, lo: number, hi: number) => num(s, id) >= lo && num(s, id) <= hi;
const instanceOf = (s: LessonCheckState, device: string) => Object.entries(s.instances).find(([, i]) => i.device === device)?.[0];
/** The instrument follows the studio clock (studio-level state; missing = on for MIDI-syncable gear) */
const synced = (s: LessonCheckState, device: string) => { const id = instanceOf(s, device); return !!id && s.sync[id] !== false; };

/** The recorded sequence between FIRST and LAST STEP, one entry per step */
interface Step { note: number | null; rest: boolean; tie: boolean }
function seq(s: LessonCheckState): Step[] {
  const p1 = String(s.values.arp_seq ?? ''), fl = String(s.values.arp_seq_flags ?? '');
  const first = Math.max(1, Math.round(num(s, 'seq_first') || 1));
  const last = Math.max(first, Math.round(num(s, 'seq_len') || 1));
  const out: Step[] = [];
  for (let i = first - 1; i < last; i++) {
    const f = charFlags(fl[i]);
    if (f & F_SKIP) continue;
    const note = charNote(p1[i]);
    out.push({ note, rest: !!(f & F_REST) || note === null, tie: !!(f & F_TIE) });
  }
  return out;
}
/** A tie into a different pitch: the step after a tied step plays another note (a slide) */
const tieIntoNewNote = (st: Step[]) => st.some((x, i) => x.tie && !x.rest && st[i + 1] && !st[i + 1].rest && st[i + 1].note !== x.note);

/** A preset's sound (its bank / slot left out, so the LCD shows the live panel) */
function sound(key: string): Record<string, ControlValue> {
  const out: Record<string, ControlValue> = { ...(SUB37_PRESETS[key]?.settings ?? {}) };
  delete out.preset_bank;
  delete out.preset_number;
  return out;
}

/** An empty sequence (one blank step): the next REC starts from scratch */
const NO_SEQ: Record<string, ControlValue> = { arp_seq: EMPTY_PITCHES, arp_seq2: EMPTY_PITCHES, arp_seq_flags: EMPTY_FLAGS, seq_len: 1, seq_first: 1 };

const playKeys = (instruction: string, principle: string, explanation: string, extra: Partial<LessonStep> = {}): LessonStep => ({
  kind: 'do', play: { count: 2 }, instruction, principle, explanation, ...extra,
});

// ============================================================================
// FOUNDATIONS
// ============================================================================

const f1: Lesson = {
  id: 'sub37-f1-oscillators', device: DEVICE, path: 'foundations', order: O(1), difficulty: 'beginner',
  name: 'Footage and wave',
  description: 'Where every Sub 37 sound starts: an oscillator\'s octave (footage) and its continuously variable wave shape.',
  objective: 'Pick an oscillator\'s footage and wave shape, and say which harmonics each shape contains.',
  source: `${SRC} p.25`, estimatedMinutes: 6,
  concepts: ['oscillator-waveform', 'oscillator-pitch'],
  tags: ['oscillator', 'harmonics', 'basics'],
  start: { reset: true, values: { cutoff: 20000 } },
  steps: [
    playKeys(
      'Play two or three keys. This is OSC 1 alone: a sawtooth, with the filter wide open.',
      'Every pitched sound is a fundamental plus harmonics at whole-number multiples of it.',
      'Harmonics are the quieter, higher pitches that give a sound its colour. Watch them as a row of lines in the spectrum.',
      { concept: 'oscillator-waveform', scope: 'spectrum', manualReference: P.osc },
    ),
    {
      kind: 'do', control: 'osc1_wave', targetValue: 0, concept: 'oscillator-waveform', scope: 'spectrum',
      instruction: 'Turn OSC 1 WAVE fully left, to the triangle, and play a key.',
      principle: 'A triangle has only odd harmonics that fade fast, so it sounds soft.',
      explanation: 'In a triangle the 3rd harmonic is 1/9 as strong as the fundamental and the 5th 1/25, so it is almost a sine: soft and flute-like.',
      manualReference: P.osc,
    },
    {
      kind: 'predict', control: 'osc1_wave', targetValue: 67, concept: 'oscillator-waveform', scope: 'spectrum',
      instruction: 'Turn WAVE two-thirds of the way round, to the square.',
      predict: {
        question: 'A square also has only odd harmonics. Compared with the triangle, it will sound…',
        options: ['Brighter and hollow', 'Darker and softer', 'An octave higher', 'Exactly the same'], answer: 0,
        explain: 'Its odd harmonics fall slowly (1/n, not 1/n²), so it is far brighter, and the missing even harmonics make it hollow, like a clarinet. The pitch does not move: OCTAVE and the key set it, not the wave.',
      },
      principle: 'How fast harmonics fall decides brightness; which harmonics exist decides colour.',
      manualReference: P.osc,
    },
    {
      kind: 'do', control: 'osc1_wave', targetValue: 33, concept: 'oscillator-waveform',
      instruction: 'Turn WAVE back to one-third, the sawtooth.',
      principle: 'A sawtooth contains every harmonic, so it is the brightest classic wave.',
      explanation: 'The saw is the usual raw material for basses, brass and leads: it gives the filter the most to sculpt. The Sub 37\'s WAVE knob morphs smoothly between the shapes, with no steps.',
      manualReference: P.osc,
    },
    {
      kind: 'listen', concept: 'oscillator-waveform', focus: ['osc1_wave'], scope: 'spectrum',
      instruction: 'Compare the sawtooth and the narrow pulse at the far right of WAVE.',
      listen: {
        a: { osc1_wave: 33 }, b: { osc1_wave: 100 }, labels: ['Saw', 'Narrow pulse'],
        question: {
          question: 'The narrow pulse sounds…',
          options: ['Thinner and more nasal', 'Lower in pitch', 'Rounder'], answer: 0,
          explain: 'Narrowing the pulse weakens the lower harmonics against the upper ones, so the tone turns thin and reedy, like an oboe. The pitch stays put: only the shape changed.',
        },
      },
    },
    {
      kind: 'do', control: 'osc1_octave', targetValue: 0, concept: 'oscillator-pitch',
      instruction: 'Set OSC 1 OCTAVE to 16\'.',
      principle: 'Halving a pipe\'s length doubles its frequency, so 16\' is an octave below 8\'.',
      explanation: 'Footage comes from organ pipes. 16\', 8\', 4\' and 2\' give four octaves before you touch the keyboard.',
      manualReference: P.osc,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'oscillator-pitch',
      quiz: {
        question: 'OSC 1 at 8\' plays an A at 220 Hz. You switch to 4\'. It now plays…',
        options: ['440 Hz', '110 Hz', '220 Hz', '880 Hz'], answer: 0,
        explain: '4\' is one octave above 8\', and an octave doubles the frequency. 110 Hz would be 16\', and 880 Hz would be 2\'.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target sound.', concept: 'oscillator-waveform',
      match: { target: { osc1_wave: 100, osc1_octave: 2 }, controls: ['osc1_wave', 'osc1_octave'] },
      hints: ['It is thin and nasal, and higher than now.', 'WAVE is fully right; OCTAVE is two steps up from 16\'.', 'A narrow PULSE at 4\'.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence: why does a square sound hollow but a saw sound full?',
        model: 'The square has only odd harmonics while the saw has every harmonic, so the square is missing the even ones that fill the sound out.',
      },
    },
  ],
  review: [
    { question: 'Which wave contains every harmonic?', options: ['Sawtooth', 'Square', 'Triangle'], answer: 0, explain: 'A saw has all harmonics at 1/n; the square and triangle have odd ones only.' },
    { question: 'Switching OSC 1 from 8\' to 16\' changes the pitch by…', options: ['One octave down', 'One octave up', 'A fifth down'], answer: 0, explain: 'Doubling the footage halves the frequency.' },
    { question: 'Turning WAVE from the saw to the narrow pulse makes the sound…', options: ['Thinner and more nasal', 'Lower', 'Rounder'], answer: 0, explain: 'The shape changes the balance of harmonics; the pitch stays.' },
    { question: 'A triangle sounds soft because its harmonics…', options: ['Fall away fast (1/n²)', 'Are all even', 'Are louder than the fundamental'], answer: 0, explain: 'Odd harmonics only, falling steeply.' },
  ],
};

const f2: Lesson = {
  id: 'sub37-f2-osc2-tuning', device: DEVICE, path: 'foundations', order: O(2), difficulty: 'beginner',
  name: 'OSC 2: intervals, detune and beating',
  description: 'Tune OSC 2 against OSC 1: an even beat with BEAT FREQ, a fat detune or a fifth with FREQUENCY.',
  objective: 'Tune OSC 2 for an even beat, a fat detune or a fifth, and explain why BEAT FREQ beats evenly on every key.',
  source: `${SRC} p.26`, estimatedMinutes: 7,
  prerequisites: ['sub37-f1-oscillators'],
  concepts: ['oscillator-pitch', 'mixing'],
  start: { reset: true, values: { mix_osc2: 50, cutoff: 6000 } },
  steps: [
    {
      kind: 'info', autoplay: true, concept: 'oscillator-pitch', focus: ['osc2_frequency', 'beat_freq'],
      instruction: 'Two sawtooths in perfect unison sound like one louder saw. Hold a key and listen.',
      principle: 'Two identical frequencies add up to one tone with the same colour.',
      manualReference: P.osc2,
    },
    {
      kind: 'do', control: 'beat_freq', targetValue: 1, concept: 'oscillator-pitch',
      instruction: 'Turn BEAT FREQ to +1 Hz and hold a key.',
      principle: 'Two tones beat, swelling and fading, at the difference of their frequencies.',
      explanation: 'One hertz apart, the two waves drift in and out of step once a second, reinforcing and then cancelling each other.',
      manualReference: P.osc2,
    },
    {
      kind: 'predict', control: 'beat_freq', targetValue: 3, concept: 'oscillator-pitch',
      instruction: 'Turn BEAT FREQ to +3 Hz, then play a low key and a high key.',
      predict: {
        question: 'BEAT FREQ adds a fixed number of hertz to OSC 2. How will the beating compare on low and high keys?',
        options: ['The same speed on every key', 'Faster on high keys', 'Faster on low keys'], answer: 0,
        explain: 'A fixed 3 Hz offset makes the difference, and so the beat, three per second everywhere. "Faster on high keys" is what a detune in cents does: that is the FREQUENCY knob.',
      },
      principle: 'A fixed-hertz offset gives a constant beat rate; a fixed ratio does not.',
      manualReference: P.osc2,
    },
    {
      kind: 'do', control: 'beat_freq', targetValue: 0, concept: 'oscillator-pitch',
      instruction: 'Return BEAT FREQ to 0.',
      principle: 'For a clean unison, both tuning offsets must be centred.',
    },
    {
      kind: 'do', check: s => Math.abs(num(s, 'osc2_frequency')) >= 0.08 && Math.abs(num(s, 'osc2_frequency')) <= 0.6, focus: ['osc2_frequency'],
      concept: 'oscillator-pitch',
      instruction: 'Turn FREQUENCY a hair clockwise, about +0.1 to +0.5 semitones, and compare a low key with a high one.',
      principle: 'A ratio detune beats faster on higher notes, because the hertz gap grows with pitch.',
      explanation: 'Low notes shimmer slowly and high notes buzz. This is the classic fat analog detune.',
      hints: ['Only a tiny turn from the centre.', 'Aim for about +0.2: the LCD shows the value as you turn.'],
      solution: { values: { osc2_frequency: 0.2 } },
      manualReference: P.osc2,
    },
    {
      kind: 'listen', concept: 'oscillator-pitch', focus: ['osc2_frequency'],
      instruction: 'Compare unison with the detuned pair.',
      listen: { a: { osc2_frequency: 0 }, b: { osc2_frequency: 0.2 }, labels: ['Unison', 'Detuned'] },
    },
    {
      kind: 'do', control: 'osc2_frequency', targetValue: 7, concept: 'oscillator-pitch',
      instruction: 'Turn FREQUENCY fully clockwise, to +7 semitones.',
      principle: 'Seven semitones is a perfect fifth, a 3:2 ratio whose harmonics coincide.',
      explanation: 'Fully clockwise is a perfect fifth, so one finger plays a power chord: the two notes fuse into one strong tone.',
      manualReference: P.osc2,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'oscillator-pitch',
      quiz: {
        question: 'OSC 1 plays 200 Hz and OSC 2 FREQUENCY is at +7. OSC 2 plays about…',
        options: ['300 Hz', '207 Hz', '400 Hz', '214 Hz'], answer: 0,
        explain: 'A fifth is 3:2, and 200 × 1.5 = 300 (equal temperament gives 299.7 Hz). 400 Hz would be an octave.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target.', concept: 'oscillator-pitch',
      match: { target: { osc2_frequency: 0, beat_freq: 2 }, controls: ['osc2_frequency', 'beat_freq'] },
      hints: ['It beats evenly on every key.', 'FREQUENCY is back at the centre; only BEAT FREQ is moved.', 'BEAT FREQ at about +2 Hz.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does BEAT FREQ beat at the same speed everywhere while FREQUENCY does not?',
        model: 'BEAT FREQ adds a fixed number of hertz, so the difference never changes; FREQUENCY changes the ratio, so the hertz gap grows with pitch.',
      },
    },
  ],
  review: [
    { question: 'Tones at 220 Hz and 223 Hz beat…', options: ['3 times per second', '223 times per second', 'Not at all'], answer: 0, explain: 'The beat rate is the difference between the frequencies.' },
    { question: 'OSC 2 FREQUENCY fully clockwise gives…', options: ['A perfect fifth', 'An octave', 'A semitone'], answer: 0, explain: 'The ±7-semitone range ends on a fifth.' },
    { question: 'For an even beat across the keyboard, use…', options: ['BEAT FREQ', 'FREQUENCY', 'OCTAVE'], answer: 0, explain: 'A fixed-hertz offset.' },
    { question: 'A fifth sounds smooth because…', options: ['Many of its harmonics coincide', 'It is quieter', 'The filter removes the beating'], answer: 0, explain: 'The 3:2 ratio lines the harmonics up.' },
  ],
};

const f3: Lesson = {
  id: 'sub37-f3-mixer', device: DEVICE, path: 'foundations', order: O(3), difficulty: 'beginner',
  name: 'The mixer and its overdrive point',
  description: 'Balance the five mixer channels (OSC 1, SUB OSC, OSC 2, pink NOISE, FDBK / EXT IN) and hear where they start to overdrive the filter.',
  objective: 'Balance the five mixer channels and hear the point, above 5, where they start to overdrive the filter.',
  source: `${SRC} p.27`, estimatedMinutes: 7,
  prerequisites: ['sub37-f1-oscillators'],
  concepts: ['mixing', 'subharmonics', 'noise', 'gain-staging'],
  start: { reset: true, values: { osc1_octave: 0, cutoff: 1200 } },
  steps: [
    {
      kind: 'info', autoplay: true, concept: 'mixing', focus: ['mix_osc1', 'mix_sub', 'mix_osc2', 'mix_noise', 'mix_feedback'],
      instruction: 'Five channels feed the filter: OSC 1, SUB OSC, OSC 2, NOISE and FDBK / EXT IN. Each has a level knob and an ON button.',
      principle: 'A mixer adds signals; each knob sets how much of one source reaches the filter.',
      manualReference: P.mixer,
    },
    {
      kind: 'do', control: 'mix_sub', targetValue: 70, concept: 'subharmonics',
      instruction: 'Turn SUB OSC up to 7 and play a low key.',
      principle: 'A sub-oscillator adds a fundamental an octave lower, which we hear as weight.',
      explanation: 'The Sub 37\'s sub is always a square, exactly one octave below OSC 1 and locked to it, so it never beats against it.',
      manualReference: P.mixer,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'subharmonics',
      quiz: {
        question: 'OSC 1 plays 110 Hz. The SUB OSC plays…',
        options: ['55 Hz', '220 Hz', '110 Hz'], answer: 0,
        explain: 'One octave below halves the frequency. 220 Hz would be an octave above.',
      },
    },
    {
      kind: 'do', control: 'mix_sub_on', targetValue: false, concept: 'mixing',
      instruction: 'Press the SUB OSC\'s ON button so it goes dark, then listen.',
      principle: 'A mute keeps the level where it is, so a source can come and go in one press.',
      explanation: 'Each mixer channel has its own ON button: you can preset a level and bring the source in or out instantly.',
      manualReference: P.mixer,
    },
    {
      kind: 'do', control: 'mix_sub_on', targetValue: true, concept: 'mixing',
      instruction: 'Press the SUB OSC\'s ON button again to bring the sub back.',
      principle: 'Muting and unmuting compares a sound with and without one ingredient.',
    },
    {
      kind: 'do', control: 'mix_noise', targetValue: 40, concept: 'noise',
      instruction: 'Turn NOISE up to 4.',
      principle: 'Noise has energy at all frequencies and no pitch: it adds breath and air.',
      explanation: 'The Sub 37 makes pink noise: equal energy in every octave, so it sounds deeper and softer than the hiss of white noise.',
      manualReference: P.mixer,
    },
    {
      kind: 'do', control: 'mix_noise', targetValue: 0, concept: 'noise',
      instruction: 'Turn NOISE back to 0.',
      principle: 'Take out what the sound does not need before you judge the rest.',
    },
    {
      kind: 'predict', control: 'mix_osc1', targetValue: 90, concept: 'gain-staging',
      instruction: 'Turn the mixer OSC 1 knob from 5 up to 9 while holding a low key.',
      predict: {
        question: 'The manual says mixer settings above 5 overdrive the filter\'s input. What will you hear?',
        options: ['Louder, thicker and slightly gritty', 'Exactly twice as loud, otherwise identical', 'Quieter', 'Higher in pitch'], answer: 0,
        explain: 'Past 5 the ladder\'s input saturates: its peaks round off, which adds harmonics and squeezes the dynamics. It gets louder, but not cleanly twice as loud.',
      },
      principle: 'Pushing a stage past its clean range adds harmonics and compresses the peaks.',
      manualReference: P.mixer,
    },
    {
      kind: 'listen', concept: 'gain-staging', focus: ['mix_osc1'], scope: 'spectrum',
      instruction: 'Compare OSC 1 at 5 and at 9. Watch the upper harmonics in the spectrum.',
      listen: {
        a: { mix_osc1: 50 }, b: { mix_osc1: 90 }, labels: ['Clean (5)', 'Driven (9)'],
        question: {
          question: 'Which has more upper harmonics?',
          options: ['Driven (9)', 'Clean (5)', 'They match'], answer: 0,
          explain: 'Saturation creates new harmonics. Judge by tone, not loudness: the driven one is also louder, which fools the ear.',
        },
      },
    },
    {
      kind: 'do', control: 'mix_feedback', targetValue: 50, concept: 'gain-staging',
      instruction: 'Turn FDBK / EXT IN up to 5.',
      principle: 'Feeding an output back into a saturating input thickens and roughens the sound.',
      explanation: 'With nothing plugged into EXT IN, this channel feeds the mixer\'s own output back into the mixer: the old trick of patching a Minimoog\'s output into its external input.',
      manualReference: P.mixer,
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target.', concept: 'mixing',
      match: { target: { mix_osc1: 90, mix_sub: 20, mix_feedback: 0 }, controls: ['mix_sub', 'mix_feedback'] },
      hints: ['Less weight underneath, and no growl.', 'SUB OSC is low; FDBK / EXT IN is off.', 'SUB OSC about 2, FDBK / EXT IN at 0.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why can turning a mixer channel up change the tone, not just the level?',
        model: 'Above 5 the channels overdrive the filter\'s input, and that saturation adds harmonics and compresses the sound, so it gets thicker and grittier as well as louder.',
      },
    },
  ],
  review: [
    { question: 'On the Sub 37, mixer levels above 5…', options: ['Overdrive the filter input', 'Mute the channel', 'Change the pitch'], answer: 0, explain: 'Manual p.27: 5 or below is clean.' },
    { question: 'The sub-oscillator is…', options: ['A square one octave below OSC 1', 'A sine two octaves below', 'A copy of OSC 2'], answer: 0, explain: 'It is locked to OSC 1 and WAVE never changes it.' },
    { question: 'FDBK / EXT IN with nothing in EXT IN…', options: ['Feeds the mixer output back into the mixer', 'Is silent', 'Adds reverb'], answer: 0, explain: 'Internal feedback.' },
    { question: 'Pink noise, compared with white noise, sounds…', options: ['Darker and softer', 'Brighter', 'Pitched'], answer: 0, explain: 'Equal energy per octave: it falls 3 dB per octave.' },
  ],
};

const f4: Lesson = {
  id: 'sub37-f4-filter', device: DEVICE, path: 'foundations', order: O(4), difficulty: 'beginner',
  name: 'The ladder filter',
  description: 'The Moog ladder: CUTOFF, the four SLOPE settings and RESONANCE, up to a filter that sings on its own.',
  objective: 'Use CUTOFF, SLOPE and RESONANCE to darken, brighten or ring the sound, and play the self-oscillating filter in tune.',
  source: `${SRC} pp.28-29`, estimatedMinutes: 9,
  prerequisites: ['sub37-f3-mixer'],
  concepts: ['filter-cutoff', 'filter-type', 'filter-resonance'],
  start: { reset: true, values: { cutoff: 8000 } },
  steps: [
    {
      kind: 'do', control: 'cutoff', targetValue: 500, concept: 'filter-cutoff', scope: 'spectrum',
      instruction: 'Hold a key and turn CUTOFF down to about 500 Hz.',
      principle: 'A low-pass filter removes harmonics above its cutoff, so the sound darkens.',
      explanation: 'The ladder runs from 20 Hz to 20 kHz. The oscillator sets the pitch; the filter sets the brightness.',
      manualReference: P.filter,
    },
    {
      kind: 'predict', control: 'filter_slope', targetValue: 0, concept: 'filter-type', scope: 'spectrum',
      instruction: 'Press SLOPE until -6 dB is lit.',
      predict: {
        question: '-6 dB per octave removes far less above the cutoff than -24 dB. At the same CUTOFF the sound will be…',
        options: ['Brighter', 'Darker', 'Lower in pitch'], answer: 0,
        explain: 'Each pole adds 6 dB per octave of cut. With one pole, an octave above the cutoff is halved instead of cut to 1/16, so much more brightness passes. The pitch does not change.',
      },
      principle: 'Each filter pole adds 6 dB per octave of cut above the cutoff.',
      manualReference: P.slope,
    },
    {
      kind: 'listen', concept: 'filter-type', focus: ['filter_slope'], scope: 'spectrum',
      instruction: 'Compare one pole and four poles at the same CUTOFF.',
      listen: { a: { filter_slope: 0 }, b: { filter_slope: 3 }, labels: ['-6 dB (1 pole)', '-24 dB (4 poles)'] },
    },
    {
      kind: 'do', control: 'filter_slope', targetValue: 3, concept: 'filter-type',
      instruction: 'Press SLOPE until -24 dB is lit again.',
      principle: 'Four poles in a row make the steep, classic Moog ladder.',
      explanation: 'The ladder is four filter stages in a row; the SLOPE button picks how many of them you hear, and it can change while you play.',
      manualReference: P.slope,
    },
    {
      kind: 'do', control: 'resonance', targetValue: 50, concept: 'filter-resonance', scope: 'spectrum',
      instruction: 'Turn RESONANCE up to 5.',
      principle: 'Resonance feeds the output back to the input, boosting a narrow peak at the cutoff.',
      explanation: 'You now hear a whistle at the cutoff. A ladder also loses a little bass as the resonance rises.',
      manualReference: P.filter,
    },
    {
      kind: 'do', control: 'cutoff', targetValue: 2000, concept: 'filter-cutoff', scope: 'spectrum',
      instruction: 'Sweep CUTOFF slowly up to about 2 kHz while holding a note.',
      principle: 'A resonant peak moving through the harmonics sounds like a vowel: wah.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-resonance',
      quiz: {
        question: 'RESONANCE above 7 makes the Sub 37\'s filter self-oscillate. That means it…',
        options: ['Produces its own sine tone at the cutoff', 'Turns the oscillators off', 'Stops passing sound', 'Distorts the oscillators'], answer: 0,
        explain: 'With enough feedback the filter rings by itself, a sine wave at the cutoff frequency. The oscillators keep playing unless you turn them down.',
      },
    },
    {
      kind: 'do', control: 'mix_osc1', targetValue: 0, concept: 'filter-resonance',
      instruction: 'Turn the mixer OSC 1 knob down to 0.',
      principle: 'With no oscillator in, anything you hear comes from the filter itself.',
    },
    {
      kind: 'do', control: 'resonance', targetValue: 85, play: { count: 3 }, concept: 'filter-resonance',
      instruction: 'Turn RESONANCE up to 8.5, then play up and down the keyboard.',
      principle: 'Keyboard tracking at 1:1 lets a self-oscillating filter play in tune.',
      explanation: 'KB TRACK at 1:1 moves the cutoff an octave for each octave you play, pivoting on the key the Sub 37 calls middle C (MIDI 48).',
      manualReference: P.slope,
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target.', concept: 'filter-resonance',
      match: { target: { mix_osc1: 50, cutoff: 300, resonance: 60 }, controls: ['cutoff', 'resonance'] },
      hints: ['It is dark, and it rings.', 'CUTOFF is in the low hundreds; RESONANCE is high but below self-oscillation.', 'CUTOFF about 300 Hz, RESONANCE about 6.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence: what do CUTOFF and RESONANCE each do?',
        model: 'CUTOFF sets where the filter starts removing harmonics, and RESONANCE boosts the frequencies right at that point until, above 7, the filter rings on its own.',
      },
    },
  ],
  review: [
    { question: 'Turning CUTOFF down…', options: ['Removes high harmonics', 'Lowers the pitch', 'Adds distortion'], answer: 0, explain: 'A low-pass filter darkens; the pitch comes from the oscillator.' },
    { question: 'At the same CUTOFF, -24 dB compared with -12 dB is…', options: ['Darker', 'Brighter', 'The same'], answer: 0, explain: 'More poles cut more above the cutoff.' },
    { question: 'RESONANCE above 7 on the Sub 37…', options: ['Makes the filter self-oscillate', 'Mutes the filter', 'Adds sub bass'], answer: 0, explain: 'Manual p.28.' },
    { question: 'KB TRACK at 1:1 makes the cutoff…', options: ['Move one octave per octave played', 'Stay fixed', 'Move two octaves per octave'], answer: 0, explain: 'Fully clockwise is 2:1.' },
  ],
};

const f5: Lesson = {
  id: 'sub37-f5-envelopes', device: DEVICE, path: 'foundations', order: O(5), difficulty: 'beginner',
  name: 'Two envelopes: brightness and loudness',
  description: 'The FILTER EG moves the cutoff and the AMP EG moves the level: together they turn a tone into a pluck or a swell.',
  objective: 'Shape brightness with the FILTER EG and EG AMT and loudness with the AMP EG, to make a pluck and a swell.',
  source: `${SRC} pp.28-33`, estimatedMinutes: 9,
  prerequisites: ['sub37-f4-filter'],
  concepts: ['envelope-attack', 'envelope-decay', 'envelope-sustain', 'envelope-release', 'modulation-depth'],
  start: { reset: true, values: { cutoff: 300, resonance: 20 } },
  steps: [
    {
      kind: 'do', control: 'filter_eg_amt', targetValue: 60, concept: 'modulation-depth',
      instruction: 'Set EG AMT to +3 and play a note.',
      principle: 'An envelope\'s amount sets how far it pushes its destination.',
      explanation: 'The FILTER EG now lifts the cutoff above 300 Hz while you hold the key. EG AMT is bipolar: below centre it pulls the cutoff down instead.',
      manualReference: P.slope,
    },
    {
      kind: 'do', control: 'feg_sustain', targetValue: 0, concept: 'envelope-sustain',
      instruction: 'Set the FILTER EG SUSTAIN to 0.',
      principle: 'Sustain is a level, not a time: where the envelope rests while the key is held.',
      manualReference: P.feg,
    },
    {
      kind: 'do', control: 'feg_decay', targetValue: 250, concept: 'envelope-decay',
      instruction: 'Set the FILTER EG DECAY to about 250 ms.',
      principle: 'Decay is the time to fall from the peak to the sustain level.',
      explanation: 'Each note now starts bright and darkens: a pluck in brightness, while the loudness stays.',
      manualReference: P.feg,
    },
    {
      kind: 'predict', control: 'aeg_sustain', targetValue: 0, concept: 'envelope-sustain',
      instruction: 'Set the AMP EG SUSTAIN to 0 and hold a key.',
      predict: {
        question: 'What happens while you keep holding the key?',
        options: ['It fades to silence', 'It keeps sounding at full level', 'It gets brighter', 'It rises in pitch'], answer: 0,
        explain: 'AMP SUSTAIN sets the loudness held after the decay. At 0 the note dies away even while held, like a plucked string. It does not get brighter: the FILTER EG is already falling.',
      },
      principle: 'The amplifier envelope shapes loudness; at sustain 0 every note dies away.',
      manualReference: P.aeg,
    },
    {
      kind: 'do', control: 'aeg_decay', targetValue: 600, concept: 'envelope-decay',
      instruction: 'Set the AMP EG DECAY to about 600 ms.',
      principle: 'Different decay times for brightness and loudness make natural plucks.',
      manualReference: P.aeg,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: {
        question: 'The filter closes in 250 ms and the volume fades in 600 ms. The note…',
        options: ['Starts bright, goes dark, then fades', 'Starts dark and gets brighter', 'Stays bright until it stops'], answer: 0,
        explain: 'The FILTER EG falls first, so the brightness drops while the note is still loud. Then the AMP EG fades it out.',
      },
    },
    {
      kind: 'do', control: 'aeg_sustain', targetValue: 90, concept: 'envelope-sustain',
      instruction: 'Set the AMP EG SUSTAIN back to 9.',
      principle: 'A high amplifier sustain lets held notes keep sounding.',
    },
    {
      kind: 'do', control: 'aeg_attack', targetValue: 600, concept: 'envelope-attack',
      instruction: 'Set the AMP EG ATTACK to about 600 ms.',
      principle: 'Attack is the time from key-down to the peak; a slow attack swells in.',
      manualReference: P.aeg,
    },
    {
      kind: 'listen', concept: 'envelope-attack', focus: ['aeg_attack'],
      instruction: 'Compare a fast and a slow AMP EG ATTACK.',
      listen: { a: { aeg_attack: 1 }, b: { aeg_attack: 600 }, labels: ['Fast attack', 'Slow attack'] },
    },
    {
      kind: 'challenge', concept: 'envelope-decay',
      instruction: 'Make a pluck: bright on the attack, dark quickly, and gone within about a second even if you hold the key.',
      checklist: [
        { text: 'EG AMT at +2 or more', check: s => num(s, 'filter_eg_amt') >= 40 },
        { text: 'FILTER EG SUSTAIN at 1 or less', check: s => num(s, 'feg_sustain') <= 10 },
        { text: 'FILTER EG DECAY 400 ms or less', check: s => num(s, 'feg_decay') <= 400 },
        { text: 'AMP EG ATTACK 10 ms or less', check: s => num(s, 'aeg_attack') <= 10 },
        { text: 'AMP EG SUSTAIN at 1 or less', check: s => num(s, 'aeg_sustain') <= 10 },
        { text: 'AMP EG DECAY 1 s or less', check: s => num(s, 'aeg_decay') <= 1000 },
      ],
      hints: ['Both envelopes need a quick fall and a low sustain.', 'FILTER EG: SUSTAIN 0 and a short DECAY. AMP EG: a fast ATTACK and SUSTAIN 0.', 'EG AMT +3.5, FILTER DECAY 220 ms, AMP ATTACK 1 ms, AMP DECAY 500 ms, both SUSTAIN 0.'],
      solution: { values: { filter_eg_amt: 70, feg_sustain: 0, feg_decay: 220, aeg_attack: 1, aeg_decay: 500, aeg_sustain: 0 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does the Sub 37 have two envelopes instead of one?',
        model: 'One shapes brightness through the filter and one shapes loudness through the VCA, so a sound can darken while it is still loud, as real instruments do.',
      },
    },
  ],
  review: [
    { question: 'SUSTAIN is…', options: ['A level held while the key is down', 'A time', 'A pitch'], answer: 0, explain: 'Attack, decay and release are times; sustain is a level.' },
    { question: 'EG AMT below centre makes the FILTER EG…', options: ['Pull the cutoff down', 'Do nothing', 'Change the pitch'], answer: 0, explain: 'EG AMT is bipolar.' },
    { question: 'AMP EG SUSTAIN at 0 means a held note…', options: ['Fades out', 'Sustains forever', 'Gets louder'], answer: 0, explain: 'It falls to the sustain level: silence.' },
    { question: 'A slow AMP EG ATTACK makes notes…', options: ['Swell in', 'Click', 'Higher'], answer: 0, explain: 'The level takes time to reach its peak.' },
  ],
};

const f6: Lesson = {
  id: 'sub37-f6-env-modes', device: DEVICE, path: 'foundations', order: O(6), difficulty: 'intermediate',
  name: 'DAHDSR, MULTI TRIG and LOOP',
  description: 'The Sub 37 envelopes have DELAY and HOLD behind KNOB SHIFT, single or multiple triggering, and a LOOP that turns them into LFOs.',
  objective: 'Use KNOB SHIFT to set DELAY and HOLD, and choose MULTI TRIG and LOOP to change how the envelopes fire.',
  source: `${SRC} pp.30-33`, estimatedMinutes: 9,
  prerequisites: ['sub37-f5-envelopes'],
  concepts: ['envelope-shape', 'lfo'],
  start: {
    reset: true,
    values: { mix_osc2: 40, beat_freq: 0.5, cutoff: 250, resonance: 30, filter_eg_amt: 60, feg_decay: 200, feg_sustain: 0, feg_release: 200, aeg_sustain: 90, aeg_release: 150 },
  },
  steps: [
    {
      kind: 'info', autoplay: true, concept: 'envelope-shape', focus: ['knob_shift'],
      instruction: 'These envelopes have two extra stages: DELAY before the attack and HOLD at the peak. KNOB SHIFT reaches them.',
      principle: 'DAHDSR adds delay and hold to the usual attack, decay, sustain and release.',
      manualReference: P.feg,
    },
    {
      kind: 'do', control: 'knob_shift', targetValue: true, concept: 'envelope-shape',
      instruction: 'Press KNOB SHIFT. The envelope knobs now set DELAY, HOLD, VEL AMT and KB TRACK.',
      principle: 'A shift button gives every knob a second job; the display names the hidden one.',
      explanation: 'KNOB SHIFT blinks while it is on. The second names are printed in blue under each knob, and the LCD shows the value you turn.',
      manualReference: P.feg,
    },
    {
      kind: 'predict', control: 'feg_hold', targetValue: 150, concept: 'envelope-shape',
      instruction: 'With KNOB SHIFT lit, turn the FILTER EG HOLD (the DECAY knob) to about 150 ms.',
      predict: {
        question: 'HOLD keeps the envelope at its peak before it decays. What changes?',
        options: ['The bright part of each note lasts longer', 'Notes start later', 'Notes get louder', 'The pitch rises'], answer: 0,
        explain: 'HOLD keeps the cutoff fully open for 150 ms before the decay, so the bite lasts longer. Notes starting later is what DELAY does.',
      },
      principle: 'Hold stretches the peak; delay postpones the whole envelope.',
      manualReference: P.feg,
    },
    {
      kind: 'do', control: 'feg_delay', targetValue: 300, concept: 'envelope-shape',
      instruction: 'Now turn the FILTER EG DELAY (the ATTACK knob) to about 300 ms. Play short and long notes.',
      principle: 'Delayed modulation appears only on notes held long enough.',
      explanation: 'Short notes stay dark; long ones bloom. VEL AMT (the SUSTAIN knob) would make harder playing open the filter further, but the on-screen keys play at full velocity.',
      manualReference: P.feg,
    },
    {
      kind: 'do', control: 'knob_shift', targetValue: false, concept: 'envelope-shape',
      instruction: 'Press KNOB SHIFT again to get ATTACK, DECAY, SUSTAIN and RELEASE back.',
      principle: 'Leave shift mode when you are done, so the knobs do what their labels say.',
    },
    {
      kind: 'info', setup: { feg_delay: 0 }, concept: 'envelope-shape', focus: ['feg_multi_trig'],
      instruction: 'Play overlapping (legato) notes. With MULTI TRIG off, the filter does not re-open for the second note.',
      principle: 'Single-trigger envelopes restart only after every key has been released.',
      manualReference: P.feg,
    },
    {
      kind: 'predict', control: 'feg_multi_trig', targetValue: true, concept: 'envelope-shape',
      instruction: 'Press the FILTER EG MULTI TRIG so it lights, then play legato again.',
      predict: {
        question: 'With MULTI TRIG lit, overlapping notes will…',
        options: ['Re-open the filter on every new note', 'Stop sounding', 'Glide into each other'], answer: 0,
        explain: 'MULTI TRIG restarts the envelope on every key. Off, the envelope is single-trigger: the classic Moog legato feel. Gliding is GLIDE\'s job.',
      },
      principle: 'Multi-trigger restarts an envelope on every new note, even when you play legato.',
      manualReference: P.feg,
    },
    {
      kind: 'do', control: 'feg_loop', targetValue: true, play: { count: 1 }, concept: 'lfo',
      instruction: 'Press the FILTER EG LOOP so it lights, and hold one key.',
      principle: 'A looping envelope repeats while a key is held, becoming an LFO with your shape.',
      explanation: 'The Sub 37 loops delay, attack, hold, decay and release, skipping sustain, as long as the key is down.',
      manualReference: P.feg,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'lfo',
      quiz: {
        question: 'LOOP is lit and the filter pulses while you hold a key. You make DECAY and RELEASE longer. The pulse will…',
        options: ['Slow down', 'Speed up', 'Stop looping'], answer: 0,
        explain: 'One loop is delay + attack + hold + decay + release, so longer stages make a longer cycle: a slower pulse. Looping only stops when you let go or turn LOOP off.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target pulse (hold a key).', concept: 'lfo',
      match: { target: { feg_loop: true, feg_hold: 150, feg_sustain: 40, feg_decay: 1300, feg_release: 1300 }, controls: ['feg_decay', 'feg_release'] },
      hints: ['The pulse is much slower.', 'DECAY and RELEASE are both longer.', 'Both about 1.3 s.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How is a looping envelope like an LFO, and how is it different?',
        model: 'Both repeat while you hold a note, but the looping envelope restarts from its beginning on each key, and its shape comes from five stage times rather than a fixed wave.',
      },
    },
  ],
  review: [
    { question: 'KNOB SHIFT turns the DECAY knob into…', options: ['HOLD', 'DELAY', 'VEL AMT', 'KB TRACK'], answer: 0, explain: 'ATTACK → DELAY, DECAY → HOLD, SUSTAIN → VEL AMT, RELEASE → KB TRACK.' },
    { question: 'With MULTI TRIG off, legato notes…', options: ['Do not restart the envelope', 'Restart it', 'Are silent'], answer: 0, explain: 'Single triggering is the default.' },
    { question: 'In LOOP, the Sub 37 envelope skips…', options: ['The sustain stage', 'The attack', 'The release'], answer: 0, explain: 'Delay, attack, hold, decay and release repeat.' },
    { question: 'DELAY makes the envelope…', options: ['Wait before its attack', 'Hold its peak', 'Release more slowly'], answer: 0, explain: 'Hold is the stage at the peak.' },
  ],
};

const f7: Lesson = {
  id: 'sub37-f7-modulation', device: DEVICE, path: 'foundations', order: O(7), difficulty: 'intermediate',
  name: 'Mod busses: vibrato, wobble and DEST',
  description: 'MOD 1 and MOD 2 each send one source to PITCH, FILTER and a DEST you choose. MOD 1 follows the mod wheel.',
  objective: 'Route an LFO to PITCH, FILTER and a DEST target, and use the MOD wheel to fade MOD 1 in.',
  source: `${SRC} pp.22-24`, estimatedMinutes: 10,
  prerequisites: ['sub37-f5-envelopes'],
  concepts: ['lfo', 'modulation-source', 'modulation-depth', 'signal-routing'],
  start: { reset: true, values: { mix_osc2: 40, osc2_wave: 67, cutoff: 900, resonance: 30, mod1_source: 0, mod1_rate: 1, mod2_source: 0, mod2_rate: 2, mod_wheel: 0 } },
  steps: [
    {
      kind: 'info', autoplay: true, concept: 'signal-routing', focus: ['mod1_pitch_amt', 'mod1_filter_amt', 'mod1_mod_amt'],
      instruction: 'Each MOD bus has one source and three destinations: PITCH, FILTER and the DEST you choose. MOD 1\'s depth follows the MOD wheel.',
      principle: 'Modulation is source, amount and destination: what moves, how far, and what it moves.',
      explanation: 'By default the MOD wheel sets MOD 1\'s overall depth (manual p.22), and MOD 2 runs at full depth. The CONTROLLERS menu changes that.',
      manualReference: P.mod,
    },
    {
      kind: 'do', control: 'mod1_rate', targetValue: 6, concept: 'lfo',
      instruction: 'In MOD 1, set RATE to about 6 Hz.',
      principle: 'An LFO is an oscillator too slow to hear as a pitch, used to move other controls.',
      manualReference: P.mod,
    },
    {
      kind: 'do', control: 'mod1_pitch_amt', targetValue: 10, concept: 'modulation-depth',
      instruction: 'Set MOD 1 PITCH AMT to +0.5. You will not hear it yet.',
      principle: 'Small, quick pitch modulation of about 5 to 7 Hz is vibrato.',
      manualReference: P.mod,
    },
    {
      kind: 'predict', check: s => num(s, 'mod_wheel') >= 40, focus: ['mod_wheel'], concept: 'modulation-depth',
      instruction: 'Push the MOD wheel more than halfway up while holding a note.',
      predict: {
        question: 'What will the MOD wheel do here?',
        options: ['Fade the vibrato in', 'Bend the pitch up', 'Open the filter', 'Nothing'], answer: 0,
        explain: 'The wheel scales MOD 1\'s depth, so it fades the 6 Hz wobble in. Bending is the PITCH wheel\'s job.',
      },
      principle: 'A depth controller adds modulation only when the music needs it.',
      solution: { values: { mod_wheel: 60 } },
      manualReference: P.wheels,
    },
    {
      kind: 'do', control: 'mod_wheel', targetValue: 0, concept: 'modulation-depth',
      instruction: 'Return the MOD wheel to 0 (a double tap on it also resets it).',
      principle: 'With the wheel down, MOD 1 is silent however its amounts are set.',
    },
    {
      kind: 'do', control: 'mod2_filter_amt', targetValue: 50, concept: 'lfo',
      instruction: 'In MOD 2, turn FILTER AMT to +2.5.',
      principle: 'An LFO on the cutoff moves brightness up and down: a wah or a wobble.',
      explanation: 'MOD 2 runs at full depth, so you hear it at once.',
      manualReference: P.mod,
    },
    {
      kind: 'do', control: 'mod2_source', targetValue: 1, concept: 'modulation-source',
      instruction: 'Set MOD 2 SOURCE to SQR.',
      principle: 'A square LFO jumps between two values, so the filter switches instead of sweeping.',
      manualReference: P.mod,
    },
    {
      kind: 'do', control: 'mod2_source', targetValue: 4, concept: 'modulation-source',
      instruction: 'Set MOD 2 SOURCE to S&H.',
      principle: 'Sample and hold takes a new random value every cycle: random steps.',
      explanation: 'Random filter steps on a resonant filter make the classic computer bleeps.',
      manualReference: P.mod,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'modulation-source',
      quiz: {
        question: 'MOD 2 runs at 2 Hz in S&H. How many new random values per second?',
        options: ['2', '1', '4', 'Endless'], answer: 0,
        explain: 'Sample and hold grabs one value per LFO cycle.',
      },
    },
    {
      kind: 'do', control: 'mod2_filter_amt', targetValue: 0, setup: { mod2_source: 0 }, concept: 'modulation-depth',
      instruction: 'Set MOD 2 FILTER AMT back to 0. Its SOURCE is back on TRI.',
      principle: 'Clear one route before you try the next, so you hear only the new one.',
    },
    {
      kind: 'do', control: 'mod2_dest', targetValue: 3, concept: 'signal-routing',
      instruction: 'Press MOD 2\'s MOD DEST button until both OSC 1 WAVE and OSC 2 WAVE are lit.',
      principle: 'The same signal can move a different parameter just by re-routing it.',
      explanation: 'MOD DEST steps through seven destinations: the other LFO\'s rate, the VCA, either or both WAVE knobs, the NOISE level and EG TIME / PGM.',
      manualReference: P.modDest,
    },
    {
      kind: 'do', control: 'mod2_mod_amt', targetValue: 40, concept: 'modulation-depth',
      instruction: 'Turn MOD 2 MOD AMT up to +2.',
      principle: 'Moving the wave shape keeps changing the harmonics, like pulse-width modulation.',
      explanation: 'Both oscillators now morph slowly around the square: a moving, chorus-like tone.',
      manualReference: P.mod,
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target.', concept: 'modulation-depth',
      match: { target: { mod2_source: 0, mod2_dest: 3, mod2_rate: 0.5, mod2_mod_amt: 90 }, controls: ['mod2_rate', 'mod2_mod_amt'] },
      hints: ['Slower and deeper.', 'MOD 2 RATE is down near half a hertz; MOD AMT is near the top.', 'RATE 0.5 Hz, MOD AMT +4.5.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why did MOD 1 need the MOD wheel while MOD 2 did not?',
        model: 'By default the MOD wheel scales MOD 1\'s depth, so MOD 1 stays silent until the wheel moves, while MOD 2 always runs at full depth.',
      },
    },
  ],
  review: [
    { question: 'Vibrato is…', options: ['Periodic pitch modulation', 'A filter sweep', 'A loudness envelope'], answer: 0, explain: 'An LFO on pitch at about 5-7 Hz.' },
    { question: 'An S&H LFO produces…', options: ['Random steps', 'A smooth sine', 'Silence'], answer: 0, explain: 'A new random value every cycle.' },
    { question: 'MOD 1 PITCH AMT is up but you hear nothing. Most likely…', options: ['The MOD wheel is down', 'The filter is closed', 'SUSTAIN is 0'], answer: 0, explain: 'The wheel sets MOD 1\'s depth.' },
    { question: 'DEST OSC 1+2 WAVE with a slow triangle gives…', options: ['A shimmering wave-shape movement', 'Vibrato', 'Tremolo'], answer: 0, explain: 'Tremolo would be DEST VCA LEVEL.' },
  ],
};

const f8: Lesson = {
  id: 'sub37-f8-duo', device: DEVICE, path: 'foundations', order: O(8), difficulty: 'intermediate',
  name: 'DUO MODE: two notes, one filter',
  description: 'DUO MODE splits the two oscillators across two keys: paraphonic, through one filter and one pair of envelopes.',
  objective: 'Play two-note intervals with DUO MODE and KB CTRL, and explain what paraphonic means.',
  source: `${SRC} pp.9, 26`, estimatedMinutes: 8,
  prerequisites: ['sub37-f2-osc2-tuning'],
  concepts: ['oscillator-pitch', 'signal-routing'],
  start: { reset: true, values: { mix_osc2: 50, cutoff: 2000, resonance: 10, aeg_attack: 5, aeg_sustain: 90, aeg_release: 300, duo_mode: false, kb_ctrl: 2 } },
  steps: [
    playKeys(
      'Hold two keys at once. With DUO MODE off, the Sub 37 plays one note: both oscillators follow one key.',
      'A monophonic synth plays one pitch at a time, however many keys you hold.',
      'Which key wins is the KB PRIORITY setting in PRESET EDIT. By default the last key you pressed wins.',
      { concept: 'oscillator-pitch', manualReference: P.presetPerf },
    ),
    {
      kind: 'predict', control: 'duo_mode', targetValue: true, concept: 'oscillator-pitch',
      instruction: 'Press DUO MODE, then hold a C and the G above it.',
      predict: {
        question: 'With DUO MODE on and KB CTRL on HI, which oscillator plays the G?',
        options: ['OSC 2', 'OSC 1', 'Both', 'Neither'], answer: 0,
        explain: 'KB CTRL HI gives OSC 2 the highest held key and OSC 1 the lowest. With only one key down, both play it.',
      },
      principle: 'Paraphonic oscillators take separate notes but share one filter and amplifier.',
      manualReference: P.osc2,
    },
    {
      kind: 'do', control: 'mix_osc1', targetValue: 0, concept: 'mixing',
      instruction: 'Turn the mixer OSC 1 knob to 0 and hold the two keys: you hear only the upper note.',
      principle: 'Muting one source reveals which note it plays.',
    },
    {
      kind: 'do', control: 'mix_osc1', targetValue: 50, concept: 'mixing',
      instruction: 'Turn the mixer OSC 1 knob back to 5.',
      principle: 'Balance the two oscillators so both notes of the interval are heard.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Both notes share one FILTER EG and one AMP EG. Holding a low key and then adding a higher one will…',
        options: ['Not re-attack the envelopes while MULTI TRIG is off', 'Start a new filter sweep for the new note only', 'Play the new note louder'], answer: 0,
        explain: 'There is one pair of envelopes for both notes, so the new key only changes OSC 2\'s pitch. A polyphonic synth gives every note its own envelopes.',
      },
    },
    {
      kind: 'do', control: 'kb_ctrl', targetValue: 1, concept: 'oscillator-pitch',
      instruction: 'Press KB CTRL until LO is lit, and hold two keys.',
      principle: 'Swapping which oscillator takes the top note changes the voicing\'s colour.',
      explanation: 'Now OSC 1 takes the top key and OSC 2 the bottom. That matters when the two oscillators have different waves or octaves.',
      manualReference: P.osc2,
    },
    {
      kind: 'do', control: 'kb_ctrl', targetValue: 0, concept: 'oscillator-pitch',
      instruction: 'Press KB CTRL until neither light is lit, then play a melody.',
      principle: 'A drone is a fixed pitch that ignores the keys.',
      explanation: 'OSC 2 now holds one pitch while OSC 1 plays, and OSC 2\'s FREQUENCY widens to ±3 octaves for tuning the drone (manual p.26).',
      manualReference: P.osc2,
    },
    {
      kind: 'listen', concept: 'oscillator-pitch', focus: ['duo_mode'],
      instruction: 'Compare mono and DUO MODE. The demo ends on a held fifth.',
      listen: { a: { duo_mode: false, kb_ctrl: 2 }, b: { duo_mode: true, kb_ctrl: 2 }, labels: ['Mono', 'Duo'] },
    },
    {
      kind: 'challenge', concept: 'oscillator-waveform',
      instruction: 'Set it up so two held keys give a square on top and a saw underneath.',
      checklist: [
        { text: 'DUO MODE lit', check: s => lit(s, 'duo_mode') },
        { text: 'KB CTRL on HI', check: s => num(s, 'kb_ctrl') === 2 },
        { text: 'OSC 2 WAVE near the square', check: s => between(s, 'osc2_wave', 55, 80) },
        { text: 'OSC 1 WAVE near the saw', check: s => between(s, 'osc1_wave', 20, 45) },
        { text: 'Both oscillators at 3 or more in the mixer', check: s => num(s, 'mix_osc1') >= 30 && num(s, 'mix_osc2') >= 30 },
      ],
      hints: ['With KB CTRL on HI, which oscillator plays the top key?', 'OSC 2 plays the top key, so give OSC 2 the square.', 'KB CTRL HI, OSC 2 WAVE 67, OSC 1 WAVE 33.'],
      solution: { values: { duo_mode: true, kb_ctrl: 2, osc2_wave: 67, osc1_wave: 33, mix_osc1: 50, mix_osc2: 50 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between paraphonic and polyphonic?',
        model: 'A paraphonic synth\'s oscillators play separate notes but share one filter and one pair of envelopes, while a polyphonic synth gives every note its own filter and envelopes.',
      },
    },
  ],
  review: [
    { question: 'DUO MODE on, KB CTRL on HI: OSC 1 plays…', options: ['The lowest held key', 'The highest', 'The last pressed'], answer: 0, explain: 'OSC 2 takes the highest.' },
    { question: 'Paraphonic means…', options: ['Separate pitches through one shared filter and VCA', 'One voice per key with its own envelopes', 'Two synths layered'], answer: 0, explain: 'The pitches are separate; the shaping is shared.' },
    { question: 'KB CTRL off in DUO MODE makes OSC 2…', options: ['Drone at a fixed pitch', 'Go silent', 'Follow the low key'], answer: 0, explain: 'FREQUENCY then tunes the drone over ±3 octaves.' },
    { question: 'How many notes can the Sub 37 sound at once?', options: ['Two', 'One', 'Four', '37'], answer: 0, explain: 'Two oscillators, two notes, in DUO MODE.' },
  ],
};

// ============================================================================
// SOUND DESIGN
// ============================================================================

const sd1: Lesson = {
  id: 'sub37-sd1-moog-bass', device: DEVICE, path: 'sound-design', order: O(9), difficulty: 'intermediate',
  name: 'The Moog bass',
  description: 'Two 16\' saws, the sub, a mixer pushed past 5 and a short filter envelope: the bass the Sub 37 is named for.',
  objective: 'Build a punchy Moog bass from two 16\' saws, the sub and a short filter envelope, and name the three controls that define it.',
  source: `${SRC} pp.27-31`, estimatedMinutes: 8,
  prerequisites: ['sub37-f5-envelopes'],
  concepts: ['filter-cutoff', 'envelope-decay', 'gain-staging'],
  tags: ['bass'],
  start: { reset: true, values: { osc1_octave: 0, osc2_octave: 0, osc2_wave: 33, feg_decay: 1500 } },
  steps: [
    {
      kind: 'listen', concept: 'filter-cutoff',
      instruction: 'Here is where we are going: a punchy Moog bass. Compare it with the raw starting point.',
      listen: { a: {}, b: sound('three_osc_mono_bass'), labels: ['Raw', 'Target'] },
    },
    {
      kind: 'do', control: 'mix_osc2', targetValue: 70, setup: { osc2_frequency: -0.08 }, concept: 'mixing',
      instruction: 'Turn the mixer OSC 2 knob up to 7.',
      principle: 'Two slightly detuned oscillators sound wider and fuller than one.',
      explanation: 'OSC 2 sits a hair flat, so the pair slowly drift against each other.',
      manualReference: P.mixer,
    },
    {
      kind: 'do', control: 'mix_sub', targetValue: 40, concept: 'subharmonics',
      instruction: 'Turn SUB OSC up to 4.',
      principle: 'Weight lives in the fundamental; a sub adds a fundamental an octave lower.',
    },
    {
      kind: 'do', control: 'mix_osc1', targetValue: 80, concept: 'gain-staging',
      instruction: 'Turn the mixer OSC 1 knob up to 8.',
      principle: 'Driving a filter\'s input past its clean range adds warmth and compression.',
      explanation: 'Above 5 the mixer overdrives the ladder\'s input. That is part of the fat Moog sound.',
      manualReference: P.mixer,
    },
    {
      kind: 'predict', control: 'cutoff', targetValue: 260, concept: 'filter-cutoff',
      instruction: 'Turn CUTOFF down to about 260 Hz.',
      predict: {
        question: 'With CUTOFF at 260 Hz and EG AMT at 0, the bass will sound…',
        options: ['Dark and dull, with no punch', 'Bright and punchy', 'Silent'], answer: 0,
        explain: 'Only the lowest harmonics pass and nothing moves the cutoff, so it is static and dull. The punch comes next, from the FILTER EG. It is not silent: the fundamentals are below 260 Hz.',
      },
      principle: 'A static filter gives a static tone; a moving filter gives each note an articulation.',
    },
    {
      kind: 'do', control: 'filter_eg_amt', targetValue: 60, concept: 'modulation-depth',
      instruction: 'Set EG AMT to +3.',
      principle: 'A filter envelope adds a bright pluck to the start of each note.',
      manualReference: P.slope,
    },
    {
      kind: 'do', control: 'feg_decay', targetValue: 350, concept: 'envelope-decay',
      instruction: 'Set the FILTER EG DECAY to about 350 ms.',
      principle: 'A short filter decay turns a bright attack into a punch.',
    },
    {
      kind: 'do', control: 'feg_sustain', targetValue: 30, concept: 'envelope-sustain',
      instruction: 'Set the FILTER EG SUSTAIN to 3.',
      principle: 'A low sustain lets the filter settle darker after the pluck.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-cutoff',
      quiz: {
        question: 'The bass sounds too clicky and thin on its attack. Which change helps most?',
        options: ['Lower EG AMT a little', 'Raise RESONANCE to 9', 'Turn SUB OSC off', 'Raise CUTOFF to 5 kHz'], answer: 0,
        explain: 'A smaller envelope amount softens the bright peak. RESONANCE 9 would self-oscillate, and losing the sub or opening the filter makes the bass thinner, not fuller.',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target.', concept: 'envelope-decay',
      match: { target: { cutoff: 1100, feg_decay: 2200 }, controls: ['cutoff', 'feg_decay'] },
      hints: ['Brighter overall, and the "wow" lasts much longer.', 'CUTOFF is higher; the FILTER EG DECAY is far longer.', 'CUTOFF about 1.1 kHz, DECAY about 2.2 s.'],
    },
    {
      kind: 'challenge', concept: 'envelope-decay',
      instruction: 'Make it a funk bass: tighter and snappier, with every note re-attacking even when you play legato.',
      checklist: [
        { text: 'FILTER EG DECAY 250 ms or less', check: s => num(s, 'feg_decay') <= 250 },
        { text: 'FILTER EG MULTI TRIG lit', check: s => lit(s, 'feg_multi_trig') },
        { text: 'AMP EG MULTI TRIG lit', check: s => lit(s, 'aeg_multi_trig') },
      ],
      hints: ['Shorter filter movement makes a bass snappier.', 'Bring the FILTER EG DECAY down and light both MULTI TRIG buttons.', 'DECAY about 160 ms, with MULTI TRIG on in both envelopes.'],
      solution: { values: { feg_decay: 160, feg_multi_trig: true, aeg_multi_trig: true, cutoff: 400 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Which three controls make this a Moog bass, and what does each add?',
        model: 'The mixer pushed past 5 adds warmth, the low CUTOFF keeps it deep, and EG AMT with a short FILTER EG DECAY puts a punchy pluck on every note.',
      },
    },
  ],
  review: [
    { question: 'The punch of a classic Moog bass mostly comes from…', options: ['A short FILTER EG with positive EG AMT', 'High resonance', 'A slow attack'], answer: 0, explain: 'The filter opens and closes on every note.' },
    { question: 'Mixer OSC 1 at 8 instead of 5 makes the bass…', options: ['Warmer and more compressed', 'Thinner', 'Out of tune'], answer: 0, explain: 'It overdrives the filter input.' },
    { question: 'To make legato bass notes re-attack, light…', options: ['MULTI TRIG', 'LOOP', 'HARD SYNC'], answer: 0, explain: 'Single triggering is the default.' },
  ],
};

const sd2: Lesson = {
  id: 'sub37-sd2-sync-lead', device: DEVICE, path: 'sound-design', order: O(10), difficulty: 'advanced',
  name: 'The hard-sync lead',
  description: 'Sync OSC 2 to OSC 1 and sweep OSC 2\'s pitch with the filter envelope: the tearing lead of 80s synth solos.',
  objective: 'Make a tearing sync lead by syncing OSC 2 to OSC 1 and sweeping OSC 2\'s pitch with the FILTER EG.',
  source: `${SRC} pp.22-26`, estimatedMinutes: 8,
  prerequisites: ['sub37-f2-osc2-tuning', 'sub37-f7-modulation'],
  concepts: ['oscillator-sync', 'modulation-source'],
  tags: ['lead', 'sync'],
  start: { reset: true, values: { mix_osc1: 0, mix_osc2: 80, cutoff: 3000, resonance: 10, feg_decay: 700, feg_sustain: 30, feg_release: 400, aeg_sustain: 90, aeg_release: 300 } },
  steps: [
    {
      kind: 'info', autoplay: true, concept: 'oscillator-sync', focus: ['hard_sync', 'osc2_frequency'],
      instruction: 'You hear only OSC 2. OSC 1 is silent in the mixer but still runs, as the master.',
      principle: 'In hard sync the master sets the pitch and the slave sets the tone.',
      manualReference: P.osc2,
    },
    {
      kind: 'do', control: 'hard_sync', targetValue: true, concept: 'oscillator-sync',
      instruction: 'Press HARD SYNC.',
      principle: 'Hard sync restarts the slave\'s cycle each time the master starts a new one.',
      manualReference: P.osc2,
    },
    {
      kind: 'predict', control: 'osc2_frequency', targetValue: 5, concept: 'oscillator-sync', scope: 'spectrum',
      instruction: 'Turn OSC 2 FREQUENCY up to about +5 while holding a note.',
      predict: {
        question: 'OSC 2 is synced to OSC 1. Raising its FREQUENCY will…',
        options: ['Change the tone but keep the pitch', 'Raise the pitch five semitones', 'Only make it quieter'], answer: 0,
        explain: 'The slave restarts at the master\'s rate, so you still hear OSC 1\'s pitch. More of OSC 2\'s faster cycle fits in before each restart, which changes the harmonics. A pitch rise is what happens without sync.',
      },
      principle: 'Sweeping a synced slave moves a bright, vocal peak through the harmonics.',
      manualReference: P.osc2,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'oscillator-sync',
      quiz: {
        question: 'If OSC 1 is higher than OSC 2 with sync on, OSC 2 gives little or no output. Why?',
        options: ['It is restarted before it can finish a cycle', 'The filter closes', 'The mixer mutes it'], answer: 0,
        explain: 'When the master\'s cycle is shorter than the slave\'s, the slave never gets far into its wave. Keep OSC 2 at or above OSC 1 (manual p.26).',
      },
    },
    {
      kind: 'do', control: 'mod2_source', targetValue: 5, concept: 'modulation-source',
      instruction: 'In MOD 2, turn SOURCE to F.EG/PGM.',
      principle: 'An envelope can be a modulation source; it moves once per note.',
      explanation: 'F.EG/PGM bypasses the LFO and uses the FILTER EG by default (the PGM SRC in CONTROLLERS can change it).',
      manualReference: P.mod,
    },
    {
      kind: 'do', control: 'mod2_pitch_dest', targetValue: 2, concept: 'oscillator-sync',
      instruction: 'Press MOD 2\'s OSC button until only the 2 light is lit.',
      principle: 'Modulating only the slave changes the timbre and leaves the note alone.',
      manualReference: P.mod,
    },
    {
      kind: 'do', control: 'mod2_pitch_amt', targetValue: 80, concept: 'modulation-depth',
      instruction: 'Turn MOD 2 PITCH AMT up to +4 and play detached notes.',
      principle: 'An envelope sweeping a synced slave makes the classic tearing lead.',
      explanation: 'Each note starts bright and screaming and settles as the FILTER EG decays.',
    },
    {
      kind: 'listen', concept: 'oscillator-sync', focus: ['mod2_pitch_amt'],
      instruction: 'Compare static sync with the swept sync.',
      listen: { a: { mod2_pitch_amt: 0 }, b: { mod2_pitch_amt: 80 }, labels: ['Static sync', 'Swept sync'] },
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target.', concept: 'oscillator-sync',
      match: { target: { feg_decay: 120, osc2_frequency: 0 }, controls: ['feg_decay', 'osc2_frequency'] },
      hints: ['The scream is shorter, and it settles to a plain tone.', 'The FILTER EG DECAY is short; OSC 2 FREQUENCY is back at the centre.', 'DECAY about 120 ms, FREQUENCY 0.'],
    },
    {
      kind: 'challenge', concept: 'glide',
      instruction: 'Make it playable: vibrato on the MOD wheel, and a short glide between overlapping notes only.',
      checklist: [
        { text: 'MOD 1 PITCH AMT a little positive (+0.2 to +1)', check: s => between(s, 'mod1_pitch_amt', 4, 20) },
        { text: 'GLIDE ON lit', check: s => lit(s, 'glide_on') },
        { text: 'GLIDE LEGATO lit', check: s => lit(s, 'glide_legato') },
      ],
      hints: ['Vibrato belongs on the bus the MOD wheel controls.', 'MOD 1 PITCH AMT small and positive; GLIDE ON with LEGATO.', 'MOD 1 PITCH AMT about +0.35 at RATE 5.5 Hz; GLIDE ON, LEGATO, TIME about 2.'],
      solution: { values: { mod1_pitch_amt: 7, mod1_rate: 5.5, glide_on: true, glide_legato: true, glide_time: GLIDE_2 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does the pitch stay put when you detune a synced OSC 2?',
        model: 'Hard sync restarts OSC 2 every time OSC 1 starts a cycle, so the sound repeats at OSC 1\'s rate; detuning OSC 2 only changes the shape of each repeat, which we hear as tone.',
      },
    },
  ],
  review: [
    { question: 'In hard sync, the pitch you hear follows…', options: ['The master, OSC 1', 'The slave, OSC 2', 'The filter'], answer: 0, explain: 'The slave restarts on every master cycle.' },
    { question: 'To sweep only the timbre of a sync sound, modulate…', options: ['OSC 2\'s pitch', 'OSC 1\'s pitch', 'Both oscillators\' pitch'], answer: 0, explain: 'Moving the master would move the note.' },
    { question: 'Sync with OSC 2 tuned below OSC 1 gives…', options: ['Little or no OSC 2 output', 'A louder OSC 2', 'An octave jump'], answer: 0, explain: 'The slave cannot complete a cycle.' },
  ],
};

const sd3: Lesson = {
  id: 'sub37-sd3-grit', device: DEVICE, path: 'sound-design', order: O(11), difficulty: 'advanced',
  name: 'Grit: where distortion happens',
  description: 'Three places for dirt: the mixer above 5, the FDBK / EXT IN feedback loop, and MULTIDRIVE after the filter.',
  objective: 'Choose mixer overdrive, FDBK or MULTIDRIVE for grit, and explain where each sits relative to the filter.',
  source: `${SRC} pp.11, 27-28`, estimatedMinutes: 8,
  prerequisites: ['sub37-f3-mixer', 'sub37-f4-filter'],
  concepts: ['gain-staging', 'filter-resonance', 'effects'],
  tags: ['distortion', 'bass'],
  start: { reset: true, values: { osc1_octave: 0, mix_sub: 40, cutoff: 500, resonance: 20 } },
  steps: [
    {
      kind: 'info', autoplay: true, concept: 'gain-staging', focus: ['mix_osc1', 'mix_feedback', 'multidrive'],
      instruction: 'The Sub 37 has three places for dirt: mixer levels above 5, the FDBK / EXT IN channel, and MULTIDRIVE after the filter.',
      principle: 'Where distortion happens in a chain changes its sound as much as how much.',
      manualReference: P.filter,
    },
    {
      kind: 'do', control: 'multidrive', targetValue: 30, concept: 'gain-staging',
      instruction: 'Turn MULTIDRIVE up to 3.',
      principle: 'Gentle saturation rounds the peaks, adding warmth before it sounds distorted.',
      explanation: 'At low settings MULTIDRIVE is asymmetric and tube-like; turned up, it becomes hard clipping.',
      manualReference: P.filter,
    },
    {
      kind: 'predict', control: 'multidrive', targetValue: 90, concept: 'gain-staging', scope: 'spectrum',
      instruction: 'Turn MULTIDRIVE up to 9.',
      predict: {
        question: 'MULTIDRIVE sits after the filter, and CUTOFF is at 500 Hz. Will the result have strong high frequencies?',
        options: ['Yes: distortion after the filter creates new highs', 'No: the filter removes them', 'No: MULTIDRIVE only adds bass'], answer: 0,
        explain: 'The OTA and FET drive stages sit between the filter and the amplifier, so the harmonics they create are never filtered and a dark patch turns buzzy. "No" would be true if the drive came before the filter.',
      },
      principle: 'Distortion after a filter adds highs that the filter can no longer remove.',
      manualReference: P.filter,
    },
    {
      kind: 'do', control: 'multidrive', targetValue: 0, concept: 'gain-staging',
      instruction: 'Turn MULTIDRIVE back to 0.',
      principle: 'Compare one kind of grit at a time.',
    },
    {
      kind: 'do', control: 'mix_osc1', targetValue: 90, concept: 'gain-staging',
      instruction: 'Turn the mixer OSC 1 knob up to 9.',
      principle: 'Overdrive before the filter is smoothed by the filter, so it sounds warmer.',
      manualReference: P.mixer,
    },
    {
      kind: 'listen', concept: 'gain-staging', focus: ['mix_osc1', 'multidrive'], scope: 'spectrum',
      instruction: 'Compare drive before the filter (mixer at 9) with drive after it (MULTIDRIVE at 9).',
      listen: {
        a: { mix_osc1: 90, multidrive: 0 }, b: { mix_osc1: 50, multidrive: 90 }, labels: ['Drive before', 'Drive after'],
        question: {
          question: 'Which is brighter and buzzier?',
          options: ['Drive after (MULTIDRIVE 9)', 'Drive before (mixer 9)', 'Neither'], answer: 0,
          explain: 'The filter smooths the overdrive that happens before it. Drive after the filter keeps all its new highs.',
        },
      },
    },
    {
      kind: 'do', control: 'mix_feedback', targetValue: 60, concept: 'gain-staging',
      instruction: 'Turn FDBK / EXT IN up to 6. Turn VOLUME down if it jumps.',
      principle: 'Feeding an output back into its own input thickens it and can make it unstable.',
      explanation: 'Feedback can raise the level a lot (manual p.27). Its character runs from mellow to chaotic.',
      manualReference: P.mixer,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'With nothing plugged into EXT IN, FDBK / EXT IN feeds…',
        options: ['The mixer\'s output back into the mixer', 'The headphone output into the filter', 'Pink noise into the filter'], answer: 0,
        explain: 'The block diagram routes the mixer\'s output into the FDBK / EXT channel whenever the jack is empty (manual p.11): the old Minimoog trick, built in.',
      },
    },
    {
      kind: 'challenge', concept: 'gain-staging',
      instruction: 'Make an aggressive bass that stays dark: plenty of grit, but nothing hissy or fizzy on top.',
      checklist: [
        { text: 'Grit before the filter: mixer OSC 1 at 7+ or FDBK / EXT IN at 3+', check: s => num(s, 'mix_osc1') >= 70 || num(s, 'mix_feedback') >= 30 },
        { text: 'MULTIDRIVE at 4 or less', check: s => num(s, 'multidrive') <= 40 },
        { text: 'CUTOFF at 600 Hz or less', check: s => num(s, 'cutoff') <= 600 },
      ],
      hints: ['Fizz comes from distortion the filter cannot reach.', 'Put the grit before the filter and keep MULTIDRIVE low.', 'Mixer OSC 1 about 9, FDBK / EXT IN about 6, MULTIDRIVE 2, CUTOFF about 400 Hz.'],
      solution: { values: { mix_osc1: 90, mix_feedback: 60, multidrive: 20, cutoff: 400 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does distortion before the filter sound warmer than distortion after it?',
        model: 'The filter removes the high harmonics that distortion before it creates, but anything distorted after the filter keeps all of its new highs.',
      },
    },
  ],
  review: [
    { question: 'MULTIDRIVE sits…', options: ['Between the filter and the amplifier', 'Before the oscillators', 'In the mixer'], answer: 0, explain: 'OTA and FET stages after the ladder.' },
    { question: 'To add grit but keep a bass dark, distort…', options: ['Before the filter, with the mixer or FDBK', 'After it, with MULTIDRIVE', 'With noise'], answer: 0, explain: 'The filter then smooths the new highs.' },
    { question: 'Before judging a distorted sound, you should…', options: ['Match its loudness to the clean one', 'Raise the cutoff', 'Add resonance'], answer: 0, explain: 'Louder fools the ear into hearing "better".' },
  ],
};

// ============================================================================
// EAR TRAINING
// ============================================================================

const e1: Lesson = {
  id: 'sub37-e1-cutoff', device: DEVICE, path: 'ear-training', order: O(12), difficulty: 'beginner',
  name: 'Ear: cutoff, wide',
  description: 'Hear where CUTOFF is set, to within about an octave, on a saw bass.',
  objective: 'Hear where CUTOFF is set, to within about an octave, on a saw bass.',
  source: 'Synth Studio', estimatedMinutes: 5,
  prerequisites: ['sub37-f4-filter'],
  concepts: ['filter-cutoff'],
  start: { reset: true, values: { osc1_octave: 0, mix_osc1: 60, mix_sub: 30, resonance: 10, cutoff: 4000 } },
  steps: [
    {
      kind: 'listen', concept: 'filter-cutoff', focus: ['cutoff'], scope: 'spectrum',
      instruction: 'Compare a low and a high CUTOFF.',
      listen: {
        a: { cutoff: 200 }, b: { cutoff: 4000 }, labels: ['Dark (200 Hz)', 'Bright (4 kHz)'],
        question: { question: 'Which has more buzz at the top?', options: ['Bright, 4 kHz', 'Dark, 200 Hz', 'They match'], answer: 0, explain: 'A higher cutoff lets more upper harmonics through.' },
      },
    },
    {
      kind: 'predict', control: 'cutoff', targetValue: 900, concept: 'filter-cutoff',
      instruction: 'Turn CUTOFF to about 900 Hz.',
      predict: {
        question: 'Heard in octaves, the halfway point between 200 Hz and 4 kHz is about…',
        options: ['900 Hz', '2.1 kHz', '400 Hz'], answer: 0,
        explain: 'We hear frequency as ratios. The geometric middle is √(200 × 4000) ≈ 894 Hz. The plain average, 2.1 kHz, is tempting, but it sounds much closer to the bright end.',
      },
      principle: 'Pitch and brightness are heard in ratios, so equal octaves feel like equal steps.',
    },
    {
      kind: 'match', setup: { cutoff: 4000 }, instruction: 'Ear challenge: set CUTOFF to match the target.', concept: 'filter-cutoff',
      match: { target: { cutoff: 300 }, controls: ['cutoff'] },
      hints: ['It is dark.', 'Below 500 Hz.', 'About 300 Hz.'],
    },
    {
      kind: 'match', setup: { cutoff: 300 }, instruction: 'Again: match the target.', concept: 'filter-cutoff',
      match: { target: { cutoff: 2500 }, controls: ['cutoff'] },
      hints: ['Bright, but not fizzy.', 'Between 1.5 and 4 kHz.', 'About 2.5 kHz.'],
    },
    {
      kind: 'match', setup: { cutoff: 5000 }, instruction: 'One more.', concept: 'filter-cutoff',
      match: { target: { cutoff: 1000 }, controls: ['cutoff'] },
      hints: ['A rounder middle.', 'Around 1 kHz.', 'About 1 kHz.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-cutoff',
      quiz: { question: 'Moving CUTOFF from 300 Hz to 600 Hz is a change of…', options: ['One octave', '300 octaves', 'Half an octave'], answer: 0, explain: 'Doubling any frequency raises it one octave.' },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How did you judge the cutoff by ear?',
        model: 'By how much buzz is left at the top: a low cutoff leaves only the deep fundamentals, while a high one leaves the bright harmonics.',
      },
    },
  ],
  review: [
    { question: 'Doubling the cutoff frequency raises it by…', options: ['One octave', 'Two octaves', 'A fifth'], answer: 0, explain: 'An octave is a doubling.' },
    { question: 'A saw with CUTOFF at 200 Hz sounds…', options: ['Dark and muffled', 'Bright and buzzy', 'Silent'], answer: 0, explain: 'Only the lowest harmonics pass.' },
    { question: 'In octaves, the middle of 100 Hz and 1.6 kHz is…', options: ['400 Hz', '850 Hz', '800 Hz'], answer: 0, explain: '√(100 × 1600) = 400.' },
  ],
};

const e2: Lesson = {
  id: 'sub37-e2-decay-fine', device: DEVICE, path: 'ear-training', order: O(13), difficulty: 'intermediate',
  name: 'Ear: filter decay, fine',
  description: 'Match the FILTER EG DECAY of a pluck by ear, to within about a factor of two.',
  objective: 'Match a FILTER EG DECAY by ear to within about a factor of two.',
  source: 'Synth Studio', estimatedMinutes: 6,
  prerequisites: ['sub37-e1-cutoff', 'sub37-f5-envelopes'],
  concepts: ['envelope-decay'],
  start: { reset: true, values: { mix_osc1: 60, cutoff: 300, resonance: 30, filter_eg_amt: 70, feg_decay: 300, feg_sustain: 0, feg_release: 200, aeg_decay: 800, aeg_sustain: 60, aeg_release: 200 } },
  steps: [
    {
      kind: 'listen', concept: 'envelope-decay', focus: ['feg_decay'],
      instruction: 'Compare a short and a long FILTER EG DECAY.',
      listen: { a: { feg_decay: 80 }, b: { feg_decay: 800 }, labels: ['Short', 'Long'] },
    },
    {
      kind: 'predict', control: 'feg_decay', targetValue: 160, concept: 'envelope-decay',
      instruction: 'Set the FILTER EG DECAY to about 160 ms and play short notes.',
      predict: {
        question: 'Compared with 300 ms, 160 ms will sound…',
        options: ['Snappier: the brightness closes sooner', 'Louder', 'Lower in pitch'], answer: 0,
        explain: 'DECAY sets how fast the cutoff falls back, so halving it tightens the pluck. Loudness belongs to the AMP EG, and pitch to the oscillator.',
      },
      principle: 'Shorter envelope stages make sounds tighter; longer ones make them lazier.',
    },
    {
      kind: 'match', setup: { feg_decay: 150 }, instruction: 'Ear challenge: match the target decay.', concept: 'envelope-decay',
      match: { target: { feg_decay: 600 }, controls: ['feg_decay'], tolerance: 0.06 },
      hints: ['The pluck is long and lazy.', 'Longer than half a second.', 'About 600 ms.'],
    },
    {
      kind: 'match', setup: { feg_decay: 450 }, instruction: 'Finer now.', concept: 'envelope-decay',
      match: { target: { feg_decay: 220 }, controls: ['feg_decay'], tolerance: 0.06 },
      hints: ['Slightly shorter than where you are.', 'Between 150 and 300 ms.', 'About 220 ms.'],
    },
    {
      kind: 'match', setup: { feg_decay: 180 }, instruction: 'The finest one.', concept: 'envelope-decay',
      match: { target: { feg_decay: 90 }, controls: ['feg_decay'], tolerance: 0.05 },
      hints: ['A tight blip.', 'Under 120 ms.', 'About 90 ms.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: {
        question: 'You double DECAY from 100 to 200 ms. On a logarithmic time knob, that is…',
        options: ['The same turn as 1 s to 2 s', 'Ten times the turn of 1 s to 2 s', 'No movement at all'], answer: 0,
        explain: 'A log knob spaces ratios evenly, so every doubling is the same turn.',
      },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: { prompt: 'What did you listen for to judge the decay?', model: 'How long the bright "wow" at the start of each note lasts before the tone settles.' },
    },
  ],
  review: [
    { question: 'FILTER EG DECAY controls…', options: ['How fast the brightness falls after the attack', 'The loudness', 'The pitch'], answer: 0, explain: 'It is the time from the peak to the sustain level.' },
    { question: 'A shorter FILTER EG DECAY makes a bass…', options: ['Snappier', 'Longer', 'Higher'], answer: 0, explain: 'The pluck closes sooner.' },
    { question: 'On a log time knob, 50 → 100 ms and 2 → 4 s are…', options: ['The same distance', 'Very different distances', 'Impossible'], answer: 0, explain: 'Both are a doubling.' },
  ],
};

const e3: Lesson = {
  id: 'sub37-e3-filter-pair', device: DEVICE, path: 'ear-training', order: O(14), difficulty: 'intermediate',
  name: 'Ear: cutoff and resonance together',
  description: 'Recreate a filter setting by ear when both CUTOFF and RESONANCE have moved.',
  objective: 'Recreate a filter setting by ear when both CUTOFF and RESONANCE have moved.',
  source: 'Synth Studio', estimatedMinutes: 7,
  prerequisites: ['sub37-e1-cutoff'],
  concepts: ['filter-cutoff', 'filter-resonance'],
  start: { reset: true, values: { mix_osc1: 60, mix_osc2: 40, beat_freq: 0.5, cutoff: 1500, resonance: 20 } },
  steps: [
    {
      kind: 'listen', concept: 'filter-resonance', focus: ['resonance'], scope: 'spectrum',
      instruction: 'Compare no resonance with RESONANCE at 6.5.',
      listen: { a: { resonance: 0 }, b: { resonance: 65 }, labels: ['No resonance', 'RESONANCE 6.5'] },
    },
    {
      kind: 'predict', control: 'resonance', targetValue: 65, concept: 'filter-resonance',
      instruction: 'Turn RESONANCE to 6.5.',
      predict: {
        question: 'With more resonance at the same CUTOFF, the sound will…',
        options: ['Ring at the cutoff and lose a little bass', 'Get darker everywhere', 'Rise in pitch'], answer: 0,
        explain: 'Resonance boosts a narrow band at the cutoff, so it rings, and a ladder thins its bass as resonance rises. The overall brightness does not drop, and the pitch is unchanged.',
      },
      principle: 'Resonance adds a peak at one frequency; cutoff sets where that peak sits.',
    },
    {
      kind: 'match', setup: { cutoff: 2500, resonance: 10 }, instruction: 'Ear challenge: match both CUTOFF and RESONANCE.', concept: 'filter-resonance',
      match: { target: { cutoff: 500, resonance: 70 }, controls: ['cutoff', 'resonance'] },
      hints: ['It rings, and it is darker than now.', 'CUTOFF is low-mid; RESONANCE is high but not self-oscillating.', 'CUTOFF about 500 Hz, RESONANCE about 7.'],
    },
    {
      kind: 'match', setup: { cutoff: 700, resonance: 60 }, instruction: 'Again.', concept: 'filter-cutoff',
      match: { target: { cutoff: 3000, resonance: 20 }, controls: ['cutoff', 'resonance'] },
      hints: ['Brighter and calmer.', 'CUTOFF up a couple of octaves; RESONANCE low.', 'CUTOFF about 3 kHz, RESONANCE about 2.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-resonance',
      quiz: {
        question: 'A sound is bright overall but whistles at one frequency. Its filter is probably set to…',
        options: ['High CUTOFF and high RESONANCE', 'Low CUTOFF and no RESONANCE', 'Low CUTOFF and high RESONANCE'], answer: 0,
        explain: 'Brightness means a high cutoff, and the whistle is the resonant peak. A low cutoff would sound dark.',
      },
    },
    {
      kind: 'match', setup: { cutoff: 400, resonance: 80 }, instruction: 'The last one.', concept: 'filter-resonance',
      match: { target: { cutoff: 1200, resonance: 45 }, controls: ['cutoff', 'resonance'] },
      hints: ['Less ringing, a little brighter.', 'RESONANCE is mid-range; CUTOFF is near 1 kHz.', 'CUTOFF about 1.2 kHz, RESONANCE about 4.5.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: { prompt: 'How do you tell CUTOFF and RESONANCE apart by ear?', model: 'CUTOFF changes how much brightness is left overall, while RESONANCE adds a ringing, whistling peak at a single frequency.' },
    },
  ],
  review: [
    { question: 'Raising RESONANCE at a fixed CUTOFF mainly…', options: ['Adds a peak at the cutoff', 'Lowers the cutoff', 'Adds sub bass'], answer: 0, explain: 'Feedback boosts the band at the cutoff.' },
    { question: 'On the Sub 37, RESONANCE above 7…', options: ['Makes the filter self-oscillate', 'Mutes it', 'Changes the slope'], answer: 0, explain: 'Manual p.28.' },
    { question: 'A dark sound with a strong whistle has…', options: ['Low CUTOFF and high RESONANCE', 'High CUTOFF and no resonance', 'High MULTIDRIVE only'], answer: 0, explain: 'Dark = low cutoff; whistle = resonance.' },
  ],
};

const e4: Lesson = {
  id: 'sub37-e4-three-sections', device: DEVICE, path: 'ear-training', order: O(15), difficulty: 'advanced',
  name: 'Ear: oscillator, drive or envelope?',
  description: 'Three sections changed at once: tell OSC 1 WAVE, MULTIDRIVE and AMP EG DECAY apart and recreate them.',
  objective: 'Tell apart and recreate changes in three sections at once: OSC 1 WAVE, MULTIDRIVE and AMP EG DECAY.',
  source: 'Synth Studio', estimatedMinutes: 8,
  prerequisites: ['sub37-e2-decay-fine', 'sub37-e3-filter-pair', 'sub37-f1-oscillators'],
  concepts: ['oscillator-waveform', 'gain-staging', 'envelope-decay'],
  start: { reset: true, values: { mix_osc1: 60, cutoff: 1200, resonance: 10, multidrive: 0, aeg_decay: 600, aeg_sustain: 0, aeg_release: 300 } },
  steps: [
    {
      kind: 'listen', concept: 'oscillator-waveform', focus: ['osc1_wave'],
      instruction: 'Compare the triangle and the square.',
      listen: { a: { osc1_wave: 0 }, b: { osc1_wave: 67 }, labels: ['Triangle', 'Square'] },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'gain-staging',
      quiz: {
        question: 'A sound gets buzzier and a bit louder, with new highs, though CUTOFF did not move. Most likely…',
        options: ['MULTIDRIVE went up', 'AMP EG DECAY got longer', 'OSC 1 OCTAVE went down'], answer: 0,
        explain: 'Drive after the filter adds new harmonics and level. DECAY changes how long a note lasts, and OCTAVE changes the pitch.',
      },
    },
    {
      kind: 'predict', control: 'aeg_decay', targetValue: 200, concept: 'envelope-decay',
      instruction: 'Set the AMP EG DECAY to about 200 ms.',
      predict: {
        question: 'Which word best describes the change?',
        options: ['Shorter', 'Darker', 'Thinner'], answer: 0,
        explain: 'The AMP EG shapes loudness over time, so a shorter decay shortens the note. Darker would be the filter, and thinner the wave shape.',
      },
      principle: 'Envelopes change time; filters and waves change tone.',
    },
    {
      kind: 'match', setup: { osc1_wave: 33, multidrive: 0, aeg_decay: 600 }, instruction: 'Ear challenge: three controls changed.', concept: 'oscillator-waveform',
      match: { target: { osc1_wave: 67, multidrive: 50, aeg_decay: 200 }, controls: ['osc1_wave', 'multidrive', 'aeg_decay'], tolerance: 0.1 },
      hints: ['Two things changed the tone and one changed the length.', 'The wave is hollower, there is some grit, and notes are shorter.', 'WAVE at the square, MULTIDRIVE about 5, DECAY about 200 ms.'],
    },
    {
      kind: 'match', setup: { osc1_wave: 100, multidrive: 70, aeg_decay: 400 }, instruction: 'Again.', concept: 'gain-staging',
      match: { target: { osc1_wave: 0, multidrive: 20, aeg_decay: 1500 }, controls: ['osc1_wave', 'multidrive', 'aeg_decay'], tolerance: 0.1 },
      hints: ['Softer, cleaner and longer.', 'A triangle, a little drive, long notes.', 'WAVE fully left, MULTIDRIVE about 2, DECAY about 1.5 s.'],
    },
    {
      kind: 'match', setup: { osc1_wave: 50, multidrive: 30, aeg_decay: 300 }, instruction: 'The last one.', concept: 'envelope-decay',
      match: { target: { osc1_wave: 100, multidrive: 80, aeg_decay: 900 }, controls: ['osc1_wave', 'multidrive', 'aeg_decay'], tolerance: 0.1 },
      hints: ['Thin, nasal and dirty, with longer notes.', 'WAVE fully right, MULTIDRIVE high, DECAY near a second.', 'Narrow PULSE, MULTIDRIVE about 8, DECAY about 900 ms.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: { prompt: 'Which of the three was hardest to hear, and why?', model: 'Usually MULTIDRIVE at low settings, because gentle saturation sounds like a small brightness and loudness change rather than obvious distortion.' },
    },
  ],
  review: [
    { question: 'Notes got shorter but the tone did not change. You moved…', options: ['AMP EG DECAY', 'OSC 1 WAVE', 'MULTIDRIVE'], answer: 0, explain: 'Envelopes change time, not tone.' },
    { question: 'A hollow tone with only odd harmonics is the…', options: ['Square', 'Sawtooth', 'Narrow pulse'], answer: 0, explain: 'The square has odd harmonics only.' },
    { question: 'New highs appeared although CUTOFF stayed low. Likely cause…', options: ['MULTIDRIVE after the filter', 'More RESONANCE', 'A slower attack'], answer: 0, explain: 'Distortion after the filter is not filtered.' },
  ],
};

// ============================================================================
// SEQUENCING
// ============================================================================

const sq1: Lesson = {
  id: 'sub37-sq1-arpeggiator', device: DEVICE, path: 'sequencing', order: O(16), difficulty: 'intermediate',
  name: 'The arpeggiator',
  description: 'Turn a held chord into a pattern with PATTERN, RANGE, BACK / FORTH, INVERT and LATCH.',
  objective: 'Turn a held chord into a pattern with PATTERN, RANGE, BACK / FORTH, INVERT and LATCH.',
  source: `${SRC} pp.15-16, 40`, estimatedMinutes: 8,
  prerequisites: ['sub37-f5-envelopes'],
  concepts: ['sequencer-pattern', 'timing-tempo'],
  tags: ['arpeggiator'],
  start: {
    reset: true,
    values: { cutoff: 700, resonance: 20, filter_eg_amt: 60, feg_decay: 250, feg_sustain: 0, aeg_decay: 600, aeg_sustain: 20, aeg_release: 300, arp_on: false, arp_rate: 120, arp_div: DIV_EIGHTH, arp_pattern: 0, arp_oct_range: 3, arp_sync: false },
  },
  steps: [
    {
      kind: 'do', control: 'arp_on', targetValue: true, play: { count: 3 }, concept: 'sequencer-pattern',
      instruction: 'Press the arpeggiator\'s ON / REST button and hold three keys, a chord.',
      principle: 'An arpeggio plays a chord\'s notes one at a time instead of together.',
      explanation: 'This is how a one-voice synth plays chords: many notes in turn. It steps in 8th notes at RATE 120 BPM.',
      manualReference: P.arp,
    },
    {
      kind: 'predict', control: 'arp_pattern', targetValue: 1, concept: 'sequencer-pattern',
      instruction: 'Turn PATTERN to DWN.',
      predict: {
        question: 'Holding C, E and G with PATTERN on DWN plays…',
        options: ['G, E, C, repeating', 'C, E, G, repeating', 'The notes in random order'], answer: 0,
        explain: 'DWN plays the held notes from highest to lowest. UP goes lowest to highest, and RND is random.',
      },
      principle: 'The order of a chord\'s notes turns one harmony into different melodies.',
      manualReference: P.arp,
    },
    {
      kind: 'do', control: 'arp_pattern', targetValue: 2, concept: 'sequencer-pattern',
      instruction: 'Turn PATTERN to ORDR, then press the same three keys in a new order.',
      principle: 'Playing notes in the order you pressed them turns key order into melody.',
      manualReference: P.arp,
    },
    {
      kind: 'do', control: 'arp_oct_range', targetValue: 4, concept: 'sequencer-pattern',
      instruction: 'Press the RANGE ▶ button once, so +1 is lit.',
      principle: 'Adding an octave repeats the pattern twelve semitones higher, doubling its length.',
      explanation: 'RANGE goes from -2 to +2 octaves; one more press past either end lights 0 and ±2, for three octaves.',
      manualReference: P.arp,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: {
        question: 'Three held notes with RANGE +1. How many steps before the pattern repeats?',
        options: ['6', '3', '4', '12'], answer: 0,
        explain: 'Three notes in the original octave, then the same three an octave up.',
      },
    },
    {
      kind: 'predict', control: 'arp_invert', targetValue: true, concept: 'sequencer-pattern',
      instruction: 'Press INVERT.',
      predict: {
        question: 'With RANGE +1 and C-E-G held, INVERT plays…',
        options: ['C, C an octave up, E, E up, G, G up', 'The same order reversed', 'Only the top octave'], answer: 0,
        explain: 'INVERT plays each note in every octave of the range before moving to the next note (manual p.16). It does nothing at RANGE 0.',
      },
      principle: 'Reordering octaves changes a pattern\'s contour without changing its notes.',
      manualReference: P.arp,
    },
    {
      kind: 'do', control: 'arp_back_fwd', targetValue: true, concept: 'sequencer-pattern',
      instruction: 'Press BACK / FORTH.',
      principle: 'Playing a pattern up and back down gives a smooth rising and falling contour.',
      explanation: 'With END NOTES on ONCE (PRESET EDIT), the top and bottom notes are not repeated at the turn.',
      manualReference: P.arp,
    },
    {
      kind: 'listen', concept: 'sequencer-pattern', focus: ['arp_back_fwd'],
      instruction: 'Compare one way and back-and-forth. The demo holds C, E and G.',
      listen: { a: { arp_back_fwd: false }, b: { arp_back_fwd: true }, labels: ['One way', 'Back and forth'] },
    },
    {
      kind: 'do', control: 'arp_latch', targetValue: true, concept: 'sequencer-pattern',
      instruction: 'Press LATCH / TIE, play a chord and let go.',
      principle: 'Latch holds the notes, freeing both hands to shape the sound.',
      explanation: 'A chord played after you let go replaces the latched one. Notes added while you still hold keys join the pattern.',
      manualReference: P.arp,
    },
    {
      kind: 'challenge', concept: 'envelope-decay',
      instruction: 'While it plays, make the arpeggio tighter and brighter: short notes that still sparkle.',
      checklist: [
        { text: 'FILTER EG DECAY 200 ms or less', check: s => num(s, 'feg_decay') <= 200 },
        { text: 'AMP EG DECAY 300 ms or less', check: s => num(s, 'aeg_decay') <= 300 },
        { text: 'Still bright: CUTOFF 600 Hz+ or EG AMT +3 or more', check: s => num(s, 'cutoff') >= 600 || num(s, 'filter_eg_amt') >= 60 },
      ],
      hints: ['Short notes need short envelopes.', 'Lower the FILTER EG DECAY and the AMP EG DECAY; keep some brightness.', 'FILTER DECAY about 150 ms, AMP DECAY about 250 ms, CUTOFF about 900 Hz.'],
      solution: { values: { feg_decay: 150, aeg_decay: 250, cutoff: 900, aeg_sustain: 0 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How is an arpeggiator like a sequencer, and how is it different?',
        model: 'Both play notes one at a time from a clock, but an arpeggiator takes its notes from the keys you hold, while a sequencer plays notes you stored.',
      },
    },
  ],
  review: [
    { question: 'PATTERN on UP plays held notes…', options: ['Lowest to highest', 'In the order pressed', 'At random'], answer: 0, explain: 'ORDR is the order pressed.' },
    { question: 'LATCH keeps the arpeggio playing…', options: ['After you let go of the keys', 'Only while you hold them', 'One octave higher'], answer: 0, explain: 'Hands-free looping.' },
    { question: 'INVERT has no effect when RANGE is…', options: ['0', '+1', '-2'], answer: 0, explain: 'It works on octave copies.' },
    { question: 'BACK / FORTH on PATTERN RND…', options: ['Has no effect', 'Reverses it', 'Doubles it'], answer: 0, explain: 'Random has no direction to reverse.' },
  ],
};

/** A finished acid line (rests, and ties into new notes that slide), the step sequencer lesson's model answer */
const ACID_SEQ = buildSeq([36, '.', 48, { n: 36, tie: true }, 39, 36, 34, { n: 36, tie: true }, '.', 43, { n: 31, tie: true }, 48, 34, 36, { n: 39, tie: true }, 41]);
/** Rests on the kick's steps (1, 5, 9, 13), notes between them */
const OFFBEAT_SEQ = buildSeq(['.', '.', 36, '.', '.', '.', 36, '.', '.', '.', 36, '.', '.', '.', 36, 39]);

const sq2: Lesson = {
  id: 'sub37-sq2-step-sequencer', device: DEVICE, path: 'sequencing', order: O(17), difficulty: 'advanced',
  name: 'The step sequencer: an acid line',
  description: 'Record a 16-step sequence with rests and ties, then let LEGATO glide slide the tied notes: the acid recipe.',
  objective: 'Record a 16-step sequence with rests and ties, then use LEGATO glide so the tied notes slide.',
  source: `${SRC} pp.15-21, 46-47`, estimatedMinutes: 12,
  prerequisites: ['sub37-sq1-arpeggiator', 'sub37-sd1-moog-bass'],
  concepts: ['sequencer-pattern', 'glide'],
  tags: ['sequencer', 'acid'],
  start: {
    reset: true,
    values: {
      mix_osc1: 70, cutoff: 450, resonance: 70, multidrive: 40, filter_slope: 2, filter_eg_amt: 70, feg_decay: 180, feg_sustain: 0, feg_release: 120,
      aeg_decay: 250, aeg_sustain: 80, aeg_release: 60, arp_on: false, arp_latch: false, arp_pattern: 0, arp_sync: true, arp_div: DIV_SIXTEENTH, glide_on: false, ...NO_SEQ,
    },
  },
  steps: [
    {
      kind: 'listen', concept: 'sequencer-pattern',
      instruction: 'Here is the goal: a squelchy acid line. The Sub 37 sequencer holds up to 64 steps; you will record 16.',
      listen: { a: {}, b: sound('acid_line'), labels: ['Your patch now', 'The goal'] },
    },
    {
      kind: 'do', control: 'arp_pattern', targetValue: PATTERN_REC, concept: 'sequencer-pattern',
      instruction: 'With the arpeggiator off, turn PATTERN to REC.',
      principle: 'In step recording, the timing comes from the steps, not from when you press keys.',
      explanation: 'The next key you press erases the old sequence and becomes step 1. The LCD counts the steps: REC 01 / 01.',
      manualReference: P.seq,
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', focus: ['arp_on', 'arp_latch', 'keyboard'],
      instruction: 'Record 16 steps: keys enter notes, ON / REST adds a rest, and LATCH / TIE ties a note into the next one.',
      checklist: [
        { text: '16 steps recorded', check: s => seq(s).length === 16 },
        { text: 'At least one rest', check: s => seq(s).some(x => x.rest) },
        { text: 'At least one tie into a different note', check: s => tieIntoNewNote(seq(s)) },
      ],
      hints: ['Every key press, rest and tie-then-note counts as a step.', 'ON / REST adds a silent step; LATCH / TIE joins the previous note to the next one you play.', 'Try: C2 · rest · C3 · TIE C2 · D#2 · C2 · A#1 · TIE C2 · rest · G2 · TIE G1 · C3 · A#1 · C2 · TIE D#2 · F2.'],
      solution: { values: ACID_SEQ },
      manualReference: P.seq,
    },
    {
      kind: 'do', control: 'arp_pattern', targetValue: PATTERN_SEQ, concept: 'sequencer-pattern',
      instruction: 'Turn PATTERN to SEQ.',
      principle: 'Playback reads the stored steps instead of the held notes.',
      manualReference: P.seq,
    },
    {
      kind: 'do', concept: 'timing-tempo', focus: ['arp_on', 'arp_latch'],
      check: s => s.transport.playing && lit(s, 'arp_on') && lit(s, 'arp_latch'),
      instruction: 'Press ON / REST and LATCH / TIE, then press ▶ in the top bar.',
      principle: 'A synced sequencer needs a running clock; the key you play sets its key.',
      explanation: 'SYNC is lit, so the sequence waits for the studio clock. Latched, it starts as recorded on ▶; tap a key to move it to another key (REF NOTE FIRST: the key becomes the first note).',
      hints: ['ON / REST and LATCH / TIE are at the bottom of the ARPEGGIATOR section.', 'The ▶ is in the top bar of the page.'],
      solution: { values: { arp_on: true, arp_latch: true }, transport: 'play' },
      manualReference: P.arp,
    },
    {
      kind: 'predict', control: 'glide_on', targetValue: true, setup: { glide_legato: true, glide_type: 2, glide_time: GLIDE_2 }, concept: 'glide',
      instruction: 'Press GLIDE ON. LEGATO is lit, TYPE is EXP and TIME is 2.',
      predict: {
        question: 'With LEGATO glide on, which steps will slide?',
        options: ['Only the steps tied into a different note', 'Every step', 'Only the rests'], answer: 0,
        explain: 'A tie keeps the gate on into the next note, so those two notes overlap. LEGATO glide slides only between overlapping notes, and the tied note does not retrigger the envelopes (manual p.17). Other steps jump and re-attack.',
      },
      principle: 'Overlapping notes plus legato glide put slides only where you want them.',
      manualReference: P.glide,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: {
        question: 'A tie into the same note as the previous step…',
        options: ['Doubles that note\'s length', 'Slides it up an octave', 'Mutes the step'], answer: 0,
        explain: 'A tie into the same pitch just holds the note through the next step (manual p.17).',
      },
    },
    {
      kind: 'listen', concept: 'glide', focus: ['glide_on'],
      instruction: 'Compare the line without and with LEGATO glide.',
      listen: { a: { glide_on: false }, b: { glide_on: true }, labels: ['No glide', 'Legato glide'] },
    },
    {
      kind: 'challenge', concept: 'filter-resonance',
      instruction: 'Make the squelch more extreme while it plays, without letting the filter whistle on its own.',
      checklist: [
        { text: 'RESONANCE between 6.5 and 6.9, just under self-oscillation', check: s => between(s, 'resonance', 65, 69) },
        { text: 'EG AMT at +4.5 or more', check: s => num(s, 'filter_eg_amt') >= 90 },
        { text: 'FILTER EG DECAY 200 ms or less', check: s => num(s, 'feg_decay') <= 200 },
      ],
      hints: ['The squelch is resonance plus a strong, short filter envelope.', 'Push EG AMT up and keep RESONANCE just under 7.', 'RESONANCE about 6.7, EG AMT +4.5, DECAY about 170 ms.'],
      solution: { values: { resonance: 67, filter_eg_amt: 90, feg_decay: 170 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why do ties plus LEGATO glide create acid slides?',
        model: 'A tie keeps the gate on into the next note, so the notes overlap, and legato glide only slides between overlapping notes: exactly the tied steps slide, without retriggering the envelopes.',
      },
    },
  ],
  review: [
    { question: 'To record a step sequence, set PATTERN to…', options: ['REC, with the arpeggiator off', 'SEQ', 'ORDR'], answer: 0, explain: 'SEQ plays it back.' },
    { question: 'In step recording, the ON / REST button…', options: ['Adds a silent step', 'Stops recording', 'Deletes a step'], answer: 0, explain: 'Manual p.16.' },
    { question: 'Tying into a different note…', options: ['Changes pitch without retriggering the envelopes', 'Restarts the envelopes', 'Mutes it'], answer: 0, explain: 'Manual p.17.' },
    { question: 'How many steps can a Sub 37 sequence hold?', options: ['64', '16', '32'], answer: 0, explain: 'Four pages of 16 in STEP EDIT.' },
  ],
};

// ============================================================================
// PERFORMANCE
// ============================================================================

const p1: Lesson = {
  id: 'sub37-p1-wheels-glide-latch', device: DEVICE, path: 'performance', order: O(18), difficulty: 'intermediate',
  name: 'Wheels, glide and latch',
  description: 'Play expressively: bend with the PITCH wheel, fade vibrato in with the MOD wheel, choose a glide type, hold a drone with LATCH ON.',
  objective: 'Play with the PITCH and MOD wheels, choose a glide type for a phrase, and hold a drone with LATCH ON.',
  source: `${SRC} pp.21-23, 31-33, 42`, estimatedMinutes: 9,
  prerequisites: ['sub37-f7-modulation'],
  concepts: ['glide', 'modulation-depth', 'velocity-dynamics'],
  tags: ['performance', 'lead'],
  start: {
    reset: true,
    values: { osc2_frequency: -0.1, mix_osc1: 65, mix_osc2: 65, cutoff: 1400, resonance: 30, filter_eg_amt: 40, mod1_rate: 5.5, mod1_pitch_amt: 7, mod_wheel: 0, glide_on: false, glide_type: 1, bend_up: 2, bend_down: 2 },
  },
  steps: [
    {
      kind: 'do', event: 'pitch_wheel_up', focus: ['pitch_bend'], concept: 'oscillator-pitch',
      instruction: 'Hold a note and push the PITCH wheel all the way up, then let it spring back.',
      principle: 'Pitch bend slides the note smoothly; the bend range sets how far it goes.',
      explanation: 'BEND UP and BEND DOWN are set separately in PRESET EDIT, 0-24 semitones each, and default to 2. BEND DEST chooses which oscillators bend.',
      manualReference: P.presetPerf,
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'oscillator-pitch',
      quiz: {
        question: 'With a ±2 semitone bend range, bending fully up from C reaches…',
        options: ['D', 'C#', 'E', 'The C an octave up'], answer: 0,
        explain: 'Two semitones above C is D. C# would be one semitone.',
      },
    },
    {
      kind: 'do', check: s => between(s, 'mod_wheel', 30, 80), focus: ['mod_wheel'], concept: 'modulation-depth',
      instruction: 'Push the MOD wheel about halfway up on a long note.',
      principle: 'Vibrato added only to long notes sounds human; constant vibrato sounds mechanical.',
      explanation: 'The wheel scales MOD 1, which carries a 5.5 Hz triangle into both oscillators\' pitch.',
      hints: ['The MOD wheel is the right-hand wheel.', 'Drag it up to about the middle.'],
      solution: { values: { mod_wheel: 50 } },
      manualReference: P.wheels,
    },
    {
      kind: 'do', control: 'glide_on', targetValue: true, concept: 'glide',
      instruction: 'Press GLIDE ON and play two notes far apart.',
      principle: 'Glide limits how fast the pitch can change, so notes slide into each other.',
      manualReference: P.glide,
    },
    {
      kind: 'predict', control: 'glide_type', targetValue: 0, concept: 'glide',
      instruction: 'Set glide TYPE to LCR. Play a semitone step, then a two-octave leap.',
      predict: {
        question: 'LCR is linear constant rate. Compared with the semitone, the two-octave glide takes…',
        options: ['Much longer', 'The same time', 'Less time'], answer: 0,
        explain: 'A constant rate means a fixed speed, so a bigger interval takes longer. LCT (constant time) would give both leaps the same time.',
      },
      principle: 'Constant-rate glides take longer for bigger leaps; constant-time glides do not.',
      manualReference: P.glide,
    },
    {
      kind: 'do', control: 'glide_type', targetValue: 2, concept: 'glide',
      instruction: 'Set TYPE to EXP.',
      principle: 'Exponential glide moves fast at first, then eases into the note, like a singer.',
      manualReference: P.glide,
    },
    {
      kind: 'do', control: 'glide_legato', targetValue: true, concept: 'glide',
      instruction: 'Press LEGATO, then play detached notes, then overlapping ones.',
      principle: 'Legato glide lets you choose per note: overlap to slide, lift to jump.',
      manualReference: P.glide,
    },
    {
      kind: 'do', control: 'glide_on', targetValue: false, concept: 'glide',
      instruction: 'Press GLIDE ON again to turn glide off.',
      principle: 'ON switches glide without losing the TIME and TYPE you set.',
    },
    {
      kind: 'do', control: 'aeg_latch', targetValue: true, concept: 'envelope-sustain',
      instruction: 'Press the AMP EG LATCH ON button, then play one low note and let go.',
      principle: 'Holding an amplifier gate open turns any note into a drone.',
      explanation: 'LATCH ON keeps the AMP EG at its SUSTAIN level as if the key were still held. It is also how you hear EXT IN audio without holding a key.',
      manualReference: P.aeg,
    },
    {
      kind: 'challenge', concept: 'glide',
      instruction: 'Perform a short phrase over the drone: one note bent up into pitch, one long note with vibrato, and one slide.',
      checklist: [
        { text: 'GLIDE ON and LEGATO lit, to slide', check: s => lit(s, 'glide_on') && lit(s, 'glide_legato') },
        { text: 'AMP EG LATCH ON lit', check: s => lit(s, 'aeg_latch') },
        { text: 'MOD 1 PITCH AMT above 0, for vibrato', check: s => num(s, 'mod1_pitch_amt') > 0 },
      ],
      hints: ['The drone holds; your hands play on top.', 'Turn glide back on with LEGATO; use the MOD wheel on the long note; bend into one note.', 'Start a semitone below a note and bend up into it.'],
      solution: { values: { glide_on: true, glide_legato: true, glide_type: 2, aeg_latch: true } },
    },
    {
      kind: 'do', control: 'aeg_latch', targetValue: false, concept: 'envelope-sustain',
      instruction: 'Press LATCH ON again to release the drone.',
      principle: 'A latched gate stays open until you release it.',
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Which glide type would you choose for a singing lead, and why?',
        model: 'EXP, because it moves quickly and then eases into the note the way a voice does; with LEGATO I decide which notes slide.',
      },
    },
  ],
  review: [
    { question: 'The Sub 37\'s default bend range is…', options: ['±2 semitones', '±12', '±7'], answer: 0, explain: 'Adjustable 0-24 each way in PRESET EDIT.' },
    { question: 'LCR glide on a big leap, compared with a small one…', options: ['Takes longer', 'Takes the same time', 'Does not glide'], answer: 0, explain: 'A constant rate.' },
    { question: 'LATCH ON on the AMP EG makes notes…', options: ['Hold at SUSTAIN after release', 'Stop instantly', 'Glide'], answer: 0, explain: 'As if the gate were on.' },
    { question: 'LEGATO glide slides only when…', options: ['The next key goes down while the previous one is held', 'You play staccato', 'The arpeggiator runs'], answer: 0, explain: 'Overlapping notes.' },
  ],
};

// ============================================================================
// STUDIO (checks: studio transport, tempo and sync, and the Sub 37's own controls)
// ============================================================================

const st1: Lesson = {
  id: 'sub37-st1-arp-sync', device: DEVICE, path: 'studio', order: 6, difficulty: 'intermediate',
  name: 'Sync the arpeggiator to the studio',
  description: 'The studio transport is the Sub 37\'s MIDI clock: lock the arpeggiator to it with SYNC and pick clock divisions.',
  objective: 'Lock the arpeggiator to the studio tempo with SYNC, choose clock divisions, and start it with the studio\'s ▶.',
  source: `${SRC} pp.15, 37, 52`, estimatedMinutes: 7,
  prerequisites: ['sub37-sq1-arpeggiator'],
  concepts: ['timing-tempo', 'sequencer-pattern'],
  tags: ['studio', 'sync', 'arpeggiator'],
  start: { reset: true, values: { ...sound('robot_arp'), arp_on: true, arp_latch: true, arp_pattern: 0, arp_oct_range: 4, arp_sync: false, arp_rate: 120, arp_div: DIV_EIGHTH } },
  steps: [
    {
      kind: 'info', concept: 'timing-tempo', focus: ['arp_sync'],
      instruction: 'Free-running, the arpeggiator follows its own RATE knob. In a track it must follow the studio clock, which reaches the Sub 37 as MIDI clock.',
      principle: 'Two clocks drift apart; one shared clock keeps every part on the beat.',
      explanation: 'MIDI clock sends 24 ticks per quarter note, plus start and stop.',
      manualReference: P.arp,
    },
    {
      kind: 'do', concept: 'timing-tempo', check: s => synced(s, DEVICE),
      instruction: 'In the Studio tab, make sure "Sync to studio clock" is ticked for the Sub 37.',
      principle: 'A synced instrument takes its tempo from the leader.',
      hints: ['Open the Studio tab at the top of the page; each instrument has a sync tick box.'],
    },
    {
      kind: 'predict', control: 'arp_sync', targetValue: true, concept: 'timing-tempo',
      instruction: 'Press the arpeggiator\'s SYNC / TAP button so SYNC is lit, then hold a chord.',
      predict: {
        question: 'SYNC is lit but the studio is not playing. What does the arpeggiator do?',
        options: ['Waits silently for the clock', 'Plays at its own RATE', 'Plays one note and stops'], answer: 0,
        explain: 'With SYNC on, and not in tap-tempo mode, the arpeggiator will not play without MIDI clock (manual p.15). The LCD says it is waiting, and the RATE knob now picks a clock division instead of a tempo.',
      },
      principle: 'A follower waits for the leader\'s clock before it moves.',
      manualReference: P.arp,
    },
    {
      kind: 'do', control: 'arp_div', targetValue: DIV_SIXTEENTH, concept: 'timing-tempo',
      instruction: 'Turn the arpeggiator\'s RATE knob until the LCD shows 1/16.',
      principle: 'With sync on, a rate knob chooses a note value rather than a speed.',
      manualReference: P.arp,
    },
    {
      kind: 'challenge', concept: 'timing-tempo', focus: ['keyboard'],
      instruction: 'Press ▶ in the top bar, play a chord (LATCH holds it), and set the studio tempo to 120 BPM.',
      checklist: [
        { text: 'Studio playing', check: s => s.transport.playing },
        { text: 'Tempo 120 BPM', check: s => Math.abs(s.transport.bpm - 120) < 1 },
        { text: 'Arpeggiator ON', check: s => lit(s, 'arp_on') },
        { text: 'A chord played', check: s => (s.notesPlayed?.length ?? 0) >= 1 },
      ],
      hints: ['The play button and the tempo are in the top bar.', 'LATCH is lit, so one chord keeps playing.'],
      solution: { transport: 'play', notes: [48, 52, 55] },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'At 120 BPM with the arpeggiator on 1/16, how many notes play per second?',
        options: ['8', '2', '4', '16'], answer: 0,
        explain: '120 BPM is 2 beats a second, and 1/16 is 4 notes per beat: 2 × 4 = 8.',
      },
    },
    {
      kind: 'do', control: 'arp_div', targetValue: DIV_EIGHTH_T, concept: 'polyrhythm',
      instruction: 'Turn RATE to 1/8 T.',
      principle: 'Triplets fit three notes into the time of two, rolling across the beat.',
      explanation: 'Against a four-on-the-floor beat, three-against-two adds a rolling swing.',
      manualReference: P.arp,
    },
    {
      kind: 'listen', concept: 'polyrhythm', focus: ['arp_div'],
      instruction: 'Compare 1/16 and 1/8 triplets.',
      listen: { a: { arp_div: DIV_SIXTEENTH }, b: { arp_div: DIV_EIGHTH_T }, labels: ['1/16', '1/8 triplet'] },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does the arpeggiator wait silently with SYNC on until the studio plays?',
        model: 'With SYNC on it takes its timing from incoming MIDI clock, and the RATE knob only picks a note value, so without a clock there is nothing to step it.',
      },
    },
  ],
  review: [
    { question: 'With arpeggiator SYNC lit, the RATE knob…', options: ['Selects a clock division', 'Sets BPM', 'Sets the gate length'], answer: 0, explain: 'From 4 whole notes to a 1/64 triplet.' },
    { question: 'MIDI clock runs at…', options: ['24 ticks per quarter note', '4 per beat', '1 per bar'], answer: 0, explain: '24 PPQN.' },
    { question: '1/16 at 120 BPM gives…', options: ['8 notes per second', '4', '16'], answer: 0, explain: '2 beats × 4 sixteenths.' },
    { question: 'On the Sub 37, which sections have their own SYNC switch?', options: ['The arpeggiator, both LFOs and both envelopes', 'Only the arpeggiator', 'Only the LFOs'], answer: 0, explain: 'Manual p.9.' },
  ],
};

const st2: Lesson = {
  id: 'sub37-st2-rytm-bassline', device: DEVICE, path: 'studio', order: 7, difficulty: 'advanced',
  name: 'A bassline under the drums',
  description: 'Lock a Sub 37 bassline to the Analog Rytm\'s kick on one clock, and make room for the kick in the low end.',
  objective: 'Program a Sub 37 bassline that locks to a drum machine\'s kick and sits under it in the mix.',
  source: `${SRC} pp.17, 27, 33`, estimatedMinutes: 12,
  requires: ['analog-rytm'],
  prerequisites: ['sub37-st1-arp-sync', 'sub37-sq2-step-sequencer'],
  concepts: ['sequencer-pattern', 'mixing', 'timing-tempo'],
  tags: ['studio', 'bass', 'drums'],
  start: { reset: true, values: { ...sound('three_osc_mono_bass'), arp_on: false, arp_latch: false, arp_pattern: 0, arp_sync: true, arp_div: DIV_SIXTEENTH, ...NO_SEQ } },
  steps: [
    {
      kind: 'info', concept: 'mixing',
      instruction: 'A kick and a bassline share the low end. They need to agree in time (one clock) and in space (pitch and length).',
      principle: 'Two sounds in the same frequency range mask each other unless they take turns.',
    },
    {
      kind: 'info', instance: 'analog-rytm', concept: 'sequencer-pattern',
      instruction: 'On the Analog Rytm, put a kick on steps 1, 5, 9 and 13 (four on the floor), or pick a kit pattern that has one.',
      principle: 'A kick on every beat gives the bass a grid to play between.',
    },
    {
      kind: 'do', concept: 'timing-tempo', check: s => synced(s, DEVICE) && synced(s, 'analog-rytm'),
      instruction: 'In the Studio tab, tick "Sync to studio clock" for both the Sub 37 and the Analog Rytm.',
      principle: 'Instruments on one clock stay locked, even when the tempo changes.',
      hints: ['Each instrument in the Studio tab has a sync tick box.'],
    },
    {
      kind: 'do', control: 'arp_pattern', targetValue: PATTERN_REC, concept: 'sequencer-pattern',
      instruction: 'On the Sub 37, with the arpeggiator off, turn PATTERN to REC.',
      principle: 'Step recording places notes on the grid, whatever your timing.',
      manualReference: P.seq,
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', focus: ['arp_on', 'keyboard'],
      instruction: 'Record a 16-step off-beat bassline: rests on steps 1, 5, 9 and 13, where the kicks are, and notes in between.',
      checklist: [
        { text: '16 steps', check: s => seq(s).length === 16 },
        { text: 'Rests on steps 1, 5, 9 and 13', check: s => { const q = seq(s); return q.length === 16 && [0, 4, 8, 12].every(i => q[i].rest); } },
        { text: 'At least four notes', check: s => seq(s).filter(x => !x.rest).length >= 4 },
      ],
      hints: ['House basslines often sit between the kicks.', 'ON / REST enters a rest; put rests on the kick\'s steps.', 'Try: rest, rest, C2, rest, then the same again three times, ending on D#2.'],
      solution: { values: OFFBEAT_SEQ },
      manualReference: P.seq,
    },
    {
      kind: 'predict', concept: 'timing-tempo', focus: ['arp_pattern', 'arp_on', 'arp_latch'],
      check: s => s.transport.playing && num(s, 'arp_pattern') === PATTERN_SEQ && lit(s, 'arp_on'),
      instruction: 'Turn PATTERN to SEQ, press ON / REST and LATCH / TIE, then press ▶.',
      predict: {
        question: 'Both instruments follow the studio clock. If you change the tempo while they play, the bassline will…',
        options: ['Stay locked to the kick', 'Drift away from the kick', 'Stop'], answer: 0,
        explain: 'Both read the same clock, so every tempo change reaches both together.',
      },
      principle: 'Shared timing keeps parts together at any tempo.',
      solution: { values: { arp_pattern: PATTERN_SEQ, arp_on: true, arp_latch: true }, transport: 'play' },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'mixing',
      quiz: {
        question: 'The kick\'s weight sits around 50 Hz. The best first move to stop the bass masking it is…',
        options: ['Keep bass notes short and off the kick\'s steps', 'Raise the bass RESONANCE to 9', 'Turn the bass VOLUME up', 'Add NOISE'], answer: 0,
        explain: 'Taking turns in time is the cleanest way to share the low end. More resonance or level makes the clash worse.',
      },
    },
    {
      kind: 'challenge', concept: 'envelope-decay',
      instruction: 'Make room for the kick: short bass notes that stop before the next kick, and less of the deepest octave.',
      checklist: [
        { text: 'AMP EG SUSTAIN at 3 or less', check: s => num(s, 'aeg_sustain') <= 30 },
        { text: 'AMP EG DECAY 300 ms or less', check: s => num(s, 'aeg_decay') <= 300 },
        { text: 'SUB OSC at 2 or less', check: s => num(s, 'mix_sub') <= 20 },
      ],
      hints: ['Shorter notes leave gaps; the kick already owns the lowest octave.', 'Lower the AMP EG SUSTAIN and DECAY, and the SUB OSC level.', 'AMP SUSTAIN 3, AMP DECAY about 250 ms, SUB OSC 2.'],
      solution: { values: { aeg_sustain: 30, aeg_decay: 250, mix_sub: 20 } },
    },
    {
      kind: 'listen', concept: 'mixing', focus: ['mix_sub', 'aeg_sustain'],
      instruction: 'Compare the bass before and after making room.',
      listen: { a: { mix_sub: 40, aeg_sustain: 90, aeg_decay: 600 }, b: { mix_sub: 20, aeg_sustain: 30, aeg_decay: 250 }, labels: ['Clashing', 'Making room'] },
    },
    {
      kind: 'challenge', concept: 'mixing',
      instruction: 'Balance the two: turn the Sub 37\'s VOLUME down until the kick is the loudest thing in the low end.',
      checklist: [
        { text: 'Studio playing', check: s => s.transport.playing },
        { text: 'Sub 37 VOLUME below 6', check: s => num(s, 'master_volume') < 60 },
      ],
      hints: ['Listen at a low monitor level: the loudest low sound wins.', 'VOLUME is the top knob of the OUTPUT section.'],
      solution: { values: { master_volume: 55 }, transport: 'play' },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How did you make room for both the kick and the bass?',
        model: 'I put both on one clock, placed the bass notes between the kicks, kept them short, and left the deepest octave mostly to the kick.',
      },
    },
  ],
  review: [
    { question: 'A bassline between the kicks is called…', options: ['An off-beat bass', 'A sidechain', 'A drone'], answer: 0, explain: 'It plays on the off-beats.' },
    { question: 'Two instruments that follow one clock…', options: ['Stay in time when the tempo changes', 'Drift', 'Must be muted'], answer: 0, explain: 'One leader, many followers.' },
    { question: 'A shorter AMP EG DECAY on the bass helps the kick because…', options: ['The bass stops before the next kick', 'It gets louder', 'It raises the pitch'], answer: 0, explain: 'They take turns in time.' },
  ],
};

export const SUB37_LESSONS: Lesson[] = [f1, f2, f3, f4, f5, f6, f7, f8, sd1, sd2, sd3, e1, e2, e3, e4, sq1, sq2, p1, st1, st2];
