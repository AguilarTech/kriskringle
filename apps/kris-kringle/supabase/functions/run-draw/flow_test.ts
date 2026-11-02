import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { DrawMember, Exclusion, FlavouredPair } from "../_shared/draw.ts";
import { HttpError } from "../_shared/http.ts";
import { seededRandomInt } from "../_shared/random.ts";
import type { Phase } from "../_shared/supabase.ts";
import { assertValidDraw } from "../_shared/test_helpers.ts";
import { type DrawStore, runDraw } from "./flow.ts";

const FLAVOURS = ["hibiscus", "chocolate", "mango", "lemon", "lime", "orange", "raspberry"];

function fakeStore(members: DrawMember[], exclusions: Exclusion[] = [], phase: Phase = "setup") {
  const committed: FlavouredPair[][] = [];
  const store: DrawStore = {
    phase: () => Promise.resolve(phase),
    members: () => Promise.resolve(members),
    exclusions: () => Promise.resolve(exclusions),
    flavourIds: () => Promise.resolve(FLAVOURS),
    commitDraw: (pairs) => {
      committed.push(pairs);
      return Promise.resolve();
    },
  };
  return { store, committed };
}

const family: DrawMember[] = ["Ana", "Ben", "Cara", "Dan", "Eve"].map((n) => ({ id: n, name: n }));

Deno.test("commits a valid draw with distinct flavours", async () => {
  const exclusions = [{ santaId: "Ana", excludedId: "Ben" }];
  const { store, committed } = fakeStore(family, exclusions);
  const result = await runDraw(store, { dryRun: false }, seededRandomInt(1));
  assertEquals(result, { ok: true, members: 5 });
  assertEquals(committed.length, 1);
  assertValidDraw(family, exclusions, committed[0]);
  assertEquals(new Set(committed[0].map((p) => p.flavourId)).size, 5);
});

Deno.test("dry run reports names and writes nothing", async () => {
  const { store, committed } = fakeStore(family);
  const result = await runDraw(store, { dryRun: true });
  assertEquals(result, { solvable: true, members: 5, names: ["Ana", "Ben", "Cara", "Dan", "Eve"] });
  assertEquals(committed.length, 0);
});

Deno.test("refuses once the draw has happened (409)", async () => {
  const { store, committed } = fakeStore(family, [], "drawn");
  const err = await assertRejects(() => runDraw(store, { dryRun: false }), HttpError);
  assertEquals(err.status, 409);
  assertEquals(committed.length, 0);
});

Deno.test("impossible draw returns 422 with the clash and writes nothing", async () => {
  const exclusions = ["Ben", "Cara", "Dan", "Eve"].map((e) => ({ santaId: "Ana", excludedId: e }));
  const { store, committed } = fakeStore(family, exclusions);
  const err = await assertRejects(() => runDraw(store, { dryRun: false }), HttpError);
  assertEquals(err.status, 422);
  assertEquals(err.details, { kind: "santas", santas: ["Ana"], canOnlyBuyFor: [] });
  assertEquals(committed.length, 0);
});

Deno.test("dry run also reports an impossible draw", async () => {
  const exclusions = ["Ben", "Cara", "Dan", "Eve"].map((e) => ({ santaId: "Ana", excludedId: e }));
  const { store } = fakeStore(family, exclusions);
  const err = await assertRejects(() => runDraw(store, { dryRun: true }), HttpError);
  assert(err.status === 422);
});
