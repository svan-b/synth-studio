import CoreMIDI
import Foundation

/// The piano, over the iPad's own MIDI.
///
/// Every instrument the iPad can see is listened to, whether it came by USB
/// cable or by Bluetooth, and instruments are picked up as they are plugged
/// in. Key and pedal messages are passed on as plain MIDI bytes.
final class PianoLink {
    struct Port: Equatable {
        let id: String
        let name: String
        /// "input" or "output", as the web page names them.
        let kind: String
    }

    /// Called on the main thread when an instrument comes or goes.
    var onPorts: (([Port]) -> Void)?
    /// Called on the main thread with bytes from an instrument and the moment they arrived, in milliseconds since 1970.
    var onBytes: ((String, [UInt8], Double) -> Void)?

    private var client = MIDIClientRef()
    private var inPort = MIDIPortRef()
    private var outPort = MIDIPortRef()
    private var testSource = MIDIEndpointRef()
    private var listening = Set<MIDIEndpointRef>()
    private var destinations: [String: MIDIEndpointRef] = [:]
    private(set) var ports: [Port] = []
    private let nanosPerTick: Double

    init() {
        var base = mach_timebase_info_data_t()
        mach_timebase_info(&base)
        nanosPerTick = base.denom == 0 ? 1 : Double(base.numer) / Double(base.denom)
    }

    /// Start listening. Returns false when the iPad's MIDI could not be opened.
    @discardableResult
    func start() -> Bool {
        let made = MIDIClientCreateWithBlock("Middle C" as CFString, &client) { [weak self] _ in
            // Something was plugged in, unplugged or renamed.
            DispatchQueue.main.async { self?.rescan() }
        }
        guard made == noErr else { return false }
        let listen = MIDIInputPortCreateWithProtocol(client, "Middle C in" as CFString, ._1_0, &inPort) { [weak self] events, source in
            self?.receive(events, source)
        }
        MIDIOutputPortCreate(client, "Middle C out" as CFString, &outPort)
        rescan()
        return listen == noErr
    }

    /// Look again at what is plugged in.
    func rescan() {
        var found: [Port] = []
        var live = Set<MIDIEndpointRef>()
        for index in 0..<MIDIGetNumberOfSources() {
            let source = MIDIGetSource(index)
            guard source != 0, usable(source) else { continue }
            live.insert(source)
            if !listening.contains(source) {
                // The endpoint's own number travels with every message, to say where it came from.
                if MIDIPortConnectSource(inPort, source, UnsafeMutableRawPointer(bitPattern: UInt(source))) == noErr {
                    listening.insert(source)
                }
            }
            found.append(Port(id: "in:\(source)", name: name(of: source), kind: "input"))
        }
        for gone in listening.subtracting(live) {
            MIDIPortDisconnectSource(inPort, gone)
            listening.remove(gone)
        }
        destinations.removeAll()
        for index in 0..<MIDIGetNumberOfDestinations() {
            let destination = MIDIGetDestination(index)
            guard destination != 0, usable(destination) else { continue }
            let id = "out:\(destination)"
            destinations[id] = destination
            found.append(Port(id: id, name: name(of: destination), kind: "output"))
        }
        if found != ports {
            ports = found
            onPorts?(found)
        }
    }

    /// Send a short message to an instrument, now or a little in the future.
    func send(to id: String, bytes: [UInt8], delayMs: Double) {
        guard let destination = destinations[id], !bytes.isEmpty, bytes.count <= 64 else { return }
        var list = MIDIPacketList()
        let first = MIDIPacketListInit(&list)
        var when: MIDITimeStamp = 0
        if delayMs > 1 {
            when = mach_absolute_time() + UInt64(delayMs * 1_000_000 / nanosPerTick)
        }
        _ = MIDIPacketListAdd(&list, MemoryLayout<MIDIPacketList>.size, first, when, bytes.count, bytes)
        MIDISend(outPort, destination, &list)
    }

    // MARK: - Incoming

    private func receive(_ events: UnsafePointer<MIDIEventList>, _ source: UnsafeMutableRawPointer?) {
        let id = "in:\(UInt(bitPattern: source))"
        let now = mach_absolute_time()
        let wall = Date().timeIntervalSince1970 * 1000
        var bytes: [UInt8] = []
        var oldest: MIDITimeStamp = 0

        // The list is a run of packets of different lengths, each a run of 32 bit words.
        let packets = Int(events.pointee.numPackets)
        var packet = UnsafeRawPointer(events)
            .advanced(by: MemoryLayout<MIDIEventList>.offset(of: \MIDIEventList.packet) ?? 8)
            .assumingMemoryBound(to: MIDIEventPacket.self)
        for _ in 0..<packets {
            let count = min(Int(packet.pointee.wordCount), 64)
            let stamp = packet.pointee.timeStamp
            if stamp != 0, oldest == 0 || stamp < oldest { oldest = stamp }
            let words = UnsafeRawPointer(packet)
                .advanced(by: MemoryLayout<MIDIEventPacket>.offset(of: \MIDIEventPacket.words) ?? 12)
                .assumingMemoryBound(to: UInt32.self)
            var index = 0
            while index < count {
                let word = words[index]
                let kind = (word >> 28) & 0xF
                if kind == 0x2 {
                    // A key, pedal or other channel message: status and two data bytes in one word.
                    let status = UInt8((word >> 16) & 0xFF)
                    let first = UInt8((word >> 8) & 0x7F)
                    let second = UInt8(word & 0x7F)
                    let family = status & 0xF0
                    if family == 0xC0 || family == 0xD0 {
                        bytes.append(contentsOf: [status, first])
                    } else {
                        bytes.append(contentsOf: [status, first, second])
                    }
                }
                index += Self.length(ofKind: kind)
            }
            packet = UnsafePointer(MIDIEventPacketNext(packet))
        }
        guard !bytes.isEmpty else { return }

        // How long ago the keys were struck, by the iPad's own clock.
        var age = 0.0
        if oldest != 0, oldest <= now {
            age = Double(now - oldest) * nanosPerTick / 1_000_000
            if age > 500 { age = 0 }
        }
        let arrived = wall - age
        DispatchQueue.main.async { [weak self] in
            self?.onBytes?(id, bytes, arrived)
        }
    }

    /// Words taken by one message of each kind in the Universal MIDI Packet format.
    private static func length(ofKind kind: UInt32) -> Int {
        switch kind {
        case 0x0, 0x1, 0x2, 0x6, 0x7: return 1
        case 0x3, 0x4, 0x8, 0x9, 0xA: return 2
        case 0xB, 0xC: return 3
        default: return 4
        }
    }

    // MARK: - What counts as an instrument

    private func usable(_ endpoint: MIDIEndpointRef) -> Bool {
        var offline: Int32 = 0
        MIDIObjectGetIntegerProperty(endpoint, kMIDIPropertyOffline, &offline)
        if offline != 0 { return false }
        // The iPad always lists its network session, which is not a piano.
        let label = name(of: endpoint).lowercased()
        if label.contains("network session") || label == "session 1" || label.contains("idam") { return false }
        return true
    }

    private func name(of object: MIDIObjectRef) -> String {
        var value: Unmanaged<CFString>?
        if MIDIObjectGetStringProperty(object, kMIDIPropertyDisplayName, &value) == noErr, let text = value?.takeRetainedValue() {
            let name = (text as String).trimmingCharacters(in: .whitespacesAndNewlines)
            if !name.isEmpty { return name }
        }
        return "Piano"
    }

    // MARK: - For the self test

    /// Make a pretend piano that the app then hears like any other. Returns false where the system does not allow it.
    func makeTestPiano(named name: String) -> Bool {
        if testSource != 0 { return true }
        let made = MIDISourceCreateWithProtocol(client, name as CFString, ._1_0, &testSource)
        if made != noErr { testSource = 0 }
        rescan()
        return made == noErr
    }

    /// Have the pretend piano send a key down or up.
    func playTestPiano(note: UInt8, velocity: UInt8) {
        guard testSource != 0 else { return }
        let status: UInt32 = velocity == 0 ? 0x80 : 0x90
        let word: UInt32 = (0x2 << 28) | (status << 16) | (UInt32(note) << 8) | UInt32(velocity)
        var list = MIDIEventList()
        let first = MIDIEventListInit(&list, ._1_0)
        _ = MIDIEventListAdd(&list, MemoryLayout<MIDIEventList>.size, first, 0, 1, [word])
        MIDIReceivedEventList(testSource, &list)
    }

    /// Pass bytes on as though an instrument had sent them. Used where a pretend piano cannot be made.
    func inject(id: String, bytes: [UInt8]) {
        onBytes?(id, bytes, Date().timeIntervalSince1970 * 1000)
    }
}
