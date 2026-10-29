import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ControlValue, DeviceSpec, Lesson, LessonCheckState, LessonStep, MultipleChoice, PatchConnection } from '@/types';
import type { RackSlot, StudioCable } from '@/devices/types';
import { isStepSatisfied, isValueOnTarget, valueToNorm, defaultOf } from '@/lib/controls/mapping';
import { transport } from '@/lib/audio/transport';
import { STORE_VERSION, upgradeCompletedLessons, upgradeDevices } from '@/lib/studio/upgrades';
import type { ChannelDoc, DelayDoc, MasterDoc, MixerDoc, ReverbDoc } from '@/lib/studio/mixerDoc';
import { channelOf, delayOf, reverbOf, masterOf } from '@/lib/studio/mixerDoc';
import { throttledLocalStorage } from '@/lib/studio/persistStorage';
import { STUDIO_LESSONS } from '@/lib/studio/lessons';
import { getLessonLive, lessonStudioHooks } from '@/lib/studio/lessonLive';
import { isProducerLessonId, producerLessonsNow, setProducerRegister } from '@/lib/studio/producerIndex';
import { buildLessonStudio, newBackupId, pushBackup, sameStudio, type LessonBackup } from '@/lib/studio/lessonStudio';
import { LIMITER_CEILING_DB } from '@/lib/audio/context';

// ============================================================================
// Synth Studio store
//
//  devices   per *instance* state (knobs, internal patch cables, structured data).
//            The first instance of a device uses the device id as its instance id,
//            so single-instrument use and older saves map 1:1.
//  studio    the rack, cables between instruments, audio routing, sync, tempo,
//            and the song arrangement.
//  progress  completed lessons and the spaced-review queue.
//  lesson    the running lesson session (not persisted).
// ============================================================================

export interface InstanceState {
  controlValues: Record<string, ControlValue>;
  patchConnections: PatchConnection[];
  data?: unknown;
}

export interface SectionPart {
  /** Pattern id for pattern-based instruments (Elektron "A01") */
  pattern?: string;
  /** Knob snapshot for instruments without pattern memory */
  snapshot?: Record<string, ControlValue>;
  muted?: boolean;
}

export interface ArrangementSection {
  id: string;
  name: string;
  bars: number;
  color?: string;
  parts: Record<string, SectionPart>;
}

export interface Arrangement {
  enabled: boolean;
  loop: boolean;
  sections: ArrangementSection[];
}

export interface StudioDoc {
  rack: RackSlot[];
  cables: StudioCable[];
  /** instance -> 'master' | '<mixerInstance>:<inputId>' */
  routes: Record<string, string>;
  /** instance -> follows the studio transport (MIDI-clock style) */
  sync: Record<string, boolean>;
  bpm: number;
  swing: number;
  arrangement: Arrangement;
  /** instance -> powered off (engine freed to save CPU; settings kept) */
  off?: Record<string, boolean>;
  /** Mixer: channel strips, returns, master section. Optional on disk: lib/studio/mixerDoc.ts fills defaults. */
  mixer?: MixerDoc;
  /** Metronome click and 1-bar count-in (a working preference: not undoable) */
  metronome?: { click?: boolean; countIn?: boolean };
}

export interface ReviewItem {
  /** Leitner box 0..5 - higher = known better = longer interval */
  box: number;
  due: number;
  last: number;
  right: number;
  wrong: number;
  /** Where it came from, for display */
  lesson: string;
  /** Short fingerprint of the question text: a rebuilt lesson with a different question at this index starts the box again */
  fp?: string;
  /** Device of the lesson, so an item can be recognised as orphaned once that device's lessons are known */
  device?: string;
}

export interface StepSession {
  /** predict / listen-question / quiz: chosen option */
  answer?: number;
  /** match: number of Check presses and the last result */
  attempts?: number;
  match?: { score: number; off: { id: string; dir: 'higher' | 'lower' | 'different'; far?: boolean }[] };
  /** reflect: self-rating once the model answer was shown */
  rating?: 'got-it' | 'partly' | 'not-yet';
  revealed?: boolean;
  hints?: number;
  /** UI presses during the step: instance -> control id / event name -> count */
  events?: Record<string, Record<string, number>>;
  /** Notes played during the step: instance -> MIDI notes, oldest first */
  notes?: Record<string, number[]>;
  /** "Show me" was used on this step (the summary reports it honestly) */
  shown?: boolean;
  /** The step was completed at least once (the end-of-lesson summary) */
  done?: boolean;
}

/** A "show me" demonstration in progress: the coach is moving a control (or showing a cable) */
export interface LessonDemo {
  instance: string;
  control?: string;
  patch?: { from: string; to: string };
}

interface LessonSessionState {
  currentLesson?: Lesson;
  /** Instance the lesson runs on */
  lessonInstance?: string;
  currentStep: number;
  isTeachingMode: boolean;
  lessonFinished: boolean;
  stepSatisfied: boolean;
  session: Record<number, StepSession>;
  /** The learner's own patch from before the lesson, so it can be restored */
  lessonSnapshot?: { instance: string; state: InstanceState };
  /** Spotlight: dim everything except what the step is about */
  focusMode: boolean;
  /** "Show me" demonstration in progress (auto-advance waits until it ends) */
  lessonDemo: LessonDemo | null;
  /**
   * A studio lesson that started from its own studio (Lesson.start.studio): the backup of
   * the learner's studio taken at the start, and whether they chose to use their own studio
   */
  lessonStudio?: { lesson: string; backupId?: string; own: boolean };
}

export type { LessonBackup };

interface StudioStoreState extends LessonSessionState {
  /** Focused instance (the big panel) */
  currentDevice: string;
  devices: Record<string, InstanceState>;
  studio: StudioDoc;
  completedLessons: string[];
  review: Record<string, ReviewItem>;
  /** The learner's studios saved before studio lessons replaced them (newest first; saved in the browser) */
  lessonBackups: LessonBackup[];
}

interface StudioStore extends StudioStoreState {
  // ---- focus / rack ---------------------------------------------------------
  setCurrentDevice: (instanceOrDevice: string) => void;
  registerDevice: (spec: DeviceSpec) => void;
  addToRack: (device: string, opts?: { duplicate?: boolean; label?: string; focus?: boolean }) => string;
  /** Swap one instrument for another (single-instrument use, like the original app). Returns the new instance id. */
  replaceInRack: (instance: string, device: string) => string;
  removeFromRack: (instance: string) => void;
  moveInRack: (instance: string, delta: number) => void;
  renameInstance: (instance: string, label: string) => void;
  deviceOf: (instance: string) => string;

  // ---- per-instance state ---------------------------------------------------
  setControlValue: (instance: string, control: string, value: ControlValue) => void;
  setControlValues: (instance: string, values: Record<string, ControlValue>) => void;
  getControlValue: (instance: string, control: string) => ControlValue | undefined;
  resetControlsToSpec: (instance: string, defaults: Record<string, ControlValue>) => void;
  loadPreset: (instance: string, values: Record<string, ControlValue>, patches?: PatchConnection[]) => void;
  setDeviceData: (instance: string, data: unknown) => void;
  updateDeviceData: (instance: string, fn: (d: unknown) => unknown) => void;

  addPatchConnection: (instance: string, from: string, to: string, color?: string) => void;
  removePatchConnection: (instance: string, from: string, to: string) => void;
  clearPatchConnections: (instance: string) => void;

  // ---- studio ---------------------------------------------------------------
  addStudioCable: (cable: StudioCable) => void;
  removeStudioCable: (cable: StudioCable) => void;
  clearStudioCables: (instance?: string) => void;
  setRoute: (instance: string, route: string) => void;
  setSync: (instance: string, on: boolean) => void;
  setPowered: (instance: string, on: boolean) => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setArrangement: (fn: (a: Arrangement) => Arrangement) => void;
  /** Mixer channel of an instance (fader dB, pan, mute, solo, sends) */
  setChannel: (instance: string, patch: Partial<ChannelDoc>) => void;
  setReturn: (bus: 'delay' | 'reverb', patch: Partial<DelayDoc> | Partial<ReverbDoc>) => void;
  setMasterSection: (patch: { gain?: number; eq?: Partial<MasterDoc['eq']>; glue?: Partial<MasterDoc['glue']> }) => void;
  setMixer: (fn: (m: MixerDoc) => MixerDoc) => void;
  setMetronome: (patch: { click?: boolean; countIn?: boolean }) => void;
  loadProject: (p: { devices: Record<string, InstanceState>; studio: StudioDoc; currentDevice?: string }) => void;
  newProject: () => void;

  // ---- lessons --------------------------------------------------------------
  startLesson: (lesson: Lesson, instance?: string) => void;
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetLesson: () => void;
  completeLesson: () => void;
  restoreLessonSnapshot: () => void;
  isStepComplete: () => boolean;
  answerStep: (answer: number) => void;
  checkMatch: () => void;
  rateReflection: (rating: 'got-it' | 'partly' | 'not-yet') => void;
  revealStep: () => void;
  showHint: () => void;
  setFocusMode: (on: boolean) => void;
  reevaluate: () => void;
  /** A press on the panel (momentary button, pad, trig key, transport key): control ids and/or event names */
  lessonPress: (instance: string, ids: string[]) => void;
  /** A note played on an instrument (on-screen keys, computer keyboard, MIDI) */
  lessonNote: (instance: string, note: number) => void;
  /** Start or end a "show me" demonstration */
  setLessonDemo: (demo: LessonDemo | null) => void;
  /** Mark the current step as shown by the coach (it counts as help in the summary) */
  markStepShown: () => void;
  /** Check state of the current step's instrument (coach, lesson runner) */
  lessonCheckState: () => LessonCheckState | null;
  /**
   * Bring back a studio saved before a lesson. The studio you have now is saved in its
   * place first (`keepCurrent`, default true), so restoring never loses work.
   */
  restoreStudioBackup: (id: string, opts?: { keepCurrent?: boolean }) => void;
  deleteStudioBackup: (id: string) => void;
  /** During a lesson that allows it: go back to your own studio and do the lesson there */
  useOwnStudio: () => void;

  // ---- spaced review --------------------------------------------------------
  recordReview: (itemId: string, correct: boolean, lesson: string, meta?: { fp?: string; device?: string }) => void;
  /**
   * Bring the review queue in line with the lessons that exist now: drop items whose
   * question no longer exists, and restart items whose question text changed.
   * `complete: true` means every device's lessons are registered, so an item whose
   * lesson is unknown is an orphan too.
   */
  reconcileReview: (opts?: { complete?: boolean }) => void;
}

/** The browser save of the studio (throttled; see lib/studio/persistStorage.ts) */
export const studioStorage = throttledLocalStorage<unknown>();

// Device specs registered at runtime (module scope - not persisted)
const specs: Record<string, DeviceSpec> = {};
let advanceTimer: ReturnType<typeof setTimeout> | null = null;

// ---- Lesson registry (module scope, not persisted) ---------------------------
// The lessons of every device module that has loaded (plus the studio curriculum),
// so the review queue can tell a question that still exists from one whose lesson
// was rebuilt or removed - without loading every module up front.
const lessonIndex = new Map<string, Lesson>();
const lessonDevices = new Set<string>();
STUDIO_LESSONS.forEach(l => lessonIndex.set(l.id, l));
lessonDevices.add('studio');

/** Live engine state for lesson checks (the hub registers it; the store cannot import the hub) */
let engineReader: ((instance: string) => Record<string, unknown>) | null = null;

/** Let lesson checks read the engine's live state (current step, LEDs...) */
export function setLessonEngineReader(fn: ((instance: string) => Record<string, unknown>) | null) {
  engineReader = fn;
}

/** Item kinds Daily Review can ask: r = lesson review question, q = quiz step, p = prediction */
const REVIEWABLE = new Set(['r', 'q', 'p']);

/** Short, stable fingerprint of a question (FNV-1a of the question and its right answer) */
export function questionFingerprint(mc: MultipleChoice): string {
  const s = `${mc.question}\u0001${mc.options[mc.answer] ?? ''}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** The multiple-choice question behind a review ref ('r2', 'q5', 'p3') */
export function reviewQuestionOf(lesson: Lesson, ref: string): MultipleChoice | undefined {
  const kind = ref[0];
  const n = Number(ref.slice(1));
  if (!Number.isInteger(n) || n < 0) return undefined;
  if (kind === 'r') return lesson.review?.[n];
  const st = lesson.steps[n];
  if (!st) return undefined;
  if (kind === 'q') return stepKind(st) === 'quiz' ? st.quiz : undefined;
  if (kind === 'p') return stepKind(st) === 'predict' ? st.predict : undefined;
  return undefined;
}

function splitReviewId(id: string): [string, string] {
  const i = id.lastIndexOf(':');
  return i < 0 ? [id, ''] : [id.slice(0, i), id.slice(i + 1)];
}

/**
 * Resolve a review item against the registered lessons.
 *   { lesson, mc }  the question exists
 *   null            it cannot exist any more (orphan)
 *   undefined       unknown: its device's lessons have not loaded yet
 */
export function resolveReviewItem(id: string, item?: Pick<ReviewItem, 'device'>, complete = false): { lesson: Lesson; mc: MultipleChoice } | null | undefined {
  const [lessonId, ref] = splitReviewId(id);
  if (!REVIEWABLE.has(ref[0])) return null;
  const lesson = lessonIndex.get(lessonId);
  if (!lesson) {
    // Producer path lessons load on demand: until they have, their questions are pending, not gone
    if (isProducerLessonId(lessonId) && !producerLessonsNow()) return undefined;
    if (complete || (item?.device && lessonDevices.has(item.device))) return null;
    return undefined;
  }
  const mc = reviewQuestionOf(lesson, ref);
  return mc ? { lesson, mc } : null;
}

/**
 * Tell the review queue which lessons a device has now. Items of that device whose
 * question is gone are dropped, and items whose question changed start again.
 */
export function registerLessons(device: string, lessons: Lesson[]) {
  const fresh = !lessonDevices.has(device) || lessons.some(l => lessonIndex.get(l.id) !== l);
  if (!fresh) return;
  lessons.forEach(l => lessonIndex.set(l.id, l));
  lessonDevices.add(device);
  // Deferred: callers are often in the middle of a render or module load
  setTimeout(() => useStudioStore.getState().reconcileReview(), 0);
}

// The Producer path's lessons register themselves here once they have loaded
setProducerRegister(registerLessons);

const ADVANCE_DELAY_MS = 750;
const PREDICT_REVEAL_MS = 2200;
/** Leitner intervals per box (ms) */
const DAY = 86_400_000;
const BOX_INTERVALS = [0, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY];

const PRESET_COLORS = ['#22c55e', '#f97316', '#ef4444', '#06b6d4', '#a855f7', '#eab308', '#ec4899', '#3b82f6', '#14b8a6', '#f43f5e'];

const initInstance = (): InstanceState => ({ controlValues: {}, patchConnections: [] });

const defaultStudio = (focus = 'dfam'): StudioDoc => ({
  rack: [{ id: focus, device: focus }],
  cables: [],
  routes: {},
  sync: {},
  bpm: 120,
  swing: 0,
  arrangement: { enabled: false, loop: true, sections: [] },
});

const sameCable = (c: PatchConnection, a: string, b: string) =>
  (c.from === a && c.to === b) || (c.from === b && c.to === a);

const sameStudioCable = (c: StudioCable, d: StudioCable) =>
  (c.from.instance === d.from.instance && c.from.jack === d.from.jack && c.to.instance === d.to.instance && c.to.jack === d.to.jack) ||
  (c.from.instance === d.to.instance && c.from.jack === d.to.jack && c.to.instance === d.from.instance && c.to.jack === d.from.jack);

/** The mixer without an instance's channel (it left the rack) */
const withoutChannel = (m: MixerDoc | undefined, instance: string): MixerDoc | undefined => {
  if (!m?.channels?.[instance]) return m;
  const channels = { ...m.channels };
  delete channels[instance];
  return { ...m, channels };
};

/** Device type of an instance id when the rack doesn't know it ('mother32#2' -> 'mother32') */
const stripInstance = (instance: string) => instance.split('#')[0];

function clearAdvance() {
  if (advanceTimer) clearTimeout(advanceTimer);
  advanceTimer = null;
}

/** The studio mixer with every default filled in (lesson checks read it) */
function mixerView(studio: StudioDoc): NonNullable<LessonCheckState['mixer']> {
  const channels: NonNullable<LessonCheckState['mixer']>['channels'] = {};
  studio.rack.forEach(r => { channels[r.id] = channelOf(studio.mixer, r.id); });
  return { channels, delay: delayOf(studio.mixer), reverb: reverbOf(studio.mixer), master: masterOf(studio.mixer) };
}

/**
 * The v3 studio-state fields of a lesson check state: swing, the mix, the master section
 * and what the lesson runtime measures live (meters, REC and Bounce, history, song position)
 */
function studioCheckExtras(studio: StudioDoc): Pick<LessonCheckState, 'mixer' | 'master' | 'meters' | 'bounce' | 'history' | 'arranger'> {
  const live = getLessonLive();
  const mixer = mixerView(studio);
  return {
    mixer,
    master: { gainDb: mixer.master.gain, limiterOn: true, ceilingDbTP: LIMITER_CEILING_DB, glueOn: mixer.master.glue.on, eqOn: mixer.master.eq.on },
    meters: live.meters,
    bounce: live.bounce,
    history: live.history,
    arranger: live.arranger,
  };
}

/** Defaults for a device from its registered spec */
export function specDefaults(device: string): Record<string, ControlValue> {
  const spec = specs[device];
  const d: Record<string, ControlValue> = {};
  if (!spec) return d;
  Object.entries(spec.controls).forEach(([id, c]) => {
    const v = defaultOf(c);
    if (v !== undefined) d[id] = v;
  });
  return d;
}

export function getSpec(device: string): DeviceSpec | undefined {
  return specs[device];
}

/** Implicit step kind */
export function stepKind(step: LessonStep): NonNullable<LessonStep['kind']> {
  if (step.kind) return step.kind;
  if (step.patchFrom && step.patchTo) return 'patch';
  if (step.control || step.event || step.play) return 'do';
  if (step.checklist?.length) return 'challenge';
  return 'info';
}

/** The instance a lesson step acts on */
export function stepInstance(step: LessonStep | undefined, lesson: Lesson | undefined, lessonInstance?: string): string {
  return step?.instance ?? lessonInstance ?? lesson?.device ?? '';
}

export const useStudioStore = create<StudioStore>()(
  persist(
    (set, get) => {
      const deviceOf = (instance: string) => get().studio.rack.find(r => r.id === instance)?.device ?? stripInstance(instance);

      /** Put the output first so engines and the UI see a consistent direction */
      const orient = (instance: string, a: string, b: string): [string, string] => {
        const pb = specs[deviceOf(instance)]?.patchBay;
        if (!pb) return [a, b];
        const isOut = (id: string) => pb.outputs.some(j => j.id === id);
        if (!isOut(a) && isOut(b)) return [b, a];
        return [a, b];
      };

      const valuesOf = (instance: string) => ({ ...specDefaults(deviceOf(instance)), ...(get().devices[instance]?.controlValues ?? {}) });

      const checkState = (instance: string, engine?: Record<string, unknown>): LessonCheckState => {
        const s = get();
        const instances: LessonCheckState['instances'] = {};
        s.studio.rack.forEach(r => {
          instances[r.id] = {
            device: r.device,
            values: valuesOf(r.id),
            patches: s.devices[r.id]?.patchConnections ?? [],
            data: s.devices[r.id]?.data,
          };
        });
        const sess = s.isTeachingMode ? s.session[s.currentStep] : undefined;
        let eng = engine;
        if (!eng) {
          try { eng = engineReader?.(instance) ?? {}; } catch { eng = {}; }
        }
        return {
          values: valuesOf(instance),
          patches: s.devices[instance]?.patchConnections ?? [],
          data: s.devices[instance]?.data,
          engine: eng,
          instances,
          studioCables: s.studio.cables,
          routes: s.studio.routes,
          sync: s.studio.sync,
          transport: { playing: transport.playing, bpm: s.studio.bpm, swing: s.studio.swing ?? 0 },
          arrangement: s.studio.arrangement,
          events: sess?.events?.[instance] ?? {},
          notesPlayed: sess?.notes?.[instance] ?? [],
          eventsByInstance: sess?.events ?? {},
          ...studioCheckExtras(s.studio),
        };
      };

      /** Replace the studio and instruments (lesson start states, restoring a backup) */
      const replaceStudio = (next: { devices: Record<string, InstanceState>; studio: StudioDoc; currentDevice: string }) => {
        const hooks = lessonStudioHooks();
        if (hooks) hooks.stopAll();
        else if (transport.playing) transport.stop();
        set({ devices: next.devices, studio: next.studio, currentDevice: next.currentDevice });
        transport.setBpm(next.studio.bpm);
        transport.setSwing(next.studio.swing ?? 0);
        hooks?.studioReplaced();
      };

      /** Save the studio you have now as a backup (unless an identical one is the newest) */
      const backupCurrent = (label: string): string => {
        const s = get();
        const newest = s.lessonBackups[0];
        if (newest && sameStudio(newest, s.devices, s.studio)) return newest.id;
        const id = newBackupId();
        const pinned = !s.lessonBackups.some(b => b.pinned);
        const backup: LessonBackup = { id, at: Date.now(), label, pinned, devices: s.devices, studio: s.studio, currentDevice: s.currentDevice };
        set({ lessonBackups: pushBackup(s.lessonBackups, backup) });
        return id;
      };

      /** Is the current step's *action* done (ignores answer requirements) */
      const actionDone = (lesson: Lesson, step: LessonStep, instance: string): boolean => {
        const kind = stepKind(step);
        const s = get();
        const st = s.devices[instance] ?? initInstance();
        const device = deviceOf(instance);
        let ok = true;
        if (step.control || (step.patchFrom && step.patchTo) || step.event || step.play) {
          const spec = step.control ? specs[device]?.controls[step.control] : undefined;
          const sess = s.session[s.currentStep];
          ok = isStepSatisfied(step, spec, valuesOf(instance), st.patchConnections, {
            events: sess?.events?.[instance],
            notesPlayed: sess?.notes?.[instance],
          });
        }
        if (ok && step.check) {
          try { ok = step.check(checkState(instance)); } catch { ok = false; }
        }
        if (ok && kind === 'challenge' && step.checklist?.length) {
          ok = step.checklist.every(c => {
            if (!c.check) return true;
            try { return c.check(checkState(instance)); } catch { return false; }
          });
        }
        void lesson;
        return ok;
      };

      /** Evaluate the current step; auto-advance when appropriate */
      const evaluate = () => {
        const s = get();
        if (!s.isTeachingMode || !s.currentLesson || s.lessonFinished) return;
        // A "show me" demonstration moves controls for the learner: it must not finish the step
        if (s.lessonDemo) return;
        const lesson = s.currentLesson;
        const step = lesson.steps[s.currentStep];
        if (!step) return;
        // A step can act on another instrument in the rack (studio lessons)
        const instance = stepInstance(step, lesson, s.lessonInstance);
        const kind = stepKind(step);
        const sess = s.session[s.currentStep] ?? {};
        let ok: boolean;
        let auto = false;
        let delay = ADVANCE_DELAY_MS;
        switch (kind) {
          case 'do':
          case 'patch':
            ok = actionDone(lesson, step, instance);
            auto = true;
            break;
          case 'predict':
            // Must commit to a prediction before the action counts
            ok = sess.answer !== undefined && actionDone(lesson, step, instance);
            auto = true;
            delay = PREDICT_REVEAL_MS;
            break;
          case 'challenge':
            ok = actionDone(lesson, step, instance);
            break;
          case 'match':
            ok = (sess.match?.score ?? 0) >= 1;
            break;
          case 'quiz':
            ok = sess.answer !== undefined;
            break;
          case 'listen':
            ok = step.listen?.question ? sess.answer !== undefined : true;
            break;
          case 'reflect':
            ok = sess.rating !== undefined;
            break;
          default:
            ok = step.check ? actionDone(lesson, step, instance) : true;
            auto = !!step.check;
        }

        if (!ok) {
          if (s.stepSatisfied) set({ stepSatisfied: false });
          clearAdvance();
          return;
        }
        if (!sess.done) setSession({ done: true });
        if (s.stepSatisfied && advanceTimer) return;
        set({ stepSatisfied: true });
        if (!auto) return;
        clearAdvance();
        const lessonId = lesson.id;
        const stepIndex = s.currentStep;
        advanceTimer = setTimeout(() => {
          advanceTimer = null;
          const now = get();
          if (!now.isTeachingMode || now.currentLesson?.id !== lessonId || now.currentStep !== stepIndex) return;
          if (stepIndex >= lesson.steps.length - 1) set({ lessonFinished: true, stepSatisfied: true });
          else enterStep(stepIndex + 1);
        }, delay);
      };

      /** Move to a step and apply its setup state */
      const enterStep = (index: number) => {
        const s = get();
        const lesson = s.currentLesson;
        if (!lesson) return;
        clearAdvance();
        const i = Math.max(0, Math.min(lesson.steps.length - 1, index));
        const step = lesson.steps[i];
        const instance = stepInstance(step, lesson, s.lessonInstance);
        // Presses and notes count afresh every time a step begins
        const prevSess = s.session[i];
        const session = prevSess && (prevSess.events || prevSess.notes)
          ? { ...s.session, [i]: { ...prevSess, events: undefined, notes: undefined } }
          : s.session;
        set({ currentStep: i, stepSatisfied: false, lessonFinished: false, session, lessonDemo: null });
        if (step?.setup || step?.setupPatches || (stepKind(step) === 'match' && step.match)) {
          const values: Record<string, ControlValue> = { ...(step.setup ?? {}) };
          // Ear training: everything except the controls being tested starts at the target
          if (step.match) {
            Object.entries(step.match.target).forEach(([k, v]) => {
              if (!step.match!.controls.includes(k)) values[k] = v;
            });
          }
          set(state => {
            const d = state.devices[instance] ?? initInstance();
            return {
              devices: {
                ...state.devices,
                [instance]: {
                  ...d,
                  controlValues: { ...d.controlValues, ...values },
                  patchConnections: step.setupPatches ?? step.match?.patches ?? d.patchConnections,
                },
              },
            };
          });
        }
        evaluate();
      };

      const updateInstance = (instance: string, fn: (d: InstanceState) => InstanceState) => {
        set(state => ({
          devices: { ...state.devices, [instance]: fn(state.devices[instance] ?? initInstance()) },
        }));
        evaluate();
      };

      const updateStudio = (fn: (st: StudioDoc) => StudioDoc) => {
        set(state => ({ studio: fn(state.studio) }));
        evaluate();
      };

      const setSession = (patch: StepSession) => {
        const s = get();
        set({ session: { ...s.session, [s.currentStep]: { ...(s.session[s.currentStep] ?? {}), ...patch } } });
      };

      // Re-evaluate lesson checks when the transport starts/stops (sequencer tasks)
      if (typeof window !== 'undefined') {
        transport.onEvent(e => { if (e.type === 'start' || e.type === 'stop') setTimeout(evaluate, 0); });
      }

      return {
        currentDevice: 'dfam',
        devices: {},
        studio: defaultStudio(),
        completedLessons: [],
        review: {},
        currentLesson: undefined,
        lessonInstance: undefined,
        currentStep: 0,
        isTeachingMode: false,
        lessonFinished: false,
        stepSatisfied: false,
        session: {},
        lessonSnapshot: undefined,
        focusMode: true,
        lessonDemo: null,
        lessonStudio: undefined,
        lessonBackups: [],

        // ---- focus / rack -------------------------------------------------------
        setCurrentDevice: id => {
          const s = get();
          let instance = id;
          if (!s.studio.rack.some(r => r.id === id)) {
            // A device type: focus its first instance, adding one if needed
            const existing = s.studio.rack.find(r => r.device === id);
            instance = existing ? existing.id : get().addToRack(id, { focus: false });
          }
          if (s.currentLesson && deviceOf(instance) !== s.currentLesson.device && s.currentLesson.device !== 'studio') get().resetLesson();
          set({ currentDevice: instance });
        },

        registerDevice: spec => {
          specs[spec.id] = spec;
        },

        deviceOf,

        addToRack: (device, opts = {}) => {
          const s = get();
          let id = device;
          if (s.studio.rack.some(r => r.id === id)) {
            if (!opts.duplicate) {
              if (opts.focus) set({ currentDevice: id });
              return id;
            }
            let n = 2;
            while (s.studio.rack.some(r => r.id === `${device}#${n}`)) n++;
            id = `${device}#${n}`;
          }
          const slot: RackSlot = { id, device, label: opts.label };
          set(state => ({
            studio: { ...state.studio, rack: [...state.studio.rack, slot] },
            ...(opts.focus ? { currentDevice: id } : {}),
          }));
          return id;
        },

        replaceInRack: (instance, device) => {
          const s = get();
          const existing = s.studio.rack.find(r => r.device === device);
          if (existing) {
            set({ currentDevice: existing.id });
            return existing.id;
          }
          const id = s.studio.rack.some(r => r.id === device) ? `${device}#2` : device;
          const rack = s.studio.rack.some(r => r.id === instance)
            ? s.studio.rack.map(r => (r.id === instance ? { id, device } : r))
            : [...s.studio.rack, { id, device }];
          const routes = { ...s.studio.routes };
          delete routes[instance];
          set({
            studio: {
              ...s.studio,
              rack,
              routes,
              cables: s.studio.cables.filter(c => c.from.instance !== instance && c.to.instance !== instance),
              mixer: withoutChannel(s.studio.mixer, instance),
            },
            currentDevice: id,
          });
          if (s.currentLesson && s.lessonInstance === instance) get().resetLesson();
          return id;
        },

        removeFromRack: instance => {
          const s = get();
          if (s.studio.rack.length <= 1) return; // keep at least one instrument
          const rack = s.studio.rack.filter(r => r.id !== instance);
          const routes = { ...s.studio.routes };
          delete routes[instance];
          Object.keys(routes).forEach(k => { if (routes[k].startsWith(`${instance}:`)) routes[k] = 'master'; });
          set({
            studio: {
              ...s.studio,
              rack,
              routes,
              cables: s.studio.cables.filter(c => c.from.instance !== instance && c.to.instance !== instance),
              mixer: withoutChannel(s.studio.mixer, instance),
            },
            currentDevice: s.currentDevice === instance ? rack[0].id : s.currentDevice,
          });
        },

        moveInRack: (instance, delta) => {
          const rack = [...get().studio.rack];
          const i = rack.findIndex(r => r.id === instance);
          const j = i + delta;
          if (i < 0 || j < 0 || j >= rack.length) return;
          [rack[i], rack[j]] = [rack[j], rack[i]];
          updateStudio(st => ({ ...st, rack }));
        },

        renameInstance: (instance, label) =>
          updateStudio(st => ({ ...st, rack: st.rack.map(r => (r.id === instance ? { ...r, label } : r)) })),

        // ---- per-instance state ---------------------------------------------------
        setControlValue: (instance, control, value) =>
          updateInstance(instance, d => (d.controlValues[control] === value ? d : { ...d, controlValues: { ...d.controlValues, [control]: value } })),

        setControlValues: (instance, values) =>
          updateInstance(instance, d => ({ ...d, controlValues: { ...d.controlValues, ...values } })),

        getControlValue: (instance, control) => get().devices[instance]?.controlValues[control],

        resetControlsToSpec: (instance, defaults) =>
          updateInstance(instance, d => ({ ...d, controlValues: { ...d.controlValues, ...defaults } })),

        loadPreset: (instance, values, patches) =>
          updateInstance(instance, d => ({
            ...d,
            controlValues: { ...d.controlValues, ...values },
            patchConnections: patches
              ? patches.map((p, i) => {
                  const [from, to] = orient(instance, p.from, p.to);
                  return { from, to, color: p.color ?? PRESET_COLORS[i % PRESET_COLORS.length] };
                })
              : d.patchConnections,
          })),

        setDeviceData: (instance, data) => updateInstance(instance, d => ({ ...d, data })),

        updateDeviceData: (instance, fn) => updateInstance(instance, d => ({ ...d, data: fn(d.data) })),

        addPatchConnection: (instance, a, b, color) => {
          if (a === b) return;
          const [from, to] = orient(instance, a, b);
          updateInstance(instance, d => {
            if (d.patchConnections.some(c => sameCable(c, from, to))) return d;
            return {
              ...d,
              patchConnections: [
                ...d.patchConnections,
                { from, to, color: color ?? PRESET_COLORS[d.patchConnections.length % PRESET_COLORS.length] },
              ],
            };
          });
        },

        removePatchConnection: (instance, from, to) =>
          updateInstance(instance, d => ({ ...d, patchConnections: d.patchConnections.filter(c => !sameCable(c, from, to)) })),

        clearPatchConnections: instance => updateInstance(instance, d => ({ ...d, patchConnections: [] })),

        // ---- studio ---------------------------------------------------------------
        addStudioCable: cable => {
          if (cable.from.instance === cable.to.instance) {
            get().addPatchConnection(cable.from.instance, cable.from.jack, cable.to.jack, cable.color);
            return;
          }
          // Orient output -> input
          const isOut = (inst: string, jack: string) => !!specs[deviceOf(inst)]?.patchBay?.outputs.some(j => j.id === jack);
          let c = cable;
          if (!isOut(c.from.instance, c.from.jack) && isOut(c.to.instance, c.to.jack)) c = { ...c, from: c.to, to: c.from };
          updateStudio(st => {
            if (st.cables.some(x => sameStudioCable(x, c))) return st;
            return { ...st, cables: [...st.cables, { ...c, color: c.color ?? PRESET_COLORS[(st.cables.length + 3) % PRESET_COLORS.length] }] };
          });
        },

        removeStudioCable: cable => updateStudio(st => ({ ...st, cables: st.cables.filter(x => !sameStudioCable(x, cable)) })),

        clearStudioCables: instance =>
          updateStudio(st => ({
            ...st,
            cables: instance ? st.cables.filter(c => c.from.instance !== instance && c.to.instance !== instance) : [],
          })),

        setRoute: (instance, route) => updateStudio(st => ({ ...st, routes: { ...st.routes, [instance]: route } })),

        setSync: (instance, on) => updateStudio(st => ({ ...st, sync: { ...st.sync, [instance]: on } })),

        setPowered: (instance, on) => updateStudio(st => ({ ...st, off: { ...(st.off ?? {}), [instance]: !on } })),

        setBpm: bpm => {
          const b = Math.max(20, Math.min(300, Math.round(bpm * 10) / 10));
          transport.setBpm(b);
          updateStudio(st => ({ ...st, bpm: b }));
        },

        setSwing: swing => {
          transport.setSwing(swing);
          updateStudio(st => ({ ...st, swing }));
        },

        setArrangement: fn => updateStudio(st => ({ ...st, arrangement: fn(st.arrangement) })),

        setChannel: (instance, patch) =>
          updateStudio(st => {
            const m = st.mixer ?? {};
            const prev = m.channels?.[instance] ?? {};
            return { ...st, mixer: { ...m, channels: { ...(m.channels ?? {}), [instance]: { ...prev, ...patch } } } };
          }),

        setReturn: (bus, patch) =>
          updateStudio(st => {
            const m = st.mixer ?? {};
            return { ...st, mixer: { ...m, [bus]: { ...(m[bus] ?? {}), ...patch } } };
          }),

        setMasterSection: patch =>
          updateStudio(st => {
            const m = st.mixer ?? {};
            const master = m.master ?? {};
            return {
              ...st,
              mixer: {
                ...m,
                master: {
                  ...master,
                  ...(patch.gain !== undefined ? { gain: patch.gain } : {}),
                  ...(patch.eq ? { eq: { ...(master.eq ?? {}), ...patch.eq } } : {}),
                  ...(patch.glue ? { glue: { ...(master.glue ?? {}), ...patch.glue } } : {}),
                },
              },
            };
          }),

        setMixer: fn => updateStudio(st => ({ ...st, mixer: fn(st.mixer ?? {}) })),

        setMetronome: patch => set(state => ({ studio: { ...state.studio, metronome: { ...(state.studio.metronome ?? {}), ...patch } } })),

        loadProject: p => {
          get().resetLesson();
          const studio = { ...defaultStudio(), ...p.studio };
          if (!studio.rack.length) studio.rack = defaultStudio().rack;
          transport.setBpm(studio.bpm);
          transport.setSwing(studio.swing);
          set({ devices: p.devices ?? {}, studio, currentDevice: p.currentDevice ?? studio.rack[0].id });
        },

        newProject: () => {
          get().resetLesson();
          const focus = deviceOf(get().currentDevice);
          set({ devices: {}, studio: defaultStudio(focus), currentDevice: focus });
          transport.setBpm(120);
          transport.setSwing(0);
        },

        // ---- lessons --------------------------------------------------------------
        startLesson: (lesson, instanceArg) => {
          clearAdvance();
          let s = get();
          // A whole studio to start from (v3): save the learner's studio, then load the lesson's
          const studioStart = lesson.device === 'studio' ? lesson.start?.studio : undefined;
          let lessonStudio: LessonSessionState['lessonStudio'];
          if (studioStart) {
            const backupId = backupCurrent(`Before “${lesson.name}”`);
            replaceStudio(buildLessonStudio(studioStart, get()));
            lessonStudio = { lesson: lesson.id, backupId, own: false };
            s = get();
          }
          // Studio lessons measure the studio live (meters, takes, history): that is the lesson
          // runtime, loaded on demand because it imports the hub
          if (lesson.device === 'studio' && typeof window !== 'undefined') void import('@/lib/studio/lessonRuntime').catch(() => undefined);
          let instance = instanceArg;
          if (!instance) {
            if (lesson.device === 'studio') instance = s.currentDevice;
            else if (deviceOf(s.currentDevice) === lesson.device) instance = s.currentDevice;
            else instance = s.studio.rack.find(r => r.device === lesson.device)?.id ?? get().addToRack(lesson.device);
          }
          // Studio lessons need their instruments in the rack
          lesson.requires?.forEach(dev => {
            if (!get().studio.rack.some(r => r.device === dev)) get().addToRack(dev);
          });
          const snapshot = s.devices[instance] ? { instance, state: s.devices[instance] } : { instance, state: initInstance() };
          // Apply the lesson's starting point
          if (lesson.start && lesson.device !== 'studio') {
            const device = deviceOf(instance);
            const base = lesson.start.reset ? specDefaults(device) : {};
            set(state => {
              const d = state.devices[instance] ?? initInstance();
              return {
                devices: {
                  ...state.devices,
                  [instance!]: {
                    ...d,
                    controlValues: { ...(lesson.start!.reset ? {} : d.controlValues), ...base, ...(lesson.start!.values ?? {}) },
                    patchConnections: lesson.start!.patches ?? (lesson.start!.reset ? [] : d.patchConnections),
                    data: lesson.start!.data !== undefined ? structuredClone(lesson.start!.data) : d.data,
                  },
                },
              };
            });
          }
          // The review queue can resolve this lesson's questions from now on
          if (!lessonIndex.has(lesson.id)) lessonIndex.set(lesson.id, lesson);
          set({
            currentLesson: lesson,
            lessonInstance: instance,
            currentStep: 0,
            isTeachingMode: true,
            lessonFinished: false,
            stepSatisfied: false,
            session: {},
            lessonSnapshot: snapshot,
            lessonDemo: null,
            lessonStudio,
            currentDevice: lesson.device === 'studio' ? s.currentDevice : instance,
          });
          enterStep(0);
        },

        goToStep: index => enterStep(index),

        nextStep: () => {
          const s = get();
          if (!s.currentLesson) return;
          if (s.currentStep >= s.currentLesson.steps.length - 1) {
            clearAdvance();
            set({ lessonFinished: true });
          } else {
            enterStep(s.currentStep + 1);
          }
        },

        prevStep: () => enterStep(get().currentStep - 1),

        resetLesson: () => {
          clearAdvance();
          set({ currentLesson: undefined, currentStep: 0, isTeachingMode: false, lessonFinished: false, stepSatisfied: false, session: {}, lessonDemo: null, lessonStudio: undefined });
        },

        completeLesson: () => {
          const s = get();
          clearAdvance();
          if (!s.currentLesson) return;
          const lesson = s.currentLesson;
          const review = { ...s.review };
          const now = Date.now();
          // Seed the spaced-review queue: due tomorrow. Questions answered during the
          // lesson already have an item (a miss is due tomorrow, so it comes first).
          const seed = (ref: string, mc: MultipleChoice | undefined) => {
            if (!mc) return;
            const id = `${lesson.id}:${ref}`;
            const fp = questionFingerprint(mc);
            const prev = review[id];
            if (prev && (!prev.fp || prev.fp === fp)) {
              if (!prev.fp || !prev.device) review[id] = { ...prev, fp, device: lesson.device };
              return;
            }
            review[id] = { box: 1, due: now + BOX_INTERVALS[1], last: now, right: 0, wrong: 0, lesson: lesson.id, fp, device: lesson.device };
          };
          (lesson.review ?? []).forEach((mc, i) => seed(`r${i}`, mc));
          lesson.steps.forEach((st, i) => {
            const kind = stepKind(st);
            if (kind === 'quiz') seed(`q${i}`, st.quiz);
            if (kind === 'predict') seed(`p${i}`, st.predict);
          });
          set({
            completedLessons: s.completedLessons.includes(lesson.id) ? s.completedLessons : [...s.completedLessons, lesson.id],
            review,
            currentLesson: undefined,
            currentStep: 0,
            isTeachingMode: false,
            lessonFinished: false,
            stepSatisfied: false,
            session: {},
            lessonDemo: null,
            lessonStudio: undefined,
          });
        },

        restoreLessonSnapshot: () => {
          // A studio lesson replaced the whole studio: bring back the one saved at its start
          const ls = get().lessonStudio;
          if (ls?.backupId && !ls.own && get().lessonBackups.some(b => b.id === ls.backupId)) {
            get().restoreStudioBackup(ls.backupId);
            set({ lessonSnapshot: undefined, lessonStudio: { ...ls, backupId: undefined } });
            return;
          }
          const snap = get().lessonSnapshot;
          if (!snap) return;
          set(state => ({ devices: { ...state.devices, [snap.instance]: snap.state }, lessonSnapshot: undefined }));
        },

        restoreStudioBackup: (id, opts = {}) => {
          const s = get();
          const b = s.lessonBackups.find(x => x.id === id);
          if (!b) return;
          let list = s.lessonBackups.filter(x => x.id !== id);
          // Swap: the studio you have now takes its place, so nothing is lost
          if (opts.keepCurrent !== false && !sameStudio(b, s.devices, s.studio)) {
            const lessonName = s.currentLesson?.name ?? lessonIndex.get(s.lessonStudio?.lesson ?? '')?.name;
            list = pushBackup(list, {
              id: newBackupId(), at: Date.now(), label: lessonName ? `Your work in “${lessonName}”` : 'Your studio before restoring',
              pinned: false, devices: s.devices, studio: s.studio, currentDevice: s.currentDevice,
            });
          }
          set({ lessonBackups: list });
          replaceStudio({ devices: b.devices, studio: b.studio, currentDevice: b.currentDevice });
        },

        deleteStudioBackup: id => set(state => ({ lessonBackups: state.lessonBackups.filter(b => b.id !== id) })),

        useOwnStudio: () => {
          const s = get();
          const ls = s.lessonStudio;
          if (!ls || ls.own || !s.currentLesson?.start?.studio?.ownStudio) return;
          // The lesson's studio is only its start state: nothing to keep
          if (ls.backupId && s.lessonBackups.some(b => b.id === ls.backupId)) get().restoreStudioBackup(ls.backupId, { keepCurrent: false });
          set({ lessonStudio: { ...ls, backupId: undefined, own: true } });
          enterStep(get().currentStep);
        },

        isStepComplete: () => get().stepSatisfied,

        answerStep: answer => {
          const s = get();
          const lesson = s.currentLesson;
          if (!lesson) return;
          const step = lesson.steps[s.currentStep];
          const prev = s.session[s.currentStep]?.answer;
          if (prev !== undefined) return; // first answer counts (retrieval honesty)
          const kind = stepKind(step);
          // A prediction is committed before the action: presses made earlier don't count
          setSession(kind === 'predict' ? { answer, events: undefined, notes: undefined } : { answer });
          const mc = step.quiz ?? step.predict ?? step.listen?.question;
          if (mc && (kind === 'quiz' || kind === 'predict')) {
            get().recordReview(`${lesson.id}:${kind === 'quiz' ? 'q' : 'p'}${s.currentStep}`, answer === mc.answer, lesson.id, { fp: questionFingerprint(mc), device: lesson.device });
          }
          evaluate();
        },

        checkMatch: () => {
          const s = get();
          const lesson = s.currentLesson;
          if (!lesson) return;
          const step = lesson.steps[s.currentStep];
          if (!step.match) return;
          const instance = stepInstance(step, lesson, s.lessonInstance);
          const device = deviceOf(instance);
          const values = valuesOf(instance);
          const tol = step.match.tolerance ?? 0.08;
          const off: NonNullable<StepSession['match']>['off'] = [];
          step.match.controls.forEach(id => {
            const spec = specs[device]?.controls[id];
            const target = step.match!.target[id];
            const v = values[id];
            let ok: boolean;
            if (spec && (spec.type === 'knob' || spec.type === 'slider') && typeof v === 'number' && typeof target === 'number') {
              const err = Math.abs(valueToNorm(spec, v) - valueToNorm(spec, target));
              ok = err <= tol;
              // "far" lets the feedback say "a lot" or "a little" once direction is revealed
              if (!ok) off.push({ id, dir: v < target ? 'higher' : 'lower', far: err > tol * 2.5 });
            } else {
              ok = isValueOnTarget(spec, v, target);
              if (!ok) off.push({ id, dir: 'different' });
            }
          });
          const score = (step.match.controls.length - off.length) / Math.max(1, step.match.controls.length);
          const attempts = (s.session[s.currentStep]?.attempts ?? 0) + 1;
          setSession({ attempts, match: { score, off } });
          evaluate();
        },

        rateReflection: rating => {
          setSession({ rating, revealed: true });
          evaluate();
        },

        revealStep: () => setSession({ revealed: true }),

        showHint: () => {
          const s = get();
          setSession({ hints: (s.session[s.currentStep]?.hints ?? 0) + 1 });
        },

        setFocusMode: on => set({ focusMode: on }),

        reevaluate: () => evaluate(),

        lessonPress: (instance, ids) => {
          const s = get();
          if (!s.isTeachingMode || !s.currentLesson || s.lessonFinished || s.lessonDemo) return;
          const keys = [...new Set(ids.filter(id => !!id && !id.endsWith(':up')))];
          if (!keys.length) return;
          const sess = s.session[s.currentStep] ?? {};
          const mine = { ...(sess.events?.[instance] ?? {}) };
          keys.forEach(id => { mine[id] = (mine[id] ?? 0) + 1; });
          setSession({ events: { ...(sess.events ?? {}), [instance]: mine } });
          evaluate();
        },

        lessonNote: (instance, note) => {
          const s = get();
          if (!s.isTeachingMode || !s.currentLesson || s.lessonFinished || s.lessonDemo) return;
          const sess = s.session[s.currentStep] ?? {};
          const mine = [...(sess.notes?.[instance] ?? []), note].slice(-64);
          setSession({ notes: { ...(sess.notes ?? {}), [instance]: mine } });
          evaluate();
        },

        setLessonDemo: demo => {
          set({ lessonDemo: demo });
          if (!demo) evaluate();
        },

        markStepShown: () => setSession({ shown: true }),

        lessonCheckState: () => {
          const s = get();
          if (!s.currentLesson) return null;
          const step = s.currentLesson.steps[s.currentStep];
          return checkState(stepInstance(step, s.currentLesson, s.lessonInstance));
        },

        // ---- spaced review --------------------------------------------------------
        recordReview: (itemId, correct, lesson, meta) => {
          const now = Date.now();
          set(state => {
            const fresh: ReviewItem = { box: 0, due: now, last: now, right: 0, wrong: 0, lesson };
            const old = state.review[itemId];
            // A different question under the same id (a rebuilt lesson) starts from scratch
            const prev = old && !(meta?.fp && old.fp && old.fp !== meta.fp) ? old : fresh;
            const box = correct ? Math.min(5, prev.box + 1) : 1;
            return {
              review: {
                ...state.review,
                [itemId]: {
                  ...prev,
                  box,
                  due: now + BOX_INTERVALS[box],
                  last: now,
                  right: prev.right + (correct ? 1 : 0),
                  wrong: prev.wrong + (correct ? 0 : 1),
                  lesson,
                  ...(meta?.fp ? { fp: meta.fp } : {}),
                  ...(meta?.device ? { device: meta.device } : {}),
                },
              },
            };
          });
        },

        reconcileReview: (opts = {}) => {
          const s = get();
          const now = Date.now();
          let changed = false;
          const next: Record<string, ReviewItem> = {};
          Object.entries(s.review).forEach(([id, item]) => {
            const r = resolveReviewItem(id, item, !!opts.complete);
            if (r === null) { changed = true; return; } // the question no longer exists
            if (r === undefined) { next[id] = item; return; } // its lessons haven't loaded yet
            const fp = questionFingerprint(r.mc);
            if (item.fp && item.fp !== fp) {
              // Same id, different question: the old Leitner box says nothing about this one
              next[id] = { ...item, box: 0, due: now, last: now, right: 0, wrong: 0, fp, device: r.lesson.device };
              changed = true;
            } else if (!item.fp || !item.device) {
              next[id] = { ...item, fp, device: item.device ?? r.lesson.device };
              changed = true;
            } else {
              next[id] = item;
            }
          });
          if (changed) set({ review: next });
        },
      };
    },
    {
      name: 'synth-studio-storage',
      version: STORE_VERSION,
      // Written at most every 600 ms (and on hide / close), not on every knob move
      storage: studioStorage,
      partialize: s => ({
        currentDevice: s.currentDevice,
        devices: s.devices,
        studio: s.studio,
        completedLessons: s.completedLessons,
        review: s.review,
        focusMode: s.focusMode,
        // A lesson that replaced the studio must never cost the learner their track, even after a reload
        lessonBackups: s.lessonBackups,
      }),
      migrate: (persisted, version) => {
        const old = (persisted ?? {}) as Record<string, unknown> & {
          deviceSettings?: Record<string, Record<string, ControlValue>>;
          devices?: Record<string, InstanceState>;
          studio?: StudioDoc;
        };
        let devices = old.devices ?? {};
        if ((version === 0 || version === 1) && old.deviceSettings) {
          devices = {};
          Object.entries(old.deviceSettings).forEach(([device, settings]) => {
            devices[device.toLowerCase()] = { controlValues: settings, patchConnections: [] };
          });
        }
        const currentDevice = (old.currentDevice as string) ?? 'dfam';
        const studio = old.studio ?? defaultStudio(currentDevice);
        // Controls whose meaning changed since this was saved keep sounding the same
        devices = upgradeDevices(devices, studio.rack ?? [], 'store', version);
        return {
          currentDevice,
          devices,
          studio,
          completedLessons: upgradeCompletedLessons((old.completedLessons as string[]) ?? [], version),
          review: (old.review as Record<string, ReviewItem>) ?? {},
          focusMode: (old.focusMode as boolean) ?? true,
          // Studios saved before lessons get the same upgrades, so bringing one back sounds as it did
          lessonBackups: Array.isArray(old.lessonBackups)
            ? (old.lessonBackups as LessonBackup[]).map(b => ({ ...b, devices: upgradeDevices(b.devices ?? {}, b.studio?.rack ?? [], 'store', version) }))
            : [],
        } as unknown as StudioStore;
      },
    },
  ),
);

/** Lesson check state for an instance (used by live checklists in the coach) */
export function buildCheckState(instance: string, engine?: Record<string, unknown>): LessonCheckState {
  const s = useStudioStore.getState();
  const valuesOf = (id: string) => ({ ...specDefaults(s.deviceOf(id)), ...(s.devices[id]?.controlValues ?? {}) });
  const instances: LessonCheckState['instances'] = {};
  s.studio.rack.forEach(r => {
    instances[r.id] = { device: r.device, values: valuesOf(r.id), patches: s.devices[r.id]?.patchConnections ?? [], data: s.devices[r.id]?.data };
  });
  const sess = s.isTeachingMode ? s.session[s.currentStep] : undefined;
  let eng = engine;
  if (!eng) {
    try { eng = engineReader?.(instance) ?? {}; } catch { eng = {}; }
  }
  return {
    values: valuesOf(instance),
    patches: s.devices[instance]?.patchConnections ?? [],
    data: s.devices[instance]?.data,
    engine: eng,
    instances,
    studioCables: s.studio.cables,
    routes: s.studio.routes,
    sync: s.studio.sync,
    transport: { playing: transport.playing, bpm: s.studio.bpm, swing: s.studio.swing ?? 0 },
    arrangement: s.studio.arrangement,
    events: sess?.events?.[instance] ?? {},
    notesPlayed: sess?.notes?.[instance] ?? [],
    eventsByInstance: sess?.events ?? {},
    ...studioCheckExtras(s.studio),
  };
}

/**
 * Review items due now, oldest first. Items Daily Review could never ask - match
 * results, or questions whose lesson is known to have changed - are left out, so the
 * badge never promises questions that aren't there. Items of devices whose lessons
 * haven't loaded yet still count; Daily Review settles them when it opens.
 */
export function dueReviewItems(review: Record<string, ReviewItem>, now = Date.now()) {
  return Object.entries(review)
    .filter(([id, r]) => r.due <= now && resolveReviewItem(id, r) !== null)
    .sort((a, b) => a[1].due - b[1].due);
}
