# KodeX Premium by code

For people who pay for Premium another way than Google Play. The free KodeX app turns into Premium (no ads, every
Premium feature) when a **Premium key** or a **promo code** is redeemed in Settings › *Have a Premium code or key?
Redeem it*. Nothing goes online: keys are checked on the device, and checked again every time the app starts.

## Premium keys (no new build needed)

A key looks like `KX1-040QQ7-A76422-…` (about 120 characters). It is signed with MEIOCG's **private key**; the app
checks it with the **public key** in `app/premium-codes.json`. A key can last a number of days (counted from the day it
was made) or have no end.

* On a computer: `node scripts/kodex_keys.mjs key kodex-premium-private-key.jwk.json --days 365 --note "Juan, GCash"`
* On a phone or any browser: open `scripts/keymaker.html` (a local file, not online), load the private key file, set the
  days, tap *Make keys*.
* Check one: `node scripts/kodex_keys.mjs check KX1-…`
* Stop a key (with the next app update): `node scripts/kodex_keys.mjs revoke KX1-…`, then rebuild.

**Keep the private key file secret and backed up.** It is never in this repository. Anyone who has it can make keys;
if it is lost, `node scripts/kodex_keys.mjs init new-key.jwk.json` makes a new pair, and every key made before stops
working with the next build.

## Promo codes (a new build each time)

A promo code is a word you choose, like `MEIOCG-VIP`. Only a hash of it is built into the app.

* `node scripts/kodex_keys.mjs promo add MEIOCG-VIP --days 30 --until 2027-06-30` (Premium for 30 days after it is
  redeemed; it can be redeemed until 30 June 2027), then rebuild.
* `node scripts/kodex_keys.mjs promo remove MEIOCG-VIP` ends Premium from that code with the next build.

## Good to know

* Keys and codes can be shared: one key works on any device it is typed on. Make one key per buyer and revoke the ones
  that are passed around.
* The date is the phone's date.
* Google Play's payment rules: an app on Google Play that unlocks paid digital features must normally sell them with
  Google Play's billing. Unlocking Premium with a key bought elsewhere can go against that policy (keys given away for
  free, such as promotions, are less of a concern). Check the current Payments policy before advertising keys inside
  the app or its store listing.
