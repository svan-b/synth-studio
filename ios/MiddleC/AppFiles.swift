import Foundation
import WebKit

/// Serves the web app from the `web` folder inside the app.
///
/// Pages are opened as `middlec://app/piano`, which the web view treats like
/// any site of its own: a secure origin with storage, sound and the microphone.
final class AppFiles: NSObject, WKURLSchemeHandler {
    static let scheme = "middlec"
    static let home = URL(string: "middlec://app/piano")!

    private let root: URL? = Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true)

    /// Whether the web app was put into the app when it was built.
    var isPresent: Bool { locate("/piano") != nil }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else {
            task.didFailWithError(URLError(.badURL))
            return
        }
        guard let file = locate(url.path), let data = try? Data(contentsOf: file) else {
            respond(task, url: url, status: 404, type: "text/plain; charset=utf-8", data: Data("Not found".utf8))
            return
        }
        respond(task, url: url, status: 200, type: Self.kind(of: file), data: data)
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        // Every answer is given at once, so there is nothing to stop.
    }

    private func respond(_ task: WKURLSchemeTask, url: URL, status: Int, type: String, data: Data) {
        let headers = [
            "Content-Type": type,
            "Content-Length": String(data.count),
            "Cache-Control": "no-cache",
        ]
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else {
            task.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    /// The file for a path. `/piano` is `piano.html`, as a web server would have it.
    private func locate(_ path: String) -> URL? {
        guard let root = root, !path.contains("..") else { return nil }
        var clean = path
        while clean.hasPrefix("/") { clean.removeFirst() }
        while clean.hasSuffix("/") { clean.removeLast() }
        if clean.isEmpty { clean = "piano" }
        let files = FileManager.default
        for candidate in [clean, clean + ".html", clean + "/index.html"] {
            let file = root.appendingPathComponent(candidate)
            var isFolder: ObjCBool = false
            if files.fileExists(atPath: file.path, isDirectory: &isFolder), !isFolder.boolValue {
                return file
            }
        }
        return nil
    }

    /// The content type a browser expects for a file, from its extension.
    private static func kind(of file: URL) -> String {
        switch file.pathExtension.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "map": return "application/json; charset=utf-8"
        case "webmanifest": return "application/manifest+json; charset=utf-8"
        case "txt": return "text/plain; charset=utf-8"
        case "mp3": return "audio/mpeg"
        case "wav": return "audio/wav"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "svg": return "image/svg+xml"
        case "ico": return "image/x-icon"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "wasm": return "application/wasm"
        default: return "application/octet-stream"
        }
    }
}
