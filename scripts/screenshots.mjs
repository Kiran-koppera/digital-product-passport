// Capture README screenshots. Serve the site first (python -m http.server 8123), then:
//   BASE_URL=http://127.0.0.1:8123/ node scripts/screenshots.mjs
// Set PW_CHANNEL=chrome to use an installed Google Chrome.
import fs from "node:fs";
import { chromium, devices } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/";
const OUT = "docs/images/screenshots";
const P = "passport.html?id=vw-id-polo-lfp-37";

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });

async function shot(name, path, { viewport = { width: 1440, height: 900 }, theme = "light", full = false, device } = {}) {
  const ctx = await browser.newContext(device ? { ...devices[device], colorScheme: theme } : { viewport, colorScheme: theme, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => Promise.all([...document.images].map((i) => { i.loading = "eager"; return i.decode().catch(() => {}); })));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  await ctx.close();
  console.log("saved", name);
}

await shot("landing", "");
await shot("landing-dark", "", { theme: "dark" });
await shot("passport", P);
await shot("passport-recycler", `${P}&role=legitimate-interest`, { theme: "dark" });
await shot("passport-mobile", P, { device: "Pixel 7" });
await shot("social-preview", "", { viewport: { width: 1280, height: 640 } });

await browser.close();
