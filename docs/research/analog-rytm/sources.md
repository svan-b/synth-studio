# Analog Rytm MKII: sources and extracted data (v2)

This is research for the Synth Studio twin. Read it together with `signal-flow.md` (spec), `presets.md` (kits) and `lessons.md` (curriculum).

**Confidence labels used in every file:**

| Label | Meaning |
|---|---|
| **verified (p.N)** | Stated in the OS 1.72 manual, or visible on its screen images. Facts are restated in our own words. |
| **likely** | A hardware-tested library (libanalogrytm, rytm-rs), or a clear inference from the manual. |
| **guess** | Not checked against a source. Used for DSP proposals and placeholders. |

---

## 1. Primary source: the manual

| Document | Where | Notes |
|---|---|---|
| **Analog Rytm MKII User Manual, OS 1.72** (Elektron; last updated 2025‑01‑30; 114 pages) | Text with page markers: `scratchpad/manuals/analog-rytm/Analog_Rytm_MKII_User_Manual_OS1.72/text.txt`. PDF: `scratchpad/manuals-raw/elektron/01_Elektron/Analog_Rytm_MKII_User_Manual_OS1.72.pdf` | Cited as "(p.N)" throughout |
| OS 1.71 archive manual | `…/Analog_Rytm_MKII_User_Manual_OS1.71_Archive/` | Not needed: no machine changes after 1.70 |

The copyright rules in `scratchpad/manuals/COPYRIGHT-RULES.md` apply:
- Facts go in our own words.
- Quotes are 25 words or fewer and carry a page cite.
- No manual text, renders or diagrams go into the repository.

The page renders I made to read the screens (Appendix A, B and D) were temporary and have been deleted.

**Where the facts are**

| Topic | Pages |
|---|---|
| Panel and rear connectors | p.10–12 |
| Sound architecture | p.13 |
| Data structure | p.14–15 |
| Pads, voices, machine menus, priority | p.21–22 |
| Modes | p.23 |
| Kits, scenes, performance, sound settings | p.26–36 |
| Sequencer | p.37–52 |
| Chains and songs | p.53–55 |
| Global settings: MIDI p.61–63, routing p.65–66, control and sequencer config p.66–67 | p.58–69 |
| Technical information | p.76 |
| Appendix A, drum-track pages | p.77–80 |
| Appendix B, FX pages | p.81–84 |
| Appendix C, MIDI CC/NRPN | p.85–95 |
| Appendix D, machine SRC pages (screen images) | p.96–109 |
| Appendix E, pad scales | p.110 |

---

## 2. Repositories cloned (for raw encodings and init values)

All are in `research/analog-rytm/repos/`, about 3 MB in total.

| Repo | Licence | Commit | Still useful for |
|---|---|---|---|
| [bsp2/libanalogrytm](https://github.com/bsp2/libanalogrytm) | **MIT** (© 2014–2017 bsp2) | `a0a19f6` (2023‑12‑21) | Sysex layout for FW 1.70: machine ids 0–33, per-track machine lists, sysex slot names, LFO and modulation destination ids, trig-flag bits, 65 trig conditions, retrig, Euclid, pad-scale encodings, global and settings fields |
| [alisomay/rytm-rs](https://github.com/alisomay/rytm-rs) | **MIT** (© 2023 Ali Somay) | `5638457` (2024‑12‑07) | Display ranges and **init values** per parameter (its README: "the actual range of values on the device"); the init kit's machines |
| [pencilresearch/midi](https://github.com/pencilresearch/midi) (sparse, `Elektron/` only) | **CC BY‑SA 4.0** | `776c9ef` (2026‑10‑26) | Upstream of the repo's midi.guide JSON. Its machine CC names were copied from Appendix C, errors included (§6). |

Derived working files:
- `research/analog-rytm/midiguide-dump.txt`
- `research/analog-rytm/rytm-rs-machines.txt`
- scripts in `scratchpad/scripts/rytm-research/`

Not cloned: alisomay/rytm-sys (bindings) and alisomay/rytm-external (a Max external). No open-source Rytm editor or librarian GUI exists.

**Web** (before the manual arrived; the search budget then ran out): the official release notes and press coverage of OS 1.70, 1.71 and 1.72 (URLs in §8). These remain the source for the OS history.

---

## 3. Corrections against v1

| v1 claim | Manual says | Ref |
|---|---|---|
| SRC encoders follow the sysex slot order, with LEV on A | No. LEV is on **H**, TUN on A and DEC on D for almost every machine, and the manual warns the MIDI order differs from the screen. | p.86, p.96–109 |
| Overdrive position unknown, guessed post-filter | OVR is a gain boost **before** the multimode filter | p.79, p.13 |
| AMP HLD 0–127 | **AUTO, 1–127**. AUTO lasts as long as the pad is pressed. | p.79 |
| DIST DEL/REV both default POST | DEL defaults to **PRE**, REV to **POST** | p.82 |
| LP1 and HP1 are 6 dB/oct 1-pole filters | All types are resonant 2-pole; the "1-pole" types only have a flatter slope | p.79 |
| SY DUAL VCO CFG "R" = reset/sync | "R" = **ring modulation**; "_" = oscillators reset on trig | p.103 |
| Tapping a pad selects its track | Selection is **[TRK] + pad**, unless AUTO TRK SWITCH is on | p.15, p.67 |
| Voice-pair priority unknown | **Right-hand track wins**: CP over RS, HT over MT, OH over CH, CB over CY | p.21 |
| One expression input | **Two** EXP/CV inputs (CONTROL IN 1 and 2) | p.27, p.76 |
| Only an AUDIO IN pair | Both AUDIO IN L/R (sampling, sound card) and **EXT IN L/R** (into the mixer before DIST and COMP) | p.12–13, p.76 |
| Factory content unknown | A01–B16 hold factory patterns by default; a factory reset rewrites +Drive project 1 and Sound bank A | p.20, p.70 |

---

## 4. Machines

**Ids.** These are the sysex and CC15 values (libanalogrytm; midi.guide agrees). **likely**

| id | Machine | id | Machine | id | Machine |
|---|---|---|---|---|---|
| 0 | BD HARD | 12 | CB CLASSIC | 24 | HH BASIC |
| 1 | BD CLASSIC | 13 | BD FM | 25 | CY RIDE |
| 2 | SD HARD | 14 | SD FM | 26 | BD SHARP |
| 3 | SD CLASSIC | 15 | UT NOISE | 27 | DISABLE |
| 4 | RS HARD | 16 | UT IMPULSE | 28 | SY DUAL VCO |
| 5 | RS CLASSIC | 17 | CH METALLIC | 29 | SY CHIP (OS 1.70) |
| 6 | CP CLASSIC | 18 | OH METALLIC | 30 | BD ACOUSTIC (OS 1.70) |
| 7 | BT CLASSIC | 19 | CY METALLIC | 31 | SD ACOUSTIC (OS 1.70) |
| 8 | XT CLASSIC | 20 | CB METALLIC | 32 | SY RAW (OS 1.70) |
| 9 | CH CLASSIC | 21 | BD PLASTIC | 33 | HH LAB (OS 1.70) |
| 10 | OH CLASSIC | 22 | BD SILKY | | |
| 11 | CY CLASSIC | 23 | SD NATURAL | | |

- **Machine list and per-track menus**: verified (p.21, p.96–109). They are reproduced in `signal-flow.md` §3.2.
- The **33 machines plus DISABLE** are unchanged in OS 1.71 and 1.72 (release notes, §8).
- Some screens show older names: "NOISE GEN" for UT NOISE, "IMPULSE" for UT IMPULSE and "DUAL VCO" for SY DUAL VCO (p.96, p.103). libanalogrytm records these renames as happening in FW 1.70.
- **SRC layouts**: verified from the screens (p.96–109), and given in full in `signal-flow.md` §9.

## 5. Track pages and FX pages

All are verified from the screens and text (p.43, p.78–83). Layouts are in `signal-flow.md` §4–5:

| Page | A–H |
|---|---|
| TRIG | NOT VEL LEN PRB / SYN SMP ENV LFO |
| SMPL | TUN FIN BR SMP / STA END LOP LEV |
| FLTR | ATK DEC SUS REL / FRQ RES TYP ENV |
| AMP | ATK HLD DEC OVR / DEL REV PAN VOL |
| LFO | SPD MUL FAD DST / WAV SPH MOD DEP |
| DELAY | TIM X WID FDB / HPF LPF REV VOL |
| REVERB | PRE DEC FRQ GAI / HPF LPF – VOL |
| DIST | AMT SYM DOV – / – – DEL REV |
| COMP | THR ATK REL MUP / RAT SEQ MIX VOL |

---

## 6. MIDI CC/NRPN (Appendix C, p.85–95) and the synth-parameter order

**Fixed parameters.** These are **verified (p.85–88)**.

| Group | CC | NRPN |
|---|---|---|
| TRIG: Note / Velocity / Length / Synth trig / Sample trig / ENV trig / LFO trig | 3 / 4 / 5 / 11 / 12 / 13 / 14 | 3:0–3:6 |
| Euclid: PL1, PL2, OP, RO1, RO2, TRO, on/off | 86, 87, 88, 89, 90, 91, 117 | 3:8–3:14 |
| Kit: Track level, mute, solo, machine type, active scene | 95, 94, 93, 15, 92 | 1:100–1:104 |
| Performance 1–12 | 35, 36, 37, 39–47 | 0:0–0:11 |
| Synth parameters 1–8 | 16–23 | 1:0–1:7 |
| Sample: TUN, FIN, BR, SMP, STA, END, LOP, LEV | 24–31 | 1:8–1:15 |
| Filter: ATK, DEC, SUS, REL, FRQ, RES, MODE, ENV | 70–77 | 1:16–1:23 |
| Amp: ATK, HLD, DEC, OVR, DEL, REV, PAN, VOL | 78, 79, 80, 81, 82, 83, 10, 7 | 1:24–1:31 |
| LFO: SPD, MUL, FAD, DST, WAV, SPH, MOD, DEP (DEP also uses LSB CC118) | 102–109 | 1:32–1:39 |
| FX channel, delay | 16–23 | 2:0–2:7 |
| FX channel, reverb (CC30 unused) | 24–29, 31 | 2:8–2:13, 2:15 |
| FX channel, distortion: AMT, SYM, DOV, DEL routing, REV routing | 70, 71, 72, 76, 77 | 2:16–2:18, 2:22, 2:23 |
| FX channel, compressor | 78–85 | 2:24–2:31 |
| Notes | 0–11 trigger tracks 1–12 (on default channels 1–12); 12–59 play the active track chromatically | p.95 |

**The synth-parameter order differs from the screen.** The manual warns about this itself (p.86). CC16 is always LEV.

The table compares Appendix C's order for CC16→23 with libanalogrytm's sysex slots 1→8. Where the two agree, the CC map is **verified**.

| Machine | Appendix C (CC16…23) | libanalogrytm slot 1…8 | Status |
|---|---|---|---|
| BD HARD | LEV TUN DEC HLD SWT "Sweep Depth" WAV TIC | LEV TUN DEC HLD SWT **SNP** WAV TIC | Agree, but Appendix C mislabels CC21: BD HARD has no SWD (p.97), so CC21 is **SNP** |
| BD CLASSIC | LEV TUN DEC HLD SWT SWD WAV TRA | same | ✓ |
| BD FM | LEV TUN DEC FMA SWT FMS FMD FMT | same | ✓ |
| SD HARD | LEV TUN DEC SWD TIC NOD NOL SWT | same | ✓ |
| SD CLASSIC | LEV TUN DEC DET SNP NOD NOL BAL | same | ✓ |
| SD FM | LEV TUN DEC FMT FMD NOD NOL FMA | same | ✓ |
| RS HARD | LEV TUN DEC SWD TIC NOL SYM SWT | same ("SYN" is a typo for SYM) | ✓ |
| RS CLASSIC | LEV T1 DEC BAL T2 SYM NOL TIC | same | ✓ |
| CP CLASSIC | LEV TON NOD NUM RAT NOL RND CPD | same | ✓ |
| XT CLASSIC | LEV TUN DEC SWD SWT NOD NOL TON | same | ✓ |
| CH/OH CLASSIC | LEV TUN DEC COL | same | ✓ |
| CH/OH METALLIC | LEV TUN DEC | same | ✓ |
| CY CLASSIC | LEV TUN DEC COL TON | same | ✓ |
| CY METALLIC | LEV TUN DEC TON TRD | same | ✓ |
| HH BASIC | LEV TUN DEC TON TRD RST | same | ✓ |
| HH LAB | LEV OSC1 DEC OSC2 OSC3 OSC4 OSC5 OSC6 | same | ✓ (Appendix C's NRPN LSB column repeats "3"; it should read 3–7) |
| CB CLASSIC/METALLIC | LEV TUN DEC DET | + PW1 PW2 on slots 5–6 | ✓, and Appendix C omits PW1/PW2 |
| **BD PLASTIC** | LEV TUN DEC SWD SWT HLD CLK DUS | LEV TUN DEC TYP MOD SWT SWD TIC | Appendix C is a **copy of BD SILKY** (BD PLASTIC has no HLD, CLK or DUS, p.98), so libanalogrytm is likely right |
| BD SILKY | LEV TUN DEC SWD SWT HLD CLK DUS | LEV TUN DEC HLD SWT SWD DUS CLK | Conflict: unverified |
| BD SHARP | LEV TUN DEC SWD SWT HLD TIC WAV | LEV TUN DEC HLD SWT SWD WAV TIC | Conflict. rytm-rs init values (slot 8 = 64, slot 7 an enum) favour libanalogrytm |
| BD ACOUSTIC | LEV TUN DEC SWD SWT HLD IMP WAV | LEV TUN DEC HLD SWT SWD WAV IMP | Conflict |
| SD NATURAL | LEV TUN BDY DEC LPF BAL RES HPF | LEV TUN BDY DEC BAL LPF HPF RES | Conflict |
| SD ACOUSTIC | LEV TUN BDY NOD HLD NOL IMP SWD | LEV TUN BDY NOD NOL HLD SWD IMP | Conflict |
| CY RIDE | LEV TUN DEC HIT TYP C1 C2 C3 | LEV TUN DEC TYP HIT C1 C2 C3 | Conflict (D and E) |
| BT CLASSIC | LEV TUN DEC SWD NOL SNP | LEV TUN DEC – NOL SNP SWD – | Conflict (where SWD sits) |
| SY DUAL VCO | LEV TUN DEC1 BAL DET CFG DEC2 BND | LEV TUN DEC1 DET DEC2 BAL BND CFG | Conflict |
| SY CHIP | LEV TUN DEC WAV SPD OF2 OF3 OF4 | LEV TUN DCY OF2 OF3 OF4 WAV SPD | Conflict |
| SY RAW | LEV TUN DEC NOL DET WAV1 WAV2 BAL | LEV TUN DCY DET NOL WAV1 WAV2 BAL | Conflict (D and E) |
| UT NOISE | LEV LPF DEC SWD SWT LPQ HPF ATK | LEV LPF DEC HPF LPQ ATK SWT SWD | Conflict |
| UT IMPULSE | LEV ATK DEC POL | LEV ATK DEC – – – – POL | Conflict |

**For the twin's own panel this doesn't matter**: use the screen layouts. For MIDI CC in and out on the conflicting machines, mark the mapping "unverified" and test on hardware. The midi.guide JSON in the repo inherits Appendix C, including the BD HARD label and the BD PLASTIC copy error.

**Ranges and init values by parameter name** (rytm-rs, **likely**; the manual states few ranges). These are listed per machine in sysex-slot order, which is not the panel order.

| Machine | Ranges and init values |
|---|---|
| BD HARD | TUN ±32 st (init −3) · DEC 47 · HLD 40 · SWT 90 · SNP 6 · WAV SIN · TIC 64 · LEV 100 |
| BD CLASSIC | TUN ±32 (−6) · DEC 32 · HLD 32 · SWT 64 · SWD 42 · WAV ASIN · TRA 17 |
| BD FM | TUN −6 · DEC 32 · FMA 32 · SWT 48 · FMS 32 · FMD 48 · FMT ±32 (−16) |
| BD PLASTIC | TUN −6 · DEC 80 · TYP B · MOD 32 · SWT 64 · SWD 100 · TIC 64 |
| BD SILKY | TUN −6 · DEC 64 · HLD 32 · SWT 64 · SWD 64 · DUS 64 · CLK 100 |
| BD SHARP | TUN −6 · DEC 80 · HLD 32 · SWT 100 · SWD 100 · TIC 64 · WAV sinA |
| BD ACOUSTIC | TUN −3 · DEC 64 · HLD 64 · SWT 80 · SWD 92 · IMP 64 · WAV sinA |
| SD HARD | TUN 0 · DEC 76 · SWD 127 · TIC 64 · NOD 32 · NOL 64 · SWT 43 |
| SD CLASSIC | TUN −6 · DEC 48 · DET 52 (0–127) · SNP 64 · NOD 64 · NOL 64 · BAL −32 (±63) |
| SD FM | TUN −6 · DEC 64 · FMT +12 · FMD 64 · NOD 32 · NOL 64 · FMA 127 |
| SD NATURAL | TUN +6 · BDY 90 · DEC 32 · BAL 64 (0–127) · LPF 90 · HPF 32 · RES 32 |
| SD ACOUSTIC | TUN ±24 (+6) · BDY 64 · NOD 64 · NOL 64 · HLD 64 · SWD 32 · IMP 64 |
| RS HARD | TUN 0 · DEC 52 · SWD 127 · TIC 48 · NOL 8 · SYM 64 · SWT 34 |
| RS CLASSIC | T1/T2 ±32 (0) · DEC 64 · BAL ±63 (0) · SYM ±63 (0) · NOL 16 · TIC 64 |
| CP CLASSIC | LEV 115 · TON 64 · NOD 55 · NUM 2 · RAT 85 · NOL 90 · RND 32 · CPD 90 |
| BT CLASSIC | TUN ±63 (+16) · DEC 63 · NOL 0 · SNP 0–3 (1) · SWD 0 |
| XT CLASSIC | LT / MT / HT: TUN +34 / +44 / +50 · DEC 52 / 70 / 89 · SWD 36 / 42 / 50 · SWT 34 / 29 / 27 · NOD 5 · NOL 85 / 100 / 100 · TON 0 |
| CH and OH CLASSIC | TUN 0 · DEC 32 · COL ±63 (0) |
| CH and OH METALLIC | DEC 40 |
| HH BASIC | LEV 110 · DEC 29 · TON 0 · TRD 68 · RST off |
| HH LAB | LEV 110 · DEC 29 · OSC 16-bit (displayed in Hz, p.106) |
| CY CLASSIC | LEV 127 · DEC 64 · COL 0 · TON 0 |
| CY METALLIC | DEC 35 · TON 35 · TRD 35 |
| CY RIDE | DEC 64 · TYP A · HIT 64 · C1 64 · C2 64 · C3 32 |
| CB CLASSIC | TUN +1 · DEC 20 · DET 64 · PW1 0 · PW2 0 |
| CB METALLIC | TUN +23 · DEC 50 · DET 64 |
| SY DUAL VCO | DEC1 70 · DET 0 · DEC2 70 · BAL 0 · BND 0 · CFG 16 |
| SY CHIP | TUN ±24 (+12) · DCY 42 · OF2 +3 · OF3 +7 · OF4 +10 |
| SY RAW | TUN ±24 (0) · DCY INF · DET −12 · NOL 15 · BAL 0 |
| UT NOISE | LPF 127 · DEC 40 (127 = INF) · HPF 0 · LPQ 0 · ATK 0 · SWT 64 · SWD ±63 (0) |
| UT IMPULSE | LEV 64 · ATK 0 · DEC 25 · POL POS |

Notes on these values:
- Unless shown otherwise, TUN on BD, SD and RS machines is ±32 st, and on toms, hats, cymbals and cowbells it is ±63 (uncalibrated).
- The manual's own unit statements take precedence where given: SY DUAL VCO TUN 0 = C‑2 with 24 units per octave, DET 48 units per octave, BND 24 units per octave; SY RAW TUNE 0 = C‑2 (p.103–104).
- For the conflicting machines above, the init values may be attached to the wrong name.

**Enumerations**

| Parameter | Values | Source |
|---|---|---|
| BD SHARP / BD ACOUSTIC WAV | 6 shapes × {reset, free} = 12 | p.99 |
| SY CHIP WAV | analog shapes, SID noise, Anim 1–5, PWM±, table waves, pulse 1–99 % | p.103–104 |
| SY CHIP SPD | 0–23 synced note values (128T … 1d), then Hz rates, then single-shot modes | likely (rytm-rs); categories verified on p.104 |
| SY DUAL VCO CFG | 80 = 2 (osc 1) × 5 (osc 2) × 4 modes (+ R F FR) × reset on/off | p.103; ordering per midi.guide |
| SY RAW WAV1 | 7 values (p.104). WAV2: 2 shapes × reset variant = 4 values | p.104; rytm-rs |
| CY RIDE TYP | A–D | likely (rytm-rs); "A" shown on p.108 |
| BT SNP | 4 values | likely (rytm-rs); the screen shows a 4-segment selector (p.105) |
| BD CLASSIC TRA | coded values (screen shows "C1"); CC 0–55 | p.97; midi.guide |
| LFO MUL | ×1 … ×2k and ·1 … ·2k | p.80 |
| LFO WAV | TRI SIN SQR SAW EXP RMP RND | p.80 |
| LFO MOD | FREE TRIG HOLD ONE HALF | p.80 |
| Retrig rates | 17 values, 1/1 … 1/80 | p.41 |
| COMP ATK, REL, RAT, SEQ | as in `signal-flow.md` §5.4 | p.83 |
| Trig conditions | probabilities (1–100 % in 22 steps, per libanalogrytm), FILL, PRE, NEI, 1ST and their negations, A:B from 1:2 to 8:8 | p.48–49 |

---

## 7. Other data structures (libanalogrytm, **likely**; the user-facing parts are verified in the manual)

| Structure | Contents |
|---|---|
| Pattern | 13 tracks × 64 steps. Per step: 14 trig-flag bits (ENABLE, RETRIG, MUTE, ACCENT, SWING, SLIDE, and the SYN/SMP/ENV/LFO switches with their lock bits), note, velocity, length index (0 = 1/128 … 14 = 1/16 … 126 = 8 bars, 127 = INF), micro timing ±23/384, retrig rate, length and curve, Sound lock. Per track: length 1–64, speed, quantize, trig probability, Euclid, pad scale and root. 72 p-lock lanes. Master length and change. Kit number. Swing 0–30 (= 50–80 %). Time mode. BPM ×120. |
| Kit | 12 Sounds, 13 track levels, FX parameters, FX LFO, 48 × 4-byte perf and scene slots, current scene, retrig menu per track, CTRL IN 1/2 mod slots |
| Sound | SRC slots 1–8, SMPL, FLTR, AMP, LFO, accent level (init 32), machine type, mode flags (ENV RESET, LEGACY FX, CHROMATIC, VEL→VOL), 4 velocity mods and 4 aftertouch mods |
| Global and settings | MIDI channels; sync; port functions (MIDI, DIN24, DIN48); routing bit-masks (ROUTE TO MAIN, SEND TO FX); USB IN, OUT and TO MAIN; sample-recorder source list (AUD L+R/L/R, BD, SD, RS/CP, BT, LT, MT/HT, CH/OH, CY/CB, MAIN, USB L/R/L+R); fixed velocity; pattern mode; auto track switch |

---

## 8. OS history (web search, before the manual)

| OS | Changes | Sources |
|---|---|---|
| **1.70** (Nov 2023) | Five new machines: SY CHIP, SY RAW, BD ACOUSTIC, SD ACOUSTIC, HH LAB. Euclidean mode, pad scales and fold, page loop, Sound save from trigs, LFO RND slew, sampler record length, tuning calibration. 33 machines in total. | [elektron.se release notes](https://www.elektron.se/analog-rytm-mkii-os-release-notes) · [SonicState](https://www.sonicstate.com/news/2023/11/23/elektron-updates-analog-rytm/) · [MusicRadar](https://www.musicradar.com/news/elektron-analog-rytm-os-update) · [Synthtopia](https://www.synthtopia.com/content/2023/12/09/analog-rytm-1-70-upgrade-in-depth/) · [CDM](https://cdm.link/analog-rytm-os-update/) |
| **1.71** | Euclid randomize respects the track length; Overbridge 2.13; bug fixes | release notes, via search |
| **1.72** | SAMPLE POS RES; page-playback shortcut; fixes, among them sample-lock removal on SMPL knob D | release notes · [Elektronauts](https://elektronauts.com/t/os-updates-analog-rytm-1-72-syntakt-1-30b/228311). The manual (p.38, p.67) confirms both features. |

## 9. Factory content

| Fact | Ref |
|---|---|
| The unit ships with preset patterns, kits and Sounds. A01 is the first demo pattern, A02 the second, and so on. The factory kits include preset performance macros and scenes. | p.19 |
| *"Pattern A01 to B16 are by default used by factory preset content."* | p.20 |
| A factory reset rewrites +Drive project slot 1 with the factory patterns, kits, Sounds and settings, and rewrites Sound bank A with the factory Sounds | p.70 |
| The +Drive sample bank has a write-protected FACTORY directory with ten subdirectories, for example PERCUSSION | p.58 |

The names of factory kits, patterns and Elektron sound packs are **not in the manual**, and could not be verified online. Don't credit names until they are checked on elektron.se.

## 10. Open items

1. The CC map for the 12 conflicting machines (§6). Test on hardware.
2. What AMP HLD AUTO does for *sequenced* trigs (the manual covers pads only). Proposal: trig LEN.
3. The tempo range (not stated). Proposal: 30–300 BPM.
4. The exact tap points of the sends and the individual outputs (the diagram shows them around the AMP). Proposal: after the amp.
5. Display units of TUN on non-BD machines, and of the HH LAB OSC values (Hz is shown on screen).
