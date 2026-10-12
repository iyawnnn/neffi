import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { accounts } from "./auth";
import { createdAt, timestamps } from "./columns";
import { blockType, formPreset, profileLinkType, profileStatus } from "./enums";

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
    // Every profile has a Default Scene; a NULL active scene means the Default Scene is showing.
    defaultSceneId: uuid(),
    activeSceneId: uuid(),
    // The single image is shown uncropped when it is a logo, otherwise as a round photo.
    imageIsLogo: boolean().notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    check("profiles_published_needs_name", sql`${t.status} <> 'published' OR ${t.fullName} IS NOT NULL`),
    check("profiles_accent_color_hex", sql`${t.accentColor} IS NULL OR ${t.accentColor} ~ '^#[0-9a-fA-F]{6}$'`),
    // Target for cards: a card may only route to a profile of the card's own owner.
    unique("profiles_id_account_unique").on(t.id, t.accountId),
    index("profiles_account_id_idx").on(t.accountId),
    foreignKey({ name: "profiles_default_scene_fk", columns: [t.defaultSceneId, t.id], foreignColumns: [scenes.id, scenes.profileId] }),
    foreignKey({ name: "profiles_active_scene_fk", columns: [t.activeSceneId, t.id], foreignColumns: [scenes.id, scenes.profileId] }),
    check("profiles_published_needs_default_scene", sql`${t.status} <> 'published' OR ${t.defaultSceneId} IS NOT NULL`),
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

// A context-specific presentation of a Profile. Belongs to the Profile, never to a Card.
export const scenes = pgTable(
  "scenes",
  {
    id: uuid().primaryKey().defaultRandom(),
    profileId: uuid()
      .notNull()
      .references((): AnyPgColumn => profiles.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps(),
  },
  (t) => [
    check("scenes_name_length", sql`char_length(${t.name}) BETWEEN 1 AND 40`),
    unique("scenes_id_profile_unique").on(t.id, t.profileId),
    index("scenes_profile_id_idx").on(t.profileId),
  ],
);

// Constrained, owner-configured form. Owned by the Profile so submissions outlive any block that shows it.
export const formDefinitions = pgTable(
  "form_definitions",
  {
    id: uuid().primaryKey().defaultRandom(),
    profileId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    preset: formPreset().notNull(),
    title: text().notNull(),
    // { fields: { name|email|phone|company|message: "hidden"|"optional"|"required" }, questions: [{ id, label, required }] },
    // validated by src/modules/forms/config.ts on every write.
    config: jsonb().notNull(),
    ...timestamps(),
  },
  (t) => [
    check("form_definitions_title_length", sql`char_length(${t.title}) BETWEEN 1 AND 60`),
    check("form_definitions_config_object", sql`jsonb_typeof(${t.config}) = 'object'`),
    unique("form_definitions_id_profile_unique").on(t.id, t.profileId),
    index("form_definitions_profile_id_idx").on(t.profileId),
  ],
);

// One structured content/action item. Content is type-specific and validated by src/modules/profiles/block-content.ts.
export const sceneBlocks = pgTable(
  "scene_blocks",
  {
    id: uuid().primaryKey().defaultRandom(),
    sceneId: uuid()
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    type: blockType().notNull(),
    position: integer().notNull(),
    visible: boolean().notNull().default(true),
    content: jsonb().notNull().default(sql`'{}'::jsonb`),
    formId: uuid().references(() => formDefinitions.id),
    ...timestamps(),
  },
  (t) => [
    check("scene_blocks_position_nonnegative", sql`${t.position} >= 0`),
    check("scene_blocks_content_object", sql`jsonb_typeof(${t.content}) = 'object'`),
    check("scene_blocks_form_only_on_form", sql`(${t.type} = 'form') = (${t.formId} IS NOT NULL)`),
    index("scene_blocks_scene_id_position_idx").on(t.sceneId, t.position),
    index("scene_blocks_form_id_idx").on(t.formId).where(sql`${t.formId} IS NOT NULL`),
  ],
);

// A visitor's message. Neffi's copy is the source of truth; email is only a notification.
export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: uuid().primaryKey().defaultRandom(),
    formId: uuid().notNull(),
    profileId: uuid().notNull(),
    // Generated by the visitor's browser per form view; a double submit or retry stores one submission.
    clientKey: uuid().notNull(),
    // Snapshot of what the visitor saw and typed: [{ label, value }]. Later form edits never change it.
    answers: jsonb().notNull(),
    createdAt: createdAt(),
    readAt: timestamp({ withTimezone: true }),
    notifiedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "form_submissions_form_fk",
      columns: [t.formId, t.profileId],
      foreignColumns: [formDefinitions.id, formDefinitions.profileId],
    }).onDelete("cascade"),
    check("form_submissions_answers_array", sql`jsonb_typeof(${t.answers}) = 'array'`),
    unique("form_submissions_form_client_key_unique").on(t.formId, t.clientKey),
    index("form_submissions_profile_created_idx").on(t.profileId, t.createdAt.desc()),
  ],
);
