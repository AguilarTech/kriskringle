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

/** Counts valid draws by trying every permutation. Tests only, small groups. */
export function countValidDraws(members: DrawMember[], exclusions: Exclusion[]): number {
  const banned = new Set(exclusions.map((e) => `${e.santaId}>${e.excludedId}`));
  const used = new Set<string>();
  const count = (i: number): number => {
    if (i === members.length) return 1;
    let total = 0;
    for (const r of members) {
      if (used.has(r.id) || r.id === members[i].id || banned.has(`${members[i].id}>${r.id}`)) {
        continue;
      }
      used.add(r.id);
      total += count(i + 1);
      used.delete(r.id);
    }
    return total;
  };
  return count(0);
}
