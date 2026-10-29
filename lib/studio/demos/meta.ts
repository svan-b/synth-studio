// ============================================================================
// Demo tracks - what each one is, its song sections and their teaching notes.
//
// Pure data with no instrument imports, so the studio can list the demos and
// caption a playing one without loading any instrument code. The builders
// (lowTideLights.ts, threeClocks.ts, copperWire.ts) load on demand and use
// these section ids, names and lengths for their arrangements.
//
// Source: docs/research/producer-path/demo-tracks.md. All three tracks are
// original compositions written for Synth Studio.
// ============================================================================

export interface DemoSection {
  /** Stable id (kept in the saved arrangement, so a saved demo keeps its captions) */
  id: string;
  name: string;
  bars: number;
  color: string;
  /** What the section teaches (the design's teaching note) */
  note: string;
}

export interface DemoMeta {
  id: 'low-tide-lights' | 'three-clocks' | 'copper-wire';
  title: string;
  /** One line: what it is */
  description: string;
  style: string;
  bpm: number;
  key: string;
  /** Device ids of the instruments it plays (the studio clock and the mixer included) */
  instruments: string[];
  /** Master targets */
  target: { lufs: number; truePeak: number };
  sections: DemoSection[];
  accent: string;
  /** One thing about how the studio is set up, shown while the demo is loaded and stopped */
  tip?: string;
}

const C = { intro: '#38bdf8', groove: '#a78bfa', drop: '#f97316', brk: '#22c55e', build: '#eab308', peak: '#f43f5e', outro: '#14b8a6' };

export const DEMOS: DemoMeta[] = [
  {
    id: 'low-tide-lights',
    title: 'Low Tide Lights',
    description: 'Deep, melodic techno-house: swung drums, minor-seventh chord stabs, a rolling bass and a hook through a dotted-8th delay.',
    style: 'Deep techno-house',
    bpm: 124,
    key: 'A minor',
    instruments: ['analog-rytm', 'analog-four', 'xone96', 'studio-clock'],
    target: { lufs: -10.5, truePeak: -1 },
    accent: '#f97316',
    tip: 'Swing lives in the patterns (54 % on both Elektrons), not on the studio clock, so both machines swing the same amount from the same place.',
    sections: [
      { id: 'ltl-intro', name: 'INTRO', bars: 8, color: C.intro, note: 'DJ-friendly: 8 bars of drums let a DJ (or a listener) lock onto the tempo. The rim\'s 1:2 condition turns a 1-bar loop into a 2-bar phrase.' },
      { id: 'ltl-groove', name: 'GROOVE', bars: 8, color: C.groove, note: 'The bass enters behind a low-pass filter (Xone FILTER 2 on channel 2), so it is felt before it is heard: adding a part doesn\'t have to mean adding brightness.' },
      { id: 'ltl-drop1', name: 'DROP 1', bars: 16, color: C.drop, note: 'Two things arrive on the same downbeat: the open filter and the chords. Changes that land together hit harder than changes spread out.' },
      { id: 'ltl-break', name: 'BREAK', bars: 8, color: C.brk, note: 'Kick and bass leave, which resets the ear. The stab tracks become a slow pad through parameter locks, and avoid the home chord Am7: the harmony itself creates tension.' },
      { id: 'ltl-build-a', name: 'BUILD A', bars: 4, color: C.build, note: 'A bass pedal on E, the fifth, wants to resolve to A. The bass brightens one filter step per bar: tension rises without new notes.' },
      { id: 'ltl-build-b', name: 'BUILD B', bars: 4, color: C.build, note: 'Four tension signals at once: a denser, higher, thinner snare roll; a noise riser on a parameter slide; the drums high-passed on the Xone; a last bar without a kick.' },
      { id: 'ltl-drop2', name: 'DROP 2', bars: 16, color: C.peak, note: 'The release: kick, bass, the home chord and the full hook return on beat 1, and the ride adds one new element, so this drop is the peak.' },
      { id: 'ltl-outro-a', name: 'OUTRO A', bars: 8, color: C.outro, note: 'Parts leave in reverse order of importance: the hook, then the chords. The stabs\' 1:2 condition stops them half-way through the section without a new pattern.' },
      { id: 'ltl-outro-b', name: 'OUTRO B', bars: 8, color: C.intro, note: 'Mirrors the intro, so the track can be mixed out of as easily as into.' },
    ],
  },
  {
    id: 'three-clocks',
    title: 'Three Clocks',
    description: 'A hypnotic polyrhythmic jam: loops of 2, 3 and 4 beats on one 16th-note clock, all in D minor pentatonic.',
    style: 'Polyrhythmic Moog jam',
    bpm: 110,
    key: 'D minor pentatonic',
    instruments: ['dfam', 'mother32', 'subharmonicon', 'xone96', 'studio-clock'],
    target: { lufs: -13, truePeak: -1 },
    accent: '#38bdf8',
    tip: 'The DFAM has no reset: before ▶ it must sit on step 8 (press ADVANCE), so the first clock pulse plays step 1. The demo parks it for you on load and after every stop.',
    sections: [
      { id: 'tc-clockwork', name: 'CLOCKWORK', bars: 8, color: C.intro, note: 'A polyrhythm alone: SEQ 1 steps every beat, SEQ 2 every three 16ths, and the envelopes fire on both. Listen for the pattern that repeats every 3 beats inside a 4-beat bar.' },
      { id: 'tc-pulse', name: 'PULSE', bars: 8, color: C.groove, note: 'An anchor makes a polyrhythm readable: the DFAM\'s kick on every beat tells the ear where the bar is, so the 3-step cycle now sounds like syncopation, not confusion.' },
      { id: 'tc-low-end', name: 'LOW END', bars: 16, color: C.drop, note: 'Polymeter: a 12-step bass over a 16-step bar starts on beat 1, then beat 4, beat 3, beat 2, and realigns after three bars. Every note comes from one pentatonic scale.' },
      { id: 'tc-lift', name: 'LIFT', bars: 8, color: C.build, note: 'Energy without new notes: noise and FM on the DFAM, more filter movement on the bass, a brighter, more resonant Subharmonicon. Timbre is an arrangement tool.' },
      { id: 'tc-undertow', name: 'UNDERTOW', bars: 8, color: C.brk, note: 'EG HELD turns the sequencers into a slowly changing chord, and RHYTHM 3 ÷5 joins SEQ 1, so the harmony moves on a new, irregular clock. A break without silence.' },
      { id: 'tc-return', name: 'RETURN', bars: 16, color: C.peak, note: 'Everything back, with the ÷5 rhythm kept: the peak is familiar but not identical - the difference between a return and a repeat.' },
      { id: 'tc-drift', name: 'DRIFT', bars: 8, color: C.outro, note: 'Fade by subtraction: the bass leaves, the kick shortens and the filter closes.' },
    ],
  },
  {
    id: 'copper-wire',
    title: 'Copper Wire',
    description: 'Electro breaks: a broken, dead-straight beat, a Moog bassline in the gaps the kick leaves, laser zaps and tuned toms.',
    style: 'Electro breaks',
    bpm: 122,
    key: 'G minor',
    instruments: ['analog-rytm', 'sub37', 'xone96'],
    target: { lufs: -11, truePeak: -1 },
    accent: '#22c55e',
    tip: 'The Sub 37\'s two presets are arranger snapshots: each section\'s snapshot carries the whole sound and its sequence, as the hardware stores a sequence with every preset.',
    sections: [
      { id: 'cw-intro', name: 'INTRO', bars: 8, color: C.intro, note: 'A broken beat can still be DJ-friendly: the kick pattern repeats every two bars, so the phrase is easy to count. Straight timing is a style choice.' },
      { id: 'cw-verse1', name: 'VERSE 1', bars: 16, color: C.groove, note: 'Kick and bass interlock: every bass note sits on a step the kick leaves free, so a busy bassline and a busy kick never collide. The filter starts slightly closed, leaving room for Verse 2.' },
      { id: 'cw-break', name: 'BREAK', bars: 8, color: C.brk, note: 'The Rytm becomes melodic: toms tuned to G and D, zaps pitched with NOTE locks. A preset change swaps the bassline for a sustained 8th-note wobble.' },
      { id: 'cw-verse2', name: 'VERSE 2', bars: 16, color: C.drop, note: 'The same bassline, brighter (more CUTOFF and EG AMT): a sound-design change reads as a new section.' },
      { id: 'cw-breakdown', name: 'BREAKDOWN', bars: 8, color: C.build, note: 'Space as rhythm: the zaps\' delay echoes and a reverb-locked clap carry the groove while the drums are low-passed on the Xone.' },
      { id: 'cw-final', name: 'FINAL', bars: 16, color: C.peak, note: 'The peak: a tom roll every 8 bars from [4:4] conditions, more drive on the bass, and the drums opened up again by a snapshot.' },
      { id: 'cw-outro', name: 'OUTRO', bars: 8, color: C.outro, note: 'Bass out on a bar line, drums back to the intro pattern for mixing out.' },
    ],
  },
];

export const DEMO_BY_ID: Record<string, DemoMeta> = Object.fromEntries(DEMOS.map(d => [d.id, d]));

/** Section id -> its demo and section (for the captions) */
export const DEMO_SECTION: Record<string, { demo: DemoMeta; section: DemoSection; index: number }> = Object.fromEntries(
  DEMOS.flatMap(d => d.sections.map((s, index) => [s.id, { demo: d, section: s, index }])),
);

/** Length of a demo in bars */
export const demoBars = (d: DemoMeta) => d.sections.reduce((n, s) => n + s.bars, 0);

/** Length of a demo in seconds (without the tail) */
export const demoSeconds = (d: DemoMeta) => (demoBars(d) * 4 * 60) / d.bpm;
