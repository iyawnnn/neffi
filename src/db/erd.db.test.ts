import { readFileSync } from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { generateErd } from "../../scripts/generate-erd";

let erd: string;
beforeAll(async () => {
  erd = await generateErd();
});

test("the committed ERD matches the schema migrated from zero", () => {
  expect(readFileSync("docs/database/erd.md", "utf8")).toBe(erd);
});

test("the ERD catalogs composite and nullable relationships, partial indexes and integrity guards", () => {
  expect(erd).toContain("26 tables");
  expect(erd).toContain("15 enums");
  expect(erd).toContain("profiles_default_scene_fk");
  expect(erd).toContain("form_submissions_form_client_key_unique");
  expect(erd).toContain("scene_blocks_form_only_on_form");
  expect(erd).toContain('profiles |o..o{ cards : "cards_profile_owner_fk"');
  expect(erd).toContain('accounts ||..o{ auth_sessions : "auth_sessions_account_id_accounts_id_fk"');
  expect(erd).toContain("FOREIGN KEY (profile_id, owner_account_id) REFERENCES profiles(id, account_id)");
  expect(erd).toContain("ON DELETE CASCADE");
  expect(erd).toContain("activation_credentials_one_usable_per_card");
  expect(erd).toContain("WHERE ((used_at IS NULL) AND (revoked_at IS NULL))");
  expect(erd).toContain("cards_dbc_only_fields");
  expect(erd).toContain("cards_dbc_ready_checks_recorded");
  expect(erd).toContain("package_matched_at = NULL");
  expect(erd).toContain("payments_history_guard");
  expect(erd).toMatch(/CREATE TRIGGER payments_history_guard BEFORE (DELETE OR UPDATE|UPDATE OR DELETE) ON (public\.)?payments/);
  expect(erd).toContain("FUNCTION public.history_guard()");
  expect(erd).toContain("recorded history and cannot be changed");
  expect(erd).toContain("revoke the card");
  expect(erd).toContain("GENERATED ALWAYS AS IDENTITY");
});
