'use client';

/**
 * Recordings of the learner playing, kept so they can be heard again: the
 * first time through a learned song, and the latest. They are kept in the
 * browser's file store. Inside the iPad app each one is also saved as a file
 * in the Files app, under Open String, Recordings, where it can be shared.
 */

import { listener } from '../input/listen';
import { saveRecording } from '../native/bridge';

const DB = 'open-string-takes';
const STORE = 'takes';

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveTake(key: string, blob: Blob): Promise<boolean> {
  const db = await open();
  if (!db) return false;
  return new Promise((resolve) => {
    const end = (ok: boolean) => {
      db.close();
      resolve(ok);
    };
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => end(true);
      tx.onerror = () => end(false);
      // With no room left the save is called off, not failed, and would otherwise never answer.
      tx.onabort = () => end(false);
    } catch {
      end(false);
    }
  });
}

/** Remove every recording kept here, as when progress is reset. */
export function clearTakes(): void {
  try {
    if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase(DB);
  } catch {
    /* nothing kept */
  }
}

export async function loadTake(key: string): Promise<Blob | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteTake(key: string): Promise<void> {
  const db = await open();
  if (!db) return;
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
  } catch {
    /* already gone */
  }
}

/** A blob as base64 text, for handing to the iPad app. */
export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function extension(type: string): string {
  if (type.includes('mp4') || type.includes('aac') || type.includes('m4a')) return 'm4a';
  if (type.includes('webm')) return 'webm';
  if (type.includes('ogg')) return 'ogg';
  return 'm4a';
}

/** The file name a recording is saved and shared under, such as "Amazing Grace, latest.m4a". */
export function takeName(title: string, label: string, blob: Blob): string {
  const clean = (t: string) => t.replace(/[^\w ,-]/g, '').replace(/\s+/g, ' ').trim();
  return `${clean(title)}, ${clean(label)}.${extension(blob.type)}`;
}

/** Save a recording to the Files app inside the iPad app, and offer to share it when asked. Elsewhere, share or download it. */
export async function exportTake(title: string, label: string, blob: Blob, share: boolean): Promise<boolean> {
  const name = takeName(title, label, blob);
  try {
    const data = await toBase64(blob);
    if (saveRecording(name, data, blob.type || 'audio/mp4', share)) return true;
  } catch {
    /* fall through to the browser's ways */
  }
  if (!share) return false;
  const file = new File([blob], name, { type: blob.type || 'audio/mp4' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return true;
    } catch {
      return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

/** Play a recording. The microphone steps aside while it plays, so it is heard at full strength. Returns a function that stops it. */
export function playTake(blob: Blob, onEnd?: () => void): () => void {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  let done = false;
  let release: (() => void) | null = null;
  const finish = () => {
    if (done) return;
    done = true;
    audio.pause();
    URL.revokeObjectURL(url);
    release?.();
    release = null;
    onEnd?.();
  };
  audio.onended = finish;
  audio.onerror = finish;
  void listener.stepAside().then((r) => {
    if (done) {
      r();
      return;
    }
    release = r;
    void audio.play().catch(finish);
  });
  return finish;
}
