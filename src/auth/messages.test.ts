import { describe, expect, test } from "vitest";
import { authErrorMessage, GENERIC_AUTH_ERROR } from "./messages";

describe("authErrorMessage", () => {
  test.each(["account_not_linked", "unable_to_create_user", "email_does_not_match", "account_already_linked_to_different_user"])(
    "explains %s in our own words",
    (code) => {
      const message = authErrorMessage(code);
      expect(message).toBeTruthy();
      expect(message).not.toBe(GENERIC_AUTH_ERROR);
      expect(message).not.toContain(code);
    },
  );

  test("anything else is generic, so a crafted ?error= cannot inject text", () => {
    expect(authErrorMessage("<script>alert(1)</script>")).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage("Call 555-0100 to unlock your account")).toBe(GENERIC_AUTH_ERROR);
  });

  test("no error means no message", () => {
    for (const none of [undefined, "", null, 5]) expect(authErrorMessage(none)).toBeUndefined();
  });
});
