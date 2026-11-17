# Setup & deployment

## Run locally

The site is static, but it loads JSON with `fetch()`, so it must be served over HTTP (not opened as `file://`).

```bash
git clone https://github.com/Kiran-koppera/digital-product-passport.git
cd digital-product-passport
python -m http.server 8000
# open http://localhost:8000/
```

The access switch keeps the selected role in `sessionStorage`; add `&role=legitimate-interest` or `&role=authority` to a passport URL to deep-link a role.

## Tooling (optional)

```bash
python -m pip install -r requirements-dev.txt   # segno, OpenCV, jsonschema
python scripts/validate_data.py --gaps          # schema + Annex XIII rules + gap report
python -m unittest discover -s tests            # Python unit tests
python scripts/generate_qr.py                   # regenerate qr/*.svg|png
python scripts/verify_qr.py                     # decode-test every QR code

npm ci && npx playwright install chromium       # browser tests
npx playwright test                             # desktop + mobile
BASE_URL=https://kiran-koppera.github.io/digital-product-passport/ npx playwright test   # against live site
```

## Deploy to GitHub Pages

Deployment is fully automated by [`.github/workflows/ci-deploy.yml`](../.github/workflows/ci-deploy.yml):

1. **test**: validate data, run unit tests, check that the QR codes are up to date, decode-test the QR codes,
   and run Playwright on desktop and mobile.
2. **deploy** (main branch only, after **test** passes): copy the public files into `_site/` and publish with
   `actions/deploy-pages`.
3. **smoke**: confirm that every QR target URL returns HTTP 200 on the live site.

One-time repository setup:

```bash
gh repo create Kiran-koppera/digital-product-passport --public --source . --push
gh api -X POST repos/Kiran-koppera/digital-product-passport/pages -f build_type=workflow
```

The same can be done in the web UI: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Using a different account or repository name

1. Change `BASE_URL` in `scripts/dpp_model.py`.
2. Replace `kiran-koppera.github.io/digital-product-passport` and `Kiran-koppera/digital-product-passport`
   in the HTML files, `assets/js/common.js`, `labels.html` and `404.html`.
3. Run `python scripts/generate_qr.py && python scripts/verify_qr.py` and commit the new `qr/` files.
