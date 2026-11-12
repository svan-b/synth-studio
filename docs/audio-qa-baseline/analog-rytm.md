# Audio QA: Analog Rytm MKII (`analog-rytm`)

Elektron Analog Rytm MKII, 20 presets. Excitation **audition** (the module's own audition()), 4 s + 2.5 s tail, 44100 Hz. Instrument output: stereo.

Run 2026-10-29T17:26:06.260Z against http://localhost:3100, app code at `04019ab` (tool at `aa0a41a`), Chromium 141.0.7390.37.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -18.9 LUFS | 3.3 LU (-20.7 to -17.5) | 2.2 LU | -1.7 dBTP | 0.0 LU | 1 of 20 |

Flags: clicks 1. Loudness reference: -18.0 LUFS (fixed target).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Drum Machine / Straight Boom | Drum Machine | -17.5 | +0.5 | -17.4 | -2.0 | -2.9 | 0 | 0.0006 | 15.2 | 0 | -inf | 1.00 | -17.5 | ok |
| 2 | House / Nine-O-Nine Box | House | -17.9 | +0.1 | -17.4 | -2.3 | -3.0 | 0 | 0.0000 | 17.7 | 0 | -inf | 1.00 | -17.9 | ok |
| 3 | Hip-Hop / Trap Sub | Hip-Hop | -17.9 | +0.1 | -17.3 | -3.6 | -3.7 | 0 | 0.0004 | 10.6 | 0 | -85.1 | 1.00 | -17.9 | ok |
| 4 | Electro / Miami Bass | Electro | -17.9 | +0.1 | -17.5 | -3.9 | -4.0 | 0 | 0.0001 | 12.6 | 0 | -115.0 | 1.00 | -17.9 | ok |
| 5 | Acoustic / Brush Jazz | Acoustic | -18.0 | -0.0 | -17.7 | -2.5 | -2.7 | 0 | 0.0000 | 19.3 | 0 | -inf | 1.00 | -18.0 | ok |
| 6 | Acoustic / Studio Kit | Acoustic | -18.1 | -0.1 | -17.3 | -3.9 | -4.2 | 0 | 0.0001 | 15.2 | 0 | -inf | 1.00 | -18.1 | ok |
| 7 | Percussion / Afro-Latin | Percussion | -18.1 | -0.1 | -17.7 | -3.9 | -4.0 | 0 | 0.0002 | 16.0 | 0 | -inf | 1.00 | -18.1 | ok |
| 8 | Dub / Echo Chamber | Dub | -18.1 | -0.1 | -17.8 | -2.0 | -2.1 | 0 | 0.0003 | 14.2 | 0 | -68.4 | 1.00 | -18.1 | ok |
| 9 | Electro / Robot Funk | Electro | -18.4 | -0.4 | -18.0 | -2.6 | -2.9 | 0 | 0.0001 | 15.3 | 0 | -86.3 | 1.00 | -18.4 | ok |
| 10 | Synth / Analog Toys | Synth | -18.8 | -0.8 | -18.6 | -3.9 | -4.3 | 0 | 0.0000 | 15.4 | 0 | -69.5 | 1.00 | -18.9 | ok |
| 11 | Hip-Hop / Dusty Boom Bap | Hip-Hop | -19.1 | -1.1 | -18.4 | -2.1 | -2.1 | 0 | 0.0002 | 16.0 | 0 | -inf | 1.00 | -19.1 | ok |
| 12 | Lo-Fi / Bitcrushed Tape | Lo-Fi | -19.7 | -1.7 | -19.3 | -1.8 | -1.9 | 0 | 0.0001 | 17.9 | 0 | -inf | 1.00 | -19.7 | ok |
| 13 | IDM / Glitch Lab | IDM | -20.0 | -2.0 | -19.6 | -3.3 | -3.6 | 0 | 0.0000 | 16.4 | 0 | -68.7 | 1.00 | -20.0 | ok |
| 14 | Techno / Dub Chords | Techno | -20.2 | -2.2 | -19.8 | -2.1 | -2.2 | 0 | 0.0001 | 16.3 | 0 | -71.6 | 1.00 | -20.2 | ok |
| 15 | Breaks / Big Beat | Breaks | -20.2 | -2.2 | -19.8 | -3.0 | -3.0 | 0 | 0.0000 | 19.4 | 1 | -inf | 1.00 | -20.2 | clicks |
| 16 | Techno / Warehouse | Techno | -20.3 | -2.3 | -19.7 | -1.7 | -2.1 | 0 | 0.0003 | 18.6 | 0 | -70.9 | 1.00 | -20.3 | ok |
| 17 | House / Deep Garage | House | -20.4 | -2.4 | -20.0 | -2.4 | -2.5 | 0 | 0.0000 | 18.9 | 0 | -70.0 | 0.97 | -20.4 | ok |
| 18 | Minimal / Micro Clicks | Minimal | -20.5 | -2.5 | -20.0 | -2.3 | -3.1 | 0 | 0.0000 | 17.0 | 0 | -73.4 | 0.99 | -20.5 | ok |
| 19 | Breaks / Jungle Roller | Breaks | -20.7 | -2.7 | -20.3 | -2.5 | -3.5 | 0 | 0.0001 | 18.1 | 0 | -inf | 1.00 | -20.7 | ok |
| 20 | Techno / Industrial Grind | Techno | -20.7 | -2.7 | -20.2 | -3.5 | -3.6 | 0 | 0.0002 | 19.7 | 0 | -77.1 | 1.00 | -20.7 | ok |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| Techno | - | 3 | -18.0 | -20.3 | -20.7 | -20.2 | 0.5 | -1.3 | 0 |
| House | - | 2 | -18.0 | -19.1 | -20.4 | -17.9 | 2.6 | -0.2 | 0 |
| Electro | - | 2 | -18.0 | -18.2 | -18.4 | -17.9 | 0.5 | +0.8 | 0 |
| Drum Machine | - | 1 | -18.0 | -17.5 | -17.5 | -17.5 | 0.0 | +1.5 | 0 |
| Hip-Hop | - | 2 | -18.0 | -18.5 | -19.1 | -17.9 | 1.2 | +0.5 | 0 |
| Breaks | - | 2 | -18.0 | -20.5 | -20.7 | -20.2 | 0.5 | -1.5 | 1 |
| Minimal | - | 1 | -18.0 | -20.5 | -20.5 | -20.5 | 0.0 | -1.5 | 0 |
| IDM | - | 1 | -18.0 | -20.0 | -20.0 | -20.0 | 0.0 | -1.1 | 0 |
| Dub | - | 1 | -18.0 | -18.1 | -18.1 | -18.1 | 0.0 | +0.8 | 0 |
| Acoustic | - | 2 | -18.0 | -18.1 | -18.1 | -18.0 | 0.0 | +0.9 | 0 |
| Lo-Fi | - | 1 | -18.0 | -19.7 | -19.7 | -19.7 | 0.0 | -0.8 | 0 |
| Percussion | - | 1 | -18.0 | -18.1 | -18.1 | -18.1 | 0.0 | +0.8 | 0 |
| Synth | - | 1 | -18.0 | -18.8 | -18.8 | -18.8 | 0.0 | +0.1 | 0 |

## Flag details

- **Breaks / Big Beat** (`bigbeat`)
  - clicks: 1 (1 mid); worst step 6.6 dBFS; first at 3.6992 s

## Suggested gain changes

No loudness outliers.

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (20 of 20 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: hub.audition() for 4 s, then hub.stopAudition().
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

