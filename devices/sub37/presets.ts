// ============================================================================
// Sub 37 presets: 16 banks x 16 on the hardware (p.12); the twin fills banks 1-4.
//   Bank 1     a tour: the Moog bass family, classic leads, DUO, pads, arp, pluck, FX
//   Banks 2-4  recreations of the Sub 37 factory presets in factory order, then the
//              remaining Synth Studio originals
// Moog publishes the factory preset names and categories (the Sub 37 Factory Presets
// list) but not their settings, so every recreation is our own programming of the
// character its name and category describe. Each one has a descriptive name and
// cites the factory preset in its description. Names are "Category / Name" with the
// factory categories. Generated from the research tables, then levelled with the
// audio QA tool (scripts/audio-qa.cjs --target -18): PRESET VOL brings each preset to
// -18 LUFS at the instrument output (FX -22, drones -21) with true peaks below -1 dBTP;
// the quietest plucks, percussion and fast arpeggios got more mixer level, drive or
// sustain instead, and the pads release within about 2 s.
// ============================================================================

import type { PresetSpec } from '@/types';
import { buildSeq } from './model';

type Settings = PresetSpec['settings'];

const preset = (name: string, description: string, bank: number, slot: number, settings: Settings, source: PresetSpec['source'] = 'community'): PresetSpec => ({
  name, description, source, author: 'Synth Studio', settings: { ...settings, preset_bank: bank, preset_number: slot },
});

export const SUB37_PRESETS: Record<string, PresetSpec> = {
  three_osc_mono_bass: preset("Bass / Three-Osc Mono Bass", "A classic 70s three-oscillator mono bass in the Minimoog style. Two 16' saws a hair apart, with the sub standing in for the third oscillator. The mixer is pushed past unity into the ladder. FDBK recreates the old \"output into the external input\" feedback trick. KB TRACK 0.33 matches that instrument's 1/3 keyboard-control setting. KB PRIORITY LOW and single trigger give the low-note-wins feel. Synth Studio original: a classic Moog technique. Play: 70s funk and prog basslines, MIDI 36–60. Hold a note and tap a higher one: the low note wins.", 1, 1, {
    preset_volume: 44.5, osc1_octave: 0, osc2_octave: 0, osc2_frequency: -0.08, mix_osc1: 80, mix_sub: 40,
    mix_osc2: 70, mix_feedback: 25,
    cutoff: 260, resonance: 20, multidrive: 20, filter_eg_amt: 60, filter_kb_amt: 33, feg_attack: 2, feg_decay: 350,
    feg_sustain: 30, feg_release: 200, aeg_decay: 600, aeg_sustain: 90, aeg_release: 120, mod1_pitch_amt: 6,
    key_priority: 1,
  }),
  deep_round_bass: preset("Bass / Deep Round Bass", "A deep, round, hollow bass: square plus triangle plus sub with barely any filter movement. Recreation of the Sub 37 factory preset “LOW BASS” (bank 5, preset 6, BASS); Moog's own settings are not published, so these are ours. Play: Long low notes and root–fifth lines; sits under a kick without fighting it.", 1, 2, {
    preset_volume: 53.4, osc1_octave: 0, osc1_wave: 67, osc2_octave: 0, osc2_wave: 0, mix_sub: 80, mix_osc2: 40,
    cutoff: 220,
    resonance: 15, multidrive: 15, filter_eg_amt: 40, filter_kb_amt: 50, feg_attack: 2, feg_sustain: 30,
    feg_release: 200, aeg_attack: 2, aeg_decay: 800, aeg_sustain: 90, aeg_release: 150,
  }),
  sub_bass: preset("Bass / Sub Bass", "A sub-oscillator-led sub bass: a near-sine fundamental with just a touch of drive for audibility on small speakers. Recreation of the Sub 37 factory preset “sub BASS” (bank 6, preset 7, BASS); Moog's own settings are not published, so these are ours. Play: Single sustained notes in the middle keys (MIDI 48–60); the sub sounds an octave below the 16' oscillator.", 1, 3, {
    preset_volume: 49.7, osc1_octave: 0, osc1_wave: 0, mix_osc1: 40, mix_sub: 90, cutoff: 160, resonance: 5,
    multidrive: 25,
    filter_eg_amt: 20, filter_kb_amt: 0, feg_attack: 2, feg_decay: 250, feg_sustain: 40, feg_release: 150,
    aeg_attack: 3, aeg_decay: 900, aeg_release: 120,
  }),
  pedal_bass: preset("Bass / Pedal Bass", "A bass-pedal sound in the style of the Taurus: two fat 16' saws plus a loud sub, a slow-ish filter bloom, notes that ring, and glide between them. Synth Studio original: a classic Moog technique. Play: One finger: whole and half notes on the lowest keys (MIDI 36–48), as if with your feet; let notes ring under chords.", 1, 4, {
    preset_volume: 62, osc1_octave: 0, osc2_octave: 0, beat_freq: 0.4, osc2_frequency: 0.12, mix_osc1: 70,
    mix_sub: 80, mix_osc2: 60,
    cutoff: 180, resonance: 25, multidrive: 30, filter_eg_amt: 70, filter_kb_amt: 0, feg_attack: 30, feg_decay: 700,
    feg_sustain: 20, feg_release: 800, aeg_attack: 15, aeg_decay: 1500, aeg_sustain: 80, aeg_release: 900,
    glide_on: true, glide_time: 67.4, glide_type: 1, glide_legato: true,
  }),
  acid_line: preset("Sequence / Acid Line", "A classic acid line using Moog's own Quickstart tip (legato glide, EXP, GLIDE TIME 2): one saw, RESONANCE 7 just below self-oscillation, an 18 dB slope, a short decay, single-trigger envelopes. Tied steps slide without retriggering (manual p.17). Synth Studio original: a classic Moog technique. Play: Run the 16-step sequence (PATTERN SEQ); ride CUTOFF, EG AMT and RESONANCE.", 1, 5, {
    preset_volume: 61.4, mix_osc1: 70, cutoff: 450, resonance: 70, multidrive: 40, filter_slope: 2, filter_eg_amt: 70,
    feg_decay: 180,
    feg_sustain: 0, feg_release: 120, feg_vel_amt: 50, aeg_decay: 250, aeg_sustain: 80, aeg_release: 60,
    glide_on: true, glide_type: 2, glide_legato: true, arp_on: true, arp_sync: true, arp_pattern: 4, arp_latch: true,
    ...buildSeq([36, '.', 48, { n: 36, tie: true }, 39, 36, 34, { n: 36, tie: true }, '.', 43, { n: 31, tie: true }, 48, 34, 36, { n: 39, tie: true }, 41]),
  }),
  wobble_bass: preset("Bass / Wobble Bass", "A clock-synced wobble: a MOD 2 triangle at 1/8 on the cutoff of a resonant, driven bass with a heavy sub; the wheel adds a 1/16 square layer (MOD 1). Synth Studio original: a classic Moog technique. ARP SYNC is lit (the arpeggiator stays off), so both LFOs follow the studio tempo and lock to the beat while ▶ runs. Play: Hold long notes and change MOD 2's division each bar (1/8, 1/16, 1/8 T).", 1, 6, {
    preset_volume: 51.6, osc1_octave: 0, osc2_octave: 0, osc2_wave: 67, osc2_frequency: -0.1, mix_osc1: 80,
    mix_sub: 80, mix_osc2: 70,
    mix_feedback: 30, cutoff: 200, resonance: 45, multidrive: 65, filter_eg_amt: 10, filter_kb_amt: 30, aeg_attack: 2,
    aeg_decay: 1000, aeg_release: 150, mod1_source: 1, mod1_sync: true, mod1_div: 16, mod1_filter_amt: 40,
    mod2_sync: true, mod2_div: 13, mod2_kb_reset: true, mod2_filter_amt: 60, arp_sync: true,
  }),
  vintage_saw_lead: preset("Lead / Vintage Saw Lead", "A 70s solo lead in the Minimoog manner: two detuned saws driving the ladder, medium decay, exponential glide. Recreation of the Sub 37 factory preset “OLD LEAD” (bank 5, preset 8, LEAD); Moog's own settings are not published, so these are ours. Play: 70s-style solos with glide between notes and vibrato from the wheel.", 1, 7, {
    preset_volume: 50.4, osc2_frequency: -0.1, mix_osc1: 65, mix_osc2: 65, cutoff: 1400, resonance: 30,
    multidrive: 20, filter_eg_amt: 40,
    filter_kb_amt: 80, feg_attack: 10, feg_decay: 600, feg_sustain: 50, feg_release: 300, aeg_attack: 4,
    aeg_decay: 500, aeg_sustain: 90, aeg_release: 250, mod1_rate: 5.5, mod1_pitch_amt: 7, glide_on: true,
    glide_type: 2,
  }),
  sync_scream: preset("Sync / Sync Scream", "The textbook hard-sync lead: OSC 2 slaved to OSC 1, its pitch swept down by the Filter EG through MOD 2, so every note tears open and settles. Synth Studio original: a classic Moog technique. Play: Detached notes scream; legato notes stay smooth (MULTI TRIG off).", 1, 8, {
    preset_volume: 41.2, hard_sync: true, osc2_frequency: 3, mix_osc1: 20, mix_osc2: 90, cutoff: 2600, resonance: 10,
    multidrive: 40,
    filter_eg_amt: 30, feg_decay: 700, feg_sustain: 30, feg_release: 400, aeg_attack: 2, aeg_decay: 600,
    aeg_sustain: 90, aeg_release: 300, mod1_rate: 5.5, mod1_pitch_amt: 7, mod2_source: 5, mod2_pitch_amt: 80,
    mod2_pitch_dest: 2, glide_on: true, glide_time: 37.1, glide_type: 1, glide_legato: true,
  }),
  theremin_lead: preset("Lead / Theremin Lead", "A theremin imitation: a near-sine (filtered triangle), slow exponential glide on every note, constant gentle vibrato plus wheel vibrato, and bend ±12. Recreation of the Sub 37 factory preset “Lyrical Theremin” (bank 3, preset 2, LEAD); Moog's own settings are not published, so these are ours. Play: Slow, singing lines; let every note swoop into the next.", 1, 9, {
    preset_volume: 63.9, osc1_wave: 0, mix_osc1: 70, cutoff: 900, filter_slope: 1, aeg_attack: 80, aeg_decay: 400,
    aeg_release: 600,
    mod1_rate: 6, mod1_pitch_amt: 10, mod2_rate: 5.2, mod2_pitch_amt: 8, glide_on: true, glide_time: 223.2,
    glide_type: 2, bend_up: 12, bend_down: 12,
  }),
  duo_tape_tones: preset("Duo / Duo Tape Tones", "Two-voice tape-machine tones (the \"-tron\" family): a soft saw/square blend, a little tape hiss and slow pitch wow. Recreation of the Sub 37 factory preset “Duotronic Moogtrons” (bank 1, preset 4, DUO); Moog's own settings are not published, so these are ours. Play: Hold a low note and move the upper note against it (oblique motion), slowly.", 1, 10, {
    preset_volume: 76.5, osc1_wave: 45, osc2_wave: 45, beat_freq: 0.6, duo_mode: true, mix_osc2: 50, mix_noise: 8,
    cutoff: 1300,
    resonance: 5, filter_slope: 1, filter_eg_amt: 16, feg_attack: 150, feg_decay: 1200, feg_sustain: 60,
    feg_release: 800, aeg_attack: 120, aeg_decay: 1500, aeg_sustain: 90, aeg_release: 900, mod1_rate: 6,
    mod1_pitch_amt: 4, mod2_rate: 0.4, mod2_pitch_amt: 5,
  }),
  gritty_organ: preset("Organs / Gritty Organ", "A gritty two-voice organ: square plus pulse, the sub as the 16' drawbar, FDBK like an overdriven amp, and a wheel tremolo (MOD 1 to VCA LEVEL). Recreation of the Sub 37 factory preset “ORGAN GRINDER” (bank 6, preset 11, ORGANS); Moog's own settings are not published, so these are ours. Play: Two-note stabs on the 16th before each beat (DUO); push the wheel for a fast rotary-style tremolo.", 1, 11, {
    preset_volume: 33.8, osc1_wave: 67, osc2_wave: 90, kb_reset: true, duo_mode: true, mix_osc1: 60, mix_sub: 30,
    mix_osc2: 60,
    mix_feedback: 15, cutoff: 3500, multidrive: 35, filter_slope: 1, filter_eg_amt: 20, feg_decay: 80,
    feg_sustain: 80, feg_release: 60, feg_multi_trig: true, aeg_attack: 2, aeg_decay: 200, aeg_release: 40,
    aeg_multi_trig: true, mod1_rate: 6.5, mod1_pitch_amt: 2.4, mod1_mod_amt: 30,
  }),
  airy_duo_pad: preset("Pads / Airy Duo Pad", "An airy two-voice pad: BEAT FREQ shimmer, pink-noise air and a slow wave-shape LFO. Recreation of the Sub 37 factory preset “CELESTIAL” (bank 2, preset 5, PADS); Moog's own settings are not published, so these are ours. Play: Hold two notes (DUO): an octave closing to a third over four chords.", 1, 12, {
    preset_volume: 100, beat_freq: 1, duo_mode: true, mix_osc2: 50, mix_noise: 10, cutoff: 900, resonance: 20,
    multidrive: 5,
    filter_slope: 1, filter_eg_amt: 30, filter_kb_amt: 80, feg_attack: 1500, feg_decay: 3000, feg_sustain: 60,
    feg_release: 2500, aeg_attack: 1200, aeg_decay: 2000, aeg_sustain: 90, aeg_release: 2000, mod1_pitch_amt: 4,
    mod2_rate: 0.25, mod2_filter_amt: 8, mod2_dest: 3, mod2_mod_amt: 20,
  }),
  string_machine: preset("Strings / String Machine", "A 70s string-machine ensemble: two wave-modulated squares (PWM), slow attack, two voices. Recreation of the Sub 37 factory preset “STRINGOTRON” (bank 1, preset 13, STRINGS); Moog's own settings are not published, so these are ours. Play: Two-note string lines (octaves, thirds, sixths).", 1, 13, {
    preset_volume: 70.3, osc1_wave: 70, osc2_wave: 64, beat_freq: 0.8, duo_mode: true, mix_osc2: 50, cutoff: 2200,
    resonance: 5,
    filter_slope: 1, filter_eg_amt: 10, feg_attack: 400, feg_decay: 1000, feg_sustain: 80, feg_release: 900,
    aeg_attack: 350, aeg_decay: 1000, aeg_sustain: 90, aeg_release: 1200, mod1_rate: 5.5, mod1_pitch_amt: 4,
    mod2_rate: 0.6, mod2_dest: 3, mod2_mod_amt: 30,
  }),
  chip_arp_8bit: preset("Classic / 8-Bit Chip Arp", "A video-game chip sound: a narrow pulse at 4' with the filter wide open, and a fast UP arpeggio that turns any held chord into a chiptune arpeggio. Short gate. Recreation of the Sub 37 factory preset “Gamecom 8Bit Chiptime Fun” (bank 1, preset 15, CLASSIC); Moog's own settings are not published, so these are ours. Play: Hold a three- or four-note chord; change chords on the beat.", 1, 14, {
    preset_volume: 73.1, osc1_octave: 2, osc1_wave: 85, mix_osc1: 60, aeg_decay: 100, aeg_sustain: 80,
    aeg_release: 30, arp_on: true,
    arp_sync: true, arp_div: 18, arp_gate: 60,
  }),
  round_pluck: preset("Classic / Round Pluck", "A short, round pluck: filter and amp both decay with no sustain, and KB TRACK 1.2 keeps high notes bright. Synth Studio original: a classic Moog technique. Play: Arpeggios, staccato two-note chords (DUO) and melodies.", 1, 15, {
    preset_volume: 97.7, multidrive: 20, osc2_wave: 67, kb_reset: true, duo_mode: true, osc2_frequency: 0.06,
    mix_osc1: 85, mix_osc2: 60, cutoff: 380,
    resonance: 25, filter_eg_amt: 70, filter_kb_amt: 120, feg_decay: 220, feg_sustain: 0, feg_release: 220,
    feg_vel_amt: 50, feg_multi_trig: true, aeg_decay: 650, aeg_sustain: 12, aeg_release: 400, aeg_vel_amt: 30,
    aeg_multi_trig: true,
  }),
  synth_gong: preset("Percussion / Synth Gong", "A metallic gong: audio-rate FM (MOD 2 HI RANGE at 173 Hz) on OSC 1, plus a tritone OSC 2 and a seven-second decay. Recreation of the Sub 37 factory preset “SYNTH GONG1” (bank 7, preset 10, PERCUSSION); Moog's own settings are not published, so these are ours. Play: Single strikes on low-mid keys; leave room for each to ring.", 1, 16, {
    preset_volume: 99.7, osc1_wave: 0, osc2_octave: 2, osc2_wave: 67, osc2_frequency: 6, mix_osc1: 70, mix_osc2: 40,
    mix_noise: 10,
    cutoff: 1800, resonance: 20, filter_slope: 1, filter_eg_amt: 40, filter_kb_amt: 50, feg_decay: 4000,
    feg_sustain: 0, feg_release: 4000, feg_vel_amt: 50, feg_multi_trig: true, feg_reset: true, aeg_decay: 7000,
    aeg_sustain: 0, aeg_release: 2800, aeg_vel_amt: 50, aeg_multi_trig: true, aeg_reset: true, mod2_rate: 17.3,
    mod2_hi_range: true, mod2_pitch_amt: 40, mod2_pitch_dest: 1,
  }),
  rhythmic_fifth_filter: preset("Duo / Rhythmic Fifth Filter", "Rhythmic fifths: a clock-synced square LFO gates the brightness of a resonant fifth in eighth notes. In DUO, one key gives a power fifth and two keys spread the voicing. Recreation of the Sub 37 factory preset “Rhythmic 5th Filtration” (bank 1, preset 1, DUO); Moog's own settings are not published, so these are ours. ARP SYNC is lit, so the LFO follows the studio tempo. Play: Hold one or two keys; set the studio tempo. MOD 2 KB RESET puts each new note on the beat.", 2, 1, {
    preset_volume: 100, duo_mode: true, osc2_frequency: 7, mix_osc1: 60, mix_sub: 20, mix_osc2: 50, cutoff: 400,
    resonance: 55,
    filter_eg_amt: 20, filter_kb_amt: 80, feg_attack: 5, feg_sustain: 50, feg_release: 300, aeg_attack: 5,
    aeg_decay: 500, aeg_release: 300, mod2_source: 1, mod2_sync: true, mod2_div: 13, mod2_kb_reset: true,
    mod2_filter_amt: 50, arp_sync: true,
  }),
  dark_pad: preset("Pads / Dark Pad", "A dark, slow pad: detuned low saws behind a closed 24 dB filter that opens slowly, with a very slow filter LFO. Recreation of the Sub 37 factory preset “DARK MINDS” (bank 1, preset 2, PADS); Moog's own settings are not published, so these are ours. Play: Hold low notes for bars at a time; minor keys.", 2, 2, {
    preset_volume: 100, osc1_octave: 0, beat_freq: 0.8, mix_sub: 20, mix_osc2: 50, mix_noise: 5, cutoff: 260,
    resonance: 30,
    multidrive: 10, filter_eg_amt: 40, filter_kb_amt: 50, feg_attack: 2500, feg_decay: 4000, feg_sustain: 40,
    feg_release: 3000, aeg_attack: 1500, aeg_decay: 2000, aeg_release: 1900, mod2_rate: 0.12, mod2_filter_amt: 16,
  }),
  ticking_boom_bass: preset("Bass / Ticking Boom Bass", "A boomy sub-heavy bass with a click (\"tick\") on every note: KB RESET makes the attack identical each time, and a 15 ms filter-envelope blip adds the tick. Recreation of the Sub 37 factory preset “Bomb Bass Tick” (bank 1, preset 3, BASS); Moog's own settings are not published, so these are ours. Play: Short notes on the beat or the off-beat, MIDI 36–55. Leave space; it booms.", 2, 3, {
    preset_volume: 100, osc1_octave: 0, osc1_wave: 40, osc2_octave: 0, osc2_wave: 0, kb_reset: true, mix_osc1: 60,
    mix_sub: 80,
    mix_osc2: 50, cutoff: 200, resonance: 10, multidrive: 25, filter_eg_amt: 80, filter_kb_amt: 50, feg_decay: 15,
    feg_sustain: 0, feg_release: 40, feg_multi_trig: true, feg_reset: true, aeg_decay: 1000, aeg_sustain: 0,
    aeg_release: 250, aeg_multi_trig: true,
  }),
  bright_pwm_keys: preset("Classic / Bright PWM Keys", "A classic bright PWM sound: both oscillators near square with MOD 2 sweeping their width, the filter open, two voices. Recreation of the Sub 37 factory preset “BRIGHT PWM MOTION” (bank 1, preset 5, CLASSIC); Moog's own settings are not published, so these are ours. Play: Chordal two-note parts and riffs; the motion makes long notes shimmer.", 2, 4, {
    preset_volume: 76.4, osc1_wave: 72, osc2_wave: 78, beat_freq: 0.7, duo_mode: true, mix_osc2: 50, cutoff: 4500,
    resonance: 10,
    filter_slope: 1, filter_eg_amt: 20, feg_attack: 5, feg_decay: 600, feg_sustain: 70, feg_release: 400,
    aeg_attack: 5, aeg_decay: 600, aeg_sustain: 90, aeg_release: 400, mod2_rate: 1.2, mod2_dest: 3, mod2_mod_amt: 40,
  }),
  octave_bloom: preset("Evolving / Octave Bloom", "An evolving octave texture: OSC 2 an octave up with a slowly morphing wave, under a looping Filter EG (a 6-second multistage LFO). Recreation of the Sub 37 factory preset “Octavia” (bank 1, preset 7, EVOLVING); Moog's own settings are not published, so these are ours. Play: Hold one note; the octave above blooms and recedes by itself.", 2, 5, {
    preset_volume: 97.9, osc2_octave: 2, osc2_wave: 67, beat_freq: 0.5, mix_osc2: 50, cutoff: 500, resonance: 35,
    filter_eg_amt: 50,
    filter_kb_amt: 70, feg_attack: 1500, feg_decay: 2500, feg_sustain: 0, feg_release: 2000, feg_loop: true,
    aeg_attack: 400, aeg_decay: 1500, aeg_release: 2000, mod2_rate: 0.2, mod2_dest: 4, mod2_mod_amt: 40,
  }),
  robot_workers_duo: preset("Duo / Robot Workers Duo", "Robotic electro in the Düsseldorf manner: two square voices, short envelopes and a clock-synced UP arpeggio. In DUO each held pair arpeggiates. Recreation of the Sub 37 factory preset “Werkers Unite” (bank 1, preset 12, DUO); Moog's own settings are not published, so these are ours. Play: Hold two-note shapes and change them every bar; strictly on the grid.", 2, 6, {
    preset_volume: 90.2, mix_osc1: 70, osc1_wave: 67, osc2_wave: 67, duo_mode: true, osc2_frequency: -5, mix_sub: 20,
    mix_osc2: 60, cutoff: 1400,
    resonance: 25, filter_slope: 1, filter_eg_amt: 40, feg_decay: 120, feg_sustain: 10, feg_release: 80,
    feg_multi_trig: true, aeg_decay: 160, aeg_sustain: 45, aeg_release: 60, aeg_multi_trig: true, arp_on: true,
    arp_sync: true, arp_oct_range: 4, arp_gate: 55,
  }),
  pulse_wave_bass: preset("Bass / Pulse-Wave Bass", "A hollow, moving square-pulse bass: MOD 2 slowly sweeps both wave shapes (pulse-width movement) under a medium filter pluck. Recreation of the Sub 37 factory preset “Pulse Bass” (bank 1, preset 14, BASS); Moog's own settings are not published, so these are ours. Play: Driving eighth-note lines; the slow PWM keeps long notes alive.", 2, 7, {
    preset_volume: 48.7, osc1_octave: 0, osc1_wave: 72, osc2_octave: 0, osc2_wave: 80, beat_freq: 0.6, mix_osc1: 60,
    mix_sub: 40,
    mix_osc2: 60, cutoff: 330, resonance: 20, multidrive: 20, filter_eg_amt: 60, filter_kb_amt: 50, feg_decay: 260,
    feg_sustain: 20, feg_release: 150, aeg_decay: 600, aeg_sustain: 90, aeg_release: 120, mod2_rate: 0.7,
    mod2_dest: 3, mod2_mod_amt: 30,
  }),
  duo_organ: preset("Duo / Duo Organ", "A clean two-voice organ: square-ish waves plus sub, an instant on/off envelope, wheel vibrato. Recreation of the Sub 37 factory preset “DUO ORG” (bank 2, preset 3, DUO); Moog's own settings are not published, so these are ours. Play: Sustained two-note voicings moving in parallel thirds or sixths.", 2, 8, {
    preset_volume: 41.1, osc1_wave: 55, osc2_wave: 55, duo_mode: true, mix_sub: 40, mix_osc2: 50, cutoff: 2000,
    multidrive: 10,
    filter_slope: 1, aeg_attack: 3, aeg_decay: 100, aeg_release: 80, mod1_rate: 6, mod1_pitch_amt: 3,
  }),
  clean_organ: preset("Organs / Clean Organ", "A clean drawbar-style organ: square at 8' plus an octave-up square, the sub as the 16' foot, an instant on/off envelope and wheel vibrato. Recreation of the Sub 37 factory preset “Organ 2” (bank 2, preset 4, ORGANS); Moog's own settings are not published, so these are ours. Play: Sustained chords as single lines or held notes (mono); a slight vibrato on the wheel.", 2, 9, {
    preset_volume: 54.7, osc1_wave: 67, osc2_octave: 2, osc2_wave: 67, mix_sub: 30, mix_osc2: 40, cutoff: 4000,
    filter_slope: 1,
    aeg_attack: 3, aeg_decay: 100, aeg_release: 60, mod1_rate: 6.5, mod1_pitch_amt: 3,
  }),
  space_chatter_pad: preset("Pads / Space Chatter Pad", "A sci-fi space pad: sample and hold on a resonant filter, noise, and a fifth an octave up. Recreation of the Sub 37 factory preset “2D SPACE” (bank 2, preset 8, PADS); Moog's own settings are not published, so these are ours. Play: Sparse notes; let the random filter steps chatter.", 2, 10, {
    preset_volume: 100, osc1_wave: 0, osc2_octave: 2, osc2_frequency: 7, mix_osc2: 30, mix_noise: 20, cutoff: 1200,
    resonance: 60,
    filter_slope: 1, filter_eg_amt: 20, feg_attack: 800, feg_decay: 2000, feg_sustain: 60, feg_release: 2500,
    aeg_attack: 600, aeg_decay: 2000, aeg_sustain: 90, aeg_release: 1900, mod1_rate: 0.3, mod1_pitch_amt: 6,
    mod1_pitch_dest: 2, mod2_source: 4, mod2_rate: 4, mod2_filter_amt: 30,
  }),
  cold_wind: preset("Noise / Cold Wind", "A wintry wind: pink noise only, through a resonant 12 dB filter that a slow triangle LFO sweeps like gusts. Recreation of the Sub 37 factory preset “COLD NOISE” (bank 2, preset 10, NOISE); Moog's own settings are not published, so these are ours. Play: Hold a key for wind; higher keys whistle more (KB TRACK 1.0).", 2, 11, {
    preset_volume: 58.7, mix_osc1: 0, mix_noise: 80, cutoff: 800, resonance: 60, filter_slope: 1, filter_eg_amt: 20,
    feg_attack: 800,
    feg_decay: 2000, feg_sustain: 60, feg_release: 2000, aeg_attack: 600, aeg_decay: 1000, aeg_release: 2000,
    mod2_rate: 0.15, mod2_filter_amt: 30,
  }),
  pressure_sparkle_lead: preset("Lead / Pressure Sparkle Lead", "A soft lead that sparkles when you press into the keys: aftertouch scales a fast wave-shape wobble on the octave-up OSC 2 (MOD 2 depth from AFTERTOUCH). Recreation of the Sub 37 factory preset “SOFT PRESS 4 SPARKLE” (bank 2, preset 12, LEAD); Moog's own settings are not published, so these are ours. On the hardware the depth comes from aftertouch; the twin’s keys have no pressure, so the MOD wheel stands in. Play: Play softly, then lean into long notes for the sparkle.", 2, 12, {
    preset_volume: 100, osc1_wave: 0, osc2_octave: 2, osc2_wave: 67, mix_osc2: 30, cutoff: 2000, resonance: 10,
    filter_slope: 1,
    filter_eg_amt: 10, feg_attack: 60, feg_decay: 900, feg_sustain: 70, feg_release: 500, aeg_attack: 40,
    aeg_decay: 800, aeg_sustain: 90, aeg_release: 500, mod2_rate: 6, mod2_dest: 4, mod2_mod_amt: 40, mod2_wheel: 100,
  }),
  percussive_dub_bass: preset("Bass / Percussive Dub Bass", "A short, round dub bass: sub and triangle, a quick downward pitch \"thump\" from the Filter EG through MOD 2, and a dark 24 dB filter. Recreation of the Sub 37 factory preset “PERCUSS DUB” (bank 3, preset 4, BASS); Moog's own settings are not published, so these are ours. Play: Dub and reggae lines on the off-beats, MIDI 36–52; let the space between notes do the work.", 2, 13, {
    preset_volume: 100, osc1_octave: 0, osc1_wave: 0, osc2_octave: 0, osc2_wave: 67, kb_reset: true, mix_osc1: 70,
    mix_sub: 70,
    mix_osc2: 30, cutoff: 200, resonance: 15, multidrive: 20, filter_eg_amt: 40, filter_kb_amt: 30, feg_decay: 90,
    feg_sustain: 0, feg_release: 80, feg_multi_trig: true, feg_reset: true, aeg_decay: 500, aeg_sustain: 40,
    aeg_release: 150, aeg_multi_trig: true, mod2_source: 5, mod2_pitch_amt: 36,
  }),
  duo_wave_motion: preset("Duo / Duo Wave Motion", "Two voices whose wave shapes drift independently: MOD 2 morphs OSC 1, and MOD 1 (on the wheel) morphs OSC 2. Recreation of the Sub 37 factory preset “DUO WAVE MOD” (bank 3, preset 5, DUO); Moog's own settings are not published, so these are ours. Play: Two notes rising together, the gap opening from a third to an octave; push the wheel to animate the upper voice.", 2, 14, {
    preset_volume: 87.1, osc1_wave: 40, osc2_wave: 70, duo_mode: true, mix_osc2: 50, cutoff: 1600, resonance: 15,
    filter_slope: 1,
    filter_eg_amt: 20, feg_attack: 200, feg_decay: 1500, feg_sustain: 70, feg_release: 900, aeg_attack: 150,
    aeg_decay: 1500, aeg_sustain: 90, aeg_release: 1000, mod1_rate: 0.47, mod1_dest: 4, mod1_mod_amt: 40,
    mod2_rate: 0.3, mod2_dest: 2, mod2_mod_amt: 40,
  }),
  synth_kick: preset("Percussion / Synth Kick", "A synth kick drum: a triangle with a 45 ms pitch drop (Filter EG through MOD 2), a click from the filter envelope, MULTIDRIVE for punch. Recreation of the Sub 37 factory preset “Analog Kick” (bank 3, preset 6, PERCUSSION); Moog's own settings are not published, so these are ours. Play: MIDI 36–43 (a 65-98 Hz body), one hit per beat; the key tunes the kick.", 2, 15, {
    preset_volume: 100, osc1_wave: 0, kb_reset: true, mix_osc1: 90, cutoff: 500, multidrive: 40,
    filter_eg_amt: 40,
    filter_kb_amt: 50, feg_decay: 45, feg_sustain: 0, feg_release: 40, feg_multi_trig: true, feg_reset: true,
    aeg_decay: 450, aeg_sustain: 0, aeg_release: 300, aeg_multi_trig: true, aeg_reset: true, mod2_source: 5,
    mod2_pitch_amt: 80,
  }),
  clarinet: preset("Woodwind / Clarinet", "A clarinet: a hollow square wave (odd harmonics only), a breath of pink noise, a gentle filter swell and wheel vibrato. Recreation of the Sub 37 factory preset “KLARINETIK” (bank 3, preset 7, WOODWIND); Moog's own settings are not published, so these are ours. Play: Woodwind lines in the middle register (MIDI 50–70), legato phrasing.", 2, 16, {
    preset_volume: 53.2, osc1_wave: 67, mix_osc1: 70, mix_noise: 8, cutoff: 1600, resonance: 5, filter_slope: 1,
    filter_eg_amt: 20,
    feg_attack: 60, feg_decay: 400, feg_sustain: 70, feg_release: 200, aeg_attack: 40, aeg_sustain: 90,
    aeg_release: 150, aeg_vel_amt: 40, mod1_rate: 5.2, mod1_pitch_amt: 5, glide_on: true, glide_time: 37.1,
    glide_type: 2, glide_legato: true,
  }),
  clipping_drive: preset("Distorted / Clipping Drive", "Hard clipping: every source past unity, FDBK and MULTIDRIVE at 10 for a square-edged, aggressive tone. PRESET VOL brings its level in line with the other presets. Recreation of the Sub 37 factory preset “CLIPPING A LOT” (bank 3, preset 8, DISTORTED); Moog's own settings are not published, so these are ours. Play: Power riffs; compare it with MULTIDRIVE at 0 to hear what the clipping adds.", 3, 1, {
    osc2_wave: 67, osc2_frequency: -0.12, mix_osc1: 90, mix_sub: 60, mix_osc2: 80, mix_feedback: 50, cutoff: 2000,
    resonance: 20, multidrive: 100, filter_eg_amt: 40, feg_decay: 400, feg_sustain: 50, feg_release: 200,
    aeg_decay: 500, aeg_sustain: 90, aeg_release: 200, preset_volume: 41.5,
  }),
  tv_detective_lead_70s: preset("Classic / 70s TV Detective Lead", "A funky 70s TV-detective lead: saw plus square, a resonant bite, two voices for fourths and fifths, a short glide. Recreation of the Sub 37 factory preset “70s TV PI Theme” (bank 3, preset 9, CLASSIC); Moog's own settings are not published, so these are ours. Play: A four-note riff shape played three times, a step lower each time; two-note fourths for punch.", 3, 2, {
    preset_volume: 44.2, osc2_wave: 67, beat_freq: 0.5, duo_mode: true, mix_osc1: 60, mix_sub: 20, mix_osc2: 60,
    mix_feedback: 10,
    cutoff: 1200, resonance: 35, multidrive: 25, filter_eg_amt: 50, feg_attack: 5, feg_decay: 350, feg_sustain: 40,
    feg_release: 200, aeg_attack: 3, aeg_decay: 400, aeg_sustain: 80, aeg_release: 200, mod1_rate: 5.5,
    mod1_pitch_amt: 6, glide_on: true, glide_time: 37.1, glide_type: 1, glide_legato: true,
  }),
  long_ride_duo_pad: preset("Duo / Long Ride Duo Pad", "An evolving two-voice pad: the Filter EG LOOPs with long stages (a 9-second multistage LFO) while OSC 2's wave slowly morphs. Recreation of the Sub 37 factory preset “A LONG RIDE” (bank 3, preset 10, DUO); Moog's own settings are not published, so these are ours. Play: Hold two notes for many bars; it breathes on its own.", 3, 3, {
    preset_volume: 100, osc2_wave: 67, beat_freq: 0.6, duo_mode: true, mix_osc1: 60, mix_sub: 30, mix_osc2: 50,
    mix_noise: 5, cutoff: 450,
    resonance: 35, filter_eg_amt: 50, filter_kb_amt: 50, feg_attack: 2500, feg_decay: 3500, feg_sustain: 0,
    feg_release: 3000, feg_loop: true, aeg_attack: 1500, aeg_decay: 2000, aeg_release: 2200, mod2_rate: 0.1,
    mod2_dest: 4, mod2_mod_amt: 30,
  }),
  boom_bah_arp: preset("Arp / Boom-Bah Arp", "An arpeggio that alternates low \"boom\" and high \"bah\": RANGE +1 with INVERT plays each note and then its octave before moving on (C, C', E, E'…). Recreation of the Sub 37 factory preset “BOOM BAH” (bank 3, preset 13, ARP); Moog's own settings are not published, so these are ours. Play: Hold a two- or three-note chord low on the keyboard; it bounces between octaves.", 3, 4, {
    preset_volume: 100, osc1_octave: 0, osc2_octave: 0, osc2_wave: 67, mix_osc1: 60, mix_sub: 30, mix_osc2: 40,
    cutoff: 450,
    resonance: 30, multidrive: 20, filter_eg_amt: 60, feg_attack: 3, feg_decay: 180, feg_sustain: 0, feg_release: 120,
    feg_multi_trig: true, aeg_sustain: 30, aeg_release: 150, aeg_multi_trig: true, arp_on: true, arp_sync: true,
    arp_div: 13, arp_oct_range: 4, arp_invert: true,
  }),
  bright_octave_lead: preset("Lead / Bright Octave Lead", "A bright, cheerful lead: two saws an octave apart, the filter well open, quick wheel vibrato and a short constant-time glide. Recreation of the Sub 37 factory preset “SUNNY LEAD” (bank 3, preset 14, LEAD); Moog's own settings are not published, so these are ours. Play: Upbeat melodies in the upper half of the keyboard.", 3, 5, {
    preset_volume: 53.3, osc2_octave: 2, beat_freq: 0.4, mix_osc1: 60, mix_osc2: 40, cutoff: 3500, resonance: 10,
    multidrive: 20,
    filter_eg_amt: 30, feg_attack: 2, feg_decay: 400, feg_sustain: 60, feg_release: 300, aeg_attack: 2,
    aeg_decay: 500, aeg_sustain: 90, aeg_release: 250, mod1_rate: 6, mod1_pitch_amt: 7, glide_on: true,
    glide_time: 37.1, glide_type: 1, glide_legato: true,
  }),
  cyber_brass: preset("Brass / Cyber Brass", "Synth brass with an electronic edge: detuned saws, a filter swell with velocity, and a little hard sync on OSC 2 for the metallic \"cyber\" bite. Recreation of the Sub 37 factory preset “CYBRASS” (bank 3, preset 15, BRASS); Moog's own settings are not published, so these are ours. Play: Brass stabs and swells; play harder for more bite.", 3, 6, {
    preset_volume: 42.4, hard_sync: true, osc2_frequency: 1.5, mix_osc1: 60, mix_sub: 20, mix_osc2: 50, cutoff: 500,
    resonance: 10,
    multidrive: 25, filter_eg_amt: 60, filter_kb_amt: 70, feg_attack: 80, feg_decay: 500, feg_sustain: 50,
    feg_release: 250, feg_vel_amt: 50, aeg_attack: 20, aeg_decay: 600, aeg_sustain: 90, aeg_release: 250,
    mod1_pitch_amt: 6,
  }),
  robot_arp: preset("Arp / Robot Arp", "Runaway robot chatter: a random-order arpeggio over two octaves, with sample-and-hold on a resonant filter. Recreation of the Sub 37 factory preset “RUNAWAY ROBOTS” (bank 4, preset 2, ARP); Moog's own settings are not published, so these are ours. Play: Hold a chord and let it run; ride the RESONANCE.", 3, 7, {
    preset_volume: 98.4, osc1_wave: 67, osc2_octave: 2, osc2_wave: 90, mix_osc1: 80, mix_osc2: 55, cutoff: 900,
    resonance: 60,
    filter_eg_amt: 40, feg_decay: 120, feg_sustain: 0, feg_release: 80, feg_multi_trig: true, aeg_decay: 200,
    aeg_sustain: 40, aeg_release: 80, aeg_multi_trig: true, mod2_source: 4, mod2_sync: true, mod2_div: 16,
    mod2_filter_amt: 40, arp_on: true, arp_sync: true, arp_oct_range: 4, arp_pattern: 3,
  }),
  clock_synced_chirps: preset("Percussion / Clock-Synced Chirps", "A bird-like chirp that repeats in time: a fast downward pitch sweep from the Filter EG, and both envelopes in SYNC so they retrigger every dotted eighth while the key is held. Recreation of the Sub 37 factory preset “Echo Chirp” (bank 4, preset 4, PERCUSSION); Moog's own settings are not published, so these are ours. ARP SYNC is lit, so the repeats follow the studio clock. Play: Press ▶ and hold a high key for a beat or two; short taps give a single chirp.", 3, 8, {
    preset_volume: 100, multidrive: 50, mix_sub: 60, osc1_octave: 2, osc1_wave: 0, mix_osc1: 100, cutoff: 2500,
    resonance: 30, filter_slope: 1, filter_eg_amt: 30,
    feg_decay: 70, feg_sustain: 0, feg_release: 60, feg_multi_trig: true, feg_reset: true, feg_sync: true,
    feg_sync_div: 11, aeg_decay: 260, aeg_sustain: 0, aeg_multi_trig: true, aeg_reset: true, aeg_sync: true,
    aeg_sync_div: 11, mod2_source: 5, mod2_pitch_amt: 60, arp_sync: true,
  }),
  touch_sensitive_bass: preset("Misc / Touch-Sensitive Bass", "A bass that answers your touch: velocity opens the Filter EG, and aftertouch pushes the cutoff through MOD 2 (PGM SRC CONST ON, depth from AFTERTOUCH). Recreation of the Sub 37 factory preset “TouchBass” (bank 4, preset 7, MISC); Moog's own settings are not published, so these are ours. On the hardware the depth comes from aftertouch; the twin’s keys have no pressure, so the MOD wheel stands in. Play: Play dynamically and press into held notes to open them.", 3, 9, {
    preset_volume: 59.1, osc1_octave: 0, osc2_octave: 0, osc2_wave: 67, beat_freq: 0.4, mix_osc1: 60, mix_sub: 50,
    mix_osc2: 50,
    cutoff: 300, resonance: 25, multidrive: 30, filter_eg_amt: 50, filter_kb_amt: 50, feg_attack: 2, feg_decay: 280,
    feg_sustain: 20, feg_release: 180, feg_vel_amt: 80, aeg_decay: 600, aeg_sustain: 90, aeg_release: 140,
    aeg_vel_amt: 50, mod2_source: 5, mod2_pgm_src: 2, mod2_filter_amt: 50, mod2_wheel: 100,
  }),
  computer_bleeps_70s: preset("Sound FX / 70s Computer Bleeps", "The 1970s \"computer thinking\" sound the manual describes for S&H: random steps on the pitch and on a resonant filter. Recreation of the Sub 37 factory preset “1970s SciFi Computer” (bank 4, preset 14, SOUND-FX); Moog's own settings are not published, so these are ours. Play: Hold one key; the S&H does the rest. Push the wheel to add pitch randomness.", 3, 10, {
    preset_volume: 32.3, osc1_octave: 2, osc1_wave: 67, mix_osc1: 60, cutoff: 1500, resonance: 60, filter_slope: 1,
    aeg_release: 200,
    mod1_source: 4, mod1_rate: 7, mod1_pitch_amt: 40, mod2_source: 4, mod2_rate: 7, mod2_filter_amt: 40,
  }),
  funk_slap_bass: preset("Bass / Funk Slap Bass", "A snappy, resonant funk bass: short filter envelope with strong velocity, every note re-attacked. Recreation of the Sub 37 factory preset “funk bass” (bank 4, preset 15, BASS); Moog's own settings are not published, so these are ours. Play: Staccato 16ths and octave pops; play harder for the slap (VEL AMT 6 on the Filter EG).", 3, 11, {
    preset_volume: 74.2, osc1_octave: 0, osc2_wave: 67, beat_freq: 0.3, kb_reset: true, mix_osc1: 70, mix_sub: 40,
    mix_osc2: 50,
    cutoff: 350, resonance: 40, multidrive: 30, filter_eg_amt: 80, filter_kb_amt: 80, feg_decay: 160, feg_sustain: 5,
    feg_release: 120, feg_vel_amt: 60, feg_multi_trig: true, aeg_decay: 380, aeg_sustain: 60, aeg_release: 90,
    aeg_vel_amt: 40, aeg_multi_trig: true,
  }),
  resonant_squelch_bass: preset("Bass / Resonant Squelch Bass", "A rubbery resonant bass: RESONANCE 6.5 under a strong filter envelope, so every note \"talks\". Recreation of the Sub 37 factory preset “REZZO BASS” (bank 5, preset 2, BASS); Moog's own settings are not published, so these are ours. Play: Mid-tempo lines with some legato slides (LEGATO glide); ride CUTOFF.", 3, 12, {
    preset_volume: 58.3, osc1_octave: 0, osc2_octave: 0, osc2_frequency: -0.1, mix_osc1: 70, mix_sub: 30,
    mix_osc2: 60, cutoff: 280,
    resonance: 65, multidrive: 30, filter_eg_amt: 70, filter_kb_amt: 70, feg_decay: 230, feg_sustain: 10,
    feg_release: 160, aeg_decay: 500, aeg_sustain: 80, aeg_release: 120, glide_on: true, glide_time: 37.1,
    glide_type: 2, glide_legato: true,
  }),
  synth_tom: preset("Percussion / Synth Tom", "A 70s \"syndrum\" tom: a resonant filter ringing near self-oscillation, a falling pitch sweep and a touch of noise for the stick. Recreation of the Sub 37 factory preset “SYNTH DRUM1” (bank 5, preset 15, PERCUSSION); Moog's own settings are not published, so these are ours. Play: Tom fills down the keyboard, one hit per note.", 3, 13, {
    preset_volume: 100, multidrive: 55, mix_osc1: 100, osc1_wave: 0, kb_reset: true, mix_noise: 25, cutoff: 600,
    resonance: 65, filter_eg_amt: 50, feg_decay: 220,
    feg_sustain: 0, feg_release: 200, feg_multi_trig: true, feg_reset: true, aeg_decay: 900, aeg_sustain: 0,
    aeg_release: 500, aeg_multi_trig: true, aeg_reset: true, mod2_source: 5, mod2_pitch_amt: 50,
  }),
  rising_sync_lead: preset("Sync / Rising Sync Lead", "A hard-sync lead whose tone climbs while you hold: a slow Filter EG attack sweeps the synced OSC 2 up through MOD 2. Recreation of the Sub 37 factory preset “RISING SYNC” (bank 5, preset 16, SYNC); Moog's own settings are not published, so these are ours. Play: Long held notes; the sync sweep rises over about a second.", 3, 14, {
    preset_volume: 40.8, hard_sync: true, osc2_frequency: 2, mix_osc1: 20, mix_osc2: 90, cutoff: 2400, resonance: 15,
    multidrive: 35,
    filter_eg_amt: 30, feg_attack: 900, feg_decay: 1500, feg_sustain: 60, feg_release: 400, aeg_attack: 5,
    aeg_decay: 600, aeg_sustain: 90, aeg_release: 300, mod1_rate: 5.5, mod1_pitch_amt: 7, mod2_source: 5,
    mod2_pitch_amt: 80, mod2_pitch_dest: 2,
  }),
  small_singing_lead: preset("Lead / Small Singing Lead", "A small, sweet lead: triangle and square blended soft, a gentle filter, legato glide and wheel vibrato. Recreation of the Sub 37 factory preset “LITTLE LYRIC” (bank 6, preset 10, LEAD); Moog's own settings are not published, so these are ours. Play: Quiet melodies and counter-lines; overlap notes to slide.", 3, 15, {
    preset_volume: 93.2, mix_osc1: 70, osc1_wave: 10, osc2_wave: 60, beat_freq: 0.3, mix_osc2: 45, cutoff: 1800,
    resonance: 10, filter_slope: 1,
    filter_eg_amt: 20, feg_attack: 20, feg_decay: 500, feg_sustain: 60, feg_release: 300, aeg_attack: 15,
    aeg_decay: 400, aeg_sustain: 90, aeg_release: 300, mod1_rate: 5.2, mod1_pitch_amt: 6, glide_on: true,
    glide_type: 2, glide_legato: true,
  }),
  duo_saw_stabs: preset("Duo / Duo Saw Stabs", "Two-saw dance stabs: a punchy filter envelope, both voices through one driven ladder. Recreation of the Sub 37 factory preset “SAWTEETH DUO DANCER” (bank 6, preset 16, DUO); Moog's own settings are not published, so these are ours. Play: Off-beat two-note stabs (house, trance); let the two voices cross each bar.", 3, 16, {
    preset_volume: 100, beat_freq: 0.8, duo_mode: true, mix_osc1: 70, mix_sub: 20, mix_osc2: 70, cutoff: 900,
    resonance: 30,
    multidrive: 30, filter_eg_amt: 60, feg_decay: 200, feg_sustain: 10, feg_release: 150, feg_multi_trig: true,
    aeg_decay: 350, aeg_sustain: 30, aeg_release: 180, aeg_multi_trig: true,
  }),
  smooth_lead_wheel_sync: preset("Lead / Smooth Lead, Wheel Sync", "A smooth lead that turns into a sync scream as you push the wheel: MOD 1 (wheel depth) raises the synced OSC 2. FILTER EG SUSTAIN 10 makes MOD 1's F.EG source a steady level while a key is held. Recreation of the Sub 37 factory preset “SMOOTH LEAD MODWHEELSYNC” (bank 7, preset 1, LEAD); Moog's own settings are not published, so these are ours. Play: A legato melody with the wheel down; push the wheel on the climax notes.", 4, 1, {
    preset_volume: 38.9, beat_freq: 0.4, hard_sync: true, mix_osc2: 70, cutoff: 2200, resonance: 15, multidrive: 20,
    feg_attack: 40,
    feg_release: 300, aeg_attack: 8, aeg_decay: 500, aeg_sustain: 90, aeg_release: 300, mod1_source: 5,
    mod1_pitch_amt: 80, mod1_pitch_dest: 2, glide_on: true, glide_time: 67.4, glide_type: 2, glide_legato: true,
  }),
  fifths_lead: preset("Lead / Fifths Lead", "A power-fifth lead: OSC 2 a fifth above (FREQUENCY +7), so one finger plays an open fifth; a bright filter with medium bite. Recreation of the Sub 37 factory preset “5TH IN LINE” (bank 7, preset 2, LEAD); Moog's own settings are not published, so these are ours. Play: Riffs and melodies where every note is a power chord.", 4, 2, {
    preset_volume: 50, osc2_frequency: 7, mix_osc1: 60, mix_sub: 20, mix_osc2: 50, cutoff: 1600, resonance: 20,
    multidrive: 30,
    filter_eg_amt: 50, filter_kb_amt: 80, feg_attack: 2, feg_decay: 350, feg_sustain: 50, feg_release: 250,
    aeg_attack: 2, aeg_decay: 500, aeg_sustain: 90, aeg_release: 250, mod1_rate: 5.5, mod1_pitch_amt: 6,
  }),
  random_sync_lead: preset("Sync / Random Sync Lead", "A playful sync lead: a sample-and-hold LFO throws the synced OSC 2 to a new pitch eight times a second, so the timbre jumps randomly while the pitch stays put. Recreation of the Sub 37 factory preset “Hard Sync Hijinxx” (bank 7, preset 7, SYNC); Moog's own settings are not published, so these are ours. Play: Sustained notes and simple riffs; the random sync colours do the talking.", 4, 3, {
    preset_volume: 41.5, osc2_octave: 2, hard_sync: true, mix_osc1: 20, mix_osc2: 80, cutoff: 3000, resonance: 15,
    multidrive: 30,
    filter_eg_amt: 20, feg_attack: 2, feg_decay: 500, feg_sustain: 60, feg_release: 300, aeg_attack: 2,
    aeg_decay: 500, aeg_sustain: 90, aeg_release: 250, mod1_rate: 5.5, mod1_pitch_amt: 6, mod2_source: 4,
    mod2_rate: 8, mod2_pitch_amt: 50, mod2_pitch_dest: 2,
  }),
  melting_drive_bass: preset("Bass / Melting Drive Bass", "A face-melting distorted wobble: mixer past unity, FDBK 7 and MULTIDRIVE 9.5, with a clock-synced filter wobble. PRESET VOL brings its level in line with the other presets. Recreation of the Sub 37 factory preset “BASS MELT FACE” (bank 7, preset 8, BASS); Moog's own settings are not published, so these are ours. Play: Hold long notes; the wobble follows the studio tempo (ARP SYNC lit, MOD 2 SYNC 1/8).", 4, 4, {
    osc1_octave: 0, osc2_frequency: 0.1, mix_osc1: 90, mix_sub: 80, mix_osc2: 80, mix_noise: 5, mix_feedback: 70,
    cutoff: 240, resonance: 50, multidrive: 95, filter_eg_amt: 30, filter_kb_amt: 40, feg_sustain: 30,
    feg_release: 150, aeg_attack: 2, aeg_decay: 1000, aeg_release: 150, mod2_sync: true, mod2_div: 13,
    mod2_kb_reset: true, mod2_filter_amt: 60, arp_sync: true, preset_volume: 44.5,
  }),
  house_duo_sequence: preset("Sequence / House Duo Sequence", "A house groove from the duo sequencer: two-note organ-style steps (written C3+F3) on the off-beats, recorded in DUO MODE. Recreation of the Sub 37 factory preset “Gyro House” (bank 7, preset 15, SEQUENCE); Moog's own settings are not published, so these are ours. Play: Start it with PATTERN SEQ and ON, then hold a key to transpose. Two-note steps play both pitches.", 4, 5, {
    preset_volume: 85.3, multidrive: 15, mix_osc1: 70, osc1_wave: 67, osc2_wave: 67, beat_freq: 0.4, duo_mode: true,
    mix_sub: 20, mix_osc2: 70, cutoff: 1800,
    resonance: 20, filter_slope: 1, filter_eg_amt: 40, feg_decay: 150, feg_sustain: 20, feg_multi_trig: true,
    aeg_decay: 260, aeg_sustain: 60, aeg_release: 80, aeg_multi_trig: true, arp_on: true, arp_sync: true,
    arp_pattern: 4, arp_latch: true,
    ...buildSeq(['.', '.', [48, 53], '.', '.', '.', [48, 53], '.', '.', '.', [48, 55], '.', '.', [48, 53], '.', [48, 51]]),
  }),
  acid_wiggle_sequence: preset("Sequence / Acid Wiggle Sequence", "An acid sequence with a wiggle: a resonant 18 dB saw line with legato glide on the tied steps and a slow LFO wobbling the cutoff. Recreation of the Sub 37 factory preset “Acid Wiggler” (bank 8, preset 2, SEQUENCE); Moog's own settings are not published, so these are ours. Play: Start it (PATTERN SEQ, ON, hold or latch a key); ride CUTOFF and RESONANCE.", 4, 6, {
    preset_volume: 66.4, mix_osc1: 70, mix_sub: 20, cutoff: 520, resonance: 70, multidrive: 40, filter_slope: 2,
    filter_eg_amt: 70,
    feg_decay: 220, feg_sustain: 0, feg_vel_amt: 40, aeg_decay: 280, aeg_sustain: 70, aeg_release: 70, mod2_rate: 2,
    mod2_filter_amt: 20, glide_on: true, glide_type: 2, glide_legato: true, arp_on: true, arp_sync: true,
    arp_pattern: 4, arp_latch: true,
    ...buildSeq([36, 36, 48, { n: 36, tie: true }, '.', 36, 39, { n: 41, tie: true }, 36, '.', 48, 34, { n: 36, tie: true }, 31, 36, { n: 48, tie: true }]),
  }),
  minor_drone: preset("Drone / Minor Drone", "A drone to bend against: DUO with KB CTRL OFF parks OSC 2 on a fixed low note, while the PITCH wheel (BEND DEST OSC1, up +3) bends OSC 1 a minor third. Recreation of the Sub 37 factory preset “Minor Bender” (bank 8, preset 3, DRONE); Moog's own settings are not published, so these are ours. Play: Hold a key, then bend into the minor third and back; press AMP EG LATCH ON for an endless drone.", 4, 7, {
    preset_volume: 36.6, osc2_octave: 0, osc2_wave: 67, duo_mode: true, kb_ctrl: 0, mix_sub: 20, mix_osc2: 60,
    cutoff: 500, resonance: 40,
    multidrive: 30, filter_eg_amt: 20, filter_kb_amt: 50, feg_attack: 2000, feg_decay: 4000, feg_sustain: 50,
    feg_release: 4000, aeg_attack: 1500, aeg_decay: 1000, aeg_release: 5000, mod2_rate: 0.1, mod2_filter_amt: 24,
    bend_up: 3, bend_dest: 1,
  }),
  space_banjo_arp: preset("Arp / Space Banjo Arp", "A plucky, twangy arpeggio whose speed you play with the MOD wheel. MOD 1 (wheel depth) uses PGM SRC CONST ON and PGM DST ARP RATE, so the wheel is a rate fader. Recreation of the Sub 37 factory preset “Space Banjo MW is Rate” (bank 8, preset 14, ARP); Moog's own settings are not published, so these are ours. Play: Hold a chord, start slow, and push the wheel to speed it up.", 4, 8, {
    preset_volume: 72, multidrive: 20, osc1_wave: 90, osc2_octave: 2, osc2_wave: 80, beat_freq: 0.5, mix_osc1: 80,
    mix_osc2: 55, cutoff: 700,
    resonance: 30, filter_eg_amt: 70, filter_kb_amt: 120, feg_decay: 140, feg_sustain: 0, feg_release: 150,
    feg_multi_trig: true, aeg_decay: 400, aeg_sustain: 15, aeg_release: 300, aeg_multi_trig: true, mod1_source: 5,
    mod1_pgm_src: 2, mod1_dest: 6, mod1_pgm_dst: 9, mod1_mod_amt: 60, arp_on: true, arp_rate: 90, arp_oct_range: 4,
    arp_back_fwd: true,
  }),
  sky_sweep_pad: preset("Evolving / Sky Sweep Pad", "A big evolving pad: saw plus a fifth (FREQUENCY +7), a resonant filter swept by a four-second Filter EG, slow constant-time glide. Recreation of the Sub 37 factory preset “ACROSS THE SKY” (bank 8, preset 16, EVOLVING); Moog's own settings are not published, so these are ours. Play: Hold notes for several bars; slide slowly between them.", 4, 9, {
    preset_volume: 90.4, osc2_frequency: 7, mix_osc1: 60, mix_sub: 20, mix_osc2: 50, cutoff: 300, resonance: 40,
    multidrive: 15,
    filter_eg_amt: 70, filter_kb_amt: 50, feg_attack: 4000, feg_decay: 5000, feg_sustain: 30, feg_release: 4000,
    aeg_attack: 1500, aeg_decay: 3000, aeg_sustain: 90, aeg_release: 1800, mod2_rate: 0.15, mod2_filter_amt: 12,
    glide_on: true, glide_time: 165.4, glide_type: 1, glide_legato: true,
  }),
  triplet_fifths: preset("Classic / Triplet Fifths", "Stacked fifths (FREQUENCY +7) arpeggiated over three octaves, so every key makes a group of three: triplet accents across the beat. Recreation of the Sub 37 factory preset “TRIPLET 5THS” (bank 9, preset 3, CLASSIC); Moog's own settings are not published, so these are ours. Play: Hold one key or a dyad; every held note plays root, +1 and +2 octaves. Set SYNC and 1/8 T in the studio.", 4, 10, {
    preset_volume: 71.9, multidrive: 20, osc2_frequency: 7, mix_osc1: 75, mix_osc2: 65, cutoff: 600, resonance: 40,
    filter_eg_amt: 60, feg_decay: 180,
    feg_sustain: 0, feg_release: 150, feg_multi_trig: true, aeg_sustain: 40, aeg_release: 200, aeg_multi_trig: true,
    arp_on: true, arp_sync: true, arp_div: 15, arp_oct_range: 5,
  }),
  prog_portamento_lead: preset("Lead / Prog Portamento Lead", "A 70s prog-rock solo lead: saw plus a square an octave up, slow exponential glide on every note, deep wheel vibrato. Synth Studio original: a classic Moog technique. Play: Wide leaps, to show off the swoop; vibrato on long notes.", 4, 11, {
    preset_volume: 59.5, osc2_octave: 2, osc2_wave: 67, mix_osc1: 60, mix_osc2: 30, cutoff: 1600, resonance: 30,
    multidrive: 25,
    filter_eg_amt: 40, feg_attack: 20, feg_decay: 800, feg_sustain: 60, feg_release: 400, aeg_attack: 5,
    aeg_decay: 600, aeg_sustain: 90, aeg_release: 400, mod1_rate: 6, mod1_pitch_amt: 9, glide_on: true,
    glide_time: 165.4, glide_type: 2,
  }),
  west_coast_whistle: preset("Lead / West-Coast Whistle", "A 90s West-coast whistle lead: a near-sine (filtered triangle), constant light vibrato, legato glide, played high. Synth Studio original: a classic Moog technique. Play: High (KB OCTAVE +1, MIDI 72–96), slow sliding melodies.", 4, 12, {
    preset_volume: 78.5, osc1_wave: 0, mix_osc1: 60, cutoff: 1200, aeg_attack: 20, aeg_release: 300, mod1_rate: 5.5,
    mod1_pitch_amt: 7,
    mod2_rate: 5.3, mod2_pitch_amt: 7, glide_on: true, glide_time: 67.4, glide_type: 2, glide_legato: true,
  }),
  brass_swell: preset("Brass / Brass Swell", "Classic synth brass: detuned saws, a 250 ms filter-attack swell, velocity for the \"blat\". Synth Studio original: a classic Moog technique. Play: Long notes and swells; two-voice brass lines (DUO).", 4, 13, {
    preset_volume: 46, duo_mode: true, osc2_frequency: 0.1, mix_osc1: 60, mix_sub: 20, mix_osc2: 60, cutoff: 450,
    resonance: 5,
    multidrive: 20, filter_eg_amt: 60, filter_kb_amt: 80, feg_attack: 250, feg_decay: 900, feg_sustain: 50,
    feg_release: 400, feg_vel_amt: 40, aeg_attack: 120, aeg_decay: 900, aeg_sustain: 90, aeg_release: 400,
    mod1_pitch_amt: 6,
  }),
  berlin_sequence: preset("Sequence / Berlin Sequence", "A Berlin-school sequence in the 70s modular style: a 16-step resonant pluck with a slow 10-second filter LFO sweep (0.1 Hz, the bottom of the panel range). Synth Studio original: a classic Moog technique. Play: Start it and let it run; hold keys to transpose and ride CUTOFF slowly.", 4, 14, {
    preset_volume: 75.6, multidrive: 20, osc2_octave: 2, mix_osc1: 90, mix_osc2: 45, cutoff: 500, resonance: 50,
    filter_eg_amt: 50, feg_decay: 160,
    feg_sustain: 0, feg_release: 120, feg_multi_trig: true, aeg_decay: 300, aeg_sustain: 45, aeg_release: 150,
    aeg_multi_trig: true, mod2_rate: 0.1, mod2_filter_amt: 30, arp_on: true, arp_sync: true, arp_pattern: 4,
    arp_latch: true,
    ...buildSeq([40, 52, 47, 40, 43, 52, 50, 40, 40, 52, 47, 40, 45, 43, 50, 47]),
  }),
  studio_bassline: preset('Sequence / Studio Bassline', 'A 16-step bassline that locks to the studio: ARP ON, PATTERN SEQ, LATCH and SYNC are lit, so the studio ▶ starts it from step 1 at the studio tempo and ■ stops it (with SYNC lit it waits for the clock, p.15). Press a key to move it to another key: with REF NOTE FIRST the key you press becomes its first note (p.46). Made for the Bass & drums set. Synth Studio original. Play: press ▶, then tap low keys to change key.', 4, 15, {
    preset_volume: 100, osc1_octave: 0, osc1_wave: 40, osc2_octave: 0, osc2_wave: 60, osc2_frequency: 0.06,
    mix_osc1: 60, mix_sub: 50, mix_osc2: 40,
    cutoff: 300, resonance: 25, multidrive: 35, filter_eg_amt: 50, filter_kb_amt: 50, feg_decay: 180, feg_sustain: 10,
    feg_release: 120, aeg_decay: 400, aeg_sustain: 70, aeg_release: 60, arp_on: true, arp_pattern: 4, arp_latch: true,
    arp_sync: true, arp_gate: 60,
    ...buildSeq([36, '.', 36, 48, '.', 36, 43, '.', 36, '.', 46, 36, '.', 39, 41, 43]),
  }),
  one_finger_fifths: preset('Classic / One-Finger Fifths', 'Two saws a perfect fifth apart: OSC 2 FREQUENCY fully clockwise tunes it a fifth above OSC 1, so one finger plays a power chord (p.26). The sub adds the octave below and a little MULTIDRIVE the grit. Synth Studio original, straight from the manual. Play: riffs on the lower keys; the wheel adds vibrato.', 4, 16, {
    preset_volume: 48.6, osc2_frequency: 7, mix_osc1: 55, mix_osc2: 55, mix_sub: 30, cutoff: 1800, resonance: 15,
    multidrive: 35, filter_eg_amt: 30,
    feg_decay: 600, feg_sustain: 50, aeg_sustain: 90, aeg_release: 200, mod1_pitch_amt: 6,
  }, 'manual'),
};
