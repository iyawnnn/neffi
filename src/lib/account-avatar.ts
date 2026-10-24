export const ACCOUNT_AVATAR_ORIGINS = [
  "https://res.cloudinary.com",
  "https://lh3.googleusercontent.com",
  "https://lh4.googleusercontent.com",
  "https://lh5.googleusercontent.com",
  "https://lh6.googleusercontent.com",
] as const;

export function accountAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return !url.username && !url.password && ACCOUNT_AVATAR_ORIGINS.some(origin => origin === url.origin) ? url.href : null;
  } catch {
    return null;
  }
}
