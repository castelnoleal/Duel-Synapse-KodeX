// Player profiles: icon, frame, title and banner, shown on the Life Point plates and in a profile card.
// Shared with the KodeX app (its build copies PROFILE_DATA from this file), so both draw profiles the same way.
// Free players: the MEIOCG icon or a preset, frames unlocked by how much they use KodeX, three plain banners.
// KodeX Premium: their own picture (GIFs move), the Premium frame, animated banners and an accent colour.

/* PROFILE_DATA_START */
export const PROFILE_DATA = {
  icons: {
    star: ["#3347f0", "#7a4fd6", "M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"],
    flame: ["#e0563a", "#f0b429", "M12 2.5c1 4 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.4-4.2 2.4-5.3.3 1.9 1.4 3 2.5 3-.9-2.9-.2-5.8.6-8.7z"],
    crown: ["#b8860b", "#ffe08a", "M3.5 8l4 3.5L12 5l4.5 6.5 4-3.5-1.8 10H5.3z M5.5 20h13"],
    blade: ["#2b7fff", "#9fe2ff", "M14.5 3.5h6v6L10 20l-2-2-2.5 2.5-2-2L6 16l-2-2z M13 8l3 3"],
    shield: ["#1f9d6b", "#8be1ff", "M12 2.8l7.5 3v6c0 4.7-3.2 8.2-7.5 9.4-4.3-1.2-7.5-4.7-7.5-9.4v-6z M8.5 12l2.4 2.4L15.6 9.7"],
    moon: ["#3b2a8a", "#b46bff", "M19.5 14.5A8 8 0 1 1 9.5 4.5a6.4 6.4 0 0 0 10 10z"],
    sun: ["#f08a29", "#ffe066", "M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"],
    bolt: ["#7a4fd6", "#8be1ff", "M13.5 2.5L5 13.5h6l-1 8 8.5-11h-6z"],
    eye: ["#0f6a8a", "#8be1ff", "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"],
    gem: ["#a81a6a", "#ff8dc7", "M6.5 3.5h11l4 5.5L12 21 2.5 9z M2.5 9h19 M9 3.5L12 21l3-17.5"],
    wing: ["#3a8a9a", "#e0f7ff", "M21 4c-6 .5-11 3-14 8-1.5 2.5-2.5 5-3 8 2-2.5 4.5-3.5 7-3.5-1.5-1-2-2-2-3 3 .5 5.5-.5 7.5-2.5-1.5-.5-2.5-1-3-2 3-.5 5.5-2.5 7.5-5z"],
    spiral: ["#6a1aa8", "#ffb347", "M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a3 3 0 1 0-6 0a4.5 4.5 0 1 0 9 0a6 6 0 1 0-12 0a7.5 7.5 0 1 0 15 0"],
  },
  // frames unlock with activity points (a day you use KodeX: 10, a duel: 4, a deck: 5, cards looked up: up to 300)
  tiers: [["rookie", "Rookie", 0], ["bronze", "Bronze", 120], ["silver", "Silver", 350], ["gold", "Gold", 800], ["platinum", "Platinum", 1600], ["diamond", "Diamond", 3200], ["master", "Master", 6000]],
  themes: [["default", "MEIOCG", false], ["ocean", "Ocean", false], ["dusk", "Dusk", false], ["aurora", "Aurora", true], ["nebula", "Nebula", true], ["inferno", "Inferno", true], ["royal", "Royal Gold", true], ["synapse", "Synapse Grid", true]],
};
/* PROFILE_DATA_END */

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const TIER_IDS = PROFILE_DATA.tiers.map((t) => t[0]);
export const FRAME_IDS = ["none", ...TIER_IDS, "premium"];
export const THEME_IDS = PROFILE_DATA.themes.map((t) => t[0]);
export const tierName = (id) => (PROFILE_DATA.tiers.find((t) => t[0] === id) || ["", "Rookie"])[1];

/** A preset icon as an SVG data URL. */
export function presetIcon(id) {
  const p = PROFILE_DATA.icons[id];
  if (!p) return "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs><rect width="48" height="48" fill="url(#g)"/><g transform="translate(12 12)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${p[2]}"/></g></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
/** Cleans a profile that came from KodeX or from the other player. */
export function cleanProfile(v, imgOk) {
  if (!v || typeof v !== "object") return null;
  const t = (x, n) => String(x == null ? "" : x).replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
  const premium = v.premium === true;
  let icon = t(v.icon, 12);
  const img = premium && icon === "custom" && typeof v.img === "string" && v.img.length < 400000 && (!imgOk || imgOk(v.img)) ? v.img : "";
  if (icon === "custom" && !img) icon = "meiocg";
  if (icon !== "custom" && icon !== "meiocg" && !PROFILE_DATA.icons[icon]) icon = "meiocg";
  let frame = FRAME_IDS.includes(v.frame) ? v.frame : "none";
  if (frame === "premium" && !premium) frame = "none";
  const theme = THEME_IDS.includes(v.theme) && (premium || !PROFILE_DATA.themes.find((x) => x[0] === v.theme)[2]) ? v.theme : "default";
  const n = (x) => Math.max(0, Math.min(1e7, Math.floor(Number(x) || 0)));
  return { name: t(v.name, 24) || "Duelist", title: t(v.title, 32), bio: t(v.bio, 140), icon, img, frame, theme, premium,
    tier: TIER_IDS.includes(v.tier) ? v.tier : "rookie", accent: premium && /^#[0-9a-f]{6}$/i.test(v.accent || "") ? v.accent : "",
    stats: { points: n(v.stats && v.stats.points), days: n(v.stats && v.stats.days), duels: n(v.stats && v.stats.duels), wins: n(v.stats && v.stats.wins) } };
}
/** The picture for a profile (MEIOCG logo, a preset or their own). */
export function iconSrc(p, meiocgLogo) {
  if (!p) return meiocgLogo;
  if (p.icon === "custom" && p.img) return p.img;
  return presetIcon(p.icon) || meiocgLogo;
}
/** <span class="pf-av fr-…"><img></span> */
export function avatarHTML(p, meiocgLogo, size = 0) {
  const fr = (p && p.frame) || "none";
  return `<span class="pf-av fr-${fr}"${size ? ` style="--pf:${size}px"` : ""}><img src="${esc(iconSrc(p, meiocgLogo))}" alt="" draggable="false"></span>`;
}
/** The profile card (opened by tapping a player's plate). */
export function cardHTML(p, meiocgLogo, opts = {}) {
  if (!p) return "";
  const s = p.stats || {}, rate = s.duels ? Math.round((s.wins / s.duels) * 100) + "%" : "–";
  return `<div class="pf-card th-${esc(p.theme || "default")}"${p.accent ? ` style="--pf-acc:${esc(p.accent)}"` : ""}>
    <div class="pf-banner"><i></i></div>
    <div class="pf-head">${avatarHTML(p, meiocgLogo, 84)}<div class="pf-who"><b>${esc(p.name)}</b>${p.title ? `<span>${esc(p.title)}</span>` : ""}
      <div class="pf-tags"><em class="pf-tier t-${esc(p.tier)}">${esc(tierName(p.tier))}</em>${p.premium ? '<em class="pf-prem">PREMIUM</em>' : ""}${opts.ai ? '<em class="pf-ai">AI</em>' : ""}</div></div></div>
    ${p.bio ? `<p class="pf-bio">${esc(p.bio)}</p>` : ""}
    ${opts.ai ? "" : `<div class="pf-stats"><div><b>${s.days || 0}</b><span>Days on KodeX</span></div><div><b>${s.duels || 0}</b><span>Duels</span></div><div><b>${rate}</b><span>Win rate</span></div><div><b>${s.points || 0}</b><span>Points</span></div></div>`}
  </div>`;
}
