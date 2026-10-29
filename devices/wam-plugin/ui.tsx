'use client';

// Web Audio plugin panel widgets: status + actions, the plugin chooser (with the
// trust warning), the output meter and the overlay that holds the plugin's own
// window. Touch targets are at least 44 px at the panel's native size.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
import type { CustomRenderContext } from '@/types/panel';
import { DEVICES } from '@/devices';
import { hub } from '@/lib/studio/hub';
import { useStudioStore } from '@/store/studio';
import { BUILTIN_PLUGINS, KNOWN_PLUGINS, WAM_COMMUNITY_INDEX, findKnownPlugin, type KnownPlugin } from '@/lib/wam/plugins';
import { WamLoadError, normalizeWamUrl } from '@/lib/wam/host';
import { isBuiltin } from '@/lib/wam/builtin';
import { isTrusted, originOf, trustOrigin } from '@/lib/wam/trust';
import { asWamData } from './config';
import type { PluginStatus, WamPluginEngine } from './engine';

const ACCENT = '#a78bfa';

interface PluginInfo { name: string; vendor: string; description: string; isInstrument: boolean; hasAudioInput: boolean; hasMidiInput: boolean; builtin?: boolean }

const engineOf = (instance: string) => hub.getEngine(instance) as WamPluginEngine | undefined;
const lit = (ctx: CustomRenderContext, id: string) => !!ctx.step?.focus?.includes(id);
const glow = (on: boolean) => (on ? { boxShadow: '0 0 0 3px #facc15, 0 0 18px rgba(250,204,21,0.6)' } : undefined);

function defaultRackName(instance: string) {
  const base = DEVICES.find(d => d.id === 'wam-plugin')?.name ?? 'Web Audio plugin';
  return instance.includes('#') ? `${base} ${instance.split('#')[1]}` : base;
}

/** Name the rack tab (and the routing menus) after the loaded plugin */
function useRackLabel(instance: string, name: string | null) {
  const current = useStudioStore(s => s.studio.rack.find(r => r.id === instance)?.label);
  const wanted = name ?? defaultRackName(instance);
  useEffect(() => {
    const st = useStudioStore.getState();
    const slot = st.studio.rack.find(r => r.id === instance);
    if (!slot) return;
    if ((slot.label ?? defaultRackName(instance)) !== wanted) st.renameInstance(instance, wanted);
  }, [instance, wanted, current]);
}

export function PluginHeader(ctx: CustomRenderContext) {
  const data = asWamData(ctx.data);
  // Engine state arrives a frame later: until it is about the current URL, we are loading
  const engineUrl = ctx.engine.url as string | null | undefined;
  const current = ctx.engine.status !== undefined && (engineUrl === undefined || engineUrl === data.url);
  const status = current ? (ctx.engine.status as PluginStatus) : data.url ? 'loading' : 'empty';
  const plugin = ctx.engine.plugin as PluginInfo | null | undefined;
  const error = ctx.engine.error as string | null | undefined;
  const [chooser, setChooser] = useState(false);
  const [windowOpen, setWindowOpen] = useState(false);

  const title = plugin?.name ?? data.name ?? (data.url ? 'Plugin' : 'No plugin loaded');
  const known = findKnownPlugin(data.url);
  useRackLabel(ctx.instance, data.url ? plugin?.name ?? data.name : null);
  const effectLike = status !== 'ready' || !plugin?.isInstrument;

  return (
    <div className="w-full h-full flex flex-col gap-1 rounded px-2 py-1.5" style={{ background: 'rgba(0,0,0,0.38)', border: '1px solid #3a3150', color: '#ece8f7' }}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-bold truncate" style={{ fontSize: 17 }}>{title}</span>
            {plugin?.vendor && <span className="truncate" style={{ fontSize: 10, color: '#a99fc4' }}>{plugin.vendor}</span>}
            {known?.builtin && <span className="shrink-0 rounded px-1" style={{ fontSize: 9, color: '#86efac', border: '1px solid #166534' }} title="Ships with Synth Studio: works offline, nothing to trust">built in</span>}
            {known && !known.verified && (
              <span className="shrink-0 rounded px-1" style={{ fontSize: 9, color: '#fcd34d', border: '1px solid #6b5a1e' }} title="Not loaded from this URL during testing - see the plugin list">unverified</span>
            )}
          </div>
          <StatusLine status={status} error={error} plugin={plugin} origin={ctx.engine.origin as string | undefined} url={data.url} />
        </div>
        {status === 'untrusted' && data.url && (
          <HeaderButton accent onClick={() => { trustOrigin(data.url!); ctx.sendEvent('load'); }}>Trust &amp; load</HeaderButton>
        )}
        {status === 'error' && <HeaderButton onClick={() => ctx.sendEvent('load')}>Retry</HeaderButton>}
        {effectLike && status !== 'untrusted' && (
          <HeaderButton onClick={() => ctx.sendEvent('test-sound')} title="Play a short groove into IN, so you can hear an effect with nothing patched" style={glow(lit(ctx, 'test-sound'))}>
            {ctx.engine.testing ? '■ Stop test' : '▶ Test sound'}
          </HeaderButton>
        )}
        {status === 'ready' && <HeaderButton accent onClick={() => setWindowOpen(true)} style={glow(lit(ctx, 'window'))}>Open plugin window</HeaderButton>}
        <HeaderButton accent={status === 'empty'} onClick={() => setChooser(true)} style={glow(lit(ctx, 'choose'))}>{data.url ? 'Change…' : 'Choose plugin…'}</HeaderButton>
      </div>
      {chooser && (
        <PluginChooser
          current={data.url}
          onClose={() => setChooser(false)}
          onChoose={(url, name) => {
            ctx.updateData(() => ({ v: 1, url, name }));
            setChooser(false);
          }}
          onRemove={() => { ctx.updateData(() => ({ v: 1, url: null, name: null })); setChooser(false); }}
        />
      )}
      {windowOpen && (
        <PluginWindow
          instance={ctx.instance}
          title={title}
          builtin={!!plugin?.builtin}
          onClose={async () => {
            setWindowOpen(false);
            // Keep knob changes made in the plugin's window with the project
            const state = await engineOf(ctx.instance)?.saveState();
            if (state !== undefined) ctx.updateData(d => ({ ...asWamData(d), state }));
          }}
        />
      )}
    </div>
  );
}

function StatusLine({ status, error, plugin, origin, url }: { status: PluginStatus; error?: string | null; plugin?: PluginInfo | null; origin?: string; url: string | null }) {
  const style = { fontSize: 11 };
  switch (status) {
    case 'empty':
      return <div style={{ ...style, color: '#a99fc4' }}>Load a plugin: a synth to play from the keys, or an effect for the IN jack. Two built-in ones work offline.</div>;
    case 'loading':
      return <div style={{ ...style, color: '#c4b5fd' }}>Loading {url && !isBuiltin(url) ? originOf(url).replace(/^https?:\/\//, '') : ''}…</div>;
    case 'untrusted':
      return (
        <div style={{ ...style, color: '#fcd34d' }} className="leading-snug">
          This project uses a plugin from <b>{origin?.replace(/^https?:\/\//, '')}</b>. Plugins run their own code inside this page - load it only if you trust that site.
        </div>
      );
    case 'error':
      return <div style={{ ...style, color: '#fca5a5' }} className="leading-snug">{error ?? 'The plugin failed to load.'}</div>;
    case 'ready':
      return (
        <div style={{ ...style, color: '#c9c2df' }} className="line-clamp-2 leading-snug">
          {plugin?.isInstrument ? 'Instrument' : 'Effect'}
          {plugin?.hasMidiInput ? ' · plays from the keys and MIDI input' : ''}
          {plugin?.hasAudioInput ? ' · patch audio into IN' : ''}
          {plugin?.description ? ` · ${plugin.description}` : ''}
        </div>
      );
  }
}

function HeaderButton({ children, onClick, accent, title, style }: { children: React.ReactNode; onClick: () => void; accent?: boolean; title?: string; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="shrink-0 rounded font-bold whitespace-nowrap"
      style={{ fontSize: 13, minHeight: 46, padding: '0 14px', color: accent ? '#160f2a' : '#ece8f7', background: accent ? ACCENT : '#2a2440', border: `1px solid ${accent ? ACCENT : '#4b4170'}`, ...style }}
    >
      {children}
    </button>
  );
}

/** Output level of the plugin (after LEVEL). Polls without re-rendering React. */
export function PluginMeter({ instance }: { instance: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let held = 0;
    const tick = () => {
      const v = engineOf(instance)?.levels() ?? 0;
      held = Math.max(v, held * 0.9);
      const db = held > 0 ? 20 * Math.log10(held) : -96;
      if (bar.current) {
        // transform and colour only: no layout work per frame (iPad)
        bar.current.style.transform = `scaleY(${Math.max(0, Math.min(1, (db + 60) / 60)).toFixed(4)})`;
        const c = db > -1 ? '#ef4444' : db > -6 ? '#eab308' : '#a78bfa';
        if (bar.current.dataset.colour !== c) { bar.current.dataset.colour = c; bar.current.style.background = c; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [instance]);
  return (
    <div className="w-full h-full flex flex-col items-center gap-0.5 select-none" aria-label="Plugin output level" role="img">
      <div className="relative flex-1 w-full rounded-sm overflow-hidden" style={{ background: '#0c0a12', border: '1px solid #3a3150' }}>
        <div ref={bar} className="absolute inset-0" style={{ transform: 'scaleY(0)', transformOrigin: 'center bottom', willChange: 'transform' }} data-plugin-meter />
      </div>
      <span className="font-bold" style={{ fontSize: 8, color: '#a99fc4' }}>OUT</span>
    </div>
  );
}

export function PluginMeterBox(ctx: CustomRenderContext) {
  return <PluginMeter instance={ctx.instance} />;
}

// ----------------------------------------------------------------------------
// Chooser: known plugins, a URL field and the trust warning
// ----------------------------------------------------------------------------

function PluginChooser({ current, onChoose, onClose, onRemove }: {
  current: string | null;
  onChoose: (url: string, name: string | null) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState(current ?? '');
  const [name, setName] = useState<string | null>(findKnownPlugin(current)?.name ?? null);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let origin = '';
  let urlError: string | null = null;
  const builtin = isBuiltin(url.trim());
  if (!builtin) {
    try { origin = url.trim() ? originOf(normalizeWamUrl(url)) : ''; } catch (e) { urlError = e instanceof Error ? e.message : String(e); }
  }
  const alreadyTrusted = builtin || (!!origin && isTrusted(origin));

  const pick = (k: KnownPlugin) => { setUrl(k.url); setName(k.name); setError(null); };
  const load = () => {
    if (builtin) { onChoose(url.trim(), findKnownPlugin(url.trim())?.name ?? name); return; }
    try {
      const u = normalizeWamUrl(url);
      if (!alreadyTrusted && !agree) { setError('Tick the box to confirm you trust this site.'); return; }
      trustOrigin(u);
      onChoose(u, findKnownPlugin(u)?.name ?? name);
    } catch (e) {
      setError(e instanceof WamLoadError ? e.message : String(e));
    }
  };

  const group = (kind: KnownPlugin['kind']) => KNOWN_PLUGINS.filter(k => k.kind === kind);

  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-4 sm:p-5 w-[calc(100%-1.5rem)] max-w-2xl shadow-2xl z-50 max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh] overflow-y-auto text-white"
          aria-describedby="wam-chooser-desc"
        >
          <Dialog.Title className="text-lg font-bold">Web Audio plugin</Dialog.Title>
          <p id="wam-chooser-desc" className="text-xs text-hardware-label mb-3">
            WAM 2 plugins are instruments and effects that run in the browser. Pick one, or paste the URL of any plugin&apos;s <code>index.js</code>.
          </p>

          <div className="mb-3">
            <h4 className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Built in · work offline, nothing to trust</h4>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {BUILTIN_PLUGINS.map(k => (
                <button
                  key={k.url}
                  onClick={() => pick(k)}
                  className={`text-left px-2.5 py-2 min-h-[44px] rounded border ${url === k.url ? 'border-violet-400 bg-violet-950/50' : 'border-[#3a3a3a] bg-[#1d1d1d] hover:bg-[#262626]'}`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="font-bold text-sm">{k.name}</span>
                    <span className="text-[10px] text-gray-500">{k.kind}</span>
                    <span className="ml-auto text-[9px] text-green-300 border border-green-800 rounded px-1">built in</span>
                  </span>
                  <span className="block text-[11px] text-gray-400 leading-snug">{k.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded border border-amber-700/70 bg-amber-950/40 p-3 mb-4 text-xs text-amber-100 leading-relaxed" role="note">
            <b className="text-amber-300">Only load plugins you trust.</b> A plugin from the web is JavaScript from another website. It runs inside this page with the same
            access as Synth Studio itself: it can read your projects in this browser, use the network, and make any sound. Synth Studio cannot sandbox it.
          </div>

          {(['instrument', 'effect'] as const).map(kind => (
            <div key={kind} className="mb-3">
              <h4 className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{kind === 'instrument' ? 'Instruments from the web' : 'Effects from the web'}</h4>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {group(kind).map(k => (
                  <button
                    key={k.url}
                    onClick={() => pick(k)}
                    className={`text-left px-2.5 py-2 min-h-[44px] rounded border ${url === k.url ? 'border-violet-400 bg-violet-950/50' : 'border-[#3a3a3a] bg-[#1d1d1d] hover:bg-[#262626]'}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="font-bold text-sm">{k.name}</span>
                      <span className="text-[10px] text-gray-500">{k.vendor}</span>
                      {!k.verified && (
                        <span
                          className="ml-auto text-[9px] text-amber-300 border border-amber-800 rounded px-1"
                          title={k.testedCopy
                            ? 'Not loaded from this URL during testing (the network was limited); the same files from the wam-community npm package loaded fine in this host.'
                            : 'Not loaded from this URL during testing (the network was limited to GitHub and npm).'}
                        >
                          unverified
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-gray-400 leading-snug">{k.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-gray-500 mb-3">
            From the <a className="underline" href="https://github.com/boourns/wam-community" target="_blank" rel="noopener noreferrer">wam-community</a> collection
            hosted at webaudiomodules.com (<a className="underline" href={WAM_COMMUNITY_INDEX} target="_blank" rel="noopener noreferrer">full list</a>).
            &quot;Unverified&quot;: this list was built where that site could not be reached, so a plugin may have moved.
          </p>

          <label className="block text-xs text-gray-300 mb-1" htmlFor="wam-url">Plugin URL</label>
          <input
            id="wam-url"
            value={url}
            onChange={e => { setUrl(e.target.value); setName(null); setError(null); }}
            placeholder="https://example.com/my-plugin/index.js"
            className="w-full bg-[#141414] border border-[#3a3a3a] rounded px-2 min-h-[44px] text-sm text-white font-mono mb-2"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          {builtin && <p className="text-[11px] text-green-300 mb-2">Built into Synth Studio: it loads instantly, with no network and no third-party code.</p>}
          {origin && !alreadyTrusted && (
            <label className="flex items-start gap-2.5 text-xs text-gray-200 mb-2 min-h-[44px]">
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5 w-5 h-5 accent-violet-400 shrink-0" />
              <span>I trust <b>{origin.replace(/^https?:\/\//, '')}</b> and want to run its code in Synth Studio.</span>
            </label>
          )}
          {origin && alreadyTrusted && !builtin && <p className="text-[11px] text-gray-400 mb-2">You trusted {origin.replace(/^https?:\/\//, '')} before.</p>}
          {urlError && <p className="text-xs text-amber-300 mb-2">{urlError}</p>}
          {error && <p className="text-xs text-red-300 mb-2">{error}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#3a3a3a]">
            {current && <button onClick={onRemove} className="px-3 min-h-[44px] rounded bg-[#3a2323] text-red-200 text-sm">Remove plugin</button>}
            <span className="flex-1" />
            <Dialog.Close asChild><button className="px-4 min-h-[44px] bg-[#3a3a3a] rounded text-sm">Cancel</button></Dialog.Close>
            <button
              onClick={load}
              disabled={!url.trim() || !!urlError || (!alreadyTrusted && !agree)}
              className="px-4 min-h-[44px] rounded bg-violet-400 text-black font-bold text-sm disabled:opacity-40"
            >
              Load plugin
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ----------------------------------------------------------------------------
// The plugin's own window, in an overlay
// ----------------------------------------------------------------------------

function PluginWindow({ instance, title, onClose, builtin }: { instance: string; title: string; onClose: () => void; builtin?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const engine = engineOf(instance);
    const el = host.current;
    if (!engine || !el) { setError('The plugin is not running.'); setLoading(false); return; }
    let alive = true;
    engine.openGui(el)
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; engine.closeGui(); };
  }, [instance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`${title} plugin window`} className="bg-[#17141f] border-2 border-[#3a3150] rounded-lg shadow-2xl flex flex-col max-w-full max-h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3a3150]">
          <span className="font-bold text-white text-sm truncate">{title}</span>
          <span className="text-[10px] text-gray-500">plugin window · {builtin ? 'built in' : 'third-party code'} · its settings are saved with the project when you close it</span>
          <button onClick={onClose} className="ml-auto px-4 min-h-[44px] rounded bg-[#2a2440] text-white text-sm" aria-label="Close plugin window">Close ✕</button>
        </div>
        <div className="overflow-auto p-2 min-w-[260px] min-h-[120px]" style={{ background: '#0e0c14' }}>
          {loading && <p className="text-xs text-gray-400 p-2">Opening…</p>}
          {error && <p className="text-xs text-red-300 p-2">{error}</p>}
          <div ref={host} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
