export type AppEnv = "development" | "preview" | "production";

// Neon endpoint hostnames of the production project (hostnames are not secrets).
// Empty until the production Neon project exists, so any production boot fails closed.
export const PRODUCTION_DATABASE_HOSTS: readonly string[] = [];

const APP_ENVS: readonly AppEnv[] = ["development", "preview", "production"];

export function resolveAppEnv(vercelEnv: string | undefined): AppEnv {
  if (vercelEnv === undefined) return "development";
  if ((APP_ENVS as readonly string[]).includes(vercelEnv)) return vercelEnv as AppEnv;
  throw new Error("VERCEL_ENV must be development, preview or production");
}

// Neon's pooled hostname is the direct hostname with "-pooler" appended to the endpoint id.
const normalizeHost = (host: string) => host.toLowerCase().replace(/-pooler(?=\.)/, "");

export function assertDatabaseIsolation(
  appEnv: AppEnv,
  databaseUrl: string,
  productionHosts: readonly string[] = PRODUCTION_DATABASE_HOSTS,
): void {
  let host: string;
  try {
    host = normalizeHost(new URL(databaseUrl).hostname);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }

  const isProductionHost = productionHosts.map(normalizeHost).includes(host);
  if (appEnv !== "production" && isProductionHost) {
    throw new Error(`Refusing to use a production database in the ${appEnv} environment`);
  }
  if (appEnv === "production" && !isProductionHost) {
    throw new Error("Production requires a registered production database host (PRODUCTION_DATABASE_HOSTS)");
  }
}
