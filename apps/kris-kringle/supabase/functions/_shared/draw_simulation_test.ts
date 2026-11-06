// Roadmap Sprint 2 acceptance: 100 simulated draws with 10–13 members and dense
// exclusion webs, with 0 self-pairings and 0 exclusion violations.
//
// Each web is built around a hidden valid draw, so it is always solvable however
// dense it gets: every member excludes a random 50–90% of the people they could
// otherwise buy for, except their hidden recipient.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  assignFlavours,
  countValidDraws,
  type DrawMember,
  type Exclusion,
  solveDraw,
} from "./draw.ts";
import { seededRandomInt, shuffled } from "./random.ts";
import { assertValidDraw } from "./test_helpers.ts";

const FLAVOURS = [
  "hibiscus",
  "chocolate",
  "mango",
  "lemon",
  "lime",
  "orange",
  "raspberry",
  "strawberry",
  "watermelon",
  "mandarin",
  "blueberry",
  "mojito",
  "margarita",
  "kiwifruit",
  "horchata",
  "screwdriver",
  "kulfi",
  "melon",
];

const SEED = 20261205; // draw night
const RUNS = 100;

Deno.test(`simulation: ${RUNS} dense draws, 10–13 members (seed ${SEED})`, () => {
  const rand = seededRandomInt(SEED);
  let densest = 0;

  for (let run = 0; run < RUNS; run++) {
    const n = 10 + rand(4);
    const members: DrawMember[] = Array.from(
      { length: n },
      (_, i) => ({ id: `m${i}`, name: `Member ${i}` }),
    );

    // Hidden draw: one random cycle through everyone (a valid derangement)
    const order = shuffled(members, rand);
    const hidden = new Map(order.map((m, i) => [m.id, order[(i + 1) % n].id]));

    const density = 50 + rand(41); // percent
    const exclusions: Exclusion[] = [];
    for (const s of members) {
      for (const r of members) {
        if (s.id !== r.id && hidden.get(s.id) !== r.id && rand(100) < density) {
          exclusions.push({ santaId: s.id, excludedId: r.id });
        }
      }
    }
    densest = Math.max(densest, exclusions.length / (n * (n - 1)));

    assert(countValidDraws(members, exclusions) >= 1, `run ${run}: web must be solvable`);
    const result = solveDraw(members, exclusions, rand);
    assert(result.ok, `run ${run}: expected a valid draw`);
    assertValidDraw(members, exclusions, result.pairs);

    const flavoured = assignFlavours(result.pairs, FLAVOURS, rand);
    assertEquals(
      new Set(flavoured.map((p) => p.flavourId)).size,
      n,
      `run ${run}: distinct flavours`,
    );
  }

  assert(densest > 0.75, `webs should get dense; densest was ${(densest * 100).toFixed(0)}%`);
});
