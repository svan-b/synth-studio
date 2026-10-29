# Audio QA: DFAM (`dfam`)

Moog DFAM, 38 presets. Excitation **audition** (the module's own audition()), 4 s + 2.5 s tail, 44100 Hz. Instrument output: mono (measured as the stereo bus hears it: L = R).

Run 2026-10-29T00:28:49.500Z against http://localhost:3129, app code at `ec79288` (tool at `a1eb1c2`), Chromium 141.0.7390.37.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -21.6 LUFS | 20.1 LU (-31.3 to -11.2) | 5.5 LU | -1.4 dBTP | +0.2 LU | 12 of 38 |

Flags: loudness 12. Loudness reference: -21.6 LUFS (median of 33 presets without a category offset).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Metal / Sync bell | Metal | -11.2 | +10.4 | -10.9 | -6.6 | -6.7 | 0 | 0.0001 | 8.1 | 0 | -inf | mono | -11.0 | loudness |
| 2 | Hats / Quick hats · 1 cable | Hats | -12.7 | +8.9 | -12.5 | -1.4 | -5.4 | 0 | 0.0000 | 13.5 | 0 | -inf | mono | -12.5 | loudness |
| 3 | Bass / Sequenced bass | Bass | -13.0 | +8.5 | -12.7 | -5.2 | -5.2 | 0 | 0.0001 | 8.3 | 0 | -inf | mono | -12.8 | loudness |
| 4 | FX / Sync zap · 1 cable | FX | -13.4 | +12.2 | -13.1 | -5.5 | -5.5 | 0 | 0.0000 | 12.2 | 0 | -inf | mono | -13.2 | loudness |
| 5 | Hats / Shaker | Hats | -13.7 | +7.9 | -13.4 | -2.8 | -5.7 | 0 | 0.0000 | 14.1 | 0 | -inf | mono | -13.5 | loudness |
| 6 | Hats / Open hat | Hats | -14.1 | +7.5 | -14.1 | -1.6 | -5.9 | 0 | 0.0000 | 14.6 | 0 | -inf | mono | -13.9 | loudness |
| 7 | Toms / Filter as an oscillator · 1 cable | Toms | -16.4 | +5.2 | -16.2 | -6.7 | -6.8 | 0 | 0.0000 | 12.7 | 0 | -inf | mono | -16.2 | loudness |
| 8 | FX / Laser zap | FX | -16.8 | +8.8 | -16.7 | -6.9 | -6.9 | 0 | 0.0000 | 14.5 | 0 | -inf | mono | -16.6 | loudness |
| 9 | Metal / FM clang · 1 cable | Metal | -18.0 | +3.6 | -17.7 | -7.7 | -7.7 | 0 | 0.0001 | 12.2 | 0 | -inf | mono | -17.8 | ok |
| 10 | Toms / Tom fill | Toms | -18.0 | +3.6 | -17.8 | -6.7 | -6.7 | 0 | 0.0000 | 12.9 | 0 | -inf | mono | -17.9 | ok |
| 11 | Kick / 808 boom | Kick | -18.4 | +3.1 | -19.1 | -6.1 | -6.1 | 0 | 0.0002 | 12.1 | 0 | -81.3 | mono | -18.4 | ok |
| 12 | Loop / Deep bounce · 1 cable | Loop | -18.6 | +3.0 | -18.3 | -5.8 | -5.8 | 0 | 0.0000 | 12.9 | 0 | -inf | mono | -18.4 | ok |
| 13 | Snare / Bright noise snare | Snare | -19.0 | +2.6 | -20.5 | -2.0 | -5.0 | 0 | 0.0000 | 21.8 | 0 | -inf | mono | -18.8 | ok |
| 14 | Init / Default patch | Init | -20.3 | +1.3 | -20.1 | -10.2 | -10.2 | 0 | 0.0000 | 11.4 | 0 | -inf | mono | -20.1 | ok |
| 15 | Bass / Acid line | Bass | -20.6 | +1.0 | -20.2 | -5.4 | -5.4 | 0 | 0.0000 | 16.5 | 0 | -inf | mono | -20.4 | ok |
| 16 | Kick / Techno rumble | Kick | -20.6 | +0.9 | -20.2 | -6.7 | -6.7 | 0 | 0.0000 | 12.1 | 0 | -inf | mono | -20.4 | ok |
| 17 | Toms / Congas | Toms | -20.9 | +0.7 | -20.7 | -7.6 | -7.6 | 0 | 0.0000 | 15.3 | 0 | -inf | mono | -20.7 | ok |
| 18 | Hats / Closed hat | Hats | -21.1 | +0.5 | -20.8 | -2.3 | -4.6 | 0 | 0.0000 | 22.4 | 0 | -inf | mono | -20.9 | ok |
| 19 | Metal / Cowbell | Metal | -21.6 | 0.0 | -21.4 | -6.2 | -6.2 | 0 | 0.0000 | 18.5 | 0 | -inf | mono | -21.4 | ok |
| 20 | Loop / Shuffle · 1 cable | Loop | -21.7 | -0.1 | -21.3 | -3.7 | -5.6 | 0 | 0.0000 | 22.1 | 0 | -inf | mono | -21.5 | ok |
| 21 | Toms / Talking drum · 1 cable | Toms | -21.8 | -0.2 | -21.5 | -5.5 | -5.5 | 0 | 0.0003 | 16.6 | 0 | -inf | mono | -21.7 | ok |
| 22 | Metal / FM toys · 1 cable | Metal | -22.0 | -0.4 | -21.8 | -7.4 | -7.5 | 0 | 0.0000 | 16.2 | 0 | -inf | mono | -21.8 | ok |
| 23 | Loop / Kick and snare · 1 cable | Loop | -22.1 | -0.6 | -22.0 | -5.9 | -5.9 | 0 | 0.0002 | 17.3 | 0 | -inf | mono | -22.0 | ok |
| 24 | FX / Lo-fi crunch | FX | -22.7 | +2.9 | -22.6 | -7.1 | -7.1 | 0 | 0.0001 | 16.8 | 0 | -inf | mono | -22.5 | ok |
| 25 | Toms / Bongos | Toms | -23.1 | -1.5 | -22.9 | -7.7 | -7.8 | 0 | 0.0000 | 17.5 | 0 | -inf | mono | -22.9 | ok |
| 26 | FX / Sequencer as an oscillator · 1 cable | FX | -23.2 | +2.4 | -23.0 | -6.8 | -6.8 | 0 | 0.0000 | 18.2 | 0 | -inf | mono | -23.0 | ok |
| 27 | Loop / Pop percussion | Loop | -23.5 | -1.9 | -23.1 | -5.8 | -5.8 | 0 | 0.0000 | 19.5 | 0 | -inf | mono | -23.3 | ok |
| 28 | Kick / Punch kick | Kick | -23.6 | -2.1 | -23.5 | -6.2 | -6.2 | 0 | 0.0000 | 17.5 | 0 | -inf | mono | -23.5 | ok |
| 29 | Bass / Accent bassline · 1 cable | Bass | -23.6 | -2.1 | -23.6 | -5.4 | -5.4 | 0 | 0.0000 | 17.7 | 0 | -inf | mono | -23.6 | ok |
| 30 | Bass / Rolling sub | Bass | -23.8 | -2.2 | -23.4 | -6.1 | -6.1 | 0 | 0.0000 | 16.0 | 0 | -inf | mono | -23.7 | ok |
| 31 | Kick / Analog kick | Kick | -23.9 | -2.3 | -23.9 | -7.1 | -7.1 | 0 | 0.0000 | 16.1 | 0 | -inf | mono | -23.7 | ok |
| 32 | Loop / Techno percussion | Loop | -24.3 | -2.8 | -23.8 | -6.2 | -6.3 | 0 | 0.0000 | 20.3 | 0 | -inf | mono | -24.1 | ok |
| 33 | Loop / Noise hits · 1 cable | Loop | -25.2 | -3.6 | -24.9 | -4.9 | -5.4 | 0 | 0.0000 | 25.4 | 0 | -inf | mono | -25.0 | ok |
| 34 | FX / Computer bleeps | FX | -26.3 | -0.7 | -25.8 | -8.2 | -8.2 | 0 | 0.0000 | 21.8 | 0 | -inf | mono | -26.1 | ok |
| 35 | Snare / Hand clap · 1 cable | Snare | -26.3 | -4.7 | -30.0 | -5.9 | -5.9 | 0 | 0.0000 | 29.8 | 0 | -inf | mono | -26.1 | loudness |
| 36 | Snare / Snappy snare | Snare | -27.3 | -5.8 | -28.1 | -4.3 | -4.4 | 0 | 0.0000 | 28.0 | 0 | -inf | mono | -27.1 | loudness |
| 37 | Snare / Rimshot | Snare | -29.7 | -8.1 | -29.5 | -5.1 | -5.6 | 0 | 0.0000 | 28.9 | 0 | -inf | mono | -29.5 | loudness |
| 38 | Hats / Metallic hat | Hats | -31.3 | -9.7 | -31.1 | -9.7 | -9.7 | 0 | 0.0000 | 27.6 | 0 | -inf | mono | -31.1 | loudness |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| Init | - | 1 | -21.6 | -20.3 | -20.3 | -20.3 | 0.0 | +1.3 | 0 |
| Kick | - | 4 | -21.6 | -22.1 | -23.9 | -18.4 | 5.5 | -0.6 | 0 |
| Snare | - | 4 | -21.6 | -26.8 | -29.7 | -19.0 | 10.7 | -5.3 | 3 |
| Hats | - | 5 | -21.6 | -14.1 | -31.3 | -12.7 | 18.5 | +7.5 | 4 |
| Toms | - | 5 | -21.6 | -20.9 | -23.1 | -16.4 | 6.7 | +0.7 | 1 |
| Metal | - | 4 | -21.6 | -19.8 | -22.0 | -11.2 | 10.9 | +1.8 | 1 |
| Bass | - | 4 | -21.6 | -22.1 | -23.8 | -13.0 | 10.7 | -0.5 | 1 |
| FX | FX | 5 | -25.6 | -22.7 | -26.3 | -13.4 | 12.9 | -1.1 | 2 |
| Loop | - | 6 | -21.6 | -22.8 | -25.2 | -18.6 | 6.6 | -1.3 | 0 |

## Flag details

- **Snare / Snappy snare** (`snare_snappy`)
  - loudness: -27.3 LUFS is -5.8 LU from the device target -21.6 LUFS (tolerance 4 LU)
- **Snare / Hand clap** (`snare_clap`)
  - loudness: -26.3 LUFS is -4.7 LU from the device target -21.6 LUFS (tolerance 4 LU)
- **Snare / Rimshot** (`snare_rim`)
  - loudness: -29.7 LUFS is -8.1 LU from the device target -21.6 LUFS (tolerance 4 LU)
- **Hats / Quick hats** (`hats_quick`)
  - loudness: -12.7 LUFS is +8.9 LU from the device target -21.6 LUFS (tolerance 4 LU)
- **Hats / Open hat** (`hats_open`)
  - loudness: -14.1 LUFS is +7.5 LU from the device target -21.6 LUFS (tolerance 4 LU)
- **Hats / Metallic hat** (`hats_metal`)
  - loudness: -31.3 LUFS is -9.7 LU from the device target -21.6 LUFS (tolerance 4 LU)
- **Hats / Shaker** (`hats_shaker`)
  - loudness: -13.7 LUFS is +7.9 LU from the device target -21.6 LUFS (tolerance 4 LU)
- **Toms / Filter as an oscillator** (`toms_filter_osc`)
  - loudness: -16.4 LUFS is +5.2 LU from the device target -21.6 LUFS (tolerance 4 LU)
- **Metal / Sync bell** (`metal_sync_bell`)
  - loudness: -11.2 LUFS is +10.4 LU from the device target -21.6 LUFS (tolerance 4 LU)
- **Bass / Sequenced bass** (`bass_sequenced`)
  - loudness: -13.0 LUFS is +8.5 LU from the device target -21.6 LUFS (tolerance 4 LU)
- **FX / Laser zap** (`fx_laser`)
  - loudness: -16.8 LUFS is +8.8 LU from the FX target -25.6 LUFS (tolerance 4 LU)
- **FX / Sync zap** (`fx_sync_zap`)
  - loudness: -13.4 LUFS is +12.2 LU from the FX target -25.6 LUFS (tolerance 4 LU)

## Suggested gain changes

Gain that would bring each loudness outlier to its category target. Nothing was edited: apply it with the preset's own level controls.

| Preset | Category | LUFS | Target | Change | True peak after |
|---|---|---|---|---|---|
| FX / Sync zap | FX | -13.4 | -25.6 | -12.2 dB | -17.7 dBTP |
| Metal / Sync bell | Metal | -11.2 | -21.6 | -10.4 dB | -17.0 dBTP |
| Hats / Metallic hat | Hats | -31.3 | -21.6 | +9.7 dB | 0.0 dBTP (over the ceiling) |
| Hats / Quick hats | Hats | -12.7 | -21.6 | -8.9 dB | -10.3 dBTP |
| FX / Laser zap | FX | -16.8 | -25.6 | -8.7 dB | -15.6 dBTP |
| Bass / Sequenced bass | Bass | -13.0 | -21.6 | -8.5 dB | -13.7 dBTP |
| Snare / Rimshot | Snare | -29.7 | -21.6 | +8.1 dB | +3.0 dBTP (over the ceiling) |
| Hats / Shaker | Hats | -13.7 | -21.6 | -7.9 dB | -10.7 dBTP |
| Hats / Open hat | Hats | -14.1 | -21.6 | -7.5 dB | -9.1 dBTP |
| Snare / Snappy snare | Snare | -27.3 | -21.6 | +5.8 dB | +1.5 dBTP (over the ceiling) |
| Toms / Filter as an oscillator | Toms | -16.4 | -21.6 | -5.2 dB | -11.9 dBTP |
| Snare / Hand clap | Snare | -26.3 | -21.6 | +4.7 dB | -1.2 dBTP |

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (38 of 38 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: hub.audition() for 4 s, then hub.stopAudition().
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

