# Middle C

A piano teacher that runs on an iPad on the music stand. It lives at `/piano` in this app and is self contained, so it can be moved to its own project later without untangling anything.

## What it does

- **Follows your playing.** Over MIDI it sees every key, how hard it was struck, when it was released, and the pedals. Without MIDI it listens through the microphone.
- **A course in six stages**, 37 short lessons, from finding middle C to Bach, Beethoven and Satie. Tunes are learned by ear and by shape first, and notation is introduced through music you can already play. Reading has a stage of its own. Chords, chord progressions by number, and arpeggios each have lessons of their own.
- **A practice coach for pieces.** The first time you open a piece you play it through, and whatever you already know is skipped, even if your hand started on the wrong C. For the rest it works the way studies of effective practice describe: hear the phrase, learn the notes with no time pressure, put the hands together early, add a slow beat, speed up after two good passes or one clean one, and take a trouble spot out to fix it. Where the music waits, a pause to think is not counted as a mistake. The plan it is following can be seen at any time.
- **Feedback that says what went wrong.** Over MIDI the app knows how far each note fell from the beat and how long each key was held. So it can say that the slips were in measure 3, that the quick notes ran ahead, that you came in early after the long notes, or that long notes were let go early. It says so after a run that passed as well, tells a right note in the wrong octave from a wrong note, and sends you back to the count if you start before it is over.
- **Hear yourself.** After a run, Hear yours plays your own take back, key for key, with the cursor following. The play through that finishes a piece is kept, with the latest one since, on the Progress page.
- **Exercises** for note reading (spaced review), rhythm, playing by ear, sight reading, scales and arpeggios (judged for evenness), and chords from symbols in any position, with fresh material every time. Each opens once the lesson that prepares it is done, and climbs only as far as the lessons have gone.
- **A daily session** sized to the time you have. The first day ends with a tune, every session ends with a short account of what changed, and when there is time it closes on a piece you already play well. New lessons wait while two pieces are still being learned, so the course moves as fast as the playing does, and the next lesson can always be taken early.
- **Demonstrations on your own piano.** When the piano can receive notes, the app plays on the piano itself and as firmly as you tend to play, so a demonstration is as loud as your own playing.
- **Hands on the keys.** The top key of the piano means continue and the bottom key means again. With a three pedal unit the middle and left pedals do the same.
- **The method page** in the app sets out each teaching choice and how strong the evidence for it is.

## The iPad app

`ios/` holds a native iPad app that carries the piano teacher inside it. It needs no connection, reads the piano over the iPad's own MIDI by USB cable or Bluetooth, keeps progress in a file of its own with a dated copy in the Files app, and holds the whole screen awake on the music stand. This is the way to use Middle C on an iPad. `ios/README.md` has the steps for putting it on an iPad from a Mac.

The web app does not know or care which of the two it is running in, with one exception: `lib/piano/native/bridge.ts` asks the shell for the few things only the shell can do.

## Connecting a digital piano in a browser

Safari on iPad has no MIDI support, and neither does any iPad browser built on it. Outside the iPad app there are three ways to connect.

| Route | What you need | Result |
| --- | --- | --- |
| MIDI in a browser that adds it | iPad, the piano's USB TO HOST socket or Bluetooth MIDI, and a browser app such as MIDIWeb Browser | Exact. The recommended setup on iPad. |
| Bluetooth MIDI directly | A browser with Web Bluetooth, such as Bluefy on iPad or Chrome on a computer or Android | Exact, no cable. |
| Listening | Any browser, including Safari and the home screen app | Works for single notes and simple chords at a steady pace. Cannot hear note length or strength. |

On a computer, Chrome and Edge read MIDI directly.

For a Yamaha P-525: connect its USB TO HOST socket (USB C) to the iPad, or pair it over Bluetooth MIDI. With a cable the iPad's sound also plays through the piano's speakers. In Settings, **Play demonstrations on the piano** sends the app's examples to the piano over MIDI so they are heard in its own sound.

### Listening

Listening takes whatever sound input the iPad is using. That is its own microphone, or the piano itself when a USB cable is connected, since the P-525 also sends its sound down the cable. Settings shows which one is in use.

The app's own sound reaches that input as well. Demonstrations are ignored while they play. The metronome click is pitched a quarter tone above D and A, between two keys where no string sounds, so the detector can tell a click from a key being struck and still hear a note that lands just after it. Because a microphone still mishears the odd note, a pass judged by ear is given a little more room than one judged over MIDI.

Progress is stored in the browser where the app is used. Settings has **Save a backup** and **Restore from a backup** for moving between browsers or devices.

## Installing on the home screen

Open `/piano` in Safari, tap Share, then **Add to Home Screen**. It then opens full screen and works without a connection after the first visit. The home screen app uses listening, since it runs on Safari.

## Code map

```
app/piano/                 route, theme, page shell
components/piano/          screens and the playing surface
lib/piano/music/           pitches, scales, chords, the score model and text notation
lib/piano/audio/           sampled piano, metronome, scheduling, playing back a take
lib/piano/input/           MIDI, Bluetooth MIDI, listening, the note bus, hands free control
lib/piano/dsp/             note detection from audio
lib/piano/engine/          the score follower (wait and tempo modes), which also records each run
lib/piano/learn/           progress store, spaced review, coach, planner, generators, milestones
lib/piano/content/         lessons, pieces, the method
lib/piano/native/          the few calls into the iPad app
ios/                       the iPad app: web view shell, MIDI, progress file
public/piano/              piano samples, icons, manifest, audio worklet
public/piano-sw.js         offline cache
```

Music is authored in a compact text notation, for example `E4q:3 D4q C4h | C4+E4+G4w:135`, described at the top of `lib/piano/music/score.ts`. Every piece and lesson is checked by tests: measures must add up, hands must not cross, and every reference must resolve.

## Tests

```bash
npm test
```

runs the unit tests. The note detector also has an evaluation against real grand piano recordings, which are not stored in the repository. See the top of `lib/piano/dsp/tracker.eval.test.ts` for how to run it.

Adding `?mcdebug=1` to the address loads development tools, including a robot pianist that plays whatever the app is waiting for, over MIDI or as sound for the listening input.

## Credits

Piano samples: Salamander Grand Piano by Alexander Holm, Creative Commons Attribution 3.0. Notation: VexFlow. Review scheduling: ts-fsrs. All pieces are traditional, in the public domain, or written for the course.
