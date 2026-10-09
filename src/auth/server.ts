import "server-only";
import { betterAuth } from "better-auth/minimal";
import { env } from "@/config/env";

// Foundation shell only: no database adapter (the Account/Auth schema arrives in Milestone 2) and no
// sign-in methods (Google + email OTP arrive in Milestone 3). Without `database`, Better Auth keeps an
// ephemeral in-memory store that nothing can write to, because no sign-in method is enabled.
export const auth = betterAuth({
  secret: env.betterAuthSecret,
  baseURL: env.authBaseUrl,
  trustedOrigins: [env.authBaseUrl],
  emailAndPassword: { enabled: false },
  // Better Auth silently skips origin checks when it detects a test runner; pin production behavior.
  advanced: { disableOriginCheck: false },
});
