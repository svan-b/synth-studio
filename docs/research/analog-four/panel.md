# Elektron Analog Four MKII: front panel, element by element

- **Primary source:** the A4 MKII User Manual for OS 1.55. Its front-panel overview is **(MAN p.12–13)** with 37 numbered elements; the rear connectors are **(MAN p.13–14)**; the screen is **(MAN p.18)**; the specs are **(MAN p.85)**.
- **Cross-checks:** IMG, a top-down image of a black unit; EMU, the firmware emulator; AH, the OS key table tested on units. Tags are defined in `sources.md` §0.

## 0. Coordinates

- **Frame.** The top panel is seen from the front of the unit. The origin is the **top-left corner** (rear-left). x runs to the right and y towards the player. Units are mm, and positions are element **centres**.
- **How they were measured.** Every position was measured on the manual's panel drawing (MAN p.12). Its panel rectangle is 1074 × 625 px, which is exactly 385 × 224 mm (scale 0.3585 mm/px). The same elements measured on IMG agree **within 3 mm**; IMG runs 2–3 mm smaller in y.
- **Tolerance:** about ±2 mm [likely].
- **No artwork.** These are numbers taken from the drawing, not a tracing (copyright rule 4). Draw the panel in our own style from these facts.
- **Footprint:** W 385 × D 225 × H 82 mm including knobs, jacks and feet; about 2.4 kg; **aluminium enclosure** [verified (MAN p.85)]. The top plate in the drawing is 385 × 224 mm.

## 1. Finish and colours

| Item | Black finish (the manual's default) | Grey finish ("grey devices") | Tag |
|---|---|---|---|
| Panel | Black or charcoal, white printed legends; the rear-connector legends are printed along the top edge; the Elektron logo is at top right | Light grey | Black: verified (IMG). Grey: verified that it exists (MAN p.12–13); colour likely (EMU's grey theme, "after a community drawing") |
| Keys | Dark charcoal keys with the legend printed **on** the key. Unlit legends are grey; lit legends glow (backlit) | Dark keys | Verified (IMG); grey likely (EMU) |
| FUNC key | **Light grey**, standing out from the dark keys | Dark green-grey in EMU's drawing | Verified (IMG); grey guess (EMU) |
| Secondary (FUNC) legends | **Underlined** white text under the key | **Green** text | Verified (MAN p.13) |
| Active PARAMETER page | Key lit **white** for page 1, **dimmed white** for page 2 | **Red** for page 1, **green** for page 2 | Verified (MAN p.12) |
| Knobs | Black caps. MAIN VOLUME and QUICK PERF AMOUNT carry a white position dot (they are pots); TRACK LEVEL and DATA ENTRY have none (endless encoders) | | Verified (IMG); pot vs encoder verified (EMU) |
| Screen | A black glass window. A white-on-black OLED, with a tagline printed above it and the product name printed below it | | Verified (IMG; MAN p.85: 128×64 OLED) |

**Recommendation for the twin:** model the **black** finish, the manual's default description. The grey finish is a variant: swap in red/green page LEDs and green FUNC legends.

## 2. Layout at a glance: rows, left to right (my own schematic)

```
 x mm →   0         50          100          150          200          250          300         350  385
 y≈5    ♫  Main Out  Track 1/2  Track 3/4  Ext In   CV Out A/B  CV Out C/D   MIDI In  MIDI Out·Sync A  MIDI Thru·Sync B  Control In  USB  DC In  Power      (rear legends)
 y≈16                                                                                                          LOGO
 y≈32   (MAIN VOL)  (QUICK PERF)  (TRACK LEVEL)   ┌───────────────┐   (A)    (B)    (C)    (D)    (E)              [T1]   y≈38
 y≈56   [GLOBAL]    [ QPER  ]     [TEMPO]         │  OLED window   │                                               [T2]   y≈57
 y≈66                                             │  x 122–200     │   (F)    (G)    (H)    (I)    (J)              [T3]   y≈76
 y≈94   [FUNC]  [KIT] [SND] [MIX]       [YES]     └──[UP]─────────┘  [ARP][NOTE][OSC1][OSC2][FLTR][AMP][ENV][LFO]   [T4]   y≈94
 y≈114  [PERF]  [TRK] [PTN] [SONG]      [NO] [LEFT][DOWN][RIGHT]           [OCT-] ●●●●●●● [OCT+]          [TRNS]   [FX]   y≈116
 y≈133   ●     ●     ●     ●  (pattern mode)     [CHAIN][SONG M]          [C#][D#]    [F#][G#][A#]                 [CV]   y≈134
 y≈147  [ A  ][ B  ][ C  ][ D  ]
 y≈162  [ E  ][ F  ][ G  ][ H  ]   [REC][PLAY][STOP]                 [C ][D ][E ][F ][G ][A ][B ][C ]              [FILL] y≈163
 y≈186                                                                                                         ●●●● 1:4..4:4
 y≈192  [ 1][ 2][ 3][ 4][ 5][ 6][ 7][ 8][ 9][10][11][12][13][14][15][16]                                       [PAGE] y≈196
```

**Zones:**

- **Left block**, x 15–110: three knobs; GLOBAL, QPER and TEMPO; FUNC with KIT/SND/MIX; PERF with TRK/PTN/SONG; the pattern-mode LEDs; BANK A–H.
- **Centre block**, x 122–200: the screen; YES/NO and the arrows; CHAIN and SONG MODE; the transport.
- **Right block**, x 210–345: DATA ENTRY A–J; ARP, NOTE and the six PARAMETER keys; the octave row; the 13-key keyboard.
- **Far-right column**, x ≈ 361: the logo, the six track keys, FILL, the page LEDs, PAGE.
- **Bottom row**, y ≈ 192: the 16 TRIG keys (x 24 → 339).

## 3. Element by element (MAN p.12–13 numbering)

Legend conventions [verified (MAN p.12–13)]:

- **Key** is the text or icon printed on the key.
- **Below** is printed under it. Underlined text is a FUNC (secondary) function, written "FUNC: …". Plain white text under the PARAMETER keys gives the FX and CV page names.

| # | Element | Type, size (mm) | Key / label | Below (FUNC) | Function (MAN p.12–13 unless cited) | LED | x, y (mm) |
|---:|---|---|---|---|---|---|---|
| 1 | **MAIN VOLUME** | Pot, cap Ø≈12 | label "Main Volume" | — | Level of the main and headphone outputs. Analog; not read by the OS (EMU, AH) | — | 24, 32 |
| 2 | **[GLOBAL SETTINGS]** | Key 11×11 | Gear icon | FUNC: **Save Project** | Opens GLOBAL SETTINGS; FUNC opens SAVE PROJECT; a **long press** opens LOAD PROJECT (also p.22) | Lit while the menu is open (EMU) | 24, 56 |
| 3 | **QUICK PERF AMOUNT** | Pot, Ø≈12 | label "Quick Perf Amount" | — | The amount of the chosen performance macro(s) (p.28). An absolute pot input (EMU) | — | 62, 32 |
| 4 | **[QPER]** | Wide key 18×10 | "QPER" | FUNC: **Mute** | Hold [QPER] and tap [TRIG 1–10] to pick the macros that QUICK PERF AMOUNT drives. FUNC mutes the performance macros (p.27–28) | **Green** while PERFORMANCE mode is active, **off** when it is muted (p.27) | 62, 56 |
| 5 | **TRACK LEVEL** | Endless push-encoder, Ø≈12 | label "Track Level" | FUNC: **Sound Browser** | The active track's level. Also scrolls menus and sets values: tempo (p.39), accent amount (p.52), choosing a sound lock while a trig is held (p.50). FUNC opens the SOUND BROWSER (p.21, p.33). Push makes a macro bipolar (p.27) | — | 101, 32 |
| 6 | **[TEMPO]** | Key 11×11 | Metronome icon | FUNC: **Tap Tempo** | Opens TEMPO; FUNC + [TEMPO] taps (p.39) | — | 101, 56 |
| 7 | **[YES]** | Key 11×11 | "YES" | "Save" (not underlined) | Enter and confirm. [YES] + [KIT]/[SND]/[TRK]/[PTN]/[SONG] quick-saves (p.54, p.83). [PARAMETER] + [YES] randomises the page (p.17) | — | 136, 94 |
| 8 | **[NO]** | Key 11×11 | "NO" | "Reload" (not underlined) | Exit or go back. [NO] + the same keys quick-reloads; [PARAMETER] + [NO] reverts a page (p.17, p.83) | — | 136, 112 |
| 9 | **Screen** | Window ≈78×55 (x 122–200, y 27–82); OLED active ≈56×27 | — | — | 128×64 OLED (p.85). Layout in §4 | — | 161, 54 (OLED 161, 52) |
| 10 | **[ARROW] keys** | 4 keys 11×11 in an inverted T | Chevrons | "µTime −" under LEFT, "µTime +" under RIGHT (not underlined) | Menu navigation. [TRIG] + [LEFT]/[RIGHT] nudges micro-timing (p.40, p.84). [LEFT]/[RIGHT] shift the tempo ±10 % while held (p.39). [UP]/[DOWN] change the decimal in TEMPO (p.39) and the octave (p.36) | — | UP 169, 94; LEFT 152, 112; DOWN 169, 112; RIGHT 185, 112 |
| 11 | **[ARP]** | Key 11×11 | "ARP" | FUNC: **Setup** | ARPEGGIATOR menu; FUNC opens ARP SETUP (p.43–44) | — | 221, 94 |
| 12 | **[NOTE]** | Key 11×11 | "NOTE" | FUNC: **Setup** | NOTE menu, 2 pages (p.44); FUNC opens NOTES SETUP (p.47) | — | 237, 94 |
| 13 | **[PARAMETER] keys** (6) | Keys 11×11 at a 16.3 mm pitch | "OSC1", "OSC2", "FLTR", "AMP", "ENV", "LFO" | FX row: "Ext In", —, "Chorus", "Delay", "Reverb", "LFO". CV row: "CV A", "CV B", "CV C", "CV D", "Env", "LFO" | Switch the active track's pages. A second press opens the sub-page (§5) | Active page: white (page 1) / dimmed white (page 2) on black units; red/green on grey units. Red while a held trig has locks on that page (p.50) | OSC1 253, OSC2 269, FLTR 286, AMP 302, ENV 319, LFO 335; all y 94 |
| 14 | **[OCT−] / [OCT+]** and **<OCTAVE> LEDs** | Two keys 11×11, with 7 LEDs between them (≈5.1 mm pitch) | "OCT−", "OCT+". LED labels −3 −2 −1 (blank) +1 +2 +3 (IMG) | — | Transpose the KEYBOARD by octaves. The range is −5…+5 (p.36) | One LED shows the octave; it is red, and the end LED dims beyond ±3 (EMU) | OCT− 237, 116; LEDs x 255…285 at y 116 (centre LED 270); OCT+ 302, 116 |
| 15 | **DATA ENTRY knobs A–J** | 10 endless push-encoders, Ø≈12, in 2 rows of 5 at a 28.5 mm pitch | "A"…"J" below each | — | Adjust parameters; the knob layout matches the screen (p.18). Push and turn for coarse steps; push to select or confirm (p.25); hold a trig and push a knob to remove that lock (p.50) | — | Row 1 (A–E) y 38, row 2 (F–J) y 66; x 221, 249, 278, 306, 335 |
| 16 | **[TRACK] keys** | 6 wide keys 17×11 in a vertical column | "T1" "T2" "T3" "T4" "FX" "CV" | FUNC: **Mute** under each | Select the active track; FUNC mutes it. Double-press [T1–4] opens the SOUND BROWSER (p.21) | **Red** = active; **green** = audible; **off** = muted; **yellow** = active and muted; **dim red** = the synth track the keyboard still plays while FX is selected (p.13, p.36–37) | x 361; T1 y 38, T2 57, T3 76, T4 94, FX 116, CV 134 |
| 17 | **[TRNS]** | Key 11×11 | "TRNS" | FUNC: **Lock** | Hold + KEYBOARD transposes the note trigs; FUNC locks transpose. [TRNS] + [TRACK] makes a track transposable or not (p.47, p.53) | The <TRANSPOSE> LED is full-bright when locked (p.53) | 335, 116 |
| 18 | **[KEYBOARD] keys** (13) | Upright keys 11×17 in 2 rows | Small LED slit, no text | — | Play sounds and set note values; one octave plus one note, C to C. The first key is [KEYBOARD C1] (p.13, p.36). Default octave: C1 = MIDI note 72 (EMU) | Per-key LEDs (EMU) | Lower row (C D E F G A B C) y 160, x 221, 237, 253, 269, 286, 302, 319, 335. Upper row (C# D# · F# G# A#) y 137, x 229, 245, 278, 294, 310 |
| 19 | **[FILL]** | Key 11×11 | "FILL" | FUNC: **Cue Fill** | Hold for FILL mode; FUNC cues one fill cycle; FUNC + double-press latches (p.51) | Red while held (EMU) | 361, 163 |
| 20 | **<PATTERN PAGE> LEDs** | 4 LEDs | labels "1:4 2:4 3:4 4:4" | — | How many pages the pattern has and which is active; the playing page flashes (p.13, p.39) | Dim = exists, bright = active (EMU); blinking = playing (p.39) | x 353, 358, 363, 369; y 186 |
| 21 | **[PAGE]** | Wide key 17×11 | "PAGE" | FUNC: **Scale** | Selects the edited page in GRID RECORDING; FUNC opens SCALE (p.48). Hold + [TRIG 1–4] sets page playback (p.39) | — | 361, 196 |
| 22 | **[TRIG] keys** (16) | Large keys 18×18 at a 21.0 mm pitch | Numbers 1–16 with an underline bar. Keys **1, 5, 9 and 13 carry a square frame** (beat markers) (IMG, drawing) | Letters **A–P** under keys 1–16: +Drive sound banks in the SOUND BROWSER/MANAGER (p.34). **T1 T2 T3 T4 FX CV** under keys 1–6: performance-mode track mutes (p.27). A bracket "**Quick Performance**" spans keys 1–10: QPER macro selection (p.12, p.28) | Enter trigs and choose patterns (p.13) | RGB per key, by mode (§6) | y 192; x = 24 + 21.0 × (n−1), from 24 to 339 |
| 23 | **[STOP]** | Large key 18×18 | Square icon | FUNC: **Paste** | Stop. A quick [STOP][STOP] also fades the send FX and sends All Sound Off (p.38) | White while stopped (EMU) | 182, 160 |
| 24 | **[PLAY]** | Large key 18×18 | Triangle icon | FUNC: **Clear** | Play; a second press pauses | Green while playing (EMU) | 161, 160 |
| 25 | **[RECORD]** | Large key 18×18 | Circle icon | FUNC: **Copy** | Toggles GRID RECORDING; [RECORD] + [PLAY] = LIVE; [RECORD] + [STOP] = STEP | **Red** in grid recording (p.40); **flashing** in live recording (p.40); **double-blink red** in step recording (p.41); **purple** in Euclidean mode (p.46) | 139, 160 |
| 26 | **[SONG MODE]** | Key 11×11 | Song icon | FUNC: **Edit Song** | SONG mode on/off; FUNC opens SONG EDIT (p.55) | The <SONG> LED lights in SONG mode (p.55) | 169, 134 |
| 27 | **[CHAIN MODE]** | Key 11×11 | Chain icon | FUNC: **New Chain** | CHAIN mode on/off; FUNC creates a new scratch-pad row (p.55) | — | 152, 134 |
| 28 | **[BANK A–H]** | 8 wide keys 18×11 in 2 rows of 4 | "A"…"H" | FUNC: A **Sequential**, B **Direct Start**, C **Direct Jump**, D **Temp Jump** (printed *above* the A–D row, under the LEDs); E **Trig Mute**, F **Accent**, G **Note Slide**, H **Param Slide** (printed *below* the E–H row) | Choose the bank, then a TRIG for the pattern (p.38). FUNC + A–D sets the pattern mode (p.39); FUNC + E–H opens the trig menus (p.51–52) | The current bank lights (EMU). [BANK E]/[BANK F]/[BANK G]/[BANK H] light when a held trig has that attribute (p.51–53) | A 24, 147; B 45, 147; C 66, 147; D 87, 147; E–H at the same x, y 164 |
| 29 | **<PATTERN MODE> LEDs** | 4 LEDs, one above each A–D column | — | — | Which pattern mode is on (p.13). The TEMP JUMP LED flashes when armed and lights when active (p.40) | Red-orange indicator LEDs (IMG) | x 24, 45, 66, 87; y 133 |
| 30 | **[PERF]** | Key 11×11 | "PERF" | FUNC: **Setup** | PERFORMANCE mode; FUNC opens PERFORMANCE SETUP (p.26) | — | 24, 116 |
| 31 | **[KIT]** | Key 11×11 | "KIT" | FUNC: **Save Kit** | KIT menu; FUNC saves the kit (p.24–25) | — | 56, 94 |
| 32 | **[SND]** | Key 11×11 | "SND" | FUNC: **Settings** | SOUND menu; FUNC opens SOUND SETTINGS (p.32, p.35) | Hold [SND] to light the trigs (EMU) | 73, 94 |
| 33 | **[MIX]** | Key 11×11 | "MIX" | FUNC: **Poly Config** | PERFORMANCE MIXER (track levels on A–E); FUNC opens POLY CONFIG (p.28) | — | 90, 94 |
| 34 | **[TRK]** | Key 11×11 | "TRK" | FUNC: **Metronome** | TRACK menu; FUNC opens CLICK TRACK, and holding it for a second toggles the click (p.42, p.48) | — | 56, 116 |
| 35 | **[PTN]** | Key 11×11 | "PTN" | FUNC: **Swing** | PATTERN menu; FUNC opens SWING (p.43, p.53) | — | 73, 116 |
| 36 | **[SONG]** | Key 11×11 | "SONG" | FUNC: **Save Song** | SONG menu; FUNC saves the song (p.57) | — | 90, 116 |
| 37 | **[FUNC]** | Large square key 18×17, light grey on the black unit | "FUNC" with an underline | — | Hold for secondary functions (p.13). Hold FUNC at power-on for the STARTUP menu (p.71) | The key whose secondary function is being used **lights light blue** (p.13) | 24, 91 |
| — | Elektron logo | ≈11×8 | | | | | 361, 16 |

**Measured alignments worth keeping** [verified (MAN p.12 drawing; IMG)]:

- The 8 lower keyboard keys sit **directly under** ARP, NOTE, OSC1, OSC2, FLTR, AMP, ENV and LFO (16.3 mm pitch). The upper keys sit at the midpoints, with no key between E and F.
- DATA ENTRY A and E line up with ARP and LFO (x 221 and x 335).
- The track-key column is x ≈ 361. Its spacing grows between T4 and FX (≈21 mm against ≈19 mm).
- The FUNC, PERF, BANK A/E, GLOBAL, MAIN VOLUME and TRIG 1 columns all share x ≈ 24.

## 4. Screen (MAN p.18) [verified]

- **Hardware:** 128 × 64 pixel OLED (p.85), white on black (IMG). The active area is about 56 × 27 mm (measured), which is a 2.4-inch-class panel [likely]. It sits in a black glass window of about 78 × 55 mm. The window prints "4 Voice Analog Tabletop Synthesizer" above the display and "Analog Four MKII" below it (IMG).
- **Layout of the main view** (MAN p.18):
  1. **Top left:** the active kit, for example `K001:POLY`. While a DATA ENTRY knob turns, the full parameter name shows here instead.
  2. **Top right:** the tempo with one decimal, for example `BPM:120.0`.
  3. **Top right:** the transport symbol (record, play, pause or stop).
  4. **Middle:** up to ten parameter widgets in 2 rows of 5, matching knobs A–J. Widgets are dials, toggles, faders, wave icons, or filter curves spanning two slots (FILTERS page, p.89).
  5. **Bottom right:** the song row and the active pattern, for example `_ _:[A01]`. `_ _:` means the scratch-pad row is active.
  6. **Bottom left:** a level bar for the active track.
  7. **Bottom left:** the track name, for example `T1`.
- **Behaviours:**
  - Holding a PARAMETER key shows every value on that page (p.18).
  - A trig's locked parameters show inverted (p.49).
  - Kit names flash when the kit is not yet linked (p.38).
  - [NO] closes windows (p.18).
- **LED INTENSITY** (LOW/MID/MAX) also sets the screen brightness (p.69).

## 5. PARAMETER key legend matrix [verified (MAN p.12, p.36–37)]

| Key | Synth track (page 1 / page 2) | FX track (row 1 under the key) | CV track (row 2 under the key) |
|---|---|---|---|
| OSC1 | OSC1 / NOISE | EXT IN | CV A |
| OSC2 | OSC2 / OSC 1&2 | — (none) | CV B |
| FLTR | FILTERS | CHORUS | CV C |
| AMP | AMP | DELAY | CV D |
| ENV | ENVF / ENV2 | REVERB | ENV (ENV1 / ENV2) |
| LFO | LFO1 / LFO2 | LFO (LFO1 / LFO2) | LFO (LFO1 / LFO2) |

On the CV track, FUNC + the CV A–D key opens that output's CV CONFIG (p.63).

## 6. LED behaviour reference

**Track keys and PARAMETER keys** are covered in §3: #16 for the track keys and #13 for the PARAMETER keys (white/dimmed white, or red/green on grey units).

**TRIG keys** (RGB) [verified (MAN pages as cited)]:

| Context | Colours |
|---|---|
| GRID RECORDING | **Red** = note trig, **yellow** = lock trig (p.40). Trigs with p-locks **flash rapidly** (p.49); sound-locked trigs flash (p.50) |
| Pattern select ([BANK] + [TRIG]) | **Half-bright red** = pattern holds data, **full-bright red** = active pattern (p.38) |
| STEP RECORDING | The active step **double-blinks green**; a locked trig blinks red (note) or yellow (lock) (p.41) |
| TRIG MUTE menu | Light green = note trigs, darker green = muted (p.51) |
| ACCENT menu | Light magenta = note trigs, darker magenta = accents (p.51–52) |
| NOTE SLIDE menu | Light yellow / darker yellow (p.52) |
| PARAM SLIDE menu | Light blue / darker blue (p.52) |
| PERFORMANCE mode, trigs 1–6 | Full-bright = audible track, dimmed red = muted. Half-bright means a change is pending; half-bright blinking means it will mute (p.27) |
| POLY CONFIG, trigs 1–4 | Half-bright = voice off, full-bright = poly-enabled; they flash to show voice activity (p.29) |
| VOICE ROUTING, trigs 1–4 (to main) and 9–12 (to FX) | Red: full-bright = routed, half-bright = not (p.29). p.67 says lit / unlit instead |
| PAGE held / ARP SETUP | Trigs 1–4 show the playing pages (p.39); trigs show the arp length and position (p.44) |

**Other LEDs:**

| LED | Behaviour | Source |
|---|---|---|
| [RECORD] | Red, flashing, double-blink or purple, as in §3 #25 | MAN p.40–41, p.46 |
| [PLAY] / [STOP] | Green while playing / white while stopped | EMU (OS palette) |
| [QPER] | Green when PERFORMANCE mode is active, off when muted | MAN p.27 |
| [FUNC] combinations | The target key lights light blue | MAN p.13 |
| <PATTERN MODE>, <PATTERN PAGE>, <OCTAVE> | Small round indicator LEDs: red-orange, dim when off (IMG; EMU) | MAN p.13, p.39–40 |
| <TRANSPOSE>, <SONG> | Lit when the mode is on | MAN p.53, p.55 |
| Brightness | GLOBAL > SYSTEM > LED INTENSITY: LOW, MID, MAX | MAN p.69 |

## 7. Rear connectors [verified (MAN p.13–14, p.85)]

**Seen from behind, left to right.** Jacks sit in stacked pairs (upper and lower):

| # | Connector | Notes |
|---|---|---|
| 1 | POWER switch | |
| 2 | DC IN | 12 V DC, 2 A; Elektron PSU-3b |
| 3 | USB | High-speed USB 2.0, type B, electrically isolated. Overbridge or class-compliant audio and MIDI (p.20, p.69) |
| 4 | Control In 1 (upper) and 2 (lower) | Two 1/4" EXP/CV IN jacks. The tip takes −5…+5 V; the ring supplies +5 V (p.85) |
| 5 | MIDI THRU / SYNC B | Can carry DIN sync 24/48 (p.59) |
| 6 | MIDI OUT / SYNC A | Can carry DIN sync 24/48 (p.59) |
| 7 | MIDI IN | |
| 8 | CV/Gate Out A–D | Four 1/4" jacks: C and A upper, D and B lower; −10…+10 V |
| 9 | Ext In L (upper) and R (lower) | 1/4", unbalanced, 9 kΩ, +19 dBu maximum |
| 10 | Track Out 1–4 | Four 1/4" **stereo** voice outputs (TRS, or mono plug): 3 and 1 upper, 4 and 2 lower |
| 11 | Main Out L (upper) and R (lower) | 1/4", impedance balanced (TRS) or unbalanced; +19 dBu |
| 12 | Headphones | 1/4" TRS; +19 dBu, 55 Ω |

**From the front** the order reverses. That is how the legends read along the panel's top edge (IMG, drawing; legend x in mm):

| Legend | x (mm) |
|---|---|
| Headphones icon | 38 |
| Main Out | 56 |
| Track 1/2 | 73 |
| Track 3/4 | 90 |
| Ext In | 108 |
| CV Out A/B | 142 |
| CV Out C/D | 162 |
| MIDI In | 209 |
| MIDI Out · Sync A | 229 |
| MIDI Thru · Sync B | 250 |
| Control In | 274 |
| USB | 295 |
| DC In | 318 |
| Power | 342 |

All legends sit at y ≈ 5.

## 8. MKI vs MKII panel

| | MKI | MKII | Source |
|---|---|---|---|
| Display | 122×32 backlit LCD | A large 128×64 OLED | EMU; MAN p.11, p.85 |
| Keys | Round rubber keys, single-colour LED dots, red secondary labels | Square backlit RGB keys, legends on the keys, underlined (or, on grey units, green) secondary labels | EMU (MKI photos); MAN p.11–13 |
| Keyboard | 8 round white keys that double as KIT, SOUND, TRACK, PATTERN, SONG, CLICK, SWING, GLOBAL, plus 5 black; an OCT LED column of 5 | A dedicated 13-key, 2-row keyboard; [OCT−]/[OCT+]; 7 octave LEDs; dedicated KIT, SND, MIX, TRK, PTN, SONG, GLOBAL and TEMPO keys | EMU; MAN p.12–13 |
| Banks | BANK GROUP + A–D | BANK A–H (8 keys) with 4 pattern-mode LEDs | EMU; MAN p.13 |
| New on MKII | — | [QPER] + QUICK PERF AMOUNT, [FILL], [MIX] (performance mixer / poly config), TRACK LEVEL with Sound Browser | MAN p.12–13 |
| Knobs | LEVEL encoder, MASTER VOLUME pot | TRACK LEVEL encoder, MAIN VOLUME pot, QUICK PERF AMOUNT pot | MAN p.12; EMU |
| PARAMETER keys | PERF/ARP/NOTE "Setup" plus Osc 1 (Ext In/CV A) … LFO | ARP/NOTE "Setup" plus the same six page keys with FX/CV legends | EMU; MAN p.12 |

## 9. OS key names (for remote control and testing) [verified (AH, on units)]

The OS calls the panel keys:

- `FUNC`, `GLOBAL`, `QPER`, `TEMPO`, `KIT`, `SND`, `MIX`, `PERF`, `TRK`, `PTN`, `SONG_MENU` (the [SONG] menu key), `SONG` ([SONG MODE]);
- `YES`, `NO`, `UP`, `DOWN`, `LEFT`, `RIGHT`;
- `ARP`, `NOTE`, `OSC1`, `OSC2`, `FLTR`, `AMP`, `ENV`, `LFO`;
- `FX`, `CV`, `T1`–`T4`;
- `FILL`, `PAGE`, `CHAIN`, `RECORD`, `PLAY`, `STOP`, `OCT_DOWN`, `OCT_UP`, `TRNS`;
- `BANK_A`–`BANK_H`; `KB_C`…`KB_C2` (13 keys, rising by a semitone); `1`–`16`;
- the pushes `A_PUSH`…`J_PUSH` and `LEVEL_PUSH`.

That is 89 keys in total. MAIN VOLUME and power are not keys.

## 10. Uncertainties

1. **Grey-finish colours.** The manual confirms that grey units exist and how their LEDs and legends differ (p.12–13). The exact panel and key colours come only from EMU's community-drawing theme.
2. **Colour of an inactive but audible track key.** The manual says green (p.13, p.37), and so does EMU's palette. IMG (a product render) shows white legends. **Follow the manual: green.**
3. **Position tolerance** is about ±2 mm. The manual drawing is schematic line art, but its proportions match the spec footprint and IMG within 3 mm.
4. **Key heights, travel and knob heights** are not documented. H 82 mm includes the knobs and feet.
5. **Jack positions on the rear** follow the manual's rear drawing order (p.13), not measured millimetres.
