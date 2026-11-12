# Middle C

A piano teacher that runs on an iPad on the music stand. It lives at `/piano` in this app and is self contained, so it can be moved to its own project later without untangling anything.

## What it does

- **Follows your playing.** Over MIDI it sees every key, how hard it was struck, when it was released, and the pedals. Without MIDI it listens through the microphone.
- **A course in six stages**, 36 short lessons, from finding middle C to Bach, Beethoven and Satie. Tunes are learned by ear and by shape first, and notation is introduced through music you can already play.
- **A practice coach for pieces.** It works the way studies of effective practice describe: hear the phrase, learn the notes with no time pressure, put the hands together early, add a slow beat, speed up after two good passes, and take a trouble spot out to fix it.
- **Drills** for note reading (spaced review), rhythm, playing by ear, and sight reading with fresh material every time.
- **A daily session** sized to the time you have.
- **Hands on the keys.** The top key of the piano means continue and the bottom key means again. With a three pedal unit the middle and left pedals do the same.
- **The method page** in the app sets out each teaching choice and how strong the evidence for it is.

## Connecting a digital piano

Safari on iPad has no MIDI support, and neither does any iPad browser built on it. There are three ways to connect.

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
lib/piano/audio/           sampled piano, metronome, scheduling
lib/piano/input/           MIDI, Bluetooth MIDI, listening, the note bus, hands free control
lib/piano/dsp/             note detection from audio
lib/piano/engine/          the score follower (wait and tempo modes)
lib/piano/learn/           progress store, spaced review, coach, planner, generators
lib/piano/content/         lessons, pieces, the method
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
