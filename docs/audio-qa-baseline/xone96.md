# Audio QA: Xone:96 (`xone96`)

Allen & Heath Xone:96, 5 presets. Excitation **transport** (DJ Mixer: its presets are heard by pressing PLAY), 4 s + 2.5 s tail, 44100 Hz. Instrument output: stereo.

Run 2026-10-29T00:35:23.874Z against http://localhost:3129, app code at `ec79288` (tool at `a1eb1c2`), Chromium 141.0.7390.37.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -21.7 LUFS | 10.9 LU (-29.2 to -18.3) | 1.0 LU | -5.7 dBTP | +0.2 LU | 2 of 5 |

Flags: long-tail 1, loudness 1. Loudness reference: -21.7 LUFS (median of 5 presets without a category offset).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Live stem jam | (none) | -18.3 | +3.4 | -16.9 | -5.7 | -5.7 | 0 | 0.0008 | 11.9 | 0 | -29.9 | 0.98 | -18.1 | long-tail |
| 2 | Bass swap | (none) | -20.7 | +1.0 | -20.3 | -8.3 | -8.3 | 0 | 0.0001 | 13.0 | 0 | -inf | 1.00 | -20.5 | ok |
| 3 | Dub stabs into the delay | (none) | -21.7 | 0.0 | -21.3 | -9.3 | -9.4 | 0 | 0.0002 | 12.9 | 0 | -64.9 | 0.99 | -21.5 | ok |
| 4 | Two decks ready to blend | (none) | -21.7 | -0.0 | -21.2 | -9.4 | -9.9 | 0 | 0.0003 | 12.1 | 0 | -inf | 1.00 | -21.5 | ok |
| 5 | Filter sweep build-up | (none) | -29.2 | -7.5 | -28.5 | -10.9 | -11.5 | 0 | 0.0000 | 21.0 | 0 | -inf | 1.00 | -29.1 | loudness |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| (none) | - | 5 | -21.7 | -21.7 | -29.2 | -18.3 | 10.9 | 0.0 | 2 |

## Flag details

- **Filter sweep build-up** (`filter_build`)
  - loudness: -29.2 LUFS is -7.5 LU from the device target -21.7 LUFS (tolerance 4 LU)
- **Live stem jam** (`stem_jam`)
  - long-tail: -29.9 dBFS peak 2 s after stop, still decaying at -16.5 dB/s (long release or FX tail)

## Suggested gain changes

Gain that would bring each loudness outlier to its category target. Nothing was edited: apply it with the preset's own level controls.

| Preset | Category | LUFS | Target | Change | True peak after |
|---|---|---|---|---|---|
| Filter sweep build-up | (none) | -29.2 | -21.7 | +7.5 dB | -3.4 dBTP |

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (5 of 5 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: the studio Play (hub.startAll) for 4 s at 120 BPM, then Stop (hub.stopAll).
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

