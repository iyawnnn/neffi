import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ readFileSync: vi.fn() }));
vi.mock("node:fs", async importOriginal => ({ ...await importOriginal<typeof import("node:fs")>(), readFileSync: m.readFileSync }));

import { generateLocalities, parsePsgcCsv, validateSource } from "./sync-psgc-localities";
import { checkPsgcSnapshot } from "./check-psgc-localities";

const csv = `PSA publication test fixture
10-digit PSGC,Geographic Name,Geographic Level,Correspondence Code
0300000000,Central Luzon,Reg,030000000
0305400000,Pampanga,Prov,035400000
0330100000,City of Angeles,City,035401000
0305416000,San Fernando,City,035416000
0100000000,Ilocos Region,Reg,010000000
0103300000,La Union,Prov,013300000
0103314000,San Fernando,City,013314000
1300000000,National Capital Region,Reg,130000000
1381300000,Quezon City,City,137404000
0305401000,Test municipality,Mun,035401000
0305401001,Test barangay,Bgy,035401001
0400000000,Region IV-A (CALABARZON),Reg,040000000
0405600000,Quezon,Prov,045600000
0431200000,City of Lucenaa/,City,045624000
0900000000,Region IX (Zamboanga Peninsula),Reg,090000000
0990100000,City of Isabela (Not a Province),,099700000
0990101000,City of Isabela,City,099701000
1900000000,BARMM,Reg,150000000
1999900000,Special Geographic Area,,
1999901000,Kapalawan,Mun,
1980600000,SubMun-like district,SubMun,
`;

beforeEach(() => vi.resetAllMocks());

test("official hierarchy import emits only city/municipality fields and preserves disambiguating provinces", () => {
  const locations = generateLocalities(csv);
  expect(locations).toHaveLength(8);
  expect(locations.filter(location => location.name === "San Fernando").map(location => location.displayName).sort()).toEqual(["San Fernando, La Union", "San Fernando, Pampanga"]);
  expect(locations.some(location => location.name.includes("barangay"))).toBe(false);
  expect(Object.keys(locations[0]).sort()).toEqual(["displayName", "name", "province", "psgcCode", "region"]);
});

test("NCR uses Metro Manila and HUC province lookup uses official legacy correspondence", () => {
  const locations = generateLocalities(csv);
  expect(locations.find(location => location.psgcCode === "1381300000")).toMatchObject({ province: "Metro Manila", region: "National Capital Region", displayName: "Quezon City, Metro Manila" });
  expect(locations.find(location => location.psgcCode === "0330100000")).toMatchObject({ name: "Angeles City", province: "Pampanga" });
  expect(locations.find(location => location.psgcCode === "0431200000")).toMatchObject({ displayName: "Lucena City, Quezon" });
});

test("Isabela City uses its geographic province and SGA municipalities use their official parent unit", () => {
  const locations = generateLocalities(csv);
  expect(locations.find(location => location.psgcCode === "0990101000")).toMatchObject({ displayName: "Isabela City, Basilan", region: "Region IX (Zamboanga Peninsula)" });
  expect(locations.find(location => location.psgcCode === "1999901000")).toMatchObject({ displayName: "Kapalawan, Special Geographic Area", region: "BARMM" });
});

test("CSV parser handles BOM, quoted commas, escaped quotes and line breaks", () => {
  const parsed = parsePsgcCsv('\uFEFF10-digit PSGC,Geographic Name,Geographic Level\r\n0305401000,"Name, with ""quotes""\nand newline",Mun');
  expect(parsed[0].name).toBe('Name, with "quotes"\nand newline');
  expect(() => parsePsgcCsv('name,level\n"unfinished')).toThrow("unclosed quoted field");
});

test("unknown parents or missing current codes stop import rather than inventing data", () => {
  expect(() => generateLocalities("10-digit PSGC,Geographic Name,Geographic Level\n0305401000,Unknown,Mun")).toThrow("reference missing");
  expect(() => generateLocalities("10-digit PSGC,Geographic Name,Geographic Level\n035401000,Old code,Mun")).toThrow("Invalid city/municipality");
});

test("provenance requires an official HTTPS PSA URL, real date and no credential/token URL", () => {
  expect(() => validateSource("https://psa.gov.ph/classification/psgc", "2026-06-30")).not.toThrow();
  for (const url of ["https://mirror.example/psgc", "https://psa.gov.ph/data?token=private", "https://user:pass@psa.gov.ph/data"]) expect(() => validateSource(url, "2026-06-30")).toThrow();
  expect(() => validateSource("https://psa.gov.ph/classification/psgc", "2026-02-31")).toThrow();
});

test("build check refuses a missing snapshot and a sample-sized snapshot", () => {
  m.readFileSync.mockImplementation(() => { throw new Error("ENOENT"); });
  expect(() => checkPsgcSnapshot("/test")).toThrow();
  m.readFileSync.mockImplementation((path: string) => path.endsWith(".source.json") ? JSON.stringify({ sourceUrl: "https://psa.gov.ph/classification/psgc", asOf: "2026-06-30", entries: 5, inputSha256: "a".repeat(64) }) : JSON.stringify(generateLocalities(csv)));
  expect(() => checkPsgcSnapshot("/test")).toThrow("incomplete");
});

test("build check accepts a full-shaped snapshot only with matching official provenance", () => {
  const locations = Array.from({ length: 1000 }, (_, i) => ({ psgcCode: `03${String(i).padStart(5, "0")}000`, name: `Fixture locality ${i}`, province: "Pampanga", region: "Region III", displayName: `Fixture locality ${i}, Pampanga` }));
  m.readFileSync.mockImplementation((path: string) => path.endsWith(".source.json") ? JSON.stringify({ sourceUrl: "https://psa.gov.ph/classification/psgc", asOf: "2026-06-30", entries: 1000, inputSha256: "a".repeat(64) }) : JSON.stringify(locations));
  expect(checkPsgcSnapshot("/test")).toBe(1000);
});
