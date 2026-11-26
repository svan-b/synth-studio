import UIKit

/// Fretward for iPad.
///
/// The guitar teacher itself is a web app, carried inside this app as plain
/// files so it opens with no connection. This shell gives it what a web page
/// on an iPad cannot have: a file of its own for progress, recordings saved
/// where the Files app shows them, a daily reminder at the learner's time to
/// play, the iPad's own volume, and the whole screen kept awake.
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(name: "Open String", sessionRole: connectingSceneSession.role)
        configuration.delegateClass = SceneDelegate.self
        return configuration
    }
}

/// One window, filled by the web app.
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.backgroundColor = UIColor(named: "LaunchBackground")
        window.rootViewController = WebViewController()
        window.makeKeyAndVisible()
        self.window = window
    }
}
