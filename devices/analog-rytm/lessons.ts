// ============================================================================
// Analog Rytm MKII lessons (v2, docs/PEDAGOGY.md)
//
// Paths: foundations (tracks and voices, the voice chain), sound design (kick,
// snare and clap, hats and the choke, toms and envelopes, sends, the master
// bus), ear training (decay, pitch sweep, filter type, compression mixed with
// decay), sequencing (grid recording, groove, parameter locks, trig
// conditions), performance (mutes, fills and rolls; scenes and performance
// macros) and studio (sync and tempo; chains, songs and the arranger).
// Outlines: docs/research/analog-rytm/lessons.md. Facts: the Rytm MKII manual
// (OS 1.72), cited as "Rytm MKII manual p.N".
//
// Orders below 1 put the device path before the shared studio curriculum
// (orders 1-5); the Rytm studio lessons (orders 6+) build on it.
// ============================================================================

import type { Lesson, LessonCheckState } from '@/types';
import {
  asProject, createPattern, getPattern, getStep, lockedSteps, setChain, setStep, trackLength, trigSteps,
  updatePatternSettings, type Pattern, type Step,
} from '@/lib/sequencer/elektron';
import { M, PAGE, SEQ_TRACKS, TRACKS, soundDefaults } from './model';
import { KIT_PRESETS, buildPattern, defaultProject, kitIdOf, type PatDef, type RytmProject } from './presets';

const O = (n: number) => n / 100;
const REF = (page: string) => `Rytm MKII manual ${page}`;

// Tracks (sequencer and pad order)
const BD = 0, SD = 1, RS = 2, CP = 3, LT = 5, MT = 6, HT = 7, CH = 8, OH = 9, CY = 10, FX = 12;

// ---------------------------------------------------------------- helpers

/** Machine menu index of `machine` on `track` */
const mi = (track: number, machine: number) => TRACKS[track].machines.indexOf(machine);
/** A machine with its own defaults on a track, as control values (choosing it on the hardware loads them) */
function machineSound(track: number, machine: number): Record<string, number> {
  const id = TRACKS[track].id;
  const out: Record<string, number> = { [`${id}_machine`]: mi(track, machine) };
  for (const [k, v] of Object.entries(soundDefaults(track, machine))) out[`${id}_${k}`] = v;
  return out;
}
const kitDef = (key: string) => KIT_PRESETS.find(k => k.key === key)!;
/** The kit id a factory kit is stored under in the default project (03, 04 ...) */
const kitIdOfKey = (key: string) => kitIdOf(KIT_PRESETS.findIndex(k => k.key === key));

/** A lesson project: the default project with `pat` as A01, selected, in PATTERN mode, on kit `kit` */
function lessonData(pat?: Pattern, kit = '01', kitValues?: Record<string, number>): RytmProject {
  const base = defaultProject();
  const p = pat ?? createPattern(base.defaults, { name: 'LESSON', kit });
  const kits = { ...(base.kits ?? {}) };
  if (kitValues) kits[kit] = { ...(kits[kit] ?? { name: `KIT ${kit}` }), values: kitValues };
  return { ...base, patterns: { ...base.patterns, A01: { ...p, kit } }, active: 'A01', mode: 'pattern', kit, kits };
}
/** Rows of a pattern (one character a step: x trig, o ghost) as a pattern */
const rowsPattern = (rows: PatDef['rows'], extra: Partial<PatDef> = {}) => buildPattern({ name: 'LESSON', rows, ...extra });
/** `p` with trigs (plain steps) added on A01 */
function addTrigs(p: RytmProject, track: number, steps: number[], step: Step = {}): RytmProject {
  let q: RytmProject = p;
  for (const s of steps) q = setStep(q, 'A01', track, s, { ...(getStep(q, 'A01', track, s) ?? {}), ...step }) as RytmProject;
  return q;
}
/** `p` with every trig of `track` on A01 removed, then `steps` set */
function setTrigs(p: RytmProject, track: number, steps: number[], step: Step = {}): RytmProject {
  let q: RytmProject = p;
  for (const s of trigSteps(q, 'A01', track)) q = setStep(q, 'A01', track, s, null) as RytmProject;
  return addTrigs(q, track, steps, step);
}
/** Patch one step of A01 */
const patchStep = (p: RytmProject, track: number, s: number, patch: Step): RytmProject =>
  setStep(p, 'A01', track, s, { ...(getStep(p, 'A01', track, s) ?? {}), ...patch }) as RytmProject;

// checks
const proj = (s: LessonCheckState) => asProject(s.data, SEQ_TRACKS) as RytmProject;
const trigs = (s: LessonCheckState, track: number) => { const p = proj(s); return trigSteps(p, p.active, track); };
const hasTrigs = (s: LessonCheckState, track: number, steps: number[]) => { const t = new Set(trigs(s, track)); return steps.every(x => t.has(x)); };
const stepOf = (s: LessonCheckState, track: number, i: number) => { const p = proj(s); return getStep(p, p.active, track, i); };
const num = (s: LessonCheckState, id: string) => Number(s.values[id] ?? 0);
const presses = (s: LessonCheckState, id: string) => s.events?.[id] ?? 0;
const playing = (s: LessonCheckState) => s.values.play === true || s.transport.playing || !!(s.engine as { playing?: boolean }).playing;
const seqState = (s: LessonCheckState) => (s.engine as { seq?: { fill?: boolean; playing?: boolean; paused?: boolean } }).seq;

// ============================================================================
// FOUNDATIONS
// ============================================================================

const GROOVE = defaultProject().patterns.A02;

const f1: Lesson = {
  id: 'analog-rytm-f1-tracks-pads-voices', device: 'analog-rytm', path: 'foundations', order: O(1), difficulty: 'beginner',
  name: 'Twelve tracks, eight voices',
  description: 'Play the pads, select tracks the hardware way, and hear why some pairs of tracks cut each other off.',
  objective: 'Play and select every track, and explain why some pairs of tracks cut each other off.',
  source: 'Synth Studio · Rytm MKII manual, pads and voices (pp.15, 21-23)', estimatedMinutes: 6,
  concepts: ['signal-routing', 'sequencer-pattern'],
  tags: ['pads', 'voices', 'choke'],
  start: { reset: true, values: { track: 0, page: PAGE.TRIG, pad_mode: 0 }, data: lessonData(GROOVE) },
  steps: [
    {
      kind: 'info', autoplay: true, focus: ['pads'], concept: 'signal-routing',
      instruction: 'Listen to the default kit. Analog circuits inside the Rytm make every one of these drum sounds.',
      principle: 'A drum machine is several small synthesizers, each designed for one kind of hit.',
      explanation: 'Each track has its own sound generator (a "machine"), then a filter and an amp. The pads play them; the sequencer plays them in time.',
      manualReference: REF('p.13'),
    },
    {
      kind: 'do', event: 'pad:bd', presses: 2, focus: ['pad:bd', 'pad:sd'], concept: 'velocity-dynamics',
      instruction: 'Tap the BD pad softly near the bottom, then hard near the top. Then tap SD.',
      check: s => presses(s, 'pad:sd') >= 1,
      solution: { presses: ['pad:sd'] },
      principle: 'Pads sense how hard you hit, so harder hits play louder drums.',
      explanation: 'On this twin, where you tap sets the velocity: higher on the pad is harder. [FIX] plays every hit at one fixed velocity instead.',
      manualReference: REF('p.15'),
    },
    {
      kind: 'do', control: 'track', targetValue: SD, focus: ['key:trk', 'pad:sd'], concept: 'signal-routing',
      instruction: 'Hold [TRK] and tap the SD pad to make SD the track you edit.',
      principle: 'Playing a sound and choosing what to edit are separate jobs.',
      explanation: 'A tap only plays a pad. [TRK] + pad selects its track for the screen and the encoders, unless AUTO TRK SWITCH is on.',
      manualReference: REF('pp.15, 67'),
    },
    {
      kind: 'info', focus: ['pads'], concept: 'signal-routing',
      instruction: 'The 12 pads are 12 tracks, but only 8 analog voices sit behind them. The || marks join the pairs that share one.',
      principle: 'Hardware voices are costly, so drum machines share them between sounds that rarely play together.',
      explanation: 'RS/CP, MT/HT, CH/OH and CY/CB share a voice. BD, SD, BT and LT each have their own.',
      manualReference: REF('p.21'),
    },
    {
      kind: 'predict', event: 'pad:oh', setup: { oh_dec: 80 }, focus: ['pad:oh', 'pad:ch'], concept: 'envelope-decay',
      instruction: 'Tap OH, and while it rings, tap CH.',
      check: s => presses(s, 'pad:ch') >= 1,
      solution: { presses: ['pad:ch'] },
      predict: {
        question: 'OH and CH share one voice. What happens to the ringing open hat?',
        options: ['It keeps ringing under the closed hat', 'It stops: the closed hat takes over the voice', 'Both get quieter', 'CH waits until the open hat ends'],
        answer: 1,
        explain: 'One voice makes one sound at a time, so the closed hat replaces the open one. Layering would need two voices, and a new hit never waits.',
      },
      principle: 'Two sounds that share one circuit cannot sound at the same moment.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Which pair does not share a voice?',
        options: ['RS and CP', 'MT and HT', 'BD and SD', 'CY and CB'], answer: 2,
        explain: 'BD and SD each have their own voice. MT and HT look like two independent drums, but they share one.',
      },
    },
    {
      kind: 'do', control: 'play', targetValue: true, focus: ['key:play'], concept: 'sequencer-pattern',
      instruction: 'Press [PLAY] to start the pattern.',
      principle: 'A step sequencer plays stored hits in time, loop after loop.',
      manualReference: REF('p.37'),
    },
    {
      kind: 'listen', focus: ['pad:oh'], concept: 'envelope-decay',
      instruction: 'The open hat on step 15 is followed by a closed hat on step 16. Compare a short and a long open hat.',
      listen: {
        a: { oh_dec: 30 }, b: { oh_dec: 100 }, labels: ['OH DEC 30', 'OH DEC 100'],
        question: {
          question: 'They sound almost the same length in this groove. Why?',
          options: ['The closed hat on the next step cuts the long one off', 'DEC does nothing on the open hat', 'The compressor shortens it'], answer: 0,
          explain: 'The CH on step 16 takes over the shared voice, so however long the OH could ring, it stops one step later. The compressor changes level, not length.',
        },
      },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', focus: ['key:rec', 'seq:trigs'],
      instruction: 'Make the open hat ring a full beat before anything cuts it. Use [RECORD] and the trig keys.',
      checklist: [
        { text: 'OH has at least two trigs', check: s => trigs(s, OH).length >= 2 },
        {
          text: 'No CH trig in the three steps after an OH trig',
          check: s => {
            const p = proj(s), len = trackLength(getPattern(p, p.active), CH), ch = new Set(trigs(s, CH));
            return trigs(s, OH).every(o => [1, 2, 3].every(d => !ch.has((o + d) % len)));
          },
        },
      ],
      hints: ['Which track cuts the open hat?', 'Move the CH trigs that follow each OH.', 'Leave the three steps after each OH empty on the CH track.'],
      solution: { data: setTrigs(setTrigs(lessonData(GROOVE), OH, [2, 10]), CH, [0, 8, 14]) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does a closed hat cut an open hat?',
        model: 'Both use the same analog voice, which can make only one sound at a time, so the newest hit takes it over.',
      },
    },
  ],
  review: [
    { question: 'How many analog voices does the Rytm MKII have?', options: ['8', '12', '16'], answer: 0, explain: '12 tracks share 8 voices.' },
    { question: 'CH and OH trig on the same step. Which plays?', options: ['OH: the right-hand track wins', 'CH', 'Both'], answer: 0, explain: 'In each pair the right-hand track has priority (manual p.21).' },
    { question: 'How do you select SD for editing?', options: ['Hold [TRK] and tap SD', 'Tap SD', 'Press [SRC]'], answer: 0, explain: '[TRK] + pad selects; a tap only plays it.' },
    { question: 'A ride on CY and an open hat on OH…', options: ['Can ring together', 'Cut each other off', 'Cannot be in one pattern'], answer: 0, explain: 'They are on different voices.' },
  ],
};

const f2: Lesson = {
  id: 'analog-rytm-f2-voice-chain', device: 'analog-rytm', path: 'foundations', order: O(2), difficulty: 'beginner',
  name: 'Pages, encoders and the voice chain',
  description: 'Find any parameter by page and encoder, and follow a sound from the machine through overdrive, filter and amp.',
  objective: 'Find a parameter by page and encoder, and describe the path from sound source through overdrive, filter and amp.',
  source: 'Synth Studio · Rytm MKII manual, sound architecture and Appendix A (pp.13, 77-80)', estimatedMinutes: 8,
  prerequisites: ['analog-rytm-f1-tracks-pads-voices'],
  concepts: ['signal-routing', 'filter-cutoff', 'envelope-decay'],
  start: { reset: true, values: { track: BD, page: PAGE.TRIG }, data: lessonData() },
  steps: [
    {
      kind: 'info', focus: ['key:trig', 'key:src', 'key:smpl', 'key:fltr', 'key:amp', 'key:lfo'], concept: 'signal-routing',
      instruction: 'Each track is one chain. SRC makes the sound, SMPL adds a sample, FLTR shapes the tone, AMP shapes the level.',
      principle: 'A sound passes through stages in a fixed order, and each stage shapes one part of it.',
      explanation: 'Encoders A-H edit whatever page is on the screen. Overdrive sits on the AMP page, but the circuit drives the sound before the filter.',
      manualReference: REF('pp.13, 79'),
    },
    {
      kind: 'do', control: 'page', targetValue: PAGE.SRC, concept: 'signal-routing',
      instruction: 'Press [SRC] to show the BD machine\'s parameters.',
      principle: 'One set of encoders edits many pages: the page decides what each encoder does.',
    },
    {
      kind: 'do', control: 'bd_dec', targetValue: 100, concept: 'envelope-decay',
      instruction: 'Turn encoder D (DEC) to about 100 and tap BD.',
      principle: 'The source makes the raw sound, and its decay sets how long it rings.',
      manualReference: REF('p.97'),
    },
    {
      kind: 'do', control: 'page', targetValue: PAGE.FLTR, concept: 'filter-cutoff',
      instruction: 'Press [FLTR].',
      principle: 'The filter page holds the cutoff, resonance, type and the filter envelope.',
    },
    {
      kind: 'predict', control: 'bd_flt_frq', targetValue: 40, concept: 'filter-cutoff', scope: 'spectrum',
      instruction: 'Turn encoder E (FRQ) down to about 40 and tap BD.',
      predict: {
        question: 'The kick is already low. What will a low-pass FRQ of 40 do?',
        options: ['Lower its pitch', 'Remove the click and the top, leaving a darker thump', 'Make it ring longer', 'Nothing'], answer: 1,
        explain: 'The filter strips the upper harmonics, the click included. Pitch comes from TUN on the SRC page. "Nothing" is tempting because the body is low, but the click is all highs.',
      },
      principle: 'A low-pass filter removes harmonics above its cutoff; the pitch stays put.',
      manualReference: REF('p.79'),
    },
    {
      kind: 'do', control: 'bd_flt_frq', targetValue: 127, concept: 'filter-cutoff',
      instruction: 'Turn FRQ back up to 127.',
      principle: 'Resetting one control lets you hear the next change on its own.',
    },
    {
      kind: 'do', control: 'page', targetValue: PAGE.AMP, concept: 'signal-routing',
      instruction: 'Press [AMP].',
      principle: 'The amp page holds the level envelope, overdrive, sends, pan and volume.',
    },
    {
      kind: 'do', control: 'bd_amp_vol', targetValue: 70, concept: 'gain-staging',
      instruction: 'Turn encoder H (VOL) down to about 70.',
      principle: 'Volume changes how loud a sound is, not its tone colour.',
    },
    {
      kind: 'listen', concept: 'envelope-decay',
      instruction: 'Compare the amp envelope fully open with a short amp decay.',
      listen: {
        a: { bd_amp_dec: 127, bd_amp_vol: 100 }, b: { bd_amp_dec: 30, bd_amp_vol: 100 }, labels: ['AMP DEC INF', 'AMP DEC 30'],
        question: {
          question: 'What did AMP DEC 30 change?', options: ['The pitch', 'The tail got shorter', 'The click got louder'], answer: 1,
          explain: 'The amp envelope can only shorten a sound. At INF it leaves the machine\'s own DEC in charge.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'OVR is an encoder on the AMP page. Where does the overdrive act?',
        options: ['After the amp', 'Before the filter', 'On the reverb'], answer: 1,
        explain: 'The page groups it with the amp controls, but in the signal path the boost comes before the multimode filter, so the filter can tame its fizz (manual p.79).',
      },
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the target kick by ear.', concept: 'envelope-decay',
      setup: { page: PAGE.SRC, bd_dec: 100, bd_flt_frq: 127, bd_amp_vol: 100 },
      match: { target: { bd_dec: 30, bd_flt_frq: 70 }, controls: ['bd_dec', 'bd_flt_frq'] },
      hints: ['One control changes the length, the other the brightness.', 'The target is shorter and darker.', 'SRC DEC near 30, FLTR FRQ near 70.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Name the stages of a Rytm track in order, and what each does.',
        model: 'The machine and the sample make the sound, overdrive adds grit, the filter shapes the tone, and the amp shapes level and length before pan, volume and the effect sends.',
      },
    },
  ],
  review: [
    { question: 'The first stage of a Rytm voice is…', options: ['The sound sources (SRC and SMPL)', 'The filter', 'The amp'], answer: 0, explain: 'Sources, then overdrive, filter and amp.' },
    { question: 'AMP DEC at INF means…', options: ['The machine\'s decay sets the length', 'The sound never ends', 'The amp is muted'], answer: 0, explain: 'The amp stops shortening the sound.' },
    { question: 'Lowering FRQ with the filter on LP2…', options: ['Darkens the sound', 'Lowers the pitch', 'Adds reverb'], answer: 0, explain: 'It removes the highs.' },
    { question: 'With the FX track selected, [SRC] opens…', options: ['DELAY', 'REVERB', 'COMPRESSOR'], answer: 0, explain: 'The FX track\'s pages are DELAY, REVERB, DISTORTION, COMPRESSOR and LFO (manual p.81).' },
  ],
};

// ============================================================================
// SOUND DESIGN
// ============================================================================

const s1: Lesson = {
  id: 'analog-rytm-s1-kick', device: 'analog-rytm', path: 'sound-design', order: O(1), difficulty: 'beginner',
  name: 'Anatomy of a kick: BD HARD and BD CLASSIC',
  description: 'Build a punchy kick from pitch, pitch sweep and decay, and choose between two kick machines.',
  objective: 'Build a punchy kick from pitch, pitch sweep and decay, and choose between BD HARD and BD CLASSIC.',
  source: 'Synth Studio · Rytm MKII manual, BD machines (pp.21, 97)', estimatedMinutes: 9,
  prerequisites: ['analog-rytm-f2-voice-chain'],
  concepts: ['oscillator-pitch', 'modulation-depth', 'envelope-decay'],
  tags: ['kick'],
  start: { reset: true, values: { track: BD, page: PAGE.SRC }, data: lessonData() },
  steps: [
    {
      kind: 'listen', autoplay: true, concept: 'envelope-decay',
      instruction: 'Here is the goal: a driven techno kick. Listen for its punch and its click.',
      listen: { a: { bd_amp_ovr: 46, bd_dec: 56, bd_snp: 70, bd_swt: 40 }, b: { bd_amp_ovr: 0, bd_dec: 47, bd_snp: 6, bd_swt: 90 }, labels: ['Target', 'Init'] },
    },
    {
      kind: 'do', control: 'bd_swt', targetValue: 30, concept: 'modulation-depth',
      instruction: 'Tap BD. Turn encoder B (SWT) from 90 down to about 30, and tap again.',
      principle: 'A faster pitch drop makes a tighter, punchier kick.',
      explanation: 'A struck drum head starts tight and relaxes, so its pitch falls. SWT sets how fast that happens.',
      manualReference: REF('p.97'),
    },
    {
      kind: 'predict', control: 'bd_dec', targetValue: 100, concept: 'envelope-decay',
      instruction: 'Turn encoder D (DEC) up to about 100 and tap.',
      predict: {
        question: 'What will a longer DEC do?',
        options: ['A higher pitch', 'A sharper click', 'A longer, boomier tail', 'A louder attack only'], answer: 2,
        explain: 'DEC sets how long the body rings: the 808-style boom. Pitch is TUN (A) and the click is TIC (G). The whole kick seems louder, but the attack itself does not change.',
      },
      principle: 'Decay is how long a sound keeps ringing after the hit.',
    },
    {
      kind: 'do', control: 'bd_dec', targetValue: 58, concept: 'envelope-decay',
      instruction: 'Set DEC back to about 58.',
      principle: 'At club tempos a shorter kick leaves room for the bass.',
    },
    {
      kind: 'do', control: 'bd_tic', targetValue: 100, concept: 'envelope-attack',
      instruction: 'Turn encoder G (TIC) up to about 100.',
      principle: 'A short click at the start carries the timing, even on small speakers.',
    },
    {
      kind: 'do', control: 'bd_tun', targetValue: -8, tolerance: 0.5, concept: 'oscillator-pitch',
      instruction: 'Turn encoder A (TUN) down to -8.',
      principle: 'Tuning the kick to the song\'s key stops it clashing with the bass.',
      explanation: 'BD machines tune in semitones, so -8 is five semitones below the default -3.',
    },
    {
      kind: 'info', concept: 'modulation-depth', focus: ['key:src'],
      instruction: 'BD HARD can\'t change how far its pitch sweeps, only how fast (SWT). Encoder C is SNP, a fast snap at the start.',
      principle: 'Every machine is a recipe with its own set of controls.',
      explanation: 'For a sweep-depth control, switch the machine: BD CLASSIC has SWD on encoder C (manual p.97).',
      manualReference: REF('p.97'),
    },
    {
      kind: 'do', control: 'bd_machine', targetValue: mi(BD, M.BD_CLASSIC), focus: ['key:src'], concept: 'oscillator-waveform',
      instruction: 'Press [SRC] twice to open the MACHINE menu and choose BD CLASSIC.',
      principle: 'A machine is a recipe for the voice circuit, with its own controls.',
      manualReference: REF('p.21'),
    },
    {
      kind: 'listen', concept: 'modulation-depth',
      instruction: 'BD CLASSIC adds sweep depth. Compare a shallow and a deep sweep.',
      listen: {
        a: { ...machineSound(BD, M.BD_CLASSIC), bd_swt: 64, bd_dec: 60, bd_swd: 20 },
        b: { ...machineSound(BD, M.BD_CLASSIC), bd_swt: 64, bd_dec: 60, bd_swd: 100 },
        labels: ['Shallow sweep', 'Deep sweep'],
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'modulation-depth',
      quiz: {
        question: 'On BD HARD, how do you change how far the pitch sweeps?',
        options: ['Turn SNP', 'You can\'t: change SWT for speed, or switch to BD CLASSIC', 'Turn TIC', 'Turn HLD'], answer: 1,
        explain: 'BD HARD\'s sweep range is built in. SNP adds a separate snap at the start, which is easy to mistake for a deeper sweep.',
      },
    },
    {
      kind: 'challenge', concept: 'envelope-decay',
      instruction: 'Make a techno kick: short enough not to boom between beats at 130 BPM, with a clear click and some drive.',
      checklist: [
        { text: 'BD HARD or BD CLASSIC', check: s => [mi(BD, M.BD_HARD), mi(BD, M.BD_CLASSIC)].includes(num(s, 'bd_machine')) },
        { text: 'SRC DEC at 70 or below', check: s => num(s, 'bd_dec') <= 70 },
        { text: 'A click: TIC 60 or more on BD HARD, or a TRA transient on BD CLASSIC', check: s => (num(s, 'bd_machine') === mi(BD, M.BD_HARD) ? num(s, 'bd_tic') >= 60 : num(s, 'bd_tra') > 0) },
        { text: 'AMP OVR at 15 or more', check: s => num(s, 'bd_amp_ovr') >= 15 },
      ],
      hints: ['Think about the tail between beats.', 'SRC DEC is the tail, TIC is the click, OVR is on the AMP page.', 'Try DEC about 55, TIC about 85, OVR about 30.'],
      solution: { values: { ...machineSound(BD, M.BD_HARD), bd_tun: -2, bd_swt: 52, bd_snp: 28, bd_dec: 58, bd_hld: 26, bd_tic: 88, bd_amp_ovr: 32 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence: what makes a kick punchy?',
        model: 'A fast downward pitch sweep and a short click at the start, with a decay short enough to leave space.',
      },
    },
  ],
  review: [
    { question: 'SWT sets…', options: ['How fast the pitch falls', 'How long it rings', 'The click level'], answer: 0, explain: 'Sweep time.' },
    { question: 'BD HARD\'s sweep depth is…', options: ['Fixed', 'Encoder C', 'Set by TIC'], answer: 0, explain: 'Encoder C is SNP; the depth is built in (manual p.97).' },
    { question: 'For an 808-style boom, raise…', options: ['SRC DEC', 'TIC', 'AMP ATK'], answer: 0, explain: 'A long decay booms.' },
    { question: 'Open the MACHINE menu with…', options: ['[SRC] pressed twice', '[TRK] pressed twice', '[AMP] + [YES]'], answer: 0, explain: 'Or [FUNC] + [SRC] (manual p.21).' },
  ],
};

const SD_CLASSIC = machineSound(SD, M.SD_CLASSIC);

const s2: Lesson = {
  id: 'analog-rytm-s2-snare-clap', device: 'analog-rytm', path: 'sound-design', order: O(2), difficulty: 'beginner',
  name: 'Snare and clap: tone plus noise',
  description: 'Balance the drum-head tones against the wires on SD CLASSIC, then shape a clap\'s bursts and room.',
  objective: 'Balance tone and noise on SD CLASSIC, and shape a clap\'s bursts and room tail on CP CLASSIC.',
  source: 'Synth Studio · Rytm MKII manual, SD and CP machines (pp.100, 102)', estimatedMinutes: 9,
  prerequisites: ['analog-rytm-s1-kick'],
  concepts: ['noise', 'mixing', 'envelope-decay'],
  tags: ['snare', 'clap'],
  start: { reset: true, values: { ...SD_CLASSIC, track: SD, page: PAGE.SRC }, data: lessonData() },
  steps: [
    {
      kind: 'do', control: 'sd_nol', targetValue: 0, concept: 'noise',
      instruction: 'Tap SD. Turn encoder G (NOL) down to 0 and tap again.',
      principle: 'A snare is two sources: pitched drum heads and buzzing snare wires.',
      explanation: 'Without the noise only the two tone oscillators remain, which sounds like a small tom.',
      manualReference: REF('p.100'),
    },
    {
      kind: 'do', control: 'sd_nol', targetValue: 90, concept: 'noise',
      instruction: 'Turn NOL back up to about 90.',
      principle: 'Noise spreads its energy over every frequency, so it sounds like sizzle, not a note.',
    },
    {
      kind: 'predict', control: 'sd_nod', targetValue: 100, concept: 'envelope-decay',
      instruction: 'Turn encoder F (NOD) up to about 100 and tap.',
      predict: {
        question: 'What will a longer noise decay do?',
        options: ['The drum\'s pitch drops', 'The wires ring longer: a washier snare', 'The snap gets sharper', 'It gets quieter'], answer: 1,
        explain: 'NOD lengthens only the noise; the tone keeps its own DEC (D). A sharper snap is SNP (E).',
      },
      principle: 'Separate envelopes let the parts of one sound end at different times.',
    },
    {
      kind: 'do', control: 'sd_snp', targetValue: 100, concept: 'envelope-attack',
      instruction: 'Turn encoder E (SNP) up to about 100.',
      principle: 'A sharp transient makes a sound seem closer and louder at the same level.',
    },
    {
      kind: 'info', concept: 'noise', focus: ['pad:cp'],
      instruction: 'Now the clap. CP CLASSIC fires a few quick noise bursts, then a longer noise tail: the hands, then the room.',
      principle: 'Several quick copies of one sound read as a group playing together.',
      explanation: 'RAT (A) sets the burst speed, NUM (B) how many, RND (C) loosens the timing, CPD (D) each burst\'s length, TON (E) the noise pitch, NOD and NOL (F, G) the tail.',
      manualReference: REF('p.102'),
    },
    {
      kind: 'do', control: 'track', targetValue: CP, focus: ['key:trk', 'pad:cp'], concept: 'signal-routing',
      instruction: 'Hold [TRK] and tap CP.',
      principle: 'Select a track before you edit it: the encoders follow the selected track.',
    },
    {
      kind: 'do', control: 'cp_nod', targetValue: 100, concept: 'envelope-decay',
      instruction: 'Turn encoder F (NOD) up to about 100, then tap CP.',
      principle: 'A longer noise tail sounds like a bigger room around the clap.',
    },
    {
      kind: 'listen', concept: 'noise',
      instruction: 'Compare a tight clap with a loose, slower one.',
      listen: {
        a: { cp_rnd: 0, cp_rat: 85 }, b: { cp_rnd: 90, cp_rat: 60 }, labels: ['Tight', 'Loose'],
        question: {
          question: 'Which sounds more like real hands?', options: ['Tight', 'Loose'], answer: 1,
          explain: 'Real hands never hit at exactly the same moment, so uneven timing reads as human.',
        },
      },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: {
        question: 'Which part of the clap sounds like the room?',
        options: ['The number of bursts (NUM)', 'The noise tail (NOD and NOL)', 'The filter type'], answer: 1,
        explain: 'The bursts are the hands and the tail is the reflections. NUM changes how many hands, not the room.',
      },
    },
    {
      kind: 'challenge', concept: 'mixing', focus: ['key:rec', 'seq:trigs'],
      instruction: 'Layer a house backbeat: a short, snappy snare under a wide clap, both on beats 2 and 4 (steps 5 and 13).',
      checklist: [
        { text: 'SD trigs on steps 5 and 13', check: s => hasTrigs(s, SD, [4, 12]) },
        { text: 'CP trigs on steps 5 and 13', check: s => hasTrigs(s, CP, [4, 12]) },
        { text: 'A short snare: SD NOD at 60 or below', check: s => num(s, 'sd_nod') <= 60 },
        { text: 'A roomy clap: CP NOD at 50 or above', check: s => num(s, 'cp_nod') >= 50 },
      ],
      hints: ['Both tracks need trigs on the same steps: [RECORD], then the trig keys.', 'Select SD, tap trig keys 5 and 13; then select CP and do the same.', 'Snare NOD about 40, clap NOD about 60.'],
      solution: { data: addTrigs(addTrigs(lessonData(), SD, [4, 12]), CP, [4, 12]), values: { sd_nod: 40, cp_nod: 60 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why can SD and CP play together, but RS and CP can\'t?',
        model: 'SD and CP use different voices. RS and CP share one voice, so on the same step CP, the right-hand track, takes it.',
      },
    },
  ],
  review: [
    { question: 'NOL at 0 on SD CLASSIC leaves…', options: ['Only the drum-head tones', 'Only noise', 'Silence'], answer: 0, explain: 'The noise is the wires.' },
    { question: 'NOD sets…', options: ['How long the noise rings', 'The noise pitch', 'The number of claps'], answer: 0, explain: 'Noise decay.' },
    { question: 'A clap\'s tail stands for…', options: ['The room', 'The hands', 'The stick'], answer: 0, explain: 'The reflections around the hands.' },
    { question: 'Which two can layer on one step?', options: ['SD and CP', 'RS and CP', 'CH and OH'], answer: 0, explain: 'Only tracks on separate voices layer.' },
  ],
};

const HATS = rowsPattern({ bd: 'x...x...x...x...', oh: '..x...x...x...x.' });

const s3: Lesson = {
  id: 'analog-rytm-s3-hats-cymbals-choke', device: 'analog-rytm', path: 'sound-design', order: O(3), difficulty: 'beginner',
  name: 'Hats and cymbals, with the choke on purpose',
  description: 'Shape closed and open hats with decay, colour and a high-pass filter, and use the CH/OH choke as a groove tool.',
  objective: 'Shape closed and open hats with DEC, COL and a high-pass filter, and use the CH/OH choke as a groove tool.',
  source: 'Synth Studio · Rytm MKII manual, hat and cymbal machines (pp.21, 79, 106-108)', estimatedMinutes: 9,
  prerequisites: ['analog-rytm-f1-tracks-pads-voices', 'analog-rytm-f2-voice-chain'],
  concepts: ['noise', 'envelope-decay', 'filter-type'],
  tags: ['hi-hat', 'cymbal', 'choke'],
  start: { reset: true, values: { track: OH, page: PAGE.SRC }, data: lessonData(HATS) },
  steps: [
    {
      kind: 'do', control: 'play', targetValue: true, focus: ['key:play'], concept: 'sequencer-pattern',
      instruction: 'Press [PLAY]: open hats play between the kicks.',
      principle: 'Offbeat open hats are the lift of a house groove.',
    },
    {
      kind: 'do', control: 'oh_dec', targetValue: 60, concept: 'envelope-decay',
      instruction: 'Turn encoder D (DEC) on OH to about 60 and listen.',
      principle: 'Closed and open hats are the same metal; the decay length makes the difference.',
      manualReference: REF('p.106'),
    },
    {
      kind: 'do', control: 'track', targetValue: CH, focus: ['key:trk', 'pad:ch'], concept: 'signal-routing',
      instruction: 'Hold [TRK] and tap CH.',
      principle: 'The encoders follow the selected track.',
    },
    {
      kind: 'do', control: 'ch_col', targetValue: -30, concept: 'noise',
      instruction: 'Turn encoder G (COL) to about -30 and tap CH.',
      principle: 'Metal partials at unrelated frequencies are why cymbals have no clear pitch.',
      explanation: 'COL changes the colour of the metal: lower is darker, higher is brighter and thinner.',
    },
    {
      kind: 'do', control: 'page', targetValue: PAGE.FLTR, concept: 'filter-type',
      instruction: 'Press [FLTR].',
      principle: 'Each track has its own multimode filter after the machine.',
    },
    {
      kind: 'do', control: 'ch_flt_typ', targetValue: 4, concept: 'filter-type', scope: 'spectrum',
      instruction: 'Set encoder G (TYP) to HP2.',
      principle: 'A high-pass removes lows the hats don\'t need, which leaves room for the kick.',
      manualReference: REF('p.79'),
    },
    {
      kind: 'do', control: 'ch_flt_frq', targetValue: 70, concept: 'filter-cutoff',
      instruction: 'Set encoder E (FRQ) to about 70.',
      principle: 'The cutoff sets where a high-pass starts removing the lows.',
    },
    {
      kind: 'do', control: 'rec', targetValue: 1, focus: ['key:rec'], concept: 'sequencer-pattern',
      instruction: 'Press [RECORD] for GRID RECORDING: now the trig keys place trigs.',
      principle: 'A step sequencer has an edit mode where keys place notes instead of playing them.',
      manualReference: REF('p.39'),
    },
    {
      kind: 'predict', focus: ['seq:trigs'], concept: 'envelope-decay',
      instruction: 'With CH selected, tap trig keys 4, 8, 12 and 16.',
      check: s => hasTrigs(s, CH, [3, 7, 11, 15]),
      solution: { data: addTrigs(lessonData(HATS), CH, [3, 7, 11, 15]) },
      predict: {
        question: 'OH plays on steps 3, 7, 11 and 15. What will a CH on each next step do?',
        options: ['Cut each open hat after one 16th: a tight "tss-t"', 'Layer with it, so both ring', 'Make the OH louder', 'Nothing: different pads never interact'], answer: 0,
        explain: 'CH and OH share a voice, so each CH replaces the ringing OH. Separate pads don\'t mean separate voices.',
      },
      principle: 'Two tracks on one voice take turns; the newest hit wins.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'CH and OH trig on the same step. Which one plays?',
        options: ['CH: the closed hat always wins', 'OH: the right-hand track has priority', 'Both'], answer: 1,
        explain: 'On a shared voice the right-hand track of the pair wins. CH cuts OH only when it comes later (manual p.21).',
      },
    },
    {
      kind: 'listen', concept: 'filter-type', scope: 'spectrum',
      instruction: 'Compare the closed hat full-range and high-passed. Watch the spectrum.',
      listen: { a: { track: CH, ch_flt_typ: 0, ch_flt_frq: 127 }, b: { track: CH, ch_flt_typ: 4, ch_flt_frq: 70 }, labels: ['Full range', 'High-passed'] },
    },
    {
      kind: 'do', control: 'track', targetValue: CY, focus: ['key:trk', 'pad:cy'], concept: 'signal-routing',
      instruction: 'Hold [TRK] and tap CY.',
      principle: 'The encoders follow the selected track.',
    },
    {
      kind: 'do', control: 'cy_dec', targetValue: 100, setup: { page: PAGE.SRC }, concept: 'envelope-decay',
      instruction: 'On the SRC page, turn encoder D (DEC) to about 100 and tap CY.',
      principle: 'Cymbals have many inharmonic partials that fade slowly into a wash.',
      manualReference: REF('p.108'),
    },
    {
      kind: 'match', instruction: 'Ear challenge: recreate the open hat by ear.', concept: 'envelope-decay',
      setup: { track: OH, page: PAGE.SRC, oh_dec: 30, oh_flt_typ: 4, oh_flt_frq: 90 },
      match: { target: { oh_dec: 90, oh_flt_frq: 40, oh_flt_typ: 4 }, controls: ['oh_dec', 'oh_flt_frq'] },
      hints: ['Listen to the length first, then the body.', 'Longer, with more low-mid body.', 'SRC DEC near 90, FLTR FRQ near 40.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Explain the choke in one sentence, and give one musical use.',
        model: 'CH and OH share one voice, so a later closed hat cuts a ringing open hat; that keeps open hats tight and rhythmic.',
      },
    },
  ],
  review: [
    { question: 'Closed versus open hat is mostly…', options: ['DEC', 'TUN', 'PAN'], answer: 0, explain: 'Same metal, different length.' },
    { question: 'HP2 on a hat…', options: ['Removes the lows and keeps the sizzle', 'Adds low end', 'Lowers the pitch'], answer: 0, explain: 'A high-pass passes the highs.' },
    { question: 'Which tracks can load CY RIDE?', options: ['CY or CB', 'CH', 'LT'], answer: 0, explain: 'It lives on the CY/CB voice (manual p.96).' },
    { question: 'Why does a later CH cut OH?', options: ['They share one voice', 'CH is louder', 'A choke switch'], answer: 0, explain: 'The CH/OH voice plays one sound at a time.' },
  ],
};

const s4: Lesson = {
  id: 'analog-rytm-s4-toms-envelopes', device: 'analog-rytm', path: 'sound-design', order: O(4), difficulty: 'intermediate',
  name: 'Toms and the filter and amp envelopes',
  description: 'Tune three toms against each other, then shape every hit\'s tone and length with the filter and amp envelopes.',
  objective: 'Tune three toms against each other, then shape each hit\'s tone and length with the filter and amp envelopes.',
  source: 'Synth Studio · Rytm MKII manual, XT CLASSIC and the FLTR and AMP pages (pp.78-79, 105)', estimatedMinutes: 10,
  prerequisites: ['analog-rytm-s1-kick'],
  concepts: ['oscillator-pitch', 'envelope-decay', 'filter-cutoff', 'envelope-shape'],
  tags: ['toms'],
  start: { reset: true, values: { track: LT, page: PAGE.SRC }, data: lessonData() },
  steps: [
    {
      kind: 'do', control: 'lt_tun', targetValue: 20, concept: 'oscillator-pitch',
      instruction: 'Tap LT, MT and HT. Then set LT\'s encoder A (TUN) to about 20.',
      principle: 'A tighter drum skin vibrates faster, so higher tuning sounds smaller.',
      explanation: 'Tom TUN moves half a semitone a step and isn\'t marked as notes: tune toms by ear, against each other.',
      manualReference: REF('p.105'),
    },
    {
      kind: 'do', control: 'track', targetValue: MT, focus: ['key:trk', 'pad:mt'], concept: 'signal-routing',
      instruction: 'Hold [TRK] and tap MT.',
      principle: 'The encoders follow the selected track.',
    },
    {
      kind: 'do', control: 'mt_tun', targetValue: 32, concept: 'oscillator-pitch',
      instruction: 'Set MT\'s TUN to about 32.',
      principle: 'Even steps between drum pitches make a fill sound melodic.',
    },
    {
      kind: 'do', control: 'track', targetValue: HT, focus: ['key:trk', 'pad:ht'], concept: 'signal-routing',
      instruction: 'Select HT the same way.',
      principle: 'Each tom is its own track with its own sound.',
    },
    {
      kind: 'do', control: 'ht_tun', targetValue: 44, concept: 'oscillator-pitch',
      instruction: 'Set HT\'s TUN to about 44, then play LT, MT and HT.',
      principle: 'Similar intervals between the toms make them sound like one tuned set.',
    },
    {
      kind: 'predict', control: 'ht_swd', targetValue: 100, concept: 'modulation-depth',
      instruction: 'On HT, turn encoder C (SWD) up to about 100 and tap.',
      predict: {
        question: 'What will a deeper sweep do to the high tom?',
        options: ['Ring longer', 'Start much higher and swoop down: a "laser" tom', 'Get noisier', 'Drop an octave'], answer: 1,
        explain: 'SWD sets how far above TUN the pitch starts. The length is DEC (D) and the noise is NOL and NOD (G, F).',
      },
      principle: 'A pitch that starts high and falls fast is heard as an impact.',
    },
    {
      kind: 'info', concept: 'envelope-shape', focus: ['key:fltr', 'key:amp'],
      instruction: 'FLTR has its own ADSR envelope and a depth (ENV). AMP has attack, hold and decay.',
      principle: 'An envelope is a shape over time that moves one setting on every hit.',
      manualReference: REF('pp.78-79'),
    },
    {
      kind: 'do', control: 'track', targetValue: LT, focus: ['key:trk', 'pad:lt'], concept: 'signal-routing',
      instruction: 'Select LT again.',
      principle: 'The encoders follow the selected track.',
    },
    {
      kind: 'do', control: 'lt_flt_frq', targetValue: 40, setup: { page: PAGE.FLTR }, concept: 'filter-cutoff',
      instruction: 'On the FLTR page, set encoder E (FRQ) to about 40.',
      principle: 'A low cutoff on its own keeps the tom dark from start to finish.',
    },
    {
      kind: 'do', control: 'lt_flt_env', targetValue: 40, concept: 'envelope-shape',
      instruction: 'Set encoder H (ENV) to about +40 and tap LT.',
      principle: 'Envelope depth opens the filter on every hit: a bright attack, then a darker tail.',
    },
    {
      kind: 'listen', concept: 'envelope-shape', scope: 'spectrum',
      instruction: 'Compare the dark tom without and with the filter envelope.',
      listen: { a: { track: LT, lt_flt_frq: 40, lt_flt_env: 0 }, b: { track: LT, lt_flt_frq: 40, lt_flt_env: 40 }, labels: ['No envelope', 'ENV +40'] },
    },
    {
      kind: 'do', control: 'lt_amp_dec', targetValue: 40, setup: { page: PAGE.AMP }, concept: 'envelope-decay',
      instruction: 'On the AMP page, set encoder C (DEC) to about 40.',
      principle: 'The amp envelope can shorten a sound, never lengthen what the source makes.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: {
        question: 'AMP DEC is at INF. What decides how long the tom rings?',
        options: ['FLTR REL', 'SRC DEC (the machine)', 'LFO DEP', 'AMP HLD'], answer: 1,
        explain: 'At INF the amp shortens nothing, so the machine\'s decay sets the length. FLTR REL only shapes the tone after the trig ends.',
      },
    },
    {
      kind: 'challenge', concept: 'oscillator-pitch', focus: ['key:rec', 'seq:trigs'],
      instruction: 'Make a three-tom fill in steps 13-16 that sounds tuned and punchy, not boomy.',
      checklist: [
        { text: 'LT, MT and HT each trig in steps 13-16', check: s => [LT, MT, HT].every(t => trigs(s, t).some(x => x >= 12 && x <= 15)) },
        { text: 'Tuned low to high: LT below MT below HT', check: s => num(s, 'lt_tun') < num(s, 'mt_tun') && num(s, 'mt_tun') < num(s, 'ht_tun') },
        { text: 'Short tails: SRC DEC 75 or less, or AMP DEC 90 or less, on each tom', check: s => ['lt', 'mt', 'ht'].every(t => num(s, `${t}_dec`) <= 75 || num(s, `${t}_amp_dec`) <= 90) },
      ],
      hints: ['Play the toms from high to low in time.', 'Shorten the tails with SRC DEC or AMP DEC.', 'A quick sweep (SWT about 30) adds punch.'],
      solution: {
        data: addTrigs(addTrigs(addTrigs(lessonData(), HT, [12]), MT, [13]), LT, [14]),
        values: { lt_tun: 24, mt_tun: 34, ht_tun: 44, lt_dec: 55, mt_dec: 55, ht_dec: 55, lt_amp_dec: 127, mt_amp_dec: 127, ht_amp_dec: 127 },
      },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between the filter envelope and the amp envelope?',
        model: 'The filter envelope moves the tone through each hit; the amp envelope moves the loudness.',
      },
    },
  ],
  review: [
    { question: 'Positive ENV with a low FRQ gives…', options: ['A bright attack and a darker tail', 'A darker attack', 'A higher pitch'], answer: 0, explain: 'The filter opens, then closes.' },
    { question: 'SWD on a tom sets…', options: ['How far the pitch starts above TUN', 'How long it rings', 'The noise'], answer: 0, explain: 'Sweep depth.' },
    { question: 'AMP DEC = INF means…', options: ['The machine\'s decay sets the length', 'Silence', 'Endless reverb'], answer: 0, explain: 'The amp stops shortening the sound.' },
    { question: 'AMP HLD on AUTO holds…', options: ['For as long as the pad is held or the trig lasts', 'Forever', 'For no time'], answer: 0, explain: 'AUTO follows the pad (manual p.79) and, on the sequencer, the trig length.' },
  ],
};

const SENDS = rowsPattern({ bd: 'x...x...x...x...', cp: '....x.......x...', ch: '..x...x...x...x.', rs: '......x.......x.' });

const s5: Lesson = {
  id: 'analog-rytm-s5-sends', device: 'analog-rytm', path: 'sound-design', order: O(5), difficulty: 'intermediate',
  name: 'Delay and reverb sends',
  description: 'Send chosen drums into the FX track\'s delay and reverb, and set delay times that lock to the tempo.',
  objective: 'Send chosen drums into the delay and reverb, and set tempo-synced delay times.',
  source: 'Synth Studio · Rytm MKII manual, AMP sends and the FX track (pp.36, 79, 81-82)', estimatedMinutes: 9,
  prerequisites: ['analog-rytm-f2-voice-chain'],
  concepts: ['effects', 'signal-routing', 'timing-tempo'],
  start: { reset: true, values: { track: RS, page: PAGE.AMP, fx_del_fdb: 49, fx_del_x: 0 }, data: lessonData(SENDS) },
  steps: [
    {
      kind: 'do', control: 'play', targetValue: true, focus: ['key:play'], concept: 'sequencer-pattern',
      instruction: 'Press [PLAY]. The rim shot plays on steps 7 and 15.',
      principle: 'Effects are easiest to judge on a loop that keeps playing.',
    },
    {
      kind: 'do', control: 'rs_amp_del', targetValue: 80, concept: 'effects',
      instruction: 'On RS\'s AMP page, turn encoder E (DEL) up to about 80.',
      principle: 'A send copies part of a track into an effect, and the dry sound stays.',
      manualReference: REF('p.79'),
    },
    {
      kind: 'do', control: 'track', targetValue: FX, focus: ['key:fx'], concept: 'signal-routing',
      instruction: 'Press [FX] to select the FX track.',
      principle: 'Shared effects live on their own track, which every drum can send to.',
    },
    {
      kind: 'do', control: 'page', targetValue: PAGE.SRC, concept: 'effects',
      instruction: 'Press [SRC]: on the FX track it shows the DELAY page.',
      principle: 'The same page keys open the effect pages when the FX track is selected.',
      manualReference: REF('p.81'),
    },
    {
      kind: 'do', control: 'fx_del_tim', targetValue: 16, concept: 'timing-tempo',
      instruction: 'Set encoder A (TIM) to 16, an eighth note.',
      principle: 'Delay times locked to the tempo turn echoes into rhythm.',
      explanation: 'TIM counts 128th notes of the tempo: 32 is one beat, 16 an eighth and 24 a dotted eighth (manual p.81).',
    },
    {
      kind: 'predict', control: 'fx_del_fdb', targetValue: 130, concept: 'effects',
      instruction: 'Turn encoder D (FDB) up to about 130.',
      predict: {
        question: 'What will very high feedback do?',
        options: ['The delay gets shorter', 'The echoes stop', 'The echoes keep coming and can swell louder', 'It adds reverb'], answer: 2,
        explain: 'With high feedback each repeat comes back about as loud as the last, or louder, so the echoes build into a dub swell. It doesn\'t change the time, which is TIM\'s job.',
      },
      principle: 'Feeding an effect\'s output back into its input repeats it again and again.',
    },
    {
      kind: 'do', control: 'fx_del_fdb', targetValue: 60, concept: 'effects',
      instruction: 'Bring FDB back down to about 60.',
      principle: 'Moderate feedback gives a few repeats that fade away.',
    },
    {
      kind: 'listen', concept: 'effects',
      instruction: 'Compare repeats in one place with repeats bouncing left and right.',
      listen: { a: { fx_del_x: 0 }, b: { fx_del_x: 1 }, labels: ['Mono repeats', 'Ping-pong'] },
    },
    {
      kind: 'do', control: 'track', targetValue: CP, focus: ['key:trk', 'pad:cp'], concept: 'signal-routing',
      instruction: 'Hold [TRK] and tap CP.',
      principle: 'Each track has its own send amounts.',
    },
    {
      kind: 'do', control: 'cp_amp_rev', targetValue: 60, setup: { page: PAGE.AMP }, concept: 'effects',
      instruction: 'On CP\'s AMP page, turn encoder F (REV) up to about 60.',
      principle: 'More send puts more of that one track into the shared effect.',
    },
    {
      kind: 'do', control: 'fx_rev_dec', targetValue: 90, setup: { track: FX, page: PAGE.SMPL }, concept: 'effects',
      instruction: 'On the FX track\'s REVERB page ([SMPL]), turn encoder B (DEC) up to about 90.',
      principle: 'A longer reverb decay sounds like a bigger space.',
      manualReference: REF('p.82'),
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'effects',
      quiz: {
        question: 'Why use sends instead of one reverb on the whole mix?',
        options: ['Sends are louder', 'Each drum gets its own amount, so the kick can stay dry and tight', 'Only sends sync to the tempo'], answer: 1,
        explain: 'Sends set an amount per track. Tempo sync is a feature of the delay, not of sends.',
      },
    },
    {
      kind: 'challenge', concept: 'effects',
      instruction: 'Make a dub rim: dotted-eighth echoes bouncing left and right, while the kick stays dry.',
      checklist: [
        { text: 'RS DEL send at 60 or more', check: s => num(s, 'rs_amp_del') >= 60 },
        { text: 'The kick stays dry: BD DEL 0 and BD REV 10 or less', check: s => num(s, 'bd_amp_del') === 0 && num(s, 'bd_amp_rev') <= 10 },
        { text: 'DELAY TIM on a dotted eighth (23-25)', check: s => num(s, 'fx_del_tim') >= 23 && num(s, 'fx_del_tim') <= 25 },
        { text: 'Ping-pong on (X)', check: s => num(s, 'fx_del_x') === 1 },
      ],
      hints: ['Two settings live on RS, two on the DELAY page.', 'TIM 24 is a dotted eighth.', 'X turns ping-pong on.'],
      solution: { values: { rs_amp_del: 80, bd_amp_del: 0, bd_amp_rev: 0, fx_del_tim: 24, fx_del_x: 1, fx_del_fdb: 60 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between AMP DEL on a track and VOL on the DELAY page?',
        model: 'AMP DEL sets how much of that one track goes into the delay; the DELAY page\'s VOL sets how loud the delay comes back, for every track.',
      },
    },
  ],
  review: [
    { question: 'DELAY TIM 32 is…', options: ['One beat', 'A 16th', 'A bar'], answer: 0, explain: 'TIM counts 128th notes, so 32 is a quarter note (manual p.81).' },
    { question: 'DELAY TIM 24 is…', options: ['A dotted eighth', 'An eighth', 'A triplet'], answer: 0, explain: '24/128 of a bar = 3 sixteenths.' },
    { question: 'X ON makes the repeats…', options: ['Alternate left and right', 'Longer', 'Darker'], answer: 0, explain: 'Ping-pong.' },
    { question: 'On the FX track, TRACK LEVEL sets…', options: ['The delay and reverb return level', 'The kick volume', 'The tempo'], answer: 0, explain: 'One master level for both send returns (manual p.36).' },
  ],
};

// Kit 02 (the demo song's drop) and its pattern, with the master section dry
const proj0 = defaultProject();
const DROP = proj0.patterns.A07;
const DROP_VALUES = proj0.kits!['02'].values;
const DROP_MASTER = Object.fromEntries(Object.entries(DROP_VALUES).filter(([k]) => k.startsWith('fx_cmp') || k === 'fx_dis_amt'));

const s6: Lesson = {
  id: 'analog-rytm-s6-dist-comp', device: 'analog-rytm', path: 'sound-design', order: O(6), difficulty: 'intermediate',
  name: 'The master bus: distortion and compressor',
  description: 'Glue the kit with the compressor and add grit with the distortion, without losing the kick\'s punch.',
  objective: 'Glue the kit with the compressor and add grit with the distortion, without losing the kick\'s punch.',
  source: 'Synth Studio · Rytm MKII manual, Appendix B: DISTORTION and COMPRESSOR (pp.82-83)', estimatedMinutes: 10,
  prerequisites: ['analog-rytm-s5-sends'],
  concepts: ['effects', 'gain-staging'],
  start: { reset: true, values: { ...DROP_VALUES, fx_dis_amt: 0, fx_cmp_mix: 0, track: FX, page: PAGE.AMP }, data: lessonData(DROP, '02', DROP_VALUES) },
  steps: [
    {
      kind: 'listen', autoplay: true, concept: 'effects',
      instruction: 'Hear the drop kit with a dry bus, then as it was designed: distortion and parallel compression.',
      listen: { a: { fx_dis_amt: 0, fx_cmp_mix: 0 }, b: { ...DROP_MASTER }, labels: ['Dry', 'Glued'] },
    },
    {
      kind: 'do', control: 'fx_cmp_mix', targetValue: 127, concept: 'effects',
      instruction: 'On the FX track\'s COMP page ([AMP]), turn encoder G (MIX) up to 127.',
      principle: 'A compressor turns loud moments down, so the mix sounds denser.',
      explanation: 'At the far left MIX passes only the dry signal, so nothing is compressed (manual p.83).',
      manualReference: REF('p.83'),
    },
    {
      kind: 'do', control: 'fx_cmp_thr', targetValue: 96, concept: 'effects',
      instruction: 'Turn encoder A (THR) down to about 96 and listen to the tails between the hits.',
      principle: 'A lower threshold means more of the signal gets compressed.',
    },
    {
      kind: 'predict', control: 'fx_cmp_rat', targetValue: 3, concept: 'effects',
      instruction: 'Set encoder E (RAT) to MAX.',
      predict: {
        question: 'With the threshold down, what does a higher ratio do to the drums?',
        options: ['They only get quieter', 'The tempo changes', 'They are squeezed harder: denser and flatter, with less punch', 'Nothing'], answer: 2,
        explain: 'Higher ratios compress the signal more (manual p.83), so the loud hits and the quiet tails move closer together. It isn\'t only quieter: MUP or VOL can bring the level back.',
      },
      principle: 'A higher ratio squeezes everything above the threshold harder.',
    },
    {
      kind: 'do', control: 'fx_cmp_rat', targetValue: 1, concept: 'effects',
      instruction: 'Set RAT back to 1:4.',
      principle: 'A moderate ratio controls the peaks but keeps some punch.',
    },
    {
      kind: 'listen', setup: { fx_cmp_thr: 96, fx_cmp_mix: 127 }, concept: 'envelope-attack',
      instruction: 'Compare a fast and a slow compressor attack. Listen to the start of each kick.',
      listen: {
        a: { fx_cmp_atk: 0 }, b: { fx_cmp_atk: 6 }, labels: ['Fast attack', 'Slow attack'],
        question: {
          question: 'Which keeps more of the kick\'s click?', options: ['Fast attack', 'Slow attack'], answer: 1,
          explain: 'A slow attack lets the first milliseconds through before the gain drops, so the transient survives.',
        },
      },
    },
    {
      kind: 'do', control: 'fx_cmp_seq', targetValue: 1, setup: { fx_cmp_seq: 0 }, concept: 'effects',
      instruction: 'Set encoder F (SEQ) to LPF.',
      principle: 'Filtering what the compressor listens to decides which drum makes it pump.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'effects',
      quiz: {
        question: 'With SEQ on LPF, which drum mostly drives the compression?',
        options: ['The hats (highs)', 'None: SEQ is an output EQ', 'The kick (lows)'], answer: 2,
        explain: 'SEQ filters the compressor\'s detector, not the sound. LPF leaves the bass, so the kick triggers the pumping; HPF would do the opposite (manual p.83).',
      },
    },
    {
      kind: 'do', control: 'fx_dis_amt', targetValue: 30, setup: { page: PAGE.FLTR }, concept: 'effects',
      instruction: 'On the DIST page ([FLTR]), turn encoder A (AMT) up to about 30.',
      principle: 'Distortion adds harmonics, so sounds feel louder and grittier at the same peak level.',
      explanation: 'By default the delay returns before the distortion and compressor (DEL = PRE) and the reverb after them (REV = POST).',
      manualReference: REF('p.82'),
    },
    {
      kind: 'challenge', concept: 'gain-staging',
      instruction: 'Make the bus pump with the kick while the hats and clap still breathe.',
      checklist: [
        { text: 'Mostly compressed: MIX 90 or more', check: s => num(s, 'fx_cmp_mix') >= 90 },
        { text: 'Threshold at 110 or below', check: s => num(s, 'fx_cmp_thr') <= 110 },
        { text: 'The compressor listens to the kick: SEQ on LPF', check: s => num(s, 'fx_cmp_seq') === 1 },
        { text: 'An attack of 1 ms or slower', check: s => num(s, 'fx_cmp_atk') >= 3 },
        { text: 'Some grit: DIST AMT 10-50', check: s => num(s, 'fx_dis_amt') >= 10 && num(s, 'fx_dis_amt') <= 50 },
      ],
      hints: ['The compressor must hear the kick most.', 'Use SEQ, a middle threshold and an attack that isn\'t too fast.', 'THR about 104, ATK 3 ms, REL 0.2 s, RAT 1:4, MIX about 100, AMT about 20.'],
      solution: { values: { fx_cmp_mix: 100, fx_cmp_thr: 104, fx_cmp_seq: 1, fx_cmp_atk: 4, fx_cmp_rel: 1, fx_cmp_rat: 1, fx_dis_amt: 20 } },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence: what does the compressor\'s attack do to a drum mix?',
        model: 'It sets how quickly the compressor clamps down: slow attacks keep the transients punchy, fast ones flatten them.',
      },
    },
  ],
  review: [
    { question: 'COMP MIX fully left means…', options: ['Only the dry signal', 'Full compression', 'Silence'], answer: 0, explain: 'MIX blends dry and compressed (manual p.83).' },
    { question: 'SEQ on HPF makes the compressor…', options: ['React less to the bass, so it pumps less', 'Pump harder', 'Louder'], answer: 0, explain: 'It filters what the detector hears.' },
    { question: 'A slower ATK…', options: ['Lets transients through', 'Removes the click', 'Raises the threshold'], answer: 0, explain: 'The compressor reacts later.' },
    { question: 'DIST SYM away from 0…', options: ['Offsets the wave so one side distorts first', 'Pans the mix', 'Retunes the kit'], answer: 0, explain: 'Asymmetric distortion (manual p.82).' },
    { question: 'By default the delay returns…', options: ['Before DIST and COMP', 'After DIST and COMP', 'Not at all'], answer: 0, explain: 'DEL is PRE by default; REV is POST (manual p.82).' },
  ],
};

// ============================================================================
// EAR TRAINING
// ============================================================================

const e1: Lesson = {
  id: 'analog-rytm-e1-decay', device: 'analog-rytm', path: 'ear-training', order: O(1), difficulty: 'beginner',
  name: 'Ear training: how long is that hit?',
  description: 'Hear and match decay lengths on a kick and an open hat, from wide differences down to fine ones.',
  objective: 'Hear and match decay lengths on a kick and an open hat, to within 8 % of knob travel.',
  source: 'Synth Studio · Rytm MKII manual, BD HARD and OH CLASSIC (pp.97, 107)', estimatedMinutes: 6,
  prerequisites: ['analog-rytm-s1-kick'],
  concepts: ['envelope-decay'],
  start: { reset: true, values: { track: BD, page: PAGE.SRC }, data: lessonData() },
  steps: [
    {
      kind: 'do', control: 'bd_dec', targetValue: 20, concept: 'envelope-decay',
      instruction: 'Set encoder D (DEC) to about 20 and tap BD.',
      principle: 'Decay is how long a sound keeps ringing after the hit.',
    },
    {
      kind: 'listen', concept: 'envelope-decay',
      instruction: 'Hear the two extremes. Listen to the tail, not the click.',
      listen: { a: { bd_dec: 20 }, b: { bd_dec: 100 }, labels: ['Short', 'Long'] },
    },
    {
      kind: 'match', instruction: 'Ear challenge: match the kick\'s length.', concept: 'envelope-decay', setup: { bd_dec: 20 },
      match: { target: { bd_dec: 100 }, controls: ['bd_dec'] },
      hints: ['Is the target longer or shorter than yours?', 'Much longer: think of an 808 boom.', 'DEC near 100.'],
    },
    {
      kind: 'match', instruction: 'And the other way.', concept: 'envelope-decay', setup: { bd_dec: 110 },
      match: { target: { bd_dec: 30 }, controls: ['bd_dec'] },
      hints: ['Longer or shorter?', 'Much shorter: a tight thump.', 'DEC about 30.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: {
        question: 'A closed hat and an open hat differ mainly in…', options: ['Pitch', 'Decay', 'Pan'], answer: 1,
        explain: 'Same metal, different ring time. Pitch differences are small, and pan doesn\'t change the sound itself.',
      },
    },
    {
      kind: 'match', instruction: 'Now the open hat: match its length.', concept: 'envelope-decay',
      setup: { track: OH, oh_dec: 50 },
      match: { target: { oh_dec: 70, oh_flt_typ: 4, oh_flt_frq: 64 }, controls: ['oh_dec'] },
      hints: ['Count how long the hiss lasts.', 'It rings a bit longer.', 'DEC about 70.'],
    },
    {
      kind: 'match', instruction: 'Fine difference: match the kick again, closely.', concept: 'envelope-decay',
      setup: { track: BD, bd_dec: 54 },
      match: { target: { bd_dec: 64 }, controls: ['bd_dec'], tolerance: 0.06 },
      hints: ['Very close: compare the very end of the tail.', 'Slightly longer.', 'DEC about 64.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What did you listen for to judge decay?',
        model: 'How long the sound keeps ringing before it fades, especially in the gap between hits.',
      },
    },
  ],
  review: [
    { question: 'A longer SRC DEC on a kick…', options: ['Lengthens the boom', 'Raises the pitch', 'Adds click'], answer: 0, explain: 'Ring time.' },
    { question: 'To judge decay, listen to…', options: ['The tail', 'The first click', 'The pan'], answer: 0, explain: 'The tail carries the length.' },
    { question: 'Closed versus open hat is mostly…', options: ['Decay', 'Tuning', 'Filter type'], answer: 0, explain: 'Ring time.' },
  ],
};

const BD_CL = { ...machineSound(BD, M.BD_CLASSIC), bd_dec: 60 };

const e2: Lesson = {
  id: 'analog-rytm-e2-pitch-sweep', device: 'analog-rytm', path: 'ear-training', order: O(2), difficulty: 'intermediate',
  name: 'Ear training: sweep depth and sweep time',
  description: 'Tell how far a kick\'s pitch falls from how fast it falls, and match both on BD CLASSIC.',
  objective: 'Tell sweep depth from sweep time by ear, and match both on BD CLASSIC.',
  source: 'Synth Studio · Rytm MKII manual, BD CLASSIC (p.97)', estimatedMinutes: 8,
  prerequisites: ['analog-rytm-e1-decay'],
  concepts: ['modulation-depth', 'oscillator-pitch'],
  start: { reset: true, values: { ...BD_CL, track: BD, page: PAGE.SRC }, data: lessonData() },
  steps: [
    {
      kind: 'do', control: 'bd_swd', targetValue: 0, concept: 'modulation-depth',
      instruction: 'Tap BD. Turn encoder C (SWD) down to 0 and tap again.',
      principle: 'Without a pitch sweep a kick is just a fading tone.',
    },
    {
      kind: 'listen', concept: 'modulation-depth',
      instruction: 'Compare a shallow and a deep sweep.',
      listen: { a: { bd_swd: 10, bd_swt: 64 }, b: { bd_swd: 110, bd_swt: 64 }, labels: ['Shallow', 'Deep'] },
    },
    {
      kind: 'match', instruction: 'Ear challenge: match the sweep depth.', concept: 'modulation-depth', setup: { bd_swd: 20, bd_swt: 64 },
      match: { target: { bd_swd: 100 }, controls: ['bd_swd'] },
      hints: ['Does the target start higher?', 'Much higher: a big "boing".', 'SWD near 100.'],
    },
    {
      kind: 'predict', control: 'bd_swt', targetValue: 10, setup: { bd_swd: 100, bd_swt: 64 }, concept: 'modulation-depth',
      instruction: 'Keep SWD at 100. Turn encoder B (SWT) from 64 down to 10 and tap.',
      predict: {
        question: 'What changes when SWT gets shorter?',
        options: ['The drop starts higher', 'The drop is faster: a tight thump instead of a "pew"', 'The kick rings longer', 'Nothing'], answer: 1,
        explain: 'SWT is the time the drop takes. The start height is SWD, which you didn\'t touch. Slow and deep is the electro "laser"; fast reads as punch.',
      },
      principle: 'How fast a pitch falls turns punch into a zap.',
    },
    {
      kind: 'listen', concept: 'modulation-depth',
      instruction: 'Compare a fast and a slow drop at the same depth.',
      listen: { a: { bd_swd: 100, bd_swt: 10 }, b: { bd_swd: 100, bd_swt: 100 }, labels: ['Fast drop', 'Slow drop'] },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'modulation-depth',
      quiz: {
        question: 'A kick sounds like a laser "pew". Which settings are most likely?',
        options: ['Shallow SWD, short SWT', 'Deep SWD, long SWT', 'A high TRA', 'A long DEC only'], answer: 1,
        explain: 'A "pew" is a big, slow pitch fall. A long DEC alone makes a boom, not a pew.',
      },
    },
    {
      kind: 'match', instruction: 'Two things moved: match both.', concept: 'modulation-depth', setup: { bd_swd: 30, bd_swt: 90 },
      match: { target: { bd_swd: 90, bd_swt: 20 }, controls: ['bd_swd', 'bd_swt'] },
      hints: ['How far, and how fast?', 'It starts high and drops quickly.', 'SWD about 90, SWT about 20.'],
    },
    {
      kind: 'match', instruction: 'Finer: match both again.', concept: 'modulation-depth', setup: { bd_swd: 40, bd_swt: 60 },
      match: { target: { bd_swd: 60, bd_swt: 45 }, controls: ['bd_swd', 'bd_swt'] },
      hints: ['Fix the start height first.', 'A bit deeper and a bit faster.', 'SWD about 60, SWT about 45.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do sweep depth and sweep time sound different?',
        model: 'Depth is how high the hit starts, which gives more "boing"; time is how fast it falls: fast is punch, slow is a laser.',
      },
    },
  ],
  review: [
    { question: 'SWD sets…', options: ['How high the pitch starts', 'How fast it falls', 'The decay'], answer: 0, explain: 'Depth.' },
    { question: 'SWT sets…', options: ['How fast the pitch falls', 'The start height', 'The click'], answer: 0, explain: 'Time.' },
    { question: 'A punchy techno sweep is…', options: ['Fast SWT with a moderate SWD', 'Slow and deep', 'No sweep at all'], answer: 0, explain: 'Fast drops punch.' },
  ],
};

const e3: Lesson = {
  id: 'analog-rytm-e3-filter-type', device: 'analog-rytm', path: 'ear-training', order: O(3), difficulty: 'intermediate',
  name: 'Ear training: which filter type?',
  description: 'Identify low-pass, high-pass, band-pass and band-stop by ear on a clap, then match type and cutoff.',
  objective: 'Identify LP2, BP, HP2 and BS by ear on a clap, and match the type plus the cutoff.',
  source: 'Synth Studio · Rytm MKII manual, FLTR page (p.79)', estimatedMinutes: 8,
  prerequisites: ['analog-rytm-f2-voice-chain'],
  concepts: ['filter-type', 'filter-cutoff'],
  start: { reset: true, values: { track: CP, page: PAGE.FLTR, cp_flt_frq: 64, cp_flt_res: 50, cp_flt_typ: 4 }, data: lessonData() },
  steps: [
    {
      kind: 'do', control: 'cp_flt_typ', targetValue: 0, concept: 'filter-type', scope: 'spectrum',
      instruction: 'On CP\'s FLTR page, set encoder G (TYP) to LP2 and tap CP.',
      principle: 'A filter keeps some frequencies and removes others; the type decides which.',
      manualReference: REF('p.79'),
    },
    {
      kind: 'listen', concept: 'filter-type', scope: 'spectrum',
      instruction: 'Compare low-pass and high-pass at the same cutoff. Watch the spectrum.',
      listen: { a: { cp_flt_typ: 0 }, b: { cp_flt_typ: 4 }, labels: ['Low-pass', 'High-pass'] },
    },
    {
      kind: 'predict', control: 'cp_flt_typ', targetValue: 2, concept: 'filter-type', scope: 'spectrum',
      instruction: 'Set TYP to BP and tap CP.',
      predict: {
        question: 'What will band-pass at FRQ 64 sound like?',
        options: ['Fuller than before', 'Thin and nasal: only a band around the cutoff remains', 'Exactly like low-pass', 'Silent'], answer: 1,
        explain: 'Band-pass cuts both the lows and the highs, leaving a telephone-like band. It isn\'t silent: the clap has energy at the centre.',
      },
      principle: 'A band-pass filter keeps only the frequencies near its centre.',
    },
    {
      kind: 'match', instruction: 'Ear challenge: which type is the target?', concept: 'filter-type', setup: { cp_flt_typ: 0 },
      match: { target: { cp_flt_typ: 4 }, controls: ['cp_flt_typ'] },
      hints: ['Is the low end there?', 'The lows are gone.', 'HP2.'],
    },
    {
      kind: 'match', instruction: 'And this one?', concept: 'filter-type', setup: { cp_flt_typ: 4 },
      match: { target: { cp_flt_typ: 2 }, controls: ['cp_flt_typ'] },
      hints: ['Are the very highs still there?', 'Both ends are cut.', 'BP.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'filter-type',
      quiz: {
        question: 'PK boosts a band. What does BS (band-stop) do?',
        options: ['Boosts the lows', 'Cuts a notch, keeping the lows and highs', 'Removes everything above FRQ'], answer: 1,
        explain: 'Band-stop is the opposite of band-pass, and RES sets how narrow the notch is. Removing everything above FRQ is low-pass.',
      },
    },
    {
      kind: 'match', instruction: 'Type and cutoff together.', concept: 'filter-cutoff', setup: { cp_flt_typ: 4, cp_flt_frq: 100 },
      match: { target: { cp_flt_typ: 0, cp_flt_frq: 40 }, controls: ['cp_flt_typ', 'cp_flt_frq'] },
      hints: ['First the type: lows or highs?', 'The lows stay, and it is quite dark.', 'LP2, FRQ about 40.'],
    },
    {
      kind: 'match', instruction: 'One more: type and cutoff.', concept: 'filter-cutoff', setup: { cp_flt_typ: 0, cp_flt_frq: 60 },
      match: { target: { cp_flt_typ: 4, cp_flt_frq: 90 }, controls: ['cp_flt_typ', 'cp_flt_frq'] },
      hints: ['Thin or full?', 'Thin, with only the top left.', 'HP2, FRQ about 90.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'How do you tell high-pass from band-pass by ear?',
        model: 'High-pass keeps all the highs and sounds bright and airy; band-pass also trims the top, so it sounds nasal.',
      },
    },
  ],
  review: [
    { question: 'Lows gone, highs intact:', options: ['HP', 'LP', 'BP'], answer: 0, explain: 'High-pass.' },
    { question: 'Thin and telephone-like:', options: ['BP', 'LP2', 'PK'], answer: 0, explain: 'Band-pass.' },
    { question: 'LP2 versus LP1:', options: ['LP1 has a gentler slope', 'LP1 is steeper', 'They are the same'], answer: 0, explain: 'All the types are resonant 2-pole filters; the 1-pole types roll off more gently (manual p.79).' },
  ],
};

const e4: Lesson = {
  id: 'analog-rytm-e4-compression', device: 'analog-rytm', path: 'ear-training', order: O(4), difficulty: 'advanced',
  name: 'Ear training: compression, and compression versus decay',
  description: 'Hear how much and how fast the compressor works, then tell compression apart from a shorter kick.',
  objective: 'Hear the compression amount and attack, and tell compression apart from a shorter kick decay.',
  source: 'Synth Studio · Rytm MKII manual, COMPRESSOR (p.83)', estimatedMinutes: 10,
  prerequisites: ['analog-rytm-s6-dist-comp', 'analog-rytm-e1-decay', 'analog-rytm-e3-filter-type'],
  concepts: ['effects', 'envelope-decay', 'gain-staging'],
  start: { reset: true, values: { ...DROP_VALUES, fx_cmp_mix: 0, track: FX, page: PAGE.AMP }, data: lessonData(DROP, '02', DROP_VALUES) },
  steps: [
    {
      kind: 'do', control: 'fx_cmp_mix', targetValue: 127, concept: 'effects',
      instruction: 'Set COMP encoder G (MIX) to 127.',
      principle: 'You only hear a compressor when its output is in the mix.',
    },
    {
      kind: 'listen', setup: { fx_cmp_rat: 1, fx_cmp_mix: 127 }, concept: 'effects',
      instruction: 'Compare light and heavy compression. Listen between the hits: do the tails rise against the hits?',
      listen: { a: { fx_cmp_thr: 124 }, b: { fx_cmp_thr: 100 }, labels: ['Light', 'Heavy'] },
    },
    {
      kind: 'match', instruction: 'Ear challenge: match the amount of compression.', concept: 'effects', setup: { fx_cmp_thr: 124 },
      match: { target: { fx_cmp_thr: 100, fx_cmp_rat: 1, fx_cmp_mix: 127 }, controls: ['fx_cmp_thr'] },
      hints: ['Is the target squashed more?', 'Yes: the hits are flatter and the whole kit is denser and quieter.', 'THR is lower, about 100.'],
    },
    {
      kind: 'listen', setup: { fx_cmp_thr: 100 }, concept: 'envelope-attack',
      instruction: 'Compare a slow and a fast attack on heavy compression.',
      listen: {
        a: { fx_cmp_atk: 6 }, b: { fx_cmp_atk: 0 }, labels: ['Slow attack', 'Fast attack'],
        question: {
          question: 'Which has more kick click?', options: ['Slow attack', 'Fast attack'], answer: 0,
          explain: 'The slow attack lets the click through before the compressor reacts.',
        },
      },
    },
    {
      kind: 'match', instruction: 'Two things: how much, and how fast.', concept: 'effects', setup: { fx_cmp_thr: 124, fx_cmp_atk: 0 },
      match: { target: { fx_cmp_thr: 104, fx_cmp_atk: 6 }, controls: ['fx_cmp_thr', 'fx_cmp_atk'] },
      hints: ['How much, and how fast?', 'Heavy, but the click survives.', 'THR about 104, ATK 30 ms.'],
    },
    {
      kind: 'predict', control: 'fx_cmp_rel', targetValue: 0, setup: { fx_cmp_thr: 100, fx_cmp_atk: 4, fx_cmp_rel: 4 }, concept: 'effects',
      instruction: 'Set encoder C (REL) to 0.1 s.',
      predict: {
        question: 'A very short release on heavy compression makes the kit…',
        options: ['Sound like only the kick got shorter', 'Pump quickly: the tails jump back up between the hits', 'Just get quieter'], answer: 1,
        explain: 'Release is how fast the level recovers. A short release lets it spring back between hits, which is the audible pump, and that moves every sound, not only the kick.',
      },
      principle: 'A short release lets the level spring back quickly after each hit.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'envelope-decay',
      quiz: {
        question: 'The kick\'s tail sounds shorter. How do you tell a shorter SRC DEC from compression?',
        options: ['They sound identical', 'DEC changes the hats too', 'Compression moves every sound and pumps; DEC changes only the kick'], answer: 2,
        explain: 'DEC belongs to one track. The bus compressor moves the whole mix at once.',
      },
    },
    {
      kind: 'match', instruction: 'Interleaved: the kick and the bus both changed. Match all three.', concept: 'effects',
      setup: { bd_dec: 80, fx_cmp_thr: 124, fx_cmp_mix: 60, fx_cmp_rel: 1, fx_cmp_atk: 2 },
      match: { target: { bd_dec: 40, fx_cmp_thr: 100, fx_cmp_mix: 127 }, controls: ['bd_dec', 'fx_cmp_thr', 'fx_cmp_mix'] },
      hints: ['Two stages moved: the kick itself, and the bus.', 'The kick is shorter on its own, and everything is squashed.', 'BD DEC about 40, THR about 100, MIX full.'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What clues tell you the compressor is working?',
        model: 'Tails and quiet parts rise between the hits, the mix pumps with the kick, and transients flatten when the attack is fast.',
      },
    },
  ],
  review: [
    { question: 'Heavy compression with a fast attack…', options: ['Flattens the transients', 'Adds click', 'Retunes the kit'], answer: 0, explain: 'It clamps at once.' },
    { question: 'Pumping in time with the kick suggests…', options: ['Compression keyed by the lows', 'A longer decay', 'Reverb'], answer: 0, explain: 'SEQ on LPF, or bass-led detection.' },
    { question: 'Only the kick got shorter and nothing else changed:', options: ['Its DEC', 'The compressor', 'The reverb'], answer: 0, explain: 'A per-track change.' },
  ],
};

// ============================================================================
// SEQUENCING
// ============================================================================

const Q1_BD = addTrigs(lessonData(), BD, [0, 4, 8, 12]);
const Q1_CP = addTrigs(Q1_BD, CP, [4, 12]);
const Q1_OH = addTrigs(Q1_CP, OH, [2, 6, 10, 14]);
const Q1_RS = addTrigs(Q1_OH, RS, [3, 10, 15]);

const q1: Lesson = {
  id: 'analog-rytm-q1-rhythm-basics', device: 'analog-rytm', path: 'sequencing', order: O(1), difficulty: 'beginner',
  name: 'Four on the floor, backbeat and syncopation',
  description: 'Program a four-on-the-floor kick, a backbeat and a syncopated rim in GRID RECORDING.',
  objective: 'Program a four-on-the-floor kick, a backbeat and one syncopated part in grid recording.',
  source: 'Synth Studio · Rytm MKII manual, quick start and GRID RECORDING (pp.20, 37, 39)', estimatedMinutes: 8,
  prerequisites: ['analog-rytm-f1-tracks-pads-voices'],
  concepts: ['sequencer-pattern', 'timing-tempo'],
  start: { reset: true, values: { track: BD, page: PAGE.TRIG, rec: 0 }, data: lessonData() },
  steps: [
    {
      kind: 'do', focus: ['key:rec', 'seq:trigs', 'key:play'], concept: 'sequencer-pattern',
      instruction: 'Press [RECORD]. With BD selected, tap trig keys 1, 5, 9 and 13, then press [PLAY].',
      check: s => num(s, 'rec') >= 1 && trigs(s, BD).join() === '0,4,8,12' && playing(s),
      solution: { values: { rec: 1, play: true }, data: Q1_BD },
      principle: 'A kick on every beat is the pulse that dance music is built on.',
      manualReference: REF('p.39'),
    },
    {
      kind: 'do', focus: ['key:trk', 'pad:cp', 'seq:trigs'], concept: 'sequencer-pattern',
      instruction: 'Hold [TRK] and tap CP. Tap trig keys 5 and 13.',
      check: s => trigs(s, CP).join() === '4,12',
      solution: { values: { track: CP }, data: Q1_CP },
      principle: 'Hits on beats 2 and 4 form the backbeat.',
    },
    {
      kind: 'predict', focus: ['key:trk', 'pad:oh', 'seq:trigs'], concept: 'timing-tempo',
      instruction: 'Select OH ([TRK] + OH) and tap trig keys 3, 7, 11 and 15.',
      check: s => trigs(s, OH).join() === '2,6,10,14',
      solution: { values: { track: OH }, data: Q1_OH },
      predict: {
        question: 'These land between the kicks. How will they feel?',
        options: ['Slower: the tempo seems to halve', 'Lifting: offbeat hats push the groove', 'Messy: they clash with the kick', 'The same as hats on the beat'], answer: 1,
        explain: 'Offbeats fill the gaps between pulses, so the groove bounces, like a house hat. They don\'t change the tempo, and they land between the kicks, not on them.',
      },
      principle: 'Hits between the beats create motion against a steady pulse.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'Syncopation means…', options: ['Playing faster', 'Accenting positions between the beats', 'Playing every 16th'], answer: 1,
        explain: 'It is about where the accents fall, not speed or density.',
      },
    },
    {
      kind: 'do', focus: ['key:trk', 'pad:rs', 'seq:trigs'], concept: 'timing-tempo',
      instruction: 'Select RS and tap trig keys 4, 11 and 16.',
      check: s => trigs(s, RS).join() === '3,10,15',
      solution: { values: { track: RS }, data: Q1_RS },
      principle: 'Off-beat accents create tension against a steady kick.',
    },
    {
      kind: 'listen', concept: 'timing-tempo',
      instruction: 'Compare the groove with and without the syncopated rim.',
      listen: { a: { rs_amp_vol: 110 }, b: { rs_amp_vol: 0 }, labels: ['Syncopated', 'Square'] },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern', focus: ['seq:trigs'],
      instruction: 'Make an electro beat: move the kick off at least one beat, and keep a snare or clap on 2 and 4.',
      checklist: [
        { text: 'BD has three or more trigs', check: s => trigs(s, BD).length >= 3 },
        { text: 'At least one BD trig is off the beats (not on steps 1, 5, 9 or 13)', check: s => trigs(s, BD).some(x => x % 4 !== 0) },
        { text: 'SD or CP on steps 5 and 13', check: s => hasTrigs(s, SD, [4, 12]) || hasTrigs(s, CP, [4, 12]) },
      ],
      hints: ['Keep the kick on step 1.', 'Move one kick between the beats.', 'Try kicks on steps 1, 7 and 10.'],
      solution: { data: setTrigs(Q1_RS, BD, [0, 6, 9]) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is the difference between four on the floor and a syncopated kick?',
        model: 'Four on the floor marks every beat evenly; a syncopated kick lands between the beats and creates tension against the pulse.',
      },
    },
  ],
  review: [
    { question: 'Four on the floor puts the kick on steps…', options: ['1, 5, 9, 13', '1, 3, 5, 7', 'Every step'], answer: 0, explain: 'One per beat.' },
    { question: 'To place trigs with the trig keys you first…', options: ['Press [RECORD] for GRID RECORDING', 'Press [PLAY]', 'Hold [FUNC]'], answer: 0, explain: 'GRID RECORDING mode edits trigs (manual p.39).' },
    { question: 'Offbeat 8th hats sit on steps…', options: ['3, 7, 11, 15', '1, 5, 9, 13', '2, 4, 6, 8'], answer: 0, explain: 'The "and" of each beat.' },
    { question: 'Syncopation…', options: ['Puts accents between the beats', 'Is a faster tempo', 'Is a filter effect'], answer: 0, explain: 'Off-beat emphasis.' },
  ],
};

// q2: the boom bap kit and its pattern, made stiff (every hit at full velocity, no swing, no micro timing)
const BOOM = kitDef('boombap');
const BOOM_STIFF = (() => {
  const p = buildPattern({ ...BOOM.pattern, swing: 50, vel: {}, steps: {}, rows: Object.fromEntries(Object.entries(BOOM.pattern.rows).map(([k, r]) => [k, r!.replace(/[ovh]/g, 'x')])) });
  return p;
})();
const Q2_START = lessonData(BOOM_STIFF, kitIdOfKey('boombap'), BOOM.values);
const Q2_GHOST1 = patchStep(Q2_START, SD, 7, { vel: 45 });
const Q2_GHOST2 = patchStep(Q2_GHOST1, SD, 15, { vel: 45 });
const Q2_SWING = updatePatternSettings(Q2_GHOST2, 'A01', { swing: 62 }) as RytmProject;
const Q2_MICRO = patchStep(patchStep(Q2_SWING, SD, 4, { micro: 3 }), SD, 12, { micro: 3 });
const Q2_HATS = (() => {
  let p = setTrigs(Q2_MICRO, CH, Array.from({ length: 16 }, (_, i) => i));
  for (let i = 0; i < 16; i++) p = patchStep(p, CH, i, { vel: i % 4 === 0 ? 110 : i % 2 === 0 ? 75 : 45 });
  return p;
})();

const q2: Lesson = {
  id: 'analog-rytm-q2-groove', device: 'analog-rytm', path: 'sequencing', order: O(2), difficulty: 'intermediate',
  name: 'Groove: ghost notes, accents, swing and micro timing',
  description: 'Turn a stiff boom bap beat into a groove with velocity, swing and micro timing.',
  objective: 'Turn a stiff beat into a groove with velocity (accents and ghosts), swing and micro timing.',
  source: 'Synth Studio · Rytm MKII manual, GRID RECORDING, TRIG page, accent and swing (pp.39, 43, 49-50)', estimatedMinutes: 10,
  prerequisites: ['analog-rytm-q1-rhythm-basics'],
  concepts: ['velocity-dynamics', 'timing-tempo'],
  start: { reset: true, values: { ...BOOM.values, track: SD, page: PAGE.TRIG, rec: 1 }, data: Q2_START },
  steps: [
    {
      kind: 'do', focus: ['seq:trigs', 'seq:trig:8'], concept: 'velocity-dynamics',
      instruction: 'Hold SD\'s trig key 8 and turn TRIG encoder B (VEL) down to about 45.',
      check: s => (stepOf(s, SD, 7)?.vel ?? 127) <= 55,
      solution: { data: Q2_GHOST1 },
      principle: 'Quiet extra hits, ghost notes, fill the gaps without competing with the beat.',
      manualReference: REF('pp.39, 43'),
    },
    {
      kind: 'do', focus: ['seq:trig:16'], concept: 'velocity-dynamics',
      instruction: 'Do the same on SD\'s trig key 16.',
      check: s => (stepOf(s, SD, 15)?.vel ?? 127) <= 55,
      solution: { data: Q2_GHOST2 },
      principle: 'Repeating a detail in every bar turns it into part of the groove.',
    },
    {
      kind: 'predict', focus: ['key:bank:G', 'key:tempo'], concept: 'timing-tempo',
      instruction: 'Set the swing to 62 %: [FUNC] + [BANK G], then [UP] until it reads 62, or SWING in the [TEMPO] menu.',
      check: s => { const p = proj(s); const w = getPattern(p, p.active).swing; return w >= 60 && w <= 64; },
      solution: { data: Q2_SWING },
      predict: {
        question: 'Swing delays every second 16th. Which hits move?',
        options: ['Every hit equally', 'Only the kick', 'The even steps: the ghosts on 8 and 16 and the hats between', 'Only steps 1, 5, 9 and 13'], answer: 2,
        explain: 'Swing pushes steps 2, 4, 6… late. The main hits on 1, 5, 9 and 13 stay put, which is why swing grooves without losing the pulse (manual p.50).',
      },
      principle: 'Delaying every other 16th turns straight time into a shuffle.',
    },
    {
      kind: 'do', focus: ['seq:trig:5', 'seq:trig:13', 'key:right'], concept: 'timing-tempo',
      instruction: 'Hold SD\'s trig key 5 and press [RIGHT] three times. Repeat on trig key 13.',
      check: s => stepOf(s, SD, 4)?.micro === 3 && stepOf(s, SD, 12)?.micro === 3,
      solution: { data: Q2_MICRO },
      principle: 'Hits just behind the grid feel relaxed; hits just ahead feel urgent.',
      explanation: 'Each micro step is 1/384 of a bar, so three steps is a small push late (manual p.39).',
    },
    {
      kind: 'listen', concept: 'velocity-dynamics',
      instruction: 'Compare the snare with velocity working, and with every hit at the same level.',
      listen: { a: { sd_vel_vol: 1 }, b: { sd_vel_vol: 0 }, labels: ['Dynamic', 'Flat'] },
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'velocity-dynamics',
      quiz: {
        question: 'An accent is…', options: ['A hit moved late', 'A hit clearly louder than its neighbours', 'A hit with reverb'], answer: 1,
        explain: 'Accents are about level. The Rytm also has accent trigs ([FUNC] + [BANK F]), and TRACK LEVEL sets how strong they are (manual pp.49-50).',
      },
    },
    {
      kind: 'challenge', concept: 'velocity-dynamics', focus: ['seq:trigs'],
      instruction: 'Groove the hats: loud on the beats, softer between them, with swing between 55 and 65 %.',
      checklist: [
        { text: 'Swing between 55 and 65 %', check: s => { const p = proj(s); const w = getPattern(p, p.active).swing; return w >= 55 && w <= 65; } },
        { text: 'CH has eight or more trigs', check: s => trigs(s, CH).length >= 8 },
        {
          text: 'The loudest and softest CH hits differ by 40 or more', check: s => {
            const p = proj(s), tr = getPattern(p, p.active).tracks[CH];
            const v = trigs(s, CH).map(i => tr.steps[i]?.vel ?? tr.vel);
            return v.length > 0 && Math.max(...v) - Math.min(...v) >= 40;
          },
        },
        { text: 'At least one SD ghost note (VEL 55 or less)', check: s => { const p = proj(s), tr = getPattern(p, p.active).tracks[SD]; return trigs(s, SD).some(i => (tr.steps[i]?.vel ?? tr.vel) <= 55); } },
      ],
      hints: ['Hats on every 16th, then shape their levels.', 'Loud on 1, 5, 9 and 13, ghosts between.', 'Use 110 / 45 / 75 / 45 in every beat.'],
      solution: { data: Q2_HATS },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Which two kinds of small change make a beat feel human?',
        model: 'Changes in loudness (accents and ghost notes) and in timing (swing and micro timing).',
      },
    },
  ],
  review: [
    { question: 'Swing 50 % means…', options: ['Straight timing', 'Maximum swing', 'Half tempo'], answer: 0, explain: 'No delay on the swing steps (manual p.50).' },
    { question: 'Ghost notes are…', options: ['Very quiet hits', 'Muted hits', 'Echoes'], answer: 0, explain: 'Low velocity.' },
    { question: 'Holding a trig and pressing [RIGHT]…', options: ['Nudges it later (micro timing)', 'Copies it', 'Deletes it'], answer: 0, explain: 'Micro timing (manual p.39).' },
    { question: 'The Rytm\'s swing goes from…', options: ['50 % (straight) to 80 %', '0 to 100 %', '25 to 75 %'], answer: 0, explain: '51-80 % swing, 50 % straight (manual p.50).' },
  ],
};

// q3: the trap kit's 808-style kick as a bass line over two bars
const TRAP = kitDef('trap');
const Q3_PAT = (() => {
  const p = createPattern(SEQ_TRACKS, { name: '808 LINE', length: 32, kit: kitIdOfKey('trap') });
  for (const s of [0, 10, 16, 22, 29]) p.tracks[BD].steps[s] = {};
  return p;
})();
const Q3_START = lessonData(Q3_PAT, kitIdOfKey('trap'), TRAP.values);
const Q3_NOTE = patchStep(Q3_START, BD, 16, { note: 63 });
const Q3_DEC = patchStep(Q3_NOTE, BD, 22, { locks: { dec: 110 } });
const Q3_LOCKTRIG = setStep(Q3_DEC, 'A01', BD, 26, { trigless: true, locks: { flt_frq: 60 } }) as RytmProject;
const Q3_LINE = patchStep(patchStep(Q3_LOCKTRIG, BD, 10, { note: 58 }), BD, 29, { note: 65 });

const q3: Lesson = {
  id: 'analog-rytm-q3-parameter-locks', device: 'analog-rytm', path: 'sequencing', order: O(3), difficulty: 'intermediate',
  name: 'Parameter locks: a different sound on every step',
  description: 'Lock notes and sound parameters on single steps, add a lock trig, and turn an 808 kick into a bass line.',
  objective: 'Lock sound parameters on single steps, and add a lock trig, to turn the kick into a bass line.',
  source: 'Synth Studio · Rytm MKII manual, trig types and parameter locks (pp.39, 43, 47)', estimatedMinutes: 9,
  prerequisites: ['analog-rytm-q1-rhythm-basics', 'analog-rytm-s1-kick'],
  concepts: ['parameter-locks', 'oscillator-pitch'],
  start: { reset: true, values: { ...TRAP.values, track: BD, page: PAGE.TRIG, rec: 1 }, data: Q3_START },
  steps: [
    {
      kind: 'do', focus: ['key:page', 'seq:trig:1'], concept: 'parameter-locks',
      instruction: 'Press [PAGE] for page 2. Hold trig key 1 (step 17) and turn TRIG encoder A (NOT) to +3.',
      check: s => stepOf(s, BD, 16)?.note === 63,
      solution: { data: Q3_NOTE },
      principle: 'A parameter lock stores a different value on one step only.',
      manualReference: REF('p.47'),
    },
    {
      kind: 'do', focus: ['key:src', 'seq:trig:7'], concept: 'parameter-locks',
      instruction: 'Press [SRC]. Hold trig key 7 (step 23) and turn encoder D (DEC) up to about 110.',
      check: s => { const p = proj(s); return lockedSteps(p, p.active, BD, 'dec').includes(22) && (stepOf(s, BD, 22)?.locks?.dec ?? 0) >= 100; },
      solution: { data: Q3_DEC },
      principle: 'Any sound parameter can change from one step to the next.',
    },
    {
      kind: 'predict', focus: ['key:play'], concept: 'parameter-locks',
      instruction: 'Press [PLAY] and listen to the hit after step 23.',
      check: s => playing(s),
      solution: { values: { play: true } },
      predict: {
        question: 'What happens on the next trig after step 23?',
        options: ['It keeps the long DEC', 'It goes back to the kit\'s own DEC', 'It goes silent'], answer: 1,
        explain: 'A lock belongs to its own trig. The next unlocked trig uses the kit value again.',
      },
      principle: 'A lock applies only to the trig that holds it.',
    },
    {
      kind: 'do', focus: ['key:fltr', 'seq:trig:11'], concept: 'parameter-locks',
      instruction: 'Press [FLTR]. Hold the empty trig key 11 (step 27) and turn encoder E (FRQ) down to about 60.',
      check: s => { const st = stepOf(s, BD, 26); return !!st?.trigless && (st.locks?.flt_frq ?? 127) <= 70; },
      solution: { data: Q3_LOCKTRIG },
      principle: 'A lock trig changes settings without playing a new note.',
      explanation: 'The bass note that is still ringing darkens halfway through its tail. On the hardware [FUNC] + a trig key places a lock trig too (manual p.39).',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'parameter-locks',
      quiz: {
        question: 'How many different parameters can one Rytm pattern lock?', options: ['8', 'Unlimited', '72'], answer: 2,
        explain: 'Up to 72 per pattern, and a parameter locked on many steps still counts once (manual p.47). The trig editor shows how many are used.',
      },
    },
    {
      kind: 'challenge', concept: 'oscillator-pitch',
      instruction: 'Make the kick a two-bar bass line: at least four different notes, and one long note.',
      checklist: [
        { text: 'The pattern is 32 steps long', check: s => { const p = proj(s); return getPattern(p, p.active).length === 32; } },
        {
          text: 'BD trigs use four or more different notes', check: s => {
            const p = proj(s), tr = getPattern(p, p.active).tracks[BD];
            return new Set(trigSteps(p, p.active, BD).map(i => tr.steps[i]?.note ?? tr.note)).size >= 4;
          },
        },
        { text: 'One BD trig locks DEC to 100 or more', check: s => { const p = proj(s); return lockedSteps(p, p.active, BD, 'dec').some(i => (getStep(p, p.active, BD, i)?.locks?.dec ?? 0) >= 100); } },
      ],
      hints: ['Hold a trig and turn NOT.', 'Use small steps: 0, +3, -2, +5.', 'Lock DEC high on one note so it rings.'],
      solution: { data: Q3_LINE },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'In one sentence: what is a parameter lock?',
        model: 'A value stored on one step that overrides the track\'s setting for that trig only.',
      },
    },
  ],
  review: [
    { question: 'A lock applies to…', options: ['Its own trig only', 'The whole track', 'Every track'], answer: 0, explain: 'Per trig.' },
    { question: 'A lock trig…', options: ['Changes settings without a new note', 'Plays twice', 'Mutes the track'], answer: 0, explain: 'It is trigless (manual p.39).' },
    { question: 'To remove one lock from a trig…', options: ['Hold the trig and press that parameter\'s encoder', 'Press [PLAY]', 'Turn TRACK LEVEL'], answer: 0, explain: 'Hold the trig and press the encoder (manual p.47), or use the trig editor.' },
  ],
};

// q4: the 909-style kit's pattern with every condition taken out
const NINE = kitDef('nineoh');
const Q4_PAT = buildPattern({ ...NINE.pattern, rows: { ...NINE.pattern.rows, cy: 'x...............', lt: '................', ht: '................' } });
const Q4_START = lessonData(Q4_PAT, kitIdOfKey('nineoh'), NINE.values);
const Q4_14 = patchStep(Q4_START, CY, 0, { cond: '1:4' });
const Q4_RS = patchStep(addTrigs(Q4_14, RS, [9]), RS, 9, { cond: '50%' });
const Q4_FILL = patchStep(addTrigs(Q4_RS, SD, [15]), SD, 15, { cond: 'FILL' });
const Q4_EVOLVE = patchStep(patchStep(patchStep(addTrigs(Q4_FILL, LT, [6, 10]), LT, 6, { cond: '2:4' }), LT, 10, { cond: '3:4' }), CY, 8, { cond: '4:4' });

const q4: Lesson = {
  id: 'analog-rytm-q4-trig-conditions', device: 'analog-rytm', path: 'sequencing', order: O(4), difficulty: 'intermediate',
  name: 'Trig conditions: patterns that change over time',
  description: 'Use A:B counts, probability and FILL so a 16-step loop evolves over four bars.',
  objective: 'Use A:B, probability and FILL conditions so a 16-step loop evolves over four bars.',
  source: 'Synth Studio · Rytm MKII manual, TRIG page and conditional locks (pp.43, 48-49)', estimatedMinutes: 9,
  prerequisites: ['analog-rytm-q3-parameter-locks'],
  concepts: ['sequencer-pattern'],
  start: { reset: true, values: { ...NINE.values, track: CY, page: PAGE.TRIG, rec: 1 }, data: Q4_START },
  steps: [
    {
      kind: 'do', focus: ['seq:trig:1'], concept: 'sequencer-pattern',
      instruction: 'Hold CY\'s trig key 1. TRIG encoder D now shows TRC: turn it to 1:4.',
      check: s => stepOf(s, CY, 0)?.cond === '1:4',
      solution: { data: Q4_14 },
      principle: 'An A:B condition plays a trig on loop A of every B loops.',
      explanation: 'While a trig is held, TRC (the trig condition) takes PRB\'s place on encoder D (manual p.48). The trig editor (a long press) has it too.',
      manualReference: REF('p.48'),
    },
    {
      kind: 'predict', focus: ['key:play'], concept: 'sequencer-pattern',
      instruction: 'Press [PLAY] and listen for four bars.',
      check: s => playing(s),
      solution: { values: { play: true } },
      predict: {
        question: 'With 1:4, how often does the cymbal play?',
        options: ['Every loop', 'Once every four loops, on the first', 'Randomly, a quarter of the time', 'Only when FILL is held'], answer: 1,
        explain: '1:4 counts loops: it plays on loop 1, then skips loops 2-4. That is fixed, unlike 25 %, which is random.',
      },
      principle: 'Counting loops lets a short pattern change on a longer cycle.',
    },
    {
      kind: 'do', focus: ['key:trk', 'pad:rs', 'seq:trig:10'], concept: 'sequencer-pattern',
      instruction: 'Select RS. Place a trig on step 10, hold it, and set TRC to 50%.',
      check: s => stepOf(s, RS, 9)?.cond === '50%',
      solution: { values: { track: RS }, data: Q4_RS },
      principle: 'Probability gives variation that never repeats exactly.',
    },
    {
      kind: 'do', focus: ['key:trk', 'pad:sd', 'seq:trig:16'], concept: 'sequencer-pattern',
      instruction: 'Select SD. Add a trig on step 16 and set its TRC to FILL.',
      check: s => stepOf(s, SD, 15)?.cond === 'FILL',
      solution: { values: { track: SD }, data: Q4_FILL },
      principle: 'Fill trigs wait for your signal, so the variation lands where you choose.',
    },
    {
      kind: 'do', event: 'seq:fill', focus: ['key:fill', 'key:rec'], concept: 'sequencer-pattern',
      instruction: 'Press [RECORD] to leave GRID RECORDING, then hold [FILL] during a bar.',
      check: s => !!seqState(s)?.fill || presses(s, 'seq:fill') > 0,
      solution: { values: { rec: 0 }, presses: ['seq:fill'] },
      principle: 'Holding a key to reveal hidden trigs is a fast live fill.',
      explanation: 'FILL works while the pattern plays and GRID RECORDING is off (manual p.49).',
      manualReference: REF('p.49'),
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: {
        question: '25 % versus 1:4?',
        options: ['No difference', '1:4 is random', '25 % is random; 1:4 is a fixed every-fourth-loop pattern'], answer: 2,
        explain: 'A probability is rolled again every time. A:B follows a counter.',
      },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Make the loop sound different on each of four bars, using conditions on the trigs you have.',
      checklist: [
        { text: 'Three or more trigs with A:B conditions (B = 2 or 4)', check: s => { const p = proj(s), pat = getPattern(p, p.active); return pat.tracks.reduce((n, t) => n + Object.values(t.steps).filter(x => /^[1-8]:[24]$/.test(x.cond ?? '')).length, 0) >= 3; } },
        { text: 'At least one probability condition', check: s => { const p = proj(s), pat = getPattern(p, p.active); return pat.tracks.some(t => Object.values(t.steps).some(x => /%$/.test(x.cond ?? ''))); } },
        { text: 'At least one FILL trig', check: s => { const p = proj(s), pat = getPattern(p, p.active); return pat.tracks.some(t => Object.values(t.steps).some(x => x.cond === 'FILL')); } },
        { text: 'The kick has no conditions, so the pulse stays', check: s => { const p = proj(s); return Object.values(getPattern(p, p.active).tracks[BD].steps).every(x => !x.cond); } },
      ],
      hints: ['Give each bar its own extra hit.', 'Use 2:4, 3:4 and 4:4 on different trigs.', 'Keep the kick unconditional.'],
      solution: { data: Q4_EVOLVE },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'When would you choose A:B over a probability?',
        model: 'When the change should repeat predictably, like a fill every fourth bar; probability is for loose variation that never repeats exactly.',
      },
    },
  ],
  review: [
    { question: '1:4 plays…', options: ['On the first of every four loops', '25 % of the time', 'Four times'], answer: 0, explain: 'Loop counting (manual p.48).' },
    { question: 'FILL trigs play…', options: ['Only while FILL is active', 'Always', 'Never'], answer: 0, explain: 'FILL mode (manual p.49).' },
    { question: 'PRE is true when…', options: ['The last condition evaluated on this track was true', 'The last step had a trig', 'The pattern restarts'], answer: 0, explain: 'It chains to the previous condition (manual p.48).' },
    { question: 'NEI looks at…', options: ['The previous track\'s last condition', 'The next pattern', 'The kick'], answer: 0, explain: 'The neighbour is the track before (manual p.48).' },
  ],
};

// ============================================================================
// PERFORMANCE
// ============================================================================

const P1_START = patchStep(addTrigs(lessonData(DROP, '02', DROP_VALUES), SD, [15]), SD, 15, { cond: 'FILL' });
const P1_ROLL = patchStep(P1_START, SD, 15, { retrig: { rate: 12, len: 14, vel: 0 } });
const P1_RISE = patchStep(P1_START, SD, 15, { retrig: { rate: 12, len: 14, vel: 40 } });

const p1: Lesson = {
  id: 'analog-rytm-p1-mutes-fills-rolls', device: 'analog-rytm', path: 'performance', order: O(1), difficulty: 'intermediate',
  name: 'Live: mutes, fills and retrig rolls',
  description: 'Perform an eight-bar build with track mutes, a fill and a snare roll that grows into the downbeat.',
  objective: 'Perform an 8-bar build with track mutes, a fill and a retrig roll.',
  source: 'Synth Studio · Rytm MKII manual, MUTE mode, RETRIG and FILL (pp.23, 35, 41-42, 49)', estimatedMinutes: 9,
  prerequisites: ['analog-rytm-q4-trig-conditions'],
  concepts: ['sequencer-pattern', 'velocity-dynamics'],
  start: { reset: true, values: { ...DROP_VALUES, track: SD, page: PAGE.TRIG, pad_mode: 0, rec: 0 }, data: P1_START },
  steps: [
    {
      kind: 'do', focus: ['key:mute', 'pad:bd'], concept: 'sequencer-pattern',
      instruction: 'Press [PLAY], then [MUTE], and tap the BD pad to mute the kick.',
      check: s => num(s, 'pad_mode') === 1 && (proj(s).mutes ?? []).includes(BD),
      solution: { values: { pad_mode: 1, play: true }, data: { ...P1_START, mutes: [BD] } },
      principle: 'Taking an element away makes its return hit harder.',
      explanation: 'MUTE mode mutes a track\'s sequencer. These master mutes stay when the pattern or kit changes (manual p.23).',
      manualReference: REF('p.23'),
    },
    {
      kind: 'do', focus: ['pad:bd'], concept: 'sequencer-pattern',
      instruction: 'On the next bar\'s downbeat, tap BD again to bring the kick back.',
      check: s => !(proj(s).mutes ?? []).includes(BD),
      solution: { data: P1_START },
      principle: 'Changes on a downbeat sound planned; between beats they sound like slips.',
    },
    {
      kind: 'predict', event: 'seq:fill', focus: ['key:fill'], concept: 'sequencer-pattern',
      instruction: 'Hold [FILL] through the last bar of a four-bar phrase.',
      check: s => !!seqState(s)?.fill || presses(s, 'seq:fill') > 0,
      solution: { presses: ['seq:fill'] },
      predict: {
        question: 'What changes while FILL is held?',
        options: ['The tempo doubles', 'FILL trigs play and !FILL trigs are skipped', 'Every track retriggers', 'The kit reloads'], answer: 1,
        explain: 'FILL is a trig condition: it changes which trigs play, not the tempo or the kit. This pattern\'s snare on step 16 only plays in a fill.',
      },
      principle: 'Conditional trigs let one pattern hold both a groove and its fill.',
    },
    {
      kind: 'do', focus: ['key:rec', 'seq:trig:16', 'key:up'], concept: 'velocity-dynamics',
      instruction: 'Press [RECORD]. Hold SD\'s trig key 16 and press [UP] until the retrig reads 1/32.',
      check: s => stepOf(s, SD, 15)?.retrig?.rate === 12,
      solution: { values: { rec: 1 }, data: P1_ROLL },
      principle: 'A retrig repeats one hit quickly to make a roll.',
      explanation: 'Holding a trig, [UP] and [DOWN] set its retrig rate; the trig editor sets the length and the velocity curve (manual p.39, p.41).',
      manualReference: REF('p.41'),
    },
    {
      kind: 'do', focus: ['seq:trig:16'], concept: 'velocity-dynamics',
      instruction: 'Long-press trig key 16 to open the trig editor, and set the retrig velocity curve to about +40.',
      check: s => (stepOf(s, SD, 15)?.retrig?.vel ?? 0) >= 30,
      solution: { data: P1_RISE },
      principle: 'A rising velocity makes a roll grow into the downbeat.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'velocity-dynamics',
      quiz: {
        question: 'You hold [RTRG] and press a pad harder. What changes?',
        options: ['The retrig rate', 'The retrig velocity: the roll gets louder', 'Nothing'], answer: 1,
        explain: 'During a live retrig, pad pressure sets the velocity (on this twin: slide your finger up the held pad). The rate comes from the RETRIG menu (manual p.41).',
      },
    },
    {
      kind: 'challenge', concept: 'sequencer-pattern',
      instruction: 'Perform an eight-bar build: kick muted for bars 1-3, fill and roll in bar 4, kick back on bar 5.',
      checklist: [
        { text: 'SD has a retrig trig', check: s => trigs(s, SD).some(i => !!stepOf(s, SD, i)?.retrig) },
        { text: 'A FILL trig is in the pattern', check: s => { const p = proj(s); return getPattern(p, p.active).tracks.some(t => Object.values(t.steps).some(x => x.cond === 'FILL')); } },
        { text: 'The kick is unmuted at the end', check: s => !(proj(s).mutes ?? []).includes(BD) },
      ],
      hints: ['Mute the kick before the phrase starts.', 'Hold FILL through bar 4; the roll is already on step 16.', 'Unmute exactly on the downbeat of bar 5.'],
      solution: { data: P1_RISE },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why do mutes and fills work best on phrase boundaries?',
        model: 'Listeners expect change every 4 or 8 bars, so changes there feel intentional; changes mid-phrase feel like mistakes.',
      },
    },
  ],
  review: [
    { question: 'MUTE-mode pads…', options: ['Mute or unmute each track\'s sequencer', 'Play louder', 'Select patterns'], answer: 0, explain: 'Sequencer mutes (manual p.23).' },
    { question: 'Retrig 1/16 means…', options: ['One hit per step', '16 hits per step', 'One hit per bar'], answer: 0, explain: 'The rate is a note value.' },
    { question: 'A retrig velocity curve of -128…', options: ['Fades the roll out completely', 'Fades it in', 'Retunes it'], answer: 0, explain: 'Negative values fade out (manual p.41).' },
  ],
};

/** Scene 1 of kit 02 with the kick out and the reverb up; performance macro 1 darker hats */
const P2_SCENE = (() => {
  const p = lessonData(DROP, '02', DROP_VALUES);
  const k = p.kits!['02'];
  const scenes = (k.scenes ?? []).map(x => ({ ...x }));
  scenes[0] = { bd_amp_vol: 0, fx_rev_vol: 127 };
  return { ...p, kits: { ...p.kits, '02': { ...k, scenes } } } as RytmProject;
})();
const P2_PERF = (() => {
  const k = P2_SCENE.kits!['02'];
  const perfs = (k.perfs ?? []).map(x => ({ ...x }));
  perfs[0] = { ch_flt_frq: -60 };
  return { ...P2_SCENE, kits: { ...P2_SCENE.kits, '02': { ...k, perfs } } } as RytmProject;
})();
const P2_BOTH = (() => {
  const k = P2_PERF.kits!['02'];
  const scenes = (k.scenes ?? []).map(x => ({ ...x }));
  const perfs = (k.perfs ?? []).map(x => ({ ...x }));
  scenes[1] = { bd_amp_vol: 0, fx_rev_vol: 127, fx_rev_dec: 110 };
  perfs[1] = { ch_flt_frq: -60, fx_del_fdb: 40 };
  return { ...P2_PERF, kits: { ...P2_PERF.kits, '02': { ...k, scenes, perfs } } } as RytmProject;
})();
const kitOf = (s: LessonCheckState) => { const p = proj(s); return p.kits?.[p.kit ?? '01']; };
const sceneHas = (s: LessonCheckState, test: (x: Record<string, number>) => boolean) => (kitOf(s)?.scenes ?? []).some(x => !!x && test(x));
const perfHas = (s: LessonCheckState, test: (x: Record<string, number>) => boolean) => (kitOf(s)?.perfs ?? []).some(x => !!x && test(x));

const p2: Lesson = {
  id: 'analog-rytm-p2-scenes-perf', device: 'analog-rytm', path: 'performance', order: O(2), difficulty: 'advanced',
  name: 'Scenes and performance macros',
  description: 'Build a scene for an instant breakdown, and a pressure-controlled performance macro for a build.',
  objective: 'Build a scene for an instant breakdown, and a pressure-controlled performance macro for a filter build.',
  source: 'Synth Studio · Rytm MKII manual, SCENE and PERFORMANCE modes (pp.23, 28-31)', estimatedMinutes: 10,
  prerequisites: ['analog-rytm-s6-dist-comp', 'analog-rytm-p1-mutes-fills-rolls'],
  concepts: ['modulation-depth', 'effects'],
  start: { reset: true, values: { ...DROP_VALUES, track: BD, page: PAGE.AMP, pad_mode: 0 }, data: lessonData(DROP, '02', DROP_VALUES) },
  steps: [
    {
      kind: 'info', focus: ['key:scne', 'key:perf'], concept: 'modulation-depth',
      instruction: 'A SCENE jumps to fixed values. A PERF macro pushes values by an amount, scaled by how hard you press.',
      principle: 'Stored snapshots and pressure-driven moves are two ways to perform with many settings at once.',
      explanation: 'Each kit has 12 scenes and 12 macros; each mode has 48 locks to share between them (manual pp.28-30).',
      manualReference: REF('pp.28-30'),
    },
    {
      kind: 'do', focus: ['key:scne', 'key:func', 'pad:bd'], concept: 'effects',
      instruction: 'Press [SCNE], then [FUNC] + pad 1 to edit scene 1. On BD\'s AMP page turn VOL to 0.',
      check: s => sceneHas(s, x => x.bd_amp_vol === 0),
      solution: { values: { pad_mode: 3 }, data: { ...P2_SCENE, kits: { ...P2_SCENE.kits, '02': { ...P2_SCENE.kits!['02'], scenes: P2_SCENE.kits!['02'].scenes!.map((x, i) => (i === 0 ? { bd_amp_vol: 0 } : x)) } } } },
      principle: 'A scene is a snapshot of settings switched on together.',
    },
    {
      kind: 'do', focus: ['key:fx', 'key:smpl'], concept: 'effects',
      instruction: 'Press [FX], then [SMPL] for REVERB, and turn VOL (H) up to about 127. Press [SCNE] to finish.',
      check: s => sceneHas(s, x => x.bd_amp_vol === 0 && (x.fx_rev_vol ?? 0) >= 120),
      solution: { data: P2_SCENE },
      principle: 'One scene can change many parameters at once, across tracks.',
    },
    {
      kind: 'predict', event: 'scene', focus: ['pads'], concept: 'effects',
      instruction: 'Press [PLAY]. In SCENE mode tap pad 1 while the pattern plays, then tap it again.',
      check: s => presses(s, 'scene') >= 2,
      solution: { values: { pad_mode: 3, play: true }, presses: ['scene', 'scene'] },
      predict: {
        question: 'What happens to the kick?',
        options: ['It fades out over a bar', 'It drops to silence at once, and comes back when the scene is off', 'It is deleted from the pattern', 'Nothing until the next pattern'], answer: 1,
        explain: 'A scene applies its values instantly while it is on, and the kit underneath is untouched. A fade needs a macro or an LFO, and nothing is deleted.',
      },
      principle: 'Switching between stored values gives instant, repeatable changes.',
    },
    {
      kind: 'do', focus: ['key:perf', 'pad:ch'], concept: 'modulation-depth',
      instruction: 'Hold [PERF] to edit macro 1. Select CH ([TRK] + CH), and on its FLTR page turn FRQ down about 60.',
      check: s => perfHas(s, x => (x.ch_flt_frq ?? 0) <= -40),
      solution: { data: P2_PERF },
      principle: 'A macro\'s depth follows pad pressure, for hands-on moves.',
      explanation: 'A macro lock is an offset: light pressure adds a little of it, full pressure all of it (manual p.30). On this twin, press higher on the pad for more.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'modulation-depth',
      quiz: {
        question: 'Scene versus performance macro?',
        options: ['They are the same', 'A scene jumps to fixed values; a macro offsets values by pressure', 'Scenes only affect samples'], answer: 1,
        explain: 'Scenes are on or off. Macros are continuous, from nothing to the full depth.',
      },
    },
    {
      kind: 'challenge', concept: 'effects',
      instruction: 'Make a breakdown scene (no kick, big reverb) and a tension macro (darker hats, more delay feedback).',
      checklist: [
        { text: 'A scene with BD VOL 10 or less and the reverb raised', check: s => sceneHas(s, x => (x.bd_amp_vol ?? 127) <= 10 && ((x.fx_rev_vol ?? 0) >= 120 || (x.fx_rev_dec ?? 0) >= 100)) },
        { text: 'A macro with two or more parameters, one of them more DELAY FDB', check: s => perfHas(s, x => Object.keys(x).length >= 2 && (x.fx_del_fdb ?? 0) > 0) },
      ],
      hints: ['Scene: [FUNC] + pad to edit it, then turn encoders.', 'Macro: hold [PERF] to edit, then turn encoders by an amount.', 'Try DELAY FDB +40 and CH FRQ -60.'],
      solution: { data: P2_BOTH },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'When would you use a scene rather than a performance macro?',
        model: 'A scene for an instant, repeatable change such as a breakdown; a macro for a gradual, expressive move controlled by pressure.',
      },
    },
  ],
  review: [
    { question: 'Scenes per kit:', options: ['12', '4', '64'], answer: 0, explain: 'One per pad (manual p.28).' },
    { question: 'A macro\'s depth follows…', options: ['Pad pressure', 'Tempo', 'Swing'], answer: 0, explain: 'Pressure (manual p.30).' },
    { question: 'Which knob drives macros outside PERF mode?', options: ['QUICK PERF AMOUNT', 'MAIN VOLUME', 'DATA ENTRY A'], answer: 0, explain: 'Choose its macros with [QPER] + pads (manual pp.30-31).' },
  ],
};

// ============================================================================
// STUDIO
// ============================================================================

const instanceOf = (s: LessonCheckState, device: string) => Object.entries(s.instances).find(([, i]) => i.device === device)?.[0];

const t1: Lesson = {
  id: 'analog-rytm-t1-sync-tempo', device: 'analog-rytm', path: 'studio', order: 6, difficulty: 'intermediate',
  name: 'The Rytm in the studio: one clock, one tempo',
  description: 'Lock the Rytm and the Analog Four to the studio clock, play them together and move the tempo for both.',
  objective: 'Lock the Rytm and the Analog Four to the studio clock and change their tempo together.',
  source: 'Synth Studio · Rytm MKII manual, MIDI SYNC and the TEMPO menu (pp.38, 61-62)', estimatedMinutes: 7,
  requires: ['analog-four'],
  prerequisites: ['analog-rytm-q1-rhythm-basics'],
  concepts: ['timing-tempo', 'signal-routing'],
  start: { reset: true, values: { track: BD }, data: lessonData(GROOVE) },
  steps: [
    {
      kind: 'info', concept: 'timing-tempo',
      instruction: 'In a studio one clock leads. MIDI clock sends 24 ticks every beat, plus start and stop.',
      principle: 'Followers lock to one leader, so their steps line up.',
      explanation: 'On the hardware this is CLOCK RECEIVE and TRANSPORT RECEIVE in the MIDI SYNC menu (manual p.61).',
      manualReference: REF('p.61'),
    },
    {
      kind: 'do', concept: 'timing-tempo',
      instruction: 'In the Studio tab, make sure "Sync to studio clock" is ticked for the Analog Rytm and the Analog Four.',
      check: s => ['analog-rytm', 'analog-four'].every(d => { const id = instanceOf(s, d); return !!id && s.sync[id] !== false; }),
      principle: 'A synced instrument ignores its own tempo and follows the leader.',
    },
    {
      kind: 'predict', concept: 'timing-tempo',
      instruction: 'Press ▶ in the top bar.',
      check: s => s.transport.playing,
      solution: { transport: 'play' },
      predict: {
        question: 'Both are synced. What happens when you change the studio tempo while they play?',
        options: ['Only the Rytm changes', 'Both follow it at once', 'The Rytm keeps its own TEMPO and drifts', 'Both stop'], answer: 1,
        explain: 'Synced instruments follow the leader, so a tempo change reaches both at once. The Rytm\'s own TEMPO is ignored while it follows.',
      },
      principle: 'One tempo source keeps every sequencer aligned.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'The real Rytm can send DIN 24 from its MIDI OUT port. What is that for?',
        options: ['Audio', 'Syncing vintage gear that uses DIN sync pulses', 'Program changes'], answer: 1,
        explain: 'The OUT and THRU ports can send MIDI, DIN 24 or DIN 48. On the DIN settings the port sends sync pulses instead of MIDI data (manual p.62).',
      },
    },
    {
      kind: 'challenge', concept: 'timing-tempo',
      instruction: 'Get both machines playing together from the top, then move the studio tempo and hear both follow.',
      checklist: [
        { text: 'Both instruments follow the studio clock', check: s => ['analog-rytm', 'analog-four'].every(d => { const id = instanceOf(s, d); return !!id && s.sync[id] !== false; }) },
        { text: 'The transport is playing', check: s => s.transport.playing },
      ],
      hints: ['Sync first: the Studio tab.', 'Press ▶ in the top bar once: both start on the same downbeat.', 'Then drag the tempo in the top bar: both change together.'],
      solution: { transport: 'play' },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does only one device lead the clock?',
        model: 'Two leaders drift apart; one clock with everything following keeps every step aligned.',
      },
    },
  ],
  review: [
    { question: 'MIDI clock ticks per quarter note:', options: ['24', '4', '96'], answer: 0, explain: '24 PPQN.' },
    { question: 'While synced, the Rytm\'s tempo…', options: ['Follows the studio', 'Leads', 'Is random'], answer: 0, explain: 'It follows.' },
    { question: 'Which Rytm setting makes it follow an external clock?', options: ['CLOCK RECEIVE', 'CLOCK SEND', 'PRG CH SEND'], answer: 0, explain: 'In MIDI SYNC (manual p.61).' },
  ],
};

const T2_START = (() => {
  const base = defaultProject();
  const groove = base.patterns.A07;
  const noKick = { ...groove, tracks: groove.tracks.map((t, i) => (i === BD ? { ...t, steps: {} } : t)) };
  return {
    ...base, active: 'A01', mode: 'pattern' as const, kit: '02',
    patterns: { ...base.patterns, A01: { ...groove, kit: '02' }, A02: { ...noKick, kit: '02' }, A03: { ...base.patterns.A03, kit: '01' } },
    chain: [],
  } as RytmProject;
})();
const T2_CHAIN = setChain(T2_START, ['A01', 'A02', 'A03']) as RytmProject;
const T2_SONG: RytmProject = {
  ...T2_CHAIN, mode: 'song',
  song: { ...T2_CHAIN.song, rows: [{ pattern: 'A01', repeats: 4 }, { pattern: 'A02', repeats: 2 }, { pattern: 'A03', repeats: 4 }, { pattern: 'A02', repeats: 2 }] },
};

const t2: Lesson = {
  id: 'analog-rytm-t2-chains-songs-arrange', device: 'analog-rytm', path: 'studio', order: 7, difficulty: 'advanced',
  name: 'From patterns to a song',
  description: 'Turn three patterns into an arrangement with a chain, a song and the studio arranger.',
  objective: 'Turn three Rytm patterns into a 32-bar arrangement with a chain, a song and the studio arranger.',
  source: 'Synth Studio · Rytm MKII manual, pattern modes, chains and songs (pp.38, 53-55)', estimatedMinutes: 12,
  prerequisites: ['analog-rytm-t1-sync-tempo', 'analog-rytm-q4-trig-conditions'],
  concepts: ['sequencer-pattern', 'mixing'],
  start: { reset: true, values: { ...DROP_VALUES, track: BD }, data: T2_START },
  steps: [
    {
      kind: 'info', concept: 'sequencer-pattern', focus: ['key:chain', 'key:song'],
      instruction: 'A pattern is a loop; a song is loops in order. Chains play patterns in sequence; SONG mode adds repeats and mutes.',
      principle: 'Arranging is deciding what changes, and when.',
      explanation: 'A01 is the drop groove, A02 the same without the kick, A03 a different groove.',
    },
    {
      kind: 'do', focus: ['key:bank:A', 'key:chain', 'seq:menu:chain'], concept: 'sequencer-pattern',
      instruction: 'Make the chain A01, A02, A03: [FUNC] + [CHAIN MODE] opens the chain builder.',
      check: s => proj(s).chain.join() === 'A01,A02,A03',
      solution: { data: T2_CHAIN },
      principle: 'Chaining patterns turns loops into sections that follow each other.',
      explanation: 'On the hardware, quick mode is [BANK] and then the trig keys, holding the first (manual p.53).',
      manualReference: REF('p.53'),
    },
    {
      kind: 'predict', focus: ['key:chain', 'key:play'], concept: 'sequencer-pattern',
      instruction: 'Press [CHAIN MODE], then [PLAY].',
      check: s => proj(s).mode === 'chain' && playing(s),
      solution: { values: { play: true }, data: { ...T2_CHAIN, mode: 'chain' } },
      predict: {
        question: 'When does the Rytm move from A01 to A02?',
        options: ['Immediately', 'At the end of A01 (SEQUENTIAL change)', 'After 16 bars', 'Only when you tap a pad'], answer: 1,
        explain: 'SEQUENTIAL is the default pattern mode: it waits for the playing pattern to finish, so phrases stay whole (manual p.38).',
      },
      principle: 'Changing at pattern ends keeps phrases complete.',
    },
    {
      kind: 'do', focus: ['key:song', 'seq:menu:song'], concept: 'sequencer-pattern',
      instruction: 'Open the song editor ([FUNC] + [SONG]). Make rows A01, A02, A03, A02 with repeats 4, 2, 4, 2.',
      check: s => { const r = proj(s).song.rows; return r.length >= 4 && r.slice(0, 4).map(x => `${x.pattern}x${x.repeats}`).join() === 'A01x4,A02x2,A03x4,A02x2'; },
      solution: { data: T2_SONG },
      principle: 'Repeats stretch a loop into a section of the right length.',
      manualReference: REF('p.54'),
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'sequencer-pattern',
      quiz: {
        question: 'What does DIRECT JUMP do?',
        options: ['Waits for the end', 'Changes pattern at once, carrying on from the same position', 'Stops the sequencer'], answer: 1,
        explain: 'DIRECT START restarts the new pattern from step 1; DIRECT JUMP keeps the position (manual p.38).',
      },
    },
    {
      kind: 'challenge', concept: 'mixing',
      instruction: 'In the Studio tab, build a 32-bar track in the arranger: an intro without the kick, a build, a drop and a breakdown.',
      checklist: [
        { text: 'Sections add up to 32 bars', check: s => s.arrangement.sections.reduce((n, x) => n + x.bars, 0) === 32 },
        { text: 'One section has the Rytm muted, or plays A02', check: s => s.arrangement.sections.some(x => Object.values(x.parts).some(p => p.muted || p.pattern === 'A02')) },
        { text: 'Three or more sections', check: s => s.arrangement.sections.length >= 3 },
      ],
      hints: ['Use phrases of 8 bars.', 'Use A02 for the intro and the breakdown.', 'Intro 8 (A02), build 8 (A01), drop 8 (A03), break 8 (A02).'],
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why do arrangements change on 4-, 8- or 16-bar boundaries?',
        model: 'Music is heard in phrases, so changes at phrase boundaries feel natural and intentional.',
      },
    },
  ],
  review: [
    { question: 'SEQUENTIAL switches…', options: ['At the end of the pattern', 'Immediately', 'Randomly'], answer: 0, explain: 'It waits for the end (manual p.38).' },
    { question: 'A song row\'s repeats are set with…', options: ['DATA ENTRY A on the row', 'TRACK LEVEL', '[PAGE]'], answer: 0, explain: 'Manual p.54; on this twin, the REPEAT field of the row.' },
    { question: 'TEMP JUMP…', options: ['Plays another pattern once, then returns', 'Deletes a pattern', 'Is a sound lock'], answer: 0, explain: 'A temporary jump (manual p.39).' },
  ],
};

export const ANALOG_RYTM_LESSONS: Lesson[] = [f1, f2, s1, s2, s3, s4, s5, s6, e1, e2, e3, e4, q1, q2, q3, q4, p1, p2, t1, t2];

