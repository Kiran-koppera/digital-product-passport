"""Verify that every QR code decodes to the correct, reachable passport URL.

Checks, per passport in data/passports.json:
  1. qr/<id>.png exists and decodes (OpenCV) to exactly passport_url(id)
     - also at reduced size (simulates a small printed label / phone camera)
  2. qr/<id>.svg exists and embeds the same URL
  3. the id resolves to data/passports/<id>.json
  4. with --online: the URL and its JSON record return HTTP 200 on the live site

Usage:
    python scripts/verify_qr.py            # offline checks (used in CI)
    python scripts/verify_qr.py --online   # also hit the deployed GitHub Pages site
"""

from __future__ import annotations

import argparse
import sys
import urllib.request

import cv2
import numpy as np

from dpp_model import BASE_URL, PASSPORT_DIR, QR_DIR, REGISTRY_FILE, load_json, passport_url


def decode(img: np.ndarray) -> str:
    value, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    return value


def check_png(pid: str, expected: str) -> list[str]:
    errors = []
    path = QR_DIR / f"{pid}.png"
    if not path.exists():
        return [f"{path.name}: missing"]
    img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    for size in (img.shape[0], 240, 160):
        resized = cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)
        got = decode(resized)
        if got != expected:
            errors.append(f"{path.name} @ {size}px decoded to {got!r}, expected {expected!r}")
    return errors


def http_status(url: str) -> int:
    req = urllib.request.Request(url, headers={"User-Agent": "dpp-qr-verifier"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--online", action="store_true", help="also check the live deployment")
    args = ap.parse_args()

    registry = load_json(REGISTRY_FILE)
    failures: list[str] = []
    for entry in registry["passports"]:
        pid = entry["id"]
        url = passport_url(pid)
        errs = check_png(pid, url)
        svg = QR_DIR / f"{pid}.svg"
        if not svg.exists():
            errs.append(f"{svg.name}: missing")
        elif url not in svg.read_text(encoding="utf-8"):
            errs.append(f"{svg.name}: does not reference {url}")
        if not (PASSPORT_DIR / f"{pid}.json").exists():
            errs.append(f"data/passports/{pid}.json: missing")
        if args.online and not errs:
            for target in (url, f"{BASE_URL}data/passports/{pid}.json"):
                status = http_status(target)
                if status != 200:
                    errs.append(f"{target} -> HTTP {status}")
        print(f"[{'FAIL' if errs else ' OK '}] {pid:26s} {url}")
        for e in errs:
            print(f"        {e}")
        failures += errs

    print(f"\n{len(registry['passports'])} QR codes checked, {len(failures)} problem(s).")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
