import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { HttpError } from "../_shared/http.ts";
import type { Phase } from "../_shared/supabase.ts";
import { type Direction, type SendDeps, sendMessage } from "./flow.ts";

const MONDAY_7_DEC = new Date("2026-12-06T13:00:00Z"); // Mon 7 Dec 00:00 Melbourne

function fake(
  opts: {
    phase?: Phase;
    quotaUsed?: boolean;
    rewordFails?: boolean;
    clash?: boolean;
    noReply?: boolean;
  } = {},
) {
  const inserted: { direction: Direction; body: string; weekStart: string }[] = [];
  const notified: string[] = [];
  const deps: SendDeps = {
    phase: () => Promise.resolve(opts.phase ?? "drawn"),
    quotaUsed: () => Promise.resolve(opts.quotaUsed ?? false),
    reword: (raw) =>
      opts.rewordFails ? Promise.reject(new Error("down")) : Promise.resolve(`reworded: ${raw}`),
    insertMessage: (direction, body, weekStart) => {
      if (opts.clash) return Promise.resolve("quota_used");
      if (opts.noReply) return Promise.resolve("nothing_to_reply_to");
      inserted.push({ direction, body, weekStart });
      return Promise.resolve("msg-1");
    },
    notify: (id) => {
      notified.push(id);
      return Promise.resolve();
    },
  };
  return { deps, inserted, notified };
}

async function status(p: Promise<unknown>): Promise<number> {
  const err = await assertRejects(() => p, HttpError);
  return err.status;
}

Deno.test("saves only the reworded text, with the Melbourne week, then notifies", async () => {
  const { deps, inserted, notified } = fake();
  const out = await sendMessage(
    deps,
    { direction: "to_santa", raw_text: "  hi santa  " },
    MONDAY_7_DEC,
  );
  assertEquals(out, { id: "msg-1", body: "reworded: hi santa" });
  assertEquals(inserted, [{
    direction: "to_santa",
    body: "reworded: hi santa",
    weekStart: "2026-12-07",
  }]);
  assertEquals(notified, ["msg-1"]);
});

Deno.test("rewording failure: 502, nothing saved, no push", async () => {
  const { deps, inserted, notified } = fake({ rewordFails: true });
  assertEquals(
    await status(sendMessage(deps, { direction: "to_flavour", raw_text: "hello" })),
    502,
  );
  assertEquals(inserted.length, 0);
  assertEquals(notified.length, 0);
});

Deno.test("weekly quota already used: 429 before calling Claude", async () => {
  const { deps } = fake({ quotaUsed: true });
  let rewordCalled = false;
  deps.reword = () => {
    rewordCalled = true;
    return Promise.resolve("x");
  };
  assertEquals(
    await status(sendMessage(deps, { direction: "to_flavour", raw_text: "hello" })),
    429,
  );
  assertEquals(rewordCalled, false);
});

Deno.test("double-submit race (unique index clash): 429", async () => {
  const { deps, notified } = fake({ clash: true });
  assertEquals(
    await status(sendMessage(deps, { direction: "to_flavour", raw_text: "hello" })),
    429,
  );
  assertEquals(notified.length, 0);
});

Deno.test("chat closed outside the drawn phase: 409", async () => {
  for (const phase of ["setup", "closed"] as const) {
    const { deps } = fake({ phase });
    assertEquals(
      await status(sendMessage(deps, { direction: "to_flavour", raw_text: "hello" })),
      409,
    );
  }
});

Deno.test("bad input: 400", async () => {
  const { deps } = fake();
  assertEquals(await status(sendMessage(deps, { direction: "sideways", raw_text: "hi" })), 400);
  assertEquals(await status(sendMessage(deps, { direction: "to_santa", raw_text: "   " })), 400);
  assertEquals(await status(sendMessage(deps, { direction: "to_santa", raw_text: 42 })), 400);
  assertEquals(
    await status(sendMessage(deps, { direction: "to_santa", raw_text: "x".repeat(1001) })),
    400,
  );
});

Deno.test("to_santa with no Santa message to reply to: 409, no push", async () => {
  const { deps, notified } = fake({ noReply: true });
  assertEquals(
    await status(sendMessage(deps, { direction: "to_santa", raw_text: "hello" })),
    409,
  );
  assertEquals(notified.length, 0);
});
