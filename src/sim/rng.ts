// Small seeded PRNG (mulberry32). The generator state lives in GameState.rng so
// simulation results are reproducible from a save + action list.

export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return [value, t];
}

/** Mutable RNG view over a state object with an `rng` field. */
export class Rng {
  constructor(private holder: { rng: number }) {}

  next(): number {
    const [v, s] = nextRandom(this.holder.rng);
    this.holder.rng = s;
    return v;
  }

  chance(p: number): boolean {
    return p > 0 && this.next() < p;
  }

  int(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)] as T;
  }

  weighted<T extends { w: number }>(list: readonly T[]): T {
    const total = list.reduce((s, x) => s + x.w, 0);
    let roll = this.next() * total;
    for (const x of list) {
      roll -= x.w;
      if (roll < 0) return x;
    }
    return list[list.length - 1] as T;
  }
}

/** Deterministic hash for visual variety (trees, grass) - not game logic. */
export function hash2(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
