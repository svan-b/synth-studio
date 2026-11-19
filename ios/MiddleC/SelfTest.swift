import Foundation
import WebKit

/// A check the app can run on itself, used when it is built and tested
/// without a person: `-MCSelfTest YES` on the command line.
///
/// It opens the web app, waits for it to come up, plays two notes on a
/// pretend piano, and prints what it found. Lines begin with SELFTEST so a
/// script can pick them out. The app then closes.
final class SelfTest {
    static var wanted: Bool { UserDefaults.standard.bool(forKey: "MCSelfTest") }

    private weak var webView: WKWebView?
    private let piano: PianoLink
    private let progress: ProgressFile
    private var started = false
    private var finished = false
    private var report: [String: Any] = [:]

    init(webView: WKWebView, piano: PianoLink, progress: ProgressFile) {
        self.webView = webView
        self.piano = piano
        self.progress = progress
        say("START")
        // Whatever happens, do not hang.
        DispatchQueue.main.asyncAfter(deadline: .now() + 75) { [weak self] in
            self?.finish(note: "timed out")
        }
    }

    func pageLoaded() {
        guard !started else { return }
        started = true
        say("PAGE loaded")
        webView?.evaluateJavaScript(Self.pageCheck, completionHandler: nil)
    }

    func failed(_ why: String) {
        report["failure"] = why
        finish(note: why)
    }

    /// A message from the page's half of the test.
    func heard(_ body: [String: Any]) {
        guard let stage = body["stage"] as? String else { return }
        if stage == "page" {
            report["page"] = body["result"] ?? [:]
            say("PAGE \(Self.text(body["result"] ?? [:]))")
            playPiano()
        } else if stage == "midi" {
            report["midi"] = body["result"] ?? [:]
            say("MIDI \(Self.text(body["result"] ?? [:]))")
            finish(note: nil)
        }
    }

    private func playPiano() {
        let made = piano.makeTestPiano(named: "Test Piano")
        say("PIANO pretend piano \(made ? "made" : "not allowed here, passing notes straight in")")
        report["pretendPiano"] = made
        if !made {
            // Tell the page about an instrument by hand, so the notes have somewhere to arrive.
            webView?.evaluateJavaScript("__middleC.midi.ports([{ id: 'in:test', name: 'Test Piano', kind: 'input' }]);", completionHandler: nil)
        }
        // Give the page a moment to see the new instrument.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            guard let self = self else { return }
            self.say("PORTS \(self.piano.ports.map { "\($0.kind) \($0.name)" }.joined(separator: ", "))")
            let notes: [UInt8] = [60, 64]
            for (index, note) in notes.enumerated() {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3 * Double(index)) {
                    if made {
                        self.piano.playTestPiano(note: note, velocity: 90)
                    } else {
                        self.piano.inject(id: "in:test", bytes: [0x90, note, 90])
                    }
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3 * Double(index) + 0.15) {
                    if made {
                        self.piano.playTestPiano(note: note, velocity: 0)
                    } else {
                        self.piano.inject(id: "in:test", bytes: [0x80, note, 0])
                    }
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
                self.webView?.evaluateJavaScript(Self.midiCheck(pretend: made), completionHandler: nil)
            }
        }
    }

    private func finish(note: String?) {
        guard !finished else { return }
        finished = true
        let page = report["page"] as? [String: Any] ?? [:]
        let midi = report["midi"] as? [String: Any] ?? [:]
        let heard = (midi["heard"] as? [Any])?.count ?? 0
        var problems: [String] = []
        if let note = note { problems.append(note) }
        if page["native"] as? Bool != true { problems.append("the page does not know it is in the app") }
        if page["appLoaded"] as? Bool != true { problems.append("the web app did not come up") }
        if page["midiApi"] as? String != "function" { problems.append("the page has no MIDI") }
        if page["samples"] as? String != "ready" { problems.append("the piano sound did not load") }
        if heard < 4 { problems.append("the page heard \(heard) of 4 key messages") }
        if !progress.has("middle-c-v1") { problems.append("progress did not reach the app's file") }
        say("SAVED \(progress.has("middle-c-v1") ? "progress file written" : "no progress file")")
        say(problems.isEmpty ? "RESULT PASS" : "RESULT FAIL: \(problems.joined(separator: "; "))")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            exit(problems.isEmpty ? 0 : 1)
        }
    }

    private func say(_ line: String) {
        print("SELFTEST \(line)")
        fflush(stdout)
        NSLog("SELFTEST %@", line)
    }

    private static func text(_ value: Any) -> String {
        guard JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
              let text = String(data: data, encoding: .utf8)
        else { return "\(value)" }
        return text
    }

    /// The page's half: is this the app, did the web app come up, does sound load, does saving work.
    private static let pageCheck = """
    (async function () {
      const out = {};
      const post = (m) => window.webkit.messageHandlers.middleC.postMessage(Object.assign({ type: 'selftest' }, m));
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      try {
        out.href = location.href;
        out.secure = window.isSecureContext;
        out.native = !!(window.__middleC && window.__middleC.native);
        out.midiApi = typeof navigator.requestMIDIAccess;
        out.microphone = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        out.worklet = typeof AudioWorkletNode;
        out.size = window.innerWidth + 'x' + window.innerHeight;
        const t0 = Date.now();
        while (!(window.__mc && window.__mc.robot) && Date.now() - t0 < 25000) await wait(100);
        out.appLoaded = !!(window.__mc && window.__mc.robot);
        out.title = document.title;
        out.screen = document.body.innerText.replace(/\\s+/g, ' ').slice(0, 70);
        if (out.appLoaded) {
          const mc = window.__mc;
          out.midiState = mc.midi.getStatus().state;
          await Promise.race([mc.piano.unlock(), wait(4000)]);
          const t1 = Date.now();
          while (mc.piano.getStatus().state !== 'ready' && Date.now() - t1 < 25000) await wait(200);
          out.samples = mc.piano.getStatus().state;
          out.audio = mc.piano.ctx ? mc.piano.ctx.state : 'none';
          mc.store.getState().setProfile({ minutes: 30 });
          out.stored = !!localStorage.getItem('middle-c-v1');
          window.__heard = [];
          mc.noteBus.subscribe((e) => window.__heard.push(e.type + ' ' + e.midi + ' ' + e.source));
        }
      } catch (e) {
        out.error = String(e);
      }
      post({ stage: 'page', result: out });
    })();
    """

    /// After the notes: what did the web app hear, and which instruments does it see.
    private static func midiCheck(pretend: Bool) -> String {
        """
        (function () {
          const out = { heard: window.__heard || [], pretend: \(pretend ? "true" : "false") };
          try {
            const mc = window.__mc;
            out.inputs = mc.midi.getStatus().inputs.map((p) => p.name);
            out.outputs = mc.midi.getStatus().outputs.map((p) => p.name);
            out.mode = mc.input.mode;
          } catch (e) {
            out.error = String(e);
          }
          window.webkit.messageHandlers.middleC.postMessage({ type: 'selftest', stage: 'midi', result: out });
        })();
        """
    }
}
