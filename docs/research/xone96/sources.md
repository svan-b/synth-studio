# Allen & Heath Xone:96: sources and evidence (v2)

**v2, 2026-10-29.** v1 relied on web-search snippets. Since then the coordinator has supplied the
official user guide, spec sheet and block diagram, which are now the **primary sources**. Everything
below is cited to them. Web material is kept only as secondary context.

## Rules followed (from `scratchpad/manuals/COPYRIGHT-RULES.md`)

- Facts (specs, ranges, labels, signal flow) are written in my own words, in tables.
- Quotes are short (25 words or fewer) and always page-cited.
- Diagrams in `signal-flow.md` are my own schematics, not tracings.
- No manual text, renders or PDFs go into the repository. Page renders made during this work
  (`research/xone96/work/`) were deleted at the end.

## Confidence marks

| Mark | Meaning |
|---|---|
| **V (UG p.N)** | verified (Xone:96 User Guide, p.N) |
| **V (BD)** | verified (Xone:96 User Guide, p.34, block diagram), as I read it |
| **M (UG p.N)** | measured by me from a response graph on that page |
| **L** / **G** | likely / guess (no direct statement in the documents) |

---

## 1. Primary documents (scratchpad copies under `scratchpad/manuals/xone96/`)

| Key | Document | Pages | Text and images |
|---|---|---|---|
| **UG** | *XONE:96 User Guide*, publication **AP11645 issue 2** (footer "AP11645_2"; the issue 1 text, © 2018, is on p.3). The "Original with Diagram" PDF. | 41 | `Xone_96_User_Guide_Original_with_Diagram/text.txt` (page markers), `hires/p-NN.png` |
| **BD** | Block diagram (= UG p.34) | 1 | `Xone_96_Block_Diagram_ONLY/hires/upright.png`, `tile-0..5.png` (no text layer) |
| **SPEC** | Spec-sheet extract (= UG p.35–36) | 2 | `Xone_96_Spec_Sheet_Extract/text.txt` |
| **WEB** | *Xone:96 User Guide*, 2026 web export (same content, re-paginated) | 26 | `Xone_96_User_Guide_2026_Web_Export/text.txt` |

Source PDFs: `scratchpad/manuals-raw/allen-heath/02_Allen_Heath/` (read-only reference).

### UG page map

| Page | Content |
|---|---|
| p.6 | Introduction (6+2 layout, dual soundcard, master insert) |
| p.7 | Top-panel overview, with a numbered photo of the whole panel |
| p.8–9 | CH A/B: sends and PRE, input select, GAIN, 3-band EQ (with response graphs), FILTER assign, CUE (AUTO and LATCHING), meter, fader |
| p.10–11 | CH 1–4: same, with 4-band EQ graphs and the XFADER assign |
| p.12 | XFADER (innoFADER, VCA) and the fader-curve switches, with curve graphs |
| p.13–14 | Xone:VCF: CRUNCH, RES, type select, FREQ, ON; state-variable reference with response graphs |
| p.15 | RTN C/D; master section (USB ACTIVE, MIDI 1/2) |
| p.16 | Meters; MASTER 1/2; USB 11/12 switch; PHONES 2 |
| p.17 | BOOTH and MONITOR sections |
| p.18–19 | Setup examples (drawings) |
| p.20–22 | Rear panel overview and connectors |
| p.23 | USB audio routing table |
| p.24–26 | Drivers and device checks |
| p.27–29 | MIDI control: counts, full table, channel setup, note/CC charts |
| p.30–33 | Traktor timecode setup and mix recording |
| p.34 | Block diagram |
| p.35–36 | Technical specifications |
| p.37–38 | Dimensions, weights and panel drawings |
| p.39 | Operating levels |
| p.40 | Earthing |

---

## 2. Spec-sheet figures (V UG p.35–37)

| Parameter | Value |
|---|---|
| Type, channels | Analogue, **6+2** (UG p.36) |
| Output levels, nominal (0 VU) / max | MASTER 1 +4 / +24 dBu · INSERT −2 dBu (nominal) · MASTER 2 +4 / +18 · BOOTH +4 / +18 · RECORD −8 / +10 dBu |
| Internal headroom | Channels +20 dB |
| Frequency response | LINE IN to MST out ±0.5 dB, 20 Hz–30 kHz |
| Distortion | Typically 0.03 % at 1 kHz, 0 dBu (THD+N, 22 Hz–22 kHz) |
| Crosstalk | < −85 dB inter-channel at 1 kHz, +10 dBu |
| Residual noise (22 Hz–22 kHz) | MASTER 1 −98, MASTER 2 −98, BOOTH −101 dBu |
| Mix noise | Master 1 −90, Master 2 −85, Booth −85, Record RCA −90 dBu |
| Mic gain | +40 dB; EIN −120 dB at 40 dB gain with a 150 Ω source |
| RIAA gain | +42 dB at 1 kHz (6 mV RMS = 0 VU) |
| Channel meters | 9 LEDs, −20 to +10 dBu |
| Master meters | **11 LEDs, −35 to +10 dBu** |
| EQ CH A/B | HI 3 kHz +6/−∞ · PARAMETRIC 190 Hz–2.75 kHz +10/−24 · LO 180 Hz +6/−∞ dB |
| EQ CH 1–4 | HI 3 kHz +6/−∞ · HI MID 1.1 kHz +10/−27 · LO MID 350 Hz +10/−27 · LO 180 Hz +6/−∞ dB |
| Channel faders 1–4 | 60 mm VCA, individually user-replaceable (spare 004-999X); < −85 dB shutoff |
| Crossfader | 45 mm innoFADER (MINI) VCA, user-replaceable (spare AI11470) |
| Filters | Dual stereo analogue VCFs: HPF/BPF/LPF, ON/OFF (soft-switched), FREQ/RES/CRUNCH; assignable to CH 1–4, A, B |
| Curves | Channel fader curve 3 types; crossfader curve 3 types |
| Booth | 3-band EQ, STEREO/MONO, MUTE, level |
| USB | Two cards, each 12 in / 12 out (6 stereo), Hi-Speed USB 2.0 (USB-B), macOS class-compliant, 32-bit/96 kHz. Rates 44.1/48/88.2/96 kHz; 16 or 32-bit; buffers 32–8192 samples; **0 dBu = −14 dBFS**; 2 MIDI in/out over USB |
| Inputs | Phono 4 × RCA (CH 1–4) with LN/PH switch for DVS · Line 4 × RCA (CH 1–4) · 4 × 1/4" TRS RTN A–D mono/stereo · 2 × XLR mic |
| Outputs | MST 1 XLR balanced · MASTER INSERT 2 × 1/4" (balanced send, unbalanced return) · MST 2 TRS balanced · BOOTH TRS balanced · RECORD RCA · SND 1/2 1/4" TRS mono/stereo · 1 LN/Hi-Z switch (SND 1 / RTN A) |
| Aux sends | 2 on CH 1–4 and CH A, B; SEND 1 selectable pre/post |
| MIDI | CC and Note on/off. Out: USB 1/2, 5-pin DIN, X:Link. In (USB 1/2): CUE, ON/OFF, MUTE |
| Power | Internal SMPS, 100–240 V AC 50/60 Hz, 45 W max, rear power switch |
| Size, weight | 339 W × 410 D × 109 H mm, 7 kg unpacked; packed 450 × 530 × 190 mm, 8.9 kg (UG p.37) |
| Mounting | Not compatible with standard Xone rack ears; optional X.96-RKX kit (UG p.38) |
| Launch | Announced 9–11 June 2018, US$1,999 (secondary: DJ TechTools, Resident Advisor, DJCity) |

---

## 3. Feature facts, by section (own words, page-cited)

### 3.1 Inputs and gain
- CH 1–4 select USB 1, PHONO, LINE or USB 2; CH A/B select USB 1, MIC, RTN or USB 2. Every position sends a MIDI note. (V UG p.8, p.10, p.28)
- GAIN runs **−∞ to +10 dB** on all six channels. (V UG p.8, p.10)
- The PK! LED sits beside GAIN and senses post-GAIN, pre-EQ. If it lights, turn GAIN down. (V UG p.10; BD)
- The rear USB LN/PH switches choose whether the computer receives the LINE input or the RIAA-equalised PHONO input of CH 1–4, for DVS or for recording. (V UG p.21; BD)
- PHONO is for magnetic cartridges; non-RIAA turntables go to LINE. (V UG p.21)
- RTN A/B are balanced 1/4" L/M + R. Use L/M for mono and Hi-Z devices. (V UG p.23)
- MIC A/B take low-impedance dynamic mics only; there is no phantom power. (V UG p.22)
- MIC has a **clean feed**: by default it skips BOOTH and is unaffected by the MASTER INSERT. (V UG p.22) Per the diagram it also bypasses FILTER SELECT, RECORD, USB MST and the headphone MST mixes, joining only MASTER 1/2. (V BD)

### 3.2 EQ
- Channels 1–4 have an asymmetric 4-band EQ: +6 dB or full kill on HI/LO, +10/−27 dB on the mids, at 3 kHz, 1.1 kHz, 350 Hz and 180 Hz. (V UG p.10)
- Channels A/B have a 3-band EQ: HI/LO +6 or kill; MID +10/−24 dB swept 190 Hz–2.75 kHz, with **650 Hz** at the centre of its legend. (V UG p.8)
- Measured responses (M UG p.8, p.10):
  - The kill skirts are about **12 dB/oct**.
  - The 4-band mids are narrow when boosted (Q ≈ 1.4) and wide when cut (Q ≈ 0.85).
  - The A/B swept mid is narrower: Q ≈ 2.3–2.5 boosted, about 1.2 cut.
- Short quote: "+6dB boost and full attenuation ('kill') for HI and LO frequencies" (UG p.10).

### 3.3 Faders, crossfader and curves
- CH 1–4 faders are 60 mm stereo linear VCAs, from fully off to unity. (V UG p.11) CH A/B faders are analogue, not VCA. (V UG p.9)
- The crossfader is a mini innoFADER VCA. It fades **CH 1–4** assigned to X or Y, and also scales signals routed to the filters. (V UG p.12)
- Curves:
  - CHANNEL FADER: "constant power, dipped, or fast-cut" (UG p.12).
  - XFADER: "constant power, transition, or fast-cut" (UG p.12).
  - Measured tables are in `signal-flow.md` §8.2. (M UG p.12)
- Calibration: set the XFADER curve switch (right-hand position) to FAST CUT and adjust the internal trim. (A&H "X96 XFADER calibration" PDF, via search)

### 3.4 Xone:VCF filters
- CRUNCH is pre-filter harmonic distortion: clean at 0, dramatic at 10, with an LED. "maintain VCF assigned channel levels between +/-6dB" for optimum drive. (V UG p.13)
- RES feeds output back to input: "MILD, with very subtle effect, to WILD" … "just short of self-oscillation" (UG p.13).
- FREQ sets the −3 dB cut-off, from 20 Hz anticlockwise to 20 kHz clockwise. (V UG p.13)
- FILTER ON per section: the signal is unaffected when OFF. (V UG p.13) CRUNCH is in the ON path only. (V BD)
- The filters are state-variable, with three simultaneous outputs. Any combination of type buttons can be pressed together, giving notch and all-pass effects; pressing one alone deselects the previous. (V UG p.14)
- Soft-switching covers ON/OFF, type changes and hot channel assigns. The last response is saved at power-off. (V UG p.14)
- Measured (M UG p.14): slope ≈ 12 dB/oct (2-pole); WILD peak ≈ +7.6 dB (Q ≈ 2.4); MILD ≈ Q 0.5; 12 o'clock ≈ Q 1; BPF peak = Q.
- All six main channels can be routed to either filter. Assign is post-GAIN/EQ/FADER (V UG p.9, p.11, p.13), into the FILTER 1/2 MIX buses, then CRUNCH, then the filter, then the LR MIX. (V BD)

### 3.5 Sends and returns
- SEND 1 and SEND 2 knobs (∞…+6) on all six main channels. SEND 1 has a **per-channel PRE** button and also feeds USB 9/10. SEND 2 is post-fader, with a switched option to USB 11/12. (V UG p.8, p.10; BD)
- Sends tap before FILTER SELECT. On CH 1–4 the post tap is after the VCA, so it follows the crossfader. (V BD)
- One LN/Hi-Z switch covers SND 1 and RTN A, for guitar pedals. (V UG p.21–22, p.36) Hi-Z: SND 1 −20 dB and left-only; RTN A +20 dB. (V BD)
- RTN C/D: ON/OFF (to the LR MIX, pre-MASTER), SIG LED, LEVEL (off…+10), CUE. No EQ, filter, sends or USB. (V UG p.15; BD)

### 3.6 Cue, headphones and meters
- CUE on CH 1–4, A–D. Pressing it routes to MONITOR and shows the pre-LR MIX level on the main meters. **AUTO-CUE** is the default; **LATCHING-CUE** is enabled from the panel. (V UG p.9, p.11, p.15)
- MONITOR section (V UG p.17):
  - CUE ACTIVE indicator.
  - **POST EQ** (global cue source, pre or post EQ).
  - **SPLIT CUE** (cue left, LR MIX right).
  - **CUE/MST** blend (anticlockwise = cue only; SPLIT overrides).
  - LEVEL (0–11); 1/4" TRS + 3.5 mm jacks.
- With no CUE active, the monitor path carries the program. (V BD; consistent with UG p.16)
- **PHONES 2**: a second, independent cue system with a 9-way source select (MST, 1–4, A–D), CUE/MST and LEVEL. It doesn't affect channel CUEs, BOOTH or MONITOR. (V UG p.16, p.7 panel)
- Main meters (V UG p.16):
  - They follow the monitor source.
  - LR MIX at pre-MASTER 1 level when nothing is cued.
  - The sum of cued channels when CUE is on.
  - In SPLIT, L shows CUE and R shows PRG.
- Meter legends (V UG p.7, p.11 panels):
  - Channel: −20 −15 −10 −6 −3 0 +3 +6 +10.
  - Master: −35 −25 −20 −15 −10 −6 −3 0 +3 +6 PK!.
- Operating level: average 0 with peaks around +6 (UG p.11, p.16); normal music between −6 and +6 (UG p.39).

### 3.7 Master, booth, record, USB, MIDI
- MASTER 1 and MASTER 2 are independent level controls feeding MST 1 (XLR) and MST 2 (1/4"). They don't affect the meters, RECORD, BOOTH, MONITOR or PHONES 2. (V UG p.16)
- The USB 11/12 source select picks MST (LR MIX) or SEND 2. (V UG p.16) The MST tap is pre-insert. (V BD)
- RECORD (RCA) and AUDIO SYNC OUT (3.5 mm) carry the pre-MASTER LR MIX. (V UG p.21) There is an internal option for pre- or post-insert (default post). (V BD)
- The MASTER INSERT is "INSERT points for the MST1 outputs" (UG p.22). Per the diagram it sits on the LR MIX before the music-only split. (V BD) Insert devices never affect the mics. (V UG p.22)
- BOOTH (V UG p.17; BD):
  - STEREO/MONO (also a mono-compatibility check).
  - Independent 3-band EQ (panel −8…+8; frequencies not given).
  - Level (0–10).
  - MUTE (MIDI).
  - Fed from the music-only bus.
- USB routing table: playback 1–8 → CH 1–4, 9/10 → CH A, 11/12 → CH B. Record 1–8 ← CH 1–4 LINE/PHONO, 9/10 ← SEND 1, 11/12 ← SEND 2 or MST. (V UG p.23)
- MIDI (V UG p.27–29):
  - 31 controls: 19 buttons, 5 faders, 7 rotary switches.
  - Default channel 16.
  - Full note/CC table and power-on channel setup.
  - MIDI 1/2 switches gate MIDI to the USB ports. (V UG p.15)
- X:LINK (RJ-45) connects Xone:K controllers. MIDI OUT is a 5-pin DIN. (V UG p.21)

---

## 4. Secondary sources (web, from v1)

These are kept for context. Every spec they gave is superseded by the documents above.

| Source | URL | Still useful for |
|---|---|---|
| DJ TechTools launch article (9 June 2018) | https://djtechtools.com/2018/06/09/allen-heath-officially-reveals-xone96-mixer-two-soundcards-sculpting-eq-dual-headphones | launch date |
| Resident Advisor news (11 June 2018) | https://ra.co/news/41924 | launch; "first flagship DJ mixer in over a decade" |
| DJCity | https://news.djcity.com/tag/allen-heath/ | price ($1,999), availability (August 2018) |
| The DJ Hookup review | https://thedjhookup.com/blog/reviews/allen-heath-xone-96-review | listening impressions of MILD/WILD and CRUNCH |
| DJWorx hands-on | https://djworx.com/hands-on-allen-heath-xone96-production-sample/ | no filter pops in practice |
| bonedo.de test | https://www.bonedo.de/artikel/allen-heath-xone96-test/ | CRUNCH replaces the Xone:92 LFO |
| A&H support articles | https://support.allen-heath.com/hc/en-gb/articles/24741954249233-Xone-96-Dual-Sound-Card-Routing · …/16931636088977 (BOSS DD pedal) · …/16930934580497 (BOSS RV pedal) · …/24706231458193 (mic recording) · …/25206304211729 (crossfader calibration) · …/24249679937297 (X:LINK) · …/43084536824849 (MIDI) | practical notes, consistent with UG |
| A&H X96 XFADER calibration PDF | https://www.allen-heath.com/content/uploads/2023/06/X96_XFADER-calibration.pdf | FAST CUT calibration |
| A&H user forum | https://forums.allen-heath.com/t/4-band-eq-total-kill/13164 · https://forums.allen-heath.com/t/xone-96-cue-problem/32592 | "all EQ down is not silent" (expected: mids −27 dB); master in the phones when nothing is cued |
| Elektronauts thread | https://www.elektronauts.com/t/xone-96-mixer/57659 | RES "neutral at 12 o'clock" with all filter types on; consistent with the UG p.14 all-pass note and the SVF maths |
| VirtualDJ Xone:96 manual | https://virtualdj.com/manuals/hardware/allenheath/96/mixer.html | software-side mapping notes |
| Dealer spec copies (HTFR, PSSL, Greentoe and others) | https://www.htfr.com/allen-heath-xone-96 | – (superseded by UG p.35–36) |

### v1 claims the official documents corrected

| v1 claim (from snippets) | Correct (documents) |
|---|---|
| A/B have an X-FADE assign (likely) | **No**: crossfader is CH 1–4 only (UG p.12; BD) |
| Rear LN/PH switch sets the PHONO jack to phono or line level | It selects LINE or RIAA-PHONO **for the USB send** (UG p.21; BD) |
| Several cues at once | Only in LATCHING-CUE mode; default AUTO-CUE is exclusive (UG p.9) |
| Channel meter top LED = PK! | Top LED is **+10**; PK! is a separate LED by GAIN (UG p.10–11; BD) |
| Curve names unknown | CH: constant power / dipped / fast-cut; XF: constant power / transition / fast-cut (UG p.12) |
| Filter range and slope unknown; 12 dB/oct a guess | 20 Hz–20 kHz (UG p.13); about 12 dB/oct measured (M UG p.14) |
| Booth MONO unverified | STEREO/MONO switch exists, plus MUTE (UG p.17) |
| PHONES 2 selection unknown | 9-way source select (UG p.16) |
| GAIN range unverified | −∞/+10 dB (UG p.8, p.10) |
| Mic excluded from booth **and record** (support article) | Guide: booth and insert (UG p.22). The diagram also excludes record, USB MST and the phones mix (BD). |
| Booth EQ about ±6 dB (diagram knob art) | The panel reads −8…+8 (UG p.17) |

---

## 5. Repositories

| Path | Repo | Licence | Result |
|---|---|---|---|
| `research/xone96/repos/mixxx/` | https://github.com/mixxxdj/mixxx at `ee17a27` (2026-10-25), blobless, no checkout (392 KB) | GPL-2.0-or-later | Only Xone:K2 mappings; **no Xone:96 mapping**. Nothing was copied. The GitHub search API was blocked, so no other repos were discoverable. |

---

## 6. Cross-check with the existing twin (commit 89801d8, identical to the main checkout)

Verified correct in the twin:
- the EQ figures and A/B swept range;
- the input selectors;
- GAIN −∞…+10;
- the 11-LED master meter thresholds;
- the channel-fader curve names;
- BOOTH MONO;
- the CUE/MST naming;
- the post-fader FILTER assign;
- the LR meters reading pre-MASTER.

Needs fixing: see the 11-point priority list in `signal-flow.md` §14. The main items are:
- A/B crossfader assign removed;
- the crossfader "dipped" label (should be transition);
- the curve laws;
- the channel meter legends and a PK! LED;
- the RES strength;
- FILTER ON;
- per-channel PRE and sends on A/B;
- AUTO-CUE;
- the mic clean feed;
- booth EQ and MUTE;
- MASTER 2;
- 339 mm width;
- `studio.mixerInputs`.

---

## 7. Still open (not stated in the documents)

1. Booth EQ band frequencies, and the shape and tapers of every knob (GAIN, EQ, SEND unity
   position, MASTER, MONITOR and PHONES legends 0–11 / 0–10).
2. The PK! threshold; meter ballistics.
3. The exact CRUNCH transfer curve.
4. The internal topology of the kill EQ (the measured shapes are enough for the twin).
5. Whether MST 2 really receives the insert: the guide wording says MST 1, the diagram says both.
   Follow the diagram.
6. PHONES 2 has no split mode or POST EQ switch of its own; per the diagram it follows the global
   POST EQ switch.
