// ============================================================================
// Parameter locks: which controls lock, and under which key.
// Lock keys are the control id without its track prefix ("bd_flt_frq" ->
// "flt_frq", "fx_del_tim" -> "del_tim"); the TRIG page maps onto the trig's
// own NOTE / VEL / LEN and the track probability.
// ============================================================================

import { asProject, type LockOptions } from '@/lib/sequencer/elektron';
import { SEQ_TRACKS, parseId } from './model';

const NOT_LOCKABLE = new Set(['machine', 'trk_lev', 'acc_lev', 'vel_vol', 'rtrg_rate', 'rtrg_len', 'rtrg_vcr', 'rtrg_on']);

export const LOCKS: LockOptions = {
  lockKey: id => {
    const pi = parseId(id);
    if (!pi || NOT_LOCKABLE.has(pi.key)) return null;
    switch (pi.key) {
      case 'trig_note': return 'note';
      case 'trig_vel': return 'vel';
      case 'trig_len': return 'len';
      case 'trig_prob': return 'prob';
    }
    return pi.key;
  },
  trackOf: id => parseId(id)?.track ?? null,
  currentTrack: values => Math.round(Number(values.track)) || 0,
  currentPattern: data => asProject(data, SEQ_TRACKS).active,
  trackDefaults: true,
  tracks: SEQ_TRACKS,
};
