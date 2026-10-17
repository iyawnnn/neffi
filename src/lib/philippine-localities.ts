import type { PhilippineLocality } from "./philippine-localities-validation";
export type { PhilippineLocality } from "./philippine-localities-validation";

// The same-origin snapshot is validated by the PSGC importer and production build gate.
export async function loadPhilippineLocalities(fetcher: typeof fetch = fetch): Promise<PhilippineLocality[]> {
  const response = await fetcher("/data/philippine-localities.json", { cache: "force-cache" });
  if (!response.ok) throw new Error("Locations unavailable");
  return response.json() as Promise<PhilippineLocality[]>;
}

export function localityLabel(location: PhilippineLocality) {
  return location.displayName;
}

const searchable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function searchLocalities(locations: PhilippineLocality[], query: string) {
  const normalized = searchable(query).replace(/[\s,]+/g, " ").trim();
  const words = normalized.split(" ").filter(Boolean);
  const matches = (value: string) => words.every(word => searchable(value).includes(word));
  const rank = (location: PhilippineLocality) => {
    const name = searchable(location.name);
    if (!normalized || name === normalized) return 0;
    if (name.startsWith(normalized)) return 1;
    return matches(name) ? 2 : 3;
  };
  return locations.filter(location => matches(localityLabel(location)))
    .sort((a, b) => rank(a) - rank(b) || localityLabel(a).localeCompare(localityLabel(b)))
    .map(localityLabel);
}

export function locationOptions(locations: PhilippineLocality[], query: string) {
  return searchLocalities(locations, query).slice(0, 40);
}
