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
| 2 | High | **Kits were unbalanced as genre starting points.** Miami Bass and Trap Sub had weak backbeats (SD -12.5 / -10.8 LU, CP -10.7 / -9.3), with Miami's toms louder than its snare; Straight Boom's 808 snare sat under its cowbell and open hat; Industrial Grind's distorted kick was at -10 LU under the SD FM (-1.3); Robot Funk's open hat -4.8 LU; Glitch Lab's clap roll louder than the whole mix (+0.7); Micro Clicks' impulse percussion -21 / -23 LU; Analog Toys' lead and chip parts -14 / -19 LU; the cowbells of Miami Bass and Afro-Latin -18 / -16.5 LU; Lo-Fi's hat low-passed at 5.6 kHz to -24.9 LU | offline per-track loudness of every demo pattern, LU against the dry mix (table below) | Kit values in `presets.ts`: SD CLASSIC longer (DEC, NOD) and louder (NOL, TRACK LEVEL) in the three 808-style kits, louder claps, kick up and snare down in Industrial Grind, toms and open hats trimmed where they outshouted the beat, impulse LEV up, synth parts up, cowbells up, Lo-Fi's hat opened to FRQ 112. Master sections re-checked (finding 7) |
| 3 | High | **Retriggering a ringing voice clicked.** A trig on a sounding voice (a roll, a fill on a tom still ringing, CH taking the voice from OH) dipped by about 40-45 % of the ringing level on the second sample | harness, BD, LT and MT retriggered 30-60 ms into a hit: MT 0.2019, 0.2019, **0.1114**, 0.1605...; BD 0.0507, 0.0507, **0.0275**, 0.0409. Cause: the new sound's fade-in started the filter input at zero, so the input stepped from the old level to ~0 and the open filter's 2-3 sample response (with overshoot) got past the output-side declick, whose offset is taken on the first sample | The filter input now carries on from the old sound's last value over the same 1.3 ms raised cosine. After: MT 0.2019, 0.2019, 0.2027, 0.2047; the step measure at the retrigger fell to the sound's own onset level (MT 0.505 to 0.050 of peak, LT 0.273 to 0.043, BD 0.104 to 0.031) |
| 4 | Medium | **No output headroom.** With every level, the overdrive, accent, the compressor makeup (up to +40 dB, a measured hardware curve) and the delay feedback at maximum, the instrument output reached +31.3 dBFS. The hardware's main outputs top out at +15 dBu | manual p.76; harness stress render | An order-12 soft saturation at full scale before the AC coupling (unchanged below -6 dBFS, -0.16 dB at -1 dBFS; the calibrated kits lose at most 0.1 dB on their highest peaks). Everything-up now peaks at +1.3 dBFS (the AC coupling after the clip), output DC 2.7e-5 (was 4.6e-3) |
| 5 | Medium | **Lesson s3's comparisons were inaudible.** The A/B "full range vs high-passed" closed hat used HP2 at FRQ 70 (785 Hz), and the ear challenge asked for an open hat's high-pass FRQ at 40 vs 90 (139 Hz vs 2.5 kHz). The hat circuit already removes everything below ~4 kHz, so neither changes the sound | harness: CH open vs HP2@70 both -30.7 LUFS, centroid 7135 vs 7172 Hz; OH HP2@90 vs @40: 0.6 LU and 100 Hz apart. PEDAGOGY: "Match targets must be clearly distinguishable by ear" | The high-pass step uses FRQ 104 (5.6 kHz: -4.2 LU, centroid +475 Hz) with an explanation of why a hat's high-pass only bites in the kilohertz; the ear challenge matches DEC and COL (both taught in the lesson): DEC 30 / COL +30 against DEC 90 / COL -30 rings 5x longer with its centroid 4.7 kHz lower. Lesson id unchanged |
| 6 | Medium | **Key legends below the legibility floor on iPad.** The FUNC sub-legends (Save Project, Kit, Sound, Track, Pattern, Song, Setup, Tap Tempo, Save Kit, Metronome, Save, Reload...) and the trig-key numbers rendered at 7.3 px at 1180 x 820; the MIDI rear legends at 5.6-5.9 px | Playwright text probe, effective size after the 91 % fit | Sub-legends 8 px to 10 px (9.1 px on iPad), MIDI rear legends on two lines so the fit keeps them at the floor. Screenshots checked: no overlaps |
| 7 | Medium | **High master drive vs dense downbeats.** In Warehouse (DIST AMT 30), Big Beat (30) and Lo-Fi (44), dense hits drove the order-12 master clipper three to four times past its knee, where the output flattens into a plateau right after a fast rise. The QA click detector flagged that intermittently once the hats got louder (Big Beat in 2 of 4 audition runs, Lo-Fi in 1 of 2 transport runs). Big Beat also reached -0.88 dBTP in offline takes (the browser takes were lucky at -1.5 to -2.1) | offline sweeps with the QA detector, 16-24 start offsets at 120 BPM; sample dumps show the plateau at the clipper ceiling times the compressor gain. A softer order-6 knee did not help, so it is the depth of the drive, not the knee shape | DIST AMT 20 (Warehouse), 12 (Big Beat, snare VOL 96), 26 (Lo-Fi, VOL 122). Each is clean over 24 offsets; worst true peaks -1.70, -1.71 and about -1.7 dBTP. Cost: 1-2 LU of loudness on those three (still inside the QA window) |
| 8 | Medium | Jungle Roller reached -0.6 dBTP in the transport QA after the first rebalance | the studio plays it at 120 BPM instead of 170, so the parallel compressor recovers more between hits | compressor makeup back to 17 (was 16 originally), hat LEV 88, mid tom VOL 88: worst true peak -1.77 dBTP over 4 offsets |
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
| Techno / Warehouse | CH -23.5, LT -6.1 | CH -14.1, LT -9.5 |
| Techno / Industrial Grind | BD -9.9, SD -1.3, CH -22.5 | BD -3.0, SD -5.3, CH -16.8 |
| House / Deep Garage | CH -17.3 | CH -10.6 |
| Electro / Miami Bass | SD -12.1, CP -10.3, LT -4.0, MT -3.2, CB -18.1, CH -24.0 | SD -6.2, CP -7.1, LT -8.5, MT -7.6, CB -12.7, CH -15.1 |
| Electro / Robot Funk | OH -4.7, CB -19.2, RS -14.7 | OH -12.8, CB -12.7, RS -10.0 |
| Drum Machine / Straight Boom | SD -8.1, CH -17.1 | SD -3.0, CH -10.5 |
| Hip-Hop / Dusty Boom Bap | CH -23.7 | CH -15.2 |
| Hip-Hop / Trap Sub | SD -10.8, CP -9.2, CH -24.4 | SD -6.5, CP -6.5, CH -14.4 |
| Breaks / Jungle Roller | MT -2.0 | MT -7.1 |
| Minimal / Micro Clicks | BT -20.7, LT -22.6, CH -20.3 | BT -12.6, LT -14.5, CH -13.6 |
| IDM / Glitch Lab | CP -0.8, RS -25.2, CH -3.6 | CP -3.7, RS -11.0, CH -8.8 |
| Lo-Fi / Bitcrushed Tape | CH -26.8 | CH -14.4 |
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
  hit. Measured with CDP touch events at 1180 x 820: PADS_RESULT
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

QA_TABLE

## Upgrade notes

- No control ids, meanings or defaults changed. Saved projects need no conversion.
- Sound changes saved kits will hear: closed hats on CH CLASSIC and HH BASIC +7 dB, CH METALLIC +5 dB,
  HH LAB -4 dB; no dip on retriggers; the output saturates at full scale.
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
- **The QA click detector and the master clipper.** Kits whose master drive is close to the clipper
  can still trip the detector now and then on a dense, unmasked downbeat (the same kind of event as
  DFAM finding 24). After the changes above the offline sweep at 120 BPM found SWEEP_RESULT.
- **SY DUAL VCO units** (manual p.103) and **BD HARD's two-sample TIC** (firmware notes), above.
