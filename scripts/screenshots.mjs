// Capture README screenshots. Serve the site first (python -m http.server 8123), then:
//   BASE_URL=http://127.0.0.1:8123/ node scripts/screenshots.mjs
// Set PW_CHANNEL=chrome to use an installed Google Chrome.
import { chromium, devices } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/";
const OUT = "docs/images/screenshots";

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });

async function shot(name, path, { viewport = { width: 1440, height: 900 }, theme = "light", full = false, device, before } = {}) {
  const ctx = await browser.newContext(device ? { ...devices[device], colorScheme: theme } : { viewport, colorScheme: theme, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
  if (before) await before(page);
  await page.evaluate(() => Promise.all([...document.images].map((i) => { i.loading = "eager"; return i.decode().catch(() => {}); })));
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  await ctx.close();
  console.log("saved", name);
}

const unlock = async (page) => {
  await page.getByPlaceholder("Enter access password").fill("SSC123");
  await page.getByRole("button", { name: "Unlock" }).click();
  await page.waitForTimeout(200);
};

await shot("landing", "");
await shot("landing-dark", "", { theme: "dark" });
await shot("passports-gallery", "#passports", { before: (p) => p.waitForTimeout(400) });
await shot("passport-public", "passport.html?id=solid-state-cell#material-composition");
await shot("passport-locked", "passport.html?id=solid-state-cell#technical-data");
await shot("passport-unlocked", "passport.html?id=solid-state-cell#technical-data", { before: unlock });
await shot("passport-mobile", "passport.html?id=solid-state-cell#manufacturing-data", { device: "Pixel 7" });
await shot("passport-sodium-ion", "passport.html?id=sodium-ion-cell");
await shot("uid-decoder", "#uid", { before: (p) => p.waitForTimeout(400) });
await shot("labels", "labels.html");
await shot("social-preview", "", { viewport: { width: 1280, height: 640 } });

await browser.close();
