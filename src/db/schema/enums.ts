import { pgEnum } from "drizzle-orm/pg-core";

// Locked, slow-changing state sets. Adding a value is a reviewed migration (ALTER TYPE ... ADD VALUE).
export const accountRole = pgEnum("account_role", ["customer", "owner"]);
