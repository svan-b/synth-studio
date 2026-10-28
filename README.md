# Synth Studio

**Playable digital twins of hardware synthesizers that teach synthesis from first principles.**

Every instrument is drawn from its real panel layout, makes sound with a real-time
Web Audio engine, can be patched with cables, and comes with guided lessons. Each
lesson step tells you which control to move and gives a one-line principle behind
it, so you learn why the sound changes, not just where the knobs go.

## Instruments

| Instrument | Type |
|---|---|
| Moog DFAM | Semi-modular analog percussion, 24-point patch bay, 8-step sequencer |
| Moog Mother-32 | Semi-modular mono synth, 32-point patch bay, 32-step sequencer |
| Moog Subharmonicon | Subharmonic oscillators, polyrhythmic sequencers |
| Moog Sub 37 | Paraphonic analog keyboard synth |
| Elektron Analog Four MKII | Four-voice analog synth and sequencer with parameter pages |
| Elektron Analog Rytm MKII | Analog drum machine with 12 pads |
| Allen & Heath Xone:96 | Analog DJ mixer with dual VCF filters, with built-in sources |

## Using it

- **Sound** starts on your first tap or click (a browser rule). The badge in the toolbar shows the status and an output meter.
- **Knobs**: drag up/down. Hold Shift for fine control, double-tap to reset, or use the arrow keys when focused.
- **Patch cables**: tap an output jack, then an input (or drag between them). Tap a cable to unplug it.
- **Keyboards**: A–K on the computer keyboard play notes, Z/X shift the octave, multi-touch chords work on iPad. **Space** toggles the transport.
- **Presets** load from the toolbar, including their patch cables.
- **Lessons**: pick one from *Start a lesson*. The control to change pulses orange and turns green when it's set right, then the lesson moves on. Use Back/Skip or tap any step to jump to it.
- Works with mouse and touch. On iPad, use landscape. *Fit* scales the panel to the screen, and +/− zooms with sideways scrolling.

## Architecture

```
devices/<id>/          one folder per instrument (see docs/ADDING_A_DEVICE.md)
  spec.ts              controls, patch bay, presets
  layout.ts            panel drawing in millimetres
  engine.ts            Web Audio engine (extends BaseEngine)
  lessons.ts           guided lessons
devices/index.ts       registry (instruments are code-split)
components/panel/      generic panel renderer, cables, keyboard, step grid
components/controls/   knob, slider, switch, button
lib/audio/             shared AudioContext, engine base + patch router, DSP blocks
public/worklets/       AudioWorklet DSP: PolyBLEP VCO (sync/FM/PWM), ladder filter, envelopes
lib/controls/mapping.ts  value curves, formatting and lesson target matching
store/studio.ts        Zustand store: control values, cables, lesson progress (persisted)
```

Patch cables are real audio-rate connections in the Web Audio graph, with
hardware-style normals that break when you plug in. Musical timing runs on a
look-ahead scheduler that uses the audio clock.

## Development

```bash
npm install
npm run dev                 # http://localhost:3000
npm run validate            # check every device's spec, layout, presets and lessons
npx tsc --noEmit -p .       # type-check
npm run build
node scripts/smoke.cjs http://localhost:3000 <deviceId> ./out   # browser smoke test + audio levels
```

## Deployment

The GitHub repo is connected to Vercel. Every push to a branch gets a preview URL
(shown on the commit and pull request), and merging to `main` deploys production.

*Synth Studio is an educational project and is not affiliated with Moog Music, Elektron or Allen & Heath.*
