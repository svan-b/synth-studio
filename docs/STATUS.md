# Synth Studio: status and next actions (parked 2026-10-29)

Working branch: `claude/dfam-documentation-review-iYhxN` (PR #54). Everything below
marked **merged** is on this branch, built and verified. Everything marked **WIP** is on
its own `wip/*` branch on GitHub, committed but **not yet merged or browser-verified**.

## 1. Merged and verified on the working branch

| What | Notes |
|---|---|
| Studio v2 | Rack, cables, routing, sync, arranger, recorder, projects, Review, lesson coach v2 |
| Stale-module fix | `useDeviceModule` reads the hub cache on every render, so switching never pairs one instrument's layout with another's data |
| 60 ms minimum note gate | A quick tap on an on-screen key always sounds |
| DFAM rebuild | Hardware-accurate single-worklet engine, 38 presets, 20 v2 lessons |
| Play starts clocked gear | The studio ▶ presses RUN on every unsynced instrument, cable-clocked ones included, before the clock starts |
| Saved-settings upgrades | `lib/studio/upgrades.ts`: store v5 / project v2. First entry: DFAM TEMPO ÷ 4 (it became 16th-note BPM) |
| DSP core v2 | Band-limited VCO, 2× ladder, DAHDSR env, SVF, Reverb2 (FDN), Chorus. `/bench` page; see `docs/DSP.md` |
| Elektron sequencer library + UI kit | `docs/ELEKTRON_SEQUENCER.md` |
| Bring your own gear | Web MIDI, Practice synth (works on iPad without hardware), audio input, Web Audio plugins, 16 lessons, Safari guidance. See `docs/EXTERNAL_GEAR.md` |
| Audio QA tool | `scripts/audio-qa.cjs`, see `docs/AUDIO_QA.md`: LUFS, true peak, DC, clicks, stuck tails per preset. Baseline in `docs/audio-qa-baseline/` |
| E2E regression suite | `npm run test:e2e` (scripts/e2e/run.cjs), 23 checks. `--full` adds smoke and lessons for every instrument: 70/70 at last full run |
| Validator lesson checks | Challenges need a solution and hints; lesson ids follow `<device>-`; v2 lessons need a path |
| iPad home-screen install | Manifest (standalone), icons, Apple web-app meta |
| Research notes | `docs/research/<device>/` (sources, signal-flow, presets, lessons) from the official manuals, in our own words. See `docs/research/COPYRIGHT-RULES.md` |

## Live log (session 2, 2026-10-29)

- 19c9d56: merged `wip/elektron-sequencer` (library: 225/225 tests). A finisher is adding the UI kit and docs.
- 89ed17f: merged `wip/studio`: clean master, −1 dBTP limiter, LUFS meters, mixer, undo, stems. The iPad audio-input capture-count contract is now complete on both sides.
- 01a09bc: merged `wip/panel-teaching`. The `store/studio.ts` import conflict was resolved by keeping both sides. tsc, lint and validate are clean; build OK; **e2e 23/23**. First-load JS is now **242 kB**: lazy-loading is a priority follow-up.
- Full run on 01a09bc: **73/73**, covering every instrument's smoke test and lessons plus the 23 core checks.
- 6fca612: the studio view, coach, lesson browser, review and welcome now load on demand; first-load JS **242 → 215 kB**; e2e 23/23.
- 20480ee: README rewritten for the studio, your own gear, learning, tests and the iPad install.
- 32abdc4: merged the sequencer **UI kit** and manual-cited docs (233 tests; e2e 23/23). It adds trig-mute, swing and solo modes, `stampDefaults`, PLAY→pause `TransportKeys`, SAVE/RELOAD/undo, TEMP JUMP arm, chain rows in songs and the lock budget. The A4 and Rytm finishers are told to adopt them.
- Nine finishers are working on their `wip/*` branches and push there after each milestone: analog-four, analog-rytm, xone96, mother32, subharmonicon, sub37, elektron-sequencer (UI kit), dfam-review (verification), panel-teaching (touch e2e and perf). Each merges 01a09bc before its final gate.
- **Next:** merge each finisher as it passes the gate (section 3). Then add upgrades.ts entries, run audio QA for every instrument, implement the producer path and demo tracks, run independent reviews, do and lazy-load the MIDI code in DeviceHost.

## 2. Work in progress (each on `wip/<name>`, not merged)

Merge each in this order, with the gate in section 3. Bases: most were branched from `ec79288`. Panel/teaching started from `ec79288`, the sequencer from `89801d8` and DFAM-review from `cfed080`.

| Branch | Done | Left | Known breakage / risk |
|---|---|---|---|
| `wip/elektron-sequencer` (698d3f1) | Library checked against both manuals; 225/225 tests; Safari: hidden-page look-ahead 1.8 s, `WebkitUserSelect` | UI kit additions (TrigKeys modes, trig mute, SAVE/RELOAD, song chain rows); manual-cited docs; lint, validate, build | Changed behaviour: `!PRE`/`!NEI`, swing trigs, master change OFF by default, songs stop at end (`song.loop=false`), TEMP JUMP. **Merge before the A4 and Rytm** |
| `wip/panel-teaching` (f8b7751) | Memoised panel (no re-render storm), legibility (9/10 px minimum, Roboto Condensed stands in for Arial Narrow), touch fine-adjust, value bubble, status strip, coach v3 (A/B, Show me, summary), spectrum scope, `s.events`/`s.notesPlayed`, review-queue pruning | Touch e2e tests; perf before/after; iPad coach docking (wide panels drop to ~58%) | Final commit not built or run in a browser (CSS module → JS style module change). Validate's fake state needs `events: {}`, `notesPlayed: []` |
| `wip/studio` (eb2aa1f, final) | Clean unity master and true-peak limiter (−1 dBTP, 1.5 ms; Breakbeat +2.5 → −1.02 dBTP), BS.1770 LUFS meters (−14 tone reads −13.99), mixer strips (fader/pan/mute/solo/sends to tempo delay and Reverb2), undo/redo (`lib/studio/history.ts`), stems, bounce song, −14 LUFS normalise, count-in, loop, latency popover, 5-stage build paths (Elektron, Moog), and the Safari items B1, M1, M2 (store written at most every 600 ms, plus a storage-full message), M4–M7, m1, m4, m9–m12, n3, n7 | Smoke for every device on the final build (only the Rytm was re-run); review the final Studio desktop and iPad screenshots; a /bench scenario for the master | None known. tsc, lint, build, validate, journey, studio-test, upgrade-e2e and lesson runners for dfam and sub37 all pass. New optional state `studio.mixer`/`metronome` (no upgrade needed). Instrument trims stay at unity, so instruments must reach −18 LUFS at the source |
| `wip/dfam-review` (f8156d9) | Output limiter (was +6.8 dBFS), panel geometry from the manual drawing, presets from the manual patch sheets (10), HP self-oscillation at ~1 kHz, sequencer self-patch timing, no allocations per quantum. See `devices/dfam/REVIEW.md` | Build; smoke, e2e, lesson runner; audio QA `--target -18`; REFERENCE.md page cites | Preset loudness not yet measured with audio QA (spiky drum presets may flag) |
| `wip/analog-four` (c73095c) | Manual pass: panel geometry from the manual, NOTE retrig, arp per pattern, signed PW, octaves −5..+5, STOP/STOP-STOP behaviour, demo pattern per preset | Audio QA at −18; smoke, lesson runner, a4check, screenshots; REFERENCE.md cites; ARP label TRU→THR (p.43) | Stop/fade, audition and demo-pattern changes never run in a browser |
| `wip/analog-rytm` (db74bac) | SRC pages match the manual for all machines; voice sharing (right-hand track wins); SMPL/LFO/FX details; FX track level; panel keys per manual | **Kit loudness calibration** (−18 LUFS, ≤ −1 dBTP); comp settings for kits 01/02; REFERENCE.md; **20 lessons (lessons.ts empty)**; all checks | Kit levels uncalibrated (voice gain changed to 0.55, unmeasured) |
| `wip/xone96` (e97f252) | Follows the official block diagram: VCA channel, post-VCA filter buses, CRUNCH, measured fader/crossfader curves, Q to the +7.6 dB WILD spec, A/B clean feed, PK!, MASTER 2, PHONES 2, ADD MIX, LATCH CUE; 21 presets | Restore the original 11 lesson ids (progress); fix stale lesson facts; REFERENCE.md; build, smoke, lessons, audio QA (shorten FX tails), unity check, screenshots | Layout not visually checked; levels not measured. **Upgrade entries needed** (see below) |
| `wip/mother32` (eeb2f62) | Rebuilt to the v2 manual: sequencer (pause, swing, 24 divisions, directions, ratchet, delay pattern change), manual ±5 V ASSIGN ranges, AC-coupled mixer, HP peaking, 43 presets including the 9 manual sheets, 19 lessons | Lesson f6 (new Record behaviour); REFERENCE.md; lint, build, smoke, lessons, Playwright, screenshots, bench, audio QA (keys and transport) | f6 likely fails in the lesson runner; nothing browser-checked since the rewrite |
| `wip/subharmonicon` (5abb208) | One-worklet engine, 21 patch sheets read (in `devices/subharmonicon/wip/`), trigger/held/PWM/SEQ ASSIGN fixes, clock counted in the worklet, DC blocker and soft output | TEMPO linear in spec; held-mode controls; Safari items; layout details; presets.ts from readings; **v2 lessons**; REFERENCE.md; all checks; remove `wip/` notes folder | lessons.ts still v1; studio sync untested; levels uncalibrated |
| `wip/sub37` (91434b2) | Rewritten to the Subsequent 37 manual: worklet, model, engine, spec, arp, new 64-step seq, 64 presets, panel (Safari fixes) | **index.ts** (uiControls, `studio.midiSync`, audition, interceptChange); **v2 lessons**; REFERENCE.md; all checks | **Not compiled since the rewrite**: lessons.ts uses old ids, so validate/tsc will fail until replaced. `scripts/checks/sub37.cjs` expects old preset names |

### Saved-settings upgrades to add when merging (`lib/studio/upgrades.ts`)

- **Xone:96**
  - master/booth unity moved to 8: `v = 8·(v/7.5)^0.644`
  - xf_curve option 1 DIPPED → TRANSITION: map 1 → 0
  - `send1_pre` → per-channel `ch*_pre`; `cha_xf`/`chb_xf` removed
  - snd1/snd2 max +6 dB: `v = 0.707·v`
  - phones range 0–11
- **Sub 37**
  - `arp_mode` → `arp_pattern`
  - `arp_range` → `arp_oct_range` (5 → 7 states; 0 is now index 3)
  - `osc2_kb_ctrl` → `kb_ctrl` (3 states)
  - filter/env `kb_amt` 0–100 → 0–200 (100 = 1:1)
  - `arp_sync` default false
  - PGM_DESTS indices are new
- **DFAM review:** none needed.

## 3. Merge gate (run for every merge)

1. `git merge --no-ff wip/<name>`, then `npx tsc --noEmit -p .` and `npm run validate`, which must give 0 errors.
2. Build: `flock /tmp/synth-studio-build.lock env NODE_OPTIONS=--max-old-space-size=2048 npx next build`.
3. Start the server with `npx next start -p 3100`, then run:
   - `node scripts/e2e/run.cjs http://localhost:3100 --full` (all pass)
   - `node scripts/audio-qa.cjs http://localhost:3100 <device> --target -18 --suggest` (exit 0)
4. Read the desktop and iPad screenshots against `devices/<id>/REFERENCE.md` and `docs/research/<id>/`.
5. Push. Vercel builds a preview per push.

## 4. Cross-cutting follow-ups (owner: integrator)

- Audio-input contract `globalThis.__synthCaptureCount`: the gear side is merged and the studio side is in `wip/studio`. After merging both, verify on iPad that recording keeps the play-and-record session.
- `scripts/validate-devices.ts` fake state: add `events: {}`, `notesPlayed: []`, needed for panel-teaching.
- `components/sequencer/*`: add `WebkitUserSelect` (done in wip/elektron-sequencer).
- iPad: dock or stack the lesson coach for wide panels (`app/page.tsx`).
- StudioView: hide "Output" for Your synth (no audio). DeviceHost toolbar buttons to 44 px. `hub.push()` must apply data before values.
- Optional "Hardware synth" studio set (Your synth + Audio input + Xone:96).
- First-load JS is 181 kB: lazy-load the MIDI and gear code.
- After the device merges:
  - run audio QA for every instrument at `--target -18`
  - an independent manual-based review per instrument (the DFAM one is done)
  - implement the **producer path** (`docs/research/producer-path/curriculum.md`, 15 lessons) and the **three demo tracks** (`demo-tracks.md`: "Low Tide Lights", "Three Clocks", "Copper Wire"). They need the engine hooks listed in curriculum §7.
- Rewrite the README for the studio, gear, tests and install.
- Delete the `wip/*` branches after their work is merged.

## 5. Safari / iPad audit

The full report is `docs/research/safari-audit/report.md`. Each item is routed to an owner in the table above. On iPad, test over HTTPS (the Vercel preview): on plain `http://` there is no AudioWorklet, so no sound.

## 6. Resuming in a new session

1. Re-upload the manuals. They were only in the old container's scratch space, never committed (copyright).
   - Elektron: A4 MKII OS 1.55; Rytm MKII OS 1.72.
   - Allen & Heath: Xone:96 guide, block diagram, spec sheet.
   - Moog: Sub 37 / Subsequent 37 manuals and preset lists; Mother-32, Subharmonicon (+ Patching with Intention, Exploration Patchbook), DFAM (+ Electronicus).
   - Extract them outside the repo.
2. Check out the working branch, then for each `wip/*` branch in the order above: finish its "Left" column on a branch, run the gate, and merge.
3. Follow `docs/research/COPYRIGHT-RULES.md` for anything drawn from the manuals.
