import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Runtime entrypoints that hold secrets or open connections. `import "server-only"` makes
// `next build` fail if a Client Component ever imports them. Pure schema/config modules are
// deliberately excluded so Drizzle Kit and other Node tooling can load them.
const SERVER_ONLY_ENTRYPOINTS = [
  "src/modules/orders/order.ts",
  "src/modules/orders/products.ts",
  "src/modules/orders/purchasers.ts",
  "src/modules/orders/create.ts",
  "src/modules/orders/queries.ts",
  "src/modules/orders/items.ts",
  "src/modules/payments/record.ts",
  "src/config/env.ts",
  "src/db/index.ts",
  "src/auth/server.ts",
  "src/integrations/email/resend.ts",
  "src/integrations/media/cloudinary.ts",
  "src/auth/access.ts",
  "src/auth/methods.ts",
  "src/app/(public)/activate/challenge-cookie.ts",
  "src/modules/accounts/set-role.ts",
  "src/modules/activation/credentials.ts",
  "src/modules/activation/claim.ts",
  "src/modules/cards/owned.ts",
  "src/modules/profiles/profiles.ts",
  "src/modules/profiles/view.ts",
  "src/modules/profiles/scenes.ts",
  "src/modules/profiles/blocks.ts",
  "src/modules/profiles/editor.ts",
  "src/modules/forms/forms.ts",
  "src/modules/forms/submissions.ts",
  "src/modules/forms/notify.ts",
  "src/integrations/email/sender.ts",
  "src/modules/cards/manage.ts",
  "src/modules/cards/resolve.ts",
  "src/app/(public)/c/[token]/cached-view.ts",
  "src/modules/activity/record.ts",
  "src/modules/cards/card.ts",
  "src/modules/cards/dbc.ts",
  "src/modules/cards/grc.ts",
  "src/modules/inventory/queries.ts",
  "src/modules/inventory/stock-intake.ts",
];

test.each(SERVER_ONLY_ENTRYPOINTS)("%s imports server-only before anything else", (file) => {
  const firstImport = readFileSync(file, "utf8").match(/^import\s+[^;]+;/m)?.[0];
  expect(firstImport).toBe('import "server-only";');
});
