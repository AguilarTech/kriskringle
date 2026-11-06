import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  assignFlavours,
  countValidDraws,
  type DrawMember,
  type Exclusion,
  type Pair,
  solveDraw,
} from "./draw.ts";
import { cryptoRandomInt, seededRandomInt } from "./random.ts";
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

function people(...names: string[]): DrawMember[] {
  return names.map((name) => ({ id: name.toLowerCase(), name }));
}

function ex(santa: string, ...excluded: string[]): Exclusion[] {
  return excluded.map((e) => ({ santaId: santa.toLowerCase(), excludedId: e.toLowerCase() }));
}

// --- Member count limits -------------------------------------------------------

Deno.test("refuses fewer than 2 members", () => {
  const r = solveDraw(people("Solo"), []);
  assertEquals(r, { ok: false, conflict: { kind: "member_count", members: 1, min: 2, max: 18 } });
});

Deno.test("refuses more than 18 members (only 18 flavours)", () => {
  const many = people(..."ABCDEFGHIJKLMNOPQRS".split(""));
  const r = solveDraw(many, []);
  assert(!r.ok && r.conflict.kind === "member_count" && r.conflict.members === 19);
});

Deno.test("2 members swap", () => {
  const m = people("Ana", "Ben");
  const r = solveDraw(m, []);
  assert(r.ok);
  assertValidDraw(m, [], r.pairs);
});

Deno.test("18 members with no exclusions succeeds", () => {
  const m = people(..."ABCDEFGHIJKLMNOPQR".split(""));
  const r = solveDraw(m, [], seededRandomInt(1));
  assert(r.ok);
  assertValidDraw(m, [], r.pairs);
});

// --- Counting ---------------------------------------------------------------------

Deno.test("counts derangements exactly with no exclusions", () => {
  // !n: 1, 2, 9, 44, 265, ..., !18 = 2,355,301,661,033,953
  const expected = [
    1,
    2,
    9,
    44,
    265,
    1854,
    14833,
    133496,
    1334961,
    14684570,
    176214841,
    2290792932,
    32071101049,
    481066515734,
    7697064251745,
    130850092279664,
    2355301661033953,
  ];
  for (let n = 2; n <= 18; n++) {
    const m = people(..."ABCDEFGHIJKLMNOPQR".slice(0, n).split(""));
    assertEquals(countValidDraws(m, []), expected[n - 2], `!${n}`);
  }
});

Deno.test("exclusions reduce the count", () => {
  const m = people("A", "B", "C");
  // 3 people: only the two 3-cycles. A may not buy for B leaves A->C->B->A.
  assertEquals(countValidDraws(m, ex("A", "B")), 1);
  const r = solveDraw(m, ex("A", "B"));
  assert(r.ok);
  assertEquals(
    Object.fromEntries(r.pairs.map((p) => [p.santaId, p.recipientId])),
    { a: "c", c: "b", b: "a" },
  );
});

// --- Conflict diagnostics ---------------------------------------------------------

Deno.test("conflict: a Santa who excluded everyone", () => {
  const m = people("Carlos", "Maria", "Sofia", "Diego");
  const r = solveDraw(m, ex("Carlos", "Maria", "Sofia", "Diego"));
  assertEquals(r, {
    ok: false,
    conflict: { kind: "santas", santas: ["Carlos"], canOnlyBuyFor: [] },
  });
});

Deno.test("conflict: two Santas who can only buy for the same person", () => {
  const m = people("Carlos", "Maria", "Sofia", "Diego", "Elena");
  const exclusions = [
    ...ex("Carlos", "Maria", "Diego", "Elena"), // Carlos -> Sofia only
    ...ex("Maria", "Carlos", "Diego", "Elena"), // Maria -> Sofia only
  ];
  const r = solveDraw(m, exclusions);
  assertEquals(r, {
    ok: false,
    conflict: { kind: "santas", santas: ["Carlos", "Maria"], canOnlyBuyFor: ["Sofia"] },
  });
});

Deno.test("conflict: a recipient nobody may buy for", () => {
  const m = people("Carlos", "Maria", "Sofia", "Diego");
  const exclusions = [...ex("Maria", "Carlos"), ...ex("Sofia", "Carlos"), ...ex("Diego", "Carlos")];
  const r = solveDraw(m, exclusions);
  assertEquals(r, {
    ok: false,
    conflict: { kind: "recipients", recipients: ["Carlos"], canOnlyBeBoughtForBy: [] },
  });
});

Deno.test("conflict: circular exclusion cycle (roadmap deadlock test)", () => {
  // Two couples plus one single. Each couple excludes each other, and each person
  // also excludes everyone in the other couple. The couples can then only buy for
  // the single person: four Santas, one possible recipient.
  const m = people("Ana", "Ben", "Cara", "Dan", "Eve");
  const exclusions = [
    ...ex("Ana", "Ben", "Cara", "Dan"),
    ...ex("Ben", "Ana", "Cara", "Dan"),
    ...ex("Cara", "Dan", "Ana", "Ben"),
    ...ex("Dan", "Cara", "Ana", "Ben"),
  ];
  const r = solveDraw(m, exclusions);
  assert(!r.ok && r.conflict.kind === "santas");
  assertEquals(r.conflict.canOnlyBuyFor, ["Eve"]);
  assertEquals(r.conflict.santas.length, 2, "smallest group: any two of the four");
});

Deno.test("conflict is reported, not thrown, for every impossible case found by brute force", () => {
  // Small random webs: whenever the count is 0, solveDraw must return a conflict
  // whose group really is too small (Hall violation).
  const rand = seededRandomInt(42);
  let impossible = 0;
  for (let run = 0; run < 300; run++) {
    const n = 3 + rand(4);
    const m = people(..."ABCDEF".slice(0, n).split(""));
    const exclusions: Exclusion[] = [];
    for (const s of m) {
      for (const r of m) {
        if (s !== r && rand(100) < 45) exclusions.push({ santaId: s.id, excludedId: r.id });
      }
    }
    const result = solveDraw(m, exclusions, rand);
    if (countValidDraws(m, exclusions) === 0) {
      impossible++;
      assert(!result.ok);
      const c = result.conflict;
      if (c.kind === "santas") assert(c.canOnlyBuyFor.length < c.santas.length);
      else if (c.kind === "recipients") assert(c.canOnlyBeBoughtForBy.length < c.recipients.length);
      else throw new Error("unexpected conflict kind");
    } else {
      assert(result.ok);
      assertValidDraw(m, exclusions, result.pairs);
    }
  }
  assert(impossible > 20, `expected a good number of impossible webs, got ${impossible}`);
});

// --- Fairness ---------------------------------------------------------------------

Deno.test("every valid draw is equally likely (4 people, 9 derangements)", () => {
  const m = people("A", "B", "C", "D");
  const counts = new Map<string, number>();
  const samples = 18000;
  for (let i = 0; i < samples; i++) {
    const r = solveDraw(m, [], cryptoRandomInt);
    assert(r.ok);
    const key = r.pairs.map((p) => p.recipientId).join("");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assertEquals(counts.size, 9);
  // Expected 2000 each; standard deviation ≈ 42. Allow ±250 (≈6σ).
  for (const [key, c] of counts) assert(Math.abs(c - 2000) < 250, `${key} drawn ${c} times`);
});

Deno.test("equally likely with exclusions too (5 people)", () => {
  const m = people("A", "B", "C", "D", "E");
  const exclusions = [...ex("A", "B", "C"), ...ex("D", "E")];
  const total = countValidDraws(m, exclusions);
  const counts = new Map<string, number>();
  const samples = total * 1000;
  for (let i = 0; i < samples; i++) {
    const r = solveDraw(m, exclusions, cryptoRandomInt);
    assert(r.ok);
    const key = r.pairs.map((p) => p.recipientId).join("");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assertEquals(counts.size, total, "every valid draw appears");
  for (const [key, c] of counts) assert(Math.abs(c - 1000) < 200, `${key} drawn ${c} times`);
});

// --- Flavours ---------------------------------------------------------------------

Deno.test("assignFlavours gives each recipient a distinct flavour", () => {
  const m = people(..."ABCDEFGHIJ".split(""));
  const r = solveDraw(m, [], seededRandomInt(7));
  assert(r.ok);
  const out = assignFlavours(r.pairs, FLAVOURS, seededRandomInt(8));
  assertEquals(out.length, 10);
  assertEquals(new Set(out.map((p) => p.flavourId)).size, 10);
  for (const p of out) assert(FLAVOURS.includes(p.flavourId));
});

Deno.test("assignFlavours uses every flavour over many draws (random subset)", () => {
  const pairs: Pair[] = [{ santaId: "a", recipientId: "b" }, { santaId: "b", recipientId: "a" }];
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) {
    for (const p of assignFlavours(pairs, FLAVOURS)) seen.add(p.flavourId);
  }
  assertEquals(seen.size, 18);
});

Deno.test("assignFlavours rejects too few or duplicate flavours", () => {
  const pairs: Pair[] = [{ santaId: "a", recipientId: "b" }, { santaId: "b", recipientId: "a" }];
  assertThrows(() => assignFlavours(pairs, ["mango"]));
  assertThrows(() => assignFlavours(pairs, ["mango", "mango"]));
});

// --- Input validation -------------------------------------------------------------

Deno.test("rejects duplicate members and unknown exclusion ids", () => {
  assertThrows(() => solveDraw([{ id: "a", name: "A" }, { id: "a", name: "A2" }], []));
  assertThrows(() => solveDraw(people("A", "B"), [{ santaId: "a", excludedId: "zz" }]));
});
