# Synth Studio

**Playable digital twins of hardware instruments, wired into one studio, that teach
synthesis and production from first principles.**

Each instrument follows its real panel, signal flow and specs, built from the
manufacturers' manuals. It makes sound with a real-time Web Audio engine, can be
patched with cables, and comes with guided lessons. Instruments sync to one studio
clock, route into a mixer, and can be arranged into full tracks and bounced to WAV.

## Instruments

| Instrument | What it is |
|---|---|
| Moog DFAM | Semi-modular analog percussion: 8-step sequencer, 24-point patch bay |
| Moog Mother-32 | Semi-modular mono synth: 32-step sequencer, 32-point patch bay |
| Moog Subharmonicon | Subharmonic oscillators, two 4-step sequencers, polyrhythm generators |
| Moog Sub 37 | Duo-paraphonic analog synth with arpeggiator and 64-step sequencer |
| Elektron Analog Four MKII | Four-voice analog synth with parameter locks, trig conditions and songs |
| Elektron Analog Rytm MKII | Analog drum machine: 12 pads, 8 voices, scenes and performance macros |
| Allen & Heath Xone:96 | Analog DJ mixer; the studio routes instruments into its channels |
| Studio Clock | Clock, beat, reset and run outputs for syncing gear with cables |
| Your synth (MIDI) | Play and sequence your own hardware synth; a built-in Practice synth works without gear |
| Audio input | Bring an instrument's audio back in, with level metering |
| Web Audio plugin | Load WAM 2 plugin instruments and effects |

## The studio

- **One clock.** The ▶ in the top bar starts everything. MIDI-capable instruments follow the studio
  tempo. Instruments without MIDI (the DFAM, or the Mother-32's TEMPO input) follow
  clock pulses over a cable, exactly like hardware.
- **Mixing.** A channel strip per instrument: fader, pan, mute, solo, delay and reverb
  sends. Instruments can also go into the Xone:96. The master is clean, with a true-peak
  limiter at −1 dBTP and LUFS meters.
- **Arrangement.** Song sections with patterns, knob snapshots and mutes at bar lines; undo/redo.
- **Export.** Record the master to WAV, export stems, bounce the arranged song, or save the whole studio as a project file.

## Learning

Lessons follow [docs/PEDAGOGY.md](docs/PEDAGOGY.md):
- **Each lesson:** predict, observe, explain; ear-training "match the sound" challenges with fading hints; self-explanation.
- **Over time:** spaced daily review of past lessons.

The coach highlights the control to change and checks your result.

## Using it

- **Sound:** starts on your first tap or click (a browser rule). On iPad, use the Vercel
  preview (HTTPS); plain `http://` has no AudioWorklet. Add it to the Home Screen
  (Share → Add to Home Screen) to run full screen.
- **Knobs:** drag. For fine adjust, hold Shift, or on touch use a second finger, long-press or slide sideways. Double-tap resets.
- **Cables:** tap an output, then an input, or drag between them. Tap a cable to unplug it.
- **Keyboard:** A–K play notes; Z/X shift the octave; Space starts and stops the focused instrument.

## Architecture

```
devices/<id>/            one folder per instrument (see docs/ADDING_A_DEVICE.md)
  spec.ts layout.ts      controls, patch bay, presets; panel drawing in mm
  engine.ts index.ts     Web Audio engine; module (lessons, studio hooks, audition)
  REFERENCE.md           every panel element and spec, cited to the manual
public/worklets/         AudioWorklet DSP (shared VCO/ladder/env/SVF/reverb, plus per-device engines)
lib/audio/               AudioContext and master bus, transport, engine base, DSP wrappers (docs/DSP.md)
lib/studio/              EngineHub (rack, routing, cables, sync), mixer, arranger, history,
                         projects, saved-settings upgrades
lib/sequencer/elektron/  shared Elektron sequencer (docs/ELEKTRON_SEQUENCER.md)
lib/midi/ lib/wam/       Web MIDI and WAM plugin hosting (docs/EXTERNAL_GEAR.md)
components/              panel renderer and controls, teaching coach, studio UI
store/studio.ts          Zustand store (persisted, throttled)
```

## Development

```bash
npm install
npm run dev                      # http://localhost:3000
npm run validate                 # every device's spec, layout, presets and lessons
npx tsc --noEmit -p .            # type-check
npm run build && npx next start -p 3100
npm run test:e2e -- http://localhost:3100 --full    # regression suite: iPad journey, studio, every device's smoke and lessons
node scripts/audio-qa.cjs http://localhost:3100 all --target -18   # preset loudness, true peak, DC, clicks, stuck notes
npm run test:seq                 # Elektron sequencer unit tests
node scripts/bench.cjs http://localhost:3100 out.json   # CPU per instrument (or open /bench on an iPad)
```

Before merging, every change must pass: tsc, lint, validate, the build, the e2e suite and
audio QA. See [docs/STATUS.md](docs/STATUS.md) for current work and next actions.

## Deployment

The GitHub repo is connected to Vercel. Every push to a branch gets a preview URL
(shown on the commit and pull request), and merging to `main` deploys production.

## Sources and copyright

Specs, signal flow and patch settings come from the manufacturers' manuals and are
written in our own words. The manuals themselves are not part of this repository. See
[docs/research/COPYRIGHT-RULES.md](docs/research/COPYRIGHT-RULES.md).

*Synth Studio is an educational project and is not affiliated with Moog Music, Elektron or Allen & Heath.*
