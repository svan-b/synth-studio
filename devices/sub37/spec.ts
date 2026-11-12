// ============================================================================
// MOOG SUB 37 (Subsequent 37 sound engine)
// 2-note paraphonic analog synthesizer: two variable-waveshape VCOs, a square
// sub oscillator one octave below OSC 1, pink noise, mixer feedback / EXT IN,
// a 20 Hz-20 kHz Moog ladder with 6/12/18/24 dB slopes and MultiDrive, two
// DAHDSR envelopes, two modulation busses, glide, an arpeggiator with a 64-step
// sequencer, 37 keys with pitch and mod wheels.
//
// Every label, range and switch position is checked against the Subsequent 37
// owner's manual (the Sub 37 v1.1 manual has the same pages); REFERENCE.md cites
// the page for each. Knob scales follow the panel's own calibrations: mixer
// levels, RESONANCE and MULTIDRIVE 0-10, the bipolar amounts -5..+5, KB TRACK
// 0-2, GLIDE TIME 0-10. Values are stored as % / ms / Hz so the readouts can
// show the panel scale without changing what is saved. Presets: ./presets.ts.
// ============================================================================

import type { ControlSpec, DeviceSpec, KnobSpec } from '@/types';
import {
  ARP_RANGES, BEND_DESTS, DIVISIONS, DIV_QUARTER, DIV_SIXTEENTH, DEFAULT_SEQ, END_NOTES, FINE_TUNE_CENTS, GATE_SOURCES,
  GLIDE_TYPES, KB_CTRL, KEY_PRIORITY, MOD_DESTS, MOD_SOURCES, OCTAVES, OSC_SEL, PATTERNS, PGM_DESTS, PGM_SOURCES,
  REF_NOTES, SEQ_STEPS, SLOPES,
  formatBipolar, formatCents, formatDial, formatDivision, formatHzBeat, formatOctave, formatPattern, formatPctOff,
  formatRatio, formatSemis, formatSignedPctOff, formatSource, formatSwing, formatWave, formatGlide, formatVolume,
  GLIDE_MIN_MS, GLIDE_MAX_MS, glideMsFromDial,
} from './model';
import { SUB37_PRESETS } from './presets';

export const MANUAL = 'Subsequent 37 manual';
const P = {
  banks: `${MANUAL} – Bank & preset selection (p.12)`,
  programming: `${MANUAL} – Programming section (pp.13-14)`,
  keys: `${MANUAL} – KB OCTAVE buttons and quick transpose (p.14)`,
  arp: `${MANUAL} – Arpeggiator section (pp.15-16)`,
  seq: `${MANUAL} – Step sequencer (p.17)`,
  stepEdit: `${MANUAL} – Step edit mode (pp.18-20)`,
  glide: `${MANUAL} – Glide section (p.21)`,
  mod: `${MANUAL} – Modulation controls (pp.22-23)`,
  modDest: `${MANUAL} – MOD DEST destinations (p.24)`,
  modCtl: `${MANUAL} – Controllers menu (pp.50-52)`,
  osc: `${MANUAL} – Oscillators section (p.25)`,
  osc2: `${MANUAL} – Hard sync, KB reset, duo mode, KB CTRL, frequency, beat (p.26)`,
  mixer: `${MANUAL} – Mixer section (p.27)`,
  filter: `${MANUAL} – Filter controls (p.28)`,
  slope: `${MANUAL} – Slope, EG amount, KB track (p.29)`,
  feg: `${MANUAL} – Filter envelope controls (pp.30-32)`,
  aeg: `${MANUAL} – Amplifier envelope controls (pp.32-33)`,
  output: `${MANUAL} – Output section (p.34)`,
  presetArp: `${MANUAL} – Preset edit: arpeggiator (p.40)`,
  presetSeq: `${MANUAL} – Preset edit: sequencer (pp.40-41)`,
  presetEg: `${MANUAL} – Preset edit: filter EG / amp EG (pp.41-42)`,
  presetPerf: `${MANUAL} – Preset edit: KB priority, bend, preset volume (p.42)`,
  global: `${MANUAL} – Global menu: sequencer options (pp.46-47)`,
  wheels: `${MANUAL} – Pitch wheel (p.42) and mod wheel (p.22)`,
};
export const MANUAL_PAGES = P;

/** 0-100 % of travel, shown on the panel's 0-10 calibration */
const dial = (label: string, description: string, manualReference: string, def = 0, extra: Partial<KnobSpec> = {}): KnobSpec => ({
  type: 'knob', label, description, manualReference, min: 0, max: 100, default: def, units: '%', format: formatDial, ...extra,
});
/** -100..+100 %, shown on the panel's -5..+5 calibration */
const bipolar = (label: string, description: string, manualReference: string, def = 0): KnobSpec => ({
  type: 'knob', label, description, manualReference, min: -100, max: 100, default: def, units: '%', bipolar: true, format: formatBipolar,
});
const pct = (label: string, description: string, manualReference: string, def = 0, extra: Partial<KnobSpec> = {}): KnobSpec => ({
  type: 'knob', label, description, manualReference, min: 0, max: 100, default: def, units: '%', ...extra,
});
/** ATTACK, DECAY, RELEASE: 1 ms - 10 s (pp.30-32) */
const timeMs = (label: string, description: string, manualReference: string, def: number): KnobSpec => ({
  type: 'knob', label, description, manualReference, min: 1, max: 10000, default: def, units: 'ms', curve: 'logarithmic',
});
/** DELAY, HOLD: 0 - 10 s (pp.31-33) */
const zeroMs = (label: string, description: string, manualReference: string): KnobSpec => ({
  type: 'knob', label, description, manualReference, min: 0, max: 10000, default: 0, units: 'ms', curve: 'exponential',
});
const btn = (label: string, description: string, manualReference: string, def = false): ControlSpec => ({
  type: 'button', label, description, manualReference, default: def, ledColor: '#ff3b30',
});
const sw = (label: string, options: string[], description: string, manualReference: string, def = 0): ControlSpec => ({
  type: 'switch', label, options, description, manualReference, default: def,
});
const stepped = (label: string, options: string[], format: (v: number) => string, description: string, manualReference: string, def: number): KnobSpec => ({
  type: 'knob', label, description, manualReference, min: 0, max: options.length - 1, step: 1, default: def, units: 'none', format,
});
const divisionKnob = (label: string, description: string, manualReference: string, def: number): KnobSpec =>
  stepped(label, DIVISIONS.map(d => d.label), formatDivision, description, manualReference, def);
/** CONTROLLERS amounts: -100 % .. OFF .. +100 % (p.50) */
const ctlAmt = (label: string, description: string, def: number): KnobSpec => ({
  type: 'knob', label, description, manualReference: P.modCtl, min: -100, max: 100, default: def, units: '%', bipolar: true, format: formatSignedPctOff,
});

// ---------------------------------------------------------------------------
// MOD 1 / MOD 2 (pp.22-24, 50-52)
// ---------------------------------------------------------------------------

function modBus(n: 1 | 2): Record<string, ControlSpec> {
  const other = n === 1 ? 2 : 1;
  const depthNote = n === 1
    ? ' By default the MOD wheel sets MOD 1\'s depth (CONTROLLERS: MOD WHEEL +100 %).'
    : ' MOD 2 runs at full depth by default (every CONTROLLERS amount OFF).';
  return {
    [`mod${n}_rate`]: {
      type: 'knob', label: 'RATE', min: 0.1, max: 100, default: n === 1 ? 5 : 1, units: 'Hz', curve: 'logarithmic',
      description: `LFO ${n} RATE: 0.1-100 Hz, ten times faster (1-1000 Hz) with HI RANGE. With SYNC lit the knob picks a clock division instead.`,
      manualReference: P.mod,
    },
    [`mod${n}_div`]: divisionKnob('RATE', `LFO ${n} RATE while SYNC is lit: a division of the clock (the studio while ARP SYNC is lit, else the arpeggiator RATE), 4 whole notes to 1/64 triplets.`, P.mod, DIV_QUARTER),
    [`mod${n}_source`]: stepped('SOURCE', MOD_SOURCES, formatSource,
      `MOD ${n} source: the LFO as triangle, square, saw, ramp (reverse saw) or sample & hold - or F.EG/PGM, which bypasses the LFO for the filter envelope (or the PGM SRC set in CONTROLLERS).`,
      P.mod, 0),
    [`mod${n}_hi_range`]: btn('HI RANGE', `LFO ${n} runs ten times faster: 1 Hz-1 kHz, into audio-rate FM tones.`, P.mod),
    [`mod${n}_sync`]: btn('SYNC', `LFO ${n} locks to the clock: RATE picks a division and the phase follows the clock.`, P.mod),
    [`mod${n}_kb_reset`]: btn('KB RESET', `LFO ${n} restarts its cycle at zero on every new note, so each note's vibrato or wobble starts the same.`, P.mod),
    [`mod${n}_pitch_amt`]: bipolar('PITCH AMT', `How far MOD ${n} moves oscillator pitch; below 12 o'clock the modulation is inverted.${depthNote}`, P.mod),
    [`mod${n}_pitch_dest`]: sw('OSC', OSC_SEL, `Which oscillators PITCH AMT reaches: both, OSC 1 or OSC 2 (the LEDs 1 and 2).`, P.mod),
    [`mod${n}_filter_amt`]: bipolar('FILTER AMT', `How far MOD ${n} moves the filter cutoff; below 12 o'clock it is inverted.${depthNote}`, P.mod),
    [`mod${n}_dest`]: {
      type: 'switch', label: 'MOD DEST', options: MOD_DESTS, default: 1,
      description: `Where MOD AMT goes: LFO ${other}'s RATE, VCA LEVEL, OSC 1 / OSC 1+2 / OSC 2 WAVE, NOISE LEVEL, or EG TIME/PGM (the programmable destination in CONTROLLERS). Hold MOD DEST and move a control to make that control the PGM destination.`,
      manualReference: P.modDest,
    },
    [`mod${n}_mod_amt`]: bipolar('MOD AMT', `How much MOD ${n} reaches the MOD DEST destination (bipolar).`, P.mod),
    // CONTROLLERS menu (LCD)
    [`mod${n}_wheel`]: ctlAmt('MOD WHEEL', `MOD ${n} depth with the mod wheel all the way up (negative inverts). With every CONTROLLERS amount OFF the bus runs at full depth.`, n === 1 ? 100 : 0),
    [`mod${n}_vel`]: ctlAmt('VELOCITY', `MOD ${n} depth at the fastest key strike.`, 0),
    [`mod${n}_pgm_src`]: sw('PGM SRC', PGM_SOURCES, `What SOURCE F.EG/PGM means for MOD ${n}: the filter envelope (default), the amp envelope, a constant, an extra sine or noise LFO, an oscillator's pitch, the sequencer's note / velocity / mod value, pressure, key tracking or velocity.`, P.modCtl),
    [`mod${n}_pgm_dst`]: sw('PGM DST', PGM_DESTS, `The destination behind MOD DEST EG TIME/PGM (default EG TIME: every envelope time, longer for positive amounts).`, P.modCtl),
    [`mod${n}_lfo_kb`]: pct('LFO KBTRACK', `LFO ${n} speeds up as you play higher (0-200 %; 100 % = one octave of rate per octave, around MIDI 48).`, P.modCtl, 0, { max: 200, format: formatPctOff }),
  };
}

// ---------------------------------------------------------------------------
// Envelopes (KNOB SHIFT turns ATTACK / DECAY / SUSTAIN / RELEASE into DELAY / HOLD / VEL AMT / KB TRACK)
// ---------------------------------------------------------------------------

function envelope(p: 'feg' | 'aeg', name: string, ref: string, d: { a: number; d: number; s: number; r: number }): Record<string, ControlSpec> {
  const amp = p === 'aeg';
  return {
    [`${p}_attack`]: timeMs('ATTACK', `${name}: time from the gate to the peak, 1 ms-10 s.`, ref, d.a),
    [`${p}_decay`]: timeMs('DECAY', `${name}: time from the peak down to the sustain level, 1 ms-10 s.`, ref, d.d),
    [`${p}_sustain`]: pct('SUSTAIN', `${name}: the level held while the gate is on (0-100 %, the panel calibrates it 1-10).`, ref, d.s),
    [`${p}_release`]: timeMs('RELEASE', `${name}: time to fall back after the gate ends, 1 ms-10 s.`, ref, d.r),
    [`${p}_delay`]: zeroMs('DELAY', `${name} (KNOB SHIFT + ATTACK): a pause before the attack, 0-10 s.${amp ? ' On the AMP EG it only works with LOOP on.' : ''}`, ref),
    [`${p}_hold`]: zeroMs('HOLD', `${name} (KNOB SHIFT + DECAY): time held at the peak before the decay, 0-10 s.`, ref),
    [`${p}_vel_amt`]: pct('VEL AMT', `${name} (KNOB SHIFT + SUSTAIN): the hardest strike always gives the full amount; higher settings make softer notes ${amp ? 'quieter' : 'darker'}.`, ref, 0),
    [`${p}_kb_amt`]: {
      type: 'knob', label: 'KB TRACK', min: 0, max: 200, default: 0, units: '%', format: formatRatio,
      description: `${name} (KNOB SHIFT + RELEASE): DECAY and RELEASE get shorter up the keyboard: 0 to 2:1, 1:1 at 12 o'clock.`,
      manualReference: ref,
    },
    [`${p}_multi_trig`]: btn('MULTI TRIG', 'Lit: every key press is a new gate, even when you play legato. Unlit (single trigger): overlapping notes do not restart the envelope.', ref),
    [`${p}_reset`]: btn('RESET', 'Lit: each attack starts from zero. Unlit: it rises from wherever the envelope is.', ref),
    [`${p}_sync`]: btn('SYNC', 'Lit: the envelope restarts on every CLOCK DIV (PRESET EDIT) while the gate is held.', ref),
    [`${p}_loop`]: btn('LOOP', 'Lit: while the gate is held, delay, attack, hold, decay and release repeat - a multistage LFO.', ref),
    [`${p}_latch`]: btn('LATCH ON', 'Lit: the envelope stays at its SUSTAIN level as if the gate were on.', ref),
    [`${p}_attack_exp`]: sw('EXP. ATTACK', ['OFF', 'ON'], `${name} attack curve: linear (OFF, default) or exponential (steeper on its way up).`, P.presetEg),
    [`${p}_gate_src`]: sw('GATE SRC', GATE_SOURCES, `What triggers the ${name}: keys, arpeggiator and the KB GATE jack (BOTH), only keys and arpeggiator (NOTES), or only the KB GATE jack (EXT).`, P.presetEg),
    [`${p}_sync_div`]: divisionKnob('CLOCK DIV', `${name} SYNC: restart every this many clock divisions.`, P.presetEg, DIV_QUARTER),
  };
}

const controls: Record<string, ControlSpec> = {
  // ===== PROGRAMMING ===========================================================
  fine_tune: {
    type: 'knob', label: 'FINE TUNE', min: -FINE_TUNE_CENTS, max: FINE_TUNE_CENTS, default: 0, units: 'cents', bipolar: true, format: formatCents,
    description: 'Tunes both oscillators up to a semitone up or down, to match other instruments.',
    manualReference: P.programming,
  },
  preset_bank: { type: 'knob', label: 'BANK', min: 1, max: 16, default: 1, step: 1, units: 'none', format: v => String(Math.round(v)), description: 'Selected bank: press BANK, then a PRESET button.', manualReference: P.banks },
  preset_number: { type: 'knob', label: 'PRESET', min: 0, max: 16, default: 0, step: 1, units: 'none', format: v => (v ? String(Math.round(v)) : 'PANEL'), description: 'Selected preset in the bank (0 = the live panel).', manualReference: P.banks },
  key_priority: sw('KB PRIORITY', KEY_PRIORITY, 'Which key a mono patch plays when several are held: the last pressed (default), the lowest or the highest.', P.presetPerf, 0),
  bend_up: { type: 'knob', label: 'BEND UP', min: 0, max: 24, default: 2, step: 1, units: 'semitones', description: 'PITCH wheel range up: +0 to +24 semitones (default +2).', manualReference: P.presetPerf },
  bend_down: { type: 'knob', label: 'BEND DOWN', min: 0, max: 24, default: 2, step: 1, units: 'semitones', description: 'PITCH wheel range down: -0 to -24 semitones (default -2).', manualReference: P.presetPerf },
  bend_dest: sw('BEND DEST', BEND_DESTS, 'Which oscillators the PITCH wheel bends: none, OSC 1, OSC 2 or both (default).', P.presetPerf, 3),
  kb_transpose: { type: 'knob', label: 'KB TRANSPOSE', min: -12, max: 12, default: 0, step: 1, units: 'semitones', bipolar: true, description: 'Transposes the keyboard by -12 to +12 semitones; stored with the preset. Hold both KB OCTAVE buttons and press a key to set it.', manualReference: P.keys },
  preset_volume: pct('PRESET VOL', 'Scales this preset\'s level, to match loud and soft patches (default 100 %). OFF leaves the level to the VOLUME knob alone.', P.presetPerf, 100, { format: formatPctOff }),

  // ===== ARPEGGIATOR / SEQUENCER ===============================================
  arp_rate: {
    type: 'knob', label: 'RATE', min: 2, max: 280, default: 120, units: 'BPM', curve: 'logarithmic',
    description: 'The internal clock, 2-280 BPM: the arpeggiator steps at its CLOCK DIV. With SYNC lit the knob picks the clock division instead.',
    manualReference: P.arp,
  },
  arp_div: divisionKnob('CLOCK DIV', 'Arpeggiator / sequencer note length against the clock (PRESET EDIT; the RATE knob while SYNC is lit): 4 whole notes to a 1/64 triplet.', P.presetArp, DIV_SIXTEENTH),
  arp_sync: btn('SYNC / TAP', 'Lit: the arpeggiator follows MIDI clock - here the studio transport: it plays while ▶ runs, at the studio tempo, and RATE picks a division. Without a clock it does not play.', P.arp),
  arp_oct_range: sw('RANGE', ARP_RANGES, 'Octaves the arpeggio spans below or above the keys, -2 to +2; one press past either end lights 0 and ±2: three octaves, then back to the second.', P.arp, 3),
  arp_back_fwd: btn('BACK / FORTH', 'UP plays up then down, DWN down then up, ORDR in order then reversed (C-E-G-E-C). No effect on RND.', P.arp),
  arp_invert: btn('INVERT', 'Each note plays in every octave of the RANGE before the next note (C, C+12, E, E+12...). No effect at RANGE 0.', P.arp),
  arp_pattern: stepped('PATTERN', PATTERNS, formatPattern,
    'UP (low to high), DWN, ORDR (the order you played), RND - or the step sequencer: REC records notes from the keys, SEQ plays them back from the key you press.',
    P.arp, 0),
  arp_on: btn('ON / REST', 'Arpeggiator on: held keys play one after another. While step recording (PATTERN REC) it enters a rest.', P.arp),
  arp_latch: btn('LATCH / TIE', 'Keeps the arpeggio or sequence going after you let go; keys added while others are held join it. While step recording it ties the last note to the next.', P.arp),
  arp_gate: pct('GATE LENGTH', 'How long each arpeggiator step holds its gate: OFF (no gate), 50 % (default: the envelopes release half way), 100 % legato.', P.presetArp, 50, { format: formatPctOff }),
  arp_swing: pct('SWING', '50 % is straight; above moves the off-beats later, below earlier; 100 % plays only the on-beats, 0 % only the off-beats.', P.presetArp, 50, { format: formatSwing }),
  arp_step1_reset: btn('STEP 1 RESET', 'ON: the KB RESETs (oscillators, LFOs) act only on the first note of the pattern; OFF: on every arpeggiated note.', P.presetArp),
  arp_end_notes: sw('END NOTES', END_NOTES, 'With BACK / FORTH: the turn-around notes play once (C-E-G-E-C) or twice (C-E-G-G-E-C-C).', P.presetArp, 0),
  arp_seq: { type: 'pattern', label: 'SEQ PITCH 1', steps: SEQ_STEPS, default: DEFAULT_SEQ.arp_seq, description: 'The 64-step sequence: each step\'s first note.', manualReference: P.seq },
  arp_seq2: { type: 'pattern', label: 'SEQ PITCH 2', steps: SEQ_STEPS, default: DEFAULT_SEQ.arp_seq2, description: 'Each step\'s second note (DUO MODE steps).', manualReference: P.seq },
  arp_seq_flags: { type: 'pattern', label: 'SEQ STEPS', steps: SEQ_STEPS, default: DEFAULT_SEQ.arp_seq_flags, description: 'Rests, ties, ratchets and skips of every step.', manualReference: P.stepEdit },
  seq_len: { type: 'knob', label: 'LAST STEP', min: 1, max: 64, default: DEFAULT_SEQ.seq_len, step: 1, units: 'steps', description: 'The sequence\'s last step; after it the sequence repeats from the first step.', manualReference: P.stepEdit },
  seq_first: { type: 'knob', label: 'FIRST STEP', min: 1, max: 64, default: 1, step: 1, units: 'steps', description: 'Where the sequence starts (set in step edit: hold a step and press KB OCTAVE down).', manualReference: P.stepEdit },
  seq_ratchet: { type: 'knob', label: 'RATCHET CNT', min: 1, max: 8, default: 2, step: 1, units: 'none', format: v => `${Math.round(v)}x`, description: 'How many times a ratcheted step repeats inside its own length (1x-8x, default 2x).', manualReference: P.presetSeq },
  seq_ref: sw('REF NOTE', REF_NOTES, 'GLOBAL: FIRST (default) - the key you press becomes the sequence\'s first note; MID C - middle C (MIDI 48) plays it as recorded and other keys transpose by their distance.', P.global, 0),
  latch_restart: btn('LATCH RSTRT', 'GLOBAL: ON - with LATCH lit, a new key with none held restarts the sequence from its first step; OFF (default) - it only transposes.', P.global),

  // ===== GLIDE ==================================================================
  glide_time: {
    type: 'knob', label: 'TIME', min: GLIDE_MIN_MS, max: GLIDE_MAX_MS, default: glideMsFromDial(2), units: 'ms', curve: 'logarithmic', format: formatGlide,
    description: 'How long the pitch takes to move to the next note. The panel prints 0-10 and no seconds; Moog\'s acid tip is 2 with EXP and LEGATO.',
    manualReference: P.glide,
  },
  glide_osc: sw('OSC', OSC_SEL, 'Which oscillators glide: both, OSC 1 or OSC 2 (the LEDs 1 and 2).', P.glide),
  glide_type: sw('TYPE', GLIDE_TYPES, 'LCR: constant rate, so bigger intervals take longer (the usual kind). LCT: the same time for any interval. EXP: fast, then slowing into the note.', P.glide),
  glide_gated: btn('GATED', 'Lit: the pitch glides only while a key is held. Unlit: it keeps gliding to the note after you let go.', P.glide),
  glide_legato: btn('LEGATO', 'Glide only when a key goes down while another is held (needs ON).', P.glide),
  glide_on: btn('ON', 'Glide on or off without touching TIME.', P.glide),

  // ===== MOD 1 / MOD 2 ==========================================================
  ...modBus(1),
  ...modBus(2),

  // ===== OSCILLATORS ============================================================
  osc1_octave: stepped('OCTAVE', OCTAVES, formatOctave, 'OSC 1 footage: 16\' (lowest) to 2\', four octaves.', P.osc, 1),
  osc1_wave: { type: 'knob', label: 'WAVE', min: 0, max: 100, default: 33, units: 'none', format: formatWave, description: 'Continuously variable: triangle → sawtooth → square → narrow pulse, with no steps between.', manualReference: P.osc },
  hard_sync: btn('HARD SYNC', 'OSC 2 restarts its cycle every time OSC 1 starts one, so OSC 2\'s pitch changes the tone. Keep OSC 2 at or above OSC 1 or it barely sounds.', P.osc2),
  kb_reset: btn('KB RESET', 'Both oscillators restart their cycles on every new note: the same hard attack every time (it may click; a short AMP release helps).', P.osc2),
  osc2_octave: stepped('OCTAVE', OCTAVES, formatOctave, 'OSC 2 footage: 16\' to 2\'.', P.osc, 1),
  osc2_wave: { type: 'knob', label: 'WAVE', min: 0, max: 100, default: 33, units: 'none', format: formatWave, description: 'OSC 2 waveshape: triangle → sawtooth → square → narrow pulse.', manualReference: P.osc },
  kb_ctrl: sw('KB CTRL', KB_CTRL, 'In DUO MODE: HI - OSC 2 takes the highest key, OSC 1 the lowest; LO - swapped; OFF (no LED) - OSC 2 drones and FREQUENCY spans ±3 octaves.', P.osc2, 2),
  duo_mode: btn('DUO MODE', 'Paraphonic: the two oscillators play two keys, through one filter, one VCA and one pair of envelopes.', P.osc2),
  osc2_frequency: {
    type: 'knob', label: 'FREQUENCY', min: -7, max: 7, default: 0, units: 'semitones', bipolar: true, format: formatSemis,
    description: 'Tunes OSC 2 up to 7 semitones either side of OSC 1 (fully clockwise is a fifth). With DUO MODE and KB CTRL OFF the range is ±3 octaves.',
    manualReference: P.osc2,
  },
  beat_freq: {
    type: 'knob', label: 'BEAT FREQ', min: -3.5, max: 3.5, default: 0, units: 'Hz', bipolar: true, format: formatHzBeat,
    description: 'Detunes OSC 2 by a fixed number of Hz (±3.5), so it beats at the same rate on every note; FREQUENCY detunes in cents instead.',
    manualReference: P.osc2,
  },

  // ===== MIXER ==================================================================
  mix_osc1: dial('OSC 1', 'OSC 1 level into the filter, 0-10. Above 5 it overdrives the filter input; 5 or below is clean.', P.mixer, 50),
  mix_sub: dial('SUB OSC', 'The sub oscillator: always a square, exactly one octave below OSC 1 (WAVE never changes it).', P.mixer, 0),
  mix_osc2: dial('OSC 2', 'OSC 2 level into the filter (above 5 overdrives it).', P.mixer, 0),
  mix_noise: dial('NOISE', 'Pink noise level (above 5 overdrives the filter).', P.mixer, 0),
  mix_feedback: dial('FDBK / EXT IN', 'With nothing in EXT IN: the mixer\'s output fed back into its own input - thicker, distorted, sometimes chaotic, and much louder. With a cable in EXT IN: that external audio\'s level.', P.mixer, 0),
  mix_osc1_on: btn('OSC 1', 'OSC 1 on / off in the mixer (the level stays where it is).', P.mixer, true),
  mix_sub_on: btn('SUB OSC', 'SUB OSC on / off.', P.mixer, true),
  mix_osc2_on: btn('OSC 2', 'OSC 2 on / off.', P.mixer, true),
  mix_noise_on: btn('NOISE', 'NOISE on / off.', P.mixer, true),
  mix_fb_on: btn('FDBK / EXT', 'FDBK / EXT IN on / off.', P.mixer, true),

  // ===== FILTER =================================================================
  cutoff: { type: 'knob', label: 'CUTOFF', min: 20, max: 20000, default: 20000, units: 'Hz', curve: 'logarithmic', size: 'large', description: 'Moog ladder cutoff: 20 Hz (closed) to 20 kHz (fully open).', manualReference: P.filter },
  resonance: dial('RESONANCE', 'Feeds the filter output back to its input: a peak at the cutoff. Above 7 the filter self-oscillates.', P.filter, 0),
  multidrive: dial('MULTIDRIVE', 'Drives the OTA and FET stages between the filter and the VCA: asymmetric, tube-like warmth turning into hard clipping.', P.filter, 0),
  filter_slope: sw('SLOPE', SLOPES, 'Filter slope above the cutoff: 1, 2, 3 or 4 poles (-6, -12, -18 or the classic -24 dB per octave). Changes while you play.', P.slope, 3),
  filter_eg_amt: bipolar('EG AMT', 'How far the Filter EG moves the cutoff: clockwise from centre it raises it, counter-clockwise it pulls it down.', P.slope, 0),
  filter_kb_amt: {
    type: 'knob', label: 'KB TRACK', min: 0, max: 200, default: 100, units: '%', format: formatRatio,
    description: 'How the cutoff follows the keys, around C3 (MIDI 48): fully left none, halfway 1:1 (an octave per octave), fully right 2:1.',
    manualReference: P.slope,
  },

  // ===== ENVELOPES ==============================================================
  ...envelope('feg', 'Filter EG', P.feg, { a: 1, d: 300, s: 100, r: 100 }),
  ...envelope('aeg', 'Amp EG', P.aeg, { a: 1, d: 300, s: 100, r: 100 }),
  knob_shift: btn('KNOB SHIFT', 'The eight envelope knobs become DELAY, HOLD, VEL AMT and KB TRACK (the button blinks).', P.feg),

  // ===== OUTPUT =================================================================
  master_volume: pct('VOLUME', 'Main output level (AUDIO OUT); the headphones follow it too.', P.output, 70, { format: formatVolume }),
  output_mute: btn('MUTE', 'Lit: AUDIO OUT is muted. The headphones keep playing, so you can listen privately.', P.output),
  phones_volume: pct('HEADPHONES', 'Headphone level, balanced against VOLUME (the headphone jack is mono on both sides).', P.output, 70, { format: formatVolume }),

  // ===== PERFORMANCE ============================================================
  pitch_bend: { type: 'knob', label: 'PITCH', min: -100, max: 100, default: 0, units: '%', bipolar: true, description: 'Pitch wheel: bends the BEND DEST oscillators by BEND UP / BEND DOWN semitones (±2 by default) and springs back to centre.', manualReference: P.wheels },
  mod_wheel: { type: 'knob', label: 'MOD', min: 0, max: 100, default: 0, units: '%', description: 'Mod wheel: sets MOD 1\'s depth by default (CONTROLLERS sets how much each bus follows it).', manualReference: P.wheels },
  kb_octave: { type: 'knob', label: 'KB OCTAVE', min: -2, max: 2, default: 0, step: 1, units: 'octaves', bipolar: true, description: 'Shifts the keyboard up to two octaves either way: dim LED one octave, bright two. Press both to reset.', manualReference: P.keys },
};

export const SUB37: DeviceSpec = {
  id: 'sub37',
  name: 'Sub 37',
  manufacturer: 'Moog',
  year: 2014,
  description: 'Sub 37 with the Subsequent 37 sound engine – 2-note paraphonic analog synthesizer: two variable-waveshape VCOs, sub oscillator, pink noise, mixer feedback, a Moog ladder with 6/12/18/24 dB slopes and MultiDrive, two DAHDSR envelopes, two mod busses, glide and an arpeggiator with a 64-step sequencer.',
  manualUrl: 'https://www.moogmusic.com/synthesizers/subsequent-37/',
  // 26.375" W x 14.75" D x 6.75" H (p.61)
  dimensions: { width: 670, height: 375, depth: 171 },
  display: { width: 1380, height: 600, scale: 2 },
  signalFlow: [
    { id: 'programming', name: 'Programming', order: 0, description: 'LCD, menus, FINE TUNE, banks and presets.', controls: ['fine_tune', 'key_priority', 'bend_up', 'bend_down', 'bend_dest', 'kb_transpose', 'preset_volume', 'preset_bank', 'preset_number'] },
    { id: 'oscillators', name: 'Oscillators', order: 1, description: 'Two variable-waveshape VCOs; OSC 2 tunes ±7 semitones and syncs to OSC 1; DUO MODE splits them across two keys.', controls: ['osc1_octave', 'osc1_wave', 'osc2_octave', 'osc2_wave', 'osc2_frequency', 'beat_freq', 'hard_sync', 'kb_reset', 'duo_mode', 'kb_ctrl'] },
    { id: 'mixer', name: 'Mixer', order: 2, description: 'OSC 1, SUB OSC, OSC 2, pink NOISE and FDBK / EXT IN; above 5 the filter input overdrives.', controls: ['mix_osc1', 'mix_sub', 'mix_osc2', 'mix_noise', 'mix_feedback', 'mix_osc1_on', 'mix_sub_on', 'mix_osc2_on', 'mix_noise_on', 'mix_fb_on'] },
    { id: 'filter', name: 'Filter', order: 3, description: 'Moog ladder, 20 Hz-20 kHz, 6/12/18/24 dB, self-oscillating above RESONANCE 7, MULTIDRIVE after it.', controls: ['cutoff', 'resonance', 'multidrive', 'filter_slope', 'filter_eg_amt', 'filter_kb_amt'] },
    { id: 'envelopes', name: 'Envelope generators', order: 4, description: 'Filter EG and Amp EG, DAHDSR with KNOB SHIFT, MULTI TRIG, RESET, SYNC, LOOP and LATCH ON.', controls: Object.keys(controls).filter(k => k.startsWith('feg_') || k.startsWith('aeg_')).concat('knob_shift') },
    { id: 'modulation', name: 'MOD 1 / MOD 2', order: 5, description: 'Two busses: an LFO or F.EG/PGM source to pitch, filter and a MOD DEST; MOD 1 follows the mod wheel.', controls: Object.keys(controls).filter(k => k.startsWith('mod1_') || k.startsWith('mod2_')) },
    { id: 'glide', name: 'Glide', order: 6, controls: ['glide_time', 'glide_osc', 'glide_type', 'glide_gated', 'glide_legato', 'glide_on'] },
    { id: 'arp', name: 'Arpeggiator / sequencer', order: 7, controls: ['arp_rate', 'arp_div', 'arp_sync', 'arp_oct_range', 'arp_back_fwd', 'arp_invert', 'arp_pattern', 'arp_on', 'arp_latch', 'arp_gate', 'arp_swing', 'arp_step1_reset', 'arp_end_notes', 'arp_seq', 'arp_seq2', 'arp_seq_flags', 'seq_len', 'seq_first', 'seq_ratchet', 'seq_ref', 'latch_restart'] },
    { id: 'output', name: 'Output and performance', order: 8, controls: ['master_volume', 'output_mute', 'phones_volume', 'pitch_bend', 'mod_wheel', 'kb_octave'] },
  ],
  controls,
  patchBay: {
    inputs: [
      { id: 'in_ext', label: 'EXT IN', jackType: 'input', signalType: 'audio', column: 0, row: 0 },
      { id: 'in_pitch', label: 'PITCH', jackType: 'input', signalType: 'cv', column: 1, row: 0 },
      { id: 'in_filter', label: 'FILTER', jackType: 'input', signalType: 'cv', column: 2, row: 0 },
      { id: 'in_volume', label: 'VOLUME', jackType: 'input', signalType: 'cv', column: 3, row: 0 },
      { id: 'in_gate', label: 'KB GATE', jackType: 'input', signalType: 'gate', column: 4, row: 0 },
    ],
    outputs: [
      { id: 'out_audio', label: 'AUDIO OUT', jackType: 'output', signalType: 'audio', column: 5, row: 0 },
      { id: 'out_phones', label: 'PHONES', jackType: 'output', signalType: 'audio', column: 6, row: 0 },
    ],
  },
  presets: SUB37_PRESETS,
};
