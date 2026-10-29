# Analog Four MKII twin: independent review

This is a reviewer's pass over `devices/analog-four/**` and `public/worklets/analog-four-processors.js`.

- **Primary source:** the Analog Four MKII User Manual for OS 1.55, cited as "M p.N".
- **Other sources:** `docs/research/analog-four/` (panel.md, signal-flow.md, sources.md) and a top-down image of a black unit, used only as a measurement reference (panel.md, IMG).
- **Measurements:** an offline Node harness that runs the `a4-voice` worklet exactly as the engine drives it, plus Playwright runs of the production build.

The panel geometry was verified first, because the earlier verdict on this instrument was "looks nothing like it". Every element position is right: they all agree with the manual's drawing to about 1 mm. What still looked wrong was the surface: small grey legends, grey knurled knobs and outlined lit keys. Those are fixed.

## Findings and changes

| # | Severity | Finding | Evidence / source | Change |
|---|---|---|---|---|
| 1 | High | **BND (auto bend) did nothing.** The OSC 1&2 knob D had no effect in the worklet, and its help text called it a MIDI pitch-bend range | M p.88: each trigged note starts offset by BND and glides to its pitch in the SLI time; with sync on, only the synced oscillator bends | Implemented: 0.5 semitone a step, falling fast at first, over the SLI time. Only the synced oscillator bends for 1>2 and 2>1, both for metal. Measured: BND +24 starts at +11.2 st, +2.4 st after 100 ms and 0 after 200 ms (SLI 64, 0.19 s); BND -24 mirrors it. Description corrected |
| 2 | High | **The transport audio-QA gate failed: 8 of 47 flagged.** 7 presets left delay or reverb tails above -60 dBFS 2 s after the studio stop. The empty project was silent on PLAY | audio QA `--excite analog-four=transport` on the reviewed build: `median -19.0 LUFS, spread 7.6 LU, 8 of 47 flagged (long-tail 7, silent 1)`, exit 1. The builder's 0/47 was the audition run only | A stop from the studio (■, Space, the arranger's end) is now a full stop for the rack: the voices are cut and the sends fade in 1.5 s. The A4's own [STOP] key and the end of its own song keep the hardware ring-out, and [STOP][STOP] still fades in 0.3 s (M p.38). The init preset keeps a blank pattern memory but has one trig per beat on T1, so PLAY sounds. Measured in the app on Dub Chords: after the [STOP] key the echoes are at -35 dBFS 1 s later and -47 dBFS 2 s later; after a studio stop, -51 and -103 dBFS |
| 3 | High | **The panel surface did not read as the black unit** (geometry was right; see "Panel"): <br>• Legends at 7.5-8 px: about 25 % smaller than the unit's printed legends, and below the app's 9/10 px floors on the iPad (95 % fit). <br>• Legends grey (#9a9da2) where the unit's are near-white. <br>• Knobs drawn as grey knurled rings, where the unit has satin-black domes. <br>• Lit keys drawn as coloured outlines, where the unit backlights the legend. <br>• Arrow chevrons and transport icons tiny. <br>• Beat-marker frames on TRIG 1/5/9/13 were narrow portrait boxes, not squares. <br>• "Quick Performance" sat 15 mm right of where it is printed (under TRIG 8). <br>• "Sound Browser" sat detached from "Track Level" | M p.12 drawing; IMG side by side at equal scale. Text sizes, colours and positions were measured on both | Legends 9.5-10 px native (about 9-9.5 CSS px on the iPad), near-white, with no two legends touching. Black glossy knob caps (an instance-scoped restyle of the shared cap). Keys lit through their legend with a soft glow, the cap staying dark. Chevrons 17 px and transport icons 22 px. Square beat frames. The bracket label centred under TRIG 8 and Sound Browser right under Track Level. See "Panel" |
| 4 | Medium | **Portamento glided sequencer notes.** PRT ON slid every note, and PRT LEG worked without LEGATO MODE | M p.35: PORTAMENTO and LEGATO MODE affect only notes played on the keyboard or from MIDI, and LEGATO portamento needs LEGATO MODE on | Glide only on played notes, and LEG needs LEGATO MODE. Slide trigs always glide. The "Lead / Glide Saw" demo now glides with slide trigs, and its description says why |
| 5 | Medium | **An accent changed only the level** | M p.51: an accent changes "the volume and filter envelope behavior" | An accent now also deepens ENV F's sweep of both filters: x(1 + 0.8 ACC/127). Measured: +22 dB more 2 kHz in the first 30 ms of an accented note (F1 40, DEP +30). Acid Workout's accented line then peaked at -1.3 dBTP, too close to the -1 ceiling, so its bass VOL went from 84 to 76 |
| 6 | Medium | **FDB could never self-oscillate.** Its loop gain was 0.8 at LEV 127, with no AC coupling | M p.73: high FDB levels self-oscillate (drums, screams); moderate ones overload what OSC 2 feeds in | The feedback path is AC-coupled (25 Hz) with a loop gain of 1.3 at LEV 127. Measured: no oscillation at LEV 64; it self-oscillates from LEV 100 at RES 0 (157 Hz at FRQ 100, 67 Hz at FRQ 70). OSC 2 + FDB 64 is +5 dB more overdriven. Cutoff and resonance change the behaviour, as the manual says. No preset uses FDB |
| 7 | Medium | **ARP LEG had no effect on note trigs with the arpeggiator off** | M p.44: LEG "will affect the note trigs of the track even if the MOD setting is set to OFF" | Overlapping note trigs now play legato with LEG ON: the gate carries over and the envelopes are not retriggered. Measured: the level change at the next note is -0.2 dB with LEG and +0.8 dB (a retrigger) without. LEG's help text said "glide"; corrected |
| 8 | Medium | **No output stage, so levels were unbounded.** One voice with every source up, OVR, VOL 127, TRACK LEVEL 127 and an accent peaked at +15.7 dBFS (+21.8 dBFS with ACC 127). That is about +12 dBFS at the instrument tap | harness, single voice | An analog-style output stage sits after the dry + FX mix and before MAIN VOLUME (M p.15): unity to 0 dBFS, then a soft knee to +3.5 dBFS. It is not oversampled, because the 2x filter overshot clipped peaks by 1 dB. Measured in the app with all four tracks that hot, on Night Drive: +0.20 dBFS at the instrument tap. Normal kits peak below the knee; the drums' highest peaks lose under 0.1 dB |
| 9 | Medium | **Lesson texts used labels that are not on the panel:** <br>• "BANK G (NOTE SLD)": the panel says Note Slide. <br>• Delay "FB": the screen says FDB. <br>• sq4 taught [SONG] to open SONG EDIT; on the hardware that is [FUNC] + [SONG MODE] (M p.55-57). <br>• f2 said 5TH is "a fifth below the octave"; it is a fifth below the oscillator, at 2/3 of its frequency (M p.72) | PEDAGOGY.md writing rules | Texts fixed. Lesson ids and checks are unchanged |
| 10 | Low | Touch targets: the 11 mm keys are about 32 CSS px on the iPad | PEDAGOGY / platform guidance: 44 px | On touch screens, small keys and keyboard keys answer within 44 px, and wide keys get the extra height only. Their neighbours are 16-17 mm apart, so the hit areas do not overlap |
| 11 | Low | The worklet header said NEI takes the post-VCA signal. The code correctly sends the multimode output before the VCA (M p.73) | code reading; harness: T1's feed carries on at -7.6 dBFS while its own VCA is closed, and T2 plays T1's 130.8 Hz | Comment fixed |
| 12 | Low | The delay's WID is a time offset between the channels. In the manual it places the echo (X 0) or sets the ping-pong width (X 1), and X 1 always swings fully | M p.95 | Left; documented in REFERENCE.md. Changing it would move every kit's echo, because WID defaults to +63 |
| 13 | Low | There is no TRANSPOSABLE / KEY SCALE (M p.47, p.53): song-row transposes and [TRNS] move every track | M p.53, p.57 | Left; documented. The drum sounds run with oscillator TRK OFF, so they keep their pitch |

## Measurements against the hardware

| Quantity | Hardware (manual) | Twin, measured offline at 48 kHz |
|---|---|---|
| Pitch tracking | Note-tracked oscillators; TRK OFF gives a constant pitch (p.87) | Within 0.5 cent from C0 to C7 (16.35-2093 Hz); +1.2 cent at C8 (estimator resolution). TRK OFF holds 261.63 Hz at any note |
| TUN, FIN, DET | Semitones; 1 turn of FIN = 1 semitone; DET a fixed number of Hz (p.87) | TUN +-63 st exact; FIN 1/128 st per step; DET 0.125 Hz per step (+63 = +7.9 Hz: 269.5 Hz at C4) |
| Sub oscillators | 1OCT f/2, 2OCT f/4, 2PUL 25 % pulse at f/4, 5TH 33 % pulse at 2/3 f (p.72) | 130.81 / 65.41 / 65.41 / 174.43 Hz at C4 (exact) |
| Envelopes | Times not published; 12 shapes (p.74-75) | The twin's law: 0 = 1 ms, 64 = 0.13 s, 127 = 16 s. STD decay reaches -60 dB at about 1.2x the nominal time; LIN reaches zero at the nominal time; fastest rise 1.5 ms |
| F1 ladder | 24 dB/oct; RES about 25 is the flattest; it self-oscillates (p.73, p.89) | -23 to -26 dB/oct from 2x to 8x the cutoff. At RES 0 it is -12 dB at the nominal cutoff (the ladder knee). Self-oscillation from RES ~120 at -17 dBFS, exactly on the FRQ law (110/220/440/880/1760/3520 Hz at FRQ 36-96). The Hz law itself is the Rytm's measured one (not published for the A4) |
| F2 multimode | LP2 12, LP1 6, BP 6/6, HP1 6, HP2 12 dB/oct, BS notch, PK boost (p.74) | LP2 -11 to -13, LP1 -6, HP1 +6, HP2 +10 to +12 dB/oct; BS -18 dB at the cutoff; PK +9 dB at RES 80 |
| Levels | +19 dBu maximum output (p.85) | The init voice peaks at -2.2 dBFS at the voice and about -5.5 dBFS at the tap. The worst case is bounded by the output stage (finding 8) |
| DC | - | Mean/RMS below 0.6 % for SAW, TRP, PUL and TRI at every PW; 2PUL sub 1.5 % |
| Retrigger and stop clicks | - | A retrigger's largest sample step is 1.2-1.8x the steady signal's for all shapes (no click). The [STOP] cut takes 6 ms, click-free, and is silent after 10 ms |
| CPU | - | `scripts/bench.cjs`: the whole A4 (4 voices + FX, 8 worklet nodes) renders the demo song at 6.8x realtime on a machine shared by about 7 agents |

## Panel

- **Positions.** The manual's drawing (p.12, 200 dpi) is 1074 x 625 px for 385 x 224 mm. Every blob centre was located by flood fill, and all 37 elements match panel.md and `geometry.ts` (drawing minus the 2 mm frame) within about 1 mm. Examples, drawing then twin + 2 mm:
  - DATA ENTRY: x 220.6/249.1/277.6/306.1/334.6, y 38.0/66.5, against 221/249/278/306/335, 38/66.
  - TRIG keys: x 23.7 ... 339.5 at y 192.8, against 24 + 21(n-1) at 192.
  - Keyboard: lower row at y 160.2, upper at y 137.3, against 160 and 137.
  - The geometry needed no change.
- **Surface.** This is what made it look "nothing like it", and the IMG comparison at equal scale shows it:
  - the legends' size and colour;
  - the knob caps;
  - how lit keys glow;
  - the icon sizes.
  
  All of these are fixed (finding 3). The knob caps are restyled by an instance-scoped stylesheet over the shared `elektron` cap. A proper "satin dome" cap variant in `components/controls/Knob.tsx` would be cleaner; that file is outside this review's scope.
- **iPad (1180 x 820, 95 % fit).** All legends render at about 9-9.5 CSS px, and none touch. "Fit" fits the width, so the last row of printed legends (A-P, T1-CV, Quick Performance) and PAGE's "Scale" sit just below the fold. The trig keys themselves are visible. This is app-level: Fit does not consider height on this panel's 1.72 aspect.
- **Kept as the builder had it:**
  - The OLED is drawn 1.2x its real size, and shows values under the knobs (the real screen shows icons only). Both help learning.
  - GRID RECORDING is on by default.
  - The lock dot on locked trigs replaces the hardware's rapid flashing.

## Builder's choices

| Choice | Verdict |
|---|---|
| Old A4 saves start fresh | **Acceptable.** About 500 ids were redefined and the old patterns lived in control strings, so no faithful conversion exists. Recommendation for the integrator: keep the old values in the save under a legacy key instead of discarding them, and show a one-time notice that the A4 was rebuilt. Today the user's old work disappears silently |
| [STOP] lets the delay and reverb ring; [STOP][STOP] fades them | **Correct** (M p.38: "effects like the Saturator Delay will continue to be audible"; the double press fades the send effects). Refined: a stop that comes from the studio now fades the sends in 1.5 s, so the studio's ■ means "everything stops". The A4's own key keeps the hardware behaviour (finding 2) |
| No POLY | **Right for the effort** (allocation modes, unison, the PLY arp, voice stealing; M p.28-29). It is the biggest gap for making full tracks: one track cannot play chords or pads. The 5TH-sub chord trick (M p.73) and OSC 2 intervals cover two- to four-note voicings |
| No sound locks | **Acceptable.** P-locks of the sound's parameters do the same job, as Night Drive's one-track drums show, at more effort |
| No Euclidean page | **Acceptable**; low value for the effort |
| No STEP RECORDING | **Acceptable.** Grid recording plus hold-a-trig + keyboard covers note entry, and with a mouse step recording saves little |

**Also missing for making full tracks.** These are reported, not built:
1. **A kit per pattern.** All patterns share one kit, so the sound cannot change between song sections except by p-locks (M p.38).
2. **Separate track outputs.** The A4 is one stereo stem, so its four voices cannot be mixed or bounced separately in the studio mixer (M p.14: four stereo track outputs).
3. **LIVE RECORDING of knob moves** (M p.50). Parameter slides are the workaround.
4. **TRANSPOSABLE** (M p.47).
5. **Trig, page and sound copy/paste** (M p.54).
6. **[PAGE] + [TRIG] page playback** (M p.39).

## Presets

- Audio QA, before (the reviewed build):
  - Audition: `[analog-four] median -18.9 LUFS, spread 9.0 LU, 0 of 47 flagged (none)`, exit 0.
  - Transport: `[analog-four] median -19.0 LUFS, spread 7.6 LU, 8 of 47 flagged (long-tail 7, silent 1)`, exit 1.
- The first after run (transport) cleared every tail and the silent init. It flagged two loudness outliers caused by this review:
  - "Lead / Glide Saw" at -13.2 LUFS: its slide demo is legato.
  - The init pulse at -22.5 LUFS.
  
  They were calibrated: Glide Saw TRACK LEVEL 76, and the init trigs are 3 steps long. The Acid Workout bass VOL went from 84 to 76 for true-peak margin (finding 5).
- After, on the final build:
  - Audition: `[analog-four] median -18.9 LUFS, spread 7.4 LU, 0 of 47 flagged (none)`, exit 0, max true peak -2.4 dBTP.
  - Transport: `[analog-four] median -19.0 LUFS, spread 7.4 LU, 0 of 47 flagged (none)`, exit 0, max true peak -1.6 dBTP (Drum / Zap Perc, the same as before the review).
  - Every tail is at about -103 dBFS 2 s after a studio stop.
- Names follow "Category / Name". "Kit / Empty project (init sounds)" became "Kit / Init sounds (blank pattern)", with the same preset id.
- The sounds are musically sensible and true to their character, with no copied factory names.

## Lessons

- The lesson runner plays all 20 lessons with 0 failed and 2 manual steps. Both manual steps are in st2, which arranges the studio: the lesson solution API cannot set the arranger.
- **Predictions:** each has one clearly right answer.
- **Ear targets:** they differ by 8-40 % of knob travel, and by 8-14 % at the "fine" level.
- **Sequence:** the lessons follow the signal flow, then sequencing, performance and studio.
- **Wording:** fixed where it did not use the panel's labels or got a fact wrong (finding 9).

## Upgrade notes (for `lib/studio/upgrades.ts`)

- No control ids, ranges or defaults changed. These behaviours changed, and they matter for saves made since the A4 rebuild:
  - `t1..t4_osc_bnd`: no effect → auto bend. Saves with BND ≠ 0 now bend, so reset BND to 0 for saves from before this version if the old sound must be kept.
  - `t1..t4_snd_prt` = 1 (ON): sequencer notes no longer glide; played notes still do. `snd_prt` = 2 (LEG) now needs `snd_leg` on.
  - `t1..t4_arp_leg` = 1: overlapping note trigs now play legato with the arpeggiator off.
  - `t1..t4_osc1_wav` = 6 (FDB): louder, and self-oscillating from LEV ~100.
  - Accent trigs: a deeper filter envelope.
  - A studio stop now fades the A4's send effects in 1.5 s (the A4's own [STOP] key and the end of its own song do not).
  - The Acid Workout kit's T1 VOL is 76 (was 84).
- Preset name: `init` is "Kit / Init sounds (blank pattern)", and its project has four trigs on T1.

## Open

- **To confirm on a unit:**
  - the FRQ-to-Hz law (borrowed from the Rytm);
  - the envelope times;
  - the BND and DET scales;
  - the accent depth;
  - the FDB loop gain.
- **Delay WID** as placement (finding 12) would move every kit's echo, so it was left.
- **App level, outside this review's scope:**
  - the iPad fit puts the last legend row below the fold;
  - a satin-black cap variant in `Knob.tsx` would replace the scoped restyle;
  - the lesson solution API has no arranger field, which leaves st2's two manual steps.

## Gate

| Check | Result |
|---|---|
| tsc, `next lint`, `npm run validate analog-four` | clean; 0 errors (17 warnings, none from this review: controls driven by custom elements, and the studio challenges without solutions) |
| build | passes |
| `scripts/smoke.cjs` | no errors; no horizontal scroll on desktop or iPad; peaks: keys 0.33, transport 0.33, buttons 0.16 |
| `scripts/lesson-runner.cjs analog-four` | 20 lessons, 0 failed, 2 manual steps (the arranger) |
| `scripts/e2e/run.cjs` | 34/34 |
| `scripts/audio-qa.cjs analog-four --target -18 --suggest` | exit 0: 0 of 47 flagged, median -18.9 LUFS, max true peak -2.4 dBTP |
| the same with `--excite analog-four=transport` | exit 0: 0 of 47 flagged, median -19.0 LUFS, max true peak -1.6 dBTP |
| in-app checks (Playwright) | worst case on all four tracks +0.20 dBFS at the tap; Dub Chords rings after the [STOP] key (-35 / -47 dBFS at 1 / 2 s) and fades after a studio stop (-51 / -103 dBFS) |
| screenshots (desktop 1440 x 900, iPad 1180 x 820) | read against M p.12 and IMG at equal scale; no legend touches another; the last legend row sits just below the iPad fold (see "Panel") |
