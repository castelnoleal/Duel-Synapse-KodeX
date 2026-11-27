// KodeX for iPhone: a tiny web server on this phone only (127.0.0.1), for the app's own files.
// KodeX and its Duel Arena are web pages; served from http://127.0.0.1 they work exactly as on the web (workers, the
// WebAssembly engine, storage), with no connection. Nothing outside the phone can reach it.
import Foundation
import Network

final class LocalServer {
    private let root: URL
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "org.meiocg.kodex.server", qos: .userInitiated, attributes: .concurrent)
    private(set) var port: UInt16 = 0

    init(root: URL) {
        self.root = root.standardizedFileURL.resolvingSymlinksInPath()
    }

    /// Starts on the first free port of `ports` (the same port every time keeps the app's saved data, which belongs to
    /// http://127.0.0.1:<port>). Returns the port, or nil.
    func start(ports: [UInt16]) -> UInt16? {
        for p in ports {
            guard let nwPort = NWEndpoint.Port(rawValue: p) else { continue }
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            params.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: nwPort)
            guard let l = try? NWListener(using: params) else { continue }
            let ready = DispatchSemaphore(value: 0)
            var ok = false
            l.stateUpdateHandler = { state in
                switch state {
                case .ready: ok = true; ready.signal()
                case .failed, .cancelled: ready.signal()
                default: break
                }
            }
            l.newConnectionHandler = { [weak self] c in self?.serve(c) }
            l.start(queue: queue)
            _ = ready.wait(timeout: .now() + 3)
            if ok {
                l.stateUpdateHandler = { [weak self, weak l] state in
                    // the system can stop a listener while the app sleeps: start it again on the same port
                    if case .failed = state, let self = self { l?.cancel(); _ = self.start(ports: [p]) }
                }
                listener = l
                port = p
                return p
            }
            l.cancel()
        }
        return nil
    }

    /// After the app comes back from the background: if the system stopped the server, start it again on its port.
    func ensureRunning() {
        guard port != 0 else { return }
        if let l = listener, case .ready = l.state { return }
        listener?.cancel()
        listener = nil
        let p = port
        port = 0
        _ = start(ports: [p, p, p])
    }

    private func serve(_ c: NWConnection) {
        c.start(queue: queue)
        read(c, Data())
    }

    private func read(_ c: NWConnection, _ buf: Data) {
        c.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, done, err in
            guard let self = self else { return c.cancel() }
            var b = buf
            if let d = data { b.append(d) }
            if let end = b.range(of: Data("\r\n\r\n".utf8)) {
                self.answer(c, head: String(decoding: b[..<end.lowerBound], as: UTF8.self))
            } else if done || err != nil || b.count > 65536 {
                c.cancel()
            } else {
                self.read(c, b)
            }
        }
    }

    private func answer(_ c: NWConnection, head: String) {
        let first = head.components(separatedBy: "\r\n").first ?? ""
        let parts = first.split(separator: " ")
        guard parts.count >= 2 else { return send(c, status: "400 Bad Request", type: "text/plain", body: Data("bad request".utf8), head: false) }
        let method = String(parts[0])
        var path = String(parts[1])
        if let q = path.firstIndex(where: { $0 == "?" || $0 == "#" }) { path = String(path[..<q]) }
        path = path.removingPercentEncoding ?? path
        if method == "OPTIONS" { return send(c, status: "204 No Content", type: "text/plain", body: Data(), head: false) }
        guard method == "GET" || method == "HEAD" else { return send(c, status: "405 Method Not Allowed", type: "text/plain", body: Data(), head: false) }
        if path.isEmpty || path.hasSuffix("/") { path += "index.html" }
        let rel = path.drop(while: { $0 == "/" })
        let file = root.appendingPathComponent(String(rel)).standardizedFileURL
        // only files inside the app's web folder
        guard file.path.hasPrefix(root.path + "/") else { return notFound(c) }
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: file.path, isDirectory: &isDir) else { return notFound(c) }
        if isDir.boolValue {
            return send(c, status: "301 Moved Permanently", type: "text/plain", body: Data(), head: false, extra: "Location: \(path)/\r\n")
        }
        guard let body = try? Data(contentsOf: file, options: .mappedIfSafe) else { return notFound(c) }
        send(c, status: "200 OK", type: LocalServer.mime(file.pathExtension), body: body, head: method == "HEAD")
    }

    private func notFound(_ c: NWConnection) {
        send(c, status: "404 Not Found", type: "text/plain", body: Data("not found".utf8), head: false)
    }

    private func send(_ c: NWConnection, status: String, type: String, body: Data, head: Bool, extra: String = "") {
        var h = "HTTP/1.1 \(status)\r\n"
        h += "Content-Type: \(type)\r\n"
        h += "Content-Length: \(body.count)\r\n"
        h += "Cache-Control: no-cache\r\n"
        h += "Access-Control-Allow-Origin: *\r\n"
        h += "X-Content-Type-Options: nosniff\r\n"
        h += extra
        h += "Connection: close\r\n\r\n"
        var out = Data(h.utf8)
        if !head { out.append(body) }
        c.send(content: out, completion: .contentProcessed { _ in c.cancel() })
    }

    static func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "map": return "application/json; charset=utf-8"
        case "webmanifest": return "application/manifest+json"
        case "wasm": return "application/wasm"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "gif": return "image/gif"
        case "svg": return "image/svg+xml"
        case "ico": return "image/x-icon"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        case "otf": return "font/otf"
        case "txt", "lua", "cpp", "sh": return "text/plain; charset=utf-8"
        case "mp3": return "audio/mpeg"
        case "ogg": return "audio/ogg"
        case "wav": return "audio/wav"
        case "mp4": return "video/mp4"
        case "webm": return "video/webm"
        default: return "application/octet-stream"
        }
    }
}
