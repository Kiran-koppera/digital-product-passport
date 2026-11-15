// End-to-end tests for the static site. Run locally with `npx playwright test`,
// or against the live deployment with BASE_URL=https://kiran-koppera.github.io/digital-product-passport/
import { expect, test } from "@playwright/test";
import fs from "node:fs";

const registry = JSON.parse(fs.readFileSync("data/passports.json", "utf8"));

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => { throw err; });
});

test("landing page lists every passport with a working QR image", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Digital Product Passport");
  const cards = page.locator(".pp-card");
  await expect(cards).toHaveCount(registry.passports.length);
  for (const p of registry.passports) {
    const img = page.locator(`.pp-card img[src="qr/${p.id}.svg"]`);
    await img.scrollIntoViewIfNeeded();
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
});

test("all images on the landing page load", async ({ page }) => {
  await page.goto("./");
  await page.locator(".pp-card").first().waitFor();
  const broken = await page.$$eval("img", (imgs) =>
    imgs.filter((i) => { i.loading = "eager"; return i.complete && i.naturalWidth === 0; }).map((i) => i.src));
  expect(broken).toEqual([]);
});

for (const p of registry.passports) {
  test(`passport "${p.id}" renders all 8 categories`, async ({ page }) => {
    await page.goto(`passport.html?id=${p.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.productName);
    await expect(page.getByRole("tab")).toHaveCount(8);
    await expect(page).toHaveTitle(new RegExp(p.productName));
  });
}

test("solid state cell shows documented public data", async ({ page }) => {
  await page.goto("passport.html?id=solid-state-cell#material-composition");
  await expect(page.getByRole("tab", { name: /Material Composition/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#panel")).toContainText("Cathode (NMC811)");
  await expect(page.locator("#panel")).toContainText("LLZO ceramic dust");
});

test("restricted category requires the password and unlocks with SSC123", async ({ page }) => {
  await page.goto("passport.html?id=solid-state-cell#technical-data");
  const panel = page.locator("#panel");
  await expect(panel).not.toContainText("3.8 V");
  await page.getByPlaceholder("Enter access password").fill("wrong");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(panel.locator(".err")).toHaveText("Incorrect password.");
  await expect(panel).not.toContainText("3.8 V");

  await page.getByPlaceholder("Enter access password").fill("SSC123");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(panel).toContainText("3.8 V");
  await expect(panel).toContainText("362 Wh/kg");

  // Unlock persists across categories in the session
  await page.getByRole("tab", { name: /Supply Chain/ }).click();
  await expect(panel).toContainText("Umicore (Belgium)");
});

test("keyboard navigation moves between tabs", async ({ page }) => {
  await page.goto("passport.html?id=solid-state-cell");
  await page.getByRole("tab", { name: /Product Identification/ }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("tab", { name: /Material Composition/ })).toBeFocused();
  await expect(page).toHaveURL(/#material-composition$/);
});

test("passports show complete data without sample-data tags", async ({ page }) => {
  await page.goto("passport.html?id=sodium-ion-cell#material-composition");
  await expect(page.getByText("Active passport", { exact: false }).first()).toBeVisible();
  await expect(page.locator("#panel")).toContainText("Prussian white");
  await expect(page.locator("body")).not.toContainText(/illustrative/i);
  await expect(page.getByText("33 of 33 attributes populated", { exact: false })).toBeVisible();
});

test("unknown passport id shows a helpful error", async ({ page }) => {
  await page.goto("passport.html?id=does-not-exist");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Passport not found");
  await expect(page.getByRole("link", { name: "Solid State Cell" })).toBeVisible();
});

test("public JSON export redacts restricted sections", async ({ page }) => {
  await page.goto("passport.html?id=solid-state-cell");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Export JSON/ }).click()]);
  const data = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  const tech = data.sections.find((s) => s.key === "technical-data");
  expect(tech.redacted).toBe(true);
  expect(tech.fields).toBeUndefined();
});

test("UID decoder splits the documented example", async ({ page }) => {
  await page.goto("./#uid");
  await page.getByRole("button", { name: "Report example" }).click();
  await expect(page.locator("#uid-segments .seg")).toHaveCount(5);
  await expect(page.locator("#uid-segments")).toContainText("000001");
  await expect(page.locator("#uid-msg")).toContainText("Format matches");
});

test("no horizontal page scroll", async ({ page }) => {
  for (const url of ["./", "passport.html?id=solid-state-cell", "labels.html"]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});

test("labels page renders one label per passport", async ({ page }) => {
  await page.goto("labels.html");
  await expect(page.locator(".label")).toHaveCount(registry.passports.length);
});
