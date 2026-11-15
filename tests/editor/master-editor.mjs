// KodeX Master Editor: edit a module and see it live, changed lines, diagnostics (code, screen, every screen),
// inspect, config and downloads. Opened as a local file, the way it is usually used.
// Usage: node tests/editor/master-editor.mjs /path/to/KodeX_Editor.html [outdir]
import { chromium } from "playwright";
const file = process.argv[2], out = process.argv[3] || "/tmp";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const errs = [];
// errors from the app inside the live view (about:srcdoc) are the editor's to show, not the editor's own
p.on("pageerror", (e) => { if (!/DEADHIT|editor test error/.test(String(e)) && !/about:srcdoc/.test(e.stack || "")) errs.push(String(e).slice(0, 200)); });
await p.route(/^https?:\/\/(?!cdnjs)/, (r) => r.abort());
p.on("dialog", (d) => d.accept().catch(() => {}));
const fail = (m) => { console.error("FAIL:", m, errs); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); console.log("ok:", m); };
await p.goto("file://" + file); await p.waitForTimeout(1200);
ok(await p.evaluate(() => document.title === "KodeX Master Editor" && document.querySelectorAll("[data-go]").length >= 7), "the editor opens with the master tools");
await p.click("[data-go=code]"); await p.waitForTimeout(3500);
const st = await p.evaluate(() => ({ mods: document.querySelectorAll("#ceList button").length, app: !!document.querySelector("#lvF").contentWindow.document.querySelector(".nav") }));
ok(st.mods > 70 && st.app, "every module is listed and the app runs in the live view " + JSON.stringify(st));
// a style edit goes into the running app at once
await p.evaluate(() => window.__kxMaster.openFile("0860-kx-v68.css"));
await p.evaluate(() => { const t = document.querySelector("#ceTa"); t.value += "\n.nav { outline: 3px solid rgb(255, 0, 255); }\n"; t.dispatchEvent(new Event("input")); });
await p.waitForTimeout(300);
const hot = await p.evaluate(() => getComputedStyle(document.querySelector("#lvF").contentWindow.document.querySelector(".nav")).outlineColor);
ok(hot === "rgb(255, 0, 255)", "a style edit shows in the live view at once (" + hot + ")");
await p.waitForTimeout(400);
const mk = await p.evaluate(() => ({ gut: document.querySelectorAll("#ceGut span.c").length, hunks: document.querySelectorAll("#chList .ch-hunk").length, mod: !document.querySelector("#ceMod").hidden, list: !!document.querySelector("#ceList button.mod") }));
ok(mk.gut >= 1 && mk.hunks === 1 && mk.mod && mk.list, "the changed lines are marked and listed " + JSON.stringify(mk));
await p.screenshot({ path: `${out}/ed-code.png` });
// a script error: found by Check the code, with its module and line
await p.evaluate(() => window.__kxMaster.openFile("0880-kx-v68-late.js"));
await p.evaluate(() => { const t = document.querySelector("#ceTa"); const lines = t.value.split("\n"); lines.splice(11, 0, "function broken( {"); t.value = lines.join("\n"); t.dispatchEvent(new Event("input")); });
await p.click("[data-go=diag]"); await p.waitForTimeout(400);
await p.click("#dgCode"); await p.waitForTimeout(800);
const se = await p.evaluate(() => [...document.querySelectorAll("#dgOut .dg-item")].map((x) => x.textContent).filter((t) => /0880-kx-v68-late\.js · line 1[23]\b/.test(t)));
ok(se.length === 1, "Check the code finds the syntax error at its line " + JSON.stringify(se));
await p.evaluate(() => [...document.querySelectorAll("#dgOut .dg-item")].find((x) => /0880-kx-v68-late\.js · line 1[23]\b/.test(x.textContent)).click()); await p.waitForTimeout(300);
ok(await p.evaluate(() => !document.querySelector("[data-pane=code]").hidden && document.querySelector("#ceName").textContent === "0880-kx-v68-late.js" && /^Ln 1[23],/.test(document.querySelector("#cePos").textContent)), "tapping it opens the module at that line");
await p.click("#ceRevert").catch(() => {});

await p.evaluate(() => { const t = document.querySelector("#ceTa"); t.value = window.__kxMaster.files["0880-kx-v68-late.js"].replace("function broken( {\n", ""); t.dispatchEvent(new Event("input")); });
errs.length = 0; // the broken code above was meant to fail in the live view
// runtime errors are caught and traced to the module and line
await p.evaluate(() => window.__kxMaster.openFile("0880-kx-v68-late.js"));
await p.evaluate(() => { const t = document.querySelector("#ceTa"); t.value += "\nsetTimeout(() => { throw new Error('editor test error'); }, 50);\n"; t.dispatchEvent(new Event("input")); });
await p.evaluate(() => window.__kxMaster.preview()); await p.waitForTimeout(3500);
await p.click("[data-go=diag]"); await p.waitForTimeout(500);
const rt = await p.evaluate(() => [...document.querySelectorAll("#dgErr .dg-item")].map((x) => x.textContent).filter((t) => /editor test error/.test(t)));
ok(rt.length === 1 && /0880-kx-v68-late\.js · line \d+/.test(rt[0]), "an error while the app runs is shown with its module and line " + JSON.stringify(rt));
await p.evaluate(() => { const t = window.__kxMaster.files; window.__kxMaster.openFile("0880-kx-v68-late.js"); const ta = document.querySelector("#ceTa"); ta.value = ta.value.replace("\nsetTimeout(() => { throw new Error('editor test error'); }, 50);\n", ""); ta.dispatchEvent(new Event("input")); });
await p.evaluate(() => window.__kxMaster.preview()); await p.waitForTimeout(3500);
await p.click("[data-go=diag]"); await p.waitForTimeout(300);
// this screen and every screen, at phone and landscape sizes
await p.click("#dgScreen"); await p.waitForTimeout(500);
ok(await p.evaluate(() => /This screen/.test(document.querySelector("#dgSum").textContent)), "Check this screen runs in the live view");
await p.selectOption("#lvDev", "412x915"); await p.click("#lvRot"); await p.waitForTimeout(500);
ok(await p.evaluate(() => document.querySelector("#lvF").style.width === "915px" && document.querySelector("#lvF").style.height === "412px"), "Turn gives the landscape phone");
await p.click("#dgTour"); await p.waitForFunction(() => /Every screen at 915×412/.test(document.querySelector("#dgSum").textContent), null, { timeout: 30000 }).catch(() => fail("tour did not finish"));
ok(true, "Check every screen goes through the app: " + (await p.evaluate(() => document.querySelector("#dgSum").textContent)));
await p.screenshot({ path: `${out}/ed-diag.png` });
// inspect: tap the search box in the app, get the lines that style it
await p.click("#dgInspect");
await p.evaluate(() => { const d = document.querySelector("#lvF").contentWindow.document; const q = d.getElementById("q"); q.click(); });
await p.waitForTimeout(400);
const ins = await p.evaluate(() => ({ shown: !document.querySelector("#dgInsCard").hidden, n: document.querySelectorAll("#dgIns .dg-item").length, first: (document.querySelector("#dgIns .dg-item small") || {}).textContent }));
ok(ins.shown && ins.n >= 1, "Inspect lists the lines that make what was tapped " + JSON.stringify(ins));
await p.click("#dgInspect");
// config: links and version
await p.click("[data-go=cfg]"); await p.waitForTimeout(500);
const cf = await p.evaluate(() => ({ ver: document.querySelector("#cfVer").value, play: [...document.querySelectorAll("#cfLinks input")].some((i) => /play\.google\.com/.test(i.value)), mods: document.querySelectorAll("#cfMods .cf-mod").length, ed: [...document.querySelectorAll("#cfEd b")].every((b) => b.textContent === "found once") }));
ok(cf.ver === "68" && cf.play && cf.mods > 70 && cf.ed, "Config shows the version, the links, the modules, and the Premium replacements all found " + JSON.stringify(cf));
await p.evaluate(() => { const row = [...document.querySelectorAll("#cfLinks .cf-link")].find((r) => /play\.google\.com\/store\/search/.test(r.querySelector("input").value)); row.querySelector("input").value = "https://play.google.com/store/apps/details?id=org.meiocg.kodex"; row.querySelector("button").click(); });
await p.waitForTimeout(300);
ok(await p.evaluate(() => Object.values(window.__kxMaster.files).some((t) => t.includes("details?id=org.meiocg.kodex")) && !Object.values(window.__kxMaster.files).some((t) => t.includes("store/search?q=Duel%20Synapse"))), "changing a link changes it everywhere");
await p.screenshot({ path: `${out}/ed-cfg.png` });
// downloads and the Build step use the edited code
await p.click("[data-go=code]"); await p.waitForTimeout(300);
const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), p.click("#meDlFree")]);
const path = await dl.path(); const fs = await import("fs"); const html = fs.readFileSync(path, "utf8");
ok(/details\?id=org\.meiocg\.kodex/.test(html) && /rgb\(255, 0, 255\)/.test(html) && !/@kx:/.test(html), "the downloaded page has the edits and none of the live-view marks");
await p.click("[data-go=build]"); await p.waitForTimeout(500);
ok(await p.evaluate(() => base.free.label === "Your edited code" && base.free.text.includes("details?id=org.meiocg.kodex")), "the Build step builds from the edited code");
// edits are kept for next time
await p.reload(); await p.waitForTimeout(1500); await p.click("[data-go=code]"); await p.waitForTimeout(2500);
ok(await p.evaluate(() => document.querySelectorAll("#ceList button.mod").length >= 1 && /brought back/.test(document.querySelector("#stCode").textContent)), "edits are brought back after reopening");

await p.click("#meReset"); await p.waitForTimeout(500);
ok(await p.evaluate(() => !document.querySelector("#ceList button.mod")), "Reset all edits");
// narrow screen (a phone): code and live view switch
await p.setViewportSize({ width: 412, height: 900 }); await p.waitForTimeout(400);
await p.evaluate(() => document.querySelector("[data-pane=code] .me-seg [data-split=live]").click()); await p.waitForTimeout(400);
ok(await p.evaluate(() => getComputedStyle(document.querySelector("[data-pane=code] .me-left")).display === "none" && document.querySelector("#lv").getBoundingClientRect().width > 300), "on a phone, Code and Live view switch");
await p.screenshot({ path: `${out}/ed-phone.png` });
if (errs.length) fail("editor errors");
console.log("OK: master editor");
await b.close();
