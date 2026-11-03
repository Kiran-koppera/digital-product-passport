"""Validate passport data: JSON Schema plus project-specific consistency rules.

Usage:
    python scripts/validate_data.py
"""

from __future__ import annotations

import hashlib
import sys

from jsonschema import Draft202012Validator

from dpp_model import ATTRIBUTE_MODEL, PASSPORT_DIR, REGISTRY_FILE, SCHEMA_FILE, load_json

EXPECTED_SECTIONS = [(key, access) for key, _title, access, _labels in ATTRIBUTE_MODEL]


def check_record(pid: str, record: dict, validator: Draft202012Validator) -> list[str]:
    errs = [f"schema: {'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}"
            for e in validator.iter_errors(record)]
    if errs:
        return errs
    if record["id"] != pid:
        errs.append(f"id {record['id']!r} does not match file name {pid!r}")
    got = [(s["key"], s["access"]) for s in record["sections"]]
    if got != EXPECTED_SECTIONS:
        errs.append(f"sections/access do not follow the attribute model: {got}")
    uid_field = record["sections"][0]["fields"][0]
    if uid_field["label"] != "Unique ID" or uid_field["value"] != record["uid"]:
        errs.append("Product Identification > Unique ID must equal the top-level uid")
    if record["recordStatus"] == "documented":
        if not record["uid"]:
            errs.append("documented records need a uid")
        documented = sum(1 for s in record["sections"] for f in s["fields"]
                         if f["value"] is not None and f.get("origin") != "illustrative")
        if documented == 0:
            errs.append("documented record has no documented (non-illustrative) fields")
    elif record["recordStatus"] == "illustrative":
        if not record["uid"]:
            errs.append("illustrative records need a uid")
        untagged = [f["label"] for s in record["sections"] for f in s["fields"]
                    if f["value"] is not None and f.get("origin") != "illustrative" and f["label"] != "Product name"]
        if untagged:
            errs.append(f"illustrative record has values not tagged origin=illustrative: {untagged}")
    for s in record["sections"]:
        for f in s["fields"]:
            if f["value"] is None and "origin" in f:
                errs.append(f"{s['key']} > {f['label']}: origin set on an empty field")
    return errs


def main() -> int:
    validator = Draft202012Validator(load_json(SCHEMA_FILE))
    registry = load_json(REGISTRY_FILE)
    problems: list[str] = []

    ids = [p["id"] for p in registry["passports"]]
    if len(ids) != len(set(ids)):
        problems.append("registry: duplicate ids")
    files = {p.stem for p in PASSPORT_DIR.glob("*.json")}
    for orphan in sorted(files - set(ids)):
        problems.append(f"registry: data/passports/{orphan}.json is not listed in passports.json")

    if hashlib.sha256(b"SSC123").hexdigest() != registry["demoAccess"]["restrictedHash"]:
        problems.append("registry: restrictedHash is not SHA-256 of the documented demo password")

    for entry in registry["passports"]:
        pid = entry["id"]
        path = PASSPORT_DIR / f"{pid}.json"
        if not path.exists():
            problems.append(f"{pid}: file missing")
            continue
        record = load_json(path)
        errs = check_record(pid, record, validator)
        if record.get("productName") != entry["productName"]:
            errs.append("productName differs between registry and record")
        stats = ""
        if not errs:
            fields = [f for s in record["sections"] for f in s["fields"]]
            filled = sum(f["value"] is not None for f in fields)
            ill = sum(f.get("origin") == "illustrative" for f in fields)
            stats = f"{record['recordStatus']:12s} {filled:2d}/{len(fields)} fields populated ({ill} illustrative)"
        print(f"[{'FAIL' if errs else ' OK '}] {pid:26s} {stats}")
        problems += [f"{pid}: {e}" for e in errs]

    for p in problems:
        print("  -", p)
    print(f"\n{len(ids)} records validated, {len(problems)} problem(s).")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
