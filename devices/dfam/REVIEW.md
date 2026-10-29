# DFAM digital twin - independent review

Reviewer pass over `devices/dfam/**` and `public/worklets/dfam-processors.js`, against the
Moog DFAM Owner's Manual with Patch Sheets (primary source, cited as "M p.N"), the Sound On Sound
review, VoltPages and forum reports. Measurements come from an offline Node harness that runs the
worklet exactly as the engine drives it, plus Playwright runs of the real app.

Status: **complete** (finished on `finish/dfam-review`, merged with the integrated framework at
5878311). The merge gate passes; see "Gate" at the end. The items under "Open" need a hardware unit.

## Findings and changes

| # | Severity | Finding | Evidence / source | Change |
|---|---|---|---|---|
| 1 | High | Instrument output exceeded 0 dBFS: a single square VCO at full VOLUME +2.5 dBFS, HP + full RESONANCE +4.7 dBFS, a sub-audio square through the post-VCA DC blocker +6.8 dBFS | harness: peaks 1.33 / 1.72 / 2.19 | DC blocker (now 5 Hz) moved ahead of an output rail: unity to 0.7, soft knee, ceiling 0.98. Everything-up patches now peak at -0.2 dBFS; typical patches are untouched |
| 2 | High | Panel geometry did not match the hardware: controls squeezed into x < 230 mm, sequencer steps 15 mm apart instead of 23.9 mm, patch bay on an 18 x 11 mm grid instead of 13.6 x 13.5 mm, SEQ PITCH MOD and HARD SYNC between the rows instead of in them, faceplate 116.5 mm instead of 128.5 mm | measured from the M p.7 panel drawing (4.16 px/mm at 200 dpi; the 60 HP width and the 122.5 mm screw pitch both fit) | `layout.ts` rebuilt from those measurements: 304.8 x 128.5 mm, one-line legends, printed scale rings on VCO FREQUENCY and TEMPO, CUTOFF frequency marks, (-)/(+) marks, eight screws, branding in the bottom rail |
| 3 | High | Preset loudness spread 21.3 LU (-33.9 to -12.6 LUFS); the presets had been balanced by peak level | harness BS.1770 integrated, 6 s per preset | VOLUME (and a few levels/decays on the spikiest hits) re-balanced. Then re-targeted to the audio-QA target, see below |
| 4 | Medium | Self-patched sequencer outputs reached VELOCITY IN one step late: PITCH -> VELOCITY played every step at the previous step's level | harness: step n's EG peak equalled step n-1's PITCH | On a clock edge the new PITCH / VELOCITY voltages pass through self-patches at once; the clock is handled before the TRIGGER jack; same-instant events run RUN, then ADV, then TRIG |
| 5 | Medium | HP-mode resonance self-oscillated from 85 % at any CUTOFF; the manual says HP scales differently and at maximum oscillates from about 1 kHz up | M p.18 | HP feedback rolls off below ~500 Hz and the LP bass make-up is no longer applied in HP. Measured: at full RESONANCE HP oscillates from ~1.0 kHz, not at 950 Hz |
| 6 | Medium | TRIGGER OUT: twin sends the trigger that fires the EGs (so a cable in TRIGGER IN drives it) | M p.24: the TRIGGER input is normalled to the clock "and then routed to the Envelopes and the TRIGGER output" | none needed - now **verified** |
| 7 | Medium | The 19 small controls were drawn as silver caps; on the hardware the 3 mixer and 16 sequencer controls are slim black stalks | SOS ("16 knobless stalks"), M p.7/p.17/p.22 drawings, knob-kit listings | drawn as black stalks with a white line (8.5 mm for touch) |
| 8 | Medium | Output jack labels were black-on-black; the manual says outputs use reverse lettering | M p.24 | white boxes with black text; jack labels are now panel labels (7.2 px) |
| 9 | Medium | Default SEQ PITCH MOD was VCO 1&2; the manual's walkthrough moves it to VCO 1&2 only after starting | M p.9 | default OFF; presets and lessons that need the PITCH knobs on the VCOs set VCO 1&2 explicitly |
| 10 | Medium | Auditions (lesson "listen", the audio-QA excitation) ignored a running ADV / CLOCK source, so self-clocked presets (VCO -> ADV/CLOCK) played at TEMPO instead | QA: "Sequencer as an oscillator" -41.6 LUFS | an audition follows ADV / CLOCK while edges are arriving (within 0.5 s); otherwise the internal clock plays it, as before |
| 11 | Medium | The manual has ten patch sheets (pp.33-37), not six; Music Box, Kick / Snare / FM Osc 2, Insane Toms and Swing Time were missing | M pp.33-37 | added or re-based (FM chime melody, Kick snare and FM, Rolling toms, Shuffle). Music Box and Quick Hats settings read from the legible p.33 sheets; the others recreated from the sheet notes. Manual-based presets now have descriptive names and cite the page |
| 12 | Medium | Unverifiable "Inspired by" attributions (Deep Bounce, Lo-Fi, Kix & Popz, Bring Tha Noise); the Electronicus patches are DFAM + Mother-32 patches that these presets do not follow | Electronicus patch book pp.4-10 | attributions removed |
| 13 | Medium | Sequenced bass in exact unison varied 8.3 LU with the oscillators' random start phase | harness, 8 seeds | VCO 2 tuned 7 cents up (slow beating, spread 1.4 LU), as tuning by ear gives |
| 14 | Medium | Rolling toms via VCO 2 -> TRIGGER kept sounding after STOP (QA stuck tail) | QA tail -14 dBFS | VCO 2 now clocks ADV / CLOCK, PITCH -> VCA DECAY |
| 15 | Low | process() allocated an array and 15 strings every quantum; UI posts up to 40/s | coordinator audit | precomputed param names, typed index arrays; UI posts at most 20/s |
| 16 | Low | VCO FREQUENCY read in octaves; lessons talk about Hz | - | readout in Hz (noon 131 Hz); the f1 "fifth" step now needs 392 Hz +-0.06 oct instead of passing anywhere within a minor third to a minor seventh |
| 17 | Low | Unit dimensions height/depth swapped | M p.40: 12.57" x 4.21" x 5.24" | fixed |
| 18 | Low | Buttons drawn green/red with glow; hardware buttons are plain black, RUN has a separate LED | M p.22/p.23 drawings | black caps, grey press feedback, RUN LED only |
| 19 | High | Presets could fail the merge gate at random. Over repeated renders (the noise and the oscillators' start phase differ each time) Bright noise snare, Closed hat and Shuffle reached -0.5 to -0.6 dBTP, Snappy snare -0.9 and Noise hits -1.0 (the ceiling is -1). Snappy snare, Rimshot, Clap, Metallic hat and Techno percussion measured 4.1-4.5 LU under the -18 LUFS target, with no headroom left for gain; Accent bassline sat on the -22 edge | QA before: 5 of 40 flagged; harness: 10-24 renders per preset, measured with the QA tool's own meters (it agrees with the QA run within 0.2 LU) | more body instead of level: VCA DECAY longer, VOLUME lower where the peak was close (table under "Preset loudness"). Every preset now stays at or below -2 dBTP in all renders |
| 20 | Medium | RUN / STOP and ADVANCE legends rendered truncated ("RUN / ST...", "ADVAN...") under the new legibility floor: the TEMPO readout sat where the panel prints them, just under the TEMPO ring. Once they could grow, RUN / STOP covered the RUN LED | panel fit debug (`window.__panelFitDebug`); screenshots against M p.7 | TEMPO's readout shows on hover / touch only (the hardware has none); the legends render at 10 px; RUN / STOP is centred on its button as drawn and the LED sits 2.5 mm further left |
| 21 | Medium | dfam-st1 pressed RUN / STOP before parking on step 8 with ADVANCE; the manual describes ADVANCE with playback stopped, and Moog's sync order arms the follower last | M p.23, pp.30-31 | ADVANCE now comes before RUN / STOP |
| 22 | Low | The lesson runner could not do the five cross-instrument studio steps (cables between instruments, the studio ▶, CLOCK DIV) | lesson runner: 5 manual steps | lesson API v3 solutions (`studioCables`, `transport`, `values`): 0 manual steps |
| 23 | Low | Six preset descriptions had lost the letter Q ("FRE'UENCY", "'uick Hats", "SE' PITCH MOD") | the preset menu text | fixed |
| 24 | Medium | Noise on the cutoff (NOISE / VCF MOD) makes the resonant ladder crackle, and a crackle at a hit's onset is occasionally isolated enough for the audio-QA click detector to flag it (one "mid" click, -20 to -40 dBFS). Rates: about 3 % of renders for Lo-fi crunch (38 %), 1.7 % for Techno percussion (10 %), 0 of 120 for Techno rumble (12 %) | offline renders with the QA detector: no clicks in 120 renders without the noise modulation; a dump shows the cutoff jumping between 0.5 and 6.5 kHz from sample to sample; band-limiting the noise to 1-8 kHz (same RMS) made it worse (larger, coherent swoops); resonance, cutoff, decay and depth changes moved it between 0 and 7 % with no clearly safe setting | none: this is the distorted, lo-fi sound the manual describes for NOISE / VCF MOD (M p.12, p.20). See "Open" |

## Measurements against the hardware

| Quantity | Hardware | Twin (measured) |
|---|---|---|
| VCO range | ten octaves (M p.13) | 4.09 Hz - 4186 Hz, tracking within 0.6 cent; noon C3 is a guess, consistent with M p.8 (deep bass between 10 and 11 o'clock) |
| PITCH 1-8 | about +-5 V, 10 octaves (M p.22) | 1 V/oct within 0.1 cent |
| TEMPO | 0.7 - 700 Hz (M p.23) | 10.5 - 10500 BPM at 16ths = 0.7 - 700 Hz |
| VCF DECAY | 10 ms - 10 s (M p.19) | knob value = time to -60 dB, exact to 0.1 % for all three EGs |
| VCA EG attack | FAST 1 ms, SLOW 100 ms (M p.20) | 1.00 ms / 100.0 ms |
| Velocity | sets EG amplitude, higher = slightly longer decay (M p.22) | peak = 8 V x velocity; decay x0.77 at 50 % |
| LP self-oscillation | above 3 o'clock (M p.18) | silent at 80 %, steady sine from 81 %, tracks CUTOFF within 1 cent 60 Hz - 8 kHz |
| HP self-oscillation | at maximum, from ~1 kHz (M p.18) | from ~1.0 kHz at 100 %, from ~1.4 kHz at 90 % |
| Retrigger | - | no envelope ever drops at a retrigger (largest 0.002 V); the only transient is the 1 ms attack |
| DC | - | |mean| < 1e-3 on all presets |
| CPU | - | 51x realtime, 1 worklet node (`scripts/bench.cjs`, after the allocation fix, on a machine shared by about ten agents; the earlier 68x came from a quieter machine, so the two are not comparable) |

## Preset loudness

- Before: 21.3 LU spread (-33.9 to -12.6 LUFS, harness, mono). The QA tool's baseline for the merged
  build: median -21.6 LUFS, spread 20.1 LU, 12 loudness flags.
- First pass (harness target -25 LUFS mono): 3.2 LU spread. QA run on that build: every preset at
  about -22.3 LUFS (stereo measure), i.e. just under the -18 +-4 window, plus the two audition
  outliers fixed in #10 and #13 and the stuck tail in #14.
- Second pass: VOLUME re-computed in the harness for the QA target (-18.6 LUFS stereo, FX -22.6).
- Audio QA on that build (`--target -18`): `[dfam] median -19.2 LUFS, spread 5.2 LU, 5 of 40 flagged
  (loudness 5)`, exit 1, max true peak -1.3 dBTP. Flagged low: Snappy snare -22.5, Rimshot -22.3,
  Clap -22.2, Metallic hat -22.1, Techno percussion -22.1; their suggested gains would have taken
  them to +0.4 to +2.5 dBTP. Repeated renders also found the true-peak risks of finding #19.
- Final pass: loudness from body, not level. Each change was chosen offline (12-24 renders) and
  checked in the app:

  | Preset | VCA DECAY | VOLUME | Other |
  |---|---|---|---|
  | Snare / Snappy snare | 260 -> 640 ms | 97 -> 86 | VCO 1 LEVEL 70 -> 80 |
  | Snare / Bright noise snare | 220 -> 380 ms | 75 -> 68 | |
  | Snare / Hand clap | 230 -> 520 ms | 81 -> 78 | CUTOFF 1.8 -> 2.2 kHz |
  | Snare / Rimshot | 80 -> 170 ms | | |
  | Hats / Closed hat | 45 -> 90 ms | 83 -> 76 | |
  | Hats / Metallic hat | 110 -> 220 ms | 98 -> 94 | |
  | Toms / Bongos | 120 -> 150 ms | | |
  | Bass / Accent bassline | 260 -> 420 ms | | |
  | Loop / Techno percussion | 110 -> 200 ms | | |
  | Loop / Noise hits | 180 -> 360 ms | 85 -> 76 | |
  | Loop / Shuffle | 70 -> 130 ms | 92 -> 84 | |

- Final audio QA (audition, the gate command): `[dfam] median -19.1 LUFS, spread 5.2 LU, 0 of 40
  flagged (none)`, exit 0; max true peak -2.3 dBTP, IQR 1.4 LU (was 2.9). Non-FX presets -17.8 to
  -20.6 LUFS, FX -22.7 to -23.0. With `--excite dfam=transport`: `[dfam] median -19.1 LUFS, spread
  5.2 LU, 0 of 40 flagged (none)`, exit 0.
- The clap reads about 0.4 LU lower in the app than offline (-20.3 to -21.6 over seven app runs at
  1.8 kHz, against -20.2 to -20.7 offline); every other preset agrees within about 0.3 LU. It is the
  only preset with a VCA EG -> NOISE LEVEL self-patch. The cause was not found; the brighter cutoff
  gives it about 1 LU of extra margin (-20.1 in the final run).

## Lessons

- f1: the fifth step needs ~392 Hz within 0.06 octave (it used to auto-advance anywhere from a
  minor third to a minor seventh); texts use Hz.
- f6: the restart prediction now says the next step plays first (no reset).
- Start states set SEQ PITCH MOD to VCO 1&2 where the PITCH knobs must move the VCOs
  (f6, sd3, sq1, sq2, p1, st1, st2).
- st1: parks on step 8 with ADVANCE before RUN / STOP (finding #21).
- The five studio steps carry lesson API v3 solutions; the lesson runner now plays all 20 lessons
  with 0 failures and 0 manual steps.
- Studio lessons checked for real on the final build. Playwright started each lesson from the
  Lessons dialog, tapped the jacks in the Studio tab, pressed ▶ and the DFAM's own buttons, and
  recorded the DFAM TRIGGER output, the Studio Clock CLOCK output and the instrument audio:
  - **Studio lesson 2** (Studio Clock -> ADV / CLOCK, ▶): every step satisfied and the lesson
    finishes. Silent before ▶. At 1/16 the DFAM plays 8 steps/s, each hit on a clock pulse (0 ms
    apart), starting on step 1. At 1/8, 4 steps/s. Silent after stop.
  - **dfam-st1**: ADVANCE parks it on step 8 (4 presses from where it was). Armed by RUN / STOP, it
    waits silently (0 triggers, no audio). After ▶ it starts on step 1 at 8 steps/s on the clock
    pulses, and plays 6 steps/s at 1/8T.
  - **dfam-st2**: the Mother-32 is silent until DFAM TRIGGER reaches its GATE, then plays on every
    DFAM step (7.3 steps/s at 110 BPM), including the steps the DFAM itself leaves silent.

## Open

- VCA DECAY clock-position descriptions (M p.21) suggest longer mid-range times than the twin's
  log taper (noon 316 ms); VCO/VCF descriptions fit the current taper, so it was left.
- The Default patch image (M p.8) and the patch sheets of pp.34-37 are not legible enough to read
  knob positions from; those presets follow the sheet notes.
- The clap's 0.4 LU app/offline difference (see "Preset loudness").
- Finding #24 can make the audio-QA gate flake about once in 20 full DFAM runs (it did once in
  six full runs after the preset changes). If the gate must never flake, either the integrator sets
  `thresholds.clicksMin: 2` for `dfam` in the audio-QA config, or Lo-fi crunch and Techno
  percussion drop NOISE / VCF MOD (and lose their crackle).
- The model choices in REFERENCE.md need a hardware unit to confirm.

## Gate (final build: finish/dfam-review, integration branch ee54efe merged)

| Check | Result |
|---|---|
| tsc, `next lint`, `npm run validate dfam` | clean; 0 errors, 0 warnings |
| build | passes |
| `scripts/smoke.cjs` | no console errors; transport peak 0.31, button peak 0.30; no horizontal scroll on desktop or iPad |
| `scripts/e2e/run.cjs` | 23/23 |
| `scripts/lesson-runner.cjs dfam` | 20 lessons, 0 failed, 0 manual steps |
| `scripts/audio-qa.cjs dfam --target -18 --suggest` | last run: exit 0, `[dfam] median -19.2 LUFS, spread 5.2 LU, 0 of 40 flagged (none)`, max true peak -2.1 dBTP; with `--excite dfam=transport`: exit 0, `[dfam] median -19.0 LUFS, spread 4.9 LU, 0 of 40 flagged (none)`. Of the six full runs after the preset changes (four on the final preset set), five had 0 flags; one audition run flagged a single -32.7 dBFS crackle in Lo-fi crunch (finding #24) |
| screenshots (desktop 1440 x 900, iPad 1180 x 820) | read against M p.7: layout, legends and patch bay match; no truncated text |
