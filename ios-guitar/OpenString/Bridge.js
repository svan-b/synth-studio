/*
 * Open String, the bridge between the page and the iPad app.
 *
 * The app injects this before any of the page's own code runs, after setting
 * window.__openString to { version, saved }. It says the page is inside the
 * app and gives it one way to send messages. lib/guitar/native/bridge.ts is
 * the page's side.
 *
 *   page to app    window.webkit.messageHandlers.openString.postMessage({ type, ... })
 *                    store.save       key value at           write progress to the app's file
 *                    share            name text              hand a file to the share sheet
 *                    recording.save   name data mime share   save a recording (base64) to Files
 *                    remind           on hour minute playedToday message
 *                    volume.watch                            start reporting the iPad's volume
 *
 *   app to page    __openString.wake()        the app came back to the front
 *                  __openString.volume(v)     the iPad's output volume, 0 to 1
 *                  __openString.reminders(ok) false when notifications are switched off for the app
 */
(function () {
  'use strict';
  var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.openString;
  if (!handler) return;
  var app = window.__openString || (window.__openString = {});
  if (app.native) return;
  app.native = true;
  app.post = function (message) {
    handler.postMessage(message);
  };
})();
