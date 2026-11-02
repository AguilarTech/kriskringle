// Shared assertions for draw tests.
import { assert, assertEquals } from "jsr:@std/assert@1";
import type { DrawMember, Exclusion, Pair } from "./draw.ts";

/** Fails unless pairs form a valid draw: everyone once each way, no self, no exclusion. */
export function assertValidDraw(members: DrawMember[], exclusions: Exclusion[], pairs: Pair[]) {
  const ids = members.map((m) => m.id).sort();
  assertEquals(pairs.map((p) => p.santaId).sort(), ids, "every member is a Santa exactly once");
  assertEquals(
    pairs.map((p) => p.recipientId).sort(),
    ids,
    "every member is a recipient exactly once",
  );
  const banned = new Set(exclusions.map((e) => `${e.santaId}>${e.excludedId}`));
  for (const p of pairs) {
    assert(p.santaId !== p.recipientId, "self-match");
    assert(!banned.has(`${p.santaId}>${p.recipientId}`), "excluded pair");
  }
}
