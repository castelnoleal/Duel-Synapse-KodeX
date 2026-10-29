// Where the Duel Synapse services live. On kodex.meiocg.org (or a local test server) that is this site; when the
// Arena runs from inside the KodeX app (files bundled in the app), rooms, the shared play book and card art
// still come from kodex.meiocg.org.
const H = location.hostname;
export const SITE = H === "kodex.meiocg.org" || H === "localhost" || /^127\./.test(H) ? location.origin : "https://kodex.meiocg.org";
export const BUNDLED = SITE !== location.origin;
