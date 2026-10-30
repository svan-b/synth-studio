# Bring your own gear

Synth Studio can bring real hardware and browser plugins into the studio next to
the twins. You can play them, sequence them, record them and sync them to the
same transport. With no gear at all, built-in stand-ins (the **Practice synth**,
a **test tone** and two **built-in plugins**) let you learn the whole workflow,
on any browser, including iPad.

| You have | Add | What it does |
|---|---|---|
| A hardware synth with MIDI | **Your synth (MIDI)** | CC knobs from a midi.guide template, program changes, a 16-step sequencer locked to the studio, a keyboard, a MIDI monitor |
| An audio interface (or a mic) | **Audio input** | The synth's sound in the studio: metered, mixed, routed, recorded as a take or with REC |
| A WAM 2 plugin URL | **Web Audio plugin** | A browser synth or effect as a studio instrument |
| A MIDI keyboard or controller | MIDI settings (header **MIDI** button) | Play the focused instrument, map knobs with MIDI learn |
| Drum machines, sequencers, a DAW | MIDI settings → Clock, or Setup → *Send MIDI clock* | Send the studio clock out, or follow an external clock |
| Nothing yet | **Your synth (MIDI)** on the Practice synth, **Audio input** on Practice synth or Test tone, the built-in plugins | Every lesson and every step of the setup, without hardware |

All three devices are in the instrument list under **External**. You can add
several of each (spare capacity): two "Your synth" instances on channels 1 and 2
of a multitimbral synth, one per synth, one Audio input per interface input pair.
Each one is named after its gear in the rack, the routing menus and MIDI settings.
Powering one off in the Studio view frees it: the input stream closes, held
notes stop, and the plugin is unloaded.

## Browser support

| | Chrome / Edge / Opera (desktop) | Firefox (desktop) | Safari (macOS) | iPad / iPhone (any browser) |
|---|---|---|---|---|
| Web MIDI (your synth, controllers, clock to hardware) | yes | yes¹ | no | no |
| Practice synth (Your synth, clock, lessons) | yes | yes | yes | yes |
| Audio input | yes | yes² | yes | yes⁴ |
| Web Audio plugins | yes | yes | yes³ | yes³ |

1. Firefox asks you to install a small "site permission add-on" the first time. That is how Firefox grants MIDI.
2. Firefox cannot mix an input running at a different sample rate from the output. Set both to the same rate (for example 48 kHz).
3. The built-in plugins always work; a web plugin works only if its own code supports WebKit.
4. A class-compliant USB audio interface (through a USB-C or Lightning adapter) or the built-in microphone.

Where Web MIDI is missing, nothing breaks and nothing is a dead end:

- The **MIDI** dialog says why, kindly (every iPad browser is WebKit, which leaves Web MIDI out), lists what works there, and says what to use for MIDI gear: **Chrome or Edge on a computer**.
- **Your synth** plays the Practice synth, and its header says so in one line. Setup explains the same and keeps the Practice synth as the output.
- MIDI learn is explained, not offered. Clock out lists the Practice synth, so the clock lessons work.

Web MIDI and audio input need a secure page: `https://` or `http://localhost`.

## Quick start: a hardware synth in the studio

1. Connect the synth by USB, or through a MIDI interface. Connect its audio output to your audio interface.
2. Press **MIDI** in the header, then **Enable MIDI**. The browser asks for permission once. Ports appear and disappear as you plug them in.
3. **+ Instrument → External → Your synth (MIDI)**. Press **Starters → Setup / Hardware synth on channel 1 with clock**, or **Setup…**: choose the MIDI output and the channel, tick *Send MIDI clock* if its arpeggiator should follow, then search for your synth in the template list. Press **Use N knobs** and then **Save**.
4. **+ Instrument → Audio input**. Choose **Interface / mic**, press **Connect**, pick your interface, set **MODE** to the input the synth is on, and press **Check level**.
5. Press **Play**, or Space. The sequencer plays the synth in time with the twins, and you hear it through the studio. **Record take** on the Audio input records it.

If you hear the synth twice (once through the studio and once directly), turn
off your interface's direct monitoring, or press **MUTE** on the Audio input.

## The Practice synth

A synth at the end of a virtual MIDI cable, built into Synth Studio. It is listed
as an output called *Practice synth (built in)* everywhere real ports are, so the
workflow is the same with and without gear. A new "Your synth" plays it.

| Channel | Part | Programs (program change 1-4, then they repeat) |
|---|---|---|
| 1 | Bass: mono, last-note priority, glide | Saw bass, Square bass, Acid bass, Sub bass |
| 2 | Keys: 6 voices, sustain pedal (CC 64) | Bright lead, Square lead, Soft pad, Pluck |
| 10 | Drums: General MIDI notes (36 kick, 38 snare, 39 clap, 42/44/46 hats, toms, cymbals) | Analog kit, Tight kit |

Nothing listens on the other channels, on purpose: that is what channels are
for, and the lessons use it. It follows velocity (louder and brighter), pitch
bend (±2 semitones), and these CCs: 1 mod wheel (vibrato), 5 glide, 7 volume,
10 pan, 11 expression, 71 resonance, 72 release, 73 attack, 74 cutoff, 75 decay,
76/77 vibrato rate/depth, 80 arpeggiator on/off, 120/123 all sound/notes off,
121 reset controllers. A program change recalls the program's settings; CCs then
move them, as on hardware.

Its **arpeggiator** (CC 80 ≥ 64, latched, up, 16ths) follows MIDI clock when it
arrives (Start restarts it, Stop halts it) and runs at its own 104 BPM otherwise,
so you can hear the difference clock makes.

Its sound plays **directly** (like a synth on headphones) until an Audio input
picks *Practice synth*: then the direct sound switches off, as you would turn off
direct monitoring on an interface, and the sound comes into the studio through
the input. It is calibrated to peak around -12 dBFS there.

## MIDI settings (header button)

- **Inputs**: each keyboard or controller, with an activity light. Untick an input to ignore it. Unticked inputs are released, so other apps can use them; on Windows only one app can open a port at a time. **plays** sends that input to the *focused instrument* (the tab you are on) or to a fixed instrument. **Channel** filters every input to one channel, or listens on all of them (omni).
  Notes and velocity play the target through the same path as the on-screen keys, so its keys light up. Pitch bend drives a `pitch_bend` control (Sub 37 wheel) and CC 1 drives a `mod_wheel` control. A note-off always goes to the instrument its note-on went to, even if you switch tabs in between.
- **Clock out**: tick the outputs that should follow the studio, including the built-in Practice synth. Ports a "Your synth" sends clock to are ticked too, marked *from Bass, Lead*; each port gets one clock however many synths share it. While the studio plays, ticked ports show *running*. Each port gets 24 pulses per quarter note, Start / Stop / Continue and Song Position, all with exact timestamps (see [Timing](#timing)). A port you tick while the studio is playing joins on the next 16th with Song Position and Continue. A port you untick gets a Stop. Swing is not sent: the clock stays even so the hardware can lock its tempo, so set swing on the hardware.
  - *Line hardware up with what you hear* adds the browser's output latency (shown as n/a where the browser does not report it, for example Safari before 18.4).
  - *Offset* moves everything in ms: + is later, − is earlier.
  - *Song Position + Continue* is used when the arranger starts mid-song.
- **Follow an external clock**: a drum machine or DAW becomes the master. Its tempo is fitted from the clock timestamps, and a gentle phase lock (at most ±2 %) keeps long takes from drifting. Its Start, Stop, Continue and Song Position drive the studio transport. Clock is never sent back to the port you follow.
- **MIDI learn**: press **Start MIDI learn**, touch a control on screen, then move a knob on your controller. The banner at the bottom shows what was mapped. Map as many controls as you like, then press **Done**.
  Values are scaled through the control's own curve (`normToValue`), so a log cutoff knob stays log. Switches step through their options, toggle buttons flip on each press, and momentary buttons follow the controller. Protocol CCs (bank select, data entry, NRPN/RPN, channel mode) are never learned. Mappings are kept in this browser. Remove them in the list.
  Learned to a "Your synth" knob, a controller knob sends the synth's own CC: controller CC 21 → panel knob → synth CC 43, with nothing reprogrammed.

MIDI settings belong to this computer, not to a project, so they are saved in
the browser. MIDI is only requested when you press a button. On the next visit
Synth Studio reconnects silently if the browser still grants access, and it
never shows a prompt by itself.

## Your synth (MIDI)

- **Header**: the synth's name, where the MIDI goes (*Test Synth · ch 2*, or *Practice synth · ch 1 · Bass part*), whether it gets clock (*no clock*, *clock ready*, *clock running* with a light on every beat), and an activity light. One line of advice below: a channel clash, a channel the Practice synth doesn't listen on, the browser's MIDI support, or how you hear the Practice synth.
- **Starters** sets up a common rig in one tap, by category:
  - *Setup*: Practice synth bass on channel 1, keys on 2, drums on 10; Hardware synth on channel 1 with clock; Second synth on channel 2; Drum machine on channel 10 with clock.
  - *Sequence*: Acid line, Off-beat bass, Empty pattern.
  - *Knobs*: General MIDI sound controllers, Practice synth controls.
  Each sets only what its name says. A hardware starter with no synth connected opens Setup so you can choose the output.
- **Setup…**, in the order you set up gear:
  1. *Where the MIDI goes*: name (also its name in the rack and menus), MIDI output (*Practice synth (built in)* or your ports), channel, *Send MIDI clock to this synth*. Channels another synth already uses on that output are marked; choosing one warns you and offers the first free channel.
  2. *Template*: [MIDI Guide](https://midi.guide) by Pencil Research, CC maps for more than 450 instruments. **Search** (results grouped by manufacturer; Enter opens the first) or browse **By manufacturer** (132 makers, A-Z, with counts). The list loads when you open Setup, and each synth's map loads when you pick it. A template suggests up to 16 knobs (cutoff, resonance, envelopes and so on). Tick the ones you want.
     Firmware versions differ, so check the numbers against the manual and fix mistakes upstream at github.com/pencilresearch/midi. The data is CC BY-SA 4.0; see `public/midi-guide/LICENSE.md`.
  3. *Knobs*: label, CC number, range (the CC values at the knob's ends; reverse them to invert the knob) and the 14-bit **LSB** controller (Sub 37 cutoff CC 19/51 sends MSB then LSB for smooth sweeps). **Learn** takes a knob's CC from the next CC your synth sends when you turn its own knob (a second CC 32 higher becomes the LSB). *Practice synth* and *Generic* fill in those maps.
  4. *Program change and timing*: bank select MSB (CC 0) and LSB (CC 32), sent before each program change when set; the per-synth timing trim.
- **Knobs** move with the mouse, touch, arrow keys, or a learned controller knob. Bipolar parameters show ± around their centre.
- **PROGRAM**: − / + (or the small knob) sends a program change, after the bank select. It shows the number as synths do (001-128), what the message carries (*sends 2*) and, on the Practice synth, the program's name. A dragged knob sends only where it settles.
- **MIDI monitor**: the last messages this panel sent, decoded (*ch2 Note on C3 (48) · vel 100 · 91 30 64*), with CC names from your knob labels. It is how you see what MIDI is, and the first place to look when a synth doesn't respond.
- Opening a project **never sends the knobs**, because that would overwrite the patch on your synth. **Send all** pushes the program and then the whole panel on purpose. **Panic** sends note-offs, All Notes Off and All Sound Off on this synth's channel only.
- **Sequencer**: 16 steps. Tap a step to turn it on or off; its bar shows the velocity. To enter notes, tap a step's note name and play a key, on screen, on your computer keyboard (A–K, Z/X for octave) or on a MIDI keyboard. The note (and its velocity) is written and the selection moves on. ◀ ▶ −1 +1 −12 +12 and *vel* edit the selected step. On channel 10 the steps show note numbers (General MIDI drums).
  **GATE** is the note length as a share of a 16th. **LENGTH** makes 1–16 step loops, and odd lengths give polymeters. **TRANSPOSE** shifts the whole pattern. **SEQ** off keeps the synth quiet while the studio plays (for its own arpeggiator).
  Each step's note-on and note-off are sent together, ahead of time, with timestamps. A note can't hang, and a note-off always lands before the next note-on.
- **PLAY** (or Space) starts the studio transport. With *Sync to studio clock* unticked in the Studio view, PLAY runs the sequencer on its own clock at the studio tempo.
- **Keyboard and MIDI thru**: on-screen keys (lower on a key plays louder), computer keys and MIDI input (when this instrument is focused) go to the synth on its channel. Bend, CCs, aftertouch and program changes from your controller are re-addressed to that channel too.
  Echo guard: notes coming in from the same device you send to are ignored. With local control on, the synth would otherwise play each note twice.
- **Several synths**: a second "Your synth" that has not been set up starts on the next free channel (on the Practice synth: channel 2, its keys part). Set-up instances are never changed. Two synths on one output and channel get a warning in the header and in Setup.

## Audio input

- **Source**: *Interface / mic* (getUserMedia), *Practice synth* (its audio, as if cabled into your interface) or *Test tone* (1 kHz peaking at -20 dBFS, the SMPTE line-up level). **Connect** opens the input; pick an interface from the list (names appear once access is granted). Echo cancellation, noise suppression and auto gain are **off**, because those voice-call filters would mangle a synth, and the panel shows *voice processing off* (or warns if the browser applied it anyway). Synth Studio reconnects on the next visit if the browser still grants access, and it never prompts by itself.
- **Name**: press ✎ to rename the input. Until you do, the rack names it after what it plays (*Scarlett 2i2 USB · IN 1*, *Practice synth audio*, *Test tone*).
- **MODE** (how the synth is cabled; Reset leaves it alone):
  - IN 1 / IN 2: one input in the middle, for a mono synth.
  - L+R: both inputs summed.
  - STEREO: input 1 left, input 2 right.
  - A mono source always plays input 1. Safari ignores the channel-count request, so a track whose second channel is digital silence is treated as mono.
- **GAIN** is ±24 dB. The **meter** shows peaks after GAIN from -60 to 0 dBFS with the target zone (-18 to -6, a line at -12) and a peak readout. **CLIP** lights at 0 dBFS and stays lit until you tap it; its **IN** light means the signal clipped before GAIN, in your interface: turn the interface's gain down. **MUTE** silences the input in the studio but keeps the meter and takes running.
- **Check level** listens for 5 seconds (playing the Practice synth's phrase when that is the source), judges the loudest peak (*Good*, *A bit quiet*, *Hot*, *Too loud*) and offers the GAIN setting that puts it on -12 dBFS.
- **Latency**: input latency (Chrome reports it), base latency (`ctx.baseLatency`) and output latency (`ctx.outputLatency`, Safari from 18.4); a part a browser doesn't report shows *n/a* and the total becomes *at least*. Their sum is roughly how much later the hardware reaches your ears than the twins do, with advice: under 10 ms feels instant, up to 20 ms is fine, above that lower the interface's buffer size or use direct monitoring (MUTE).
- **OUTPUT**: the master, or a mixer channel of any mixer in the studio (Xone:96 STUDIO inputs). The Studio view's Output menu does the same. Patch OUT L / OUT R into another instrument's input, or into a Web Audio plugin's IN.
- **Record take** records this input alone (after GAIN, before MUTE) to a 24-bit WAV in your downloads, named after the input, and starts the studio when it is stopped so the sequencer plays along (and stops it again). Each take is listed with its length and peak. REC in the top bar records the whole mix.
- **Presets**: *Setup / Mono synth on input 1*, *Mono synth on input 2*, *Stereo synth on inputs 1 + 2*, *Two inputs summed*; *Monitoring / Direct monitoring through the interface*, *Monitor through the studio*.
- If the interface is unplugged, the panel says so, and it reconnects automatically when the interface comes back.
- **iPad**: while any input captures, the audio session is *play-and-record* (WebKit's *playback* session has no microphone; output stays on the speakers), and `globalThis.__synthCaptureCount` counts open inputs so the app's audio unlock leaves the session alone. When the last input closes it goes back to *playback*.

## Web Audio plugin

- **Choose plugin…** starts with two **built-in plugins** that load instantly, offline, with nothing to trust:
  - *Studio Mono*: an instrument (one oscillator, a low-pass filter with its own envelope, glide; CC 74 cutoff, CC 71 resonance).
  - *Studio Echo*: an effect, a delay whose repeats lock to the studio tempo (1/4, dotted 1/8, 1/8, 1/16) through transport events, with feedback, tone and mix.
  Then known WAM 2 instruments and effects from the wam-community collection on webaudiomodules.com, or paste the URL of any plugin's `index.js`; a folder URL gets `index.js` added.
  The web entries are marked **unverified**: that site could not be reached while this was built. Every entry was loaded in this host from the identical files in the `wam-community` npm package, and instruments were played and effects fed with audio.
- **Trust**: a web plugin is JavaScript from another site, running inside this page with the same access as Synth Studio. Load only plugins you trust. You confirm each site once, per browser.
  A project or studio set that names a plugin from a site you haven't trusted waits for you. It shows *Trust & load* and fetches nothing until you press it.
- **Instruments** play from the on-screen keys, from A–K on the computer keyboard, and from MIDI input when focused. These arrive as `wam-midi` events through `audioNode.scheduleEvents`. **Effects** process whatever you patch into **IN**; **Test sound** plays a short groove into IN so you can hear one with nothing patched. **BYPASS** passes IN through dry. The **OUT** meter shows the plugin's level.
- **Open plugin window** shows the plugin's own interface in an overlay. Closing the window saves the plugin's state with the project, when the plugin can export it as JSON.
- With *Sync to studio clock* ticked, the plugin gets the studio tempo and play state as `wam-transport` events, at start, stop, tempo changes and every bar.
- The rack names the slot after the loaded plugin.
- Errors are explained:
  - unreachable host or blocked by CORS
  - 404
  - a web page instead of a module
  - a file served as plain text (raw.githubusercontent.com does this; use GitHub Pages or another static host)
  - not a WAM
  - the plugin failing to start
  - a 20 s timeout

## Lessons

Every lesson works without gear (the Practice synth, the test tone and the
built-in plugins stand in), on every browser. Steps that need real gear say so
in their instruction ("Needs a MIDI controller: …") and can be skipped with
**Skip**. Checks read the instrument's data and values, the routes and the rack,
so steps complete by themselves.

| Instrument | Lessons |
|---|---|
| Your synth (MIDI) | 1 Connect a synth: ports and channels · 2 Velocity: how hard you play · 3 Change the sound: CCs and program changes (with an ear challenge) · 4 Mapping: templates and MIDI learn · 5 Sequence it from the studio · 6 MIDI clock: the synth's arpeggiator follows · Studio: Two synths in one studio |
| Audio input | 1 Bring sound in: choose an input · 2 Gain staging: peaks around -12 dBFS · 3 Monitoring and latency · 4 Into the mixer and onto disk · Studio: Your hardware synth in the studio (MIDI notes and clock out, audio back in, a mixer channel, a take) |
| Web Audio plugin | 1 Load a plugin · 2 Play a plugin instrument · 3 Effects: put a sound through a plugin · 4 Plugins and hardware |

Lessons that need a known knob map (CCs, clock) start on the Practice synth; the
learner's own setup is saved and comes back with *Restore* at the end. Routing
steps need a mixer with studio inputs; with none, OUTPUT lists only the master
and the step can be skipped.

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
timestamp. The Practice synth maps the timestamps back with the same offset
(and removes the latency compensation, since it plays through the same
speakers as the twins), so it plays exactly on the studio's grid.

`ctx.baseLatency` is shown but not added. If a synth still sounds early or late,
use the per-synth *timing trim* or the global *Offset*. If you monitor hardware
back through Audio input, its sound arrives about one input latency later, so a
negative offset of that size lines it up.

## Troubleshooting

- **MIDI is blocked**: allow MIDI in the site settings (the icon left of the address), then press Enable MIDI again.
- **No ports**: plug the device in. It appears by itself. On Windows, close other apps that hold the port.
- **Nothing happens on the synth**: watch the MIDI monitor. Messages going out on the wrong channel? Set the synth's receive channel to match. No messages? Check the output in Setup.
- **Notes twice**: turn off local control on the synth, or rely on the echo guard (input and output must share the device's name).
- **Two synths play each other's parts**: they share an output and channel; the header warns you. Give each its own channel.
- **Hardware drifts or stutters on clock**: untick *Line hardware up…* to test. Some devices smooth clock slowly, so give them a bar. Set the synth's clock source to external or auto.
- **Learn gets nothing**: turn on the synth's CC output (often "CC out", "MIDI out: CC" or "Local") in its MIDI menu.
- **Audio input silent**: check MODE (IN 2 on a mono device plays nothing). In Firefox, use the same sample rate on the interface and the output. On iPad, turn off Voice Isolation (Control Center → Mic Mode → Standard).
- **CLIP with IN lit**: the interface clipped before Synth Studio: turn its gain knob down.
- **Plugin will not load**: read the panel's message. The plugin's host must allow cross-origin loading (CORS) and serve it as JavaScript. The built-in plugins always load.

---

# Developer notes

```
lib/midi/
  support.ts        browser detection and the friendly messages (Safari, iPad, insecure page)
  access.ts         MidiService: permission from a button, ports, hot-plug, input filter, send(bytes, ts), virtual outputs
  bytes.ts          message builders, parser, describeMidi() for the monitor (no browser APIs)
  practice-core.ts  Practice synth: parts, programs, CC curves, arpeggiator, clock follower (pure, tested)
  practice-synth.ts Practice synth: the audio, MIDI in with timestamps, direct sound / listen() for Audio input
  router.ts         MidiRouter: notes -> focused/chosen instance, bend/mod, learned CCs, raw MIDI to MidiReceiver devices
  learn.ts          midiLearnTouch() (DeviceHost calls it on every control change), labels
  apply.ts          ControlWriter: coalesces MIDI-driven control writes to one store update per frame
  clock-out.ts      MidiClockOut: transport -> 24 PPQN + Start/Stop/Continue/SPP
  clock-in.ts       MidiClockIn: follow external clock (tempo fit, phase lock)
  time.ts           audioToMidiTime(), AudioClockSync (steady mapping), audioClock (shared)
  index.ts          wiring: initMidi(), clock targets (MIDI settings + every Your synth with clock, deduplicated),
                    new synths on a free channel, lesson re-checks, useMidiSnapshot(), usePracticeStatus(), useMidiFocus()
  __tests__/        unit tests (npx tsx <file>) and the browser check (external-gear.e2e.cjs)
store/midi.ts       persisted MIDI settings + mappings (useMidiStore), learn session (useMidiLearn)
components/midi/    MidiButton (header button + learn banner), MidiSettings (dialog)
lib/wam/            host.ts (initWamHost, loadWam, wamMidi, wamTransport), builtin.ts (Studio Mono, Studio Echo),
                    plugins.ts (built-ins + curated list), trust.ts
devices/midi-synth/ config.ts (data, CC scaling, program messages, starters, several-synth helpers), sequencer.ts (pure),
                    engine.ts, ui.tsx (header, program, monitor, steps), setup.tsx, starters.tsx, templates.ts, guide.ts, lessons.ts
devices/audio-in/   config.ts (data, level judging, names), engine.ts (sources, meters, takes, capture session), ui.tsx, lessons.ts
devices/wam-plugin/ engine.ts (plugin lifecycle, MIDI, transport, GUI, test sound, meter), ui.tsx, lessons.ts
scripts/build-midi-guide.ts   midi.guide CSV -> public/midi-guide/*.json
```

**Hooks into shared files** (deliberately small):

- `devices/index.ts`: three registry entries, category `External`.
- `components/DeviceHost.tsx`: `midiLearnTouch(instance, id)` at the top of `onChange`, and `useMidiFocus(instance, keyboardActive, handleNoteOn, handleNoteOff)`. Only the focused host registers, and notes go through its handlers.
- `app/page.tsx`: `<MidiButton />` in the header.
- Panels rename their rack slot through the store's `renameInstance()` (only while the label is theirs to set).
- `lib/audio/context.ts` `resumeAudio()` should skip its `audioSession.type = 'playback'` while `globalThis.__synthCaptureCount > 0` (owned by the studio).

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

**A virtual output** is any `MidiOutputLike` (`id`, `name`, `send(data, ts)`)
registered with `midi.addVirtualOutput()`. It is listed in `snapshot.outputs`
with `virtual: true` (also without Web MIDI) and resolved by `findOutput()`, so
clock out and every "Your synth" treat it like a port.

**Device data**: each device keeps its configuration in `DeviceModule.data`,
which is per instance and saved with the project. The `asData` / `asInputData` /
`asWamData` accessors check the shape, not only a version number: for one
render after switching instruments, a panel can be handed another device's
data. New fields (`clock`, `bank`, `source`, `levelCheck`, `takes`) default
safely for older saves.

**midi.guide data**:

- `npx tsx scripts/build-midi-guide.ts` clones github.com/pencilresearch/midi into a temp dir; `--src <clone>` uses a local copy.
- Output: `public/midi-guide/index.json` (~50 KB, loaded first), `devices/<id>.json` (one per instrument, loaded on demand) and `LICENSE.md` (attribution, changes, CC BY-SA 4.0 text). The derived JSON stays CC BY-SA 4.0. Keep the attribution in the UI (Setup footer, panel template link).
- Knob suggestions live in `devices/midi-synth/guide.ts` (`suggestKnobs`); search, grouping and the manufacturer list in `templates.ts`.

**WAM host**: `loadWam(url, ctx, { state })`:

1. Calls `initializeWamHost` once per context.
2. Checks the URL and a preflight `fetch` for clear errors.
3. Runs `import(/* webpackIgnore: true */ url)`.
4. Runs `WAM.createInstance(groupId, ctx)`.
5. Applies `setState(state)`.

It returns the node and the descriptor facts. `hasAudioInput` comes from the
node's real `numberOfInputs`, because the SDK's default descriptor claims an
input. `trust.ts` decides what may load without asking. Built-in plugins
(`builtin:` URLs) skip all of this: `createBuiltin()` returns the same shape,
with explicit `input` / `output` nodes. No COOP/COEP headers are needed: the WAM
SDK falls back to messages, and its worklets load from blob: URLs.

**Tests**:

```
npx tsx lib/midi/__tests__/clock-out.test.ts     # clock out + steady mapping
npx tsx lib/midi/__tests__/clock-in.test.ts      # external clock follower
npx tsx lib/midi/__tests__/router.test.ts        # input routing, learn, echo guard
npx tsx lib/midi/__tests__/practice.test.ts      # Practice synth: parts, programs, CC curves, arpeggiator, clock follower
npx tsx devices/midi-synth/__tests__/sequencer.test.ts
npx tsx devices/midi-synth/__tests__/config.test.ts   # data, program messages, starters, channel clashes, templates
# Browser (Playwright, Chromium; mocked Web MIDI, an oscillator getUserMedia, iPad and Safari pages):
npm run build && npx next start -p 3130
node lib/midi/__tests__/external-gear.e2e.cjs http://localhost:3130 /tmp/out [pluginBaseUrl] [plugins.json]
node scripts/lesson-runner.cjs http://localhost:3130 midi-synth   # also audio-in, wam-plugin
```

The last two arguments of the browser check point the web-plugin checks at a
local static copy of the `wam-community` npm package,
`http-server <pkg>/dist/plugins --cors`.
