# Analog Four MKII: reference for the twin

What the twin is built from, element by element. The primary source is the
**Elektron Analog Four MKII User Manual for OS 1.55**, cited as
"(A4 MKII manual, p.N)". Everything with such a cite was checked against that
page. The measurements and longer notes behind this file are in
`docs/research/analog-four/` (`panel.md`, `signal-flow.md`, `sources.md`).
Where the manual is silent the twin makes a choice; those rows say
**not in the manual** and what the twin does instead.

Positions are element centres in mm from the faceplate's top-left corner.
They were measured on the manual's panel drawing (A4 MKII manual, p.12), whose
top plate is 385 × 224 mm, and checked within 3 mm against a top-down image of
a black unit. The twin draws the faceplate as 381 × 220 mm inside a 2 mm frame,
so its numbers are the drawing's minus 2 mm (`geometry.ts`).

## Chassis

| Item | Fact | Source |
|---|---|---|
| Size and weight | 385 × 225 × 82 mm including knobs, jacks and feet; about 2.4 kg; aluminium enclosure | (A4 MKII manual, p.85) |
| Screen | 128 × 64 pixel OLED | (A4 MKII manual, p.85) |
| Finishes | Black units light the open page key white (page 1) or dimmed white (page 2); grey units use red and green, and print the FUNC legends green instead of underlined | (A4 MKII manual, p.12, p.13) |
| Twin | The black finish: dark keys with legends on the key, underlined FUNC legends under it, a light grey FUNC key | panel.md §1 (image of a black unit) |

## Front panel: the 37 numbered elements

Numbering as in the manual (A4 MKII manual, p.12-13). "FUNC:" is the underlined
secondary legend under the key.

| # | Element | Twin position (mm) | What it does in the twin | Source |
|---:|---|---|---|---|
| 1 | MAIN VOLUME pot | 22, 30 | Main and headphone level | (A4 MKII manual, p.12) |
| 2 | [GLOBAL SETTINGS], FUNC: Save Project | 22, 54 | GLOBAL menu (MIDI clock receive = studio sync) | (A4 MKII manual, p.12) |
| 3 | QUICK PERF AMOUNT pot | 60, 30 | Drives the macro picked with [QPER] | (A4 MKII manual, p.12, p.28) |
| 4 | [QPER], FUNC: Mute | 60, 54 | [QPER] + [TRIG 1-10] picks the macro; FUNC mutes the macros. Green while the macros act, dark when muted | (A4 MKII manual, p.12, p.27-28) |
| 5 | TRACK LEVEL encoder, FUNC: Sound Browser | 99, 30 | The active track's level; the tempo in TEMPO, the swing in SWING, the accent amount in ACCENT; [FUNC] + TRACK LEVEL opens the SOUND BROWSER | (A4 MKII manual, p.12, p.21, p.39, p.52) |
| 6 | [TEMPO], FUNC: Tap Tempo | 99, 54 | TEMPO menu; FUNC taps (averaged over 4 taps) | (A4 MKII manual, p.12, p.39) |
| 7 | [YES] (Save) | 134, 92 | Closes menus; held, + [PTN] / [TRK] saves the pattern / track | (A4 MKII manual, p.12, p.54) |
| 8 | [NO] (Reload) | 134, 110 | Closes menus; held, + [PTN] / [TRK] reloads the pattern / track | (A4 MKII manual, p.12, p.54) |
| 9 | Screen | window x 120-198, y 25-80 | The OLED, below the tagline and above the product name (layout below) | (A4 MKII manual, p.12, p.18) |
| 10 | [UP] [DOWN] [LEFT] [RIGHT] | 167, 92 / 167, 110 / 150, 110 / 183, 110 | UP/DOWN shift the keyboard octave (the tempo decimal in TEMPO); LEFT/RIGHT shift the tempo ±10 % while held; with a trig held they set its note and micro timing | (A4 MKII manual, p.36, p.39, p.40) |
| 11 | [ARP], FUNC: Setup | 219, 92 | ARPEGGIATOR page | (A4 MKII manual, p.12, p.43-44) |
| 12 | [NOTE], FUNC: Setup | 235, 92 | NOTE page | (A4 MKII manual, p.12, p.44-45) |
| 13 | PARAMETER keys OSC1 OSC2 FLTR AMP ENV LFO | x 251, 267, 284, 300, 317, 333; y 92 | The track's pages; a second press opens the sub page; FX and CV page names printed under them | (A4 MKII manual, p.12, p.36) |
| 14 | [OCT-] / [OCT+] and 7 OCTAVE LEDs | 235, 114 / 300, 114; LEDs x 253-283 | Keyboard octave -5..+5; the LEDs show -3..+3 | (A4 MKII manual, p.12, p.36) |
| 15 | DATA ENTRY knobs A-J | x 219, 247, 276, 304, 333; row 1 y 36, row 2 y 64 | Two rows of five, laid out like the screen's parameters | (A4 MKII manual, p.12, p.18) |
| 16 | [T1] [T2] [T3] [T4] [FX] [CV], FUNC: Mute | column at x 359; y 36, 55, 74, 92, 114, 132 | Select the track; FUNC mutes it | (A4 MKII manual, p.13, p.37) |
| 17 | [TRNS], FUNC: Lock | 333, 114 | Hold + KEYBOARD transposes the note trigs; FUNC locks transpose | (A4 MKII manual, p.13, p.53) |
| 18 | KEYBOARD, 13 keys | lower row y 158 at x 219-333 (under ARP...LFO); sharps y 135 | One octave plus one note, C to C; plays the active track, or with a trig held sets its note | (A4 MKII manual, p.13, p.36) |
| 19 | [FILL], FUNC: Cue Fill | 359, 161 | Hold for FILL (GRID RECORDING off); FUNC cues one cycle | (A4 MKII manual, p.13, p.51) |
| 20 | PATTERN PAGE LEDs 1:4-4:4 | x 351-367, y 184 | Pages the pattern has; the shown one bright; the playing one blinks | (A4 MKII manual, p.13, p.39) |
| 21 | [PAGE], FUNC: Scale | 359, 194 | Next pattern page; FUNC opens SCALE | (A4 MKII manual, p.13, p.48) |
| 22 | [TRIG 1-16] | y 190; x = 22 + 21 (n - 1) | Trigs; with [BANK] patterns; with [QPER] macros; in PERF track mutes. 1, 5, 9 and 13 framed; A-P, T1-CV and the Quick Performance bracket printed under them | (A4 MKII manual, p.12-13) |
| 23 | [STOP], FUNC: Paste | 180, 158 | Stop (below) | (A4 MKII manual, p.13, p.38) |
| 24 | [PLAY], FUNC: Clear | 159, 158 | Play; pressed while playing it pauses | (A4 MKII manual, p.13, p.39) |
| 25 | [RECORD], FUNC: Copy | 137, 158 | GRID RECORDING on/off; [RECORD] + [PLAY] = LIVE RECORDING | (A4 MKII manual, p.13, p.40) |
| 26 | [SONG MODE], FUNC: Edit Song | 167, 132 | SONG mode; FUNC opens the song editor | (A4 MKII manual, p.13, p.55) |
| 27 | [CHAIN MODE], FUNC: New Chain | 150, 132 | CHAIN mode; FUNC starts a new chain | (A4 MKII manual, p.13, p.55) |
| 28 | [BANK A-H] | x 22, 43, 64, 85; y 145 (A-D), 162 (E-H) | Bank, then a trig picks the pattern. FUNC + A-D: pattern mode; FUNC + E-H: TRIG MUTE, ACCENT, NOTE SLIDE, PARAM SLIDE | (A4 MKII manual, p.13, p.38-39, p.51-53) |
| 29 | PATTERN MODE LEDs | x 22, 43, 64, 85; y 131 | Sequential, Direct Start, Direct Jump, Temp Jump | (A4 MKII manual, p.13, p.39-40) |
| 30 | [PERF], FUNC: Setup | 22, 114 | PERFORMANCE mode: knobs A-J are the 10 macros, TRIG 1-6 mute tracks | (A4 MKII manual, p.13, p.26-27) |
| 31 | [KIT], FUNC: Save Kit | 54, 92 | KIT menu (load a kit's sounds, with or without its patterns) | (A4 MKII manual, p.13) |
| 32 | [SND], FUNC: Settings | 71, 92 | SOUND browser; FUNC: VELOCITY MOD and SOUND SETTINGS pages | (A4 MKII manual, p.13, p.35) |
| 33 | [MIX], FUNC: Poly Config | 88, 92 | PERFORMANCE MIXER: track levels on knobs A-E | (A4 MKII manual, p.13, p.28) |
| 34 | [TRK], FUNC: Metronome | 54, 114 | TRACK menu: QUANTIZE, GLOBAL QUANTIZE, RELOAD / SAVE TRACK | (A4 MKII manual, p.13, p.42, p.47) |
| 35 | [PTN], FUNC: Swing | 71, 114 | PATTERN menu: RELOAD / SAVE PATTERN; FUNC opens SWING | (A4 MKII manual, p.13, p.43, p.53) |
| 36 | [SONG], FUNC: Save Song | 88, 114 | Song editor | (A4 MKII manual, p.13, p.57) |
| 37 | [FUNC] | 22, 89 (18 × 17) | Hold for the secondary functions; a mouse tap latches it for the next key; Shift works too. The key whose secondary function is used lights light blue | (A4 MKII manual, p.13) |

Also printed on the panel: the rear connectors' names along the top edge, from
headphones and Main Out at the left to Power at the right (A4 MKII manual,
p.13), and the Elektron mark at the top right (drawn as a plain outline, not
the trademark artwork).

**No LEVEL or DATA knob.** The MKII has TRACK LEVEL (with FUNC: Sound Browser)
and MAIN VOLUME; the twin has no other knob (A4 MKII manual, p.12).

## Screen

| # | What | Twin | Source |
|---:|---|---|---|
| 1 | Active kit name; the full parameter name while a knob turns | Kit / pattern name, replaced by the parameter's name for 1.4 s | (A4 MKII manual, p.18) |
| 2 | Tempo with one decimal | Yes; the studio tempo while synced | (A4 MKII manual, p.18) |
| 3 | Record, play, pause or stop symbol | Yes | (A4 MKII manual, p.18) |
| 4 | Up to ten parameters in the knobs' 2 × 5 layout | Yes; a held trig's locked values show inverted | (A4 MKII manual, p.18, p.49) |
| 5 | Active pattern, with the song row to its left ("_ _:" = scratch pad) | Yes | (A4 MKII manual, p.18) |
| 6 | Level bar of the active track | Yes | (A4 MKII manual, p.18) |
| 7 | Track name | Yes | (A4 MKII manual, p.18) |

The OLED is drawn about 1.2 × its real 56 × 27 mm inside the real-size window,
for legibility (panel.md §4).

## LEDs and key lighting

| Element | Behaviour | Source |
|---|---|---|
| Track keys | Red = active, green = audible, dark = muted, yellow = active and muted; dim red = the synth track the keyboard still plays while FX or CV is active. A song mute of the playing song position shows half-bright | (A4 MKII manual, p.13, p.36-37, p.56) |
| PARAMETER keys | The open page: white, dimmed for its second page. Red while a held trig has locks on that page | (A4 MKII manual, p.12, p.50) |
| Trig keys | Red note trig, yellow lock trig; locks flash (the twin marks them with a dot) | (A4 MKII manual, p.40, p.49) |
| Trig keys, pattern select | Half-bright red = holds data, full-bright red = active | (A4 MKII manual, p.38) |
| Trig keys, TRIG MUTE / ACCENT / NOTE SLIDE / PARAM SLIDE | Trigs light; flagged trigs darker. Green / magenta / yellow / blue | (A4 MKII manual, p.51-53) |
| Trig keys, PERFORMANCE | Full bright = audible, dim red = muted; with FUNC held, half-bright = will unmute, half-bright blinking = will mute | (A4 MKII manual, p.27) |
| BANK E-H with a trig held | Lit when the trig has that flag | (A4 MKII manual, p.51-53) |
| QPER | Green while the macros act, dark when muted | (A4 MKII manual, p.27) |
| FUNC combinations | The target key lights light blue | (A4 MKII manual, p.13) |
| PATTERN PAGE | The playing page blinks | (A4 MKII manual, p.39) |
| PLAY / STOP | Green while playing / white while stopped | not in the manual (the emulator's OS palette) |

## Voice and signal path

Per synth track, one analog voice (A4 MKII manual, p.15, p.110):

```
OSC 1 + SUB 1 ─┐
OSC 2 + SUB 2 ─┼─► FILTER 1: 4-pole ladder low-pass ─► OVERDRIVE ─► FILTER 2: 2-pole multimode ─► VCA (amp envelope) ─► PAN ─► main out
NOISE (digital)┘                                                     │                                                       └► CHO / DEL / REV sends
                                                                     └► the next track's OSC 2 when its WAV is NEI
```

| Block | Fact | Source |
|---|---|---|
| Analog and digital | Oscillators, filters, overdrive and amps are analog; the noise, envelopes and LFOs are digital; the send effects are digital and mixed in before the output stage | (A4 MKII manual, p.15) |
| Waveforms | SAW, TRP (transistor pulse), PUL, TRI, IN L, IN R, FDB (OSC 1) / NEI (OSC 2), OFF. PW reshapes all four waves; selecting a wave keeps PW | (A4 MKII manual, p.72, p.87-88) |
| PW per wave | SAW: a second, phase-shifted saw, single again at the centre or the extremes. TRP and PUL: the width, muted at the extremes. TRI: towards a reversed saw | (A4 MKII manual, p.72) |
| Sub oscillators | 1OCT: square at 1/2 f. 2OCT: square at 1/4 f. 2PUL: 25 % pulse two octaves down. **5TH: 33 % pulse a perfect fifth below, at 2/3 f.** PW and PWM leave the sub alone; WAV OFF leaves the sub on | (A4 MKII manual, p.72-73) |
| LEV | The oscillator and its sub together; 100 is the normal level | (A4 MKII manual, p.73, p.87) |
| FDB (OSC 1) | The ladder output becomes OSC 1's source at LEV1; high levels self-oscillate | (A4 MKII manual, p.73) |
| NEI (OSC 2) | The multimode output of the track before (1 → 2, 2 → 3, 3 → 4); nothing on track 1. The twin keeps the feeding voice's oscillators and filters running while its VCA is closed, like the analog original, so the next track always hears it | (A4 MKII manual, p.73, p.88) |
| AM | Osc 1 switched by osc 2's pulse (AM1), or the reverse (AM2); it still works on FDB, NEI and inputs | (A4 MKII manual, p.73, p.88) |
| Sync | SMD: OFF, 1>2, 2>1, metal; SNC 127 = hard, lower = soft | (A4 MKII manual, p.88) |
| Ladder | 24 dB/oct; cannot be bypassed (open it); about 25 RES is the flattest (and the default) | (A4 MKII manual, p.36, p.73) |
| **Overdrive (bipolar)** | 0 clean; positive = clipping after filter 1; negative = a softer drive inside filter 1 | (A4 MKII manual, p.89) |
| Multimode | LP2, LP1, BP, HP1, HP2, BS, PK; all 2-pole with resonance, the "1-pole" types with a flatter slope | (A4 MKII manual, p.74, p.89) |
| ENV F | Always drives both cutoffs (DEP knobs), plus two free destinations | (A4 MKII manual, p.89, p.91) |
| Noise | S&H, COL (-64 red, -32 pink, 0 white, positive high-passed), FAD (0 constant, + out, - in), LEV | (A4 MKII manual, p.87) |
| Envelope shapes | 12: six shapes, each with and without restart from zero | (A4 MKII manual, p.74-75) |
| LFO modes | FRE, TRG, HLD, ONE, HLF; SPD bipolar (negative plays backwards); 16, 32 or 64 give straight beats | (A4 MKII manual, p.92) |

## Pages and encoder slots

Knob letters A-E are the top row, F-J the bottom row (A4 MKII manual, p.18;
slots per the MIDI tables, p.102-107).

| Page (key) | A | B | C | D | E | F | G | H | I | J | Source |
|---|---|---|---|---|---|---|---|---|---|---|---|
| OSC 1 ([OSC1]) | TUN | FIN | DET | TRK | LEV | WAV | SUB | PW | SPD | PWM | (A4 MKII manual, p.87) |
| NOISE ([OSC1] again) | S&H | COL | FAD | | LEV | | | | | | (A4 MKII manual, p.87) |
| OSC 2 ([OSC2]) | TUN | FIN | DET | TRK | LEV | WAV | SUB | PW | SPD | PWM | (A4 MKII manual, p.88) |
| OSC 1&2 ([OSC2] again) | AM1 | SMD | SNC | BND | SLI | AM2 | TRG | FAD | SPD | VIB | (A4 MKII manual, p.88) |
| FILTERS ([FLTR]) | FRQ | RES | OVR | TRK | DEP | FRQ | RES | TYP | TRK | DEP | (A4 MKII manual, p.89) |
| AMP ([AMP]) | ATK | DEC | SUS | REL | SHP | CHO | DEL | REV | PAN | VOL | (A4 MKII manual, p.90) |
| ENV F / ENV 2 ([ENV], twice) | ATK | DEC | SUS | REL | SHP | LEN | DST | DEP | DST | DEP | (A4 MKII manual, p.91) |
| LFO 1 / LFO 2 ([LFO], twice) | SPD | MUL | FAD | SPH | MOD | WAV | DST | DEP | DST | DEP | (A4 MKII manual, p.92) |
| NOTE ([NOTE]) | NOT | VEL | LEN | µTM | PRB (TRC with a trig held) | ENV F | ENV 2 | LFO 1 | LFO 2 | | (A4 MKII manual, p.45, p.50) |
| ARPEGGIATOR ([ARP]) | MOD | SPD | RNG | LEG | LEN | NO2 | NO3 | NO4 | | | (A4 MKII manual, p.43-44) |
| FX: EXT IN ([OSC1]) | CHO | DEL | REV | PAN | VOL (L) | CHO | DEL | REV | PAN | VOL (R) | (A4 MKII manual, p.93) |
| FX: CHORUS ([FLTR]) | PRE | SPD | DEP | WID | FDB | HPF | LPF | DEL | REV | VOL | (A4 MKII manual, p.94) |
| FX: DELAY ([AMP]) | TIM | X | | WID | FDB | HPF | LPF | OVR | REV | VOL | (A4 MKII manual, p.95) |
| FX: REVERB ([ENV]) | PRE | DEC | FRQ | GAI | | HPF | LPF | | | VOL | (A4 MKII manual, p.96) |
| FX: LFO 1 / 2 ([LFO]) | as the synth LFOs, FX destinations | | | | | | | | | | (A4 MKII manual, p.97) |
| CV A-D ([OSC1]-[AMP]) | TUN | FIN | VAL | CLK | SRC | BND | SLI | | | | (A4 MKII manual, p.98) |

The ARP modes are OFF, THR (the order played), UP, DWN, CYC, SHF, RND and PLY
(A4 MKII manual, p.43). SPD 6 is 16th notes and 12 eighths (A4 MKII manual,
p.44). The ARP settings belong to the pattern, not the kit, and only NO2-NO4
can be locked (A4 MKII manual, p.43-44). The NOTE page values are copied into
each trig as it is placed, so later changes only affect new trigs; µTM, the
retrig switches and TRC are set on held trigs only (A4 MKII manual, p.45).
The keyboard is not velocity sensitive: trigs take VEL (A4 MKII manual, p.47).

## FX track and the transport

| Fact | Source |
|---|---|
| Five pages: EXT IN, CHORUS, DELAY, REVERB, LFO (OSC2 has none) | (A4 MKII manual, p.37) |
| Order: the chorus feeds the delay and the reverb, the delay feeds the reverb; each also takes every track's send | (A4 MKII manual, p.94-96, p.110) |
| Delay TIM counts 128th notes of the tempo: 32 is a quarter, 24 a dotted eighth, 128 a whole note | (A4 MKII manual, p.95) |
| Delay X 0 places the echo with WID; 1 alternates it left and right | (A4 MKII manual, p.95) |
| Delay feedback can swell; OVR adds to it | (A4 MKII manual, p.95) |
| Reverb FRQ and GAI: a shelf that darkens the tail; GAI at its maximum keeps the treble | (A4 MKII manual, p.96) |
| **[STOP]** cuts the sound while the delay repeats ring out; **[STOP][STOP]** while stopped also fades the send effects | (A4 MKII manual, p.38) |
| **[PLAY]** while playing pauses; [PLAY] again resumes | (A4 MKII manual, p.39) |
| Synced to the studio (like MIDI clock) PLAY and STOP drive the studio transport and there is no pause | not in the manual (twin) |

## Sequencer

The shared Elektron sequencer (`lib/sequencer/elektron`, see
`docs/ELEKTRON_SEQUENCER.md`) with six tracks: T1-T4, FX and CV.

| Feature | Fact | Source |
|---|---|---|
| Patterns | 8 banks × 16; up to 64 steps in pages of 16; [BANK] + [TRIG] selects; patterns change at the end in SEQUENTIAL mode | (A4 MKII manual, p.38-39, p.48) |
| Pattern modes | SEQUENTIAL, DIRECT START, DIRECT JUMP (FUNC + BANK A-C); FUNC + BANK D arms TEMP JUMP once: its LED flashes while armed and lights while the jumped-to pattern plays, then the previous pattern returns | (A4 MKII manual, p.39-40) |
| Trigs | Note trigs and lock trigs ([FUNC] + [TRIG]); hold a trig + KEYBOARD for its note; hold + LEFT/RIGHT for micro timing in 1/384 notes | (A4 MKII manual, p.40, p.45) |
| Parameter locks | Hold a trig and turn a knob; at most 128 different parameters locked in a pattern (`LOCK_LIMIT_A4`) | (A4 MKII manual, p.49-50) |
| Trig conditions | X %, FILL, !FILL, PRE, !PRE, NEI, !NEI, 1ST, !1ST, A:B | (A4 MKII manual, p.50-51) |
| Track mutes | [FUNC] + [TRACK]: global, kept through pattern changes, saved with the project (`Project.mutes`). Only sequencer trigs are muted; the keyboard still plays | (A4 MKII manual, p.16, p.37) |
| Trig mutes, accents, slides | FUNC + BANK E-H menus, or the BANK key with a trig held; note slides use SLI; parameter slides arrive at the next trig | (A4 MKII manual, p.51-53) |
| Fill | Hold [FILL]; FUNC + [FILL] cues one cycle | (A4 MKII manual, p.51) |
| Swing, scale | FUNC + [PTN]; FUNC + [PAGE]: NORMAL / ADVANCED, 1/8X ... 2X | (A4 MKII manual, p.48-49, p.53) |
| Transpose | Hold [TRNS] + KEYBOARD; FUNC + [TRNS] locks it | (A4 MKII manual, p.53) |
| Reload / save | Pattern and track restore points: [PTN] and [TRK] menus, [YES] / [NO] + key | (A4 MKII manual, p.42-43, p.54) |
| Copy / clear / paste | FUNC + [RECORD] / [PLAY] / [STOP]: the track in GRID RECORDING, else the pattern | (A4 MKII manual, p.54) |
| LIVE RECORDING | [RECORD] + [PLAY]; played notes land micro-timed; [PLAY] leaves it, [STOP] stops | (A4 MKII manual, p.40-41) |
| Chains and songs | Quick chains: hold the first pattern's trig and press more; songs play row by row with repeats, song mutes and transpose, then stop | (A4 MKII manual, p.55-57) |
| Demo song | Night Drive loops back to row 2 so it keeps playing while you explore (SONG EDIT > END makes it stop like the hardware's) | twin choice |

## What the twin simplifies or leaves out

- **One kit per project.** Patterns share the kit; there is no kit link per pattern (A4 MKII manual, p.38).
- **No POLY mode** (A4 MKII manual, p.28-29): each track plays its own voice, so the PLY arp mode and chords on one track are absent.
- **No CV or audio-input jacks.** The CV track is sequenced and shown; IN L / IN R and the EXT IN page are present but silent.
- **No sound locks** (A4 MKII manual, p.50), no Euclidean NOTE page (p.46-47), no STEP RECORDING (p.41), no ARP SETUP step offsets (p.44), no KEY SCALE / KEY NOTE / TRANSPOSABLE (p.47), no control-all (p.18), no page randomise / revert (p.17), no page playback ([PAGE] + [TRIG 1-4], p.39), and LIVE RECORDING records notes but not knob moves (p.50).
- **Performance macros are fixed** (LP sweep, HP sweep, resonance ...): there is no PERFORMANCE SETUP (p.26-27); QPER picks one macro, not several (p.28).
- **LFO multiplier**: the × and · groups (24 values); the tuning-fork group that syncs to an oscillator is left out (A4 MKII manual, p.92).
- **Modulation destinations**: continuous parameters only (55 synth, 22 FX); discrete targets such as waveforms are left out.
- **Sends** are taken after the VCA in mono; the manual's diagram does not show where they sit relative to PAN (A4 MKII manual, p.110).
- **Menus** are overlays rather than OLED pages; MIDI, the +Drive, projects and the Click Track are the studio's job.

## The twin's own curves (not in the manual)

| Quantity | Twin |
|---|---|
| Envelope stage times | 0 → 1 ms, 64 → 0.13 s, 127 → 16 s (exponential); REL 127 = infinite |
| Filter FRQ | One semitone per step, 440 Hz at 60 (13.75 Hz at 0, about 21 kHz at 127): the Rytm MKII's measured law |
| Filter TRK | 32 = 1:1 keytracking (A4 MKII manual, p.89) |
| LFO rate | SPD × MUL = 128 is one cycle per bar |
| DET | 0.125 Hz per step |
| Oscillator drift, F1 resonance boost | Small random pitch drift; resonance compensation for the ladder's bass loss |
| Noise COL | Pink and red by filtering white noise (equal RMS); positive values high-pass from 30 Hz up to 8 kHz |
| Fastest envelope rise | 1.5 ms, also at ATK 0 (the original's envelopes run at about 1.5 kHz and reach the circuits through smoothed control voltages); the FULL shapes jump within that time |
| VCA control | Smoothed with a 0.5 ms time constant, so a square LFO on VOL gates without a click |
| Output noise floor | About -100 dBFS, never digital silence (the manual gives 102 dB S/N, p.85) |

## DSP implementation

- `public/worklets/analog-four-processors.js`, `a4-voice`: one worklet node per track holds the whole voice (oscillators with 4-point polyBLEP/polyBLAMP band-limiting, subs, sync, AM, noise, TPT ladder, overdrive, SVF multimode, VCA, envelopes, LFOs, the modulation matrix). Control rate 3 kHz (16-sample blocks) with per-sample interpolation.
- `a4-fxmod` maps the FX track's values, locks and FX LFOs to channels; the shared `chorus` and `fdn-reverb` processors do the chorus and reverb; `a4-fx` holds the tempo-synced delay (feedback filters and saturation in the loop), the effect-to-effect sends and the dry + wet mix.
- [STOP] sends `cut` (a 6 ms fade, nothing queued survives); [STOP][STOP] fades the send returns in 0.3 s and empties the delay and reverb.
- Previews (lessons, the preset browser, audio QA) play the selected pattern, or a riff on the keyboard's track when it is empty, and end like [STOP][STOP].
- A voice that feeds the next track (NEI) gets `feed`: it never sleeps, so its multimode output is always there.

## Presets

- **Kits** (6) load four sounds, the FX track and a project; each kit sets its track levels so its demo plays at about -18 LUFS (audio QA `--target -18`).
- **Sounds** (40) load on T1 with a one-bar phrase in pattern A01 that shows the sound off: riffs for basses, a line for leads, held chords for pads, 8th-note lines for plucks, a 16th funk figure for keys, a held note for the arpeggios, grooves for drums (a 3-2 clave for the rim, a fill for the tom). VEL varies inside the phrase. Short percussive sounds carry a T1 level so every preset plays at about -18 LUFS (FX about -22); levels were set from the audio-QA suggestions.
- Every preset is our own recreation by character, with a descriptive name (`sounds.ts`, `kits.ts`).
