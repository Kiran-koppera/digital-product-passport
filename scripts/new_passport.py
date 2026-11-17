"""Scaffold a new passport record that follows the Annex XIII model.

Usage:
    python scripts/new_passport.py <id> "<Product name>" --uid UID [--chemistry LFP]

Every section is created with one placeholder field (value null, tagged
not-disclosed). Add the real fields with their sources, list the id in
data/passports.json and run scripts/generate_qr.py.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys

from dpp_model import PASSPORT_DIR, SECTION_MODEL, write_json

CASE_STUDY = "Draft record. Values tagged not-disclosed have not been published by the manufacturer."


def build_record(pid: str, name: str, uid: str, chemistry: str = "LFP") -> dict:
    sections = []
    for key, title, access, annex in SECTION_MODEL:
        fields = []
        if key == "identification":
            fields.append({"key": "uid", "label": "Unique battery identifier", "annex": "Art. 77(3)", "value": uid,
                           "format": "mono", "provenance": "simulated", "sources": []})
            fields.append({"key": "category", "label": "Battery category", "annex": "Art. 3(1)(14)",
                           "value": "Electric vehicle battery", "provenance": "regulation", "sources": ["eu-2023-1542"]})
        elif key == "state-of-health":
            fields.append({"key": "status", "label": "Battery status", "annex": "Art. 77(6)", "value": "Original",
                           "provenance": "simulated", "sources": []})
        else:
            fields.append({"key": f"{key}-todo", "label": f"{title}: to be completed", "value": None,
                           "provenance": "not-disclosed", "sources": []})
        section = {"key": key, "title": title, "annex": annex, "access": access, "fields": fields}
        if key == "state-of-health":
            section["dynamic"] = True
        sections.append(section)
    return {
        "$schema": "../schema/passport.schema.json",
        "id": pid,
        "uid": uid,
        "productName": name,
        "batteryCategory": "Electric vehicle battery",
        "chemistry": chemistry,
        "status": "original",
        "dataVersion": "0.1.0",
        "lastUpdated": dt.date.today().isoformat(),
        "caseStudy": CASE_STUDY,
        "sections": sections,
        "sources": [{"id": "eu-2023-1542", "title": "Regulation (EU) 2023/1542 concerning batteries and waste batteries",
                     "publisher": "Official Journal of the European Union", "url": "https://eur-lex.europa.eu/eli/reg/2023/1542/oj"}],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("id")
    ap.add_argument("name")
    ap.add_argument("--uid", required=True)
    ap.add_argument("--chemistry", default="LFP")
    ap.add_argument("--force", action="store_true", help="overwrite an existing file")
    args = ap.parse_args()

    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", args.id):
        ap.error("id must be a lowercase slug, e.g. vw-id-polo-lfp-37")
    path = PASSPORT_DIR / f"{args.id}.json"
    if path.exists() and not args.force:
        print(f"{path} already exists (use --force to overwrite)", file=sys.stderr)
        return 1
    write_json(path, build_record(args.id, args.name, args.uid, args.chemistry))
    print(f"created {path.relative_to(PASSPORT_DIR.parent.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
