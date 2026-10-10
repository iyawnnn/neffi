import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Runtime entrypoints that hold secrets or open connections. `import "server-only"` makes
// `next build` fail if a Client Component ever imports them. Pure schema/config modules are
// deliberately excluded so Drizzle Kit and other Node tooling can load them.
const SERVER_ONLY_ENTRYPOINTS = [
  "src/config/env.ts",
  "src/db/index.ts",
  "src/auth/server.ts",
  "src/integrations/email/resend.ts",
  "src/auth/access.ts",
  "src/auth/methods.ts",
];

test.each(SERVER_ONLY_ENTRYPOINTS)("%s imports server-only before anything else", (file) => {
  const firstImport = readFileSync(file, "utf8").match(/^import\s+[^;]+;/m)?.[0];
  expect(firstImport).toBe('import "server-only";');
});
