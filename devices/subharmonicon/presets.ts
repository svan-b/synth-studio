// ============================================================================
// Subharmonicon presets, named "Category / Name" (the preset menu groups by
// category). Recreated from Moog's own patch sheets; the names are ours and
// Moog's titles appear only in the descriptions (docs/research/COPYRIGHT-RULES.md).
//
//  - Owner's Manual (printed pp.45-49): ten patch sheets.
//  - Exploration Patchbook (printed pp.1-10): ten patch sheets.
//  - Patching with Intention (pp.3-10): the initialized patch and its exercises.
//  - Owner's Manual tour (pp.12-16), and a few teaching patches of our own.
//
// Knob positions were read off the sheets (docs/research/subharmonicon/presets.md
// describes how, and how accurate it is) and converted to the twin's units with
// its tapers: TEMPO linear (12 o'clock = 1510 BPM), CUTOFF and the EG times log,
// VCO FREQ in octaves and snapped to the sheet's QUANTIZE scale. Every preset
// lists every setting, so nothing depends on the spec defaults except "Init".
// VOLUME is calibrated per preset to the studio's -18 LUFS reference (the
// sheets draw it near maximum or "to taste"); REFERENCE.md lists the rest.
// ============================================================================

import type { PatchConnection, PresetSpec } from '@/types';

type Values = Record<string, number | boolean>;

/** Divisor n (1..16) -> stored knob value */
const D = (n: number) => -n;
// WAVE: 0 UP (square), 1 MIDDLE (pulse + saw subs), 2 DOWN (saw)
const UP = 0, MID = 1, DOWN = 2;
// SEQ OCT index: 0 = ±1, 1 = ±2, 2 = ±5; QUANTIZE index: 0 off, 1 12-ET, 2 8-ET, 3 12-JI, 4 8-JI
const OCT1 = 0, OCT2 = 1, OCT5 = 2;
const Q_OFF = 0, Q_12ET = 1, Q_8ET = 2, Q_12JI = 3, Q_8JI = 4;
const EG_OFF = 0, EG_ON = 1, EG_HELD = 2;

interface Osc { freq: number; sub1: number; sub2: number; wave: number; levels: [number, number, number] }
interface Sheet {
  vco1: Osc;
  vco2: Osc;
  /** CUTOFF Hz, RESONANCE %, VCF EG AMT % */
  vcf: [number, number, number];
  /** VCF ATTACK, VCF DECAY, VCA ATTACK, VCA DECAY (ms) */
  eg: [number, number, number, number];
  volume: number;
  seqOct: number;
  quantize: number;
  /** SEQ 1 ASSIGN and SEQ 2 ASSIGN: [OSC, SUB 1, SUB 2] */
  assign1: [boolean, boolean, boolean];
  assign2: [boolean, boolean, boolean];
  steps1: [number, number, number, number];
  steps2: [number, number, number, number];
  /** RHYTHM 1-4: [divisor, to SEQ 1, to SEQ 2] */
  rhythm: [number, boolean, boolean][];
  tempo: number;
  logic?: number;
  eg_mode: number;
  /** SEQ OCT / QUANTIZE held modes (SEQ jacks at ±5 V / unquantized) */
  held?: [boolean, boolean];
}

function values(s: Sheet): Values {
  const v: Values = {
    vco1_freq: s.vco1.freq, vco1_sub1_freq: D(s.vco1.sub1), vco1_sub2_freq: D(s.vco1.sub2), vco1_wave: s.vco1.wave,
    vco2_freq: s.vco2.freq, vco2_sub1_freq: D(s.vco2.sub1), vco2_sub2_freq: D(s.vco2.sub2), vco2_wave: s.vco2.wave,
    vco1_level: s.vco1.levels[0], vco1_sub1_level: s.vco1.levels[1], vco1_sub2_level: s.vco1.levels[2],
    vco2_level: s.vco2.levels[0], vco2_sub1_level: s.vco2.levels[1], vco2_sub2_level: s.vco2.levels[2],
    cutoff: s.vcf[0], resonance: s.vcf[1], vcf_eg_amt: s.vcf[2],
    vcf_attack: s.eg[0], vcf_decay: s.eg[1], vca_attack: s.eg[2], vca_decay: s.eg[3],
    volume: s.volume,
    seq_oct: s.seqOct, quantize: s.quantize,
    seq_oct_held: s.held?.[0] ?? false, quantize_held: s.held?.[1] ?? false,
    seq1_osc: s.assign1[0], seq1_sub1: s.assign1[1], seq1_sub2: s.assign1[2],
    seq2_osc: s.assign2[0], seq2_sub1: s.assign2[1], seq2_sub2: s.assign2[2],
    tempo: s.tempo, rhythm_logic: s.logic ?? 0, eg_mode: s.eg_mode,
  };
  s.steps1.forEach((x, i) => { v[`seq1_step${i + 1}`] = x; });
  s.steps2.forEach((x, i) => { v[`seq2_step${i + 1}`] = x; });
  s.rhythm.forEach(([d, a, b], i) => {
    v[`rhythm${i + 1}`] = D(d);
    v[`rhythm${i + 1}_seq1`] = a;
    v[`rhythm${i + 1}_seq2`] = b;
  });
  return v;
}

const cable = (from: string, to: string): PatchConnection => ({ from, to });
function preset(name: string, description: string, source: PresetSpec['source'], s: Sheet, cables: PatchConnection[] = []): PresetSpec {
  return { name, description, source, settings: values(s), ...(cables.length ? { patchConnections: cables } : {}) };
}

// Pitches (Hz) the sheets' FREQ knobs snap to
const C4 = 261.63, C5 = 523.25, F5 = 698.46, C6 = 1046.5, C7 = 2093.0, C8 = 4186.0;
const off: [number, boolean, boolean] = [1, false, false];
const NONE: [boolean, boolean, boolean] = [false, false, false];
const OSC: [boolean, boolean, boolean] = [true, false, false];

// Moog's initialized patch (Patching with Intention p.3): every knob at its starting point
const INIT: Sheet = {
  vco1: { freq: C6, sub1: 1, sub2: 1, wave: UP, levels: [50, 0, 0] },
  vco2: { freq: C6, sub1: 1, sub2: 1, wave: UP, levels: [0, 0, 0] },
  vcf: [5024, 0, 60], eg: [1, 31, 1, 31], volume: 50,
  seqOct: OCT5, quantize: Q_OFF, assign1: NONE, assign2: NONE,
  steps1: [0, 0, 0, 0], steps2: [0, 0, 0, 0],
  rhythm: [off, off, off, off], tempo: 1510, eg_mode: EG_ON,
};
/** The initialized patch values, for lesson start states */
export const INITIALIZED_PATCH: Values = values(INIT);

const PWI_FIRST: Sheet = {
  ...INIT,
  seqOct: OCT1, quantize: Q_12ET, assign1: OSC,
  steps1: [0, 25, 58, 42],
  rhythm: [[1, true, false], [1, false, true], off, off], tempo: 616,
};

export const SUBHARMONICON_PRESETS: Record<string, PresetSpec> = {
  // ------------------------------------------------------------- starting points
  init: {
    name: 'Init / Default patch',
    description: 'The twin\'s playable starting point (the Reset button): VCO 1 on Middle C with SUB 1 an octave and SUB 2 two octaves down, VCO 2 a fifth up, Rhythm 1 (÷4) on Sequencer 1 against Rhythm 2 (÷3) on Sequencer 2 - four notes against three. Press PLAY.',
    source: 'factory',
    settings: {},
  },
  pwi_init: preset('Drone / Initialized patch (EG held)',
    'Moog\'s initialized patch from Patching with Intention (p.3): VCO 1 alone at C6, square wave, every divider at ÷1, nothing assigned to the sequencers or rhythms. EG is held (blinking) so VCO 1 sounds at once, the way the Owner\'s Manual tour starts (p.12). Press EG once to light it, then assign a rhythm to hear a sequence.',
    'manual', { ...INIT, eg_mode: EG_HELD, volume: 32.1 }),

  // ------------------------------------------------------------- Patching with Intention exercises
  pwi_first: preset('Tutorial / First sequence',
    'Patching with Intention, "First Steps" (p.4): Rhythm 1 lit for Sequencer 1, Rhythm 2 for Sequencer 2, TEMPO near 9 o\'clock, SEQ OCT down to ±1 and QUANTIZE on 12-ET. The guide first patches SEQ 1 into VCO 1, then lights OSC 1 instead, which does the same inside. Step values are ours (C, E♭, G, F).',
    'manual', { ...PWI_FIRST, volume: 99.1 }),
  pwi_intertwine: preset('Tutorial / Sequencer transposes sequencer',
    'Patching with Intention, "Intertwining" (p.5): SEQ 2 patched into VCO 1 while OSC 1 stays lit, so the two sequencers add. Rhythm 1 at ÷1 and Rhythm 2 at ÷16: Sequencer 1 plays its phrase four times, then Sequencer 2 moves and transposes it - two 4-step sequencers make a 16-step line. Step values are ours.',
    'manual', { ...PWI_FIRST, volume: 100, steps2: [0, -42, -17, 17], rhythm: [[1, true, false], [16, false, true], off, off] },
    [cable('out_seq2', 'in_vco1')]),
  pwi_rhythm: preset('Tutorial / Sequenced filter drums',
    'Patching with Intention, "From Melody to Rhythm" (p.6): the SEQ 2 cable moves from VCO 1 to CUTOFF. CUTOFF down near 9 o\'clock and RESONANCE up until the filter rings on its own, with a short VCF DECAY: every step becomes a tuned, percussive hit, a drum machine more than a melody. Resonance, decay and step values are ours.',
    'manual', {
      ...PWI_FIRST, vcf: [80, 90, 60], eg: [1, 40, 1, 120], volume: 98.6,
      steps2: [100, -50, 60, -100], rhythm: [[1, true, false], [16, false, true], off, off],
    }, [cable('out_seq2', 'in_cutoff')]),
  pwi_drums: preset('Tutorial / Sub-modulated drum machine',
    'Patching with Intention, "Intermingled Drum Machine" (p.7): the drum patch plus VCO 1 SUB 1 into RHYTHM 2 (its knob near the middle) and VCO 1 SUB 2 into RHYTHM 1. The subharmonics act like LFOs on the rhythm generators, so the SUB FREQ knobs now reshape the groove. Divisor values are ours.',
    'manual', {
      ...PWI_FIRST, vco1: { ...INIT.vco1, sub1: 12, sub2: 16 }, vcf: [80, 90, 60], eg: [1, 40, 1, 120], volume: 100,
      steps2: [100, -50, 60, -100], rhythm: [[1, true, false], [8, false, true], off, off],
    }, [cable('out_seq2', 'in_cutoff'), cable('out_vco1_sub1', 'in_rhythm2'), cable('out_vco1_sub2', 'in_rhythm1')]),
  pwi_envclock: preset('Tutorial / Envelope-accelerated clock',
    'Patching with Intention, "Fun with Envelopes" (pp.8-10): VCO 2 SUB 1, both knobs fully down (about 16 Hz), becomes the master clock through CLOCK IN. The VCF envelope patched into VCO 2 SUB raises that sub\'s frequency on every note, so the clock speeds up and relaxes; VCO 2 SUB 2 into PLAY stops and starts it. 8-ET keeps it diatonic. Step values are ours.',
    'manual', {
      ...INIT,
      vco2: { freq: C4, sub1: 16, sub2: 9, wave: UP, levels: [0, 0, 0] },
      eg: [100, 5, 1, 31], volume: 89.7, quantize: Q_8ET, assign1: OSC,
      steps1: [0, 12, 17, 5],
      rhythm: [[8, true, false], [1, false, true], off, off], tempo: 616,
    }, [cable('out_vco2_sub1', 'in_clock'), cable('out_vcf_eg', 'in_vco2_sub'), cable('out_vco2_sub2', 'in_play')]),
  man_tutorial: preset('Tutorial / First polyrhythm',
    'The Owner\'s Manual tour (pp.12-16) as one patch: VCO 1 at half level with SUB 1 an octave down, OSC 1 and Rhythm 1 lit, SEQ OCT ±2, QUANTIZE 12-ET - and Rhythm 2 added to Sequencer 1, which makes the polyrhythm (÷4 merged with ÷3). Step and divisor values are ours.',
    'manual', {
      ...INIT,
      vco1: { freq: C6, sub1: 2, sub2: 1, wave: UP, levels: [50, 40, 0] },
      vcf: [5024, 0, 30], volume: 100, seqOct: OCT2, quantize: Q_12ET, assign1: OSC,
      steps1: [0, 12.5, 29, 42],
      rhythm: [[4, true, false], [3, true, false], off, off], tempo: 616,
    }),

  // ------------------------------------------------------------- Owner's Manual patch sheets (pp.45-49)
  man_aquatic: preset('Chords / Bubbling sub chords',
    'Based on the Owner\'s Manual sheet "Aquatic Chords" (p.45). EG is off and CLOCK OUT is patched into TRIGGER IN, so every master pulse plucks both envelopes while the two sequencers (÷4 and ÷5) change the sub-rich chords underneath; SEQ 1 also moves the cutoff. The sheet calls its sequencer pitches suggestions. With EG off, a key held while stopped is a gate: the full chord sounds at full VOLUME until you let go.',
    'manual', {
      vco1: { freq: 1567.98, sub1: 5, sub2: 4, wave: DOWN, levels: [44, 53, 54] },
      vco2: { freq: C6, sub1: 9, sub2: 3, wave: UP, levels: [55, 47, 50] },
      vcf: [159, 25, 49], eg: [20.9, 19.6, 1, 66.3], volume: 100,
      seqOct: OCT1, quantize: Q_8ET, assign1: OSC, assign2: OSC,
      steps1: [-34, 19, -53, 0], steps2: [-40, -100, -74, -41],
      rhythm: [[4, true, false], [5, false, true], off, off], tempo: 407, eg_mode: EG_OFF,
    }, [cable('out_seq1', 'in_cutoff'), cable('out_clock', 'in_trigger')]),
  man_mellow: preset('Arp / Hand-faded harmony arp',
    'Based on the Owner\'s Manual sheet "Mellow Harmonies" (p.45). EG is off and SEQ 1 CLK fires the envelopes, so only Sequencer 1\'s moves pluck: a steady arpeggio at ÷1 while Sequencer 2 (÷8) shifts VCO 2 slowly. The sheet marks all four SUB LEVEL knobs as performance controls with no set position; here they are well up - fade the undertones in and out to change the harmony. With EG off, a key held while stopped holds the sound at full VOLUME until you let go.',
    'manual', {
      vco1: { freq: 1567.98, sub1: 5, sub2: 4, wave: DOWN, levels: [50, 80, 80] },
      vco2: { freq: C6, sub1: 3, sub2: 6, wave: UP, levels: [50, 80, 80] },
      vcf: [80, 0, 48], eg: [7.6, 15.6, 1, 45.3], volume: 100,
      seqOct: OCT1, quantize: Q_8ET, assign1: OSC, assign2: OSC,
      steps1: [-53, 7, 35, -42], steps2: [-55, -32, -77, -39],
      rhythm: [[1, true, false], [8, false, true], off, off], tempo: 407, eg_mode: EG_OFF,
    }, [cable('out_seq1', 'in_cutoff'), cable('out_seq1_clk', 'in_trigger')]),
  man_slip: preset('Rhythm / Self-tripping cross-sequence',
    'Based on the Owner\'s Manual sheet "Slip & Fall" (p.46), all five cables: each VCO is played by both sequencers (its own assign plus a crossed cable), and both envelopes feed back into RHYTHM 1 and 2, so every note bends the rhythm and the groove stumbles and recovers. EG is off; SEQ 1 CLK fires the envelopes, and a key held while stopped is a gate that holds the sound open until you let go.',
    'manual', {
      vco1: { freq: C8, sub1: 6, sub2: 7, wave: UP, levels: [71, 0, 55.5] },
      vco2: { freq: C6, sub1: 3, sub2: 3, wave: UP, levels: [71, 0, 90] },
      vcf: [2350, 17.5, 52], eg: [831.8, 5, 83.2, 5], volume: 38.9,
      seqOct: OCT1, quantize: Q_8JI, assign1: OSC, assign2: OSC,
      steps1: [35, -40, -11, -17], steps2: [-53, -18, -60, 34],
      rhythm: [[8, true, false], [9, false, true], off, off], tempo: 1233, eg_mode: EG_OFF,
    }, [cable('out_seq2', 'in_vco1'), cable('out_seq1', 'in_vco2'), cable('out_vca_eg', 'in_rhythm2'), cable('out_vcf_eg', 'in_rhythm1'), cable('out_seq1_clk', 'in_trigger')]),
  man_pointzero: preset('Ambient / Driven pulse swell',
    'Based on the Owner\'s Manual sheet "Point Zero" (p.46). Five of the six sources at full push the mixer into its warm overdrive; SEQ 1 sweeps VCO 1\'s pulse width and SEQ 2 moves the cutoff. VCF ATTACK sets how long each note takes to open, as the sheet says, and the long VCA DECAY lets the notes ring together.',
    'manual', {
      vco1: { freq: 1975.53, sub1: 5, sub2: 3, wave: UP, levels: [100, 100, 42] },
      vco2: { freq: 1760, sub1: 1, sub2: 5, wave: DOWN, levels: [100, 100, 100] },
      vcf: [80, 41, 60], eg: [478.6, 31, 1, 6337.8], volume: 39.8,
      seqOct: OCT2, quantize: Q_8ET, assign1: OSC, assign2: OSC,
      steps1: [-41, -42, -97, -97], steps2: [-43, -17, -95, -82],
      rhythm: [[3, true, false], [8, false, true], off, off], tempo: 735, eg_mode: EG_ON,
    }, [cable('out_seq1', 'in_vco1_pwm'), cable('out_seq2', 'in_cutoff')]),
  man_threehands: preset('Texture / Winding two-sequencer line',
    'Based on the Owner\'s Manual sheet "Three Hands on the Wheel" (p.47). VCO 1 is silent; VCO 2 is played by both sequencers at once (OSC 2 plus SEQ 1 by cable) while SEQ 2 also works the cutoff. ÷13 against ÷6 makes a long, winding line. The sheet marks VCO 2 SUB 2 LEVEL and the positive side of VCF EG AMT as performance controls; here SUB 2 is faded in and EG AMT sits in the middle of its arc.',
    'manual', {
      vco1: { freq: C6, sub1: 1, sub2: 1, wave: UP, levels: [0, 0, 0] },
      vco2: { freq: C6, sub1: 3, sub2: 4, wave: DOWN, levels: [90, 71, 75] },
      vcf: [69, 45, 65], eg: [1, 66.3, 1, 42], volume: 99,
      seqOct: OCT2, quantize: Q_8ET, assign1: NONE, assign2: OSC,
      steps1: [-52, 11, 33, -16], steps2: [-51, 33, -32, -73],
      rhythm: [[13, true, false], [6, false, true], off, off], tempo: 1921, eg_mode: EG_ON,
    }, [cable('out_seq1', 'in_vco2'), cable('out_seq2', 'in_cutoff')]),
  man_bateria: preset('Drums / Filter-ping kit',
    'Based on the Owner\'s Manual sheet "Bateria" (p.47). All six mixer levels are down, so the only sound is the ladder at full resonance, struck by its envelope; each sequencer\'s voltage changes its own rhythm generator, SEQ 1 CLK into CUTOFF adds a snap and SEQ 2 CLK into VCA an accent. The sheet tunes the kick with CUTOFF and shapes it with VCF DECAY and EG AMT.',
    'manual', {
      vco1: { freq: 1760, sub1: 1, sub2: 1, wave: MID, levels: [0, 0, 0] },
      vco2: { freq: C6, sub1: 1, sub2: 1, wave: MID, levels: [0, 0, 0] },
      vcf: [80, 99, 22], eg: [1, 19.6, 1, 165], volume: 95.8,
      seqOct: OCT1, quantize: Q_12ET, assign1: NONE, assign2: NONE,
      steps1: [-100, -17, 100, 9], steps2: [100, 32, -47, 23],
      rhythm: [[8, true, false], [4, false, true], off, [16, true, false]], tempo: 515, eg_mode: EG_ON,
    }, [cable('out_seq1', 'in_rhythm1'), cable('out_seq2', 'in_rhythm2'), cable('out_seq1_clk', 'in_cutoff'), cable('out_seq2_clk', 'in_vca')]),
  man_spiral: preset('Ambient / Accelerating spiral',
    'Based on the Owner\'s Manual sheet "Spiral Ways" (p.48). The VCF envelope patched into RHYTHM 1 makes Sequencer 1 rush on every swell and relax as it decays; VCF ATTACK sets how far it builds. The sheet tunes VCO 1 SUB 1 to a fifth (÷6) and VCO 2 SUB 2 to a major third (÷5), with an arrow to sweep it. As printed, EG and PLAY are unlit and nothing fires the envelopes, so the patch is silent; this recreation lights EG.',
    'manual', {
      vco1: { freq: C8, sub1: 6, sub2: 7, wave: MID, levels: [60, 59, 59] },
      vco2: { freq: C6, sub1: 2, sub2: 5, wave: DOWN, levels: [65, 100, 100] },
      vcf: [37, 34, 70], eg: [100, 10.7, 1, 6838.3], volume: 41.7,
      seqOct: OCT1, quantize: Q_8ET, assign1: OSC, assign2: OSC,
      steps1: [20, 20, -17, -17], steps2: [-97, -45, -97, -42],
      rhythm: [[5, true, false], [12, false, true], off, off], tempo: 1510, eg_mode: EG_ON,
    }, [cable('out_vcf_eg', 'in_rhythm1')]),
  man_stargate: preset('Ambient / Percolating high clusters',
    'Based on the Owner\'s Manual sheet "Star-Gate" (p.48). At a fast TEMPO three generators (÷8, ÷7, ÷10) all clock Sequencer 2 while ÷3 clocks Sequencer 1, which also re-divides both of VCO 1\'s subs: clusters of very high notes. The sheet starts the five other mixer knobs at zero as performance controls; here they are partly brought in. VCA DECAY is a performance control too. As printed, EG and PLAY are unlit (silent); this recreation lights EG.',
    'manual', {
      vco1: { freq: C8, sub1: 4, sub2: 3, wave: DOWN, levels: [100, 50, 45] },
      vco2: { freq: 3488.34, sub1: 7, sub2: 16, wave: UP, levels: [20, 50, 40] },
      vcf: [159, 0, 42], eg: [1.1, 5444, 1, 10000], volume: 43.8,
      seqOct: OCT1, quantize: Q_8JI, assign1: [true, true, true], assign2: OSC,
      steps1: [21, -42, -52, -12], steps2: [9, 9, -21, -53],
      rhythm: [[3, true, false], [8, false, true], [7, false, true], [10, false, true]], tempo: 2216, eg_mode: EG_ON,
    }, [cable('out_seq1', 'in_cutoff'), cable('out_seq2', 'in_vco1_pwm')]),
  man_polyrock: preset('Groove / Polyrhythm chord stabs',
    'Based on the Owner\'s Manual sheet "Poly Rock" (p.49). ÷10 and ÷5 on Sequencer 1 against ÷12 on Sequencer 2, a negative VCF EG AMT, and the VCA envelope patched into CUTOFF so each stab brightens with its loudness. The sheet suggests tuning the four subs into chord shapes, and patching CLOCK OUT into VCA IN for a drum pulse.',
    'manual', {
      vco1: { freq: 1975.53, sub1: 8, sub2: 3, wave: UP, levels: [60, 59, 100] },
      vco2: { freq: 2637.02, sub1: 7, sub2: 10, wave: UP, levels: [0, 100, 55] },
      vcf: [37, 50, -41], eg: [73.8, 12.4, 1, 71.5], volume: 99,
      seqOct: OCT1, quantize: Q_8ET, assign1: OSC, assign2: OSC,
      steps1: [-98, -79, -78, -98], steps2: [23, -94, -9, -86],
      rhythm: [[10, true, false], [12, false, true], [5, true, false], off], tempo: 378, eg_mode: EG_ON,
    }, [cable('out_vca_eg', 'in_cutoff')]),
  man_cloudpath: preset('Pad / Slow-bloom duet',
    'Based on the Owner\'s Manual sheet "Cloud Path" (p.49). One generator (÷11) drives both sequencers; the VCA envelope patched into CUTOFF opens a fully closed filter with every slow swell, and the VCF envelope bends RHYTHM 3. The sheet starts VCO 2 and the subs at zero and fades them in; here they sit half way up that move. Light RHYTHM 3 for SEQ 1 for double time. As printed, EG and PLAY are unlit (silent); this recreation lights EG.',
    'manual', {
      vco1: { freq: C7, sub1: 4, sub2: 2, wave: UP, levels: [78, 30, 30] },
      vco2: { freq: 1479.98, sub1: 2, sub2: 7, wave: MID, levels: [45, 30, 30] },
      vcf: [20, 41, -17], eg: [1905.5, 14.1, 691.8, 337.1], volume: 46.3,
      seqOct: OCT1, quantize: Q_12ET, assign1: OSC, assign2: OSC,
      steps1: [-95, -60, -60, -79], steps2: [-43, -79, -69, -41],
      rhythm: [[11, true, true], off, [9, false, false], off], tempo: 1510, eg_mode: EG_ON,
    }, [cable('out_vca_eg', 'in_cutoff'), cable('out_vcf_eg', 'in_rhythm3')]),

  // ------------------------------------------------------------- Exploration Patchbook sheets (pp.1-10)
  xpb_dishes: preset('FX / Clinking sub clatter',
    'Based on the Exploration Patchbook sheet "Music for Washing Dishes" (p.1). Three very low subs at high level ring a self-oscillating ladder tuned near 53 Hz with millisecond envelopes, SEQ 2 jolts the cutoff, and four rhythm generators clatter across both sequencers (Sequencer 1 only re-divides VCO 1\'s SUB 2). The sheet suggests riding VCF ATTACK.',
    'manual', {
      vco1: { freq: C4, sub1: 4, sub2: 16, wave: DOWN, levels: [0, 0, 81] },
      vco2: { freq: C4, sub1: 13, sub2: 16, wave: DOWN, levels: [0, 81, 81] },
      vcf: [53, 100, 40], eg: [1.9, 7.9, 3, 33.4], volume: 96.6,
      seqOct: OCT5, quantize: Q_8JI, assign1: [false, false, true], assign2: [true, false, true],
      steps1: [-99, -39, -20, 20], steps2: [20, -73, 11, 61],
      rhythm: [[14, true, true], [11, true, false], [13, true, true], [15, false, true]], tempo: 1868, eg_mode: EG_ON,
    }, [cable('out_seq2', 'in_cutoff')]),
  xpb_shuffled: preset('Bass / Shuffled sub bassline',
    'Based on the Exploration Patchbook sheet "Shuffled Subs" (p.2). Both VCOs tuned together on C5 with ÷4 subs make a square-and-saw bass pair; VCO 2 follows Sequencer 2 inside and Sequencer 1 by cable, and SEQ 2 also moves the cutoff against a negative EG AMT. The sheet\'s trick: reshape the bassline live with VCO 1 SUB 1 FREQ.',
    'manual', {
      vco1: { freq: C5, sub1: 4, sub2: 16, wave: UP, levels: [81, 81, 0] },
      vco2: { freq: C5, sub1: 4, sub2: 16, wave: DOWN, levels: [81, 81, 0] },
      vcf: [3811, 0, -32], eg: [1, 31, 4, 71.5], volume: 70.2,
      seqOct: OCT1, quantize: Q_8JI, assign1: NONE, assign2: OSC,
      steps1: [-29, 30, -48, 20], steps2: [20, -19, 6, 41],
      rhythm: [[8, true, false], [8, false, true], off, off], tempo: 1123, eg_mode: EG_ON,
    }, [cable('out_seq1', 'in_vco2'), cable('out_seq2', 'in_cutoff')]),
  xpb_nosferatu: preset('Ambient / Eerie fourths in pulse',
    'Based on the Exploration Patchbook sheet "Nosferatu\'s Flotation Tank" (p.3). Two pulse-and-saw voices a perfect fourth apart (C5 and F5, 8-ET), all six sources high and slow envelopes; SEQ 1 adds per-step loudness through VCA IN, the VCF envelope bends RHYTHM 1 and SEQ 2 re-divides RHYTHM 3. The sheet suggests toggling the POLYRHYTHM buttons for new patterns.',
    'manual', {
      vco1: { freq: C5, sub1: 3, sub2: 6, wave: MID, levels: [81, 81, 81] },
      vco2: { freq: F5, sub1: 3, sub2: 7, wave: MID, levels: [81, 81, 81] },
      vcf: [37, 30, 65], eg: [91.2, 478.2, 91.2, 478.2], volume: 43.8,
      seqOct: OCT2, quantize: Q_8ET, assign1: OSC, assign2: OSC,
      steps1: [29, 60, -40, -80], steps2: [-19, 20, -19, 21],
      rhythm: [[13, true, false], [8, false, false], [13, false, true], [8, false, false]], tempo: 1003, eg_mode: EG_ON,
    }, [cable('out_seq1', 'in_vca'), cable('out_vcf_eg', 'in_rhythm1'), cable('out_seq2', 'in_rhythm3')]),
  xpb_insects: preset('FX / Buzzing cross-mod swarm',
    'Based on the Exploration Patchbook sheet "Transistor Insects" (p.4). Both VCOs at the top (C8) frequency-modulate each other through their subs (VCO 2 SUB 2 into VCO 1, VCO 1 SUB 2 into VCO 2) and VCO 1 modulates RHYTHM 4 at audio rate; all four generators clock both sequencers at a near-maximum TEMPO through a fully resonant filter with tiny envelopes. The sheet says to play with the sequencer and polyrhythm settings.',
    'manual', {
      vco1: { freq: C8, sub1: 7, sub2: 16, wave: UP, levels: [66, 66, 0] },
      vco2: { freq: C8, sub1: 7, sub2: 16, wave: UP, levels: [66, 64, 0] },
      vcf: [209, 100, 83], eg: [3, 24.7, 1, 12.4], volume: 97.8,
      seqOct: OCT5, quantize: Q_OFF, assign1: [true, false, true], assign2: [true, false, true],
      steps1: [-9, 40, -60, 80], steps2: [20, 60, 0, -69],
      rhythm: [[13, true, true], [12, true, true], [15, true, true], [13, true, true]], tempo: 2940, eg_mode: EG_ON,
    }, [cable('out_vco2_sub2', 'in_vco1'), cable('out_vco1_sub2', 'in_vco2'), cable('out_vco1', 'in_rhythm4')]),
  xpb_cactus: preset('Melody / Undertone step dance',
    'Based on the Exploration Patchbook sheet "Neon Cactus Tips Their Cap" (p.5). The sequencers move only the sub dividers (SUB 1 and SUB 2 lit on both sides, OSC dark), so the melody walks the undertones of two fixed oscillators an octave apart in 8-JI. SEQ 1 also re-divides RHYTHM 1, SEQ 2 sweeps VCO 2\'s pulse width and SEQ 2 CLK adds envelope triggers.',
    'manual', {
      vco1: { freq: 1395.34, sub1: 7, sub2: 4, wave: UP, levels: [40, 60, 67] },
      vco2: { freq: 697.67, sub1: 10, sub2: 4, wave: MID, levels: [60, 60, 70] },
      vcf: [20000, 37, -39], eg: [19.1, 104.6, 5.2, 131.3], volume: 83.2,
      seqOct: OCT2, quantize: Q_8JI, assign1: [false, true, true], assign2: [false, true, true],
      steps1: [-91, -40, 29, -33], steps2: [-35, -55, -80, 0],
      rhythm: [[7, true, false], [10, false, true], [8, false, false], [8, false, false]], tempo: 765, eg_mode: EG_ON,
    }, [cable('out_seq1', 'in_rhythm1'), cable('out_seq2', 'in_vco2_pwm'), cable('out_seq2_clk', 'in_trigger')]),
  xpb_wind: preset('FX / Tone and breath duet',
    'Based on the Exploration Patchbook sheet "Duet for Tone and Wind" (p.6). VCO 2 OUT drives CLOCK IN, so the master clock runs at audio rate (262 Hz) and ÷16 on both generators steps about 16 times a second; nothing moves a pitch, SEQ 1 only works VCO 2\'s pulse width. With RESONANCE near maximum the fast envelopes make a breathy hiss against the tone. The sheet suggests playing VCF ATTACK, RHYTHM 1 and RHYTHM 2.',
    'manual', {
      vco1: { freq: 1760, sub1: 10, sub2: 10, wave: MID, levels: [81, 81, 81] },
      vco2: { freq: C4, sub1: 12, sub2: 10, wave: MID, levels: [96, 81, 0] },
      vcf: [2047, 90, -22], eg: [2.5, 56.9, 1, 96.9], volume: 49.9,
      seqOct: OCT5, quantize: Q_8ET, assign1: NONE, assign2: NONE,
      steps1: [-30, -10, 19, -39], steps2: [-48, -19, 9, 40],
      rhythm: [[16, true, false], [16, false, true], [8, false, false], [8, false, false]], tempo: 1152, eg_mode: EG_ON,
    }, [cable('out_seq1', 'in_vco2_pwm'), cable('out_vco2', 'in_clock')]),
  xpb_touchtone: preset('Rhythm / Sub-gated dial tones',
    'Based on the Exploration Patchbook sheet "Touchtone Wiretap" (p.7). VCO 1 is not in the mix: its SUB 1 (about 36 Hz) gates PLAY IN, its SUB 2 frequency-modulates the cutoff and SEQ 2 sweeps its pulse width. VCO 2 and its subs make the beeping tones, bent by the VCA envelope patched into VCO 2. PLAY stays unlit because PLAY IN runs the sequencers; the sheet changes the rhythm with VCO 1 SUB 1 FREQ.',
    'manual', {
      vco1: { freq: 466.16, sub1: 13, sub2: 14, wave: UP, levels: [0, 0, 0] },
      vco2: { freq: 1108.73, sub1: 7, sub2: 7, wave: UP, levels: [82, 81, 70] },
      vcf: [1262, 100, 59], eg: [43.7, 56.9, 3, 178], volume: 69.9,
      seqOct: OCT2, quantize: Q_12ET, assign1: OSC, assign2: NONE,
      steps1: [-39, 60, -74, 30], steps2: [-5, -30, 60, 11],
      rhythm: [[11, true, false], [11, false, true], [8, false, false], [8, false, false]], tempo: 1272, eg_mode: EG_ON,
    }, [cable('out_vco1_sub1', 'in_play'), cable('out_vca_eg', 'in_vco2'), cable('out_vco1_sub2', 'in_cutoff'), cable('out_seq2', 'in_vco1_pwm')]),
  xpb_ants: preset('Rhythm / Marching sub clicks',
    'Based on the Exploration Patchbook sheet "Ant Parade" (p.8). CLOCK OUT patched into VCO 1 kicks its pitch up on every master pulse, which makes clicky footsteps; SEQ 2 re-divides VCO 1\'s subs through VCO 1 SUB while Sequencer 1 moves VCO 1 and both subs. Millisecond envelopes and a negative EG AMT keep it tight. The sheet suggests fading in VCO 2\'s SUB 1 and SUB 2 for low end.',
    'manual', {
      vco1: { freq: 1255.8, sub1: 8, sub2: 1, wave: UP, levels: [81, 81, 81] },
      vco2: { freq: C4, sub1: 16, sub2: 16, wave: UP, levels: [0, 0, 0] },
      vcf: [20000, 40, -39], eg: [9.1, 12.4, 3.3, 33.4], volume: 84.9,
      seqOct: OCT2, quantize: Q_12JI, assign1: [true, true, true], assign2: NONE,
      steps1: [-20, -24, 34, -53], steps2: [60, -19, -4, -9],
      rhythm: [[9, true, false], [10, false, true], [8, false, false], [8, false, false]], tempo: 1868, eg_mode: EG_ON,
    }, [cable('out_clock', 'in_vco1'), cable('out_seq2', 'in_vco1_sub')]),
  xpb_octave: preset('Drone / Octave-shifting fuzz bass',
    'Based on the Exploration Patchbook sheet "Octave Fuzz" (p.9). SEQ 2 into VCO 1 with steps of -1, 0, +1 and 0 V shifts Sequencer 1\'s riff by an octave on each slow step, as the sheet\'s note says; VCO 1 SUB 1 into VCA IN adds audio-rate amplitude modulation, the fuzz - and because it is summed with the VCA envelope it keeps the VCA open, so a dark fuzz drone carries on between and after the notes. The filter sits nearly closed with EG AMT at maximum, so every note barks.',
    'manual', {
      vco1: { freq: C5, sub1: 4, sub2: 7, wave: UP, levels: [81, 81, 81] },
      vco2: { freq: C5, sub1: 16, sub2: 16, wave: UP, levels: [0, 0, 0] },
      vcf: [46, 40, 99], eg: [30.2, 33.4, 9.1, 31], volume: 62.8,
      seqOct: OCT1, quantize: Q_12JI, assign1: OSC, assign2: NONE,
      steps1: [-20, 20, -40, -20], steps2: [-99, 0, 100, 0],
      rhythm: [[3, true, false], [16, false, true], [8, false, false], [8, false, false]], tempo: 974, eg_mode: EG_ON,
    }, [cable('out_seq2', 'in_vco1'), cable('out_vco1_sub1', 'in_vca')]),
  xpb_chimes: preset('FX / Folded high chimes',
    'Based on the Exploration Patchbook sheet "Aliased Wind Chimes" (p.10). VCO 1 sits at the top of its range with both subs in unison and the sequencer pushes it toward the 10 kHz ceiling, where the manual warns the subs can no longer be made accurately (p.28) - the folding is the point. The VCA envelope and VCO 2 SUB 1 bend RHYTHM 3 and 4, and SEQ 1 CLK flicks the cutoff.',
    'manual', {
      vco1: { freq: C8, sub1: 1, sub2: 1, wave: DOWN, levels: [81, 81, 81] },
      vco2: { freq: C4, sub1: 16, sub2: 16, wave: UP, levels: [0, 0, 0] },
      vcf: [20000, 70, -39], eg: [9.1, 33.4, 9.1, 33.4], volume: 54.6,
      seqOct: OCT2, quantize: Q_OFF, assign1: OSC, assign2: NONE,
      steps1: [-29, -19, 20, 8], steps2: [-33, 34, -66, 66],
      rhythm: [[3, true, false], [13, false, true], [13, false, true], [8, true, false]], tempo: 1033, eg_mode: EG_ON,
    }, [cable('out_vca_eg', 'in_rhythm3'), cable('out_vco2_sub1', 'in_rhythm4'), cable('out_seq1_clk', 'in_cutoff')]),

  // ------------------------------------------------------------- teaching patches (our designs)
  ji_major: preset('Drone / Just major lattice',
    'With 12-JI on, VCO 1 FREQ snaps to G4 (3/2) and VCO 2 FREQ to E4 (5/4); VCO 1 ÷3 is C3 and ÷6 is C2, VCO 2 ÷2 is E3 and its ÷5 lands exactly on C2 again. EG held: a wide C major chord with no beating at all. Our design, from the manual\'s just C major ratios (p.17).',
    'community', {
      vco1: { freq: 392.44, sub1: 3, sub2: 6, wave: DOWN, levels: [25, 55, 45] },
      vco2: { freq: 327.03, sub1: 2, sub2: 5, wave: DOWN, levels: [25, 45, 30] },
      vcf: [2005, 10, 0], eg: [1, 223.6, 1, 223.6], volume: 36.8,
      seqOct: OCT1, quantize: Q_12JI, assign1: OSC, assign2: OSC,
      steps1: [0, 0, 0, 0], steps2: [0, 0, 0, 0],
      rhythm: [off, off, off, off], tempo: 1510, eg_mode: EG_HELD,
    }),
  ji_major_et: preset('Drone / Same chord in 12-ET',
    'The just major lattice with QUANTIZE on 12-ET: VCO 2\'s ÷5 (65.9 Hz) now beats about 0.6 times a second against VCO 1\'s ÷6 (65.3 Hz), because the equal-tempered third is 13.7 cents wider than 5/4. Switch between this and the just version to hear what just intonation buys. Our design.',
    'community', {
      vco1: { freq: 392.0, sub1: 3, sub2: 6, wave: DOWN, levels: [25, 55, 45] },
      vco2: { freq: 329.63, sub1: 2, sub2: 5, wave: DOWN, levels: [25, 45, 30] },
      vcf: [2005, 10, 0], eg: [1, 223.6, 1, 223.6], volume: 38.4,
      seqOct: OCT1, quantize: Q_12ET, assign1: OSC, assign2: OSC,
      steps1: [0, 0, 0, 0], steps2: [0, 0, 0, 0],
      rhythm: [off, off, off, off], tempo: 1510, eg_mode: EG_HELD,
    }),
  drone_minor: preset('Drone / Undertone minor',
    'One VCO at C6 with SUB 1 at ÷5 (A♭3) and SUB 2 at ÷6 (F3): f/6 : f/5 : f is a just F minor chord - the mirror of the major triad in the harmonic series - and because all three come from one oscillator they are phase-locked and never beat. Our design, from the manual\'s undertone table (p.11).',
    'community', {
      vco1: { freq: C6, sub1: 5, sub2: 6, wave: DOWN, levels: [25, 60, 60] },
      vco2: { freq: C6, sub1: 1, sub2: 1, wave: UP, levels: [0, 0, 0] },
      vcf: [1178, 15, 0], eg: [1, 223.6, 1, 223.6], volume: 40.6,
      seqOct: OCT1, quantize: Q_OFF, assign1: NONE, assign2: NONE,
      steps1: [0, 0, 0, 0], steps2: [0, 0, 0, 0],
      rhythm: [off, off, off, off], tempo: 1510, eg_mode: EG_HELD,
    }),
  poly_or: preset('Polyrhythm / Hemiola 2+3 (OR)',
    'Rhythm 1 (÷2) and Rhythm 2 (÷3) both clock Sequencer 1 with OR logic: the merged pattern is x.xxx. - four steps every six pulses - so the four-note riff locks to the six-pulse cycle. Rhythm 4 (÷6) walks the bass on Sequencer 2. Our design, from the manual\'s rhythm logic (p.44).',
    'community', {
      vco1: { freq: C5, sub1: 1, sub2: 1, wave: DOWN, levels: [60, 0, 0] },
      vco2: { freq: C4, sub1: 4, sub2: 1, wave: UP, levels: [0, 60, 0] },
      vcf: [632, 25, 40], eg: [1, 71.5, 1, 89.8], volume: 100,
      seqOct: OCT1, quantize: Q_12ET, assign1: OSC, assign2: OSC,
      steps1: [0, 25, 58, 42], steps2: [0, -17, -33, -42],
      rhythm: [[2, true, false], [3, true, false], off, [6, false, true]], tempo: 479, eg_mode: EG_ON,
    }),
  poly_xor: preset('Polyrhythm / Missing downbeat (XOR)',
    'The hemiola with the rhythm logic on XOR: the pulse where ÷2 and ÷3 coincide - the downbeat - cancels (..xxx.), so the riff needs 24 pulses to come round and starts off the beat. Sequencer 2 has a single generator, so XOR leaves it alone. Flip LOGIC back to OR to compare. Our design.',
    'community', {
      vco1: { freq: C5, sub1: 1, sub2: 1, wave: DOWN, levels: [60, 0, 0] },
      vco2: { freq: C4, sub1: 4, sub2: 1, wave: UP, levels: [0, 60, 0] },
      vcf: [632, 25, 40], eg: [1, 71.5, 1, 89.8], volume: 100,
      seqOct: OCT1, quantize: Q_12ET, assign1: OSC, assign2: OSC,
      steps1: [0, 25, 58, 42], steps2: [0, -17, -33, -42],
      rhythm: [[2, true, false], [3, true, false], off, [6, false, true]], tempo: 479, logic: 1, eg_mode: EG_ON,
    }),
  poly_34: preset('Polyrhythm / 3 against 4',
    'Rhythm 3 (÷3) on Sequencer 1 and Rhythm 4 (÷4) on Sequencer 2: the two lines meet every 12 pulses and both four-step loops line up again every 48 - at 480 BPM that is four bars of 16ths at 120. Count along with the step lights. Our design.',
    'community', {
      vco1: { freq: C5, sub1: 1, sub2: 1, wave: DOWN, levels: [65, 0, 0] },
      vco2: { freq: C4, sub1: 2, sub2: 1, wave: UP, levels: [0, 65, 0] },
      vcf: [632, 20, 40], eg: [1, 56.9, 1, 77.2], volume: 100,
      seqOct: OCT1, quantize: Q_12ET, assign1: OSC, assign2: OSC,
      steps1: [0, 58, 25, 83], steps2: [0, -42, -17, 42],
      rhythm: [off, off, [3, true, false], [4, false, true]], tempo: 479, eg_mode: EG_ON,
    }),
  bass_sub: preset('Bass / Square sub bass',
    'VCO 1 muted with WAVE up, so its subs are squares: ÷4 and ÷8 put the energy at C2 and C1 under a low, short filter envelope - the standard way to get deep bass from an instrument whose VCOs start at Middle C. Our design.',
    'community', {
      vco1: { freq: C4, sub1: 4, sub2: 8, wave: UP, levels: [0, 75, 40] },
      vco2: { freq: C6, sub1: 1, sub2: 1, wave: UP, levels: [0, 0, 0] },
      vcf: [317, 25, 40], eg: [1, 48.9, 1, 77.2], volume: 99.1,
      seqOct: OCT1, quantize: Q_12ET, assign1: OSC, assign2: NONE,
      steps1: [0, 0, 25, -17], steps2: [0, 0, 0, 0],
      rhythm: [[2, true, false], off, off, off], tempo: 479, eg_mode: EG_ON,
    }),
  pwm_lead: preset('Lead / Envelope PWM',
    'VCO 1 in the middle (pulse) position with the VCF envelope patched into its PWM jack, which replaces the SUB 1 normal: each note sweeps the pulse width as the filter opens. A singing lead in 12-ET. Our design.',
    'community', {
      vco1: { freq: C5, sub1: 2, sub2: 4, wave: MID, levels: [75, 30, 0] },
      vco2: { freq: C6, sub1: 1, sub2: 1, wave: UP, levels: [0, 0, 0] },
      vcf: [2600, 25, 20], eg: [20, 700, 10, 650], volume: 80.3,
      seqOct: OCT1, quantize: Q_12ET, assign1: OSC, assign2: NONE,
      steps1: [0, 58, 25, 83], steps2: [0, 0, 0, 0],
      rhythm: [[2, true, false], off, off, off], tempo: 480, eg_mode: EG_ON,
    }, [cable('out_vcf_eg', 'in_vco1_pwm')]),
};
