# Architecture

![Architecture](images/architecture.svg)

## Design goals

| Goal | Decision |
|------|----------|
| QR codes must never expire | Encode the final HTTPS URL directly in the QR code. No short-link or "dynamic QR" service sits in between. |
| Free, durable hosting | GitHub Pages: static files only, HTTPS, no server to maintain or pay for. |
| No hidden dependencies | Plain HTML, CSS and ES modules. No framework, no CDN, no web fonts, no analytics. |
| Data is reviewable and traceable | Each passport is a JSON file in Git; every change is a commit with author and timestamp. |
| Broken data never ships | CI validates data and QR codes and runs browser tests before deploying. |

## Components

```
index.html            Landing page: gallery of passports (rendered from data/), diagrams, UID decoder, scope
passport.html         Passport viewer, driven by ?id=<passport-id> and #<category-key>
labels.html           Printable QR labels
assets/js/common.js   Theme toggle, fetch helper, SHA-256 helper, icons
assets/js/passport.js Viewer: tabs, layered-access gate, JSON export
assets/js/home.js     Landing page gallery and UID decoder
assets/js/uid.js      UID parser (documented scheme) + proposed CRC-8 check code
data/passports.json   Registry: list of passport ids + demo access hash
data/passports/*.json One record per battery
data/schema/          JSON Schema for records
qr/                   Generated QR codes (SVG + PNG), committed so they can be printed without tooling
scripts/              Python tooling: scaffold, validate, generate QR, verify QR
tests/                Python unit tests and Playwright end-to-end tests
```

## Request flow

1. A phone camera reads the QR label and opens
   `https://kiran-koppera.github.io/digital-product-passport/passport.html?id=solid-state-cell`.
2. `passport.js` fetches `data/passports.json`, checks that the id exists, then fetches
   `data/passports/solid-state-cell.json`.
3. The eight categories are rendered as an accessible tab list (arrow-key navigation, deep links via
   `#technical-data`, etc.).
4. Public categories render immediately. Restricted categories show an access form.

## Layered access

The project defines two access layers (report §4.2):

| Layer | Categories |
|-------|-----------|
| Public | Product identification, material composition, manufacturing data, environmental impact, circularity |
| Restricted | Technical data, supply chain & logistics, compliance & certification |

**How it works in this demo.** The entered password is hashed with SHA-256 using the browser's Web Crypto
API and compared with `demoAccess.restrictedHash` in `data/passports.json`. When the hashes match, the unlocked
state is kept in `sessionStorage` for the rest of the browser session. The JSON export button only includes
restricted categories when unlocked.

**What it is not.** GitHub Pages serves static files, so all data, including the restricted
categories, is publicly downloadable from `data/passports/*.json`. The gate shows the *access model* and the user
experience. It is **not** a security control. The demo password `SSC123` was itself published in the project
presentation.

**What production would need.** Restricted data would live behind an API that checks the caller's identity
and role (e.g. OpenID Connect with roles such as *authority*, *recycler*, *OEM*). Only the public layer would
be served statically. The record format would not need to change, because the `access` flag already exists on
each category.

## Why not a dynamic QR service?

The original prototype's four QR codes were generated with a commercial "dynamic QR" service. They encoded short
links such as `https://qr.codes/byrKQP`, which redirected to the real page. When the subscription ended, the service
deactivated the redirects ("The QR code owner needs to choose a plan to reactivate this QR code"), and every printed
code stopped working.

Static codes that encode the final URL avoid this whole class of failure. The cost is that the URL has to be stable.
This is handled by using a permanent, id-based URL scheme (`passport.html?id=<id>`), so the content behind an id can
change without reprinting the label. See [qr-codes.md](qr-codes.md).

## Testing strategy

| Level | Tool | What it proves |
|-------|------|----------------|
| Data | `scripts/validate_data.py` (JSON Schema 2020-12 + rules) | Every record has all 8 categories in order with the correct access level; UIDs are consistent; the registry and files match |
| Unit | `python -m unittest` | Scaffolding produces valid records; the rules catch inconsistencies |
| QR | `scripts/verify_qr.py` | Each PNG decodes (also when shrunk to 160 px) to exactly the expected URL; each SVG embeds it; each target record exists |
| Browser | Playwright (desktop Chrome + Pixel 7) | Pages render, all images load, the password gate works, keyboard navigation works, export redacts restricted data, no horizontal scroll on mobile |
| Live | `verify_qr.py --online` after deploy | Every QR target URL and JSON record returns HTTP 200 on GitHub Pages |
