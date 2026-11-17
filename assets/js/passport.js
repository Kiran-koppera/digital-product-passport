// Passport viewer: passport.html?id=<passport-id>[&role=<access level>][#section-key]
import {
  LEVELS, PROVENANCE, allFields, canSee, coverage, escapeHtml, fetchJSON, formatDate, getRole, icons,
  initBrand, initThemeToggle, provenanceBar, setRole,
} from "./common.js";

initThemeToggle();
initBrand();

const app = document.getElementById("app");
const roleBar = document.getElementById("role-switch");
const id = (new URLSearchParams(location.search).get("id") || "").trim().toLowerCase();

let registry, record, role = getRole();
let srcIndex = {};

const level = (key) => registry.accessLevels.find((a) => a.key === key);
const field = (key) => allFields(record).find((f) => f.key === key);

function sourceRefs(f) {
  if (!f.sources.length) return "";
  return `<span class="refs">${f.sources.map((s) => {
    const n = srcIndex[s];
    return `<a href="#src-${escapeHtml(s)}" title="${escapeHtml(record.sources[n - 1].title)}">[${n}]</a>`;
  }).join("")}</span>`;
}

function renderValue(f) {
  const v = f.value;
  if (v === null) return `<span class="gap">Not published by the manufacturer</span>`;
  if (Array.isArray(v)) return `<ul class="vlist">${v.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
  if (f.format === "date") return `<time datetime="${escapeHtml(v)}">${formatDate(v)}</time>`;
  if (f.format === "mono") return `<code>${escapeHtml(v)}</code>`;
  return `${escapeHtml(v)}${f.unit ? ` <span class="unit">${escapeHtml(f.unit)}</span>` : ""}`;
}

function fieldRow(f) {
  const p = PROVENANCE[f.provenance];
  return `
    <div class="frow" id="f-${escapeHtml(f.key)}">
      <dt>${escapeHtml(f.label)}${f.annex ? `<span class="annex">${escapeHtml(f.annex)}</span>` : ""}</dt>
      <dd>
        <div class="fval">${renderValue(f)}</div>
        ${f.note ? `<p class="fnote">${escapeHtml(f.note)}</p>` : ""}
      </dd>
      <div class="fmeta"><span class="prov pv-${f.provenance}" title="${escapeHtml(p.desc)}">${escapeHtml(p.label)}</span>${sourceRefs(f)}</div>
    </div>`;
}

function sohChart(points) {
  if (!points?.length) return "";
  const W = 560, H = 150, pad = { l: 40, r: 12, t: 14, b: 26 };
  const t0 = Date.parse(points[0].date), t1 = Date.parse(points.at(-1).date);
  const lo = 98, hi = 100;
  const x = (d) => pad.l + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.soh).toFixed(1)}`).join("");
  const ticks = [98, 99, 100].map((v) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${v} %</text>`).join("");
  const last = points.at(-1);
  const fmt = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `
    <figure class="soh-chart">
      <figcaption>State of health since manufacture <span class="prov pv-simulated">Simulated</span></figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="State of health fell from 100 % to ${last.soh} % between ${fmt(points[0].date)} and ${fmt(last.date)}">
        ${ticks}
        <path d="${path}" class="line"/>
        ${points.map((p) => `<circle cx="${x(p.date)}" cy="${y(p.soh)}" r="3" class="pt"/>`).join("")}
        <text x="${x(last.date) - 6}" y="${y(last.soh) - 9}" text-anchor="end" class="lbl">${last.soh} %</text>
        <text x="${pad.l}" y="${H - 6}">${fmt(points[0].date)}</text>
        <text x="${W - pad.r}" y="${H - 6}" text-anchor="end">${fmt(last.date)}</text>
      </svg>
    </figure>`;
}

function sectionCard(s) {
  const lv = level(s.access);
  const visible = canSee(role, s.access);
  const badge = s.access === "public"
    ? `<span class="badge badge-public">Public</span>`
    : `<span class="badge badge-restricted">${visible ? icons.unlock : icons.lock} ${escapeHtml(lv.label)}</span>`;
  const head = `
    <header class="sec-head">
      <div><h2>${escapeHtml(s.title)}</h2><span class="annex">${escapeHtml(s.annex)}</span></div>
      <div class="sec-badges">${s.dynamic ? `<span class="badge badge-live">${icons.pulse} Dynamic data</span>` : ""}${badge}</div>
    </header>`;
  if (!visible) {
    const target = s.access;
    return `
      <section class="card sec sec-locked" id="${s.key}" aria-labelledby="h-${s.key}">
        ${head.replace("<h2>", `<h2 id="h-${s.key}">`)}
        <div class="locked">
          ${icons.lock}
          <div>
            <p><strong>Restricted to ${escapeHtml(lv.label.toLowerCase())}.</strong> ${escapeHtml(lv.who)} (${escapeHtml(lv.annex)}).
              ${s.fields.length} attributes.</p>
            <button class="btn btn-ghost btn-sm" type="button" data-role="${target}">View as ${escapeHtml(lv.label.toLowerCase())} (demo)</button>
          </div>
        </div>
      </section>`;
  }
  return `
    <section class="card sec" id="${s.key}" aria-labelledby="h-${s.key}">
      ${head.replace("<h2>", `<h2 id="h-${s.key}">`)}
      ${s.summary ? `<p class="sec-summary">${escapeHtml(s.summary)}</p>` : ""}
      ${s.key === "state-of-health" ? sohChart(record.sohHistory) : ""}
      <dl class="fields">${s.fields.map(fieldRow).join("")}</dl>
    </section>`;
}

function kpi(icon, label, value, sub, access = "public", cls = "") {
  const locked = !canSee(role, access);
  return `
    <div class="kpi ${cls}">
      <span class="kpi-ico">${locked ? icons.lock : icon}</span>
      <span class="kpi-label">${label}</span>
      <b class="kpi-value">${locked ? "Restricted" : value}</b>
      <span class="kpi-sub">${locked ? escapeHtml(level(access).label) : sub}</span>
    </div>`;
}

function render() {
  const c = coverage(record);
  const v = (k) => field(k)?.value;
  const visibleSections = record.sections.filter((s) => canSee(role, s.access));
  const gaps = record.sections.flatMap((s) => s.fields.filter((f) => f.value === null).map((f) => ({ s, f })));

  const nav = LEVELS.map((lk) => {
    const secs = record.sections.filter((s) => s.access === lk);
    if (!secs.length) return "";
    const open = canSee(role, lk);
    return `
      <div class="nav-group">
        <span class="nav-level">${open ? "" : icons.lock}${escapeHtml(level(lk).label)}</span>
        ${secs.map((s) => `<a href="#${s.key}" class="${open ? "" : "is-locked"}">${escapeHtml(s.title)}</a>`).join("")}
      </div>`;
  }).join("") + `
      <div class="nav-group">
        <span class="nav-level">Evidence</span>
        <a href="#gaps">Data gaps</a><a href="#sources">Sources</a>
      </div>`;

  app.innerHTML = `
    <section class="pp-hero card" aria-labelledby="pp-title">
      <div class="pp-id">
        <div class="pp-badges">
          <span class="badge badge-eu">${icons.shield} EU Battery Passport</span>
          <span class="badge">${escapeHtml(record.batteryCategory)}</span>
          <span class="badge badge-ok">${icons.check} Status: ${escapeHtml(record.status[0].toUpperCase() + record.status.slice(1))}</span>
        </div>
        <h1 id="pp-title">${escapeHtml(record.productName)}</h1>
        <p class="pp-vehicle">${escapeHtml(record.vehicle || "")}</p>
        <dl class="pp-meta">
          <div><dt>Battery identifier</dt><dd><code>${escapeHtml(record.uid)}</code>
            <button class="icon-btn icon-btn-sm" type="button" data-copy="${escapeHtml(record.uid)}" aria-label="Copy identifier" title="Copy identifier">${icons.copy}</button></dd></div>
          <div><dt>Economic operator</dt><dd>${escapeHtml(v("operator").split(",")[0])}</dd></div>
          <div><dt>Place of manufacture</dt><dd>${escapeHtml(v("place").split(",").slice(-2).join(",").trim())}</dd></div>
          <div><dt>Date of manufacture</dt><dd>${formatDate(v("date"))}</dd></div>
          <div><dt>Passport data version</dt><dd>${escapeHtml(record.dataVersion)} · updated ${formatDate(record.lastUpdated)}</dd></div>
        </dl>
      </div>
      <div class="pp-qr">
        <div class="qr-frame"><img src="qr/${record.id}.svg" width="148" height="148" alt="QR code linking to this battery passport"></div>
        <span class="qr-cap">Scan to open this passport</span>
        <a class="btn btn-ghost btn-sm" href="qr/${record.id}.png" download="battery-passport-${record.id}-qr.png">${icons.download} QR code</a>
      </div>
    </section>

    <section class="kpis" aria-label="Key facts">
      ${kpi(icons.cell, "Chemistry", "LFP", "LiFePO₄ · cobalt- and nickel-free")}
      ${kpi(icons.bolt, "Usable energy", `${v("e-net")} <small>kWh</small>`, `${v("e-gross")} kWh installed · ${v("cells")} cells`)}
      ${kpi(icons.bolt, "DC charging", `${v("dc")} <small>kW</small>`, `10–80 % in ≈ ${v("dc-time").replace("≈ ", "")} min`)}
      ${kpi(icons.shield, "Warranty", `8 <small>years</small>`, "or 160,000 km · ≥ 70 % SoH")}
      ${kpi(icons.leaf, "Carbon footprint", `≈ ${v("cf-lit")} <small>kg/kWh</small>`, "CO₂e, indicative (literature) · Art. 7 value not yet declared", "public", "kpi-warn")}
      ${kpi(icons.pulse, "State of health", `${v("soh")} <small>%</small>`, `${v("efc")} full cycles · simulated`, "legitimate-interest")}
    </section>

    <div class="pp-body">
      <aside class="pp-nav card" aria-label="Passport sections">${nav}</aside>
      <div class="pp-main">
        <section class="card quality" aria-labelledby="q-h">
          <div class="quality-head">
            <div>
              <h2 id="q-h">Data provenance</h2>
              <p class="muted">${c.filled} of ${c.total} Annex XIII attributes have a value. ${c.gaps} are gaps that only the manufacturer can close. Every value is tagged with where it comes from.</p>
            </div>
            <div class="quality-score"><b>${c.pct}%</b><span>coverage</span></div>
          </div>
          ${provenanceBar(record)}
          <p class="role-note">${icons.info}<span>Viewing as <strong>${escapeHtml(level(role).label)}</strong>: ${visibleSections.length} of ${record.sections.length} sections visible.
            Use the access switch at the top to see what each group in Annex XIII can read.</span></p>
        </section>

        ${record.sections.map(sectionCard).join("")}

        <section class="card sec" id="gaps" aria-labelledby="h-gaps">
          <header class="sec-head"><div><h2 id="h-gaps">Data gaps</h2><span class="annex">Gap report against Annex XIII</span></div>
            <div class="sec-badges"><span class="badge badge-gap">${gaps.length} open</span></div></header>
          <p class="sec-summary">Attributes the regulation requires or the Battery Pass guidance recommends, which Volkswagen has not published. A manufacturer-issued passport must fill these before 18 February 2027.</p>
          <ol class="gap-list">${gaps.map(({ s, f }) => `
            <li><a href="#${canSee(role, s.access) ? `f-${f.key}` : s.key}">${escapeHtml(f.label)}</a>
              <span>${escapeHtml(s.title)}${f.annex ? ` · ${escapeHtml(f.annex)}` : ""}</span></li>`).join("")}</ol>
        </section>

        <section class="card sec" id="sources" aria-labelledby="h-src">
          <header class="sec-head"><div><h2 id="h-src">Sources</h2><span class="annex">Public documents this passport cites</span></div></header>
          <ol class="src-list">${record.sources.map((s) => `
            <li id="src-${escapeHtml(s.id)}"><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title)} ${icons.ext}</a>
              <span>${escapeHtml(s.publisher)}${s.date ? ` · ${escapeHtml(s.date)}` : ""}</span></li>`).join("")}</ol>
        </section>

        <div class="pp-tools">
          <p class="disclaimer">${icons.info} ${escapeHtml(record.caseStudy)}</p>
          <div class="tool-btns">
            <button class="btn btn-ghost btn-sm" type="button" data-print>${icons.print} Print / PDF</button>
            <button class="btn btn-primary btn-sm" type="button" data-export>${icons.download} Export JSON (${escapeHtml(level(role).label.toLowerCase())})</button>
          </div>
        </div>
      </div>
    </div>`;

  document.title = `${record.productName} · Battery Passport`;
  renderRoleBar();
  wire();
}

function renderRoleBar() {
  roleBar.innerHTML = `
    <span class="role-label">Access</span>
    <div class="seg" role="radiogroup" aria-label="View passport as">
      ${registry.accessLevels.map((a) => `
        <button type="button" role="radio" aria-checked="${a.key === role}" data-role="${a.key}" title="${escapeHtml(a.who)}">${escapeHtml(a.label)}</button>`).join("")}
    </div>`;
}

function switchRole(next) {
  if (!LEVELS.includes(next) || next === role) return;
  const anchor = location.hash;
  role = next;
  setRole(role);
  const url = new URL(location.href);
  url.searchParams.delete("role");
  history.replaceState(null, "", url);
  render();
  if (anchor) document.querySelector(anchor)?.scrollIntoView({ block: "start" });
}

function wire() {
  document.querySelectorAll("[data-role]").forEach((b) => b.addEventListener("click", () => switchRole(b.dataset.role)));

  app.querySelector("[data-copy]")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try { await navigator.clipboard.writeText(btn.dataset.copy); btn.innerHTML = icons.check; } catch { /* clipboard blocked */ }
    setTimeout(() => (btn.innerHTML = icons.copy), 1400);
  });

  app.querySelector("[data-print]")?.addEventListener("click", () => window.print());

  app.querySelector("[data-export]")?.addEventListener("click", () => {
    const out = structuredClone(record);
    delete out.$schema;
    out.sections = out.sections.map((s) => canSee(role, s.access)
      ? s : { key: s.key, title: s.title, annex: s.annex, access: s.access, redacted: true });
    if (!canSee(role, "legitimate-interest")) delete out.sohHistory;
    out.exportedFor = role;
    out.exportedAt = new Date().toISOString();
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob), download: `battery-passport-${record.id}-${role}.json`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

function showError(title, message) {
  const links = registry
    ? `<p>${registry.passports.map((p) => `<a href="passport.html?id=${p.id}">${escapeHtml(p.productName)}</a>`).join(" · ")}</p>`
    : "";
  app.innerHTML = `<section class="card error-state"><h1>${escapeHtml(title)}</h1>
    <p class="muted">${escapeHtml(message)}</p>${links}<p><a class="btn btn-primary" href="./">Back to overview</a></p></section>`;
  document.title = `${title} · Battery Passport`;
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
  srcIndex = Object.fromEntries(record.sources.map((s, i) => [s.id, i + 1]));
  render();
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ block: "start" });
}

main();
