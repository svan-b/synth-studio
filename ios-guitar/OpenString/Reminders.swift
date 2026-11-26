import Foundation
import UserNotifications

/// A gentle note at the learner's chosen time to play, on days not yet played.
///
/// Reminders are set a week ahead, one for each day, and set again each time
/// the app opens and whenever a day's playing passes a minute, so a day that
/// has been played is taken off the list. If the app then stays closed, two
/// quieter reminders follow after the week, and then they stop. A missed day
/// is no failure, and the app does not nag.
final class Reminders {
    private let center = UNUserNotificationCenter.current()
    private static let prefix = "open-string-practice-"
    /// Days ahead, counting today as 0. After the first week, two last ones.
    private static let days = [0, 1, 2, 3, 4, 5, 6, 9, 13]
    /// All the work happens here, one request at a time.
    private let queue = DispatchQueue(label: "app.openstring.reminders")
    /// Each request is numbered. One overtaken by a newer request stops where it is,
    /// so turning reminders off just after turning them on leaves them off.
    private var generation = 0

    func update(on: Bool, hour: Int, minute: Int, playedToday: Bool, message: String) {
        // Reminders already shown have done their work once the app is open.
        center.removeAllDeliveredNotifications()
        queue.async {
            self.generation += 1
            let mine = self.generation
            self.center.getPendingNotificationRequests { pending in
                self.queue.async {
                    guard mine == self.generation else { return }
                    let ours = pending.map { $0.identifier }.filter { $0.hasPrefix(Self.prefix) }
                    self.center.removePendingNotificationRequests(withIdentifiers: ours)
                    guard on else { return }
                    self.center.getNotificationSettings { settings in
                        self.queue.async {
                            guard mine == self.generation else { return }
                            switch settings.authorizationStatus {
                            case .authorized, .provisional, .ephemeral:
                                self.schedule(hour: hour, minute: minute, playedToday: playedToday, message: message)
                            case .notDetermined:
                                // The first time, the iPad asks the learner whether reminders may be shown.
                                self.center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
                                    self.queue.async {
                                        guard granted, mine == self.generation else { return }
                                        self.schedule(hour: hour, minute: minute, playedToday: playedToday, message: message)
                                    }
                                }
                            default:
                                break
                            }
                        }
                    }
                }
            }
        }
    }

    private func schedule(hour: Int, minute: Int, playedToday: Bool, message: String) {
        let calendar = Calendar.current
        let now = Date()
        let today = calendar.startOfDay(for: now)
        for offset in Self.days {
            guard let day = calendar.date(byAdding: .day, value: offset, to: today),
                  let when = calendar.date(bySettingHour: max(0, min(23, hour)), minute: max(0, min(59, minute)), second: 0, of: day)
            else { continue }
            if when <= now { continue }
            if offset == 0 && playedToday { continue }
            let content = UNMutableNotificationContent()
            content.title = "Open String"
            content.body = offset < 7 ? message : "It has been a little while. A short session picks it straight back up."
            content.sound = .default
            let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: when)
            let trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
            let request = UNNotificationRequest(identifier: Self.prefix + String(offset), content: content, trigger: trigger)
            center.add(request, withCompletionHandler: nil)
        }
    }
}
