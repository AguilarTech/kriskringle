import { assert, assertEquals } from "jsr:@std/assert@1";
import { messagePayload } from "./payload.ts";

const FLAVOUR_NAMES = [
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
];

Deno.test("message notifications never name a flavour", () => {
  for (const direction of ["to_flavour", "to_santa"] as const) {
    const text = JSON.stringify(messagePayload(direction)).toLowerCase();
    for (const f of FLAVOUR_NAMES) assert(!text.includes(f), `${direction} mentions ${f}`);
  }
});

Deno.test("each side gets the right wording", () => {
  assertEquals(messagePayload("to_flavour").body, "Your Secret Santa sent you a message.");
  assertEquals(messagePayload("to_santa").body, "Your flavour replied.");
});
