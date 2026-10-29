# Allen & Heath Xone:96 - hardware reference for the digital twin

Ground truth for `devices/xone96`. It lists every top-panel control, LED, meter and section the
twin draws, with its printed label, the twin's position, range and control id, then the I/O the
twin models, the signal flow as built, behaviour notes and the values that are our own choices.

Every fact is written in our own words. Quotes are short and page-cited. The panel and the
diagrams here are drawn from measured positions and facts; no artwork is reproduced.

## Sources and confidence

| Id | Document | Cited as |
|----|----------|----------|
| UG | *Xone:96 User Guide*, publication AP11645 issue 2, 41 pages. Page numbers are the guide's own printed numbers: top panel p.7-17, rear panel p.20-22, USB p.23, MIDI p.27-29, block diagram p.34, specifications p.35-36, dimensions p.37-38, operating levels p.39. | (Xone:96 User Guide, p.N) |
| BD | The block diagram (the guide's p.34; also supplied as a one-page PDF). Our reading of the drawing, in words. | (block diagram) |
| SUP | Allen & Heath support articles, secondary: Xone master level settings, BOSS pedal send/return notes, XFADER calibration. | (A&H support: title) |

| Mark | Meaning |
|------|---------|
| **verified** | stated in the guide or drawn in the block diagram; the citation follows the item |
| **measured** | read by us off a response graph in the guide (about ±1-2 dB, ±5 % in frequency) |
| **likely** | consistent with the documents, or from one secondary source |
| **guess** | the documents are silent: a twin choice, repeated under "Model choices" |

In the tables, "UG p.N" is short for (Xone:96 User Guide, p.N) and "BD" for (block diagram).

## The unit

- 339 mm wide, 410 mm deep, 109 mm high, 7 kg; packed 450 × 530 × 190 mm, 8.9 kg. **verified**
  (Xone:96 User Guide, p.37). The twin's full view is 339 mm wide: a 396 mm faceplate under a
  50 mm twin-only deck strip.
- Analogue, 6+2 channels: four stereo channels with 4-band EQ (CH 1-4), two stereo channels with a
  3-band parametric EQ (CH A, CH B) and two auxiliary stereo returns (RTN C, RTN D). **verified**
  (Xone:96 User Guide, p.6, p.36).
- Not compatible with standard Xone rack ears; an X.96-RKX kit fixes it into a plinth or rack.
  **verified** (Xone:96 User Guide, p.38).
- Layout, left to right: CH A and CH B; RTN C and RTN D stacked above FILTER 1; CH 1-4; the USB
  ACTIVE LEDs, MIDI 1/2 buttons, the ":96" logo and the LR MIX meters above FILTER 2; then the
  master, booth and monitor column. The crossfader sits under CH 1-4 and PHONES 2 under CH A/B.
  **verified** (Xone:96 User Guide, p.7, top-panel overview; p.14 places the VCFs either side of
  the crossfader).
- Look: light-grey faceplate, black knobs with white pointer lines, black round illuminated
  buttons, black fader caps with a white line. **verified** (Xone:96 User Guide, p.7 render).
  Lit channel-meter LEDs are green up to -3 and blue at 0 and +3; the lit master-meter LEDs are
  green up to -6. **verified** (Xone:96 User Guide, p.7 render). The render leaves the top LEDs
  dark, so their colour (red in the twin, on both meters, with blue at 0 and +3) is a **guess**.

**Positions.** Twin coordinates in mm: x from the faceplate's left edge, y down from its top edge.
Knob columns: A 26, B 61.5, CH 1 133.5, CH 2 169, CH 3 204.5, CH 4 240; RTN C/D and FILTER 1 at
97.5; LR MIX meters and FILTER 2 at 276.5; master column at 315.5; crossfader centre at 187. We
measured them off the p.7 overview scaled to 339 mm. **likely** (±2 mm). Strip rows below give
(x relative to the strip's knob column, y).

## Channel strips (CH A, CH B, CH 1-4), top to bottom

| Printed label | Twin position | Range / legend | Twin control | Source |
|---|---|---|---|---|
| channel box A B 1 2 3 4 | (-13, 21) | - | - | **verified** UG p.7 |
| SEND 1 | (+3.5, 25), 10.5 mm | ∞ … +6 | `ch*_snd1` | **verified** UG p.8, p.10 (levels to SND 1; also USB 9/10); legend UG p.7 |
| PRE (under SEND 1) | (-3.5, 39), small button | SEND 1 pre- or post-fader, per channel | `ch*_pre` | **verified** UG p.8, p.10 (switchable pre/post-FADER); one PRE per channel in the panel photos UG p.7, p.10 and BD |
| SEND 2 | (+3.5, 50), 10.5 mm | ∞ … +6, post-fader only | `ch*_snd2` | **verified** UG p.8, p.10 |
| INPUT select (4-way rotary) | knob (-1, 72) + four position buttons (+12, 72) | CH 1-4: USB 1 / PH / LN / USB 2. CH A/B: USB 1 / MIC / RTN / USB 2 | `ch*_input` | **verified** UG p.8, p.10, p.7 panel legends. USB pairs printed beside it: 1-2, 3-4, 5-6, 7-8, 9-10, 11-12 (UG p.7, p.23) |
| PK! | LED (-11.5, 88.5) | lights when the signal after GAIN is too hot | engine meter | **verified** UG p.8, p.10 (turn that GAIN down); post-GAIN, pre-EQ (BD). Threshold: **guess** |
| GAIN | (0, 97), 11 mm | -∞ … +10 dB | `ch*_gain` | **verified** UG p.8, p.10 |
| HI | (0, 119), 14 mm | ∞ (kill) / centre / +6, 3 kHz | `ch*_hi` | **verified** UG p.8, p.10, p.35 |
| HI MID (CH 1-4) | (0, 143), 14 mm | -27 / centre / +10, 1.1 kHz | `ch1_himid` … | **verified** UG p.10, p.35 |
| FREQ (CH A/B) | (0, 143), 11 mm | 190 Hz / 650 Hz (top) / 2.75 kHz | `cha_midf`, `chb_midf` | **verified** UG p.8, p.35; legend UG p.7 |
| LO MID (CH 1-4) | (0, 168), 14 mm | -27 / centre / +10, 350 Hz | `ch1_lomid` … | **verified** UG p.10, p.35 |
| MID (CH A/B) | (0, 168), 14 mm | -24 / centre / +10, swept by FREQ | `cha_mid`, `chb_mid` | **verified** UG p.8, p.35. "PARAMETRIC EQ" is printed up the side (UG p.7) |
| LO | (0, 195), 14 mm | ∞ (kill) / centre / +6, 180 Hz | `ch*_lo` | **verified** UG p.8, p.10, p.35 |
| FILTER assign | (0, 213), 3-way toggle | 1 / OFF / 2 | `ch*_filter` | **verified** UG p.9, p.11: post-GAIN, post-EQ, post-FADER to FILTER 1 (left), FILTER 2 (right) or the LR MIX (centre) |
| XFADER assign (CH 1-4 only) | (0, 223), 3-way toggle | X / OFF / Y | `ch1_xf` … | **verified** UG p.11; the crossfader takes CH 1-4 only (UG p.12; BD) |
| CUE | (+3, 245) on 1-4, (+3, 235) on A/B; 13.5 mm, red | AUTO-CUE by default | `ch*_cue` | **verified** UG p.9, p.11 |
| channel meter | LEDs at (-11.5), 46 mm tall, from y 270.5 (A/B 261) | 9 LEDs: -20 -15 -10 -6 -3 0 +3 +6 +10 | engine meter | **verified** UG p.9, p.11 (post-GAIN, post-EQ, pre-fader), p.35 (9 LEDs, -20 to +10 dBu); legends UG p.7 |
| channel fader | (+3.3, 302) on 1-4, (+3.3, 292) on A/B; 60 mm | ∞ … unity | `ch*_fader` | **verified** UG p.9, p.11, p.35: CH 1-4 60 mm stereo linear VCA, user-replaceable, < -85 dB shut-off; CH A/B fully analogue |
| channel name | (-11.5, 331) on 1-4, (-11.5, 321) on A/B | - | - | **verified** UG p.7 |

The guide's p.10 text repeats the CH A/B input wording; its panel photo (p.10) and the overview
(p.7) print USB 1 / PH / LN / USB 2 on CH 1-4, which the twin follows.

### EQ shapes

- Figures: **verified** (Xone:96 User Guide, p.8, p.10, p.35). HI and LO boost +6 dB and cut to a
  full kill; the 4-band mids boost +10 and cut -27 dB; the A/B swept mid boosts +10 and cuts
  -24 dB. Every knob centred is flat.
- Shapes, **measured** from the response graphs (Xone:96 User Guide, p.8, p.10): kill skirts about
  12 dB/oct (LO killed: about -3 dB at 190 Hz, -10 dB at 110 Hz, -20 dB at 60 Hz, -30 dB at
  35 Hz); the 4-band mids narrow when boosting (Q about 1.6-1.7: +10 dB at the centre, about
  +4.5 dB half an octave either side) and wide when cutting (Q about 0.7: the -27 dB cuts still
  take about 13 dB an octave from their centre, HI MID -12 dB at 500 Hz and -14.5 dB at 2 kHz);
  the A/B swept mid narrower (Q about 2.4 boosting, 1.2 cutting). Read again for the review:
  the first fit (Q 1.4 / 0.85) made the 4-band cuts 2-3.5 dB too shallow an octave out.
- With every band fully down a channel is not silent: the mids stop at -27 dB. That follows from
  the figures above. **verified** (Xone:96 User Guide, p.10).

## Xone:VCF (FILTER 1, FILTER 2)

Positions for FILTER 1 (column 97.5); FILTER 2 mirrors them at 276.5.

| Printed label | Twin position | Range / positions | Twin control | Source |
|---|---|---|---|---|
| CRUNCH, with LED | LED (-11.5, 170), knob (0, 184), 10.5 mm | 0 clean, LED dark … 10 heavy, LED red | `f1_crunch`, `f2_crunch` | **verified** UG p.13: harmonic distortion in the pre-filter path |
| RES | (0, 210), 14.5 mm, legend MILD … WILD | mild … strong resonance | `f*_res` | **verified** UG p.13 ("feeding some of the filter output back to its input"); strength **measured** UG p.14 |
| HPF · BPF · LPF | three 14 mm buttons at (0.5, 240 / 263 / 286) | one alone selects it; several together combine | `f*_type` (7 options) | **verified** UG p.13-14 |
| FREQ | (0, 319), 15.5 mm, with dot scale | 20 Hz … 20 kHz, the -3 dB point | `f*_freq` | **verified** UG p.13 |
| ON | (0.5, 349), 14 mm, blue | off: the signal passes unaffected | `f1_on`, `f2_on` | **verified** UG p.13 |
| FILTER 1 / FILTER 2 | (0.5, 363) | - | - | **verified** UG p.7 |

- The filters are stereo, analogue, state-variable, with HPF, BPF and LPF outputs available at
  once; "any combination can be pressed together" (Xone:96 User Guide, p.14) for notch and
  all-pass effects, and one press alone deselects the previous type. **verified**.
- Soft-switched: no audible artefacts when ON/OFF, the type or a channel assign changes while
  audio plays. The last response is kept at power-off. **verified** (Xone:96 User Guide, p.14).
- CRUNCH sits in the ON path only, before the filter; with ON off the bus passes dry. **verified**
  (block diagram). For best drive keep the assigned channels within ±6 dB on their meters.
  **verified** (Xone:96 User Guide, p.13).
- All six main channels can be assigned; assigned channels are summed into the FILTER 1 MIX or
  FILTER 2 MIX bus first, and the result returns to the LR MIX. **verified** (Xone:96 User Guide,
  p.13; block diagram).
- Response, **measured** (Xone:96 User Guide, p.14): 2-pole slopes, about 12 dB/oct; WILD peaks
  about +7.6 dB (Q about 2.4); MILD about Q 0.5 (-6 dB at FREQ); the 12 o'clock RES about Q 1. The
  guide describes WILD as dramatic and "just short of self-oscillation" (p.13); the graphs show
  the size of the peak, which the twin follows.
- No filter LFO (the Xone:92 had one). **verified** by its absence (Xone:96 User Guide, p.13).

## Crossfader and curve switches

| Printed label | Twin position | Range / positions | Twin control | Source |
|---|---|---|---|---|
| X · crossfader · Y | (187, 369), 45 mm horizontal | X fully left, Y fully right | `xfader` | **verified** UG p.12, p.35-36: mini innoFADER, 45 mm VCA, user-replaceable |
| CHANNEL FADER curve | (315.5, 210): three positions marked by curve icons; the twin draws a small radio button under each icon | constant power · dipped · fast-cut | `fader_curve` | **verified** UG p.12 (CH 1-4 only; icons only on the panel) |
| XFADER curve | (315.5, 224), as above | constant power · transition · fast-cut | `xf_curve` | **verified** UG p.12 |

- The crossfader is a VCA that fades CH 1-4 assigned to X or Y, and it also sets the level of
  those channels into the filters. **verified** (Xone:96 User Guide, p.12). In the block diagram
  the fader and the crossfader drive one VCA per channel, so post-fader sends follow the
  crossfader too. **verified** (block diagram).
- Curves, **measured** from the curve graphs (Xone:96 User Guide, p.12), used as breakpoint tables
  in `model.ts`:

| Channel fader travel | 0.25 | 0.5 | 0.75 | 0.9 | 1 |
|---|---|---|---|---|---|
| constant power | -45 dB | -22 dB | -12.5 dB | -4.5 dB | 0 |
| dipped | -31 dB | -14 dB | -9 dB | -3.5 dB | 0 |
| fast-cut | -25 dB | -8.5 dB | -3 dB | -0.5 dB | 0 |

| Crossfader: one side against its distance from its own closed end | 0.05 | 0.125 | 0.25 | 0.5 | ≥ 0.75 |
|---|---|---|---|---|---|
| constant power | -51 dB | -22 dB | -8 dB | -3 dB | 0 |
| transition | -17.5 dB | -2.5 dB | 0 | 0 | 0 |
| fast-cut | -20 dB | 0 (from 0.075) | 0 | 0 | 0 |

  Constant power puts both sides at about -3 dB in the middle; transition holds both at full
  level across the middle and fades each one only near the far end; fast-cut opens each side
  within the first few millimetres. The real fast-cut cut-in is set with an internal trim, at
  FAST CUT. **likely** (A&H support: X96 XFADER calibration).

## Auxiliary returns RTN C, RTN D

Column 97.5; RTN C at the top, RTN D 73 mm below it.

| Printed label | Twin position (RTN C; RTN D +73 mm) | Range | Twin control | Source |
|---|---|---|---|---|
| C / D box | (84.5, 21.6) | - | - | **verified** UG p.7 |
| ON/OFF | (97.5, 29.5), 11.5 mm, green | into the LR MIX at pre-master level | `rtnc_on`, `rtnd_on` | **verified** UG p.15 |
| SIG | LED (86, 42.3) | green with signal; continuously red: turn LEVEL down | engine meter | **verified** UG p.15 (bi-colour). The block diagram labels it PK!. Thresholds: **guess** |
| LEVEL | (97.5, 51.4), 10.5 mm | off … +10 | `rtnc_level`, `rtnd_level` | **verified** UG p.15, legend UG p.7 |
| CUE | (97.5, 77.4), 13.5 mm, red | AUTO-CUE | `rtnc_cue`, `rtnd_cue` | **verified** UG p.15 |

No EQ, filter, sends or fader: LEVEL, then ON into the LR MIX; both cue systems listen before ON.
**verified** (block diagram; Xone:96 User Guide, p.15).

## Master column, meters, booth and monitor

| Printed label | Twin position | Range / positions | Twin control | Source |
|---|---|---|---|---|
| USB 1 / USB 2 ACTIVE, MIDI 1 / MIDI 2 | (264-284, 17-43) | decoration (no USB or MIDI in the twin) | - | **verified** UG p.15 |
| :96 logo | (274, 66) | - | - | **verified** UG p.7 |
| LR MIX meters | two 11-LED columns at x 264 and 284, y 85-143, legends between | -35 -25 -20 -15 -10 -6 -3 0 +3 +6 PK! | engine meters | **verified** UG p.16, p.35 (11 LEDs, -35 to +10 dBu); legends UG p.7 |
| L · MIX · R / CUE · SPLIT · PRG | under the meters | which signal each side shows | - | **verified** UG p.7, p.17; BD |
| MASTER 1 | (315.5, 29.5), 12 mm | 0 … 10, unity at 8 | `master` | **verified** UG p.16 (independent of MASTER 2); unity position **likely** (A&H support: Xone master level settings, "around 3 o'clock") |
| MASTER 2 | (315.5, 53), 12 mm | 0 … 10, unity at 8 | `master2` | **verified** UG p.16 |
| USB 11/12 MST/SEND2 | (311.5, 77) | decoration | - | **verified** UG p.16 |
| STEREO/MONO | (311.5, 90), small amber button | booth mono sum | `booth_mono` | **verified** UG p.17 |
| BOOTH HI · MID · LO | (315.5, 112 / 130.5 / 149.5), 11 mm | -8 … +8 | `booth_hi`, `booth_mid`, `booth_lo` | **verified** UG p.17, legend UG p.7; band frequencies **guess** |
| BOOTH level | (315.5, 172.5), 11 mm | 0 … 10, unity at 8 | `booth` | **verified** UG p.17; law **guess** |
| MUTE | (315.5, 193.5), 11.5 mm, red | booth only | `booth_mute` | **verified** UG p.17 |
| CUE ACTIVE | LED (305.5, 240) | lit while any CUE is on | - | **verified** UG p.17 |
| POST EQ | (311.5, 252), small amber | every channel CUE pre- or post-EQ (not PHONES 2) | `cue_post_eq` | **verified** UG p.17; the switch reaches only the CUE 1 selectors (BD) |
| SPLIT CUE | (311.5, 264), small amber | cue left, LR MIX right | `split_cue` | **verified** UG p.17 |
| CUE/MST | (315.5, 284), 11 mm | cue only … cue plus the LR MIX | `cue_mix` | **verified** UG p.17; ADD MIX in BD |
| LEVEL | (315.5, 310.5), 12 mm | 0 … 11 | `phones` | **verified** UG p.17, legend UG p.7 |
| phones jacks | (314, 337) 1/4", (306.5, 356.5) 3.5 mm | decoration | - | **verified** UG p.17 |
| PHONES 2 select | (22, 369.5), 9-way, with a position button for each source (MST printed outside the ring) | MST, 1, 2, 3, 4, A, B, C, D | `phones2_src` | **verified** UG p.16, legends UG p.7 |
| PHONES 2 CUE/MST | (47.5, 369.5), 10.5 mm | the source plus the LR MIX | `phones2_mix` | **verified** UG p.16; ADD MIX in BD |
| PHONES 2 LEVEL | (72, 369.5), 10.5 mm | 0 … 11 | `phones2` | **verified** UG p.16, legend UG p.7 |

- **Main meters** follow the monitor source: the LR MIX before MASTER 1 when nothing is cued, the
  sum of the cued channels while a CUE is on, and in SPLIT CUE the cue on the left and the mix on
  the right. **verified** (Xone:96 User Guide, p.16). MASTER 1 and MASTER 2 change neither the
  meters nor the RECORD, BOOTH, MONITOR or PHONES 2 levels. **verified** (Xone:96 User Guide, p.16).
- **Operating level:** meters averaging around 0 with the loudest peaks around +6; normal music
  between -6 and +6. **verified** (Xone:96 User Guide, p.9, p.11, p.16, p.39). If the channel's
  +10 LED stays lit, turn GAIN or the EQ down (p.9, p.11); if the master PK! LEDs stay lit, check
  the channels' GAIN and EQ, then turn GAIN, EQ or faders down (p.16).
- **CUE:** AUTO-CUE by default, where a new CUE cancels the previous one. LATCHING-CUE (several at
  once) is set on the panel by holding a filter type switch on both filters for 3 s, then pressing
  a CUE; repeating it reverts, and the setting is stored. **verified** (Xone:96 User Guide, p.9).
- **MONITOR:** with no CUE on, the headphones carry the program (PRG, the music-only LR MIX); a
  CUE switches them to the cue bus. **verified** (block diagram). CUE/MST then adds the LR MIX to
  the cue: fully anticlockwise only the cued channels, turning clockwise brings the mix in beside
  them; SPLIT CUE overrides it. **verified** (Xone:96 User Guide, p.17; block diagram).
- **PHONES 2** is a second, independent cue system; it doesn't change the channel CUEs, the
  BOOTH or the MONITOR. **verified** (Xone:96 User Guide, p.16). Each channel's CUE 2 feed is
  taken straight from the post-EQ line, so PHONES 2 hears every channel after its EQ and
  before its fader whatever POST EQ is set to; its MST is the music-only mix. **verified**
  (block diagram: the POST EQ logic line reaches only the CUE 1 pre/post selectors).
- **BOOTH:** music only, then 3-band EQ, STEREO/MONO, MUTE and level; none of them affect MST,
  MONITOR or PHONES 2. A level drop or thin bass in MONO means reversed polarity between left and
  right. **verified** (Xone:96 User Guide, p.17; block diagram).
- **Mic clean feed:** MIC A/B skip the BOOTH and the master insert by default. **verified**
  (Xone:96 User Guide, p.22). In the diagram the mics also miss the filters, RECORD, the USB MST
  feed and both headphone MST blends, and join only MASTER 1 and MASTER 2. **verified** (block
  diagram).

## Rear-panel I/O the twin models

| Hardware connector | Hardware | Twin |
|---|---|---|
| CH 1-4 LINE (RCA) | line sources (Xone:96 User Guide, p.21) | **`studio_1` … `studio_4`** ("CH 1 (LINE)" … "CH 4 (LINE)"): a studio instrument routed here plays on LN, in place of the built-in deck |
| CH 1-4 PHONO (RCA) | magnetic-cartridge turntables, RIAA (p.21, p.35) | the channel's built-in deck (twin only) |
| RTN A / RTN B (1/4" TRS) | line sources or effects returns into CH A / CH B (p.22) | **`studio_a` / `studio_b`** ("CH A (RTN A)", "CH B (RTN B)"); otherwise the stand-in FX unit returns (delay on A, reverb on B) |
| RTN C / RTN D (1/4") | auxiliary returns straight to the LR MIX (p.22) | **`studio_c` / `studio_d`** ("RTN C", "RTN D") |
| MIC A / MIC B (XLR) | low-impedance dynamic mics, no phantom power, +40 dB (p.22, p.35) | the built-in deck on CH A/B (VOX LEAD, PAD), through the clean feed |
| SND 1 / SND 2 | effects sends (p.22) | the stand-in delay (SND 1) and reverb (SND 2) |
| USB 1 / USB 2 | two 12-in/12-out soundcards, 0 dBu = -14 dBFS (p.23, p.35) | your own audio file, looping on the channel's USB positions, at that line-up |
| MST 1 (XLR), MST 2 (TRS), BOOTH (TRS), MONITOR and PHONES 2 | outputs (p.16-17, p.22) | the twin's one browser output; YOU HEAR picks which (MASTER, BOOTH, PHONES, PHONES 2, MST 2) |

Routing an instrument into a channel replaces what that input position played (the deck on LN,
the stand-in effect on RTN); routing it away restores it. The channel's STUDIO chip names the
instrument, and turns amber with "INPUT → LN/RTN" when the INPUT switch is elsewhere.

## Signal flow (as built)

```
CH 1-4:  INPUT (USB 1 | PH | LN | USB 2) ─► GAIN ─┬─► PK! (post-GAIN, pre-EQ)
                                                 └─► EQ ─┬─► meter, PHONES 2; CUE 1 (POST EQ, or pre-EQ after GAIN)
                                                         ├─► SEND 1 when PRE is lit
                                                         └─► VCA = fader curve × crossfader (X / OFF / Y)
                                                               ├─► SEND 1 (post), SEND 2
                                                               └─► FILTER SELECT 1 / OFF / 2
CH A/B:  INPUT (USB 1 | MIC | RTN | USB 2) ─► GAIN ─► EQ ─► (taps as CH 1-4) ─► analogue fader
                                                               ├─► SEND 1 (post), SEND 2
                                                               └─► MIC: clean-feed bus · RTN/USB: FILTER SELECT
FILTER n bus ─► [ON: CRUNCH ─► state-variable VCF, lit outputs summed] | [OFF: dry] ─► LR MIX
RTN C/D: LEVEL ─► (CUE taps) ─► ON ─► LR MIX
LR MIX (+ meters) ─► music-only bus ─┬─► BOOTH: EQ ─► MONO ─► MUTE ─► level
                                     ├─► MONITOR program, PHONES 2 MST
                                     └─► + clean feed ─► MASTER 1 (MST 1), MASTER 2 (MST 2)
MONITOR: [cue bus while a CUE is on, else the program] + CUE/MST add-mix, or SPLIT ─► LEVEL
```

Tap points: (Xone:96 User Guide, p.9, p.11-13, p.16-17, p.22) and the block diagram, **verified**.
The order of operations is the diagram's.

## Model choices (guesses, to check against a unit)

| Quantity | Twin value |
|---|---|
| Internal level | 0.1 = 0 dBu. Soft clips (linear to 80 %, then a tanh knee): channel +20 dBu (the +20 dB channel headroom, p.35), LR MIX +21 dBu, MASTER 1 output +24 dBu, MASTER 2 and BOOTH outputs +18 dBu (maximum output levels, p.35) |
| Studio alignment | the guide's own digital line-up, 0 dBu = -14 dBFS (p.35), in and out, so at unity (GAIN 0 dB, fader up, EQ flat, MASTER 1 at 8) a routed instrument leaves the Xone at its own level (review measurement: -0.02 dB from 50 Hz to 15 kHz on CH 1 LINE, CH A RTN and RTN C; a -20 dBFS tone reads -6 on the meters). Instruments normalised to -18 LUFS read about -5 to +7 on the channel meters at GAIN 0 dB, bass-heavy ones the hottest, so GAIN does its job; several at unity sum past the guide's LR MIX target, as on the hardware |
| Files on USB | the same line-up (the USB soundcards, p.35): a file at 0 dBFS arrives at +14 dBu |
| Built-in decks | each plays like a CDJ with a mastered record: its output is soft-limited at +8 dBu (0 dBFS of a 2 V rms line out), linear up to about +6 dBu, so at GAIN 0 dB a deck reads around 0 to +3 with its loudest peaks at +4 to +6 on the channel meter (review measurement, quasi-peak meter) and a full track leaves the mixer near -18 LUFS. The flat EQ is an all-pass, so sample peaks after it can be a dB or two higher |
| PK! (channels) | sample peak at +15 dBu, after GAIN, held 1 s |
| Meters | the LED ladders (channel and LR MIX alike) are quasi-peak, like an analogue LED driver: the rectified signal charges the reading with a 1 ms attack, release 20 dB in 1.5 s, updated every 32 ms. A steady tone reads its level; the sharpest drum transients read 2-4 dB under their sample peak, so material at the studio's -18 LUFS reads the guide's "average around 0, loudest peaks around +6" at GAIN 0 dB. The PK! LEDs (channel, LR MIX, RTN SIG red) take sample peaks |
| GAIN | linear in dB from -40 (shown -∞) to +10; 0 dB at 80 % of travel |
| HI / LO law | +6 dB × knob above centre; amplitude (1 + knob)² below it: -6 dB at -0.29, a kill at -1 |
| Mid law | linear in dB; bell width from the p.8/p.10 graphs: CH 1-4 Q = 1 + 0.065·dB boosting (1.65 at +10), 1 + 0.011·dB cutting (0.70 at -27); CH A/B Q = 1.4 + 0.1·dB boosting, 1.4 + 0.0083·dB cutting |
| Kill bands | 2nd-order Linkwitz-Riley split at 180 Hz and 3 kHz: the bands sum to an all-pass at centre. The corner is softer than the p.10 graph (LO killed: -6 dB at 180 Hz where the graph shows about -3 dB, -13 dB at 100 Hz against -10); from 60 Hz down it matches within 2 dB |
| MID FREQ | logarithmic 190 Hz - 2.75 kHz, default 650 Hz |
| Fader / crossfader laws | the p.12 breakpoint tables above, dB interpolated linearly; the bottom stop is -∞ |
| SEND law | 2·(knob/10)²: +6 dB at 10, unity at about 7.1 |
| MASTER 1, MASTER 2, BOOTH | (knob/8)^3.11: unity at 8, +6 dB at 10 |
| MONITOR and PHONES 2 LEVEL | (knob/7.5)²: unity at 7.5, +6.7 dB at 11 |
| CUE/MST (both) | the cue at full level plus the LR MIX × (knob/10)² |
| RTN C/D LEVEL | like GAIN, -40 (off) … +10 dB; SIG green above -30 dBu, red with PK! (+15 dBu) |
| Filter | a 2-pole state-variable filter per side (stereo), whose LP, BP and HP outputs are summed by the lit switches, so every combination is exact: all three at Q 1 is flat, HPF + LPF a notch |
| RES → Q | 0.5·e^(1.204r + 0.365r²) for r = RES/10: MILD 0.5, 12 o'clock 1.0, WILD 2.4 (+7.6 dB) |
| FREQ | logarithmic 20 Hz - 20 kHz, gliding over about 12 ms |
| CRUNCH | 0 to +24 dB of drive (2.4 dB a step) into a tanh, with level make-up; it bites from about 0 dBu at the bus, so the ±6 dB advice holds |
| Soft switching | switch gains glide over about 5 ms; nothing clicks |
| Booth EQ | 100 Hz low shelf, 1 kHz bell (Q 0.8), 10 kHz high shelf, ±8 dB |
| Filter power-up | FILTER 1 HPF at 20 Hz, FILTER 2 LPF at 20 kHz, both OFF |
| Type switches "together" | two presses within 350 ms combine (mouse or two fingers) |
| LATCHING-CUE | a LATCH CUE button in the deck strip instead of the 3 s gesture |

## Twin-only additions

- **Deck strip** above the faceplate: a built-in "record" per channel (TRACK A and TRACK B as
  32-bar arrangements; FULL MIX, DRUMS, BASS, STABS, PERC, PAD, VOX LEAD stems), synthesised in
  the `xone96-strips` worklet in A minor and following the studio transport. PLAY, BPM (when not
  synced), a bar / beat / phrase display, FILE loading per channel.
- **YOU HEAR** (MASTER, BOOTH, PHONES, PHONES 2, MST 2): a browser has one output, so the twin's
  studio output carries the chosen one.
- **Stand-in FX unit:** SND 1 feeds a tempo-synced delay returned on RTN A, SND 2 a reverb returned
  on RTN B, where the hardware expects your own effects. A/B can send into their own returns for
  dub feedback, as on the hardware; the reverb return carries one render quantum (2.7 ms) so the
  loop is legal in Web Audio.
- **STUDIO chips** on each strip and on RTN C/D, from the studio routing.
- **COMPACT VIEW:** the same controls in the same order, folded into 372 × 236 mm for iPad
  landscape; chosen automatically on touch screens and short windows.

Not modelled: the USB soundcards themselves and the USB 11/12 switch, MIDI and X:LINK (MIDI 1/2
are drawn as decoration), the master insert, the RECORD and AUDIO SYNC outputs, the rear LN/PH
and LN/Hi-Z switches, the mic and RIAA preamps (decks stand in). The studio's recorder takes the
twin's output, so it includes the mics, unlike the hardware's RECORD out.

## Presets

The hardware has no preset memory. The 21 presets in `presets.ts` are mix scenes and DJ set-ups
built from well-known techniques: blend-ready decks, bass swap, filter build, low-pass breakdown,
cross-filter swap, fast-cut chops, telephone breakdown, notch sweep, dub delay throw, reverb wash,
pre-fade echo ghost, stem jam, carved kick and bass, an overdriven channel to fix, split cue,
back-to-back cueing on PHONES 2, booth tuning, a mic on the clean feed, two studio set-ups and a
clean slate. Each states all six deck sources and makes sound with PLAY.
