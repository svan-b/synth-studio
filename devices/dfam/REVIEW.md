# DFAM digital twin - independent review

Reviewer pass over `devices/dfam/**` and `public/worklets/dfam-processors.js`, against the
Moog DFAM Owner's Manual with Patch Sheets (primary source, cited as "M p.N"), the Sound On Sound
review, VoltPages and forum reports. Measurements come from an offline Node harness that runs the
worklet exactly as the engine drives it, plus Playwright runs of the real app.

Status: **work in progress** (the session was parked). Sections marked *open* were not finished.

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
| CPU | - | 68x realtime, 1 worklet node (bench before the allocation fix; *open*: re-run after) |

## Preset loudness

- Before: 21.3 LU spread (-33.9 to -12.6 LUFS, harness, mono). The QA tool's baseline for the merged
  build: median -21.6 LUFS, spread 20.1 LU, 12 loudness flags.
- First pass (harness target -25 LUFS mono): 3.2 LU spread. QA run on that build: every preset at
  about -22.3 LUFS (stereo measure), i.e. just under the -18 +-4 window, plus the two audition
  outliers fixed in #10 and #13 and the stuck tail in #14.
- Now: VOLUME re-computed in the harness for the QA target (-18.6 LUFS stereo, FX -22.6, sample
  peaks <= -2.2 dBFS). *Open*: confirm with
  `node scripts/audio-qa.cjs http://localhost:3131 dfam --target -18 --suggest`. Expected at risk:
  the spiky snare / clap / rim / closed and metallic hats land around -21.1 to -22.6 because of the
  peak cap; give them more body (longer VCA DECAY) or a lower PLR if they flag.

## Lessons

- f1: the fifth step needs ~392 Hz within 0.06 octave (it used to auto-advance anywhere from a
  minor third to a minor seventh); texts use Hz.
- f6: the restart prediction now says the next step plays first (no reset).
- Start states set SEQ PITCH MOD to VCO 1&2 where the PITCH knobs must move the VCOs
  (f6, sd3, sq1, sq2, p1, st1, st2).
- Studio lessons checked for real (Playwright, Studio Clock, studio ▶, Mother-32): every step
  satisfied, the DFAM waits silently when armed, the first hit lands on the first clock pulse
  (within 0.2 ms), 1/16 = 8 pulses/s, 1/8T = 6/s, 1/8 = 4/s.
- Lesson runner: 0 failures; the 5 manual steps are the cross-instrument actions (studio cables,
  the studio ▶, the Studio Clock's CLOCK DIV) that the runner cannot perform; they were verified by
  the Playwright run above. The runner would need `step.instance` support in `solution` to cover them.

## Open (not finished when the session was parked)

- Re-run the audio-QA tool, the lesson runner, smoke and e2e on the final build.
- REFERENCE.md: positions, defaults and the manual page cites for every row need the final pass
  (partly done: knobs, VCO FREQUENCY, ADV/CLOCK, TRIGGER OUT, model choices).
- VCA DECAY clock-position descriptions (M p.21) suggest longer mid-range times than the twin's
  log taper (noon 316 ms); VCO/VCF descriptions fit the current taper, so it was left.
- The Default patch image (M p.8) and the patch sheets of pp.34-37 were not available as images.
