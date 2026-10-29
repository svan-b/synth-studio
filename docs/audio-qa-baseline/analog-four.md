# Audio QA: Analog Four MKII (`analog-four`)

Elektron Analog Four MKII, 7 presets. Excitation **transport** (Groovebox: its presets are heard by pressing PLAY), 4 s + 2.5 s tail, 44100 Hz. Instrument output: stereo.

Run 2026-10-29T00:33:55.912Z against http://localhost:3129, app code at `ec79288` (tool at `a1eb1c2`), Chromium 141.0.7390.37.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -31.5 LUFS | 12.0 LU (-36.0 to -24.0) | 7.4 LU | -10.0 dBTP | +0.2 LU | 5 of 7 |

Flags: stuck-tail 1, long-tail 1, loudness 4. Loudness reference: -31.5 LUFS (median of 6 presets without a category offset).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Detuned saw lead | (none) | -24.0 | +7.6 | -23.4 | -10.1 | -10.1 | 0 | 0.0001 | 16.6 | 0 | -14.8 | 0.83 | -23.8 | stuck-tail, loudness |
| 2 | Ambient drift | (none) | -26.1 | +8.5 | -24.2 | -12.9 | -12.9 | 0 | 0.0001 | 12.4 | 0 | -34.9 | 0.55 | -25.9 | loudness |
| 3 | Techno bassline + pad | (none) | -27.0 | +4.6 | -26.2 | -11.8 | -11.8 | 0 | 0.0000 | 16.6 | 0 | -123.2 | 0.90 | -26.8 | loudness |
| 4 | Arpeggio | (none) | -29.9 | +1.6 | -29.4 | -17.0 | -17.0 | 0 | 0.0000 | 12.2 | 0 | -48.2 | 1.00 | -29.7 | long-tail |
| 5 | Acid line | (none) | -33.1 | -1.6 | -32.6 | -10.0 | -10.0 | 0 | 0.0001 | 24.0 | 0 | -83.0 | 1.00 | -32.9 | ok |
| 6 | Init: bass pulse | (none) | -34.6 | -3.1 | -34.6 | -17.7 | -17.7 | 0 | 0.0000 | 19.0 | 0 | -inf | 1.00 | -34.4 | ok |
| 7 | Four-track groove | (none) | -36.0 | -4.5 | -36.1 | -13.7 | -13.7 | 0 | 0.0001 | 23.2 | 0 | -82.7 | 1.00 | -35.9 | loudness |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| (none) | - | 7 | -31.5 | -29.9 | -36.0 | -24.0 | 12.0 | +1.6 | 5 |

## Flag details

- **Techno bassline + pad** (`techno`)
  - loudness: -27.0 LUFS is +4.6 LU from the device target -31.5 LUFS (tolerance 4 LU)
- **Arpeggio** (`arp`)
  - long-tail: -48.2 dBFS peak 2 s after stop, still decaying at -10.8 dB/s (long release or FX tail)
- **Ambient drift** (`ambient`)
  - loudness: -26.1 LUFS is +8.5 LU from the Drone / ambient target -34.5 LUFS (tolerance 4 LU)
  - note: constant idle floor -78.5 dBFS before the preset
  - note: keeps sounding after stop (-34.9 dBFS 2 s later), allowed for the Drone / ambient category
- **Four-track groove** (`groove`)
  - loudness: -36.0 LUFS is -4.5 LU from the device target -31.5 LUFS (tolerance 4 LU)
  - note: constant idle floor -60.1 dBFS before the preset
- **Detuned saw lead** (`supersaw`)
  - stuck-tail: -14.8 dBFS peak 2 s after stop and not decaying (-0.6 dB/s): a note, gate or drone is left on
  - loudness: -24.0 LUFS is +7.6 LU from the device target -31.5 LUFS (tolerance 4 LU)

## Suggested gain changes

Gain that would bring each loudness outlier to its category target. Nothing was edited: apply it with the preset's own level controls.

| Preset | Category | LUFS | Target | Change | True peak after |
|---|---|---|---|---|---|
| Ambient drift | (none) | -26.1 | -34.5 | -8.5 dB | -21.4 dBTP |
| Detuned saw lead | (none) | -24.0 | -31.5 | -7.6 dB | -17.6 dBTP |
| Techno bassline + pad | (none) | -27.0 | -31.5 | -4.6 dB | -16.4 dBTP |
| Four-track groove | (none) | -36.0 | -31.5 | +4.5 dB | -9.2 dBTP |

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (7 of 7 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: the studio Play (hub.startAll) for 4 s at 120 BPM, then Stop (hub.stopAll).
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

