import AVFoundation
import CoreAudioKit
import UIKit
import WebKit

/// The web app, filling the screen, and everything that passes between it and the iPad.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var webView: WKWebView!
    private let files = AppFiles()
    private let piano = PianoLink()
    private let progress = ProgressFile()
    private var selfTest: SelfTest?

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(named: "LaunchBackground") ?? .systemBackground

        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(files, forURLScheme: AppFiles.scheme)
        configuration.allowsInlineMediaPlayback = true
        // Sound may start without a tap, as it would in any music app.
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.userContentController.add(MessageRelay(self), name: "middleC")
        configuration.userContentController.addUserScript(
            WKUserScript(source: startScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )

        webView = WKWebView(frame: view.bounds, configuration: configuration)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif
        view.addSubview(webView)

        piano.onPorts = { [weak self] ports in self?.tell(ports: ports) }
        piano.onBytes = { [weak self] id, bytes, arrived in self?.tell(id: id, bytes: bytes, arrived: arrived) }
        piano.start()

        NotificationCenter.default.addObserver(self, selector: #selector(putAway), name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(broughtBack), name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(soundMoved), name: AVAudioSession.routeChangeNotification, object: nil)

        if SelfTest.wanted {
            selfTest = SelfTest(webView: webView, piano: piano, progress: progress)
        }
        open()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // The iPad sits on the music stand untouched for minutes at a time.
        UIApplication.shared.isIdleTimerDisabled = true
    }

    @objc private func putAway() {
        progress.backUpNow()
    }

    /// The iPad's sound has gone somewhere else: headphones, a Bluetooth speaker, back to its own speaker.
    @objc private func soundMoved() {
        DispatchQueue.main.async { [weak self] in self?.tellSound() }
    }

    @objc private func broughtBack() {
        UIApplication.shared.isIdleTimerDisabled = true
        piano.rescan()
        tellSound()
        // Sound stops when the app is put away. Start it again without waiting for a tap.
        webView?.evaluateJavaScript("window.__middleC && __middleC.wake && __middleC.wake();", completionHandler: nil)
    }

    // MARK: - Opening the web app

    private func open() {
        #if DEBUG
        // For work on the web app itself: run it on a computer and pass
        // `-MCDevURL http://that-computer.local:3000/piano` when launching.
        if let address = UserDefaults.standard.string(forKey: "MCDevURL"), let url = URL(string: address) {
            webView.load(URLRequest(url: url))
            return
        }
        #endif
        guard files.isPresent else {
            webView.loadHTMLString(Self.missingPage, baseURL: nil)
            return
        }
        var address = AppFiles.home.absoluteString
        if SelfTest.wanted { address += "?mcdebug=1" }
        webView.load(URLRequest(url: URL(string: address) ?? AppFiles.home))
    }

    /// Runs before the page's own code: says this is the app, hands over saved progress, and adds MIDI.
    private func startScript() -> String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1"
        let about: [String: Any] = ["version": version, "saved": progress.all()]
        var json = "{}"
        if let data = try? JSONSerialization.data(withJSONObject: about), let text = String(data: data, encoding: .utf8) {
            json = text
        }
        var bridge = ""
        if let url = Bundle.main.url(forResource: "Bridge", withExtension: "js"), let text = try? String(contentsOf: url, encoding: .utf8) {
            bridge = text
        }
        return "window.__middleC = \(json);\n\(bridge)"
    }

    // MARK: - Page to app

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let kind = body["type"] as? String else { return }
        switch kind {
        case "midi.open":
            piano.rescan()
            tell(ports: piano.ports)
        case "midi.send":
            guard let id = body["id"] as? String, let raw = body["bytes"] as? [Any] else { return }
            let bytes = raw.compactMap { ($0 as? NSNumber)?.uint8Value }
            let delay = (body["delayMs"] as? NSNumber)?.doubleValue ?? 0
            piano.send(to: id, bytes: bytes, delayMs: delay)
        case "store.save":
            guard let key = body["key"] as? String, let value = body["value"] as? String else { return }
            let at = (body["at"] as? NSNumber)?.doubleValue ?? Date().timeIntervalSince1970 * 1000
            progress.save(key: key, value: value, at: at)
        case "share":
            guard let name = body["name"] as? String, let text = body["text"] as? String else { return }
            share(name: name, text: text)
        case "midi.flush":
            guard let id = body["id"] as? String else { return }
            piano.flush(id: id)
        case "sound.ask":
            tellSound()
        case "bluetooth":
            showBluetoothPianos()
        case "selftest":
            selfTest?.heard(body)
        default:
            break
        }
    }

    // MARK: - App to page

    private func tell(ports: [PianoLink.Port]) {
        let list = ports.map { ["id": $0.id, "name": $0.name, "kind": $0.kind, "transport": $0.transport] }
        guard let data = try? JSONSerialization.data(withJSONObject: list), let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.__middleC && __middleC.midi && __middleC.midi.ports(\(json));", completionHandler: nil)
    }

    private func tell(id: String, bytes: [UInt8], arrived: Double) {
        let numbers = bytes.map { String($0) }.joined(separator: ",")
        let stamp = String(format: "%.3f", arrived)
        webView.evaluateJavaScript("window.__middleC && __middleC.midi && __middleC.midi.rx('\(id)',[\(numbers)],\(stamp));", completionHandler: nil)
    }

    /// Tell the page where the iPad's sound is going and how long it takes to be heard.
    /// Sound sent over Bluetooth arrives late, and the page has no other way to know.
    private func tellSound() {
        let session = AVAudioSession.sharedInstance()
        let output = session.currentRoute.outputs.first
        var route = "other"
        if let kind = output?.portType {
            if kind == .bluetoothA2DP || kind == .bluetoothLE || kind == .bluetoothHFP {
                route = "bluetooth"
            } else if kind == .builtInSpeaker {
                route = "speaker"
            } else if kind == .headphones {
                route = "headphones"
            }
        }
        let delay = (session.outputLatency + session.ioBufferDuration) * 1000
        let info: [String: Any] = ["route": route, "name": output?.portName ?? "", "delayMs": delay.isFinite ? delay : 0]
        guard let data = try? JSONSerialization.data(withJSONObject: info), let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.__middleC && __middleC.sound && __middleC.sound(\(json));", completionHandler: nil)
    }

    // MARK: - Sheets

    /// Hand a backup file to the share sheet: Files, AirDrop, Mail.
    private func share(name: String, text: String) {
        let safe = name.replacingOccurrences(of: "/", with: "-")
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(safe.isEmpty ? "middle-c.json" : safe)
        do {
            try text.write(to: file, atomically: true, encoding: .utf8)
        } catch {
            return
        }
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        anchor(sheet)
        present(sheet, animated: true)
    }

    /// The iPad's own list of Bluetooth MIDI instruments nearby.
    private func showBluetoothPianos() {
        // The sheet can be swiped away without Done, so the search for the piano starts as it opens.
        lookForPiano()
        let list = CABTMIDICentralViewController()
        list.navigationItem.title = "Bluetooth pianos"
        list.navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .done, target: self, action: #selector(closeSheet))
        let frame = UINavigationController(rootViewController: list)
        frame.modalPresentationStyle = .formSheet
        present(frame, animated: true)
    }

    @objc private func closeSheet() {
        dismiss(animated: true) { [weak self] in self?.lookForPiano() }
    }

    /// A piano joined over Bluetooth can take a moment to appear, so look now and a few times more.
    private func lookForPiano() {
        piano.rescan()
        for wait in [1.0, 3.0, 6.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + wait) { [weak self] in self?.piano.rescan() }
        }
    }

    private func anchor(_ sheet: UIViewController) {
        guard let popover = sheet.popoverPresentationController else { return }
        popover.sourceView = view
        popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        popover.permittedArrowDirections = []
    }

    // MARK: - Web view housekeeping

    func webView(
        _ webView: WKWebView,
        decidePolicyFor action: WKNavigationAction,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = action.request.url, let scheme = url.scheme?.lowercased() else {
            decisionHandler(.cancel)
            return
        }
        if scheme == AppFiles.scheme || scheme == "about" || scheme == "blob" || scheme == "data" {
            decisionHandler(.allow)
            return
        }
        #if DEBUG
        if let address = UserDefaults.standard.string(forKey: "MCDevURL"), let dev = URL(string: address), dev.host == url.host {
            decisionHandler(.allow)
            return
        }
        #endif
        // Anything else is a link out of the app, and opens in the browser.
        if action.navigationType == .linkActivated, scheme == "https" || scheme == "http" || scheme == "mailto" {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        tellSound()
        selfTest?.pageLoaded()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        selfTest?.failed("page did not load: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        selfTest?.failed("page did not open: \(error.localizedDescription)")
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // The system closed the page to free memory. Open it again where progress was saved.
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()
        controller.addUserScript(WKUserScript(source: startScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        open()
    }

    /// Listening through the microphone: the system asks once, and the app does not ask again on top of that.
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping @MainActor @Sendable (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.grant)
    }

    private static let missingPage = """
    <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font: 20px -apple-system; padding: 60px; background: #F6F3EC; color: #1E1C19">
    <h1 style="font-weight: 600">The piano teacher is not inside this build</h1>
    <p>Run <code>ios/build-web.sh</code> on the Mac, then build the app again in Xcode.</p>
    </body></html>
    """
}

/// Passes page messages on without the web view keeping the screen alive for ever.
private final class MessageRelay: NSObject, WKScriptMessageHandler {
    private weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
