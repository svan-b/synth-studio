// ============================================================================
// DFAM presets. Named "Category / Name" - the preset menu groups by category.
//
// Sources (see REFERENCE.md):
//  - "manual": based on the ten patch sheets in the DFAM manual (pp.33-37) and
//    its first walkthrough (pp.8-9), under our own descriptive names. Two sheets
//    (p.33) were legible enough to read the knob positions from; the others are
//    recreations from the sheet notes. Each description cites its page.
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

/** Neutral patch every preset starts from (matches the spec defaults: SEQ PITCH MOD on OFF) */
const INIT: Values = {
  vco_decay: 100, seq_pitch_mod: 1, vco1_eg_amount: 0, vco2_eg_amount: 0,
  vco1_frequency: 0, vco1_wave: 1, fm_amount: 0, hard_sync: 1, vco2_frequency: 0, vco2_wave: 1,
  vco1_level: 75, noise_level: 0, vco2_level: 0,
  vcf_mode: 1, vcf_cutoff: 2000, vcf_resonance: 0, vcf_decay: 300, vcf_eg_amount: 0, noise_vcf_mod: 0,
  vca_attack_mode: 0, vca_decay: 300, volume: 75, tempo: 120,
};

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

function preset(name: string, description: string, source: PresetSpec['source'], settings: Values, patchConnections?: PatchConnection[]): PresetSpec {
  return { name, description, source, settings: { ...INIT, ...steps(FLAT, FULL), ...settings }, ...(patchConnections ? { patchConnections } : {}) };
}

export const DFAM_PRESETS: Record<string, PresetSpec> = {
  init: preset('Init / Default patch',
    'The starting point, close to the default patch in the manual: one triangle VCO into a mostly open low-pass, no envelope modulation, SEQ PITCH MOD off. Press TRIGGER or RUN / STOP and build from here.',
    'factory', {}),

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
      vcf_cutoff: 1800, vcf_resonance: 40, vcf_eg_amount: 30, vcf_decay: 60, vca_decay: 520, volume: 80,
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
    'Settings read from the manual\'s "Quick Hats" patch sheet (p.33): noise through the high-pass filter, PITCH patched into VCA DECAY. Each PITCH knob sets how long its hat rings: low = closed, step 7 high = open. The negative VCF EG gives each hit a soft body.',
    'manual', {
      vco1_frequency: -2.5, vco1_eg_amount: 40, vco_decay: 270, vco1_level: 10, vco2_level: 10, noise_level: 90,
      vcf_mode: 0, vcf_cutoff: 1550, vcf_resonance: 5, vcf_eg_amount: -90, vcf_decay: 320, vca_decay: 320, volume: 66, tempo: 117,
      ...steps([-1.5, -1, -1, -1.5, -1, -1, 1.5, 0], [90, 50, 40, 40, 90, 50, 65, 50]),
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
    'Based on the manual\'s "Talking Drum" patch notes (p.37): VCO 2 patched into VCF MOD moves the cutoff at audio rate, so each hit sounds like a vowel. The sequencer moves VCO 2 only, so the vowel changes every step; NOISE / VCF MOD sets how vocal it is, and less RESONANCE gives more thump.',
    'manual', {
      vco1_frequency: -1, vco1_eg_amount: 20, vco_decay: 60, vco1_level: 80, vco2_level: 0, seq_pitch_mod: 2,
      vcf_cutoff: 630, vcf_resonance: 40, noise_vcf_mod: 100, vca_decay: 300, volume: 100,
      ...steps([0, 0.4, -0.3, 0.8, 0, 0.55, -0.2, 1], [100, 70, 90, 70, 100, 60, 90, 75]),
    }, [{ from: 'out_vco2', to: 'in_vcf_mod' }]),
  toms_filter_osc: preset('Toms / Ringing filter toms',
    'Based on the manual\'s "Filter As An Oscillator" patch notes (p.35): the VCOs are silent, RESONANCE past 3 o\'clock makes the filter ring as a sine, and PITCH patched into VCF MOD tunes each ping - a melody of tuned filter drums. Add VCO 2 LEVEL for a watery wobble, or noise for a ghostly tone.',
    'manual', {
      vco1_level: 0, vco2_level: 0, seq_pitch_mod: 1,
      vcf_cutoff: 450, vcf_resonance: 88, vcf_eg_amount: 40, vcf_decay: 40, noise_vcf_mod: 100, vca_decay: 260, volume: 88,
      ...steps([0, st(3), st(7), st(5), 0, st(10), st(7), st(12)], [100, 70, 85, 70, 100, 70, 85, 90]),
    }, [{ from: 'out_pitch', to: 'in_vcf_mod' }]),
  toms_rolling: preset('Toms / Rolling toms',
    'Based on the manual\'s "Insane Toms" patch notes (p.36): VCO 2, slowed to a dozen cycles a second, clocks ADV / CLOCK, so the toms roll through the pattern; every hit fires the VCO EG, and VCO 2 EG AMOUNT makes the roll stumble and speed up again. PITCH patched into VCA DECAY sets how each hit rings out. Press RUN / STOP to start it.',
    'manual', {
      vco1_frequency: -0.4, vco1_eg_amount: 30, vco_decay: 60, vco1_level: 85,
      vco2_frequency: -3.4, vco2_wave: 0, vco2_level: 0, vco2_eg_amount: -25,
      vcf_cutoff: 1600, vcf_resonance: 20, vcf_eg_amount: 20, vcf_decay: 80, vca_decay: 160, volume: 97,
      ...steps([0, -1, 0.5, -1.5, 1, -1, 0, -2], [100, 60, 85, 55, 100, 70, 90, 60]),
    }, [{ from: 'out_vco2', to: 'in_adv_clock' }, { from: 'out_pitch', to: 'in_vca_decay' }]),

  // ---------------------------------------------------------------- Metal and FM
  metal_fm_toys: preset('Metal / Clanky FM sequence',
    'Based on the manual\'s "FM Toys" patch notes (p.34): 1→2 FM AMOUNT well up with sync off, the sequencer on VCO 2 only, and VCO 2 also patched into VCF MOD so it moves the cutoff. Toy-like metal that changes every step; try VCO 2 FREQUENCY, and the filter in HP.',
    'manual', {
      vco1_frequency: 0.3, vco1_wave: 1, vco1_level: 60, vco2_frequency: 0.9, vco2_wave: 0, vco2_level: 60,
      fm_amount: 70, seq_pitch_mod: 2, vco_decay: 60, vco2_eg_amount: 12,
      vcf_cutoff: 1500, vcf_resonance: 20, vcf_eg_amount: 25, vcf_decay: 120, noise_vcf_mod: 35, vca_decay: 260, volume: 98,
      ...steps([0, st(5), st(-3), st(9), 0, st(14), st(2), st(7)], [100, 70, 85, 70, 100, 60, 90, 75]),
    }, [{ from: 'out_vco2', to: 'in_vcf_mod' }]),
  metal_chimes: preset('Metal / FM chime melody',
    'Settings read from the manual\'s "Music Box" patch sheet (p.33): PITCH patched into VCO 1 CV plays VCO 1, which frequency-modulates the high VCO 2 you hear at almost full 1→2 FM AMOUNT. Small PITCH changes alter the bell tone a lot; try VCO 2 FREQUENCY.',
    'manual', {
      vco1_frequency: 2.5, vco1_level: 10, vco2_frequency: 3.5, vco2_level: 80, fm_amount: 93, vco_decay: 15,
      vcf_cutoff: 1770, vcf_resonance: 5, vcf_eg_amount: 47, vcf_decay: 110, vca_decay: 320, volume: 100, tempo: 83,
      ...steps([-1.5, 1, 1, 0, 1.5, 0, 0, -1], [80, 80, 80, 80, 90, 90, 80, 80]),
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
    'Based on the manual\'s "Sequenced Bass" patch notes (p.34): both VCOs tuned together by ear (a few cents apart, so they beat slowly), a low-pass pluck from the VCF EG, and VCA EG on SLOW - the 100 ms attack softens each note like a little glide (p.20). PITCH 1-8 are the notes.',
    'manual', {
      ...PITCHED,
      vco1_frequency: -1, vco1_level: 75, vco2_frequency: -0.994, vco2_level: 60,
      vcf_cutoff: 400, vcf_resonance: 30, vcf_eg_amount: 40, vcf_decay: 200, vca_attack_mode: 1, vca_decay: 320, volume: 80,
      ...steps([0, 0, st(12), 0, st(7), 0, st(10), st(3)], [100, 80, 90, 80, 100, 80, 90, 85]),
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
    'Based on the manual\'s "Sequencer As An Oscillator" patch notes (p.37): VCO 1 clocks ADV / CLOCK, so the sequencer steps at audio rate and repeats its 8 steps 65 times a second, and PITCH patched into EXT AUDIO is the sound - the PITCH knobs draw the waveform. VCO 1 FREQUENCY sets rate and pitch; add VCO 2 LEVEL for wild sounds. Press RUN / STOP to start it.',
    'manual', {
      vco1_frequency: 2, vco1_wave: 0, vco1_level: 0, vco2_level: 0, noise_level: 70,
      vcf_cutoff: 4000, vcf_resonance: 10, vca_decay: 300, volume: 63,
      ...steps([0, st(24), st(42), st(24), 0, st(-24), st(-42), st(-24)], FULL),
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
    'Based on the manual\'s "Kick / Snare / FM Osc 2" patch notes (p.35): PITCH also feeds NOISE LEVEL, so low steps are clean kicks and high steps bring their own noise - a snare - while VCO 2, frequency-modulated by VCO 1, colours them. VELOCITY shapes the kick pattern.',
    'manual', {
      ...PITCHED,
      vco1_frequency: -1.4, vco1_eg_amount: 45, vco_decay: 45, vco1_level: 90,
      vco2_frequency: -0.9, vco2_level: 30, fm_amount: 30,
      vcf_cutoff: 3500, vcf_eg_amount: 20, vcf_decay: 60, vca_decay: 220, volume: 94,
      ...steps([0, 0, 0, 0, 2.5, 0, 0, 2.5], [100, 0, 55, 0, 100, 0, 70, 40]),
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
    'Based on the manual\'s "Swing Time" patch notes (p.36): PITCH patched into TEMPO, with SEQ PITCH MOD off, so the PITCH knobs set how long each step lasts - lower is longer. Alternating long and short steps gives a swung, shuffling groove.',
    'manual', {
      vco1_level: 30, vco1_frequency: 1, vco1_eg_amount: 30, vco_decay: 20, noise_level: 80, seq_pitch_mod: 1,
      vcf_mode: 0, vcf_cutoff: 3000, vcf_resonance: 30, vca_decay: 130, volume: 84, tempo: 110,
      ...steps([-0.4, 0.4, -0.4, 0.4, -0.4, 0.4, -0.4, 0.4], [100, 55, 80, 55, 100, 55, 80, 65]),
    }, [{ from: 'out_pitch', to: 'in_tempo' }]),
};
