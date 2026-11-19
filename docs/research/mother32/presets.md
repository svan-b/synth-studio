# Moog Mother-32: presets (v2: the manual's patches recreated exactly, plus community patches)

All settings below are in hardware terms. The spec behind the numbers is in `signal-flow.md`.
Cites like **(M32 p.N)** are PDF pages of the local copy of the Owner's Manual, Version 2.

## Rules followed (scratchpad `manuals/COPYRIGHT-RULES.md`)

- Settings are facts, and the descriptions are our own words.
- Each patch has a **descriptive name of our own**. The manual's title appears only in the
  description ("Based on the manual's '…' patch (p.N)").
- No artwork has been copied. The positions were read from the drawings and written as numbers.

## How to read a patch

- **Knob order** (always 14): FREQUENCY · PULSE WIDTH · MIX · CUTOFF · RESONANCE · VCF MOD AMOUNT ·
  VCO MOD AMOUNT · GLIDE · LFO RATE · ATTACK · DECAY · VC MIX · VOLUME · TEMPO.
  - Positions are on a clock face: 7:00 is fully CCW, 12:00 is noon, 5:00 is fully CW. One hour
    is 1 on a 0–10 scale.
  - The real unit in brackets comes from the taper model in `signal-flow.md` §14. The endpoints
    are verified and the tapers are guesses. **Set the real unit in the twin.**
- **Switch order** (always 9): VCO WAVE · VCO MOD SOURCE · VCO MOD DEST · VCF MODE · VCF MOD SOURCE ·
  VCF MOD POLARITY · LFO WAVE · SUSTAIN · VCA MODE. Written as the printed legend, for example
  "EG/VCO MOD" or "PULSE WIDTH".
- **Setup defaults** (M32 p.62) apply unless a patch says otherwise:
  - ASSIGN = 2 Clock;
  - TEMPO input = Single Clock Advance;
  - division 1/16 (likely), swing 0 (straight), direction Forward;
  - internal accent on.
- **Cables** are written `OUT → IN` with the printed labels.
- **Octave** is the keyboard octave LED (1–8). Octave n's low C = (n − 5) V, and the default is 4
  (M32 pp.30, 63).
- **Sequence** notation is `step note[/gate] [flags]`:
  - the gate is in eighths of a step (default 4/8);
  - flags: `A` accent, `G` glide into this step (the step before needs `/8`), `R2`–`R4` ratchet,
    `—` rest, `~` tie into the same note;
  - notes use C4 = MIDI 60 = KB 0 V.
- Taper landmarks used below (§14):
  - CUTOFF: 9:00 80 Hz · 10:00 159 Hz · 11:00 317 Hz · 12:00 632 Hz · 1:00 1.26 kHz · 2:00 2.5 kHz · 3:00 5 kHz.
  - DECAY: 11:00 40 ms · 11:30 61 ms · 12:00 94 ms · 12:30 144 ms · 1:00 222 ms · 1:30 341 ms · 2:00 525 ms.
  - ATTACK: 8:00 2.7 ms · 9:00 6 ms.
  - LFO: 9:25 0.7 Hz · 10:00 1.2 Hz · 10:45 2.1 Hz · 12:00 5.9 Hz · 5:00 350 Hz.
  - GLIDE: 9:00 80 ms · 10:00 180 ms.
  - TEMPO: 10:40 54 BPM · 12:00 78 BPM · 1:35 120 BPM · 2:35 155 BPM · 3:00 175 BPM.

## Index

| # | Category / Name | Origin |
|---|---|---|
| 00 | Init / Basic Sawtooth | the manual's default panel (M32 p.10) |
| M1 | FX / Gate-Bent Octave Pops | Based on the manual's "Octave Bounce Back" (p.65) |
| M2 | Perc / Noise-Burst Pluck | Based on the manual's "Noise Transient" (p.65) |
| M3 | Drums / Key-Tracked Noise Snare | Based on the manual's "Metal Snare" (p.65) |
| M4 | Bass / Envelope-PWM Bass | Based on the manual's "Sequencer Bass" (p.66) |
| M5 | FX / Feedback High-Pass Sweep | Based on the manual's "Resonant High Pass Filter" (p.66) |
| M6 | Drums / Saw-FM Crunch Percussion | Based on the manual's "8-Bit Percussion" (p.66) |
| M7 | Drums / Pitch-Drop Synth Toms | Based on the manual's "'80s Toms" (p.67) |
| M8 | Brass / Saw-and-Pulse Stab | Based on the manual's "Short Brass" (p.67) |
| M9 | Drums / Feedback-Filter Kick | Based on the manual's "Filter Kick" (p.67) |
| S1 | Studio / Mother-32 Clocks the DFAM | Moog procedure (DFAM manual p.31; Electronicus patchbook p.3) |
| S2 | Studio / Mother-32 Clocks the Subharmonicon | Moog procedure (Subharmonicon manual p.38) |
| E1 | Studio / Three-Oscillator Keys (M32 + DFAM VCOs) | Based on the Electronicus patch book's "Baroque As A Joke" (p.4) |
| E2 | Studio / Bouncing Bass with Drum Shadow | Based on "Deep Bounce" (Electronicus p.5) |
| E3 | Studio / Mother-32 Through the DFAM | Based on "Lo-Fi Low End" (Electronicus p.6) |
| E4 | Studio / Dark Drone over a Drum Pattern | Based on "Aftermath" (Electronicus p.7) |
| E5 | Studio / Clocked Electro Kick and Grit | Based on "ONE Faux ONE" (Electronicus p.8) |
| E6 | Studio / DFAM Squares through the Ladder | Based on "3 Squares & A Sine" (Electronicus p.9) |
| E7 | Studio / Tracking Feedback Sine | Based on "Sine Up For Noise" (Electronicus p.10) |
| C01–C30 | community patches and Synth Studio designs | see each one |

---

## 00 · Init / Basic Sawtooth
*The manual's default panel, the "basic sawtooth sound" that the tutorials and the calibration
start from (M32 pp.10, 25, 33, 63).* Positions are read from the drawing: **verified**.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 (0 oct) · PULSE WIDTH 12:00 (50 %) · MIX 7:00 (VCO only) · CUTOFF 11:00 (≈ 317 Hz) · RESONANCE 7:00 (0) · VCF MOD AMOUNT 12:00 (50 %, EG ≈ +3.75 oct) · VCO MOD AMOUNT 7:00 (0) · GLIDE 7:00 (0) · LFO RATE 12:00 (≈ 5.9 Hz) · ATTACK 7:00 (1.25 ms) · DECAY ≈ 11:30 (≈ 61 ms) · VC MIX 7:00 · VOLUME 12:00 (50 %) · TEMPO ≈ 2:30 (≈ 150 BPM) |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · VCA MODE EG |
| Octave | 4 |
| Cables | none |
| Sequence | the manual's tutorials start from an initialised pattern (SHIFT + RESET + PATTERN: a one-step pattern of the default note, −1 V = C3, gate 50 %; M32 pp.33, 44). Twin demo: `1 C2 A · 2 C2 · 3 C3 · 4 C2 · 5 — · 6 D#2 · 7 C2 · 8 G2 · 9 C2 A · 10 C2 · 11 A#2 · 12 C2 · 13 F2 · 14 — · 15 G2 · 16 D#2` at 120 BPM |
| Notes | With SUSTAIN ON, DECAY is the release, so the default is a bright saw that closes quickly after each key is released |

---

## The manual's nine patch sheets (M32 pp.65–67), recreated exactly

Positions were read from the 110-dpi drawings and are good to about ±½ hour. Switch positions
and cables are exact: on the sheets the chosen legend is circled, and the cables are drawn.
**Confidence: verified for switches, cables and octave; knobs verified ±½ h.** The sheets
specify **no sequence**, so each comes with a demo pattern of ours, labelled as such. The
TEMPO knob is listed as drawn; any musical tempo works.

### M1 · FX / Gate-Bent Octave Pops
*Based on the manual's "Octave Bounce Back" patch (p.65). The sheet's only note is to use VC MIX
to set the tuning.*
While a note's gate is high, VC MIX passes part of the +5 V gate into LIN FM, which bends the
VCO up. When the gate drops, the pitch falls back. Each note leaps and returns, and VC MIX
sets the size of the leap (fully CW is about an octave under the §14 LIN FM model). A slow
triangle LFO modulates the pulse width and, slightly, the filter.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 (50 %) · MIX 7:00 (VCO) · CUTOFF 1:00 (≈ 1.26 kHz) · RESONANCE 10:00 (≈ 30 %) · VCF MOD AMOUNT 8:00 (≈ 10 %) · VCO MOD AMOUNT 12:00 (50 %) · GLIDE 7:00 · LFO RATE ≈ 9:25 (≈ 0.7 Hz) · ATTACK 9:00 (≈ 6 ms) · DECAY 2:00 (≈ 525 ms) · VC MIX 2:00 (70 % of MIX 2) · VOLUME 12:00 · TEMPO ≈ 10:40 |
| Switches | PULSE · LFO · PULSE WIDTH · LOW PASS · LFO · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | GATE (out) → MIX 2 · VC MIX → VCO LIN FM |
| Octave | 4 |
| Demo (ours) | 8 steps @ 110 BPM: `1 C3/3 A · 2 G3/2 · 3 C3/6 · 4 — · 5 A#3/3 · 6 C3/3 · 7 D#3/6 · 8 G3/2` (longer gates hold the leap longer) |

### M2 · Perc / Noise-Burst Pluck
*Based on the manual's "Noise Transient" patch (p.65).*
The EG, scaled by VC MIX, goes into MIX CV. At the start of every note the mix swings toward
noise, then returns to the pulse as the envelope falls. The result is a breathy click on each
attack. The same EG opens the filter, the decay is short, and a slow LFO adds PWM.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH ≈ 10:40 (≈ 37 %) · MIX 7:00 (VCO; the EG pushes it toward noise) · CUTOFF 11:00 (≈ 317 Hz) · RESONANCE 7:00 (0) · VCF MOD AMOUNT 2:00 (≈ 70 %) · VCO MOD AMOUNT 11:00 (≈ 40 %, PWM) · GLIDE 7:00 · LFO RATE ≈ 9:25 (≈ 0.7 Hz) · ATTACK 7:00 · DECAY 11:00 (≈ 40 ms) · VC MIX 2:00 (70 %) · VOLUME 12:00 · TEMPO 12:00 |
| Switches | PULSE · LFO · PULSE WIDTH · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | EG → MIX 2 · VC MIX → MIX CV |
| Octave | 5 |
| Demo (ours) | 16 @ 120, gates 2/8: `1 C4 A · 3 C4 · 4 D#4 · 6 G4 · 8 C4 · 9 A#4 A · 11 C4 · 13 G4 · 14 F4 · 15 D#4`; others rest |

### M3 · Drums / Key-Tracked Noise Snare
*Based on the manual's "Metal Snare" patch (p.65).*
Only noise reaches the filter, because MIX is fully CW. KB → VCF CUTOFF means the key you play
sets the snare's colour. The EG cracks the filter open (≈ 70 %), and EG → VCA CV adds to the
internal EG for a harder hit. The sheet also selects a maximum-rate square LFO, but with VCO
MOD AMOUNT at 0 and the VCO out of the mix it has no audible effect.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH ≈ 12:30 (≈ 55 %) · MIX 5:00 (noise only) · CUTOFF 10:00 (≈ 159 Hz before key tracking) · RESONANCE 7:00 (0) · VCF MOD AMOUNT 2:00 (≈ 70 %) · VCO MOD AMOUNT 7:00 (0) · GLIDE 7:00 · LFO RATE 5:00 (≈ 350 Hz) · ATTACK 7:00 · DECAY 1:00 (≈ 222 ms) · VC MIX 7:00 · VOLUME 12:00 · TEMPO 7:00 (as drawn: 20 BPM) |
| Switches | PULSE · LFO · PULSE WIDTH · LOW PASS · EG · + · SQUARE · SUSTAIN OFF · EG |
| Cables | EG → VCA CV · KB → VCF CUTOFF |
| Octave | 6 (low C = +1 V, so the cutoff is lifted about one octave) |
| Demo (ours) | 16 @ 100, gates 1/8: `5 C5 A · 13 C5 A · 15 G5 · 16 D5`; others rest |

### M4 · Bass / Envelope-PWM Bass
*Based on the manual's "Sequencer Bass" patch (p.66).*
A low pulse bass. The EG sweeps the pulse width on every note (VCO MOD EG → PULSE WIDTH ≈ 40 %)
and gently opens the filter. KB → VCF CUTOFF keeps the brightness even from note to note. GLIDE
is set for slides on glide steps. The octave is very low (octave 2: C1 = 32.7 Hz).

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH ≈ 10:10 (≈ 32 %) · MIX 7:00 · CUTOFF 12:00 (≈ 632 Hz before key tracking; ≈ 80 Hz at C1) · RESONANCE 9:00 (≈ 20 %) · VCF MOD AMOUNT 10:00 (≈ 30 %) · VCO MOD AMOUNT 11:00 (≈ 40 %) · GLIDE 10:00 (≈ 180 ms) · LFO RATE ≈ 10:45 (unused) · ATTACK 7:00 · DECAY 12:00 (≈ 94 ms) · VC MIX 7:00 · VOLUME 12:00 · TEMPO 3:00 (≈ 175 BPM) |
| Switches | PULSE · EG/VCO MOD · PULSE WIDTH · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | KB → VCF CUTOFF |
| Octave | 2 |
| Demo (ours) | 16 @ 120, gates 3/8: `1 C1 A · 2 C1 · 3 C2 · 4 C1 · 5 D#1 · 6 C1 · 7 G1/8 · 8 A#1 G · 9 C1 A · 10 C1 · 11 C2 · 12 C1 · 13 F1 · 14 D#1/8 · 15 C1 G · 16 G1` |

### M5 · FX / Feedback High-Pass Sweep
*Based on the manual's "Resonant High Pass Filter" patch (p.66). It puts the manual's tip into
practice: VCF out → EXT. AUDIO with RESONANCE fully CCW, so MIX becomes the HP resonance
(p.15).*
MIX at noon gives a strong, resonant HP. A slow triangle LFO sweeps the cutoff ±2.5 octaves
through VCF MOD.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 12:00 (50 %: the feedback amount) · CUTOFF 11:00 (≈ 317 Hz) · RESONANCE 7:00 (0) · VCF MOD AMOUNT 12:00 (50 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE ≈ 9:25 (≈ 0.7 Hz) · ATTACK 7:00 · DECAY 1:00 (≈ 222 ms) · VC MIX 7:00 · VOLUME 12:00 · TEMPO ≈ 1:30 (≈ 116 BPM) |
| Switches | PULSE · LFO · FREQUENCY · **HI PASS** · **LFO** · + · TRIANGLE · **SUSTAIN ON** · EG |
| Cables | VCF → EXT. AUDIO |
| Octave | 3 |
| Demo (ours) | 8 @ 116, gates 6/8: `1 C2 · 2 C3 · 3 G2 · 4 A#2 · 5 C2 · 6 D#2 · 7 G2 · 8 F2` |

### M6 · Drums / Saw-FM Crunch Percussion
*Based on the manual's "8-Bit Percussion" patch (p.66).*
Noise alone feeds a closed filter (CUTOFF at minimum). The VCO is never heard directly. Its saw,
played in octave 8, modulates the cutoff at audio rate, so the noise comes out gritty and
bit-crushed, and each key changes the grit. A strong EG pops the filter open on each hit.
VCA MODE is ON, so the closing filter does the gating, and EG → VCA CV adds punch on top.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH ≈ 1:15 (unused) · MIX 5:00 (noise only) · CUTOFF 7:00 (20 Hz) · RESONANCE 10:00 (≈ 30 %) · VCF MOD AMOUNT ≈ 4:30 (≈ 95 %) · VCO MOD AMOUNT 7:00 (0) · GLIDE 7:00 · LFO RATE ≈ 9:25 · ATTACK 7:00 · DECAY 2:00 (≈ 525 ms) · VC MIX 7:00 · VOLUME 12:00 · TEMPO ≈ 2:35 |
| Switches | **SAW** · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · **VCA MODE ON** |
| Cables | EG → VCA CV · VCO SAW → VCF CUTOFF |
| Octave | 8 |
| Demo (ours) | 16 @ 120, gates 1/8: `1 C7 A · 3 G7 · 5 C8 · 6 D#7 R2 · 9 C7 A · 11 A#7 · 12 G7 · 14 C8 R3 · 15 F7`; others rest |

### M7 · Drums / Pitch-Drop Synth Toms
*Based on the manual's "'80s Toms" patch (p.67).*
These are classic synth toms. The EG gives a big downward pitch sweep (VCO MOD EG → FREQUENCY ≈
80 %), MIX at noon blends noise in for the skin, and the filter envelope is at full. KB → VCF
CUTOFF makes higher toms brighter, and GLIDE adds a slight slur between them.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 12:00 (50/50) · CUTOFF 1:00 (≈ 1.26 kHz before key tracking) · RESONANCE 7:00 (0) · VCF MOD AMOUNT 5:00 (100 %) · VCO MOD AMOUNT 3:00 (≈ 80 %, EG ≈ +2.9 oct) · GLIDE 10:00 (≈ 180 ms) · LFO RATE 10:00 (unused) · ATTACK 7:00 · DECAY 1:00 (≈ 222 ms) · VC MIX 7:00 · VOLUME 12:00 · TEMPO ≈ 2:35 |
| Switches | PULSE · EG/VCO MOD · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | KB → VCF CUTOFF |
| Octave | 2 |
| Demo (ours) | 16 @ 110, gates 2/8 (a tom fill): `1 G1 A · 4 G1 · 7 D#1 · 9 G1 A · 11 F1 · 12 D#1 · 13 C1 A · 14 C1 · 15 C2 · 16 C1 R2` |

### M8 · Brass / Saw-and-Pulse Stab
*Based on the manual's "Short Brass" patch (p.67).*
VCO WAVE sends the pulse to MIX's CCW side, and the cable brings the saw to the CW side
(the manual's blend trick, p.12, the other way round). MIX at 1:00 is mostly saw. The EG
sweeps the pulse width hard (≈ 80 %) and opens the filter (50 %, with key tracking). A short
decay makes a brass stab.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH ≈ 9:30 (≈ 26 %) · MIX 1:00 (≈ 60 % saw) · CUTOFF 11:00 (≈ 317 Hz before key tracking) · RESONANCE 7:00 (0) · VCF MOD AMOUNT 12:00 (50 %) · VCO MOD AMOUNT 3:00 (≈ 80 %) · GLIDE 9:00 (≈ 80 ms) · LFO RATE 10:00 (unused) · ATTACK 8:00 (≈ 2.7 ms) · DECAY 12:00 (≈ 94 ms) · VC MIX 7:00 · VOLUME 12:00 · TEMPO ≈ 2:35 |
| Switches | PULSE · EG/VCO MOD · PULSE WIDTH · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | VCO SAW → EXT. AUDIO · KB → VCF CUTOFF |
| Octave | 4 |
| Demo (ours) | 16 @ 110, gates 2/8: `1 C3 A · 3 C3 · 4 D#3 · 7 G3 A · 9 F3 · 11 D#3 · 12 C3 · 15 A#3 · 16 C3`; others rest |

### M9 · Drums / Feedback-Filter Kick
*Based on the manual's "Filter Kick" patch (p.67).*
MIX is fully CW, so only the filter's own output, fed back through EXT. AUDIO, reaches the input.
The VCO is effectively absent, and its pulse is at about 2 %. In HI PASS mode the feedback makes
the filter self-oscillate (p.15), and RESONANCE at full adds the bottom end back (p.15). The EG
sweeps the oscillating filter's pitch down fast, which is the kick. KB → VCF CUTOFF tunes it.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 7:00 (≈ 2 %) · MIX 5:00 (feedback only) · CUTOFF 9:00 (≈ 80 Hz before key tracking) · RESONANCE 5:00 (100 %) · VCF MOD AMOUNT 12:00 (50 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 7:00 (unused) · ATTACK 7:00 · DECAY 11:00 (≈ 40 ms) · VC MIX 7:00 · VOLUME 12:00 · TEMPO ≈ 2:35 |
| Switches | PULSE · LFO · FREQUENCY · **HI PASS** · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | VCF → EXT. AUDIO · KB → VCF CUTOFF |
| Octave | 3 |
| Demo (ours) | 16 @ 120, gates 2/8 (four on the floor): `1 C2 A · 5 C2 · 9 C2 · 13 C2 · 16 C2`; others rest |
| Twin note | this depends on the HP-mode model: feedback through EXT. AUDIO must be able to self-oscillate in HP, and RESONANCE in HP must restore the lows (`signal-flow.md` §14). Check it by ear: the kick must pitch-drop |

---

## Official pairing procedures (Moog manuals)

### S1 · Studio / Mother-32 Clocks the DFAM
*Moog's procedure in the DFAM manual (p.31) and the Electronicus patchbook (p.3). Our sounds.*
- **Cable**: Mother-32 ASSIGN → DFAM ADV / CLOCK. ASSIGN must be on Clock, its default.
- **Order**: press RUN / STOP on the DFAM first, so it waits for clock, then RUN/STOP on the
  Mother-32. The DFAM steps once per Mother-32 step.
- **Tip from the DFAM manual**: other clock divisions (ASSIGN Clock/2 or Clock/4, or the M32 clock
  division) run the DFAM at a division of the master tempo.
- **Downbeat** (Moog sync sheet, via DREF): park the DFAM on step 8 with ADVANCE first, so the
  first pulse lands on step 1. Likely.

| | |
|---|---|
| Mother-32 | preset 00 with CUTOFF 10:00, VCF MOD AMOUNT 12:00, DECAY 1:00, SUSTAIN OFF; TEMPO 1:35 (120 BPM); sequence as in preset 00 |
| DFAM (from the DFAM twin's `dfam-st1-clock` start) | VCO 1 FREQUENCY −1.4 oct · VCO 1 EG AMOUNT +45 % · VCO DECAY 45 ms · VCO 1 LEVEL 90 % · VCF CUTOFF 3.5 kHz · VCF EG AMOUNT +20 % · VCF DECAY 60 ms · VCA DECAY 220 ms · VELOCITY 1–8 = 100, 0, 55, 0, 100, 0, 70, 40 |

### S2 · Studio / Mother-32 Clocks the Subharmonicon
*Moog's procedure in the Subharmonicon manual (p.38).*
- **Cable**: Mother-32 ASSIGN (Clock) → Subharmonicon CLOCK input.
- **Order**: press PLAY on the Subharmonicon first, then RUN/STOP (REC) on the Mother-32.
- **Tip**: other M32 clock divisions run the Subharmonicon at a division of the master tempo.
- Use any Mother-32 patch above.

---

## Moog House of Electronicus patch book (DFAM + Mother-32), recreated

*Source: `manuals/dfam/DFAM_Electronicus_Patchbook/`, pp.4–10. Positions were read from the
110-dpi drawings.* **Confidence**:
- **Mother-32 side**: verified for switches, cables and octave; knobs to about ±½ h.
- **DFAM side**: likely. Its main knobs are given approximately. Its small mixer and step knobs
  are hard to read and are given only where clear.

Each sheet's notes are paraphrased; several were printed in a garbled font and decoded here.
The DFAM jack names are those of `devices/dfam/spec.ts`. The DFAM wave legends are up =
square, down = triangle.

### E1 · Studio / Three-Oscillator Keys (M32 + DFAM VCOs)
*Based on "Baroque As A Joke" (Electronicus p.4).* A three-oscillator voice:
- KB is split by MULT into both DFAM VCO CV inputs, so the DFAM's two VCOs play the same notes
  as the Mother-32's saw.
- The Mother-32's GATE fires the DFAM's envelopes through TRIGGER. The DFAM sequencer is **not
  running**: it sits on step 8, so VELOCITY 8 sets the DFAM's level.

| | |
|---|---|
| M32 knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX ≈ 7:30 (VCO) · CUTOFF ≈ 4:45 (open) · RESONANCE 7:00 · VCF MOD AMOUNT 7:00 · VCO MOD AMOUNT 7:00 · GLIDE 9:00 (≈ 80 ms) · LFO RATE 12:00 · ATTACK 8:00 (≈ 2.7 ms) · DECAY 2:00 (≈ 525 ms) · VC MIX 12:00 · VOLUME ≈ 4:30 · TEMPO 12:00 |
| M32 switches | SAW · LFO · PULSE WIDTH · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Octave | 5 |
| Cables | M32 KB → M32 MULT · MULT 1 → DFAM VCO 1 CV · MULT 2 → DFAM VCO 2 CV · M32 GATE → DFAM TRIGGER |
| DFAM | not running, parked on step 8 (ADVANCE) · VELOCITY 8 high (≈ 4:30), other velocities 0 · SEQ PITCH MOD OFF · VCO DECAY 9:00 · VCO 1 EG AMOUNT 12:00 · VCO 2 EG AMOUNT ≈ 11:00 · VCO 1 FREQUENCY ≈ 1:20, square · VCO 2 FREQUENCY ≈ 2:40, triangle · 1→2 FM 0 · HARD SYNC OFF · VCO 1 LEVEL ≈ 12:00 · NOISE/EXT 0 · VCO 2 LEVEL ≈ 12:00 · VCF **HP**, CUTOFF ≈ 11:30, RESONANCE ≈ 4:00 · VCA EG FAST · VCF DECAY ≈ 11:30 · VCF EG AMOUNT ≈ 2:00 · NOISE/VCF MOD 0 · VCA DECAY ≈ 2:00 · VOLUME ≈ 4:30 |
| Sheet notes | a three-oscillator synth; the DFAM is triggered, not run; step 8's velocity must be up; program a sequence on the Mother-32 |
| Demo (ours) | 8 @ 100, gates 5/8: `1 C4 A · 2 E4 · 3 G4 · 4 C5 · 5 B4 · 6 G4 · 7 A4 · 8 F4` |

### E2 · Studio / Bouncing Bass with Drum Shadow
*Based on "Deep Bounce" (Electronicus p.5).* The setup:
- **The Mother-32 drones** (VCA MODE ON) under a low cutoff. A short, very deep filter
  envelope bounces on every note.
- LFO TRI goes into VCO MOD and slowly sweeps the pulse width.
- The DFAM is clocked by ASSIGN, triggered only on M32 gates, and its VCO 2 tracks the
  keyboard (via MULT).

| | |
|---|---|
| M32 knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX ≈ 7:30 · CUTOFF ≈ 9:45 (≈ 140 Hz) · RESONANCE ≈ 12:45 (≈ 55 %) · VCF MOD AMOUNT ≈ 4:45 (≈ 95 %) · VCO MOD AMOUNT ≈ 9:45 (≈ 25 %) · GLIDE 9:00 · LFO RATE ≈ 7:30 (≈ 0.15 Hz) · ATTACK 7:00 · DECAY ≈ 10:30 (≈ 25 ms) · VC MIX 12:00 · VOLUME ≈ 4:30 · TEMPO ≈ 12:30 |
| M32 switches | PULSE · EG/VCO MOD · PULSE WIDTH · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · **ON** |
| Octave | 3 |
| Cables | M32 LFO TRI → M32 VCO MOD · M32 KB → MULT · MULT 1 → DFAM VCO 2 CV · M32 GATE → DFAM TRIGGER · M32 ASSIGN → DFAM ADV / CLOCK · DFAM PITCH → DFAM NOISE LEVEL |
| DFAM | RUN / STOP armed (clocked) · SEQ PITCH MOD OFF · VCO DECAY ≈ 10:00 · VCO 1 EG AMOUNT ≈ 4:00 (+) · VCO 1 FREQUENCY marked as a range from 12:00 to about 4:30 (to taste), triangle · VCO 2 FREQUENCY ≈ 2:40, triangle, VCO 2 EG 12:00 · 1→2 FM 0 · SYNC OFF · VCF LP, CUTOFF ≈ 11:00, RESONANCE ≈ 8:00 · VCA EG FAST · VCF DECAY ≈ 3:40 · VCF EG AMOUNT ≈ full + · NOISE/VCF MOD 0 · VCA DECAY ≈ 2:50 · VOLUME ≈ 4:30 · step PITCH knobs set NOISE LEVEL per step |
| Sheet notes | program a sequence on the Mother-32; tune DFAM VCO 2 to the Mother-32 |

### E3 · Studio / Mother-32 Through the DFAM
*Based on "Lo-Fi Low End" (Electronicus p.6).* The setup:
- The Mother-32's filter output feeds the DFAM's EXT AUDIO, so the bass passes through the
  DFAM's mixer, ladder and VCA alongside its two VCOs.
- The M32's GATE lengthens the DFAM's filter decay while a note is held.
- The DFAM is clocked by ASSIGN.

| | |
|---|---|
| M32 knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX ≈ 10:00 (≈ 30 % noise) · CUTOFF ≈ 9:45 (≈ 140 Hz) · RESONANCE 7:00 · VCF MOD AMOUNT ≈ 8:00 (≈ 10 %) · VCO MOD AMOUNT ≈ 10:00 (≈ 30 %) · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY ≈ 10:00 · VC MIX ≈ 10:00 · VOLUME ≈ 2:00 · TEMPO ≈ 9:40 |
| M32 switches | PULSE · EG/VCO MOD · PULSE WIDTH · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Octave | 3 |
| Cables | M32 VCF → DFAM EXT AUDIO · M32 GATE → DFAM VCF DECAY · M32 ASSIGN → DFAM ADV / CLOCK · M32 KB → M32 MIX 1. The last one is drawn, but nothing leaves VC MIX, so it does nothing as drawn |
| DFAM | clocked · SEQ PITCH MOD OFF · NOISE/EXT LEVEL high (the M32 signal) · VCO 1 FREQUENCY ≈ 10:30, VCO 2 ≈ 12:00, both triangles, both EG AMOUNTs ≈ fully (−) · VCO 1 and VCO 2 LEVEL ≈ 1:30 · VCF LP, CUTOFF ≈ 10:00, RESONANCE ≈ 8:00 · VCF DECAY ≈ 8:30 · VCF EG AMOUNT ≈ 1:00 · VCA EG FAST · VCA DECAY ≈ 11:00 · VOLUME ≈ 2:30 |
| Sheet notes (decoded) | program a sequence on the M32; ride DFAM VCA DECAY for longer or shorter releases; flip the M32's VCF MOD SOURCE to LFO for a light tremolo; play the DFAM velocity knobs for accents; set DFAM NOISE/EXT LEVEL to about 9 o'clock "for added fun" |

### E4 · Studio / Dark Drone over a Drum Pattern
*Based on "Aftermath" (Electronicus p.7).* The setup:
- **The Mother-32 drones** in HI PASS. With RESONANCE at 2:00 the low end comes back (M32
  p.15).
- A very slow LFO sweeps the cutoff and the pulse width.
- The DFAM runs on its own. Its VCO 2, whose pitch follows the DFAM sequence (SEQ PITCH MOD
  VCO 2), modulates the Mother-32's MIX CV at audio rate, which roughens the drone in time with
  the drums.
- Press the three lowest keys (C, D, E in octave 2) for darker drone notes; GLIDE slides
  between them.

| | |
|---|---|
| M32 knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX ≈ 7:30 · CUTOFF 12:00 · RESONANCE ≈ 2:00 · VCF MOD AMOUNT ≈ 3:15 (≈ 80 %) · VCO MOD AMOUNT 12:00 · GLIDE ≈ 10:00 (≈ 180 ms) · LFO RATE ≈ 7:00 (≈ 0.1 Hz) · ATTACK 7:00 · DECAY 7:00 · VC MIX 12:00 · VOLUME ≈ 4:30 · TEMPO 12:00 |
| M32 switches | PULSE · LFO · PULSE WIDTH · **HI PASS** · **LFO** · + · TRIANGLE · SUSTAIN ON · **ON** |
| Octave | 2 (keys 1–3 marked) |
| Cables | DFAM VCO 2 → M32 MIX CV · DFAM TRIGGER (out) → DFAM VCA CV · DFAM PITCH → DFAM NOISE LEVEL |
| DFAM | running on its own TEMPO (≈ 10:00) · SEQ PITCH MOD **VCO 2** · VCO DECAY ≈ 9:30 · VCO 1 EG AMOUNT ≈ 4:30 (+) · VCO 1 FREQUENCY ≈ 10:00, square · VCO 2 FREQUENCY ≈ 2:40, triangle · VCF LP, CUTOFF ≈ 11:00, RESONANCE ≈ 7:30 · VCA EG FAST · VCF DECAY ≈ 2:00 · VCF EG AMOUNT ≈ 4:00 · VCA DECAY ≈ 11:30 · VOLUME ≈ 4:30 · step pitches and velocities varied (not transcribed) |
| Sheet notes | the Mother-32 is set to drone; keys 1, 2 or 3 add darkness |

### E5 · Studio / Clocked Electro Kick and Grit
*Based on "ONE Faux ONE" (Electronicus p.8).* The setup:
- **On the Mother-32**: its own pulse wave drives MIX CV at audio rate, crossfading saw and
  noise many times per cycle for a gritty, ring-modulated tone. EG → VCF RES. makes each hit
  spike in resonance.
- **On the DFAM**: a kick, clocked by ASSIGN.

| | |
|---|---|
| M32 knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 12:00 · CUTOFF ≈ 9:45 · RESONANCE ≈ 7:30 · VCF MOD AMOUNT ≈ 2:20 (≈ 75 %) · VCO MOD AMOUNT 9:00 (20 %, EG → pulse width of the MIX-CV pulse) · GLIDE 7:00 · LFO RATE ≈ 11:00 · ATTACK 7:00 · DECAY 12:00 (≈ 94 ms) · VC MIX ≈ 7:30 · VOLUME ≈ 2:00 · TEMPO ≈ 1:30 (≈ 116 BPM) |
| M32 switches | **SAW** · EG/VCO MOD · PULSE WIDTH · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Octave | 4 |
| Cables | M32 VCO PULSE → M32 MIX CV · M32 EG → M32 VCF RES. · M32 ASSIGN → DFAM ADV / CLOCK |
| DFAM | clocked · SEQ PITCH MOD OFF · VCO DECAY ≈ 8:45 · VCO 1 EG AMOUNT ≈ 1:00 (+) · VCO 1 FREQUENCY ≈ 10:30, triangle · VCO 2 12:00, triangle · VCF LP, CUTOFF ≈ 7:30, RESONANCE ≈ 7:30 · VCA EG FAST · VCF DECAY ≈ 12:30 · VCF EG AMOUNT ≈ 2:45 · VCA DECAY 3:00 · VOLUME ≈ 4:30 |
| Sheet notes (decoded) | patch M32 LFO TRI into DFAM VCF DECAY to vary the kick length (suggested, not drawn); play the DFAM velocities to change the rhythm; DFAM RESONANCE fully up gives an electro kick |

### E6 · Studio / DFAM Squares through the Ladder
*Based on "3 Squares & A Sine" (Electronicus p.9).* The setup:
- The DFAM's two square VCOs (hard-synced) track the Mother-32's keyboard through MULT.
- They come back into the Mother-32 through VC MIX (MIX 1 and MIX 2) into EXT. AUDIO, so the M32
  ladder filters its own pulse plus the two DFAM squares: three squares.
- The "sine" is the DFAM's own self-oscillating filter (RESONANCE ≈ 4:30).

| | |
|---|---|
| M32 knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 12:00 · CUTOFF ≈ 8:20 (low) · RESONANCE ≈ 9:20 · VCF MOD AMOUNT ≈ 2:00 (≈ 70 %) · VCO MOD AMOUNT 12:00 · GLIDE 7:00 · LFO RATE ≈ 11:00 · ATTACK 7:00 · DECAY ≈ 2:00 (≈ 525 ms) · VC MIX 12:00 · VOLUME ≈ 11:20 · TEMPO ≈ 11:00 |
| M32 switches | PULSE · EG/VCO MOD · PULSE WIDTH · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Octave | 3 |
| Cables | M32 KB → MULT · MULT 1 → DFAM VCO 1 CV · MULT 2 → DFAM VCO 2 CV · DFAM VCO 1 → M32 MIX 1 · DFAM VCO 2 → M32 MIX 2 · M32 VC MIX → M32 EXT. AUDIO · M32 ASSIGN → DFAM ADV / CLOCK |
| DFAM | clocked · SEQ PITCH MOD OFF · VCO 1 and VCO 2 square, FREQUENCY ≈ 10:30 each (tune to the M32), **HARD SYNC ON** · EG AMOUNTs 12:00 · 1→2 FM 0 · VCO DECAY ≈ 7:30 · VCF LP, CUTOFF ≈ 8:30, RESONANCE ≈ 4:30 · VCA EG FAST · VCF DECAY ≈ 11:00 · VCF EG AMOUNT ≈ 2:00 · VCA DECAY ≈ 2:30 · VOLUME ≈ 4:00 · PITCH 1–8 at noon |
| Sheet notes (decoded) | adjust the DFAM VCOs to taste; try matching their frequency to the Mother-32's |

### E7 · Studio / Tracking Feedback Sine
*Based on "Sine Up For Noise" (Electronicus p.10).* The setup:
- **On the Mother-32**: the low-pass is at full resonance with its output fed back into EXT.
  AUDIO, and MIX is mostly on that feedback. KB → VCF CUTOFF makes the singing filter follow the
  sequence. The feedback adds noisy instability.
- **On the DFAM**: clocked by ASSIGN, a high-passed hat-like voice whose per-step PITCH knobs set
  its filter decay.

| | |
|---|---|
| M32 knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX ≈ 4:30 · CUTOFF ≈ 11:30 · RESONANCE 5:00 · VCF MOD AMOUNT 7:00 · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY ≈ 11:00 (≈ 40 ms) · VC MIX ≈ 7:30 · VOLUME ≈ 1:00 · TEMPO 12:00 |
| M32 switches | PULSE · EG/VCO MOD · PULSE WIDTH · LOW PASS · **LFO** · + · TRIANGLE · SUSTAIN OFF · EG |
| Octave | 4 |
| Cables | M32 VCF → M32 EXT. AUDIO · M32 KB → M32 VCF CUTOFF · M32 ASSIGN → DFAM ADV / CLOCK · DFAM PITCH → DFAM VCF DECAY |
| DFAM | clocked · SEQ PITCH MOD OFF · VCO DECAY ≈ 7:30 · EG AMOUNTs 12:00 · VCO 1 and VCO 2 12:00, triangles · VCF **HP**, CUTOFF ≈ 10:00, RESONANCE ≈ 8:00 · VCA EG FAST · VCF DECAY ≈ 8:00 · VCF EG AMOUNT ≈ 7:30 (−) · VCA DECAY ≈ 10:00 · VOLUME ≈ 10:00 · PITCH 1 ≈ 3:00, PITCH 2–5 ≈ 12:00, PITCH 6–8 ≈ 10:30 · VELOCITY 1 ≈ 4:30, 2 ≈ 1:30, 3 ≈ 3:30, 4 ≈ 12:30, 5–8 ≈ 1:30 |
| Sheet notes | program a sequence on the M32; for extra "zaniness" the sheet suggests turning the M32 MIX toward VCO and playing with a second knob (its name is garbled in the text) |
| Twin note | like M9, this needs a stable but self-oscillating feedback path through EXT. AUDIO |

---

## Community patches and Synth Studio designs

These are our own names and settings. Where the brief named a Moog online patch chart that we
could not read (Synthesized Kick Drum, Modulated Bass, Sequenced Filter, Analog Kick and Snare,
Chugging Along, Accented Filter, Gallop, Randomnation), the patch is **our design for the same
musical goal**, and that is all we claim. VoltPages (VP, MIT) ideas are credited.

### C01 · Drums / Pitch-Envelope Kick
*Our design (goal: a synthesized kick).* A 50 % pulse under a low cutoff is almost a sine. One EG
drives the pitch drop, the click and the fade.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 9:00 (80 Hz) · RESONANCE 10:00 (30 %) · VCF MOD AMOUNT 11:00 (40 %) · VCO MOD AMOUNT 2:00 (70 %, EG ≈ +2.2 oct) · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY 1:00 (222 ms) · VC MIX 7:00 · VOLUME 3:00 (80 %) · TEMPO 1:35 (120 BPM) |
| Switches | PULSE · EG/VCO MOD · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | none |
| Sequence | 16 @ 120, gates 2/8: `1 G1 A · 5 G1 · 9 G1 · 13 G1 · 15 G1`; others rest |

### C02 · Bass / Slow-PWM Pulse Bass
*Our design (goal: a modulated bass).* A slow triangle sweeps the pulse width, and the EG plucks
the filter.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 11:00 (40 %) · MIX 7:00 · CUTOFF 10:00 (159 Hz) · RESONANCE 10:00 (30 %) · VCF MOD AMOUNT 12:00 (50 %) · VCO MOD AMOUNT 11:00 (40 %, PW ±18 %) · GLIDE 8:30 (45 ms) · LFO RATE 9:00 (0.51 Hz) · ATTACK 7:00 · DECAY 1:30 (341 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 1:20 (110 BPM) |
| Switches | PULSE · LFO · PULSE WIDTH · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | none |
| Sequence | 16 @ 110, gates 4/8: `1 C2 A · 3 C2 · 4 C3 · 6 C2 · 7 D#2/8 · 8 F2 G · 9 C2 A · 11 G1 · 12 A#1 · 13 C2 · 14 F2/8 · 15 G2 G · 16 G2`; others rest |

### C03 · Sequence / Key-Tracked Resonant Arp
*Our design (goal: a sequenced filter).* KB → VCF CUTOFF moves the resonant peak with every step,
so each note sings the same harmonic, and CUTOFF picks which one. This is the manual's
favourite cable: KB → VCF CUTOFF appears in five of its nine sheets.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 11:30 (448 Hz) · RESONANCE 2:00 (70 %) · VCF MOD AMOUNT 9:00 (20 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY 12:30 (144 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 1:50 (128 BPM) |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · EG |
| Cables | KB → VCF CUTOFF |
| Sequence | 16 @ 128, gates 3/8: `C2 A · G2 · C3 · D#3 · F2 · C3 · G2 · A#2 · C2 A · G2 · C3 · D#3 · G3 · F3 · D#3 · C3` |

### C04 · Drums / Accent-Switched Kick and Snare
*Our design (goal: an analog kick and snare from one voice).* ASSIGN = Accent goes into MIX CV.
+5 V moves MIX halfway toward noise (M32 p.48: ±5 V around centre is the full sweep), so
accented steps become snares. The internal accent adds snap.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 10:00 (159 Hz) · RESONANCE 9:00 (20 %) · VCF MOD AMOUNT 1:00 (60 %) · VCO MOD AMOUNT 1:00 (60 %) · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY 12:30 (144 ms) · VC MIX 7:00 · VOLUME 3:00 · TEMPO 12:55 (100 BPM) |
| Switches | PULSE · EG/VCO MOD · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Setup | **ASSIGN = 1 Accent** (Accent Out CV Only left OFF) |
| Cables | ASSIGN → MIX CV |
| Sequence | 16 @ 100, gates 2/8: `1 F1 · 5 D3 A · 9 F1 · 11 F1 · 13 D3 A · 16 D3`; others rest |

### C05 · Sequence / Palm-Muted 16ths
*Our design (goal: a chugging line).* Steady 16ths with short gates under SUSTAIN ON, and
tresillo accents.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 9:30 (112 Hz) · RESONANCE 11:00 (40 %) · VCF MOD AMOUNT 12:30 (55 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY 11:00 (40 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 2:05 (135 BPM) |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · EG |
| Cables | none |
| Sequence | 16 @ 135, gates 2/8: `E1 A · E1 · E1 · E1 A · E1 · E1 · E1 A · E2 · E1 · E1 · E1 A · E1 · E1 A · E1 · G1 · A1 R2` |

### C06 · Sequence / Accent-to-Resonance Squelch
*Our design (goal: an accented filter).* The ASSIGN accent gate goes into VCF RES.; +5 V adds
half the resonance travel (p.49), so accented steps squeal.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 10:00 (159 Hz) · RESONANCE 11:00 (40 %, ≈ 90 % on accents) · VCF MOD AMOUNT 1:00 (60 %) · VCO MOD AMOUNT 7:00 · GLIDE 9:00 (80 ms) · LFO RATE 12:00 · ATTACK 7:00 · DECAY 12:00 (94 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 1:45 (124 BPM) |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · EG |
| Setup | **ASSIGN = 1 Accent** |
| Cables | ASSIGN → VCF RES. |
| Sequence | 16 @ 124, gates 4/8: `1 A1 · 2 A1 · 3 A2 A · 4 A1 · 5 C2 · 6 A1/8 · 7 G2 A G · 8 A1 · 9 A1 · 10 E2 A · 11 A1 · 12 G1 · 13 A2 A · 14 A1 · 15 C2/8 · 16 D2 A G` |

### C07 · Sequence / Galloping Pulse Line
*Our design (goal: a gallop).* An eighth and two 16ths per beat (x.xx) on a narrow pulse.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 10:00 (31 %) · MIX 7:00 · CUTOFF 11:00 (317 Hz) · RESONANCE 10:00 (30 %) · VCF MOD AMOUNT 1:00 (60 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY 12:30 (144 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 2:10 (140 BPM) |
| Switches | PULSE · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | none |
| Sequence | 16 @ 140, gates 3/8: `1 D2 A · 2 — · 3 D2 · 4 D2 · 5 F2 A · 6 — · 7 F2 · 8 F2 · 9 C2 A · 10 — · 11 C2 · 12 C2 · 13 A#1 A · 14 — · 15 C2 · 16 C2` |

### C08 · FX / Stepped-Random Melody
*Our design (goal: random sequences).* ASSIGN Step Random (±5 V, a new value each step; p.53)
is split by MULT. One copy, scaled by VC MIX (≈ ±1.5 V), goes to 1V/OCT, which sums with the
sequence. The other copy moves the cutoff. The notes are not quantised.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 12:00 (632 Hz) · RESONANCE 1:00 (60 %) · VCF MOD AMOUNT 11:00 (40 %) · VCO MOD AMOUNT 10:00 (30 %, PWM) · GLIDE 9:30 (125 ms) · LFO RATE 10:00 · ATTACK 7:00 · DECAY 12:30 (144 ms) · VC MIX 10:00 (30 %) · VOLUME 2:00 · TEMPO 1:20 (110 BPM) |
| Switches | PULSE · LFO · PULSE WIDTH · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · EG |
| Setup | **ASSIGN = 8 Step Random**; direction Random optional |
| Cables | ASSIGN → MULT · MULT 1 → MIX 2 · VC MIX → VCO 1V/OCT · MULT 2 → VCF CUTOFF |
| Sequence | 8 @ 110: `1 C3 · 2 C3 · 3 C3/8 · 4 C3 G R2 · 5 C3 · 6 — · 7 C3 A · 8 C3/8` |
| Note | MULT 2 sends the full ±5 V to the cutoff (±5 oct). For gentler motion, swap MULT 2 → VCF CUTOFF for a second attenuated path, or lower CUTOFF |

### C09 · Studio / Drums Follow the Bass
*Community (VP "Cross-modulate DFAM with Mother pitch").* S1's clock cable plus M32 KB → DFAM VCO
1 CV (both 1 V/oct), with DFAM SEQ PITCH MOD OFF, so the DFAM hits follow the bassline's pitch.

| | |
|---|---|
| Mother-32 | as S1 with CUTOFF 10:30 and DECAY 1:30; 8 steps @ 110 BPM, gates 4/8: `1 C2 A · 2 D#2 · 3 G2 · 4 C3 · 5 A#2 A · 6 G2 · 7 F2 · 8 D#2` |
| Cables | M32 ASSIGN → DFAM ADV / CLOCK · M32 KB → DFAM VCO 1 CV |
| DFAM | SEQ PITCH MOD OFF · VCO 1 FREQUENCY about +1 oct (the KB's −2 V at C2 pulls it down) · VCO 1 EG AMOUNT +30 % · VCO DECAY 80 ms · VCO 1 LEVEL 80 % · VCF CUTOFF 2 kHz · RESONANCE 30 % · VCA DECAY 300 ms · VELOCITY 100, 60, 80, 60, 100, 60, 80, 60 |

### C10 · Studio / DFAM Plays the Mother
*Community (the DFAM twin lesson `dfam-st2-mother32`).* DFAM PITCH → M32 VCO 1V/OCT and DFAM
TRIGGER → M32 GATE, with the M32 sequencer stopped.
- **1V/OCT sums with KB** (p.49). Before starting, press the M32's low C in **octave 5**
  (KB = 0 V) so the DFAM's pitch is the only offset, or allow for the default octave-4 KB of −1 V.
- **SUSTAIN OFF** is needed, because the DFAM trigger is about 1 ms long.

| | |
|---|---|
| Mother-32 knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 10:30 (224 Hz) · RESONANCE 11:00 (40 %) · VCF MOD AMOUNT 12:30 (55 %) · VCO MOD AMOUNT 7:00 · GLIDE 8:30 (45 ms) · LFO RATE 12:00 · ATTACK 7:00 · DECAY 1:00 (222 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO n/a |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | DFAM PITCH → M32 VCO 1V/OCT · DFAM TRIGGER → M32 GATE |
| DFAM | TEMPO ≈ 110 BPM · PITCH 1–8 = 0, 0, +12, 0, +7, 0, +10, +3 st · VELOCITY 100, 0, 0, 0, 100, 0, 0, 0 · SEQ PITCH MOD OFF |

### C11 · Bass / Driven Saw Pluck
*Our design.* EG → VCA CV adds to the internal EG and drives the VCA about twice as hard. The
VCA CV is summed (p.48).

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 11:00 (317 Hz) · RESONANCE 12:00 (50 %) · VCF MOD AMOUNT 2:00 (70 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY 12:30 (144 ms) · VC MIX 7:00 · VOLUME 1:00 (60 %) · TEMPO 1:50 (128 BPM) |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | EG → VCA CV |
| Sequence | 16 @ 128, gates 3/8: `1 F1 A · 2 F1 · 3 F2 A · 4 F1 · 5 G#1 · 6 F1 · 7 C2 · 8 F1 · 9 F1 A · 10 D#2 · 11 F1 · 12 C2 R2 · 13 F2 A · 14 F1 · 15 G#1 · 16 A#1` |

### C12 · Drums / Ping-Filter Toms
*Community (adapted from VP's "Ping-filter drum voice").* GATE (out) → EXT. AUDIO: the mixer is
AC-coupled (p.14), so each gate edge arrives as a click that "pings" the nearly-oscillating
ladder. KB → VCF CUTOFF tunes the ring.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 5:00 (EXT only) · CUTOFF 10:00 (159 Hz) · RESONANCE 2:30 (75 %) · VCF MOD AMOUNT 9:00 (20 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY 1:30 (341 ms) · VC MIX 7:00 · VOLUME 3:00 · TEMPO 1:20 (110 BPM) |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | GATE (out) → EXT. AUDIO · KB → VCF CUTOFF |
| Sequence | 16 @ 110, gates 1/8: `1 C2 A · 4 G2 · 7 C2 · 9 D#2 A · 11 C3 · 12 G2 · 14 C2 · 16 A#2`; others rest |

### C13 · Drums / High-Pass Noise Hats
*Our design.* Noise through HI PASS with RESONANCE at 0 (any resonance would bring lows back,
p.15). Very short AD, accents on the off-beats, ratchet rolls.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 5:00 · CUTOFF 3:00 (5 kHz) · RESONANCE 7:00 (0) · VCF MOD AMOUNT 7:00 · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY 11:00 (40 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 1:35 (120 BPM) |
| Switches | SAW · LFO · FREQUENCY · HI PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | none |
| Sequence | 16 @ 120, gates 1/8, note C4: `1 · 3 A · 5 · 7 A · 9 · 11 A · 13 · 14 R2 · 15 A · 16 R3`; others rest |

### C14 · Lead / Filter-Sine Second Voice
*Based on the manual's sine-oscillator tip (p.15); also VP.* LOW PASS with RESONANCE at full. KB →
VCF CUTOFF tracks the sine. A 0 V source in EXT. AUDIO stands in for the manual's dead cable:
VC MIX fully CCW outputs 0 V, which helps if the twin cannot leave a cable dangling. With MIX at
noon the saw plays under the whistle. MIX fully CW gives a pure sine (the manual's version).

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 12:00 · CUTOFF ≈ 12:45 (≈ 1.05 kHz: about two octaves above the note at C4; tune by ear) · RESONANCE 5:00 · VCF MOD AMOUNT 7:00 · VCO MOD AMOUNT 8:30 (15 %, vibrato) · GLIDE 9:00 (80 ms) · LFO RATE 12:00 · ATTACK 9:00 · DECAY 2:00 (525 ms) · VC MIX 7:00 (0 V) · VOLUME 12:00 · TEMPO 12:55 |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · EG |
| Cables | VC MIX → EXT. AUDIO · KB → VCF CUTOFF |
| Sequence | 8 @ 100, gates 6/8: `1 C4 A · 2 D#4 · 3 G4 · 4 A#4/8 · 5 C5 G · 6 A#4 · 7 G4 · 8 D#4` |

### C15 · Lead / Feedback High-Pass Lead
*Based on the manual's HP-resonance tip (p.15); also SOS and VP.* M5's routing used for playing
leads. MIX sets the resonance, and RESONANCE stays fully CCW.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 2:00 (70 % feedback) · CUTOFF 12:30 (893 Hz) · RESONANCE 7:00 · VCF MOD AMOUNT 10:00 (30 %) · VCO MOD AMOUNT 7:00 · GLIDE 8:00 (20 ms) · LFO RATE 12:00 · ATTACK 8:00 · DECAY 1:30 (341 ms) · VC MIX 7:00 · VOLUME 12:00 · TEMPO 1:20 (110 BPM) |
| Switches | SAW · LFO · FREQUENCY · HI PASS · EG · + · TRIANGLE · SUSTAIN ON · EG |
| Cables | VCF → EXT. AUDIO |
| Sequence | 8 @ 110, gates 5/8: `1 C3 A · 2 G3 · 3 C4 · 4 G3 · 5 D#3 A · 6 G3 · 7 A#3 · 8 G3` |

### C16 · Sequence / Ratcheting Acid Line
*Community (VP "Ratcheting acid line").* 4-way ratchets on steps 3 and 7, and the manual's slide
rule: an 8/8 gate, then glide on the next step (p.27).

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 9:30 (112 Hz) · RESONANCE 1:30 (65 %) · VCF MOD AMOUNT 3:00 (80 %) · VCO MOD AMOUNT 7:00 · GLIDE 9:00 (80 ms) · LFO RATE 12:00 · ATTACK 7:00 · DECAY 11:30 (61 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 1:50 (128 BPM) |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · EG |
| Cables | none |
| Sequence | 8 @ 128: `1 C2/4 A · 2 C3/3 · 3 C2/2 R4 · 4 D#2/8 · 5 F2/4 G · 6 C2/3 A · 7 G2/2 R4 · 8 A#1/8` (step 8's tie slides into step 1 only if step 1 has glide) |

### C17 · FX / Random Swoops
*Community, adapted from VP's "Random Krell with VC Mix".* VP's version routes KB into 1V/OCT,
which double-tracks, because 1V/OCT sums with KB (p.49). This one sends ASSIGN's Step Random
into the VCO MOD jack (SOURCE at EG/VCO MOD), where AMOUNT scales it. Each step gets a random
pitch offset, glide smears it, and a slow LFO drifts the filter.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 8:00 (10 % noise) · CUTOFF 12:00 (632 Hz) · RESONANCE 1:00 (60 %) · VCF MOD AMOUNT 9:00 (20 %, LFO) · VCO MOD AMOUNT 11:00 (40 %, about ±0.5 oct from ±5 V) · GLIDE 11:00 (320 ms) · LFO RATE 8:00 (0.23 Hz) · ATTACK 1:30 (197 ms) · DECAY 3:00 (1.25 s) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 11:40 (70 BPM) |
| Switches | SAW · EG/VCO MOD · FREQUENCY · LOW PASS · LFO · + · TRIANGLE · SUSTAIN OFF · EG |
| Setup | **ASSIGN = 8 Step Random**; division 1/8 (KB + STEP + TEMPO); direction Random |
| Cables | ASSIGN → VCO MOD |
| Sequence | 8 @ 70 (1/8), gates 8/8 (legato), glide on every step: `C3 G · G3 G · D#3 G · C4 G · A#3 G · G3 G · F3 G · D#3 G` |

### C18 · FX / Attenuated Filter FM
*Community (VP), and a gentler, melodic relative of M6.* The saw modulates the cutoff at audio rate
through VC MIX used as an attenuator: the saw goes into MIX 2, so MIX 1 = 0 V is the zero point
(p.52).

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 12:00 (632 Hz) · RESONANCE 2:00 (70 %) · VCF MOD AMOUNT 10:00 (30 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY 2:00 (525 ms) · VC MIX 9:30 (25 %: the saw at ±1.25 V) · VOLUME 12:00 · TEMPO 1:20 (110 BPM) |
| Switches | PULSE · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · EG |
| Cables | VCO SAW → MIX 2 · VC MIX → VCF CUTOFF |
| Sequence | 8 @ 110, gates 6/8: `1 C3 A · 2 C3 · 3 G3 · 4 C3 · 5 D#3 A · 6 C3 · 7 A#2 · 8 G2` |

### C19 · Lead / LFO as Second Oscillator
*Community (VP), built on the manual's KB → LFO RATE tip (p.14).* The audio-rate LFO loosely
tracks the keys. VC MIX blends the saw and the LFO triangle into EXT. AUDIO, and MIX is fully CW.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 5:00 · CUTOFF 2:00 (2.5 kHz) · RESONANCE 9:00 (20 %) · VCF MOD AMOUNT 10:00 (30 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 3:30 (≈ 103 Hz; tune by ear) · ATTACK 8:00 · DECAY 2:00 (525 ms) · VC MIX 12:00 · VOLUME 2:00 · TEMPO 12:55 (100 BPM) |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · EG |
| Cables | KB → LFO RATE · VCO SAW → MIX 1 · LFO TRI → MIX 2 · VC MIX → EXT. AUDIO |
| Sequence | 8 @ 100, gates 6/8: `1 C3 · 2 E3 · 3 G3 · 4 B3 · 5 C4 A · 6 B3 · 7 G3 · 8 E3` |

### C20 · Sequence / Triplet-Swing Groove
*Community (VP); this is the manual's own example of straight steps with a triplet swing interval
(p.21).* The steps stay 1/16 while the swing interval is a 1/8 triplet.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 11:00 (40 %) · MIX 7:00 · CUTOFF 11:00 (317 Hz) · RESONANCE 10:00 (30 %) · VCF MOD AMOUNT 1:00 (60 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY 12:30 (144 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 12:55 (100 BPM) |
| Switches | PULSE · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Setup | division 1/16 straight (KB + STEP + TEMPO) · swing interval 1/8 triplet (STEP + GLIDE) · swing SHIFT + TEMPO at about 1:00 (+33 % on the p.29 scale, the "66 %" of the p.21 diagram) |
| Cables | none |
| Sequence | 16 @ 100, gates 3/8: `1 G2 A · 3 G2 · 4 A#2 · 6 G2 · 7 C3 A · 9 G2 · 10 D3 · 12 C3 A · 13 A#2 · 15 G2 · 16 F2`; others rest |

### C21 · Sequence / Step-Address Scanner
*Community (VP), using TEMPO input mode 4 (p.56).* The voltage at TEMPO chooses the step, so a slow
triangle scans up and down the pattern. The manual notes that a ramp plays the pattern in
order. RUN/STOP returns to normal play until the voltage moves again.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 10:00 (31 %) · MIX 7:00 · CUTOFF 12:00 (632 Hz) · RESONANCE 11:00 (40 %) · VCF MOD AMOUNT 12:00 (50 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 9:00 (0.51 Hz, the scan speed) · ATTACK 7:00 · DECAY 1:30 (341 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO (ignored) |
| Switches | PULSE · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Setup | **TEMPO input = 4 Step Address CV** (Setup p.3); TEMPO range ±5 V (default) |
| Cables | LFO TRI → TEMPO |
| Sequence | 8, gates 4/8: `C3 · D3 · E3 · G3 · A3 · C4 · D4 · E4` |

### C22 · Lead / PWM Lead
*Community (the twin's `pwm_lead`, converted).* A slow LFO sweeps the pulse width: the manual's
"chorus-like" PWM (p.13).

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 2:00 (2.5 kHz) · RESONANCE 9:00 (20 %) · VCF MOD AMOUNT 9:00 (20 %) · VCO MOD AMOUNT 12:30 (55 %) · GLIDE 8:45 (≈ 60 ms) · LFO RATE 9:45 (≈ 0.9 Hz) · ATTACK 9:00 · DECAY 2:10 (≈ 600 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 1:35 (120 BPM) |
| Switches | PULSE · LFO · PULSE WIDTH · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · EG |
| Setup | division 1/8 |
| Cables | none |
| Sequence | 8 @ 120 (1/8), gates 7/8: `1 A3 A · 2 C4 · 3 E4/8 · 4 A4 G · 5 G4 · 6 E4 · 7 C4/8 · 8 D4 G` |

### C23 · Lead / Swell with Fade-in Vibrato
*Community (the twin's `delayed_vibrato`, corrected).* VC MIX works as a VCA (p.52): LFO TRI into
MIX 2, the EG into VC MIX CTRL, the knob fully CCW. The EG's 7.5 V gives about 75 % of the
LFO, because 10 V spans the full travel. That goes into the VCO MOD jack, and AMOUNT sets the
maximum depth. The Mother-32 has a single EG, so the loudness swells together with the vibrato.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 11:00 (40 %) · MIX 7:00 · CUTOFF 2:00 (2.5 kHz) · RESONANCE 8:00 (10 %) · VCF MOD AMOUNT 8:00 (10 %) · VCO MOD AMOUNT 10:00 (30 %, max ≈ ±2.4 st) · GLIDE 9:00 (80 ms) · LFO RATE 12:00 (5.9 Hz) · ATTACK 3:30 (0.93 s) · DECAY 2:00 (525 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 12:55 (100 BPM) |
| Switches | PULSE · EG/VCO MOD · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · EG |
| Setup | division 1/4 |
| Cables | LFO TRI → MIX 2 · EG → VC MIX CTRL · VC MIX → VCO MOD |
| Sequence | 8 @ 100 (1/4): `1 C4/8 ~ · 2 C4/7 · 3 D#4/8 ~ · 4 D#4/7 · 5 G4/8 ~ · 6 G4/7 · 7 F4/8 ~ · 8 F4/7` |

### C24 · Pad / Wind Drone
*Community (the twin's `noise_drone`).* VCA MODE ON makes a drone (p.17): noise through a nearly
self-oscillating LP, swept slowly by the LFO.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 5:00 · CUTOFF 12:10 (≈ 700 Hz) · RESONANCE 3:00 (80 %) · VCF MOD AMOUNT 11:30 (45 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 7:30 (≈ 0.15 Hz) · ATTACK 7:00 · DECAY 1:00 · VC MIX 7:00 · VOLUME 12:00 · TEMPO n/a |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · LFO · + · TRIANGLE · SUSTAIN ON · **ON** |
| Cables | none |
| Sequence | none |

### C25 · FX / Laser Zap
*Community (the twin's `eg_zap`, re-routed).* EG → pitch through VCO MOD at full amount. There's
no cable, so no 1V/OCT summing is involved.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 9:55 (30 %) · MIX 7:00 · CUTOFF 3:00 (5 kHz) · RESONANCE 10:00 (30 %) · VCF MOD AMOUNT 9:00 (20 %) · VCO MOD AMOUNT 5:00 (100 %) · GLIDE 7:00 · LFO RATE 12:00 · ATTACK 7:00 · DECAY 1:00 (222 ms) · VC MIX 7:00 · VOLUME 12:00 · TEMPO 12:55 (100 BPM) |
| Switches | PULSE · EG/VCO MOD · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | none |
| Sequence | 8 @ 100, gates 2/8: `1 C3 A · 3 C4 · 5 G3 · 6 C3 · 8 A#3 R3`; others rest |

### C26 · Keys / Audio-Rate FM Bell
*Community (the twin's `audio_fm`); the manual suggests triangle LFO FM at audio rate (p.14).* The
LFO near C4 feeds LIN FM. Add KB → LFO RATE to keep the ratio even across the keyboard.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 12:30 (893 Hz) · RESONANCE 8:00 (10 %) · VCF MOD AMOUNT 11:30 (45 %) · VCO MOD AMOUNT 7:00 · GLIDE 7:00 · LFO RATE 4:40 (≈ 262 Hz) · ATTACK 7:00 · DECAY 3:30 (≈ 1.9 s) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 12:55 (100 BPM) |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Cables | LFO TRI → VCO LIN FM |
| Sequence | 8 @ 100 (1/8), gates 4/8: `1 C4 A · 2 G4 · 3 E4 · 4 C5 · 5 B4 · 6 G4 · 7 D4 · 8 G4` |

### C27 · Bass / Acid Slide
*Community (the 303 technique, using the manual's slide rule, p.27).*

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 10:00 (159 Hz) · RESONANCE 2:00 (70 %) · VCF MOD AMOUNT 1:00 (60 %) · VCO MOD AMOUNT 7:00 · GLIDE 9:30 (125 ms) · LFO RATE 12:00 · ATTACK 7:00 · DECAY 12:00 (94 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 1:45 (124 BPM) |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · EG |
| Cables | none |
| Sequence | 16 @ 124: `1 A1/4 A · 2 A1/3 · 3 A2/8 · 4 G2/4 G · 5 A1/4 · 6 — · 7 C2/4 A · 8 A1/3 · 9 D2/8 · 10 E2/4 A G · 11 A1/3 · 12 A1/3 · 13 G1/4 · 14 A1/8 ~ · 15 A1/8 · 16 C2/4 G` |

### C28 · Sequence / Pendulum Arp
*Synth Studio (direction 3 Pendulum, p.41).* A 6-step minor arpeggio played back and forth, so the
accent drifts against the bar.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 10:30 (36 %) · MIX 7:00 · CUTOFF 12:00 (632 Hz) · RESONANCE 11:00 (40 %) · VCF MOD AMOUNT 11:00 (40 %) · VCO MOD AMOUNT 9:00 (20 %, PWM) · GLIDE 7:00 · LFO RATE 10:00 · ATTACK 7:00 · DECAY 1:00 (222 ms) · VC MIX 7:00 · VOLUME 2:00 · TEMPO 1:55 (130 BPM) |
| Switches | PULSE · LFO · PULSE WIDTH · LOW PASS · EG · + · TRIANGLE · SUSTAIN OFF · EG |
| Setup | direction Pendulum (KB + STEP + Step 3) |
| Cables | none |
| Sequence | 6 @ 130, gates 3/8: `1 C3 A · 2 D#3 · 3 G3 · 4 A#3 · 5 C4 · 6 D#4` (whether the end steps repeat is not documented; the twin should not repeat them) |

### C29 · Drone / Stepped-Random Filter Drone
*Synth Studio.* A VCA ON drone whose cutoff jumps every beat. ASSIGN Step Random, ±5 V, is scaled by
VC MIX to about ±1.5 V (±1.5 oct).

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 9:00 (20 % noise) · CUTOFF 12:00 (632 Hz) · RESONANCE 1:30 (65 %) · VCF MOD AMOUNT 7:00 · VCO MOD AMOUNT 8:00 (10 %, vibrato) · GLIDE 7:00 · LFO RATE 11:30 (3.9 Hz) · ATTACK 7:00 · DECAY 12:00 · VC MIX 10:00 (30 %) · VOLUME 12:00 · TEMPO 12:55 (100 BPM) |
| Switches | SAW · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · **ON** |
| Setup | **ASSIGN = 8 Step Random**; division 1/4; RUN/STOP on |
| Cables | ASSIGN → MIX 2 · VC MIX → VCF CUTOFF |
| Sequence | 8 @ 100 (1/4): all `C2` (with VCA ON the gates don't matter; the sequence only clocks the random) |

### C30 · FX / Siren
*Community.* A slow triangle LFO gives wide pitch sweeps over a VCA ON drone.

| | |
|---|---|
| Knobs | FREQUENCY 12:00 · PULSE WIDTH 12:00 · MIX 7:00 · CUTOFF 3:00 (5 kHz) · RESONANCE 9:00 (20 %) · VCF MOD AMOUNT 7:00 · VCO MOD AMOUNT 2:00 (70 %, ±1.5 oct) · GLIDE 7:00 · LFO RATE 9:00 (0.51 Hz) · ATTACK 7:00 · DECAY 12:00 · VC MIX 7:00 · VOLUME 12:00 · TEMPO n/a |
| Switches | PULSE · LFO · FREQUENCY · LOW PASS · EG · + · TRIANGLE · SUSTAIN ON · **ON** |
| Cables | none |
| Sequence | none |

---

## Converting to the twin (`presets.ts`)

The ids are those in `signal-flow.md` §15. Switch values are UP-first labels (§1.1), so map them
to each switch's option index.

| Hardware | Twin id | Value |
|---|---|---|
| FREQUENCY | `frequency` | octaves −1.05…+1.05 |
| PULSE WIDTH | `pulse_width` | % (2–98) |
| MIX | `mix` | % toward NOISE/EXT |
| CUTOFF | `cutoff` | Hz |
| RESONANCE | `resonance` | % |
| VCF MOD AMOUNT / POLARITY | `vcf_mod_amount` (0–100) / `vcf_mod_polarity` (+, −; new) | |
| VCO MOD AMOUNT | `vco_mod_amount` | % |
| GLIDE, ATTACK, DECAY | `glide`, `attack`, `decay` | ms |
| LFO RATE | `lfo_rate` | Hz |
| VC MIX, VOLUME | `vc_mix`, `volume` | % |
| TEMPO | `tempo` | BPM 20–300 |
| VCO WAVE | `vco_wave` | PULSE / SAW |
| VCO MOD SOURCE | `vco_mod_source` | EG (EG/VCO MOD) / LFO |
| VCO MOD DEST | `vco_mod_dest` | PULSE WIDTH / FREQUENCY |
| VCF MODE | `vcf_mode` | HP / LP |
| VCF MOD SOURCE | `vcf_mod_source` | EG / LFO |
| LFO WAVE | `lfo_wave` | SQUARE / TRIANGLE |
| SUSTAIN, VCA MODE | `sustain` (ON/OFF), `vca_mode` (ON/EG) | |
| ASSIGN | `assign_source` | 1–16 |
| Octave | engine/keyboard state | 1–8, default 4 |
| Division, swing, direction, TEMPO-in mode | pattern and Setup data (`signal-flow.md` §11.8) | |

Worked example, M9 (Feedback-Filter Kick):

```ts
settings: { frequency: 0, pulse_width: 2, mix: 100, cutoff: 80, resonance: 100, vcf_mod_amount: 50,
  vcf_mod_polarity: '+', vco_mod_amount: 0, glide: 0, lfo_rate: 0.1, attack: 1.25, decay: 40,
  vc_mix: 0, volume: 50, vco_wave: 'PULSE', vco_mod_source: 'LFO', vco_mod_dest: 'FREQUENCY',
  vcf_mode: 'HP', vcf_mod_source: 'EG', lfo_wave: 'TRIANGLE', sustain: 'OFF', vca_mode: 'EG' },
patchConnections: [{ from: 'out_vcf', to: 'in_ext_audio' }, { from: 'out_kb', to: 'in_vcf_cutoff' }],
// octave 3; demo steps 1, 5, 9, 13, 16 = C2, gate 2/8, step 1 accented
```
