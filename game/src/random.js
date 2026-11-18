// A small seeded random source (splitmix32): the same seed gives the same
// stream, which is what makes traffic, pedestrians and the screenshot scenes
// repeatable. Nothing here touches the browser or the game state.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function random() {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    z = (z ^ (z >>> 15)) >>> 0;
    return z / 4294967296;
  };
}

/** A random element of `list`. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** A random number from `min` (inclusive) to `max` (exclusive). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** A random whole number from `min` to `max` inclusive. */
export function int(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** A random angle in radians, 0 to a full turn. */
export function angle(random) {
  return random() * Math.PI * 2;
}
