# Audio QA: Mother-32 (`mother32`)

Moog Mother-32, 10 presets. Excitation **keys** (keyboard instrument: standard phrase), 4 s + 2.5 s tail, 44100 Hz. Instrument output: mono (measured as the stereo bus hears it: L = R).

Run 2026-10-29T00:30:13.211Z against http://localhost:3129, app code at `ec79288` (tool at `a1eb1c2`), Chromium 141.0.7390.37.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -19.1 LUFS | 20.6 LU (-34.7 to -14.2) | 13.1 LU | -10.6 dBTP | +0.2 LU | 6 of 10 |

Flags: dc 1, loudness 5. Loudness reference: -19.1 LUFS (median of 8 presets without a category offset).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | PWM Lead | (none) | -14.2 | +5.0 | -13.6 | -12.9 | -13.0 | 0 | 0.0001 | 2.8 | 0 | -inf | mono | -14.0 | loudness |
| 2 | Blank Pattern (ready to record) | (none) | -15.6 | +3.6 | -15.0 | -11.1 | -11.1 | 0 | 0.0007 | 6.3 | 0 | -inf | mono | -15.4 | ok |
| 3 | Basic Patch (normalled) | (none) | -15.6 | +3.5 | -15.0 | -11.1 | -11.1 | 0 | 0.0007 | 6.3 | 0 | -inf | mono | -15.4 | ok |
| 4 | Delayed Vibrato (VC MIX as VCA) · 3 cables | (none) | -17.6 | +1.6 | -16.7 | -12.9 | -12.9 | 0 | 0.0161 | 6.8 | 0 | -inf | mono | -17.4 | dc |
| 5 | Audio-Rate LFO FM Bell · 1 cable | (none) | -20.7 | -1.6 | -21.1 | -10.6 | -10.8 | 0 | 0.0010 | 13.5 | 0 | -inf | mono | -20.5 | ok |
| 6 | LFO → Cutoff Wobble · 1 cable | (none) | -20.8 | -1.7 | -20.1 | -12.1 | -12.2 | 0 | 0.0035 | 9.0 | 0 | -inf | mono | -20.6 | ok |
| 7 | EG → Pitch Zaps · 1 cable | (none) | -27.2 | -4.0 | -28.3 | -12.4 | -12.5 | 0 | 0.0019 | 22.0 | 0 | -inf | mono | -27.3 | loudness |
| 8 | Wind Drone (VCA ON) | (none) | -29.8 | -7.7 | -27.3 | -18.7 | -18.8 | 0 | 0.0001 | 14.5 | 0 | -21.9 | mono | -29.6 | loudness |
| 9 | Acid Sequence · 1 cable | (none) | -33.0 | -13.9 | -33.8 | -13.3 | -13.4 | 0 | 0.0004 | 23.8 | 0 | -inf | mono | -32.8 | loudness |
| 10 | Self-Oscillating Filter (KB → MULT) · 3 cables | (none) | -34.7 | -15.6 | -33.8 | -23.6 | -23.7 | 0 | 0.0001 | 12.9 | 0 | -114.9 | mono | -34.5 | loudness |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| (none) | - | 10 | -19.1 | -20.8 | -34.7 | -14.2 | 20.6 | -1.6 | 6 |

## Flag details

- **PWM Lead** (`pwm_lead`)
  - loudness: -14.2 LUFS is +5.0 LU from the device target -19.1 LUFS (tolerance 4 LU)
- **Acid Sequence** (`acid_seq`)
  - loudness: -33.0 LUFS is -13.9 LU from the device target -19.1 LUFS (tolerance 4 LU)
- **EG → Pitch Zaps** (`eg_zap`)
  - loudness: -27.2 LUFS is -4.0 LU from the FX target -23.1 LUFS (tolerance 4 LU)
- **Self-Oscillating Filter (KB → MULT)** (`whistle_filter`)
  - loudness: -34.7 LUFS is -15.6 LU from the device target -19.1 LUFS (tolerance 4 LU)
- **Delayed Vibrato (VC MIX as VCA)** (`delayed_vibrato`)
  - dc: 0.0161 (during the excitation; limit 0.005)
- **Wind Drone (VCA ON)** (`noise_drone`)
  - loudness: -29.8 LUFS is -7.7 LU from the Drone / ambient target -22.1 LUFS (tolerance 4 LU)
  - note: already sounding before the excitation (idle peak -23.9 dBFS)
  - note: keeps sounding after stop (-21.9 dBFS 2 s later), allowed for the Drone / ambient category
- **Blank Pattern (ready to record)** (`empty_pattern`)
  - note: the previous preset was still at -20.6 dBFS when this one was applied

## Suggested gain changes

Gain that would bring each loudness outlier to its category target. Nothing was edited: apply it with the preset's own level controls.

| Preset | Category | LUFS | Target | Change | True peak after |
|---|---|---|---|---|---|
| Self-Oscillating Filter (KB → MULT) | (none) | -34.7 | -19.1 | +15.6 dB | -8.0 dBTP |
| Acid Sequence | (none) | -33.0 | -19.1 | +13.9 dB | +0.6 dBTP (over the ceiling) |
| Wind Drone (VCA ON) | (none) | -29.8 | -22.1 | +7.7 dB | -11.0 dBTP |
| PWM Lead | (none) | -14.2 | -19.1 | -5.0 dB | -17.9 dBTP |
| EG → Pitch Zaps | (none) | -27.2 | -23.1 | +4.0 dB | -8.4 dBTP |

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (10 of 10 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: notes 36, 48, 55, 60 (C2 C3 G3 C4), 375 ms each every 500 ms, then 48 held from 2 s to 4 s, velocity 1.
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

