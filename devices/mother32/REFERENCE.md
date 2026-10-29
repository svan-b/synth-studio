# Moog Mother-32 - hardware reference for the digital twin

Ground truth used to build `devices/mother32`: every control, button, LED and patch point with its
printed label, position, range and behaviour, the sequencer and MIDI behaviour, where each fact
comes from, and how sure we are.

- **verified**: stated in the Mother-32 Owner's Manual (or another Moog document), cited by page.
- **likely**: measured from a manual drawing, or a direct consequence of verified facts.
- **guess**: not documented anywhere we could reach; chosen to match the documented behaviour by
  ear. Every guess is listed again in "Model choices".

**Page numbers.** "(Mother-32 manual, p.N)" is the *printed* page number of the *Mother-32 User
Manual Version 2* (©2020 Moog Music, 73 PDF pages, firmware 2.0), as printed at the foot of each page
and used by the manual's own contents page. The printed number is the PDF page minus one: the patch
bay overview is printed p.46, PDF page 47. `docs/research/mother32/` cites PDF pages, one higher.
The code (`spec.ts`, `lessons.ts`, `presets.ts`, the worklet) uses printed pages too.

Facts are written in our own words; the few short quotations are marked and cited
(`docs/research/COPYRIGHT-RULES.md`). No manual text, drawing or page render is in the repository.

## Sources

| Id | Source | Used for |
|----|--------|----------|
| MAN | Moog, *Mother-32 User Manual Version 2* (©2020): every chapter, the default-panel drawing (p.9), the patch-bay drawing (p.46), the nine patch sheets (pp.64-66) and the blank sheets (pp.67-69) | everything marked verified |
| DFAM | Moog, *DFAM Owner's Manual with Patch Sheets*, "Syncing DFAM with a Mother-32" (DFAM manual, p.31) | the ASSIGN-clock recipe in lesson st2 |
| SOS | Sound On Sound review of the Mother-32 (search excerpts), quoting Moog's figures | EG time ranges (attack 1.25 ms - 3 s, decay 1.25 ms - 7 s, nominal) |
| MS | Moog support articles: VCA CV distortion above +5 V; MIDI sync at half or double time | VCA CV clipping; why TEMPO selects the division under sync |
| PS | The patchscore project's 200 dpi measurement of a blank patch-sheet drawing (Mother-32 manual, p.68), moved into faceplate coordinates (x - 7.25 mm cheek, y - 2.25 mm) | knob, switch, button and jack centres |
| PD9 | Our own measurement of a 200 dpi render of the default-panel drawing (Mother-32 manual, p.9): faceplate 169.5-1470 px wide (4.27 px/mm) | screws, button legends, bottom band |
| L0 | The first build of this twin | nothing still relied on |

## Panel

- 60 HP Eurorack format with aluminium rails and wooden side pieces. **verified** (Mother-32 manual,
  p.9). As a module: 60 HP, 26 mm deep, 230 mA maximum from +12 V, no -12 V. **verified** (Mother-32
  manual, p.63, p.70).
- Whole unit 31.93 x 10.69 x 13.3 cm (W x D x H, depth including the knobs), 1.58 kg. **verified**
  (Mother-32 manual, p.70). Faceplate 304.8 x 128.5 mm (60 HP x 3U, the Eurorack standard): **likely**.
  The twin draws 7.25 mm cheeks either side.
- Three rows of knobs and bat toggles; under them two rows of square pads (the 13-note keyboard
  doubling as the sequencer buttons); the 5-pin MIDI IN socket bottom left; the 4 x 8 patch bay on
  the right under the legend "IN / OUT" with OUT reversed. No section boxes are printed. **verified**
  (Mother-32 manual, p.9, p.46).
- Eight black M3 panel screws (Mother-32 manual, p.63), four along the top and four along the bottom.
  **verified**. Their x positions, about 12.2, 103.9, 200.9 and 292.6 mm: **likely** (PD9, +/- 1 mm).
- Fourteen knobs of one size, black caps with a white pointer. **verified** (Mother-32 manual, p.9:
  the drawing). The twin draws 14.5 mm caps plus the printed tick ring; FREQUENCY, PULSE WIDTH,
  TEMPO and LFO RATE also carry a second ring, as drawn. **likely** (size).
- Small round holes beside FREQUENCY, PULSE WIDTH (both sides), VCO MOD AMOUNT and LFO RATE.
  **verified** (Mother-32 manual, p.9). Four of them reach the VCO trimmers (VCO offset, frequency
  control gain, external 1V/oct gain, KB CV gain). **verified** (Mother-32 manual, p.61). They are
  drawn, not adjustable.
- Legends: white on black. Input jacks are labelled in plain text, outputs reversed (dark text in a
  white box), and gate inputs are drawn inside a circle. **verified** (Mother-32 manual, p.46).
- Switch positions are printed above and below each lever; the drawings circle the active one.
  **verified** (Mother-32 manual, p.9, pp.64-66). See "Simplified" for how the twin shows them.
- Printed scales and legends: CUTOFF 20Hz, 200Hz, 2KHz, 20KHz; MIX "VCO" (CCW) and "NOISE / EXT"
  (CW); VC MIX "LO / MIX 1" (CCW) and "HI / MIX 2" (CW); "(SWING)" under TEMPO. **verified**
  (Mother-32 manual, p.9).
- Every sequencer button's legend is printed under it; the step numbers 1-8 are under the step pads
  with the step LEDs under the numbers; "OCTAVE / LOCATION" is printed above its eight LEDs with
  1-8 under them. **verified** (Mother-32 manual, p.9).
- Bottom band: "MOTHER-32 | SEMI-MODULAR ANALOG SYNTHESIZER" at the left and the Moog logo centred.
  **verified** (Mother-32 manual, p.9). The twin sets both in type (no logo artwork).
- Rear panel: 1/4-inch TS audio / headphone output, 12 V DC power, Kensington slot; no power switch.
  **verified** (Mother-32 manual, p.8, p.70). Not drawn: the twin's output goes to the studio mixer.

## Controls

Positions are faceplate millimetres (x, y) of the control centre (PS, PD9): **likely**, +/- 1.5 mm.

### Row 1 (y 18.0)

| Label | Position | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|
| FREQUENCY | (21.7, 18.0) | tunes the VCO up or down one octave from the centre; calibrated to slightly more than +/-1 octave | -1...+1 oct; at the centre KB 0 V is C4 (261.6 Hz) | (Mother-32 manual, p.11, p.62) | **verified** |
| VCO WAVE | (51.3, 18.0) | UP pulse, DOWN saw (default saw); the chosen wave goes to the CCW side of MIX; both waves always have jacks | PULSE / SAW | (Mother-32 manual, p.11, p.9) | **verified** |
| PULSE WIDTH | (80.8, 18.0) | about 2 % (CCW) to 98 % (CW), a square at the centre; modulation can reach 0 % / 100 %, where the pulse cuts out | 2-98 % | (Mother-32 manual, p.11, p.12) | **verified** |
| MIX | (110.3, 18.0) | CCW: the VCO wave; CW: noise, or EXT. AUDIO when patched; the mixer is AC coupled | 0-100 %, linear crossfade | (Mother-32 manual, p.13, p.47) | **verified** (law: guess) |
| CUTOFF | (146.1, 18.0) | 20 Hz - 20 kHz | log | (Mother-32 manual, p.14, p.9) | **verified** |
| RESONANCE | (181.8, 18.0) | LOW PASS: self-oscillates above 3 o'clock; HI PASS: non-resonant, any RESONANCE brings the bass back | 0-100 % | (Mother-32 manual, p.14) | **verified** |
| VCA MODE | (206.3, 18.0) | UP ON (open, no gate needed), DOWN EG (default) | ON / EG | (Mother-32 manual, p.16, p.9) | **verified** |
| VOLUME | (228.7, 18.0) | level of both the VCA jack and the 1/4-inch output; fully CCW is silent | 0-100 % | (Mother-32 manual, p.16) | **verified** (taper: guess) |

### Row 2 (y 46.9)

| Label | Position | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|
| GLIDE | (21.8, 46.9) | glide time for keyboard, MIDI and sequencer notes; while a step is edited it switches that step's glide (any CW position on, fully CCW off); SHIFT + GLIDE sets ratchets | 0-2000 ms | (Mother-32 manual, p.17, p.19, p.26) | function **verified**; time range **guess** |
| VCO MOD SOURCE | (51.3, 46.9) | UP "EG / VCO MOD" (the EG, or the VCO MOD jack, which replaces it), DOWN LFO (default) | EG / LFO | (Mother-32 manual, p.12, p.49, p.9) | **verified** |
| VCO MOD AMOUNT | (80.8, 46.9) | how much of the source reaches the destination; attenuates the VCO MOD jack | 0-100 % | (Mother-32 manual, p.12, p.49) | **verified** (depth: guess) |
| VCO MOD DEST | (110.5, 46.9) | UP PULSE WIDTH, DOWN FREQUENCY (default) | PW / FREQ | (Mother-32 manual, p.12, p.9) | **verified** |
| VCF MODE | (139.9, 46.9) | UP HI PASS, DOWN LOW PASS (default) | HP / LP | (Mother-32 manual, p.14, p.9) | **verified** |
| VCF MOD SOURCE | (169.6, 46.9) | UP EG (default), DOWN LFO | EG / LFO | (Mother-32 manual, p.15, p.9) | **verified** |
| VCF MOD AMOUNT | (199.2, 46.9) | how far the source moves the cutoff | 0-100 % | (Mother-32 manual, p.15) | **verified** (depth: guess) |
| VCF MOD POLARITY | (228.6, 46.9) | UP + (default), DOWN -: the modulation raises or lowers the cutoff | + / - | (Mother-32 manual, p.15, p.9) | **verified** |

### Row 3 (y 75.9)

| Label | Position | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|
| TEMPO / GATE LENGTH (SWING) | (41.0, 75.9) | internal clock 20-300 BPM; while a step is edited, its gate length (1/8 - 8/8 of the step; 8/8 ties into the next); SHIFT: swing amount (50 % at 12:00 is straight); with MIDI or an analog clock, or KB / STEP held, one of 24 clock divisions | BPM; gate 1-8; swing 0-100 %; division | (Mother-32 manual, p.18, p.19, p.25, p.54) | **verified** |
| LFO RATE | (80.8, 75.9) | about 0.1 Hz to 350 Hz; up to 600 Hz with CV | log | (Mother-32 manual, p.13) | **verified** |
| LFO WAVE | (110.4, 75.9) | UP square, DOWN triangle (default); the chosen wave feeds both MOD SOURCE switches; both waves always have jacks | SQ / TRI | (Mother-32 manual, p.13, p.9) | **verified** |
| ATTACK | (139.9, 75.9) | time to rise from zero to the peak | 1.25 ms - 3 s, log | (Mother-32 manual, p.15); range SOS | function **verified**; range **likely** |
| SUSTAIN | (169.5, 75.9) | UP ON (default): holds the peak while a note is held, and overlapping notes do not retrigger; DOWN OFF: the attack moves on to the decay when complete or at note-off, whichever comes first, and every note retriggers | ON / OFF | (Mother-32 manual, p.16, p.9) | **verified** |
| DECAY | (199.2, 75.9) | time to fall from the current or peak level to zero | 1.25 ms - 7 s, log | (Mother-32 manual, p.16); range SOS | function **verified**; range **likely** |
| VC MIX | (228.7, 75.9) | crossfades MIX 1 (CCW) and MIX 2 (CW); DC coupled; not wired to the synth inside | 0-100 % | (Mother-32 manual, p.21, p.50, p.51) | **verified** |

### Sequencer buttons

The 13 pads form a one-octave keyboard, C to C: the eight lower pads are the white keys and the step
buttons 1-8; the upper 1-8, 9-16, 17-24, 25-32 and SET END pads are the black keys. **verified**
(Mother-32 manual, p.17, p.36, p.70: 13 momentary pads). Pads 8.3 x 7.2 mm; the arrows are triangles
about 9.7 x 10.4 mm. **likely** (PS, PD9).

| Label | Position | Function | Source | Confidence |
|---|---|---|---|---|
| HOLD / REST | (40.0, 96.0) | running: repeats the current step while held; editing: rest on / off; in Record: writes a rest and moves on; SHIFT: live mute | (Mother-32 manual, p.19, p.26, p.28, p.29, p.42) | **verified** |
| PATTERN (BANK) | (70.6, 96.0) | with step 1-8 or the arrows: a pattern of the current bank; SHIFT + PATTERN: the bank; PATTERN + RESET: restore the stored pattern; SHIFT + RESET + PATTERN: initialize | (Mother-32 manual, p.18, p.31, p.32, p.37, p.39) | **verified** |
| 1-8 / 9-16 / 17-24 / 25-32 | (134.1 / 149.3 / 179.9 / 195.3, 96.0) | black keys C#, D#, F#, G#; page select (STEP mode, or SHIFT + page in KB mode); the selected page stops page chasing until pressed again | (Mother-32 manual, p.30, p.36, p.43, p.44) | **verified** |
| SET END | (210.5, 96.0) | black key A#; the last step (STEP mode: SET END + step; KB mode: SHIFT + SET END, then SHIFT + step); new steps past the old end get the default note (-1 V) and gate (50 %) unless edited before | (Mother-32 manual, p.30, p.33, p.43, p.44) | **verified** |
| RESET / ACCENT | (40.0, 108.2) | running: back to step 1; editing: accent on / off; SHIFT: live accent | (Mother-32 manual, p.19, p.25, p.28, p.29) | **verified** |
| (SHIFT) | (55.3, 108.2) | modifier, pressed and held | (Mother-32 manual, p.18) | **verified** |
| RUN / STOP (REC) | (70.7, 108.2) | start / pause (resumes from the next step); SHIFT: Record (KB mode); SHIFT held for a second: save | (Mother-32 manual, p.18, p.28, p.31) | **verified** |
| (KB) and (STEP) arrows | (89.4 / 106.7, 108.2) | octave down / up (8 settings, 4 at power-up); SHIFT + arrow: KB / STEP mode; STEP mode: rotate the pattern; held while turning TEMPO or GLIDE: dotted (KB), triplet (STEP) or straight (both) division / swing interval; both held + step 1-4: direction; both held + RUN / STOP: pre-arm for a TEMPO-jack clock | (Mother-32 manual, p.17, p.21, p.23, p.35, p.40, p.54) | **verified** |
| 1 ... 8 | (126.4 + 15.3 k, 108.2) | white keys C D E F G A B C; STEP mode: step on / off; SHIFT + step: edit it (stopped: its note sounds); SHIFT + the same step: stop editing | (Mother-32 manual, p.30, p.33, p.36, p.44) | **verified** |

### LEDs

| LED | Position | Behaviour | Source | Confidence |
|---|---|---|---|---|
| Tempo | directly above (SHIFT), (55.3, 96.0) | blinks with the steps: red on the internal clock, green on MIDI or a TEMPO-jack clock; solid yellow in Record; blinks red again when Record ends; yellow alternating with red while a step is edited; flashes yellow in Setup | (Mother-32 manual, p.18, p.24, p.27, p.32, p.44, p.54, p.58) | **verified** |
| OCTAVE / LOCATION x 8 | (82.4 + 4.5 k, 96.0) | red: the keyboard octave, the gate-length bar while a step is edited, Setup values 9-16; green: the pattern page, the KB-mode step flags (LED 5 glide, 6 ratchet, 7 accent, 8 rest), the pattern location, the save destination, the swing interval, Setup values 1-8; yellow: the bank, the ratchet count on LEDs 1-4, the clock division, the STEP-mode step flags, the Setup page; a page and the octave on one LED alternate between their colours | (Mother-32 manual, p.17, p.21, p.24-27, p.31, p.32, p.36, p.42-45, p.54, p.58) | **verified** |
| Step x 8 | under the step numbers, (126.4 + 15.3 k, 116.4) | the playing step; in Record the step being written blinks and written steps stay lit; STEP mode: which steps are on; the set-end step blinks at half the tempo | (Mother-32 manual, p.24, p.25, p.28, p.30, p.33, p.36) | **verified** |
| MIDI IN | left of TEMPO, (14.3, 77.4) | flashes red while MIDI arrives | (Mother-32 manual, p.21, p.9) | **verified** |

The manual has one conflict here: the STEP-mode tutorial lights the accent flag (LED 7) yellow
(Mother-32 manual, p.35), the quick reference green (Mother-32 manual, p.45). The twin follows p.36:
step flags are yellow in STEP mode.

## Patch bay (32 points: 18 inputs, 14 outputs)

Four columns at x = 256.2, 270.0, 283.9, 297.8 mm and eight rows on a 13.4 mm pitch from y = 19.6
(PS): **likely**. The order, labels and in / out printing are **verified** (Mother-32 manual, p.46,
p.22, p.70). Twin signal convention: 1.0 = 5 V.

| Row / col | Label | Dir | Level / behaviour | Normal | Source | Confidence |
|---|---|---|---|---|---|---|
| 1/1 | EXT. AUDIO | in | unity gain, made for 10 V peak to peak (Eurorack level); line level is weak | NOISE (a cable replaces it) | (Mother-32 manual, p.13, p.47) | **verified** |
| 1/2 | MIX CV | in | sums with MIX; with MIX centred, -5...+5 V crossfades the VCO wave to EXT. AUDIO | - | (Mother-32 manual, p.47) | **verified** |
| 1/3 | VCA CV | in | 0...+8 V in EG mode, +/-5 V in ON mode, summed with the VCA MODE switch; above +5 V the VCA distorts | - | (Mother-32 manual, p.47), MS | **verified** |
| 1/4 | VCA | out | after VOLUME, +/-5 V typical | | (Mother-32 manual, p.47) | **verified** |
| 2/1 | NOISE | out | white noise, +/-5 V typical; also the EXT. AUDIO normal | | (Mother-32 manual, p.48) | **verified** |
| 2/2 | VCF CUTOFF | in | sums with CUTOFF and VCF MOD; with CUTOFF centred and VCF MOD off, -5...+5 V sweeps 20 Hz - 20 kHz | - | (Mother-32 manual, p.48) | **verified** |
| 2/3 | VCF RES. | in | sums with RESONANCE; with RESONANCE centred, -5...+5 V sweeps minimum to maximum | - | (Mother-32 manual, p.48) | **verified** |
| 2/4 | VCF | out | the ladder output, at most about +/-5 V | | (Mother-32 manual, p.48) | **verified** |
| 3/1 | VCO 1V/OCT | in | exponential, summed with FREQUENCY, the keyboard CV and VCO FM; with everything else at 0 V, -5...+5 V sweeps 8 Hz - 8 kHz | - | (Mother-32 manual, p.48) | **verified** |
| 3/2 | VCO LIN FM | in | linear FM for audio-rate modulation; takes -5...+5 V | - | (Mother-32 manual, p.49) | **verified** (depth: guess) |
| 3/3 | VCO SAW | out | +/-5 V, whatever VCO WAVE says | | (Mother-32 manual, p.49, p.11) | **verified** |
| 3/4 | VCO PULSE | out | +/-5 V | | (Mother-32 manual, p.49) | **verified** |
| 4/1 | VCO MOD | in | goes to the UP position of VCO MOD SOURCE; VCO MOD AMOUNT attenuates it | the EG (a cable replaces it) | (Mother-32 manual, p.12, p.49) | **verified** |
| 4/2 | LFO RATE | in | sums with RATE; with RATE centred, -5...+5 V sweeps about 0.18 - 190 Hz; 600 Hz at most | - | (Mother-32 manual, p.49) | **verified** |
| 4/3 | LFO TRI | out | +/-5 V | | (Mother-32 manual, p.50) | **verified** |
| 4/4 | LFO SQ | out | +/-5 V | | (Mother-32 manual, p.50) | **verified** |
| 5/1 | MIX 1 | in | DC coupled, -5...+5 V, the CCW side of VC MIX | 0 V | (Mother-32 manual, p.50) | **verified** |
| 5/2 | MIX 2 | in | DC coupled, -5...+5 V, the CW side of VC MIX | +5 V (nominal) | (Mother-32 manual, p.50) | **verified** |
| 5/3 | VC MIX CTRL | in | sums with VC MIX; with VC MIX centred, -5...+5 V crossfades MIX 1 to MIX 2 | - | (Mother-32 manual, p.50) | **verified** |
| 5/4 | VC MIX | out | the blend, +/-5 V; with nothing patched a 0...+5 V source; also an attenuator or a VCA | | (Mother-32 manual, p.51) | **verified** |
| 6/1 | MULT | in | buffered; a CV splitter only, not a mixer | - | (Mother-32 manual, p.51) | **verified** |
| 6/2 | MULT 1 | out | buffered copy | | (Mother-32 manual, p.51) | **verified** |
| 6/3 | MULT 2 | out | buffered copy | | (Mother-32 manual, p.51) | **verified** |
| 6/4 | ASSIGN | out | one of 16 sources, Setup page 1; default the sequencer clock (see below) | | (Mother-32 manual, p.22, p.52, p.59, p.61) | **verified** |
| 7/1 | GATE (circled) | in | a 0...+5 V gate triggers the EG; 10 V tolerant | - | (Mother-32 manual, p.53, p.46) | **verified** |
| 7/2 | EG | out | 0...+7.5 V | | (Mother-32 manual, p.53) | **verified** |
| 7/3 | KB | out | -5...+5 V, after GLIDE and pitch bend (default bend +/-1 octave = +/-1 V) | | (Mother-32 manual, p.53) | **verified** |
| 7/4 | GATE | out | +5 V for each keyboard, sequencer or MIDI note | | (Mother-32 manual, p.53) | **verified** |
| 8/1 | TEMPO | in | -5...+5 V by default, 0...+5 V by Setup page 8; four modes on Setup page 3 (below) | - | (Mother-32 manual, p.55, p.59, p.60) | **verified** |
| 8/2 | RUN / STOP (circled) | in | the sequencer plays from where it is while above about +3.2 V and stops when the voltage drops; the last action of the button or the jack wins; a clock here steps like repeated presses, with the internal clock not synced; safe to +15 V | - | (Mother-32 manual, p.56) | **verified** |
| 8/3 | RESET (circled) | in | resets to step 1 and repeats it while high; advances from step 1 when it drops | - | (Mother-32 manual, p.56) | **verified** |
| 8/4 | HOLD (circled) | in | while running, repeats the current step while high | - | (Mother-32 manual, p.56) | **verified** |

Only GATE, RUN / STOP, RESET and HOLD are circled; TEMPO is not. **verified** (Mother-32 manual,
p.46). The manual lists four normals (EXT. AUDIO, VCO MOD, MIX 1, MIX 2); every other input sums.
**verified** (Mother-32 manual, pp.47-50). The GATE input is OR-ed with the internal gate: a model
choice (the manual does not say).

ASSIGN sources (Setup page 1), in order: 1 accent (0...+5 V, a filtered pulse on accented steps),
2 clock (default, one pulse per step), 3 clock / 2, 4 clock / 4, 5 step ramp (-5...+5 V, rising over
the pattern, reset at step 1), 6 step saw (falling), 7 step triangle (rising and falling on alternate
passes), 8 step random (-5...+5 V per step), 9 step 1 trigger, 10 MIDI velocity, 11 channel
pressure, 12 pitch bend, 13-16 MIDI CC 1, 2, 4, 7 (all -5...+5 V). **verified** (Mother-32 manual,
p.52, p.59).

## Sequencer

- Monophonic, up to 32 steps per pattern, 64 patterns in 8 banks of 8. Each step holds a note, gate
  length, accent, rest, glide on / off and a ratchet count; a gate of 8/8 is a tie. Accent opens the
  VCF and VCA by a fixed amount. **verified** (Mother-32 manual, p.18, p.23, p.24, p.25, p.70).
- Two modes, KB (default) and STEP, changed with SHIFT + KB / SHIFT + STEP at any time.
  **verified** (Mother-32 manual, p.17, p.23).
- **Initialize**: SHIFT + RESET + PATTERN makes the working pattern one step of the default note
  (-1 V, C3) at 50 % gate; memory is untouched, unsaved edits are lost. **verified** (Mother-32
  manual, p.24, p.32, p.39, p.43).
- **KB-mode Record** (SHIFT + RUN / STOP, with the sequencer paused): "step-write" entry. The first
  note or rest goes into step 1, the next into step 2 and so on; the step just written keeps
  blinking, so its gate length, accent, glide and ratchet can still be set; a new note takes the
  previous step's gate length; a key still held when the next is played ties them; REST writes a
  rest and moves on. Record does not clear the pattern: it overwrites from step 1, and writing past
  the end moves the end. RUN / STOP (or STEP mode) ends it. **verified** (Mother-32 manual, pp.24-27,
  p.30, p.42); "the end moves" is how an initialized one-step pattern grows to 8 steps in the
  tutorial: **likely**.
- **Step edit** (both modes): SHIFT + step selects it (if stopped, its note sounds), the keys set
  its note, TEMPO its gate, GLIDE its glide (SHIFT + GLIDE its ratchet), ACCENT and REST toggle;
  SHIFT + the same step ends it. In Record this pauses step-write. **verified** (Mother-32 manual,
  p.30, p.33, p.36, p.43, p.44, p.45).
- **STEP mode**: step buttons switch steps on / off (rests); the arrows rotate the pattern.
  **verified** (Mother-32 manual, p.33, p.35, p.36, p.44).
- **Playback**: RUN / STOP pauses on the step reached and resumes from the next; RESET returns to
  step 1; HOLD repeats the current step. **verified** (Mother-32 manual, p.28). Directions forward
  (default), reverse, pendulum and random (KB + STEP + step 1-4). **verified** (Mother-32 manual,
  p.40). While running, the keys transpose the pattern from the low C at octave 4; not stored.
  **verified** (Mother-32 manual, p.29, p.42).
- **Live functions** (only while held, not stored): SHIFT + ACCENT accents every step, SHIFT + REST
  mutes, SHIFT + GLIDE sets 1-4 ratchets on every step. **verified** (Mother-32 manual, p.29, p.41).
- **Swing**: SHIFT + TEMPO sets the swing amount, 50 % at 12:00 (no swing); the manual also states
  the range as -100 % ... +100 % with 0 at the centre, where -100 % plays only the off-beats and
  +100 % only the on-beats. The swing interval (eight note values, each straight, dotted or triplet;
  GLIDE with KB, STEP or both held) sets what the on-beat / off-beat pair spans; a step that
  straddles the change finishes at the other rate. Amount and interval are stored per pattern;
  setting the clock division also resets the swing interval. **verified** (Mother-32 manual, p.19,
  p.20, p.21, p.28). The twin's SWING AMOUNT is 0-100 % with 50 % straight.
- **Clock division**: 24 values (two whole notes to 1/64; straight, dotted, triplet). Under MIDI or
  an analog clock TEMPO picks a straight value directly; on the internal clock hold KB + STEP; KB
  alone gives dotted, STEP alone triplet; shown on yellow LEDs. **verified** (Mother-32 manual,
  p.54). Default 1/16: **likely** (the clock in / out defaults are 4 PPQN, sixteenth notes;
  Mother-32 manual, p.61).
- **Memory**: patterns are saved by holding SHIFT + RUN / STOP for a second, choosing the slot (the
  arrows, or SHIFT + a step; BANK held for the bank) and pressing SHIFT + RUN / STOP; RUN / STOP
  cancels. Changing pattern discards unsaved edits; PATTERN + RESET restores. Save modes (Setup
  page 6): manual, auto save (edits kept, the original restorable with PATTERN + RESET), write
  protect. **verified** (Mother-32 manual, p.31, p.38, p.39, p.60).
- **Pattern change**: during playback a new pattern waits for the current one to finish (Delay
  Pattern Change, Setup page 8 option 6, normally on); loading restores the saved clock division and
  swing (Load Saved Timing, option 7, default on). **verified** (Mother-32 manual, p.37, p.60, p.61).

### Clocks and the TEMPO input

- Priority: an analog clock at TEMPO overrides MIDI clock, which overrides the internal clock.
  **verified** (Mother-32 manual, p.55). In the studio the transport plays the part of MIDI clock.
- Internal tempo 20-300 BPM; the Tempo LED is red on the internal clock and green on an external
  one. **verified** (Mother-32 manual, p.54).
- TEMPO input modes (Setup page 3): 1 tempo CV (with the knob centred, -5...+5 V spans
  20-300 BPM); 2 single clock advance, the default (each rising edge faster than 1 V/ms plays one
  step, the internal clock and TEMPO knob are ignored, ratchets follow a steady clock, RUN / STOP or
  the TEMPO knob brings the internal clock back); 3 analog clock at the Setup page 4 PPQN (1-14, 24,
  48; default 4), overriding the internal clock and MIDI until it stops; 4 step address CV (the
  voltage range is divided evenly across the steps; RUN / STOP restores normal playback until the
  voltage moves again). **verified** (Mother-32 manual, p.55, p.59, p.61).
- Pre-arm: with TEMPO in mode 2 or 3, KB + STEP + RUN / STOP waits for the next clock; RESET first
  starts it from step 1. **verified** (Mother-32 manual, p.40).

### Setup mode (SHIFT + RESET + SET END + STEP 8)

Pages: 1 ASSIGN source, 2 MIDI channel, 3 TEMPO input mode, 4 clock input PPQN, 5 clock output PPQN,
6 save mode, 7 reserved, 8 on / off settings (follow MIDI clock, follow MIDI start / stop, clock output
swing, accent out CV only, TEMPO input range, delay pattern change, load saved timing). Pages are
chosen with the arrows, values with the step buttons (SHIFT for 9-16); settings survive power-off.
Defaults: ASSIGN clock, channel 1, TEMPO single clock advance, 4 PPQN in and out, follow MIDI clock
and start / stop on, clock output swing on, TEMPO range -5...+5 V, accent out CV only off, load saved
timing on. **verified** (Mother-32 manual, pp.58-61). The twin's Setup panel covers pages 1, 3, 4, 6
and page 8 options 4-7 (see "Simplified").

## MIDI (5-pin DIN input only)

- Channel 1 by default. Note on: 1 V/oct KB CV, note 0 = -5 V, 120 = +5 V, 121-127 repeat 109-115;
  a gate for the note's duration. While running, notes transpose the pattern (KB and STEP mode); in
  Record and step edit they write the note. **verified** (Mother-32 manual, p.56).
- Pitch bend adds to the KB CV, +/-1 octave by default, 0-12 semitones by RPN 0 (CC 101 / 100 = 0,
  CC 6). CC 5 portamento time, CC 65 portamento on / off, CC 64 sustain, CC 1 / 2 / 4 / 7 for
  ASSIGN; program change 1-64 picks the pattern, 71-86 the ASSIGN source. **verified** (Mother-32
  manual, p.57).
- MIDI clock: Tempo LED green, TEMPO becomes the divider; after the clock stops, RUN / STOP restarts
  the internal clock. Start plays from step 1, Stop stops on the last active step, Continue starts
  on the next. **verified** (Mother-32 manual, p.57). In the studio, ▶ is Start and ■ is Stop.

## Presets from the manual

The nine patch sheets (Mother-32 manual, pp.64-66) and the default panel (p.9) are recreated as
presets under our own names; each sheet's knob angles were read from the drawing and converted
through this twin's knob laws. The sheets show no pattern, so every demo pattern is ours. VOLUME
is set on every preset so it plays at about -18 LUFS (scripts/audio-qa.cjs), not as drawn.

| Sheet (page) | Preset | Changes from the drawing |
|---|---|---|
| default panel (p.9) | Init / Basic patch | - |
| Octave Bounce Back (p.64) | Lead / Gate pitch jump | - |
| Noise Transient (p.64) | Drums / Noise-attack pluck | DECAY a little longer (the drawn 43 ms is very short in this twin's decay law) |
| Metal Snare (p.64) | Drums / Noise snare | CUTOFF two octaves higher and the pattern and octave two lower (the same sound, noise only, playable from the keys); DECAY longer |
| Sequencer Bass (p.65) | Bass / Pulse sequencer bass | - |
| Resonant High Pass Filter (p.65) | FX / High-pass feedback | - |
| 8-Bit Percussion (p.65) | Drone / Bit-crunch bed | VCF MOD AMOUNT a little lower so the hits sit on the bed |
| '80s Toms (p.66) | Drums / Electronic toms | - |
| Short Brass (p.66) | Brass / Saw and pulse stabs | DECAY longer, CUTOFF brighter and a smaller pulse-width sweep: the drawn settings give a 50 ms blip whose pulse-width step through the AC-coupled mixer peaks 10 dB above the note |
| Filter Kick (p.66) | Drums / Feedback filter kick | - |

The remaining presets are our own designs or follow Moog's first-edition patch examples and the
Sweetwater / Moog patch-sheet series; their descriptions say which.

## Model choices (guesses to check against hardware)

| Quantity | Twin value |
|---|---|
| Pitch | FREQUENCY centre + KB 0 V = C4 (261.6 Hz), which matches the calibration procedure (Mother-32 manual, p.62); keyboard octave n (LED n) starts at C(n-1): octave 4 low C = C3 = -1 V, octave 5 low C = 0 V |
| EG | attack 1.25 ms - 3 s and decay 1.25 ms - 7 s on log knobs (SOS); RC attack toward 1.5 x the peak; exponential fall reaching -40 dB at the DECAY time; peak +7.5 V; retriggers from the current level |
| GLIDE | 0 - 2 s on an exponential knob; RC slide reaching 95 % at the knob's time |
| VCO MOD AMOUNT | audio taper; full scale 0.5 oct per volt of source (EG 3.75 octaves, LFO +/-2.5 octaves), or 9.6 % pulse width per volt (LFO +/-48 %) |
| VCF MOD AMOUNT | audio taper; full scale 0.9 oct per volt (EG 6.75 octaves, LFO +/-4.5 octaves) |
| LIN FM | +5 V doubles the frequency, -5 V stops it (not through-zero) |
| Accent | +1 octave of cutoff and +2.5 dB at the VCA, eased in over about 5 ms |
| Ladder | 2x-oversampled transistor core with per-stage tanh; feedback 5.4 x RESONANCE, so self-oscillation starts near 75 % (3 o'clock) and reaches about 4.5 V; a little make-up gain for the Moog bass loss |
| VCF RES. jack | reaches the feedback through a 1.5 ms slew, as through the VCA of a real feedback path, so stepped CVs cannot click the level |
| HI PASS | the input minus the ladder low-pass, with RESONANCE fading the subtraction (the bass returns) and the feedback held below oscillation (a gentle peak). This makes the manual's VCF -> EXT. AUDIO trick self-oscillate near MIX 80 %, as described (Mother-32 manual, p.14) |
| Mixer | linear crossfade; AC coupled at 4 Hz; EXT. AUDIO soft-limits above about 4.5 V |
| VCA | EG mode: EG / 7.5 V plus VCA CV / 7.5 V (+8 V is just past full); ON mode: 1 + VCA CV / 5 V; soft clipping above full gain (Moog support: distortion above +5 V) |
| Main output | the VCA jack (1.0 = 5 V) x 1.5 to the studio, DC blocked at 6 Hz; the jacks stay DC coupled |
| ASSIGN clock | one pulse per step, high for the first half of the step (swung with the steps) |
| Swing | the on-beat takes SWING AMOUNT of every two swing intervals, as a time warp of the clock |
| Pendulum | the end steps are not repeated at the turn |
| Key priority | last note, with the previous held note returning on release |
| Analog drift | about 2 cents of slow random wander |
| GATE jack | OR-ed with the keyboard / sequencer gate |
| Pitch bend | +/-12 semitones by default, 0-12 by RPN 0 (both from the manual, p.57) |

## Simplified

- **Toggle legends**: the panel prints each switch's two positions above and below the lever; the
  twin's switch element shows them beside it, so each lever sits 2-4 mm right of its printed
  position (the positions above are the printed ones).
- **Type and logo**: Helvetica and Roboto Condensed stand in for the panel's typefaces; the maker's
  logo is set as text, not drawn.
- **Setup mode** is the SETUP panel (with the clock division, swing interval and direction) instead
  of the SHIFT + RESET + SET END + STEP 8 gesture and its LED pages. Not modelled: page 2 (MIDI
  channel: the studio routes MIDI), page 5 (clock output PPQN), page 8 options 1-3 (follow MIDI clock,
  follow start / stop, clock output swing: sync is the studio's per-instrument setting).
- **LED animations**: the save, cancel and initialize sweeps (Mother-32 manual, p.38, p.39) are
  readout messages instead.
- **MIDI**: velocity 96 or more does not turn on accents while recording (Mother-32 manual, p.57);
  no firmware updates over MIDI.
- **One pointer**: SHIFT latches when tapped, so live accent, mute and ratchet stay on until SHIFT is
  tapped again; held (on a touch screen) they end on release, as on the hardware.
- **Circuits** are DSP models (band-limited VCO, ladder, RC envelopes) with a slow 2-cent drift; no
  component tolerance, temperature drift or calibration trimmers.
- **HI PASS** is gentler than the 24 dB/oct the manual prints (Mother-32 manual, p.14); see "Model
  choices".
- **Memory**: the 64 patterns and the Setup values are saved with the studio project per instrument
  instance, not in the instrument.
- **Rear panel**: not drawn; the output feeds the studio mixer at studio level.
- **Teaching aids** not on the hardware: the readout above the keys (mode, step, what the keys do),
  the value boxes under the knobs and the SETUP panel.
