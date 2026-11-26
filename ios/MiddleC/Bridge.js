/*
 * Keyward, the bridge between the page and the iPad app.
 *
 * The app injects this before any of the page's own code runs. It gives the
 * page `navigator.requestMIDIAccess`, backed by the iPad's own MIDI, so the
 * web app talks to the piano exactly as it would in a browser that has MIDI.
 *
 *   page to app    window.webkit.messageHandlers.middleC.postMessage({ type, ... })
 *                    midi.open                  start sending the list of instruments
 *                    midi.send  id bytes delayMs
 *                    store.save key value       write progress to the app's file
 *                    share      name text       hand a file to the share sheet
 *                    bluetooth                  show the Bluetooth MIDI list
 *                    midi.flush id              withdraw notes sent with a time still to come
 *                    sound.ask                  say again where the iPad's sound is going
 *
 *   app to page    __middleC.midi.ports([{ id, name, kind, transport }])
 *                  __middleC.midi.rx(id, [bytes], epochMs)
 *                  __middleC.sound({ route, name, delayMs })
 */
(function () {
  'use strict';
  var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.middleC;
  if (!handler) return;
  var app = window.__middleC || (window.__middleC = {});
  if (app.midi) return;
  app.native = true;
  app.post = function (message) {
    handler.postMessage(message);
  };

  var inputs = new Map();
  var outputs = new Map();
  var access = null;
  var asked = false;
  var known = false;
  var waiting = [];
  var accessListeners = [];

  function Port(info) {
    this.id = info.id;
    this.name = info.name;
    this.manufacturer = info.manufacturer || '';
    this.type = info.kind;
    // "bluetooth" or "cable". A piano joined both ways shows up twice, and the page then uses one.
    this.transport = info.transport || '';
    this.version = '';
    this.state = 'connected';
    this.connection = 'open';
    this.onmidimessage = null;
    this.onstatechange = null;
    this._listeners = [];
  }
  Port.prototype.addEventListener = function (type, fn) {
    if (type === 'midimessage' && this._listeners.indexOf(fn) < 0) this._listeners.push(fn);
  };
  Port.prototype.removeEventListener = function (type, fn) {
    var i = this._listeners.indexOf(fn);
    if (type === 'midimessage' && i >= 0) this._listeners.splice(i, 1);
  };
  Port.prototype.open = function () {
    return Promise.resolve(this);
  };
  Port.prototype.close = function () {
    return Promise.resolve(this);
  };
  Port.prototype.clear = function () {
    app.post({ type: 'midi.flush', id: this.id });
  };
  Port.prototype.send = function (data, timestamp) {
    var delay = 0;
    if (typeof timestamp === 'number' && timestamp > 0) delay = Math.max(0, timestamp - performance.now());
    app.post({ type: 'midi.send', id: this.id, bytes: Array.prototype.slice.call(data), delayMs: delay });
  };

  function reconcile(map, list) {
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var info = list[i];
      seen[info.id] = true;
      var port = map.get(info.id);
      if (port) {
        port.name = info.name;
        port.transport = info.transport || '';
      }
      else map.set(info.id, new Port(info));
    }
    map.forEach(function (port, id) {
      if (!seen[id]) {
        port.state = 'disconnected';
        port.connection = 'closed';
        map.delete(id);
      }
    });
  }

  function makeAccess() {
    return {
      inputs: inputs,
      outputs: outputs,
      sysexEnabled: false,
      onstatechange: null,
      addEventListener: function (type, fn) {
        if (type === 'statechange' && accessListeners.indexOf(fn) < 0) accessListeners.push(fn);
      },
      removeEventListener: function (type, fn) {
        var i = accessListeners.indexOf(fn);
        if (type === 'statechange' && i >= 0) accessListeners.splice(i, 1);
      },
    };
  }

  function settle() {
    known = true;
    var list = waiting;
    waiting = [];
    for (var i = 0; i < list.length; i++) list[i](access);
  }

  /** Where the iPad's sound is going and how long it takes. Kept, so a page that asks later still gets it. */
  app.sound = function (info) {
    app.soundInfo = info;
    if (typeof app.onSound === 'function') app.onSound(info);
  };

  app.midi = {
    /** The instruments the iPad can see now. Called at the start and whenever one comes or goes. */
    ports: function (list) {
      reconcile(
        inputs,
        list.filter(function (p) {
          return p.kind === 'input';
        }),
      );
      reconcile(
        outputs,
        list.filter(function (p) {
          return p.kind === 'output';
        }),
      );
      if (!access) access = makeAccess();
      settle();
      var event = { type: 'statechange', target: access };
      if (typeof access.onstatechange === 'function') access.onstatechange(event);
      for (var i = 0; i < accessListeners.length; i++) accessListeners[i](event);
    },

    /** Bytes from an instrument, with the moment they arrived as milliseconds since 1970. */
    rx: function (id, bytes, epochMs) {
      var port = inputs.get(id);
      if (!port) return;
      var now = performance.now();
      var stamp = now;
      if (typeof epochMs === 'number') {
        // The page's clock counts from when it opened. Trust the app's time only when it is plausible.
        var t = epochMs - performance.timeOrigin;
        if (t <= now + 2 && now - t < 200) stamp = Math.min(t, now);
      }
      var event = { type: 'midimessage', target: port, data: new Uint8Array(bytes), timeStamp: stamp, receivedTime: stamp };
      if (typeof port.onmidimessage === 'function') port.onmidimessage(event);
      for (var i = 0; i < port._listeners.length; i++) port._listeners[i](event);
    },
  };

  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    writable: true,
    value: function () {
      return new Promise(function (resolve) {
        if (!access) access = makeAccess();
        if (known) {
          resolve(access);
          return;
        }
        waiting.push(resolve);
        if (!asked) {
          asked = true;
          app.post({ type: 'midi.open' });
          // Never leave the page waiting if the app is slow to answer.
          setTimeout(function () {
            if (!known) settle();
          }, 1500);
        }
      });
    },
  });
})();
