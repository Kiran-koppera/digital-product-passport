"""Unit tests for the Python tooling. Run: python -m unittest discover -s tests"""

from __future__ import annotations

import copy
import io
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from jsonschema import Draft202012Validator  # noqa: E402

import validate_data  # noqa: E402
from dpp_model import (ACCESS_LEVELS, BASE_URL, PASSPORT_DIR, SCHEMA_FILE, SECTION_MODEL, coverage,  # noqa: E402
                       load_json, passport_url)
from new_passport import build_record  # noqa: E402

LEAD = "vw-id-polo-lfp-37"


def field(record: dict, key: str) -> dict:
    return next(f for s in record["sections"] for f in s["fields"] if f["key"] == key)


class ModelTests(unittest.TestCase):
    def test_annex_xiii_sections_and_access_groups(self):
        self.assertEqual(len(SECTION_MODEL), 10)
        self.assertEqual(ACCESS_LEVELS, ["public", "legitimate-interest", "authority"])
        by_access = {}
        for key, _t, access, _a in SECTION_MODEL:
            by_access.setdefault(access, set()).add(key)
        self.assertEqual(by_access["authority"], {"conformity"})
        self.assertEqual(by_access["legitimate-interest"], {"composition", "dismantling", "state-of-health"})

    def test_passport_url(self):
        self.assertEqual(passport_url("x"), f"{BASE_URL}passport.html?id=x")
        self.assertTrue(BASE_URL.startswith("https://") and BASE_URL.endswith("/"))


class ScaffoldTests(unittest.TestCase):
    def setUp(self):
        self.validator = Draft202012Validator(load_json(SCHEMA_FILE))

    def test_scaffold_is_schema_valid_and_passes_rules(self):
        rec = build_record("demo-pack", "Demo Pack", "DEMO-LFP10-20260101-000001-00")
        self.assertEqual(list(self.validator.iter_errors(rec)), [])
        self.assertEqual(validate_data.check_record("demo-pack", rec, self.validator), [])


class RuleTests(unittest.TestCase):
    def setUp(self):
        self.validator = Draft202012Validator(load_json(SCHEMA_FILE))
        self.rec = load_json(PASSPORT_DIR / f"{LEAD}.json")

    def errors(self, rec, pid=LEAD):
        return validate_data.check_record(pid, rec, self.validator)

    def test_lead_record_is_clean(self):
        self.assertEqual(self.errors(self.rec), [])

    def test_gap_must_be_null_and_null_must_be_gap(self):
        rec = copy.deepcopy(self.rec)
        field(rec, "weight")["value"] = "250"
        self.assertTrue(any("must have value null" in e for e in self.errors(rec)))
        rec = copy.deepcopy(self.rec)
        field(rec, "dc")["value"] = None
        self.assertTrue(any("tagged not-disclosed" in e for e in self.errors(rec)))

    def test_official_values_need_a_source(self):
        rec = copy.deepcopy(self.rec)
        field(rec, "e-net")["sources"] = []
        self.assertTrue(any("official values need" in e for e in self.errors(rec)))

    def test_unknown_source_is_rejected(self):
        rec = copy.deepcopy(self.rec)
        field(rec, "e-net")["sources"] = ["nope"]
        self.assertTrue(any("unknown source" in e for e in self.errors(rec)))

    def test_estimates_must_explain_method(self):
        rec = copy.deepcopy(self.rec)
        del field(rec, "v-nom")["note"]
        self.assertTrue(any("explain their method" in e for e in self.errors(rec)))

    def test_section_order_and_access_are_enforced(self):
        rec = copy.deepcopy(self.rec)
        rec["sections"][6]["access"] = "public"
        self.assertTrue(any("Annex XIII model" in e for e in self.errors(rec)))

    def test_file_name_and_uid_must_match(self):
        rec = copy.deepcopy(self.rec)
        field(rec, "uid")["value"] = "OTHER-LFP37-20260914-004217-00"
        errs = self.errors(rec, "other-id")
        self.assertTrue(any("file name" in e for e in errs))
        self.assertTrue(any("top-level uid" in e for e in errs))

    def test_schema_rejects_unknown_provenance(self):
        rec = copy.deepcopy(self.rec)
        field(rec, "e-net")["provenance"] = "guess"
        self.assertTrue(list(self.validator.iter_errors(rec)))


class LeadPassportContentTests(unittest.TestCase):
    """Facts that must stay consistent with the cited Volkswagen sources."""

    def setUp(self):
        self.rec = load_json(PASSPORT_DIR / f"{LEAD}.json")

    def test_key_published_values(self):
        self.assertEqual(self.rec["chemistry"], "LFP")
        self.assertEqual(field(self.rec, "e-net")["value"], "37")
        self.assertEqual(field(self.rec, "e-gross")["value"], "38.5")
        self.assertEqual(field(self.rec, "cells")["value"], "102")
        self.assertEqual(field(self.rec, "ac")["value"], "11")

    def test_lfp_has_no_cobalt_or_nickel_recycled_content(self):
        self.assertIn("Not applicable", field(self.rec, "rc-co")["value"])
        self.assertIn("Not applicable", field(self.rec, "rc-ni")["value"])

    def test_carbon_footprint_is_not_presented_as_declared(self):
        self.assertIsNone(field(self.rec, "cf-declared")["value"])
        self.assertEqual(field(self.rec, "cf-lit")["provenance"], "literature")

    def test_coverage_counts(self):
        c = coverage(self.rec)
        self.assertEqual(c["filled"] + c["gaps"], c["total"])
        self.assertEqual(c["gaps"], c["byProvenance"]["not-disclosed"])


class RepositoryDataTests(unittest.TestCase):
    def test_repository_data_is_valid(self):
        with redirect_stdout(io.StringIO()):
            self.assertEqual(validate_data.main([]), 0)


if __name__ == "__main__":
    unittest.main()
