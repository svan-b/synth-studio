# Audio QA

`scripts/audio-qa.cjs` plays every preset of every instrument in the real app (a production build in headless Chromium) and measures what comes out. It is the loudness calibration and release gate for the instrument rebuilds: presets must be loudness-consistent, and none may clip, carry DC, click, stay silent, leave a note stuck or log errors.

It works for any device module, including ones added later. It reads the device list from `devices/index.ts`, and each module's `spec.presets`, `audition`, `keyboard` and `transportControl`. There is nothing to register.

## Quick start

```
flock /tmp/synth-studio-build.lock env NODE_OPTIONS=--max-old-space-size=1536 npm run build
npx next start -p 3129 &

node scripts/audio-qa.cjs http://localhost:3129 all --out /tmp/audio-qa         # everything, about 12 min
node scripts/audio-qa.cjs http://localhost:3129 dfam --presets '^kick' --suggest  # some DFAM kicks, with gain suggestions
node scripts/audio-qa.cjs --from docs/audio-qa-baseline --suggest                 # re-read saved reports, no browser
node scripts/audio-qa.cjs --selftest                                              # check the meters on synthetic signals
node scripts/audio-qa.cjs http://localhost:3129 dfam --calibrate                  # only the in-page meter calibration

fuser -k 3129/tcp
```

Each preset takes about 7.5 s: realtime capture of 0.25 s pre-roll, 4 s of playing and a 2.5 s tail, plus the wait for silence. Devices run one after another, each in a fresh browser page, with one page reused for all of a device's presets.

| Option | Meaning |
|---|---|
| `<baseUrl>` | Where the app runs, e.g. `http://localhost:3129` |
| `[deviceId\|all]` | One device, a comma list (`dfam,sub37`) or `all` (default). Devices without presets are listed as not measured. |
| `--presets <regex>` | Only presets whose key or name matches (case-insensitive) |
| `--limit N` | Only the first N presets of each device (smoke runs) |
| `--out <dir>` | Report directory (default `$TMPDIR/synth-studio-audio-qa`) |
| `--seconds N` | Playing time before stop (default 4, two bars at 120 BPM) |
| `--bars N` | The same, in bars at 120 BPM |
| `--tail N` | Capture after stop (default 2.5 s; the tail is judged from 2 s after stop) |
| `--excite M` | `auto` (default), `audition`, `keys`, `transport`, or per device: `--excite analog-four=transport,mother32=keys` |
| `--velocity V` | Velocity of the keyboard phrase, 0..1 (default 1, as on-screen keys and the computer keyboard play) |
| `--suggest[=all]` | Print the gain change in dB that brings each loudness outlier (or every preset) to its category target. Nothing is edited. |
| `--target LUFS` | Judge loudness against one absolute target for every device, instead of each device's own median |
| `--config <file>` | JSON overrides for `scripts/audio-qa/config.cjs` (thresholds, categories, per-device settings) |
| `--wav[=all]` | Also write 32-bit float WAVs of flagged (or all) captures to `<out>/wav/<device>/` |
| `--sample-rate N` | Force the AudioContext sample rate. By default it is the browser's: 44.1 kHz in this container. |
| `--fresh` | Do not merge a `--presets` / `--limit` run into the existing device report |
| `--no-calibrate` | Skip the meter calibration at the start of a run |
| `--no-fail` | Exit 0 even when presets are flagged |
| `--headed` | Show the browser |
| `--from <dir\|file>` | Re-evaluate saved JSON reports with the current config, `--target` and `--suggest`. With `--out`, also rewrite the reports there. |
| `--selftest` | Run the metric self-test (no browser) |

Exit codes: 0 means nothing was flagged, 1 means something was flagged (a preset, or errors while the app loaded an instrument), and 2 means a tool error (setup failed, or the calibration failed).

## What happens to each preset

1. **Reset.** The tool calls `hub.stopAudition()` and `hub.stopAll()`, and sends a note off for all 128 notes. It clears the instrument's cables and the studio cables, and returns momentary buttons and the transport control to their defaults. Then it waits until the instrument output stays below -80 dBFS for 250 ms, or settles on a constant idle floor, for at most 5 s. If the previous preset is still sounding at that point, the report says so.
2. **Apply.** The tool picks the preset in the instrument's own preset menu (`[data-instance] select[aria-label="Load preset"]`), so the real `DeviceHost.applyPreset` runs: spec defaults without the transient controls, then the preset settings and its patch cables. If the menu is missing, it replicates that function through `store.loadPreset`. Either way it then checks that the store holds every preset setting and the right number of cables. Mismatches are reported as notes.
3. **Settle.** It waits 400 ms, because engines take messages and some rebuild reverbs.
4. **Capture.** One AudioWorklet node, loaded from a Blob URL so that it does not depend on any app file, records two taps sample-aligned:
   - input 0: the hub slot's `outGain`, which is the instrument's own output before the master bus;
   - input 1: the master output. An init script observes `AudioNode.prototype.connect`, so the tool knows every node the app connects to the `AudioDestination` (today, the master limiter) and taps them all.

   The capture is 0.25 s of pre-roll (the idle level), then the excitation for `--seconds`, then the stop, then `--tail` seconds. The excitation and stop times are marked in the stream itself, to the sample. Notes are timed on the audio clock, not on timers, so every capture has the same length even when the machine is busy.
5. **Analyse.** The float PCM goes to Node, where `scripts/audio-qa/metrics.cjs` measures it.

The init script also wraps `AudioWorkletNode`, to catch `processorerror` (a processor that threw goes silent for good), and records AudioContext state changes. The wrappers only observe: they never change what the app does.

### Excitation

`auto` chooses, in this order:

1. the module's own `audition()` if it has one (DFAM: the sequence from step 1 at its TEMPO), stopped with `hub.stopAudition()`. **Device authors control their instrument's QA excitation by writing an `audition`.**
2. **transport** for registry categories whose presets are patterns or decks (`Groovebox`, `DJ Mixer`; set in `excitation.transportFirstCategories`), when the module has a `transportControl`. This covers the Analog Four MKII, the Analog Rytm MKII and the Xone:96. The Analog Four also maps the computer keyboard, but its keys only play the selected track, so they would not play its presets as a user hears them.
3. **keys**, the standard phrase, if the module has a `keyboard`: C2, C3, G3 and C4 (MIDI 36, 48, 55 and 60) as 375 ms notes every 500 ms, then C3 held from 2 s to the stop, at velocity 1. The held note checks the release tail.
4. **transport** for any other module with a `transportControl`: `hub.startAll()` (the studio Play, at 120 BPM) for `--seconds`, then `hub.stopAll()`.
5. otherwise the hub's default audition.

Mother-32 and Subharmonicon map the keyboard, so they get the phrase. Their sequence presets are then measured as keyboard patches. Run them with `--excite mother32=transport,subharmonicon=transport` to measure the sequences.

## Measurements

The instrument tap is always measured as two channels, exactly as the stereo bus receives it. A mono instrument is up-mixed L = R, like Web Audio's speaker up-mix into the destination. BS.1770 sums the channels, so a mono instrument reads 3 dB above the same signal measured as one channel (as `pyloudnorm` on a mono WAV would measure it). That is what you hear on two speakers, and it keeps mono and stereo instruments comparable.

| Metric | How |
|---|---|
| Integrated loudness (LUFS) | ITU-R BS.1770-4. K-weighting, derived for any sample rate, is identical to the Recommendation's 48 kHz table to 1e-15. Then 400 ms blocks with 75 % overlap, the -70 LKFS absolute gate and the -10 LU relative gate, over the whole capture. |
| Max short-term / momentary | Highest 3 s and 400 ms loudness, every 100 ms |
| Sample peak (dBFS) | max \|x\| |
| True peak (dBTP) | BS.1770-4 Annex 2: 4x oversampling with the Recommendation's 48-tap interpolator, and never below the sample peak |
| Clipping | Samples at or above 0 dBFS, and the number of separate overs (instrument and master) |
| DC offset | \|mean\| per channel over the excitation window, and over the last 0.5 s (DC that stays after release) |
| Crest factor | Peak / RMS per channel over the excitation window (the louder channel) |
| Silence | The whole capture below -70 dBFS |
| Clicks | See below |
| Dropouts | Runs of exact zeros (at least 32 samples, at most 250 ms) with sound above -40 dBFS on both sides. Reported as render errors. |
| Stereo correlation | Over the capture from the excitation on, when the instrument output is stereo. There is also a side/mid width in the JSON. |
| Tail | Peak and RMS from 2 s after stop to the end. Also the decay rate (dB/s, from 1.0-1.5 s to 2.0-2.5 s after stop) and the release time (when the peak stays below -60 dBFS). |
| Errors | Console errors and page errors during the preset, `processorerror`s, NaN or Inf samples, dropouts, AudioContext state changes, and a run that failed |
| Master | Loudness, peaks and clipping of the master tap, and how far it sits from the instrument loudness (master gain, compressor make-up and limiting) |

### Click detection

A click is a step in the waveform's value. A slope change is not a click: an instant VCA attack on a waveform at a steep point, a curving attack or a fast pitch sweep does not count. For every sample the detector extrapolates the signal into a 3-sample gap from both sides, twice: with lines through the 2 samples on each side, and with parabolas through 3.

- **A pair meets in the gap.** The signal only bent there (a corner, curvature, a steep but smooth edge), so that estimate is 0.
- **A pair does not meet.** That estimate is the pair's smallest distance over the gap: the height of the step, also when band-limiting spreads it over 2-3 samples.

The step estimate is the smaller of the two. Parabolas see through a corner into a curving attack, where lines would report a step. Lines stay sane on bright content, where parabolas over-shoot. A real step shows in both.

A step counts as a click when:

- it is above -50 dBFS and above 2 % of the capture's peak;
- the signal is locally straight on both sides (the step is at least 4x the second difference there);
- it is at least 2.5x every other step estimate within ±50 ms, so saw, square and sync edges (which repeat every period, down to 20 Hz), noise and bright transients never count;
- it is at least 10x their RMS.

A second test finds sounds that stop dead: the last 0.5 ms is still within 12 dB of the 5 ms before it, followed by 10 ms below -80 dBFS (a fade shorter than about 1 ms). A 2 ms fade passes. Each click is classified as `onset` (silence before it), `cutoff` (silence after it) or `mid` (inside a sound: glitches, voice steals, parameter steps, dropouts). The report gives the time and size of the first 40.

Measured on 20 real captures (every instrument) with planted defects:

- Cuts to silence were found in 20 of 20, and 128-sample dropouts in 20 of 20.
- Steps at random sounding moments were found almost always in tonal and smooth material (kicks, basses, drones, sustained notes).
- Inside a bright saw, pulse, hat or full drum mix, a step smaller than the waveform's own edges is masked by design. Overall, a -26 dBFS step was found in 221 of 400 placements and a -36 dBFS step in 162 of 400.
- After tuning on the first full runs (instant-attack corners, curving attacks, filter-swept saw edges, a 33 Hz saw, bright rimshot and FM transients), none of 37 clean captures had a false click.

The detector does not find zipper noise (a periodic train of small gain steps) or clicks that a low-pass filter has already rounded off (thumps).

## Flags

Both tail flags enforce the rule that nothing may still sound above -60 dBFS 2 s after stop. They are split so a delay tail is not mistaken for a stuck note. Categories with `sustain` (drones) get a note instead of either.

| Flag | Raised when (default) |
|---|---|
| `errors` | Any console, page or render error during the preset, or the run failed |
| `silent` | The whole capture is below -70 dBFS |
| `true-peak` | The instrument output is above -1 dBTP |
| `stuck-tail` | The tail peak is above -60 dBFS 2 s after stop and is not decaying faster than 6 dB/s: a note, gate or drone is left on |
| `long-tail` | The tail peak is above -60 dBFS 2 s after stop but still decaying faster than 6 dB/s: a long release or an FX (delay, reverb) tail |
| `clicks` | At least one click |
| `dc` | \|DC\| above 0.005, during the excitation or in the tail |
| `loudness` | More than ±4 LU from the preset's category target |

Notes do not gate. They are context for reviewers: the master limiter reduced peaks by X dB, the instrument was already sounding before the excitation, the previous preset was still sounding, the preset turns the transport on by itself, settings differ after loading, the audio ran slower than realtime (CPU contention), and partly out-of-phase stereo.

## Loudness targets

A preset's category is the part of its name before ` / `, which is also how the preset menu groups presets. For example, `Kick / 808 boom` is in Kick. Category rules in `config.cjs` match the category, or the whole name for uncategorised presets:

| Rule | Matches | Target | Tail |
|---|---|---|---|
| FX | fx, sfx, effects, noise hits, textures, glitches, risers, zaps, lasers, bleeps | device median - 4 LU | flagged |
| Drone / ambient | drones, ambient, ambience, atmosphere, soundscape, wind | device median - 3 LU | may sustain |

- **Device median.** The median of the integrated loudness of the presets without a category offset, when there are at least 3 of them. Otherwise it is the median of all measured presets.
- **Preset target.** The device median plus the preset's category offset, with a tolerance of ±4 LU unless the rule sets its own `tolerance`.
- **Absolute target.** `--target -18` replaces the device median with one target for every instrument. Use it to line all instruments up for the master bus.
- **Overrides.** Rules can be overridden per device: `{"devices": {"xone96": {"thresholds": {"loudnessLu": 6}}}}`.

Each device report has a per-category table: the target, median, range and spread, and how far the category sits from the device median.

### Suggestions

`--suggest` prints the gain in dB that moves each loudness outlier to its category target. The reports carry the same numbers. It also prints the true peak the preset would have after that gain, and warns when that passes the ceiling: a boost may need limiting or compression, or a lower target. It edits nothing. Device authors apply the change with the preset's own level controls (volume, amp or track levels), whose dB law differs from device to device.

## Calibration

Every run starts with a meter calibration on the first device page (`--no-calibrate` skips it). Test signals are connected into the instrument tap (the slot's `outGain`) and measured by the same capture and code as the presets:

| Test | Expected |
|---|---|
| 1 kHz sine at -20 dBFS in one channel: the BS.1770 reference | -20.00 dBFS sample peak, -23.01 LUFS ±0.3 |
| The same sine from a mono node, heard on both channels | -20.00 dBFS, -19.99 LUFS |
| fs/4 sine at 45°, amplitude -6.02 dBFS | -9.03 dBFS sample peak, -6.02 dBTP (+0.2/-0.4, EBU Tech 3341) |
| Constant +0.01 | DC 0.0100 |
| 1 kHz sine with a 90° phase jump | exactly 1 mid-sound click |
| Nothing (the idle instrument) | below -70 dBFS, silent flag |
| A sine left on after stop | tail peak -20 dBFS |

The steady signals cover the whole capture, so the integrated value is not lowered by partly filled 400 ms blocks at the edges. The result is written to `calibration.md` and the summary. A failed calibration makes the run exit 2.

`--selftest` checks the same meters in Node, at 48 and 44.1 kHz:

- the K-weighting coefficients;
- the BS.1770 1 kHz reference;
- EBU Tech 3341 cases 1-4, including both gates (all within 0.02 LU);
- true peak;
- DC, correlation, dropouts and tails;
- 23 click cases: saw, square, noise, kicks, corners, pings, fades and smooth edges that must not count, and steps, cuts, voice steals and band-limited steps that must.

## Reports

`<out>/` holds:

- `<device>.md` / `<device>.json`. The Markdown has a summary (median, spread, IQR, max true peak, master offset, flag counts), every preset sorted by loudness with its flags, a per-category table, flag details and notes, the suggested gain changes and the method. The JSON holds every raw measurement (`inst`, `master`, `capture`, `quiet`, `verify`, `errors`), plus `flags`, `notes`, `target`, `suggestion` and the device `stats` and `categories`. `--from` re-evaluates the JSON, so new thresholds or targets need no new measurement.
- `SUMMARY.md` / `summary.json`. Rebuilt after every run from all device reports in the directory: a device table (preset count, excitation, mono or stereo, median, distance from the studio median, spread, IQR, max true peak, master offset, flag counts by type), the worst problems ranked by severity, the calibration, and the devices not measured.
- `calibration.md` / `calibration.json`.
- `wav/<device>/<preset>.inst.wav` and `.master.wav` with `--wav`.

A `--presets` or `--limit` run merges into the device report that is already in `--out`: the re-measured presets replace their entries, and the statistics and flags are recomputed over the whole set. That is the calibration loop. Pass `--fresh` to start over.

## Calibrating an instrument

1. Run it: `node scripts/audio-qa.cjs http://localhost:3129 sub37 --out /tmp/qa --suggest --wav`.
2. Fix the hard problems first: errors, silence, true peak, stuck notes, clicks and DC. Listen to the WAVs of flagged presets.
3. Apply the suggested gains with the preset level controls.
4. Re-measure only what you changed: `--presets 'fat_bass|acid'`. The report merges and the median is recomputed over all presets.
5. Gate: exit code 0, or compare against `docs/audio-qa-baseline/<device>.md`.

For the best excitation, give your module an `audition()` that plays what a user would hear when trying a preset (a riff, or its pattern). Name presets `Category / Name`, and put drones and FX in categories the rules match, or add a rule for your device in a `--config` file.

6. If the instrument plays in a demo track, render the demo recordings again (`node scripts/render-demos.cjs`, see [DEMOS.md](DEMOS.md)): the lessons' hooks and the demo cards play recordings, which don't follow the instrument by themselves.

## Limits

- **Realtime capture.** It takes about 7.5 s per preset. On a loaded machine the audio clock can fall behind; the capture stays continuous, and a note warns when the audio ran below 0.9x realtime.
- **Repeatability.** Two independent full runs of the same build agreed as follows:
  - integrated loudness: within 0.04 LU for the median preset, 0.5 LU at the 90th percentile and 2.0 LU at worst (an Analog Four pattern);
  - true peak: within 0.2 dB for the median preset, 1.1 dB at the 90th percentile and 2.0 dB at worst;
  - device medians: within 0.25 LU.

  Randomness causes this: drift, random start phases, S&H, noise and free-running LFOs. A preset whose true peak is within about 1 dB of the ceiling can flip between runs.
- **Short captures.** The integrated loudness of a 4 s excitation includes the partly filled blocks at its edges. They are the same for every preset, so comparisons hold, but the number reads a little lower than it would over a long performance.
- **Instrument output only.** The flags judge the instrument output. The master columns include the master limiter, and its Chrome make-up gain reads about +2 dB.
- **Hybrids.** Hybrid instruments (keyboard plus sequencer) are measured one way per run: see Excitation.
- **Not measured.** Devices without presets, and devices marked `skip` in the config, are listed but not measured: Studio Clock (CV only), Your synth (MIDI) (no sound of its own), Audio input (a live input only) and Web Audio plugin.

## Baseline

`docs/audio-qa-baseline/` holds the reports of every instrument after the rebuilds, the independent reviews and the performance passes (app commit `aa0a41a`). It covers 271 presets on 7 instruments, run with `--target -18` in headless Chromium 141 at 44.1 kHz, each instrument with its default excitation. The meter calibration passed. See `SUMMARY.md`.

| Device | Presets | Median LUFS | Spread LU | Flagged |
|---|---|---|---|---|
| DFAM | 40 | -19.1 | 5.2 | 0 |
| Mother-32 | 43 | -18.1 | 8.9 | 0 |
| Subharmonicon | 36 | -18.4 | 5.6 | 0 |
| Sub 37 | 64 | -18.0 | 5.2 | 0 |
| Analog Four MKII | 47 | -19.0 | 7.6 | 1: clicks (Bass / Metallic AM) |
| Analog Rytm MKII | 20 | -18.9 | 3.3 | 1: clicks (Breaks / Big Beat) |
| Xone:96 | 21 | -18.6 | 5.7 | 0 |

Every instrument's median is within 1.1 LU of the studio's -18 LUFS line-up; at the first baseline (`ec79288`) they spanned 18 LU.

The two flags are single mid-note detections on transient-heavy material: the A4's audio-rate AM, and the Rytm kit with master drive. Re-run on their own, each preset was clean in 4 of 4 runs. Both reviews saw such rare hits with the code before them too (see `devices/analog-rytm/REVIEW.md` and `devices/analog-four/REVIEW.md`).

Audio input is skipped (config `skip`): its presets set up a live input, and a headless browser has none.
