// The two built-in neighbor towns. Layouts come from data/npcs.json; each day
// the crops, shops and building sites get fresh (deterministic) states so a
// solo player always has something to help with.
import { content, maybeItem, type NpcDef } from './content';
import { emptyState } from './newgame';
import { nextRandom } from './rng';
import { checkPlacement, lotKey, WorldIndex } from './world';
import type { GameState, WorldObject } from './types';

function dayHash(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Builds the neighbor's town snapshot for a given day. `skipped` collects layout entries that didn't fit. */
export function buildNpcTown(npc: NpcDef, day: string, now: number, skipped?: string[]): GameState {
  let seed = (npc.seed ^ dayHash(day)) >>> 0;
  const rand = () => {
    const [v, s] = nextRandom(seed);
    seed = s;
    return v;
  };
  const s = emptyState(now, seed);
  s.cityName = npc.town;
  s.avatar = npc.avatar;
  s.level = npc.level;
  s.lots = [];
  for (let lx = 0; lx < 3; lx++) for (let ly = 0; ly < 3; ly++) s.lots.push(lotKey(lx, ly));
  const index = new WorldIndex(s);
  const add = (item: string, x: number, y: number, built: boolean): WorldObject | null => {
    const def = maybeItem(item);
    if (!def) return null;
    const check = checkPlacement(index, def, x, y, 0);
    if (!check.ok) {
      skipped?.push(`${item}@${x},${y}:${check.reason}`);
      return null;
    }
    const o: WorldObject = { id: s.nextId++, item, x, y, rot: 0, clicks: built ? def.clicks ?? 0 : 0, built, placedAt: now, builtAt: now };
    s.objects[o.id] = o;
    index.add(o);
    return o;
  };
  for (const [x, y] of npc.roads) add('road', x, y, true);
  for (const [item, x, y] of npc.objects) {
    const o = add(item, x, y, true);
    if (!o) continue;
    const def = maybeItem(item)!;
    const r = rand();
    switch (def.kind) {
      case 'plot': {
        if (r < 0.1) {
          o.crop = null;
          break;
        }
        const crop = content().crops[npc.crops[Math.floor(rand() * npc.crops.length)] ?? 'strawberry'] ?? content().crops.strawberry!;
        // ripe 40%, growing 30%, withered 20%
        const age = r < 0.5 ? crop.time * (1.1 + rand()) : r < 0.8 ? crop.time * (0.2 + rand() * 0.6) : crop.time * 3.4;
        o.crop = { id: crop.id, plantedAt: now - age * 1000 };
        break;
      }
      case 'business': {
        const goods = def.goods ?? 10;
        if (r < 0.55) o.shop = { state: 'open', served: Math.floor(goods * rand() * 0.8) };
        else if (r < 0.8) o.shop = { state: 'soldout', served: goods };
        else o.shop = { state: 'empty', served: 0 };
        break;
      }
      case 'house':
        o.readyAt = now + (r - 0.5) * (def.rentTime ?? 3600) * 1000;
        break;
      case 'pier':
        o.ships = Array.from({ length: def.slots?.[0] ?? 2 }, () => null);
        break;
      default:
        if (def.profit && def.profitTime) o.readyAt = now + r * def.profitTime * 1000;
    }
  }
  for (const [item, x, y] of npc.sites) {
    const o = add(item, x, y, false);
    const def = o ? maybeItem(item) : undefined;
    if (o && def) o.clicks = Math.max(0, Math.min((def.clicks ?? 1) - 1, Math.floor(rand() * (def.clicks ?? 1))));
  }
  s.now = now;
  return s;
}
