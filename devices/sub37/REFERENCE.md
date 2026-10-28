# Moog Sub 37 / Subsequent 37 - hardware reference for the digital twin

Ground truth for `devices/sub37`. The twin is the **Sub 37 panel with the Subsequent 37 sound
engine** (2017: doubled mixer headroom, revised MultiDrive, same panel and menus). Every control,
button, LED, the LCD, the preset and bank buttons, the wheels and the keyboard are listed with
the printed label, section, position, knob class, range and switch positions, plus a source and
a confidence level.

- **verified**: quoted from a Moog manual page, or two independent sources agree.
- **likely**: one good secondary source, or a direct consequence of verified facts.
- **guess**: nothing reachable documents it. The value was chosen to match the documented
  behaviour and is listed again under "Model choices" so it can be checked against a unit.

`docs/reference/sub37/` does not exist, so there were no photos to read. The network blocks the
manufacturer's site, the manual mirrors and the image hosts, so manual text comes from
search-engine excerpts and from an open-source project that cites the Subsequent 37 manual page by
page (source **PS** below).

## Sources

| Id | Source |
|----|--------|
| M37 | Moog *Sub 37 User Manual v1.1* (2014, 62 pp., `cdn.inmusicbrands.com/Moog/BackOffice/SUB_37_MANUAL_v1.1_0.pdf`), quoted through search excerpts of the manual and its manualslib copy |
| MS | Moog *Subsequent 37 User's Manual* (2017, 61 pp.). Page-cited quotes as collected in **PS** |
| QS | Moog *Subsequent 37 Quickstart Guide*, the two-page poster whose lower half is a flat, to-scale legend of the whole control surface. Read through **PS**, which rendered it at 150 dpi and measured every section divider and knob centre |
| PS | `patchscore` (open source), `lib/devices/moog-subsequent-37/{panel,index}.ts`: the QS panel decode (40 knobs found, in the per-section counts the manual's drawings show: 1·2·1·5·5·6·5·5·8·2) and MS ranges cited per page |
| MG | midi.guide *Subsequent 37* parameter list (CC BY-SA 4.0), `public/midi-guide/devices/moog-subsequent-37.json`: 157 parameters with section, CC/NRPN and usage ranges |
| FL | Subsequent 37 factory program names, 16 banks, from a Cubase MIDI device file (GitHub gist "Moog Sub 37 MIDI Device Configuration for Cubase"). PS read 20 of these names at their addresses off a unit at firmware 1.2.0 and all 20 match FL's bank and slot |
| FT | Moog forum transcription of the *Sub 37 Tribute* v1.1 factory list ("Moog Sub 37 patch list?"), via search excerpts; garbled, used only for names and categories |
| R | Reviews: Sound On Sound (2014), MusicRadar, MusicTech, Bedroom Producers Blog, Synthtopia |
| F | Moog forum, Gearspace and ModWiggler threads, via search excerpts |
| LNX | LNX Studio `LNX_MoogSub37.sc` (GitHub): an editor whose sections run Arpeggiator, Glide, Mod 1, Mod 2, Oscillators, Mixer, Filter, Envelope Generators |

## Panel

- Footprint 6.75" H × 26.375" W × 14.75" D (MS p.61; the metric line says 68 cm W, PS argues the
  imperial width is the typo). Wooden end cheeks left and right; the left cheek carries every jack
  (R). **verified**.
- 37-key semi-weighted keybed with velocity and aftertouch, **MIDI 36-72** (C1-C4 in Moog's
  naming, where MIDI 48 is "C3"/Middle C: MS pp.14, 29, 50). Pitch and MOD wheels to the left of the
  keys. **verified** (key range derived by PS from three cited pages).
- **One row of ten sections** across the control surface, three knob rows (centres at 27.5, 79.3
  and 132.2 mm on the QS legend scaled to 680 mm), and a bottom strip carrying KB OCTAVE, BANK and
  PRESET 1-16. Left to right: PROGRAMMING · ARPEGGIATOR · GLIDE · MOD 1 · MOD 2 · OSCILLATORS ·
  MIXER · FILTER · ENVELOPE GENERATORS · OUTPUT. **verified** (QS via PS; the manual's chapter
  order is the same; LNX's editor uses the same order).
- **40 knobs and 74 switches** (MS p.9, R). Every knob is one size except CUTOFF, which is about
  half as large again (QS: 17 mm and 24 mm). **likely** (one decode). Knob style: black Moog caps
  with a white index line, knurled skirt; drawn with the `moog-large` variant. **guess** on the
  exact cap colour.
- The twin draws the faceplate 660 mm wide between 15 mm cheeks: PROGRAMMING is widened from 41 to
  50 mm so the LCD is readable on an iPad, and the other nine sections keep the QS proportions
  (scaled by 0.957). The keyboard band below the controls is our own simplification, as in PS.

Positions below are QS-legend millimetres (x across, y down from the top of the control surface).

### PROGRAMMING (x 0.5-41.9)

| Printed label | Kind | Position | Range / positions | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| (LCD) | 128 × 64 blue backlit display, ~1.5 × 1 in | top (4-39, 6-27) | shows bank, preset, name, category (CAT) and the parameter being edited | `Lcd` custom element | M37 p.12, R (MusicRadar "1.5x1in") | **verified** |
| ◄ / ► (DEC / INC), CURSOR | 3 buttons in a row | under the LCD (y 34-41) | change the highlighted value; move the cursor | LCD buttons | M37 (Programming), QS | **verified** (labels as glyphs: likely) |
| COMPARE / SAVE, MIDI / GLOBAL, PRESET / PANEL-INIT | 6 buttons, 2 columns × 3 | y 47-102 | menus; PRESET held = PRESET EDIT; PANEL/INIT held = init panel | LCD buttons: PRESET, SAVE, GLOBAL (menu pages), PANEL/INIT (hold = init) | M37, QS | **likely** (pairing of the six labels: likely) |
| FINE TUNE | knob | (21.2, 130) | overall reference pitch, no centre detent | `fine_tune` ±100 cents | M37 (Global menu), F, QS | range **guess** |

### ARPEGGIATOR (x 42.9-95.6)

| Printed label | Kind | Position | Range / positions | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| RATE | knob | (61.2, 27.5) | 2-280 BPM; with SYNC lit, clock divisions of the internal or MIDI clock | `arp_rate` (BPM) and `arp_div` (division) on one knob | M37 p.15, MS p.15 | **verified** |
| SYNC / TAP | button | (85.5, 27.5) | lit: lock to MIDI clock; hold 1 s: tap tempo | `arp_sync` | M37 p.15 | **verified** |
| RANGE (−2 −1 0 +1 +2 LEDs) | 2 buttons + 5 LEDs | LEDs y 47, buttons (60, 57) (78, 57) | 7 states: 0&−2, −2, −1, 0, +1, +2, 0&+2 (one press past either end lights two LEDs and spans three octaves) | `arp_oct_range` | MS p.15 via PS, M37 | **verified** |
| BACK / FORTH | button | (60, 73) | plays the pattern forwards then back (C-E-G-E-C); no effect on RND | `arp_back_fwd` | MS pp.16, 40 | **verified** |
| INVERT | button | (78, 73) | interleaves octave passes; no effect at RANGE 0 | `arp_invert` | M37 | **verified** (exact order: guess) |
| PATTERN | 6-position knob | (69.1, 116.1) | UP · DWN · ORDR · RND · SEQ · REC | `arp_pattern` | MS p.16, F ("SEQ 01/01") | **verified** |
| ON / REST | button | (56, 143) | arp on; enters a rest while recording | `arp_on` | QS, M37 | **verified** |
| LATCH / TIE | button | (82, 143) | keeps playing after release; enters a tie while recording | `arp_latch` | M37 p.15, MS p.17 | **verified** |
| (menu) GATE LENGTH, CLOCK DIV, SWING, STEP 1 RESET, END NOTES | PRESET EDIT 1.1 | LCD | gate OFF-100 % (default 50 %), swing 0-100 % (50 = straight) | `arp_gate`, `arp_swing` | MS p.40 | **verified** |
| Step sequencer | 1-64 steps per preset, rests, ties, ratchets | PRESET buttons = steps | REC records from the keys, SEQ plays; a key transposes | `arp_seq` (64-char pattern), `seq_len` | M37 pp.17-20, MS p.17 | **verified** (ratchets not modelled) |

### GLIDE (x 96.6-130.4)

| Printed label | Kind | Position | Range / positions | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| TIME | knob | (113.5, 27.5) | 0-10 calibration; no seconds printed anywhere | `glide_time` 0-10 | MS p.21 via PS, QS, R | **verified** (scale); seconds **guess** |
| OSC (LEDs 1, 2) | button + 2 LEDs | LEDs y 47, button y 57 | 1+2 / 1 / 2 | `glide_osc` | M37, MS p.21 | **verified** |
| TYPE (LEDs LCR, LCT, EXP) | button + 3 LEDs | LEDs y 70, button y 80 | LCR constant rate, LCT constant time, EXP fast then slowing | `glide_type` | M37, MS p.21, R (SOS) | **verified** |
| GATED | button | y 96 | glide only while a key is held | `glide_gated` | M37 | **verified** |
| LEGATO | button | y 112 | glide only between overlapping notes (with ON) | `glide_legato` | M37, MS p.21 | **verified** |
| ON | button | y 130 | glide on/off without changing TIME | `glide_on` | M37 | **verified** |

### MOD 1 (x 131.4-210.1) and MOD 2 (x 211.1-290.1)

Two identical busses side by side. MOD 1's depth follows the mod wheel by default; MOD 2 is always
on (M37 p.22, F: "MOD 1 menu's MOD WHEEL is set to 100 %" on the init patch). **verified**.

| Printed label | Kind | Position (MOD 1; MOD 2 is +79.8 mm) | Range / positions | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| RATE (LFO RATE) | knob | (152.4, 27.5) | 0.1-100 Hz; HI RANGE ×10 = 1-1000 Hz; SYNC: clock divisions (21, 4 whole notes to 1/64T) | `mod1_rate` Hz, `mod1_div` division | M37 p.22, F (Moog staff on HI RANGE), MS pp.22-23, 52 | **verified** |
| SOURCE | 6-position knob | (190.1, 27.5) | TRI · SQR · SAW · RAMP · S&H · F.EG/PGM | `mod1_source` | M37 (fully CCW = triangle), MS p.61, MG | **verified** |
| HI RANGE, SYNC, KB RESET | 3 buttons | y 55.9 at x 152.4, 171.0, 190.1 | ×10 rate; lock to clock; LFO restarts on every key | `mod1_hi_range`, `mod1_sync`, `mod1_kb_reset` | M37, MS p.23, MG (CC 76, 93) | **verified** |
| PITCH AMT | bipolar knob | (152.4, 79.3) | −5 … 0 … +5 | `mod1_pitch_amt` | M37 p.23 ("bipolar"), MS p.22 | **verified** (octaves: guess) |
| FILTER AMT | bipolar knob | (190.3, 79.3) | −5 … +5 | `mod1_filter_amt` | M37, MS p.22 | **verified** |
| OSC (LEDs 1, 2) | button | (152.4, 100) | OSC 1+2 / OSC 1 / OSC 2 for PITCH AMT | `mod1_pitch_dest` | M37, MG CC 70 | **verified** |
| CONTROLLERS | button | (190.3, 100) | opens MOD CONTROL: MOD WHEEL, VELOCITY, AFTERTOUCH, CTRL4 amounts, PGM SRC, PGM DEST | LCD page; `mod1_wheel`, `mod1_vel`, `mod1_pgm_src`, `mod1_pgm_dest` | M37, F | **verified** (aftertouch, CTRL4 not modelled) |
| DEST (6 LEDs) | button | (152.4, 132.2) | LFO RATE (of the *other* LFO) · VCA LEVEL · OSC 1 WAVE · OSC 1+2 WAVE (both LEDs) · OSC 2 WAVE · NOISE LEVEL · EG TIME/PGM; hold DEST and move a control to make it the PGM destination | `mod1_dest` | MS p.23, MG CC 91, F | **verified** |
| MOD AMT | bipolar knob | (190.3, 132.2) | −5 … +5 | `mod1_mod_amt` | M37, MS p.22 | **verified** |
| PGM SRC (menu) | option | LCD | FILT EG (default), AMP EG, CONST ON, SINE LFO, NOISE LFO, VELOCITY, OSC 1 PITCH, SEQ NOTE | `mod1_pgm_src` | Moog spec text (retailers), M37 older list, F | **likely** |

### OSCILLATORS (x 291.1-366.7)

| Printed label | Kind | Position | Range / positions | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| OCTAVE (OSC 1) | 4-position knob | (309.6, 27.5) | 16' 8' 4' 2' | `osc1_octave` | MS p.25, MG | **verified** |
| WAVE (OSC 1) | knob | (347.9, 27.5) | continuous: triangle → sawtooth → square → narrow pulse, no steps | `osc1_wave` 0-100 | M37, MS p.25, R | **verified** |
| HARD SYNC | button | (309.6, 47.9) | OSC 2 restarts with OSC 1; little output if OSC 2 is below OSC 1 | `hard_sync` | MS p.26 | **verified** |
| KB RESET | button | (340, 47.9) | both oscillators restart their cycle on each new note | `kb_reset` | MS p.26, MG CC 81 | **verified** |
| OCTAVE (OSC 2) | 4-position knob | (309.6, 79.3) | 16' 8' 4' 2' | `osc2_octave` | MS p.25 | **verified** |
| WAVE (OSC 2) | knob | (347.9, 79.3) | as OSC 1 | `osc2_wave` | MS p.25 | **verified** |
| KB CTRL (LEDs LO, HI) | button + 2 LEDs | LEDs (303, 100), button (316, 100) | HI: OSC 2 top key, OSC 1 bottom · LO: swapped · OFF (no LED): OSC 2 drones | `kb_ctrl` | MS p.26, MG CC 111 | **verified** |
| DUO MODE | button | (345, 100) | two independent pitches through one filter and VCA (paraphonic) | `duo_mode` | MS pp.9, 26 | **verified** |
| FREQUENCY | knob | (309.6, 132.2) | ±7 semitones (fully CW = a fifth); ±3 octaves while KB CTRL is OFF | `osc2_frequency` | M37, MS p.26 | **verified** |
| BEAT FREQ | knob | (347.9, 132.2) | ±3.5 Hz, constant beat rate at every pitch | `beat_freq` | M37 p.26, MS p.26 | **verified** |
| (sub oscillator) | — | — | square, exactly one octave below OSC 1; WAVE never affects it | — | M37 p.27 | **verified** |

### MIXER (x 367.7-429.8)

Five levels staggered in a zig-zag against five on/off buttons (QS). Levels are calibrated 0-10:
*"Mixer settings higher than 5 will overdrive the input of the filter … 5 or below delivers a clean
signal"* (MS p.27). **verified**.

| Printed label | Kind | Position (knob / button) | Range | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| OSC 1 | knob + on button | (386.8, 27.6) / (412, 27.6) | 0-10 | `mix_osc1`, `mix_osc1_on` | MS p.27, MG | **verified** (button: likely) |
| SUB OSC | knob + on button | (412, 52.8) / (386.8, 52.8) | 0-10 | `mix_sub`, `mix_sub_on` | M37, MS p.27 | **verified** |
| OSC 2 | knob + on button | (386.8, 79.5) / (412, 79.5) | 0-10 | `mix_osc2`, `mix_osc2_on` | MS p.27 | **verified** |
| NOISE | knob + on button | (412, 105.1) / (386.8, 105.1) | 0-10, **pink** noise | `mix_noise`, `mix_noise_on` | M37 p.27, MS | **verified** |
| FDBK / EXT IN | knob + on button | (386.8, 130.9) / (412, 130.9) | 0-10; with nothing in EXT IN, *"takes the output of the mixer and feeds it back into this mixer channel"*: distorted, sometimes chaotic, sometimes mellow | `mix_feedback`, `mix_fb_on` | M37 p.27, MS p.27 | **verified** |

### FILTER (x 430.8-497.6)

| Printed label | Kind | Position | Range / positions | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| CUTOFF | **large** knob | (464.1, 29.8), 24 mm | 20 Hz - 20 kHz Moog ladder | `cutoff` | M37, MS p.28, QS | **verified** |
| RESONANCE | knob | (446.9, 79.3) | 0-10; *"Settings above 7 cause the filter to self-oscillate"* | `resonance` | MS p.28 | **verified** |
| MULTIDRIVE | knob | (481.5, 79.3) | 0-10; drives the OTA and FET stages between filter and VCA: asymmetric tube-like warmth to hard clipping | `multidrive` | M37, MS p.28 | **verified** |
| SLOPE (LEDs 6 12 18 24) | button + 4 LEDs | LEDs y 103, button (464.1, 112) | −6, −12, −18, −24 dB/oct (1-4 poles); cycles, changeable while playing | `filter_slope` | M37, MS p.29, MG | **verified** |
| EG AMT | bipolar knob | (446.9, 132.2) | −5 … +5; below centre the envelope pulls the cutoff down | `filter_eg_amt` | M37, MS p.28 | **verified** (octaves: guess) |
| KB TRACK | knob | (481.5, 132.2) | 0 (off) … 1 (1:1 at the halfway point) … 2 (2:1), centred on C3 = MIDI 48 | `filter_kb_track` | M37, MS pp.29, 50 | **verified** |

### ENVELOPE GENERATORS (x 498.6-640.3)

Two DAHDSR rows, FILTER EG above AMP EG. *"When the KNOB SHIFT button (between the filter and
amplitude attack knobs) is pressed and blinking, the first two envelope knobs become DELAY and HOLD
while the third and fourth adjust the amount that keyboard velocity and keyboard tracking affect the
envelope"* (M37). The strip is silkscreened `DELAY  HOLD  VEL AMT  KB TRACK` (QS). **verified**.

| Printed label | Kind | Position | Range | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| ATTACK / DELAY | knob | FILTER (522, 27.4), AMP (522, 105.1) | attack 0.1 ms-10 s (legend `M-SEC .1` … `10 SEC`; the prose says 1 ms); delay 0-10 s | `feg_attack` / `feg_delay` | MS pp.30-33, M37 | **verified** |
| DECAY / HOLD | knob | x 554.2 | decay 0.1 ms-10 s; hold 0-10 s | `*_decay` / `*_hold` | MS, M37 | **verified** |
| SUSTAIN / VEL AMT | knob | x 586.2 | sustain 0-100 % (calibrated 1-10); velocity → envelope amount | `*_sustain` / `*_vel_amt` | MS pp.31-32, M37 | **verified** |
| RELEASE / KB TRACK | knob | x 618.4 | release 0.1 ms-10 s; key tracking of the envelope times (including attack, R: SOS) | `*_release` / `*_kb_amt` | MS, M37, R | **verified** |
| MULTI TRIG, RESET, SYNC, LOOP, LATCH | 5 buttons per row | y ≈ 49.5 (filter) and 127.5 (amp), x 507-633 | MULTI TRIG: every key re-gates (else legato single-trigger); RESET: attack starts from zero (else from the current level); SYNC: restart every clock division; LOOP: repeats while held (multistage LFO); LATCH: stays at SUSTAIN as if the gate were on | `*_multi_trig`, `*_reset`, `*_sync`, `*_loop`, `*_latch` | M37 pp.29-33, MS pp.31-33, MG | **verified** (left-to-right order: guess) |
| KNOB SHIFT | button | (506, 68.6) | blinks while the 8 knobs are shifted | `knob_shift` | M37, QS | **verified** |
| (menu) ATTACK EXP | per envelope | LCD | linear or exponential attack | `feg_attack_exp`, `aeg_attack_exp` | R (SOS), MG NRPN 520 | **verified** |
| (quirk) AMP EG DELAY | — | — | *"only works when envelope LOOP is ON"* | modelled | M37 | **likely** (one excerpt) |

### OUTPUT (x 640.8-679.5)

| Printed label | Kind | Position | Range | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| VOLUME (MASTER VOLUME) | knob | (660, 27.4) | main output level | `master_volume` | M37 p.34, QS | **verified** |
| MUTE | button | (660, 52) | silences the main output | `output_mute` | QS | **likely** |
| HEADPHONES (HEADPHONE VOLUME) | knob | (660, 79.3) | headphone level; mono, same signal as AUDIO OUT (MS p.34) | `phones_volume` (level of the PHONES output jack) | M37, MS p.34 | **verified** |
| PHONES | ¼" TRS jack | (660, 108), front | — | `out_phones` | M37 ("bottom-right corner"), QS | **verified** |

### Bottom strip, wheels and keyboard

| Printed label | Kind | Position | Range | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| KB OCTAVE ▼ ▲ | 2 buttons | (5-31, 143-152) | ±2 octaves; dim LED = 1, bright = 2; both = reset; hold both + key = transpose ±12 | `kb_octave` (UI) | M37 p.14, MS p.14 | **verified** |
| BANK | button | (37-53, 143-152) | BANK then a PRESET button selects bank 1-16 | `preset_bank` (UI) | M37 p.12 | **verified** |
| PRESET 1-16 | 16 buttons with LEDs | one row along the bottom (x ≈ 100-672) | 16 banks × 16 = 256 presets; the LEDs double as the sequencer step display | `preset_number` (UI) | M37 p.12, R (BPB "sixteen LED diodes running along the bottom row") | **verified** (left edge of the row: likely) |
| PITCH wheel | spring-loaded wheel | front left | default +2 / −2 semitones, each 0-24 (PRESET EDIT) | `pitch_bend` (UI), `bend_up`, `bend_down` | M37 (Preset Edit), MG CC 107/108 | **verified** |
| MOD wheel | wheel | right of PITCH | scales MOD 1 by default | `mod_wheel` (UI) | M37 p.22 | **verified** |
| Keyboard | 37 keys C-C | front | MIDI 36-72, velocity + aftertouch | on-screen keys (velocity by touch height) | MS p.61 | **verified** |

### Left side panel (jacks)

| Label | Dir | Twin jack | Source | Confidence |
|---|---|---|---|---|
| AUDIO OUT (¼" TS, mono) | out | the main output (studio routing) | MS p.61 | **verified** |
| EXT IN (¼" TS) | in | `in_ext`: replaces FEEDBACK in the FDBK / EXT IN mixer channel | M37 p.27, MS p.8 | **verified** |
| PITCH, FILTER, VOLUME, KB GATE (CV inputs) | in | `in_pitch` (1 V/oct), `in_filter` (1 V/oct of cutoff), `in_volume` (0-5 V), `in_gate` (gate ≥ 1 V) | MS p.61 ("four CV/gate inputs") | **verified** (scalings: likely) |
| MIDI IN / OUT, USB | — | studio transport and the app's MIDI input | MS pp.7-8 | **verified** |

The original Sub 37 has no CV outputs (the Subsequent 37 *CV* edition adds four). **verified**.

## Signal flow

```
OSC 1 (WAVE morph) ──┬──────────────► MIXER ─► FDBK loop ─► LADDER ─► MULTIDRIVE ─► VCA ─► VOLUME ─► AUDIO OUT
  └ SUB OSC (−1 oct) ─┤   ▲ HARD SYNC   │ ▲          (6/12/18/24)  (OTA/FET)      ▲     └ HEADPHONES ─► PHONES
OSC 2 (WAVE morph) ──┤   │             │ └─ mixer output fed back       ▲        AMP EG (DAHDSR)
PINK NOISE ──────────┘   │             EXT IN replaces the feedback      │ FILTER EG × EG AMT, KB TRACK
                                                                         │ MOD 1/2 FILTER AMT, FILTER CV
MOD 1 / MOD 2: LFO (TRI SQR SAW RAMP S&H) or F.EG/PGM → PITCH AMT (OSC 1/2/both), FILTER AMT,
MOD AMT → DEST (other LFO's RATE, VCA LEVEL, OSC 1/2/1+2 WAVE, NOISE LEVEL, EG TIME/PGM).
MOD 1 depth × mod wheel (default), MOD 2 always on.
```

- **Paraphony.** DUO MODE off: one note, both oscillators on it, last-note priority (LOW and HIGH
  in PRESET EDIT; GLOBAL can override). DUO MODE on: OSC 1 and OSC 2 take the lowest and highest
  held keys (KB CTRL HI; LO swaps them; OFF makes OSC 2 a drone). One filter, one VCA, one pair of
  envelopes for both. **verified** (MS pp.9, 26; M37 key priority).
- **Envelope gating.** Legato playing does not retrigger (single trigger) unless MULTI TRIG is lit.
  RESET makes the attack start from zero. **verified** (M37).
- **Sequencer.** PATTERN at REC: the next key starts a new sequence at step 1; ON [REST] and
  LATCH [TIE] enter rests and ties. PATTERN at SEQ + ON: a key transposes and starts it; LATCH
  keeps it running. **verified** (M37 pp.17-18, MS p.17).

## Factory presets

The Subsequent 37 ships 144 presets in banks 1-9 (banks 10-16 hold "Init Preset"). FL gives every
name by bank and slot; PS read 20 of them on a unit at firmware 1.2.0 (BRASH B@SS 1.04, LOW BASS
1.13, Terror Bass 2.08, UBER_SUB 2.11, FUNK ORGAN 3.01, 5TH IN LINE 3.09, Acid Wiggler 3.13,
CELESTIAL 4.11, DRONE 5.09, DUO ORG 5.10, Duotronic Moogtrons 5.12, Harp C Chord 6.05, Octavia
7.05, SAW LEAD 8.07, SAWTEETH DUO DANCER 8.08, SYNTH GONG 9.01, Triangle Lead 9.08, TRIPLET 5THS
9.11, …) and all match FL. **verified** for names and slots. No parameter data is public: every
twin preset is a recreation designed from its name and category, and says so. FT (Sub 37 Tribute)
adds names such as Rhythmic 5th Filtration, Bomb Bass Tick, Lyrical Theremin and Zaxxor's Revenge,
which also appear in FL's banks 3-9.

## Model choices (guesses to check against hardware)

| Quantity | Twin value |
|---|---|
| WAVE morph | crossfade tri→saw (0-33), saw→square (33-67), then the pulse narrows from 50 % to 10 % (67-100); modulation past the end narrows it to almost nothing (owners report a dropout there, F) |
| Square level against the saw | 0.85 of the saw's peak |
| Mixer gain | (level / 5)^1.5: unity at 5, +9 dB at 10, into the ladder's input tanh |
| FEEDBACK | positive feedback of the mixer output through an AC-coupled (25 Hz), band-limited (5 kHz) path with soft saturation; loop gain 1.25 × (level/10)^1.3, so the top of the knob becomes unstable and chaotic |
| RESONANCE | ladder feedback k = 4 (self-oscillation) at 7.0 on the dial, rising to k = 4.7 at 10 |
| MULTIDRIVE | 1 to 40 × pre-gain into an asymmetric soft clipper that hardens at high gain, 2× oversampled |
| FILTER EG AMT | ±6 octaves at ±5 |
| MOD PITCH AMT | ±2 octaves at ±5, squared taper (fine vibrato at low settings) |
| MOD FILTER AMT | ±5 octaves at ±5 |
| MOD AMT → LFO RATE / VCA / WAVE / NOISE / EG TIME | ±4 octaves of rate · gain 0-2 · ±100 % of WAVE travel · ±10 on the NOISE dial · ±3 octaves of envelope time |
| GLIDE TIME (0-10) | 15 ms × e^(0.6 × dial): 2 ≈ 50 ms (Moog's acid setting), 5 ≈ 300 ms, 10 ≈ 6 s; LCR = that time per octave |
| Envelope VEL AMT | peak = 1 − amt + amt × velocity |
| Envelope KB TRACK | times × 2^(−amt × (note − 48)/12) |
| Envelope curves | attack linear (ATTACK EXP off) or RC; decay and release exponential to −60 dB over the stage time |
| LFO SAW / RAMP | SAW falls, RAMP rises (F) |
| ARP RATE without SYNC | steps at the selected clock division of RATE BPM (default 1/16 at 120 BPM) |
| ARP SYNC with the studio stopped | hardware: silent until MIDI clock arrives; the twin plays at the studio tempo so the arp never goes silent, and locks to the studio transport (from the bar) while it runs. ■ stops it |
| FINE TUNE | ±100 cents |
| Oscillator drift / tolerance | 1.5 cents drift at 0.2 Hz; OSC 2 tolerance ±2 cents (Moog: "highly stable oscillators") |
| Pink noise level | −8 dB against a full-scale saw at the same mixer setting |
| Not modelled | aftertouch and CTRL4 routing, ratchets, COMPARE, user preset SAVE, the GLOBAL menu beyond the twin's pages, MIDI clock output |
