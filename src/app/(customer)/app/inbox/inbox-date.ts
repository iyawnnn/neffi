const timeZone = "Asia/Manila";
const day = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });

export function formatInboxDate(date: Date, now: Date): string {
  const dateKey = day.format(date);
  const today = day.format(now);
  if (dateKey === today) return time.format(date);
  if (dateKey === day.format(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", ...(dateKey.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) }).format(date);
}
