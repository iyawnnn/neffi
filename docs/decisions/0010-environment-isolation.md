# 0010 — Environment isolation

**Status:** Accepted (M1)

## Decision

Development and Preview use a separate Neon project (`neffi-dev`). Production uses the distinct `neffi-production` project. `src/config/isolation.ts` refuses a production database outside Production and, in Production, any host not listed in `PRODUCTION_DATABASE_HOSTS`. Only the verified Production endpoint is registered; an empty allowlist still fails closed.

Real customer data is never copied to development or Preview. Secrets are scoped per environment and never committed. Live migrations or resets on any shared database need explicit approval.

## Consequences

Production is deployed separately from development. Procedures are in [operations](../operations.md); current acceptance status belongs in [roadmap](../roadmap.md).
