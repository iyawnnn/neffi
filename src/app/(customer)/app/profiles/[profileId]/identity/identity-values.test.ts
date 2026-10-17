import { expect, test } from "vitest";
import { detailValues, detailsDirty, identityPhone, mobileNumber, phoneInput, type DetailsProfile } from "./identity-values";

const profile: DetailsProfile = { id: "p1", fullName: "Ana", headline: null, company: null, bio: null, phone: "+639123456789", email: null, website: null, location: "Manila" };

test.each(["912 345 6789", "09123456789", "+63 912 345 6789", "639123456789"])("normalizes Philippine mobile input %s", value => {
  expect(mobileNumber(value)).toBe("+639123456789");
  expect(phoneInput(value)).toBe("9123456789");
});

test("invalid numbers are rejected, and empty optional phone can be cleared", () => {
  expect(mobileNumber("garbage")).toBeNull();
  expect(mobileNumber("1234567890")).toBeNull();
  expect(mobileNumber("")).toBe("");
  expect(identityPhone("", profile.phone)).toBe("");
});

test("existing international numbers are preserved when other fields change", () => {
  const international = { ...profile, phone: "+14155552671" };
  const values = { ...detailValues(international), headline: "Designer" };
  expect(identityPhone(values.phone, international.phone)).toBe("+14155552671");
  expect(identityPhone("+14155552672", international.phone)).toBeNull();
});

test("dirty state clears when values are restored or adopted as the saved baseline", () => {
  const saved = detailValues(profile);
  expect(detailsDirty(saved, detailValues(profile))).toBe(false);
  const edited = { ...saved, headline: "Designer" };
  expect(detailsDirty(edited, saved)).toBe(true);
  expect(detailsDirty(edited, edited)).toBe(false);
});

test("prepares changed Philippine phone input without changing the saved value", () => {
  expect(identityPhone("0917 123 4567", profile.phone)).toBe("+639171234567");
  expect(identityPhone("0917", profile.phone)).toBeNull();
  expect(identityPhone(detailValues(profile).phone, profile.phone)).toBe(profile.phone);
});
