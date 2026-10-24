import { expect, test } from "vitest";
import { accountAvatarUrl } from "./account-avatar";

test.each(["https://lh3.googleusercontent.com/a/photo=s96-c", "https://res.cloudinary.com/neffi/image/upload/photo.png"])("accepts stored avatar %s", url => {
  expect(accountAvatarUrl(url)).toBe(url);
});

test.each([null, undefined, "", "not a url", "http://lh3.googleusercontent.com/photo", "https://lh3.googleusercontent.com.evil.test/photo", "https://example.test/photo", "https://lh3.googleusercontent.com:444/photo", "https://user:pass@lh3.googleusercontent.com/photo", "data:image/png,abc"])("rejects unusable avatar %s", url => {
  expect(accountAvatarUrl(url)).toBeNull();
});
