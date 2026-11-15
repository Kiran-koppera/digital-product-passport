"""Scaffold a new, empty passport record that follows the attribute model.

Usage:
    python scripts/new_passport.py <id> "<Product name>" [--uid UID] [--legacy-qr URL]

Every field is created with value null ("pending"). Fill in all values, set
recordStatus to "documented", add the id to data/passports.json and run
scripts/generate_qr.py.
"""

from __future__ import annotations

import argparse
import re
import sys

from dpp_model import ATTRIBUTE_MODEL, PASSPORT_DIR, write_json


def build_record(pid: str, name: str, uid: str | None, legacy_qr: str | None) -> dict:
    record: dict = {
        "$schema": "../schema/passport.schema.json",
        "id": pid,
        "uid": uid,
        "productName": name,
        "recordStatus": "placeholder",
        "source": "Battery listed in the MM03 presentation (slide 5) with a QR code; "
                  "its attribute data was not included in the submitted documentation.",
    }
    if legacy_qr:
        record["legacyQr"] = legacy_qr
    record["sections"] = [
        {
            "key": key,
            "title": title,
            "access": access,
            "fields": [
                {"label": label, "value": {"Product name": name, "Unique ID": uid}.get(label)}
                for label in labels
            ],
        }
        for key, title, access, labels in ATTRIBUTE_MODEL
    ]
    return record


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("id")
    ap.add_argument("name")
    ap.add_argument("--uid")
    ap.add_argument("--legacy-qr")
    ap.add_argument("--force", action="store_true", help="overwrite an existing file")
    args = ap.parse_args()

    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", args.id):
        ap.error("id must be a lowercase slug, e.g. sodium-ion-cell")
    path = PASSPORT_DIR / f"{args.id}.json"
    if path.exists() and not args.force:
        print(f"{path} already exists (use --force to overwrite)", file=sys.stderr)
        return 1
    write_json(path, build_record(args.id, args.name, args.uid, args.legacy_qr))
    print(f"created {path.relative_to(PASSPORT_DIR.parent.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
