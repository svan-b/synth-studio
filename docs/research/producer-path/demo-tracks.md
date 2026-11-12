# Three demo tracks

Three complete, original demo tracks that show what Synth Studio can do, specified precisely
enough to program note for note once the instrument rebuilds have merged. Each one doubles as
teaching material: the Producer path (`curriculum.md`) plays short excerpts as lesson hooks,
and every section below has a teaching note.

| | Demo 1 · "Low Tide Lights" | Demo 2 · "Three Clocks" | Demo 3 · "Copper Wire" |
|---|---|---|---|
| Set | Elektron live: Analog Rytm + Analog Four → Xone:96 | Moog Sound Studio: DFAM + Mother-32 + Subharmonicon, Studio Clock, → Xone:96 | Bass & drums: Analog Rytm + Sub 37 → Xone:96 |
| Style | Deep, melodic techno-house | Hypnotic polyrhythmic jam | Electro breaks |
| Tempo | 124 BPM | 110 BPM | 122 BPM |
| Key | A minor (natural minor) | D minor pentatonic | G minor |
| Swing | 54 % on both Elektrons | none (straight 16ths) | none (straight) |
| Length | 80 bars, 2:35 + tail | 72 bars, 2:37 + tail | 80 bars, 2:37 + tail |
| Master | −10.5 LUFS-I, ≤ −1.5 dBTP | −13 LUFS-I, ≤ −1.0 dBTP | −11 LUFS-I, ≤ −1.5 dBTP |

All three are original compositions. No melody, riff or progression is copied from a published
record; the chord progressions are common-practice shapes and the melodies were written for
these demos.

## Reading the specs

- **Steps** are 1-based, like the trig keys. A 16-step grid is one bar; 32 or 64-step patterns
  are shown one bar per row or table. A dot (·) is an empty step.
- **Drum cells** hold the trig's velocity (1–127). `[1:2]`, `[4:4]`, `[8:8]`, `[1ST]` are trig
  conditions: A:B plays on loop A of every B loops of that pattern; 1ST plays only on the first
  loop after the pattern starts. The arranger starts each section's pattern from step 1, so loop
  counts line up with the section's bars.
- **Locks** (parameter locks) are listed under each grid as "step: PARAMETER value" and apply to
  that trig only. A **lock trig** changes parameters without playing a note.
- **Micro timing** is in 1/384 of a whole note (1/24 of a step): +2 at 124 BPM is about 10 ms late.
- **Melodic grids** give the NOTE, VEL and LEN (in steps) of each trig. Notes use C4 = MIDI 60
  (A2 = 45, A3 = 57, A4 = 69). On the Analog Four, LEN 1 is one 16th.
- **Levels** are given in dB relative to the kick, measured as short-term loudness (LUFS-S) of the
  part soloed over its busiest four bars against the kick soloed over the same bars. They are
  targets; the instrument knob values listed with them are starting points.
- **Xone EQ** values are the dB readouts of the twin (HI and LO: kill to +6 dB; HI MID and LO MID:
  −27 to +10 dB on channels 1–4; channels A/B have a swept MID).
- **Filter values.** Rytm FLTR FREQ moves one semitone per step on the rebuilt twin, with 60 = 440 Hz
  (40 ≈ 139 Hz, 52 ≈ 277 Hz, 64 ≈ 554 Hz, 76 ≈ 1.1 kHz). Analog Four filter values are given with
  an approximate frequency from the twin's curve (0 ≈ 20 Hz, 64 ≈ 640 Hz, 127 ≈ 20 kHz); tune by
  ear and with the spectrum if the rebuilt curve differs.
- **Swing.** Elektron swing of S % delays every second 16th by (S − 50) / 50 of a step. 54 % equals
  a studio swing of 0.08. Each demo sets swing in one place only.

### Time at each tempo

| | 124 BPM | 110 BPM | 122 BPM |
|---|---|---|---|
| Beat (quarter) | 484 ms | 545 ms | 492 ms |
| 16th (one step) | 121 ms | 136 ms | 123 ms |
| 8th | 242 ms | 273 ms | 246 ms |
| Dotted 8th (delay 3/16, TIM 24) | 363 ms | 409 ms | 369 ms |
| One bar | 1.935 s | 2.182 s | 1.967 s |
| 8 bars | 15.5 s | 17.5 s | 15.7 s |
| Micro-timing unit (1/384) | 5.0 ms | 5.7 ms | 5.1 ms |

---

## Demo 1 · "Low Tide Lights" (Elektron live)

Deep, melodic techno-house for the Elektron live set. Detroit-style minor-seventh chord stabs
and a rolling off-beat bass over a swung four-on-the-floor, a three-step hook that cascades
through a dotted-8th delay, and a break that withholds the home chord until the second drop.

| | |
|---|---|
| Tempo | 124 BPM |
| Key | A minor (A B C D E F G); progression Am7 – Am7 – Dm7 – Em7 (i – i – iv – v) |
| Swing | 54 % on every Rytm and A4 pattern (studio swing 0) |
| Length | 80 bars = 2:34.8, plus about 2.5 s of tails |
| Master | −10.5 LUFS integrated, true peak ≤ −1.5 dBTP |
| Patterns | Rytm A01–A07, A4 A01–A07, one arrangement of 9 sections |

### Studio setup

- **Set** `elektron-live`: Analog Rytm → Xone:96 channel 1, Analog Four → channel 2, both with
  "Sync to studio clock" on. Xone channels A and B on RTN (delay and reverb returns).
- **Tempo** 124 BPM on the studio transport; the Elektrons follow it.
- **Swing** is set in each pattern (54 %), not on the studio clock, so both machines swing the same
  amount from the same place. Rytm: [FUNC] + [BANK G]; A4: [FUNC] + [PTN].
- **Scale**: every Rytm pattern is NORMAL mode, 1X; A01–A05 and A07 are 16 steps, A06 is 64. Every
  A4 pattern is 64 steps, 1X.

### Sound design: Analog Rytm kit "LOW TIDE"

| Track | Machine | Source (SRC page) | FLTR | AMP | Role |
|---|---|---|---|---|---|
| BD | BD HARD | TUN set so the body sits on A1 (≈ 55 Hz on the spectrum), SWT 38, SNP 52, DEC 50, HLD 12, WAV SIN, TIC 30, LEV 110 | LP2, FREQ 127 (open) | ATK 0, DEC INF, OVR 18, PAN C, VOL 112 | Short, punchy kick in key with the bass |
| SD | SD HARD | TUN +2, SWD 40, SWT 30, DEC 30, TIC 50, NOD 38, NOL 80, LEV 100 | HP2, FREQ 30 (≈ 78 Hz) | DEC INF, REV 40, VOL 92 | Fills and the build roll |
| RS | RS HARD | TUN +5, SWD 20, SWT 10, DEC 20, SYM +10, NOL 20, TIC 60, LEV 100 | HP2, FREQ 50 (≈ 247 Hz) | DEL 70, REV 20, PAN L20, VOL 80 | Dub rim into the delay |
| CP | CP CLASSIC | TON 72, NUM about a third up (3 claps), RAT 50, NOD 48, NOL 80, RND 25, CPD 50, LEV 100 | HP2, FREQ 41 (≈ 150 Hz) | REV 45, PAN C, VOL 96 | Backbeat |
| LT | XT CLASSIC | TUN set to E2 (≈ 82 Hz, the fifth), DEC 40, SWD 30, SWT 50, NOL 20, NOD 30 | LP2 open | DEL 25, PAN L12, VOL 84 | Conga-like tom answers |
| CH | CH CLASSIC | TUN 0, COL +10, DEC 24, LEV 100 | HP2, FREQ 58 (≈ 392 Hz) | PAN R8, VOL 80 | 16th ghosts |
| OH | OH CLASSIC | TUN 0, COL +10, DEC 55, LEV 100 | HP2, FREQ 58 | REV 10, PAN R8, VOL 84 | Off-beat "tss" |
| CY | CY RIDE | TUN 0, TYP B, HIT 30, DEC 60, C1 90, C2 64, C3 64, LEV 90 | HP2, FREQ 64 (≈ 554 Hz) | REV 15, PAN R25, VOL 78 | Drop 2 ride |

BT, MT, HT and CB are unused. TRIG page defaults: VEL 100, LEN 1/16.

**Rytm FX track.** DELAY: TIM 24 (dotted 8th), X on, WID +63, FDB 72, HPF 48, LPF 88, REV 24, VOL 96.
REVERB: PRE 10, DEC 58, FRQ 90, GAI 84, HPF 40, LPF 86, VOL 90. DISTORTION: AMT 8, SYM 0, delay
and reverb returns PRE. COMPRESSOR: THR 98, ATK 1 ms, REL A1, MUP 12, RAT 1:4, SEQ HPF (so the kick
doesn't pump the hats), MIX 127, VOL 100: about 2 dB of glue on the drum bus.

### Sound design: Analog Four kit "LOW TIDE"

| | T1 · bass | T2 · stab A | T3 · stab B | T4 · hook / riser |
|---|---|---|---|---|
| OSC 1 | SAW, SUB 1OCT, LEV 100 | SAW, LEV 85, TUN 0 | SAW, LEV 80, TUN +3 | PULS, PW 44, LEV 90 |
| OSC 2 | LEV 0 | SAW, LEV 75, TUN +7, DET +6 | SAW, LEV 75, TUN +10, DET −6 | TRI, TUN +12, LEV 50 |
| FILTER 1 (ladder LP) | FREQ 40 (≈ 175 Hz), RES 22, OVR 20, TRK about 1:1, DEP +20 | FREQ 60 (≈ 520 Hz), RES 30, TRK ½, DEP +26 | as T2 | FREQ 72 (≈ 1 kHz), RES 40, TRK ½, DEP +30 |
| FILTER 2 | HP2, FREQ 8 (≈ 31 Hz) | HP2, FREQ 32 (≈ 115 Hz) | HP2, FREQ 32 | HP1, FREQ 50 (≈ 300 Hz) |
| ENV F | ATK 0, DEC 34, SUS 0, REL 20 | ATK 0, DEC 38, SUS 0, REL 30 | as T2 | ATK 0, DEC 30, SUS 10, REL 30 |
| AMP | ATK 0, DEC 40, SUS 70, REL 12 | ATK 0, DEC 46, SUS 0, REL 36 | as T2 | ATK 0, DEC 52, SUS 40, REL 44 |
| Sends CHO / DEL / REV | 0 / 0 / 0 | 40 / 60 / 45 | 40 / 60 / 45 | 30 / 70 / 50 |
| PAN, VOL | C, 110 | L12, 88 | R12, 88 | C, 90 |
| LFO 1 | — | SPD 8, MUL 1 (about 16 bars), TRI, DST F1 FRQ, DEP +8 | as T2 | — |
| TRIG defaults | NOTE A2, LEN 1 | NOTE A3, LEN 0.5 | NOTE A3, LEN 0.5 | NOTE E5, LEN 1 |

T2 and T3 together are the chord-memory trick: two tracks, each a two-note interval, so one NOTE
on both tracks plays a four-note minor-seventh chord (T2 plays the root and fifth, T3 the minor
third and minor seventh). On hardware, POLY CONFIG could play chords from one track; this way keeps
all four tracks independent and works on the twin, which does not model POLY.

**A4 FX track.** CHORUS: PRE 20, SPD 28, DEP 56, WID 110, FB 8, HPF 40, LPF 120, VOL 90. DELAY: TIM 24
(dotted 8th, 363 ms), X on, FB 52, OVR 8, HPF 40, LPF 80, REV 30, VOL 95. REVERB: PRE 14, DEC 82,
GAI 70 (darker tail), HPF 36, LPF 76, VOL 92.

### Patterns

#### Rytm A01 · INTRO (16 steps)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BD | 120 | · | · | · | 116 | · | · | · | 120 | · | · | · | 116 | · | · | · |
| CH | · | 44 | 96 | 58 | · | 44 | 96 | 58 | · | 44 | 96 | 58 | · | 44 | 96 | 64 |
| RS | · | · | · | · | · | · | · | · | · | · | · | 85 | · | · | · | 68 [1:2] |

- CH micro timing +2 on steps 2, 6, 10 and 14 (the quiet 16ths sit slightly late).
- RS 16 has condition 1:2: it plays in odd bars only, so the rim answers itself every other bar.

#### Rytm A02 · GROOVE (16 steps)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BD | 120 | · | · | · | 116 | · | · | · | 120 | · | · | · | 116 | · | · | · |
| CP | · | · | · | · | 108 | · | · | · | · | · | · | · | 110 | · | · | · |
| OH | · | · | 90 | · | · | · | 90 | · | · | · | 90 | · | · | · | 94 | · |
| CH | · | 42 | · | 60 | · | 42 | · | 60 | · | 42 | · | 60 | · | 42 | · | 66 |
| RS | · | · | · | · | · | · | · | · | · | · | · | 85 | · | · | · | 68 [1:2] |

- CH micro +2 on 2, 6, 10, 14. CP 13 micro +1.
- CH and OH share one voice: the CH on the step after each OH chokes it, so the open hat is a short, tight 'tss'.

#### Rytm A03 · DROP (16 steps; also OUTRO A)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BD | 120 | · | · | · | 116 | · | · | · | 120 | · | · | · | 116 | · | · | · |
| CP | · | · | · | · | 108 | · | · | · | · | · | · | · | 110 | · | · | 52 [4:4] |
| OH | · | · | 90 | · | · | · | 90 | · | · | · | 90 | · | · | · | 94 | · |
| CH | · | 42 | · | 60 | · | 42 | · | 60 | · | 42 | · | 60 | · | 42 | · | 66 |
| RS | · | · | · | · | · | · | · | · | · | · | · | 85 | · | · | · | 68 [1:2] |
| LT | · | · | · | · | · | · | · | 64 | · | · | 70 [2:2] | · | · | 56 | · | · |
| SD | · | · | · | · | · | · | · | · | · | · | · | · | · | 70 [8:8] | 86 [8:8] | 104 [8:8] |

- CH micro +2 on 2, 6, 10, 14; CP 13 micro +1 (as A02).
- CH 16: lock DEC +16 (a slightly longer hat leading into the next bar).
- CP 16 [4:4] is a soft pickup clap at the end of every 4-bar phrase. RS 16 [1:2] never meets it: RS plays odd loops, CP loop 4, 8, 12, 16. RS and CP share a voice, so this matters.
- SD 14–16 [8:8] is the snare fill at the end of each 8-bar phrase.
- LT 11 [2:2] answers in even bars only: the tom pattern alternates bar to bar.

#### Rytm A04 · BREAK (16 steps)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BD | 127 [1ST] | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| RS | · | · | · | 78 | · | · | 58 [1:2] | · | · | · | · | 85 | · | · | · | · |
| CH | · | · | 66 | · | · | · | 66 | · | · | · | 66 | · | · | · | 72 | · |
| CY | 58 [1:4] | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| LT | · | · | · | · | · | · | · | · | · | · | 58 [2:2] | · | · | · | · | · |

- BD 1 [1ST] plays once, on the first bar of the break: a single deep impact. Locks: SRC DEC +30, AMP REV 60.
- CY 1 [1:4]: a ride wash every four bars. Lock SRC DEC 110.
- LT 11 [2:2]: lock AMP DEL 50 so the tom echoes into the space.

#### Rytm A05 · BUILD A (16 steps)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BD | 112 | · | · | · | 108 | · | · | · | 112 | · | · | · | 108 | · | · | · |
| SD | · | · | · | · | 60 | · | · | · | · | · | · | · | 60 | · | 66 [4:4] | 74 [4:4] |
| CP | · | · | · | · | 100 | · | · | · | · | · | · | · | 104 | · | · | · |
| OH | · | · | 88 | · | · | · | 88 | · | · | · | 88 | · | · | · | 92 | · |
| CH | 70 | 48 | · | 58 | 70 | 48 | · | 58 | 70 | 48 | · | 58 | 70 | 48 | · | 64 |
| RS | · | · | · | · | · | · | · | · | · | · | · | 80 | · | · | · | · |

- The snare joins the clap on the backbeat at low velocity: a harder edge without a new rhythm.
- SD 15–16 [4:4]: a two-hit pickup into Build B.

#### Rytm A06 · BUILD B (64 steps, 4 bars, played once)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BD · bar 1 | 110 | · | · | · | 110 | · | · | · | 110 | · | · | · | 110 | · | · | · |
| BD · bar 2 | 110 | · | · | · | 110 | · | · | · | 110 | · | · | · | 110 | · | · | · |
| BD · bar 3 | 110 | · | · | · | 110 | · | · | · | 110 | · | · | · | 110 | · | · | · |
| SD · bar 1 | 60 | · | 62 | · | 64 | · | 66 | · | 68 | · | 70 | · | 72 | · | 74 | · |
| SD · bar 2 | 76 | · | 78 | · | 80 | · | 82 | · | 84 | · | 86 | · | 88 | · | 90 | · |
| SD · bar 3 | 84 | 85 | 87 | 88 | 89 | 91 | 92 | 93 | 95 | 96 | 97 | 99 | 100 | 101 | 103 | 104 |
| SD · bar 4 | 106 | 107 | 109 | 110 | 112 | 113 | 114 | 116 | 117 | 119 | 120 | 121 | 123 | 124 | 126 | 127 |
| CP · bar 1 | · | · | · | · | 100 | · | · | · | · | · | · | · | 100 | · | · | · |
| CP · bar 2 | · | · | · | · | 100 | · | · | · | · | · | · | · | 100 | · | · | · |
| CP · bar 3 | · | · | · | · | 100 | · | · | · | · | · | · | · | 100 | · | · | · |
| OH · bar 1 | · | · | 86 | · | · | · | 86 | · | · | · | 86 | · | · | · | 86 | · |
| OH · bar 2 | · | · | 86 | · | · | · | 86 | · | · | · | 86 | · | · | · | 86 | · |
| OH · bar 3 | · | · | 86 | · | · | · | 86 | · | · | · | 86 | · | · | · | 86 | · |
| CH · bar 1 | 50 | 51 | · | 52 | 53 | 54 | · | 56 | 56 | 57 | · | 59 | 60 | 60 | · | 62 |
| CH · bar 2 | 63 | 63 | · | 65 | 66 | 67 | · | 68 | 69 | 70 | · | 71 | 72 | 73 | · | 75 |
| CH · bar 3 | 75 | 76 | · | 78 | 79 | 79 | · | 81 | 82 | 83 | · | 84 | 85 | 86 | · | 87 |
| CH · bar 4 | 88 | 89 | 90 | 90 | 91 | 92 | 93 | 94 | 94 | 95 | 96 | 97 | 98 | 98 | 99 | 100 |

- SD gets denser every bar: 8ths, 8ths, 16ths, 16ths, with velocity rising from 60 to 127.
- SD RETRIG: steps 57–60 RATE 1/32 (two hits per step), steps 61–64 RATE 1/64 (four), retrig LEN 1 step, VEL CURVE +20.
- SD locks per bar: NOTE 0 / +1 / +2 / +3 and FLTR FREQ 40 / 52 / 64 / 76 (the snare climbs and thins). Bar 4 also locks AMP REV 70.
- Bar 4 drops the kick, clap and open hat: only the roll, the closed hats and the A4 riser remain. A bar without a kick is the 'breath' that makes the drop land.

#### Rytm A07 · DROP 2 (16 steps)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BD | 120 | · | · | · | 116 | · | · | · | 120 | · | · | · | 116 | · | · | · |
| CP | · | · | · | · | 108 | · | · | · | · | · | · | · | 110 | · | · | 52 [4:4] |
| OH | · | · | 90 | · | · | · | 90 | · | · | · | 90 | · | · | · | 94 | · |
| CH | · | 42 | · | 60 | · | 42 | · | 60 | · | 42 | · | 60 | · | 42 | · | 66 |
| RS | · | · | · | · | · | · | · | · | · | 58 [1:2] | · | 85 | · | · | · | 68 [1:2] |
| LT | · | · | · | · | · | · | · | 64 | · | · | 70 [2:2] | · | · | 56 | · | · |
| SD | · | · | · | · | · | · | · | · | · | · | · | · | · | 70 [8:8] | 86 [8:8] | 104 [8:8] |
| CY | 68 | · | 88 | · | 68 | · | 88 | · | 68 | · | 88 | · | 68 | · | 88 | · |

- A03 plus a ride (CY) on every 8th, louder on the off-beats, and one more rim (RS 10 [1:2]), placed well after the clap on 5 so it doesn't cut the clap's tail (RS and CP share a voice).
- CY and CB share a voice; CB is unused in this kit, so the ride never gets cut.
- Locks, micro timing and conditions as A03.

#### A4 track 1 · bass line (64 steps; patterns A01, A02, A06, A07)

| T1 · bar 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | A2 | · | · | · | A2 | A3 | · | · | A2 | · | · | · | A2 | E3 |
| VEL | · | · | 112 | · | · | · | 100 | 64 | · | · | 108 | · | · | · | 100 | 60 |
| LEN | · | · | 1.5 | · | · | · | 1 | 0.5 | · | · | 1.5 | · | · | · | 1 | 0.5 |

| T1 · bar 2 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | A2 | · | · | · | A2 | · | · | · | C3 | · | · | A2 | G2 | · |
| VEL | · | · | 112 | · | · | · | 100 | · | · | · | 104 | · | · | 66 | 98 | · |
| LEN | · | · | 1.5 | · | · | · | 1 | · | · | · | 1.5 | · | · | 0.5 | 1 | · |

| T1 · bar 3 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | D3 | · | · | · | D3 | D4 | · | · | D3 | · | · | · | C3 | · |
| VEL | · | · | 112 | · | · | · | 100 | 64 | · | · | 108 | · | · | · | 98 | · |
| LEN | · | · | 1.5 | · | · | · | 1 | 0.5 | · | · | 1.5 | · | · | · | 1 | · |

| T1 · bar 4 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | E3 | E4 | · | · | E3 | · | · | G3 | A2 | · |
| VEL | · | · | 112 | · | · | · | 100 | 64 | · | · | 108 | · | · | 70 | 110 | · |
| LEN | · | · | 1.5 | · | · | · | 1 | 0.5 | · | · | 1.5 | · | · | 0.5 | 1.5 | · |

Kick steps are 1, 5, 9 and 13 of every bar: the bass never lands on one, and every LEN ends at least half a step before the next kick. The SUB 1OCT oscillator puts each note's fundamental an octave below the written note (A2 is heard with its body at A1, 55 Hz).

#### A4 tracks 2 + 3 · chord stabs (64 steps; A02, A06, and A07 with every trig at [1:2])

| T2 = T3 · bar 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | A3 | · | · | · | · | A3 | · | · | A3 | · | · | · | · | · |
| VEL | · | · | 100 | · | · | · | · | 78 | · | · | 92 | · | · | · | · | · |
| LEN | · | · | 0.5 | · | · | · | · | 0.5 | · | · | 0.5 | · | · | · | · | · |

| T2 = T3 · bar 2 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | A3 | · | · | · | · | · | · | · | A3 | · | · | A3 | · | · |
| VEL | · | · | 100 | · | · | · | · | · | · | · | 92 | · | · | 74 | · | · |
| LEN | · | · | 0.5 | · | · | · | · | · | · | · | 0.5 | · | · | 0.5 | · | · |

| T2 = T3 · bar 3 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | D3 | · | · | · | · | D3 | · | · | D3 | · | · | · | · | · |
| VEL | · | · | 100 | · | · | · | · | 78 | · | · | 92 | · | · | · | · | · |
| LEN | · | · | 0.5 | · | · | · | · | 0.5 | · | · | 0.5 | · | · | · | · | · |

| T2 = T3 · bar 4 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | · | E3 | · | · | E3 | · | · | · | A3 | · |
| VEL | · | · | 100 | · | · | · | · | 80 | · | · | 94 | · | · | · | 96 | · |
| LEN | · | · | 0.5 | · | · | · | · | 0.5 | · | · | 0.5 | · | · | · | 0.5 | · |

Both tracks get the same trigs and NOTEs. Track 2 sounds NOTE + 0 and + 7, track 3 NOTE + 3 and + 10, so every trig is a minor-seventh chord:

| NOTE | Chord | Sounding notes (T2: +0, +7 · T3: +3, +10) | Where |
|---|---|---|---|
| A3 | Am7 | A3 C4 E4 G4 | bars 1–2 |
| D3 | Dm7 | D3 F3 A3 C4 | bar 3 |
| E3 | Em7 | E3 G3 B3 D4 | bar 4 |
| A3 | Am7 | A3 C4 E4 G4 | bar 4, step 15: the push |

#### A4 track 4 · hook, drop version (64 steps; A06)

| T4 · bar 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E5 | · | · | D5 | · | · | C5 | · | · | A4 | · | · | C5 | · |
| VEL | · | · | 100 | · | · | 88 | · | · | 94 | · | · | 86 | · | · | 80 | · |
| LEN | · | · | 1.5 | · | · | 1 | · | · | 1 | · | · | 1.5 | · | · | 1 | · |

| T4 · bar 2 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E5 | · | · | D5 | · | · | C5 | · | · | D5 | · | · | E5 | · |
| VEL | · | · | 100 | · | · | 88 | · | · | 94 | · | · | 86 | · | · | 92 | · |
| LEN | · | · | 1.5 | · | · | 1 | · | · | 1 | · | · | 1 | · | · | 2 | · |

| T4 · bar 3 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | F5 | · | · | E5 | · | · | D5 | · | · | A4 | · | · | D5 | · |
| VEL | · | · | 100 | · | · | 88 | · | · | 94 | · | · | 86 | · | · | 80 | · |
| LEN | · | · | 1.5 | · | · | 1 | · | · | 1 | · | · | 1.5 | · | · | 1 | · |

| T4 · bar 4 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | G5 | · | · | E5 | · | · | D5 | · | · | B4 | · | · | · | · |
| VEL | · | · | 100 | · | · | 88 | · | · | 94 | · | · | 90 | · | · | · | · |
| LEN | · | · | 1.5 | · | · | 1 | · | · | 1 | · | · | 2 | · | · | · | · |

#### A4 pattern A03 · BREAK (64 steps)

| T2 = T3 pad · bar 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | D3 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| VEL | 90 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| LEN | 32 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |

*T2 = T3 pad, bar 2: the D3 from the previous bar is still held.*

| T2 = T3 pad · bar 3 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | E3 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| VEL | 90 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| LEN | 32 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |

*T2 = T3 pad, bar 4: the E3 from the previous bar is still held.*

Pad trigs lock AMP ATK 72, AMP SUS 110, AMP REL 96, FILTER 1 FREQ 50 and AMP REV 100. The same two tracks that play stabs in the drop become a slow pad here: Dm7 (D3 F3 A3 C4) for two bars, then Em7 (E3 G3 B3 D4) for two. The tonic chord, Am7, is held back until Drop 2.

| T4 break hook · bar 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | F5 | · | · | E5 | · | · | D5 | · | · | A4 | · | · | D5 | · |
| VEL | · | · | 92 | · | · | 84 | · | · | 88 | · | · | 80 | · | · | 78 | · |
| LEN | · | · | 1.5 | · | · | 1 | · | · | 1 | · | · | 1.5 | · | · | 1 | · |

| T4 break hook · bar 2 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | F5 | · | · | E5 | · | · | D5 | · | · | E5 | · | · | F5 | · |
| VEL | · | · | 92 | · | · | 84 | · | · | 88 | · | · | 82 | · | · | 86 | · |
| LEN | · | · | 1.5 | · | · | 1 | · | · | 1 | · | · | 1 | · | · | 2 | · |

| T4 break hook · bar 3 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | G5 | · | · | E5 | · | · | D5 | · | · | B4 | · | · | D5 | · |
| VEL | · | · | 92 | · | · | 84 | · | · | 88 | · | · | 80 | · | · | 78 | · |
| LEN | · | · | 1.5 | · | · | 1 | · | · | 1 | · | · | 1.5 | · | · | 1 | · |

| T4 break hook · bar 4 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | G5 | · | · | E5 | · | · | D5 | · | · | E5 | · | · | · | · |
| VEL | · | · | 92 | · | · | 84 | · | · | 88 | · | · | 86 | · | · | · | · |
| LEN | · | · | 1.5 | · | · | 1 | · | · | 1 | · | · | 4 | · | · | · | · |

Track 1 is silent in the break.

#### A4 pattern A04 · BUILD A (64 steps)

| T1 · bar 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · |
| VEL | · | · | 100 | · | · | · | 100 | · | · | · | 100 | · | · | · | 100 | · |
| LEN | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · |

| T1 · bar 2 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · |
| VEL | · | · | 100 | · | · | · | 100 | · | · | · | 100 | · | · | · | 100 | · |
| LEN | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · |

| T1 · bar 3 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · |
| VEL | · | · | 100 | · | · | · | 100 | · | · | · | 100 | · | · | · | 100 | · |
| LEN | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · |

| T1 · bar 4 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · |
| VEL | · | · | 100 | · | · | · | 100 | · | · | · | 100 | · | · | · | 100 | · |
| LEN | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · |

T1 locks FILTER 1 FREQ: bar 1 none (kit value 40), bar 2 44, bar 3 48, bar 4 52. The bass pedals on E, the fifth of the key, and brightens bar by bar.

| T2 = T3 · bar 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | · | · | · | · | E3 | · | · | · | · | · |
| VEL | · | · | 88 | · | · | · | · | · | · | · | 88 | · | · | · | · | · |
| LEN | · | · | 0.5 | · | · | · | · | · | · | · | 0.5 | · | · | · | · | · |

| T2 = T3 · bar 2 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | · | · | · | · | E3 | · | · | · | · | · |
| VEL | · | · | 92 | · | · | · | · | · | · | · | 92 | · | · | · | · | · |
| LEN | · | · | 0.5 | · | · | · | · | · | · | · | 0.5 | · | · | · | · | · |

| T2 = T3 · bar 3 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | · | · | · | · | E3 | · | · | · | · | · |
| VEL | · | · | 96 | · | · | · | · | · | · | · | 96 | · | · | · | · | · |
| LEN | · | · | 0.5 | · | · | · | · | · | · | · | 0.5 | · | · | · | · | · |

| T2 = T3 · bar 4 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | · | · | · | · | E3 | · | · | · | · | · |
| VEL | · | · | 100 | · | · | · | · | · | · | · | 100 | · | · | · | · | · |
| LEN | · | · | 0.5 | · | · | · | · | · | · | · | 0.5 | · | · | · | · | · |

Track 4 is silent in Build A.

#### A4 pattern A05 · BUILD B (64 steps)

| T1 · bar 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · |
| VEL | · | · | 104 | · | · | · | 104 | · | · | · | 104 | · | · | · | 104 | · |
| LEN | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · |

| T1 · bar 2 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · |
| VEL | · | · | 104 | · | · | · | 104 | · | · | · | 104 | · | · | · | 104 | · |
| LEN | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · |

| T1 · bar 3 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · | · | · | E3 | · |
| VEL | · | · | 104 | · | · | · | 104 | · | · | · | 104 | · | · | · | 104 | · |
| LEN | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · |

*T1, bar 4: rest.*

T1 locks FILTER 1 FREQ 56 on every trig. No bass in bar 4.

| T2 = T3 · bar 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | E3 | · | E3 | · | E3 | · | E3 | · | E3 | · | E3 | · | E3 | · | E3 | · |
| VEL | 80 | · | 81 | · | 83 | · | 84 | · | 85 | · | 87 | · | 88 | · | 89 | · |
| LEN | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · |

| T2 = T3 · bar 2 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | E3 | · | E3 | · | E3 | · | E3 | · | E3 | · | E3 | · | E3 | · | E3 | · |
| VEL | 90 | · | 92 | · | 93 | · | 94 | · | 96 | · | 97 | · | 98 | · | 100 | · |
| LEN | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · |

| T2 = T3 · bar 3 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | E3 | · | E3 | · | E3 | · | E3 | · | E3 | · | E3 | · | E3 | · | E3 | · |
| VEL | 101 | · | 102 | · | 103 | · | 105 | · | 106 | · | 107 | · | 109 | · | 110 | · |
| LEN | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · |

| T2 = T3 · bar 4 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | E3 | · | E3 | · | E3 | · | E3 | · | · | · | · | · | · | · | · | · |
| VEL | 112 | · | 112 | · | 112 | · | 112 | · | · | · | · | · | · | · | · | · |
| LEN | 0.5 | · | 0.5 | · | 0.5 | · | 0.5 | · | · | · | · | · | · | · | · | · |

T2/T3 lock FILTER 1 FREQ per bar: 64, 70, 76, 82, and AMP DEL 70 on the bar-4 trigs. The stabs stop after step 55, leaving the last half bar to the snare roll and the riser.

| T4 riser · bar 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | E4 ⟶ | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| VEL | 100 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| LEN | 64 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |

*T4 riser, bar 2: the E4 from the previous bar is still held.*

*T4 riser, bar 3: the E4 from the previous bar is still held.*

| T4 riser · bar 4 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | lock |
| VEL | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | — |
| LEN | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | — |

Step 1 is a note trig with PARAMETER SLIDE on, LEN 64 steps, locking OSC 1 LEV 0, OSC 2 LEV 0, NOISE LEV 110, FILTER 1 FREQ 30 and AMP SUS 110. Step 64 is a lock trig with FILTER 1 FREQ 120 and NOISE LEV 120. The slide carries the filter from dark to bright across all four bars and the note ends exactly on the drop.



### Arrangement map

Each row is one arranger section. The Rytm and A4 columns name the pattern the arranger selects
at the section's first beat; "muted" mutes that instrument. Xone snapshots apply on the first
beat and hold until the next snapshot.

| Section | Bars | Bar range | Starts | Rytm | A4 | Xone snapshot | What happens |
|---|---|---|---|---|---|---|---|
| INTRO | 8 | 1–8 | 0:00.0 | A01 | muted | — | Drums only, DJ-friendly: kick, hats and the rim. |
| GROOVE | 8 | 9–16 | 0:15.5 | A02 | A01 | ch 2 FILTER → 2: LPF 900 Hz, RES 2 | Clap and open hats arrive; the bass enters muffled. |
| DROP 1 | 16 | 17–32 | 0:31.0 | A03 | A02 | ch 2 FILTER OFF | The filter opens and the chord stabs arrive together. |
| BREAK | 8 | 33–40 | 1:01.9 | A04 | A03 | — | Kick and bass leave; pads and the hook take over. |
| BUILD A | 4 | 41–44 | 1:17.4 | A05 | A04 | — | Kick returns; the bass pedals on E and brightens. |
| BUILD B | 4 | 45–48 | 1:25.2 | A06 | A05 | ch 1 FILTER → 1: HPF 140 Hz, RES 4 | Snare roll and noise riser over thinned drums; the last bar has no kick. |
| DROP 2 | 16 | 49–64 | 1:32.9 | A07 | A06 | ch 1 FILTER OFF | Everything, plus the full hook and the ride: the peak. |
| OUTRO A | 8 | 65–72 | 2:03.9 | A03 | A07 | — | Hook out, stabs for 4 bars only, bass to the end. |
| OUTRO B | 8 | 73–80 | 2:19.4 | A01 | muted | — | Drums only, mirroring the intro. |

Total: 80 bars = 2:34.8 at 124 BPM, plus about 2.5 s of delay and reverb tail. Song mode on, loop off.


Energy curve (1 = lowest, 5 = peak): Intro 2 · Groove 3 · Drop 1 4 · Break 1 · Build A 2 · Build B 3→4 ·
Drop 2 5 · Outro A 3 · Outro B 2.

### Mix

Reference: the kick soloed in Drop 1 reads about −17 LUFS-S and peaks about −8 dBFS on the studio
master with the limiter off.

| Part | Source | Level vs kick | Pan | Sends | Filter / EQ |
|---|---|---|---|---|---|
| Kick | Rytm BD | 0 dB | C | none | open |
| Clap | Rytm CP | −6 | C | Rytm REV 45 | HP ≈ 150 Hz |
| Open hat | Rytm OH | −12 | R8 | REV 10 | HP ≈ 390 Hz |
| Closed hats with ghosts | Rytm CH | −15 | R8 | — | HP ≈ 390 Hz |
| Rim | Rytm RS | −13 dry, echoes −18 | L20 | DEL 70, REV 20 | HP ≈ 250 Hz |
| Low tom | Rytm LT | −13 | L12 | DEL 25 | — |
| Ride (Drop 2) | Rytm CY | −15 | R25 | REV 15 | HP ≈ 550 Hz |
| Snare roll (end of Build B) | Rytm SD | −7 | C | REV 40 → 70 | HP rising 140 Hz → 1.1 kHz |
| Bass | A4 T1 | −2 | C | none | HP ≈ 31 Hz (rumble only) |
| Chord stabs | A4 T2 + T3 | −9 | L12 / R12 | CHO 40, DEL 60, REV 45 | HP ≈ 115 Hz |
| Break pad | A4 T2 + T3 | −8 | L12 / R12 | REV 100 | HP ≈ 115 Hz |
| Hook | A4 T4 | −7 | C | CHO 30, DEL 70, REV 50 | HP ≈ 300 Hz |
| Riser (end of Build B) | A4 T4 | −10 | C | as the hook | the slide itself |
| Delay returns | Rytm and A4 FX | −16 | wide | — | delay HPF 40–48 (echoes kept above the bass) |
| Reverb returns | Rytm and A4 FX | −18 | wide | — | reverb HPF 36–40 |

**Xone:96.**

| Channel | Source | GAIN | HI | HI MID | LO MID | LO | FILTER | Fader | SND 1 / SND 2 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Analog Rytm | ≈ +1 dB (meter peaks +3 to +6 in the drops) | −1 dB | 0 | −2 dB | 0 | per arrangement | 8.0 | 0 / 0 |
| 2 | Analog Four | ≈ 0 dB | −1.5 dB | +1.5 dB | −3 dB | 0 | per arrangement | 7.2 | 0 / 1.0 |
| A | Delay return | — | −3 dB | MID 0 | — | −12 dB | OFF | 5.0 | — |
| B | Reverb return | — | −2 dB | MID −2 dB at 400 Hz | — | −12 dB | OFF | 5.5 | — |

FX unit: DELAY 3/16, FDBK 4.0, REVERB 2.2 s, SEND 1 POST. FILTER 1: HPF, RES 4 (used in Build B).
FILTER 2: LPF, RES 2 (used in the Groove). MASTER 7.5, YOU HEAR MASTER.

No EQ cut on either LO: the bass lives on channel 2 and the kick on channel 1, and each is already
filtered at the source. The LO MID cut on channel 2 clears the 350 Hz region where stabs, bass
harmonics and the hook's body overlap. Most of the reverb and delay comes from the instruments'
own FX tracks, per track; the Xone reverb at SND 2 1.0 on channel 2 puts both machines in one
shared room. Optional performance: a dub throw, SND 1 up to 7 on channel 1 for the last beat of
bar 40, then back to 0.

Pans are set on the instruments: the Xone:96 has no pan controls, like most DJ mixers.
Kick, bass, clap and hook stay centred, so the low end and the lead hold up in mono.

### Master

- Mixdown headroom: pre-limiter peaks around −6 dBFS in Drop 2.
- Studio master limiter: CEILING −1.5 dBTP, DRIVE about +5 dB (adjust for the target), automatic
  release.
- Targets: **−10.5 LUFS integrated**, true peak ≤ −1.5 dBTP, short-term peak about −8.5 LUFS-S in
  Drop 2, LRA about 5 LU, largest gain reduction about 3 dB on kick peaks.
- Why −1.5 rather than −1.0 dBTP: this master is louder than −14 LUFS, and lossy encoders overshoot
  more on loud material (Spotify suggests −2 dBTP for masters above −14 LUFS). A −14 LUFS streaming
  version needs about 3.5 dB less DRIVE.
- Bounce: bars 1–80 plus the tail. Stems: Xone ch 1 (Rytm), ch 2 (A4), A (delay return), B (reverb
  return), pre-limiter.

### Teaching notes

| Section | What it teaches |
|---|---|
| INTRO | DJ-friendly: 8 bars of drums let a DJ (or a listener) lock onto the tempo. The rim's 1:2 condition shows how one trig condition turns a 1-bar loop into a 2-bar phrase. |
| GROOVE | The bass enters behind a low-pass filter, so it is felt before it is heard: adding a part doesn't have to mean adding brightness. |
| DROP 1 | Two things arrive on the same downbeat (the open filter and the chords). Changes that land together hit harder than changes spread out. |
| BREAK | Removing the kick and bass resets the ear. The pads use the same tracks as the stabs, turned into a pad by parameter locks, and avoid the home chord Am7 entirely, so the harmony itself creates tension. |
| BUILD A | A pedal on E, the fifth, wants to resolve to A. The bass brightens one filter step per bar: tension can rise without new notes. |
| BUILD B | Four tension signals at once: a denser, higher, thinner snare roll; a noise riser on a parameter slide; the drums high-passed by a snapshot; and a last bar without a kick. |
| DROP 2 | The release: kick, bass, the home chord and the full hook return on beat 1, and the ride adds one new element so this drop is the peak. |
| OUTRO A | Parts leave in reverse order of importance (hook, then chords). The stabs' 1:2 condition makes them stop halfway through the section without a new pattern. |
| OUTRO B | Mirrors the intro, so the track can be mixed out of as easily as into. |

### Why it works

- **Kick and bass take turns.** Every bass note sits between kicks and ends before the next one,
  and the kick is tuned to A, so the low end is one instrument, not two.
- **Four registers, four jobs.** Bass below 120 Hz, stabs around 150–400 Hz, hook above 400 Hz,
  hats above 400 Hz with high-passes. Nothing masks anything else.
- **The hemiola hook.** The hook's notes are three 16ths apart against a four-16th beat, and the
  dotted-8th delay repeats each note exactly where the next one lands, so a five-note phrase sounds
  like a cascade.
- **Harmony as tension.** The chord-memory stabs are diatonic (in A minor only A, D and E carry
  minor-seventh chords), the hook outlines each chord, and the break withholds Am7 until Drop 2.
- **Elektron variation without new patterns.** Conditions (1:2, 2:2, 4:4, 8:8, 1ST) and locks make
  16-step drum loops play like 8-bar phrases.

---

## Demo 2 · "Three Clocks" (Moog Sound Studio jam)

A hypnotic jam for the three Moog semi-modulars, all stepping on one 16th-note clock but on loops
of different lengths: the DFAM repeats every 2 beats, the Mother-32 every 3 beats and the
Subharmonicon's two sequencers every 4 beats and every 3 beats. Nothing is ever quite in the same
place twice, yet everything lines up every three bars, and every note comes from D minor
pentatonic so no collision can clash.

| | |
|---|---|
| Tempo | 110 BPM |
| Key | D minor pentatonic (D F G A C), with E as a passing colour in the percussion |
| Swing | none: the cross-rhythms are the groove |
| Length | 72 bars = 2:37.1, plus about 3 s of reverb tail |
| Master | −13 LUFS integrated, true peak ≤ −1.0 dBTP |
| Memory | none of the three has pattern memory: sections are arranger mutes plus knob snapshots |

### Studio setup and clock patch

Set `moog-sound-studio-mix` (new): Studio Clock, DFAM → Xone:96 channel 1, Mother-32 → channel 2,
Subharmonicon → channel 3, Xone channels A and B on RTN. Tempo 110 BPM.

| From | To | Why |
|---|---|---|
| Studio Clock CLOCK (CLOCK DIV 1/16, PULSE 5 ms) | DFAM ADV/CLOCK | one DFAM step per 16th |
| Studio Clock CLOCK (same output, stacked) | Mother-32 TEMPO | its default TEMPO input mode advances one step per rising edge |
| Studio Clock CLOCK (same output, stacked) | Subharmonicon CLOCK | replaces its internal clock, so the RHYTHM dividers divide 16ths |
| Studio Clock RESET | Mother-32 RESET | both sequencers start on step 1 when you press ▶ |
| Studio Clock RESET (stacked) | Subharmonicon RESET | |
| Mother-32 ASSIGN (set to ACCENT) | Mother-32 VCF CUTOFF | accented steps open the filter |
| DFAM VELOCITY (out) | DFAM VCA DECAY (in) | loud steps ring longer: the kicks bloom, the ticks stay short |

Splitting one clock output into several inputs is fine (stackable cables or a mult; Mother-32
owner's manual p.47). In the Studio tab, untick "Sync to studio clock" for the Mother-32 and the
Subharmonicon: the cables clock them. (Alternative: leave the Subharmonicon on MIDI-style sync and
skip its CLOCK cable. Under MIDI clock the hardware also runs its master clock at 16th notes,
4 pulses per quarter; Subharmonicon owner's manual p.24.)

**Before pressing ▶:** press DFAM ADVANCE until it sits on step 8, then RUN/STOP, so the first
pulse plays step 1. The studio ▶ starts the Mother-32 and the Subharmonicon, which then wait for
pulses. Instruments that a section mutes keep running underneath, so every loop keeps its place
relative to bar 1.

### Sound design

**DFAM · "clock kick"** (one voice playing kick, knock and tick through per-step pitch and velocity)

| Section | Settings |
|---|---|
| VCO 1 | WAVE TRI. FREQUENCY tuned so PITCH 0 plays A1 (55 Hz), about 1¼ octaves below noon |
| VCO 2 | WAVE SQR, FREQUENCY about +1½ octaves above VCO 1, LEVEL 0 (raised in LIFT), HARD SYNC OFF, 1→2 FM 0 (25 % in LIFT) |
| VCO EG | VCO DECAY 70 ms, VCO 1 EG AMOUNT +45 %, VCO 2 EG AMOUNT +20 %, SEQ PITCH MOD VCO 1&2 |
| Mixer | VCO 1 LEVEL 85 %, NOISE 12 % |
| VCF | LP, CUTOFF 1.4 kHz, RESONANCE 20 %, VCF DECAY 150 ms, VCF EG AMOUNT +35 %, NOISE/VCF MOD 0 |
| VCA | FAST, VCA DECAY 120 ms (the cable from VELOCITY adds length on loud steps: about 300 ms on the kicks), VOLUME 75 % |

The VCO EG sweep turns each low step into a thump; on the +12 to +24 steps it becomes a short
blip. With velocity driving VCA DECAY, one patch gives a long kick and short ticks.

**Mother-32 · "rotor bass"**

| Section | Settings |
|---|---|
| VCO | WAVE SAW. FREQUENCY tuned so the step written D2 sounds at 73.4 Hz. VCO MOD AMOUNT 0. GLIDE 35 ms (heard only on glide steps) |
| Mixer | MIX fully left (VCO only) |
| VCF | LP, CUTOFF 380 Hz, RESONANCE 40 %, VCF MOD SOURCE EG, VCF MOD AMOUNT +45 % (+55 % from LIFT) |
| EG and VCA | ATTACK minimum, DECAY 260 ms, SUSTAIN OFF; VCA MODE EG |
| Sequencer | 12 steps (SET END + step 12), GATE LENGTH 45 %, per-step accent and glide as in the grid |
| Output | VOLUME 70 % |

**Subharmonicon · "undertow"**

| Section | Settings |
|---|---|
| VCO 1 | FREQ D4 (293.7 Hz). SUB 1 ÷2 (an octave down), SUB 2 ÷3 (an octave and a fifth down). WAVE SQ/SAW |
| VCO 2 | FREQ A4 (440 Hz). SUB 1 ÷2, SUB 2 ÷4 (two octaves down). WAVE SAW |
| Mixer | VCO 1 30 %, VCO 1 SUB 1 45 %, VCO 1 SUB 2 30 %; VCO 2 35 %, VCO 2 SUB 1 30 %, VCO 2 SUB 2 15 % |
| Sequencers | SEQ 1 ASSIGN OSC on (VCO 1), SEQ 2 ASSIGN OSC on (VCO 2), SUB buttons off. SEQ OCT ±1, QUANTIZE 12-ET |
| Rhythm | RHYTHM 1 ÷4 → SEQ 1; RHYTHM 2 ÷3 → SEQ 2; RHYTHM 3 ÷5, assigned to SEQ 1 from UNDERTOW on; RHYTHM 4 unassigned; RHYTHM LOGIC OR |
| Filter | CUTOFF per section (450 Hz to 1.3 kHz), RESONANCE 35 % (45 % in LIFT, 55 % in UNDERTOW), VCF EG AMT +40 %, VCF ATTACK 2 ms, VCF DECAY 220 ms |
| VCA | VCA ATTACK 3 ms, VCA DECAY 600 ms, EG ON (HELD in UNDERTOW), VOLUME 65 % |

The ÷3 sub under VCO 1 adds a fifth below each note (D over G, A over D, G over C, C over F), so
the line carries its own quiet harmony. VCO 2's subs are plain octaves, so its melody stays clear.

### Sequences

#### DFAM · 8 steps at one step per 16th (a 2-beat loop)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| PITCH (semitones) | 0 | +24 | +12 | +24 | 0 | +19 | +7 | +24 |
| Heard as | A1 kick | A3 tick | A2 knock | A3 tick | A1 kick | E3 tick | E2 knock | A3 tick |
| VELOCITY (%) | 100 | 20 | 60 | 28 | 94 | 22 | 66 | 34 |

Steps 1 and 5 fall on every beat (the loop repeats twice per bar), so the DFAM is the 4/4 anchor that the other two machines play against.

#### Mother-32 · 12 steps at one step per 16th (a 3-beat loop)

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | D2 | · | D2 | · | F2 | D3 | · | C3 | · | A2 | G2 | · |
| Accent | A | · | · | · | · | A | · | · | · | · | · | · |
| Glide | · | · | · | · | · | G | · | · | · | · | G | · |

A = accent (patched from ASSIGN, set to ACCENT, into VCF CUTOFF: accented steps are brighter). G = glide on for that step. Rests are true rests (no gate). Set the end step with SET END + step 12.

Because 12 does not divide 16, the bass phrase starts on a different beat each time and realigns every 3 bars (48 sixteenths):

| M32 loop | Starts on | Position |
|---|---|---|
| cycle 1 | 16th #1 | bar 1, beat 1 |
| cycle 2 | 16th #13 | bar 1, beat 4 |
| cycle 3 | 16th #25 | bar 2, beat 3 |
| cycle 4 | 16th #37 | bar 3, beat 2 |

#### Subharmonicon · two 4-step sequencers on different clocks

| Sequencer | STEP 1 | STEP 2 | STEP 3 | STEP 4 | Clocked by |
|---|---|---|---|---|---|
| SEQ 1 (VCO 1, base D4) | 0 → D4 | +58 → A4 (+7) | +42 → G4 (+5) | −17 → C4 (−2) | RHYTHM 1 ÷4: one step per beat, 1 bar per cycle |
| SEQ 2 (VCO 2, base A4) | 0 → A4 | +25 → C5 (+3) | −17 → G4 (−2) | +42 → D5 (+5) | RHYTHM 2 ÷3: one step per dotted 8th, 3 beats per cycle |

Knob values assume SEQ OCT ±1 and QUANTIZE 12-ET, where ±100 spans ±12 semitones (so +58 ≈ +7). Tune by ear against the bass: each step should land exactly on the named note.

The resulting harmony over one full 3-bar cycle (bar.beat.16th; a new row whenever either sequencer steps). With SUB 1 ÷2 and SUB 2 ÷3 on VCO 1, and SUB 1 ÷2 and SUB 2 ÷4 on VCO 2:

| Position | VCO 1 layer (with subs) | VCO 2 layer (with subs) | Pitch classes | Heard as |
|---|---|---|---|---|
| 1.1.1 | D (D4 D3 G2) | A (A4 A3 A2) | D G A | Dsus4 |
| 1.1.4 | D (D4 D3 G2) | C (C5 C4 C3) | C D G | D7sus4 (no 5th) |
| 1.2.1 | A (A4 A3 D3) | C (C5 C4 C3) | C D A | Am(add4) |
| 1.2.3 | A (A4 A3 D3) | G (G4 G3 G2) | D G A | Dsus4 |
| 1.3.1 | G (G4 G3 C3) | G (G4 G3 G2) | C G | C5 (open fifth) |
| 1.3.2 | G (G4 G3 C3) | D (D5 D4 D3) | C D G | D7sus4 (no 5th) |
| 1.4.1 | C (C4 C3 F2) | A (A4 A3 A2) | C F A | F major |
| 1.4.4 | C (C4 C3 F2) | C (C5 C4 C3) | C F | F5 (open fifth) |
| 2.1.1 | D (D4 D3 G2) | C (C5 C4 C3) | C D G | D7sus4 (no 5th) |
| 2.1.3 | D (D4 D3 G2) | G (G4 G3 G2) | D G | G5 (open fifth) |
| 2.2.1 | A (A4 A3 D3) | G (G4 G3 G2) | D G A | Dsus4 |
| 2.2.2 | A (A4 A3 D3) | D (D5 D4 D3) | D A | D5 (open fifth) |
| 2.3.1 | G (G4 G3 C3) | A (A4 A3 A2) | C G A | Am7 (no 5th) |
| 2.3.4 | G (G4 G3 C3) | C (C5 C4 C3) | C G | C5 (open fifth) |
| 2.4.1 | C (C4 C3 F2) | C (C5 C4 C3) | C F | F5 (open fifth) |
| 2.4.3 | C (C4 C3 F2) | G (G4 G3 G2) | C F G | Csus4 |
| 3.1.1 | D (D4 D3 G2) | G (G4 G3 G2) | D G | G5 (open fifth) |
| 3.1.2 | D (D4 D3 G2) | D (D5 D4 D3) | D G | G5 (open fifth) |
| 3.2.1 | A (A4 A3 D3) | A (A4 A3 A2) | D A | D5 (open fifth) |
| 3.2.4 | A (A4 A3 D3) | C (C5 C4 C3) | C D A | Am(add4) |
| 3.3.1 | G (G4 G3 C3) | C (C5 C4 C3) | C G | C5 (open fifth) |
| 3.3.3 | G (G4 G3 C3) | G (G4 G3 G2) | C G | C5 (open fifth) |
| 3.4.1 | C (C4 C3 F2) | G (G4 G3 G2) | C F G | Csus4 |
| 3.4.2 | C (C4 C3 F2) | D (D5 D4 D3) | C D F | Dm7 (no 5th) |

Every pitch is from D minor pentatonic (D F G A C), and the pentatonic scale has no semitones, so no combination of the two sequencers can clash. That is what makes the polyrhythm safe.



### Arrangement map

With no pattern memory, each section is a set of arranger mutes plus knob snapshots: the
"DFAM", "Mother-32" and "Subharmonicon" columns list what each instrument's snapshot changes from
the settings above ("on" means unmuted with no changes). Snapshots apply on the section's first beat.

| Section | Bars | Bar range | Starts | DFAM | Mother-32 | Subharmonicon | What happens |
|---|---|---|---|---|---|---|---|
| CLOCKWORK | 8 | 1–8 | 0:00.0 | muted | muted | CUTOFF 450 Hz, RES 35 | The Subharmonicon alone: the 4-against-3 pattern reveals itself. |
| PULSE | 8 | 9–16 | 0:17.5 | on | muted | CUTOFF 650 Hz | The DFAM anchor arrives on every beat. |
| LOW END | 16 | 17–32 | 0:34.9 | on | on | CUTOFF 800 Hz | The 3-beat bass loop starts rotating against the bar. |
| LIFT | 8 | 33–40 | 1:09.8 | NOISE 30 %, VCO 2 LEVEL 30 %, 1→2 FM 25 % | CUTOFF 520 Hz, VCF MOD +55 | CUTOFF 1.3 kHz, RES 45 | Everything brightens; the DFAM turns metallic. |
| UNDERTOW | 8 | 41–48 | 1:27.3 | muted | muted | EG HELD, CUTOFF 900 Hz, RES 55, RHYTHM 3 ÷5 → SEQ 1 | A drone chord that keeps changing under you. |
| RETURN | 16 | 49–64 | 1:44.7 | back to the PULSE settings | on, VCF MOD +55 | EG ON, CUTOFF 1.0 kHz, RHYTHM 3 ÷5 still on SEQ 1 | All three, with a new composite rhythm: the peak. |
| DRIFT | 8 | 65–72 | 2:19.6 | VCA DECAY 150 ms | muted | CUTOFF 500 Hz | Bass out, the drums thin, the harmony closes. |

Total: 72 bars = 2:37.1 at 110 BPM, plus about 3 s of reverb tail. Song mode on, loop off.


Energy curve: Clockwork 1 · Pulse 2 · Low End 3 · Lift 4 · Undertow 2 · Return 5 · Drift 2.

Snapshot details:

- **RETURN** restores the DFAM to the PULSE settings (NOISE 12 %, VCO 2 LEVEL 0, FM 0) but keeps
  VCO 2 LEVEL at 15 % for a little metal, and keeps RHYTHM 3 ÷5 on SEQ 1. SEQ 1 now advances on
  every 4th and every 5th 16th (RHYTHM LOGIC OR), so the VCO 1 melody stutters into a new,
  irregular order while SEQ 2 keeps its steady 3-beat cycle.
- **UNDERTOW** sets the Subharmonicon EG to HELD: the envelopes stay open, so the sequencers keep
  changing pitch without re-articulating. The six oscillators become a drone chord that morphs
  every beat.
- **DRIFT** shortens the DFAM VCA DECAY to 150 ms (the kick loses its bloom) and closes the
  Subharmonicon to 500 Hz. On the hardware, a slow hand-ride of CUTOFF from 900 to 500 Hz across
  these 8 bars sounds better still; the snapshot is the reproducible version.

### Mix

Reference: the DFAM soloed in LOW END reads about −18 LUFS-S, with its kick steps peaking about
−9 dBFS on the studio master, limiter off.

| Part | Source | Level vs kick | Pan | Sends (Xone) | EQ |
|---|---|---|---|---|---|
| Kick steps (1, 5) | DFAM | 0 dB | C | SND 2 1.0 | LO +1 dB |
| Knocks and ticks (other steps) | DFAM | −10 to −16 (set by VELOCITY) | C | as above | HI −2 dB |
| Bass | Mother-32 | −3 | C | SND 2 0.5 | LO MID −3, HI MID +2 dB |
| Harmonic line | Subharmonicon | −8 | C | SND 1 3.5, SND 2 4.0 | LO −6 dB (shelf at 180 Hz) |
| Delay return | Xone ch A | −14 | stereo | — | LO −12 dB |
| Reverb return | Xone ch B | −15 | stereo | — | LO −12 dB, MID −3 dB at 400 Hz |

**Xone:96.**

| Channel | Source | GAIN | HI | HI MID | LO MID | LO | Fader | SND 1 / SND 2 |
|---|---|---|---|---|---|---|---|---|
| 1 | DFAM | ≈ +2 dB | −2 dB | 0 | −2 dB | +1 dB | 8.0 | 0 / 1.0 |
| 2 | Mother-32 | ≈ 0 dB | 0 | +2 dB | −3 dB | 0 | 7.0 | 0 / 0.5 |
| 3 | Subharmonicon | ≈ −2 dB | −1 dB | 0 | −2 dB | −6 dB | 6.5 | 3.5 / 4.0 |
| A | Delay return | — | −3 dB | MID 0 | — | −12 dB | 6.0 | — |
| B | Reverb return | — | −2 dB | MID −3 dB at 400 Hz | — | −12 dB | 6.0 | — |

FX unit: DELAY 3/16 (409 ms at 110 BPM), FDBK 4.5, REVERB 3.0 s, SEND 1 POST.

All three instruments are mono and the Xone:96 has no pan controls, so the dry parts are centred.
Width comes entirely from the stereo delay and reverb returns, which is why the Subharmonicon,
the part with the most space around it, sends the most. The Subharmonicon's LO shelf at −6 dB is
the key move: its ÷3 and ÷4 subharmonics reach down to 87–147 Hz, exactly where the Mother-32 bass
lives, so the shelf hands that range to the bass.

### Master

- Mixdown headroom: pre-limiter peaks around −6 dBFS in RETURN.
- Studio master limiter: CEILING −1.0 dBTP, DRIVE about +4 dB.
- Targets: **−13 LUFS integrated**, true peak ≤ −1.0 dBTP, LRA about 7 LU (the jam breathes more
  than the club tracks), largest gain reduction 2 dB or less.
- Bounce: bars 1–72 plus 3 s of tail. Stems: ch 1 DFAM, ch 2 Mother-32, ch 3 Subharmonicon, A and
  B returns, pre-limiter.

### Teaching notes

| Section | What it teaches |
|---|---|
| CLOCKWORK | A polyrhythm alone: SEQ 1 steps every beat, SEQ 2 every three 16ths, and the envelopes fire on both. Listen for the pattern that repeats every 3 beats inside a 4-beat bar. |
| PULSE | An anchor makes a polyrhythm readable. The DFAM's kicks on every beat tell the ear where the bar is, so the Subharmonicon's 3-step cycle now sounds like syncopation, not confusion. |
| LOW END | Polymeter: a 12-step bass over a 16-step bar starts on beat 1, then beat 4, then beat 3, then beat 2, and realigns after three bars. One rule keeps it musical: every note comes from one pentatonic scale. |
| LIFT | Energy without new notes: noise and FM on the DFAM, more filter movement on the bass and a brighter, more resonant Subharmonicon. Timbre is an arrangement tool. |
| UNDERTOW | EG HELD turns a sequencer into a slowly changing chord, and RHYTHM 3 ÷5 joins SEQ 1, so the harmony moves to a new, irregular clock. A break without silence. |
| RETURN | Everything back, with the ÷5 rhythm kept: the peak is familiar but not identical, which is the difference between a return and a repeat. |
| DRIFT | Fade by subtraction: the bass leaves, the kick shortens and the filter closes. |

### Why it works

- **One clock, many loop lengths.** Every part steps on the same 16th, so the cross-rhythms are
  locked, not drifting. The loops (2, 3 and 4 beats) all meet every 3 bars.
- **Pentatonic safety.** D minor pentatonic has no semitones, so any combination of the three
  instruments' notes is consonant: polyrhythm makes unplanned chords, and none of them clash.
- **Velocity as length.** One cable (VELOCITY → VCA DECAY) lets a single DFAM voice play both a long
  kick and short ticks.
- **Frequency slots for semi-modulars.** The DFAM owns 55 Hz on the beat, the Mother-32 owns
  73–147 Hz just above it with short, plucked notes, and the Subharmonicon is shelved out of that
  range and set back in the returns.

---

## Demo 3 · "Copper Wire" (Bass & drums)

Electro breaks for the Analog Rytm and the Sub 37: a broken, syncopated beat played dead straight,
a Moog bassline that fits into the gaps the kicks leave, laser "zaps" from the Rytm's synth
machine, tuned toms in the break, and a second Sub 37 preset that turns the bass into an
8th-note filter wobble.

| | |
|---|---|
| Tempo | 122 BPM |
| Key | G minor (G A Bb C D Eb F); the bass and zaps imply Gm with Bb, C, D and F movement |
| Swing | none: SWING 50 % on the Rytm, Sub 37 sequencer SWING 50 % |
| Length | 80 bars = 2:37.4, plus about 2 s of tail |
| Master | −11 LUFS integrated, true peak ≤ −1.5 dBTP |
| Patterns | Rytm A01–A06 (32 steps each), Sub 37 presets 1 and 2 with their own sequences |

### Studio setup

- **Set** `bass-and-drums`: Analog Rytm → Xone:96 channel 1, Sub 37 → channel 2, both synced to the
  studio clock. Xone A and B on RTN.
- **Tempo** 122 BPM. Rytm patterns are 32 steps (2 bars), NORMAL mode, 1X.
- **Sub 37 sequencer**: 32 steps, CLOCK DIV 1/16, GATE LENGTH 50 %, SWING 50 %, synced to the studio
  (MIDI clock). Each preset stores its own sequence, so switching presets switches the bassline.

### Sound design: Analog Rytm kit "COPPER"

| Track | Machine | Source (SRC page) | FLTR | AMP | Role |
|---|---|---|---|---|---|
| BD | BD CLASSIC | TUN set so the body sits on G1 (≈ 49 Hz), SWT 45, SWD 45, DEC 58, HLD 15, WAV SIN, a short click transient (TRA), LEV 115 | LP2 open | DEC INF, OVR 25, PAN C, VOL 115 | 808-style kick, medium length |
| SD | SD HARD | TUN +3, SWD 45, SWT 30, DEC 38, TIC 55, NOD 45, NOL 90, LEV 100 | HP2, FREQ 36 (≈ 110 Hz) | REV 25, VOL 100 | Cracking backbeat and ghosts |
| CP | CP CLASSIC | TON 80, NUM about halfway (4 claps), RAT 45, NOD 40, NOL 75, RND 30, CPD 45, LEV 100 | HP2, FREQ 44 (≈ 175 Hz) | REV 40, VOL 90 | Layered with the snare |
| RS | SY DUAL VCO | TUN so NOTE 0 plays G4, DET +7 (a fifth), BND +24 (each hit falls two octaves into pitch: the laser), DEC 25, DEC2 20, BAL 0, CFG a sine-saw plus sine mix, LEV 90 | LP2, FREQ 100 | DEL 55, REV 10, VOL 78 (PAN locked per trig) | Zaps |
| LT | XT CLASSIC | TUN to G2 (≈ 98 Hz), DEC 50, SWD 30, SWT 50, NOL 25, NOD 30 | LP2 open | DEL 40, PAN L15, VOL 86 | Tuned tom, root |
| MT | XT CLASSIC | TUN to D3 (≈ 147 Hz), DEC 50, SWD 30, SWT 50, NOL 25, NOD 30 | LP2 open | DEL 40, PAN R15, VOL 82 | Tuned tom, fifth |
| CH | CH CLASSIC | DEC 22, COL +10, LEV 100 | HP2, FREQ 62 (≈ 494 Hz) | PAN R10, VOL 80 | Straight 16ths |
| OH | OH CLASSIC | DEC 55, COL +10, LEV 100 | HP2, FREQ 62 | PAN R10, VOL 76 | Off-beat accent |
| CB | CB CLASSIC | TUN 0, DET 27 (the classic two-tone interval), DEC 30, LEV 90 | HP2, FREQ 60 | DEL 40, PAN L20, VOL 70 | Electro cowbell |

BT, HT and CY are unused (HT would share MT's voice and CY would share CB's).

**Rytm FX track.** DELAY: TIM 16 (an 8th, 246 ms), X on, WID +63, FDB 64, HPF 50, LPF 80, REV 20,
VOL 92. REVERB: PRE 8, DEC 40 (a short plate-like room), FRQ 90, GAI 90, HPF 50, LPF 90, VOL 80.
DISTORTION: AMT 20, SYM +6. COMPRESSOR: THR 92, ATK 1 ms, REL A1, MUP 14, RAT 1:4, SEQ OFF, MIX 127:
the whole kit punches together.

### Sound design: Sub 37

**Preset 1 · COPPER BASS**

| Section | Settings |
|---|---|
| Oscillators | OSC 1 16', WAVE SAW; OSC 2 16', WAVE SQR, FREQUENCY 0, BEAT FREQ +0.8 Hz (slow beating for width in mono); HARD SYNC off; KB RESET on (every note starts the same way: punch) |
| Mixer | OSC 1 85 %, SUB OSC 55 %, OSC 2 60 %, NOISE 0, FDBK/EXT 15 % |
| Filter | CUTOFF 260 Hz (snapshots set 210 / 300 / 340 Hz per section), RESONANCE 30 %, MULTIDRIVE 35 % (45 % in FINAL), KB AMT 50 %, EG AMT +55 % (+60 % in VERSE 2), SLOPE −24 dB |
| Filter EG | ATTACK 1 ms, DECAY 220 ms, SUSTAIN 10 %, RELEASE 120 ms, MULTI TRIG on, VEL AMT 60 % |
| Amp EG | ATTACK 1 ms, DECAY 400 ms, SUSTAIN 80 %, RELEASE 60 ms, MULTI TRIG on |
| Glide | ON, TIME 45 ms, TYPE LCT, LEGATO on, OSC 1+2 |
| Sequencer | sequence A (below); SEQ MOD destination filter cutoff, SEQ MOD AMT 35 % |
| Output | MASTER VOL 70 % |

**Preset 2 · COPPER WOBBLE**: preset 1 with CUTOFF 180 Hz, RESONANCE 45 %, EG AMT +20 %,
MULTIDRIVE 40 %, AMP EG SUSTAIN 100 % and RELEASE 80 ms, GLIDE TIME 90 ms; MOD 2: SOURCE TRI,
SYNC on at 1/8 (about 4.07 Hz at 122 BPM), FILTER AMT 45 %; sequence B.

The Sub 37's sequencer stores each step's note, velocity, rest or tie, and a per-step SEQ MOD
value; GATE LENGTH, CLOCK DIV and SWING are set per preset (Sub 37 manual v1.1, pp.17, 20 and 40).

### Patterns

#### Rytm A01 · INTRO (32 steps, 2 bars)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BD · bar 1 | 127 | · | · | · | · | · | 105 | · | · | · | 110 | · | · | · | · | · |
| BD · bar 2 | 127 | · | · | 72 | · | · | · | · | · | 108 | · | 84 | · | · | · | · |
| CH · bar 1 | 84 | 48 | 100 | 48 | 84 | 48 | 84 | 48 | 84 | 48 | 100 | 48 | 84 | 48 | · | 48 |
| CH · bar 2 | 84 | 48 | 100 | 48 | 84 | 48 | 84 | 48 | 84 | 48 | 100 | 48 | 84 | 48 | · | 48 |
| OH · bar 1 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 88 | · |
| OH · bar 2 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 88 | · |
| CB · bar 1 | · | · | · | 72 | · | · | · | · | · | 58 | · | · | · | · | · | · |
| CB · bar 2 | · | · | · | · | · | · | 66 [1:2] | · | · | · | · | · | · | · | · | · |

- Straight timing: SWING 50 % everywhere. Electro gets its funk from syncopation and accents, not swing.
- CB 23 [1:2] plays in the first 2-bar loop of every four bars.

#### Rytm A02 · BEAT A (32 steps)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BD · bar 1 | 127 | · | · | · | · | · | 105 | · | · | · | 110 | · | · | · | · | · |
| BD · bar 2 | 127 | · | · | 72 | · | · | · | · | · | 108 | · | 84 | · | · | · | · |
| SD · bar 1 | · | · | · | · | 118 | · | · | 38 | · | · | · | · | 118 | · | 44 | · |
| SD · bar 2 | · | · | · | · | 118 | · | · | 40 | · | · | · | · | 118 | · | 46 | 60 |
| CP · bar 1 | · | · | · | · | 96 | · | · | · | · | · | · | · | 96 | · | · | · |
| CP · bar 2 | · | · | · | · | 96 | · | · | · | · | · | · | · | 96 | · | · | · |
| RS · bar 1 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 84 | · |
| RS · bar 2 | · | · | 80 | · | · | · | · | · | · | · | 78 | · | · | · | · | · |
| CH · bar 1 | 84 | 48 | 100 | 48 | 84 | 48 | 84 | 48 | 84 | 48 | 100 | 48 | 84 | 48 | · | 48 |
| CH · bar 2 | 84 | 48 | 100 | 48 | 84 | 48 | 84 | 48 | 84 | 48 | 100 | 48 | 84 | 48 | · | 48 |
| OH · bar 1 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 88 | · |
| OH · bar 2 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 88 | · |
| CB · bar 1 | · | · | · | 72 | · | · | · | · | · | 58 | · | · | · | · | · | · |
| CB · bar 2 | · | · | · | · | · | · | 66 [1:2] | · | · | · | · | · | · | · | · | · |

- SD and CP hit together on the backbeat: a cracking snare with a clap's spread. Ghost snares on 8, 15, 24, 31, 32.
- RS runs the SY DUAL VCO machine as a laser 'zap'. NOTE locks: 15 = +0 (G), 19 = +3 (Bb), 27 = +7 (D). PAN locks: 15 L30, 19 R30, 27 L30.
- RS and CP share a voice. Each zap starts at least two steps after a clap, so it only trims the end of the clap tail.

#### Rytm A03 · BREAK (32 steps)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| LT · bar 1 | 100 | · | · | 70 | · | · | 84 | · | · | · | 90 | · | · | · | · | · |
| LT · bar 2 | 100 | · | · | 70 | · | · | 84 | · | · | 76 | · | · | · | · | · | · |
| MT · bar 1 | · | · | · | · | · | · | · | · | 80 | · | · | · | · | 72 | · | · |
| MT · bar 2 | · | · | · | · | · | · | · | · | 80 | · | · | · | · | 72 | · | 64 |
| CH · bar 1 | 52 | 34 | 52 | 34 | 52 | 34 | 52 | 34 | 52 | 34 | 52 | 34 | 52 | 34 | · | 34 |
| CH · bar 2 | 52 | 34 | 52 | 34 | 52 | 34 | 52 | 34 | 52 | 34 | 52 | 34 | 52 | 34 | · | 34 |
| OH · bar 1 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 70 | · |
| OH · bar 2 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 70 | · |
| RS · bar 1 | · | · | · | · | · | 70 [1:2] | · | · | · | · | · | · | · | · | 84 | · |
| RS · bar 2 | · | · | 80 | · | · | · | · | · | · | · | 78 | · | · | · | · | · |

- No kick, snare or clap. The toms are tuned: LT to G2, MT to D3 (the root and fifth). LT 11 locks NOTE +3 (Bb2).
- Zap NOTE locks as A02, plus 6 = +10 (F) on odd loops. Zaps lock AMP DEL 70 here; toms send DEL 40 from the kit.

#### Rytm A04 · BEAT B (32 steps)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BD · bar 1 | 127 | · | · | · | · | · | 105 | · | · | · | 110 | · | · | 64 | · | · |
| BD · bar 2 | 127 | · | · | 72 | · | · | · | · | 70 | 108 | · | 84 | · | · | · | · |
| SD · bar 1 | · | · | · | · | 118 | · | · | 38 | · | · | · | · | 118 | · | 44 | · |
| SD · bar 2 | · | · | · | · | 118 | · | · | 40 | · | · | · | · | 118 | · | 46 | 60 |
| CP · bar 1 | · | · | · | · | 96 | · | · | · | · | · | · | · | 96 | · | · | · |
| CP · bar 2 | · | · | · | · | 96 | · | · | · | · | · | · | · | 96 | · | · | · |
| RS · bar 1 | · | · | 70 [1:2] | · | · | · | · | · | · | · | · | · | · | · | 84 | · |
| RS · bar 2 | · | · | 80 | · | · | · | · | · | · | · | 78 | · | · | · | · | · |
| CH · bar 1 | 84 | 48 | 100 | 48 | 84 | 48 | 84 | 48 | 84 | 48 | 100 | 48 | 84 | 48 | · | 48 |
| CH · bar 2 | 84 | 48 | 100 | 48 | 84 | 48 | 84 | 48 | 84 | 48 | 100 | 48 | 84 | 48 | · | 48 |
| OH · bar 1 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 88 | · |
| OH · bar 2 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 88 | · |
| CB · bar 1 | · | · | · | 72 | · | · | · | · | · | 58 | · | · | · | · | · | · |
| CB · bar 2 | · | 62 | · | · | · | · | 66 | · | · | · | · | 60 [2:2] | · | · | · | · |
| LT · bar 2 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 80 [1:2] |

- A02 plus two soft extra kicks (14, and 25 doubling into 26), a high zap on 3 (NOTE +12) on odd loops, more cowbell and a tom pickup. The extra kicks sit on steps the bass leaves empty.

#### Rytm A05 · BREAKDOWN (32 steps)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BD · bar 1 | 127 [1ST] | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| CP · bar 1 | · | · | · | · | 100 | · | · | · | · | · | · | · | 100 | · | · | · |
| CP · bar 2 | · | · | · | · | 100 | · | · | · | · | · | · | · | 104 | · | · | · |
| RS · bar 1 | · | · | 76 | · | · | · | · | · | · | · | · | · | · | · | 84 | · |
| RS · bar 2 | · | · | 80 | · | · | · | · | · | · | · | 78 | · | · | · | 70 | · |
| OH · bar 1 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 80 | · |
| OH · bar 2 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 80 | · |

- BD 1 [1ST]: one impact at the start of the breakdown.
- CP 29 locks AMP REV 90: the last clap of each loop blooms into the reverb.
- Zaps: 3 = +12, 15 = +0, 19 = +3, 27 = +7, 31 = +10, all locking AMP DEL 90 so the echoes carry the groove.

#### Rytm A06 · FINAL (32 steps)

| Track | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BD · bar 1 | 127 | · | · | · | · | · | 105 | · | · | · | 110 | · | · | 64 | · | · |
| BD · bar 2 | 127 | · | · | 72 | · | · | · | · | 70 | 108 | · | 84 | · | · | · | · |
| SD · bar 1 | · | · | · | · | 118 | · | · | 38 | · | · | · | · | 118 | · | 44 | · |
| SD · bar 2 | · | · | · | · | 118 | · | · | 40 | · | · | · | · | 118 | · | 46 | 60 |
| CP · bar 1 | · | · | · | · | 96 | · | · | · | · | · | · | · | 96 | · | · | · |
| CP · bar 2 | · | · | · | · | 96 | · | · | · | · | · | · | · | 96 | · | · | · |
| RS · bar 1 | · | · | 70 [1:2] | · | · | · | · | · | · | · | · | · | · | · | 84 | · |
| RS · bar 2 | · | · | 80 | · | · | · | · | · | · | · | 78 | · | · | · | · | · |
| CH · bar 1 | 84 | 48 | 100 | 48 | 84 | 48 | 84 | 48 | 84 | 48 | 100 | 48 | 84 | 48 | · | 48 |
| CH · bar 2 | 84 | 48 | 100 | 48 | 84 | 48 | 84 | 48 | 84 | 48 | 100 | 48 | 84 | 48 | · | 48 |
| OH · bar 1 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 88 | · |
| OH · bar 2 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 88 | · |
| CB · bar 1 | · | · | · | 72 | · | · | · | · | · | 58 | · | · | · | · | · | · |
| CB · bar 2 | · | 62 | · | · | · | · | 66 | · | · | · | · | 60 [2:2] | · | · | · | · |
| MT · bar 2 | · | · | · | · | · | · | · | · | · | · | · | 80 [4:4] | · | 88 [4:4] | · | 100 [4:4] |
| LT · bar 2 | · | · | · | · | · | · | · | · | · | · | · | · | 96 [4:4] | · | 104 [4:4] | · |

- A04 plus a tom roll every 8 bars: [4:4] counts 2-bar loops, so it fires in bars 7–8 and 15–16 of the section.
- LT 32 [1:2] from A04 is dropped here; MT takes step 32 in the fill.

#### Sub 37 preset 1 · COPPER BASS, sequence A (32 steps, CLOCK DIV 1/16)

| Seq A · bar 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | rest | rest | G1 | G2 | rest | Bb1 | rest | rest | D2 | C2 | rest | rest | G1 | rest | F2 | G2 |
| VEL | · | · | 110 | 70 | · | 100 | · | · | 104 | 96 | · | · | 100 | · | 96 | 88 |
| TIE | · | · | · | · | · | · | · | · | TIE | · | · | · | · | · | · | · |
| SEQ MOD | · | · | +60 | 0 | · | 0 | · | · | +60 | 0 | · | · | 0 | · | 0 | 0 |

| Seq A · bar 2 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | rest | rest | G1 | rest | rest | Bb1 | C2 | D2 | rest | rest | F2 | rest | G1 | Bb1 | D2 | C2 |
| VEL | · | · | 110 | · | · | 100 | 96 | 100 | · | · | 96 | · | 104 | 90 | 100 | 92 |
| TIE | · | · | · | · | · | · | · | · | · | · | · | · | TIE | · | TIE | · |
| SEQ MOD | · | · | +60 | · | · | 0 | 0 | 0 | · | · | 0 | · | +60 | 0 | 0 | 0 |

TIE joins a step to the next one: into the same note it lengthens it, into a different note it plays legato, and with GLIDE ON and LEGATO on, the pitch slides (D2 to C2 on 9–10, G1 to Bb1 on 29–30, D2 to C2 on 31–32). SEQ MOD +60 on 3, 9, 19 and 29, routed to filter cutoff, opens those notes a little: the accents. Kick steps in Beat A are 1, 7, 11, 17, 20, 26 and 28 (Beat B adds 14 and 25); the bass avoids all of them.

#### Sub 37 preset 2 · COPPER WOBBLE, sequence B (32 steps)

| Note | Steps (tied through) | VEL |
|---|---|---|
| G1 | 1–8 | 100 |
| Bb1 | 9–12 | 100 |
| C2 | 13–16 | 100 |
| G1 | 17–24 | 100 |
| D2 | 25–28 | 100 |
| C2 | 29–31 | 100 |
| Bb1 | 32 | 100 |

Each note is one step tied through the following steps, and each note ties into the next, so the whole bar is legato and the glide links every change. The rhythm comes from the filter LFO, not the notes.



### Arrangement map

The Sub 37 column is the snapshot applied at the section start: the preset to load (which also
loads its sequence), then any knob overrides. If preset switching from a snapshot is not available
on the twin, mute the Sub 37 in BREAK and BREAKDOWN instead.

| Section | Bars | Bar range | Starts | Rytm | Sub 37 snapshot | Xone snapshot | What happens |
|---|---|---|---|---|---|---|---|
| INTRO | 8 | 1–8 | 0:00.0 | A01 | muted | — | Kick, hats and cowbell only. |
| VERSE 1 | 16 | 9–24 | 0:15.7 | A02 | preset 1, CUTOFF 210 Hz | — | Snare, clap and zaps arrive with the bass, slightly closed. |
| BREAK | 8 | 25–32 | 0:47.2 | A03 | preset 2 (wobble) | — | Toms and zaps; the bass holds long notes and wobbles in 8ths. |
| VERSE 2 | 16 | 33–48 | 1:03.0 | A04 | preset 1, CUTOFF 300 Hz, EG AMT +60 | — | Busier beat; the bass opens up. |
| BREAKDOWN | 8 | 49–56 | 1:34.4 | A05 | preset 2, CUTOFF 240 Hz | ch 1 FILTER → 2: LPF 2.5 kHz | Claps and echoing zaps over the wobble. |
| FINAL | 16 | 57–72 | 1:50.2 | A06 | preset 1, CUTOFF 340 Hz, MULTIDRIVE 45 | ch 1 FILTER OFF | Everything, with tom fills every 8 bars: the peak. |
| OUTRO | 8 | 73–80 | 2:21.6 | A01 | muted | — | Back to the intro drums. |

Total: 80 bars = 2:37.4 at 122 BPM, plus about 2 s of tail. Song mode on, loop off.


Energy curve: Intro 2 · Verse 1 3 · Break 2 · Verse 2 4 · Breakdown 2 · Final 5 · Outro 2.

**Harmony, spelled out.** There are no chords; the bass and the zaps imply them.

| Where | Notes | Implied chord |
|---|---|---|
| Sequence A, bar 1 | G1 G2 Bb1 D2→C2 G1 F2 G2 | Gm (G Bb D), with F and C as passing tones |
| Sequence A, bar 2 | G1 Bb1 C2 D2 F2 G1→Bb1 D2→C2 | Gm climbing through C and D, then a fall from D to C into the bar line |
| Zaps | G4, Bb4, D5 (+0, +3, +7), with F5 (+10) and G5 (+12) in some sections | the Gm triad, plus the minor seventh |
| Toms (break) | G2, D3, Bb2 | Gm (root, fifth, third) |
| Sequence B (wobble) | G1 · Bb1 · C2 · G1 · D2 · C2 · Bb1 | i – III – iv – i – v – iv – III: Gm, Bb, Cm, Gm, Dm, Cm, Bb |

### Mix

Reference: the kick soloed in VERSE 1 reads about −16 LUFS-S and peaks about −7 dBFS on the studio
master, limiter off.

| Part | Source | Level vs kick | Pan | Sends | Filter / EQ |
|---|---|---|---|---|---|
| Kick | Rytm BD | 0 dB | C | none | open |
| Snare + clap | Rytm SD + CP | −4 | C | REV 25 / 40 | HP ≈ 110 / 175 Hz |
| Closed hats | Rytm CH | −15 | R10 | — | HP ≈ 490 Hz |
| Open hat | Rytm OH | −12 | R10 | — | HP ≈ 490 Hz |
| Cowbell | Rytm CB | −14 | L20 | DEL 40 | HP ≈ 440 Hz |
| Zaps | Rytm RS | −11 | L30 / R30 alternating | DEL 55 (70–90 in the breaks) | LP ≈ 4.4 kHz |
| Toms (break) | Rytm LT / MT | −8 | L15 / R15 | DEL 40 | — |
| Bass | Sub 37 | −1 | C | none | Xone LO MID −3, HI −2 dB |
| Delay return | Rytm FX | −16 | wide | — | delay HPF 50 (echoes kept above the bass) |
| Reverb return | Rytm FX | −20 | wide | — | reverb HPF 50 |

**Xone:96.**

| Channel | Source | GAIN | HI | HI MID | LO MID | LO | FILTER | Fader | SND 1 / SND 2 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Analog Rytm | ≈ +1 dB | 0 | +1 dB | −2 dB | 0 | per arrangement | 8.0 | 0 / 0.5 |
| 2 | Sub 37 | ≈ 0 dB | −2 dB | +1.5 dB | −3 dB | 0 | OFF | 7.5 | 0 / 0 |
| A | Delay return | — | −3 dB | MID 0 | — | −12 dB | OFF | 4.0 | — |
| B | Reverb return | — | −2 dB | MID −2 dB at 500 Hz | — | −12 dB | OFF | 4.0 | — |

FX unit: DELAY 1/8, FDBK 3.5, REVERB 1.6 s. FILTER 2: LPF 2.5 kHz, RES 3 (used in BREAKDOWN).

The bass is the loudest part after the kick, as electro wants. The HI MID lift on the Sub 37 at
1.1 kHz is for small speakers: phones can't play 49–98 Hz, so the ear finds the bass through its
upper harmonics. The kick and bass share no steps (see the sequence notes), so neither needs to be
ducked.

### Master

- Mixdown headroom: pre-limiter peaks around −6 dBFS in FINAL.
- Studio master limiter: CEILING −1.5 dBTP, DRIVE about +5 dB.
- Targets: **−11 LUFS integrated**, true peak ≤ −1.5 dBTP, LRA about 5 LU, largest gain reduction
  about 3 dB.
- Bounce: bars 1–80 plus 2 s. Stems: ch 1 Rytm, ch 2 Sub 37, A and B returns, pre-limiter.

### Teaching notes

| Section | What it teaches |
|---|---|
| INTRO | A broken beat can still be DJ-friendly: the kick pattern repeats every two bars, so the phrase is easy to count. Straight timing is a style choice. |
| VERSE 1 | Kick and bass interlock: every bass note sits on a step the kick leaves free, so a busy bassline and a busy kick never collide. The filter starts slightly closed to leave room for Verse 2. |
| BREAK | The Rytm becomes melodic: toms tuned to G and D, zaps pitched with NOTE locks. A preset change swaps the bassline for a sustained wobble. |
| VERSE 2 | The same bassline, brighter (CUTOFF up, more EG AMT): a sound-design change reads as a new section. |
| BREAKDOWN | Space as rhythm: the zaps' delay echoes and a reverb-locked clap carry the groove while the drums are low-passed on the Xone. |
| FINAL | The peak: a tom roll every 8 bars from [4:4] conditions, more drive on the bass, and the drums opened up again by a snapshot. |
| OUTRO | Bass out on a bar line, drums back to the intro pattern for mixing out. |

### Why it works

- **Interlocking, not stacking.** The kick and bass divide the 16ths between them, which is the
  electro way to get a huge low end with no sidechain.
- **Straight and syncopated.** No swing; the funk comes from where the hits fall (the off-16th
  kicks, the cowbell, the ghost snares) and from accents (SEQ MOD, velocities).
- **The Rytm as a synth.** SY DUAL VCO zaps and tuned toms give the track melody and call and
  response without a third instrument.
- **One preset, two roles.** Switching Sub 37 presets per section turns the bass from a plucked
  line into a sustained wobble, a whole new part at no cost.

---

## Shipping the demos

**Projects.** Each demo becomes a bundled project (studio doc + instrument data) that opens with
one press, plus a pre-rendered WAV of the master for the lesson hooks (so excerpts play instantly
and identically on slow devices).

**Delivery checklist (each demo).**

1. Every pattern, preset and snapshot entered as specified; arranger song mode on, loop off.
2. Gain staging: every Xone channel peaks +3 to +6 with no PK; pre-limiter master peaks about −6 dBFS.
3. Levels checked against the mix table by soloing each part against the kick.
4. Mono check (BOOTH MONO, YOU HEAR BOOTH): the kick, bass and lead hold their level.
5. Master: limiter on, integrated loudness and true peak on target over the full length.
6. Bounce from bar 1 through the tail; bounce stems with the limiter bypassed; confirm the stems sum
   to the pre-limiter mix.
7. Listen through once on headphones and once on small speakers.

**How the curriculum uses them.**

| Lesson | Excerpt |
|---|---|
| L1 First beat | Demo 1, bars 17–20, Rytm only |
| L2 Groove | Demo 1 drums, bars 17–20, straight and as made |
| L3 Bass and kick | Demo 1, bars 9–12, kick and bass |
| L4 One clock | Demo 2, bars 9–12 |
| L5 Chords | Demo 1, bars 15–18 |
| L6 Hook | Demo 1, bars 49–52 |
| L7 Frequency slots | Demo 1, bars 17–20, as made and without high-passes |
| L8 Movement | Demo 1, bars 17–24 |
| L9 Space | Demo 1, bars 33–36 |
| L11 Arrangement | Demo 1, bars 29–36 |
| L12 Transitions | Demo 1, bars 45–49 |
| L13 Mixdown | Demo 1, bars 49–52, as mixed and with the kick down |
| L14 Master | Demo 1 master against a crushed version, loudness-matched |
| L15 Capstone | 10 s of each demo |

**Facts checked against the manuals** (our own words; see `curriculum.md` §7.7 for page references):
Rytm voice sharing (RS/CP, MT/HT, CH/OH, CY/CB), swing trigs, retrig rates, parameter slide, trig
conditions, delay time units and the compressor's sidechain EQ; A4 parameter slide, swing, poly
configuration and pattern extension; the Sub 37 sequencer's ties, rests, ratchets, SEQ MOD,
GATE LENGTH, CLOCK DIV and SWING, and LFO clock sync; the Subharmonicon's clock input and its
16th-note master clock under MIDI; the Mother-32's one-step-per-pulse TEMPO input, 32-step
patterns and per-step accent and glide; the DFAM's ADV/CLOCK input; the Xone:96 EQ ranges and
its lack of pan controls. The DFAM patch sheets' idea of per-step decay (there via the PITCH
output) inspired the VELOCITY → VCA DECAY cable in Demo 2; the patch itself is new.
