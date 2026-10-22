CREATE TYPE "public"."profile_color_mode" AS ENUM('light', 'dark');--> statement-breakpoint
CREATE TYPE "public"."profile_goal" AS ENUM('networking', 'freelance', 'business', 'student');--> statement-breakpoint
CREATE TYPE "public"."profile_layout" AS ENUM('classic', 'editorial', 'showcase');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "layout" "profile_layout" DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "color_mode" "profile_color_mode" DEFAULT 'light' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "goal" "profile_goal";--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "profiles" WHERE "theme" <> 'default') THEN
    RAISE EXCEPTION 'profiles.theme contains an unexpected legacy value';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "theme";
