# Moog DFAM - hardware reference for the digital twin

Ground truth used to build `devices/dfam`. Every control, LED and patch point is listed with its
printed label, section, position, cap, range and (for jacks) its normal, with the manual page it
comes from and a confidence level.

- **verified**: stated in the DFAM manual (cited by page) or in Moog support material, or two
  independent sources agree.
- **likely**: one good secondary source, or a direct consequence of verified facts.
- **guess**: not documented anywhere we could reach. These values were chosen to match the
  documented behaviour, and are listed again in "Model choices" so they can be checked against a unit.

Page numbers are the manual's printed page numbers, which are also its PDF page numbers.

## Sources

- **DFAM manual**: Moog *DFAM Owner's Manual with Patch Sheets* (2017, 44 pages), read in full from
  the copy the user provided (kept out of the repository). Cited "(DFAM manual, p.N)". Overview and
  panel drawing p.7, walkthrough pp.8-12, controls pp.13-23, patch bay pp.24-29, syncing pp.30-31,
  Eurorack use p.32, patch sheets pp.33-37, specifications p.40.
- **Electronicus**: *DFAM Electronicus Patchbook* (12 pages, user-provided): DFAM + Mother-32
  patches. Cited "(Electronicus patchbook, p.N)".
- **MS**: Moog support FAQs "How do I sync DFAM & Mother-32?" and "Can I change DFAM's note length?",
  and Moog's sync sheet `Syncing_DFAM_With_Mother_32.pdf`, read through search excerpts.
- **MSC**: Moog support FAQ "How do I clock external gear to my DFAM?": the TRIGGER output pulses on
  every step, whatever the PITCH and VELOCITY knobs say.
- **V**: VoltPages module sheet `src/data/modules/moog-music--dfam.json`
  (github.com/ogabrielluiz/voltpages), compiled from the manual and MS.
- **SOS**: Sound On Sound, *Moog DFAM* review.
- **K / LMS**: aftermarket knob kits (19-piece kits for the 16 sequencer + 3 mixer controls, 33-piece
  kits for all) and the LoveMySwitches knob-upgrade guide.
- **F**: forum reports (Moog forum, ModWiggler, Elektronauts, Gearspace), through search excerpts.

## Panel

| Fact | Twin | Source | Confidence |
|---|---|---|---|
| A 60 HP Eurorack module in a desktop case with wooden end cheeks; 12.57" x 4.21" x 5.24" (W x D x H, 319 x 107 x 133 mm), 3.5 lb | faceplate 304.8 x 128.5 mm (Eurorack 3U x 60 HP) with 7.25 mm of wood each side, 319.3 mm in all | (DFAM manual, p.32, p.40) | **verified** |
| Positions are measured from the panel drawing at 4.16 drawing px per mm, the scale at which both the 60 HP width and the 122.5 mm Eurorack screw pitch fit; re-checked at full resolution for this pass (within about 0.5 mm) | millimetres from the faceplate's top-left corner, at each control's centre; `layout.ts` uses them as measured | (DFAM manual, p.7) | **verified** (as drawn: the drawing is not dimensioned) |
| Two rows of large knobs; left to right the VCO EG and the two VCOs, the mixer column, the VCF and the VCA; the transport and the 8-step sequencer below them; the 24-jack patch bay at the right under an IN / OUT header | knob rows at y 23.4 and 55.8; mixer column x 131.2; steps at x = 79.9 + 23.94 x (n - 1); patch bay columns x 267.6 / 281.2 / 294.8 | (DFAM manual, p.7) | **verified** |
| Eight black M3 screws hold the panel | screws at x 13.2 / 114.5 / 190.8 / 292.1, y 3.0 / 125.5 | (DFAM manual, p.32, p.7) | **verified** |
| Bottom rail: DFAM, DRUMMER FROM ANOTHER MOTHER, SEMI-MODULAR ANALOG PERCUSSION SYNTHESIZER at the left, the moog wordmark in the middle | the texts at x 31-89 and the name at x 152, set in plain type (no logo artwork) | (DFAM manual, p.7) | **verified** |
| 33 controls: 14 with knob caps (the 13 main knobs and TEMPO); the 3 mixer and 16 sequencer controls drawn as small plain discs - slim black shafts ("stalks") without caps | caps 17.2 mm, silver; stalks 8.5 mm black shafts with a white line, wider than the hardware's ~6-7 mm so they stay touchable | (DFAM manual, p.7); SOS ("its 16 knobless stalks rate as poor in comparison to the other controls"); K, LMS | style **verified**; cap colour **not verified** (the drawing is line art); stalk size a **guess** |
| Legends are printed white on black, one line above each control | one-line legends above each control | (DFAM manual, p.7) | **verified** |
| Printed scales: rings around VCO 1 FREQUENCY, VCO 2 FREQUENCY and TEMPO; 20Hz, 200Hz, 2kHz and 20kHz around CUTOFF; (-) and (+) under the three EG AMOUNT knobs | drawn in our own style | (DFAM manual, p.7) | **verified** |
| Inputs have standard lettering, outputs reverse lettering | outputs in white boxes with black text | (DFAM manual, p.24, p.7) | **verified** |
| Knob travel: the manual's clock positions start at 7 o'clock for the minimum, so the knobs turn about 300 degrees (to 5 o'clock) | values map by fraction of travel; the twin's knobs turn 270 degrees on screen, so the manual's 3 o'clock (80 % of travel) shows at about 2:40 | (DFAM manual, p.15, p.19, p.21) | **likely** |

## Controls

Positions are the twin's coordinates in mm (x, y), measured from the panel drawing (DFAM manual,
p.7). Ranges are those of the hardware. "Twin" gives the value units used in `spec.ts`.

### VCO EG and VCOs

| Printed label | Section | Position | Cap | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| VCO DECAY | VCO EG | row 1, far left (18.9, 23.4) | large | decay of the pitch envelope; no effect while both VCO EG AMOUNT knobs are at noon; minimum is an almost instant snap, 9-10 o'clock a stick hit, noon and up slow "booms" | 10-10000 ms, log; default 100 ms | (DFAM manual, p.15); V | behaviour **verified**; range **likely** (the manual gives 10 ms - 10 s for the VCF EG only, p.19) |
| SEQ PITCH MOD | VCO EG | row 1, between VCO DECAY and VCO 1 EG AMOUNT (39.9, 23.7) | 3-way toggle | UP: VCO 1&2 · CENTRE: OFF (the PITCH jack still carries the steps) · DOWN: VCO 2 | 0/1/2; default OFF | (DFAM manual, p.15; legends p.7) | **verified**; default OFF **likely** (the walkthrough moves it to VCO 1&2 after starting, p.9) |
| VCO 1 EG AMOUNT | VCO EG | row 1 (61.7, 23.4); (-)/(+) printed below | large | bipolar, noon = none; right of noon the pitch jumps up and falls back, left of noon it dips and rises | -100...+100 % | (DFAM manual, p.16; p.7) | **verified** (sweep in octaves: guess) |
| VCO 1 FREQUENCY | VCO 1 | row 1 (90.7, 23.4), inside a printed scale ring | large | ten-octave range; noon matches the centre of the PITCH knobs | -5...+5 oct, noon = C3 (131 Hz); the readout shows Hz | (DFAM manual, p.13; ring p.7) | range **verified**; noon pitch **guess** (the walkthrough's deep bass between 10 and 11 o'clock, p.8, is 33-65 Hz in the twin) |
| VCO 1 WAVE | VCO 1 | (112.3, 23.7) | 2-way toggle | UP: square · DOWN: triangle | SQR/TRI; default TRI | (DFAM manual, p.13; symbols p.7) | **verified**; default TRI **likely** (the walkthrough switches it to square, p.10) |
| 1→2 FM AMOUNT | VCOs | row 2, far left (18.9, 55.8) | large | how much VCO 1 modulates VCO 2's frequency (linear FM); clearest with HARD SYNC off; the 1→2 FM AMT jack adds to it | 0-100 % | (DFAM manual, p.14, p.11, p.28) | **verified** (depth as a modulation index: guess) |
| HARD SYNC | VCOs | row 2, between the knobs (40.3, 56.2) | 2-way toggle | UP: ON · DOWN: OFF; ON resets VCO 2 to VCO 1's phase, so VCO 2 FREQUENCY changes the timbre; VCO 2 can go nearly silent when tuned below VCO 1, especially on square | ON/OFF; default OFF | (DFAM manual, p.14, p.10; legends p.7) | **verified** |
| VCO 2 EG AMOUNT | VCO EG | row 2 (61.7, 55.8); (-)/(+) printed below | large | bipolar like VCO 1 | -100...+100 % | (DFAM manual, p.16; p.7) | **verified** |
| VCO 2 FREQUENCY | VCO 2 | row 2 (90.7, 55.8), inside a printed scale ring | large | ten octaves; with HARD SYNC on it sets the timbre | -5...+5 oct | (DFAM manual, p.13, p.14; p.7) | **verified** |
| VCO 2 WAVE | VCO 2 | (112.3, 56.0) | 2-way toggle | UP: square · DOWN: triangle | SQR/TRI; default TRI | (DFAM manual, p.13; p.7) | **verified** |

### Mixer

| Printed label | Section | Position | Cap | Range | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| VCO 1 LEVEL | Mixer | top of the mixer column (131.2, 18.0), legend above | stalk | off - full; square sounds louder than triangle; high mixer levels sound more aggressive and clip | 0-100 %; default 75 % | (DFAM manual, p.16; p.7); K | **verified** |
| NOISE / EXT LEVEL | Mixer | middle (131.2, 39.8) | stalk | white noise, or the EXT AUDIO signal when patched; the NOISE LEVEL jack adds to it | 0-100 %; default 0 | (DFAM manual, p.17, p.26) | **verified** |
| VCO 2 LEVEL | Mixer | bottom (131.2, 61.5) | stalk | off - full | 0-100 %; default 0 | (DFAM manual, p.17; the walkthrough turns it up, p.10); K | **verified** |

### VCF

| Printed label | Section | Position | Cap | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| VCF (HP / LP) | VCF | left of CUTOFF (151.5, 23.8) | 2-way toggle | UP: HP · DOWN: LP; a 4-pole ladder, 24 dB/oct | HP/LP; default LP | (DFAM manual, p.17, p.18, p.40; legends p.7) | **verified** |
| CUTOFF | VCF | row 1 (173.8, 23.4); 20Hz, 200Hz, 2kHz, 20kHz printed around it | large | 20 Hz - 20 kHz | 20-20000 Hz, log; default 2 kHz | (DFAM manual, p.18; marks p.7) | **verified** |
| RESONANCE | VCF | row 1 (202.8, 23.4) | large | feedback: a peak at the cutoff, and the bass may thin; in LP it self-oscillates (a sine) above 3 o'clock; HP is scaled differently: at maximum it self-oscillates from a CUTOFF of about 1 kHz up | 0-100 % | (DFAM manual, p.18) | **verified** |
| VCF DECAY | VCF EG | row 2 (158.0, 55.8) | large | 10 ms - 10 s; the step velocity also affects it | 10-10000 ms, log; default 300 ms | (DFAM manual, p.19) | **verified** |
| VCF EG AMOUNT | VCF EG | row 2 (187.0, 55.8); (-)/(+) printed below | large | bipolar, noon = none; + raises and - lowers the cutoff, in either mode | -100...+100 % | (DFAM manual, pp.19-20; p.7) | **verified** (octaves: guess) |
| NOISE / VCF MOD | VCF | row 2 (216.1, 55.8) | large | how much the noise shakes the cutoff (dirty, lo-fi); with a cable in VCF MOD it sets that signal's depth instead, fully clockwise for full CV control | 0-100 % | (DFAM manual, p.20, p.27) | **verified** |

### VCA

| Printed label | Section | Position | Cap | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| VCA EG | VCA | row 1 (225.3, 24.3) | 2-way toggle | UP: FAST (1 ms attack) · DOWN: SLOW (100 ms attack) | FAST/SLOW; default FAST | (DFAM manual, p.20; legends p.7) | **verified** |
| VOLUME | VCA | row 1, far right (247.5, 23.4) | large | final output level: the VCA jack and the rear AUDIO OUT | 0-100 %; default 75 % | (DFAM manual, p.21, p.25, p.6) | **verified** |
| VCA DECAY | VCA | row 2, far right (247.5, 55.8) | large | decay of the VCA EG: the minimum gives almost no sound, 9 o'clock short blips, 10 o'clock tight thumps, 11 o'clock a ringing note, noon a long ring, and past noon the hits wash together | 10-10000 ms, log; default 300 ms | (DFAM manual, p.21, p.12) | behaviour **verified**; range and taper **likely** (see Model choices) |

### Sequencer and transport

| Printed label | Section | Position | Cap | Range | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| TRIGGER | Transport | (18.9, 87.0), legend above | push button | plays the current step (the lit one) without advancing; the manual describes it with the sequencer stopped | momentary | (DFAM manual, p.23; p.7) | **verified** |
| TEMPO | Transport | (46.4, 87.1), inside a printed scale ring | large | 0.7 Hz - 700 Hz, continuously variable: about 10 - 10,000 BPM if each step is a 16th note; ignored while ADV / CLOCK is patched | 10.5-10500 BPM (16th-note steps), log; default 120; readout on hover or touch only, because RUN / STOP and ADVANCE are printed just under the ring | (DFAM manual, p.23, p.29, p.40; p.7) | **verified** |
| RUN / STOP | Transport | (36.9, 107.9), legend at (36.0, 100.6) | push button | starts the sequencer from the current step at the current TEMPO, and stops it when it is running | toggle | (DFAM manual, p.22; p.7) | **verified** |
| ADVANCE | Transport | (55.9, 107.9), legend at (55.9, 100.6) | push button | with the sequencer stopped, moves to the next step without playing the steps it passes | momentary | (DFAM manual, p.23; p.7) | **verified** |
| PITCH 1-8 | Sequencer | top row of eight at (79.9 + 23.94 x (n - 1), 84.3); "PITCH" printed at the left | stalk | about +-5 V, roughly ten octaves; right of centre adds to VCO FREQUENCY, left subtracts; reaches the VCOs only with SEQ PITCH MOD on VCO 1&2 or VCO 2; always on the PITCH jack | -5...+5 V, shown in semitones (1/12 V detents) | (DFAM manual, p.22, p.15; p.7) | **verified** (detents: twin choice) |
| VELOCITY 1-8 | Sequencer | bottom row (y 108.0); "VELOCITY" printed at the left | stalk | 0-5 V; sets the level of all three EGs, and a higher velocity gives a slightly longer decay; the minimum is silent | 0-100 %; default 100 % | (DFAM manual, p.22; p.7) | **verified** |
| 1 ... 8 | Sequencer | step numbers above the PITCH row (y 74.7) | printed | - | - | (DFAM manual, p.7) | **verified** |

### LEDs

| LED | Position | Behaviour | Source | Confidence |
|---|---|---|---|---|
| RUN / STOP | (28.5, 100.6), left of the RUN / STOP legend | red, lit while the sequencer runs; in the twin also while the RUN / STOP jack's gate holds it running | (DFAM manual, p.22; p.7) | **verified**; the jack case **likely** |
| Step 1-8 | (x of each step, 96.0), between the PITCH and VELOCITY rows | red, the current step, also while stopped (TRIGGER plays the step "indicated by the LED"); the twin shows it dimmer while stopped and flashes it on each hit | (DFAM manual, p.22, p.23; p.7) | **verified**; dim and flash: twin choice |

## Patch bay (24 jacks)

24 x 3.5 mm jacks: 15 inputs and 9 outputs (DFAM manual, p.24, p.40). Three columns x eight rows:
rows 1-6 read IN | IN | OUT, row 7 is three inputs and row 8 three outputs (DFAM manual, p.7).
Positions: columns at x 267.6 / 281.2 / 294.8 mm, rows at y = 16.5 + 13.46 x (row - 1) mm, a
13.6 x 13.5 mm grid (DFAM manual, p.7). Twin signal convention: 1.0 = 5 V.

| Row/col | Label | Dir | Range | Normal / behaviour | Source | Confidence |
|---|---|---|---|---|---|---|
| 1/1 | TRIGGER | in | 0 to +5 V pulse or gate (+10 V tolerant) | **normalled to the sequencer clock**, and passed on to the three EGs and the TRIGGER output; fires all three EGs at the current step's velocity without advancing; a cable replaces the clock | (DFAM manual, p.24) | **verified** |
| 1/2 | VCA CV | in | 0 to +8 V | **summed** with the VCA EG; can clip the VCA | (DFAM manual, p.24) | **verified** |
| 1/3 | VCA | out | -5 to +5 V audio | the main audio, after VOLUME | (DFAM manual, p.25) | **verified** |
| 2/1 | VELOCITY | in | 0 to +5 V | **normalled to VELOCITY 1-8**; sets the EGs' maximum level; a cable replaces the knobs | (DFAM manual, p.25) | **verified** |
| 2/2 | VCA DECAY | in | -5 to +5 V | summed with the knob (the knob at noon gives the widest range); + = longer | (DFAM manual, p.25) | **verified** (+1 V = 2x time: guess) |
| 2/3 | VCA EG | out | 0 to +8 V | the VCA envelope, shaped by VELOCITY, VCA DECAY and FAST/SLOW | (DFAM manual, p.25) | **verified** |
| 3/1 | EXT AUDIO | in | 10 V p-p, unity gain, 3.5 mm TS | **normalled to the noise** at the mixer: a cable replaces the noise, and NOISE / EXT LEVEL sets its level | (DFAM manual, p.25, p.17) | **verified** |
| 3/2 | VCF DECAY | in | -5 to +5 V | summed with the knob | (DFAM manual, p.26) | **verified** |
| 3/3 | VCF EG | out | 0 to +8 V | the VCF envelope, shaped by VELOCITY and VCF DECAY | (DFAM manual, p.26) | **verified** |
| 4/1 | NOISE LEVEL | in | 0 to +8 V | added to the NOISE / EXT LEVEL knob, for the noise or EXT AUDIO alike; can clip the noise VCA | (DFAM manual, p.26) | **verified** |
| 4/2 | VCO DECAY | in | -5 to +5 V | summed with the knob | (DFAM manual, p.26) | **verified** |
| 4/3 | VCO EG | out | 0 to +8 V | the VCO envelope, shaped by VELOCITY and VCO DECAY | (DFAM manual, p.27) | **verified** |
| 5/1 | VCF MOD | in | -5 to +5 V | **normalled to the noise** through the NOISE / VCF MOD knob: a cable replaces the noise and the knob still sets the depth; the only direct CV path to the cutoff | (DFAM manual, p.27, p.20) | **verified** |
| 5/2 | VCO 1 CV | in | -5 to +5 V, 1 V/oct | summed with VCO 1 FREQUENCY, VCO 1 EG AMOUNT and the PITCH knobs (with SEQ PITCH MOD on VCO 1&2) | (DFAM manual, p.27) | **verified** |
| 5/3 | VCO 1 | out | -5 to +5 V | VCO 1, selected wave | (DFAM manual, p.27) | **verified** |
| 6/1 | 1→2 FM AMT | in | 0 to +8 V | summed with the 1→2 FM AMOUNT knob (linear FM) | (DFAM manual, p.28) | **verified** |
| 6/2 | VCO 2 CV | in | -5 to +5 V, 1 V/oct | summed with VCO 2 FREQUENCY, VCO 2 EG AMOUNT and the PITCH knobs (with SEQ PITCH MOD on VCO 1&2 or VCO 2) | (DFAM manual, p.28) | **verified** |
| 6/3 | VCO 2 | out | -5 to +5 V | VCO 2, selected wave | (DFAM manual, p.28) | **verified** |
| 7/1 | TEMPO | in | -5 to +5 V | 1 V/oct on the clock oscillator, summed with the TEMPO knob, up to audio rate | (DFAM manual, p.28) | **verified** |
| 7/2 | RUN / STOP | in | 0 to +5 V gate (+10 V tolerant) | the sequencer plays from where it is while the gate is high and stops there at 0 V; a clock here steps the pattern the way repeated RUN / STOP presses would, without syncing the internal clock | (DFAM manual, p.29) | **verified** |
| 7/3 | ADV / CLOCK | in | 0 to +5 V clock (+10 V tolerant) | **normalled to the internal clock**: patched, each rising edge advances one step and TEMPO is ignored; slowly changing signals may be ignored. Press RUN / STOP on the DFAM first, then start the clock | (DFAM manual, p.29, pp.30-31); MS | **verified**; pulses ignored while stopped **likely** (a Moog-forum reply says it advances only in run mode) |
| 8/1 | TRIGGER | out | 0 to +5 V, about 1 ms | a pulse on every clocked step, sent to the EGs and this jack together, whatever the PITCH and VELOCITY knobs say; a cable in TRIGGER IN drives it too | (DFAM manual, p.29, p.24); MSC | **verified**; the TRIGGER button also sends it: **guess** |
| 8/2 | VELOCITY | out | 0 to +5 V | the current step's VELOCITY knob | (DFAM manual, p.29, p.22) | **verified** |
| 8/3 | PITCH | out | -5 to +5 V | the current step's PITCH knob, live even with SEQ PITCH MOD on OFF | (DFAM manual, p.29, p.15) | **verified** |

## Behaviour notes

| Behaviour | Twin | Source | Confidence |
|---|---|---|---|
| **Envelopes.** Three attack/decay EGs with voltage-controlled decay. Attack is 1 ms for all three, except the VCA EG on SLOW (100 ms). Velocity sets each EG's amplitude and lengthens its decay a little | an RC attack, then an exponential decay that falls 60 dB over the DECAY time; velocity also scales the decay by 2^(0.75 x (v - 1)) | (DFAM manual, p.7, p.20, p.22, p.40) | behaviour **verified**; curves **guess** |
| **Starting.** RUN / STOP starts from the current step at the current tempo | the clock fires at once and the sequencer advances before it plays, as an ADV / CLOCK pulse does, so a sequencer parked on step 8 starts on step 1. That is also what lets a follower clocked from a leader's TRIGGER output play the same steps as the leader | (DFAM manual, p.22, p.29, p.30); MS (park on step 8 with ADVANCE) | **likely** (which step sounds first after RUN is not stated outright) |
| **External clock.** Patch the clock into ADV / CLOCK, press RUN / STOP on the DFAM first, then start the clock: each rising edge plays one step and TEMPO is ignored. Two DFAMs: the leader's TRIGGER out into the follower's ADV / CLOCK. A Mother-32: its ASSIGN output, set to clock, into ADV / CLOCK; its clock divisions run the DFAM at a division of the master tempo | the Studio Clock plays the leader's role (CLOCK into ADV / CLOCK, CLOCK DIV for the divisions); the studio's ▶ presses RUN / STOP on clocked instruments first | (DFAM manual, p.29, p.30, p.31) | **verified** |
| **RUN / STOP jack.** The sequencer plays from its current location while the gate is high, and stops there at 0 V | follows the manual; SOS and forum users report that starting this way does not fire the envelopes - that quirk is not modelled | (DFAM manual, p.29); SOS, F | **verified** (the quirk: not modelled) |
| **Tempo from the sequencer.** PITCH or VELOCITY patched into TEMPO makes the step knobs set each step's length: a higher knob gives a shorter step | sample-accurate, up to audio rate | (DFAM manual, p.23, p.36); MS | **verified** |
| **Pitch out of range.** FREQUENCY, PITCH and EG AMOUNT together can push the VCOs out of hearing; the manual's way back: check the patch bay, FREQUENCY to noon, EG AMOUNT to noon, SEQ PITCH MOD to OFF | the same; the VCOs are clamped at 0.45 x the sample rate | (DFAM manual, p.13) | **verified** |

## Model choices (guesses to check against hardware)

| Quantity | Twin value | What the manual says |
|---|---|---|
| VCO FREQUENCY at noon | C3 (130.8 Hz) | no frequency: noon equals the centre of the PITCH knobs, and the walkthrough's deep bass sits between 10 and 11 o'clock, 33-65 Hz here (DFAM manual, p.13, p.8) |
| VCO EG AMOUNT full scale | +-5 octaves at full velocity (EG 8 V) | bigger jumps or dips, no figure (DFAM manual, p.16) |
| VCF EG AMOUNT full scale | +-6 octaves | no figure (DFAM manual, pp.19-20) |
| NOISE / VCF MOD full scale | 1 V/oct of the noise (+-5 V) or of the VCF MOD jack | the VCF MOD jack takes +-5 V; no depth figure (DFAM manual, p.27, p.20) |
| 1→2 FM AMOUNT full scale | index 5 (deviation 5 x VCO 2's frequency), not through-zero | linear FM, no depth figure (DFAM manual, p.28, p.14) |
| LP self-oscillation | from 81 % of travel (silent at 80 %, a steady sine from 81 %) | above 3 o'clock, which is 80 % of a 300 degree travel (DFAM manual, p.18) |
| HP self-oscillation | feedback rolls off below ~500 Hz: at full RESONANCE it oscillates from a CUTOFF of ~1.0 kHz up, at 90 % from ~1.4 kHz | at maximum, from about 1 kHz (DFAM manual, p.18) |
| Decay CV scaling | +1 V doubles the decay time | +-5 V summed with the knob, no scale given (DFAM manual, pp.25-26) |
| VCA DECAY taper | log, 10 ms - 10 s, noon = 316 ms | the clock-position descriptions suggest longer times around noon than this taper gives; the VCO and VCF descriptions fit it (DFAM manual, p.21, p.15, p.19) |
| Mixer taper | between level^2 and level^3 | higher levels are hotter and clip more; no taper given (DFAM manual, p.16) |
| ADV / CLOCK while stopped | pulses are ignored | press RUN / STOP first; the stopped case is not stated (DFAM manual, pp.30-31) |
| ADV / CLOCK slow edges | any rise through 1.5 V counts, however slow | slowly changing signals may be ignored (DFAM manual, p.29) |
| TRIGGER button and TRIGGER out | the button also sends the TRIGGER out pulse | the clock and the TRIGGER jack do; the button is not mentioned (DFAM manual, p.24, p.29) |
| PITCH 1-8 knob feel | semitone detents (1/12 V), so steps can be tuned on a touch screen; presets and cables may still use any voltage | continuous, about +-5 V (DFAM manual, p.22) |
| Default VELOCITY 1-8 | 100 % | the default patch varies them: the walkthrough's first VELOCITY step turns them all to maximum (DFAM manual, p.9) |
| Analog drift | random wander toward +-3 cents per VCO (about +-1 cent over 250 ms) | the oscillators need a few minutes to warm up, and units differ slightly (DFAM manual, p.6, p.33) |
| Main output | AC-coupled (5 Hz), then an output rail: unity up to 0.7 (3.5 V), a soft knee above it, never reaching 1.0 (5 V, 0 dBFS); everything-up patches peak at -0.2 dBFS, typical patches never reach the knee | VCA out is -5 to +5 V, and hot mixer levels clip (DFAM manual, p.25, p.16) |

## Presets

The manual's PRESETS & PATCH SHEETS section has ten patch sheets, followed by blank sheets
(DFAM manual, pp.33-39). Each is recreated under a descriptive name, and the preset's description
credits the sheet and its page (docs/research/COPYRIGHT-RULES.md).

| Patch sheet | Page | Twin preset | How it was made |
|---|---|---|---|
| Music Box | (DFAM manual, p.33) | Metal / FM chime melody | knob positions read from the sheet |
| Quick Hats | (DFAM manual, p.33) | Hats / Hat lengths per step | knob positions read from the sheet |
| FM Toys | (DFAM manual, p.34) | Metal / Clanky FM sequence | recreated from the sheet's notes |
| Sequenced Bass | (DFAM manual, p.34) | Bass / Soft unison bass | from the notes, with the SLOW VCA EG glide tip (p.20) |
| Kick / Snare / FM Osc 2 | (DFAM manual, p.35) | Loop / Kick, snare and FM | from the notes |
| Filter As An Oscillator | (DFAM manual, p.35) | Toms / Ringing filter toms | from the notes, with the RESONANCE tip (p.18) |
| Insane Toms | (DFAM manual, p.36) | Toms / Rolling toms | from the notes |
| Swing Time | (DFAM manual, p.36) | Loop / Shuffle | from the notes, with the TEMPO tip (p.23) |
| Sequencer As An Oscillator | (DFAM manual, p.37) | FX / Audio-rate sequencer | from the notes |
| Talking Drum | (DFAM manual, p.37) | Toms / Vowel drum | from the notes |
| the "Exploring the DFAM" walkthrough | (DFAM manual, pp.8-9) | Kick / Analog kick | the walkthrough's knob settings |

The sheets on pp.34-37 and the default patch on p.8 were not legible enough to read knob positions
from, so those presets follow the notes. The Electronicus patches pair the DFAM with a Mother-32
(Electronicus patchbook, pp.4-10); no preset here follows them or credits them. The other 28 presets
are well-known community techniques; with Init there are 40 in `presets.ts`.

**Levels.** Each preset's audition (its pattern from step 1 at its own TEMPO, the excitation that
`scripts/audio-qa.cjs` uses) is set for the studio target of -18 LUFS at the instrument output (FX
4 LU lower), with true peaks at or below -2 dBTP in every one of 12 offline renders - the noise and
the oscillators' start phase differ between renders, so a preset's true peak varies from run to run.
The noisy hits (snares, clap, rimshot, hats, noise loops) are peak-limited: their loudness comes from
a longer VCA DECAY, not from VOLUME. Re-measure after editing a preset (devices/dfam/REVIEW.md).
