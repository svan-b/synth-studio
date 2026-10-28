// ============================================================================
// Analog Four MKII lessons
// Paged UI: every parameter step is preceded by the TRACK / PARAMETER key
// presses that bring that parameter onto the encoders.
// ============================================================================

import type { Lesson, LessonStep, SynthConcept } from '@/types';
import { PAGE } from './params';

const FRONT = 'Manual - Front panel overview';
const SEQ = 'Manual - Sequencer chapter';
const LOCKS = 'Manual - Sequencer, Parameter locks';
const APA = (page: string, p: string) => `Manual Appendix A - Synth track parameters, ${page} page (p.${p})`;
const APB = (page: string) => `Manual Appendix B - FX track parameters, ${page} page (p.88-92)`;

const step = (
  control: string | undefined, targetValue: number | string | boolean | undefined,
  instruction: string, principle: string, explanation: string, manualReference: string, concept: SynthConcept,
): LessonStep => ({ control, targetValue, instruction, principle, explanation, manualReference, concept });

const track = (t: number, why = 'The encoders, screen and trig keys now belong to this track.'): LessonStep =>
  step('track', t, `Press the [${t < 4 ? `TRK ${t + 1}` : t === 4 ? 'FX' : 'CV'}] key`, 'A multitimbral instrument is several independent synths sharing one set of controls; selecting a track decides which one you are editing.', why, 'Manual - Front panel, [TRACK] keys', 'signal-routing');

const page = (p: number, key: string, why: string, again = false): LessonStep =>
  step('page', p, again ? `Press [${key}] again to open its secondary page` : `Press the [${key}] PARAMETER key`, 'Paged instruments trade knobs for menus: a small set of encoders is re-mapped to whichever group of parameters you select.', why, 'Manual - Front panel, [PARAMETER] keys (double press opens a secondary page)', 'signal-routing');

const info = (instruction: string, principle: string, explanation: string, manualReference: string, concept: SynthConcept): LessonStep =>
  step(undefined, undefined, instruction, principle, explanation, manualReference, concept);

export const ANALOG_FOUR_LESSONS: Lesson[] = [
  // ==========================================================================
  {
    id: 'a4-navigation',
    device: 'analog-four',
    name: 'Tracks, pages and encoders',
    description: 'How one screen and ten encoders control four synths: select a track, pick a page, turn an encoder.',
    difficulty: 'beginner',
    source: 'Elektron Analog Four MKII User Manual - Basic operation',
    estimatedMinutes: 6,
    tags: ['navigation', 'beginner'],
    concepts: ['signal-routing', 'oscillator-pitch', 'filter-cutoff', 'timing-tempo'],
    steps: [
      track(0),
      page(PAGE.OSC1, 'OSC 1', 'The screen now lists TUN FIN DET TRK LEV on the top row and WAV SUB PW SPD PWM below - one name per encoder, in the same 5 x 2 grid as the knobs.'),
      step('play', true, 'Press [PLAY] (or the Space bar) to start the sequencer', 'A sequencer is a clock plus a list of events: it fires notes at fixed subdivisions of the beat.', 'Track 1 already has a trig on every beat. Leave it running while you explore - every change is heard on the next trig.', 'Manual - Front panel, [PLAY]', 'timing-tempo'),
      step('t1_osc1_tune', 12, 'Turn encoder A (TUN) to +12', 'Pitch is logarithmic: +12 semitones is one octave, a doubling of frequency.', 'The note jumps an octave. TUN works in semitones, FIN in fractions of one.', APA('OSC 1', '82-83'), 'oscillator-pitch'),
      page(PAGE.FILTERS, 'FILTER', 'The same encoders now control the two filters: filter 1 on the top row, filter 2 on the bottom row.'),
      step('t1_flt1_freq', 60, 'Turn encoder A (FRQ) down to about 60', 'A low-pass filter removes harmonics above its cutoff, so lowering it makes the sound darker.', 'Encoder A was TUN a moment ago - now it is filter 1 frequency. The physical knob is the same; the page decides what it does.', APA('FILTERS', '84-85'), 'filter-cutoff'),
      track(1, 'Track 2 has its own, untouched sound: the screen shows its values, not track 1\'s.'),
      page(PAGE.TEMPO, 'TEMPO', 'TEMPO is project-wide, so it works from any track.'),
      step('tempo', 100, 'Turn encoder A to 100 BPM', 'Tempo sets the length of every step: at 120 BPM a sixteenth note lasts 125 ms.', 'Slower tempo, longer steps - the whole sequencer follows.', 'Manual - Quick start, Tempo', 'timing-tempo'),
      info('Now experiment: switch tracks and pages and watch the screen and the knob labels follow you.', 'Learning where a parameter lives is the real skill on a paged instrument.', 'Tip: double-tap an encoder to return the parameter to its default.', FRONT, 'signal-routing'),
    ],
  },

  // ==========================================================================
  {
    id: 'a4-oscillators',
    device: 'analog-four',
    name: 'Oscillators: tuning and waveforms',
    description: 'Hear what each A4 waveform contains, and how pulse width changes a pulse wave.',
    difficulty: 'beginner',
    source: 'Elektron Analog Four MKII User Manual - Appendix A, OSC pages',
    estimatedMinutes: 7,
    prerequisites: ['a4-navigation'],
    tags: ['oscillator', 'waveform', 'beginner'],
    concepts: ['oscillator-waveform', 'oscillator-pitch'],
    steps: [
      track(0),
      page(PAGE.OSC1, 'OSC 1', 'OSC 1 holds the first oscillator, its sub oscillator and its PWM LFO.'),
      step('play', true, 'Press [PLAY] so you can hear every change', 'You judge timbre by ear, and comparing sounds back to back is the fastest way to learn them.', 'Track 1 plays one note per beat.', 'Manual - Front panel, [PLAY]', 'timing-tempo'),
      step('t1_osc1_wave', 3, 'Turn encoder F (WAV) to TRI', 'A triangle wave contains only odd harmonics that fall away steeply (1/n²), so it sounds soft and flute-like.', 'Few harmonics means the filter has little to work with - triangles are for sub bass and mellow tones.', APA('OSC 1', '82-83'), 'oscillator-waveform'),
      step('t1_osc1_wave', 0, 'Turn WAV back to SAW', 'A sawtooth contains every harmonic at 1/n amplitude, which makes it the brightest, buzziest classic waveform.', 'The saw is the raw material for subtractive synthesis: lots of harmonics for the filter to carve away.', APA('OSC 1', '82-83'), 'oscillator-waveform'),
      step('t1_osc1_wave', 2, 'Turn WAV to PULS', 'A 50% square wave contains only odd harmonics at 1/n, giving the hollow, woody sound of a clarinet.', 'Even harmonics cancel in a perfectly symmetrical square.', APA('OSC 1', '82-83'), 'oscillator-waveform'),
      step('t1_osc1_pw', 16, 'Turn encoder H (PW) down to about 16', 'Narrowing a pulse brings back the even harmonics and thins the tone towards a nasal buzz.', 'Pulse width changes the harmonic recipe without changing pitch. PWM (encoder J) sweeps it with an LFO for a chorus-like shimmer.', APA('OSC 1', '82-83'), 'oscillator-waveform'),
      step('t1_osc1_wave', 1, 'Turn WAV to TPUL (transistor pulse)', 'Tilting the flat top of a pulse adds even harmonics, making it brighter and less hollow than a pure pulse.', 'The A4\'s transistor pulse is aimed at acid basslines; at extreme PW settings it goes silent.', APA('OSC 1', '82-83'), 'oscillator-waveform'),
      step('t1_osc1_tune', -12, 'Turn encoder A (TUN) to -12', 'Dropping an octave halves the frequency; every harmonic moves down with it, so the timbre is kept.', 'Bass parts usually live one or two octaves below the default note.', APA('OSC 1', '82-83'), 'oscillator-pitch'),
      info('Now experiment: compare the four waveforms at different pitches and pulse widths.', 'Timbre is the mix of harmonics; the waveform chooses the starting mix.', 'Try PWM (J) with PW at 64 and SPD (I) around 30 for a moving square.', APA('OSC 1', '82-83'), 'oscillator-waveform'),
    ],
  },

  // ==========================================================================
  {
    id: 'a4-sub-detune',
    device: 'analog-four',
    name: 'Sub oscillators and detune',
    description: 'Add weight with a sub oscillator, then width with a second, detuned oscillator.',
    difficulty: 'beginner',
    source: 'Elektron Analog Four MKII User Manual - Appendix A, OSC pages',
    estimatedMinutes: 7,
    prerequisites: ['a4-oscillators'],
    tags: ['sub', 'detune', 'oscillator'],
    concepts: ['subharmonics', 'oscillator-pitch', 'mixing'],
    steps: [
      track(0),
      page(PAGE.OSC1, 'OSC 1', 'The sub oscillator belongs to OSC 1 and shares its LEV.'),
      step('t1_osc1_sub', 1, 'Turn encoder G (SUB) to 1OCT', 'A sub oscillator adds a square wave at half the frequency (one octave down), reinforcing the fundamental.', 'The note keeps its pitch name but gains weight - the A4\'s subs follow the oscillator exactly.', APA('OSC 1', '82-83'), 'subharmonics'),
      step('t1_osc1_sub', 3, 'Try SUB = 2PUL', 'A 25% pulse two octaves down has a strong second harmonic, so it sounds like 1OCT and 2OCT mixed.', 'Sub waveforms ignore PW and PWM: they are fixed shapes.', APA('OSC 1', '82-83'), 'subharmonics'),
      page(PAGE.OSC2, 'OSC 2', 'OSC 2 has exactly the same parameters as OSC 1.'),
      step('t1_osc2_level', 100, 'Turn encoder E (LEV) up to 100', 'Mixing two oscillators at the same pitch simply adds their waveforms.', 'With no detune they phase-lock into one louder sound.', APA('OSC 2', '82-83'), 'mixing'),
      step('t1_osc2_detune', 12, 'Turn encoder C (DET) to +12', 'Two slightly different frequencies interfere, beating at the difference frequency - perceived as movement and width.', 'DET is linear (a fixed number of Hz), so the beat rate stays the same on low and high notes, unlike FIN.', APA('OSC 2', '82-83'), 'oscillator-pitch'),
      step('t1_osc2_tune', 7, 'Turn encoder A (TUN) to +7', 'Seven semitones is a perfect fifth, a 3:2 frequency ratio whose harmonics largely coincide, so it fuses into one rich tone.', 'Fifths stack harmonics instead of clashing - the classic "big" two-oscillator sound.', APA('OSC 2', '82-83'), 'oscillator-pitch'),
      info('Now experiment: try TUN +12 or +19 on OSC 2, and different SUB modes.', 'Harmonically related intervals (octaves, fifths) blend; others (like +6) clash and sound metallic.', 'Turn OSC 2 LEV to 0 to compare the single-oscillator sound.', APA('OSC 2', '82-83'), 'mixing'),
    ],
  },

  // ==========================================================================
  {
    id: 'a4-filters-series',
    device: 'analog-four',
    name: 'Two filters in series',
    description: 'Why a 4-pole low-pass followed by a high-pass gives you a band-pass you can tune at both edges.',
    difficulty: 'intermediate',
    source: 'Elektron Analog Four MKII User Manual - Appendix A, FILTERS page',
    estimatedMinutes: 8,
    prerequisites: ['a4-oscillators'],
    tags: ['filter', 'band-pass', 'resonance'],
    concepts: ['filter-cutoff', 'filter-type', 'filter-resonance'],
    steps: [
      track(0),
      page(PAGE.FILTERS, 'FILTER', 'Top row: filter 1, the 4-pole ladder low-pass. Bottom row: filter 2, the 2-pole multimode. The signal passes through filter 1 first, then filter 2.'),
      step('t1_flt1_res', 0, 'Turn encoder B (RES) to 0', 'Without resonance a filter only removes energy; resonance adds a peak at the cutoff.', 'Start neutral so you hear the filters\' slopes, not their peaks.', APA('FILTERS', '84-85'), 'filter-resonance'),
      step('t1_flt1_freq', 70, 'Turn encoder A (FRQ) to about 70 (≈ 900 Hz)', 'A 4-pole low-pass rolls off 24 dB per octave above the cutoff - steep enough to remove most of the buzz.', 'Everything above ~900 Hz is now strongly reduced.', APA('FILTERS', '84-85'), 'filter-cutoff'),
      step('t1_flt2_type', 4, 'Turn encoder H (TYP) to HP2', 'A high-pass filter does the opposite: it removes frequencies below its cutoff.', 'HP2 is a 12 dB/octave high-pass.', APA('FILTERS', '84-85'), 'filter-type'),
      step('t1_flt2_freq', 50, 'Turn encoder F (FRQ) up to about 50 (≈ 300 Hz)', 'Filters in series multiply their responses: low-pass at 900 Hz times high-pass at 300 Hz leaves only the band between them.', 'That is a band-pass, built from two filters. Unlike a single BP filter you can move each edge independently - a thin "telephone" sound.', APA('FILTERS', '84-85'), 'filter-type'),
      step('t1_flt2_freq', 64, 'Move filter 2 FRQ to 64 to narrow the band', 'The closer the two cutoffs, the narrower the passband and the quieter the result, because less energy gets through.', 'Narrow bands are great for hats, plucks and lo-fi textures; compensate with VOL on the AMP page.', APA('FILTERS', '84-85'), 'filter-cutoff'),
      step('t1_flt1_res', 80, 'Turn filter 1 RES (B) up to 80', 'Resonance feeds the filter output back to its input, ringing at the cutoff frequency.', 'The upper edge of your band now sings - a resonant band-pass is the classic vocal "formant" trick.', APA('FILTERS', '84-85'), 'filter-resonance'),
      step('t1_flt1_overdrive', 50, 'Turn encoder C (OVR) to 50', 'Driving a circuit into saturation clips the waveform, adding new harmonics that the filters then shape.', 'Overdrive happens at the filter input, so it thickens the sound before the band is carved out.', APA('FILTERS', '84-85'), 'filter-type'),
      info('Now experiment: try filter 2 types BP, BS (band-stop) and PK (peak) against filter 1.', 'Any filter shape can be built by chaining simpler ones - this is how EQs and formant filters work.', 'Tip: filter 2 at HP2 with FRQ 0 is effectively off; LP2 at 127 also passes everything.', APA('FILTERS', '84-85'), 'filter-type'),
    ],
  },

  // ==========================================================================
  {
    id: 'a4-envelopes',
    device: 'analog-four',
    name: 'Amp envelopes: plucks versus pads',
    description: 'Shape the same oscillator into a percussive pluck, then a slow pad, with EnvA and trig length.',
    difficulty: 'intermediate',
    source: 'Elektron Analog Four MKII User Manual - Appendix A, AMP page',
    estimatedMinutes: 8,
    prerequisites: ['a4-navigation'],
    tags: ['envelope', 'pluck', 'pad'],
    concepts: ['envelope-attack', 'envelope-decay', 'envelope-sustain', 'envelope-release'],
    steps: [
      track(0),
      page(PAGE.AMP, 'AMP', 'ATK DEC SUS REL are EnvA, the amplitude envelope; the bottom row holds the FX sends, pan and volume. Press [PLAY] (Space) to hear your changes.'),
      step('t1_amp_sustain', 0, 'Turn encoder C (SUS) to 0', 'With zero sustain the sound decays to silence even while the key or gate is held - the essence of percussion.', 'Plucked strings and drums never sustain: energy goes in once and dies away.', APA('AMP', '84-85'), 'envelope-sustain'),
      step('t1_amp_decay', 36, 'Turn encoder B (DEC) to about 36', 'The decay time sets how long a percussive sound rings; short decays sound tight, long ones ring out.', 'Around 36 gives a short, snappy pluck.', APA('AMP', '84-85'), 'envelope-decay'),
      step('t1_amp_attack', 90, 'Now turn encoder A (ATK) to 90', 'A slow attack hides the onset of a note, and our ears read slow onsets as soft, bowed or breathed sounds.', 'With SUS at 0 the note fades in and straight out again - next we give it a body.', APA('AMP', '84-85'), 'envelope-attack'),
      step('t1_amp_sustain', 110, 'Turn SUS back up to 110', 'Sustain is a level, not a time: it is how loud the note stays while the gate is open.', 'Attack, then a held level - the shape of a pad.', APA('AMP', '84-85'), 'envelope-sustain'),
      step('t1_amp_release', 90, 'Turn encoder D (REL) to 90', 'Release is how long the sound takes to fade after the gate closes; long releases let notes overlap and blur.', 'Pads use long releases so chords melt into each other.', APA('AMP', '84-85'), 'envelope-release'),
      page(PAGE.TRIG, 'TRIG', 'The TRIG page sets the note, velocity and length of new trigs.'),
      step('t1_trig_len', 4, 'Turn encoder C (LEN) to 4', 'A note\'s length is the gate time: sustain and release only matter if the gate stays open long enough to reach them.', 'Four steps = one beat, so each note now holds until the next one.', 'Manual - Sequencer, TRIG parameters page', 'envelope-sustain'),
      info('Now experiment: make a pluck (ATK 0, SUS 0, short DEC) and a pad (slow ATK, high SUS, long REL), and try SHP (E) = LIN.', 'Every instrument sound has an amplitude contour; the envelope is a recipe for it.', 'Exponential curves sound natural because real resonators lose a fixed fraction of their energy each cycle.', APA('AMP', '84-85'), 'envelope-shape'),
    ],
  },

  // ==========================================================================
  {
    id: 'a4-lfo',
    device: 'analog-four',
    name: 'LFO destinations',
    description: 'Point an LFO at different destinations: filter sweeps, vibrato, and a one-shot pitch drop.',
    difficulty: 'intermediate',
    source: 'Elektron Analog Four MKII User Manual - Appendix A, LFO pages',
    estimatedMinutes: 8,
    prerequisites: ['a4-filters-series'],
    tags: ['lfo', 'modulation'],
    concepts: ['lfo', 'modulation-source', 'modulation-depth'],
    steps: [
      track(0),
      page(PAGE.LFO1, 'LFO', 'LFO 1: SPD MUL FAD SPH MOD on top, WAV and two destination / depth pairs below. Press [LFO] again for LFO 2.'),
      step('t1_lfo1_dest_a', 8, 'Turn encoder G (DST) to F1 FRQ', 'An LFO is just another oscillator, slowed below hearing, used to move a parameter instead of making sound.', 'Nothing happens yet - the depth is zero.', APA('LFO 1', '87'), 'modulation-source'),
      step('t1_lfo1_depth_a', 30, 'Turn encoder H (DEP) to +30', 'Modulation depth scales how far the LFO pushes its destination either side of the knob setting.', 'The filter now sweeps up and down around its FRQ setting.', APA('LFO 1', '87'), 'modulation-depth'),
      step('t1_lfo1_wave', 1, 'Turn encoder F (WAV) to SIN', 'The LFO waveform is the shape of the movement: a sine glides, a square jumps, RND steps randomly.', 'Try SQR and RND too before moving on.', APA('LFO 1', '87'), 'lfo'),
      step('t1_lfo1_speed', 16, 'Turn encoder A (SPD) to 16', 'Tempo-synced LFOs tie movement to the music: here SPD x MUL = 64 gives one cycle every two bars.', 'With MUL at 4, SPD 16 is a slow two-bar sweep.', APA('LFO 1', '87'), 'lfo'),
      step('t1_lfo1_dest_b', 1, 'Turn encoder I (second DST) to O1 TUN', 'Each LFO can drive two destinations at once with separate depths.', 'Destination B moves oscillator 1 pitch.', APA('LFO 1', '87'), 'modulation-source'),
      step('t1_lfo1_depth_b', 2, 'Turn encoder J (DEP) to +2', 'Small, fast pitch modulation is vibrato; large modulation becomes a siren or a pitch effect.', 'A slow LFO on pitch drifts; speed it up (SPD) for vibrato.', APA('LFO 1', '87'), 'modulation-depth'),
      step('t1_lfo1_mode', 1, 'Turn encoder E (MOD) to TRG', 'Restarting an LFO on every note makes each note move the same way, instead of landing at random points in the cycle.', 'ONE plays a single cycle per note - with EXP waveform on O1 TUN that is a drum-style pitch drop.', APA('LFO 1', '87'), 'lfo'),
      info('Now experiment: try MOD ONE with WAV EXP, SPD 63, MUL 8 and DST O1 TUN at full depth - a kick-drum pitch sweep.', 'Envelopes and one-shot LFOs are the same idea: a shape that starts on each note.', 'Negative FAD fades the modulation in after each trig - delayed vibrato.', APA('LFO 1', '87'), 'modulation-source'),
    ],
  },

  // ==========================================================================
  {
    id: 'a4-pattern',
    device: 'analog-four',
    name: 'Programming a 16-step pattern',
    description: 'Trigs, rests, the off-beat and syncopation on the 16 trig keys.',
    difficulty: 'beginner',
    source: 'Elektron Analog Four MKII User Manual - Sequencer, GRID RECORDING',
    estimatedMinutes: 8,
    prerequisites: ['a4-navigation'],
    tags: ['sequencer', 'rhythm'],
    concepts: ['sequencer-pattern', 'timing-tempo'],
    steps: [
      track(1, 'The trig keys now show track 2\'s pattern (empty). REC is lit, so tapping a trig key places or removes a trig.'),
      step('play', true, 'Press [PLAY]', 'Programming while the loop plays lets you hear each trig the moment it lands.', 'Track 1 keeps the beat on every quarter note.', 'Manual - Front panel, [PLAY]', 'timing-tempo'),
      step('t2_pattern', '1000100010001000', 'Tap trig keys 1, 5, 9 and 13', 'Sixteen steps divide a 4/4 bar into sixteenth notes, so every fourth step falls on a beat.', 'This "four on the floor" doubles track 1 - steady, but static.', 'Manual - Sequencer, GRID RECORDING mode', 'sequencer-pattern'),
      step('t2_pattern', '0010001000100010', 'Clear 1, 5, 9, 13 and place trigs on 3, 7, 11 and 15 instead', 'The off-beat (the "and" between beats) creates forward motion, because it answers the downbeat.', 'Bass on the off-beat against a kick on the beat is the engine of house and techno.', 'Manual - Sequencer, GRID RECORDING mode', 'sequencer-pattern'),
      step('t2_pattern', '1001001000100010', 'Now try 1, 4, 7, 11 and 15', 'Syncopation places accents where the listener does not expect them, which the brain hears as groove.', 'The 3 + 3 + 2 spacing at the start (1, 4, 7) is the "tresillo" rhythm found across Latin and pop music.', 'Manual - Sequencer, GRID RECORDING mode', 'sequencer-pattern'),
      page(PAGE.TRIG, 'TRIG', 'NOTE sets the pitch of trigs on this track.'),
      step('t2_trig_note', 36, 'Turn encoder A (NOTE) to C2', 'Rhythm and register work together: low notes carry the groove, high notes decorate it.', 'Rests are as important as notes - the gaps are what make the rhythm readable.', 'Manual - Sequencer, TRIG parameters page', 'sequencer-pattern'),
      info('Now experiment: tap trigs in and out while it plays; a short tap toggles a trig, holding one opens it for parameter locks.', 'Most dance grooves are a few trigs per bar placed with care, not many.', 'Hold a trig and turn NOTE to give that step its own pitch - your first melody.', SEQ, 'sequencer-pattern'),
    ],
  },

  // ==========================================================================
  {
    id: 'a4-plocks',
    device: 'analog-four',
    name: 'Parameter locks',
    description: 'Give individual steps their own filter, note and envelope settings - per-step variation, the Elektron way.',
    difficulty: 'advanced',
    source: 'Elektron Analog Four MKII User Manual - Sequencer, Parameter locks',
    estimatedMinutes: 10,
    prerequisites: ['a4-pattern'],
    tags: ['parameter-locks', 'sequencer', 'melody'],
    concepts: ['parameter-locks', 'sequencer-pattern'],
    steps: [
      track(0),
      step('t1_pattern', '1010101010101010', 'Make track 1 play every other step: trigs 1, 3, 5 … 15', 'Eighth notes double the rate of quarter notes; more events give you more places to vary the sound.', 'Eight trigs per bar, all identical for now.', 'Manual - Sequencer, GRID RECORDING mode', 'sequencer-pattern'),
      step('play', true, 'Press [PLAY]', 'Variation is easier to judge against repetition, so listen to the plain loop first.', 'Every trig sounds the same.', 'Manual - Front panel, [PLAY]', 'timing-tempo'),
      page(PAGE.FILTERS, 'FILTER', 'We will lock filter 1 FRQ on single steps.'),
      step('t1_flt1_freq', 45, 'Set filter 1 FRQ (A) to about 45 for a dark base sound', 'A parameter lock overrides the track value for one trig only, so start with a track value you want most steps to have.', 'This is the track value every unlocked trig uses.', APA('FILTERS', '84-85'), 'filter-cutoff'),
      info('Hold trig key 5 and, while holding, turn encoder A up to about 100. Let go.', 'A parameter lock stores a different value for one step; the sequencer recalls it the instant that step plays.', 'On a mouse, press and hold trig 5 for half a second - it stays latched (orange outline, encoders turn orange) until you tap it again. The trig gets a white dot and the screen shows locked values inverted.', LOCKS, 'parameter-locks'),
      info('Lock trig 13 to a different FRQ, then hold trig 15 and turn encoder B (RES) up.', 'Per-step variation turns a loop into a phrase: the same notes, a different sound on each.', 'Each trig can hold several locks (up to six here). Unlocked trigs snap back to the track value.', LOCKS, 'parameter-locks'),
      page(PAGE.TRIG, 'TRIG', 'NOTE can be locked per step too - that is how melodies are programmed.'),
      info('Hold trig 3 and turn NOTE (A) up a few semitones; do the same on trigs 7 and 11 with other notes.', 'A melody is a sequence of pitches over a rhythm: locking NOTE per step writes one without a keyboard.', 'To remove a lock: hold the trig and double-tap the encoder. Removing a trig clears its locks.', LOCKS, 'parameter-locks'),
      info('Now experiment: lock amp DEC on a few trigs for accents, or lock OSC 1 WAV on one step for a surprise.', 'Changing timbre in time is as musical as changing pitch.', 'Parameter locks are what make Elektron patterns feel alive with only 16 steps.', LOCKS, 'parameter-locks'),
    ],
  },

  // ==========================================================================
  {
    id: 'a4-fx',
    device: 'analog-four',
    name: 'FX sends and the FX track',
    description: 'Send a track to the delay and reverb, then shape the effects on the FX track.',
    difficulty: 'intermediate',
    source: 'Elektron Analog Four MKII User Manual - Appendix B, FX track parameters',
    estimatedMinutes: 8,
    prerequisites: ['a4-envelopes'],
    tags: ['fx', 'delay', 'reverb'],
    concepts: ['effects', 'gain-staging'],
    steps: [
      track(0),
      page(PAGE.AMP, 'AMP', 'CHO, DEL and REV (encoders F, G, H) are send levels to the shared effects. Press [PLAY] (Space) so you can hear them.'),
      step('t1_amp_delay', 70, 'Turn encoder G (DEL) to 70', 'A send copies part of a signal to a shared effect while the dry signal continues unchanged.', 'Four tracks can share one delay, each with its own amount - the same idea as aux sends on a mixing desk.', APA('AMP', '84-85'), 'effects'),
      track(4, 'The FX track has no oscillators: its pages hold the chorus, delay and reverb (the grey legends under the PARAMETER keys).'),
      page(PAGE.FILTERS, 'FILTER', 'With the FX track selected, the FILTER key opens DELAY (its grey legend).'),
      step('fx_del_time', 16, 'Turn encoder A (TIM) to 16', 'Tempo-synced delay times are fractions of a beat: 16/128 of a bar is an eighth note.', 'TIM is counted in 128th notes, so 32 = a quarter note and 24 = a dotted eighth.', APB('DELAY'), 'effects'),
      step('fx_del_fb', 85, 'Turn encoder B (FB) to 85', 'Feedback sends the echo back into the delay, so each repeat produces another, quieter one.', 'High feedback gives long trails; near the top it builds up - careful.', APB('DELAY'), 'effects'),
      page(PAGE.AMP, 'AMP', 'On the FX track the AMP key opens REVERB.'),
      step('fx_rev_decay', 100, 'Turn encoder B (DEC) to 100', 'Reverb simulates thousands of reflections; its decay is how long the room takes to fall silent.', 'Send track 1 to it with REV on its AMP page to hear the room.', APB('REVERB'), 'effects'),
      info('Now experiment: go back to TRK 1 › AMP and raise REV (H); try the CHORUS page (OSC 2 key on the FX track).', 'Wet/dry balance decides how far away a sound seems: more reverb, more distance.', 'Delay into reverb (DELAY page REV) gives echoes that bloom into space.', APB('CHORUS'), 'effects'),
    ],
  },

  // ==========================================================================
  {
    id: 'a4-groove',
    device: 'analog-four',
    name: 'Build a four-track groove',
    description: 'Give each track one job - pulse, bass, snare, hats - and use mutes to arrange them.',
    difficulty: 'advanced',
    source: 'Elektron Analog Four MKII User Manual - Sequencer',
    estimatedMinutes: 12,
    prerequisites: ['a4-pattern', 'a4-envelopes'],
    tags: ['groove', 'arrangement', 'mutes'],
    concepts: ['sequencer-pattern', 'noise', 'mixing', 'polyrhythm'],
    steps: [
      track(1, 'Track 1 already pulses on the beat. Track 2 will be the bass.'),
      step('t2_pattern', '0010001000100010', 'On track 2 place trigs on 3, 7, 11 and 15', 'Splitting the bar between instruments - kick on the beat, bass between - keeps parts from masking each other in time.', 'The off-beat bass answers the pulse.', 'Manual - Sequencer, GRID RECORDING mode', 'sequencer-pattern'),
      track(2, 'Track 3 becomes a noise snare.'),
      page(PAGE.OSC1, 'OSC 1', 'The noise generator lives on the OSC 1 secondary page.'),
      page(PAGE.NOISE, 'OSC 1', 'NOISE: FAD (D) and LEV (E).', true),
      step('t3_noise_level', 110, 'Turn encoder E (LEV) to 110', 'White noise contains all frequencies equally, which our ears hear as a hiss - the body of snares and hats.', 'Set amp DEC short on the AMP page for a crisp hit.', APA('NOISE', '82-83'), 'noise'),
      step('t3_pattern', '0000100000001000', 'Place trigs on 5 and 13 for a backbeat', 'Beats 2 and 4 - the backbeat - are where most popular music puts its snare.', 'Press [PLAY] (Space) if it is not running: pulse, bass and snare now interlock.', 'Manual - Sequencer, GRID RECORDING mode', 'sequencer-pattern'),
      step('func', true, 'Press [FUNC] so the trig keys become mute keys', 'Arrangement is mostly subtraction: removing a part makes its return feel like an event.', 'With FUNC lit, trig keys 1-4 mute and unmute tracks 1-4.', 'Manual - Sequencer, track mutes', 'mixing'),
      step('mutes', '0100', 'Tap trig key 2 to mute the bass', 'Taking the bass away lifts the energy and builds anticipation for its return.', 'Unmute it on a downbeat for maximum impact, then press FUNC again to go back to editing trigs.', 'Manual - Sequencer, track mutes', 'mixing'),
      info('Now experiment: add hats on track 4, p-lock the snare, and arrange with mutes. The "Four-track groove" preset shows one finished version.', 'Good grooves give every part its own space in time, pitch and stereo.', 'Load the preset and study each track\'s pages and locks.', SEQ, 'sequencer-pattern'),
    ],
  },
];
