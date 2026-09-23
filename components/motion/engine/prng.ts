/**
 * Seeded pseudo-random generator (mulberry32). Decorative only: never used for
 * anything security related. The same seed always yields the same sequence, so
 * every particle keeps the same identity (and shape) on every render.
 */
export function createPrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEEDS_PER_PARTICLE = 4;
export const DEFAULT_PARTICLE_SEED = 20260923;

/**
 * Four uniform seeds in [0, 1) per particle, laid out contiguously. Seeds of
 * particle i never depend on the total count: growing the buffer keeps the
 * identity of existing particles.
 */
export function createSeeds(capacity: number, seed = DEFAULT_PARTICLE_SEED): Float32Array {
  const random = createPrng(seed);
  const seeds = new Float32Array(capacity * SEEDS_PER_PARTICLE);
  for (let i = 0; i < seeds.length; i++) seeds[i] = random();
  return seeds;
}
