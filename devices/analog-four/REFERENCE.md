# Analog Four MKII - front-panel and architecture reference

The ground truth this twin is built from. `docs/reference/analog-four/` holds no photos,
and manufacturer sites, manual mirrors and image hosts are blocked from this
environment, so every claim below is tagged with its source and a confidence level.

## Sources

| Tag | Source | What it gives |
|---|---|---|
| **EMU** | `trigcondition/analog-emu` on GitHub, `src/gui/hw.rs` (`layout_a4`, `face_label`, `sub_label`, `decor`, `strips`) and `src/panel.rs` | A pixel layout of the A4 MKII panel "after a community drawing of the panel": the position and size of every key, knob, LED strip and the screen window, the label printed on each key and the secondary (FUNC) label under it. The LED tables were **measured** by running the real OS 1.56 in the emulator. |
| **KEYS** | `Iced-Cream/analoghealth`, `keys-a4.def` and `docs/BUTTONS.md` | The OS 1.56 button names and key codes: the authoritative list of the 89 inputs (74 keys, 10 DATA ENTRY pushes, TRACK LEVEL push, 2 pots). |
| **CORE** | `irpina/elekloader`, `mods/core-a4/README.md`, `sdk/include/analog-four-mk2/pages.h` | Page keys per track type (synth / FX / CV), "the FX track has no OSC2", the GLOBAL key's menu, 29 page views, 10 knobs per page. |
| **MAN** | Elektron *Analog Four MKII User Manual* (OS 1.30 - 1.56) and *Quick Guide*, read through search-engine snippets | Front-panel item numbers 1-37 and their descriptions, screen items 1-7, menu contents, parameter semantics. |
| **SOS** | Sound On Sound review "Elektron MkII Analog Four, Analog Rytm & Octatrack" | MKII keys: labels printed on the keys in bold white, secondary functions printed below; red/yellow/green key lighting; high-resolution encoders. |
| **ELK** | Elektronauts thread "Analog mk2 grey and black comparison" | MKII Black edition: "midnight" finish, the coloured highlight replaced by grey, FUNC shortcuts underlined, smaller Elektron logo. |
| **SPEC** | Elektron product page and retailer spec sheets | 385 x 225 x 82 mm (W x D x H, including knobs, jacks and feet), 2.4 kg, 128 x 64 OLED. |
| **SYSEX** | `kimasendorf/elektron-analog-four-sound-sysex` (OS 1.40A sound dump tables) | Every sound parameter with its screen abbreviation, display range and init value; waveform, sub, filter type, envelope shape, LFO and routing enumerations. |
| **MIDI** | midi.guide (CC BY-SA 4.0), in the repo as `public/midi-guide/devices/elektron-analog-four-mkii.json` (230 parameters; the same data as `pencilresearch/midi` `Elektron/Analog Four MKII.csv`) | **Verified source.** The MKII NRPN map: every parameter by page in encoder order (NRPN LSB = page base + knob slot), ranges, centred / 0-based, the 12 envelope shape names, the full modulation destination list. |

Confidence: **verified** = two independent sources agree, or a measurement of the real OS;
**high** = one authoritative source (manual text, OS tables); **medium** = the community
drawing (EMU layout) or a single secondary source; **low** = inferred, chosen by us.

## Chassis

| Item | Value | Source | Confidence |
|---|---|---|---|
| Outer size | 385 x 225 mm (W x D), 82 mm high incl. knobs/feet; 2.4 kg | SPEC | verified |
| Faceplate drawn | 381 x 221 mm + 2 mm frame (the EMU drawing is 1156 x 643 px; mapped with 0.330 mm/px across, 0.344 mm/px down) | EMU, SPEC | medium |
| Edition modelled | MKII **Black** (2020): near-black "midnight" anodised panel, dark backlit keys, white legends on the keys, grey underlined FUNC legends under them, smaller Elektron logo. The 2017 grey MKII had a light grey panel (EMU draws it #A9ABAE) with coloured secondary legends. | ELK, SOS, EMU | high (finish), medium (exact colours) |
| Keys | Rectangular rubber keys, backlit (red / green / yellow / white). Primary label printed on the key, FUNC label under it. Trig keys and REC/PLAY/STOP larger. | SOS, EMU | high |
| Encoders | Black knurled endless encoders with push function (10 DATA ENTRY + TRACK LEVEL); MAIN VOLUME and QUICK PERF AMOUNT are pots | SOS, KEYS, EMU (A4-PORT: "QUICK PERF AMOUNT is one of two absolute inputs (pots)") | verified |
| Screen | 128 x 64 white OLED behind a black glass window that also carries the tag line "4 VOICE ANALOG TABLETOP SYNTHESIZER" above and "ANALOG FOUR MKII" below the display | SPEC, EMU | high (OLED), medium (window text) |

## Front panel, element by element

Positions are the centre in mm from the faceplate's top-left (EMU drawing converted).
Rows are listed top to bottom, elements left to right. "MAN #" is the manual's front-panel
item number.

### Left block (top to bottom)

| MAN # | Label on the panel | FUNC / secondary legend | Pos. (x, y) | Type and appearance | Function (MAN) | Source | Conf. |
|---|---|---|---|---|---|---|---|
| 1 | MAIN VOLUME | - | 25.7, 21.7 | pot, 14.5 mm | Main and headphone output level | MAN, EMU | verified |
| 3 | QUICK PERF (AMOUNT) | - | 61.0, 21.7 | pot, 14.5 mm | Amount of the selected performance macro | MAN, EMU | verified |
| 5 | TRACK LEVEL | SOUND BROWSER (push) | 94.3, 21.0 | encoder with push, 17.8 mm | Level of the active track; scrolls menus; push opens the sound browser | MAN, EMU | verified |
| 2 | GLOBAL (GLOBAL SETTINGS) | SAVE PROJECT (long press: LOAD PROJECT) | 25.0, 51.2 | key 18.5 x 13.7, LED | GLOBAL SETTINGS menu | MAN, EMU, CORE | verified |
| 4 | QPER | MUTE | 60.6, 51.2 | key, no LED | With [TRIG 1-10]: pick the macro QUICK PERF controls; FUNC mutes the macros | MAN, EMU | verified |
| 6 | TEMPO | TAP TEMPO | 96.2, 51.2 | key, no LED | TEMPO menu; FUNC+TEMPO taps the tempo | MAN, EMU | verified |
| 15 or 37 (unconfirmed) | FUNC | - | 25.4, 87.3 | large key 19.1 x 17.2 | Shift for every secondary function | MAN, EMU | verified |
| 31 | KIT | SAVE KIT | 58.3, 85.2 | key, LED | KIT menu | MAN, EMU | verified |
| 32 | SND | SETTINGS | 78.1, 85.2 | key, LED | SOUND menu; FUNC: SOUND SETTINGS | MAN, EMU | verified |
| 33 | MIX | POLY CONFIG | 97.9, 85.2 | key, LED | PERFORMANCE MIXER; FUNC: POLY CONFIG | MAN, EMU | verified |
| 29 or 30 | PERF | SETUP | 25.0, 112.0 | key, LED | PERFORMANCE mode (DATA ENTRY knobs become macros) | MAN, EMU | verified |
| 34 | TRK | METRONOME | 58.3, 112.0 | key, LED | TRACK menu; FUNC: CLICK TRACK (printed METRONOME) | MAN, EMU | verified (function), medium (legend) |
| 35 | PTN | SWING | 78.1, 112.0 | key, LED | PATTERN menu; FUNC: SWING | MAN, EMU | verified |
| 36 | SONG | SAVE SONG | 97.9, 112.0 | key, LED | SONG menu; FUNC saves the song | MAN, EMU | verified |
| - | four PATTERN MODE LEDs: SEQUENTIAL, DIRECT START, DIRECT JUMP, TEMP JUMP | - | 23.7 / 42.8 / 62.0 / 81.1, 133.0 | LED strip over BANK A-D | Shows the pattern change mode; FUNC + BANK A-D selects it | EMU (measured OS 1.56) | verified |
| 28 | BANK A, B, C, D | (FUNC: the four change modes above) | x 23.7 / 42.8 / 62.0 / 81.1, y 147.1 | keys 17.1 x 13.7, LED | BANK + TRIG 1-16 selects a pattern | MAN, EMU, KEYS | verified |
| 28 | BANK E, F, G, H | TRIG MUTE, ACCENT, NOTE SLD, PARAM SLD | same x, y 167.0 | keys, LED | FUNC + BANK E-H: trig edit modes | EMU | medium |

### Screen and centre column

| MAN # | Label | FUNC legend | Pos. | Type | Function | Source | Conf. |
|---|---|---|---|---|---|---|---|
| 9 | Screen window | - | box 109.8, 7.2, 95.6 x 72.9; OLED 115.4, 17.5, 84.4 x 44.0 | black glass + 128 x 64 OLED | see "Screen" below | EMU, SPEC | high |
| 7 | YES | SAVE | 137.8, 95.2 | key, no LED | Enter / confirm | MAN, EMU | verified |
| 8 | NO | RELOAD | 137.8, 112.7 | key, no LED | Exit / back | MAN, EMU | verified |
| 10 | UP | - | 166.8, 95.2 | key (arrow icon) | menu navigation | MAN, EMU | verified |
| 10 | LEFT / DOWN / RIGHT | TIME- / - / TIME+ | 155.6 / 173.0 / 190.5, 112.7 | keys (arrow icons) | menu navigation; LEFT/RIGHT nudge the tempo; FUNC micro-timing nudge | MAN, EMU | high |
| 26 | SONG M (SONG MODE) | EDIT SONG | 138.1, 138.9 | key, LED | SONG mode on/off; FUNC opens the song editor | MAN, EMU | verified |
| 27 | CHAIN (CHAIN MODE) | NEW CHAIN | 157.2, 138.9 | key, LED | CHAIN mode on/off; FUNC starts a new chain | MAN, EMU | verified |
| 25 | REC (record icon) | COPY | 138.8, 164.6 | large key 17.8 x 16.5, LED red | GRID RECORDING on/off; hold + PLAY = LIVE RECORDING | MAN, EMU | verified |
| 24 | PLAY (play icon) | CLEAR | 159.2, 164.6 | large key, LED green while playing | start / pause | MAN, EMU (measured) | verified |
| 23 | STOP (stop icon) | PASTE | 179.6, 164.6 | large key, LED white while stopped | stop | MAN, EMU (measured) | verified |

### Right block

| MAN # | Label | Secondary legends | Pos. | Type | Function | Source | Conf. |
|---|---|---|---|---|---|---|---|
| 14 | DATA ENTRY knobs, letters A B C D E (row 1), F G H I J (row 2) printed under them | push shows the full parameter name | x 215.2 / 246.5 / 277.8 / 309.2 / 340.5; y 22.7 and 55.3 | endless encoders 17.1 mm | edit the 10 parameters shown on screen (same 5 x 2 grid) | MAN, EMU, KEYS | verified |
| 11 | ARP | SETUP | 214.6, 95.2 | key, LED | ARPEGGIATOR menu; FUNC: ARP SETUP | MAN, EMU | verified |
| 12 | NOTE | SETUP | 233.0, 95.2 | key, LED | NOTE menu (NOT VEL LEN uTM TRC); FUNC: NOTES SETUP | MAN, EMU | verified |
| 13 | OSC 1 | FX row: EXT IN - CV row: CV A | 251.5, 95.2 | PARAMETER key, LED (red page 1, green page 2) | OSC 1 / second press NOISE | MAN, CORE, EMU | verified |
| 13 | OSC 2 | FX row: (none) - CV row: CV B | 269.9, 95.2 | PARAMETER key | OSC 2 / second press OSC 1&2 | MAN, CORE, EMU | verified |
| 13 | FILTER | CHORUS - CV C | 288.4, 95.2 | PARAMETER key | FILTERS | MAN, EMU | high |
| 13 | AMP | DELAY - CV D | 306.8, 95.2 | PARAMETER key | AMP | MAN, EMU | high |
| 13 | ENV | REVERB - ENV | 325.3, 95.2 | PARAMETER key | ENV F / second press ENV 2 | MAN, EMU | high |
| 13 | LFO | LFO - LFO | 343.8, 95.2 | PARAMETER key | LFO 1 / second press LFO 2 | MAN, EMU | high |
| 19 (inferred) | OCT- | (OCTAVE) | 238.6, 116.2 | key, no LED | keyboard octave down | MAN, KEYS, EMU (measured: 0xa5 is OCT-) | verified |
| - | seven OCTAVE LEDs (-3 ... +3) | - | x 255.1 ... 298.6 (7.25 mm apart), y 116.2 | LED strip, one lit red | current keyboard octave (default +1) | EMU (measured) | verified |
| 19 (inferred) | OCT+ | (OCTAVE) | 313.4, 116.2 | key | keyboard octave up | MAN, KEYS | verified |
| 17 | TRNS | LOCK | 332.6, 116.2 | key, LED | transpose (hold + keyboard key); FUNC: transpose lock | MAN, EMU | verified |
| 18 | KEYBOARD: C C# D D# E F F# G G# A A# B C (13 keys, one octave + one note) | - | white keys x 214.1 ... 329.4 (16.5 mm pitch), y 128.2-171.5; black keys 9.2 x 25.4 on top | piano-style keys, each with an LED | play the active track; hold a trig + key = note lock | MAN, KEYS, EMU | verified (13 keys), medium (shape) |
| 16 | T1, T2, T3, T4, FX, CV (column) | MUTE (FUNC + track key) | x 363.5; y 24.1 / 41.9 / 59.8 / 77.7 / 95.5 / 113.4 | keys 17.8 x 11.7, LED: red = active track, green = audible, off = muted | select the active track | MAN, KEYS, EMU (measured colours) | verified |
| 29 or 30 | FILL | CUE FILL | 363.5, 171.2 | key, LED red while active | FILL mode (when GRID RECORDING is off); FUNC cues it | MAN, EMU | verified |
| 20 | PATTERN PAGE LEDs 1 2 3 4 | - | x 345.1 / 352.0 / 358.9 / 365.8, y 186.6 | LED strip: dim red = page exists, bright = shown | pattern pages | MAN, EMU (measured) | verified |
| 21 | PAGE | SCALE | 363.5, 199.3 | key, no LED | next pattern page; FUNC opens the SCALE menu | MAN, EMU | verified |

### Bottom row

| MAN # | Label | Secondary | Pos. | Type | Function | Source | Conf. |
|---|---|---|---|---|---|---|---|
| 22 | TRIG keys 1-16 (number printed on the key, underlined) | - | x 18.5 + 21.1 n, y 200.0 | large keys 18.5 x 16.5 with RGB LED | enter trigs; select patterns with BANK; QPER + 1-10 selects a macro | MAN, SOS, EMU | verified |

EMU also prints the letters A-P under the trig keys. No second source confirms them, so
the twin leaves them out (**unverified**).

### Not on the top panel

Rear panel (not drawn): power, USB, MIDI IN/OUT/THRU, CV A-D outputs, audio inputs L/R,
main outputs L/R, track outputs 1-4, headphones (MAN, item list of the rear panel).

## Screen (MAN, "The user interface")

1. Active kit name, top left. While a DATA ENTRY knob turns it shows the parameter's full name.
2. Tempo with one decimal.
3. Sequencer state icon: record, play, pause, stop.
4. Up to ten track parameters in the 5 x 2 knob grid, with their values.
5. Active pattern, with the active song row to its left.
6. A bar with the active track's level.
7. Track name.

## LED behaviour (EMU, measured on OS 1.56)

- PARAMETER keys: the open page's key red on its first page, green on its second (OSC 1 red on OSC 1, green on NOISE).
- Track keys: active track red, the others green (audible); muted tracks dark.
- PLAY green while playing, STOP white while stopped, REC red in GRID RECORDING.
- OCTAVE: one LED red; PATTERN PAGE: dim red for the pattern's pages, bright for the shown page; PATTERN MODE: the change mode in use.
- FILL red while active; TRNS lit while held (and the track keys show which tracks transpose); GLOBAL red in its menu.
- Trig keys (MAN): note trigs full-bright, trigless (lock) trigs half-bright.

## Voice architecture (MAN 4.1 and Appendix E via EMU A4-PORT; SYSEX; MIDI)

Per synth track, one analog voice:

```
OSC 1 (+ SUB 1) ──┐
OSC 2 (+ SUB 2) ──┼─► FILTER 1 (4-pole ladder LP) ─► OVERDRIVE ─► FILTER 2 (2-pole multimode) ─► VCA (ENV A) ─► PAN ─► out
NOISE (digital) ──┘        ▲ ENV F (DEP)                          ▲ ENV F (DEP)
ENV F, ENV 2, LFO 1, LFO 2, vibrato, PWM LFOs, velocity: digital modulation of the analog controls
Sends CHO / DEL / REV (AMP page) ─► FX track: chorus ─► delay ─► reverb (digital), returns summed before the outputs
```

Pages and encoder slots (MIDI NRPN order, SYSEX abbreviations):

| Page (key) | A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|---|
| OSC 1 ([OSC 1]) | TUN | FIN | DET | TRK | LEV | WAV | SUB | PW | SPD | PWM |
| NOISE ([OSC 1] x2) | SNH | COL | FAD | - | LEV | | | | | |
| OSC 2 ([OSC 2]) | TUN | FIN | DET | TRK | LEV | WAV | SUB | PW | SPD | PWM |
| OSC 1&2 ([OSC 2] x2) | AM1 | SMD (sync mode) | SNC (sync amount) | BND | SLI | AM2 | TRG (osc retrig) | FAD (vibrato fade) | SPD (vibrato speed) | VIB (vibrato depth) |
| FILTERS ([FILTER]) | FRQ | RES | OVR | TRK | DEP | FRQ | RES | TYP | TRK | DEP |
| AMP ([AMP]) | ATK | DEC | SUS | REL | SHP | CHO | DEL | REV | PAN | VOL |
| ENV F ([ENV]) | ATK | DEC | SUS | REL | SHP | LEN | DST | DEP | DST | DEP |
| ENV 2 ([ENV] x2) | same as ENV F | | | | | | | | | |
| LFO 1 ([LFO]) | SPD | MUL | FAD | SPH | MOD | WAV | DST | DEP | DST | DEP |
| LFO 2 ([LFO] x2) | same as LFO 1 | | | | | | | | | |

FX track: EXT IN ([OSC 1]: L CHO DEL REV PAN LEV / R ...), CHORUS ([FILTER]: PRE SPD DEP
WID FB / HPF LPF DEL REV VOL), DELAY ([AMP]: TIM X - WID FB / HPF LPF OVR REV VOL), REVERB
([ENV]: PRE DEC FRQ GAI - / HPF LPF - - VOL), FX LFO 1/2 ([LFO]). CV track: CV A-D on
[OSC 1]/[OSC 2]/[FILTER]/[AMP] (TUN FIN VAL SRC BND SLI), CV ENV and CV LFO pages.

Enumerations (SYSEX, MIDI): WAV SAW TRP PUL TRI INL INR FDB/NEI OFF; SUB OFF 1OCT 2OCT 2PUL
5TH; F2 TYP LP2 LP1 BP HP1 HP2 BS PK; ENV SHP 12 shapes (Linear ADR, Standard, E.A/L.DR,
Exp. ADR, Full ADR, F.A/E.DR, each also as a Restart "(R)" version; default Standard);
LFO WAV TRI SIN SQR SAW EXP RMP RND; LFO MOD FREE TRIG HOLD ONE HALF; LFO MUL x1 ... x2k
(tempo synced) and .1 ... .2k (fixed 120 BPM). SPD x MUL = 128 is one cycle per bar
(Elektronauts, community-derived; consistent across three posts). Filter TRK 32 = 1:1
note tracking (manual quote on Elektronauts). DET is a linear detune in Hz (manual).

## What the twin simplifies or leaves out

See `index.ts` tips and the comments in `params.ts` / `engine.ts`. In short: one kit per
project (patterns share it), POLY mode, sound/kit/project management menus, live
motion recording of knob moves, MIDI, the CV outputs (the CV track is sequenced and shown
but has no jacks: they are on the rear panel), the audio inputs (INL/INR waveforms and the
EXT IN page are present but silent), and FDB / NEI routings approximated as described in
`engine.ts`. Value-to-Hz and value-to-seconds curves are our fits to the documented
ranges, not measurements.

## Cross-check of params.ts against midi.guide

A script maps each of the 230 midi.guide entries to a control in `params.ts` and compares
the encoder slot (NRPN LSB minus the page base) and the value range.

- **139 parameters match exactly** in page, slot and range: every OSC 1 / OSC 2 / NOISE /
  OSC 1&2 / FILTERS / AMP / ENV F / ENV 2 / LFO page entry not listed below, the FX track's
  EXT IN, CHORUS, DELAY and REVERB pages, the FX LFO pages and the CV A-D pages.
- **Not one-to-one, by design:** midi.guide's `OSCn: Pitch` is a 14-bit NRPN that combines
  TUN and FIN; the twin shows them as the two encoders the screen has. Performance A-J,
  TRACK LEVEL and track mute exist (`perf_a..j`, `tN_level`, `t1_mute..t6_mute`: global,
  so they survive pattern changes, set with [FUNC] + [TRACK]) but are not paged synth
  parameters. Mod wheel and breath are not modelled (no MIDI input).

Where the twin differs from midi.guide, and why:

| Parameter | midi.guide | Twin | Reason |
|---|---|---|---|
| OSC 2 DET, NOISE FAD, LFO SPD, DELAY WID, EXT IN L PAN | 0..127, 0-based | -64..+63 | The screen shows these signed (SYSEX ranges; the manual: FAD "0 gives a constant noise, positive fades out, negative fades in"; LFO SPD "negative values run the cycle backwards"). midi.guide lists the raw NRPN value. OSC 1 DET is centred in midi.guide, OSC 2 DET is not: an inconsistency there. |
| EXT IN L LEV | centred | 0..127 | Looks swapped with L PAN in midi.guide (R PAN is centred, R LEV is not). |
| ENV / LFO DEP A/B, FX LFO DEP | 7-bit MSB, centred | -128..+127 | The hardware has a finer (14-bit, decimals) depth; SYSEX gives -128..+127. |
| ENV / LFO DST, VELOCITY MOD DST | 0..127 code list (about 70 targets) | 55 targets | Continuous targets only; discrete ones (waveform, sub, sync mode, shapes, multiplier) are left out. FX LFO DST: 22 of the 73 codes (the EXT IN targets are left out with the inputs). |
| LFO MUL | 36 values (x1..x2K, .1...2K, f1..f2K) | 24 values | The third group (`µ` in SYSEX) is undocumented; left out. The FX LFO has 24 values in both. |
| DELAY X (ping-pong) | 0..127 | OFF / ON | Kept as the on/off switch the screen shows (unverified). |
| REVERB GAI | 0..127 | 0..127 | Matches (an earlier draft had it signed; fixed). |

## DSP implementation notes

- Voices: one `a4-voice` worklet per track (`public/worklets/analog-four-processors.js`):
  oscillators with the shared core's 4-point polyBLEP/polyBLAMP residuals, A4 sub
  dividers, transistor pulse, sync modes and AM, noise, ladder, overdrive, multimode,
  envelopes and LFOs in one node, so the A4's full modulation matrix (envelope times, LFO
  speed, sends, levels...) works without native glue. Four worklet nodes instead of the
  previous version's 36 shared nodes plus native gains.
- FX track: the shared `Chorus` (BBD) and `Reverb2` (FDN) processors, and an `a4-fx`
  worklet for the delay, the effect-to-effect sends and the master mix (see engine.ts).

