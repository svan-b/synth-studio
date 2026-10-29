# Audio QA: Sub 37 (`sub37`)

Moog Sub 37, 11 presets. Excitation **keys** (keyboard instrument: standard phrase), 4 s + 2.5 s tail, 44100 Hz. Instrument output: mono (measured as the stereo bus hears it: L = R).

Run 2026-10-29T00:32:56.550Z against http://localhost:3129, app code at `ec79288` (tool at `a1eb1c2`), Chromium 141.0.7390.37.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -17.4 LUFS | 20.5 LU (-29.9 to -9.4) | 9.8 LU | +0.9 dBTP | +0.2 LU | 6 of 11 |

Flags: true-peak 1, loudness 6. Loudness reference: -17.4 LUFS (median of 10 presets without a category offset).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Feedback Growl | (none) | -9.4 | +8.0 | -8.7 | -1.1 | -1.1 | 0 | 0.0009 | 7.3 | 0 | -inf | mono | -9.2 | loudness |
| 2 | Wobble Bass | (none) | -10.8 | +6.6 | -10.0 | +0.9 | +0.9 | 476 | 0.0002 | 10.0 | 0 | -inf | mono | -10.8 | true-peak, loudness |
| 3 | Fat Bass | (none) | -11.2 | +6.2 | -10.4 | -1.0 | -1.0 | 0 | 0.0005 | 8.9 | 0 | -inf | mono | -11.0 | loudness |
| 4 | Acid Squelch | (none) | -11.2 | +6.1 | -10.5 | -3.5 | -3.5 | 0 | 0.0001 | 8.5 | 0 | -inf | mono | -11.0 | loudness |
| 5 | Sync Lead | (none) | -15.8 | +1.6 | -15.3 | -11.4 | -11.4 | 0 | 0.0000 | 7.0 | 0 | -inf | mono | -15.6 | ok |
| 6 | S&H Bleeps | (none) | -17.8 | +3.6 | -17.2 | -10.7 | -10.7 | 0 | 0.0000 | 8.5 | 0 | -inf | mono | -17.6 | ok |
| 7 | Looping Filter | (none) | -18.9 | -1.6 | -18.1 | -11.3 | -11.3 | 0 | 0.0000 | 9.1 | 0 | -inf | mono | -18.7 | ok |
| 8 | Warm Pad | (none) | -20.8 | -3.4 | -19.8 | -10.0 | -10.1 | 0 | 0.0000 | 13.0 | 0 | -inf | mono | -20.6 | ok |
| 9 | Duo Lead | (none) | -21.2 | -3.8 | -20.6 | -15.4 | -15.4 | 0 | 0.0000 | 8.0 | 0 | -inf | mono | -21.0 | ok |
| 10 | Arp Pulse | (none) | -26.1 | -8.7 | -25.5 | -11.5 | -11.5 | 0 | 0.0001 | 16.8 | 0 | -inf | mono | -25.9 | loudness |
| 11 | Pluck | (none) | -29.9 | -12.5 | -30.7 | -12.7 | -12.7 | 0 | 0.0001 | 21.0 | 0 | -inf | mono | -29.6 | loudness |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| (none) | - | 11 | -17.4 | -17.8 | -29.9 | -9.4 | 20.5 | -0.4 | 6 |

## Flag details

- **Fat Bass** (`fat_bass`)
  - loudness: -11.2 LUFS is +6.2 LU from the device target -17.4 LUFS (tolerance 4 LU)
- **Acid Squelch** (`acid_squelch`)
  - loudness: -11.2 LUFS is +6.1 LU from the device target -17.4 LUFS (tolerance 4 LU)
- **Pluck** (`pluck`)
  - loudness: -29.9 LUFS is -12.5 LU from the device target -17.4 LUFS (tolerance 4 LU)
- **Wobble Bass** (`wobble_bass`)
  - true-peak: +0.9 dBTP (sample peak +0.9 dBFS, 476 samples at or above 0 dBFS in 10 overs); ceiling -1 dBTP
  - loudness: -10.8 LUFS is +6.6 LU from the device target -17.4 LUFS (tolerance 4 LU)
  - note: master limiter reduced peaks by 2.1 dB
- **Arp Pulse** (`arp_pulse`)
  - loudness: -26.1 LUFS is -8.7 LU from the device target -17.4 LUFS (tolerance 4 LU)
- **Feedback Growl** (`feedback_growl`)
  - loudness: -9.4 LUFS is +8.0 LU from the device target -17.4 LUFS (tolerance 4 LU)

## Suggested gain changes

Gain that would bring each loudness outlier to its category target. Nothing was edited: apply it with the preset's own level controls.

| Preset | Category | LUFS | Target | Change | True peak after |
|---|---|---|---|---|---|
| Pluck | (none) | -29.9 | -17.4 | +12.5 dB | -0.2 dBTP (over the ceiling) |
| Arp Pulse | (none) | -26.1 | -17.4 | +8.7 dB | -2.8 dBTP |
| Feedback Growl | (none) | -9.4 | -17.4 | -8.0 dB | -9.1 dBTP |
| Wobble Bass | (none) | -10.8 | -17.4 | -6.6 dB | -5.7 dBTP |
| Fat Bass | (none) | -11.2 | -17.4 | -6.2 dB | -7.2 dBTP |
| Acid Squelch | (none) | -11.2 | -17.4 | -6.1 dB | -9.6 dBTP |

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (11 of 11 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: notes 36, 48, 55, 60 (C2 C3 G3 C4), 375 ms each every 500 ms, then 48 held from 2 s to 4 s, velocity 1.
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

