import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseLocalities, type PhilippineLocality } from "../src/lib/philippine-localities-validation";

const headerKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
type PsgcRow = { code: string; name: string; level: string; correspondence: string; province: string; region: string };

// Read the official publication sheet exported as UTF-8 CSV, including quoted commas/newlines.
export function parsePsgcCsv(csv: string): PsgcRow[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const source = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === ",") { row.push(cell); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      row.push(cell); rows.push(row); row = []; cell = "";
      if (char === "\r" && source[i + 1] === "\n") i++;
    } else cell += char;
  }
  if (quoted) throw new Error("PSGC CSV contains an unclosed quoted field.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const start = rows.findIndex(cells => cells.some(value => ["geographiclevel", "level"].includes(headerKey(value))) && cells.some(value => ["geographicname", "name"].includes(headerKey(value))));
  if (start < 0) throw new Error("Use the official PSGC publication sheet with PSGC code, Geographic Name and Geographic Level headers.");
  const headers = rows[start].map(headerKey);
  const column = (...names: string[]) => headers.findIndex(header => names.includes(header));
  const code = column("10digitpsgc", "10digitpsgccode", "psgccode", "psgc");
  const name = column("geographicname", "name");
  const level = column("geographiclevel", "level");
  if (code < 0) throw new Error("The official 10-digit PSGC code column is required. Do not derive current codes from legacy codes.");
  const correspondence = column("correspondencecode", "9digitpsgc", "9digitpsgccode");
  const province = column("province", "provincename");
  const region = column("region", "regionname");
  return rows.slice(start + 1).filter(cells => cells[code]?.trim()).map(cells => ({
    code: cells[code].trim(), name: cells[name]?.trim() ?? "", level: headerKey(cells[level] ?? ""),
    correspondence: cells[correspondence]?.trim() ?? "", province: cells[province]?.trim() ?? "", region: cells[region]?.trim() ?? "",
  }));
}

// PSGC Notes A.2: Isabela City has a special province code but is geographically in Basilan.
const geographicProvinces: Record<string, string> = { "0990101000": "Basilan" };

export function generateLocalities(csv: string): PhilippineLocality[] {
  const rows = parsePsgcCsv(csv);
  const regions = new Map(rows.filter(row => ["reg", "region"].includes(row.level)).map(row => [row.code.slice(0, 2), row.name]));
  const provinces = rows.filter(row => ["prov", "province"].includes(row.level));
  const byCode = new Map(provinces.map(row => [row.code.slice(0, 5), row.name]));
  const byCorrespondence = new Map(provinces.filter(row => /^\d{9}$/.test(row.correspondence)).map(row => [row.correspondence.slice(0, 4), row.name]));
  // Province-level units without a level, such as the Special Geographic Area.
  const otherParents = new Map(rows.filter(row => !row.level && /^\d{5}00000$/.test(row.code)).map(row => [row.code.slice(0, 5), row.name]));
  const localities = rows.filter(row => ["city", "mun", "municipality"].includes(row.level)).map(row => {
    if (!/^\d{7}000$/.test(row.code)) throw new Error(`Invalid city/municipality PSGC code: ${row.code}`);
    const region = row.region || regions.get(row.code.slice(0, 2));
    // NCR has districts rather than provinces. Legacy correspondence resolves independent cities' geographic provinces.
    const province = row.code.startsWith("13") ? "Metro Manila" : geographicProvinces[row.code] || row.province || byCode.get(row.code.slice(0, 5)) || (/^\d{9}$/.test(row.correspondence) ? byCorrespondence.get(row.correspondence.slice(0, 4)) : undefined) || otherParents.get(row.code.slice(0, 5));
    if (!region || !province) throw new Error(`Official region/province reference missing for ${row.name} (${row.code}). Include the official parent rows and correspondence codes or explicit province/region columns; do not guess.`);
    // PSA appends footnote markers such as "a/" to some names.
    const name = row.name.replace(/[a-z\d]\/$/, "").replace(/\s+\(Capital\)$/i, "").replace(/^City of (.+)$/i, "$1 City");
    return { psgcCode: row.code, name, province, region, displayName: `${name}, ${province}` };
  });
  return parseLocalities(localities).sort((a, b) => a.psgcCode.localeCompare(b.psgcCode));
}

export function validateSource(sourceUrl: string, asOf: string) {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:" || !(url.hostname === "psa.gov.ph" || url.hostname.endsWith(".psa.gov.ph")) || url.username || url.password || url.search || url.hash) throw new Error("Record a canonical official PSA source URL without credentials, query tokens or fragments.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf)) || new Date(asOf).toISOString().slice(0, 10) !== asOf) throw new Error("Supply the official release's as-of date as YYYY-MM-DD.");
}

function main() {
  const [input, sourceUrl, asOf] = process.argv.slice(2);
  if (!input || !sourceUrl || !asOf) throw new Error("Usage: node --import tsx scripts/sync-psgc-localities.ts <official-PSGC.csv> <https://psa.gov.ph/source> <YYYY-MM-DD>");
  validateSource(sourceUrl, asOf);
  const csv = readFileSync(resolve(input), "utf8");
  const locations = generateLocalities(csv);
  if (locations.length < 1000) throw new Error("Expected a nationwide PSGC publication, not a filtered or sample city list (fewer than 1,000 localities).");
  const directory = resolve("public/data");
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "philippine-localities.json"), `${JSON.stringify(locations, null, 2)}\n`);
  writeFileSync(resolve(directory, "philippine-localities.source.json"), `${JSON.stringify({ sourceUrl, asOf, entries: locations.length, inputSha256: createHash("sha256").update(csv).digest("hex") }, null, 2)}\n`);
  console.log(`Generated ${locations.length} city/municipality entries. Review and commit both public/data/philippine-localities*.json files.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : "PSGC import failed."); process.exitCode = 1; }
}
