// Randomness for the draw. Production uses the platform CSPRNG; tests inject a
// seeded generator so failures are reproducible.
//
// The draw picks among up to 18! ≈ 6.4e15 weighted options, so generators must
// support maxExclusive up to 2^53 (above 2^32).

/** Returns an integer in [0, maxExclusive). maxExclusive is an integer in 1..2^53. */
export type RandomInt = (maxExclusive: number) => number;

const TWO_32 = 2 ** 32;
const TWO_53 = 2 ** 53;

function checkMax(maxExclusive: number): void {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > TWO_53) {
    throw new RangeError("maxExclusive must be an integer in 1..2^53");
  }
}

/** Unbiased random integers from crypto.getRandomValues (rejection sampling). */
export const cryptoRandomInt: RandomInt = (maxExclusive) => {
  checkMax(maxExclusive);
  const buf = new Uint32Array(2);
  if (maxExclusive <= TWO_32) {
    const limit = TWO_32 - (TWO_32 % maxExclusive);
    while (true) {
      crypto.getRandomValues(buf);
      if (buf[0] < limit) return buf[0] % maxExclusive;
    }
  }
  // 53 random bits: 21 from one word, 32 from the other
  const limit = TWO_53 - (TWO_53 % maxExclusive);
  while (true) {
    crypto.getRandomValues(buf);
    const value = (buf[0] >>> 11) * TWO_32 + buf[1];
    if (value < limit) return value % maxExclusive;
  }
};

/** Deterministic generator for tests (mulberry32, 53-bit output). Not for production draws. */
export function seededRandomInt(seed: number): RandomInt {
  let state = seed >>> 0;
  const next32 = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return (maxExclusive) => {
    checkMax(maxExclusive);
    const unit = ((next32() >>> 11) * TWO_32 + next32()) / TWO_53;
    return Math.floor(unit * maxExclusive);
  };
}

/** Fisher–Yates shuffle into a new array. */
export function shuffled<T>(items: readonly T[], randomInt: RandomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
