export type AppEnv = "development" | "preview" | "production";

// Neon endpoint hostnames of the production project (hostnames are not secrets).
// neffi-production / lingering-mountain-71377561; pooled and direct names normalize to this host.
export const PRODUCTION_DATABASE_HOSTS: readonly string[] = ["ep-gentle-cell-aoctmxkt.c-2.ap-southeast-1.aws.neon.tech"];

const APP_ENVS: readonly AppEnv[] = ["development", "preview", "production"];

export function resolveAppEnv(vercelEnv: string | undefined): AppEnv {
  if (vercelEnv === undefined) return "development";
  if ((APP_ENVS as readonly string[]).includes(vercelEnv)) return vercelEnv as AppEnv;
  throw new Error("VERCEL_ENV must be development, preview or production");
}

// Neon's pooled hostname is the direct hostname with "-pooler" appended to the endpoint id.
const normalizeHost = (host: string) => host.toLowerCase().replace(/\.$/, "").replace(/-pooler(?=\.)/, "");

// postgres URLs are a non-special scheme, so the URL parser leaves the host opaque. Reject anything
// a driver could resolve to a different server than the one this guard compares.
const OVERRIDE_PARAMS = ["host", "hostaddr", "port"];

export function assertDatabaseIsolation(
  appEnv: AppEnv,
  databaseUrl: string,
  productionHosts: readonly string[] = PRODUCTION_DATABASE_HOSTS,
): void {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
  if (/[%,]/.test(parsed.hostname) || !parsed.hostname) {
    throw new Error("DATABASE_URL must name exactly one plain hostname");
  }
  if (OVERRIDE_PARAMS.some((param) => parsed.searchParams.has(param))) {
    throw new Error("DATABASE_URL must not override the host via query parameters");
  }
  const host = normalizeHost(parsed.hostname);

  const isProductionHost = productionHosts.map(normalizeHost).includes(host);
  if (appEnv !== "production" && isProductionHost) {
    throw new Error(`Refusing to use a production database in the ${appEnv} environment`);
  }
  if (appEnv === "production" && !isProductionHost) {
    throw new Error("Production requires a registered production database host (PRODUCTION_DATABASE_HOSTS)");
  }
}
