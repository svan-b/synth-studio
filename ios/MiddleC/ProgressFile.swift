import Foundation

/// The learner's progress, kept in files the app owns.
///
/// The web app also keeps progress in the web view's own storage, but the
/// system may clear that. So every change is written here too, and this copy
/// is handed back to the page when it opens.
///
/// A dated copy also goes into the app's Documents folder, which shows in the
/// Files app under Middle C. One file a day, the last thirty days. Any of
/// them can be restored from Settings in the app.
final class ProgressFile {
    private let folder: URL
    private let backups: URL
    private let queue = DispatchQueue(label: "app.middlec.progress")
    private var lastBackup = Date.distantPast
    private var pending: [String: String] = [:]

    init() {
        let files = FileManager.default
        let support = (try? files.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? files.temporaryDirectory
        let documents = (try? files.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? files.temporaryDirectory
        folder = support.appendingPathComponent("MiddleC", isDirectory: true)
        backups = documents.appendingPathComponent("Backups", isDirectory: true)
        try? files.createDirectory(at: folder, withIntermediateDirectories: true)
        try? files.createDirectory(at: backups, withIntermediateDirectories: true)
    }

    /// Everything saved, by key, as `{ value, at }` for the page.
    func all() -> [String: [String: Any]] {
        var out: [String: [String: Any]] = [:]
        let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        for file in files where file.pathExtension == "json" {
            guard let data = try? Data(contentsOf: file),
                  let entry = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let value = entry["value"] as? String
            else { continue }
            let at = (entry["at"] as? NSNumber)?.doubleValue ?? 0
            out[file.deletingPathExtension().lastPathComponent] = ["value": value, "at": at]
        }
        return out
    }

    /// Whether anything has been saved under this key.
    func has(_ key: String) -> Bool {
        FileManager.default.fileExists(atPath: folder.appendingPathComponent(Self.safe(key) + ".json").path)
    }

    func save(key: String, value: String, at: Double) {
        let name = Self.safe(key)
        guard !name.isEmpty, !value.isEmpty else { return }
        queue.async {
            let entry: [String: Any] = ["value": value, "at": at]
            if let data = try? JSONSerialization.data(withJSONObject: entry) {
                try? data.write(to: self.folder.appendingPathComponent(name + ".json"), options: .atomic)
            }
            self.pending[name] = value
            // The dated copy need not be rewritten on every note played.
            if Date().timeIntervalSince(self.lastBackup) > 120 { self.writeBackups() }
        }
    }

    /// Bring the dated copies up to date now, as when the app is put away.
    func backUpNow() {
        queue.async { self.writeBackups() }
    }

    private func writeBackups() {
        guard !pending.isEmpty else { return }
        let day = DateFormatter()
        day.calendar = Calendar(identifier: .gregorian)
        day.locale = Locale(identifier: "en_US_POSIX")
        day.dateFormat = "yyyy-MM-dd"
        let stamp = day.string(from: Date())
        for (name, value) in pending {
            // The page wraps its state as { state, version }. The copy holds
            // the state itself, which is what Restore in the app reads.
            var text = value
            if let data = value.data(using: .utf8),
               let wrapped = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let state = wrapped["state"] as? [String: Any],
               let inner = try? JSONSerialization.data(withJSONObject: state, options: [.prettyPrinted, .sortedKeys]),
               let pretty = String(data: inner, encoding: .utf8) {
                text = pretty
            }
            let file = backups.appendingPathComponent("\(name) \(stamp).json")
            try? text.write(to: file, atomically: true, encoding: .utf8)
        }
        pending.removeAll()
        lastBackup = Date()
        prune()
    }

    private func prune() {
        let files = FileManager.default
        let all = ((try? files.contentsOfDirectory(at: backups, includingPropertiesForKeys: nil)) ?? [])
            .filter { $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent > $1.lastPathComponent }
        for old in all.dropFirst(30) { try? files.removeItem(at: old) }
    }

    /// Keys become file names, so only plain characters are kept.
    private static func safe(_ key: String) -> String {
        var out = String.UnicodeScalarView()
        for scalar in key.unicodeScalars where CharacterSet.alphanumerics.contains(scalar) || scalar == "-" || scalar == "_" {
            out.append(scalar)
            if out.count >= 64 { break }
        }
        return String(out)
    }
}
