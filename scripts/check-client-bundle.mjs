// Fails when a server-only secret value appears in anything the browser can download:
// client bundles (.next/static) and prerendered HTML/RSC payloads (.next/server/app).
// Run after `pnpm build` with the same environment the build used.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SECRET_VARS = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "RESEND_API_KEY",
  "ACTIVATION_CODE_SECRET",
  "ACTIVATION_CODE_ENCRYPTION_KEYS",
  "CLOUDINARY_API_SECRET",
];
const PUBLIC_OUTPUTS = [
  { dir: ".next/static", extensions: null },
  { dir: ".next/server/app", extensions: [".html", ".rsc", ".body", ".txt"] },
];
const MIN_NEEDLE_LENGTH = 8; // shorter fragments would match unrelated text

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const needles = [];
for (const name of SECRET_VARS) {
  const value = process.env[name];
  if (!value) continue;
  needles.push({ name, value });
  // Values embedded in JSON/RSC payloads appear escaped when they contain quotes or backslashes.
  const escaped = JSON.stringify(value).slice(1, -1);
  if (escaped !== value) needles.push({ name: `${name} (JSON-escaped)`, value: escaped });
  if (name === "ACTIVATION_CODE_ENCRYPTION_KEYS") {
    try {
      for (const encoded of Object.values(JSON.parse(value))) {
        if (typeof encoded !== "string") continue;
        needles.push({ name: `${name} (individual key)`, value: encoded });
        const decoded = Buffer.from(encoded, "base64");
        const textual = decoded.toString("utf8");
        if (Buffer.from(textual).equals(decoded)) needles.push({ name: `${name} (decoded key)`, value: textual });
      }
    } catch {}
  }
  // A bundle could embed just the password of a connection string.
  try {
    const password = decodeURIComponent(new URL(value).password);
    if (password) needles.push({ name: `${name} (password)`, value: password });
  } catch {}
}
const searchable = needles.filter(({ value }) => value.length >= MIN_NEEDLE_LENGTH);

if (searchable.length === 0) {
  console.error(`check-client-bundle: none of ${SECRET_VARS.join(", ")} is set; nothing to scan for.`);
  process.exit(1);
}
if (!existsSync(".next/static")) {
  console.error("check-client-bundle: .next/static not found; run `pnpm build` first.");
  process.exit(1);
}

const leaks = new Set();
let scanned = 0;
for (const { dir, extensions } of PUBLIC_OUTPUTS) {
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (extensions && !extensions.some((ext) => entry.name.endsWith(ext))) continue;
    const content = readFileSync(join(entry.parentPath, entry.name), "utf8");
    scanned++;
    for (const { name, value } of searchable) {
      if (content.includes(value)) leaks.add(`${name} in ${join(entry.parentPath, entry.name)}`);
    }
  }
}

if (leaks.size > 0) {
  // Report variable names and file paths only, never the values.
  console.error(`check-client-bundle: server secrets found in public build output:\n- ${[...leaks].join("\n- ")}`);
  process.exit(1);
}
console.log(`check-client-bundle: ${scanned} public files scanned, no server secret values found.`);
