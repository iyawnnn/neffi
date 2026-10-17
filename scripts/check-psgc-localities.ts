import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseLocalities } from "../src/lib/philippine-localities-validation";
import { validateSource } from "./sync-psgc-localities";

export function checkPsgcSnapshot(root = process.cwd()) {
  const locations = parseLocalities(JSON.parse(readFileSync(resolve(root, "public/data/philippine-localities.json"), "utf8")));
  const source = JSON.parse(readFileSync(resolve(root, "public/data/philippine-localities.source.json"), "utf8"));
  validateSource(source.sourceUrl, source.asOf);
  if (locations.length < 1000 || source.entries !== locations.length || !/^[a-f0-9]{64}$/.test(source.inputSha256)) throw new Error("PSGC snapshot is incomplete or has no valid provenance manifest.");
  return locations.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(`PSGC snapshot: ${checkPsgcSnapshot()} localities verified.`); }
  catch { console.error("PSGC snapshot missing or invalid. Import an official PSA publication using scripts/sync-psgc-localities.ts; see docs/architecture/philippine-localities.md. Production build stopped."); process.exitCode = 1; }
}
