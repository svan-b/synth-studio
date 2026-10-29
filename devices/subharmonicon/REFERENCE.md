# Moog Subharmonicon - hardware reference for the digital twin

Ground truth used to build `devices/subharmonicon`: every control, LED and patch point with its
printed label, position, cap, range and (for jacks) its normal, the behaviour behind them, the
twin's model choices, and where every preset came from.

**Page numbers.** All three of Moog's documents were read in full (scratchpad `manuals/subharmonicon/`,
never committed). Cites use the page number **printed on the page**:

| Document | Cited as | Printed page vs PDF page |
|---|---|---|
| *Subharmonicon Owner's Manual* (58 pp) | (Subharmonicon manual, p.N) | printed = PDF + 1 (the folio on PDF page 30 reads "31") |
| *Subharmonicon: Patching with Intention* (16 pp) | (Patching with Intention, p.N) | printed = PDF |
| *Subharmonicon Exploration Patchbook* (10 patch sheets) | (Exploration Patchbook, p.N) | printed = PDF − 2 (patch n is printed p.n) |

The research notes in `docs/research/subharmonicon/` cite **PDF** pages, so their manual pages are one
lower than the ones here ("MAN p.32" there is p.33 here).

**Confidence.**
- **verified**: stated in one of Moog's documents (page cited), or read off its drawings.
- **likely**: a direct consequence of verified facts, or one good secondary source.
- **guess**: not documented; chosen by ear to fit the documented behaviour and listed again under
  "Model choices" so it can be checked against a unit.

This is the **2020 production Subharmonicon** (firmware 1.1.x). The 2018 Moogfest kit differs: saw-only
VCOs, SUB 2 pitch inputs and a TEMPO input instead of PWM inputs and MIDI IN.

## Sources

| Id | Source |
|---|---|
| M | Moog, *Subharmonicon Owner's Manual*. Panel tour pp.12-16, every control pp.18-30, every jack pp.31-37, sync recipes pp.38-39, Eurorack p.40, Fine Tune p.41, MIDI pp.42-44, ten patch sheets pp.45-49, blank sheets with the panel drawing pp.50-55, signal-flow diagram p.56, specifications p.57 |
| PWI | Moog, *Subharmonicon: Patching with Intention*. Initialized patch p.3, exercises pp.4-10, jack-by-jack patch ideas pp.12-15 |
| XPB | Moog, *Subharmonicon Exploration Patchbook*. Ten patch sheets, pp.1-10 (image only) |
| PS | patchscore (`github.com/miclip/patchscore`): measured every knob, button, switch and jack of the panel drawing (M p.50) from its vector paths; the twin's control positions are PS's, converted to the 304.8 x 128.5 mm faceplate |
| TE | Tallent Edition firmware (`github.com/brandon-tallent/subharmonicon-extended-firmware`), an extension of stock firmware 1.1.1: stock divider logic, its 12-JI test table, MIDI-note gate calls (`trigger_both_envelopes` / `release_both_envelopes`) |
| FW | Firmware 1.1.0 release coverage (March 2022: Synthtopia, MusicTech, Sonicstate): SEQ CLK in phase with the clock, MIDI notes transpose a running sequence, note priority, pitch bend |
| MG | Pencil Research / midi.guide MIDI CSV (CC BY-SA 4.0), cross-checks M pp.42-44 |
| SOS | *Sound On Sound* review (2020): resonance starts to sing near 2 o'clock |

## Corrections confirmed against the manual

| Claim | Verdict | Twin |
|---|---|---|
| CUTOFF IN and VCA IN **add** to their envelopes, they do not replace them | **verified**: the VCA input "is summed with the output control signal of the VCA EG" (Subharmonicon manual, p.33); the signal-flow diagram draws both as summing nodes (Subharmonicon manual, p.56); CUTOFF IN sweeps ±5 octaves "with the CUTOFF knob centered" (Subharmonicon manual, p.34) | `cutOct = knob + EG AMT × VCF EG + CUTOFF jack`; `VCA = VCA EG + VCA jack / 8 V` |
| QUANTIZE snaps the VCO FREQ knobs too | **verified** (Subharmonicon manual, pp.18, 19, 21) | the knob, the step and MIDI notes are quantized as one sum |
| NEXT never retriggers the envelopes | **verified**: "Pressing the NEXT button will not cause the VCF EG or the VCA EG to re-trigger" (Subharmonicon manual, p.29); the only exception is a held RESET, where the rhythm generators keep firing them | NEXT steps without firing anything |
| PLAY IN is gate-level | **verified**: "Rising edge = PLAY begins; Falling edge = PLAY stops"; the PLAY button still works and overrides it (Subharmonicon manual, p.34) | rising edge = play, falling = stop; a press of PLAY (or the studio's ■) holds the jack off until PLAY is pressed again |
| Decay minimum is 5 ms, and triggers are ignored during the attack | **verified**: decays run 5 ms to 10 s, attacks 1 ms to 10 s, and neither envelope restarts during its attack (Subharmonicon manual, pp.24-25) | DECAY knobs 5 ms - 10 s; a trigger during an attack is ignored |
| MIDI clock runs the master pulse at 16ths | **verified**: "When MIDI clock is present, the PPQ is 4 (16th notes)" (Subharmonicon manual, p.25) | the studio clock counts one master pulse per 16th |
| CLOCK OUT is 0-10 V and only while playing | **verified**: it follows the current clock source and is present only while the sequencers play with PLAY lit, 0 to +10 V (Subharmonicon manual, p.37) | 10 V pulses (2.0 in the twin's 1.0 = 5 V units) only from counts while running |

## Panel

Faceplate positions are millimetres from its top-left corner (x, y = centre).

- **Format.** A 60 HP Eurorack panel (304.8 x 128.5 mm) on aluminium rails between finished wood
  side pieces; the unit is 12.57 x 4.21 x 5.24 in (Subharmonicon manual, pp.9, 57). It comes out of
  its case as a module held by **eight black M3 screws**, and draws at most 360 mA from +12 V and
  nothing from -12 V (Subharmonicon manual, p.40). **verified**. The twin draws 7.25 mm wooden cheeks.
- **Arrangement.** Left: SEQUENCER 1, SEQUENCER 2, POLYRHYTHM, then TEMPO and the five transport
  buttons. Centre: OSCILLATORS (VCO 1 and VCO 2 halves, SEQ OCT and QUANTIZE on the divider between
  them). Right: two columns of four large knobs (filter, envelopes, VCA). Far right: the 4 x 8
  patchbay. **verified** (the panel drawing, Subharmonicon manual, p.50).
- **Section graphics.** The panel prints no boxes, only: the headings `SEQUENCER 1` (y 6.4),
  `SEQUENCER 2` (31.4) and `POLYRHYTHM` (56.2), centred at x 40.8; `OSCILLATORS` (135.0, 3.4) with a
  rule out to each side ending at a boxed `1` (x 81.6-87.0) and `2` (182.8-188.4) that hang below
  it; `SEQ 1 ASSIGN` / `SEQ 2 ASSIGN` (y 63.2), each a word on a bracket from x 88.0 to 125.9
  (144.1 to 182.0) that drops beside its three buttons to their middle; a short vertical line from
  each RHYTHM knob to its SEQ 1 button and on to its SEQ 2 button; a vertical divider at x 135.0
  broken by the SEQ OCT and QUANTIZE groups (6.4-14.1, 40.7-58.6, 91.1-117.5 mm); `IN / OUT` over
  the patchbay (y 4.1). **verified** (measured off a 400 dpi render of the drawing, Subharmonicon
  manual, p.50).
- **Nameplate and logo.** `SUBHARMONICON` bold condensed from x 31.5 to 73.7 (cap height 4.7 mm,
  y 124.0), a vertical bar at x 75.5, then two lines `SEMI-MODULAR ANALOG` / `POLYRHYTHMIC
  SYNTHESIZER` from x 77.1 to 109.9; the moog logo centred at x 152.6, y 123.5, about 25 mm wide.
  **verified** (Subharmonicon manual, p.50). The twin sets the logo as plain text in its own type
  (no copied artwork).
- **Screws.** Eight, about 5 mm heads: top row x 5.0 / 75.9 / 218.9 / 300.0, bottom row x 5.0 /
  117.0 / 218.9 / 300.0, 3 mm from the top and bottom edges. **verified** (drawing, p.50; count and
  colour p.40).
- **Colours.** Black panel, white legends; outputs are "indicated by reversed-color text over an
  inverse background" (Subharmonicon manual, p.31). **verified** for the jacks, **likely** for the rest.
- **Knobs.** 33: 11 large (19 mm: TEMPO, both VCO FREQ, the eight right-hand knobs), 10 medium
  (15 mm: four SUB FREQ, six LEVEL), 12 small (eight STEP with 8 ticks, four RHYTHM with a ring of 16
  ticks, one per divisor). **verified** (drawing, p.50; PS). The twin draws the small ones at 9 mm
  (hardware 6.3 mm bodies) so they can be turned on an iPad.
- **Buttons.** 21 rectangular backlit buttons: 6 SEQ ASSIGN, 8 rhythm SEQ 1 / SEQ 2, SEQ OCT,
  QUANTIZE, PLAY, RESET, NEXT, TRIGGER, EG. **verified** (p.50). Lit colour red: **guess**.
- **Switches.** Two 3-position WAVE toggles in hex collars, labelled `VCO 1 WAVE` / `VCO 2 WAVE`,
  with glyphs instead of words: a square above the switch, a pulse fed by a saw (the PWM position)
  on its outer side, a saw below. **verified** (p.50; positions UP / MIDDLE / DOWN, pp.19-20).
- **LEDs.** 16. Eight step LEDs 10.3 mm below the STEP knobs (y 27.0 and 52.0); three SEQ OCT LEDs
  at x 134.8, y 16.9 / 22.0 / 27.0 (±5, ±2, ±1, legends to the right) above the SEQ OCT button
  (135.0, 35.9); four QUANTIZE LEDs at x 134.8, y 62.0 / 67.1 / 72.1 / 77.1 (12-ET, 8-ET, 12-JI, 8-JI)
  above the QUANTIZE button (135.0, 86.1); the MIDI LED at (248.4, 105.6), just left of the `MIDI IN`
  legend. **verified** (measured off p.50).

## Controls

"Twin" is the id and stored value in `spec.ts`.

### Sequencers and polyrhythm (left)

| Printed label | Position | Cap | Range / behaviour | Twin | Source | Confidence |
|---|---|---|---|---|---|---|
| STEP 1-4 (Sequencer 1) | x 12.1 / 31.2 / 50.3 / 69.3, y 16.6 | small, 8 ticks | an offset from the VCO FREQ setting: 12 o'clock no change, clockwise up, counter-clockwise down; range set by SEQ OCT, result quantized by QUANTIZE | `seq1_step1..4` -100..+100 % of the SEQ OCT range | (Subharmonicon manual, p.26); 12 o'clock = 0 V, fully CW +5 V at ±5 (Patching with Intention, p.4) | verified |
| (step LED) x 8 | under each STEP knob, y 27.0 / 52.0 | red LED | the current step | engine `steps.seq1/seq2` | (Subharmonicon manual, pp.14, 26); drawing p.50 | verified |
| STEP 1-4 (Sequencer 2) | same x, y 41.6 | small | as Sequencer 1 | `seq2_step1..4` | (Subharmonicon manual, p.27) | verified |
| RHYTHM 1-4 | same x, y 66.7 | small, 16 ticks | divides the clock by a whole number, 1 fully clockwise to 16 fully counter-clockwise | `rhythm1..4` = -divisor | (Subharmonicon manual, p.30) | verified |
| SEQ 1 (x 4) | under each RHYTHM, y 79.4 | button 9.4 x 6.2 | lit: this generator advances Sequencer 1 | `rhythmN_seq1` | (Subharmonicon manual, p.30) | verified |
| SEQ 2 (x 4) | y 88.4 | button 9.4 x 6.2 | lit: advances Sequencer 2; one generator may drive both | `rhythmN_seq2` | (Subharmonicon manual, p.30) | verified |

### Tempo and transport (bottom left)

| Printed label | Position | Range / behaviour | Twin | Source | Confidence |
|---|---|---|---|---|---|
| TEMPO | (21.7, 109.7), large | .333 Hz to 50 Hz = 20 to 3000 BPM at 1 PPQ; CLOCK IN overrides it, MIDI clock overrides both | `tempo` 20-3000 BPM, **linear** (12 o'clock ≈ 1510 BPM), default 480 | (Subharmonicon manual, p.25); taper: see Model choices | range verified, taper likely |
| RESET | (44.5, 101.4) | both sequencers to step 1 and the rhythm generators to their starting phase; playing: starts again on the next clock pulse; stopped: waits for PLAY. Held: the sequencers stay on step 1 (NEXT moves the held step) while the assigned generators keep firing the envelopes. Combined with the RESET jack | `reset` (momentary + event) | (Subharmonicon manual, p.29) | verified |
| EG | (57.5, 101.4) | quick press: OFF (unlit) / ON (lit); hold until it blinks: HELD. OFF: steps do not fire the envelopes, TRIGGER and external triggers still do; ON: every step does; HELD: both envelopes held open at maximum until EG is pressed again, entering runs both attacks, leaving runs both decays | `eg_mode` OFF / ON / HELD | (Subharmonicon manual, pp.29-30) | verified |
| NEXT | (70.6, 101.4) | moves to the next step at once, without firing the envelopes; with PLAY off and EG held, tune each step by ear | `next` (momentary + event) | (Subharmonicon manual, pp.29-30) | verified |
| PLAY | (47.6, 111.7) | starts and stops the sequencers and the rhythm generators; unlit also stops CLOCK OUT | `play` (toggle, transport control) | (Subharmonicon manual, p.28) | verified |
| TRIGGER | (67.4, 111.7) | EG lit: restarts both envelopes at once (not during an attack); EG unlit: a gate, held at maximum while pressed; EG held: no effect. Its presses also reach TRIGGER OUT | `trigger` (momentary + event) | (Subharmonicon manual, pp.28-29) | verified |

### Oscillators (centre)

| Printed label | Position | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|
| VCO 1 WAVE | switch (87.9, 25.9), legend (87.9, 17.0) | UP: square on VCO 1, SUB 1 and SUB 2. MIDDLE: a pulse VCO with saw subs, the SUB 1 saw normalled to the VCO's pulse width - it can add a second pitch even with SUB 1 LEVEL at minimum. DOWN: saw on all three | `vco1_wave` SQR / SQ/SAW / SAW | (Subharmonicon manual, p.19) | verified |
| VCO 1 FREQ | (106.8, 25.6), large | four octaves: fully counter-clockwise Middle C (262 Hz), fully clockwise the top C of a piano (4186 Hz); with QUANTIZE on it steps through the scale | `vco1_freq` 261.63-4186 Hz, log | (Subharmonicon manual, p.18) | verified |
| VCO 2 FREQ, VCO 2 WAVE | (163.0, 25.6), switch (182.0, 26.0) | as VCO 1 | `vco2_freq`, `vco2_wave` | (Subharmonicon manual, pp.19-20) | verified |
| SUB 1 FREQ, SUB 2 FREQ (VCO 1) | (92.9, 51.6), (120.9, 51.6), medium | the VCO's frequency divided by a whole number, 1 fully clockwise (unison) to 16 | `vco1_sub1_freq`, `vco1_sub2_freq` = -divisor | (Subharmonicon manual, pp.18-19) | verified |
| SUB 1 FREQ, SUB 2 FREQ (VCO 2) | (148.9, 51.6), (177.1, 51.6) | divide VCO 2 | `vco2_sub1_freq`, `vco2_sub2_freq` | (Subharmonicon manual, p.20) | verified |
| SEQ 1 ASSIGN: OSC 1, SUB 1, SUB 2 | y 69.2; x 93.9 / 106.8 / 119.9 | OSC 1: Sequencer 1 moves VCO 1's pitch, the subs follow; SUB 1 / SUB 2: it changes that sub's whole number; any combination | `seq1_osc`, `seq1_sub1`, `seq1_sub2` | (Subharmonicon manual, pp.26-27) | verified |
| SEQ 2 ASSIGN: OSC 2, SUB 1, SUB 2 | y 69.2; x 149.9 / 163.0 / 176.0 | as SEQ 1, for VCO 2 | `seq2_*` | (Subharmonicon manual, p.27) | verified |
| SEQ OCT | button (135.0, 35.9) | cycles ±5, ±2, ±1 octaves per STEP knob, shared; the full ±5 needs both VCO FREQ knobs fully counter-clockwise. **Held** until the LED flashes: the SEQ jacks always put out ±5 V while the oscillators keep the selected range; hold again to return | `seq_oct` ±1 / ±2 / ±5; `seq_oct_held` | (Subharmonicon manual, p.28) | verified |
| QUANTIZE | button (135.0, 86.1) | 12-ET (chromatic), 8-ET (diatonic), 12-JI, 8-JI, shared; all LEDs dark = off. **Held** until the LED flashes: the SEQ jacks are unquantized while the oscillators stay quantized | `quantize` OFF / 12-ET / 8-ET / 12-JI / 8-JI; `quantize_held` | (Subharmonicon manual, p.21) | verified (cycle order: guess) |
| VCO 1 LEVEL, VCO 2 LEVEL | (106.8, 86.7), (163.0, 86.7), medium | mixer levels; several sources near maximum push the mixer into a warm distortion, moderate levels stay clean | `vco1_level`, `vco2_level` | (Subharmonicon manual, p.21) | verified |
| SUB 1 LEVEL, SUB 2 LEVEL (x 2) | (92.9 / 120.9 / 148.9 / 177.1, 109.7) | mixer levels of the four subs | `vcoN_subM_level` | (Subharmonicon manual, p.22) | verified |

### Filter, envelopes and VCA (right; no heading)

| Printed label | Position | Range | Twin | Source | Confidence |
|---|---|---|---|---|---|
| CUTOFF | (205.1, 16.6) | 20 Hz to 20 kHz; a 4-pole (24 dB/oct) Moog ladder low-pass | `cutoff` log | (Subharmonicon manual, p.23) | verified |
| VOLUME | (235.2, 16.6) | output level; the VCA envelope rises to it | `volume` 0-100 % | (Subharmonicon manual, pp.23-24) | verified |
| RESONANCE | (205.1, 47.6) | resonant peak at the cutoff; at maximum with a low cutoff the filter can self-oscillate | `resonance` 0-100 % | (Subharmonicon manual, p.23) | verified |
| VCF EG AMT, `(–)` `(+)` | (235.2, 47.6) | bipolar: centre no effect; + opens on the attack and closes on the decay, - the reverse | `vcf_eg_amt` -100..+100 % | (Subharmonicon manual, p.24) | verified (depth: guess) |
| VCF ATTACK, VCF DECAY | (205.1, 78.7), (235.2, 78.7) | 1 ms - 10 s, 5 ms - 10 s, from the CUTOFF setting to the peak set by EG AMT and back | `vcf_attack`, `vcf_decay` log | (Subharmonicon manual, p.24) | verified |
| VCA ATTACK, VCA DECAY | (205.1, 109.7), (235.2, 109.7) | 1 ms - 10 s, 5 ms - 10 s, from zero to the VOLUME level and back | `vca_attack`, `vca_decay` log | (Subharmonicon manual, pp.24-25) | verified |

### Global parameters (no panel control on the hardware)

| Parameter | On the hardware | Twin | Source |
|---|---|---|---|
| Rhythm generator logic | MIDI CC 113: 0-63 OR, 64-127 XOR ("if both Rhythm Generators are true, the sequencer will not advance") | `rhythm_logic`, a small LOGIC switch marked CC 113 (twin aid) | (Subharmonicon manual, p.44) - verified |
| Fine Tune | hold OSC 1 + OSC 2 until the QUANTIZE LEDs flash, set ±50 cents with TEMPO, exit with QUANTIZE; stored | not modelled | (Subharmonicon manual, p.41) - verified |
| MIDI channel, Play (MIDI transport) | SysEx files; channel 1 and transport ON by default | the twin always follows the studio transport while synced | (Subharmonicon manual, p.44) - verified |
| Note priority, pitch bend | firmware 1.1 | last note; no pitch bend | FW - verified |

### Twin aids (not on the hardware)

- `EG` OFF / ON / HELD radio row under PLAY and TRIGGER: chooses the EG state by touch and shows it in words.
- `OUT ±5` and `OUT UNQ` keys beside the SEQ OCT and QUANTIZE buttons: the two hold modes without the long
  press. While a hold mode is on, the lit LED of its button flashes (as on the hardware).
- `LOGIC` switch: the CC 113 global setting.
- The lit rhythm SEQ buttons brighten when their generator fires.
- Long presses: EG, SEQ OCT and QUANTIZE react after 0.6 s; the cycle happens on release.

## Patch bay (32 points)

Four columns by eight rows at a 13.54 x 13.51 mm pitch (x 255.2 / 268.7 / 282.3 / 295.8, y 16.6 ...
111.2). 17 inputs "identified by normal text", 15 outputs in reversed lettering, 3.5 mm, five cables in
the box (Subharmonicon manual, p.31). Row and column order: **verified** (p.50; Patching with Intention,
pp.12-15). Twin convention: **1.0 = 5 V**.

| Row/col | Label | Dir | Level | Normal / behaviour | Source |
|---|---|---|---|---|---|
| 1/1 | VCO 1 | in | ±5 V, 1 V/oct | summed with VCO 1 FREQ and Sequencer 1; **normalled to VCO 2** until VCO 2 has a cable | (Subharmonicon manual, p.31) |
| 1/2 | VCO 1 SUB | in | ±5 V | sets the whole number of both VCO 1 subs; centre both SUB FREQ knobs for bipolar CV | (Subharmonicon manual, p.31) |
| 1/3 | VCO 1 PWM | in | ±5 V = 1 % to 99 % duty | pulse width of VCO 1 and its two subs (square selected); **replaces** the SUB 1 saw normal of the middle WAVE position | (Subharmonicon manual, p.32) |
| 1/4 | VCA | out | 10 V p-p | Eurorack-level output, after VOLUME | (Subharmonicon manual, pp.32, 56) |
| 2/1-2/3 | VCO 1, VCO 1 SUB 1, VCO 1 SUB 2 | out | 10 V p-p | each source before the mixer | (Subharmonicon manual, p.32) |
| 2/4 | VCA | in | 0 to +8 V | **summed** with the VCA EG | (Subharmonicon manual, p.33) |
| 3/1 | VCO 2 | in | ±5 V, 1 V/oct | summed with VCO 2 FREQ and Sequencer 2; breaks the normal from VCO 1 | (Subharmonicon manual, pp.31, 33) |
| 3/2 | VCO 2 SUB | in | ±5 V | both VCO 2 subs | (Subharmonicon manual, p.33) |
| 3/3 | VCO 2 PWM | in | ±5 V = 1-99 % | VCO 2 and its subs; replaces the SUB 1 normal | (Subharmonicon manual, p.33) |
| 3/4 | VCA EG | out | 0 to +8 V | | (Subharmonicon manual, p.33) |
| 4/1-4/3 | VCO 2, VCO 2 SUB 1, VCO 2 SUB 2 | out | 10 V p-p | | (Subharmonicon manual, p.34) |
| 4/4 | CUTOFF | in | ±5 V, up to ±5 octaves | **summed** with the knob and the VCF EG | (Subharmonicon manual, pp.34, 56) |
| 5/1 | PLAY | in | 0 to +10 V | gate level: rising edge plays, falling edge stops; the PLAY button overrides | (Subharmonicon manual, p.34) |
| 5/2 | RESET | in | 0 to +10 V | a trigger resets; a held gate is the RESET hold (NEXT still works) | (Subharmonicon manual, p.35) |
| 5/3 | TRIGGER | in | 0 to +10 V | the rising edge fires both envelopes (not during an attack) | (Subharmonicon manual, p.35) |
| 5/4 | VCF EG | out | 0 to +8 V | | (Subharmonicon manual, p.35) |
| 6/1-6/4 | RHYTHM 1-4 | in | ±5 V | sets that generator's whole number by moving its knob's value; centre the knob for the widest range | (Subharmonicon manual, pp.35-36) |
| 7/1, 7/3 | SEQ 1, SEQ 2 | out | ±5 V | the current step's voltage, following QUANTIZE and SEQ OCT unless their hold modes are on | (Subharmonicon manual, p.36) |
| 7/2, 7/4 | SEQ 1 CLK, SEQ 2 CLK | out | 0 to +5 V | a pulse each time that sequencer moves | (Subharmonicon manual, pp.36-37) |
| 8/1 | MIDI IN | in | TRS type A | clock, notes, CCs; MIDI clock overrides the internal clock and CLOCK IN; the LED shows MIDI arriving | (Subharmonicon manual, p.37) |
| 8/2 | CLOCK | in | 0 to +10 V | each rising edge is a master pulse; overrides TEMPO | (Subharmonicon manual, p.37) |
| 8/3 | CLOCK | out | 0 to +10 V | follows the current clock source; only while playing | (Subharmonicon manual, p.37) |
| 8/4 | TRIGGER | out | 0 to +5 V, 1 ms | every time the envelopes are triggered - by the sequencers or the TRIGGER button | (Subharmonicon manual, p.37) |

## Behaviour

- **Signal flow.** Six sources into one mixer, a 4-pole ladder low-pass, a VCA, VOLUME, then the
  line/headphone output and the VCA jack. The sequencer clocks are OR'd into TRIGGER OUT and, through
  the EG switch, into a second OR with the TRIGGER button and TRIGGER IN that fires both envelopes.
  VCO 1 CV IN is normalled to VCO 2 CV IN; PWM IN is normalled from SUB 1 through the WAVE switch.
  **verified** (Subharmonicon manual, p.56).
- **Clock sources.** Internal TEMPO at 1 pulse per beat; CLOCK IN overrides it; MIDI clock overrides
  both and counts 16ths (Subharmonicon manual, p.25). **verified**. The rhythm generators run from
  any of the three (Subharmonicon manual, p.30).
- **Rhythm generators.** Each counts master pulses and fires when its count is 0, then wraps at its
  divisor; RESET zeroes all four, so they fire together on the next pulse. **likely** (TE's stock
  divider). They re-align on a common downbeat after the least common multiple of their divisors
  (Subharmonicon manual, p.11).
- **Rhythm logic.** OR advances a sequencer when one or more of its generators fire (once); XOR only
  when exactly one fires - also with three firing it does not advance. **verified** (Subharmonicon
  manual, p.44; TE "exclusive-one").
- **Sequencers.** A sequencer plays only with at least one rhythm generator assigned (Subharmonicon
  manual, p.26). After RESET the first pulse plays step 1. Either sequencer's move fires both envelopes
  with EG lit and always reaches TRIGGER OUT (diagram, p.56; Patching with Intention, p.15).
- **Envelopes.** A trigger runs the attack then the decay; a gate runs the attack, holds at maximum
  until it ends, then decays; neither envelope restarts during its attack (Subharmonicon manual,
  pp.24-25). **verified**.
- **Gates and triggers.** Gates: TRIGGER with EG unlit, a RESET gate (hold), HELD itself. Triggers:
  sequencer steps with EG lit, TRIGGER with EG lit, the rising edge at TRIGGER IN (Subharmonicon
  manual, pp.29, 35).
- **Quantizer.** The VCO FREQ knob, the step and MIDI notes are snapped as one sum to a scale on C.
  8-ET and 8-JI fold each chromatic note to the white key below; JI notes are ratios of C of their
  octave. **likely** (TE `note_frequency`; the manual's examples are all on C, p.17).
- **JI tables.** 8-JI is the manual's just C major: 1/1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8 (Subharmonicon
  manual, p.17) - **verified**. 12-JI: 1/1, 16/15, 9/8, 6/5, 5/4, 4/3, 7/5, 3/2, 8/5, 5/3, 16/9,
  15/8 - **likely** (TE's test table of the stock firmware).
- **Sequencer reach.** The sequencers cannot push a VCO much above 10 kHz, and the subs are not
  accurate above 10 kHz; the CV inputs can drive the VCOs far higher (Subharmonicon manual, p.28).
  **verified**.
- **Subharmonics.** True whole-number dividers of their VCO, so they track it and cannot beat against
  it (Subharmonicon manual, pp.18, 26). **verified**; phase-locked resets: **likely** (TE).
- **MIDI.** Notes are offsets from C4; with the VCO FREQ knobs fully counter-clockwise they play at
  pitch (Subharmonicon manual, p.42). The stock firmware gates both envelopes on a note and releases
  them on its note-off (TE); while the sequencers run, notes transpose them (FW 1.1). CCs: 4/36 and
  12/44 VCO frequency (±2.5 octaves added to the knob), 103-106 the sub whole numbers (eight values
  per divisor, replacing the knob until it moves), 23/55, 24/56, 28/60, 29/61 the envelope times
  (Subharmonicon manual, pp.42-43). **verified**.
- **Syncing.** CLOCK OUT into the DFAM's ADV/CLOCK, pressing the DFAM's RUN/STOP first; TRIGGER, SEQ 1
  CLK or SEQ 2 CLK clock it with a polyrhythm (Subharmonicon manual, p.38). A Mother-32 ASSIGN output
  set to clock into CLOCK IN, pressing the Subharmonicon's PLAY first (Subharmonicon manual, p.39).
  **verified**.
- **No noise source, audio input or LFO** (Subharmonicon manual, pp.31, 57). **verified**.

## Conflicts and how the twin resolves them

| Topic | Claims | Twin |
|---|---|---|
| VCA and CUTOFF inputs | Patching with Intention calls the envelopes "normalled" to them (pp.12-15) | summed, per the manual's text (p.33) and diagram (p.56); the guide means wired inside |
| VCO 2 PWM normal | p.33 names "subharmonic oscillator sawtooth 2"; p.20 names SUB 1 | SUB 1 of VCO 2 (p.20, and the diagram's structure) |
| VCA DECAY text | p.25 calls the VCA's knob "VCF DECAY" | a typo; the VCA DECAY knob is meant |
| TRIGGER OUT with EG off | p.29 lists the button and external triggers; the diagram takes TRIGGER OUT before the EG switch | sequencer moves always reach it, plus TRIGGER and TRIGGER IN |
| Studio sync vs a CLOCK cable | MIDI clock overrides CLOCK IN (p.25) | the studio's MIDI-style sync is always plugged in, so the twin lets a cable in CLOCK take over the clock while the studio still starts and stops PLAY; untick "Sync to studio clock" for the free-running TEMPO |
| SEQ ASSIGN SUB tap point | research suggested after SEQ OCT; the diagram branches the SUB assigns before SEQ RANGE and QUANTIZE (p.56) | the raw step (before SEQ OCT and QUANTIZE) |
| Three silent sheets | Spiral Ways, Star-Gate and Cloud Path draw EG and PLAY unlit with nothing patched to TRIGGER, which is silent (pp.48-49) | recreated with EG lit; their descriptions say so |
| Tempo range | a replica quotes 0.333-3000 Hz | .333-50 Hz (p.25): it confused BPM and Hz |

## Model choices (guesses to check against a unit)

| Quantity | Twin value | Why |
|---|---|---|
| TEMPO taper | linear in Hz: BPM = 20 + 2980 × travel (12 o'clock 1510 BPM) | under a log taper nearly all 20 Moog sheets would step at 5-30 BPM (Bateria's ÷4 kick at 11 BPM); linear puts every one at a musical rate (Bateria's ÷4 at about 129 BPM) |
| CUTOFF, ATTACK, DECAY tapers | log (20·1000^p Hz; 1 ms·10^(4p); 5 ms·2000^p) | Bateria needs an 80 Hz cutoff and a 20 ms filter decay at its knob positions |
| VCO FREQ taper | exponential (C6 at 12 o'clock) | a quantizable pitch knob; the sheets' "a fourth apart" fits |
| Decay law | DECAY = time to fall 60 dB ("to zero", p.25) | the manual's wording; keeps tails clean |
| VCF EG AMT full scale | ±8 octaves (the 8 V envelope at 1 V/oct) | Star-Gate's high clusters need it at its drawn settings |
| CUTOFF jack | 1 V/oct | ±5 V sweeps ±5 octaves (p.34) |
| VCA and CUTOFF jack inputs | a 0.2 ms RC (about 800 Hz) | a pulse into VCA IN snaps instead of stepping; audio-rate AM still passes |
| EG curves | RC attack toward 1.5 × peak reaching it at ATTACK; exponential decay; 1 ms output smoothing | TE: the stock firmware smooths the EG outputs |
| EG peak | +8 V (p.33) | |
| Sub and rhythm CV | 10 V = the knob's 16 positions (1.6 per volt), + toward ÷1 | centre the knob for bipolar control (pp.31, 35) |
| SEQ ASSIGN SUB depth | the raw step at ±5 V full scale, on that scale | the diagram's tap point |
| PWM jack | duty = 50 % + 9.8 % per volt (1-99 % over ±5 V) | p.32 |
| MIDDLE-position PWM depth | the SUB 1 saw moves the width ±30 % | |
| Resonance | self-oscillation from about 78 % (2:20 o'clock) | SOS: about 2 o'clock |
| Mixer | level² taper per source, then a soft bus saturation: one full source nearly clean, three or more warmly driven | p.21 |
| Output stage | make-up so the median Moog sheet reads about -18 LUFS at full VOLUME, a DC blocker, and a soft shoulder from -4.4 dBFS that keeps peaks under -1.5 dBFS | the studio's -18 LUFS reference with -1 dBTP |
| Keys / MIDI notes while stopped | like the TRIGGER button with a pitch: EG lit a trigger, EG unlit a gate while held, HELD nothing; running: transpose only | TE's stock gate calls; FW 1.1 transpose |
| PLAY override | a press of PLAY, the studio's ■ or the end of an audition holds a gate in PLAY IN off until PLAY is pressed again | "Pressing the PLAY button will override the status" (p.34) |
| CLOCK / SEQ CLK pulse width | 5 ms (TRIGGER OUT 1 ms, p.37) | TE stock constant |
| QUANTIZE cycle order | 12-ET → 8-ET → 12-JI → 8-JI → off | panel order |
| Analog drift | ±1.5 cents, slow, per VCO; none between a VCO and its subs | |
| NEXT | forces divider counts until Sequencer 1 steps, so Sequencer 2 keeps its place | TE stock emulation |

## Presets

36 presets, named "Category / Name" (the menu groups by category). Moog's titles appear only in the
descriptions. Every preset lists every setting; VOLUME is calibrated per preset so the audition and
the studio-transport playback both sit on the category target (-18 LUFS; FX and texture -22, drone and
ambient -21). Patches whose sound keeps going after stop by design (held envelopes, a sub patched into
VCA IN, long ambient decays) are in Drone / Ambient.

**How the sheets were read.** Knob positions were read as clock positions of the pointer (7 o'clock =
fully counter-clockwise, 5 o'clock = fully clockwise; travel p = (angle + 150°) / 300°) and stepped
knobs to the nearest of 16 detents (divider index = floor(p × 16)). The Exploration Patchbook's
coloured pointers were measured from 250 dpi renders (±2 % of travel); the manual's black-and-white
sheets were read by eye at 300 dpi (±3-5 %); `docs/research/subharmonicon/presets.md` has the full
per-sheet tables. Where a pointer sits between detents the description or the notes below say so.

| Preset | Sheet | Cables | Reading notes |
|---|---|---|---|
| Chords / Bubbling sub chords | "Aquatic Chords" (Subharmonicon manual, p.45) | SEQ 1 → CUTOFF, CLOCK → TRIGGER | EG drawn off, PLAY on; VCO 2 SUB 2 between ÷3 and ÷4 (÷3) |
| Arp / Hand-faded harmony arp | "Mellow Harmonies" (p.45) | SEQ 1 → CUTOFF, SEQ 1 CLK → TRIGGER | the four SUB LEVELs are drawn as performance arcs without pointers: set to 80 % |
| Rhythm / Self-tripping cross-sequence | "Slip & Fall" (p.46) | five: SEQ 2 → VCO 1, SEQ 1 → VCO 2, VCA EG → RHYTHM 2, VCF EG → RHYTHM 1, SEQ 1 CLK → TRIGGER | RHYTHM 1 between ÷7 and ÷8 (÷8) |
| Ambient / Driven pulse swell | "Point Zero" (p.46) | SEQ 1 → VCO 1 PWM, SEQ 2 → CUTOFF | the sheet's note: VCF ATTACK sets the sweep length |
| Texture / Winding two-sequencer line | "Three Hands on the Wheel" (p.47) | SEQ 1 → VCO 2, SEQ 2 → CUTOFF | VCO 2 SUB 2 LEVEL and +VCF EG AMT are performance arcs: SUB 2 at 75 %, EG AMT mid-arc +65 %; VCA DECAY at the top of its reading (42 ms) |
| Drums / Filter-ping kit | "Bateria" (p.47) | SEQ 1 → RHYTHM 1, SEQ 2 → RHYTHM 2, SEQ 1 CLK → CUTOFF, SEQ 2 CLK → VCA | all six levels down; the sheet's note: CUTOFF tunes the kick, VCF DECAY and EG AMT shape it |
| Ambient / Accelerating spiral | "Spiral Ways" (p.48) | VCF EG → RHYTHM 1 | **silent as printed** (EG and PLAY unlit, nothing into TRIGGER): EG lit; VCO 1 SUB 1 between ÷6 and ÷7, ÷6 for the sheet's "fifth" |
| Ambient / Percolating high clusters | "Star-Gate" (p.48) | SEQ 1 → CUTOFF, SEQ 2 → VCO 1 PWM | **silent as printed**: EG lit; the five other mixer knobs are drawn at 0 as performance arcs: partly brought in |
| Groove / Polyrhythm chord stabs | "Poly Rock" (p.49) | VCA EG → CUTOFF (optional CLOCK → VCA for drums) | VCO 1 SUB 1 ÷8 or ÷7; RHYTHM 2 ÷12 or ÷11 |
| Pad / Slow-bloom duet | "Cloud Path" (p.49) | VCA EG → CUTOFF, VCF EG → RHYTHM 3 | **silent as printed**: EG lit; VCO 2 and the subs are drawn at 0 to be faded in: half way up |
| FX / Clinking sub clatter | "Music for Washing Dishes" (Exploration Patchbook, p.1) | SEQ 2 → CUTOFF | RHYTHM 2 and 4 between detents (÷11, ÷15) |
| Bass / Shuffled sub bassline | "Shuffled Subs" (p.2) | SEQ 1 → VCO 2, SEQ 2 → CUTOFF | RHYTHM 2 between ÷8 and ÷7 |
| Ambient / Eerie fourths in pulse | "Nosferatu's Flotation Tank" (p.3) | SEQ 1 → VCA, VCF EG → RHYTHM 1, SEQ 2 → RHYTHM 3 | positive SEQ 1 steps hold the VCA open: it drones between notes |
| FX / Buzzing cross-mod swarm | "Transistor Insects" (p.4) | VCO 2 SUB 2 → VCO 1, VCO 1 SUB 2 → VCO 2, VCO 1 → RHYTHM 4 | |
| Melody / Undertone step dance | "Neon Cactus Tips Their Cap" (p.5) | SEQ 1 → RHYTHM 1, SEQ 2 → VCO 2 PWM, SEQ 2 CLK → TRIGGER | |
| FX / Tone and breath duet | "Duet for Tone and Wind" (p.6) | SEQ 1 → VCO 2 PWM, VCO 2 → CLOCK | an audio-rate master clock; TEMPO is irrelevant |
| Rhythm / Sub-gated dial tones | "Touchtone Wiretap" (p.7) | VCO 1 SUB 1 → PLAY, VCA EG → VCO 2, VCO 1 SUB 2 → CUTOFF, SEQ 2 → VCO 1 PWM | PLAY drawn unlit: PLAY IN runs it |
| Rhythm / Marching sub clicks | "Ant Parade" (p.8) | CLOCK → VCO 1, SEQ 2 → VCO 1 SUB | |
| Drone / Octave-shifting fuzz bass | "Octave Fuzz" (p.9) | SEQ 2 → VCO 1, VCO 1 SUB 1 → VCA | the sub in VCA IN keeps a fuzz drone going between and after notes |
| FX / Folded high chimes | "Aliased Wind Chimes" (p.10) | VCA EG → RHYTHM 3, VCO 2 SUB 1 → RHYTHM 4, SEQ 1 CLK → CUTOFF | |
| Drone / Initialized patch (EG held) | the initialized patch (Patching with Intention, p.3) | - | EG held so VCO 1 sounds, as the manual's tour starts (Subharmonicon manual, p.12) |
| Tutorial / First sequence … Envelope-accelerated clock (5) | the exercises (Patching with Intention, pp.4-10) | as the guide patches them | step values, resonance and some divisors are ours; the PLAY-gating sub is ÷9 (12 o'clock) so its edges drift against the ÷16 clock |
| Tutorial / First polyrhythm | the tour (Subharmonicon manual, pp.12-16) | - | step and divisor values ours |
| Init / Default patch, Drone (3), Polyrhythm (3), Bass / Square sub bass, Lead / Envelope PWM | our designs (just C major, p.17; undertones, p.11; rhythm logic, p.44) | Envelope PWM: VCF EG → VCO 1 PWM | |

The initialized patch's values are exported as `INITIALIZED_PATCH` (presets.ts) and are the start state
of most lessons.

## Lessons

20 v2 lessons (`lessons.ts`), from the outlines in `docs/research/subharmonicon/lessons.md`:
foundations 6, sound design 3, ear training 5, sequencing 3, performance 1, studio 2. Every match step
that grades a divisor uses tolerance 0.03. RESET, NEXT and TRIGGER steps count presses (lesson API v3).
Synced to the studio, PLAY runs on the studio's 16th notes, so the TEMPO comparisons are Listen steps
(auditions run on the internal clock).

## Measured in the app

A Playwright check against a production build (headless Chromium, 44.1 kHz) measures the running
instrument, not the code. Step times are read from the panel's step events on the main thread, so
they carry a few milliseconds of jitter.

| What | Result |
|---|---|
| Subharmonic ratios (AnalyserNode FFT peak, each sub alone against its VCO alone) | ÷2, ÷3, ÷5, ÷7, ÷12, ÷16 on both VCOs: every ratio within 0.12 % of the divisor (the FFT's resolution at the 25-45 Hz subs) |
| QUANTIZE on the VCO FREQ knob | a 500 Hz knob setting sounds at 494.1 Hz in 12-ET (B4 = 493.9 Hz, plus the ±1.5 cent drift), 500.1 Hz with QUANTIZE off |
| Polyrhythm (÷3 on Sequencer 1 against ÷4 on Sequencer 2) | 16 steps against 12 in 6 s: 4 : 3 |
| Studio ▶ at the studio tempo (16th-note master pulse) | step intervals 371 / 500 ms at 120 BPM (375 / 500 expected), 500 / 667 ms at 90 BPM (500 / 667) |
| Studio Clock CLOCK → CLOCK IN (CLOCK DIV 1/8) | ÷1 steps every 129 ms synced (125 expected), every 249 ms on the cable (250): the cable takes over |
| Every preset makes sound | all 36, under the studio transport and under the audition |
