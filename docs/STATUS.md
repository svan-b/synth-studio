# Synth Studio: status and next actions (updated 2026-10-29)

Working branch: `claude/dfam-documentation-review-iYhxN` (PR #54). Everything below
marked **merged** is on this branch, built and verified. Everything marked **in progress** is on
its own `wip/*` branch on GitHub, committed but **not yet merged**.

## 1. Merged and verified on the working branch

| What | Notes |
|---|---|
| Studio v2 | Rack, cables, routing, sync, arranger, recorder, projects, Review, lesson coach v2 |
| Producer-grade studio | Clean unity master, −1 dBTP true-peak limiter, BS.1770 LUFS meters, mixer strips with sends to a tempo delay and Reverb2, undo/redo, stems, bounce, count-in, loop |
| All seven instruments rebuilt to their manuals | DFAM, Xone:96, Sub 37, Analog Four MKII, Mother-32, Subharmonicon, Analog Rytm MKII. Each passes audio QA at −18 LUFS with 0 flagged presets and plays all its lessons |
| Independent expert reviews | A second agent re-checked each instrument against its manual and fixed what it found. All seven are merged: DFAM, Subharmonicon, Xone:96, Analog Four, Mother-32, Sub 37, Analog Rytm. Each writes `devices/<id>/REVIEW.md` |
| Producer path | Lesson API v3 studio state (whole-studio starts, saved learner studios, loudness-matched A/B, master/channel meters, bounces, mixer and arranger checks) and the first 8 Producer path lessons. See "Lesson API v3" in `docs/PEDAGOGY.md` |
| Clock chip | Every instrument that can follow the studio clock shows **Clock: studio / own tempo** above its panel. One tap lets a patch sheet play at its drawn TEMPO |
| Stale-module fix | `useDeviceModule` reads the hub cache on every render, so switching never pairs one instrument's layout with another's data |
| 60 ms minimum note gate | A quick tap on an on-screen key always sounds |
| Play starts clocked gear | The studio ▶ presses RUN on every unsynced instrument, cable-clocked ones included, before the clock starts |
| Saved-settings upgrades | `lib/studio/upgrades.ts`: store v12 / project v9. Untouched controls keep their old defaults; completed lessons carry over to rebuilt successors; settings no conversion can carry are kept and offered as a file. Table in section 3 |
| DSP core v2 | Band-limited VCO, 2× ladder, DAHDSR env, SVF, Reverb2 (FDN), Chorus. `/bench` page; see `docs/DSP.md` |
| Elektron sequencer library + UI kit | `docs/ELEKTRON_SEQUENCER.md` (233 tests) |
| Bring your own gear | Web MIDI, Practice synth (works on iPad without hardware), audio input, Web Audio plugins, 16 lessons, Safari guidance. See `docs/EXTERNAL_GEAR.md` |
| Audio QA tool | `scripts/audio-qa.cjs`, see `docs/AUDIO_QA.md`: LUFS, true peak, DC, clicks, stuck tails per preset. The baseline in `docs/audio-qa-baseline/` predates the rebuilds and needs regenerating |
| E2E regression suite | `npm run test:e2e` (scripts/e2e/run.cjs), 37 checks including the iPad producer walkthrough. `--full` adds smoke and lessons for every instrument: 87/87 at the last full run |
| iPad | Home-screen install, floating lesson coach, 44 px touch targets, fine-adjust gestures, value bubble. Fit may shrink a panel up to 20 % so it ends above the bottom of the screen (the whole Xone:96 at 87 %, the A4 at 90 %), and the control readout shares the toolbar row. First-load JS 198 kB (MIDI, studio view and coach load on demand) |
| Research notes | `docs/research/<device>/` (sources, signal-flow, presets, lessons) from the official manuals, in our own words. See `docs/research/COPYRIGHT-RULES.md` |

## Live log (session 3, 2026-10-29, after a usage-limit pause)

- All agents stopped at a usage limit. Their worktrees were checkpointed as `WIP (checkpoint by coordinator …)` commits, pushed to their `wip/*` branches, and the agents resumed from there after the reset.
- f671920: merged the **producer path** engine and its first 8 lessons (lesson runner 13 studio lessons, 0 failed; iPad walkthrough 24/24).
- 8bb8143: merged the **Subharmonicon review**: the EG-off behaviour is explained, the panel is legible on iPad, and the output has a DC servo.
- 4e0a2cb: the iPad producer walkthrough is part of the e2e gate (35/35).
- ac26e30: merged the **Xone:96 review**.
  - Meters behave like LED ladders, so the decks read as the guide says: average 0 to +3, peaks +4 to +6.
  - The compact view works by touch, PHONES 2 is fed straight after the EQ as in the block diagram, and the mid EQ follows the p.10 graph.
  - Audio QA 0/21; lessons 18, 0 failed.
- 9874026: merged the **Analog Four review**.
  - The panel looks like the black unit.
  - BND, FDB self-oscillation and the accent filter depth now work as in the manual.
  - Portamento applies to played notes only, and a studio stop fades the delay and reverb tails.
  - Transport audio QA went from 8/47 flagged to 0/47; lessons 20, 0 failed.
- d067af2: merged the **Mother-32 review**.
  - HI PASS no longer rings, and RESONANCE brings the bass back (p.14).
  - DECAY spans 10 ms – 7 s, so the patch sheets play as drawn.
  - The output and VCF jack are capped near the manual's levels.
  - Audition audio QA went from 3/43 flagged to 0/43; lessons 19, 0 failed, 0 manual.
- 76d4c40: upgrade store v12 / project v9 keeps an untouched Mother-32 DECAY at 60 ms (the default became 180 ms) and is checked in e2e (36 checks).
- c5abb5a: the Clock chip. The Subharmonicon's patch sheets played 1.5–6× slow while it followed the studio clock.
  - Sync stays on by default, so ▶ keeps everything in time, as hardware would on MIDI clock.
  - Each syncable instrument now has a **Clock** chip above its panel to switch to its own tempo in one tap.
- 42081a0: `scripts/checks/xone96.cjs` works again (it loaded its test file onto the wrong channel).
- 553c565: iPad fold. On touch screens, Fit may shrink a panel by up to 20 % so it ends above the bottom of the screen, and the control readout moves into the toolbar row (34 px back).
  - The whole Xone:96 now fits at 87 %, crossfader included; the A4 fits at 90 %.
  - Desktop is unchanged.
- Settings that a rebuild can't convert (the old Analog Four and Rytm) are no longer lost silently.
  - A copy stays in the browser (`synth-studio-old-settings`), and a one-time notice offers it as a file.
  - Old project files get a notice too; the file itself is the copy.
  - Checked in e2e (37 checks).
- Moog knobs turn 300°, as drawn: `PanelLayout.knobTravel` (default 270) is set to 300 on the DFAM, Mother-32 and Subharmonicon, whose manuals' clock positions and preset readings use the 7-to-5 o'clock sweep. Values are unchanged; the pointers and scale marks now line up with the printed legends. The Sub 37 uses the 280° measured on its manual's drawing.
- New-user walkthrough on iPad (welcome → first lesson → both studio sets playing):
  - 66fe408: "Start the first lesson" now starts it.
  - 6ebf36d: the add-instrument button is pinned in a full tab row, the map names each instrument's mixer channel in its box (labels overlapped on converging arrows), and the silent Studio Clock has no mixer strip. Cable names are drawn on top with a halo.
  - Measured with ▶: the Elektron set at −17.1 LUFS / −1.0 dBTP and the Moog trio at −16.3 LUFS / −2.2 dBTP, with no limiting and no console errors.
- d6fc40e: merged the **Sub 37 review**.
  - Mixer levels up to 5 are clean, as the manual says (1.2 % THD at 5, was 2.8 %).
  - MULTIDRIVE grows even, then odd harmonics, and the filter self-oscillates above 7.
  - The small buttons have their own touch areas on iPad, and KB TRANSPOSE is in.
  - Audio QA 0/64 in both modes; lessons 20, 0 failed, 0 manual. No ids or defaults changed.
  - 22b412c: its knobs turn 280°, as measured on the p.28 drawing, with the legends and CUTOFF marks at their measured angles.
- 2603002: on iPad the lesson coach moves off the control a step points at (checked on six lessons: no step leaves its target covered).
- 80c283a: an instrument's own studio lessons are headed "<name> in the studio", no longer a second "Studio & full tracks".
- Full suite on 22b412c (`run.cjs --full`): **87/87**, covering smoke for every instrument, every lesson of every instrument and the 37 core checks.
  - Lessons: DFAM 20, Mother-32 19, Subharmonicon 20, Sub 37 20, A4 20, Rytm 20, Xone 18, Your synth 7, Audio input 5, Web Audio plugin 4.
- 620e02a: merged the **Analog Rytm review**.
  - Closed hats sat 20–27 LU under the mix in 17 of 20 kits. They now have per-machine trims, and every kit is rebalanced.
  - Retriggers no longer dip, one-shot samples fade over their last 3 ms, and the output saturates softly at full scale (was +31.3 dBFS).
  - Lesson s3's comparisons are now audible, and the iPad legends are 9 px.
  - Audio QA 0/20 in both modes (median −18.8 / −18.9 LUFS); lessons 20, 0 failed, 1 manual (t2, the arranger; the producer-path agent is adding its solution).
  - No ids or defaults changed. Saved projects keep their old copies of the factory kits, which the user can reload from the kit menu.
  - **All seven independent reviews are now merged.**
- **Vercel build rate limit.** Previews from 49f3469 on failed with `build-rate-limit`, not a code error (local builds pass). Every push to any branch, the agents' `wip/*` included, starts a preview build. Pushes are now batched. Option for the user: disable preview builds for scratch branches with `vercel.json` → `"git": { "deploymentEnabled": { "wip/*": false } }`.
- A4 performance pass delegated (`wip/perf-analog-four`). In /bench the A4 runs at 5.1× realtime, about 20 % of a core; the other instruments run at 11–45×. All seven together use about 50 % of one core before the master chain.

## Live log (session 2, 2026-10-29)

- 19c9d56: merged `wip/elektron-sequencer` (library: 225/225 tests). A finisher is adding the UI kit and docs.
- 89ed17f: merged `wip/studio`: clean master, −1 dBTP limiter, LUFS meters, mixer, undo, stems. The iPad audio-input capture-count contract is now complete on both sides.
- 01a09bc: merged `wip/panel-teaching`. The `store/studio.ts` import conflict was resolved by keeping both sides. tsc, lint and validate are clean; build OK; **e2e 23/23**. First-load JS is now **242 kB**: lazy-loading is a priority follow-up.
- Full run on 01a09bc: **73/73**, covering every instrument's smoke test and lessons plus the 23 core checks.
- 6fca612: the studio view, coach, lesson browser, review and welcome now load on demand; first-load JS **242 → 215 kB**; e2e 23/23.
- 20480ee: README rewritten for the studio, your own gear, learning, tests and the iPad install.
- 32abdc4: merged the sequencer **UI kit** and manual-cited docs (233 tests; e2e 23/23). It adds trig-mute, swing and solo modes, `stampDefaults`, PLAY→pause `TransportKeys`, SAVE/RELOAD/undo, TEMP JUMP arm, chain rows in songs and the lock budget. The A4 and Rytm finishers are told to adopt them.
- 7818e6c: merged the panel/teaching finish (the same tree as tested: full suite 83/83). Adds 10 touch e2e tests; knob drags are faster than the baseline (A4 script 333 → 293 ms, long frames 2.5 → 1.5).
- 58e78bb: merged **Xone:96**. Audio QA 0/21 flagged (median −18.6 LUFS); lessons 18/18; e2e 33/33; unity within 0.011 dB.
  - Upgrade store v6 / project v3 (MASTER/BOOTH law, crossfader curve, per-channel PRE, sends ×0.707).
  - Studio sends are now off for instruments routed into a mixer, which fixes a −45 dBFS leak when the Xone was muted.
- 679f8db: iPad polish.
  - The lesson coach floats on touch screens, so the panel keeps the full width (Sub 37 at 86%, was about 58%).
  - Toolbar buttons are 44 px on touch.
  - MIDI loads after first paint (`lib/midi/lite.ts`): first-load JS 216 → **195 kB**.
  - Idle prefetch of the studio view, coach and lesson browser.
  - Meters no longer use `will-change`.
  - Audio input lists the Xone channels.
  - Verified: gear e2e 31/31, e2e 33/33.
- 0474376: saved-settings upgrades now restore the **old defaults** of controls a save never touched, before converting. Saves keep only touched controls, so default changes used to leak in: an untouched DFAM VCO 2 went silent and TEMPO ran 4× fast.
- 8035392: merged **Sub 37** (QA 0/64, lessons 20/20, check 14/14). Upgrade store v7 covers the arp, KB CTRL and drones, the key-tracking re-pivot, the mod-bus mapping and glide.
- 33acba0: merged **Analog Four MKII** (QA 0/47, lessons 20/20). Every A4 parameter was redefined (about 500 ids), so **old A4 settings start fresh** on the new defaults and demo song, by design.
- 7289210: completed lessons carry over to their rebuilt successors (Sub 37, then Mother-32 and Subharmonicon). Checked in e2e.
- 2a41240: merged **Mother-32** (QA 0/43 for keys and transport, lessons 19/19, check 18/18). Upgrade store v8 covers the flipped switches, VCF MOD amount and polarity, ranges, per-step gates and the old default sequence.
- 9e75bfa: merged the **DFAM review** (QA 0/40, lessons 20/20, 0 manual). Upgrade store v9: untouched SEQ PITCH MOD keeps VCO 1&2. The audio-QA click threshold for the DFAM is 2, for its lo-fi crackle.
- 7a606eb: merged **Subharmonicon** (QA 0/36 for audition and transport, lessons 20/20, in-app check passing). Upgrade store v10 covers TEMPO 240, EG AMT ×0.625 and the 5 ms decay floor.
- c05786b: merged **Analog Rytm MKII** (QA 0/20 for audition and transport, lessons 20/20, in-app check 29/29). 391 of 421 ids were replaced, so **old Rytm settings start fresh** by design; completed rytm-* lessons carry over. Upgrade store v11. **All seven instrument rebuilds are now merged.**
- Smoke test fix: buttons that a paged panel removed are skipped after 1 s; the Rytm smoke went from 498 s to 34 s (the app was never slow, at 67–125 ms per press).
## 2. In progress (each on `wip/<name>`, not merged)

| Branch | What | Checkpoint |
|---|---|---|
| `wip/demo-tracks` | The three designed songs ("Low Tide Lights", "Three Clocks", "Copper Wire") as one-click studios | 0876305 |
| `wip/producer-path-2` | The remaining Producer path lessons (Elektron and Sub 37 tracks), Elektron pattern swing, and lesson solutions for routes, the arranger and rack counts (0 manual steps left on the Xone, A4 and audio-in; 1 on Your synth, where MIDI learn needs a real controller) | 867e6fc |
| `wip/perf-analog-four` | Analog Four DSP performance pass, null-tested against the current sound | — |

Each merges through the gate below. Before merging, run `defaults-tool/diff.sh <device> HEAD origin/wip/<branch>` (in the scratchpad) to find changed defaults and removed ids, then add an upgrade entry.

## 3. Merge gate (run for every merge)

1. `git merge --no-ff wip/<name>`, then `npx tsc --noEmit -p .`, `npm run lint` and `npm run validate`, which must give 0 errors.
2. Build: `flock /tmp/synth-studio-build.lock env NODE_OPTIONS=--max-old-space-size=1536 npm run build`.
3. Start the server with `npx next start -p 3100`, then run:
   - `node scripts/e2e/run.cjs http://localhost:3100` (all pass; add `--full` at milestones)
   - `node scripts/lesson-runner.cjs http://localhost:3100 <device>` (0 failed)
   - `node scripts/audio-qa.cjs http://localhost:3100 <device> --target -18 --suggest` (exit 0)
4. Read the desktop and iPad screenshots against `devices/<id>/REFERENCE.md` and `docs/research/<id>/`.
5. Push. Vercel builds a preview per push.

### Saved-settings upgrades so far (`lib/studio/upgrades.ts`)

| Store / project | Instrument | What it converts |
|---|---|---|
| 5 / 2 | DFAM | TEMPO ÷ 4 (it became 16th-note BPM) |
| 6 / 3 | Xone:96 | MASTER/BOOTH law, crossfader curve, per-channel PRE, sends × 0.707 |
| 7 / 4 | Sub 37 | Arp, KB CTRL and duo, key-tracking pivot, mod-bus mapping, glide |
| 7 / 4 | Analog Four | Clean reset (about 500 ids redefined) |
| 8 / 5 | Mother-32 | Flipped switches, VCF MOD amount and polarity, ranges, per-step gate |
| 9 / 6 | DFAM | Untouched SEQ PITCH MOD keeps VCO 1&2 |
| 10 / 7 | Subharmonicon | TEMPO default, EG AMT × 0.625, 5 ms decay floor |
| 11 / 8 | Analog Rytm | Clean reset (391 of 421 ids replaced) |
| 12 / 9 | Mother-32 | Untouched DECAY keeps 60 ms; times under 10 ms clamp |

Lesson renames carry completions over at store 7 (Sub 37), 8 (Mother-32), 10 (Subharmonicon) and 11 (Analog Rytm). **Next free versions: store 13, project 10.**

## 4. Follow-ups (owner: integrator)

- **Lesson solution API**: add `route` and `arranger` fields, so the lesson runner can solve the Xone routing challenges (st1–st3, 4 manual steps) and the Analog Four song step (st2, 2 manual steps) by itself.
- **Shared controls**, raised by several reviews:
  - a cap variant in `components/controls/Knob.tsx` (the A4 restyles its caps with a scoped stylesheet)
  - a legend-above/below option in `components/controls/Switch.tsx` (Mother-32)
- **Studio sets** (`lib/studio/sets.ts`): the Moog sets would start at the guide's level with the Mother-32 and Subharmonicon about 5 dB down.
- **Full-track gaps on the A4**: POLY, a kit per pattern, separate track outputs, live recording of knob moves, TRANSPOSABLE, and trig/page/sound copy.
- Mother-32: with a clock in TEMPO the knob shows CLOCK DIV; the engine already ignores it, so only the display is off.
- Regenerate `docs/audio-qa-baseline/` for every instrument.
- StudioView: hide "Output" for Your synth when it has no audio. `hub.push()` should apply data before values.
- Optional "Hardware synth" studio set (Your synth + Audio input + Xone:96).
- Delete the `wip/*` branches after their work is merged (ask first).
- **To confirm on real hardware** (each review lists its own; the main ones):
  - A4: the FRQ-to-Hz law, envelope times, BND and DET scales, accent depth and FDB loop gain
  - Mother-32: DECAY at noon and 11 o'clock, the HI PASS slope, LIN FM depth and the mixer's AC-coupling corner
  - Xone:96: the filter's FREQ range (the guide's text and graph disagree)

## 5. Safari / iPad audit

The full report is `docs/research/safari-audit/report.md`. On iPad, test over HTTPS (the Vercel preview): on plain `http://` there is no AudioWorklet, so no sound.

## 6. Resuming in a new session

1. Re-upload the manuals. They were only in the old container's scratch space, never committed (copyright).
   - Elektron: A4 MKII OS 1.55; Rytm MKII OS 1.72.
   - Allen & Heath: Xone:96 guide, block diagram, spec sheet.
   - Moog: Sub 37 / Subsequent 37 manuals and preset lists; Mother-32, Subharmonicon (+ Patching with Intention, Exploration Patchbook), DFAM (+ Electronicus).
   - Extract them outside the repo.
2. Check out the working branch. For each branch in section 2: finish it on its branch, run the gate, and merge.
3. Follow `docs/research/COPYRIGHT-RULES.md` for anything drawn from the manuals.
