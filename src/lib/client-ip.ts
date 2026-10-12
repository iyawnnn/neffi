// The client IP used to key abuse limits. Vercel overwrites both headers, so callers cannot spoof them; locally they
// may be absent and everyone shares one "unknown" bucket (mirrors Better Auth's ipAddressHeaders in src/auth/options.ts).
export const clientIp = (headers: Headers) =>
  (headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
