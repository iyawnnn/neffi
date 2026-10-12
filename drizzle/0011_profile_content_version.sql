-- M7: public Scene cache version (additive). Rollback: ALTER TABLE "profiles" DROP COLUMN "content_version".
ALTER TABLE "profiles" ADD COLUMN "content_version" integer DEFAULT 0 NOT NULL;