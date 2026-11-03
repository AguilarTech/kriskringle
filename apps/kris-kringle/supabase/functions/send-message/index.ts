// POST /functions/v1/send-message   body: { direction, raw_text }   members only
// Contract: docs/contracts/functions.md

import { handler, json, readJson } from "../_shared/http.ts";
import { notifyPush } from "../_shared/push.ts";
import { currentPhase, requireMember, serviceClient } from "../_shared/supabase.ts";
import { type SendDeps, sendMessage } from "./flow.ts";
import { reword } from "./reword.ts";

Deno.serve(handler(async (req) => {
  const db = serviceClient();
  const caller = await requireMember(req, db);
  const input = await readJson<{ direction?: unknown; raw_text?: unknown }>(req);

  const deps: SendDeps = {
    phase: () => currentPhase(db),
    quotaUsed: async (direction, weekStart) => {
      const { data, error } = await db.rpc("quota_used", {
        p_member_id: caller.userId,
        p_direction: direction,
        p_week_start: weekStart,
      });
      if (error) throw new Error("quota_used failed");
      return data === true;
    },
    reword,
    insertMessage: async (direction, body, weekStart) => {
      const { data, error } = await db.rpc("insert_message", {
        p_member_id: caller.userId,
        p_direction: direction,
        p_body: body,
        p_week_start: weekStart,
      });
      if (error?.code === "23505") return "quota_used";
      if (error?.message.includes("nothing to reply to")) return "nothing_to_reply_to";
      if (error) throw new Error("insert_message failed");
      return data as string;
    },
    notify: (messageId, direction) => notifyPush({ message_id: messageId, direction }),
  };

  return json(await sendMessage(deps, input));
}));
