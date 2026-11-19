import SwiftUI

/// Middle C for iPad.
///
/// The piano teacher itself is a web app, carried inside this app as plain
/// files so it opens with no connection. This shell gives it what a web page
/// on an iPad cannot have: MIDI straight from the piano, a file of its own
/// for progress, and the whole screen.
@main
struct MiddleCApp: App {
    var body: some Scene {
        WindowGroup {
            WebScreen()
                .ignoresSafeArea()
                .background(Color("LaunchBackground").ignoresSafeArea())
                .statusBarHidden(true)
                .persistentSystemOverlays(.hidden)
        }
    }
}
