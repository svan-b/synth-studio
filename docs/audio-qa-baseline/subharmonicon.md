# Audio QA: Subharmonicon (`subharmonicon`)

Moog Subharmonicon, 9 presets. Excitation **keys** (keyboard instrument: standard phrase), 4 s + 2.5 s tail, 44100 Hz. Instrument output: mono (measured as the stereo bus hears it: L = R).

Run 2026-10-29T00:31:29.136Z against http://localhost:3129, app code at `ec79288` (tool at `a1eb1c2`), Chromium 141.0.7390.37.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -26.9 LUFS | 3.6 LU (-28.2 to -24.6) | 2.8 LU | -14.9 dBTP | +0.2 LU | 2 of 9 |

Flags: dc 1, loudness 1. Loudness reference: -26.9 LUFS (median of 8 presets without a category offset).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 3 Against 4 | (none) | -24.6 | +2.3 | -23.9 | -16.3 | -16.4 | 0 | 0.0001 | 9.8 | 0 | -inf | mono | -24.4 | ok |
| 2 | Init: two sequences, 4 against 3 | (none) | -24.8 | +2.0 | -24.2 | -15.8 | -16.0 | 0 | 0.0000 | 10.4 | 0 | -inf | mono | -24.6 | ok |
| 3 | Undertone Drone | (none) | -25.0 | +4.9 | -24.8 | -14.9 | -14.9 | 0 | 0.0003 | 11.7 | 0 | -15.6 | mono | -24.8 | loudness |
| 4 | Shifting Rhythms (cables) · 2 cables | (none) | -25.1 | +1.7 | -24.5 | -16.0 | -16.0 | 0 | 0.0000 | 10.7 | 0 | -inf | mono | -24.9 | ok |
| 5 | Undertone Melody | (none) | -26.4 | +0.5 | -25.6 | -17.6 | -17.6 | 0 | 0.0000 | 9.8 | 0 | -inf | mono | -26.2 | ok |
| 6 | Envelope PWM (cable) · 1 cable | (none) | -27.4 | -0.5 | -27.0 | -18.6 | -18.6 | 0 | 0.0547 | 5.1 | 0 | -inf | mono | -27.2 | dc |
| 7 | Sequenced Filter (cable) · 1 cable | (none) | -27.8 | -0.9 | -27.2 | -19.9 | -19.9 | 0 | 0.0004 | 9.3 | 0 | -inf | mono | -27.6 | ok |
| 8 | Sub-Audio Filter FM (cable) · 1 cable | (none) | -28.1 | -1.3 | -27.5 | -18.3 | -18.3 | 0 | 0.0003 | 11.4 | 0 | -inf | mono | -27.9 | ok |
| 9 | Just Intonation Arp | (none) | -28.2 | -1.4 | -27.5 | -18.6 | -18.6 | 0 | 0.0000 | 10.2 | 0 | -inf | mono | -28.0 | ok |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| (none) | - | 9 | -26.9 | -26.4 | -28.2 | -24.6 | 3.6 | +0.5 | 2 |

## Flag details

- **Undertone Drone** (`undertone_drone`)
  - loudness: -25.0 LUFS is +4.9 LU from the Drone / ambient target -29.9 LUFS (tolerance 4 LU)
  - note: already sounding before the excitation (idle peak -15.8 dBFS)
  - note: keeps sounding after stop (-15.6 dBFS 2 s later), allowed for the Drone / ambient category
- **3 Against 4** (`three_against_four`)
  - note: the previous preset was still at -18.1 dBFS when this one was applied
- **Envelope PWM (cable)** (`pwm_envelope`)
  - dc: 0.0547 (during the excitation; limit 0.005)

## Suggested gain changes

Gain that would bring each loudness outlier to its category target. Nothing was edited: apply it with the preset's own level controls.

| Preset | Category | LUFS | Target | Change | True peak after |
|---|---|---|---|---|---|
| Undertone Drone | (none) | -25.0 | -29.9 | -4.9 dB | -19.8 dBTP |

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (9 of 9 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: notes 36, 48, 55, 60 (C2 C3 G3 C4), 375 ms each every 500 ms, then 48 held from 2 s to 4 s, velocity 1.
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

