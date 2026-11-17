"""Validate passport data: JSON Schema plus Annex XIII consistency rules.

Usage:
    python scripts/validate_data.py            # validate every record
    python scripts/validate_data.py --gaps     # also print the data-gap report
"""

from __future__ import annotations

import argparse
import sys

from jsonschema import Draft202012Validator

from dpp_model import (NEEDS_NOTE, PASSPORT_DIR, REGISTRY_FILE, SCHEMA_FILE, SECTION_MODEL, all_fields,
                       coverage, load_json)

EXPECTED_SECTIONS = [(key, access) for key, _title, access, _annex in SECTION_MODEL]


def check_record(pid: str, record: dict, validator: Draft202012Validator) -> list[str]:
    errs = [f"schema: {'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}"
            for e in validator.iter_errors(record)]
    if errs:
        return errs
    if record["id"] != pid:
        errs.append(f"id {record['id']!r} does not match file name {pid!r}")

    got = [(s["key"], s["access"]) for s in record["sections"]]
    if got != EXPECTED_SECTIONS:
        errs.append(f"sections/access do not follow the Annex XIII model: {got}")

    source_ids = [s["id"] for s in record["sources"]]
    if len(source_ids) != len(set(source_ids)):
        errs.append("duplicate source ids")
    used: set[str] = set()
    keys: set[str] = set()
    for f in all_fields(record):
        where = f"field {f['key']!r}"
        if f["key"] in keys:
            errs.append(f"{where}: duplicate field key")
        keys.add(f["key"])
        for sid in f["sources"]:
            used.add(sid)
            if sid not in source_ids:
                errs.append(f"{where}: unknown source {sid!r}")
        if f["provenance"] == "not-disclosed" and f["value"] is not None:
            errs.append(f"{where}: not-disclosed fields must have value null")
        if f["provenance"] != "not-disclosed" and f["value"] is None:
            errs.append(f"{where}: a null value must be tagged not-disclosed")
        if f["provenance"] == "official" and not f["sources"]:
            errs.append(f"{where}: official values need at least one source")
        if f["provenance"] in NEEDS_NOTE and not f.get("note"):
            errs.append(f"{where}: {f['provenance']} values must explain their method in a note")
    for unused in sorted(set(source_ids) - used):
        errs.append(f"source {unused!r} is never cited")

    uid_field = next((f for f in record["sections"][0]["fields"] if f["key"] == "uid"), None)
    if not uid_field or uid_field["value"] != record["uid"]:
        errs.append("Identification > uid must equal the top-level uid")
    status_field = next((f for f in all_fields(record) if f["key"] == "status"), None)
    if status_field and status_field["value"].lower() != record["status"]:
        errs.append("State of health > Battery status must equal the top-level status")
    return errs


def gap_report(record: dict) -> list[str]:
    lines = []
    for s in record["sections"]:
        for f in s["fields"]:
            if f["value"] is None:
                lines.append(f"  - [{s['title']}] {f['label']}" + (f"  ({f['annex']})" if f.get("annex") else ""))
    return lines


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gaps", action="store_true", help="print the fields the manufacturer has not published")
    args = ap.parse_args(argv)

    validator = Draft202012Validator(load_json(SCHEMA_FILE))
    registry = load_json(REGISTRY_FILE)
    problems: list[str] = []

    ids = [p["id"] for p in registry["passports"]]
    if len(ids) != len(set(ids)):
        problems.append("registry: duplicate ids")
    files = {p.stem for p in PASSPORT_DIR.glob("*.json")}
    for orphan in sorted(files - set(ids)):
        problems.append(f"registry: data/passports/{orphan}.json is not listed in passports.json")
    if [a["key"] for a in registry["accessLevels"]] != ["public", "legitimate-interest", "authority"]:
        problems.append("registry: accessLevels must be public, legitimate-interest, authority")

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
            c = coverage(record)
            p = c["byProvenance"]
            stats = (f"{c['filled']}/{c['total']} fields with a value · official {p['official']}, "
                     f"derived {p['derived']}, regulation {p['regulation']}, literature {p['literature']}, "
                     f"estimated {p['estimated']}, simulated {p['simulated']}, gaps {p['not-disclosed']}")
        print(f"[{'FAIL' if errs else ' OK '}] {pid:22s} {stats}")
        if args.gaps and not errs:
            print("  Data gaps (only the manufacturer can supply these):")
            print("\n".join(gap_report(record)))
        problems += [f"{pid}: {e}" for e in errs]

    for p in problems:
        print("  -", p)
    print(f"\n{len(ids)} record(s) validated, {len(problems)} problem(s).")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
