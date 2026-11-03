// Unique Identifier (UID) scheme from the project (presentation slide 3, report §4.1):
//   MECH123 - BAT03 - 20251031 - 000765 - A3
//   manufacturer | product type / batch | production lot (date) | serial no. | checksum
//
// The project did not specify how the 2-character checksum is computed (all documented
// examples use "A3"). parseUid() therefore only checks the *format*. proposeChecksum()
// is an extension added in this repository (CRC-8, rendered as 2 hex digits) and is
// clearly labelled as such in the UI.

export const SEGMENTS = [
  { key: "manufacturer", label: "Manufacturer ID", color: "#e8772e", re: /^[A-Z]{2,6}\d{0,4}$/ },
  { key: "type", label: "Product type / batch code", color: "#8a96a8", re: /^[A-Z]{2,4}\d{1,3}$/ },
  { key: "lot", label: "Production lot (YYYYMMDD)", color: "#f2b705", re: /^\d{8}$/ },
  { key: "serial", label: "Serial number", color: "#4a9ad8", re: /^\d{6}$/ },
  { key: "checksum", label: "Checksum / data code", color: "#5aa846", re: /^[A-Z0-9]{2}$/ },
];

function validDate(yyyymmdd) {
  const y = +yyyymmdd.slice(0, 4), m = +yyyymmdd.slice(4, 6), d = +yyyymmdd.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Split a UID into labelled segments. Accepts the 5-part scheme and the 4-part form
 *  used by the Solid State Cell record (no serial number). */
export function parseUid(input) {
  const uid = String(input || "").trim().toUpperCase();
  const parts = uid.split("-").filter(Boolean);
  const problems = [];
  let mapped;
  if (parts.length === 5) mapped = parts;
  else if (parts.length === 4) mapped = [parts[0], parts[1], parts[2], null, parts[3]];
  else {
    return { uid, ok: false, segments: [], problems: ["Expected 5 hyphen-separated parts (or 4 without serial number)."] };
  }
  const segments = SEGMENTS.map((seg, i) => {
    const value = mapped[i];
    if (value === null) return { ...seg, value, missing: true };
    if (!seg.re.test(value)) problems.push(`${seg.label}: "${value}" does not match the expected format.`);
    if (seg.key === "lot" && seg.re.test(value) && !validDate(value)) problems.push(`Production lot "${value}" is not a valid calendar date.`);
    return { ...seg, value };
  });
  if (parts.length === 4) problems.push("Serial-number segment is absent (as in the documented Solid State Cell UID).");
  return { uid, ok: problems.length === 0, segments, problems };
}

/** CRC-8 (poly 0x07) over the UID body, as 2 uppercase hex chars. Repository extension. */
export function proposeChecksum(body) {
  let crc = 0;
  for (const byte of new TextEncoder().encode(String(body).toUpperCase())) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc.toString(16).toUpperCase().padStart(2, "0");
}
