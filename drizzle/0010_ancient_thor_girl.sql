-- M6: Scenes, Scene Blocks, native Forms and submissions (additive). Rollback: drop form_submissions, scene_blocks, form_definitions, scenes, the profiles default/active scene and image_is_logo columns, and the block_type/form_preset enums; profile_links still holds the pre-M6 links.
CREATE TYPE "public"."block_type" AS ENUM('about', 'project', 'link', 'contact', 'booking', 'form');--> statement-breakpoint
CREATE TYPE "public"."form_preset" AS ENUM('connect', 'project_inquiry', 'contact');--> statement-breakpoint
CREATE TABLE "form_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"preset" "form_preset" NOT NULL,
	"title" text NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_definitions_id_profile_unique" UNIQUE("id","profile_id"),
	CONSTRAINT "form_definitions_title_length" CHECK (char_length("form_definitions"."title") BETWEEN 1 AND 60),
	CONSTRAINT "form_definitions_config_object" CHECK (jsonb_typeof("form_definitions"."config") = 'object')
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"client_key" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	CONSTRAINT "form_submissions_form_client_key_unique" UNIQUE("form_id","client_key"),
	CONSTRAINT "form_submissions_answers_array" CHECK (jsonb_typeof("form_submissions"."answers") = 'array')
);
--> statement-breakpoint
CREATE TABLE "scene_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"type" "block_type" NOT NULL,
	"position" integer NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"form_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_blocks_position_nonnegative" CHECK ("scene_blocks"."position" >= 0),
	CONSTRAINT "scene_blocks_content_object" CHECK (jsonb_typeof("scene_blocks"."content") = 'object'),
	CONSTRAINT "scene_blocks_form_only_on_form" CHECK (("scene_blocks"."type" = 'form') = ("scene_blocks"."form_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenes_id_profile_unique" UNIQUE("id","profile_id"),
	CONSTRAINT "scenes_name_length" CHECK (char_length("scenes"."name") BETWEEN 1 AND 40)
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "default_scene_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "active_scene_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "image_is_logo" boolean DEFAULT false NOT NULL;--> statement-breakpoint

ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_fk" FOREIGN KEY ("form_id","profile_id") REFERENCES "public"."form_definitions"("id","profile_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_blocks" ADD CONSTRAINT "scene_blocks_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_blocks" ADD CONSTRAINT "scene_blocks_form_id_form_definitions_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Cascade Scenes before Forms so their Blocks are removed before the form reference is checked.
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_definitions" ADD CONSTRAINT "form_definitions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_definitions_profile_id_idx" ON "form_definitions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "form_submissions_profile_created_idx" ON "form_submissions" USING btree ("profile_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "scene_blocks_scene_id_position_idx" ON "scene_blocks" USING btree ("scene_id","position");--> statement-breakpoint
CREATE INDEX "scene_blocks_form_id_idx" ON "scene_blocks" USING btree ("form_id") WHERE "scene_blocks"."form_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "scenes_profile_id_idx" ON "scenes" USING btree ("profile_id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_default_scene_fk" FOREIGN KEY ("default_scene_id","id") REFERENCES "public"."scenes"("id","profile_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_active_scene_fk" FOREIGN KEY ("active_scene_id","id") REFERENCES "public"."scenes"("id","profile_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
--> statement-breakpoint
-- Every existing Profile gets a Default Scene; its flat links become ordered Link blocks there.
-- profile_links is kept unchanged (unused from M6 on) so this migration stays reversible.
INSERT INTO "scenes" ("profile_id", "name") SELECT "id", 'Main' FROM "profiles";--> statement-breakpoint
UPDATE "profiles" p SET "default_scene_id" = s."id" FROM "scenes" s WHERE s."profile_id" = p."id";--> statement-breakpoint
INSERT INTO "scene_blocks" ("scene_id", "type", "position", "visible", "content")
SELECT p."default_scene_id", 'link',
       (row_number() OVER (PARTITION BY l."profile_id" ORDER BY l."position", l."created_at", l."id") - 1)::int,
       l."visible",
       jsonb_strip_nulls(jsonb_build_object('kind', l."type"::text, 'label', l."label", 'url', l."url"))
FROM "profile_links" l JOIN "profiles" p ON p."id" = l."profile_id";--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_published_needs_default_scene" CHECK ("profiles"."status" <> 'published' OR "profiles"."default_scene_id" IS NOT NULL);