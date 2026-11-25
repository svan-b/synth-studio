import AVFoundation
import UIKit
import WebKit

/// The web app, filling the screen, and everything that passes between it and the iPad.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var webView: WKWebView!
    private let files = AppFiles()
    private let progress = ProgressFile()
    private let recordings = Recordings()
    private let reminders = Reminders()
    private var volumeWatch: NSKeyValueObservation?
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
        configuration.userContentController.add(MessageRelay(self), name: "openString")
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

        NotificationCenter.default.addObserver(self, selector: #selector(putAway), name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(broughtBack), name: UIApplication.didBecomeActiveNotification, object: nil)

        if SelfTest.wanted {
            selfTest = SelfTest(webView: webView, progress: progress, recordings: recordings)
        }
        open()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // The iPad sits on a stand untouched for minutes at a time while both hands are on the guitar.
        UIApplication.shared.isIdleTimerDisabled = true
    }

    @objc private func putAway() {
        progress.backUpNow()
    }

    @objc private func broughtBack() {
        UIApplication.shared.isIdleTimerDisabled = true
        // Sound and the microphone stop when the app is put away. Start them again without waiting for a tap.
        webView?.evaluateJavaScript("window.__openString && __openString.wake && __openString.wake();", completionHandler: nil)
        reportVolume()
    }

    // MARK: - Opening the web app

    private func open() {
        #if DEBUG
        // For work on the web app itself: run it on a computer and pass
        // `-OSDevURL http://that-computer.local:3000/guitar` when launching.
        if let address = UserDefaults.standard.string(forKey: "OSDevURL"), let url = URL(string: address) {
            webView.load(URLRequest(url: url))
            return
        }
        #endif
        guard files.isPresent else {
            webView.loadHTMLString(Self.missingPage, baseURL: nil)
            return
        }
        var address = AppFiles.home.absoluteString
        if SelfTest.wanted { address += "?osdebug=1" }
        webView.load(URLRequest(url: URL(string: address) ?? AppFiles.home))
    }

    /// Runs before the page's own code: says this is the app, and hands over saved progress.
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
        return "window.__openString = \(json);\n\(bridge)"
    }

    // MARK: - Page to app

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let kind = body["type"] as? String else { return }
        switch kind {
        case "store.save":
            guard let key = body["key"] as? String, let value = body["value"] as? String else { return }
            let at = (body["at"] as? NSNumber)?.doubleValue ?? Date().timeIntervalSince1970 * 1000
            progress.save(key: key, value: value, at: at)
        case "share":
            guard let name = body["name"] as? String, let text = body["text"] as? String else { return }
            share(name: name, text: text)
        case "recording.save":
            guard let name = body["name"] as? String, let data = body["data"] as? String else { return }
            let wantsShare = body["share"] as? Bool ?? false
            // Decoding and writing a few minutes of sound is done off the main thread.
            let folder = recordings
            DispatchQueue.global(qos: .userInitiated).async {
                guard let file = folder.save(name: name, base64: data) else { return }
                if wantsShare {
                    DispatchQueue.main.async { [weak self] in self?.present(sheetFor: file) }
                }
            }
        case "remind":
            let on = body["on"] as? Bool ?? false
            let hour = (body["hour"] as? NSNumber)?.intValue ?? 19
            let minute = (body["minute"] as? NSNumber)?.intValue ?? 0
            let playedToday = body["playedToday"] as? Bool ?? false
            let text = body["message"] as? String ?? "A few minutes with your guitar? Your session is ready."
            // The self test never asks the learner anything.
            if selfTest == nil {
                reminders.update(on: on, hour: hour, minute: minute, playedToday: playedToday, message: text)
            }
        case "volume.watch":
            watchVolume()
        case "audio.listening":
            if body["on"] as? Bool == true { keepSoundOnSpeaker() }
        case "selftest":
            selfTest?.heard(body)
        default:
            break
        }
    }

    // MARK: - Sound

    /// The iPad's output volume, sent to the page now and whenever it changes, for the sound check.
    private func watchVolume() {
        if volumeWatch == nil {
            volumeWatch = AVAudioSession.sharedInstance().observe(\.outputVolume, options: [.new]) { [weak self] _, _ in
                DispatchQueue.main.async { self?.reportVolume() }
            }
        }
        reportVolume()
    }

    private func reportVolume() {
        guard volumeWatch != nil else { return }
        let level = AVAudioSession.sharedInstance().outputVolume
        webView?.evaluateJavaScript("window.__openString && __openString.volume && __openString.volume(\(level));", completionHandler: nil)
    }

    /// While the microphone is in use the sound must still play at full
    /// strength through the speaker, or through Bluetooth headphones in good
    /// quality, not routed as for a phone call.
    private func keepSoundOnSpeaker() {
        let session = AVAudioSession.sharedInstance()
        guard session.category == .playAndRecord else { return }
        let wanted: AVAudioSession.CategoryOptions = [.defaultToSpeaker, .allowBluetoothA2DP]
        if session.categoryOptions.isSuperset(of: wanted) { return }
        do {
            try session.setCategory(.playAndRecord, mode: session.mode, options: session.categoryOptions.union(wanted))
        } catch {
            // The web view keeps the arrangement it made itself.
        }
    }

    // MARK: - Sheets

    /// Hand a backup file to the share sheet: Files, AirDrop, Mail.
    private func share(name: String, text: String) {
        let safe = name.replacingOccurrences(of: "/", with: "-")
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(safe.isEmpty ? "open-string.json" : safe)
        do {
            try text.write(to: file, atomically: true, encoding: .utf8)
        } catch {
            return
        }
        present(sheetFor: file)
    }

    private func present(sheetFor file: URL) {
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        if let popover = sheet.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }
        // Only one sheet at a time.
        if presentedViewController != nil { return }
        present(sheet, animated: true)
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
        if let address = UserDefaults.standard.string(forKey: "OSDevURL"), let dev = URL(string: address), dev.host == url.host {
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

    /// Listening through the microphone: the iPad asks once, and the app does not ask again on top of that.
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
    <body style="font: 20px -apple-system; padding: 60px; background: #F7F3EB; color: #1C1D1B">
    <h1 style="font-weight: 600">The guitar teacher is not inside this build</h1>
    <p>Run <code>ios-guitar/build-web.sh</code> on the Mac, then build the app again in Xcode.</p>
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
