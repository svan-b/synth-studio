# Xone:96 digital twin - independent review

Reviewer pass over `devices/xone96/**` and `public/worklets/xone96-processors.js` against the
*Xone:96 User Guide* AP11645 issue 2 (cited "UG p.N", the guide's printed page numbers), its block
diagram (UG p.34, "BD"), the specification pages (UG p.35-36) and the 2026 web export of the guide.
Every number below was measured in the real app (Playwright, a sine or noise source connected to a
studio input exactly as the hub connects an instrument, read at `hub.slots.get('xone96').outGain`
with an AnalyserNode), or traced from the guide's graphs with a pixel tracer (curves at 200 dpi,
read to about 0.5 dB). Nothing from the guide is reproduced here beyond short cited facts.

Status: **complete** on `wip/review-xone96`. The gate passes (see "Gate").

## Verdict in one paragraph

The builder's signal flow is right almost everywhere I could check it against the block diagram,
and the laws it measured off the guide's graphs (fader and crossfader curves, the filter's Q and
+7.6 dB WILD peak, kill slopes) hold up to my own traces. Three things were wrong in ways a
customer would notice: the meters read 3-6 dB hotter than the lessons (and the guide's operating
level) said for the very sources the lessons use, the iPad view's assign switches, curve switches
and several legends were too small to hit or read, and the PHONES 2 cue followed the POST EQ
switch, which the diagram doesn't do. Those are fixed, along with the 4-band mid-band widths. A DJ
can now mix on the iPad by touch (measured with real touch events below).

## Findings and changes

| # | Severity | Finding | Evidence / source | Change |
|---|---|---|---|---|
| 1 | Medium | **Meters contradicted the lessons and the guide's operating level.** The LED ladders were sample-peak. At GAIN 0 dB the decks read +3 to +6 on average with peaks at +9 to +10 (TRACK B: mean +5.9, max +9.6), while lesson f2 said "its meter averages around 0, with peaks near +6", the target the guide gives (UG p.9, p.11, p.16, p.39). Following the guide's rule would have put every normalised source 3-4 dB under the studio's -18 LUFS norm | meter snapshots every 32 ms over 4 s per deck; offline models of five ballistics on captured deck audio | The ladders are now quasi-peak, like an analogue LED driver: 1 ms attack, the same 20 dB / 1.5 s release. The PK! indicators stay sample-peak: the channel PK! at +15 dBu, and the LR MIX meters' top LED (printed PK!) now also on sample peaks at its +10 legend, 3 dB before the studio's master limiter. Decks at GAIN 0 now read about 0 to +3 with peaks at +4 to +6 (TRACK A 2.0 / 4.0, TRACK B 3.4 / 6.3, FULL MIX 1.3 / 3.6). Steady tones read within 0.1 dB as before, so every LED threshold is unchanged |
| 2 | Medium | **iPad (compact) view: small targets and illegible legends.** FILTER and XFADER assign segments were 17 x 15 px with 4.3 px legends, INPUT buttons 12 px tall with 6.9 px text, curve switches 15 px, POST EQ / SPLIT 14 px, PHONES 2 positions 13 px, YOU HEAR five 34 x 14 px buttons at 5.3 px, meter legends 5 px, PRE 4.4 px. 187 of the 345 visible texts were under 9 px | DOM audit at 1180 x 820 with `hasTouch`; `elementFromPoint` hit probe | FILTER and XFADER assigns are full-width rows of 9.5 x 6 mm buttons (29 x 25 px hit areas); INPUT is a 2 x 2 grid of position buttons; curve switches 5 mm on a 9 mm pitch (25 px hits); POST EQ / SPLIT / MONO / PRE bigger; PHONES 2 ring 10.5 mm with 5.2 mm buttons; YOU HEAR is a native menu (both views); meter legends and the LR MIX captions 9 px; PRE, MUTE and SEND legends moved where they can grow. The CUE, meter and fader moved into the empty band above the crossfader. Texts under 9 px: 48 (the twin-only FX / LATCH CUE strip and some condensed caps) |
| 3 | Low | **PHONES 2 followed the POST EQ switch.** In the diagram each channel's CUE 2 switch is fed straight from the post-EQ line; the POST EQ logic reaches only the CUE 1 pre/post selectors | BD (channel strips, all three kinds) | CUE 2 always post-EQ, pre-fader. Measured: CH 2 LO killed, PHONES 2 on CH 2 reads -2.7 dB at 300 Hz with POST EQ on and off; the MONITOR cue still switches |
| 4 | Low | **4-band mid bells too wide boosting and too narrow cutting.** LO MID at -27 dB was 3.6 dB shallow at 500 Hz and 3 dB shallow at 1 kHz; HI MID at +10 dB was 1.3 dB wide at 1.5 kHz | traces of the UG p.10 graph against in-app sweeps | Q fitted to the graph: 1.65 at +10 dB, 0.70 at -27 dB (linear in dB between). HI MID now within 0.5 dB of the graph at 250 Hz, 500 Hz, 1.5, 2 and 6 kHz; LO MID within 0.6 dB below 350 Hz and 2 dB above it (the graph's LO MID cut is lopsided) |
| 5 | Low | **Lesson e4's closing challenge taught the opposite of the guide.** "Set channel 1 hot but clean: GAIN up for more level" against the guide's operating-levels page ("Peaking simply results in signal distortion, not more volume", UG p.39) and lesson f2 | UG p.39 | Now "set channel 1 the way the guide asks: the meter averaging around 0 with the loudest peaks near +6", GAIN 0 to +4 dB (FULL MIX reads +1 / +3.6 at 0 dB); hint and solution updated |
| 6 | Low | Lesson f2 step 3 promised a meter reading the twin didn't show (finding 1) | as 1 | True now; reworded to what the learner sees ("works around 0 to +3, the loudest hits touching +6") |
| 7 | Low | Full view: SEND 1 / SEND 2 legends at 4.5 px (stacked, no room to grow), meter legends 5 px | DOM audit at 1440 x 900 | one-line SEND legends beside the knobs, 9 px meter legends |
| 8 | Low | Meter ladders had `role="meter"` without a value (lint warning, screen readers) | `next lint` | `aria-valuemin/max/now/valuetext`, updated with the lit LED |

REFERENCE.md is updated for 1, 3 and 4 (the corrected reading of the diagram, the measured graph
fits and the new meter model) and records the review measurements.

## Panel against the guide's drawings (UG p.7-17)

The full view matches the top-panel overview (UG p.7): CH A and B on the left, RTN C/D above
FILTER 1, CH 1-4, the LR MIX meters above FILTER 2, the master / booth / monitor column, the
crossfader under CH 1-4 and PHONES 2 under A/B. The printed ranges agree with the legends: SEND
off to +6, GAIN off to +10, HI/LO off to +6, the 4-band mids -27 to +10, the A/B MID -24 to +10
with FREQ 190 Hz / 650 Hz / 2.75 kHz, CRUNCH 0-10, RES MILD-WILD, booth EQ -8 to +8, MONITOR and
PHONES 2 LEVEL 0-11, channel meters +10 to -20, LR MIX PK! to -35, PHONES 2 MST, 1-4, A-D. Small
differences that don't matter for use: the hardware prints MIC A / RTN A on channel A's selector,
the twin MIC / RTN on both.

## Signal flow against the block diagram (UG p.34)

Checked strip by strip; all **match** unless noted.

- CH 1-4: input select, GAIN, PK! after GAIN and before the EQ, 4-band EQ, meter after the EQ and
  before the fader; one VCA per channel driven by the fader (through the CHANNEL FADER curve) and
  the crossfader (XFADE SELECT); FILTER SELECT after the VCA. Measured: the crossfader closes a
  channel's route into a filter as well as its LR MIX route.
- Sends: SEND 1 PRE taps after the EQ and before the VCA, SEND 1 post and SEND 2 after the VCA, all
  before FILTER SELECT. Measured: a 5 kHz tone through a 100 Hz low-pass reaches the output at
  -69 dB direct and +5.3 dB through SEND 1 and the delay return, so the effects hear the
  unfiltered channel; a post send follows the crossfader (-53 dB with the channel's side closed), a
  PRE send ignores fader and crossfader.
- CH A/B: an analogue fader (not on the curve switch or the crossfader: CH A at fader 5 reads -22 dB
  on every curve setting), sends before the clean-feed switch, MIC to the CLEANFEED bus only.
- Filters: FILTER n MIX, then the bypass tap, then CRUNCH and the VCF; OFF passes the bus dry with
  CRUNCH out of circuit (0.0 dB).
- RTN C/D: LEVEL, both cues before ON, ON into the LR MIX.
- Master: LR MIX, the music-only bus to BOOTH (EQ, MONO, MUTE, level), MONITOR program and PHONES 2
  MST, plus the clean feed for MASTER 1 / MASTER 2 only. The LR meters read the music-only mix
  before MASTER 1 (MASTER 1 at 10: output +6.0 dB, meters unchanged).
- Monitor: with nothing cued the phones carry the program; a CUE switches them to the cue bus;
  CUE/MST adds the mix (5: mix at -12 dB, 10: 0 dB, cue unchanged); SPLIT puts the cue left and
  the mix right. Matches the diagram's CUE 1 ACTIVE / SPLIT switching.
- CUE 2 / PHONES 2: **did not match** (finding 3), fixed.

## Measurements against the hardware

| Quantity | Hardware | Twin (measured in the app) |
|---|---|---|
| Unity through a routed studio channel | - | -0.02 dB from 50 Hz to 15 kHz on CH 1 (LINE), CH A (RTN) and RTN C, GAIN 0, fader up, EQ flat, MASTER 1 at 8 |
| Digital line-up | 0 dBu = -14 dBFS (UG p.35) | a -20 dBFS tone reads -6 on the channel and LR meters; full scale in is +14 dBu |
| Channel headroom | +20 dB (UG p.35) | clean to +17 dBu (0.00 % THD at +3 dBFS in); 1.9 % THD at +20 dBu (+6 dBFS in); PK! at +15 dBu, sample peak, 1 s hold |
| LR MIX | - | four in-phase -6 dBFS sines sum to +20 dBu at 0.27 % THD (clip +21 dBu) |
| HI / LO | +6 / kill at 3 kHz / 180 Hz (UG p.10, p.35) | +6.0 dB / kill. LO killed: -6.0 dB at 180 Hz (graph about -3), -12.6 at 100 Hz (about -11), -20.0 at 60 Hz (-20), -29 at 35 Hz (-30). HI killed: -9 dB at 4 kHz, -20 at 8 kHz (-20 at 8.8 kHz), -40 at 16 kHz (about -31) |
| HI MID / LO MID | +10 / -27 dB at 1.1 kHz / 350 Hz | +10.0 / -27.0 dB at the centre; flanks as finding 4 |
| A/B swept MID | +10 / -24 dB, 190 Hz - 2.75 kHz (UG p.8) | +10 / -24 at the centre over the whole sweep; boost and cut flanks within about 1 dB of the p.8 graph |
| Filter | FREQ 20 Hz - 20 kHz; RES MILD to WILD (UG p.13); graphs UG p.14 | WILD +7.6 dB at FREQ on HPF, BPF, LPF and all three; MILD -6.0 dB; 12 o'clock 0.0 dB; 12 dB/oct skirts; HPF at minimum -0.08 dB at 100 Hz, LPF at maximum -0.03 dB at 10 kHz; notch -130 dB or deeper |
| CRUNCH | clean at 0, dramatic at 10; best with channels within +-6 dB (UG p.13) | 0: bypass. A 0 dBu tone: +1 dB and 0.9 % THD at 1, +4.4 dB and 10 % at 6, +2.3 dB and 30 % at 10 |
| Channel fader (CH 1-4) | p.12 curves | constant power -22.0 dB at half (graph -22.1), dipped -14.0 (-14.3), fast-cut -8.5 (-8.2); every 5 % step within 1 dB of my traces |
| Crossfader | p.12 curves | constant power -3.0 dB per side at the centre; transition full over the middle, -4.5 dB at 10 % from the closed end; fast-cut full from 7.5 % of travel (graph 6.6 %) |
| Meters | 9 LED -20 .. +10, 11 LED -35 .. +10 (UG p.35) | every threshold within 0.1 dB on a 1 kHz tone; release 13.3 dB/s |
| SEND 1 / SEND 2 | off .. +6 (panel legend) | +6.0 dB at 10, unity at 7.07 |
| BOOTH / MASTER 2 | independent of MST (UG p.16-17) | BOOTH unity at 8, MID -8 dB reads -8.0 at 1 kHz, MUTE silent; MASTER 2 at 6 is -7.8 dB |
| Switching | soft-switched (UG p.14) | no clicks: filter ON/OFF, type change, assign changes, kills, CUE, YOU HEAR and input changes are 5 ms ramps (largest second difference 26x a steady 80 Hz tone; a step would be about 7700x) |
| CPU | - | 21.3x realtime offline with the decks playing (`scripts/bench.cjs`, four worklet nodes; the machine was shared by about seven agents) |

### Gain staging with real studio instruments

| Set | Xone channels (meter mean / max) | LR MIX | Output |
|---|---|---|---|
| Elektron "Full set" (Rytm, A4, DFAM into CH 1, 2, 4; studio trims as the set; the Sub 37 on CH 3 plays no notes until you play it) | -4.8 / +1.2, +2.3 / +8.5, -3.4 / -2.5 | +3.9 / +8.9 | -17.0 LUFS, -2.0 dBFS peak, no master limiting |
| Moog studio (DFAM, Mother-32, Subharmonicon into CH 1-3, all at unity) | +1.1 / +1.8, +6.3 / +9.3, +7.1 / +9.1 | +9.1 / +13.3, PK! lit | -14.1 LUFS, 1.5 dB of master limiting |

Nothing clips inside the Xone (the channels have 6 dB above full-scale input, the LR MIX 7 dB
above the browser's full scale), and the studio's -1 dBTP master limiter catches what the output
stage passes. The LR MIX PK! LED lights 3 dB before the limiter starts. Several instruments at
unity sum past the guide's LR MIX target, exactly as on the hardware: the meters and PK! say
"turn the channels down", and the lessons teach it (st2). The bass-heavy Moog voices read hottest:
-18 LUFS is K-weighted, and the meters are not.

### iPad: can a DJ mix on it by touch?

Yes, in the compact view (chosen automatically on touch screens). Real touch events through the
DevTools protocol at 1180 x 820:

- channel fader drag 60 px: 10 -> 6; two faders dragged at once by two fingers: both moved;
- crossfader drag 45 px from the centre: 5 -> 8.3 (the 45 mm innoFADER is 135 px of travel);
- FILTER "1" and CUE tapped 6-8 px off centre: both registered; a knob dragged 50 px up: LO 0 -> 0.49;
- the page never scrolled during a control drag.

The one compromise left: the app's own header, tabs and preset row take about 220 px above the
panel, so on a 820 px tall screen the crossfader starts below the fold. One page scroll (about
130 px) brings the whole panel, crossfader included, on screen, and it stays put while mixing.
The full hardware layout (1338 px tall) is for study on an iPad, not for mixing.

## Audio QA

`node scripts/audio-qa.cjs http://localhost:3145 xone96 --target -18 --suggest` (and with
`--excite xone96=transport`):

| Run | Before the review | After |
|---|---|---|
| audition (the module's own) | median -18.5 LUFS, spread 5.4 LU, 0 of 21 flagged, exit 0 | median -18.5 LUFS, spread 5.3 LU, 0 of 21 flagged, exit 0 |
| `--excite xone96=transport` | median -19.3 LUFS, spread 5.2 LU, 0 of 21 flagged, exit 0 | median -19.3 LUFS, spread 5.3 LU, 0 of 21 flagged, exit 0 |

No suggested gain changes in either run. The mid-band change moves presets with mid cuts by
0.1 LU at most; true peaks stay at -2.3 dBTP or lower.

## Lessons

`node scripts/lesson-runner.cjs http://localhost:3145 xone96`: 18 lessons, 0 failed, 0 auto steps,
4 manual steps (before and after the review). The manual steps are the studio routing challenges
(st1, st2, st3), which the lesson API can't solve automatically (no route field in `solution`).

Read as a teacher against docs/PEDAGOGY.md: the curriculum is well sequenced (signal flow, gain,
EQ, kick vs bass, filters, crossfader, sends, cue; then phrasing, transitions and a full blend;
four graded ear-training lessons; three studio lessons). Every lesson has an objective, a first
win, a predict or listen, a quiz, a challenge or match, a reflection and three to five review
questions. Each prediction has one right answer; the ear-training targets differ by a kill, a
-12 dB cut, a type change or 10 dB of gain, all clearly audible. The mixing technique is sound:
gain-match in the cue before the blend, one track owns the low end, the bass swap on the first
beat of a phrase, a rising high-pass as the exit, post-fader reverb raised before the fade. The two
inaccurate statements (findings 5 and 6) are fixed.

## Presets

21 presets, all "Category / Name" (Init, DJ, Filter, FX, Stems, Gain, Cue, Studio). They are mix
scenes built on standard techniques and each one sounds with PLAY. Musically they hold up: the
bass-swap and blend scenes are gain-matched, the dub throw and pre-fade ghost show the send
behaviour the hardware has, the MC scene cuts the mic's lows and lifts its presence on the clean
feed. No changes needed beyond what the new meters show (none of the presets changes level).

## Left as they are

- **Kill-band corner.** The LO kill is -6 dB at 180 Hz where the graph shows about -3 dB (HI kill
  likewise near 3 kHz). A 2nd-order Linkwitz-Riley split keeps the flat EQ an exact all-pass; a
  sharper corner would colour the centred EQ. The skirts match from 60 Hz down. The builder's
  documented trade-off; I agree with it.
- **HI kill above 12 kHz** falls faster than the graph (-40 dB at 16 kHz against about -31): the
  bilinear transform's cramping near Nyquist. Inaudible on music with the top already killed; a
  matched-Z design would fix it.
- **FREQ law.** The guide's text gives 20 Hz to 20 kHz (UG p.13); its p.14 graph puts the
  minimum's resonant peak near 40 Hz and labels 12 o'clock "1kHz". The twin follows the text
  (log 20 Hz - 20 kHz, 12 o'clock 632 Hz). Changing it would move saved FREQ values and make the
  "HPF at minimum is transparent" steps untrue. To check on a unit.
- **Filter types "pressed together"** use a 350 ms window, so two quick single presses (HPF, then
  LPF within 350 ms) give a notch. It is the only way to combine types with a mouse; on touch two
  fingers land well inside it.
- **Meter ballistics** remain a model choice: the guide gives no attack or release figures.

## Open (outside devices/xone96)

- `lib/studio/sets.ts`: the Moog studio sets route three instruments into the Xone at unity and
  start with the LR MIX at +9 / +13 and 1.5 dB of master limiting. Starting the Mother-32 and
  Subharmonicon channels about 5 dB down (studio trims, or Xone GAIN in the set) would open the set
  at the guide's level.
- The studio routing challenges in st1-st3 have no `solution` (the lesson API has no route field),
  so the lesson runner leaves them as manual steps.

## Upgrade notes

No control ids, ranges, defaults or option lists changed. `monitor_out` (YOU HEAR) joins the
module's `uiControls`: the panel's Reset and undo now leave the listening choice alone (presets and
lesson starts still set it). Saved EQ settings sound slightly different on CH 1-4 mids (finding 4)
and saved PHONES 2 sources now ignore POST EQ (finding 3); no conversion is needed.

## Gate

GATE_SUMMARY
