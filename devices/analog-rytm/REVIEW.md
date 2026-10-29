# Analog Rytm MKII digital twin - independent review

Reviewer pass over `devices/analog-rytm/**` and `public/worklets/analog-rytm-processors.js`,
against the Elektron Analog Rytm MKII User Manual for OS 1.72 (cited as "manual p.N"; the
machine screens on pp.96-109 were rendered and read for this review) and the rytm-mods firmware
notes (`re/subsystems/machines.md`, cited as "firmware notes"). Measurements come from an
offline Node harness that runs the worklet exactly as the engine drives it (kit tables built
like `engine.ts applyKit`, the voice and master nodes, the QA tool's own meters and click
detector), plus Playwright runs of the real app. The harness reads within 0.3 LU of the
browser audio QA once both run at the studio's 120 BPM (both QA excitations play the kits
synced to the studio clock).

Focus, as briefed: drum sound quality as a producer judges it, the voice architecture,
performance and kits, and which simplifications matter for making full tracks.

## Findings and changes

| # | Severity | Finding | Evidence / source | Change |
|---|---|---|---|---|
| 1 | High | **Closed hats were nearly inaudible.** CH CLASSIC, HH BASIC and CH METALLIC sat 10-17 LU under every other voice at their init values, and in 17 of the 20 kits the closed hat played 20-27 LU under the mix (kit 01 in the demo song: -18.5 / -21.3 LU). Kits that layered a sample on the hat (909, Jungle, Studio) were the only ones near a normal -14 LU | momentary loudness of each machine's init hit: CH CLASSIC -41.8 LUFS, HH BASIC -41.1, CH METALLIC -37.8, against -24 to -30 for the kicks, snares, toms and cymbals and -31.5 for OH CLASSIC on the same voice; per-track loudness of every demo pattern | Output trim per hat machine in the worklet: CH CLASSIC and HH BASIC +7 dB, CH METALLIC +5 dB, HH LAB's extra +4 dB removed (it was 11 dB above the other hats). Every hat machine's init hit is now -32.8 to -35.2 LUFS, open hats -27.8 / -31.5 |
| 2 | High | **Kits were unbalanced as genre starting points.** Miami Bass and Trap Sub had weak backbeats (SD -12.5 / -10.8 LU, CP -10.7 / -9.3), with Miami's toms louder than its snare; Straight Boom's 808 snare sat under its cowbell and open hat; Industrial Grind's distorted kick was at -10 LU under the SD FM (-1.3); Robot Funk's open hat -4.8 LU; Glitch Lab's clap roll louder than the whole mix (+0.7); Micro Clicks' impulse percussion -21 / -23 LU; Analog Toys' lead and chip parts -14 / -19 LU; the cowbells of Miami Bass and Afro-Latin -18 / -16.5 LU; Lo-Fi's hat low-passed at 5.6 kHz to -24.9 LU | offline per-track loudness of every demo pattern, LU against the dry mix (table below) | Kit values in `presets.ts`: SD CLASSIC longer (DEC, NOD) and louder (NOL, TRACK LEVEL) in the three 808-style kits, louder claps, Industrial Grind's snare and clap down so its kick sits level with them, toms and open hats trimmed where they outshouted the beat, impulse LEV up, synth parts up, cowbells up, Lo-Fi's hat opened to FRQ 112. Master sections re-checked (finding 7) |
| 3 | High | **Retriggering a ringing voice clicked.** A trig on a sounding voice (a roll, a fill on a tom still ringing, CH taking the voice from OH) dipped by about 40-45 % of the ringing level on the second sample | harness, BD, LT and MT retriggered 30-60 ms into a hit: MT 0.2019, 0.2019, **0.1114**, 0.1605...; BD 0.0507, 0.0507, **0.0275**, 0.0409. Cause: the new sound's fade-in started the filter input at zero, so the input stepped from the old level to ~0 and the open filter's 2-3 sample response (with overshoot) got past the output-side declick, whose offset is taken on the first sample | The filter input now carries on from the old sound's last value over the same 1.3 ms raised cosine. After: MT 0.2019, 0.2019, 0.2027, 0.2047; the step measure at the retrigger fell to the sound's own onset level (MT 0.505 to 0.050 of peak, LT 0.273 to 0.043, BD 0.104 to 0.031) |
| 3b | High | **One-shot samples stopped dead.** Most of the 32 synthesized one-shots end while still ringing, and playback stopped at the last sample; an END set inside a sample stopped it mid-wave the same way. In the factory kits that is a click after every Lo-Fi kick (KICK 909 ends at -20 dB re its peak), when the Studio Kit's and Big Beat's crash runs out, on the Afro-Latin congas, the 909 kit's open hat and others | end level re peak: KICK 909 -20 dB, SUB DROP -24, KICK SUB -24.6, ZAP -25.8, CONGA LO -28.5, KICK ACOU -30, COWBELL -31, TRIANGLE -31.3, CRASH -35.6; the QA detector's dead-stop test found 19 of 64 plays (each one-shot at END 120 and END 60). One audition QA run flagged the Studio Kit as its crash ran out | Without a loop, the last 3 ms before the end point fade out (raised cosine): 0 of 64. Loops are unchanged |
| 4 | Medium | **No output headroom.** With every level, the overdrive, accent, the compressor makeup (up to +40 dB, a measured hardware curve) and the delay feedback at maximum, the instrument output reached +31.3 dBFS. The hardware's main outputs top out at +15 dBu | manual p.76; harness stress render | An order-12 soft saturation at full scale before the AC coupling (unchanged below -6 dBFS, -0.16 dB at -1 dBFS; the calibrated kits lose at most 0.1 dB on their highest peaks). Everything-up now peaks at +1.3 dBFS (the AC coupling after the clip), output DC 2.7e-5 (was 4.6e-3) |
| 5 | Medium | **Lesson s3's comparisons were inaudible.** The A/B "full range vs high-passed" closed hat used HP2 at FRQ 70 (785 Hz), and the ear challenge asked for an open hat's high-pass FRQ at 40 vs 90 (139 Hz vs 2.5 kHz). The hat circuit already removes everything below ~4 kHz, so neither changes the sound | harness: CH open vs HP2@70 both -30.7 LUFS, centroid 7135 vs 7172 Hz; OH HP2@90 vs @40: 0.6 LU and 100 Hz apart. PEDAGOGY: "Match targets must be clearly distinguishable by ear" | The high-pass step uses FRQ 104 (5.6 kHz: -4.2 LU, centroid +475 Hz) with an explanation of why a hat's high-pass only bites in the kilohertz; the ear challenge matches DEC and COL (both taught in the lesson): DEC 30 / COL +30 against DEC 90 / COL -30 rings 5x longer with its centroid 4.7 kHz lower. Lesson id unchanged |
| 6 | Medium | **Key legends below the legibility floor on iPad.** The FUNC sub-legends (Save Project, Kit, Sound, Track, Pattern, Song, Setup, Tap Tempo, Save Kit, Metronome, Save, Reload...) and the trig-key numbers rendered at 7.3 px at 1180 x 820; the MIDI rear legends at 5.6-5.9 px | Playwright text probe, effective size after the 91 % fit | Sub-legends 8 px to 10 px (9.1 px on iPad), MIDI rear legends on two lines so the fit keeps them at the floor. Screenshots checked: no overlaps |
| 7 | Medium | **High master drive vs dense downbeats.** In Warehouse (DIST AMT 30), Big Beat (30), Lo-Fi (44) and Industrial Grind (a first rebalance that raised its overdriven kick into DIST 18), dense hits drove the order-12 master clipper three to four times past its knee, where the output flattens into a plateau right after a fast rise. The QA click detector flagged that intermittently once the hats and the rebalanced parts got louder (Big Beat in 2 of 4 audition runs, Lo-Fi in 2 transport runs, Industrial once). Big Beat also reached -0.88 dBTP in offline takes (the browser takes were lucky at -1.5 to -2.1) | offline sweeps with the QA detector, 16-24 start offsets and random states at 120 BPM; sample dumps show the plateau at the clipper ceiling times the compressor gain. A softer order-6 knee did not help, so it is the depth of the drive, not the knee shape | DIST AMT 20 (Warehouse), 12 (Big Beat, snare VOL 96), 20 (Lo-Fi); Industrial keeps its kick at the original level and gets its balance from a lower snare and clap (VOL 66 / 74, makeup 19, master VOL 100). Cost: 1-2 LU of loudness on the first three (still inside the QA window) |
| 8 | Medium | **True-peak headroom after the rebalance.** Single QA runs reached -0.6 (Jungle Roller), -0.8 (Analog Toys), -0.9 (Micro Clicks) and -1.0 dBTP (Deep Garage, Dub Chords); the ceiling is -1. Two causes: both QA excitations play the kits at the studio's 120 BPM, where parallel compressors recover between hits and let the next transient through at up to +4 dB; and the louder hats sit around 9-12 kHz, where at 44.1 kHz a true peak can be 2.4-3.6 dB above the samples (Micro Clicks' worst take: sample peak -3.2 dBFS, true peak -0.49 dBTP) | a harness sweep over 12 random states (the browser starts each kit from whatever state the previous kits left: hat phases, noise, sample buffers) reproduced the browser's spread; mute tests found the driver in each kit | Analog Toys VOL 108, Dub Chords 114, Echo Chamber 110 (hat delay send 22), Jungle Roller 119 (makeup 17, hat LEV 76, mid tom 88), Lo-Fi 119, Micro Clicks hats darker and lower (COL 22, VOL 78 / 68), Warehouse hat VOL 100, Deep Garage hat VOL 78 and master 115 |
| 9 | Low | Analog Toys' delay tail reached -60 dBFS 2 s after stop once its lead and chip parts were raised (QA long-tail flag) | QA audition run after the rebalance | their delay sends scaled back by the same factor (DEL 50 to 32, 60 to 34): tail -70 dBFS |

### Checked and left as they are

| Item | Finding | Why it stays |
|---|---|---|
| SRC layouts | All 34 machines' encoder layouts A-H match the manual's screens (pp.96-109), including the gaps (BT CLASSIC B and F, the hats' empty slots, UT IMPULSE) and the renamed labels (SY RAW TUNE, DEC2, NLEV) | correct |
| Machine behaviour | Each machine follows the manual's parameter descriptions and the firmware notes' structure: BD HARD's fixed sweep depth with SNP as the start of the pitch envelope, SD HARD's 3:2 tones with the low one 3x louder and a linear noise fade, RS HARD's 3.66:1 pair through the rim-shot circuit, CP CLASSIC's NUM bursts at RAT spacing, the toms as a struck resonator, the hats' 808 ratios and the closed path's fixed drop | correct; absolute times and pitches are tuned by ear (no hardware recordings), see Open |
| Kick | Warehouse's BD HARD: a fast first half-cycle from about 330 Hz (SNP 62) into an asymmetric, overdriven 46-50 Hz body, -20 dB at 143 ms. The 909-style and 808-style kicks behave as expected (fast vs subtle sweep) | sounds right. The default kit's BD HARD is the hardware init (SWT 90, SNP 6): a slower, droopier sweep, as the hardware's |
| Filter | Seven types from one Simper SVF: LP2 -12 dB/oct (fc to 2fc -14, 2fc to 4fc -10.8, 4fc to 8fc -12.6), LP1 -6, HP2 +12, HP1 +6, BS a -34 dB notch that narrows with RES, PK flat at RES 0 rising to +13.6 dB. Cutoff tracks FRQ within 1.5 % (FRQ 40: 139 to 141 Hz, 60: 440 to 434, 80: 1397 to 1383, 100: 4435 to 4418, 120: 14080 to 14016). Resonance peaks at +17 dB | correct (manual p.79) |
| Voice architecture | 12 tracks on 8 voices (BD, SD, RS/CP, BT, LT, MT/HT, CH/OH, CY/CB); on a same-time clash the right-hand track plays (manual p.21), otherwise the later trig takes the voice; overdrive before the filter (manual p.79); delay and reverb sends per track; the FX track's DIST, COMP, delay PRE/POST and reverb POST defaults (manual p.82); FX track level as the master return (manual p.36) | correct |
| CPU | the demo song renders at 12.2x realtime (about 8 % of one core, reverb included) | fine |
| SY DUAL VCO units | The manual gives TUN and BND 24 units an octave and DET 48 units an octave (p.103); the twin shows TUN and DET in semitones over the same range | changing a control's units would need saved-settings upgrades and lesson edits; low value. Listed for the integrator |
| Clicks in the machines | BD HARD's TIC is a two-sample click in the firmware notes; the twin uses a smooth 0.5 ms tick, softer than the hardware's | a two-sample click trips the QA click detector; a taste call with no recording to compare against |
| Studio Kit's ride | The kit sets up CY RIDE but its demo pattern has no ride trigs (the description promises a ride) | the sound is there to program; a pattern change would need recalibration |
| Page LED legends | "1:4 2:4 3:4 4:4" render at 6.5-7.1 px: the four LEDs are only 5.25 mm apart, so the fit squeezes them | the LEDs and the [PAGE] key carry the information; widening needs a layout change |

## Kit balance (per-track loudness, LU against the dry mix of the demo pattern)

Closed hats and the elements that changed; "before" is the merged build, "after" this branch.

| Kit | Before | After |
|---|---|---|
| Kit 01 (demo song A02 / A03) | CH -18.5 / -21.3 | CH -11.8 / -14.3 |
| Techno / Warehouse | CH -23.5, LT -6.1 | CH -15.7, LT -9.5 |
| Techno / Industrial Grind | BD -9.9, SD -1.3, CP -2.9, CH -22.5 | BD -4.7, SD -4.9, CP -4.6, CH -12.2 |
| House / Deep Garage | CH -17.3 | CH -13.3 |
| Electro / Miami Bass | SD -12.1, CP -10.3, LT -4.0, MT -3.2, CB -18.1, CH -24.0 | SD -6.2, CP -7.1, LT -8.5, MT -7.6, CB -12.7, CH -15.1 |
| Electro / Robot Funk | OH -4.7, CB -19.2, RS -14.7 | OH -12.8, CB -12.7, RS -10.0 |
| Drum Machine / Straight Boom | SD -8.1, CH -17.1 | SD -3.0, CH -10.5 |
| Hip-Hop / Dusty Boom Bap | CH -23.7 | CH -15.2 |
| Hip-Hop / Trap Sub | SD -10.8, CP -9.2, CH -24.4 | SD -6.5, CP -6.5, CH -14.4 |
| Breaks / Jungle Roller | MT -2.0, CH -13.8 | MT -5.5, CH -11.9 |
| Breaks / Big Beat | CH -20.0 | CH -13.9 |
| Minimal / Micro Clicks | BT -20.7, LT -22.6, CH -20.3 | BT -12.5, LT -14.5, CH -14.2 |
| IDM / Glitch Lab | CP -0.8, RS -25.2, CH -3.6 | CP -3.7, RS -11.0, CH -8.8 |
| Lo-Fi / Bitcrushed Tape | CH -26.8 | CH -14.9 |
| Percussion / Afro-Latin | CB -16.5 | CB -9.4 |
| Synth / Analog Toys | SD (lead) -13.9, RS (chip) -19.1 | SD -6.5, RS -8.3 |

## Measurements against the hardware

| Quantity | Hardware | Twin (measured) |
|---|---|---|
| SRC pages | 34 machines, layouts on pp.96-109 | 34 / 34 match |
| FLTR FRQ | one semitone a step, 440 Hz at 60 (REFERENCE: hardware measurement) | resonant peak within 1.5 % from 139 Hz to 14 kHz |
| Filter slopes | resonant 2-pole types; the 1-pole types flatter (p.79) | 12 / 6 dB per octave |
| Voices | 8 voices, 12 tracks, right-hand priority (p.21) | as specified |
| Overdrive | before the filter (p.79) | before the filter |
| Main outputs | +15 dBu maximum (p.76) | full-scale soft saturation (new) |
| Levels, everything up | bounded by the outputs | +1.3 dBFS sample peak (was +31.3) |
| DC | - | master AC coupling at 5 Hz; everything-up DC 2.7e-5 |
| Retrigger | - | continuous: no dip at the retrigger (was 40-45 % of the ringing level) |
| AMP ATK 0 | - | 0.4 ms linear ramp |
| Envelope and decay times | not stated in the manual | tuned by ear; see Open |
| CPU | - | 12.2x realtime for the demo song |
| Pads | velocity and pressure (p.11, p.21) | position on the pad stands in for force; pressure by sliding up; multi-touch (see below) |

## Pads, performance and the iPad

- Pads use pointer events with `touch-action: none` and per-pointer capture, so each finger is its own
  hit. Measured with CDP touch events at 1180 x 820 (hasTouch): two fingers landing together on BD and
  CH give two trigs; BD held, then SD and OH added, gives three trigs and three gate-offs on release.
  The trig is posted inside the pointerdown handler (under 1 ms from the touch event to the worklet
  message, measured over 20 taps), so a pad adds at most one 128-sample render quantum (2.9 ms) to the
  browser's own output latency (10 ms base + 32 ms output in headless Chromium; iPad Safari is lower).
- Scenes (12 per kit, fixed values) and performance macros (12 per kit, depth x pressure, QUICK PERF
  AMOUNT for the macros picked with [QPER]) work as the manual describes (pp.28-31); the lesson runner
  drives both.
- iPad speakers reproduce little below 150 Hz, so the kicks' 40-55 Hz bodies are heard there mainly
  through their click and first half-cycle. That is true of the hardware too; the louder hats help
  the kits read on small speakers.

## The builder's simplifications, ranked for making full tracks

1. **Sampling and user samples** (high). No way to bring your own one-shots or loops; the 32
   synthesized one-shots are stand-ins. For producers this is the largest gap after the machines.
2. **Parameter locks recorded live** (medium). Encoder moves during LIVE RECORDING are not recorded,
   so filter sweeps and the like have to be entered as locks step by step.
3. **Sound pool and sound locks** (medium). One sound per track per kit; per-step sound changes
   (several percussion sounds on one track) need machine-parameter locks instead.
4. **One song and one chain per project** (medium, mostly covered). The studio arranger lays out
   full tracks from patterns, so a single Rytm song is enough for one track; alternate arrangements
   and 64 chains for live sets are missing.
5. **MIDI notes in** (medium for pad-controller users). MIDI learn maps knobs, but the Rytm has no
   note input, so an external pad controller can't play the tracks (the hardware maps notes 0-11 to
   them, p.85).
6. **Euclidean mode** (low-medium): a fast way to sketch percussion patterns.
7. **Step recording and page playback** (low): grid recording covers the first; page playback is a
   live nicety for 64-step patterns.
8. **Click track, PATTERN tempo mode** (low): the studio has a click; one project tempo is normal for
   one track.

## Audio QA

`node scripts/audio-qa.cjs http://localhost:3146 analog-rytm --target -18 --suggest`, and the same
with `--excite analog-rytm=transport`, 44.1 kHz:

| Run | Median | Spread | Worst true peak | Flagged |
|---|---|---|---|---|
| Before (merged build), audition | -18.2 LUFS | 3.1 LU | -1.6 dBTP | 0 of 20 |
| Before (merged build), transport | -18.4 LUFS | 3.2 LU | -1.3 dBTP | 0 of 20 |
| After (this branch), audition | -18.9 LUFS | 3.1 LU | -1.7 dBTP | 0 of 20 |
| After (this branch), transport | -19.0 LUFS | 3.4 LU | -1.7 dBTP | 0 of 20 |

The median is 0.6-0.7 LU lower: several kits gave level back for true-peak margin (finding 8), measured
over 12 random states rather than single takes. Every kit is inside the window (-21.3 to -17.7 LUFS).
The merged build's clean runs were partly luck: the same randomised sweep finds 5 marginal detector
events in 168 renders of its seven densest kits (Warehouse, Deep Garage, Big Beat with ratio 3.9, Lo-Fi
twice); this branch finds 2 in the same set (Warehouse and Jungle Roller, ratios 2.5-2.6, against the
detector's 2.5 threshold), and every kit's worst true peak over 12 random states is at or under -1.5 dBTP.

## Upgrade notes

- No control ids, meanings or defaults changed. Saved projects need no conversion.
- Sound changes saved kits will hear: closed hats on CH CLASSIC and HH BASIC +7 dB, CH METALLIC +5 dB,
  HH LAB -4 dB; no dip on retriggers; one-shot samples fade out over their last 3 ms; the output
  saturates at full scale.
- The factory kits' values changed (`presets.ts`). Projects saved before keep their stored copies of
  kits 03-22 (the project migration keeps a saved project's kits); loading a factory kit from the
  preset menu gives the new values. An upgrade that refreshes untouched factory kits is optional.
- Lesson s3 (`analog-rytm-s3-hats-cymbals-choke`): two steps changed content (the high-pass FRQ
  target 70 to 104, the ear challenge's controls); the id is unchanged.

## Open

- **Absolute calibration.** Decay times, sweep times, base pitches and the machines' relative levels
  are tuned by ear; the manual gives no times and the firmware notes say none of it has been heard.
  A hardware unit (or recordings of init sounds) would settle them. Examples worth checking first:
  the BD base pitch at TUN 0 (55 Hz here), SD CLASSIC's NOD and DEC ranges (the 808-style kits now set
  longer values), the tom strike's brightness.
- **The QA click detector on dense or very smooth material.** Like DFAM finding 24, some kits can trip
  the detector now and then without an audible click. Offline, with the QA tool's own detector at 120 BPM:
  - Dense, driven downbeats (a fast rise into the clipper's plateau): 2 events in 168 randomised renders
    of the seven densest kits (Warehouse and Jungle Roller, ratios 2.5-2.6); the merged build had 5 in
    the same set.
  - Dub Chords: a -34 dBFS kink (ratio 4) where the chord retriggers onto its own delay echo, 1 of 320
    renders. It is identical with the original worklet: the compressor model computes its gain target
    every 7 samples and smooths it with two one-poles, which leaves a slope change on a near-sine chord.
    Removing it would mean computing the gain every sample, changing the calibrated model's structure.
  So a single QA run has a small chance (a few percent) of one flag; both final runs were clean.
- **One manual lesson step.** t2's arranger challenge has no `solution`: `LessonSolution` cannot set
  arranger sections (a framework change).
- **SY DUAL VCO units** (manual p.103) and **BD HARD's two-sample TIC** (firmware notes), above.

## Full-track features

A second pass after this review built the features its ranking names, to the OS 1.72 manual. Page
numbers are the manual's; where it leaves the behaviour open the twin's choice is marked **design**
(REFERENCE.md has every row).

### What was built

| Feature | Manual | Code | What it does |
|---|---|---|---|
| Live recording of parameter locks | pp.40-41, 43, 47, 67 | `live.ts`, `engine.ts` (`liveTurn`, `liveHit`), `ui.tsx` (`LiveRec`), `index.ts` (`liveRecTurn`) | In LIVE RECORDING an encoder turn on the active track's PARAMETER pages locks the step the sequencer is at: note trigs get the lock, empty steps a lock trig. [FUNC] + [NO], [NO] + an encoder and [NO] + pads erase locks, one parameter's locks or trigs on the steps reached while held (sound locks stay). Pad hits now also record their length, their CHROMATIC pitch and, with [RTRG], the roll; [RECORD] + [PLAY] twice switches quantize |
| Sound pool and sound locks | pp.24, 26, 31-35, 48 | `pool.ts`, `engine.ts` (`lockedSound`), `ui.tsx` (`SoundPoolPanel`, `SoundLockPicker`), the worklet's per-trig machine | A project pool of 128 Sounds: [YES] + [MUTE] or the SOUND menu stores the active track's Sound; the menu previews, loads, renames and deletes. Hold a note trig and turn TRACK LEVEL (or tap the list) to sound lock it; Sounds the track can't run are marked (!) |
| Euclidean sequencer | p.44 | `euclid.ts`, TRIG page 2 (`EUC_PAGE` in `model.ts`, `index.ts`), the screen's map | [TRIG] twice: PL1, PL2, LEN, EUC, RO1, RO2, TRO, OP per track and pattern. The track's own trigs hide and come back; [FUNC] + EUC off keeps the generated ones; generated trigs take parameter and sound locks; [RECORD] lights purple |
| CHROMATIC from keys and MIDI | pp.19, 22-23, 43 | `engine.ts` (`noteOn` / `noteOff`), `keyboard` in `index.ts` | The computer keyboard (A-K, Z / X) and MIDI notes from the studio's MIDI routing (`lib/midi`, unchanged): notes 0-11 play tracks 1-12, 12-59 the active track chromatically, and both record in LIVE and STEP RECORDING |
| STEP RECORDING | pp.40-41 | `engine.ts` (`stepRec`), `ui.tsx` (`StepRecTrigs`) | [RECORD] + [STOP], STANDARD and JUMP; a trig key picks the active step, pads (several at once) place trigs, [NO] a rest, LEFT / RIGHT move, [YES] held times the length, a held trig key takes locks |
| User samples | pp.35-36, 56, 58-59 | `samples.ts`, the SAMPLES menu, the worklet's `smp` message | A WAV or AIFF from the file picker (the iPad's Files app) replaces a sample slot's built-in one-shot for this project; IndexedDB holds the audio, the project only the reference; a missing sample falls back to the built-in one-shot and the screen says so |

### Choices where the manual is silent (**design**)

- **Live recording.** The turn is also an ordinary edit: the kit value follows the knob, so the change
  is heard at once and the step locks hold what was heard. A turn lands on the step nearest to it (as
  a hit does); turns of one encoder less than three steps apart also lock the steps in between to the
  value that played there, so a slow sweep records without gaps. The touch stand-in for "[NO] + press
  the encoder" is [NO] held while turning it. The panel reports turns to the engine (`ui.liveTurn`),
  because only the engine knows where the sequencer is; the lag is taken off the turn's time.
- **Sound locks** are the trig's `sound` lock (pool slot 1-128). It counts against the 72-parameter
  budget as one parameter of its track. The engine plays the whole pool Sound as locks with the trig's
  own locks on top (mapped to the Sound's machine) and switches the voice to its machine for that trig;
  lock trigs that follow apply to that Sound. [NO] + pads leaves a sound-locked step as a silent lock
  trig holding the lock, so "sound locks will not be erased" (p.47) and a later hit plays it again.
- **Euclidean.** Bjorklund's algorithm, first pulse on step 1 (3 of 8 = x..x..x.); rotations run
  -63..+63 within the track length. A generated trig on a step holding one of the track's own note
  trigs plays that trig, our reading of p.44's "distributed according to the settings". Everything
  that plays or shows trigs reads a view of the project (the sequencer, the trig keys, the trig editor,
  live recording, the arranger list), and edits there are written back: lock edits to the track's
  `euc.steps`, added or removed trigs refused with a message.
- **Keys and MIDI.** Notes above 59 are ignored, as the manual lists no use for them on the active
  track. A track plays one note at a time; only its latest note ends the gate.
- **Step recording.** The active step moves on when the last pad of a chord is let go.
- **User samples** are mixed to mono, cut at 33 s and normalized to the built-in one-shots' peak, so
  they sit in the kits' calibrated mix. They stay in the browser that loaded them.

### Measurements

| Check | Result |
|---|---|
| Null test, engine | Message streams to both worklets recorded in a deterministic offline run (virtual timers, seeded `Math.random`) of the demo song (52 s) and all 20 kit patterns (9 s each), baseline build against this branch: 21 of 21 identical |
| Null test, worklet | The same streams rendered sample-accurately through the baseline worklet and this branch's (Node harness: dry, delay return, reverb send, the 12 control channels, master): 21 of 21 bit-identical |
| CPU | `/bench`, analog-rytm, interleaved pairs on a shared machine (load 2-3), the baseline build against this branch: 17 pairs before 23.7× realtime mean (best 28.3×), after 23.2× (best 26.4×), median pair ratio 0.977; on the final build 6 more pairs, 25.5× against 25.1×, mean ratio 0.988. The worklet's CPU time alone (Node, the demo song, 5 runs each): new / old 0.993 best, 1.003 median, so the differences are the machine's noise |
| Gates (final build) | tsc, lint and validate (0 errors) clean; smoke without errors (keys A and G now play the active track); lesson runner 22 lessons, 0 failed, 0 manual; audio QA audition median -18.8 LUFS, spread 3.4 LU, worst true peak -1.7 dBTP, 0 of 20 flagged; transport median -18.9 LUFS, spread 3.3 LU, worst -1.5 dBTP, 0 of 20 flagged; e2e 47 of 47; the seeded monkey test (277 random actions on the Rytm) without a page error |
| Unit tests | `npx tsx scripts/test-rytm.ts`, 47 checks: the live recording edits (locks, lock trigs, the steps between turns, the erase keys and sound locks, lengths, rolls, the lock budget), the Euclidean generators (E(3,8), E(5,8), E(7,16), the four operators, rotations), the view and its write-back, EUC off and the [FUNC] convert, the Sound pool (capture, fit, load, sound locks on note trigs only), and the WAV / AIFF readers (8 / 16 / 24-bit PCM, float, extensible WAV, AIFF, AIFC `sowt` and `fl32`). `npm run test:seq` still passes (233; the library is unchanged) |
| The real panel (Playwright, touch pointers, iPad 1180 × 820) | A 2.4 s FRQ drag in LIVE RECORDING at 120 BPM locked all 16 steps (4 note trigs, 12 lock trigs) and left the kit value at the end of the turn; [FUNC] + [NO] for 1.5 s erased 13 of them; a held trig + TRACK LEVEL sound locked it to pool slot 2; TRIG page 2 set RS to 5 OR 4 pulses; STEP RECORDING placed SD on the chosen step and moved on; keys A and K played; a WAV from the file picker went into slot 02 and played; a missing sample showed its message. The new text measures 9 to 11 px after the panel's 91 % fit, and the new buttons are 30 px or more (the step-recording keys 49 px); the smaller texts on those screens were there before (the shared trig keys' numbers, the screen footer's kit name, the rear legends) |

### Lessons

- `analog-rytm-q5-live-locks` (sequencing): record a filter sweep on the Analog Toys bassline in LIVE
  RECORDING, see the lock trigs it leaves, leave with [PLAY], then record a second move on the hats.
- `analog-rytm-q6-euclidean` (sequencing): a clave from one pulse generator, five over sixteen, a
  second generator with OR and then XOR, SUB in a quiz, and a three-track Euclidean groove.

Every existing lesson id and check is unchanged; the lesson runner solves all 22.

### Upgrade notes

- No existing control id, range or default changed. New controls: `euc_pl1`, `euc_pl2`, `euc_len`,
  `euc_on`, `euc_ro1`, `euc_ro2`, `euc_tro`, `euc_op` (TRIG page 2; in `uiControls`, never stored).
- New optional data: `RytmProject.pool`, `RytmProject.samples`, `Track.euc` (with `euc.steps`) and the
  `sound` lock key. Saves without them load unchanged; the migration carries them through older
  formats too, so no version bump or conversion is needed.
- Behaviour a learner may notice: [YES] + [MUTE] stores the track's Sound in the pool (it showed a
  message before); a held trig + TRACK LEVEL picks a sound lock instead of changing the level;
  [FUNC] + [NO] during LIVE RECORDING erases locks (elsewhere it still reloads the kit); keys A-K and
  MIDI notes play the Rytm; live-recorded hits also record their length (and their pitch in CHRO).
- The module now has `keyboard`. Audio QA and `/bench` don't change their excitation: the module's
  audition and its transport control come first.

### Left for later

- Pad scales and the rest of the TRACK menu (pp.42, 110): CHROMATIC plays all twelve semitones.
- Pad pressure recorded as lock trigs in LIVE RECORDING (p.41) and the click track's preroll (p.46).
- In STEP RECORDING, [TRIG] + [YES] previews and [FUNC] for a fixed MIDI velocity (p.41).
- The +Drive Sound library and the browser's sorting and tags (pp.31-33); sampling (pp.56-57).
- User samples travel with the browser, not with an exported project: adding them to the studio's
  project files is a studio-core change.
- The live-lock edits (`live.ts`) and the Euclidean view are generic; they could move into
  `lib/sequencer/elektron` for the Analog Four's live recording.
