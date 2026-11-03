"""Shared constants for the Battery DPP tooling.

The attribute model mirrors section 4.3 of the project report: eight categories,
each either public or restricted (password-protected in the prototype).
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

# (key, title, access, [field labels]) -- order matters, it is the display order.
ATTRIBUTE_MODEL: list[tuple[str, str, str, list[str]]] = [
    ("product-identification", "Product Identification", "public",
     ["Unique ID", "Product name", "Product status", "Product sustainability profile"]),
    ("material-composition", "Material Composition", "public",
     ["Critical raw materials", "Battery chemistry", "Hazardous substances",
      "Impact of substances on environment, human health & safety", "Bill of materials"]),
    ("manufacturing-data", "Manufacturing Data", "public",
     ["Name of manufacturer", "Address of manufacturer", "Web address of manufacturer",
      "Email of manufacturer", "Date of manufacture", "Place of manufacture"]),
    ("technical-data", "Technical Data", "restricted",
     ["Cell voltage", "Rated capacity", "Energy density", "Cycle life", "Battery weight"]),
    ("environmental-impact", "Environmental Impact", "public",
     ["Carbon footprint as declared (kg CO₂e / kWh of total energy)", "Energy rating"]),
    ("circularity", "Circularity & Resource Efficiency", "public",
     ["Manual for removal of the battery from the appliance",
      "Manual for disassembly and dismantling of the battery pack",
      "Part numbers for components",
      "Postal, e-mail and web address of sources for spare parts",
      "Safety measures / instructions"]),
    ("supply-chain", "Supply Chain & Logistics", "restricted",
     ["Supplier list", "Packaging information", "Transport modes"]),
    ("compliance", "Compliance & Certification", "restricted",
     ["ISO / IATF certificates", "Supplier code of conduct", "Customer-specific requirements"]),
]


def passport_url(passport_id: str) -> str:
    return f"{BASE_URL}passport.html?id={passport_id}"


def load_json(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
