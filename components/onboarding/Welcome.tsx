'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { WelcomeProps } from './WelcomeDialog';

export type { WelcomeChoice, WelcomeProps } from './WelcomeDialog';

const WelcomeDialog = dynamic<WelcomeProps>(() => import('./WelcomeDialog'), { ssr: false });

/**
 * First-run welcome (./WelcomeDialog). Most visits never open it, so it loads the
 * first time it opens and then stays mounted, closing and reopening as before.
 */
export default function Welcome(props: WelcomeProps) {
  const [opened, setOpened] = useState(props.open);
  useEffect(() => { if (props.open) setOpened(true); }, [props.open]);
  return opened || props.open ? <WelcomeDialog {...props} /> : null;
}
