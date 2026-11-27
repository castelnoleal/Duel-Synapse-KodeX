// KodeX for iPhone: the whole screen is KodeX (a web view of the app's own files, served on this phone).
import UIKit
import WebKit
import UserNotifications

final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private var web: WKWebView!
    private let bridge = Bridge()
    private var server: LocalServer?
    private var base: URL?
    private var downloads: [ObjectIdentifier: URL] = [:]
    static let background = UIColor(red: 0.043, green: 0.063, blue: 0.141, alpha: 1)

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func loadView() {
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.websiteDataStore = .default()
        cfg.preferences.javaScriptCanOpenWindowsAutomatically = true
        cfg.defaultWebpagePreferences.allowsContentJavaScript = true
        let uc = WKUserContentController()
        uc.addUserScript(WKUserScript(source: Bridge.script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        uc.add(WeakHandler(bridge), name: "kodex")
        cfg.userContentController = uc
        // tells the page it runs in the iPhone app
        cfg.applicationNameForUserAgent = "KodeXiOS/" + (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1")

        web = WKWebView(frame: .zero, configuration: cfg)
        web.isOpaque = false
        web.backgroundColor = Self.background
        web.scrollView.backgroundColor = Self.background
        web.scrollView.contentInsetAdjustmentBehavior = .never   // the page uses the safe areas itself
        web.scrollView.bounces = false
        web.allowsBackForwardNavigationGestures = false
        web.allowsLinkPreview = false
        web.navigationDelegate = self
        web.uiDelegate = self
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        bridge.host = self
        bridge.web = web
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        UNUserNotificationCenterProxy.shared.delegate = bridge
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true),
              FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path) else {
            return showProblem("KodeX's files are missing from this build.")
        }
        let srv = LocalServer(root: root)
        // a fixed port keeps decks, combos and settings (they belong to http://127.0.0.1:<port>)
        guard let port = srv.start(ports: [47127, 47128, 47129, 47130, 47131]) else {
            return showProblem("KodeX could not start. Close it and open it again.")
        }
        server = srv
        base = URL(string: "http://127.0.0.1:\(port)/")
        web.load(URLRequest(url: base!.appendingPathComponent("index.html")))
        bridge.syncPermission()
        NotificationCenter.default.addObserver(self, selector: #selector(foreground), name: UIApplication.willEnterForegroundNotification, object: nil)
    }

    @objc private func foreground() {
        server?.ensureRunning()
        bridge.syncPermission()
    }

    private func showProblem(_ text: String) {
        let html = "<html><body style='background:#0b1024;color:#eef1ff;font:17px -apple-system;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px'>\(text)</body></html>"
        web.loadHTMLString(html, baseURL: nil)
    }

    private func isLocal(_ url: URL) -> Bool {
        if let s = url.scheme, ["about", "data", "blob", "javascript"].contains(s) { return true }
        return url.host == "127.0.0.1" || url.host == "localhost"
    }

    // ----- links: KodeX's own pages stay here, the rest opens in Safari (or the app it belongs to)
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.shouldPerformDownload { return decisionHandler(.download) }
        guard let url = action.request.url else { return decisionHandler(.allow) }
        let mainFrame = action.targetFrame?.isMainFrame ?? true
        if isLocal(url) || !mainFrame { return decisionHandler(.allow) }
        if ["http", "https", "mailto", "tel", "sms", "itms-apps"].contains(url.scheme ?? "") || UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(response.canShowMIMEType ? .allow : .download)
    }

    // window.open / target=_blank
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if isLocal(url) { webView.load(action.request) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    // the camera (card scanner) and the microphone
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == "127.0.0.1" ? .grant : .prompt)
    }

    // the page's own pop-ups: alert, confirm, prompt
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        presentAlert(a) { completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        presentAlert(a) { completionHandler(false) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        presentAlert(a) { completionHandler(nil) }
    }

    private func presentAlert(_ a: UIAlertController, otherwise: () -> Void) {
        guard view.window != nil, presentedViewController == nil else { return otherwise() }
        present(a, animated: true)
    }

    // the page stopped (the phone ran low on memory): load it again
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if let b = base { webView.load(URLRequest(url: b.appendingPathComponent("index.html"))) }
    }

    // ----- downloads (a link that saves a file): the share sheet, to save it to Files or send it
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("downloads", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(suggestedFilename.isEmpty ? "KodeX" : suggestedFilename)
        try? FileManager.default.removeItem(at: url)
        downloads[ObjectIdentifier(download)] = url
        completionHandler(url)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
        bridge.present([url])
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloads.removeValue(forKey: ObjectIdentifier(download))
    }
}

/// The notification center's delegate must live as long as the app.
final class UNUserNotificationCenterProxy {
    static let shared = UNUserNotificationCenterProxy()
    var delegate: Bridge? {
        didSet { UNUserNotificationCenter.current().delegate = delegate }
    }
}
