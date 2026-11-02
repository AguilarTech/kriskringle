// send-message logic, separated from Supabase and Claude so it can be tested.
// Tech spec §6.2. Order matters: quota check -> reword -> insert. A failed reword
// writes nothing, so the weekly quota is not used.

import { HttpError } from "../_shared/http.ts";
import type { Phase } from "../_shared/supabase.ts";
import { melbourneWeekStart } from "../_shared/week.ts";

export type Direction = "to_flavour" | "to_santa";
export const MAX_LENGTH = 1000;

export interface SendDeps {
  phase(): Promise<Phase>;
  quotaUsed(direction: Direction, weekStart: string): Promise<boolean>;
  /** Returns the reworded text, or throws. */
  reword(rawText: string): Promise<string>;
  /** Calls insert_message(). Returns the new id, or "quota_used" on a unique-index clash. */
  insertMessage(
    direction: Direction,
    body: string,
    weekStart: string,
  ): Promise<string | "quota_used">;
  notify(messageId: string, direction: Direction): Promise<void>;
}

const QUOTA_USED = "You've already sent this week's message. It resets on Monday.";

export async function sendMessage(
  deps: SendDeps,
  input: { direction?: unknown; raw_text?: unknown },
  now: Date = new Date(),
): Promise<{ id: string; body: string }> {
  const { direction, raw_text } = input;
  if (direction !== "to_flavour" && direction !== "to_santa") {
    throw new HttpError(400, "direction must be to_flavour or to_santa");
  }
  const text = typeof raw_text === "string" ? raw_text.trim() : "";
  if (!text) throw new HttpError(400, "Message is empty");
  if (text.length > MAX_LENGTH) {
    throw new HttpError(400, `Message is over ${MAX_LENGTH} characters`);
  }

  if ((await deps.phase()) !== "drawn") throw new HttpError(409, "Chat isn't open");

  const weekStart = melbourneWeekStart(now);
  if (await deps.quotaUsed(direction, weekStart)) throw new HttpError(429, QUOTA_USED);

  let body: string;
  try {
    body = await deps.reword(text);
  } catch {
    throw new HttpError(502, "Could not anonymize message. Please try again.");
  }

  const id = await deps.insertMessage(direction, body, weekStart);
  if (id === "quota_used") throw new HttpError(429, QUOTA_USED);

  await deps.notify(id, direction);
  return { id, body };
}
