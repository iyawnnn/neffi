import type { OwnedProfile } from "@/modules/profiles/profiles";

export type DetailsProfile = Pick<OwnedProfile, "id" | "fullName" | "headline" | "company" | "bio" | "phone" | "email" | "website" | "location">;
export const detailKeys = ["fullName", "headline", "company", "bio", "phone", "email", "website", "location"] as const;
export type DetailKey = typeof detailKeys[number];
export type DetailValues = Record<DetailKey, string>;
export type DetailErrors = Partial<Record<DetailKey, string>>;

export function mobileNumber(raw: string): string | null {
  const compact = raw.replace(/[\s()-]/g, "");
  if (!compact) return "";
  const national = compact.replace(/^(?:\+63|63|0)/, "");
  return /^9\d{9}$/.test(national) ? `+63${national}` : null;
}

export function phoneInput(raw: string | null) {
  if (!raw) return "";
  const normalized = mobileNumber(raw);
  return normalized ? normalized.slice(3) : raw;
}

export function identityPhone(raw: string, original: string | null) {
  return raw === phoneInput(original) ? original ?? "" : mobileNumber(raw);
}

export function detailValues(profile: Pick<DetailsProfile, DetailKey>): DetailValues {
  return Object.fromEntries(detailKeys.map(key => [key, key === "phone" ? phoneInput(profile.phone) : profile[key] ?? ""])) as DetailValues;
}

export function detailsDirty(values: DetailValues, saved: DetailValues) {
  return detailKeys.some(key => values[key] !== saved[key]);
}

export const fieldMessages: Record<DetailKey, string> = {
  fullName: "Enter your full name (up to 80 characters).",
  headline: "Keep your headline to 80 characters or fewer.",
  company: "Keep your company name to 80 characters or fewer.",
  bio: "Keep your intro to 300 characters or fewer.",
  phone: "Enter a valid Philippine mobile number.",
  email: "Enter a valid email, such as name@example.com.",
  website: "Enter a valid website, such as example.com.",
  location: "Keep your general location to 80 characters or fewer.",
};

export const basicFields = [
  { key: "fullName", label: "Full name", placeholder: "e.g. Alex Reyes", max: 80, autoComplete: "name" },
  { key: "company", label: "Company", placeholder: "e.g. Northstar Studio", max: 80, autoComplete: "organization" },
  { key: "headline", label: "Headline", placeholder: "e.g. Web developer", max: 80, autoComplete: "organization-title" },
  { key: "bio", label: "Short intro", placeholder: "Tell visitors what you do and how you can help.", max: 300, autoComplete: "off" },
] as const;
