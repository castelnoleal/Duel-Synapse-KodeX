# Releasing KodeX Premium on Google Play

KodeX Premium is a **separate app** from the free KodeX. It is built from `KodeX_Premium_vNN_instApped.zip`
(made by `scripts/build_app_bundle.py app/Kodex_Mei_Premium_vNN.html …`, or by the Skin Injector when premade
skins are added).

## 1. Build it in instApped

| Setting | Value |
|---|---|
| Source | Upload the **ZIP** (`KodeX_Premium_v57_instApped.zip`), not the HTML file. It carries the Duel Arena and all card scripts. |
| App name | `KodeX Premium` |
| Package name | `com.duelsynapse.kodex.premium` (must differ from the free app; can't be changed after the first upload) |
| Version | versionName `9.5.1`, versionCode higher than any earlier upload of this package (first upload: `1`) |
| instApped | Build with an instApped version that has **library folders** (`window.CastelFiles`); KodeX uses them for its offline database folders. They switch on by themselves (no option to set) and add no permission. |
| Orientation | **Auto / sensor** (the Arena has a landscape layout; a locked orientation stops rotation) |
| Permissions | **Camera** on (card scanner) |
| Page notifications | **On** (opponent chat notifications) |
| Offline storage | On |
| Build | Release **AAB**, signed with this app's own upload key |

## 2. Store listing (paste-ready)

**Title (30 max):** `KodeX Premium`

**Short description (80 max):**
`Yu-Gi-Oh! OCG cards, rulings and a full duel arena with custom sleeves and fields.`

**Full description:**
```
KodeX Premium is the full edition of Duel Synapse: KodeX by Meta Insider OCG.

CARDS AND RULINGS
• Fast card search with filters
• Official OCG rulings, downloadable for offline use
• Unlimited card scanner: identify a card from the camera or a photo, Japanese cards included
• Deck builder with import and export (YDK and links)

DUEL ARENA
• Play against Synapse AI, a dummy for goldfish tests, or both sides yourself
• Online rooms with invite links, spectators and chat
• Works offline: the rules engine and every card script are built in
• Chain animations, boss entrances, one-turn-kill finish, reveal windows and card details everywhere
• Original music and sound effects
• Synapse AI learns the combos you practise and can play any of your saved decks
• Phone, tablet and full-screen landscape layouts

PREMIUM
• Custom Main Deck sleeves, Extra Deck sleeves and fields, with a field editor
• Your sleeves and field are shown to your opponent and spectators in online duels
• Save any duel as a replay file (.yrp)
• Your own duel music and sound effects
• Signature cards: pick the cards that get the biggest entrance
• Finishing moves: Shatter, Meteor, Thunder, Vortex or Slash, also per signature card
• MEIOCG animations throughout the app

KodeX is an independent fan project. It is not affiliated with, sponsored by or endorsed by Konami, Studio Dice, SHUEISHA or TV Tokyo. Card names, text and artwork belong to their owners.
```

**Release notes (first release):** see `release notes` in the update message, or:
```
First release of KodeX Premium: custom sleeves and fields seen by your opponent, replay files, the Duel Arena built in for offline play, chain animations, reveal windows, landscape layout and chat notifications.
```

**Category:** Board (or Card) games. **Contact email:** metainsiderocg@gmail.com. **Privacy policy:** https://kodex.meiocg.org/privacy-policy

**Graphics you need to upload:** 512×512 icon (the KodeX icon), 1024×500 feature graphic, at least 2 phone screenshots (Arena, Skins, card page), optionally 7"/10" tablet screenshots in landscape.

## 3. App content forms

**Data safety** (answers that match the app as built):
- Data collected: **Photos** (card scanner pictures are sent to kodex.meiocg.org for identification, processed ephemerally, not stored, not shared for advertising) — *Collected, not shared, processed ephemerally, optional*.
- **Messages / in-app chat**: online duel chat is relayed between players in the room and not stored — declare *Other in-app messages*, *collected, not stored*, optional (only in online rooms).
- **App activity**: anonymous play counts for Synapse AI learning (on by default, can be turned off in the Arena lobby) — *App interactions*, not linked to the user, optional.
- No accounts, no location, no contacts, no analytics SDKs, no advertising ID.
- Data is encrypted in transit (HTTPS/WSS). Users can't request deletion because nothing is stored per user; say so.

**Ads:** answer **"No, my app does not contain ads"**. KodeX Premium has no sponsor strip.

**Content rating (IARC):** card game, no violence beyond fantasy card art, **user-to-user chat: yes** (online rooms), no purchases inside the app. Expect *Teen / PEGI 12*.

**Target audience:** 13+ (not designed for children, because of the open chat).

**Government apps, financial features, health:** No.

## 4. Pricing

Set a price in Play Console (Pricing → Paid). The app needs no billing code for this; Google handles the purchase. A merchant (payments) profile must be set up first. A paid app can't later be switched to free and back.

## 5. Testing before production

If your developer account is a **personal account created after November 2023**, every new app (Premium counts as new) must run a **closed test with at least 12 testers for 14 days in a row** before you can apply for production. Add the testers' Google accounts to a closed-testing track, upload the AAB there, and keep them opted in for the full 14 days.

## 6. Before you press "Send for review"

- [ ] Opened a duel on a real phone: Test tab, solo duel, chain animation, reveal window, Log/Chat bubble, rotate to landscape.
- [ ] Back / X during a duel asks "Leave the duel?"
- [ ] Skins: picked a Main Deck sleeve, Extra Deck sleeve and field; checked them from a second phone in an online room.
- [ ] Saved a replay file and checked it opens in a compatible simulator on a computer.
- [ ] Chat notification arrives with the app in the background (allow notifications when asked).
- [ ] Card scanner works (Gemini key set on the Worker).
- [ ] Privacy policy link opens; Legal & Privacy shows the license.

## Known risks

- **Intellectual property:** KodeX shows Konami card names, text and artwork. Google Play removes apps after rights-holder complaints, and a *paid* app is a more likely target. The disclaimer helps but is not permission.
- **Replay files** are re-simulated by the program that opens them, with its own card scripts. If those scripts changed a card after the Arena's pinned version, a replay can drift at that card.
