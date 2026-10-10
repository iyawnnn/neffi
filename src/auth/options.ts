import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { accounts, authIdentities, authSessions, authVerifications } from "@/db/schema";

type AuthOptionsInput = {
  db: Parameters<typeof drizzleAdapter>[0];
  secret: string;
  baseURL: string;
};

// Shared by the server instance and the database tests, so tests exercise the real persistence wiring.
// Still no sign-in methods: Google and email OTP arrive in Milestone 3, so nothing can create rows over HTTP.
export function authOptions({ db, secret, baseURL }: AuthOptionsInput) {
  return {
    secret,
    baseURL,
    trustedOrigins: [baseURL],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: accounts, account: authIdentities, session: authSessions, verification: authVerifications },
    }),
    emailAndPassword: { enabled: false },
    user: { additionalFields: { role: { type: "string", input: false, defaultValue: "customer" } } },
    advanced: {
      // Better Auth silently skips origin checks when it detects a test runner; pin production behavior.
      disableOriginCheck: false,
      // Postgres generates UUID primary keys, like every other Neffi table.
      database: { generateId: "uuid" },
    },
  } satisfies BetterAuthOptions;
}
