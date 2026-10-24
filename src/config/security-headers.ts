export function securityHeaders({ dev, sentryDsn }: { dev: boolean; sentryDsn?: string }): { key: string; value: string }[] {
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${ACCOUNT_AVATAR_ORIGINS.join(" ")}`,
    "font-src 'self'",
    `connect-src 'self' https://api.cloudinary.com${sentryDsn ? ` ${new URL(sentryDsn).origin}` : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  return [{ key: "Content-Security-Policy", value: policy }, { key: "X-Content-Type-Options", value: "nosniff" }];
}
import { ACCOUNT_AVATAR_ORIGINS } from "../lib/account-avatar";
