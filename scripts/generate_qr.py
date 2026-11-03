"""Generate static, permanent QR codes for every passport in data/passports.json.

The QR codes encode the GitHub Pages URL of each passport directly (no
redirect/short-link service), so they never expire and need no subscription.

Outputs, per passport id:
    qr/<id>.svg   vector, for the web page and for print
    qr/<id>.png   raster, 600+ px, for slides/documents

Usage:
    pip install -r requirements-dev.txt
    python scripts/generate_qr.py
"""

from __future__ import annotations

import segno

from dpp_model import QR_DIR, REGISTRY_FILE, load_json, passport_url

ERROR_CORRECTION = "q"  # ~25 % damage tolerance, suitable for printed labels
BORDER = 4              # quiet zone in modules, as required by ISO/IEC 18004


def main() -> int:
    registry = load_json(REGISTRY_FILE)
    QR_DIR.mkdir(exist_ok=True)
    for entry in registry["passports"]:
        pid = entry["id"]
        url = passport_url(pid)
        qr = segno.make(url, error=ERROR_CORRECTION, micro=False, boost_error=False)
        qr.save(QR_DIR / f"{pid}.svg", scale=10, border=BORDER, dark="#0b1220",
                xmldecl=False, svgns=True, title=f"Battery passport: {entry['productName']}",
                desc=url)
        qr.save(QR_DIR / f"{pid}.png", scale=16, border=BORDER, dark="#000000")
        print(f"{pid:28s} v{qr.version}-{qr.error}  {url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
