// ============================================================================
// Which plugin sites this browser has agreed to run code from.
//
// A WAM plugin is JavaScript from another site running inside this page. A
// project file (or a shared studio) can name any plugin URL, so plugins only
// load automatically from sites you trusted here before; anything else waits
// for you to say yes. Trust is per site (origin) and per browser.
// ============================================================================

const KEY = 'synth-studio-wam-trusted';
/** Used when localStorage is unavailable (private mode): trust lasts this visit */
const sessionTrust = new Set<string>();

export function originOf(url: string): string {
  try { return new URL(url).origin; } catch { return url; }
}

function stored(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function isTrusted(url: string): boolean {
  if (typeof window === 'undefined') return false;
  const o = originOf(url);
  // Plugins served by Synth Studio itself
  if (o === window.location.origin) return true;
  return sessionTrust.has(o) || stored().includes(o);
}

export function trustOrigin(url: string) {
  const o = originOf(url);
  sessionTrust.add(o);
  const list = stored();
  if (list.includes(o)) return;
  try { localStorage.setItem(KEY, JSON.stringify([...list, o])); } catch { /* session only */ }
}

export function forgetOrigin(url: string) {
  const o = originOf(url);
  sessionTrust.delete(o);
  try { localStorage.setItem(KEY, JSON.stringify(stored().filter(x => x !== o))); } catch { /* */ }
}
