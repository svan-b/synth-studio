# Xone:96 lessons: 18 outlines (v2, following `docs/PEDAGOGY.md`)

Facts come from `sources.md` and `signal-flow.md`. Scenes referred to are in `presets.md`.

**Checked against the official User Guide and block diagram (2026-10-29).** Fixes in this revision:
- the meter's top LED is **+10**, and PK! is a separate LED by GAIN (UG p.10–11);
- CUE is AUTO-CUE (exclusive) by default (UG p.9);
- only CH 1–4 can be on the crossfader (UG p.12);
- the curve names are verified (UG p.12);
- FILTER ON and combinable filter types are verified (UG p.13–14);
- sends are taken before the filters (UG p.34);
- the mono/stereo RTN jacks are verified (UG p.23).

The lesson prose is original writing; no manual text is reproduced.

## Conventions

- **Ids.** Where a lesson replaces one in today's `devices/xone96/lessons.ts`, I **reuse that id**
  (`xone96-signal-flow`, `-gain-staging`, `-eq-fundamentals`, `-cue`, `-crossfader`, `-fx-send`,
  `-filter-sweeps`, `-low-end-clash`, `-phrasing`, `-bass-swap`, `-full-blend`) so learners' saved
  progress and review queues carry over. The seven new lessons use new `xone96-` ids.
- **Controls.** Twin ids are from `spec.ts`. Ids marked `*` are proposed controls
  (`signal-flow.md` §14). A step that uses one says what to do until it exists.
- **Values** are given in hardware terms first, then as twin values (conversion table in `presets.md`):
  HI/LO −6 dB = `-0.29`, −10 dB = `-0.44`, −12 dB = `-0.5`, −20 dB = `-0.68`, KILL = `-1`. Mids
  −6 dB = `-0.22`, −10 dB = `-0.37`, −27 dB = `-1`; +2 dB = `0.2`. GAIN in dB. Faders, sends, RES
  and CRUNCH run 0–10.
- **Match distances** follow the writing rules: easy targets differ by at least 20 % of knob travel
  (EQ: 0.4 of the −1…+1 range; GAIN: 10 dB of the 50 dB range; FREQ: 2 octaves of the 10-octave
  log range; RES, faders: 2 units), and hard ones by at least 8 %.
- **Full-spectrum audio.** EQ ear lessons need every element playing. Start their auditions at
  TRACK A bar 17 or later, where kick, hats, claps, bass and stabs all play, or use a loaded file.
  Suggestion for the twin: an `audition` that plays bars 17–20 of the chosen deck.
- **Kinds.** `info`, `do`, `predict`, `listen`, `quiz`, `match`, `challenge`, `reflect`. Twin-only
  controls (PLAY, YOU HEAR, DECK) are named as such in the text.
- **Accessibility.** No step relies on LED colour. Meters are described by their legends (0, +6, PK!).

## Curriculum map

| # | id | path / order | level | min | prerequisites | core idea |
|---|---|---|---|---|---|---|
| 1 | `xone96-signal-flow` | foundations / 1 | beginner | 6 | – | input → GAIN → EQ → fader → mix → MASTER |
| 2 | `xone96-gain-staging` | foundations / 2 | beginner | 7 | 1 | GAIN first; peaks 0 to +6, PK! dark |
| 3 | `xone96-eq-fundamentals` | foundations / 3 | beginner | 7 | 2 | four bands; kill vs cut vs boost |
| 4 | `xone96-cue` | foundations / 4 | beginner | 7 | 2 | pre-fade listening, CUE/MST, SPLIT |
| 5 | `xone96-crossfader` | foundations / 5 | intermediate | 7 | 1 | X/OFF/Y assign; curve per job |
| 6 | `xone96-fx-send` | foundations / 6 | intermediate | 8 | 2 | send/return; pre vs post |
| 7 | `xone96-filter-sweeps` | foundations / 7 | intermediate | 8 | 3 | assign, FILTER ON, HPF/BPF/LPF, RES, CRUNCH |
| 8 | `xone96-low-end-clash` | sound-design / 1 | intermediate | 8 | 3 | kick vs bass: complementary EQ |
| 9 | `xone96-phrasing` | performance / 1 | intermediate | 8 | 4 | beats, bars, 8-bar phrases |
| 10 | `xone96-bass-swap` | performance / 2 | intermediate | 7 | 8, 9 | one bassline at a time |
| 11 | `xone96-full-blend` | performance / 3 | advanced | 10 | 6, 7, 10 | a 32-bar transition |
| 12 | `xone96-ear-eq-band` | ear-training / 1 | beginner | 6 | 3 | which band was cut (1 control, wide) |
| 13 | `xone96-ear-filter-type` | ear-training / 2 | intermediate | 6 | 7, 12 | HPF/BPF/LPF and cutoff (1 to 2 controls) |
| 14 | `xone96-ear-over-gain` | ear-training / 3 | intermediate | 7 | 2 | clean vs clipped (1 control fine; interleaved with CRUNCH) |
| 15 | `xone96-ear-resonance` | ear-training / 4 | advanced | 7 | 13 | RES, FREQ, then 3-control interleave |
| 16 | `xone96-studio-routing` | studio / 1 | intermediate | 8 | 2 | instruments into channels |
| 17 | `xone96-studio-balance` | studio / 2 | advanced | 10 | 8, 16 | balance a full track |
| 18 | `xone96-studio-mixdown` | studio / 3 | advanced | 12 | 11, 17 | perform and print your jam |

---

# FOUNDATIONS

## 1. `xone96-signal-flow`: Signal flow: from deck to master
- **path** foundations · **order** 1 · beginner · 6 min · concepts `signal-routing`, `mixing`, `gain-staging`
- **Objective:** By the end you can trace a sound from a channel's INPUT selector through GAIN, EQ
  and fader to the LR MIX and MASTER, and explain why the channel meter moves with the fader down.
- **Start (hardware):** flat board. CH 1 = TRACK A on LINE, fader down. CH 2 = TRACK B but INPUT on
  USB 1 (nothing plugged in) and assigned to crossfader side Y with the crossfader fully at X. These
  are two deliberate faults for the challenge. MASTER at unity.
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 0, ch1_input: 2, ch1_xf: 1, ch1_fader: 0, ch2_src: 1, ch2_input: 0, ch2_xf: 2, ch2_fader: 0, xfader: 0, master: 7.5 } }`

**Steps**
1. **info** (autoplay TRACK A on air): "Listen: this is channel 1 on air. In five minutes you will know every stage it passed through."
   Explanation: A DJ mixer makes no sound of its own; it routes and shapes what is plugged into it.
2. **do** `play` → `true`: "Press PLAY in the deck strip to start the decks." (twin only)
   Principle: "A mixer only shapes and routes sound; something upstream must produce it."
3. **do** `ch1_fader` → `10` (first win): "Push the CH 1 fader all the way up."
   Principle: "A fader is a variable attenuator: fully up is unity, fully down is silence."
   Explanation: Fully up is the normal DJ position. Loudness is set with GAIN, not by parking the fader halfway.
4. **predict** `ch1_input` → `0`: "Switch CH 1 INPUT to USB 1."
   - Q: "Nothing is plugged into USB 1. What will you hear?"
   - Options: 0 "TRACK A, slightly quieter" · 1 "Silence: the channel now listens to an empty input" · 2 "TRACK A, routed through the computer"
   - **Answer 1.** Explain: "INPUT is the first switch in the chain and chooses which socket feeds the strip. Every later stage only processes what arrives here, so an empty input is silence however high the faders are. It doesn't change level (0) and it doesn't re-route the same deck (2)."
   - Principle: "A selector passes one source; every later stage can only process what it passes."
5. **do** `ch1_input` → `2`: "Set CH 1 INPUT back to LINE."
   Principle: "The input position must match the socket the source is plugged into."
6. **predict** `ch1_fader` → `0`: "Pull the CH 1 fader down and watch the CH 1 meter."
   - Q: "When the fader goes down, what will the channel meter do?"
   - Options: 0 "Go dark, like the sound" · 1 "Jump to its top LED" · 2 "Keep moving: it reads before the fader"
   - **Answer 2.** Explain: "The Xone's channel meter reads after GAIN and EQ but before the fader, so it shows what enters the channel even when the crowd hears nothing. That's what lets you set levels in silence. The LR MIX meters do drop, because they read the mix."
   - Principle: "A pre-fader meter shows what enters a channel, so you can set levels silently."
7. **listen**: A `{ ch1_fader: 10, monitor_out: 0 }` vs B `{ ch1_fader: 0, ch1_cue: true, cue_mix: 0, monitor_out: 2 }`, labels "Master, fader up" / "Headphones: CUE, fader down"
   - Q: "Why can the DJ still hear channel 1 in B?" Options: 0 "CUE takes a copy before the fader and sends it only to the headphones" · 1 "CUE pushes the fader back up" · 2 "The master is still playing it" · **Answer 0.** Explain: "The fader still blocks channel 1 from the master; CUE is a private, pre-fader path to the phones."
8. **quiz**: "Which order does a signal take through a Xone:96 channel?"
   - Options: 0 "GAIN → INPUT → fader → EQ → MASTER" · 1 "INPUT → GAIN → EQ → fader → LR MIX → MASTER" · 2 "INPUT → fader → GAIN → EQ → MASTER" · 3 "EQ → INPUT → MASTER → fader"
   - **Answer 1.** Explain: "Select the source, set its level, shape it, decide how much reaches the mix, then set the level of the whole mix. A fader before GAIN (2) would make the pre-fader meter useless for setting level."
9. **challenge**: "Get TRACK B playing on channel 2 alongside channel 1, without touching channel 1."
   - Checklist: "Channel 2 listens to LINE" `s => s.values.ch2_input === 2` · "The crossfader isn't muting channel 2" `s => s.values.ch2_xf === 1 || (s.values.ch2_xf === 2 && Number(s.values.xfader) >= 5) || (s.values.ch2_xf === 0 && Number(s.values.xfader) <= 5)` · "Channel 2's fader is up" `s => Number(s.values.ch2_fader) >= 7` · "Channel 1 is still on air" `s => Number(s.values.ch1_fader) >= 7`
   - Hints: "Work through the stages in order, from the socket onwards." → "Two things block channel 2: its INPUT and its crossfader side." → "Set CH 2 INPUT to LINE, X-FADE to OFF, then raise its fader."
   - Solution: `{ ch2_input: 2, ch2_xf: 1, ch2_fader: 10 }`
10. **reflect**: "In one sentence: why does the channel meter keep moving when the fader is down?"
    Model: "It reads the signal after GAIN and EQ but before the fader, so it shows what enters the channel even when none of it reaches the mix."

**Review**
1. "The Xone:96 channel meter reads…" 0 "after MASTER" · 1 "after GAIN and EQ, before the fader" · 2 "after the fader" · **1**. It is pre-fader so levels can be set silently.
2. "A channel is silent although its fader is up. Check first…" 0 "the INPUT selector" · 1 "the MASTER level" · 2 "the EQ" · **0**. Work from the source; the selector decides whether anything arrives at all.
3. "Which control changes the level of the whole mix without changing the balance between channels?" 0 "GAIN" · 1 "A channel fader" · 2 "MASTER" · **2**. MASTER scales the summed mix; GAIN and faders change one channel relative to the others.
4. "With the crossfader fully at X, a channel assigned to Y is…" 0 "silent in the master" · 1 "unaffected" · 2 "sent to the headphones" · **0**. Only X/Y-assigned channels respond to the crossfader.

---

## 2. `xone96-gain-staging`: Gain staging: GAIN first, then the meters
- foundations · 2 · beginner · 7 min · prerequisites `xone96-signal-flow` · concepts `gain-staging`
- **Objective:** By the end you can set each channel's GAIN so its loudest passages read 0 to +6 on
  the channel meter with PK! dark, and match two channels by meter before opening the fader.
- **Start (hardware):** CH 1 TRACK A, GAIN 0 dB, fader full. CH 2 TRACK B, GAIN −15 dB, fader down.
  Everything else flat.
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 0, ch1_gain: 0, ch1_fader: 10, ch2_src: 1, ch2_gain: -15, ch2_fader: 0 } }`

**Steps**
1. **info** (autoplay): "Watch channel 1's meter: it averages around 0, the loudest hits reach about +6, and the top LED (+10) stays dark."
   Explanation: The channel meter has nine LEDs from −20 to +10 dBu and reads after GAIN and EQ (UG p.11). A separate PK! LED beside GAIN warns that the input itself is overloading. Peaks around +6 leave room for EQ boosts and loud moments.
2. **do** `play` → `true` (first win): "Press PLAY."
   Principle: "Set each stage in order from the source; later stages can't fix an earlier one."
3. **predict** `ch1_gain` → `10`: "Turn CH 1 GAIN up to +10 dB."
   - Q: "What will the channel meter show?"
   - Options: 0 "No change: the fader sets the meter" · 1 "The meter drops" · 2 "Every LED lifts about 10 dB; the loudest hits light the top LED (+10)"
   - **Answer 2.** Explain: "GAIN multiplies the signal before the meter, so +10 dB lifts everything by 10 dB and the peaks reach the +10 LED. The fader comes after the meter (0)."
   - Principle: "Gain multiplies everything after it; +10 dB is about three times the voltage."
4. **do** `ch1_lo` → `1`: "With GAIN still at +10, turn CH 1 LO fully clockwise (+6 dB)."
   Principle: "Boosting EQ adds energy, so it raises level just as more gain does."
   Explanation: The meter reads after the EQ. Bass carries most of a dance track's energy, so the +10 LED now stays lit, and the guide says to turn GAIN or EQ down when that happens (UG p.11). This is how channels get clipped by accident.
5. **listen**: A `{ ch1_gain: 0, ch1_lo: 0, ch1_fader: 10 }` vs B `{ ch1_gain: 10, ch1_lo: 1, ch1_fader: 6 }`, labels "Clean" / "Driven, fader lowered to match loudness"
   - Q: "With loudness roughly matched, what is different about B?" Options: 0 "It's simply quieter" · 1 "The kick is flattened and the peaks buzz: clipping" · 2 "It is wider in stereo" · **Answer 1.** Explain: "Lowering the fader after the overload lowers the volume, not the distortion. The damage happened before the fader."
6. **do** `ch1_lo` → `0`: "Return LO to its centre."
   Principle: "A centred EQ band passes the signal unchanged."
7. **do** `ch1_gain` → `0`: "Set CH 1 GAIN back to 0 dB: peaks around +6, the +10 LED dark."
   Principle: "Fix level at the first stage; clipping can't be undone downstream."
8. **quiz**: "PK! keeps flashing on channel 3. What do you do first?"
   - Options: 0 "Pull channel 3's fader down" · 1 "Turn channel 3's GAIN down" · 2 "Turn MASTER down"
   - **Answer 1.** Explain: "The A&H guide says exactly this: if PK! lights, turn that channel's GAIN down. The fader and MASTER come after the overload, so lowering them hides the symptom and keeps the distortion."
9. **match** (1 control, easy): "Match channel 2's level to the target by ear, using CH 2 GAIN."
   - Target (hardware): CH 2 GAIN 0 dB, fader full, CH 1 fader down. Twin: `{ ch2_gain: 0, ch2_fader: 10, ch1_fader: 0 }`
   - Controls `['ch2_gain']`. The learner starts at −15 dB, a 30 % travel difference.
   - Hints: "Is the target louder or quieter than yours?" → "Watch CH 2's meter: the target peaks near +6." → "GAIN close to 0 dB."
10. **challenge**: "Bring channels 3 (STABS) and 4 (PERC) into the mix so each one's loudest hits read 0 to +6 with PK! dark, then open their faders."
    - Step setup: `{ ch3_gain: 9, ch4_gain: -20, ch3_fader: 0, ch4_fader: 0 }`
    - Checklist: "Channel 3 GAIN is sensible" `s => Number(s.values.ch3_gain) >= -6 && Number(s.values.ch3_gain) <= 3` · "Channel 4 GAIN is sensible" `s => Number(s.values.ch4_gain) >= -6 && Number(s.values.ch4_gain) <= 3` · "Both faders are open" `s => Number(s.values.ch3_fader) >= 5 && Number(s.values.ch4_fader) >= 5` · (optional, if the engine exposes meters) "Channel 3's +10 LED stays dark" `s => Number((s.engine.meters as Record<string, number> | undefined)?.['3'] ?? 0) < 0.316`
    - Hints: "Set GAIN with each fader still down; the meter is pre-fader." → "Channel 3 is far too hot and channel 4 far too quiet." → "Both stems are calibrated to read right at about 0 dB GAIN."
    - Solution: `{ ch3_gain: 0, ch4_gain: 0, ch3_fader: 7, ch4_fader: 7 }`
11. **reflect**: "In one sentence: why fix a clipping channel with GAIN rather than with its fader?"
    Model: "The clipping happens at or before the meter point, so only GAIN (or the EQ) removes it; the fader only turns the distorted signal down."

**Review**
1. "The PK! LED beside a Xone:96 channel's GAIN knob means…" 0 "the cue is active" · 1 "perfect level" · 2 "the input is overloading: turn GAIN down" · **2**. It senses the signal right after GAIN, before the EQ (block diagram, UG p.34).
2. "Boosting LO +6 dB on a bass-heavy track makes the channel meter…" 0 "rise noticeably" · 1 "fall" · 2 "stay put, since the EQ is after the meter" · **0**. The meter is post-EQ.
3. "Two equal but unrelated tracks at the same level sum to about…" 0 "+6 dB" · 1 "+3 dB" · 2 "+10 dB" · **1**. Powers add (10·log10 2 ≈ 3 dB); only identical signals add +6 dB.
4. "With about 20 dB of headroom above 0 dBu, peaks at +6 leave about…" 0 "14 dB before clipping" · 1 "6 dB" · 2 "nothing" · **0**.

---

## 3. `xone96-eq-fundamentals`: EQ: four bands, kills, cuts and boosts
- foundations · 3 · beginner · 7 min · prerequisites `xone96-gain-staging` · concepts `equalization`
- **Objective:** By the end you can say what each of channel 1's four bands controls (HI 3 kHz,
  HI MID 1.1 kHz, LO MID 350 Hz, LO 180 Hz) and explain why the Xone lets you cut far more than you
  can boost.
- **Start (hardware):** CH 1 TRACK A, fader full, EQ flat. **Twin:** `{ reset: true, values: { play: false, ch1_src: 0, ch1_fader: 10 } }`
  (Wait for bar 9 or later for the mid-band steps: the bass and claps enter at bar 9 and the stabs at bar 17.)

**Steps**
1. **info** (autoplay full track): "Four knobs, four regions: weight, body, presence and air. You'll hear each disappear."
2. **do** `play` → `true` (first win): "Press PLAY."
   Principle: "A full mix spans about ten octaves, from sub-bass to air."
3. **predict** `ch1_lo` → `-1`: "Turn CH 1 LO fully anticlockwise: KILL."
   - Q: "What will disappear?" Options: 0 "The hi-hats" · 1 "The kick's thump and the bassline's weight" · 2 "Everything: the channel mutes"
   - **Answer 1.** Explain: "LO covers everything below about 180 Hz, where kicks and basslines live. Hats are far above 3 kHz, so they stay, and the channel keeps playing because only one band went."
   - Principle: "Pitch is frequency: kick and bass fundamentals sit below about 180 Hz."
4. **do** `ch1_lo` → `0`: "Return LO to its centre."
   Principle: "With every band centred, the bands sum back to the original signal."
5. **do** `ch1_hi` → `-1`: "Kill HI."
   Principle: "Hi-hats and cymbals are mostly energy above 3 kHz."
   Explanation: HI is the 3 kHz band, +6 dB to total kill. Without it the track sounds distant, because air absorbs highs over distance.
6. **do** `ch1_hi` → `0`: "Return HI to its centre."
   Principle: "Our ears judge closeness partly by high-frequency content."
7. **do** `ch1_lomid` → `-1`: "Turn LO MID fully anticlockwise (−27 dB)."
   Principle: "Around 200 to 500 Hz is warmth; too much is mud, too little is thin."
   Explanation: LO MID at 350 Hz cuts deep but not to silence. You can still faintly hear the region, because the mids have no kill.
8. **do** `ch1_lomid` → `0`: "Centre LO MID again."
   Principle: "Return EQ to flat before the next move, so you start from the record as made."
9. **listen**: A `{ ch1_himid: 0 }` vs B `{ ch1_himid: 1 }`, labels "HI MID flat" / "HI MID +10 dB"
   - Q: "What does +10 dB at 1.1 kHz do to the claps and stabs?" Options: 0 "Adds deep bass" · 1 "Removes them" · 2 "Pushes them forward, then quickly sounds harsh" · **Answer 2.** Explain: "The ear is most sensitive between about 1 and 4 kHz, so a mid boost sounds loud fast and turns harsh. That is why the boost stops at +10 dB while the cut goes to −27 dB."
10. **quiz**: "Why is the Xone:96 EQ called 'asymmetric' (deep cuts, small boosts)?"
    - Options: 0 "Boost circuits are expensive" · 1 "Cutting frees headroom and stays musical; boosting eats headroom and turns harsh" · 2 "Cuts are louder than boosts"
    - **Answer 1.** Explain: "A DJ mostly removes part of one record to make space for another. Cuts lower the level; boosts add energy that can clip."
11. **match** (1 control, easy): "Recreate the target's low end."
    - Target: LO −12 dB, other bands flat. Twin `{ ch1_lo: -0.5, ch1_lomid: 0, ch1_himid: 0, ch1_hi: 0 }`. Controls `['ch1_lo']` (from 0, 25 % travel).
    - Hints: "Is the bottom fuller or thinner than yours?" → "Only LO moved, and it isn't killed." → "About halfway anticlockwise: −12 dB."
12. **challenge**: "Make the record sound as if it plays in the next room: distant and muffled, but with a beat you can still feel."
    - Checklist: "Highs well down" `s => Number(s.values.ch1_hi) <= -0.5` · "Upper mids reduced" `s => Number(s.values.ch1_himid) <= -0.2` · "Kick still thumps" `s => Number(s.values.ch1_lo) >= -0.3` · "No boosts" `s => ['ch1_hi','ch1_himid','ch1_lomid','ch1_lo'].every(k => Number(s.values[k]) <= 0.05)`
    - Hints: "Walls block highs more than lows." → "Cut HI a lot and HI MID some; leave LO alone." → "HI KILL, HI MID about −15 dB."
    - Solution: `{ ch1_hi: -1, ch1_himid: -0.56, ch1_lomid: 0, ch1_lo: 0 }`
13. **reflect**: "In one sentence: what is the difference between a kill and a cut on the Xone:96?"
    Model: "A kill (HI and LO) removes that band completely; a cut (the mids, down to −27 dB) makes it much quieter but never silent."

**Review**
1. "Which channel 1–4 band removes the kick and bassline when killed?" 0 "LO MID (350 Hz)" · 1 "HI MID (1.1 kHz)" · 2 "LO (180 Hz)" · **2**.
2. "Which bands on channels 1–4 can kill completely?" 0 "HI and LO" · 1 "All four" · 2 "Only the mids" · **0**. The mids stop at −27 dB.
3. "Maximum boost on HI MID and LO MID is…" 0 "+6 dB" · 1 "+10 dB" · 2 "+27 dB" · **1**.
4. "Killing HI makes a track sound…" 0 "further away and duller" · 1 "louder" · 2 "heavier in the bass" · **0**.
5. "All four bands fully down on channel 1 gives…" 0 "total silence" · 1 "only bass" · 2 "a faint mid-range residue, because the mids stop at −27 dB" · **2**. This is what an A&H forum user noticed.

---

## 4. `xone96-cue`: Cueing: hear it before the crowd does
- foundations · 4 · beginner · 7 min · prerequisites `xone96-gain-staging` · concepts `dj-mixing`, `signal-routing`
- **Objective:** By the end you can use CUE, CUE/MST and SPLIT CUE to check the next record's level,
  EQ and phrase in the headphones while the crowd hears only the master.
- **Start (hardware):** CH 1 TRACK A on air. CH 2 TRACK B, fader down, GAIN −8 dB (too low). MONITOR:
  CUE/MST fully CUE, SPLIT off, PRE/POST EQ on POST.
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 0, ch1_fader: 10, ch2_src: 1, ch2_fader: 0, ch2_gain: -8, cue_mix: 0, split_cue: false, cue_post_eq: true, monitor_out: 0 } }`

**Steps**
1. **info** (autoplay master): "The crowd hears the master; you hear your headphones. This lesson turns the headphones into a rehearsal room."
2. **do** `play` → `true` (first win): "Press PLAY."
   Principle: "The audience hears only the master output."
3. **do** `ch2_cue` → `true`: "Press CH 2's CUE."
   Principle: "Pre-fade listening taps a channel before its fader, so fader position doesn't matter."
   Explanation: CUE ACTIVE lights in the MONITOR section, and the main meters switch from the mix to the cued channel's level (UG p.16). The Xone uses AUTO-CUE by default: pressing CUE on another channel moves the cue there (UG p.9).
4. **do** `monitor_out` → `2`: "Set YOU HEAR to PHONES (twin only)."
   Principle: "You can only judge what you are actually monitoring."
   Explanation: A browser has one output. On the hardware, the headphones are a separate output.
5. **predict** `cue_mix` → `0` (already 0; the step confirms it): "Keep CUE/MST fully at CUE and listen."
   - Q: "What do you hear in the headphones?" Options: 0 "Only the master" · 1 "Nothing, because channel 2's fader is down" · 2 "Only channel 2, though its fader is down"
   - **Answer 2.** Explain: "CUE/MST at CUE plays only the cue bus, and the cue is taken before the fader. The crowd still hears nothing from channel 2 because its fader blocks the master."
6. **do** `ch2_gain` → `0` (tolerance ±3 dB): "While cued, set CH 2 GAIN so its peaks match channel 1's, about +6."
   Principle: "Match levels in private so the new track enters at the same loudness."
7. **do** `cue_mix` → `5`: "Turn CUE/MST to the middle: cue and master together."
   Principle: "Hearing both tracks together in private is a rehearsal of the blend."
8. **listen**: A `{ split_cue: false, cue_mix: 5 }` vs B `{ split_cue: true }`, labels "Blended in both ears" / "SPLIT CUE"
   - Q: "Why do DJs use SPLIT CUE in loud clubs?" Options: 0 "It makes the master louder" · 1 "Each ear follows one track, so you can compare them even with poor booth monitors" · 2 "It mutes the master for the crowd" · **Answer 1.** Explain: "SPLIT puts the cue in one ear and the master in the other. It changes only the headphones, not the crowd's sound."
9. **quiz**: "The MONITOR section's PRE/POST EQ switch decides…"
   - Options: 0 "whether the master output has EQ" · 1 "whether you hear the channel's EQ moves in the cue" · 2 "the headphone volume"
   - **Answer 1.** Explain: "POST EQ cues the channel after its EQ, so you hear your LO kill before opening the fader. PRE EQ lets you hear the record untouched."
10. **match** (1 control, easy): "Recreate the target headphone balance."
    - Target `{ monitor_out: 2, split_cue: false, cue_mix: 8, ch2_cue: true }`. Controls `['cue_mix']` (from 5, 30 %).
    - Hints: "Is the target mostly cue or mostly master?" → "More master than cue." → "About three-quarters of the way towards MST."
11. **challenge**: "Prepare channel 3 (STABS) completely in the headphones: level-matched, low end killed, ready to open, and the crowd hears none of it early."
    - Step setup: `{ ch3_src: 4, ch3_gain: 8, ch3_fader: 0, ch3_cue: false }`
    - Checklist: "Channel 3 is cued" `s => s.values.ch3_cue === true` · "The crowd can't hear it yet" `s => Number(s.values.ch3_fader) <= 1` · "Its GAIN is matched" `s => Number(s.values.ch3_gain) >= -6 && Number(s.values.ch3_gain) <= 3` · "Its LO is killed" `s => Number(s.values.ch3_lo) <= -0.9`
    - Hints: "Everything here happens with the fader down." → "CUE first, then GAIN by the meter, then EQ." → "CUE on, GAIN about 0 dB, LO KILL."
    - Solution: `{ ch3_cue: true, ch3_gain: 0, ch3_lo: -1, ch3_fader: 0 }`
12. **do** `monitor_out` → `0`: "Set YOU HEAR back to MASTER."
    Principle: "After preparing in the headphones, always check what the audience hears."
13. **reflect**: "In one sentence: why does a DJ cue a record before opening its fader?"
    Model: "To hear the next record privately and fix its level, EQ and phrase position before the crowd hears it."

**Review**
1. "CUE on the Xone:96 listens to a channel…" 0 "after the master" · 1 "before its fader" · 2 "only when its fader is up" · **1**.
2. "CUE/MST turned fully to CUE gives…" 0 "only the cued channels" · 1 "only the master" · 2 "both equally" · **0**.
3. "While any CUE is on, the Xone:96 main meters show…" 0 "the booth level" · 1 "nothing" · 2 "the cue level" · **2**.
4. "PHONES 2 on the Xone:96 is…" 0 "a second, independent cue system for back-to-back DJs" · 1 "a copy of PHONES 1" · 2 "the booth output" · **0**. It has its own 9-way source selector (UG p.16).
5. "With no CUE pressed at all, the MONITOR headphones play…" 0 "silence" · 1 "the program mix (the LR MIX)" · 2 "channel A" · **1**. With nothing cued, the monitor path carries the program (block diagram, UG p.34), and the meters show the LR MIX (UG p.16).

---

## 5. `xone96-crossfader`: Crossfader: assign, curve, cut and blend
- foundations · 5 · intermediate · 7 min · prerequisites `xone96-signal-flow` · concepts `dj-mixing`, `mixing`
- **Objective:** By the end you can assign channels to X and Y, choose the XFADER curve for the job,
  and play both a smooth blend and rhythmic cuts.
- **Start (hardware):** CH 1 DRUMS and CH 3 STABS, faders full, X-FADE OFF. Crossfader centre, XFADER
  curve left (smooth).
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 2, ch1_fader: 10, ch1_xf: 1, ch3_src: 4, ch3_fader: 10, ch3_xf: 1, xfader: 5, xf_curve: 0 } }`

**Steps**
1. **info** (autoplay cut routine): "One fader, two sides. The same hand can blend for a minute or cut in a sixteenth note; the curve switch decides which."
2. **do** `play` → `true` (first win): "Press PLAY."
   Principle: "Channels left OFF ignore the crossfader completely."
3. **do** `ch1_xf` → `0`: "Assign CH 1 to X."
   Principle: "A crossfader is two faders on one control, moving in opposite directions."
4. **do** `ch3_xf` → `2`: "Assign CH 3 to Y."
   Principle: "Assigning channels to sides lets one hand balance whole groups of channels."
5. **predict** `xfader` → `0`: "Move the crossfader fully to X."
   - Q: "What will you hear?" Options: 0 "Both channels, channel 1 louder" · 1 "Nothing: X means off" · 2 "Only channel 1: the Y side is closed"
   - **Answer 2.** Explain: "At the end stop the opposite side is fully closed. It isn't off (1): the X side is fully open."
6. **do** `xf_curve` → `2`: "Set the XFADER curve switch to FAST CUT (right)."
   Principle: "A fast-cut curve reaches full level within millimetres, so tiny moves become on/off cuts."
   Explanation: The innoFADER's cut-in is calibrated in this position, which is how sharp it can be.
7. **do** `xfader` → `10`: "Cut across to Y on a downbeat."
   Principle: "A hard cut on beat 1 replaces one sound with another instantly."
8. **listen**: A `{ xf_curve: 0, xfader: 5 }` vs B `{ xf_curve: 2, xfader: 5 }`, labels "Constant power, centre" / "Fast-cut, centre"
   - Q: "Why is B louder in the middle?" Options: 0 "Fast-cut adds a boost" · 1 "With fast-cut both sides are already at full level in the middle" · 2 "Constant power mutes channel 3" · **Answer 1.** Explain: "Constant power brings each side down gradually, to about −3 dB at the centre (UG p.12 graph). Fast-cut keeps both full until the very ends: great for cuts, too loud for long blends. The middle position, transition, is full across the middle and softens only the last bit of travel."
9. **quiz**: "You want a long, smooth 32-bar blend. Which XFADER curve?"
   - Options: 0 "Constant power (left)" · 1 "Fast-cut (right)" · 2 "It doesn't matter; curves only matter for scratching"
   - **Answer 0.** Explain: "Constant power changes level across the whole travel, so a slow move gives an even blend. With fast-cut nothing happens until the end, then everything at once."
10. **match** (1 control, easy): "Recreate the target blend position."
    - Target `{ xf_curve: 0, xfader: 3 }`. Controls `['xfader']` (from 10, 70 %).
    - Hints: "Which side is louder in the target?" → "Mostly X, with some Y." → "About a third of the way from X."
11. **challenge**: "Set up a cut routine: drums on one side, stabs on the other, the sharpest crossfader curve and the fast channel-fader curve. Then play the stabs only on the off-beats for a bar."
    - Checklist: "One channel on each side" `s => (s.values.ch1_xf === 0 && s.values.ch3_xf === 2) || (s.values.ch1_xf === 2 && s.values.ch3_xf === 0)` · "Crossfader on FAST CUT" `s => s.values.xf_curve === 2` · "Channel faders on the fast curve" `s => s.values.fader_curve === 2` · "I played off-beat cuts for a bar" (self-check, no function)
    - Hints: "Two switches set curves: one for the crossfader, one for channels 1–4." → "Both curve switches go to the right-hand position." → "Then tap the crossfader towards the stabs' side on the '&' of each beat."
    - Solution: `{ ch1_xf: 0, ch3_xf: 2, xf_curve: 2, fader_curve: 2, xfader: 0 }`
12. **reflect**: "In one sentence: when would you choose fast-cut, and when constant power?"
    Model: "Fast-cut for cuts and scratching, where every move must be instant; constant power for long blends, where the level should change gradually across the whole travel."

**Review**
1. "A channel set to X-FADE OFF is…" 0 "muted" · 1 "unaffected by the crossfader" · 2 "on both sides" · **1**.
2. "On a constant-power curve, each side at the centre is about…" 0 "−3 dB" · 1 "0 dB" · 2 "−20 dB" · **0**. Two unrelated tracks at −3 dB each sum to the loudness of one at full level.
3. "The Xone:96 CHANNEL FADER curve switch affects…" 0 "channels A and B only" · 1 "only the crossfader" · 2 "channels 1–4 (the VCA faders)" · **2**.
4. "The Xone:96 crossfader is…" 0 "an innoFADER with an adjustable cut-in" · 1 "a rotary knob" · 2 "a 60 mm channel fader" · **0**.
5. "Which channels can be put on the Xone:96 crossfader?" 0 "All six main channels" · 1 "CH 1–4 only" · 2 "Only A and B" · **1**. Only CH 1–4 have an XFADER assign toggle. A and B have plain analogue faders that the crossfader never touches (UG p.9, p.12).

---

## 6. `xone96-fx-send`: FX sends and returns: SEND 1, SEND 2, pre and post
- foundations · 6 · intermediate · 8 min · prerequisites `xone96-gain-staging` · concepts `effects`, `signal-routing`
- **Objective:** By the end you can send a channel to an effect, return it on its own channel, EQ the
  return, and choose post-fade for an echo-out or pre-fade for an "echo ghost".
- **Start (hardware):** CH 1 DRUMS 90 %, CH 3 STABS 80 %, SEND 1 POST, delay on SEND 1 → RTN A. CH A
  INPUT RTN, fader down. Delay 3/16, feedback about 45 %.
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 2, ch1_fader: 9, ch3_src: 4, ch3_fader: 8, ch3_snd1: 0, send1_pre: 0, cha_input: 2, cha_fader: 0, chb_fader: 0, fx_time: 1, fx_fdbk: 4.5 } }`

**Steps**
1. **info** (autoplay dub-echo demo): "Every echo you'll hear leaves on a send and comes back on its own channel."
2. **do** `play` → `true` (first win): "Press PLAY."
   Principle: "Short, sparse sounds leave room for echoes to be heard."
3. **do** `ch3_snd1` → `6`: "Turn CH 3's SEND 1 up to about 6."
   Principle: "A send copies a channel to an effects bus without changing the dry sound."
   Explanation: Nothing new is heard yet. The copy has gone to the delay but hasn't come back. On the Xone:96 the send is tapped before the filter section, so an effect always hears the channel unfiltered (block diagram, UG p.34).
4. **predict** `cha_fader` → `8`: "Raise the CH A fader (its INPUT is RTN)."
   - Q: "What will you hear when CH A comes up?" Options: 0 "Echoes of the stabs" · 1 "A second copy of the drums" · 2 "Nothing: RTN is for microphones"
   - **Answer 0.** Explain: "The delay's output comes back on RTN A, which plays through channel A, so its fader is your wet level. Only channel 3 is being sent, so the echoes are of the stabs, not the drums (1)."
   - Principle: "A send/return loop processes a copy and brings it back on its own channel."
5. **do** `cha_lo` → `-1`: "Kill CH A's LO."
   Principle: "EQ on a return shapes only the effect, never the dry sound."
   Explanation: Low-frequency echoes smear the groove. Killing the return's LO keeps the repeats bright and out of the bassline.
6. **do** `fx_fdbk` → `6`: "Set the virtual delay's FDBK to 6." (twin only; on hardware, the effect unit's feedback)
   Principle: "Feedback re-sends each repeat, so more feedback means more, longer repeats."
7. **predict** `ch3_fader` → `0`: "Pull CH 3's fader down on a downbeat."
   - Q: "SEND 1 is POST-fade. What happens to the echoes?" Options: 0 "Everything stops instantly" · 1 "The echoes already in the delay ring on and fade; no new ones start" · 2 "Echoes continue at full level forever"
   - **Answer 1.** Explain: "A post-fade send follows the fader, so closing it stops new sound entering the delay, but the repeats inside keep decaying. That is the echo-out. It doesn't last forever (2) because feedback is below 100 %."
   - Principle: "A post-fade send follows its fader; a pre-fade send ignores it."
8. **do** `send1_pre` → `1` (with *`ch3_snd1_pre` → `true`* when per-channel PRE exists): "Switch CH 3's SEND 1 to PRE."
   Principle: "A pre-fade send keeps feeding the effect when the fader closes."
   Explanation: On the Xone:96, PRE is a button under each channel's SEND 1 knob, and only SEND 1 has it; SEND 2 is always post-fade (UG p.10).
9. **listen**: A `{ send1_pre: 0, ch3_fader: 0 }` vs B `{ send1_pre: 1, ch3_fader: 0 }`, labels "POST, fader down" / "PRE, fader down"
   - Q: "With the fader down, why do you still hear stabs in B?" Options: 0 "B has more feedback" · 1 "PRE turns the fader back up" · 2 "PRE taps the send before the fader, so the delay is still fed" · **Answer 2.** Explain: "Only the dry path is closed. The delay still receives every stab, so you hear a 'ghost' made of echoes alone."
10. **quiz**: "SEND 2 on the Xone:96 is…"
    - Options: 0 "switchable pre or post, like SEND 1" · 1 "always post-fade" · 2 "always pre-fade"
    - **Answer 1.** Explain: "SEND 1 has the per-channel PRE switch; SEND 2 is fixed post-fade. For pre-fade tricks into a reverb, put the reverb on SEND 1."
11. **match** (2 controls, medium): "Recreate the target's echo balance and length."
    - Target `{ send1_pre: 0, ch3_fader: 8, ch3_snd1: 6, cha_fader: 5, cha_lo: -1, fx_fdbk: 8 }`. Controls `['cha_fader', 'fx_fdbk']`.
      Step setup `{ cha_fader: 8, fx_fdbk: 6 }` (differences 30 % and 20 %).
    - Hints: "Are the target's echoes louder or quieter? Longer or shorter?" → "Quieter return, more repeats." → "CH A fader about halfway; FDBK about 8."
12. **challenge**: "Perform an echo-out: the stabs leave the mix on a downbeat with echoes trailing away, and the echoes stay out of the bass."
    - Step setup `{ send1_pre: 0, ch3_fader: 8, ch3_snd1: 0, cha_lo: 0, cha_fader: 3 }`
    - Checklist: "Channel 3 is closed" `s => Number(s.values.ch3_fader) <= 1` · "It was being sent" `s => Number(s.values.ch3_snd1) >= 4` · "SEND 1 is POST" `s => s.values.send1_pre === 0 && s.values.ch3_snd1_pre !== true` · "The return is audible" `s => Number(s.values.cha_fader) >= 4` · "The return's LO is cut" `s => Number(s.values.cha_lo) <= -0.5`
    - Hints: "Set the send and the return up before the move." → "POST, send about 7, return up, return LO cut." → "Then close CH 3's fader exactly on a downbeat."
    - Solution: `{ send1_pre: 0, ch3_snd1: 7, cha_fader: 7, cha_lo: -1, ch3_fader: 0 }`
13. **reflect**: "In one sentence: when would you choose PRE instead of POST on SEND 1?"
    Model: "When the effect should keep receiving the channel after its fader closes, to leave only echoes or a reverb wash."

**Review**
1. "To hear an effect on the Xone:96 you need…" 0 "only the send" · 1 "only the return" · 2 "the channel's send up and the return channel's fader up" · **2**.
2. "Closing a fader with a POST send makes the effect…" 0 "stop receiving new sound while its tail decays" · 1 "stop instantly" · 2 "get louder" · **0**.
3. "Why kill LO on a delay return?" 0 "It makes the echoes longer" · 1 "Low echoes smear the groove and fight the bass" · 2 "It's needed to hear any echo" · **1**.
4. "Which send has the per-channel PRE switch?" 0 "SEND 1" · 1 "SEND 2" · 2 "Both" · **0**.
5. "Why keep a return channel's own send at zero?" 0 "It would mute the effect" · 1 "It changes the delay time" · 2 "The effect would feed back into itself and run away" · **2**.

---

## 7. `xone96-filter-sweeps`: The Xone:VCF filters: HPF, BPF, LPF, RES and CRUNCH
- foundations · 7 · intermediate · 8 min · prerequisites `xone96-eq-fundamentals` · concepts `filter-cutoff`, `filter-resonance`, `filter-type`, `signal-routing`
- **Objective:** By the end you can assign a channel to a filter, pick HPF, BPF or LPF, shape a sweep
  with FREQ, RES and CRUNCH, and punch it in and out with FILTER ON.
- **Start (hardware):** CH 1 TRACK A on air, FILTER assign OFF. FILTER 1: HPF, FREQ fully
  anticlockwise, RES about 20 % (MILD side), CRUNCH 0, FILTER ON off.
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 0, ch1_fader: 10, ch1_filter: 1, f1_type: 0, f1_freq: 20, f1_res: 2, f1_crunch: 0, f1_on: false } }`

**Steps**
1. **info** (autoplay HPF build and drop): "The classic Xone move: the bass drains away, a whistling peak rises, then everything slams back."
2. **do** `play` → `true` (first win): "Press PLAY."
   Principle: "A filter can only change frequencies that are actually in the music."
3. **do** `ch1_filter` → `0`: "Set CH 1's FILTER assign to 1."
   Principle: "A filter only changes what is routed into it."
   Explanation: Any of the six main channels can join FILTER 1. They are summed and filtered together, so one sweep moves them all.
4. **do** *`f1_on`* → `true` (skip until FILTER ON exists): "Press FILTER ON for section 1. With FREQ fully anticlockwise, nothing changes yet."
   Principle: "Engage processing at a neutral setting so switching it in is inaudible."
   Explanation: Each Xone:VCF has its own ON switch. With it OFF the signal passes untouched and CRUNCH is out of circuit (UG p.13; block diagram). The switching is soft, so it never clicks (UG p.14).
5. **predict** `f1_freq` → `800`: "Turn FILTER 1 FREQ slowly clockwise to about 800 Hz."
   - Q: "With HPF selected, what will raising FREQ do?" Options: 0 "Remove the highs: darker" · 1 "Raise the pitch of the music" · 2 "Remove more and more of the bass: thinner, more tension"
   - **Answer 2.** Explain: "A high-pass filter passes what's above its cutoff and removes what's below, so raising FREQ drains the low end first. The notes don't change pitch (1): the filter changes which frequencies pass, not the music."
   - Principle: "A high-pass filter removes everything below its cutoff frequency."
6. **do** `f1_res` → `7`: "Turn RES towards WILD, about 7."
   Principle: "Resonance feeds the filter back on itself, boosting a narrow peak at the cutoff."
   Explanation: At MILD the effect is barely there. At WILD the guide's graph shows a peak of about +7.6 dB at the cutoff, and the filter stops short of oscillating on its own (UG p.13–14).
7. **listen**: A `{ f1_type: 0, f1_freq: 800 }` vs B `{ f1_type: 2, f1_freq: 800 }`, labels "HPF 800 Hz" / "LPF 800 Hz"
   - Q: "Which one sounds 'underwater' and far away?" Options: 0 "A" · 1 "B" · 2 "They sound the same" · **Answer 1.** Explain: "B is the low-pass: it keeps the lows and removes the highs, like hearing a club through a wall. A keeps the highs: thin and bright."
8. **do** `f1_crunch` → `4`: "Add CRUNCH to about 4."
   Principle: "Distortion adds new harmonics at multiples of the input frequencies."
   Explanation: CRUNCH sits before the filter, so the sweep passes through the new harmonics and the resonance bites harder. Its drive is designed for channels reading between −6 and +6 on their meters, and it only works while the filter is ON (UG p.13; block diagram).
9. **quiz**: "CRUNCH comes before the filter. With an LPF at 500 Hz, the crunch sounds…"
   - Options: 0 "Warmer: most of the added fizz above 500 Hz is filtered away again" · 1 "Bypassed: CRUNCH only works with HPF" · 2 "Brighter than without the filter"
   - **Answer 0.** Explain: "Order matters: distortion first, then filtering. A low-pass after it removes the fizzy upper harmonics and leaves thickness. A high-pass after it would keep the fizz."
10. **do** `f1_freq` → `20` (or *`f1_on` → `false`*): "On the next downbeat, press FILTER ON off, or snap FREQ fully anticlockwise."
    Principle: "Contrast creates impact: the full spectrum returning at once feels bigger."
11. **match** (1 control, easy): "Recreate the target's cutoff."
    - Target `{ ch1_filter: 0, f1_on: true, f1_type: 0, f1_freq: 400, f1_res: 6, f1_crunch: 0 }`. Controls `['f1_freq']`; the learner starts at 20 Hz (4.3 octaves away).
    - Hints: "Thinner or fuller than yours?" → "The kick is gone but the claps are still full: the cutoff is in the low-mids." → "Around 400 Hz, a bit under halfway round FREQ."
12. **challenge**: "Build 8 bars of tension on channel 1 and release it on the downbeat, so the drop hits harder than the bars before the build."
    - Checklist: "Channel 1 goes through a filter" `s => s.values.ch1_filter !== 1` · "It's a high-pass" `s => (s.values.ch1_filter === 0 ? s.values.f1_type : s.values.f2_type) === 0` · "Resonance above MILD" `s => Number(s.values.ch1_filter === 0 ? s.values.f1_res : s.values.f2_res) >= 4` · "Released on the drop" `s => { const f = s.values.ch1_filter === 0 ? 'f1' : 'f2'; return Number(s.values[f + '_freq']) <= 40 || s.values[f + '_on'] === false; }` · "I swept over about 8 bars and released on beat 1" (self-check)
    - Hints: "Tension comes from taking the bass away slowly." → "HPF, RES towards WILD, FREQ rising over 8 bars." → "Release exactly on the downbeat of the next phrase."
    - Solution: `{ ch1_filter: 0, f1_type: 0, f1_res: 6, f1_crunch: 2, f1_freq: 20, f1_on: false }`
13. **reflect**: "In one sentence: what does RES add to a filter sweep?"
    Model: "It boosts a narrow band right at the cutoff, so you hear a moving, ringing peak instead of a smooth fade."

**Review**
1. "With HPF selected, turning FREQ up…" 0 "removes more highs" · 1 "removes more lows" · 2 "raises the pitch" · **1**.
2. "Where does CRUNCH sit in the Xone:96 filter?" 0 "Before the filter" · 1 "After the filter" · 2 "On the master output" · **0**.
3. "Which filter type keeps only a band around FREQ?" 0 "HPF" · 1 "LPF" · 2 "BPF" · **2**.
4. "Two channels are on FILTER 1. Sweeping its FREQ…" 0 "moves only the first channel" · 1 "moves both together" · 2 "does nothing until FILTER 2 is on" · **1**.
5. "At WILD, a Xone:96 filter…" 0 "exaggerates a sharp peak at the cutoff but doesn't whistle by itself" · 1 "self-oscillates like a synth" · 2 "switches off" · **0**. RES feeds output back to input up to just short of self-oscillation (UG p.13).

---

# SOUND DESIGN (mix design)

## 8. `xone96-low-end-clash`: Kick versus bass: carving the low end
- sound-design · 1 · intermediate · 8 min · prerequisites `xone96-eq-fundamentals` · concepts `equalization`, `mixing`, `gain-staging`
- **Objective:** By the end you can make a kick and a bassline sit together by deciding who owns
  the sub, cutting the other, and clearing low-mid mud, using cuts more than boosts.
- **Start (hardware):** CH 1 DRUMS and CH 2 BASS, faders full, EQ flat, GAIN 0 dB, X-FADE OFF; other
  channels down.
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 2, ch1_fader: 10, ch2_src: 3, ch2_fader: 10, ch3_fader: 0, ch4_fader: 0, cha_fader: 0, chb_fader: 0 } }`

**Steps**
1. **info** (autoplay): "Two sounds, one octave: hear the kick's thump blur every time the bass plays."
2. **do** `play` → `true` (first win): "Press PLAY: drums on channel 1, bass on channel 2."
   Principle: "Kick and bass fundamentals both live below about 180 Hz."
3. **listen**: A `{ ch2_fader: 0 }` vs B `{ ch2_fader: 10 }`, labels "Drums alone" / "Drums + bass"
   - Q: "Watch the LR MIX meters. What happens when the bass joins?" Options: 0 "They drop" · 1 "They jump: both crowd the lowest octaves" · 2 "Nothing: they're in different ranges" · **Answer 1.** Explain: "Both put most of their energy below 180 Hz, so their levels add and the low end gets crowded and boomy."
4. **predict** `ch2_lo` → `-0.21` (−4 dB): "Turn CH 2 LO down to about −4 dB."
   - Q: "What will a small LO cut on the bass do to the kick?" Options: 0 "The kick gets quieter too" · 1 "The bass vanishes completely" · 2 "The kick punches through more clearly"
   - **Answer 2.** Explain: "Removing some of the bass's sub leaves the lowest octave to the kick, so its thump stands out. Channel 2's EQ can't touch channel 1 (0), and −4 dB is a trim, not a kill (1)."
   - Principle: "When two sounds share a band, cutting one makes the other audible."
5. **do** `ch2_lomid` → `0.2` (+2 dB): "Boost CH 2 LO MID slightly, about +2 dB."
   Principle: "We hear a bassline's notes mostly through its harmonics above 100 Hz."
   Explanation: LO MID at 350 Hz carries the bass's upper harmonics, so a small lift keeps the notes clear after the sub cut. On small speakers that is all you hear of a bassline.
6. **do** `ch1_lomid` → `-0.22` (−6 dB): "Cut CH 1 LO MID to about −6 dB."
   Principle: "Cutting a shared middle region clears mud without losing either sound's core."
   Explanation: Kicks often have a boxy ring around 300–400 Hz. Removing it makes room for the bass harmonics you just lifted.
7. **listen** (compare): A flat `{ ch1_lomid: 0, ch2_lo: 0, ch2_lomid: 0 }` vs B carved `{ ch1_lomid: -0.22, ch2_lo: -0.21, ch2_lomid: 0.2 }`, labels "Flat" / "Carved". No question; say what to watch: "the LR MIX peaks drop and the kick's attack comes back."
8. **quiz**: "Cutting the bass's LO and the kick's LO MID is called…"
   - Options: 0 "Parallel compression" · 1 "Complementary EQ: each sound gets its own region" · 2 "Phase alignment"
   - **Answer 1.** Explain: "Complementary EQ cuts each sound where the other needs space. It beats boosting the one you want, which only adds energy to a crowded band."
9. **match** (1 control, easy): "The target gives the kick the whole sub. Recreate the bass's LO."
   - Target `{ ch1_lomid: -0.22, ch2_lomid: 0.2, ch2_lo: -0.68 }` (bass LO −20 dB). Controls `['ch2_lo']`; from −0.21 that is 23.5 % of travel.
   - Hints: "Who owns the bottom octave in the target?" → "The bass's LO is much lower in the target." → "About −20 dB: three-quarters anticlockwise."
10. **challenge**: "Flip it: make an 808-style balance where the bass owns the sub and the kick is a short punch and click on top."
    - Checklist: "Kick's sub reduced" `s => Number(s.values.ch1_lo) <= -0.29` · "Bass's sub intact" `s => Number(s.values.ch2_lo) >= -0.16` · "Kick's click kept" `s => Number(s.values.ch1_hi) >= -0.1 && Number(s.values.ch1_himid) >= -0.1` · "Both still playing" `s => Number(s.values.ch1_fader) >= 6 && Number(s.values.ch2_fader) >= 6`
    - Hints: "Swap the roles of the two LO knobs." → "Kick LO down, bass LO back to centre; keep the kick's top." → "CH 1 LO about −12 dB, CH 2 LO centre, maybe CH 1 HI MID +2 dB."
    - Solution: `{ ch1_lo: -0.5, ch1_lomid: -0.22, ch1_himid: 0.2, ch2_lo: 0, ch2_lomid: 0 }`
11. **reflect**: "In one sentence: why cut the bass's LO instead of boosting the kick's?"
    Model: "Cutting frees space in a crowded band and lowers the total level, while boosting the kick adds more energy to that same crowded octave and eats headroom."

**Review**
1. "Kick and bassline mainly compete below…" 0 "about 3 kHz" · 1 "about 180 Hz" · 2 "about 10 kHz" · **1**.
2. "On small speakers you mostly hear a bassline through…" 0 "its harmonics, from about 100 Hz up" · 1 "its fundamental below 60 Hz" · 2 "the hi-hats" · **0**.
3. "Complementary EQ means…" 0 "boosting both sounds at the same frequency" · 1 "the same EQ on every channel" · 2 "cutting each sound where the other needs room" · **2**.
4. "The twin's bassline plays between the kicks. How does that help?" 0 "They take turns in time, so their low ends rarely overlap" · 1 "It doesn't help" · 2 "It moves the bass up an octave" · **0**.

---

# PERFORMANCE

## 9. `xone96-phrasing`: Phrasing: beats, bars and phrases
- performance · 1 · intermediate · 8 min · prerequisites `xone96-cue` · concepts `timing-tempo`, `dj-mixing`
- **Objective:** By the end you can count beats, bars and 8-bar phrases in a dance track and bring a
  new part in exactly on a phrase line.
- **Start (hardware):** CH 1 TRACK A on air. CH 2 TRACK B, fader down, LO KILL. CH 3 STABS, fader
  down. Decks stopped, so PLAY starts at bar 1. 124 BPM.
- **Start (twin):** `{ reset: true, values: { play: false, bpm: 124, ch1_src: 0, ch1_fader: 10, ch2_src: 1, ch2_fader: 0, ch2_lo: -1, ch3_src: 4, ch3_fader: 0 } }`

**Steps**
1. **info**: "Dance music is built in blocks: 4 beats make a bar, 8 bars make a phrase, and something changes at the start of almost every phrase."
2. **do** `play` → `true` (first win): "Press PLAY and watch BAR start at 1." (twin display)
   Principle: "To count phrases you must know where 'one' is."
3. **info** (listen along): "Count 1-2-3-4 with the kick, and say each bar number aloud up to 8. Hear the crash on bar 9?"
   Explanation: TRACK A adds claps and the bass at bar 9 and stabs at bar 17, with a crash on every phrase line. Producers mark phrases so listeners feel the structure.
4. **quiz**: "At 124 BPM, how long is one 8-bar phrase?"
   - Options: 0 "About 4 seconds" · 1 "About 15.5 seconds" · 2 "About 1 minute"
   - **Answer 1.** Explain: "8 bars × 4 beats = 32 beats, and 32 × 60/124 s ≈ 15.5 s. A 32-bar blend at this tempo lasts about a minute."
5. **predict** `ch2_fader` → `10` (with check `s => Number(s.values.ch2_fader) >= 7 && [1, 9, 17, 25].includes(Number(s.engine.bar))`): "Push CH 2's fader up on the downbeat of the next phrase (bar 9, 17 or 25)."
   - Q: "If you enter on a phrase line rather than, say, bar 20, what lines up?" Options: 0 "Nothing: bars don't matter if the tempo matches" · 1 "The tracks drift out of tempo" · 2 "Both tracks' phrase changes happen together for the rest of the mix"
   - **Answer 2.** Explain: "Entering on a phrase line keeps the two arrangements aligned, so builds, drops and crashes coincide. Entering at bar 20 keeps the beats matched (0) but makes every change land 3 bars off, which sounds like a mistake."
   - Principle: "Changes on phrase lines sound intentional; changes mid-phrase sound like mistakes."
6. **do** `ch1_hi` → `-0.44` (−10 dB): "Over the next 8 bars, roll CH 1 HI down to about −10 dB."
   Principle: "A change spread across a whole phrase is heard as a transition."
7. **listen**: A `{ ch3_fader: 0 }` vs B `{ ch3_fader: 8 }`, labels "Without stabs" / "With stabs"
   - Q: "Stabs land on the '&' after beat 1 and just before beat 3. How do you know where beat 1 is?" Options: 0 "The kick on 1 and the crash on each phrase's first bar" · 1 "The loudest stab" · 2 "You can't tell without the display" · **Answer 0.** Explain: "The kick marks every beat, the crash marks the phrase. With practice you feel 'one' without looking."
8. **challenge**: "Bring channel 3's stabs in on a phrase line and take them out exactly 8 bars later."
   - Checklist: "Stabs are up during a phrase's first bar" `s => Number(s.values.ch3_fader) >= 6 && Number(s.engine.bar) % 8 === 1` · "I counted 8 bars and closed them on the next phrase line" (self-check)
   - Hints: "Count 5-6-7-8 before the line, then move on 'one'." → "Phrase lines are bars 1, 9, 17 and 25." → "Up at bar 17, down at bar 25."
   - Solution: `{ ch3_fader: 8 }` (performed at bar 17)
9. **reflect**: "In one sentence: why do DJs start the next track on a phrase line?"
   Model: "Because the two tracks' arrangements then change at the same moments, so the mix sounds planned rather than accidental."

**Review**
1. "In most dance music a phrase is usually…" 0 "1 bar" · 1 "8 bars (32 beats)" · 2 "3 bars" · **1**.
2. "How many beats are in a bar of 4/4?" 0 "4" · 1 "8" · 2 "16" · **0**.
3. "At 124 BPM, 8 bars last about…" 0 "8 s" · 1 "60 s" · 2 "15.5 s" · **2**.
4. "Producers often mark beat 1 of a phrase with…" 0 "a crash or a new element" · 1 "silence" · 2 "a tempo change" · **0**.

---

## 10. `xone96-bass-swap`: The bass swap
- performance · 2 · intermediate · 7 min · prerequisites `xone96-low-end-clash`, `xone96-phrasing` · concepts `dj-mixing`, `equalization`, `timing-tempo`
- **Objective:** By the end you can hand the bassline from one track to the other on a phrase
  downbeat with the two LO knobs, so the low end never doubles or disappears.
- **Start (hardware):** scene `bass_swap` (CH 1 TRACK A full; CH 2 TRACK B 90 %, LO KILL, LO MID −6 dB,
  HI −3 dB; both X-FADE OFF).
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 0, ch1_fader: 10, ch2_src: 1, ch2_fader: 9, ch2_lo: -1, ch2_lomid: -0.22, ch2_hi: -0.16 } }`

**Steps**
1. **info** (autoplay demo swap): "Two records, one bassline at a time. The swap is the moment the crowd feels the new record take over."
2. **do** `play` → `true` (first win): "Press PLAY and wait for bar 9, when both basslines are playing."
   Principle: "Only one bassline should own the low end at any moment."
3. **listen**: A `{ ch2_lo: -1 }` vs B `{ ch2_lo: 0 }`, labels "One bassline" / "Two basslines"
   - Q: "What goes wrong in B?" Options: 0 "B is quieter" · 1 "Nothing" · 2 "Two kicks and basses pile up: boomy, smeared, and the meters jump" · **Answer 2.** Explain: "Two low ends in the same octave mask each other and add up in level."
4. **predict** `ch1_lo` → `-1`: "On the downbeat of the next phrase, kill CH 1 LO…"
   - Q: "If you kill CH 1's LO but forget to bring back CH 2's, the dance floor feels…" Options: 0 "a sudden hole: no kick or bass at all" · 1 "double bass" · 2 "no change"
   - **Answer 0.** Explain: "Both LOs killed means no low end. That's why the swap is one move with two hands: one LO goes down exactly as the other comes up."
   - Principle: "Swapping two bands at the same instant keeps the total energy constant."
5. **do** `ch2_lo` → `0`: "…and centre CH 2 LO at the same moment."
   Principle: "The bass carries the groove and the chord's root."
   Explanation: TRACK B's acid bassline now owns the low end; TRACK A carries on above 180 Hz.
6. **do** `ch2_lomid` → `0`: "Over the next 4 bars, bring CH 2 LO MID back to centre."
   Principle: "Restore the incoming track's body gradually, after its bass is in."
7. **do** `ch1_hi` → `-0.44`: "Over the next phrase, roll CH 1 HI down to about −10 dB."
   Principle: "Removing highs makes a sound recede rather than stop."
8. **do** `ch1_fader` → `0`: "On the next phrase line, close CH 1."
   Principle: "A transition ends when the outgoing track leaves on a phrase line."
9. **quiz**: "Why do the swap on a phrase downbeat?"
   - Options: 0 "The LO knobs only work on downbeats" · 1 "To avoid clipping" · 2 "Listeners expect change there, so it sounds intentional"
   - **Answer 2.** Explain: "The downbeat of a new phrase is the strongest moment of the structure. The same move off the beat sounds like a slip."
10. **match** (2 controls, medium): "Who owns the bass in the target? Set both LO knobs to match."
    - Step setup `{ ch1_lo: 0, ch2_lo: -1, ch1_fader: 10, ch2_fader: 9 }`. Target `{ ch1_lo: -1, ch2_lo: 0, ch1_fader: 10, ch2_fader: 9 }`. Controls `['ch1_lo', 'ch2_lo']` (each 50 % away).
    - Hints: "Which bassline do you hear: the rolling one or the acid one?" → "TRACK B's acid bass owns the bottom." → "CH 1 LO KILL, CH 2 LO centre."
11. **challenge**: "Perform a full swap and exit: give TRACK B the bass on a downbeat, then finish with TRACK A gone and its EQ reset for the next record."
    - Step setup `{ ch1_lo: 0, ch1_hi: 0, ch1_fader: 10, ch2_lo: -1, ch2_fader: 9 }`
    - Checklist: "TRACK B owns the bass" `s => Number(s.values.ch2_lo) >= -0.1 && Number(s.values.ch2_fader) >= 7` · "TRACK A is out" `s => Number(s.values.ch1_fader) <= 1` · "Channel 1's EQ is reset" `s => Math.abs(Number(s.values.ch1_lo)) <= 0.1 && Math.abs(Number(s.values.ch1_hi)) <= 0.1` · "The swap landed on a downbeat" (self-check)
    - Hints: "Swap first, exit later." → "Swap on a phrase line, close CH 1 on the next one." → "Then centre CH 1's LO and HI with its fader down."
    - Solution: `{ ch1_lo: 0, ch1_hi: 0, ch1_fader: 0, ch2_lo: 0, ch2_fader: 9 }`
12. **reflect**: "In one sentence: what does the bass swap keep constant, and why does it matter?"
    Model: "It keeps exactly one bassline playing, so the low-end energy the dance floor feels never doubles or drops out."

**Review**
1. "During a bass swap, the incoming track's LO starts…" 0 "boosted +6 dB" · 1 "killed" · 2 "centred" · **1**.
2. "Both LO knobs killed at once gives…" 0 "a hole: no low end at all" · 1 "double bass" · 2 "no change" · **0**.
3. "The best moment for the swap is…" 0 "any off-beat" · 1 "the middle of a bar" · 2 "the first beat of a new phrase" · **2**.
4. "Why does a second bassline make the LR meters jump?" 0 "Bass carries most of the energy, so two add up a lot" · 1 "The meters read only bass" · 2 "The kill knobs add gain" · **0**.

---

## 11. `xone96-full-blend`: Full blend: 32 bars from Track A to Track B
- performance · 3 · advanced · 10 min · prerequisites `xone96-fx-send`, `xone96-filter-sweeps`, `xone96-bass-swap` · concepts `dj-mixing`, `equalization`, `filter-cutoff`, `timing-tempo`, `effects`
- **Objective:** By the end you can plan and perform a 32-bar blend: a phrase-aligned entry, one band
  at a time, a filter on the outgoing record, a bass swap, an echo-out, and a clean reset.
- **Start (hardware):** scene `phrase_transition`, plus FILTER 1 ready (HPF, FREQ fully anticlockwise,
  RES about 40 %) and the delay return on CH A (RTN, 80 %, LO KILL).
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 0, ch1_fader: 10, ch2_src: 1, ch2_fader: 0, ch2_hi: -0.44, ch2_lomid: -0.37, ch2_lo: -1, ch2_cue: true, f1_type: 0, f1_freq: 20, f1_res: 4, send1_pre: 0, cha_input: 2, cha_fader: 8, cha_lo: -1 } }`

**Steps**
1. **info**: "A blend is a story in four phrases: arrive, build, hand over, leave. You'll play all four."
2. **do** `play` → `true` (first win): "Press PLAY."
   Principle: "Plan a transition in phrases before you touch a control."
3. **do** `ch2_fader` → `10` (check: fader ≥ 7 while `engine.bar % 8 === 1`): "On a phrase downbeat, push CH 2's fader up."
   Principle: "Enter where the outgoing track's structure invites it: on a phrase line."
4. **do** `ch2_hi` → `0`: "Over these 8 bars, bring CH 2 HI up to centre."
   Principle: "Move one band at a time so each change is heard but never crowded."
5. **predict** `ch1_filter` → `0`: "Assign CH 1 to FILTER 1 (HPF, FREQ still fully down)."
   - Q: "Why assign it now, with FREQ at the bottom?" Options: 0 "To make Track A louder" · 1 "So engaging it is inaudible, ready to sweep later" · 2 "Because HPF only works at 20 Hz"
   - **Answer 1.** Explain: "With the cutoff below the music the filter passes everything, so switching it in is silent. Later you sweep FREQ up to make Track A step back."
   - Principle: "Engage processing at a neutral setting so switching it in is inaudible."
6. **do** `f1_freq` → `150`: "Over the next phrase, raise FILTER 1 FREQ to about 150 Hz."
   Principle: "A gradual change over a phrase is heard as a transition, not an event."
7. **do** `ch1_lo` → `-1`: "On the next phrase downbeat, kill CH 1 LO…"
   Principle: "Swap the bass on the strongest beat of the structure."
8. **do** `ch2_lo` → `0`: "…and centre CH 2 LO in the same moment."
   Principle: "Constant low-end energy through the swap keeps the floor moving."
9. **do** `ch2_lomid` → `0`: "Bring CH 2 LO MID back to centre over 4 bars."
   Principle: "Restore the new record's body once its bass owns the low end."
10. **quiz**: "Track A should leave on an echo-out. Which send setting and move?"
    - Options: 0 "SEND 2 on PRE, then mute the return" · 1 "Delay feedback to maximum and leave it" · 2 "SEND 1 on POST: send up, then close CH 1's fader on a downbeat"
    - **Answer 2.** Explain: "Post-fade means closing the fader stops new input while the echoes inside decay. SEND 2 can't be pre (0), and maximum feedback builds up instead of fading away (1)."
11. **do** `ch1_snd1` → `6`: "In the last bar of the phrase, turn CH 1 SEND 1 up to about 6."
    Principle: "Feed the effect just before the exit so the tail carries the last phrase."
    Explanation: The Xone:96 taps its sends before the filter section, so the delay hears Track A *unfiltered*, bass included, even though FILTER 1 is thinning it (block diagram, UG p.34). That is why channel A's return has its LO killed.
12. **do** `ch1_fader` → `0`: "Close CH 1's fader exactly on the downbeat."
    Principle: "End a transition on a phrase line so the new track sounds like it always played."
13. **challenge**: "Finish like a pro: Track B alone at full EQ, and channel 1 reset (EQ flat, filter unassigned, send down) for the next record."
    - Checklist: "Track B is up and flat" `s => Number(s.values.ch2_fader) >= 7 && ['ch2_lo','ch2_lomid','ch2_hi'].every(k => Math.abs(Number(s.values[k])) <= 0.1)` · "Track A is out" `s => Number(s.values.ch1_fader) <= 1` · "Channel 1 EQ flat" `s => ['ch1_lo','ch1_hi','ch1_lomid'].every(k => Math.abs(Number(s.values[k])) <= 0.1)` · "Channel 1 filter unassigned" `s => s.values.ch1_filter === 1` · "Channel 1 send down" `s => Number(s.values.ch1_snd1) <= 0.5` · "Cue moved off the live channel" `s => s.values.ch2_cue === false`
    - Hints: "Reset everything you touched on channel 1." → "LO, HI, LO MID, FILTER assign and SEND 1." → "And switch CH 2's CUE off now it's live."
    - Solution: `{ ch1_lo: 0, ch1_hi: 0, ch1_lomid: 0, ch1_filter: 1, f1_freq: 20, ch1_snd1: 0, ch2_cue: false, ch2_lo: 0, ch2_lomid: 0, ch2_hi: 0 }`
14. **reflect**: "In two sentences: describe your blend's four phrases and what each move did."
    Model: "Phrase 1: Track B entered on a downbeat with its lows killed and its highs fading up. Phrase 2: a high-pass thinned Track A; phrase 3 swapped the basses on the downbeat; phrase 4 ended with an echo-out and a full reset of channel 1."

**Review**
1. "Why prepare the incoming track with LO killed?" 0 "So it enters without a bass clash" · 1 "To make it louder" · 2 "Cueing requires it" · **0**.
2. "Why assign the filter with FREQ fully down?" 0 "HPF only works there" · 1 "To boost the bass" · 2 "Switching in at a neutral setting is inaudible" · **2**.
3. "A 32-bar blend at 124 BPM lasts about…" 0 "15 s" · 1 "1 minute" · 2 "5 minutes" · **1**. 32 × 4 × 60/124 ≈ 62 s.
4. "After a blend, why reset the outgoing channel?" 0 "So the next record starts flat and unprocessed" · 1 "To save power" · 2 "To hear the cue" · **0**.

---

# EAR TRAINING

## 12. `xone96-ear-eq-band`: Ear: which EQ band was cut?
- ear-training · 1 · beginner · 6 min · prerequisites `xone96-eq-fundamentals` · concepts `equalization`
- **Objective:** By the end you can tell by ear which of the four bands (HI, HI MID, LO MID, LO) was
  cut on a full track, and recreate the cut.
- **Start (hardware):** CH 1 TRACK A (full arrangement, bar 17 on), fader full, EQ flat. Use headphones.
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 0, ch1_fader: 10 } }`. Audition: TRACK A bars 17–20.

**Steps**
1. **info**: "Four colours to learn: weight (LO), body (LO MID), presence (HI MID) and air (HI). Headphones help: laptop speakers barely play the LO band."
2. **do** `play` → `true` (first win): "Press PLAY and wait until bar 17, when everything is playing."
   Principle: "You can only hear a cut where the music has energy."
3. **listen**: A flat vs B `{ ch1_lo: -1 }` · Q "Which band was cut in B?" Options: 0 "LO" · 1 "HI" · 2 "HI MID" · 3 "LO MID" · **Answer 0.** Explain: "The weight and the kick's thump went; the hats and claps didn't change. That is LO, below 180 Hz."
4. **listen**: A flat vs B `{ ch1_hi: -1 }` · Options: 0 "LO MID" · 1 "HI" · 2 "LO" · 3 "HI MID" · **Answer 1.** Explain: "The hats and air vanished and the track sounds further away: HI, above 3 kHz."
5. **listen**: A flat vs B `{ ch1_lomid: -1 }` · Options: 0 "HI" · 1 "HI MID" · 2 "LO MID" · 3 "LO" · **Answer 2.** Explain: "The kick still thumps and the hats are crisp, but it's thinner and colder: LO MID, 350 Hz."
6. **listen**: A flat vs B `{ ch1_himid: -1 }` · Options: 0 "LO" · 1 "LO MID" · 2 "HI" · 3 "HI MID" · **Answer 3.** Explain: "Claps and stabs lost their edge and the mix sounds hollow, yet the hats and kick are intact: HI MID, 1.1 kHz."
7. **quiz**: "Which cut is hardest to hear on laptop speakers, and why?"
   - Options: 0 "HI: speakers can't play high notes" · 1 "LO: small speakers barely reproduce below about 150 Hz" · 2 "HI MID: it's outside human hearing"
   - **Answer 1.** Explain: "Small drivers can't move enough air for deep bass, so a LO kill changes less on a laptop than in a club. HI MID is right in our most sensitive range (2)."
8. **match** (2 controls, easy): "One band is killed. Find which and recreate it."
   - Target `{ ch1_hi: -1, ch1_lo: 0, ch1_himid: 0, ch1_lomid: 0 }`. Controls `['ch1_hi', 'ch1_lo']` (two candidates; the kill is 50 % travel away).
   - Hints: "Start at the bottom: is the kick's weight there?" → "The bottom is intact; listen to the top." → "HI is killed."
9. **match** (2 controls, medium): "Now a mid band is cut to −27 dB."
   - Target `{ ch1_himid: 0, ch1_lomid: -1 }`. Controls `['ch1_himid', 'ch1_lomid']`.
   - Hints: "Is the sound hollow and dull, or thin and cold?" → "Thin and cold, and the claps still crack: the lower mid." → "LO MID fully down."
10. **match** (1 control, finer): "How much? LO is partly cut."
    - Target `{ ch1_lo: -0.5 }` (−12 dB). Controls `['ch1_lo']`; learner starts at 0 (25 %).
    - Hints: "More or less weight than yours?" → "Less, but the kick is still there." → "About halfway anticlockwise."
11. **challenge**: "Cuts only: make TRACK A sound like a small radio in the corner of the room."
    - Checklist: "No boosts" `s => ['ch1_hi','ch1_himid','ch1_lomid','ch1_lo'].every(k => Number(s.values[k]) <= 0.05)` · "No real bass" `s => Number(s.values.ch1_lo) <= -0.5` · "Highs softened" `s => Number(s.values.ch1_hi) <= -0.29` · "Presence kept, since radios are all mid-range" `s => Number(s.values.ch1_himid) >= -0.3`
    - Hints: "What can't a tiny speaker play?" → "Remove the lows, soften the highs, keep the middle." → "LO KILL, HI about −6 dB, mids alone."
    - Solution: `{ ch1_lo: -1, ch1_lomid: -0.3, ch1_himid: 0, ch1_hi: -0.5 }`
12. **reflect**: "Describe each band in two words (for example, LO: weight, thump)."
    Model: "LO: weight, thump. LO MID: warmth, body. HI MID: presence, bite. HI: air, sparkle."

**Review**
1. "Thinner and colder, kick and hats intact: which cut?" 0 "HI" · 1 "LO MID" · 2 "LO" · **1**.
2. "Claps and vocals lose their edge: which cut?" 0 "HI MID" · 1 "LO" · 2 "LO MID" · **0**.
3. "Hats gone, track sounds distant: which cut?" 0 "LO MID" · 1 "HI MID" · 2 "HI" · **2**.
4. "Killing LO removes…" 0 "the hi-hats" · 1 "kick thump and bass weight" · 2 "the claps" · **1**.

---

## 13. `xone96-ear-filter-type`: Ear: HPF, BPF or LPF?
- ear-training · 2 · intermediate · 6 min · prerequisites `xone96-filter-sweeps`, `xone96-ear-eq-band` · concepts `filter-type`, `filter-cutoff`
- **Objective:** By the end you can tell high-pass, band-pass and low-pass apart by ear and set the
  cutoff to within about an octave.
- **Start (hardware):** CH 1 TRACK A on FILTER 1, ON. HPF, FREQ about 800 Hz, RES about 30 %, CRUNCH 0.
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 0, ch1_fader: 10, ch1_filter: 0, f1_on: true, f1_type: 0, f1_freq: 800, f1_res: 3, f1_crunch: 0 } }`

**Steps**
1. **info**: "Three shapes: HPF keeps the top (thin), LPF keeps the bottom (muffled), BPF keeps a slice (telephone)."
2. **do** `play` → `true` (first win): "Press PLAY."
   Principle: "Each filter type keeps a different part of the spectrum."
3. **listen**: A `{ f1_type: 0 }` vs B `{ f1_type: 2 }` · Q "Which one is the low-pass?" Options: 0 "A" · 1 "B" · 2 "Neither" · **Answer 1.** Explain: "B kept the kick and bass and lost the hats: low-pass. A did the opposite."
4. **listen**: A `{ f1_type: 1 }` vs B `{ f1_type: 0 }` · Q "Which one is the band-pass?" Options: 0 "A" · 1 "B" · 2 "Both" · **Answer 0.** Explain: "A lost the deep bass *and* the airy top, leaving a nasal slice: band-pass."
5. **quiz**: "The hats are gone and the kick is huge. Which filter, and is FREQ high or low?"
   - Options: 0 "HPF, FREQ high" · 1 "BPF, FREQ at 20 kHz" · 2 "LPF, FREQ fairly low"
   - **Answer 2.** Explain: "Losing the top while keeping the bottom is low-pass. The more top is gone, the lower FREQ is."
6. **match** (1 switch, easy): "Which shape is the target?" Target `{ f1_type: 1, f1_freq: 1000, f1_res: 3 }`. Controls `['f1_type']` (exact).
   - Hints: "Is the bass there? Is the air there?" → "Neither: only a middle slice." → "BPF."
7. **match** (1 control, easy): "Same LPF, different cutoff: find it." Step setup `{ f1_type: 2, f1_freq: 3000 }`. Target `{ f1_type: 2, f1_freq: 300 }`. Controls `['f1_freq']` (3.3 octaves, 33 %).
   - Hints: "Darker or brighter than yours?" → "Much darker: even the claps are dull." → "About 300 Hz."
8. **match** (2 controls, medium): Step setup `{ f1_type: 2, f1_freq: 500 }`. Target `{ f1_type: 0, f1_freq: 2000 }`. Controls `['f1_type', 'f1_freq']` (type differs; 2 octaves).
   - Hints: "First the shape: is the top or the bottom missing?" → "The bottom is missing: high-pass." → "HPF around 2 kHz: only hats, claps and the stabs' top remain."
9. **challenge**: "Make TRACK A sound as if it comes down a phone line: thin, nasal, no bass, no air."
   - Checklist: "A band-pass shape (only BPF lit; HPF + LPF together would be a notch)" `s => s.values.f1_type === 1 || (s.values.f1_bpf === true && s.values.f1_hpf !== true && s.values.f1_lpf !== true)` · "Centred in the voice range" `s => Number(s.values.f1_freq) >= 600 && Number(s.values.f1_freq) <= 3000` · "Channel 1 is on FILTER 1" `s => s.values.ch1_filter === 0`
   - Hints: "Phones cut both ends." → "Band-pass." → "BPF around 1–1.5 kHz, a little RES."
   - Solution: `{ f1_type: 1, f1_freq: 1200, f1_res: 5 }`
10. **reflect**: "In one sentence each: what do HPF, BPF and LPF keep?"
    Model: "HPF keeps everything above FREQ, LPF keeps everything below it, and BPF keeps only a band around it."

**Review**
1. "Thin and bright with no kick:" 0 "HPF" · 1 "LPF" · 2 "BPF" · **0**.
2. "Muffled, 'underwater':" 0 "BPF" · 1 "LPF" · 2 "HPF" · **1**.
3. "Thin, nasal, 'telephone':" 0 "LPF" · 1 "HPF" · 2 "BPF" · **2**.
4. "An LPF with FREQ at 20 kHz sounds…" 0 "nearly unchanged" · 1 "muffled" · 2 "silent" · **0**.

---

## 14. `xone96-ear-over-gain`: Ear: clean, hot or clipping?
- ear-training · 3 · intermediate · 7 min · prerequisites `xone96-gain-staging` · concepts `gain-staging`
- **Objective:** By the end you can hear the difference between a louder clean signal and a clipped
  one at matched loudness, set GAIN on the clean side of the line, and tell channel overload apart
  from CRUNCH.
- **Start (hardware):** CH 1 TRACK A (bar 9 on), GAIN 0 dB, fader full, EQ flat.
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 0, ch1_fader: 10, ch1_gain: 0 } }`

**Steps**
1. **info**: "Loud isn't the problem; distortion is. Your ears will learn to hear squashed peaks even when the volume is the same."
2. **do** `play` → `true` (first win): "Press PLAY and wait for the bassline at bar 9."
   Principle: "Distortion is easiest to hear on sharp transients like kicks and claps."
3. **listen**: A `{ ch1_gain: 0, ch1_fader: 10 }` vs B `{ ch1_gain: 10, ch1_lo: 1, ch1_himid: 1, ch1_fader: 6 }`, labels "Clean" / "Overdriven, loudness matched"
   - Q: "What gives B away?" Options: 0 "B is much quieter" · 1 "B has more echo" · 2 "The kick is flattened and the claps buzz, even at the same loudness" · **Answer 2.** Explain: "Clipping shaves the peaks off, flattening the punch and adding harsh harmonics. Lowering the fader afterwards can't undo it."
4. **predict** `ch1_gain` → `10`: "Turn CH 1 GAIN to +10 dB."
   - Q: "Will this alone make the channel clip hard?" Options: 0 "Yes, instantly and badly" · 1 "Probably not: peaks reach about +16 dBu, under the +20 dBu ceiling, but the meter's +10 LED warns you" · 2 "No, GAIN can't clip"
   - **Answer 1.** Explain: "Peaks near +6 plus 10 dB is about +16 dBu. The Xone has 20 dB of internal headroom (UG p.35), so the channel is hot and the +10 LED lights (PK! may flash too; its threshold isn't published), but it isn't crushed yet. One EQ boost on top pushes it over."
   - Principle: "Headroom is the gap between your peaks and the circuit's ceiling."
5. **do** `ch1_lo` → `1`: "Now add LO +6 dB."
   Principle: "Every boost after the gain stage spends the same headroom."
   Explanation: Bass peaks now cross the ceiling. Listen for the kick turning flat and papery.
6. **quiz**: "What is the honest A/B test for distortion?"
   - Options: 0 "Compare at matched loudness" · 1 "Play the louder one first" · 2 "Read the meter only"
   - **Answer 0.** Explain: "Louder almost always sounds better at first. Match loudness, then listen for squashed peaks and buzz."
7. **match** (1 control, easy): Step setup `{ ch1_gain: 0, ch1_lo: 1, ch1_fader: 6 }`. Target `{ ch1_gain: 10, ch1_lo: 1, ch1_fader: 6 }`. Controls `['ch1_gain']` (10 dB, 20 %).
   - Hints: "Is the target's kick round or flattened?" → "Flattened: the target is clipping." → "GAIN near the top: about +10 dB."
8. **match** (1 control, fine): Step setup `{ ch1_gain: 10, ch1_lo: 1, ch1_fader: 7 }`. Target `{ ch1_gain: 4, ch1_lo: 1, ch1_fader: 7 }`. Controls `['ch1_gain']` (6 dB, 12 %).
   - Hints: "Is the target clean or just distorting?" → "Just clean: no buzz on the kick." → "About +4 dB."
9. **match** (2 controls, interleaved with filters): "Something distorts. Is it the channel or the filter's CRUNCH? Fix only the culprit."
   - Step setup `{ ch1_gain: 0, ch1_filter: 0, f1_on: true, f1_type: 2, f1_freq: 20000, f1_crunch: 0 }`. Target `{ ch1_gain: 0, ch1_filter: 0, f1_on: true, f1_type: 2, f1_freq: 20000, f1_crunch: 7 }`. Controls `['ch1_gain', 'f1_crunch']`.
   - Hints: "Look at the channel meter: is it near its top LED (+10)?" → "The meter is calm, so the distortion comes after the meter: in the filter." → "CRUNCH about 7; GAIN stays at 0 dB."
10. **challenge**: "Make TRACK A as loud as you can on its channel without ever lighting the meter's +10 LED or PK!, using GAIN and at most one small EQ boost."
    - Checklist: "GAIN in a sane range" `s => Number(s.values.ch1_gain) >= -2 && Number(s.values.ch1_gain) <= 6` · "At most one boost" `s => ['ch1_hi','ch1_himid','ch1_lomid','ch1_lo'].filter(k => Number(s.values[k]) > 0.05).length <= 1` · (optional) "+10 LED dark" `s => Number((s.engine.meters as Record<string, number> | undefined)?.['1'] ?? 0) < 0.316`
    - Hints: "Raise GAIN until the peaks touch +6, then stop." → "Each boost costs headroom, so spend it once." → "GAIN about +3 dB, LO +2 dB at most."
    - Solution: `{ ch1_gain: 3, ch1_lo: 0.3, ch1_himid: 0, ch1_hi: 0, ch1_lomid: 0 }`
11. **reflect**: "In one sentence: why can't lowering the fader fix a clipping channel?"
    Model: "The clipping happens before the fader, so the fader only turns down a signal that is already distorted."

**Review**
1. "Clipping mainly damages…" 0 "stereo width" · 1 "transients, and adds harsh harmonics" · 2 "tempo" · **1**.
2. "To judge distortion fairly, first…" 0 "match loudness" · 1 "turn it up" · 2 "add reverb" · **0**.
3. "The channel meter is calm but the sound is distorted. The likely cause on the Xone:96 is…" 0 "GAIN too high" · 1 "the crossfader" · 2 "CRUNCH on the channel's filter" · **2**.
4. "Headroom is…" 0 "the gap between normal level and clipping" · 1 "the master level" · 2 "the booth volume" · **0**.

---

## 15. `xone96-ear-resonance`: Ear: resonance from MILD to WILD
- ear-training · 4 · advanced · 7 min · prerequisites `xone96-ear-filter-type` · concepts `filter-resonance`, `filter-cutoff`, `equalization`
- **Objective:** By the end you can judge how much resonance a filter has, match RES and FREQ
  together by ear, and untangle an EQ kill from a resonant filter in the same sound.
- **Start (hardware):** CH 1 TRACK A (bar 17 on) on FILTER 1, ON. LPF, FREQ about 1 kHz, RES fully MILD.
- **Start (twin):** `{ reset: true, values: { play: false, ch1_src: 0, ch1_fader: 10, ch1_filter: 0, f1_on: true, f1_type: 2, f1_freq: 1000, f1_res: 0 } }`

**Steps**
1. **info**: "Resonance is a ring at the cutoff: MILD is a smooth slope, WILD is a whistle riding on the music."
2. **do** `play` → `true` (first win): "Press PLAY."
   Principle: "A filter's slope and its peak are two different things."
3. **predict** `f1_res` → `9`: "Turn RES up to WILD, about 9."
   - Q: "What will you hear around 1 kHz?" Options: 0 "The track gets brighter everywhere" · 1 "A ringing, nasal peak riding on the music" · 2 "Silence"
   - **Answer 1.** Explain: "Resonance boosts a narrow band at the cutoff, so instead of a smooth fade you hear a peak there, like a vowel. Above the cutoff the LPF still removes the highs, so it isn't brighter overall (0)."
   - Principle: "Resonance boosts a narrow band at the cutoff, making the filter ring."
4. **listen**: A `{ f1_res: 2 }` vs B `{ f1_res: 8 }`, labels "Towards MILD" / "Towards WILD" (the audition sweeps FREQ 400 Hz → 3 kHz)
   - Q: "Which one makes the sweep audible as a moving pitch?" Options: 0 "A" · 1 "B" · 2 "Same" · **Answer 1.** Explain: "The stronger the peak, the more it sounds like a pitch moving through the music."
5. **quiz**: "Why is resonance more obvious during a sweep than standing still?"
   - Options: 0 "Resonance only exists while moving" · 1 "Sweeping adds distortion" · 2 "The peak moves, so the ear follows a changing pitch-like ring"
   - **Answer 2.** Explain: "A static peak blends into the timbre; a moving one stands out against the steady music."
6. **match** (1 control, easy): Step setup `{ f1_res: 2 }`. Target `{ f1_res: 8, f1_freq: 1000 }`. Controls `['f1_res']` (60 %).
   - Hints: "Smooth or ringing?" → "Ringing strongly." → "RES about 8."
7. **match** (1 control, finer): Step setup `{ f1_res: 8 }`. Target `{ f1_res: 6 }`. Controls `['f1_res']` (20 %).
   - Hints: "More or less ring than yours?" → "A little less." → "RES about 6."
8. **match** (2 controls): Step setup `{ f1_res: 2, f1_freq: 2000 }`. Target `{ f1_res: 7, f1_freq: 500 }`. Controls `['f1_res', 'f1_freq']` (50 % and 2 octaves).
   - Hints: "Find the ring first: how strong is it?" → "Then its pitch: low and boomy, or high and whistly?" → "RES about 7, FREQ about 500 Hz."
9. **match** (3 controls, interleaved with EQ): "Two sections changed: an EQ band and the filter. Find both."
   - Step setup `{ f1_res: 2, f1_freq: 6000, ch1_lo: 0 }`. Target `{ f1_type: 2, f1_freq: 1500, f1_res: 6, ch1_lo: -1 }`. Controls `['f1_res', 'f1_freq', 'ch1_lo']` (40 %, 2 octaves, 50 %).
   - Hints: "Start at the bottom: is the kick there? That's the EQ, not the filter." → "LO is killed; the filter is a low-pass with a clear ring." → "LO KILL, RES about 6, FREQ about 1.5 kHz."
10. **challenge**: "Make a 'talking' filter: a low-pass so resonant it sounds like a vowel, placed where the claps live, with the kick still thumping."
    - Checklist: "Low-pass" `s => s.values.f1_type === 2` · "Strong resonance" `s => Number(s.values.f1_res) >= 6` · "Placed in the clap range" `s => Number(s.values.f1_freq) >= 600 && Number(s.values.f1_freq) <= 2500` · "Kick intact" `s => Number(s.values.ch1_lo) >= -0.3`
    - Hints: "Vowels are resonant peaks in the mid-range." → "LPF, RES well up, FREQ near 1 kHz." → "Sweep FREQ slowly between 700 Hz and 1.5 kHz: 'ooo-aaa'."
    - Solution: `{ f1_type: 2, f1_res: 7, f1_freq: 1100, ch1_lo: 0 }`
11. **reflect**: "In one sentence: how do you tell resonance from an EQ boost?"
    Model: "Resonance sits at the filter's cutoff and moves with FREQ, ringing like a vowel, while an EQ boost stays at its band's fixed frequency."

**Review**
1. "Resonance boosts…" 0 "every frequency" · 1 "only the bass" · 2 "a narrow band at the cutoff" · **2**.
2. "On a Xone filter, WILD is…" 0 "a strong peak just short of self-oscillation" · 1 "a separate distortion" · 2 "the filter switched off" · **0**.
3. "A ringing peak that moves when you turn FREQ is…" 0 "an EQ boost" · 1 "resonance" · 2 "CRUNCH" · **1**.
4. "An LPF with low FREQ and high RES sounds…" 0 "boomy and ringing" · 1 "thin and bright" · 2 "silent" · **0**.

---

# STUDIO

Studio lessons use `device: 'studio'` with `requires`. Mixer steps set `instance: 'xone96'`; route
checks read `s.routes` (as in `lib/studio/sets.ts`, for example `'analog-rytm': 'xone96:studio_1'`).

## 16. `xone96-studio-routing`: Studio: route your instruments into the mixer
- studio · 1 · intermediate · 8 min · prerequisites `xone96-gain-staging` · requires `analog-rytm`, `analog-four`, `sub37`, `xone96` · concepts `signal-routing`, `gain-staging`, `mixing`
- **Objective:** By the end you can route drum-machine and synth outputs into their own Xone:96
  channels, choose the right INPUT, and gain-stage each instrument like a record.
- **Start (hardware):** Analog Rytm, Analog Four and Sub 37 in the rack, none cabled to the mixer.
  Xone:96 flat, faders down. Studio transport stopped, 124 BPM, sync on.
- **Start (twin):** `{ reset: false }` for the instruments (keep the learner's patterns); the mixer
  starts `{ reset: true, values: { ch1_fader: 0, ch2_fader: 0, ch3_fader: 0 } }`; `routes: {}`.

**Steps**
1. **info**: "In a studio the mixer is the centre: every instrument's output becomes a channel. On a real Xone:96 that's a pair of cables into the rear LINE inputs."
2. **do** (check `s => s.transport.playing`): "Press Play on the studio transport."
   Principle: "Clock-synced instruments play in time because they share one transport."
3. **do** (check `s => s.routes['analog-rytm'] === 'xone96:studio_1'`): "Route the Analog Rytm's main output to Xone:96 channel 1."
   Principle: "Each source needs its own channel so you can level, EQ and cue it separately."
4. **predict** `ch1_input` → `2` (`instance: 'xone96'`): "Set CH 1 INPUT to LINE."
   - Q: "The Rytm is cabled to the LINE jacks. With INPUT on PHONO, what would you hear?" Options: 0 "The same sound, louder" · 1 "Silence: PHONO listens to a different pair of jacks" · 2 "The Rytm in mono"
   - **Answer 1.** Explain: "INPUT chooses which rear socket feeds the channel. Any other position hears whatever is plugged in there, which here is nothing. Never plug a line source into a phono-level input: the RIAA stage would make it hugely loud and bass-heavy."
5. **do** `ch1_fader` → `10` (`instance: 'xone96'`; first win): "Push CH 1's fader up: the drums are on the mixer."
   Principle: "A routed source is only heard once every stage in its path is open."
6. **do** (check `s => s.routes['analog-four'] === 'xone96:studio_2'`): "Route the Analog Four to channel 2."
   Principle: "Keep instruments on the same channels every session so your hands learn the layout."
7. **do** (`instance: 'xone96'`, check `s => { const g = Number(s.instances.xone96?.values.ch2_gain); return g >= -10 && g <= 6 && Number(s.instances.xone96?.values.ch2_fader) >= 6; }`): "With CH 2 cued, set its GAIN so the A4 peaks around +6, then raise its fader to about 8."
   Principle: "Gain-stage an instrument exactly as you would a record: at the input, by the meter."
8. **quiz**: "A mono synth has one output. Which Xone:96 input plays it in both speakers without a special cable?"
   - Options: 0 "An RCA LINE input on channel 3" · 1 "The MIC input on channel A" · 2 "A 1/4\" RTN jack on channel A or B (the L/MONO jack feeds both sides)"
   - **Answer 2.** Explain: "The RTN A–D 1/4\" inputs are mono/stereo; the guide says to use the L/M socket for a mono device (UG p.23, p.36). A single RCA lands on the left only. The MIC input is for dynamic mics on a clean-feed bus that skips the filters and the booth (UG p.22)."
9. **listen** (`instance: 'xone96'`): A `{ ch2_fader: 0 }` vs B `{ ch2_fader: 8 }`, labels "Rytm alone" / "Rytm + A4"
   - Q: "The LR MIX meters rise in B. Why?" Options: 0 "Their signals add together on the mix bus" · 1 "The A4 boosts the Rytm" · 2 "The meters show only the newest channel" · **Answer 0.** Explain: "A mix is a sum. Every new channel adds level, which is why headroom is managed across the whole mix."
10. **challenge**: "Add the Sub 37 on channel 3 as the bass: routed, gain-staged and sitting under the A4 without a low-end clash."
    - Checklist: "Sub 37 on channel 3" `s => s.routes['sub37'] === 'xone96:studio_3'` · "Channel 3 gain-staged" `s => { const v = s.instances.xone96?.values; return !!v && Number(v.ch3_gain) >= -12 && Number(v.ch3_gain) <= 6; }` · "Channel 3 is up" `s => Number(s.instances.xone96?.values.ch3_fader) >= 5` · "The A4 leaves the low end to the bass" `s => Number(s.instances.xone96?.values.ch2_lo) <= -0.29`
    - Hints: "Same three moves as before: route, GAIN, fader." → "Then decide who owns the low end: the bass." → "Cut CH 2 LO by about −10 dB."
    - Solution: `{ data: { routes: { sub37: 'xone96:studio_3' } }, values: { ch3_gain: 0, ch3_fader: 8, ch2_lo: -0.44 } }`
11. **reflect**: "In one sentence: why give every instrument its own channel instead of mixing them inside one?"
    Model: "Separate channels let you set each instrument's level, EQ, effects and cue independently, and that independence is what mixing is."

**Review**
1. "A drum machine's main outputs belong on which input?" 0 "PHONO" · 1 "LINE" · 2 "MIC" · **1**.
2. "Which Xone:96 inputs are simple returns with no EQ and no USB?" 0 "RTN C and RTN D" · 1 "CH 1–4 LINE" · 2 "MIC A" · **0**.
3. "Two instruments make the LR meters rise because…" 0 "each channel adds gain" · 1 "the meters are faulty" · 2 "their signals add together on the mix bus" · **2**.
4. "Why gain-stage an instrument with its fader down?" 0 "The channel meter is pre-fader, so GAIN can be set silently" · 1 "Faders change GAIN" · 2 "It's quieter for the instrument" · **0**.

---

## 17. `xone96-studio-balance`: Studio: balance a full track
- studio · 2 · advanced · 10 min · prerequisites `xone96-low-end-clash`, `xone96-studio-routing`, `xone96-fx-send` · requires `analog-rytm`, `analog-four`, `sub37`, `xone96` · concepts `mixing`, `equalization`, `gain-staging`, `effects`
- **Objective:** By the end you can build a balanced mix from drums, bass and chords: the kick as the
  reference, the bass under it, chords EQ'd out of the way, one shared space effect, and mix peaks
  below PK!.
- **Start (hardware):** Rytm → CH 1, A4 → CH 2, Sub 37 → CH 3, all GAIN-staged, faders down, EQ flat.
  Delay on SEND 1 → RTN A (CH A INPUT RTN, LO KILL, fader down).
- **Start (twin):** routes as in set `bass-and-drums` plus `'analog-four': 'xone96:studio_2'`, Sub 37 on
  `studio_3`. Mixer `{ reset: true, values: { ch1_fader: 0, ch2_fader: 0, ch3_fader: 0, cha_input: 2, cha_lo: -1, cha_fader: 0 } }`.

**Steps**
1. **info**: "A professional balance starts from one reference, the kick. Everything else is placed around it."
2. **do** (check `s => s.transport.playing`): "Start the studio transport."
   Principle: "Balance while the music plays: levels mean nothing in silence."
3. **do** `ch1_fader` → `10` (first win): "Bring CH 1 (drums) to full: the kick is your reference."
   Principle: "Fix one element first, then judge every other level against it."
4. **do** `ch3_fader` → `7` (tolerance ±2): "Raise CH 3 (bass) until it feels as strong as the kick, not stronger."
   Principle: "In dance music, kick and bass carry the groove together and should feel equal."
5. **predict** `ch3_hi` → `-0.29` (−6 dB): "Cut CH 3's HI by about −6 dB."
   - Q: "What will cutting the bass's top do?" Options: 0 "Make the bass much quieter" · 1 "Clean up the bass's buzz so the hats and the kick's click stand out; the bass stays just as strong" · 2 "Change the bass notes"
   - **Answer 1.** Explain: "A bass's power is below 1 kHz; its top end is mostly buzz that masks the hats and the kick's click. Removing it clears the top without weakening the low end."
6. **do** `ch2_lo` → `-0.44` (−10 dB): "Cut CH 2 LO by about −10 dB so the chords leave the low end to the bass."
   Principle: "Give each frequency region one owner."
7. **do** `ch2_lomid` → `-0.15` (−4 dB): "Cut CH 2 LO MID by about −4 dB."
   Principle: "Small cuts where parts overlap clear mud without making parts disappear."
8. **listen**: A all flat `{ ch2_lo: 0, ch2_lomid: 0, ch3_hi: 0 }` vs B carved `{ ch2_lo: -0.44, ch2_lomid: -0.15, ch3_hi: -0.29 }`, labels "Flat" / "Carved"
   - Q: "What did the carving change most?" Options: 0 "Every part is clearer and the mix peaks lower" · 1 "The tempo" · 2 "Nothing" · **Answer 0.** Explain: "Removing overlaps reduces masking, so each part is easier to hear, and it lowers the summed peaks."
9. **do** `ch2_snd1` → `3`: "Send CH 2 to SEND 1, about 3."
   Principle: "One shared effect puts several parts in the same space."
10. **do** `cha_fader` → `5`: "Bring the delay return on CH A up to about 5."
    Principle: "Keep the effect lower than you think: it should be felt more than heard."
11. **quiz**: "With everything up, the LR MIX meters hit PK!. What's the best fix?"
    - Options: 0 "Turn MASTER down only" · 1 "Lower the channel faders together, or their GAINs, to restore mix headroom" · 2 "Boost the kick's LO so it cuts through"
    - **Answer 1.** Explain: "The mix bus itself is overloaded, so reduce what feeds it. The Xone's LR meters read the mix before MASTER 1 (UG p.16), so turning MASTER down (0) leaves them on PK!; boosting (2) adds more level."
12. **match** (1 control, easy): "Recreate the target's bass level against the kick." Step setup `{ ch3_fader: 9 }`. Target `{ ch1_fader: 10, ch3_fader: 5 }`. Controls `['ch3_fader']` (40 %).
    - Hints: "Is the target's bass louder or quieter than the kick?" → "Quieter: the kick leads." → "About halfway."
13. **challenge**: "Balance the track so a listener could hum the chord changes, feel the kick and follow the bassline, with the mix peaks below PK!."
    - Checklist: "Kick is the reference" `s => Number(s.instances.xone96?.values.ch1_fader) >= 8` · "Bass and chords sit in range" `s => { const v = s.instances.xone96?.values; return !!v && [v.ch2_fader, v.ch3_fader].every(f => Number(f) >= 4 && Number(f) <= 9); }` · "Chords leave the lows" `s => Number(s.instances.xone96?.values.ch2_lo) <= -0.29` · "Bass top tidied" `s => Number(s.instances.xone96?.values.ch3_hi) <= -0.16` · "I can hum the chords and follow the bass" (self-check)
    - Hints: "Start from the kick and add one part at a time." → "Each part gets one cut where it overlaps another." → "Kick full, bass about 6, chords about 6 with LO −10 dB."
    - Solution: `{ ch1_fader: 10, ch3_fader: 6, ch3_hi: -0.29, ch2_fader: 6, ch2_lo: -0.44, ch2_lomid: -0.15, ch2_snd1: 3, cha_fader: 5 }`
14. **reflect**: "In one sentence: why start a balance from the kick?"
    Model: "It's the loudest, most constant element, so setting it first gives every other level a fixed reference."

**Review**
1. "The reference element for balancing dance music is usually…" 0 "the reverb return" · 1 "the hi-hats" · 2 "the kick" · **2**.
2. "Cutting a chord part's LO helps because…" 0 "it leaves the low end to kick and bass" · 1 "it makes the chords louder" · 2 "it adds reverb" · **0**.
3. "Why use one delay on a send for several channels?" 0 "Sends are louder" · 1 "It places the parts in one shared space using one effect" · 2 "Delays can't be inserted" · **1**.
4. "The LR MIX meters show PK!. The real fix is to…" 0 "reduce what feeds the mix bus" · 1 "turn MASTER down" · 2 "boost the kick" · **0**.

---

## 18. `xone96-studio-mixdown`: Studio: mix down your jam
- studio · 3 · advanced · 12 min · prerequisites `xone96-full-blend`, `xone96-studio-balance` · requires `xone96` (and the learner's instruments) · concepts `mixing`, `dj-mixing`, `timing-tempo`, `filter-cutoff`, `effects`
- **Objective:** By the end you can turn a looping jam into a finished arrangement: sections in
  phrase lengths, fader and filter moves on phrase lines, an exit, and a mix that leaves headroom for
  the recording.
- **Start:** the learner's own studio, kept as it is (`start: { reset: false }`). On hardware, the
  recording path is USB 11/12 set to MST, or the RECORD (RCA) output. Note that both leave out a MIC
  by default (clean feed).

**Steps**
1. **info**: "A mixdown is a performance: intro, build, drop, break, outro, each a multiple of 8 bars. You'll play yours on the Xone:96."
2. **do** (check `s => Object.values(s.routes).filter(r => String(r).startsWith('xone96:')).length >= 2`): "Make sure at least two instruments are routed into the Xone:96."
   Principle: "Every part you want to shape live needs its own channel."
3. **do** (check `s => s.arrangement.enabled && s.arrangement.sections.length >= 4 && s.arrangement.sections.every(x => x.bars % 8 === 0)`): "Turn on the song arranger and lay out at least four sections of 8 or 16 bars."
   Principle: "Arrangements in phrase lengths make every change land on a phrase line."
4. **predict** (check `s => s.transport.playing`): "Start the transport. In the first section, keep only drums and one other part up."
   - Q: "Why start sparse?" Options: 0 "The mixer can't take more channels" · 1 "To save CPU" · 2 "Each new part gets a moment to arrive, and the contrast gives the drop its impact"
   - **Answer 2.** Explain: "Impact is contrast. If everything plays from bar 1, there's nothing left to add at the drop."
5. **do** (`instance: 'xone96'`, check `s => { const v = s.instances.xone96?.values; return !!v && ['ch1','ch2','ch3','ch4','cha','chb'].some(c => v[c + '_filter'] === 0) && v.f1_type === 0 && Number(v.f1_freq) >= 200; }`): "Before the drop, assign your main channel to FILTER 1 (HPF) and sweep FREQ up over 8 bars."
   Principle: "Removing the low end before a drop makes its return feel bigger."
6. **do** (`instance: 'xone96'`, check `s => { const v = s.instances.xone96?.values; return !!v && (Number(v.f1_freq) <= 40 || v.f1_on === false); }`): "On the drop's downbeat, release the filter."
   Principle: "Release tension exactly on the downbeat."
7. **quiz**: "For the recording, where should the LR MIX meters peak?"
   - Options: 0 "Always on PK!: loudest is best" · 1 "Around 0 to +6, PK! dark, leaving headroom" · 2 "Below −20 to be safe"
   - **Answer 1.** Explain: "Peaks near +6 keep the rest of the 20 dB headroom free. A clipped recording can't be repaired, and one far too quiet (2) is buried in noise and hard to judge."
8. **challenge**: "Perform your mixdown from start to finish: every section change on a phrase line, a drop that's bigger than the build, and an outro that leaves on an echo or a filter."
   - Checklist (self-check items plus two functions): "Arranger on, with phrase-length sections" `s => s.arrangement.enabled && s.arrangement.sections.every(x => x.bars % 8 === 0)` · "An effect send was used" `s => { const v = s.instances.xone96?.values; return !!v && ['ch1','ch2','ch3','ch4'].some(c => Number(v[c + '_snd1']) > 0 || Number(v[c + '_snd2']) > 0); }` · "Every change landed on a phrase line" (self) · "The drop was bigger than the build" (self) · "The outro left on an echo or a filter" (self) · "The mix never lit PK!" (self)
   - Hints: "Plan it on paper first: section names and bar counts." → "Build: fewer parts and a rising HPF. Drop: everything, filter released." → "Outro: SEND 1 up on the last bar, then close the faders on the downbeat."
   - Solution (example arrangement for "show me"): `{ data: { arrangement: { enabled: true, loop: false, sections: [ { name: 'Intro', bars: 16 }, { name: 'Build', bars: 8 }, { name: 'Drop', bars: 16 }, { name: 'Break', bars: 8 }, { name: 'Drop 2', bars: 16 }, { name: 'Outro', bars: 16 } ] } } }`
9. **reflect**: "In two sentences: what did your biggest moment rely on, and what would you change next time?"
   Model: "The drop worked because the build removed the low end with a high-pass for 8 bars and released it on the downbeat. Next time I'd bring the chords in a phrase later so the build is sparser."

**Review**
1. "Section lengths in dance music are usually…" 0 "random" · 1 "multiples of 3 bars" · 2 "multiples of 8 bars" · **2**.
2. "Recording peaks should sit…" 0 "around 0 to +6, PK! dark" · 1 "on PK!" · 2 "below −20" · **0**.
3. "A drop feels bigger when…" 0 "everything plays all the time" · 1 "the section before it removes energy, with fewer parts or an HPF build" · 2 "MASTER is turned up at the drop" · **1**.
4. "On the Xone:96, which USB 11/12 setting records the master mix?" 0 "MST" · 1 "SEND 2" · 2 "Either" · **0**. (The switch sits under MASTER; a MIC is left out of this feed by default.)

---

## Implementation notes for the lesson author
- **New controls used:** `f1_on`/`f2_on` (lessons 7, 11, 13–15, 18; until they exist, drop the
  `f1_on` targets and use the FREQ-at-bottom fallback already written into the steps) and per-channel
  `chN_snd1_pre` (lesson 6; fall back to the global `send1_pre`). Every other id exists today.
- **Engine state used:** `engine.bar` (lessons 9 and 11) and `engine.meters` (optional checks on the
  channel meter's **+10** LED in lessons 2 and 14; +10 dBu is a linear 0.316 against the twin's
  0.1 = 0 dBu reference). The separate PK! LED (post-GAIN, pre-EQ) would need its own engine value;
  its threshold isn't published.
- **Hardware facts the answers rely on (all now verified):**
  - constant power is about −3 dB per side at the centre (measured, UG p.12);
  - the LR meters read pre-MASTER 1 (UG p.16);
  - AUTO-CUE (UG p.9);
  - with nothing cued the monitor plays the program (block diagram, UG p.34);
  - only CH 1–4 are on the crossfader (UG p.12);
  - sends are pre-filter (block diagram).

  Make the twin behave the same way (`signal-flow.md` §14), or these answers will be wrong in the app.
- **Ids that change with the v2 spec:** drop `cha_xf`/`chb_xf`. The XFADER middle position is
  *transition*. Scenes and lessons never rely on A/B crossfader assignment.
- **Review answer positions vary** on purpose, so learners can't learn "the answer is always A".
