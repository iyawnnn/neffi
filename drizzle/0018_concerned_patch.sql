ALTER TABLE "profiles" ADD COLUMN "cover_asset_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "cover_width" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "cover_height" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "cover_crop_x" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "cover_crop_y" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "cover_crop_width" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_cover_complete" CHECK (num_nonnulls("profiles"."cover_asset_id", "profiles"."cover_width", "profiles"."cover_height", "profiles"."cover_crop_x", "profiles"."cover_crop_y", "profiles"."cover_crop_width") IN (0, 6));--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_cover_bounds" CHECK ("profiles"."cover_asset_id" IS NULL OR ("profiles"."cover_width" > 0 AND "profiles"."cover_height" > 0 AND "profiles"."cover_crop_x" >= 0 AND "profiles"."cover_crop_y" >= 0 AND "profiles"."cover_crop_width" >= 600 AND "profiles"."cover_crop_x"::bigint + "profiles"."cover_crop_width" <= "profiles"."cover_width" AND "profiles"."cover_crop_y"::bigint + round("profiles"."cover_crop_width"::numeric / 3) <= "profiles"."cover_height"));