// POST /functions/v1/push-notify   service role only (called by run-draw and send-message)
// body: { broadcast: true, title, body } | { message_id, direction }
// Contract: docs/contracts/functions.md

import webpush from "npm:web-push@3.6.7";
import { handler, json, readJson } from "../_shared/http.ts";
import type { PushRequest } from "../_shared/push.ts";
import { requireServiceRole, serviceClient } from "../_shared/supabase.ts";
import { messagePayload, type PushPayload } from "./payload.ts";

interface Sub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(handler(async (req) => {
  requireServiceRole(req);
  const request = await readJson<PushRequest>(req);
  const db = serviceClient();

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")!,
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  let subs: Sub[];
  let payload: PushPayload;
  if ("broadcast" in request) {
    const { data, error } = await db.from("push_subs").select("endpoint, p256dh, auth");
    if (error) throw new Error("push_subs lookup failed");
    subs = data;
    payload = { title: request.title, body: request.body, url: "/" };
  } else {
    const { data, error } = await db.rpc("push_targets_for_message", {
      p_message_id: request.message_id,
    });
    if (error) throw new Error("push_targets_for_message failed");
    subs = data as Sub[];
    payload = messagePayload(request.direction);
  }

  let sent = 0;
  let removed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.from("push_subs").delete().eq("endpoint", s.endpoint);
        removed++;
      } else {
        console.error("push send failed with status", status);
      }
    }
  }));

  return json({ sent, removed });
}));
