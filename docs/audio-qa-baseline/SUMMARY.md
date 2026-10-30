# Audio QA: all devices

7 devices, 271 presets, 2 flagged. Measured against http://localhost:3100, app code at `04019ab`. Generated 2026-10-29T17:31:53.883Z.

## Meter calibration

Test signals injected into the instrument tap (the slot's outGain, dfam) and measured through the same capture as the presets, 44100 Hz.

| Test | Measured | Expected | Result |
|---|---|---|---|
| 1 kHz sine at -20 dBFS in one channel (BS.1770 reference) | sample peak -20.00 dBFS, integrated -23.00 LUFS | -20 dBFS +-0.05, -23.01 LUFS +-0.3 | pass |
| 1 kHz sine at -20 dBFS from a mono node (heard on L and R) | sample peak -20.00 dBFS, integrated -19.99 LUFS | -20 dBFS +-0.05, -19.99 LUFS +-0.3 | pass |
| fs/4 sine at 45 deg, amplitude -6.02 dBFS (inter-sample peaks) | sample peak -9.03 dBFS, true peak -5.94 dBTP | -9.03 dBFS +-0.05, -6.02 dBTP +0.2/-0.4 | pass |
| constant +0.01 (DC offset) | DC 0.0100 | 0.0100 +-0.0002 | pass |
| 1 kHz sine at -20 dBFS with a 90 deg phase jump | clicks 1, mid-sound clicks 1 | 1 exactly, 1 exactly | pass |
| nothing connected (the idle instrument) | peak -inf dBFS, silent flag 1 (1 = raised) | peak below -70 dBFS, 1 (1 = raised) exactly | pass |
| 1 kHz sine at -20 dBFS left on after stop | tail peak 2 s after stop -20.00 dBFS | -20 dBFS +-0.1 | pass |

Master output during the one-channel reference: -23.00 LUFS, sample peak -20.00 dBFS (-0.00 LU through the master bus).

## Devices

| Device | Presets | Excitation | Output | Median LUFS | vs studio | Spread LU | IQR | Max TP dBTP | Master vs inst | Flagged | errors | silent | true-peak | stuck-tail | long-tail | clicks | dc | loudness |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| [DFAM](dfam.md) | 40 | audition | stereo | -19.1 | -0.5 | 5.2 | 1.5 | -2.2 | 0.0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| [Mother-32](mother32.md) | 43 | audition | stereo | -18.1 | +0.5 | 8.9 | 1.5 | -1.8 | 0.0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| [Subharmonicon](subharmonicon.md) | 36 | audition | stereo | -18.4 | +0.1 | 5.6 | 2.2 | -1.5 | 0.0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| [Sub 37](sub37.md) | 64 | audition | stereo | -18.0 | +0.5 | 5.2 | 0.6 | -3.5 | 0.0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| [Analog Four MKII](analog-four.md) | 47 | audition | stereo | -19.0 | -0.4 | 7.6 | 2.2 | -1.6 | 0.0 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| [Analog Rytm MKII](analog-rytm.md) | 20 | audition | stereo | -18.9 | -0.4 | 3.3 | 2.2 | -1.7 | 0.0 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| [Xone:96](xone96.md) | 21 | audition | stereo | -18.6 | 0.0 | 5.7 | 0.8 | -1.7 | 0.0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Studio median (median of the device medians): -18.6 LUFS. "vs studio" is how far each instrument's typical preset sits from it at the instrument output; "Master vs inst" is the level change through the master bus at that loudness.

## Worst problems

Ranked by severity (render errors, silence, true-peak overs and stuck notes first).

1. **analog-rytm / Breaks / Big Beat**: clicks: 1 (1 mid); worst step 6.6 dBFS; first at 3.6992 s
2. **analog-four / Bass / Metallic AM**: clicks: 1 (1 mid); worst step -34.4 dBFS; first at 1.5546 s

## Not measured

- `studio-clock`: no presets
- `midi-synth`: no presets
- `wam-plugin`: no presets
- `audio-in`: plays a live audio input only

