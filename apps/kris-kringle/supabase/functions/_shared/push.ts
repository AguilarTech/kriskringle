// Calls the push-notify function from another edge function. A push failure never
// fails the caller: the draw or message has already been saved.

export type PushRequest =
  | { broadcast: true; title: string; body: string }
  | { message_id: string; direction: "to_flavour" | "to_santa" };

export async function notifyPush(request: PushRequest): Promise<void> {
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/push-notify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    if (!res.ok) console.error("push-notify returned", res.status);
  } catch (err) {
    console.error("push-notify unreachable:", err instanceof Error ? err.name : typeof err);
  }
}
