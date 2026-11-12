# Elektron Analog Four MKII: sources

Independent research for the Synth Studio A4 MKII twin (2026-10-29). I did not read the in-progress `devices/analog-four/` implementation.

**Primary source: the official Analog Four MKII User Manual for OS 1.55** (Elektron, last updated 2026-06-10). It is cited as "(MAN p.N)".

## 0. How to read these notes

**Confidence tags** in `sources.md`, `signal-flow.md` and `panel.md`:

| Tag | Meaning |
|---|---|
| **verified (MAN p.N)** | Stated in the OS 1.55 manual on page N. Strongest. |
| **verified (X)** | Read directly from another near-primary source X: the midi.guide CSV, firmware measurements on the real OS 1.56, or the top-down unit image. |
| **likely** | A strong inference from verified facts, or a single secondary source. |
| **guess** | My recollection or general Elektron convention, not confirmed. |

**Copyright.** The manual is Elektron's copyright. Follow `manuals/COPYRIGHT-RULES.md`:

- Facts appear here in my own words and tables.
- Quotes are at most 25 words and carry a page cite.
- No page renders, extracted text or artwork go into the repository. The panel geometry in `panel.md` is *measured* from the manual's drawing and restated as numbers; it is not traced.

**History.** The first version of these notes was written before the manual arrived. WebSearch then ran out of budget (shared across agents) after about 16 searches. The firmware projects (EMU, AH, EL) carried that version. Each claim has since been re-checked against the manual. Most guesses were confirmed; the ones the manual corrected are listed in §7.

## 1. Source inventory

| ID | What | Where | Licence | Version | Used for |
|---|---|---|---|---|---|
| **MAN** | Analog Four MKII User Manual, OS 1.55, 114 pages | `scratchpad/manuals/analog-four/Analog_Four_MKII_User_Manual_OS1.55/` (`text.txt` with page markers, `toc.txt`, `hires/p-0NN.png`); source PDF `01_Elektron/Analog_Four_MKII_User_Manual_OS1.55.pdf` | © Elektron; facts only (see the copyright rules) | OS 1.55, 2026-06-10 (MAN p.11) | Everything: panel (pp.12–14), signal path (p.15), structure (pp.16–17), screen (p.18), kits, poly and routing (pp.24–37), sequencer (pp.38–57), global and MIDI/CV/audio routing (pp.58–70), oscillator/filter/envelope detail (pp.72–75), quick keys (pp.83–84), specs (p.85), parameter appendices A–C (pp.87–100), MIDI (pp.101–109), architecture (p.110) |
| MG | midi.guide dataset: 230 A4 MKII parameters with CC/NRPN | Repo file `public/midi-guide/devices/elektron-analog-four-mkii.json`, read with `git show`. It is byte-identical at the current code `89801d8` and on branch `claude/dfam-documentation-review-iYhxN` (SHA-256 `05866709…`). Full CSV: `repos/pencilresearch-midi/Elektron/Analog Four MKII.csv` (https://github.com/pencilresearch/midi). Local copies: `midi-guide-a4mkii.json`, `midi-guide-a4mki.json` | CC BY-SA 4.0 | upstream `776c9ef3` (2026-10-26) | Numeric value lists (waveforms, shapes, multipliers, destination codes). Its CC/NRPN tables match MAN pp.101–109 exactly |
| KA | Kim Asendorf, "Elektron A4 Sound SysEx" (reverse-engineered sound dump, OS 1.40A) | https://github.com/kimasendorf/elektron-analog-four-sound-sysex → `repos/elektron-analog-four-sound-sysex/` | **No licence file**; facts only | `8658d6d1` (2020-12-01) | The sound data structure, init-sound defaults, mod destination codes |
| EMU | `analog-emu` (rytm-emu): boots the real A4 MKII OS 1.56 and A4 MKI OS 1.56; key table read from the OS; voice model from the OS's voice frame | https://github.com/trigcondition/analog-emu → `repos/trigcondition-analog-emu/` (`docs/A4-PORT.md`, `docs/MK1-PORT.md`, `src/panel.rs`, `src/a4voice.rs`, `src/gui/hw.rs`) | MIT | `4c07ed3d` (2026-10-27) | Hardware: voice control frame, pitch and filter scaling, codec/FX path, CV outputs, MKI vs MKII internals, LED palette |
| AH | `analoghealth`: diagnostics mod, **passed on real A4 MKII units**. `keys-a4.def` holds the OS's own 89 button names and codes | https://github.com/Iced-Cream/analoghealth → `repos/iced-cream-analoghealth/` | GPL-2.0-or-later | `3f71979d` (2026-10-26) | Key inventory and naming |
| EL | `elekloader`: mod loader with an A4 MKII core, checked on a unit | https://github.com/irpina/elekloader → `repos/irpina-elekloader/mods/core-a4/README.md`, `docs/ADAPTING.md` | GPL-2.0-or-later | `a4019672` (2026-10-28) | Page and view structure, settings menu |
| MW | `modwerk`: A4 MKII SDK notes and the Rytm MKII "filter-hz" unit measurement | https://github.com/repeat98/modwerk → `repos/repeat98-modwerk/` (sparse) | GPL-3.0-or-later / Elastic-2.0; media keep their own licences | `4690b6eb` (2026-10-28) | Cross-checks; the filter Hz law (for the Rytm) |
| IMG | Top-down image of a **black** A4 MKII with every legend readable (960×548) | `repos/repeat98-modwerk/public/machines/analog-four-mkii.webp` (PNG copy: `_img/modwerk-a4mkii.png`) | **Provenance and licence unknown.** Measurement reference only; never ship it | | Panel colours on the black finish; position cross-check |
| LAR | libanalogrytm | https://github.com/bsp2/libanalogrytm → `repos/libanalogrytm/sysex.c` | MIT | `a0a19f69` | The Elektron 8-into-7 sysex packing |
| ELK | Elektroid | https://github.com/dagargo/elektroid → `repos/elektroid/res/elektron/devices.json` | GPL-3.0 | `fde26a58` | Elektron device ids (A4 MKI 4, Analog Keys 6, A4 MKII 14) |
| WS | Web search snippets (before the manual arrived) | manualslib, manualsdir, elektron.se, retailers (URLs in the first edition of these notes) | | | Superseded by MAN. Kept only where they agree |

The repos total about 33 MB; modwerk is a sparse checkout.

## 2. MIDI implementation [verified (MAN pp.101–109) = MG]

**NRPN layout.** NRPN MSB 0 is the performance macros, MSB 1 the synth tracks, MSB 2 the FX track and MSB 3 the CV track.

**Knob order.** The manual's MIDI tables carry an "Encoder" column. This **directly verifies the knob letter (A–J) of every parameter**, so the NRPN slot order equals knob order (MAN pp.102–109).

**Empty knobs** [verified (MAN pp.102–107)]:

- NOISE: knobs D and F–J (knob B is COL, which has no listed NRPN in MAN; MG gives it as 1:11).
- DELAY: knob C.
- REVERB: knobs E, H and I.
- CV A–D: knobs H–J.

**Naming differences in MAN:**

- The shared oscillator page is called "OSC COMMON" in the MIDI appendix (MAN p.102) and "OSC 1&2" in the parameter appendix (MAN p.88).
- NRPN 1:36, the TRG key, is called "Note Sync" (MAN p.103).
- DELAY knob B (X, ping-pong) is "Mode" (MAN p.105).
- EXT IN uses "Ch1/Ch2" for left/right.
- Each FX mix level (VOL) is "Send Level" (MAN pp.105–106).

**Value lists** [verified (MG); the names match MAN's prose]:

- **Waveforms (OSC1):** Sawtooth, Transistor Pulse, Pulse, Triangle, Input Left, Input Right, Filter Feedback, Off.
- **Waveforms (OSC2):** the same, with Neighbor in place of Filter Feedback.
- **Sub:** Off, 1 Oct, 2 Oct, 2 Pul (25 % pulse), 5th (33 % pulse).
- **Sync:** Off, 1→2, 2→1, Metal.
- **F2 types:** LP2, LP1, BP, HP1, HP2, BS, PK.
- **Envelope shapes:** 12, named in MG as Linear ADR, Standard, E.A / L.DR, Exp. ADR, Full ADR, F.A / E.DR, each plain and "(R)" (restart).
- **LFO modes:** Free, Trig, Hold, One, Half (MAN p.92 shows them as FRE, TRG, HLD, ONE, HLF).
- **LFO waves:** Triangle, Sine, Square, Sawtooth, Exponential, Ramp, Random.
- **LFO multiplier:** 36 values: x1…x2048, .1….2048, f1…f2048. MAN p.92 calls these groups ×, dot and tuning fork. FX LFOs have only the first 24 values.
- **CV source:** T1–T4, FX, CV.
- **Destination codes:** see §3.3.

**Inconsistencies in MG** (MAN settles each):

- OVR is flagged 0-based in MG; it is bipolar, 0 = clean (MAN p.89).
- LFO SPD is flagged 0-based; it is bipolar (MAN p.92).
- OSC2 Detune is flagged 0-based; it is the same linear detune as OSC1 (MAN p.88).
- The MKI CSV calls CC 88 "VIB SPD". MAN p.103 gives CC 87 = vibrato speed and CC 88 = vibrato depth.

## 3. Sound data structure (KA: sound dump, OS 1.40A)

### 3.1 Container [verified (KA); packing explained by LAR]

- A sound dump is **415 bytes**:
  - header bytes 0–9 (F0, Elektron ID `00 20 3C`, …); byte 7 is the program number;
  - packed payload from byte 10;
  - checksum at 410–411, the sum of bytes 10–409;
  - length `03 15` at 412–413;
  - F7 at 414.
- **Packing.** The payload is Elektron's 8-into-7 code: each 8-byte packet starts with a byte that holds the top bits of the next seven bytes (LAR `ar_sysex_decode`).
  - So bytes at 10 + 8k are packing bytes. These are KA's "Fine Tune +/− @42", "Freq Decimal @114/@130", "Depth Intermediate Step @202/@210/@250/@258", and the 0x00 bytes inside the name (@26, @34).
  - **Decode the packing first.** Fields then become contiguous 8-bit and 16-bit values [likely].
- **Name:** bytes 24–40, ASCII.
- **Tags:** a bit field in bytes 18 and 20–23, with 32 names (Bass, Lead, Pad, Texture, Chord, Keys, Brass, Strings, Transient, Sound FX, Kick, Snare, Hihat, Percussion, Atmosphere, Evolving, Noisy, Glitch, Hard, Soft, Expressive, Deep, Dark, Bright, Vintage, Acid, Epic, Fail, Tempo Sync, Input, Mine, Favourite).

### 3.2 Fields (raw-dump address; KA init value; display range), corrected against MAN

| Section | Param | Addr | Init | Display | MAN check |
|---|---|---|---|---|---|
| OSC1 | TUN | 43 | 0 (0x40) | Semitones, bipolar | Semitones; FUNC jumps an octave, a knob push jumps 4 semitones (MAN p.87) |
| OSC1 | FIN | 44 (+ sign bit @42) | 0 | −64…+63 | One full FIN turn moves TUN by a semitone (MAN p.87) |
| OSC1 | DET | 47 | 0 | −64…+63 | A linear detune in **Hz** (MAN p.87) |
| OSC1 | TRK | 52 | ON | OFF/ON | MAN p.87 |
| OSC1 | LEV | 56 | 100 | 0–127 | "Normal level is 100" (MAN p.87) |
| OSC1 | WAV | 61 | SAW | 8 options | MAN p.87 |
| OSC1 | SUB | 65 | OFF | 5 options | MAN p.72 |
| OSC1 | PW | 70 | centre | Bipolar | The centre is the default shape; it acts on all four waveforms (MAN p.72, p.87) |
| OSC1 | SPD / PWM | 75 / 79 | 10 / 0 | 0–127 | The dedicated PWM LFO (MAN p.87) |
| OSC1 | AM1 | 97 | OFF | OFF/ON | MAN p.88 |
| OSC2 | TUN FIN DET TRK LEV WAV SUB PW SPD PWM | 45 46 49 54 59 63 68 72 77 81 | as OSC1; LEV 0, SPD 37 | as OSC1 | WAV 6 = NEI (MAN p.88) |
| OSC2 | AM2 | 100 | OFF | OFF/ON | MAN p.88 |
| NOISE | S&H / FAD / LEV | 91 / 93 / 95 | 0 / 0 (0x40) / 0 | 0–127 / bipolar / 0–127 | MAN p.87 |
| NOISE | COL | 271 | 0 (0x40) | Bipolar | −64 red, −32 pink, 0 white, + highpass (MAN p.87) |
| OSC common | SMD / SNC / BND / SLI / TRG | 102 / 104 / 107 / 109 / 111 | OFF / 127 / 0 / 32 / OFF | | MAN p.88 |
| OSC common | Vibrato FAD / SPD / VIB | 113 / 116 / 118 | 0 / 32 / 0 | | MAN p.88 |
| Sound settings | Osc Drift / Portamento / Legato / "F1 Res Boost" | 280 / 281 / 283 / 285 | ON / 2 / OFF / ON | | OSCILLATOR DRIFT, PORTAMENTO (OFF/ON/LEGATO), LEGATO MODE, F1 RESONANCE BOOST all exist (MAN p.35) |
| F1 | FRQ (two decimals) / RES / OVR / TRK / DEP | 120 (+@114) / 123 / 125 / 127 / 129 | 127 / 20 / 0 (0x40) / 0 / 0 | | **OVR is bipolar** (MAN p.89). MAN p.73 gives a default RES of about 25 |
| F2 | FRQ / RES / TYP / TRK / DEP | 132 (+@130) / 134 / 136 / 139 / 141 | 0 / 12 / HP2 / 0 / 0 | | HP2 at minimum frequency, no resonance, is a pass-through (MAN p.73) |
| AMP | ATK / DEC / SUS / REL / SHP | 164 / 171 / 177 / 184 / 191 | 0 / 64 / 100 / 8 / 2 | KA: REL 127 = infinite | MAN p.90 |
| AMP | CHO / DEL / REV / PAN / VOL | 145 / 148 / 150 / 152 / 155 | 0 / 0 / 0 / centre / 100 | | MAN p.90 |
| ENVF | ATK DEC SUS REL SHP LEN | 159 166 173 180 187 193 | 0 64 64 8 2 0 | | LEN is in sequencer steps (MAN p.91) |
| ENVF | DST A / DEP A; DST B / DEP B | 198 / 207; 200 / 209 | OSC1 PW, 0; OSC2 PW, 0 | Depth bipolar, 14-bit | MAN p.91 |
| ENV2 | the same set | 161 168 175 182 189 196; 203 / 212; 205 / 214 | | | MAN p.91 |
| LFO1 | WAV / MOD / SPH / FAD / SPD / MUL | 239 / 235 / 230 / 225 / 216 / 221 | TRI / FREE / 0 / 0 / +48 / ×16 | SPD bipolar | MAN p.92 |
| LFO1 | DST A / DEP A; DST B / DEP B | 244 / 253; 246 / 255 | F1 freq, 0; F2 freq, 0 | | MAN p.92 |
| LFO2 | the same set | 241 237 232 228 219 223; 248 / 257; 251 / 260 | SPD +32 | | MAN p.92 |

### 3.3 Modulation destination codes [verified (KA, MG)]

These are the values of the ENVF, ENV2, LFO1 and LFO2 DEST parameters (decimal). The groups match the destinations MAN describes for the synth tracks (p.91–92).

| Group | Codes |
|---|---|
| OSC1 | Pitch Mod 18, Freq Mod 97, Linear Detune 2, Keytrack 4, Level 6, Waveform 8, Sub 10, PW 12, PWM Speed 14, PWM Depth 16, AM 24 |
| OSC2 | Pitch Mod 19, Freq Mod 98, Linear Detune 3, Keytrack 5, Level 7, Waveform 9, Sub 11, PW 13, PWM Speed 15, PWM Depth 17, AM 25 |
| OSC common (both oscillators) | Pitch Mod 20, Freq Mod 99, Sync Mode 26, Sync Amount 27, Bend Depth 28, Slide Time 29, Vibrato Fade 31, Vibrato Speed 32, Vibrato Depth 33 |
| NOISE | S&H 21, Color 100, Fade 22, Level 23 |
| FILTER | F1 Freq 34, F1 Res 35, F1 Overdrive 36, F1 EnvF Depth 38, F2 Freq 39, F2 Res 40, F2 EnvF Depth 43, **F1+F2 Freq 44** |
| AMP | Attack 53, Decay 56, Sustain 59, Release 62, Shape 65, Chorus 45, Delay 46, Reverb 47, Pan 48, Volume 49, **Accent Level 50** (MAN p.51: accent level is a modulation destination) |
| ENVF | Attack 51, Decay 54, Sustain 57, Release 60, Shape 63, Depth A 72, Depth B 73 |
| ENV2 (KA only) | Attack 52, Decay 55, Sustain 58, Release 61, Shape 64, Depth A 74, Depth B 75 |
| LFO1 | Speed 76, Multiplier 78, Fade 80, Start Phase 82, Depth A 92, Depth B 93 |
| None | 96 |

- No LFO2 parameter appears as a destination. So LFO2 (and the envelopes) can modulate LFO1, but nothing modulates LFO2 [likely].
- **FX LFO destinations** (MG): EXT IN L/R volume, pan and sends (0–9); chorus (26–35); delay (36, 37, 39–45); reverb (46–52); None 73.
- **CV ENV/LFO destinations** (MG): for each of CV A–D, coarse, fine, value, source, bend and slide; plus CV ENV1 parameters; None 68.

## 4. Firmware-derived facts (EMU, AH, EL): what the manual cannot tell you

All of these are for A4 MKII OS 1.56. "≈ MAN" marks a fact that the manual now confirms.

**Platform** [verified, EMU]:

- ColdFire MCF5441x, no DSP. The effects and the digital mix run on the CPU.
- An FPGA, a panel MCU, and SPI flash.
- SysEx firmware device byte 0x0B.
- The codec runs at 48 kHz, 24-bit, with 8 slots each way (≈ MAN p.85: 48 kHz, 24-bit converters).

**Control rate** [verified, EMU code reading]: the voice control frame (100 × 16-bit words over SPI) and the FX are computed once per 32-sample block. So envelopes and LFOs update at about **1.5 kHz**. MAN p.15 says only that the envelopes and LFOs are digital.

**Voice frame per voice** [verified, EMU measured]:

- osc1/osc2 trims (ramp-amplitude CVs);
- osc1/osc2 shape (from PW);
- osc1/osc2 level;
- ladder cutoff and ladder resonance;
- overdrive;
- multimode cutoff and multimode resonance;
- VCA L and VCA R, so **pan is the VCA pair** (≈ MAN p.15 "VCA/PAN");
- one switch word: osc wave bits and the multimode type;
- for each oscillator, a 32-bit NCO frequency word at 24.576 MHz, meaning digitally controlled pitch (≈ MAN p.15).

The 4 CV outputs are frame words 60–63 (≈ MAN p.85: 4 CV/Gate outputs).

**Scaling** [verified, EMU measured from the frame]:

- **TUN:** 1 semitone per step.
- **FIN:** 100/128 cent per step (≈ MAN p.87: one FIN turn = 1 semitone).
- **F1 cutoff word:** linear in FRQ, clamped to 0 below FRQ ≈ 20.
- **F2 cutoff word:** inverted and linear.
- **Overdrive word:** spans 0x15b4…0xea4b. EMU measured it as OVR "0…127". MAN p.89 shows OVR is bipolar, with negative values driving *inside* the filter, so the measured word is probably only the positive-side clipper [likely].

**Hz law** [verified for the Rytm MKII LP2 on a unit, MW]: f = 440 × 2^((FRQ−60)/12). That gives 13.8 Hz at 0 and 21.1 kHz at 127. It is likely for the A4's multimode filter, and approximately for the ladder.

**FX path** [verified, EMU measured]:

- Voices are digitised for the FX, scaled by a digital copy of each voice's VCA level, so the sends are effectively post-envelope.
- The FX return is added to the analog dry path (≈ MAN p.15).
- Delay TIM was measured as 1/128-note steps (≈ MAN p.95).

**Keys** [verified, AH tested on units]: 89 keys:

- 16 trigs, 13 keyboard keys, 8 banks, T1–T4/FX/CV;
- the 6 PARAMETER keys, ARP, NOTE, PERF, KIT, SND, MIX, TRK, PTN, SONG, FUNC, GLOBAL, QPER, TEMPO;
- YES, NO and the four arrows; CHAIN, SONG MODE, REC/PLAY/STOP, FILL, PAGE, OCT−/OCT+, TRNS;
- pushes on all ten DATA ENTRY knobs and on TRACK LEVEL.

MAIN VOLUME and power are not in the key maps (analog). QUICK PERF AMOUNT is an absolute pot input in the firmware (EMU).

**LED palette** [verified as what the OS sends, EMU]:

- Track keys red when active and green when audible (≈ MAN p.13).
- PLAY green while playing; STOP white while stopped.
- PARAMETER pages red/green. This matches MAN's colours for **grey** devices; black devices show white / dimmed white (MAN p.12). The OS presumably adapts to the device.

**Pages and views** [verified, EL]:

- 29 main-screen views.
- Page keys PERF, ARP, NOTE, OSC1, OSC2 (not on FX), FILTERS, AMP, ENV, LFO and MIX ("MIXER"); ≈ MAN pp.36–37, p.28.

**MKI vs MKII hardware** [verified, EMU MK1-PORT]:

| | MKI | MKII |
|---|---|---|
| Display | 122×32 LCD | 128×64 OLED |
| LEDs | 1-bit | RGB palette |
| USB | full speed | high speed with USB audio class |
| Voice frame | the same 100-word format | the same 100-word format |

## 5. The unit image (IMG) [verified as an image; provenance unknown]

- It shows a black A4 MKII from above, with every legend; it matches the manual's drawing (MAN p.12) element for element.
- The screen shows the OSC1 page of kit "K002:ALMANAZIR" at 88.3 BPM, with pattern B01.
- Measured positions agree with the manual drawing within 3 mm (`panel.md` §3).

## 6. Short manual quotes (25 words or fewer each; only where the wording matters)

| # | Quote | Cite |
|---|---|---|
| Q1 | "Secondary functions are written in underlined text on the panel (green text on grey devices)." | MAN p.13 |
| Q2 | "The flattest response is reached when resonance is somewhere around 25, which is also the default value." | MAN p.73 (ladder filter) |
| Q3 | "A setting of 32 will make the filter track the oscillator frequency in note intervals" | MAN p.89 (F1 and F2 TRK) |
| Q4 | "The noise generator is digital." | MAN p.15 |

Everything else is paraphrased with page cites in the other two files.

## 7. Resolved, corrected and still-open items

**Corrected by the manual.** These were wrong in my first edition or in other sources:

1. **The 5TH sub** is a 33 % pulse a **perfect fifth (7 semitones) below**, at 2/3 of the oscillator frequency (MAN p.72). It is not ÷3; my divider inference was wrong.
2. **OVR is bipolar** (MAN p.89):
   - 0 is clean;
   - positive values give clipping **after** F1;
   - negative values give a softer overdrive **inside** F1.
   MG's 0-based flag was wrong; KA's ±64 was right.
3. **BND is an auto-bend amount**, not a pitch-bend range. A trigged note starts offset and glides to pitch over the SLI time, and only the synced oscillator bends when sync is on (MAN p.88).
4. **Filter TRK 32 is 1:1 tracking**, not ±63 (MAN p.89).
5. **The PW knob reshapes all four waveforms** (MAN p.72, p.87):
   - SAW gains a second, phase-shifted saw;
   - PUL and TRP go silent at the extremes;
   - TRI morphs towards a reversed saw.
6. **The third LFO multiplier group ("tuning fork")** syncs LFO1 to OSC1 and LFO2 to OSC2 (MAN p.92).
7. **FUNC + QPER** mutes the *performance macros*, not the tracks (MAN p.12, p.27).
8. **The T1–CV legends under trig keys 1–6** are the PERFORMANCE-mode track mutes (MAN p.27).
9. **The letters A–P under the trig keys** select +Drive sound banks A–P in the sound browser and manager (MAN p.34).
10. **"Save" and "Reload" under YES/NO** are quick commands: [YES] or [NO] plus KIT, SND, TRK, PTN or SONG (MAN p.54, p.83).

**Confirmed from my first edition.** Each of these is now verified against the manual:

- The voice order (MAN p.15).
- FDB and NEI routing (MAN p.73).
- Linear detune in Hz (MAN p.87).
- The sync modes and the soft/hard sync amount (MAN p.88).
- The envelope restart dot (MAN p.74, p.90).
- The LFO modes (MAN p.92).
- The poly allocation options RESET, ROTATE, REASSIGN and UNISON (MAN p.29).
- The FX chain order (MAN p.110).
- The CV types (MAN p.63–64).
- Dimensions, weight and power (MAN p.85).

**Inconsistencies inside the manual:**

- p.36 says the octave changes with [UP]/[DOWN]; p.12 and p.41 give it to the [OCT−/+] keys.
- p.41 says a green track key marks the active track in step recording; p.13 and p.37 say red marks the active track.
- The voice-routing LEDs are described as full- or half-bright red on p.29, and as red or unlit on p.67.
- The FX LFO multiplier text mentions the tuning fork (sync to OSC1/OSC2), copied from the synth LFO page (MAN p.97). MG lists only 24 FX multipliers (no tuning-fork group), so the FX LFOs probably have only the × and · groups [likely].
- PW's centre is called "0" on p.72 and "64" on p.87. It is the same centre position either way.

**Still open** (not in the manual or the sources):

- The FRQ to Hz law for the A4 itself.
- Envelope times in ms per value.
- DET Hz per step and BND units.
- The absolute LFO rate formula.
- Chorus and reverb parameter units.
- Which value of each SHP pair carries the restart dot. MG and KA both say the odd values.
- The exact S&H behaviour of the noise.
- The meaning of "F1 RESONANCE BOOST" beyond MAN p.35's description.
