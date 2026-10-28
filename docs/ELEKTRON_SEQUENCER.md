# Elektron sequencer (Analog Four MKII / Analog Rytm MKII)

A shared, hardware-faithful step sequencer for the Elektron twins: patterns in
banks A–H, parameter locks, trig conditions, micro timing, retrigs, slides,
fills, chains and songs, in sync with the studio transport and the song
arranger. Two parts:

| Part | Path | What it is |
|---|---|---|
| Logic | `lib/sequencer/elektron/` | Data model, immutable edits, the scheduler (`ElektronSequencer`), lock helpers. No React, no audio nodes. |
| UI kit | `components/sequencer/` | React pieces for `custom` layout elements: `TrigKeys`, `TrigEditor`, `PagePicker`, `PatternPicker`, `ChainBuilder`, `SongEditor`, `ScaleMenu`, `MenuKey`. Mouse and touch. `example.tsx` is a type-checked reference integration. |

| File | Contents |
|---|---|
| `types.ts` | `Project`, `Pattern`, `Track`, `Step`, `Song`, `TrigEvent`, `SeqState`; tables (`NOTE_LENGTHS`, `SPEEDS`, `TRIG_CONDITIONS`, `RETRIG_RATES`) |
| `project.ts` | factories, `migrateProject`, `asProject`, `projectData`, `arrangerPatterns`, read helpers (`getPattern`, `trackLength`, `trigSteps`...) |
| `edit.ts` | immutable edits (`toggleTrig`, `setLock`, `updateSteps`, `updatePatternSettings`, chain and song edits...) |
| `sequencer.ts` | `ElektronSequencer`: internal clock or studio transport, `onTrig` with audio times |
| `locks.ts` | `interceptForLocks`, `displayWithLocks`, `clearLock`, `isLocked` for `DeviceModule` hooks |
| `lockState.ts` | `LockTracker`: per-voice lock bookkeeping in engines |
| `conditions.ts`, `format.ts`, `rng.ts` | condition codes and descriptions, readouts ("1/16", "+1/384"), the seedable RNG |

Run `npm run test:seq` after changing anything here.

---

## 1. Data model

Everything is plain JSON in `DeviceModule.data` (saved with the project). It is
sparse: missing patterns are empty, missing steps have no trig, missing step
fields use the track default.

```jsonc
{
  "v": 1, "tracks": 12,
  "defaults": [{ "note": 60, "vel": 100, "len": 14 }, ...],   // trig defaults of new patterns, per track
  "active": "A01",                       // the selected pattern: what the keys edit, what PATTERN mode plays
  "mode": "pattern",                     // what PLAY plays: "pattern" | "chain" | "song"
  "changeMode": "sequential",            // "sequential" | "direct-start" | "direct-jump" | "temp-jump"
  "patterns": {
    "A01": {
      "name": "VERSE", "length": 16, "speed": "1x", "scaleMode": "pattern",
      "master": 16, "change": 16,        // PER TRACK only: master length (0 = INF), master change (0 = OFF)
      "swing": 50, "kit": "",            // swing 50..80 %; kit = an opaque reference for the device
      "tracks": [
        { "note": 36, "vel": 100, "len": 14, "steps": {
            "0":  {},                                              // a plain note trig
            "4":  { "vel": 127, "cond": "1:2", "micro": -3 },
            "6":  { "trigless": true, "locks": { "decay": 40 } },  // a lock trig
            "12": { "retrig": { "rate": 12, "len": 30, "vel": -64 }, "accent": true }
          },
          "length": 12, "speed": "2x",   // PER TRACK only (optional)
          "mute": true, "prob": 50 }     // optional: pattern track mute, track trig probability
      ]
    }
  },
  "chain": ["A01", "A01", "A02"],
  "song": { "name": "", "loop": true, "loopRow": 0,
            "rows": [{ "pattern": "A01", "repeats": 4, "length": 16, "tempo": 124, "mutes": [3], "transpose": 5 }] }
}
```

| Field | Encoding |
|---|---|
| pattern ids | `"A01"` … `"H16"` (`patternId(bank, index)`, `parsePatternId`, `ALL_PATTERN_IDS`) |
| `length` | 1–64 steps; the trig keys show 16 per page |
| `speed` | `2x`, `3/2x`, `1x`, `3/4x`, `1/2x`, `1/4x`, `1/8x` = 3, 4, 6, 8, 12, 24, 48 ticks per step (24 PPQN; 1x = a 16th = 6 ticks) |
| `len` | index into `NOTE_LENGTHS` (128 positions: 0.125 … 128 steps, then INF). `LEN_1_STEP` = 14 = 1/16, 30 = 1/8, `LEN_INF` = 127. `formatLength()` |
| `micro` | −23 … +23 in 1/384 of a whole note = 1/24 step (`formatMicro` → "+1/384") |
| `cond` | `"1:2"`…`"8:8"`, `"1%"`…`"100%"` (the hardware's 22 steps), `FILL !FILL PRE !PRE NEI !NEI 1ST !1ST`. `TRIG_CONDITIONS` lists them in encoder order |
| `retrig` | `rate` = index into `RETRIG_RATES` (1/1 … 1/80 of a whole note; 1/16 = one per step, 1/12 and 1/24 triplets), `len` = `NOTE_LENGTHS` index (INF = until the next trig), `vel` = −128 … +127 velocity curve (negative fades out) |
| `locks` | `{ key: number }` – parameter keys and units are the device's business |
| `slide` / `pslide` / `accent` | Analog Four note slide (glide from the previous note), parameter slide (glide from this trig to the next), accent |

**Edits.** All edits in `edit.ts` are pure functions `Project → Project` with
structural sharing (untouched patterns and tracks keep their identity, which
keeps the scheduler's compile cache warm). Use them through `updateData`:

```ts
ctx.updateData(d => toggleTrig(asProject(d, 12), 'A01', track, step));
```

`asProject(data, tracks)` returns the project itself when the data already is
one (cheap, call it in render), and repairs anything else.

---

## 2. Engine side

Create one `ElektronSequencer` in `build()` and wire four hooks.
`components/sequencer/example.tsx` holds a complete, type-checked version of
the snippets in this guide.

```ts
import { ElektronSequencer, LockTracker, type TrigEvent } from '@/lib/sequencer/elektron';

const TRACKS = 12;

class RytmEngine extends BaseEngine {
  private seq!: ElektronSequencer;
  private locks = new LockTracker(TRACKS);

  protected build() {
    // ... voices ...
    this.seq = new ElektronSequencer({
      ctx: this.ctx,
      tracks: TRACKS,
      bpm: this.num('tempo', 120),
      onTrig: e => this.trig(e),
      onNoteOff: (track, _note, time) => this.voices[track].release(time),
    });
    // The UI kit reads engine.seq (playheads, cued pattern, fill, song row...)
    this.seq.subscribe(s => this.emit({ seq: s, playing: s.playing, step: s.steps[this.num('track')] }));
    this.onDispose(() => this.seq.dispose());
  }

  protected onData(data: unknown) { this.seq.setProject(data); }          // DeviceModule.data changed
  protected onTransport(t: Transport | null) { this.seq.follow(t); }      // studio sync on / off

  protected onParam(id: string, value: ControlValue) {
    if (id === 'play') {
      // While synced the hub turns PLAY into studio Play/Stop: never start the internal clock then
      if (!this.transport) value ? this.seq.start() : this.seq.stop();
      return;
    }
    if (id === 'tempo') this.seq.setTempo(Number(value));
    // sound parameters: don't override a value the playing trig has locked
    // if (this.locks.isLocked(track, key)) return;
  }

  event(name: string, payload?: unknown) {
    // seq:fill(:up), seq:fill-latch, seq:fill-cue, seq:queue, seq:mute, seq:song-row, seq:chain-index,
    // seq:preview(:up), seq:audition(:stop) and the arranger's 'arranger:pattern'
    if (this.seq.handleEvent(name, payload)) return;
    // ... pads, other keys ...
  }

  private trig(e: TrigEvent) {
    const v = this.voices[e.track];
    // Locks belong to this trig: the next trig on the track reverts what it doesn't lock itself
    this.locks.apply(e.track, e.locks,
      (key, value) => v.set(key, value, e.time),                   // lock
      key => v.set(key, this.trackValue(e.track, key), e.time));   // back to the kit value
    if (e.paramSlide && e.slideTo) {                                // A4 parameter slide
      const to = e.slideTo;
      new Set([...Object.keys(e.locks), ...Object.keys(to.locks)]).forEach(k =>
        v.ramp(k, e.locks[k] ?? this.trackValue(e.track, k), to.locks[k] ?? this.trackValue(e.track, k), e.time, to.time));
    }
    if (e.trigless) return;                                         // lock trig: parameters only
    v.trigger(e.time, e.velocity / 127, e.accent, e.note, e.duration, e.slide);
  }
}
```

### TrigEvent

`onTrig` fires ahead of time (about 0.1 s look-ahead) with **audio-context
times**. Schedule everything at `e.time`; never treat the callback moment as
musical time. One fresh object per hit; `e.locks` is shared with the project
data, so don't mutate it.

| Field | Meaning |
|---|---|
| `track`, `step`, `pattern`, `loop` | where it came from; `loop` is the track's loop counter |
| `time` | start, with swing, micro timing and retrig offsets |
| `duration` | gate length in seconds (`Infinity` for LEN INF). A matching `onNoteOff(track, note, time)` follows; the next note on the track, a stop or a pattern change cut it earlier |
| `note`, `velocity` | step value or track default; song-row transpose included; velocity 1–127 after the retrig curve |
| `locks` | the trig's parameter locks (apply for this trig only, see `LockTracker`) |
| `trigless` | lock trig: apply `locks` to the sounding voice, start no note (no note-off follows) |
| `retrig`, `retrigIndex` | retrig sub-hits arrive as separate events, `retrigIndex` 1, 2…; each ends before the next |
| `slide` | note slide: glide from the previous note. When the notes overlap there is **no note-off** in between (legato), so don't retrigger the envelope |
| `paramSlide`, `slideTo` | parameter slide from this trig's values to `slideTo.locks` (unlocked keys → track values), arriving at `slideTo.time` (the next trig on the track) |
| `accent`, `fill`, `condition`, `conditionPassed` | `conditionPassed` is false only with `emitFailed: true` (for LED feedback) |
| `stepDuration` | seconds per step on this track (slide times, envelope scaling) |

`LockTracker` is allocation-free after warm-up. On stop, call
`locks.releaseAll((track, key) => ...)` from `onPlay(false)` if your voices keep
locked values.

### Options and methods

| | |
|---|---|
| `new ElektronSequencer({ ctx, tracks, onTrig, onNoteOff, onStep, onPattern, onSongRow, onTempo, onPlay, bpm, seed, rng, emitFailed, neighbor, project })` | `seed` makes probability conditions deterministic (tests); `neighbor(track)` overrides the NEI track (default: the track before); `onTempo` reports song-row tempo changes on the internal clock |
| `setProject(data)` | new device data; selecting another pattern (`project.active`) while playing cues it per the change mode |
| `start(atTime?)` / `stop()` / `setTempo(bpm)` | internal clock (ignored while following) |
| `follow(transport \| null)` | studio sync: 6 ticks per 16th at 1x, start/stop/locate follow the transport, joining mid-song lines patterns up with tick 0 |
| `queuePattern(id, mode?)` | cue a pattern (stopped: plays on start) |
| `selectPattern(id, atTime?)` | the song arranger: start `id` from step 1 on the tick at `atTime`, then loop it in PATTERN mode until stop, whatever the project's play mode (`SeqState.arranged`). Routed from `handleEvent('arranger:pattern', { id, time })` |
| `playSong(row)` / `playChain(index)` | where the song / chain starts; while it plays, jump (at the next change, or immediately in DIRECT modes) |
| `setFill(on)` / `latchFill(on?)` / `cueFill()` | hold FILL, latch it ([FUNC] + double-tap on the MKII), or cue it for one pattern cycle ([FUNC] + [FILL]) |
| `setMute(track, on)` | live mute on top of the pattern's and song row's mutes |
| `preview(track, step, pattern?)` / `previewOff(track)` | audition a step now (REC off trig keys) |
| `audition()` | lessons: play the pattern on the internal clock even while following a stopped transport; returns a stop function |
| `getState()` / `subscribe(fn)` | `SeqState`: what is **audible** now (playing, pattern, queued, steps per track, fill, song row and repeat, chain index, bpm, live mutes, arranged) |
| `handleEvent(name, payload)` | routes the UI kit's events; returns true when handled |

### Timing details

- **Swing** (pattern, 50–80 %): every second step of each track is late by
  `(swing − 50) / 50` of that track's step, counted across loops (an odd length
  shifts which steps swing, as on the hardware). When following, the studio
  transport's own swing is already in the tick times and adds on top.
- **Micro timing**: negative values are evaluated early, on the latest tick at
  or before the trig, so they are still scheduled ahead (also across pattern
  changes and loop points).
- **Pattern changes**: SEQUENTIAL at the end of the pattern (PER TRACK: every
  master change length; master INF + change OFF = never, as on the hardware);
  DIRECT START on the next step, from step 1; DIRECT JUMP on the next tick,
  same position; TEMP JUMP like DIRECT JUMP, then back at the end.
- **Songs**: each row plays `repeats ×` its length (row `length`, or the
  pattern's change length; INF falls back to the pattern length so a song never
  stalls). A row `length` shorter than the pattern restarts it each repeat. Row
  `tempo` applies on the internal clock only – synced, the studio keeps time.
  Row `mutes` replace the pattern's track mutes; `transpose` shifts notes.
- **Conditions** are evaluated just in time on muted tracks too (so NEI keeps
  working). PRE/!PRE ignore PRE conditions; plain trigs and the track
  probability don't count as conditions; with nothing evaluated yet PRE, !PRE,
  NEI and !NEI are false. A:B and 1ST count the track's own loops; loop counters
  reset when a pattern starts.
- **iPad**: the tick path uses typed arrays and allocates only the emitted
  events and UI snapshots (12 tracks × 64 steps of retrigs and locks: about
  25 000 hits per simulated 5 minutes in ~70 ms).

---

## 3. Module side

```ts
import {
  arrangerPatterns, asProject, displayWithLocks, interceptForLocks, projectData, type LockOptions,
} from '@/lib/sequencer/elektron';

const LOCKS: LockOptions = {
  // one control per parameter and track ('t3_filter_freq'); the TRIG page has t3_trig_note ...
  lockKey: id => {
    const m = /^t\d+_(.+)$/.exec(id);
    if (!m) return null;                       // not lockable (track, page, menus...)
    const k = m[1];
    if (k === 'trig_note') return 'note';      // the held trig's own NOTE
    if (k === 'trig_vel') return 'vel';
    if (k === 'trig_len') return 'len';
    if (k === 'trig_cond') return 'cond';      // value = index into TRIG_CONDITIONS
    if (k === 'trig_prob') return 'prob';      // the track probability (never a lock)
    return k;                                  // a parameter lock key
  },
  trackOf: id => { const m = /^t(\d+)_/.exec(id); return m ? Number(m[1]) - 1 : null; },
  currentTrack: values => Number(values.track) || 0,
  currentPattern: data => asProject(data, 12).active,
  trackDefaults: true,                         // TRIG page with nothing held = the track's defaults
  tracks: 12,
};

const module: DeviceModule = {
  // ...spec, layout, lessons, createEngine...
  data: projectData({ tracks: 12, defaults: { note: 60, vel: 100 } }),
  interceptChange: (id, value, api) => interceptForLocks(id, value, api, LOCKS),
  displayValues: api => displayWithLocks(api, LOCKS),
  transportControl: 'play',
  uiControls: ['track', 'page' /* , ... */],
  studio: { midiSync: true, patterns: data => arrangerPatterns(data, 12) },
  audition: api => { api.event('seq:audition'); return () => api.event('seq:audition:stop'); },
};
```

- **`data`**: `projectData(opts)` gives `initial` and `migrate` (returns valid
  saves unchanged, so loading doesn't write to the store).
- **`interceptChange`**: while trig keys are held (`ui.heldSteps`) a lockable
  control writes a lock on those steps instead of changing the sound, and an
  empty held step becomes a lock trig. `toLock` / `fromLock` convert switch or
  string controls; booleans lock as 1 / 0.
- **`displayValues`**: knobs show the held trig's locks (and its NOTE / VEL /
  LEN, micro timing, condition), the track defaults with `trackDefaults`, and
  the track probability. Use `isLocked(api, LOCKS, id)` for a locked-encoder
  highlight and `clearLock(api, LOCKS, id)` to remove one (e.g. on a double tap).
- **`studio.patterns`** lists the patterns that hold trigs for the arranger;
  the arranger's `event('arranger:pattern', { id, time })` goes straight to
  `seq.handleEvent`. While it drives the patterns, `SeqState.arranged` is true.
- **PLAY**: light the play key from `engine.playing`, not the control value –
  a song without loop stops by itself.
- **Track count**: Analog Rytm 12 (add a 13th for the FX track's lock trigs if
  you model it); Analog Four 4 (6 with FX and CV tracks). NEI uses the track
  before; pass `neighbor` to change that.

---

## 4. UI kit

Render the components from `custom` layout elements; each takes the element's
`CustomRenderContext` as `ctx`, plus `tracks` (the track count, used when the
data is missing). They work with a mouse and with touch: text ≥ 9 px, touch
targets ≥ 28 px **at 1:1** – size the elements in mm so they stay ≥ 28 px after
the panel's fit scale (`mm × pxPerMm × scale`), or use `portal`.

```tsx
const TRACKS = 12;
elements: [
  // the 16 trig keys (x/y/w/h in mm, top-left), the page keys and the menu keys
  { kind: 'custom', x: 40, y: 150, w: 300, h: 14, render: ctx => <TrigKeys ctx={ctx} tracks={TRACKS} /> },
  { kind: 'custom', x: 345, y: 150, w: 40, h: 8, render: ctx => <PagePicker ctx={ctx} tracks={TRACKS} /> },
  { kind: 'custom', x: 10, y: 120, w: 18, h: 8, render: ctx => <MenuKey ctx={ctx} menu="pattern" label="PTN" /> },
  { kind: 'custom', x: 30, y: 120, w: 18, h: 8, render: ctx => <MenuKey ctx={ctx} menu="song" label="SONG" /> },
  // overlays float over the page (portal: full size, outside the scaled panel), so this box can be tiny
  { kind: 'custom', x: 0, y: 0, w: 1, h: 1, render: ctx => (<>
      <TrigEditor ctx={ctx} tracks={TRACKS} portal features={{ retrig: true, accent: true, slide: false }} />
      <PatternPicker ctx={ctx} tracks={TRACKS} portal />
      <ChainBuilder ctx={ctx} tracks={TRACKS} portal />
      <SongEditor ctx={ctx} tracks={TRACKS} portal />
      <ScaleMenu ctx={ctx} tracks={TRACKS} portal />
  </>) },
]
```

| Component | Does | Notable props |
|---|---|---|
| `TrigKeys` | the 16 keys of the shown page. **Tap** toggles a trig. **Press and hold** holds the step (`ui.heldSteps`): turn an encoder to lock it. **Hold one + tap another** selects the range. **Long hold then release** (without turning anything) or **double tap** opens the TrigEditor; while it is open the keys pick its steps (shift-click: range) and the steps stay held, so a mouse can lock too. LEDs: red note trig, amber lock trig, white ring playhead, dim muted track, cyan condition label, dots for locks, ◂▸ micro timing, R/S/A retrig/slide/accent | `track`, `pattern`, `page`, `mode` (`'trig' \| 'accent' \| 'slide' \| 'pslide' \| 'mute'`), `muteTarget` (`'pattern'` saved mutes, `'live'` = `seq:mute`), `editable` (false = REC off: keys preview steps), `rows`, `color`, `trackNames`, `longPressMs`, `editor` |
| `TrigEditor` | NOTE, VEL, LEN, micro timing, condition (NONE / % / A:B / logic), retrig rate / length / curve, slide / p.slide / accent, note or lock trig, the trig's locks with a clear button each. Edits every selected step | `features`, `lockLabel`, `lockFormat`, `noteFormat` (Rytm: show a tune offset), `noteRange`, `portal`, `portalPlacement` |
| `PagePicker` | the 4 step pages: white = shown, green dot = playing, dark = past the length | `track`, `pattern`, `vertical`, `showLength` |
| `PatternPicker` | banks A–H × 16: tap selects (cues while playing – it blinks until it starts); COPY / PASTE / CLEAR (tap twice); change mode; PLAY = pattern / chain / song; name | `banks`, `changeModes`, `playModes`, `names`, `closeOnPick` |
| `ChainBuilder` | append patterns, select an entry to move / remove / CUE it, PLAY CHAIN | `maxLength` (64) |
| `SongEditor` | rows of pattern × repeats, LENGTH (AUTO = the pattern's), BPM (AUTO = unchanged), TRSP, mutes, move / loop-here / delete, ▶ play from a row, LOOP or END | `trackNames`, `tempo`, `transpose` (A4), `names`, `maxRows` |
| `ScaleMenu` | PER PATTERN / PER TRACK, length, scale, master length (INF) and change (OFF), the track's length and scale, swing | `track`, `pattern`, `trackNames` |
| `MenuKey` | opens / closes one menu (`ui.seqMenu`); the pattern key blinks while a pattern is cued | `menu`, `label`, `color` |

Overlays show when `ui.seqMenu` names them, or pass `open` to show one
permanently inside its element's box. Without `portal` they fill their custom
element (give it room); with `portal` they float at the top of the viewport
(`portalPlacement: 'bottom'` if your keys are at the top) and size to their
content.

**UI state** (`ui`, per instance, not saved): `heldSteps`, `heldTrack`,
`heldPattern`, `heldEdited`, `stepPage`, `trigEditor` (`{ track, pattern,
steps }`), `seqMenu`, `seqBank`, `seqClipboard`.

**Events** the kit sends (all handled by `seq.handleEvent`): `seq:mute`
`{ track }`, `seq:song-row` `{ row }`, `seq:chain-index` `{ index }`,
`seq:preview` `{ track, step, pattern }` / `seq:preview:up`. Layout buttons can
send `seq:fill` (momentary: the panel sends `seq:fill:up` on release),
`seq:fill-latch` and `seq:fill-cue` themselves; `seq:queue` `{ id }` cues a
pattern without selecting it.

**Lessons**: the kit lights its parts for `step.focus` ids:
`seq:trig:<1-64>`, `seq:trigs`, `seq:page:<1-4>`, `seq:pages`,
`seq:menu:<pattern|chain|song|scale>`, `seq:pattern:<A01>`, `seq:patterns`,
`seq:bank:<A>`, `seq:copy`, `seq:paste`, `seq:clear`, `seq:change:<mode>`,
`seq:mode:<pattern|chain|song>`, `seq:chain`, `seq:chain:<i>`, `seq:song`,
`seq:song:row:<i>`, `seq:song:add`, `seq:song:loop`, `seq:edit:<note|vel|len|
micro|cond|retrig|slide|accent|locks>`, `seq:scale:<mode|length|speed|swing|
master|change>`. Check sequencer tasks on the data:

```ts
check: s => { const p = asProject(s.data, 12); return trigSteps(p, p.active, 0).join() === '0,4,8,12'; },
// also: lockedSteps(p, id, track, 'decay'), getStep(p, id, track, step)?.cond, p.patterns[id]?.swing ...
```

---

## 5. Fidelity

Researched against the A4 MKII / AR MKII manuals' sequencer chapters (and the
Digitakt / Cycles manuals where those are clearer – the conditions are shared).

**Modelled**: 8 banks × 16 patterns; length 1–64 in pages of 16; scale 2x…1/8x
per pattern or PER TRACK with master length (INF) and master change (OFF);
swing 50–80 % on every second step; note trigs and lock (trigless) trigs;
NOTE / VEL / LEN (0.125–128 steps, INF); micro timing ±23/384; every trig
condition (A:B, 1–100 % incl. 100 % from A4 OS 1.50 / AR OS 1.60, FILL, PRE,
NEI, 1ST and negations); per-track trig probability (same OS versions); retrigs
(1/1–1/80, length, velocity curve); note slide (legato), parameter slide to the
next trig, accent; parameter locks with the hold-and-turn gesture and lock
trigs on empty steps; fill hold / latch / one-cycle cue; SEQUENTIAL, DIRECT
START, DIRECT JUMP and TEMP JUMP pattern changes; chains; songs with rows of
pattern, repeats, length, tempo, mutes and transpose, looping to a row or
stopping; pattern mutes and live mutes; step preview; MIDI-clock-style sync.

**Simplified or not modelled**: one project per instance (no project / kit
management – `pattern.kit` is just a reference); the swing trig menu (swing
always applies to the even steps); song LOOP rows with counts and HALT rows
(the song loops back to one row or stops); per-row chain entries; live
(motion) recording of locks, quantise and step recording; copy / paste of
single tracks, pages or trigs; trig mutes; sound locks (lock a `sound` key if
you need them); parameter slides use the next trig in the playing pattern (a
pattern change in between makes the target moot); chains of up to 64 patterns
(hardware limits differ by OS); MIDI program change, pattern-change quantise
settings and the Euclidean mode (AR OS 1.70).

---

## 6. Tests

`npm run test:seq` (`scripts/test-sequencer.ts`) runs the scheduler on a fake
audio clock and a fake transport (plus the real `Transport` class): timing at
several tempos and every scale, swing, micro timing, every condition, retrigs,
lengths and note-offs, slides, all four pattern changes, chains, songs, fills,
mutes, transport follow, `selectPattern`, previews, auditions, lock
interception, the data model, and a server render of every UI component.
