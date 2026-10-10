import { randomCrockford } from "@/lib/crockford";

// 26 Crockford characters = 130 bits. The token is public, so unguessability only keeps cards from being enumerated.
export const generateCardToken = () => randomCrockford(26);

// `origin` is the validated CARD_URL_ORIGIN (no path); the written NFC value is exactly this string.
export const cardUrl = (origin: string, token: string) => `${origin}/c/${token}`;
