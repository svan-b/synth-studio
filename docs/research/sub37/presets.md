# Sub 37 / Subsequent 37 presets: factory banks, recreations and classic sounds

Companion to `sources.md` and `signal-flow.md`. Revised 2026-10-29 against the official Moog factory-preset PDFs and manual. Generated from one data table, so every preset states **every** panel parameter in the same order.

## 0. How to read a preset

Values are **panel units**:
- WAVE is knob travel 0–100: TRI 0, SAW 33, SQR 67, narrow PULSE 100.
- FREQUENCY is in semitones (±7, or ±36 in drone mode), and BEAT FREQ in Hz (±3.5).
- Mixer runs 0–10 with unity at 5; above 5 overdrives the filter input (p.27).
- RESONANCE and MULTIDRIVE run 0–10; EG AMT is ±5; KB TRACK runs 0–2 (1 = 1:1).
- Envelope times are in ms or s. SUSTAIN and VEL AMT run 0–10; envelope KB TRACK 0–2.
- Mod amounts are ±5. LFO RATE is in Hz, or a clock division when synced. GLIDE TIME is the panel's 0–10 (no unit is published).
- ARP RATE is in BPM, or a division. Menu values (arp gate, swing, end notes, KB PRIORITY, bend, PRESET VOL) use their documented ranges (pp.40–42).

**Where the settings come from.** Moog does not publish factory **settings**: the sysex format is undocumented, and the PDFs list only bank, number, category and name. So every preset here was **programmed for this project**.
- **Recreations** take a Sub 37 factory preset's **name and category** (verified, Moog PDF) and build the character they imply. Each has a **descriptive twin name** (scratchpad `manuals/COPYRIGHT-RULES.md` rule 5), with the factory name and slot only in its description.
- **Synth Studio originals** are classic Moog techniques.

**Converting to the current twin** (`spec.ts`):
- mixer, RES, DRIVE, SUSTAIN and VEL: ×10 → %
- EG AMT and mod amounts: ×20 → ±% (the twin's mod amounts must become bipolar)
- KB TRACK: ×100 → % (allow 0–200)
- envelope KB TRACK: ×50 → %
- glide TIME: t = 10 ms·1000^(x/10) (guess)
- the JSON in §4 is already converted.

**Line format.** `OSC` · `MIX` · `VCF` · `FEG` · `AEG` (the shifted knobs after `shift:`) · `MOD1` · `MOD2` · `GLIDE` · `ARP` (menu values after `|`) · `PERF` · `SEQ`.
- `CONTROLLERS` gives the bus depth sources (p.50). MOD 1 at "MOD WHEEL +100 %" is the init behaviour (p.22).
- "all OFF (full depth)" is how MOD 2 runs by default (likely).

## 1. Factory banks

### 1.1 Sub 37 factory bank (official: Moog "Sub 37 Factory Presets" PDF)

**Source:** `scratchpad/manuals/sub37/S37presets/text.txt`, by bank and number. The by-name and by-category PDFs are `S37name` and `S37categ`. There are **134 presets, banks 1.1–9.6**; the remaining slots of the 256 (16 × 16, p.12, p.61) were "Init Preset" on Sub 37 units (forum, S5).

**Categories** (19, as printed): arp, bass, brass, classic, distorted, drone, duo, evolving, lead, misc, noise, organs, pads, percussion, sequence, sound-fx, strings, sync, woodwind. The LCD shows the category on the last line and you can browse by it (p.12).

**Recall over MIDI:** CC0 = 0, CC32 = 0 (banks 1–8) or 1 (banks 9–16), then Program Change ((bank−1) mod 8)·16 + (preset−1) (p.53).

**Bank 1**

| # | Category | Name | Recreated here as |
|---|---|---|---|
| 1.1 | duo | `Rhythmic 5th Filtration` | Rhythmic Fifth Filter |
| 1.2 | pads | `DARK MINDS` | Dark Pad |
| 1.3 | bass | `Bomb Bass Tick` | Ticking Boom Bass |
| 1.4 | duo | `Duotronic Moogtrons` | Duo Tape Tones |
| 1.5 | classic | `BRIGHT PWM MOTION` | Bright PWM Keys |
| 1.6 | sequence | `AHSEEEED MOOGER` |  |
| 1.7 | evolving | `Octavia` | Octave Bloom |
| 1.8 | sound-fx | `BAD ATMOS FEAR` |  |
| 1.9 | duo | `Zaxxor's Revenge` |  |
| 1.10 | evolving | `POLEMICS` |  |
| 1.11 | evolving | `RUNNER RUNNING` |  |
| 1.12 | duo | `Werkers Unite` | Robot Workers Duo |
| 1.13 | strings | `STRINGOTRON` | String Machine |
| 1.14 | bass | `Pulse Bass` | Pulse-Wave Bass |
| 1.15 | classic | `Gamecom 8Bit Chiptime Fun` | 8-Bit Chip Arp |
| 1.16 | classic | `1974th` |  |

**Bank 2**

| # | Category | Name | Recreated here as |
|---|---|---|---|
| 2.1 | classic | `CRAFT LABOR` |  |
| 2.2 | distorted | `DAILY GRIND` |  |
| 2.3 | duo | `DUO ORG` | Duo Organ |
| 2.4 | organs | `Organ 2` | Clean Organ |
| 2.5 | pads | `CELESTIAL` | Airy Duo Pad |
| 2.6 | sound-fx | `EMO ALIENS` |  |
| 2.7 | duo | `The Zaxxor Chronicles` |  |
| 2.8 | pads | `2D SPACE` | Space Chatter Pad |
| 2.9 | bass | `FAN+CB A S S` |  |
| 2.10 | noise | `COLD NOISE` | Cold Wind |
| 2.11 | strings | `STRYNGTH` |  |
| 2.12 | lead | `SOFT PRESS 4 SPARKLE` | Pressure Sparkle Lead |
| 2.13 | organs | `Orbital Momentum X85` |  |
| 2.14 | percussion | `DIRTY DRUM` |  |
| 2.15 | misc | `The New Disco` |  |
| 2.16 | classic | `L.A. Freeway Patrol` |  |

**Bank 3**

| # | Category | Name | Recreated here as |
|---|---|---|---|
| 3.1 | misc | `Seeker of Truth` |  |
| 3.2 | lead | `Lyrical Theremin` | Theremin Lead |
| 3.3 | sound-fx | `THE L TRAIN` |  |
| 3.4 | bass | `PERCUSS DUB` | Percussive Dub Bass |
| 3.5 | duo | `DUO WAVE MOD` | Duo Wave Motion |
| 3.6 | percussion | `Analog Kick` | Synth Kick |
| 3.7 | woodwind | `KLARINETIK` | Clarinet |
| 3.8 | distorted | `CLIPPING A LOT` | Clipping Drive |
| 3.9 | classic | `70s TV PI Theme` | 70s TV Detective Lead |
| 3.10 | duo | `A LONG RIDE` | Long Ride Duo Pad |
| 3.11 | percussion | `Cave People Drum` |  |
| 3.12 | duo | `Dirty Organ` |  |
| 3.13 | arp | `BOOM BAH` | Boom-Bah Arp |
| 3.14 | lead | `SUNNY LEAD` | Bright Octave Lead |
| 3.15 | brass | `CYBRASS` | Cyber Brass |
| 3.16 | duo | `Eastern Alliance` |  |

**Bank 4**

| # | Category | Name | Recreated here as |
|---|---|---|---|
| 4.1 | evolving | `HERE HE COMES` |  |
| 4.2 | arp | `RUNAWAY ROBOTS` | Robot Arp |
| 4.3 | duo | `MASS 19-` |  |
| 4.4 | percussion | `Echo Chirp` | Echo Chirp |
| 4.5 | duo | `Gravity: Reversed` |  |
| 4.6 | evolving | `BEETLE ATTACK` |  |
| 4.7 | misc | `TouchBass` | Touch-Sensitive Bass |
| 4.8 | evolving | `HELICCOPPER` |  |
| 4.9 | sync | `Underground Transit` |  |
| 4.10 | classic | `OLDE SYNTHE` |  |
| 4.11 | lead | `ODD ODE` |  |
| 4.12 | sound-fx | `Message From Outer Space` |  |
| 4.13 | sync | `LITTLE GRIND` |  |
| 4.14 | sound-fx | `1970s SciFi Computer` | 70s Computer Bleeps |
| 4.15 | bass | `funk bass` | Funk Slap Bass |
| 4.16 | distorted | `FEEDBACK BEAT PATTERN` |  |

**Bank 5**

| # | Category | Name | Recreated here as |
|---|---|---|---|
| 5.1 | sync | `No Resonance Required` |  |
| 5.2 | bass | `REZZO BASS` | Resonant Squelch Bass |
| 5.3 | brass | `DI^tOR~ED BRA/S` |  |
| 5.4 | duo | `ELEKTPOHNKA Telekom Net` |  |
| 5.5 | lead | `Raw Z` |  |
| 5.6 | bass | `LOW BASS` | Deep Round Bass |
| 5.7 | evolving | `Trajectory Achieved` |  |
| 5.8 | lead | `OLD LEAD` | Vintage Saw Lead |
| 5.9 | organs | `Organ Time` |  |
| 5.10 | evolving | `Sweep It try the weel` |  |
| 5.11 | percussion | `Industrial Machine` |  |
| 5.12 | bass | `RIGID BASS` |  |
| 5.13 | sound-fx | `Main Engines Full Burn` |  |
| 5.14 | distorted | `5TH BOUNCE` |  |
| 5.15 | percussion | `SYNTH DRUM1` | Synth Tom |
| 5.16 | sync | `RISING SYNC` | Rising Sync Lead |

**Bank 6**

| # | Category | Name | Recreated here as |
|---|---|---|---|
| 6.1 | sound-fx | `BUZZINESS AS UNUSUAL` |  |
| 6.2 | bass | `BROKE BASS` |  |
| 6.3 | misc | `Carnival Freak` |  |
| 6.4 | evolving | `LONELY QUEST` |  |
| 6.5 | sound-fx | `The Triax Paradox` |  |
| 6.6 | sync | `SYNC/SNARE` |  |
| 6.7 | bass | `sub BASS` | Sub Bass |
| 6.8 | evolving | `SPARKLE SLIDE` |  |
| 6.9 | duo | `THE INTRO TO THAT ONE` |  |
| 6.10 | lead | `LITTLE LYRIC` | Small Singing Lead |
| 6.11 | organs | `ORGAN GRINDER` | Gritty Organ |
| 6.12 | bass | `FRETTED BASS` |  |
| 6.13 | distorted | `NOISE IMPACT` |  |
| 6.14 | woodwind | `SOFT LEAD WHEEL BRIGHT` |  |
| 6.15 | sound-fx | `Alien Language` |  |
| 6.16 | duo | `SAWTEETH DUO DANCER` | Duo Saw Stabs |

**Bank 7**

| # | Category | Name | Recreated here as |
|---|---|---|---|
| 7.1 | lead | `SMOOTH LEAD MODWHEELSYNC` | Smooth Lead, Wheel Sync |
| 7.2 | lead | `5TH IN LINE` | Fifths Lead |
| 7.3 | percussion | `Percolated` |  |
| 7.4 | misc | `EuroSynth-Tastic` |  |
| 7.5 | misc | `Dr. Press Growl` |  |
| 7.6 | duo | `Duo Distort Artifacts` |  |
| 7.7 | sync | `Hard Sync Hijinxx` | Random Sync Lead |
| 7.8 | bass | `BASS MELT FACE` | Melting Drive Bass |
| 7.9 | misc | `Raymond's Caught` |  |
| 7.10 | percussion | `SYNTH GONG1` | Synth Gong |
| 7.11 | evolving | `RUBBER BANG` |  |
| 7.12 | arp | `RUN!` |  |
| 7.13 | sequence | `B MOVIE` |  |
| 7.14 | classic | `Percusso-phonic Blip` |  |
| 7.15 | sequence | `Gyro House` | House Duo Sequence |
| 7.16 | evolving | `Trill Pickles` |  |

**Bank 8**

| # | Category | Name | Recreated here as |
|---|---|---|---|
| 8.1 | sequence | `Braid Walker` |  |
| 8.2 | sequence | `Acid Wiggler` | Acid Wiggle Sequence |
| 8.3 | drone | `Minor Bender` | Minor Drone |
| 8.4 | lead | `STG Liberatn Lead 2003` |  |
| 8.5 | sequence | `Dorian Electra` |  |
| 8.6 | sequence | `Distortech MW is Accent` |  |
| 8.7 | sequence | `Distortech 2 MW is Accent` |  |
| 8.8 | misc | `Acid Tracks MW is Accent` |  |
| 8.9 | sequence | `Analogue Native Dance` |  |
| 8.10 | misc | `Just Add Kick Drums` |  |
| 8.11 | misc | `Rubber Glass` |  |
| 8.12 | sequence | `What Time Is` |  |
| 8.13 | misc | `Funk Cowboys` |  |
| 8.14 | arp | `Space Banjo MW is Rate` | Space Banjo Arp |
| 8.15 | sequence | `Mushrooms In A Corn Field` |  |
| 8.16 | evolving | `ACROSS THE SKY` | Sky Sweep Pad |

**Bank 9**

| # | Category | Name | Recreated here as |
|---|---|---|---|
| 9.1 | duo | `Up in the Sky` |  |
| 9.2 | evolving | `Tastes Metallic` |  |
| 9.3 | classic | `TRIPLET 5THS` | Triplet Fifths |
| 9.4 | arp | `Interstellar Express` |  |
| 9.5 | sequence | `Intercranial Voyager` |  |
| 9.6 | lead | `Sweet Lead` |  |

### 1.2 Subsequent 37 factory bank (firmware 1.2.0)

**Source:** S3, the Cubase program lists of an official-Editor owner. **20 slots were confirmed on a Subsequent 37 screen** (S2, ✓).

**Layout:** 144 presets in banks 1–9; banks 10–16 hold "Init Preset". Banks 1, 2 and 3.01–3.07 are each alphabetised separately, and 3.08–9.16 is one alphabetical run.

**Overlap with the Sub 37 bank:** **77 of the 144 names** also appear in the Sub 37 bank (69 exact, 8 near-matches marked "≈", such as `SYNTH GONG` ↔ `SYNTH GONG1`), in a different order. The other 67 are new to the Subsequent 37. The right-hand column gives the Sub 37 slot and category.

**Display glyphs:** `2ITTLE GRIND` is the LCD rendering of LITTLE GRIND. The screen shows `SAWTEETH DUO DANCER` (S2).

**Bank 1**

| Slot | Name | Screen ✓ | Same name in the Sub 37 bank |
|---|---|---|---|
| 1.01 | `Analog Delay` |  | — |
| 1.02 | `AngrySweep` |  | — |
| 1.03 | `Bass 21` |  | — |
| 1.04 | `BRASH B@SS` | ✓ | — |
| 1.05 | `DARK MINDS` |  | 1.2 (pads) |
| 1.06 | `Das Model` |  | — |
| 1.07 | `FLANGE-Sy**` |  | — |
| 1.08 | `HARD FUNK BASS` |  | — |
| 1.09 | `Horn-ish Lead` |  | — |
| 1.10 | `Intercranial Voyager` |  | 9.5 (sequence) |
| 1.11 | `KICK BASS` |  | — |
| 1.12 | `LFO As Osc` |  | — |
| 1.13 | `LOW BASS` | ✓ | 5.6 (bass) |
| 1.14 | `STRINGOTRON` |  | 1.13 (strings) |
| 1.15 | `Stringy Lead` |  | — |
| 1.16 | `STRYNGTH` |  | 2.11 (strings) |

**Bank 2**

| Slot | Name | Screen ✓ | Same name in the Sub 37 bank |
|---|---|---|---|
| 2.01 | `ALIASING` |  | — |
| 2.02 | `G~THNG PLAY HIGH` |  | — |
| 2.03 | `MECHA-BATTLE` |  | — |
| 2.04 | `ROOM-TOM` |  | — |
| 2.05 | `Sawyer Sweep` |  | — |
| 2.06 | `SUPER BASS` |  | — |
| 2.07 | `Sweet Roomy Lead` |  | — |
| 2.08 | `Terror Bass` | ✓ | — |
| 2.09 | `THE end...` |  | — |
| 2.10 | `TOY DELAY` |  | — |
| 2.11 | `UBER_SUB` | ✓ | — |
| 2.12 | `UNDER STRESS` |  | — |
| 2.13 | `Vocal Lead` |  | — |
| 2.14 | `WHISTLE` |  | — |
| 2.15 | `YE OLDE SYNTHE` |  | ≈ 4.10 (classic) |
| 2.16 | `ZeL|)@` |  | — |

**Bank 3**

| Slot | Name | Screen ✓ | Same name in the Sub 37 bank |
|---|---|---|---|
| 3.01 | `FUNK ORGAN` | ✓ | — |
| 3.02 | `HAP-E-LEAD` |  | — |
| 3.03 | `Looperang` |  | — |
| 3.04 | `SYN[` |  | — |
| 3.05 | `TAKE THE WHEEL` |  | — |
| 3.06 | `TINE-E` |  | — |
| 3.07 | `TYMPANY HAT` |  | — |
| 3.08 | `2D SPACE` |  | 2.8 (pads) |
| 3.09 | `5TH IN LINE` | ✓ | 7.2 (lead) |
| 3.10 | `70s TV PI Theme` | ✓ | 3.9 (classic) |
| 3.11 | `1974th` |  | 1.16 (classic) |
| 3.12 | `A LONG RIDE` |  | 3.10 (duo) |
| 3.13 | `Acid Wiggler` | ✓ | 8.2 (sequence) |
| 3.14 | `ACROSS THE SKY` |  | 8.16 (evolving) |
| 3.15 | `Aggressor` |  | — |
| 3.16 | `Analog Kick` |  | 3.6 (percussion) |

**Bank 4**

| Slot | Name | Screen ✓ | Same name in the Sub 37 bank |
|---|---|---|---|
| 4.01 | `B MOVIE` |  | 7.13 (sequence) |
| 4.02 | `Bass Lazer` |  | — |
| 4.03 | `BASS MELT FACE` |  | 7.8 (bass) |
| 4.04 | `BOBBLY` |  | — |
| 4.05 | `Bomb Bass Tick` |  | 1.3 (bass) |
| 4.06 | `BOOM BAH` |  | 3.13 (arp) |
| 4.07 | `BRASS ROOM` |  | — |
| 4.08 | `BRIGHT PWM MOTION` |  | 1.5 (classic) |
| 4.09 | `BROKE BASS` |  | 6.2 (bass) |
| 4.10 | `BUZZINESS AS UNUSUAL` |  | 6.1 (sound-fx) |
| 4.11 | `CELESTIAL` | ✓ | 2.5 (pads) |
| 4.12 | `Clipping A Lot More` |  | ≈ 3.8 (distorted) |
| 4.13 | `CRAFT LABOR` |  | 2.1 (classic) |
| 4.14 | `CYBRASS` |  | 3.15 (brass) |
| 4.15 | `Deep Bass 9` |  | — |
| 4.16 | `DI^tOR~ED BRA/S` |  | 5.3 (brass) |

**Bank 5**

| Slot | Name | Screen ✓ | Same name in the Sub 37 bank |
|---|---|---|---|
| 5.01 | `Dirty @cid B@$$` |  | — |
| 5.02 | `DIRTY DRUM` |  | 2.14 (percussion) |
| 5.03 | `DIRTY BRETT BASS` (slot inferred; S3 entry malformed) |  | — |
| 5.04 | `Dirty Organ` |  | 3.12 (duo) |
| 5.05 | `Dorian Electra` |  | 8.5 (sequence) |
| 5.06 | `Dr Bass` |  | — |
| 5.07 | `Dr Lead` |  | — |
| 5.08 | `Dr_Press Growl` |  | 7.5 (misc) |
| 5.09 | `DRONE` | ✓ | — |
| 5.10 | `DUO ORG` | ✓ | 2.3 (duo) |
| 5.11 | `DUO WAVE MOD` | ✓ | 3.5 (duo) |
| 5.12 | `Duotronic Moogtrons` | ✓ | 1.4 (duo) |
| 5.13 | `Eastern Alliance` |  | 3.16 (duo) |
| 5.14 | `EG LOOP` |  | — |
| 5.15 | `FAN+CB A S S` |  | 2.9 (bass) |
| 5.16 | `Fat & Brassy` |  | — |

**Bank 6**

| Slot | Name | Screen ✓ | Same name in the Sub 37 bank |
|---|---|---|---|
| 6.01 | `Fat HARPSI` |  | — |
| 6.02 | `FM Lead` |  | — |
| 6.03 | `Gravity: Reversed` |  | 4.5 (duo) |
| 6.04 | `Happy Brass` |  | — |
| 6.05 | `Harp C Chord` | ✓ | — |
| 6.06 | `HST Hopper` |  | — |
| 6.07 | `In A Corn Field` |  | ≈ 8.15 (sequence) |
| 6.08 | `Industrial Machine` |  | 5.11 (percussion) |
| 6.09 | `Just Add Drums` |  | ≈ 8.10 (misc) |
| 6.10 | `KICK LEAD` |  | — |
| 6.11 | `KLARINETIK` |  | 3.7 (woodwind) |
| 6.12 | `LibertnLead 2003` |  | ≈ 8.4 (lead) |
| 6.13 | `2ITTLE GRIND` |  | ≈ 4.13 (sync) |
| 6.14 | `LITTLE LYRIC` |  | 6.10 (lead) |
| 6.15 | `LoSt PLaNet` |  | — |
| 6.16 | `Lyrical Theremin` |  | 3.2 (lead) |

**Bank 7**

| Slot | Name | Screen ✓ | Same name in the Sub 37 bank |
|---|---|---|---|
| 7.01 | `MASS 19-` |  | 4.3 (duo) |
| 7.02 | `Minor Bender` |  | 8.3 (drone) |
| 7.03 | `Noisy-lin` |  | — |
| 7.04 | `OCTAVE [] + LEAD` |  | — |
| 7.05 | `Octavia` | ✓ | 1.7 (evolving) |
| 7.06 | `ODD ODE` |  | 4.11 (lead) |
| 7.07 | `OLD LEAD` |  | 5.8 (lead) |
| 7.08 | `Orbital Momentum X85` |  | 2.13 (organs) |
| 7.09 | `Organ 2` |  | 2.4 (organs) |
| 7.10 | `ORGAN GRINDER` |  | 6.11 (organs) |
| 7.11 | `Organ Time` |  | 5.9 (organs) |
| 7.12 | `PERCUSS DUB` |  | 3.4 (bass) |
| 7.13 | `Raw Bass 2` |  | — |
| 7.14 | `Raymond's Caught` |  | 7.9 (misc) |
| 7.15 | `Rhythmic 5thFiltration` |  | 1.1 (duo) |
| 7.16 | `RIGID BASS` |  | 5.12 (bass) |

**Bank 8**

| Slot | Name | Screen ✓ | Same name in the Sub 37 bank |
|---|---|---|---|
| 8.01 | `RISING SYNC` |  | 5.16 (sync) |
| 8.02 | `RISING` |  | — |
| 8.03 | `RUBBER BANG` |  | 7.11 (evolving) |
| 8.04 | `Rubberrr` |  | — |
| 8.05 | `RUN!` |  | 7.12 (arp) |
| 8.06 | `RUNNER RUNNING` |  | 1.11 (evolving) |
| 8.07 | `SAW LEAD` | ✓ | — |
| 8.08 | `SAWTEETH DUODANCER` | ✓ | 6.16 (duo) |
| 8.09 | `SMOOTH LEAD MODWHEELSYNC` |  | 7.1 (lead) |
| 8.10 | `SNUFFY` |  | — |
| 8.11 | `SOFT LEAD WHEEL=BRASS` |  | — |
| 8.12 | `SOFT PRESS 4SPARKLE` |  | 2.12 (lead) |
| 8.13 | `SPARKLESLIDE` |  | 6.8 (evolving) |
| 8.14 | `Strobe in the Dar|<` |  | — |
| 8.15 | `SUNNY LEAD` |  | 3.14 (lead) |
| 8.16 | `Synchy` |  | — |

**Bank 9**

| Slot | Name | Screen ✓ | Same name in the Sub 37 bank |
|---|---|---|---|
| 9.01 | `SYNTH GONG` | ✓ | ≈ 7.10 (percussion) |
| 9.02 | `Tastes Metallic` |  | 9.2 (evolving) |
| 9.03 | `TH0NK B@SS` |  | — |
| 9.04 | `THE INTRO TOTHAT ONE` |  | 6.9 (duo) |
| 9.05 | `The Zaxxor Chronicles` |  | 2.7 (duo) |
| 9.06 | `TouchBass` |  | 4.7 (misc) |
| 9.07 | `Trajectory Achieved` |  | 5.7 (evolving) |
| 9.08 | `Triangle Lead` | ✓ | — |
| 9.09 | `Trigger-Bass` |  | — |
| 9.10 | `Trill Pickles` |  | 7.16 (evolving) |
| 9.11 | `TRIPLET 5THS` | ✓ | 9.3 (classic) |
| 9.12 | `Up in the Sky` |  | 9.1 (duo) |
| 9.13 | `Werkers Unite` |  | 1.12 (duo) |
| 9.14 | `WIND PIPE` |  | — |
| 9.15 | `Zaxxor's Revenge` |  | 1.9 (duo) |
| 9.16 | `Zoboe` |  | — |

## 2. Preset-button map for the twin (bank 1, buttons 1–16)

The 16 buttons give a tour in teaching order:
- 1–6: the bass family, the Moog signature (mono bass, round bass, sub, pedal bass, acid, wobble).
- 7–9: the classic leads (vintage saw, sync, theremin).
- 10–11: paraphonic DUO (tape tones, organ).
- 12–13: pads (airy duo pad, string machine).
- 14: the arpeggiator (chip arp).
- 15: pluck.
- 16: FX (gong).

| Button | Twin name | Based on | Family |
|---|---|---|---|
| 1 | Three-Osc Mono Bass | Synth Studio original | Bass |
| 2 | Deep Round Bass | Sub 37 factory 5.6 "LOW BASS" (bass) | Bass |
| 3 | Sub Bass | Sub 37 factory 6.7 "sub BASS" (bass) | Bass |
| 4 | Pedal Bass | Synth Studio original | Bass |
| 5 | Acid Line | Synth Studio original | Bass |
| 6 | Wobble Bass | Synth Studio original | Bass |
| 7 | Vintage Saw Lead | Sub 37 factory 5.8 "OLD LEAD" (lead) | Lead |
| 8 | Sync Scream | Synth Studio original | Lead |
| 9 | Theremin Lead | Sub 37 factory 3.2 "Lyrical Theremin" (lead) | Lead |
| 10 | Duo Tape Tones | Sub 37 factory 1.4 "Duotronic Moogtrons" (duo) | Duo |
| 11 | Gritty Organ | Sub 37 factory 6.11 "ORGAN GRINDER" (organs) | Keys |
| 12 | Airy Duo Pad | Sub 37 factory 2.5 "CELESTIAL" (pads) | Pad |
| 13 | String Machine | Sub 37 factory 1.13 "STRINGOTRON" (strings) | Pad |
| 14 | 8-Bit Chip Arp | Sub 37 factory 1.15 "Gamecom 8Bit Chiptime Fun" (classic) | Keys |
| 15 | Round Pluck | Synth Studio original | Keys |
| 16 | Synth Gong | Sub 37 factory 7.10 "SYNTH GONG1" (percussion) | FX |

## 3. All presets (full parameters)

### 3.1 Bass

Factory categories in this family: bass (and the misc TouchBass).

#### Ticking Boom Bass — Bass

**Recreation.** Based on the Sub 37 factory preset "Bomb Bass Tick" (slot 1.3, category bass; also in the Subsequent 37 bank at 4.05). Settings are ours. A boomy sub-heavy bass with a click ("tick") on every note: KB RESET makes the attack identical each time, and a 15 ms filter-envelope blip adds the tick.

*Play:* Short notes on the beat or the off-beat, MIDI 36–55. Leave space; it booms.

```
OSC   OSC 1 16' SAW>SQR(50) | OSC 2 16' TRI(0) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET on · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 8 · OSC 2 4 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 160 Hz · RESONANCE 1 · MULTIDRIVE 3 · SLOPE 24 dB · EG AMT +4 · KB TRACK 0.5
FEG   A 1 ms · D 15 ms · S 0 · R 40 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET on · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 700 ms · S 0 · R 250 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Pulse-Wave Bass — Bass

**Recreation.** Based on the Sub 37 factory preset "Pulse Bass" (slot 1.14, category bass). Settings are ours. A hollow, moving square-pulse bass: MOD 2 slowly sweeps both wave shapes (pulse-width movement) under a medium filter pluck.

*Play:* Driving eighth-note lines; the slow PWM keeps long notes alive.

```
OSC   OSC 1 16' SQR>PULSE(72) | OSC 2 16' SQR>PULSE(80) FREQUENCY 0 st BEAT FREQ +0.6 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 4 · OSC 2 6 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 330 Hz · RESONANCE 2 · MULTIDRIVE 2 · SLOPE 24 dB · EG AMT +3 · KB TRACK 0.5
FEG   A 1 ms · D 260 ms · S 2 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 600 ms · S 9 · R 120 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 0.7 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST BOTH WAVE · MOD AMT +1.5 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Percussive Dub Bass — Bass

**Recreation.** Based on the Sub 37 factory preset "PERCUSS DUB" (slot 3.4, category bass; also in the Subsequent 37 bank at 7.12). Settings are ours. A short, round dub bass: sub and triangle, a quick downward pitch "thump" from the Filter EG through MOD 2, and a dark 24 dB filter.

*Play:* Dub and reggae lines on the off-beats, MIDI 36–52; let the space between notes do the work.

```
OSC   OSC 1 16' TRI(0) | OSC 2 16' SQR(67) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET on · DUO MODE off · KB CTRL HI
MIX   OSC 1 7 · SUB OSC 7 · OSC 2 3 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 200 Hz · RESONANCE 1.5 · MULTIDRIVE 2 · SLOPE 24 dB · EG AMT +2 · KB TRACK 0.3
FEG   A 1 ms · D 90 ms · S 0 · R 80 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET on · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 380 ms · S 0 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  F.EG/PGM · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT +1.8 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Funk Slap Bass — Bass

**Recreation.** Based on the Sub 37 factory preset "funk bass" (slot 4.15, category bass). Settings are ours. A snappy, resonant funk bass: short filter envelope with strong velocity, every note re-attacked.

*Play:* Staccato 16ths and octave pops; play harder for the slap (VEL AMT 6 on the Filter EG).

```
OSC   OSC 1 16' SAW(33) | OSC 2 8' SQR(67) FREQUENCY 0 st BEAT FREQ +0.3 Hz | HARD SYNC off · KB RESET on · DUO MODE off · KB CTRL HI
MIX   OSC 1 7 · SUB OSC 4 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 350 Hz · RESONANCE 4 · MULTIDRIVE 3 · SLOPE 24 dB · EG AMT +4 · KB TRACK 0.8
FEG   A 1 ms · D 160 ms · S 0.5 · R 120 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 6 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 380 ms · S 6 · R 90 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 4 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Resonant Squelch Bass — Bass

**Recreation.** Based on the Sub 37 factory preset "REZZO BASS" (slot 5.2, category bass). Settings are ours. A rubbery resonant bass: RESONANCE 6.5 under a strong filter envelope, so every note "talks".

*Play:* Mid-tempo lines with some legato slides (LEGATO glide); ride CUTOFF.

```
OSC   OSC 1 16' SAW(33) | OSC 2 16' SAW(33) FREQUENCY -0.1 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 7 · SUB OSC 3 · OSC 2 6 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 280 Hz · RESONANCE 6.5 · MULTIDRIVE 3 · SLOPE 24 dB · EG AMT +3.5 · KB TRACK 0.7
FEG   A 1 ms · D 230 ms · S 1 · R 160 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 500 ms · S 8 · R 120 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 1.5 · EXP · OSC 1+2 · LEGATO on · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Deep Round Bass — Bass · twin button 2

**Recreation.** Based on the Sub 37 factory preset "LOW BASS" (slot 5.6, category bass; also in the Subsequent 37 bank at 1.13). Settings are ours. A deep, round, hollow bass: square plus triangle plus sub with barely any filter movement.

*Play:* Long low notes and root–fifth lines; sits under a kick without fighting it.

```
OSC   OSC 1 16' SQR(67) | OSC 2 16' TRI(0) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 8 · OSC 2 4 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 220 Hz · RESONANCE 1.5 · MULTIDRIVE 1.5 · SLOPE 24 dB · EG AMT +2 · KB TRACK 0.5
FEG   A 2 ms · D 300 ms · S 3 · R 200 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 2 ms · D 800 ms · S 9 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Sub Bass — Bass · twin button 3

**Recreation.** Based on the Sub 37 factory preset "sub BASS" (slot 6.7, category bass). Settings are ours. A sub-oscillator-led sub bass: a near-sine fundamental with just a touch of drive for audibility on small speakers.

*Play:* Single sustained notes in the middle keys (MIDI 48–60); the sub sounds an octave below the 16' oscillator.

```
OSC   OSC 1 16' TRI(0) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 4 · SUB OSC 9 · OSC 2 0 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 160 Hz · RESONANCE 0.5 · MULTIDRIVE 2.5 · SLOPE 24 dB · EG AMT +1 · KB TRACK 0
FEG   A 2 ms · D 250 ms · S 4 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 3 ms · D 900 ms · S 10 · R 120 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Melting Drive Bass — Bass

**Recreation.** Based on the Sub 37 factory preset "BASS MELT FACE" (slot 7.8, category bass; also in the Subsequent 37 bank at 4.03). Settings are ours. A face-melting distorted wobble: mixer past unity, FDBK 7 and MULTIDRIVE 9.5, with a clock-synced filter wobble. PRESET VOL is 70 % for level matching.

*Play:* Hold long notes; the wobble follows the clock (MOD 2 SYNC 1/8).

```
OSC   OSC 1 16' SAW(33) | OSC 2 8' SAW(33) FREQUENCY +0.1 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 9 · SUB OSC 8 · OSC 2 8 · NOISE 0.5 · FDBK/EXT 7   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 240 Hz · RESONANCE 5 · MULTIDRIVE 9.5 · SLOPE 24 dB · EG AMT +1.5 · KB TRACK 0.4
FEG   A 1 ms · D 300 ms · S 3 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 2 ms · D 1 s · S 10 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE SYNC 1/8 · HI RANGE off · KB RESET on · PITCH AMT 0 → OSC 1+2 · FILTER AMT +3 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 70 %
```

#### Touch-Sensitive Bass — Bass

**Recreation.** Based on the Sub 37 factory preset "TouchBass" (slot 4.7, category misc; also in the Subsequent 37 bank at 9.06). Settings are ours. A bass that answers your touch: velocity opens the Filter EG, and aftertouch pushes the cutoff through MOD 2 (PGM SRC CONST ON, depth from AFTERTOUCH).

*Play:* Play dynamically and press into held notes to open them.

```
OSC   OSC 1 16' SAW(33) | OSC 2 16' SQR(67) FREQUENCY 0 st BEAT FREQ +0.4 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 5 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 300 Hz · RESONANCE 2.5 · MULTIDRIVE 3 · SLOPE 24 dB · EG AMT +2.5 · KB TRACK 0.5
FEG   A 2 ms · D 280 ms · S 2 · R 180 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 8 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 600 ms · S 9 · R 140 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 5 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  F.EG/PGM (PGM SRC CONST ON) · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT +2.5 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: AFTERTOUCH +100 %
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Three-Osc Mono Bass — Bass · twin button 1

**Synth Studio original** (classic technique). A classic 70s three-oscillator mono bass in the Minimoog style.
- Two 16' saws a hair apart, with the sub standing in for the third oscillator.
- The mixer is pushed past unity into the ladder.
- FDBK recreates the old "output into the external input" feedback trick.
- KB TRACK 0.33 matches that instrument's 1/3 keyboard-control setting.
- KB PRIORITY LOW and single trigger give the low-note-wins feel.

*Play:* 70s funk and prog basslines, MIDI 36–60. Hold a note and tap a higher one: the low note wins.

```
OSC   OSC 1 16' SAW(33) | OSC 2 16' SAW(33) FREQUENCY -0.08 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 8 · SUB OSC 4 · OSC 2 7 · NOISE 0 · FDBK/EXT 2.5   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 260 Hz · RESONANCE 2 · MULTIDRIVE 2 · SLOPE 24 dB · EG AMT +3 · KB TRACK 0.33
FEG   A 2 ms · D 350 ms · S 3 · R 200 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 600 ms · S 9 · R 120 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.3 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LOW · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Pedal Bass — Bass · twin button 4

**Synth Studio original** (classic technique). A bass-pedal sound in the style of the Taurus: two fat 16' saws plus a loud sub, a slow-ish filter bloom, notes that ring, and glide between them.

*Play:* One finger: whole and half notes on the lowest keys (MIDI 36–48), as if with your feet; let notes ring under chords.

```
OSC   OSC 1 16' SAW(33) | OSC 2 16' SAW(33) FREQUENCY +0.12 st BEAT FREQ +0.4 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 7 · SUB OSC 8 · OSC 2 6 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 180 Hz · RESONANCE 2.5 · MULTIDRIVE 3 · SLOPE 24 dB · EG AMT +3.5 · KB TRACK 0
FEG   A 30 ms · D 700 ms · S 2 · R 800 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 15 ms · D 1.5 s · S 8 · R 900 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 2.5 · LCT · OSC 1+2 · LEGATO on · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Acid Line — Bass · twin button 5

**Synth Studio original** (classic technique). A classic acid line using Moog's own Quickstart tip (legato glide, EXP, GLIDE TIME 2): one saw, RESONANCE 7 just below self-oscillation, an 18 dB slope, a short decay, single-trigger envelopes. Tied steps slide without retriggering (manual p.17).

*Play:* Run the 16-step sequence (PATTERN SEQ); ride CUTOFF, EG AMT and RESONANCE.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 7 · SUB OSC 0 · OSC 2 0 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 450 Hz · RESONANCE 7 · MULTIDRIVE 4 · SLOPE 18 dB · EG AMT +3.5 · KB TRACK 1
FEG   A 1 ms · D 180 ms · S 0 · R 120 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 5 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 250 ms · S 8 · R 60 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 2 · EXP · OSC 1+2 · LEGATO on · GATED off
ARP   on · RATE SYNC 1/16 · RANGE 0 · PATTERN SEQ · BACK/FORTH off · INVERT off · LATCH on | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
SEQ   steps: C2 . C3~ C2 | Eb2 C2 Bb1~ C2 | . G2~ G1 C3 | Bb1 C2~ Eb2 F2
```

#### Wobble Bass — Bass · twin button 6

**Synth Studio original** (classic technique). A clock-synced wobble: a MOD 2 triangle at 1/8 on the cutoff of a resonant, driven bass with a heavy sub; the wheel adds a 1/16 square layer (MOD 1).

*Play:* Hold long notes and change MOD 2's division each bar (1/8, 1/16, 1/8 T). It needs the clock.

```
OSC   OSC 1 16' SAW(33) | OSC 2 16' SQR(67) FREQUENCY -0.1 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 8 · SUB OSC 8 · OSC 2 7 · NOISE 0 · FDBK/EXT 3   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 200 Hz · RESONANCE 4.5 · MULTIDRIVE 6.5 · SLOPE 24 dB · EG AMT +0.5 · KB TRACK 0.3
FEG   A 1 ms · D 300 ms · S 10 · R 100 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 2 ms · D 1 s · S 10 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  SQR · RATE SYNC 1/16 · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT +2 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE SYNC 1/8 · HI RANGE off · KB RESET on · PITCH AMT 0 → OSC 1+2 · FILTER AMT +3 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

### 3.2 Lead

Factory categories in this family: lead and sync.

#### Theremin Lead — Lead · twin button 9

**Recreation.** Based on the Sub 37 factory preset "Lyrical Theremin" (slot 3.2, category lead; also in the Subsequent 37 bank at 6.16). Settings are ours. A theremin imitation: a near-sine (filtered triangle), slow exponential glide on every note, constant gentle vibrato plus wheel vibrato, and bend ±12.

*Play:* Slow, singing lines; let every note swoop into the next.

```
OSC   OSC 1 8' TRI(0) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 7 · SUB OSC 0 · OSC 2 0 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 900 Hz · RESONANCE 0 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT 0 · KB TRACK 1
FEG   A 1 ms · D 300 ms · S 10 · R 100 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 80 ms · D 400 ms · S 10 · R 600 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 6 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.5 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 5.2 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.15 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 4.5 · EXP · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +12 / DOWN -12 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Bright Octave Lead — Lead

**Recreation.** Based on the Sub 37 factory preset "SUNNY LEAD" (slot 3.14, category lead; also in the Subsequent 37 bank at 8.15). Settings are ours. A bright, cheerful lead: two saws an octave apart, the filter well open, quick wheel vibrato and a short constant-time glide.

*Play:* Upbeat melodies in the upper half of the keyboard.

```
OSC   OSC 1 8' SAW(33) | OSC 2 4' SAW(33) FREQUENCY 0 st BEAT FREQ +0.4 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 0 · OSC 2 4 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 3.50 kHz · RESONANCE 1 · MULTIDRIVE 2 · SLOPE 24 dB · EG AMT +1.5 · KB TRACK 1
FEG   A 2 ms · D 400 ms · S 6 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 2 ms · D 500 ms · S 9 · R 250 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 6 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.35 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 1.5 · LCT · OSC 1+2 · LEGATO on · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Vintage Saw Lead — Lead · twin button 7

**Recreation.** Based on the Sub 37 factory preset "OLD LEAD" (slot 5.8, category lead; also in the Subsequent 37 bank at 7.07). Settings are ours. A 70s solo lead in the Minimoog manner: two detuned saws driving the ladder, medium decay, exponential glide.

*Play:* 70s-style solos with glide between notes and vibrato from the wheel.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY -0.1 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6.5 · SUB OSC 0 · OSC 2 6.5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.40 kHz · RESONANCE 3 · MULTIDRIVE 2 · SLOPE 24 dB · EG AMT +2 · KB TRACK 0.8
FEG   A 10 ms · D 600 ms · S 5 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 4 ms · D 500 ms · S 9 · R 250 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5.5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.35 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 2 · EXP · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Small Singing Lead — Lead

**Recreation.** Based on the Sub 37 factory preset "LITTLE LYRIC" (slot 6.10, category lead; also in the Subsequent 37 bank at 6.14). Settings are ours. A small, sweet lead: triangle and square blended soft, a gentle filter, legato glide and wheel vibrato.

*Play:* Quiet melodies and counter-lines; overlap notes to slide.

```
OSC   OSC 1 8' TRI>SAW(10) | OSC 2 8' SAW>SQR(60) FREQUENCY 0 st BEAT FREQ +0.3 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 0 · OSC 2 3 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.80 kHz · RESONANCE 1 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +1 · KB TRACK 1
FEG   A 20 ms · D 500 ms · S 6 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 15 ms · D 400 ms · S 9 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5.2 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.3 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 2 · EXP · OSC 1+2 · LEGATO on · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Smooth Lead, Wheel Sync — Lead

**Recreation.** Based on the Sub 37 factory preset "SMOOTH LEAD MODWHEELSYNC" (slot 7.1, category lead; also in the Subsequent 37 bank at 8.09). Settings are ours. A smooth lead that turns into a sync scream as you push the wheel: MOD 1 (wheel depth) raises the synced OSC 2. FILTER EG SUSTAIN 10 makes MOD 1's F.EG source a steady level while a key is held.

*Play:* A legato melody with the wheel down; push the wheel on the climax notes.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ +0.4 Hz | HARD SYNC on · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 0 · OSC 2 7 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 2.20 kHz · RESONANCE 1.5 · MULTIDRIVE 2 · SLOPE 24 dB · EG AMT 0 · KB TRACK 1
FEG   A 40 ms · D 300 ms · S 10 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 8 ms · D 500 ms · S 9 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  F.EG/PGM · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT +4 → OSC 2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 2.5 · EXP · OSC 1+2 · LEGATO on · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Fifths Lead — Lead

**Recreation.** Based on the Sub 37 factory preset "5TH IN LINE" (slot 7.2, category lead; also in the Subsequent 37 bank at 3.09). Settings are ours. A power-fifth lead: OSC 2 a fifth above (FREQUENCY +7), so one finger plays an open fifth; a bright filter with medium bite.

*Play:* Riffs and melodies where every note is a power chord.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY +7 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 2 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.60 kHz · RESONANCE 2 · MULTIDRIVE 3 · SLOPE 24 dB · EG AMT +2.5 · KB TRACK 0.8
FEG   A 2 ms · D 350 ms · S 5 · R 250 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 2 ms · D 500 ms · S 9 · R 250 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5.5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.3 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Pressure Sparkle Lead — Lead

**Recreation.** Based on the Sub 37 factory preset "SOFT PRESS 4 SPARKLE" (slot 2.12, category lead; also in the Subsequent 37 bank at 8.12). Settings are ours. A soft lead that sparkles when you press into the keys: aftertouch scales a fast wave-shape wobble on the octave-up OSC 2 (MOD 2 depth from AFTERTOUCH).

*Play:* Play softly, then lean into long notes for the sparkle.

```
OSC   OSC 1 8' TRI(0) | OSC 2 4' SQR(67) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 0 · OSC 2 3 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 2.00 kHz · RESONANCE 1 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +0.5 · KB TRACK 1
FEG   A 60 ms · D 900 ms · S 7 · R 500 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 40 ms · D 800 ms · S 9 · R 500 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 6 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST OSC 2 WAVE · MOD AMT +2 · CONTROLLERS: AFTERTOUCH +100 %
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Rising Sync Lead — Lead

**Recreation.** Based on the Sub 37 factory preset "RISING SYNC" (slot 5.16, category sync; also in the Subsequent 37 bank at 8.01). Settings are ours. A hard-sync lead whose tone climbs while you hold: a slow Filter EG attack sweeps the synced OSC 2 up through MOD 2.

*Play:* Long held notes; the sync sweep rises over about a second.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY +2 st BEAT FREQ 0 Hz | HARD SYNC on · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 2 · SUB OSC 0 · OSC 2 9 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 2.40 kHz · RESONANCE 1.5 · MULTIDRIVE 3.5 · SLOPE 24 dB · EG AMT +1.5 · KB TRACK 1
FEG   A 900 ms · D 1.5 s · S 6 · R 400 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 5 ms · D 600 ms · S 9 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5.5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.35 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  F.EG/PGM · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT +4 → OSC 2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Random Sync Lead — Lead

**Recreation.** Based on the Sub 37 factory preset "Hard Sync Hijinxx" (slot 7.7, category sync). Settings are ours. A playful sync lead: a sample-and-hold LFO throws the synced OSC 2 to a new pitch eight times a second, so the timbre jumps randomly while the pitch stays put.

*Play:* Sustained notes and simple riffs; the random sync colours do the talking.

```
OSC   OSC 1 8' SAW(33) | OSC 2 4' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC on · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 2 · SUB OSC 0 · OSC 2 8 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 3.00 kHz · RESONANCE 1.5 · MULTIDRIVE 3 · SLOPE 24 dB · EG AMT +1 · KB TRACK 1
FEG   A 2 ms · D 500 ms · S 6 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 2 ms · D 500 ms · S 9 · R 250 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5.5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.3 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  S&H · RATE 8 Hz · HI RANGE off · KB RESET off · PITCH AMT +2.5 → OSC 2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Sync Scream — Lead · twin button 8

**Synth Studio original** (classic technique). The textbook hard-sync lead: OSC 2 slaved to OSC 1, its pitch swept down by the Filter EG through MOD 2, so every note tears open and settles.

*Play:* Detached notes scream; legato notes stay smooth (MULTI TRIG off).

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY +3 st BEAT FREQ 0 Hz | HARD SYNC on · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 2 · SUB OSC 0 · OSC 2 9 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 2.60 kHz · RESONANCE 1 · MULTIDRIVE 4 · SLOPE 24 dB · EG AMT +1.5 · KB TRACK 1
FEG   A 1 ms · D 700 ms · S 3 · R 400 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 2 ms · D 600 ms · S 9 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5.5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.35 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  F.EG/PGM · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT +4 → OSC 2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 1.5 · LCT · OSC 1+2 · LEGATO on · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Prog Portamento Lead — Lead

**Synth Studio original** (classic technique). A 70s prog-rock solo lead: saw plus a square an octave up, slow exponential glide on every note, deep wheel vibrato.

*Play:* Wide leaps, to show off the swoop; vibrato on long notes.

```
OSC   OSC 1 8' SAW(33) | OSC 2 4' SQR(67) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 0 · OSC 2 3 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.60 kHz · RESONANCE 3 · MULTIDRIVE 2.5 · SLOPE 24 dB · EG AMT +2 · KB TRACK 1
FEG   A 20 ms · D 800 ms · S 6 · R 400 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 5 ms · D 600 ms · S 9 · R 400 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 6 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.45 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 4 · EXP · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### West-Coast Whistle — Lead

**Synth Studio original** (classic technique). A 90s West-coast whistle lead: a near-sine (filtered triangle), constant light vibrato, legato glide, played high.

*Play:* High (KB OCTAVE +1, MIDI 72–96), slow sliding melodies.

```
OSC   OSC 1 8' TRI(0) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 0 · OSC 2 0 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.20 kHz · RESONANCE 0 · MULTIDRIVE 0 · SLOPE 24 dB · EG AMT 0 · KB TRACK 1
FEG   A 1 ms · D 300 ms · S 10 · R 100 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 20 ms · D 300 ms · S 10 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5.5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.35 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 5.3 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.12 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 2.5 · EXP · OSC 1+2 · LEGATO on · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

### 3.3 Pad

Factory categories in this family: pads, strings, evolving and drone.

#### Dark Pad — Pad

**Recreation.** Based on the Sub 37 factory preset "DARK MINDS" (slot 1.2, category pads; also in the Subsequent 37 bank at 1.05). Settings are ours. A dark, slow pad: detuned low saws behind a closed 24 dB filter that opens slowly, with a very slow filter LFO.

*Play:* Hold low notes for bars at a time; minor keys.

```
OSC   OSC 1 16' SAW(33) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ +0.8 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 2 · OSC 2 5 · NOISE 0.5 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 260 Hz · RESONANCE 3 · MULTIDRIVE 1 · SLOPE 24 dB · EG AMT +2 · KB TRACK 0.5
FEG   A 2.5 s · D 4 s · S 4 · R 3 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1.5 s · D 2 s · S 10 · R 3.5 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 0.12 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT +0.8 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Airy Duo Pad — Pad · twin button 12

**Recreation.** Based on the Sub 37 factory preset "CELESTIAL" (slot 2.5, category pads; also in the Subsequent 37 bank at 4.11). Settings are ours. An airy two-voice pad: BEAT FREQ shimmer, pink-noise air and a slow wave-shape LFO.

*Play:* Hold two notes (DUO): an octave closing to a third over four chords.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ +1 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 0 · OSC 2 5 · NOISE 1 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 900 Hz · RESONANCE 2 · MULTIDRIVE 0.5 · SLOPE 12 dB · EG AMT +1.5 · KB TRACK 0.8
FEG   A 1.5 s · D 3 s · S 6 · R 2.5 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1.2 s · D 2 s · S 9 · R 3 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.2 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 0.25 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT +0.4 · DEST BOTH WAVE · MOD AMT +1 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Space Chatter Pad — Pad

**Recreation.** Based on the Sub 37 factory preset "2D SPACE" (slot 2.8, category pads; also in the Subsequent 37 bank at 3.08). Settings are ours. A sci-fi space pad: sample and hold on a resonant filter, noise, and a fifth an octave up.

*Play:* Sparse notes; let the random filter steps chatter.

```
OSC   OSC 1 8' TRI(0) | OSC 2 4' SAW(33) FREQUENCY +7 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 0 · OSC 2 3 · NOISE 2 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.20 kHz · RESONANCE 6 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +1 · KB TRACK 1
FEG   A 800 ms · D 2 s · S 6 · R 2.5 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 600 ms · D 2 s · S 9 · R 3.5 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 0.3 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.3 → OSC 2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  S&H · RATE 4 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT +1.5 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### String Machine — Pad · twin button 13

**Recreation.** Based on the Sub 37 factory preset "STRINGOTRON" (slot 1.13, category strings; also in the Subsequent 37 bank at 1.14). Settings are ours. A 70s string-machine ensemble: two wave-modulated squares (PWM), slow attack, two voices.

*Play:* Two-note string lines (octaves, thirds, sixths).

```
OSC   OSC 1 8' SQR(70) | OSC 2 8' SQR(64) FREQUENCY 0 st BEAT FREQ +0.8 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 0 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 2.20 kHz · RESONANCE 0.5 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +0.5 · KB TRACK 1
FEG   A 400 ms · D 1 s · S 8 · R 900 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 350 ms · D 1 s · S 9 · R 1.2 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5.5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.2 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 0.6 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST BOTH WAVE · MOD AMT +1.5 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Sky Sweep Pad — Pad

**Recreation.** Based on the Sub 37 factory preset "ACROSS THE SKY" (slot 8.16, category evolving; also in the Subsequent 37 bank at 3.14). Settings are ours. A big evolving pad: saw plus a fifth (FREQUENCY +7), a resonant filter swept by a four-second Filter EG, slow constant-time glide.

*Play:* Hold notes for several bars; slide slowly between them.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY +7 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 2 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 300 Hz · RESONANCE 4 · MULTIDRIVE 1.5 · SLOPE 24 dB · EG AMT +3.5 · KB TRACK 0.5
FEG   A 4 s · D 5 s · S 3 · R 4 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1.5 s · D 3 s · S 9 · R 4 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 0.15 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT +0.6 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 4 · LCT · OSC 1+2 · LEGATO on · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Octave Bloom — Pad

**Recreation.** Based on the Sub 37 factory preset "Octavia" (slot 1.7, category evolving; also in the Subsequent 37 bank at 7.05). Settings are ours. An evolving octave texture: OSC 2 an octave up with a slowly morphing wave, under a looping Filter EG (a 6-second multistage LFO).

*Play:* Hold one note; the octave above blooms and recedes by itself.

```
OSC   OSC 1 8' SAW(33) | OSC 2 4' SQR(67) FREQUENCY 0 st BEAT FREQ +0.5 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 0 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 500 Hz · RESONANCE 3.5 · MULTIDRIVE 0 · SLOPE 24 dB · EG AMT +2.5 · KB TRACK 0.7
FEG   A 1.5 s · D 2.5 s · S 0 · R 2 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP on · LATCH ON off · EXP.ATK off
AEG   A 400 ms · D 1.5 s · S 10 · R 2.5 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 0.2 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST OSC 2 WAVE · MOD AMT +2 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Minor Drone — Pad

**Recreation.** Based on the Sub 37 factory preset "Minor Bender" (slot 8.3, category drone; also in the Subsequent 37 bank at 7.02). Settings are ours. A drone to bend against: DUO with KB CTRL OFF parks OSC 2 on a fixed low note, while the PITCH wheel (BEND DEST OSC1, up +3) bends OSC 1 a minor third.

*Play:* Hold a key, then bend into the minor third and back; press AMP EG LATCH ON for an endless drone.

```
OSC   OSC 1 8' SAW(33) | OSC 2 16' SQR(67) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL OFF
MIX   OSC 1 5 · SUB OSC 2 · OSC 2 6 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 500 Hz · RESONANCE 4 · MULTIDRIVE 3 · SLOPE 24 dB · EG AMT +1 · KB TRACK 0.5
FEG   A 2 s · D 4 s · S 5 · R 4 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1.5 s · D 1 s · S 10 · R 5 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 0.1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT +1.2 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +3 / DOWN -2 st · BEND DEST OSC1 · PRESET VOL 100 %
```

### 3.4 Keys

Factory categories in this family: organs, brass, woodwind and classic.

#### Clean Organ — Keys

**Recreation.** Based on the Sub 37 factory preset "Organ 2" (slot 2.4, category organs; also in the Subsequent 37 bank at 7.09). Settings are ours. A clean drawbar-style organ: square at 8' plus an octave-up square, the sub as the 16' foot, an instant on/off envelope and wheel vibrato.

*Play:* Sustained chords as single lines or held notes (mono); a slight vibrato on the wheel.

```
OSC   OSC 1 8' SQR(67) | OSC 2 4' SQR(67) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 3 · OSC 2 4 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 4.00 kHz · RESONANCE 0 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT 0 · KB TRACK 1
FEG   A 1 ms · D 300 ms · S 10 · R 100 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 3 ms · D 100 ms · S 10 · R 60 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 6.5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.15 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Gritty Organ — Keys · twin button 11

**Recreation.** Based on the Sub 37 factory preset "ORGAN GRINDER" (slot 6.11, category organs; also in the Subsequent 37 bank at 7.10). Settings are ours. A gritty two-voice organ: square plus pulse, the sub as the 16' drawbar, FDBK like an overdriven amp, and a wheel tremolo (MOD 1 to VCA LEVEL).

*Play:* Two-note stabs on the 16th before each beat (DUO); push the wheel for a fast rotary-style tremolo.

```
OSC   OSC 1 8' SQR(67) | OSC 2 8' SQR>PULSE(90) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET on · DUO MODE on · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 3 · OSC 2 6 · NOISE 0 · FDBK/EXT 1.5   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 3.50 kHz · RESONANCE 0 · MULTIDRIVE 3.5 · SLOPE 12 dB · EG AMT +1 · KB TRACK 1
FEG   A 1 ms · D 80 ms · S 8 · R 60 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 2 ms · D 200 ms · S 10 · R 40 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 6.5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.12 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT +0.6 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Cyber Brass — Keys

**Recreation.** Based on the Sub 37 factory preset "CYBRASS" (slot 3.15, category brass; also in the Subsequent 37 bank at 4.14). Settings are ours. Synth brass with an electronic edge: detuned saws, a filter swell with velocity, and a little hard sync on OSC 2 for the metallic "cyber" bite.

*Play:* Brass stabs and swells; play harder for more bite.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY +1.5 st BEAT FREQ 0 Hz | HARD SYNC on · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 2 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 500 Hz · RESONANCE 1 · MULTIDRIVE 2.5 · SLOPE 24 dB · EG AMT +3 · KB TRACK 0.7
FEG   A 80 ms · D 500 ms · S 5 · R 250 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 5 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 20 ms · D 600 ms · S 9 · R 250 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.3 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Clarinet — Keys

**Recreation.** Based on the Sub 37 factory preset "KLARINETIK" (slot 3.7, category woodwind; also in the Subsequent 37 bank at 6.11). Settings are ours. A clarinet: a hollow square wave (odd harmonics only), a breath of pink noise, a gentle filter swell and wheel vibrato.

*Play:* Woodwind lines in the middle register (MIDI 50–70), legato phrasing.

```
OSC   OSC 1 8' SQR(67) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 7 · SUB OSC 0 · OSC 2 0 · NOISE 0.8 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.60 kHz · RESONANCE 0.5 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +1 · KB TRACK 1
FEG   A 60 ms · D 400 ms · S 7 · R 200 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 40 ms · D 300 ms · S 9 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 4 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5.2 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.25 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 1.5 · EXP · OSC 1+2 · LEGATO on · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Bright PWM Keys — Keys

**Recreation.** Based on the Sub 37 factory preset "BRIGHT PWM MOTION" (slot 1.5, category classic; also in the Subsequent 37 bank at 4.08). Settings are ours. A classic bright PWM sound: both oscillators near square with MOD 2 sweeping their width, the filter open, two voices.

*Play:* Chordal two-note parts and riffs; the motion makes long notes shimmer.

```
OSC   OSC 1 8' SQR>PULSE(72) | OSC 2 8' SQR>PULSE(78) FREQUENCY 0 st BEAT FREQ +0.7 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 0 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 4.50 kHz · RESONANCE 1 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +1 · KB TRACK 1
FEG   A 5 ms · D 600 ms · S 7 · R 400 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 5 ms · D 600 ms · S 9 · R 400 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1.2 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST BOTH WAVE · MOD AMT +2 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### 70s TV Detective Lead — Keys

**Recreation.** Based on the Sub 37 factory preset "70s TV PI Theme" (slot 3.9, category classic; also in the Subsequent 37 bank at 3.10). Settings are ours. A funky 70s TV-detective lead: saw plus square, a resonant bite, two voices for fourths and fifths, a short glide.

*Play:* A four-note riff shape played three times, a step lower each time; two-note fourths for punch.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SQR(67) FREQUENCY 0 st BEAT FREQ +0.5 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 2 · OSC 2 6 · NOISE 0 · FDBK/EXT 1   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.20 kHz · RESONANCE 3.5 · MULTIDRIVE 2.5 · SLOPE 24 dB · EG AMT +2.5 · KB TRACK 1
FEG   A 5 ms · D 350 ms · S 4 · R 200 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 3 ms · D 400 ms · S 8 · R 200 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5.5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.3 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 1.5 · LCT · OSC 1+2 · LEGATO on · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### 8-Bit Chip Arp — Keys · twin button 14

**Recreation.** Based on the Sub 37 factory preset "Gamecom 8Bit Chiptime Fun" (slot 1.15, category classic). Settings are ours. A video-game chip sound: a narrow pulse at 4' with the filter wide open, and a fast UP arpeggio that turns any held chord into a chiptune arpeggio. Short gate.

*Play:* Hold a three- or four-note chord; change chords on the beat.

```
OSC   OSC 1 4' SQR>PULSE(85) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 0 · OSC 2 0 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 20.00 kHz · RESONANCE 0 · MULTIDRIVE 0 · SLOPE 24 dB · EG AMT 0 · KB TRACK 1
FEG   A 1 ms · D 300 ms · S 10 · R 100 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 100 ms · S 8 · R 30 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   on · RATE SYNC 1/32 · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 60 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Round Pluck — Keys · twin button 15

**Synth Studio original** (classic technique). A short, round pluck: filter and amp both decay with no sustain, and KB TRACK 1.2 keeps high notes bright.

*Play:* Arpeggios, staccato two-note chords (DUO) and melodies.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SQR(67) FREQUENCY +0.06 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET on · DUO MODE on · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 0 · OSC 2 4 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 380 Hz · RESONANCE 2.5 · MULTIDRIVE 0 · SLOPE 24 dB · EG AMT +3.5 · KB TRACK 1.2
FEG   A 1 ms · D 220 ms · S 0 · R 220 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 5 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 500 ms · S 0 · R 400 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 3 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Brass Swell — Keys

**Synth Studio original** (classic technique). Classic synth brass: detuned saws, a 250 ms filter-attack swell, velocity for the "blat".

*Play:* Long notes and swells; two-voice brass lines (DUO).

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY +0.1 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 2 · OSC 2 6 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 450 Hz · RESONANCE 0.5 · MULTIDRIVE 2 · SLOPE 24 dB · EG AMT +3 · KB TRACK 0.8
FEG   A 250 ms · D 900 ms · S 5 · R 400 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 4 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 120 ms · D 900 ms · S 9 · R 400 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.3 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

### 3.5 Arp

Factory categories in this family: arp, sequence and classic.

#### Boom-Bah Arp — Arp

**Recreation.** Based on the Sub 37 factory preset "BOOM BAH" (slot 3.13, category arp; also in the Subsequent 37 bank at 4.06). Settings are ours. An arpeggio that alternates low "boom" and high "bah": RANGE +1 with INVERT plays each note and then its octave before moving on (C, C', E, E'…).

*Play:* Hold a two- or three-note chord low on the keyboard; it bounces between octaves.

```
OSC   OSC 1 16' SAW(33) | OSC 2 16' SQR(67) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 3 · OSC 2 4 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 450 Hz · RESONANCE 3 · MULTIDRIVE 2 · SLOPE 24 dB · EG AMT +3 · KB TRACK 1
FEG   A 1 ms · D 180 ms · S 0 · R 120 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 300 ms · S 3 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   on · RATE SYNC 1/8 · RANGE +1 · PATTERN UP · BACK/FORTH off · INVERT on · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Robot Arp — Arp

**Recreation.** Based on the Sub 37 factory preset "RUNAWAY ROBOTS" (slot 4.2, category arp). Settings are ours. Runaway robot chatter: a random-order arpeggio over two octaves, with sample-and-hold on a resonant filter.

*Play:* Hold a chord and let it run; ride the RESONANCE.

```
OSC   OSC 1 8' SQR(67) | OSC 2 4' SQR>PULSE(90) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 0 · OSC 2 4 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 900 Hz · RESONANCE 6 · MULTIDRIVE 0 · SLOPE 24 dB · EG AMT +2 · KB TRACK 1
FEG   A 1 ms · D 120 ms · S 0 · R 80 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 150 ms · S 2 · R 80 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  S&H · RATE SYNC 1/16 · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT +2 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   on · RATE SYNC 1/16 · RANGE +1 · PATTERN RND · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Space Banjo Arp — Arp

**Recreation.** Based on the Sub 37 factory preset "Space Banjo MW is Rate" (slot 8.14, category arp). Settings are ours. A plucky, twangy arpeggio whose speed you play with the MOD wheel. MOD 1 (wheel depth) uses PGM SRC CONST ON and PGM DST ARP RATE, so the wheel is a rate fader.

*Play:* Hold a chord, start slow, and push the wheel to speed it up.

```
OSC   OSC 1 8' SQR>PULSE(90) | OSC 2 4' SQR>PULSE(80) FREQUENCY 0 st BEAT FREQ +0.5 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 0 · OSC 2 4 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 700 Hz · RESONANCE 3 · MULTIDRIVE 0 · SLOPE 24 dB · EG AMT +3.5 · KB TRACK 1.2
FEG   A 1 ms · D 140 ms · S 0 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 400 ms · S 0 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  F.EG/PGM (PGM SRC CONST ON) · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST EG TIME/PGM (PGM DST ARP RATE) · MOD AMT +3 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   on · RATE 90 BPM · RANGE +1 · PATTERN UP · BACK/FORTH on · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Acid Wiggle Sequence — Arp

**Recreation.** Based on the Sub 37 factory preset "Acid Wiggler" (slot 8.2, category sequence; also in the Subsequent 37 bank at 3.13). Settings are ours. An acid sequence with a wiggle: a resonant 18 dB saw line with legato glide on the tied steps and a slow LFO wobbling the cutoff.

*Play:* Start it (PATTERN SEQ, ON, hold or latch a key); ride CUTOFF and RESONANCE.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 7 · SUB OSC 2 · OSC 2 0 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 520 Hz · RESONANCE 7 · MULTIDRIVE 4 · SLOPE 18 dB · EG AMT +3.5 · KB TRACK 1
FEG   A 1 ms · D 220 ms · S 0 · R 100 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 4 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 280 ms · S 7 · R 70 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 2 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT +1 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE on · TIME 2 · EXP · OSC 1+2 · LEGATO on · GATED off
ARP   on · RATE SYNC 1/16 · RANGE 0 · PATTERN SEQ · BACK/FORTH off · INVERT off · LATCH on | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
SEQ   steps: C2 C2 C3~ C2 | . C2 Eb2~ F2 | C2 . C3 Bb1~ | C2 G1 C2~ C3
```

#### House Duo Sequence — Arp

**Recreation.** Based on the Sub 37 factory preset "Gyro House" (slot 7.15, category sequence). Settings are ours. A house groove from the duo sequencer: two-note organ-style steps (written C3+F3) on the off-beats, recorded in DUO MODE.

*Play:* Start it with PATTERN SEQ and ON, then hold a key to transpose. Two-note steps play both pitches.

```
OSC   OSC 1 8' SQR(67) | OSC 2 8' SQR(67) FREQUENCY 0 st BEAT FREQ +0.4 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 2 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.80 kHz · RESONANCE 2 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +2 · KB TRACK 1
FEG   A 1 ms · D 150 ms · S 2 · R 100 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 200 ms · S 4 · R 80 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   on · RATE SYNC 1/16 · RANGE 0 · PATTERN SEQ · BACK/FORTH off · INVERT off · LATCH on | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
SEQ   steps: . . C3+F3 . | . . C3+F3 . | . . C3+G3 . | . C3+F3 . C3+Eb3
```

#### Triplet Fifths — Arp

**Recreation.** Based on the Sub 37 factory preset "TRIPLET 5THS" (slot 9.3, category classic; also in the Subsequent 37 bank at 9.11). Settings are ours. Stacked fifths (FREQUENCY +7) arpeggiated over three octaves, so every key makes a group of three: triplet accents across the beat.

*Play:* Hold one key or a dyad; every held note plays root, +1 and +2 octaves. Set SYNC and 1/8 T in the studio.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY +7 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 0 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 600 Hz · RESONANCE 4 · MULTIDRIVE 0 · SLOPE 24 dB · EG AMT +3 · KB TRACK 1
FEG   A 1 ms · D 180 ms · S 0 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 300 ms · S 2 · R 200 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   on · RATE SYNC 1/8 T · RANGE +2 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Berlin Sequence — Arp

**Synth Studio original** (classic technique). A Berlin-school sequence in the 70s modular style: a 16-step resonant pluck with a slow 10-second filter LFO sweep (0.1 Hz, the bottom of the panel range).

*Play:* Start it and let it run; hold keys to transpose and ride CUTOFF slowly.

```
OSC   OSC 1 8' SAW(33) | OSC 2 4' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 7 · SUB OSC 0 · OSC 2 3 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 500 Hz · RESONANCE 5 · MULTIDRIVE 0 · SLOPE 24 dB · EG AMT +2.5 · KB TRACK 1
FEG   A 1 ms · D 160 ms · S 0 · R 120 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 220 ms · S 2 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 0.1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT +1.5 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   on · RATE SYNC 1/16 · RANGE 0 · PATTERN SEQ · BACK/FORTH off · INVERT off · LATCH on | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
SEQ   steps: E2 E3 B2 E2 | G2 E3 D3 E2 | E2 E3 B2 E2 | A2 G2 D3 B2
```

### 3.6 FX

Factory categories in this family: percussion, noise, sound-fx and distorted.

#### Synth Kick — FX

**Recreation.** Based on the Sub 37 factory preset "Analog Kick" (slot 3.6, category percussion; also in the Subsequent 37 bank at 3.16). Settings are ours. A synth kick drum: a triangle with a 45 ms pitch drop (Filter EG through MOD 2), a click from the filter envelope, MULTIDRIVE for punch.

*Play:* MIDI 36–43, one hit per beat; the key tunes the kick.

```
OSC   OSC 1 16' TRI(0) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET on · DUO MODE off · KB CTRL HI
MIX   OSC 1 8 · SUB OSC 0 · OSC 2 0 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 300 Hz · RESONANCE 0 · MULTIDRIVE 4 · SLOPE 24 dB · EG AMT +2 · KB TRACK 0.5
FEG   A 1 ms · D 45 ms · S 0 · R 40 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET on · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 350 ms · S 0 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET on · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  F.EG/PGM · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT +4 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Synth Tom — FX

**Recreation.** Based on the Sub 37 factory preset "SYNTH DRUM1" (slot 5.15, category percussion). Settings are ours. A 70s "syndrum" tom: a resonant filter ringing near self-oscillation, a falling pitch sweep and a touch of noise for the stick.

*Play:* Tom fills down the keyboard, one hit per note.

```
OSC   OSC 1 8' TRI(0) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET on · DUO MODE off · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 0 · OSC 2 0 · NOISE 2 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 600 Hz · RESONANCE 6.5 · MULTIDRIVE 0 · SLOPE 24 dB · EG AMT +2.5 · KB TRACK 1
FEG   A 1 ms · D 220 ms · S 0 · R 200 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET on · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 600 ms · S 0 · R 500 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET on · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  F.EG/PGM · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT +2.5 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Synth Gong — FX · twin button 16

**Recreation.** Based on the Sub 37 factory preset "SYNTH GONG1" (slot 7.10, category percussion). Settings are ours. A metallic gong: audio-rate FM (MOD 2 HI RANGE at 173 Hz) on OSC 1, plus a tritone OSC 2 and a seven-second decay.

*Play:* Single strikes on low-mid keys; leave room for each to ring.

```
OSC   OSC 1 8' TRI(0) | OSC 2 4' SQR(67) FREQUENCY +6 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 7 · SUB OSC 0 · OSC 2 4 · NOISE 1 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.80 kHz · RESONANCE 2 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +2 · KB TRACK 0.5
FEG   A 1 ms · D 4 s · S 0 · R 4 s | shift: DLY 0 ms · HOLD 0 ms · VEL 5 · KB 0 | MULTI TRIG on · RESET on · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 7 s · S 0 · R 7 s | shift: DLY 0 ms · HOLD 0 ms · VEL 5 · KB 0 | MULTI TRIG on · RESET on · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 173 Hz · HI RANGE on · KB RESET off · PITCH AMT +2 → OSC 1 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Echo Chirp — FX

**Recreation.** Based on the Sub 37 factory preset "Echo Chirp" (slot 4.4, category percussion). Settings are ours. A bird-like chirp that repeats in time: a fast downward pitch sweep from the Filter EG, and both envelopes in SYNC so they retrigger every dotted eighth while the key is held.

*Play:* Hold a high key for a beat or two (needs the clock); short taps give a single chirp.

```
OSC   OSC 1 4' TRI(0) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 0 · OSC 2 0 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 2.50 kHz · RESONANCE 3 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +1.5 · KB TRACK 1
FEG   A 1 ms · D 70 ms · S 0 · R 60 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET on · SYNC on (1/8 dot) · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 150 ms · S 0 · R 100 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET on · SYNC on (1/8 dot) · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  F.EG/PGM · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT +3 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Cold Wind — FX

**Recreation.** Based on the Sub 37 factory preset "COLD NOISE" (slot 2.10, category noise). Settings are ours. A wintry wind: pink noise only, through a resonant 12 dB filter that a slow triangle LFO sweeps like gusts.

*Play:* Hold a key for wind; higher keys whistle more (KB TRACK 1.0).

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 0 · SUB OSC 0 · OSC 2 0 · NOISE 8 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 800 Hz · RESONANCE 6 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +1 · KB TRACK 1
FEG   A 800 ms · D 2 s · S 6 · R 2 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 600 ms · D 1 s · S 10 · R 2.5 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 0.15 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT +1.5 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### 70s Computer Bleeps — FX

**Recreation.** Based on the Sub 37 factory preset "1970s SciFi Computer" (slot 4.14, category sound-fx). Settings are ours. The 1970s "computer thinking" sound the manual describes for S&H: random steps on the pitch and on a resonant filter.

*Play:* Hold one key; the S&H does the rest. Push the wheel to add pitch randomness.

```
OSC   OSC 1 4' SQR(67) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 0 · OSC 2 0 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.50 kHz · RESONANCE 6 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT 0 · KB TRACK 1
FEG   A 1 ms · D 300 ms · S 10 · R 100 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 300 ms · S 10 · R 200 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  S&H · RATE 7 Hz · HI RANGE off · KB RESET off · PITCH AMT +2 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  S&H · RATE 7 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT +2 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Clipping Drive — FX

**Recreation.** Based on the Sub 37 factory preset "CLIPPING A LOT" (slot 3.8, category distorted). Settings are ours. Hard clipping: every source past unity, FDBK and MULTIDRIVE at 10 for a square-edged, aggressive tone. PRESET VOL is 60 % to tame the level jump.

*Play:* Power riffs; compare it with MULTIDRIVE at 0 to hear what the clipping adds.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SQR(67) FREQUENCY -0.12 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE off · KB CTRL HI
MIX   OSC 1 9 · SUB OSC 6 · OSC 2 8 · NOISE 0 · FDBK/EXT 5   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 2.00 kHz · RESONANCE 2 · MULTIDRIVE 10 · SLOPE 24 dB · EG AMT +2 · KB TRACK 1
FEG   A 1 ms · D 400 ms · S 5 · R 200 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 500 ms · S 9 · R 200 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 60 %
```

### 3.7 Duo

Factory categories in this family: duo.

#### Duo Tape Tones — Duo · twin button 10

**Recreation.** Based on the Sub 37 factory preset "Duotronic Moogtrons" (slot 1.4, category duo; also in the Subsequent 37 bank at 5.12). Settings are ours. Two-voice tape-machine tones (the "-tron" family): a soft saw/square blend, a little tape hiss and slow pitch wow.

*Play:* Hold a low note and move the upper note against it (oblique motion), slowly.

```
OSC   OSC 1 8' SAW>SQR(45) | OSC 2 8' SAW>SQR(45) FREQUENCY 0 st BEAT FREQ +0.6 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 0 · OSC 2 5 · NOISE 0.8 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.30 kHz · RESONANCE 0.5 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +0.8 · KB TRACK 1
FEG   A 150 ms · D 1.2 s · S 6 · R 800 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 120 ms · D 1.5 s · S 9 · R 900 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 6 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.2 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 0.4 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.12 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Rhythmic Fifth Filter — Duo

**Recreation.** Based on the Sub 37 factory preset "Rhythmic 5th Filtration" (slot 1.1, category duo; also in the Subsequent 37 bank at 7.15). Settings are ours. Rhythmic fifths: a clock-synced square LFO gates the brightness of a resonant fifth in eighth notes. In DUO, one key gives a power fifth and two keys spread the voicing.

*Play:* Hold one or two keys; set the studio tempo. MOD 2 KB RESET puts each new note on the beat.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY +7 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 2 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 400 Hz · RESONANCE 5.5 · MULTIDRIVE 0 · SLOPE 24 dB · EG AMT +1 · KB TRACK 0.8
FEG   A 5 ms · D 300 ms · S 5 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 5 ms · D 500 ms · S 10 · R 300 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  SQR · RATE SYNC 1/8 · HI RANGE off · KB RESET on · PITCH AMT 0 → OSC 1+2 · FILTER AMT +2.5 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Duo Organ — Duo

**Recreation.** Based on the Sub 37 factory preset "DUO ORG" (slot 2.3, category duo; also in the Subsequent 37 bank at 5.10). Settings are ours. A clean two-voice organ: square-ish waves plus sub, an instant on/off envelope, wheel vibrato.

*Play:* Sustained two-note voicings moving in parallel thirds or sixths.

```
OSC   OSC 1 8' SAW>SQR(55) | OSC 2 8' SAW>SQR(55) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 4 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 2.00 kHz · RESONANCE 0 · MULTIDRIVE 1 · SLOPE 12 dB · EG AMT 0 · KB TRACK 1
FEG   A 1 ms · D 300 ms · S 10 · R 100 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 3 ms · D 100 ms · S 10 · R 80 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 6 Hz · HI RANGE off · KB RESET off · PITCH AMT +0.15 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Duo Wave Motion — Duo

**Recreation.** Based on the Sub 37 factory preset "DUO WAVE MOD" (slot 3.5, category duo; also in the Subsequent 37 bank at 5.11). Settings are ours. Two voices whose wave shapes drift independently: MOD 2 morphs OSC 1, and MOD 1 (on the wheel) morphs OSC 2.

*Play:* Two notes rising together, the gap opening from a third to an octave; push the wheel to animate the upper voice.

```
OSC   OSC 1 8' SAW>SQR(40) | OSC 2 8' SQR(70) FREQUENCY 0 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 0 · OSC 2 5 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.60 kHz · RESONANCE 1.5 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +1 · KB TRACK 1
FEG   A 200 ms · D 1.5 s · S 7 · R 900 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 150 ms · D 1.5 s · S 9 · R 1 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 0.47 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST OSC 2 WAVE · MOD AMT +2 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 0.3 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST OSC 1 WAVE · MOD AMT +2 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Long Ride Duo Pad — Duo

**Recreation.** Based on the Sub 37 factory preset "A LONG RIDE" (slot 3.10, category duo; also in the Subsequent 37 bank at 3.12). Settings are ours. An evolving two-voice pad: the Filter EG LOOPs with long stages (a 9-second multistage LFO) while OSC 2's wave slowly morphs.

*Play:* Hold two notes for many bars; it breathes on its own.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SQR(67) FREQUENCY 0 st BEAT FREQ +0.6 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 6 · SUB OSC 3 · OSC 2 5 · NOISE 0.5 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 450 Hz · RESONANCE 3.5 · MULTIDRIVE 0 · SLOPE 24 dB · EG AMT +2.5 · KB TRACK 0.5
FEG   A 2.5 s · D 3.5 s · S 0 · R 3 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP on · LATCH ON off · EXP.ATK off
AEG   A 1.5 s · D 2 s · S 10 · R 3 s | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG off · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 0.1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST OSC 2 WAVE · MOD AMT +1.5 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Duo Saw Stabs — Duo

**Recreation.** Based on the Sub 37 factory preset "SAWTEETH DUO DANCER" (slot 6.16, category duo; also in the Subsequent 37 bank at 8.08). Settings are ours. Two-saw dance stabs: a punchy filter envelope, both voices through one driven ladder.

*Play:* Off-beat two-note stabs (house, trance); let the two voices cross each bar.

```
OSC   OSC 1 8' SAW(33) | OSC 2 8' SAW(33) FREQUENCY 0 st BEAT FREQ +0.8 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 7 · SUB OSC 2 · OSC 2 7 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 900 Hz · RESONANCE 3 · MULTIDRIVE 3 · SLOPE 24 dB · EG AMT +3 · KB TRACK 1
FEG   A 1 ms · D 200 ms · S 1 · R 150 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 350 ms · S 3 · R 180 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   off · RATE 120 BPM · RANGE 0 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 50 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

#### Robot Workers Duo — Duo

**Recreation.** Based on the Sub 37 factory preset "Werkers Unite" (slot 1.12, category duo; also in the Subsequent 37 bank at 9.13). Settings are ours. Robotic electro in the Düsseldorf manner: two square voices, short envelopes and a clock-synced UP arpeggio. In DUO each held pair arpeggiates.

*Play:* Hold two-note shapes and change them every bar; strictly on the grid.

```
OSC   OSC 1 8' SQR(67) | OSC 2 8' SQR(67) FREQUENCY -5 st BEAT FREQ 0 Hz | HARD SYNC off · KB RESET off · DUO MODE on · KB CTRL HI
MIX   OSC 1 5 · SUB OSC 2 · OSC 2 4 · NOISE 0 · FDBK/EXT 0   (0-10, unity 5; a channel at 0 is muted)
VCF   CUTOFF 1.40 kHz · RESONANCE 2.5 · MULTIDRIVE 0 · SLOPE 12 dB · EG AMT +2 · KB TRACK 1
FEG   A 1 ms · D 120 ms · S 1 · R 80 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
AEG   A 1 ms · D 160 ms · S 3 · R 60 ms | shift: DLY 0 ms · HOLD 0 ms · VEL 0 · KB 0 | MULTI TRIG on · RESET off · SYNC off · LOOP off · LATCH ON off · EXP.ATK off
MOD1  TRI · RATE 5 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: MOD WHEEL +100 %
MOD2  TRI · RATE 1 Hz · HI RANGE off · KB RESET off · PITCH AMT 0 → OSC 1+2 · FILTER AMT 0 · DEST VCA LEVEL · MOD AMT 0 · CONTROLLERS: all OFF (full depth)
GLIDE off · TIME 2 · LCR · OSC 1+2 · LEGATO off · GATED off
ARP   on · RATE SYNC 1/16 · RANGE +1 · PATTERN UP · BACK/FORTH off · INVERT off · LATCH off | GATE 40 % · SWING 50 % · END NOTES ONCE
PERF  KB PRIORITY LAST · BEND UP +2 / DOWN -2 st · BEND DEST BOTH · PRESET VOL 100 %
```

**Totals:** 62 presets: **52 recreations of Sub 37 factory presets** and 10 Synth Studio originals. By family: Bass 9+4, Lead 9+3, Pad 7+0, Keys 7+2, Arp 6+1, FX 7+0, Duo 7+0 (recreations + originals).

### Notes that apply to several presets

- **Clock.** The synced presets need a clock: the studio transport, or the hardware's TAP or MIDI clock. These are anything showing `SYNC` on an LFO or the ARP, or an envelope SYNC.
  - With arp SYNC on and no clock (outside TAP mode), the arp and sequencer **do not play** (p.15).
  - An envelope with SYNC **retriggers every division while the key is held** (pp.31, 33); Echo Chirp uses this.
- **Pressure and PGM routes** (Touch-Sensitive Bass, Pressure Sparkle Lead, Space Banjo Arp) use documented menu items (pp.50–51):
  - CONTROLLERS **AFTERTOUCH** amount.
  - **PGM SRC CONST ON**.
  - **PGM DST ARP RATE**.
  - If the twin has no aftertouch, offer an on-screen pressure strip.
- **Sequences** use scientific pitch (C4 = MIDI 60); the instrument calls MIDI 48 "Middle C" (p.19).
  - `.` is a REST, and `~` is a TIE into the next step. A tie to a different note changes pitch without retriggering the envelopes, and with LEGATO glide only tied notes glide (p.17).
  - `C3+F3` is a two-note DUO step (p.17).
  - Play: PATTERN SEQ, ARP ON, then press a key. With REF NOTE FIRST (default) the key sets the starting note (pp.17, 46).
- **Unsynced ARP RATE** (Space Banjo Arp at 90 BPM) is the tempo. **likely:** the step length comes from the arp CLOCK DIV menu (p.40).
- **KB CTRL OFF in DUO** parks OSC 2 on a drone, and FREQUENCY then spans ±3 octaves (p.26). **guess:** the drone pitch is referenced to MIDI 48.
- **Amp EG DELAY** only acts when LOOP is on (p.33), so these presets leave it at 0.
- **PRESET VOL** (p.42) level-matches the very loud distorted presets.

## 4. Twin-ready JSON for buttons 1–16

Keys are today's `spec.ts` ids with units converted. The ids `spec.ts` lacks are the **NEW** ones in sources.md §3:
- `osc2_kb_mode`, `mix_*_on`
- `*_sync`, `*_clock_div`, `*_exp_attack`
- `modN_sync`, `modN_clock_div`, `modN_kb_reset`, `modN_dest`, `modN_pgm_src`, `modN_pgm_dst`, `modN_wheel_amt`, `modN_vel_amt`, `modN_at_amt`
- `glide_time_panel`
- `arp_sync`, `arp_clock_div`, `arp_range_state`, `arp_pattern`, `arp_invert`, `arp_gate`, `arp_swing`, `arp_end_notes`
- `kb_priority`, `bend_up`, `bend_down`, `bend_dest`, `preset_vol`

The legacy `arp_mode`, `arp_range` and `modN_pgm_dest` are included where they map.

**Indices:**
- `osc*_octave`: 0 = 16' · 1 = 8' · 2 = 4' · 3 = 2'.
- `filter_slope`: 0–3 = 6/12/18/24 dB.
- `modN_source`: 0 TRI · 1 SQR · 2 SAW · 3 RAMP · 4 S&H · 5 F.EG/PGM.
- `modN_pitch_dest` and `glide_osc`: 0 = 1+2 · 1 = OSC 1 · 2 = OSC 2.
- `modN_dest`: 0 LFO RATE (other LFO) · 1 VCA LEVEL · 2 OSC 1 WAVE · 3 BOTH WAVE · 4 OSC 2 WAVE · 5 NOISE LEVEL · 6 EG TIME/PGM.
- `*_clock_div`: index into the 21 divisions (16 = 1/16, 13 = 1/8, 15 = 1/8 T, 18 = 1/32).
- `arp_range_state`: 0 `0&-2` … 3 = 0 … 6 `0&+2`.
- `arp_pattern`: 0 UP · 1 DWN · 2 ORDR · 3 RND · 4 SEQ · 5 REC.

```json
{
 "three_osc_mono_bass": {
  "name": "Three-Osc Mono Bass", "source": "community", "author": "Synth Studio",
  "description": "A classic 70s three-oscillator mono bass in the Minimoog style. - Two 16' saws a hair apart, with the sub standing in for the third oscillator. - The mixer is pushed past unity into the ladder. - FDBK recreates the old \"output into the external input\" feedback trick. - KB TRACK 0.33 matches that instrument's 1/3 keyboard-control setting. - KB PRIORITY LOW and single trigger give the low-note-wins feel.",
  "settings": {
   "preset_number": 1,
   "osc1_octave": 0, "osc1_wave": 33, "osc2_octave": 0, "osc2_wave": 33, "osc2_frequency": -0.08, "beat_freq": 0, "hard_sync": false, "kb_reset": false, "duo_mode": false, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 80, "mix_sub": 40, "mix_osc2": 70, "mix_noise": 0, "mix_feedback": 25, "mix_osc1_on": true, "mix_sub_on": true, "mix_osc2_on": true, "mix_noise_on": false, "mix_feedback_on": true,
   "cutoff": 260, "resonance": 20, "multidrive": 20, "filter_slope": 3, "filter_eg_amt": 60, "filter_kb_amt": 33,
   "feg_attack": 2, "feg_decay": 350, "feg_sustain": 30, "feg_release": 200, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 1, "aeg_decay": 600, "aeg_sustain": 90, "aeg_release": 120, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 6, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 1, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 0, "mod2_pitch_dest": 0, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": false, "glide_time": 40, "glide_time_panel": 2, "glide_type": 0, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LOW", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "deep_round_bass": {
  "name": "Deep Round Bass", "source": "community", "author": "Synth Studio",
  "description": "Based on the Sub 37 factory preset \"LOW BASS\" (5.6, bass). A deep, round, hollow bass: square plus triangle plus sub with barely any filter movement.",
  "settings": {
   "preset_number": 2,
   "osc1_octave": 0, "osc1_wave": 67, "osc2_octave": 0, "osc2_wave": 0, "osc2_frequency": 0, "beat_freq": 0, "hard_sync": false, "kb_reset": false, "duo_mode": false, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 50, "mix_sub": 80, "mix_osc2": 40, "mix_noise": 0, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": true, "mix_osc2_on": true, "mix_noise_on": false, "mix_feedback_on": false,
   "cutoff": 220, "resonance": 15, "multidrive": 15, "filter_slope": 3, "filter_eg_amt": 40, "filter_kb_amt": 50,
   "feg_attack": 2, "feg_decay": 300, "feg_sustain": 30, "feg_release": 200, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 2, "aeg_decay": 800, "aeg_sustain": 90, "aeg_release": 150, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 0, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 1, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 0, "mod2_pitch_dest": 0, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": false, "glide_time": 40, "glide_time_panel": 2, "glide_type": 0, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "sub_bass": {
  "name": "Sub Bass", "source": "community", "author": "Synth Studio",
  "description": "Based on the Sub 37 factory preset \"sub BASS\" (6.7, bass). A sub-oscillator-led sub bass: a near-sine fundamental with just a touch of drive for audibility on small speakers.",
  "settings": {
   "preset_number": 3,
   "osc1_octave": 0, "osc1_wave": 0, "osc2_octave": 1, "osc2_wave": 33, "osc2_frequency": 0, "beat_freq": 0, "hard_sync": false, "kb_reset": false, "duo_mode": false, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 40, "mix_sub": 90, "mix_osc2": 0, "mix_noise": 0, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": true, "mix_osc2_on": false, "mix_noise_on": false, "mix_feedback_on": false,
   "cutoff": 160, "resonance": 5, "multidrive": 25, "filter_slope": 3, "filter_eg_amt": 20, "filter_kb_amt": 0,
   "feg_attack": 2, "feg_decay": 250, "feg_sustain": 40, "feg_release": 150, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 3, "aeg_decay": 900, "aeg_sustain": 100, "aeg_release": 120, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 0, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 1, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 0, "mod2_pitch_dest": 0, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": false, "glide_time": 40, "glide_time_panel": 2, "glide_type": 0, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "pedal_bass": {
  "name": "Pedal Bass", "source": "community", "author": "Synth Studio",
  "description": "A bass-pedal sound in the style of the Taurus: two fat 16' saws plus a loud sub, a slow-ish filter bloom, notes that ring, and glide between them.",
  "settings": {
   "preset_number": 4,
   "osc1_octave": 0, "osc1_wave": 33, "osc2_octave": 0, "osc2_wave": 33, "osc2_frequency": 0.12, "beat_freq": 0.4, "hard_sync": false, "kb_reset": false, "duo_mode": false, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 70, "mix_sub": 80, "mix_osc2": 60, "mix_noise": 0, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": true, "mix_osc2_on": true, "mix_noise_on": false, "mix_feedback_on": false,
   "cutoff": 180, "resonance": 25, "multidrive": 30, "filter_slope": 3, "filter_eg_amt": 70, "filter_kb_amt": 0,
   "feg_attack": 30, "feg_decay": 700, "feg_sustain": 20, "feg_release": 800, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 15, "aeg_decay": 1500, "aeg_sustain": 80, "aeg_release": 900, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 0, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 1, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 0, "mod2_pitch_dest": 0, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": true, "glide_time": 56, "glide_time_panel": 2.5, "glide_type": 1, "glide_osc": 0, "glide_legato": true, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "acid_line": {
  "name": "Acid Line", "source": "community", "author": "Synth Studio",
  "description": "A classic acid line using Moog's own Quickstart tip (legato glide, EXP, GLIDE TIME 2): one saw, RESONANCE 7 just below self-oscillation, an 18 dB slope, a short decay, single-trigger envelopes. Tied steps slide without retriggering (manual p.17).",
  "sequence": {"steps": "C2 . C3~ C2 | Eb2 C2 Bb1~ C2 | . G2~ G1 C3 | Bb1 C2~ Eb2 F2"},
  "settings": {
   "preset_number": 5,
   "osc1_octave": 1, "osc1_wave": 33, "osc2_octave": 1, "osc2_wave": 33, "osc2_frequency": 0, "beat_freq": 0, "hard_sync": false, "kb_reset": false, "duo_mode": false, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 70, "mix_sub": 0, "mix_osc2": 0, "mix_noise": 0, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": false, "mix_osc2_on": false, "mix_noise_on": false, "mix_feedback_on": false,
   "cutoff": 450, "resonance": 70, "multidrive": 40, "filter_slope": 2, "filter_eg_amt": 70, "filter_kb_amt": 100,
   "feg_attack": 1, "feg_decay": 180, "feg_sustain": 0, "feg_release": 120, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 50, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 1, "aeg_decay": 250, "aeg_sustain": 80, "aeg_release": 60, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 0, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 1, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 0, "mod2_pitch_dest": 0, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": true, "glide_time": 40, "glide_time_panel": 2, "glide_type": 2, "glide_osc": 0, "glide_legato": true, "glide_gated": false,
   "arp_on": true, "arp_rate": 120, "arp_sync": true, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 4, "arp_back_fwd": false, "arp_invert": false, "arp_latch": true, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE",
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "wobble_bass": {
  "name": "Wobble Bass", "source": "community", "author": "Synth Studio",
  "description": "A clock-synced wobble: a MOD 2 triangle at 1/8 on the cutoff of a resonant, driven bass with a heavy sub; the wheel adds a 1/16 square layer (MOD 1).",
  "settings": {
   "preset_number": 6,
   "osc1_octave": 0, "osc1_wave": 33, "osc2_octave": 0, "osc2_wave": 67, "osc2_frequency": -0.1, "beat_freq": 0, "hard_sync": false, "kb_reset": false, "duo_mode": false, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 80, "mix_sub": 80, "mix_osc2": 70, "mix_noise": 0, "mix_feedback": 30, "mix_osc1_on": true, "mix_sub_on": true, "mix_osc2_on": true, "mix_noise_on": false, "mix_feedback_on": true,
   "cutoff": 200, "resonance": 45, "multidrive": 65, "filter_slope": 3, "filter_eg_amt": 10, "filter_kb_amt": 30,
   "feg_attack": 1, "feg_decay": 300, "feg_sustain": 100, "feg_release": 100, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 2, "aeg_decay": 1000, "aeg_sustain": 100, "aeg_release": 150, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 1, "mod1_rate": 5, "mod1_hi_range": false, "mod1_sync": true, "mod1_clock_div": 16, "mod1_kb_reset": false, "mod1_pitch_amt": 0, "mod1_pitch_dest": 0, "mod1_filter_amt": 40, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 1, "mod2_hi_range": false, "mod2_sync": true, "mod2_clock_div": 13, "mod2_kb_reset": true, "mod2_pitch_amt": 0, "mod2_pitch_dest": 0, "mod2_filter_amt": 60, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": false, "glide_time": 40, "glide_time_panel": 2, "glide_type": 0, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "vintage_saw_lead": {
  "name": "Vintage Saw Lead", "source": "community", "author": "Synth Studio",
  "description": "Based on the Sub 37 factory preset \"OLD LEAD\" (5.8, lead). A 70s solo lead in the Minimoog manner: two detuned saws driving the ladder, medium decay, exponential glide.",
  "settings": {
   "preset_number": 7,
   "osc1_octave": 1, "osc1_wave": 33, "osc2_octave": 1, "osc2_wave": 33, "osc2_frequency": -0.1, "beat_freq": 0, "hard_sync": false, "kb_reset": false, "duo_mode": false, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 65, "mix_sub": 0, "mix_osc2": 65, "mix_noise": 0, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": false, "mix_osc2_on": true, "mix_noise_on": false, "mix_feedback_on": false,
   "cutoff": 1400, "resonance": 30, "multidrive": 20, "filter_slope": 3, "filter_eg_amt": 40, "filter_kb_amt": 80,
   "feg_attack": 10, "feg_decay": 600, "feg_sustain": 50, "feg_release": 300, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 4, "aeg_decay": 500, "aeg_sustain": 90, "aeg_release": 250, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 5.5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 7, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 1, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 0, "mod2_pitch_dest": 0, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": true, "glide_time": 40, "glide_time_panel": 2, "glide_type": 2, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "sync_scream": {
  "name": "Sync Scream", "source": "community", "author": "Synth Studio",
  "description": "The textbook hard-sync lead: OSC 2 slaved to OSC 1, its pitch swept down by the Filter EG through MOD 2, so every note tears open and settles.",
  "settings": {
   "preset_number": 8,
   "osc1_octave": 1, "osc1_wave": 33, "osc2_octave": 1, "osc2_wave": 33, "osc2_frequency": 3, "beat_freq": 0, "hard_sync": true, "kb_reset": false, "duo_mode": false, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 20, "mix_sub": 0, "mix_osc2": 90, "mix_noise": 0, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": false, "mix_osc2_on": true, "mix_noise_on": false, "mix_feedback_on": false,
   "cutoff": 2600, "resonance": 10, "multidrive": 40, "filter_slope": 3, "filter_eg_amt": 30, "filter_kb_amt": 100,
   "feg_attack": 1, "feg_decay": 700, "feg_sustain": 30, "feg_release": 400, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 2, "aeg_decay": 600, "aeg_sustain": 90, "aeg_release": 300, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 5.5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 7, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 5, "mod2_rate": 1, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 80, "mod2_pitch_dest": 2, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": true, "glide_time": 28, "glide_time_panel": 1.5, "glide_type": 1, "glide_osc": 0, "glide_legato": true, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "theremin_lead": {
  "name": "Theremin Lead", "source": "community", "author": "Synth Studio",
  "description": "Based on the Sub 37 factory preset \"Lyrical Theremin\" (3.2, lead). A theremin imitation: a near-sine (filtered triangle), slow exponential glide on every note, constant gentle vibrato plus wheel vibrato, and bend ±12.",
  "settings": {
   "preset_number": 9,
   "osc1_octave": 1, "osc1_wave": 0, "osc2_octave": 1, "osc2_wave": 33, "osc2_frequency": 0, "beat_freq": 0, "hard_sync": false, "kb_reset": false, "duo_mode": false, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 70, "mix_sub": 0, "mix_osc2": 0, "mix_noise": 0, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": false, "mix_osc2_on": false, "mix_noise_on": false, "mix_feedback_on": false,
   "cutoff": 900, "resonance": 0, "multidrive": 0, "filter_slope": 1, "filter_eg_amt": 0, "filter_kb_amt": 100,
   "feg_attack": 1, "feg_decay": 300, "feg_sustain": 100, "feg_release": 100, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 80, "aeg_decay": 400, "aeg_sustain": 100, "aeg_release": 600, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 6, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 10, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 5.2, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 3, "mod2_pitch_dest": 0, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": true, "glide_time": 224, "glide_time_panel": 4.5, "glide_type": 2, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 12, "bend_down": 12, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "duo_tape_tones": {
  "name": "Duo Tape Tones", "source": "community", "author": "Synth Studio",
  "description": "Based on the Sub 37 factory preset \"Duotronic Moogtrons\" (1.4, duo). Two-voice tape-machine tones (the \"-tron\" family): a soft saw/square blend, a little tape hiss and slow pitch wow.",
  "settings": {
   "preset_number": 10,
   "osc1_octave": 1, "osc1_wave": 45, "osc2_octave": 1, "osc2_wave": 45, "osc2_frequency": 0, "beat_freq": 0.6, "hard_sync": false, "kb_reset": false, "duo_mode": true, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 50, "mix_sub": 0, "mix_osc2": 50, "mix_noise": 8, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": false, "mix_osc2_on": true, "mix_noise_on": true, "mix_feedback_on": false,
   "cutoff": 1300, "resonance": 5, "multidrive": 0, "filter_slope": 1, "filter_eg_amt": 16, "filter_kb_amt": 100,
   "feg_attack": 150, "feg_decay": 1200, "feg_sustain": 60, "feg_release": 800, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 120, "aeg_decay": 1500, "aeg_sustain": 90, "aeg_release": 900, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 6, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 4, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 0.4, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 2.4, "mod2_pitch_dest": 0, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": false, "glide_time": 40, "glide_time_panel": 2, "glide_type": 0, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "gritty_organ": {
  "name": "Gritty Organ", "source": "community", "author": "Synth Studio",
  "description": "Based on the Sub 37 factory preset \"ORGAN GRINDER\" (6.11, organs). A gritty two-voice organ: square plus pulse, the sub as the 16' drawbar, FDBK like an overdriven amp, and a wheel tremolo (MOD 1 to VCA LEVEL).",
  "settings": {
   "preset_number": 11,
   "osc1_octave": 1, "osc1_wave": 67, "osc2_octave": 1, "osc2_wave": 90, "osc2_frequency": 0, "beat_freq": 0, "hard_sync": false, "kb_reset": true, "duo_mode": true, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 60, "mix_sub": 30, "mix_osc2": 60, "mix_noise": 0, "mix_feedback": 15, "mix_osc1_on": true, "mix_sub_on": true, "mix_osc2_on": true, "mix_noise_on": false, "mix_feedback_on": true,
   "cutoff": 3500, "resonance": 0, "multidrive": 35, "filter_slope": 1, "filter_eg_amt": 20, "filter_kb_amt": 100,
   "feg_attack": 1, "feg_decay": 80, "feg_sustain": 80, "feg_release": 60, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": true, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 2, "aeg_decay": 200, "aeg_sustain": 100, "aeg_release": 40, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": true, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 6.5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 2.4, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 12, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 1, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 0, "mod2_pitch_dest": 0, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": false, "glide_time": 40, "glide_time_panel": 2, "glide_type": 0, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "airy_duo_pad": {
  "name": "Airy Duo Pad", "source": "community", "author": "Synth Studio",
  "description": "Based on the Sub 37 factory preset \"CELESTIAL\" (2.5, pads). An airy two-voice pad: BEAT FREQ shimmer, pink-noise air and a slow wave-shape LFO.",
  "settings": {
   "preset_number": 12,
   "osc1_octave": 1, "osc1_wave": 33, "osc2_octave": 1, "osc2_wave": 33, "osc2_frequency": 0, "beat_freq": 1, "hard_sync": false, "kb_reset": false, "duo_mode": true, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 50, "mix_sub": 0, "mix_osc2": 50, "mix_noise": 10, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": false, "mix_osc2_on": true, "mix_noise_on": true, "mix_feedback_on": false,
   "cutoff": 900, "resonance": 20, "multidrive": 5, "filter_slope": 1, "filter_eg_amt": 30, "filter_kb_amt": 80,
   "feg_attack": 1500, "feg_decay": 3000, "feg_sustain": 60, "feg_release": 2500, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 1200, "aeg_decay": 2000, "aeg_sustain": 90, "aeg_release": 3000, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 4, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 0.25, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 0, "mod2_pitch_dest": 0, "mod2_filter_amt": 8, "mod2_dest": 3, "mod2_pgm_amt": 20, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 0,
   "glide_on": false, "glide_time": 40, "glide_time_panel": 2, "glide_type": 0, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "string_machine": {
  "name": "String Machine", "source": "community", "author": "Synth Studio",
  "description": "Based on the Sub 37 factory preset \"STRINGOTRON\" (1.13, strings). A 70s string-machine ensemble: two wave-modulated squares (PWM), slow attack, two voices.",
  "settings": {
   "preset_number": 13,
   "osc1_octave": 1, "osc1_wave": 70, "osc2_octave": 1, "osc2_wave": 64, "osc2_frequency": 0, "beat_freq": 0.8, "hard_sync": false, "kb_reset": false, "duo_mode": true, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 50, "mix_sub": 0, "mix_osc2": 50, "mix_noise": 0, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": false, "mix_osc2_on": true, "mix_noise_on": false, "mix_feedback_on": false,
   "cutoff": 2200, "resonance": 5, "multidrive": 0, "filter_slope": 1, "filter_eg_amt": 10, "filter_kb_amt": 100,
   "feg_attack": 400, "feg_decay": 1000, "feg_sustain": 80, "feg_release": 900, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 350, "aeg_decay": 1000, "aeg_sustain": 90, "aeg_release": 1200, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 5.5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 4, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 0.6, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 0, "mod2_pitch_dest": 0, "mod2_filter_amt": 0, "mod2_dest": 3, "mod2_pgm_amt": 30, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 0,
   "glide_on": false, "glide_time": 40, "glide_time_panel": 2, "glide_type": 0, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "chip_arp": {
  "name": "8-Bit Chip Arp", "source": "community", "author": "Synth Studio",
  "description": "Based on the Sub 37 factory preset \"Gamecom 8Bit Chiptime Fun\" (1.15, classic). A video-game chip sound: a narrow pulse at 4' with the filter wide open, and a fast UP arpeggio that turns any held chord into a chiptune arpeggio. Short gate.",
  "settings": {
   "preset_number": 14,
   "osc1_octave": 2, "osc1_wave": 85, "osc2_octave": 1, "osc2_wave": 33, "osc2_frequency": 0, "beat_freq": 0, "hard_sync": false, "kb_reset": false, "duo_mode": false, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 60, "mix_sub": 0, "mix_osc2": 0, "mix_noise": 0, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": false, "mix_osc2_on": false, "mix_noise_on": false, "mix_feedback_on": false,
   "cutoff": 20000, "resonance": 0, "multidrive": 0, "filter_slope": 3, "filter_eg_amt": 0, "filter_kb_amt": 100,
   "feg_attack": 1, "feg_decay": 300, "feg_sustain": 100, "feg_release": 100, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 0, "feg_kb_amt": 0, "feg_multi_trig": false, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 1, "aeg_decay": 100, "aeg_sustain": 80, "aeg_release": 30, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 0, "aeg_kb_amt": 0, "aeg_multi_trig": false, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 0, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 1, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 0, "mod2_pitch_dest": 0, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": false, "glide_time": 40, "glide_time_panel": 2, "glide_type": 0, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": true, "arp_rate": 120, "arp_sync": true, "arp_clock_div": 18, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 60, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "round_pluck": {
  "name": "Round Pluck", "source": "community", "author": "Synth Studio",
  "description": "A short, round pluck: filter and amp both decay with no sustain, and KB TRACK 1.2 keeps high notes bright.",
  "settings": {
   "preset_number": 15,
   "osc1_octave": 1, "osc1_wave": 33, "osc2_octave": 1, "osc2_wave": 67, "osc2_frequency": 0.06, "beat_freq": 0, "hard_sync": false, "kb_reset": true, "duo_mode": true, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 60, "mix_sub": 0, "mix_osc2": 40, "mix_noise": 0, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": false, "mix_osc2_on": true, "mix_noise_on": false, "mix_feedback_on": false,
   "cutoff": 380, "resonance": 25, "multidrive": 0, "filter_slope": 3, "filter_eg_amt": 70, "filter_kb_amt": 120,
   "feg_attack": 1, "feg_decay": 220, "feg_sustain": 0, "feg_release": 220, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 50, "feg_kb_amt": 0, "feg_multi_trig": true, "feg_reset": false, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 1, "aeg_decay": 500, "aeg_sustain": 0, "aeg_release": 400, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 30, "aeg_kb_amt": 0, "aeg_multi_trig": true, "aeg_reset": false, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 0, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 1, "mod2_hi_range": false, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 0, "mod2_pitch_dest": 0, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": false, "glide_time": 40, "glide_time_panel": 2, "glide_type": 0, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 },
 "synth_gong": {
  "name": "Synth Gong", "source": "community", "author": "Synth Studio",
  "description": "Based on the Sub 37 factory preset \"SYNTH GONG1\" (7.10, percussion). A metallic gong: audio-rate FM (MOD 2 HI RANGE at 173 Hz) on OSC 1, plus a tritone OSC 2 and a seven-second decay.",
  "settings": {
   "preset_number": 16,
   "osc1_octave": 1, "osc1_wave": 0, "osc2_octave": 2, "osc2_wave": 67, "osc2_frequency": 6, "beat_freq": 0, "hard_sync": false, "kb_reset": false, "duo_mode": false, "osc2_kb_ctrl": true, "osc2_kb_mode": "HI",
   "mix_osc1": 70, "mix_sub": 0, "mix_osc2": 40, "mix_noise": 10, "mix_feedback": 0, "mix_osc1_on": true, "mix_sub_on": false, "mix_osc2_on": true, "mix_noise_on": true, "mix_feedback_on": false,
   "cutoff": 1800, "resonance": 20, "multidrive": 0, "filter_slope": 1, "filter_eg_amt": 40, "filter_kb_amt": 50,
   "feg_attack": 1, "feg_decay": 4000, "feg_sustain": 0, "feg_release": 4000, "feg_delay": 0, "feg_hold": 0, "feg_vel_amt": 50, "feg_kb_amt": 0, "feg_multi_trig": true, "feg_reset": true, "feg_sync": false, "feg_clock_div": 10, "feg_loop": false, "feg_latch": false, "feg_exp_attack": false,
   "aeg_attack": 1, "aeg_decay": 7000, "aeg_sustain": 0, "aeg_release": 7000, "aeg_delay": 0, "aeg_hold": 0, "aeg_vel_amt": 50, "aeg_kb_amt": 0, "aeg_multi_trig": true, "aeg_reset": true, "aeg_sync": false, "aeg_clock_div": 10, "aeg_loop": false, "aeg_latch": false, "aeg_exp_attack": false,
   "mod1_source": 0, "mod1_rate": 5, "mod1_hi_range": false, "mod1_sync": false, "mod1_clock_div": 10, "mod1_kb_reset": false, "mod1_pitch_amt": 0, "mod1_pitch_dest": 0, "mod1_filter_amt": 0, "mod1_dest": 1, "mod1_pgm_amt": 0, "mod1_pgm_src": "FILTER EG", "mod1_pgm_dst": "EG TIME", "mod1_wheel_amt": 100, "mod1_vel_amt": 0, "mod1_at_amt": 0, "mod1_pgm_dest": 3,
   "mod2_source": 0, "mod2_rate": 173, "mod2_hi_range": true, "mod2_sync": false, "mod2_clock_div": 10, "mod2_kb_reset": false, "mod2_pitch_amt": 40, "mod2_pitch_dest": 1, "mod2_filter_amt": 0, "mod2_dest": 1, "mod2_pgm_amt": 0, "mod2_pgm_src": "FILTER EG", "mod2_pgm_dst": "EG TIME", "mod2_wheel_amt": 0, "mod2_vel_amt": 0, "mod2_at_amt": 0, "mod2_pgm_dest": 3,
   "glide_on": false, "glide_time": 40, "glide_time_panel": 2, "glide_type": 0, "glide_osc": 0, "glide_legato": false, "glide_gated": false,
   "arp_on": false, "arp_rate": 120, "arp_sync": false, "arp_clock_div": 16, "arp_range": 2, "arp_range_state": 3, "arp_pattern": 0, "arp_back_fwd": false, "arp_invert": false, "arp_latch": false, "arp_gate": 50, "arp_swing": 50, "arp_end_notes": "ONCE", "arp_mode": 0,
   "kb_priority": "LAST", "bend_up": 2, "bend_down": 2, "bend_dest": "BOTH", "preset_vol": 100
  }
 }
}
```
