// run-draw logic, separated from Supabase so it can be tested with a fake store.
// Tech spec §6.1. The assignment itself is never logged or returned.

import {
  assignFlavours,
  type DrawMember,
  type Exclusion,
  type FlavouredPair,
  solveDraw,
} from "../_shared/draw.ts";
import { HttpError } from "../_shared/http.ts";
import { cryptoRandomInt, type RandomInt } from "../_shared/random.ts";
import type { Phase } from "../_shared/supabase.ts";

export interface DrawStore {
  phase(): Promise<Phase>;
  members(): Promise<DrawMember[]>;
  exclusions(): Promise<Exclusion[]>;
  flavourIds(): Promise<string[]>;
  /** Calls the commit_draw() RPC: re-validates, encrypts, writes, sets phase to drawn. */
  commitDraw(pairs: FlavouredPair[]): Promise<void>;
}

export type DrawResult =
  | { solvable: true; members: number; names: string[] } // dry run
  | { ok: true; members: number }; // committed

export async function runDraw(
  store: DrawStore,
  { dryRun }: { dryRun: boolean },
  randomInt: RandomInt = cryptoRandomInt,
): Promise<DrawResult> {
  if ((await store.phase()) !== "setup") {
    throw new HttpError(409, "The draw has already happened");
  }

  const [members, exclusions] = await Promise.all([store.members(), store.exclusions()]);
  const solved = solveDraw(members, exclusions, randomInt);
  if (!solved.ok) {
    const message = solved.conflict.kind === "member_count"
      ? "The draw needs between 2 and 18 members"
      : "No valid draw with the current exclusions";
    throw new HttpError(422, message, solved.conflict);
  }

  if (dryRun) {
    // Names let the organiser check everyone has signed up. Nothing about the pairs.
    return { solvable: true, members: members.length, names: members.map((m) => m.name) };
  }

  const pairs = assignFlavours(solved.pairs, await store.flavourIds(), randomInt);
  await store.commitDraw(pairs);
  return { ok: true, members: members.length };
}
