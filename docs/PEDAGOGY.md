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
