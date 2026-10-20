// A fresh city: a couple of streets, two cottages, a barn and four farm plots.
import { content, item } from './content';
import { refreshGoals } from './goals';
import { makeCtx } from './rewards';
import { lotKey } from './world';
import type { GameState, Rot, WorldObject } from './types';

interface Seed {
  item: string;
  x: number;
  y: number;
  rot?: Rot;
}

const STARTER: Seed[] = [
  // Main street running along x, and a side street up to the north edge.
  ...[3, 6, 9, 12, 15, 18, 21, 24, 27, 30].map((x) => ({ item: 'road', x, y: 15 })),
  ...[3, 6, 9, 12].map((y) => ({ item: 'road', x: 18, y })),
  { item: 'cottage', x: 6, y: 18 },
  { item: 'cottage', x: 10, y: 18 },
  { item: 'flowerbed', x: 8, y: 18 },
  { item: 'flowerbed', x: 9, y: 18 },
  { item: 'barn', x: 24, y: 18 },
  { item: 'plot', x: 27, y: 18 },
  { item: 'plot', x: 30, y: 18 },
  { item: 'plot', x: 27, y: 21 },
  { item: 'plot', x: 30, y: 21 },
  ...[
    [1, 1], [4, 2], [32, 3], [34, 8], [2, 30], [8, 33], [33, 33], [15, 32],
    [1, 20], [34, 26], [12, 7], [27, 5], [5, 9], [22, 30], [29, 11],
  ].map(([x, y]) => ({ item: 'shadetree', x: x!, y: y! })),
];

export function emptyState(now: number, seed: number): GameState {
  const b = content().balance;
  return {
    v: b.saveVersion,
    createdAt: now,
    now,
    cityName: b.start.cityName,
    avatar: b.start.avatar,
    coins: b.start.coins,
    xp: 0,
    level: 1,
    energy: b.start.energy,
    energyAt: now,
    goods: b.start.goods,
    reputation: 0,
    permits: b.start.permits,
    volunteers: b.start.volunteers,
    volunteersAt: now,
    parts: {},
    objects: {},
    nextId: 1,
    lots: b.start.lots.map(([x, y]) => lotKey(x!, y!)),
    expansions: 0,
    inventory: {},
    collectibles: {},
    collectionsDone: {},
    mastery: {},
    goals: { active: [], done: [] },
    stats: {},
    daily: { day: '', streak: 0 },
    boosts: [],
    pickupBank: 0,
    settings: { relaxed: false, noWither: false },
    rng: seed >>> 0,
    wishlist: [],
    gifts: [],
    helps: [],
    applied: [],
    npc: {},
    train: null,
    achievements: {},
    events: {},
    flags: {},
  };
}

export function createNewGame(now: number, seed?: number): GameState {
  const s = emptyState(now, seed ?? ((now ^ 0x9e3779b9) >>> 0));
  for (const st of STARTER) {
    const def = item(st.item);
    const o: WorldObject = {
      id: s.nextId++,
      item: st.item,
      x: st.x,
      y: st.y,
      rot: st.rot ?? 0,
      clicks: def.clicks ?? 0,
      built: true,
      placedAt: now,
      builtAt: now,
    };
    if (def.kind === 'house') o.readyAt = now;
    if (def.kind === 'plot') o.crop = null;
    s.objects[o.id] = o;
  }
  // The first cottage has rent waiting; the second one shortly after.
  const cottages = Object.values(s.objects).filter((o) => o.item === 'cottage');
  if (cottages[1]) cottages[1].readyAt = now + 120_000;
  // Two plots start ripe so the very first goal can be a harvest.
  const plots = Object.values(s.objects).filter((o) => o.item === 'plot');
  for (const p of plots.slice(0, 2)) p.crop = { id: 'strawberry', plantedAt: now - 310_000 };
  addFixtures(s, now);
  refreshGoals(makeCtx(s, now));
  return s;
}

/** World fixtures that every city has (the railway station). */
export function addFixtures(s: GameState, now: number): void {
  const station = content().items.station;
  if (!station) return;
  if (Object.values(s.objects).some((o) => o.item === 'station')) return;
  const w = content().balance.world;
  const o: WorldObject = {
    id: s.nextId++,
    item: 'station',
    x: w.railX - station.size[0],
    y: 13,
    rot: 0,
    clicks: station.clicks ?? 0,
    built: true,
    placedAt: now,
    builtAt: now,
  };
  s.objects[o.id] = o;
}
