/**
 * The coach's words, spoken aloud.
 *
 * With a guitar on the lap the eyes are often on the hands, not the screen.
 * So the app can say what it shows: what to do next, and how a run went.
 * It uses the voice built into the iPad. It is a setting, off until asked for.
 *
 * The microphone hears the voice too. While it speaks, what is heard is not
 * taken for the guitar.
 */

import { listener } from '../input/listen';
import { guitar } from './engine';

let current: SpeechSynthesisUtterance | null = null;
let hush: ReturnType<typeof setInterval> | null = null;

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Is the voice speaking now? */
export function speaking(): boolean {
  return current !== null;
}

/** Text as it should be said: no marks for bold, and chord names said as words would be. */
function plain(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickVoice(): SpeechSynthesisVoice | null {
  let all: SpeechSynthesisVoice[] = [];
  try {
    all = speechSynthesis.getVoices();
  } catch {
    return null;
  }
  if (all.length === 0) return null;
  const want = (typeof navigator !== 'undefined' ? navigator.language : 'en-US').toLowerCase();
  const english = all.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const pool = english.length > 0 ? english : all;
  const score = (v: SpeechSynthesisVoice) => (v.lang.toLowerCase() === want ? 4 : 0) + (/enhanced|premium/i.test(v.name) ? 3 : 0) + (v.localService ? 1 : 0) + (v.default ? 1 : 0);
  return pool.slice().sort((a, b) => score(b) - score(a))[0] ?? null;
}

function release(): void {
  if (hush) clearInterval(hush);
  hush = null;
}

/** Stop speaking at once. */
export function stopSpeaking(): void {
  current = null;
  release();
  if (!canSpeak()) return;
  try {
    speechSynthesis.cancel();
  } catch {
    /* nothing was being said */
  }
}

/** Say something, in place of whatever was being said. Returns whether it could. */
export function speak(text: string): boolean {
  if (!canSpeak()) return false;
  const words = plain(text);
  if (!words) return false;
  try {
    speechSynthesis.cancel();
    release();
    const u = new SpeechSynthesisUtterance(words);
    const v = pickVoice();
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    } else {
      u.lang = 'en-US';
    }
    u.rate = 0.95;
    const done = () => {
      if (current !== u) return;
      current = null;
      release();
    };
    u.onend = done;
    u.onerror = done;
    current = u;
    // Some devices never say that the voice has finished, so there is a longest time too.
    const started = Date.now();
    const longest = 4000 + words.length * 110;
    hush = setInterval(() => {
      if (current !== u || Date.now() - started > longest) {
        if (current === u) current = null;
        release();
        return;
      }
      listener.suppress(guitar.now() + 0.35);
    }, 120);
    listener.suppress(guitar.now() + 0.5);
    speechSynthesis.speak(u);
    return true;
  } catch {
    current = null;
    release();
    return false;
  }
}

/** Resolves once nothing is being said, or after a longest wait. */
export function whenQuiet(longestMs = 20000): Promise<void> {
  if (!speaking()) return Promise.resolve();
  return new Promise((resolve) => {
    const started = Date.now();
    const t = setInterval(() => {
      if (!speaking() || Date.now() - started > longestMs) {
        clearInterval(t);
        resolve();
      }
    }, 100);
  });
}
