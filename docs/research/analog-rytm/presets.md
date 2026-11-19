# Analog Rytm MKII: kits and patterns for the twin (v2, checked against the OS 1.72 manual)

All values are in **hardware display units**, as defined in `signal-flow.md`:
- Parameters are given **by their screen label**. Their encoder positions are in `signal-flow.md` §4–5 and §9 (verified from the manual, p.78–109).
- TUN is in semitones on BD, SD and RS machines (manual p.97–102); rytm-rs gives ±32, or ±24 where noted.
- TUN reads −64…+63 on toms, hats, cymbals and cowbells.
- PAN, ENV, BAL, SYM and COL are bipolar (PAN −64…+63, p.79).
- Everything else is 0–127 unless noted.
- Parameters not listed are at **init**: see `signal-flow.md` and `sources.md` §6.
- BD CLASSIC **TRA** values are raw values (CC 0–55). The screen shows them as transient codes such as "C1" (p.97).

---

## 1. Factory content

**Verified (manual):**

| Fact | Ref |
|---|---|
| The MKII ships with preset patterns, kits and Sounds. A01 is the first demo pattern, A02 the second, and so on. The factory kits contain preset performance macros (dim green pads) and scenes (dim blue pads). | p.19 |
| Patterns **A01–B16** (32 patterns) hold the factory content by default | p.20 |
| A factory reset rewrites +Drive project slot 1 with the factory patterns, kits, Sounds and settings, and rewrites **Sound bank A** of the +Drive library with the factory Sounds | p.70 |
| The +Drive sample bank has a write-protected **FACTORY** directory with ten subdirectories, for example PERCUSSION | p.58 |

**Not verified:** the *names* of the factory kits and patterns, and of Elektron's sound packs. They are not in the manual, elektron.se was blocked, and the search budget ran out.
- Don't credit names until they are checked on elektron.se (Support → Analog Rytm MKII → Downloads; Explore → Sound packs).
- If the twin needs a factory-style bank, populate A01–B16 with the designs below, under their own descriptive names, and describe them as "factory-style demo patterns". Don't name them after Elektron's.

Nothing here reproduces a commercial recording's pattern; the grooves are genre archetypes. Kit 01's test groove follows the manual's quick-start example (p.20).

---

## 2. Notation

**Header.** `Category / Name`, then a tag:
- **Recreation of …**: rebuilds a known reference. Kit 01 is the device's init kit; Kits 13 and 14 rebuild the *character* of the classic Roland TR voices with Rytm machines (no samples).
- **New**: an original design.

Each header also gives tempo (BPM), swing, pattern length and speed.

**Track rows:**
```
TRK · MACHINE · SRC (non-init values) · FLTR · AMP · LFO / notes
```
Pans: − is left, + is right.

**Pattern grids.** Each character is one step. Groups of 4 = one beat of 16ths. `|` separates bars.

| Symbol | Meaning | VEL |
|---|---|---|
| `X` | Accented hit | **127** |
| `x` | Normal | **100** |
| `o` | Soft | **75** |
| `g` | Ghost | **45** |
| `-` | No trig | |

Under each grid, **Locks / conditions** lists per-step extras, using 1-based step numbers:
- `cond` is a trig condition.
- `µ` is micro timing in 1/384 notes (±23).
- `retrig` is written rate / length / curve.
- `lock` is a parameter lock, written PAGE PARAM = value.

Tracks with no grid row have no trigs.

**Voice-sharing rule.** In every kit, no two tracks that share a voice (RS/CP, MT/HT, CH/OH, CY/CB) trig on the same step.
- On hardware, a same-step clash goes to the right-hand track (p.21), so the left track's hit would be lost.
- Where one track cuts the other a step or more later, the note says so: that choke is part of the sound.

**Conversion to `docs/ELEKTRON_SEQUENCER.md` data**

| Grid | Sequencer field |
|---|---|
| step n | `steps[n-1]` |
| symbol | `vel` |
| `cond` | `cond` string ("1:4", "50%", "FILL"…) |
| `µ` | `micro` |
| `retrig 1/32 · 1/16 · −40` | `retrig: { rate: 12, len: 14, vel: −40 }`. RETRIG_RATES index: 1/16 = 9, 1/24 = 11, 1/32 = 12, 1/48 = 14, 1/64 = 15. NOTE_LENGTHS: 1/32 = 6, 1/16 = 14, 1/8 = 30, 1/4 = 46. |
| `lock X = v` | `locks: { key: v }`, using the twin's control key. PAGE PARAM uses screen labels: TRIG NOT, SRC DEC, FLTR FRQ, AMP REV… |

The TRIG page values become the track defaults (`note: 60 + NOT`, `vel: 100`, `len: 14` unless stated). A JSON example is at the end.

---

## 3. Kits

### 01 · Init / Rytm Init Kit
**Recreation of the Analog Rytm FW 1.70 init kit** (machines and values from rytm-rs defaults, **likely**; BD HARD as the BD default is verified, p.22) · 120 BPM · swing 50 % · 16 steps · 1x

This is the reference state for lessons and the "reset" target. On hardware an init pattern is empty. The test groove below follows the manual's quick-start example pattern (p.20): kick on 1, 5, 9 and 13, snare on 5 and 13, hat on 3, 7, 11 and 15.

| Trk | Machine | SRC (all init; screen order per `signal-flow.md` §9) |
|---|---|---|
| BD | BD HARD | TUN −3 · SWT 90 · SNP 6 · DEC 47 · WAV SIN · HLD 40 · TIC 64 · LEV 100 |
| SD | SD HARD | TUN 0 · SWT 43 · SWD 127 · DEC 76 · TIC 64 · NOD 32 · NOL 64 |
| RS | RS HARD | TUN 0 · SWT 34 · SWD 127 · DEC 52 · SYM 64 · TIC 48 · NOL 8 |
| CP | CP CLASSIC | LEV 115 · TON 64 · NOD 55 · NUM 2 · RAT 85 · NOL 90 · RND 32 · CPD 90 |
| BT | BT CLASSIC | TUN +16 · DEC 63 · NOL 0 · SNP 1 · SWD 0 |
| LT · MT · HT | XT CLASSIC | TUN +34 / +44 / +50 · DEC 52 / 70 / 89 · SWD 36 / 42 / 50 · SWT 34 / 29 / 27 · NOD 5 · NOL 85 / 100 / 100 · TON 0 |
| CH · OH | CH CLASSIC · OH CLASSIC | TUN 0 · DEC 32 · COL 0 |
| CY | CY CLASSIC | LEV 127 · TUN 0 · DEC 64 · COL 0 · TON 0 |
| CB | CB CLASSIC | TUN +1 · DEC 20 · DET 64 · PW1 0 · PW2 0 |

Every track also has the following at init:
- **FLTR**: ATK 0 · DEC 64 · SUS 0 · REL 64 · FRQ 127 · RES 0 · LP2 · ENV 0.
- **AMP**: ATK 0 · HLD AUTO · DEC INF · OVR 0 · DEL 0 · REV 0 · PAN 0 · VOL 110. (HLD raw 0 = AUTO, p.79.)
- **LFO**: SPD 48 · MUL ×16 (×16 is verified on the p.80 screen) · FAD 0 · DST NONE · WAV TRI · SPH 0 · MOD FREE · DEP 0.
- **SMPL**: SMP OFF.
- **Sound settings**: ACCENT 32 · AT slot 1 = +16 → FLT FRQ · VEL→VOL ON · ENV RESET FILTER (the default, p.34) · CHROMATIC SYN+SMP.

**FX (init):**
- DELAY TIM 23 · X OFF · WID 0 · FDB 49 · HPF 32 · LPF 96 · REV 0 · VOL 110.
- REVERB PRE 8 · DEC 40 · FRQ 64 · GAI 32 · HPF 32 · LPF 96 · VOL 110.
- DIST AMT 0 · SYM 0 · DOV 0 · **DEL PRE · REV POST** (the defaults, p.82).
- COMP THR 96 · ATK 0.03 · REL 0.4 · MUP 0 · RAT 1:2 · SEQ LPF · **MIX 0** · VOL 64.

All values are rytm-rs init values (L) except the DIST defaults, which are verified.

```
BD  X--- x--- X--- x---
SD  ---- x--- ---- x---
CH  --x- --x- --x- --x-
```

---

### 02 · Techno / Warehouse 130
**New** · 130 BPM · swing 52 % · 16 steps

A driving peak-time kick with click and drive. The open hats are cut by closed hats (choke) and the clap goes into the reverb. The compressor is keyed by the low end, so the bus pumps.

| Trk | Machine | SRC | FLTR | AMP | Notes |
|---|---|---|---|---|---|
| BD | BD HARD | TUN −2 · DEC 58 · HLD 26 · SWT 52 · SNP 28 · WAV SIN · TIC 88 | – | OVR 32 · VOL 118 | |
| SD | SD HARD | TUN +4 · DEC 48 · SWD 96 · TIC 72 · NOD 44 · NOL 84 · SWT 38 | – | REV 24 · VOL 96 | Fill only |
| RS | RS HARD | TUN +6 · DEC 26 · SWD 80 · TIC 70 · NOL 16 · SWT 20 | – | DEL 64 · PAN −18 · VOL 92 | Shares voice with CP |
| CP | CP CLASSIC | TON 72 · NOD 48 · NUM 3 · RAT 82 · NOL 80 · RND 40 · CPD 70 | HP1 FRQ 34 | REV 44 · VOL 104 | |
| LT | XT CLASSIC | TUN +28 · DEC 58 · SWD 44 · SWT 30 · NOL 70 | – | DEL 40 · PAN +20 · VOL 90 | |
| CH | CH CLASSIC | TUN +12 · DEC 16 · COL +18 | HP2 FRQ 72 RES 10 | PAN +10 · VOL 92 | |
| OH | OH CLASSIC | TUN +12 · DEC 52 · COL +18 | HP2 FRQ 72 RES 10 | REV 16 · PAN +10 · VOL 98 | |
| CY | CY CLASSIC | DEC 96 · COL +8 · TON +16 | HP1 FRQ 50 | REV 30 · VOL 80 | |

**FX:**
- DELAY TIM 24 (dotted 1/8) · X ON · WID 40 · FDB 72 · HPF 44 · LPF 84 · REV 20 · VOL 100.
- REVERB PRE 12 · DEC 56 · FRQ 72 · GAI 40 · HPF 44 · LPF 92 · VOL 96.
- DIST AMT 22 · DOV 12 · DEL POST · REV POST.
- COMP THR 72 · ATK 3 ms · REL 0.2 s · MUP 22 · RAT 1:4 · SEQ LPF · MIX 100 · VOL 64.

```
BD  X--- x--- x--- x---
CP  ---- x--- ---- x---
RS  ---o ---- --o- ----
OH  --x- --x- --x- --x-
CH  -g-g -g-g -g-g -g-o
CY  x--- ---- ---- ----
LT  ---- ---- ---- --o-
SD  ---- ---- ---- ---x
```
Locks / conditions:
- CY 1 cond 1:4.
- LT 15 cond 50%.
- SD 16 cond FILL.
- CH on 4, 8, 12 and 16 chokes the OH from the step before, giving the tight "tss-t" (voice 7 is shared).

---

### 03 · Techno / Rumble 128
**New** · 128 BPM · swing 50 % · 32 steps

The hypnotic "rumble" technique:
- The kick feeds a long, dark reverb.
- The reverb return is set **PRE**, so it passes through the master DIST and the COMP.
- The compressor ducks the rumble under every kick.

| Trk | Machine | SRC | FLTR | AMP | Notes |
|---|---|---|---|---|---|
| BD | BD HARD | TUN −4 · DEC 54 · HLD 30 · SWT 46 · SNP 20 · WAV ASIN · TIC 70 | – | OVR 24 · **REV 96** · VOL 120 | |
| RS | RS CLASSIC | T1 +7 · DEC 30 · BAL +10 · T2 +19 · SYM +20 · NOL 10 · TIC 50 | – | DEL 90 · PAN −24 · VOL 84 | |
| CP | CP CLASSIC | TON 58 · NOD 70 · NUM 4 · RAT 78 · NOL 74 · RND 50 · CPD 60 | BP FRQ 70 RES 20 | REV 70 · VOL 90 | |
| CH | HH BASIC | TUN +6 · DEC 14 · TON +24 · TRD 40 · RST ON | HP2 FRQ 80 | PAN +16 · VOL 88 | LFO: DST SYN3 [DEC] · TRI · SPD 8 · ×8 (1 cycle per 2 bars) · DEP +40 · FREE |
| CY | CY RIDE | TYP B · DEC 70 · HIT 40 · C1 60 · C2 70 · C3 40 | HP1 FRQ 60 | PAN −12 · VOL 74 | |

**FX:**
- DELAY TIM 24 · X ON · WID 30 · FDB 108 · HPF 50 · LPF 70 · REV 30 · VOL 96.
- REVERB PRE 0 · DEC 92 · FRQ 30 · GAI 8 · HPF 12 · LPF 34 · VOL 118.
- DIST AMT 46 · SYM +12 · DOV 20 · DEL POST · **REV PRE**.
- COMP THR 46 · ATK 10 ms · REL A1 · MUP 30 · RAT 1:8 · SEQ LPF · MIX 127 · VOL 64.

```
BD  X--- x--- x--- x--- | x--- x--- x--- x---
RS  ---- --o- ---o ---- | ---- --o- ---- ----
CP  ---- ---- ---- ---- | ---- ---- ---- x---
CH  ogog ogog ogog ogog | ogog ogog ogog ogog
CY  --o- --o- --o- --o- | --o- --o- --o- --o-
```
Locks / conditions:
- RS 12 cond 1:2.
- RS 23 lock SRC T1 = +12.
- CP 29 lock AMP REV = 110, for a big wash into the next bar. No RS follows it, so voice 3 lets the clap ring into the reverb.

---

### 04 · House / Jackin' 124
**New** · 124 BPM · swing 58 % · 16 steps

A classic swung house groove. Snare and clap are layered on two different voices (2 and 3), so both sound. The shaker is UT NOISE on the CB track.

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD CLASSIC | TUN −4 · DEC 52 · HLD 24 · SWT 44 · SWD 56 · WAV ASIN · TRA 28 | – | VOL 116 |
| SD | SD CLASSIC | TUN +3 · DEC 32 · DET 60 · SNP 74 · NOD 40 · NOL 76 · BAL −8 | HP1 FRQ 30 | REV 20 · VOL 72 |
| RS | RS CLASSIC | T1 +5 · DEC 24 · BAL +12 · T2 +17 · SYM +16 · NOL 12 · TIC 56 | – | DEL 36 · PAN +22 · VOL 82 |
| CP | CP CLASSIC | TON 62 · NOD 60 · NUM 3 · RAT 76 · NOL 86 · RND 28 · CPD 82 | HP1 FRQ 26 | REV 50 · VOL 106 |
| LT | XT CLASSIC (conga) | TUN +36 · DEC 34 · SWD 20 · SWT 18 · NOD 10 · NOL 40 · TON +10 | – | PAN +30 · VOL 78 |
| CH | CH CLASSIC | TUN +4 · DEC 14 · COL +10 | HP2 FRQ 64 | PAN −10 · VOL 90 |
| OH | OH CLASSIC | TUN +4 · DEC 42 · COL +10 | HP2 FRQ 64 | REV 12 · PAN −10 · VOL 96 |
| CB | UT NOISE (shaker) | LPF 112 · DEC 18 · HPF 92 · LPQ 0 · ATK 12 | HP2 FRQ 90 | PAN +26 · VOL 70 |

**FX:**
- DELAY TIM 32 (1/4) · FDB 56 · HPF 48 · LPF 80 · VOL 90.
- REVERB PRE 16 · DEC 48 · FRQ 70 · GAI 44 · HPF 40 · LPF 88 · VOL 100.
- DIST AMT 0.
- COMP THR 84 · ATK 10 ms · REL 0.4 s · MUP 14 · RAT 1:2 · SEQ LPF · MIX 80 · VOL 64.

```
BD  x--- x--- x--- x---
SD  ---- x--- ---- x---
CP  ---- x--- ---- x---
RS  ---o ---- ---o ---o
LT  ---- --o- -o-- ----
OH  --x- --x- --x- --x-
CH  ---- ---- ---- ---g
CB  ogxg ogxg ogxg ogxg
```
Locks / conditions:
- RS 16 µ −3: it rushes, which pulls into the downbeat.
- OH 15 lock SRC DEC = 60, a longer last open hat. CH 16 cuts it.

---

### 05 · Deep House / Velvet 120
**New** · 120 BPM · swing 56 % · 32 steps

A soft, rounded kick and a deep open-fifth stab from **SY RAW** on the SD track. It uses two oscillators with osc 2 a fifth up, and the fifth fades first (DEC2). A slow LFO opens and closes the stab's filter over 4 bars.

| Trk | Machine | SRC | FLTR | AMP | LFO / notes |
|---|---|---|---|---|---|
| BD | BD SILKY | TUN −5 · DEC 62 · HLD 30 · SWT 50 · SWD 48 · DUS 20 · CLK 60 | LP2 FRQ 110 | VOL 114 | |
| SD | SY RAW | TUNE 0 · DET +7 st (a fifth; rytm-rs ±24 st, raw 71) · BAL 0 · DEC2 60 · WAV1 SAW · WAV2 SINESAW · NLEV 8 | LP2 FRQ 58 · RES 44 · ENV +28 · DEC 40 · REL 30 | HLD 10 · DEC 50 (osc 1 has no decay of its own, so AMP shapes the stab) · DEL 56 · REV 40 · VOL 88 | LFO DST FLT FRQ · WAV TRI · SPD 4 · MUL ×8 (1 cycle per 4 bars) · DEP +18 |
| RS | RS CLASSIC | T1 +9 · DEC 22 · T2 +21 · SYM +8 · NOL 6 · TIC 40 | – | DEL 70 · PAN +20 · VOL 76 | |
| CP | CP CLASSIC | TON 52 · NOD 74 · NUM 2 · RAT 70 · NOL 70 · RND 36 · CPD 76 | LP2 FRQ 96 | REV 64 · VOL 92 | |
| CH | CH CLASSIC | TUN −6 · DEC 12 · COL −14 | HP2 FRQ 60 | PAN −14 · VOL 78 | |
| OH | OH CLASSIC | TUN −6 · DEC 38 · COL −14 | HP2 FRQ 60 | REV 22 · PAN −14 · VOL 86 | |
| CB | UT NOISE (shaker) | LPF 100 · DEC 14 · HPF 84 · ATK 20 | – | PAN +24 · VOL 60 | |

**FX:**
- DELAY TIM 24 · X ON · WID 50 · FDB 84 · HPF 52 · LPF 64 · REV 34 · VOL 92.
- REVERB PRE 20 · DEC 72 · FRQ 56 · GAI 26 · HPF 36 · LPF 72 · VOL 104.
- COMP THR 88 · ATK 30 ms · REL 0.6 s · MUP 10 · RAT 1:2 · SEQ LPF · MIX 64 · VOL 64.

```
BD  x--- x--- x--- x--- | x--- x--- x--- x--o
CP  ---- x--- ---- x--- | ---- x--- ---- x---
SD  ---o --x- ---- ---- | ---o --x- ---- ----
RS  ---- ---- -o-- --o- | ---- ---- -o-- -o-o
OH  --o- --o- --o- --o- | --o- --o- --o- --o-
CH  ---- ---- ---- ---g | ---- ---- ---- ---g
CB  g-o- g-o- g-o- g-o- | g-o- g-o- g-o- g-o-
```
Locks / conditions: SD 20 and 23 lock TRIG NOT = −2, so the stab moves down a tone in bar 2. The CHROMATIC sound setting must include SYN (the init, SYN+SMP, does).

---

### 06 · Electro / Freestyle 118
**New** · 118 BPM · swing 50 % · 16 steps

A long, booming sine kick, a snappy two-tone snare doubled with a clap, a syncopated cowbell, and "laser" toms with a deep pitch sweep for the fill.

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD CLASSIC | TUN −7 · DEC 100 · HLD 18 · SWT 40 · SWD 34 · WAV SIN · TRA 12 | – | OVR 12 · VOL 118 |
| SD | SD CLASSIC | TUN +5 · DEC 38 · DET 66 · SNP 92 · NOD 52 · NOL 92 · BAL 0 | – | REV 28 · VOL 100 |
| CP | CP CLASSIC | TON 70 · NOD 44 · NUM 3 · RAT 88 · NOL 72 · RND 24 · CPD 74 | – | REV 40 · VOL 94 |
| LT | XT CLASSIC | TUN +24 · DEC 60 · SWD 70 · SWT 40 | – | DEL 30 · PAN −30 |
| MT | XT CLASSIC | TUN +34 · DEC 56 · SWD 70 · SWT 36 | – | DEL 30 · PAN 0 |
| HT | XT CLASSIC | TUN +44 · DEC 52 · SWD 70 · SWT 32 | – | DEL 30 · PAN +30 |
| CH | CH CLASSIC | TUN +8 · DEC 12 · COL −24 | HP2 FRQ 66 | VOL 92 |
| OH | OH CLASSIC | TUN +8 · DEC 40 · COL −24 | – | VOL 90 |
| CB | CB CLASSIC | TUN +1 · DEC 26 · DET 64 | BP FRQ 86 RES 20 | DEL 44 · PAN +16 · VOL 84 |

**FX:**
- DELAY TIM 16 (1/8) · X ON · WID 60 · FDB 64 · HPF 40 · LPF 90 · VOL 96.
- REVERB PRE 6 · DEC 44 · FRQ 80 · GAI 50 · HPF 48 · LPF 96 · VOL 96.
- DIST AMT 10.
- COMP THR 90 · ATK 1 ms · REL 0.2 s · MUP 10 · RAT 1:4 · SEQ OFF · MIX 70 · VOL 64.

```
BD  X--- --x- -x-- ----
SD  ---- x--- ---- x---
CP  ---- x--- ---- x---
CH  xgxg xgxg xgxg xg--
OH  ---- ---- ---- --o-
CB  --x- -x-- x--x -o--
HT  ---- ---- ---- x---
MT  ---- ---- ---- -x--
LT  ---- ---- ---- --x-
```
Locks / conditions:
- HT 13, MT 14 and LT 15 have cond FILL. MT and HT share a voice, so they never overlap.
- CB 14 lock SRC TUN = +8, a higher bell.

---

### 07 · Hip-Hop / Dusty Boom Bap 90
**New** · 90 BPM · swing 62 % · 32 steps

A dusty, compressed boom bap: a warm acoustic kick through a slightly closed filter, a fat natural snare with swung ghost notes, and lazy 16th hats. Swing delays every even 16th, so the ghosts and the hat "a"s are the ones that groove.

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD ACOUSTIC | TUN −6 · DEC 58 · HLD 20 · SWT 44 · SWD 50 · WAV asinA · IMP 72 | LP2 FRQ 92 RES 8 | OVR 30 · VOL 118 |
| SD | SD NATURAL | TUN +2 · BDY 78 · DEC 58 · BAL 70 · LPF 84 · HPF 40 · RES 16 | LP2 FRQ 100 | OVR 16 · REV 30 · VOL 104 |
| RS | RS CLASSIC (side stick) | T1 +3 · DEC 30 · BAL −10 · T2 +15 · SYM +24 · NOL 18 · TIC 50 | – | REV 20 · VOL 70 |
| CH | HH BASIC | TUN −4 · DEC 18 · TON −10 · TRD 52 | LP2 FRQ 104 | PAN +14 · VOL 84 |
| OH | OH CLASSIC | TUN −4 · DEC 46 · COL −20 | LP2 FRQ 100 | PAN +14 · VOL 80 |

**FX:**
- REVERB PRE 4 · DEC 30 · FRQ 50 · GAI 30 · HPF 30 · LPF 70 · VOL 90 (a small room).
- DELAY VOL 0.
- DIST AMT 18 · SYM −8.
- COMP THR 70 · ATK 10 ms · REL 0.4 s · MUP 24 · RAT 1:4 · SEQ OFF · MIX 90 · VOL 64.

```
BD  X--- ---o --x- ---- | X-x- ---- --x- -o--
SD  ---- X--g ---- X--g | ---- X--g ---- X-gg
RS  ---- ---- ---- ---- | ---- ---- -g-- ----
CH  xgog xgog xgog xgog | xgog xgog xgog xg--
OH  ---- ---- ---- ---- | ---- ---- ---- --o-
```
Locks / conditions:
- SD 5, 13, 21 and 29 µ +3: laid back.
- SD ghosts lock SRC BAL 30 points away from the main hits' value, toward the body (oscillator). BAL balances noise against oscillator (p.101); which way is "more body" is unverified, so set it by ear.
- OH 31 is cut by the next bar's CH on step 1.

---

### 08 · Breaks / Rolling Break 136
**New** · 136 BPM · swing 54 % · 32 steps

A bright, ghost-heavy breakbeat over a ride. The snare rolls into the next bar with a **retrig**, and a tom fill plays on FILL.

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD CLASSIC | TUN −3 · DEC 44 · HLD 16 · SWT 36 · SWD 60 · WAV ASIN · TRA 44 | – | OVR 20 · VOL 116 |
| SD | SD HARD | TUN +6 · DEC 54 · SWD 110 · TIC 80 · NOD 50 · NOL 96 · SWT 30 | – | OVR 14 · REV 22 · VOL 104 |
| MT | XT CLASSIC | TUN +36 · DEC 56 · SWD 50 · SWT 30 | – | REV 20 · PAN −20 |
| HT | XT CLASSIC | TUN +46 · DEC 50 · SWD 50 · SWT 28 | – | REV 20 · PAN +20 |
| CH | CH CLASSIC | TUN +14 · DEC 16 · COL +30 | HP2 FRQ 70 | PAN +12 · VOL 86 |
| OH | OH CLASSIC | TUN +14 · DEC 48 · COL +30 | – | PAN +12 · VOL 88 |
| CY | CY RIDE | TYP A · DEC 84 · HIT 60 · C1 70 · C2 64 · C3 30 | HP1 FRQ 40 | PAN −16 · VOL 78 |

**FX:**
- REVERB PRE 8 · DEC 36 · FRQ 64 · GAI 44 · HPF 36 · LPF 90 · VOL 94.
- DELAY VOL 0.
- DIST AMT 26 · SYM +6.
- COMP THR 68 · ATK 3 ms · REL 0.2 s · MUP 26 · RAT 1:4 · SEQ OFF · MIX 110 · VOL 64.

```
BD  X-x- ---- --x- -o-- | X--- ---- x-x- ----
SD  ---- X--g -g-- X--g | -g-- X--g -g-- X--x
CY  x-o- x-o- x-o- x-o- | x-o- x-o- x-o- x-o-
OH  ---- ---- ---- ---- | ---- ---- ---- --o-
HT  ---- ---- ---- ---- | ---- ---- ---- -o--
MT  ---- ---- ---- ---- | ---- ---- ---- --x-
```
Locks / conditions:
- SD 32 retrig 1/32 · 1/16 · +40: a crescendo roll.
- HT 30 and MT 31 cond FILL.
- OH 31 cond !FILL.
- SD ghosts µ +2.

---

### 09 · Minimal / Click 125
**New** · 125 BPM · swing 55 % · 16 steps

A tight, short kick. **UT IMPULSE** pings a resonant band-pass for pitched clicks into a ping-pong delay. Hats change colour with p-locks, and conditional bleeps keep the loop alive.

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD SHARP | TUN −1 · DEC 34 · HLD 10 · SWT 40 · SWD 60 · WAV sinA · TIC 46 | – | VOL 116 |
| RS | UT IMPULSE | ATK 0 · DEC 18 · POL POS | **BP FRQ 92 RES 70** | DEL 88 · PAN −20 · VOL 88 |
| CP | CP CLASSIC | TON 80 · NOD 20 · NUM 1 · RAT 90 · NOL 50 · RND 10 · CPD 50 | – | REV 30 · VOL 86 |
| BT | BT CLASSIC | TUN −8 · DEC 40 · SNP 2 · NOL 10 · SWD 20 | – | VOL 80 |
| CH | HH BASIC | TUN +10 · DEC 10 · TON +30 · TRD 30 · RST ON | HP2 FRQ 84 | PAN +18 · VOL 84 |
| CB | CB CLASSIC | TUN −20 · DEC 30 · DET 70 · PW1 +10 · PW2 −10 | LP2 FRQ 70 RES 30 | DEL 70 · REV 20 · VOL 72 |

**FX:**
- DELAY TIM 24 · X ON · WID 56 · FDB 104 · HPF 60 · LPF 76 · REV 24 · VOL 98.
- REVERB PRE 30 · DEC 60 · FRQ 64 · GAI 30 · HPF 50 · LPF 80 · VOL 92.
- COMP THR 90 · ATK 3 ms · REL 0.4 s · MUP 10 · RAT 1:2 · SEQ LPF · MIX 80 · VOL 64.

```
BD  x--- x--- x--- x---
CP  ---- x--- ---- x---
RS  --o- ---- -g-- --o-
CH  --x- --x- --x- --x-
CB  ---- --o- ---- ---o
BT  ---- ---- --o- ----
```
Locks / conditions:
- RS 10 cond 50%.
- RS 15 cond 1:2.
- RS 15 lock FLTR FRQ = 104, a higher ping.
- CH 7 lock SRC TON = +44; CH 15 lock SRC DEC = 24.
- CB 7 cond 1:2; CB 16 cond 2:4.

RS and CP share voice 3. The RS clicks never land on CP steps, and their delay tails keep ringing after the dry hit is cut.

---

### 10 · Industrial / Foundry 140
**New** · 140 BPM · swing 50 % · 16 steps

An FM kick crushed by voice overdrive and master distortion, metallic HH LAB clusters, anvil-like CB METALLIC hits, and a limiter-style compressor driven by transients.

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD FM | TUN −8 · DEC 50 · FMA 92 · SWT 40 · FMS 60 · FMD 36 · FMT −5 | LP2 FRQ 100 RES 30 | **OVR 90** · VOL 110 |
| SD | SD HARD | TUN −4 · DEC 60 · SWD 127 · TIC 100 · NOD 70 · NOL 110 · SWT 24 | HP1 FRQ 30 | OVR 70 · REV 30 · VOL 100 |
| CP | CP CLASSIC | TON 40 · NOD 80 · NUM 5 · RAT 60 · NOL 100 · RND 70 · CPD 60 | BP FRQ 60 RES 40 | OVR 40 · REV 50 · VOL 90 |
| LT | XT CLASSIC | TUN 0 · DEC 70 · SWD 110 · SWT 60 · NOD 30 · NOL 90 · TON −20 | – | OVR 50 · VOL 86 |
| CH | HH LAB | OSC1 412 · OSC2 1187 · OSC3 2213 · DEC 20 · OSC4 3507 · OSC5 5419 · OSC6 7951 (Hz, as the screen shows on p.106; the exact range is unverified) | HP2 FRQ 70 RES 30 | OVR 30 · VOL 84 |
| CY | CY METALLIC | TUN −30 · DEC 110 · TON −20 · TRD 80 | – | REV 40 · VOL 82 |
| CB | CB METALLIC | TUN −40 · DEC 60 · DET 100 · PW1 +30 · PW2 −30 | BP FRQ 60 RES 60 | OVR 60 · DEL 40 · VOL 78 |

**FX:**
- DELAY TIM 8 (1/16) · X ON · WID 40 · FDB 90 · HPF 70 · LPF 60 · REV 20 · VOL 80.
- REVERB PRE 0 · DEC 64 · FRQ 40 · GAI 20 · HPF 30 · LPF 60 · VOL 96.
- **DIST AMT 88 · SYM −24 · DOV 60 · DEL PRE · REV PRE**.
- **COMP THR 40 · ATK 0.3 ms · REL 0.1 s · MUP 40 · RAT MAX · SEQ HIT · MIX 127 · VOL 56**.

```
BD  X--x X--- X-x- X---
SD  ---- X--- ---- X---
CP  ---- ---- ---- ---x
CH  xgog xgog xgog xgog
CY  X--- ---- ---- ----
CB  ---- ---o -o-- --o-
LT  ---- ---- ---- -x-x
```
Locks / conditions:
- CY 1 cond 1:4. CY and CB share voice 8, so the crash rings until the first anvil hit on step 8. The CB hits start late on purpose.
- CP 16 cond 1:2.
- LT 16 retrig 1/24 · 1/8 · −30.
- BD 4 lock SRC FMA = 127.

---

### 11 · IDM / Glass Garden 100
**New** · 100 BPM · swing 50 % · **PER TRACK** · master length 16

Polymeter: BD 16 steps, SY CHIP 12, RS 10, CH 7, CY 16. Also an SY CHIP arpeggio whose waveform drifts under a slewed random LFO, ratchet rolls with falling velocity, and PRE / NEI conditions.

| Trk | Len | Machine | SRC | FLTR | AMP | LFO |
|---|---|---|---|---|---|---|
| BD | 16 | BD SILKY | TUN −6 · DEC 56 · HLD 20 · SWT 60 · SWD 40 · DUS 50 · CLK 90 | – | VOL 112 | |
| SD | 12 | SY CHIP | TUN +12 · DCY 30 · OF2 +3 · OF3 +7 · OF4 +10 · WAV 12 (PWM+) · SPD 8 (16T) | LP2 FRQ 70 RES 30 ENV +20 DEC 30 | DEL 50 · REV 30 · PAN −10 · VOL 82 | DST FLT FRQ · RND · SPD 32 · ×4 (1 per bar) · SPH 60 (slew) · DEP +30 |
| RS | 10 | RS CLASSIC | T1 +12 · DEC 18 · BAL +20 · T2 +31 · SYM +30 · NOL 4 · TIC 70 | – | DEL 40 · PAN +24 · VOL 78 | |
| HT | 16 | XT CLASSIC | TUN +56 · DEC 30 · SWD 30 · SWT 20 | – | REV 30 · PAN −30 | |
| CH | 7 | HH LAB | OSC1 2400 · OSC2 3150 · OSC3 4720 · DEC 12 · OSC4 5890 · OSC5 7310 · OSC6 9620 (Hz) | HP2 FRQ 90 | PAN +8 · VOL 76 | |
| CY | 16 | CY RIDE | TYP C · DEC 60 · HIT 30 · C1 40 · C2 90 · C3 60 | – | REV 40 · VOL 70 | |

**FX:**
- DELAY TIM 20 (off-grid 5/32) · X ON · WID 63 · FDB 120 · HPF 50 · LPF 70 · REV 40 · VOL 96.
- REVERB PRE 40 · DEC 96 · FRQ 70 · GAI 50 · HPF 40 · LPF 100 · VOL 90.
- DIST AMT 30 · SYM +30 · DEL PRE · REV POST.
- COMP THR 80 · ATK 1 ms · REL A2 · MUP 18 · RAT 1:4 · SEQ OFF · MIX 64 · VOL 64.

```
BD (16)  X--- --o- x--- -o--
SD (12)  x--o --x- o---
RS (10)  o--g -o-- g-
CH  (7)  x-g-o--
HT (16)  ---- ---- ---- ---o
CY (16)  ---- x--- ---- ----
```
Locks / conditions:
- BD 7 µ +6 and BD 14 µ −5: the kick breathes.
- RS 1 retrig 1/48 · 1/8 · −60, a falling ratchet. RS 6 retrig 1/80 · 1/16 · −90.
- RS 4 cond PRE, so it plays only if the last evaluated condition on the track was true. RS 9 cond 50%.
- CH 5 cond NEI, which follows the track before it (track 8).
- HT 16 cond 2:3.
- CY 5 cond 1:2.
- SD 1 lock SRC OF4 = +14, which lifts the arp's top note on the downbeat.

---

### 12 · Dub Techno / Echo Chamber 118
**New** · 118 BPM · swing 50 % · 32 steps

A minor-seventh chord stab made with **SY CHIP**. Its fast internal arpeggiator cycles root, +3, +7 and +10 so quickly that the ear hears a chord, which is the trick the machine was built for (p.103). The stab is soaked in a dark, long ping-pong delay that feeds the reverb. The delay overdrive (DOV) warms the repeats, and a slow sine LFO breathes the stab filter over 8 bars.

| Trk | Machine | SRC | FLTR | AMP | LFO |
|---|---|---|---|---|---|
| BD | BD SILKY | TUN −6 · DEC 64 · HLD 28 · SWT 48 · SWD 44 · DUS 30 · CLK 40 | LP2 FRQ 96 | VOL 114 | |
| SD | SY CHIP | TUN 0 · WAV SAW · **SPD ≈ 40 Hz** (index 40 per rytm-rs, L; any fast Hz rate works) · DEC 70 · **OF2 +3 · OF3 +7 · OF4 +10** | LP2 FRQ 48 · RES 52 · ENV +24 · DEC 46 · REL 40 | ATK 6 · **DEL 100** · REV 60 · VOL 84 | DST FLT FRQ · WAV SIN · SPD 2 · MUL ×8 (1 per 8 bars) · DEP +24 |
| RS | RS CLASSIC | T1 +4 · DEC 28 · T2 +16 · SYM +12 · NOL 10 · TIC 40 | – | DEL 84 · PAN −26 · VOL 74 | |
| OH | OH CLASSIC | TUN −10 · DEC 58 · COL −30 | HP2 FRQ 70 | REV 40 · PAN +20 · VOL 80 | |
| CB | UT NOISE (shaker) | LPF 90 · DEC 12 · HPF 80 · ATK 10 | – | PAN −20 · VOL 56 | |

**FX:**
- DELAY TIM 24 · X ON · WID 63 · **FDB 128** · HPF 56 · LPF 58 · **REV 56** · VOL 104.
- REVERB PRE 24 · DEC 104 · FRQ 44 · GAI 18 · HPF 44 · LPF 64 · VOL 110.
- DIST AMT 12 · **DOV 30** · DEL POST · REV POST.
- COMP THR 76 · ATK 10 ms · REL A1 · MUP 16 · RAT 1:4 · SEQ LPF · MIX 100 · VOL 64.

```
BD  x--- x--- x--- x--- | x--- x--- x--- x---
SD  ---- --x- ---- ---- | ---- --x- ---o ----
RS  ---- ---- ---o ---- | ---- ---- ---- -o--
OH  --o- --o- --o- --o- | --o- --o- --o- --o-
CB  -g-g -g-g -g-g -g-g | -g-g -g-g -g-g -g-g
```
Locks / conditions:
- SD 28 lock TRIG NOT = −2 and lock FLTR FRQ = 64.
- RS 12 cond 1:2.

---

### 13 · 808-style / Low Boom 105
**Recreation of the Roland TR‑808 voice character, built from Rytm machines** (not samples, not a factory kit) · 105 BPM · swing 54 % · 16 steps

What makes it 808:
- A long, nearly pure sine kick with a small sweep.
- A two-tone snare with soft noise.
- A four-burst clap.
- Six-square metallic hats.
- A two-square cowbell (CB DET 64 gives the classic interval).
- Dry FX.

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD CLASSIC | TUN −8 · DEC 96 · HLD 0 · SWT 30 · SWD 22 · WAV SIN · TRA 8 | LP2 FRQ 112 | VOL 120 |
| SD | SD CLASSIC | TUN +2 · DEC 30 · DET 74 · SNP 40 · NOD 40 · NOL 70 · BAL −12 | HP1 FRQ 20 | VOL 98 |
| RS | RS CLASSIC | T1 +18 · DEC 16 · BAL +6 · T2 +30 · SYM +20 · NOL 0 · TIC 64 | – | VOL 86 |
| CP | CP CLASSIC | TON 60 · NOD 66 · NUM 3 · RAT 80 · NOL 84 · RND 20 · CPD 66 | – | VOL 100 |
| LT · MT · HT | XT CLASSIC | TUN +18 / +30 / +42 · DEC 76 / 70 / 64 · SWD 18 · SWT 30 / 28 / 26 · NOL 40 | – | PAN −24 / 0 / +24 |
| CH | CH CLASSIC | TUN 0 · DEC 14 · COL −18 | – | VOL 90 |
| OH | OH CLASSIC | TUN 0 · DEC 54 · COL −18 | – | VOL 92 |
| CY | CY CLASSIC | DEC 110 · COL −10 | – | VOL 82 |
| CB | CB CLASSIC | TUN 0 · DEC 24 · DET 64 | – | VOL 86 |

**FX:** DELAY VOL 0 · REVERB PRE 4 · DEC 30 · VOL 80 · DIST 0 · COMP MIX 0, as the dry machine was.

```
BD  X--- ---x --x- ----
SD  ---- x--- ---- x---
CP  ---- ---- ---- x---
CH  x-x- x-x- x-x- x---
OH  ---- ---- ---- --o-
CB  ---- --o- ---- --o-
RS  ---- ---- -g-- ----
LT  ---- ---- ---- ---o
```
Locks / conditions:
- LT 16 cond FILL.
- BD 8 lock SRC DEC = 110: a longer "boom" on the pickup.
- CB on 7 and 15 is on voice 8 with CY. CY is left empty in the pattern so the bell rings. That is the real 808 voice-sharing trade-off.

---

### 14 · 909-style / Club Punch 128
**Recreation of the Roland TR‑909 voice character, built from Rytm machines** · 128 BPM · swing 54 % · 16 steps

What makes it 909:
- A punchy kick with a strong attack click (TIC).
- A bright snare: tone plus "snappy" noise.
- A tight multi-clap.
- Toms with deep pitch sweeps.
- Bright metallic hats and a long crash.

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD HARD | TUN −1 · DEC 52 · HLD 22 · SWT 46 · SNP 36 · WAV SIN · TIC 104 | – | OVR 20 · VOL 118 |
| SD | SD HARD | TUN +3 · DEC 50 · SWD 100 · TIC 84 · NOD 56 · NOL 96 · SWT 34 | – | VOL 100 |
| RS | RS HARD | TUN +8 · DEC 22 · SWD 90 · TIC 80 · NOL 20 · SWT 20 | – | VOL 84 |
| CP | CP CLASSIC | TON 74 · NOD 40 · NUM 4 · RAT 92 · NOL 70 · RND 18 · CPD 70 | – | REV 24 · VOL 98 |
| LT · MT · HT | XT CLASSIC | TUN +22 / +32 / +42 · DEC 64 / 60 / 56 · SWD 60 · SWT 40 / 36 / 32 · NOL 60 | – | PAN −24 / 0 / +24 |
| CH | CH METALLIC | TUN +16 · DEC 18 | HP2 FRQ 74 | VOL 92 |
| OH | OH METALLIC | TUN +16 · DEC 56 | HP2 FRQ 74 | VOL 94 |
| CY | CY CLASSIC | DEC 118 · COL +20 · TON +10 | HP1 FRQ 50 | VOL 84 |
| CB | CY RIDE (909 ride stand-in) | TYP D · DEC 90 · HIT 64 · C1 64 · C2 64 · C3 40 | – | VOL 80 |

**FX:**
- REVERB PRE 8 · DEC 40 · VOL 90.
- DELAY VOL 0.
- DIST AMT 16.
- COMP THR 80 · ATK 10 ms · REL 0.2 s · MUP 16 · RAT 1:4 · SEQ LPF · MIX 90 · VOL 64.

```
BD  x--- x--- x--- x---
CP  ---- x--- ---- x---
OH  --x- --x- --x- --x-
CH  g--- g--- g--- g--g
SD  ---- ---- ---- --gx
RS  ---- ---- --o- ----
CY  X--- ---- ---- ----
```
Locks / conditions:
- SD 15 and 16 cond FILL.
- CY 1 cond 1:4.
- For a variation, add CB (ride) on 3, 7, 11 and 15 at `o`. It shares voice 8 with CY, so a crash on step 1 cuts the ride.

---

### 15 · Acoustic-style / Live Room 96
**New** · 96 BPM · swing 54 % · 32 steps

A played-kit feel:
- An acoustic kick and snare with impact transients.
- Ghost notes, tuned toms and a ride.
- A shared room reverb with different send levels, which places each drum at a depth.

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD ACOUSTIC | TUN −4 · DEC 56 · HLD 22 · SWT 50 · SWD 58 · WAV sinA · IMP 74 | – | REV 10 · VOL 116 |
| SD | SD ACOUSTIC | TUN +4 · BDY 70 · NOD 62 · NOL 84 · HLD 24 · SWD 30 · IMP 84 | – | REV 34 · VOL 104 |
| LT · MT · HT | XT CLASSIC | TUN +20 / +32 / +44 · DEC 80 / 74 / 68 · SWD 26 · SWT 40 · NOD 8 · NOL 60 · TON −10 | – | REV 28 · PAN +24 / +8 / −10 |
| CH | HH BASIC | TUN +2 · DEC 20 · TON +8 · TRD 50 | – | PAN −18 · VOL 86 |
| OH | OH CLASSIC | TUN +2 · DEC 70 · COL +26 | – | REV 20 · PAN −18 · VOL 84 |
| CY | CY RIDE | TYP B · DEC 96 · HIT 70 · C1 72 · C2 60 · C3 44 | – | REV 20 · PAN +26 · VOL 80 |
| CB | CY CLASSIC (crash) | DEC 120 · COL +30 · TON +20 | – | REV 30 · PAN −30 · VOL 84 |

**FX:**
- REVERB PRE 6 · DEC 34 · FRQ 60 · GAI 52 · HPF 24 · LPF 84 · VOL 100.
- DELAY VOL 0.
- COMP THR 82 · ATK 10 ms · REL 0.4 s · MUP 14 · RAT 1:2 · SEQ LPF · MIX 70 · VOL 64.

```
BD  X--- --x- x--- ---- | X--- --x- x-o- ----
SD  ---- X-g- -g-g X--g | ---- X-g- -g-- X---
CH  x-o- x-o- x-o- x-o- | x-o- x-o- x--- ----
OH  ---- ---- ---- ---- | ---- ---- --o- ----
CY  ---- ---- ---- ---- | ---- ---- ---- ----
HT  ---- ---- ---- ---- | ---- ---- ---- xo--
MT  ---- ---- ---- ---- | ---- ---- ---- --xo
LT  ---- ---- ---- ---- | ---- ---- ---- ----
CB  X--- ---- ---- ---- | ---- ---- ---- ----
```
Locks / conditions:
- CB 1 cond 1:2.
- HT 29–30, MT 31–32: a fill (the toms are always on in this version).
- For a ride version, copy the CH row to CY and clear CH.
- The SD ghosts have VEL 45 plus µ +2.

---

### 16 · Trap / Half-Time 140
**New** · 140 BPM · swing 50 % · 32 steps

An "808" bass made from BD CLASSIC: a long DEC and HLD, with NOTE locks writing a bass line. The snare and clap land on beat 3 (half-time). The hats use **retrigs** for rolls and triplets.

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD CLASSIC (808 bass) | TUN −5 · DEC 120 · HLD 60 · SWT 26 · SWD 16 · WAV SIN · TRA 10 | – | OVR 36 · VOL 120 |
| SD | SD NATURAL | TUN +5 · BDY 50 · DEC 50 · BAL 90 · LPF 110 · HPF 60 · RES 10 | – | REV 24 · VOL 98 |
| CP | CP CLASSIC | TON 76 · NOD 50 · NUM 3 · RAT 86 · NOL 82 · RND 30 · CPD 74 | – | REV 40 · VOL 100 |
| RS | RS HARD | TUN +12 · DEC 18 · TIC 90 · NOL 10 | – | DEL 50 · PAN −30 · VOL 76 |
| CH | HH BASIC | TUN +20 · DEC 8 · TON +30 · TRD 30 · RST ON | HP2 FRQ 88 | PAN +10 · VOL 86 |
| OH | OH CLASSIC | TUN +20 · DEC 44 · COL +30 | – | VOL 82 |

**FX:**
- DELAY TIM 24 · X ON · FDB 70 · VOL 80.
- REVERB PRE 10 · DEC 50 · VOL 90.
- DIST AMT 10.
- COMP THR 76 · ATK 3 ms · REL 0.2 s · MUP 20 · RAT 1:4 · SEQ LPF · MIX 100 · VOL 64.

```
BD  X--- ---- --x- ---- | X--- --x- ---- -o--
SD  ---- ---- x--- ---- | ---- ---- x--- ----
CP  ---- ---- x--- ---- | ---- ---- x--- ----
RS  ---- --o- ---- ---o | ---- --o- ---- ----
CH  x-x- x-xx x-x- x-x- | x-x- x-x- x-x- xx-x
OH  ---- ---- ---- ---- | ---- ---- ---- --o-
```
Locks / conditions:
- BD trig NOT: 1 = 0, 11 = 0, 17 = +3, 23 = −2, 30 = 0.
- CH 8 retrig 1/32 · 1/16 · 0.
- CH 15 retrig 1/24 · 1/8 · −20 (a triplet roll).
- CH 29, 30 and 32 retrig 1/32 · 1/16, with curves −40, −20 and +30.
- OH 31 sits in the gap and is cut by CH 32.

---

### 17 · Drum & Bass / Liquid Roller 174
**New** · 174 BPM · swing 52 % · 32 steps

A two-step pattern: kick on 1 and on the "&" of 3, a crisp natural snare on 2 and 4 with ghosts, a shimmering ride and rimshot ghosts.

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD SHARP | TUN −2 · DEC 40 · HLD 14 · SWT 36 · SWD 70 · WAV sinA · TIC 72 | – | OVR 18 · VOL 116 |
| SD | SD NATURAL | TUN +7 · BDY 60 · DEC 46 · BAL 84 · LPF 112 · HPF 56 · RES 8 | – | REV 28 · VOL 104 |
| RS | RS CLASSIC | T1 +10 · DEC 16 · T2 +22 · TIC 50 | – | DEL 30 · VOL 60 |
| CH | HH BASIC | TUN +12 · DEC 10 · TON +20 · TRD 36 | HP2 FRQ 84 | PAN +14 · VOL 82 |
| OH | OH CLASSIC | TUN +12 · DEC 36 · COL +20 | – | VOL 78 |
| CY | CY RIDE | TYP C · DEC 80 · HIT 50 · C1 50 · C2 80 · C3 40 | HP1 FRQ 60 | PAN −20 · VOL 70 |

**FX:**
- DELAY TIM 24 · FDB 60 · VOL 70.
- REVERB PRE 10 · DEC 48 · VOL 90.
- DIST AMT 8.
- COMP THR 70 · ATK 1 ms · REL 0.1 s · MUP 22 · RAT 1:4 · SEQ OFF · MIX 100 · VOL 64.

```
BD  X--- ---- --x- ---- | X-x- ---- --x- ----
SD  ---- X--- ---g X--- | ---g X--- -g-- X-g-
RS  ---- --g- ---- ---- | ---- --g- ---- --g-
CH  x-o- x-o- x-o- x-o- | x-o- x-o- x-o- x-o-
OH  ---- ---- ---- ---- | ---- ---- ---- ---o
CY  o--- o--- o--- o--- | o--- o--- o--- o---
```
Locks / conditions:
- SD ghosts µ +3.
- RS 31 cond 1:2.
- OH 32 is cut by CH on the next step 1.

---

### 18 · UK Garage / 2-Step 132
**New** · 132 BPM · **swing 64 %** · 16 steps

A heavily shuffled 2-step. The skippy kick lands on swung even steps, and swing pushes every even 16th late (64 % → 0.28 of a step).

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD CLASSIC | TUN −3 · DEC 46 · HLD 18 · SWT 40 · SWD 50 · WAV SIN · TRA 24 | – | VOL 116 |
| SD | SD CLASSIC | TUN +6 · DEC 30 · DET 64 · SNP 80 · NOD 36 · NOL 80 · BAL 0 | – | REV 24 · VOL 96 |
| CP | CP CLASSIC | TON 70 · NOD 40 · NUM 2 · RAT 84 · NOL 72 | – | REV 30 · VOL 90 |
| CH | CH CLASSIC | TUN +8 · DEC 14 · COL +14 | HP2 FRQ 70 | PAN +12 · VOL 88 |
| OH | OH CLASSIC | TUN +8 · DEC 38 · COL +14 | – | VOL 84 |
| CB | UT NOISE (shaker) | LPF 110 · DEC 14 · HPF 90 · ATK 6 | – | PAN −20 · VOL 64 |

**FX:**
- DELAY TIM 24 · FDB 50 · VOL 70.
- REVERB PRE 12 · DEC 44 · VOL 90.
- COMP THR 82 · ATK 3 ms · REL 0.2 s · MUP 14 · RAT 1:4 · SEQ LPF · MIX 90 · VOL 64.

```
BD  X--- ---o --x- ----
SD  ---- x--- ---- x---
CP  ---- x--- ---- x---
CH  -o-o -o-- -o-o -o--
OH  ---- --x- ---- --x-
CB  gogo gogo gogo gogo
```
Locks / conditions:
- BD 8 cond 3:4.
- CH 12 retrig 1/24 · 1/16 · −20.
- OH 7 is cut by CH 10.

---

### 19 · Afro House / Rhythm Circle 122
**New** · 122 BPM · swing 54 % · 32 steps

A hand-percussion circle on the tom voices:
- BT is a surdo.
- LT is a low conga.
- MT and HT share a voice as open conga and slap.
- RS plays a 3-2 son clave across two bars.
- A shaker (UT NOISE) sits on the CH track and a bell on CB.

| Trk | Machine | SRC | FLTR | AMP |
|---|---|---|---|---|
| BD | BD SILKY | TUN −4 · DEC 58 · HLD 24 · SWT 44 · SWD 52 · DUS 10 · CLK 70 | – | VOL 116 |
| BT | BT CLASSIC (surdo) | TUN −4 · DEC 90 · SNP 1 · NOL 10 · SWD 24 | LP2 FRQ 70 | REV 20 · VOL 90 |
| LT | XT CLASSIC (tumba) | TUN +18 · DEC 50 · SWD 30 · SWT 20 · NOD 6 · NOL 50 · TON +10 | – | PAN −30 |
| MT | XT CLASSIC (conga) | TUN +30 · DEC 44 · SWD 30 · SWT 18 · NOL 50 | – | PAN −10 |
| HT | XT CLASSIC (slap) | TUN +44 · DEC 30 · SWD 40 · SWT 12 · NOL 80 · TON +30 | – | PAN +20 |
| RS | RS CLASSIC (clave) | T1 +20 · DEC 14 · BAL +30 · T2 +32 · NOL 0 · TIC 70 | – | PAN +24 · VOL 80 |
| CH | UT NOISE (shaker) | LPF 116 · DEC 16 · HPF 96 · ATK 14 | – | PAN +30 · VOL 70 |
| OH | OH CLASSIC | DEC 40 · COL +20 | – | VOL 80 |
| CB | CB CLASSIC (bell) | TUN +12 · DEC 22 · DET 80 · PW1 +10 | BP FRQ 92 RES 20 | DEL 40 · PAN −24 · VOL 76 |

**FX:**
- DELAY TIM 24 · X ON · FDB 70 · VOL 80.
- REVERB PRE 14 · DEC 52 · VOL 96.
- COMP THR 84 · ATK 10 ms · REL 0.4 s · MUP 12 · RAT 1:2 · MIX 70 · VOL 64.

```
BD  x--- x--- x--- x--- | x--- x--- x--- x---
RS  x--- --x- ---- x--- | ---- x--- x--- ----
BT  ---- ---- ---- --o- | ---- ---- ---- --x-
LT  ---- ---o ---- ---- | ---- ---o ---- -o--
MT  ---- --x- x--- ---- | ---- --x- x--- ----
HT  ---x ---- ---- x--- | ---x ---- ---- x---
CH  og-g og-g og-g og-g | og-g og-g og-g og-g
OH  --o- --o- --o- --o- | --o- --o- --o- --o-
CB  x--x --x- -x-- x--- | x--x --x- -x-- x---
```
Locks / conditions:
- The son clave is RS on 1, 7, 13 | 21, 25.
- HT 4 and 20 µ −2 (the slap pushes).
- MT 7 lock SRC DEC = 60, an open tone.
- The UT NOISE shaker on CH shares voice 7 with OH. So the shaker skips the offbeats, the OH plays there, and the next shaker hit cuts it a 16th later: a short, musical choke. Nothing on a shared voice ever lands on the same step.

---

## 4. Machine-readable example (Kit 02, BD, CH and CY)

```jsonc
// docs/ELEKTRON_SEQUENCER.md data model; kit values in display units
{
  "kit": {
    "name": "Techno / Warehouse 130", "bpm": 130, "swing": 52,
    "tracks": {
      "1":  { "machine": "BD HARD", "src": { "tun": -2, "dec": 58, "hld": 26, "swt": 52, "snp": 28, "wav": 0, "tic": 88 }, "amp": { "ovr": 32, "vol": 118 } },
      "9":  { "machine": "CH CLASSIC", "src": { "tun": 12, "dec": 16, "col": 18 }, "fltr": { "type": "HP2", "frq": 72, "res": 10 }, "amp": { "pan": 10, "vol": 92 } },
      "11": { "machine": "CY CLASSIC", "src": { "dec": 96, "col": 8, "ton": 16 }, "fltr": { "type": "HP1", "frq": 50 }, "amp": { "rev": 30, "vol": 80 } }
    },
    "fx": { "delay": { "tim": 24, "x": 1, "wid": 40, "fdb": 72, "hpf": 44, "lpf": 84, "rev": 20, "vol": 100 },
            "comp":  { "thr": 72, "atk": "3", "rel": "0.2", "mup": 22, "rat": "1:4", "seq": "LPF", "mix": 100, "vol": 64 } }
  },
  "pattern": { "length": 16, "swing": 52, "tracks": [
    { "vel": 100, "steps": { "0": { "vel": 127 }, "4": {}, "8": {}, "12": {} } },                   // BD  X--- x--- x--- x---
    // ...
    { "vel": 45, "steps": { "1": {}, "3": {}, "5": {}, "7": {}, "9": {}, "11": {}, "13": {}, "15": { "vel": 75 } } }, // CH
    // ...
    { "steps": { "0": { "vel": 100, "cond": "1:4" } } }                                            // CY
  ] }
}
```

## 5. Which kits the lessons use

| Lesson topic | Kit |
|---|---|
| Foundations, ear training | 01 Init |
| Kick and sweep | 02, 13 |
| Hats and choke | 02, 04 |
| Compression | 03, 10 |
| Sends and dub | 05, 12 |
| Ghosts and accents | 07, 15 |
| Conditions | 09, 11 |
| Retrigs | 08, 16 |
| Swing | 18 |
| Arranging | 02 + 03 |
