import { z } from "zod";

const localitySchema = z.array(z.object({
  psgcCode: z.string().regex(/^\d{7}000$/),
  name: z.string().min(1),
  province: z.string().min(1),
  region: z.string().min(1),
  displayName: z.string().min(1).max(80),
}));
export type PhilippineLocality = z.infer<typeof localitySchema>[number];

export function parseLocalities(value: unknown): PhilippineLocality[] {
  const locations = localitySchema.parse(value);
  if (!locations.length || new Set(locations.map(location => location.psgcCode)).size !== locations.length || new Set(locations.map(location => location.displayName)).size !== locations.length || locations.some(location => location.displayName !== `${location.name}, ${location.province}`)) throw new Error("Invalid locality snapshot");
  return locations;
}
