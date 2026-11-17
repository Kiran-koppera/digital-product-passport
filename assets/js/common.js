// Shared helpers: theme, roles, data loading, provenance metadata. No dependencies.

export const REPO_URL = "https://github.com/Kiran-koppera/digital-product-passport";
export const LEVELS = ["public", "legitimate-interest", "authority"];

export const PROVENANCE = {
  official: { label: "Official", desc: "Published by the manufacturer or its group" },
  derived: { label: "Derived", desc: "Calculated from official values; method in the note" },
  regulation: { label: "Regulation", desc: "Set by Regulation (EU) 2023/1542 or other law" },
  literature: { label: "Literature", desc: "Published study, not manufacturer data" },
  estimated: { label: "Estimated", desc: "Engineering assumption; method in the note" },
  simulated: { label: "Simulated", desc: "Illustrative demo data" },
  "not-disclosed": { label: "Not disclosed", desc: "Required data the manufacturer has not published" },
};

const svg = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const icons = {
  lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  unlock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-1.9"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.4"'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>'),
  download: svg('<path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14"/>'),
  print: svg('<path d="M7 9V3h10v6M7 17H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-3"/><rect x="7" y="14" width="10" height="7"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>'),
  arrow: svg('<path d="M5 12h14m-5-5l5 5-5 5"/>'),
  ext: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  shield: svg('<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  bolt: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  leaf: svg('<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l7-7"/>'),
  cycle: svg('<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>'),
  pulse: svg('<path d="M3 12h4l3-7 4 14 3-7h4"/>'),
  cell: svg('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M10 2h4M9 12h6M12 9v6"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
};

export const BRAND_MARK = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="8" width="23" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="26" y="13" width="3" height="6" rx="1" fill="currentColor"/><path d="M15.5 11l-4.5 6h4l-1 4 4.5-6h-4z" fill="currentColor"/></svg>`;

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export function formatDate(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export const allFields = (record) => record.sections.flatMap((s) => s.fields || []);

export function coverage(record) {
  if (record.stats) return { ...record.stats, pct: Math.round((record.stats.filled / record.stats.total) * 100) };
  const fields = allFields(record);
  const byProvenance = Object.fromEntries(Object.keys(PROVENANCE).map((k) => [k, 0]));
  fields.forEach((f) => { byProvenance[f.provenance] += 1; });
  const filled = fields.filter((f) => f.value !== null).length;
  return { total: fields.length, filled, gaps: fields.length - filled, pct: Math.round((filled / fields.length) * 100), byProvenance };
}

/** Stacked bar of field counts per provenance, with a legend. */
export function provenanceBar(record) {
  const c = coverage(record);
  const segs = Object.entries(c.byProvenance).filter(([, n]) => n > 0);
  return `
    <div class="prov-bar" role="img" aria-label="${segs.map(([k, n]) => `${n} ${PROVENANCE[k].label.toLowerCase()}`).join(", ")}">
      ${segs.map(([k, n]) => `<i class="pv-${k}" style="flex:${n}" title="${PROVENANCE[k].label}: ${n}"></i>`).join("")}
    </div>
    <ul class="prov-legend">
      ${segs.map(([k, n]) => `<li><span class="dot pv-${k}"></span><b>${n}</b> ${escapeHtml(PROVENANCE[k].label)}</li>`).join("")}
    </ul>`;
}

// ----- sealed (encrypted) restricted sections -----
// data/sealed/<id>.json carries the restricted sections as one AES-256-GCM ciphertext.
// The key is derived from the access password with PBKDF2-SHA256 (see scripts/seal_passport.py).
const te = new TextEncoder();
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const KEY_PREFIX = "dpp-key:";

async function decryptWith(key, record) {
  const s = record.sealed;
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(s.iv), additionalData: te.encode(record.id) }, key, fromB64(s.ciphertext));
  return JSON.parse(new TextDecoder().decode(pt));
}

/** Derive the key from a password and decrypt. Throws on a wrong password. Caches the key for the session. */
export async function unlockSealed(record, password) {
  if (!crypto?.subtle) throw new Error("insecure-context");
  const s = record.sealed;
  const base = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromB64(s.salt), iterations: s.iterations, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
  const payload = await decryptWith(key, record);
  try { sessionStorage.setItem(KEY_PREFIX + record.id, toB64(await crypto.subtle.exportKey("raw", key))); } catch { /* storage unavailable */ }
  return payload;
}

/** Decrypt with a key cached earlier in this browser session, or return null. */
export async function unlockFromSession(record) {
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + record.id);
    if (!raw || !crypto?.subtle) return null;
    const key = await crypto.subtle.importKey("raw", fromB64(raw), "AES-GCM", false, ["decrypt"]);
    return await decryptWith(key, record);
  } catch { return null; }
}

export function lockSealed(record) {
  try { sessionStorage.removeItem(KEY_PREFIX + record.id); } catch { /* storage unavailable */ }
}

// ----- roles (demo access model) -----
const ROLE_KEY = "dpp-role";
export function getRole() {
  const fromUrl = new URLSearchParams(location.search).get("role");
  if (LEVELS.includes(fromUrl)) return fromUrl;
  try { const r = sessionStorage.getItem(ROLE_KEY); if (LEVELS.includes(r)) return r; } catch { /* storage unavailable */ }
  return "public";
}
export function setRole(role) {
  try { sessionStorage.setItem(ROLE_KEY, role); } catch { /* storage unavailable */ }
}
export const canSee = (role, access) => LEVELS.indexOf(role) >= LEVELS.indexOf(access);

// ----- theme -----
const THEME_KEY = "dpp-theme";
function storedTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}
function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
export function currentTheme() {
  return document.documentElement.dataset.theme
    || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
applyTheme(storedTheme());

export function initThemeToggle() {
  const btn = document.querySelector("[data-theme-toggle]");
  if (!btn) return;
  const sun = svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>');
  const moon = svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>');
  const render = () => {
    const dark = currentTheme() === "dark";
    btn.innerHTML = dark ? sun : moon;
    btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  };
  btn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
    render();
  });
  render();
}

export function initBrand() {
  document.querySelectorAll("[data-brand-mark]").forEach((el) => { el.innerHTML = BRAND_MARK; });
}
