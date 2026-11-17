"""Encrypt the restricted sections of every passport for publication.

The site never serves the plain-text record. For each passport this writes
data/sealed/<id>.json, which contains:

  - the public sections in plain text,
  - a stub for each restricted section (title, legal reference, field count),
  - one AES-256-GCM ciphertext holding the restricted sections and the
    state-of-health history. The key is derived from the access password with
    PBKDF2-SHA256; the passport id is bound in as additional authenticated data.

The viewer decrypts it in the browser with the Web Crypto API.

Usage:
    python scripts/seal_passport.py            # (re)seal every passport
    python scripts/seal_passport.py --check    # verify sealed files decrypt to the current records

The password comes from the DPP_ACCESS_PASSWORD environment variable and
defaults to the published demo password.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sys

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from dpp_model import (PASSPORT_DIR, REGISTRY_FILE, SEALED_DIR, coverage, load_json,
                       write_json)

DEMO_PASSWORD = "1234"
ITERATIONS = 600_000  # OWASP 2023 recommendation for PBKDF2-HMAC-SHA256
STUB_KEYS = ("key", "title", "annex", "access", "dynamic", "summary")


def password() -> str:
    return os.environ.get("DPP_ACCESS_PASSWORD", DEMO_PASSWORD)


def derive_key(pw: str, salt: bytes, iterations: int = ITERATIONS) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt, iterations, dklen=32)


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def restricted_payload(record: dict) -> dict:
    return {
        "sections": [s for s in record["sections"] if s["access"] != "public"],
        "sohHistory": record.get("sohHistory", []),
    }


def seal(record: dict, pw: str) -> dict:
    salt, iv = os.urandom(16), os.urandom(12)
    plaintext = json.dumps(restricted_payload(record), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ciphertext = AESGCM(derive_key(pw, salt)).encrypt(iv, plaintext, record["id"].encode("utf-8"))

    sealed = {k: v for k, v in record.items() if k not in ("$schema", "sections", "sohHistory")}
    sealed["sections"] = [
        s if s["access"] == "public"
        else {**{k: s[k] for k in STUB_KEYS if k in s}, "fieldCount": len(s["fields"]), "sealed": True}
        for s in record["sections"]
    ]
    c = coverage(record)
    sealed["stats"] = {"total": c["total"], "filled": c["filled"], "gaps": c["gaps"], "byProvenance": c["byProvenance"]}
    sealed["sealed"] = {
        "alg": "AES-256-GCM",
        "kdf": "PBKDF2-SHA256",
        "iterations": ITERATIONS,
        "salt": b64(salt),
        "iv": b64(iv),
        "aad": "passport id",
        "ciphertext": b64(ciphertext),
    }
    return sealed


def unseal(sealed: dict, pw: str) -> dict:
    s = sealed["sealed"]
    key = derive_key(pw, base64.b64decode(s["salt"]), s["iterations"])
    plaintext = AESGCM(key).decrypt(base64.b64decode(s["iv"]), base64.b64decode(s["ciphertext"]),
                                    sealed["id"].encode("utf-8"))
    return json.loads(plaintext)


def check(record: dict, sealed: dict, pw: str) -> list[str]:
    errs = []
    try:
        payload = unseal(sealed, pw)
    except InvalidTag:
        return ["does not decrypt with the access password"]
    if payload != restricted_payload(record):
        errs.append("encrypted sections are out of date with the record")
    public = [s for s in record["sections"] if s["access"] == "public"]
    if [s for s in sealed["sections"] if not s.get("sealed")] != public:
        errs.append("public sections are out of date with the record")
    if [s["key"] for s in sealed["sections"]] != [s["key"] for s in record["sections"]]:
        errs.append("section order differs from the record")
    if any("fields" in s for s in sealed["sections"] if s.get("sealed")):
        errs.append("a sealed stub leaks its fields")
    public_text = json.dumps([s for s in sealed["sections"]], ensure_ascii=False)
    for s in restricted_payload(record)["sections"]:
        for f in s["fields"]:
            if isinstance(f["value"], str) and len(f["value"]) > 12 and f["value"] in public_text:
                errs.append(f"restricted value of {f['key']!r} appears in plain text")
    for k in ("uid", "productName", "status", "dataVersion", "lastUpdated"):
        if sealed.get(k) != record.get(k):
            errs.append(f"{k} differs from the record")
    return errs


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="verify instead of writing")
    args = ap.parse_args(argv)
    pw = password()
    registry = load_json(REGISTRY_FILE)
    SEALED_DIR.mkdir(exist_ok=True)
    problems = 0
    for entry in registry["passports"]:
        pid = entry["id"]
        record = load_json(PASSPORT_DIR / f"{pid}.json")
        out = SEALED_DIR / f"{pid}.json"
        if args.check:
            errs = ["sealed file missing"] if not out.exists() else check(record, load_json(out), pw)
            print(f"[{'FAIL' if errs else ' OK '}] {pid}")
            for e in errs:
                print(f"        {e}")
            problems += len(errs)
        else:
            write_json(out, seal(record, pw))
            n = sum(len(s["fields"]) for s in record["sections"] if s["access"] != "public")
            print(f"sealed {pid}: {n} restricted attributes encrypted -> {out.relative_to(SEALED_DIR.parent.parent)}")
    if args.check:
        print(f"\n{len(registry['passports'])} sealed record(s) checked, {problems} problem(s).")
        if problems:
            print("Run 'python scripts/seal_passport.py' and commit data/sealed/.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
