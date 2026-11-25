import Foundation
import WebKit

/// A check the app can run on itself, used when it is built and tested
/// without a person: `-OSSelfTest YES` on the command line.
///
/// It opens the web app, waits for it to come up, starts the sound, saves
/// progress, and where the iPad lets it listen, strums a chord from the
/// development robot into the listening input and records a moment of
/// sound into the Files folder. Lines begin with SELFTEST so a script can
/// pick them out. The app then closes.
@MainActor
final class SelfTest {
    static var wanted: Bool { UserDefaults.standard.bool(forKey: "OSSelfTest") }

    private weak var webView: WKWebView?
    private let progress: ProgressFile
    private let recordings: Recordings
    private var started = false
    private var finished = false

    init(webView: WKWebView, progress: ProgressFile, recordings: Recordings) {
        self.webView = webView
        self.progress = progress
        self.recordings = recordings
        say("START")
        // Whatever happens, do not hang.
        later(90) { [weak self] in
            self?.finish(page: [:], note: "timed out")
        }
    }

    func pageLoaded() {
        guard !started else { return }
        started = true
        say("PAGE loaded")
        webView?.evaluateJavaScript(Self.pageCheck, completionHandler: nil)
    }

    func failed(_ why: String) {
        finish(page: [:], note: why)
    }

    /// A message from the page's half of the test.
    func heard(_ body: [String: Any]) {
        guard let stage = body["stage"] as? String else { return }
        if stage == "progress", let line = body["line"] as? String {
            say("STEP \(line)")
        } else if stage == "page" {
            let result = body["result"] as? [String: Any] ?? [:]
            say("PAGE \(Self.text(result))")
            // The recording reaches the app's folder a moment after the page hands it over.
            later(2) { [weak self] in
                self?.finish(page: result, note: nil)
            }
        }
    }

    private func finish(page: [String: Any], note: String?) {
        guard !finished else { return }
        finished = true
        var problems: [String] = []
        if let note = note { problems.append(note) }
        if page["native"] as? Bool != true { problems.append("the page does not know it is in the app") }
        if page["appLoaded"] as? Bool != true { problems.append("the web app did not come up") }
        if page["audio"] as? String != "running" { problems.append("sound did not start") }
        if (page["outputDb"] as? NSNumber)?.doubleValue ?? -100 < -60 { problems.append("the app's guitar made no sound") }
        let listening = page["listening"] as? String ?? "not tried"
        say("LISTEN \(listening)")
        if listening == "listening" {
            let strikes = (page["strikes"] as? NSNumber)?.intValue ?? 0
            if strikes < 1 { problems.append("a strum played into the listening input was not heard") }
            let notes = page["notes"] as? [Any] ?? []
            if notes.isEmpty { problems.append("no note was named in the strum") }
            if page["recorded"] as? Bool == true && recordings.count() < 1 { problems.append("the recording did not reach the Recordings folder") }
        } else {
            // A simulator on a computer with no microphone cannot listen. That is said, not failed.
            say("LISTEN skipped: \(page["listenError"] as? String ?? "no microphone")")
        }
        if !progress.has("open-string-v1") { problems.append("progress did not reach the app's file") }
        say("SAVED \(progress.has("open-string-v1") ? "progress file written" : "no progress file")")
        say("RECORDINGS \(recordings.count())")
        say(problems.isEmpty ? "RESULT PASS" : "RESULT FAIL: \(problems.joined(separator: "; "))")
        let code: Int32 = problems.isEmpty ? 0 : 1
        later(0.5) {
            exit(code)
        }
    }

    /// Do something on the main thread a little later.
    private func later(_ seconds: Double, _ work: @escaping @MainActor () -> Void) {
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            work()
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

    /// The page's half: is this the app, did the web app come up, does sound play, does saving work, can it hear.
    private static let pageCheck = """
    (async function () {
      const out = {};
      const post = (m) => window.webkit.messageHandlers.openString.postMessage(Object.assign({ type: 'selftest' }, m));
      const step = (line) => post({ stage: 'progress', line });
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      try {
        out.href = location.href;
        out.secure = window.isSecureContext;
        out.native = !!(window.__openString && window.__openString.native);
        out.microphoneApi = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        out.worklet = typeof AudioWorkletNode;
        out.recorder = typeof MediaRecorder;
        out.size = window.innerWidth + 'x' + window.innerHeight;
        const t0 = Date.now();
        while (!(window.__os && window.__os.robot) && Date.now() - t0 < 25000) await wait(100);
        out.appLoaded = !!(window.__os && window.__os.robot);
        out.title = document.title;
        out.screen = document.body.innerText.replace(/\\s+/g, ' ').slice(0, 70);
        if (out.appLoaded) {
          const os = window.__os;
          step('app loaded');
          os.store.getState().setProfile({ minutes: 15 });
          out.stored = !!localStorage.getItem('open-string-v1');
          await Promise.race([os.guitar.unlock(), wait(4000)]);
          out.audio = os.guitar.ctx ? os.guitar.ctx.state : 'none';
          // The app's own guitar, measured as it leaves the app.
          os.guitar.strum([{ string: 5, midi: 45 }, { string: 4, midi: 52 }, { string: 3, midi: 57 }, { string: 2, midi: 61 }, { string: 1, midi: 64 }], os.guitar.now() + 0.05);
          let loudest = -100;
          for (let i = 0; i < 12; i++) { await wait(50); loudest = Math.max(loudest, os.guitar.outputLevelDb()); }
          out.outputDb = Math.round(loudest);
          step('sound ' + out.audio + ', ' + out.outputDb + ' dB');
          const started = await Promise.race([os.listener.start(), wait(8000).then(() => false)]);
          const status = os.listener.getStatus();
          out.listening = status.state;
          out.listenError = status.error || '';
          step('listening ' + status.state);
          if (started && status.state === 'listening') {
            let strikes = 0;
            const notes = [];
            const offS = os.bus.strikeBus.subscribe(() => strikes++);
            const offN = os.bus.noteBus.subscribe((e) => notes.push(e.midi));
            const recording = os.listener.startRecording();
            await wait(400);
            await os.robot.strum('G');
            await wait(1600);
            offS();
            offN();
            out.strikes = strikes;
            out.notes = notes;
            if (recording) {
              const blob = await os.listener.stopRecording();
              out.recordedBytes = blob ? blob.size : 0;
              if (blob && blob.size > 0) {
                const text = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob); });
                window.__openString.post({ type: 'recording.save', name: 'Self test.m4a', data: text, mime: blob.type || 'audio/mp4', share: false });
                out.recorded = true;
              }
            }
            step('heard ' + strikes + ' strum, notes ' + notes.join(' '));
          }
        }
      } catch (e) {
        out.error = String(e);
      }
      post({ stage: 'page', result: out });
    })();
    """
}
