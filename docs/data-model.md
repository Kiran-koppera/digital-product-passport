# Data model

![Data model](images/data-model.svg)

Each passport is one JSON file in `data/passports/`, validated against
[`data/schema/passport.schema.json`](../data/schema/passport.schema.json) and the consistency rules in
[`scripts/validate_data.py`](../scripts/validate_data.py).

## Sections and access groups

The sections follow Annex XIII of [Regulation (EU) 2023/1542](https://eur-lex.europa.eu/eli/reg/2023/1542/oj).
The order and access group of each section are fixed in `SECTION_MODEL` (`scripts/dpp_model.py`) and checked in CI.

| # | Key | Section | Access group | Legal basis |
|---|-----|---------|--------------|-------------|
| 1 | `identification` | Identification & labelling | Public | Annex XIII 1(a), Annex VI Part A |
| 2 | `carbon-footprint` | Carbon footprint | Public | Annex XIII 1(c), Art. 7 |
| 3 | `due-diligence` | Supply chain due diligence | Public | Annex XIII 1(d), Art. 52 |
| 4 | `content` | Recycled & renewable content | Public | Annex XIII 1(e)(f), Art. 8 |
| 5 | `performance` | Performance & durability | Public | Annex XIII 1(g)–(p), Annex IV |
| 6 | `end-of-life` | End of life & collection | Public | Annex XIII 1, Art. 74 |
| 7 | `composition` | Detailed composition | Legitimate interest | Annex XIII 2(a) |
| 8 | `dismantling` | Repair & dismantling | Legitimate interest | Annex XIII 2(b)–(d) |
| 9 | `conformity` | Conformity & test reports | Authorities | Annex XIII 3 |
| 10 | `state-of-health` | State of health & battery status (dynamic) | Legitimate interest | Annex XIII 4, Art. 14, Annex VII |

Access groups are ordered `public` < `legitimate-interest` < `authority`. A role sees its own group and every lower one.

## Field format

```jsonc
{
  "key": "e-gross",                       // unique within the record, used for deep links (#f-e-gross)
  "label": "Installed energy (gross)",
  "annex": "Annex VI A(7)",               // optional legal reference
  "value": "38.5",                        // string, list of strings, or null (= data gap)
  "unit": "kWh",                          // optional
  "provenance": "official",               // see below
  "sources": ["vwg-battery-journey"],     // ids from the record's sources list
  "note": "Martorell assembly reports …"  // optional; required for derived and estimated values
}
```

## Provenance tags

| Tag | Meaning | Rule enforced in CI |
|-----|---------|---------------------|
| `official` | Published by the manufacturer or its group | At least one source |
| `derived` | Arithmetic on official values | Note explains the method |
| `regulation` | Value set by law | none |
| `literature` | Published study, not manufacturer data | none |
| `estimated` | Engineering assumption | Note explains the method |
| `simulated` | Illustrative demo data (serial, date, BMS values) | none |
| `not-disclosed` | Required data the manufacturer has not published | Value must be `null` |

A `null` value is only allowed with `not-disclosed`, and `not-disclosed` only with `null`. Gaps therefore cannot
be filled with guesses by accident. Every source in the record must be cited at least once.

## The ID. Polo LFP record

`data/passports/vw-id-polo-lfp-37.json` has 86 attributes. Run `python scripts/validate_data.py --gaps` for
the current counts and the gap list.

What the public sources settle:

- **Chemistry and energy.** LFP, 37 kWh net, a "38.5 kWh" pack size label, 102 prismatic Unified Cells co-developed
  with PowerCo, cell-to-pack with three packs, a load-bearing housing.
- **Charging and use.** DC charging up to 88 kW (10–80 % in about 23 min), AC charging at 11 kW, Vehicle-to-Load up to 3.6 kW, WLTP 323–331 km.
- **Warranty.** 8 years or 160,000 km, at least 70 % state of health.
- **Production.** Battery system assembly in Workshop 20 of the SEAT & CUPRA plant in Martorell.
- **Due diligence.** The Raw Materials Due Diligence Management System (since 2020, OECD-based), ReSC, IRMA, and the annual Responsible Raw Materials Report.

Where the public sources disagree, the record uses the most recent source and says so in a note. Example: DC
power is 88 kW in the September 2026 media-drive data and 90 kW in the April 2026 world-premiere release.

What they do not settle (the gap report): the Article 7 carbon footprint declaration and class, battery weight,
voltage limits, cycle life, efficiency, internal resistance, recycled lithium share, the cell maker, part numbers,
dismantling information and test reports.

## Unique identifier

`VWAG-LFP37-20260914-004217-33` = economic operator · product type · production date · serial number · CRC-8 check code.

The scheme comes from the original HTW project (presentation slide 3, report section 4.1). This repository
adds the CRC-8 check code (polynomial 0x07, over the first four segments, as two hex digits), and the
landing page decoder verifies it. The serial number and date in the case study are illustrative.
