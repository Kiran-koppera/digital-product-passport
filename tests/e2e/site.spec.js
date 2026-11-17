// End-to-end tests for the static site. Run locally with `npx playwright test`,
// or against the live deployment with BASE_URL=https://kiran-koppera.github.io/digital-product-passport/
import { expect, test } from "@playwright/test";
import fs from "node:fs";

const registry = JSON.parse(fs.readFileSync("data/passports.json", "utf8"));
const ID = registry.passports[0].id;
const record = JSON.parse(fs.readFileSync(`data/passports/${ID}.json`, "utf8"));
const PASSPORT = `passport.html?id=${ID}`;

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => { throw err; });
});

test("landing page shows the passport preview with a working QR code", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("battery passport");
  const qr = page.locator(`#preview img[src="qr/${ID}.svg"]`);
  await expect(qr).toBeVisible();
  await expect.poll(() => qr.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(page.locator("#preview")).toContainText("37 kWh");
});

test("landing page lists the three Annex XIII access groups", async ({ page }) => {
  await page.goto("./#access");
  await expect(page.locator(".access-card")).toHaveCount(3);
  await expect(page.locator("#access-grid")).toContainText("Detailed composition");
  await expect(page.locator("#access-grid")).toContainText("Conformity & test reports");
});

test("all images on the landing page load", async ({ page }) => {
  await page.goto("./");
  await page.locator("#preview img").waitFor();
  const broken = await page.$$eval("img", (imgs) =>
    imgs.filter((i) => { i.loading = "eager"; return i.complete && i.naturalWidth === 0; }).map((i) => i.src));
  expect(broken).toEqual([]);
});

test("passport renders identity, key facts and every section", async ({ page }) => {
  await page.goto(PASSPORT);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(record.productName);
  await expect(page).toHaveTitle(new RegExp(record.productName));
  await expect(page.locator(".pp-meta")).toContainText(record.uid);
  await expect(page.locator(".kpis")).toContainText("LFP");
  await expect(page.locator(".kpis")).toContainText("88");
  await expect(page.locator("section.sec")).toHaveCount(record.sections.length + 2); // + gaps, sources
});

test("public view shows public data and locks restricted sections", async ({ page }) => {
  await page.goto(PASSPORT);
  await expect(page.locator("#performance")).toContainText("Cell-to-pack");
  await expect(page.locator("#performance")).toContainText("8 years or 160,000 km");
  await expect(page.locator("#composition")).toContainText("Restricted to legitimate interest");
  await expect(page.locator("#composition")).not.toContainText("LiFePO₄ active material");
  await expect(page.locator("#conformity")).toContainText("Restricted to authorities");
  await expect(page.locator(".kpis")).toContainText("Restricted");
});

test("access switch reveals sections by role and persists", async ({ page }) => {
  await page.goto(PASSPORT);
  await page.getByRole("radio", { name: "Legitimate interest" }).click();
  await expect(page.getByRole("radio", { name: "Legitimate interest" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#composition")).toContainText("LiFePO₄ active material");
  await expect(page.locator("#state-of-health").getByRole("img", { name: /State of health fell/ })).toBeVisible();
  await expect(page.locator("#conformity")).toContainText("Restricted to authorities");

  await page.reload();
  await expect(page.locator("#composition")).toContainText("LiFePO₄ active material");

  await page.getByRole("radio", { name: "Authorities" }).click();
  await expect(page.locator("#conformity")).toContainText("UN Regulation No. 100");
});

test("role can be set by URL for deep links", async ({ page }) => {
  await page.goto(`${PASSPORT}&role=legitimate-interest#dismantling`);
  await expect(page.locator("#dismantling")).toContainText("102 cells");
});

test("every value shows its provenance and sources resolve", async ({ page }) => {
  await page.goto(`${PASSPORT}&role=authority`);
  const total = record.sections.reduce((n, s) => n + s.fields.length, 0);
  await expect(page.locator(".frow .prov")).toHaveCount(total);
  await expect(page.locator("#sources li")).toHaveCount(record.sources.length);
  await page.locator("#f-e-net .refs a").first().click();
  await expect(page).toHaveURL(/#src-/);
});

test("gap report lists every unpublished attribute", async ({ page }) => {
  await page.goto(PASSPORT);
  const gaps = record.sections.flatMap((s) => s.fields).filter((f) => f.value === null).length;
  await expect(page.locator("#gaps .gap-list li")).toHaveCount(gaps);
  await expect(page.locator("#gaps")).toContainText("Declared carbon footprint");
});

test("public JSON export redacts restricted sections", async ({ page }) => {
  await page.goto(PASSPORT);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Export JSON/ }).click()]);
  const data = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  const comp = data.sections.find((s) => s.key === "composition");
  expect(comp.redacted).toBe(true);
  expect(comp.fields).toBeUndefined();
  expect(data.sohHistory).toBeUndefined();
  expect(data.exportedFor).toBe("public");
});

test("unknown passport id shows a helpful error", async ({ page }) => {
  await page.goto("passport.html?id=does-not-exist");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Passport not found");
  await expect(page.getByRole("link", { name: record.productName })).toBeVisible();
});

test("UID decoder validates the passport identifier and check code", async ({ page }) => {
  await page.goto("./#uid");
  await expect(page.locator("#uid-msg")).toContainText("Valid format and check code 33");
  await page.getByRole("button", { name: "Original project example" }).click();
  await expect(page.locator("#uid-msg")).toContainText("check code should be");
});

test("labels page shows the printable QR label", async ({ page }) => {
  await page.goto("labels.html");
  await expect(page.locator(".label")).toHaveCount(registry.passports.length);
  await expect(page.locator(".label")).toContainText(record.uid);
});

test("theme toggle switches to dark", async ({ page }) => {
  await page.goto("./");
  await page.locator("[data-theme-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", /dark|light/);
});

test("no horizontal scroll on the passport", async ({ page }) => {
  await page.goto(`${PASSPORT}&role=authority`);
  await page.locator(".pp-hero").waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
