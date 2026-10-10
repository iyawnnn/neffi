import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { createdAt, timestamps } from "./columns";
import { profileLinkType, profileStatus } from "./enums";

export const profiles = pgTable(
  "profiles",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id),
    status: profileStatus().notNull().default("draft"),
    // Optional while Draft; required to publish.
    fullName: text(),
    headline: text(),
    company: text(),
    bio: text(),
    phone: text(),
    // Public contact email, unrelated to the Account's sign-in email.
    email: text(),
    website: text(),
    location: text(),
    // One of Neffi's maintained themes (validated in the profiles module).
    theme: text().notNull().default("default"),
    accentColor: text(),
    // Cloudinary asset id only; image binaries never live in Postgres.
    imageAssetId: text(),
    ...timestamps(),
  },
  (t) => [
    check("profiles_published_needs_name", sql`${t.status} <> 'published' OR ${t.fullName} IS NOT NULL`),
    check("profiles_accent_color_hex", sql`${t.accentColor} IS NULL OR ${t.accentColor} ~ '^#[0-9a-fA-F]{6}$'`),
    // Target for cards: a card may only route to a profile of the card's own owner.
    unique("profiles_id_account_unique").on(t.id, t.accountId),
    index("profiles_account_id_idx").on(t.accountId),
  ],
);

export const profileLinks = pgTable(
  "profile_links",
  {
    id: uuid().primaryKey().defaultRandom(),
    profileId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: profileLinkType().notNull(),
    label: text(),
    // Allowed URL schemes are validated in the profiles module.
    url: text().notNull(),
    position: integer().notNull().default(0),
    visible: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    check("profile_links_position_nonnegative", sql`${t.position} >= 0`),
    index("profile_links_profile_id_position_idx").on(t.profileId, t.position),
  ],
);
