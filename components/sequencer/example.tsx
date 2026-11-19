// ============================================================================
// Reference integration for docs/ELEKTRON_SEQUENCER.md: an engine, the module
// hooks, layout elements and a lesson check, type-checked with the app so the
// guide can't drift from the API. Nothing imports it.
// ============================================================================
import { BaseEngine } from '@/lib/audio/engine';
import type { Transport } from '@/lib/audio/transport';
import type { ControlValue } from '@/types';
import type { DeviceModule } from '@/devices/types';
import type { CustomElement } from '@/types/panel';
import {
  ElektronSequencer, LOCK_LIMIT_RYTM, LockTracker, arrangerPatterns, asProject, displayWithLocks, interceptForLocks,
  projectData, trigSteps, type LockOptions, type TrigEvent,
} from '@/lib/sequencer/elektron';
import {
  ChainBuilder, MenuKey, PagePicker, PatternPicker, ScaleMenu, SongEditor, TransportKeys, TrigEditor, TrigKeys, TrigModeKey,
} from '@/components/sequencer';

const TRACKS = 12;

interface Voice {
  set(key: string, value: number, time: number): void;
  ramp(key: string, from: number, to: number, t0: number, t1: number): void;
  trigger(time: number, velocity: number, accent: boolean, note: number, duration: number, slide: boolean): void;
  release(time: number): void;
}

export class ExampleEngine extends BaseEngine {
  private seq!: ElektronSequencer;
  private locks = new LockTracker(TRACKS);
  private voices: Voice[] = [];

  protected build(): void {
    // ... build this.voices and the audio graph ...
    this.seq = new ElektronSequencer({
      ctx: this.ctx,
      tracks: TRACKS,
      bpm: this.num('tempo', 120),
      onTrig: e => this.trig(e),
      onNoteOff: (track, _note, time) => this.voices[track]?.release(time),
      // Stopped or paused: put locked parameters back to the kit values
      onPlay: playing => { if (!playing) this.locks.releaseAll((track, key) => this.voices[track]?.set(key, this.trackValue(track, key), this.ctx.currentTime)); },
    });
    // The UI kit reads engine.seq (playheads, cued pattern, fill, song row, paused, TEMP JUMP...)
    this.seq.subscribe(s => this.emit({ seq: s, playing: s.playing, step: s.steps[this.num('track')] }));
    this.onDispose(() => this.seq.dispose());
  }

  protected onData(data: unknown): void {
    // Track mutes (Project.mutes), the change mode and the patterns all arrive here
    this.seq.setProject(data);
  }

  protected onTransport(t: Transport | null): void {
    this.seq.follow(t);
  }

  protected onParam(id: string, value: ControlValue): void {
    if (id === 'play') {
      // The transport control: on = play from the top, off = stop (also ends a pause). PLAY while
      // playing arrives as 'seq:pause' / 'seq:resume' from the kit's pressPlay (TransportKeys), so the
      // control stays on while paused. Synced, the hub turns PLAY into the studio transport: never
      // start the internal clock then.
      if (!this.transport) value ? this.seq.start() : this.seq.stop();
      return;
    }
    if (id === 'tempo') this.seq.setTempo(Number(value));
    // ... sound parameters: skip the audio update while the playing trig locks it
    // if (this.locks.isLocked(track, key)) return;
  }

  event(name: string, payload?: unknown): void {
    // seq:fill(:up), seq:fill-latch, seq:fill-cue, seq:queue, seq:program, seq:temp-jump, seq:mute(s),
    // seq:solo, seq:song-row, seq:chain-index, seq:start / stop / pause / resume, seq:preview(:up),
    // seq:audition(:stop) and the arranger's arranger:pattern
    if (this.seq.handleEvent(name, payload)) return;
    // ... pads, other keys ...
  }

  private trackValue(_track: number, _key: string): number {
    return 0; // the kit / sound value of that parameter
  }

  private trig(e: TrigEvent): void {
    const v = this.voices[e.track];
    if (!v) return;
    // Locks hold for this trig only: the next trig on the track reverts what it doesn't lock itself
    this.locks.apply(
      e.track, e.locks,
      (key, value) => v.set(key, value, e.time),
      key => v.set(key, this.trackValue(e.track, key), e.time),
    );
    if (e.paramSlide && e.slideTo) {
      const to = e.slideTo;
      const keys = new Set([...Object.keys(e.locks), ...Object.keys(to.locks)]);
      keys.forEach(k => v.ramp(k, e.locks[k] ?? this.trackValue(e.track, k), to.locks[k] ?? this.trackValue(e.track, k), e.time, to.time));
    }
    if (e.trigless) return; // a lock trig only moves parameters
    v.trigger(e.time, e.velocity / 127, e.accent, e.note, e.duration, e.slide);
  }
}

const LOCKS: LockOptions = {
  // Control ids like 't3_filter_freq' (one control per parameter and track); the TRIG page has t3_trig_note...
  lockKey: id => {
    const m = /^t\d+_(.+)$/.exec(id);
    if (!m) return null;
    const k = m[1];
    if (k === 'trig_note') return 'note';
    if (k === 'trig_vel') return 'vel';
    if (k === 'trig_len') return 'len';
    if (k === 'trig_cond') return 'cond';
    if (k === 'trig_prob') return 'prob';
    return k;
  },
  trackOf: id => { const m = /^t(\d+)_/.exec(id); return m ? Number(m[1]) - 1 : null; },
  currentTrack: values => Number(values.track) || 0,
  currentPattern: data => asProject(data, TRACKS).active,
  trackDefaults: true,
  tracks: TRACKS,
  // The Rytm locks 72 different parameters per pattern, the Analog Four 128 (LOCK_LIMIT_A4)
  lockLimit: LOCK_LIMIT_RYTM,
};

export const exampleModule: Pick<DeviceModule, 'data' | 'interceptChange' | 'displayValues' | 'studio' | 'transportControl' | 'audition'> = {
  data: projectData({ tracks: TRACKS, defaults: { note: 60, vel: 100 } }),
  interceptChange: (id, value, api) => interceptForLocks(id, value, api, LOCKS),
  displayValues: api => displayWithLocks(api, LOCKS),
  transportControl: 'play',
  studio: { midiSync: true, patterns: data => arrangerPatterns(data, TRACKS) },
  audition: api => {
    api.event('seq:audition');
    return () => api.event('seq:audition:stop');
  },
};

/** The trig-key modes behind [FUNC] + [BANK E-H] (and MUTE / solo), as kit keys */
const MODE_KEYS = [
  { mode: 'trigmute', label: 'TRIG MUTE' },
  { mode: 'accent', label: 'ACCENT' },
  { mode: 'swing', label: 'SWING' },
  { mode: 'pslide', label: 'P.SLIDE' },
  { mode: 'mute', label: 'MUTE' },
  { mode: 'solo', label: 'SOLO' },
] as const;

export const exampleElements: CustomElement[] = [
  // The 16 trig keys (x/y/w/h in mm, top-left), the page keys and the menu keys. Without a `mode` prop the
  // keys follow the mode keys below; mute mode edits the project's global track mutes, as on the hardware.
  // An Analog Four adds `stampDefaults` (new trigs copy the NOTE menu values) to TrigKeys and TrigEditor.
  { kind: 'custom', x: 40, y: 150, w: 300, h: 14, render: ctx => <TrigKeys ctx={ctx} tracks={TRACKS} muteTarget="project" /> },
  { kind: 'custom', x: 345, y: 150, w: 40, h: 8, render: ctx => <PagePicker ctx={ctx} tracks={TRACKS} /> },
  ...MODE_KEYS.map(({ mode, label }, i): CustomElement => ({
    kind: 'custom', x: 40 + i * 22, y: 138, w: 20, h: 8, render: ctx => <TrigModeKey ctx={ctx} mode={mode} label={label} />,
  })),
  { kind: 'custom', x: 10, y: 120, w: 18, h: 8, render: ctx => <MenuKey ctx={ctx} menu="pattern" label="PTN" /> },
  { kind: 'custom', x: 30, y: 120, w: 18, h: 8, render: ctx => <MenuKey ctx={ctx} menu="song" label="SONG" /> },
  { kind: 'custom', x: 50, y: 120, w: 18, h: 8, render: ctx => <MenuKey ctx={ctx} menu="scale" label="SCALE" /> },
  // PLAY (pauses while playing, resumes while paused) and STOP on the `play` transport control
  { kind: 'custom', x: 345, y: 120, w: 30, h: 10, render: ctx => <TransportKeys ctx={ctx} /> },
  // Overlays float over the page (portal), so this element's box can be tiny
  {
    kind: 'custom', x: 0, y: 0, w: 1, h: 1,
    render: ctx => (
      <>
        {/* Trig mute, retrigs, accent and parameter slides; the pattern's lock budget */}
        <TrigEditor ctx={ctx} tracks={TRACKS} portal features={{ retrig: true, accent: true, slide: false, pslide: true }} lockLimit={LOCK_LIMIT_RYTM} />
        {/* SAVE / RELOAD, UNDO for PASTE and CLEAR, TEMP JUMP arming */}
        <PatternPicker ctx={ctx} tracks={TRACKS} portal />
        <ChainBuilder ctx={ctx} tracks={TRACKS} portal />
        {/* Rows with chains of patterns, song mutes per pattern; hardware-style: no row tempo, length or loop */}
        <SongEditor ctx={ctx} tracks={TRACKS} portal tempo={false} length={false} loop={false} />
        {/* A longer length copies the existing pages (copyPages, on by default) */}
        <ScaleMenu ctx={ctx} tracks={TRACKS} portal />
      </>
    ),
  },
];

// A lesson check: four on the floor on track 1 of the selected pattern
export const fourOnTheFloor = (data: unknown) => {
  const p = asProject(data, TRACKS);
  return trigSteps(p, p.active, 0).join(',') === '0,4,8,12';
};
