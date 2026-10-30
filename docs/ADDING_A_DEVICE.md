# Adding an instrument

Every instrument is a folder `devices/<id>/` that default-exports a `DeviceModule`
(`devices/types.ts`). The app renders, patches, plays and teaches it with no
other code changes. **`devices/dfam/` is the reference implementation — read it first.**

```
devices/<id>/
  spec.ts      controls, patch bay, presets      (types/index.ts)
  layout.ts    panel drawing in millimetres      (types/panel.ts)
  engine.ts    Web Audio engine                  (lib/audio/engine.ts, lib/audio/dsp.ts)
  lessons.ts   guided lessons                    (types/index.ts → Lesson)
  index.ts     export default { spec, layout, lessons, createEngine, ... }
```

Register it in `devices/index.ts` (code-split `load: () => import('./<id>')`).

## spec.ts
- `controls`: one entry per physical control. `knob` / `slider` (min, max, default,
  units, `curve: 'logarithmic'` for Hz / time / tempo — min must be > 0, `step` for
  detented controls, `format` for custom readouts), `switch` (options; value = index),
  `button` (`momentary` true for triggers), `pattern` (hidden step data, a string with
  one char per step, '0' = off).
- Paged UIs (Elektron) model **every parameter as its own control**
  (`bd_tune`, `bd_decay`…) plus UI-state switches (`track`, `page`) listed in
  `DeviceModule.uiControls`. Encoders bind to them with a function (see layout).
- `patchBay.inputs/outputs`: every jack, with `jackType` and `signalType`.
- `presets`: `settings` (control → value) and, for semi-modulars, `patchConnections`.
- Put `manualReference` ("p.12 – VCF") on controls and use the manual's names.

## layout.ts
- Units are **mm** from the faceplate's top-left; `pxPerMm` sets render size
  (aim for a faceplate 950–1450 px wide; the app scales it to fit).
- Control-like elements (knob, slider, switch, button, jack, led) use x/y as their
  **centre**; boxes (section, display, keyboard, stepgrid, custom) use **top-left**.
- Knob `control` can be a function `({ values, engine }) => controlId | null` — this is
  how encoders follow the selected track/page. Lessons highlight whatever an encoder is
  currently bound to.
- Buttons: `control` (toggle/momentary per spec), `setValue` (radio button that writes
  that value — page/track selectors), `event` (sent to `engine.event(name)` on press and
  `name:up` on release — pads, transport). Both can be combined.
- Touch: keep knobs ≥ 8 mm × pxPerMm ≈ 26 px, jacks are 6.2 mm, leave ≥ 3 mm between
  controls. Labels sit above controls by default.
- `theme`: faceplate background, legend colours, optional wooden `cheeks` or `frame`.

## engine.ts
Extend `BaseEngine`:

```ts
protected build() {           // build the graph; this.ctx / this.out are ready
  this.vco = new Vco(this.ctx, 110);
  ...
  this.outputs = { out_vco: { node: this.vco.saw } };
  this.inputs  = { in_cutoff: { params: [this.vcf.cutoffCv], scale: 5 } };
}
protected onParam(id, value) { ... }   // called for every control after build + on change
event(name) { ... }                    // button events
noteOn(note, vel) / noteOff(note)      // keyboards (DeviceModule.keyboard enables A–K keys)
```

- **Signal convention: 1.0 = 5 V.** A 1 V/oct input into a `pitch` param (octaves) uses `scale: 5`.
- Cables are real audio connections (`output.node` → gain(`scale`) → `input.params` /
  `input.node`). Trigger/clock cables use `EventBus` outputs and `onEvent` inputs.
  Break internal normals in `onConnect`, restore them in `onDisconnect`.
- DSP blocks (`lib/audio/dsp.ts`): `Vco` (tri/saw/pulse/sine, hard sync, FM, PWM,
  `pitch` in octaves), `Ladder` (LP24/18/12/6, HP24/12, BP12; `cutoffCv` octaves,
  resonance 0..1.2), `Env` (AD/ADSR/AR, `trigger(time, vel)` / `gate(time, on)`,
  `timeCv`), `Lfo`, `createNoise`, `createConstant`, `Delay`, `Reverb`, `createDrive`,
  `smooth()`, `setAt()`, `midiToHz()`.
- Timing: use `Clock` (look-ahead on the audio clock) and schedule at the tick `time`;
  update LEDs with `emitAt(time, { step })`. Never use `setInterval` for musical time.
- UI state: `this.emit({ playing, step, leds: {...}, ... })` → available to layout
  functions as `engine`.
- iPad budget: keep worklet nodes per instrument modest (≈ ≤ 40) and free everything in
  `onDispose`.
- Web Audio gotcha: `BiquadFilterNode.Q` is in **dB** for lowpass/highpass (it is a plain ratio
  only for bandpass/peaking/notch/allpass). A Butterworth stage (ratio 0.707) is `Q = -3.01`;
  a Linkwitz-Riley crossover is two of those cascaded - check that the bands sum flat.
- Device-specific worklets: put them in `public/worklets/<id>-processors.js` and list the
  URL in `DeviceModule.worklets`.

## lessons.ts
- 8+ lessons from beginner to advanced; 5–10 steps each.
- Every step: `instruction` (the move), `principle` (one sentence of first-principles
  synthesis / acoustics / music theory that transfers to any instrument), `explanation`
  (the why, 1–3 sentences), `manualReference`, and `concept` tags. Lessons list `concepts`.
- Step kinds: control (`control` + `targetValue`), patch (`patchFrom` + `patchTo`),
  informational (neither — waits for Next; end lessons with one that invites experimenting).
- Targets must be reachable: in range, valid switch index, existing jack ids. Paged UIs:
  first set `track`/`page` (radio buttons), then the parameter.
- Momentary buttons and pads: `{ kind: 'do', control: 'trigger' }` completes on a press;
  `presses: 3` asks for three; `event: 'pad:1'` targets a button that only sends an event;
  `play: { count: 4 }` or `play: { notes: [60, 64, 67] }` asks for notes. Checks can read
  `s.events?.<id>`, `s.notesPlayed` and live `s.engine`. `scope: 'spectrum'` opens the
  spectrum for EQ/filter steps. See docs/PEDAGOGY.md, "Lesson API v3".
- `solution` can also hold `presses`, `notes`, `studioCables` (ends named by `device` or
  `instance`), `transport: 'play'` and `instance`. `node scripts/lesson-runner.cjs` performs
  presses through the real panel buttons, and solves solution-less steps by trying single
  learner moves (a cable, the transport, a switch); it reports those as `auto`.

## Verify
```
npm run validate <id>                      # data checks (errors must be 0)
npx tsc --noEmit -p .                      # types
npm run build && npx next start -p 31xx    # then:
node scripts/smoke.cjs http://localhost:31xx <id> /tmp/out   # screenshots + real audio levels
```
Look at the screenshots: nothing overlapping, labels legible at iPad size (1180×820).

---

# v2: studio integration

Instruments run in a **studio**: several instances in a rack, owned by the engine hub
(`lib/studio/hub.ts`). Instances keep playing while you edit another, and the studio adds
a master transport, cables between instruments, audio routing into a mixer and a song
arranger. Read `lib/studio/hub.ts`, `lib/audio/transport.ts` and
`devices/studio-clock/index.ts`, which is a small reference that follows the transport.

## Transport sync (MIDI-clock style)
- Set `studio: { midiSync: true }` if the hardware syncs to MIDI clock (Elektrons, Sub 37 arp,
  Mother-32, Subharmonicon). The hub then calls `engine.followTransport(transport)` (or `null`).
- Override `protected onTransport(t: Transport | null)` in your engine:
  - When `t` is set, subscribe to `t.onTick(tick => ...)`. That gives 24 PPQN with audio
    `time`; a 16th note is 6 ticks. Also subscribe to `t.onEvent(e => ...)` for
    `start`/`stop`. Drive your sequencer from those instead of your own `Clock`.
  - When it's `null`, go back to your internal clock.
  - Always unsubscribe.
- While synced, the hub turns your `transportControl` (RUN/PLAY button) into studio Play/Stop
  and mirrors the studio state back into it. Don't start your internal clock from that param
  while `this.transport` is set.
- Clock-only gear (DFAM) is synced by patching Studio Clock CLOCK OUT into its clock input.
  Make sure clock/trigger inputs accept both `onEvent` (EventBus) and edge-detected audio pulses.

## Mixers
- A mixer lists `studio.mixerInputs: [{ id, label }]`: input jack ids that other instruments'
  main outputs can be routed into. Each must exist in `this.inputs` with a `node` (audio input),
  and `onConnect`/`onDisconnect` should switch that channel's source to the routed instrument.
- `engine.getMainOutput()` is your final output. The hub inserts a per-instrument gain after
  it (arranger mutes) and connects that to the master or a mixer input. Never connect to
  `ctx.destination` yourself.

## Cables between instruments
These need no extra work: the hub resolves `getOutput(jack)` on one engine and calls
`connectExternal(input, output)` on the other, which uses your `inputs` (scale, normals)
exactly like internal cables.

## Structured data (patterns, songs, kits, configs)
- `data: { initial: () => ({...}), migrate? }`. This is per-instance JSON, saved with the
  project. The engine receives it via `setData` and overrides `protected onData(data)`.
- Custom elements get `data`, `updateData(fn)`, `ui` and `setUi(patch)`. `ui` is ephemeral
  hand state: held trigs, the open menu, the visible step page.
- `interceptChange(id, value, api)` lets you capture knob moves. Return `true` when handled,
  for example by writing a parameter lock while a trig is held.
- `displayValues(api)` controls what the panel shows, for example the held step's locks.
- Elektron-style sequencing: use `lib/sequencer/elektron` and `components/sequencer`
  (see docs/ELEKTRON_SEQUENCER.md).

## Changing what a control means
Saved studios and project files must keep sounding the same after a rebuild. Renaming or
removing a control is safe: unknown ids are ignored and missing ones take their default.
These changes are not safe, and each needs an entry in `lib/studio/upgrades.ts`:
- **A new range, unit or taper.** The old saved number would mean something else. The
  entry's `apply` converts the old value. For example, the DFAM rebuild changed TEMPO from
  steps per minute to 16th-note BPM, so old values are divided by 4.
- **A new default.** Saves keep only the controls someone touched, so an untouched control
  would silently pick up the new default. List the old default in `oldDefaults`: it is
  filled in before `apply` runs.
- **A rebuild with no faithful conversion** (the Analog Four and Rytm redefined hundreds of
  ids). Set `reset: true` with `apply: () => ({})`. The instrument starts fresh, and the
  dropped values are kept in the browser and offered to the learner as a file (`lib/studio/legacy.ts`).

Bump `STORE_VERSION` and `PROJECT_VERSION` with each new entry. Each upgrade runs once on
older browser saves and project files, and on studios kept while a lesson ran. A renamed
lesson id goes in `LESSON_RENAMES`, so completions carry over. To find changed defaults and
removed ids between two commits, compare `specDefaults(<device>)` at both.

## Separate outputs
Hardware with individual outputs (the Rytm's voice outs, say) can offer them to the studio:
- Declare them in `studio.outputs: [{ id, label, stereo? }]`.
- Implement `connectOutput(id, destination | null)` on the engine. With a destination, send that part there and take it out of the main output; with `null`, put it back.
- The learner turns outputs on in the mixer (the instrument strip's **Outs** menu). Each one becomes a channel `<instance>/<id>` with its own fader, pan, sends, mute, solo, meter, route and stem.
- The arranger's mutes of the instrument mute its outputs too. Sets and lesson studios start with every output off.
- The main output must sound exactly as before while no output is connected.

## Files the learner brings in
An instrument that keeps a learner's own files outside the saved studio (the Rytm's user
samples, in IndexedDB) declares `assets: { has(data), collect(data), restore(list) }`. Project
files then carry them (mono 16-bit PCM, base64), and opening a project restores them before the
instrument's data loads. A project therefore opens complete in another browser, or in the iPad
Home Screen app, which keeps its own storage.

## Song arranger
- Pattern-based instruments provide `studio.patterns(data) => [{ id, label }]` and handle
  `event('arranger:pattern', { id, time })` by switching pattern at audio `time` (a bar line).
- Instruments without pattern memory get knob snapshots automatically.

## Auditions (lessons)
- `audition(api)` plays a short, characteristic phrase: a riff, one bar of the pattern, a few hits.
  Lessons call it for "listen to the target" while values are temporarily overridden in the
  engine. Return a stop function if you start something that must stop.

## Lessons v2
Follow docs/PEDAGOGY.md. `npm run validate <id>` checks every v2 field and warns about
missing pedagogy parts.
