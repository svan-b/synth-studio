# Analog Rytm MKII: lesson outlines (v2, checked against the OS 1.72 manual)

These are 20 lessons, written to `docs/PEDAGOGY.md`, the `Lesson` and `LessonStep` types (`types/index.ts`) and the warnings in `scripts/validate-devices.ts`:
- every challenge has hints and a solution;
- every predict step has an action or a check;
- every multiple-choice question has an explain;
- ids start with `analog-rytm-`;
- every lesson has a path, an objective, a predict or listen step, a quiz, a match or challenge, and at least 3 reviews.

The prose is original. The manual informs the facts only, per `manuals/COPYRIGHT-RULES.md`. **Manual refs** give page numbers in the *Analog Rytm MKII User Manual OS 1.72* for `manualReference` fields.

## Conventions

**Units.** Values are hardware display values (`signal-flow.md`). Start states use the kits in `presets.md`.

**Encoder letters.** These follow the manual's screen layouts (`signal-flow.md` §4–5 and §9, verified p.78–109). The ones these lessons use:

| Page | A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|---|
| BD HARD | TUN | SWT | SNP | DEC | WAV | HLD | TIC | LEV |
| BD CLASSIC | TUN | SWT | SWD | DEC | WAV | HLD | TRA | LEV |
| SD CLASSIC | TUN | DET | BAL | DEC | SNP | NOD | NOL | LEV |
| CP CLASSIC | RAT | NUM | RND | CPD | TON | NOD | NOL | LEV |
| XT CLASSIC | TUN | SWT | SWD | DEC | TON | NOD | NOL | LEV |
| CH/OH CLASSIC | TUN | – | – | DEC | – | – | COL | LEV |
| CY CLASSIC | TUN | TON | – | DEC | – | – | COL | LEV |
| TRIG | NOT | VEL | LEN | PRB/TRC | SYN | SMP | ENV | LFO |
| FLTR | ATK | DEC | SUS | REL | FRQ | RES | TYP | ENV |
| AMP | ATK | HLD | DEC | OVR | DEL | REV | PAN | VOL |
| DELAY | TIM | X | WID | FDB | HPF | LPF | REV | VOL |
| REVERB | PRE | DEC | FRQ | GAI | HPF | LPF | – | VOL |
| DIST | AMT | SYM | DOV | – | – | – | DEL | REV |
| COMP | THR | ATK | REL | MUP | RAT | SEQ | MIX | VOL |

**Control ids** (suggestions; rename them to the twin's):

| Kind | Id | Notes |
|---|---|---|
| Track parameter | `t{n}_{page}_{abbr}` | Track n: 1 BD, 2 SD, 3 RS, 4 CP, 5 BT, 6 LT, 7 MT, 8 HT, 9 CH, 10 OH, 11 CY, 12 CB. `abbr` is the screen label in lower case. Examples: `t1_src_swt`, `t4_fltr_typ`, `t1_trig_not`. |
| Machine | `t{n}_machine` | |
| FX track | `fx_{delay\|reverb\|dist\|comp\|lfo}_{abbr}` | Example: `fx_delay_fdb` |
| UI | `track` (0–11, 12 = FX), `page`, `pad_mode`, `play`, `tempo`, `rec` (grid recording) | |

**Enumerated controls** are index values:

| Control | Index order |
|---|---|
| FLTR TYP | LP2 0, LP1 1, BP 2, HP1 3, HP2 4, BS 5, PK 6 |
| COMP ATK | 0.03, 0.1, 0.3, 1, 3, 10, 30 ms (0–6) |
| COMP REL | 0.1, 0.2, 0.4, 0.6, 1, 2 s, A1, A2 (0–7) |
| COMP RAT | 1:2, 1:4, 1:8, MAX (0–3) |
| COMP SEQ | OFF, LPF, HPF, HIT (0–3) |

**Checks** use `docs/ELEKTRON_SEQUENCER.md`. Step numbers there are 0-based.

```ts
const p = asProject(s.data, 12);
trigSteps(p, p.active, 0)
getStep(p, p.active, 1, 7)?.vel
lockedSteps(p, p.active, 0, 'src_dec')
```

**Hardware moves taught:**
- Select a track with [TRK] + pad (p.15). Tapping a pad only plays it, unless AUTO TRK SWITCH is on (p.67).
- Placing trigs needs GRID RECORDING ([RECORD]) (p.39).
- Choose a machine with [SRC] pressed twice (p.21).

## Curriculum map

| # | id | Path / order | Difficulty | Needs | Manual refs |
|---|---|---|---|---|---|
| 1 | analog-rytm-f1-tracks-pads-voices | foundations 1 | beginner | | p.15, 21–23 |
| 2 | analog-rytm-f2-voice-chain | foundations 2 | beginner | 1 | p.13, 15, 77–80 |
| 3 | analog-rytm-s1-kick | sound-design 1 | beginner | 2 | p.21, 77, 97 |
| 4 | analog-rytm-s2-snare-clap | sound-design 2 | beginner | 3 | p.100, 102 |
| 5 | analog-rytm-s3-hats-cymbals-choke | sound-design 3 | beginner | 1, 2 | p.21, 106–108 |
| 6 | analog-rytm-s4-toms-envelopes | sound-design 4 | intermediate | 3 | p.79, 105 |
| 7 | analog-rytm-s5-sends | sound-design 5 | intermediate | 2 | p.36, 79, 81–82 |
| 8 | analog-rytm-s6-dist-comp | sound-design 6 | intermediate | 7 | p.82–83 |
| 9 | analog-rytm-e1-decay | ear-training 1 | beginner | 3 | p.97, 107 |
| 10 | analog-rytm-e2-pitch-sweep | ear-training 2 | intermediate | 9 | p.97 |
| 11 | analog-rytm-e3-filter-type | ear-training 3 | intermediate | 2 | p.79 |
| 12 | analog-rytm-e4-compression | ear-training 4 | advanced | 8, 9, 11 | p.83 |
| 13 | analog-rytm-q1-rhythm-basics | sequencing 1 | beginner | 1 | p.20, 37, 39 |
| 14 | analog-rytm-q2-groove | sequencing 2 | intermediate | 13 | p.39, 43, 49–50 |
| 15 | analog-rytm-q3-parameter-locks | sequencing 3 | intermediate | 13, 3 | p.39, 43, 47 |
| 16 | analog-rytm-q4-trig-conditions | sequencing 4 | intermediate | 15 | p.43, 48–49 |
| 17 | analog-rytm-p1-mutes-fills-rolls | performance 1 | intermediate | 16 | p.23, 35, 41–42, 49 |
| 18 | analog-rytm-p2-scenes-perf | performance 2 | advanced | 8, 17 | p.23, 28–31 |
| 19 | analog-rytm-t1-sync-route | studio 1 | intermediate | 13 | p.61–62, 65 |
| 20 | analog-rytm-t2-chains-songs-arrange | studio 2 | advanced | 19, 16 | p.38, 53–55 |

Two topics are folded into other lessons:
- Retrigs (sequencing) are taught in #17 with fills, as transition tools.
- Chains and songs are taught in #20 with the studio arranger.

The suggested 21st lesson is "LFO: moving hats", using the Kit 03 CH LFO, after #15.

---

## 1. analog-rytm-f1-tracks-pads-voices: Twelve tracks, eight voices

foundations · 1 · beginner · ~6 min · concepts `signal-routing`, `sequencer-pattern` · tags pads, voices, choke · refs p.15, p.21–23

**Objective:** Play and select every track, and explain why some pairs of tracks cut each other off.

**Start:** `reset: true`; Kit 01 (with its test groove in A01); PLAY off; pad mode PLAY; `track` 0; page TRIG.

**Steps**

1. **info** (autoplay the Kit 01 groove)
   - Instruction: "Listen to the init kit. Analog circuits inside the Rytm make every one of these drum sounds."
   - Principle: "A drum machine is several small synthesizers, each designed for one kind of hit."

2. **do** (first win; check: the engine reports a BD pad hit, then an SD pad hit)
   - Instruction: "Tap the BD pad softly, then hard. Then tap SD."
   - Principle: "Pads sense how hard you hit, so harder taps play louder drums."

3. **do** `track` → 1
   - Instruction: "Hold [TRK] and tap the SD pad to make SD the track you edit."
   - Principle: "Playing a sound and choosing what to edit are separate jobs."
   - Explanation: "Tapping a pad only plays it. [TRK] + pad selects it, unless AUTO TRK SWITCH is on in the settings."

4. **info** (focus: the pads)
   - Instruction: "The 12 pads are 12 tracks, but only 8 analog voices sit behind them."
   - Explanation: "RS/CP, MT/HT, CH/OH and CY/CB share a voice. BD, SD, BT and LT each have their own."

5. **predict** (check: an OH hit, then a CH hit within 1 s)
   - Instruction: "Tap OH, and while it rings, tap CH."
   - Q: "OH and CH share one voice. What happens to the ringing open hat?"
   - Options:
     0. "It stops: the closed hat takes over the voice"
     1. "It keeps ringing under the closed hat"
     2. "Both get quieter"
     3. "CH waits until the open hat ends"
   - Answer: **0**
   - Explain: "One voice makes one sound at a time, so the closed hat replaces the open one. Layering them would need two voices, and a new hit never waits."
   - Principle: "Two sounds that share one circuit can't sound at the same moment."

6. **quiz**
   - Q: "Which pair does **not** share a voice?"
   - Options: "RS and CP" · "MT and HT" · "BD and SD" · "CY and CB"
   - Answer: **2**
   - Explain: "BD and SD each have their own voice. MT and HT look independent, but they share one."

7. **do** `play` → true
   - Instruction: "Press [PLAY]."
   - Principle: "A step sequencer plays stored hits in time, loop after loop."

8. **listen**
   - A: OH SRC DEC 70, with CH trigs one step after each OH. B: the same without those CH trigs. Labels: ["Choked", "Free"].

9. **challenge**
   - Instruction: "Make the open hat ring a full beat before anything cuts it."
   - Checklist:
     - OH has ≥ 2 trigs.
     - No CH trig within 3 steps after any OH trig.
   - Hints:
     1. "Which track cuts the open hat?"
     2. "Move the CH trigs that follow each OH."
     3. "Leave 4 empty steps after each OH."
   - Solution: OH on 3 and 11; CH on 1, 9 and 15.

10. **reflect**
    - Prompt: "Why does a closed hat cut an open hat?"
    - Model: "Both use the same analog voice, which can play only one sound, so the newest hit takes it over."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "How many analog voices does the Rytm MKII have?" | 8 · 12 · 16 | 0 | "12 tracks share 8 voices." |
| 2 | "CH and OH trig on the same step. Which plays?" | OH (the right-hand track has priority) · CH · both | 0 | "In each pair the right-hand track wins (manual p.21)." |
| 3 | "How do you select SD for editing?" | Hold [TRK] and tap SD · tap SD · press [SRC] | 0 | "[TRK] + pad selects; a tap only plays." |
| 4 | "A ride on CY and an open hat on OH…" | can ring together · cut each other · can't exist | 0 | "They are on different voices." |

---

## 2. analog-rytm-f2-voice-chain: Pages, encoders and the voice chain

foundations · 2 · beginner · ~8 min · prereq #1 · concepts `signal-routing`, `filter-cutoff`, `envelope-decay` · refs p.13, p.15, p.77–80

**Objective:** Find a parameter by page and encoder, and describe the path from sound source, through overdrive, filter and amp.

**Start:** Kit 01; `track` 0 (BD HARD); page TRIG; PLAY off.

**Steps**

1. **info** (focus: the [PARAMETER] keys)
   - Instruction: "Each track is one chain. SRC makes the sound, SMPL adds a sample, FLTR shapes tone, AMP shapes level."
   - Explanation: "Encoders A–H edit whatever page is on screen. The overdrive control sits on the AMP page, but the circuit drives the sound before it reaches the filter."

2. **do** `page` → SRC, then `t1_src_dec` → 100 (first win)
   - Instruction: "Press [SRC]. Turn encoder D (DEC) to about 100 and tap BD."
   - Principle: "The source makes the raw sound, and its decay sets how long it rings."

3. **predict** `t1_fltr_frq` → 40
   - Instruction: "Press [FLTR]. Turn encoder E (FRQ) down to about 40 and tap BD."
   - Q: "The kick is already low. What will a low-pass FRQ of 40 do?"
   - Options:
     0. "Remove the click and the top, leaving a darker thump"
     1. "Lower its pitch"
     2. "Make it ring longer"
     3. "Nothing"
   - Answer: **0**
   - Explain: "The filter strips upper harmonics, including the click. Pitch comes from TUN on the SRC page. 'Nothing' is tempting because the body is low, but the click is all highs."
   - Principle: "A low-pass filter removes harmonics above its cutoff; the pitch stays put."

4. **do** `t1_fltr_frq` → 127
   - Instruction: "Turn FRQ back to 127."
   - Principle: "Resetting one control lets you hear the next change on its own."

5. **do** `t1_amp_vol` → 70
   - Instruction: "Press [AMP]. Turn encoder H (VOL) to about 70."
   - Principle: "Volume changes level, not tone colour."

6. **listen**
   - A: `t1_amp_dec` INF. B: `t1_amp_dec` 30. Labels: ["AMP DEC INF", "AMP DEC 30"].
   - Question: "What did AMP DEC 30 change?" Options: "The tail got shorter" · "The pitch" · "The click got louder". Answer **0**.
   - Explain: "The amp envelope can only shorten the sound. At INF it leaves the machine's DEC in charge."

7. **quiz**
   - Q: "OVR is an encoder on the AMP page. Where does the overdrive act?"
   - Options:
     0. "Before the filter"
     1. "After the amp"
     2. "On the reverb"
   - Answer: **0**
   - Explain: "The page puts it with the amp controls, but in the signal path the boost comes before the multimode filter. So the filter can tame its fizz."

8. **match** (2 controls, wide)
   - Target: `t1_src_dec` 30 and `t1_fltr_frq` 70. Start: 100 and 127.
   - Instruction: "Recreate the target kick by ear."
   - Hints:
     1. "One control changes length, the other brightness."
     2. "The target is shorter and darker."
     3. "SRC DEC near 30, FLTR FRQ near 70."

9. **reflect**
   - Prompt: "Name the stages of a Rytm track in order, and what each does."
   - Model: "The machine and sample make the sound, overdrive adds grit, the filter shapes tone, and the amp shapes level and length before pan, volume and the effect sends."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "First stage of a Rytm voice?" | the sound sources (SRC/SMPL) · the filter · the amp | 0 | "Sources, then overdrive, filter, amp." |
| 2 | "AMP DEC at INF means…" | the machine's decay sets the length · the sound never ends · the amp is muted | 0 | "The amp stops shortening the sound." |
| 3 | "Lowering FRQ on LP2…" | darkens the sound · lowers the pitch · adds reverb | 0 | "It removes the highs." |
| 4 | "With the FX track selected, [SRC] opens…" | DELAY · REVERB · COMP | 0 | "The FX track's pages are DELAY, REVERB, DIST, COMP and LFO." |

---

## 3. analog-rytm-s1-kick: Anatomy of a kick (BD HARD vs BD CLASSIC)

sound-design · 1 · beginner · ~9 min · prereq #2 · concepts `oscillator-pitch`, `modulation-depth`, `envelope-decay` · tags kick · refs p.21, p.77, p.97

**Objective:** Build a punchy kick from pitch, pitch sweep and decay, and choose between BD HARD and BD CLASSIC.

**Start:** Kit 01; `track` 0 (BD HARD at init); page SRC; PLAY off.

**Steps**

1. **listen** (hook, autoplay)
   - A: the Kit 02 kick. B: the init kick. Labels: ["Target", "Init"].
   - Instruction: "Here's the goal: a techno kick. Listen for its punch and its click."

2. **do** `t1_src_swt` → 30 (first win)
   - Instruction: "Tap BD. Turn encoder B (SWT) from 90 down to about 30, and tap again."
   - Principle: "A faster pitch drop makes a tighter, punchier kick."
   - Explanation: "A struck drum head starts tight and relaxes, so its pitch falls. SWT sets how fast."

3. **predict** `t1_src_dec` → 100
   - Instruction: "Turn encoder D (DEC) up to about 100 and tap."
   - Q: "What will a longer DEC do?"
   - Options: "A longer, boomier tail" · "A higher pitch" · "A sharper click" · "A louder attack only"
   - Answer: **0**
   - Explain: "DEC sets how long the body rings: the 808-style boom. Pitch is TUN (A) and the click is TIC (G). The whole kick seems louder, but the attack itself doesn't change."
   - Principle: "Decay is how long a sound keeps ringing after the hit."

4. **do** `t1_src_dec` → 58
   - Instruction: "Set DEC back to about 58."
   - Principle: "At club tempos a shorter kick leaves room for the bass."

5. **do** `t1_src_tic` → 88
   - Instruction: "Turn encoder G (TIC) up to about 88."
   - Principle: "A short click at the start carries the timing, even on small speakers."

6. **do** `t1_src_tun` → −2
   - Instruction: "Turn encoder A (TUN) to −2."
   - Principle: "Tuning the kick to the song's key stops it clashing with the bass."
   - Explanation: "BD machines tune in semitones."

7. **info**
   - Instruction: "BD HARD can't change how far its pitch sweeps; only the speed (SWT). Encoder C is SNP, a fast snap at the start."
   - Explanation: "For a sweep depth control, change the machine."

8. **do** `t1_machine` → 'BD CLASSIC'
   - Instruction: "Press [SRC] twice to open the MACHINE menu. Choose BD CLASSIC and press [YES]."
   - Principle: "A machine is a recipe for the voice circuit, with its own controls."

9. **listen**
   - BD CLASSIC with SWT 64 and DEC 60. A: encoder C (SWD) 20. B: SWD 100. Labels: ["Shallow sweep", "Deep sweep"].

10. **quiz**
    - Q: "On BD HARD, how do you change how far the pitch sweeps?"
    - Options:
      0. "You can't. Change SWT for speed, or switch to BD CLASSIC."
      1. "Turn SNP"
      2. "Turn TIC"
      3. "Turn HLD"
    - Answer: **0**
    - Explain: "BD HARD's sweep range is built in. SNP adds a separate snap at the start, which is easy to mistake for a deeper sweep."

11. **challenge**
    - Instruction: "Make a techno kick: short enough not to boom between beats at 130 BPM, with a clear click and some drive."
    - Checklist:
      - The machine is BD HARD or BD CLASSIC.
      - SRC DEC ≤ 70.
      - Click: TIC ≥ 60 on HARD, or TRA set on CLASSIC.
      - AMP OVR ≥ 15.
    - Hints:
      1. "Think about the tail between beats."
      2. "SRC DEC is the tail, TIC is the click, OVR is on the AMP page."
      3. "Try DEC ≈ 55, TIC ≈ 85, OVR ≈ 30."
    - Solution: BD HARD TUN −2 · SWT 52 · SNP 28 · DEC 58 · HLD 26 · TIC 88; AMP OVR 32.

12. **reflect**
    - Prompt: "In one sentence: what makes a kick punchy?"
    - Model: "A fast downward pitch sweep and a short click at the start, with a decay short enough to leave space."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "SWT sets…" | how fast the pitch falls · how long it rings · the click level | 0 | "Sweep time." |
| 2 | "BD HARD's sweep depth is…" | fixed · encoder C · TIC | 0 | "C is SNP; the depth is built in." |
| 3 | "For an 808-style boom, raise…" | SRC DEC · TIC · AMP ATK | 0 | "A long decay booms." |
| 4 | "Open the MACHINE menu with…" | [SRC] twice · [TRK] twice · [AMP] + [YES] | 0 | "Or [FUNC] + [SRC]." |

---

## 4. analog-rytm-s2-snare-clap: Snare and clap, tone plus noise

sound-design · 2 · beginner · ~9 min · prereq #3 · concepts `noise`, `mixing`, `envelope-decay` · tags snare, clap · refs p.100, p.102

**Objective:** Balance tone and noise on SD CLASSIC, and shape a clap's bursts and room tail on CP CLASSIC.

**Start:** Kit 01, with `t2_machine` = 'SD CLASSIC' at init; `track` 1; page SRC; PLAY off.

**Steps**

1. **do** `t2_src_nol` → 0 (first win)
   - Instruction: "Tap SD. Turn encoder G (NOL) down to 0 and tap again."
   - Principle: "A snare is two sources: pitched drum heads and buzzing snare wires."
   - Explanation: "Without noise, only the two tone oscillators remain, like a small tom."

2. **do** `t2_src_nol` → 90
   - Instruction: "Turn NOL back up to about 90."
   - Principle: "Noise spreads energy over every frequency, so it sounds like sizzle, not a note."

3. **predict** `t2_src_nod` → 95
   - Instruction: "Turn encoder F (NOD) up to about 95 and tap."
   - Q: "What will a longer noise decay do?"
   - Options:
     0. "The wires ring longer: a washier snare"
     1. "The drum's pitch drops"
     2. "The snap gets sharper"
     3. "It gets quieter"
   - Answer: **0**
   - Explain: "NOD lengthens only the noise; the tone keeps its own DEC (D). A sharper snap is SNP (E)."
   - Principle: "Separate envelopes let parts of one sound end at different times."

4. **do** `t2_src_snp` → 95
   - Instruction: "Turn encoder E (SNP) to about 95."
   - Principle: "A sharp transient makes a sound seem closer and louder at the same level."

5. **info**
   - Instruction: "Now the clap. CP CLASSIC fires a few quick noise bursts, then a longer noise tail: hands, then room."
   - Explanation: "RAT (A) sets burst speed, NUM (B) how many, RND (C) loosens timing, CPD (D) each burst's length, TON (E) noise pitch, NOD/NOL (F/G) the tail."

6. **do** `track` → 3, then `t4_src_nod` → 100
   - Instruction: "Hold [TRK] and tap CP. Turn encoder F (NOD) up to about 100, then tap CP."
   - Principle: "A longer noise tail sounds like a bigger room around the clap."

7. **listen**
   - A: CP RND 0, RAT 85. B: CP RND 90, RAT 60. Labels: ["Tight", "Loose"].
   - Question: "Which sounds more like real hands?" Options: "Loose" · "Tight". Answer **0**.
   - Explain: "Real hands never hit at exactly the same moment, so uneven timing reads as human."

8. **quiz**
   - Q: "Which part of the clap sounds like the room?"
   - Options: "The noise tail (NOD/NOL)" · "The number of bursts (NUM)" · "The filter type"
   - Answer: **0**
   - Explain: "The bursts are the hands and the tail is the reflections. NUM changes how many hands, not the room."

9. **challenge**
   - Instruction: "Layer a house backbeat: a short, snappy snare under a wide clap, both on beats 2 and 4."
   - Checklist:
     - SD and CP each trig on steps 5 and 13.
     - `t2_src_nod ≤ 60`.
     - `t4_src_nod ≥ 50`.
   - Hints:
     1. "Both need hits on the same steps."
     2. "Steps 5 and 13."
     3. "Snare NOD about 40, clap NOD about 60."
   - Solution: the Kit 04 SD and CP values and pattern.

10. **reflect**
    - Prompt: "Why can SD and CP play together, but RS and CP can't?"
    - Model: "SD and CP use different voices; RS and CP share one, so CP takes priority."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "NOL at 0 on SD CLASSIC leaves…" | only the drum-head tones · only noise · silence | 0 | "Noise is the wires." |
| 2 | "NOD sets…" | how long the noise rings · the noise pitch · the number of claps | 0 | "Noise decay." |
| 3 | "A clap's tail represents…" | the room · the hands · the stick | 0 | "Reflections." |
| 4 | "Which two can layer on one step?" | SD and CP · RS and CP · CH and OH | 0 | "Only separate voices layer." |

---

## 5. analog-rytm-s3-hats-cymbals-choke: Hats and cymbals, with the choke on purpose

sound-design · 3 · beginner · ~9 min · prereq #1, #2 · concepts `noise`, `envelope-decay`, `filter-type` · tags hi-hat, cymbal, choke · refs p.21, p.79, p.106–108

**Objective:** Shape closed and open hats with DEC, COL and a high-pass filter, and use the CH/OH choke as a groove tool.

**Start:** Kit 01; OH trigs on 3, 7, 11 and 15; PLAY on, 124 BPM; `track` 9 (OH); page SRC.

**Steps**

1. **do** `t10_src_dec` → 60 (first win)
   - Instruction: "Turn encoder D (DEC) on OH to about 60 and listen."
   - Principle: "Closed and open hats are the same metal; the decay length makes the difference."

2. **do** `track` → 8, then `t9_src_col` → −30
   - Instruction: "Hold [TRK] and tap CH. Turn encoder G (COL) to about −30."
   - Principle: "Metal partials at unrelated frequencies are why cymbals have no clear pitch."
   - Explanation: "COL changes the virtual hardness of the metal. Judge the direction by ear."

3. **do** `t9_fltr_typ` → HP2 (4)
   - Instruction: "Press [FLTR]. Set encoder G (TYP) to HP2."
   - Principle: "A high-pass removes lows the hats don't need, leaving room for the kick."

4. **do** `t9_fltr_frq` → 70
   - Instruction: "Set encoder E (FRQ) to about 70."
   - Principle: "The cutoff sets where a high-pass starts removing the lows."

5. **predict** (check: CH trigs on steps 4, 8, 12 and 16)
   - Instruction: "Press [RECORD]. With CH selected, tap trig keys 4, 8, 12 and 16."
   - Q: "OH plays on 3, 7, 11 and 15. What will each CH on the next step do?"
   - Options:
     0. "Cut each open hat after one 16th: a tight 'tss-t'"
     1. "Layer with it, so both ring"
     2. "Make the OH louder"
     3. "Nothing: different pads never interact"
   - Answer: **0**
   - Explain: "CH and OH share voice 7, so each CH replaces the ringing OH. Separate pads don't mean separate voices."
   - Principle: "Two tracks on one voice take turns; the newest hit wins."

6. **listen**
   - A: with the CH trigs. B: without them. Labels: ["With CH", "Without CH"].

7. **quiz**
   - Q: "CH and OH trig on the *same* step. Which one plays?"
   - Options:
     0. "OH: the right-hand track has priority"
     1. "CH: the closed hat always wins"
     2. "Both"
   - Answer: **0**
   - Explain: "On a shared voice the right-hand track of the pair wins. CH cuts OH only when it comes *later*."

8. **do** `track` → 10, then `t11_src_dec` → 100
   - Instruction: "Hold [TRK] and tap CY. Turn encoder D (DEC) to about 100."
   - Principle: "Cymbals have many inharmonic partials that fade slowly into a wash."

9. **match** (OH, 2 controls, wide)
   - Target: `t10_src_dec` 90 and `t10_fltr_frq` 40, with TYP HP2 set from the target. Start: DEC 30, FRQ 90.
   - Instruction: "Recreate the open hat by ear."
   - Hints:
     1. "Listen to length first, then to body."
     2. "Longer, with more low-mid body."
     3. "DEC near 90, FRQ near 40."

10. **reflect**
    - Prompt: "Explain the choke in one sentence, and give one musical use."
    - Model: "CH and OH share one voice, so a later closed hat cuts a ringing open hat. That keeps open hats tight and rhythmic."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "Closed versus open hat is mostly…" | DEC · TUN · PAN | 0 | "Same metal, different length." |
| 2 | "HP2 on a hat…" | removes lows and keeps the sizzle · adds low end · lowers the pitch | 0 | "High-pass passes highs." |
| 3 | "Which tracks can load CY RIDE?" | CY or CB · CH · LT | 0 | "It lives on the CY/CB voice." |
| 4 | "Why does a later CH cut OH?" | they share one voice · CH is louder · a choke switch | 0 | "Voice 7 is shared." |

---

## 6. analog-rytm-s4-toms-envelopes: Toms and the filter and amp envelopes

sound-design · 4 · intermediate · ~10 min · prereq #3 · concepts `oscillator-pitch`, `envelope-decay`, `filter-cutoff`, `envelope-shape` · tags toms · refs p.78–79, p.105

**Objective:** Tune three toms against each other, then shape each hit's tone and length with the filter and amp envelopes.

**Start:** Kit 01 (XT CLASSIC toms at init); `track` 5 (LT); page SRC; PLAY off.

**Steps**

1. **do** `t6_src_tun` → +24 (first win)
   - Instruction: "Tap LT, MT and HT. Then set LT's encoder A (TUN) to about +24."
   - Principle: "A tighter drum skin vibrates faster, so higher tuning sounds smaller."
   - Explanation: "Tom TUN steps aren't marked as notes. Tune toms by ear, against each other."

2. **do** `track` → 6, then `t7_src_tun` → +36
   - Instruction: "Hold [TRK] and tap MT. Set its TUN to about +36."
   - Principle: "Even steps between drum pitches make a fill sound melodic."

3. **do** `track` → 7, then `t8_src_tun` → +48
   - Instruction: "Select HT the same way and set its TUN to about +48. Play LT, MT and HT."
   - Principle: "Similar intervals between toms make them sound like one tuned set."

4. **predict** `t8_src_swd` → 100
   - Instruction: "On HT, turn encoder C (SWD) to about 100 and tap."
   - Q: "What will a deeper sweep do to the high tom?"
   - Options:
     0. "Start much higher and swoop down: a 'laser' tom"
     1. "Ring longer"
     2. "Get noisier"
     3. "Drop an octave"
   - Answer: **0**
   - Explain: "SWD sets how far above TUN the pitch starts. The length is DEC (D) and the noise is NOL/NOD (G/F)."
   - Principle: "A pitch that starts high and falls fast is heard as an impact."

5. **info**
   - Instruction: "FLTR has an ADSR envelope with a depth (ENV, ±63). AMP has attack, hold and decay."
   - Principle: "An envelope is a shape over time that moves one setting on every hit."

6. **do** `track` → 5, then `t6_fltr_frq` → 40
   - Instruction: "Select LT again. Press [FLTR] and set encoder E (FRQ) to about 40."
   - Principle: "A low cutoff on its own keeps the tom dark from start to finish."

7. **do** `t6_fltr_env` → +40
   - Instruction: "Set encoder H (ENV) to about +40, and tap LT."
   - Principle: "Envelope depth opens the filter on each hit: a bright attack, then a darker tail."

8. **listen**
   - A: ENV 0. B: ENV +40. Labels: ["No envelope", "Envelope +40"].

9. **do** `t6_amp_dec` → 40
   - Instruction: "Press [AMP]. Set encoder C (DEC) to about 40."
   - Principle: "The amp envelope can shorten a sound, never lengthen what the source makes."

10. **quiz**
    - Q: "AMP DEC is at INF. What decides how long the tom rings?"
    - Options: "SRC DEC (the machine)" · "FLTR REL" · "LFO DEP" · "AMP HLD"
    - Answer: **0**
    - Explain: "At INF the amp shortens nothing, so the machine's decay sets the length. FLTR REL only shapes tone after the gate."

11. **challenge**
    - Instruction: "Make a three-tom fill in steps 13–16 that sounds tuned and punchy, not boomy."
    - Checklist:
      - LT, MT and HT each trig in steps 13–16.
      - `t6_src_tun < t7_src_tun < t8_src_tun`.
      - Each tom has `src_dec ≤ 75` or `amp_dec ≤ 90`.
    - Hints:
      1. "Order the toms high to low in time."
      2. "Shorten tails with SRC DEC or AMP DEC."
      3. "A quick sweep (SWT about 30) adds punch."
    - Solution: the Kit 06 toms (LT +24, MT +34, HT +44; SWD 70; DEC 52–60), with HT on 13, MT on 14 and LT on 15.

12. **reflect**
    - Prompt: "What's the difference between the filter envelope and the amp envelope?"
    - Model: "The filter envelope moves the tone through each hit; the amp envelope moves the loudness."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "Positive ENV with a low FRQ gives…" | a bright attack and a darker tail · a darker attack · a higher pitch | 0 | "The filter opens, then closes." |
| 2 | "SWD on a tom sets…" | how far the pitch starts above TUN · how long it rings · noise | 0 | "Sweep depth." |
| 3 | "AMP DEC = INF means…" | the machine's decay sets the length · silence · endless reverb | 0 | "The amp stops shortening." |
| 4 | "AMP HLD on AUTO holds…" | for as long as the pad is pressed · forever · for zero time | 0 | "AUTO follows the pad (manual p.79)." |

---

## 7. analog-rytm-s5-sends: Delay and reverb sends

sound-design · 5 · intermediate · ~9 min · prereq #2 · concepts `effects`, `signal-routing`, `timing-tempo` · refs p.36, p.79, p.81–82

**Objective:** Send chosen drums into the delay and reverb, and set tempo-synced delay times.

**Start:** Kit 01 test groove plus RS trigs on 7 and 15; 120 BPM; PLAY on; `track` 2 (RS).

**Steps**

1. **do** `t3_amp_del` → 80 (first win)
   - Instruction: "On RS press [AMP]. Turn encoder E (DEL) to about 80."
   - Principle: "A send copies part of a track into an effect, and the dry sound stays."

2. **do** `fx_delay_tim` → 24
   - Instruction: "Press [FX], then [SRC] for DELAY. Set encoder A (TIM) to 24."
   - Principle: "Delay times locked to the tempo turn echoes into rhythm."
   - Explanation: "TIM counts 128th notes, so 32 is one beat and 24 is a dotted eighth."

3. **predict** `fx_delay_fdb` → 130
   - Instruction: "Turn encoder D (FDB) up to about 130."
   - Q: "What will very high feedback do?"
   - Options:
     0. "The echoes keep coming and can swell louder"
     1. "The delay gets shorter"
     2. "The echoes stop"
     3. "It adds reverb"
   - Answer: **0**
   - Explain: "With high feedback each repeat returns about as loud as the last, or louder, so the echoes build into a dub-style swell. It doesn't change the time, which is TIM's job."
   - Principle: "Feeding an effect's output back into its input repeats it again and again."

4. **do** `fx_delay_fdb` → 70
   - Instruction: "Bring FDB back to about 70."
   - Principle: "Moderate feedback gives a few repeats that fade away."

5. **listen**
   - A: `fx_delay_x` OFF. B: X ON. Labels: ["Mono repeats", "Ping-pong"].

6. **do** `track` → 3, then `t4_amp_rev` → 60
   - Instruction: "Hold [TRK] and tap CP. On its AMP page set encoder F (REV) to about 60."
   - Principle: "More send puts more of that one track into the shared effect."

7. **do** `fx_reverb_dec` → 90
   - Instruction: "Press [FX], then [SMPL] for REVERB. Set encoder B (DEC) to about 90."
   - Principle: "A longer reverb decay sounds like a bigger space."

8. **quiz**
   - Q: "Why use sends instead of one reverb on the whole mix?"
   - Options:
     0. "Each drum gets its own amount, so the kick can stay dry and tight"
     1. "Sends are louder"
     2. "Only sends sync to tempo"
   - Answer: **0**
   - Explain: "Sends set an amount per track. Tempo sync is a delay feature, not a send feature."

9. **challenge**
   - Instruction: "Make a dub rim: dotted-eighth echoes bouncing left and right, while the kick stays dry."
   - Checklist:
     - `t3_amp_del ≥ 60`.
     - `t1_amp_del === 0` and `t1_amp_rev ≤ 10`.
     - `fx_delay_tim` within 23–25.
     - `fx_delay_x` ON.
   - Hints:
     1. "Two settings are on RS, two on the DELAY page."
     2. "TIM 24 is the dotted eighth."
     3. "X turns ping-pong on."
   - Solution: the Kit 12 RS and DELAY values.

10. **reflect**
    - Prompt: "What's the difference between AMP DEL on a track and VOL on the DELAY page?"
    - Model: "AMP DEL sets how much of that track enters the delay; DELAY VOL sets how loud the delay returns, for every track."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "TIM 32 is…" | one beat · a 16th · a bar | 0 | "32 of 128 per bar." |
| 2 | "TIM 24 is…" | a dotted eighth · an eighth · a triplet | 0 | "3/16 of a bar." |
| 3 | "X ON makes the repeats…" | alternate left and right · longer · darker | 0 | "Ping-pong." |
| 4 | "On the FX track, TRACK LEVEL sets…" | the delay and reverb return level · the kick volume · the tempo | 0 | "A master level for both send returns (manual p.36)." |

---

## 8. analog-rytm-s6-dist-comp: The master bus, distortion and compressor

sound-design · 6 · intermediate · ~10 min · prereq #7 · concepts `effects`, `gain-staging` · refs p.82–83

**Objective:** Glue the kit with the compressor and add grit with the distortion, without losing the kick's punch.

**Start:** Kit 02, but `fx_dist_amt` 0 and `fx_comp_mix` 0; PLAY on; 130 BPM.

**Steps**

1. **listen** (hook)
   - A: Kit 02 with a dry bus. B: Kit 02 as designed. Labels: ["Dry", "Glued"].

2. **do** `fx_comp_mix` → 127 (first win)
   - Instruction: "Press [FX], then [AMP] for COMP. Turn encoder G (MIX) to 127."
   - Principle: "A compressor turns loud moments down, so the mix sounds denser."
   - Explanation: "At the far left MIX passes only the dry signal, so nothing is compressed."

3. **do** `fx_comp_thr` → 60
   - Instruction: "Turn encoder A (THR) down to about 60."
   - Principle: "A lower threshold means more of the signal gets compressed."

4. **predict** `fx_comp_rat` → MAX (3)
   - Instruction: "Set encoder E (RAT) to MAX."
   - Q: "With a low threshold and MAX ratio, what happens to the drums?"
   - Options:
     0. "They're squashed: very even and loud, with less punch"
     1. "They only get quieter"
     2. "Nothing"
     3. "The tempo changes"
   - Answer: **0**
   - Explain: "MAX barely lets peaks rise above the threshold, like a limiter, so the dynamics flatten. It isn't just quieter: MUP or VOL brings the level back."
   - Principle: "A higher ratio squeezes everything above the threshold harder."

5. **do** `fx_comp_rat` → 1:4 (1)
   - Instruction: "Set RAT to 1:4."
   - Principle: "A moderate ratio controls peaks but keeps some punch."

6. **listen** (setup: THR 40, RAT 1:8)
   - A: ATK 0.03 ms (0). B: ATK 30 ms (6). Labels: ["Fast attack", "Slow attack"].
   - Question: "Which keeps more kick click?" Options: "Slow attack" · "Fast attack". Answer **0**.
   - Explain: "A slow attack lets the first milliseconds through before the gain drops."

7. **do** `fx_comp_seq` → LPF (1)
   - Instruction: "Set encoder F (SEQ) to LPF."
   - Principle: "Filtering what the compressor listens to decides which drum makes it pump."

8. **quiz**
   - Q: "With SEQ on LPF, which drum mostly drives the compression?"
   - Options: "The kick (lows)" · "The hats (highs)" · "None: SEQ is an output EQ"
   - Answer: **0**
   - Explain: "SEQ filters the detector, not the sound. LPF leaves the bass, so the kick triggers the pumping. HPF would do the opposite."

9. **do** `fx_dist_amt` → 30
   - Instruction: "Press [FLTR] for DIST. Turn encoder A (AMT) to about 30."
   - Principle: "Distortion adds harmonics, so sounds feel louder and grittier at the same level."
   - Explanation: "By default the delay returns before the distortion and compressor (DEL = PRE), and the reverb returns after them (REV = POST)."

10. **challenge**
    - Instruction: "Make the bus pump with the kick while the hats and clap still breathe."
    - Checklist:
      - `fx_comp_mix ≥ 90`.
      - `fx_comp_thr ≤ 80`.
      - `fx_comp_seq === 1` (LPF).
      - `fx_comp_atk ≥ 3` (1 ms or slower).
      - `fx_dist_amt` within 10–50.
    - Hints:
      1. "The compressor must hear the kick most."
      2. "Use SEQ, a middle threshold and a not-too-fast attack."
      3. "THR ~72, ATK 3 ms, REL 0.2 s, RAT 1:4, MIX ~100."
    - Solution: the Kit 02 FX values.

11. **reflect**
    - Prompt: "In one sentence: what does the compressor's attack do to a drum mix?"
    - Model: "It sets how quickly the compressor clamps down. Slow attacks keep transients punchy; fast ones flatten them."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "COMP MIX fully left means…" | only the dry signal · full compression · silence | 0 | "Dry/wet mix." |
| 2 | "SEQ = HPF makes the compressor…" | react less to the bass, avoiding pumping · pump harder · louder | 0 | "It filters the detector." |
| 3 | "A slower ATK…" | lets transients through · removes the click · raises the threshold | 0 | "It reacts later." |
| 4 | "DIST SYM away from 0…" | offsets the wave so one side clips first · pans · retunes | 0 | "Asymmetric distortion." |
| 5 | "By default the delay returns…" | before DIST/COMP · after DIST/COMP · not at all | 0 | "DEL is PRE by default; REV is POST." |

---

## 9. analog-rytm-e1-decay: How long is that hit?

ear-training · 1 · beginner · ~6 min · prereq #3 · concepts `envelope-decay` · refs p.97, p.107

**Objective:** Hear and match decay lengths on a kick and an open hat, to within 8 % of knob travel.

**Start:** Kit 01; `track` 0 (BD HARD); AMP DEC INF; page SRC; PLAY off. Match steps audition the hit every half bar.

**Steps**

1. **do** `t1_src_dec` → 20 (first win)
   - Instruction: "Set encoder D (DEC) to about 20 and tap BD."
   - Principle: "Decay is how long a sound keeps ringing after the hit."

2. **listen**
   - A: DEC 20. B: DEC 100. Labels: ["Short", "Long"].
   - Instruction: "Hear the two extremes. Listen to the tail, not the click."

3. **match** (1 control, wide: 63 %)
   - Target `t1_src_dec` 100; start 20.
   - Hints: 1. "Longer or shorter than yours?" 2. "Much longer: think 808 boom." 3. "Near 100."

4. **match** (1 control, wide, the other direction)
   - Target 30; start 110.
   - Hints: 1. "Longer or shorter?" 2. "Much shorter: a tight thump." 3. "About 30."

5. **quiz**
   - Q: "A closed hat and an open hat differ mainly in…"
   - Options: decay · pitch · pan
   - Answer: **0**
   - Explain: "Same metal, different ring time. Pitch differences are small, and pan doesn't change the sound."

6. **match** (OH, 1 control, medium: 16 %)
   - Target `t10_src_dec` 70; start 50; FLTR HP2 FRQ 64 from the target.
   - Hints: 1. "Count how long the hiss lasts." 2. "It rings a bit longer." 3. "About 70."

7. **match** (BD, 1 control, fine: 8 %)
   - Target `t1_src_dec` 64; start 54; tolerance 0.06.
   - Hints: 1. "Very close: compare the end of the tail." 2. "Slightly longer." 3. "About 64."

8. **reflect**
   - Prompt: "What did you listen for to judge decay?"
   - Model: "How long the sound keeps ringing before it fades, especially in the gap between hits."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "A longer SRC DEC on a kick…" | lengthens the boom · raises the pitch · adds click | 0 | "Ring time." |
| 2 | "To judge decay, listen to…" | the tail · the first click · the pan | 0 | "The tail carries the length." |
| 3 | "Closed versus open hat is mostly…" | decay · tuning · filter type | 0 | "Ring time." |

---

## 10. analog-rytm-e2-pitch-sweep: Sweep depth and sweep time

ear-training · 2 · intermediate · ~8 min · prereq #9 · concepts `modulation-depth`, `oscillator-pitch` · refs p.97

**Objective:** Tell sweep depth from sweep time by ear, and match both on BD CLASSIC.

**Start:** Kit 01; `t1_machine` BD CLASSIC (TUN −6, SWT 64, SWD 42, DEC 60, WAV ASIN, HLD 32); PLAY off.

**Steps**

1. **do** `t1_src_swd` → 0 (first win)
   - Instruction: "Tap BD. Turn encoder C (SWD) to 0 and tap again."
   - Principle: "Without a pitch sweep a kick is just a fading tone."

2. **listen**
   - A: SWD 10. B: SWD 110 (SWT 64). Labels: ["Shallow", "Deep"].

3. **match** (1 control, wide)
   - Target SWD 100; start 20.
   - Hints: 1. "Does the target start higher?" 2. "Much higher: a big 'boing'." 3. "Near 100."

4. **predict** `t1_src_swt` → 10 (setup: SWD 100)
   - Instruction: "Keep SWD at 100. Turn encoder B (SWT) from 64 down to 10 and tap."
   - Q: "What changes when SWT gets shorter?"
   - Options:
     0. "The drop is faster: a tight thump instead of a 'pew'"
     1. "The drop starts higher"
     2. "The kick rings longer"
     3. "Nothing"
   - Answer: **0**
   - Explain: "SWT is the time the drop takes. The start height is SWD, which you didn't touch. Slow and deep is the electro 'laser'; fast reads as punch."
   - Principle: "How fast a pitch falls changes punch into a zap."

5. **listen**
   - A: SWT 10. B: SWT 100 (SWD 100). Labels: ["Fast drop", "Slow drop"].

6. **quiz**
   - Q: "A kick sounds like a laser 'pew'. Which settings are most likely?"
   - Options: "Deep SWD, long SWT" · "Shallow SWD, short SWT" · "High TRA" · "Long DEC only"
   - Answer: **0**
   - Explain: "A 'pew' is a big, slow pitch fall. A long DEC alone makes a boom, not a pew."

7. **match** (2 controls, wide)
   - Target SWD 90, SWT 20; start SWD 30, SWT 90.
   - Hints: 1. "Two things moved: how far and how fast." 2. "It starts high and drops quickly." 3. "SWD ~90, SWT ~20."

8. **match** (2 controls, finer: 16 % and 12 %)
   - Target SWD 60, SWT 45; start SWD 40, SWT 60.
   - Hints: 1. "Fix the start height first." 2. "A bit deeper and a bit faster." 3. "SWD ~60, SWT ~45."

9. **reflect**
   - Prompt: "How do sweep depth and sweep time sound different?"
   - Model: "Depth is how high the hit starts, which gives more 'boing'. Time is how fast it falls: fast is punch, slow is a laser."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "SWD sets…" | how high the pitch starts · how fast it falls · decay | 0 | "Depth." |
| 2 | "SWT sets…" | how fast the pitch falls · the start height · the click | 0 | "Time." |
| 3 | "A punchy techno sweep is…" | fast SWT with moderate SWD · slow and deep · no sweep | 0 | "Fast drops punch." |

---

## 11. analog-rytm-e3-filter-type: Which filter type?

ear-training · 3 · intermediate · ~8 min · prereq #2 · concepts `filter-type`, `filter-cutoff` · refs p.79

**Objective:** Identify LP2, BP, HP2 and BS by ear on a clap, and match type plus cutoff.

**Start:** Kit 01; CP CLASSIC; `t4_fltr_frq` 64, `t4_fltr_res` 50; CP trigs on 1, 5, 9 and 13; 110 BPM; PLAY on; `track` 3; page FLTR.

**Steps**

1. **do** `t4_fltr_typ` → LP2 (0) (first win)
   - Instruction: "On CP's FLTR page, set encoder G (TYP) to LP2 and listen."
   - Principle: "A filter keeps some frequencies and removes others; the type decides which."

2. **listen**
   - A: LP2. B: HP2. Labels: ["Low-pass", "High-pass"].

3. **predict** `t4_fltr_typ` → BP (2)
   - Instruction: "Set TYP to BP."
   - Q: "What will band-pass at FRQ 64 sound like?"
   - Options:
     0. "Thin and nasal: only a band around the cutoff remains"
     1. "Fuller than before"
     2. "Exactly like low-pass"
     3. "Silent"
   - Answer: **0**
   - Explain: "Band-pass cuts both lows and highs, leaving a telephone-like band. It isn't silent: the clap has energy at the centre."
   - Principle: "A band-pass filter keeps only frequencies near its centre."

4. **match** (switch only)
   - Target `t4_fltr_typ` HP2; start LP2.
   - Hints: 1. "Is the low end there?" 2. "The lows are gone." 3. "HP2."

5. **match** (switch only)
   - Target BP; start HP2.
   - Hints: 1. "Are the very highs still there?" 2. "Both ends are cut." 3. "BP."

6. **quiz**
   - Q: "PK boosts a band. What does BS (band-stop) do?"
   - Options:
     0. "Cuts a notch, keeping lows and highs"
     1. "Boosts the lows"
     2. "Removes everything above FRQ"
   - Answer: **0**
   - Explain: "Band-stop is the opposite of band-pass, and RES sets how wide the notch is. Removing everything above FRQ is low-pass."

7. **match** (2 controls)
   - Target LP2, FRQ 40; start HP2, FRQ 100.
   - Hints: 1. "First the type: lows or highs?" 2. "Lows kept, quite dark." 3. "LP2, FRQ ~40."

8. **match** (2 controls, interleaved)
   - Target HP2, FRQ 90; start LP2, FRQ 60.
   - Hints: 1. "Thin or full?" 2. "Thin, with only the top left." 3. "HP2, FRQ ~90."

9. **reflect**
   - Prompt: "How do you tell high-pass from band-pass by ear?"
   - Model: "High-pass keeps all the highs and sounds bright and airy. Band-pass also trims the top, so it sounds nasal."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "Lows gone, highs intact:" | HP · LP · BP | 0 | "High-pass." |
| 2 | "Thin, telephone-like:" | BP · LP2 · PK | 0 | "Band-pass." |
| 3 | "LP2 versus LP1:" | LP1 has a gentler slope · LP1 is steeper · they're the same | 0 | "LP1 rolls off more gently, which suits EQ-like moves." |

---

## 12. analog-rytm-e4-compression: Compression, and comp versus decay

ear-training · 4 · advanced · ~10 min · prereq #8, #9, #11 · concepts `effects`, `envelope-decay`, `gain-staging` · refs p.83

**Objective:** Hear the compression amount and attack, and tell compression apart from a shorter kick decay (interleaving).

**Start:** Kit 02 groove; COMP at init (MIX 0); PLAY on; `track` 12 (FX); page COMP.

**Steps**

1. **do** `fx_comp_mix` → 127 (first win)
   - Instruction: "Set COMP encoder G (MIX) to 127."
   - Principle: "You only hear a compressor when its output is in the mix."

2. **listen** (setup: RAT 1:8, MUP 30)
   - A: THR 120. B: THR 40. Labels: ["Light", "Heavy"].
   - Instruction: "Listen between the hits: do the tails rise?"

3. **match** (1 control, wide)
   - Target `fx_comp_thr` 40; start 110. RAT 1:8, MUP 30 and MIX 127 come from the target.
   - Hints: 1. "Is the target pumping more?" 2. "Yes: the quiet bits are louder and the hits flatter." 3. "THR is low, about 40."

4. **listen** (setup: THR 40)
   - A: ATK 30 ms (6). B: ATK 0.03 ms (0). Labels: ["Slow attack", "Fast attack"].
   - Question: "Which has more kick click?" Options: "Slow attack" · "Fast attack". Answer **0**.
   - Explain: "The slow attack lets the click through before the compressor reacts."

5. **match** (2 controls)
   - Target THR 50, ATK 30 ms (6); start THR 100, ATK 0.03 ms (0).
   - Hints: 1. "Two things: how much, and how fast." 2. "Heavy, but the click survives." 3. "THR ~50, ATK 30 ms."

6. **predict** `fx_comp_rel` → 0.1 s (0) (setup: THR 40, ATK 3 ms)
   - Instruction: "Set encoder C (REL) to 0.1 s."
   - Q: "A very short release on heavy compression makes the kit…"
   - Options:
     0. "Pump quickly: tails jump back up between hits"
     1. "Sound like only the kick got shorter"
     2. "Just get quieter"
   - Answer: **0**
   - Explain: "Release is how fast the level recovers. A short release lets it bounce back between hits, which is the audible pump, and that moves every sound, not just the kick."
   - Principle: "A short release lets the level spring back quickly after each hit."

7. **quiz**
   - Q: "The kick's tail sounds shorter. How do you tell a shorter SRC DEC from compression?"
   - Options:
     0. "Compression moves every sound and pumps; DEC changes only the kick"
     1. "They sound identical"
     2. "DEC changes the hats too"
   - Answer: **0**
   - Explain: "DEC belongs to one track. The bus compressor moves the whole mix at once."

8. **match** (3 controls, interleaved)
   - Target `t1_src_dec` 40, `fx_comp_thr` 50, `fx_comp_mix` 127; start DEC 80, THR 110, MIX 60.
   - Hints:
     1. "Two stages moved: the kick itself and the bus."
     2. "The kick is shorter on its own, and everything pumps."
     3. "DEC ~40, THR ~50, MIX full."

9. **reflect**
   - Prompt: "What clues tell you the compressor is working?"
   - Model: "Tails and quiet parts rise between hits, the mix pumps with the kick, and transients flatten when the attack is fast."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "Heavy compression with a fast attack…" | flattens transients · adds click · retunes | 0 | "It clamps at once." |
| 2 | "Pumping in time with the kick suggests…" | compression keyed by the lows · a longer decay · reverb | 0 | "SEQ LPF or bass-led detection." |
| 3 | "Only the kick got shorter, nothing else changed:" | its DEC · the compressor · the reverb | 0 | "A per-track change." |

---

## 13. analog-rytm-q1-rhythm-basics: Four on the floor, backbeat and syncopation

sequencing · 1 · beginner · ~8 min · prereq #1 · concepts `sequencer-pattern`, `timing-tempo` · refs p.20, p.37, p.39

**Objective:** Program a four-on-the-floor kick, a backbeat and one syncopated part in grid recording.

**Start:** Kit 01; empty pattern A01, 16 steps; 124 BPM; PLAY off; `track` 0.

This lesson recreates the manual's quick-start beat (p.20) in its first steps, then builds on it.

**Steps**

1. **do** (first win; check: `rec` on, `trigSteps(p,a,0).join() === '0,4,8,12'`, and playing)
   - Instruction: "Press [RECORD]. With BD selected, tap trig keys 1, 5, 9 and 13, then press [PLAY]."
   - Principle: "A kick on every beat is the pulse that dance music is built on."

2. **do** (check: `trigSteps(p,a,3).join() === '4,12'`)
   - Instruction: "Hold [TRK] and tap CP. Tap trig keys 5 and 13."
   - Principle: "Hits on beats 2 and 4 form the backbeat."

3. **predict** (check: OH trigs on 2, 6, 10 and 14, 0-based)
   - Instruction: "Select OH and tap trig keys 3, 7, 11 and 15."
   - Q: "These land between the kicks. How will they feel?"
   - Options:
     0. "Lifting: offbeat hats push the groove"
     1. "Slower: the tempo seems to halve"
     2. "Messy: they clash with the kick"
     3. "The same as hats on the beat"
   - Answer: **0**
   - Explain: "Offbeats fill the gaps between pulses, so the groove bounces, like a house hat. They don't change the tempo, and they land between the kicks."
   - Principle: "Hits between the beats create motion against a steady pulse."

4. **quiz**
   - Q: "Syncopation means…"
   - Options: "Accenting positions between the beats" · "Playing faster" · "Playing every 16th"
   - Answer: **0**
   - Explain: "It's about where the accents fall, not speed or density."

5. **do** (check: RS trigs on 3, 10 and 15, 0-based)
   - Instruction: "Select RS and tap trig keys 4, 11 and 16."
   - Principle: "Off-beat accents create tension against the steady kick."

6. **listen**
   - A: with the RS trigs. B: without them. Labels: ["Syncopated", "Square"].

7. **challenge**
   - Instruction: "Make an electro beat: the kick off at least one beat, with snare or clap on 2 and 4."
   - Checklist:
     - BD has ≥ 3 trigs.
     - At least one BD trig is off 1, 5, 9 and 13.
     - SD or CP trigs on steps 5 and 13.
   - Hints:
     1. "Keep the kick on step 1."
     2. "Move one kick between the beats."
     3. "Try steps 1, 7 and 10."
   - Solution: the Kit 06 BD/SD/CP rows.

8. **reflect**
   - Prompt: "What's the difference between four on the floor and a syncopated kick?"
   - Model: "Four on the floor marks every beat evenly; a syncopated kick lands between beats and creates tension against the pulse."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "Four on the floor puts the kick on steps…" | 1, 5, 9, 13 · 1, 3, 5, 7 · every step | 0 | "One per beat." |
| 2 | "To place trigs with the trig keys you first…" | press [RECORD] for grid recording · press [PLAY] · hold [FUNC] | 0 | "Grid recording mode edits trigs (manual p.39)." |
| 3 | "Offbeat 8th hats sit on steps…" | 3, 7, 11, 15 · 1, 5, 9, 13 · 2, 4, 6, 8 | 0 | "The 'and' of each beat." |
| 4 | "Syncopation…" | puts accents between the beats · is a faster tempo · is a filter effect | 0 | "Off-beat emphasis." |

---

## 14. analog-rytm-q2-groove: Ghost notes, accents, swing and micro timing

sequencing · 2 · intermediate · ~10 min · prereq #13 · concepts `velocity-dynamics`, `timing-tempo` · refs p.39, p.43, p.49–50

**Objective:** Turn a stiff beat into a groove with velocity (accents and ghosts), swing and micro timing.

**Start:** Kit 07 sounds and trigs, but with every VEL 100, swing 50 and no micro timing; 90 BPM; PLAY on; [RECORD] on.

**Steps**

1. **listen** (hook)
   - A: stiff. B: Kit 07 as designed. Labels: ["Stiff", "Grooved"].

2. **do** (first win; check: `getStep(p,a,1,7)?.vel <= 55`)
   - Instruction: "Hold SD's trig 8 and turn TRIG encoder B (VEL) down to about 45."
   - Principle: "Quiet extra hits, ghost notes, fill gaps without competing with the beat."

3. **do** (check: SD steps 15 and 23 have `vel ≤ 55`)
   - Instruction: "Do the same for SD trig 16, then on page 2 ([PAGE]) for trig key 8 (step 24)."
   - Principle: "Repeating a detail in each bar turns it into part of the groove."

4. **predict** (check: `p.patterns[a].swing === 62`)
   - Instruction: "Press [FUNC] + [BANK G] for SWING and turn TRACK LEVEL to 62 %."
   - Q: "Swing delays every second 16th. Which hits move?"
   - Options:
     0. "The even steps: the ghosts on 8 and 16, and the hats between"
     1. "Every hit equally"
     2. "Only the kick"
     3. "Only steps 1, 5, 9 and 13"
   - Answer: **0**
   - Explain: "Swing pushes steps 2, 4, 6… late. The main hits on 1, 5, 9 and 13 stay put, which is why swing grooves without losing the pulse."
   - Principle: "Delaying every other 16th turns straight time into a shuffle."

5. **do** (check: SD steps 4 and 12 have `micro === 3`)
   - Instruction: "Hold SD trig 5 and press [RIGHT] three times. Repeat on trig 13."
   - Principle: "Hits just behind the grid feel relaxed; hits just ahead feel urgent."
   - Explanation: "Each step of micro timing is 1/384 of a bar, so three steps is a small push late."

6. **listen**
   - A: micro 0. B: micro +3 on the backbeat. Labels: ["On grid", "Laid back"].

7. **quiz**
   - Q: "An accent is…"
   - Options: "A hit clearly louder than its neighbours" · "A hit moved late" · "A hit with reverb"
   - Answer: **0**
   - Explain: "Accents are about level. The Rytm also has accent trigs ([FUNC] + [BANK F]), whose strength you set with TRACK LEVEL."

8. **challenge**
   - Instruction: "Groove the hats: loud on the beats, softer between them, with swing from 55 to 65 %."
   - Checklist:
     - Swing is 55–65.
     - CH has ≥ 8 trigs.
     - The loudest and softest CH velocities differ by ≥ 40.
     - At least one SD trig has `vel ≤ 55`.
   - Hints:
     1. "Hats on every 16th, then shape their levels."
     2. "Loud on 1, 5, 9 and 13, ghosts between."
     3. "Use 100 / 45 / 75 / 45 per beat."
   - Solution: the Kit 07 CH row and swing 62.

9. **reflect**
   - Prompt: "Which two kinds of small deviation make a beat feel human?"
   - Model: "Changes in loudness (accents and ghost notes) and in timing (swing and micro timing)."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "Swing 50 % means…" | straight timing · maximum swing · half tempo | 0 | "No delay." |
| 2 | "Ghost notes are…" | very quiet hits · muted hits · echoes | 0 | "Low velocity." |
| 3 | "Holding a trig and pressing [RIGHT]…" | nudges it later (micro timing) · copies it · deletes it | 0 | "Micro timing (manual p.39)." |
| 4 | "Rytm swing ranges…" | 50 (straight) to 80 % · 0 to 100 % · 25 to 75 % | 0 | "51–80 %, with 50 % straight (manual p.50)." |

---

## 15. analog-rytm-q3-parameter-locks: A different sound on every step

sequencing · 3 · intermediate · ~9 min · prereq #13, #3 · concepts `parameter-locks`, `oscillator-pitch` · refs p.39, p.43, p.47

**Objective:** Lock sound parameters on single steps, and add a lock trig, to turn the kick into a bass line.

**Start:**
- Kit 16 BD (BD CLASSIC, used as an 808 bass) with no NOT locks.
- BD trigs on 1, 11, 17, 23 and 30; length 32; 140 BPM; PLAY off; [RECORD] on.

**Steps**

1. **do** (first win; check: `getStep(p,a,0,16)?.note === 63`)
   - Instruction: "Press [PAGE] for page 2. Hold trig key 1 (step 17) and turn TRIG encoder A (NOT) to +3. Press [PLAY]."
   - Principle: "A parameter lock stores a different value on one step only."

2. **do** (check: `lockedSteps(p,a,0,'src_dec')` includes 22)
   - Instruction: "Still on page 2, hold trig key 7 (step 23) and turn SRC encoder D (DEC) to about 110."
   - Principle: "Any sound parameter can change from one step to the next."

3. **predict** (check: playing)
   - Instruction: "Keep playing and listen to the hit after step 23."
   - Q: "What happens on the next trig after step 23?"
   - Options:
     0. "It goes back to the kit's normal DEC"
     1. "It keeps the long DEC"
     2. "It goes silent"
   - Answer: **0**
   - Explain: "A lock belongs to its own trig. The next unlocked trig uses the kit value again."
   - Principle: "Locks apply only to the trig that holds them."

4. **do** (lock trig; check: step 26 is trigless with an `fltr_frq` lock)
   - Instruction: "Press [FUNC] + trig key 11 (step 27) for a lock trig. Hold it and turn FLTR encoder E (FRQ) to 60."
   - Principle: "A lock trig changes settings without playing a new note."
   - Explanation: "The bass that is still ringing darkens halfway through its tail."

5. **listen**
   - A: no locks. B: with the locks. Labels: ["Plain", "Locked"].

6. **quiz**
   - Q: "How many different parameters can one Rytm pattern lock?"
   - Options: 72 · 8 · unlimited
   - Answer: **0**
   - Explain: "Up to 72 per pattern. A parameter locked on many steps still counts once."

7. **challenge**
   - Instruction: "Make the kick a 2-bar bass line: at least four different notes, and one long note."
   - Checklist:
     - The pattern length is 32.
     - BD trigs use ≥ 4 distinct NOT values.
     - At least one BD trig locks `src_dec ≥ 100`.
   - Hints:
     1. "Hold a trig and turn NOT."
     2. "Use small steps: 0, +3, −2, +5."
     3. "Lock DEC high on one note so it rings."
   - Solution: the Kit 16 BD notes (0, 0, +3, −2, 0), plus DEC 120 locked on step 23.

8. **reflect**
   - Prompt: "In one sentence: what is a parameter lock?"
   - Model: "A value stored on one step that overrides the track's setting for that trig only."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "A lock applies to…" | its own trig only · the whole track · every track | 0 | "Per trig." |
| 2 | "A lock trig…" | changes settings without a new note · plays twice · mutes the track | 0 | "Trigless." |
| 3 | "To remove one lock, hold the trig and…" | press that parameter's encoder · press [PLAY] · turn TRACK LEVEL | 0 | "Hold the trig and press the knob (manual p.47)." |

---

## 16. analog-rytm-q4-trig-conditions: Patterns that change over time

sequencing · 4 · intermediate · ~9 min · prereq #15 · concepts `sequencer-pattern` · refs p.43, p.48–49

**Objective:** Use A:B, probability and FILL conditions so a 16-step loop evolves over four bars.

**Start:** Kit 09 sounds and pattern with every condition removed; a CY trig on step 1; PLAY on; [RECORD] on.

**Steps**

1. **do** (first win; check: `getStep(p,a,10,0)?.cond === '1:4'`)
   - Instruction: "Hold CY trig 1. TRIG encoder D now shows TRC: turn it to 1:4."
   - Principle: "A:B conditions play a trig on loop A of every B loops."

2. **predict** (check: playing for ≥ 4 loops)
   - Instruction: "Listen for four bars."
   - Q: "With 1:4, how often does the cymbal play?"
   - Options:
     0. "Once every four loops, on the first"
     1. "Every loop"
     2. "Randomly, a quarter of the time"
     3. "Only when FILL is held"
   - Answer: **0**
   - Explain: "1:4 counts loops: it plays on loop 1, then skips 2–4. That's fixed, unlike 25 %, which is random."
   - Principle: "Counting loops lets a short pattern change on a longer cycle."

3. **do** (check: `getStep(p,a,2,9)?.cond === '50%'`)
   - Instruction: "Hold RS trig 10 and set TRC to 50%."
   - Principle: "Probability gives variation that never repeats exactly."

4. **listen**
   - A: no conditions. B: with conditions, over 8 bars. Labels: ["Static", "Evolving"].

5. **do** (check: `getStep(p,a,1,15)?.cond === 'FILL'`)
   - Instruction: "Add an SD trig on step 16 and set its TRC to FILL."
   - Principle: "Fill trigs wait for your signal, so the variation lands where you choose."

6. **do** (check: engine fill state true)
   - Instruction: "Stop recording ([RECORD]), then hold [FILL] during the fourth bar."
   - Principle: "Holding a key to reveal hidden trigs is a fast live fill."
   - Explanation: "[FILL] works when grid recording is off."

7. **quiz**
   - Q: "25 % versus 1:4?"
   - Options:
     0. "25 % is random; 1:4 is a fixed every-fourth-loop pattern"
     1. "No difference"
     2. "1:4 is random"
   - Answer: **0**
   - Explain: "Probability is re-rolled every time. A:B follows a counter."

8. **challenge**
   - Instruction: "Make the loop sound different on each of four bars, without adding steps."
   - Checklist:
     - ≥ 3 trigs with an A:B condition where B is 2 or 4.
     - ≥ 1 probability condition.
     - ≥ 1 FILL trig.
   - Hints:
     1. "Give each bar its own extra hit."
     2. "Use 2:4, 3:4 and 4:4 on different trigs."
     3. "Keep the kick unconditional so the pulse stays."
   - Solution: the Kit 09 conditions, plus CB 7 at 2:4, BT 11 at 3:4 and CP 13 at 4:4.

9. **reflect**
   - Prompt: "When would you choose A:B over a probability?"
   - Model: "When the change should repeat predictably, like a fill every fourth bar. Probability is for loose variation that never repeats exactly."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "1:4 plays…" | on the first of every four loops · 25 % of the time · four times | 0 | "Loop counting." |
| 2 | "FILL trigs play…" | only while fill is active · always · never | 0 | "Fill mode." |
| 3 | "PRE is true when…" | the last condition evaluated on this track was true · the last step had a trig · the pattern restarts | 0 | "It chains to the previous condition." |
| 4 | "NEI looks at…" | the previous track's last condition · the next pattern · the kick | 0 | "The neighbour is the track before (manual p.48)." |

---

## 17. analog-rytm-p1-mutes-fills-rolls: Live mutes, fills and retrig rolls

performance · 1 · intermediate · ~9 min · prereq #16 · concepts `sequencer-pattern`, `velocity-dynamics` · refs p.23, p.35, p.41–42, p.49

**Objective:** Perform an 8-bar build with track mutes, a fill and a retrig roll.

**Start:** Kit 02, with SD 16 set to FILL; PLAY on; pad mode PLAY; grid recording off.

**Steps**

1. **do** (first win; check: pad mode MUTE and track 0 muted)
   - Instruction: "Press [MUTE], then tap the BD pad to mute the kick."
   - Principle: "Taking an element away makes its return hit harder."

2. **do** (check: BD unmuted)
   - Instruction: "On the next bar's downbeat, tap BD again to bring it back."
   - Principle: "Changes on a downbeat sound planned; between beats they sound like slips."

3. **predict** (check: engine fill state)
   - Instruction: "Hold [FILL] through the last bar of a 4-bar phrase."
   - Q: "What changes while FILL is held?"
   - Options:
     0. "FILL trigs play and !FILL trigs are skipped"
     1. "The tempo doubles"
     2. "Every track retriggers"
     3. "The kit reloads"
   - Answer: **0**
   - Explain: "FILL is a trig condition: it changes which trigs play, not the tempo or the kit."
   - Principle: "Conditional trigs let one pattern hold both a groove and its fill."

4. **do** (check: `getStep(p,a,1,15)?.retrig?.rate === 12`)
   - Instruction: "Press [RECORD]. Hold SD trig 16, press [RTRG], then turn encoder E to 1/32."
   - Principle: "A retrig repeats one hit quickly to make a roll."

5. **do** (check: `retrig.vel ≥ 30`)
   - Instruction: "Still holding trig 16, turn encoder H to about +40."
   - Principle: "Rising velocity makes a roll grow into the downbeat."

6. **listen**
   - A: no roll. B: with the roll. Labels: ["Plain", "Roll"].

7. **quiz**
   - Q: "Hold [RTRG] and press a pad harder. What changes?"
   - Options:
     0. "The retrig velocity: the roll gets louder"
     1. "The retrig rate"
     2. "Nothing"
   - Answer: **0**
   - Explain: "During a live retrig, pad pressure sets the velocity. The rate comes from the RETRIG menu."

8. **challenge**
   - Instruction: "Perform an 8-bar build: kick muted for bars 1–3, fill and roll in bar 4, kick back on bar 5."
   - Checklist:
     - SD has a retrig trig.
     - A FILL trig exists.
     - BD is unmuted at the end.
     - ≥ 8 bars played.
   - Hints:
     1. "Mute before the phrase starts."
     2. "Hold FILL through bar 4; the roll is already on step 16."
     3. "Unmute exactly on the downbeat of bar 5."
   - Solution: data with the SD 16 retrig (1/32 · 1/16 · +40) and its FILL condition; mute track 0 for 3 bars.

9. **reflect**
   - Prompt: "Why do mutes and fills work best on phrase boundaries?"
   - Model: "Listeners expect change every 4 or 8 bars. Changes there feel intentional; changes mid-phrase feel like mistakes."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "MUTE-mode pads…" | mute or unmute each track's sequencer · play louder · select patterns | 0 | "Sequencer mutes." |
| 2 | "Retrig 1/16 means…" | one hit per step · 16 per step · one per bar | 0 | "The nominal rate." |
| 3 | "Retrig velocity curve −128…" | fades the roll out completely · fades it in · retunes it | 0 | "Negative values fade out (manual p.41)." |

---

## 18. analog-rytm-p2-scenes-perf: Scenes and performance macros

performance · 2 · advanced · ~10 min · prereq #8, #17 · concepts `modulation-depth`, `effects` · refs p.23, p.28–31

**Objective:** Build a scene for an instant breakdown, and a pressure-controlled performance macro for a filter build.

**Start:** Kit 02; PLAY on; pad mode PLAY.

**Steps**

1. **info**
   - Instruction: "A SCENE jumps to fixed values. A PERF macro pushes values by an amount, scaled by how hard you press."
   - Explanation: "Each kit has 12 scenes and 12 macros, sharing 48 locks per mode."

2. **do** (first win; check: scene 1 contains `t1_amp_vol: 0`)
   - Instruction: "Press [SCNE], then [FUNC] + pad 1 to edit scene 1. Select BD, hold pad 1, turn AMP VOL to 0."
   - Principle: "A scene is a snapshot of settings switched on together."

3. **do** (check: scene 1 has `fx_reverb_vol ≥ 120`)
   - Instruction: "Press [FX]. Holding pad 1, set REVERB VOL to about 127. Press [SCNE] to finish editing."
   - Principle: "One scene can change many parameters at once, across tracks."

4. **predict** (check: scene 1 active, then inactive)
   - Instruction: "Tap scene pad 1 while the pattern plays. Tap it again."
   - Q: "What happens to the kick?"
   - Options:
     0. "It drops to VOL 0 at once, and comes back when the scene is off"
     1. "It fades out over a bar"
     2. "It's deleted from the pattern"
     3. "Nothing until the next pattern"
   - Answer: **0**
   - Explain: "A scene applies its values instantly while active, and the kit underneath is untouched. A fade would need a macro or an LFO, and nothing is deleted."
   - Principle: "Switching between stored values gives instant, repeatable changes."

5. **do** (check: perf 1 locks `t9_fltr_frq` with an amount ≤ −40)
   - Instruction: "Press [PERF], then hold [PERF] to edit. Select CH, hold pad 1, turn FLTR FRQ down about 60."
   - Principle: "A macro's depth follows pad pressure, for hands-on moves."
   - Explanation: "A perf lock is an offset. Light pressure adds a little, full pressure adds all of it."

6. **listen**
   - A: perf pad 1 released. B: fully pressed. Labels: ["Released", "Pressed"].

7. **quiz**
   - Q: "Scene versus performance macro?"
   - Options:
     0. "A scene jumps to fixed values; a macro offsets values by pressure"
     1. "They're the same"
     2. "Scenes only affect samples"
   - Answer: **0**
   - Explain: "Scenes are on or off. Macros are continuous, from 0 to the full depth."

8. **challenge**
   - Instruction: "Make a breakdown scene (no kick, big reverb) and a tension macro (darker hats, more delay feedback)."
   - Checklist:
     - A scene sets BD VOL ≤ 10 and raises the reverb.
     - A perf macro targets ≥ 2 parameters, including `fx_delay_fdb` with a positive amount.
   - Hints:
     1. "Scene: edit it with [FUNC] + pad, then hold the pad and turn."
     2. "Macro: hold [PERF] to edit, then hold the pad and turn by an amount."
     3. "FDB +40, CH FRQ −60."
   - Solution: scene 2 = {BD AMP VOL 0, REVERB VOL 127, REVERB DEC 110}; perf 2 = {CH FLTR FRQ −60, DELAY FDB +40}.

9. **reflect**
   - Prompt: "When would you use a scene rather than a performance macro?"
   - Model: "A scene for an instant, repeatable change such as a breakdown. A macro for a gradual, expressive move controlled by pressure."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "Scenes per kit:" | 12 · 4 · 64 | 0 | "One per pad." |
| 2 | "A macro's depth follows…" | pad pressure · tempo · swing | 0 | "Pressure." |
| 3 | "Which knob drives macros without PERF mode?" | QUICK PERF AMOUNT · MAIN VOLUME · DATA ENTRY A | 0 | "Choose macros with [QPER] + pads (manual p.30–31)." |

---

## 19. analog-rytm-t1-sync-route: The Rytm with the A4, the studio clock and the mixer

studio · 1 · intermediate · ~8 min · prereq #13 · concepts `timing-tempo`, `signal-routing`, `mixing` · refs p.61–62, p.65

**Registration:**
- `requires: ['analog-four', 'studio-clock', 'xone96']`.
- If cross-instrument lessons must be `device: 'studio'`, put this one in `lib/studio/lessons.ts` and give it an id starting `studio-`. That lifts the ids-start-with-the-device rule. studio-3 and studio-4 there teach the generic version; this one applies it to the Rytm.

**Objective:** Lock the Rytm and the Analog Four to the studio clock, and route the Rytm into a mixer channel.

**Start:** A rack with the Analog Rytm (Kit 02), the Analog Four, a Studio Clock and an Xone:96; transport stopped.

**Steps**

1. **info**
   - Instruction: "In a studio one clock leads. MIDI clock sends 24 ticks per beat, plus start and stop."
   - Principle: "Followers lock to one leader, so their steps line up."

2. **do** (first win; check: `s.sync[rytm] !== false`)
   - Instruction: "In the Studio tab, tick 'Sync to studio clock' for the Analog Rytm."
   - Principle: "A synced instrument ignores its own tempo and follows the leader."
   - Explanation: "On the hardware this is CLOCK RECEIVE plus TRANSPORT RECEIVE in MIDI SYNC."

3. **do** (`instance`: A4; check: `s.sync[a4] !== false`)
   - Instruction: "Tick it for the Analog Four too."
   - Principle: "Everything that follows the same clock plays in time together."

4. **predict** (check: `s.transport.playing && s.transport.bpm === 124`)
   - Instruction: "Press ▶ in the top bar, then set the studio tempo to 124."
   - Q: "What happens to the Rytm's own TEMPO setting?"
   - Options:
     0. "It's ignored while synced: both follow 124"
     1. "The Rytm keeps 120 and drifts"
     2. "The A4 follows the Rytm instead"
     3. "Both stop"
   - Answer: **0**
   - Explain: "Synced instruments follow the leader, so a tempo change reaches both at once."
   - Principle: "One tempo source keeps every sequencer aligned."

5. **quiz**
   - Q: "The real Rytm can send DIN 24 from its MIDI OUT. What is that for?"
   - Options:
     0. "Syncing vintage gear that uses DIN sync pulses"
     1. "Audio"
     2. "Program changes"
   - Answer: **0**
   - Explain: "The OUT and THRU ports can send MIDI, DIN 24 or DIN 48. On DIN settings the port sends sync pulses instead of MIDI data."

6. **do** (check: `s.routes[rytm]` is a mixer channel)
   - Instruction: "Set the Rytm's Output to a Xone:96 channel."
   - Principle: "Routing gives the drums their own fader, EQ and filter."

7. **challenge**
   - Instruction: "Get the Rytm and the A4 playing together from the top, both synced and both on mixer channels."
   - Checklist:
     - Both are synced.
     - The transport is playing.
     - Both are routed to mixer channels.
   - Hints:
     1. "Sync first, then routing."
     2. "Each instrument has its own Output menu."
     3. "Press ▶ once: both start."
   - Solution: sync on for both; Rytm → Xone:96 channel 1, A4 → channel 2; transport playing.

8. **reflect**
   - Prompt: "Why does only one device lead the clock?"
   - Model: "Two leaders drift apart. One clock, with everything following, keeps every step aligned."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "MIDI clock ticks per quarter note:" | 24 · 4 · 96 | 0 | "24 PPQN." |
| 2 | "While synced, the Rytm's tempo…" | follows the studio · leads · is random | 0 | "It follows." |
| 3 | "Which Rytm setting makes it follow external clock?" | CLOCK RECEIVE · CLOCK SEND · PRG CH SEND | 0 | "In MIDI SYNC (manual p.61)." |

---

## 20. analog-rytm-t2-chains-songs-arrange: From patterns to a song

studio · 2 · advanced · ~12 min · prereq #19, #16 · concepts `sequencer-pattern`, `mixing` · refs p.38, p.53–55

**Objective:** Turn three Rytm patterns into a 32-bar arrangement with a chain, a song and the studio arranger.

**Start:** Patterns A01 (the Kit 02 groove), A02 (the same without BD, as a breakdown) and A03 (the Kit 03 groove); PLAY off.

**Steps**

1. **info**
   - Instruction: "A pattern is a loop and a song is loops in order. Chains play patterns in sequence; SONG mode adds repeats and mutes."
   - Principle: "Arranging is deciding what changes, and when."

2. **do** (first win; check: `p.chain.join() === 'A01,A02,A03'`)
   - Instruction: "Make a chain: [BANK A], hold [TRIG 1], then tap [TRIG 2] and [TRIG 3]."
   - Principle: "Chaining patterns turns loops into sections that follow each other."
   - Explanation: "A quick chain uses patterns from one bank. Holding the first key starts the chain."

3. **predict** (check: chain mode playing)
   - Instruction: "Press [CHAIN MODE], then [PLAY]."
   - Q: "When does the Rytm move from A01 to A02?"
   - Options:
     0. "At the end of A01 (SEQUENTIAL change)"
     1. "Immediately"
     2. "After 16 bars"
     3. "Only when you tap a pad"
   - Answer: **0**
   - Explain: "SEQUENTIAL is the default pattern mode: it waits for the current pattern to finish, so phrases stay whole."
   - Principle: "Changing at pattern ends keeps phrases complete."

4. **do** (check: `p.song.rows` repeats are 4, 2, 4, 2)
   - Instruction: "Press [FUNC] + [SONG MODE]. Add rows A01, A02, A03, A02, then set repeats 4, 2, 4, 2 with encoder A."
   - Principle: "Repeats stretch a loop into a section of the right length."

5. **quiz**
   - Q: "What does DIRECT JUMP do?"
   - Options:
     0. "Changes pattern at once, continuing from the same position"
     1. "Waits for the end"
     2. "Stops the sequencer"
   - Answer: **0**
   - Explain: "DIRECT START restarts the new pattern from step 1; DIRECT JUMP keeps the position."

6. **do** (studio; check: `s.arrangement.sections.length ≥ 3`)
   - Instruction: "In the Studio tab, add arranger sections Intro 8, Build 8 and Drop 16, using the Rytm patterns."
   - Principle: "Sections of 8 or 16 bars match how listeners hear phrases."

7. **challenge**
   - Instruction: "Build a 32-bar track: an intro without kick, a build with a fill, a drop with everything, and a breakdown."
   - Checklist:
     - The sections total 32 bars.
     - At least one section has the Rytm muted, or uses A02.
     - Song mode is on.
   - Hints:
     1. "Use phrases of 8 bars."
     2. "Use A02 for the intro and the breakdown."
     3. "Put the FILL bar just before the drop."
   - Solution: sections Intro 8 (A02), Build 8 (A01, fill in bar 8), Drop 8 (A03), Break 8 (A02); song mode on.

8. **reflect**
   - Prompt: "Why do arrangements change on 4-, 8- or 16-bar boundaries?"
   - Model: "Music is heard in phrases, so changes at phrase boundaries feel natural and intentional."

**Review**

| # | Question | Options | Answer | Why |
|---|---|---|---|---|
| 1 | "SEQUENTIAL switches…" | at the end of the pattern · immediately · randomly | 0 | "It waits for the end." |
| 2 | "Song repeats are set with…" | DATA ENTRY A on the row · TRACK LEVEL · [PAGE] | 0 | "Manual p.54." |
| 3 | "TEMP JUMP…" | plays another pattern once, then returns · deletes a pattern · is a Sound lock | 0 | "A temporary jump (manual p.39)." |
