# Synth Studio: notes for Claude

Synth Studio is an iPad-first web app for learning synths. It runs digital twins of the Moog DFAM, Mother-32, Subharmonicon and Sub 37, the Elektron Analog Four MKII and Analog Rytm MKII, and the Allen & Heath Xone:96, plus a Studio Clock and your-own-gear devices. It is built on Next.js 14, TypeScript, Web Audio worklets and Zustand, and deploys on Vercel.

Read `docs/STATUS.md` first: it holds the history, the merge gate and the open items. Then read the doc for the area you are touching:
- `docs/ADDING_A_DEVICE.md`
- `docs/DSP.md`
- `docs/ELEKTRON_SEQUENCER.md`
- `docs/AUDIO_QA.md`
- `docs/PEDAGOGY.md`
- `devices/<id>/REFERENCE.md` and `devices/<id>/REVIEW.md`

## Ground rules from the owner
- **Never break working software.** Before you push, run the checks for the area you changed (see below).
- **Who it's for:** learners and producers. It must be low latency and of professional quality.
- **Branch:** work on `claude/dfam-documentation-review-iYhxN` (PR #54) unless told otherwise. Don't open PRs unless asked.
- **Copyright:** follow `docs/research/COPYRIGHT-RULES.md`.
  - Manuals are never committed; keep them in scratch space outside the repo.
  - Write facts in our own words. A quote is 25 words or fewer and cites a page.
  - Presets carry our own names.
- **Saved settings:** if you change a device's defaults or ids, add an entry to `lib/studio/upgrades.ts` so users' saved settings carry over.
- **Use usage sparingly:**
  - Don't launch sub-agents or parallel workers unless asked.
  - Run the targeted tests, not the full suite, unless you're at a milestone.
  - Batch pushes, because every push starts a Vercel build and builds are rate-limited.
- **Shared machine:** never kill processes by name. To stop the server, use `fuser -k 3100/tcp`.
- **GitHub 403 from the proxy:** this is a policy denial. Report it; don't work around it.

## Build and check
```sh
npm install
npx tsc --noEmit -p . && npm run lint && npm run validate
flock /tmp/synth-studio-build.lock env NODE_OPTIONS=--max-old-space-size=1536 npm run build
npx next start -p 3100 &   # stop with: fuser -k 3100/tcp
```
Then run only the checks that apply:
- **Core e2e:** `node scripts/e2e/run.cjs http://localhost:3100`. Add `--full` only at milestones.
- **Lessons for one device:** `node scripts/lesson-runner.cjs http://localhost:3100 <device>`. It must report 0 failed.
- **Audio QA for one device:** `node scripts/audio-qa.cjs http://localhost:3100 <device> --target -18`. It must exit 0. See `docs/AUDIO_QA.md`.
- **Separate outputs:**
  - `node scripts/e2e/outputs.cjs http://localhost:3100` (the studio side)
  - `node scripts/e2e/outputs-device.cjs http://localhost:3100 [device] [outputId] [pattern]` (a real instrument's output; the default is the Rytm's BD. For the A4 use `analog-four t1 A02`: the pattern holds the groove, since the demo song's intro has no TRACK 1)
- **Sequencer:** `npm run test:seq`.

Devices: `dfam`, `mother32`, `subharmonicon`, `sub37`, `analog-four`, `analog-rytm`, `xone96`.

On iPad, test over HTTPS on the Vercel preview. Plain `http://` has no AudioWorklet, so there is no sound.

## How separate outputs work
- A device lists its outputs in `DeviceModule.studio.outputs`, and its engine implements `SynthEngine.connectOutput(id, dest | null)`.
- Turning an output on gives it its own mixer channel, named `<instance>/<id>`. See `setOutputUsed` in `store/studio.ts` and `lib/studio/hub.ts`.
- The Rytm is the reference implementation:
  - `devices/analog-rytm/engine.ts`
  - `public/worklets/analog-rytm-processors.js`, which carries a per-voice `indiv` flag
- The A4 does it in the graph: `connectOutput` in `devices/analog-four/engine.ts` moves a voice's dry output from `a4-fx` to a gain feeding the studio channel
