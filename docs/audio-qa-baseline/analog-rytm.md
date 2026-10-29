# Audio QA: Analog Rytm MKII (`analog-rytm`)

Elektron Analog Rytm MKII, 6 presets. Excitation **transport** (Groovebox: its presets are heard by pressing PLAY), 4 s + 2.5 s tail, 44100 Hz. Instrument output: stereo.

Run 2026-10-29T00:34:43.687Z against http://localhost:3129, app code at `ec79288` (tool at `a1eb1c2`), Chromium 141.0.7390.37.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -13.6 LUFS | 14.3 LU (-20.7 to -6.4) | 7.4 LU | +2.1 dBTP | -0.1 LU | 4 of 6 |

Flags: true-peak 3, long-tail 1, loudness 3. Loudness reference: -13.6 LUFS (median of 6 presets without a category offset).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Techno - four on the floor | (none) | -6.4 | +7.2 | -5.9 | +1.4 | +1.4 | 37350 | 0.0026 | 6.1 | 0 | -61.9 | 1.00 | -8.1 | true-peak, loudness |
| 2 | Breakbeat | (none) | -9.0 | +4.6 | -8.3 | +2.1 | +2.1 | 5810 | 0.0021 | 12.1 | 0 | -inf | 1.00 | -10.3 | true-peak, loudness |
| 3 | Hip-hop boom bap | (none) | -10.6 | +3.0 | -10.6 | -0.5 | -0.6 | 0 | 0.0012 | 9.3 | 0 | -inf | 1.00 | -10.9 | true-peak |
| 4 | House - open hats | (none) | -16.7 | -3.0 | -16.3 | -2.1 | -2.1 | 0 | 0.0003 | 14.7 | 0 | -85.3 | 1.00 | -16.5 | ok |
| 5 | Electro | (none) | -16.9 | -3.2 | -16.3 | -4.5 | -4.6 | 0 | 0.0011 | 10.4 | 0 | -101.7 | 1.00 | -16.7 | ok |
| 6 | Minimal | (none) | -20.7 | -7.1 | -20.2 | -6.7 | -6.8 | 0 | 0.0007 | 13.6 | 0 | -45.4 | 1.00 | -20.5 | long-tail, loudness |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| (none) | - | 6 | -13.6 | -13.6 | -20.7 | -6.4 | 14.3 | 0.0 | 4 |

## Flag details

- **Techno - four on the floor** (`techno`)
  - true-peak: +1.4 dBTP (sample peak +1.4 dBFS, 37350 samples at or above 0 dBFS in 4333 overs); ceiling -1 dBTP
  - loudness: -6.4 LUFS is +7.2 LU from the device target -13.6 LUFS (tolerance 4 LU)
- **Hip-hop boom bap** (`boombap`)
  - true-peak: -0.5 dBTP (sample peak -0.6 dBFS); ceiling -1 dBTP
- **Breakbeat** (`breakbeat`)
  - true-peak: +2.1 dBTP (sample peak +2.1 dBFS, 5810 samples at or above 0 dBFS in 812 overs); ceiling -1 dBTP
  - loudness: -9.0 LUFS is +4.6 LU from the device target -13.6 LUFS (tolerance 4 LU)
  - note: master true peak +0.1 dBTP: inter-sample overs reach the output after the limiter
- **Minimal** (`minimal`)
  - long-tail: -45.4 dBFS peak 2 s after stop, still decaying at -13.4 dB/s (long release or FX tail)
  - loudness: -20.7 LUFS is -7.1 LU from the device target -13.6 LUFS (tolerance 4 LU)

## Suggested gain changes

Gain that would bring each loudness outlier to its category target. Nothing was edited: apply it with the preset's own level controls.

| Preset | Category | LUFS | Target | Change | True peak after |
|---|---|---|---|---|---|
| Techno - four on the floor | (none) | -6.4 | -13.6 | -7.2 dB | -5.8 dBTP |
| Minimal | (none) | -20.7 | -13.6 | +7.1 dB | +0.4 dBTP (over the ceiling) |
| Breakbeat | (none) | -9.0 | -13.6 | -4.6 dB | -2.5 dBTP |

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (6 of 6 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: the studio Play (hub.startAll) for 4 s at 120 BPM, then Stop (hub.stopAll).
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

