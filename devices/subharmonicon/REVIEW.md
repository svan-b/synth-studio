# Moog Subharmonicon twin - independent review

Reviewer's check of the rebuild against Moog's *Owner's Manual*, *Patching with Intention* and the
*Exploration Patchbook* (scratchpad copies, never committed), the Tallent Edition firmware source
(TE, an extension of stock firmware 1.1.1) and measurements of the running code. Page numbers are
the folios printed on the pages, as in REFERENCE.md.

**How it was measured.**
- **Offline harness.** `public/worklets/subharmonicon-processors.js` runs in Node, driven through the
  app's own `model.ts` control mapping. This gives sample-exact captures of the main output and
  all 15 jack outputs.
- **Real app.** Playwright drives a production build: audio QA, the lesson runner, smoke, e2e,
  the bench, screenshots at 1180×820 (touch) and 1440×900, and the panel's text-fit debug
  (`window.__panelFitDebug`).

## Findings

| # | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| 1 | High (open) | **Studio sync drops the patch sheets' TEMPO.** In the default studio set-up PLAY starts the studio transport. The master pulse is then the studio's 16th note (8 Hz at 120 BPM), and TEMPO is ignored, as MIDI clock overrides it on the hardware (p.25). But TEMPO is part of every Moog sheet, from 378 to 2940 BPM (6.3 to 49 Hz). Synced, 15 of the 20 sheet presets run 1.5 to 6 times slower than drawn: Transistor Insects 6.1×, Star-Gate 4.6×, Three Hands 4.0×, Music for Washing Dishes and Ant Parade 3.9×, Spiral Ways and Cloud Path 3.1×. Only Aquatic Chords, Mellow Harmonies, Bateria and Poly Rock are within about 25 %, and Duet for Tone and Wind (an audio-rate CLOCK cable) is unaffected | sheet TEMPO readings in presets.ts; the 16th-note clock measured in REFERENCE.md | The help tip now says that TEMPO is ignored while synced, and how to hear a sheet at its own pace (untick *Sync to studio clock*). The real fix is outside `devices/subharmonicon`, so it is left to the integrator. Options: give the Subharmonicon its own clock by default, as the DFAM has (`studio.midiSync: false`; lesson st1 would then teach the sync as a choice), or let a preset ask for its own clock |
| 2 | Medium | **A held key on an EG-off patch is a gate at full VOLUME, and nothing said so.** Stopped, a held key holds both envelopes at their peak, like TRIGGER (p.29). Faithful, but the jump is 17-18 dB on the two full-VOLUME sheets (Bubbling sub chords -22.0 → -4.7 dBFS RMS, Hand-faded harmony arp -21.2 → -3.2) and about 5 dB on Self-tripping cross-sequence (-20.2 → -14.9) | harness, the preset playing vs one key held while stopped. The builder's keys-excitation QA run also flagged it (-2.5 and -3.5 LUFS) | Now explained in: lesson f4's TRIGGER-gate step and a new f4 review question; the EG, TRIGGER and VCA DECAY help; the keyboard tip; and the three EG-off sheet presets |
| 3 | Medium | **The EG OFF / ON / HELD twin-aid row was too small for an iPad.** Legends were 6.0 px and targets 11 px tall: a 0.85-scale switch strip that the fit could not raise | screenshots and computed styles at 1180×820 | Now three radio keys (7.6 × 3.4 mm) between PLAY / TRIGGER and the nameplate. Legends 9 px, the EG label 10 px. Their touch areas end about where PLAY and TRIGGER begin |
| 4 | Medium | **Some legends were below the 9 / 10 px floors.** SEQ OCT 7.4 px, QUANTIZE 7.0, EG 8.5, OUT (of IN / OUT) 7.5; STEP 2 / 3 rendered at 8 px and RHYTHM 2 / 3 at 8.4 px next to STEP / RHYTHM 1 and 4 at 10 px. The section headings above them limited the legends' vertical room | panel fit debug: the headings were the limiters | Cap legends are now measured and condensed (`capLegend`): EG 9.3 px, SEQ OCT 8.1, QUANTIZE 7.5. SEQ OCT and QUANTIZE cannot reach 9 px inside the hardware-size caps without going below the 80 % condense limit. The headings now sit 0.8 mm higher, so STEP and RHYTHM 1-4 all reach 10 px. IN / OUT were spaced apart: IN 10 px, OUT 9.2 px |
| 5 | Low | **DC under hard drive.** The output stage made up to 0.013 of DC (QA limit 0.005). It sits after the 8 Hz blocker, and its shoulder clips asymmetric waves: one saw or six sources at full, or a held gate at full VOLUME | harness: DC 0.0096-0.013 with the stage saturated, below 1e-4 otherwise | A 1 Hz DC servo around the shoulder. Worst case now 0.003, the -1.51 dBFS ceiling still holds, and typical patches are unchanged. A post-stage high-pass was tried first and pushed peaks to -0.87 dBFS |
| 6 | Low | **Lesson f3 clock position.** It said "+60 % (2 o'clock)"; +60 % of a bipolar knob is 3 o'clock | knob geometry (300°) | Text fixed |
| 7 | Low | **Lesson f5 listen step.** The explanation said steps 2 and 3 fall between the keys, but step 3 at 50 % of ±1 octave is exactly F♯ | 50 % × 12 = 6.0 semitones | Step 3 is now 46 % (5.5 semitones). It still folds to F in 8-ET |
| 8 | Low | **RESONANCE help and REFERENCE.** The help said the filter self-oscillates past about 2 o'clock, and REFERENCE equated 78 % with 2:20 o'clock. Measured: a +14 dB ringing peak at 70 % (2 o'clock), self-oscillation from 79-80 % (about 2:50) | harness | Help: rings from 2 o'clock, sings from 3 o'clock. REFERENCE corrected. The DSP is unchanged; SOS's "starts to sing near 2 o'clock" fits the ringing |
| 9 | Low | **REFERENCE page error.** It cited the specifications as p.57; they are printed p.58, because the signal flow is a pp.56-57 spread | manual folios | Fixed in three places |
| 10 | Info | **The three silent sheets (Spiral Ways, Star-Gate, Cloud Path).** Recreating them with EG lit is the right call. They draw EG and PLAY unlit with nothing in TRIGGER, which is silent on the unit. Their own notes need firing envelopes: "VCF ATTACK for crescendo depth", "VCA DECAY for … rhythmic clusters", and VCF EG → RHYTHM 3 for the double-time feel. HELD would freeze that modulation, so EG lit is the only reading under which the notes make sense | pp.48-49 at 300 dpi | Agreed; no change |
| 11 | Info | **Sheet readings spot-checked at 300-600 dpi:** Bateria (every knob and the four cables), Spiral Ways, the EG / PLAY states of all ten manual sheets, and Octave Fuzz. All within reading error. One borderline: Octave Fuzz VCO 1 SUB 1 reads 0.83 of the travel, on the ÷3 / ÷4 boundary; kept at ÷4 | renders of pp.45-49 and XPB p.9 | None |
| 12 | Info (open) | **Keys with EG lit.** The twin plays a pluck. TE hooks the stock note-on / note-off call sites (`trigger_both_envelopes` / `release_both_envelopes`), so the stock unit may hold the envelopes for as long as a note is held, with EG lit too | TE `features_bridge.asm`, `patches.asm` | Left. Listed in REFERENCE "Model choices" as a check for a unit, because changing it would make every patch's held key a loud gate |
| 13 | Info (open) | **Which sequencer fires the envelopes.** TE's re-implementation of the stock rhythm engine fires them only on Sequencer 1's steps (`vca = vcf = seq1`). Moog's diagram (p.56), Patching with Intention (pp.13, 15) and owner reports say either sequencer's step fires them | TE `features_rhythm.c`; web search of Moog-forum and ModularGrid owner posts | The twin keeps Moog's documented behaviour |
| 14 | Low (open) | **Two validate warnings.** `npm run validate` reports PLAY and TRIGGER as "overlapping" the EG keys. The check treats buttons as circles of their width (14 mm for PLAY); the rectangles are 1 mm apart | `scripts/validate-devices.ts` `radius()` | None needed |

## Measured against the hardware specification

| What | Twin | Spec |
|---|---|---|
| VCO FREQ range | 261.6 Hz to 4186 Hz; 12-ET end points 261.64 / 4187.8 Hz | Middle C (262 Hz) to 4186 Hz (p.18) |
| Subharmonic dividers | ÷1-÷16 on both VCOs at 262 Hz, 392 Hz, 1046 Hz, 3 kHz and 4186 Hz: worst ratio error 4.5e-5 (the zero-crossing measurement's resolution); phase-locked, so no drift between a VCO and its subs | whole numbers 1-16 (pp.18-20) |
| QUANTIZE | 12-ET: 49 pitches C4-C8 at 0.0 cents. 8-ET: 29 white keys. 12-JI: 1/1 16/15 9/8 6/5 5/4 4/3 7/5 3/2 8/5 5/3 16/9 15/8. 8-JI: 1/1 9/8 5/4 4/3 3/2 5/3 15/8. Knob, step and note are snapped as one sum (E4 + 3 semitones → G4 = 392.438 Hz, exactly 3/2). C♯ folds down to C in 8-ET | scales on p.21; just C major on p.17; 12-JI table from TE (likely) |
| SEQ OCT | ±1.0000 / ±2.0000 / ±5.0000 octaves at the end stops. The sequencers stop at 9999 Hz (C8 plus 5 octaves) | p.28; ~10 kHz ceiling (p.28) |
| SEQ jacks and hold modes | 12-ET at ±1: +21 % → 0.2500 V. With QUANTIZE held: 0.2100 V. With SEQ OCT held: 1.0833 V | pp.21, 28, 36 |
| Rhythm logic, from pulse 0 | OR ÷2+÷3 x.xxx.; XOR ÷2+÷3 ..xxx.; XOR ÷2+÷4 ..x.; XOR ÷1+÷2+÷4 .x.x (exactly one, not parity). TRIGGER OUT is the OR of both sequencers' moves | p.44; diagram p.56 |
| TEMPO | 20 / 120 / 480 / 1510 / 3000 BPM: 3000.00 / 500.00 / 125.00 / 39.74 / 20.00 ms | .333-50 Hz (p.25) |
| RESET, NEXT | RESET while playing: every generator fires on the next pulse. NEXT forces counts until Sequencer 1 steps (Sequencer 2 keeps its place), with no envelope and no TRIGGER OUT | p.29 |
| Envelopes | Peak 8.00 V. Attack reaches the peak at the knob time: 1 ms → 1.4 ms (with the 1 ms output smoothing), 100 → 100.6 ms, 1 s → 1000.1 ms, 10 s → 9999.8 ms. Decay reaches -60 dB at the knob time (450 → 451 ms). A trigger in the attack is ignored (peak at 199 of 200 ms). HELD runs the attack and decay | 0-8 V (p.33); 1 ms-10 s and 5 ms-10 s; no restart in the attack (pp.24-25); p.30 |
| Ladder | -11.3 to -11.7 dB at the CUTOFF frequency (100 Hz, 1 kHz, 5 kHz); 21.2 dB from 2 fc to 4 fc (4-pole theory: -12 dB and 21.3 dB). Resonance: +14 dB peak at 70 %, self-oscillation from 79-80 %, pitch within 4 cents of CUTOFF from 30 Hz to 14 kHz. Bass loss -5.6 dB at 25 %, -10.6 dB at 85 % | 4-pole, 24 dB/oct, 20 Hz-20 kHz, self-oscillating (p.23) |
| Output | One saw at full, VOLUME full: -3.8 dBFS RMS. Six sources at full: -2.4 dBFS RMS. Sample peaks never above -1.51 dBFS. DC ≤ 0.003 driven hard (was 0.013), < 1e-4 otherwise | - |
| Jacks | VCO and SUB outputs ±5 V; EG outputs 0-8 V; SEQ ±5 V; CLOCK OUT 10 V, only while playing; TRIGGER OUT 5 V, 1 ms. VCA OUT peaks at ±4.2 V (8.4 V p-p, the output ceiling) | pp.32-37; VCA OUT 10 V p-p |
| Sub and rhythm CV | 1.6 steps per volt. From ÷8: -5 V → ÷16, -1 V → ÷10, +1 V → ÷6, +5 V → ÷1. SEQ ASSIGN SUB uses the raw ±5 V step: from ÷16, a step of +100 % reaches ÷8 | centre the knob for bipolar CV (pp.31, 35); the SUB assign taps the step before SEQ RANGE / QUANTIZE (diagram p.56) |
| Patch bay | VCO 1 → VCO 2 normal broken by a cable; PWM cable replaces the SUB 1 sweep; VCA and CUTOFF inputs add to their envelopes; PLAY IN gate (rising edge plays, falling stops); CLOCK IN from a 16 Hz sub takes over from TEMPO (16.5 pulses per second) | pp.31-37 |
| Ear-training audibility | JI vs ET lattice (et4 / sd2), bass below 100 Hz over 6 s: ET swings 5.5-5.7 dB at the 0.6 Hz beat, JI 0.8-1.3 dB (analog drift between the two VCOs) | - |
| CPU | 23.6-30.0× real time in `/bench`, depending on machine load (the bench's own reference moved from 21.3 to 23.7 across the same runs). The DC servo's cost is below the noise: rendered offline and interleaved, both versions run at 18-25× | - |

## Audio QA (`--target -18 --suggest`)

| Run | Before | After |
|---|---|---|
| audition | median -18.7 LUFS, spread 5.7 LU, 0 of 36 flagged, exit 0 | median -18.6 LUFS, spread 5.7 LU, 0 of 36 flagged, exit 0 |
| `--excite subharmonicon=transport` | median -18.9 LUFS, spread 7.5 LU, 0 of 36 flagged, exit 0 | median -18.8 LUFS, spread 8.2 LU, 0 of 36 flagged, exit 0. The spread moved through run-to-run variance in the sub-gated and cross-modulated presets (Sub-gated dial tones -19.8 / -21.9 LUFS between runs) |

## Gate

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `next lint` | clean |
| `npm run validate subharmonicon` | 0 errors; 2 warnings (finding #14) |
| `npm run build` | passes |
| `scripts/smoke.cjs` | no errors on desktop or iPad; 33 buttons tried |
| `scripts/lesson-runner.cjs` | 20 lessons, 0 failed, 0 manual, 0 auto |
| `scripts/e2e/run.cjs` | 34/34 passed |
| audio QA, both excitations | exit 0 |
| In-app checks (Playwright, production build) | Three Hands on the Wheel: SEQ 2 steps every 767 ms synced and every 186 ms on its own clock (the sheet: 187 ms). Bubbling sub chords: -21.3 dB RMS playing, -4.5 dB with a key held while stopped. The EG keys set `eg_mode` 0 / 1 / 2 when tapped. No console errors |

## Upgrade notes

- No control ids, meanings, ranges or defaults changed.
- No lesson ids changed. Lesson f4 has a fifth review question; the f5 listen step's STEP 3
  setup is 46 instead of 50.
- The `eg_mode` control is now drawn as three radio buttons instead of a switch strip (same values:
  0 OFF, 1 ON, 2 HELD).

## Left as they are

- **#1, studio sync and TEMPO.** Shared studio behaviour, so the integrator's call.
- **#12 and #13.** Need a unit (or the stock binary) to settle. The twin follows Moog's own
  documents where they speak.
- **Jack legends.** "VCO 1 SUB 1" and similar render at 7.2-7.5 px, condensed to 80 %. The 13.5 mm
  columns cannot hold them at 9 px; the DFAM review accepted the same.
- **The 12-JI table.** Still "likely". It is TE's test fixture for the stock table; the manual
  prints only the 8-JI ratios.
