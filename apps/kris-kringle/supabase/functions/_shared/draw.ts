// The Kris Kringle draw: pairs every Santa with a recipient, then gives each
// recipient a flavour. Pure logic, no I/O, so it is fully unit-testable.
//
// Method (tech spec §6.1):
//   allowed[s] is a bitmask of the recipients Santa s may buy for: everyone except
//   themselves and anyone they excluded. A valid draw is a perfect matching in
//   that bipartite graph.
//
//   ways[mask] = the number of ways to give Santas 0..k-1 (k = popcount(mask)) exactly
//   the recipients in mask. ways[full] is the total number of valid draws. Zero
//   means no valid draw exists: a definite answer, not a search timeout.
//
//   A draw is then sampled from Santa n-1 down to 0, choosing each recipient with
//   probability proportional to the number of ways to complete the rest. Every valid
//   draw is exactly equally likely, however dense the exclusions.
//
//   Cost: 2^n * n steps, about 100k for 13 members.

import { cryptoRandomInt, type RandomInt, shuffled } from "./random.ts";

export const MIN_MEMBERS = 2;
export const MAX_MEMBERS = 13; // there are 13 flavours

export interface DrawMember {
  id: string;
  name: string;
}

/** santaId may not buy for excludedId. */
export interface Exclusion {
  santaId: string;
  excludedId: string;
}

export interface Pair {
  santaId: string;
  recipientId: string;
}

export interface FlavouredPair extends Pair {
  /** The recipient's flavour (what the Santa shops for). */
  flavourId: string;
}

/** Why a draw is impossible. Names are display names, for the organiser to act on. */
export type DrawConflict =
  | { kind: "member_count"; members: number; min: number; max: number }
  | {
    /** These Santas between them may only buy for fewer people than there are Santas. */
    kind: "santas";
    santas: string[];
    canOnlyBuyFor: string[];
  }
  | {
    /** Fewer people may buy for these recipients than there are recipients. */
    kind: "recipients";
    recipients: string[];
    canOnlyBeBoughtForBy: string[];
  };

export type SolveResult =
  | { ok: true; pairs: Pair[] }
  | { ok: false; conflict: DrawConflict };

interface Graph {
  n: number;
  /** allowed[s]: bitmask of recipients Santa s may buy for. */
  allowed: number[];
}

function buildGraph(members: readonly DrawMember[], exclusions: readonly Exclusion[]): Graph {
  const n = members.length;
  const index = new Map<string, number>();
  members.forEach((m, i) => {
    if (index.has(m.id)) throw new Error("duplicate member id in draw input");
    index.set(m.id, i);
  });

  const full = (1 << n) - 1;
  const allowed = members.map((_, i) => full & ~(1 << i)); // nobody buys for themselves

  for (const e of exclusions) {
    const s = index.get(e.santaId);
    const r = index.get(e.excludedId);
    if (s === undefined || r === undefined) {
      throw new Error("exclusion refers to an unknown member");
    }
    allowed[s] &= ~(1 << r);
  }
  return { n, allowed };
}

function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

/** ways[mask] for every mask (see header comment). */
function countTable({ n, allowed }: Graph): Float64Array {
  const size = 1 << n;
  const ways = new Float64Array(size); // at most 13! ≈ 6.2e9, exact in a double
  ways[0] = 1;
  for (let mask = 1; mask < size; mask++) {
    const santa = popcount(mask) - 1;
    let options = mask & allowed[santa];
    let total = 0;
    while (options) {
      const bit = options & -options;
      total += ways[mask ^ bit];
      options ^= bit;
    }
    ways[mask] = total;
  }
  return ways;
}

/** Number of valid draws (0 means impossible). Exposed for tests and dry runs. */
export function countValidDraws(
  members: readonly DrawMember[],
  exclusions: readonly Exclusion[],
): number {
  if (members.length < MIN_MEMBERS || members.length > MAX_MEMBERS) return 0;
  const graph = buildGraph(members, exclusions);
  return countTable(graph)[(1 << graph.n) - 1];
}

/** Pairs every member as a Santa with a different recipient, uniformly at random among valid draws. */
export function solveDraw(
  members: readonly DrawMember[],
  exclusions: readonly Exclusion[],
  randomInt: RandomInt = cryptoRandomInt,
): SolveResult {
  const n = members.length;
  if (n < MIN_MEMBERS || n > MAX_MEMBERS) {
    return {
      ok: false,
      conflict: { kind: "member_count", members: n, min: MIN_MEMBERS, max: MAX_MEMBERS },
    };
  }

  const graph = buildGraph(members, exclusions);
  const ways = countTable(graph);
  let mask = (1 << n) - 1;
  if (ways[mask] === 0) {
    return { ok: false, conflict: findConflict(members, graph) };
  }

  const recipientOf = new Array<number>(n);
  for (let santa = n - 1; santa >= 0; santa--) {
    // ways[mask] = sum over allowed r in mask of ways[mask without r]; pick r by that weight.
    let ticket = randomInt(ways[mask]);
    let options = mask & graph.allowed[santa];
    let chosen = -1;
    while (options) {
      const bit = options & -options;
      const weight = ways[mask ^ bit];
      if (ticket < weight) {
        chosen = bit;
        break;
      }
      ticket -= weight;
      options ^= bit;
    }
    if (chosen === -1) throw new Error("draw sampling invariant broken");
    recipientOf[santa] = 31 - Math.clz32(chosen);
    mask ^= chosen;
  }

  return {
    ok: true,
    pairs: members.map((m, s) => ({ santaId: m.id, recipientId: members[recipientOf[s]].id })),
  };
}

/**
 * Explains an impossible draw using Hall's theorem: a draw exists exactly when every
 * group of Santas may, between them, buy for at least as many people as are in the
 * group (and the same from the recipients' side). Returns the smallest violating
 * group from either side, which is what the organiser has to fix.
 */
function findConflict(members: readonly DrawMember[], { n, allowed }: Graph): DrawConflict {
  const allowedBy = new Array<number>(n).fill(0); // allowedBy[r]: Santas who may buy for r
  for (let s = 0; s < n; s++) {
    for (let r = 0; r < n; r++) if (allowed[s] & (1 << r)) allowedBy[r] |= 1 << s;
  }

  const smallestViolation = (neighbours: number[]): { group: number; reach: number } | null => {
    let best: { group: number; reach: number } | null = null;
    let bestSize = Infinity;
    for (let group = 1; group < 1 << n; group++) {
      const size = popcount(group);
      if (size >= bestSize) continue;
      let reach = 0;
      for (let i = 0; i < n; i++) if (group & (1 << i)) reach |= neighbours[i];
      if (popcount(reach) < size) {
        best = { group, reach };
        bestSize = size;
      }
    }
    return best;
  };

  const names = (mask: number) => members.filter((_, i) => mask & (1 << i)).map((m) => m.name);

  const santaSide = smallestViolation(allowed);
  const recipientSide = smallestViolation(allowedBy);

  if (santaSide && (!recipientSide || popcount(santaSide.group) <= popcount(recipientSide.group))) {
    return {
      kind: "santas",
      santas: names(santaSide.group),
      canOnlyBuyFor: names(santaSide.reach),
    };
  }
  if (recipientSide) {
    return {
      kind: "recipients",
      recipients: names(recipientSide.group),
      canOnlyBeBoughtForBy: names(recipientSide.reach),
    };
  }
  // Unreachable: Hall's theorem guarantees a violation when no perfect matching exists.
  throw new Error("no valid draw but no Hall violation found");
}

/** Gives each recipient a distinct flavour, chosen at random from the available flavours. */
export function assignFlavours(
  pairs: readonly Pair[],
  flavourIds: readonly string[],
  randomInt: RandomInt = cryptoRandomInt,
): FlavouredPair[] {
  if (new Set(flavourIds).size !== flavourIds.length) throw new Error("duplicate flavour ids");
  if (flavourIds.length < pairs.length) throw new Error("not enough flavours for every recipient");
  const picked = shuffled(flavourIds, randomInt).slice(0, pairs.length);
  return pairs.map((p, i) => ({ ...p, flavourId: picked[i] }));
}
