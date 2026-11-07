// The Kris Kringle draw: pairs every Santa with a recipient, then gives each
// recipient a flavour. Pure logic, no I/O, so it is fully unit-testable.
//
// Method (tech spec §6.1):
//   allowed[s] is a bitmask of the recipients Santa s may buy for: everyone except
//   themselves and anyone they excluded. A valid draw is a perfect matching in
//   that bipartite graph.
//
//   1. Is a draw possible? A maximum matching (augmenting paths) answers that
//      exactly. If not, Hall's theorem gives the group of members that clashes.
//
//   2. Sampling, exactly uniform. Santas go in a fixed order, most constrained
//      first. Santa i draws a ticket in [0, U_i), where U_i = min(|allowed[i]|,
//      n - i) is a fixed upper bound on how many recipients can still be open to
//      them. If the ticket is below the number actually open, it picks that
//      recipient; otherwise the attempt is thrown away and starts again. Every
//      complete draw comes out with probability 1/U_0 * 1/U_1 * ..., the same for
//      every valid draw, so every valid draw is exactly equally likely.
//
//   With no exclusions about 38% of attempts succeed, and a family web (a few
//   exclusions each) needs at most thousands of attempts, microseconds each. Only
//   a web where many people exclude most of the group could run out of attempts;
//   that is reported as "too_tight" so the organiser can loosen it.

import { cryptoRandomInt, type RandomInt, shuffled } from "./random.ts";

export const MIN_MEMBERS = 2;
export const MAX_MEMBERS = 25; // there are 25 flavours
const MAX_ATTEMPTS = 2_000_000;

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
  }
  | {
    /** A draw exists, but so few that the fair random pick ran out of attempts. */
    kind: "too_tight";
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

const bitIndex = (bit: number) => 31 - Math.clz32(bit);

/** The same graph seen from the other side: out[r] = everyone with r as a neighbour. */
function transpose(n: number, neighbours: readonly number[]): number[] {
  const out = new Array<number>(n).fill(0);
  for (let s = 0; s < n; s++) {
    for (let r = 0; r < n; r++) if (neighbours[s] & (1 << r)) out[r] |= 1 << s;
  }
  return out;
}

function reachOf(n: number, neighbours: readonly number[], group: number): number {
  let reach = 0;
  for (let i = 0; i < n; i++) if (group & (1 << i)) reach |= neighbours[i];
  return reach;
}

/**
 * Maximum matching by augmenting paths. Returns null if every left vertex can be
 * matched, otherwise a Hall violation: a group of left vertices whose combined
 * neighbours (reach) are fewer than the group.
 */
function hallViolation(
  n: number,
  neighbours: readonly number[],
): { group: number; reach: number } | null {
  const matchOf = new Array<number>(n).fill(-1); // matchOf[right] = left
  let seen = 0;
  const augment = (left: number): boolean => {
    let options = neighbours[left] & ~seen;
    while (options) {
      const bit = options & -options;
      options ^= bit;
      seen |= bit;
      const right = bitIndex(bit);
      if (matchOf[right] === -1 || augment(matchOf[right])) {
        matchOf[right] = left;
        return true;
      }
    }
    return false;
  };

  for (let left = 0; left < n; left++) {
    seen = 0;
    if (augment(left)) continue;
    // König: everyone reachable from this unmatched vertex along alternating paths
    // forms a group with exactly one fewer neighbour than members.
    let group = 1 << left;
    let reach = 0;
    const queue = [left];
    while (queue.length) {
      let options = neighbours[queue.pop()!] & ~reach;
      reach |= options;
      while (options) {
        const bit = options & -options;
        options ^= bit;
        const next = matchOf[bitIndex(bit)];
        if (!(group & (1 << next))) {
          group |= 1 << next;
          queue.push(next);
        }
      }
    }
    // Drop members while the group still clashes, so the organiser sees a small one.
    for (let changed = true; changed;) {
      changed = false;
      for (let i = 0; i < n; i++) {
        const smaller = group & ~(1 << i);
        if (
          smaller !== group && smaller &&
          popcount(reachOf(n, neighbours, smaller)) < popcount(smaller)
        ) {
          group = smaller;
          changed = true;
        }
      }
    }
    return { group, reach: reachOf(n, neighbours, group) };
  }
  return null;
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
  const conflict = findConflict(members, graph);
  if (conflict) return { ok: false, conflict };

  // Fixed order, most constrained Santa first; bound[i] = min(choices, n - i).
  const choices = graph.allowed.map(popcount);
  const order = [...Array(n).keys()].sort((a, b) => choices[a] - choices[b] || a - b);
  const bound = order.map((s, i) => Math.min(choices[s], n - i));
  const recipientOf = new Array<number>(n);

  attempts: for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let open = (1 << n) - 1;
    for (let i = 0; i < n; i++) {
      const santa = order[i];
      let options = graph.allowed[santa] & open;
      let ticket = randomInt(bound[i]);
      if (ticket >= popcount(options)) continue attempts;
      while (ticket--) options &= options - 1; // skip `ticket` open recipients
      const chosen = options & -options;
      recipientOf[santa] = bitIndex(chosen);
      open ^= chosen;
    }
    return {
      ok: true,
      pairs: members.map((m, s) => ({ santaId: m.id, recipientId: members[recipientOf[s]].id })),
    };
  }
  return { ok: false, conflict: { kind: "too_tight" } };
}

/**
 * Explains an impossible draw using Hall's theorem: a draw exists exactly when every
 * group of Santas may, between them, buy for at least as many people as are in the
 * group (and the same from the recipients' side). Returns the smaller clashing group
 * from either side, which is what the organiser has to fix, or null if a draw exists.
 */
function findConflict(members: readonly DrawMember[], { n, allowed }: Graph): DrawConflict | null {
  const santaSide = hallViolation(n, allowed);
  if (!santaSide) return null;
  const recipientSide = hallViolation(n, transpose(n, allowed));

  const names = (mask: number) => members.filter((_, i) => mask & (1 << i)).map((m) => m.name);
  if (!recipientSide || popcount(santaSide.group) <= popcount(recipientSide.group)) {
    return {
      kind: "santas",
      santas: names(santaSide.group),
      canOnlyBuyFor: names(santaSide.reach),
    };
  }
  return {
    kind: "recipients",
    recipients: names(recipientSide.group),
    canOnlyBeBoughtForBy: names(recipientSide.reach),
  };
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
