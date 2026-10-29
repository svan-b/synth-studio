// ============================================================================
// Web Audio Modules (WAM 2) host.
//
//   initWamHost(ctx)      once per AudioContext: @webaudiomodules/sdk's
//                         initializeWamHost puts WamEnv + a host WamGroup in the
//                         AudioWorklet and returns the group id plugins join
//   loadWam(url, ctx)     validate the URL, check it is reachable and served as
//                         JavaScript (for clear errors), import() the plugin's ES
//                         module, WAM.createInstance(groupId, ctx) -> audioNode
//   wamMidi(bytes, time)  a 'wam-midi' event for audioNode.scheduleEvents()
//
// Every failure becomes a WamLoadError with a message written for musicians.
// A plugin is third-party code running inside this page: the UI asks for trust
// first (lib/wam/trust.ts).
// ============================================================================

import type { WamEvent, WamNode, WamTransportData, WebAudioModule } from '@webaudiomodules/api';

export type WamErrorKind = 'invalid-url' | 'unreachable' | 'http' | 'not-javascript' | 'not-wam' | 'init-failed' | 'timeout' | 'host-failed';

export class WamLoadError extends Error {
  constructor(public kind: WamErrorKind, message: string) {
    super(message);
    this.name = 'WamLoadError';
  }
}

interface WamConstructor {
  isWebAudioModuleConstructor?: boolean;
  createInstance(groupId: string, audioContext: BaseAudioContext, initialState?: unknown): Promise<WebAudioModule>;
}

export interface LoadedWam {
  url: string;
  instance: WebAudioModule;
  node: WamNode;
  /** Where audio goes in / comes out when that is not `node` itself (built-in plugins) */
  input?: AudioNode;
  output?: AudioNode;
  name: string;
  vendor: string;
  description: string;
  isInstrument: boolean;
  hasAudioInput: boolean;
  hasMidiInput: boolean;
  /** Ships with Synth Studio (lib/wam/builtin.ts): no network, nothing to trust */
  builtin?: boolean;
}

const hostGroups = new WeakMap<BaseAudioContext, Promise<string>>();

/** Set up the WAM environment in this context's AudioWorklet (once). Resolves the host group id. */
export function initWamHost(ctx: BaseAudioContext): Promise<string> {
  let p = hostGroups.get(ctx);
  if (!p) {
    p = import('@webaudiomodules/sdk')
      .then(sdk => sdk.initializeWamHost(ctx))
      .then(([groupId]) => groupId)
      .catch(e => {
        hostGroups.delete(ctx);
        throw new WamLoadError('host-failed', `The plugin host could not start in this browser (${errText(e)}). It needs AudioWorklet support.`);
      });
    hostGroups.set(ctx, p);
  }
  return p;
}

/** Normalise what people paste: a folder URL gets index.js; only http(s) */
export function normalizeWamUrl(raw: string, base?: string): string {
  const s = raw.trim();
  if (!s) throw new WamLoadError('invalid-url', 'Enter the URL of the plugin\'s index.js.');
  let u: URL;
  try {
    u = new URL(s, base ?? (typeof location !== 'undefined' ? location.href : undefined));
  } catch {
    throw new WamLoadError('invalid-url', `"${s}" is not a valid URL.`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new WamLoadError('invalid-url', 'Plugin URLs must start with https:// (or http:// for a local server).');
  }
  if (u.pathname.endsWith('/')) u.pathname += 'index.js';
  return u.href;
}

function errText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new WamLoadError('timeout', `${what} took longer than ${Math.round(ms / 1000)} s - the server may be down or very slow.`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

/** The browser's own import() - webpack must not try to bundle a URL known only at runtime */
const importModule = (url: string): Promise<Record<string, unknown>> => import(/* webpackIgnore: true */ url);

/** Fetch first so a failure says *why* (import() only says "failed") */
async function preflight(url: string, timeoutMs: number) {
  let res: Response;
  try {
    res = await withTimeout(fetch(url, { mode: 'cors', credentials: 'omit' }), timeoutMs, 'Reaching the plugin');
  } catch (e) {
    if (e instanceof WamLoadError) throw e;
    const insecure = typeof location !== 'undefined' && location.protocol === 'https:' && url.startsWith('http:');
    throw new WamLoadError('unreachable', insecure
      ? 'The browser blocked this http:// plugin on an https:// page (mixed content). Use an https:// URL.'
      : `Could not reach ${new URL(url).host}. Check the URL and your connection - or the server does not allow other sites to load it (CORS).`);
  }
  if (!res.ok) {
    throw new WamLoadError('http', res.status === 404
      ? `Nothing found at that URL (404). A WAM plugin URL usually ends in /index.js.`
      : `The server answered ${res.status} ${res.statusText}.`);
  }
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  if (type && !/javascript|ecmascript/.test(type)) {
    const mime = type.split(';')[0].trim();
    throw new WamLoadError('not-javascript', mime.includes('html')
      ? 'That URL is a web page, not a plugin. Use the plugin\'s index.js URL.'
      : mime === 'text/plain'
        ? 'The server sends the plugin as plain text, and browsers only run modules sent as JavaScript (raw.githubusercontent.com does this - host it on GitHub Pages or any static host instead).'
        : `That URL is not JavaScript (it is ${mime}).`);
  }
}

export interface LoadOptions {
  state?: unknown;
  timeoutMs?: number;
  /** Skip the reachability check (tests) */
  skipPreflight?: boolean;
}

/** Load a WAM 2 plugin and create one instance in `ctx` */
export async function loadWam(rawUrl: string, ctx: BaseAudioContext, opts: LoadOptions = {}): Promise<LoadedWam> {
  const url = normalizeWamUrl(rawUrl);
  const timeoutMs = opts.timeoutMs ?? 20000;
  const groupId = await withTimeout(initWamHost(ctx), timeoutMs, 'Starting the plugin host');
  if (!opts.skipPreflight) await preflight(url, timeoutMs);

  let mod: Record<string, unknown>;
  try {
    mod = await withTimeout(importModule(url), timeoutMs, 'Loading the plugin');
  } catch (e) {
    if (e instanceof WamLoadError) throw e;
    throw new WamLoadError('not-wam', `The plugin's code failed to load: ${errText(e)}`);
  }
  const WAM = mod.default as WamConstructor | undefined;
  if (!WAM || typeof WAM.createInstance !== 'function') {
    throw new WamLoadError('not-wam', 'That file is JavaScript but not a Web Audio Module (no default export with createInstance). Is it a WAM 2 plugin?');
  }
  let instance: WebAudioModule;
  try {
    instance = await withTimeout(WAM.createInstance(groupId, ctx), timeoutMs, 'Starting the plugin');
  } catch (e) {
    if (e instanceof WamLoadError) throw e;
    throw new WamLoadError('init-failed', `The plugin failed to start: ${errText(e)}`);
  }
  const node = instance?.audioNode as WamNode | undefined;
  if (!node || typeof node.connect !== 'function') {
    throw new WamLoadError('init-failed', 'The plugin started but has no audio node.');
  }
  if (opts.state !== undefined && opts.state !== null) {
    try { await node.setState(opts.state); } catch { /* an older state the plugin no longer understands */ }
  }
  const d = instance.descriptor ?? ({} as WebAudioModule['descriptor']);
  return {
    url,
    instance,
    node,
    name: d.name || instance.name || 'Plugin',
    vendor: d.vendor || instance.vendor || '',
    description: d.description || '',
    isInstrument: !!d.isInstrument,
    // Trust the node over the descriptor: the SDK's default descriptor claims an audio input
    hasAudioInput: d.hasAudioInput !== false && (node.numberOfInputs ?? 1) > 0,
    hasMidiInput: d.hasMidiInput !== false,
  };
}

/** Free a plugin instance */
export function destroyWam(w: LoadedWam) {
  try { w.node.disconnect(); } catch { /* */ }
  try { w.output?.disconnect(); } catch { /* */ }
  try { w.node.destroy?.(); } catch { /* */ }
}

/** A MIDI message as a WAM event ('wam-midi' carries exactly three bytes) */
export function wamMidi(bytes: ArrayLike<number>, time: number): WamEvent {
  return { type: 'wam-midi', time, data: { bytes: [bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0] } };
}

/** Studio tempo/play state for tempo-synced plugins */
export function wamTransport(data: WamTransportData, time: number): WamEvent {
  return { type: 'wam-transport', time, data };
}
