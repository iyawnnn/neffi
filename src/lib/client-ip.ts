import { isIP } from "node:net";

// The client IP used to key abuse limits. Vercel overwrites both headers, so callers cannot spoof them; locally they
// may be absent and everyone shares one "unknown" bucket (mirrors Better Auth's ipAddressHeaders in src/auth/options.ts).
export function clientIp(headers: Headers): string {
  const ip = (headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (isIP(ip) !== 6) return ip;
  const hex = ip.split("%")[0].replace(/\d+\.\d+\.\d+\.\d+$/, (tail) => {
    const bytes = tail.split(".").map(Number);
    return `${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  });
  const [left, right] = hex.split("::").map((part) => part ? part.split(":") : []);
  const parts = [...left, ...Array(8 - left.length - (right?.length ?? 0)).fill("0"), ...(right ?? [])].map((part) => parseInt(part, 16));
  if (parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff) {
    return [parts[6] >> 8, parts[6] & 255, parts[7] >> 8, parts[7] & 255].join(".");
  }
  return `${parts.slice(0, 4).map((part) => part.toString(16)).join(":")}::`;
}
