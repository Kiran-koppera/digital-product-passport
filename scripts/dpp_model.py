"""Shared constants for the battery passport tooling.

The data model follows Annex XIII of Regulation (EU) 2023/1542: every section
belongs to one access group, and every field carries its legal reference,
provenance and sources.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PASSPORT_DIR = DATA_DIR / "passports"
REGISTRY_FILE = DATA_DIR / "passports.json"
SCHEMA_FILE = DATA_DIR / "schema" / "passport.schema.json"
QR_DIR = ROOT / "qr"

# Public base URL of the GitHub Pages deployment. QR codes encode
# f"{BASE_URL}passport.html?id=<id>", so changing this requires regenerating them.
BASE_URL = "https://kiran-koppera.github.io/digital-product-passport/"

# Access groups in ascending order of privilege. A role sees its own group and every lower one.
ACCESS_LEVELS = ["public", "legitimate-interest", "authority"]

# Provenance tags. "Evidenced" values come from a publication or the law itself.
PROVENANCE = ["official", "derived", "regulation", "literature", "estimated", "simulated", "not-disclosed"]
EVIDENCED = {"official", "derived", "regulation", "literature"}
# Provenance tags that must explain their method in a note.
NEEDS_NOTE = {"derived", "estimated"}

# (key, title, access, annex) of the Annex XIII sections every battery passport must carry, in display order.
SECTION_MODEL: list[tuple[str, str, str, str]] = [
    ("identification", "Identification & labelling", "public", "Annex XIII 1(a) · Annex VI Part A"),
    ("carbon-footprint", "Carbon footprint", "public", "Annex XIII 1(c) · Art. 7"),
    ("due-diligence", "Supply chain due diligence", "public", "Annex XIII 1(d) · Art. 52"),
    ("content", "Recycled & renewable content", "public", "Annex XIII 1(e)(f) · Art. 8"),
    ("performance", "Performance & durability", "public", "Annex XIII 1(g)–(p) · Annex IV"),
    ("end-of-life", "End of life & collection", "public", "Annex XIII 1 · Art. 74"),
    ("composition", "Detailed composition", "legitimate-interest", "Annex XIII 2(a)"),
    ("dismantling", "Repair & dismantling", "legitimate-interest", "Annex XIII 2(b)–(d)"),
    ("conformity", "Conformity & test reports", "authority", "Annex XIII 3"),
    ("state-of-health", "State of health & battery status", "legitimate-interest", "Annex XIII 4 · Art. 14 · Annex VII"),
]


def passport_url(passport_id: str) -> str:
    return f"{BASE_URL}passport.html?id={passport_id}"


def all_fields(record: dict) -> list[dict]:
    return [f for s in record["sections"] for f in s["fields"]]


def coverage(record: dict) -> dict:
    """Counts by provenance plus the share of fields with a value."""
    fields = all_fields(record)
    by_prov = {p: 0 for p in PROVENANCE}
    for f in fields:
        by_prov[f["provenance"]] += 1
    filled = sum(f["value"] is not None for f in fields)
    return {"total": len(fields), "filled": filled, "gaps": len(fields) - filled, "byProvenance": by_prov}


def load_json(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
