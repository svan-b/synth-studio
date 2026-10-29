# Xone:96 mix scenes and DJ setups (presets)

20 scenes, each named "Category / Name" (the preset menu groups by category, as in
`devices/dfam/presets.ts`). Each scene gives:
- the **teaching purpose**, and the lesson it supports (ids from `lessons.md`);
- **hardware settings**: every control that matters, in panel terms;
- the **moves**: how to play it, in bars;
- the **twin settings object**, using `devices/xone96/spec.ts` ids. Ids marked `*` are new controls
  proposed in `signal-flow.md` §14. The current twin ignores unknown ids ("unknown ids are ignored",
  `docs/ADDING_A_DEVICE.md`), so they are safe to include now.

**v2 (2026-10-29):** checked against the official Xone:96 User Guide and block diagram. The hardware
facts used here (EQ bands, filter, sends, cue, curves, clean feed) are cited in `sources.md` and
`signal-flow.md` v2 as "verified (Xone:96 User Guide, p.N)". Scene names and descriptions are my own.
The "twin deck" names (TRACK A, DRUMS, ...) are the twin's built-in sources
(`devices/xone96/sources.ts`). On real hardware each would be a CDJ, turntable or instrument on that
channel.

Two hardware facts shape several scenes:
- **Only CH 1–4 can be on the crossfader** (UG p.12).
- **Sends are taken before the filters** (block diagram, UG p.34). A filtered channel still sends its
  unfiltered sound to the FX, so kill the LO on delay and reverb returns.

---

## How hardware values map to the twin

From the laws in `spec.ts`: `killBandGain`, `midBandDb`, GAIN in dB.

| Hardware setting | Twin value |
|---|---|
| HI / LO: +6 dB · +3 · 0 · −3 · −4 · −6 · −8 · −10 · −12 · −20 · KILL | `1` · `0.5` · `0` · `-0.16` · `-0.21` · `-0.29` · `-0.37` · `-0.44` · `-0.5` · `-0.68` · `-1` (cut side: v = 10^(dB/40) − 1) |
| HI MID / LO MID (CH 1–4): +10 · +4 · +2 · 0 · −3 · −4 · −6 · −8 · −10 · −15 · −27 dB | `1` · `0.4` · `0.2` · `0` · `-0.11` · `-0.15` · `-0.22` · `-0.3` · `-0.37` · `-0.56` · `-1` |
| MID (CH A/B): +10 · +2 · −6 · −8 · −12 · −24 dB | `1` · `0.2` · `-0.25` · `-0.33` · `-0.5` · `-1` |
| GAIN | dB directly (−40 = −∞) |
| Faders, SEND levels, RES, CRUNCH, MASTER, BOOTH, PHONES | 0 … 10 |
| INPUT CH 1–4 | `0` USB 1 · `1` PHONO · `2` LINE · `3` USB 2 |
| INPUT CH A/B | `0` USB 1 · `1` MIC · `2` RTN · `3` USB 2 (in the twin, MIC plays that channel's deck) |
| FILTER assign `chN_filter` | `0` FILTER 1 · `1` OFF · `2` FILTER 2 |
| X-FADE assign `chN_xf` | `0` X · `1` OFF · `2` Y |
| Crossfader `xfader` | `0` = fully X … `10` = fully Y |
| Curve switches | `fader_curve`: `0` constant power · `1` dipped · `2` fast-cut. `xf_curve`: `0` constant power · `1` **transition** (the twin wrongly labels it DIPPED) · `2` fast-cut. All verified (UG p.12). |
| Filter `fN_type` | `0` HPF · `1` BPF · `2` LPF |
| `cue_mix` | `0` = CUE only … `10` = MASTER only |
| Twin decks `chN_src` | `0` TRACK A · `1` TRACK B · `2` DRUMS · `3` BASS · `4` STABS · `5` PERC · `6` PAD · `7` VOX LEAD · `8` NONE |

### The neutral board every scene starts from

```ts
/** Flat, safe board: every scene spreads this first (mirrors the hardware "zeroed" state) */
const MIX_INIT = {
  play: false, bpm: 124,
  ch1_src: 0, ch2_src: 1, ch3_src: 4, ch4_src: 5, cha_src: 7, chb_src: 6,
  ch1_input: 2, ch2_input: 2, ch3_input: 2, ch4_input: 2, cha_input: 2, chb_input: 2,
  // GAIN 0 dB, EQ flat, sends down, CUE off, FILTER OFF, X-FADE OFF, faders down (all six channels)
  ch1_gain: 0, ch1_hi: 0, ch1_himid: 0, ch1_lomid: 0, ch1_lo: 0, ch1_snd1: 0, ch1_snd2: 0, ch1_cue: false, ch1_filter: 1, ch1_xf: 1, ch1_fader: 0,
  ch2_gain: 0, ch2_hi: 0, ch2_himid: 0, ch2_lomid: 0, ch2_lo: 0, ch2_snd1: 0, ch2_snd2: 0, ch2_cue: false, ch2_filter: 1, ch2_xf: 1, ch2_fader: 0,
  ch3_gain: 0, ch3_hi: 0, ch3_himid: 0, ch3_lomid: 0, ch3_lo: 0, ch3_snd1: 0, ch3_snd2: 0, ch3_cue: false, ch3_filter: 1, ch3_xf: 1, ch3_fader: 0,
  ch4_gain: 0, ch4_hi: 0, ch4_himid: 0, ch4_lomid: 0, ch4_lo: 0, ch4_snd1: 0, ch4_snd2: 0, ch4_cue: false, ch4_filter: 1, ch4_xf: 1, ch4_fader: 0,
  // CH A/B: no crossfader assign on the hardware (UG p.12), so there is no cha_xf / chb_xf here
  cha_gain: 0, cha_hi: 0, cha_mid: 0, cha_midf: 650, cha_lo: 0, cha_cue: false, cha_filter: 1, cha_fader: 0,
  chb_gain: 0, chb_hi: 0, chb_mid: 0, chb_midf: 650, chb_lo: 0, chb_cue: false, chb_filter: 1, chb_fader: 0,
  f1_type: 0, f1_freq: 20, f1_res: 2, f1_crunch: 0,
  f2_type: 2, f2_freq: 20000, f2_res: 2, f2_crunch: 0,
  xfader: 5, xf_curve: 0, fader_curve: 0,
  master: 7.5, booth: 6, booth_mono: false,
  cue_mix: 5, phones: 6, split_cue: false, cue_post_eq: true, send1_pre: 0, monitor_out: 0,
  fx_time: 1, fx_fdbk: 4.5, fx_size: 2.5,
  // proposed controls (ignored until implemented; see signal-flow.md §14)
  f1_on: false, f2_on: false,                                                        // * FILTER ON
  ch1_snd1_pre: false, ch2_snd1_pre: false, ch3_snd1_pre: false, ch4_snd1_pre: false, // * per-channel PRE
  cha_snd1: 0, cha_snd2: 0, cha_snd1_pre: false, chb_snd1: 0, chb_snd2: 0, chb_snd1_pre: false, // * A/B sends
  master2: 7.5, booth_mute: false, booth_hi: 0, booth_mid: 0, booth_lo: 0,           // * MASTER 2, booth
  rtnc_on: false, rtnc_level: 0, rtnd_on: false, rtnd_level: 0,                      // * RTN C/D
  phones2_src: 0, phones2_mix: 5, phones2_level: 6,                                  // * PHONES 2 (0 = MST)
};
```

The guide doesn't say which curve-switch position is the factory default. `0` (constant power)
keeps the twin's existing default. The ON/OFF and type switches keep their last state at power-off
(UG p.14).

---

## Init

### 1. `init_flat`: **Init / Flat and safe**
- **Purpose:** a known starting point, and the "zero the board" ritual a DJ performs between mixes
  (EQ centred, sends down, filters off, GAIN at 0 dB). Lessons: `xone96-signal-flow`, `xone96-gain-staging`.
- **Hardware:** every channel INPUT LINE (A/B RTN), GAIN 0 dB, all EQ knobs at centre, SEND 1/2 at 0,
  CUE off, FILTER assign OFF, X-FADE OFF, faders down. FILTER 1 HPF and FILTER 2 LPF at their
  transparent ends, RES MILD, CRUNCH 0, FILTER ON off. Crossfader centre, curves at default.
  MASTER 1 and MASTER 2 at unity, CUE/MST centre, SPLIT CUE off.
- **Moves:** none. Bring channel 1 up to hear TRACK A.
- **Twin:** `{ ...MIX_INIT, ch1_fader: 10 }`

---

## Blend

### 2. `blend_ready`: **Blend / Two decks, blend-ready**
- **Purpose:** the canonical club setup. The outgoing record is on air on X; the incoming record is
  **gain-matched, pre-EQ'd and cued** on Y with the crossfader closed. Prepare in private, perform in
  public. Lessons: `xone96-cue`, `xone96-crossfader`, `xone96-full-blend`.
- **Hardware:**

  | | INPUT | GAIN | HI | HI MID | LO MID | LO | X-FADE | FADER | CUE |
  |---|---|---|---|---|---|---|---|---|---|
  | CH 1 (TRACK A, on air) | LINE | 0 dB | 0 | 0 | 0 | 0 | X | full | off |
  | CH 2 (TRACK B, incoming) | LINE | 0 dB (meter matched to CH 1: peaks about +6) | −6 dB | 0 | 0 | **KILL** | Y | full | **on** |

  Crossfader fully X. XFADER curve **constant power** (left; about −3 dB per side at the centre,
  measured from UG p.12). MONITOR: POST EQ on, CUE/MST centre, SPLIT CUE off. AUTO-CUE means pressing
  CUE on CH 2 replaces any earlier cue (UG p.9).
- **Moves:** on a phrase line, move the crossfader to the centre over 8 bars. Bring CH 2 HI back to 0
  over the same 8 bars. Swap the basses on the next phrase downbeat (CH 1 LO KILL, CH 2 LO centre).
  Crossfader to Y by the end of the following phrase.
- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 0, ch1_xf: 0, ch1_fader: 10,
    ch2_src: 1, ch2_hi: -0.29, ch2_lo: -1, ch2_xf: 2, ch2_fader: 10, ch2_cue: true,
    xfader: 0, xf_curve: 0, cue_mix: 5 }
  ```

### 3. `bass_swap`: **Blend / Bass swap**
- **Purpose:** both records on air, only one owns the bass. Swapping two LO knobs on the downbeat
  hands the groove over with constant low-end energy. Lessons: `xone96-bass-swap`.
- **Hardware:**

  | | GAIN | HI | HI MID | LO MID | LO | X-FADE | FADER |
  |---|---|---|---|---|---|---|---|
  | CH 1 (TRACK A) | 0 dB | 0 | 0 | 0 | 0 | OFF | full |
  | CH 2 (TRACK B) | 0 dB | −3 dB | 0 | −6 dB | **KILL** | OFF | 90 % |

- **Moves:** on the downbeat of the next phrase, turn CH 1 LO to KILL and CH 2 LO to centre in the
  same instant, one hand on each knob. Return CH 2 LO MID to 0 over 4 bars, roll CH 1 HI down over
  the phrase, and close CH 1 on the next phrase line.
- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 0, ch1_fader: 10,
    ch2_src: 1, ch2_fader: 9, ch2_lo: -1, ch2_lomid: -0.22, ch2_hi: -0.16 }
  ```

### 4. `phrase_transition`: **Blend / 32-bar phrase transition (template)**
- **Purpose:** plan a whole transition in **phrases** and move **one band at a time**. This is the
  shape of a long house or techno blend. Lessons: `xone96-phrasing`, `xone96-full-blend`.
- **Hardware start:** CH 1 TRACK A on air (fader full, X-FADE OFF, EQ flat). CH 2 TRACK B: fader
  down, HI −10 dB, HI MID 0, LO MID −10 dB, LO KILL, CUE on (check its phrase position in the phones).
- **Moves (bars counted from the incoming track's bar 1):**

  | Bars | Move | Why |
  |---|---|---|
  | 1 (downbeat) | CH 2 fader up to full | enter on a phrase line |
  | 1–8 | CH 2 HI −10 dB → 0 | hats arrive; the track "steps forward" |
  | 9 | CH 2 LO MID −10 → −3 dB | its body arrives without mud |
  | 9–16 | CH 1 HI 0 → −6 dB | the outgoing record recedes |
  | 17 (downbeat) | **bass swap**: CH 1 LO KILL and CH 2 LO centre | one bassline at a time |
  | 17–24 | CH 2 LO MID → 0; CH 1 LO MID → −10 dB | hand over the body |
  | 25–32 | CH 1 fader full → down (or an echo-out on SEND 1) | exit on the phrase |
  | 33 | CH 1: EQ flat, CUE off | clean slate for the next record |

- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 0, ch1_fader: 10,
    ch2_src: 1, ch2_fader: 0, ch2_hi: -0.44, ch2_lomid: -0.37, ch2_lo: -1, ch2_cue: true }
  ```

---

## EQ

### 5. `kick_bass_carve`: **EQ / Kick and bass carving**
- **Purpose:** **complementary EQ**. Each source owns a region: the kick owns the sub-thump, the
  bassline owns the low-mids, where its notes are actually heard. Cut to make room; boost little.
  The twin's bassline also sits on the off-beats, between the kicks, so it is carved in **time** as
  well as frequency. Lessons: `xone96-low-end-clash`.
- **Hardware:**

  | | GAIN | HI | HI MID | LO MID | LO | FADER |
  |---|---|---|---|---|---|---|
  | CH 1 (DRUMS) | 0 dB | 0 | 0 | −6 dB (boxiness out at 350 Hz) | 0 | full |
  | CH 2 (BASS) | −2 dB | −6 dB | −4 dB | +2 dB | −4 dB | 80 % |

- **Moves:** A/B the bass LO at 0 versus −4 dB while watching the LR MIX meters. The kick's punch
  returns and the peaks drop. Then try the opposite allocation for an 808-style track: DRUMS LO −6 dB,
  BASS LO 0.
- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 2, ch1_fader: 10, ch1_lomid: -0.22,
    ch2_src: 3, ch2_gain: -2, ch2_hi: -0.29, ch2_himid: -0.15, ch2_lomid: 0.2, ch2_lo: -0.21, ch2_fader: 8 }
  ```

---

## Filter

### 6. `filter_build`: **Filter / HPF build and drop**
- **Purpose:** tension by **removing the low end**, made audible by resonance; release by snapping
  back on the downbeat. Shows the real Xone move: **set it up, then punch FILTER ON.** Lessons:
  `xone96-filter-sweeps`.
- **Hardware:** CH 1 TRACK A on air, FILTER assign **1**. FILTER 1: **HPF**, FREQ fully anticlockwise,
  RES about 60 % (towards WILD), CRUNCH 0, FILTER ON off.
- **Moves:** on the first beat of an 8-bar build, press FILTER ON (nothing changes yet). Sweep FREQ
  up to about 2 kHz over 8 bars, adding CRUNCH to about 3 over the last 4 bars. On the downbeat,
  press FILTER ON off (hardware), or snap FREQ to fully anticlockwise (current twin). Then CRUNCH back
  to 0.
- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 0, ch1_fader: 10, ch1_filter: 0,
    f1_type: 0, f1_freq: 20, f1_res: 6, f1_crunch: 0, f1_on: false /* * */ }
  ```

### 7. `cross_filter`: **Filter / Cross-filter swap**
- **Purpose:** hand the spectrum over with **two filters at once**. The outgoing record loses its lows
  (FILTER 1 HPF rising) while the incoming one gains its highs (FILTER 2 LPF opening). This is why
  the mixer has two sections. Lessons: `xone96-filter-sweeps`, `xone96-full-blend`.
- **Hardware:**

  | | FILTER | Section settings | LO | FADER |
  |---|---|---|---|---|
  | CH 1 (TRACK A) | 1 | FILTER 1: HPF, FREQ fully anticlockwise, RES 30 %, ON | 0 | full |
  | CH 2 (TRACK B) | 2 | FILTER 2: LPF, FREQ about 250 Hz, RES 30 %, ON | **KILL** | full |

- **Moves:** over 16 bars, open FILTER 2 FREQ from 250 Hz to fully clockwise while raising FILTER 1
  FREQ from 20 Hz to about 1 kHz. At bar 9, swap the basses (CH 1 LO KILL, CH 2 LO centre). At bar 17,
  close CH 1, then set both FILTER assigns to OFF.
- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 0, ch1_fader: 10, ch1_filter: 0, f1_type: 0, f1_freq: 20, f1_res: 3,
    ch2_src: 1, ch2_fader: 10, ch2_filter: 2, ch2_lo: -1, f2_type: 2, f2_freq: 250, f2_res: 3,
    f1_on: true, f2_on: true /* * */ }
  ```

### 8. `telephone_break`: **Filter / Telephone breakdown (BPF + CRUNCH)**
- **Purpose:** **band-pass keeps one band**: thin, focused, "on the radio". CRUNCH before the filter
  gives it a cheap-speaker bite. Note: on the hardware **a MIC on CH A/B bypasses the filters**
  (the clean feed: UG p.22 and the block diagram, UG p.34), so a filtered vocal must come from a
  track, RTN or USB, not the MIC input. Lessons:
  `xone96-filter-sweeps`, `xone96-ear-filter-type`.
- **Hardware:** CH 1 TRACK A on air, FILTER assign **2**. FILTER 2: **BPF**, FREQ about 1.2 kHz,
  RES about 60 %, CRUNCH about 3, ON for the 8-bar breakdown, off on the drop.
- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 0, ch1_fader: 10, ch1_filter: 2,
    f2_type: 1, f2_freq: 1200, f2_res: 6, f2_crunch: 3, f2_on: false /* * */ }
  ```

### 9. `notch_sweep`: **Filter / Notch sweep (HPF + LPF together)** (*needs combinable mode buttons*)
- **Purpose:** **HPF + LPF pressed together give a notch**: a moving hole in the spectrum, like a
  slow phaser. The guide confirms that type buttons combine into notch and all-pass responses (UG
  p.14). All three lit, with RES as the boost/cut amount, gives a sweepable bell around FREQ. It is
  flat at RES 12 o'clock (`signal-flow.md` §5.1; SVF maths plus a user report). Lessons:
  `xone96-filter-sweeps` (extension).
- **Hardware:** CH 3 STABS (or a full track) on FILTER 1. HPF **and** LPF lit, FREQ about 600 Hz,
  RES about 40 %, ON. Sweep FREQ slowly between 400 Hz and 4 kHz over 4 bars.
- **Twin (proposed ids):**
  ```ts
  { ...MIX_INIT, ch3_src: 4, ch3_fader: 9, ch3_filter: 0,
    f1_hpf: true, f1_bpf: false, f1_lpf: true /* * */, f1_freq: 600, f1_res: 4, f1_on: true /* * */ }
  ```

---

## FX

### 10. `dub_throw`: **FX / Dub delay throw and echo-out**
- **Purpose:** a **post-fade send** into a tempo-synced delay, with the **return EQ'd** so the echoes
  never muddy the bass. A "throw" is a brief send boost on one hit; an "echo-out" closes the fader
  and lets the repeats ring. Lessons: `xone96-fx-send`.
- **Hardware:**

  | | INPUT | EQ | SEND 1 | FADER |
  |---|---|---|---|---|
  | CH 1 (DRUMS) | LINE | flat | 0 | 90 % |
  | CH 3 (STABS) | LINE | flat | 60 % (post) | 80 % |
  | CH A (delay return) | **RTN** | LO **KILL**, HI −4 dB | **0 (never feed a return back to its own send)** | 80 % |

  Delay unit on SEND 1 → RTN A: 3/16 (dotted eighth), feedback about 55 %.
- **Moves:** throw: on the last stab of an 8-bar phrase, flick CH 3 SEND 1 to full and back within
  the beat. Echo-out: pull CH 3's fader on a downbeat; the repeats decay on their own.
- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 2, ch1_fader: 9, ch3_src: 4, ch3_fader: 8, ch3_snd1: 6, send1_pre: 0,
    cha_input: 2, cha_fader: 8, cha_lo: -1, cha_hi: -0.21, fx_time: 1, fx_fdbk: 5.5 }
  ```

### 11. `reverb_exit`: **FX / Reverb-tail exit (SEND 2, post-fade)**
- **Purpose:** leave a track by **feeding its last bar into a long reverb and cutting the dry fader
  on the downbeat**. SEND 2 is always post-fade, so the cut also stops new input, and only the tail
  remains over the incoming track's first bar. Lessons: `xone96-fx-send`, `xone96-full-blend`.
- **Hardware:**

  | | INPUT | EQ | SEND 2 | FADER | CUE |
  |---|---|---|---|---|---|
  | CH 1 (TRACK A, outgoing) | LINE | flat | 0 → 80 % in bar 32 | full → cut on the downbeat of bar 33 | off |
  | CH 2 (TRACK B, incoming) | LINE | flat | 0 | down → full on the downbeat of bar 33 | on (prepared) |
  | CH B (reverb return) | **RTN** | LO −10 dB, MID −6 dB at about 400 Hz | 0 | 70 % | off |

  Reverb about 4 s.
- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 0, ch1_fader: 10, ch1_snd2: 0,
    ch2_src: 1, ch2_fader: 0, ch2_cue: true,
    chb_input: 2, chb_fader: 7, chb_lo: -0.44, chb_mid: -0.25, chb_midf: 400, fx_size: 4 }
  ```

### 12. `prefade_ghost`: **FX / Pre-fade echo "ghost"**
- **Purpose:** **pre versus post** made obvious. With the channel's SEND 1 set **PRE**, pulling the
  fader removes the dry sound but the delay keeps being fed, so only echoes remain. Then close the
  send on a downbeat to let the tail die. On the hardware PRE is a button under each channel's
  SEND 1 knob (UG p.10 panel; block diagram), so only this channel goes pre-fade. Lessons:
  `xone96-fx-send`.
- **Hardware:** CH 1 DRUMS 90 %. CH 4 PERC 70 %, SEND 1 60 %, SEND 1 **PRE on**. CH A RTN 80 %, LO KILL.
  Delay 1/4, feedback about 65 %.
- **Moves:** pull CH 4's fader to 0: the dry perc vanishes and its echoes carry on. On the next
  phrase line, turn CH 4 SEND 1 down to 0.
- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 2, ch1_fader: 9, ch4_src: 5, ch4_fader: 7, ch4_snd1: 6,
    send1_pre: 1, ch4_snd1_pre: true /* * */, cha_input: 2, cha_fader: 8, cha_lo: -1,
    fx_time: 2, fx_fdbk: 6.5 }
  ```

---

## Performance

### 13. `xf_cuts`: **Performance / Crossfader cuts (FAST CUT)**
- **Purpose:** the **curve decides the technique**. The XFADER switch offers constant power,
  transition and fast-cut (UG p.12). FAST CUT holds both sides at full level until the last
  sixteenth of travel and then cuts, which gives instant on/off for rhythmic cuts. *Transition* is
  similar but softens the last bit of travel. Constant power fades across the whole travel, so the
  same cuts smear into fades. Lessons: `xone96-crossfader`.
- **Hardware:** CH 1 DRUMS on **X**, fader full. CH 3 STABS on **Y**, fader full. Crossfader fully X;
  XFADER curve **FAST CUT** (right). Only CH 1–4 can be put on X or Y (UG p.12).
- **Moves:** tap the crossfader towards Y on the off-beats (a "transform"). Repeat on *transition*,
  then on constant power, and compare.
- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 2, ch1_xf: 0, ch1_fader: 10, ch3_src: 4, ch3_xf: 2, ch3_fader: 10,
    xfader: 0, xf_curve: 2 }
  ```

### 14. `stem_jam`: **Stem / Live stem jam with FX returns**
- **Purpose:** **build a mix from parts**. Each stem gets one job in the spectrum, and the FX return
  on its own channel stays separately controllable. Lessons: `xone96-studio-balance`.
- **Hardware:**

  | | Source | EQ | Sends | FADER |
  |---|---|---|---|---|
  | CH 1 | DRUMS | flat | – | 90 % |
  | CH 2 | BASS | HI −6 dB | – | 80 % |
  | CH 3 | STABS | LO KILL | SEND 1 40 % (delay) | 60 % |
  | CH 4 | PERC | LO KILL | SEND 2 30 % (reverb) | 60 % |
  | CH A | **RTN** (delay return) | LO KILL | – | 70 % |
  | CH B | **RTN** (reverb return) | LO −10 dB | – | 60 % |

- **Note:** the twin's current `stem_jam` preset sends `ch3_snd2: 3` to the reverb while CH B is set
  to MIC, so the reverb is inaudible. This version fixes that. For six stems, put the FX on
  RTN C/D, as on the hardware.
- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 2, ch1_fader: 9, ch2_src: 3, ch2_hi: -0.29, ch2_fader: 8,
    ch3_src: 4, ch3_lo: -1, ch3_snd1: 4, ch3_fader: 6, ch4_src: 5, ch4_lo: -1, ch4_snd2: 3, ch4_fader: 6,
    cha_input: 2, cha_lo: -1, cha_fader: 7, chb_input: 2, chb_lo: -0.44, chb_fader: 6 }
  ```

---

## Studio

### 15. `studio_elektrons`: **Studio / Route the Elektrons in**
- **Purpose:** the mixer as the **centre of the studio**: instruments arrive as line-level channels,
  are gain-staged like records, and share one FX loop. Lessons: `xone96-studio-routing`.
- **Hardware cabling:** Analog Rytm MAIN OUT L/R → CH 1 LINE (RCA). Analog Four MAIN OUT L/R → CH 2
  LINE. Delay pedal or unit on SEND 1 → RTN A (L/R jacks).
- **Hardware settings:**

  | | INPUT | GAIN | EQ | FILTER | SEND 1 | X-FADE | FADER |
  |---|---|---|---|---|---|---|---|
  | CH 1 (Rytm drums) | LINE | 0 dB, then trim to peaks 0 to +6 | flat | OFF | 0 | OFF | full |
  | CH 2 (A4 synths) | LINE | 0 dB, then trim | flat | 1 (FILTER 1 LPF, fully open, RES 30 %, ON off) | 30 % | OFF | 80 % |
  | CH A (delay return) | RTN | 0 dB | LO KILL | OFF | 0 | OFF | 60 % |

- **Twin:** routes as in `lib/studio/sets.ts` set `elektron-live`.
  ```ts
  routes: { 'analog-rytm': 'xone96:studio_1', 'analog-four': 'xone96:studio_2' }
  values: { ...MIX_INIT, ch1_fader: 10, ch2_fader: 8, ch2_filter: 0, f1_type: 2, f1_freq: 20000, f1_res: 3,
            ch2_snd1: 3, cha_input: 2, cha_lo: -1, cha_fader: 6 }
  ```

### 16. `studio_full`: **Studio / Full studio, six instruments**
- **Purpose:** **frequency allocation across a whole band**: drums, bass, chords, percussion, lead
  and drone each get a lane. On the hardware this also teaches **mono synths into stereo channels**.
  The RTN A–D 1/4" inputs are mono/stereo, and the guide says to use the L/M socket for mono and
  Hi-Z devices (UG p.23, p.36). A single RCA into CH 3/4 lands on the left only, so use a Y-cable
  there. Lessons: `xone96-studio-balance`,
  `xone96-studio-mixdown`.
- **Hardware:**

  | Channel | Instrument (role) | INPUT | EQ | SEND | FADER |
  |---|---|---|---|---|---|
  | CH 1 | Analog Rytm (drums) | LINE | flat | – | 90 % |
  | CH 2 | Analog Four (chords) | LINE | LO −10 dB | SEND 1 30 % | 70 % |
  | CH 3 | Sub 37 (bass) | LINE (mono: Y-cable) | HI −6 dB, LO MID −3 dB | – | 80 % |
  | CH 4 | DFAM (percussion) | LINE (mono: Y-cable) | LO −6 dB, LO MID −4 dB | SEND 2 20 % | 60 % |
  | CH A | Mother-32 (lead) | RTN (L/MONO jack) | LO KILL, MID +2 dB at 1.5 kHz | – | 60 % |
  | CH B | Subharmonicon (drone) | RTN (L/MONO jack) | LO −10 dB, MID −6 dB at 400 Hz | – | 50 % |
  | RTN C / RTN D | delay / reverb returns | – | – | – | 50 % |

- **Twin:** routes as in `lib/studio/sets.ts` set `everything`. A/B carry instruments, so the twin's
  FX returns (RTN A/B) are unavailable: keep sends at 0 until RTN C/D exist.
  ```ts
  values: { ...MIX_INIT, ch1_fader: 9, ch2_lo: -0.44, ch2_fader: 7,
            ch3_hi: -0.29, ch3_lomid: -0.11, ch3_fader: 8, ch4_lo: -0.29, ch4_lomid: -0.15, ch4_fader: 6,
            cha_lo: -1, cha_mid: 0.2, cha_midf: 1500, cha_fader: 6,
            chb_lo: -0.44, chb_mid: -0.25, chb_midf: 400, chb_fader: 5 }
  ```

### 17. `booth_tune`: **Booth / Monitor tuning** (*needs the booth EQ*)
- **Purpose:** **the booth is not the master.** It has its own STEREO/MONO switch, an independent
  3-band EQ (panel −8…+8), a level control and MUTE, none of which touch MST 1/2, MONITOR or PHONES 2
  (UG p.17). It is fed from the music-only bus, so a MIC never reaches it (UG p.22; block diagram).
  Typical move: less bass and a touch more top in a boomy booth. Lessons: `xone96-signal-flow`
  (extension), `xone96-cue`.
- **Hardware:** MASTER 1 at unity; BOOTH about 60 %. BOOTH EQ: LO −3 dB, MID 0, HI +2 dB (the band
  frequencies aren't published; label the twin's as assumptions). Press STEREO/MONO briefly to check
  the mix in mono: a drop in level or bass means a polarity problem (UG p.17).
- **Twin (proposed ids):**
  ```ts
  { ...MIX_INIT, ch1_src: 0, ch1_fader: 10, booth: 6,
    booth_lo: -3, booth_mid: 0, booth_hi: 2 /* * dB, range ±8 */, booth_mute: false /* * */, monitor_out: 1 }
  ```

### 18. `overdriven`: **Gain / Overdriven channel (what not to do)**
- **Purpose:** **see and hear clipping**. With GAIN maxed and two boosts, PK! stays lit and peaks
  flatten into harsh, buzzy distortion. The fix starts at GAIN, not at the fader. Lessons:
  `xone96-gain-staging`, `xone96-ear-over-gain`.
- **Hardware:** CH 1 TRACK A, GAIN +10 dB, LO +6 dB, HI MID +10 dB, fader full.
- **Moves:** turn GAIN down until PK! stays dark and the loudest hits light +6 (about 8–10 dB lower),
  then centre the EQ.
- **Twin:**
  ```ts
  { ...MIX_INIT, ch1_src: 0, ch1_fader: 10, ch1_gain: 10, ch1_lo: 1, ch1_himid: 1 }
  ```

### 19. `b2b_two_cues`: **B2B / Two DJs, two cue systems** (*needs PHONES 2*)
- **Purpose:** the Xone:96's **second, independent cue system** (UG p.16). DJ 1 prepares CH 2 on
  PHONES 1 with the channel CUE buttons. DJ 2 prepares CH 3 on PHONES 2 using its own **9-way source
  select** (MST, 1, 2, 3, 4, A, B, C, D), CUE/MST blend and LEVEL. PHONES 2 doesn't change channel CUE
  assignments, BOOTH or MONITOR, so neither DJ disturbs the other (UG p.16). Lessons: `xone96-cue`
  (extension).
- **Hardware:** CH 1 on air. DJ 1: CUE on CH 2, SPLIT CUE on, MONITOR level about 6 of 11. DJ 2:
  PHONES 2 selector on 3, CUE/MST centre, LEVEL about 6 of 11.
- **Twin (proposed ids):**
  ```ts
  { ...MIX_INIT, ch1_src: 0, ch1_fader: 10, ch2_src: 1, ch2_cue: true, split_cue: true,
    ch3_src: 4, phones2_src: 3 /* * 0=MST,1..4=CH 1-4,5=A,6=B,7=C,8=D */, phones2_mix: 5, phones2_level: 6 }
  ```

### 20. `mc_mic`: **Mic / MC on channel A (clean feed)** (*needs MIC clean feed in the twin*)
- **Purpose:** the Xone:96's **clean-feed mic bus**. With CH A on MIC, the voice reaches MASTER 1/2
  but, by default, not the booth or the master insert (UG p.22). Per the block diagram it also
  bypasses FILTER SELECT, the RECORD out, the USB MST feed and the headphones' MST blend. You hear
  yourself in the headphones only by pressing CUE A. The point to teach is that different outputs
  carry different mixes. Lessons: `xone96-studio-routing` (extension).
- **Hardware:** a dynamic mic into MIC A (XLR; no phantom power, UG p.22). CH A INPUT = MIC, GAIN set
  so speech peaks about +6, LO −10 dB (handling rumble), MID +2 dB at about 2.5 kHz (presence), HI 0,
  fader up. Leave FILTER assign OFF: it would be ignored anyway. CH 1 TRACK A on air underneath.
- **Twin (proposed behaviour):** `{ ...MIX_INIT, ch1_src: 0, ch1_fader: 9, cha_input: 1, cha_gain: 0, cha_lo: -0.44, cha_mid: 0.2, cha_midf: 2500, cha_fader: 8 }`.
  Today the twin's MIC position plays a deck through the normal path. Once the clean feed exists,
  route it to MASTER only.

---

## Checklist for the implementer
- Scenes 1–8 and 10–18 work with today's controls; ignore the `*` ids until they exist. Scenes 9, 17,
  19 and 20 need new controls or behaviour: combinable filter types, booth EQ/MUTE, PHONES 2, and
  the mic clean feed.
- When the twin drops `cha_xf`/`chb_xf` (CH A/B aren't on the crossfader, UG p.12), no scene here
  needs changing.
- Keep the scene keys stable once shipped, because saved projects reference presets by key.
- Scenes that assume a phrase position (2, 3, 4, 7, 11) work best if loading one **restarts the decks
  at bar 1** (`play: false`, then press PLAY).
