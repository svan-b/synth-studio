# Demo recordings

The three demo tracks (Low Tide Lights, Three Clocks and Copper Wire, `lib/studio/demos`) are
complete studios: loading one replaces the learner's studio. The Producer path's hooks and the
demo cards play **recordings** of them instead, so a lesson never swaps studios under the
learner (autosave, undo and the lesson checks never see a demo) and an older iPad doesn't have
to run every instrument to hear one.

| What | Where |
|---|---|
| The files: AAC-LC `.m4a`, excerpts at 128 kbps, the full songs at 96 kbps | `public/demos/` (budget 10 MB) |
| What each file is: demo, bars, variation, what changed, length, loudness, true peak, size | `public/demos/manifest.json` |
| Which excerpts and variations exist, and how each variation is set up | `scripts/render-demos.cjs` (`EXCERPTS`, `VARIATIONS`) |
| The player: fetch, decode, trim, A/B, stop | `lib/studio/demoAudio.ts` (manifest lookups in `lib/studio/demos/recordings.ts`) |
| The lesson fields `info.play` and `listen.demo` | `docs/PEDAGOGY.md`, "Lesson API v3: demo recordings" |
| The coach's controls and the cards' Listen | `components/teaching/DemoClips.tsx`, `components/studio/StudioSets.tsx` |

## How they are made

`scripts/render-demos.cjs` drives the real app in headless Chromium. For each variation it loads
the demo from the studio's Demo tracks, sets the variation up (an instrument muted, a pattern
setting, a level: changes to that page's studio only, never to the demo's definition), and
bounces the song from bar 1 with the studio's own Bounce dialog (`lib/studio/bounce.ts`). A
variation's song ends a bar after its excerpt, so it renders in under two minutes. While it
renders, the transport schedules 0.5 s ahead (as on a hidden iPad page), and the script logs
every tick: a render in which a tick went out late, because the machine stalled the page, is done
again.

Then ffmpeg cuts each excerpt exactly on its bar lines (no fade in, so an A/B loops onto a whole
downbeat; the player fades a first start in over 4 ms), with the next bar fading out over 0.8 s
after the loop an A/B plays, encodes it 3 dB down (AAC overshoots the −1 dBTP masters on
transients), and measures each file as it decodes: integrated
loudness over the excerpt's bars (BS.1770, ffmpeg's EBU R128 scanner) and true peak. The player
trims every recording to about the loudness the learner's studio plays at (its master meter;
−20 LUFS before it has played), never above −1 dBTP, and plays both sides of an A/B at the same
loudness from those measurements.

## Re-rendering

Render again after anything that changes how a demo sounds: an instrument's DSP or sounds, the
mixer or the master, the Xone:96, the sequencers, the bounce, or a demo's own definition.

```bash
npm run build && npx next start -p 3100
node scripts/render-demos.cjs http://localhost:3100            # every render, about 20 minutes
node scripts/render-demos.cjs http://localhost:3100 --only ltl,ltl-drums   # just these renders
node scripts/render-demos.cjs http://localhost:3100 --encode-only          # cut and encode the last renders again
npm run validate                                                # every lesson's reference, the files, the budget
```

Renders are kept as WAVs in `$TMPDIR/synth-demo-renders` (`--wav <dir>` to choose), so
`--only` re-renders some and `--encode-only` re-encodes all without playing anything. The script
prints each file's length, loudness, peak and size, and fails if `public/demos` goes over 10 MB.
Listen to the A/B pairs after a change: both sides must still differ only in what the variation
says.

**Adding an excerpt.** Add it to `EXCERPTS` (or a variation to `VARIATIONS`) in the render
script, render, and use it in a lesson. `npm run validate` checks both ways: an error for a
reference the manifest doesn't have, a warning for a recording no lesson plays.

**Testing.** Playwright's Chromium is built without proprietary codecs and can't decode AAC, so
the lesson runner and the e2e tests answer the app's requests for `/demos/*.m4a` with the same
recordings decoded to WAV by ffmpeg (`scripts/e2e/demoRecordings.cjs`); with a browser that
decodes AAC, set `SYNTH_DEMO_AAC=1` to serve the files as they are. `scripts/e2e/demo-audio.cjs`
checks a hook's level and that it stops, a demo A/B's loudness match over a playing studio, and
the cards' Listen.
