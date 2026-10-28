# Bring your own gear

Synth Studio can bring real hardware and browser plugins into the studio next to
the twins. You can play them, sequence them, record them and sync them to the
same transport.

| You have | Add | What it does |
|---|---|---|
| A hardware synth with MIDI | **Your synth (MIDI)** | CC knobs from a midi.guide template, a 16-step sequencer locked to the studio, a keyboard |
| An audio interface | **Audio input** | The synth's sound in the studio: mixed, routed, recorded with REC |
| A WAM 2 plugin URL | **Web Audio plugin** | A browser synth or effect as a studio instrument |
| A MIDI keyboard or controller | MIDI settings (header **MIDI** button) | Play the focused instrument, map knobs with MIDI learn |
| Drum machines, sequencers, a DAW | MIDI settings → Clock | Send the studio clock out, or follow an external clock |

All three devices are in the instrument list under **External**. You can add
several of each, for example two "Your synth" instances on channels 1 and 2 of a
multitimbral synth, or one per synth. Powering one off in the Studio view frees
it: the input stream closes, held notes stop, and the plugin is unloaded.

## Browser support

| | Chrome / Edge / Opera (desktop) | Firefox (desktop) | Safari (macOS) | iPad / iPhone (any browser) |
|---|---|---|---|---|
| Web MIDI (Your synth, controllers, clock) | yes | yes¹ | no | no |
| Audio input | yes | yes² | yes | yes |
| Web Audio plugins | yes | yes | yes³ | yes³ |

1. Firefox asks you to install a small "site permission add-on" the first time. That is how Firefox grants MIDI.
2. Firefox cannot mix an input running at a different sample rate from the output. Set both to the same rate (for example 48 kHz).
3. A plugin works only if its own code supports WebKit.

Web MIDI and audio input need a secure page: `https://` or `http://localhost`.
Where MIDI is missing, the MIDI dialog and the Your synth panel explain why and
point to Audio input, which works everywhere.

## Quick start: a hardware synth in the studio

1. Connect the synth by USB, or through a MIDI interface. Connect its audio output to your audio interface.
2. Press **MIDI** in the header, then **Enable MIDI**. The browser asks for permission once. Ports appear and disappear as you plug them in.
3. **+ Instrument → External → Your synth (MIDI)**. Press **Setup…**. Choose the MIDI output and the channel, then search for your synth in the template list. Press **Use N knobs** and then **Save**.
4. **+ Instrument → Audio input**. Press **Connect**, pick your interface, and set **MODE** to the input the synth is on.
5. Press **Play**, or Space. The sequencer plays the synth in time with the twins, and you hear it through the studio.

If you hear the synth twice (once through the studio and once directly), turn
off your interface's direct monitoring, or press **MUTE** on the Audio input.

## MIDI settings (header button)

- **Inputs**: each keyboard or controller, with an activity light. Untick an input to ignore it. Unticked inputs are released, so other apps can use them; on Windows only one app can open a port at a time. **plays** sends that input to the *focused instrument* (the tab you are on) or to a fixed instrument. **Channel** filters every input to one channel, or listens on all of them (omni).
  Notes and velocity play the target through the same path as the on-screen keys, so its keys light up. Pitch bend drives a `pitch_bend` control (Sub 37 wheel) and CC 1 drives a `mod_wheel` control. A note-off always goes to the instrument its note-on went to, even if you switch tabs in between.
- **Clock out**: tick the outputs that should follow the studio. Each one gets 24 pulses per quarter note, Start / Stop / Continue and Song Position, all with exact timestamps (see [Timing](#timing)). A port you tick while the studio is playing joins on the next 16th with Song Position and Continue. A port you untick gets a Stop. Swing is not sent: the clock stays even so the hardware can lock its tempo, so set swing on the hardware.
  - *Line hardware up with what you hear* adds the browser's output latency.
  - *Offset* moves everything in ms: + is later, − is earlier.
  - *Song Position + Continue* is used when the arranger starts mid-song.
- **Follow an external clock**: a drum machine or DAW becomes the master. Its tempo is fitted from the clock timestamps, and a gentle phase lock (at most ±2 %) keeps long takes from drifting. Its Start, Stop, Continue and Song Position drive the studio transport. Clock is never sent back to the port you follow.
- **MIDI learn**: press **Start MIDI learn**, touch a control on screen, then move a knob on your controller. The banner at the bottom shows what was mapped. Map as many controls as you like, then press **Done**.
  Values are scaled through the control's own curve (`normToValue`), so a log cutoff knob stays log. Switches step through their options, toggle buttons flip on each press, and momentary buttons follow the controller. Protocol CCs (bank select, data entry, NRPN/RPN, channel mode) are never learned. Mappings are kept in this browser. Remove them in the list.

MIDI settings belong to this computer, not to a project, so they are saved in
the browser. MIDI is only requested when you press a button. On the next visit
Synth Studio reconnects silently if the browser still grants access, and it
never shows a prompt by itself.

## Your synth (MIDI)

- **Setup…**: name, MIDI output, channel, timing trim (ms, per synth), template and knobs.
- **Templates** come from [MIDI Guide](https://midi.guide) by Pencil Research: CC maps for more than 450 instruments. The list loads when you open Setup, and each synth's map loads when you pick it. A template suggests up to 16 knobs (cutoff, resonance, envelopes and so on). Tick the ones you want, or type CC numbers from your manual.
  Firmware versions differ, so check the numbers against the manual and fix mistakes upstream at github.com/pencilresearch/midi. The data is CC BY-SA 4.0; see `public/midi-guide/LICENSE.md`.
- **Knobs**: each knob has a label, a CC number and a range. The range is the CC values at the knob's ends; reverse them to invert the knob. A knob with an **LSB** controller (14-bit, for example Sub 37 cutoff CC 19/51) sends MSB then LSB for smooth sweeps. Bipolar parameters show ± around their centre. Knobs move with the mouse, touch, arrow keys, or a learned controller knob.
- Opening a project **never sends the knobs**, because that would overwrite the patch on your synth. **Send all** pushes the whole panel on purpose. **Panic** sends note-offs, All Notes Off and All Sound Off.
- **Sequencer**: 16 steps. Tap a step to turn it on or off. To enter notes, tap a step's note name and play a key, on screen, on your computer keyboard (A–K, Z/X for octave) or on a MIDI keyboard. The note is written and the selection moves on. ◀ ▶ −1 +1 −12 +12 and *vel* edit the selected step.
  **GATE** is the note length as a share of a 16th. **LENGTH** makes 1–16 step loops, and odd lengths give polymeters. **TRANSPOSE** shifts the whole pattern. **SEQ** off keeps the synth quiet while the studio plays.
  Each step's note-on and note-off are sent together, ahead of time, with timestamps. A note can't hang, and a note-off always lands before the next note-on.
- **PLAY** (or Space) starts the studio transport. With *Sync to studio clock* unticked in the Studio view, PLAY runs the sequencer on its own clock at the studio tempo.
- **Keyboard and MIDI thru**: on-screen keys, computer keys and MIDI input (when this instrument is focused) go to the synth on its channel. Bend, CCs and aftertouch from your controller are re-addressed to that channel too.
  Echo guard: notes coming in from the same device you send to are ignored. With local control on, the synth would otherwise play each note twice.

## Audio input

- **Connect** opens the input. Pick an interface from the list (names appear once access is granted). Echo cancellation, noise suppression and auto gain are **off**, because those voice-call filters would mangle a synth. Synth Studio reconnects on the next visit if the browser still grants access, and it never prompts by itself.
- **MODE**:
  - IN 1 / IN 2: one input in the middle, for a mono synth.
  - L+R: both inputs summed.
  - STEREO: input 1 left, input 2 right.
  - A mono device always plays input 1.
- **GAIN** is ±24 dB. Aim for the yellow on the meter. **CLIP** lights when the signal hits 0 dBFS. **MUTE** silences the output but keeps the meter running.
- **Latency**: the panel shows the input latency (Chrome reports it), the output latency (`ctx.outputLatency`) and the base latency (`ctx.baseLatency`). Their sum is roughly how much later the hardware reaches your ears than the twins do.
- **Routing**: the output goes to the master by default, or to a mixer channel (Studio view → Output). Patch OUT L / OUT R into another instrument's input, or into a Web Audio plugin's IN. REC records it with everything else.
- If the interface is unplugged, the panel says so, and it reconnects automatically when the interface comes back.

## Web Audio plugin

- **Choose plugin…** lists known WAM 2 instruments and effects from the wam-community collection on webaudiomodules.com. You can also paste the URL of any plugin's `index.js`; a folder URL gets `index.js` added.
  The list entries are marked **unverified**: that site could not be reached while this was built. Every entry was loaded in this host from the identical files in the `wam-community` npm package, and instruments were played and effects fed with audio.
- **Trust**: a plugin is JavaScript from another site, running inside this page with the same access as Synth Studio. Load only plugins you trust. You confirm each site once, per browser.
  A project or studio set that names a plugin from a site you haven't trusted waits for you. It shows *Trust & load* and fetches nothing until you press it.
- **Instruments** play from the on-screen keys, from A–K on the computer keyboard, and from MIDI input when focused. These arrive as `wam-midi` events through `audioNode.scheduleEvents`. **Effects** process whatever you patch into **IN**. **BYPASS** passes IN through dry.
- **Open plugin window** shows the plugin's own interface in an overlay. Closing the window saves the plugin's state with the project, when the plugin can export it as JSON.
- With *Sync to studio clock* ticked, the plugin gets the studio tempo and play state as `wam-transport` events, at start, stop, tempo changes and every bar.
- Errors are explained:
  - unreachable host or blocked by CORS
  - 404
  - a web page instead of a module
  - a file served as plain text (raw.githubusercontent.com does this; use GitHub Pages or another static host)
  - not a WAM
  - the plugin failing to start
  - a 20 s timeout

## Timing

Everything musical is scheduled on the audio clock. Transport ticks carry the
`AudioContext` time at which they sound, about 100 ms ahead. MIDI is scheduled
in `performance.now()` milliseconds, with

```
timestamp = performance.now() + (tickTime - ctx.currentTime) * 1000 + ctx.outputLatency * 1000 + offset
```

so the hardware plays when you *hear* the twins, not when the main thread runs.

Browsers advance `currentTime` once per audio callback, in steps of up to about
20 ms. A raw `performance.now() - currentTime` sample would therefore wobble by
up to a callback. `lib/midi/time.ts` (`AudioClockSync`) keeps the smallest
offset seen over the last two seconds. That is the sample taken right after
`currentTime` moved. The estimate may then move only 2 ms per second, enough to
follow clock drift and too slow for a stray sample to bend the beat. It restarts
if the timeline really jumps, for example when the context was suspended. It is
sampled in the background once MIDI is on, so the first beat after Play is
already exact.

In testing, MIDI clock intervals stayed within 0.1 ms in Chrome, where the raw
formula wobbled by up to 10 ms. MIDI clock and every "Your synth" sequencer
share this mapping, so a note and the clock tick under it carry the same
timestamp.

`ctx.baseLatency` is shown but not added. If a synth still sounds early or late,
use the per-synth *timing trim* or the global *Offset*. If you monitor hardware
back through Audio input, its sound arrives about one input latency later, so a
negative offset of that size lines it up.

## Troubleshooting

- **MIDI is blocked**: allow MIDI in the site settings (the icon left of the address), then press Enable MIDI again.
- **No ports**: plug the device in. It appears by itself. On Windows, close other apps that hold the port.
- **Notes twice**: turn off local control on the synth, or rely on the echo guard (input and output must share the device's name).
- **Hardware drifts or stutters on clock**: untick *Line hardware up…* to test. Some devices smooth clock slowly, so give them a bar.
- **Audio input silent**: check MODE (IN 2 on a mono device plays nothing). In Firefox, use the same sample rate on the interface and the output.
- **Plugin will not load**: read the panel's message. The plugin's host must allow cross-origin loading (CORS) and serve it as JavaScript.

---

# Developer notes

```
lib/midi/
  support.ts     browser detection and the friendly messages (Safari, iPad, insecure page)
  access.ts      MidiService: permission from a button, ports, hot-plug, input filter, send(bytes, ts)
  bytes.ts       message builders and parser (no browser APIs)
  router.ts      MidiRouter: notes -> focused/chosen instance, bend/mod, learned CCs, raw MIDI to MidiReceiver devices
  learn.ts       midiLearnTouch() (DeviceHost calls it on every control change), labels
  apply.ts       ControlWriter: coalesces MIDI-driven control writes to one store update per frame
  clock-out.ts   MidiClockOut: transport -> 24 PPQN + Start/Stop/Continue/SPP
  clock-in.ts    MidiClockIn: follow external clock (tempo fit, phase lock)
  time.ts        audioToMidiTime(), AudioClockSync (steady mapping), audioClock (shared)
  index.ts       wiring: initMidi(), useMidiSnapshot(), useMidiFocus()
  __tests__/     unit tests (npx tsx <file>) and the browser check (external-gear.e2e.cjs)
store/midi.ts    persisted MIDI settings + mappings (useMidiStore), learn session (useMidiLearn)
components/midi/ MidiButton (header button + learn banner), MidiSettings (dialog)
lib/wam/         host.ts (initWamHost, loadWam, wamMidi, wamTransport), plugins.ts (curated list), trust.ts
devices/midi-synth/  config.ts (data, CC scaling, templates), sequencer.ts (pure), engine.ts, ui.tsx, setup.tsx, templates.ts, guide.ts
devices/audio-in/    engine.ts (getUserMedia graph, meters), ui.tsx
devices/wam-plugin/  engine.ts (plugin lifecycle, MIDI, transport, GUI), ui.tsx
scripts/build-midi-guide.ts   midi.guide CSV -> public/midi-guide/*.json
```

**Hooks into shared files** (deliberately small):

- `devices/index.ts`: three registry entries, category `External`.
- `components/DeviceHost.tsx`: `midiLearnTouch(instance, id)` at the top of `onChange`, and `useMidiFocus(instance, keyboardActive, handleNoteOn, handleNoteOff)`. Only the focused host registers, and notes go through its handlers.
- `app/page.tsx`: `<MidiButton />` in the header.

**A device that takes raw MIDI** implements `MidiReceiver` (`lib/midi/router.ts`)
on its engine:

- `receiveMidi(bytes, timeStamp)` gets bend, CCs (unless learned), aftertouch and program change.
- Notes still arrive through `noteOn` / `noteOff`.
- `ignoresInput(portName)` is the echo guard.

`hub.getEngine(instance)` is checked with `isMidiReceiver()`, so no registration
is needed.

**Scheduling MIDI from an engine**:

```ts
midi.send(output, bytes, audioClock.toMidiTime(this.ctx, audioTime, { compensate, offsetMs }));
```

Use the shared `audioClock` so your messages agree with MIDI clock out. Send
note-ons and their note-offs together, ahead of time.

**Device data**: each device keeps its configuration in `DeviceModule.data`,
which is per instance and saved with the project. The `asData` / `asInputData` /
`asWamData` accessors check the shape, not only a version number: for one
render after switching instruments, a panel can be handed another device's
data.

**midi.guide data**:

- `npx tsx scripts/build-midi-guide.ts` clones github.com/pencilresearch/midi into a temp dir; `--src <clone>` uses a local copy.
- Output: `public/midi-guide/index.json` (~50 KB, loaded first), `devices/<id>.json` (one per instrument, loaded on demand) and `LICENSE.md` (attribution, changes, CC BY-SA 4.0 text). The derived JSON stays CC BY-SA 4.0. Keep the attribution in the UI (Setup footer, panel template link).
- Knob suggestions live in `devices/midi-synth/guide.ts` (`suggestKnobs`).

**WAM host**: `loadWam(url, ctx, { state })`:

1. Calls `initializeWamHost` once per context.
2. Checks the URL and a preflight `fetch` for clear errors.
3. Runs `import(/* webpackIgnore: true */ url)`.
4. Runs `WAM.createInstance(groupId, ctx)`.
5. Applies `setState(state)`.

It returns the node and the descriptor facts. `hasAudioInput` comes from the
node's real `numberOfInputs`, because the SDK's default descriptor claims an
input. `trust.ts` decides what may load without asking.

**Tests**:

```
npx tsx lib/midi/__tests__/clock-out.test.ts     # clock out + steady mapping
npx tsx lib/midi/__tests__/clock-in.test.ts      # external clock follower
npx tsx lib/midi/__tests__/router.test.ts        # input routing, learn, echo guard
npx tsx devices/midi-synth/__tests__/sequencer.test.ts
# Browser (Playwright, Chromium; mocked Web MIDI, fake capture device):
npm run build && npx next start -p 3107
node lib/midi/__tests__/external-gear.e2e.cjs http://localhost:3107 /tmp/out [pluginBaseUrl] [plugins.json]
```

The last two arguments point the WAM checks at a local static copy of the
`wam-community` npm package, `http-server <pkg>/dist/plugins --cors`.
