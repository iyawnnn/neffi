import { randomInt } from "node:crypto";

// Crockford Base32: no I, L, O or U, so printed values survive being read aloud or typed from a card.
export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const randomCrockford = (length: number) => Array.from({ length }, () => CROCKFORD[randomInt(CROCKFORD.length)]).join("");
