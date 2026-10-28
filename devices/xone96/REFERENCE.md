# Allen & Heath Xone:96 - hardware reference for the digital twin

Ground truth used to build `devices/xone96`. Every top-panel control, switch, LED, meter and section is
listed with its printed label, position, cap, range and a source with a confidence level, followed by
the rear-panel I/O the twin models, behaviour notes and the values that are guesses.

- **verified**: quoted from Allen & Heath documentation (User Guide, Quick Start Guide, support
  articles, spec sheet) through search-result excerpts, or two independent sources agree.
- **likely**: one good secondary source (a review, a dealer spec sheet), Xone-family lineage, or a
  direct consequence of verified facts.
- **guess**: not documented anywhere we could reach. Chosen to match the documented behaviour and
  listed again under "Model choices" so they can be checked against a unit.

`docs/reference/xone96/` does not exist, so there were no photos to read. The network blocks
allen-heath.com, the support site, manual mirrors and image hosts; manual text comes from web-search
excerpts that quote the documents. The research notes in the session scratchpad
(`research/xone96/sources.md`) were cross-checked against these; where they disagree, the
better-sourced claim wins and the disagreement is listed under "Disagreements".

## Sources

| Id | Source |
|----|--------|
| UG | *Xone:96 User Guide* AP11645 (41 pages; ManualsLib page numbers p.10-17 for the top panel, p.35 specifications), quoted through search excerpts |
| QSG | *Xone:96 Quick Start Guide* AP11255 ("Front Panel Overview"), through search excerpts |
| SUP | Allen & Heath support articles: "Xone & PD series master level settings", "Xone:96 Connecting a BOSS DD-7 / RV-6 pedal" (send/return), "Xone:96 Cue system configuration", "Xone:96 MIDI Implementation" and the basic MIDI sheet, "Dual Sound Card Routing" |
| SPEC | Spec sheets reproduced by dealers (HTFR, PSSL, Full Compass, B&H, Thomann, DJ Tech Tools, Long & McQuade, Digital DJ Tips, DJWorx spec breakdown) |
| REV | Reviews: ask.video, The DJ Hookup ("Hands-On Deep Dive"), DJWorx ("REVEALED" and "HANDS-ON production sample"), DJ Booth, Attack Magazine, re:union Radio |
| PARTS | A&H spare-parts listings (Pixel Pro Audio, Instrumental Parts, SBS AV, the distributor "Xone:96 Parts Identification Guide") |
| RES | Session research notes `research/xone96/sources.md` (same constraints: snippets only) |
| X92 | Xone:92 user guide / dealer copy, used only for lineage |

## Panel

- Top panel 336 mm wide × 410 mm deep × 109 mm high, about 7 kg. **verified** (SPEC: Full Compass,
  Long & McQuade, Digital DJ Tips, manua.ls spec page all agree).
- Light-grey / silver faceplate with dark legends, a callback to the original Xone:92. **verified**
  (REV: DJWorx "REVEALED" "the call back to the original light-grey faceplate"; DJWorx hands-on
  "similar silver finish"; dealer titles "Silver").
- Knobs are black with a white line; fader knobs are 12 mm black with a white line. **verified**
  (PARTS: "KNOB BK-WH.L SOFT SML", "KNOB BLK W/ WHITE LINE LARGE", "KNOB FDR 12MM BK-WH"). The twin
  uses one black cap style; the FREQ knobs are drawn larger (18 mm) as on the Xone:92 (**likely**).
- Left to right: auxiliary channels **A** and **B** on the far left, stereo channels **1-4**, then the
  master section. **likely** (REV ask.video "On the far left of the mixer are return channels A and B";
  UG lists Input Channels A-B before 1-4).
- The two Xone:VCF sections sit either side of the crossfader at the bottom. **likely** (Xone:92 layout
  lineage, REV "VCFs on either side").
- 6 + 2 channels: four stereo channels with the 4-band EQ, two stereo channels (A, B) with the 3-band
  parametric EQ, and two auxiliary stereo returns (C, D) in the master section. **verified** (UG, SPEC).
- Printed scale marks are drawn in dark grey around every knob (the twin's knob component draws light
  ticks for dark panels). Positions below are the twin's coordinates in mm (x from the left edge, y from
  the top of the faceplate; channel controls are given relative to the strip centre `cx`, with
  `cx` = A 23, B 64, 1 105, 2 146, 3 187, 4 228). Positions are **guesses** read from the documented
  order of the controls, unless stated.

## Channel strips (A, B, 1-4)

Strip order top to bottom follows REV ("above the EQs, you can select the source"; "filter and
crossfader assignment is done with switches below the EQ"). Each channel's controls:

| Printed label | Position | Cap / style | Range / positions | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| (input select) USB 1 / PHONO / LINE / USB 2 | top, (cx, 14) | 4-way selector, drawn as 4 small buttons | channels 1-4 | `ch1_input`… 0-3, default LINE | QSG "Switch CH 1 - 4 inputs between USB 1, PHONO, LINE, or USB 2 sources" | **verified** |
| (input select) USB 1 / MIC / RTN / USB 2 | top, (cx, 14) | as above | channels A, B | `cha_input`, `chb_input`, default RTN | QSG "Switch CH A and CH B inputs between USB 1, MIC, RTN, or USB 2" | **verified** |
| GAIN | (cx-6, 30) | black, 11 mm | -∞ … +10 dB | `ch*_gain` -40 (= -∞) … +10 dB, linear in dB | UG "Channel GAIN Control … -∞ /+10dB" | **verified** (taper: **guess**) |
| HI | (cx-6, 48) | black, 10.5 mm | +6 dB … full kill, 3 kHz | `ch*_hi` -1 … +1 (centre 0 dB) | UG/QSG "+6dB boost and full attenuation ('kill') for HI and LO", "HI 3kHz" | **verified** |
| HI MID | (cx-6, 65) | black, 10.5 mm | +10 / -27 dB at 1.1 kHz | `ch1_himid`… channels 1-4 | UG "+10dB boost/-27dB cut for HI MID and LO MID", "HI MID 1.1kHz" | **verified** |
| LO MID | (cx-6, 82) | black, 10.5 mm | +10 / -27 dB at 350 Hz | `ch1_lomid`… channels 1-4 | UG "LO MID 350Hz" | **verified** |
| MID (swept) | (cx-6, 82) | black, 10.5 mm | +10 / -24 dB | `cha_mid`, `chb_mid` | UG "+10dB boost/-24dB cut, swept parametric MID" | **verified** |
| FREQ (MID) | (cx-6, 65) | black, 9.5 mm | 190 Hz … 2.75 kHz (650 Hz at centre on the legend) | `cha_midf`, `chb_midf` log, default 700 Hz | UG "MID: 190Hz - 2.75kHz (Parametric, sweep)"; RES "190Hz / 650Hz / 2.75kHz" | **verified** range, **likely** legend |
| LO | (cx-6, 99) | black, 10.5 mm | +6 dB … full kill, 180 Hz | `ch*_lo` | UG "LO 180Hz" | **verified** |
| (channel meter) | right of the EQ, (cx+5.5, 37-105) | 9 LEDs: -20 -12 -6 -3 0 +3 +6 +10 PK! | post-GAIN, post-EQ, pre-fader | engine snapshot | UG "metered at post-GAIN / post-EQ and pre-FADER level"; SPEC "9 LED -20dBu to +10dBu"; QSG "+10 LED", "PK! LED" | **verified** count, range, tap; intermediate legends **likely** |
| SEND 1 | (cx-9, 116) | black, 8.5 mm | off … full | `ch*_snd1` 0-10, unity at 10 | UG "SEND 1 … switchable pre/post-FADER"; RES "each channel has two FX sends" | **verified** (on A/B: **likely**) |
| PRE (SEND 1) | (cx-9, 126) | small push button, amber LED | pre / post fader, per channel | `ch*_pre` | SUP DD-7 article "SEND 1 can be set to pre- or post-fade for each channel"; REV Hook Up "the Send 1 control has a 'Pre' button" | **verified** (LED colour **guess**) |
| SEND 2 | (cx+9, 116) | black, 8.5 mm | off … full, post-fader | `ch*_snd2` | UG "SEND 2 is fixed post-FADER" | **verified** |
| FILTER | (cx, 137) | 3-position switch, drawn as buttons | 1 / OFF / 2 | `ch*_filter` default OFF | UG "route post-GAIN / post-EQ / post-FADER level channel audio to FILTER 1 (left) or FILTER 2 (right), or direct to the LR MIX bus when OFF (centre)" | **verified** |
| XFADER | (cx, 149) | 3-position switch | X / OFF / Y | `ch*_xf` default OFF | UG "to X (left) or Y (right), side of the XFADER, or direct to the LR MIX bus when OFF (centre)" | **verified** |
| CUE | (cx, 161) | push button, red when lit | toggle; AUTO-CUE by default | `ch*_cue` | UG "The switches light red when active", "Default switch setting is AUTO-CUE" | **verified** |
| (channel fader) CH 1 … CH 4, A, B | (cx, 171-231), 60 mm | black 12 mm cap with white line | off … unity | `ch*_fader` 0-10 | SPEC "60mm … VCA channel faders"; UG "fully off and unity" | **verified** (VCA on 1-4; A/B faders not VCA: **likely**, RES) |
| (channel number) A B 1 2 3 4 | (cx, 241) | printed | | | | **likely** |

## Xone:VCF sections (FILTER 1, FILTER 2)

| Printed label | Position (FILTER 1; FILTER 2 mirrored) | Cap / style | Range / positions | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| ON | (18, 264) | push button, blue LED | on / off; off = signal unaffected | `f1_on`, `f2_on` default off | UG "Each VCF has its own ON switch. The switch illuminates BLUE … The signal is not affected by the FILTER if set OFF" | **verified** (power-up state **guess**) |
| HPF · BPF · LPF | (38-64, 264) | three push buttons, red LED | one selects, two or three pressed together combine (HPF+LPF = notch, all three = "all-pass") | `f1_type` 7 options (HPF, BPF, LPF, HPF+BPF, BPF+LPF, NOTCH, ALL PASS) | UG "the three types run simultaneously, and any combination can be pressed together to create … 'notch' and interesting 'all-pass' effects"; X92 "HPF+LPF = NOTCH" | **verified** (LED colour **guess**) |
| FREQ | (70, 297) | large black, 18 mm | 20 Hz … 20 kHz, the -3 dB point | `f*_freq` log | UG "sets the -3dB cut-off frequency … 20Hz … 20kHz" | **verified** |
| RES | (22, 299) | black, 11.5 mm, legend MILD … WILD | subtle … "just short of self-oscillation" | `f*_res` 0-10 | UG/X42 "from MILD … to WILD … feedback just short of self-oscillation" | **verified** |
| CRUNCH | (22, 328) | black, 11.5 mm, with red LED | 0 clean … 10 "distorts dramatically"; pre-filter | `f*_crunch` 0-10 | UG "Turn clockwise to add harmonic distortion (CRUNCH!) into the pre-FILTER signal path … Set to 10 … LED illuminates RED"; "maintain VCF assigned channel levels between +/-6dB" | **verified** |
| (no LFO) | | | the Xone:92's filter LFO is gone | | REV "dropped the LFO", bonedo "CRUNCH replaces the LFO" | **verified** |

## Crossfader and curves

| Printed label | Position | Cap / style | Range / positions | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| (crossfader) X … Y | (126, 300), 45 mm horizontal | innoFADER Mini, black cap | X fully left, Y fully right; a VCA | `xfader` 0-10 | SPEC "InnoFADER … 45mm VCA"; UG "the XFADER is a VCA … also affects the level of signals routed to the Filters" | **verified** |
| XFADER curve | (126, 262) | 3-position switch | CONSTANT POWER · TRANSITION · FAST CUT (rightmost) | `xf_curve` | UG p.12 "Switch between constant power, transition, or fast-cut"; SUP calibration "XFADER curve switch, right, to FAST CUT" | **verified** |
| CHANNEL FADER curve | master column, (292, 238) | 3-position switch | CONSTANT POWER · DIPPED · FAST CUT, CH 1-4 only | `fader_curve` | UG p.12 "global fader response for Stereo Input Channels 1-4 … constant power, dipped, or fast-cut"; REV "on the right hand side of the mixer is a three way fader curve selector" | **verified** (position: **likely**) |

## Master column

| Printed label | Position | Cap / style | Range / positions | Twin control | Source | Confidence |
|---|---|---|---|---|---|---|
| LR MIX meters | (253-280, 11-77) | 2 × 11 LEDs: -35 -25 -20 -15 -10 -6 -3 0 +3 +6 +10 | pre-MASTER 1; show the cue while a CUE is on; SPLIT CUE: left = cue, right = mix | engine snapshot | UG "meters display the LR MIX at the pre-MASTER 1 control level", "view pre-LR MIX levels on the main LR MIX meters", "In SPLIT CUE mode, the Left meter shows … CUE"; SPEC (DJWorx) "11 segment -35 dBu to +10 dBu" | **verified** behaviour; LED count **likely** |
| CUE (indicator) | (293, 13) | red LED | lit while any CUE is on | | QSG "CUE ACTIVE indicator" | **verified** |
| MASTER 1 | (314, 25) | large black, 15 mm | off … +6 dB; unity two notches below max (about 3 o'clock) | `master` 0-10, unity at 8 | SUP master level settings "unity on Master 1 is around 3 o'clock (two notches below max) … At Max … +6dBu" | **likely** (article covers Xone & PD series) |
| (MASTER 2) | | | MST 2 jack outputs | not modelled | UG "Independent MASTER 1 and MASTER 2 controls" | **verified** |
| BOOTH | (314, 55) | black, 11 mm | level of the rear BOOTH outputs | `booth` 0-10, unity at 8 | UG booth section | **verified** (law **guess**) |
| MONO · MUTE | (302, 72), (320, 72) | push buttons, amber / red | booth mono sum; booth mute | `booth_mono`, `booth_mute` | UG "Stereo/Mono switch … can also make the booth output mono"; "MUTE … illuminates RED" | **verified** (MONO LED colour **guess**) |
| BOOTH EQ HI · MID · LO | (266, 94), (292, 94), (318, 94) | black, 8.5 mm | ±8 dB | `booth_hi/mid/lo` | QSG "+/-8dB"; REV DJ Booth "booth output has separate EQ" | **verified** range; frequencies **guess** (10 kHz shelf, 1 kHz bell, 100 Hz shelf) |
| RTN C / RTN D: LEVEL | (266, 126), (308, 126) | black, 9 mm | off … +10 dB | `rtnc_level`, `rtnd_level` | UG "LEVEL … from fully off to +10dBu"; "go direct to the LR MIX at pre-MST levels" | **verified** |
| RTN C / RTN D: SIG | (279, 121), (321, 121) | bi-colour LED | green = signal, red = too hot | engine snapshot | UG "bi-colour SIG LED … GREEN … If it illuminates RED continuously, turn … LEVEL down" | **verified** (thresholds **guess**) |
| RTN C / RTN D: ON · CUE | (264/278, 144), (306/320, 144) | push buttons | on/off; cue | `rtn*_on`, `rtn*_cue` | UG "ON/OFF switch … CUE switch"; MIDI chart "ON SW CH C/D", CUE CH A-D | **verified** |
| MONITOR: CUE / MST | (270, 176) | black, 10.5 mm | cue only … master only | `cue_mix` | UG "CUE/MST … fully counterclockwise, only the active cue channels … clockwise adds the LR mix" | **verified** (QSG spells it CUE/ADD MIX) |
| MONITOR: LEVEL | (314, 176) | black, 11.5 mm | headphone level | `phones` | UG "LEVEL: Adjusts the level of audio in MONITOR headphone outputs" | **verified** |
| SPLIT CUE | (270, 200) | push button | cue left, LR MIX right | `split_cue` | UG "route to the Left side of the MONITOR headphones and the LR MIX to the Right"; overrides CUE/MST | **verified** |
| POST EQ | (314, 200) | push button | channel cue after (lit) or before the EQ | `cue_post_eq` default on | UG "POST EQ Switch: Switch global channel CUE source between pre & post-EQ" | **verified** |
| (PHONES 2 section) | | 9-way source select, CUE/MST, LEVEL | | not modelled | UG "PHONES 2 … dedicated 9-way source select" | **verified** |
| (USB 11/12, MIDI 1/2 switches) | | | USB routing and MIDI enable | not modelled | UG, SUP | **verified** |

## Rear and front panel I/O that the twin models

| Connector | Hardware | Twin |
|---|---|---|
| CH 1-4 LINE (RCA) | line inputs; LN/PH switch for DVS | **studio_1 … studio_4** ("CH 1 (LINE)" … "CH 4 (LINE)"): a studio instrument routed here plays on the channel's LINE position |
| CH 1-4 PHONO (RCA) | turntable inputs | the channel's built-in deck (twin only) |
| RTN A / RTN B (1/4" TRS L/M + R) | stereo returns, heard on CH A / CH B with INPUT on RTN | **studio_a / studio_b** ("CH A (RTN A)", "CH B (RTN B)"); otherwise the stand-in FX unit's returns (delay on A, reverb on B), as in SUP's BOSS pedal articles |
| RTN C / RTN D (1/4" TRS) | auxiliary returns to the LR MIX | **studio_c / studio_d** ("RTN C", "RTN D") |
| MIC A / MIC B (XLR) | mic inputs on CH A / B | the channel's built-in deck (VOX LEAD / PAD) |
| SND 1 / SND 2 | effect sends (SND 1 LN / Hi-Z switch) | feed the stand-in delay (SEND 1) and reverb (SEND 2) |
| USB 1 / USB 2 (two 32-bit soundcards) | computer audio | your own audio file, looping on the channel's USB positions |
| MST 1 XLR (+4 dBu nominal, +24 dBu max) | main output | the instrument's stereo output into the studio (`studio.stereo`) |
| BOOTH (TRS), MONITOR phones | booth and headphones | heard through the twin-only YOU HEAR selector |
| MST 2, REC, master insert, MIDI OUT, X:LINK, PHONES 2 | | not modelled |

Sources: SPEC ("4 x RCA (CH 1-4) LN/PH Switch for DVS", "4 x 1/4″ TRS (CH A-D) Mono/Stereo", "2 x XLR",
output levels "MASTER 1 +4dBu / +24dBu", "Master 2 … Booth … +18dBu", "Record +10dBu"), UG, SUP.
**verified**.

## Signal flow (as modelled)

```
input select ─► GAIN (-∞…+10 dB) ─► EQ ─► channel amp (+20 dBu) ─┬─► channel meter (pre-fader)
                                                                 ├─► CUE (POST EQ, or pre-EQ after GAIN)
                                                                 ├─► SEND 1 when PRE is lit
                                                   channel fader ┘
                                                        ├─► SEND 1 (post) / SEND 2 (post)
                                                        └─► XFADER VCA (X / OFF / Y) ─► FILTER 1 / OFF / 2 ─┐
FILTER n: CRUNCH (pre-filter) ─► state-variable HPF/BPF/LPF ─────────────────────────────────────────────┤
RTN C / RTN D: LEVEL, ON ────────────────────────────────────────────────────────────────────────────────┴─► LR MIX (+21 dBu)
LR MIX ─► LR meters ─► MASTER 1 (+24 dBu) ─► studio      ─► BOOTH (EQ, MONO, MUTE)      ─► MONITOR (CUE/MST, SPLIT)
```

Tap points: UG for the meter, cue, FILTER and XFADER assigns ("post-GAIN / post-EQ / post-FADER"),
the XFADER as a VCA ahead of the filters, SEND 2 post-fader and the RTN C/D path. **verified**. That
POST sends are taken after the channel fader but before the crossfader is a **guess** (RES open
question 7).

## Behaviour notes

- **Kills.** HI and LO cut to a full kill and boost +6 dB; the mids cut -27 dB (A/B -24 dB) and never
  kill, so with every EQ knob down some mid-range remains, as owners report (RES, A&H forum "4 band EQ
  total kill"). The twin builds the kill bands with Linkwitz-Riley crossovers at 180 Hz and 3 kHz so
  the bands sum flat at 0 dB; see the slope note under "Disagreements".
- **Asymmetric EQ.** Cut range larger than boost range on every band. **verified** (UG "asymmetric").
- **Meter targets.** "The meter averages around 0 with loudest peaks around +6"; "+10 LED illuminated
  continuously → turn GAIN or boosted EQ down"; "PK! … turn GAIN down". **verified** (UG/QSG).
- **Headroom.** 20 dB on the channels. **verified** (SPEC "Headroom 20 dB", "Channels +20dB").
- **AUTO-CUE.** Selecting a CUE cancels the others; holding the filter-type buttons switches to
  latching cue (not modelled). With nothing cued the headphones hear the master mix. **verified**
  (UG, SUP) / **likely** (RES, A&H forum, for the master-when-not-cued behaviour).
- **Cue tap.** The cue is pre-fader and pre-filter (you cannot hear the filter in the headphones).
  **verified** (UG; REV Hook Up "the Cue system is pre-filter").
- **Filters.** Soft-switched: no pops when switching type or ON. **verified** (REV DJWorx "no sign of
  filter pop"). All three types on with RES at noon is neutral. **likely** (RES, Elektronauts).
- **CRUNCH** acts only while the filter is ON and a channel is assigned. **verified** (REV).
- **A/B sends into their own returns** create feedback loops, which DJs use for dub effects. The twin
  allows it (the reverb return carries one 2.7 ms render quantum so the loop is legal in Web Audio).

## Disagreements between sources (and what the twin does)

| Topic | Claims | Twin |
|---|---|---|
| SEND 1 PRE | Earlier twin: one global switch. SUP DD-7 article: "pre- or post-fade for each channel". | Per-channel PRE buttons (SUP is A&H). |
| Sends on A/B | Earlier twin: none. RES: dealer "each channel has two FX sends", Elektronauts mic recording via the A/B channel's SEND 1 + PRE. | A/B have SEND 1, SEND 2 and PRE (**likely**). |
| Curve names | RES: only FAST CUT confirmed, other names open. My UG p.12 excerpt: "constant power, dipped, or fast-cut" (channel) and "constant power, transition, or fast-cut" (crossfader). | Names from UG p.12. |
| GAIN range | RES: not seen. UG excerpt: "-∞ /+10dB". | -∞ … +10 dB (**verified**). |
| Booth MONO | RES: not found. UG booth section: "Stereo/Mono switch … can also make the booth output mono". | MONO kept (**verified**). |
| Booth EQ range | RES: unknown. QSG: "+/-8dB". | ±8 dB. |
| Dimensions | RES: not found. SPEC (several dealers): 336 × 410 × 109 mm, 7 kg. | As SPEC. |
| Channel meter top LED | RES: "-20 to +10 dBu, so PK! at +10". UG names both a "+10 LED" and a "PK! LED". | 8 graded LEDs -20 … +10 plus PK! above them (PK! threshold **guess**: +15 dBu). |
| Kill slope | Earlier twin: LR4 (24 dB/oct). RES: Xone:92 dealer copy "total kill with a sharp 12dB/oct roll-off", so 12 dB/oct by lineage (**likely**, unconfirmed for the 96). | LR4 kept for now: it matches "full attenuation" best by ear; flagged as a model choice to check. |
| Mic channels | RES: MIC A/B are a clean feed that bypasses the filters and the booth by default (A&H support, paraphrased). | Not modelled: in the twin MIC carries a built-in deck and routes like any input. |
| ALL PASS mode | RES: neutral with RES at noon. The shared Svf has no low+band+high mode. | The Svf's peak mode, neutral up to RES 5 and peaking above it; below noon the hardware dips, the twin stays flat. |

## Model choices (guesses to check against hardware)

| Quantity | Twin value |
|---|---|
| Internal level | 0.1 = 0 dBu; channel clip +20 dBu, LR MIX +21 dBu, MASTER 1 stage +24 dBu (soft knee from 80 %) |
| Studio alignment | 0 dBu = -18 dBFS (EBU R68): routed instruments (which peak near -12 dBFS) read peaks near +6; in and out scale cancel, so unity on the Xone is unity in the studio |
| Files on USB | 0 dBFS = +8 dBu (a CDJ's 2 V rms line out) |
| GAIN taper | linear in dB from -40 (shown -∞) to +10; 0 dB at 80 % of travel |
| HI / LO law | +6 dB × knob above centre; (1 + knob)² amplitude below it, so -6 dB at -0.29 and a kill at -1 |
| Mid band Q | 0.9 (1-4), 1.0 (A/B swept) |
| Kill crossovers | Linkwitz-Riley 4th order at 180 Hz and 3 kHz, the low band phase-matched with a 3 kHz all-pass (bands sum flat) |
| Channel meter | sample peak, instant attack, DIN-style release 20 dB in 1.5 s, PK! at +15 dBu held 1 s |
| Channel fader laws | CONST PWR p^2.5 (most change near the top, the Xone:92 feel), DIPPED p^1.5, FAST CUT full after 5 mm |
| Crossfader laws | CONST PWR cos/sin (-3 dB centre), TRANSITION full to the centre then a quarter-cosine fade, FAST CUT full until the last 1.4 mm |
| Send taper | (knob/10)², unity at 10 |
| MASTER 1 / BOOTH law | (knob/8)^3.11: unity at 8, +6 dB at 10 |
| MONITOR LEVEL law | (knob/7.5)², unchanged from the earlier twin |
| Filter | 2-pole state-variable (the shared `Svf`), stereo pair per section; RES 0-10 → Q 0.707 (Butterworth, FREQ is the -3 dB point) … 20 exponentially |
| Filter combos | HPF+BPF = Svf HP1 (high + band), BPF+LPF = LP1 (low + band), HPF+LPF = notch, all three = peak (see Disagreements) |
| CRUNCH | the Svf input drive 0-10 on a bus running 14 dB hot (so it bites around 0 dBu), level make-up 1/(1 + 0.32·drive) + 0.1 |
| Booth EQ | 100 Hz low shelf, 1 kHz bell (Q 0.8), 10 kHz high shelf, ±8 dB |
| RTN C / D SIG | green above -30 dBu, red above +15 dBu |
| Filter power-up | FILTER 1 HPF at 20 Hz, FILTER 2 LPF at 20 kHz, both OFF (the Xone:92 powers up on LPF) |
| Pressing two type switches "together" | within 350 ms (mouse or two fingers) |

## Twin-only additions

- **Deck strip** above the faceplate: a built-in "record" per channel (TRACK A, TRACK B with 32-bar
  arrangements; FULL MIX, DRUMS, BASS, STABS, PERC, PAD, VOX LEAD stems), synthesised in the
  `xone96-strips` worklet in A minor and following the studio transport. PLAY, BPM (when not synced),
  a bar/phrase display, LOAD FILE per channel.
- **YOU HEAR** (MASTER / BOOTH / PHONES): a browser has one output.
- **Stand-in FX unit** on SND 1 (tempo-synced delay, returned on RTN A) and SND 2 (reverb, RTN B),
  where the hardware expects your own FX units.
- **STUDIO: name** chips on each strip and RTN C/D, from the studio routing.
- **COMPACT VIEW**: the same controls in a 420 × 236 mm arrangement for iPad landscape.

Not modelled: the USB soundcards and their routing switches, MIDI and X:LINK, PHONES 2, MASTER 2, the
master insert, REC output, the LN/PH and Hi-Z switches, latching cue, the mic clean feed.

## Presets

The hardware has no preset memory. The 13 presets in `presets.ts` are mix scenes and DJ setups that
are well-known techniques (blend-ready decks, bass swap, filter build, low-pass breakdown, fast-cut
chops, dub delay throw, reverb wash, stem jam, kick vs bass, split cue, two studio set-ups and a clean
slate). Each one states all six deck sources and was played to confirm it makes sound.
