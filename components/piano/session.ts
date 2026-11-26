'use client';

import { createContext, useContext } from 'react';

/**
 * What an activity needs to know when it runs as one part of the day's
 * session: what comes after it, and how to stop for the day. With this, the
 * screen that closes a part can lead straight on to the next one.
 */
export interface SessionLink {
  /** The title of the next part, or null when this is the last. */
  next: string | null;
  /** Stop for today. The session is kept, and picked up from the next part. */
  stop: () => void;
  /** Go on without this part having been done. It is put down as passed over. */
  pass: () => void;
}

export const SessionContext = createContext<SessionLink | null>(null);

/** The words for the button that leaves a finished activity, in a session or out of one. */
export function useOnward(alone = 'Done'): { label: string; session: SessionLink | null } {
  const session = useContext(SessionContext);
  if (!session) return { label: alone, session: null };
  return { label: session.next ? `Next: ${session.next}` : 'Finish the session', session };
}
