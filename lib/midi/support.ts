// ============================================================================
// Where Web MIDI works, and a friendly explanation where it doesn't.
//   Chrome / Edge / Opera (desktop, Android)  yes - permission prompt
//   Firefox 108+                               yes - asks to install a tiny "site permission add-on"
//   Safari (macOS)                             no
//   iPad / iPhone (every browser is WebKit)    no  - but getUserMedia (Audio input) works
// Web MIDI also needs a secure page (https:// or localhost).
// ============================================================================

export type Browser = 'chrome' | 'edge' | 'firefox' | 'safari' | 'ios' | 'other';

export interface MidiSupport {
  supported: boolean;
  browser: Browser;
  /** iPad / iPhone (including iPadOS in desktop mode) */
  ios: boolean;
  reason: 'ok' | 'ssr' | 'ios' | 'safari' | 'insecure' | 'no-api';
  /** One-paragraph explanation for the settings dialog and device panels */
  message: string;
}

export function detectBrowser(ua: string, maxTouchPoints = 0): { browser: Browser; ios: boolean } {
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (ios) return { browser: 'ios', ios };
  if (/Edg\//.test(ua)) return { browser: 'edge', ios };
  if (/Firefox\//.test(ua)) return { browser: 'firefox', ios };
  if (/Chrome\/|Chromium\//.test(ua)) return { browser: 'chrome', ios };
  if (/Safari\//.test(ua)) return { browser: 'safari', ios };
  return { browser: 'other', ios };
}

export function midiSupport(): MidiSupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, browser: 'other', ios: false, reason: 'ssr', message: '' };
  }
  const { browser, ios } = detectBrowser(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const hasApi = typeof (navigator as Navigator & { requestMIDIAccess?: unknown }).requestMIDIAccess === 'function';
  if (hasApi && window.isSecureContext !== false) {
    return {
      supported: true,
      browser,
      ios,
      reason: 'ok',
      message: browser === 'firefox'
        ? 'Firefox asks you to install a small "site permission add-on" the first time - that is how Firefox grants MIDI access. It is safe and only applies to this site.'
        : '',
    };
  }
  if (ios) {
    return {
      supported: false, browser, ios, reason: 'ios',
      message:
        'iPad and iPhone browsers have no Web MIDI: Safari, Chrome and Firefox on iPad all run on Apple\'s WebKit, which leaves it out. ' +
        'Nothing is wrong with your setup, and you can still bring your gear in. For MIDI gear, use Chrome or Edge on a computer.',
    };
  }
  if (browser === 'safari') {
    return {
      supported: false, browser, ios, reason: 'safari',
      message: 'Safari has no Web MIDI. Audio input, Web Audio plugins and the built-in Practice synth work here; for MIDI gear, open Synth Studio in Chrome or Edge.',
    };
  }
  if (window.isSecureContext === false) {
    return {
      supported: false, browser, ios, reason: 'insecure',
      message: 'Web MIDI only works on secure pages. Open Synth Studio over https:// (or http://localhost).',
    };
  }
  return {
    supported: false, browser, ios, reason: 'no-api',
    message: 'This browser has no Web MIDI. Use Chrome or Edge on a computer to connect MIDI gear. Audio input, plugins and the Practice synth still work.',
  };
}
