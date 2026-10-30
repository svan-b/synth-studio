# Synth Studio: status and next actions (updated 2026-10-29, everything merged)

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
| Producer path | Lesson API v3 studio state (whole-studio starts, saved learner studios, loudness-matched A/B, master/channel meters, bounces, mixer and arranger checks, pattern SWING) and all 15 Producer path lessons, from a first beat to a mastered, bounced track. See "Lesson API v3" in `docs/PEDAGOGY.md` |
| Clock chip | Every instrument that can follow the studio clock shows **Clock: studio / own tempo** above its panel. One tap lets a patch sheet play at its drawn TEMPO |
| Stale-module fix | `useDeviceModule` reads the hub cache on every render, so switching never pairs one instrument's layout with another's data |
| 60 ms minimum note gate | A quick tap on an on-screen key always sounds |
| Play starts clocked gear | The studio ▶ presses RUN on every unsynced instrument, cable-clocked ones included, before the clock starts |
| Saved-settings upgrades | `lib/studio/upgrades.ts`: store v12 / project v9. Untouched controls keep their old defaults; completed lessons carry over to rebuilt successors; settings no conversion can carry are kept and offered as a file. Table in section 3 |
| DSP core v2 | Band-limited VCO, 2× ladder, DAHDSR env, SVF, Reverb2 (FDN), Chorus. `/bench` page; see `docs/DSP.md` |
| Elektron sequencer library + UI kit | `docs/ELEKTRON_SEQUENCER.md` (233 tests) |
| Bring your own gear | Web MIDI, Practice synth (works on iPad without hardware), audio input, Web Audio plugins, 16 lessons, Safari guidance. See `docs/EXTERNAL_GEAR.md` |
| Audio QA tool | `scripts/audio-qa.cjs`, see `docs/AUDIO_QA.md`: LUFS, true peak, DC, clicks, stuck tails per preset. Baseline regenerated at aa0a41a: 271 presets on 7 instruments, medians −18.0 to −19.1 LUFS, 2 intermittent click flags (each clean in 4 of 4 re-runs) |
| E2E regression suite | `npm run test:e2e` (scripts/e2e/run.cjs): the core checks, both iPad Producer walkthroughs and the demo recordings. `--demos` adds the three demo tracks in real time; `--full` adds those plus smoke and lessons for every instrument: **138/138** at the final run |
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
- a7e1e07: merged the **complete Producer path** (15 lessons).
  - New: First beat, Groove, Bass locked to the kick, Chords and pads, A hook, Movement and the Capstone, on the Rytm, Analog Four and Sub 37 into the Xone:96.
  - Listen and match steps can set Elektron pattern SWING.
  - Lesson solutions can set routes, the arranger and rack counts. Manual steps left: Xone 0 (was 4), A4 0 (2), Rytm 0 (1), audio input 0 (3), Your synth 1 (MIDI learn needs a real controller), and studio-5 2.
  - In Producer lessons the app follows the step's instrument. The iPad coach picks the corner that hides least of the step's highlight, replacing the left/right version.
  - A second iPad walkthrough (First beat by touch, Groove's SWING) joins the gate: **e2e 38/38**.
  - 2c697b7: merged the **three demo tracks**: Low Tide Lights, Three Clocks and Copper Wire.
  - Each is a one-tap studio: rack, cables, routes, sync, sounds, patterns, mix, master and arrangement.
  - The studio view's Demo tracks section has Play and Load and a live caption with the section, bar and teaching note; Welcome offers "Play a demo track".
  - Bounces: −10.9 / −13.4 / −10.7 LUFS, each at −1.0 dBTP. No instrument or Xone channel clips.
  - Gate: e2e with `--demos` **80/80** (38 core + 42 demo checks).
  - Its agent is now lining up the Elektron sets and "The whole studio" (the Rytm runs about +6 into the Xone; that set's LR MIX lit PK! half the time).
- b27e315: merged the **Analog Four performance pass**: 8.3× → 13.9× realtime on /bench (1.68×), bit-identical output in 163 of 163 null-test renders.
  - The idle-voice FREE-LFO bug it found (the LFOs of a silent voice stood still) is fixed in its own commit.
- d09fdd6: merged the **studio set line-up**.
  - Since its review, the Rytm arrived at the Xone about +6 average / +10 peak, so every Elektron set lit the LR MIX PK! nearly all the time.
  - Measured per-instrument `LINE_UP` levels plus a per-set `SET_TRIM` keep it dark: 0 lit polls in about 1000 over 64 s, for every set.
- Xone make-up (`XONE_MAKEUP` in `lib/studio/sets.ts`).
  - The line-up cost the studio master 1–7 dB: the welcome's "Build a full track" fell to −25.2 LUFS.
  - Each mixer set now sets the Xone's own studio strip, which sits after the LR MIX meters like its MASTER. Measured, all nine sets play at −17.8 to −19.2 LUFS, like an instrument on its own.
  - The limiter touches only the Rytm's sharpest transients in Elektron stages 3–4 (at most 2.2 dB).
- 04019ab: merged **shared FX idling**.
  - The shared chorus skips its work on silence and stays bit-identical (756/756 lockstep runs, 163/163 A4 renders).
  - With no send it idles in every quantum of the A4's /bench demo: 0.57 % → 0.15 % of a core.
  - The FDN reverb already idled below about −131 dBFS. Idling it earlier would shift its modulation phase audibly, so it is unchanged.
- d050c81: merged **demo excerpts**.
  - The Producer path's `info.play` (L1, L3, L4, L5, L6, L8, L12, L15) and `listen.demo` (L2, L7, L9, L11, L13, L14) play pre-rendered recordings of the demos: 16 excerpts and 3 full songs, AAC in `public/demos` (8.85 MB, with a manifest).
  - The studio is never swapped mid-lesson. It keeps running and metering, held back from the speakers only while a recording plays. Every way playback can end unmutes it.
  - Demo cards have Listen, which plays the recording without loading the studio.
  - `scripts/render-demos.cjs` re-renders the recordings after an instrument changes (see `docs/AUDIO_QA.md`).
  - Not tested here: AAC decoding in Safari and Chrome. Playwright's Chromium can't decode AAC, so the tests decode the same files to WAV.
- **Final gate on d050c81** (everything merged): `run.cjs --full` **138/138**.
  - Covers smoke and every lesson for every instrument, the three real-time demo tracks, the demo recordings, both iPad Producer walkthroughs and the core checks.
  - Studio lessons: 20, 0 failed (2 manual steps in studio-5).
  - Audio-QA baseline at aa0a41a: 271 presets, medians −18.0 to −19.1 LUFS.
- 40d0857: **separate outputs**, studio side.
  - An instrument declares `studio.outputs` and implements `connectOutput(id, dest | null)`; the learner turns them on in the instrument strip's Outs menu.
  - Each output becomes its own channel `<instance>/<id>`: fader, pan, sends, mute, solo, meter, route, stem and a map arrow. Arranger mutes follow the instrument.
  - Checked with a stand-in output (`scripts/e2e/outputs.cjs`; e2e 47/47).
  - The Rytm's eight TRACK OUTs and the A4's four stereo track outputs come after their feature branches merge. Each will act as "cable in the TRACK OUT, route-to-main off" (manuals: Rytm ROUTE TO MAIN, A4 VOICE ROUTING).
- **Rytm separate outputs**: the eight TRACK OUTs (BD, SD, RS/CP, BT, LT, MT/HT, CH/OH, CY/CB) in the mixer's Outs menu.
  - A voice with its own output plays there (mono, after its level) and leaves the main mix and the master effects; its delay and reverb sends stay.
  - Its channel starts at the Rytm's fader and route, so turning it on changes nothing until you move it.
  - The main output is bit-identical with no output on (21/21). `outputs-rytm.cjs` checks that the kick leaves the main channel and comes back. e2e 48/48.
- c3f2f9e: merged the **Rytm full-track features**.
  - Live recording of parameter locks (pp.40-41), and the sound pool and sound locks (p.48).
  - The Euclidean sequencer (p.44), chromatic play from keys and studio MIDI (pp.19, 22-23), and step recording.
  - User samples: WAV or AIFF from the file picker, stored in IndexedDB, falling back to the built-in one-shot when missing.
  - Two new lessons; `scripts/test-rytm.ts` has 47 checks. With the features off the output is bit-identical (21/21), and CPU is unchanged.
  - Gate: lessons 22, 0 failed, 0 manual; QA 0/20 in both modes; e2e 47/47; touch monkey test 578 actions, 0 errors.
  - Known gap: user samples don't travel in exported project files yet.
- Panel fidelity, Moog toggles. A new opt-in `legends: 'ends'` on the shared switch puts the first position above the lever and the last below, as Moog prints them.
  - 3223ae2: on the Mother-32 (p.9).
  - 819f38c: on the DFAM (p.7), including the three-way SEQ PITCH MOD with OFF beside.
  - The Subharmonicon keeps its own glyph layout: its VCO WAVE middle legends are mirrored, left on VCO 1 and right on VCO 2.
- baa7ed1: the Mother-32's TEMPO stays TEMPO when a SINGLE CLOCK ADVANCE clock ignores it (p.55); only an ANALOG CLOCK or the studio's MIDI clock make it the clock division.
- **Monkey tests** (`scripts/e2e/monkey.cjs`, `studio-monkey.cjs`, `run.cjs --monkey`): seeded random use.
  - Every instrument, mouse and touch: about 6,700 actions, 0 page errors.
  - The studio (tabs, instruments, sets, transport, mixer, routes, undo, lessons): about 900 actions, 0 page errors.
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
## 2. In progress

- `wip/a4-tracks`: Analog Four POLY and chords, live knob-lock recording, step recording, trig and page copy, TRANSPOSABLE and kit per pattern.

Earlier work: nothing else in progress. All 22 `wip/*` branches on GitHub are fully merged into the working branch (checked with `git merge-base --is-ancestor`), so they can be deleted once the user agrees:
`analog-four`, `analog-rytm`, `demo-excerpts`, `demo-tracks`, `dfam-review`, `elektron-sequencer`, `mother32`, `panel-teaching`, `perf-analog-four`, `perf-shared-fx`, `producer-path`, `producer-path-2`, `review-analog-four`, `review-analog-rytm`, `review-mother32`, `review-sub37`, `review-subharmonicon`, `review-xone96`, `studio`, `sub37`, `subharmonicon`, `xone96`.

New work merges through the gate below. Before merging an instrument change, compare `specDefaults(<device>)` at both commits to find changed defaults and removed ids, then add an upgrade entry.

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

- **Shared controls**: a cap variant in `components/controls/Knob.tsx` (the A4 restyles its caps with a scoped stylesheet).
- **Full-track gaps on the A4**: POLY, a kit per pattern, separate track outputs, live recording of knob moves, TRANSPOSABLE, and trig/page/sound copy.
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
