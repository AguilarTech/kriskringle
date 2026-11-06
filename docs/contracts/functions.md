# Edge functions contract

Owner: Rothbard. Source: tech spec §6. Call from the client with `supabase.functions.invoke(name, { body })`, which sends the user's session token.

All functions take `POST` with a JSON body and return JSON. Errors are `{ "error": "<fixed message>" }`, sometimes with `details`. Errors never echo the request.

## `run-draw` (the organiser only): written, tested against G4

Called by the organiser, not by the app: `curl` with the service-role key (see `docs/runbook.md`), or an admin member's session token.

| Body | Result |
| :--- | :--- |
| `{ "dry_run": true }` | `200 { "solvable": true, "members": 12, "names": ["…"] }`. Writes nothing. `names` lets the organiser check everyone has signed up. |
| `{}` | `200 { "ok": true, "members": 12 }`. The draw is saved and phase is `drawn`, then a push broadcast goes to everyone. |

| Status | When |
| :--- | :--- |
| 401 / 403 | No valid key or session / not an admin |
| 409 | Phase isn't `setup` (the draw already happened) |
| 422 | No valid draw. `details` is the clash, e.g. `{ "kind": "santas", "santas": ["Carlos", "Maria"], "canOnlyBuyFor": ["Sofia"] }` or `{ "kind": "recipients", "recipients": ["Diego"], "canOnlyBeBoughtForBy": [] }`, or `{ "kind": "member_count", … }` for fewer than 2 or more than 13 members |

**Needs from Mises (G4):** tables `members`, `exclusions (member_id, excluded_id)`, `flavours (id)`, `app_state (phase)`, and the RPC `commit_draw(p_pairs jsonb)` from tech spec §5.7. Each pair is `{ "santa_id", "recipient_id", "flavour_id" }`. It raises an error containing `phase is not setup` when the draw already happened; `run-draw` turns that into 409.

`exclusions.excluded_id` refers to a roster name (`roster.id`). The draw adapter
resolves that name through `roster.claimed_by` to the current member ID. Choices
made before someone signs up therefore apply when they claim the name. Unclaimed
names do not participate in the draw.

## `send-message` (members): written, tested end to end with live rewording (R4)

Body `{ "direction": "to_flavour" | "to_santa", "raw_text": "…" }` (max 1,000 characters).

| Status | Body | Client shows |
| :--- | :--- | :--- |
| 200 | `{ "id", "body" }` where `body` is the reworded text that was saved | The sent bubble, with the reworded text |
| 400 | Empty or too long | Inline validation |
| 409 | Chat isn't open (phase isn't `drawn`) | Read-only notice |
| 409 | `to_santa` only: the Santa hasn't written last, so there is nothing to reply to (recipients can't start the chat) | "You can reply once your Santa sends you a message." |
| 429 | This week's message in this direction is already used | The quota chip: "Weekly message sent! Resets Monday" |
| 502 | Rewording failed. Nothing saved, quota not used | "Couldn't send. Please try again." Keep the typed text in the box |

## `push-notify` (service role only): written

Not called by the app. `run-draw` and `send-message` call it.

| Body | Sends to |
| :--- | :--- |
| `{ "broadcast": true, "title", "body" }` | Every row in `push_subs` |
| `{ "message_id", "direction" }` | Whoever receives that message, via `push_targets_for_message()`. Fixed text: "Your Secret Santa sent you a message." (to a recipient) or "Your flavour replied." (to a Santa) |

Returns `200 { "sent", "removed" }`. Subscriptions that return 404 or 410 are deleted.

**Push payload** (for Hayek's service worker): JSON `{ "title", "body", "url" }`. `url` is `/`, `/chats/santa` or `/chats/flavour`. Open it on notification click.

**For Hayek:** subscribe with the VAPID public key below (as `applicationServerKey`), then upsert `{ member_id, endpoint, p256dh, auth }` into `push_subs` (Mises adds that table in M2.2):

```
VITE_VAPID_PUBLIC_KEY=BN-em1JLzldLQGmHE0wdl5KWzZxDu-6EMatfFt6pJOBx-ZsOl3HYhNuFPwnURBZq5c7c1fDoYUVZQCBj2M-xtXo
```

**Needs from Mises (G6):** table `push_subs (member_id, endpoint, p256dh, auth)` and the RPC `push_targets_for_message(p_message_id uuid)`.

## Secrets

Local: `supabase/functions/.env` (gitignored) holds `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `ANTHROPIC_API_KEY`. Production: the organiser runs `npx supabase secrets set --env-file supabase/functions/.env`. `VAPID_SUBJECT` is a placeholder (`mailto:admin@example.com`); the organiser can change it to his own contact address.
