// KodeX for iPhone: what the web app asks of the phone. The page sees the same `window.CastelApp` (and
// `window.KodexBridge`) as in the Android app: share a link or a file, save a file, a short vibration, a notification.
import UIKit
import WebKit
import UserNotifications

final class Bridge: NSObject, WKScriptMessageHandler, UNUserNotificationCenterDelegate {
    weak var host: UIViewController?
    weak var web: WKWebView?

    /// Runs in the page before its own scripts.
    static let script = """
    (function () {
      if (window.CastelApp) return;
      var post = function (m) { try { window.webkit.messageHandlers.kodex.postMessage(m); } catch (e) {} };
      window.__kxNotif = window.__kxNotif || 'default';
      window.CastelApp = {
        platform: 'ios',
        share: function (title, text, url) { post({ a: 'share', title: String(title || ''), text: String(text || ''), url: String(url || '') }); },
        shareBase64File: function (data, name, text) { post({ a: 'file', data: String(data), name: String(name || 'KodeX'), text: String(text || ''), share: true }); },
        saveBase64File: function (data, name) { post({ a: 'file', data: String(data), name: String(name || 'KodeX'), share: false }); },
        vibrate: function (ms) { post({ a: 'vibrate', ms: Number(ms) || 30 }); },
        notify: function (title, body, tag) { post({ a: 'notify', title: String(title || 'KodeX'), body: String(body || ''), tag: String(tag || '') }); },
        notificationPermission: function () { return window.__kxNotif; },
        requestNotificationPermission: function () { post({ a: 'notifyAsk' }); },
        openUrl: function (u) { post({ a: 'open', url: String(u) }); }
      };
      window.KodexBridge = {
        saveBase64: function (name, mime, b64) { post({ a: 'file', data: 'data:' + mime + ';base64,' + b64, name: String(name), share: false }); }
      };
    })();
    """

    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let m = message.body as? [String: Any], let a = m["a"] as? String else { return }
        switch a {
        case "share":
            var items: [Any] = []
            let text = (m["text"] as? String) ?? ""
            if !text.isEmpty { items.append(text) }
            if let u = m["url"] as? String, let url = URL(string: u), !u.isEmpty { items.append(url) }
            if !items.isEmpty { present(items) }
        case "file":
            guard let data = m["data"] as? String, let name = m["name"] as? String else { return }
            DispatchQueue.global(qos: .userInitiated).async {
                guard let url = Bridge.writeTemp(dataURL: data, name: name) else { return }
                DispatchQueue.main.async {
                    var items: [Any] = [url]
                    if let t = m["text"] as? String, !t.isEmpty { items.append(t) }
                    self.present(items)
                }
            }
        case "vibrate":
            let ms = (m["ms"] as? Double) ?? 30
            if ms >= 300 { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
            else { UIImpactFeedbackGenerator(style: ms >= 80 ? .heavy : .medium).impactOccurred() }
        case "notify":
            notify(title: (m["title"] as? String) ?? "KodeX", body: (m["body"] as? String) ?? "", tag: (m["tag"] as? String) ?? "")
        case "notifyAsk":
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in self.syncPermission() }
        case "open":
            if let s = m["url"] as? String, let u = URL(string: s) { UIApplication.shared.open(u) }
        default:
            break
        }
    }

    /// The phone's share sheet (Messages, Messenger, Facebook, Discord, Save to Files, Save Image…).
    func present(_ items: [Any]) {
        guard let vc = host else { return }
        let top = vc.presentedViewController ?? vc
        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let pop = sheet.popoverPresentationController {           // iPad
            pop.sourceView = top.view
            pop.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.midY, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
        top.present(sheet, animated: true)
    }

    /// A data: URL (or bare base64) written to a file in the app's temporary folder, under its own name.
    static func writeTemp(dataURL: String, name: String) -> URL? {
        let b64: Substring
        if let comma = dataURL.firstIndex(of: ","), dataURL.hasPrefix("data:") { b64 = dataURL[dataURL.index(after: comma)...] } else { b64 = Substring(dataURL) }
        guard let data = Data(base64Encoded: String(b64), options: .ignoreUnknownCharacters) else { return nil }
        let safe = name.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("share", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(safe.isEmpty ? "KodeX" : safe)
        try? FileManager.default.removeItem(at: url)
        do { try data.write(to: url, options: .atomic) } catch { return nil }
        return url
    }

    func notify(title: String, body: String, tag: String) {
        let c = UNMutableNotificationContent()
        c.title = title
        c.body = body
        c.sound = .default
        if !tag.isEmpty { c.threadIdentifier = tag }
        let id = tag.isEmpty ? UUID().uuidString : tag + "-" + UUID().uuidString
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: c, trigger: nil))
    }

    /// Tells the page whether notifications are allowed ("granted", "denied" or "default").
    func syncPermission() {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            let v: String
            switch s.authorizationStatus {
            case .authorized, .provisional, .ephemeral: v = "granted"
            case .denied: v = "denied"
            default: v = "default"
            }
            DispatchQueue.main.async { self.web?.evaluateJavaScript("window.__kxNotif = '\(v)';", completionHandler: nil) }
        }
    }

    // notifications show even while KodeX is open
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) {
        done([.banner, .list, .sound])
    }
}

/// Keeps the page's message handler from holding the bridge forever.
final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ t: WKScriptMessageHandler) { target = t }
    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(uc, didReceive: message)
    }
}
