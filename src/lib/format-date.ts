// Absolute dates only: rendering must not read the clock (M5 lesson; cacheComponents).
const formatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
export const formatDateTime = (date: Date) => formatter.format(date);
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "Asia/Manila" });
export const formatDate = (date: Date) => dateFormatter.format(date);
