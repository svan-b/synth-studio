// ============================================================================
// Analog Four MKII lessons (docs/PEDAGOGY.md)
//
// Paths: foundations (the Elektron way of working - track, page, encoder -
// then the voice in signal-flow order: oscillators -> filters -> envelopes ->
// modulation), sound design (acid bass, sync lead, drums from a synth voice,
// dub chords through the FX track), ear training (graded: one control wide ->
// one control fine -> two controls -> three mixed), sequencing (trigs and
// notes, parameter locks, conditions and micro timing, chains and songs),
// performance (mutes, keyboard, Quick Perf) and studio (with the Analog Rytm,
// the arranger).
//
// Every lesson starts from a known state: reset sounds (or a kit) and a
// project written for the lesson, so the sequencer always has something to
// play. Sequencer tasks are checked on the pattern data and carry a
// `solution` so "show me" and the lesson runner can complete them.
//
// Order: device lessons use orders below 1 so this path is recommended before
// the shared studio curriculum (orders 1-5); the A4 studio lessons (6+) come
// after it and build on it.
// ============================================================================

import type { ControlValue, Lesson, LessonCheckState, MultipleChoice } from '@/types';
import { asProject, getPattern, type Project, type Step } from '@/lib/sequencer/elektron';
import { LFO_MULTS, SEQ_TRACKS, V, dest } from './params';
import { KIT_BY_ID, LEN, kitValues, pat, project, soundTrackValues, type TrackSpec } from './kits';
import { SOUND_BY_ID } from './sounds';

const O = (n: number) => n / 100;
const SRC = 'Synth Studio · Elektron Analog Four MKII User Manual';

// ---------------------------------------------------------------- helpers

const num = (s: LessonCheckState, id: string) => Number(s.values[id] ?? 0);
const proj = (s: LessonCheckState): Project => asProject(s.data, SEQ_TRACKS);
/** The steps of a track in a pattern (default: the selected pattern) */
const stepsOf = (s: LessonCheckState, track: number, pattern?: string): Record<number, Step> => {
  const p = proj(s);
  return getPattern(p, pattern ?? p.active).tracks[track]?.steps ?? {};
};
/** Note trigs (not lock trigs) of a track, as [step index, step] */
const noteTrigs = (s: LessonCheckState, track: number, pattern?: string): [number, Step][] =>
  Object.entries(stepsOf(s, track, pattern)).filter(([, st]) => !st.trigless).map(([k, st]) => [Number(k), st]);
const instanceOf = (s: LessonCheckState, device: string) => Object.entries(s.instances).find(([, i]) => i.device === device)?.[0];
/** Track mutes ([FUNC] + [TRACK]) are the project's (manual p.37) */
const muted = (s: LessonCheckState, track: number) => !!proj(s).mutes?.includes(track);
/** The NOTE page's NOT for a track (what newly placed trigs get) */
const trackNote = (s: LessonCheckState, track: number) => getPattern(proj(s), proj(s).active).tracks[track]?.note ?? 60;
/** LFO speed x multiplier (128 = one cycle per bar); 0 when the multiplier is a free (BPM-less) one */
const lfoProduct = (s: LessonCheckState, lfo: string) => {
  const mult = LFO_MULTS[Math.round(num(s, `${lfo}_mul`))] ?? '';
  const m = /^x(\d+)(K?)$/.exec(mult);
  return m ? Math.abs(num(s, `${lfo}_spd`)) * Number(m[1]) * (m[2] ? 1024 : 1) : 0;
};

/** Every parameter of a sound on one track, plus overrides (param keys without the track prefix) */
function sound(id: string, track: number, extra: Record<string, number> = {}): Record<string, ControlValue> {
  const v: Record<string, ControlValue> = soundTrackValues(SOUND_BY_ID[id], track);
  for (const [k, x] of Object.entries(extra)) v[`t${track + 1}_${k}`] = x;
  return v;
}
/** Track-1 parameter values (keys without the prefix) */
const t1 = (p: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(p).map(([k, v]) => [`t1_${k}`, v]));

/** A project with one pattern, A01 */
const oneBar = (name: string, tracks: (TrackSpec | null)[], length = 16) => project({ A01: pat(name, length, tracks) });
/** A deep copy of a project, edited */
function edited(p: Project, fn: (p: Project) => void): Project {
  const c = JSON.parse(JSON.stringify(p)) as Project;
  fn(c);
  return c;
}
const setSteps = (p: Project, track: number, steps: Record<number, Step>, pattern = 'A01') => {
  Object.assign(p.patterns[pattern].tracks[track].steps, steps);
};

const NIGHT = KIT_BY_ID['night-drive'];
/** Night Drive: sounds of all four tracks + the FX track */
const nightValues = () => kitValues(NIGHT);
/** The Night Drive patterns in PATTERN mode, with an empty chain and song */
const nightPatterns = (active = 'A01'): Project => edited(NIGHT.project(), p => {
  p.mode = 'pattern';
  p.active = active;
  p.chain = [];
  p.song = { name: '', rows: [], loop: true };
});

const BASS_N = [45, 45, 57, 45, 48, 45, 55, 43];
const bass8ths = (): TrackSpec => ({ s: 'x.x.x.x.x.x.x.x.', n: BASS_N });

const playStep = (instruction: string, principle: string, explanation?: string) => ({
  kind: 'do' as const, control: 'play', targetValue: true, concept: 'sequencer-pattern' as const,
  instruction, principle, explanation,
  manualReference: 'Manual: Front panel - [PLAY]',
});

const mc = (question: string, options: string[], answer: number, explain: string): MultipleChoice => ({ question, options, answer, explain });

// ============================================================================
// FOUNDATIONS
// ============================================================================

const f1: Lesson = {
  id: 'analog-four-f1-tracks-pages', device: 'analog-four', path: 'foundations', order: O(1), difficulty: 'beginner',
  name: 'Tracks, pages and ten knobs',
  description: 'The Elektron way of working: pick a track, open a page, turn knobs A-J. The screen tells you what each knob does.',
  objective: 'Select a track and a parameter page, and shape that track\'s sound with the DATA ENTRY knobs.',
  source: `${SRC}, Front panel and Sound parameters`, estimatedMinutes: 6,
  concepts: ['signal-routing', 'filter-cutoff'],
  tags: ['navigation', 'tracks', 'pages'],
  start: {
    reset: true,
    data: oneBar('TOUR', [bass8ths(), { s: '..x...x...x...x.', n: [69, 72, 76, 72], len: LEN.s2 }]),
  },
  steps: [
    {
      kind: 'info', autoplay: true, concept: 'signal-routing',
      instruction: 'Listen: track 1 plays a bassline and track 2 a little melody. Each track is its own analog synth.',
      explanation: 'The Analog Four has four synth tracks (T1-T4), an FX track and a CV track. The ten knobs A-J edit whichever track and page you pick, and the screen labels every knob.',
      manualReference: 'Manual: Overview - tracks and sounds',
    },
    playStep('Press PLAY. The pattern loops until you press STOP.', 'A sequencer loops a pattern, so both hands stay free for the sound.',
      'Synced to the studio, PLAY starts the studio transport too. Space does the same.'),
    {
      kind: 'predict', control: 't1_flt1_frq', targetValue: 40, tolerance: 8, concept: 'filter-cutoff',
      instruction: 'T1 is selected. Press FILTER, then turn knob A (FRQ) down to about 40.',
      predict: mc('Which sound will change?', ['Only the T1 bass', 'Both tracks', 'Only the T2 melody'], 0,
        'The knobs edit the selected track, and T1 is lit. Track 2 keeps its own filter, so only the bass gets darker.'),
      principle: 'Lowering a low-pass filter\'s cutoff removes high harmonics, so the sound gets darker.',
      manualReference: 'Manual: FILTERS page - FRQ',
    },
    {
      kind: 'do', control: 'track', targetValue: 1, concept: 'signal-routing',
      instruction: 'Press T2. The screen and the knobs now belong to track 2.',
      principle: 'One set of knobs, many synths: the selected track decides what they edit.',
      explanation: 'The track keys light up: the selected track is red, the other audible tracks are green.',
    },
    {
      kind: 'do', control: 't2_flt1_frq', targetValue: 64, tolerance: 8, concept: 'filter-cutoff',
      instruction: 'Still on the FILTER page, turn knob A (FRQ) to about 64. Only the melody changes now.',
      principle: 'Each track has its own copy of every parameter.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: mc('You want to change track 3\'s envelope. What do you press first?', ['T3, then AMP', 'AMP, then turn a knob', 'FUNC + AMP'], 0,
        'Pick the track first, then the page: the knobs follow both. AMP alone would edit whichever track is selected now.'),
    },
    {
      kind: 'challenge', concept: 'filter-cutoff',
      instruction: 'Give each track its own colour: the bass dark and round, the melody bright.',
      checklist: [
        { text: 'T1 filter 1 FRQ below 60', check: s => num(s, 't1_flt1_frq') < 60 },
        { text: 'T2 filter 1 FRQ above 100', check: s => num(s, 't2_flt1_frq') > 100 },
      ],
      hints: ['Select the track first (T1 or T2), then the FILTER page.', 'Knob A is FRQ: down for dark, up for bright.'],
      solution: { values: { t1_flt1_frq: 46, t2_flt1_frq: 112 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why do the same ten knobs change different sounds?',
        model: 'They follow the selected track and page: the track key picks which synth, the page key picks which section, and the screen shows what each knob does right now.',
      },
    },
  ],
  review: [
    mc('On the Analog Four, the DATA ENTRY knobs A-J edit…', ['The selected track\'s selected page', 'Always track 1', 'Only the filter'], 0, 'Track key + page key decide what the knobs do.'),
    mc('How many synth tracks does the Analog Four have?', ['Four', 'Six', 'Eight'], 0, 'T1-T4 are synth voices; FX and CV are special tracks.'),
    mc('Turning filter 1 FRQ down makes a sound…', ['Darker', 'Lower in pitch', 'Longer'], 0, 'A low-pass removes the high harmonics; the note stays the same.'),
  ],
};

const f2: Lesson = {
  id: 'analog-four-f2-oscillators', device: 'analog-four', path: 'foundations', order: O(2), difficulty: 'beginner',
  name: 'Oscillators: wave, sub and detune',
  description: 'Where every A4 sound starts: two oscillators with a choice of waves, a sub-oscillator and detune.',
  objective: 'Choose a waveform, add the sub-oscillator and detune OSC 2 to make a thicker sound.',
  source: `${SRC}, OSC 1 and OSC 2 pages`, estimatedMinutes: 7,
  prerequisites: ['analog-four-f1-tracks-pages'],
  concepts: ['oscillator-waveform', 'subharmonics', 'oscillator-pitch'],
  tags: ['oscillator', 'pulse width', 'detune'],
  start: { reset: true, data: oneBar('OSC', [bass8ths()]) },
  steps: [
    playStep('Press PLAY. Track 1 plays a bassline with one sawtooth oscillator.', 'A sawtooth contains every harmonic, so it sounds bright and buzzy.'),
    {
      kind: 'listen', concept: 'oscillator-waveform', focus: ['t1_osc1_wav'],
      instruction: 'Compare the sawtooth with the pulse wave.',
      listen: {
        a: { t1_osc1_wav: 0 }, b: { t1_osc1_wav: 2 }, labels: ['SAW', 'PUL'],
        question: mc('Which one sounds more hollow?', ['PUL, the pulse', 'SAW, the sawtooth', 'They sound the same'], 0,
          'A square pulse has only odd harmonics, which sounds hollow or woody. The saw has all of them, so it is fuller and buzzier.'),
      },
    },
    {
      kind: 'do', control: 't1_osc1_wav', targetValue: 2, concept: 'oscillator-waveform',
      instruction: 'On the OSC 1 page, turn knob F (WAV) to PUL.',
      principle: 'A square wave has only odd harmonics, so it sounds hollow.',
      manualReference: 'Manual: OSC 1 page - WAV',
    },
    {
      kind: 'predict', control: 't1_osc1_pw', targetValue: 48, tolerance: 8, concept: 'oscillator-waveform',
      instruction: 'Turn knob H (PW) to about +48 to narrow the pulse.',
      predict: mc('Narrowing the pulse will make it sound…', ['Thinner and more nasal', 'An octave lower', 'Louder and fuller'], 0,
        'A narrow pulse brings even harmonics back and weakens the fundamental, so it gets thin and reedy. The pitch does not change.'),
      principle: 'Pulse width changes the balance of harmonics, not the pitch.',
    },
    {
      kind: 'do', control: 't1_osc1_sub', targetValue: 1, concept: 'subharmonics',
      instruction: 'Turn knob G (SUB) to 1OCT: a square wave one octave below OSC 1.',
      principle: 'A sub-oscillator adds weight an octave down without changing the note.',
      explanation: 'The other choices are 2OCT (two octaves down), 2PUL (a narrow pulse two octaves down) and 5TH (a fifth below OSC 1 itself).',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'subharmonics',
      quiz: mc('SUB on 1OCT plays…', ['One octave below OSC 1', 'One octave above OSC 1', 'A noise layer'], 0,
        'Sub-oscillators divide the oscillator\'s frequency, so they sit below it and add bass weight.'),
    },
    {
      kind: 'do', control: 't1_osc2_lev', targetValue: 100, tolerance: 10, concept: 'mixing',
      instruction: 'Press OSC 2 and turn knob E (LEV) up to about 100. OSC 2 was silent until now.',
      principle: 'Two oscillators mixed together make a richer sound than one.',
    },
    {
      kind: 'predict', control: 't1_osc2_det', targetValue: 10, tolerance: 5, concept: 'oscillator-pitch',
      instruction: 'Turn knob C (DET) to about +10.',
      predict: mc('Two oscillators slightly out of tune with each other sound…', ['Wider, with a slow beating', 'An octave higher', 'Quieter'], 0,
        'The waves drift in and out of phase, so the tone swirls and thickens. A lot of detune just sounds out of tune.'),
      principle: 'A small detune between oscillators makes a moving, thicker sound.',
    },
    {
      kind: 'challenge', concept: 'oscillator-waveform',
      instruction: 'Make a thick bass: OSC 2 clearly audible and a little detuned (not out of tune), with the sub on.',
      checklist: [
        { text: 'OSC 2 LEV 60 or more', check: s => num(s, 't1_osc2_lev') >= 60 },
        { text: 'OSC 2 DET between 3 and 30 (either direction)', check: s => Math.abs(num(s, 't1_osc2_det')) >= 3 && Math.abs(num(s, 't1_osc2_det')) <= 30 },
        { text: 'OSC 1 SUB on', check: s => num(s, 't1_osc1_sub') > 0 },
      ],
      hints: ['OSC 2\'s LEV and DET are on the OSC 2 page.', 'SUB is knob G on the OSC 1 page.', 'Try DET around +8: slow beats, still in tune.'],
      solution: { values: { t1_osc2_lev: 100, t1_osc2_det: 8, t1_osc1_sub: 1 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does DET do, and why does a little sound good?',
        model: 'It moves OSC 2 slightly off OSC 1\'s pitch. The two waves drift in and out of phase, which makes the tone move and sound thicker; too much just sounds out of tune.',
      },
    },
  ],
  review: [
    mc('Which wave has only odd harmonics?', ['Square (PUL at 50%)', 'Sawtooth', 'Noise'], 0, 'That is why it sounds hollow.'),
    mc('A sub-oscillator…', ['Adds a tone below the oscillator', 'Adds noise', 'Changes the filter'], 0, 'It divides the frequency: an octave or more down.'),
    mc('Changing pulse width changes…', ['The tone colour', 'The pitch', 'The tempo'], 0, 'The harmonics change; the note does not.'),
    mc('A little detune between two oscillators gives…', ['A slow beating, a thicker sound', 'A chord', 'Silence'], 0, 'The waves drift in and out of phase.'),
  ],
};

const f3: Lesson = {
  id: 'analog-four-f3-filters', device: 'analog-four', path: 'foundations', order: O(3), difficulty: 'beginner',
  name: 'Two filters in a row',
  description: 'Filter 1 is a 4-pole ladder low-pass; filter 2, right after it, is a multimode filter. Together they carve the tone.',
  objective: 'Shape the tone with filter 1\'s FRQ, RES and envelope DEP, then cut the low end with filter 2.',
  source: `${SRC}, FILTERS page`, estimatedMinutes: 8,
  prerequisites: ['analog-four-f2-oscillators'],
  concepts: ['filter-cutoff', 'filter-resonance', 'filter-type'],
  tags: ['filter', 'ladder', 'resonance', 'high-pass'],
  start: {
    reset: true,
    values: { page: V.FLTR },
    data: oneBar('FILTER', [{ s: 'x.xxx.x.x.xxx.x.', n: [45, 45, 57, 45, 45, 55, 43, 43, 55, 43, 47] }]),
  },
  steps: [
    playStep('Press PLAY. The bass plays through both filters, wide open.', 'An open filter lets every harmonic through: the full, bright sound.'),
    {
      kind: 'predict', control: 't1_flt1_frq', targetValue: 56, tolerance: 8, concept: 'filter-cutoff',
      instruction: 'Turn knob A (FRQ) down to about 56.',
      predict: mc('Filter 1 is a low-pass. Turning FRQ down will…', ['Remove the high harmonics: darker', 'Lower the pitch', 'Remove the bass'], 0,
        'A low-pass passes what is below the cutoff and removes what is above, so the tone gets darker. The note stays the same.'),
      principle: 'A low-pass filter removes harmonics above its cutoff, so the tone darkens.',
      manualReference: 'Manual: FILTERS page - filter 1 FRQ',
    },
    {
      kind: 'do', control: 't1_flt1_res', targetValue: 100, tolerance: 10, concept: 'filter-resonance',
      instruction: 'Turn knob B (RES) up to about 100. Listen for the whistle at the cutoff.',
      principle: 'Resonance boosts the frequencies at the cutoff, so the filter rings.',
    },
    {
      kind: 'listen', concept: 'filter-resonance', focus: ['t1_flt1_res'],
      instruction: 'Compare low and high resonance. Listen to the low end too.',
      listen: {
        a: { t1_flt1_res: 20 }, b: { t1_flt1_res: 115 }, labels: ['RES 20', 'RES 115'],
        question: mc('With high RES, the ladder filter…', ['Rings at the cutoff and loses some bass', 'Gets louder everywhere', 'Plays a different note'], 0,
          'Ladder resonance is feedback around the filter: it peaks at the cutoff and thins the bass, the classic ladder sound.'),
      },
    },
    {
      kind: 'predict', control: 't1_flt1_dep', targetValue: 40, tolerance: 8, concept: 'modulation-depth',
      instruction: 'Turn knob E (DEP) up to about +40.',
      predict: mc('DEP lets ENV F move filter 1 on every note. Each note will…', ['Start brighter and close down', 'Bend in pitch', 'Get louder'], 0,
        'ENV F jumps up at each note and falls back, and DEP decides how far it pushes FRQ. The filter opens and closes: the "wow" of analog bass.'),
      principle: 'An envelope on the cutoff makes the brightness change over each note.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-type',
      quiz: mc('Filter 1 removes the highs and filter 2 (a high-pass) removes the lows. What is left?', ['A band in the middle', 'Everything', 'Only the bass'], 0,
        'Filters in series stack up: each one takes its share away, so a low-pass then a high-pass leaves a band between them.'),
    },
    {
      kind: 'do', control: 't1_flt2_frq', targetValue: 50, tolerance: 8, concept: 'filter-type',
      instruction: 'Knob F is filter 2\'s FRQ, a high-pass (TYP HP2). Turn it up to about 50: the bass thins out.',
      principle: 'A high-pass filter removes everything below its cutoff, so the sound loses weight.',
      explanation: 'Knob H (TYP) switches filter 2 between low-pass, band-pass, high-pass, band-stop and peak types.',
    },
    {
      kind: 'challenge', concept: 'filter-cutoff',
      instruction: 'Make the bass sound like it comes out of a small radio: no deep bass and no sparkle.',
      checklist: [
        { text: 'Filter 2 is a high-pass (HP1 or HP2)', check: s => [3, 4].includes(num(s, 't1_flt2_typ')) },
        { text: 'Filter 2 FRQ at 45 or more (bass removed)', check: s => num(s, 't1_flt2_frq') >= 45 },
        { text: 'Filter 1 FRQ between 70 and 100 (sparkle removed)', check: s => num(s, 't1_flt1_frq') >= 70 && num(s, 't1_flt1_frq') <= 100 },
      ],
      hints: ['You need both filters: one for each end.', 'Filter 1 (knob A) takes off the top; filter 2 (knob F) takes off the bottom.', 'Try FRQ about 85 and filter 2 FRQ about 60.'],
      solution: { values: { t1_flt1_frq: 85, t1_flt2_frq: 60, t1_flt2_typ: 4 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why is it useful to have two filters in a row?',
        model: 'Filter 1 takes off the top and filter 2 shapes what is left - as a high-pass it cuts the bottom - so together they can carve a band or combine two characters.',
      },
    },
  ],
  review: [
    mc('Filter 1 on the Analog Four is…', ['A 4-pole ladder low-pass', 'A high-pass', 'A band-pass only'], 0, 'Filter 2 is the multimode one.'),
    mc('Raising RES on a ladder filter…', ['Adds a ringing peak at the cutoff', 'Changes the note', 'Adds a sub-oscillator'], 0, 'Feedback around the filter makes it ring.'),
    mc('A high-pass filter removes…', ['The frequencies below its cutoff', 'The frequencies above its cutoff', 'Only noise'], 0, 'It passes the highs.'),
    mc('Filter 1 DEP sets…', ['How far ENV F moves the cutoff', 'The resonance', 'The filter type'], 0, 'Envelope depth.'),
  ],
};

const f4: Lesson = {
  id: 'analog-four-f4-envelopes', device: 'analog-four', path: 'foundations', order: O(4), difficulty: 'beginner',
  name: 'Envelopes: AMP and ENV F',
  description: 'Every note has a shape over time. The AMP envelope shapes its loudness; ENV F shapes its brightness.',
  objective: 'Use the AMP envelope to shape each note\'s loudness and ENV F to shape its brightness over time.',
  source: `${SRC}, AMP and ENV pages`, estimatedMinutes: 8,
  prerequisites: ['analog-four-f3-filters'],
  concepts: ['envelope-attack', 'envelope-decay', 'envelope-sustain', 'envelope-release'],
  tags: ['envelope', 'ADSR', 'pluck'],
  start: {
    reset: true,
    values: { page: V.AMP },
    data: oneBar('ENVELOPE', [{ s: 'x...x...x...x...', n: [57, 60, 64, 62], len: LEN.s3 }]),
  },
  steps: [
    playStep('Press PLAY. Four notes a bar, each held for three steps.', 'An envelope gives every note the same shape over time.'),
    {
      kind: 'predict', control: 't1_amp_atk', targetValue: 72, tolerance: 8, concept: 'envelope-attack',
      instruction: 'On the AMP page, turn knob A (ATK) up to about 72.',
      predict: mc('A longer attack makes each note…', ['Fade in instead of starting hard', 'Ring on after you let go', 'Higher in pitch'], 0,
        'Attack is the time from silence to full level. Long attacks fade in, like bowed strings; ringing after release is REL\'s job.'),
      principle: 'Attack sets how long a note takes to reach full level.',
      manualReference: 'Manual: AMP page - ATK',
    },
    {
      kind: 'do', control: 't1_amp_sus', targetValue: 0, tolerance: 4, setup: { t1_amp_atk: 0 }, concept: 'envelope-sustain',
      instruction: 'ATK is back at 0. Turn knob C (SUS) down to 0.',
      principle: 'With no sustain, a note fades to silence after the decay, even while it is held.',
    },
    {
      kind: 'do', control: 't1_amp_dec', targetValue: 48, tolerance: 6, concept: 'envelope-decay',
      instruction: 'Turn knob B (DEC) down to about 48: short plucks.',
      principle: 'Decay sets how fast the level falls after the attack.',
    },
    {
      kind: 'listen', concept: 'envelope-decay', focus: ['t1_amp_dec'],
      instruction: 'Compare a short and a long decay.',
      listen: { a: { t1_amp_dec: 48 }, b: { t1_amp_dec: 80 }, labels: ['DEC 48', 'DEC 80'] },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-release',
      quiz: mc('Which stage makes a note keep sounding after the trig or key ends?', ['REL (release)', 'ATK (attack)', 'SUS (sustain)'], 0,
        'Release starts when the note ends. Sustain is a level, not a time: the level held while the note lasts.'),
    },
    {
      kind: 'predict', control: 't1_envf_dec', targetValue: 48, tolerance: 6, setup: { t1_flt1_frq: 50, t1_flt1_dep: 50, t1_envf_sus: 0, t1_amp_dec: 64, t1_amp_sus: 100 },
      concept: 'envelope-decay',
      instruction: 'Filter 1 is now dark with DEP up, and AMP holds the notes again. Press ENV and turn knob B (DEC) to about 48.',
      predict: mc('With a short ENV F decay, each note will…', ['Open bright for a moment, then go dark', 'Stay bright', 'Drop in pitch'], 0,
        'ENV F jumps up at the start of the note and falls back quickly, so the filter opens briefly: a pluck in the tone, while the level stays up.'),
      principle: 'A short filter envelope makes a pluck in the tone itself.',
      manualReference: 'Manual: ENV page - ENV F',
    },
    {
      kind: 'challenge', concept: 'envelope-decay',
      instruction: 'Make a plucked-string sound: a hard, bright start that dies away by itself, with a short ring after each note.',
      checklist: [
        { text: 'AMP ATK 10 or less', check: s => num(s, 't1_amp_atk') <= 10 },
        { text: 'AMP SUS 20 or less', check: s => num(s, 't1_amp_sus') <= 20 },
        { text: 'AMP DEC between 40 and 75', check: s => num(s, 't1_amp_dec') >= 40 && num(s, 't1_amp_dec') <= 75 },
        { text: 'AMP REL 25 or more (a little ring)', check: s => num(s, 't1_amp_rel') >= 25 },
        { text: 'Filter 1 DEP +20 or more', check: s => num(s, 't1_flt1_dep') >= 20 },
      ],
      hints: ['The loudness shape is on the AMP page; the brightness shape is ENV F plus DEP on the FILTER page.', 'SUS low and DEC medium make the note die away.', 'Try AMP DEC 60, SUS 0, REL 40.'],
      solution: { values: { t1_amp_atk: 0, t1_amp_sus: 0, t1_amp_dec: 60, t1_amp_rel: 40, t1_flt1_dep: 40 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between the AMP envelope and ENV F?',
        model: 'The AMP envelope shapes how loud each note is over time. ENV F is a second envelope that shapes the filter (and anything else you assign), so it changes the brightness over time.',
      },
    },
  ],
  review: [
    mc('A long AMP ATK makes notes…', ['Fade in', 'Stop sooner', 'Brighter'], 0, 'Attack is the rise time.'),
    mc('SUS is…', ['A level held while the note lasts', 'A time', 'The release'], 0, 'The other three stages are times.'),
    mc('For a pluck, you usually set…', ['SUS low and DEC short', 'ATK long', 'REL to the maximum'], 0, 'The note dies away by itself.'),
    mc('ENV F mainly shapes…', ['The filter over time', 'The tempo', 'The panning'], 0, 'Through filter 1 DEP, and its own destinations.'),
  ],
};

const f5: Lesson = {
  id: 'analog-four-f5-modulation', device: 'analog-four', path: 'foundations', order: O(5), difficulty: 'intermediate',
  name: 'LFOs and ENV 2: movement',
  description: 'LFOs repeat a movement; ENV 2 shapes every note. Both can move any parameter you pick as a destination.',
  objective: 'Send an LFO to the filter and ENV 2 to the pitch, setting destination, depth, speed and waveform.',
  source: `${SRC}, LFO and ENV pages`, estimatedMinutes: 9,
  prerequisites: ['analog-four-f4-envelopes'],
  concepts: ['lfo', 'modulation-source', 'modulation-depth'],
  tags: ['LFO', 'modulation', 'destination'],
  start: {
    reset: true,
    values: { page: V.LFO, ...t1({ flt1_frq: 70, flt1_res: 60 }) },
    data: oneBar('MOVE', [{ s: 'x.......x.......', n: [45, 48], len: LEN.s8 }]),
  },
  steps: [
    playStep('Press PLAY. Two long notes a bar. Nothing moves yet.', 'Modulation means one thing moving another automatically.'),
    {
      kind: 'predict', control: 't1_lfo1_depa', targetValue: 40, tolerance: 8, concept: 'lfo',
      instruction: 'On the LFO page, DST A (knob G) is F1 FRQ. Turn knob H (DEP) up to about 40.',
      predict: mc('What will you hear?', ['The brightness sweeping up and down, over and over', 'The pitch bending', 'Each note repeating'], 0,
        'An LFO is a slow, repeating wave. Sent to filter 1 FRQ, it opens and closes the filter in a loop.'),
      principle: 'An LFO repeats a movement; its depth sets how far the destination moves.',
      manualReference: 'Manual: LFO page - DST and DEP',
    },
    {
      kind: 'do', control: 't1_lfo1_spd', targetValue: 16, tolerance: 4, concept: 'lfo',
      instruction: 'Turn knob A (SPD) down to about 16: a slower sweep.',
      principle: 'LFO speed sets how often the movement repeats.',
      explanation: 'SPD times MUL (knob B) sets the rate against the tempo: 128 is one cycle per bar. MUL is x16 now, so SPD 16 gives two sweeps a bar.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: mc('SPD 32 with MUL x4 gives 32 x 4 = 128. How often does the LFO repeat?', ['Once a bar', 'Four times a bar', 'Every four bars'], 0,
        'On the Analog Four, SPD x MUL = 128 means one cycle per bar (16 steps), locked to the tempo.'),
    },
    {
      kind: 'do', control: 't1_lfo1_wav', targetValue: 2, concept: 'lfo',
      instruction: 'Turn knob F (WAV) to SQR: the filter now jumps between two places.',
      principle: 'The LFO waveform is the shape of the movement: smooth, stepped or random.',
    },
    {
      kind: 'listen', concept: 'lfo', focus: ['t1_lfo1_wav'],
      instruction: 'Compare a smooth triangle with random steps.',
      listen: { a: { t1_lfo1_wav: 0 }, b: { t1_lfo1_wav: 6 }, labels: ['TRI', 'RND'] },
    },
    {
      kind: 'do', control: 't1_env2_dsta', targetValue: dest('O1 PIT'), concept: 'modulation-source',
      instruction: 'Press ENV twice for ENV 2. Turn knob G (DST) to O1 PIT.',
      principle: 'An envelope can move any destination, not just the filter or the level.',
    },
    {
      kind: 'predict', control: 't1_env2_depa', targetValue: 50, tolerance: 8, setup: { t1_env2_sus: 0, t1_env2_dec: 56 }, concept: 'modulation-depth',
      instruction: 'ENV 2 has a short decay and no sustain. Turn knob H (DEP) up to about +50.',
      predict: mc('Each note will…', ['Start high and drop quickly to its pitch', 'Wobble up and down all the time', 'Get quieter'], 0,
        'ENV 2 jumps up at the note and decays to zero, so the pitch starts above the note and falls back: a zap. An LFO would keep wobbling.'),
      principle: 'A fast envelope on pitch makes a drop or zap at the start of every note.',
    },
    {
      kind: 'challenge', concept: 'lfo',
      instruction: 'Make a slow, smooth "breathing" filter: it opens and closes about once every one or two bars.',
      checklist: [
        { text: 'LFO 1 DST A is F1 FRQ', check: s => num(s, 't1_lfo1_dsta') === dest('F1 FRQ') },
        { text: 'LFO 1 DEP A of 20 or more (either direction)', check: s => Math.abs(num(s, 't1_lfo1_depa')) >= 20 },
        { text: 'A smooth wave: TRI or SIN', check: s => [0, 1].includes(num(s, 't1_lfo1_wav')) },
        { text: 'Slow: SPD x MUL between 48 and 160 (about one cycle per one or two bars)', check: s => { const p = lfoProduct(s, 't1_lfo1'); return p >= 48 && p <= 160; } },
      ],
      hints: ['Speed is SPD times MUL: 128 is one cycle a bar.', 'MUL x4 with SPD 16 gives 64: one cycle every two bars.', 'WAV TRI or SIN keeps it smooth.'],
      solution: { values: { t1_lfo1_dsta: dest('F1 FRQ'), t1_lfo1_depa: 50, t1_lfo1_wav: 1, t1_lfo1_spd: 16, t1_lfo1_mul: 2 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What do you set to make an LFO or envelope do something?',
        model: 'A destination (what moves) and a depth (how far it moves). For an LFO also the speed and waveform (how often and in what shape); for an envelope the times of its stages.',
      },
    },
  ],
  review: [
    mc('An LFO with a depth of 0…', ['Does nothing', 'Moves its destination fully', 'Stops the sequencer'], 0, 'Depth sets how far the destination moves.'),
    mc('On the Analog Four, SPD x MUL = 128 means…', ['One cycle per bar', 'One cycle per step', '128 cycles per bar'], 0, 'The LFO is locked to the tempo.'),
    mc('ENV 2 with a fast decay sent to pitch gives…', ['A pitch drop at each note', 'A vibrato', 'A chord'], 0, 'It fires once per note.'),
    mc('Which LFO wave jumps to a new random value each cycle?', ['RND', 'TRI', 'SIN'], 0, 'Random steps: sample & hold.'),
  ],
};

export const FOUNDATIONS: Lesson[] = [f1, f2, f3, f4, f5];

// ============================================================================
// SOUND DESIGN
// ============================================================================

const ACID = oneBar('ACID', [{ s: 'x.xsx.ax.xs.xx.a', n: [45, 45, 57, 45, 48, 45, 45, 55, 43, 45, 57] }]);
const slides = (s: LessonCheckState) => noteTrigs(s, 0).filter(([, st]) => st.slide).length;

const sd1: Lesson = {
  id: 'analog-four-sd1-acid-bass', device: 'analog-four', path: 'sound-design', order: O(6), difficulty: 'intermediate',
  name: 'Acid bass: squelch and slide',
  description: 'The squelchy acid line of acid house: a dark, resonant ladder filter opened by a short envelope on every note, with slides between notes.',
  objective: 'Build a squelchy acid bass from filter 1 FRQ, RES, an envelope sweep and note slides.',
  source: `${SRC}, FILTERS and ENV pages, trig types`, estimatedMinutes: 9,
  prerequisites: ['analog-four-f4-envelopes'],
  concepts: ['filter-resonance', 'envelope-decay', 'glide'],
  tags: ['acid', 'bass', 'slide', 'resonance'],
  start: { reset: true, values: { page: V.FLTR }, data: ACID },
  steps: [
    playStep('Press PLAY. A plain saw plays a 16-step line; two of its notes slide.', 'Acid is a simple line made exciting by its filter.'),
    {
      kind: 'do', control: 't1_flt1_frq', targetValue: 48, tolerance: 8, concept: 'filter-cutoff',
      instruction: 'Turn knob A (FRQ) down to about 48. The line goes dark.',
      principle: 'Starting dark leaves room for an envelope to open the filter.',
    },
    {
      kind: 'do', control: 't1_flt1_res', targetValue: 105, tolerance: 10, concept: 'filter-resonance',
      instruction: 'Turn knob B (RES) up to about 105: the filter starts to sing.',
      principle: 'High resonance makes the filter ring at its cutoff.',
    },
    {
      kind: 'predict', control: 't1_flt1_dep', targetValue: 45, tolerance: 8, concept: 'modulation-depth',
      instruction: 'Turn knob E (DEP) up to about +45.',
      predict: mc('On a dark, ringing filter, an envelope sweep on every note sounds…', ['Squelchy: a "yow" on each note', 'Like a drum', 'Out of tune'], 0,
        'The ringing peak sweeps up and back down with ENV F on every note, so each note talks. That vowel-like squelch is the acid sound.'),
      principle: 'A resonant filter swept by an envelope makes a vowel-like "yow".',
    },
    {
      kind: 'do', control: 't1_envf_sus', targetValue: 0, tolerance: 4, concept: 'envelope-sustain',
      instruction: 'Press ENV and turn knob C (SUS) to 0, so the filter closes again after every note.',
      principle: 'With no sustain on the filter envelope, every note gets its own short blip.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: mc('Which control sets how long each squelch lasts?', ['ENV F DEC', 'Filter 1 RES', 'AMP VOL'], 0,
        'The squelch is the filter envelope: its decay time sets how fast the filter closes. RES sets how strongly it rings, not how long.'),
    },
    {
      kind: 'predict', control: 'trig_mode', targetValue: 2, concept: 'glide', focus: ['key:FUNC'],
      instruction: 'Hold FUNC and press BANK G (Note Slide). Tapping a trig key now adds or removes a slide.',
      predict: mc('A slide trig makes its note…', ['Glide in pitch from the previous note', 'Repeat quickly', 'Play louder'], 0,
        'A slide bends smoothly from the last note to this one instead of jumping. Louder is what an accent does (FUNC + BANK F).'),
      principle: 'A slide glides from one note\'s pitch to the next instead of jumping.',
      explanation: 'SLI on the OSC 1&2 page sets the glide time. Press FUNC + BANK G again to go back to normal trigs.',
      manualReference: 'Manual: Sequencer - slide trigs',
    },
    {
      kind: 'challenge', concept: 'filter-resonance',
      instruction: 'Finish your acid line: dark, resonant and squelchy, with at least three slides.',
      checklist: [
        { text: 'Filter 1 RES 80 or more', check: s => num(s, 't1_flt1_res') >= 80 },
        { text: 'Filter 1 DEP +25 or more', check: s => num(s, 't1_flt1_dep') >= 25 },
        { text: 'ENV F SUS 20 or less', check: s => num(s, 't1_envf_sus') <= 20 },
        { text: 'At least three slide trigs on T1', check: s => slides(s) >= 3 },
      ],
      hints: ['With NOTE SLIDE on, tap any trig key that has a trig.', 'Two slides are already there: add one more.', 'Press FUNC + BANK G again to leave slide mode.'],
      solution: {
        values: { t1_flt1_res: 105, t1_flt1_dep: 45, t1_envf_sus: 0 },
        data: edited(ACID, p => { p.patterns.A01.tracks[0].steps[7] = { ...p.patterns.A01.tracks[0].steps[7], slide: true }; }),
      },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Which three settings make the acid squelch?',
        model: 'A low filter cutoff, high resonance so it rings, and a short filter envelope (decay, no sustain) with DEP up, so each note sweeps the ringing peak up and back down.',
      },
    },
  ],
  review: [
    mc('The acid "squelch" comes mainly from…', ['A resonant filter swept by an envelope', 'Noise', 'Reverb'], 0, 'Resonance plus a filter envelope.'),
    mc('A slide trig…', ['Glides the pitch into its note', 'Doubles the tempo', 'Mutes the track'], 0, 'The glide time is SLI on OSC 1&2.'),
    mc('ENV F SUS at 0 makes the filter…', ['Close after each note', 'Stay open', 'Self-oscillate'], 0, 'Every note gets its own blip.'),
  ],
};

const SYNC_LINE = oneBar('SYNC', [{ s: 'x..x..x.x..x..x.', n: [69, 72, 74, 76, 74, 72], len: LEN.s2 }]);

const sd2: Lesson = {
  id: 'analog-four-sd2-sync-lead', device: 'analog-four', path: 'sound-design', order: O(7), difficulty: 'intermediate',
  name: 'Sync lead: tearing harmonics',
  description: 'Hard sync locks OSC 2 to OSC 1, so tuning OSC 2 changes the tone, not the note. Swept by an envelope, it screams.',
  objective: 'Turn on oscillator sync and sweep OSC 2\'s pitch with ENV 2 for a classic sync lead.',
  source: `${SRC}, OSC 1&2 page (sync modes)`, estimatedMinutes: 8,
  prerequisites: ['analog-four-f5-modulation'],
  concepts: ['oscillator-sync', 'modulation-source', 'oscillator-pitch'],
  tags: ['sync', 'lead', 'ENV 2'],
  start: { reset: true, values: { page: V.OSC2, ...t1({ osc1_lev: 0, osc2_lev: 110, flt1_frq: 110, amp_rel: 30 }) }, data: SYNC_LINE },
  steps: [
    playStep('Press PLAY. You hear only OSC 2, a plain saw lead. OSC 1 is turned down but still running.', 'A synced oscillator can shape the tone even when you cannot hear the master.'),
    {
      kind: 'do', control: 't1_osc_smd', targetValue: 1, concept: 'oscillator-sync',
      instruction: 'Press OSC 2 again for the OSC 1&2 page. Turn knob B (SMD) to 1>2: OSC 1 now restarts OSC 2.',
      principle: 'Hard sync restarts one oscillator\'s wave every cycle of the other.',
      manualReference: 'Manual: OSC 1&2 page - SMD',
    },
    {
      kind: 'predict', control: 't1_osc2_tun', targetValue: 19, tolerance: 2, concept: 'oscillator-sync',
      instruction: 'Press OSC 2 and turn knob A (TUN) up to about +19.',
      predict: mc('With sync on, raising OSC 2\'s tune will…', ['Change the tone, not the note', 'Raise the note by 19 semitones', 'Make it quieter'], 0,
        'OSC 2 is restarted at OSC 1\'s rate, so the note stays OSC 1\'s. Tuning OSC 2 up packs more of its cycles into each restart: brighter, vocal harmonics.'),
      principle: 'In a synced pair, the master sets the pitch and the slave sets the tone.',
    },
    {
      kind: 'listen', concept: 'oscillator-sync', focus: ['t1_osc2_tun'],
      instruction: 'Compare a low and a high OSC 2 tune, both synced.',
      listen: { a: { t1_osc2_tun: 7 }, b: { t1_osc2_tun: 31 }, labels: ['TUN +7', 'TUN +31'] },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'oscillator-sync',
      quiz: mc('In a hard-sync patch, which oscillator decides the note you hear?', ['The master (OSC 1 with 1>2)', 'The slave (OSC 2)', 'The louder one'], 0,
        'The slave restarts on every master cycle, so the sound repeats at the master\'s frequency: that is the pitch.'),
    },
    {
      kind: 'do', control: 't1_env2_dsta', targetValue: dest('O2 PIT'), concept: 'modulation-source',
      instruction: 'Press ENV twice for ENV 2, and turn knob G (DST) to O2 PIT.',
      principle: 'Sweeping the slave\'s pitch is the classic sync-lead move.',
    },
    {
      kind: 'do', control: 't1_env2_depa', targetValue: 60, tolerance: 8, setup: { t1_env2_sus: 0, t1_env2_dec: 70 }, concept: 'modulation-depth',
      instruction: 'ENV 2 now has no sustain. Turn knob H (DEP) to about +60: every note starts with a sync sweep.',
      principle: 'An envelope on the slave\'s pitch makes the harmonics sweep on every note.',
    },
    {
      kind: 'challenge', concept: 'oscillator-sync',
      instruction: 'Make it scream: sync on, a sweep on every note, and a little vibrato.',
      checklist: [
        { text: 'A sync mode (SMD) is on', check: s => num(s, 't1_osc_smd') > 0 },
        { text: 'ENV 2 or LFO 1 moves O2 PIT with depth 30 or more', check: s => (num(s, 't1_env2_dsta') === dest('O2 PIT') && Math.abs(num(s, 't1_env2_depa')) >= 30) || (num(s, 't1_lfo1_dsta') === dest('O2 PIT') && Math.abs(num(s, 't1_lfo1_depa')) >= 30) },
        { text: 'Vibrato: OSC 1&2 VIB 10 or more', check: s => num(s, 't1_osc_vib') >= 10 },
      ],
      hints: ['Vibrato lives on the OSC 1&2 page too.', 'Knob J (VIB) is the depth, I (SPD) the rate and H (FAD) fades it in.', 'Try VIB about 20.'],
      solution: { values: { t1_osc_smd: 1, t1_env2_dsta: dest('O2 PIT'), t1_env2_depa: 60, t1_osc_vib: 20, t1_osc_vsp: 50 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does a sync lead keep its note while its tone sweeps?',
        model: 'The master oscillator restarts the slave on every cycle, so the pitch is the master\'s. Moving the slave\'s tune only changes how much of its wave fits in each cycle, which changes the harmonics.',
      },
    },
  ],
  review: [
    mc('With hard sync, tuning the slave oscillator changes…', ['The tone', 'The note', 'The tempo'], 0, 'The master keeps the pitch.'),
    mc('The A4\'s sync mode is set on…', ['The OSC 1&2 page (SMD)', 'The AMP page', 'The LFO page'], 0, 'Press OSC 2 twice.'),
    mc('A sync sweep on every note needs…', ['An envelope on the slave\'s pitch', 'Lots of reverb', 'A long attack'], 0, 'ENV 2 to O2 PIT, for example.'),
  ],
};

const DRUMS = oneBar('DRUMS', [{ s: 'x...x...x...x...' }, { s: '..x...x...x...x.' }]);

const sd3: Lesson = {
  id: 'analog-four-sd3-drums', device: 'analog-four', path: 'sound-design', order: O(8), difficulty: 'intermediate',
  name: 'Drums from a synth voice',
  description: 'Every A4 track can be a drum: a kick is a deep wave with a fast pitch drop; a hi-hat is high-passed noise.',
  objective: 'Turn track 1 into a punchy kick with a pitch envelope and track 2 into a tight hi-hat from noise.',
  source: `${SRC}, OSC, NOISE, ENV 2 and AMP pages`, estimatedMinutes: 9,
  prerequisites: ['analog-four-f5-modulation'],
  concepts: ['envelope-decay', 'noise', 'modulation-depth'],
  tags: ['kick', 'hi-hat', 'drums', 'percussion'],
  start: { reset: true, data: DRUMS },
  steps: [
    playStep('Press PLAY. T1 plays four beats and T2 the offbeats, both with the plain init saw.', 'Drums are short sounds with a fast envelope.'),
    {
      kind: 'do', control: 't1_osc1_wav', targetValue: 3, concept: 'oscillator-waveform',
      instruction: 'On T1\'s OSC 1 page, turn knob F (WAV) to TRI: a round, almost pure tone.',
      principle: 'A triangle has few harmonics, so it sounds round and deep, like a drum body.',
    },
    {
      kind: 'do', control: 't1_osc1_tun', targetValue: -24, tolerance: 2, concept: 'oscillator-pitch',
      instruction: 'Turn knob A (TUN) down to -24: two octaves lower.',
      principle: 'A kick\'s body is a very low tone.',
    },
    {
      kind: 'predict', control: 't1_env2_depa', targetValue: 80, tolerance: 10,
      setup: { t1_env2_dsta: dest('O1 PIT'), t1_env2_sus: 0, t1_env2_dec: 46, t1_osc_trg: 1 }, concept: 'modulation-depth',
      instruction: 'ENV 2 now goes to O1 PIT with a very short decay. Press ENV twice and turn knob H (DEP) up to about +80.',
      predict: mc('A very fast pitch drop at the start of each note sounds like…', ['The punch of a kick drum', 'A long laser zap', 'A chord'], 0,
        'Struck drums drop in pitch. A drop this fast is heard as punch and click; a slower drop would turn into a zap or a tom.'),
      principle: 'A fast pitch drop at the start of a note is heard as punch.',
      explanation: 'TRG on the OSC 1&2 page is ON, so the oscillator restarts at every trig and each kick clicks the same way.',
    },
    {
      kind: 'do', control: 't1_amp_sus', targetValue: 0, tolerance: 4, setup: { t1_amp_dec: 76 }, concept: 'envelope-sustain',
      instruction: 'Press AMP and turn knob C (SUS) to 0: the kick dies away by itself.',
      principle: 'Drums have no sustain: the sound decays after the hit.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: mc('What gives a synth kick its click and punch?', ['A fast pitch drop at the start', 'A long attack', 'High resonance'], 0,
        'The quick drop from a high pitch is what you hear as the beater. A long attack would remove the punch altogether.'),
    },
    {
      kind: 'do', control: 't2_noise_lev', targetValue: 110, tolerance: 10, setup: { t2_osc1_lev: 0 }, concept: 'noise',
      instruction: 'Press T2 (its oscillator is now off). Press OSC 1 twice for NOISE and turn knob E (LEV) up to about 110.',
      principle: 'Noise has every frequency at once, the raw material of cymbals and snares.',
    },
    {
      kind: 'do', control: 't2_flt2_frq', targetValue: 100, tolerance: 8, concept: 'filter-type',
      instruction: 'Press FILTER and turn knob F (filter 2 FRQ, a high-pass) up to about 100: only the sizzle is left.',
      principle: 'A high-pass on noise removes the body, leaving a hi-hat\'s sizzle.',
    },
    {
      kind: 'challenge', concept: 'envelope-decay',
      instruction: 'Make the hi-hat tight and crisp, and keep the kick punchy.',
      checklist: [
        { text: 'T2 AMP SUS 10 or less', check: s => num(s, 't2_amp_sus') <= 10 },
        { text: 'T2 AMP DEC 50 or less', check: s => num(s, 't2_amp_dec') <= 50 },
        { text: 'T2 filter 2 is a high-pass at FRQ 85 or more', check: s => [3, 4].includes(num(s, 't2_flt2_typ')) && num(s, 't2_flt2_frq') >= 85 },
        { text: 'T1 ENV 2 still drops the pitch (O1 PIT or OSC PIT, depth 30 or more)', check: s => [dest('O1 PIT'), dest('OSC PIT')].includes(num(s, 't1_env2_dsta')) && num(s, 't1_env2_depa') >= 30 },
      ],
      hints: ['Short and crisp is the AMP envelope on T2.', 'Turn T2\'s SUS to 0 and DEC down to about 40.'],
      solution: { values: { t2_amp_sus: 0, t2_amp_dec: 40, t2_flt2_typ: 4, t2_flt2_frq: 100, t1_env2_dsta: dest('O1 PIT'), t1_env2_depa: 80 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What makes a kick, and what makes a hi-hat, from one synth voice?',
        model: 'A kick is a low, round wave with a very fast pitch drop and a short decay; a hi-hat is noise with its low end removed by a high-pass filter and a very short envelope.',
      },
    },
  ],
  review: [
    mc('A synth kick is usually…', ['A low wave with a fast pitch drop', 'Filtered noise only', 'A long pad'], 0, 'The drop is the punch.'),
    mc('A hi-hat on a synth starts from…', ['Noise', 'A sub-oscillator', 'A triangle'], 0, 'High-passed noise.'),
    mc('Drum sounds normally have SUS at…', ['0', '127', 'Half'], 0, 'They decay after the hit.'),
  ],
};

const STABS = oneBar('STABS', [{ s: '..x...x...x...x.', n: [57, 57, 55, 53] }]);

const sd4: Lesson = {
  id: 'analog-four-sd4-dub-chords', device: 'analog-four', path: 'sound-design', order: O(9), difficulty: 'intermediate',
  name: 'Dub chords and the FX track',
  description: 'One voice plays a two-note chord when OSC 2 sits an interval above OSC 1. Sent into the FX track\'s delay and reverb, it turns into dub.',
  objective: 'Make a chord stab with an OSC 2 interval and send it into the FX track\'s delay and reverb.',
  source: `${SRC}, OSC 2, AMP and FX track pages`, estimatedMinutes: 9,
  prerequisites: ['analog-four-f4-envelopes'],
  concepts: ['oscillator-pitch', 'effects', 'envelope-decay'],
  tags: ['chords', 'dub', 'delay', 'reverb', 'FX track'],
  start: { reset: true, values: { page: V.OSC2 }, data: STABS },
  steps: [
    playStep('Press PLAY. Track 1 plays offbeat stabs with one plain saw.', 'Offbeat stabs leave room between them for echoes.'),
    {
      kind: 'do', control: 't1_osc2_lev', targetValue: 100, tolerance: 10, concept: 'mixing',
      instruction: 'On the OSC 2 page, turn knob E (LEV) up to about 100.',
      principle: 'Two oscillators at once can play two different pitches.',
    },
    {
      kind: 'predict', control: 't1_osc2_tun', targetValue: 7, tolerance: 0.5, concept: 'oscillator-pitch',
      instruction: 'Turn knob A (TUN) to +7.',
      predict: mc('OSC 2 seven semitones above OSC 1 sounds like…', ['A fifth: an open, chord-like stab', 'One note an octave up', 'Out of tune'], 0,
        'Seven semitones is a perfect fifth, the "power chord" interval. +3 or +4 would give a minor or major third, +12 an octave.'),
      principle: 'Tuning one oscillator to an interval turns a single voice into a two-note chord.',
    },
    {
      kind: 'do', control: 't1_amp_sus', targetValue: 0, tolerance: 4, setup: { t1_amp_dec: 66 }, concept: 'envelope-sustain',
      instruction: 'Press AMP and turn knob C (SUS) to 0: short, stabby chords.',
      principle: 'Short notes leave space for the echoes to be heard.',
    },
    {
      kind: 'do', control: 't1_amp_del', targetValue: 80, tolerance: 10, concept: 'effects',
      instruction: 'Turn knob G (DEL) up to about 80: the delay send.',
      principle: 'A send copies the sound into an effect; the dry sound stays and the echo is added.',
      manualReference: 'Manual: AMP page - effect sends',
    },
    {
      kind: 'do', control: 'track', targetValue: 4, concept: 'effects',
      instruction: 'Press FX. The FX track holds the chorus, delay and reverb that every track sends into.',
      principle: 'Send effects are shared: one delay and one reverb serve every track.',
    },
    {
      kind: 'do', control: 'fx_del_fb', targetValue: 90, tolerance: 8, concept: 'effects',
      instruction: 'Press AMP (on the FX track it is the DELAY page) and turn knob E (FDB) up to about 90.',
      principle: 'Feedback sends the echo back into the delay, so it repeats more times.',
    },
    {
      kind: 'listen', concept: 'timing-tempo', focus: ['fx_del_tim'],
      instruction: 'Compare two delay times, both locked to the tempo.',
      listen: { a: { fx_del_tim: 24 }, b: { fx_del_tim: 32 }, labels: ['TIM 24 (dotted 1/8)', 'TIM 32 (1/4)'] },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'effects',
      quiz: mc('Where do you set how many times the echoes repeat?', ['FDB on the FX track\'s DELAY page', 'DEL on T1\'s AMP page', 'RES on the FILTER page'], 0,
        'DEL on T1 decides how much of T1 goes into the delay. FDB (feedback) on the FX track decides how long the echoes keep going, for every track.'),
    },
    {
      kind: 'challenge', concept: 'effects',
      instruction: 'Make it dub: short chord stabs soaked in echo and some reverb, with the dry stab still clear.',
      checklist: [
        { text: 'OSC 2 audible at an interval (LEV 60+, TUN not 0)', check: s => num(s, 't1_osc2_lev') >= 60 && num(s, 't1_osc2_tun') !== 0 },
        { text: 'T1 AMP SUS 30 or less (short stabs)', check: s => num(s, 't1_amp_sus') <= 30 },
        { text: 'T1 delay send (DEL) 60 or more', check: s => num(s, 't1_amp_del') >= 60 },
        { text: 'T1 reverb send (REV) 30 or more', check: s => num(s, 't1_amp_rev') >= 30 },
        { text: 'FX delay FDB between 60 and 115 (long, not endless)', check: s => num(s, 'fx_del_fb') >= 60 && num(s, 'fx_del_fb') <= 115 },
      ],
      hints: ['The sends (DEL, REV) are on T1\'s AMP page.', 'The reverb send is knob H, next to DEL.', 'Try REV about 50.'],
      solution: { values: { t1_osc2_lev: 100, t1_osc2_tun: 7, t1_amp_sus: 0, t1_amp_del: 80, t1_amp_rev: 50, fx_del_fb: 90 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does the FX track do, and how does a sound get into it?',
        model: 'The FX track holds the shared chorus, delay and reverb. Each synth track sends some of its sound into them with CHO, DEL and REV on its AMP page; the FX track sets how the effects themselves sound.',
      },
    },
  ],
  review: [
    mc('OSC 2 tuned +7 semitones above OSC 1 plays…', ['A fifth', 'An octave', 'The same note'], 0, 'Seven semitones is a fifth.'),
    mc('On the A4, a track gets into the delay through…', ['Its DEL send on the AMP page', 'The FILTER page', 'The NOTE page'], 0, 'Sends are on the AMP page.'),
    mc('Delay FDB controls…', ['How many times the echoes repeat', 'The delay send of T1', 'The pitch'], 0, 'Feedback.'),
    mc('The FX track\'s effects are…', ['Shared by all tracks', 'Only for T1', 'Only for the CV track'], 0, 'Send effects.'),
  ],
};

export const SOUND_DESIGN: Lesson[] = [sd1, sd2, sd3, sd4];

// ============================================================================
// EAR TRAINING
// ============================================================================

const RIFF = oneBar('EAR', [{ s: 'x.x.x.x.x.x.x.x.', n: [45, 57, 45, 55, 45, 57, 48, 55], len: LEN.s2 }]);
const EAR_INFO = 'Press ▶ Target to hear the sound to copy and ▶ Mine to hear yours. Turn the knob, compare, then press Check.';

const e1: Lesson = {
  id: 'analog-four-e1-brightness', device: 'analog-four', path: 'ear-training', order: O(10), difficulty: 'beginner',
  name: 'Ear: how bright?',
  description: 'One control, big differences: hear how far filter 1 is open.',
  objective: 'Judge by ear how bright a sound is and match it with filter 1 FRQ.',
  source: 'Synth Studio · ear training', estimatedMinutes: 5,
  prerequisites: ['analog-four-f3-filters'],
  concepts: ['filter-cutoff'],
  tags: ['ear training', 'filter'],
  start: { reset: true, values: { page: V.FLTR, ...t1({ flt1_res: 40, amp_sus: 80, amp_rel: 20 }) }, data: RIFF },
  steps: [
    {
      kind: 'listen', concept: 'filter-cutoff', focus: ['t1_flt1_frq'],
      instruction: 'First hear the two ends of filter 1 FRQ: dark and bright.',
      listen: { a: { t1_flt1_frq: 45 }, b: { t1_flt1_frq: 110 }, labels: ['FRQ 45', 'FRQ 110'] },
      explanation: EAR_INFO,
    },
    {
      kind: 'match', concept: 'filter-cutoff', instruction: 'Recreate the target\'s brightness with knob A (FRQ).',
      match: { target: { t1_flt1_frq: 50 }, controls: ['t1_flt1_frq'] },
      hints: ['Is the target darker or brighter than yours?', 'It is quite dark: FRQ is in the lower half.', 'Try around 50.'],
    },
    {
      kind: 'match', concept: 'filter-cutoff', instruction: 'A new target. Match it with FRQ again.',
      match: { target: { t1_flt1_frq: 100 }, controls: ['t1_flt1_frq'] },
      hints: ['Listen for the fizz above the notes.', 'Much brighter than the last one: the upper half.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-cutoff',
      quiz: mc('A bass sounds muffled in a mix. Which way do you turn filter 1 FRQ?', ['Up', 'Down', 'It is a RES problem'], 0,
        'Muffled means too few high harmonics, so open the filter. Resonance adds a peak, not general brightness.'),
    },
    {
      kind: 'match', concept: 'filter-cutoff', instruction: 'One more: somewhere in the middle.',
      match: { target: { t1_flt1_frq: 74 }, controls: ['t1_flt1_frq'] },
      hints: ['Between the last two targets.', 'Closer to the bright one than the dark one.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What did you listen for to judge brightness?',
        model: 'How much high fizz sits above the notes: darker means fewer upper harmonics, brighter means more, while the pitch stays the same.',
      },
    },
  ],
  review: [
    mc('Brightness is mostly about…', ['How many upper harmonics are left', 'The note', 'The tempo'], 0, 'The filter removes harmonics.'),
    mc('To make a sound duller, turn filter 1 FRQ…', ['Down', 'Up', 'To RES'], 0, 'Low-pass.'),
    mc('When matching by ear, the best first question is…', ['Is mine darker or brighter?', 'What colour is the screen?', 'How loud is the room?'], 0, 'Find the direction first.'),
  ],
};

const e2: Lesson = {
  id: 'analog-four-e2-decay', device: 'analog-four', path: 'ear-training', order: O(11), difficulty: 'intermediate',
  name: 'Ear: how long?',
  description: 'One control, small differences: hear the length of a pluck.',
  objective: 'Tell apart small differences in note length and match them with AMP DEC.',
  source: 'Synth Studio · ear training', estimatedMinutes: 6,
  prerequisites: ['analog-four-f4-envelopes', 'analog-four-e1-brightness'],
  concepts: ['envelope-decay'],
  tags: ['ear training', 'envelope'],
  start: {
    reset: true,
    values: { page: V.AMP, ...t1({ amp_sus: 0, amp_rel: 10, flt1_frq: 90 }) },
    data: oneBar('EAR', [{ s: 'x...x...x...x...', n: [57, 57, 60, 55], len: LEN.s4 }]),
  },
  steps: [
    {
      kind: 'listen', concept: 'envelope-decay', focus: ['t1_amp_dec'],
      instruction: 'Hear a short and a long decay. The sustain is 0, so every note dies away by itself.',
      listen: { a: { t1_amp_dec: 56 }, b: { t1_amp_dec: 80 }, labels: ['DEC 56', 'DEC 80'] },
      explanation: EAR_INFO,
    },
    {
      kind: 'match', concept: 'envelope-decay', instruction: 'Match the length of the target\'s notes with knob B (DEC).',
      match: { target: { t1_amp_dec: 76 }, controls: ['t1_amp_dec'], tolerance: 0.05 },
      hints: ['Longer or shorter than yours?', 'The target rings longer.', 'Try around 76.'],
    },
    {
      kind: 'match', concept: 'envelope-decay', instruction: 'A shorter target this time.',
      match: { target: { t1_amp_dec: 58 }, controls: ['t1_amp_dec'], tolerance: 0.05 },
      hints: ['Count how long the tail lasts.', 'Clearly shorter than the last one.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: mc('Two plucks differ only in DEC. What do you listen to?', ['How long each note takes to fade', 'How bright the start is', 'The pitch'], 0,
        'Decay is a time: how quickly the level falls. The start stays the same.'),
    },
    {
      kind: 'match', concept: 'envelope-decay', instruction: 'The last one is between the two.',
      match: { target: { t1_amp_dec: 68 }, controls: ['t1_amp_dec'], tolerance: 0.05 },
      hints: ['Between 58 and 76.', 'A little nearer the long one.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How did you judge small differences in length?',
        model: 'By listening to the tail of each note - how long it lasts before silence, or how much of the gap to the next note it fills - and comparing it with the target back to back.',
      },
    },
  ],
  review: [
    mc('With SUS at 0, DEC sets…', ['How long each note lasts', 'How loud it starts', 'Its pitch'], 0, 'The note fades to silence.'),
    mc('A good reference when judging length is…', ['The gap to the next note', 'The screen', 'The filter'], 0, 'How much of the gap it fills.'),
    mc('Longer DEC values…', ['Make longer tails', 'Make shorter tails', 'Change the pitch'], 0, 'Decay is time.'),
  ],
};

const e3: Lesson = {
  id: 'analog-four-e3-filter-pair', device: 'analog-four', path: 'ear-training', order: O(12), difficulty: 'intermediate',
  name: 'Ear: cutoff and resonance',
  description: 'Two controls at once: how bright, and how much it rings.',
  objective: 'Hear cutoff and resonance separately in one sound, and match both.',
  source: 'Synth Studio · ear training', estimatedMinutes: 7,
  prerequisites: ['analog-four-e1-brightness'],
  concepts: ['filter-cutoff', 'filter-resonance'],
  tags: ['ear training', 'filter', 'resonance'],
  start: { reset: true, values: { page: V.FLTR, ...t1({ amp_sus: 90, amp_rel: 20 }) }, data: RIFF },
  steps: [
    {
      kind: 'listen', concept: 'filter-resonance', focus: ['t1_flt1_res'],
      instruction: 'Same cutoff, different resonance. Listen for the ringing peak.',
      listen: { a: { t1_flt1_frq: 64, t1_flt1_res: 10 }, b: { t1_flt1_frq: 64, t1_flt1_res: 110 }, labels: ['RES 10', 'RES 110'] },
      explanation: EAR_INFO,
    },
    {
      kind: 'match', concept: 'filter-resonance', instruction: 'Match the target with knobs A (FRQ) and B (RES).',
      match: { target: { t1_flt1_frq: 60, t1_flt1_res: 100 }, controls: ['t1_flt1_frq', 't1_flt1_res'] },
      hints: ['First find the brightness, then the ring.', 'It rings strongly: RES is high.', 'FRQ is in the lower half.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-resonance',
      quiz: mc('A resonant filter rings at…', ['Its cutoff frequency', 'The note\'s octave', 'A random pitch'], 0,
        'Resonance boosts a narrow band at the cutoff, so moving FRQ moves the ring.'),
    },
    {
      kind: 'match', concept: 'filter-cutoff', instruction: 'A new target: match both again.',
      match: { target: { t1_flt1_frq: 96, t1_flt1_res: 30 }, controls: ['t1_flt1_frq', 't1_flt1_res'] },
      hints: ['Brighter than before.', 'Hardly any ring now.'],
    },
    {
      kind: 'match', concept: 'filter-resonance', instruction: 'Last one: in between.',
      match: { target: { t1_flt1_frq: 76, t1_flt1_res: 70 }, controls: ['t1_flt1_frq', 't1_flt1_res'] },
      hints: ['A clear ring, but not a whistle.', 'Medium brightness.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How can you tell cutoff and resonance apart by ear?',
        model: 'Cutoff is the overall brightness; resonance is a ringing, whistling peak at one pitch. Find the brightness first, then judge how strongly it rings.',
      },
    },
  ],
  review: [
    mc('Resonance sounds like…', ['A ringing peak at the cutoff', 'More bass', 'A longer note'], 0, 'A narrow boost.'),
    mc('When matching two controls, it helps to…', ['Adjust one at a time', 'Turn both at once quickly', 'Guess'], 0, 'Isolate them.'),
    mc('Filter 1 FRQ mainly sets…', ['Brightness', 'Ringing', 'Length'], 0, 'Cutoff = brightness.'),
  ],
};

const e4: Lesson = {
  id: 'analog-four-e4-mixed', device: 'analog-four', path: 'ear-training', order: O(13), difficulty: 'advanced',
  name: 'Ear: wave, filter or envelope?',
  description: 'Three controls from three pages. Was it the oscillator, the filter or the envelope?',
  objective: 'Recreate a sound by ear when its waveform, brightness and length all differ.',
  source: 'Synth Studio · ear training', estimatedMinutes: 8,
  prerequisites: ['analog-four-e2-decay', 'analog-four-e3-filter-pair'],
  concepts: ['oscillator-waveform', 'filter-cutoff', 'envelope-decay'],
  tags: ['ear training', 'interleaving'],
  start: { reset: true, values: { page: V.OSC1, ...t1({ amp_sus: 0, amp_rel: 16 }) }, data: RIFF },
  steps: [
    {
      kind: 'listen', concept: 'oscillator-waveform', focus: ['t1_osc1_wav'],
      instruction: 'Start with the source: compare a sawtooth and a triangle.',
      listen: {
        a: { t1_osc1_wav: 0 }, b: { t1_osc1_wav: 3 }, labels: ['SAW', 'TRI'],
        question: mc('Which one has fewer harmonics?', ['TRI', 'SAW'], 0, 'The triangle is nearly pure; the saw has every harmonic.'),
      },
      explanation: EAR_INFO,
    },
    {
      kind: 'match', concept: 'oscillator-waveform',
      instruction: 'Match the target: OSC 1 WAV (knob F), filter 1 FRQ and AMP DEC.',
      match: { target: { t1_osc1_wav: 2, t1_flt1_frq: 72, t1_amp_dec: 52 }, controls: ['t1_osc1_wav', 't1_flt1_frq', 't1_amp_dec'] },
      hints: ['Wave first: buzzy, hollow or round?', 'Then brightness, then length.', 'Hollow is PUL; the target is medium-dark and short.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-cutoff',
      quiz: mc('Your note is shorter and darker than the target. Which two pages do you visit?', ['AMP and FILTER', 'OSC 1 and LFO', 'ENV and NOTE'], 0,
        'Length is the AMP envelope; darkness is the filter. The waveform changes the character, not mainly the length.'),
    },
    {
      kind: 'match', concept: 'envelope-decay',
      instruction: 'A new target with the same three controls.',
      match: { target: { t1_osc1_wav: 3, t1_flt1_frq: 100, t1_amp_dec: 76 }, controls: ['t1_osc1_wav', 't1_flt1_frq', 't1_amp_dec'] },
      hints: ['Round and soft: which wave?', 'Fairly bright, and longer than before.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How did you split the problem when three things were different?',
        model: 'One section at a time: first the character of the source (the waveform), then the brightness (the filter), then the length (the envelope), comparing with the target after each change.',
      },
    },
  ],
  review: [
    mc('A hollow, woody tone points to…', ['A pulse or square wave', 'A long decay', 'A low cutoff'], 0, 'Odd harmonics only.'),
    mc('A note that fades too quickly needs…', ['A longer AMP DEC', 'A higher cutoff', 'A different wave'], 0, 'Length is the envelope.'),
    mc('Good practice when three things differ:', ['Fix one section at a time', 'Turn everything at once', 'Start over'], 0, 'Divide and compare.'),
  ],
};

export const EAR_TRAINING: Lesson[] = [e1, e2, e3, e4];

// ============================================================================
// SEQUENCING
// ============================================================================

const SQ1_START = oneBar('TRIGS', [{ s: 'x...x...x...x...' }]);
const SQ1_TRIGS = edited(SQ1_START, p => setSteps(p, 1, { 0: {}, 3: {}, 6: {}, 10: {} }));
const SQ1_NOTE = edited(SQ1_TRIGS, p => setSteps(p, 1, { 3: { note: 67 } }));
const SQ1_LEN = edited(SQ1_NOTE, p => setSteps(p, 1, { 0: { len: LEN.s4 } }));
const SQ1_FULL = edited(SQ1_START, p => setSteps(p, 1, {
  0: { note: 48, len: LEN.s2 }, 3: { note: 48 }, 6: { note: 60 }, 8: { note: 51 }, 10: { note: 48 }, 12: { note: 55 }, 14: { note: 58 },
}));
/** Notes of a track's trigs (trigs without a note play the track's default) */
const trigNotes = (s: LessonCheckState, track: number) => {
  const p = proj(s);
  const def = getPattern(p, p.active).tracks[track]?.note ?? 60;
  return noteTrigs(s, track).map(([, st]) => st.note ?? def);
};

const sq1: Lesson = {
  id: 'analog-four-sq1-trigs-notes', device: 'analog-four', path: 'sequencing', order: O(14), difficulty: 'beginner',
  name: 'Trigs and notes',
  description: 'The 16 trig keys are the steps of the selected track. Tap to place trigs, hold a trig and play a key to give it a note.',
  objective: 'Place trigs on a track, give them notes from the keyboard and set how long a note lasts.',
  source: `${SRC}, Sequencer - GRID RECORDING`, estimatedMinutes: 8,
  prerequisites: ['analog-four-f1-tracks-pages'],
  concepts: ['sequencer-pattern', 'oscillator-pitch'],
  tags: ['sequencer', 'trigs', 'notes', 'grid recording'],
  start: { reset: true, values: { ...sound('drum-kick', 0), ...sound('bass-saw', 1), page: V.NOTE }, data: SQ1_START },
  steps: [
    playStep('Press PLAY. T1 plays a kick on every beat.', 'A trig is an instruction to play on that step.'),
    {
      kind: 'do', control: 'track', targetValue: 1, concept: 'sequencer-pattern',
      instruction: 'Press T2. The trig keys now show track 2\'s steps, and they are all empty.',
      principle: 'Every track has its own row of steps.',
    },
    {
      kind: 'info', concept: 'sequencer-pattern',
      instruction: 'Tap trig keys 1, 4, 7 and 11 to place bass trigs. REC is lit, so taps add or remove trigs.',
      explanation: 'This is GRID RECORDING: the trig keys are the 16 steps of the selected track. Tap a lit key again to remove its trig.',
      check: s => [0, 3, 6, 10].every(i => { const st = stepsOf(s, 1)[i]; return !!st && !st.trigless; }),
      solution: { data: SQ1_TRIGS },
    },
    {
      kind: 'predict', concept: 'sequencer-pattern',
      instruction: 'Hold trig key 4 and press a key on the A4\'s keyboard, then let go.',
      predict: mc('What happens when you hold a trig and press a key?', ['That trig stores the key\'s note', 'The whole track transposes', 'The key plays once and nothing is stored'], 0,
        'Holding a trig makes the keyboard edit it: the note is stored on that step. The other trigs keep their notes.'),
      principle: 'A held trig turns the keyboard into a note editor for that step.',
      // a placed trig already carries the NOTE page's NOT: the key press gives it its own
      check: s => {
        const st = stepsOf(s, 1)[3];
        return !!st && !st.trigless && typeof st.note === 'number' && (st.note !== trackNote(s, 1) || (s.events?.['kb:on'] ?? 0) > 0);
      },
      solution: { data: SQ1_NOTE },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: mc('With no trig held you change NOT on the NOTE page. Which trigs get the new note?', ['Only the trigs you place from now on', 'Every trig on the track', 'None of them'], 0,
        'A trig keeps the NOT, VEL and LEN it was placed with: the NOTE page sets them for new trigs. To change one trig, hold it and set its note.'),
    },
    {
      kind: 'info', concept: 'sequencer-pattern',
      instruction: 'Hold trig key 1 and turn knob C (LEN) on the NOTE page to 2 steps or more: a longer note.',
      explanation: 'With a trig held, the NOTE page edits that trig: NOT is its note, VEL its velocity, LEN its length.',
      check: s => (stepsOf(s, 1)[0]?.len ?? 0) >= LEN.s2,
      solution: { data: SQ1_LEN },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Write a one-bar bassline on T2: at least six trigs and at least three different notes.',
      checklist: [
        { text: 'At least 6 trigs on T2', check: s => noteTrigs(s, 1).length >= 6 },
        { text: 'At least 3 different notes', check: s => new Set(trigNotes(s, 1)).size >= 3 },
      ],
      hints: ['Tap more trig keys to add trigs.', 'Hold a trig and press a keyboard key for its note.', 'Root, octave and fifth make a strong bassline.'],
      solution: { data: SQ1_FULL },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do you write a melody on the Analog Four\'s sequencer?',
        model: 'Place trigs where the notes should start, then hold each trig and press a keyboard key to give it its note; LEN on the NOTE page sets how long it lasts.',
      },
    },
  ],
  review: [
    mc('In GRID RECORDING, tapping a trig key…', ['Adds or removes a trig on that step', 'Plays the whole pattern', 'Mutes the track'], 0, 'REC lit = grid recording.'),
    mc('To give one trig a new note…', ['Hold it and press a keyboard key', 'Turn TRACK LEVEL', 'Press FUNC + PLAY'], 0, 'The held trig stores the note.'),
    mc('LEN on the NOTE page sets…', ['How long the note lasts', 'The tempo', 'The swing'], 0, 'Note length, in steps.'),
  ],
};

const SQ2_START = oneBar('LOCKS', [{ s: 'x.x.x.x.x.......', n: [45, 57, 45, 55, 43], at: { 8: { len: LEN.s8 } } }]);
const lockOn = (p: Project, step: number, locks: Record<string, number>) => {
  const st = p.patterns.A01.tracks[0].steps[step] ?? { trigless: true };
  p.patterns.A01.tracks[0].steps[step] = { ...st, locks: { ...(st.locks ?? {}), ...locks } };
};
const SQ2_L1 = edited(SQ2_START, p => lockOn(p, 2, { flt1_frq: 100 }));
const SQ2_L3 = edited(SQ2_L1, p => { lockOn(p, 4, { flt1_frq: 78 }); lockOn(p, 6, { flt1_frq: 118 }); });
const SQ2_LT = edited(SQ2_L3, p => lockOn(p, 12, { flt1_res: 115 }));

const sq2: Lesson = {
  id: 'analog-four-sq2-plocks', device: 'analog-four', path: 'sequencing', order: O(15), difficulty: 'intermediate',
  name: 'Parameter locks',
  description: 'Hold a trig and turn a knob: that step gets its own value. Hold an empty step and a lock trig changes the sound without playing a note.',
  objective: 'Lock a parameter on single trigs, and use a lock trig to change a long note halfway through.',
  source: `${SRC}, Sequencer - parameter locks`, estimatedMinutes: 8,
  prerequisites: ['analog-four-sq1-trigs-notes'],
  concepts: ['parameter-locks', 'filter-cutoff'],
  tags: ['p-locks', 'trigless', 'sequencer'],
  start: { reset: true, values: { ...sound('bass-saw', 0, { flt1_frq: 56, flt1_res: 60 }), page: V.FLTR }, data: SQ2_START },
  steps: [
    playStep('Press PLAY. Four short notes, then one long note.', 'A pattern repeats exactly - until you lock something.'),
    {
      kind: 'predict', concept: 'parameter-locks',
      instruction: 'Hold trig key 3 and turn knob A (FRQ) up to about 100, then let go.',
      predict: mc('What happens to the other steps?', ['They keep the knob\'s own value: only step 3 is brighter', 'They all get brighter', 'Step 3 is muted'], 0,
        'A parameter lock stores a value on one trig. Every other trig keeps using the knob\'s normal value.'),
      principle: 'A parameter lock gives one trig its own value; the others keep the knob\'s value.',
      check: s => (stepsOf(s, 0)[2]?.locks?.flt1_frq ?? 0) >= 85,
      solution: { data: SQ2_L1 },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'parameter-locks',
      quiz: mc('Now you turn FRQ without holding a trig. What changes?', ['Every trig except the locked one', 'Only the locked trig', 'Nothing'], 0,
        'The knob sets the track\'s value; the lock overrides it on its own step only.'),
    },
    {
      kind: 'challenge', concept: 'parameter-locks',
      instruction: 'Make the line open and close: lock FRQ on at least two more trigs, all at different values.',
      checklist: [
        { text: 'At least 3 trigs with a FRQ lock', check: s => noteTrigs(s, 0).filter(([, st]) => st.locks?.flt1_frq !== undefined).length >= 3 },
        { text: 'At least 3 different locked values', check: s => new Set(noteTrigs(s, 0).map(([, st]) => st.locks?.flt1_frq).filter(v => v !== undefined)).size >= 3 },
      ],
      hints: ['Hold a trig key, turn knob A, let go.', 'Try one trig very bright and one in the middle.'],
      solution: { data: SQ2_L3 },
    },
    {
      kind: 'predict', concept: 'parameter-locks',
      instruction: 'Hold the empty trig key 13 and turn knob B (RES) up to about 115.',
      predict: mc('Step 13 has no trig. What will you hear there?', ['No new note: the long note starts to ring from there', 'A new note', 'Nothing will ever change'], 0,
        'Turning a knob on an empty step places a lock trig: it changes parameters at that step without playing a note, so the long note changes halfway.'),
      principle: 'A lock trig changes parameters at a step without starting a new note.',
      check: s => { const st = stepsOf(s, 0)[12]; return !!st?.trigless && (st.locks?.flt1_res ?? 0) >= 95; },
      solution: { data: SQ2_LT },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is a parameter lock, and what is a lock trig for?',
        model: 'A parameter lock gives one trig its own value for a parameter. A lock trig is a step with locks but no note, so it changes the sound in the middle of a note or between notes.',
      },
    },
  ],
  review: [
    mc('A parameter lock affects…', ['Only the trig it is on', 'The whole track', 'Every pattern'], 0, 'One trig, one value.'),
    mc('To place a lock, you…', ['Hold a trig and turn a knob', 'Press FUNC + PLAY', 'Turn MAIN VOLUME'], 0, 'Hold, turn, let go.'),
    mc('A lock trig (trigless lock)…', ['Changes parameters without a new note', 'Plays a note twice', 'Mutes the track'], 0, 'No note, just locks.'),
  ],
};

const SQ3_START = oneBar('CONDS', [{ s: 'x...x...x...x...' }, { s: 'x.x.x.x.x.x.x.xx' }]);
const condOn = (p: Project, step: number, patch: Partial<Step>) => { p.patterns.A01.tracks[1].steps[step] = { ...p.patterns.A01.tracks[1].steps[step], ...patch }; };
const SQ3_C1 = edited(SQ3_START, p => condOn(p, 14, { cond: '1:2' }));
const SQ3_C2 = edited(SQ3_C1, p => condOn(p, 15, { cond: 'FILL' }));
const SQ3_M = edited(SQ3_C2, p => condOn(p, 6, { micro: 8 }));
const SQ3_FULL = edited(SQ3_M, p => condOn(p, 10, { cond: '50%' }));
const conds = (s: LessonCheckState) => noteTrigs(s, 1).map(([, st]) => st.cond ?? '').filter(c => c !== '');

const sq3: Lesson = {
  id: 'analog-four-sq3-conditions', device: 'analog-four', path: 'sequencing', order: O(16), difficulty: 'intermediate',
  name: 'Trig conditions and micro timing',
  description: 'Conditions decide whether a trig plays this time round: every other loop, at random, only in fills. Micro timing moves a trig off the grid.',
  objective: 'Make a short pattern evolve with trig conditions, and shift trigs off the grid with micro timing.',
  source: `${SRC}, Sequencer - trig conditions, micro timing`, estimatedMinutes: 9,
  prerequisites: ['analog-four-sq2-plocks'],
  concepts: ['sequencer-pattern', 'timing-tempo'],
  tags: ['conditions', 'fill', 'probability', 'micro timing'],
  start: { reset: true, values: { ...sound('drum-kick', 0), ...sound('drum-hat', 1), track: 1, page: V.NOTE }, data: SQ3_START },
  steps: [
    playStep('Press PLAY. T1 kicks; T2 plays a hi-hat on every 8th note, plus one on the last step.', 'A short loop repeats exactly unless something tells it not to.'),
    {
      kind: 'predict', concept: 'sequencer-pattern',
      instruction: 'T2 is selected. Hold trig key 15 and turn knob E (TRC) to 1:2.',
      predict: mc('A trig with the condition 1:2 plays…', ['On the first of every two loops', 'Half as loud', 'At half speed'], 0,
        'A:B means "play on loop A of every B loops". 1:2 plays every other time round, so the bar alternates.'),
      explanation: 'TRC on the NOTE page edits the held trig. You can also open the trig editor with a long press on the trig key.',
      principle: 'A trig condition decides, every time round, whether the trig plays.',
      check: s => noteTrigs(s, 1).some(([, st]) => st.cond === '1:2'),
      solution: { data: SQ3_C1 },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: mc('What does a 50% condition do?', ['Plays on about half the loops, at random', 'Plays every second loop exactly', 'Plays at half volume'], 0,
        'Percentages are chances, rolled every time the trig comes round. 1:2 is the exact every-other-loop version.'),
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Set trig key 16 to FILL. Then hold the FILL key while it plays: that hat only plays during fills.', focus: ['key:FILL'],
      checklist: [{ text: 'A T2 trig with the FILL condition', check: s => conds(s).includes('FILL') }],
      hints: ['Hold trig key 16 and turn TRC (knob E) to FILL.', 'FILL is just after the percentages.'],
      solution: { data: SQ3_C2 },
    },
    {
      kind: 'predict', concept: 'timing-tempo',
      instruction: 'Hold trig key 7 and turn knob D (µTM) to about +8.',
      predict: mc('Pushing one hat a little late makes the groove…', ['Lazier, more laid back', 'Faster', 'Louder'], 0,
        'Micro timing moves a trig off the grid in 1/24-step units. Late hats drag behind the beat, which feels relaxed.'),
      principle: 'Small timing offsets change the feel of a groove without changing its notes.',
      check: s => noteTrigs(s, 1).some(([, st]) => (st.micro ?? 0) >= 4),
      solution: { data: SQ3_M },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Make the hats evolve: at least three conditional trigs, one of them a chance (%), and at least one trig off the grid.',
      checklist: [
        { text: 'At least 3 T2 trigs with a condition', check: s => conds(s).length >= 3 },
        { text: 'One of them is a probability (%)', check: s => conds(s).some(c => c.endsWith('%')) },
        { text: 'At least one T2 trig with micro timing', check: s => noteTrigs(s, 1).some(([, st]) => (st.micro ?? 0) !== 0) },
      ],
      hints: ['Probabilities come first on the TRC knob.', 'Try 50% on trig key 11.'],
      solution: { data: SQ3_FULL },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why use trig conditions instead of programming more patterns?',
        model: 'They make one short pattern change over time - every other loop, by chance, or only in fills - so it stays alive without writing new patterns.',
      },
    },
  ],
  review: [
    mc('The condition 1:4 plays…', ['On the first of every four loops', 'Four times a loop', 'At 25% volume'], 0, 'A:B = loop A of every B.'),
    mc('A FILL trig plays…', ['Only while fill mode is on', 'Always', 'Never'], 0, 'Hold FILL to hear it.'),
    mc('Micro timing moves a trig…', ['Slightly early or late', 'To another track', 'An octave up'], 0, 'Off the grid, in 1/24-step units.'),
    mc('Which is random?', ['50%', '1:2', 'FILL'], 0, 'Percentages are chances.'),
  ],
};

const SQ4_START = nightPatterns('A01');
const SQ4_A02 = nightPatterns('A02');
const SQ4_CHAIN = edited(SQ4_A02, p => { p.chain = ['A01', 'A02', 'A02', 'A03']; p.mode = 'chain'; });
const SQ4_ROW = edited(SQ4_CHAIN, p => { p.song.rows = [{ pattern: 'A01', repeats: 1 }]; });
const SQ4_SONG = edited(SQ4_ROW, p => {
  p.song.rows = [{ pattern: 'A01', repeats: 1 }, { pattern: 'A02', repeats: 2 }, { pattern: 'A03', repeats: 1 }, { pattern: 'A04', repeats: 2 }];
  p.mode = 'song';
});
const rowPatterns = (s: LessonCheckState) => proj(s).song.rows.map(r => r.pattern);

const sq4: Lesson = {
  id: 'analog-four-sq4-chains-songs', device: 'analog-four', path: 'sequencing', order: O(17), difficulty: 'intermediate',
  name: 'Chains and songs',
  description: 'A full track is several patterns in order. Chains string patterns together; a song adds repeats and plays the whole track from start to end.',
  objective: 'Cue patterns, build a chain, and arrange a song that plays a whole track.',
  source: `${SRC}, Sequencer - chains and song mode`, estimatedMinutes: 10,
  prerequisites: ['analog-four-sq1-trigs-notes'],
  concepts: ['sequencer-pattern'],
  tags: ['chain', 'song', 'arrangement'],
  start: { reset: true, values: { ...nightValues(), page: V.OSC1 }, data: SQ4_START },
  steps: [
    playStep('Press PLAY. Pattern A01, the intro of the Night Drive project, loops.', 'A pattern is one section of a track.'),
    {
      kind: 'info', concept: 'sequencer-pattern',
      instruction: 'Press BANK A, then trig key 2: pattern A02 (the groove) is cued and starts when A01 ends.', focus: ['key:BANK_A'],
      explanation: 'The pattern keys of bank A are lit where patterns exist. A cued pattern blinks until it starts.',
      check: s => proj(s).active === 'A02',
      solution: { data: SQ4_A02 },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: mc('You pick a new pattern while the A4 plays. When does it start?', ['When the current pattern reaches its end', 'Immediately, mid-bar', 'After you press STOP'], 0,
        'In SEQUENTIAL change mode (the default) the A4 finishes the pattern first, so changes land on the bar line.'),
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Press FUNC + CHAIN (NEW CHAIN) and add A01, A02, A02, A03 in the menu. Then press CHAIN to play the chain.', focus: ['key:FUNC', 'key:CHAIN'],
      checklist: [
        { text: 'The chain starts with A01', check: s => proj(s).chain[0] === 'A01' },
        { text: 'At least four patterns in the chain', check: s => proj(s).chain.length >= 4 },
        { text: 'The chain reaches A03 (the break)', check: s => proj(s).chain.includes('A03') },
        { text: 'CHAIN mode is on', check: s => proj(s).mode === 'chain' },
      ],
      hints: ['FUNC + CHAIN clears the chain and opens the chain menu.', 'Tap the patterns in order, then close the menu.', 'The CHAIN key lights in chain mode.'],
      solution: { data: SQ4_CHAIN },
    },
    {
      kind: 'predict', concept: 'sequencer-pattern',
      instruction: 'Hold FUNC and press SONG M (Edit Song) to open the song editor, then add a row.', focus: ['key:FUNC', 'key:SONGMODE'],
      predict: mc('A song row that says A02 x2 plays…', ['A02 twice, then the next row', 'A02 and A03 together', 'A02 at double speed'], 0,
        'Each song row is a pattern and a repeat count. The song plays the rows from top to bottom.'),
      principle: 'A song lists patterns with repeat counts, so a whole track plays by itself.',
      check: s => proj(s).song.rows.length >= 1,
      solution: { data: SQ4_ROW },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Arrange a whole track: intro, groove, break, then the drop (A04) or the groove again. Then press SONG M and PLAY.', focus: ['key:SONG', 'key:SONGMODE', 'key:PLAY'],
      checklist: [
        { text: 'At least four rows', check: s => proj(s).song.rows.length >= 4 },
        { text: 'It starts with the intro (A01)', check: s => rowPatterns(s)[0] === 'A01' },
        { text: 'The break (A03) comes after the groove (A02)', check: s => { const r = rowPatterns(s); const g = r.indexOf('A02'); return g >= 0 && r.indexOf('A03', g) > g; } },
        { text: 'Something plays after the break', check: s => { const r = rowPatterns(s); const b = r.lastIndexOf('A03'); return b >= 0 && b < r.length - 1; } },
        { text: 'SONG mode is on', check: s => proj(s).mode === 'song' },
      ],
      hints: ['Add one row per section, each with its pattern.', 'Give the groove 2 repeats so it has room.', 'SONG M switches song mode on.'],
      solution: { data: SQ4_SONG },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does a song give you that a chain does not?',
        model: 'A chain only lists patterns in order. A song row also sets how many times each pattern repeats (and can set mutes, tempo and transpose), so the whole track plays from start to end by itself.',
      },
    },
  ],
  review: [
    mc('In SEQUENTIAL mode a newly selected pattern starts…', ['When the current one ends', 'Immediately', 'Never'], 0, 'Changes land on the bar line.'),
    mc('A chain is…', ['A list of patterns played in order', 'A kind of LFO', 'A trig condition'], 0, 'FUNC + CHAIN starts a new one.'),
    mc('A song row sets…', ['A pattern and how many times it repeats', 'The filter cutoff', 'The kit'], 0, 'Rows play top to bottom.'),
  ],
};


// ---------------------------------------------------------------- POLY chords

/** The pattern: one long note per beat on T1 (A, F, C, G) */
const SQ5_START = oneBar('POLY', [{ s: 'x...x...x...x...', n: [57, 53, 60, 55], len: LEN.s4, vel: 96 }]);
const chordOn = (p: Project, step: number, note: number, chord: number[]) => {
  p.patterns.A01.tracks[0].steps[step] = { ...p.patterns.A01.tracks[0].steps[step], note, chord };
};
/** Trig 1 holds A minor (A C E) */
const SQ5_CHORD1 = edited(SQ5_START, p => chordOn(p, 0, 57, [3, 7]));
/** Four chords: A minor, F major, C major, G major */
const SQ5_PROG = edited(SQ5_CHORD1, p => { chordOn(p, 4, 53, [4, 7]); chordOn(p, 8, 60, [4, 7]); chordOn(p, 12, 55, [4, 7]); });
const POLY3 = { poly_v1: true, poly_v2: true, poly_v3: true };
/** Trigs of T1 that play `n` notes or more (a note and n - 1 chord notes) */
const chordTrigs = (s: LessonCheckState, n: number) => noteTrigs(s, 0).filter(([, st]) => 1 + (st.chord?.length ?? 0) >= n);
const polyVoices = (s: LessonCheckState) => [1, 2, 3, 4].filter(k => !!s.values[`poly_v${k}`]).length;

const sq5: Lesson = {
  id: 'analog-four-sq5-poly-chords', device: 'analog-four', path: 'sequencing', order: O(17.5), difficulty: 'intermediate',
  name: 'Chords with POLY',
  description: 'Give a track several voices with POLY CONFIG, store chords on its trigs, and hear how notes find a voice - or pile onto all of them in UNISON.',
  objective: 'Make track 1 polyphonic, write a chord progression on its trigs, and thicken a sound with UNISON.',
  source: `${SRC}, POLYPHONY and STEP RECORDING`, estimatedMinutes: 10,
  prerequisites: ['analog-four-sq1-trigs-notes'],
  concepts: ['sequencer-pattern', 'signal-routing', 'oscillator-pitch'],
  tags: ['poly', 'chords', 'unison', 'voice allocation', 'pads'],
  start: { reset: true, values: { ...sound('pad-strings', 0, { level: 80 }), page: V.NOTE, kb_oct: 3 }, data: SQ5_START },
  steps: [
    playStep('Press PLAY. Track 1 plays a pad, one long note per beat: one voice, one note at a time.', 'A mono voice plays one note at a time: a new note takes over the old one.'),
    {
      kind: 'predict', concept: 'signal-routing', focus: ['key:FUNC', 'key:MIX', 'poly_v1', 'poly_v2', 'poly_v3'],
      instruction: 'Hold FUNC and press MIX: POLY CONFIG opens. Tick voices 1, 2 and 3 (or press TRIG keys 1-3).',
      predict: mc('Voices 1-3 are now a pool shared by tracks 1-3. What can track 1 do now?', ['Play up to three notes at once', 'Play three times as loud', 'Play the patterns of three tracks'], 0,
        'Each ticked voice joins the pool. Track 1\'s notes can now take any free pool voice, so up to three of them sound together. The loudness of one note does not change.'),
      principle: 'Polyphony is the number of voices that can sound at once; each note needs a voice of its own.',
      explanation: 'The A4 has four analog voices. Normally each track owns one. Voices you tick in POLY CONFIG are shared: their tracks can use any of them, which is how one track plays a chord.',
      check: s => !!s.values.poly_v1 && !!s.values.poly_v2 && !!s.values.poly_v3,
      solution: { values: POLY3 },
      manualReference: 'Manual p.28-29, POLYPHONY CONFIGURATION',
    },
    {
      kind: 'predict', concept: 'sequencer-pattern', focus: ['seq:trig:1', 'key:KB'],
      instruction: 'Close the menu. Hold trig key 1, then hold the keyboard\'s A and press C and E while A is still down.',
      predict: mc('What does trig 1 store when you press three keys together?', ['A chord: all three notes on one trig', 'Only the last key\'s note', 'Three trigs on three steps'], 0,
        'Keys pressed while another is still down join the trig\'s chord. A track playing polyphonically sounds them together, each on its own voice.'),
      principle: 'A chord trig stores several notes on one step; a poly track plays them on separate voices.',
      explanation: 'With a mouse, long-press trig 1 so it stays held, then press the notes together on the computer keyboard. STEP RECORDING ([RECORD] + [STOP]) takes chords the same way.',
      check: s => chordTrigs(s, 3).some(([k]) => k === 0),
      solution: { data: SQ5_CHORD1 },
      manualReference: 'Manual p.28, p.42',
    },
    {
      kind: 'listen', concept: 'signal-routing', focus: ['poly_v1', 'poly_v2', 'poly_v3'],
      instruction: 'Compare the chord trig with POLY on and off.',
      listen: {
        a: POLY3, b: { poly_v1: false, poly_v2: false, poly_v3: false }, labels: ['POLY: the chord', 'Mono: its first note'],
        question: mc('With POLY off, the chord trig plays…', ['Only its first note: one voice', 'The chord, quieter', 'Nothing'], 0,
          'A mono track has one voice, so a chord trig can only play its first note. The chord is still stored on the trig and comes back with POLY.'),
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: mc('Three voices are in the pool and all three are playing. A fourth note starts. What happens?', ['The voice used least recently is taken for it', 'The fourth note is skipped', 'All the notes stop'], 0,
        'This is voice stealing: with no free voice, the A4 takes the one that has been playing longest. Every allocation method does it.'),
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Write a chord progression on T1: give trigs 5, 9 and 13 chords of three notes too.',
      checklist: [
        { text: 'Four trigs with chords of three or more notes', check: s => chordTrigs(s, 3).length >= 4 },
        { text: 'At least three voices in the pool', check: s => polyVoices(s) >= 3 },
        { text: 'ALLOCATION is not UNISON (so the chords play)', check: s => num(s, 'poly_alloc') !== 3 },
      ],
      hints: ['Hold each trig and press its three notes together.', 'Root, third and fifth: A C E, F A C, C E G, G B D.', 'The pattern\'s own notes are the roots.'],
      solution: { data: SQ5_PROG, values: { ...POLY3, poly_alloc: 0 } },
    },
    {
      kind: 'predict', control: 'poly_alloc', targetValue: 3, concept: 'oscillator-pitch', focus: ['poly_alloc', 'key:MIX'],
      instruction: 'Open POLY CONFIG again (FUNC + MIX) and set ALLOCATION to UNISON.',
      predict: mc('With UNISON, each chord trig plays…', ['Its first note on all three voices, detuned: one thick note', 'Every note three times as loud', 'Its notes one after another'], 0,
        'UNISON puts every pool voice on the same note, each slightly detuned and panned. Three voices become one wide, thick sound, so chords collapse to their first note.'),
      principle: 'Several slightly detuned copies of one note beat against each other, which sounds thick and wide.',
      manualReference: 'Manual p.29, ALLOCATION: UNISON',
    },
    {
      kind: 'match', concept: 'oscillator-pitch', setup: { poly_det: 4 },
      instruction: 'Match the target\'s UNISON DETUNE by ear: how far apart are the voices tuned?',
      match: { target: { poly_det: 40 }, controls: ['poly_det'] },
      hints: ['Listen to the wobble: faster beating means more detune.', 'The target beats much faster than 4.', 'Try around 40.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does POLY CONFIG change about how a track plays its notes?',
        model: 'It lets a track use several of the A4\'s voices: each note of a chord or overlapping trig takes a free pool voice, the oldest is stolen when none is free, and UNISON stacks every voice on one note instead.',
      },
    },
  ],
  review: [
    mc('To play a chord on one A4 track you need…', ['Several voices in the POLY CONFIG pool', 'A longer LEN', 'The arpeggiator'], 0, 'One note, one voice.'),
    mc('With no free voice, a new note…', ['Takes the voice used least recently', 'Is skipped', 'Stops the pattern'], 0, 'Voice stealing.'),
    mc('UNISON plays…', ['One note on every pool voice, detuned', 'Each note twice', 'Only on track 1'], 0, 'A thick, wide single note.'),
    mc('A chord trig on a mono track plays…', ['Only its first note', 'The whole chord', 'Nothing'], 0, 'One voice, one note.'),
  ],
};

export const SEQUENCING: Lesson[] = [sq1, sq2, sq3, sq4, sq5];

// ============================================================================
// PERFORMANCE
// ============================================================================

const P1_START = nightPatterns('A02');
/** The same with the drums (T1) muted */
const P1_MUTED = edited(P1_START, p => { p.mutes = [0]; });

const p1: Lesson = {
  id: 'analog-four-p1-perform', device: 'analog-four', path: 'performance', order: O(18), difficulty: 'intermediate',
  name: 'Perform: mutes, keys and Quick Perf',
  description: 'Play the A4 live over a running groove: mute and unmute tracks, play a sound from the keyboard, and sweep every filter with one macro.',
  objective: 'Mute and unmute tracks, play the selected track from the keyboard and sweep a performance macro.',
  source: `${SRC}, track mutes, keyboard and performance mode`, estimatedMinutes: 8,
  prerequisites: ['analog-four-sq4-chains-songs'],
  concepts: ['sequencer-pattern', 'filter-cutoff'],
  tags: ['performance', 'mutes', 'macro', 'live'],
  start: { reset: true, values: { ...nightValues(), page: V.OSC1 }, data: P1_START },
  steps: [
    playStep('Press PLAY: the Night Drive groove with drums, bass, chord stabs and an arpeggio.', 'Live performance starts from a loop that already works.'),
    {
      kind: 'predict', concept: 'sequencer-pattern', focus: ['key:FUNC', 'key:T1'],
      instruction: 'Hold FUNC and press T1.',
      predict: mc('Muting a track…', ['Silences its trigs; the pattern is untouched', 'Deletes its trigs', 'Stops the whole A4'], 0,
        'A mute only stops the track from playing. Its trigs stay, so unmuting brings it straight back.'),
      principle: 'Muting removes a part without losing it, so it can come back at any time.',
      check: s => muted(s, 0),
      solution: { data: P1_MUTED },
    },
    {
      kind: 'do', concept: 'sequencer-pattern', focus: ['key:FUNC', 'key:T1'],
      instruction: 'Count to the first beat of a bar, then press FUNC + T1 again: the drums are back.',
      principle: 'Bringing a part back on the first beat of a bar is the simplest live arrangement.',
      check: s => !muted(s, 0),
      solution: { data: P1_START },
    },
    {
      kind: 'do', control: 'track', targetValue: 3, concept: 'signal-routing',
      instruction: 'Press T4 and play the A4\'s keyboard: you play the arpeggio sound live, over the pattern.',
      principle: 'The keyboard always plays the selected track\'s sound.',
    },
    {
      kind: 'do', control: 'kb_oct', targetValue: 6, concept: 'oscillator-pitch',
      instruction: 'Press OCT+ once: the keyboard plays an octave higher.',
      principle: 'Octave keys move the keyboard\'s range without changing the sound.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: mc('The A4\'s keyboard plays…', ['The selected track\'s sound', 'Always track 1', 'Only the FX track'], 0,
        'Select a track, then play: the keys use that track\'s sound, and holding a trig makes them write notes instead.'),
    },
    {
      kind: 'predict', control: 'perf_a', targetValue: 80, tolerance: 8, concept: 'filter-cutoff',
      instruction: 'Turn the QUICK PERF knob (top left) up to about 80.',
      predict: mc('QUICK PERF moves macro A, LP SWEEP. What happens?', ['Every track\'s filter closes at once', 'Only T4 changes', 'The tempo drops'], 0,
        'A performance macro offsets the same parameter on every track at once, here filter 1 FRQ, so the whole mix goes dark.'),
      principle: 'A macro moves several parameters at once, so one knob reshapes the whole mix.',
      explanation: 'QPER + trig keys 1-10 picks which macro QUICK PERF controls; the PERF page shows all ten on the knobs.',
    },
    {
      kind: 'listen', concept: 'filter-cutoff', focus: ['perf_a'],
      instruction: 'Compare the groove with the macro off and with LP SWEEP fully on.',
      listen: { a: { perf_a: 0 }, b: { perf_a: 110 }, labels: ['Macro off', 'LP SWEEP on'] },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Set up a breakdown: drums muted and the LP SWEEP macro at least halfway, so only a dark groove is left.',
      checklist: [
        { text: 'T1 (drums) muted', check: s => muted(s, 0) },
        { text: 'LP SWEEP (PERF A) at 64 or more', check: s => num(s, 'perf_a') >= 64 },
        { text: 'The bass (T2) still playing', check: s => !muted(s, 1) },
      ],
      hints: ['FUNC + T1 mutes the drums.', 'QUICK PERF controls LP SWEEP.'],
      solution: { values: { perf_a: 90 }, data: P1_MUTED },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How would you bring the drop back, one hand on each control?',
        model: 'Turn QUICK PERF back to zero so the filters open, and unmute the drums with FUNC + T1 on the first beat of a bar, so the beat and the brightness return together.',
      },
    },
  ],
  review: [
    mc('FUNC + a track key…', ['Mutes or unmutes that track', 'Deletes the track', 'Copies the track'], 0, 'The trigs stay.'),
    mc('A performance macro…', ['Moves a parameter on every track at once', 'Changes the pattern', 'Sets the tempo'], 0, 'One knob, the whole mix.'),
    mc('The keyboard plays…', ['The selected track', 'Track 1 only', 'Nothing while the sequencer runs'], 0, 'Select a track, then play.'),
  ],
};


// ---------------------------------------------------------------- LIVE RECORDING knob moves

const P2_START = oneBar('LIVE', [{ s: 'x.x.x.x.x.x.x.x.', n: [45, 45, 57, 45, 48, 45, 55, 43], len: LEN.s1_5 }]);
const lockSteps = (p: Project, key: string, values: Record<number, number>) => {
  const steps = p.patterns.A01.tracks[0].steps;
  for (const [k, v] of Object.entries(values)) {
    const i = Number(k);
    const st = steps[i] ?? { trigless: true };
    steps[i] = { ...st, locks: { ...(st.locks ?? {}), [key]: v } };
  }
};
/** A filter sweep over the first half bar, recorded live: a lock on every step the playhead passed */
const P2_SWEEP = edited(P2_START, p => lockSteps(p, 'flt1_frq', { 0: 46, 1: 52, 2: 58, 3: 64, 4: 70, 5: 78, 6: 86, 7: 94 }));
/** ...and a delay throw on the last beat */
const P2_THROW = edited(P2_SWEEP, p => lockSteps(p, 'amp_del', { 12: 100, 13: 110, 14: 120, 15: 120 }));
const lockedT1 = (s: LessonCheckState, key: string) => Object.entries(stepsOf(s, 0)).filter(([, st]) => st.locks?.[key] !== undefined);

const p2: Lesson = {
  id: 'analog-four-p2-live-locks', device: 'analog-four', path: 'performance', order: O(18.5), difficulty: 'intermediate',
  name: 'Record knob moves live',
  description: 'In LIVE RECORDING the knobs write parameter locks onto the steps as the pattern plays, so a filter sweep or an echo throw plays back every loop.',
  objective: 'Record a filter sweep and an echo throw as parameter locks while the pattern plays, and know what the knob itself still controls.',
  source: `${SRC}, LIVE RECORDING and parameter locks`, estimatedMinutes: 9,
  prerequisites: ['analog-four-sq2-plocks'],
  concepts: ['parameter-locks', 'filter-cutoff', 'filter-resonance', 'effects'],
  tags: ['live recording', 'p-locks', 'automation', 'performance'],
  start: { reset: true, values: { ...sound('bass-saw', 0, { flt1_frq: 46, flt1_res: 40, amp_del: 0 }), page: V.FLTR, fx_del_fb: 70 }, data: P2_START },
  steps: [
    playStep('Press PLAY: a bass line on T1, filter fairly closed.', 'Recording works best over a loop that already grooves.'),
    {
      kind: 'do', control: 'live_rec', targetValue: true, concept: 'parameter-locks', focus: ['key:RECORD', 'key:PLAY'],
      instruction: 'Hold RECORD and press PLAY: LIVE RECORDING. The RECORD key flashes.',
      principle: 'Live recording captures what you play and turn, in time with the sequencer.',
      manualReference: 'Manual p.40, LIVE RECORDING MODE',
    },
    {
      kind: 'predict', concept: 'parameter-locks', focus: ['t1_flt1_frq'],
      instruction: 'Turn knob A (FRQ) slowly up from about 45 to about 95 over half a bar, then let go.',
      predict: mc('What does the A4 record while you turn the knob?', ['A lock with the knob\'s value on each step the playhead passes', 'One new knob position for the whole track', 'Nothing until the pattern stops'], 0,
        'Each step that plays while the knob moves gets a parameter lock with the value at that moment: note trigs take the lock, empty steps get a lock trig. That is how the move plays back.'),
      principle: 'A recorded knob move is a row of parameter locks, one per step.',
      explanation: 'Locks hold one value per step, so a recorded move is stepped, not smooth. A PARAMETER SLIDE trig can glide between two of them.',
      check: s => lockedT1(s, 'flt1_frq').length >= 4 && new Set(lockedT1(s, 'flt1_frq').map(([, st]) => st.locks!.flt1_frq)).size >= 3,
      solution: { data: P2_SWEEP },
      manualReference: 'Manual p.50, PARAMETER LOCKS in LIVE RECORDING',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'parameter-locks',
      quiz: mc('Live recording ends and FRQ shows its old value again. Why does the sweep still play?', ['It is stored as locks on the steps; the knob holds the kit\'s own value', 'The A4 plays back an audio recording', 'It does not: the sweep is lost'], 0,
        'Recording knob moves writes locks into the pattern and leaves the kit\'s value alone. Steps with a lock play the lock; steps without one play the knob.'),
    },
    {
      kind: 'do', control: 'live_rec', targetValue: false, concept: 'parameter-locks', focus: ['key:PLAY'],
      instruction: 'Press PLAY once: LIVE RECORDING ends and the pattern keeps playing. Listen to the sweep play back on every loop.',
      principle: 'Recorded locks repeat every loop until you change or clear them.',
    },
    {
      kind: 'match', concept: 'filter-resonance', setup: { t1_flt1_res: 20 },
      instruction: 'The sweep locked only FRQ: RES still follows its knob on every step. Match the target\'s resonance by ear with knob B.',
      match: { target: { t1_flt1_res: 100 }, controls: ['t1_flt1_res'] },
      hints: ['Listen for the whistle at the top of the sweep.', 'The target rings much more.', 'Try around 100.'],
    },
    {
      kind: 'challenge', concept: 'effects',
      instruction: 'Record a second take: in LIVE RECORDING, open AMP and turn knob G (DEL) right up as the playhead reaches trig 13, so the last beat throws echoes.',
      checklist: [
        { text: 'A delay-send (DEL) lock of 60 or more on trigs 13-16', check: s => lockedT1(s, 'amp_del').some(([k, st]) => Number(k) >= 12 && st.locks!.amp_del >= 60) },
        { text: 'The filter sweep is still there (FRQ locks on 4 trigs or more)', check: s => lockedT1(s, 'flt1_frq').length >= 4 },
      ],
      hints: ['Hold RECORD and press PLAY again.', 'Press AMP; DEL is knob G.', 'Turn it just as the playhead reaches trig 13, then leave live recording with PLAY.'],
      solution: { data: P2_THROW, values: { live_rec: false } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How is a knob turned in LIVE RECORDING different from the same turn with recording off?',
        model: 'In LIVE RECORDING the turn is written as a lock on each step it passes, so it plays back every loop and the kit value stays as it was; with recording off the turn changes the kit value itself, on every step that has no lock.',
      },
    },
  ],
  review: [
    mc('In LIVE RECORDING, turning a knob…', ['Locks its value on the steps the playhead passes', 'Changes the tempo', 'Mutes the track'], 0, 'One lock per step.'),
    mc('An empty step that a recorded knob move passes gets…', ['A lock trig', 'A note trig', 'Nothing'], 0, 'Locks without a note.'),
    mc('After recording, the knob\'s own value sets…', ['The steps without a lock for it', 'Every step', 'Nothing any more'], 0, 'Locks win on their steps.'),
    mc('To erase recorded locks as the pattern plays, hold…', ['FUNC + NO', 'TRK + PTN', 'BANK A'], 0, 'Real-time erase.'),
  ],
};

export const PERFORMANCE: Lesson[] = [p1, p2];

// ============================================================================
// STUDIO
// ============================================================================

const synced = (s: LessonCheckState, device: string) => { const i = instanceOf(s, device); return !!i && s.sync[i] !== false; };

const st1: Lesson = {
  id: 'analog-four-st1-with-rytm', device: 'analog-four', path: 'studio', order: 6, difficulty: 'intermediate',
  name: 'Jam with the Analog Rytm',
  description: 'The classic Elektron pair: the Rytm plays drums, the Analog Four plays bass and chords, both on one clock.',
  objective: 'Sync the Analog Four with the Analog Rytm, give each part one home and start both together.',
  source: 'Synth Studio · Elektron MIDI sync (both manuals)', estimatedMinutes: 7,
  requires: ['analog-rytm'],
  prerequisites: ['analog-four-p1-perform'],
  concepts: ['timing-tempo', 'signal-routing'],
  tags: ['studio', 'sync', 'Analog Rytm'],
  start: { reset: true, values: { ...nightValues() }, data: P1_START },
  steps: [
    {
      kind: 'info', concept: 'timing-tempo',
      instruction: 'The Analog Rytm is in the rack now. Like hardware sharing MIDI clock, both machines follow the studio\'s tempo and transport.',
      explanation: 'On real hardware you would send MIDI clock and start/stop from one machine to the other. Here the studio is the clock and every synced instrument follows it.',
    },
    {
      kind: 'challenge', concept: 'timing-tempo',
      instruction: 'In the Studio tab, check that SYNC is on for both Elektrons.',
      checklist: [
        { text: 'The Analog Rytm is in the rack', check: s => !!instanceOf(s, 'analog-rytm') },
        { text: 'The Analog Four follows the studio clock', check: s => synced(s, 'analog-four') },
        { text: 'The Analog Rytm follows the studio clock', check: s => synced(s, 'analog-rytm') },
      ],
      hints: ['SYNC is on by default for both.', 'Each instrument\'s card in the Studio tab has its own SYNC switch.'],
    },
    {
      kind: 'do', concept: 'signal-routing', focus: ['key:FUNC', 'key:T1'],
      instruction: 'The Rytm will play the drums: hold FUNC and press T1 to mute the A4\'s own drum track.',
      principle: 'With two drum sources, give each part one home so they don\'t clash.',
      check: s => muted(s, 0),
      solution: { data: P1_MUTED },
    },
    {
      kind: 'predict', control: 'play', targetValue: true, concept: 'timing-tempo',
      instruction: 'Press PLAY on the Analog Four (or ▶ in the top bar).',
      predict: mc('Both machines are synced. Pressing PLAY on one of them…', ['Starts both together, on the same downbeat', 'Starts only the Analog Four', 'Starts them a bar apart'], 0,
        'Synced machines share one transport: start one and every synced machine starts on the same beat.'),
      principle: 'Synced machines share one transport, so they start and stay together.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: mc('Why do the two machines stay in time?', ['Both follow one clock, like MIDI clock', 'Their TEMPO knobs happen to match', 'They listen to each other\'s audio'], 0,
        'One clock leads and the others follow it, so they cannot drift apart. Matching tempo numbers alone would still drift.'),
    },
    {
      kind: 'challenge', concept: 'signal-routing',
      instruction: 'Make it a duo: the Rytm plays the drums and the A4 plays the bass, chords and arpeggio, both running.',
      checklist: [
        { text: 'A4 T1 (drums) muted', check: s => muted(s, 0) },
        { text: 'A4 T2, T3 and T4 playing', check: s => [1, 2, 3].every(t => !muted(s, t)) },
        { text: 'The A4 is playing', check: s => s.values.play === true },
      ],
      hints: ['FUNC + a track key mutes or unmutes it.', 'Press PLAY if it stopped.'],
      solution: { values: { play: true }, data: P1_MUTED },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does sync give you when two sequencers play together?',
        model: 'One clock and one transport: both start on the same downbeat, follow the same tempo and never drift, so their patterns line up bar after bar.',
      },
    },
  ],
  review: [
    mc('Two synced Elektrons…', ['Start and stay together', 'Need the same patterns', 'Share one sound'], 0, 'One clock, one transport.'),
    mc('When the Rytm plays the drums, the A4\'s drum track should be…', ['Muted (or used for something else)', 'Doubled', 'Louder'], 0, 'One home per part.'),
    mc('MIDI clock carries…', ['Tempo and start/stop', 'Audio', 'Sounds'], 0, 'Timing only.'),
  ],
};

const isSubsequence = (list: (string | undefined)[], want: string[]) => {
  let i = 0;
  for (const x of list) if (x === want[i]) i++;
  return i >= want.length;
};

const st2: Lesson = {
  id: 'analog-four-st2-arranger', device: 'analog-four', path: 'studio', order: 7, difficulty: 'advanced',
  name: 'Arrange a full track',
  description: 'The studio arranger switches the Analog Four\'s patterns section by section: intro, groove, break, drop.',
  objective: 'Use the studio arranger to play the A4\'s patterns as the sections of a full track.',
  source: 'Synth Studio · arranger', estimatedMinutes: 9,
  prerequisites: ['analog-four-sq4-chains-songs'],
  concepts: ['sequencer-pattern', 'timing-tempo'],
  tags: ['studio', 'arranger', 'song'],
  start: { reset: true, values: { ...nightValues() }, data: nightPatterns('A01') },
  steps: [
    {
      kind: 'info', concept: 'sequencer-pattern',
      instruction: 'The studio arranger plays sections in order. Each section tells every instrument which pattern to play.',
      explanation: 'It is a song on one timeline for the whole studio, so several machines change sections together.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: mc('Night Drive has an intro (A01), groove (A02), break (A03) and drop (A04). Which order builds and releases tension?', ['Intro, groove, break, drop', 'Drop, intro, break, groove', 'Break, break, break, break'], 0,
        'The break takes energy away so the drop hits harder when everything comes back.'),
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'In the Studio tab\'s arranger, add four sections that play A01, A02, A03 and A04 on the Analog Four.',
      checklist: [
        { text: 'At least four sections', check: s => s.arrangement.sections.length >= 4 },
        { text: 'The A4 plays A01, A02, A03, A04 in that order', check: s => { const i = instanceOf(s, 'analog-four'); return !!i && isSubsequence(s.arrangement.sections.map(x => x.parts[i]?.pattern), ['A01', 'A02', 'A03', 'A04']); } },
      ],
      hints: ['Open the Studio tab and find the arranger.', 'Each section has a pattern picker for every instrument.', 'Give the groove and the drop more bars than the intro.'],
      solution: {
        arrangement: {
          sections: [
            { name: 'Intro', bars: 4, parts: { 'analog-four': { pattern: 'A01' } } },
            { name: 'Groove', bars: 8, parts: { 'analog-four': { pattern: 'A02' } } },
            { name: 'Break', bars: 4, parts: { 'analog-four': { pattern: 'A03' } } },
            { name: 'Drop', bars: 8, parts: { 'analog-four': { pattern: 'A04' } } },
          ],
        },
      },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Turn the arranger on.',
      checklist: [{ text: 'The arranger is on', check: s => s.arrangement.enabled }],
      hints: ['The arranger has an on/off switch at the top.'],
      solution: { arrangement: { enabled: true } },
    },
    {
      kind: 'predict', control: 'play', targetValue: true, concept: 'sequencer-pattern',
      instruction: 'Press PLAY on the Analog Four (or ▶ in the top bar) and listen through the sections.',
      predict: mc('When the next section starts, the Analog Four…', ['Switches to that section\'s pattern at the bar line', 'Keeps looping A01', 'Stops'], 0,
        'With the arranger on, each section picks the A4\'s pattern, and the change lands on the section boundary.'),
      principle: 'An arranger turns loops into a song by switching patterns at section boundaries.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: mc('With the arranger on, who chooses the Analog Four\'s pattern?', ['The arranger\'s section', 'The A4\'s song mode', 'The Analog Rytm'], 0,
        'The arranger sends each instrument its pattern for the section; the A4 follows it like a song row.'),
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'When would you use the A4\'s own song mode, and when the studio arranger?',
        model: 'Song mode arranges the A4 on its own, as on the hardware. The studio arranger switches every instrument together, so it is the tool for a full track with several machines.',
      },
    },
  ],
  review: [
    mc('An arranger section holds…', ['A pattern choice for each instrument', 'One sound', 'A tempo only'], 0, 'Every instrument gets its part.'),
    mc('A break before the drop…', ['Makes the drop hit harder', 'Ends the track', 'Changes the key'], 0, 'Tension and release.'),
    mc('To arrange several machines together, use…', ['The studio arranger', 'One machine\'s chain', 'Track mutes only'], 0, 'One timeline for all.'),
  ],
};

export const STUDIO: Lesson[] = [st1, st2];

export const ANALOG_FOUR_LESSONS: Lesson[] = [...FOUNDATIONS, ...SOUND_DESIGN, ...EAR_TRAINING, ...SEQUENCING, ...PERFORMANCE, ...STUDIO];
