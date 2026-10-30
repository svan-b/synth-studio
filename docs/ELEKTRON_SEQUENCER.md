# Elektron sequencer (Analog Four MKII / Analog Rytm MKII)

A shared step sequencer for the two Elektron twins, checked against the
Analog Four MKII manual (OS 1.55) and the Analog Rytm MKII manual (OS 1.72):
patterns in banks A–H, note and lock trigs, parameter locks, trig conditions,
micro timing, retrigs, accents, slides, trig mutes, swing trigs, fills, the
four pattern change modes, chains and songs, in sync with the studio
transport and the song arranger. Citations read "(A4 MKII manual, p.N)" and
"(Rytm MKII manual, p.N)". Where the manuals say nothing, the behaviour is
marked **design**.

| Part | Path | What it is |
|---|---|---|
| Logic | `lib/sequencer/elektron/` | Data model, immutable edits, the scheduler (`ElektronSequencer`), lock helpers. No React, no audio nodes. |
| UI kit | `components/sequencer/` | React pieces for `custom` layout elements: `TrigKeys`, `TrigModeKey`, `TrigEditor`, `PagePicker`, `PatternPicker`, `ChainBuilder`, `SongEditor`, `ScaleMenu`, `TransportKeys`, `MenuKey`. Mouse and touch. `example.tsx` is a type-checked reference integration. |

| File | Contents |
|---|---|
| `types.ts` | `Project`, `Pattern`, `Track`, `Step`, `Song`, `SongRow`, `TrigEvent`, `SeqState`; tables (`NOTE_LENGTHS`, `SPEEDS`, `TRIG_CONDITIONS`, `RETRIG_RATES`), `LOCK_LIMIT_A4`, `LOCK_LIMIT_RYTM` |
| `project.ts` | factories, `migrateProject`, `asProject`, `projectData`, `arrangerPatterns`, reads (`getPattern`, `trackLength`, `trigSteps`, `mutedSteps`, `isSwingStep`, `trackTrigDefaults`, `lockedParamCount`, `rowEntry`, `trigNotes`...) |
| `edit.ts` | immutable edits: trigs, chord notes (`addChordNote`), locks, tracks, patterns, chains, songs (rows and their chains), trig mutes, swing trigs, track mutes, copy / paste / clear, SAVE / RELOAD |
| `sequencer.ts` | `ElektronSequencer`: internal clock (with pause) or the studio transport, `onTrig` with audio times |
| `locks.ts` | `interceptForLocks`, `displayWithLocks`, `clearLock`, `isLocked` for `DeviceModule` hooks |
| `lockState.ts` | `LockTracker`: per-voice lock bookkeeping in engines |
| `conditions.ts`, `format.ts`, `rng.ts` | condition codes and descriptions, readouts ("1/16", "+1/384", "INF"), the seedable RNG |

Run `npm run test:seq` after changing anything here: 237 cases, most of them
tables taken from the manuals' examples (section 10).

---

## 1. Data model

Everything is plain JSON in `DeviceModule.data`, saved with the project. It
is sparse: a missing pattern is empty, a missing step has no trig, a missing
step field uses the track default.

```jsonc
{
  "v": 1, "tracks": 12,
  "defaults": [{ "note": 60, "vel": 100, "len": 14 }, ...],  // trig defaults of new patterns, per track
  "active": "A01",                  // the selected pattern: what the keys edit, what PATTERN mode plays
  "mode": "pattern",                // what PLAY plays: "pattern" | "chain" | "song"
  "changeMode": "sequential",       // "sequential" | "direct-start" | "direct-jump" (TEMP JUMP is armed at run time)
  "mutes": [3],                     // global track mutes (optional)
  "tempoMode": "pattern",           // optional: each pattern brings its own tempo
  "restore": { "id": "A01", "pattern": { ... } },   // RELOAD PATTERN's restore point (optional)
  "patterns": {
    "A01": {
      "name": "VERSE", "length": 16, "speed": "1x", "scaleMode": "pattern",
      "master": 16, "change": 0,    // PER TRACK only: master length (0 = INF), master change (0 = OFF)
      "swing": 58, "swingTrigs": [1, 3, 5, 7],      // swing 50..80 %; swing trigs (missing = every second step)
      "kit": "", "tempo": 124, "quantize": 0,       // kit = an opaque reference for the device
      "tracks": [
        { "note": 36, "vel": 100, "len": 14, "steps": {
            "0":  {},                                               // a plain note trig
            "4":  { "vel": 127, "cond": "1:2", "micro": -3 },
            "5":  { "note": 57, "chord": [3, 7] },                  // a chord trig: A C E (Analog Four POLY)
            "6":  { "trigless": true, "locks": { "decay": 40 } },   // a lock trig
            "8":  { "mute": true },                                 // a trig mute
            "12": { "retrig": { "rate": 12, "len": 30, "vel": -64 }, "accent": true }
          },
          "length": 12, "speed": "2x",  // PER TRACK only (optional)
          "prob": 50, "quantize": 64 }  // optional: track trig probability, track quantize
      ]
    }
  },
  "chain": ["A01", "A01", "A02"],
  "song": { "name": "", "loop": false,
            "rows": [{ "pattern": "A01", "repeats": 4, "mutes": [3], "transpose": 5,
                       "chain": [{ "pattern": "A02", "mutes": [1] }, { "pattern": "B03" }] }] }
}
```

| Field | Encoding |
|---|---|
| pattern ids | `"A01"` … `"H16"` (`patternId(bank, index)`, `parsePatternId`, `ALL_PATTERN_IDS`) |
| `length` | 1–64 steps; the trig keys show 16 per page |
| `speed` | `2x`, `3/2x`, `1x`, `3/4x`, `1/2x`, `1/4x`, `1/8x` = 3, 4, 6, 8, 12, 24, 48 ticks per step (24 PPQN; 1x = a 16th = 6 ticks) |
| `len` | index into `NOTE_LENGTHS` (128 positions: 0.125 … 128 steps, then INF). `LEN_1_STEP` = 14 = 1/16, 30 = 1/8, `LEN_INF` = 127. `formatLength()` |
| `micro` | −23 … +23 in 1/384 of a whole note = 1/24 step (`formatMicro` → "+1/384") |
| `cond` | `"1:2"`…`"8:8"`, `"1%"`…`"100%"` (22 steps), `FILL !FILL PRE !PRE NEI !NEI 1ST !1ST`. `TRIG_CONDITIONS` lists them in encoder order |
| `retrig` | `rate` = index into `RETRIG_RATES` (1/1 … 1/80 of a whole note), `len` = `NOTE_LENGTHS` index (INF = until the next trig), `vel` = −128 … +127 velocity curve |
| `locks` | `{ key: number }`: parameter keys and units are the device's business |
| `chord` | a chord trig's further notes, semitone offsets from `note` (non-zero, unique, ±48, at most `CHORD_MAX` − 1 = 3). The sequencer ignores it; a device plays `trigNotes(step, e.note)` (the transposed note first) when the track is polyphonic (A4 MKII manual, p.28, p.42). `addChordNote` adds a note the way keys held together do, `formatChord` reads it out ("C4 E4 G4"), `cleanChord` normalises saved data |
| `slide` / `pslide` / `accent` / `mute` | note slide (A4), parameter slide, accent, trig mute |
| song `rows` | a row is its own pattern position plus an optional `chain` of further positions; `mutes` and `transpose` belong to each position, `repeats` to the row. `length` and `tempo` per row are extras the hardware doesn't have |

**Edits.** Everything in `edit.ts` is a pure `Project → Project` function with
structural sharing (untouched patterns and tracks keep their identity, which
keeps the scheduler's compile cache warm). Use them through `updateData`:

```ts
ctx.updateData(d => toggleTrig(asProject(d, 12), 'A01', track, step));
```

`asProject(data, tracks)` returns the project itself when the data already is
one (cheap, call it in render), and repairs anything else. Select patterns
with `setActive(p, id)`: it also sets the RELOAD restore point.

---

## 2. What the sequencer does, and where the manuals say so

### 2.1 Patterns and transport

- 8 banks × 16 patterns, 128 in all; edits are kept automatically, and the
  active pattern's edits can be reverted (A4 MKII manual, p.38; Rytm MKII
  manual, p.37).
- Selecting a pattern while one plays cues it: in SEQUENTIAL mode it starts
  when the playing pattern reaches its end, and it blinks until then (A4 MKII
  manual, p.38; Rytm MKII manual, p.37). `SeqState.queued`.
- [PLAY] plays; [PLAY] while playing pauses and [PLAY] again carries on from
  the same place; [STOP] stops, and the next [PLAY] starts from the top (A4
  MKII manual, p.13, p.38–39; Rytm MKII manual, p.11, p.37). `start()`,
  `pause()`, `resume()`, `stop()`; the kit's `pressPlay` / `pressStop`. Notes
  sounding at a pause or a stop get their note-off. [STOP][STOP] fading the
  send effects is the device's job.
- PROJECT or PATTERN tempo mode: one tempo for all patterns, or each pattern
  brings its own (A4 MKII manual, p.39; Rytm MKII manual, p.38).
  `Project.tempoMode`, `Pattern.tempo`; internal clock only, the studio
  transport keeps its tempo.

### 2.2 Trigs, trig defaults, micro timing, note length

- Two kinds of trig: note trigs play a note, lock trigs only apply their
  parameter locks; [FUNC] + [TRIG] places a lock trig (A4 MKII manual, p.40;
  Rytm MKII manual, p.39). `Step.trigless`.
- [TRIG] + [YES] previews a trig with its locks (A4 MKII manual, p.40; Rytm
  MKII manual, p.39): `preview(track, step)`, or the kit's keys with REC off.
- Trig defaults differ (section 3): the Analog Four copies its NOTE menu
  values into each new trig, so a later change only affects trigs placed after
  it (A4 MKII manual, p.45); the Rytm's TRIG page applies to every trig that
  doesn't lock its own (Rytm MKII manual, p.43). `trackTrigDefaults()`.
- Micro timing moves a trig off the grid in units of 1/384 note (A4 MKII
  manual, p.45), set with [TRIG] + [LEFT] / [RIGHT] (Rytm MKII manual, p.39).
  The ±23 range (just short of a step either way) is the hardware encoder's.
  Negative values are scheduled early, on the last tick before the trig,
  also across loop points and pattern changes (**design**: the scheduler's
  look-ahead).
- Note length: 1/16 is one step, 1/8 two, 1/4 four (A4 MKII manual, p.41;
  Rytm MKII manual, p.40), on a scale from 0.125 step to INF (Rytm MKII
  manual, p.41). A note-off follows each note unless LEN is INF; the next
  note on the track cuts it.
- Track trig probability PRB 0–100 % is rolled again each time a trig is due,
  and a trig condition overrides it: PRB 70 % with a FILL condition plays only,
  and always, in FILL mode (A4 MKII manual, p.45; Rytm MKII manual, p.43–44).
  `Track.prob`; PRB is not a condition result, so PRE and NEI ignore it
  (**design**).

### 2.3 Parameter locks

- Hold a trig and turn an encoder: the value is locked on that trig (an empty
  step becomes a lock trig); removing the trig removes its locks (A4 MKII
  manual, p.49–50; Rytm MKII manual, p.47). `interceptForLocks`.
- A lock holds for its own trig: the next trig on the track, note or lock,
  returns every parameter it doesn't lock to the track value (**design**,
  `LockTracker`).
- A pattern can lock 128 different parameters on the Analog Four (A4 MKII
  manual, p.50) and 72 on the Rytm (Rytm MKII manual, p.47); a parameter
  counts once however many trigs lock it. `LOCK_LIMIT_A4`, `LOCK_LIMIT_RYTM`
  as `LockOptions.lockLimit`: one more parameter is refused and the turn is
  swallowed. Each (track, parameter) pair counts once; NOTE / VEL / LEN, micro
  timing and conditions are trig settings, not locks (**design**).

### 2.4 Trig conditions and FILL

Conditions are trig settings chosen while holding a trig (A4 MKII manual,
p.50–51; Rytm MKII manual, p.48–49):

| Condition | True when |
|---|---|
| `X%` | an X % chance, rolled each time |
| `FILL` / `!FILL` | FILL mode is on / off |
| `PRE` / `!PRE` | the most recently evaluated condition on this track was true / was not. PRE and !PRE are not evaluated themselves, so they never change it; nothing evaluated yet counts as not true |
| `NEI` / `!NEI` | the same for the neighbour track, the track before (track 3 for track 4). NEI is false when the neighbour has no evaluated condition, so !NEI is true |
| `1ST` / `!1ST` | the first loop / every loop but the first |
| `A:B` | loop A of every B: 1:2 on loops 1, 3, 5…; 2:2 on 2, 4, 6…; 2:4 on 2, 6, 10…; 4:7 on 4, 11, 18… |

The tests replay the manuals' examples, including both PRE chains
(50 % > !PRE > !PRE > PRE). A:B and 1ST count the track's own loops, as the
manual allows for a track shorter than the pattern; a pattern starting resets
the counts. Conditions are still evaluated on muted tracks and muted trigs,
so PRE and NEI keep working (**design**).

FILL: hold [FILL] for a momentary fill, [FUNC] + double [FILL] latches it,
[FUNC] + [FILL] cues it for one pattern cycle, from the next time the pattern
loops until it loops again (A4 MKII manual, p.51; Rytm MKII manual, p.49).
`setFill`, `latchFill`, `cueFill`; in PER TRACK mode one cycle is the master
length.

### 2.5 Trig mutes, accents, slides, swing

- TRIG MUTE ([FUNC] + [BANK E]) mutes single trigs; each track has its own
  (A4 MKII manual, p.51; Rytm MKII manual, p.49). A muted trig plays no note
  and applies no locks. `Step.mute`, `setTrigMute`; the kit's `trigmute` mode
  and the TrigEditor's MUTE key. Only steps that hold a trig can be muted
  (**design**: a step without a trig stores nothing).
- ACCENT ([FUNC] + [BANK F]) marks trigs to accent (A4 MKII manual, p.51–52;
  Rytm MKII manual, p.49–50). `TrigEvent.accent`; the device decides what an
  accent does (section 3).
- NOTE SLIDE (Analog Four, [FUNC] + [BANK G]): the previous note's pitch
  glides to the slide trig's note (A4 MKII manual, p.52). `TrigEvent.slide`;
  when the notes overlap no note-off comes between them (legato, **design**).
- PARAMETER SLIDE ([FUNC] + [BANK H]): a locked value glides to the next trig's
  value (or back to the unlocked one), arriving when that trig is reached;
  several parameters can slide at once (A4 MKII manual, p.52–53; Rytm MKII
  manual, p.50–51). `TrigEvent.paramSlide` + `slideTo` (the next trig in the
  playing pattern).
- SWING sets 50 % (straight) to 80 % (A4 MKII manual, p.53; Rytm MKII manual,
  p.50). The swing trigs say which steps swing, every second step by default,
  and the Rytm's SWING menu places or removes them with the trig keys (Rytm
  MKII manual, p.50); swing trigs are pattern data on the A4 too (A4 MKII
  manual, p.38). `Pattern.swingTrigs`, `toggleSwingTrig`; the kit's `swing`
  mode. A swing trig's step is late by (swing − 50) / 50 of a step, on every
  track that plays that step (at 80 % each swung pair splits 4:1). Synced to
  the studio, the transport's own swing adds on top.

### 2.6 Retrigs (Analog Rytm)

A retrig repeats a trig at a rate from 1/1 to 1/80 (1/16 = once a step, 1/32
twice, 1/12 and 1/24 triplets) for a length on the LEN scale, with a velocity
curve from −128 (fade out completely) to +127 (fade in from silence); retrigs
set on a trig override the track's retrig menu (Rytm MKII manual, p.41–42).
`Step.retrig`; each hit is its own `TrigEvent` (`retrigIndex` 1, 2…), each
ends before the next, and a new note on the track cuts the roll.

### 2.7 SCALE: length, speed, PER TRACK, page copies, quantize

- NORMAL mode: all tracks share the pattern's length (1–64 steps in pages of
  16) and scale; the seven scales run from 1/8X to 2X, 3/2X plays twice as
  fast as 3/4X (A4 MKII manual, p.48; Rytm MKII manual, p.46).
- Extending the length copies the existing pages into the new ones: two
  pages made four play pages 1, 2, 1, 2 (A4 MKII manual, p.49; Rytm MKII
  manual, p.46). `updatePatternSettings(..., { copyPages: true })`,
  `setTrackScale(..., { copyPages: true })`; the kit's ScaleMenu does it.
- ADVANCED (PER TRACK) mode: each track has its own length and scale, set
  like NORMAL mode for the active track; the master length restarts every
  track together (INF = never), and the master change sets how long the
  pattern plays before a cued or chained pattern starts, at the end of the
  pattern by default (CHNG OFF); with INF and no CHNG a SEQUENTIAL change never
  happens (A4 MKII manual, p.49; Rytm MKII manual, p.47). DIRECT changes still
  work (Rytm MKII manual, p.47). Entering PER TRACK starts the master length
  at the pattern length, so playback doesn't change (**design**).
- GLOBAL QUANTIZE and TRACK QUANTIZE (0–127) pull micro-timed trigs towards
  the grid without changing them (A4 MKII manual, p.47; Rytm MKII manual,
  p.45). `Pattern.quantize`, `Track.quantize`; the larger of the two applies
  (**design**).

### 2.8 Pattern changes, TEMP JUMP, SAVE / RELOAD

| Mode | The new pattern starts (A4 MKII manual, p.39–40; Rytm MKII manual, p.38–39) |
|---|---|
| SEQUENTIAL (default) | when the playing pattern reaches its end |
| DIRECT START | at once, from its first step (here: on the next step, to stay on the grid) |
| DIRECT JUMP | at once, from the position where the previous pattern left off |
| TEMP JUMP | [FUNC] + [BANK D] arms it (the LED blinks); the next pattern picked jumps in like DIRECT JUMP, plays to its end once, then the previous pattern returns and TEMP JUMP is off again |

In CHAIN mode only TEMP JUMP changes pattern: the jumped-to pattern stands in
for the playing chain entry and the chain carries on after it (A4 MKII manual,
p.40; Rytm MKII manual, p.39). `armTempJump()` / `seq:temp-jump`;
`SeqState.tempJump` is `'armed'`, `'active'` or `'off'`, and
`SeqState.changeMode` is the mode the next selection uses. A project saved
with `changeMode: 'temp-jump'` arms it once and then falls back to the mode
before it.

RELOAD PATTERN takes the active pattern back to its state when it was
selected, or at the last SAVE PATTERN; RELOAD TRACK and SAVE TRACK do the
same for one track (A4 MKII manual, p.42–43; Rytm MKII manual, p.42–43). It
is an undo for live edits until another pattern is selected (Rytm MKII
manual, p.52). `savePattern`, `reloadPattern`, `saveTrack`, `reloadTrack`;
the restore point is `Project.restore`, set by `setActive`.

### 2.9 Copy, paste and clear

Patterns, tracks, track pages and trigs can be copied, pasted and cleared;
pasting or clearing a pattern or a page is undone by doing it again; trigs
are pasted in the same relation to each other, starting at the destination
trig; holding trigs and clearing removes their locks (A4 MKII manual, p.54;
Rytm MKII manual, p.51). `copyPattern` / `pastePattern` / `clearPattern`,
`copyTrack` / `pasteTrack` / `clearTrack`, `copyPage` / `pastePage` /
`clearPage`, `copyTrigs` / `pasteTrigs`, `clearLocks`. An undo is pasting back
what was there (the PatternPicker's UNDO). [FUNC] + [LEFT] / [RIGHT] shifts
every trig of a track a step (A4 MKII manual, p.40, p.84; Rytm MKII manual,
p.39, p.75): `shiftTrigs`, wrapping round the track length.

### 2.10 Chains and songs

- A chain plays its patterns in order and loops after the last; leaving CHAIN
  mode keeps the playing pattern looping; there are 256 pattern entries for
  the chains (A4 MKII manual, p.55; Rytm MKII manual, p.53). Each entry hands
  over at its pattern's change length.
- A song plays its rows top to bottom; a row with a chain plays all its
  patterns before the next row; it can start from any pattern position (A4
  MKII manual, p.55–56; Rytm MKII manual, p.53–54). `playSong(row, pos)` /
  `seq:song-row { row, pos }`.
- Song rows: patterns are added to a row's chain, moved within it and removed
  one at a time, and a row goes with its last pattern (A4 MKII manual, p.56;
  Rytm MKII manual, p.54). `songAddEntry`, `songMoveEntry`, `songUpdateEntry`,
  `songRemoveEntry` (keeps the row's own pattern), `songRemoveRow`; the
  SongEditor's ✕ removes one pattern at a time. The hardware gives a new row
  pattern A01; `songAddRow` takes a pattern (default: the selected one).
- REPEAT plays a row several times; song mutes belong to a pattern position,
  not to the pattern (A4 MKII manual, p.56; Rytm MKII manual, p.54–55); the
  Analog Four also transposes a pattern position (A4 MKII manual, p.57).
  `SongRow.repeats`, `SongEntry.mutes`, `SongEntry.transpose`; song mutes
  replace the pattern's own track mutes while the position plays.
- The manuals' song chapters describe no song loop: the song plays row by row,
  and the scratch pad row in its default place at the bottom plays its chain
  once, then stops (A4 MKII manual, p.55; Rytm MKII manual, p.53). A song here
  stops at its end (`song.loop` false, the default); `setSongLoop(p, true,
  row)` makes it loop back to a row (an extra). Row `length` and `tempo` are
  extras too.

### 2.11 Track mutes and solo

- Track mutes are global: [FUNC] + [TRACK] on the A4, MUTE mode on the Rytm;
  they stay through pattern changes and are part of the project's state (A4
  MKII manual, p.16, p.37; Rytm MKII manual, p.23). `Project.mutes`,
  `setMasterMute`, `setMasterMutes`.
- Holding [FUNC] preselects several mutes that take effect when [FUNC] is
  released (A4 MKII manual, p.27; Rytm MKII manual, p.23): `setMasterMutes`
  (data) or `seq:mutes` (runtime).
- These master mutes override trig mutes and song mutes (Rytm MKII manual,
  p.23).
- Solo ([RTRG] + pad on the Rytm) mutes every other track; several tracks can
  be soloed (Rytm MKII manual, p.23). `setSolo` / `seq:solo`.
- `setMute` / `seq:mute` are runtime mutes on top (not saved), and
  `Track.mute` is a per-pattern mute (an extra).

### 2.12 MIDI: clock, transport, song position, program change

- Following the studio transport works like MIDI clock with transport receive:
  start, stop, continue and song position pointer (A4 MKII manual, p.58; Rytm
  MKII manual, p.61). A continue or a song position lines the pattern, chain or
  song up as if it had played from tick 0, conditions included.
- Program change 0–127 selects (cues) A01–H16, and PRG CH SEND sends the
  pattern number (Rytm MKII manual, p.22, p.61; A4 MKII manual, p.38, p.59).
  `seq:program { program }`, `patternFromProgram`, `programOfPattern`.

---

## 3. Analog Four MKII vs Analog Rytm MKII

| | Analog Four MKII | Analog Rytm MKII | In the library |
|---|---|---|---|
| Tracks | 4 synth tracks, FX, CV (A4 MKII manual, p.17) | 12 drum tracks, FX (Rytm MKII manual, p.21, p.37) | `tracks: 4` (6 with FX and CV) / `12` (13 with FX) |
| Lock limit | 128 parameters per pattern (A4 MKII manual, p.50) | 72 (Rytm MKII manual, p.47) | `lockLimit: LOCK_LIMIT_A4` / `LOCK_LIMIT_RYTM` |
| Trig defaults | NOTE menu values copied into each new trig (A4 MKII manual, p.45) | TRIG page is a live default; NOT is a −24…+24 offset (Rytm MKII manual, p.43) | TrigKeys / TrigEditor `stampDefaults` (A4); `noteFormat` for the Rytm offset |
| Swing | SWING menu, [FUNC] + [PTN] (A4 MKII manual, p.53); swing trigs are pattern data (p.38) | SWING menu, [FUNC] + [BANK G]: amount and swing trigs on the trig keys (Rytm MKII manual, p.50) | `swing`, `swingTrigs`; TrigKeys `swing` mode |
| Scale | SCALE menu NORMAL / ADVANCED, 1/8X–2X, master LEN and CHNG (A4 MKII manual, p.48–49); TRK KEY SCALE fits notes to a musical scale (p.47) | the same SCALE menu (Rytm MKII manual, p.46–47); PAD SCALE only for chromatic pads (p.42) | `speed`, `scaleMode`, `master`, `change`; key scales are not modelled |
| Retrigs | none on trigs (the NOTE menu's ENV / LFO switches restart envelopes, A4 MKII manual, p.45) | per trig: rate, length, velocity curve, and the [RTRG] menu (Rytm MKII manual, p.41–42) | `Step.retrig`; TrigEditor `features.retrig` |
| Accent | changes volume and filter envelope; the amount is set per track (A4 MKII manual, p.51–52) | changes velocity; the amount is set per track (Rytm MKII manual, p.49–50) | `TrigEvent.accent`; the engine applies it |
| Slides | NOTE SLIDE (A4 MKII manual, p.52) and PARAMETER SLIDE (p.52–53) | PARAMETER SLIDE only (Rytm MKII manual, p.50–51) | `slide`, `pslide`; TrigEditor `features` |
| Track mutes | [FUNC] + [TRACK], PERFORMANCE mode keys (A4 MKII manual, p.27, p.37) | MUTE mode pads, solo with [RTRG] (Rytm MKII manual, p.23) | `Project.mutes`; `seq:solo` |
| Songs | rows of a pattern or a chain; repeats, song mutes and transpose per pattern position (A4 MKII manual, p.55–57) | rows of a chain; repeats and song mutes per pattern position (Rytm MKII manual, p.53–55) | SongEditor `transpose` for the A4 |
| SAVE / RELOAD keys | [YES] / [NO] + [PTN], + [TRK] (A4 MKII manual, p.54) | [YES] / [NO] + [SCNE], + [CHRO] (Rytm MKII manual, p.51–52) | `savePattern`, `reloadPattern`, `saveTrack`, `reloadTrack` |

---

## 4. Engine side

Create one `ElektronSequencer` in `build()` and wire four hooks.
`components/sequencer/example.tsx` holds a complete, type-checked version of
these snippets.

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
    // The UI kit reads engine.seq (playheads, cued pattern, fill, song row, paused, TEMP JUMP...)
    this.seq.subscribe(s => this.emit({ seq: s, playing: s.playing, step: s.steps[this.num('track')] }));
    this.onDispose(() => this.seq.dispose());
  }

  protected onData(data: unknown) { this.seq.setProject(data); }          // DeviceModule.data changed
  protected onTransport(t: Transport | null) { this.seq.follow(t); }      // studio sync on / off

  protected onParam(id: string, value: ControlValue) {
    if (id === 'play') {
      // on = play from the top, off = stop (also ends a pause). PLAY while playing comes as
      // 'seq:pause' / 'seq:resume' (the kit's pressPlay), so the control stays on while paused.
      // Synced, the hub turns PLAY into studio Play/Stop: never start the internal clock then.
      if (!this.transport) value ? this.seq.start() : this.seq.stop();
      return;
    }
    if (id === 'tempo') this.seq.setTempo(Number(value));
    // sound parameters: don't override a value the playing trig has locked
    // if (this.locks.isLocked(track, key)) return;
  }

  event(name: string, payload?: unknown) {
    if (this.seq.handleEvent(name, payload)) return;   // the kit's and the arranger's events
    // ... pads, other keys ...
  }

  private trig(e: TrigEvent) {
    const v = this.voices[e.track];
    // Locks belong to this trig: the next trig on the track reverts what it doesn't lock itself
    this.locks.apply(e.track, e.locks,
      (key, value) => v.set(key, value, e.time),                   // lock
      key => v.set(key, this.trackValue(e.track, key), e.time));   // back to the kit value
    if (e.paramSlide && e.slideTo) {                                // parameter slide
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

`onTrig` fires ahead of time (0.12 s look-ahead; 1.8 s while the page is
hidden, because WebKit runs a hidden page's timers about once a second) with
**audio-context times**. Schedule everything at `e.time`; never treat the
callback moment as musical time. One fresh object per hit; `e.locks` is
shared with the project data, so don't mutate it.

| Field | Meaning |
|---|---|
| `track`, `step`, `pattern`, `loop` | where it came from; `loop` is the track's loop counter |
| `time` | start, with swing, micro timing and retrig offsets |
| `duration` | gate length in seconds (`Infinity` for LEN INF). A matching `onNoteOff(track, note, time)` follows; the next note on the track (in any pattern), a pause or a stop cuts it earlier |
| `note`, `velocity` | step value or track default, song transpose included; velocity 1–127 after the retrig curve |
| `locks` | the trig's parameter locks (apply for this trig only, see `LockTracker`) |
| `trigless` | lock trig: apply `locks` to the sounding voice, start no note (no note-off follows) |
| (chord) | not a field: a device that plays chords reads the step (`getStep(project, e.pattern, e.track, e.step)`) and plays `trigNotes(step, e.note)`; overlapping notes on a polyphonic track are the device's to keep (it ignores the cut note-off) |
| `retrig`, `retrigIndex` | retrig hits arrive as separate events, `retrigIndex` 1, 2…; each ends before the next |
| `slide` | note slide: glide from the previous note. When the notes overlap there is **no note-off** in between (legato), so don't retrigger the envelope |
| `paramSlide`, `slideTo` | parameter slide from this trig's values to `slideTo.locks` (unlocked keys → track values), arriving at `slideTo.time` |
| `accent`, `fill`, `condition`, `conditionPassed` | `conditionPassed` is false only with `emitFailed: true` (for LED feedback); muted trigs are never emitted |
| `stepDuration` | seconds per step on this track (slide times, envelope scaling) |

On a stop or a pause, `locks.releaseAll((track, key) => ...)` from
`onPlay(false)` puts locked values back if your voices keep them.
`locks.add(track, key, value)` marks a key locked by the trig playing now
(a lock recorded live while the track plays): the next trig reverts it like
the trig's own locks.

### Options and methods

| | |
|---|---|
| `new ElektronSequencer({ ctx, tracks, onTrig, onNoteOff, onStep, onPattern, onSongRow, onTempo, onPlay, bpm, seed, rng, emitFailed, neighbor, lookahead, hiddenLookahead, visibility, project })` | `seed` makes probabilities deterministic (tests); `neighbor(track)` overrides the NEI track; `onSongRow(row, repeat, time, pos)` reports rows, repeats and chain positions; `onTempo` reports PATTERN tempo mode and row tempos on the internal clock; `onPlay` reports start, stop, pause, resume and a song's end |
| `setProject(data)` | new device data: patterns, `mutes`, `changeMode`; selecting another pattern (`active`) while playing cues it per the change mode |
| `start(atTime?)` / `stop()` / `pause()` / `resume(atTime?)` / `setTempo(bpm)` | internal clock (ignored while following); `isPaused`; a start after a pause plays from the top |
| `follow(transport \| null)` | studio sync: 6 ticks per 16th at 1x; start, stop, continue and locate follow the transport |
| `queuePattern(id, mode?)` | cue a pattern (stopped: it plays on start) |
| `armTempJump(on?)` | arm (or disarm; no argument toggles) TEMP JUMP for the next selection |
| `selectPattern(id, atTime?)` | the song arranger: start `id` from step 1 on the tick at `atTime`, then loop it in PATTERN mode until stop (`SeqState.arranged`). Routed from `arranger:pattern` |
| `playSong(row, pos?)` / `playChain(index)` | where the song / chain starts; while it plays, jump (at the next change, or on the next step in the DIRECT modes) |
| `setFill(on)` / `latchFill(on?)` / `cueFill()` | hold, latch, or cue FILL for one pattern cycle |
| `setMute(track, on)` / `setMutes(flags)` / `setSolo(track, on)` / `isMuted(track)` | runtime mutes and solo on top of the project's mutes |
| `preview(track, step, pattern?)` / `previewOff(track)` | audition a step now (REC off trig keys) |
| `audition()` | lessons: play the pattern on the internal clock even while following a stopped transport; returns a stop function |
| `getState()` / `subscribe(fn)` | `SeqState`: what is **audible** now: playing, paused, following, mode, pattern, queued, steps per track, fill (held, latched, cued), song row, repeat and position, chain index, bpm, runtime mutes, solos, TEMP JUMP state, the change mode in effect, arranged |
| `handleEvent(name, payload)` | routes the events below; returns true when handled |

Events: `seq:fill` / `seq:fill:up`, `seq:fill-latch { on? }`, `seq:fill-cue`,
`seq:queue { id, mode? }`, `seq:program { program }`, `seq:temp-jump { on? }`,
`seq:song-row { row, pos? }`, `seq:chain-index { index }`,
`seq:mute { track, on? }`, `seq:mutes { mutes }` (flags or track numbers),
`seq:solo { track, on? }`, `seq:start`, `seq:stop`, `seq:pause`,
`seq:resume`, `seq:preview { track, step, pattern? }` / `seq:preview:up`,
`seq:audition` / `seq:audition:stop`, and the arranger's
`arranger:pattern { id, time }`.

**Load.** The tick path uses typed arrays and allocates only the emitted
events and UI snapshots: 12 tracks × 64 steps of retrigs and locks give about
26 000 hits per simulated 5 minutes in ~60 ms.

---

## 5. Module side

```ts
import {
  LOCK_LIMIT_RYTM, arrangerPatterns, asProject, displayWithLocks, interceptForLocks, projectData, type LockOptions,
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
  lockLimit: LOCK_LIMIT_RYTM,                  // 72 parameters per pattern (LOCK_LIMIT_A4 = 128)
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
  empty held step becomes a lock trig; past `lockLimit` the turn is swallowed.
  `toLock` / `fromLock` convert switch or string controls; booleans lock as
  1 / 0.
- **`displayValues`**: knobs show the held trig's locks (and its NOTE / VEL /
  LEN, micro timing, condition), the track defaults with `trackDefaults`, and
  the track probability. `isLocked(api, LOCKS, id)` for a locked-encoder
  highlight, `clearLock(api, LOCKS, id)` to remove one.
- **TRIG page controls** that `lockKey` maps to the special keys use these
  ranges (spec `knob` with `step: 1` and a `format`):

  | key | control value | readout |
  |---|---|---|
  | `note` | MIDI note 0–127 | `formatNote` |
  | `vel` | 1–127 | |
  | `len` | `NOTE_LENGTHS` index 0–127 (14 = 1/16, 127 = INF) | `formatLength` |
  | `micro` | −23…23 | `formatMicro` |
  | `cond` | `TRIG_CONDITIONS` index (0 = none) | `TRIG_CONDITIONS[v] \|\| 'NONE'` |
  | `prob` | 0–100 (track probability, not a lock) | `${v}%` |
- **`studio.patterns`** lists the patterns that hold trigs for the arranger;
  the arranger's `event('arranger:pattern', { id, time })` goes straight to
  `seq.handleEvent`.
- **PLAY**: light the play key from `SeqState.playing` (blink on
  `SeqState.paused`), not from the control value: a pause keeps the control
  on, and a song that ends stops by itself.

---

## 6. UI kit

Render the components from `custom` layout elements; each takes the element's
`CustomRenderContext` as `ctx`, plus `tracks` (the track count, used when the
data is missing). They work with a mouse and with touch: text ≥ 9 px, touch
targets ≥ 28 px **at 1:1**. Size the elements in mm so they stay ≥ 28 px after
the panel's fit scale (`mm × pxPerMm × scale`), or use `portal`.

```tsx
const TRACKS = 12;
elements: [
  // the trig keys (x/y/w/h in mm, top-left); mute mode edits the global track mutes
  { kind: 'custom', x: 40, y: 150, w: 300, h: 14, render: ctx => <TrigKeys ctx={ctx} tracks={TRACKS} muteTarget="project" /> },
  { kind: 'custom', x: 345, y: 150, w: 40, h: 8, render: ctx => <PagePicker ctx={ctx} tracks={TRACKS} /> },
  // mode keys: the [FUNC] + [BANK E-H] menus; TrigKeys without a `mode` prop follow them
  { kind: 'custom', x: 40, y: 138, w: 20, h: 8, render: ctx => <TrigModeKey ctx={ctx} mode="trigmute" /> },
  { kind: 'custom', x: 10, y: 120, w: 18, h: 8, render: ctx => <MenuKey ctx={ctx} menu="pattern" label="PTN" /> },
  { kind: 'custom', x: 345, y: 120, w: 30, h: 10, render: ctx => <TransportKeys ctx={ctx} /> },
  // overlays float over the page (portal: full size, outside the scaled panel), so this box can be tiny
  { kind: 'custom', x: 0, y: 0, w: 1, h: 1, render: ctx => (<>
      <TrigEditor ctx={ctx} tracks={TRACKS} portal features={{ retrig: true, accent: true, slide: false, pslide: true }} lockLimit={LOCK_LIMIT_RYTM} />
      <PatternPicker ctx={ctx} tracks={TRACKS} portal />
      <ChainBuilder ctx={ctx} tracks={TRACKS} portal />
      <SongEditor ctx={ctx} tracks={TRACKS} portal tempo={false} length={false} loop={false} />
      <ScaleMenu ctx={ctx} tracks={TRACKS} portal />
  </>) },
]
```

| Component | Does | Notable props |
|---|---|---|
| `TrigKeys` | The 16 keys of the shown page. **Tap** toggles a trig. **Press and hold** holds the step (`ui.heldSteps`): turn an encoder to lock it. **Hold one + tap another** selects the range. **Long hold then release** (without turning anything) or **double tap** opens the TrigEditor; while it is open the keys pick its steps (shift-click: range). Modes: `accent`, `slide`, `pslide` and `trigmute` toggle that flag, `swing` the pattern's swing trigs, `mute` and `solo` turn keys 1..N into track keys. LEDs: red note trig, amber lock trig, white ring playhead, dimmed when the track is silent (mutes, solo), cyan condition label, dots for locks, ◂▸ micro timing, R/S/P/A/M retrig / slide / parameter slide / accent / trig mute | `track`, `pattern`, `page`, `mode` (default: `ui.seqTrigMode`), `muteTarget` (`'pattern'`, `'project'` = the global track mutes, `'live'` = `seq:mute`), `stampDefaults` (A4), `editable` (false = REC off: keys preview steps), `rows`, `color`, `trackNames`, `longPressMs`, `editor` |
| `TrigModeKey` | switches the trig keys into a mode and back to TRIGS (`ui.seqTrigMode`) | `mode`, `label`, `color` |
| `TrigEditor` | NOTE, VEL, LEN, micro timing, condition (NONE / % / A:B / logic), retrig rate / length / curve, slide / p.slide / accent, **MUTE** (trig mute), note or lock trig, the trig's locks with a clear button each, and the pattern's lock budget. Edits every selected step | `features` (`slide`, `pslide`, `accent`, `retrig`, `trigMute`), `lockLimit`, `stampDefaults`, `lockLabel`, `lockFormat`, `noteFormat` (Rytm: a tune offset), `noteRange`, `portal`, `portalPlacement` |
| `PagePicker` | the 4 step pages: white = shown, green dot = playing, dark = past the length | `track`, `pattern`, `vertical`, `showLength` |
| `PatternPicker` | banks A–H × 16: tap selects (cues while playing: it blinks until it starts); COPY / PASTE / CLEAR (tap twice) / **UNDO** (and REDO) of the last PASTE or CLEAR; **SAVE** / **RELOAD** (the restore point); SEQUENTIAL / DIRECT START / DIRECT JUMP and the **TEMP JUMP** arming key (blinks while armed, lit while the jumped-to pattern plays); PLAY = pattern / chain / song; name | `banks`, `changeModes`, `playModes`, `names`, `saveReload`, `closeOnPick` |
| `ChainBuilder` | append patterns, select an entry to move / remove / CUE it, PLAY CHAIN | `maxLength` (256, the hardware's) |
| `SongEditor` | rows of a pattern **or a chain** × repeats: per pattern position PATTERN, TRSP, song MUTES, ▶ cue from it, ▲▼ move it, ✕ remove it; **+ PTN** adds a pattern to a row; per row REPEAT, LENGTH, BPM, move / loop-here / delete; LOOP or END; the playing row and position are green | `trackNames`, `transpose` (A4), `chains`, `loop`, `length`, `tempo`, `names`, `maxRows`, `maxChain` |
| `ScaleMenu` | PER PATTERN / PER TRACK, length (a longer one copies the pages), scale, master length (INF) and change (OFF), the track's length and scale, swing | `track`, `pattern`, `trackNames`, `copyPages` (default on) |
| `TransportKeys` | PLAY (stopped: play; playing: pause; paused: resume) and STOP; synced to the studio they play and stop the studio transport | `control` (default `'play'`), `vertical`, `labels` |
| `MenuKey` | opens / closes one menu (`ui.seqMenu`); the pattern key blinks while a pattern is cued | `menu`, `label`, `color` |

`pressPlay(ctx, control?)` and `pressStop(ctx, control?)` are TransportKeys'
logic for a device's own PLAY and STOP keys.

Overlays show when `ui.seqMenu` names them (`'pattern' | 'chain' | 'song' |
'scale'`), or pass `open` to show one permanently inside its element's box.
Without `portal` they fill their custom element (give it room); with `portal`
they float at the top of the viewport (`portalPlacement: 'bottom'` if your
keys are at the top) and size to their content.

**UI state** (`ui`, per instance, not saved): `heldSteps`, `heldTrack`,
`heldPattern`, `heldEdited`, `stepPage`, `trigEditor` (`{ track, pattern,
steps }`), `seqMenu`, `seqBank`, `seqClipboard`, `seqTrigMode`, `seqUndo`.

**Events** the kit sends (all handled by `seq.handleEvent`): `seq:mute`
`{ track }`, `seq:solo` `{ track }`, `seq:temp-jump`, `seq:song-row`
`{ row, pos? }`, `seq:chain-index` `{ index }`, `seq:preview` `{ track, step,
pattern }` / `seq:preview:up`, `seq:pause` / `seq:resume` / `seq:start` /
`seq:stop`. Layout buttons can send `seq:fill` (momentary: the panel sends
`seq:fill:up` on release), `seq:fill-latch` and `seq:fill-cue` themselves;
`seq:queue` `{ id }` cues a pattern without selecting it.

**Lessons**: the kit lights its parts for `step.focus` ids, and a step's
`event` lights the key that sends it (`event: 'seq:temp-jump'` lights TEMP
JUMP; lessons count the press). Ids: `seq:trig:<1-64>`, `seq:trigs`,
`seq:trig-mode:<mode>`, `seq:page:<1-4>`, `seq:pages`,
`seq:menu:<pattern|chain|song|scale>`, `seq:pattern:<A01>`, `seq:patterns`,
`seq:bank:<A>`, `seq:copy`, `seq:paste`, `seq:clear`, `seq:undo`, `seq:save`,
`seq:reload`, `seq:change:<mode>`, `seq:temp-jump`,
`seq:mode:<pattern|chain|song>`, `seq:chain`, `seq:chain:<i>`, `seq:song`,
`seq:song:row:<i>`, `seq:song:row:<i>:<pos>`, `seq:song:chain:<i>`,
`seq:song:add`, `seq:song:loop`, `seq:edit:<note|vel|len|micro|cond|retrig|
slide|accent|mute|locks>`, `seq:scale:<mode|length|speed|swing|master|change>`,
`seq:play`, `seq:stop`. Check sequencer tasks on the data:

```ts
check: s => { const p = asProject(s.data, 12); return trigSteps(p, p.active, 0).join() === '0,4,8,12'; },
// also: lockedSteps(p, id, track, 'decay'), mutedSteps(p, id, track), getStep(p, id, track, step)?.cond,
// isSwingStep(getPattern(p, id), 5), p.mutes, s.engine.seq?.paused ...
```

---

## 7. How a twin adopts the new behaviour

Everything below is additive: a twin that changes nothing keeps working, and
gets the hardware behaviour as it adopts each piece.

1. **Trig defaults: `trackTrigDefaults()`.** The Analog Four copies its NOTE
   menu values into each new trig (A4 MKII manual, p.45): pass
   `stampDefaults` to `TrigKeys` and `TrigEditor`, and use
   `trackTrigDefaults(p, id, track)` as the `init` of `toggleTrig` / `setTrig`
   in the twin's own trig handlers. The Rytm changes nothing: its trigs stay
   empty and follow the TRIG page live (Rytm MKII manual, p.43).
2. **Lock limit: `LOCK_LIMIT_*` as `lockLimit`.** Add `lockLimit:
   LOCK_LIMIT_A4` (128) or `LOCK_LIMIT_RYTM` (72) to the twin's `LockOptions`,
   and the same value to `TrigEditor` to show the budget. A lock on one more
   parameter is refused, as on the hardware.
3. **Track mutes: `Project.mutes`.** The hardware's track mutes are global and
   saved with the project. Write them with `setMasterMute(p, track, on)` (or
   `setMasterMutes(p, tracks)` when a [FUNC]-held preselection is released),
   show them with `TrigKeys mode="mute" muteTarget="project"`, and drop
   per-twin mute controls or `Track.mute` for this. The sequencer applies
   `Project.mutes` from `setProject`; they override trig and song mutes.
   `SeqState.mutes` stays the runtime layer (`seq:mute`).
4. **PLAY → `pause()`.** Replace the PLAY key's `setValue('play', !playing)`
   with `pressPlay(ctx)` and STOP with `pressStop(ctx)` (or render
   `TransportKeys`). The engine keeps `onParam('play')` as start / stop and
   routes `seq:pause`, `seq:resume`, `seq:start`, `seq:stop` through
   `handleEvent`. Light PLAY from `SeqState.playing` and blink it on
   `SeqState.paused`.
5. **Songs stop at their end: `setSongLoop`.** New projects have `song.loop`
   false, as on the hardware. Demo songs or presets that should loop call
   `setSongLoop(p, true, row)`; saved projects keep their flag. For a
   hardware-style editor pass `loop={false}` (and `length={false}`,
   `tempo={false}`) to `SongEditor`; rows can now hold chains.

Other behaviour the twins will notice: `!PRE` and `!NEI` are true before
anything was evaluated; swing applies to the swing trigs (every second step by
default) instead of counting steps across loops; a new pattern's master change
is OFF; TEMP JUMP is a one-shot arm (`seq:temp-jump`), not a lasting change
mode; RELOAD needs patterns selected with `setActive`; the ScaleMenu copies
pages when the length grows.

---

## 8. Not modelled

One project per instance (no project, kit or sound management:
`pattern.kit` is a reference); sound locks (lock a `sound` key if you need
them); the scratch pad row and saved song slots; page playback; live and step
recording (the Analog Four twin builds them on these edits: LIVE RECORDING
writes `setLock` on the playing step for each knob turn, STEP RECORDING
`updateSteps` / `addChordNote` at an active step, see `devices/analog-four`);
the arpeggiator, the Euclidean mode, key scales and track transpose (the
Analog Four keeps TRANSPOSABLE per pattern track itself); tap tempo and the ±10 % nudge; the Rytm's per-track retrig menu
settings (only retrigs on trigs); editing a step property on all tracks at
once ([FUNC] held in the TRIG MUTE, ACCENT and PARAMETER SLIDE menus, Rytm
MKII manual, p.49–50). A trig mute, accent or slide can only sit on a step
that holds a trig; parameter slides look for the next trig in the playing
pattern, so a pattern change in between makes the target moot.

---

## 9. Tests

`npm run test:seq` (`scripts/test-sequencer.ts`) runs the scheduler on a fake
audio clock and a fake transport (plus the real `Transport` class), and
renders every UI component on the server. Its "Manual:" sections are tables
taken from the two manuals, each row citing its page: trig types, locks and
the lock budget, trig mutes, accents, slides, swing trigs, every condition
with the manuals' examples, FILL, micro timing, retrig rates and curves, note
lengths, scales, master length and change, page copies, the four pattern
changes and TEMP JUMP (also in a chain), SAVE / RELOAD, chains, songs with
chain rows, mutes and solo, continue and song position, PLAY / pause, copy /
paste / clear, program changes, trig defaults, quantize and pattern tempo.
The UI kit section checks the new modes, keys and rows, and drives
`pressPlay` / `pressStop` against a live sequencer.
