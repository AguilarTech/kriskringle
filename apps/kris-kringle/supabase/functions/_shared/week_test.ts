import { assertEquals } from "jsr:@std/assert@1";
import { melbourneWeekStart } from "./week.ts";

// Each case: a UTC instant, what it is in Melbourne, and the expected Monday.
const cases: [string, string, string][] = [
  // Chat weeks around the game
  ["2026-12-06T12:59:59Z", "Sun 6 Dec 23:59:59 AEDT", "2026-11-30"],
  ["2026-12-06T13:00:00Z", "Mon 7 Dec 00:00 AEDT (chat week 1)", "2026-12-07"],
  ["2026-12-13T13:00:00Z", "Mon 14 Dec 00:00 AEDT (chat week 2)", "2026-12-14"],
  ["2026-12-23T01:00:00Z", "Wed 23 Dec 12:00 AEDT", "2026-12-21"],
  // A Melbourne Monday that is still Sunday in UTC
  ["2026-12-20T14:30:00Z", "Mon 21 Dec 01:30 AEDT", "2026-12-21"],
  // Year boundary
  ["2026-12-31T05:00:00Z", "Thu 31 Dec 16:00 AEDT", "2026-12-28"],
  ["2027-01-02T05:00:00Z", "Sat 2 Jan 16:00 AEDT", "2026-12-28"],
  ["2027-01-03T13:00:00Z", "Mon 4 Jan 00:00 AEDT", "2027-01-04"],
  // DST starts Sun 4 Oct 2026, 02:00 AEST -> 03:00 AEDT
  ["2026-10-03T15:59:00Z", "Sun 4 Oct 01:59 AEST", "2026-09-28"],
  ["2026-10-03T16:00:00Z", "Sun 4 Oct 03:00 AEDT", "2026-09-28"],
  ["2026-10-04T12:59:59Z", "Sun 4 Oct 23:59:59 AEDT", "2026-09-28"],
  ["2026-10-04T13:00:00Z", "Mon 5 Oct 00:00 AEDT", "2026-10-05"],
  // DST ends Sun 5 Apr 2026, 03:00 AEDT -> 02:00 AEST
  ["2026-04-04T15:30:00Z", "Sun 5 Apr 02:30 AEDT (first pass)", "2026-03-30"],
  ["2026-04-04T16:30:00Z", "Sun 5 Apr 02:30 AEST (second pass)", "2026-03-30"],
  ["2026-04-05T13:59:59Z", "Sun 5 Apr 23:59:59 AEST", "2026-03-30"],
  ["2026-04-05T14:00:00Z", "Mon 6 Apr 00:00 AEST", "2026-04-06"],
];

for (const [utc, melbourne, expected] of cases) {
  Deno.test(`melbourneWeekStart: ${melbourne} -> ${expected}`, () => {
    assertEquals(melbourneWeekStart(new Date(utc)), expected);
  });
}
