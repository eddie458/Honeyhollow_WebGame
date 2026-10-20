// Breadth-first path finding on walkable tiles (roads + sidewalks) for
// walkers, and on road pieces for vehicles. Results are cached until the
// road network changes.
import { content } from '../sim/content';
import { mod, tileKey, type WorldIndex } from '../sim/world';

export type Tile = [number, number];

const DIRS: Tile[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class PathFinder {
  private cache = new Map<string, Tile[] | null>();

  constructor(private index: WorldIndex) {}

  reset(index: WorldIndex): void {
    this.index = index;
    this.cache.clear();
  }

  /** Shortest walkable path between two walkable tiles (inclusive). */
  walk(from: Tile, to: Tile, maxNodes = 6000): Tile[] | null {
    const key = `w${from[0]},${from[1]}>${to[0]},${to[1]}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const res = bfs(from, to, (x, y) => this.index.isWalkable(x, y), maxNodes);
    if (this.cache.size > 2000) this.cache.clear();
    this.cache.set(key, res);
    return res;
  }

  /** Path between road pieces (3x3 snapped), returned as piece origins. */
  drive(from: Tile, to: Tile, maxNodes = 3000): Tile[] | null {
    const s = content().balance.world.roadSnap;
    const key = `d${from[0]},${from[1]}>${to[0]},${to[1]}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const pieceOk = (x: number, y: number) => this.index.isRoad(x, y);
    const res = bfs(from, to, pieceOk, maxNodes, s);
    this.cache.set(key, res);
    return res;
  }
}

function bfs(from: Tile, to: Tile, ok: (x: number, y: number) => boolean, maxNodes: number, step = 1): Tile[] | null {
  if (!ok(from[0], from[1]) || !ok(to[0], to[1])) return null;
  const prev = new Map<number, number>();
  const startK = tileKey(from[0], from[1]);
  const goalK = tileKey(to[0], to[1]);
  prev.set(startK, -1);
  const queue: Tile[] = [from];
  let head = 0;
  while (head < queue.length && prev.size < maxNodes) {
    const [x, y] = queue[head++]!;
    if (x === to[0] && y === to[1]) break;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx * step;
      const ny = y + dy * step;
      const k = tileKey(nx, ny);
      if (prev.has(k) || !ok(nx, ny)) continue;
      prev.set(k, tileKey(x, y));
      queue.push([nx, ny]);
    }
  }
  if (!prev.has(goalK)) return null;
  const out: Tile[] = [];
  let k = goalK;
  while (k !== -1) {
    const y = (k % 4096) - 2048;
    const x = Math.floor(k / 4096) - 2048;
    out.push([x, y]);
    k = prev.get(k)!;
  }
  return out.reverse();
}

/** Snaps a tile to the road piece containing it. */
export function pieceOf(x: number, y: number): Tile {
  const s = content().balance.world.roadSnap;
  return [x - mod(x, s), y - mod(y, s)];
}
