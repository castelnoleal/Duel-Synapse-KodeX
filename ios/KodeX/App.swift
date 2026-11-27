// KodeX for iPhone and iPad: Duel Synapse: KodeX, the Yu-Gi-Oh! OCG card and rulings app with its Duel Arena.
// Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023.
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let w = UIWindow(frame: UIScreen.main.bounds)
        w.backgroundColor = WebViewController.background
        w.rootViewController = WebViewController()
        w.makeKeyAndVisible()
        window = w
        return true
    }
}
