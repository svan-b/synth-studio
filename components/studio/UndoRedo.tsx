'use client';

import { history } from '@/lib/studio/history';
import { useHistory } from './hooks';

/** Visible undo / redo (iPad has no keyboard shortcuts): Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, Ctrl+Y */
export default function UndoRedo() {
  const { canUndo, canRedo, undoLabel, redoLabel } = useHistory();
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const mod = mac ? '⌘' : 'Ctrl+';
  return (
    <div className="flex items-center rounded-lg border border-[#3a3a3a] overflow-hidden" role="group" aria-label="Undo and redo">
      <button
        onClick={() => history.undo()}
        disabled={!canUndo}
        aria-label={undoLabel ? `Undo ${undoLabel}` : 'Undo'}
        title={undoLabel ? `Undo ${undoLabel} (${mod}Z)` : `Nothing to undo (${mod}Z)`}
        className="w-10 h-9 text-lg text-gray-200 disabled:text-gray-600 hover:bg-[#2a2a2a] disabled:hover:bg-transparent"
      >
        ↶
      </button>
      <button
        onClick={() => history.redo()}
        disabled={!canRedo}
        aria-label={redoLabel ? `Redo ${redoLabel}` : 'Redo'}
        title={redoLabel ? `Redo ${redoLabel} (${mac ? '⇧⌘Z' : 'Ctrl+Y'})` : 'Nothing to redo'}
        className="w-10 h-9 text-lg text-gray-200 disabled:text-gray-600 border-l border-[#3a3a3a] hover:bg-[#2a2a2a] disabled:hover:bg-transparent"
      >
        ↷
      </button>
    </div>
  );
}
