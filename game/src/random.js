// A small seeded random source: one 32-bit state, a xorshift step, and the
// helpers the city builder and the world use. Same seed, same city, same
// traffic — so a screenshot staged with ?seed=1 always frames the same streets.

export function createRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;

  function next() {
    // xorshift32: three shifts, no multiply, full period for nonzero state.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  }

  return {
    /** A float in [0, 1). */
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max] (both ends included). */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of `items`, uniformly. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** True with probability `p`. */
    chance(p) {
      return next() < p;
    },
  };
}
