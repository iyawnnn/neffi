CREATE TABLE "auth_otp_quotas" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_otp_quotas_count_positive" CHECK ("auth_otp_quotas"."count" > 0),
	CONSTRAINT "auth_otp_quotas_key_hash" CHECK ("auth_otp_quotas"."key" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limits_key_unique" UNIQUE("key")
);
