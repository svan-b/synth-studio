// ============================================================================
// DFAM presets. Named "Category / Name" - the preset menu groups by category.
//
// Sources (see REFERENCE.md):
//  - "manual": the ten patch sheets of the DFAM manual (pp.33-37), its Default
//    settings (p.8) and its first walkthrough (pp.8-9), under our own descriptive
//    names. The sheets and the Default settings are drawings, so every knob was
//    measured from them (the big knobs sweep 300 degrees from 7 to 5 o'clock, the
//    small ones 270) and turned into values with the twin's control laws; switches
//    and cables are as drawn. Only VOLUME differs: every sheet leaves it at 12
//    o'clock, here it lines the presets up (Levels, below). Each description cites
//    its page.
//  - community: well-known DFAM techniques (kicks, snares, hats, toms, acid...).
// Pitches are volts (1 V = 1 octave); `st()` converts semitones.
//
// Levels: each preset is set for the studio audio-QA target (scripts/audio-qa.cjs
// --target -18): its audition (the pattern from step 1 at its TEMPO) measures
// -18 to -21 LUFS at the instrument output (FX 4 LU lower), with true peaks at or
// below -2 dBTP in every one of 12 renders (noise and oscillator phases differ per
// render). The sparse, spiky hits (snares, clap, rimshot, hats, noise loops) are
// peak-limited, so their loudness comes from a longer VCA DECAY (more body), not
// from VOLUME. Re-measure after editing a preset (devices/dfam/REVIEW.md).
// ============================================================================

import type { PatchConnection, PresetSpec } from '@/types';

type Values = Record<string, number | boolean>;

/**
 * Neutral patch every preset below is written against: a triangle through a half-open low-pass with
 * medium decays. (It was the twin's default until the defaults became the manual's, below.)
 */
export const DFAM_NEUTRAL: Values = {
  vco_decay: 100, seq_pitch_mod: 1, vco1_eg_amount: 0, vco2_eg_amount: 0,
  vco1_frequency: 0, vco1_wave: 1, fm_amount: 0, hard_sync: 1, vco2_frequency: 0, vco2_wave: 1,
  vco1_level: 75, noise_level: 0, vco2_level: 0,
  vcf_mode: 1, vcf_cutoff: 2000, vcf_resonance: 0, vcf_decay: 300, vcf_eg_amount: 0, noise_vcf_mod: 0,
  vca_attack_mode: 0, vca_decay: 300, volume: 75, tempo: 120,
};

const INIT = DFAM_NEUTRAL;

const st = (semitones: number) => Math.round((semitones / 12) * 1000) / 1000;

/** Step data: 8 pitches (volts) and 8 velocities (%) */
function steps(pitch: number[], vel: number[]): Values {
  const v: Values = {};
  for (let i = 0; i < 8; i++) {
    // PITCH knobs have semitone detents: keep preset steps on the same grid
    const semis = Math.round((pitch[i] ?? 0) * 12);
    v[`pitch_${i + 1}`] = semis === 0 ? 0 : Math.round((semis / 12) * 10000) / 10000;
    v[`velocity_${i + 1}`] = vel[i] ?? 100;
  }
  return v;
}
const FLAT = [0, 0, 0, 0, 0, 0, 0, 0];
/** SEQ PITCH MOD on VCO 1&2: the PITCH knobs play the oscillators */
const PITCHED: Values = { seq_pitch_mod: 0 };
const FULL = [100, 100, 100, 100, 100, 100, 100, 100];
/** The VELOCITY knobs of the manual's Default settings (p.8) */
export const DEFAULT_VELOCITY = [100, 50, 83, 50, 83, 50, 100, 50];

/**
 * The manual's Default settings (p.8), measured from its drawing: the big knobs sweep 300 degrees
 * (7 to 5 o'clock), the small ones 270. The DECAY knobs of the VCO and VCF and RESONANCE at their
 * minimum, CUTOFF fully open, VOLUME and every EG AMOUNT at the centre, VCA DECAY near 11 o'clock,
 * VCO 1 LEVEL at 3 o'clock, TEMPO just before 12, VELOCITY knobs at the maximum, the centre or 3 o'clock.
 * The spec's defaults are these values (spec.ts).
 */
export const DEFAULT_SETTINGS: Values = {
  vco_decay: 10, seq_pitch_mod: 1, vco1_eg_amount: 0, vco2_eg_amount: 0,
  vco1_frequency: 0, vco1_wave: 1, fm_amount: 0, hard_sync: 1, vco2_frequency: 0, vco2_wave: 1,
  vco1_level: 84, noise_level: 0, vco2_level: 0,
  vcf_mode: 1, vcf_cutoff: 20000, vcf_resonance: 0, vcf_decay: 10, vcf_eg_amount: 0, noise_vcf_mod: 0,
  vca_attack_mode: 0, vca_decay: 153, volume: 50, tempo: 245,
  ...steps(FLAT, DEFAULT_VELOCITY),
};

function preset(name: string, description: string, source: PresetSpec['source'], settings: Values, patchConnections?: PatchConnection[]): PresetSpec {
  return { name, description, source, settings: { ...INIT, ...steps(FLAT, FULL), ...settings }, ...(patchConnections ? { patchConnections } : {}) };
}

export const DFAM_PRESETS: Record<string, PresetSpec> = {
  init: preset('Init / Default settings',
    'The manual\'s Default settings (p.8), knob for knob: one triangle VCO through a fully open low-pass, every envelope amount at the centre, SEQ PITCH MOD off, a quick TEMPO and VELOCITY knobs that already accent the steps. It is what Reset gives, and where the manual\'s first tour starts: press RUN / STOP, then turn VCO 1 FREQUENCY left for a deep note.',
    'manual', { ...DEFAULT_SETTINGS }),

  // ---------------------------------------------------------------- Kicks
  kick_analog: preset('Kick / Analog kick',
    'The kick from the manual\'s first walkthrough (p.8-9): VCO 1 FREQUENCY near 10:30, VCO 1 EG AMOUNT at 3 o\'clock and VCO DECAY at 9 o\'clock - a low triangle with a fast pitch drop. Kicks on every beat.',
    'manual', {
      vco1_frequency: -1.5, vco1_eg_amount: 60, vco_decay: 40, vco1_level: 90,
      vcf_cutoff: 900, vcf_resonance: 10, vcf_eg_amount: 25, vcf_decay: 50, vca_decay: 420, volume: 100,
      ...steps(FLAT, [100, 0, 0, 0, 100, 0, 0, 0]),
    }),
  kick_808: preset('Kick / 808 boom',
    'Long, deep and round: little pitch sweep, a slow VCO DECAY and a very long VCA DECAY - the 808-style boom. One boom every two beats, with a softer pickup two semitones lower on step 7.',
    'community', {
      ...PITCHED,
      vco1_frequency: -1.35, vco1_eg_amount: 22, vco_decay: 110, vco1_level: 85,
      vcf_cutoff: 450, vcf_eg_amount: 10, vcf_decay: 120, vca_decay: 1600, volume: 88,
      ...steps([0, 0, 0, 0, 0, 0, st(-2), 0], [100, 0, 0, 0, 0, 0, 70, 0]),
    }),
  kick_punch: preset('Kick / Punch kick',
    'A short, clicky kick: a big fast pitch drop plus a burst of noise through the filter envelope for the beater click. Four on the floor at 124 BPM.',
    'community', {
      vco1_frequency: -1.3, vco1_eg_amount: 62, vco_decay: 28, vco1_level: 95, noise_level: 28,
      vcf_cutoff: 600, vcf_resonance: 15, vcf_eg_amount: 55, vcf_decay: 22, vca_decay: 300, volume: 100, tempo: 124,
      ...steps(FLAT, [100, 0, 0, 0, 100, 0, 0, 0]),
    }),
  kick_rumble: preset('Kick / Techno rumble',
    'A long, dark kick with NOISE / VCF MOD roughening the filter - the rumble under modern techno. Push RESONANCE for more growl.',
    'community', {
      vco1_frequency: -1.6, vco1_eg_amount: 35, vco_decay: 70, vco1_level: 100,
      vcf_cutoff: 320, vcf_resonance: 35, vcf_eg_amount: 20, vcf_decay: 150, noise_vcf_mod: 12, vca_decay: 1100, volume: 89, tempo: 128,
      ...steps(FLAT, [100, 0, 0, 0, 100, 0, 0, 0]),
    }),

  // ---------------------------------------------------------------- Snares and claps
  snare_snappy: preset('Snare / Snappy snare',
    'Two detuned triangles for the drum shell plus noise for the wires, with a short pitch drop. Snare on beat 2 with ghost notes.',
    'community', {
      vco1_frequency: 0.25, vco1_eg_amount: 20, vco_decay: 35, vco1_level: 80,
      vco2_frequency: 0.85, vco2_eg_amount: 15, vco2_level: 40, noise_level: 80,
      vcf_cutoff: 6500, vcf_resonance: 10, vcf_eg_amount: 10, vcf_decay: 80, vca_decay: 640, volume: 86,
      ...steps(FLAT, [0, 0, 25, 0, 100, 0, 0, 35]),
    }),
  snare_noise: preset('Snare / Bright noise snare',
    'Mostly noise through the high-pass filter, with a little tone underneath: a thin, cutting electro snare.',
    'community', {
      vco1_frequency: 0.6, vco1_eg_amount: 20, vco_decay: 25, vco1_level: 40, noise_level: 90,
      vcf_mode: 0, vcf_cutoff: 900, vcf_resonance: 15, vca_decay: 380, volume: 68,
      ...steps(FLAT, [0, 0, 0, 0, 100, 0, 30, 0]),
    }),
  snare_clap: preset('Snare / Hand clap',
    'Noise only, with VCA EG patched into NOISE LEVEL: the noise is loudest at the start and dies faster than the VCA, like the slap of a clap. A resonant low-pass centres it.',
    'community', {
      vco1_level: 0, noise_level: 35,
      vcf_cutoff: 2200, vcf_resonance: 40, vcf_eg_amount: 30, vcf_decay: 60, vca_decay: 520, volume: 78,
      ...steps(FLAT, [0, 0, 0, 0, 100, 0, 0, 0]),
    }, [{ from: 'out_vca_eg', to: 'in_noise_level' }]),
  snare_rim: preset('Snare / Rimshot',
    'Two square waves far apart through the low-pass filter with a short VCA DECAY (170 ms) - a woody click like a drum machine rim shot.',
    'community', {
      vco1_frequency: 1.75, vco1_wave: 0, vco1_eg_amount: 8, vco_decay: 10, vco1_level: 70,
      vco2_frequency: 3.65, vco2_wave: 0, vco2_level: 60,
      vcf_cutoff: 4000, vcf_resonance: 20, vca_decay: 170, volume: 95,
      ...steps(FLAT, [0, 0, 100, 0, 0, 70, 0, 100]),
    }),

  // ---------------------------------------------------------------- Hats and shakers
  hats_quick: preset('Hats / Hat lengths per step',
    'The manual\'s "Quick Hats" patch sheet (p.33), knob for knob: noise alone through the high-pass filter, PITCH patched into VCA DECAY. Each PITCH knob sets how long its hat rings: low is closed, step 7 high is open. The fully negative VCF EG gives each hit a soft body.',
    'manual', {
      vco_decay: 316, vco1_eg_amount: 37, vco1_frequency: -2.61, vco1_level: 0, vco2_level: 0, noise_level: 100,
      vcf_mode: 0, vcf_cutoff: 1236, vcf_resonance: 0, vcf_eg_amount: -100, vcf_decay: 316, vca_decay: 316, volume: 66, tempo: 139,
      ...steps([st(-19), st(-14), st(-13), st(-20), st(-13), st(-12), st(20), 0], [100, 50, 42, 41, 100, 50, 67, 50]),
    }, [{ from: 'out_pitch', to: 'in_vca_decay' }]),
  hats_closed: preset('Hats / Closed hat',
    'Pure noise, high-pass at 7.5 kHz with a little resonance and a 90 ms VCA DECAY. Accented 16ths.',
    'community', {
      vco1_level: 0, noise_level: 100,
      vcf_mode: 0, vcf_cutoff: 7500, vcf_resonance: 25, vca_decay: 90, volume: 76,
      ...steps(FLAT, [100, 55, 80, 55, 100, 55, 80, 55]),
    }),
  hats_open: preset('Hats / Open hat',
    'The same noise with a long VCA DECAY and a lower cutoff, on the off-beats - the "and" between kicks.',
    'community', {
      vco1_level: 0, noise_level: 100,
      vcf_mode: 0, vcf_cutoff: 5500, vcf_resonance: 30, vca_decay: 600, volume: 58,
      ...steps(FLAT, [0, 0, 100, 0, 0, 0, 100, 0]),
    }),
  hats_metal: preset('Hats / Metallic hat',
    'Two square waves at an odd ratio, cross-modulated with 1→2 FM and mixed with noise, high-passed: the metallic shimmer of a drum machine hat.',
    'community', {
      vco1_frequency: 2.3, vco1_wave: 0, vco1_level: 80, vco2_frequency: 3.1, vco2_wave: 0, vco2_level: 80,
      fm_amount: 40, noise_level: 55,
      vcf_mode: 0, vcf_cutoff: 3500, vcf_resonance: 30, vca_decay: 220, volume: 94,
      ...steps(FLAT, [100, 60, 85, 60, 100, 60, 85, 70]),
    }),
  hats_shaker: preset('Hats / Shaker',
    'Noise with VCA EG on SLOW: the 100 ms attack swells into each hit like a shaker or brushed snare.',
    'community', {
      vco1_level: 0, noise_level: 85,
      vcf_mode: 0, vcf_cutoff: 4500, vcf_resonance: 15, vca_attack_mode: 1, vca_decay: 90, volume: 56,
      ...steps(FLAT, [70, 40, 100, 40, 70, 40, 100, 45]),
    }),

  // ---------------------------------------------------------------- Toms and hand drums
  toms_fill: preset('Toms / Tom fill',
    'Two slightly detuned triangles with a short pitch drop, tuned down the eight steps - a classic tom run. Turn TEMPO down for a slower fill.',
    'community', {
      ...PITCHED,
      vco1_frequency: -0.5, vco1_eg_amount: 30, vco_decay: 70, vco1_level: 85,
      vco2_frequency: -0.45, vco2_eg_amount: 30, vco2_level: 35,
      vcf_cutoff: 1500, vcf_resonance: 15, vcf_eg_amount: 15, vcf_decay: 100, vca_decay: 350, volume: 82,
      ...steps([st(12), st(12), st(7), st(7), st(3), st(3), 0, st(-5)], [100, 70, 100, 70, 100, 70, 100, 90]),
    }),
  toms_congas: preset('Toms / Congas',
    'A resonant triangle drum with a gentle pitch bend, playing a conga-style pattern on three pitches: the root, a fourth and a fifth above it.',
    'community', {
      ...PITCHED,
      vco1_frequency: 0.8, vco1_eg_amount: 22, vco_decay: 40, vco1_level: 85,
      vcf_cutoff: 1800, vcf_resonance: 35, vcf_eg_amount: 20, vcf_decay: 50, vca_decay: 220, volume: 100,
      ...steps([0, 0, st(7), st(5), 0, st(7), st(7), st(5)], [100, 50, 90, 60, 100, 50, 90, 70]),
    }),
  toms_bongos: preset('Toms / Bongos',
    'Higher and shorter than the congas, alternating two drums a fifth apart.',
    'community', {
      ...PITCHED,
      vco1_frequency: 1.4, vco1_eg_amount: 18, vco_decay: 25, vco1_level: 85,
      vcf_cutoff: 3000, vcf_resonance: 30, vcf_eg_amount: 15, vcf_decay: 40, vca_decay: 150, volume: 100,
      ...steps([0, st(7), 0, st(7), st(7), 0, st(7), 0], [100, 70, 80, 100, 60, 90, 70, 80]),
    }),
  toms_talking: preset('Toms / Vowel drum',
    'The manual\'s "Talking Drum" patch sheet (p.37), knob for knob: a hard-synced square VCO 1 through a low, resonant low-pass, while VCO 2 - patched into VCF MOD - moves the cutoff at audio rate, so each hit sounds like a vowel. The sequencer moves VCO 2 only, so the vowel changes with the PITCH knobs; NOISE / VCF MOD sets how vocal it is, and less RESONANCE gives more thump.',
    'manual', {
      vco_decay: 10, vco1_eg_amount: 41, vco1_frequency: -2.12, vco1_wave: 0, vco1_level: 100,
      vco2_frequency: 2.62, vco2_wave: 0, vco2_level: 0, hard_sync: 0, seq_pitch_mod: 2,
      vcf_cutoff: 155, vcf_resonance: 30, vcf_eg_amount: 29, vcf_decay: 221, noise_vcf_mod: 50, vca_decay: 216, volume: 87, tempo: 94,
      ...steps([st(20), st(20), 0, st(7), st(11), st(20), 0, 0], [100, 67, 66, 100, 67, 66, 100, 67]),
    }, [{ from: 'out_vco2', to: 'in_vcf_mod' }]),
  toms_filter_osc: preset('Toms / Ringing filter toms',
    'The manual\'s "Filter As An Oscillator" patch sheet (p.35), knob for knob: the VCOs are silent, RESONANCE at its maximum makes the filter ring as a sine, the noise excites it, and PITCH patched into VCF MOD tunes each step - a melody played by the filter, with VCA DECAY at its longest so the notes run into each other. Add VCO 2 LEVEL for a watery wobble; NOISE / EXT LEVEL sets how ghostly it is.',
    'manual', {
      vco_decay: 10, vco1_frequency: -5, vco1_level: 0, vco2_frequency: 2.32, vco2_level: 0, noise_level: 100, fm_amount: 50, hard_sync: 0, seq_pitch_mod: 1,
      vcf_cutoff: 153, vcf_resonance: 100, vcf_eg_amount: 21, vcf_decay: 19, noise_vcf_mod: 100, vca_decay: 10000, volume: 88, tempo: 75,
      ...steps([st(-15), 0, st(10), 0, st(-7), st(8), 0, st(10)], FULL),
    }, [{ from: 'out_pitch', to: 'in_vcf_mod' }]),
  toms_rolling: preset('Toms / Rolling toms',
    'The manual\'s "Insane Toms" patch sheet (p.36), knob for knob: VCO 2, slowed far below hearing, is patched into TRIGGER, so it fires extra hits between the sequencer\'s own - the toms roll and stumble - and VCO 2 EG AMOUNT bends that roll with every hit. PITCH patched into VCA DECAY sets how each hit rings out; steps 3 and 6 are silent.',
    'manual', {
      vco_decay: 89, vco1_eg_amount: 29, vco1_frequency: -1.33, vco1_level: 100,
      vco2_frequency: -3.82, vco2_wave: 0, vco2_level: 0, vco2_eg_amount: 21, noise_level: 33,
      vcf_cutoff: 308, vcf_resonance: 0, vcf_eg_amount: 60, vcf_decay: 373, noise_vcf_mod: 20, vca_decay: 316, volume: 50, tempo: 56,
      ...steps([st(40), st(40), st(20), st(31), st(40), st(20), st(40), st(40)], [100, 100, 0, 100, 100, 0, 100, 100]),
    }, [{ from: 'out_vco2', to: 'in_trigger' }, { from: 'out_pitch', to: 'in_vca_decay' }]),

  // ---------------------------------------------------------------- Metal and FM
  metal_fm_toys: preset('Metal / Clanky FM sequence',
    'The manual\'s "FM Toys" patch sheet (p.34), knob for knob: all three mixer knobs are down, so what you hear is the filter itself, ringing at full RESONANCE, while VCO 2 - a high square, patched into VCF MOD at full depth - frequency-modulates its cutoff. The sequencer moves VCO 2, so every step is a different toy. Try VCO 2 FREQUENCY, and the filter in HP.',
    'manual', {
      vco_decay: 10, vco1_frequency: 0, vco1_wave: 1, vco1_level: 0, vco2_frequency: 3.66, vco2_wave: 0, vco2_level: 0, noise_level: 0,
      fm_amount: 0, seq_pitch_mod: 0,
      vcf_cutoff: 153, vcf_resonance: 100, vcf_eg_amount: 100, vcf_decay: 10, noise_vcf_mod: 100, vca_decay: 316, volume: 70, tempo: 71,
      ...steps([st(-40), st(-20), st(-13), st(-15), st(-6), st(-5), 0, 0], FULL),
    }, [{ from: 'out_vco2', to: 'in_vcf_mod' }]),
  metal_chimes: preset('Metal / FM chime melody',
    'The manual\'s "Music Box" patch sheet (p.33), knob for knob: PITCH patched into VCO 1 CV plays VCO 1, which you do not hear; at full 1→2 FM AMOUNT it frequency-modulates the high VCO 2 you do. Small PITCH changes alter the bell tone a lot; try VCO 2 FREQUENCY.',
    'manual', {
      vco_decay: 10, vco1_frequency: 2.54, vco1_level: 0, vco2_frequency: 3.64, vco2_level: 83, fm_amount: 100,
      vcf_cutoff: 1114, vcf_resonance: 0, vcf_eg_amount: 39, vcf_decay: 162, vca_decay: 316, volume: 100, tempo: 139,
      ...steps([st(-20), st(11), st(13), 0, st(12), 0, 0, st(-10)], [83, 83, 83, 83, 100, 100, 83, 83]),
    }, [{ from: 'out_pitch', to: 'in_vco1_cv' }]),
  metal_cowbell: preset('Metal / Cowbell',
    'Two square waves about a fifth apart (like the classic 540 / 800 Hz drum machine bell) through a resonant low-pass.',
    'community', {
      vco1_frequency: 2.05, vco1_wave: 0, vco1_level: 70, vco2_frequency: 2.62, vco2_wave: 0, vco2_level: 70,
      vcf_cutoff: 2500, vcf_resonance: 45, vca_decay: 280, volume: 81,
      ...steps(FLAT, [100, 0, 70, 0, 100, 0, 70, 70]),
    }),
  metal_clang: preset('Metal / FM clang',
    'VCO EG patched into 1→2 FM AMT: the FM depth decays with every hit, so each note starts bright and metallic and settles - a struck metal plate.',
    'community', {
      ...PITCHED,
      vco1_frequency: 0.4, vco2_frequency: 1.15, vco1_level: 30, vco2_level: 95,
      fm_amount: 15, vco_decay: 220, vco1_eg_amount: 10,
      vcf_cutoff: 5000, vcf_resonance: 10, vcf_eg_amount: 30, vcf_decay: 250, vca_decay: 450, volume: 67,
      ...steps([0, 0.6, 0, 1.2, 0, 0.3, 0.9, 0], [100, 70, 90, 70, 100, 70, 90, 80]),
    }, [{ from: 'out_vco_eg', to: 'in_fm_amount' }]),
  metal_sync_bell: preset('Metal / Sync bell',
    'HARD SYNC on and VCO 2 EG AMOUNT sweeping VCO 2: the harmonics slide down on every hit while the pitch stays put - a bright, ringing synthetic bell.',
    'community', {
      ...PITCHED,
      vco1_frequency: 0.5, vco1_level: 20, hard_sync: 0, vco2_frequency: 1.8, vco2_wave: 0, vco2_level: 80, vco2_eg_amount: 35, vco_decay: 300,
      vcf_cutoff: 6000, vcf_eg_amount: 20, vcf_decay: 400, vca_decay: 650, volume: 51,
      ...steps([0, 0, st(7), 0, st(5), 0, st(10), st(12)], [100, 60, 90, 60, 100, 60, 90, 80]),
    }),

  // ---------------------------------------------------------------- Bass
  bass_sequenced: preset('Bass / Soft unison bass',
    'The manual\'s "Sequenced Bass" patch sheet (p.34), knob for knob: two square VCOs tuned together, a low-pass pluck from the VCF EG, and VCA EG on SLOW - the 100 ms attack softens each note like a little glide (p.20). The sheet leaves every PITCH knob at the centre: small turns of them make the bass line.',
    'manual', {
      ...PITCHED,
      vco_decay: 10, vco1_frequency: -1.33, vco1_wave: 0, vco1_level: 67, vco2_frequency: -1.33, vco2_wave: 0, vco2_level: 67,
      vcf_cutoff: 308, vcf_resonance: 30, vcf_eg_amount: 40, vcf_decay: 142, vca_attack_mode: 1, vca_decay: 618, volume: 68, tempo: 99,
      ...steps(FLAT, [100, 83, 100, 83, 100, 83, 100, 83]),
    }),
  bass_acid: preset('Bass / Acid line',
    'Square waves into a high-resonance low-pass with a strong VCF EG: the squelch of acid house. VELOCITY accents open the filter further on loud steps.',
    'community', {
      ...PITCHED,
      vco1_frequency: -1, vco1_wave: 0, vco1_level: 80, vco2_frequency: -0.985, vco2_wave: 0, vco2_level: 35,
      vcf_cutoff: 280, vcf_resonance: 72, vcf_eg_amount: 55, vcf_decay: 170, vca_decay: 260, volume: 83, tempo: 126,
      ...steps([0, 0, st(12), 0, st(3), 0, st(10), st(7)], [100, 55, 90, 55, 100, 55, 85, 70]),
    }),
  bass_accent: preset('Bass / Accent bassline',
    'VELOCITY patched into VCF MOD (NOISE / VCF MOD sets the depth): loud steps are brighter as well as louder, like a real accent.',
    'community', {
      ...PITCHED,
      vco1_frequency: -2, vco1_wave: 0, vco1_level: 85, vco2_frequency: -1.98, vco2_wave: 0, vco2_level: 70,
      vco_decay: 60, vco1_eg_amount: 8, vco2_eg_amount: 8,
      vcf_cutoff: 220, vcf_resonance: 55, vcf_eg_amount: 40, vcf_decay: 180, noise_vcf_mod: 45, vca_decay: 420, volume: 78, tempo: 120,
      ...steps([0, 0, 1, 0, 0.58, 0, 0.83, 0.25], [100, 35, 70, 35, 100, 30, 85, 45]),
    }, [{ from: 'out_velocity', to: 'in_vcf_mod' }]),
  bass_sub: preset('Bass / Rolling sub',
    'A deep triangle with a tiny pitch punch on every 16th except the kick slots - leave room for a separate kick and you have a techno rolling bass.',
    'community', {
      ...PITCHED,
      vco1_frequency: -1.6, vco1_eg_amount: 12, vco_decay: 30, vco1_level: 95,
      vcf_cutoff: 260, vcf_eg_amount: 15, vcf_decay: 60, vca_decay: 160, volume: 100, tempo: 126,
      ...steps([0, 0, 0, st(3), 0, 0, 0, st(5)], [0, 75, 90, 75, 0, 75, 90, 80]),
    }),

  // ---------------------------------------------------------------- FX
  fx_laser: preset('FX / Laser zap',
    'VCO 1 EG AMOUNT fully clockwise with a long VCO DECAY: every hit dives from very high to low - pew.',
    'community', {
      ...PITCHED,
      vco1_frequency: 0.5, vco1_wave: 0, vco1_eg_amount: 100, vco_decay: 350, vco1_level: 75,
      vcf_cutoff: 9000, vcf_resonance: 25, vca_decay: 420, volume: 57,
      ...steps([0, 0, st(5), 0, 0, st(7), 0, st(-5)], [100, 0, 70, 0, 100, 0, 70, 50]),
    }),
  fx_sync_zap: preset('FX / Sync zap',
    'HARD SYNC on and VCO EG patched into VCO 2 CV: a screaming sync sweep on every step.',
    'community', {
      ...PITCHED,
      vco1_frequency: -1, vco1_wave: 0, vco1_level: 0, vco2_frequency: -0.5, vco2_wave: 0, vco2_level: 90, hard_sync: 0, vco_decay: 350,
      vcf_cutoff: 3500, vcf_resonance: 20, vcf_eg_amount: 20, vcf_decay: 300, vca_decay: 400, volume: 46,
      ...steps([0, 0, st(7), 0, st(3), 0, st(10), 0], [100, 60, 90, 60, 100, 60, 90, 70]),
    }, [{ from: 'out_vco_eg', to: 'in_vco2_cv' }]),
  fx_bleeps: preset('FX / Computer bleeps',
    'A bright square wave with a very short VCA DECAY jumping between octaves and fifths - retro computer chatter.',
    'community', {
      ...PITCHED,
      vco1_frequency: 2, vco1_wave: 0, vco1_level: 80,
      vcf_cutoff: 6000, vcf_resonance: 15, vca_decay: 45, volume: 90, tempo: 125,
      ...steps([0, st(12), st(7), st(19), st(5), st(24), st(3), st(15)], [100, 0, 80, 60, 0, 90, 0, 70]),
    }),
  fx_seq_osc: preset('FX / Audio-rate sequencer',
    'The manual\'s "Sequencer As An Oscillator" patch sheet (p.37), knob for knob: VCO 1 clocks ADV / CLOCK, so the sequencer runs at audio rate, and PITCH patched into EXT AUDIO is the sound - the eight PITCH knobs draw one cycle of the waveform. VCO 1 FREQUENCY sets rate and pitch; add VCO 2 LEVEL for wild sounds. Press RUN / STOP to start it.',
    'manual', {
      vco_decay: 12, vco1_frequency: 1.34, vco1_wave: 0, vco1_level: 0, vco2_frequency: 1.27, vco2_wave: 0, vco2_level: 0, noise_level: 100, seq_pitch_mod: 2,
      vcf_cutoff: 20000, vcf_resonance: 0, vcf_decay: 10, noise_vcf_mod: 2, vca_attack_mode: 1, vca_decay: 316, volume: 40, tempo: 76,
      ...steps([st(-60), st(-40), 0, st(20), st(53), st(27), st(-6), st(-34)], FULL),
    }, [{ from: 'out_vco1', to: 'in_adv_clock' }, { from: 'out_pitch', to: 'in_ext_audio' }]),
  fx_lofi: preset('FX / Lo-fi crunch',
    'NOISE / VCF MOD shakes a resonant filter on a kick-and-tom pattern, for the dirty, lo-fi use of noise the manual describes (p.12).',
    'community', {
      ...PITCHED,
      vco1_frequency: -1, vco1_eg_amount: 40, vco_decay: 50, vco1_level: 90, vco2_frequency: -0.3, vco2_level: 30,
      vcf_cutoff: 900, vcf_resonance: 55, vcf_eg_amount: 30, vcf_decay: 90, noise_vcf_mod: 38, vca_decay: 260, volume: 85,
      ...steps([0, 0, st(7), 0, st(12), 0, st(7), st(3)], [100, 40, 80, 40, 100, 40, 80, 60]),
    }),

  // ---------------------------------------------------------------- One-voice loops
  loop_kick_snare: preset('Loop / Kick, snare and FM',
    'The manual\'s "Kick / Snare / FM Osc 2" patch sheet (p.35), knob for knob: PITCH also feeds NOISE LEVEL, so the steps with PITCH fully up bring their own noise - a snare - and the others are kicks; the sequencer moves VCO 2 only, which is hard-synced and frequency-modulated by VCO 1 and colours them. VELOCITY shapes the kick pattern.',
    'manual', {
      vco_decay: 54, vco1_eg_amount: 62, vco1_frequency: -1.46, vco1_level: 100,
      vco2_frequency: 2.23, vco2_eg_amount: 15, vco2_level: 50, fm_amount: 50, hard_sync: 0, seq_pitch_mod: 2,
      vcf_cutoff: 931, vcf_resonance: 0, vcf_eg_amount: 100, vcf_decay: 78, vca_decay: 640, volume: 72, tempo: 86,
      ...steps([0, 5, -5, 0, 0, 0, 5, 0], [67, 50, 100, 100, 40, 62, 83, 100]),
    }, [{ from: 'out_pitch', to: 'in_noise_level' }]),
  loop_techno: preset('Loop / Techno percussion',
    'Accented tom-and-click percussion with NOISE / VCF MOD grit, built to sit on top of a separate four-on-the-floor kick.',
    'community', {
      ...PITCHED,
      vco1_frequency: 0.2, vco1_eg_amount: 50, vco_decay: 22, vco1_level: 90, vco2_frequency: 1.1, vco2_wave: 0, vco2_level: 25,
      noise_level: 20, vcf_cutoff: 2600, vcf_resonance: 35, vcf_eg_amount: 30, vcf_decay: 50, noise_vcf_mod: 10, vca_decay: 200, volume: 100, tempo: 128,
      ...steps([0, st(7), st(12), 0, st(-5), st(7), st(12), st(3)], [0, 60, 100, 50, 0, 70, 100, 55]),
    }),
  loop_pops: preset('Loop / Pop percussion',
    'Square-wave "pops" with a very fast pitch drop, bouncing around a low kick.',
    'community', {
      ...PITCHED,
      vco1_frequency: -0.6, vco1_wave: 0, vco1_eg_amount: 70, vco_decay: 15, vco1_level: 80,
      vcf_cutoff: 3000, vcf_resonance: 25, vcf_eg_amount: 20, vcf_decay: 30, vca_decay: 90, volume: 100, tempo: 118,
      ...steps([st(-12), st(12), st(7), st(19), st(-12), st(14), st(24), st(7)], [100, 60, 75, 50, 90, 65, 80, 55]),
    }),
  loop_noise_hits: preset('Loop / Noise hits',
    'Bursts of noise at changing brightness: PITCH patched into VCF MOD retunes the filter every step.',
    'community', {
      vco1_level: 0, noise_level: 90, seq_pitch_mod: 1,
      vcf_cutoff: 1200, vcf_resonance: 45, vcf_eg_amount: 30, vcf_decay: 80, noise_vcf_mod: 80, vca_decay: 360, volume: 76, tempo: 120,
      ...steps([0, 1.5, -1, 2.2, 0.5, -1.5, 2.8, 1], [100, 0, 70, 90, 0, 60, 100, 40]),
    }, [{ from: 'out_pitch', to: 'in_vcf_mod' }]),
  loop_bounce: preset('Loop / Deep bounce',
    'Deep triangle drums whose pitch sweep changes length every step: PITCH patched into VCO DECAY.',
    'community', {
      vco1_frequency: -1.2, vco1_eg_amount: 38, vco_decay: 60, vco1_level: 90, seq_pitch_mod: 1,
      vcf_cutoff: 1200, vcf_eg_amount: 15, vcf_decay: 120, vca_decay: 380, volume: 79, tempo: 116,
      ...steps([0, -2, 1.5, -2, 0, -1, 2, -2], [100, 50, 85, 50, 100, 55, 90, 60]),
    }, [{ from: 'out_pitch', to: 'in_vco_decay' }]),
  loop_shuffle: preset('Loop / Shuffle',
    'The manual\'s "Swing Time" patch sheet (p.36), knob for knob: PITCH patched into TEMPO, with SEQ PITCH MOD off, so the PITCH knobs set how long each step lasts - lower is longer, and steps 6 and 7, fully up and silent, pass in an instant. Uneven steps give the swung, shuffling groove.',
    'manual', {
      vco_decay: 78, vco1_eg_amount: 41, vco1_frequency: -1.32, vco1_level: 100, vco2_frequency: -1.26, vco2_eg_amount: -20, vco2_level: 34, noise_level: 33, seq_pitch_mod: 1,
      vcf_cutoff: 632, vcf_resonance: 0, vcf_eg_amount: 40, vcf_decay: 432, vca_decay: 1233, volume: 58, tempo: 56,
      ...steps([0, 0, st(14), st(16), st(14), 5, 5, 0], [100, 100, 100, 100, 100, 0, 0, 100]),
    }, [{ from: 'out_pitch', to: 'in_tempo' }]),
};
