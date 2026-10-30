# Mother-32 digital twin - independent review

Reviewer pass over `devices/mother32/**` and `public/worklets/mother32-processors.js`, against the
*Mother-32 User Manual Version 2* (cited by printed page, as in REFERENCE.md: "M p.N"), the
House of Electronicus patch book (Electronicus) and the DFAM manual's sync page. Measurements
come from an offline harness that loads the worklet in a VM and drives it through the twin's own
`model.ts` / `sequence.ts` (exactly what the engine sends), the audio-QA tool's own meters for
loudness, and Playwright runs of the real app and studio.

Status: **complete** on `review/mother32` (pushed to `wip/review-mother32`). The gate passes; see
"Gate" at the end. The items under "Open" need a hardware unit or a shared-component change.

## Findings and changes

| # | Severity | Finding | Evidence / source | Change |
|---|---|---|---|---|
| 1 | High | HI PASS with RESONANCE **rang and lost bass** - the opposite of the manual (non-resonant; any RESONANCE "will reintroduce bottom end", M p.14), of the control's own text, of REFERENCE.md and of lesson f3's answer ("bring the bass back instead of ringing"). The code faded the subtraction, but the feedback still cut the low band | harness, CUTOFF 600 Hz: RESONANCE 80 % gave +12.3 dB at 600 Hz and 65 Hz -14.6 dB (from -7.5 dB at 0 %); 100 %: +18 dB | HI PASS = the filter's input minus the fed-back ladder low-pass, feedback at most 2.5. Now 65 Hz rises to -3.5 dB at 80 % and -2.9 dB at 100 %, with a gentle +3.5 / +4.4 dB bump. The VCF -> EXT. AUDIO "MIX as resonance" trick (RESONANCE 0) is unchanged: self-oscillation from MIX about 75-80 % |
| 2 | High | DECAY law made Moog's own patches fail at their drawn angles: Filter Kick and Noise Transient (11 o'clock) 40 ms, Short Brass and Sequencer Bass (noon) 93 ms, and the Electronicus "Sine Up For Noise" melody (11 o'clock) 40 ms notes. The builder had lengthened three presets 2.4-5x by ear, so the knob positions no longer matched the sheets | sheet angles read on 300° (crops of M pp.64-66, p.9); harness: the Filter Kick rang about one cycle at 35 Hz | DECAY 10 ms - 7 s (was 1.25 ms - 7 s), same meaning (time to -40 dB) and the same 7 s top; default 60 -> 180 ms (the default panel's 11:25). Every sheet now works as drawn: kick 136 ms, pluck 144, brass and bass about 270, snare and toms about 530, 2 o'clock sheets about 1 s. Values keep their sound, so non-sheet presets and all lessons are unaffected |
| 3 | High | Audio QA failed (the builder's "finished" did not hold): exit 1, 3 of 43 flagged - a click in Kick and snare, Noise snare -22.2 LUFS, Step scanner -13.5 LUFS | `audio-qa.cjs --target -18` on the delivered build | Kick and snare ATTACK 3 ms (the KB jump moves MIX and CUTOFF at the note's start, and the 1.25 ms RC attack's first-sample corner ticked on that quasi-DC: 2 clicks in 16 offline renders, 0 at 3 ms; the same in lesson sd2); volumes rebalanced (table below). Now exit 0 in both modes |
| 4 | Medium | Output too hot: VOLUME 100 with hot patches peaked at +4.7 to +6.8 dBFS (the studio's master limiter caught it); in the Filter Kick routing the VCF jack reached 14.4 V, against the manual's "approximately +/-5V" (M p.48) | harness level sweep | The DFAM's output rail on the main output (unity to 0.7, soft knee to 0.98), a slow DC blocker after it (clipping a lopsided wave left 0.015 DC), and a soft limit near the rails on the VCF jack (4.75 -> 5.75 V). Everything-up now peaks at -0.0 dBFS, DC under 0.001; presets never reach the rail |
| 5 | Medium | Octave Bounce Back jumped 9.2 semitones, not an octave: in this twin +5 V of LIN FM doubles the frequency, and the drawn VC MIX (2 o'clock) gives 3.5 V | harness: 222.4 Hz held vs 130.8 Hz released | VC MIX fully up (exactly 12.00 semitones); the sheet itself says to set the interval with VC MIX |
| 6 | Medium | Metal Snare's demo pattern ran at the drawn TEMPO, fully down (20 BPM): one hit every 3 s | sheet M p.64 | TEMPO 100 BPM; the drawn CUTOFF and octave 6 restored (the builder's two-octave shift was the same sound) and the drawn VCO MOD DEST |
| 7 | Medium | 8-Bit Percussion played with VCF MOD 78 % (drawn 95 %) as "Drone / Bit-crunch bed": the hits it is named after were pulled back | M p.65; harness: at 95 % the hits sit 18 dB above the VCA-ON bed | VCF MOD 95 % as drawn, "Drone / 8-bit percussion" (it stays a drone: VCA ON keeps the quiet bed sounding after stop) |
| 8 | Medium | iPad legibility (1180 x 820, fitted zoom 0.86): CUTOFF 6.4 px (its 200Hz / 2KHz legends sat under it), 200Hz 6.1 px, the teaching readout 6.9 px, SETUP 6.9 px, the ringed knobs' values 8 px (a bordered ring boxed them in), NOISE / EXT 7.7 px, LO / HI MIX 8.4-8.7 px; the SETUP page's 95 buttons were 17 px tall with 7.8 px text, and lesson st2 sends learners there | DOM probe of rendered sizes; `window.__panelFits` | Scale legends where the default-panel drawing prints them (200Hz / 2KHz beside the knob, VCO / NOISE / EXT and 20Hz / 20KHz below it), LO / HI MIX beside the value box, the printed rings drawn as art, readout 10.5 px condensed type, SETUP 9 px text and 26 px rows. Every functional text now renders at 9 px or more, except OUT and VCO PULSE at 8.9 px (squeezed by their neighbours in the patch bay) and the brand line, fixed artwork type, at 6.3 px |
| 9 | Low | Short Brass: MIX read as 66 % (drawn 1:00 = 60 %) | crop of M p.66 | 60 %. Kept the builder's two documented changes (VCO MOD 62 %, CUTOFF 800 Hz): at the drawn 80 % the EG's pulse-width sweep moves the pulse's DC level so far that its sub-40 Hz thump is 9 dB above the note's harmonics (measured) |
| 10 | Low | Noise Transient was filed under Drums; it is a melodic pluck at octave 5 | M p.64 | "Lead / Noise-attack pluck" (key unchanged) |
| 11 | Low | Lesson wording: "PW", "FREQ" for the printed PULSE WIDTH / FREQUENCY (f5, f7, sd2); sq2's save step said "hold (SHIFT) on RUN / STOP" (the panel wants SHIFT, then RUN / STOP held for a second); f4 "right down to about 80 ms" no longer true | PEDAGOGY.md: use the panel's labels | wording fixed; ids, targets and checks unchanged |
| 12 | Low | REFERENCE.md described the HI PASS as "RESONANCE fading the subtraction (the bass returns)" - the intent, not what the code did - and the old decay law | - | REFERENCE.md updated (DECAY, HI PASS, rails, VCF jack, presets table, knob travel, scale legends) |

## Verified as built (no change needed)

- **Patch bay (M pp.46-56)**: all 32 points in the printed order, outputs reversed, GATE, RUN / STOP,
  RESET and HOLD circled (TEMPO is not). Normals: NOISE -> EXT. AUDIO, EG -> VCO MOD (at the EG /
  VCO MOD position; a cable replaces it, AMOUNT attenuates it: +1 V at full AMOUNT = +0.5 oct
  measured), MIX 1 = 0 V, MIX 2 = +5 V; everything else sums. Levels as printed: VCO SAW / PULSE,
  LFO TRI / SQ, NOISE +/-5 V; EG 0 to +7.5 V; KB +/-5 V with glide and bend; GATE +5 V; VC MIX
  0 / 2.5 / 5 V and CTRL +/-5 V across the crossfade; MULT buffered; VCA CV 0 to +8 V (EG) /
  +/-5 V (ON); MIX CV, VCF RES, VC MIX CTRL +/-5 V around a centred knob; RUN / STOP, RESET,
  HOLD at about 3.2 V.
- **Sequencer**: steps 125.0 ms at 120 BPM 1/16; gate lengths n/8 exact; 8/8 ties (also into a
  new note, legato); ratchets 2-4 evenly inside the step; all 24 divisions; swing 66 % gives
  165 / 85 ms pairs, 34 % the reverse, 100 % only the on beats; a 1/8T swing interval over 1/8
  steps follows the text of M p.21 (a step that straddles the change finishes at the other rate;
  the diagram draws the steps snapped to the triplet grid); forward, reverse, pendulum (ends not
  repeated) and random; ASSIGN clock, clock / 2, / 4, step 1, ramp, saw, triangle (+/-5 V) and
  accent (5 V filtered pulse). Record (step-write that extends the pattern), step edit, rests,
  ties, accents, glide, ratchets, save, transposition: the lesson runner plays them through the
  real panel.
- **TEMPO jack (M p.55)**: SINGLE CLOCK ADVANCE one step per edge; ANALOG CLOCK at 4 and 24 PPQN
  (150 ms steps from a 100 BPM clock at 1/16); TEMPO CV -5 / 0 / +5 V -> 20 / 77 / 300 BPM with
  the knob centred; STEP ADDRESS CV picks the step when the voltage changes (and only then, as
  the manual says). RUN / STOP plays while high, RESET holds step 1, HOLD repeats the step.
- **VCO MOD / VCF MOD**: vibrato, PWM (modulation past 0 % cuts the pulse out, M p.11), EG pitch
  sweeps, polarity; the LFO wave switch feeds both sources.
- **Studio lessons, in the real studio** (Playwright, Mother-32 + Studio Clock + DFAM):
  st1 - synced 1/16 steps every 125-131 ms (UI sampling), TEMPO set to 1/8 gives 250 ms, Studio
  Clock CLOCK -> TEMPO steps once per pulse (no double stepping with the transport), CLOCK DIV
  1/8T gives 168 ms. st2 - with ASSIGN on CLOCK into ADV / CLOCK the DFAM waits (0 steps) until
  the Mother-32 starts, then steps in lockstep (20 and 20 steps, 0 ms lag); CLOCK / 2 halves it
  (20 and 10). Both lessons work as written.
- **Lessons as a teacher**: in signal-flow order, one idea each, every prediction has one clearly
  right answer (f3's HI PASS answer is now also what the twin does), ear-training targets differ
  by 12-37 % of travel (e2's finest round 12 %, above the 8 % floor), studio lessons build on
  the shared curriculum. Lesson runner: 19 lessons, 0 failed, 0 manual steps.

## Measurements against the hardware

| Quantity | Hardware (manual) | Twin (measured) |
|---|---|---|
| Keyboard pitch | 1 V/oct; octave 5 low C = 0 V = C4 261.6 Hz (M p.62) | MIDI notes 0-120 within 0.23 cents; FREQUENCY +/-1.000 oct |
| VCO 1V/OCT | -5 to +5 V sweeps 8 Hz - 8 kHz (M p.48) | 8.17 Hz - 8.37 kHz |
| LFO RATE | about 0.1 - 350 Hz; jack -5..+5 V from centre about 0.18 - 190 Hz; 600 Hz max (M p.13, p.49) | 0.100 - 350.0 Hz; 0.185 - 189.3 Hz; 600 Hz |
| CUTOFF | 20 Hz - 20 kHz; jack -5..+5 V from centre covers it (M p.14, p.48) | 20 Hz - 20 kHz (ladder: -12 dB at the knob frequency); jack 21.2 Hz - 20.3 kHz |
| LOW PASS slope | 24 dB/oct (M p.14) | -16, -21, -24 dB/oct over the octaves above the cutoff |
| Self-oscillation | above 3 o'clock (M p.14) | from 76 % (about 2:40); tracks CUTOFF within 7 cents from 30 Hz to 12 kHz; 4.5 V |
| HI PASS | 24 dB/oct, non-resonant, RESONANCE brings the bass back (M p.14) | about 6 dB/oct below a corner about two octaves under the knob (kept: see Open); RESONANCE 0 -> 100 % lifts 65 Hz from -7.5 to -2.9 dB, bump +4.4 dB |
| ATTACK | 1.25 ms - 3 s (SOS) | reaches the peak at the knob time (1.23 ms ... 2.99 s) |
| DECAY | 1.25 ms - 7 s nominal (SOS) | -40 dB at the knob time; 10 ms - 7 s (model choice, finding 2) |
| EG out | 0 to +7.5 V (M p.53) | 7.50 V |
| SUSTAIN | ON holds, legato does not retrigger; OFF retriggers, decays at release (M p.16) | as specified |
| GLIDE | time not documented | 95 % at the knob time, 0 - 2 s |
| VC MIX | 0 to +5 V source; CTRL crossfades (M pp.50-51) | 0.000 / 2.500 / 5.000 V |
| Levels | VCF out about +/-5 V max (M p.48) | VCF jack <= 5.75 V; main <= -0.0 dBFS at VOLUME 100 |
| DC | - | presets: abs(mean) under 0.001; VOLUME 100: under 0.001 |
| Retrigger | - | from the current level (3.0 V -> 3.16 V on the first sample; no drop to zero) |
| CPU | - | 31x realtime for one instance, one worklet node (`scripts/bench.cjs`, `devices=mother32`, on a machine shared with other agents). Against the bench's first-build variant the ratio is 1.12x, as in the builder's 42x run on a quieter machine (1.13x): the rails and the second blocker cost nothing measurable |

## Patch sheets: do they sound as the manual intends?

| Sheet | As delivered | Now |
|---|---|---|
| Octave Bounce Back | jumped 9.2 semitones | an octave up while the gate is high, falling back in a 1 s tail |
| Noise Transient | pluck 125 ms (drawn 41 ms) | as drawn: 144 ms pluck that starts in noise |
| Metal Snare | 20 BPM demo; CUTOFF and octave shifted | as drawn, 533 ms gritty snare (EG -> VCA CV overdrives the VCA), 100 BPM demo |
| Sequencer Bass | as drawn, 93 ms staccato | as drawn, 270 ms |
| Resonant HP | as drawn | as drawn (release 530 ms); the MIX-as-resonance loop still self-oscillates |
| 8-Bit Percussion | VCF MOD lowered | as drawn: crunchy hits 18 dB over a quiet VCA-ON bed |
| '80s Toms | as drawn, 222 ms | as drawn, 509 ms: a long, pitch-dropping electronic tom |
| Short Brass | three changes | drawn DECAY (265 ms) and MIX; two documented changes kept (finding 9) |
| Filter Kick | as drawn, 40 ms click at about 35 Hz | as drawn, 136 ms kick; demo on the G key (30-100 Hz) |

## Panel legends (switch positions beside the lever)

It matters little. On the hardware the two position names are printed above and below each
bat lever; the twin's shared switch component sets them beside it, which moves each lever
2-4 mm right of its printed spot. In use nothing is lost: the up / down order is kept, the lit
legend shows the position, the legends are the (large) tap targets, and every lesson names
positions by their printed words. It is a visual difference a Mother-32 owner would notice, not
a learning problem, and fixing it needs a "legends above / below" option in
`components/controls/Switch.tsx` (shared with the DFAM and Subharmonicon, which print theirs the
same way) - left for the integrator.

## Preset loudness (audio QA, `--target -18 --suggest`)

- Before, audition: `[mother32] median -18.0 LUFS, spread 11.3 LU, 3 of 43 flagged (clicks 1, loudness 2)`, exit 1.
- Before, transport: `[mother32] median -17.7 LUFS, spread 9.9 LU, 0 of 43 flagged (none)`, exit 0.
- After, audition: `[mother32] median -18.0 LUFS, spread 8.9 LU, 0 of 43 flagged (none)`, exit 0.
- After, transport: `[mother32] median -17.8 LUFS, spread 9.1 LU, 0 of 43 flagged (none)`, exit 0.
- The offline harness, using the QA tool's own meter, agreed with the browser runs to 0.1 LU,
  so the volumes were set offline and confirmed in the app.

| Preset | VOLUME | Why |
|---|---|---|
| Bass / Pulse sequencer bass | 72.2 -> 57.4 | DECAY 270 ms (as drawn on the new law) |
| Lead / Gate pitch jump | 52 -> 46 | DECAY 1.01 s |
| Drums / Noise snare | 71 -> 73 | as drawn, 100 BPM |
| Drums / Electronic toms | 66 -> 48 | DECAY 510 ms |
| Drone / 8-bit percussion | 68 -> 38 | VCF MOD 95 % as drawn |
| Sequence / Step scanner | 81 -> 62.5 | was +4.5 LU |
| Sequence / Pendulum arpeggio | 75 -> 67 | +3.2 LU, margin |
| Drums / Feedback filter kick | 62 | demo on the G key: -23.5 -> -17.6 LUFS without more VOLUME |

## Upgrade notes (for the integrator)

- `decay`: range 1.25 - 7000 ms -> 10 - 7000 ms. Meaning unchanged (time to -40 dB), so saved
  values keep their sound; values below 10 ms clamp to 10. Default 60 -> 180 ms.
- Preset names (keys unchanged): `drum_noise_transient` "Drums / Noise-attack pluck" -> "Lead /
  Noise-attack pluck"; `drum_bit_crunch` "Drone / Bit-crunch bed" -> "Drone / 8-bit percussion".
- Sound changes for saved patches: HI PASS with RESONANCE above 0 now lets the bass in instead of
  ringing; the main output is limited above -3 dBFS (presets never get there).
- No control, jack or lesson id changed.

## Open (left, and why)

1. **DECAY law** - the 10 ms - 7 s range is fitted to ten Moog patches (finding 2), not measured;
   verify the time at noon and 11 o'clock on a unit.
2. **HI PASS slope** - the manual prints 24 dB/oct; the twin keeps the builder's gentle slope
   (about 6 dB/oct), which matches the SOS review ("a lot of mid-range passes") and a forum report
   (a triangle comes out almost square). Needs a unit to settle.
3. **Self-oscillation onset** at about 2:40 instead of "above 3 o'clock" - left: moving it shifts
   every resonant preset, for a quarter-hour of knob travel.
4. **Switch legends** beside the lever and **knob travel** 270° instead of about 300°: both live in
   shared components (`components/controls/Switch.tsx`, `Knob.tsx`). Both fixed after the review:
   the panel sets `knobTravel: 300`, and its toggles use `legends: 'ends'`, which puts one position
   above the lever and the other below, as on p.9.
5. **LIN FM depth** (+5 V doubles the frequency) is a guess; Octave Bounce Back's drawn VC MIX hints
   that the hardware's is stronger (about +3.5 V per octave).
6. **Mixer AC coupling** (4 Hz) is a guess, and it sets how loud the pulse's DC thump is under a
   fast pulse-width sweep (Short Brass).
7. Not modelled (documented in REFERENCE.md): MIDI velocity >= 96 setting accents while recording,
   Setup page 2 and 5 and page 8 options 1-3, the LED sweep animations.
8. Under SINGLE CLOCK ADVANCE the TEMPO knob showed CLOCK DIV although the manual says the knob is
   ignored in that mode (p.55). Fixed after the review: with a TEMPO-jack clock in SINGLE CLOCK
   ADVANCE or STEP ADDRESS CV the knob stays on TEMPO (the internal tempo it returns to); only
   an ANALOG CLOCK or the studio's MIDI clock make it the clock division.

## Gate

All on the final code (production build, `next start -p 3143`):

- `tsc --noEmit`: 0 errors. `next lint`: no warnings or errors. `npm run validate mother32`:
  0 errors (1 warning, unchanged: too many UI-state combinations to check every binding).
- `npm run build`: passes.
- `node scripts/smoke.cjs http://localhost:3143 mother32 <scratch>`: no errors; no horizontal
  overflow at 1440 x 900 or 1180 x 820; notes, transport and all 21 buttons make sound.
- `node scripts/lesson-runner.cjs http://localhost:3143 mother32`: 19 lessons, 0 failed,
  0 manual steps, 0 auto steps.
- `node scripts/e2e/run.cjs http://localhost:3143`: 34 / 34 passed.
- Audio QA `--target -18 --suggest`, audition and `--excite mother32=transport`: both exit 0,
  0 of 43 flagged.
