import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, vi } from "vitest";
import { loadPhilippineLocalities, locationOptions, searchLocalities } from "./philippine-localities";
import { parseLocalities } from "./philippine-localities-validation";

const locations = [
  { psgcCode: "0305416000", name: "San Fernando", province: "Pampanga", region: "Region III", displayName: "San Fernando, Pampanga" },
  { psgcCode: "0103314000", name: "San Fernando", province: "La Union", region: "Region I", displayName: "San Fernando, La Union" },
  { psgcCode: "1381300000", name: "Quezon City", province: "Metro Manila", region: "NCR", displayName: "Quezon City, Metro Manila" },
];

test("search matches city/province words, case-insensitively, and disambiguates duplicate names", () => {
  expect(searchLocalities(locations, "SAN FERNANDO")).toEqual(["San Fernando, La Union", "San Fernando, Pampanga"]);
  expect(searchLocalities(locations, "fernando, pampanga")).toEqual(["San Fernando, Pampanga"]);
  expect(searchLocalities(locations, "unknown")).toEqual([]);
});

test("province search lists the province's localities, ranked after localities whose own name matches", () => {
  const quezon = [
    ...locations,
    { psgcCode: "0405637000", name: "Quezon", province: "Quezon", region: "Region IV-A", displayName: "Quezon, Quezon" },
    ...Array.from({ length: 45 }, (_, i) => ({ psgcCode: `04056${String(i).padStart(2, "0")}000`, name: `Agdangan ${i}`, province: "Quezon", region: "Region IV-A", displayName: `Agdangan ${i}, Quezon` })),
  ];
  expect(searchLocalities(locations, "pampanga")).toEqual(["San Fernando, Pampanga"]);
  expect(locationOptions(quezon, "quezon").slice(0, 2)).toEqual(["Quezon, Quezon", "Quezon City, Metro Manila"]);
});

test("ranks exact locality, prefix, contains and province-only matches in that order", () => {
  const ranked = [
    { ...locations[0], name: "Agdangan", province: "Quezon", displayName: "Agdangan, Quezon" },
    { ...locations[0], name: "General Quezon", province: "Isabela", displayName: "General Quezon, Isabela" },
    locations[2],
    { ...locations[0], name: "Quezon", province: "Bukidnon", displayName: "Quezon, Bukidnon" },
  ];
  expect(searchLocalities(ranked, "QUEZON")).toEqual(["Quezon, Bukidnon", "Quezon City, Metro Manila", "General Quezon, Isabela", "Agdangan, Quezon"]);
  expect(searchLocalities(ranked, " quezon, ")).toEqual(searchLocalities(ranked, "quezon"));
});

test("snapshot rejects duplicate identifiers, barangay codes and inconsistent display names", () => {
  expect(() => parseLocalities([locations[0], locations[0]])).toThrow();
  expect(() => parseLocalities([locations[0], { ...locations[0], psgcCode: "0305417000" }])).toThrow();
  expect(() => parseLocalities([{ ...locations[0], psgcCode: "0305416001" }])).toThrow();
  expect(() => parseLocalities([{ ...locations[0], displayName: "Wrong province" }])).toThrow();
});

test("only dataset entries are offered; legacy text and unavailable data never create options", () => {
  expect(locationOptions([], "Manila")).toEqual([]);
  expect(locationOptions([], "")).toEqual([]);
  expect(locationOptions(locations, "San Fernando")).toEqual(["San Fernando, La Union", "San Fernando, Pampanga"]);
});

test("arbitrary typed locations do not become selectable fallback values", () => {
  expect(locationOptions([], "Baguio")).toEqual([]);
  expect(locationOptions(locations, "some random place")).toEqual([]);
});

test("provider requests the build-validated local snapshot with caching", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(locations)));
  expect(await loadPhilippineLocalities(fetcher)).toEqual(locations);
  expect(fetcher).toHaveBeenCalledWith("/data/philippine-localities.json", { cache: "force-cache" });
});

test("provider loads the generated PSA snapshot and real searches return disambiguated localities", async () => {
  const snapshot = readFileSync(resolve("public/data/philippine-localities.json"), "utf8");
  const real = await loadPhilippineLocalities(vi.fn<typeof fetch>().mockResolvedValue(new Response(snapshot)));
  expect(real).toHaveLength(1642);
  expect(real.every(location => location.psgcCode.endsWith("000"))).toBe(true);
  expect(real.filter(location => location.psgcCode.startsWith("13")).every(location => location.province === "Metro Manila")).toBe(true);
  expect(locationOptions(real, "san fernando")).toEqual(expect.arrayContaining(["San Fernando City, Pampanga", "San Fernando City, La Union", "San Fernando, Cebu"]));
  expect(locationOptions(real, "angeles")).toEqual(["Angeles City, Pampanga"]);
  const quezonMatches = locationOptions(real, "quezon");
  expect(quezonMatches.indexOf("Quezon City, Metro Manila")).toBeLessThan(quezonMatches.indexOf("Agdangan, Quezon"));
  expect(locationOptions(real, "pampanga")).toHaveLength(22);
  expect(locationOptions(real, "zzzz")).toEqual([]);
});

test.each([new Response("", { status: 404 }), new Response("not json")])("provider rejects unavailable or non-JSON responses", async response => {
  await expect(loadPhilippineLocalities(vi.fn<typeof fetch>().mockResolvedValue(response))).rejects.toThrow();
});

test.each([
  { snapshot: [] },
  { snapshot: [{ name: "missing fields" }] },
])("import/build validation rejects incomplete snapshot content", ({ snapshot }) => {
  expect(() => parseLocalities(snapshot)).toThrow();
});
