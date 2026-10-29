# Audio QA meter calibration

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
