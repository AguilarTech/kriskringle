// Chat weeks start Monday 00:00 Melbourne time (AEST/AEDT). The week_start stored
// with each message is that Monday's date, "YYYY-MM-DD".

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const melbourneParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Australia/Melbourne",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

export function melbourneWeekStart(now: Date = new Date()): string {
  const parts = Object.fromEntries(
    melbourneParts.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const daysSinceMonday = WEEKDAYS.indexOf(parts.weekday);
  if (daysSinceMonday < 0) throw new Error("unexpected weekday from Intl");

  // Work on the Melbourne calendar date, so DST changes can't shift the result
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}
