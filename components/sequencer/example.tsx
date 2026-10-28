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
  ElektronSequencer, LockTracker, arrangerPatterns, asProject, displayWithLocks, interceptForLocks, projectData,
  trigSteps, type LockOptions, type TrigEvent,
} from '@/lib/sequencer/elektron';
import {
  ChainBuilder, MenuKey, PagePicker, PatternPicker, ScaleMenu, SongEditor, TrigEditor, TrigKeys,
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
    });
    // The UI kit reads engine.seq (playheads, cued pattern, fill, song row...)
    this.seq.subscribe(s => this.emit({ seq: s, playing: s.playing, step: s.steps[this.num('track')] }));
    this.onDispose(() => this.seq.dispose());
  }

  protected onData(data: unknown): void {
    this.seq.setProject(data);
  }

  protected onTransport(t: Transport | null): void {
    this.seq.follow(t);
  }

  protected onParam(id: string, value: ControlValue): void {
    if (id === 'play') {
      // While synced the hub turns PLAY into the studio transport: never start the internal clock then
      if (!this.transport) value ? this.seq.start() : this.seq.stop();
      return;
    }
    if (id === 'tempo') this.seq.setTempo(Number(value));
    // ... sound parameters: skip the audio update while the playing trig locks it
    // if (this.locks.isLocked(track, key)) return;
  }

  event(name: string, payload?: unknown): void {
    // seq:fill(:up), seq:fill-latch, seq:fill-cue, seq:queue, seq:mute, seq:song-row, seq:chain-index,
    // seq:preview(:up), seq:audition(:stop) and the arranger's arranger:pattern
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

export const exampleElements: CustomElement[] = [
  // The 16 trig keys (x/y/w/h in mm, top-left), the page keys and the menu keys
  { kind: 'custom', x: 40, y: 150, w: 300, h: 14, render: ctx => <TrigKeys ctx={ctx} tracks={TRACKS} /> },
  { kind: 'custom', x: 345, y: 150, w: 40, h: 8, render: ctx => <PagePicker ctx={ctx} tracks={TRACKS} /> },
  { kind: 'custom', x: 10, y: 120, w: 18, h: 8, render: ctx => <MenuKey ctx={ctx} menu="pattern" label="PTN" /> },
  { kind: 'custom', x: 30, y: 120, w: 18, h: 8, render: ctx => <MenuKey ctx={ctx} menu="song" label="SONG" /> },
  // Overlays float over the page (portal), so this element's box can be tiny
  {
    kind: 'custom', x: 0, y: 0, w: 1, h: 1,
    render: ctx => (
      <>
        <TrigEditor ctx={ctx} tracks={TRACKS} portal features={{ retrig: true, accent: true, slide: false }} />
        <PatternPicker ctx={ctx} tracks={TRACKS} portal />
        <ChainBuilder ctx={ctx} tracks={TRACKS} portal />
        <SongEditor ctx={ctx} tracks={TRACKS} portal />
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
