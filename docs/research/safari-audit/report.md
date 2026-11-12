# Synth Studio on Safari (iPadOS 16.4–18, macOS Safari): static compatibility audit
Audited commit 89801d8. Full report as delivered by the audit agent; sources in this folder (src/, webkit/, bcd/, mdn/, specs/).

Counts: 1 blocker (plain http:// only), 7 major, 13 minor, 9 notes.

## Top 10 fixes, in priority order
1. M1: set navigator.audioSession.type='play-and-record' while an Audio input is open (resumeAudio() forces 'playback' on every tap, which breaks capture on iPad).
2. B1: on an insecure context, or with no audioWorklet, show a visible message; document HTTPS testing on iPad.
3. M2: debounce zustand localStorage writes, flush on pagehide/visibilitychange, catch QuotaExceededError.
4. M3: memoise panel controls; give LEDs and displays their own engine-state slices (each knob move or LED blink re-renders the whole panel).
5. M4: hold a Screen Wake Lock while playing (it doesn't work in Home Screen apps before iOS 18.4).
6. M6: save WAVs and projects with navigator.share({ files }), falling back to a.download; check in Home Screen mode on a device.
7. M5: raise the scheduler lookahead to about 1.5 s while the page is hidden (WebKit aligns hidden-page timers to 1 s); schedule arranger snapshots on the audio clock.
8. M7: protect saved work from Safari's 7-day storage deletion and the Home Screen app's separate storage: storage.persist(), export nudges, an import path.
9. Touch polish: -webkit-user-select in inline styles; touch-action: manipulation and overscroll-behavior: none globally; unplug cables on tap, not on pointerdown.
10. m1: stream 24-bit PCM from the recorder worklet (about 57 MB per recorded minute today).

## Other findings
- m5: Arial Narrow isn't installed on iPadOS; labels fall back to the wider Arial and collide.
- m6: mono capture is reported as 2 channels.
- m7: the Xone convolver impulse is rebuilt on the main thread.
- m8: the DFAM worklet allocates per quantum.
- m9: per-frame UI writes and polling.
- m10: the manifest should use standalone, not fullscreen; orientation is ignored on iOS.
- m11: the project menu closes only on mouseleave.
- m12: no mediaSession handlers; 'playback' doesn't mix with other audio.
- m13: help text and errors appear only in title tooltips.
- Notes:
  - n1: outputLatency exists only from Safari 18.4.
  - n2: LEDs run ahead of the sound by the output latency.
  - n3: no processorerror handlers.
  - n4: Web MIDI is handled well.
  - n5: don't add COOP/COEP headers.
  - n6: the bench figures come from Chrome.
  - n7: use dvh instead of vh.
  - n8: the Sub 37 wheel resets on onDoubleClick, which touch may not fire.
  - n9: Low Power Mode caps timers and frame rate.

(Exact file:line references and sources were in the agent's hand-back; they've been routed to the owning agents.)
