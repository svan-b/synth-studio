// ============================================================================
// Web MIDI service - one MIDIAccess for the whole app.
//
//   - access is requested from a button (request()), never on page load;
//     autoConnect() only reconnects when the browser says MIDI is *already*
//     granted, so it can never pop a prompt
//   - port lists with hot-plug (statechange)
//   - only enabled inputs are opened: on Windows a MIDI port can be open in one
//     app at a time, so ports you switch off are released for your DAW
//   - send(port, bytes, timestamp) with timestamps in performance.now() time
//   - virtual outputs (the built-in Practice synth) are listed and resolved
//     like real ports - also where there is no Web MIDI at all (iPad, Safari)
// ============================================================================

import { midiSupport, type MidiSupport } from './support';
import type { PortRef } from '@/store/midi';

export type MidiStatus = 'unsupported' | 'idle' | 'requesting' | 'ready' | 'denied' | 'error';

export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
  state: 'connected' | 'disconnected';
  /** Inputs: whether we are listening to it */
  open: boolean;
  /** Built into Synth Studio (no hardware, works without Web MIDI) */
  virtual?: boolean;
}

export interface MidiSnapshot {
  status: MidiStatus;
  error: string | null;
  support: MidiSupport;
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
}

export interface IncomingMidi {
  port: MidiPortInfo;
  data: Uint8Array;
  /** performance.now() time base */
  timeStamp: number;
}

type Listener = () => void;
type MessageListener = (m: IncomingMidi) => void;

/** The bits of MIDIOutput we use (lets tests and the WAM host pass fakes) */
export interface MidiOutputLike {
  id: string;
  name: string | null;
  state?: string;
  send(data: number[] | Uint8Array, timestamp?: number): void;
}

const byName = (a: MidiPortInfo, b: MidiPortInfo) => a.name.localeCompare(b.name);

/** A port that lives inside Synth Studio (Practice synth) */
export interface VirtualOutput extends MidiOutputLike {
  manufacturer?: string;
}

export class MidiService {
  private access: MIDIAccess | null = null;
  private listeners = new Set<Listener>();
  private messageListeners = new Set<MessageListener>();
  private requesting: Promise<boolean> | null = null;
  private attached = new Map<string, MIDIInput>();
  private inputAllowed: (name: string) => boolean = () => true;
  private grantedListeners = new Set<() => void>();
  private virtual = new Map<string, VirtualOutput>();
  private snap: MidiSnapshot;

  constructor() {
    const support = midiSupport();
    this.snap = { status: support.supported ? 'idle' : 'unsupported', error: null, support, inputs: [], outputs: [] };
  }

  getSnapshot = (): MidiSnapshot => this.snap;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  onMessage(l: MessageListener): () => void {
    this.messageListeners.add(l);
    return () => this.messageListeners.delete(l);
  }

  /** Called after access is granted (used to remember it for autoConnect) */
  onGranted(l: () => void): () => void {
    this.grantedListeners.add(l);
    return () => this.grantedListeners.delete(l);
  }

  get ready() {
    return this.snap.status === 'ready';
  }

  /** List a built-in output next to the real ones (works without Web MIDI) */
  addVirtualOutput(out: VirtualOutput) {
    this.virtual.set(out.id, out);
    if (this.access) this.refresh();
    else this.set({ outputs: this.virtualInfos() });
  }

  private virtualInfos(): MidiPortInfo[] {
    return [...this.virtual.values()].map(v => ({
      id: v.id, name: v.name ?? v.id, manufacturer: v.manufacturer ?? '', type: 'output', state: 'connected', open: true, virtual: true,
    }));
  }

  /** Real (hardware) ports only */
  realOutputs(): MidiPortInfo[] {
    return this.snap.outputs.filter(o => !o.virtual);
  }

  /** Ask for MIDI access. Call from a user gesture (button). Resolves true when granted. */
  request(): Promise<boolean> {
    if (this.access) return Promise.resolve(true);
    if (this.requesting) return this.requesting;
    if (!this.snap.support.supported) {
      // Support may change (e.g. a polyfill installed after load) - re-check once
      const support = midiSupport();
      this.snap = { ...this.snap, support, status: support.supported ? 'idle' : 'unsupported' };
      if (!support.supported) { this.emit(); return Promise.resolve(false); }
    }
    this.set({ status: 'requesting', error: null });
    this.requesting = (async () => {
      try {
        const access = await navigator.requestMIDIAccess({ sysex: false });
        this.access = access;
        access.onstatechange = () => this.refresh();
        this.refresh('ready');
        this.grantedListeners.forEach(l => { try { l(); } catch { /* */ } });
        return true;
      } catch (e) {
        const name = (e as { name?: string })?.name ?? '';
        const denied = name === 'SecurityError' || name === 'NotAllowedError' || name === 'AbortError';
        this.set({
          status: denied ? 'denied' : 'error',
          error: denied
            ? 'MIDI access was blocked. Allow MIDI for this site in the browser\'s site settings (the icon left of the address), then try again.'
            : `Could not open MIDI: ${e instanceof Error ? e.message : String(e)}`,
        });
        return false;
      } finally {
        this.requesting = null;
      }
    })();
    return this.requesting;
  }

  /** Reconnect silently if MIDI is already granted for this site. Never prompts. */
  async autoConnect(): Promise<boolean> {
    if (!this.snap.support.supported || this.access) return !!this.access;
    try {
      const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
      if (!perms?.query) return false;
      const st = await perms.query({ name: 'midi' as PermissionName });
      if (st.state !== 'granted') return false;
    } catch {
      return false; // browser can't tell us - wait for the button
    }
    return this.request();
  }

  /** Which inputs to open (by name). Re-applied immediately. */
  setInputFilter(fn: (name: string) => boolean) {
    this.inputAllowed = fn;
    if (this.access) this.refresh();
  }

  /** Find an output by id, then by name */
  findOutput(ref: PortRef | string | null | undefined): MidiOutputLike | null {
    if (!ref) return null;
    const id = typeof ref === 'string' ? ref : ref.id;
    const name = typeof ref === 'string' ? ref : ref.name;
    const v = this.virtual.get(id) ?? [...this.virtual.values()].find(x => !!name && x.name === name);
    if (v) return v;
    if (!this.access) return null;
    let found: MIDIOutput | null = null;
    this.access.outputs.forEach(o => { if (!found && o.id === id && o.state !== 'disconnected') found = o; });
    if (!found && name) this.access.outputs.forEach(o => { if (!found && o.name === name && o.state !== 'disconnected') found = o; });
    return found;
  }

  /** Send to an output. `timestamp` is in performance.now() time (omit = now). */
  send(ref: PortRef | string | MidiOutputLike | null | undefined, data: number[] | Uint8Array, timestamp?: number): boolean {
    const out = ref && typeof ref === 'object' && 'send' in ref ? ref : this.findOutput(ref as PortRef | string | null);
    if (!out) return false;
    try {
      if (timestamp !== undefined && timestamp > performance.now()) out.send(data, timestamp);
      else out.send(data);
      return true;
    } catch {
      return false; // port vanished mid-send, or an invalid message
    }
  }

  private refresh(status?: MidiStatus) {
    const access = this.access;
    if (!access) return;
    const inputs: MidiPortInfo[] = [];
    const outputs: MidiPortInfo[] = [];
    const seen = new Set<string>();
    access.inputs.forEach(input => {
      const name = input.name ?? input.id;
      const want = input.state !== 'disconnected' && this.inputAllowed(name);
      seen.add(input.id);
      const attached = this.attached.get(input.id);
      if (want && attached !== input) {
        input.onmidimessage = e => this.dispatch(input, e);
        this.attached.set(input.id, input);
      } else if (!want && attached) {
        attached.onmidimessage = null;
        try { void attached.close(); } catch { /* */ }
        this.attached.delete(input.id);
      }
      inputs.push(info(input, 'input', want));
    });
    // Inputs that disappeared entirely
    this.attached.forEach((input, id) => {
      if (!seen.has(id)) {
        input.onmidimessage = null;
        this.attached.delete(id);
      }
    });
    access.outputs.forEach(output => outputs.push(info(output, 'output', output.connection === 'open')));
    inputs.sort(byName);
    outputs.sort(byName);
    this.set({ status: status ?? this.snap.status, inputs, outputs: [...outputs, ...this.virtualInfos()] });
  }

  private dispatch(input: MIDIInput, e: MIDIMessageEvent) {
    const data = e.data;
    if (!data || !data.length) return;
    const msg: IncomingMidi = { port: info(input, 'input', true), data, timeStamp: e.timeStamp || performance.now() };
    this.messageListeners.forEach(l => {
      try { l(msg); } catch (err) { console.warn('[midi] listener failed', err); }
    });
  }

  private set(patch: Partial<MidiSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.emit();
  }

  private emit() {
    this.listeners.forEach(l => l());
  }
}

function info(p: MIDIPort, type: 'input' | 'output', open: boolean): MidiPortInfo {
  return {
    id: p.id,
    name: p.name ?? p.id,
    manufacturer: p.manufacturer ?? '',
    type,
    state: p.state === 'disconnected' ? 'disconnected' : 'connected',
    open,
  };
}

/** The app-wide MIDI service */
export const midi = new MidiService();
