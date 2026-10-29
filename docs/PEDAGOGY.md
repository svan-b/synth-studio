# How Synth Studio teaches

Synth Studio lessons are built on a few findings from learning research. Each finding maps
to a feature of the lesson engine. Use this document when writing or reviewing lessons.

## The research, briefly

| Finding | What it means here | Lesson feature |
|---|---|---|
| **Active learning beats passive.** People learn by doing and get immediate feedback (Freeman et al., 2014). | Every lesson is hands-on, and controls turn green when they're right. | `do`, `patch` steps |
| **Prediction (predict–observe–explain).** Committing to a guess before you see the result makes the result stick, whether the guess was right or wrong (White & Gunstone; Brod 2021). | Before the key move of a lesson, ask what will happen. Reveal the answer only after the learner hears it. | `predict` step |
| **Retrieval practice (the testing effect).** Recalling something strengthens memory far more than re-reading it (Roediger & Karpicke, 2006). | Ask short questions during and after the lesson. | `quiz` step, `review` questions |
| **Spacing.** Reviews spread out over days beat one long session (Cepeda et al., 2006). | Review questions come back after 1, 3, 7, 16 and 35 days; a miss resets the question to 1 day. | Daily review (automatic) |
| **Interleaving.** Mixing related skills improves discrimination and transfer (Rohrer & Taylor, 2007). | Ear challenges in later lessons mix earlier concepts: was that the filter, or the envelope? | `match` with mixed controls; ear-training path |
| **Perceptual learning.** Ears get better with focused comparison and feedback. | A/B comparisons and "recreate this sound" are the core skill of sound design, as in Syntorial's approach. | `listen`, `match` steps |
| **Worked examples, then faded guidance.** Novices need full guidance, which should fade as skill grows (Renkl; Sweller). | Lessons go "I do → we do → you do": exact targets first, then goals with hints, then open challenges. | Exact targets → `hints` → `challenge` |
| **Cognitive load.** Working memory is small (Sweller, 1988). | One new idea per lesson, short steps, and dim everything that isn't relevant. | Focus mode, `focus` field |
| **Dual coding and multimedia.** Words plus visuals beat either alone (Paivio; Mayer). | The scope and spectrum show the sound while the learner hears it. Say what to watch. | Scope in the coach |
| **Self-explanation.** Explaining in your own words deepens understanding (Chi et al., 1994). | End with "explain it", then compare against a model answer and self-rate. | `reflect` step |
| **Desirable difficulty.** Some struggle helps learning, but frustration doesn't (Bjork). | Feedback in ear challenges fades in: first a count, then which control, then which direction. A "show me" option arrives after four tries. | Match feedback ladder |
| **Motivation (self-determination theory).** Competence, autonomy and relatedness drive learning. | Give a quick win in the first minute, visible progress, a creative open ending, and real music context. | First step makes sound; closing challenge |
| **Universal Design for Learning.** Offer multiple ways to see, hear and do (CAST). | Use text, sound and visuals together, keep language plain, never rely on colour alone, and support keyboard and screen readers. | Writing rules below |

## Anatomy of a lesson

```
objective   "By the end you can …"   (one sentence, a skill, not a topic)
start       { reset: true, values: {...} }   known starting point (the learner's own patch is saved)
steps
  1  hook      info/listen  - "Here's where we're going" (autoplay the target, 10 seconds)
  2  first win do          - make a sound within the first minute
  3  predict   predict     - the key idea: "What happens if you turn CUTOFF down?"
  4  build     do / patch  - 2–4 guided moves, each with a principle
  5  compare   listen      - A/B: hear the difference the idea makes
  6  recall    quiz        - one retrieval question mid-lesson
  7  ear       match       - recreate a variation by ear (1–3 controls)
  8  you do    challenge   - an open brief with a checklist, no exact numbers
  9  explain   reflect     - "In one sentence, what does … do?"
review      3–5 multiple-choice questions for spaced review
```

Not every lesson needs every part. Every lesson **must** have:
- an objective
- a first win
- at least one `predict` or `listen`
- at least one `quiz`
- a `challenge` or `match`
- a closing `reflect` or experiment step
- 3–5 `review` questions

## The curriculum for each instrument

Organise lessons by `path`, and use `order` to set the recommended sequence:
1. **foundations:** one section of the instrument per lesson, in signal-flow order (source → mixer → filter → amp → modulation → sequencer). Start each lesson from a reset patch.
2. **sound-design:** classic sounds such as kick, bass, pad, lead, FX, and the instrument's signature sounds. Each one names the 2–3 controls that define it.
3. **ear-training:** pure `match` lessons, getting harder:
   - one control, wide differences;
   - one control, fine differences;
   - two controls;
   - three controls, mixing earlier sections (interleaving).
4. **sequencing:** the instrument's sequencer, rhythm, polyrhythm, patterns and songs (Elektrons: parameter locks, conditions, chains, songs).
5. **performance:** playing live: tweaks, fills, mutes, transitions.
6. **studio:** using it with the other instruments: clock sync, mixing, a part in a full track.

Aim for 14–20 lessons per instrument, with at least 4 in ear-training. Use `prerequisites` so the recommended path makes sense.

## Writing rules

- **Instruction:** at most 25 words, imperative, using the panel's own label exactly ("Turn CUTOFF to about 800 Hz"). One move per step.
- **Principle:** at most 20 words, true on *any* synth, and stated as cause and effect ("Lower cutoff removes upper harmonics, so the sound gets darker").
- **Explanation:** 1–3 sentences on the why, the physics or the musical use. Define jargon the first time it appears ("harmonics, the quieter higher pitches that give a sound its colour").
- **Describing sound:** use paired descriptors (bright/dark, thick/thin, punchy/soft, short/long) and real musical contexts ("the squelch in acid house"). Don't quote copyrighted lyrics or melodies.
- **Predict and quiz options:** 3–4 options, all plausible, with exactly one correct. `explain` says why the right answer is right *and* why the tempting wrong one is wrong.
- **Match targets:** must be clearly distinguishable by ear. Differ by at least about 20% of knob travel per control at the easy levels and about 8% at the hard ones. Set every other control from the target, which `match` does automatically. Keep `controls` to 1–3.
- **Challenges:** describe a musical goal, not numbers ("Make the kick short enough that it doesn't boom between beats"). Write checklist checks with generous tolerances.
- **Hints:** 2–3 per hard step, from vague to specific ("Think about how long it rings" → "Look at VCA DECAY" → "Try below 300 ms").
- **Accessibility:** never say "the green one" or "the red light". Name the control, and keep text plain enough for a 12-year-old.
- **Studio steps:** when a step needs another instrument, set `instance`. Check cables between instruments with `check: s => s.studioCables.some(...)`.

## Feedback model

- `do`/`patch` steps auto-advance about 0.75 s after they're satisfied. `predict` steps wait 2.2 s so the learner can read the reveal.
- `quiz`, `listen`, `reflect`, `match` and `challenge` steps never auto-advance; the learner presses Next.
- The *first* answer to a quiz or prediction counts for review scheduling, so recall stays honest.
- Ear challenges grade each control against a tolerance in knob travel (default 8%).

## Example (DFAM, foundations)

```ts
{
  id: 'dfam-f3-filter', device: 'dfam', path: 'foundations', order: 3, difficulty: 'beginner',
  name: 'The filter: brightness', objective: 'Use CUTOFF and RESONANCE to make a sound darker, brighter or ringing.',
  start: { reset: true, values: { vco1_wave: 0, run_stop: false } },
  steps: [
    { kind: 'do', control: 'vca_decay', targetValue: 800, instruction: 'Set VCA DECAY to about 800 ms and press TRIGGER a few times.',
      principle: 'A longer amplitude envelope gives you time to hear the tone.' },
    { kind: 'predict', control: 'vcf_cutoff', targetValue: 150, instruction: 'Turn CUTOFF down to about 150 Hz and trigger.',
      predict: { question: 'What will turning CUTOFF down do?', options: ['Lower the pitch', 'Make it darker and duller', 'Make it quieter only'], answer: 1,
        explain: 'The pitch stays the same: the filter removes the upper harmonics, so the tone gets darker. It also gets a bit quieter because energy is removed, but that is a side effect.' },
      principle: 'A low-pass filter removes harmonics above the cutoff; pitch is set by the oscillator, not the filter.' },
    { kind: 'listen', instruction: 'Compare the full and the filtered sound. Watch the spectrum.',
      listen: { a: { vcf_cutoff: 8000 }, b: { vcf_cutoff: 150 }, labels: ['Open', 'Closed'] } },
    { kind: 'quiz', instruction: 'Quick check.',
      quiz: { question: 'A square wave through a filter with cutoff below its 2nd harmonic sounds…', options: ['Like a sine', 'Brighter', 'An octave higher'], answer: 0,
        explain: 'With only the fundamental left, any wave becomes nearly a sine.' } },
    { kind: 'match', instruction: 'Recreate the target by ear.',
      match: { target: { vcf_cutoff: 600, vcf_resonance: 70 }, controls: ['vcf_cutoff', 'vcf_resonance'] },
      hints: ['It rings - which knob adds ringing?', 'RESONANCE is high; CUTOFF is in the low-mids.'] },
    { kind: 'reflect', instruction: 'Explain it.',
      reflect: { prompt: 'In one sentence: what does RESONANCE add?', model: 'It boosts a narrow band around the cutoff frequency, so the filter rings at that pitch.' } },
  ],
  review: [ { question: 'Turning CUTOFF down on a low-pass filter…', options: ['Removes high harmonics', 'Lowers the pitch', 'Adds distortion'], answer: 0 } ],
}
```

## Lesson API v3: presses, notes, scope, help (framework)

These fields are additive; every existing lesson keeps working.

| Field | What it does |
|---|---|
| `kind: 'do', control: '<momentary button>'` | Completes when the learner presses it (TRIGGER, ADVANCE, TAP). No `targetValue` needed. |
| `presses: n` | Presses needed (default 1). Also makes a toggle button count presses ("press RUN / STOP twice"). |
| `event: '<layout event>'` | A `do` step about a button with no control of its own (pads, trig keys, transport keys). The button is spotlit. |
| `play: { count }` / `play: { notes, anyOctave }` | Complete after `count` notes, or the exact notes in order (MIDI numbers), from the on-screen keys, computer keyboard or MIDI. |
| `scope: 'spectrum' \| 'wave' \| 'both'` | The coach's scope switches to this view when the step begins. Use `spectrum` for EQ and filter steps. |
| `solution.presses / notes / studioCables / transport / instance` | One way to finish the step: "show me one way" and the lesson runner use it. |

Checks receive `s.events` (presses this step, by control id and event name), `s.notesPlayed`
(notes this step, oldest first) and `s.eventsByInstance`. They are always set while a lesson
runs, but optional in the type: write `(s.events?.advance ?? 0) >= 3`. `s.engine` is now the
instrument's live engine state (current step, LEDs), and checks re-run as it changes, so
"press ADVANCE until step 8 is lit" can be `check: s => s.engine.step === 7`. Presses made
before a prediction is committed don't count. `npm run validate` calls every check on a step
that has just begun (nothing pressed or played: `events: {}`, `notesPlayed: []`), and a check
that throws there is an error.

**Feedback and help.** Hints are a ladder (vague → specific); after the last hint the coach
offers "Show me": it turns the knob to the target while the instrument plays, holds it so the
learner hears it, then puts it back - the learner makes the move (worked example → faded
guidance). For cables it draws a ghost cable; for momentary buttons it presses once; for a
challenge with a `solution` it applies that solution and leaves it. Using it is reported
honestly in the end-of-lesson summary. Ear challenges have an A/B toggle (target / yours on
the same phrase) and feedback that fades in: a count, then which control, then direction and
"a little / a lot", then "Show me the answer" after four tries.

**End of lesson.** The summary lists first-guess predictions, quick checks, ear matches,
challenges, self-ratings and help used, and says how many questions come back in Daily
Review and when (missed ones first). Predictions now join the review queue (`p` items) as
well as quiz steps and `review` questions.

## Lesson API v3 – studio state

Studio lessons (`device: 'studio'`) teach the whole studio: the mix, the master, the song and
the bounce. These fields are additive; every earlier lesson keeps working. The Producer path
(`path: 'producer'`, ids `studio-producer-…`, `docs/research/producer-path/curriculum.md`) is
built on them: all 15 lessons, L1 First beat to L15 the Capstone. They live in
`lib/studio/producerLessons.ts` (which also takes in `producerElektronLessons.ts`) and load on
demand (`lib/studio/producerIndex.ts` lists their ids up front, so Daily Review keeps their
questions while they load).

### A whole studio to start from

`start.studio` (a `LessonStudioStart`) describes a complete studio, a curriculum "checkpoint":

| Field | What it sets |
|---|---|
| `rack` | instruments in order: `{ id, device, label?, values?, patches?, data?, keep? }`. Each starts from its defaults plus `values`; `keep` keeps an instrument's current settings |
| `routes`, `sync`, `cables` | routing (`'master'` or `'<mixer>:<input>'`), MIDI-style sync, cables between instruments |
| `bpm`, `swing` | tempo, and studio swing 0..0.75 of a 16th (0.08 = 54 %) |
| `mixer` | studio mixer strips, the returns and the master section (anything left out is at its default) |
| `arrangement` | the song: `{ enabled, loop, sections: [{ name, bars, parts: { [instance]: { pattern?, snapshot?, muted? } } }] }` |
| `focus` | the instrument shown first, and the default `instance` of steps |
| `ownStudio` | the lesson also works in the learner's own studio: the coach offers "Use my own studio instead (…this sentence…)" |
| `alignClocked` | default true: ▶ parks clock-stepped DFAMs (clocked from the Studio Clock) so step 1 lands on the bar the song starts from, the way a reset input would. The clock lesson sets it false to teach parking by hand |

**Checkpoints never cost the learner their track.** Starting the lesson saves the learner's
studio first (`lessonBackups`, saved in the browser, so it survives a reload). The first
backup is pinned: it is never dropped to make room. The coach says the studio is saved, the
end-of-lesson summary offers "Bring back the studio I had before this lesson", and the Lessons
dialog lists every saved studio. Bringing one back swaps: the studio you have then is saved in
its place. `restoreStudioBackup(id)`, `deleteStudioBackup(id)` and `useOwnStudio()` are the
store actions.

The Producer path has two studios. `lib/studio/producerElektron.ts` builds the learner's own
track, "Low Tide" (L1-L3, L5, L6, L8 and the Capstone, `producerElektronLessons.ts`): the
Studio Clock, an Analog Rytm on Xone:96 channel 1 and an Analog Four on channel 2, both synced,
with Demo 1's sounds (the Rytm kit and the A4 kit PRODUCER) and, from L6, the Sub 37 on
channel 3. Its checkpoints (`CP_00` … `CP_08`, `CP_CAPSTONE`) are written in the instruments'
own data formats: Elektron patterns from `rytmPattern` / `a4Pattern` with trigs numbered like
the trig keys. `lib/studio/producerStudio.ts` builds "Tide Pool" for the studio lessons (L4,
L7, L9-L14): the Studio Clock, a DFAM percussion loop clocked by cable, and the Xone:96, whose
built-in decks play the stems (drums, bass, stabs, pad, perc) and follow the studio clock like
MIDI-synced machines (`CP_MUDDY`, `CP_SPACED`, `CP_ROUGH`, `CP_MIXED`, `songSections()`...).

In the Producer path the app follows the steps: when a step begins, a step with an `instance`
shows that instrument and a step with an `area` shows the studio. On a touch screen the coach
floats over the panel; when a step begins it moves to the corner that hides the least of what
the step highlights (its `focus`), so a trig key or pad the learner must tap is never under it.

### What checks can read

The store adds these to `LessonCheckState` while a lesson runs (all optional in the type):

| Field | Contents |
|---|---|
| `transport.swing` | studio swing, 0..0.75 |
| `mixer` | the studio mixer with defaults: `channels[instance]`, `delay`, `reverb`, `master` |
| `master` | `{ gainDb, limiterOn, ceilingDbTP, glueOn, eqOn }`: the master fader is the gain into the limiter, which is always on at −1 dBTP |
| `meters.master` | `lufsM`, `lufsS`, `lufsI` (null below the gate; `lufsI` holds after Stop), `lufsSMax`, `peakDb` (into the limiter, the last 3 s) and `maxPeakDb`, `truePeakDb` (the last 3 s) and `maxTruePeakDb`, `grDb` (limiter, the last second) and `maxGrDb`, `glueGrDb`, `overs`, `measuredSec`, `fromStart` (measured from bar 1), `steady` (nothing in the mix or the master changed since Play; song automation excluded). Everything "max" and "since" resets when the transport starts |
| `meters.channels` | every mixer-device channel meter by input (`'xone96:1'` … `'xone96:4'`, `'xone96:a'` … `'xone96:d'`, in dBu) and every studio strip (`'strip:<instance>'`, dBFS): `{ peak (last 2 s), now, pk (PK lit in the last 2 s), maxSincePlay, unit }` |
| `bounce` | `{ recording, bouncing, count, last? }`; `last` is the latest finished REC take or Bounce, measured on the master meter: `{ kind, seconds, lufsI, truePeakDb, maxGrDb, stems, fromStart, complete, songSeconds, at }`. `complete` means a bounce reached the end of the song |
| `history` | since the lesson started: `changed(inst, control)`, `wasOn(inst, control)`, `min(…)`, `max(…)`. Name an instance or a device; `'master'`, `'gain'` is the master fader |
| `arranger` | the song position: `{ section, bar, name }` (`section` −1 when stopped) |

Write checks with the helpers in `lib/studio/checks.ts`; they return `undefined` or `NaN`
instead of throwing when an instrument is missing, so a missing part reads as "not done":
`inst`, `val`, `num`, `between`, `cable`, `synced`, `xch` (the Xone channel a device is routed
to), `xv(s, '2', 'LO MID')` (a Xone control by its printed name), `xdb` (an EQ band in dB),
`killKnob(-6)` / `midKnob(-3)` (dB to knob values, for lesson values), `xfilter`, `xHighPassed`,
`xmeter`, `master`, `swingPct`, `songSeconds`, `songBars`, and for the song `sec`, `part`,
`snap` (a value in a section's snapshot), `sectionValue` (what a control is set to while a
section plays: snapshots hold until another one changes them), `sectionFader`, `sectionMuted`.

Meter checks need audio, so they only pass while (or after) the studio plays. The lesson
runtime (`lib/studio/lessonRuntime.ts`, loaded when a studio lesson starts) measures, and the
store re-evaluates the step a few times a second; live checklists refresh on their own.

```ts
{ kind: 'do', instance: 'xone96', readout: ['peaks', 'limiter'],
  instruction: 'Lower the Xone\'s MASTER 1 until the studio master peaks around −6 dBFS and the limiter rests.',
  check: s => { const m = master(s); return !!m && s.transport.playing && between(m.peakDb, -8, -4) && m.grDb < 0.05; },
  solution: { parts: { xone96: { master: 7.5 } }, play: { seconds: 5 } } }
```

### Steps

| Field | What it does |
|---|---|
| `listen.parts` | A/B values on several instruments: `{ a: { [instance or device]: values }, b: … }`. The whole studio plays while you switch sides |
| `listen.master`, `listen.studio` | A/B the master section (`{ gain, glue, eq }`) or studio settings (`{ swing }`) |
| `listen.matchLoudness` | both sides play at the same loudness: each side is measured on the master meter (momentary LUFS) and the louder one is turned down after the meter, so "louder" never wins by default. The coach shows the gain it applied |
| `listen.from` | start the A/B at a song section, so both sides play the same part |
| `listen.patterns` | A/B Elektron pattern settings: `{ a: { [instance or device]: { swing } }, b: … }`. While a side plays, every pattern of that Analog Rytm or Analog Four plays with that SWING (so does the song); the learner's patterns don't change |
| `match.pattern` | match an Elektron pattern setting by ear on the step's instrument, next to or instead of `controls`: `{ target: { swing: 64 }, start?: { swing: 50 } }`. `start` is set when the step begins; A · Target plays the target SWING, Check compares the active pattern's SWING in knob travel (50..80 %, so `tolerance: 0.1` is ±3 %) |
| `readout` | live numbers under the step: `'loudness'`, `'peaks'`, `'limiter'`, `'channels'` |
| `area` | where the step happens (`'mixer'`, `'master'`, `'arranger'`, `'transport'`, `'rack'`): the coach offers to take the learner there. A step with an `instance` gets "Open <instrument>" |
| `capture` | arranger snapshots of chosen controls: `{ instance, controls, label? }` gives one button per section that stores just those controls (merged into the section's snapshot), so a section can switch what plays without freezing the rest of the mix |

### Solutions ("show me one way" and the lesson runner)

`solution.parts` (other instruments' values), `channels` (studio strips), `master`, `studio`
(`bpm`, `swing`, `routes`, `sync`), `arrangement`, `capture` (`[{ section, instance, controls?,
values? }]`), `studioCables`, `pressUntilDone` (press a button until the step's check passes:
parking a sequencer), and the timed ones: `play` (`{ seconds, fromStart, song, from }`),
`bounce` (`{ stems }`) and `record` (`{ seconds, stems }`). "Show me one way" sweeps the knobs
and sets the studio; `node scripts/lesson-runner.cjs <url> studio` applies the solution and,
for timed solutions, plays, bounces or records for real and waits for the meters, as a learner
would. `npm run validate` checks every start studio against the real instruments (devices,
values, routes, cables, jacks) and every step's instance, controls, A/B values, match targets
and solutions, and runs every check on an empty studio and on the start studio.

Routes and the song work in **device lessons too** (the runner and "show me" apply them
wherever a lesson runs): `studio.routes: { 'analog-rytm': 'xone96:studio_1', dfam: 'master' }`
names the instrument and the mixer by instance or device, and `arrangement` replaces the song
(`sections`, parts by instance or device) or only switches it (`{ enabled: true }`).

**Elektron sequencers** (Analog Rytm, Analog Four) keep their patterns as device data
(`docs/ELEKTRON_SEQUENCER.md`), so solutions edit that data instead of replacing it - they then
also work in the learner's own studio:

| Field | What it does |
|---|---|
| `patterns` | pattern settings on an instrument's active pattern: `{ 'analog-rytm': { swing: 56 }, 'analog-four': { length: 64 } }`. A longer LENGTH copies the existing pages into the new ones, like the SCALE menu |
| `sequence` | trig edits, in order: `[{ instance?, pattern?, track, clear?, trigs: { 1: {}, 5: { vel: 45 }, 13: { cond: '1:2' }, 3: null } }]`. Tracks are indices (Rytm BD 0 … CB 11, FX 12; Analog Four T1 0 … T4 3); **trigs are numbered 1..64 like the trig keys** and the lesson text. A trig's fields (`note`, `vel`, `len` as a NOTE_LENGTHS index, `micro`, `cond`, `locks`, `trigless`, `accent`, `slide`, `pslide`, `retrig`) merge into what is there; `null` removes it. New Analog Four trigs take the track's NOTE, VEL and LEN, as the hardware stamps them |

The check helpers for them number trigs the same way: `proj(s, dev)`, `pat(s, dev, pattern?)`,
`trigs(s, dev, track)` (trig numbers holding note trigs), `hasTrigs(s, dev, track, [1, 5, 9, 13])`,
`trig(s, dev, track, n)` (the step), `noteOf`, `velOf`, `lenOf` (in steps), `lockedTrigs(s, dev,
track, 'flt1_frq')`, `conditions(s, dev)`, `lockCount`, `busyTracks`, `pswing` and `plen` (the
pattern's SWING and LENGTH), `barOf(n)`, and for pitch `pc`, `A_MINOR`, `A_MINOR_PENTA`, `oneKey`.

```ts
{ kind: 'predict', instance: 'analog-rytm', focus: ['key:func', 'key:bank:G'],
  instruction: 'Set the pattern\'s SWING to 58 %: [FUNC] + [BANK G], then [UP].',
  check: s => between(pswing(s, 'analog-rytm'), 55, 62),
  solution: { patterns: { 'analog-rytm': { swing: 58 } } }, … }
{ kind: 'match', instance: 'analog-rytm',
  instruction: 'Recreate the target groove by ear: set the SWING.',
  match: { target: {}, controls: [], pattern: { target: { swing: 64 }, start: { swing: 50 } }, tolerance: 0.1 } }
```

### Demo recordings: `info.play` and `listen.demo`

A hook lets the learner hear where the lesson is going before they build it. In the Producer path
that is a **recording** of a demo track, never the demo itself: loading a demo in the middle of a
lesson would replace the learner's studio (autosave would store the demo over their work, the
checks would read the demo, undo would mix the two). The recordings are rendered ahead of time
by the app itself (`scripts/render-demos.cjs`, see `docs/DEMOS.md`) and listed in
`public/demos/manifest.json` by demo, excerpt (its bars) and variation.

| Field | What it does |
|---|---|
| `info: { play: { demo, excerpt, variation? } }` | An `info` step's ▶ Hear it plays this recording instead of the instrument's audition; a list plays in turn. `variation` defaults to `'as-made'`, the demo itself; `excerpt: 'full'` is the whole song |
| `listen.demo: { demo, excerpt, a, b }` | The A/B plays two variations of one excerpt, looping its bars in step: pressing the other side switches on the same phrase, the lit side again stops. Both sides always play at the same loudness, so `matchLoudness` isn't needed; `listen.a` and `b` stay `{}`, and `labels` and `question` work as in any listen step. Once the question is answered, the coach says what each side was |

The player (`lib/studio/demoAudio.ts`) fetches and decodes a recording on its first press and
keeps it. It plays past the studio master (the demos are mastered already), trimmed to about the
loudness the learner's studio has been playing at (its master meter; −20 LUFS before it has
played) and never above −1 dBTP. While it plays, the studio is held back from the speakers but
keeps running: its meters, recordings and lesson checks see it as before. Leaving the step,
finishing or stopping the lesson, the studio's ▶ or ■, and a second press all stop it. Nothing in
the store, the hub or the studio changes.

```ts
{ kind: 'info', instance: 'analog-rytm',
  instruction: 'This path ends with a finished track of your own, like this one. Press ▶ Hear it and listen for the kick on every beat.',
  info: { play: { demo: 'low-tide-lights', excerpt: 'drop-17-20', variation: 'drums' } } }
{ kind: 'listen', instruction: 'Same parts, same levels. One mix is clear, one is muddy. Play A, then B, and switch a few times.',
  listen: { a: {}, b: {}, labels: ['Mix A', 'Mix B'],
    demo: { demo: 'low-tide-lights', excerpt: 'drop-17-20', a: 'as-made', b: 'muddy' },
    question: { question: 'What makes B muddy?', options: […], answer: 0, explain: '…' } } }
```

`npm run validate` checks that every reference is in the manifest with its file in
`public/demos`, that both sides of an A/B loop the same bars, that every rendered recording is
played by some lesson, and that `public/demos` stays within its 10 MB. The lesson runner plays
every recording a lesson uses (both sides of an A/B) and fails a step whose recording is
missing, silent or doesn't stop.

In the Producer path the hooks of L1 (the demo's drums), L3 (its kick and bass), L4 (Three
Clocks), L5, L6, L8, L12 and L15 (all three demos in turn) are `info.play`, and L2 (straight
against swung, with ghost notes), L7 (as made against muddy: every high-pass off, the low mids
up), L9 (dry against as
made), L11 (everything against the drums alone), L13 (as made against the drums 6 dB down) and
L14 (its master against the same mix pushed 9 dB into the limiter) are `listen.demo`.
