# KodeX for iPhone and iPad

There are two ways to get KodeX on an iPhone.

## 1. The web app (no computer, no Apple account)

Open **https://kodex.meiocg.org/app/** in **Safari** → tap **Share** → **Add to Home Screen** → **Add**.

KodeX then opens from its own icon, full screen like an app, with the Duel Arena. It keeps decks, combos and settings,
works offline after the first visit, and updates itself. It is the free edition; KodeX Premium is unlocked with a
Premium key or promo code (Settings › *Have a Premium code or key? Redeem it*, see `app/PREMIUM-CODES.md`).

The web app is `app/index.html`, made by `python3 scripts/build_kodex.py build` together with the other builds, plus
`app/manifest.webmanifest`, `app/sw.js` and `app/icons/`.

## 2. The iOS app (.ipa)

`ios/` is a native iOS app: a full-screen web view that serves KodeX's own files (the app, the Arena with its engine
and every card script) from the phone itself, so everything works with no connection. It gives KodeX the phone's share
sheet (share links, pictures, clips; save to Files or Photos), haptics, notifications and the camera (card scanner).

### Getting the .ipa

The workflow **KodeX iOS** (`.github/workflows/ios.yml`) builds two unsigned .ipa files on GitHub's Mac machines
whenever `ios/` or the app version changes on `main` (or by hand: Actions › KodeX iOS › Run workflow):

* `KodeX_vNN.ipa` (bundle id `com.duelsynapse.kodex`)
* `KodeX_Premium_vNN.ipa` (bundle id `com.duelsynapse.kodex.premium`)

They are on the **ios-latest** release of this repository (and in the run's artifacts, with simulator screenshots).

### Installing it

An iPhone only runs apps signed for it. Pick one:

* **Sideloadly** (Windows or Mac, free): connect the iPhone with a cable, drop the .ipa in Sideloadly, sign in with
  your Apple ID, *Start*. On the iPhone: Settings › General › VPN & Device Management › trust your Apple ID; on iOS 16+
  also turn on Settings › Privacy & Security › Developer Mode. With a free Apple ID the app must be re-signed every
  7 days (Sideloadly can do it again; data stays), and up to 3 such apps can be on a phone.
* **AltStore** (with AltServer on a Windows or Mac computer): install AltStore on the iPhone, then open the .ipa with it
  (from Files). It refreshes the 7-day signature over Wi-Fi while AltServer runs.
* **Apple Developer Program** ($99 a year): sign the .ipa with your distribution certificate for up to a year
  (ad hoc, up to 100 registered devices), or upload it to **TestFlight** (testers install it from the TestFlight app;
  each build lasts 90 days) or the App Store. For that, open the project in Xcode (below), set your team and archive.

### Building it on a Mac

```sh
brew install xcodegen
python3 scripts/build_app_bundle.py app/Kodex_Mei_Production_vNN.html /tmp/kodex.zip
rm -rf ios/KodeX/Web && mkdir -p ios/KodeX/Web && unzip -q /tmp/kodex.zip -d ios/KodeX/Web
cd ios && xcodegen generate && open KodeX.xcodeproj
```

For KodeX Premium use `app/Kodex_Mei_Premium_vNN.html`, the bundle id `com.duelsynapse.kodex.premium`, the display
name `KodeX Premium` (build setting `KX_DISPLAY_NAME`) and the app icon `AppIconPremium`.

### How it works

* `LocalServer.swift`: a small web server bound to 127.0.0.1 (port 47127; the same port every time, because the app's
  saved data belongs to that address). Only the app's `Web` folder is served; nothing outside the phone can reach it.
* `WebViewController.swift`: the web view; KodeX's pages stay inside, other links open in Safari; downloads open the
  share sheet; the camera is allowed for KodeX's own pages; the page reloads if iOS stops it for memory.
* `Bridge.swift`: `window.CastelApp` (`platform: 'ios'`, `share`, `shareBase64File`, `saveBase64File`, `vibrate`,
  `notify`, `openUrl`) and `window.KodexBridge.saveBase64`, the same calls the Android app answers.
* Where no ad network fills the ad strip (iPhone, the web), the free edition shows MEIOCG's own banner
  (`app/src/0955-kx-ios-web.js`).
