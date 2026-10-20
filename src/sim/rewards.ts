// Granting rewards, splitting them into visual "doober" pickups, drop tables,
// XP and level-ups.
import { content } from './content';
import { energyCap, goodsCap, levelXp, maxLevel } from './economy';
import { Rng } from './rng';
import { activeEventIds } from './season';
import type { Drop, GameState, Reward, SimEvent } from './types';

export interface Ctx {
  s: GameState;
  now: number;
  rng: Rng;
  events: SimEvent[];
}

export function makeCtx(s: GameState, now: number): Ctx {
  return { s, now, rng: new Rng(s), events: [] };
}

export function bump(s: GameState, key: string, by = 1): void {
  s.stats[key] = (s.stats[key] ?? 0) + by;
}

export type DropTable = keyof ReturnType<typeof content>['balance']['drops'];

export interface Where {
  x: number;
  y: number;
  objId?: number;
}

/** Adds goods respecting storage; returns the amount actually stored. */
export function addGoods(ctx: Ctx, amount: number): number {
  const cap = goodsCap(ctx.s);
  const room = Math.max(0, cap - ctx.s.goods);
  const stored = Math.min(room, amount);
  ctx.s.goods += stored;
  if (stored < amount) ctx.events.push({ type: 'storageFull', lost: amount - stored });
  return stored;
}

export function addXp(ctx: Ctx, xp: number): void {
  if (xp <= 0) return;
  const s = ctx.s;
  s.xp += xp;
  const top = maxLevel();
  while (s.level < top && s.xp >= levelXp(s.level + 1)) {
    s.level += 1;
    const cap = energyCap(s.level);
    if (s.energy < cap) {
      s.energy = cap;
      s.energyAt = ctx.now;
    }
    const lvl = content().levels[s.level - 1];
    const reward = lvl?.reward ?? {};
    applyReward(ctx, reward, false);
    bump(s, 'levelup');
    ctx.events.push({ type: 'levelUp', level: s.level, reward });
  }
}

/**
 * Applies a reward to the state. Returns the visual pickup pieces (not yet
 * emitted as an event).
 */
export function applyReward(ctx: Ctx, r: Reward, visual = true): Drop[] {
  const s = ctx.s;
  const drops: Drop[] = [];
  const d = content().balance.doobers;
  if (r.coins && r.coins > 0) {
    const coins = Math.round(r.coins);
    s.coins += coins;
    if (visual) splitInto(drops, 'coins', coins, d.maxCoinPieces);
  }
  if (r.goods && r.goods > 0) {
    const stored = addGoods(ctx, Math.round(r.goods));
    if (visual && stored > 0) splitInto(drops, 'goods', stored, 6, content().balance.goods.perCrate);
  }
  if (r.energy && r.energy > 0) {
    s.energy += r.energy; // bonus energy may exceed the cap
    if (visual) splitInto(drops, 'energy', r.energy, 5, 1);
  }
  if (r.volunteers && r.volunteers > 0) {
    s.volunteers += r.volunteers;
    if (visual) drops.push({ kind: 'volunteer', amount: r.volunteers });
  }
  if (r.permits && r.permits > 0) {
    s.permits += r.permits;
    if (visual) drops.push({ kind: 'permit', amount: r.permits });
  }
  if (r.reputation && r.reputation > 0) {
    s.reputation += r.reputation;
    if (visual) drops.push({ kind: 'reputation', amount: r.reputation });
  }
  if (r.parts) {
    for (const [id, n] of Object.entries(r.parts)) {
      if (n <= 0) continue;
      s.parts[id] = (s.parts[id] ?? 0) + n;
      if (visual) drops.push({ kind: 'part', amount: n, id });
    }
  }
  if (r.items) {
    for (const [id, n] of Object.entries(r.items)) {
      if (n > 0 && content().items[id]) s.inventory[id] = (s.inventory[id] ?? 0) + n;
    }
  }
  if (r.collectibles) {
    for (const [id, n] of Object.entries(r.collectibles)) {
      if (n > 0) addCollectible(ctx, id, n);
      if (visual && n > 0) drops.push({ kind: 'collectible', amount: n, id });
    }
  }
  // XP last so level-up rewards land after this reward.
  if (r.xp && r.xp > 0) {
    if (visual) splitInto(drops, 'xp', Math.round(r.xp), d.maxXpPieces);
    addXp(ctx, Math.round(r.xp));
  }
  return drops;
}

function splitInto(drops: Drop[], kind: Drop['kind'], amount: number, maxPieces: number, perPiece?: number): void {
  let pieces = perPiece ? Math.ceil(amount / perPiece) : Math.min(maxPieces, amount);
  pieces = Math.max(1, Math.min(maxPieces, pieces));
  let left = amount;
  for (let i = 0; i < pieces; i++) {
    const share = i === pieces - 1 ? left : Math.round(amount / pieces);
    left -= share;
    if (share > 0) drops.push({ kind, amount: share });
  }
}

export function addCollectible(ctx: Ctx, id: string, n = 1): void {
  const set = content().collectibleSet[id];
  if (!set) return;
  const s = ctx.s;
  const before = isCollectionComplete(s, set);
  s.collectibles[id] = (s.collectibles[id] ?? 0) + n;
  bump(s, 'collectible', n);
  ctx.events.push({ type: 'collectible', id, collection: set });
  if (!before && isCollectionComplete(s, set)) ctx.events.push({ type: 'collectionReady', id: set });
}

export function isCollectionComplete(s: GameState, setId: string): boolean {
  const set = content().collections[setId];
  if (!set) return false;
  return set.items.every((i) => (s.collectibles[i] ?? 0) > 0);
}

const RARITY = [30, 25, 20, 15, 10];
/** Construction parts that can drop from play (wonder keys are rarer and come from goals/levels). */
export const BUILD_PARTS = ['brick', 'paint', 'toolkit'];

/** Rolls a drop table on top of a base reward, emits a drops event, returns pieces. */
export function payout(ctx: Ctx, table: DropTable, base: Reward, where: Where, opts?: { collection?: string; produce?: string }): Drop[] {
  const t = content().balance.drops[table] as {
    coins?: number[];
    xp?: number[];
    energy?: number;
    collectible?: number;
    bonusGoods?: number;
    part?: number;
  };
  const r: Reward = { ...base };
  if (t.coins) r.coins = (r.coins ?? 0) + ctx.rng.int(t.coins[0]!, t.coins[1]!);
  if (t.xp) r.xp = (r.xp ?? 0) + ctx.rng.int(t.xp[0]!, t.xp[1]!);
  if (t.energy && ctx.rng.chance(t.energy)) r.energy = (r.energy ?? 0) + 1;
  if (t.bonusGoods && r.goods && ctx.rng.chance(t.bonusGoods)) r.goods = Math.round(r.goods * 1.5);
  if (t.part && ctx.rng.chance(t.part)) {
    const part = ctx.rng.pick(BUILD_PARTS);
    r.parts = { ...(r.parts ?? {}), [part]: (r.parts?.[part] ?? 0) + 1 };
  }
  const drops = applyReward(ctx, r);
  if (opts?.produce) for (const d of drops) if (d.kind === 'goods') d.produce = opts.produce;
  // While a seasonal event runs, half the finds (and finds from places with
  // no collection of their own) come from the event's collection.
  let collection = opts?.collection;
  const seasonal = activeEventIds(ctx.now).find((id) => content().collections[id]);
  if (seasonal && (!collection || ctx.rng.chance(0.5))) collection = seasonal;
  if (collection && t.collectible && ctx.rng.chance(t.collectible)) {
    const set = content().collections[collection];
    if (set) {
      const weighted = set.items.map((id, i) => ({ id, w: RARITY[i] ?? 10 }));
      const pick = ctx.rng.weighted(weighted).id;
      addCollectible(ctx, pick);
      drops.push({ kind: 'collectible', amount: 1, id: pick });
    }
  }
  emitDrops(ctx, drops, where);
  return drops;
}

export function emitDrops(ctx: Ctx, drops: Drop[], where: Where): void {
  if (drops.length === 0) return;
  const max = content().balance.bonusBar.maxBank;
  ctx.s.pickupBank = Math.min(max, ctx.s.pickupBank + drops.length);
  const ev: SimEvent = { type: 'drops', x: where.x, y: where.y, drops };
  if (where.objId !== undefined) ev.objId = where.objId;
  ctx.events.push(ev);
}

/** Grants a reward with doobers at a world position. */
export function grantAt(ctx: Ctx, r: Reward, where: Where): void {
  emitDrops(ctx, applyReward(ctx, r), where);
}
