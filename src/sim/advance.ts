// Time-based progression. Every timer is derived from timestamps, so calling
// advance(state, now) after the tab was closed for hours "fast-forwards" the
// city exactly: energy and volunteers regenerate and stocked shops keep selling.
import { content, maybeItem } from './content';
import { energyCap, shopGoods, shopRates } from './economy';
import { rectOf, WorldIndex } from './world';
import type { GameState, WorldObject } from './types';

/** Mutates `s` in place. Use only on a draft/clone. */
export function advanceMut(s: GameState, now: number, index?: WorldIndex): void {
  if (!(now > s.now)) return; // clocks never run backwards
  regenEnergy(s, now);
  regenVolunteers(s, now);
  simulateShops(s, s.now, now, index ?? new WorldIndex(s));
  s.boosts = s.boosts.filter((b) => b.until > now);
  s.now = now;
}

export function regenEnergy(s: GameState, now: number): void {
  const cap = energyCap(s.level);
  const ms = content().balance.energy.regenSeconds * 1000;
  if (s.energy >= cap) {
    s.energyAt = now;
    return;
  }
  const gained = Math.floor((now - s.energyAt) / ms);
  if (gained <= 0) return;
  s.energy = Math.min(cap, s.energy + gained);
  s.energyAt = s.energy >= cap ? now : s.energyAt + gained * ms;
}

export function regenVolunteers(s: GameState, now: number): void {
  const v = content().balance.volunteers;
  const ms = v.regenSeconds * 1000;
  if (s.volunteers >= v.max) {
    s.volunteersAt = now;
    return;
  }
  const gained = Math.floor((now - s.volunteersAt) / ms);
  if (gained <= 0) return;
  s.volunteers = Math.min(v.max, s.volunteers + gained);
  s.volunteersAt = s.volunteers >= v.max ? now : s.volunteersAt + gained * ms;
}

/** Seconds until the next energy point (0 when full). */
export function energyNextIn(s: GameState, now: number): number {
  if (s.energy >= energyCap(s.level)) return 0;
  const ms = content().balance.energy.regenSeconds * 1000;
  return Math.max(0, (s.energyAt + ms - now) / 1000);
}

export function volunteerNextIn(s: GameState, now: number): number {
  const v = content().balance.volunteers;
  if (s.volunteers >= v.max) return 0;
  return Math.max(0, (s.volunteersAt + v.regenSeconds * 1000 - now) / 1000);
}

/**
 * Exact piecewise simulation of shop sales between two timestamps. Within a
 * segment every open shop sells at the same rate; a segment ends when a shop
 * sells out (fewer open shops = faster sales for the rest) or a boost expires.
 */
export function simulateShops(s: GameState, from: number, to: number, index: WorldIndex): void {
  let t = from;
  let guard = 0;
  while (t < to && guard++ < 10000) {
    const open: WorldObject[] = [];
    for (const key in s.objects) {
      const o = s.objects[key]!;
      if (o.shop?.state === 'open' && o.built && index.roadAccess(rectOf(o))) open.push(o);
    }
    if (open.length === 0) return;
    let segEnd = to;
    for (const b of s.boosts) if (b.until > t && b.until < segEnd) segEnd = b.until;
    const rates = shopRates(s, open.length, t, index);
    const perMs = rates.perShop / 60000;
    if (perMs <= 0) return;
    let step = segEnd - t;
    for (const o of open) {
      const def = maybeItem(o.item)!;
      const remaining = shopGoods(o, def) - o.shop!.served;
      step = Math.min(step, Math.max(0, remaining / perMs));
    }
    for (const o of open) {
      const def = maybeItem(o.item)!;
      const cap = shopGoods(o, def);
      o.shop!.served += perMs * step;
      if (o.shop!.served >= cap - 1e-6) {
        o.shop!.served = cap;
        o.shop!.state = 'soldout';
      }
    }
    t += step;
    if (step <= 0 && !open.some((o) => o.shop!.state === 'soldout')) t = segEnd;
  }
}

/** Customers per minute each open shop currently receives (for UI/walkers). */
export function currentShopRate(s: GameState, now: number, index?: WorldIndex): ReturnType<typeof shopRates> {
  const idx = index ?? new WorldIndex(s);
  let open = 0;
  for (const key in s.objects) {
    const o = s.objects[key]!;
    if (o.shop?.state === 'open' && o.built && idx.roadAccess(rectOf(o))) open++;
  }
  return shopRates(s, open, now, idx);
}
