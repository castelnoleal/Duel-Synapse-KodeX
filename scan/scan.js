/* KodeX card scanner: camera → text recognition (Tesseract.js, on the device) → KodexMatch.
 *
 * Opened from KodeX at /scan/. When a card is found it opens /#card=<passcode>.
 * Other apps can use it too:
 *   /scan/?return=<url>   open <url>#card=<passcode> instead (same site only)
 *   /scan/?pick=1         don't navigate; send {type:"kodex-scan", id, name} to the opener/parent
 *                         window (and to window.KodexScanResult in an Android app), then close
 */
(function () {
  "use strict";
  const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const IMG = (id) => `https://images.ygoprodeck.com/images/cards_small/${id}.jpg`;
  // Where each field sits on a card, as fractions of the card's width/height (generous, since framing varies).
  const ZONES = {
    name: { x: 0.04, y: 0.03, w: 0.82, h: 0.09 },
    set: { x: 0.40, y: 0.695, w: 0.57, h: 0.06 },
    pass: { x: 0.015, y: 0.925, w: 0.47, h: 0.065 },
  };
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const PICK = q.get("pick") === "1";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let index = null, worker = null, stream = null, track = null;
  let auto = true, busy = false, stopped = false, attempts = 0, lastBest = null;

  // ---------------------------------------------------------------- setup
  function returnUrl() {
    const r = q.get("return");
    if (r) { try { const u = new URL(r, location.href); if (u.origin === location.origin) return u.pathname + u.search; } catch {} }
    return "/";
  }
  function goBack() {
    if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin) history.back();
    else location.href = returnUrl();
  }
  $("close").onclick = goBack;

  function showMsg(title, body, actions) {
    $("msgTitle").textContent = title; $("msgBody").textContent = body;
    $("msgActs").innerHTML = "";
    for (const [label, fn, pri] of actions) { const b = document.createElement("button"); b.className = "btn" + (pri ? " pri" : ""); b.textContent = label; b.onclick = fn; $("msgActs").appendChild(b); }
    $("msg").classList.add("on");
  }

  async function loadIndex() {
    const r = await fetch("cards.json", { cache: "no-cache" });
    if (!r.ok) throw new Error("The card list couldn't be loaded.");
    index = KodexMatch.buildIndex(await r.json());
  }

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error("Card reading needs an internet connection the first time.")); document.head.appendChild(s); });
  }

  async function loadReader() {
    if (worker) return worker;
    if (window.KodexScanOCR) return (worker = window.KodexScanOCR); // tests supply a stand-in
    if (!window.Tesseract) await loadScript(TESSERACT);
    $("load").textContent = "Preparing card reader…";
    worker = await Tesseract.createWorker("eng", 1, { logger: () => {} });
    return worker;
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error("This browser can't use the camera."), { code: "nocam" });
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    const v = $("video");
    v.srcObject = stream;
    await v.play().catch(() => {});
    track = stream.getVideoTracks()[0];
    try { const caps = track.getCapabilities ? track.getCapabilities() : {}; if (caps.torch) $("torch").hidden = false; } catch {}
    try { await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch {}
  }
  function stopCamera() { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; track = null; }

  $("torch").onclick = async () => {
    const on = $("torch").getAttribute("aria-pressed") !== "true";
    try { await track.applyConstraints({ advanced: [{ torch: on }] }); $("torch").setAttribute("aria-pressed", String(on)); } catch {}
  };
  $("auto").onclick = () => { auto = !auto; $("auto").setAttribute("aria-pressed", String(auto)); if (auto) loop(); };

  // ------------------------------------------------------------- capturing
  /** The part of the video frame inside the on-screen card frame, as a canvas. */
  function grabCard() {
    const v = $("video"), g = $("guide").getBoundingClientRect(), r = v.getBoundingClientRect();
    const vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh) return null;
    const scale = Math.max(r.width / vw, r.height / vh); // object-fit: cover
    const ox = (r.width - vw * scale) / 2, oy = (r.height - vh * scale) / 2;
    const sx = (g.left - r.left - ox) / scale, sy = (g.top - r.top - oy) / scale, sw = g.width / scale, sh = g.height / scale;
    const c = document.createElement("canvas");
    c.width = Math.round(Math.min(1100, sw)); c.height = Math.round(c.width * 86 / 59);
    c.getContext("2d").drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  }

  /** A photo as a card canvas: trimmed to the card's shape around the centre. */
  function photoCard(img) {
    const ratio = 59 / 86;
    let w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0;
    if (w / h > ratio) { const nw = h * ratio; sx = (w - nw) / 2; w = nw; } else { const nh = w / ratio; sy = (h - nh) / 2; h = nh; }
    const c = document.createElement("canvas");
    c.width = Math.round(Math.min(1100, w)); c.height = Math.round(c.width / ratio);
    c.getContext("2d").drawImage(img, sx, sy, w, h, 0, 0, c.width, c.height);
    return c;
  }

  /** Crops one field, enlarges it and makes it dark text on light for the reader. */
  function zone(card, z, targetH) {
    const sx = card.width * z.x, sy = card.height * z.y, sw = card.width * z.w, sh = card.height * z.h;
    const scale = Math.max(1, targetH / sh);
    const c = document.createElement("canvas");
    c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
    const x = c.getContext("2d", { willReadFrequently: true });
    x.imageSmoothingQuality = "high";
    x.drawImage(card, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    let sum = 0, min = 255, max = 0;
    for (let i = 0; i < p.length; i += 4) { const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = l; sum += l; if (l < min) min = l; if (l > max) max = l; }
    const mean = sum / (p.length / 4), invert = mean < 120, span = Math.max(1, max - min);
    if (span < 48) return null; // no printed text here, only shading
    for (let i = 0; i < p.length; i += 4) { let l = ((p[i] - min) / span) * 255; if (invert) l = 255 - l; p[i] = p[i + 1] = p[i + 2] = l; }
    x.putImageData(d, 0, 0);
    return c;
  }

  async function read(card) {
    const w = await loadReader();
    const out = {};
    const jobs = [
      ["pass", { tessedit_char_whitelist: "0123456789", tessedit_pageseg_mode: "7" }, 70],
      ["name", { tessedit_char_whitelist: "", tessedit_pageseg_mode: "7" }, 90],
      ["set", { tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-", tessedit_pageseg_mode: "7" }, 70],
    ];
    for (const [k, params, h] of jobs) {
      await w.setParameters(params);
      const img = zone(card, ZONES[k], h);
      if (!img) { out[k] = ""; continue; }
      const r = await w.recognize(img);
      out[k] = String((r && r.data && r.data.text) || "").replace(/\s+/g, " ").trim();
      if (k === "pass" && KodexMatch.findPasscodes(index, out.pass).length) break; // a passcode is enough
    }
    return { name: out.name || "", setCode: out.set || "", passcode: out.pass || "" };
  }

  // --------------------------------------------------------------- scanning
  async function scanOnce(card, { fromPhoto } = {}) {
    if (busy || !card) return;
    busy = true; $("shutter").classList.add("busy"); $("guide").classList.add("reading");
    try {
      const text = await read(card);
      const result = KodexMatch.identify(index, text);
      attempts++;
      if (result.sure) return found(result);
      if (result.candidates.length) lastBest = result;
      if (fromPhoto || attempts >= 4 && lastBest) return choose(lastBest || result, fromPhoto);
      $("hint").innerHTML = result.card ? `Hold steady…<small>Looks like ${esc(result.card.name)}</small>` : (text.name || text.passcode ? `Still reading…<small>Move closer so the card fills the frame</small>` : `Fit the whole card inside the frame<small>Hold it flat, in good light, without glare</small>`);
    } catch (e) {
      showMsg("Card reader unavailable", e.message || String(e), [["Try again", () => location.reload(), true], ["Back", goBack]]);
      stopped = true;
    } finally {
      busy = false; $("shutter").classList.remove("busy"); $("guide").classList.remove("reading");
    }
  }

  async function loop() {
    while (auto && !stopped && !$("sheet").classList.contains("on")) {
      if (document.visibilityState === "visible" && stream) await scanOnce(grabCard());
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  $("shutter").onclick = () => { if (stream) scanOnce(grabCard()); };
  $("photo").onchange = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); scanOnce(photoCard(img), { fromPhoto: true }); };
    img.onerror = () => { $("hint").innerHTML = "That photo couldn't be opened<small>Try another photo</small>"; };
    img.src = URL.createObjectURL(f);
  };

  // ---------------------------------------------------------------- results
  function openSheet(title, sub, body, actions) {
    $("sheetTitle").textContent = title; $("sheetSub").textContent = sub; $("sheetBody").innerHTML = body;
    $("sheetActs").innerHTML = "";
    for (const [label, fn, pri] of actions) { const b = document.createElement("button"); b.className = "btn" + (pri ? " pri" : ""); b.textContent = label; b.onclick = fn; $("sheetActs").appendChild(b); }
    $("sheet").classList.add("on");
    history.pushState({ sheet: 1 }, "");
  }
  function closeSheet() { if ($("sheet").classList.contains("on")) { $("sheet").classList.remove("on"); attempts = 0; lastBest = null; if (auto) loop(); } }
  addEventListener("popstate", closeSheet);
  const again = () => { if (history.state && history.state.sheet) history.back(); else closeSheet(); };

  function deliver(card) {
    const msg = { type: "kodex-scan", id: card.id, name: card.name };
    if (PICK) {
      try { if (window.KodexScanResult && window.KodexScanResult.onCard) window.KodexScanResult.onCard(JSON.stringify(msg)); } catch {}
      try { (window.opener || (window.parent !== window ? window.parent : null))?.postMessage(msg, "*"); } catch {}
      stopCamera();
      if (window.opener) window.close(); else history.back();
      return;
    }
    stopCamera();
    location.href = returnUrl().replace(/#.*$/, "") + "#card=" + encodeURIComponent(card.id);
  }

  function found(result) {
    const c = result.card;
    $("guide").classList.add("found");
    try { navigator.vibrate && navigator.vibrate(40); } catch {}
    const via = { passcode: "Matched by passcode", set: "Matched by set code", name: "Matched by name" }[result.via] || "";
    openSheet("Card found", via, `<div class="hit"><img src="${esc(IMG(c.id))}" alt="" onerror="this.style.visibility='hidden'"><div><b>${esc(c.name)}</b><small>Passcode ${esc(String(c.id).padStart(8, "0"))}</small>${result.candidates.length > 1 ? `<br><button class="tag" id="notIt">Not this card?</button>` : ""}</div></div>`,
      [[PICK ? "Use this card" : "Open card", () => deliver(c), true], ["Scan another", again]]);
    $("guide").classList.remove("found");
    const n = $("notIt");
    if (n) n.onclick = () => { $("sheet").classList.remove("on"); history.replaceState({ sheet: 1 }, ""); choose({ candidates: result.candidates.filter((x) => x.card !== c) }, false, true); };
  }

  function choose(result, fromPhoto, replacing) {
    const list = (result.candidates || []).slice(0, 6);
    if (!list.length) {
      if (fromPhoto) $("hint").innerHTML = "No card recognised in that photo<small>Use a sharp, straight photo of the whole card</small>";
      return;
    }
    const body = `<div class="cands">${list.map((x, i) => `<button class="cand" data-i="${i}"><img src="${esc(IMG(x.card.id))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span>${esc(x.card.name)}<small>${Math.round(x.score * 100)}% match</small></span></button>`).join("")}</div>`;
    if (replacing) { $("sheetTitle").textContent = "Which card is it?"; $("sheetSub").textContent = "Pick the card you scanned."; $("sheetBody").innerHTML = body; $("sheet").classList.add("on"); }
    else openSheet("Which card is it?", "The card wasn't clear enough to be sure. Pick it below, or scan again.", body, [["Scan again", again]]);
    $("sheetBody").querySelectorAll(".cand").forEach((b) => (b.onclick = () => deliver(list[+b.dataset.i].card)));
  }

  // ------------------------------------------------------------------ start
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && track) { try { track.applyConstraints({ advanced: [{ torch: false }] }); } catch {} $("torch").setAttribute("aria-pressed", "false"); } });
  addEventListener("pagehide", stopCamera);

  (async () => {
    try { await loadIndex(); }
    catch (e) { showMsg("KodeX is unavailable", e.message, [["Try again", () => location.reload(), true], ["Back", goBack]]); return; }
    loadReader().catch(() => {}); // warm up while the camera starts
    try {
      await startCamera();
      $("load").hidden = true;
      loop();
    } catch (e) {
      $("load").hidden = true;
      const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
      showMsg(denied ? "Camera access is off" : "No camera available",
        denied ? "Allow camera access for KodeX in your browser or app settings, or scan a photo instead." : "You can still scan a photo of a card.",
        [["Choose a photo", () => { $("msg").classList.remove("on"); $("photo").click(); }, true], ["Back", goBack]]);
    }
  })();

  window.KodexScan = { identify: (t) => KodexMatch.identify(index, t), scanCanvas: (c) => scanOnce(c, { fromPhoto: true }) };
})();
