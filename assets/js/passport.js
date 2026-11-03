// Passport viewer: passport.html?id=<passport-id>[#section-key]
import { escapeHtml, fetchJSON, fieldStats, icons, initThemeToggle, REPO_URL, sha256Hex } from "./common.js";

initThemeToggle();

const app = document.getElementById("app");
const params = new URLSearchParams(location.search);
const id = (params.get("id") || "").trim().toLowerCase();
const UNLOCK_KEY = "dpp-unlocked";

let registry, record, activeKey;

function isUnlocked() {
  try { return sessionStorage.getItem(UNLOCK_KEY) === registry.demoAccess.restrictedHash; } catch { return window.__dppUnlocked === true; }
}
function setUnlocked() {
  try { sessionStorage.setItem(UNLOCK_KEY, registry.demoAccess.restrictedHash); } catch { window.__dppUnlocked = true; }
}

function renderValue(field) {
  const v = field.value;
  let html;
  if (v === null) {
    html = `<span class="pending">${icons.clock.replace("<svg", '<svg width="15" height="15"')} Pending — not yet populated</span>`;
  } else if (Array.isArray(v)) {
    const short = v.every((x) => x.length <= 34);
    html = `<ul class="${short ? "chip-list" : ""}">${v.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
  } else if (field.format === "date") {
    const d = new Date(v + "T00:00:00Z");
    html = `<time datetime="${escapeHtml(v)}">${d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</time>`;
  } else if (field.format === "mono") {
    html = `<code>${escapeHtml(v)}</code>`;
  } else {
    html = escapeHtml(v);
  }
  if (field.link) {
    html += `<span class="note"><a href="${escapeHtml(field.link.href)}" target="_blank" rel="noopener">${escapeHtml(field.link.text)} ↗</a></span>`;
  }
  if (field.note) html += `<span class="note">${escapeHtml(field.note)}</span>`;
  return html;
}

function sectionPanel(section) {
  const restricted = section.access === "restricted";
  const locked = restricted && !isUnlocked();
  const badge = restricted
    ? `<span class="badge badge-lock">${locked ? icons.lock : icons.unlock} Restricted${locked ? "" : " · unlocked"}</span>`
    : `<span class="badge badge-ok">Public</span>`;

  let body;
  if (locked) {
    body = `
      <div class="lock-panel">
        <p><strong>This category is password-protected.</strong> In the DPP access model, technical parameters,
        supply-chain information and compliance documents are only visible to authorised stakeholders
        (e.g. authorities, recyclers, OEM partners).</p>
        <form class="lock-form" novalidate>
          <label class="sr-only" for="pw">Access password</label>
          <input id="pw" name="pw" type="password" autocomplete="off" placeholder="Enter access password" required>
          <button class="btn btn-primary" type="submit">${icons.unlock} Unlock</button>
          <p class="err" role="alert" aria-live="polite"></p>
        </form>
        <p class="hint">Demo password: <code>SSC123</code> (published in the project presentation).
        This is a client-side demonstration of the access model, not a security control —
        see <a href="${REPO_URL}/blob/main/docs/architecture.md#layered-access" target="_blank" rel="noopener">architecture notes</a>.</p>
      </div>`;
  } else {
    body = `<dl class="fields">${section.fields
      .map((f) => `<div class="field"><dt>${escapeHtml(f.label)}</dt><dd>${renderValue(f)}</dd></div>`)
      .join("")}</dl>`;
  }
  return `<h2 id="panel-title">${escapeHtml(section.title)} ${badge}</h2>${body}`;
}

function render() {
  const stats = fieldStats(record);
  const statusField = record.sections[0].fields.find((f) => f.label === "Product status");
  const documented = record.recordStatus === "documented";
  const tabs = record.sections.map((s) => `
    <button role="tab" id="tab-${s.key}" aria-controls="panel" aria-selected="${s.key === activeKey}"
      tabindex="${s.key === activeKey ? 0 : -1}" data-key="${s.key}">
      <span>${escapeHtml(s.title)}</span>${s.access === "restricted" ? (isUnlocked() ? icons.unlock : icons.lock) : ""}
    </button>`).join("");
  const active = record.sections.find((s) => s.key === activeKey);

  app.innerHTML = `
    <section class="card pp-header" aria-labelledby="pp-title">
      <div>
        <div class="pp-meta">
          ${documented
            ? `<span class="badge badge-ok">${icons.check} Documented record</span>`
            : `<span class="badge badge-pending">${icons.clock} Placeholder record</span>`}
          ${statusField && statusField.value ? `<span class="badge badge-pending">Status: ${escapeHtml(statusField.value)}</span>` : ""}
        </div>
        <span class="eyebrow" style="margin:0">Battery Digital Product Passport</span>
        <h1 id="pp-title">${escapeHtml(record.productName)}</h1>
        <div class="uid-line">
          <span class="muted" style="font-family:var(--font);font-size:.9rem">UID</span>
          <span class="val">${record.uid ? escapeHtml(record.uid) : '<span class="pending">not assigned</span>'}</span>
          ${record.uid ? `<button class="icon-btn" type="button" data-copy="${escapeHtml(record.uid)}" aria-label="Copy UID" title="Copy UID">${icons.copy}</button>` : ""}
        </div>
        <div class="progress">
          <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${stats.total}" aria-valuenow="${stats.filled}" aria-label="Data completeness"><i style="width:${stats.pct}%"></i></div>
          <small>${stats.filled} of ${stats.total} attributes populated (${stats.pct}%)</small>
        </div>
      </div>
      <div class="qr-side">
        <div class="qr-frame"><img src="qr/${record.id}.svg" width="136" height="136" alt="QR code linking to this passport"></div>
        <a class="btn btn-ghost btn-sm" href="qr/${record.id}.png" download="dpp-${record.id}-qr.png">${icons.download} QR (PNG)</a>
      </div>
    </section>

    ${documented ? "" : `
    <div class="notice warn" role="note">${icons.info}
      <div><strong>Placeholder record.</strong> This battery was listed in the project presentation with its own QR code,
      but its attribute data was not part of the submitted documentation. The record keeps the full attribute
      structure so it can be populated without code changes. See the
      <a href="passport.html?id=solid-state-cell">Solid State Cell</a> for a documented passport.</div>
    </div>`}

    <div class="pp-body">
      <nav class="card tabs" role="tablist" aria-label="Passport categories" aria-orientation="vertical">${tabs}</nav>
      <section class="card section-panel" id="panel" role="tabpanel" aria-labelledby="tab-${activeKey}" tabindex="-1">
        ${sectionPanel(active)}
      </section>
    </div>

    <div class="pp-tools">
      <p class="source">${record.source ? `<strong>Source:</strong> ${escapeHtml(record.source)}` : ""}
      ${record.legacyQr ? `<br>Replaces the deactivated dynamic QR link <code>${escapeHtml(record.legacyQr)}</code>.` : ""}</p>
      <button class="btn btn-ghost btn-sm" type="button" data-export>${icons.download} Export JSON${isUnlocked() ? "" : " (public layer)"}</button>
    </div>`;

  document.title = `${record.productName} · Battery Digital Product Passport`;
  wire();
}

function selectTab(key, focus = false) {
  if (!record.sections.some((s) => s.key === key)) return;
  activeKey = key;
  history.replaceState(null, "", `#${key}`);
  render();
  if (focus) document.getElementById(`tab-${key}`)?.focus();
}

function wire() {
  const tabList = app.querySelector('[role="tablist"]');
  // On narrow screens the tab list scrolls horizontally: keep the active tab in view
  // without moving the page vertically.
  const activeTab = tabList.querySelector('[aria-selected="true"]');
  if (activeTab && tabList.scrollWidth > tabList.clientWidth) {
    tabList.scrollLeft = activeTab.offsetLeft - (tabList.clientWidth - activeTab.offsetWidth) / 2;
  }
  tabList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-key]");
    if (btn) selectTab(btn.dataset.key, true);
  });
  tabList.addEventListener("keydown", (e) => {
    const keys = record.sections.map((s) => s.key);
    const i = keys.indexOf(activeKey);
    const next = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: keys.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    selectTab(keys[(next + keys.length) % keys.length], true);
  });

  const form = app.querySelector(".lock-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = form.pw.value;
    const err = form.querySelector(".err");
    if (!pw) { err.textContent = "Please enter the access password."; return; }
    if (!crypto?.subtle) { err.textContent = "Secure context required (open via https or localhost)."; return; }
    if ((await sha256Hex(pw)) === registry.demoAccess.restrictedHash) {
      setUnlocked();
      render();
      document.getElementById("panel")?.focus();
    } else {
      err.textContent = "Incorrect password.";
      form.pw.select();
    }
  });

  app.querySelector("[data-copy]")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try { await navigator.clipboard.writeText(btn.dataset.copy); btn.innerHTML = icons.check; }
    catch { /* clipboard blocked */ }
    setTimeout(() => (btn.innerHTML = icons.copy), 1400);
  });

  app.querySelector("[data-export]")?.addEventListener("click", () => {
    const unlocked = isUnlocked();
    const out = structuredClone(record);
    delete out.$schema;
    if (!unlocked) {
      out.sections = out.sections.map((s) => s.access === "restricted"
        ? { key: s.key, title: s.title, access: s.access, redacted: true }
        : s);
    }
    out.exportedAt = new Date().toISOString();
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob), download: `dpp-${record.id}${unlocked ? "" : "-public"}.json`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

function showError(title, message) {
  const links = registry
    ? `<p>${registry.passports.map((p) => `<a href="passport.html?id=${p.id}">${escapeHtml(p.productName)}</a>`).join(" · ")}</p>`
    : "";
  app.innerHTML = `<section class="card error-state"><h1 style="font-size:1.8rem">${escapeHtml(title)}</h1>
    <p class="muted">${escapeHtml(message)}</p>${links}<p><a class="btn btn-primary" href="./">Back to overview</a></p></section>`;
  document.title = `${title} · Battery Digital Product Passport`;
}

async function main() {
  try {
    registry = await fetchJSON("data/passports.json");
  } catch {
    showError("Could not load passport registry", "Check your connection. When running locally, serve the folder over HTTP (see README).");
    return;
  }
  if (!id) { showError("No passport selected", "Scan a battery QR code or choose a passport:"); return; }
  if (!registry.passports.some((p) => p.id === id)) {
    showError("Passport not found", `No battery passport with id “${id}”. Available passports:`);
    return;
  }
  try {
    record = await fetchJSON(`data/passports/${id}.json`);
  } catch {
    showError("Could not load passport", "The passport record could not be retrieved.");
    return;
  }
  const hashKey = location.hash.slice(1);
  activeKey = record.sections.some((s) => s.key === hashKey) ? hashKey : record.sections[0].key;
  render();
}

main();
