// Unique identifier scheme (Art. 77(3) requires one per battery). From the original project
// (presentation slide 3, report section 4.1), with a CRC-8 check code added in this repository:
//   VWAG - LFP37 - 20260914 - 004217 - 33
//   economic operator | product type | production date | serial no. | check code
//
// parseUid() checks the format. proposeChecksum() computes the CRC-8 check code over the
// first four segments. The original project's examples used a fixed "A3".

export const SEGMENTS = [
  { key: "manufacturer", label: "Economic operator", color: "#e8772e", re: /^[A-Z]{2,6}\d{0,4}$/ },
  { key: "type", label: "Product type", color: "#8a96a8", re: /^[A-Z]{2,4}\d{1,3}$/ },
  { key: "lot", label: "Production date (YYYYMMDD)", color: "#f2b705", re: /^\d{8}$/ },
  { key: "serial", label: "Serial number", color: "#4a9ad8", re: /^\d{6}$/ },
  { key: "checksum", label: "Check code (CRC-8)", color: "#5aa846", re: /^[A-Z0-9]{2}$/ },
];

function validDate(yyyymmdd) {
  const y = +yyyymmdd.slice(0, 4), m = +yyyymmdd.slice(4, 6), d = +yyyymmdd.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Split a UID into labelled segments. Accepts the 5-part scheme and a 4-part form without serial number. */
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
    if (seg.key === "lot" && seg.re.test(value) && !validDate(value)) problems.push(`Production date "${value}" is not a valid calendar date.`);
    return { ...seg, value };
  });
  if (parts.length === 4) problems.push("Serial-number segment is absent.");
  return { uid, ok: problems.length === 0, segments, problems };
}

/** CRC-8 (poly 0x07) over the UID body, as 2 uppercase hex chars. */
export function proposeChecksum(body) {
  let crc = 0;
  for (const byte of new TextEncoder().encode(String(body).toUpperCase())) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc.toString(16).toUpperCase().padStart(2, "0");
}
