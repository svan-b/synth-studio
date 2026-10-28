# Moog DFAM - hardware reference for the digital twin

Ground truth used to build `devices/dfam`. Every control, LED and patch point is listed with its
printed label, section, position, cap, range and (for jacks) its normal, plus a source and a
confidence level.

- **verified**: quoted from the Moog manual or Moog support, or two independent sources agree.
- **likely**: one good secondary source, or a direct consequence of verified facts.
- **guess**: not documented anywhere we could reach. These values were chosen by ear to match
  the documented behaviour, and are listed again in "Model choices" so they can be checked against a unit.

`docs/reference/dfam/` does not exist, so there were no photos to read. The network blocks the
manufacturer's site and the manual mirrors, so manual text comes from search-engine excerpts of the
manual. The manual's preset pages are knob diagrams, and their exact positions could not be read.

## Sources

| Id | Source |
|----|--------|
| M | Moog *DFAM User's Manual* (`cdn.inmusicbrands.com/Moog/DFAM/DFAM_Manual.pdf`, 44 pages; Presets & Patch Sheets from p.33), quoted through search excerpts |
| MS | Moog support FAQ: "How do I sync DFAM & Mother-32?" and "Can I change DFAM's note length?"; Moog sync sheet `Syncing_DFAM_With_Mother_32.pdf` |
| V | VoltPages module sheet `src/data/modules/moog-music--dfam.json` (github.com/ogabrielluiz/voltpages). It is compiled from M and MS, and its author marks it `verified: true` |
| SOS | Sound On Sound, *Moog DFAM* review |
| R | Moog spec text as published by retailers: 2 VCOs (square and triangle), white noise and external input, 20 Hz–20 kHz switchable LP/HP 4-pole transistor ladder, ±5 octave frequency control, 8 steps with pitch and velocity, 24 jacks, 60 HP |
| K | Aftermarket "33-piece DFAM knob kit" listings (16 sequencer knobs and 17 others), plus a Moog-forum owner's cap sizes ("small" for the 16 step knobs, "mini" for the 3 mixer knobs) |
| F | Forum reports (Moog forum, ModWiggler, Elektronauts, Gearspace), seen through search excerpts |
| L | Positions in the first build of this twin, read from the manual's panel diagram (p.5) and patch-bay chart |

## Panel

- 60 HP Eurorack panel (304.8 × 128.5 mm) in wooden end cheeks. The twin draws a 305 × 116.5 mm
  faceplate, because the cheeks and rails are drawn separately. **verified** (R, V; Eurorack standard).
- Left to right: VCO EG and VCO 1 / VCO 2 (two rows), the mixer column, the VCF, and the VCA. Below
  them on the left are the transport and the 8-step sequencer. The 24-jack patch bay sits on the
  right. **likely** (L, M).
- Knob caps: there are 33 knobs. 14 are large (all main controls and TEMPO), the 3 mixer knobs are
  the smallest, and the 16 sequencer knobs are small. **likely** (K). The twin's caps are 17.8 mm,
  8.9 mm and 9.4 mm. These are *guesses*, kept at least 8 mm for touch, and all are drawn in the
  silver Moog style the first build used.
- Printed legends are white on black. On this panel they are long ("VCO 1 EG AMOUNT"), so the twin
  prints them on two lines above each large knob. The line breaks are a **guess**.

## Controls

Positions are the twin's coordinates in mm (x, y), taken from L, with the right-hand group evenly
spaced. Ranges are those of the hardware. "Twin" gives the value units used in `spec.ts`.

### VCO EG and VCOs

| Printed label | Section | Position | Cap | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| VCO DECAY | VCO EG | row 1, far left (20, 18) | large | ~10 ms – 10 s decay of the pitch envelope; no effect when both EG AMOUNT knobs are at noon | 10–10000 ms, log | M, V | range **likely** (VCF DECAY is documented as 10 ms–10 s; V says "audio-rate to several seconds") |
| SEQ PITCH MOD | VCO EG | row 1, between VCO DECAY and VCO 1 EG AMOUNT (36, 35) | 3-way toggle | UP: VCO 1&2 · CENTER: OFF (PITCH still at the jack) · DOWN: VCO 2 | 0/1/2 | M, V, bonedo review | **verified** |
| VCO 1 EG AMOUNT | VCO EG | row 1 (52, 18) | large | bipolar, noon = 0; CW = pitch jumps up and falls, CCW = dips and rises | −100…+100 % | M, V | **verified** (range in octaves: guess, see below) |
| VCO 1 FREQUENCY | VCO 1 | row 1 (84, 18) | large | ten-octave range (±5 octaves) | −5…+5 oct, noon = C3 | M, R | range **verified**; noon pitch **guess** |
| (wave) VCO 1 | VCO 1 | right of VCO 1 FREQUENCY (104, 27) | 2-way toggle | UP: square · DOWN: triangle | SQR/TRI | V, R | **verified** |
| 1→2 FM AMOUNT | VCOs | row 2, far left (20, 48) | large | linear FM of VCO 2 by VCO 1, clearest with sync off; sums with the 1→2 FM AMT jack | 0–100 % | V, M | **verified** (depth in modulation index: guess) |
| HARD SYNC | VCOs | row 2, between the knobs (36, 64) | 2-way toggle | ON (VCO 2 resets to VCO 1) / OFF; VCO 2 may go quiet when set below VCO 1, especially on square | ON/OFF | V, M | function **verified**; which way is up: **guess** |
| VCO 2 EG AMOUNT | VCO EG | row 2 (52, 48) | large | bipolar like VCO 1 | −100…+100 % | M, V | **verified** |
| VCO 2 FREQUENCY | VCO 2 | row 2 (84, 48) | large | ten octaves; a timbre control when synced | −5…+5 oct | M, R, V | **verified** |
| (wave) VCO 2 | VCO 2 | (104, 57) | 2-way toggle | UP: square · DOWN: triangle | SQR/TRI | V, R | **verified** |

### Mixer

| Printed label | Section | Position | Cap | Range | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| VCO 1 LEVEL | Mixer | top of the mixer column (124, 20) | small (mini) | off – full; square sounds louder than triangle | 0–100 % | V, K | **verified** |
| NOISE / EXT LEVEL | Mixer | middle (124, 38) | small (mini) | white noise, or EXT AUDIO when patched | 0–100 % | V, M | **verified** |
| VCO 2 LEVEL | Mixer | bottom (124, 56) | small (mini) | off – full | 0–100 % | V, K | **verified** |

### VCF

| Printed label | Section | Position | Cap | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| (mode) HP / LP | VCF | left of CUTOFF (140, 27) | 2-way toggle | UP: HP · DOWN: LP; both 4-pole (24 dB/oct) | HP/LP | V, R | **verified** |
| CUTOFF | VCF | row 1 (154, 18) | large | 20 Hz – 20 kHz | 20–20000 Hz, log | R, V | **verified** |
| RESONANCE | VCF | row 1 (177, 18) | large | self-oscillates past ~3 o'clock in LP (a sine); HP scales differently | 0–100 % | V, M | **verified** |
| VCF DECAY | VCF EG | row 2 (154, 48) | large | 10 ms – 10 s | 10–10000 ms, log | M (quoted) | **verified** |
| VCF EG AMOUNT | VCF EG | row 2 (177, 48) | large | bipolar, noon = 0 | −100…+100 % | M, V | **verified** (octaves: guess) |
| NOISE / VCF MOD | VCF | row 2 (201, 48) | large | amount of noise modulating the cutoff; with a cable in VCF MOD it sets that CV's depth (fully CW for full CV control) | 0–100 % | M (quoted), V, F | **verified** |

### VCA

| Printed label | Section | Position | Cap | Range / positions | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| VCA EG | VCA | row 1 (201, 22) | 2-way toggle | FAST = 1 ms attack, SLOW = 100 ms attack (1 ms is the VCO/VCF EG attack too) | FAST/SLOW | M (quoted), SOS | **verified** (which way is up: guess) |
| VOLUME | VCA | row 1, far right (224, 18) | large | output level (VCA jack and main out) | 0–100 % | V | **verified** |
| VCA DECAY | VCA | row 2, far right (224, 48) | large | decay of the VCA EG; fully CCW = almost no sound | 10–10000 ms, log | M, V | behaviour **verified**; range **likely** |

### Sequencer and transport

| Printed label | Section | Position | Cap | Range | Twin | Source | Confidence |
|---|---|---|---|---|---|---|---|
| TRIGGER | Transport | left (15, 76) | small push button | fires all three EGs at the current step's velocity, without advancing | momentary | M (quoted), V | **verified** |
| TEMPO | Transport | (50, 78) | large | 0.7 Hz – 700 Hz, continuously variable; ignored while ADV/CLOCK is patched | 10.5–10500 BPM (16th-note steps), log | M (".7Hz to 700Hz"), V, SOS | **verified** |
| RUN / STOP | Transport | (35, 96), with a red LED | push button | starts/stops from the current step | toggle | M, V | **verified** |
| ADVANCE | Transport | (65, 96) | push button | moves one step (used to park on step 8 before starting) | momentary | MS, V | function **verified**; "does not fire the EGs": **likely** (V) |
| PITCH 1–8 | Sequencer | top row of 8 (x 105–210, y 79) | small | −5 V … +5 V, "extremely wide"; right of centre adds to VCO FREQUENCY | −5…+5 V, shown in semitones | SOS, M, V | **verified** (1 V/oct internal routing: likely) |
| VELOCITY 1–8 | Sequencer | bottom row of 8 (y 93) | small | 0–5 V; sets level (and a little decay) of all three EGs; 0 = silent step | 0–100 % | M (quoted), SOS, V | **verified** |
| 1 … 8 | Sequencer | step numbers above the pitch row | printed | – | – | L | **likely** |

### LEDs

| LED | Position | Behaviour | Source | Confidence |
|---|---|---|---|---|
| RUN / STOP | left of the RUN / STOP button | red, lit while the sequencer runs (in the twin, also while the RUN/STOP jack's gate holds it running) | M (quoted) | **verified** |
| Step 1–8 | between the PITCH and VELOCITY rows | red, the current step. The twin shows it dimly when stopped, so ADVANCE is visible, and flashes on each hit | L, MS (parking on step 8 implies a visible step) | **likely** |

## Patch bay (24 jacks)

Three columns × eight rows. Rows 1–6 read IN | IN | OUT, row 7 is three inputs and row 8 is three
outputs. Output labels are printed white-on-black (inverted). Twin signal convention: 1.0 = 5 V.

| Row/col | Label | Dir | Range | Normal / behaviour | Source | Confidence |
|---|---|---|---|---|---|---|
| 1/1 | TRIGGER | in | 0–5 V pulse (10 V tolerant) | **normalled to the sequencer clock**; a cable replaces it. Fires all three EGs at the current step's velocity without advancing; also drives TRIGGER out | M (quoted), V | **verified** |
| 1/2 | VCA CV | in | 0–8 V | **summed** with the VCA EG (can clip the VCA) | M (quoted) | **verified** |
| 1/3 | VCA | out | ±5 V | main audio, post VOLUME | V | **verified** |
| 2/1 | VELOCITY | in | 0–5 V | **normalled to VELOCITY 1–8**; a cable replaces the knobs for all three EGs | M (quoted), V | **verified** |
| 2/2 | VCA DECAY | in | ±5 V | sums with the knob (set the knob to noon for the widest range); + = longer | V, MS (Quick Hats) | **verified** (1 V = 2× time: guess) |
| 2/3 | VCA EG | out | 0–8 V | the VCA envelope (velocity, VCA DECAY, FAST/SLOW) | M, V | **verified** |
| 3/1 | EXT AUDIO | in | 10 V p-p | **normalled to the noise source** at the mixer; a cable replaces the noise (NOISE / EXT LEVEL sets its level) | V, M | **verified** |
| 3/2 | VCF DECAY | in | ±5 V | sums with the knob | V | **verified** |
| 3/3 | VCF EG | out | 0–8 V | the VCF envelope | V | **verified** |
| 4/1 | NOISE LEVEL | in | 0–8 V | CV added to the NOISE / EXT LEVEL knob; can clip the noise VCA | V | **verified** |
| 4/2 | VCO DECAY | in | ±5 V | sums with the knob | V | **verified** |
| 4/3 | VCO EG | out | 0–8 V | the VCO envelope | V | **verified** |
| 5/1 | VCF MOD | in | ±5 V | **normalled to noise** through the NOISE / VCF MOD knob; a cable replaces the noise; the only direct CV path to the cutoff | M (quoted), V, F | **verified** |
| 5/2 | VCO 1 CV | in | ±5 V, 1 V/oct | sums with VCO 1 FREQUENCY | M, V | **verified** |
| 5/3 | VCO 1 | out | ±5 V | VCO 1 (selected waveform) | V | **verified** |
| 6/1 | 1→2 FM AMT | in | 0–8 V | CV added to the 1→2 FM AMOUNT knob | V | **verified** |
| 6/2 | VCO 2 CV | in | ±5 V, 1 V/oct | sums with VCO 2 FREQUENCY | M, V | **verified** |
| 6/3 | VCO 2 | out | ±5 V | VCO 2 (selected waveform) | V | **verified** |
| 7/1 | TEMPO | in | ±5 V | sums with the TEMPO knob; the clock is a VCO, so this reaches audio rate (1 V/oct) | M (quoted), V, MS | **verified** (1 V/oct: likely) |
| 7/2 | RUN / STOP | in | 0–5 V gate (10 V tolerant) | the sequencer plays while the gate is high | M (quoted), V | **verified** |
| 7/3 | ADV / CLOCK | in | 0–5 V (10 V tolerant) | **normalled to the internal clock**: patched, TEMPO is ignored and each rising edge advances one step. Press RUN / STOP first: pulses play only while the sequencer runs | M (quoted), MS, F | **verified** (silent while stopped: likely, F) |
| 8/1 | TRIGGER | out | 0–5 V, ~1 ms | the trigger that fires the EGs (clock normal or the TRIGGER jack) | V, M | **verified** |
| 8/2 | VELOCITY | out | 0–5 V | the current step's VELOCITY knob | V | **verified** |
| 8/3 | PITCH | out | ±5 V | the current step's PITCH knob, live even with SEQ PITCH MOD off | V, SOS | **verified** |

## Behaviour notes

- **Envelopes.** All three are attack/decay. Attack is 1 ms (the VCA can be 100 ms). They retrigger
  on every step, and velocity sets their level and stretches their decay a little. Twin: an RC attack,
  then an exponential decay that falls 60 dB over the DECAY time. Velocity also scales decay by
  2^(0.75·(v−1)). **likely** (M: "both Amplitude and Decay Time"; the curve is a guess).
- **Starting.** On RUN the clock fires at once and the sequencer advances before it plays, so a
  sequencer parked on step 8 starts on step 1. This is why Moog says to set step 8 with ADVANCE.
  **likely** (MS).
- **External clock.** Press RUN / STOP on the DFAM first, then start the master clock (MS). Each
  rising edge then plays one step. The internal clock is not synchronised to it (M).
- **RUN / STOP jack.** The manual says the sequencer "will play from its current pattern location for
  the duration that the voltage is applied". SOS and forum users report that starting it this way
  does not fire the envelopes. The twin follows the manual, so the gate plays as RUN does. The
  reported quirk is noted but not modelled.
- **Tempo from the sequencer.** Patching PITCH or VELOCITY into TEMPO lets the step knobs set the
  length of each step: a higher knob gives a shorter step (MS). The twin does this sample-accurately,
  up to audio rate.

## Model choices (guesses to check against hardware)

| Quantity | Twin value |
|---|---|
| VCO FREQUENCY at noon | C3 (130.8 Hz) |
| VCO EG AMOUNT full scale | ±5 octaves at full velocity (EG 8 V) |
| VCF EG AMOUNT full scale | ±6 octaves |
| NOISE / VCF MOD full scale | 1 V/oct of the noise (±5 V) or of the VCF MOD jack |
| 1→2 FM AMOUNT full scale | index 5 (deviation 5 × VCO 2 frequency, not through-zero) |
| RESONANCE self-oscillation point | ~82 % of travel (k = 5·r, a 4-pole ladder oscillates at k = 4) |
| Decay CV scaling | +1 V doubles the decay time |
| Mixer taper | audio taper (≈ level³) |
| ADV / CLOCK while stopped | pulses are ignored (forum reports differ) |
| Analog drift | ±3 cents per VCO, slow random |

## Presets

The manual's **Presets & Patch Sheets** section (from p.33) has six patches: **Quick Hats**,
**Sequenced Bass**, **FM Toys**, **Filter As An Oscillator**, **Sequencer As An Oscillator** and
**Talking Drum**. The excerpts give their notes: PITCH sets each hat's tightness; SLOW emulates
glide; VCO 2 modulates the cutoff; PITCH tunes the filter; VCO 1 FREQUENCY sets both sequencer rate
and pitch; NOISE / VCF MOD sets how vocal the drum is. They do not give exact knob positions, so each
twin preset is a recreation from those notes and says so.

Moog's other patch material is only reachable by title: the *Moog Sound Studio* videos ("Saw Thru
It", "Bring Tha Noise", "Kix & Popz", "Mother the Drummer", "Grapefruit and Honey") and the
*House of Electronicus* patch book ("Baroque As A Joke", "Deep Bounce", "Lo-Fi"). The DFAM-only
designs inspired by those titles carry our own names, and their descriptions credit the original.
The remaining presets are well-known community techniques. There are 38 presets in `presets.ts`,
including the Init patch. Each one was rendered offline and played in the browser (a run of 2.5 s,
measured at the master) to confirm that it makes sound. Master peaks sit between 0.35 and 0.6.
