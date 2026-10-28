# Moog Mother-32 - hardware reference for the digital twin

Ground truth used to build `devices/mother32`. Every control, LED, button and patch point is listed
with its printed label, section, position, cap, range and (for jacks) its normal and signal level,
plus a source and a confidence level.

- **verified**: quoted from the Moog manual, a Moog support article or a Moog patch sheet, or two
  independent sources agree.
- **likely**: one good secondary source, or a direct consequence of verified facts.
- **guess**: not documented anywhere we could reach. Chosen by ear to match the documented
  behaviour, and listed again in "Model choices" so they can be checked against a unit.

`docs/reference/mother32/` does not exist, so there were no photos to read. The network blocks the
manufacturer's site, the manual mirrors and image hosts, so manual text comes from search-engine
excerpts and from two open-source projects whose authors read the manual and cite its printed pages.

## Sources

| Id | Source |
|----|--------|
| M2 | Moog *Mother-32 User Manual, Version 2* (73 pp., documents firmware 2.0), as cited page by page in the open-source **patchscore** project (`github.com/miclip/patchscore`, `lib/devices/moog-mother-32/index.ts` and `panel.ts`). Its author rendered the PDF and quotes printed pages: p.11 VCO, p.12 VCO MOD, p.13 LFO, p.14-15 VCF / VCF MOD, p.16 EG / VCA, p.19-26 sequencer, pp.46-56 patchbay, p.59 Setup, pp.64-66 patch sheets, p.68 blank patch sheet (panel drawing), p.70 specifications |
| PD | The panel drawing on M2 p.68 **measured** by patchscore at 200 dpi (control centroids, 14 knobs at one diameter, 16.2-16.4 mm). Coordinates below are those measurements moved into the 304.8 x 128.5 mm faceplate (x - 7.25 mm cheek, y - 2.25 mm case lip) |
| M1 | *Mother-32 User Manual* (2015, firmware 1.x) through search excerpts (manualslib / manualmachine / manuals.online indexes): KB-mode and step-mode tutorials, Presets p.53 |
| FW | *Mother-32 Manual Addendum, Firmware Update V2.0* (search excerpts): 24 clock divisions, save modes |
| PE | Moog *Mother-32 Patch Examples* chart (`files.kraftmusic.com/media/ownersmanual/Moog_Mother-32_Patch_Examples.pdf`, the manual's Presets section): INIT, 2 OSC SYNTH, TRACKED FM, PLAY THE FILTER, SIMPLEST KICK & SNARE, EVERYTHING!, each with notes and patching, via search excerpts |
| SW | Sweetwater InSync, *Moog Mother-32 Patch Sheets with Videos* (Daniel Fisher, 2017): four Moog charts with variations plus four originals, via search excerpts |
| MS | Moog support (freshdesk): "Why is my Mother-32 distorting when patching into the VCA CV input?", "Why is my Mother-32 syncing to MIDI at half or double time?", "How do I save patterns on Mother-32?" |
| V | VoltPages module sheet `src/data/modules/moog-music--mother-32.json` (`github.com/ogabrielluiz/voltpages`), compiled from M2, FW and Moog's DFAM sync sheet; its author marks it `verified: true` |
| LM | Learning Modular (Chris Meyer), *Sequencing Tips for the Moog Mother-32* (2017), via search excerpts |
| SOS | Sound On Sound, *Moog Mother-32* review (search excerpts) |
| R | Moog spec text as published by retailers: 20 Hz-20 kHz switchable LP/HP 4-pole transistor ladder, 32 patch points, input and output lists in panel reading order |
| F | Forum reports (Moog forum, ModWiggler, Gearspace), via search excerpts |
| L0 | The first build of this twin |

## Panel

- 60 HP Eurorack panel, **304.8 x 128.5 mm**, in a case with **wooden end cheeks** (~7-8 mm each);
  the whole unit is 319.3 mm wide (M2 p.70 "31.93 cm"). **verified** (M2, PD, Eurorack standard).
- Three rows of knobs and toggles on the left three quarters, two rows of square buttons below them
  (the 13-note keyboard and the sequencer keys), the MIDI DIN in the bottom-left corner, and the
  4 x 8 patch bay on the right. **No section boxes are printed**: the sections are three rows of
  labelled controls (PD). The patch bay is the one enclosed block, headed **IN / OUT**. **verified** (PD).
- Knobs: **all 14 are the same size** (16.2-16.4 mm on the drawing), black Moog caps with a white
  pointer line and a printed tick ring. The twin draws 14.5 mm caps plus the tick ring. **verified**
  (PD) for size; cap style **likely** (L0, product photos remembered, not re-checked).
- Toggles: small 2-position bat switches with hex collars; the two positions are printed above and
  below. **verified** (PD).
- Buttons: square pads 8.3 x 7.2 mm; the two octave/step arrows are arrow-shaped and taller,
  9.7 x 10.4 mm. Colour dark grey/black: **likely**.
- Legends: white on black. Second functions are printed in parentheses: (SWING), (BANK), (REC),
  (SHIFT), (KB), (STEP). Patch-bay inputs are plain text, **outputs reversed** (dark text on a white
  box), and gate inputs are drawn inside a circle (M2 p.46 legend). **verified** (M2).
- CUTOFF carries a printed scale: 20Hz, 200Hz, 2KHz, 20KHz. **verified** (M2 p.14).
- Name: MOTHER-32 in the bottom band at the left; the moog logo beside it. Position of the name
  **likely** (PD), logo **guess**.

## Controls

Positions are faceplate millimetres (x, y) of the control centre (PD).

### Row 1 (y 18.0)

| Printed label | Section | Position | Cap | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| FREQUENCY | VCO | (21.7, 18.0) | knob | tunes the VCO "up or down one octave from its center position", calibrated to "slightly more than +/-1 octave" | -1...+1 oct (FREQUENCY centre + KB 0 V = C4) | M2 p.11, V | **verified** |
| (VCO WAVE) | VCO | (51.3, 18.0) | toggle | printed as glyphs. UP: pulse, DOWN: saw. Selects the wave sent to MIX; both are always at VCO SAW / VCO PULSE | PULSE / SAW | M2 p.11, V | function **verified**; up = pulse **likely** (M2 option order, V agree) |
| PULSE WIDTH | VCO | (80.8, 18.0) | knob | "about 2% at the full counterclockwise position to about 98% at the full clockwise position. At mid position a Square wave" | 2-98 % | M2 p.11 | **verified** |
| MIX | Mixer | (110.3, 18.0) | knob | CCW = VCO wave, CW = NOISE, or EXT. AUDIO when patched | 0-100 %, linear crossfade | M2 pp.47-48, V | **verified** (crossfade law: guess) |
| CUTOFF | VCF | (146.1, 18.0) | knob, printed Hz scale | 20 Hz - 20 kHz (SOS measured 17 Hz - 21.5 kHz) | 20-20000 Hz, log | M2 p.14, SOS | **verified** |
| RESONANCE | VCF | (181.8, 18.0) | knob | LOW PASS: "Settings above 3 o'clock will cause the Filter to self-oscillate". HI PASS: non-resonant; turning it up "reintroduces bottom end" | 0-100 % | M2 p.14, F | **verified** |
| VCA MODE | VCA | (206.3, 18.0) | toggle | UP: ON (VCA held open, drone) - DOWN: EG | ON / EG | M2 p.16, V | **verified** (function); positions **likely** |
| VOLUME | Output | (228.7, 18.0) | knob | final level for the rear AUDIO / HEADPHONE output and the VCA jack | 0-100 % (audio taper) | M2 p.47, V | **verified** (taper: guess) |

### Row 2 (y 46.9)

| Printed label | Section | Position | Cap | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| GLIDE | VCO | (21.8, 46.9) | knob | portamento time for keyboard, sequencer and MIDI notes. While a step is edited: any clockwise setting turns that step's glide on, fully CCW off (OCTAVE/LOCATION LED 5 green). SHIFT + GLIDE: ratchet 1-4 | 0-2000 ms | M1, LM, V | function **verified**; time range **guess** |
| VCO MOD SOURCE | VCO MOD | (51.3, 46.9) | toggle | UP: EG - or whatever is patched into VCO MOD (the EG is normalled there). DOWN: LFO (the wave chosen by LFO WAVE) | EG / LFO | M2 p.12, p.13, p.49 | **verified** |
| VCO MOD AMOUNT | VCO MOD | (80.8, 46.9) | knob | unipolar depth; attenuates the VCO MOD jack when patched | 0-100 % | M2 p.12, V | **verified** (full-scale depth: guess) |
| VCO MOD DEST | VCO MOD | (110.5, 46.9) | toggle | UP: PULSE WIDTH - DOWN: FREQUENCY | PW / FREQ | M2 p.12, V | **likely** |
| VCF MODE | VCF | (139.9, 46.9) | toggle | UP: HI PASS - DOWN: LOW PASS | HP / LP | M2 p.14, V | **likely** (positions) |
| VCF MOD SOURCE | VCF MOD | (169.6, 46.9) | toggle | UP: EG - DOWN: LFO | EG / LFO | M2 p.15, V | **likely** (positions) |
| VCF MOD AMOUNT | VCF MOD | (199.2, 46.9) | knob | unipolar: "the attenuator ... only opens from zero"; the sign is the POLARITY switch | 0-100 % | M2 p.15 | **verified** |
| VCF MOD POLARITY | VCF MOD | (228.6, 46.9) | toggle | printed + / -: whether the modulation pushes the cutoff up or down | + / - | M2 p.15, R, V | **verified** |

### Row 3 (y 75.9)

| Printed label | Section | Position | Cap | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| TEMPO / GATE LENGTH, (SWING) | Sequencer | (41.0, 75.9) | knob | internal clock 20-300 BPM (16th-note steps). While a step is edited: its gate length, 1/8 - 8/8 of the step ("the longest duration ... acts as a 'Tie'"). SHIFT + TEMPO: swing, 50 % at 12:00. Clocked externally (MIDI or analog): selects one of 24 clock divisions (8 straight, 8 dotted, 8 triplet) | BPM; gate 1-8; swing 25-75 %; division | M2 p.19, p.25, p.54, MS, FW | **verified** |
| LFO RATE | LFO | (80.8, 75.9) | knob | "about 0.1Hz to approximately 350Hz"; up to 600 Hz with CV | 0.1-350 Hz, log | M2 p.13 | **verified** |
| (LFO WAVE) | LFO | (110.4, 75.9) | toggle | glyphs. UP: square - DOWN: triangle. The selected wave feeds both MOD SOURCE switches; both are always at LFO TRI / LFO SQ | SQ / TRI | M2 p.13, V | function **verified**; positions **likely** |
| ATTACK | EG | (139.9, 75.9) | knob | no times printed anywhere | 1.25 ms - 3 s, log | M2 p.15 | function **verified**; range **guess** (L0) |
| SUSTAIN | EG | (169.5, 75.9) | toggle | UP: ON - "the Envelope signal will hold at its maximum level for the duration a note is held"; legato notes do not retrigger. DOWN: OFF - "the Attack stage immediately moves to the Decay stage when complete"; every note retriggers | ON / OFF | M2 p.16 | **verified** |
| DECAY | EG | (199.2, 75.9) | knob | decay (SUSTAIN OFF) or release after the gate (SUSTAIN ON); no times printed | 1.25 ms - 7 s, log | M2 p.16 | function **verified**; range **guess** (L0) |
| VC MIX | Utilities | (228.7, 75.9) | knob | crossfades MIX 1 (CCW) and MIX 2 (CW); with nothing patched it is a 0 to +5 V source | 0-100 % | M2 pp.50-51, V | **verified** |

### Keyboard and sequencer buttons

Thirteen square pads form a one-octave keyboard (C to C): the five upper-row pads at 1-8 ... SET END are
the black keys, the eight lower-row step pads the white keys. **verified** (PD, M2 p.70 "13 Momentary Pads").

| Printed label | Position | Plain function | With (SHIFT) / in edit | Source | Confidence |
|---|---|---|---|---|---|
| HOLD / REST | upper (40.0, 96.0) | while playing: repeats the current step while held | editing: rest; SHIFT: live mute | M2, V | **verified** (live mute: likely) |
| PATTERN (BANK) | upper (70.6, 96.0) | PATTERN + step pad 1-8 loads a pattern of the current bank | BANK + pad: bank 1-8; PATTERN + RESET restores the stored pattern | M2, MS, V | **likely** |
| 1-8 / 9-16 / 17-24 / 25-32 | upper (134.1 / 149.3 / 179.9 / 195.3, 96.0) | black keys C# D# F# G# | step mode: page select | M2, V | **verified** |
| SET END | upper (210.5, 96.0) | black key A# | step mode: SET END + step pad = last step | M2, V | **verified** (gesture: likely) |
| RESET / ACCENT | lower (40.0, 108.2) | while playing: back to step 1 | editing: accent; SHIFT: live accent | M2, V | **verified** |
| (SHIFT) | lower (55.3, 108.2) | modifier | | M2 | **verified** |
| RUN / STOP (REC) | lower (70.7, 108.2) | start / stop | SHIFT: REC (KB-mode recording); SHIFT held 1 s: save | M2, MS | **verified** |
| (KB) arrow | lower (89.4, 108.2), 9.7 x 10.4 | octave down (8 octaves) | SHIFT: KB mode | M1, M2 | **verified** |
| (STEP) arrow | lower (106.7, 108.2), 9.7 x 10.4 | octave up | SHIFT: STEP mode | M1, M2 | **verified** |
| 1 ... 8 | lower, x = 126.4 + 15.3 k, y 108.2 | white keys C D E F G A B C | step mode: step on/off; SHIFT + step: edit that step | M2, M1 | **verified** |

### LEDs

| LED | Position | Behaviour | Source | Confidence |
|---|---|---|---|---|
| OCTAVE / LOCATION x 8 | between PATTERN and 1-8, label at (98.1, 91.8) | red: keyboard octave (8 settings) or the pattern location; while a step is edited: red bar = gate length in eighths, yellow 1-4 = ratchet, green 5 = glide on, 5-8 = glide / ratchet / accent / rest; yellow = clock division | M1, LM, FW | behaviour **verified**; LED x positions **guess** |
| TEMPO | beside TEMPO | blinks with the clock | PD ("the Tempo LED is a ninth") | **likely** (position guess) |
| Step x 8 | a row below the step pads | current step; in step mode, which steps are on | PD, M1 | **likely** |
| MIDI IN | (13.8, 107.8), 15.6 mm DIN | front-panel 5-pin MIDI input (no MIDI out, no USB) | M2 p.54, p.70 | **verified** |

## Patch bay (32 points: 18 inputs, 14 outputs)

Four columns at x = 256.2, 270.0, 283.9, 297.8 and eight rows on a 13.4 mm pitch (PD). The jack
order is the panel reading order of Moog's published input and output lists (R), which agrees with
the manual's section order (M2 pp.47-56) except for LFO SQ / LFO TRI, which the manual describes
square first. Twin signal convention: 1.0 = 5 V, as on the DFAM. **Order: likely.**

| Row / col | Label | Dir | Level | Normal / behaviour | Source | Confidence |
|---|---|---|---|---|---|---|
| 1/1 | EXT. AUDIO | in | 10 V p-p, unity | **normalled to NOISE** at the clockwise end of MIX; a cable replaces the noise | M2 p.47, p.13 | **verified** |
| 1/2 | MIX CV | in | +/-5 V | sums with MIX; from centre, +/-5 V sweeps VCO to EXT | M2 p.47 | **verified** |
| 1/3 | VCA CV | in | 0..+8 V (EG mode), +/-5 V (ON mode) | **sums** with the VCA MODE switch; over +5 V drives the VCA into clipping | M2 p.47, MS | **verified** |
| 1/4 | VCA | out | +/-5 V | after VOLUME | M2 p.47 | **verified** |
| 2/1 | NOISE | out | +/-5 V | white noise; also the EXT. AUDIO normal | M2 p.48 | **verified** |
| 2/2 | VCF CUTOFF | in | +/-5 V | sums with CUTOFF and VCF MOD; +/-5 V from centre = 20 Hz - 20 kHz (1 V/oct) | M2 p.48 | **verified** |
| 2/3 | VCF RES. | in | +/-5 V | sums with RESONANCE | M2 p.48 | **verified** |
| 2/4 | VCF | out | +/-5 V max | the ladder output (before the VCA) | M2 p.48 | **verified** |
| 3/1 | VCO 1V/OCT | in | +/-5 V | "1V/Octave Exponential" input, **sums** with FREQUENCY and the keyboard CV; +/-5 V = 8 Hz - 8 kHz | M2 p.48 | **verified** |
| 3/2 | VCO LIN FM | in | +/-5 V | linear FM, for audio-rate modulation | M2 p.49 | **verified** (depth: guess) |
| 3/3 | VCO SAW | out | +/-5 V | always the saw, whatever VCO WAVE says | M2 p.49 | **verified** |
| 3/4 | VCO PULSE | out | +/-5 V | always the pulse | M2 p.49 | **verified** |
| 4/1 | VCO MOD | in | Eurorack CV | **replaces the EG** at the UP position of VCO MOD SOURCE; VCO MOD AMOUNT attenuates it | M2 p.49 | **verified** |
| 4/2 | LFO RATE | in | +/-5 V | sums with RATE; from centre about 0.18 Hz - 190 Hz, 600 Hz max (1 V/oct) | M2 p.49 | **verified** |
| 4/3 | LFO TRI | out | +/-5 V | always the triangle | M2 p.50 | **verified** |
| 4/4 | LFO SQ | out | +/-5 V | always the square | M2 p.50 | **verified** |
| 5/1 | MIX 1 | in | +/-5 V, DC | **normalled to 0 V** | M2 p.50 | **verified** |
| 5/2 | MIX 2 | in | +/-5 V, DC | **normalled to +5 V** | M2 p.50 | **verified** |
| 5/3 | VC MIX CTRL | in | +/-5 V | sums with VC MIX; from centre +/-5 V crossfades MIX 1 to MIX 2 | M2 p.50 | **verified** |
| 5/4 | VC MIX | out | +/-5 V | the crossfade (CV or audio) | M2 p.51 | **verified** |
| 6/1 | MULT | in | CV | buffered splitter, "designed to be used ONLY as a CV signal splitter" | M2 p.51 | **verified** |
| 6/2 | MULT 1 | out | = input | copy 1 | M2 p.51 | **verified** |
| 6/3 | MULT 2 | out | = input | copy 2 | M2 p.51 | **verified** |
| 6/4 | ASSIGN | out | 0..+5 V (clock, triggers), +/-5 V (CV) | one of 16 sources (Setup page 1); factory default **2: Sequencer Clock**, one pulse per step | M2 p.52, p.59, p.61 | **verified** |
| 7/1 | GATE | in | 0..+5 V, 10 V tolerant | triggers the EG; combined (OR) with the internal keyboard / sequencer gate | M2 p.53, M1 | trigger **verified**; OR (not a normal) **likely** - the manual lists only four normals |
| 7/2 | EG | out | 0..+7.5 V | the envelope | M2 p.53 | **verified** |
| 7/3 | KB | out | -5..+5 V | keyboard / sequencer / MIDI pitch after GLIDE and pitch bend; MIDI note 0 = -5 V, 120 = +5 V | M2 p.53, V | **verified** |
| 7/4 | GATE | out | 0 / +5 V | gate from the keyboard, sequencer or MIDI | M2 p.53 | **verified** |
| 8/1 | TEMPO | in | +/-5 V (or 0-5 V), triggers at about +3.2 V | four modes (Setup page 3): Tempo CV, **Single Clock Advance (default: one step per rising edge)**, Analog Clock (PPQN), Step Address CV. An analog clock here overrides MIDI clock and the internal clock | M2 p.55, p.59, V | **verified** |
| 8/2 | RUN/STOP | in | gate, +3.2 V | the sequencer plays while the gate is high | M2 p.56 | **verified** |
| 8/3 | RESET | in | gate, +3.2 V | step 1 repeats while high, then the pattern advances | M2 p.56 | **verified** |
| 8/4 | HOLD | in | gate, +3.2 V | the current step repeats while high | M2 p.56 | **verified** |

Circled (gate) inputs: GATE, TEMPO, RUN/STOP, RESET, HOLD. **likely** (M2 p.46 legend; TEMPO circled per PD; the rest from L0).

## Behaviour notes

- **Signal path with no cables**: keyboard / sequencer / MIDI -> KB CV (GLIDE) -> VCO -> VCO WAVE ->
  MIX (noise on the other side) -> 4-pole ladder (LP / HP) -> VCA (EG or ON) -> VOLUME -> out, with the
  EG normalled to VCO MOD and available to VCF MOD, and the selected LFO wave on both MOD SOURCE
  switches. **verified** (M2 p.13, p.49; V).
- **Hi-pass mode**: "The High Pass mode is non-resonant ... if the RESONANCE control is turned up at
  all, the High Pass Filter will NOT function fully" because the bottom end comes back. Owners call
  it weak (bass audible across most of the sweep). The manual's fix: patch VCF into EXT. AUDIO and
  use MIX as the resonance, up to self-oscillation, with RESONANCE fully counterclockwise.
  **verified** (M2 p.14, F, SOS).
- **Filter as a sine source**: LOW PASS, RESONANCE and MIX at maximum, a dummy plug in EXT. AUDIO to
  silence the noise, KB into VCF CUTOFF for 1 V/oct tracking. **verified** (M2 p.14, PE "PLAY THE FILTER").
- **Accent** opens the VCF and the VCA more on that step (internal, fixed amount). **verified** (LM, V).
- **Gate length** only shows with SUSTAIN ON ("IMPORTANT: Make sure the SUSTAIN switch is set to ON for
  different Gate Lengths to sound correctly"). A full gate (8/8) ties into the next step. **verified** (M2 p.25).
- **Per-step data**: note, gate length, glide on/off, ratchet count (1-4 repeats inside the step),
  accent, rest (and tie = gate 8/8). **verified** (M2 p.24).
- **Memory**: 64 patterns = 8 banks x 8, up to 32 steps each. Changing patterns without saving
  discards edits; PATTERN + RESET restores. Firmware 2.0 adds Auto Save and Write Protect (Setup
  page 6). **verified** (M2, MS, FW).
- **Keyboard mode**: keys play; while the sequencer runs they transpose it. Recording: SHIFT + RUN/STOP
  (REC); each key stores a note and moves on; while "paused on a note" its gate length, glide,
  ratchet, accent and rest can be set. **verified** (M1, LM).
- **Step mode**: SHIFT + STEP. Pads switch steps on/off; SHIFT + pad edits a step (its LED blinks, the
  keyboard then sets its note, the arrows its octave); SHIFT + the same pad ends editing. **verified** (M1).
- **Setup mode**: SHIFT + RESET + SET END + STEP 8; pages are chosen with the arrows, values with the
  step pads (SHIFT for 9-16); settings survive power-off. **verified** (M2, SW).
- **Clock priority**: analog clock at TEMPO > MIDI clock > internal. Synced to MIDI or an analog clock,
  the TEMPO knob selects the step division (the classic cause of "half / double speed" sync).
  **verified** (M2 p.55, MS).
- **Live overrides** (not stored): SHIFT + ACCENT live accent, SHIFT + REST live mute. **likely** (V).

## Model choices (guesses to check against hardware)

| Quantity | Twin value |
|---|---|
| Pitch at FREQUENCY centre, KB 0 V | C4, 261.6 Hz (consistent with "+/-5 V = 8 Hz - 8 kHz" and MIDI 60 = 0 V) |
| Keyboard octaves | 8 settings; octave n spans C(n-1) to C(n), so -4 V ... +4 V; power-up octave 4 (C3-C4) |
| EG times | attack 1.25 ms - 3 s, decay 1.25 ms - 7 s (log), RC curves; peak +7.5 V |
| GLIDE | 0 - 2 s, exponential (RC) slide |
| VCO MOD AMOUNT full scale | EG: +4 octaves, LFO: +/-2 octaves (FREQ); +/-48 % pulse width (PW); audio taper |
| VCF MOD AMOUNT full scale | EG: 7 octaves, LFO: +/-3.5 octaves; audio taper |
| LIN FM depth | +5 V doubles the frequency, -5 V stops it (not through-zero) |
| Accent | +1 octave cutoff and +2.5 dB VCA level |
| Self-oscillation | from about 3 o'clock (~75 % of RESONANCE) in LP |
| HI PASS model | non-resonant 4-pole high-pass; RESONANCE blends the low band back in (k/(1+k)) |
| MIX law | linear crossfade |
| VCA | EG level (or 1 in ON mode) + VCA CV / 8 V; soft clips above full |
| ASSIGN clock | one 50 % pulse per step |
| Swing | 25-75 %, every second step delayed (the separate swing interval of firmware 2.0 is not modelled) |
| Analog drift | about 2 cents, slow random |
