// Landing page: passport preview, access groups and provenance, rendered from data/; UID decoder.
import { PROVENANCE, allFields, coverage, escapeHtml, fetchJSON, icons, initBrand, initThemeToggle, provenanceBar } from "./common.js";
import { parseUid, proposeChecksum } from "./uid.js";

initThemeToggle();
initBrand();

async function renderData() {
  try {
    const registry = await fetchJSON("data/passports.json");
    const pid = registry.passports[0].id;
    const r = await fetchJSON(`data/passports/${pid}.json`);
    const v = (k) => allFields(r).find((f) => f.key === k)?.value;
    const c = coverage(r);

    const stats = document.getElementById("hero-stats");
    stats.children[0].querySelector("b").textContent = c.total;
    stats.children[1].querySelector("b").textContent = r.sources.length;
    stats.children[2].querySelector("b").textContent = registry.accessLevels.length;

    document.getElementById("preview").innerHTML = `
      <div class="preview-top">
        <div><span class="badge badge-eu">${icons.shield} EU Battery Passport</span>
          <h3 style="margin-top:10px">${escapeHtml(r.productName)}</h3><p>${escapeHtml(r.vehicle)}</p></div>
        <span class="badge badge-ok">${icons.check} ${escapeHtml(r.status[0].toUpperCase() + r.status.slice(1))}</span>
      </div>
      <div class="preview-body">
        <div class="qr-frame"><img src="qr/${r.id}.svg" width="124" height="124" alt="QR code for the ${escapeHtml(r.productName)} passport"></div>
        <div class="preview-rows">
          <div><span>Chemistry</span><span>LFP (LiFePO₄)</span></div>
          <div><span>Usable energy</span><span>${escapeHtml(v("e-net"))} kWh</span></div>
          <div><span>Cells</span><span>${escapeHtml(v("cells"))} · cell-to-pack</span></div>
          <div><span>DC charging</span><span>${escapeHtml(v("dc"))} kW</span></div>
          <div><span>Assembled in</span><span>Martorell, ES</span></div>
          <div><span>Coverage</span><span>${c.filled}/${c.total} attributes</span></div>
        </div>
      </div>
      <p class="preview-foot">${icons.info} Scan with a phone camera. The code links straight to the passport.</p>`;

    document.getElementById("access-grid").innerHTML = registry.accessLevels.map((a) => {
      const secs = r.sections.filter((s) => s.access === a.key);
      const href = (s) => `passport.html?id=${r.id}${a.key === "public" ? "" : `&role=${a.key}`}#${s.key}`;
      return `
        <article class="card access-card">
          <span class="badge ${a.key === "public" ? "badge-public" : "badge-restricted"}">${escapeHtml(a.annex)}</span>
          <h3 style="margin-top:12px">${a.key === "public" ? "" : icons.lock}${escapeHtml(a.label)}</h3>
          <p class="who">${escapeHtml(a.who)}</p>
          <ul>${secs.map((s) => `<li><a href="${href(s)}"><span>${escapeHtml(s.title)}</span><small>${s.fields.length} attributes</small></a></li>`).join("")}</ul>
        </article>`;
    }).join("");

    const gaps = allFields(r).filter((f) => f.value === null);
    document.getElementById("evidence-bar").innerHTML = `
      <p class="muted" style="font-size:.9rem">${c.filled} of ${c.total} attributes have a value. ${c.gaps} are open gaps that only Volkswagen can close, including:</p>
      ${provenanceBar(r)}
      <ul class="top-gaps">${gaps.slice(2, 8).concat(gaps.slice(0, 1)).map((f) => `<li>${escapeHtml(f.label)}</li>`).join("")}</ul>
      <p style="margin:14px 0 0"><a href="passport.html?id=${r.id}#gaps">See the full gap report →</a></p>`;

    document.querySelector("#prov-table tbody").innerHTML = Object.entries(PROVENANCE).map(([k, p]) => `
      <tr><td><span class="prov pv-${k}">${escapeHtml(p.label)}</span></td><td>${escapeHtml(p.desc)}</td><td style="text-align:right"><b>${c.byProvenance[k]}</b></td></tr>`).join("");
  } catch (err) {
    document.getElementById("preview").innerHTML = `<p class="muted">Could not load passport data (${escapeHtml(err.message)}). When running locally, serve the folder over HTTP; see the README.</p>`;
  }
}

function initUidTool() {
  const input = document.getElementById("uid-input");
  const out = document.getElementById("uid-segments");
  const msg = document.getElementById("uid-msg");
  const update = () => {
    const res = parseUid(input.value);
    out.innerHTML = res.segments.map((s) => `
      <div class="seg-box${s.missing ? " missing" : ""}" style="--c:${s.color}">
        <code>${s.missing ? "absent" : escapeHtml(s.value)}</code><span>${escapeHtml(s.label)}</span>
      </div>`).join("");
    if (!res.segments.length) {
      msg.className = "uid-msg bad";
      msg.textContent = res.problems.join(" ");
      return;
    }
    const parts = res.uid.split("-");
    const body = parts.slice(0, -1).join("-");
    const crc = proposeChecksum(body);
    const given = parts.at(-1);
    const ok = res.ok && crc === given;
    msg.className = `uid-msg${ok ? "" : " bad"}`;
    msg.innerHTML = res.ok
      ? (crc === given
        ? `✓ Valid format and check code <code>${crc}</code> (CRC-8 over <code>${escapeHtml(body)}</code>).`
        : `Format is valid, but the check code should be <code>${crc}</code>, not <code>${escapeHtml(given)}</code>. The original project used a fixed “A3”.`)
      : res.problems.map(escapeHtml).join(" ");
  };
  input.addEventListener("input", update);
  document.querySelectorAll("[data-uid-example]").forEach((b) =>
    b.addEventListener("click", () => { input.value = b.dataset.uidExample; update(); input.focus(); }));
  update();
}

renderData();
initUidTool();
