// Shared control styles: focus rings, lesson spotlight rings, value bubble.
// A plain module (not a CSS module) because device code imports the controls and is also
// loaded outside Next (scripts/validate-devices.ts runs under Node). The CSS is injected
// once on the client. Motion respects prefers-reduced-motion.

const CSS = `
.ssc-control{outline:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.ssc-control:focus-visible,.ssc-focusable:focus-visible{outline:2px solid #7dd3fc;outline-offset:3px}
.ssc-round:focus-visible{border-radius:9999px}
.ssc-hit{position:absolute;background:transparent}
.ssc-spot{position:absolute;pointer-events:none;border-radius:9999px}
.ssc-spot-target{box-shadow:0 0 0 2.5px rgba(251,146,60,.95),0 0 12px 3px rgba(251,146,60,.45)}
.ssc-spot-done{box-shadow:0 0 0 2.5px rgba(34,197,94,.95),0 0 12px 2px rgba(34,197,94,.4)}
.ssc-spot-focus{box-shadow:0 0 0 1.5px rgba(253,230,138,.85),0 0 8px 1px rgba(253,230,138,.3)}
@media (prefers-reduced-motion:no-preference){.ssc-spot-target{animation:ssc-breathe 1.8s ease-in-out infinite}.ssc-bubble{animation:ssc-in 90ms ease-out}}
@keyframes ssc-breathe{0%,100%{box-shadow:0 0 0 2.5px rgba(251,146,60,.95),0 0 8px 2px rgba(251,146,60,.55)}50%{box-shadow:0 0 0 2.5px rgba(251,146,60,.95),0 0 20px 7px rgba(251,146,60,.18)}}
@keyframes ssc-in{from{opacity:0}to{opacity:1}}
.ssc-bubble{position:fixed;z-index:1000;transform:translate(-50%,-100%);pointer-events:none;min-width:64px;max-width:240px;padding:5px 10px 6px;border-radius:8px;background:rgba(12,14,16,.95);border:1px solid #3f3f46;box-shadow:0 6px 18px rgba(0,0,0,.55);text-align:center;color:#fff;font-family:ui-sans-serif,-apple-system,'Helvetica Neue',Arial,sans-serif;white-space:nowrap}
.ssc-bubble-below{transform:translate(-50%,0)}
.ssc-bubble-label{display:block;font-size:10px;line-height:13px;font-weight:700;letter-spacing:.4px;color:#a1a1aa;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis}
.ssc-bubble-value{display:block;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:16px;line-height:20px;font-weight:700;font-variant-numeric:tabular-nums}
.ssc-bubble-mode{display:block;margin-top:1px;font-size:10px;line-height:13px;font-weight:700;color:#fbbf24}
.ssc-bubble-hint{display:block;margin-top:2px;font-size:10px;line-height:13px;color:#a1a1aa}
`;

if (typeof document !== 'undefined' && !document.getElementById('ssc-styles')) {
  const el = document.createElement('style');
  el.id = 'ssc-styles';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const styles = {
  control: 'ssc-control',
  focusable: 'ssc-focusable',
  round: 'ssc-round',
  hit: 'ssc-hit',
  spot: 'ssc-spot',
  spotTarget: 'ssc-spot-target',
  spotDone: 'ssc-spot-done',
  spotFocus: 'ssc-spot-focus',
  bubble: 'ssc-bubble',
  bubbleBelow: 'ssc-bubble-below',
  bubbleLabel: 'ssc-bubble-label',
  bubbleValue: 'ssc-bubble-value',
  bubbleMode: 'ssc-bubble-mode',
  bubbleHint: 'ssc-bubble-hint',
};

export default styles;
