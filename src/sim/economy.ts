// Derived economy values: population, caps, mood, decoration bonuses, rates.
import { content, item, maybeItem } from './content';
import { expandRect, rectOf, rectsOverlap, WorldIndex } from './world';
import type { BoostDef, CropDef, GameState, ItemDef, WorldObject } from './types';

export type Mood = 'happy' | 'content' | 'sad';

export function objects(s: GameState): WorldObject[] {
  return Object.values(s.objects);
}

export function upgradeMult(o: WorldObject, def: ItemDef): number {
  const lvl = o.level ?? 1;
  if (lvl <= 1 || !def.upgrades) return 1;
  return def.upgrades[Math.min(lvl - 2, def.upgrades.length - 1)]?.mult ?? 1;
}

export function upgradeExtra(o: WorldObject, def: ItemDef): number {
  const lvl = o.level ?? 1;
  if (lvl <= 1 || !def.upgrades) return 0;
  let extra = 0;
  for (let i = 0; i < lvl - 1 && i < def.upgrades.length; i++) extra += def.upgrades[i]?.extra ?? 0;
  return extra;
}

export function housePop(o: WorldObject, def: ItemDef): number {
  return (def.pop ?? 0) + upgradeExtra(o, def);
}

export function population(s: GameState): number {
  let pop = 0;
  for (const o of objects(s)) {
    if (!o.built) continue;
    const def = maybeItem(o.item);
    if (def?.kind === 'house') pop += housePop(o, def);
  }
  return pop;
}

/** Population including homes still under construction (used by the placement cap rule). */
export function reservedPopulation(s: GameState): number {
  let pop = 0;
  for (const o of objects(s)) {
    const def = maybeItem(o.item);
    if (def?.kind === 'house') pop += housePop(o, def);
  }
  return pop;
}

export function popCap(s: GameState): number {
  let cap = content().balance.population.baseCap;
  for (const o of objects(s)) {
    if (!o.built) continue;
    const def = maybeItem(o.item);
    if (!def || !def.cap) continue;
    cap += Math.round(def.cap * upgradeMult(o, def)) + upgradeExtra(o, def);
  }
  return cap;
}

export function goodsCap(s: GameState): number {
  let cap = content().balance.goods.baseCap;
  for (const o of objects(s)) {
    if (!o.built) continue;
    const def = maybeItem(o.item);
    if (def?.storage) cap += Math.round(def.storage * upgradeMult(o, def));
  }
  return cap;
}

export function mood(s: GameState): Mood {
  const cap = popCap(s);
  const ratio = cap <= 0 ? 1 : population(s) / cap;
  const p = content().balance.population;
  if (ratio <= p.happyMax) return 'happy';
  if (ratio <= p.contentMax) return 'content';
  return 'sad';
}

export function energyCap(level: number): number {
  const e = content().balance.energy;
  return Math.min(e.maxCap, e.baseCap + e.capPerLevel * (level - 1));
}

export function levelXp(level: number): number {
  const levels = content().levels;
  const found = levels[level - 1];
  return found ? found.xp : Number.POSITIVE_INFINITY;
}

export function maxLevel(): number {
  return content().levels.length;
}

/** Percentage bonus from decorations within reach (e.g. 12 = +12%). */
export function decoBonus(s: GameState, target: WorldObject): number {
  const def = maybeItem(target.item);
  if (!def || (def.kind !== 'house' && def.kind !== 'business')) return 0;
  const r = rectOf(target);
  const defaultRadius = content().balance.decorations.radius;
  let pct = 0;
  for (const o of objects(s)) {
    if (o === target || !o.built) continue;
    const d = maybeItem(o.item);
    if (!d || !d.bonus) continue;
    if (d.kind !== 'decoration' && d.kind !== 'hq') continue;
    const area = expandRect(rectOf(o), d.radius ?? defaultRadius);
    if (!rectsOverlap(area, r)) continue;
    pct += d.bonus;
    if (d.themeBonus && d.theme && d.theme === def.theme) pct += d.themeBonus;
  }
  return pct;
}

/** Bonus a decoration would give a building if placed at a rect (placement preview). */
export function decoPreview(deco: ItemDef, decoRect: { x: number; y: number; w: number; h: number }, target: WorldObject): number {
  const def = maybeItem(target.item);
  if (!def || (def.kind !== 'house' && def.kind !== 'business') || !deco.bonus) return 0;
  const area = expandRect(decoRect, deco.radius ?? content().balance.decorations.radius);
  if (!rectsOverlap(area, rectOf(target))) return 0;
  let pct = deco.bonus;
  if (deco.themeBonus && deco.theme && deco.theme === def.theme) pct += deco.themeBonus;
  return pct;
}

export function masteryStars(count: number, thresholds: number[]): number {
  let stars = 0;
  for (const t of thresholds) if (count >= t) stars++;
  return stars;
}

export function cropMasteryBonus(s: GameState, cropId: string): number {
  const c = content().balance.crops;
  const stars = masteryStars(s.mastery[cropId] ?? 0, c.masteryThresholds);
  return stars > 0 ? c.masteryBonus[stars - 1]! : 0;
}

export function businessMasteryBonus(s: GameState, itemId: string): number {
  const c = content().balance.businessMastery;
  const stars = masteryStars(s.mastery[itemId] ?? 0, c.thresholds);
  return stars > 0 ? c.bonus[stars - 1]! : 0;
}

export function activeBoosts(s: GameState, now: number): BoostDef[] {
  const out: BoostDef[] = [];
  for (const b of s.boosts) {
    if (b.until > now) {
      const def = content().boosts[b.id];
      if (def) out.push(def);
    }
  }
  return out;
}

export function boostValue(s: GameState, now: number, key: 'cropGoods' | 'shopSpeed' | 'payout' | 'rent'): number {
  let mult = 1;
  for (const b of activeBoosts(s, now)) {
    const v = b[key];
    if (v) mult *= v;
  }
  return mult;
}

export type CropStage = 'seed' | 'growing' | 'ripe' | 'withered';

export function cropStage(s: GameState, o: WorldObject, now: number): CropStage | null {
  if (!o.crop) return null;
  const crop = content().crops[o.crop.id];
  if (!crop) return null;
  const elapsed = (now - o.crop.plantedAt) / 1000 + (o.crop.boost ?? 0);
  if (elapsed < crop.time * 0.5) return 'seed';
  if (elapsed < crop.time) return 'growing';
  if (s.settings.noWither) return 'ripe';
  if (elapsed < crop.time * (1 + content().balance.crops.witherFactor)) return 'ripe';
  return 'withered';
}

/** Seconds until the crop is ripe (0 if ripe/withered). */
export function cropRemaining(o: WorldObject, crop: CropDef, now: number): number {
  if (!o.crop) return 0;
  const elapsed = (now - o.crop.plantedAt) / 1000 + (o.crop.boost ?? 0);
  return Math.max(0, crop.time - elapsed);
}

/** Seconds until a ripe crop withers (Infinity if withering is off). */
export function cropWitherIn(s: GameState, o: WorldObject, crop: CropDef, now: number): number {
  if (!o.crop || s.settings.noWither) return Number.POSITIVE_INFINITY;
  const elapsed = (now - o.crop.plantedAt) / 1000 + (o.crop.boost ?? 0);
  return Math.max(0, crop.time * (1 + content().balance.crops.witherFactor) - elapsed);
}

export function shopGoods(o: WorldObject, def: ItemDef): number {
  return Math.round((def.goods ?? 0) * upgradeMult(o, def));
}

export function shopPayout(s: GameState, o: WorldObject, def: ItemDef, now: number): number {
  const base = (def.payout ?? 0) * upgradeMult(o, def);
  const mult = (1 + decoBonus(s, o) / 100) * (1 + businessMasteryBonus(s, def.id)) * boostValue(s, now, 'payout');
  return Math.round(base * mult);
}

export function houseRent(s: GameState, o: WorldObject, def: ItemDef, now: number): number {
  const base = (def.rent ?? 0) * upgradeMult(o, def);
  return Math.round(base * (1 + decoBonus(s, o) / 100) * boostValue(s, now, 'rent'));
}

export interface ShopRates {
  /** Customers per minute for each open shop (tourists already weighted). */
  perShop: number;
  residentsPerMin: number;
  touristsPerMin: number;
  open: number;
}

export function touristRate(s: GameState, index?: WorldIndex): number {
  let t = 0;
  const idx = index ?? new WorldIndex(s);
  for (const o of objects(s)) {
    if (!o.built) continue;
    const def = maybeItem(o.item);
    if (def?.tourists && idx.roadAccess(rectOf(o))) t += def.tourists * upgradeMult(o, def);
  }
  return t;
}

export function shopRates(s: GameState, openCount: number, now: number, index?: WorldIndex): ShopRates {
  const b = content().balance;
  const pop = population(s);
  const residents = (b.shops.baseRate + b.shops.perResident * pop) * b.population.moodSales[mood(s)];
  const tourists = touristRate(s, index);
  const speed = boostValue(s, now, 'shopSpeed');
  const total = (residents + tourists * b.shops.touristWeight) * speed;
  const per = openCount > 0 ? total / openCount : 0;
  return {
    perShop: Math.min(b.shops.maxPerShop * speed, Math.max(b.shops.minPerShop, per)),
    residentsPerMin: residents * speed,
    touristsPerMin: tourists * speed,
    open: openCount,
  };
}

export function isOperational(index: WorldIndex, o: WorldObject): boolean {
  const def = item(o.item);
  if (!def.needsRoad) return true;
  return index.roadAccess(rectOf(o));
}
