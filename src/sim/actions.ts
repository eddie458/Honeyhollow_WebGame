// The reducer: applyAction(state, action, now) -> { state, events } or an error.
// The input state is never mutated; a deep clone is advanced to `now` first so
// every timer is current, then the action is applied to the clone.
import { advanceMut } from './advance';
import { content, maybeItem } from './content';
import {
  boostValue,
  cropMasteryBonus,
  cropStage,
  houseRent,
  isOperational,
  masteryStars,
  popCap,
  population,
  reservedPopulation,
  shopGoods,
  shopPayout,
  upgradeMult,
} from './economy';
import { checkAchievements, checkGoals } from './goals';
import { addCollectible, addGoods, applyReward, BUILD_PARTS, bump, emitDrops, grantAt, isCollectionComplete, makeCtx, payout, type Ctx } from './rewards';
import { checkPlacement, dims, expandableLots, lotKey, rectOf, WorldIndex } from './world';
import type { Action, ActionResult, ErrorCode, GameState, HelpAction, ItemDef, PendingHelp, Reward, WorldObject } from './types';

class SimError extends Error {
  constructor(readonly code: ErrorCode, readonly detail?: string) {
    super(code);
  }
}

function fail(code: ErrorCode, detail?: string): never {
  throw new SimError(code, detail);
}

export function cloneState(s: GameState): GameState {
  return structuredClone(s);
}

/** Advances a copy of the state to `now` without applying an action. */
export function advance(state: GameState, now: number): GameState {
  const s = cloneState(state);
  advanceMut(s, now);
  return s;
}

export function applyAction(state: GameState, action: Action, now: number): ActionResult {
  const s = cloneState(state);
  const at = Math.max(now, s.now);
  advanceMut(s, at);
  const ctx = makeCtx(s, at);
  try {
    handle(ctx, action);
    checkGoals(ctx);
    // tier rewards can level the player up, which can unlock more goals
    checkAchievements(ctx);
    checkGoals(ctx);
  } catch (e) {
    if (e instanceof SimError) {
      const res: ActionResult = { ok: false, error: e.code };
      if (e.detail !== undefined) res.detail = e.detail;
      return res;
    }
    throw e;
  }
  return { ok: true, state: s, events: ctx.events };
}

// ------------------------------------------------------------------ utils --

function obj(s: GameState, id: unknown): WorldObject {
  if (typeof id !== 'number' || !Number.isInteger(id)) fail('invalid');
  const o = s.objects[id];
  if (!o) fail('notFound');
  return o;
}

function defOf(o: WorldObject): ItemDef {
  const d = maybeItem(o.item);
  if (!d) fail('invalid', 'unknown item');
  return d;
}

function spendEnergy(ctx: Ctx, n = 1): void {
  if (ctx.s.settings.relaxed || n <= 0) return;
  if (ctx.s.energy < n) fail('noEnergy');
  const before = ctx.s.energy;
  ctx.s.energy -= n;
  // Restart the regen clock when dropping below the cap from a full/over-cap meter.
  if (before >= capNow(ctx.s) && ctx.s.energy < capNow(ctx.s)) ctx.s.energyAt = ctx.now;
}

function capNow(s: GameState): number {
  const e = content().balance.energy;
  return Math.min(e.maxCap, e.baseCap + e.capPerLevel * (s.level - 1));
}

function spendCoins(s: GameState, n: number): void {
  if (n <= 0) return;
  if (s.coins < n) fail('noCoins');
  s.coins -= n;
}

function center(o: WorldObject): { x: number; y: number; objId: number } {
  const r = rectOf(o);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2, objId: o.id };
}

export function cleanName(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function dayKey(now: number, tzMinutes: number): string {
  const tz = Number.isFinite(tzMinutes) ? Math.max(-840, Math.min(840, Math.round(tzMinutes))) : 0;
  const d = new Date(now - tz * 60000);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

export function unlockProblem(s: GameState, def: ItemDef): ErrorCode | null {
  const u = def.unlock;
  if (!u) return null;
  if (u.level && s.level < u.level) return 'locked';
  if (u.population && population(s) < u.population) return 'locked';
  if (u.goal && !s.goals.done.includes(u.goal)) return 'locked';
  return null;
}

function countItem(s: GameState, id: string): number {
  let n = 0;
  for (const k in s.objects) if (s.objects[k]!.item === id) n++;
  return n;
}

function markApplied(s: GameState, key: string): void {
  s.applied.push(key);
  if (s.applied.length > 300) s.applied.splice(0, s.applied.length - 300);
}

function ensureNpc(s: GameState, id: string) {
  if (!content().npcs.some((n) => n.id === id)) fail('invalid', 'unknown npc');
  let n = s.npc[id];
  if (!n) {
    n = { day: '', helps: 0, helped: [], giftDay: '', visitDay: '', staffed: [] };
    s.npc[id] = n;
  }
  return n;
}

// --------------------------------------------------------------- handlers --

function handle(ctx: Ctx, a: Action): void {
  if (!a || typeof a !== 'object') fail('invalid');
  switch (a.t) {
    case 'place':
      return place(ctx, a.item, a.x, a.y, a.rot, a.fromInventory === true);
    case 'build':
    case 'finish':
      return build(ctx, obj(ctx.s, a.id));
    case 'collect':
      return collect(ctx, obj(ctx.s, a.id));
    case 'supply':
      return supply(ctx, obj(ctx.s, a.id));
    case 'plant':
      return plant(ctx, obj(ctx.s, a.id), a.crop);
    case 'harvest':
      return harvest(ctx, obj(ctx.s, a.id));
    case 'clearPlot':
      return clearPlot(ctx, obj(ctx.s, a.id));
    case 'move':
      return move(ctx, obj(ctx.s, a.id), a.x, a.y, a.rot);
    case 'rotate':
      return rotate(ctx, obj(ctx.s, a.id));
    case 'store':
      return store(ctx, obj(ctx.s, a.id));
    case 'sell':
      return sell(ctx, obj(ctx.s, a.id));
    case 'staff':
      return staff(ctx, obj(ctx.s, a.id), a.source);
    case 'claimDaily':
      return claimDaily(ctx, a.tz);
    case 'redeem':
      return redeem(ctx, a.collection);
    case 'bonus':
      return bonus(ctx, a.pickups);
    case 'expand':
      return expand(ctx, a.lx, a.ly);
    case 'upgrade':
      return upgrade(ctx, obj(ctx.s, a.id));
    case 'ship':
      return ship(ctx, obj(ctx.s, a.id), a.slot, a.contract);
    case 'unload':
      return unload(ctx, obj(ctx.s, a.id), a.slot);
    case 'train':
      return train(ctx, a.route, a.stops);
    case 'trainCollect':
      return trainCollect(ctx);
    case 'boost':
      return boost(ctx, obj(ctx.s, a.id));
    case 'recharge':
      return recharge(ctx, obj(ctx.s, a.id));
    case 'deliverParts':
      return deliverParts(ctx, obj(ctx.s, a.id));
    case 'nameShop': {
      const o = obj(ctx.s, a.id);
      if (!o.shop) fail('invalid');
      const name = cleanName(a.name, 24);
      if (name) o.shop.name = name;
      else delete o.shop.name;
      return;
    }
    case 'rename': {
      const name = cleanName(a.name, 28);
      if (!name) fail('invalid');
      ctx.s.cityName = name;
      return;
    }
    case 'setAvatar': {
      if (typeof a.avatar !== 'string' || !/^[a-z]{2,20}$/.test(a.avatar)) fail('invalid');
      ctx.s.avatar = a.avatar;
      return;
    }
    case 'settings':
      if (typeof a.relaxed === 'boolean') ctx.s.settings.relaxed = a.relaxed;
      if (typeof a.noWither === 'boolean') ctx.s.settings.noWither = a.noWither;
      return;
    case 'wishlist': {
      if (!Array.isArray(a.items)) fail('invalid');
      const set = content().collectibleSet;
      ctx.s.wishlist = [...new Set(a.items.filter((i) => typeof i === 'string' && set[i]))].slice(0, 5);
      return;
    }
    case 'acceptGift':
      return acceptGift(ctx, a.id);
    case 'addGifts':
      return addGifts(ctx, a.gifts);
    case 'acceptHelp':
      return acceptHelp(ctx, a.id);
    case 'declineHelp':
      ctx.s.helps = ctx.s.helps.filter((h) => h.id !== a.id);
      markApplied(ctx.s, `help:${a.id}`);
      return;
    case 'addHelps':
      return addHelps(ctx, a.helps);
    case 'helpReward':
      return helpReward(ctx, a.reward, a.key, a.npc, a.objectId, a.day, a.at);
    case 'visitBonus':
      return visitBonus(ctx, a.npc, a.day);
    case 'npcDaily':
      return npcDaily(ctx, a.day, a.helps !== false);
    case 'franchisePay':
      return franchisePay(ctx, a.item);
    case 'franchiseSupply':
      return franchiseSupply(ctx, a.goods, a.reward, a.key);
    case 'flag':
      if (typeof a.key !== 'string' || a.key.length > 40) fail('invalid');
      ctx.s.flags[a.key] = true;
      return;
    case 'grant': {
      if (typeof a.key !== 'string' || a.key.length > 80) fail('invalid');
      if (ctx.s.applied.includes(a.key)) fail('alreadyDone');
      markApplied(ctx.s, a.key);
      const drops = applyReward(ctx, sanitizeReward(a.reward));
      emitDrops(ctx, drops, { x: Number.NaN, y: Number.NaN });
      return;
    }
    default:
      fail('invalid', 'unknown action');
  }
}

export function sanitizeReward(r: unknown): Reward {
  const out: Reward = {};
  if (!r || typeof r !== 'object') return out;
  const src = r as Record<string, unknown>;
  const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
  const coins = num(src.coins, 1_000_000);
  if (coins) out.coins = coins;
  const xp = num(src.xp, 100_000);
  if (xp) out.xp = xp;
  const energy = num(src.energy, 100);
  if (energy) out.energy = energy;
  const goods = num(src.goods, 100_000);
  if (goods) out.goods = goods;
  const vol = num(src.volunteers, 20);
  if (vol) out.volunteers = vol;
  const permits = num(src.permits, 20);
  if (permits) out.permits = permits;
  const rep = num(src.reputation, 1000);
  if (rep) out.reputation = rep;
  const mapOf = (v: unknown, valid: (k: string) => boolean, max: number) => {
    if (!v || typeof v !== 'object') return undefined;
    const m: Record<string, number> = {};
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      const c = num(n, max);
      if (c && valid(k)) m[k] = c;
    }
    return Object.keys(m).length ? m : undefined;
  };
  const parts = mapOf(src.parts, (k) => content().parts.includes(k), 50);
  if (parts) out.parts = parts;
  const items = mapOf(src.items, (k) => !!content().items[k], 20);
  if (items) out.items = items;
  const col = mapOf(src.collectibles, (k) => !!content().collectibleSet[k], 10);
  if (col) out.collectibles = col;
  return out;
}

function place(ctx: Ctx, itemId: string, x: number, y: number, rot: unknown, fromInventory: boolean): void {
  const s = ctx.s;
  if (typeof itemId !== 'string') fail('invalid');
  const def = maybeItem(itemId);
  if (!def) fail('invalid', 'unknown item');
  if (rot !== 0 && rot !== 1) fail('invalid');
  if (rot === 1 && def.noRotate) fail('invalid');
  if (fromInventory) {
    if ((s.inventory[itemId] ?? 0) <= 0) fail('notFound');
  } else {
    if (def.hidden) fail('locked');
    const lock = unlockProblem(s, def);
    if (lock) fail(lock);
    if (s.coins < def.price) fail('noCoins');
  }
  if (def.limit && countItem(s, itemId) >= def.limit) fail('limit');
  if (def.kind === 'house' && reservedPopulation(s) + (def.pop ?? 0) > popCap(s)) fail('popCap');
  const index = new WorldIndex(s);
  const check = checkPlacement(index, def, x, y, rot);
  if (!check.ok) fail(check.reason);

  const o: WorldObject = { id: s.nextId++, item: itemId, x, y, rot, clicks: 0, built: false, placedAt: ctx.now };
  s.objects[o.id] = o;
  if (fromInventory) {
    s.inventory[itemId] = (s.inventory[itemId] ?? 0) - 1;
    if (s.inventory[itemId]! <= 0) delete s.inventory[itemId];
  } else {
    spendCoins(s, def.price);
  }
  bump(s, `place:${itemId}`);
  bump(s, `place:kind:${def.kind}`);
  ctx.events.push({ type: 'placed', objId: o.id });
  const instant = !def.clicks || fromInventory;
  if (instant) {
    o.clicks = def.clicks ?? 0;
    if (fromInventory && def.jobs) o.staff = Array.from({ length: def.jobs }, () => 'vol');
    finishConstruction(ctx, o, true);
  }
}

function needsStaff(o: WorldObject, def: ItemDef): boolean {
  return !!def.jobs && (o.staff?.length ?? 0) < def.jobs;
}

function needsParts(o: WorldObject, def: ItemDef): boolean {
  if (!def.parts) return false;
  return Object.entries(def.parts).some(([p, n]) => (o.partsIn?.[p] ?? 0) < n);
}

function build(ctx: Ctx, o: WorldObject): void {
  const def = defOf(o);
  if (o.built) fail('alreadyDone');
  const total = def.clicks ?? 0;
  if (o.clicks < total) {
    spendEnergy(ctx);
    o.clicks += 1;
    bump(ctx.s, 'build:click');
    payout(ctx, 'build', {}, center(o));
    if (o.clicks >= total) {
      if (needsStaff(o, def)) ctx.events.push({ type: 'needsStaff', objId: o.id });
      else if (needsParts(o, def)) ctx.events.push({ type: 'message', key: 'msg.needsParts' });
      else if (!def.jobs) finishConstruction(ctx, o, false);
    }
    return;
  }
  // Frame done: staffed community buildings need one final click.
  if (needsStaff(o, def)) fail('notReady', 'staff');
  if (needsParts(o, def)) fail('noParts');
  spendEnergy(ctx);
  finishConstruction(ctx, o, false);
}

function finishConstruction(ctx: Ctx, o: WorldObject, instant: boolean): void {
  const s = ctx.s;
  const def = defOf(o);
  o.built = true;
  o.builtAt = ctx.now;
  switch (def.kind) {
    case 'house':
      o.readyAt = ctx.now + (def.rentTime ?? 3600) * 1000;
      ctx.events.push({ type: 'moveIn', objId: o.id, pop: def.pop ?? 0 });
      break;
    case 'business':
      o.shop = { state: 'opening', served: 0 };
      ctx.events.push({ type: 'shopOpened', objId: o.id });
      break;
    case 'plot':
      o.crop = null;
      break;
    case 'pier':
      o.ships = Array.from({ length: def.slots?.[0] ?? 2 }, () => null);
      break;
    case 'wonder':
      o.boostReadyAt = ctx.now;
      break;
    default:
      break;
  }
  if (def.profit && def.profitTime) o.readyAt = ctx.now + def.profitTime * 1000;
  bump(s, `built:${def.id}`);
  bump(s, `built:kind:${def.kind}`);
  ctx.events.push({ type: 'built', objId: o.id });
  if (instant) {
    if (def.xp) grantAt(ctx, { xp: def.xp }, center(o));
  } else {
    payout(ctx, 'finish', { xp: def.xp ?? 0 }, center(o));
  }
}

function staff(ctx: Ctx, o: WorldObject, source: unknown): void {
  const def = defOf(o);
  if (o.built || !def.jobs) fail('invalid');
  if ((def.clicks ?? 0) > o.clicks) fail('notReady');
  if (!needsStaff(o, def)) fail('alreadyDone');
  if (typeof source !== 'string') fail('invalid');
  o.staff = o.staff ?? [];
  if (source === 'vol') {
    if (ctx.s.volunteers < 1) fail('noVolunteers');
    ctx.s.volunteers -= 1;
    if (ctx.s.volunteers < content().balance.volunteers.max && ctx.s.volunteers + 1 >= content().balance.volunteers.max) {
      ctx.s.volunteersAt = ctx.now;
    }
  } else if (source.startsWith('npc:')) {
    const n = ensureNpc(ctx.s, source.slice(4));
    if (n.staffed.includes(o.id)) fail('alreadyDone');
    n.staffed.push(o.id);
  } else if (/^user:\d{1,12}$/.test(source)) {
    if (o.staff.includes(source)) fail('alreadyDone');
  } else {
    fail('invalid');
  }
  o.staff.push(source);
  bump(ctx.s, 'staff');
}

function collect(ctx: Ctx, o: WorldObject): void {
  const s = ctx.s;
  const def = defOf(o);
  if (!o.built) fail('notReady');
  const index = new WorldIndex(s);
  if (!isOperational(index, o)) fail('needsRoad');
  if (def.kind === 'house') {
    if ((o.readyAt ?? 0) > ctx.now) fail('notReady');
    spendEnergy(ctx);
    const rent = houseRent(s, o, def, ctx.now);
    o.readyAt = ctx.now + (def.rentTime ?? 3600) * 1000;
    bump(s, 'collect:rent');
    bump(s, `collect:rent:${def.id}`);
    payout(ctx, 'rent', { coins: rent }, center(o), opts(def));
    return;
  }
  if (def.kind === 'business') {
    if (o.shop?.state !== 'soldout') fail('notReady');
    spendEnergy(ctx);
    const coins = shopPayout(s, o, def, ctx.now);
    o.shop.state = 'empty';
    o.shop.served = 0;
    o.shop.collects = (o.shop.collects ?? 0) + 1;
    const before = masteryStars(s.mastery[def.id] ?? 0, content().balance.businessMastery.thresholds);
    s.mastery[def.id] = (s.mastery[def.id] ?? 0) + 1;
    const after = masteryStars(s.mastery[def.id]!, content().balance.businessMastery.thresholds);
    if (after > before) ctx.events.push({ type: 'mastery', item: def.id, stars: after });
    bump(s, 'collect:shop');
    bump(s, `collect:shop:${def.id}`);
    payout(ctx, 'shop', { coins }, center(o), opts(def));
    return;
  }
  if (def.profit && def.profitTime) {
    if ((o.readyAt ?? 0) > ctx.now) fail('notReady');
    spendEnergy(ctx);
    o.readyAt = ctx.now + def.profitTime * 1000;
    bump(s, 'collect:profit');
    bump(s, `collect:profit:${def.id}`);
    payout(ctx, 'profit', { coins: Math.round(def.profit * upgradeMult(o, def)) }, center(o), opts(def));
    return;
  }
  fail('invalid');
}

function opts(def: ItemDef): { collection?: string } {
  return def.collection ? { collection: def.collection } : {};
}

function supply(ctx: Ctx, o: WorldObject): void {
  const s = ctx.s;
  const def = defOf(o);
  if (!o.built || !o.shop) fail('notReady');
  if (o.shop.state !== 'opening' && o.shop.state !== 'empty') fail('alreadyDone');
  const need = shopGoods(o, def);
  if (s.goods < need) fail('noGoods', String(need));
  s.goods -= need;
  o.shop.state = 'open';
  o.shop.served = 0;
  bump(s, 'supply');
  bump(s, `supply:${def.id}`);
  payout(ctx, 'supply', {}, center(o));
}

function plant(ctx: Ctx, o: WorldObject, cropId: unknown): void {
  const s = ctx.s;
  const def = defOf(o);
  if (def.kind !== 'plot' || !o.built) fail('invalid');
  if (o.crop) fail('busy');
  if (typeof cropId !== 'string') fail('invalid');
  const crop = content().crops[cropId];
  if (!crop) fail('invalid');
  if (s.level < crop.level) fail('locked');
  spendCoins(s, crop.seed);
  o.crop = { id: crop.id, plantedAt: ctx.now };
  bump(s, 'plant');
  bump(s, `plant:${crop.id}`);
  grantAt(ctx, { xp: 1 }, center(o));
}

function harvest(ctx: Ctx, o: WorldObject): void {
  const s = ctx.s;
  if (!o.crop) fail('notReady');
  const stage = cropStage(s, o, ctx.now);
  if (stage !== 'ripe') fail('notReady', stage ?? '');
  const crop = content().crops[o.crop.id]!;
  spendEnergy(ctx);
  harvestCrop(ctx, o, crop.id, 1);
}

function harvestCrop(ctx: Ctx, o: WorldObject, cropId: string, mult: number): void {
  const s = ctx.s;
  const crop = content().crops[cropId]!;
  const goods = Math.round(crop.goods * mult * (1 + cropMasteryBonus(s, crop.id)) * boostValue(s, ctx.now, 'cropGoods'));
  o.crop = null;
  const before = masteryStars(s.mastery[crop.id] ?? 0, content().balance.crops.masteryThresholds);
  s.mastery[crop.id] = (s.mastery[crop.id] ?? 0) + 1;
  const after = masteryStars(s.mastery[crop.id]!, content().balance.crops.masteryThresholds);
  if (after > before) ctx.events.push({ type: 'mastery', item: crop.id, stars: after });
  bump(s, 'harvest');
  bump(s, `harvest:${crop.id}`);
  const o2: { collection?: string; produce: string } = { produce: crop.id };
  if (crop.collection) o2.collection = crop.collection;
  payout(ctx, 'harvest', { goods, xp: crop.xp }, center(o), o2);
}

function clearPlot(ctx: Ctx, o: WorldObject): void {
  if (!o.crop) fail('notReady');
  if (cropStage(ctx.s, o, ctx.now) !== 'withered') fail('invalid');
  o.crop = null;
  bump(ctx.s, 'clear');
}

function move(ctx: Ctx, o: WorldObject, x: number, y: number, rot: unknown): void {
  const def = defOf(o);
  if (def.noMove) fail('invalid');
  if (rot !== 0 && rot !== 1) fail('invalid');
  if (rot === 1 && def.noRotate) fail('invalid');
  const index = new WorldIndex(ctx.s);
  const check = checkPlacement(index, def, x, y, rot, o.id);
  if (!check.ok) fail(check.reason);
  o.x = x;
  o.y = y;
  o.rot = rot;
  bump(ctx.s, 'move');
}

function rotate(ctx: Ctx, o: WorldObject): void {
  const def = defOf(o);
  if (def.noRotate || def.noMove) fail('invalid');
  const rot = o.rot === 0 ? 1 : 0;
  const index = new WorldIndex(ctx.s);
  const check = checkPlacement(index, def, o.x, o.y, rot, o.id);
  if (!check.ok) fail(check.reason);
  o.rot = rot;
}

function store(ctx: Ctx, o: WorldObject): void {
  const def = defOf(o);
  if (def.noStore || def.noMove) fail('invalid');
  if (!o.built) fail('notReady');
  if (def.kind === 'road' || def.kind === 'sidewalk') fail('invalid');
  ctx.s.inventory[def.id] = (ctx.s.inventory[def.id] ?? 0) + 1;
  delete ctx.s.objects[o.id];
  bump(ctx.s, 'store');
  ctx.events.push({ type: 'removed', objId: o.id });
}

function sell(ctx: Ctx, o: WorldObject): void {
  const def = defOf(o);
  if (def.noSell) fail('invalid');
  const refund = Math.floor(def.price * content().balance.sell.refund);
  ctx.s.coins += refund;
  delete ctx.s.objects[o.id];
  bump(ctx.s, 'sell');
  ctx.events.push({ type: 'removed', objId: o.id });
}

function claimDaily(ctx: Ctx, tz: number): void {
  const s = ctx.s;
  const today = dayKey(ctx.now, tz);
  if (s.daily.day === today) fail('alreadyDone');
  const yesterday = dayKey(ctx.now - 86400000, tz);
  const streak = s.daily.day === yesterday ? s.daily.streak + 1 : 1;
  s.daily = { day: today, streak };
  const table = content().balance.daily;
  const reward = table[Math.min(streak, table.length) - 1] as Reward;
  bump(s, 'daily');
  emitDrops(ctx, applyReward(ctx, reward), { x: Number.NaN, y: Number.NaN });
}

export function dailyAvailable(s: GameState, now: number, tz: number): boolean {
  return s.daily.day !== dayKey(now, tz);
}

/** Streak day (1-5) that claiming now would pay. */
export function dailyNextDay(s: GameState, now: number, tz: number): number {
  const yesterday = dayKey(now - 86400000, tz);
  const len = content().balance.daily.length;
  if (s.daily.day === dayKey(now, tz)) return Math.min(s.daily.streak, len);
  return s.daily.day === yesterday ? Math.min(s.daily.streak + 1, len) : 1;
}

function redeem(ctx: Ctx, setId: unknown): void {
  const s = ctx.s;
  if (typeof setId !== 'string') fail('invalid');
  const set = content().collections[setId];
  if (!set) fail('invalid');
  if (!isCollectionComplete(s, setId)) fail('notReady');
  for (const i of set.items) {
    s.collectibles[i] = (s.collectibles[i] ?? 0) - 1;
    if (s.collectibles[i]! <= 0) delete s.collectibles[i];
  }
  s.collectionsDone[setId] = (s.collectionsDone[setId] ?? 0) + 1;
  bump(s, 'redeem');
  bump(s, `redeem:${setId}`);
  emitDrops(ctx, applyReward(ctx, set.reward), { x: Number.NaN, y: Number.NaN });
}

/** Stage (1-10) reached after N pickups, 0 if below the first threshold. */
export function bonusStage(pickups: number): number {
  const stages = content().balance.bonusBar.stages;
  let need = 0;
  let stage = 0;
  for (const st of stages) {
    need += st;
    if (pickups >= need) stage++;
    else break;
  }
  return stage;
}

function bonus(ctx: Ctx, pickups: unknown): void {
  const s = ctx.s;
  if (typeof pickups !== 'number' || !Number.isInteger(pickups) || pickups <= 0) fail('invalid');
  const stage = bonusStage(pickups);
  if (stage === 0) fail('notReady');
  if (pickups > s.pickupBank) fail('invalid', 'pickups');
  s.pickupBank -= pickups;
  const mult = content().balance.bonusBar.payout[stage - 1]!;
  const coins = Math.round(mult * s.level);
  bump(s, 'bonus:payout');
  for (let i = 1; i <= stage; i++) bump(s, `bonus:stage:${i}`);
  s.coins += coins;
  ctx.events.push({ type: 'message', key: 'msg.bonusPaid', params: { coins, stage } });
}

export function expansionCost(s: GameState): { coins: number; population: number; permits: number } {
  const e = content().balance.expansion;
  const n = s.expansions;
  const coins = e.coins[n] ?? e.coins[e.coins.length - 1]! + e.coinsStep * (n - e.coins.length + 1);
  const pop = e.population[n] ?? e.population[e.population.length - 1]! + e.populationStep * (n - e.population.length + 1);
  return { coins, population: pop, permits: (n + 1) * e.permitsPerExpansion };
}

function expand(ctx: Ctx, lx: unknown, ly: unknown): void {
  const s = ctx.s;
  if (typeof lx !== 'number' || typeof ly !== 'number' || !Number.isInteger(lx) || !Number.isInteger(ly)) fail('invalid');
  if (!expandableLots(s).some(([x, y]) => x === lx && y === ly)) fail('invalid');
  const cost = expansionCost(s);
  if (population(s) < cost.population) fail('locked', 'population');
  if (s.permits < cost.permits) fail('noPermits');
  spendCoins(s, cost.coins);
  s.permits -= cost.permits;
  s.lots.push(lotKey(lx, ly));
  s.expansions += 1;
  bump(s, 'expand');
  ctx.events.push({ type: 'expanded', lx, ly });
  grantAt(ctx, { xp: 25 + s.expansions * 10 }, { x: lx * 12 + 6, y: ly * 12 + 6 });
}

function upgrade(ctx: Ctx, o: WorldObject): void {
  const s = ctx.s;
  const def = defOf(o);
  if (!o.built || !def.upgrades) fail('invalid');
  const lvl = o.level ?? 1;
  const step = def.upgrades[lvl - 1];
  if (!step) fail('limit');
  if (step.level && s.level < step.level) fail('locked');
  if (s.coins < step.coins) fail('noCoins');
  for (const [p, n] of Object.entries(step.parts ?? {})) if ((s.parts[p] ?? 0) < n) fail('noParts', p);
  spendCoins(s, step.coins);
  for (const [p, n] of Object.entries(step.parts ?? {})) s.parts[p] = (s.parts[p] ?? 0) - n;
  o.level = lvl + 1;
  if (def.kind === 'pier' && def.slots) {
    const slots = def.slots[Math.min(o.level - 1, def.slots.length - 1)] ?? 2;
    o.ships = o.ships ?? [];
    while (o.ships.length < slots) o.ships.push(null);
  }
  bump(s, 'upgrade');
  bump(s, `upgrade:${def.id}`);
  payout(ctx, 'finish', { xp: 10 * o.level }, center(o));
}

function pierSlots(o: WorldObject, def: ItemDef): number {
  const lvl = o.level ?? 1;
  return def.slots?.[Math.min(lvl - 1, (def.slots?.length ?? 1) - 1)] ?? 2;
}

function ship(ctx: Ctx, o: WorldObject, slot: unknown, contractId: unknown): void {
  const s = ctx.s;
  const def = defOf(o);
  if (def.kind !== 'pier' || !o.built) fail('invalid');
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot >= pierSlots(o, def)) fail('invalid');
  o.ships = o.ships ?? [];
  while (o.ships.length < pierSlots(o, def)) o.ships.push(null);
  if (o.ships[slot]) fail('busy');
  if (typeof contractId !== 'string') fail('invalid');
  const c = content().contracts[contractId];
  if (!c) fail('invalid');
  if (c.level && s.level < c.level) fail('locked');
  spendCoins(s, c.coins);
  o.ships[slot] = { contract: c.id, startedAt: ctx.now };
  bump(s, 'ship:start');
}

export function shipReady(o: WorldObject, slot: number, now: number): boolean {
  const sh = o.ships?.[slot];
  if (!sh) return false;
  const c = content().contracts[sh.contract];
  return !!c && now >= sh.startedAt + c.time * 1000;
}

function unload(ctx: Ctx, o: WorldObject, slot: unknown): void {
  if (typeof slot !== 'number' || !Number.isInteger(slot)) fail('invalid');
  const sh = o.ships?.[slot];
  if (!sh) fail('notFound');
  if (!shipReady(o, slot, ctx.now)) fail('notReady');
  const c = content().contracts[sh.contract]!;
  spendEnergy(ctx);
  o.ships![slot] = null;
  bump(ctx.s, 'ship:unload');
  const def = defOf(o);
  const base: Reward = { goods: Math.round(c.goods * upgradeMult(o, def)) };
  // long voyages always bring back a building part
  if (c.time >= 28800) base.parts = { [ctx.rng.pick(BUILD_PARTS)]: 1 };
  payout(ctx, 'unload', base, center(o), { collection: 'seaside' });
}

function stationObj(s: GameState): WorldObject | undefined {
  for (const k in s.objects) {
    const o = s.objects[k]!;
    if (maybeItem(o.item)?.kind === 'station') return o;
  }
  return undefined;
}

function train(ctx: Ctx, routeId: unknown, stops: unknown): void {
  const s = ctx.s;
  const st = stationObj(s);
  if (!st || !st.built) fail('notFound');
  if (s.level < content().balance.train.unlockLevel) fail('locked');
  if (s.train) fail('busy');
  if (typeof routeId !== 'string') fail('invalid');
  const r = content().routes[routeId];
  if (!r) fail('invalid');
  if (r.level && s.level < r.level) fail('locked');
  if (!Array.isArray(stops)) fail('invalid');
  const clean = [...new Set(stops.filter((x): x is string => typeof x === 'string' && /^(npc:[a-z]+|user:\d{1,12})$/.test(x)))].slice(0, r.stops);
  if (r.type === 'buy') spendCoins(s, r.cost);
  else {
    if (s.goods < r.cost) fail('noGoods', String(r.cost));
    s.goods -= r.cost;
  }
  s.train = { route: r.id, startedAt: ctx.now, stops: clean };
  bump(s, 'train:send');
}

export function trainReady(s: GameState, now: number): boolean {
  if (!s.train) return false;
  const r = content().routes[s.train.route];
  return !!r && now >= s.train.startedAt + r.time * 1000;
}

function trainCollect(ctx: Ctx): void {
  const s = ctx.s;
  if (!s.train) fail('notFound');
  if (!trainReady(s, ctx.now)) fail('notReady');
  const r = content().routes[s.train.route]!;
  spendEnergy(ctx);
  const amount = r.base + r.perStop * s.train.stops.length;
  const st = stationObj(s);
  s.train = null;
  bump(s, 'train:collect');
  const where = st ? center(st) : { x: Number.NaN, y: Number.NaN };
  payout(ctx, 'train', r.type === 'buy' ? { goods: amount } : { coins: amount }, where, { collection: 'rail' });
}

function boost(ctx: Ctx, o: WorldObject): void {
  const s = ctx.s;
  const def = defOf(o);
  if (def.kind !== 'wonder' || !o.built || !def.boost) fail('invalid');
  const b = content().boosts[def.boost];
  if (!b) fail('invalid');
  if ((o.boostReadyAt ?? 0) > ctx.now) fail('notReady');
  spendEnergy(ctx, b.energy);
  const until = ctx.now + b.duration * 1000;
  s.boosts = s.boosts.filter((x) => x.id !== b.id);
  s.boosts.push({ id: b.id, until });
  o.boostReadyAt = ctx.now + b.cooldown * 1000;
  bump(s, 'boost');
  bump(s, `boost:${b.id}`);
  ctx.events.push({ type: 'boost', id: b.id, until });
}

function recharge(ctx: Ctx, o: WorldObject): void {
  const s = ctx.s;
  const def = defOf(o);
  if (def.kind !== 'wonder' || !o.built || !def.boost) fail('invalid');
  const b = content().boosts[def.boost]!;
  if ((o.boostReadyAt ?? 0) <= ctx.now) fail('alreadyDone');
  if ((s.parts.key ?? 0) < b.keys) fail('noParts', 'key');
  s.parts.key = (s.parts.key ?? 0) - b.keys;
  o.boostReadyAt = ctx.now;
}

function deliverParts(ctx: Ctx, o: WorldObject): void {
  const s = ctx.s;
  const def = defOf(o);
  if (o.built || !def.parts) fail('invalid');
  if (o.clicks < (def.clicks ?? 0)) fail('notReady');
  o.partsIn = o.partsIn ?? {};
  let moved = 0;
  for (const [p, n] of Object.entries(def.parts)) {
    const have = s.parts[p] ?? 0;
    const need = n - (o.partsIn[p] ?? 0);
    const give = Math.max(0, Math.min(have, need));
    if (give > 0) {
      s.parts[p] = have - give;
      o.partsIn[p] = (o.partsIn[p] ?? 0) + give;
      moved += give;
    }
  }
  if (moved === 0) fail('noParts');
  if (!needsParts(o, def) && !needsStaff(o, def)) finishConstruction(ctx, o, false);
}

// ----------------------------------------------------------------- social --

function addGifts(ctx: Ctx, gifts: unknown): void {
  if (!Array.isArray(gifts)) fail('invalid');
  for (const g of gifts.slice(0, 50)) {
    if (!g || typeof g.id !== 'string' || g.id.length > 60 || typeof g.from !== 'string') continue;
    if (ctx.s.applied.includes(`gift:${g.id}`) || ctx.s.gifts.some((x) => x.id === g.id)) continue;
    ctx.s.gifts.push({ id: g.id, from: cleanName(g.from, 40), reward: sanitizeReward(g.reward), at: Number(g.at) || ctx.now });
  }
  if (ctx.s.gifts.length > 100) ctx.s.gifts.splice(0, ctx.s.gifts.length - 100);
}

function acceptGift(ctx: Ctx, id: unknown): void {
  const s = ctx.s;
  const g = s.gifts.find((x) => x.id === id);
  if (!g) fail('notFound');
  s.gifts = s.gifts.filter((x) => x.id !== id);
  markApplied(s, `gift:${g.id}`);
  bump(s, 'gift:accept');
  emitDrops(ctx, applyReward(ctx, g.reward), { x: Number.NaN, y: Number.NaN });
}

const HELP_ACTIONS: HelpAction[] = ['tourbus', 'harvest', 'water', 'revive', 'build', 'clean'];

function addHelps(ctx: Ctx, helps: unknown): void {
  if (!Array.isArray(helps)) fail('invalid');
  for (const h of helps.slice(0, 100)) {
    if (!h || typeof h.id !== 'string' || h.id.length > 60 || typeof h.from !== 'string') continue;
    if (!HELP_ACTIONS.includes(h.action) || typeof h.objectId !== 'number') continue;
    if (ctx.s.applied.includes(`help:${h.id}`) || ctx.s.helps.some((x) => x.id === h.id)) continue;
    ctx.s.helps.push({ id: h.id, from: cleanName(h.from, 40), objectId: h.objectId, action: h.action, at: Number(h.at) || ctx.now });
  }
}

/** Whether a help action would do something useful on this object right now. */
export function helpApplies(s: GameState, o: WorldObject, action: HelpAction, now: number): boolean {
  const def = maybeItem(o.item);
  if (!def) return false;
  switch (action) {
    case 'tourbus':
      return def.kind === 'business' && o.shop?.state === 'open';
    case 'harvest':
      return cropStage(s, o, now) === 'ripe';
    case 'water':
      return cropStage(s, o, now) === 'seed' || cropStage(s, o, now) === 'growing';
    case 'revive':
      return cropStage(s, o, now) === 'withered';
    case 'build':
      return !o.built && o.clicks < (def.clicks ?? 0);
    case 'clean':
      return def.kind === 'house' && o.built;
    default:
      return false;
  }
}

/** Picks the most useful help action for an object (visitor UI). */
export function bestHelp(s: GameState, o: WorldObject, now: number): HelpAction | null {
  for (const a of ['revive', 'harvest', 'water', 'build', 'tourbus'] as HelpAction[]) {
    if (helpApplies(s, o, a, now)) return a;
  }
  return null;
}

function acceptHelp(ctx: Ctx, id: unknown): void {
  const s = ctx.s;
  const h = s.helps.find((x) => x.id === id);
  if (!h) fail('notFound');
  s.helps = s.helps.filter((x) => x.id !== id);
  markApplied(s, `help:${h.id}`);
  bump(s, 'helpAccept');
  const o = s.objects[h.objectId];
  const reward: Reward = { coins: 15, xp: 1 };
  if (o && helpApplies(s, o, h.action, ctx.now)) applyHelpEffect(ctx, o, h);
  const where = o ? center(o) : { x: Number.NaN, y: Number.NaN };
  if (o) o.helpedAt = ctx.now;
  grantAt(ctx, reward, where);
}

function applyHelpEffect(ctx: Ctx, o: WorldObject, h: PendingHelp): void {
  const def = defOf(o);
  const b = content().balance;
  switch (h.action) {
    case 'tourbus': {
      const cap = shopGoods(o, def);
      o.shop!.served = Math.min(cap, o.shop!.served + Math.max(1, Math.ceil(cap * b.shops.tourBusShare)));
      if (o.shop!.served >= cap) o.shop!.state = 'soldout';
      break;
    }
    case 'harvest':
      harvestCrop(ctx, o, o.crop!.id, 1);
      break;
    case 'water': {
      const crop = content().crops[o.crop!.id]!;
      o.crop!.boost = (o.crop!.boost ?? 0) + crop.time * b.crops.waterSeconds;
      break;
    }
    case 'revive': {
      const crop = content().crops[o.crop!.id]!;
      o.crop!.plantedAt = ctx.now - crop.time * 1000;
      o.crop!.boost = 0;
      o.crop!.revived = true;
      break;
    }
    case 'build':
      o.clicks += 1;
      if (o.clicks >= (def.clicks ?? 0) && !def.jobs && !needsParts(o, def)) finishConstruction(ctx, o, false);
      break;
    case 'clean':
      if (o.readyAt && o.readyAt > ctx.now) o.readyAt = Math.max(ctx.now, o.readyAt - (def.rentTime ?? 0) * 250);
      break;
    default:
      break;
  }
}

/** Visitor side: reward for helping a neighbor (NPC towns are enforced here). */
function helpReward(ctx: Ctx, reward: unknown, key: unknown, npc?: string, objectId?: number, day?: string, at?: [number, number]): void {
  const s = ctx.s;
  if (typeof key !== 'string' || key.length > 80) fail('invalid');
  if (s.applied.includes(key)) fail('alreadyDone');
  if (npc !== undefined) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) fail('invalid');
    const n = ensureNpc(s, npc);
    if (n.day !== day) {
      n.day = day;
      n.helps = 0;
      n.helped = [];
    }
    if (n.helps >= content().balance.visit.helpsPerDay) fail('limit');
    if (typeof objectId === 'number') {
      if (n.helped.includes(objectId)) fail('alreadyDone');
      n.helped.push(objectId);
    }
    n.helps += 1;
  }
  markApplied(s, key);
  bump(s, 'help');
  if (npc) bump(s, `help:${npc}`);
  const where = Array.isArray(at) && Number.isFinite(at[0]) && Number.isFinite(at[1]) ? { x: at[0], y: at[1] } : { x: Number.NaN, y: Number.NaN };
  const r: Reward = npc ? { ...(content().balance.visit.helpReward as Reward) } : sanitizeReward(reward);
  const t = content().balance.drops.help;
  if (ctx.rng.chance(t.part)) {
    const part = ctx.rng.pick(BUILD_PARTS);
    r.parts = { ...(r.parts ?? {}), [part]: (r.parts?.[part] ?? 0) + 1 };
  }
  const drops = applyReward(ctx, r);
  // Occasional collectible from helping.
  if (ctx.rng.chance(t.collectible)) {
    const set = ctx.rng.pick(content().collectionList.filter((c) => c.id !== 'civic' && c.id !== 'harvestfest'));
    const pick = ctx.rng.pick(set.items);
    addCollectible(ctx, pick);
    drops.push({ kind: 'collectible', amount: 1, id: pick });
  }
  emitDrops(ctx, drops, where);
}

/** Coins it costs to open a franchise of a shop in a neighbor's town (80% of its price). */
export function franchiseCost(item: string): number {
  const def = maybeItem(item);
  return def?.kind === 'business' ? Math.round(def.price * 0.8) : 0;
}

/** Pays for a new franchise; the player must own a finished copy of that shop. */
function franchisePay(ctx: Ctx, item: unknown): void {
  const s = ctx.s;
  if (typeof item !== 'string') fail('invalid');
  const cost = franchiseCost(item);
  if (!cost) fail('invalid');
  if (!Object.values(s.objects).some((o) => o.item === item && o.built)) fail('notOwned');
  if (s.coins < cost) fail('noCoins');
  s.coins -= cost;
  bump(s, 'franchise');
}

/**
 * The daily supply run for every franchise (the server works out the goods and
 * reward). Goods the player no longer has are simply not taken.
 */
function franchiseSupply(ctx: Ctx, goods: unknown, reward: unknown, key: unknown): void {
  const s = ctx.s;
  if (typeof key !== 'string' || key.length > 80 || typeof goods !== 'number' || !Number.isFinite(goods) || goods < 0) fail('invalid');
  if (s.applied.includes(key)) fail('alreadyDone');
  markApplied(s, key);
  s.goods = Math.max(0, s.goods - Math.floor(goods));
  bump(s, 'franchiseSupply');
  emitDrops(ctx, applyReward(ctx, sanitizeReward(reward)), { x: Number.NaN, y: Number.NaN });
}

function visitBonus(ctx: Ctx, npc: string, day: string): void {
  const s = ctx.s;
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) fail('invalid');
  const n = ensureNpc(s, npc);
  const key = `visit:${npc}:${day}`;
  if (s.applied.includes(key)) fail('alreadyDone');
  if (n.day !== day) {
    n.day = day;
    n.helps = 0;
    n.helped = [];
  }
  markApplied(s, key);
  bump(s, 'visit');
  bump(s, `visit:${npc}`);
  emitDrops(ctx, applyReward(ctx, content().balance.visit.bonus as Reward), { x: Number.NaN, y: Number.NaN });
}

/** Once per day: NPC neighbors send a gift and drop by to help a few objects. */
function npcDaily(ctx: Ctx, day: string, withHelps: boolean): void {
  const s = ctx.s;
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) fail('invalid');
  let changed = false;
  const taken = new Set<number>();
  for (const def of content().npcs) {
    const n = ensureNpc(s, def.id);
    if (n.giftDay !== day) {
      n.giftDay = day;
      const pick = ctx.rng.weighted(content().balance.npcGifts as { w: number; reward: Reward }[]);
      const reward = resolveGift(ctx, pick.reward);
      s.gifts.push({ id: `npc:${def.id}:${day}`, from: `npc:${def.id}`, reward, at: ctx.now });
      changed = true;
    }
    if (n.visitDay !== day) {
      n.visitDay = day;
      changed = true;
      if (!withHelps) continue;
      const candidates: { o: WorldObject; a: HelpAction }[] = [];
      for (const k in s.objects) {
        const o = s.objects[k]!;
        if (taken.has(o.id)) continue;
        const a = bestHelp(s, o, ctx.now);
        if (a && a !== 'clean') candidates.push({ o, a });
      }
      const count = Math.min(content().balance.visit.npcHelpsOnYou, candidates.length);
      for (let i = 0; i < count; i++) {
        const idx = ctx.rng.int(0, candidates.length - 1);
        const [c] = candidates.splice(idx, 1);
        if (!c) break;
        taken.add(c.o.id);
        s.helps.push({ id: `npc:${def.id}:${day}:${c.o.id}`, from: `npc:${def.id}`, objectId: c.o.id, action: c.a, at: ctx.now });
      }
    }
  }
  if (!changed) fail('alreadyDone');
}

function resolveGift(ctx: Ctx, r: Reward): Reward {
  if (!r.collectibles || !r.collectibles['@wishlist']) return r;
  const out: Reward = { ...r };
  const wish = ctx.s.wishlist;
  let id: string;
  if (wish.length > 0) id = ctx.rng.pick(wish);
  else {
    const set = ctx.rng.pick(content().collectionList);
    id = ctx.rng.pick(set.items);
  }
  out.collectibles = { [id]: 1 };
  return out;
}

export { addGoods, dims };
