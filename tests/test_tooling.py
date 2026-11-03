"""Unit tests for the Python tooling. Run: python -m unittest discover -s tests"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from jsonschema import Draft202012Validator  # noqa: E402

import validate_data  # noqa: E402
from dpp_model import ATTRIBUTE_MODEL, BASE_URL, SCHEMA_FILE, load_json, passport_url  # noqa: E402
from new_passport import build_record  # noqa: E402


class ModelTests(unittest.TestCase):
    def test_eight_categories_three_restricted(self):
        self.assertEqual(len(ATTRIBUTE_MODEL), 8)
        restricted = {k for k, _t, access, _l in ATTRIBUTE_MODEL if access == "restricted"}
        self.assertEqual(restricted, {"technical-data", "supply-chain", "compliance"})

    def test_passport_url(self):
        self.assertEqual(passport_url("x"), f"{BASE_URL}passport.html?id=x")
        self.assertTrue(BASE_URL.startswith("https://") and BASE_URL.endswith("/"))


class ScaffoldTests(unittest.TestCase):
    def setUp(self):
        self.validator = Draft202012Validator(load_json(SCHEMA_FILE))

    def test_scaffold_is_schema_valid_and_passes_rules(self):
        rec = build_record("demo-cell", "Demo Cell", None, None)
        self.assertEqual(list(self.validator.iter_errors(rec)), [])
        self.assertEqual(validate_data.check_record("demo-cell", rec, self.validator), [])

    def test_rules_catch_mismatched_id_and_uid(self):
        rec = build_record("demo-cell", "Demo Cell", "ABC1-BAT01-20250101-000001-A3", None)
        rec["sections"][0]["fields"][0]["value"] = "SOMETHING-ELSE"
        errs = validate_data.check_record("other-id", rec, self.validator)
        self.assertTrue(any("file name" in e for e in errs))
        self.assertTrue(any("Unique ID" in e for e in errs))

    def test_schema_rejects_empty_string_values(self):
        rec = build_record("demo-cell", "Demo Cell", None, None)
        rec["sections"][1]["fields"][0]["value"] = ""
        self.assertTrue(list(self.validator.iter_errors(rec)))


    def test_illustrative_records_must_tag_every_value(self):
        rec = build_record("demo-cell", "Demo Cell", "ABC1-BAT01-20250101-000001-A3", None)
        rec["recordStatus"] = "illustrative"
        rec["sections"][0]["fields"][0]["origin"] = "illustrative"
        rec["sections"][1]["fields"][0]["value"] = "Lithium"
        errs = validate_data.check_record("demo-cell", rec, self.validator)
        self.assertTrue(any("not tagged" in e for e in errs))
        rec["sections"][1]["fields"][0]["origin"] = "illustrative"
        self.assertEqual(validate_data.check_record("demo-cell", rec, self.validator), [])


class RepositoryDataTests(unittest.TestCase):
    def test_repository_data_is_valid(self):
        self.assertEqual(validate_data.main(), 0)


if __name__ == "__main__":
    unittest.main()
