# Shared DSP core

`public/worklets/synth-processors.js` holds the AudioWorklet processors every instrument shares. `lib/audio/dsp.ts` wraps them.
Device-specific processors live in `public/worklets/<id>-processors.js` (see ADDING_A_DEVICE.md).

| Processor | Wrapper | What it is |
|---|---|---|
| `vco` | `Vco` | Band-limited oscillator: tri / saw / pulse / sine (+ 2 subs). 4-point polyBLEP / polyBLAMP on every edge, sub-sample hard sync, through-zero FM, analog drift / tolerance, output mask |
| `ladder` | `Ladder` | Zero-delay-feedback 4-pole transistor ladder, every mode tap, optional 2x oversampled nonlinear core, bass-loss compensation |
| `env` | `Env` | AD / ADSR / AR plus delay and hold (DAHDSR), loop, analog RC curves, curvature, sample-accurate triggers, audio-rate gate, time CV |
| `svf` | `Svf` | Simper / Cytomic trapezoidal state-variable filter: LP2 LP1 BP HP1 HP2 notch peak, drive |
| `fdn-reverb` | `Reverb2` | 8-line modulated feedback-delay-network reverb with calibrated two-band decay (the old convolver `Reverb` is still there) |
| `chorus` | `Chorus` | BBD-style 1-2 voice stereo chorus |

**Compatibility.** `vco`, `ladder` and `env` keep exactly their original AudioParams (names, ranges, defaults, a-/k-rate) and output layouts. With default settings:
- the ladder reproduces the original output to 5e-5 (only the fast tanh differs);
- the envelope reproduces it exactly, or to 1.4e-4 while `timeCv` is audio-rate modulated. The one intended exception is a retrigger below the current level, which now ramps instead of clicking;
- the VCO is the same waveform with much less aliasing and 3 samples (62 µs) of latency.

Every existing wrapper constructor and method works unchanged, and new options are optional trailing arguments. Called without them, a wrapper builds exactly the node it built before.

## Performance rules

1. **AudioParams are expensive.** In Chrome each AudioParam costs about 3.4 ns per sample per node on every render quantum, idle or not. A bare node costs about 5 ns and each output channel 1-2 ns (measured with empty processors). That is as much as the DSP itself. So only modulation inputs are AudioParams. Everything else is a **setting**: `processorOptions` at construction, then `{ type: 'set', ... }` port messages, exposed as `wrapper.set({...})`. Envelope settings take an audio `time`.
2. **Per quantum when constant.** Coefficients (`tan`, `exp`, `2^x`, envelope rates) are computed once per 128-sample quantum when the params driving them are constant (`array.length === 1`), and per sample only while modulated.
3. **Fast math** on per-sample paths:

   | Function | Approximation | Accuracy |
   |---|---|---|
   | `exp2` | 6th-order polynomial | 1e-7 relative (0.0002 cents) |
   | tanh | [7/6] Padé | 1e-4, monotonic |
   | tan | [5/4] Padé | 3e-5 up to 0.45 fs |
   | sin(2πx) | odd polynomial | 7e-9 |

4. **Denormals and blow-ups.** Filter and loop states are flushed to 0 below 1e-20 at the end of each quantum. NaN or Infinity on any input resets the affected state instead of silencing the node for good, which the original VCO did.
5. **Pay only for what you use.** `vco.useOutputs('saw', 'pulse')` stops computing the other outputs. An idle `Reverb2` (silent input, tail below -140 dB) skips all work. Idle and sustaining envelopes fill a constant and return.

## Wrapper API (lib/audio/dsp.ts)

### Vco
```ts
new Vco(ctx, frequency = 220, options?: VcoOptions)
  .tri .saw .pulse .sine: GainNode     // outputs
  .sub1 .sub2: GainNode | null         // squares -1 / -2 octaves, only with { subs: true }
  .syncInput: AudioNode                // hard sync: connect a master oscillator
  .frequency .pitch .fm .pw .sync: AudioParam   // unchanged
  .set(settings: VcoSettings)          // change settings (next quantum)
  .useOutputs(...outs: ('tri'|'saw'|'pulse'|'sine'|'sub1'|'sub2')[])   // none = all
  .setDrift(cents, rateHz?)  .setTolerance(cents)
```

| VcoOptions / VcoSettings | Default | Meaning |
|---|---|---|
| `subs` (option only) | false | adds `sub1` and `sub2` (the node gets 6 channels; default layout stays 4) |
| `seed`, `phase` (options only) | random | reproducible drift / tolerance draws and start phase |
| `mask` | 63 | output bits tri 1, saw 2, pulse 4, sine 8, sub1 16, sub2 32 (`VCO_OUT`). Masked outputs are silent, cost nothing, and fade over one quantum on change |
| `drift`, `driftRate` | 0 cents, 0.25 Hz | analog drift: slow random pitch wander, about 1 sigma, clipped at 3 sigma |
| `tolerance` | 0 cents | fixed per-instance detune: tolerance × a random draw in -1..1 |
| `thruZero` | true | negative instantaneous frequency runs the phase backwards, the original behaviour; false = stop at 0 Hz like a classic linear-FM VCO |
| `fmRatio` | false | true: `fm` is a ratio of the frequency, f = f0 · (1 + fm). This is true through-zero linear FM with a constant index across the keyboard (fm = -1 is 0 Hz, -2 runs backwards at f0) |

Hard sync resets at the master's rising zero crossing, interpolated to a sub-sample position. Connect the master's `pulse`, `saw` or `sine` to `syncInput` and set `sync` to 1.

### Ladder
```ts
new Ladder(ctx, cutoff = 1000, options?: { quality?: 0 | 1; comp?: number })
  .input .output  .cutoff .cutoffCv .resonance .drive: AudioParam  .setMode('lp24'|'lp18'|'lp12'|'lp6'|'hp24'|'hp12'|'bp12')
  .set({ quality, comp })  .setQuality(0 | 1)  .setComp(0..1)
```
- `quality: 0` is the original 1x model.
- `quality: 1` is a 2x oversampled transistor core with a tanh on every stage. It costs about 3x the CPU (see benchmarks) and cuts nonlinear aliasing from -40 dB to -78 dB. Every mode tap works in both qualities.
- `comp` compensates the bass/passband loss that resonance causes in the low-pass modes. 0 is classic Moog, where resonance 1 loses 10 dB; 1 keeps the passband at 0 dB.

### Env
```ts
new Env(ctx, mode: 'ad'|'adsr'|'ar' = 'ad', options?: EnvSettings)
  .output .gateInput  .attack .decay .sustain .release .timeCv: AudioParam   .setMode() .setLinear()
  .trigger(time, velocity)  .gate(time, on, velocity)  .reset()
  .set(settings: EnvSettings, time?)  .setLoop(on, time?)  .setAnalog(on, time?)
```

| EnvSettings | Default | Meaning |
|---|---|---|
| `delay`, `hold` | 0 s | DAHDSR stages: delay before the attack, hold at the peak |
| `loop` | false | AD cycles until `reset()`. ADSR / AR repeat attack-hold-decay-release while the gate is held |
| `analog` | false | RC curves: the attack charges toward 1.5 × peak and stops at the peak (convex), with exponential decay and release |
| `shape` | 0 | curvature -1..1: + more convex (fast start), - concave (slow start), 0 = the mode's curve. The curve still reaches its target exactly at the stage time |

- **Timed settings.** `set(..., time)` applies from the render quantum containing `time`, at most 2.7 ms early. Schedule it at a trig's time for per-step (p-lock) changes.
- **Retrigger** continues from the current level. When a lower-velocity hit finds the level above its new peak, the attack ramps down to it over the attack time instead of jumping, which removes the click the old envelope made.

### Svf
```ts
new Svf(ctx, cutoff = 1000, mode: 'lp2'|'lp1'|'bp'|'hp1'|'hp2'|'notch'|'peak' = 'lp2')
  .input .output  .cutoff .cutoffCv .resonance .drive .mode: AudioParam  .setMode(mode)
```
- `cutoff` and `cutoffCv` (octaves) are a-rate. `resonance` runs 0..1, which is Q 0.5..25. `drive` runs 0..10 for input saturation, 0 = clean.
- It is a drop-in for the Analog Four's `a4-svf`. The numeric `mode` uses the same order 0..6, and responses match it within 0.05 dB. The exception is LP1 / HP1 above resonance 0: they are true 6 dB/oct slopes at 0 and gain a resonant peak above it, where `a4-svf`'s are plain one-poles.
- It stays stable under audio-rate cutoff modulation at full resonance.

### Reverb2 (and the old Reverb)
```ts
new Reverb2(ctx, seconds = 2.5, options?: { seed?: number; lowCut?: number; highCut?: number })
  .input .output: GainNode
  .decay .damping .preDelay .size .width .modDepth .modRate: AudioParam   // worklet params
  .wet .dry: AudioParam                                                   // native gains (dry 0 = send effect)
  .setSize(seconds)          // same call as Reverb.setSize: glides the decay, no rebuild
  .set({ lowCut, highCut })  // input tone
```
- **Drop-in for `Reverb`.** It has the same `input`, `output`, `damping`, `preDelay` and `setSize`, and its level matches within about 1 dB for 1-5 s decays.
- **Cheaper and live.** It costs 1.6x less CPU than the 2.5 s convolver, and decay, size and damping change live and smoothly. The old Reverb rebuilds its impulse response, so engines debounce it.
- **Damping semantics.** `damping` is the frequency where the decay time halves. The old Reverb's `damping` was an input low-pass, so the same number sounds a little brighter here.

### Chorus
```ts
new Chorus(ctx, options?: ChorusSettings & { phase?: number })
  .input .output: GainNode  .rate .depth .delay .feedback .width: AudioParam  .wet .dry: AudioParam
  .set({ voices: 1 | 2, lfoShape: 0 | 1, highCut, lowCut, drive })
```
- It is 100% wet by default, a send effect. For an insert, set `dry` to 1 and `wet` to taste.
- `voices: 2` (default) runs two BBD lines in anti-phase for stereo.

## Raw processors

For device code that builds nodes directly:

| Name | Inputs / outputs | AudioParams | processorOptions and `{type:'set'}` messages |
|---|---|---|---|
| `vco` | in: sync (ch 0), out: 4 ch (6 with `subs`) | frequency, pitch, fm, pw (a-rate), sync (k) | subs*, seed*, phase*, mask, drift, driftRate, tolerance, thruZero, fmRatio |
| `ladder` | 1 in, 1 out | cutoff, cutoffCv, resonance (a), drive, mode (k) | quality, comp |
| `env` | in: gate (audio, threshold 0.2), 1 out | attack, decay, sustain, release, mode, curve (k), timeCv (a) | delay, hold, loop, analog, shape. Messages `trig`, `gate`, `set` take `time`; `reset` clears |
| `svf` | 1 in, 1 out | cutoff, cutoffCv, resonance (a), drive, mode (k) | none |
| `fdn-reverb` | 1 in (mono or stereo), 2 out | predelay, decay, size, damping, width, mod, modRate (k) | seed*, lowCut, highCut |
| `chorus` | 1 in (mono or stereo), 2 out | rate, depth, delay, feedback, width (k) | phase*, voices, lfoShape, highCut, lowCut, drive |

\* construction only. `fdn-reverb` and `chorus` output 100% wet; the wrappers add the dry path.

**Offline rendering caveat.** In an OfflineAudioContext, Chrome hands port messages to processors only while rendering is suspended, sometimes one suspend late. Messages posted before `startRendering()` never arrive if nothing suspends. Realtime contexts are not affected. If you render offline, for tests or bounces, schedule `ctx.suspend()` points, as `app/bench/runner.ts` does.

## Design notes

**VCO.**
- *Phase pass.* Each quantum, one pass computes the phase per sample together with the naive waveforms. It records every discontinuity with its exact sub-sample position: wraps, the triangle's corners, pulse-width crossings (with the width interpolated within the sample), and hard-sync resets. Through-zero phase reversal is handled as a backward wrap.
- *Band-limiting.* Each event adds a 4-point polyBLEP (a step) and/or polyBLAMP (a slope change). These residuals come from the integrated cubic B-spline (Välimäki et al., "Antialiasing Oscillators in Subtractive Synthesis"; Esqueda, Välimäki, Bilbao, "Rounding Corners with BLAMP").
- *Latency and FIR.* The 4-point kernel needs 2 samples of look-back and the presence FIR 1 more, hence 3 samples of latency. The B-spline kernel rolls off the top octave. A 3-tap presence FIR (1.24, -0.12, -0.12) restores it to -1 dB at 10 kHz, as flat as the old 2-point polyBLEP, while keeping about 10 dB of the extra alias rejection.
- *Sync and subs.* Sync resets get a BLEP for the jump and a BLAMP for the slope change on every waveform, including the sine. The sub-octave squares are flip-flops clocked by the core's cycle starts, band-limited at the same sub-sample positions.

**Ladder.**
- *1x.* The original TPT (Zavalishin) one-pole cascade with a linear zero-delay feedback estimate and tanh at the input pair.
- *2x.* Polyphase IIR halfband up and down sampling: 2 × 3 allpasses, flat to 20 kHz, about 99 dB image rejection. In between runs Huovilainen's transistor ladder model, with tanh on every stage. Each tanh is linearised around its stage state (T = tanh(v)/v), so the 4-stage loop is still solved without a unit delay. The input pair uses the same linear estimate followed by an exact tanh.
- *Tuning.* The cutoff is corrected by the stages' average compression, which keeps self-oscillation within a few cents (measured up to resonance 1.1).

**SVF.** Andrew Simper's trapezoidal SVF (Cytomic technical paper SvfLinearTrapOptimised2). The mode outputs are mixes of input, band and low; LP1 = low + band and HP1 = high + band. Coefficients are recomputed per quantum, or per sample while modulated.

**Envelope.**
- *Stages.* One stage machine covers AD, ADSR and AR plus delay and hold. Triggers arrive as time-sorted port messages and are applied sample-accurately. The gate input is edge-detected per sample.
- *Curves.* Curved stages run an exponential toward an overshoot target, T = peak / (1 - e^-k), which reaches the stage target exactly at the stage time for any curvature k. `analog` sets k = ln 3, the 1.5 × peak RC target. `shape` adds ±6.

**FDN reverb.**
- *Structure.* Predelay, then a 3-stage diffuser (each stage: 8 delays, polarity flips and an 8-point Hadamard mix), then 8 feedback lines (31-83 ms × size) through a Householder matrix. Stereo comes out on two orthogonal Hadamard rows, and width is M/S.
- *Modulation.* Four lines are modulated (Catmull-Rom interpolation, which has gain ≤ 1, so the loop stays passive). The others read whole samples, so they add no interpolation damping.
- *Decay.* Each line has gain 10^(-3·len/(decay·fs)) and a one-pole Jot absorption filter. That filter's loss at `damping` equals the line gain again, so the RT60 halves there at any size.
- *Code.* The diffuser and lines are unrolled with per-line typed buffers, about 2.5x faster than the first version.

**Chorus.** One or two delay lines read with Hermite interpolation and modulated by a triangle or sine LFO in anti-phase. Each line has soft saturation at its input, feedback, a 2-pole Butterworth BBD band limit, and a wet low cut. The centre delay glides, so it never jumps in pitch.

## Measured quality

Node test harness, scratch scripts; the browser wrapper checks are in `/bench`.

- **VCO aliasing**, alias energy relative to the fundamental up to 20 kHz at 48 kHz, original → new:

  | Wave | 110 Hz | 440 Hz | 1.76 kHz | 4.19 kHz |
  |---|---|---|---|---|
  | saw | -44.6 → -55.0 dB | -38.6 → -49.1 | -31.7 → -41.5 | -27.9 → -38.2 |
  | pulse | -47.7 → -58.2 | -42.0 → -52.7 | -36.1 → -47.2 | -28.8 → -38.4 |
  | triangle | -79.4 → -88.2 | -62.1 → -86.5 | -44.1 → -71.9 | -31.4 → -55.4 |

  For hard sync (master 110 Hz, slave 337 Hz) alias energy drops 18-20 dB on every wave: saw +3.4 → -16.5 dB, pulse +4.9 → -14.5, tri -10.4 → -28.7, sine -1.3 → -20.6. Harmonic levels are within 0.5 dB of the original up to 8 kHz, and DC is unchanged.
- **Ladder.**
  - 2x core: nonlinear aliasing of a 5.3 kHz sine at 8 dBFS is -78 dB, against -40 dB at 1x.
  - Self-oscillation tracks within 0.5 cents (1x) and 2.3 cents (2x) from 440 Hz to 8 kHz.
  - Small-signal response matches 1x below 2 kHz.
- **Reverb2.** RT60 (T20) for `decay` 2 s is 1.95 s at 250 Hz and 1.94 s at 1 kHz. With `damping` 7 kHz it is 1.17 s at 8 kHz. The 4 kHz RT60 is identical at size 0.1 and size 1. It stays stable at 30 s decay with size sweeps and maximum modulation, and L/R correlation is about 0.
- **Envelope.** Delay and hold are exact to the sample. The analog attack is at 0.634 of the peak at half the attack time, as a 1.5 × peak RC charge should be. Retriggering at a lower velocity has a largest step of 0.004, against 0.2 before.

## Benchmarks

`/bench` renders everything offline at 48 kHz for 10 s, best of N. It is published on `window.__benchResults`. Run it headless with:

```
npm run build && npx next start -p 3110
node scripts/bench.cjs http://localhost:3110 /tmp/bench.json            # everything, best of 3
node scripts/bench.cjs http://localhost:3110 /tmp/bench.json "reps=5"
node scripts/bench.cjs http://localhost:3110 "" "only=devices&devices=dfam,sub37&reps=1"
node scripts/bench.cjs http://localhost:3110 "" "only=wrappers"         # browser self-checks of every wrapper
```

Open `/bench` on the iPad to measure the target itself.

- **Instruments.** Each one starts on an OfflineAudioContext with spec defaults and runs its transport control (or a keyboard riff) for 10 s. Main-thread timers are virtualised onto the audio clock at suspends. It runs once with the original core (`before`, embedded in `app/bench/legacy-processors.ts`) and once with the new one.
- **Processors.** N instances render with typical inputs, minus a baseline graph with the same sources. The result is ns of CPU per audio sample per instance (`% of a core` = that × 48 kHz).
- **Results below.** Chrome 141 headless, Linux x86-64, 4 vCPUs, best of 5. Other agents shared the machine, so single numbers move by about ±10%.

**Instruments** (×RT = seconds of audio rendered per second of CPU; higher is better):

| Instrument | Before ×RT | After ×RT | Change | Worklet nodes |
|---|---|---|---|---|
| DFAM | 33.0 | 35.9 | +9% | vco 2, ladder 1, env 3 |
| Mother-32 | 32.8 | 36.9 | +12% | vco 1, ladder 1, env 1 (+1 device) |
| Subharmonicon | 28.4 | 36.5 | +28% | ladder 1, env 2 (+3 device) |
| Sub 37 | 25.7 | 27.8 | +8% | ladder 1 (+6 device) |
| Analog Four MKII | 4.7 | 4.9 | +3% | vco 16, ladder 4, env 8 (+8 device) |
| Analog Rytm MKII | 15.5 | 16.4 | (no shared processors) | 0 |
| Xone:96 | 5.1 | 5.1 | (no shared processors) | 0 |
| Studio Clock | 800 | 870 | (silent) | 0 |

The Analog Four and the Xone:96 (about 20% of a core each) are the expensive instruments. Most of their cost is native nodes: the convolver reverbs, filters and delays, and 4 voices of oscillators. See the notes below.

**Processors** (ns of CPU per sample per instance; ×1.0 = same as before):

| Scenario | N | Before | After | Speed-up | After, % of a core |
|---|---|---|---|---|---|
| VCO, 4 outputs, steady pitch | 16 | 72.0 | 62.1 | 1.16× | 0.30% |
| VCO, pitch CV (a-rate) | 16 | 79.5 | 79.2 | 1.00× | 0.38% |
| VCO, audio-rate FM through zero | 16 | 66.8 | 66.4 | 1.01× | 0.32% |
| VCO, hard sync | 16 | 82.1 | 85.2 | 0.96× | 0.41% |
| VCO, `useOutputs('pulse')` | 16 | (new) | 43.2 | | 0.21% |
| VCO + 2 subs | 16 | (new) | 72.8 | | 0.35% |
| Ladder 1x, steady | 16 | 96.1 | 58.7 | 1.64× | 0.28% |
| Ladder 1x, cutoff CV | 16 | 133.5 | 73.0 | 1.83× | 0.35% |
| Ladder 2x (`quality: 1`) | 16 | (new) | 180.1 | | 0.87% |
| Ladder 2x, cutoff CV | 16 | (new) | 185.7 | | 0.89% |
| Env ADSR, retriggered 8 Hz | 32 | 57.8 | 38.9 | 1.49× | 0.19% |
| Env + time CV | 32 | 66.3 | 61.3 | 1.08× | 0.29% |
| Env idle | 32 | 39.9 | 30.4 | 1.31× | 0.15% |
| SVF steady (before: `a4-svf`) | 16 | 51.5 | 37.0 | 1.39× | 0.18% |
| SVF cutoff CV (before: `a4-svf`) | 16 | 75.8 | 45.5 | 1.67× | 0.22% |
| Reverb (before: convolver `Reverb`) | 4 | 448.8 | 281.1 | 1.60× | 1.35% |
| Chorus (before: native-node chorus) | 8 | 72.7 | 80.3 | 0.91× | 0.39% |

The VCO now does far more work per sample: 4-point kernels and BLAMP corners. It still costs the same as before because the per-quantum coefficients and fast math pay for it. Dropping unused outputs with `useOutputs()` saves a further 30% or so.

## Notes for device engines

- **VCO masks.** Call `vco.useOutputs(...)` with only the taps you connect. For example, Analog Four sub oscillators need `useOutputs('pulse')`, and the DFAM VCOs need tri + pulse. That saves about 30% per VCO, and on a waveform switch the change fades in one quantum.
- **Ladder quality.** `new Ladder(ctx, f, { quality: 1 })` gives a richer, alias-free, drive-friendly ladder. It costs about +0.6% of a core per instance, so it fits mono synths easily; on 4-voice devices, measure first. Add `comp` for a "non-Moog" passband.
- **Reverb2.** Swapping `new Reverb(...)` for `new Reverb2(...)` frees about 0.8% of a core per reverb (all of its cost while idle) and removes the impulse-regeneration debounce, because `setSize()` glides. Then retune `damping` by ear: it is now the decay-halving frequency.
- **Svf.** It can replace `a4-svf` directly (same modes and params, plus `drive`).
- **Chorus.** It replaces hand-built DelayNode choruses with a BBD-style sound. It's about the same cost.
- **Analog feel.** For per-voice instability, use `new Vco(ctx, f, { drift: 3, tolerance: 5 })` and `new Env(ctx, 'adsr', { analog: true })`. Keep drift small (2-5 cents) for tuned instruments.
- **Per-step envelope changes.** Use `env.set({ shape, hold, ... }, time)` at the trig time.
- **Budget.** Rough per-instance costs:

  | Node | Cost per instance |
  |---|---|
  | VCO | 0.3% of a core |
  | Ladder 1x / 2x | 0.3% / 0.9% |
  | Env | 0.15-0.3% |
  | Reverb2 | 1.4% (0 when idle) |

  Measure on the iPad with `/bench` before relying on these. As a rule of thumb, keep each instrument under about 10% of a core so a studio of 4-6 instruments plays without dropouts.
