import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Browser-side Better Auth client for the sign-in form and the Connect Google button. Same-origin, no secrets.
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
