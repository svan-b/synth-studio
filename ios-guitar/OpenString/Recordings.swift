import Foundation

/// Recordings of the learner playing, kept where the Files app shows them:
/// On My iPad, Fretward, Recordings. From there they can be played,
/// shared, or sent to family.
final class Recordings {
    let folder: URL

    init() {
        let files = FileManager.default
        let documents = (try? files.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? files.temporaryDirectory
        folder = documents.appendingPathComponent("Recordings", isDirectory: true)
        try? files.createDirectory(at: folder, withIntermediateDirectories: true)
    }

    /// Write a recording handed over by the page. Returns where it went, or nil.
    func save(name: String, base64: String) -> URL? {
        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters), !data.isEmpty else { return nil }
        let file = folder.appendingPathComponent(Self.safe(name))
        do {
            try data.write(to: file, options: .atomic)
        } catch {
            return nil
        }
        return file
    }

    /// How many recordings there are.
    func count() -> Int {
        let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        return files.filter { !$0.lastPathComponent.hasPrefix(".") }.count
    }

    /// Names become file names, so only letters, digits, spaces and a little punctuation are kept.
    static func safe(_ name: String) -> String {
        let allowed = Set(" .,-_".unicodeScalars)
        var out = String.UnicodeScalarView()
        for scalar in name.unicodeScalars where CharacterSet.alphanumerics.contains(scalar) || allowed.contains(scalar) {
            out.append(scalar)
            if out.count >= 120 { break }
        }
        let text = String(out).trimmingCharacters(in: .whitespaces)
        if text.isEmpty || text.hasPrefix(".") { return "Recording.m4a" }
        return text
    }
}
