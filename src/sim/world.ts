// Grid geometry: footprints, land ownership, tile occupancy and placement rules.
import { content, item, maybeItem } from './content';
import type { GameState, ItemDef, Rot, WorldObject } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const LOT = 12;

export function dims(def: ItemDef, rot: Rot): [number, number] {
  const [w, h] = def.size;
  return rot === 1 ? [h, w] : [w, h];
}

export function rectOf(o: WorldObject): Rect {
  const def = item(o.item);
  const [w, h] = dims(def, o.rot);
  return { x: o.x, y: o.y, w, h };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function expandRect(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

export function lotOf(x: number, y: number): [number, number] {
  return [Math.floor(x / LOT), Math.floor(y / LOT)];
}

export function lotKey(lx: number, ly: number): string {
  return `${lx},${ly}`;
}

export function parseLot(key: string): [number, number] {
  const [a, b] = key.split(',');
  return [Number(a), Number(b)];
}

export function isSeaLot(ly: number): boolean {
  return ly >= content().balance.world.seaFromLotY;
}

export function isRailTile(x: number): boolean {
  const w = content().balance.world;
  return x >= w.railX && x < w.railX + w.railWidth;
}

export function lotInBounds(lx: number, ly: number): boolean {
  const w = content().balance.world;
  return lx >= w.minLotX && lx <= w.maxLotX && ly >= w.minLotY && !isSeaLot(ly);
}

const OFF = 2048;
export function tileKey(x: number, y: number): number {
  return (x + OFF) * 4096 + (y + OFF);
}

/** Runtime spatial index rebuilt from the state (never saved). */
export class WorldIndex {
  readonly tiles = new Map<number, number>();
  readonly lots: Set<string>;
  readonly walkable = new Set<number>();
  readonly roads = new Set<number>();

  constructor(public state: GameState) {
    this.lots = new Set(state.lots);
    for (const key in state.objects) {
      const o = state.objects[key]!;
      this.add(o);
    }
  }

  /** Points the index at a newer copy of the same city (positions unchanged). */
  rebind(state: GameState): void {
    this.state = state;
  }

  add(o: WorldObject): void {
    const def = maybeItem(o.item);
    if (!def) return;
    const r = rectOf(o);
    const isRoad = def.kind === 'road';
    const walk = isRoad || def.kind === 'sidewalk';
    for (let i = 0; i < r.w; i++) {
      for (let j = 0; j < r.h; j++) {
        const k = tileKey(r.x + i, r.y + j);
        this.tiles.set(k, o.id);
        if (walk) this.walkable.add(k);
        if (isRoad) this.roads.add(k);
      }
    }
  }

  at(x: number, y: number): WorldObject | undefined {
    const id = this.tiles.get(tileKey(x, y));
    return id === undefined ? undefined : this.state.objects[id];
  }

  isWalkable(x: number, y: number): boolean {
    return this.walkable.has(tileKey(x, y));
  }

  isRoad(x: number, y: number): boolean {
    return this.roads.has(tileKey(x, y));
  }

  owned(x: number, y: number): boolean {
    const [lx, ly] = lotOf(x, y);
    return this.lots.has(lotKey(lx, ly));
  }

  /** True if any tile edge-adjacent to the rect is road or sidewalk. */
  roadAccess(r: Rect): boolean {
    for (let i = 0; i < r.w; i++) {
      if (this.isWalkable(r.x + i, r.y - 1) || this.isWalkable(r.x + i, r.y + r.h)) return true;
    }
    for (let j = 0; j < r.h; j++) {
      if (this.isWalkable(r.x - 1, r.y + j) || this.isWalkable(r.x + r.w, r.y + j)) return true;
    }
    return false;
  }

  /** Walkable tiles touching the rect (entrances), nearest-first order is not guaranteed. */
  entrances(r: Rect): [number, number][] {
    const out: [number, number][] = [];
    const push = (x: number, y: number) => {
      if (this.isWalkable(x, y)) out.push([x, y]);
    };
    for (let i = 0; i < r.w; i++) {
      push(r.x + i, r.y + r.h);
      push(r.x + i, r.y - 1);
    }
    for (let j = 0; j < r.h; j++) {
      push(r.x + r.w, r.y + j);
      push(r.x - 1, r.y + j);
    }
    return out;
  }
}

export type PlaceCheck = { ok: true } | { ok: false; reason: 'blocked' | 'notOwned' | 'needsRoad' | 'invalid' | 'coast' };

/** Geometric placement test (land, overlap, road snap/access). Economic checks live in actions. */
export function checkPlacement(
  index: WorldIndex,
  def: ItemDef,
  x: number,
  y: number,
  rot: Rot,
  ignoreId?: number,
): PlaceCheck {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, reason: 'invalid' };
  const snap = content().balance.world.roadSnap;
  if (def.kind === 'road' && (mod(x, snap) !== 0 || mod(y, snap) !== 0)) return { ok: false, reason: 'invalid' };
  const [w, h] = dims(def, rot);
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < h; j++) {
      const tx = x + i;
      const ty = y + j;
      if (!index.owned(tx, ty) || isRailTile(tx)) return { ok: false, reason: 'notOwned' };
      const id = index.tiles.get(tileKey(tx, ty));
      if (id !== undefined && id !== ignoreId) return { ok: false, reason: 'blocked' };
    }
  }
  if (def.coast) {
    // the row just in front (+y) must be open sea
    for (let i = 0; i < w; i++) if (!isSeaLot(lotOf(x + i, y + h)[1])) return { ok: false, reason: 'coast' };
  }
  if (def.needsRoad && !index.roadAccess({ x, y, w, h })) {
    // When moving a building, its own tiles don't count as road, which is fine.
    return { ok: false, reason: 'needsRoad' };
  }
  return { ok: true };
}

export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Bitmask of road connections for a road piece: 1=N(-y) 2=E(+x) 4=S(+y) 8=W(-x). */
export function roadMask(index: WorldIndex, o: WorldObject): number {
  const s = content().balance.world.roadSnap;
  let m = 0;
  if (index.isRoad(o.x, o.y - 1)) m |= 1;
  if (index.isRoad(o.x + s, o.y)) m |= 2;
  if (index.isRoad(o.x, o.y + s)) m |= 4;
  if (index.isRoad(o.x - 1, o.y)) m |= 8;
  return m;
}

/** Lots that can be bought next: unowned, in bounds, edge-adjacent to an owned lot. */
export function expandableLots(state: GameState): [number, number][] {
  const owned = new Set(state.lots);
  const out: [number, number][] = [];
  const seen = new Set<string>();
  for (const key of state.lots) {
    const [lx, ly] = parseLot(key);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = lx + dx;
      const ny = ly + dy;
      const k = lotKey(nx, ny);
      if (owned.has(k) || seen.has(k) || !lotInBounds(nx, ny)) continue;
      seen.add(k);
      out.push([nx, ny]);
    }
  }
  return out;
}
