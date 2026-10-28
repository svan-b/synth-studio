# Moog Subharmonicon - hardware reference for the digital twin

Ground truth used to build `devices/subharmonicon`. Every control, LED and patch point is listed
with its printed label, section, position, cap, range and (for jacks) its normal, plus a source and
a confidence level.

- **verified**: quoted from the Moog manual (by its *printed* page number) or two independent
  sources agree.
- **likely**: one good secondary source, or a direct consequence of verified facts.
- **guess**: not documented anywhere we could reach. Chosen by ear to match the documented
  behaviour, and listed again in "Model choices" so it can be checked against a unit.

`docs/reference/subharmonicon/` does not exist, so there were no photos to read. The network blocks
Moog's site, the inMusic CDN and the manual mirrors. Manual text therefore comes from (a) the
patchscore project, which quotes the manual by printed page and measured the panel from the
manual's own vector drawing, and (b) search-engine excerpts of the manual PDF.

This is the **2020 production Subharmonicon** (firmware 1.1.x). The 2018 Moogfest kit is a different
instrument: saw-only VCOs, SUB 2 pitch inputs and a TEMPO input instead of PWM inputs and MIDI IN (KM).

## Sources

| Id | Source |
|----|--------|
| M | Moog *Subharmonicon Manual*, 58 pp (`cdn.inmusicbrands.com/Moog/Subharmonicon/Subharmonicon_Manual AMZ.pdf`, also manualslib 1818971). Printed page numbers (PDF page + 1 for pp.7-54). Quoted through PS and search excerpts |
| PS | patchscore (`github.com/miclip/patchscore`, `lib/devices/moog-subharmonicon/{index,panel}.ts`). Quotes M by printed page for all 32 jacks and every printed range, and measured every control from the vector paths of the blank patch sheet on printed p.50 (circle fits, residual < 0.01 pt). Its unit coordinates (319.3 x 133 mm, cheeks included) are converted here to the 304.8 x 128.5 mm faceplate |
| TE | Tallent Edition firmware (`github.com/brandon-tallent/subharmonicon-extended-firmware`): an extension of stock firmware 1.1.1 by someone who reverse-engineered it. Its `features_rhythm.c` re-implements Moog's divider logic, its tests carry the 12-JI table, and `manual.html` / `cheatsheet.html` draw panel sections |
| MG | midi.guide / pencilresearch MIDI CSV (CC BY-SA 4.0), `public/midi-guide/devices/moog-subharmonicon.json` |
| FW | Moog firmware v1.1.0 release notes (March 2022) as reprinted by MusicTech, Sonicstate, Rubadub, Gearspace |
| KM | Kraft Music, *Moog Subharmonicon: What's New, What's Changed?* (Moogfest kit vs production) |
| SOS | Sound On Sound review (Gordon Reid, June 2020) |
| IS | inMusic / Moog support articles: clocking with analog clocks, clocking DFAM, MIDI channel, fine tune |
| PWI | Moog *Subharmonicon: Patching with Intention* (2022), via search excerpts |
| PP | 0VRLNDR *Moog Subharmonicon Patch Project* (moogsubharmoniconpatches.com), which reproduces the manual patches with notes; via search excerpts |
| RV | Reverb, *20 Patches With Moog's Sound Studios* (names from Moog's DFAM & Subharmonicon Exploration Patchbook) |
| AD | Sara Adkins, *Digital Subharmonicon* (QMUL 2022, `github.com/Satrat/digital-subharmonicon`), a replica built from M |
| F | Forums (Moog forum, ModWiggler, Elektronauts, Gearspace, ModularGrid) via search excerpts |

## Panel

- **Format.** 60 HP Eurorack panel (304.8 x 128.5 mm) between aluminium rails and finished wood side
  pieces; the unit is 319.3 x 133 mm (p.58 SIZE 12.57" x 4.21" x 5.24"; p.9 "As with Mother-32 and
  DFAM, Subharmonicon conforms to the 60HP Eurorack format; features aluminum rails, finished wood
  side pieces"). **verified** (M, PS). The twin draws the faceplate at 304.8 x 128.5 mm with 7.25 mm
  wooden cheeks.
- **Arrangement.** Left: SEQUENCER 1, SEQUENCER 2, POLYRHYTHM, then TEMPO and the five transport
  buttons. Centre: OSCILLATORS (VCO 1 and VCO 2 halves, SEQ OCT and QUANTIZE on the divider between
  them). Right: two columns of four large knobs (filter, envelopes, VCA). Far right: the 4 x 8
  patchbay. **verified** (PS; SOS, Engadget and Future Music describe the same order).
- **Section graphics.** The panel prints **no boxes**. It prints headings: `SEQUENCER 1`,
  `SEQUENCER 2`, `POLYRHYTHM`, `TEMPO`, `OSCILLATORS` (centred over the divider, with a rule out to
  each side ending in a boxed `1` and `2`), `SEQ 1 ASSIGN` / `SEQ 2 ASSIGN` (a word on a bracket that
  drops around its three buttons) and `IN / OUT` over the patchbay. The filter/VCA columns have no
  heading, only per-knob labels. **verified** (PS, read off the vector paths of p.50; TE's drawings
  agree).
- **Colours.** Black panel, white legends; outputs are "reversed-color text over an inverse
  background" (p.31). **verified** for the jack legend, **likely** for the rest (photos not reachable).
- **Knobs.** 33: 11 large (19 mm: TEMPO, both VCO FREQ, the eight right-hand knobs), 10 medium
  (15 mm: four SUB FREQ, six LEVEL), 12 small (6.3 mm bodies: eight STEP with 8 radiating ticks, four
  RHYTHM with a ring of 16 ticks, one per integer). **verified** (PS; "33 knobs" also AD). Black caps
  with a white line: **likely**. The twin draws the small knobs at 9 mm so they can be turned on an
  iPad (twin choice).
- **Buttons.** 21 rectangular backlit buttons (lit = on): 6 SEQ ASSIGN, 8 rhythm SEQ 1/SEQ 2, SEQ OCT,
  QUANTIZE, PLAY, RESET, NEXT, TRIGGER, EG. **verified** (PS sizes; AD count; TE draws lit caps).
  Lit colour: **guess** (red, as on the DFAM and Mother-32).
- **Switches.** Two 3-position WAVE toggles in hex collars, with waveform glyphs (not words) printed
  beside the positions. **verified** (PS; M pp.19-20 name the positions UP, MIDDLE, DOWN).
- **LEDs.** 16: eight step LEDs, four beside QUANTIZE, three beside SEQ OCT, one beside the MIDI IN
  jack. **verified** (PS). Their exact places: **likely** (TE draws step LEDs under the STEP knobs and
  the SEQ OCT LEDs stacked above their button, ±5 on top).
- **Nameplate.** `SUBHARMONICON` at the bottom left (PS). The Moog logo position: **guess** (bottom
  right, under the patchbay).

## Controls

Positions are the twin's faceplate coordinates in mm (x, y = centre), converted from PS. "Twin" gives
the value stored in `spec.ts`.

### Sequencers and polyrhythm (left)

| Printed label | Section | Position | Cap | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| SEQUENCER 1 | heading | (40.8, 7.4) | - | - | label | PS | verified |
| STEP 1-4 | Sequencer 1 | row 1: x 12.1 / 31.2 / 50.3 / 69.3, y 16.6 | small, 8 ticks | pitch offset; 12 o'clock = 0 V; fully CW = +SEQ OCT range (±1/±2/±5 octaves = volts); quantized by QUANTIZE | `seq1_step1..4` -100..+100 % of the range | M p.26, p.28; PWI ("at precisely 12 o'clock it is set to 0 volts; fully clockwise sets it to +5 volts") | verified |
| (step LED) x4 | Sequencer 1 | under each STEP knob | red LED | current step | engine `steps.seq1` | PS (8 LEDs), TE drawing | position likely |
| SEQUENCER 2 | heading | (40.8, 32.4) | - | - | label | PS | verified |
| STEP 1-4 | Sequencer 2 | row 2: same x, y 41.6 | small, 8 ticks | as Sequencer 1 | `seq2_step1..4` | M, PS | verified |
| POLYRHYTHM | heading | (40.8, 56.9) | - | - | label | PS | verified |
| RHYTHM 1-4 | Polyrhythm | same x, y 66.7 | small, 16 ticks | divides the clock by an integer "from 1 (fully clockwise) to 16 (fully counter-clockwise)" | `rhythm1..4` = -divisor (-16..-1) | M p.30 (quoted) | verified |
| SEQ 1 (x4) | Polyrhythm | under each RHYTHM, y 79.4 | button 10.1 x 6.2 | lit: this generator clocks Sequencer 1 | `rhythmN_seq1` | M p.30, PS | verified |
| SEQ 2 (x4) | Polyrhythm | y 88.4 | button 10.1 x 6.2 | lit: clocks Sequencer 2; one generator may drive both | `rhythmN_seq2` | M p.30, PS | verified |

### Tempo and transport (bottom left)

| Printed label | Section | Position | Cap | Range / behaviour | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| TEMPO | Tempo | knob (21.7, 109.7), label (21.7, 96.6) | large | .333 Hz - 50 Hz = 20 - 3000 BPM at 1 PPQ; overridden by CLOCK in and by MIDI clock | `tempo` 20-3000 BPM, log | M (quoted ".333 Hz to 50 Hz"), TE ("20..2999 BPM, Moog's law") | verified |
| RESET | Transport | (44.5, 101.4) | button 8 x 7.9 | press: both sequencers to step 1 and the rhythm generators to their starting phase; while PLAY is lit they begin again on the next clock pulse. Hold: sequencers stay on step 1 while the rhythm generators keep firing the EGs; NEXT while holding moves the held step | `reset` (momentary, event) | M (quoted), TE | verified (NEXT-while-held: likely) |
| EG | Transport | (57.5, 101.4) | button 8 x 7.9 | lit: sequencer steps fire both EGs; unlit: they do not (only TRIGGER and the TRIGGER jack); press and hold until it blinks: both EGs held open at maximum | `eg_mode` OFF / ON / HELD | M (quoted), KM | verified |
| NEXT | Transport | (70.6, 101.4) | button 8 x 7.9 | with PLAY unlit, moves to the next step so it can be tuned. Stock firmware forces rhythm-divider counts until Sequencer 1 steps; it does not fire the EGs | `next` (momentary, event) | M (quoted), TE | verified (count semantics: likely) |
| PLAY | Transport | (47.6, 111.7) | button 14 x 8.2 | starts / stops the sequencers, the rhythm generators and the CLOCK output | `play` (toggle, transport control) | M (quoted) | verified |
| TRIGGER | Transport | (67.4, 111.7) | button 14 x 8.2 | EG lit: "will instantly restart the envelope generators without waiting for the next step"; EG unlit: a gate - envelopes held at maximum while pressed; EG blinking: ignored (fw 1.1) | `trigger` (momentary, event) | M p.28-29 (quoted), FW | verified |

### Oscillators (centre)

| Printed label | Section | Position | Cap | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| OSCILLATORS, boxed 1 and 2 | heading | (135.0, 4.5), rules to the corners | - | - | labels | PS, TE | verified |
| (wave) VCO 1 | VCO 1 | (87.9, 25.6) | 3-way toggle, hex collar 6.4 x 5.5 | UP: square on VCO, SUB 1 and SUB 2. MIDDLE: square VCO, saw subs, SUB 1 saw normalled to the VCO's pulse width. DOWN: saw on all three | `vco1_wave` SQR / SQ/SAW / SAW (index 0 = up) | M pp.19-20, KM, PS ("Square up, saw down, PWM centre"), SOS | verified |
| VCO 1 FREQ | VCO 1 | (106.8, 25.6) | large | "four octaves... fully counter-clockwise ... Middle C (262 Hz) ... fully clockwise ... the highest C (4186 Hz)"; with QUANTIZE on it steps through the scale | `vco1_freq` 261.63-4186 Hz, log | M p.18 (quoted) | verified |
| VCO 2 FREQ | VCO 2 | (163.0, 25.6) | large | as VCO 1 (p.19 repeats it word for word) | `vco2_freq` | M p.19 | verified |
| (wave) VCO 2 | VCO 2 | (182.0, 25.6) | 3-way toggle | as VCO 1 | `vco2_wave` | M p.20 | verified |
| SEQ OCT | shared | button (134.9, 35.6), 10.1 x 6.2 | button | cycles the STEP range: ±5, ±2, ±1 octaves, shared by both sequencers | `seq_oct` ±1 / ±2 / ±5 | M p.28 (quoted) | verified |
| ±5 ±2 ±1 | shared | 3 LEDs above the SEQ OCT button | red LEDs | current range | radio LEDs | PS, TE | likely |
| SUB 1 FREQ | VCO 1 | (92.9, 51.6) | medium | "the initial pitch of VCO 1, divided by a whole number integer value from 1 to 16"; ÷1 fully clockwise | `vco1_sub1_freq` = -divisor | M p.18 (quoted), MG (8 CC values per integer, CC 0 = 16) | verified |
| SUB 2 FREQ | VCO 1 | (120.9, 51.6) | medium | as SUB 1 | `vco1_sub2_freq` | M p.19 | verified |
| SUB 1 FREQ, SUB 2 FREQ | VCO 2 | (148.9, 51.6), (177.1, 51.6) | medium | divide VCO 2 | `vco2_sub1_freq`, `vco2_sub2_freq` | M p.20 | verified |
| SEQ 1 ASSIGN: OSC 1, SUB 1, SUB 2 | VCO 1 | y 69.2; x 93.9 / 106.8 / 119.9; bracket and title above | button 8 x 7.9 | lit: Sequencer 1's step voltage moves VCO 1's pitch (subs follow, they divide it) / "will modify the integer value of the SUB n FREQ knob"; any combination | `seq1_osc`, `seq1_sub1`, `seq1_sub2` | M p.26 (quoted), PS | verified |
| SEQ 2 ASSIGN: OSC 2, SUB 1, SUB 2 | VCO 2 | y 69.2; x 149.9 / 163.0 / 176.0 | button 8 x 7.9 | as SEQ 1 for VCO 2 | `seq2_osc`, `seq2_sub1`, `seq2_sub2` | M p.27, PS | verified |
| QUANTIZE | shared | button (134.9, 85.7), 10.8 x 6.2 | button | 12-ET, 8-ET, 12-JI, 8-JI; "With all LEDs off ... the Quantize function is off" | `quantize` OFF / 12-ET / 8-ET / 12-JI / 8-JI | M p.21 (quoted) | verified (cycle order: guess) |
| 12-ET 8-ET 12-JI 8-JI | shared | 4 LEDs above the QUANTIZE button | red LEDs | current scale | radio LEDs | PS | likely |
| VCO 1 LEVEL | mixer | (106.8, 86.7) | medium | off - full; "The mixer can be pushed into a warm distortion by setting the sound sources near their maximum levels" | `vco1_level` 0-100 % | M p.21 (quoted) | verified |
| SUB 1 LEVEL, SUB 2 LEVEL | mixer, VCO 1 | (92.9, 109.7), (120.9, 109.7) | medium | off - full | `vco1_sub1_level`, `vco1_sub2_level` | M p.21, PS | verified |
| VCO 2 LEVEL | mixer | (163.0, 86.7) | medium | off - full | `vco2_level` | M p.21 | verified |
| SUB 1 LEVEL, SUB 2 LEVEL | mixer, VCO 2 | (148.9, 109.7), (177.1, 109.7) | medium | off - full | `vco2_sub1_level`, `vco2_sub2_level` | M p.21 | verified |

### Filter, envelopes and VCA (right; two columns, no heading)

| Printed label | Position | Cap | Range | Twin | Source | Confidence |
|---|---|---|---|---|---|---|
| CUTOFF | (205.1, 16.6) | large | "from 20 Hz to 20k Hz"; 4-pole low-pass ladder, 24 dB/oct | `cutoff` 20-20000 Hz, log | M p.23 (quoted) | verified |
| VOLUME | (235.2, 16.6) | large | output level | `volume` 0-100 % | M p.25, PS | verified |
| RESONANCE | (205.1, 47.6) | large | feedback; the filter "chirps" toward self-oscillation near maximum, sings above about 2 o'clock; bass thins as it rises | `resonance` 0-100 % | M p.23, SOS, F | verified (2 o'clock: likely) |
| VCF EG AMT | (235.2, 47.6) | large, `(–)` and `(+)` printed at the ends | "In the center position, the VCF EG has no effect. Positive (+) values ... open the filter on the Attack stage ... Inverse (–) values will close the filter during the Attack stage" | `vcf_eg_amt` -100..+100 % | M p.24 (quoted) | verified (full-scale octaves: guess) |
| VCF ATTACK | (205.1, 78.7) | large | 1 ms - 10 s | `vcf_attack` 1-10000 ms, log | M p.24 (quoted) | verified |
| VCF DECAY | (235.2, 78.7) | large | 5 ms - 10 s | `vcf_decay` 5-10000 ms, log | M p.24 (quoted) | verified |
| VCA ATTACK | (205.1, 109.7) | large | 1 ms - 10 s | `vca_attack` 1-10000 ms, log | M p.24 (quoted) | verified |
| VCA DECAY | (235.2, 109.7) | large | 5 ms - 10 s | `vca_decay` 5-10000 ms, log | M p.25 (quoted) | verified |

### Global parameters (no panel control)

| Parameter | How it is set on the hardware | Twin | Source | Confidence |
|---|---|---|---|---|
| Rhythm generator logic | MIDI CC 113: 0-63 OR ("advance the sequencer on either or both clocks"), 64-127 XOR ("on exactly one clock") | `rhythm_logic` OR / XOR, a small switch marked "MIDI CC 113" in the panel margin (twin convenience) | M, MG, TE ("exclusive-one (not parity XOR)") | verified |
| Fine tune | hold OSC 1 + OSC 2 until the QUANTIZE LEDs flash, TEMPO = ±50 cents, QUANTIZE exits; stored | not modelled | M p.40, IS | verified |
| SEQ output decoupling | hold QUANTIZE or SEQ OCT until it flashes: SEQ 1/2 outputs stop following that setting | not modelled (outputs always follow) | M p.36 | verified |
| MIDI channel, MIDI transport | SysEx files; transport ON by default | the twin follows the studio transport (see below) | IS, M | verified |
| Note priority | MIDI CC 91 low / high / last | last note | FW | verified |

## Patch bay (32 points)

Four columns by eight rows at a 13.54 x 13.51 mm pitch (x 255.2 / 268.7 / 282.3 / 295.8, y 16.6 ... 111.2).
17 inputs "identified by normal text", 15 outputs "indicated by reversed-color text over an inverse
background" (p.31). Row contents and order **verified** (PS reads them off p.50 and cross-checks the
manual's `ROW ONE`..`ROW EIGHT` headings: one output in rows 1, 3, 5; three in rows 2 and 4; none in
row 6; four in row 7; two in row 8). Twin signal convention: **1.0 = 5 V**.

| Row/col | Label | Dir | Level | Normal / behaviour | Source | Confidence |
|---|---|---|---|---|---|---|
| 1/1 | VCO 1 | in | ±5 V, 1 V/oct | summed with VCO 1 FREQ and Sequencer 1; **normalled to VCO 2's input** until a cable is in VCO 2 | M p.31, F (block diagram) | verified |
| 1/2 | VCO 1 SUB | in | ±5 V | "Chooses the 1-16 divider for both of VCO 1's subharmonics. Centre both SUB FREQ knobs first, for bipolar control" | M p.31 | verified (V per division: guess) |
| 1/3 | VCO 1 PWM | in | ±5 V | pulse width of VCO 1 and of its SUB 1 and SUB 2 (audible on square); **replaces the SUB 1 saw normal** | M p.32 (quoted) | verified |
| 1/4 | VCA | out | 10 V p-p | the whole instrument after the VCA (main out) | M p.32 | verified |
| 2/1 | VCO 1 | out | 10 V p-p | VCO 1 before the mixer ("AUDIO/CV OUTPUT") | M p.32 | verified |
| 2/2 | VCO 1 SUB 1 | out | 10 V p-p | SUB 1 before the mixer | M p.32 | verified |
| 2/3 | VCO 1 SUB 2 | out | 10 V p-p | SUB 2 before the mixer | M p.32 | verified |
| 2/4 | VCA | in | 0 to +8 V | "summed with the output control signal of the VCA EG" (not a normal) | M p.33 (quoted) | verified |
| 3/1 | VCO 2 | in | ±5 V, 1 V/oct | summed with VCO 2 FREQ and Sequencer 2; breaks the normal from VCO 1 | M p.33 | verified |
| 3/2 | VCO 2 SUB | in | ±5 V | divider CV for both of VCO 2's subs | M p.33 | verified |
| 3/3 | VCO 2 PWM | in | ±5 V | replaces the SUB 1 saw normal of VCO 2 | M p.33 | verified |
| 3/4 | VCA EG | out | 0 to +8 V | the amplitude envelope | M p.33 | verified |
| 4/1 | VCO 2 | out | 10 V p-p | VCO 2 before the mixer | M p.34 | verified |
| 4/2 | VCO 2 SUB 1 | out | 10 V p-p | | M p.34 | verified |
| 4/3 | VCO 2 SUB 2 | out | 10 V p-p | | M p.34 | verified |
| 4/4 | CUTOFF | in | ±5 V | "With the CUTOFF knob centered, the signal received here can sweep the Cutoff Frequency through" ±5 octaves; summed, no normal | M p.34 (quoted) | verified (no normal: likely, see conflicts) |
| 5/1 | PLAY | in | 0 to +10 V gate | "Rising edge = PLAY begins; Falling edge = PLAY stops"; the button still works by hand | M p.34 (quoted) | verified |
| 5/2 | RESET | in | 0 to +10 V | trigger: steps to 1, rhythm phase reset; held gate = Hold (EGs keep firing) | M p.35 (quoted) | verified |
| 5/3 | TRIGGER | in | 0 to +10 V | fires both EGs ("Continuous high voltage = GATE"); they will not restart during Attack | M p.35 | verified |
| 5/4 | VCF EG | out | 0 to +8 V | the filter envelope | M p.35 | verified |
| 6/1-4 | RHYTHM 1 ... RHYTHM 4 | in | ±5 V | "sets the timing of Rhythm Generator N by controlling the value of the RHYTHM N knob"; centre the knob for the widest range | M pp.35-36 (quoted) | verified (V per division: guess) |
| 7/1 | SEQ 1 | out | ±5 V | Sequencer 1's step voltage, following QUANTIZE and SEQ OCT | M p.36 | verified |
| 7/2 | SEQ 1 CLK | out | 0 to +5 V | a pulse each time Sequencer 1 advances (its polyrhythm); in phase with the internal clock since fw 1.1 | M p.36, FW, TE | verified |
| 7/3 | SEQ 2 | out | ±5 V | Sequencer 2's step voltage | M p.36 | verified |
| 7/4 | SEQ 2 CLK | out | 0 to +5 V | a pulse each time Sequencer 2 advances | M p.37 | verified |
| 8/1 | MIDI IN | in | 3.5 mm TRS (type A), MIDI LED beside it | clock, notes, CCs; MIDI clock overrides internal and CLOCK | M p.37 | verified |
| 8/2 | CLOCK | in | 0 to +10 V | "A clock signal received via this jack will override the internal clock setting"; one count per rising edge | M p.37 (quoted), TE | verified |
| 8/3 | CLOCK | out | 0 to +10 V | "reflects the current clock source, be it internal, external, or MIDI"; "only present while ... the PLAY button is lit" | M p.37 (quoted) | verified |
| 8/4 | TRIGGER | out | 0 to +5 V, 1 ms | every time the envelopes fire: sequencer steps, TRIGGER button, TRIGGER jack | M p.37 | verified |

## Behaviour notes

- **Clock sources.** Internal TEMPO clock at **1 PPQ** (one count per beat); an analog clock at CLOCK
  overrides it; MIDI clock overrides both and counts **sixteenth notes** ("Internal clock is 1 PPQ until a
  MIDI clock is detected. When MIDI clock is present, the PPQ is 4"). TE: "Moog's dividers count the
  clock's own events: quarter notes from TEMPO, sixteenths from MIDI clock, every edge at CLOCK".
  **verified** (M, TE).
- **Rhythm generators.** Each keeps a counter; a generator *fires* on the count where its counter is 0,
  then the counter advances and wraps at its divisor (a counter past a shrunken divisor wraps at the next
  count). RESET sets every counter to 0, so all four fire together on the next count. **likely** (TE
  `stock_divide`).
- **Rhythm logic.** Per sequencer, OR advances when one or more assigned generators fire (once, never
  twice); XOR advances only when exactly one fires - "if both Rhythm Generators are true, the sequencer
  will not advance" - and with three firing it does not advance either (exclusive-one, not parity).
  **verified** (M, MG, TE).
- **Sequencer steps.** Four steps; "In order for a sequencer to play, it must receive clock information
  from at least one of the rhythm generators" (p.26). After RESET the first count plays step 1, later
  counts advance. **verified** (M) / **likely** (TE `rhythm_advance`).
- **Envelope triggering.** With EG lit, a step on *either* sequencer fires both envelopes (one shared
  filter and VCA; "every step of sequencer 2 also triggered VCO 1"). **likely** (F, two threads). TE's
  stock emulation fires them on Sequencer 1 steps only - see conflicts.
- **Envelopes.** Attack/decay. "When a trigger is received, the VCA EG will complete the Attack stage,
  and then proceed to the Decay stage. When a gate is received, the VCA will complete the Attack stage
  and hold at the maximum level until the gate ends" (p.25). "While in the Attack phase, the VCF EG
  will not restart even when a new trigger or gate is received" (p.24, same for the VCA EG). A
  retrigger in the Decay stage restarts from the current level (F). Stock firmware smooths both EG
  outputs by "a few milliseconds" (TE). **verified** (M) / **likely** (F, TE).
- **Gates.** Gates come from the TRIGGER button with EG unlit, a held high at the TRIGGER jack, and
  held MIDI notes. Triggers come from sequencer steps, the TRIGGER button with EG lit and note-ons.
  **verified** (M p.25, p.29, p.35).
- **Quantizer.** The digital pitch (VCO FREQ knob + step + MIDI note) snaps to semitones; 8-ET and
  8-JI then fold each semitone down to the white key below it (C♯→C, D♯→D, F♯→F, G♯→G, A♯→A); JI
  modes take each note as C of its octave times a ratio. All scales are rooted on C ("locked to a root
  note of C", F). **likely** (TE `note_frequency`, `white_key`).
- **JI tables.** 8-JI is the manual's just C major: C 1/1, D 9/8, E 5/4, F 4/3, G 3/2, A 5/3, B 15/8
  (**verified**, M p.17 example). 12-JI: 1/1, 16/15, 9/8, 6/5, 5/4, 4/3, **7/5**, 3/2, 8/5, 5/3,
  **16/9**, 15/8 (**likely**: TE's test table, written against the stock table; the manual's p.17
  only explains the idea).
- **Sequencer reach.** "The sequencers cannot internally modulate the frequency of the VCOs any higher
  than 10k Hz (approximately)"; for the full ±5 range "set the VCO 1 FREQ and VCO 2 FREQ knobs fully
  counter-clockwise". **verified** (M).
- **Subharmonics.** True integer dividers: the processor measures each VCO, sets each sub's analog
  core and resets it every N cycles of its parent, so a sub stays phase-locked to its VCO (TE stock ABI:
  sub-oscillator reset pulses, parent capture/division). **verified** (M p.18 "divided by a whole number";
  TE).
- **MIDI.** "MIDI note data received by Subharmonicon is referenced as an offset from the note C4";
  with the FREQ knobs fully counter-clockwise notes play at pitch. While the sequencers run, notes
  transpose the sequence (fw 1.1). Notes trigger both envelopes. No pitch bend or MIDI out (SOS).
  **verified** (M, FW, TE).
- **Syncing.** p.38: patch Subharmonicon CLOCK out into the DFAM's ADV/CLOCK; TRIGGER, SEQ 1 CLK or
  SEQ 2 CLK clock the DFAM with a polyrhythm. p.39: a Mother-32 ASSIGN (clock) into CLOCK in - press
  PLAY on the Subharmonicon first. **verified** (M, IS).
- **No noise source, no audio input, no LFO.** **verified** (M p.31, p.58, via PS).

## Conflicts and how the twin resolves them

| Topic | Claims | Twin |
|---|---|---|
| VCO FREQ range | M: four octaves, 262-4186 Hz. MG: "-2.5 to +2.5 octaves" | Both right: MG's range is the MIDI CC, which M says is "added to the VCO 1 FREQ knob setting". The knob is 4 octaves. |
| Who fires the EGs | F (two threads): either sequencer's step. TE stock emulation: Sequencer 1 steps only | Either sequencer (hardware users' reports). |
| CUTOFF normal | One search summary: "the VCF EG is normalled to the CUTOFF input". M p.34 describes the jack with the knob centred and no EG; PS lists no normal; VCA in is explicitly summed | Summed, no normal. |
| Sub / rhythm CV scaling | The previous twin: 1.5 divisions per volt; salvaged `theory.ts`: 3 per volt | M: centre the knob for bipolar control, ±5 V. Twin: 10 V spans the whole knob (1.6 divisions per volt). |
| Tempo range | AD: 0.333-3000 Hz | M: .333-50 Hz (20-3000 BPM); AD confused BPM and Hz. |
| Studio sync vs CLOCK cable | M: MIDI clock overrides CLOCK | The studio's MIDI-style sync is always connected, so the twin lets a cable in CLOCK take over the clock; the studio transport still starts and stops PLAY. Turn studio sync off to get the hardware's "no MIDI" behaviour. |

## Model choices (guesses to check against hardware)

| Quantity | Twin value |
|---|---|
| Sub and rhythm CV (jacks, and SEQ ASSIGN SUB) | 10 V = the knob's whole travel = 16 divisions; + voltage moves toward ÷1 |
| SEQ ASSIGN SUB uses | the sequencer's (quantized) step voltage on that scale |
| VCF EG AMT full scale | ±6 octaves for the full 8 V envelope |
| CUTOFF jack | 1 V/oct |
| EG peak | +8 V; RC attack toward 1.5 x peak; exponential decay that falls 60 dB over DECAY; 1 ms output smoothing |
| RESONANCE | self-oscillation from ~78 % of travel (about 2 o'clock) |
| Mixer | level² taper per source, then a soft tanh bus: one full source is nearly clean, three or more saturate warmly |
| MIDDLE wave PWM depth | the SUB 1 saw moves the width ±30 % (e.g. 20/70 % duty on alternate cycles at ÷2) |
| PWM jack | ±5 V = ±45 % width |
| Analog drift | ±1.5 cents, slow, per VCO (subs follow their VCO) |
| CLOCK / SEQ CLK pulse width | 5 ms (TE stock constant `RHYTHM_OUTPUT_PULSE_MS = 5`) |
| Cycle order of QUANTIZE | 12-ET → 8-ET → 12-JI → 8-JI → off → 12-ET |
| EG from HELD | a press returns to ON |
| Small knob size | 9 mm (hardware 6.3 mm bodies) for touch |

## Presets

The manual's Presets section (printed pp.45-49) has **ten patch sheets**: AQUATIC CHORDS, MELLOW
HARMONIES, SLIP & FALL, POINT ZERO, THREE HANDS ON THE WHEEL, BATERIA, SPIRAL WAYS, STAR-GATE, POLY ROCK
and CLOUD PATH (PS, verified). What could be read of them:

- **BATERIA** (p.47): all six levels down, RESONANCE fully up, VOLUME full; cables SEQ 2 CLK → VCA,
  SEQ 1 CLK → CUTOFF, SEQ 1 → RHYTHM 1, SEQ 2 → RHYTHM 2. NOTES: "Kick drum tuning is controlled via
  filter CUTOFF. Adjust VCF DECAY and EG AMT knobs for different kick drum flavors" (PS read it off
  the drawing).
- **SPIRAL WAYS** (p.48): levels 60/60/60 and 64/100/100, VCF EG → RHYTHM 1; NOTES: "Tune sequencers
  to desired pitches. Tune SUB VCO 1 FREQ 1 to a Fifth. Tune SUB VCO 2 SUB 2 to a Major 3rd. Adjust VCF
  ATTACK for crescendo depth" (PS).
- **AQUATIC CHORDS** and **MELLOW HARMONIES** (p.45) both draw SEQ 1 → CUTOFF (PS); Aquatic Chords also
  CLOCK → TRIGGER with EG off (JonDent blog, via search).
- **SLIP & FALL** (p.46) shares SPIRAL WAYS' filter-envelope-into-a-divider trick (PS); "Blippy,
  Unusual, ModRhythm, ±1" (PP).
- **POLY ROCK**: "Chords, Plucky Percussion, ±1, 8-ET ... Tune SUB OSC 1, 2, 3, and 4 to desired chord
  shapes", CLOCK → VCA for the drum sounds (PP).
- **CLOUD PATH**: "Arpeggiated, Blippy, Chords, ModRhythm, Melodic, ±1, 12-ET"; "Press RHYTHM 3 SEQ 1
  for double-time feels" (PP).
- POINT ZERO, THREE HANDS ON THE WHEEL, STAR-GATE: names only.

Exact knob positions are drawings we could not see, so every twin preset is a **recreation** from these
notes and says so. *Patching with Intention* (PWI) contributes its exercise chain (Initialized Patch,
First Steps: SEQ 1 → VCO 1 by cable; Intertwining Sequencers: SEQ 2 → VCO 1; From Melody to Rhythm:
resonance near maximum makes the sequence percussive; Fun with Envelopes; Intermingled Drum Machine:
VCO 1 SUB 1 → RHYTHM 2, "sub-oscillators ... can function in much the same way" as LFOs). Moog's DFAM &
Subharmonicon Exploration Patchbook titles (RV: Plush Leather, Ali's Bubblin', Arcade Blasts, Stack 'Em Up,
Subfunkicon, Grapefruit and Honey) are two-instrument patches; the twin's Subharmonicon halves carry our
own names and credit the original in their descriptions.
