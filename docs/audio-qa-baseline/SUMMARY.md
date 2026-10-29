# Audio QA: all devices

7 devices, 86 presets, 37 flagged. Measured against http://localhost:3129, app code at `ec79288`. Generated 2026-10-29T00:35:37.615Z.

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

Master output during the one-channel reference: -22.81 LUFS, sample peak -19.81 dBFS (+0.19 LU through the master bus).

## Devices

| Device | Presets | Excitation | Output | Median LUFS | vs studio | Spread LU | IQR | Max TP dBTP | Master vs inst | Flagged | errors | silent | true-peak | stuck-tail | long-tail | clicks | dc | loudness |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| [DFAM](dfam.md) | 38 | audition | mono | -21.6 | 0.0 | 20.1 | 5.5 | -1.4 | +0.2 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| [Mother-32](mother32.md) | 10 | keys | mono | -19.1 | +2.4 | 20.6 | 13.1 | -10.6 | +0.2 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 5 |
| [Subharmonicon](subharmonicon.md) | 9 | keys | mono | -26.9 | -5.3 | 3.6 | 2.8 | -14.9 | +0.2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| [Sub 37](sub37.md) | 11 | keys | mono | -17.4 | +4.2 | 20.5 | 9.8 | +0.9 | +0.2 | 6 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 6 |
| [Analog Four MKII](analog-four.md) | 7 | transport | stereo | -31.5 | -10.0 | 12.0 | 7.4 | -10.0 | +0.2 | 5 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 4 |
| [Analog Rytm MKII](analog-rytm.md) | 6 | transport | stereo | -13.6 | +8.0 | 14.3 | 7.4 | +2.1 | -0.1 | 4 | 0 | 0 | 3 | 0 | 1 | 0 | 0 | 3 |
| [Xone:96](xone96.md) | 5 | transport | stereo | -21.7 | -0.1 | 10.9 | 1.0 | -5.7 | +0.2 | 2 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |

Studio median (median of the device medians): -21.6 LUFS. "vs studio" is how far each instrument's typical preset sits from it at the instrument output; "Master vs inst" is the level change through the master bus at that loudness.

## Worst problems

Ranked by severity (render errors, silence, true-peak overs and stuck notes first).

1. **analog-four / Detuned saw lead**: stuck-tail: -14.8 dBFS peak 2 s after stop and not decaying (-0.6 dB/s): a note, gate or drone is left on
2. **subharmonicon / Envelope PWM (cable)**: dc: 0.0547 (during the excitation; limit 0.005)
3. **analog-rytm / Breakbeat**: true-peak: +2.1 dBTP (sample peak +2.1 dBFS, 5810 samples at or above 0 dBFS in 812 overs); ceiling -1 dBTP
4. **analog-rytm / Techno - four on the floor**: true-peak: +1.4 dBTP (sample peak +1.4 dBFS, 37350 samples at or above 0 dBFS in 4333 overs); ceiling -1 dBTP
5. **sub37 / Wobble Bass**: true-peak: +0.9 dBTP (sample peak +0.9 dBFS, 476 samples at or above 0 dBFS in 10 overs); ceiling -1 dBTP
6. **mother32 / Delayed Vibrato (VC MIX as VCA)**: dc: 0.0161 (during the excitation; limit 0.005)
7. **mother32 / Self-Oscillating Filter (KB → MULT)**: loudness: -34.7 LUFS is -15.6 LU from the device target -19.1 LUFS (tolerance 4 LU)
8. **analog-rytm / Hip-hop boom bap**: true-peak: -0.5 dBTP (sample peak -0.6 dBFS); ceiling -1 dBTP
9. **mother32 / Acid Sequence**: loudness: -33.0 LUFS is -13.9 LU from the device target -19.1 LUFS (tolerance 4 LU)
10. **sub37 / Pluck**: loudness: -29.9 LUFS is -12.5 LU from the device target -17.4 LUFS (tolerance 4 LU)
11. **dfam / FX / Sync zap**: loudness: -13.4 LUFS is +12.2 LU from the FX target -25.6 LUFS (tolerance 4 LU)
12. **dfam / Metal / Sync bell**: loudness: -11.2 LUFS is +10.4 LU from the device target -21.6 LUFS (tolerance 4 LU)
13. **dfam / Hats / Metallic hat**: loudness: -31.3 LUFS is -9.7 LU from the device target -21.6 LUFS (tolerance 4 LU)
14. **xone96 / Live stem jam**: long-tail: -29.9 dBFS peak 2 s after stop, still decaying at -16.5 dB/s (long release or FX tail)
15. **dfam / Hats / Quick hats**: loudness: -12.7 LUFS is +8.9 LU from the device target -21.6 LUFS (tolerance 4 LU)
16. **dfam / FX / Laser zap**: loudness: -16.8 LUFS is +8.8 LU from the FX target -25.6 LUFS (tolerance 4 LU)
17. **sub37 / Arp Pulse**: loudness: -26.1 LUFS is -8.7 LU from the device target -17.4 LUFS (tolerance 4 LU)
18. **dfam / Bass / Sequenced bass**: loudness: -13.0 LUFS is +8.5 LU from the device target -21.6 LUFS (tolerance 4 LU)
19. **analog-four / Ambient drift**: loudness: -26.1 LUFS is +8.5 LU from the Drone / ambient target -34.5 LUFS (tolerance 4 LU)
20. **dfam / Snare / Rimshot**: loudness: -29.7 LUFS is -8.1 LU from the device target -21.6 LUFS (tolerance 4 LU)

## Not measured

- `studio-clock`: no presets
- `midi-synth`: no presets
- `audio-in`: no presets
- `wam-plugin`: no presets

