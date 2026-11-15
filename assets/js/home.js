// Landing page: passport gallery (rendered from data/) and the interactive UID decoder.
import { escapeHtml, fetchJSON, fieldStats, icons, initThemeToggle } from "./common.js";
import { parseUid, proposeChecksum } from "./uid.js";

initThemeToggle();

async function renderGallery() {
  const grid = document.getElementById("passport-grid");
  try {
    const registry = await fetchJSON("data/passports.json");
    const records = await Promise.all(registry.passports.map((p) => fetchJSON(`data/passports/${p.id}.json`)));
    grid.innerHTML = records.map((r) => {
      const s = fieldStats(r);
      return `
      <article class="card pp-card">
        <div class="qr-frame"><img src="qr/${r.id}.svg" alt="QR code for the ${escapeHtml(r.productName)} passport" width="220" height="220" loading="lazy"></div>
        <div>
          ${{
            documented: `<span class="badge badge-ok">${icons.check} Active · ${s.filled}/${s.total} attributes</span>`,
            placeholder: `<span class="badge badge-pending">${icons.clock} Placeholder</span>`,
          }[r.recordStatus]}
        </div>
        <h3>${escapeHtml(r.productName)}</h3>
        <div class="uid">${r.uid ? escapeHtml(r.uid).replaceAll("-", "-<wbr>") : "UID not assigned in source"}</div>
        <div class="actions">
          <a class="btn btn-primary btn-sm" href="passport.html?id=${r.id}">Open passport ${icons.arrow}</a>
          <a class="btn btn-ghost btn-sm" href="qr/${r.id}.png" download="dpp-${r.id}-qr.png" aria-label="Download ${escapeHtml(r.productName)} QR code as PNG">${icons.download} PNG</a>
          <a class="btn btn-ghost btn-sm" href="qr/${r.id}.svg" download="dpp-${r.id}-qr.svg" aria-label="Download ${escapeHtml(r.productName)} QR code as SVG">SVG</a>
        </div>
      </article>`;
    }).join("");
  } catch (err) {
    grid.innerHTML = `<p class="muted">Could not load passport data (${escapeHtml(err.message)}). When running locally, serve the folder over HTTP — see the README.</p>`;
  }
}

function initUidTool() {
  const input = document.getElementById("uid-input");
  const out = document.getElementById("uid-segments");
  const msg = document.getElementById("uid-msg");
  const update = () => {
    const res = parseUid(input.value);
    out.innerHTML = res.segments.map((s) => `
      <div class="seg${s.missing ? " missing" : ""}" style="--c:${s.color}">
        <code>${s.missing ? "absent" : escapeHtml(s.value)}</code><span>${escapeHtml(s.label)}</span>
      </div>`).join("");
    if (!res.segments.length) {
      msg.className = "uid-msg bad";
      msg.textContent = res.problems.join(" ");
      return;
    }
    const body = res.uid.split("-").slice(0, -1).join("-");
    const crc = proposeChecksum(body);
    msg.className = `uid-msg${res.ok ? "" : " bad"}`;
    msg.innerHTML = (res.ok ? "✓ Format matches the project's UID scheme. " : `${res.problems.map(escapeHtml).join(" ")} `)
      + `<span class="muted">Proposed CRC-8 check code for <code>${escapeHtml(body)}</code> would be <code>${crc}</code>
         (repository extension — the original project used a fixed “A3”).</span>`;
  };
  input.addEventListener("input", update);
  document.querySelectorAll("[data-uid-example]").forEach((b) =>
    b.addEventListener("click", () => { input.value = b.dataset.uidExample; update(); input.focus(); }));
  update();
}

renderGallery();
initUidTool();
