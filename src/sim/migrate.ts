// Versioned save format + migrations + defensive normalisation of untrusted
// save data (imports, cloud saves, old localStorage).
import { content, maybeItem } from './content';
import { addFixtures, emptyState } from './newgame';
import type { GameState, WorldObject } from './types';

export const SAVE_FORMAT = 'honeyhollow';

export function saveVersion(): number {
  return content().balance.saveVersion;
}

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  version: number;
  savedAt: number;
  state: GameState;
}

/**
 * migrations[n] upgrades a raw save from version n to n + 1. Add an entry
 * here whenever GameState changes shape, then bump balance.saveVersion.
 */
const migrations: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  // Example for the future:
  // 1: (s) => ({ ...s, newField: defaultValue, v: 2 }),
};

export class SaveError extends Error {
  constructor(readonly code: 'format' | 'newer' | 'corrupt') {
    super(code);
  }
}

export function wrapSave(state: GameState, now: number): SaveFile {
  return { format: SAVE_FORMAT, version: saveVersion(), savedAt: now, state };
}

/** Accepts a SaveFile or a bare GameState (older exports). */
export function readSave(raw: unknown, now: number): GameState {
  if (!raw || typeof raw !== 'object') throw new SaveError('format');
  const r = raw as Record<string, unknown>;
  const state = r.format === SAVE_FORMAT ? r.state : r;
  return migrateState(state, now);
}

export function migrateState(raw: unknown, now: number): GameState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new SaveError('format');
  let s = raw as Record<string, unknown>;
  let v = typeof s.v === 'number' ? s.v : 1;
  if (v > saveVersion()) throw new SaveError('newer');
  while (v < saveVersion()) {
    const m = migrations[v];
    if (!m) throw new SaveError('corrupt');
    s = m(s);
    v++;
  }
  return normalize(s, now);
}

const num = (v: unknown, def: number, min = 0, max = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
const int = (v: unknown, def: number, min = 0, max = Number.MAX_SAFE_INTEGER): number => Math.floor(num(v, def, min, max));
const str = (v: unknown, def: string, max = 64): string => (typeof v === 'string' ? v.slice(0, max) : def);
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);

function numMap(v: unknown, valid?: (k: string) => boolean, max = 1e9, keepZero = false): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (k.length > 80) continue;
    if (valid && !valid(k)) continue;
    const x = num(n, 0, -1e12, max);
    if (x !== 0 || keepZero) out[k] = x;
  }
  return out;
}

function normalizeObject(raw: unknown, now: number): WorldObject | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const def = maybeItem(str(r.item, ''));
  if (!def) return null;
  const o: WorldObject = {
    id: int(r.id, 0, 1),
    item: def.id,
    x: int(r.x, 0, -10000, 10000),
    y: int(r.y, 0, -10000, 10000),
    rot: r.rot === 1 ? 1 : 0,
    clicks: int(r.clicks, 0, 0, 1000),
    built: bool(r.built, false),
    placedAt: num(r.placedAt, now),
  };
  if (!o.id) return null;
  if (typeof r.builtAt === 'number') o.builtAt = r.builtAt;
  if (typeof r.readyAt === 'number') o.readyAt = r.readyAt;
  if (typeof r.level === 'number') o.level = int(r.level, 1, 1, 10);
  if (typeof r.helpedAt === 'number') o.helpedAt = r.helpedAt;
  if (typeof r.boostReadyAt === 'number') o.boostReadyAt = r.boostReadyAt;
  if (Array.isArray(r.staff)) o.staff = r.staff.filter((x): x is string => typeof x === 'string').slice(0, 50).map((x) => x.slice(0, 30));
  if (r.partsIn) o.partsIn = numMap(r.partsIn, (k) => content().parts.includes(k), 1000);
  if (r.shop && typeof r.shop === 'object') {
    const sh = r.shop as Record<string, unknown>;
    const state = ['opening', 'empty', 'open', 'soldout'].includes(sh.state as string) ? (sh.state as 'open') : 'empty';
    o.shop = { state, served: num(sh.served, 0, 0, 1e6) };
    if (typeof sh.name === 'string') o.shop.name = sh.name.slice(0, 24);
    if (typeof sh.collects === 'number') o.shop.collects = int(sh.collects, 0);
  } else if (def.kind === 'business' && o.built) {
    o.shop = { state: 'empty', served: 0 };
  }
  if (r.crop && typeof r.crop === 'object') {
    const c = r.crop as Record<string, unknown>;
    if (content().crops[str(c.id, '')]) {
      o.crop = { id: str(c.id, ''), plantedAt: num(c.plantedAt, now, 0) };
      if (typeof c.boost === 'number') o.crop.boost = num(c.boost, 0, 0, 1e7);
      if (c.revived === true) o.crop.revived = true;
    }
  } else if (def.kind === 'plot') {
    o.crop = null;
  }
  if (Array.isArray(r.ships)) {
    o.ships = r.ships.slice(0, 8).map((sh) => {
      if (!sh || typeof sh !== 'object') return null;
      const x = sh as Record<string, unknown>;
      return content().contracts[str(x.contract, '')] ? { contract: str(x.contract, ''), startedAt: num(x.startedAt, now) } : null;
    });
  }
  return o;
}

function normalize(r: Record<string, unknown>, now: number): GameState {
  const base = emptyState(num(r.createdAt, now), int(r.rng, 12345, 0, 0xffffffff));
  const s: GameState = base;
  s.createdAt = num(r.createdAt, now);
  s.now = Math.min(num(r.now, now), now);
  s.cityName = str(r.cityName, base.cityName, 28);
  s.avatar = str(r.avatar, base.avatar, 20);
  s.coins = int(r.coins, base.coins, 0, 1e12);
  s.xp = int(r.xp, 0, 0, 1e12);
  s.level = int(r.level, 1, 1, content().levels.length);
  s.energy = int(r.energy, base.energy, 0, 10000);
  s.energyAt = num(r.energyAt, now);
  s.goods = int(r.goods, 0, 0, 1e9);
  s.reputation = int(r.reputation, 0, 0, 1e9);
  s.permits = int(r.permits, 0, 0, 1e6);
  s.volunteers = int(r.volunteers, 0, 0, 1e6);
  s.volunteersAt = num(r.volunteersAt, now);
  s.parts = numMap(r.parts, (k) => content().parts.includes(k), 1e6);
  s.objects = {};
  let maxId = 0;
  const rawObjects = r.objects && typeof r.objects === 'object' ? Object.values(r.objects as Record<string, unknown>) : [];
  const limit = content().balance.sanity.maxObjects;
  for (const raw of rawObjects.slice(0, limit)) {
    const o = normalizeObject(raw, now);
    if (!o || s.objects[o.id]) continue;
    s.objects[o.id] = o;
    maxId = Math.max(maxId, o.id);
  }
  s.nextId = Math.max(int(r.nextId, 1, 1), maxId + 1);
  s.lots = Array.isArray(r.lots) ? [...new Set(r.lots.filter((l): l is string => typeof l === 'string' && /^-?\d{1,3},-?\d{1,3}$/.test(l)))] : base.lots;
  if (s.lots.length === 0) s.lots = base.lots;
  s.expansions = int(r.expansions, 0, 0, 1000);
  s.inventory = numMap(r.inventory, (k) => !!content().items[k], 1e4);
  s.collectibles = numMap(r.collectibles, (k) => !!content().collectibleSet[k], 1e4);
  s.collectionsDone = numMap(r.collectionsDone, (k) => !!content().collections[k], 1e6);
  s.mastery = numMap(r.mastery, undefined, 1e9);
  const goals = (r.goals ?? {}) as Record<string, unknown>;
  s.goals = {
    active: Array.isArray(goals.active)
      ? goals.active
          .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object' && !!content().goals[str((g as Record<string, unknown>).id, '')])
          .map((g) => ({ id: str(g.id, ''), startedAt: num(g.startedAt, now), base: numMap(g.base, undefined, 1e12, true) }))
      : [],
    done: Array.isArray(goals.done) ? [...new Set(goals.done.filter((g): g is string => typeof g === 'string' && g.length < 60))] : [],
  };
  s.stats = numMap(r.stats, undefined, 1e12);
  const daily = (r.daily ?? {}) as Record<string, unknown>;
  s.daily = { day: str(daily.day, '', 10), streak: int(daily.streak, 0, 0, 10000) };
  s.boosts = Array.isArray(r.boosts)
    ? r.boosts
        .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object' && !!content().boosts[str((b as Record<string, unknown>).id, '')])
        .map((b) => ({ id: str(b.id, ''), until: num(b.until, 0) }))
    : [];
  s.pickupBank = int(r.pickupBank, 0, 0, content().balance.bonusBar.maxBank);
  const settings = (r.settings ?? {}) as Record<string, unknown>;
  s.settings = { relaxed: bool(settings.relaxed, false), noWither: bool(settings.noWither, false) };
  s.wishlist = Array.isArray(r.wishlist) ? r.wishlist.filter((w): w is string => typeof w === 'string' && !!content().collectibleSet[w]).slice(0, 5) : [];
  s.gifts = Array.isArray(r.gifts) ? (r.gifts.filter((g) => g && typeof g === 'object' && typeof (g as { id: unknown }).id === 'string').slice(0, 100) as GameState['gifts']) : [];
  s.helps = Array.isArray(r.helps) ? (r.helps.filter((h) => h && typeof h === 'object' && typeof (h as { id: unknown }).id === 'string').slice(0, 100) as GameState['helps']) : [];
  s.applied = Array.isArray(r.applied) ? r.applied.filter((a): a is string => typeof a === 'string').slice(-300) : [];
  s.npc = {};
  if (r.npc && typeof r.npc === 'object') {
    for (const [id, n] of Object.entries(r.npc as Record<string, Record<string, unknown>>)) {
      if (!content().npcs.some((x) => x.id === id) || !n || typeof n !== 'object') continue;
      s.npc[id] = {
        day: str(n.day, '', 10),
        helps: int(n.helps, 0, 0, 100),
        helped: Array.isArray(n.helped) ? n.helped.filter((x): x is number => typeof x === 'number').slice(0, 50) : [],
        giftDay: str(n.giftDay, '', 10),
        visitDay: str(n.visitDay, '', 10),
        staffed: Array.isArray(n.staffed) ? n.staffed.filter((x): x is number => typeof x === 'number').slice(0, 500) : [],
      };
    }
  }
  const t = r.train as Record<string, unknown> | null | undefined;
  s.train =
    t && typeof t === 'object' && content().routes[str(t.route, '')]
      ? { route: str(t.route, ''), startedAt: num(t.startedAt, now), stops: Array.isArray(t.stops) ? t.stops.filter((x): x is string => typeof x === 'string').slice(0, 10) : [] }
      : null;
  s.achievements = numMap(r.achievements, undefined, 1e12);
  s.events = {};
  if (r.events && typeof r.events === 'object') {
    for (const [id, m] of Object.entries(r.events as Record<string, unknown>)) {
      if (id.length < 40) s.events[id] = numMap(m, undefined, 1e9);
    }
  }
  s.flags = {};
  if (r.flags && typeof r.flags === 'object') {
    for (const [k, v] of Object.entries(r.flags as Record<string, unknown>)) if (v === true && k.length <= 40) s.flags[k] = true;
  }
  s.v = saveVersion();
  addFixtures(s, now);
  return s;
}
