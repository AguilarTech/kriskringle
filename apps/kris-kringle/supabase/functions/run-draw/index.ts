// POST /functions/v1/run-draw   body: { "dry_run"?: boolean }
// Callable with the service-role key (the organiser, from a terminal) or an admin's session.
// Contract: docs/contracts/functions.md

import { handler, HttpError, json } from "../_shared/http.ts";
import { notifyPush } from "../_shared/push.ts";
import { currentPhase, isServiceRole, requireAdmin, serviceClient } from "../_shared/supabase.ts";
import { type DrawStore, runDraw } from "./flow.ts";

Deno.serve(handler(async (req) => {
  const db = serviceClient();
  if (!isServiceRole(req)) await requireAdmin(req, db);
  const body = await req.json().catch(() => ({})) as { dry_run?: boolean };

  const store: DrawStore = {
    phase: () => currentPhase(db),
    members: async () => {
      const { data, error } = await db.from("members").select("id, display_name");
      if (error) throw new Error("members lookup failed");
      return data.map((m) => ({ id: m.id, name: m.display_name }));
    },
    exclusions: async () => {
      const { data, error } = await db.from("exclusions").select("member_id, excluded_id");
      if (error) throw new Error("exclusions lookup failed");
      return data.map((e) => ({ santaId: e.member_id, excludedId: e.excluded_id }));
    },
    flavourIds: async () => {
      const { data, error } = await db.from("flavours").select("id");
      if (error) throw new Error("flavours lookup failed");
      return data.map((f) => f.id);
    },
    commitDraw: async (pairs) => {
      const { error } = await db.rpc("commit_draw", {
        p_pairs: pairs.map((p) => ({
          santa_id: p.santaId,
          recipient_id: p.recipientId,
          flavour_id: p.flavourId,
        })),
      });
      if (error?.message.includes("phase is not setup")) {
        throw new HttpError(409, "The draw has already happened");
      }
      if (error) throw new Error("commit_draw failed");
    },
  };

  const result = await runDraw(store, { dryRun: body.dry_run === true });

  if ("ok" in result) {
    await notifyPush({
      broadcast: true,
      title: "The draw is done!",
      body: "Open Kris Kringle to see your flavour.",
    });
  }
  return json(result);
}));
